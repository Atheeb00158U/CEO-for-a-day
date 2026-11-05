"use client";

import type { WolfName } from "./brand";

/**
 * The wolf drops in now and then with one short line, then leaves (like the villager in Clash of Clans). Each line
 * is shown once a day (or once ever), at most a few a day, so he stays a friend and never becomes a nag.
 * `<WolfTip>` in App shows them; screens call `wolfSay` with a key from LINES.
 */
export const LINES = {
  homeNudge: { pose: "pose-pointing", text: "One lesson today keeps your streak going.", once: "day" },
  homeDone: { pose: "pose-pleased", text: "Good work today. See you tomorrow.", once: "day" },
  missedDay: { pose: "pose-worried", text: "You missed a day. Start a new streak today.", once: "day" },
  slowDown: { pose: "pose-thinking", text: "Take your time. Read the question again.", once: "day" },
  firstSeat: { pose: "pose-pointing", text: "You're the boss now. You make every decision.", once: "ever" },
} satisfies Record<string, { pose: WolfName; text: string; once: "day" | "ever" }>;
export type WolfLine = keyof typeof LINES;

const KEY = "cfad.wolf";
const PER_DAY = 3;

type Seen = { day: string; count: number; lines: Record<string, string> };
const day = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

function read(): Seen {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Seen | null;
    if (v) return v.day === day() ? v : { ...v, day: day(), count: 0 };
  } catch {
    /* private mode or a bad value: start fresh */
  }
  return { day: day(), count: 0, lines: {} };
}

let listener: ((line: WolfLine) => void) | null = null;
export const onWolf = (fn: ((line: WolfLine) => void) | null) => {
  listener = fn;
};

/** Ask the wolf to say a line. Skipped if he has said it already (today, or ever) or said enough today. */
export function wolfSay(line: WolfLine) {
  if (!listener) return;
  const seen = read();
  const last = seen.lines[line];
  if (seen.count >= PER_DAY || (last && (LINES[line].once === "ever" || last === seen.day))) return;
  seen.count++;
  seen.lines[line] = seen.day;
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* he may repeat himself once; harmless */
  }
  listener(line);
}
