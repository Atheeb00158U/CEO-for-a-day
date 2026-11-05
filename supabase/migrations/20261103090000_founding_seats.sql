-- Founding members: one row per player who paid for one of the 500 ₹99-a-month seats. The payments webhook adds
-- the row (next plan); the seat number is handed out under a lock so the 501st payment can't get one.
-- Only the server touches it (secret key): RLS on, no policies, no grants to the public roles.
create table public.founding_seats (
  seat_no integer primary key check (seat_no between 1 and 500),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  razorpay_subscription_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.founding_seats enable row level security;
revoke all on public.founding_seats from anon, authenticated;
