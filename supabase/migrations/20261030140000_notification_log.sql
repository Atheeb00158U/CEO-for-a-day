-- Every automatic notification sent, so a player gets each kind at most once a day and no more than two a day in
-- all (see src/lib/server/reminders.ts). Server only, like every other table.
create table public.notifications_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  -- The IST date it was sent.
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);
create index notifications_user_day on public.notifications_sent (user_id, day);
alter table public.notifications_sent enable row level security;
revoke all on public.notifications_sent from anon, authenticated;
