# The Club: feed, profiles and chat inside the app

Draft, 4 Nov 2026. Status: not built. Atheeb's decisions are in §1; everything else is proposed here and can change
under "player first".

## 0. In one page

- **Name:** the community is called **the Club** (tab label "Club"). It's short enough for the tab bar at 360 px,
  plain English, and it fits "members post" (§3).
- **Tab bar:** Play · League · **Club** · Notes · Profile. Shop leaves the bar. It still opens from the coins pill
  and the 2× pill in the top bar, as it does today, and `#shop` still works.
- **Who can do what:** guests see a sign-in card. Anyone signed in can read. Joining the Club (a handle, plus
  "I am 18 or older" and "I agree to the Club rules") lets a player like, follow, report, block and answer chats
  that others started. Posting, replying and starting a chat need a paying member (`isMember`) at **Trader** or
  above. The rank lives in one constant, `POST_RANK = 3`.
- **Server only, as today:** every read and write goes through `/api/club/*` with the secret key. All new tables
  have RLS on with no policies and no grants.
- **Live chat:** each signed-in player listens on one private Realtime Broadcast topic, `user:<their id>`. A single
  SELECT policy on `realtime.messages` lets a player listen only to their own topic. There is no INSERT policy, so
  the phone can never send on Realtime. The server sends every live event (new message, seen, typing) through
  Realtime's REST broadcast endpoint after it writes to Postgres.
- **Tables (prefix `club_`):** `club_profiles`, `club_bans`, `club_posts`, `club_likes`, `club_follows`,
  `club_blocks`, `club_reports`, `club_activity` (step 1); `club_chats`, `club_chat_members`, `club_messages` (step 2);
  `club_images` (step 3). Every player-owned row cascades from `club_profiles`, which cascades from `auth.users`. So
  "Leave the Club" and `DELETE /api/account` both remove everything (bans survive leaving; report snapshots are
  kept 180 days by law, §8.7).
- **Three steps, each shipped on its own:** (1) profiles and feed, auto-posts, report/block and the `/admin/club`
  queue; (2) one-to-one live chat with seen, typing and message requests; (3) pictures, then group chats.

## 1. What Atheeb decided (4 Nov 2026)

- A Twitter-like feed and Instagram-like direct messages, inside the app (not WhatsApp or Discord).
- Titles come from the career ladder being built now: `careerOf(state, course) → { rank 1–10, title, stars,
  maxStars }` in `src/lib/career.ts`. The ten titles are Street Seller, Shopkeeper, Trader, Brand Owner, Dealmaker,
  Business Owner, Boss, Tycoon, Founder and CEO, one per unit.
- Anyone signed in can read the feed. Only paying members at Trader (rank 3) or above can post, reply or start a
  chat. Free players reading the feed is a reason to pay.
- The build order is the three steps above.
- Safety and law: 18+ to post or chat (self-declared), the IT Rules 2021 for intermediaries, DPDP Act 2023 consent
  and deletion, rate limits, automatic scam flags, and no phone numbers or emails shown.

## 2. Screens and navigation (mobile, 360 px)

### 2.1 Tab bar

The bar has 344 px for five tabs (`px-2`), so each tab gets about 68 px, or 44 px of text after `px-3`. "COMMUNITY"
at 11 px extra-bold uppercase is about 72 px wide and doesn't fit; "CLUB" is about 34 px. A sixth tab would leave
about 57 px each and crowd the labels, so one tab has to go. Shop goes, because the top bar already opens it twice
(coins pill, 2× pill) and it is the tab players need least often.

- `Tab` becomes `"home" | "league" | "club" | "notes" | "shop" | "profile"`. `TABS` (the bar) lists five.
  `fromHash` checks a separate `ALL_TABS`, so `#shop` keeps working. It also matches the prefix `club/`, so
  `#club/chat/9` selects the Club tab.
- `src/components/LegacyHashRedirect.tsx` has its own tab list: add `club` there.
- **Icon:** `navClub`, two speech bubbles, drawn in the style of the other nav icons in `icons.tsx`.
- **Badge:** a red dot on the Club icon when there are unread chats, new requests or new activity. It comes from
  `GET /api/club/badge`, read when the app opens, when it comes back to the front, and on every live `inbox` event.

### 2.2 Inside the Club tab

The Club tab has its own small screen stack held in `ClubTab` state, mirrored in the hash so the back button and
notification links work: `#club`, `#club/post/<id>`, `#club/@<handle>`, `#club/inbox`, `#club/requests`,
`#club/chat/<id>`, `#club/activity`. Hash parsing stays in `App.tsx` (`#club…` selects the tab, and the rest is passed
to `ClubTab`).

- **Back button:** `go()` switches tabs with `history.replaceState`, so tabs don't stack. Club sub-screens use
  `history.pushState`, so the phone's back button steps back through post, profile and chat to the feed, and `←` in
  the header calls `history.back()`.

**Feed (`#club`)**

```
┌────────────────────────────────────┐
│ Club                 🔔•   ✉•      │  header: Activity bell, Inbox (dots when unread)
│ [ For you ] [ Following ]          │  segmented tiles (.tile)
├────────────────────────────────────┤
│ 🐺 The Wolf · Question of the day  │  pinned card (gold border)
│ "What would you sell first..."     │
│ 💬 24                              │
├────────────────────────────────────┤
│ (R) Ravi K  @ravik · Trader ★★☆ 3h │  post card
│ Started selling chai at the bus... │
│ ♥ 12   💬 4                  ⋯     │  ⋯ = Report / Block / Delete (own)
├────────────────────────────────────┤
│ …                                  │
└────────────────────────────────────┘
                         ( + )          floating 3D button: New post
```

- A post card shows the avatar (a coloured circle with the name's first letter; no photos), the name, @handle, the
  title with stars, the time ("3h"), the text, ♥ count, 💬 count and ⋯.
- **For you:** a ranked list (§5). **Following:** newest first from people you follow.
- The **+** button is always shown. For a player who can't post yet, tapping it opens the matching nudge (§3.2), not
  the composer.
- Guests see one sign-in card ("Sign in to read the Club") over three blurred sample cards, which are fixed text,
  not real posts.

**Composer (full-screen sheet)**

- A textarea (500 characters; the counter shows from 450), "Post" (`.btn3d`, off while empty) and "Cancel".
- The rules line under it: "Be kind. No selling, no money schemes, no phone numbers."
- When the server refuses a post, its error shows in the sheet and the text stays.

**Thread (`#club/post/<id>`)**

- The post on top, then its replies, oldest first, 30 at a time ("Show more").
- A reply bar is pinned at the bottom: a one-line field and "Reply". For a player who can't reply it reads "Members
  at Trader can reply" and opens the nudge.
- Replies are one level deep, as in a WhatsApp group thread, with no replies to replies. That keeps the screen and
  the data simple.

**Hot Seat thread**

- On the debrief (`Debrief.tsx`), signed-in players get a button: "Talk about it · 12 replies". It opens the thread
  for that Hot Seat.
- These threads never appear in the feed and are open only to players who have finished that Hot Seat (a `runs` row
  on the server), so nobody sees answers before playing.

**Profile (`#club/@<handle>`)**

```
┌────────────────────────────────────┐
│ ←                             ⋯    │
│        (R)                         │
│      Ravi K   @ravik               │
│   Trader ★★☆   🔥 12 day streak    │
│  ┌──────────────────────────────┐  │
│  │ What I'm building            │  │
│  │ A tiffin service in Pune...  │  │
│  └──────────────────────────────┘  │
│  48 followers · 30 following       │
│  [ Follow ]   [ Message ]          │
├────────────────────────────────────┤
│ Posts                              │
└────────────────────────────────────┘
```

- Never shows an email, phone number, membership plan or seat.
- "Message" shows only to someone who may start a chat (§3). It opens an existing chat with this player if there is
  one.
- Your own profile has "Edit" instead of Follow and Message. Edit covers name, "What I'm building" and "Share my
  milestones".
- The game's Profile tab gets a "Club profile" row: open it, or "Join the Club". "My reports" and "Leave the Club"
  are there too.

**Join (sheet, first like, follow, post or "Join the Club")**

- Handle (3–15 characters: a–z, 0–9, _), name (filled from the game name), "What I'm building" (optional, 160).
- Two tick boxes, both needed: "I am 18 or older" and "I agree to the Club rules" (a link to the rules sheet).
- A notice (DPDP consent, see §8.3): "Other players will see your name, handle, title, streak, what you're building,
  and what you post. You can leave the Club at any time. Leaving deletes all of it."
- A player who doesn't tick "18 or older" is told "You must be 18 or older to join the Club." They can still read.

**Activity (`#club/activity`)**

- A list of replies to your posts, likes ("Ravi and 3 others liked your post"), new followers, and report outcomes
  ("We looked at your report…").

**Inbox (`#club/inbox`, step 2)**

- A list of chats: avatar, name, the start of the last message, the time and a bold unread dot.
- A "Requests (3)" row on top when there are any. A pencil icon starts a new chat (search by handle among people you
  follow and people who follow you).

**Requests (`#club/requests`, step 2)**

- The same rows for chats from people you don't follow.
- Opening one shows the messages with "Accept" and "Delete" at the bottom and the line "They can't see that you read
  this until you accept."

**Chat (`#club/chat/<id>`, step 2)**

- A header with back, avatar, name and title (tap to open the profile) and ⋯ (Report, Block, Delete chat).
- Bubbles: mine on the right in the brand colour, theirs on the left in grey. The time shows on tap.
- Under my last message: "Sent", then "Seen". When the other player is typing: "Ravi is typing…".
- A message the server flagged as a possible scam shows a yellow line under it: "Be careful. Never send money to
  someone you met here."
- A composer pinned at the bottom: a growing textarea (1,000 characters) and Send. Step 3 adds a picture button.

## 3. The gate

### 3.1 Rules (pure, `src/lib/community.ts`)

```ts
export const POST_RANK = 3; // Trader. The one place the gate rank lives.
export type Can = "ok" | "signin" | "join" | "banned" | "pay" | "rank";
export interface GateInput { signedIn: boolean; joined: boolean; member: boolean; rank: number; bannedUntil: string | null }
/** Checks in this order and returns the first that fails: signin > join > banned > pay > rank > ok. */
export function canPost(p: GateInput, now: Date): Can;
/** Like, follow, block, answer a chat: signin > join > banned > ok. */
export function canInteract(p: GateInput, now: Date): Can;
```

Under-18s never get a Club profile (the join route refuses without `adult: true`), so there is no "adult" state.

| Action                                           | Guest  | Signed in, not joined | Joined (18+), free | Member, below Trader | Member, Trader+ |
| ------------------------------------------------ | ------ | --------------------- | ------------------ | -------------------- | --------------- |
| Read feed, threads, profiles                     | signin | yes                   | yes                | yes                  | yes             |
| Report                                           | signin | yes                   | yes                | yes                  | yes             |
| Like, follow, block                              | signin | join                  | yes                | yes                  | yes             |
| Reply inside a chat someone else started and you accepted | signin | join         | yes                | yes                  | yes             |
| Post, reply to a post, start a chat              | signin | join                  | pay                | rank                 | yes             |

A ban (`club_bans`, §4.1) turns every "yes" except reading and reporting into `banned`.

- **Report without joining:** any signed-in player can report (the IT Rules give everyone a way to complain). That
  is the one action that needs no Club profile. The reporter must be able to see the target (§8.2).
- **How a refusal reaches the phone:** `club.ts` throws `ClubGateError(can)` (a new class next to `GameError`).
  `club()` (§6.1) catches it and answers 403 `{ error: "club", can }`.
- **Not tied to the paywall switch:** `member` is `isMember(await db.getMembership(userId), now)`, read directly
  (not through `accessContext`, which is about the paywall). Posting needs real payment even while `PAYWALL_ON` is
  off.
- **Trusted rank:** the rank comes from the server's own records, never from a phone save. `importGuest` copies a
  guest's `lessons` from the phone (through `update()`), so a crafted save could claim Trader.
  - **The trusted rank:** `trustedCareer(db, userId, state)` in `server/club.ts` returns
    `careerOf({ ...state, lessons: only(state.lessons, ids) }, course())`. Here `ids` is
    `db.finishedLessons(userId)` ∪ `db.earlyAccess(userId)` with the `lesson:` prefix stripped, and `course()` is the
    loader in `server/content.ts`. This is the same trust rule as `allowedLessonIds`.
  - **Dependency:** if `careerOf` also reads something the phone can import (stars, test-outs), filter that the same
    way. The career builder must know this before merging (§11).
  - **The gate computes it live:** `canPost` runs `trustedCareer` on each post, reply and new chat. Posting is
    limited to 6 a minute, so this is cheap.
  - **The column is for display only:** `club_profiles.rank`, `stars` and `max_stars` are written only from
    `trustedCareer` (§4.4), and the gate never reads them.

### 3.2 Nudges (what the + button, the reply bar and Message open)

- `join` → the Join sheet.
- `pay` → the existing `PaywallSheet`, with the line "Members at Trader and above can post." No new paywall.
- `rank` → a sheet: "Reach Trader to post. You are a {title}. Finish Unit {POST_RANK − 1} to get there." with "Play
  now" (goes to Play). One title is earned per unit, so the unit number comes from the constant, not from `careerOf`.
- `banned` → "You can't post until {date}." or, for good, "You can't post in the Club."

### 3.3 Switch

- **The variable:** `COMMUNITY_ON=1` on Railway shows the Club to everyone. Unset, only `PAYWALL_TESTERS` emails see
  it (the same tester list, so testing needs no new variable). For everyone else the Club tab is hidden and
  `/api/club/*` answers 404.
- **The helper:** `clubOn(email?: string): boolean` lives in `membership.ts` next to `paywallFor`, and reuses its
  tester parsing. It also returns false for non-testers while `GRIEVANCE.name` is `"TODO"` (§8.2).
- **How the phone learns it:**
  - **Signed in:** `/api/state` and `/api/import` gain `club: boolean` in `Synced`, beside `paywall`.
  - **Guests:** they see the Club tab only when `NEXT_PUBLIC_COMMUNITY_ON=1` (the same value as a public build
    variable). Their tab shows the sign-in card.

## 4. Data model

All tables are server only, with the same three lines as every migration so far:
`alter table … enable row level security;` and `revoke all on … from anon, authenticated;`, plus no policies. Every
row a player owns cascades from `club_profiles(user_id)`, which cascades from `auth.users(id)`.

### 4.1 Step 1: `supabase/migrations/20261105090000_club.sql`

```sql
-- The Club (docs/superpowers/specs/2026-11-04-community-design.md). Only the server touches these tables
-- (secret key): RLS on, no policies, no grants. Everything a player owns cascades from club_profiles, which
-- cascades from auth.users, so leaving the Club or deleting the account removes it all.

create table public.club_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,15}$'),     -- stored lower case
  name text not null check (char_length(name) between 1 and 20 and lower(name) <> 'you'),
  building text not null default '' check (char_length(building) <= 160),
  -- For display only, written from trustedCareer (§4.4). The gate never reads these.
  rank smallint not null default 1 check (rank between 1 and 10),
  stars smallint not null default 0,
  max_stars smallint not null default 0,
  streak integer not null default 0,
  streak_day date,                               -- the IST day the streak was last extended
  milestones boolean not null default true,      -- "Share my milestones" (rank-up posts)
  adult_at timestamptz not null,                 -- ticked "I am 18 or older"
  rules_at timestamptz not null,                 -- ticked "I agree to the Club rules" (the consent record)
  -- Hidden by a report (e.g. 'fake') or a moderator: the profile shows "This profile isn't available" and its
  -- posts drop out of every list.
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index club_profiles_handle on public.club_profiles (handle);

-- Bans and the rejoin cooldown. Keyed to the account, not the Club profile, so "Leave the Club" and joining again
-- can't clear a ban. reason 'left': leaving starts a 24-hour wait before joining again (the daily caps can't be
-- reset by leaving).
create table public.club_bans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,                    -- 'infinity' for good
  reason text not null check (reason in ('mod', 'left')),
  created_at timestamptz not null default now()
);

create table public.club_posts (
  id bigint generated always as identity primary key,
  -- null: the Wolf (the app's own posts).
  author_id uuid references public.club_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('post', 'reply', 'rank_up', 'hotseat', 'question')),
  -- rank_up: the new rank; hotseat: the Hot Seat id; question: the IST day.
  ref text,
  parent_id bigint references public.club_posts (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  like_count integer not null default 0,
  reply_count integer not null default 0,
  -- Held for review by an automatic flag (§8.4): only the author sees it until a moderator approves it.
  held text,
  -- Removed by a moderator or hidden by reports. Kept 180 days (IT Rules 3(1)(g)) in club_reports, not here.
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'reply') = (parent_id is not null)),
  check (author_id is not null or kind in ('hotseat', 'question'))
);
create index club_posts_feed on public.club_posts (created_at desc)
  where kind in ('post', 'rank_up') and hidden_at is null and held is null;
create index club_posts_author on public.club_posts (author_id, id desc);
create index club_posts_replies on public.club_posts (parent_id, id);
create unique index club_posts_wolf_once on public.club_posts (kind, ref) where kind in ('hotseat', 'question');
create unique index club_posts_rank_once on public.club_posts (author_id, ref) where kind = 'rank_up';

create table public.club_likes (
  post_id bigint not null references public.club_posts (id) on delete cascade,
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index club_likes_user on public.club_likes (user_id, created_at desc);

create table public.club_follows (
  follower_id uuid not null references public.club_profiles (user_id) on delete cascade,
  followee_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index club_follows_followee on public.club_follows (followee_id);

create table public.club_blocks (
  blocker_id uuid not null references public.club_profiles (user_id) on delete cascade,
  blocked_id uuid not null references public.club_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index club_blocks_blocked on public.club_blocks (blocked_id);

-- Reports from players and automatic flags (reporter_id null, reason 'auto_*'). Also the record the IT Rules
-- ask us to keep: `snapshot` holds the reported text, so it survives the author deleting it or their account.
-- Rows are purged 180 days after they are resolved (the daily cron, §8.6).
create table public.club_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users (id) on delete set null,
  target_kind text not null check (target_kind in ('post', 'profile', 'message')),
  target_id text not null,
  -- The author of the reported thing, as plain text (no foreign key): it outlives an account deletion.
  target_user text,
  reason text not null check (reason in ('spam', 'scam', 'hate', 'harass', 'sexual', 'private', 'fake', 'illegal', 'other',
                                         'auto_scam', 'auto_link')),
  note text not null default '' check (char_length(note) <= 300),
  snapshot text not null,
  status text not null default 'open' check (status in ('open', 'removed', 'kept')),
  due_at timestamptz not null,                   -- 2 h for 'private'/'fake', 36 h otherwise (§8.2)
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index club_reports_queue on public.club_reports (status, due_at);
create unique index club_reports_once on public.club_reports (reporter_id, target_kind, target_id) where reporter_id is not null;

-- What the Activity list shows, and what push notifications are built from.
create table public.club_activity (
  id bigint generated always as identity primary key,
  -- Who it is for. Players who report without joining follow their report under "My reports" instead.
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  kind text not null check (kind in ('reply', 'like', 'follow', 'report_done', 'removed')),
  actor_id uuid references public.club_profiles (user_id) on delete cascade,
  post_id bigint references public.club_posts (id) on delete cascade,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index club_activity_user on public.club_activity (user_id, id desc);
create unique index club_activity_like_once on public.club_activity (user_id, actor_id, post_id) where kind = 'like';

-- Like and reply counts, kept by the database so two taps at once can't miscount. Runs as the caller (the
-- server's secret key), so no security definer is needed. It locks the parent row on each like: fine at this
-- size; the hot-row point if one post ever gets thousands of likes a minute.
create function public.club_count() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'club_likes' then
    update public.club_posts set like_count = like_count + (case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.post_id, old.post_id);
  elsif coalesce(new.parent_id, old.parent_id) is not null then
    update public.club_posts set reply_count = reply_count + (case when tg_op = 'INSERT' then 1 else -1 end)
      where id = coalesce(new.parent_id, old.parent_id);
  end if;
  return null;
end $$;
create trigger club_likes_count after insert or delete on public.club_likes for each row execute function public.club_count();
create trigger club_replies_count after insert or delete on public.club_posts for each row execute function public.club_count();
revoke execute on function public.club_count() from public, anon, authenticated;

-- The Following tab: newest root posts by people the viewer follows, in one query (a list of 2,000 ids won't fit
-- in a PostgREST URL). Server only, like add_league_xp. Blocks and hidden profiles are filtered in club.ts.
create function public.club_following(p_viewer uuid, p_before bigint, p_limit int)
returns setof public.club_posts language sql stable set search_path = '' as $$
  select p.* from public.club_posts p
    join public.club_follows f on f.followee_id = p.author_id and f.follower_id = p_viewer
   where p.kind in ('post', 'rank_up') and p.hidden_at is null and p.held is null and p.id < p_before
   order by p.id desc limit p_limit;
$$;
revoke execute on function public.club_following(uuid, bigint, int) from public, anon, authenticated;

alter table public.club_profiles enable row level security;
alter table public.club_bans enable row level security;
alter table public.club_posts enable row level security;
alter table public.club_likes enable row level security;
alter table public.club_follows enable row level security;
alter table public.club_blocks enable row level security;
alter table public.club_reports enable row level security;
alter table public.club_activity enable row level security;
revoke all on public.club_profiles, public.club_bans, public.club_posts, public.club_likes, public.club_follows,
  public.club_blocks, public.club_reports, public.club_activity from anon, authenticated;

-- Daily at 03:00 IST (21:30 UTC): drop old report snapshots and activity (§8.6). Plain SQL, no HTTP call.
select cron.schedule('club-purge', '30 21 * * *', $$
  delete from public.club_reports where status = 'removed' and resolved_at < now() - interval '180 days';
  delete from public.club_reports where status = 'kept' and resolved_at < now() - interval '30 days';
  delete from public.club_activity where created_at < now() - interval '90 days';
$$);
```

Notes:

- **Replies are posts** (`kind = 'reply'`, `parent_id` = the root), so likes, reports and holds work the same way for
  both.
- **The Wolf** is `author_id null`. The phone shows him with the wolf picture (`WolfPicture`, the "sly grin" pose)
  and the name "The Wolf". There's no fake auth user.
- **Hidden replies** still count in `reply_count`. That's acceptable: the count is a hint, not a promise.
- **Deleting a post:** the author's own delete is a hard delete (replies, likes and activity cascade). Moderator
  removal sets `hidden_at`, and the text is kept in `club_reports.snapshot`. Admin actions must tolerate a
  `target_id` that no longer exists (the author deleted it): the report is still resolved.
- **Profile lists and Following show root posts only** (`kind in ('post','rank_up')`), never replies. That keeps
  Hot Seat thread replies, which contain answers, off profiles (§2.2).

### 4.2 Step 2: `supabase/migrations/20261112090000_club_chat.sql`

(The date in the file name is a placeholder for the day it is written; it only has to sort after step 1's.)

```sql
-- One-to-one chats (step 2); groups (step 3) reuse the same tables. Server only, like every table.
create table public.club_chats (
  id bigint generated always as identity primary key,
  -- One-to-one chats: '<smaller uuid>:<larger uuid>', so a pair has one chat. null for groups.
  pair text unique,
  title text check (char_length(title) <= 30),    -- groups only (step 3)
  created_by uuid references public.club_profiles (user_id) on delete set null,
  last_message_id bigint,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index club_chats_created_by on public.club_chats (created_by, created_at);   -- the 20-new-chats-a-day count

create table public.club_chat_members (
  chat_id bigint not null references public.club_chats (id) on delete cascade,
  user_id uuid not null references public.club_profiles (user_id) on delete cascade,
  -- request: from someone this player doesn't follow; declined: they deleted the request (the sender isn't told).
  state text not null check (state in ('active', 'request', 'declined', 'left')),
  last_read_id bigint not null default 0,       -- "Seen"
  cleared_id bigint not null default 0,         -- "Delete chat" hides messages up to here, for this player only
  -- Last time this player fetched or marked this chat seen: no push while they are reading it (§8.8).
  active_at timestamptz,
  primary key (chat_id, user_id)
);
create index club_chat_members_user on public.club_chat_members (user_id, state);

create table public.club_messages (
  id bigint generated always as identity primary key,
  chat_id bigint not null references public.club_chats (id) on delete cascade,
  sender_id uuid not null references public.club_profiles (user_id) on delete cascade,
  client_id text not null,                      -- random from the phone: a retry sends once
  body text not null check (char_length(body) between 1 and 1000),
  flagged text,                                 -- 'auto_scam': the warning line shows under it
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index club_messages_chat on public.club_messages (chat_id, id desc);

-- Save a message and move the chat to the top in one call. The checks (gate, blocks, request limits, autoFlag)
-- happen in club.ts before this. A retry with the same client_id returns the first row. Runs as the caller (the
-- secret key); execute is revoked from the public roles, so the browser's key can't call it.
create function public.club_send(p_chat bigint, p_sender uuid, p_client text, p_body text, p_flagged text)
returns public.club_messages language plpgsql set search_path = '' as $$
declare
  m public.club_messages;
begin
  insert into public.club_messages (chat_id, sender_id, client_id, body, flagged)
    values (p_chat, p_sender, p_client, p_body, p_flagged)
    on conflict (sender_id, client_id) do nothing
    returning * into m;
  if m.id is null then
    select * into m from public.club_messages where sender_id = p_sender and client_id = p_client;
    return m;
  end if;
  update public.club_chats set last_message_id = m.id, last_at = m.created_at where id = p_chat;
  return m;
end $$;
revoke execute on function public.club_send(bigint, uuid, text, text, text) from public, anon, authenticated;

alter table public.club_chats enable row level security;
alter table public.club_chat_members enable row level security;
alter table public.club_messages enable row level security;
revoke all on public.club_chats, public.club_chat_members, public.club_messages from anon, authenticated;

-- Chats nobody is in any more (both accounts deleted) go in the daily purge.
select cron.schedule('club-chat-purge', '45 21 * * *', $$
  delete from public.club_chats c where not exists (select 1 from public.club_chat_members m where m.chat_id = c.id);
$$);

-- Realtime: a signed-in player may listen to their own topic, user:<id>, and nothing else. No INSERT policy, so
-- the browser can never broadcast or use presence; only the server (secret key, REST) sends.
create policy "listen to own topic" on realtime.messages for select to authenticated
  using (realtime.topic() = 'user:' || (select auth.uid())::text and extension = 'broadcast');
```

- **Why the group tables come now:** group chats are decided for step 3, and `club_chat_members` is what one-to-one
  chats need anyway for seen, requests and "delete chat". Using it from the start means step 3 needs no second
  migration of live chat data. Nothing else is built for groups yet.
- **Atomic sending:** `club_send` above. A message to a `declined` receiver is still saved (the sender sees it
  as sent), but `club.ts` sends no live event and no push to the receiver, and their inbox skips declined chats.
- **Deleted accounts:** when the other player deletes their account, their member row and messages go (cascade).
  The server finds a one-to-one chat with a single member left and shows the other side as "Deleted account" with no
  composer. The `pair` string (raw ids) never goes to the phone.
- **Blocks in chats:** member rows don't change. The inbox, the chat read and the send all filter by the block set
  (§8.5), so unblocking brings the chat back.

### 4.3 Step 3: `supabase/migrations/2026112x090000_club_images.sql`

```sql
create table public.club_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.club_profiles (user_id) on delete cascade,
  path text not null unique,                    -- club/<owner_id>/<id>.webp in Storage
  width smallint not null, height smallint not null,
  used_by text,                                 -- 'post:<id>' or 'message:<id>' once attached
  created_at timestamptz not null default now()
);
alter table public.club_posts add column image_id uuid references public.club_images (id) on delete set null;
alter table public.club_messages add column image_id uuid references public.club_images (id) on delete set null;
-- plus the three RLS/revoke lines; a private Storage bucket 'club' with no storage policies (server only).
```

### 4.4 Keeping title and streak on the profile

The feed shows 20 authors at a time. Reading each author's `profiles.state` (which holds every lesson and card
schedule) to run `careerOf` would be slow, so `club_profiles` keeps `rank`, `streak` and `streak_day`.

- **Streak (not security-sensitive):** in `update()` in `game.ts`, the one place every signed-in change is saved.
  After a write lands, `afterSave(db, userId, before, next, now)` from `server/club.ts` compares `streak` and
  `lastActiveDay`. Only when one changed does it run `update club_profiles set streak, streak_day where user_id = …`
  (a no-op for players who haven't joined).
- **Rank, stars and the rank-up post (trusted):** `refreshCareer(db, userId, state)` in `server/club.ts` runs
  `trustedCareer` (§3.1) and writes `rank`, `stars` and `max_stars` when they differ from the row.
  - **When it runs:** after the three actions that change the server's own records: `finishLesson` (lessons and
    test-outs) and `finishRun` in `game.ts`, plus at join and on `GET /api/club/me`.
  - **Never from imports:** it never runs from `importGuest`, so an imported save can't move the displayed title or
    post a fake milestone.
  - **Rank-up post:** when the trusted rank went up, the player has joined and `milestones` is on, it inserts the
    `rank_up` post (idempotent through `club_posts_rank_once`).
- **Errors:** both hooks log a failure and never fail the game action.
- **Shown streak:** `streak_day` is today or yesterday (IST) ? `streak` : 0, the same rule as the top bar.

## 5. Feed ranking and pagination

**For you** (pure `rankForYou(posts, viewer, now)` in `community.ts`, so it can be tested and explained):

1. **Candidates:** root posts (`kind in ('post','rank_up')`) from the last 7 days that are not hidden or held, not
   by a hidden profile, and not from someone you blocked or who blocked you. That's at most 300, newest first, from the `club_posts_feed` index.
2. **Score:** `(likes + 2 × replies + 1) ÷ (hours old + 2)^1.5`, the Hacker News formula: talk counts more than
   likes, and old posts sink.
3. **Boosts:** × 1.5 when you follow the author. Rank-up posts × 0.5, so milestones don't crowd out real posts.
4. **Spread:** no author twice in any five posts in a row; a repeat moves down.
5. **Pinned:** today's Wolf question is pinned on top of page 1 (it isn't ranked).

The explanation in the UI (the "?" next to the tabs): "Posts from the last week. Ones with more replies and likes come
first. New posts get a head start."

**Pagination:**

- **For you:** the cursor is `base64({ asOf, offset })`. Page 1 sets `asOf = now`. Later pages re-rank the same
  candidates (`created_at ≤ asOf`, hours measured from `asOf`) and take `offset … offset + 20`. Like and reply counts
  can change between pages, so a post can shift by a place or two. The phone drops any id it already shows, and the
  small chance of a skip is accepted. When the list runs out: "You're all caught up."
- **Following, profiles, threads and chats:** keyset by id (`before=<id>` going back; `after=<id>` for new messages),
  20 a page (30 for replies, 40 for messages).
- **Following tab:** one call to the `club_following` SQL function (§4.1), a join on `club_follows`, so the number
  of people followed doesn't matter.

## 6. API

### 6.1 Common rules

- **Wrapper:** every route calls `club(request, route, act, max)`, a new function in `http.ts`.
  1. It runs `signedIn(request, route, …, max)`: 429 over the per-minute limit, 401 without a token.
  2. Inside that, it reads the email with `emailFrom(request)` and answers **404** when `clubOn(email)` is false.
  3. It runs `act(db, userId)` and catches `ClubGateError` → 403 `{ error: "club", can }`. `PlayError` and
     `GameError` still map to 400 and 409 in `signedIn`.

  So a test sees 401 without a token, and 404 with a token while the Club is off for that player.
- **Slow work after the reply:** pushes and Realtime broadcasts run in `after()` from `next/server`, so the player's
  request never waits on web-push or the REST call.
- **Body:** JSON only. `club.ts` checks every field: lengths, handle pattern, ids as positive integers.
- **Gate refusals:** a 403 with `{ error: "club", can: Can }` (§3.1), so the phone opens the right nudge.
- **Other refusals:** `GameError` with a player-facing sentence (409), e.g. "Remove the phone number. Use chat
  instead." Errors never reveal whether a blocked player exists: they see "Player not found." or "Message not sent."
- **Who:** players are named by `handle` in requests and replies. User ids never go to the phone, except the
  player's own id, which the phone already has from its session and needs for its Realtime topic.

`PostView`, the one shape for every post the phone sees:

```ts
interface PostView {
  id: number; kind: "post" | "reply" | "rank_up" | "hotseat" | "question";
  body: string; createdAt: string; likes: number; replies: number; liked: boolean;
  mine: boolean; held: boolean;                 // held: only ever true for the author
  author: { handle: string; name: string; title: string; stars: number; maxStars: number; streak: number } | null; // null: the Wolf
  image?: { url: string; width: number; height: number }; // step 3, a signed URL good for an hour
}

/** A player as others see them. Never an id, email, plan or seat. */
interface ProfileView {
  handle: string; name: string; building: string; title: string; rank: number; stars: number; maxStars: number;
  streak: number; followers: number; following: number;
  youFollow: boolean; followsYou: boolean; blocked: boolean;   // blocked: you blocked them
  mine: boolean; milestones?: boolean;                         // milestones: only on your own
}
interface ActivityItem {
  id: number; kind: "reply" | "like" | "follow" | "report_done" | "removed"; createdAt: string; seen: boolean;
  actor: { handle: string; name: string } | null; others?: number;   // "and 3 others" for likes on one post
  postId?: number; text?: string;   // text: the start of a reply (never for Hot Seat threads), or the outcome line
}
interface ReportView { id: number; reason: string; status: "open" | "removed" | "kept"; createdAt: string; resolvedAt?: string }

// Step 2
interface ChatRow {
  id: number; with: { handle: string; name: string; title: string } | null;   // null: "Deleted account"
  state: "active" | "request";       // request: a request to me
  last: { body: string; at: string; mine: boolean } | null;
  unread: boolean;
}
interface MessageView { id: number; chatId: number; mine: boolean; body: string; createdAt: string; flagged: boolean; clientId?: string }
// GET /api/club/chat/:id → { chat: ChatRow & { canSend: boolean; sentRequests?: number }, messages: MessageView[], theirLastRead: number }
// The phone sorts messages by id, since live events can arrive out of order.
```

**Db additions** (in `db.ts`; both `memoryDb()` and `supabaseDb()`). These are the row types and methods `club.ts`
needs. Names can change in review, but nothing beyond these is needed for steps 1 and 2.

```ts
interface ClubProfileRow { userId: string; handle: string; name: string; building: string; rank: number; stars: number;
  maxStars: number; streak: number; streakDay: string | null; milestones: boolean; adultAt: string; rulesAt: string;
  hiddenAt: string | null; createdAt: string }
interface PostRow { id: number; authorId: string | null; kind: PostView["kind"]; ref: string | null; parentId: number | null;
  body: string; likeCount: number; replyCount: number; held: string | null; hiddenAt: string | null; createdAt: string }
interface ReportRow { id: number; reporterId: string | null; targetKind: "post" | "profile" | "message"; targetId: string;
  targetUser: string | null; reason: string; note: string; snapshot: string; status: "open" | "removed" | "kept";
  dueAt: string; resolvedAt: string | null; createdAt: string }
interface ChatMemberRow { chatId: number; userId: string; state: "active" | "request" | "declined" | "left";
  lastReadId: number; clearedId: number; activeAt: string | null }
interface MessageRow { id: number; chatId: number; senderId: string; clientId: string; body: string;
  flagged: string | null; hiddenAt: string | null; createdAt: string }

// Step 1
clubProfile(userId: string): Promise<ClubProfileRow | null>;
clubProfileByHandle(handle: string): Promise<ClubProfileRow | null>;
clubProfiles(userIds: string[]): Promise<ClubProfileRow[]>;              // authors of a page
insertClubProfile(row: ClubProfileRow): Promise<boolean>;               // false: handle taken
updateClubProfile(userId: string, patch: Partial<ClubProfileRow>): Promise<void>;
deleteClubProfile(userId: string): Promise<void>;                        // "Leave the Club"
clubBan(userId: string): Promise<{ until: string; reason: "mod" | "left" } | null>;
setClubBan(userId: string, until: string | null, reason?: "mod" | "left"): Promise<void>;   // null: lift
insertPost(row: Omit<PostRow, "id" | "likeCount" | "replyCount" | "createdAt">): Promise<PostRow | null>; // null: once-only clash
getPost(id: number): Promise<PostRow | null>;
wolfPost(kind: "hotseat" | "question", ref: string): Promise<PostRow | null>;
deletePost(id: number): Promise<void>;
setPostState(id: number, patch: { held?: string | null; hiddenAt?: string | null }): Promise<void>;
feedCandidates(since: string, asOf: string, limit: number): Promise<PostRow[]>;
followingFeed(viewer: string, before: number, limit: number): Promise<PostRow[]>;   // rpc club_following
postsBy(authorId: string, before: number, limit: number): Promise<PostRow[]>;       // roots only
replies(parentId: number, before: number, limit: number): Promise<PostRow[]>;
countPostsSince(authorId: string, kind: "post" | "reply", since: string): Promise<number>;
lastPostBody(authorId: string, since: string, body: string): Promise<boolean>;      // same text in 24 h
setLike(postId: number, userId: string, on: boolean): Promise<void>;
likedOf(userId: string, postIds: number[]): Promise<Set<number>>;
setFollow(follower: string, followee: string, on: boolean): Promise<void>;
followCounts(userId: string): Promise<{ followers: number; following: number }>;
follows(follower: string, followee: string): Promise<boolean>;
countFollowsSince(follower: string, since: string): Promise<number>;
setBlock(blocker: string, blocked: string, on: boolean): Promise<void>;
blockSet(userId: string): Promise<Set<string>>;                         // both directions
insertReport(row: Omit<ReportRow, "id" | "status" | "resolvedAt" | "createdAt">): Promise<boolean>; // false: already reported
openReportsOn(targetKind: string, targetId: string): Promise<ReportRow[]>;
countReportsSince(reporterId: string, since: string, instantOnly?: boolean): Promise<number>;
reportQueue(): Promise<ReportRow[]>;                                    // open, by due_at
resolveReports(targetKind: string, targetId: string, status: "removed" | "kept"): Promise<ReportRow[]>;
myReports(reporterId: string): Promise<ReportRow[]>;
addActivity(row: { userId: string; kind: ActivityItem["kind"]; actorId?: string; postId?: number }): Promise<void>;
activity(userId: string, before: number, limit: number): Promise<(ActivityItem & { actorId: string | null })[]>;
markActivitySeen(userId: string, upTo: number): Promise<void>;
unseenActivity(userId: string): Promise<number>;

// Step 2
chatByPair(pair: string): Promise<{ id: number } | null>;
createChat(pair: string, createdBy: string, members: { userId: string; state: ChatMemberRow["state"] }[]): Promise<number>;
chatMembers(chatId: number): Promise<ChatMemberRow[]>;
setMember(chatId: number, userId: string, patch: Partial<ChatMemberRow>): Promise<void>;
inbox(userId: string, state: "active" | "request", before: string | null, limit: number): Promise<{ chatId: number; lastAt: string; last: MessageRow | null; others: string[] }[]>;
sendMessage(chatId: number, senderId: string, clientId: string, body: string, flagged: string | null): Promise<MessageRow>; // rpc club_send
messages(chatId: number, opts: { before?: number; after?: number; afterCleared: number; limit: number }): Promise<MessageRow[]>;
countChatsSince(userId: string, since: string, requestsOnly: boolean): Promise<number>;
unreadChats(userId: string): Promise<{ chats: number; requests: number }>;
dmNoticesOn(userId: string, day: string): Promise<number>;
```

`deleteUser` in `memoryDb()` also clears every club map (and nulls `reporterId`, keeping snapshots), mirroring the
cascades. `noticesOn` counts only game kinds (§8.8).

### 6.2 Step 1 routes

| Route | Body / query | Gate | Per-minute limit (`max`) | Reply |
| --- | --- | --- | --- | --- |
| `GET /api/club/me` | – | signed in | 60 | `{ profile?, can: { post: Can, interact: Can }, title, rank, badge }` |
| `POST /api/club/join` | `{ handle, name, building, adult: true, rules: true }` | signed in | 5 | `{ profile }`; 409 "That handle is taken." |
| `POST /api/club/me` | `{ name?, building?, milestones? }` | joined | 10 | `{ profile }` |
| `POST /api/club/leave` | – | joined | 3 | `{ left: true }` (deletes the `club_profiles` row; everything cascades) |
| `GET /api/club/feed` | `?tab=foryou\|following&cursor=` | signed in | 60 | `{ question?, posts: PostView[], cursor? }` |
| `GET /api/club/post/:id` | `?before=` | signed in (a Hot Seat thread needs a run) | 60 | `{ post, replies, before? }` |
| `GET /api/club/hotseat/:id` | – | signed in + a finished run | 30 | `{ post, replies, before? }` (creates the Wolf's post on first use) |
| `POST /api/club/post` | `{ body, parentId? }` | `canPost` | 6 | `{ post }` |
| `DELETE /api/club/post/:id` | – | the author | 10 | `{ deleted: true }` |
| `POST /api/club/like` | `{ postId, on }` | `canInteract` | 60 | `{ likes, liked }` |
| `POST /api/club/follow` | `{ handle, on }` | `canInteract` | 30 | `{ following }` |
| `POST /api/club/block` | `{ handle, on }` | `canInteract` | 10 | `{ blocked }` |
| `POST /api/club/report` | `{ kind, id, reason, note? }` | signed in | 10 | `{ reported: true }` |
| `GET /api/club/u/:handle` | `?before=` | signed in | 60 | `{ profile, followers, following, youFollow, posts, before? }` |
| `GET /api/club/activity` | `?before=` | joined | 30 | `{ items, before? }` (marks them seen) |
| `GET /api/club/badge` | – | signed in | 60 | `{ activity: n, chats: n, requests: n }` |
| `GET /api/club/reports` | – | signed in | 10 | My reports and their status |

Reply shapes not given in the table: `/me`, `/join` and `/me` (POST) return `profile: ProfileView`; `/u/:handle`
returns `ProfileView & { posts: PostView[], before? }`; `/activity` returns `ActivityItem[]`; `/reports` returns
`ReportView[]` (§6.1).

**Hot Seat threads:**

- `GET /api/club/hotseat/:id` is a get-or-create: the Wolf's root post is inserted once (on conflict do nothing on
  `club_posts_wolf_once`), then returned. The debrief calls it to show "{n} replies" and to open the thread.
- The debrief needs a new prop on `Player`, `onClub(hotSeatId)`, passed up to `Shell`. `Shell` calls
  `setPlaying(null)` and opens `#club/post/<rootId>`.
- **Gate:** `GET /api/club/post/:id` and `POST /api/club/post` with a `parentId` under a `hotseat` root both need
  `db.countRuns(userId, hotSeatId) > 0`. Without a run, both answer 409 through
  `GameError("Finish this Hot Seat to read what others picked.")`.
- **Spoilers elsewhere:** a reply under a Hot Seat root shows in Activity and pushes as "{name} replied in the
  {company} thread" with no text.

**Reports:**

- **Step 1 kinds:** `post` and `profile`. `message` comes with step 2.
- **Snapshot:** for a post, the body. For a profile, `name | @handle | building`.
- **Hiding a profile:** sets `club_profiles.hidden_at`.

**The Wolf question:**

- `GET /api/club/feed` creates today's question post on the first read of the IST day (insert … on conflict do
  nothing on `club_posts_wolf_once`, with `ref` = the day).
- The file is `content/community/questions.json`, shaped `{ "startDay": "2026-11-20", "questions": string[] }` and
  checked by a small Zod schema in `npm run hotseat:check`.
- The text is `questions[dayDiff(startDay, today) mod questions.length]`. As with `daily.json`, only append to it.

### 6.3 Spam limits (on top of the per-minute `max`)

Daily caps are counted in the database (`count(*) where author_id = … and created_at > IST midnight`). They're the
real guard, because the in-memory `limited()` resets when Railway restarts.

| Action | Limit |
| --- | --- |
| Posts | 10 a day; at least 30 s apart |
| Replies | 50 a day; at least 10 s apart |
| The same text twice within 24 h (post or reply) | refused: "You already posted this." |
| Follows | 200 a day, 2,000 in all |
| Reports | 20 a day |
| New chats (step 2) | 20 a day, of which at most 5 are requests (to people who don't follow you) |
| Messages (step 2) | 30 a minute; 3 in a request before it's accepted |
| Pictures (step 3) | 20 a day |
| Joined less than 24 hours ago | half the post, reply and chat limits |

The limit sentences are in §10.

### 6.4 Step 2 routes

| Route | Body / query | Gate | `max` | Reply |
| --- | --- | --- | --- | --- |
| `GET /api/club/inbox` | `?before=` | joined | 60 | `{ chats: ChatRow[], requests: n }` |
| `GET /api/club/requests` | – | joined | 30 | `{ chats: ChatRow[] }` |
| `POST /api/club/chat` | `{ handle }` | `canPost`; neither side blocked; the other has joined | 10 | `{ chatId }` (existing pair → that chat) |
| `GET /api/club/chat/:id` | `?before=\|after=` | a member of the chat | 120 | `{ chat, messages, theirLastRead }` |
| `POST /api/club/chat/:id/send` | `{ body, clientId }` | active member, or the sender of an unaccepted request (3 max) | 30 | `{ message }` |
| `POST /api/club/chat/:id/seen` | `{ lastId }` | active member | 60 | `{ ok: true }` |
| `POST /api/club/chat/:id/typing` | – | active member | 30 | `{ ok: true }` (no database write; at most one every 3 s per chat) |
| `POST /api/club/chat/:id/accept` | – | the request's receiver | 10 | `{ chat }` |
| `POST /api/club/chat/:id/decline` | – | the request's receiver | 10 | `{ ok: true }` |
| `POST /api/club/chat/:id/clear` | – | member | 10 | `{ ok: true }` (sets `cleared_id`; hides the chat until a new message) |

**Message requests:**

- **When:** if the receiver doesn't follow the sender, their member row starts as `request`.
- **Until it's accepted:** the sender can send 3 messages. The receiver's "seen" isn't sent to the sender, and the
  receiver gets no push beyond the first (`club_request`).
- **Delete:** sets `declined`. The sender's later sends answer `{ message }` as if delivered (the Instagram
  behaviour), but nothing reaches the receiver, and the 5-requests-a-day limit stops re-tries.
- **Replying:** a free (non-member) player who accepted a chat can reply in it. Starting a chat is what costs
  membership.

### 6.5 Step 3 routes

- **`POST /api/club/image`** (multipart, a single file; ≤ 5 MB; JPEG, PNG or WebP by magic bytes, not by the stated
  type):
  - **Processing:** `sharp` rotates by EXIF, resizes to fit 1080 × 1080, encodes WebP at quality 80 and strips all
    metadata (the GPS location goes).
  - **Stored:** the bucket `club` at `<user>/<uuid>.webp`, with a `club_images` row.
  - **Reply:** `{ imageId, width, height }`.
  - **Gate:** `canPost`, or an active chat member for chat pictures.
  - **Dependency:** `sharp` moves from devDependencies to dependencies.
- **Attaching:** `POST /api/club/post` and `/chat/:id/send` take `imageId`. It must be the player's own, unused and
  under an hour old. An image-only message has an empty body, so the message `body` check becomes `0..1000` when
  `image_id` is set.
- **Reads:** signed URLs for an hour (`createSignedUrls` in one call per page).
- **Group chats:**
  - `POST /api/club/group { title, handles[] }` (`canPost`; 2–19 others, each a mutual follow, so no requests for
    groups).
  - `POST /api/club/chat/:id/add` and `/remove` (the creator only), and `/leave`.
  - Live events fan out to every member's topic in one REST call.

## 7. Live chat (Realtime)

### 7.1 The choice: server writes, then a server broadcast to each player's own private topic

```
phone A ──POST /api/club/chat/9/send──▶ Railway (secret key)
                                          │ 1. checks gate, block, limits, autoFlag
                                          │ 2. club_send() in Postgres  (the message is saved)
                                          │ 3. POST /realtime/v1/api/broadcast
                                          ▼    [{topic:"user:B", event:"msg", payload:{chatId, message}, private:true},
                                         Supabase Realtime   {topic:"user:A", event:"msg", …}]   (A's other phones)
                                          │
phone B ◀── private channel "user:B" ─────┘   (SELECT policy: realtime.topic() = 'user:' || auth.uid())
```

- **Writes:** every write still goes through the server, which checks blocks, requests, bans and scam flags before
  anything is saved or sent. Public tables keep RLS with no policies.
- **One policy, no table look-ups:** the only new policy is on `realtime.messages`, and it compares the topic with the
  player's own id. It needs no `security definer` helper that reads chat membership, so it can't leak through one.
- **Nothing can be spoofed:** there is no INSERT policy, so a phone can't send fake messages, fake "seen" or fake
  typing to anyone. Everything on a topic came from the server, so the phone can trust the payload and show the
  message without fetching it again.
- **One channel per player** carries every chat, the inbox, requests and the badge, so the phone opens one
  connection, not one per chat.

**Rejected:**

- **Postgres Changes with SELECT policies on `club_messages`:** this needs the project's first policies on public
  tables, which reverses the "only the server" rule. Every change is also checked against RLS for every subscriber,
  which Supabase documents as the slow path at scale.
- **Broadcast on a shared `chat:<id>` topic with phone-to-phone typing:** this needs an INSERT policy plus a
  membership look-up function in the policy. Any member could also send forged events.

### 7.2 Server side (`src/lib/server/live.ts`)

```ts
export type LiveEvent =
  | { event: "msg"; payload: { chatId: number; message: MessageView } }
  | { event: "seen"; payload: { chatId: number; lastId: number } }
  | { event: "typing"; payload: { chatId: number; handle: string } }
  | { event: "inbox"; payload: { chats: number; requests: number; activity: number } };
export type Live = (to: { userId: string; e: LiveEvent }[]) => Promise<void>;

/** Sends with Realtime's REST broadcast (secret key). Failure is logged, never thrown: the message is already saved. */
export const realtimeLive: Live = async (list) => { /* POST `${URL}/realtime/v1/api/broadcast` { messages: [...] } */ };
```

- **Wiring:** `live` is passed in like `send` in `reminders.ts`, so tests use a fake that records events.
- **Timeout:** the REST call has a 3-second timeout (`AbortSignal.timeout(3000)`, as `db.ts` already uses) and
  runs in `after()` from `next/server`. A broadcast failure only means the other phone hears about the message on its
  next fetch.
- **Spike first (the first task of step 2):** this project uses the new `sb_secret_…` key, not a JWT
  service-role key. Before building anything else, send one request to `/realtime/v1/api/broadcast` with
  `private: true` using that key, and confirm a private channel receives it. If the new key is refused, the fallback
  is calling `realtime.send(payload, event, topic, true)` through a server-only SQL function (revoked like
  `club_send`).
- **Supabase settings:** in the dashboard, Realtime → Settings, turn off **"Allow public access"**, so only private
  channels (checked by the policy) work. It's flipped once in the dashboard, and step 2 doesn't ship until
  `scripts/check-realtime.mjs` (§9.3) proves a public channel fails.

### 7.3 Phone side

- **Where:** `src/lib/live.ts` (client): `supabase().channel("user:" + session.user.id, { config: { private: true } })`
  and `.on("broadcast", { event: "*" }, …)`, after `supabase().realtime.setAuth()`. On `TOKEN_REFRESHED` in
  `onAuthStateChange`, it calls `setAuth()` again, so the private channel doesn't drop after an hour.
- **Who uses it:** the store keeps one listener list. `ClubTab` and the chat screen subscribe to it.
- **Opened only while it helps:** signed in, the Club is on, and the app is in front. Leaving the app closes it
  (`visibilitychange`), and coming back re-opens it and fetches `after=<last id>` for an open chat, plus the badge. That
  keeps Supabase's connection count (the plan's concurrent-connection quota) close to the number of players actually
  looking.
- **Fallback:** while the channel isn't `SUBSCRIBED`, an open chat polls `after=` every 15 s. The API is always the
  truth.
- **Typing:** a keystroke sends `/typing` at most every 3 s. The phone shows "typing…" for 5 s after the last event.
- **Seen:** opening or scrolling to the bottom of a chat sends `/seen` with the last id. The server stores
  `last_read_id`, then broadcasts `seen` to the other member (only for active chats, not requests).

## 8. Safety, law and moderation

### 8.1 What the law says now (checked 4 Nov 2026)

The IT Rules 2021 were amended by the **Information Technology (Intermediary Guidelines and Digital Media Ethics
Code) Amendment Rules, 2026**, notified on 10 Feb 2026 (G.S.R. 120(E)) and in force since 20 Feb 2026. Some
deadlines in the brief changed:

| Duty | Rule | Before Feb 2026 | Now |
| --- | --- | --- | --- |
| Acknowledge a complaint | 3(2)(a)(i) | 24 h | 24 h |
| Resolve a complaint | 3(2)(a)(i) | 15 days | **7 days** |
| Act on a complaint to remove unlawful content (the 3(1)(b) list) | 3(2)(a)(i) proviso | 72 h | **36 h** |
| Remove content showing a person's private parts, nudity, sexual acts, or impersonation, on that person's complaint | 3(2)(b) | 24 h | **2 h** |
| Remove content on a court order or a government notice | 3(1)(d) | 36 h | **3 h** |
| Keep removed content and its records | 3(1)(g) | 180 days | 180 days |

Sources:
- MediaNama, "MeitY shortens takedown timelines" (Feb 2026): 3(1)(d) 36 h→3 h, 3(2)(a) 15→7 days, the nudity and
  impersonation window 24 h→2 h. https://www.medianama.com/2026/02/223-meity-shortens-takedown-timelines-impact-on-users/
- SpicyIP (Aug 2026): the complaint-based window 72 h→36 h, 3(2)(b) 24 h→2 h, 3(1)(d) 36 h→3 h.
  https://spicyip.com/2026/08/old-rule-new-amnesia-a-6-month-old-takedown-rule-rebranded-as-breaking-news.html
- Legal500 / Mondaq summary: the dates (notified 10 Feb, in force 20 Feb 2026).
  https://www.legal500.com/intelligence/india/media-telecoms-it-entertainment/meity-notifies-the-it-amendment-rules-2026
- LiveLaw reports the G.S.R. number. I read these summaries, not the Gazette text itself.

**A lawyer should confirm the table before launch** (§11). We are a plain intermediary, not a "significant social
media intermediary" (that starts at 50 lakh registered users in India), so the extra SSMI duties (a resident
compliance officer, monthly reports, first-originator tracing) don't apply.

**DPDP Act 2023 and the DPDP Rules 2025** (notified Nov 2025, phased in over 18 months):

- **Consent:** a clear notice and consent before personal data is shown to others (the Join sheet).
- **Withdrawal:** withdrawing must be as easy as giving it ("Leave the Club").
- **Erasure:** on request (`DELETE /api/account`).
- **Children:** under-18s need verifiable parental consent, which we don't collect. That's why the Club is 18+ and
  nothing is collected from a player who says they're under 18.
- **Retention allowed by law:** keeping removed content for 180 days under the IT Rules is allowed by DPDP s.8(7)
  ("unless retention is necessary for compliance with any law").

### 8.2 Reports and the grievance officer

- **Report reasons** (one tap, then an optional note):

  | Reason id | Shown to the player |
  | --- | --- |
  | `spam` | Spam or selling |
  | `scam` | Scam or money scheme |
  | `hate` | Hate |
  | `harass` | Bullying or threats |
  | `sexual` | Sexual content |
  | `private` | Private pictures of someone, or nudity |
  | `fake` | Pretending to be me or someone else |
  | `illegal` | Something illegal |
  | `other` | Something else |

- **Acknowledgement (24 h):** given at once on screen ("Thanks. We got your report. We will look at it within 36
  hours."). It's also listed under "My reports", and the status is updated when a moderator decides.
- **Deadlines** (`due_at`): `private` and `fake` get **2 h**. Everything else gets **36 h**, which also meets the
  7-day resolution limit.
- **The reporter must be able to see the target:** a post they can read (with a run for a Hot Seat thread), a
  profile that's visible to them, or a message in a chat they're in. Otherwise the server answers "Player not found."
- **Automatic hiding, so the 2 h duty never waits for a person:**
  - a `private` or `fake` report hides the content at once until a moderator decides;
  - any target with 3 open reports from different players is hidden at once;
  - a moderator's "Keep" restores it.
- **Limits on automatic hiding,** so one person or a few throwaway accounts can't hide what they dislike:
  - Only reports from accounts signed up more than 24 hours ago count toward instant hiding (the auth user's
    `created_at`).
  - Each reporter gets at most 3 instant hides a day; after that, their reports queue without hiding.
  - Other reports go to the queue with the moderator push. The moderator push stays the backstop for the 2 h duty,
    which applies to a complaint by the person concerned.
- **Telling the moderator:** each new report sends a push to the phones of `MODERATOR_USER_IDS` (a new Railway
  variable; Atheeb's user id). It uses `broadcast()` from `reminders.ts` (no guardrails, as for `/admin/notify`), with
  the title "New report: {reason}" and the body "Due in {2 hours | 36 hours}."
- **The grievance officer:**
  - **Where it's shown:** in-app (Club rules sheet and Profile → "Report a problem"), and on `/terms` and `/privacy`.
    The page shows the officer's name, email and postal address, with "We reply within 24 hours and resolve within 7
    days."
  - **The constant:** `GRIEVANCE = { name, email, address }` in `src/lib/legal.ts`, with `"TODO"` placeholders
    until Atheeb gives the details (§11). `clubOn()` returns false for everyone except testers while
    `GRIEVANCE.name` is `"TODO"`, so the Club can't go public without a named officer (unit-tested).
  - **Email complaints:** these arrive in the officer's inbox and are answered from there (an email reply is the
    acknowledgement), within the same 24 h, 36 h and 7-day limits. The queue gets a form for them only if email
    complaints become common.

### 8.3 Club rules (shown at Join, in the ⋯ menu and in `/terms`)

They follow Rule 3(1)(b)'s list, said simply. The final text is in §10.

### 8.4 Automatic flags (`autoFlag(text)` in `community.ts`, pure)

1. **Refused at once** (nothing is saved) in posts, replies, profile fields and all messages:
   - **Phone numbers:** `(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}`, also matched after turning spelled-out digits
     ("nine eight…") and digits split by spaces or dots into plain digits.
   - **Email addresses.**
   - **UPI ids:** `\b[\w.-]{2,}@(?:ok)?(?:upi|ybl|paytm|axl|ibl|sbi|apl|icici|hdfcbank)\b`.

   The reply is "Please remove phone numbers, emails and UPI ids. Keep it in the Club."
2. **Held for review** in posts and replies: only the author sees it, marked "Waiting for a check". A `club_reports`
   row (`auto_link` / `auto_scam`, no reporter, 36 h) goes in the queue.
   - **Links:** `https?://`, `www.`, or `word.tld` for common TLDs. Links never become clickable, even after approval.
   - **Scam words:** a list kept in one constant, `SCAM_PATTERNS`, matched case-insensitively. It includes "invest …
     earn", "guaranteed return(s)", "double your money", "paisa double", "x% (daily|weekly|monthly) return", "profit
     every day", "crypto", "forex", "trading tips", "telegram", "whatsapp me", "join my group", "work from home",
     "loan approved", "send ₹", and "per day income".
3. **In chats** the same scam list doesn't block. The message is delivered with `flagged = 'auto_scam'`, so the
   warning line shows under it, and a `club_reports` row is added. **Request** messages (from people you don't
   follow) with a link or a scam word are held and not delivered until a moderator approves.

`autoFlag` returns `{ refuse?: string; hold?: "auto_link" | "auto_scam"; warn?: true }`. It's tested on a table of
real-looking examples in English and Hinglish, including ones that must pass ("I earned my first ₹500 profit today",
"my shop is on the main road").

### 8.5 Blocks and bans

- **Block** (both ways, silent):
  - **Feeds:** neither sees the other's posts or replies in feeds, threads or profiles. The profile shows "This
    profile isn't available."
  - **Follows:** they are removed both ways, and the blocked player can't follow again.
  - **Chats:** the chat disappears from the blocker's inbox. The blocked player's sends answer "Message not sent."
  - **Silence:** nobody is told.
  - **Where it's checked:** in `club.ts` on every read and write. Each player's block set (both directions) is read
    once per request.
- **Ban** (moderator only): a `club_bans` row with `reason = 'mod'` and `until` set to 7 days, 30 days or
  `infinity`. It's keyed to the account, so leaving and rejoining doesn't clear it. Leaving writes a 24-hour `left`
  row, so the daily caps can't be reset that way either.
  - **While banned:** `canPost` and `canInteract` return `banned`; reading still works.
  - **Clean-up:** "Ban and hide everything" also sets `hidden_at` on all their posts and messages, keeping snapshots
    in a report row.
  - **Lift ban** clears it.
  - **Ban evasion** (a new Google account) is an accepted risk for now.

### 8.6 `/admin/club`

- **Access:** behind the same Basic Auth (`src/proxy.ts` covers `/admin/*`). There's a link in the admin header
  next to "Notifications".
- **Queue:** open reports, soonest `due_at` first, red when late. Each row shows the snapshot, reason, note,
  reporter handle (or "Automatic"), the author's handle with their past removals count, and the time left.
- **Actions:** `POST /admin/club/act`, JSON only (415 otherwise), as in `/admin/notify/send`.
  - **Body:** `{ reportId: number, action: "remove" | "keep" | "ban7" | "ban30" | "ban" | "lift" }`. The action
    works on that report's target and author. Bans also remove the target. "ban" with `hideAll: true` also hides all
    of the author's posts and messages, with one snapshot report row per hidden item.
  - **Reply:** `{ ok: true, resolved: n }`. 404 "No such report." 400 for an unknown action.
  - **Remove:** sets `hidden_at` (post, message or profile). The author gets a `removed` activity item.
  - **Keep:** un-hides and approves a held post.
  - **Ban 7 days, Ban 30 days, Ban for good, Lift ban:** write or delete the `club_bans` row.
  - **Every action** resolves every open report on that target (`resolveReports`), sets `resolved_at`, and gives each
    joined reporter a `report_done` item.
  - **Db calls behind it:** `reportQueue`, `resolveReports`, `setPostState`, `updateClubProfile`, `setClubBan`,
    `addActivity`.
- **Done:** a list for the last 30 days.
- **Clean-up:** the daily `pg_cron` job `club-purge` (§4.1) deletes `removed` report snapshots after 180 days,
  `kept` ones after 30 days (only removed content falls under Rule 3(1)(g)), and activity after 90 days.

### 8.7 Deleting data

- **`DELETE /api/account`:** `db.deleteUser` deletes the auth user, and every `club_*` row cascades. The exceptions:
  - `club_reports.reporter_id` is set to null;
  - `snapshot` and `target_user` are kept until the 180-day purge (the legal hold).
  - `club_posts` by the Wolf stay.
  - `club_bans` goes too (it cascades from `auth.users`): a deleted, banned player who signs up again must pay
    and reach Trader again.
- **Pictures (step 3):** Storage objects don't cascade, so `deleteUser` must first remove `club/<userId>/*` from
  Storage. The same applies to "Leave the Club" and a post or message delete with an image.
- **`memoryDb().deleteUser`** must remove its club maps too. This is tested (§9).
- **Leave the Club:** deletes the `club_profiles` row (everything cascades). The game progress stays.

### 8.8 Notifications

**Social pushes (`club_reply`, `club_follow`, `club_request`):**

| Kind | Title | Body |
| --- | --- | --- |
| `club_reply` | "{name} replied to you" | the start of the reply, 80 characters; under a Hot Seat root: "In the {company} thread" |
| `club_follow` | "{name} followed you" | "See their profile in the Club." |
| `club_request` | "{name} wants to chat" | "Open your message requests in the Club." |

- **How they're sent:** `deliver()` in `reminders.ts` is exported and reused unchanged: quiet hours (10 pm–8 am IST)
  and each kind once a day.
- **The daily cap is separate:** they don't count toward the game's cap of 2, so a busy thread can never crowd out
  the streak reminder. They have their own cap of 3 a day for all `club_*` kinds together.
- **The code change:** `deliver` takes a `cap: { count(userId, day): Promise<number>; max: number }` argument. The
  game passes `noticesOn` and 2. The Club passes `clubNoticesOn` and 3.
- **Counting:** `noticesOn` (both Db implementations) counts only kinds that don't start with `club_` or `dm:`. In
  supabaseDb that's `.not("kind", "like", "club\\_%").not("kind", "like", "dm:%")`; memoryDb filters on the kind part
  of its `id|day|kind` key.

**Likes:** no push, Activity only.

**Chat pushes (`dm:<chatId>:<IST hour>`, sent by a new `deliverDm`):**

- **Why they bend the guardrails:** a chat is a person waiting for an answer, not the app nagging.
- **Rules:**
  - quiet hours still apply;
  - one push per chat per hour (the kind key above, logged in `notifications_sent`);
  - at most 10 chat pushes a day (`dmNoticesOn`);
  - none while the receiver has the chat open (`club_chat_members.active_at` within the last 60 s);
  - sent with `urgency: "high"` and a 1-hour TTL.
- **Text:** title "{name}", body "Sent you a message". The message text is never in the push, because lock screens are
  public.

**Plumbing:**

- `Message` in `reminders.ts` gains optional `url` and `tag`. `webPush` sends them in the JSON payload. `club.ts`
  actions take `send: Send = webPush` as their last argument, so tests use a fake, as `reminders.test.ts` does.
- **Moderator push:** loops `broadcast(db, msg, id)` over each id in `MODERATOR_USER_IDS`.
- **All of these** run in `after()`, never before the reply.

**Service worker (`public/sw.js`, push and click handlers only; still no caching, no new registration):**

- It uses the payload's `tag` (`chat-9`, `club-reply`, …) and `url` (e.g. `/app#club/chat/9`) in place of its fixed
  `tag: "daily-reminder"` and `/app`.
- On click, when an `/app` window is already open, it calls `client.navigate(url)` before `focus()`. App's
  `hashchange` listener then opens the screen. Today it only focuses, which would lose the link.
- **Who gets a push:** only players with reminders on (an existing `push_subscriptions` row). There's no new
  permission prompt; the Club's Activity screen shows the existing `ReminderCard` once, with the line "Turn on
  notifications to hear when someone replies."

## 9. Code layout, tests and how each step is checked

### 9.1 Files

- **`src/lib/community.ts`** (pure, Node-runnable: relative `.ts` imports): `POST_RANK`, limits, `canPost`,
  `canInteract`, `autoFlag`, `SCAM_PATTERNS`, `rankForYou`, `checkHandle`, `CLUB_COPY`.
- **`src/lib/server/club.ts`:** the actions (`join`, `post`, `feed`, `thread`, `like`, `follow`, `block`, `report`,
  `moderate`, `afterSave`, `refreshCareer`, `trustedCareer`, and in step 2 `startChat`, `sendMessage`, `seen`,
  `typing`, `accept`, `decline`). They take `(db, userId, input, now, live?, send?)`, as `membership.ts` takes its
  arguments, and `ClubGateError` lives here.
- **`src/lib/server/live.ts`:** the `Live` type and `realtimeLive` (step 2).
- **`src/lib/server/db.ts`:** the `Db` interface grows by the club methods listed in §6.1, implemented in both
  `memoryDb()` and `supabaseDb()`. That keeps one interface and one `deleteUser`, which is what makes the deletion
  test meaningful.
- **Routes:** `src/app/api/club/**/route.ts`, each a few lines, like `/api/profile`.
- **Components:** `src/components/club/`, holding `ClubTab`, `PostCard`, `Composer`, `Thread`, `ClubProfile`,
  `JoinSheet`, `Activity`, `Inbox`, `Chat`, and `RulesSheet`. They use shadcn `Sheet` and `Button`, restyled as
  `.btn3d` and `.tile`.
- **Admin:** `src/app/admin/club/page.tsx` and `src/app/admin/club/act/route.ts`.
- **Content:** `content/community/questions.json` (30 questions to start, written with the copy tools in the
  memory notes and the basic-English rules).

### 9.2 Step 1 tests (vitest)

- **`community.test.ts`:**
  - `canPost`/`canInteract` across the full table in §3.1, including the ban expiry boundary.
  - `checkHandle` (case, length, reserved names `wolf`, `admin`, `ceoforaday`, `support`).
  - `autoFlag` on the example table (refuse, hold and pass cases; Hinglish; spelled-out numbers).
  - `rankForYou` (score order, the follow boost, the five-in-a-row spread, the 7-day cut, a stable order for the same
    `asOf`).
- **`club.test.ts`** (memoryDb):
  - join needs both ticks and a free handle;
  - a free player gets `pay`, a member below rank 3 gets `rank`, a member at 3 can post;
  - the rank comes from server records (an imported save with fake lessons stays below Trader);
  - the daily caps and the same-text rule;
  - a held post is visible to its author only;
  - a reply bumps `reply_count`;
  - like and unlike are idempotent;
  - follows show in Following;
  - a block hides both ways and removes follows;
  - a Hot Seat thread is refused without a run and created once with one;
  - the Wolf question is created once a day;
  - a `private` report hides at once, and 3 reports hide;
  - "Keep" restores and notifies reporters;
  - "Remove" keeps the snapshot after the author deletes their account;
  - `afterSave` updates the streak only on change; `refreshCareer` runs after `finishLesson`/`finishRun` and posts
    `rank_up` once (not when milestones are off), and `importGuest` with fake lessons changes neither the displayed
    rank nor the gate;
  - a ban survives Leave and rejoin; leaving blocks rejoining for 24 h;
  - instant hiding ignores reporters under 24 h old and stops after 3 a day; a report on something the reporter
    can't see is refused;
  - Hot Seat thread replies never appear on profiles, in Following, or in push text;
  - `club_send` and `club_following` have execute revoked from anon and authenticated (checked in SQL).
- **`account.test.ts`** (extend): after `deleteAccount`, no `club_*` row has the user id; `club_reports` keeps its
  snapshot with `reporter_id` null. "Leave the Club" leaves `profiles` intact.
- **Route test** (like `play-route.test.ts`): `/api/club/*` is 404 with the switch off and 401 without a token; a gate
  refusal is 403 with `can`.
- **`reminders.test.ts`** (extend): `club_reply` respects quiet hours and its own cap of 3, and doesn't use up the
  game's cap of 2 (the streak reminder still goes).
- **Bundle:** `npm run check-bundle` still passes. Nothing in `community.ts` is secret, but `server/club.ts` must not
  be imported by a client component.

**How step 1 is checked:**

1. Apply the migration with the Supabase MCP, run `get_advisors` (no new warnings), and confirm with SQL that
   `anon`/`authenticated` have no privileges on `club_*`.
2. Deploy with `COMMUNITY_ON` unset and test as testers on Railway:
   - two accounts (one member at Trader, one free);
   - post, reply, like, follow, block, report;
   - see the item in `/admin/club` and act on it;
   - receive the moderator push;
   - delete one account and check the tables are empty for it.
3. Take 360 px screenshots of every screen (dark mode, the only mode).
4. Atheeb plays it before `COMMUNITY_ON=1`.

### 9.3 Step 2 tests

- **`club-chat.test.ts`** (memoryDb plus a fake `Live` that records events):
  - one pair makes one chat;
  - a request when the receiver doesn't follow the sender;
  - 3 messages max before it's accepted;
  - a decline is silent;
  - a block gives "Message not sent";
  - a `client_id` retry gives one message;
  - `seen` moves `last_read_id` forward only, and isn't broadcast for requests;
  - `typing` is throttled to one every 3 s and never written;
  - a scam message is delivered with `flagged` and a report;
  - a scam message in a request is held;
  - a free player can reply in an accepted chat but can't start one;
  - the events go to the right topics (the receiver and the sender's own other phones), and never to a blocked
    player.
- **`live.test.ts`:** `realtimeLive` builds the REST body and the headers (stubbed `fetch`) and swallows errors.
- **`reminders.test.ts`:** one `club_dm` per chat per hour, at most 10 a day, not counted in the cap of 2, nothing in
  quiet hours.
- **Realtime policy** (a script, `scripts/check-realtime.mjs`, run by hand against the project, not in CI):
  - signed in as test user A, subscribing to `user:B` fails and `user:A` succeeds;
  - sending on `user:A` from the browser client is refused;
  - with "Allow public access" off, a public channel fails.

**How step 2 is checked:**

0. The secret-key broadcast spike (§7.2) passes, then apply the migration and run `get_advisors` again (the
   first Realtime policy).

1. On Railway with testers, two phones (Android Chrome and an iPhone Home Screen app): send both ways, and watch
   "typing…" and "Seen".
2. Put one phone in flight mode for a minute and check that it catches up when it's back.
3. Kill the app on one phone and check the push arrives and opens the chat.
4. Run the policy script.

### 9.4 Step 3 tests

- **`club-image.test.ts`:**
  - a 6 MB file is refused;
  - a PNG renamed to `.gif` is refused by magic bytes;
  - an EXIF-rotated JPEG comes out upright, at most 1080 px, as WebP, with no EXIF or GPS left (read back with
    `sharp().metadata()`);
  - another player's or a used `imageId` is refused;
  - `deleteUser` removes the Storage folder (a fake Storage client).
- **Group tests:** mutual follows only, 20 members max, the creator removes, leave, and fan-out reaches every member.

**How step 3 is checked:** upload from the iPhone camera (HEIC is converted to JPEG by the browser picker) and from
Android, and confirm the location is gone with an EXIF viewer.

## 10. Copy (all strings; basic English; never "case study")

All of these live in `CLUB_COPY` in `community.ts`, run through slopmonster and fluent-prose, then ChatGPT, before
Atheeb sees them (as the memory notes require).

**Tab and feed**

- Tab: "Club"
- Feed title: "Club"
- Tabs: "For you", "Following"
- Ranking help: "Posts from the last week. Ones with more replies and likes come first. New posts get a head start."
- Wolf name: "The Wolf"
- Question label: "Question of the day"
- Empty Following: "Follow players to see their posts here."
- End of feed: "You're all caught up."
- Guest card: "Sign in to read the Club" / "See what other players are building." / button "Sign in with Google"
- Rank-up post: "{name} became a {title}." For CEO (rank 10): "{name} reached the top: CEO."
- Time: "now", "{n}m", "{n}h", "{n}d", then the date ("3 Nov")

**Composer and gate**

- New post button label (for screen readers): "New post"
- Placeholder: "What did you learn or try today?"
- Reply placeholder: "Write a reply"
- Buttons: "Post", "Reply", "Cancel"
- Rules line: "Be kind. No selling, no money schemes, no phone numbers."
- Counter: "{n} left"
- Gate: pay: "Members at Trader and above can post." (shown on the paywall)
- Gate: rank: "Reach Trader to post." / "You are a {title}. Finish Unit {n} to get there." / "Play now"
- Gate: reply bar: "Members at Trader can reply"
- Gate: banned: "You can't post until {date}." / "You can't post in the Club."
- Held: "Waiting for a check. Only you can see this for now."

**Errors and limits**

- "Please remove phone numbers, emails and UPI ids. Keep it in the Club."
- "You already posted this."
- "Slow down. Try again in a minute."
- "That's enough posts for today. Come back tomorrow."
- "That's enough replies for today. Come back tomorrow."
- "Player not found."
- "Message not sent."
- "That handle is taken."
- "Use 3 to 15 letters, numbers or _."
- "Something went wrong. Try again."

**Join**

- Title: "Join the Club"
- Fields: "Handle", "Name", "What I'm building (optional)"
- Example text: "A tiffin service in Pune"
- Ticks: "I am 18 or older" / "I agree to the Club rules"
- Notice: "Other players will see your name, handle, title, streak, what you're building, and what you post. You can
  leave the Club at any time. Leaving deletes all of it."
- Under 18: "You must be 18 or older to join the Club."
- Button: "Join"

**Profile**

- "What I'm building"
- "{n} followers" / "{n} following" (singular: "1 follower")
- "Follow", "Following", "Message", "Edit"
- "{n} day streak"
- "This profile isn't available."
- Edit: "Share my milestones" / "Post when I reach a new title."
- Game Profile tab rows: "Club profile", "Join the Club", "My reports", "Report a problem", "Leave the Club"
- Leave confirm: "Leave the Club?" / "This deletes your Club profile, posts, likes, follows and chats. Your game
  progress stays." / "Leave" / "Stay"

**Post menu and reports**

- Menu: "Report", "Block {name}", "Unblock {name}", "Delete post"
- Delete confirm: "Delete this post?" / "Delete" / "Keep"
- Block confirm: "Block {name}?" / "You won't see each other in the Club, and they can't message you. They won't be
  told." / "Block" / "Cancel"
- Report title: "What's wrong?"
- Reasons: as in §8.2
- Note: "Tell us more (optional)"
- Send: "Send report"
- Thanks: "Thanks. We got your report. We will look at it within 36 hours."
- My reports: "Waiting", "Removed", "Kept: it follows our rules"
- Outcome (Activity): "We looked at your report. We removed it." / "We looked at your report. It follows our rules, so
  we kept it."
- Removed (to author): "We removed your post because it broke the Club rules: {reason}."

**Activity**

- Title: "Activity"
- Items: "{name} replied to you", "{name} liked your post", "{name} and {n} others liked your post", "{name}
  followed you"
- Empty: "Nothing yet. Post something to get started."
- Notifications nudge: "Turn on notifications to hear when someone replies."

**Hot Seat thread**

- Debrief button: "Talk about it" / "{n} replies"
- Wolf post: "What did you pick, and why?"
- Locked: "Finish this Hot Seat to read what others picked."

**Chat (step 2)**

- Inbox title: "Messages"
- Requests row: "Requests ({n})"
- New chat: "New message" / "Search people you follow"
- Empty inbox: "No messages yet."
- Composer: "Message…" / "Send"
- Status: "Sent", "Seen", "{name} is typing…"
- Request screen: "{name} wants to chat." / "They can't see that you read this until you accept." / "Accept" /
  "Delete"
- Request cap (sender): "Wait for {name} to accept before you send more."
- Scam warning: "Be careful. Never send money to someone you met here."
- Chat menu: "Report", "Block {name}", "Delete chat"
- Delete chat confirm: "Delete this chat?" / "It goes from your messages only." / "Delete" / "Cancel"
- Deleted account: "Deleted account"
- Push: title "{name}", body "Sent you a message"; "{name} wants to chat" / "Open your message requests in the Club."

**Pictures and groups (step 3)**

- "Add a picture", "Remove picture"
- "That picture is too big. Pick one under 5 MB."
- "Use a JPG, PNG or WebP picture."
- Groups: "New group", "Group name", "Add people", "You can add people who follow you back.", "{name} added {name}",
  "{name} left", "Leave group"

**Club rules** (`RulesSheet` and `/terms`)

> **Club rules**
>
> 1. Be kind. No hate, bullying or threats.
> 2. No sexual content, and no private pictures of anyone.
> 3. Don't pretend to be someone else.
> 4. No money schemes, no "invest and earn" offers, no selling.
> 5. No phone numbers, emails or UPI ids. Keep it in the Club.
> 6. Nothing illegal, and nothing that harms children.
> 7. No false news that could hurt people.
> 8. Only post what is yours to share.
>
> Break a rule and we may remove your post or stop you from posting.
> To complain, tap Report, or write to our Grievance Officer: {name}, {email}, {address}.
> We reply within 24 hours and resolve within 7 days.

**Wolf questions** (the first five of 30)

- "What would you sell first if you had ₹5,000?"
- "What is one thing a customer said that changed how you work?"
- "Which shop near you is always busy? Why?"
- "What is the hardest part of asking for money?"
- "What did you learn this week that you will use?"

## 11. Risks and open questions

**Questions for Atheeb**

Answered 4 Nov 2026: (1) the grievance officer is Atheeb himself, email atheeb@gridd.ai. CEO For A Day is a product of GRIDD AI, which sits under AstrapiMoney; the registered company name, Atheeb's full legal name and the postal address are still to come; (2) yes, free players can reply inside a chat they accepted (my player-first call); (3) yes, Club replaces Shop in the bar (my call). (4) stays open.

1. **Grievance officer:** whose name, email and postal address go on the Club rules, `/terms` and `/privacy`? The
   law needs a real, named person. Step 1 can't switch on (`COMMUNITY_ON=1`) without it.
2. **Free players reading:** the design lets every signed-in player read the feed (your call), but only members at
   Trader can post. Confirm free players should also be able to **reply inside a chat** that a member started and
   they accepted. Without that, a free player can only read their messages.
3. **The tab:** "Club" replaces Shop in the bar; Shop stays one tap away on the coins pill. OK?
4. **A lawyer's look** at §8.1 before launch. The February 2026 amendment cut the deadlines your brief listed: 7
   days to resolve (not 15), 36 h for complaint-based removal, 2 h for intimate pictures and impersonation, and 3 h
   for government or court orders.

**Risks**

- **Empty feed.** Trader plus payment is a small group at first. The Wolf question, rank-up posts and Hot Seat
  threads fill it, but the first week will still look quiet. Seed it with Atheeb's own posts (he can join as a
  member) and invite the early testers.
- **The rank gate depends on `career.ts`.** `careerOf` must be computable from server records (§3.1). If its rank
  uses anything only the phone knows, the gate can be cheated with an imported save. The career builder needs to know
  this before it merges.
- **Moderation load and the 2 h rule.** Automatic hiding covers the 2 h duty, but someone has to read the queue every
  day (36 h). If Atheeb is away, the Club needs a second moderator or a pause switch (`COMMUNITY_ON` unset hides it).
- **Realtime connections.** Supabase plans include a set number of concurrent Realtime connections. Opening the
  channel only while the app is in front keeps it near the number of active players. Check the plan before a launch
  push.
- **The 18+ tick is self-declared.** It's what the brief asks for and what most apps do, but it's not verification.
- **Ban evasion** through a new Google account. It's limited by needing to pay again (₹99) and reach Trader again.
- **Scam filters** will miss things and sometimes stop honest posts. The held queue and "Keep" handle false alarms;
  the list lives in one constant so it's quick to tune.
- **In-memory rate limits reset on deploy** (Railway runs one instance). The daily caps in the database are the real
  guard.
- **The Db interface grows a lot** (about 25 methods). That's acceptable for one interface with both
  implementations, but it's the point to split it into a `ClubDb` if it grows again.
