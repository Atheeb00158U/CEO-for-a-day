# Learning layer for CEO For A Day: "learn, then test"

Research notes and a recommended design. Date: 30 Oct 2026.
Confidence labels: **[src]** = stated in a linked source; **[obs]** = widely observed app behaviour / my product knowledge, not verified this session; **[rec]** = my recommendation.

---

## 1. What the best apps do well

### Duolingo
- **One linear path, grouped into units.** The 2022 redesign replaced the skill tree with a single path; each circle is a "level", lessons are grouped into small units with a header naming the new concepts, and a "guidebook" sits on the unit header. Practice sessions and Stories sit *on* the path as forward progress, and the order is deliberately spaced: "revisit a concept soon after first learning it, then gradually wait longer". [src] https://blog.duolingo.com/new-duolingo-home-screen-design
- **Lesson size.** Usually ~15 exercises per lesson (range 1–18), about 3–5 minutes. [src, fan data] https://duolingodata.com/dat/dafen47.html
- **Exercise mix** [obs]: tap-the-word-bank to build a sentence, pick the matching picture, match pairs, fill the gap, listen and type, speak. Almost no "reading screens": new items are introduced *inside* an exercise (a new word gets a highlighted "NEW WORD" tag and you are asked to use it immediately).
- **Feedback** [obs]: a bottom sheet slides up, green or red, with the correct answer and a single "Continue" button. Missed items come back at the end of the same lesson until you get them right.
- **Explain My Answer.** Launched in Max (GPT-4) in 2023, later made free: after an exercise you can ask *why* you were right or wrong. Roleplay (scripted-but-open conversation) stays paid. [src] https://blog.duolingo.com/duolingo-max , https://blog.duolingo.com/ko/guide-to-duolingo-practice-hub
- **Practice Hub.** A separate tab with "Mistakes" review ("review previous mistakes, so they won't trip you up next time") and personalised practice; once a paid feature, now partly free. [src] guide above.
- **Legendary.** An optional harder re-run of a whole unit, no hints, limited mistakes; it turns the unit gold. Gives mastery-seekers something to do without slowing everyone else. [src] home-screen blog above.
- **Spacing engine.** Half-life regression (Settles & Meeder, ACL 2016) predicts each item's memory half-life; it roughly halved the error of the Leitner system it replaced. [src] https://blog.duolingo.com/how-we-learn-how-you-learn , https://aclanthology.org/P16-1174
- **Lesson for us:** teaching happens through questions, not before them; review is placed on the path, not hidden in a menu; mastery is optional.

### Airlearn (Unacademy)
- Same family as Duolingo: short lessons, XP, weekly leagues, spaced repetition and progress tracking, with a "clean & minimalist" UI. [src] https://apps.apple.com/in/app/unacademy-learn-a-language/id6479639235 , https://alternativeto.net/software/airlearn/about/
- A hands-on review notes there is no long theory intro: you interact with phrases almost at once, and sessions are built to be short. [src] https://www.thinkinitalian.com/app-review/airlearn
- Strong on cultural notes (history, customs, local expressions). **Lesson for us:** Indian context (kirana, chai stall, UPI, Diwali rush) is not decoration; it is the hook.

### Brilliant
- "Learn by doing": lessons are sequences of interactive problems, each opening with a 2–4 sentence concept intro plus an illustration or animation; follow-up problems grow harder and move toward real-world use. Learners are often asked to try before being shown the method. [src] https://brilliant.org/help/why-brilliant , https://skillscouter.com/brilliant-review-math-science-coding/
- [obs] Lessons are ~10–20 screens, 5–15 min, one big idea each, with manipulable widgets (sliders, draggable blocks) and a "Why?" explanation behind every answer.
- **Lesson for us:** the slider/simulation is the killer format for business (price vs. demand, cost vs. profit). A "try first" question before the rule makes the rule stick (generation effect).

### Imprint
- Turns non-fiction books into tap-left/right screen sequences of short concept cards with custom illustrations; lessons are about 2 minutes; a "Review and Remember" quiz screen checks recall. [src] https://imprintapp.com/why-trust-imprint , https://nibble-app.com/blog/imprint-review (competitor review), https://screensdesign.com/showcase/imprint-learn-visually
- [obs] One sentence per screen, big visual metaphor, chapter = one principle.
- **Lesson for us:** this is the closest template for the "interactive book". One idea, one picture, one sentence. But Imprint is light on practice; we add the doing.

### Headway / Blinkist / Uptime
- Headway: main ideas of a book in under 15 minutes, text + audio; a 3-minute daily "tap through" of ideas from 10 books. [src] https://en.wikipedia.org/wiki/Headway_(app)
- Uptime: 5-minute "hacks" from books, podcasts, courses, documentaries; the free tier gets one daily hack that Uptime picks. [src] https://www.techradar.com/computing/websites-apps/uptime
- [obs] Blinkist: ~15 "blinks" per book, each a short page, audio for every title.
- **Lesson for us:** summaries are pleasant but passive; users report "read it, forgot it". Their good parts: a daily curated drip, audio, and a strong "key idea" headline per card. Their weak part is exactly what our Hot Seats and flashcards fix.

### Quizlet and Anki
- Quizlet Learn: adaptive; tracks what you know, retests mistakes, missed terms come back more often; mixes multiple choice, written and matching; a round ends when every term is right (often twice in a row). Cross-day scheduling is not well documented. [src, mixed quality] https://avc.com/?p=16069 , https://www.notelyn.com/es/blog/quizlet-spaced-repetition
- Anki: true multi-day spaced repetition. Now offers **FSRS** next to the older SM-2. FSRS defaults were trained on ~700M reviews; Anki's docs say users need fewer reviews for the same retention. The open benchmark has FSRS beating SM-2 on log loss in ~99.6% of collections, with simulated savings of ~20–30% fewer reviews at the same retention. [src] https://faqs.ankiweb.net/what-spaced-repetition-algorithm , https://en.wikipedia.org/wiki/Anki , https://www.diane.app/en/guides/fsrs-vs-sm2
- **Lesson for us:** Quizlet's in-session "repeat until right" is great for a lesson's end; Anki/FSRS-style scheduling is right for the across-days deck.

### Mimo / Sololearn
- Mimo: sells "5 minutes a day"; thousands of bite-size exercises organised by concept and project (Python path: 2,600+ exercises, 53 concepts, 32 projects). [src] https://apps.apple.com/fi/app/mimo-learn-coding-ai-platform/id1133960732
- Sololearn: short lessons with in-lesson quizzes, fill-the-blank, drag lines into order, a code playground and "Code Coach" challenges. [src] https://apps.apple.com/us/app/sololearn/id1210079064 , https://applevis.com/comment/185999
- **Lesson for us:** concept lessons, then a *project* that uses several concepts = our unit → Hot Seat. "Drag to order" works well on phones for processes.

### Elevate
- [obs, not verified this session] 2–3 minute game-like drills, 3 per daily session, chosen per user from skill scores; strong post-game "here's what improved" screens. **Lesson for us:** a daily mixed session of tiny drills is a good model for the Notes-tab review.

### Learning science (short)
- **Practice testing and distributed practice** are the only two of ten techniques rated "high utility" by Dunlosky et al. (2013); interleaving, self-explanation and elaborative interrogation are "moderate". [src] https://www.questionmark.com/only-two-out-of-ten-learning-techniques-have-high-utility/ (doi:10.1177/1529100612453266)
- **Desirable difficulties** (Bjork, 1994): retrieval, spacing, interleaving and generating answers feel harder and help long-term memory, but massed study looks better on an immediate test, and difficulties become *undesirable* if learners lack the background to handle them. [src] https://www.psychologicalscience.org/observer/desirable-difficulties , https://en.wikipedia.org/wiki/Desirable_difficulty
- **Worked examples, then problems; fade the help.** Worked examples reduce load for novices; as skill grows they stop helping (expertise reversal), so fade them step by step into full problems. [src] https://en.wikipedia.org/wiki/Worked-example_effect , https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples
- **Low-literacy readers:** dense "walls of words" make people skip or grind; keep to about 8th-grade level (comprehension of 8th-grade text is the same on mobile and desktop, harder text slows mobile readers); hierarchical navigation is hard; icons/audio alone don't fix it, testing with real users does. [src] https://odphp.health.gov/healthliteracyonline/2016/what-we-know/full/ , https://contentdesign.intuit.com/accessibility-and-inclusion/readability/

---

## 2. Recommended lesson anatomy

### Shape [rec]
- **One principle per lesson.** Title is the principle in ≤6 words ("Price for value, not cost").
- **8–12 screens, 3–5 minutes.** Teaching screens ≤ 1/3 of the lesson; at least 2/3 are things the player does.
- **≤ 50 words per teaching screen** (was 25; raised 31 Oct 2026 so a teacher can talk, not list facts), one picture, one bold key line. Sentences ≤ 12 words. Words a 12-year-old knows; business terms (margin, cash flow) introduced once, with a picture, then reused.
- **Same order every time**, so the player's brain spends effort on the idea, not the format.

### Screen order (10-screen example: "Margin")
| # | Screen | Purpose |
|---|---|---|
| 1 | **Hook story** (image + 1–2 lines, narrated): "Ravi sells 200 samosas a day. He is still broke." | Curiosity, Indian context |
| 2 | **Guess first** (tile choice, no penalty, no hearts): "Why is Ravi broke?" | Generation / pretest; wrong is fine |
| 3 | **The idea** (one card, one bold line + simple picture): "Margin = what you keep from each sale." | Teach |
| 4 | **Worked example** (tap to reveal each step): ₹20 price − ₹17 cost = ₹3 kept | Worked example |
| 5 | **Faded example** (one step blank): price ₹25, cost ₹17, kept ₹__ | Fade the help |
| 6 | **Practice 1** (easy, same context) | Retrieval |
| 7 | **Practice 2** (new context: a tailor, an app) | Transfer |
| 8 | **Practice 3** (mixes in last lesson's idea) | Interleaving |
| 9 | **Practice 4: mini-scenario** ("You are Ravi. What do you change?") | Bridge to Hot Seat |
| 10 | **Takeaway card** ("Saved to Notes" + flashcard created) + XP | Encode + feed review deck |

Missed items reappear once before the takeaway card (Quizlet/Duolingo "repeat until right"), without a second heart loss.

### Feedback on every answer
Mirror the Hot Seat rule: a bottom sheet with **what happened** (one line of story), **why** (one line), and for wrong answers **what works** (one line). A small "Why?" chip expands a pre-authored 2–3 line explanation (our offline version of Explain My Answer; no live LLM).

### Hearts in lessons
Don't spend Board trust hearts in lessons. Lessons are the safe place to be wrong; Hot Seats are where it costs. [rec] Optional: lesson "stars" (3 / 2 / 1 by first-try accuracy) only for vanity.

### 12 exercise types that fit business principles on a phone
Ranked roughly by how often to use them.
1. **Pick the best move** (2–4 answer tiles). The default. Every option is a plausible thing a real owner would do.
2. **Which price?** (tap one of 3 price tags, or a slider) with instant profit/footfall result. Pricing, margin, discounting.
3. **Slider sim**: drag one lever (price, ad spend, stock), watch 1–2 numbers move (sales, profit) on a tiny chart. Then "set it to make the most profit". Brilliant-style; best format for trade-offs.
4. **Spot the mistake**: a 3–4 line story or a mini bill/ledger; tap the line that is wrong. Great for cash flow, contracts, hiring.
5. **True or false, then why**: tap T/F, then pick one of 2 reasons. Catches lucky guesses; cheap to author.
6. **Fill the gap** (word bank, never typing): "Cash ___ is money coming in and going out." Typing is hard for low-English users; word banks are not.
7. **Drag to order**: steps of a process (test → launch → scale), or rank 4 costs biggest to smallest.
8. **Sort into buckets**: swipe/drag cards into two piles (fixed cost vs. variable cost; need vs. want; customer vs. competitor). Fast, physical, great for categories.
9. **Quick sum with tiles**: "₹500 revenue, ₹350 costs, profit?" answer by tapping one of 3 numbers. Keep maths to one step.
10. **Match pairs**: term ↔ picture/meaning, or company ↔ the move it made. Good as a review warm-up.
11. **Who's right?** Two characters (e.g. the owner and the advisor) argue; pick who is right. Uses the existing narrator/advisor voices; feels like story.
12. **Mini-scenario** (2–3 linked choices, 60–90 s): a tiny branching story using only this lesson's idea. This is a Hot Seat in miniature and the last practice screen of most lessons.

Avoid in v1: free typing, speaking, open answers, multi-step maths, anything needing a keyboard.

### Hand-off to a Hot Seat [rec]
- A **unit** = 3–5 lessons on related principles, then the unit's **Hot Seat** = the test, where the principles appear without labels inside a real company's story.
- On the Hot Seat intro, show a strip: "You'll need: Margin, Price for value, Cash flow" (chips linking back to the lessons). Do *not* say which decision uses which principle; recognising that is the skill.
- In the Hot Seat's choice feedback, tag the principle ("This is *Margin* again"), with a "Review lesson" link on bad picks.
- The Hot Seat result screen shows **principles you used well / missed**. Missed ones go straight into the review deck with a higher priority and into the Mistake journal.
- Lessons are *recommended* before the Hot Seat, not forced for players who want to jump in: a "Test out" option lets anyone open the Hot Seat directly; scoring well marks the unit's lessons as "passed" (Duolingo jump-ahead logic). Keep the first two gentle Hot Seats reachable fast for onboarding.

---

## 3. Course map / path UX

### Layout [rec]
One vertical, scrolling path on Home (Duolingo style, our own art), top to bottom:

```
Unit 1 header: "Make money from day one"   [Cheat sheet]
  ○ Lesson: What is profit
  ○ Lesson: Margin
  ○ Lesson: Price for value
  ◇ Practice (mixed review of the unit, 2 min)
  ○ Lesson: Cash flow
  ★ HOT SEAT: Maggi (big node, cover image)
  🏆 Legendary (optional, after Hot Seat)
Unit 2 header: ...
```

- **Units** have a plain-language goal title, a colour, and a "Cheat sheet" button.
- **Nodes**: lessons are small round nodes; a mid-unit **Practice** node (mixed retrieval of earlier lessons, including previous units) gives spacing on the path itself; the **Hot Seat** is a bigger node with a cover image; **Legendary** replays the Hot Seat on hard mode (no hints, 2 hearts, no Hindsight) for a gold unit badge.
- **Checkpoint** every 3–4 units: a mixed 2–3 minute quiz plus a short "Rapid Hot Seat" (3 decisions) drawing on all units since the last checkpoint. Interleaving is strongest here.
- The **Daily Call** stays above the path on Home. Once a player has lessons done, the Daily Call can be chosen to touch a principle they have learned (spacing for free).

### What unlocks what [rec]
- Lessons unlock in order within a unit; the Hot Seat unlocks after the last lesson **or** via "Test out".
- The next unit unlocks when the Hot Seat is **finished** (any score; even fired). Requiring a good score blocks beginners and kills the streak. A low score instead adds a "Review" node and nudges a replay.
- Keep the owner's rule: the first two Hot Seats are gentle. Put them as Unit 1 and Unit 2 Hot Seats. The seeded-random order still applies *within* tiers if you want, but a learning path implies a fixed order of principles; recommend **fixed principle order, Hot Seat chosen from a small pool tagged to the unit's principles** so players still get variety.
- Existing published Hot Seats without lessons can sit in a "Free play" shelf (or as "Bonus" nodes), so nothing is lost while the course is written.

### How existing systems apply [rec]
- **XP:** lesson 10 XP (+5 for perfect), Practice node 10, Hot Seat as today, Legendary bonus, review session 5–10. Keep Hot Seats the biggest XP so they stay the main event.
- **Streak:** any one of: a lesson, a review session, the Daily Call, or a Hot Seat counts. A 2-minute review session must be enough to save a streak (Duolingo's insight: the easiest qualifying action protects retention).
- **Quests:** add learning quests: "Finish 2 lessons", "Review 15 cards", "Get 5 right in a row", "Score 2 stars on a Hot Seat after its lessons". Avoid quests that reward speed-grinding easy lessons.
- **Leagues:** XP from all sources counts. Cap review XP per day (e.g. first 50 XP) so leagues aren't won by farming flashcards.
- **Hearts (Board trust):** stay a Hot Seat mechanic only.
- **Server referee:** lesson answers, like Hot Seat answers, must not ship to the phone if lessons award XP that counts in leagues. Same `/api/play` pattern: phone sends picks, server returns verdict. Lesson *teaching* text can ship; *answers and why-text* should not (keeps `check-bundle` meaningful).

---

## 4. Notes-tab learning tools

### 4a. Flashcards (highest value)

**Card format** [rec]
- **Front:** a mini-situation or question, not a definition. "Your chai costs ₹8 to make. You sell at ₹10. Your margin per cup?" or "A big buyer wants 60 days to pay. What's the risk?"
- **Back:** the answer in one line + the principle name + a tiny picture + "From: Lesson *Margin* / Hot Seat *Maggi*".
- **Answering:** for this audience, prefer **tap-to-choose** (2–3 options) over "show answer and self-grade". Self-grading (Again/Hard/Good/Easy) is confusing for beginners and with basic English. Map outcomes automatically: wrong = Again, right but slow (>10 s) = Hard, right = Good, right and fast = Easy. Offer a "Flip card" mode later for confident users.
- **Variants:** each principle has 3–5 authored card variants (different contexts/numbers); the scheduler tracks the *principle*, and shows a different variant each time so players learn the idea, not the card.
- **Sources of cards:** each lesson's takeaway creates 1–2 cards; each Hot Seat creates cards for principles the player missed; players can "star" any takeaway to add it.

**Algorithm: FSRS** [rec]
- Use **FSRS** (open source; maintained TypeScript implementation `ts-fsrs` exists [obs]) with default parameters, target retention **0.85–0.9**.
- Why FSRS over SM-2: better prediction on the largest open benchmark, ~20–30% fewer reviews for the same retention (fewer, shorter sessions matter for a casual audience); handles late/missed days gracefully (common for our players, where SM-2 punishes or ignores lateness); no "ease hell" where a card gets stuck at short intervals; per-user parameter optimisation can be added later once there is data. Duolingo-style half-life regression is good but needs our own training data and ML work; FSRS gives most of the benefit today.
- Why not plain Leitner boxes: simplest, but Duolingo found HLR roughly halved Leitner's error, and FSRS costs little more to implement.
- Store per card: `stability, difficulty, due, lastReview, reps, lapses` on the server for signed-in players (localStorage for guests), same as the rest of the save.

**Daily count** [rec]
- **"Daily 10":** one review session = up to 10 due cards, ~2 minutes. Max 20 reviews/day plus **new cards ≤ 5/day**, auto-fed from finished lessons.
- If the backlog grows (player away), **never show "143 due"**. Show "Today's 10", pick the most overdue/lowest-retrievability, and let the rest roll. Backlog numbers are the main reason people quit Anki.
- Put a "Review (2 min)" card at the top of Notes and as a light nudge on Home when cards are due; it can be part of the existing 9 am notification budget, not an extra notification.

### 4b. Other tools, ranked by value vs. effort

| Rank | Tool | What it is | Value | Effort |
|---|---|---|---|---|
| 1 | **Mistake journal** | Auto-list of every wrong pick (lesson or Hot Seat): what you chose, what works, the principle. "Practice my mistakes" turns it into a 5-question quiz. Duolingo's Mistakes review. | High: most personal, uses data we already have | Low |
| 2 | **Principle library** | Every learned principle as one card: name, one-line rule, picture, a real example (company from a Hot Seat), "Seen in: Maggi, Maruti". Locked ones shown greyed. Becomes the "book's index". | High: makes progress visible, aids revision | Low–Med |
| 3 | **Unit cheat sheet** | One-screen summary per unit: 3–5 principles, one line each, plus "watch out for" line. Shareable as an image (WhatsApp is a real growth loop in India). | High (and marketing) | Low |
| 4 | **Quick quiz / Speed round** | 60-second timed sorting or T/F drill across all learned principles (Elevate-style). Interleaved, fun, good streak-saver. | Med–High | Med |
| 5 | **"Use it on my business" prompts** | After a unit: 2–3 tap-to-answer questions about the player's own idea (from onboarding answers): "What does one sale cost you?" Saved in Notes. Turns learning into action for aspiring founders. | Med–High for this audience | Med |
| 6 | **Glossary** | Plain-word meanings of business terms with a picture and audio, later in Hindi/Tamil/Bengali. | Med (essential once i18n starts) | Low |

Skip for now: user-made decks, sharing decks, AI tutor chat (conflicts with no-live-LLM rule), notes editor.

---

## 5. Pitfalls to avoid

1. **The lesson becomes a book.** Three teaching screens in a row loses low-literacy readers. Rule: never more than 2 teaching screens before a tap-to-answer screen. If a lesson needs more, split it.
2. **Walls of words, hidden jargon.** Run every screen through a word count (≤25) and a reading-level check; write terms once with a picture. Test with 5 real players before shipping a unit; don't assume icons fix it.
3. **Narration fatigue.** Auto-playing a voice on every screen slows fast readers and annoys in public. Narrate the hook (screen 1) and the takeaway; make the rest tap-to-play (speaker icon), remember the player's choice, and keep each line under ~8 s. Mute should be one tap and sticky. Silent-mode on Indian phones in public places is the default case.
4. **Busywork questions.** "Margin means: (a) what you keep (b) a banana" teaches nothing. Every wrong option should be a mistake a real owner makes; the feedback is where the teaching happens.
5. **Quiz that only tests the screen before it.** Immediate repeat feels like learning but fades. Always include one item from an earlier lesson (interleave) and push cards into spaced review.
6. **Lessons feel like homework before the fun.** Hot Seats are the hook. Never force a long course before the first Hot Seat; let onboarding go straight to a gentle Hot Seat, then show "Learn why that worked" lessons. Keep "Test out".
7. **Review backlog guilt.** Hide due counts above 10; never punish missed review days; streak savers must be cheap.
8. **Maths anxiety.** One-step sums, round numbers, rupees, tap-to-choose answers. Show the working on the feedback sheet.
9. **Gamification that rewards grinding.** Cap review XP in leagues; quest for accuracy and variety, not volume.
10. **Mixing up hearts.** If lessons cost Board-trust hearts, players will avoid learning to save hearts for Hot Seats. Keep hearts out of lessons.
11. **Same format fatigue.** Rotate at least 4 exercise types per lesson; no type more than 3 times in a row; keep one "surprise" (slider or sort) per lesson.
12. **Unverified "facts" in lessons.** Lessons that cite real companies need the same fact-check pipeline as Hot Seats (`docs/AUTHORING.md`); principle-only lessons with invented characters (Ravi's samosa stall) avoid most of that cost and should be the default.
13. **Leaking answers.** If lessons award league XP, treat lesson answers like Hot Seat answers (server-only), or the leaderboard is open to cheating.

---

## Sources (consolidated)
- Duolingo path redesign: https://blog.duolingo.com/new-duolingo-home-screen-design
- Duolingo lesson counts (fan data): https://duolingodata.com/dat/dafen47.html
- Duolingo Max: https://blog.duolingo.com/duolingo-max ; Practice hub: https://blog.duolingo.com/ko/guide-to-duolingo-practice-hub
- Duolingo HLR: https://blog.duolingo.com/how-we-learn-how-you-learn ; https://aclanthology.org/P16-1174
- Airlearn: https://apps.apple.com/in/app/unacademy-learn-a-language/id6479639235 ; https://www.thinkinitalian.com/app-review/airlearn ; https://alternativeto.net/software/airlearn/about/
- Brilliant: https://brilliant.org/help/why-brilliant ; https://skillscouter.com/brilliant-review-math-science-coding/
- Imprint: https://imprintapp.com/why-trust-imprint ; https://screensdesign.com/showcase/imprint-learn-visually ; https://nibble-app.com/blog/imprint-review
- Headway: https://en.wikipedia.org/wiki/Headway_(app) ; Uptime: https://www.techradar.com/computing/websites-apps/uptime
- Quizlet Learn: https://avc.com/?p=16069 ; https://www.notelyn.com/es/blog/quizlet-spaced-repetition
- Anki / FSRS: https://faqs.ankiweb.net/what-spaced-repetition-algorithm ; https://en.wikipedia.org/wiki/Anki ; https://www.diane.app/en/guides/fsrs-vs-sm2 ; https://forums.ankiweb.net/t/why-does-fsrs-provide-fewer-review-than-the-original-anki-sm-2/35567
- Mimo: https://apps.apple.com/fi/app/mimo-learn-coding-ai-platform/id1133960732 ; Sololearn: https://apps.apple.com/us/app/sololearn/id1210079064 ; https://applevis.com/comment/185999
- Dunlosky et al. 2013: https://www.questionmark.com/only-two-out-of-ten-learning-techniques-have-high-utility/
- Desirable difficulties: https://www.psychologicalscience.org/observer/desirable-difficulties ; https://en.wikipedia.org/wiki/Desirable_difficulty
- Worked examples / expertise reversal: https://en.wikipedia.org/wiki/Worked-example_effect ; https://en.wikipedia.org/wiki/Expertise_reversal_effect ; https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/worked-and-faded-examples
- Low literacy: https://odphp.health.gov/healthliteracyonline/2016/what-we-know/full/ ; https://contentdesign.intuit.com/accessibility-and-inclusion/readability/ ; https://www.usertesting.com/blog/low-literacy

Gaps: Elevate details and Brilliant per-lesson screen counts are from product knowledge, not verified sources this session; Quizlet's exact Learn-mode algorithm is undocumented.
