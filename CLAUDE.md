# CEO For A Day: notes for Claude Code

Mobile-first Next.js app (App Router, React 19, Tailwind v4, TypeScript). Dark mode only. The design language is Duolingo and Airlearn: chunky 3D buttons (`.btn3d`), answer tiles (`.tile`), pill counters, a bottom tab bar, and the Nunito font. Copy their design elements, not their layouts or illustrations.

UI components: use shadcn/ui, restyled to this look. Add gluestack-ui only if we build a native app later.

## Product decisions from the owner (Atheeb)
- **Name:** "CEO For A Day". A single case study is called a **Hot Seat**; never write "case study" in the UI.
- **Audience:** wannabe and struggling entrepreneurs in India.
  - English first. Hindi, Tamil, Bengali and more come close to launch; don't build i18n yet.
  - Copy must work for people with basic English: short words, short sentences.
- **Learn, then practise (30 Oct 2026):** the app is becoming an interactive course: short lessons teach one rule each, then Hot Seats test those rules; flashcards and study tools live in Notes. The plan and its decisions are in `docs/LEARNING-PLAN.md` (research in `docs/research/`). Lessons unlock in order with a "test out"; a new player starts with Unit 1's first lesson; Unit 1 may use one clearly labelled composite (made-up) story. A module can have several Hot Seats to clear. Curriculum is planned first, then Hot Seats; a video version of one Hot Seat is an experiment (story not chosen yet; not Kodak).
- **Ordering:** Hot Seats aren't tagged easy or hard for players. Each player gets a seeded random order, but the first two are always gentle (hidden `complexity` ≤ 2).
- **Trees are fully pre-mapped.** There are no live LLM calls during play. Personalised takeaways are assembled from authored lines; richer per-path debriefs can be pre-generated at build time.
- **Choice feedback:** every choice shows what happened (as story), why it was good or bad, and, for ok/bad choices, what would have worked. Alternate-history outcomes are labelled as estimates.
- **Board trust (3 hearts):** losing them all before the last decision ends the run (the "fired" ending). Players can fix mistakes until it's too late.
- **Media sources:** no more AI-generated images. Find every image in four archives: movingimagearchive.com (public domain, the main source), film-grab.com (copyrighted film stills: small credited inserts only, flagged to Atheeb), frameset.app (reference only unless licensed) and fashiongonerogue.com (reference only unless a credited insert). Rules and the per-Hot Seat `media.md` are in `docs/AUTHORING.md` step 5. Where no archive fits (most Indian stories), images are generated with ChatGPT in the browser on Atheeb's sign-in: period-correct, no logos, no real person's likeness. Images already in the app were made with Z-Image Turbo and stay until replaced. Narration uses OmniVoice (the engine in Atheeb's VoiceStudio app): the narrator is Atheeb's cloned voice and the advisor a designed voice (female, middle-aged, Indian accent), both cloned from `scripts/voices/`.
- **Pricing plan (not built):** ₹599/week, ₹1,499/month, or ₹999/month billed yearly.

## Routes
- `/` is the website, `/app` the game, `/admin` the Hot Seat list and path trees.
- `/admin` is behind HTTP Basic Auth (`src/proxy.ts`) against `ADMIN_PASSWORD`. Without it, it's open only in `npm run dev`. The Hot Seat JSON still ships inside `/app`, so the password hides the view, not the answers.

## Commands
- `npm run dev` (restart it after adding media: `sync-media` copies `content/hotseats/*/media` into `public/media` on start)
- `npm run hotseat:check`: run this after any Hot Seat edit (CI runs it too)
- `npm run hotseat:new -- <id>`, `npm run hotseat:tree -- <id>`
- `npm run media -- <id> <files…>`: prepare images and clips
- `npm run narrate`: regenerate narration after text edits (needs VoiceStudio on Atheeb's Mac; about 3 hours for every line)
- `npm run debriefs -- <id>`: offline Claude drafts of per-path debriefs; a person sets `reviewed: true` before the app shows one
- `python scripts/make-sfx.py`: rebuild the sound effects in `public/sfx/` (needs earshot + ffmpeg; sources, licences and mix levels in `docs/SOUNDS.md`)

## Writing stories
Follow `docs/AUTHORING.md` for every Hot Seat and Daily Call: research brief → draft → check → fresh-context fact-check (stamped `factcheck.md`) → media from the archives (`media.md`) → Atheeb's review. A published story needs a `factcheck.md` stamped for its exact file, with no open claims. Missing narration is only a warning (the app falls back to the browser's voice).

## Daily Call
- **Suspended (30 Oct 2026, Atheeb):** no new Daily Calls; the focus is modules and Hot Seats. The course map (`docs/CURRICULUM.md`) doesn't rely on them.
- One decision, about a minute, shown above the Hot Seat on Home. Content is `content/daily/daily.json`; its order is the schedule (day N after `startDay` plays call N). Only append.
- It uses the India date (IST), like the streak, quests and league weeks (`today()` in `game-state.ts`). The answer is saved at "Lock it in" (`applyDaily`): one play a day, no Hindsight, 15/10/5 XP.

## Hot Seat content
- Each Hot Seat is `content/hotseats/<id>/hotseat.json` (+ `media/`), checked by the Zod schema in `src/lib/hotseat-schema.ts`, which must match `hotseat-types.ts` exactly (a type check fails the build otherwise).
- `draft: true` shows a Hot Seat as "Coming soon" on the map (dev and production alike; `/admin` still shows it in full) and turns missing media and audio into warnings. Outside `npm run dev` the server won't play a draft.
- **No answers on the phone.** Hot Seat and Daily Call JSON is read only on the server (`src/lib/server/content.ts`). The phone sends its picks to `/api/play`, which replays them (`src/lib/play.ts`) and returns the next screens plus the verdict on the last pick. `/api/daily` and `/api/daily/lock` do the same for the Daily Call. Never import `server/content.ts` or `content-files.ts` from client code; `npm run check-bundle` (in CI, after the build) fails if any option's `why` or `takeaway` text reaches the browser. Narration ids are worked out on the phone (`lineId` in `voice.ts`), so `voice-lines.json` is never bundled.
- Railway runs plain `next start` (not `output: "standalone"`), so `content/` is on disk at runtime.
- Media names must be unique across Hot Seats (they share `public/media/`).
- Files that Node runs directly (`engine.ts`, `hotseat-schema.ts`, `hotseat-check.ts`, `voice-lines.ts`, `content-files.ts`) use `import type` for types and relative `.ts` imports, no `@/` paths.

## UI
- shadcn/ui components live in `src/components/shadcn/` (alias set in `components.json`). Their token names are mapped onto our palette in `globals.css`; shadcn's own `muted` is never defined, because ours is the grey text colour.

## The build plan
Follow `docs/BUILD-PLAN.md` phase by phase and tick items off as you finish them. `HANDOFF.md` has the kickoff instructions.

## Welcome screens
- A new player (no `onboarding.done` in the save) sees `Onboarding`: three questions, then the first two calls of the trial (`TRIAL_ID` in `catalog.ts`). In production the trial needs the Hot Seat published; `npm run dev` also allows its draft. Anyone who skips or has played before goes straight to Home.

## Installable app
- The game is **online only** (Atheeb's call): no offline caching. A "No internet" screen covers the game while the connection is down. `public/sw.js` only removes the offline worker an early version installed; don't register a worker again without asking.
- `src/lib/pwa.ts` and `InstallSheet` handle "add to home screen".

## Server (Railway) and database (Supabase, Mumbai)
- Hosting is Railway at `ceoforaday.in`, deployed from GitHub; the database and Google sign-in are the Supabase project `vctghvtustlxjugpgvqz` (Mumbai). Env vars are listed in `.env.example`.
- **Guests** play on the phone (localStorage `cfad.v1`), as before. **Signed-in players'** progress lives only on the server: `store.tsx` calls the API routes and takes the state they return (each reply carries a `version`; older replies are ignored).
- **The server is the referee** (`src/lib/server/game.ts`): rewards use the same pure rules as guests (`applyFinish`, `applyBuy`, … in `game-state.ts`). Finishing a Hot Seat replays the picks; a run key pays once; a replay pays only `completionXp`; Hindsight is charged at the finish; the Daily Call is one a day by database key. Saves use a version check and retry (supabase-js can't lock rows).
- Storage goes through the `Db` interface (`src/lib/server/db.ts`): `memoryDb()` in tests, `supabaseDb()` in the app. Every table has RLS on and no policies: only the server's secret key can touch them. Migrations are in `supabase/migrations/` (apply them with the Supabase MCP, then run `get_advisors`).
- **Leagues** (`leagueBoard`): groups of up to 30 per tier, joined on the first XP of the week (`add_league_xp`), settled when the player next looks (no weekly job). Small groups are topped up with practice rivals that never count for moving up. Badges are `public/league/<tier>.webp`.
- **Notifications** (`src/lib/server/reminders.ts`): `public/sw.js` only shows them (no caching; the game stays online only). Supabase `pg_cron` calls `/api/cron/remind` at the start of each IST hour with the `cron_secret` from Vault. Kinds: streak warning and win-back on days 2, 4 and 7 (at the player's hour), the 9 am Daily Call teaser, Sunday's "league ends tonight", Monday's promotion, and "X just passed you" right after a league change. Guardrails: nothing 10 pm–8 am IST, at most 2 a player a day, each kind once a day (`notifications_sent`), nothing after a week away. `/admin/notify` sends one by hand (no guardrails).
- A guest's save is imported once on sign-in, with every number capped (`importGuest`).
- Sign-in uses Google's own button (`renderGoogleButton` in `src/lib/auth.ts`, then `signInWithIdToken` with a nonce), so Google's page names ceoforaday.in. Without `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, or if Google's script fails to load, it falls back to Supabase's redirect. An app added to an iPhone's Home Screen can't see Safari's Google accounts, so the first sign-in there always asks for the email (an iOS rule).

## Known gaps
See `docs/LAUNCH-CHECKLIST.md`.
