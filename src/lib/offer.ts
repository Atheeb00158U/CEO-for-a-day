// The founding offer and the regular prices (spec: docs/superpowers/specs/2026-11-03-wolf-ambassador-design.md §3).
// Honest by rule: ₹199 is struck through only because it is the real price charged once the founding seats are gone.
// Players never see how many seats are taken.
export const FOUNDING = { seats: 1000, monthly: 99 } as const;
export const REGULAR = { monthly: 199, yearly: 1499 } as const;

const rs = (x: number) => `₹${x.toLocaleString("en-IN")}`;

/** Shown wherever the founding offer is. */
export const FOUNDING_LINE = `Founding price, only for the first ${FOUNDING.seats.toLocaleString("en-IN")} members.`;

/** "<s>₹199</s> ₹99 a month", with the words a screen reader says instead. */
export const foundingPrice = {
  was: rs(REGULAR.monthly),
  now: `${rs(FOUNDING.monthly)} a month`,
  label: `was ${rs(REGULAR.monthly)}, now ${rs(FOUNDING.monthly)} a month`,
} as const;
