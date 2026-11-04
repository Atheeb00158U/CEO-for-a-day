-- Founding seats: 1,000 instead of 500 (Atheeb, 4 Nov 2026). Widens the seat_no check and the claim's range;
-- claim_founding_seat() is otherwise identical to 20261104100000_seat_rules.sql.
alter table public.founding_seats drop constraint founding_seats_seat_no_check; -- Postgres's name for the inline check; fails loudly if it differs
alter table public.founding_seats add constraint founding_seats_seat_no_check check (seat_no between 1 and 1000);

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
  -- A kept (paid) seat, cancelled or not, means the founding price was used.
  if exists (select 1 from public.founding_seats where user_id = p_user and held_until is null) then
    return null;
  end if;
  -- Free this player's own earlier, unpaid hold so a second checkout doesn't take two seats.
  delete from public.founding_seats where user_id = p_user and held_until is not null;
  -- Expired unpaid holds go back to the pool.
  delete from public.founding_seats where held_until is not null and held_until < now();
  select s into v_seat from generate_series(1, 1000) s
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
