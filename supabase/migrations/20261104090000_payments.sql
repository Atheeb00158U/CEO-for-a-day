-- Payments (spec §4, §4a). Only the server touches these tables (secret key): RLS on, no policies, no grants.

-- A paid seat stays used for good: deleting an account keeps the seat with no owner, and cancelling marks it.
-- A checkout holds a seat for 30 minutes; the first charge clears held_until and the seat is kept.
alter table public.founding_seats alter column user_id drop not null;
alter table public.founding_seats drop constraint founding_seats_user_id_fkey;
alter table public.founding_seats
  add constraint founding_seats_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.founding_seats add column held_until timestamptz;
alter table public.founding_seats add column cancelled_at timestamptz;

-- One membership per player: the latest subscription. status mirrors Razorpay's subscription status.
create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('founding', 'monthly', 'yearly')),
  razorpay_subscription_id text not null unique,
  status text not null,
  current_end timestamptz,
  updated_at timestamptz not null default now()
);

-- Webhooks are retried; each event id is handled once.
create table public.payment_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

-- Lessons and Hot Seats a player finished before the paywall: they stay open (filled once at go-live).
create table public.early_access (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('lesson', 'hotseat')),
  item_id text not null,
  primary key (user_id, kind, item_id)
);

alter table public.memberships enable row level security;
alter table public.payment_events enable row level security;
alter table public.early_access enable row level security;
revoke all on public.memberships, public.payment_events, public.early_access from anon, authenticated;

-- Hold the lowest free seat for this checkout. Returns the seat number, or null when all 500 are taken.
-- A seat is free if it has no row, or only an expired, never-paid hold. One lock serialises every claim.
create or replace function public.claim_founding_seat(p_user uuid, p_subscription text, p_hold_minutes int default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat integer;
begin
  perform pg_advisory_xact_lock(hashtext('founding_seats'));
  -- Free this player's own earlier, unpaid hold so a second checkout doesn't take two seats.
  delete from public.founding_seats where user_id = p_user and held_until is not null;
  -- Expired unpaid holds go back to the pool.
  delete from public.founding_seats where held_until is not null and held_until < now();
  select s into v_seat from generate_series(1, 500) s
    where not exists (select 1 from public.founding_seats f where f.seat_no = s)
    order by s limit 1;
  if v_seat is null then
    return null;
  end if;
  insert into public.founding_seats (seat_no, user_id, razorpay_subscription_id, held_until)
    values (v_seat, p_user, p_subscription, now() + make_interval(mins => p_hold_minutes));
  return v_seat;
end;
$$;
revoke all on function public.claim_founding_seat(uuid, text, int) from public, anon, authenticated;
