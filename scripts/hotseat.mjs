// Hot Seat CLI.
//   npm run hotseat:check [-- <id>]   check one Hot Seat, or all of them
import { join } from "node:path";
import { HOTSEATS_DIR, hotSeatIds } from "../src/lib/content-files.ts";
import { checkHotSeat, mediaCollisions } from "../src/lib/hotseat-check.ts";

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
  const clashes = mediaCollisions(hotSeatIds().map((x) => join(HOTSEATS_DIR, x)));
  for (const c of clashes) console.log(`error: ${c}`);
  return failed || clashes.length > 0;
}

if (cmd === "check") {
  const ids = id ? [id] : hotSeatIds();
  if (id && !hotSeatIds().includes(id)) {
    console.error(`No Hot Seat "${id}". Have: ${hotSeatIds().join(", ")}`);
    process.exit(1);
  }
  process.exit(check(ids) ? 1 : 0);
} else {
  console.error("Usage: npm run hotseat:check [-- <id>]");
  process.exit(1);
}
