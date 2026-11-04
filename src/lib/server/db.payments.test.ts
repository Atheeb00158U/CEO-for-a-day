import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryDb } from "./db";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const MIN = 60 * 1000;

describe("memoryDb seats", () => {
  it("claimSeat gives the lowest free seat", async () => {
    const db = memoryDb();
    expect(await db.claimSeat("a", "sub_a")).toBe(1);
    expect(await db.claimSeat("b", "sub_b")).toBe(2);
    expect(await db.countFoundingSeats()).toBe(2);
  });

  it("a second claim by the same user moves their hold", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    expect(await db.claimSeat("a", "sub_a2")).toBe(1);
    expect(db.seats).toHaveLength(1);
    expect(db.seats[0].subscriptionId).toBe("sub_a2");
  });

  it("expired holds free up", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    await db.claimSeat("b", "sub_b");
    vi.advanceTimersByTime(31 * MIN);
    expect(await db.countFoundingSeats()).toBe(0);
    expect(await db.claimSeat("c", "sub_c")).toBe(1);
  });

  it("returns null when 500 kept seats exist", async () => {
    const db = memoryDb();
    for (let n = 1; n <= 500; n++)
      db.seats.push({ seatNo: n, userId: `u${n}`, subscriptionId: `s${n}`, heldUntil: null, cancelledAt: null });
    expect(await db.claimSeat("x", "sub_x")).toBeNull();
    vi.advanceTimersByTime(60 * MIN);
    expect(await db.claimSeat("x", "sub_x")).toBeNull();
  });

  it("keepSeat makes a hold permanent", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    expect(await db.keepSeat("sub_a")).toBe(true);
    expect(await db.keepSeat("sub_none")).toBe(false);
    vi.advanceTimersByTime(60 * MIN);
    expect(await db.countFoundingSeats()).toBe(1);
    expect(await db.claimSeat("b", "sub_b")).toBe(2);
  });

  it("gives no second founding seat to a player who kept one, even after cancelling", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    await db.keepSeat("sub_a");
    await db.cancelSeat("sub_a");
    expect(await db.hasKeptSeat("a")).toBe(true);
    expect(await db.claimSeat("a", "sub_a2")).toBeNull();
    expect(await db.hasKeptSeat("b")).toBe(false);
  });

  it("cancelSeat removes an unpaid hold", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    await db.cancelSeat("sub_a");
    expect(db.seats).toHaveLength(0);
  });

  it("cancelSeat marks a kept seat cancelled, and it still counts", async () => {
    const db = memoryDb();
    await db.claimSeat("a", "sub_a");
    await db.keepSeat("sub_a");
    await db.cancelSeat("sub_a");
    expect(db.seats[0].cancelledAt).not.toBeNull();
    expect(await db.countFoundingSeats()).toBe(1);
    expect(await db.claimSeat("b", "sub_b")).toBe(2);
  });
});

describe("memoryDb payment events", () => {
  it("handles each event id once", async () => {
    const db = memoryDb();
    expect(await db.insertPaymentEvent("evt_1")).toBe(true);
    expect(await db.insertPaymentEvent("evt_1")).toBe(false);
    expect(await db.insertPaymentEvent("evt_2")).toBe(true);
  });

  it("says whether an event id is recorded", async () => {
    const db = memoryDb();
    expect(await db.hasPaymentEvent("evt_1")).toBe(false);
    await db.insertPaymentEvent("evt_1");
    expect(await db.hasPaymentEvent("evt_1")).toBe(true);
  });
});

describe("memoryDb memberships", () => {
  it("saves, reads and finds by subscription", async () => {
    const db = memoryDb();
    const row = { userId: "a", plan: "founding" as const, subscriptionId: "sub_a", status: "active", currentEnd: null };
    await db.saveMembership(row);
    expect(await db.getMembership("a")).toEqual(row);
    expect(await db.membershipBySubscription("sub_a")).toEqual(row);
    expect(await db.getMembership("b")).toBeNull();
  });
});

describe("memoryDb replaceMembership", () => {
  const row = (subscriptionId: string) => ({ userId: "a", plan: "monthly" as const, subscriptionId, status: "created", currentEnd: null });

  it("inserts only when the player has no membership yet", async () => {
    const db = memoryDb();
    expect(await db.replaceMembership("a", null, row("sub_1"))).toBe(true);
    expect(await db.replaceMembership("a", null, row("sub_2"))).toBe(false);
    expect((await db.getMembership("a"))?.subscriptionId).toBe("sub_1");
  });

  it("replaces only while the stored subscription is the expected one", async () => {
    const db = memoryDb();
    await db.saveMembership(row("sub_1"));
    expect(await db.replaceMembership("a", "sub_x", row("sub_2"))).toBe(false);
    expect((await db.getMembership("a"))?.subscriptionId).toBe("sub_1");
    expect(await db.replaceMembership("a", "sub_1", row("sub_2"))).toBe(true);
    expect((await db.getMembership("a"))?.subscriptionId).toBe("sub_2");
  });
});
