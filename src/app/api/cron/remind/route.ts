// Called by Supabase pg_cron at the start of every IST hour, with `Authorization: Bearer <CRON_SECRET>`.
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { today, type GameState } from "@/lib/game-state";
import { courseOutline, todaysCall } from "@/lib/server/content";
import { sendReminders } from "@/lib/server/reminders";

const sha = (s: string) => createHash("sha256").update(s).digest();

/** The first lesson on the course path the player hasn't finished, for the morning message. */
function nextLesson(s: GameState) {
  for (const u of courseOutline()?.units ?? [])
    for (const m of u.modules) for (const l of m.lessons) if (!(l.id in s.lessons)) return { title: l.title, minutes: l.minutes };
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !timingSafeEqual(sha(given), sha(secret))) return json({ error: "Not allowed" }, 401);
  return json(await sendReminders(supabaseDb(), todaysCall(today()), undefined, new Date(), nextLesson));
}
