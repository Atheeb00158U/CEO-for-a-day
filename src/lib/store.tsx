"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, signInWithGoogle, signOut, supabase } from "./auth";
import type { Synced } from "./content-client";
import type { DailyCall, DailyOption, Grade } from "./hotseat-types";
import type { Pick as PlayPick, Result } from "./play";
import { setSfxOn } from "./sfx";
import {
  applyBooster,
  applyBuy,
  applyClaim,
  applyDaily,
  applyDecision,
  applyFinish,
  applyHindsight,
  ECONOMY,
  fresh,
  rollover,
  type GameState,
  type Onboarding,
  type RunRecord,
} from "./game-state";

export { BADGES, ECONOMY, LEAGUES, questsFor, today, type GameState, type RunRecord } from "./game-state";

/** The guest save. A signed-in player's progress lives on the server, never here. */
const KEY = "cfad.v1";

/** A finished run, as the Player hands it over. */
export interface FinishedRun {
  hotSeatId: string;
  picks: PlayPick[];
  result: Result;
  hindsightUsed: boolean;
  /** Random per run, so a retry or double tap pays once. */
  runKey: string;
}

interface Ctx {
  s: GameState;
  ready: boolean;
  /** Signed in with Google (progress saved on the server). */
  account: { email?: string } | null;
  /** Sign-in is set up on this server. */
  canSignIn: boolean;
  boosterActive: boolean;
  recordDecision: (grade: Grade) => void;
  finishRun: (run: FinishedRun) => Promise<RunRecord>;
  buy: (item: keyof typeof ECONOMY.prices) => Promise<boolean>;
  activateBooster: () => Promise<boolean>;
  spendHindsight: () => boolean;
  claimQuest: (id: string) => Promise<void>;
  /** Lock in today's Daily Call as a guest. Does nothing if today's call was already played. */
  playDaily: (call: Pick<DailyCall, "id" | "company" | "title">, option: DailyOption) => void;
  /** Take the server's reply to any signed-in action. */
  sync: (x: Synced) => void;
  setSetting: <K extends keyof GameState["settings"]>(k: K, v: GameState["settings"][K]) => void;
  setName: (n: string) => void;
  setOnboarding: (o: Partial<Onboarding>) => void;
  signIn: () => void;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  reset: () => void;
}

const GameCtx = createContext<Ctx | null>(null);

const hasProgress = (x: Partial<GameState> | null) => !!x && (!!x.lastActiveDay || !!x.runs?.length || (x.xp ?? 0) > 0);

function readGuest(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Merge settings one level down too, so a save from before a setting existed gets its default.
    // Saves from before the welcome screens: anyone who has already played skips them.
    const onboarding = saved.onboarding ?? { done: !!saved.lastActiveDay || !!saved.runs?.length };
    return { ...fresh(), ...saved, settings: { ...fresh().settings, ...saved.settings }, onboarding };
  } catch {
    return null; // private mode or blocked storage: play without saving
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<GameState>(fresh);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<{ email?: string } | null>(null);
  const version = useRef(-1);
  const [, tick] = useState(0);
  const signedIn = account !== null;

  /** Take the server's state unless the phone already has a newer one (replies can arrive out of order). */
  const sync = useCallback((x: Synced) => {
    if (x.version < version.current) return;
    version.current = x.version;
    setS(x.state);
  }, []);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000); // refresh booster countdown
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const guest = readGuest();
    const sb = supabase();
    const asGuest = () => {
      version.current = -1;
      setAccount(null);
      setS(rollover(guest ?? fresh()));
      setReady(true);
    };
    const asUser = async (email?: string) => {
      try {
        // A guest who signs in brings their progress along, once. The server caps it and skips it for an account
        // that has already played.
        const local = readGuest();
        const x = hasProgress(local) ? await api<Synced>("/api/import", { body: { save: local } }) : await api<Synced>("/api/state");
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* ignore */
        }
        // The welcome screens they just went through as a guest count for the account too.
        if (local?.onboarding?.done && !x.state.onboarding.done) x.state.onboarding = { ...x.state.onboarding, ...local.onboarding };
        setAccount({ email });
        version.current = -1;
        sync(x);
      } catch {
        asGuest(); // server unreachable: play as a guest for now
        return;
      }
      setReady(true);
    };
    if (!sb) asGuest();
    else {
      sb.auth.getSession().then(({ data }) => (data.session ? asUser(data.session.user.email) : asGuest()));
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session) setTimeout(() => asUser(session.user.email), 0);
        if (event === "SIGNED_OUT") {
          version.current = -1;
          setAccount(null);
          setS(fresh());
        }
      });
      return () => data.subscription.unsubscribe();
    }
  }, [sync]);

  useEffect(() => {
    // `ready` is state, not a ref: in the render that loads the save, it's still false here, so the blank
    // starting state is never written over the player's progress. Signed-in progress is never stored here.
    if (!ready || signedIn) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s, ready, signedIn]);

  useEffect(() => setSfxOn(s.settings.sfx), [s.settings.sfx]);

  const boosterActive = s.boosterUntil > Date.now();

  /** Send a signed-in change to the server and take its reply; false if it was refused. */
  const send = async (url: string, body: unknown = {}) => {
    try {
      sync(await api<Synced>(url, { body }));
      return true;
    } catch {
      return false;
    }
  };

  const recordDecision = useCallback(
    (grade: Grade) => {
      // Signed in, the server counts decisions when the Hot Seat is finished (from the replayed picks).
      if (!signedIn) setS((x) => applyDecision(rollover(x), grade));
    },
    [signedIn],
  );

  const finishRun: Ctx["finishRun"] = async (run) => {
    const r = run.result;
    if (signedIn) {
      const x = await api<Synced & { record: RunRecord }>("/api/run/finish", {
        body: { runKey: run.runKey, hotSeatId: run.hotSeatId, picks: run.picks, hindsightUsed: run.hindsightUsed },
      });
      sync(x);
      return x.record;
    }
    const { state, record } = applyFinish(s, {
      run: {
        hotSeatId: run.hotSeatId,
        score: r.score,
        endingId: r.endingId,
        endingTier: r.endingTier,
        notes: r.lines,
        patterns: r.patterns,
      },
      traits: r.traits,
      flags: { recovered: r.recovered, beatHistory: r.beatHistory },
    });
    setS(state);
    return record;
  };

  /** A guest's change, applied here; false when the rules refuse it. */
  const local = (next: GameState | null) => {
    if (!next) return false;
    setS(next);
    return true;
  };

  const value = useMemo<Ctx>(
    () => ({
      s,
      ready,
      account,
      canSignIn: !!supabase(),
      boosterActive,
      recordDecision,
      finishRun,
      buy: async (item) => (signedIn ? send("/api/shop/buy", { item }) : local(applyBuy(s, item))),
      activateBooster: async () => (signedIn ? send("/api/booster") : local(applyBooster(s))),
      // Signed in, Hindsight is charged when the run is finished; this only updates the count shown meanwhile.
      spendHindsight: () => local(applyHindsight(s)),
      claimQuest: async (id) => void (signedIn ? await send("/api/quest/claim", { id }) : local(applyClaim(s, id))),
      playDaily: (call, option) => setS((x) => applyDaily(x, call, option)),
      sync,
      setSetting: (k, v) => {
        setS((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
        if (signedIn) void send("/api/profile", { settings: { [k]: v } });
      },
      setName: (n) => {
        setS((x) => ({ ...x, name: n.trim().slice(0, 20) || "You" }));
        if (signedIn) void send("/api/profile", { name: n });
      },
      setOnboarding: (o) => {
        setS((x) => ({ ...x, onboarding: { ...x.onboarding, ...o } }));
        if (signedIn) void send("/api/profile", { onboarding: o });
      },
      signIn: () => void signInWithGoogle(),
      signOut: async () => {
        await signOut();
      },
      deleteAccount: async () => {
        await api("/api/account", { method: "DELETE" });
        await signOut();
      },
      reset: () => !signedIn && setS(fresh()),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, ready, account, boosterActive],
  );
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside GameProvider");
  return c;
}
