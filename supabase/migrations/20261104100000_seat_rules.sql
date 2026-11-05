-- Cancelling gives up the founding price for good (spec §3): a player who ever kept a seat gets no second one.
-- Same as claim_founding_seat() in 20261104090000_payments.sql, plus that check right after the lock.
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
