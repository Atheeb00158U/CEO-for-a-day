// Claim a finished quest's coins, once a day.
import { claimQuest } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "quest", async (db, userId) => claimQuest(db, userId, String((await request.json().catch(() => null))?.id ?? "")), 20);
