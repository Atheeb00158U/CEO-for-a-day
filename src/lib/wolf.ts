"use client";

import { WOLF_LINES, type WolfMoment } from "./wolf-lines";

/**
 * The wolf drops in on Home only when there is a reason (like the villager in Clash of Clans): the first visit
 * ever, or the first visit of a new day. He speaks one line in his own voice and stays until the player taps.
 * At most once a day, so he stays a friend and never becomes a nag. `<WolfTip>` in App shows him.
 */
const KEY = "cfad.wolf";

type Seen = { day?: string; met?: boolean; said?: Record<string, number> };
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function read(): Seen {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "null") as Seen | null) ?? {};
  } catch {
    return {}; // private mode or a bad value: start fresh
  }
}

export type WolfTalk = { moment: WolfMoment; text: string };
let listener: ((t: WolfTalk) => void) | null = null;
export const onWolf = (fn: ((t: WolfTalk) => void) | null) => {
  listener = fn;
};

/** Ask the wolf to drop in. Skipped if he came today already, or if `meet` has happened before. */
export function wolfSay(moment: WolfMoment) {
  if (!listener) return;
  const seen = read();
  if (seen.day === day() || (moment === "meet" && seen.met)) return;
  const n = seen.said?.[moment] ?? 0;
  const { lines } = WOLF_LINES[moment];
  const next: Seen = { day: day(), met: true, said: { ...seen.said, [moment]: n + 1 } };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* he may come again today; harmless */
  }
  listener({ moment, text: lines[n % lines.length] });
}
