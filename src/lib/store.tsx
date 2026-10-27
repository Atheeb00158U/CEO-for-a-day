"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Grade, TraitKey } from "./hotseat-types";
import { DEMOTE, leagueRows, PROMOTE } from "./league";

/* ------------------------------------------------------------------ */
/* Economy. Tune these in one place.                                   */
/* ------------------------------------------------------------------ */
export const ECONOMY = {
  completionXp: 10, // flat XP for finishing a Hot Seat (score adds 0–100 on top)
  completionCoins: 20,
  boosterMinutes: 15,
  prices: { freeze: 200, booster: 150, hindsight: 100 },
  starter: { coins: 120, freezes: 1, hindsights: 1, boosters: 1 },
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

const KEY = "cfad.v1";
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const weekId = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
};
const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

function fresh(): GameState {
  const seed = Math.random().toString(36).slice(2, 10);
  return {
    v: 1, seed, name: "You", xp: 0, coins: ECONOMY.starter.coins, streak: 0, bestStreak: 0, lastActiveDay: null,
    freezes: ECONOMY.starter.freezes, boosters: ECONOMY.starter.boosters, boosterUntil: 0, hindsights: ECONOMY.starter.hindsights,
    league: { tier: 0, weekId: weekId(), weeklyXp: 0 }, runs: [], best: {},
    quests: { day: today(), decisions: 0, great: 0, xp: 0, claimed: [] }, badges: [],
    traits: { horizon: 0, risk: 0, disrupt: 0 }, settings: { voice: true, lang: "en" },
  };
}

/** Roll daily/weekly state forward: streak freezes, quest reset, league week. */
function rollover(s: GameState): GameState {
  const t = today();
  let next = { ...s };
  if (next.quests.day !== t) next.quests = { day: t, decisions: 0, great: 0, xp: 0, claimed: [] };
  if (next.lastActiveDay && next.streak > 0) {
    const gap = dayDiff(next.lastActiveDay, t);
    if (gap > 1) {
      const missed = gap - 1;
      if (next.freezes >= missed) {
        next.freezes -= missed; // freezes cover the missed days
        next.lastActiveDay = today(new Date(Date.now() - 864e5));
      } else next.streak = 0;
    }
  }
  if (next.league.weekId !== weekId()) {
    // Settle last week: top players move up a league, bottom players move down.
    const rows = leagueRows({ seed: next.seed, weekId: next.league.weekId, tier: next.league.tier, yourXp: next.league.weeklyXp, yourName: next.name });
    const rank = rows.findIndex((r) => r.you);
    let tier = next.league.tier;
    if (next.league.weeklyXp > 0 && rank < PROMOTE) tier = Math.min(LEAGUES.length - 1, tier + 1);
    else if (rank >= rows.length - DEMOTE) tier = Math.max(0, tier - 1);
    next.league = { tier, weekId: weekId(), weeklyXp: 0 };
  }
  return next;
}

export const QUESTS = [
  { id: "decisions", label: "Make 3 decisions", goal: 3, reward: 15, read: (q: GameState["quests"]) => q.decisions },
  { id: "great", label: "Make 2 great calls", goal: 2, reward: 25, read: (q: GameState["quests"]) => q.great },
  { id: "xp", label: "Earn 60 XP", goal: 60, reward: 30, read: (q: GameState["quests"]) => q.xp },
];

interface Ctx {
  s: GameState;
  ready: boolean;
  boosterActive: boolean;
  recordDecision: (grade: Grade) => void;
  finishRun: (r: Omit<RunRecord, "xp" | "at">, traits: Record<TraitKey, number>, flags: { recovered: boolean; beatHistory: boolean }) => RunRecord;
  buy: (item: keyof typeof ECONOMY.prices) => boolean;
  activateBooster: () => boolean;
  spendHindsight: () => boolean;
  claimQuest: (id: string) => void;
  setSetting: <K extends keyof GameState["settings"]>(k: K, v: GameState["settings"][K]) => void;
  setName: (n: string) => void;
  reset: () => void;
}

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<GameState>(fresh);
  const [ready, setReady] = useState(false);
  const [, tick] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS(rollover({ ...fresh(), ...JSON.parse(raw) }));
      else setS((x) => rollover(x));
    } catch {
      /* private mode or blocked storage: play without saving */
    }
    loaded.current = true;
    setReady(true);
    const id = setInterval(() => tick((n) => n + 1), 30_000); // refresh booster countdown
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, [s]);

  const boosterActive = s.boosterUntil > Date.now();

  const touchStreak = (x: GameState): GameState => {
    const t = today();
    if (x.lastActiveDay === t) return x;
    const gap = x.lastActiveDay ? dayDiff(x.lastActiveDay, t) : null;
    const streak = gap === 1 ? x.streak + 1 : 1;
    const badges = streak >= 3 && !x.badges.includes("streak_3") ? [...x.badges, "streak_3"] : x.badges;
    return { ...x, streak, bestStreak: Math.max(x.bestStreak, streak), lastActiveDay: t, badges };
  };

  const recordDecision = useCallback((grade: Grade) => {
    setS((x) => {
      const y = touchStreak(rollover(x));
      return { ...y, quests: { ...y.quests, decisions: y.quests.decisions + 1, great: y.quests.great + (grade === "great" ? 1 : 0) } };
    });
  }, []);

  const finishRun: Ctx["finishRun"] = (r, traits, flags) => {
    const mult = s.boosterUntil > Date.now() ? 2 : 1;
    const xp = (ECONOMY.completionXp + r.score) * mult;
    const rec: RunRecord = { ...r, xp, at: Date.now() };
    setS((x) => {
      const badges = new Set(x.badges);
      badges.add("first_seat");
      if (flags.recovered) badges.add("turnaround");
      if (r.score >= 95) badges.add("perfect");
      if (flags.beatHistory) badges.add("beat_history");
      if (r.endingTier === "fired") badges.add("fired");
      const t = { ...x.traits };
      (Object.keys(traits) as TraitKey[]).forEach((k) => (t[k] += traits[k]));
      return {
        ...x,
        xp: x.xp + xp,
        coins: x.coins + ECONOMY.completionCoins,
        league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
        runs: [rec, ...x.runs].slice(0, 50),
        best: { ...x.best, [r.hotSeatId]: Math.max(x.best[r.hotSeatId] ?? 0, r.score) },
        quests: { ...x.quests, xp: x.quests.xp + xp },
        badges: [...badges],
        traits: t,
      };
    });
    return rec;
  };

  const buy: Ctx["buy"] = (item) => {
    const price = ECONOMY.prices[item];
    if (s.coins < price) return false;
    setS((x) => ({
      ...x,
      coins: x.coins - price,
      freezes: x.freezes + (item === "freeze" ? 1 : 0),
      boosters: x.boosters + (item === "booster" ? 1 : 0),
      hindsights: x.hindsights + (item === "hindsight" ? 1 : 0),
    }));
    return true;
  };

  const activateBooster = () => {
    if (s.boosters < 1) return false;
    setS((x) => ({ ...x, boosters: x.boosters - 1, boosterUntil: Math.max(Date.now(), x.boosterUntil) + ECONOMY.boosterMinutes * 60_000 }));
    return true;
  };

  const spendHindsight = () => {
    if (s.hindsights < 1) return false;
    setS((x) => ({ ...x, hindsights: x.hindsights - 1 }));
    return true;
  };

  const claimQuest = (id: string) => {
    const q = QUESTS.find((x) => x.id === id);
    if (!q) return;
    setS((x) => (x.quests.claimed.includes(id) || q.read(x.quests) < q.goal ? x : { ...x, coins: x.coins + q.reward, quests: { ...x.quests, claimed: [...x.quests.claimed, id] } }));
  };

  const value = useMemo<Ctx>(
    () => ({
      s, ready, boosterActive, recordDecision, finishRun, buy, activateBooster, spendHindsight, claimQuest,
      setSetting: (k, v) => setS((x) => ({ ...x, settings: { ...x.settings, [k]: v } })),
      setName: (n) => setS((x) => ({ ...x, name: n.slice(0, 20) || "You" })),
      reset: () => setS(fresh()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, ready, boosterActive],
  );
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside GameProvider");
  return c;
}
