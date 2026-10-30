import type { DailyCall, DailyOption, Grade, TraitKey } from "./hotseat-types";
import { DEMOTE, leagueRows, PROMOTE } from "./league.ts";

/* ------------------------------------------------------------------ */
/* Economy. Tune these in one place.                                   */
/* ------------------------------------------------------------------ */
export const ECONOMY = {
  completionXp: 10, // flat XP for finishing a Hot Seat (score adds 0–100 on top)
  completionCoins: 20,
  boosterMinutes: 15,
  prices: { freeze: 200, booster: 150, hindsight: 100 },
  starter: { coins: 120, freezes: 1, hindsights: 1, boosters: 1 },
  dailyXp: { great: 15, ok: 10, bad: 5 } satisfies Record<Grade, number>,
};

export const LEAGUES = ["Intern", "Manager", "Director", "VP", "CEO", "Tycoon"] as const;

export const BADGES: Record<string, { name: string; desc: string }> = {
  first_seat: { name: "First day", desc: "Finish your first Hot Seat" },
  turnaround: { name: "Turnaround artist", desc: "Fix a bad call later in the same Hot Seat" },
  perfect: { name: "Flawless", desc: "Score 95 or more" },
  beat_history: { name: "Beat history", desc: "Get a better ending than the real company" },
  streak_3: { name: "On a roll", desc: "Reach a 3-day streak" },
  fired: { name: "Clean desk", desc: "Get fired by the board. Everyone does once." },
};

export interface RunRecord {
  hotSeatId: string;
  score: number;
  xp: number;
  endingId: string;
  endingTier: string;
  at: number;
  notes: { year: string; title: string; choice: string; grade: Grade; real: boolean; takeaway: string; better?: string }[];
  patterns: string[];
}

export interface GameState {
  v: 1;
  seed: string;
  name: string;
  xp: number;
  coins: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  freezes: number;
  boosters: number;
  boosterUntil: number;
  hindsights: number;
  league: { tier: number; weekId: string; weeklyXp: number };
  runs: RunRecord[];
  best: Record<string, number>;
  quests: { day: string; decisions: number; great: number; xp: number; claimed: string[] };
  badges: string[];
  traits: Record<TraitKey, number>;
  settings: { voice: boolean; sfx: boolean; dataSaver: boolean; lang: "en" | "hi" | "ta" | "bn" };
  /** Today's Daily Call, saved the moment it's locked in so closing the app can't buy a second try. */
  daily: { day: string; id: string; optionId: string; grade: Grade; xp: number } | null;
  /** Takeaways from past Daily Calls, newest first (last 60). */
  dailyLog: DailyNote[];
  /** First-visit answers. `done` once the player finishes or skips the welcome screens. */
  onboarding: Onboarding;
}

export type Doing = "job" | "starting" | "running" | "student" | "curious";
export type Focus = "scratch" | "rival" | "money" | "change";
export interface Onboarding {
  done: boolean;
  doing?: Doing;
  focus?: Focus;
  /** Minutes a day the player wants to play. Sets the daily decisions quest. */
  minutes?: 5 | 10 | 15;
}

/** Decisions a day for the "Make N decisions" quest: about one decision a minute and a half. */
export const decisionGoal = (minutes: Onboarding["minutes"] = 5) => ({ 5: 3, 10: 6, 15: 9 })[minutes];

export interface DailyNote {
  day: string;
  company: string;
  title: string;
  choice: string;
  grade: Grade;
  real: boolean;
  takeaway: string;
  better?: string;
}

// One clock for everyone: the date in India. Streaks, quests, the Daily Call and league weeks all turn over at
// midnight IST, on the phone and on the server alike, wherever the player is.
const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" in India. */
export const today = (d = new Date()) => IST_DATE.format(d);
/** The Monday (IST) that starts this league week, as "YYYY-MM-DD". */
export const weekId = (d = new Date()) => {
  const t = new Date(today(d) + "T00:00:00Z");
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
};
/** The moment an IST date starts. */
export const istMidnight = (day: string) => new Date(day + "T00:00:00+05:30");
export const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

export function fresh(): GameState {
  const seed = Math.random().toString(36).slice(2, 10);
  return {
    v: 1,
    seed,
    name: "You",
    xp: 0,
    coins: ECONOMY.starter.coins,
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    freezes: ECONOMY.starter.freezes,
    boosters: ECONOMY.starter.boosters,
    boosterUntil: 0,
    hindsights: ECONOMY.starter.hindsights,
    league: { tier: 0, weekId: weekId(), weeklyXp: 0 },
    runs: [],
    best: {},
    quests: { day: today(), decisions: 0, great: 0, xp: 0, claimed: [] },
    badges: [],
    traits: { horizon: 0, risk: 0, disrupt: 0 },
    settings: { voice: true, sfx: true, dataSaver: false, lang: "en" },
    daily: null,
    dailyLog: [],
    onboarding: { done: false },
  };
}

/** Roll daily/weekly state forward: streak freezes, quest reset, league week. */
export function rollover(s: GameState, now = new Date()): GameState {
  const t = today(now);
  const next = { ...s };
  if (next.quests.day !== t) next.quests = { day: t, decisions: 0, great: 0, xp: 0, claimed: [] };
  if (next.lastActiveDay && next.streak > 0) {
    const gap = dayDiff(next.lastActiveDay, t);
    if (gap > 1) {
      const missed = gap - 1;
      if (next.freezes >= missed) {
        next.freezes -= missed; // freezes cover the missed days
        next.lastActiveDay = today(new Date(now.getTime() - 864e5));
      } else next.streak = 0;
    }
  }
  if (next.league.weekId !== weekId(now)) {
    // Settle last week: top players move up a league, bottom players move down.
    const rows = leagueRows({
      seed: next.seed,
      weekId: next.league.weekId,
      tier: next.league.tier,
      yourXp: next.league.weeklyXp,
      yourName: next.name,
      now,
    });
    const rank = rows.findIndex((r) => r.you);
    let tier = next.league.tier;
    if (next.league.weeklyXp > 0 && rank < PROMOTE) tier = Math.min(LEAGUES.length - 1, tier + 1);
    else if (rank >= rows.length - DEMOTE) tier = Math.max(0, tier - 1);
    next.league = { tier, weekId: weekId(now), weeklyXp: 0 };
  }
  return next;
}

/** Count today as an active day: extends the streak, or restarts it after a gap. */
export function touchStreak(x: GameState, now = new Date()): GameState {
  const t = today(now);
  if (x.lastActiveDay === t) return x;
  const gap = x.lastActiveDay ? dayDiff(x.lastActiveDay, t) : null;
  const streak = gap === 1 ? x.streak + 1 : 1;
  const badges = streak >= 3 && !x.badges.includes("streak_3") ? [...x.badges, "streak_3"] : x.badges;
  return { ...x, streak, bestStreak: Math.max(x.bestStreak, streak), lastActiveDay: t, badges };
}

/** XP for a Daily Call: by grade, doubled while a booster runs. */
export const dailyXp = (grade: Grade, boosted: boolean) => ECONOMY.dailyXp[grade] * (boosted ? 2 : 1);

/**
 * Lock in today's Daily Call: one play per day. Counts as a decision for the streak and quests, pays dailyXp,
 * and saves the takeaway. A second play the same day returns the state unchanged.
 */
export function applyDaily(
  s: GameState,
  call: Pick<DailyCall, "id" | "company" | "title">,
  option: DailyOption,
  now = new Date(),
): GameState {
  const day = today(now);
  if (s.daily?.day === day) return s;
  const xp = dailyXp(option.grade, s.boosterUntil > now.getTime());
  const x = touchStreak(rollover(s, now), now);
  const note: DailyNote = {
    day,
    company: call.company,
    title: call.title,
    choice: option.label,
    grade: option.grade,
    real: !!option.real,
    takeaway: option.takeaway,
    better: option.better,
  };
  return {
    ...x,
    xp: x.xp + xp,
    league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
    quests: {
      ...x.quests,
      decisions: x.quests.decisions + 1,
      great: x.quests.great + (option.grade === "great" ? 1 : 0),
      xp: x.quests.xp + xp,
    },
    daily: { day, id: call.id, optionId: option.id, grade: option.grade, xp },
    dailyLog: [note, ...x.dailyLog].slice(0, 60),
  };
}
