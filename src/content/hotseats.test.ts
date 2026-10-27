// Walks every possible path through every registered Hot Seat and checks the tree is complete.
// Run: npm run validate
import { describe, expect, it } from "vitest";
import { callsPerRun, choose, resolveNode, score, startRun, type RunState } from "@/lib/engine";
import type { EndingNode, HotSeat } from "@/lib/hotseat-types";
import { HOT_SEATS } from "./catalog";

function walkAll(hs: HotSeat) {
  const problems: string[] = [];
  const endings: Record<string, number> = {};
  const scores: number[] = [];
  let paths = 0;
  const calls = callsPerRun(hs);
  const walk = (state: RunState, trail: string[]) => {
    let node = resolveNode(hs, state, state.nodeId);
    while (node.type === "scene") {
      state = { ...state, nodeId: node.next };
      node = resolveNode(hs, state, node.next);
    }
    if (node.type === "ending") {
      if (state.picks.length > calls) problems.push(`path longer than callsPerRun (${calls}): ${trail.join(" > ")}`);
      paths++;
      endings[node.id] = (endings[node.id] ?? 0) + 1;
      scores.push(score(hs, state, node as EndingNode));
      return;
    }
    if (node.type !== "decision") throw new Error(`${hs.id}: unexpected node ${node.id}`);
    if (trail.length > 20) throw new Error(`${hs.id}: path too long, loop? ${trail.join(" > ")}`);
    for (const opt of node.options) {
      for (const k of ["outcome", "why", "takeaway", "label"] as const) if (!opt[k]) problems.push(`${node.id}/${opt.id} missing ${k}`);
      if (opt.grade !== "great" && !opt.better) problems.push(`${node.id}/${opt.id}: ok/bad option needs "better"`);
      walk(choose(hs, state, node, opt), [...trail, `${node.id}:${opt.id}`]);
    }
  };
  walk(startRun(hs), []);
  const unreached = Object.values(hs.nodes)
    .filter((n) => n.type === "ending" && !endings[n.id])
    .map((n) => n.id);
  return { problems, endings, scores, paths, unreached };
}

describe.each(Object.values(HOT_SEATS))("Hot Seat $id", (hs) => {
  it("has a complete tree", () => {
    const r = walkAll(hs);
    console.log(
      `${hs.company}: ${r.paths} possible playthroughs`,
      r.endings,
      `CEO score range ${Math.min(...r.scores)}–${Math.max(...r.scores)}`,
    );
    expect(r.problems).toEqual([]);
    expect(r.unreached, "endings nobody can reach").toEqual([]);
  });
});
