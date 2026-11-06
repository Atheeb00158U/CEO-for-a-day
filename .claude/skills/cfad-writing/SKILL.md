---
name: cfad-writing
description: Atheeb's complete rules for CEO For A Day content - how lessons sound, how questions, options and replies are written, how Hot Seats play, and the QA every piece passes before he sees it. Use before writing, editing, reviewing or QA-ing any lesson, exercise, flashcard, Hot Seat, Daily Call, wolf line or other player-facing copy in this repo, and before briefing an agent to do any of that.
---

# Writing for CEO For A Day

Every rule here comes from Atheeb playing the game and telling us what broke, from 27 Oct to 5 Nov 2026. The
date and his words are given where they matter, so you can tell why a rule exists. It gathers what is spread
over `docs/QUESTION-RULES.md`, `docs/AUTHORING.md`, `docs/HOT-SEAT-DESIGN.md`, `docs/LEARNING-PLAN.md`,
`docs/CURRICULUM.md`, `CLAUDE.md` and the checks in `src/lib/course-check.ts` and `src/lib/hotseat-check.ts`.
Where two of them disagree, the newer ruling from Atheeb wins; if this file and a doc disagree, fix whichever
is out of date.

His standing complaint is that we make the same mistakes twice: "Just make sure when you're doing the scale-up
part, you are not messing up the questions like you did for module one" (1 Nov). Read this whole file before
you write, and run the checklist at the end before you show him anything.

## 1. Who we write for

The player is a wannabe or struggling Indian entrepreneur with **basic English**: a kirana owner in Indore, a
first-time founder, someone who can't afford an MBA. Judge every line by one test: **will a new Indian player
enjoy this, keep playing, and pay?** (31 Oct: "always think if the end user will like this… always question
your decisions, even though I approve them".) If a choice fails that test, change it and tell Atheeb what you
changed and why; don't ask him first.

The people he showed Module 1 to were doing MBAs or teaching them, and they loved it (1 Nov). Keep the ideas
that deep, written so a shopkeeper can read them.

**What free players see must be the most gripping.** On 31 Oct he asked of the free kirana and Nirma
stories: "are they interesting enough for people to be hooked on to it and buy the gated modules?" Prefer
famous, dramatic stories and surprising openers early in the path.

## 2. Lessons: what they teach

- **Never teach the basics.** Profit, loss, margin, fixed and variable costs, break-even, "keep shop and home
  money apart" are school-level. A lesson on them makes players think "I already know this. This app is just
  wasting my time" (31 Oct, after lesson 1 was "too basic"). Fold a basic into a harder lesson as one or two
  conversational lines: "Sales are all the money that comes in; profit is what's left."
- **Every lesson teaches one named concept** that players have never heard of, or heard of but never really
  learned: runway, cash conversion cycle, contribution margin, BATNA, anchoring, decoy pricing, the Mom Test,
  Goodhart's law (31 Oct). Say the name out loud in the lesson, so they can look it up and sound smart using
  it. The full sales-psychology set from his reel (16 ideas: anchoring, decoy pricing, framing, gain vs loss
  framing, loss aversion, endowment effect, reciprocity, social proof, commitment and consistency, scarcity,
  tactical empathy, labeling, mirroring, reactance, status quo bias and its design side) is taught by name, each with the study behind it, how it's used on the player, how to use it honestly, and where it
  backfires. Persuasion lessons end on one ethics line: use on others only what you'd accept being used on you.
- **Something a beginner gets wrong**, opening with a surprising real case and asking for real working-out
  (two or three steps, realistic Indian numbers). The first lesson must make a would-be founder think
  "I didn't know that". Fewer, denser lessons beat many easy ones.
- **The real case must teach this lesson's concept.** Jet Airways is a runway story, not "profit on paper";
  check the match before writing (31 Oct). A lesson may open with a famous real Indian company, but never one
  that is a Hot Seat gate (that would give the gate's answer away). Prefer Indian cases; use a foreign one
  only when no sourced Indian case exists (Posies Café in 3.1 was kept for that reason).
- **"Judge the thinking, not the luck"** is taught in Unit 1 and used everywhere: a reply grades the reasoning
  the player could see at the time, not how things happened to turn out.
- **Facts stop where the source stops.** No invented numbers inside a real story. (iD Fresh: the source said
  "a six-month target, hit in nine", with no number, so the lesson can't add one.) A fact-checker opens every
  source.

## 3. Lessons: how they sound

**A teacher talking to one student** (31 Oct: "it should be like a teacher teaching a student… this isn't
conversational writing"; and "the content looks like bare statements, there is no conversational flow").

- Use "I" and "you". Tell a story, ask a question, react to the answer ("Exactly right." / "That's what
  most people guess…"), then build the next idea on it ("Now, here's the part…", "Let's try one.").
- **One story thread per lesson.** One real case runs the lesson, then **one** made-up business for all of
  the practice, not several characters. Across a module the practice business carries on in order with
  consistent numbers (the bakery thread ran from Module 2.1 to 3.2, month by month), so check the thread
  across lessons, not one lesson at a time.
- **Bridge every turn out loud.** Never jump topics with zero context (31 Oct: "After Jet… we completely moved
  to a new topic without zero context. These minor things you need to keep noticing."). The model bridge:
  "Jet had planes and crores of rupees, but the same problem can close a small shop too. So let us use a
  smaller example. Imagine you have opened a small gym."
- Plain comparisons before the term's name ("Think of the cash in a bank as petrol in a tank… That number is
  your runway.").
- A teaching screen holds one full thought: at most 50 words, about 20 seconds spoken.
- Running slopmonster and fluent-prose on each screen does **not** fix bare statements; the structure is the
  problem. Write the flow first, then polish.
- **Mentor text:** `content/course/lessons/u1-cash-runs-out.json` (Jet Airways → runway → your gym). Read it
  before writing a lesson, and give it to any agent that writes one.

**Shape of a lesson:** 3–5 minutes, 8–12 screens, at least two thirds of them things to do, tap only (no
typing). A hook story → a guess first → the rule → a worked example → a half-done example → 3–4 practice
screens (one mixes in an older lesson) → a mini-scenario → a takeaway card that becomes a flashcard. Mix at
least 4 exercise kinds (explain, choice with `guess`, gap, order, sort, scenario). The rule is 12 words or
fewer.

**What `course-check.ts` enforces** (`npm run hotseat:check`):
- the first screen is an `explain` (the hook);
- a teaching screen has at most 50 words;
- a question has at most 25 words, and an option at most 12;
- at least 3 scored exercises;
- a warning when the right answer sits in the same position in more than 60% of questions;
- every wrong option has its own reply;
- a % change carries "Imagine…" or a named offer;
- sort prompts say "For each…", and order prompts are at least 8 words;
- a gap's word bank doesn't repeat words;
- the idiom list;
- flashcards are present.

**Flashcards** show a small situation with tap answers. Card ids are review-schedule keys: never rename or
reuse one.

## 4. Questions

From `docs/QUESTION-RULES.md`. Each rule comes from a real confusion in Module 1.

1. **Plain English on the first read.** Short words, one idea per sentence, no idioms. The reader has basic
   English. *Broke it:* "You have one afternoon to save money. Which do you try first?" (31 Oct: "Why can't
   you just be as simple as possible with language?"). `course-check.ts` keeps an idiom list; add to it when
   a new one turns up.
2. **Remove the "how".** If a question asks the player to imagine a change, say it's imagined, Atheeb's way:
   "Imagine you have a magic wand. You can make one cost 20% cheaper…". Or name the real move: "Your maker
   offers ₹30 off if you buy 200." *Broke it:* "Cutting which one by 20% saves you the most?" (31 Oct: "If
   something is costing me ₹100, it's going to cost me ₹100. How will I cut 20%?").
3. **Carry the numbers.** A question repeats every number it needs, even if the last screen said it. The
   player can't scroll back. *Good:* "Your gym has ₹3 lakh and loses ₹50,000 a month…"
4. **Say what to do.** Sort and order screens say the task in a full sentence: "I'll show you six things. For
   each one, tell me: can you spend it today?" Bucket labels answer that exact question. *Broke it:* a sort
   with "Can pay now / Can't pay yet" took him 6–7 minutes to understand (31 Oct: "At least in the question,
   you should instruct me what each option is").
5. **Every wrong option gets its own reply** (see §5).
6. **Each wrong option is a real mistake** a beginner would actually make, not a joke answer. If nobody would
   pick it, replace it.
7. **The facts stop where the source stops.**
8. **The real story teaches this lesson's concept.**
9. **Bridge every turn**, with one made-up business for all of a lesson's practice.
10. **Not school-level.** If a school-leaver would say "I know this", it's a one-line aside, not a question.
11. **The player drives.** Scenario outcomes start from *their* pick; a wrong pick is never "corrected" by the
    next screen.
12. **No sums hidden inside a story question.** A sum question looks like a sum; a judgement question has no
    tricky arithmetic.

Learned while building Modules 2.1–3.2:

- **Test judgement, not word-spotting.** Readers kept finding give-aways: the longest option, or an option
  that repeats the lesson's words.
- **Put the guess before the screen that explains the answer**, never after it.
- **A gap's word bank has only one word that fits each blank.**
- **Don't ask what people "want"** in a customer-research question; that contradicts the Mom Test.
- **A teaching example must not read as exploiting people.** Value pricing read as "profiting from
  emergencies" until the price became open and the same for everyone.
- **Lessons in a module must not contradict each other.** "Don't raise prices in a rush moment" clashed with
  "a long queue means raise the price" until a bridge screen and a narrower rule fixed it.

## 5. Options and replies

- **Equal length, equal weight.** Option labels are about the same length; the right one is never the
  longest, never always in the same position, and never the one that reuses the lesson's words.
- **Every option sounds sensible.** A wrong option is what a smart beginner would really pick.
- **Wrong-answer replies name what the player probably did and show the working:** "I see what you did:
  ₹3 lakh divided by ₹1.5 lakh. But your members still pay you ₹1 lakh, so your real monthly loss is only
  ₹50,000…". Never just "Wrong".
- **Right-answer replies praise, then say why in one or two lines:** "Exactly. ₹30 lakh divided by ₹5 lakh is
  6 months. That is the runway sum…".
- **Don't repeat yourself like a recording.** A missed question that comes back right gets praise and the
  one-line rule ("There you go, you've got it now. Here's the rule to keep: …"), not the first explanation
  word for word (31 Oct: "shouldn't it just appreciate and summarize?").
- **Scenario money must add up.** State weekly or monthly totals in outcomes, so a "bad" option never quietly
  earns more than the "great" one.
- **Options are never read aloud.** Players read them (1 Nov: "do not read the options").

## 6. Hot Seats

From `docs/HOT-SEAT-DESIGN.md` and Atheeb's play-tests.

**It must play like a story you are living, not a quiz about a company.** On 28 Oct he found the Hot Seats
"pretty boring and didn't make sense": "there is no continuity between decisions. It feels very sudden and
small. Basically, it doesn't move like a story… nobody has enough context on what exactly happened and what
happened in between… we should make sure we are having a lot of interactivity. Because if you say a story for
too long, then it becomes boring… the story should move based on how I'm choosing… there is one right route,
but there may be more right paths. And more wrong paths."

- **Open with a person, a goal and a clock.** Two short scenes at most: where you are, what you're in charge
  of, what you must achieve, what happens if you fail. Only the numbers the first call needs.
- **Every call follows from the last.** The outcome shows what your choice did; the next scene opens from
  there and is shaped by it. Use flags and `when` variants so each path reads as one story.
- **Fill in what happened in between.** Most players don't know these stories (IndiGo, Maggi, Maruti). A
  bridge scene covers the months between two calls in two or three sentences.
- **Short beats, then a choice.** Scenes and setups about 35–55 words, outcomes 30–50. Split a long beat into
  two scenes. One or two numbers per screen. Narration that runs too long gets boring.
- **Several right paths and several wrong ones.** An alternate option can be great too, a later call can
  rescue an early mistake, and late scenes and endings have variants for the main paths.
- **Off-path text fits what the player chose.** Read every path's flags before writing a variant. In shared
  variants use words that fit any path ("your first vehicle", "your partner"). A scene's `year` is fixed, so
  if a choice moves the timeline, route to a different scene node.
- **Test judgement, not values.** On 28 Oct he played Maruti picking only what "looked morally right", and
  everything was correct: "How is this testing my decision-making skills?" So no option is wrong just for
  being unethical, greedy, lazy or unsafe, and every costly option sounds like a smart plan a good CEO could
  pick. In each Hot Seat, at least one right call feels harsh or unpopular (layoffs, a price rise, killing a
  loved product, siding with a rival), and at least one kind, loyal, patriotic or cautious-sounding option is
  costly. Bold and long-term must not always win either: at least once, the patient or smaller choice is
  right. A player who picks only what sounds nicest must lose trust.
- **No telegraphing.** Every label carries its real cost ("…, but it is tiny", "…, even though the wait will be
  long"). Labels are about the same length. The advisor names the tension or argues one side, never points at
  the answer, and the setup never ends on a question only one option answers.
- **Say it like a storyteller.** Outcomes are events, not encyclopedia lines: "about a quarter of the company",
  not "26%", unless the story turns on the number.
- **Every choice shows what happened (as story), why it was good or bad, and for ok/bad picks what would have
  worked.** Every option has a label, `outcome`, `why` and a one-line `takeaway` for the notes; ok and bad
  options also have `better`. **The `why` names the lesson it tests**, the Hot Seat's intro names the rules
  you'll need, and missed rules go into review. Off-path outcomes are estimates; the app badges them, so
  **never write "Our estimate" in the text**.
- **Endings:** legend, survivor and collapse by the Future meter, plus fired; `realEnding` is the tier the
  real company reached. Per-path debriefs drafted by `npm run debriefs` show only after a person sets
  `reviewed: true`.
- **Grade the real call honestly.** A real company's call can be "ok" (Snapdeal's several rounds of staff cuts,
  Titan's and Eureka Forbes's last calls), and the real ending can then be "survivor". Zerodha's Hot Seat
  says plainly that trading is risky.
- **Order:** players never see difficulty tags. Each gets a seeded random order, but the first two Hot Seats
  are always gentle (hidden `complexity` ≤ 2).
- **Shape:** 4–6 decisions, three options each (usually one great, one risky, one costly), the great one in a
  different position each time, exactly one `real` option per real-path decision, a way back after every
  costly call, 5–8 minutes a run, 3 hearts of board trust.
- **Truth:** every real-path fact is sourced and fact-checked (stamped `factcheck.md`, no open claims). No
  quotes from real people, no invented events stated as fact, no logos, no real person's likeness in generated
  images. Real faces are fine in archive footage and credited stills.
- **Legendary stories pull players in.** Famous Indian stories, scandals included (Kingfisher and Vijay Mallya,
  Harshad Mehta), are wanted: "The more and more legendary businesses we bring in, the better" (30 Oct). This
  overrides the older "avoid active litigation" line in AUTHORING: keep every claim sourced and neutral, and
  re-check court status before publishing. Still flag stories that turn on a living person's private life.
- **Made-up stories:** only kirana-year. Its town has a name that matches no real place. Its people are said
  to be invented once, in the debrief's "About this story" card, and nowhere else (5 Nov: tags "look cheap").
  It needs a stamped `realism.md` instead of a fact-check, and every `sources` URL must be in `research.md`.
- **Images are continuous with the story,** not random (30 Oct: "the hot seat story itself should be very
  continuous, including the imagery").
  - Use movingimagearchive.com first (public domain).
  - film-grab.com only when a line names a specific film, as a small credited insert, flagged to Atheeb.
  - frameset.app and fashiongonerogue.com are reference only.
  - Where no archive fits, use ChatGPT in the browser (the 31 Oct rule replaces the 30 Oct "no AI images"):
    period-correct, Indian where the story is Indian, no logos or readable brand names, no real person's
    likeness.
  - Never put a face next to a line about a real person it isn't.
  - Log every image in `media.md`, writing "not found" and flagging it when nothing fits.
  - Media names are unique across Hot Seats.
- **The video experiment** (30 Oct, not built yet): one Hot Seat, not Kodak, told as an MMH-style video that
  pauses for each decision. Every 10 seconds is reviewed and signed off. If he doesn't like it, "we need to
  come up with a better way of storytelling so the user doesn't get bored of listening to the narration."
- **Show the player's pick.** The chosen tile stays highlighted until "Lock it in" (28 Oct: "the whole app has
  no indication on what I'm clicking"). Sound effects mark picks, verdicts and endings ("the whole app lacks
  sound effects… probably one of the reasons why it's boring").

## 7. Words we use and never use

- A story is a **Hot Seat**; never write "case study" in anything players see.
- Never say "AI illustration", "AI image", "made-up" tags or similar on player screens (28 Oct, 5 Nov: it
  "makes the app look cheap").
- Never write "Our estimate" in story text; the app badges it.
- Never invent numbers, testimonials, "X founders joined", viewer counts or fake urgency (CCPA dark-pattern
  rules). Prices follow `CLAUDE.md` (struck ₹199, ₹99, "only for the first 1,000 members", never a seat count).
- Idioms and school words are out: no "one afternoon", "on paper", "bottom line", "in the long run"… (see the
  list in `src/lib/course-check.ts`).
- The wolf (the brand's face, later the mentor and Hot Seat advisor) speaks in short, calm, serious lines in
  basic English, every one checked with ChatGPT.

## 8. Voices and audio

- **Only our recorded voices.** The narrator is Atheeb's cloned voice, the advisor a designed voice (female,
  middle-aged, Indian accent), and the wolf a designed voice (deep, male, middle-aged, low pitch, Indian
  accent, calm and serious; never cloned from a recording). Never ElevenLabs, never the browser's voice
  (31 Oct: "some woman computer voice, which is very bad"). An unrecorded line stays silent.
- **Everything is narrated:** lessons too (31 Oct: "even lessons need to be narrated and read"). Text stays
  on screen so players can read instead.
- **Record before he plays.** Run `npm run voices`, then narrate the changed lines (VoiceStudio on Atheeb's
  Mac). Record from a filtered list of changed lines only, never the whole list.
- **Audio behaves.** Options are never read aloud. Narration stops the moment the player leaves the screen or
  the app. A sound effect that can't play on time is dropped, never played late. Voices never talk over each
  other: the wolf stops before the narrator starts.

## 9. Lesson and Hot Seat UX rules

- **Never lose context.** No back button, but a question after a teaching screen carries its numbers and
  offers "Read again" (a sheet with the earlier screen).
- **Exercises explain themselves:** sort is one card at a time with labels that answer the question asked.
- **Continue waits** until the verdict or outcome has been read out, or for a reading time with the voice
  off (he taps Continue without thinking).
- **Sort ends with a list** where the player can change answers before checking.
- **The player owns the path:** "You chose…", "Where your choice led", "The road you didn't take".
- **No boxed UI** around lesson and Hot Seat content (5 Nov: "the whole UI looks boxed").
- **No skipping ahead.** The map has no test-out ("Skip ahead") at all: "people miss out a lot of learning, even
  though they're smart" (Atheeb, 6 Nov). Don't promise a skip in lesson or Hot Seat copy.
- **The map is one colour:** every unit header and plain module banner is the brand gold, and modules don't show a
  lesson count (6 Nov: "users aren't going to count… it doesn't matter").

## 10. The QA every lesson and Hot Seat passes before Atheeb sees it

He wants it right the first time. Do every step, and record in the PR what each step changed.

**Lessons**
1. Write the first lesson of a new module yourself as its mentor text (or match `u1-cash-runs-out`), then the
   rest to match it.
2. `npm run hotseat:check`: no warnings on the lesson (word limits, missing wrong-replies, sort and order
   instructions, % changes without "Imagine", idioms).
3. **Fresh reader, round 1.** A fresh-context agent plays "Ramesh", a small shop owner in Indore with basic
   English. He reads screen by screen and answers every question *before* seeing the answer, then reports each
   screen where he stopped, guessed or asked "but how?", marked STUCK, MISSING (context), AMBIGUOUS, TRICK
   (give-away or unfair) or WRONG-MATH. It's also worth asking him to mark TOO-BASIC, NO-BRIDGE and BORING,
   since those were Atheeb's own complaints. Fix every one. The first round finds 10–15 real problems a
   lesson; never skip it.
4. **Fresh reader, round 2** on the fixed lesson. Modules 2.1 and 3.1 needed three or four rounds; keep going
   while a reader still finds real problems.
5. **Thread check** across the module: the practice business's numbers and months run in order, and no lesson
   contradicts another.
6. **Arithmetic:** every sum worked again in a script; every option's number checked; scenario totals compared.
7. **Fact-check** by a fresh agent that opens every source; fix or cut each unsupported claim.
8. **Copy**, in one order for lessons and Hot Seats alike:
   - `/anthropic-skills:slopmonster`: run its checker and fix what it finds.
   - `/anthropic-skills:fluent-prose`: join related ideas so a screen reads as one thought, keeping sentences
     short to medium for basic English.
   - ChatGPT in the browser pane (Atheeb is signed in), on all player copy, with the basic-English test.
   - Take what helps, check every ChatGPT change against the facts, keep sentences connected where it chops
     them up, then re-run the slopmonster checker.

   Every line change, even a one-question fix, goes through ChatGPT before it ships or is recorded (31 Oct:
   he caught a fix made without it).
9. **Images** for the lesson (4:3 landscape), then **narration** recorded.
10. **Play it yourself** in `npm run dev` at phone size (390 px), with voice, as a first-timer, checking §9.
    Agents' reports of "ran slopmonster" or "readers passed" are not proof; read the lesson start to finish.
11. Show Atheeb a working module, not a pile of parallel drafts: one module end to end (lessons, images,
    narration, its Hot Seat) before the next.

**Hot Seats** (`docs/AUTHORING.md`)
1. Research brief with opened sources, timeline, the 4–6 real decision points, risks, archive search.
2. Draft to the story rules in §6.
3. **Read every path:** the real path and at least three wrong or mixed paths, start to finish, in
   `/admin/<id>` or `npm run dev`. Fix anything that doesn't follow.
4. **The "nice choices" test** (his Maruti complaint): play picking only what sounds kindest, safest or most
   patriotic; that run must lose trust. It's also worth playing only the bold, long-term options, since the
   story rules say those must not always win either.
5. Copy passes in the same order as lessons. For ChatGPT, paste every line as `[key] text` with the rules
   (keep every fact and number, no new facts, balanced labels, an advisor who gives nothing away) and ask for
   notes on continuity and give-aways.
6. `npm run hotseat:check`, then a **fresh-context fact-check** stamped to the exact file; any later edit means
   re-checking and re-stamping.
7. Media from the archives or ChatGPT, logged in `media.md`.
8. Fresh readers on the decisions too (same Ramesh brief: STUCK, TRICK, BORING, NO-CONTEXT).
9. Record narration, play it in the app with sound, and only then hand it to Atheeb with `draft: true`.

**Daily Calls** (suspended since 30 Oct; for if they return): one decision, about a minute, three options
with exactly one `real`, at least one `great`, and `better` on the others. Add a one-line `realHistory`, at
least one source and at most one image. Only append to the schedule, keep the same company at least a week
apart, and use the same copy passes, no-telegraphing rule and stamped fact-check.

## 11. Final checklist

Before you show Atheeb anything, answer yes to all of these:

- [ ] Would a new Indian player with basic English enjoy it, keep going, and want to pay?
- [ ] Does every lesson teach a named concept that isn't school-level, opened by a real case that teaches it?
- [ ] Does it sound like one teacher talking to one student, with every turn bridged and one practice business?
- [ ] Does every question carry its numbers, say what to do, and leave no "but how?"
- [ ] Are options equal in length, free of give-aways, and is the right one in a new position each time?
- [ ] Does every wrong option have a real-mistake reply showing the working, and does a repeat get a summary?
- [ ] Does each Hot Seat move like a story, with context between calls, several right and wrong paths, and
      a "nice choices only" run that loses?
- [ ] Are all facts sourced and fact-checked, with no quotes, logos, invented numbers, "Our estimate" text,
      "case study" or AI/made-up tags?
- [ ] Did every line go through ChatGPT, slopmonster and fluent-prose, and two fresh readers?
- [ ] Is every line recorded in our own voices, with options silent, and did you play it at phone size?
