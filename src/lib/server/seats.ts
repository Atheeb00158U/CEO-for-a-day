// How many of the 1,000 founding seats are taken, for the landing page and the paywall (never shown to players).
import { FOUNDING } from "../offer.ts";
import type { Db } from "./db.ts";

export async function seatStatus(db: Db) {
  const taken = await db.countFoundingSeats();
  return { taken, total: FOUNDING.seats, open: taken < FOUNDING.seats };
}

type Status = Awaited<ReturnType<typeof seatStatus>>;
const TTL_MS = 15_000;
let last: { at: number; status: Status } | undefined;

/** Test helper: forget the cached count. */
export function resetSeatCache() {
  last = undefined;
}

/**
 * The seat count kept for 15 s (Railway runs one instance, so a module variable is enough).
 * For display only: the paywall must decide seats under the database lock, never from this cache.
 * If the database fails, the last good value is returned; with none, the error is rethrown.
 */
export async function cachedSeatStatus(db: Db, now = Date.now()): Promise<Status> {
  if (last && now - last.at < TTL_MS) return last.status;
  try {
    last = { at: now, status: await seatStatus(db) };
    return last.status;
  } catch (e) {
    if (last) return last.status;
    throw e;
  }
}
