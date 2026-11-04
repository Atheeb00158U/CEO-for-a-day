// What the phone is told about a player's membership (in /api/state and the payment replies). Types only, so both the
// server and the phone can import it.
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
}
