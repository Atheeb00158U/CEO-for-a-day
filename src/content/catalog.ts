// The parts of the catalog the phone may hold: ordering rules and ids, never a Hot Seat's answers.
// The catalog itself comes from the server (src/lib/server/content.ts) through the /app page.
import { playerOrder } from "@/lib/engine";
import type { Focus } from "@/lib/game-state";
import type { CatalogEntry } from "@/lib/hotseat-types";

/** The Hot Seat a new player tries on the welcome screens (its first two calls), and the first one on Home after. */
export const TRIAL_ID = "kingfisher-airlines";

/** Hot Seats that fit what the player said they want to get better at. Ids that don't exist yet are skipped. */
const FOCUS: Record<Focus, string[]> = {
  scratch: ["amul-one-brand", "indigo-one-plane-type", "maruti-800"],
  rival: ["new-coke", "nokia", "apple-1997-comeback", "tanishq-karatmeter"],
  money: ["kingfisher-airlines", "harshad-mehta", "lego-turnaround"],
  change: ["kodak", "blockbuster", "netflix", "intel-quits-memory"],
};

/** Home's order: the trial first, then Hot Seats for the player's focus, then their seeded order. */
export function homeOrder(items: CatalogEntry[], seed: string, focus?: Focus): CatalogEntry[] {
  const first = [TRIAL_ID, ...(focus ? FOCUS[focus] : [])];
  const rank = (c: CatalogEntry) => (first.includes(c.id) ? first.indexOf(c.id) : first.length);
  return playerOrder(items, seed)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}
