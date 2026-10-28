"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DailyCall, Grade, TraitKey } from "./hotseat-types";
import { setSfxOn } from "./sfx";
import { applyDaily, ECONOMY, fresh, rollover, touchStreak, type GameState, type RunRecord } from "./game-state";

export { BADGES, ECONOMY, LEAGUES, today, type GameState, type RunRecord } from "./game-state";

const KEY = "cfad.v1";

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
  finishRun: (
    r: Omit<RunRecord, "xp" | "at">,
    traits: Record<TraitKey, number>,
    flags: { recovered: boolean; beatHistory: boolean },
  ) => RunRecord;
  buy: (item: keyof typeof ECONOMY.prices) => boolean;
  activateBooster: () => boolean;
  spendHindsight: () => boolean;
  claimQuest: (id: string) => void;
  /** Lock in today's Daily Call. Does nothing if today's call was already played. */
  playDaily: (call: DailyCall, optionId: string) => void;
  setSetting: <K extends keyof GameState["settings"]>(k: K, v: GameState["settings"][K]) => void;
  setName: (n: string) => void;
  reset: () => void;
}

const GameCtx = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<GameState>(fresh);
  const [ready, setReady] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Merge settings one level down too, so a save from before a setting existed gets its default.
        setS(rollover({ ...fresh(), ...saved, settings: { ...fresh().settings, ...saved.settings } }));
      } else setS((x) => rollover(x));
    } catch {
      /* private mode or blocked storage: play without saving */
    }
    setReady(true);
    const id = setInterval(() => tick((n) => n + 1), 30_000); // refresh booster countdown
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // `ready` is state, not a ref: in the render that loads the save, it's still false here, so the blank
    // starting state is never written over the player's progress.
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s, ready]);

  useEffect(() => setSfxOn(s.settings.sfx), [s.settings.sfx]);

  const boosterActive = s.boosterUntil > Date.now();

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
    setS((x) =>
      x.quests.claimed.includes(id) || q.read(x.quests) < q.goal
        ? x
        : { ...x, coins: x.coins + q.reward, quests: { ...x.quests, claimed: [...x.quests.claimed, id] } },
    );
  };

  const value = useMemo<Ctx>(
    () => ({
      s,
      ready,
      boosterActive,
      recordDecision,
      finishRun,
      buy,
      activateBooster,
      spendHindsight,
      claimQuest,
      playDaily: (call, optionId) => setS((x) => applyDaily(x, call, optionId)),
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
