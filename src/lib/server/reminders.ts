// Daily streak reminders. Supabase's pg_cron calls /api/cron/remind at the start of every IST hour; this finds the
// players who asked to be reminded at that hour and haven't played today, and sends each one push.
import webpush from "web-push";
import { dayDiff, today } from "../game-state.ts";
import type { Db, PushRow } from "./db.ts";

/** The hour (0–23) in India right now. */
export const istHour = (now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(now));

/** What to say to a player, or null to leave them alone (already played today, or not played for a week). */
export function reminderFor(
  state: { streak: number; lastActiveDay: string | null },
  now = new Date(),
): { title: string; body: string } | null {
  const t = today(now);
  if (!state.lastActiveDay || state.lastActiveDay === t) return null;
  const gap = dayDiff(state.lastActiveDay, t);
  if (gap === 1 && state.streak > 0)
    return {
      title: `Your ${state.streak}-day streak ends tonight`,
      body: "One quick call keeps it alive.",
    };
  if (gap <= 7) return { title: "Today's call is ready", body: "One decision, one minute. Can you make the right call?" };
  return null; // lapsed for over a week: no daily nagging
}

export type Send = (row: PushRow, msg: { title: string; body: string }) => Promise<"sent" | "gone" | "failed">;

/** Sends with web-push, using the VAPID keys from the environment. */
export const webPush: Send = async (row, msg) => {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set on the server");
  try {
    await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify(msg), {
      vapidDetails: { subject: "https://ceoforaday.in", publicKey: pub, privateKey: priv },
      TTL: 6 * 3600, // a reminder older than 6 hours is no use
      urgency: "normal",
    });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "failed";
  }
};

/** Send this hour's reminders. Subscriptions the push service says are gone are deleted. */
export async function sendReminders(db: Db, send: Send = webPush, now = new Date()) {
  const rows = await db.pushesAt(istHour(now));
  const tally = { due: rows.length, sent: 0, skipped: 0, gone: 0, failed: 0 };
  for (const row of rows) {
    const p = await db.getProfile(row.userId);
    const msg = p && reminderFor(p.state, now);
    if (!msg) {
      tally.skipped++;
      continue;
    }
    const r = await send(row, msg);
    if (r === "gone") await db.deletePush(row.endpoint);
    tally[r]++;
  }
  return tally;
}
