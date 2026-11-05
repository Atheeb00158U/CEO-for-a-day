-- The Club (docs/superpowers/specs/2026-11-04-community-design.md), step 3: pictures in posts, replies and chats, then
-- group chats. Server only, like every Club table: RLS on, no policies, no grants.
--
-- Pictures live in the private Storage bucket 'club' (created by hand, see the PR: not public, no storage policies,
-- so only the server's secret key can read or write it). The phone only ever gets signed URLs good for an hour.
-- Paths: '<owner id>/<image id>.webp' while the owner has it; 'removed/<image id>.webp' once a moderator removed it.

create table public.club_images (
  id uuid primary key default gen_random_uuid(),
  -- null once a moderator removed it: the file is then kept 180 days for the IT Rules (3(1)(g)), apart from the
  -- owner, so deleting the account doesn't delete the record.
  owner_id uuid references public.club_profiles (user_id) on delete cascade,
  path text not null unique,
  width smallint not null check (width between 1 and 1080),
  height smallint not null check (height between 1 and 1080),
  used_by text check (used_by in ('post', 'message')),   -- set once, when a post or message takes it
  keep_until timestamptz,                                 -- removed pictures: delete the file after this
  created_at timestamptz not null default now(),
  check ((owner_id is null) = (keep_until is not null))
);
create index club_images_owner on public.club_images (owner_id, created_at desc);   -- the 20-a-day count

alter table public.club_posts add column image_id uuid references public.club_images (id) on delete set null;
alter table public.club_messages add column image_id uuid references public.club_images (id) on delete set null;
-- What a report was about, so /admin/club can show the picture (null once the picture is gone).
alter table public.club_reports add column image_id uuid references public.club_images (id) on delete set null;
create index club_posts_image on public.club_posts (image_id) where image_id is not null;
create index club_messages_image on public.club_messages (image_id) where image_id is not null;
create index club_reports_image on public.club_reports (image_id) where image_id is not null;

-- A message may be only a picture, so its text may be empty (club.ts refuses a message with neither). Not tied to
-- image_id in the database: removing a picture sets image_id null and must not fail.
alter table public.club_messages drop constraint club_messages_body_check;
alter table public.club_messages add constraint club_messages_body_check check (char_length(body) <= 1000);

-- Group lines ("Ravi made this group", "Ravi added Priya", "Ravi left"): the sender is who did it; for added and
-- removed, body holds the other player's name as it was then.
alter table public.club_messages add column event text check (event in ('created', 'added', 'removed', 'left'));

-- Pictures nobody uses: never attached, or their post or message is gone (a deleted post's replies, say), a day on;
-- and removed pictures past their 180 days. The hourly cron (/api/cron/remind) deletes the files, then the rows.
create function public.club_stale_images(p_before timestamptz, p_limit int)
returns setof public.club_images language sql stable set search_path = '' as $$
  select i.* from public.club_images i
   where (i.owner_id is not null and i.created_at < p_before
          and not exists (select 1 from public.club_posts p where p.image_id = i.id)
          and not exists (select 1 from public.club_messages m where m.image_id = i.id))
      or i.keep_until < now()
   limit p_limit;
$$;
revoke execute on function public.club_stale_images(timestamptz, int) from public, anon, authenticated;

-- club_send, step 3 version: as 20261107090000_club_chat_fixes.sql (chat locked, the request cap inside the lock, a
-- retry per (chat, sender, client_id) returns the saved row with fresh = false), plus the picture and the group line.
drop function public.club_send(bigint, uuid, text, text, text, boolean, int);
create function public.club_send(p_chat bigint, p_sender uuid, p_client text, p_body text, p_flagged text, p_held boolean,
                                 p_request_cap int, p_image uuid, p_event text)
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
  -- Until the other player accepts (or after they silently deleted the request), the sender gets p_request_cap.
  -- Groups have no requests, so this never applies there.
  if exists (select 1 from public.club_chat_members o
              where o.chat_id = p_chat and o.user_id <> p_sender and o.state in ('request', 'declined'))
     and (select count(*) from public.club_messages x where x.chat_id = p_chat and x.sender_id = p_sender) >= p_request_cap then
    raise exception 'club_request_cap';
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

-- A new group under the same per-player lock as club_start_chat, counted in club_chat_log (which leaving the Club
-- doesn't clear) against the same daily limit. club.ts checks every member first (in the Club, follow each other, not
-- blocked). Raises 'club_chat_cap' over the limit.
create function public.club_start_group(p_creator uuid, p_others uuid[], p_title text, p_since timestamptz, p_per_day int)
returns bigint language plpgsql set search_path = '' as $$
declare
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('club_start_chat:' || p_creator::text));
  if (select count(*) from public.club_chat_log where user_id = p_creator and created_at >= p_since) >= p_per_day then
    raise exception 'club_chat_cap';
  end if;
  insert into public.club_chats (pair, title, created_by) values (null, p_title, p_creator) returning id into v_id;
  insert into public.club_chat_members (chat_id, user_id, state)
    select v_id, u, 'active' from unnest(array_prepend(p_creator, p_others)) as u;
  insert into public.club_chat_log (user_id, request) values (p_creator, false);
  return v_id;
end $$;
revoke execute on function public.club_start_group(uuid, uuid[], text, timestamptz, int) from public, anon, authenticated;

-- A group needs a name (one-to-one chats have a pair instead).
alter table public.club_chats add constraint club_chats_group_title check (pair is not null or title is not null);

-- The inbox also gives a group's name and says whether the last message is a picture or a group line. Groups have no
-- single "other" player.
drop function public.club_inbox(uuid, text, timestamptz, bigint, int);
create function public.club_inbox(p_user uuid, p_state text, p_before timestamptz, p_before_id bigint, p_limit int)
returns table (chat_id bigint, last_at timestamptz, last_read_id bigint, other_id uuid, title text,
               msg_id bigint, msg_sender uuid, msg_body text, msg_flagged text, msg_at timestamptz,
               msg_image boolean, msg_event text)
language sql stable set search_path = '' as $$
  select c.id, c.last_at, me.last_read_id,
         case when c.pair is not null then
           (select o.user_id from public.club_chat_members o where o.chat_id = c.id and o.user_id <> p_user limit 1) end,
         c.title,
         lm.id, lm.sender_id, lm.body, lm.flagged, lm.created_at, lm.image_id is not null, lm.event
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

-- The red dot: a block drops a one-to-one chat, but not a whole group (the blocked player's messages are left out
-- when reading, and their messages don't count as unread).
create or replace function public.club_unread(p_user uuid)
returns table (chats int, requests int) language sql stable set search_path = '' as $$
  with blocked as (
    select blocked_id as id from public.club_blocks where blocker_id = p_user
    union select blocker_id from public.club_blocks where blocked_id = p_user
  )
  select
    count(*) filter (where me.state = 'active' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.sender_id <> p_user and x.hidden_at is null and not x.held
         and x.id > greatest(me.last_read_id, me.cleared_id)
         and x.sender_id not in (select id from blocked)))::int,
    count(*) filter (where me.state = 'request' and exists (
      select 1 from public.club_messages x
       where x.chat_id = me.chat_id and x.hidden_at is null and not x.held and x.id > me.cleared_id))::int
  from public.club_chat_members me
  join public.club_chats c on c.id = me.chat_id
  where me.user_id = p_user and me.state in ('active', 'request')
    and (c.pair is null or not exists (
      select 1 from public.club_chat_members o
       where o.chat_id = me.chat_id and o.user_id <> p_user and o.user_id in (select id from blocked)));
$$;
revoke execute on function public.club_unread(uuid) from public, anon, authenticated;
