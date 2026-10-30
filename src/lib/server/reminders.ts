// Automatic notifications. Supabase's pg_cron calls /api/cron/remind at the start of every IST hour, and this plans
// what each player with reminders on should get. The "overtaken" alert is sent straight after a league change.
//
// Guardrails, so the game never nags: nothing between 10 pm and 8 am IST, at most two notifications a player a day
// (all kinds together), each kind at most once a day (logged in notifications_sent), and nothing at all after a
// player has been away for over a week.
import webpush from "web-push";
import { dayDiff, LEAGUES, today, weekId } from "../game-state.ts";
import type { DailyCall } from "../hotseat-types";
import type { Db, LeagueRow, PushRow } from "./db.ts";
import { LEAGUE_FULL, leagueTier, MOVE } from "./game.ts";

export interface Message {
  title: string;
  body: string;
}

/** The hour (0–23) in India right now. */
export const istHour = (now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(now));

/** 0 = Sunday … 6 = Saturday, in India. */
const istWeekday = (now = new Date()) => new Date(today(now) + "T00:00:00Z").getUTCDay();

export const QUIET = { from: 22, to: 8 }; // no notifications from 10 pm to 8 am IST
export const DAILY_CAP = 2;
const MORNING = 9;
const quiet = (hour: number) => hour >= QUIET.from || hour < QUIET.to;

/** The streak warning, or a win-back message after a break. Sent at the player's chosen hour. */
export function reminderFor(
  state: { streak: number; lastActiveDay: string | null },
  now = new Date(),
): (Message & { kind: string }) | null {
  const t = today(now);
  if (!state.lastActiveDay || state.lastActiveDay === t) return null;
  const gap = dayDiff(state.lastActiveDay, t);
  if (gap === 1 && state.streak > 0)
    return { kind: "streak", title: `Your ${state.streak}-day streak ends tonight`, body: "Play a Hot Seat today to keep it." };
  if (gap === 2)
    return {
      kind: "winback2",
      title: state.streak > 1 ? "Your streak has ended" : "Your next call is waiting",
      body: "Start a new streak today with one Hot Seat.",
    };
  if (gap === 4)
    return { kind: "winback4", title: "A Hot Seat is waiting for you", body: "Can you beat what the real CEO did? About five minutes." };
  if (gap === 7)
    return {
      kind: "winback7",
      title: "Still thinking like a CEO?",
      body: "Your notes and your league are waiting. One Hot Seat gets you back in.",
    };
  return null; // other days of a break, or away for over a week: leave them alone
}

/** The morning teaser for today's Daily Call, for players who have played this week but not yet today. */
export function morningCall(
  state: { lastActiveDay: string | null },
  call: DailyCall | undefined,
  now = new Date(),
): (Message & { kind: string }) | null {
  if (!call || !state.lastActiveDay) return null;
  const gap = dayDiff(state.lastActiveDay, today(now));
  if (gap < 1 || gap > 7) return null;
  return { kind: "daily", title: `Today's call: ${call.company}, ${call.year}`, body: `${call.title}. What would you do?` };
}

/** Who moves up from a group: the top `count` real players with at least `minXp` (as in nextTier). */
const promotion = (n: number, tier: number) =>
  n >= LEAGUE_FULL ? { count: MOVE, minXp: 1 } : { count: Math.max(1, Math.floor(n * 0.2)), minXp: 100 * (tier + 1) };

/** Sunday's "league ends tonight", with how far the player is from moving up. */
export function leagueEnding(rows: LeagueRow[], userId: string): (Message & { kind: string }) | null {
  const ranked = [...rows].sort((a, b) => b.weeklyXp - a.weeklyXp);
  const rank = ranked.findIndex((r) => r.userId === userId);
  if (rank < 0) return null;
  const me = ranked[rank];
  const { count, minXp } = promotion(ranked.length, me.tier);
  const inZone = rank < count && me.weeklyXp >= minXp;
  const need = Math.max(minXp, (ranked[count - 1]?.weeklyXp ?? 0) + 1) - me.weeklyXp;
  const title = `Your ${LEAGUES[me.tier]} league ends tonight`;
  if (inZone) return { kind: "league_end", title, body: `You're #${rank + 1}, in the zone to move up. Hold on to it.` };
  return { kind: "league_end", title, body: `You're #${rank + 1}. ${need} more XP moves you up.` };
}

export type Send = (row: PushRow, msg: Message) => Promise<"sent" | "gone" | "failed">;

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

type Tally = { sent: number; gone: number; failed: number };

/**
 * Send `msg` to all of a player's phones, if the guardrails allow: not in quiet hours, under the daily cap, and this
 * kind not already sent today. Returns false when it was held back.
 */
async function deliver(db: Db, userId: string, phones: PushRow[], msg: Message & { kind: string }, send: Send, now: Date, tally: Tally) {
  const day = today(now);
  if (quiet(istHour(now)) || (await db.noticesOn(userId, day)) >= DAILY_CAP) return false;
  if (!(await db.logNotice(userId, msg.kind, day))) return false;
  for (const row of phones) {
    const r = await send(row, { title: msg.title, body: msg.body });
    if (r === "gone") await db.deletePush(row.endpoint);
    tally[r]++;
  }
  return true;
}

/** This hour's notifications for every player with reminders on. */
export async function sendReminders(db: Db, call: DailyCall | undefined, send: Send = webPush, now = new Date()) {
  const hour = istHour(now);
  const tally = { players: 0, sent: 0, gone: 0, failed: 0, held: 0 };
  if (quiet(hour)) return tally;
  const byUser = new Map<string, PushRow[]>();
  for (const row of await db.pushes()) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
  const week = weekId(now);
  const weekday = istWeekday(now);
  for (const [userId, phones] of byUser) {
    const p = await db.getProfile(userId);
    if (!p) continue;
    tally.players++;
    const due: (Message & { kind: string })[] = [];
    const remindHour = phones[0].remindHour;
    // Monday morning: news of a move up.
    if (weekday === 1 && hour === MORNING) {
      const last = await db.lastLeague(userId, week);
      const { tier } = await leagueTier(db, userId, now);
      if (last && tier > last.tier)
        due.push({
          kind: "promoted",
          title: `You moved up to the ${LEAGUES[tier]} league!`,
          body: "A new week and a tougher group. Keep climbing.",
        });
    }
    if (hour === remindHour) {
      const r = reminderFor(p.state, now);
      if (r) due.push(r);
      // Sunday: the league closes at midnight.
      if (weekday === 0) {
        const row = await db.getLeague(week, userId);
        const ending = row && leagueEnding(await db.cohort(week, row.cohort), userId);
        if (ending) due.push(ending);
      }
    }
    if (hour === MORNING) {
      const m = morningCall(p.state, call, now);
      if (m) due.push(m);
    }
    for (const msg of due) if (!(await deliver(db, userId, phones, msg, send, now, tally))) tally.held++;
  }
  return tally;
}

/**
 * After `userId` gained XP: tell each real player in their group that they just passed. Once a day per player, and
 * within the same guardrails. Bots never trigger it.
 */
export async function notifyOvertaken(db: Db, userId: string, beforeXp: number, send: Send = webPush, now = new Date()) {
  const tally = { sent: 0, gone: 0, failed: 0 };
  const week = weekId(now);
  const me = await db.getLeague(week, userId);
  if (!me || me.weeklyXp <= beforeXp) return tally;
  const passed = (await db.cohort(week, me.cohort)).filter(
    (r) => r.userId !== userId && r.weeklyXp >= beforeXp && r.weeklyXp < me.weeklyXp,
  );
  if (!passed.length) return tally;
  const name = (await db.names([userId]))[userId];
  const who = name && name !== "You" ? name : "A player";
  for (const r of passed) {
    const phones = await db.pushes(r.userId);
    if (!phones.length) continue;
    await deliver(
      db,
      r.userId,
      phones,
      {
        kind: "overtaken",
        title: `${who} just passed you`,
        body: `in the ${LEAGUES[me.tier]} league. Win your place back with one Hot Seat.`,
      },
      send,
      now,
      tally,
    );
  }
  return tally;
}

/** Send one message now to every subscribed phone, or to one player's phones. For the admin page; no guardrails. */
export async function broadcast(db: Db, msg: Message, userId?: string, send: Send = webPush) {
  const rows = await db.pushes(userId);
  const tally = { phones: rows.length, sent: 0, gone: 0, failed: 0 };
  for (const row of rows) {
    const r = await send(row, msg);
    if (r === "gone") await db.deletePush(row.endpoint);
    tally[r]++;
  }
  return tally;
}
