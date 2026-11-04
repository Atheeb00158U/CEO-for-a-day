// When to welcome a new member, once per subscription. The rule is pure (tested); the small storage helpers below
// remember what was shown and when a payment started, on this phone only.

import type { MembershipView } from "./membership-view";

/** How long after starting a payment the app keeps looking for the confirmation. */
export const PAY_WINDOW_MS = 30 * 60_000;

export const paidRecently = (startedAt: number | null, now: number) =>
  startedAt !== null && now >= startedAt && now - startedAt < PAY_WINDOW_MS;

/**
 * The membership to celebrate, or null. `before` is the membership the app last saw for this account
 * (undefined on the first look, e.g. right after opening the app). A first look celebrates only after a recent
 * payment, so an old member on a new phone isn't welcomed again.
 */
export function celebrationFor(x: {
  before: MembershipView | null | undefined;
  now: MembershipView | null;
  shown: readonly string[];
  paidRecently: boolean;
}): MembershipView | null {
  const { before, now } = x;
  if (!now?.member || x.shown.includes(now.subscriptionId)) return null;
  if (before === undefined) return x.paidRecently ? now : null;
  return before?.member ? null : now;
}

const SHOWN = "cfad.welcomed";
const PAY_START = "cfad.payStarted";

/** Subscription ids already celebrated on this phone. */
export function shownWelcomes(): string[] {
  try {
    const x = JSON.parse(localStorage.getItem(SHOWN) ?? "[]");
    return Array.isArray(x) ? x.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function markWelcomed(subscriptionId: string) {
  try {
    localStorage.setItem(SHOWN, JSON.stringify([...shownWelcomes(), subscriptionId].slice(-20)));
    localStorage.removeItem(PAY_START);
  } catch {
    /* private mode: it may show again, which is harmless */
  }
}

export function markPaymentStarted() {
  try {
    localStorage.setItem(PAY_START, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function paymentStartedAt(): number | null {
  try {
    const n = Number(localStorage.getItem(PAY_START));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}
