// Payments (spec §4 and §4a): checkout, its verification, webhooks, cancelling, and who is a member.
// Everything takes the Db, the Razorpay client and the env as arguments, so tests use memoryDb() and a fake client.
import { isMember, type AccessContext } from "../access.ts";
import { FOUNDING } from "../offer.ts";
import type { Db, MembershipRow } from "./db.ts";
import { GameError } from "./game.ts";
import { checkoutSignatureOk, webhookSignatureOk, type RazorpayClient } from "./razorpay.ts";

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

export async function startCheckout(db: Db, rp: RazorpayClient, env: PayEnv, userId: string, plan: Plan, now: Date) {
  const current = await db.getMembership(userId);
  if (isMember(current, now)) throw new GameError("Already a member");
  if (plan === "founding") {
    // A fresh count, not the landing page's cache. The player's own live hold is about to move, so it doesn't count
    // against them; claimSeat below is the real check, under the database lock.
    const ownHold = current?.plan === "founding" && current.status === "created";
    if (!ownHold && (await db.countFoundingSeats()) >= FOUNDING.seats) throw new GameError(SEATS_FULL);
  }
  const sub = await rp.createSubscription(env.plans[plan], env.totalCount[plan], { userId, plan });
  if (plan === "founding" && (await db.claimSeat(userId, sub.id)) === null) {
    await rp.cancelSubscription(sub.id, false);
    throw new GameError(SEATS_FULL);
  }
  await db.saveMembership({ userId, plan, subscriptionId: sub.id, status: "created", currentEnd: null });
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
  if (m.plan === "founding") await db.keepSeat(m.subscriptionId);
  // A webhook may have got here first with the real status and period end: don't undo it.
  if (m.status !== "created") return m;
  // A temporary end so the player is in at once; the webhook sets Razorpay's real current_end.
  const days = m.plan === "yearly" ? 370 : 35;
  const row: MembershipRow = {
    ...m,
    status: "authenticated",
    currentEnd: new Date(now.getTime() + days * DAY_MS).toISOString(),
  };
  await db.saveMembership(row);
  return row;
}

interface SubscriptionEntity {
  id: string;
  status: string;
  /** Unix seconds. */
  current_end: number | null;
}

export async function handleWebhook(
  db: Db,
  env: PayEnv,
  rawBody: string,
  signature: string | null,
  eventId: string,
): Promise<{ ok: true } | { ok: false; status: number }> {
  if (!webhookSignatureOk(rawBody, signature, env.webhookSecret)) return { ok: false, status: 400 };
  if (!(await db.insertPaymentEvent(eventId))) return { ok: true };
  let body: { event?: string; payload?: { subscription?: { entity?: SubscriptionEntity } } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400 };
  }
  const sub = body.payload?.subscription?.entity;
  if (!sub?.id) return { ok: true };
  const m = await db.membershipBySubscription(sub.id);
  if (!m) return { ok: true };
  const founding = m.plan === "founding";
  switch (body.event) {
    case "subscription.activated":
    case "subscription.charged":
      await db.saveMembership({
        ...m,
        status: sub.status,
        currentEnd: sub.current_end ? new Date(sub.current_end * 1000).toISOString() : m.currentEnd,
      });
      if (founding) await db.keepSeat(m.subscriptionId);
      break;
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
      return { ok: true };
  }
  forgetAccess(m.userId);
  return { ok: true };
}

export async function cancelMembership(db: Db, rp: RazorpayClient, userId: string): Promise<MembershipRow> {
  const m = await db.getMembership(userId);
  if (!m || m.status === "cancelled") throw new GameError("No active membership");
  // At the cycle end: the player keeps what they paid for.
  await rp.cancelSubscription(m.subscriptionId, true);
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
