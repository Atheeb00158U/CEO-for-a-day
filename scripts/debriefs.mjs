// Drafts one personalised debrief per path with Claude, offline. Never runs during gameplay.
//   npm run debriefs -- <id> [--dry-run]
// Writes content/hotseats/<id>/debriefs.json as { "<debriefKey>": { text, reviewed: false } }, saving after each path,
// so a stopped run picks up where it left off. The app shows a draft only after a person sets reviewed to true.
// Needs ANTHROPIC_API_KEY (or an `ant auth login` profile). --dry-run prints the first prompt and calls nothing.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { HOTSEATS_DIR, hotSeatIds, readHotSeat } from "../src/lib/content-files.ts";
import { buildDebrief, debriefKey, findOption, score } from "../src/lib/engine.ts";
import { checkHotSeat, walkRuns } from "../src/lib/hotseat-check.ts";

const MODEL = "claude-opus-5-5";
const [id, flag] = process.argv.slice(2);
const dryRun = flag === "--dry-run";
if (!hotSeatIds().includes(id)) {
  console.error(`Usage: npm run debriefs -- <id> [--dry-run]. Have: ${hotSeatIds().join(", ")}`);
  process.exit(1);
}
const errors = checkHotSeat(join(HOTSEATS_DIR, id)).errors;
if (errors.length) {
  console.error(`Fix hotseat:check errors first:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

const hs = readHotSeat(id);
const out = join(HOTSEATS_DIR, id, "debriefs.json");
const saved = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const todo = walkRuns(hs).runs.filter((r) => !saved[debriefKey(r.state.picks)]);

// The same for every path, so it is cached after the first call.
const system = `You write the end-of-game debrief for "CEO For A Day", a learning game for wannabe and struggling entrepreneurs in India.
The player sat in the hot seat of a real company and made its big calls. You get the Hot Seat facts once, then one player's path.

Write for that player:
- 90 to 140 words, two or three short paragraphs, speaking to the player as "you".
- Simple English: short words, short sentences. Many readers have basic English.
- Say what their pattern of calls was, what it cost or won them, and one habit to take into their own business.
- Facts about the real company come only from the facts below. Never invent numbers, dates or quotes, and never put words in a real person's mouth.
- When their path differs from what really happened, say the outcome is an estimate.
- Never say "case study". Call it a Hot Seat if you need a name.
- Plain text only: no headings, lists or markdown.

Hot Seat facts:
${JSON.stringify(
  {
    company: hs.company,
    role: hs.role,
    years: hs.years,
    realHistory: hs.realHistory,
    realEnding: hs.realEnding,
    decisions: Object.values(hs.nodes)
      .filter((n) => n.type === "decision")
      .map((n) => ({
        year: n.year,
        title: n.title,
        question: n.question,
        options: n.options.map((o) => ({ label: o.label, grade: o.grade, realCompanyChoice: !!o.real, why: o.why, better: o.better })),
      })),
  },
  null,
  1,
)}`;

function prompt({ state, ending }) {
  const calls = state.picks.map((p) => {
    const { node, option } = findOption(hs, p);
    return `${node.year} · ${node.title}: chose "${option.label}" (${option.grade}${option.real ? ", what the real company did" : ""}). Why: ${option.why}${option.better ? ` Better: ${option.better}` : ""}`;
  });
  const d = buildDebrief(hs, state);
  return `The player's calls:
${calls.join("\n")}

Ending: ${ending.title} (${ending.tier}). CEO score: ${score(hs, state, ending)}/100. Board trust left: ${state.trust}/${hs.startTrust}.
Pattern notes from the game: ${d.patterns.join(" ") || "none"}

Write this player's debrief.`;
}

console.log(`${hs.company}: ${todo.length} paths to draft (${Object.keys(saved).length} already saved).`);
if (dryRun) {
  if (todo[0]) console.log(`\n--- system ---\n${system}\n\n--- first path: ${debriefKey(todo[0].state.picks)} ---\n${prompt(todo[0])}`);
  process.exit(0);
}

const client = new Anthropic({ maxRetries: 5 });
for (const [i, run] of todo.entries()) {
  const key = debriefKey(run.state.picks);
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high" },
    // If a safety classifier declines, the API reruns the request on a suitable fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt(run) }],
  });
  if (res.stop_reason === "refusal") {
    console.warn(`${i + 1}/${todo.length} ${key}: declined (${res.stop_details?.category ?? "no category"}), skipped`);
    continue;
  }
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  saved[key] = { text, reviewed: false };
  writeFileSync(out, JSON.stringify(saved, null, 2) + "\n");
  console.log(`${i + 1}/${todo.length} ${key} (${res.model}, ${res.usage.output_tokens} tokens out)`);
}
console.log(`Done. Review content/hotseats/${id}/debriefs.json and set "reviewed": true on each draft you approve.`);
