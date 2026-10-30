-- CEO For A Day: saved progress, finished runs, Daily Calls, leagues and reminders.
-- Only the server touches these tables (with the secret key). RLS is on with no policies, and the public roles
-- get no grants, so the publishable key in the browser can read or write nothing here.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The GameState (src/lib/game-state.ts) without runs, daily log or league, which live in their own tables.
  state jsonb not null,
  -- Bumped on every write. A write only lands if the version it read is still current (see src/lib/server/db.ts).
  version integer not null default 0,
  -- A guest save was copied in (once per account).
  imported boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- A random id from the phone, so a double tap or a retry finishes a run only once.
  run_key text not null,
  hot_seat_id text not null,
  picks jsonb not null,
  score integer not null,
  xp integer not null,
  ending_id text not null,
  ending_tier text not null,
  notes jsonb not null,
  patterns jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, run_key)
);
create index runs_user_recent on public.runs (user_id, created_at desc);
create index runs_user_hot_seat on public.runs (user_id, hot_seat_id);

create table public.daily_plays (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The IST date. One Daily Call a day, enforced by the key.
  day date not null,
  call_id text not null,
  option_id text not null,
  grade text not null,
  xp integer not null,
  -- The takeaway shown in Notes (a DailyNote).
  note jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.league_members (
  -- The Monday (IST) that starts the week.
  week_id date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  tier smallint not null check (tier between 0 and 5),
  cohort integer not null,
  weekly_xp integer not null default 0,
  primary key (week_id, user_id)
);
create index league_cohort on public.league_members (week_id, cohort);
create index league_tier on public.league_members (week_id, tier, cohort);

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  keys jsonb not null,
  -- The hour (IST, 0–23) the player wants their reminder.
  remind_hour smallint not null default 19 check (remind_hour between 0 and 23),
  created_at timestamptz not null default now()
);
create index push_user on public.push_subscriptions (user_id);
create index push_hour on public.push_subscriptions (remind_hour);

alter table public.profiles enable row level security;
alter table public.runs enable row level security;
alter table public.daily_plays enable row level security;
alter table public.league_members enable row level security;
alter table public.push_subscriptions enable row level security;
revoke all on public.profiles, public.runs, public.daily_plays, public.league_members, public.push_subscriptions from anon, authenticated;

-- Add a player's XP to this week's league, placing them in a cohort first if they have none yet.
-- New players fill the newest cohort of their tier that has room (30), else open a new one. The lock per week and
-- tier means two players joining at once can't overfill a cohort. Returns the player's cohort.
create function public.add_league_xp(p_week date, p_user uuid, p_tier smallint, p_xp integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c integer;
begin
  select cohort into c from public.league_members where week_id = p_week and user_id = p_user;
  if c is null then
    perform pg_advisory_xact_lock(hashtext(p_week::text || ':' || p_tier::text));
    select cohort into c from public.league_members where week_id = p_week and user_id = p_user;
    if c is null then
      select m.cohort into c
        from public.league_members m
        where m.week_id = p_week and m.tier = p_tier
        group by m.cohort
        having count(*) < 30
        order by m.cohort desc
        limit 1;
      if c is null then
        select coalesce(max(m.cohort), 0) + 1 into c from public.league_members m where m.week_id = p_week;
      end if;
      insert into public.league_members (week_id, user_id, tier, cohort) values (p_week, p_user, p_tier, c);
    end if;
  end if;
  update public.league_members set weekly_xp = weekly_xp + greatest(p_xp, 0) where week_id = p_week and user_id = p_user;
  return c;
end;
$$;
revoke execute on function public.add_league_xp(date, uuid, smallint, integer) from public, anon, authenticated;
