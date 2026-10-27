// Checks one Hot Seat folder: schema, tree, media and narration. Used by `npm run hotseat:check` and the tests.
// Loaded by Node in the hotseat CLI, so: relative .ts imports, type-only imports for types, no path aliases.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { callsPerRun, choose, resolveNode, score, startRun, type RunState } from "./engine.ts";
import { HotSeatSchema } from "./hotseat-schema.ts";
import type { EndingNode, HotSeat, Media } from "./hotseat-types";
import { voiceLines } from "./voice-lines.ts";

export const AUDIO_DIR = join(import.meta.dirname, "../../public/audio");

export interface Run {
  state: RunState;
  ending: EndingNode;
}

/** Every possible playthrough. Problems (missing nodes, loops) are collected, not thrown. */
export function walkRuns(hs: HotSeat): { runs: Run[]; errors: string[] } {
  const runs: Run[] = [];
  const errors = new Set<string>();
  const walk = (state: RunState, trail: string[]) => {
    const at = trail.join(" > ") || "start";
    let node;
    try {
      node = resolveNode(hs, state, state.nodeId);
      while (node.type === "scene") {
        state = { ...state, nodeId: node.next };
        node = resolveNode(hs, state, node.next);
      }
    } catch (e) {
      errors.add(`${at}: ${(e as Error).message}`);
      return;
    }
    if (node.type === "ending") return void runs.push({ state, ending: node });
    if (node.type !== "decision") return void errors.add(`${at}: route "${node.id}" did not resolve`);
    if (trail.length > 30) return void errors.add(`${at}: path too long, is there a loop?`);
    for (const opt of node.options) walk(choose(hs, state, node, opt), [...trail, `${node.id}:${opt.id}`]);
  };
  walk(startRun(hs), []);
  return { runs, errors: [...errors] };
}

/** Every media ref in a Hot Seat, as file names ("img:x" → "x.webp"). */
export function mediaFiles(hs: HotSeat): Set<string> {
  const refs: Media[] = [hs.cover];
  for (const n of Object.values(hs.nodes)) {
    if (n.type !== "route") refs.push(n.media);
    if (n.type === "decision") for (const o of n.options) refs.push(o.media);
  }
  return new Set(refs.map((m) => m.replace(/^img:(.*)$/, "$1.webp").replace(/^vid:(.*)$/, "$1.mp4")));
}

export interface CheckResult {
  errors: string[];
  warnings: string[];
  stats?: { paths: number; endings: Record<string, number>; scores: [number, number]; calls: number };
}

export function checkHotSeat(dir: string, audioDir = AUDIO_DIR): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const result = { errors, warnings };

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, "hotseat.json"), "utf8"));
  } catch (e) {
    return { errors: [`hotseat.json: ${(e as Error).message}`], warnings };
  }
  const parsed = HotSeatSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`schema: ${i.path.join(".") || "(root)"}: ${i.message}`);
    return result;
  }
  const hs = parsed.data;
  const soft = (msg: string) => (hs.draft ? warnings : errors).push(msg); // drafts may lack media and audio

  // Static pass: ids line up and every link points at a real node.
  if (hs.id !== basename(dir)) errors.push(`id "${hs.id}" must match its folder "${basename(dir)}"`);
  const link = (from: string, to: string) => !hs.nodes[to] && errors.push(`${from} links to missing node "${to}"`);
  link("start", hs.start);
  for (const [key, n] of Object.entries(hs.nodes)) {
    if (key !== n.id) errors.push(`nodes.${key} has id "${n.id}"; they must match`);
    if (n.type === "scene") link(n.id, n.next);
    if (n.type === "route") n.routes.forEach((r) => link(n.id, r.to));
    if (n.type === "decision") {
      for (const o of n.options) {
        (typeof o.next === "string" ? [o.next] : o.next.map((r) => r.to)).forEach((to) => link(`${n.id}/${o.id}`, to));
        for (const k of ["label", "outcome", "why", "takeaway"] as const) if (!o[k]) errors.push(`${n.id}/${o.id} is missing ${k}`);
        if (o.grade !== "great" && !o.better) errors.push(`${n.id}/${o.id}: ok/bad options need "better"`);
      }
    }
  }
  if (errors.length) return result;

  // Walk every path.
  const { runs, errors: walkErrors } = walkRuns(hs);
  errors.push(...walkErrors);
  const calls = callsPerRun(hs);
  const endings: Record<string, number> = {};
  const scores = runs.map((r) => score(hs, r.state, r.ending));
  for (const r of runs) endings[r.ending.id] = (endings[r.ending.id] ?? 0) + 1;
  for (const n of Object.values(hs.nodes)) if (n.type === "ending" && !endings[n.id]) errors.push(`ending "${n.id}" can't be reached`);
  if (runs.some((r) => r.state.picks.length > calls)) errors.push(`a path has more calls than callsPerRun (${calls})`);

  // Media and narration.
  const mediaDir = join(dir, "media");
  const onDisk = new Set(existsSync(mediaDir) ? readdirSync(mediaDir).filter((f) => [".webp", ".mp4"].includes(extname(f))) : []);
  const used = mediaFiles(hs);
  for (const f of used) if (!onDisk.has(f)) soft(`media/${f} is missing`);
  for (const f of onDisk) if (!used.has(f)) warnings.push(`media/${f} is not used`);
  for (const l of voiceLines([hs]))
    if (!existsSync(join(audioDir, `${l.id}.mp3`))) soft(`no audio for "${l.text.slice(0, 50)}…" (${l.id})`);

  return { ...result, stats: { paths: runs.length, endings, scores: [Math.min(...scores), Math.max(...scores)], calls } };
}

/** Media names shared by more than one Hot Seat. They'd overwrite each other in public/media/. */
export function mediaCollisions(dirs: string[]): string[] {
  const owner = new Map<string, string>();
  const clashes: string[] = [];
  for (const dir of dirs) {
    const media = join(dir, "media");
    for (const f of existsSync(media) ? readdirSync(media) : []) {
      if (owner.has(f)) clashes.push(`media/${f} is in both ${owner.get(f)} and ${basename(dir)}`);
      else owner.set(f, basename(dir));
    }
  }
  return clashes;
}
