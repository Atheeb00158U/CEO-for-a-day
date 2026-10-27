import { describe, expect, it } from "vitest";
import { CATALOG, HOT_SEATS } from "@/content/catalog";
import { buildDebrief, callsPerRun, choose, playerOrder, resolveNode, score, startRun, type RunState } from "./engine";
import type { DecisionNode, EndingNode, HotSeat } from "./hotseat-types";

const kodak = HOT_SEATS.kodak;

/** Play Kodak by option id, skipping scenes. Returns the final state and the node it stops on. */
function play(ids: string[]) {
  let s = startRun(kodak);
  const settle = () => {
    let n = resolveNode(kodak, s, s.nodeId);
    while (n.type === "scene") {
      s = { ...s, nodeId: n.next };
      n = resolveNode(kodak, s, n.next);
    }
    return n;
  };
  for (const id of ids) {
    const n = settle() as DecisionNode;
    if (n.type !== "decision") throw new Error(`expected a decision before ${id}, got ${n.id}`);
    s = choose(
      kodak,
      s,
      n,
      n.options.find((o) => o.id === id)!,
    );
  }
  return { s, node: settle() };
}

const d1 = kodak.nodes.d1 as DecisionNode;
const opt = (id: string) => d1.options.find((o) => o.id === id)!;

describe("choose", () => {
  it("clamps meters to 0..100 and floors trust at 0", () => {
    const s: RunState = { ...startRun(kodak), meters: { profit: 98, future: 3 }, trust: 0 };
    const o = { ...opt("unit"), effect: { profit: 50, future: -50, trust: -1 } };
    const next = choose(kodak, s, d1, o);
    expect(next.meters).toEqual({ profit: 100, future: 0 });
    expect(next.trust).toBe(0);
  });

  it("dedupes flags and records the pick", () => {
    const o = opt("unit");
    const s = { ...startRun(kodak), flags: [...(o.effect.flags ?? []), "x"] };
    const next = choose(kodak, s, d1, o);
    expect(new Set(next.flags).size).toBe(next.flags.length);
    expect(next.picks).toEqual([{ nodeId: "d1", optionId: "unit", grade: o.grade, real: !!o.real }]);
  });

  it("tracks whether every pick so far matches the real company", () => {
    expect(play(["shelve"]).s.onRealPath).toBe(true);
    expect(play(["shelve", "shift"]).s.onRealPath).toBe(false);
  });
});

describe("resolveNode", () => {
  it("routes the ending by the Future meter", () => {
    expect(play(["unit", "shift", "network", "reinvent"]).node.id).toBe("legend");
    expect(play(["shelve", "study", "prints", "inkjet"]).node.id).toBe("collapse");
  });

  it("throws on a missing node", () => {
    expect(() => resolveNode(kodak, startRun(kodak), "nope")).toThrow(/missing node nope/);
  });
});

describe("score and the fired rule", () => {
  it("gives 100 for all great calls and a legend ending", () => {
    const { s, node } = play(["unit", "shift", "network", "reinvent"]);
    expect(score(kodak, s, node as EndingNode)).toBe(100);
  });

  it("plays the story ending when trust runs out on the final call (the real Kodak path)", () => {
    const { s, node } = play(["shelve", "study", "prints", "inkjet"]);
    expect(s.trust).toBe(0);
    expect(node.id).toBe("collapse");
    expect(score(kodak, s, node as EndingNode)).toBe(9);
  });

  it("fires you when trust runs out before the final call", () => {
    const { s, node } = play(["shelve", "dismiss", "prints"]);
    expect(node.id).toBe("fired");
    expect(s.picks).toHaveLength(3);
    expect(score(kodak, s, node as EndingNode)).toBe(0);
  });
});

describe("buildDebrief patterns", () => {
  const patterns = (ids: string[]) => buildDebrief(kodak, play(ids).s).patterns.join("\n");

  it("praises a clean run and self-disruption", () => {
    const p = patterns(["unit", "shift", "network", "reinvent"]);
    expect(p).toMatch(/never made a call the board punished/);
    expect(p).toMatch(/compete with your own best product/);
  });

  it("spots a recovery after a costly call", () => {
    const d = buildDebrief(kodak, play(["shelve", "shift"]).s);
    expect(d.recovered).toBe(true);
    expect(d.patterns.join("\n")).toMatch(/fixed course/);
  });

  it("calls out compounding mistakes, protecting the core and copying history", () => {
    const p = patterns(["shelve", "study", "prints", "inkjet"]);
    expect(p).toMatch(/mistakes compounded/);
    expect(p).toMatch(/protecting what already worked/);
    expect(p).toMatch(/same calls Kodak made/);
  });
});

describe("playerOrder", () => {
  it("is stable per seed and differs across seeds", () => {
    const ids = (seed: string) => playerOrder(CATALOG, seed).map((c) => c.id);
    expect(ids("a")).toEqual(ids("a"));
    expect(ids("a")).not.toEqual(ids("b"));
  });

  it("always starts with two gentle Hot Seats and keeps every one", () => {
    for (let i = 0; i < 500; i++) {
      const order = playerOrder(CATALOG, `seed-${i}`);
      expect(order.slice(0, 2).every((c) => c.complexity <= 2)).toBe(true);
      expect(order.map((c) => c.id).sort()).toEqual(CATALOG.map((c) => c.id).sort());
    }
  });

  it("still returns everything when fewer than two are gentle", () => {
    const items = [
      { id: "x", complexity: 4 },
      { id: "y", complexity: 1 },
      { id: "z", complexity: 5 },
    ];
    const order = playerOrder(items, "s");
    expect(order[0].id).toBe("y");
    expect(order.map((c) => c.id).sort()).toEqual(["x", "y", "z"]);
  });
});

describe("callsPerRun", () => {
  it("counts Kodak's four calls", () => {
    expect(callsPerRun(kodak)).toBe(4);
  });

  it("counts the longest route, not every decision in the tree", () => {
    // d1 branches to d2 or d3; either way a run faces 2 calls, though the tree has 3 decisions.
    const to = (next: string) => ({ ...d1.options[0], next });
    const branching: HotSeat = {
      ...kodak,
      start: "d1",
      nodes: {
        d1: { ...d1, options: [to("d2"), { ...to("d3"), id: "other" }] },
        d2: { ...d1, id: "d2", options: [to("ending_route")] },
        d3: { ...d1, id: "d3", options: [to("ending_route")] },
        ending_route: kodak.nodes.ending_route,
        legend: kodak.nodes.legend,
        survivor: kodak.nodes.survivor,
        collapse: kodak.nodes.collapse,
      },
    };
    expect(callsPerRun(branching)).toBe(2);
  });
});
