import { describe, expect, it } from "vitest";
import type { CourseOutline } from "./course-types";
import { phoneLocks } from "./locks";

const lesson = (id: string) => ({ id, title: id, principle: "", minutes: 3, exercises: 3 });
const outline: CourseOutline = {
  units: [
    {
      id: "u1",
      title: "",
      goal: "",
      modules: [
        { id: "m1", title: "", goal: "", lessons: [lesson("a")], gates: ["free-seat"] },
        { id: "m1b", title: "", goal: "", lessons: [lesson("a2")], gates: ["unit1-paid-seat"] },
      ],
    },
    {
      id: "u2",
      title: "",
      goal: "",
      modules: [{ id: "m2", title: "", goal: "", lessons: [lesson("b"), lesson("c")], gates: ["paid-seat"] }],
    },
  ],
};
const none = { lessons: {}, best: {} };

describe("phoneLocks", () => {
  it("locks nothing while the paywall is off or for a member", () => {
    expect(phoneLocks(outline, null, false, none)({ kind: "lesson", id: "b" })).toBe(false);
    const member = { plan: "monthly" as const, status: "active", currentEnd: null, member: true, foundingUsed: false };
    expect(phoneLocks(outline, member, true, none)({ kind: "lesson", id: "b" })).toBe(false);
  });
  it("locks everything after the first module for a non-member", () => {
    const locked = phoneLocks(outline, null, true, none);
    expect(locked({ kind: "lesson", id: "a" })).toBe(false);
    expect(locked({ kind: "hotseat", id: "free-seat" })).toBe(false);
    expect(locked({ kind: "testout", id: "m1" })).toBe(false);
    expect(locked({ kind: "lesson", id: "a2" })).toBe(true);
    expect(locked({ kind: "testout", id: "m1b" })).toBe(true);
    expect(locked({ kind: "hotseat", id: "unit1-paid-seat" })).toBe(true);
    expect(locked({ kind: "lesson", id: "b" })).toBe(true);
    expect(locked({ kind: "testout", id: "m2" })).toBe(true);
    expect(locked({ kind: "hotseat", id: "paid-seat" })).toBe(true);
  });
  it("keeps open what the player already finished", () => {
    const locked = phoneLocks(outline, null, true, { lessons: { b: {} }, best: { "paid-seat": 7 } });
    expect(locked({ kind: "lesson", id: "b" })).toBe(false);
    expect(locked({ kind: "lesson", id: "c" })).toBe(true);
    expect(locked({ kind: "hotseat", id: "paid-seat" })).toBe(false);
  });
});
