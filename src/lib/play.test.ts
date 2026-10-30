import { describe, expect, it } from "vitest";
import { readHotSeat } from "./content-files";
import { score, startRun, choose, resolveNode } from "./engine";
import { today, weekId } from "./game-state";
import type { DecisionNode, HotSeat } from "./hotseat-types";
import { parsePicks, play, PlayError, type Pick } from "./play";
import { canServe, DAILY_CALLS_ON, servableHotSeat, todaysCall } from "./server/content";

const kodak = readHotSeat("kodak");

/** The picks of a whole run that always takes each decision's first option. */
function firstOptionPath(hs: HotSeat): Pick[] {
  const picks: Pick[] = [];
  for (let v = play(hs, picks); !v.result; v = play(hs, picks)) {
    const d = v.screens.at(-1)!;
    if (d.kind !== "decision") throw new Error("expected a decision");
    picks.push({ nodeId: d.id, optionId: d.options[0].id });
  }
  return picks;
}

describe("play", () => {
  it("starts with scenes and the first decision, and gives no answers away", () => {
    const v = play(kodak, []);
    const last = v.screens.at(-1)!;
    expect(last.kind).toBe("decision");
    expect(v.reveal).toBeUndefined();
    const json = JSON.stringify(v);
    for (const n of Object.values(kodak.nodes))
      if (n.type === "decision")
        for (const o of n.options) {
          expect(json).not.toContain(o.why);
          expect(json).not.toContain(o.takeaway);
        }
    if (last.kind === "decision") for (const o of last.options) expect(Object.keys(o).sort()).toEqual(["id", "label"]);
  });

  it("reveals only the option picked", () => {
    const first = play(kodak, []).screens.at(-1) as Extract<ReturnType<typeof play>["screens"][number], { kind: "decision" }>;
    const pick = first.options[1];
    const v = play(kodak, [{ nodeId: first.id, optionId: pick.id }]);
    const node = kodak.nodes[first.id] as DecisionNode;
    const chosen = node.options.find((o) => o.id === pick.id)!;
    expect(v.reveal).toMatchObject({ nodeId: first.id, optionId: pick.id, grade: chosen.grade, why: chosen.why });
    for (const o of node.options) if (o.id !== pick.id) expect(JSON.stringify(v)).not.toContain(o.why);
  });

  it("rejects a forged node, a forged option and a pick after the ending", () => {
    const first = play(kodak, []).screens.at(-1)!;
    expect(() => play(kodak, [{ nodeId: "nope", optionId: "x" }])).toThrow(PlayError);
    expect(() => play(kodak, [{ nodeId: first.id, optionId: "nope" }])).toThrow(PlayError);
    const done = firstOptionPath(kodak);
    expect(() => play(kodak, [...done, { nodeId: first.id, optionId: "x" }])).toThrow(PlayError);
  });

  it("scores a full run exactly as the engine does", () => {
    const picks = firstOptionPath(kodak);
    const v = play(kodak, picks);
    let s = startRun(kodak);
    for (const p of picks) {
      let n = resolveNode(kodak, s, s.nodeId);
      while (n.type === "scene") n = resolveNode(kodak, s, n.next);
      const d = n as DecisionNode;
      s = choose(
        kodak,
        s,
        d,
        d.options.find((o) => o.id === p.optionId)!,
      );
    }
    const end = resolveNode(kodak, s, s.nodeId);
    expect(end.type).toBe("ending");
    expect(v.result?.score).toBe(score(kodak, s, end.type === "ending" ? end : undefined));
    expect(v.result?.endingId).toBe(end.id);
  });

  it("checks request bodies before they reach the engine", () => {
    expect(() => parsePicks("x")).toThrow(PlayError);
    expect(() => parsePicks([{ nodeId: 1 }])).toThrow(PlayError);
    expect(() => parsePicks(Array.from({ length: 41 }, () => ({ nodeId: "a", optionId: "b" })))).toThrow(PlayError);
    expect(parsePicks([{ nodeId: "a", optionId: "b", grade: "great" }])).toEqual([{ nodeId: "a", optionId: "b" }]);
  });
});

describe("serving content", () => {
  it("plays drafts only in dev", () => {
    expect(canServe({ draft: true }, "production")).toBe(false);
    expect(canServe({ draft: true }, "test")).toBe(false);
    expect(canServe({ draft: true }, "development")).toBe(true);
    expect(canServe({}, "production")).toBe(true);
    expect(servableHotSeat("kingfisher-airlines", "production")).toBeUndefined(); // a draft today
    expect(servableHotSeat("kodak", "production")?.id).toBe("kodak");
  });

  it("serves no Daily Call while they're suspended", () => {
    if (!DAILY_CALLS_ON) expect(todaysCall(today(), "development")).toBeUndefined();
  });

  it("refuses ids that aren't a plain folder name", () => {
    expect(servableHotSeat("../package", "development")).toBeUndefined();
    expect(servableHotSeat("Kodak", "development")).toBeUndefined();
  });
});

describe("one clock (India)", () => {
  it("turns the day over at midnight IST, wherever the phone is", () => {
    expect(today(new Date("2026-10-30T18:29:00Z"))).toBe("2026-10-30"); // 23:59 IST
    expect(today(new Date("2026-10-30T18:31:00Z"))).toBe("2026-10-31"); // 00:01 IST
  });

  it("starts the league week on Monday IST", () => {
    expect(weekId(new Date("2026-11-01T18:29:00Z"))).toBe("2026-10-26"); // Sunday 23:59 IST
    expect(weekId(new Date("2026-11-01T18:31:00Z"))).toBe("2026-11-02"); // Monday 00:01 IST
  });
});
