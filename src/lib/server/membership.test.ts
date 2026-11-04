import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isMember } from "../access";
import { memoryDb } from "./db";
import { GameError } from "./game";
import { accessContext, cancelMembership, confirmCheckout, handleWebhook, paywallFor, startCheckout, type PayEnv } from "./membership";
import type { RazorpayClient } from "./razorpay";

const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");
const DAY = 86_400_000;
const NOW = new Date("2026-11-04T10:00:00Z");

const env: PayEnv = {
  keyId: "rzp_test_key",
  keySecret: "test-key-secret",
  webhookSecret: "test-webhook-secret",
  plans: { founding: "plan_f", monthly: "plan_m", yearly: "plan_y" },
  totalCount: { founding: 120, monthly: 120, yearly: 10 },
};

function fakeRp() {
  let n = 0;
  const created: { planId: string; totalCount: number; notes: Record<string, string> }[] = [];
  const cancelled: { id: string; atCycleEnd: boolean }[] = [];
  const rp: RazorpayClient = {
    async createSubscription(planId, totalCount, notes) {
      created.push({ planId, totalCount, notes });
      return { id: "sub_" + ++n, status: "created" };
    },
    async cancelSubscription(id, atCycleEnd) {
      cancelled.push({ id, atCycleEnd });
      return { status: "active", current_end: null };
    },
  };
  return { rp, created, cancelled };
}

const pay = (subscriptionId: string, paymentId = "pay_1") => ({
  paymentId,
  subscriptionId,
  signature: hmac(env.keySecret, `${paymentId}|${subscriptionId}`),
});

function event(name: string, sub: { id: string; status: string; current_end: number | null }) {
  const body = JSON.stringify({ event: name, payload: { subscription: { entity: { entity: "subscription", ...sub } } } });
  return { body, sig: hmac(env.webhookSecret, body) };
}

describe("startCheckout", () => {
  it("holds seat 1 for a founding checkout and the counter reads 1", async () => {
    const db = memoryDb();
    const { rp, created } = fakeRp();
    const out = await startCheckout(db, rp, env, "u1", "founding", NOW);
    expect(out).toEqual({ subscriptionId: "sub_1", keyId: "rzp_test_key" });
    expect(created[0]).toMatchObject({ planId: "plan_f", totalCount: 120, notes: { userId: "u1", plan: "founding" } });
    expect(db.seats.map((s) => s.seatNo)).toEqual([1]);
    expect(await db.countFoundingSeats()).toBe(1);
    expect(await db.getMembership("u1")).toEqual({
      userId: "u1",
      plan: "founding",
      subscriptionId: "sub_1",
      status: "created",
      currentEnd: null,
    });
  });

  it("moves the hold when the same player starts again", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    await startCheckout(db, rp, env, "u1", "founding", NOW);
    await startCheckout(db, rp, env, "u1", "founding", NOW);
    expect(db.seats).toHaveLength(1);
    expect(db.seats[0].subscriptionId).toBe("sub_2");
    expect(await db.countFoundingSeats()).toBe(1);
  });

  it("refuses a founding checkout when all 500 are taken, creating nothing", async () => {
    const db = memoryDb();
    db.foundingSeats = 500;
    const { rp, created } = fakeRp();
    await expect(startCheckout(db, rp, env, "u1", "founding", NOW)).rejects.toThrow("Founding seats are full");
    expect(created).toHaveLength(0);
    expect(await db.getMembership("u1")).toBeNull();
  });

  it("cancels the new subscription at once if the seat race is lost", async () => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    db.claimSeat = async () => null;
    await expect(startCheckout(db, rp, env, "u1", "founding", NOW)).rejects.toThrow("Founding seats are full");
    expect(cancelled).toEqual([{ id: "sub_1", atCycleEnd: false }]);
    expect(await db.getMembership("u1")).toBeNull();
  });

  it("creates monthly and yearly checkouts without a seat", async () => {
    const db = memoryDb();
    db.foundingSeats = 500;
    const { rp, created } = fakeRp();
    await startCheckout(db, rp, env, "u1", "monthly", NOW);
    await startCheckout(db, rp, env, "u2", "yearly", NOW);
    expect(created.map((c) => [c.planId, c.totalCount])).toEqual([
      ["plan_m", 120],
      ["plan_y", 10],
    ]);
    expect(db.seats).toHaveLength(0);
  });

  it("refuses a current member", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    await db.saveMembership({
      userId: "u1",
      plan: "monthly",
      subscriptionId: "sub_x",
      status: "active",
      currentEnd: null,
    });
    await expect(startCheckout(db, rp, env, "u1", "monthly", NOW)).rejects.toThrow(GameError);
  });
});

describe("confirmCheckout", () => {
  it("makes the player a member and keeps the seat on a good signature", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    const m = await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(m.status).toBe("authenticated");
    expect(m.currentEnd).toBe(new Date(NOW.getTime() + 35 * DAY).toISOString());
    expect(isMember(await db.getMembership("u1"), NOW)).toBe(true);
    expect(db.seats[0].heldUntil).toBeNull();
  });

  it("refuses a bad signature, and another player's subscription", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    await expect(confirmCheckout(db, env, "u1", { ...pay(subscriptionId), signature: "00" }, NOW)).rejects.toThrow("Payment not verified");
    await expect(confirmCheckout(db, env, "u2", pay(subscriptionId), NOW)).rejects.toThrow(GameError);
    expect(isMember(await db.getMembership("u1"), NOW)).toBe(false);
    expect(db.seats[0].heldUntil).not.toBeNull();
  });

  it("gives a yearly member a longer temporary end", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "yearly", NOW);
    const m = await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(m.currentEnd).toBe(new Date(NOW.getTime() + 370 * DAY).toISOString());
  });

  it("does not undo a webhook that already arrived", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "monthly", NOW);
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: end });
    await handleWebhook(db, env, e.body, e.sig, "evt_1");
    const m = await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(m.status).toBe("active");
    expect(m.currentEnd).toBe(new Date(end * 1000).toISOString());
  });
});

describe("handleWebhook", () => {
  async function member() {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    return { db, subscriptionId };
  }

  it("answers 400 to a bad signature", async () => {
    const { db, subscriptionId } = await member();
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: 1 });
    expect(await handleWebhook(db, env, e.body, "bad", "evt_1")).toEqual({ ok: false, status: 400 });
    expect((await db.getMembership("u1"))?.status).toBe("created");
  });

  it("sets currentEnd and keeps the seat on subscription.charged, once per event id", async () => {
    const { db, subscriptionId } = await member();
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: end });
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1")).toEqual({ ok: true });
    let m = await db.getMembership("u1");
    expect(m).toMatchObject({ status: "active", currentEnd: new Date(end * 1000).toISOString() });
    expect(db.seats[0].heldUntil).toBeNull();

    // A replay of the same event (later state changed by hand) is ignored.
    await db.saveMembership({ ...m!, status: "halted" });
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1")).toEqual({ ok: true });
    m = await db.getMembership("u1");
    expect(m?.status).toBe("halted");
  });

  it("ignores subscriptions that aren't ours", async () => {
    const db = memoryDb();
    const e = event("subscription.charged", { id: "sub_other", status: "active", current_end: 1 });
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1")).toEqual({ ok: true });
  });

  it("keeps access after subscription.cancelled until currentEnd, then not", async () => {
    const { db, subscriptionId } = await member();
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const charged = event("subscription.charged", { id: subscriptionId, status: "active", current_end: end });
    await handleWebhook(db, env, charged.body, charged.sig, "evt_1");
    const c = event("subscription.cancelled", { id: subscriptionId, status: "cancelled", current_end: end });
    await handleWebhook(db, env, c.body, c.sig, "evt_2");
    const m = await db.getMembership("u1");
    expect(m?.status).toBe("cancelled");
    expect(isMember(m, NOW)).toBe(true);
    expect(isMember(m, new Date(NOW.getTime() + 40 * DAY))).toBe(false);
    expect(db.seats[0].cancelledAt).not.toBeNull();
  });

  it("updates status only on subscription.halted", async () => {
    const { db, subscriptionId } = await member();
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    const before = await db.getMembership("u1");
    const h = event("subscription.halted", { id: subscriptionId, status: "halted", current_end: null });
    await handleWebhook(db, env, h.body, h.sig, "evt_3");
    expect(await db.getMembership("u1")).toEqual({ ...before, status: "halted" });
  });
});

describe("cancelMembership", () => {
  it("cancels at the cycle end and keeps access until currentEnd", async () => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    const m = await cancelMembership(db, rp, "u1");
    expect(cancelled).toEqual([{ id: subscriptionId, atCycleEnd: true }]);
    expect(m.status).toBe("cancelled");
    expect(isMember(m, NOW)).toBe(true);
    expect(db.seats[0].cancelledAt).not.toBeNull();
  });

  it("refuses with no membership, or one already cancelled", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    await expect(cancelMembership(db, rp, "u1")).rejects.toThrow("No active membership");
    await db.saveMembership({
      userId: "u1",
      plan: "monthly",
      subscriptionId: "sub_x",
      status: "cancelled",
      currentEnd: null,
    });
    await expect(cancelMembership(db, rp, "u1")).rejects.toThrow("No active membership");
  });
});

describe("paywallFor and accessContext", () => {
  let saved: { on?: string; testers?: string };
  beforeEach(() => {
    saved = { on: process.env.PAYWALL_ON, testers: process.env.PAYWALL_TESTERS };
    delete process.env.PAYWALL_ON;
    delete process.env.PAYWALL_TESTERS;
  });
  afterEach(() => {
    for (const [k, v] of [
      ["PAYWALL_ON", saved.on],
      ["PAYWALL_TESTERS", saved.testers],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("is off by default", () => {
    expect(paywallFor("a@example.com")).toBe(false);
    expect(paywallFor(undefined)).toBe(false);
  });
  it("is on for listed testers, ignoring case and spaces", () => {
    process.env.PAYWALL_TESTERS = "Tester@Example.com, b@example.com";
    expect(paywallFor("tester@example.com")).toBe(true);
    expect(paywallFor("B@example.com")).toBe(true);
    expect(paywallFor("c@example.com")).toBe(false);
    expect(paywallFor(undefined)).toBe(false);
  });
  it("is on for everyone with PAYWALL_ON=1", () => {
    process.env.PAYWALL_ON = "1";
    expect(paywallFor("c@example.com")).toBe(true);
    expect(paywallFor(undefined)).toBe(true);
  });

  it("builds the context for a guest and for a member", async () => {
    process.env.PAYWALL_ON = "1";
    const db = memoryDb();
    expect(await accessContext(db, null, undefined, NOW)).toEqual({ paywall: true, member: false, early: new Set() });
    await db.saveMembership({
      userId: "u1",
      plan: "monthly",
      subscriptionId: "sub_x",
      status: "active",
      currentEnd: null,
    });
    expect(await accessContext(db, "u1", "a@example.com", NOW)).toEqual({
      paywall: true,
      member: true,
      early: new Set(),
    });
  });
});
