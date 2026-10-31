// After `npm run build`: fails if any answer reached the browser. Every option's "why" and "takeaway" text
// (Hot Seats and Daily Calls, drafts included), and every lesson exercise's "why", "wrong" and scenario outcome,
// must appear nowhere under .next/static, nor in the prerendered player pages (/ and /app). /admin is left out: it shows every answer, behind its password.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { hotSeatIds, lessonFileIds, readDailyPool, readHotSeat, readLesson } from "../src/lib/content-files.ts";

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|json|html|txt)$/.test(f)) files.push(p);
  }
};
walk(".next/static");
for (const f of ["app.html", "app.rsc", "index.html", "index.rsc"]) files.push(join(".next/server/app", f));
const bundle = files.map((f) => readFileSync(f, "utf8")).join("\n");

const secrets = [];
for (const hs of hotSeatIds().map(readHotSeat))
  for (const n of Object.values(hs.nodes))
    if (n.type === "decision") for (const o of n.options) secrets.push([hs.id, o.why], [hs.id, o.takeaway]);
for (const c of readDailyPool().calls) for (const o of c.options) secrets.push([c.id, o.why], [c.id, o.takeaway]);
for (const l of lessonFileIds().map(readLesson))
  for (const s of l.screens) {
    if ("why" in s) secrets.push([l.id, s.why]);
    if (s.kind === "choice") for (const w of Object.values(s.wrong ?? {})) secrets.push([l.id, w]);
    if (s.kind === "scenario") for (const o of s.options) secrets.push([l.id, o.why], [l.id, o.outcome]);
  }

const leaks = secrets.filter(([, text]) => text.length > 20 && bundle.includes(JSON.stringify(text).slice(1, -1)));
if (leaks.length) {
  console.error(`✗ ${leaks.length} answers are in the browser bundle, for example:`);
  for (const [id, text] of leaks.slice(0, 5)) console.error(`  ${id}: ${text.slice(0, 80)}`);
  process.exit(1);
}
console.log(`✓ none of ${secrets.length} answers are in ${files.length} bundle files`);
