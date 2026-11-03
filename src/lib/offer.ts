// The founding offer and the regular prices (spec: docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md §3).
// Honest by rule: the regular price is shown as a future price, never struck through, and the seat count is real.
export const FOUNDING = { seats: 500, monthly: 99 } as const;
export const REGULAR = { monthly: 199, yearly: 1499 } as const;

const n = (x: number) => x.toLocaleString("en-IN");

export function seatsLine(taken: number): string {
  if (taken >= FOUNDING.seats) return `All ${n(FOUNDING.seats)} founding seats are taken`;
  if (taken <= 0) return `${n(FOUNDING.seats)} founding seats at ₹${FOUNDING.monthly} a month`;
  return `${n(taken)} of ${n(FOUNDING.seats)} founding seats taken`;
}
