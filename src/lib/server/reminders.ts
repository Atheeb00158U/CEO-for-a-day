// Automatic notifications. Supabase's pg_cron calls /api/cron/remind at the start of every IST hour, and this plans
// what each player with reminders on should get. The "overtaken" alert is sent straight after a league change.
//
// The day of an active player who hasn't played yet (IST):
//   9 am         next lesson (or today's Daily Call, when calls are on); Monday also brings a league move up
//   1 pm         flashcards that are due (3+ cards also keep the streak)
//   their hour   the streak warning with the hours left, or a win-back line on days 2–7 of a break
//   9 pm         last call for the streak, if their hour was 7 pm or earlier
//   Sunday       the league ends tonight (at their hour)
// Each slot is also tried the hour after, so one missed cron run doesn't lose it.
//
// Guardrails, so the game never nags: nothing between 10 pm and 8 am IST, at most four a day in all, and the fourth
// only to save a streak; each kind at most once a day (logged in notifications_sent); nothing after a week away.
import webpush from "web-push";
import { cardsToday, dayDiff, LEAGUES, today, weekId, withDefaults, type GameState } from "../game-state.ts";
import type { DailyCall } from "../hotseat-types";
import type { Db, LeagueRow, PushRow } from "./db.ts";
import { LEAGUE_FULL, leagueTier, MOVE } from "./game.ts";

export interface Message {
  title: string;
  body: string;
  /** A wide picture under the text (Android and desktop Chrome; iPhones show only the app icon). */
  image?: string;
  /** Notifications with the same tag replace each other on the phone. */
  tag?: string;
  /** Where a tap goes. */
  url?: string;
}

export type Notice = Message & { kind: string };

/** The hour (0–23) in India right now. */
export const istHour = (now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(now));

/** 0 = Sunday … 6 = Saturday, in India. */
const istWeekday = (now = new Date()) => new Date(today(now) + "T00:00:00Z").getUTCDay();

/** Whole hours left until midnight in India, when the day (and an unkept streak) ends. */
export const hoursLeft = (now = new Date()) => {
  const midnight = Date.parse(today(now) + "T00:00:00+05:30") + 864e5;
  return Math.floor((midnight - now.getTime()) / 36e5);
};

export const QUIET = { from: 22, to: 8 }; // no notifications from 10 pm to 8 am IST
export const DAILY_CAP = 4; // the last of these is kept for saving a streak
const MORNING = 9;
const MIDDAY = 13;
const LAST_CALL = 21;
const quiet = (hour: number) => hour >= QUIET.from || hour < QUIET.to;
/** A slot at `at` is tried that hour and the next, in case a cron run was missed. */
const slot = (hour: number, at: number) => hour === at || hour === at + 1;

// Pictures: wide banners of the wolf, made by `npm run brand` (scripts/brand-images.mjs).
const banner = (pose: string) => `/brand/wolf/notify-${pose}.jpg`;
const STREAK_KINDS = new Set(["streak", "streak_last", "cards_streak"]);

/** One of `lines`, a different one each day, so the same words don't come back day after day. */
const pick = <T>(lines: T[], now: Date) => lines[Math.floor(Date.parse(today(now)) / 864e5) % lines.length];

const hrs = (h: number) => (h <= 1 ? "1 hour" : `${h} hours`);

type Player = Pick<GameState, "streak" | "lastActiveDay">;

/** The streak warning, or a win-back message after a break. Sent at the player's chosen hour. */
export function reminderFor(state: Player, now = new Date()): Notice | null {
  const t = today(now);
  if (!state.lastActiveDay || state.lastActiveDay === t) return null;
  const gap = dayDiff(state.lastActiveDay, t);
  const n = state.streak;
  if (gap === 1 && n > 0)
    return {
      kind: "streak",
      title: `${hrs(hoursLeft(now))} left to keep your ${n}-day streak`,
      body: pick(["One short lesson keeps it alive.", "Play one lesson before midnight.", "One lesson takes about 4 minutes."], now),
      image: banner("pose-worried"),
      tag: "streak",
    };
  const back = (title: string, body: string, pose: string): Notice => ({
    kind: `winback${gap}`,
    title,
    body,
    image: banner(pose),
    tag: "winback",
  });
  if (gap === 2)
    return back(
      n > 1 ? "Your streak has ended" : "Your next lesson is waiting",
      "Start a new streak today with one lesson.",
      "pose-thinking",
    );
  if (gap === 3) return back("One story. One big decision.", "Play a Hot Seat and decide what the CEO should do.", "pose-pointing");
  if (gap === 4) return back("What would you do as CEO?", "Play one Hot Seat. Make your own decision.", "pose-pointing");
  if (gap === 5) return back("Your notes are waiting", "Review a few cards. It takes two minutes.", "pose-pleased");
  if (gap === 6) return back("Your next lesson is ready", "Start when you have 4 minutes.", "pose-thinking");
  if (gap === 7) return back("Ready for your next lesson?", "Your notes and league are here. Play one lesson today.", "pose-thinking");
  return null; // away for over a week: leave them alone
}

/** 9 pm: the last call for a streak that's still not kept today. */
export function lastCall(state: Player, now = new Date()): Notice | null {
  if (!state.lastActiveDay || dayDiff(state.lastActiveDay, today(now)) !== 1 || state.streak < 1) return null;
  return {
    kind: "streak_last",
    title: `${hrs(hoursLeft(now))} left for your streak`,
    body: `Your ${state.streak}-day streak ends at midnight. Play one lesson to keep it.`,
    image: banner("pose-shocked"),
    tag: "streak", // replaces the earlier streak warning
  };
}

/** What a player plays next on the course, for the morning message. */
export type NextUp = (state: GameState) => { title: string; minutes: number } | undefined;

/**
 * The morning message for players who played yesterday: today's Daily Call when calls are on, else their next lesson,
 * else a Hot Seat.
 */
export function morningCall(state: GameState, call: DailyCall | undefined, now = new Date(), next?: NextUp): Notice | null {
  if (!state.lastActiveDay || dayDiff(state.lastActiveDay, today(now)) !== 1) return null;
  const m = { kind: "daily", image: banner("pose-pointing"), tag: "morning" };
  if (call) return { ...m, title: `Today's call: ${call.company}, ${call.year}`, body: `${call.title}. What would you do?` };
  const up = next?.(state);
  if (up) return { ...m, title: `Next up: ${up.title}`, body: `One short lesson. About ${up.minutes} minutes.` };
  return { ...m, title: "Make a CEO's decision today", body: "Play one Hot Seat. What would you do as the CEO?" };
}

/** 1 pm: flashcards that are due, for players who played in the last three days. Three of them keep a streak. */
export function cardsDue(state: GameState, now = new Date()): Notice | null {
  if (!state.lastActiveDay) return null;
  const gap = dayDiff(state.lastActiveDay, today(now));
  const n = cardsToday(state, now).length;
  if (gap > 2 || n < 3) return null;
  const base = { title: `${n} cards are ready for you`, image: banner("pose-pleased"), tag: "cards", url: "/app#notes" };
  if (gap === 1 && state.streak > 0) return { ...base, kind: "cards_streak", body: `Review them to keep your ${state.streak}-day streak.` };
  return { ...base, kind: "cards", body: "Take two minutes to remember what you learned." };
}

/** Who moves up from a group: the top `count` real players with at least `minXp` (as in nextTier). */
const promotion = (n: number, tier: number) =>
  n >= LEAGUE_FULL ? { count: MOVE, minXp: 1 } : { count: Math.max(1, Math.floor(n * 0.2)), minXp: 100 * (tier + 1) };

/** Sunday's "league ends tonight", with how far the player is from moving up. */
export function leagueEnding(rows: LeagueRow[], userId: string): Notice | null {
  const ranked = [...rows].sort((a, b) => b.weeklyXp - a.weeklyXp);
  const rank = ranked.findIndex((r) => r.userId === userId);
  if (rank < 0) return null;
  const me = ranked[rank];
  const { count, minXp } = promotion(ranked.length, me.tier);
  const inZone = rank < count && me.weeklyXp >= minXp;
  const need = Math.max(minXp, (ranked[count - 1]?.weeklyXp ?? 0) + 1) - me.weeklyXp;
  const m = { kind: "league_end", title: `Your ${LEAGUES[me.tier]} league ends tonight`, image: banner("pose-warning"), tag: "league" };
  if (inZone) return { ...m, body: `You are rank ${rank + 1} and in line to move up. Keep your place.` };
  return { ...m, body: `You are rank ${rank + 1}. Earn ${need} more XP to move up.` };
}

export type Send = (row: PushRow, msg: Message, ttl?: number) => Promise<"sent" | "gone" | "failed">;

/** Seconds until quiet hours start: a reminder that arrives at night is no use. At least an hour, at most six. */
export const ttlAt = (now = new Date()) => {
  const quietAt = Date.parse(today(now) + `T${QUIET.from}:00:00+05:30`);
  return Math.max(3600, Math.min(6 * 3600, Math.floor((quietAt - now.getTime()) / 1000)));
};

/** Sends with web-push, using the VAPID keys from the environment. A failure is tried once more. */
export const webPush: Send = async (row, msg, ttl = 6 * 3600) => {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set on the server");
  for (let attempt = 0; ; attempt++) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify(msg), {
        vapidDetails: { subject: "https://ceoforaday.in", publicKey: pub, privateKey: priv },
        TTL: ttl,
        urgency: msg.tag === "streak" ? "high" : "normal",
      });
      return "sent";
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) return "gone";
      if (attempt > 0) return "failed";
    }
  }
};

type Tally = { sent: number; gone: number; failed: number };

/**
 * Send `msg` to all of a player's phones, if the guardrails allow: not in quiet hours, under the daily cap (the last
 * place is only for saving a streak), and this kind not already sent today. Returns false when it was held back.
 */
async function deliver(db: Db, userId: string, phones: PushRow[], msg: Notice, send: Send, now: Date, tally: Tally) {
  const day = today(now);
  const cap = STREAK_KINDS.has(msg.kind) ? DAILY_CAP : DAILY_CAP - 1;
  if (quiet(istHour(now)) || (await db.noticesOn(userId, day)) >= cap) return false;
  if (!(await db.logNotice(userId, msg.kind, day))) return false;
  const { kind, ...payload } = msg;
  const results: string[] = [];
  for (const row of phones) {
    const r = await send(row, payload, ttlAt(now));
    if (r === "gone") await db.deletePush(row.endpoint);
    tally[r]++;
    results.push(r);
  }
  await db.noticeResult(userId, kind, day, results.join(","));
  return true;
}

/** This hour's notifications for every player with reminders on. */
export async function sendReminders(db: Db, call: DailyCall | undefined, send: Send = webPush, now = new Date(), next?: NextUp) {
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
    const state = withDefaults(p.state);
    const due: Notice[] = [];
    const remindHour = phones[0].remindHour;
    if (slot(hour, MORNING)) {
      // Monday morning: news of a move up.
      if (weekday === 1) {
        const last = await db.lastLeague(userId, week);
        const { tier } = await leagueTier(db, userId, now);
        if (last && tier > last.tier)
          due.push({
            kind: "promoted",
            title: `You moved up to the ${LEAGUES[tier]} league!`,
            body: "You are in a new group now. Play lessons to earn XP.",
            image: banner("pose-celebrating"),
            tag: "league",
          });
      }
      const m = morningCall(state, call, now, next);
      if (m) due.push(m);
    }
    if (slot(hour, MIDDAY)) {
      const c = cardsDue(state, now);
      if (c) due.push(c);
    }
    if (slot(hour, remindHour)) {
      const r = reminderFor(state, now);
      if (r) due.push(r);
      // Sunday: the league closes at midnight.
      if (weekday === 0) {
        const row = await db.getLeague(week, userId);
        const ending = row && leagueEnding(await db.cohort(week, row.cohort), userId);
        if (ending) due.push(ending);
      }
    }
    // The last call, for players whose own hour is early enough that it isn't a second warning straight after.
    if (slot(hour, LAST_CALL) && remindHour <= LAST_CALL - 2) {
      const l = lastCall(state, now);
      if (l) due.push(l);
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
    const gap = me.weeklyXp - r.weeklyXp;
    await deliver(
      db,
      r.userId,
      phones,
      {
        kind: "overtaken",
        title: `${who} moved ahead of you`,
        body: `${who} has ${gap} more XP in the ${LEAGUES[me.tier]} league. Play a lesson to earn XP.`,
        image: banner("pose-shocked"),
        tag: "league",
        url: "/app#league",
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
