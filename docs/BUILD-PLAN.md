# CEO For A Day: end-to-end build plan

This is the plan for taking the prototype in this folder to a launchable product. Work through the phases in order. Each phase ends with something that runs and is tested before the next begins.

**Read first:** `CLAUDE.md` (product decisions), `docs/HOT-SEAT-DESIGN.md` (how Hot Seats work), `docs/LAUNCH-CHECKLIST.md` (why each item matters).

**Ground rules**
- Keep the existing engine (`src/lib/engine.ts`) and Hot Seat format (`src/lib/hotseat-types.ts`) as the core. Extend them; don't rewrite them.
- Every phase must keep `npm run validate`, `npm run build` and the tests green.
- Ask Atheeb before you:
  - sign up for any paid service,
  - choose a vendor that's marked *decision* below,
  - add a secret or API key, or
  - change pricing, the name or the "Hot Seat" wording.
- Copy uses simple English: short words and short sentences. Never write "case study" in the UI.
- Mobile first and dark mode only. Test at 360×800 and 390×844. It must also work on a cheap Android phone over 4G.

---

## Phase 0: Clean up the prototype (half a day)
- [x] Initialise git, commit the prototype as-is, and add a GitHub repo (ask for the remote). *Git is set up; Atheeb adds the remote and pushes.*
- [x] Add ESLint (`eslint-config-next`), Prettier and Vitest. Add a `test` script.
- [x] Unit-test `engine.ts`:
  - [x] `choose`, `resolveNode` and `score`.
  - [x] The fired rule: a run ends early only before the final decision.
  - [x] `buildDebrief` patterns.
  - [x] `playerOrder`: same seed gives the same order, and the first two are gentle.
- [x] Unit-test `store.tsx` logic: streak, freeze use, quest reset and league week rollover. Move the pure logic out of the React file so it can be tested.
- [x] Turn `scripts/validate-hotseats.mjs` into a Vitest test that runs over every registered Hot Seat.
- [x] Remove the `PREVIEW_EXPORT` hack once a real deployment exists. *Removed early: the password on `/admin` needs a running server, which static export can't provide.*
- [x] **Done when** lint, tests, validate and build all pass in CI (GitHub Actions).

## Phase 1: Content pipeline (1–2 days)
Hot Seats should be data files, not TypeScript.
- [x] Move each Hot Seat to `content/hotseats/<id>/hotseat.json` (+ `media/`), validated by a Zod schema generated from `hotseat-types.ts`. *Hand-written schema plus an exact type-equality check that fails the build if the two drift.*
- [x] Build a loader that reads all Hot Seats at build time.
- [x] Add a CLI: `npm run hotseat:new -- <id>` scaffolds a Hot Seat from a template.
- [x] Add a CLI: `npm run hotseat:check -- <id>`, which:
  - [x] validates the schema,
  - [x] walks every path,
  - [x] confirms every ending is reachable,
  - [x] checks every ok/bad option has `better`,
  - [x] confirms all media files exist,
  - [x] confirms every voice line has audio.
- [x] Add a CLI: `npm run hotseat:tree -- <id>`, which writes a Mermaid file and an SVG of the tree map. *Writes the Mermaid file; at Atheeb's request the picture is the branded tree at `/admin/<id>` instead of an SVG.*
- [x] Build an asset pipeline:
  - [x] `scripts/narrate.py` generates the missing narration (OmniVoice via VoiceStudio; `narrator` and `advisor` voices from `scripts/voices/`).
  - [x] A script converts images to webp at 1080 px wide.
  - [x] A script trims and compresses clips (≤ 9 s, no audio, H.264).
- [x] Write an **LLM pre-generation script** (offline, never at runtime). For each Hot Seat, enumerate every path and draft one richer personalised debrief per path with the Claude API. Save the drafts to `debriefs.json` with `reviewed: false`. The app uses a debrief only when `reviewed: true`, otherwise it falls back to the assembled debrief. Ask for the API key. *Script done (`npm run debriefs`, Opus 5.5); the first real run waits for the key.*
- [ ] Optional authoring UI: a local-only `/studio` route that edits the JSON, shows the tree and plays any path. *Skipped for now: `/admin` shows the tree and every path's text.*
- [x] **Done when** Kodak runs from JSON exactly as it does today, and a new Hot Seat can be scaffolded and checked from the CLI.
- [x] Added at Atheeb's request: `/` is the website, `/app` the game, `/admin` (password) lists every Hot Seat and shows every path as a tree.

## Phase 2: More content and the Daily Call (ongoing, starts now)
- [x] Write the **Daily Call** format: a one-decision mini Hot Seat that takes about 60 seconds and keeps the streak alive. Add a `daily.json` pool and a schedule. *`content/daily/daily.json`; its order is the schedule.*
- [x] Draft the next three Hot Seats. Suggested: Blockbuster (complexity 1), Maggi 2015 (2) and Nokia (3). Atheeb picks the final three. *Atheeb picked Blockbuster, Nokia, Maggi 2015 and Netflix. Blockbuster, Nokia and Netflix are drafted and fact-checked. Maggi is drafted and fact-checked too, but on legal hold until Atheeb checks the Supreme Court appeal and any open criminal cases (see `content/hotseats/maggi/research.md`).*
  - [x] Each one has 4–6 decisions, a recovery path after every bad call, real facts with sources, labelled alternate history, and no logos or invented quotes from real people.
  - [ ] Queue media for each one: archive footage from movingimagearchive.com first. Generate the rest with `~/Documents/case-game/get_assets.sh` (Z-Image Turbo via mflux), which Atheeb runs on his Mac. *Archive searches are in each `research.md`. Image prompts still to write per Hot Seat; `~/Documents/case-game` is no longer on disk.*
- [ ] Regenerate two out-of-period Kodak images: `c1_box` (should be a 1900 cardboard box camera) and `c2_rush` (a 1976 store, no flat screens). *Prompts written in `content/hotseats/kodak/image_prompts.json`; images to generate on Atheeb's Mac.*
- [x] **Done when** at least 4 Hot Seats and 14 Daily Calls pass `hotseat:check`. *Kodak, Nokia, Blockbuster and Netflix plus 14 Daily Calls pass with no errors. The new ones are still drafts until images and narration exist.*
- [x] Added: `docs/AUTHORING.md`, the recipe for every story, and fact-checks tied to the exact file they checked (`factcheck.md` with `checked-sha256:`).
- [ ] Added: `docs/HOTSEAT-ROADMAP.md`, about 110 candidates for Atheeb to cut to 100.

## Phase 3: Backend, accounts and real leagues (3–5 days)
- [ ] **Blocking, before the first public deploy:** every Hot Seat, draft and future Daily Call is bundled into `/app` today. Load each Hot Seat lazily, leave drafts out at build time, and serve only today's Daily Call. Move streaks, quests and the Daily Call to server-side IST together.
*Decision:* the default proposal is **Supabase** (Postgres, Auth, Storage) plus Next.js route handlers on **Vercel**. Confirm with Atheeb before you start.
- [ ] Data model:
  - [ ] `profiles`
  - [ ] `runs` (hot_seat_id, path, score, xp, ending, created_at)
  - [ ] `streaks`
  - [ ] `inventory` (coins, freezes, boosters, hindsights)
  - [ ] `quests`
  - [ ] `league_cohorts` and `league_members` (weekly)
  - [ ] `badges`
  - [ ] `notes` (derived from runs)
  - [ ] `entitlements`
- [ ] Auth:
  - [ ] Phone-number OTP. *Decision:* the SMS provider, such as MSG91 or Twilio. Indian sender IDs need DLT registration.
  - [ ] Guest mode first; prompt sign-in after the first debrief.
  - [ ] Merge guest progress from localStorage on sign-in.
- [ ] **Anti-cheat:** the client submits only the list of choices (the path). The server replays that path through the same `engine.ts` to compute score, XP and the ending, and it rejects impossible paths. It also checks booster time on the server side.
- [ ] Leagues:
  - [ ] Weekly cohorts of about 30 players in the same tier.
  - [ ] A scheduled job settles each week on Monday 00:00 IST (top 5 move up, bottom 5 move down).
  - [ ] Replace the simulated `league.ts` rows with real ones, keeping simulated fill-ins only while a cohort is small.
- [ ] Streaks use the IST day boundary computed on the server. Freezes apply automatically.
- [ ] Notes and the decision profile are read from the server, so they work across devices.
- [ ] **Done when** two test accounts on different devices see each other in a league, and a tampered score is rejected.

## Phase 4: Payments and the paywall (2–4 days)
- [ ] Plans (confirm before building):
  - ₹599 a week
  - ₹1,499 a month
  - ₹999 a month billed yearly (₹11,988)
- [ ] Web: **Razorpay Subscriptions** with UPI Autopay and cards.
- [ ] Android: Google Play Billing, required inside a Play Store app. iOS comes later.
- [ ] Use a single `entitlements` table, updated by webhooks (Razorpay, and Play Real-time Developer Notifications).
- [ ] Free tier proposal (confirm): the Daily Call plus the first Hot Seat. The paywall appears right after the first debrief.
- [ ] Paywall screen in the same visual style as the rest of the app (see the Airlearn reference screenshots in the chat history: annual plan highlighted as *Recommended*, price per month shown, big CTA).
- [ ] Add a restore-purchases flow, cancellation, a refund policy page and GST invoices.
- [ ] **Done when** a test-mode subscription unlocks Hot Seats and cancelling removes access at the end of the period.

## Phase 5: Installable app and distribution (2–3 days)
*Note from Phase 1: the PWA's `scope` and `start_url` are `/app`, and the service worker must never cache `/admin` or 401 responses.*
- [ ] Make it a PWA:
  - [x] Manifest and icons. *Scope and start URL are `/app`.*
  - [x] ~~A service worker that caches the app shell and each played Hot Seat's media.~~ *Dropped 2026-10-29: Atheeb wants the game online only. A "No internet" screen covers the game when the connection drops, and play carries on when it's back. An offline worker was live for about an hour that morning; `public/sw.js` now only deletes what it saved and unregisters itself.*
  - [x] An install popup on phones (`InstallSheet`): one tap where Chrome allows it, short steps on iPhone and other browsers, and "open in browser" inside Instagram or Facebook. It waits 3 days after "Not now".
  - [x] A data-saver setting that swaps video for stills. *Profile → Data saver. `npm run media` saves each clip's first frame as `<name>.jpg` (also the video's poster), and `hotseat:check` asks for it.*
- [ ] Android: wrap with **Capacitor** (or a Trusted Web Activity). Add push notifications through FCM. Prepare the Play Store listing. *Decision:* the developer account is Atheeb's.
- [ ] Performance budget: first load under 200 KB of JS, LCP under 2.5 s on a mid-range Android phone over 4G, and no layout shift.
- [ ] **Done when** the app installs from the Play Store internal testing track and a full Hot Seat plays in the installed app.

- [x] Welcome screens for a new player (`Onboarding`): three questions that change the game (minutes a day set the daily decisions quest; the chosen focus puts matching Hot Seats first on Home; what you do now shapes one line of the style card), then the first two calls of the trial Hot Seat (`TRIAL` in `catalog.ts`, Kingfisher Airlines), a style card built only from those calls, and "Carry on" into the rest of the run. "Skip, just play" on every screen. *A lean take on Empirio's quiz funnel: no fake loading screen, no made-up profile. Production shows it once Kingfisher is published.*

## Phase 6: Retention and growth (2–3 days)
- [ ] Streak reminder push notifications at the user's chosen time.
- [ ] Optional WhatsApp reminders via the Business API. Needs opt-in and an approved template. *Decision:* provider.
- [ ] Shareable result cards (an OG image per run): "I beat Kodak's real CEO: 92/100". Sized for WhatsApp and Instagram stories.
- [ ] Referral codes with coin rewards.
- [ ] Friend duels: same Hot Seat, compare paths and scores.
- [ ] Streak wager.
- [ ] First-run onboarding: name, goal, and one tutorial decision that teaches the verdict sheet.
- [ ] Sound effects (correct, wrong, level up), haptics on mobile, and confetti on the debrief.
- [ ] **Done when** a new user goes from install to first debrief in under 8 minutes in a usability test.

## Phase 7: Analytics, quality and legal (1–2 days)
- [ ] Analytics (*decision:* PostHog suggested). Events:
  - `hotseat_start`, `decision_made` (node, option, grade), `hotseat_complete`, `quit_at_node`
  - `paywall_view`, `purchase`
  - `streak_kept`, `streak_lost`
- [ ] Dashboards: Day-1, Day-7 and Day-30 retention, completion funnel, and where players quit.
- [ ] Feature flags and A/B tests (for example paywall timing or the price of the yearly plan).
- [ ] Error monitoring (*decision:* Sentry suggested).
- [ ] Accessibility: keyboard and screen-reader pass, focus states, reduced motion, captions always visible.
- [ ] Legal:
  - [ ] Privacy policy and consent under India's DPDP Act 2023.
  - [ ] Terms.
  - [ ] An "education, not advice" disclaimer.
  - [ ] A media credits page listing every archive clip's public-domain source.
- [ ] End-to-end tests (Playwright) for the full Kodak run, the paywall and a league join.

## Phase 8: Languages (close to launch, not before)
- [ ] Add `next-intl` for UI strings, and per-language Hot Seat files (`hotseat.hi.json`, …) that share the same node ids.
- [ ] Load Noto Sans Devanagari, Tamil and Bengali fonts per language.
- [ ] Voice: OmniVoice covers Hindi, Tamil and Bengali. Check how the cloned voices sound in each.
- [ ] A translation workflow with human review, because business terms must read naturally.

---

## Launch criteria
- 20 Hot Seats and 60 Daily Calls, all passing `hotseat:check` and fact-checked.
- Payments live in production and tested end to end.
- Day-1 retention of 40% or more in a closed beta of about 100 users.
- No crash-free-session rate below 99.5%.
- Privacy policy, terms and media credits published.
