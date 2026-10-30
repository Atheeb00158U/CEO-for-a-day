"use client";

// What the phone knows about content: the map's cards (handed down by the /app page) and calls to the server
// for each step of play. Answers only ever arrive after the player has picked.
import { createContext, useContext, useEffect, useState } from "react";
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

/** The step after `picks`. `written` is a reviewed, pre-written debrief for the path, when one exists. */
export type PlayResponse = PlayView & { written?: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

export const fetchStep = (hotSeatId: string, picks: Pick[]) => post<PlayResponse>("/api/play", { hotSeatId, picks });
export const lockDaily = (id: string, optionId: string) => post<DailyAnswer>("/api/daily/lock", { id, optionId });

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
