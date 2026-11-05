-- Early players keep what they finished before the paywall (spec §4a). Run once, at go-live (4 Nov 2026).
insert into public.early_access (user_id, kind, item_id)
  select distinct user_id, 'lesson', lesson_id from public.lesson_plays where lesson_id not like 'test-%'
  on conflict do nothing;
insert into public.early_access (user_id, kind, item_id)
  select distinct user_id, 'hotseat', hot_seat_id from public.runs
  on conflict do nothing;
