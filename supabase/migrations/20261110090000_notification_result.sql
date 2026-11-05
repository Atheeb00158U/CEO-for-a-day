-- What happened when a notification was sent: one entry per phone, "sent", "gone" (the phone unsubscribed) or
-- "failed" (the push service said no twice), comma-separated. So a missing notification can be traced later.
alter table public.notifications_sent add column result text;
