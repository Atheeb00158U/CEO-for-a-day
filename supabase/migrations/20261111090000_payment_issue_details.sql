-- /admin/payments (CLAUDE.md, Payments): each problem keeps the Razorpay payment id when there is one and a short note
-- saying what went wrong, and a person marks it resolved with an optional note of what they did.
alter table public.payment_issues
  add column payment_id text,
  add column note text,
  add column resolved_at timestamptz,
  add column resolution text;
create index payment_issues_open_idx on public.payment_issues (created_at desc) where resolved_at is null;

-- The page counts recent webhook deliveries to show they still arrive.
create index payment_events_received_at_idx on public.payment_events (received_at);
