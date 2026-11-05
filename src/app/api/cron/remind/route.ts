// Called by Supabase pg_cron at the start of every IST hour, with `Authorization: Bearer <CRON_SECRET>`: reminders,
// then the Club picture clean-up.
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { today } from "@/lib/game-state";
import { todaysCall } from "@/lib/server/content";
import { sendReminders } from "@/lib/server/reminders";
import { purgeImages } from "@/lib/server/club";

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !timingSafeEqual(sha(given), sha(secret))) return json({ error: "Not allowed" }, 401);
  const db = supabaseDb();
  const sent = await sendReminders(db, todaysCall(today()));
  // Club pictures nobody uses, and removed ones past their 180 days. A failure here never stops the reminders.
  const images = await purgeImages(db).catch((e) => (console.error("club: image purge", e), null));
  return json({ ...sent, images });
}
