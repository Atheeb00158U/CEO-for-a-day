import type { Grade, TraitKey } from "./hotseat-types";
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
  settings: { voice: boolean; lang: "en" | "hi" | "ta" | "bn" };
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const weekId = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
};
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
    settings: { voice: true, lang: "en" },
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
