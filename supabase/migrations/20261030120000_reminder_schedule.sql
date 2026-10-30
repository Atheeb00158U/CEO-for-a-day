-- Streak reminders: at the start of every IST hour (minute 30 UTC, since IST is UTC+5:30), ask the app to send that
-- hour's reminders. The app checks the secret; it lives in Vault as `cron_secret` (added by hand in the SQL editor,
-- never committed): select vault.create_secret('<CRON_SECRET from Railway>', 'cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions; -- its functions live in the `net` schema

select cron.schedule(
  'streak-reminders',
  '30 * * * *',
  $$
  select net.http_post(
    url := 'https://ceoforaday.in/api/cron/remind',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
