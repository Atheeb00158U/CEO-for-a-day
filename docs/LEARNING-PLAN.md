# Learn first, then the Hot Seat: the plan

Status: **approved by Atheeb** (30 Oct 2026); decisions at the end. The research behind it is in `docs/research/`:
`curriculum.md` (the syllabus), `learning-design.md` (how Duolingo, Brilliant, Imprint and Anki teach),
`code-fit.md` (how it fits our code) and `video-experiment.md` (the video pilot).

## Why
Testers liked the Hot Seats but want to be taught first. So the app becomes an interactive book: short
lessons teach one rule each, then a Hot Seat tests those rules on a real company. Flashcards and other study
tools in Notes keep the rules fresh. Someone who finishes the course should think like a strong strategist.

## The course (from `research/curriculum.md`)
12 units, 31 modules, 122 lessons, basics to advanced. Every lesson is one plain rule plus an everyday Indian
example (udhaar, GST, sachets, "too costly", a rival who undercuts you, family partners, UPI).

| # | Unit | Practised by (today) |
|---|---|---|
| 1 | How a business makes money | weak: nothing on margin, break-even, udhaar |
| 2 | Customers first | Tanishq, Maruti, New Coke, Kodak, Nokia |
| 3 | Price and offer | Tanishq, Maruti, Netflix, LEGO |
| 4 | Trust, brand and selling | Tanishq, Amul, Apple |
| 5 | Running the business well | LEGO, IndiGo, Maruti (nothing on hiring or family) |
| 6 | Money, debt and risk | Harshad Mehta, Kingfisher, Intel |
| 7 | Leading people through hard times | thin |
| 8 | Rivals, partners and power | Amul, Apple, Intel (no story from the small player's side) |
| 9 | Strategy: making real choices | Apple, LEGO, IndiGo |
| 10 | Moats | IndiGo, Intel, Amul |
| 11 | When the world changes | Blockbuster, Kodak, Netflix, Nokia, Intel (too many) |
| 12 | Crises and big bets | Maggi, Harshad Mehta, IndiGo, Kingfisher |

Cash and customers come before frameworks. Rumelt, Playing to Win, 7 Powers and Porter come only after the
player has met the problem each one solves. "Judge the thinking, not the luck" is taught in Unit 1 and used
everywhere, since our feedback already works that way.

**Content gap:** 9 of our 15 Hot Seats are Western, 5 are about disruption, and all are big companies. The
next five Hot Seats should be Indian and fill Units 1–4: **Nirma vs Surf, Flipkart cash on delivery, Chik's
₹1 sachet, Tata Nano, Royal Enfield 2000.** Eleven more are listed in the research.

## How it works for the player (from `research/learning-design.md`)
- **A lesson** teaches one rule in 3–5 minutes, over 8–12 screens. At most 25 words on a teaching screen,
  and at least two thirds of the screens are things to do. Order: a hook story, a guess first, the rule, a
  worked example, a half-done example, 3–4 practice screens (one mixes in an older lesson), a mini-scenario,
  then a takeaway card that becomes a flashcard.
- **Exercises** (tap only, no typing): pick the best move, which price?, slider, spot the mistake, true/false
  then why, fill the gap from a word bank, put in order, sort into buckets, quick sum, match pairs, who's
  right?, mini-scenario.
- **The path on Home:** unit header, its lessons, a mixed Practice node, then the Hot Seat that tests them,
  and an optional hard replay. A Hot Seat comes after about every two modules. Its intro names the rules
  you'll need; each choice's "why" names the lesson; rules you missed go into review.
- **Notes becomes a study corner:** Cards (Daily 10: at most 20 a day, 5 new, never the whole backlog), then
  a Mistake journal, a Principle library and a shareable cheat sheet per unit. Later: speed round, "use it
  on my business" prompts, glossary.
- **Cards** show a small situation with tap answers; the app grades from right/wrong and speed. Scheduling
  uses FSRS (`ts-fsrs`): fewer reviews than older systems for the same memory, and it copes with missed days.
- **XP, streaks, quests, leagues** carry on. A 2-minute review keeps the streak. Lesson and review XP are
  capped in leagues so nobody wins by farming cards.
- **Narration:** only the hook and the takeaway are spoken, with a mute that stays off once set.

## How it fits the code (from `research/code-fit.md`)
- Content: `content/course/course.json` (units in order, each with lessons and Hot Seats) and
  `content/course/lessons/<id>.json` (screens, exercises, cards, sources), checked by a Zod schema inside
  `npm run hotseat:check`.
- **Answers stay on the server**, like Hot Seats: `/api/lesson` replays the answers so far and returns the
  verdict and the next screen; `/api/lesson/finish` pays once per key. `check-bundle` also checks lesson
  "why" text. If Check feels slow on 4G (over ~0.7 s), fall back to sending one lesson at a time.
- Saved progress: `lessons` (best score each) and `cards` (FSRS state) in the game state, a new
  `lesson_plays` table, and guest import caps. **First fix:** old saves are merged shallowly today, so new
  fields would come back missing; both phone and server need a deep merge plus a test.
- Size: about 10–12 working days of code, not counting content.

## The video experiment (from `research/video-experiment.md`)
Try **one** Hot Seat as a continuous MMH-style video (archive footage cut on every phrase, word-by-word
captions, documents with highlighter). The video stops at each decision, the frame blurs and the options
slide up from the bottom.
- **Pilot story: to be chosen after the curriculum** (Atheeb ruled out Kodak as over-familiar). Research
  notes: the archive has real Kodak footage (Rochester factory films, darkroom and lab reels,
  1990s offices). Indian stories got almost no Indian footage in 35 searches, so Amul and Maruti would look
  random. Intel was the runner-up.
- **One short video per screen the game already shows:** 39 clips, about 10 minutes in all; one play
  watches about 4 minutes. The engine doesn't change. Hearts, meters, "Our estimate" and the verdict stay
  as app overlays.
- **Format:** 720×1280 portrait, 30 fps, with a 540×960 copy for slow data (about 36 MB or 19 MB a play).
  The archive's clips are small (320×240), so most sit on cards over paper, MMH-style.
- **Answers stay hidden:** outcome clips have secret names and arrive only after the pick; they're never
  preloaded. With data-saver, a slow connection or any unreviewed clip, the app shows today's still and text.
- **Hosting:** Supabase Storage in Mumbai (free plan is enough for the pilot), or Cloudflare R2 later, since
  `ceoforaday.in` is already on Cloudflare. Not Railway.
- **Every 10 seconds reviewed:** for each 10-second window, a sheet of 10 stills, the words, sources and
  fact claims, an 8-point checklist and your sign-off. Publishing refuses a clip that isn't signed.
- **Two stages.** First a 100-second slice (the opening, the first decision and its three outcomes), shown
  to 5 people on their own Android phones over mobile data. Go on if 4 of 5 prefer it, they remember the
  story at least as well, and you wouldn't cut it. Then the rest (2–3 weeks part-time), then a live 50/50
  test.

## Writing the content
Each lesson follows a pipeline like `AUTHORING.md`: research with sources → draft → the copy tools
(slopmonster, fluent-prose, then ChatGPT in the browser) → fresh-context fact-check → your review. ChatGPT
runs in the in-app browser under your own sign-in; I don't sign in for you. 122 lessons is a lot of writing,
so it ships in waves: Units 1–2 first (about 20 lessons), then two units at a time.

## Order of work
0. **Plan the curriculum in full:** every unit and module, its lessons, and the Hot Seats each module needs
   (existing or to write; a module can have several). Then plan the Hot Seats.
1. **Foundations, no UI** (can ship hidden): the deep-merge fix, course format and checks, `/api/lesson`,
   saved progress, `lesson_plays`.
2. **The player sees it:** lesson player, the new Home path, Notes with Cards and the Mistake journal.
3. **Content wave 1:** Units 1–2 lessons and cards; existing Hot Seats' "why" text names the lessons.
4. **Video pilot stage 1**, once its story is chosen (separate from the app code until it's approved).
5. **New Indian Hot Seats:** Nirma, Flipkart COD, Chik, Tata Nano, Royal Enfield (normal `AUTHORING.md`).
6. Content waves 2+ and the rest of the Notes tools.

## Atheeb's decisions (30 Oct 2026)
1. **Video pilot: not Kodak** (too familiar a story). Which Hot Seat gets the video is decided after the
   curriculum and the Hot Seat list are planned.
5. **Curriculum first, then Hot Seats.** Plan the full course before choosing or writing more Hot Seats.
   **A module can have more than one Hot Seat to clear.**
2. **Unit 1 gets a composite story** ("a kirana's year"), clearly labelled as made up, not a real company.
   It's the only exception to the real-companies rule.
3. **Path:** lessons unlock in order; a short "test out" lets a confident player skip a unit.
4. **First minute:** three welcome questions, then Unit 1's first lesson, then a gentle Hot Seat. The
   Kingfisher trial is retired.
