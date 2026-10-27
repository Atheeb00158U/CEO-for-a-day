/**
 * A Hot Seat is a pre-mapped decision story. You play the CEO; every choice moves
 * the company's meters, can cost you the board's trust, and routes you to the next
 * node. Everything is authored in advance, so every outcome is known (see
 * src/content/hotseats.test.ts, which walks every possible path).
 */

export type MeterKey = "profit" | "future";
export type Grade = "great" | "ok" | "bad";

/** A media reference: "img:name" (public/media/name.webp) or "vid:name" (public/media/name.mp4). */
export type Media = `img:${string}` | `vid:${string}`;

/** Conditions read the run state. All listed conditions must hold. */
export interface When {
  flags?: string[]; // all of these flags are set
  notFlags?: string[]; // none of these flags are set
  minFuture?: number;
  maxFuture?: number;
  maxTrust?: number;
}

/** Text that changes with the path the player took. The first matching variant wins. */
export type Text = string | { when?: When; text: string }[];

export interface Effect {
  profit?: number; // -100..100, the money the core business makes
  future?: number; // -100..100, how ready the company is for what's next
  trust?: number; // board trust ("hearts"); usually -1 for a bad call
  flags?: string[];
}

export interface Option {
  id: string;
  label: string;
  grade: Grade;
  /** True when this is what the real company did. */
  real?: boolean;
  effect: Effect;
  /** Next node id, or a list of conditional routes (first match wins, last one should have no `when`). */
  next: string | { when?: When; to: string }[];
  media: Media;
  /** The story: what happens next, told as narrative. */
  outcome: Text;
  /** Why this was a good or bad call. */
  why: string;
  /** For ok/bad choices: what would have worked instead. */
  better?: string;
  /** One line for the personalised revision notes. */
  takeaway: string;
  /** Skill tags this choice trains or tests, used for the decision profile. */
  traits: Partial<Record<TraitKey, number>>;
}

export type TraitKey = "horizon" | "risk" | "disrupt";

export interface SceneNode {
  id: string;
  type: "scene";
  year: string;
  media: Media;
  text: Text;
  next: string;
}

export interface DecisionNode {
  id: string;
  type: "decision";
  year: string;
  title: string;
  media: Media;
  setup: Text;
  question: string;
  advisor: Text;
  options: Option[];
}

export interface EndingNode {
  id: string;
  type: "ending";
  tier: "legend" | "survivor" | "collapse" | "fired";
  title: string;
  media: Media;
  text: Text;
  /** Points added to the CEO score for reaching this ending. */
  bonus: number;
}

/** Picks an ending from the final state. */
export interface EndingRouter {
  id: string;
  type: "route";
  routes: { when?: When; to: string }[];
}

export type HotSeatNode = SceneNode | DecisionNode | EndingNode | EndingRouter;

export interface HotSeat {
  id: string;
  company: string;
  title: string;
  hook: string;
  role: string;
  years: string;
  cover: Media;
  /** Hidden from players. Used only to keep a new player's first Hot Seats gentle. */
  complexity: 1 | 2 | 3 | 4 | 5;
  minutes: number;
  start: string;
  startMeters: Record<MeterKey, number>;
  startTrust: number;
  meters: Record<MeterKey, { label: string; hint: string }>;
  nodes: Record<string, HotSeatNode>;
  /** The ending tier the real company reached, used for the "Beat history" badge. */
  realEnding: EndingNode["tier"];
  /** What actually happened, shown on the debrief. */
  realHistory: string;
  sources: { label: string; url: string }[];
  credits: string;
}

export interface CatalogEntry {
  id: string;
  company: string;
  title: string;
  hook: string;
  cover?: Media;
  complexity: 1 | 2 | 3 | 4 | 5;
  available: boolean;
}
