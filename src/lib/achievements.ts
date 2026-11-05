import { BADGES, LEAGUES, type GameState } from "./game-state";

/**
 * Achievements: levels worked out from the save (nothing new is stored, so they can't drift from it), plus the
 * one-off badges `applyFinish` already awards. For show only: they pay nothing, so the phone may work them out.
 * Art is public/achievements/<id>.webp (made with ChatGPT, 5 Nov 2026; prompts in docs/ACHIEVEMENT-ART.md).
 */
export interface Family {
  id: string;
  name: string;
  /** What reaching level n takes, in words. */
  goal: (n: number) => string;
  /** The same, once done: the line under a new level's cheer. */
  done: (n: number) => string;
  /** The thresholds for levels 1, 2, 3, … */
  steps: number[];
  value: (s: GameState) => number;
}

export const FAMILIES: Family[] = [
  {
    id: "streak",
    name: "On Fire",
    goal: (n) => `Reach a ${n}-day streak`,
    done: (n) => `You kept your streak for ${n} days.`,
    steps: [3, 7, 14, 30, 100],
    value: (s) => Math.max(s.bestStreak, s.streak),
  },
  {
    id: "lessons",
    name: "Scholar",
    goal: (n) => `Finish ${n} lessons`,
    done: (n) => `You finished ${n} lessons.`,
    steps: [3, 10, 20, 40],
    value: (s) => Object.keys(s.lessons).length,
  },
  {
    id: "hotseats",
    name: "Boss Chair",
    goal: (n) => `Finish ${n} Hot Seat${n === 1 ? "" : "s"}`,
    done: (n) => `You finished ${n} Hot Seat${n === 1 ? "" : "s"}.`,
    steps: [1, 3, 10, 20],
    value: (s) => Object.keys(s.best).length,
  },
  {
    id: "flawless",
    name: "Flawless",
    goal: (n) => `Score 95 or more in ${n} Hot Seat${n === 1 ? "" : "s"}`,
    done: (n) => `You scored 95 or more in ${n} Hot Seat${n === 1 ? "" : "s"}.`,
    steps: [1, 3, 5, 10],
    value: (s) => Object.values(s.best).filter((b) => b >= 95).length,
  },
  {
    id: "xp",
    name: "Big Earner",
    goal: (n) => `Earn ${n.toLocaleString("en-IN")} XP`,
    done: (n) => `You earned ${n.toLocaleString("en-IN")} XP.`,
    steps: [250, 1000, 3000, 10000],
    value: (s) => s.xp,
  },
  {
    id: "league",
    name: "Climber",
    goal: (n) => `Reach the ${LEAGUES[n]} league`,
    done: (n) => `You reached the ${LEAGUES[n]} league.`,
    steps: [1, 2, 3, 4, 5],
    value: (s) => s.league.tier,
  },
];

/** One-off badges with their own art (the others are covered by a family's first level). */
export const SPECIALS = ["turnaround", "beat_history", "fired"] as const;

/** Medal colours by level: bronze, silver, gold, ruby, diamond. */
export const TIER_COLOURS = ["#c98a4b", "#c7d0d8", "#ffc800", "#ff4b6e", "#7fe3ff"];

export interface Progress {
  family: Family;
  level: number;
  value: number;
  /** The next threshold, or null at the top. */
  next: number | null;
}

export function progressOf(f: Family, s: GameState): Progress {
  const value = f.value(s);
  const level = f.steps.filter((t) => value >= t).length;
  return { family: f, level, value, next: f.steps[level] ?? null };
}

export const achievements = (s: GameState) => FAMILIES.map((f) => progressOf(f, s));

/**
 * Everything earned so far, one key per family level ("streak:2") and per special badge: a key not seen before is
 * something new to cheer.
 */
export const earnedKeys = (s: GameState) => [
  ...achievements(s).flatMap((p) => p.family.steps.slice(0, p.level).map((_, i) => `${p.family.id}:${i + 1}`)),
  ...SPECIALS.filter((b) => s.badges.includes(b)),
];

/** What a cheer for one earned key shows. */
export function cheerFor(key: string): { id: string; level: number; name: string; line: string } | null {
  const [id, lv] = key.split(":");
  const f = FAMILIES.find((x) => x.id === id);
  if (f) return { id, level: +lv, name: f.name, line: f.done(f.steps[+lv - 1]) };
  const b = BADGES[id];
  return b ? { id, level: 1, name: b.name, line: b.desc } : null;
}
