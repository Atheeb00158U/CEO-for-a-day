// What the phone is told about a player's membership (in /api/state and the payment replies). No server code, so both
// the server and the phone can import it.

/** The server's refusals that mean the founding price isn't on offer to this player; the paywall then shows the
 * regular plans. Shared so the server's wording and the phone's check can't drift apart. */
export const SEATS_FULL = "Founding seats are full";
export const FOUNDING_USED = "You lost your founding price when you cancelled";
export const NO_FOUNDING: readonly string[] = [SEATS_FULL, FOUNDING_USED];

export interface MembershipView {
  plan: "founding" | "monthly" | "yearly";
  /** Razorpay's subscription status (created, authenticated, active, pending, halted, cancelled, completed, …). */
  status: string;
  /** When the paid period ends (ISO), or null before the first charge. */
  currentEnd: string | null;
  /** Whether the player may open everything now (isMember in src/lib/access.ts). */
  member: boolean;
  /** The founding seat number, for founding members. */
  seat?: number;
  /** The player kept a founding seat once and cancelled: the founding price is gone for good. */
  foundingUsed: boolean;
}
