// Walks every possible path through every Hot Seat and checks the tree is complete.
// Run: npm run validate   (Node 22.18+ strips TypeScript types natively)
import { kodak } from "../src/content/hotseats/kodak.ts";
import { startRun, resolveNode, choose, score } from "../src/lib/engine.ts";

const HOT_SEATS = [kodak];
let failed = false;

for (const hs of HOT_SEATS) {
  const endings = {};
  const scores = [];
  let paths = 0;
  const walk = (state, trail) => {
    let node = resolveNode(hs, state, state.nodeId);
    while (node.type === "scene") {
      state = { ...state, nodeId: node.next };
      node = resolveNode(hs, state, node.next);
    }
    if (node.type === "ending") {
      paths++;
      endings[node.id] = (endings[node.id] || 0) + 1;
      scores.push(score(hs, state, node));
      return;
    }
    if (node.type !== "decision") throw new Error(`${hs.id}: unexpected node ${node.id}`);
    if (trail.length > 20) throw new Error(`${hs.id}: path too long, loop? ${trail.join(" > ")}`);
    for (const opt of node.options) {
      for (const k of ["outcome", "why", "takeaway", "label"])
        if (!opt[k]) {
          console.error(`✗ ${hs.id}/${node.id}/${opt.id} missing ${k}`);
          failed = true;
        }
      if (opt.grade !== "great" && !opt.better) {
        console.error(`✗ ${hs.id}/${node.id}/${opt.id}: ok/bad option needs "better"`);
        failed = true;
      }
      walk(choose(hs, state, node, opt), [...trail, `${node.id}:${opt.id}`]);
    }
  };
  walk(startRun(hs), []);
  const unreached = Object.values(hs.nodes)
    .filter((n) => n.type === "ending" && !endings[n.id])
    .map((n) => n.id);
  console.log(`\n${hs.company}: ${paths} possible playthroughs`);
  console.log("  endings:", endings);
  console.log(`  CEO score range: ${Math.min(...scores)}–${Math.max(...scores)}`);
  if (unreached.length) {
    console.error("  ✗ endings nobody can reach:", unreached);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
