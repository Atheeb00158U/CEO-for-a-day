// Bring a guest's progress into their new account, once. Every number is capped (see importGuest).
import { importGuest } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "import", async (db, userId) => importGuest(db, userId, (await request.json().catch(() => null))?.save), 5);
