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
3. **What happened**: the outcome as story, with media, tagged *Real history* or *Alternate history*.
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

To go further, run a build-time script that enumerates every path (`npm run validate` already does this; Kodak has 79) and asks an LLM **once per path** to write a richer debrief. Store the results keyed by the path (e.g. `shelve>study>network>reinvent`), have a human review them, and ship them as static JSON. Players get LLM-quality personalisation with zero runtime cost and no risk of the model saying something wrong live.

## Authoring rules

- **Three options per decision**: usually one great, one risky, one costly. Never put the correct answer in the same position every time.
- **Every option needs**: outcome, why, takeaway; ok/bad options also need `better`.
- **Real facts only on real paths.** Alternate-history outcomes must read as plausible estimates, and the UI labels them.
- **Use 4–6 decisions per Hot Seat**, so a run takes 5–8 minutes.
- **Validate before shipping**: `npm run validate` walks every path, checks that every ending is reachable, and prints the score range. `npm run treemap -- kodak` prints a Mermaid diagram of the whole tree.
- **Regenerate the voice lines** after editing text: `npm run voices`, then `scripts/narrate.py`. Lines without audio fall back to the browser's voice.

## Ordering ("level planning")

Players don't see difficulty tags. Each Hot Seat has a hidden `complexity` (1–5). The map order is a **seeded shuffle per player**, so no two players get the same order, with one guard: the first two Hot Seats are always gentle (complexity ≤ 2) so new players aren't crushed on day one. Later, replace the shuffle with adaptive ordering based on each player's scores.
