// Called by Supabase pg_cron at the start of every IST hour, with `Authorization: Bearer <CRON_SECRET>`.
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { sendReminders } from "@/lib/server/reminders";

const sha = (s: string) => createHash("sha256").update(s).digest();

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !timingSafeEqual(sha(given), sha(secret))) return json({ error: "Not allowed" }, 401);
  return json(await sendReminders(supabaseDb()));
}
