"use client";

// What the phone knows about content: the map's cards (handed down by the /app page) and calls to the server
// for each step of play. Answers only ever arrive after the player has picked.
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./auth";
import type { GameState } from "./game-state";
import type { CatalogEntry, DailyAnswer, DailyQuestion } from "./hotseat-types";
import type { Pick, PlayView } from "./play";

export interface Content {
  catalog: CatalogEntry[];
  /** The welcome screens' trial, when it can be played here. */
  trial?: CatalogEntry;
}

const ContentCtx = createContext<Content>({ catalog: [] });
export const ContentProvider = ContentCtx.Provider;
export const useContent = () => useContext(ContentCtx);

/** A signed-in player's progress as the server returned it. */
export interface Synced {
  state: GameState;
  version: number;
}

/** The step after `picks`. `written` is a reviewed, pre-written debrief for the path, when one exists. */
export type PlayResponse = PlayView & { written?: string };

export const fetchStep = (hotSeatId: string, picks: Pick[]) => api<PlayResponse>("/api/play", { body: { hotSeatId, picks } });
/** Signed in, the reply also carries the saved progress (`synced`). */
export const lockDaily = (id: string, optionId: string) =>
  api<DailyAnswer & { synced?: Synced }>("/api/daily/lock", { body: { id, optionId } });

/** Today's Daily Call, without its answers. `undefined` while loading, `null` when there isn't one. */
export function useDaily(): { day: string; call: DailyQuestion | null } | undefined {
  const [daily, setDaily] = useState<{ day: string; call: DailyQuestion | null }>();
  useEffect(() => {
    let live = true;
    fetch("/api/daily")
      .then((r) => (r.ok ? r.json() : { day: "", call: null }))
      .then((d) => live && setDaily(d))
      .catch(() => live && setDaily({ day: "", call: null }));
    return () => {
      live = false;
    };
  }, []);
  return daily;
}
