# Writing a Hot Seat or a Daily Call

The same recipe for every story, so we can get to 100 Hot Seats and a new Daily Call every day without losing accuracy. Each step leaves a file behind, so the work can be split up and checked.

Read `HOT-SEAT-DESIGN.md` first for how a Hot Seat plays.

## The house rules
- **Real history is sourced.** Every fact on the real path (dates, numbers, names, events) must be backed by a source someone actually opened.
- **Alternate history is an estimate.** Options the company didn't take are written as plausible stories, never as facts about the real company. The app badges every off-path screen "Our estimate", so the text itself never says so.
- **No quotes from real people**, no logos, no real faces in images.
- **Avoid** companies in active litigation, and stories that turn on a living person's private life. When unsure, flag it for Atheeb.
- **Simple English.** Short words, short sentences. Many players have basic English.
- Never write "case study". A story is a **Hot Seat**; a one-minute story is a **Daily Call**.

## Hot Seat: the six steps

### 1. Research brief → `content/hotseats/<id>/research.md`
A research agent (or a person) searches the web and writes:
- **Sources**, numbered, each opened and read.
- **Timeline**, every line ending in a source number like `[3]`.
- **Decision points**: the 4–6 real CEO-level calls. Each has the situation, three realistic options (including what the company did), what it did and what happened next.
- **What really happened**: the ending.
- **People by role.** Names are allowed here only; never quotes.
- **Archive footage**: search movingimagearchive.com (and archive.org's Moving Image Archive) for public-domain clips first. List what you find with links, or "none found".
- **Risks**: litigation, living people, thin sources.
- **Open questions**: facts that couldn't be confirmed.

### 2. Draft → `content/hotseats/<id>/hotseat.json`
Start from `npm run hotseat:new -- <id>` (it's a draft). Then:
- **Decisions:** 4–6, each with three options, usually one great, one risky and one costly. Move the great one around; it must not always be in the same position.
- **Real call:** exactly one option per decision has `"real": true`, the call the company made.
- **Recovery:** after every costly call there is still a way back. Losing all three hearts before the last call is the only early exit.
- **Real text:** the real options' `outcome` and the `realHistory` use only facts from `research.md`.
- **Path-aware text:** scenes and setups that change with earlier calls use `[{ "when": …, "text": … }]` variants.
- **Endings:** route by the Future meter to legend, survivor and collapse, plus fired. Set `realEnding` to the tier the real company reached.
- **Sources:** list the main sources in `sources`.
- **Story:** follow the *Story rules* in `HOT-SEAT-DESIGN.md`: a person, a goal and a clock up front; each call follows from the last; short beats; no telegraphed answers; off-path text that fits the path.
- **Read every path.** Before the copy passes, play the real path and at least three wrong or mixed paths start to finish (in `/admin/<id>` or `npm run dev`) and fix anything that doesn't follow.

### 2b. Copy (required)
All player-facing text, in Hot Seats and Daily Calls, goes through three passes before the fact-check. One drafting pass is never enough.
1. **slopmonster** (`anthropic-skills:slopmonster`): run its checker on every line of text and fix what it finds.
2. **fluent-prose** (`anthropic-skills:fluent-prose`): join related ideas so it reads as one story, not a list of notes, while keeping words simple and sentences short to medium for readers with basic English.
3. **ChatGPT** in the browser pane (Atheeb is logged in at chatgpt.com): paste every line as `[key] text` with the rules above (keep every fact and number; no new facts; balanced option labels; the advisor doesn't give the answer away) and ask for an edit plus notes on continuity and give-aways. Take what helps, check every change against the facts, and keep sentences connected where it chops them up.

Then run `npm run hotseat:check` and `npm run voices` again.

### 3. Check
`npm run hotseat:check -- <id>` must show no errors. A draft may only warn about missing media and audio (and about the fact-check, until step 4). Look at the whole tree at `/admin/<id>`.

### 4. Fact-check → `content/hotseats/<id>/factcheck.md`
A **fresh** agent, given only `hotseat.json` and the sources, checks every factual claim on the real path, plus `realHistory`, opening the sources itself. It also checks that alternate options don't state invented events as fact. The report looks like this:

```
# Fact-check: <id>
checked-sha256: <sha256 of hotseat.json>
Checked: <date> · by: <who>

## Claims
- [supported] <claim> (nodes.d2.options.study.outcome) — [3]
- [unsupported] <claim> — <what was searched>
- [contradicted] <claim> — [5] says …
```

Fix or remove every unsupported or contradicted claim, then change those lines to `[supported]` (with the source) or delete them. Finally, stamp the report with the file's hash:

```bash
shasum -a 256 content/hotseats/<id>/hotseat.json
```

`hotseat:check` errors on a published Hot Seat whose report is missing, stamped for another version of the file, or still has open claims. **Any edit to `hotseat.json` means checking the changes and stamping again.**

### 5. Media → `content/hotseats/<id>/image_prompts.json`
- Use the archive clips from step 1 first: download, then run `npm run media -- <id> <files…>`.
- For every other media name in `hotseat.json`, write one prompt in `image_prompts.json` (`{ "<name>": "<prompt>" }`).
  - **Period-correct:** the year, the place and the technology of the time. For example, no flat screens before about 2000, and Indian settings where the story is Indian.
  - **No people's faces, no logos, no readable brand names.**
- Images are generated on Atheeb's Mac, then added with `npm run media`.
- Media names must be unique across all Hot Seats.

### 6. Review and publish
Atheeb reviews the story in `/admin/<id>` and plays it in `npm run dev`. Then:
1. Record the narration: `npm run narrate`.
2. Optionally draft the per-path debriefs: `npm run debriefs -- <id>`.
3. Set `"draft": false`.

`hotseat:check` must then pass with no errors.

## Daily Call: the short version
- **Research:** one shared `content/daily/research.md` holds the candidates and their sources.
- **Write:** each call is one entry in `content/daily/daily.json`.
  - It has three options: exactly one `real`, at least one `great`, and `better` on the others.
  - Add a one-line `realHistory` and at least one source.
  - At most one image (`media` on the call). Options have none.
- **Schedule:** the order of `calls` is the schedule. Day N after `startDay` plays call N. Only ever append; never reorder or delete calls that have already been played. Keep the same company at least a week apart. `hotseat:check` warns when fewer than 14 days are left.
- **Copy:** the same three copy passes as a Hot Seat (step 2b), and the same no-telegraphing rule for options and the advisor.
- **Fact-check:** one shared `content/daily/factcheck.md` checks every call and is stamped with the hash of `daily.json`. Re-stamp after any edit.
- **Publish:** record the narration with `npm run narrate`, then set `draft: false` on each call.
