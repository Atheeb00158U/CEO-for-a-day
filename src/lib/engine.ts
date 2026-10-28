import type {
  DailyCall,
  DailyPool,
  DecisionNode,
  EndingNode,
  HotSeat,
  HotSeatNode,
  MeterKey,
  Option,
  Text,
  TraitKey,
  When,
} from "./hotseat-types";

export interface Choice {
  nodeId: string;
  optionId: string;
  grade: Option["grade"];
  real: boolean;
}

export interface RunState {
  hotSeatId: string;
  nodeId: string;
  meters: Record<MeterKey, number>;
  trust: number;
  flags: string[];
  picks: Choice[];
  /** True while every pick so far matches what the real company did. */
  onRealPath: boolean;
}

/** Voices: the narrator reads the story, the advisor speaks the advice (see scripts/narrate.py). */
export const NARRATOR = "narrator";
export const ADVISOR = "advisor";

/** The verdict line as narrated: why, plus what would have worked for ok/bad calls. */
export const spokenWhy = (o: Pick<Option, "why" | "better">) => o.why + (o.better ? " What would have worked: " + o.better : "");

export const POINTS: Record<Option["grade"], number> = { great: 25, ok: 10, bad: 0 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function startRun(hs: HotSeat): RunState {
  return {
    hotSeatId: hs.id,
    nodeId: hs.start,
    meters: { ...hs.startMeters },
    trust: hs.startTrust,
    flags: [],
    picks: [],
    onRealPath: true,
  };
}

export function matches(when: When | undefined, s: Pick<RunState, "flags" | "meters" | "trust">): boolean {
  if (!when) return true;
  if (when.flags && !when.flags.every((f) => s.flags.includes(f))) return false;
  if (when.notFlags && when.notFlags.some((f) => s.flags.includes(f))) return false;
  if (when.minFuture !== undefined && s.meters.future < when.minFuture) return false;
  if (when.maxFuture !== undefined && s.meters.future > when.maxFuture) return false;
  if (when.maxTrust !== undefined && s.trust > when.maxTrust) return false;
  return true;
}

export function resolveText(t: Text, s: RunState): string {
  if (typeof t === "string") return t;
  const hit = t.find((v) => matches(v.when, s));
  return hit ? hit.text : t[t.length - 1].text;
}

/** Follow scene → … and router nodes until we land on something the player sees. */
export function resolveNode(hs: HotSeat, s: RunState, id: string): HotSeatNode {
  let node = hs.nodes[id];
  let guard = 0;
  while (node && node.type === "route" && guard++ < 20) {
    const r = node.routes.find((x) => matches(x.when, s)) ?? node.routes[node.routes.length - 1];
    node = hs.nodes[r.to];
  }
  if (!node) throw new Error(`Hot Seat ${hs.id}: missing node ${id}`);
  return node;
}

export function nextOf(opt: Option, s: RunState): string {
  if (typeof opt.next === "string") return opt.next;
  const r = opt.next.find((x) => matches(x.when, s)) ?? opt.next[opt.next.length - 1];
  return r.to;
}

/** Apply a choice. Returns the new state; losing all board trust sends you to the "fired" ending. */
export function choose(hs: HotSeat, s: RunState, node: DecisionNode, opt: Option): RunState {
  const e = opt.effect;
  const meters = {
    profit: clamp(s.meters.profit + (e.profit ?? 0)),
    future: clamp(s.meters.future + (e.future ?? 0)),
  };
  const trust = Math.max(0, s.trust + (e.trust ?? 0));
  const flags = [...new Set([...s.flags, ...(e.flags ?? [])])];
  const picks = [...s.picks, { nodeId: node.id, optionId: opt.id, grade: opt.grade, real: !!opt.real }];
  const mid: RunState = { ...s, meters, trust, flags, picks, onRealPath: s.onRealPath && !!opt.real };
  const firedId = Object.values(hs.nodes).find((n) => n.type === "ending" && n.tier === "fired")?.id;
  const planned = nextOf(opt, mid);
  const plannedNode = hs.nodes[planned];
  // Losing the board mid-story ends your tenure. On the final call, the story's own ending plays instead.
  const isFinal = plannedNode && (plannedNode.type === "route" || plannedNode.type === "ending");
  const nextId = trust <= 0 && firedId && !isFinal ? firedId : planned;
  return { ...mid, nodeId: nextId };
}

export function score(hs: HotSeat, s: RunState, ending?: EndingNode): number {
  const decisionsOnPath = s.picks.length || 1;
  const raw = s.picks.reduce((a, p) => a + POINTS[p.grade], 0);
  const maxRaw = decisionsOnPath * POINTS.great;
  const base = Math.round((raw / maxRaw) * 85);
  return Math.max(0, Math.min(100, base + (ending?.bonus ?? 0)));
}

export function traitTotals(hs: HotSeat, s: RunState): Record<TraitKey, number> {
  const t: Record<TraitKey, number> = { horizon: 0, risk: 0, disrupt: 0 };
  for (const p of s.picks) {
    const n = hs.nodes[p.nodeId] as DecisionNode;
    const o = n.options.find((x) => x.id === p.optionId)!;
    for (const k of Object.keys(o.traits) as TraitKey[]) t[k] += o.traits[k] ?? 0;
  }
  return t;
}

export function findOption(hs: HotSeat, p: Choice): { node: DecisionNode; option: Option } {
  const node = hs.nodes[p.nodeId] as DecisionNode;
  return { node, option: node.options.find((o) => o.id === p.optionId)! };
}

/**
 * Personalised debrief, built without a live LLM. Every path is known in advance,
 * so the notes are assembled from authored lines for each choice plus pattern lines.
 * (A build-time script can also pre-write one LLM debrief per path; see docs/HOT-SEAT-DESIGN.md.)
 */
export function buildDebrief(hs: HotSeat, s: RunState) {
  const lines = s.picks.map((p) => {
    const { node, option } = findOption(hs, p);
    return {
      year: node.year,
      title: node.title,
      choice: option.label,
      grade: option.grade,
      real: !!option.real,
      takeaway: option.takeaway,
      better: option.better,
    };
  });
  const bad = s.picks.filter((p) => p.grade === "bad").length;
  const firstBad = s.picks.findIndex((p) => p.grade === "bad");
  const recovered = firstBad >= 0 && s.picks.slice(firstBad + 1).some((p) => p.grade === "great");
  const t = traitTotals(hs, s);
  const patterns: string[] = [];
  if (bad === 0)
    patterns.push("You never made a call the board punished. You read each shift early and acted before it was forced on you.");
  if (recovered) patterns.push("You made a costly call, then fixed course. Turnarounds start with admitting the first decision was wrong.");
  if (bad >= 2 && !recovered)
    patterns.push(
      "Your mistakes compounded. Each 'safe' call made the next fix more expensive. Spot that pattern early in your own business.",
    );
  if (t.disrupt < 0)
    patterns.push(
      "You leaned toward protecting what already worked. That instinct keeps a business stable, until the market moves without you.",
    );
  if (t.disrupt > 1)
    patterns.push("You were willing to compete with your own best product. That's the hardest habit for a successful company to keep.");
  if (s.onRealPath && s.picks.length) patterns.push(`You made the same calls ${hs.company} made, and got the same result.`);
  return { lines, patterns, recovered };
}

/** Key for a path's pre-written debrief in debriefs.json, e.g. "d1:shelve>d2:study". */
export const debriefKey = (picks: Choice[]) => picks.map((p) => `${p.nodeId}:${p.optionId}`).join(">");

/** content/hotseats/<id>/debriefs.json: drafts from `npm run debriefs`, shown only once a person sets reviewed to true. */
export type Debriefs = Record<string, { text: string; reviewed: boolean }>;

/** The reviewed debrief for this path, or undefined (then the app shows the assembled one). */
export function reviewedDebrief(debriefs: Debriefs | undefined, picks: Choice[]): string | undefined {
  const entry = debriefs?.[debriefKey(picks)];
  return entry?.reviewed ? entry.text : undefined;
}

/** The most decisions any run can face: the longest route from the start, ignoring conditions. */
export function callsPerRun(hs: HotSeat): number {
  const memo = new Map<string, number>();
  const onPath = new Set<string>();
  const longest = (id: string): number => {
    const n = hs.nodes[id];
    if (!n || onPath.has(id)) return 0; // missing nodes and loops are reported by the Hot Seat walker test
    if (memo.has(id)) return memo.get(id)!;
    onPath.add(id);
    const targets =
      n.type === "scene"
        ? [n.next]
        : n.type === "route"
          ? n.routes.map((r) => r.to)
          : n.type === "decision"
            ? n.options.flatMap((o) => (typeof o.next === "string" ? [o.next] : o.next.map((r) => r.to)))
            : [];
    const calls = Math.max(0, ...targets.map(longest)) + (n.type === "decision" ? 1 : 0);
    onPath.delete(id);
    memo.set(id, calls);
    return calls;
  };
  return longest(hs.start);
}

/** Deterministic per-player order of Hot Seats: seeded shuffle, but the first two stay gentle. */
export function playerOrder<T extends { id: string; complexity: number }>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const gentle = arr.filter((x) => x.complexity <= 2).slice(0, 2);
  return [...gentle, ...arr.filter((x) => !gentle.includes(x))];
}

/**
 * Today's Daily Call. `day` is "YYYY-MM-DD" in the same local calendar the streak uses.
 * Day N after startDay plays calls[N]; past the end of the list it cycles. Appending calls never changes a day inside the list.
 */
export function dailyFor(day: string, pool: DailyPool): DailyCall | undefined {
  const len = pool.calls.length;
  if (!len) return undefined;
  const n = Math.round((Date.parse(day) - Date.parse(pool.startDay)) / 864e5);
  return pool.calls[((n % len) + len) % len];
}
