-- The Club (docs/superpowers/specs/2026-11-04-community-design.md), step 1: profiles, the feed, likes, follows,
-- blocks, reports and activity. Only the server touches these tables (secret key): RLS on, no policies, no grants.
-- Everything a player owns cascades from club_profiles, which cascades from auth.users, so leaving the Club or
-- deleting the account removes it all.

create table public.club_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,15}$'),     -- stored lower case
  name text not null check (char_length(name) between 1 and 20 and lower(name) <> 'you'),
  building text not null default '' check (char_length(building) <= 160),
  -- For display only, written from the server's own records (refreshCareer). The gate never reads these.
  rank smallint not null default 1 check (rank between 1 and 10),
  stars smallint not null default 0,
  max_stars smallint not null default 0,
  streak integer not null default 0,
  streak_day date,                               -- the IST day the streak was last extended
  milestones boolean not null default true,      -- "Share my milestones" (rank-up posts)
  adult_at timestamptz not null,                 -- ticked "I am 18 or older"
  rules_at timestamptz not null,                 -- ticked "I agree to the Club rules" (the consent record)
  -- Hidden by a report (e.g. 'fake') or a moderator: the profile shows "This profile isn't available" and its
  -- posts drop out of every list.
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index club_profiles_handle on public.club_profiles (handle);

-- Bans and the rejoin wait. Keyed to the account, not the Club profile, so "Leave the Club" and joining again can't
-- clear a ban. reason 'left': leaving starts a 24-hour wait before joining again (the daily caps can't be reset by
-- leaving).
create table public.club_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,                    -- 'infinity' for good
  reason text not null check (reason in ('mod', 'left')),
  created_at timestamptz not null default now()
);

create table public.club_posts (
  id bigint generated always as identity primary key,
  -- null: the Wolf (the app's own posts).
  author_id uuid references public.club_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('post', 'reply', 'rank_up', 'hotseat', 'question')),
  -- rank_up: the new rank; hotseat: the Hot Seat id; question: the IST day.
  ref text,
  parent_id bigint references public.club_posts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  like_count integer not null default 0,
  reply_count integer not null default 0,
  -- Held for review by an automatic flag: only the author sees it until a moderator approves it.
  held text,
  -- Removed by a moderator or hidden by reports. The text is kept 180 days in club_reports (IT Rules 3(1)(g)).
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'reply') = (parent_id is not null)),
  check (author_id is not null or kind in ('hotseat', 'question'))
);
create index club_posts_feed on public.club_posts (created_at desc)
  where kind in ('post', 'rank_up') and hidden_at is null and held is null;
create index club_posts_author on public.club_posts (author_id, id desc);
create index club_posts_replies on public.club_posts (parent_id, id);
create unique index club_posts_wolf_once on public.club_posts (kind, ref) where kind in ('hotseat', 'question');
create unique index club_posts_rank_once on public.club_posts (author_id, ref) where kind = 'rank_up';

create table public.club_likes (
  post_id bigint not null references public.club_posts (id) on delete cascade,
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index club_likes_user on public.club_likes (user_id, created_at desc);

create table public.club_follows (
  follower_id uuid not null references public.club_profiles (user_id) on delete cascade,
  followee_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index club_follows_followee on public.club_follows (followee_id);

create table public.club_blocks (
  blocker_id uuid not null references public.club_profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index club_blocks_blocked on public.club_blocks (blocked_id);

-- Reports from players and automatic flags (reporter_id null, reason 'auto_*'). Also the record the IT Rules ask us
-- to keep: `snapshot` holds the reported text, so it survives the author deleting it or their account. Rows are
-- purged after they are resolved (the daily cron below).
create table public.club_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users (id) on delete set null,
  target_kind text not null check (target_kind in ('post', 'profile', 'message')),
  target_id text not null,
  -- The author of the reported thing, as plain text (no foreign key): it outlives an account deletion.
  target_user text,
  reason text not null check (reason in ('spam', 'scam', 'hate', 'harass', 'sexual', 'private', 'fake', 'illegal', 'other',
                                         'auto_scam', 'auto_link')),
  note text not null default '' check (char_length(note) <= 300),
  snapshot text not null,
  status text not null default 'open' check (status in ('open', 'removed', 'kept')),
  due_at timestamptz not null,                   -- 2 h for 'private'/'fake', 36 h otherwise
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index club_reports_queue on public.club_reports (status, due_at);
create index club_reports_target on public.club_reports (target_kind, target_id);
create index club_reports_reporter on public.club_reports (reporter_id, created_at desc);
create unique index club_reports_once on public.club_reports (reporter_id, target_kind, target_id) where reporter_id is not null;

-- What the Activity list shows.
create table public.club_activity (
  id bigint generated always as identity primary key,
  -- Who it is for. Players who report without joining follow their report under "My reports" instead.
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('reply', 'like', 'follow', 'report_done', 'removed')),
  actor_id uuid references public.club_profiles (user_id) on delete cascade,
  post_id bigint references public.club_posts (id) on delete cascade,
  -- report_done: 'removed' or 'kept' (the outcome); removed: the report reason, for "broke the Club rules: …".
  detail text check (char_length(detail) <= 20),
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index club_activity_user on public.club_activity (user_id, id desc);
create unique index club_activity_like_once on public.club_activity (user_id, actor_id, post_id) where kind = 'like';

-- Like and reply counts, kept by the database so two taps at once can't miscount. Runs as the caller (the server's
-- secret key), so no security definer is needed. It locks the parent row on each like: fine at this size.
create function public.club_count() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'club_likes' then
    update public.club_posts set like_count = like_count + (case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.post_id, old.post_id);
  elsif coalesce(new.parent_id, old.parent_id) is not null then
    update public.club_posts set reply_count = reply_count + (case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.parent_id, old.parent_id);
  end if;
  return null;
end $$;
create trigger club_likes_count after insert or delete on public.club_likes for each row execute function public.club_count();
create trigger club_replies_count after insert or delete on public.club_posts for each row execute function public.club_count();
revoke execute on function public.club_count() from public, anon, authenticated;

-- The Following tab: newest root posts by people the viewer follows, in one query (a list of 2,000 ids won't fit in a
-- PostgREST URL). Server only, like add_league_xp. Blocks and hidden profiles are filtered in club.ts.
create function public.club_following(p_viewer uuid, p_before bigint, p_limit int)
returns setof public.club_posts language sql stable set search_path = '' as $$
  select p.* from public.club_posts p
    join public.club_follows f on f.followee_id = p.author_id and f.follower_id = p_viewer
   where p.kind in ('post', 'rank_up') and p.hidden_at is null and p.held is null and p.id < p_before
   order by p.id desc limit p_limit;
$$;
revoke execute on function public.club_following(uuid, bigint, int) from public, anon, authenticated;

alter table public.club_profiles enable row level security;
alter table public.club_bans enable row level security;
alter table public.club_posts enable row level security;
alter table public.club_likes enable row level security;
alter table public.club_follows enable row level security;
alter table public.club_blocks enable row level security;
alter table public.club_reports enable row level security;
alter table public.club_activity enable row level security;
revoke all on public.club_profiles, public.club_bans, public.club_posts, public.club_likes, public.club_follows,
  public.club_blocks, public.club_reports, public.club_activity from anon, authenticated;

-- Daily at 03:00 IST (21:30 UTC): drop old report snapshots and activity. Plain SQL, no HTTP call. Removed content
-- is kept 180 days (IT Rules 3(1)(g)); kept reports 30 days; activity 90 days.
select cron.schedule('club-purge', '30 21 * * *', $$
  delete from public.club_reports where status = 'removed' and resolved_at < now() - interval '180 days';
  delete from public.club_reports where status = 'kept' and resolved_at < now() - interval '30 days';
  delete from public.club_activity where created_at < now() - interval '90 days';
$$);
