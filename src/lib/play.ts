// Play a Hot Seat on the server. The phone sends only the picks so far; this replays them through the engine and
// returns what the player may see now: never an option's grade, effect or next node before it is picked.
// Node runs this file directly (tests, scripts), so it keeps relative .ts imports.
import { buildDebrief, callsPerRun, choose, resolveNode, resolveText, score, startRun, traitTotals, type RunState } from "./engine.ts";
import type { DecisionNode, EndingNode, Grade, HotSeat, Media, MeterKey, TraitKey } from "./hotseat-types";

export interface Pick {
  nodeId: string;
  optionId: string;
}

export type Screen =
  | { kind: "scene"; id: string; year: string; media: Media; text: string }
  | {
      kind: "decision";
      id: string;
      year: string;
      title: string;
      media: Media;
      setup: string;
      question: string;
      advisor: string;
      options: { id: string; label: string }[];
    }
  | { kind: "ending"; id: string; tier: EndingNode["tier"]; title: string; media: Media; text: string };

export interface Reveal {
  nodeId: string;
  optionId: string;
  year: string;
  media: Media;
  outcome: string;
  grade: Grade;
  why: string;
  better?: string;
  realChoice?: { company: string; label: string };
}

/** What a finished run earned, worked out from the path alone. */
export interface Result {
  score: number;
  endingId: string;
  endingTier: EndingNode["tier"];
  lines: ReturnType<typeof buildDebrief>["lines"];
  patterns: string[];
  recovered: boolean;
  beatHistory: boolean;
  traits: Record<TraitKey, number>;
}

/** The parts of a Hot Seat the screens need that give nothing away. */
export interface HotSeatMeta {
  id: string;
  company: string;
  title: string;
  years: string;
  startTrust: number;
  meters: Record<MeterKey, { label: string; hint: string }>;
  calls: number;
  realHistory?: string;
  /** A made-up story: no real-history tags or panel. */
  madeUp?: boolean;
  sources: { label: string; url: string }[];
  credits: string;
}

export interface PlayView {
  meta: HotSeatMeta;
  meters: Record<MeterKey, number>;
  trust: number;
  /** True while every pick so far matches what the real company did. */
  onRealPath: boolean;
  /** The picks so far, with the grades the player has already seen. */
  picks: { grade: Grade; real: boolean }[];
  traits: Record<TraitKey, number>;
  /** The verdict on the last pick. */
  reveal?: Reveal;
  /** What to show next: any scenes, then the next decision or the ending. */
  screens: Screen[];
  /** Set once the run reaches its ending. */
  result?: Result;
}

/** A path that the Hot Seat can't produce: a forged node or option, or a pick after the ending. */
export class PlayError extends Error {}

export const MAX_PICKS = 40;
const TIER_RANK = { fired: 0, collapse: 1, survivor: 2, legend: 3 } as const;

export const metaOf = (hs: HotSeat): HotSeatMeta => ({
  id: hs.id,
  company: hs.company,
  title: hs.title,
  years: hs.years,
  startTrust: hs.startTrust,
  meters: hs.meters,
  calls: callsPerRun(hs),
  realHistory: hs.realHistory,
  madeUp: hs.madeUp,
  sources: hs.sources,
  credits: hs.credits,
});

/** Scenes from the run's current node up to the next decision or ending, which is returned last. */
function walk(hs: HotSeat, s: RunState): { screens: Screen[]; stop: DecisionNode | EndingNode } {
  const screens: Screen[] = [];
  let node = resolveNode(hs, s, s.nodeId);
  while (node.type === "scene") {
    if (screens.length > 20) throw new PlayError("scene loop");
    screens.push({ kind: "scene", id: node.id, year: node.year, media: node.media, text: resolveText(node.text, s) });
    node = resolveNode(hs, s, node.next);
  }
  if (node.type === "route") throw new PlayError("unresolved route");
  return { screens, stop: node };
}

function screenOf(stop: DecisionNode | EndingNode, s: RunState): Screen {
  if (stop.type === "ending") {
    return { kind: "ending", id: stop.id, tier: stop.tier, title: stop.title, media: stop.media, text: resolveText(stop.text, s) };
  }
  return {
    kind: "decision",
    id: stop.id,
    year: stop.year,
    title: stop.title,
    media: stop.media,
    setup: resolveText(stop.setup, s),
    question: stop.question,
    advisor: resolveText(stop.advisor, s),
    options: stop.options.map((o) => ({ id: o.id, label: o.label })),
  };
}

/** Replay `picks` from the start and return the player's view. Throws PlayError for an impossible path. */
export function play(hs: HotSeat, picks: Pick[]): PlayView {
  if (picks.length > MAX_PICKS) throw new PlayError("too many picks");
  let s = startRun(hs);
  let reveal: Reveal | undefined;
  for (const p of picks) {
    const { stop } = walk(hs, s);
    if (stop.type !== "decision" || stop.id !== p.nodeId) throw new PlayError(`no decision ${p.nodeId} here`);
    const option = stop.options.find((o) => o.id === p.optionId);
    if (!option) throw new PlayError(`no option ${p.optionId} in ${p.nodeId}`);
    s = choose(hs, s, stop, option);
    const real = stop.options.find((o) => o.real);
    reveal = {
      nodeId: stop.id,
      optionId: option.id,
      year: stop.year,
      media: option.media,
      outcome: resolveText(option.outcome, s),
      grade: option.grade,
      why: option.why,
      better: option.better,
      realChoice: !option.real && real ? { company: hs.company, label: real.label } : undefined,
    };
  }
  const { screens, stop } = walk(hs, s);
  screens.push(screenOf(stop, s));
  const view: PlayView = {
    meta: metaOf(hs),
    meters: s.meters,
    trust: s.trust,
    onRealPath: s.onRealPath,
    picks: s.picks.map((p) => ({ grade: p.grade, real: p.real })),
    traits: traitTotals(hs, s),
    reveal,
    screens,
  };
  if (stop.type === "ending") {
    const d = buildDebrief(hs, s);
    view.result = {
      score: score(hs, s, stop),
      endingId: stop.id,
      endingTier: stop.tier,
      lines: d.lines,
      patterns: d.patterns,
      recovered: d.recovered,
      beatHistory: !hs.madeUp && TIER_RANK[stop.tier] > TIER_RANK[hs.realEnding],
      traits: view.traits,
    };
  }
  return view;
}

/** Checks a request body is a list of picks, before it reaches the engine. */
export function parsePicks(x: unknown): Pick[] {
  if (!Array.isArray(x) || x.length > MAX_PICKS) throw new PlayError("bad picks");
  return x.map((p) => {
    if (!p || typeof p.nodeId !== "string" || typeof p.optionId !== "string") throw new PlayError("bad pick");
    return { nodeId: p.nodeId, optionId: p.optionId };
  });
}
