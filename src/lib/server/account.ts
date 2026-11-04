// Deleting an account (India's DPDP Act gives players this right). A deleted account must never keep being charged,
// so any live subscription is cancelled at Razorpay first, at once; if that fails, nothing is deleted.
import type { Db } from "./db.ts";
import { GameError } from "./game.ts";
import { forgetAccess } from "./membership.ts";
import type { RazorpayClient } from "./razorpay.ts";

/** Statuses after which Razorpay never charges again: nothing to cancel. */
const FINAL = new Set(["cancelled", "completed", "expired"]);
/** Razorpay's refusal when the subscription is already over (e.g. a webhook we haven't had yet). */
const ALREADY_OVER = /already cancell?ed|(cancell?ed|completed|expired) (state|status)/i;

export const CANT_CANCEL = "We could not stop your membership payments yet, so your account is not deleted. Try again in a few minutes.";

/** `rp` is a getter, so an account with no membership needs no Razorpay keys. */
export async function deleteAccount(db: Db, rp: () => RazorpayClient, userId: string): Promise<{ deleted: true }> {
  const m = await db.getMembership(userId);
  if (m && !FINAL.has(m.status)) {
    try {
      await rp().cancelSubscription(m.subscriptionId, false);
    } catch (e) {
      if (!(e instanceof Error && ALREADY_OVER.test(e.message))) {
        console.error(`account delete: cancelling ${m.subscriptionId} failed; account kept`);
        throw new GameError(CANT_CANCEL);
      }
    }
  }
  await db.deleteUser(userId);
  forgetAccess(userId);
  return { deleted: true };
}
