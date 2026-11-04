// The signed-in player's progress, rolled forward to today (IST), with their membership and whether the paywall
// applies to them.
import { load } from "@/lib/server/game";
import { emailFrom, signedIn } from "@/lib/server/http";
import { paywallFor } from "@/lib/server/membership";

export const GET = (request: Request) =>
  signedIn(request, "state", async (db, userId) => ({ ...(await load(db, userId)), paywall: paywallFor(await emailFrom(request)) }));
