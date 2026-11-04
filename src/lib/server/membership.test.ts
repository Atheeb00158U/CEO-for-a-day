import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isMember } from "../access";
import { memoryDb } from "./db";
import { GameError } from "./game";
import {
  accessCache,
  accessContext,
  cancelMembership,
  confirmCheckout,
  handleWebhook,
  paywallFor,
  startCheckout,
  type PayEnv,
} from "./membership";
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

function fakeRp(cancelError?: string) {
  let n = 0;
  const created: { planId: string; totalCount: number; notes: Record<string, string>; expireBy?: number }[] = [];
  const cancelled: { id: string; atCycleEnd: boolean }[] = [];
  const rp: RazorpayClient = {
    async createSubscription(planId, totalCount, notes, expireBy) {
      created.push({ planId, totalCount, notes, expireBy });
      return { id: "sub_" + ++n, status: "created" };
    },
    async cancelSubscription(id, atCycleEnd) {
      cancelled.push({ id, atCycleEnd });
      if (cancelError) throw new Error(cancelError);
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

  it("asks Razorpay to expire every checkout after 30 minutes", async () => {
    const db = memoryDb();
    const { rp, created } = fakeRp();
    await startCheckout(db, rp, env, "u1", "founding", NOW);
    await startCheckout(db, rp, env, "u2", "monthly", NOW);
    await startCheckout(db, rp, env, "u3", "yearly", NOW);
    expect(created.map((c) => c.expireBy)).toEqual(Array(3).fill(Math.floor(NOW.getTime() / 1000) + 30 * 60));
  });

  it("cancels a replaced checkout at once, and a charge on it is not lost", async () => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    const a = await startCheckout(db, rp, env, "u1", "monthly", NOW);
    expect(cancelled).toEqual([]);
    const b = await startCheckout(db, rp, env, "u1", "yearly", NOW);
    expect(cancelled).toEqual([{ id: a.subscriptionId, atCycleEnd: false }]);
    expect((await db.getMembership("u1"))?.subscriptionId).toBe(b.subscriptionId);

    // The player had paid in the old Checkout anyway: a person must see it.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const e = event("subscription.charged", { id: a.subscriptionId, status: "active", current_end: end });
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_a", NOW)).toEqual({ ok: true });
    expect(err).toHaveBeenCalledWith("UNKNOWN_SUBSCRIPTION_CHARGED", a.subscriptionId, "subscription.charged");
    expect(db.paymentIssues).toEqual([{ kind: "UNKNOWN_SUBSCRIPTION_CHARGED", subscriptionId: a.subscriptionId, userId: null }]);
    err.mockRestore();
  });

  it("frees a replaced founding hold and treats an old checkout Razorpay already cancelled as done", async () => {
    const db = memoryDb();
    const { rp } = fakeRp("Razorpay /subscriptions/sub_1/cancel 400: Subscription is not cancellable in cancelled status.");
    await startCheckout(db, rp, env, "u1", "founding", NOW);
    await expect(startCheckout(db, rp, env, "u1", "monthly", NOW)).resolves.toMatchObject({ subscriptionId: "sub_2" });
    expect(db.seats).toHaveLength(0);
  });

  it("keeps the old checkout when Razorpay won't cancel it", async () => {
    const db = memoryDb();
    const { rp, created } = fakeRp("Razorpay /subscriptions/sub_1/cancel 502: error");
    await startCheckout(db, rp, env, "u1", "monthly", NOW);
    await expect(startCheckout(db, rp, env, "u1", "monthly", NOW)).rejects.toThrow("502");
    expect(created).toHaveLength(1);
    expect((await db.getMembership("u1"))?.subscriptionId).toBe("sub_1");
  });

  it("does not cancel anything for a finished subscription", async () => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    for (const [i, status] of ["cancelled", "completed", "expired"].entries()) {
      await db.saveMembership({ userId: `u${i}`, plan: "monthly", subscriptionId: `sub_old${i}`, status, currentEnd: null });
      await startCheckout(db, rp, env, `u${i}`, "monthly", NOW);
    }
    expect(cancelled).toEqual([]);
  });

  it("refuses the founding price to a player who kept a seat and cancelled", async () => {
    const db = memoryDb();
    const { rp, created } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    await cancelMembership(db, rp, "u1");
    const later = new Date(NOW.getTime() + 40 * DAY);
    await expect(startCheckout(db, rp, env, "u1", "founding", later)).rejects.toThrow("Founding price ended when you cancelled");
    expect(created).toHaveLength(1);
    // The database refuses too, under its lock.
    expect(await db.claimSeat("u1", "sub_new")).toBeNull();
    // The regular plans stay open to them.
    await expect(startCheckout(db, rp, env, "u1", "monthly", later)).resolves.toMatchObject({ subscriptionId: "sub_2" });
  });

  it("refuses a cancelled member whose paid period is still running", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const m = { userId: "u1", plan: "monthly" as const, subscriptionId: "sub_x", status: "cancelled" };
    await db.saveMembership({ ...m, currentEnd: new Date(NOW.getTime() + DAY).toISOString() });
    await expect(startCheckout(db, rp, env, "u1", "yearly", NOW)).rejects.toThrow("Already a member");
    expect((await db.getMembership("u1"))?.subscriptionId).toBe("sub_x");
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
      currentEnd: new Date(NOW.getTime() + DAY).toISOString(),
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

  it("takes a free seat if the hold ran out before the payment", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    db.seats.splice(0); // the hold expired and was cleared by someone else's claim
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(db.seats).toMatchObject([{ seatNo: 1, subscriptionId, heldUntil: null }]);
  });

  it("keeps a paying founder a member when no seat is left, and flags it", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "founding", NOW);
    db.seats.splice(0);
    db.claimSeat = async () => null;
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(isMember(m, NOW)).toBe(true);
    expect(err).toHaveBeenCalledWith(expect.stringContaining(`FOUNDING_OVERFLOW: paid founding subscription ${subscriptionId}`));
    expect(db.paymentIssues).toEqual([{ kind: "FOUNDING_OVERFLOW", subscriptionId, userId: "u1" }]);
    err.mockRestore();
  });

  it("clears the access cache after saving, not before", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "monthly", NOW);
    const save = db.saveMembership;
    // A request that reads the old row while the save runs caches "not a member".
    db.saveMembership = async (row) => {
      accessCache.set("u1", { ctx: { paywall: true, member: false, early: new Set() }, at: 0 });
      await save(row);
    };
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW);
    expect(accessCache.has("u1")).toBe(false);
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

    // A retried delivery of the same event changes nothing.
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1")).toEqual({ ok: true });
    m = await db.getMembership("u1");
    expect(m).toMatchObject({ status: "active", currentEnd: new Date(end * 1000).toISOString() });
    expect(db.seats).toHaveLength(1);
    expect(db.seats[0].heldUntil).toBeNull();
  });

  it("applies a retried duplicate only once", async () => {
    const { db, subscriptionId } = await member();
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: 2_000_000_000 });
    await handleWebhook(db, env, e.body, e.sig, "evt_1", NOW);
    let saves = 0;
    const save = db.saveMembership;
    db.saveMembership = async (row) => {
      saves++;
      await save(row);
    };
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1", NOW)).toEqual({ ok: true });
    expect(saves).toBe(0);
  });

  it("keeps the later period end when a late activated arrives after charged", async () => {
    const { db, subscriptionId } = await member();
    const first = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const second = first + 30 * 86_400;
    const charged = event("subscription.charged", { id: subscriptionId, status: "active", current_end: second });
    const activated = event("subscription.activated", { id: subscriptionId, status: "active", current_end: first });
    await handleWebhook(db, env, charged.body, charged.sig, "evt_1", NOW);
    await handleWebhook(db, env, activated.body, activated.sig, "evt_2", NOW);
    expect((await db.getMembership("u1"))?.currentEnd).toBe(new Date(second * 1000).toISOString());
  });

  it("compares period ends as times, whatever the stored format", async () => {
    const { db, subscriptionId } = await member();
    const m = await db.getMembership("u1");
    // 10:00 UTC written with an IST offset sorts above "11:00Z" as text, though it is earlier.
    await db.saveMembership({ ...m!, status: "active", currentEnd: "2026-12-04T15:30:00+05:30" });
    const later = Date.parse("2026-12-04T11:00:00Z") / 1000;
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: later });
    await handleWebhook(db, env, e.body, e.sig, "evt_1", NOW);
    expect((await db.getMembership("u1"))?.currentEnd).toBe(new Date(later * 1000).toISOString());
  });

  it("replaces the temporary end of an authenticated member, even with an earlier one", async () => {
    const { db, subscriptionId } = await member();
    await confirmCheckout(db, env, "u1", pay(subscriptionId), NOW); // temporary end: now + 35 days
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const e = event("subscription.activated", { id: subscriptionId, status: "active", current_end: end });
    await handleWebhook(db, env, e.body, e.sig, "evt_1", NOW);
    expect((await db.getMembership("u1"))?.currentEnd).toBe(new Date(end * 1000).toISOString());
  });

  it("keeps cancelled when a late charged arrives", async () => {
    const { db, subscriptionId } = await member();
    const end = Math.floor(NOW.getTime() / 1000) + 30 * 86_400;
    const c = event("subscription.cancelled", { id: subscriptionId, status: "cancelled", current_end: end });
    const charged = event("subscription.charged", { id: subscriptionId, status: "active", current_end: end + 30 * 86_400 });
    await handleWebhook(db, env, c.body, c.sig, "evt_1", NOW);
    await handleWebhook(db, env, charged.body, charged.sig, "evt_2", NOW);
    expect((await db.getMembership("u1"))?.status).toBe("cancelled");
    for (const status of ["pending", "halted"]) {
      const p = event(`subscription.${status}`, { id: subscriptionId, status, current_end: null });
      await handleWebhook(db, env, p.body, p.sig, `evt_${status}`, NOW);
    }
    expect((await db.getMembership("u1"))?.status).toBe("cancelled");
  });

  it("gives a charge with no current_end a fallback end, not forever", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    for (const [u, plan, days] of [
      ["u1", "monthly", 35],
      ["u2", "yearly", 370],
    ] as const) {
      const { subscriptionId } = await startCheckout(db, rp, env, u, plan, NOW);
      const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: null });
      await handleWebhook(db, env, e.body, e.sig, `evt_${u}`, NOW);
      expect(await db.getMembership(u)).toMatchObject({ status: "active", currentEnd: new Date(NOW.getTime() + days * DAY).toISOString() });
    }
  });

  it("ignores a current_end that isn't a number", async () => {
    const { db, subscriptionId } = await member();
    const body = JSON.stringify({
      event: "subscription.charged",
      payload: { subscription: { entity: { id: subscriptionId, status: "active", current_end: "soon" } } },
    });
    await handleWebhook(db, env, body, hmac(env.webhookSecret, body), "evt_1", NOW);
    expect((await db.getMembership("u1"))?.currentEnd).toBe(new Date(NOW.getTime() + 35 * DAY).toISOString());
  });

  it("marks an event handled only after it succeeds", async () => {
    const { db, subscriptionId } = await member();
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: 1 });
    const save = db.saveMembership;
    db.saveMembership = async () => {
      throw new Error("db down");
    };
    await expect(handleWebhook(db, env, e.body, e.sig, "evt_1")).rejects.toThrow("db down");
    db.saveMembership = save;
    // Not recorded, so the retry still goes through.
    expect(await db.insertPaymentEvent("evt_1")).toBe(true);
  });

  it("records a charge on a subscription we don't know, and ignores its other events", async () => {
    const db = memoryDb();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = event("subscription.charged", { id: "sub_other", status: "active", current_end: 1 });
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1")).toEqual({ ok: true });
    const c = event("subscription.cancelled", { id: "sub_other", status: "cancelled", current_end: 1 });
    expect(await handleWebhook(db, env, c.body, c.sig, "evt_2")).toEqual({ ok: true });
    expect(db.paymentIssues).toEqual([{ kind: "UNKNOWN_SUBSCRIPTION_CHARGED", subscriptionId: "sub_other", userId: null }]);
    expect(err).toHaveBeenCalledTimes(1);
    err.mockRestore();
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

  it("refuses with no membership, or one already over", async () => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    await expect(cancelMembership(db, rp, "u1")).rejects.toThrow("No active membership");
    for (const status of ["cancelled", "completed", "expired", "something-new"]) {
      await db.saveMembership({ userId: "u1", plan: "monthly", subscriptionId: "sub_x", status, currentEnd: null });
      await expect(cancelMembership(db, rp, "u1")).rejects.toThrow("No active membership");
    }
    expect(cancelled).toEqual([]);
  });

  it.each([
    ["active", true],
    ["authenticated", true],
    ["pending", false],
    ["halted", false],
    ["created", false],
  ])("cancels a %s subscription (at the cycle end: %s)", async (status, atCycleEnd) => {
    const db = memoryDb();
    const { rp, cancelled } = fakeRp();
    await db.saveMembership({ userId: "u1", plan: "monthly", subscriptionId: "sub_x", status, currentEnd: null });
    const m = await cancelMembership(db, rp, "u1");
    expect(cancelled).toEqual([{ id: "sub_x", atCycleEnd }]);
    expect(m.status).toBe("cancelled");
    expect((await db.getMembership("u1"))?.status).toBe("cancelled");
  });

  it("treats Razorpay's 'already cancelled' as done, and other errors as failure", async () => {
    const db = memoryDb();
    await db.saveMembership({ userId: "u1", plan: "monthly", subscriptionId: "sub_x", status: "active", currentEnd: null });
    const broken = fakeRp("Razorpay /subscriptions/sub_x/cancel 502: error");
    await expect(cancelMembership(db, broken.rp, "u1")).rejects.toThrow("502");
    expect((await db.getMembership("u1"))?.status).toBe("active");
    const over = fakeRp("Razorpay /subscriptions/sub_x/cancel 400: Subscription is not cancellable in cancelled status.");
    expect((await cancelMembership(db, over.rp, "u1")).status).toBe("cancelled");
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
      currentEnd: new Date(NOW.getTime() + DAY).toISOString(),
    });
    expect(await accessContext(db, "u1", "a@example.com", NOW)).toEqual({
      paywall: true,
      member: true,
      early: new Set(),
    });
    db.early.set("u2", new Set(["lesson:u2-mom-test"]));
    expect(await accessContext(db, "u2", "b@example.com", NOW)).toEqual({
      paywall: true,
      member: false,
      early: new Set(["lesson:u2-mom-test"]),
    });
  });
});

describe("handleWebhook dedup on failure", () => {
  it("leaves a failed event unrecorded so the retry applies it", async () => {
    const db = memoryDb();
    const { rp } = fakeRp();
    const { subscriptionId } = await startCheckout(db, rp, env, "u1", "monthly", NOW);
    const e = event("subscription.charged", { id: subscriptionId, status: "active", current_end: 2_000_000_000 });
    const save = db.saveMembership;
    db.saveMembership = async () => {
      throw new Error("db down");
    };
    await expect(handleWebhook(db, env, e.body, e.sig, "evt_1", NOW)).rejects.toThrow("db down");
    db.saveMembership = save;
    expect(await handleWebhook(db, env, e.body, e.sig, "evt_1", NOW)).toEqual({ ok: true });
    expect((await db.getMembership("u1"))?.status).toBe("active");
  });
});
