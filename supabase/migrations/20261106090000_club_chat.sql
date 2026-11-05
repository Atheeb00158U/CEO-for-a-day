-- The Club (docs/superpowers/specs/2026-11-04-community-design.md), step 2: one-to-one chats with message requests,
-- "Seen" and "Delete chat". Server only, like every Club table: RLS on, no policies, no grants. Everything a player
-- owns cascades from club_profiles, so leaving the Club or deleting the account removes their chats and messages.
-- Live delivery: the server writes here, then broadcasts through Realtime's REST endpoint to each player's private
-- topic user:<id>. The one policy at the end lets a signed-in player listen to their own topic only.

create table public.club_chats (
  id bigint generated always as identity primary key,
  -- One-to-one chats: '<smaller uuid>:<larger uuid>', so a pair has one chat. null for groups (step 3).
  pair text unique,
  title text check (char_length(title) <= 30),    -- groups only (step 3)
  created_by uuid references public.club_profiles (user_id) on delete set null,
  last_message_id bigint,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index club_chats_created_by on public.club_chats (created_by, created_at);   -- the new-chats-a-day count

create table public.club_chat_members (
  chat_id bigint not null references public.club_chats (id) on delete cascade,
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  -- request: from someone this player doesn't follow; declined: they deleted the request (the sender isn't told).
  state text not null check (state in ('active', 'request', 'declined', 'left')),
  last_read_id bigint not null default 0,       -- "Seen"
  cleared_id bigint not null default 0,         -- "Delete chat" hides messages up to here, for this player only
  -- Last time this player fetched or marked this chat seen: no push while they are reading it.
  active_at timestamptz,
  primary key (chat_id, user_id)
);
create index club_chat_members_user on public.club_chat_members (user_id, state);

create table public.club_messages (
  id bigint generated always as identity primary key,
  chat_id bigint not null references public.club_chats (id) on delete cascade,
  sender_id uuid not null references public.club_profiles (user_id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 64),   -- random from the phone: a retry sends once
  body text not null check (char_length(body) between 1 and 1000),
  flagged text check (flagged in ('auto_scam', 'auto_link')),               -- the warning line shows under it
  -- A link or scam words in a message request: only the sender sees it until a moderator approves it.
  held boolean not null default false,
  hidden_at timestamptz,                        -- removed by a moderator or hidden by reports
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index club_messages_chat on public.club_messages (chat_id, id desc);
create index club_messages_sender on public.club_messages (sender_id, id desc);

-- Save a message and move the chat to the top in one call. The checks (gate, blocks, request limits, autoFlag)
-- happen in club.ts before this. A retry with the same client_id returns the first row. A held message doesn't move
-- the chat. Runs as the caller (the secret key); execute is revoked from the public roles.
create function public.club_send(p_chat bigint, p_sender uuid, p_client text, p_body text, p_flagged text, p_held boolean)
returns public.club_messages language plpgsql set search_path = '' as $$
declare
  m public.club_messages;
begin
  insert into public.club_messages (chat_id, sender_id, client_id, body, flagged, held)
    values (p_chat, p_sender, p_client, p_body, p_flagged, p_held)
    on conflict (sender_id, client_id) do nothing
    returning * into m;
  if m.id is null then
    select * into m from public.club_messages where sender_id = p_sender and client_id = p_client;
    return m;
  end if;
  if not p_held then
    update public.club_chats set last_message_id = m.id, last_at = m.created_at where id = p_chat;
  end if;
  return m;
end $$;
revoke execute on function public.club_send(bigint, uuid, text, text, text, boolean) from public, anon, authenticated;

-- A player's inbox (state 'active') or requests (state 'request'), newest first: each chat with its last message the
-- player may see and the other member (null once they deleted their account). Chats with nothing to show (no message
-- yet, or all of it cleared) are left out. Blocks are filtered in club.ts.
create function public.club_inbox(p_user uuid, p_state text, p_before timestamptz, p_limit int)
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
   where me.user_id = p_user and me.state = p_state and c.last_at < p_before
   order by c.last_at desc limit p_limit;
$$;
revoke execute on function public.club_inbox(uuid, text, timestamptz, int) from public, anon, authenticated;

-- The red dot: active chats with a message from the other player after "Seen", and requests waiting.
create function public.club_unread(p_user uuid)
returns table (chats int, requests int) language sql stable set search_path = '' as $$
  select
    count(*) filter (where me.state = 'active' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.sender_id <> p_user and x.hidden_at is null and not x.held
         and x.id > greatest(me.last_read_id, me.cleared_id)))::int,
    count(*) filter (where me.state = 'request' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.hidden_at is null and not x.held and x.id > me.cleared_id))::int
  from public.club_chat_members me where me.user_id = p_user and me.state in ('active', 'request');
$$;
revoke execute on function public.club_unread(uuid) from public, anon, authenticated;

alter table public.club_chats enable row level security;
alter table public.club_chat_members enable row level security;
alter table public.club_messages enable row level security;
revoke all on public.club_chats, public.club_chat_members, public.club_messages from anon, authenticated;

-- Chats nobody is in any more (both accounts deleted or both left) go in a daily purge at 03:15 IST.
select cron.schedule('club-chat-purge', '45 21 * * *', $$
  delete from public.club_chats c where not exists (select 1 from public.club_chat_members m where m.chat_id = c.id);
$$);

-- Realtime: a signed-in player may listen to their own topic, user:<id>, and nothing else. No INSERT policy, so
-- the browser can never broadcast or use presence; only the server (secret key, REST) sends.
create policy "listen to own topic" on realtime.messages for select to authenticated
  using ((select realtime.topic()) = 'user:' || (select auth.uid())::text and extension = 'broadcast');
