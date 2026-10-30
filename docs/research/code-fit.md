# Learning layer: how it fits the code

Scope: units → lessons → screens (explain cards + exercises), flashcards with spaced repetition in Notes, lessons and Hot Seats on one path on Home. XP, streak, quests and leagues continue. All paths are relative to the repo root. Line numbers are from the tree at commit `bad5fe6`.

---

## 1. How the relevant parts work today

**State shape and rules (`src/lib/game-state.ts`)**
- `GameState` (38–64) is one flat object: xp, coins, streak, inventory, `league`, `runs`, `best: Record<hotSeatId, score>`, `quests {day, decisions, great, xp, claimed}`, `badges`, `traits`, `settings`, `daily`, `dailyLog`, `onboarding`. `fresh()` (106–132) builds a new one.
- `rollover()` (138–169) resets quests on a new IST day, spends freezes for missed days, and settles the league week (guests only; the server passes `settleLeague: false`).
- `touchStreak()` (172–179) counts today as active. Every rewarded action calls it, directly or through `applyDecision()` (239–242).
- XP rules: `ECONOMY` (7–14). `finishXp()` (245–246) pays `completionXp + score` the first time and only `completionXp` on a replay, doubled by a booster. `applyFinish()` (257–283) pays XP, coins, badges, traits and `best`, and adds the XP to `league.weeklyXp` and `quests.xp`. `applyDaily()` (188–221) is idempotent per IST day.
- Quests: `questsFor()` (229–236) has three fixed quests that read `s.quests`. `applyClaim()` (308–312).
- All of these are pure, so the phone (guests) and the server (signed-in players) run the same code.

**Server referee (`src/lib/server/game.ts`)**
- `strip()` (29–35) drops `runs`, `dailyLog` and `league` before saving. Everything else in `GameState` is stored as one JSON document in `profiles.state` (`supabase/migrations/20261030090000_init.sql:5–14`, with a `version` column).
- `load()` (121–136) merges `{...fresh(), ...p.state}`. The merge is shallow, so nested objects from old saves don't get new defaults. Runs, the Daily log and the league row come from their own tables.
- `update()` (142–156) runs a pure `change(state)` under an optimistic version check and retries 3 times.
- `finishRun()` (166–211) replays the picks with `play()`, inserts the `runs` row first (its unique `run_key` makes a retry a no-op), then `update(applyFinish)`, then `db.addLeagueXp`.
- `lockDaily()` (215–240) follows the same pattern, with `daily_plays (user_id, day)` as the key.
- `importGuest()` (286–328) caps every number (`IMPORT_CAPS` 278) and only filters through known keys.

**Store (`src/lib/store.tsx`)**
- Guests: localStorage `cfad.v1` (28). `readGuest()` (71–83) merges `settings` one level down.
- Signed-in players: every action posts to an API route and takes the reply through `sync()` (94–98), which ignores replies with an older version.
- `recordDecision()` (176–182) is guest-only, because the server counts decisions at the finish. `finishRun()` (184–207) and `playDaily` (230) handle the rest.

**Content and the no-answers rule**
- `src/lib/server/content.ts` reads `content/` on the server only, with a production cache (15–20).
- `canServe()` (12) hides drafts outside dev. `catalog()` (100–107) returns card fields only. `questionOf()` and `answerOf()` (124–147) split a Daily Call into its question and its reveal.
- `/app` is a server component (`src/app/app/page.tsx:8–10`) that passes `catalog()` and `trial()` down. That's the only content in the page.
- `/api/play` (`src/app/api/play/route.ts`) is stateless. The phone sends all picks so far, the server replays them (`src/lib/play.ts`) and returns the next screens, plus the reveal for the last pick.
- `/api/daily/lock` (`route.ts:9–29`): guests get the answer, rate-limited by IP. Signed-in players get the answer plus `synced`.
- `scripts/check-bundle.mjs:20–31` fails CI if any option's `why`/`takeaway` text over 20 characters appears in `.next/static` or the prerendered `/` and `/app`. CI order (`.github/workflows/ci.yml`): lint, format, test, `hotseat:check`, build, check-bundle.

**Catalog and Home**
- `src/content/catalog.ts` holds `TRIAL_ID` (8), `FOCUS` lists (11–16), and `homeOrder()` (19–26). That order is the trial first, then the focus picks, then the seeded `playerOrder`.
- `src/components/HomeTab.tsx` renders, in order: the streak header (33–41), the Daily Call card (44–63), a hero for the "current" Hot Seat (the first unplayed one, line 25, shown at 66–83), the booster card, a 3-column grid "Your hot seats" (102–148), and Daily quests (151–177).

**Notes tab**
- `src/components/NotesTab.tsx` (88 lines) is read-only. It shows the latest run per Hot Seat with patterns and per-call takeaways (13, 31–66), then the Daily log (67–85). It has no study tools.

**Reusable UI**
- `.btn3d` and its colours (`globals.css:62–123`), `.tile` with `aria-pressed`/`aria-checked` states (130–158), and the `.sheet` bottom-sheet animation (191).
- `ui.tsx`: `Bar`, `Card`, `Pill`, `MediaView`, `Caption`.
- `Player.tsx` exports `DecisionView` (404) and `RevealView` (498). `DailyPlayer` already reuses both (`DailyPlayer.tsx:72–107`). The `VERDICT` colours/titles are at `Player.tsx:18–22`, and the verdict `.sheet` at 546.
- `sfx.ts` has `select/lock/great/ok/bad/next/coins/badge/up/down`.

---

## 2. Content format: `content/course/`

```
content/course/
  course.json            units in path order (only append or insert; ids never change)
  lessons/<lesson-id>.json
  media/                 copied by sync-media like hotseats/*/media (names unique across ALL content)
  factcheck.md           stamped like Hot Seats, for lessons that cite real companies
```

**`course.json`**
```json
{
  "units": [
    {
      "id": "u1-cash",
      "title": "Cash is oxygen",
      "goal": "Know why a profitable shop can still die",
      "lessons": ["cash-vs-profit", "runway", "burn-rate"],
      "practice": [{ "hotSeatId": "kingfisher-airlines" }],
      "draft": false
    }
  ]
}
```
`practice` puts Hot Seats on the path after the unit's lessons. A Hot Seat sits in at most one unit.

**`lessons/<id>.json`**
```json
{
  "id": "cash-vs-profit",
  "title": "Profit is not cash",
  "principle": "A sale on credit is profit today but cash later.",
  "minutes": 4,
  "draft": true,
  "screens": [
    { "kind": "explain", "id": "e1", "text": "…", "media": "img:cs_shop" },
    { "kind": "choice", "id": "q1", "prompt": "…", "options": [{"id":"a","label":"…"}, …],
      "answer": "b", "why": "…", "wrong": { "a": "…" } },
    { "kind": "gap", "id": "q2", "text": "You sold it, but the ___ is still with the buyer.",
      "bank": ["cash", "profit", "stock"], "answer": ["cash"], "why": "…" },
    { "kind": "order", "id": "q3", "prompt": "Put these in order", "steps": ["…","…","…","…"], "why": "…" },
    { "kind": "scenario", "id": "q4", "year": "2008", "setup": "…", "question": "…", "advisor": "…",
      "options": [{ "id": "a", "label": "…", "grade": "great", "why": "…" },
                  { "id": "b", "label": "…", "grade": "bad", "why": "…", "better": "…" }, …],
      "from": { "hotSeatId": "kingfisher-airlines", "nodeId": "d2" } }
  ],
  "summary": ["One line per key idea, shown in Notes"],
  "cards": [{ "id": "cvp-1", "front": "What is runway?", "back": "Months you can pay bills with the cash you have." }],
  "sources": [{ "label": "…", "url": "…" }]
}
```
- `order` stores the steps in the right order. The server shuffles them, seeded by lesson id + screen id.
- `gap` uses a word bank (tap tiles, never typing). That suits basic English and cheap keyboards.
- `scenario` has the same option shape as a Daily Call option minus `outcome`/`takeaway`, so `RevealView` can render it.

**Links back from Hot Seats (later step).** Add an optional `principle?: string` (lesson id) to the decision node in `hotseat-types.ts` and `hotseat-schema.ts`. The `Eq` check there forces both to change together. The verdict sheet can then show "Learn this: Profit is not cash". The unit's `practice` covers the forward link.

**Zod sketch (`src/lib/course-schema.ts`, mirroring `src/lib/course-types.ts` with the same `Eq` trick as `hotseat-schema.ts:118–124`):**
```ts
import { z } from "zod";
import type { Course, Lesson } from "./course-types";
const Id = z.string().regex(/^[a-z0-9-]{1,60}$/);
const Media = z.union([z.templateLiteral(["img:", z.string()]), z.templateLiteral(["vid:", z.string()])]);
const Opt = z.strictObject({ id: z.string(), label: z.string() });
const Screen = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("explain"), id: z.string(), title: z.string().optional(), text: z.string(), media: Media.optional() }),
  z.strictObject({ kind: z.literal("choice"), id: z.string(), prompt: z.string(), media: Media.optional(),
    options: z.array(Opt).min(2).max(4), answer: z.string(), why: z.string(),
    wrong: z.record(z.string(), z.string()).optional() }),
  z.strictObject({ kind: z.literal("gap"), id: z.string(), text: z.string(), bank: z.array(z.string()).min(2).max(6),
    answer: z.array(z.string()).min(1), why: z.string() }),
  z.strictObject({ kind: z.literal("order"), id: z.string(), prompt: z.string(), steps: z.array(z.string()).min(3).max(6), why: z.string() }),
  z.strictObject({ kind: z.literal("scenario"), id: z.string(), year: z.string().optional(), media: Media.optional(),
    setup: z.string(), question: z.string(), advisor: z.string().optional(),
    options: z.array(Opt.extend({ grade: z.enum(["great", "ok", "bad"]), why: z.string(), better: z.string().optional() })).length(3),
    from: z.strictObject({ hotSeatId: Id, nodeId: z.string() }).optional() }),
]);
export const LessonSchema = z.strictObject({ id: Id, title: z.string(), principle: z.string(), minutes: z.number().int().min(1).max(10),
  draft: z.boolean().optional(), screens: z.array(Screen).min(3), summary: z.array(z.string()).min(1),
  cards: z.array(z.strictObject({ id: z.string(), front: z.string(), back: z.string() })),
  sources: z.array(z.strictObject({ label: z.string(), url: z.string().url() })).optional() });
export const CourseSchema = z.strictObject({ units: z.array(z.strictObject({ id: Id, title: z.string(), goal: z.string(),
  lessons: z.array(Id).min(1), practice: z.array(z.strictObject({ hotSeatId: Id })), draft: z.boolean().optional() })) });
```

**Checking (`src/lib/course-check.ts`, Node-run, so relative `.ts` imports and `import type`).** Call it from `scripts/hotseat.mjs check`, so the existing `npm run hotseat:check` and CI cover it with no CI change. It also gets its own `npm run course:check` and `course:new -- <lesson-id>`. Checks:
- Errors:
  - The schema passes.
  - Every lesson in `course.json` exists, and every lesson file is listed (or is a draft).
  - Ids are unique: lessons, screens within a lesson, and cards across the whole course (card ids are SRS keys, so they must never be reused).
  - A `choice` answer is one of its options, and `wrong` keys are options.
  - A `gap` has as many `___` as answers, and every answer is in the bank.
  - `order` steps are unique.
  - A `scenario` has at least one `great`, and every ok/bad option has `better`.
  - `practice.hotSeatId` and `from.hotSeatId/nodeId` exist, and no Hot Seat sits in two units.
  - Media exists. Extend `mediaCollisions` (called in `hotseat.mjs`) to include `content/course`.
  - The first screen is `explain`, and there are at least 3 exercises.
- Warnings:
  - Word counts: explain ≤ 55 words, prompt ≤ 25, option ≤ 12. These keep the copy in basic English.
  - The correct `choice` answer sits in the same position in more than 60% of a lesson's questions.
  - A lesson with `sources` has no factcheck stamp. Make this an error once published, like Hot Seats.
- Also add a Vitest over every lesson, like `src/content/hotseats.test.ts`, which `npm run validate` already runs.

---

## 3. Lesson play under the no-answers rule

**Proposed flow, a mirror of `/api/play`:**
- `GET`-free bootstrap: `/app` also passes `courseOutline()` from `server/content.ts`. The outline holds unit and lesson ids, titles, minutes, exercise count and practice ids, with no screens.
- `POST /api/lesson` `{ lessonId, answers: { screenId, value: string | string[] }[] }`. The server (`src/lib/lesson-play.ts`, pure and Node-run, like `play.ts`) walks the screens with the answers given and returns:
  - `screens`: the explain screens up to and including the next exercise, with answer-free fields only. For a `choice` that's its options; for a `gap` its bank; for an `order` the shuffled steps; for a `scenario` labels only.
  - `reveal` for the last answer: `{ correct, why, wrong?, better?, grade? }`.
  - `result` once every exercise is right, or the retry pass is done. It holds accuracy, `firstTry` count and the summary.
- Duolingo-style "fix your mistakes" stays deterministic. Exercises answered wrong are queued once more at the end, so the replay is a pure function of the answers and the endpoint stays stateless like `/api/play`. There are no hearts in lessons; board trust stays a Hot Seat mechanic.
- One round trip per **Check** tap. The reply carries the next screen too, so **Continue** is instant. Hot Seats already pay one round trip per decision, so this is the same 4G budget.
- `POST /api/lesson/finish` `{ playKey, lessonId, answers }`, signed-in only, through `signedIn(request, "lesson", …, 20)`. It replays, then `finishLesson()` in `server/game.ts` runs exactly like `finishRun()`: insert a `lesson_plays` row by key, then `update(applyLesson)`, then `addLeagueXp`. Guests apply `applyLesson` locally from the `result`, as they do with `applyFinish` today (`store.tsx:193–206`).
- Drafts: `canServe()` gates lessons too.

**Do lesson answers really need hiding?**

*For hiding:*
1. **League integrity.** Lesson XP feeds real leagues. If answers sit in the bundle, a script can post a perfect run. With server grading, accuracy can't be forged; only completion can be scripted, and that's the same exposure Hot Seat replays already have.
2. **Scenarios reuse Hot Seat decisions** (`from`). A bundled lesson would leak a Hot Seat's verdicts and break the CI promise.
3. **Paywall (Phase 4).** Lessons are product. If any lesson JSON ships in the bundle, the whole course can be scraped. Content must be served per lesson by the server anyway, so the answer-free split costs little extra.
4. **One rule is simpler to keep than two.** `check-bundle` stays a single invariant.

*Against hiding:*
1. **Latency on every tap.** Duolingo-feel depends on instant feedback, and a 300–800 ms wait on a cheap Android over 4G is noticeable. Lessons have more checks than Hot Seats (about 6–10 per lesson against 4–6 calls per Hot Seat).
2. **Low stakes.** "Profit vs cash" isn't secret, and anyone can find the answer.
3. **Completion can be scripted anyway.** XP for finishing a lesson can't be protected by hiding answers.
4. **More moving parts:** a server walker, a shuffle seed, the retry queue.

**Recommendation: hide them (server-graded, stateless replay).**
- The deciding points are the scenario overlap with Hot Seats, the paywall, and keeping one CI rule.
- Soften the latency cost:
  - Press the Check button down at once with the `lock` sfx, like `DecisionView busy`.
  - Return the next screen with each verdict.
  - Make explain screens local after the first fetch: they carry no answers, so they can arrive in a batch.
- Keep XP mostly about completion so scripting gains little: a flat amount, a small accuracy bonus only the first time, and a daily cap on replay XP.
- Fallback if field tests show Check over about 700 ms at p75: serve the whole lesson **per request (never in the bundle)** with answers, grade on the phone, and have `/api/lesson/finish` pay completion only (no accuracy bonus). Scenario screens that use `from` stay server-graded either way.
- Extend `check-bundle.mjs`: add every lesson exercise's `why`, `wrong` text and scenario `why` to `secrets`. Card `back`s aren't secrets; they're study material.

---

## 4. GameState, server, migrations, import

**Additions to `GameState`:**
```ts
/** Best first-try accuracy (0–100) per finished lesson. Like `best` for Hot Seats; presence = done. */
lessons: Record<string, number>;
/** Spaced repetition per card id: [box 0–6, due day "YYYY-MM-DD"]. Compact: the profile is one JSON row rewritten on every action. */
cards: Record<string, [number, string]>;
quests: { day; decisions; great; xp; claimed; lessons: number; reviews: number };  // two new counters
```
- **Review scheduling: Leitner boxes, not SM-2.**
  - The player taps one of two buttons, "Forgot" or "Knew it". Two buttons are clearer in basic English than Again/Hard/Good/Easy.
  - Intervals by box: `[0, 1, 3, 7, 16, 35, 90]` days.
  - "Knew it" moves the card up one box, and its due date becomes today plus that box's interval. "Forgot" drops it to box 1, due tomorrow.
  - A card enters box 0, due today, when its lesson is first finished.
  - All of this is a pure `applyReview(s, reviews[], now)` in `game-state.ts`.
  - The state stays small: 300 cards × about 30 bytes is about 9 KB.
  - FSRS can replace this later. The `[box, due]` tuple would become an object; do that in one migration step in `load()`.
- **Pure rules in `game-state.ts`:**
  - `ECONOMY.lesson = { xp: 10, firstTryBonus: 5, replayXp: 5, coins: 5, reviewXp: 1, reviewXpCap: 10 }`.
  - `applyLesson(s, {lessonId, accuracy}, now)`: `touchStreak`, then XP (`10 + round(accuracy/100 × 5)` the first time, `5` on a replay, ×2 while boosted), then coins, `lessons[id] = max`, unlocking that lesson's cards into box 0, `quests.lessons += 1`, `quests.xp += xp`, and the league XP.
  - `applyReview`: counts toward the streak (one session is a day's activity), `quests.reviews += n`, and `min(n, cap - alreadyToday)` XP.
  - Open question: should a review session alone keep the streak? Duolingo says yes. If yes, cap it at one session of 5+ cards.
- **Quests:** `questsFor()` gains "Finish a lesson" and "Review 10 cards". Pick 3 of 5 per day, seeded by `seed + day`, so the rule stays pure and shared. `applyClaim` is unchanged.
- **Rollover / old saves.**
  - `load()` merges shallowly (`game.ts:126`), so an old `quests` object would lack `lessons`/`reviews`. Either deep-merge `quests` in both `load()` and `readGuest()` (`store.tsx:79`), or read with `?? 0` in `questsFor`.
  - Deep-merging is cleaner. Add a test with an old-shape save.
  - The `rollover()` reset must include the new counters.

**Server (`server/game.ts`, `server/content.ts`, routes):**
- `content.ts`:
  - `courseOutline()` (answer-free, cached).
  - `servableLesson(id)`, with an id regex and `canServe`.
  - `cardsFor(lessonIds)`.
- `game.ts`:
  - `finishLesson(db, userId, lesson, {playKey, answers})`: replay with `lesson-play.ts`, insert `lesson_plays` by key (a duplicate returns `load()` with `gained: 0`), `update(applyLesson)`, `addLeagueXp`, `notifyOvertaken`.
  - `reviewCards(db, userId, reviews)` is **batched**: one call at the end of a review session, so there's one version-checked write and not one per card. Rules:
    - Keep at most 50 reviews.
    - Card ids must belong to finished lessons (from `s.lessons` plus `cardsFor`).
    - A card already reviewed today is ignored (its due date is in the future).
    - No new table is needed: abuse is bounded by the cap, and the state carries the due dates.
- Routes:
  - `POST /api/lesson`: guest and signed-in, IP-limited like `/api/play`.
  - `POST /api/lesson/finish`.
  - `POST /api/cards/review`.
  - `GET /api/cards?lessons=a,b`. Signed-in players derive the list from state; guests send their finished lesson ids, which is fine because card backs aren't secret.
- `updateProfile` stays as it is. The phone never sets `lessons` or `cards` directly.

**Migration (one):**
```sql
create table public.lesson_plays (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  play_key text not null,
  lesson_id text not null,
  answers jsonb not null,
  accuracy integer not null,
  xp integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, play_key)
);
create index lesson_plays_user on public.lesson_plays (user_id, lesson_id);
alter table public.lesson_plays enable row level security;
revoke all on public.lesson_plays from anon, authenticated;
```
- Apply it with the Supabase MCP, then run `get_advisors`, as CLAUDE.md says.
- Add `insertLessonPlay` to the `Db` interface, plus the `memoryDb` and `supabaseDb` implementations (`server/db.ts:55+`, `92+`, `256+`).
- Add the table to the account-deletion loop that `memoryDb` mirrors (`db.ts:189`).
- `lessons` and `cards` live in `profiles.state`, so no column changes are needed. `strip()` keeps them.

**Guest import (`importGuest`):**
- `lessons`: keep only ids that pass the regex and exist in `courseOutline()`, cap each value at 100, and keep at most 200 entries.
- `cards`: keep only ids that exist and whose lesson is in the imported `lessons`. Box is clamped 0–6. The due date must match `YYYY-MM-DD` and be at most 90 days ahead.
- Lessons give XP, but imported XP is already capped by `IMPORT_CAPS.xp` and never counts toward a league week. No new cap is needed beyond `lessons: 200`.
- Merge rule: take the max per lesson, and keep the server's card entry if it exists.

---

## 5. UI changes

**Home path (`HomeTab.tsx`):**
- Replace the hero (66–83) and the 3-column grid (102–148) with a **single vertical path** of unit sections.
- Each section has a header band (unit title and goal), then lesson nodes, then that unit's practice Hot Seat nodes.
- Node styling reuses the existing round `node-ring` style (117–133). Lesson nodes are smaller and show a book icon or a progress ring. Hot Seat nodes keep the emblem.
- Node states: done (check, best accuracy), current (bobbing, a ring, and a "Start" btn3d popover), locked.
- Gating: lessons unlock in order within a unit, and a unit's Hot Seats unlock when its lessons are done.
- Hot Seats that aren't in any unit go in a "More Hot Seats" grid below the path, keeping `homeOrder()` (seeded, focus-first). Nothing that's playable today gets locked.
- **Decisions for Atheeb:**
  1. Does the trial (Kingfisher) stay first, as `catalog.ts:8` does now, or does Unit 1 come first, with the trial as its practice?
  2. Should `FOCUS` reorder units instead of Hot Seats?
  3. Hard locks, or a "jump ahead" test?
- The Daily Call card, booster and quests stay as they are.

**Lesson player (`src/components/LessonPlayer.tsx`, new; same shell as `DailyPlayer`):**
- Top row: a close `Icon`, plus a progress `Bar` (ui.tsx) of exercises done.
- `explain`: `MediaView` and text. Narration is optional, and lines without audio already fall back to the browser voice. `Caption` can come later.
- `choice`: `.tile` buttons with `aria-checked`, the same markup as `DecisionView` options (`Player.tsx:466`), and a **Check** `btn3d green` that is disabled until something is selected.
- `gap`: the sentence with blank slots; bank words are small `.tile` chips that move into the slots on tap.
- `order`: tap the tiles in order and they fill numbered slots; tap again to undo. Avoid drag, which is hard on cheap phones.
- `scenario`: reuse `DecisionView` and `RevealView` as they are. The reveal needs `outcome`; either add an optional short outcome to scenario options or pass `why` as the outcome. Prefer adding `outcome`.
- Feedback: a `LessonVerdict` bottom `.sheet`, green (correct) or red (wrong), with `why`/`wrong[pick]`, a Continue btn3d, and `great`/`bad` sfx. Pull the `VERDICT` styles out of `Player.tsx:18–22` into a shared module so both use them.
- End screen: XP (+ booster) via `Pill`s, accuracy, "Cards added: 4", then **Practise in a Hot Seat** (when the unit's practice is unlocked) or Continue.

**Notes tab restructure (`NotesTab.tsx`):**
- A segmented control at the top, using the `.tile` pressed style: **Cards · Lessons · Hot Seats · Daily**.
- **Cards** (the default once any exist):
  - A "N cards due today" card with a `btn3d` **Review**, which opens `ReviewSession`. The session flips a card on tap, then shows Forgot (red) and Knew it (green), and makes one `/api/cards/review` call at the end.
  - Below: the deck by unit, with box counts.
- **Lessons:** each finished lesson's `summary` lines and its principle, with a "Play again" link.
- **Hot Seats** and **Daily:** today's content (13–66 and 67–85), moved unchanged.
- Later study tools:
  - A "takeaway deck" built on the phone from `runs[].notes` and `dailyLog`. No new content is needed, but the ids need care, because notes have no node id. Add `nodeId` to `RunRecord.notes` first.
  - A quick 5-question quiz from due cards.
  - Search across notes.

**Tabs:** `App.tsx` `TABS` stays as it is. Rename "Notes" to "Study" only if Atheeb wants. Render the lesson player as a full-screen overlay, like `playing` / `playingDaily` in `Shell`.

---

## 6. Build order and rough size

1. **Types, schema and check** (M, about 1 day): `course-types.ts`, `course-schema.ts` with `Eq`, `course-check.ts`, wired into `hotseat.mjs check`, plus a Vitest. Also `content-files.ts` readers, `sync-media` for `content/course/media`, and one sample unit with 2 lessons to drive the work.
2. **Pure lesson replay** (M, about 1 day): `lesson-play.ts`, with grading for the 5 kinds, the seeded order shuffle, the retry queue and the result. Unit tests like `play.test.ts`.
3. **Server content and `/api/lesson`** (S, about half a day): `courseOutline`, `servableLesson`, the route, and the outline passed from `/app/page.tsx`. Extend `check-bundle.mjs` with lesson secrets.
4. **GameState rules** (M, about 1 day): `lessons`, `cards`, quest counters, deep merge for old saves, `applyLesson`, `applyReview`, a quest pool, and `ECONOMY.lesson`. Tests in `game-state.test.ts`.
5. **Server referee and migration** (M, about 1 day): `lesson_plays`, the `Db` methods (memory and Supabase), `finishLesson`, `reviewCards`, the two routes, `importGuest` caps, and tests in `server/game.test.ts`. Apply the migration and run the advisors.
6. **Store wiring** (S, about half a day): `finishLesson` and `reviewCards` in `store.tsx`, guest-local or server-synced, following `finishRun`.
7. **Lesson player UI** (L, 2–3 days): 5 exercise views, the verdict sheet extracted from Player, the end screen and sfx. Test at 360×800 and on a slow network.
8. **Home path** (M–L, 1.5–2 days): the unit path, gating, the "More Hot Seats" grid, and the onboarding hand-off. This needs Atheeb's three decisions first.
9. **Notes restructure and review session** (M, 1–1.5 days).
10. **Hot Seat → lesson links** (S, about half a day): optional `principle` on decision nodes (type, schema, check), and a "Learn this" link on the verdict sheet.
11. **Content and copy** (ongoing): AUTHORING.md gains a lesson recipe (brief → draft → check → copy pass with slopmonster and fluent-prose → factcheck for real-company claims). Update `CLAUDE.md` and `BUILD-PLAN.md` with the new routes and rules.

Steps 1–6 are about 5 days with no UI and can ship dark. Steps 7–9 make it visible. Total is about 10–12 working days, plus content.

**Risks:**
- **Tap latency** on 4G with server-graded checks. Measure after step 7; there's a fallback in section 3.
- **Shallow merge of old saves** (`game.ts:126`, `store.tsx:79`). New nested fields come back as `undefined` and crash `questsFor`. Test an old-shape save on both sides.
- **The profile JSON grows** with `cards`. It's rewritten on every action under the version check, and many reviews mean more write conflicts. Batch reviews (one write a session). Move cards to a table if decks pass about 1,000 cards.
- **League farming** through replay XP, the same as Hot Seats today. Add a daily cap on replay and review XP.
- **Card id churn.** Renaming a card id silently resets its schedule. The check should keep ids stable (compare against git HEAD as a warning).
- **Home ordering conflict.** The seeded per-player Hot Seat order (a product rule in CLAUDE.md) clashes with a fixed course path. Atheeb has to choose which Hot Seats sit in units, and whether the "first two gentle" rule still applies.
- **Paywall interplay (Phase 4):** which units are free. The lesson endpoints should take an entitlement check from day one, even if it's a stub.
- **Copy load.** Lessons are lots of short text in basic English, and every line needs the copy tools. Lessons will need narration and translation later (Phase 8 per-language files, sharing ids).
- **Mistakes in bundle checks.** `check-bundle` only matches strings over 20 characters, so short choice answers (option labels) would slip through. The answer **id** is never sent before Check, which is the real protection. Add a unit test that the `/api/lesson` response for an unanswered exercise contains no `answer`, `why` or `grade`.
