// Payments (spec §4 and §4a): checkout, its verification, webhooks, cancelling, and who is a member.
// Everything takes the Db, the Razorpay client and the env as arguments, so tests use memoryDb() and a fake client.
import { isMember, type AccessContext } from "../access.ts";
import { FOUNDING } from "../offer.ts";
import type { Db, MembershipRow } from "./db.ts";
import { GameError } from "./game.ts";
import { alreadyCancelled, checkoutSignatureOk, webhookSignatureOk, type RazorpayClient } from "./razorpay.ts";

export type Plan = MembershipRow["plan"];
export const PLANS: readonly Plan[] = ["founding", "monthly", "yearly"];

export interface PayEnv {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  plans: Record<Plan, string>;
  totalCount: Record<Plan, number>;
}

/** Read once from Railway's variables. Founding and monthly renew for ten years of months; yearly for ten years. */
export function payEnv(e = process.env): PayEnv {
  return {
    keyId: e.RAZORPAY_KEY_ID ?? "",
    keySecret: e.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: e.RAZORPAY_WEBHOOK_SECRET ?? "",
    plans: {
      founding: e.RAZORPAY_PLAN_FOUNDING ?? "",
      monthly: e.RAZORPAY_PLAN_MONTHLY ?? "",
      yearly: e.RAZORPAY_PLAN_YEARLY ?? "",
    },
    totalCount: { founding: 120, monthly: 120, yearly: 10 },
  };
}

const DAY_MS = 86_400_000;
const SEATS_FULL = "Founding seats are full";
const FOUNDING_USED = "Founding price ended when you cancelled";
const TRY_AGAIN = "Try again";
/** A seat is held this long, and any checkout can be paid only this long (Razorpay's expire_by). */
const HOLD_S = 30 * 60;
/** Statuses after which Razorpay never charges again. A row never moves from one of these back to a live one. */
const FINAL = new Set(["cancelled", "completed", "expired"]);
/** The temporary period end when Razorpay hasn't given one: a little over one billing cycle. */
const tempEnd = (plan: Plan, now: Date) => new Date(now.getTime() + (plan === "yearly" ? 370 : 35) * DAY_MS).toISOString();
/** Razorpay's statuses for a subscription whose authorisation payment went through. */
const PAID = new Set(["authenticated", "active"]);
/** Statuses where a renewal failed; only a charge for a new period brings the row back. */
const BEHIND = new Set(["pending", "halted"]);
/** Razorpay's `current_end` (unix seconds) as ISO, or null when it isn't a number. */
const isoEnd = (currentEnd: unknown) => (typeof currentEnd === "number" ? new Date(currentEnd * 1000).toISOString() : null);
/** Whether period end `a` is later than the stored `b`. Compared as times: Postgres hands back "+00:00", not "Z". */
const later = (a: string, b: string | null) => !b || Date.parse(a) > Date.parse(b);

/**
 * The row after a paid event (a charge, or Razorpay saying it is paid). Never forever: with no usable current_end, a
 * temporary one. Never lower a real end either (a late "activated" after a "charged"), except the guess
 * confirmCheckout stored while authenticated.
 */
function paidRow(m: MembershipRow, status: string, currentEnd: unknown, now: Date): MembershipRow {
  const incoming = isoEnd(currentEnd) ?? tempEnd(m.plan, now);
  const keepStored = m.status !== "authenticated" && !later(incoming, m.currentEnd);
  return { ...m, status, currentEnd: keepStored ? m.currentEnd : incoming };
}

/** Cancel at Razorpay; one that is already over counts as done. */
async function cancelAt(rp: RazorpayClient, subscriptionId: string, atCycleEnd: boolean) {
  try {
    await rp.cancelSubscription(subscriptionId, atCycleEnd);
  } catch (e) {
    if (!alreadyCancelled(e)) throw e;
  }
}

/**
 * The first payment keeps the founding seat. If the hold ran out or moved before the money arrived, take a free seat
 * now. With none free the player still paid ₹99 and stays a member: log it for a person to sort out (no PII).
 */
async function secureSeat(db: Db, m: MembershipRow) {
  if (await db.keepSeat(m.subscriptionId)) return;
  if ((await db.claimSeat(m.userId, m.subscriptionId)) !== null && (await db.keepSeat(m.subscriptionId))) return;
  console.error(`FOUNDING_OVERFLOW: paid founding subscription ${m.subscriptionId} has no seat; check by hand`);
  await db.recordPaymentIssue("FOUNDING_OVERFLOW", m.subscriptionId, m.userId);
}

export async function startCheckout(db: Db, rp: RazorpayClient, env: PayEnv, userId: string, plan: Plan, now: Date) {
  const current = await db.getMembership(userId);
  if (isMember(current, now)) throw new GameError("Already a member");
  const live = current && !FINAL.has(current.status) ? current : null;
  if (live) {
    // The old checkout may be paid already (the verify call failed, or its webhook hasn't landed): ask Razorpay, and
    // if so, keep it as the membership rather than cancel a subscription the player paid for.
    const remote = await rp.fetchSubscription(live.subscriptionId);
    if (PAID.has(remote.status)) {
      const row = paidRow(live, remote.status, remote.current_end, now);
      if (!(await db.replaceMembership(userId, live.subscriptionId, row))) throw new GameError(TRY_AGAIN);
      if (row.plan === "founding") await secureSeat(db, row);
      forgetAccess(userId);
      throw new GameError("Already a member");
    }
  }
  if (plan === "founding") {
    // Cancelling gives up the founding price (spec §3); the paywall offers the regular plans instead.
    if (await db.hasKeptSeat(userId)) throw new GameError(FOUNDING_USED);
    // A fresh count, not the landing page's cache. The player's own live hold is about to move, so it doesn't count
    // against them; claimSeat below is the real check, under the database lock.
    const ownHold = current?.plan === "founding" && current.status === "created";
    if (!ownHold && (await db.countFoundingSeats()) >= FOUNDING.seats) throw new GameError(SEATS_FULL);
  }
  // Only one checkout per player is ever live: the row below replaces the old one, so a payment on the old one would
  // give no access yet keep charging. Stop it first; if Razorpay can't, start nothing new.
  if (live) {
    await cancelAt(rp, live.subscriptionId, false);
    if (live.plan === "founding") await db.cancelSeat(live.subscriptionId);
    if (!(await db.replaceMembership(userId, live.subscriptionId, { ...live, status: "cancelled" }))) throw new GameError(TRY_AGAIN);
  }
  // No checkout can be paid after 30 minutes (a founding one's seat hold runs out then too).
  const expireBy = Math.floor(now.getTime() / 1000) + HOLD_S;
  const sub = await rp.createSubscription(env.plans[plan], env.totalCount[plan], { userId, plan }, expireBy);
  if (plan === "founding" && (await db.claimSeat(userId, sub.id)) === null) {
    await rp.cancelSubscription(sub.id, false);
    throw new GameError((await db.hasKeptSeat(userId)) ? FOUNDING_USED : SEATS_FULL);
  }
  // Only if nothing else (another tab's checkout, a webhook) changed the membership meanwhile; otherwise this new
  // subscription would be orphaned, so stop it at once.
  const row: MembershipRow = { userId, plan, subscriptionId: sub.id, status: "created", currentEnd: null };
  if (!(await db.replaceMembership(userId, current?.subscriptionId ?? null, row))) {
    await cancelAt(rp, sub.id, false);
    if (plan === "founding") await db.cancelSeat(sub.id);
    throw new GameError(TRY_AGAIN);
  }
  return { subscriptionId: sub.id, keyId: env.keyId };
}

export async function confirmCheckout(
  db: Db,
  env: PayEnv,
  userId: string,
  p: { paymentId: string; subscriptionId: string; signature: string },
  now: Date,
): Promise<MembershipRow> {
  const m = await db.getMembership(userId);
  // The signature is checked against the subscription we stored for this player, never one the phone names alone.
  if (!m || m.subscriptionId !== p.subscriptionId) throw new GameError("Payment not verified");
  if (!checkoutSignatureOk({ ...p, subscriptionId: m.subscriptionId }, env.keySecret)) {
    throw new GameError("Payment not verified");
  }
  if (m.plan === "founding") await secureSeat(db, m);
  // A webhook may have got here first with the real status and period end: don't undo it.
  if (m.status !== "created") {
    forgetAccess(userId);
    return m;
  }
  // A temporary end so the player is in at once; the webhook sets Razorpay's real current_end.
  const row: MembershipRow = { ...m, status: "authenticated", currentEnd: tempEnd(m.plan, now) };
  await db.saveMembership(row);
  // After the save: a request that read the old row meanwhile mustn't leave "not a member" cached.
  forgetAccess(userId);
  return row;
}

interface SubscriptionEntity {
  id: string;
  status: string;
  /** Unix seconds. */
  current_end?: unknown;
}
type WebhookBody = { event?: string; payload?: { subscription?: { entity?: SubscriptionEntity } } };

export async function handleWebhook(
  db: Db,
  env: PayEnv,
  rawBody: string,
  signature: string | null,
  eventId: string,
  now = new Date(),
): Promise<{ ok: true } | { ok: false; status: number }> {
  if (!webhookSignatureOk(rawBody, signature, env.webhookSecret)) return { ok: false, status: 400 };
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400 };
  }
  // Apply first, then record: applyEvent is idempotent, so a crash or a failed record between the two only means the
  // retry applies it again, and a failed apply records nothing (the error answers 500 and Razorpay retries).
  // A delivery already recorded is answered without touching anything.
  if (await db.hasPaymentEvent(eventId)) return { ok: true };
  await applyEvent(db, body, now);
  await db.insertPaymentEvent(eventId); // false (a parallel delivery recorded it) is fine
  return { ok: true };
}

async function applyEvent(db: Db, body: WebhookBody, now: Date) {
  const sub = body.payload?.subscription?.entity;
  if (!sub?.id) return;
  const charge = body.event === "subscription.activated" || body.event === "subscription.charged";
  const m = await db.membershipBySubscription(sub.id);
  if (!m) {
    // Money taken on a subscription we don't hold (e.g. a replaced checkout paid anyway): a person must refund it.
    if (charge) {
      console.error("UNKNOWN_SUBSCRIPTION_CHARGED", sub.id, body.event);
      await db.recordPaymentIssue("UNKNOWN_SUBSCRIPTION_CHARGED", sub.id);
    }
    return;
  }
  // Webhooks can arrive late or out of order: a finished subscription never comes back to life. A charge for a later
  // period (money taken before the cancel took effect) still extends what the player paid for.
  if (FINAL.has(m.status) && !FINAL.has(sub.status)) {
    const end = charge ? isoEnd(sub.current_end) : null;
    if (end && later(end, m.currentEnd)) {
      await db.saveMembership({ ...m, currentEnd: end });
      forgetAccess(m.userId);
    }
    return;
  }
  const founding = m.plan === "founding";
  switch (body.event) {
    case "subscription.activated":
    case "subscription.charged": {
      // A late charge for a period already stored doesn't undo a failed renewal; only a new period does.
      if (BEHIND.has(m.status) && !later(isoEnd(sub.current_end) ?? tempEnd(m.plan, now), m.currentEnd)) return;
      await db.saveMembership(paidRow(m, sub.status, sub.current_end, now));
      if (founding) await secureSeat(db, m);
      break;
    }
    case "subscription.pending":
    case "subscription.halted":
      await db.saveMembership({ ...m, status: sub.status });
      break;
    case "subscription.cancelled":
    case "subscription.completed":
      await db.saveMembership({ ...m, status: sub.status });
      if (founding) await db.cancelSeat(m.subscriptionId);
      break;
    default:
      return;
  }
  forgetAccess(m.userId);
}

/** Statuses a player can cancel. */
const CANCELLABLE = new Set(["active", "authenticated", "pending", "halted", "created"]);

export async function cancelMembership(db: Db, rp: RazorpayClient, userId: string): Promise<MembershipRow> {
  const m = await db.getMembership(userId);
  if (!m || !CANCELLABLE.has(m.status)) throw new GameError("No active membership");
  // A paid-up member keeps what they paid for until the cycle end; anything else (unpaid, behind) stops now.
  await cancelAt(rp, m.subscriptionId, m.status === "active" || m.status === "authenticated");
  const row: MembershipRow = { ...m, status: "cancelled" };
  await db.saveMembership(row);
  if (m.plan === "founding") await db.cancelSeat(m.subscriptionId);
  forgetAccess(userId);
  return row;
}

/** The paywall applies to everyone with PAYWALL_ON=1, otherwise only to the emails in PAYWALL_TESTERS. */
export function paywallFor(email: string | undefined): boolean {
  if (process.env.PAYWALL_ON === "1") return true;
  if (!email) return false;
  const testers = (process.env.PAYWALL_TESTERS ?? "").split(",").map((s) => s.trim().toLowerCase());
  return testers.includes(email.trim().toLowerCase());
}

export async function accessContext(db: Db, userId: string | null, email: string | undefined, now: Date): Promise<AccessContext> {
  if (!userId) return { paywall: process.env.PAYWALL_ON === "1", member: false, early: new Set() };
  const [m, early] = await Promise.all([db.getMembership(userId), db.earlyAccess(userId)]);
  return { paywall: paywallFor(email), member: isMember(m, now), early };
}

/* The access cache (Task 6 fills it; a payment change clears the player's entry). */
export const accessCache = new Map<string, { ctx: AccessContext; at: number }>();
export function forgetAccess(userId: string) {
  accessCache.delete(userId);
}
