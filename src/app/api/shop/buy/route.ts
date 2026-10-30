// Buy from the shop at the server's prices.
import { buy } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "buy", async (db, userId) => buy(db, userId, String((await request.json().catch(() => null))?.item ?? "")), 20);
