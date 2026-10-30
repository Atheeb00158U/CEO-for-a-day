// Turn off streak reminders for one phone.
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(
    request,
    "push",
    async (db) => {
      const endpoint = (await request.json().catch(() => null))?.endpoint;
      if (typeof endpoint === "string") await db.deletePush(endpoint);
      return { ok: true };
    },
    10,
  );
