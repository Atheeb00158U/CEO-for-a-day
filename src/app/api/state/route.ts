// The signed-in player's progress, rolled forward to today (IST).
import { load } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const GET = (request: Request) => signedIn(request, "state", (db, userId) => load(db, userId));
