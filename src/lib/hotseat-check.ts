// Checks one Hot Seat folder: schema, tree, media and narration. Used by `npm run hotseat:check` and the tests.
// Loaded by Node in the hotseat CLI, so: relative .ts imports, type-only imports for types, no path aliases.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { callsPerRun, choose, debriefKey, resolveNode, score, startRun, type RunState } from "./engine.ts";
import { DailyPoolSchema, HotSeatSchema } from "./hotseat-schema.ts";
import type { EndingNode, HotSeat, Media } from "./hotseat-types";
import { voiceLines } from "./voice-lines.ts";

export const AUDIO_DIR = join(process.cwd(), "public/audio");

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
  if (hs.emblem) refs.push(hs.emblem);
  for (const n of Object.values(hs.nodes)) {
    if (n.type !== "route") refs.push(n.media);
    if (n.type === "decision") for (const o of n.options) refs.push(o.media);
  }
  return new Set(refs.map((m) => m.replace(/^img:(.*)$/, "$1.webp").replace(/^vid:(.*)$/, "$1.mp4")));
}

/**
 * factcheck.md must be for this exact content file: its "checked-sha256:" line is the hash of the file it checked,
 * and no claim may still be marked [unsupported] or [contradicted]. See docs/AUTHORING.md.
 */
export function factcheckProblems(dir: string, contentFile: string, reportFile = "factcheck.md"): string[] {
  const report = join(dir, reportFile);
  if (!existsSync(report))
    return [
      reportFile === "factcheck.md"
        ? "no factcheck.md yet; run the fact-check (docs/AUTHORING.md)"
        : `no ${reportFile} yet; a made-up story needs a realism check note instead of a fact-check (docs/AUTHORING.md)`,
    ];
  const text = readFileSync(report, "utf8");
  const stamped = text.match(/^checked-sha256: ([0-9a-f]{64})$/m)?.[1];
  const actual = createHash("sha256")
    .update(readFileSync(join(dir, contentFile)))
    .digest("hex");
  const out: string[] = [];
  if (stamped !== actual) out.push(`${reportFile} was made for a different version of ${contentFile}; check the changes and re-stamp it`);
  const open = text.match(/^- \[(unsupported|contradicted)\]/gm)?.length ?? 0;
  if (open) out.push(`${reportFile} still has ${open} unsupported or contradicted claim(s)`);
  return out;
}

/** The app badges every off-path screen "Our estimate", so the story text must not say it again. */
function saysEstimate(lines: { text: string }[], at = ""): string[] {
  return lines
    .filter((l) => /\bour estimate\b/i.test(l.text))
    .map((l) => `${at}"${l.text.slice(0, 50)}…" says "our estimate"; the app shows that as a badge, so cut it from the text`);
}

/**
 * Rules every set of options shares, in Hot Seats and Daily Calls. A decision the real company faced needs exactly one
 * option marked real; a decision only reachable on alternate paths may have none (the real company never faced it).
 */
export function optionProblems(
  at: string,
  options: { id: string; grade: string; real?: boolean; label: string; why: string; takeaway: string; better?: string; outcome: unknown }[],
  onRealPath = true,
): string[] {
  const out: string[] = [];
  if (!options.some((o) => o.grade === "great")) out.push(`${at} needs at least one great option`);
  const real = options.filter((o) => o.real).length;
  if (onRealPath && real !== 1) out.push(`${at} is on the real path, so it needs exactly one option marked real (has ${real})`);
  if (!onRealPath && real > 0) out.push(`${at} is only reachable on alternate paths, so no option may be marked real (has ${real})`);
  for (const o of options) {
    for (const k of ["label", "outcome", "why", "takeaway"] as const) if (!o[k]) out.push(`${at}/${o.id} is missing ${k}`);
    if (o.grade !== "great" && !o.better) out.push(`${at}/${o.id}: ok/bad options need "better"`);
  }
  return out;
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
      }
    }
  }
  if (errors.length) return result;

  // Follow the real company's calls from the start; those decisions need a real option, the rest must have none.
  const realDecisions = new Set<string>();
  let state = startRun(hs);
  for (let i = 0; !hs.madeUp && i < 50; i++) {
    const node = resolveNode(hs, state, state.nodeId);
    if (node.type === "scene") state = { ...state, nodeId: node.next };
    else if (node.type === "decision") {
      realDecisions.add(node.id);
      const real = node.options.find((o) => o.real);
      if (!real) break;
      state = choose(hs, state, node, real);
    } else break;
  }
  for (const n of Object.values(hs.nodes))
    if (n.type === "decision") {
      if (hs.madeUp && n.options.some((o) => o.real))
        errors.push(`${n.id}: a made-up story has no real company, so no option may be marked real`);
      else errors.push(...optionProblems(n.id, n.options, realDecisions.has(n.id)));
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
  for (const f of used)
    if (f.endsWith(".mp4") && !existsSync(join(mediaDir, f.replace(/mp4$/, "jpg"))))
      soft(`media/${f.replace(/mp4$/, "jpg")} (the clip's still for data saver) is missing; run npm run media on the clip`);
  for (const f of onDisk) if (!used.has(f)) warnings.push(`media/${f} is not used`);
  for (const l of voiceLines([hs]))
    // Missing audio is only a warning: the app falls back to the browser's voice, and narration is recorded
    // on Atheeb's Mac in batches, so a text fix (often a fact fix) must never wait for it.
    if (!existsSync(join(audioDir, `${l.id}.mp3`))) warnings.push(`no audio for "${l.text.slice(0, 50)}…" (${l.id}); run npm run narrate`);

  if (hs.madeUp) {
    // A made-up story has no company to fact-check: a realism note (same stamp and claim marks) checks it feels true,
    // and every source it lists must be one the research brief actually opened.
    for (const p of factcheckProblems(dir, "hotseat.json", "realism.md")) soft(p);
    const research = existsSync(join(dir, "research.md")) ? readFileSync(join(dir, "research.md"), "utf8") : null;
    if (research === null) errors.push("a made-up story needs research.md (its realism sources)");
    else for (const s of hs.sources) if (!research.includes(s.url)) errors.push(`source ${s.url} is not in research.md`);
  } else {
    for (const p of factcheckProblems(dir, "hotseat.json")) soft(p);
    if (!hs.realHistory) errors.push("realHistory is missing (only a made-up story may leave it out)");
  }

  errors.push(...saysEstimate(voiceLines([hs])));

  // Pre-written debriefs: a key that matches no path is left over from an edit and will never be shown.
  const debriefsFile = join(dir, "debriefs.json");
  if (existsSync(debriefsFile)) {
    try {
      const paths = new Set(runs.map((r) => debriefKey(r.state.picks)));
      for (const key of Object.keys(JSON.parse(readFileSync(debriefsFile, "utf8")))) {
        if (!paths.has(key)) warnings.push(`debriefs.json has "${key}", which no path matches any more`);
      }
    } catch (e) {
      errors.push(`debriefs.json: ${(e as Error).message}`);
    }
  }

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

/** Checks content/daily/daily.json: schema, option rules, media, narration, and how many days of calls are left. */
export function checkDailyPool(dir: string, today: string, audioDir = AUDIO_DIR): CheckResult & { daysLeft?: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const file = join(dir, "daily.json");
  if (!existsSync(file)) return { errors, warnings };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`daily.json: ${(e as Error).message}`], warnings };
  }
  const parsed = DailyPoolSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) errors.push(`daily.json schema: ${i.path.join(".") || "(root)"}: ${i.message}`);
    return { errors, warnings };
  }
  const pool = parsed.data;
  const seen = new Set<string>();
  const onDisk = new Set(existsSync(join(dir, "media")) ? readdirSync(join(dir, "media")) : []);
  const used = new Set<string>();
  for (const c of pool.calls) {
    const soft = (msg: string) => (c.draft ? warnings : errors).push(msg);
    if (seen.has(c.id)) errors.push(`daily ${c.id}: the id is used twice`);
    seen.add(c.id);
    errors.push(...optionProblems(`daily ${c.id}`, c.options));
    if (c.media) {
      const f = c.media.replace(/^img:(.*)$/, "$1.webp").replace(/^vid:(.*)$/, "$1.mp4");
      used.add(f);
      if (!onDisk.has(f)) soft(`daily ${c.id}: media/${f} is missing`);
    }
    errors.push(...saysEstimate(voiceLines([], [c]), `daily ${c.id}: `));
    for (const l of voiceLines([], [c]))
      if (!existsSync(join(audioDir, `${l.id}.mp3`)))
        warnings.push(`daily ${c.id}: no audio for "${l.text.slice(0, 40)}…"; run npm run narrate`);
  }
  for (const f of onDisk) if (!used.has(f)) warnings.push(`daily media/${f} is not used`);
  const anyPublished = pool.calls.some((c) => !c.draft);
  for (const p of factcheckProblems(dir, "daily.json")) (anyPublished ? errors : warnings).push(`daily: ${p}`);

  // The order of the list is the schedule; warn before it runs out.
  const n = Math.round((Date.parse(today) - Date.parse(pool.startDay)) / 864e5);
  const daysLeft = Math.max(0, pool.calls.length - Math.max(n, 0) - 1);
  if (pool.calls.length && n >= pool.calls.length)
    warnings.push(`the Daily Calls ran out ${n - pool.calls.length + 1} days ago and are repeating; append more`);
  else if (daysLeft < 14) warnings.push(`only ${daysLeft} days of Daily Calls left after today; append more`);
  return { errors, warnings, daysLeft };
}
