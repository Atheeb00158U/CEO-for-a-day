# How a Hot Seat works

A **Hot Seat** is one company story where the player is the CEO. Every possible path is written in advance, so there are no surprises and no live AI in the game loop.

## The building blocks

| Piece | What it is |
|---|---|
| **Scene** | A narrated story beat with an image or archive clip. Text can change with the path ("You locked the camera away…" vs "Your digital team was ready…"). |
| **Decision** | A situation, a question, an advisor line, and 3 options. |
| **Option** | The label, a grade (`great` / `ok` / `bad`), whether the real company did it, its effects on the meters, the story of what happens next, **why** it was good or bad, **what would have worked** (for ok/bad), and a one-line takeaway for the notes. |
| **Meters** | Two company gauges that every choice moves. Kodak uses *Profit* (money the old business makes today) and *Future* (how ready the company is for what comes next). |
| **Board trust** | The player's lives (3 hearts). A costly call loses one. Lose all three before the last decision and the board fires you: the run ends early. That's the "fix it until it's too late" mechanic. |
| **Flags** | Memory of earlier choices. Later scenes and outcomes read them to tell a path-aware story. |
| **Endings** | Picked from the final meters: e.g. *Legend* (Future ≥ 70), *Survivor* (≥ 40), *Collapse* (the real Kodak ending), plus *Fired*. |

## The story loop for each decision

1. **Setup**: narrated situation, question, advisor line. The board warns you when you're on your last heart.
2. **Lock it in.**
3. **What happened**: the outcome as story, with media, tagged *Real history*, or *Our estimate* once the player has left the real path. From then on every screen (scenes, setups, the ending) carries the *Our estimate* badge, so the story text never says it.
4. **Verdict sheet**: *Great call* / *Risky call* / *Costly call*, **why**, and **what would have worked**. If the player took a different path from the real company, the screen shows what the company actually did.
5. Optional **Hindsight** power-up: redo this one decision (one per Hot Seat).

## Scoring

- Great call: 25 points, risky: 10, costly: 0 (and −1 board trust).
- CEO score = points ÷ maximum × 85, plus an ending bonus (Legend +15, Survivor +5). The range is 0–100.
- XP = 10 + CEO score, doubled while a 2× booster is active. Finishing also gives 20 coins.

## Personalised takeaways without a live LLM

Every path is known in advance, so the debrief is assembled from:

1. the authored takeaway line for each option the player picked, and
2. pattern lines triggered by the path (no mistakes; recovered after a mistake; mistakes compounded; protected the core; disrupted yourself; made exactly the real company's calls).

To go further, `npm run debriefs -- <id>` enumerates every path (Kodak has 79) and asks Claude **once per path**, offline, to write a richer debrief. The drafts go to `content/hotseats/<id>/debriefs.json`, keyed by the path (e.g. `d1:shelve>d2:study>d3:network>d4:reinvent`), with `reviewed: false`. A person reads each one and sets `reviewed: true`; only then does the app show it, in place of the assembled pattern lines. `hotseat:check` warns about drafts whose path no longer exists after an edit. Players get richer personalisation with zero runtime cost and no risk of the model saying something wrong live.

## Story rules

Players don't know these stories. A Hot Seat has to work like a short story they are living, not a quiz about a company.

- **Open with a person, a goal and a clock.** Two short scenes at most: where you are, what you are in charge of, what you must achieve and what happens if you fail. Give only the numbers the player needs for the first call. Save the rest for later scenes.
- **Every call follows from the last one.** The outcome shows what your choice did. The next scene or setup opens from there: time passes, the next problem shows up, and it is shaped by what you chose. Use flags and `when` variants so each path reads as one story. If the player waited, the next scene says they are behind; if they handed over control, the next problem is about control.
- **Short beats, then a choice.** Scenes and setups about 35–55 words, outcomes about 30–50. If a beat needs more, split it into two scenes. Don't stack facts; keep one or two numbers per screen.
- **Fill in what happened in between.** Most players can't fill the gaps themselves. A bridge scene covers the months between two calls in two or three sentences.
- **No telegraphing.** Every option must look sensible at the time and carry a real cost, written into the label ("…, but it is tiny", "…, even though the wait will be long"). Labels are about the same length. The advisor names the tension or argues one side; it never points at the answer. Don't let the setup end on a question that only one option answers.
- **Several right paths and several wrong ones.** An alternate option can be great too. A later call can rescue an early mistake. Endings and late scenes should have variants for the main paths (for example "you built vans first"), not just "real" and "everything else".
- **Off-path text must fit what the player chose.** Read every path's flags before writing a variant. Use words that fit any path ("your first vehicle", "your partner") in shared variants. A scene's `year` is fixed, so if a choice moves the timeline, route to a different scene node.
- **Say it like a storyteller.** Outcomes are events, not encyclopedia lines: no dollar figures or share percentages unless the story turns on them. Prefer "about a quarter of the company" to "26%".
- **Never write "Our estimate" in the text.** The app badges it.

## Authoring rules

- **Three options per decision**: usually one great, one risky, one costly. Never put the correct answer in the same position every time.
- **Every option needs**: outcome, why, takeaway; ok/bad options also need `better`.
- **Real facts only on real paths.** Alternate-history outcomes must read as plausible estimates. The UI badges them *Our estimate* automatically, based on whether the player is still on the real path; `hotseat:check` flags text that says it again.
- **Use 4–6 decisions per Hot Seat**, so a run takes 5–8 minutes.
- **Start from the template**: `npm run hotseat:new -- <id>` creates `content/hotseats/<id>/hotseat.json` as a draft.
- **Check before shipping**: `npm run hotseat:check -- <id>` checks the schema and links, walks every path, checks that every ending is reachable, that every image, clip and narrated line exists, and prints the score range. `/admin/<id>` shows every path as a tree; `npm run hotseat:tree -- <id>` writes a Mermaid version.
- **Media**: `npm run media -- <id> <files…>` makes 1080 px webp images and ≤ 9 s silent clips. Name them uniquely across Hot Seats.
- **Copy passes are required** for all player-facing text: see *Copy* in `AUTHORING.md`.
- **Regenerate the voice lines** after editing text: `npm run voices` (and `npm run narrate` on Atheeb's Mac). Lines without audio fall back to the browser's voice.

## Ordering ("level planning")

Players don't see difficulty tags. Each Hot Seat has a hidden `complexity` (1–5). The map order is a **seeded shuffle per player**, so no two players get the same order, with one guard: the first two Hot Seats are always gentle (complexity ≤ 2) so new players aren't crushed on day one. Later, replace the shuffle with adaptive ordering based on each player's scores.
