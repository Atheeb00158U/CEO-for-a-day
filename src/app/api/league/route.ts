// This week's league board for the signed-in player.
import { leagueBoard } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const GET = (request: Request) => signedIn(request, "league", (db, userId) => leagueBoard(db, userId));
