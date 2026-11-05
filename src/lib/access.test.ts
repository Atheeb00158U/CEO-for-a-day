import { describe, expect, it } from "vitest";
import course from "../../content/course/course.json";
import { canOpen, freeItems, isMember, type AccessContext } from "./access";

const free = freeItems(course);
const guest: AccessContext = { paywall: true, member: false, early: new Set() };
const now = new Date("2026-11-10T10:00:00Z");

describe("freeItems", () => {
  it("frees the first module's lessons, test-out and gate, and nothing else", () => {
    const first = course.units[0].modules[0];
    expect(free).toEqual(
      new Set([...first.lessons.map((l) => `lesson:${l}`), `testout:${first.id}`, ...first.gates.map((g) => `hotseat:${g}`)]),
    );
    expect(free.has("lesson:u1-cash-runs-out")).toBe(true);
    expect(free.has("lesson:u1-test-small")).toBe(true);
    expect(free.has("testout:u1-where-money-goes")).toBe(true);
    expect(free.has("hotseat:kirana-year")).toBe(true);
  });
  it("does not free Module 1.2 or Nirma", () => {
    expect(free.has("lesson:u1-small-fixed-costs")).toBe(false);
    expect(free.has("lesson:u1-sunk-cost")).toBe(false);
    expect(free.has("testout:u1-what-costs-decide")).toBe(false);
    expect(free.has("hotseat:nirma-washing-powder")).toBe(false);
  });
  it("does not free Unit 2", () => {
    expect(free.has("lesson:u2-mom-test")).toBe(false);
    expect(free.has("hotseat:redbus-first-tickets")).toBe(false);
  });
});

describe("canOpen", () => {
  it("lets anyone open free items", () => {
    expect(canOpen({ kind: "lesson", id: "u1-cash-runs-out" }, guest, free)).toBe(true);
  });
  it("locks other items for non-members", () => {
    expect(canOpen({ kind: "lesson", id: "u2-mom-test" }, guest, free)).toBe(false);
    expect(canOpen({ kind: "hotseat", id: "amul-one-brand" }, guest, free)).toBe(false);
    expect(canOpen({ kind: "testout", id: "u2-real-problem" }, guest, free)).toBe(false);
  });
  it("opens everything for members", () => {
    expect(canOpen({ kind: "hotseat", id: "amul-one-brand" }, { ...guest, member: true }, free)).toBe(true);
  });
  it("keeps what an early player finished", () => {
    const ctx = { ...guest, early: new Set(["lesson:u2-mom-test"]) };
    expect(canOpen({ kind: "lesson", id: "u2-mom-test" }, ctx, free)).toBe(true);
    expect(canOpen({ kind: "lesson", id: "u2-praise-not-proof" }, ctx, free)).toBe(false);
  });
  it("opens everything while the paywall is off", () => {
    expect(canOpen({ kind: "hotseat", id: "amul-one-brand" }, { ...guest, paywall: false }, free)).toBe(true);
  });
});

describe("isMember", () => {
  it("counts active, and cancelled or halted until the paid period ends", () => {
    const end = "2026-11-20T00:00:00Z";
    expect(isMember({ status: "active", currentEnd: end }, now)).toBe(true);
    expect(isMember({ status: "cancelled", currentEnd: end }, now)).toBe(true);
    expect(isMember({ status: "halted", currentEnd: end }, now)).toBe(true);
    expect(isMember({ status: "cancelled", currentEnd: "2026-11-01T00:00:00Z" }, now)).toBe(false);
    expect(isMember({ status: "created", currentEnd: null }, now)).toBe(false);
    expect(isMember(null, now)).toBe(false);
  });
  it("keeps an active member open for 3 days past the period end, then not; no end is no access", () => {
    // Never forever: an active row with no end is not a member.
    expect(isMember({ status: "active", currentEnd: null }, now)).toBe(false);
    expect(isMember({ status: "active", currentEnd: "2026-11-08T10:00:01Z" }, now)).toBe(true);
    expect(isMember({ status: "active", currentEnd: "2026-11-07T10:00:00Z" }, now)).toBe(false);
    // The grace is for late renewals only: a cancelled member ends on time.
    expect(isMember({ status: "cancelled", currentEnd: "2026-11-09T10:00:00Z" }, now)).toBe(false);
  });
});
