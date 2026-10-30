// Turn on streak reminders for this phone at an hour (IST).
import { GameError } from "@/lib/server/game";
import { signedIn } from "@/lib/server/http";

export const POST = (request: Request) =>
  signedIn(
    request,
    "push",
    async (db, userId) => {
      const body = await request.json().catch(() => null);
      const sub = body?.subscription;
      const hour = Number(body?.hour);
      const endpoint = typeof sub?.endpoint === "string" && /^https:\/\//.test(sub.endpoint) ? sub.endpoint : "";
      const keys = sub?.keys;
      if (
        !endpoint ||
        typeof keys?.p256dh !== "string" ||
        typeof keys?.auth !== "string" ||
        !Number.isInteger(hour) ||
        hour < 0 ||
        hour > 23
      )
        throw new GameError("bad subscription");
      await db.savePush({ endpoint, userId, keys: { p256dh: keys.p256dh, auth: keys.auth }, remindHour: hour });
      return { ok: true };
    },
    10,
  );
