// Name, settings and the welcome answers: the only parts of progress the phone may set.
import { updateProfile } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(request, "profile", async (db, userId) => updateProfile(db, userId, (await request.json().catch(() => ({}))) ?? {}));
