-- The Club, step 3 fixes from the PR #19 review. Server only, like the rest: RLS on, no policies, execute revoked.

-- 1. A picture goes into one message only. club_send claims it inside the chat lock, after the replay check (a true
--    retry, same chat, sender and client_id, returns the saved row first), and raises 'club_picture' when the
--    picture isn't the sender's, is used already, or is over an hour old.
create or replace function public.club_send(p_chat bigint, p_sender uuid, p_client text, p_body text, p_flagged text,
                                            p_held boolean, p_request_cap int, p_image uuid, p_event text)
returns table (id bigint, chat_id bigint, sender_id uuid, client_id text, body text, flagged text, held boolean,
               hidden_at timestamptz, created_at timestamptz, image_id uuid, event text, fresh boolean)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  m public.club_messages;
begin
  perform 1 from public.club_chats c where c.id = p_chat for update;
  select * into m from public.club_messages x where x.chat_id = p_chat and x.sender_id = p_sender and x.client_id = p_client;
  if found then
    return query select m.id, m.chat_id, m.sender_id, m.client_id, m.body, m.flagged, m.held, m.hidden_at, m.created_at,
                        m.image_id, m.event, false;
    return;
  end if;
  if exists (select 1 from public.club_chat_members o
              where o.chat_id = p_chat and o.user_id <> p_sender and o.state in ('request', 'declined'))
     and (select count(*) from public.club_messages x where x.chat_id = p_chat and x.sender_id = p_sender) >= p_request_cap then
    raise exception 'club_request_cap';
  end if;
  if p_image is not null then
    update public.club_images i set used_by = 'message'
     where i.id = p_image and i.owner_id = p_sender and i.used_by is null and i.created_at > now() - interval '1 hour';
    if not found then
      raise exception 'club_picture';
    end if;
  end if;
  insert into public.club_messages (chat_id, sender_id, client_id, body, flagged, held, image_id, event)
    values (p_chat, p_sender, p_client, p_body, p_flagged, p_held, p_image, p_event)
    returning * into m;
  if not p_held then
    update public.club_chats set last_message_id = m.id, last_at = m.created_at where club_chats.id = p_chat;
  end if;
  return query select m.id, m.chat_id, m.sender_id, m.client_id, m.body, m.flagged, m.held, m.hidden_at, m.created_at,
                      m.image_id, m.event, true;
end $$;
revoke execute on function public.club_send(bigint, uuid, text, text, text, boolean, int, uuid, text) from public, anon, authenticated;

-- 4. The 20-pictures-a-day cap counts from a log that deleting a post or leaving the Club doesn't clear, and the count
--    and the insert happen under a per-player lock, so two uploads at once can't both pass. Raises 'club_picture_cap'.
create table public.club_image_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index club_image_log_user on public.club_image_log (user_id, created_at desc);
alter table public.club_image_log enable row level security;
revoke all on public.club_image_log from anon, authenticated;

create function public.club_add_image(p_id uuid, p_owner uuid, p_path text, p_width int, p_height int, p_since timestamptz,
                                      p_per_day int)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('club_add_image:' || p_owner::text));
  if (select count(*) from public.club_image_log where user_id = p_owner and created_at >= p_since) >= p_per_day then
    raise exception 'club_picture_cap';
  end if;
  insert into public.club_images (id, owner_id, path, width, height) values (p_id, p_owner, p_path, p_width, p_height);
  insert into public.club_image_log (user_id) values (p_owner);
  delete from public.club_image_log where user_id = p_owner and created_at < now() - interval '2 days';
end $$;
revoke execute on function public.club_add_image(uuid, uuid, text, int, int, timestamptz, int) from public, anon, authenticated;

-- 2. Pictures that are evidence: the owner's pictures in an open report, or in a post or message that is hidden.
--    Before a delete or "Leave the Club", club.ts moves these to removed/ for 180 days instead of deleting them.
create function public.club_evidence_images(p_owner uuid)
returns setof uuid language sql stable set search_path = '' as $$
  select i.id from public.club_images i
   where i.owner_id = p_owner and (
         exists (select 1 from public.club_reports r where r.image_id = i.id and r.status = 'open')
      or exists (select 1 from public.club_posts p where p.image_id = i.id and p.hidden_at is not null)
      or exists (select 1 from public.club_messages m where m.image_id = i.id and m.hidden_at is not null));
$$;
revoke execute on function public.club_evidence_images(uuid) from public, anon, authenticated;

-- 5. Add someone to a group with the chat locked, so two adds at once can't pass 20 people. They see only what comes
--    after. Returns false when the group is full.
create function public.club_add_member(p_chat bigint, p_user uuid, p_max int)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_last bigint;
begin
  perform 1 from public.club_chats c where c.id = p_chat for update;
  if exists (select 1 from public.club_chat_members where chat_id = p_chat and user_id = p_user and state = 'active') then
    return true;
  end if;
  if (select count(*) from public.club_chat_members where chat_id = p_chat and state = 'active') >= p_max then
    return false;
  end if;
  select coalesce(max(id), 0) into v_last from public.club_messages where chat_id = p_chat;
  insert into public.club_chat_members (chat_id, user_id, state, last_read_id, cleared_id, active_at)
    values (p_chat, p_user, 'active', v_last, v_last, null)
    on conflict (chat_id, user_id) do update set state = 'active', last_read_id = v_last, cleared_id = v_last, active_at = null;
  return true;
end $$;
revoke execute on function public.club_add_member(bigint, uuid, int) from public, anon, authenticated;
