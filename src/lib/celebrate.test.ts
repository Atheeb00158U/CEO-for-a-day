import { describe, expect, it } from "vitest";
import { celebrationFor, paidRecently, PAY_WINDOW_MS } from "./celebrate";
import type { MembershipView } from "./membership-view";

const view = (member: boolean, over: Partial<MembershipView> = {}): MembershipView => ({
  plan: "founding",
  subscriptionId: "sub_1",
  status: member ? "active" : "created",
  currentEnd: member ? "2026-12-04T00:00:00Z" : null,
  member,
  foundingUsed: false,
  ...over,
});

describe("celebrationFor", () => {
  it("celebrates when a loaded non-member becomes a member", () => {
    expect(celebrationFor({ before: null, now: view(true), shown: [], paidRecently: false })).toEqual(view(true));
    expect(celebrationFor({ before: view(false), now: view(true), shown: [], paidRecently: false })).toEqual(view(true));
  });

  it("never celebrates the same subscription twice", () => {
    expect(celebrationFor({ before: view(false), now: view(true), shown: ["sub_1"], paidRecently: true })).toBeNull();
  });

  it("celebrates a new subscription after an old one was shown", () => {
    const now = view(true, { subscriptionId: "sub_2", plan: "monthly" });
    expect(celebrationFor({ before: view(false), now, shown: ["sub_1"], paidRecently: false })).toEqual(now);
  });

  it("does not celebrate someone who was already a member", () => {
    expect(celebrationFor({ before: view(true), now: view(true), shown: [], paidRecently: true })).toBeNull();
  });

  it("does not celebrate a non-member", () => {
    expect(celebrationFor({ before: null, now: view(false), shown: [], paidRecently: true })).toBeNull();
    expect(celebrationFor({ before: view(true), now: null, shown: [], paidRecently: true })).toBeNull();
  });

  it("on the first look at an account, celebrates only after a recent payment", () => {
    // An old member opening the app on a new phone: no party.
    expect(celebrationFor({ before: undefined, now: view(true), shown: [], paidRecently: false })).toBeNull();
    // Paid, closed the app, and the webhook made them a member meanwhile.
    expect(celebrationFor({ before: undefined, now: view(true), shown: [], paidRecently: true })).toEqual(view(true));
  });
});

describe("paidRecently", () => {
  const t = Date.parse("2026-11-04T10:00:00Z");
  it("is true within 30 minutes of starting a payment", () => {
    expect(PAY_WINDOW_MS).toBe(30 * 60_000);
    expect(paidRecently(t, t + 29 * 60_000)).toBe(true);
    expect(paidRecently(t, t)).toBe(true);
  });
  it("is false after 30 minutes, with no payment, or with a clock that went back", () => {
    expect(paidRecently(t, t + 31 * 60_000)).toBe(false);
    expect(paidRecently(null, t)).toBe(false);
    expect(paidRecently(t, t - 60_000)).toBe(false);
  });
});
