// Checks content/course/: the schema, the path, every lesson's exercises, card ids and media. Used by
// `npm run hotseat:check` and the tests. Loaded by Node in the hotseat CLI, so: relative .ts imports,
// type-only imports for types, no path aliases.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CourseSchema, LessonSchema } from "./course-schema.ts";
import type { Course, Lesson, Screen } from "./course-types";
import { AUDIO_DIR, type CheckResult } from "./hotseat-check.ts";
import { voiceLines } from "./voice-lines.ts";

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const zodErrors = (file: string, issues: { path: PropertyKey[]; message: string }[]) =>
  issues.map((i) => `${file}: ${i.path.join(".") || "(root)"}: ${i.message}`);

/** Problems inside one lesson. `mediaDir` is where its images live. */
export function lessonProblems(l: Lesson, mediaDir: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = (s: Screen) => `${l.id}/${s.id}`;
  const soft = (m: string) => (l.draft ? warnings : errors).push(m);
  const ids = new Set<string>();
  for (const s of l.screens) {
    if (ids.has(s.id)) errors.push(`${l.id}: screen id "${s.id}" is used twice`);
    ids.add(s.id);
    if (!/^[a-z0-9-]{1,30}$/.test(s.id)) errors.push(`${at(s)}: screen ids are lower-case letters, numbers and dashes`);
    if ("media" in s && s.media) {
      const [kind, name] = s.media.split(":");
      const file = `${name}.${kind === "vid" ? "mp4" : "webp"}`;
      if (!existsSync(join(mediaDir, file))) soft(`${at(s)}: media/${file} is missing`);
    }
    switch (s.kind) {
      case "explain":
        if (words(s.text) > 25) warnings.push(`${at(s)}: ${words(s.text)} words; a teaching screen has at most 25`);
        break;
      case "choice": {
        const opts = s.options.map((o) => o.id);
        if (new Set(opts).size !== opts.length) errors.push(`${at(s)}: option ids repeat`);
        if (!opts.includes(s.answer)) errors.push(`${at(s)}: answer "${s.answer}" is not one of its options`);
        for (const k of Object.keys(s.wrong ?? {}))
          if (!opts.includes(k) || k === s.answer) errors.push(`${at(s)}: wrong."${k}" must be a wrong option`);
        break;
      }
      case "gap": {
        const blanks = s.text.split("___").length - 1;
        if (blanks !== s.answer.length) errors.push(`${at(s)}: ${blanks} blanks (___) but ${s.answer.length} answers`);
        for (const w of s.answer) if (!s.bank.includes(w)) errors.push(`${at(s)}: answer "${w}" is not in the word bank`);
        if (new Set(s.bank).size !== s.bank.length) errors.push(`${at(s)}: the word bank repeats a word`);
        break;
      }
      case "order":
        if (new Set(s.steps).size !== s.steps.length) errors.push(`${at(s)}: two steps are the same`);
        break;
      case "sort":
        if (new Set(s.items.map((i) => i.text)).size !== s.items.length) errors.push(`${at(s)}: two items are the same`);
        if (!s.items.some((i) => i.bucket === 0) || !s.items.some((i) => i.bucket === 1)) errors.push(`${at(s)}: use both buckets`);
        break;
      case "scenario":
        if (new Set(s.options.map((o) => o.id)).size !== 3) errors.push(`${at(s)}: option ids repeat`);
        if (!s.options.some((o) => o.grade === "great")) errors.push(`${at(s)}: needs a great option`);
        for (const o of s.options)
          if (o.grade !== "great" && !o.better) errors.push(`${at(s)}/${o.id}: an ${o.grade} option needs "better"`);
        break;
    }
    const prompt = s.kind === "explain" ? "" : s.kind === "gap" ? s.text : s.kind === "scenario" ? s.question : s.prompt;
    if (words(prompt) > 25) warnings.push(`${at(s)}: the question has ${words(prompt)} words; keep it to 25`);
    if ("options" in s) for (const o of s.options) if (words(o.label) > 12) warnings.push(`${at(s)}/${o.id}: option over 12 words`);
  }
  if (l.screens[0]?.kind !== "explain") errors.push(`${l.id}: the first screen must be "explain" (the hook)`);
  const scored = l.screens.filter((s) => s.kind !== "explain" && !(s.kind === "choice" && s.guess));
  if (scored.length < 3) errors.push(`${l.id}: needs at least 3 scored exercises (has ${scored.length})`);
  const choices = l.screens.filter((s): s is Extract<Screen, { kind: "choice" }> => s.kind === "choice" && !s.guess);
  if (choices.length >= 3) {
    const at = choices.map((c) => c.options.findIndex((o) => o.id === c.answer));
    const most = Math.max(...at.map((i) => at.filter((j) => j === i).length));
    if (most / choices.length > 0.6)
      warnings.push(`${l.id}: the right answer is in the same place in ${most} of ${choices.length} questions`);
  }
  for (const c of l.cards) if (c.answer >= c.options.length) errors.push(`${l.id}/${c.id}: card answer ${c.answer} has no option`);
  if (!l.cards.length) soft(`${l.id}: no flashcards`);
  return { errors, warnings };
}

/** Checks the whole course folder. `hotSeats` are the ids that exist, for the gates. */
export function checkCourse(dir: string, hotSeats: string[], audioDir = AUDIO_DIR): CheckResult & { lessons: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const file = join(dir, "course.json");
  if (!existsSync(file)) return { errors, warnings, lessons: 0 };
  let course: Course;
  try {
    const parsed = CourseSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) return { errors: zodErrors("course.json", parsed.error.issues), warnings, lessons: 0 };
    course = parsed.data;
  } catch (e) {
    return { errors: [`course.json: ${(e as Error).message}`], warnings, lessons: 0 };
  }

  const lessonDir = join(dir, "lessons");
  const lessons = new Map<string, Lesson>();
  for (const f of existsSync(lessonDir) ? readdirSync(lessonDir).filter((x) => x.endsWith(".json")) : []) {
    const name = f.slice(0, -5);
    try {
      const parsed = LessonSchema.safeParse(JSON.parse(readFileSync(join(lessonDir, f), "utf8")));
      if (!parsed.success) {
        errors.push(...zodErrors(`lessons/${f}`, parsed.error.issues));
        continue;
      }
      if (parsed.data.id !== name) errors.push(`lessons/${f}: id "${parsed.data.id}" must match its file name`);
      if (name.startsWith("test-")) errors.push(`lessons/${f}: "test-" ids are kept for test-out quizzes`);
      lessons.set(name, parsed.data);
    } catch (e) {
      errors.push(`lessons/${f}: ${(e as Error).message}`);
    }
  }

  const seen = { unit: new Set<string>(), module: new Set<string>(), lesson: new Set<string>(), gate: new Set<string>() };
  for (const u of course.units) {
    if (seen.unit.has(u.id)) errors.push(`unit id "${u.id}" is used twice`);
    seen.unit.add(u.id);
    for (const m of u.modules) {
      if (seen.module.has(m.id)) errors.push(`module id "${m.id}" is used twice`);
      seen.module.add(m.id);
      for (const id of m.lessons) {
        if (seen.lesson.has(id)) errors.push(`${m.id}: lesson "${id}" is already on the path`);
        seen.lesson.add(id);
        if (!lessons.has(id)) (u.draft ? warnings : errors).push(`${m.id}: lesson "${id}" has no lessons/${id}.json`);
      }
      for (const g of m.gates) {
        if (!hotSeats.includes(g)) errors.push(`${m.id}: gate "${g}" is not a Hot Seat`);
        if (seen.gate.has(g)) errors.push(`${m.id}: Hot Seat "${g}" already closes another module`);
        seen.gate.add(g);
      }
    }
  }
  for (const [id, l] of lessons) if (!seen.lesson.has(id) && !l.draft) errors.push(`lessons/${id}.json is not on the path in course.json`);

  const cardOwner = new Map<string, string>();
  for (const l of lessons.values()) {
    const r = lessonProblems(l, join(dir, "media"));
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    // Missing narration is only a warning: the player falls back to the browser's voice.
    const silent = voiceLines([], [], [l]).filter((v) => !existsSync(join(audioDir, `${v.id}.mp3`))).length;
    if (silent) warnings.push(`${l.id}: ${silent} lines have no audio yet; run npm run narrate`);
    for (const c of l.cards) {
      if (cardOwner.has(c.id)) errors.push(`card id "${c.id}" is in both ${cardOwner.get(c.id)} and ${l.id}; card ids are never reused`);
      cardOwner.set(c.id, l.id);
    }
  }
  return { errors, warnings, lessons: lessons.size };
}
