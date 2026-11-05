-- Payment problems a person must sort out by hand (spec §4): a paid founding checkout with no seat left
-- (FOUNDING_OVERFLOW) and money taken on a subscription we don't hold, e.g. a replaced checkout paid anyway
-- (UNKNOWN_SUBSCRIPTION_CHARGED). Only the server writes here (secret key): RLS on, no policies, no grants.
create table public.payment_issues (
  id bigint generated always as identity primary key,
  kind text not null,
  subscription_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index payment_issues_user_id_idx on public.payment_issues (user_id);

alter table public.payment_issues enable row level security;
revoke all on public.payment_issues from anon, authenticated;
