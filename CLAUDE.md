# CEO For A Day: notes for Claude Code

Mobile-first Next.js app (App Router, React 19, Tailwind v4, TypeScript). Dark mode only. The design language is Duolingo and Airlearn: chunky 3D buttons (`.btn3d`), answer tiles (`.tile`), pill counters, a bottom tab bar, and the Nunito font. Copy their design elements, not their layouts or illustrations.

UI components: use shadcn/ui, restyled to this look. Add gluestack-ui only if we build a native app later.

## Product decisions from the owner (Atheeb)
- **Name:** "CEO For A Day". A single case study is called a **Hot Seat**; never write "case study" in the UI.
- **Audience:** wannabe and struggling entrepreneurs in India.
  - English first. Hindi, Tamil, Bengali and more come close to launch; don't build i18n yet.
  - Copy must work for people with basic English: short words, short sentences.
- **Ordering:** Hot Seats aren't tagged easy or hard for players. Each player gets a seeded random order, but the first two are always gentle (hidden `complexity` ≤ 2).
- **Trees are fully pre-mapped.** There are no live LLM calls during play. Personalised takeaways are assembled from authored lines; richer per-path debriefs can be pre-generated at build time.
- **Choice feedback:** every choice shows what happened (as story), why it was good or bad, and, for ok/bad choices, what would have worked. Alternate-history outcomes are labelled as estimates.
- **Board trust (3 hearts):** losing them all before the last decision ends the run (the "fired" ending). Players can fix mistakes until it's too late.
- **Media sources:** archive footage from movingimagearchive.com (public domain). Other images are generated with Z-Image Turbo via mflux on the owner's Mac (`~/Documents/case-game/get_assets.sh`). Narration uses Kokoro-82M, voices `af_heart` (narrator) and `bm_george` (advisor).
- **Pricing plan (not built):** ₹599/week, ₹1,499/month, or ₹999/month billed yearly.

## Routes
- `/` is the website, `/app` the game, `/admin` the Hot Seat list and path trees.
- `/admin` is behind HTTP Basic Auth (`src/proxy.ts`) against `ADMIN_PASSWORD`. Without it, it's open only in `npm run dev`. The Hot Seat JSON still ships inside `/app`, so the password hides the view, not the answers.

## Commands
- `npm run dev` (restart it after adding media: `sync-media` copies `content/hotseats/*/media` into `public/media` on start)
- `npm run hotseat:check`: run this after any Hot Seat edit (CI runs it too)
- `npm run hotseat:new -- <id>`, `npm run hotseat:tree -- <id>`
- `npm run media -- <id> <files…>`: prepare images and clips
- `npm run narrate`: regenerate narration after text edits (needs the Kokoro files on Atheeb's Mac)
- `npm run debriefs -- <id>`: offline Claude drafts of per-path debriefs; a person sets `reviewed: true` before the app shows one

## Hot Seat content
- Each Hot Seat is `content/hotseats/<id>/hotseat.json` (+ `media/`), checked by the Zod schema in `src/lib/hotseat-schema.ts`, which must match `hotseat-types.ts` exactly (a type check fails the build otherwise).
- `draft: true` hides a Hot Seat from the production game and turns missing media and audio into warnings. Its JSON is still bundled (every Hot Seat is, through `import.meta.glob`), so don't commit anything secret in a draft; the Phase 5 switch to lazy loading can drop drafts from the bundle.
- Media names must be unique across Hot Seats (they share `public/media/`).
- Files that Node runs directly (`engine.ts`, `hotseat-schema.ts`, `hotseat-check.ts`, `voice-lines.ts`, `content-files.ts`) use `import type` for types and relative `.ts` imports, no `@/` paths.

## UI
- shadcn/ui components live in `src/components/shadcn/` (alias set in `components.json`). Their token names are mapped onto our palette in `globals.css`; shadcn's own `muted` is never defined, because ours is the grey text colour.

## The build plan
Follow `docs/BUILD-PLAN.md` phase by phase and tick items off as you finish them. `HANDOFF.md` has the kickoff instructions.

## Known gaps
See `docs/LAUNCH-CHECKLIST.md`.
- Leagues are simulated on the device; there's no backend yet.
- State is saved in localStorage only.
