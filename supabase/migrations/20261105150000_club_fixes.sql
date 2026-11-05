-- Club fixes after review (PR #17). Server only, like every table: RLS on, no policies, no grants.

-- 1. The daily caps, the 30-second gap and "you already posted this" count from this log, not from club_posts, so
--    deleting a post can't reset them. It keeps only a hash of the text, and cascades with the Club profile (leaving
--    starts a 24-hour wait anyway). Rows older than two days are purged daily.
create table public.club_post_log (
  author_id uuid not null references public.club_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('post', 'reply')),
  body_md5 text not null,
  created_at timestamptz not null
);
create index club_post_log_author on public.club_post_log (author_id, created_at desc);
alter table public.club_post_log enable row level security;
revoke all on public.club_post_log from anon, authenticated;

create function public.club_log_post() returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.club_post_log (author_id, kind, body_md5, created_at)
    values (new.author_id, new.kind, md5(new.body), new.created_at);
  return null;
end $$;
create trigger club_posts_log after insert on public.club_posts for each row
  when (new.author_id is not null and new.kind in ('post', 'reply')) execute function public.club_log_post();
revoke execute on function public.club_log_post() from public, anon, authenticated;

-- 2. reply_count counts only replies everyone can see: held and hidden replies don't count, and holding, hiding,
--    approving or restoring one moves the count.
create or replace function public.club_count() returns trigger language plpgsql set search_path = '' as $$
declare
  d integer := 0;
  parent bigint;
begin
  if tg_table_name = 'club_likes' then
    update public.club_posts set like_count = like_count + (case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.post_id, old.post_id);
    return null;
  end if;
  -- club_likes has no parent_id, so this is read only after the likes branch.
  parent := coalesce(new.parent_id, old.parent_id);
  if parent is null then
    return null;
  end if;
  if tg_op <> 'INSERT' then
    if old.held is null and old.hidden_at is null then
      d := d - 1;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.held is null and new.hidden_at is null then
      d := d + 1;
    end if;
  end if;
  if d <> 0 then
    update public.club_posts set reply_count = reply_count + d where id = parent;
  end if;
  return null;
end $$;
create trigger club_replies_visible after update of held, hidden_at on public.club_posts for each row
  execute function public.club_count();
revoke execute on function public.club_count() from public, anon, authenticated;

update public.club_posts p
   set reply_count = (select count(*) from public.club_posts r where r.parent_id = p.id and r.held is null and r.hidden_at is null)
 where p.parent_id is null;

select cron.schedule('club-post-log-purge', '40 21 * * *', $$
  delete from public.club_post_log where created_at < now() - interval '2 days';
$$);
