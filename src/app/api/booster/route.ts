// Start a double-XP booster, timed by the server's clock.
import { startBooster } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) => signedIn(request, "booster", (db, userId) => startBooster(db, userId), 10);
