# Question rules

Every lesson question passes these before Atheeb sees it. Each rule comes from a real confusion in Module 1
(Oct–Nov 2026). `npm run hotseat:check` catches the ones a script can; the rest are checked by a fresh reader.

## The rules

1. **Plain English on the first read.** Short words, one idea per sentence, no idioms. The reader has basic
   English. *Broke it:* "You have one afternoon to save money. Which do you try first?"
2. **Remove the "how".** If a question asks the player to imagine a change, say it's imagined ("Imagine you
   have a magic wand. You can make one cost 20% cheaper…") or name the real move ("your maker offers ₹30 off
   if you buy 200"). *Broke it:* "Cut which cost by 20%?" (the player got stuck on how).
3. **Carry the numbers.** A question repeats every number it needs, even if the last screen said it. The
   player can't scroll back. *Good:* "Your gym has ₹3 lakh and loses ₹50,000 a month…"
4. **Say what to do.** Sort and order screens say the task in a sentence: "I'll show you six things. For each
   one, tell me: can you spend it today?" Bucket labels answer that exact question. *Broke it:* a sort with
   "Can pay now / Can't pay yet" took 6–7 minutes to understand.
5. **Every wrong option gets its own reply.** Name what the player probably did ("I see what you did: ₹3 lakh
   divided by ₹1.5 lakh") and show the right working. Never just "Wrong".
6. **Each wrong option is a real mistake.** A distractor is what a beginner would actually think, not a joke
   answer. If nobody would pick it, replace it.
7. **The facts stop where the source stops.** No invented numbers inside a real story. *Broke it:* an iD Fresh
   question claimed a target number its source doesn't give.
8. **The real story teaches this lesson's concept.** Check the match before writing. *Broke it:* Jet Airways
   used for "profit on paper"; it's a runway story.
9. **Bridge every turn.** Story → your business is said out loud ("Jet had planes and crores of rupees, but
   the same problem can close a small shop too…"). One made-up business for all of a lesson's practice.
10. **Not school-level.** If a school-leaver would say "I know this", it's a one-line aside, not a question.
11. **The player drives.** Scenario outcomes start from *their* pick. Wrong picks are never "corrected" by the
    next screen.
12. **No sums hidden inside a story question.** A sum question looks like a sum; a judgement question has
    no tricky arithmetic.

## The review, for every new lesson

1. `npm run hotseat:check`: no warnings on the lesson (word limits, missing wrong-replies, sort/order
   instructions, idioms).
2. **Fresh reader.** A fresh-context agent reads the lesson screen by screen as a small Indian shop owner with
   basic English and answers every question before seeing the answer. It reports each screen where it
   stopped, guessed, or asked "but how?". Fix every one, then run a second fresh reader.
3. **Arithmetic.** Every sum is worked again in a script; every option's number is checked.
4. **ChatGPT pass** on all player copy, then slopmonster and fluent-prose on the teaching screens.
5. **Play it** in the app at phone size, with voice, before showing Atheeb.
