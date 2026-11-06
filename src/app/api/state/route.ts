// The signed-in player's progress, rolled forward to today (IST), with their membership and whether the paywall
// and the Club apply to them.
import { load } from "@/lib/server/game";
import { emailFrom, signedIn } from "@/lib/server/http";
import { clubOn, paywallFor } from "@/lib/server/membership";

export const GET = (request: Request) =>
  signedIn(request, "state", async (db, userId) => {
    const email = await emailFrom(request);
    return { ...(await load(db, userId)), paywall: paywallFor(email), club: clubOn() };
  });
