// The career ladder: one title per unit of the course, and a star for each finished module in the current unit.
// Pure, so the phone (from its save) and the server (from its own records) feed it differently and agree on the rule.
import type { CourseOutline } from "./course-types";
import { coursePath } from "./course-path.ts";

/** One title per unit, in unit order. Fixed here; only units that exist in the course count. */
export const TITLES = [
  "Street Seller",
  "Shopkeeper",
  "Trader",
  "Brand Owner",
  "Dealmaker",
  "Business Owner",
  "Boss",
  "Tycoon",
  "Founder",
  "CEO",
] as const;

export interface Career {
  /** 1–10: the unit the player is working through. */
  rank: number;
  title: (typeof TITLES)[number];
  /** Finished modules in that unit, out of `maxStars`. */
  stars: number;
  maxStars: number;
}

/** What the player has finished: lesson ids (a passed test-out counts its lessons) and Hot Seats played to an end. */
export interface CareerProgress {
  lessons: Record<string, number>;
  best: Record<string, number>;
}

/**
 * A module is finished when all its lessons are done and all its Hot Seat gates are played (the Home path's "done").
 * The title is the unit of the first unfinished module; once every unit is finished, the last one with full stars.
 */
export function careerOf(progress: CareerProgress, course: CourseOutline): Career {
  const units = coursePath(course, progress).units;
  const finished = units.map((u) => u.modules.filter((m) => [...m.lessons, ...m.gates].every((n) => n.state === "done")).length);
  const open = units.findIndex((u, i) => finished[i] < u.modules.length);
  const i = Math.min(TITLES.length - 1, Math.max(0, open < 0 ? units.length - 1 : open));
  return { rank: i + 1, title: TITLES[i], stars: finished[i] ?? 0, maxStars: units[i]?.modules.length ?? 0 };
}

/** For screen readers: "Trader, 2 of 3 stars". */
export const careerSpoken = (c: Career) => `${c.title}, ${c.stars} of ${c.maxStars} stars`;
