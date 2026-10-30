import { describe, expect, it } from "vitest";
import { coursePath } from "./course-path";
import type { CourseOutline } from "./course-types";

const lesson = (id: string) => ({ id, title: id, principle: "", minutes: 3, exercises: 4 });
const outline: CourseOutline = {
  units: [
    {
      id: "u1",
      title: "U1",
      goal: "",
      modules: [
        { id: "m1", title: "M1", goal: "", lessons: [lesson("a"), lesson("b")], gates: ["hs1"] },
        { id: "m2", title: "M2", goal: "", lessons: [lesson("c")], gates: [] },
      ],
    },
    { id: "u2", title: "U2", goal: "", modules: [{ id: "m3", title: "M3", goal: "", lessons: [lesson("d")], gates: ["hs2", "hs3"] }] },
  ],
};
const states = (lessons: Record<string, number>, best: Record<string, number> = {}) =>
  coursePath(outline, { lessons, best }).units.flatMap((u) =>
    u.modules.map((m) => [...m.lessons.map((l) => `${l.id}:${l.state}`), ...m.gates.map((g) => `${g.id}:${g.state}`)].join(" ")),
  );

describe("the Home path", () => {
  it("starts a new player on the first lesson, with everything else locked", () => {
    expect(states({})).toEqual(["a:current b:locked hs1:locked", "c:locked", "d:locked hs2:locked hs3:locked"]);
  });

  it("unlocks lessons in order, then the module's Hot Seat", () => {
    expect(states({ a: 80 })).toEqual(["a:done b:current hs1:locked", "c:locked", "d:locked hs2:locked hs3:locked"]);
    expect(states({ a: 80, b: 90 })).toEqual(["a:done b:done hs1:current", "c:locked", "d:locked hs2:locked hs3:locked"]);
  });

  it("opens the next module once the gate is played (any score), and a gateless module once its lessons are done", () => {
    expect(states({ a: 1, b: 1 }, { hs1: 0 })[1]).toBe("c:current");
    expect(states({ a: 1, b: 1, c: 1 }, { hs1: 0 })[2]).toBe("d:current hs2:locked hs3:locked");
    expect(states({ a: 1, b: 1, c: 1, d: 1 }, { hs1: 0 })[2]).toBe("d:done hs2:current hs3:open");
  });

  it("opens a module skipped by a test-out, while the earlier gate still waits", () => {
    expect(states({ c: 100 })).toEqual(["a:current b:locked hs1:locked", "c:done", "d:open hs2:locked hs3:locked"]);
    expect(states({ d: 100 })[2]).toBe("d:done hs2:open hs3:open");
  });

  it("offers practice once a lesson in the module is done, and test-out until all are", () => {
    const m = coursePath(outline, { lessons: { a: 50 }, best: {} }).units[0].modules[0];
    expect(m.practice).toEqual({ state: "open", lessonIds: ["a"] });
    expect(m.canTestOut).toBe(true);
    expect(coursePath(outline, { lessons: { a: 1, b: 1 }, best: {} }).units[0].modules[0].canTestOut).toBe(false);
  });
});
