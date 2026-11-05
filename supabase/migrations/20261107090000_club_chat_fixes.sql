-- The Club, step 2 fixes from the PR #18 review. Server only, like the rest: execute revoked from the public roles.

-- 1. A retry key is per chat: the same client_id in another chat is a new message, never the old row.
alter table public.club_messages drop constraint club_messages_sender_id_client_id_key;
alter table public.club_messages add constraint club_messages_once unique (chat_id, sender_id, client_id);

-- 1 + 2. club_send, new version: locks the chat, so the "3 messages before a request is accepted" cap can't be
-- raced; a retry (same chat, sender and client_id) returns the saved row with fresh = false, and club.ts then sends
-- nothing. Over the cap it raises 'club_request_cap'.
drop function public.club_send(bigint, uuid, text, text, text, boolean);
create function public.club_send(p_chat bigint, p_sender uuid, p_client text, p_body text, p_flagged text, p_held boolean,
                                 p_request_cap int)
returns table (id bigint, chat_id bigint, sender_id uuid, client_id text, body text, flagged text, held boolean,
               hidden_at timestamptz, created_at timestamptz, fresh boolean)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  m public.club_messages;
begin
  perform 1 from public.club_chats c where c.id = p_chat for update;
  select * into m from public.club_messages x where x.chat_id = p_chat and x.sender_id = p_sender and x.client_id = p_client;
  if found then
    return query select m.id, m.chat_id, m.sender_id, m.client_id, m.body, m.flagged, m.held, m.hidden_at, m.created_at, false;
    return;
  end if;
  -- Until the other player accepts (or after they silently deleted the request), the sender gets p_request_cap.
  if exists (select 1 from public.club_chat_members o
              where o.chat_id = p_chat and o.user_id <> p_sender and o.state in ('request', 'declined'))
     and (select count(*) from public.club_messages x where x.chat_id = p_chat and x.sender_id = p_sender) >= p_request_cap then
    raise exception 'club_request_cap';
  end if;
  insert into public.club_messages (chat_id, sender_id, client_id, body, flagged, held)
    values (p_chat, p_sender, p_client, p_body, p_flagged, p_held)
    returning * into m;
  if not p_held then
    update public.club_chats set last_message_id = m.id, last_at = m.created_at where club_chats.id = p_chat;
  end if;
  return query select m.id, m.chat_id, m.sender_id, m.client_id, m.body, m.flagged, m.held, m.hidden_at, m.created_at, true;
end $$;
revoke execute on function public.club_send(bigint, uuid, text, text, text, boolean, int) from public, anon, authenticated;

-- 3. New chats started, keyed to the account (not the Club profile), so leaving and joining again can't reset the
-- daily limits. Like club_post_log, it holds no text.
create table public.club_chat_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  request boolean not null,
  created_at timestamptz not null default now()
);
create index club_chat_log_user on public.club_chat_log (user_id, created_at desc);
alter table public.club_chat_log enable row level security;
revoke all on public.club_chat_log from anon, authenticated;

-- Start a chat (or return the pair's chat) under a per-player lock, so the daily limits can't be raced. Raises
-- 'club_chat_cap' when this chat would pass them.
create function public.club_start_chat(p_pair text, p_creator uuid, p_other uuid, p_request boolean, p_since timestamptz,
                                       p_per_day int, p_requests_per_day int)
returns bigint language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('club_start_chat:' || p_creator::text));
  select id into v_id from public.club_chats where pair = p_pair;
  if found then return v_id; end if;
  if (select count(*) from public.club_chat_log where user_id = p_creator and created_at >= p_since) >= p_per_day
     or (p_request and (select count(*) from public.club_chat_log
                         where user_id = p_creator and request and created_at >= p_since) >= p_requests_per_day) then
    raise exception 'club_chat_cap';
  end if;
  insert into public.club_chats (pair, created_by) values (p_pair, p_creator) returning id into v_id;
  insert into public.club_chat_members (chat_id, user_id, state)
    values (v_id, p_creator, 'active'), (v_id, p_other, case when p_request then 'request' else 'active' end);
  insert into public.club_chat_log (user_id, request) values (p_creator, p_request);
  delete from public.club_chat_log where user_id = p_creator and created_at < now() - interval '2 days';
  return v_id;
end $$;
revoke execute on function public.club_start_chat(text, uuid, uuid, boolean, timestamptz, int, int) from public, anon, authenticated;

-- 4. The red dot leaves out chats with players blocked either way (they're hidden from the inbox too).
create or replace function public.club_unread(p_user uuid)
returns table (chats int, requests int) language sql stable set search_path = '' as $$
  select
    count(*) filter (where me.state = 'active' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.sender_id <> p_user and x.hidden_at is null and not x.held
         and x.id > greatest(me.last_read_id, me.cleared_id)))::int,
    count(*) filter (where me.state = 'request' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.hidden_at is null and not x.held and x.id > me.cleared_id))::int
  from public.club_chat_members me
  where me.user_id = p_user and me.state in ('active', 'request')
    and not exists (
      select 1 from public.club_chat_members o join public.club_blocks b
          on (b.blocker_id = p_user and b.blocked_id = o.user_id) or (b.blocker_id = o.user_id and b.blocked_id = p_user)
       where o.chat_id = me.chat_id and o.user_id <> p_user);
$$;
revoke execute on function public.club_unread(uuid) from public, anon, authenticated;

-- 9. The inbox pages by (last_at, chat id), so chats with the same last_at are never skipped.
drop function public.club_inbox(uuid, text, timestamptz, int);
create function public.club_inbox(p_user uuid, p_state text, p_before timestamptz, p_before_id bigint, p_limit int)
returns table (chat_id bigint, last_at timestamptz, last_read_id bigint, other_id uuid,
               msg_id bigint, msg_sender uuid, msg_body text, msg_flagged text, msg_at timestamptz)
language sql stable set search_path = '' as $$
  select c.id, c.last_at, me.last_read_id,
         (select o.user_id from public.club_chat_members o where o.chat_id = c.id and o.user_id <> p_user limit 1),
         lm.id, lm.sender_id, lm.body, lm.flagged, lm.created_at
    from public.club_chat_members me
    join public.club_chats c on c.id = me.chat_id
    join lateral (
      select * from public.club_messages x
       where x.chat_id = c.id and x.hidden_at is null and (not x.held or x.sender_id = p_user) and x.id > me.cleared_id
       order by x.id desc limit 1
    ) lm on true
   where me.user_id = p_user and me.state = p_state and (c.last_at, c.id) < (p_before, p_before_id)
   order by c.last_at desc, c.id desc limit p_limit;
$$;
revoke execute on function public.club_inbox(uuid, text, timestamptz, bigint, int) from public, anon, authenticated;
