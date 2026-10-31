-- Finished lessons and test-out quizzes. The play key (random, from the phone) makes a retry or double tap pay once,
-- like runs.run_key. Best scores and flashcards live in profiles.state; this table is the record and the key.
-- Only the server touches it (secret key): RLS on, no policies, no grants to the public roles.
create table public.lesson_plays (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  play_key text not null,
  -- A lesson id, or "test-<module id>" for a test-out quiz.
  lesson_id text not null,
  answers jsonb not null,
  accuracy integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, play_key)
);

alter table public.lesson_plays enable row level security;
revoke all on public.lesson_plays from anon, authenticated;
