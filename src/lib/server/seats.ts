// How many of the 500 founding seats are taken, for the landing page and the paywall.
import { FOUNDING } from "../offer.ts";
import type { Db } from "./db.ts";

export async function seatStatus(db: Db) {
  const taken = await db.countFoundingSeats();
  return { taken, total: FOUNDING.seats, open: taken < FOUNDING.seats };
}
