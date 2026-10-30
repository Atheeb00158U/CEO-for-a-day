// Hot Seat CLI.
//   npm run hotseat:new -- <id>       scaffold content/hotseats/<id>/ from content/templates/hotseat.json (as a draft)
//   npm run hotseat:check [-- <id>]   check one Hot Seat, or all of them (plus the Daily Calls and the course)
//   npm run hotseat:tree -- <id>      write content/hotseats/<id>/tree.mmd (a Mermaid map of the tree)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COURSE_DIR, DAILY_DIR, HOTSEATS_DIR, hotSeatIds, readHotSeat } from "../src/lib/content-files.ts";
import { checkCourse } from "../src/lib/course-check.ts";
import { checkDailyPool, checkHotSeat, mediaCollisions } from "../src/lib/hotseat-check.ts";
import { today } from "../src/lib/game-state.ts";

const [cmd, id] = process.argv.slice(2);

function check(ids) {
  let failed = false;
  for (const x of ids) {
    const r = checkHotSeat(join(HOTSEATS_DIR, x));
    console.log(`\n${r.errors.length ? "✗" : "✓"} ${x}`);
    if (r.stats)
      console.log(
        `  ${r.stats.paths} paths, up to ${r.stats.calls} calls, endings ${JSON.stringify(r.stats.endings)}, CEO score ${r.stats.scores.join("–")}`,
      );
    for (const e of r.errors) console.log(`  error: ${e}`);
    for (const w of r.warnings) console.log(`  warning: ${w}`);
    failed ||= r.errors.length > 0;
  }
  const daily = checkDailyPool(DAILY_DIR, today());
  if (daily.errors.length || daily.warnings.length || daily.daysLeft !== undefined) {
    console.log(
      `\n${daily.errors.length ? "✗" : "✓"} daily calls${daily.daysLeft !== undefined ? ` (${daily.daysLeft} days left after today)` : ""}`,
    );
    for (const e of daily.errors) console.log(`  error: ${e}`);
    for (const w of daily.warnings) console.log(`  warning: ${w}`);
  }
  failed ||= daily.errors.length > 0;
  const course = checkCourse(COURSE_DIR, hotSeatIds());
  if (course.lessons || course.errors.length) {
    console.log(`\n${course.errors.length ? "✗" : "✓"} course (${course.lessons} lessons)`);
    for (const e of course.errors) console.log(`  error: ${e}`);
    for (const w of course.warnings) console.log(`  warning: ${w}`);
  }
  failed ||= course.errors.length > 0;
  const clashes = mediaCollisions([...hotSeatIds().map((x) => join(HOTSEATS_DIR, x)), DAILY_DIR, COURSE_DIR]);
  for (const c of clashes) console.log(`error: ${c}`);
  return failed || clashes.length > 0;
}

function scaffold(id) {
  if (!/^[a-z0-9-]+$/.test(id ?? ""))
    return `Give an id in lower-case letters, numbers and dashes, e.g. npm run hotseat:new -- blockbuster`;
  const dir = join(HOTSEATS_DIR, id);
  if (existsSync(dir)) return `content/hotseats/${id} already exists`;
  const template = readFileSync(new URL("../content/templates/hotseat.json", import.meta.url), "utf8");
  mkdirSync(join(dir, "media"), { recursive: true });
  writeFileSync(join(dir, "hotseat.json"), template.replaceAll("__ID__", id));
  // voice-lines.json must list the new lines, or the voice-lines test fails.
  execFileSync("npm", ["run", "--silent", "voices"], { stdio: "inherit" });
  console.log(`Created content/hotseats/${id}/ as a draft. Next: write it, add media, then npm run hotseat:check -- ${id}`);
}

/** A Mermaid flowchart of the decision map. /admin shows the full path tree in our own style. */
function mermaid(hs) {
  const g = { great: ":::great", ok: ":::ok", bad: ":::bad" };
  const esc = (s) => String(s).replace(/"/g, "'");
  const out = [
    "flowchart TD",
    "classDef great fill:#58cc02,color:#000",
    "classDef ok fill:#ffc800,color:#000",
    "classDef bad fill:#ff4b4b,color:#fff",
  ];
  for (const n of Object.values(hs.nodes)) {
    if (n.type === "scene") out.push(`${n.id}["${n.year} · scene"] --> ${n.next}`);
    if (n.type === "decision") {
      out.push(`${n.id}{"${n.year}: ${esc(n.question)}"}`);
      for (const o of n.options) {
        const oid = `${n.id}_${o.id}`;
        out.push(`${n.id} --> ${oid}["${esc(o.label)}${o.real ? " ★real" : ""}"]${g[o.grade]}`);
        for (const x of typeof o.next === "string" ? [o.next] : o.next.map((r) => r.to)) out.push(`${oid} --> ${x}`);
      }
    }
    if (n.type === "route")
      for (const r of n.routes)
        out.push(`${n.id}{{"final Future meter"}} -->|${r.when ? "Future ≥ " + r.when.minFuture : "else"}| ${r.to}`);
    if (n.type === "ending") out.push(`${n.id}(["END: ${esc(n.title)}"])`);
  }
  out.push(`anyloss(["Board trust hits 0 before the last call"]) --> fired`);
  return out.join("\n") + "\n";
}

const known = () => {
  if (hotSeatIds().includes(id)) return true;
  console.error(`No Hot Seat "${id}". Have: ${hotSeatIds().join(", ")}`);
  return false;
};

if (cmd === "new") {
  const problem = scaffold(id);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
} else if (cmd === "tree") {
  if (!known()) process.exit(1);
  writeFileSync(join(HOTSEATS_DIR, id, "tree.mmd"), mermaid(readHotSeat(id)));
  console.log(`Wrote content/hotseats/${id}/tree.mmd. Paste it into any Mermaid viewer, or open /admin/${id}.`);
} else if (cmd === "check") {
  const ids = id ? [id] : hotSeatIds();
  if (id && !known()) process.exit(1);
  process.exit(check(ids) ? 1 : 0);
} else {
  console.error("Usage: npm run hotseat:new -- <id> | hotseat:check [-- <id>] | hotseat:tree -- <id>");
  process.exit(1);
}
