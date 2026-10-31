// Play a lesson on the server. The phone sends only the answers so far; this replays them and returns what the
// player may see now: the verdict on the last answer and the next screens, never an answer before it is given.
// Exercises missed the first time come back once at the end, so the replay stays a pure function of the answers.
// Node runs this file directly (tests, scripts), so it keeps relative .ts imports.
import type { Lesson, Module, Option, Screen } from "./course-types";
import type { LessonMistake } from "./game-state";
import type { Grade, Media } from "./hotseat-types";
import { GOT_IT } from "./lesson-voice.ts";
import { PlayError } from "./play.ts";

export interface Answer {
  screenId: string;
  /** An option id (choice, scenario), or a list: gap words, order steps, or a bucket ("0"/"1") per sort item. */
  value: string | string[];
}

type Shown =
  | { kind: "explain"; id: string; title?: string; text: string; media?: Media }
  | { kind: "choice"; id: string; prompt: string; media?: Media; options: Option[]; guess?: boolean }
  | { kind: "gap"; id: string; text: string; bank: string[] }
  | { kind: "order"; id: string; prompt: string; steps: string[] }
  | { kind: "sort"; id: string; prompt: string; buckets: string[]; items: string[] }
  | { kind: "scenario"; id: string; year?: string; media?: Media; setup: string; question: string; advisor?: string; options: Option[] };

/** A screen as the phone gets it: no answer, no why. `retry` marks a missed exercise coming back. */
export type LessonScreen = Shown & { retry?: boolean };

export interface LessonReveal {
  screenId: string;
  correct: boolean;
  /** A "guess first" screen: shown as a hint, never as wrong. */
  guess?: boolean;
  why: string;
  /** The right answer, written out, when the player missed it. */
  right?: string;
  /** Scenarios only. */
  grade?: Grade;
  outcome?: string;
  better?: string;
  retry: boolean;
  /** Said before `why` when a missed exercise is now right: the long explanation was already heard once. */
  cheer?: string;
}

export interface LessonResult {
  /** First-try accuracy, 0–100, over scored exercises. */
  accuracy: number;
  right: number;
  scored: number;
  mistakes: Omit<LessonMistake, "day">[];
  principle: string;
  summary: string[];
  cardIds: string[];
}

export interface LessonView {
  lesson: { id: string; title: string; principle: string };
  /** Exercises answered so far, out of all of them (including missed ones coming back). */
  progress: { done: number; total: number };
  reveal?: LessonReveal;
  /** Explain screens up to and including the next exercise; at the end, any closing explain screens. */
  screens: LessonScreen[];
  /** Set once every exercise is answered. */
  result?: LessonResult;
}

export const MAX_ANSWERS = 60;

/** A shuffle seeded by the text, so every replay of the same screen shows the same order. */
function shuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** The steps of an order exercise as shown: shuffled, and never already in the right order. */
const shownSteps = (lessonId: string, s: Extract<Screen, { kind: "order" }>) => {
  const x = shuffle(s.steps, `${lessonId}/${s.id}`);
  return x.every((v, i) => v === s.steps[i]) ? [...x.slice(1), x[0]] : x;
};
const shownItems = (lessonId: string, s: Extract<Screen, { kind: "sort" }>) => shuffle(s.items, `${lessonId}/${s.id}`);

function show(lessonId: string, s: Screen): Shown {
  switch (s.kind) {
    case "explain":
      return s;
    case "choice":
      return { kind: s.kind, id: s.id, prompt: s.prompt, media: s.media, options: s.options, guess: s.guess };
    case "gap":
      return { kind: s.kind, id: s.id, text: s.text, bank: shuffle(s.bank, `${lessonId}/${s.id}`) };
    case "order":
      return { kind: s.kind, id: s.id, prompt: s.prompt, steps: shownSteps(lessonId, s) };
    case "sort":
      return { kind: s.kind, id: s.id, prompt: s.prompt, buckets: s.buckets, items: shownItems(lessonId, s).map((i) => i.text) };
    case "scenario":
      return {
        kind: s.kind,
        id: s.id,
        year: s.year,
        media: s.media,
        setup: s.setup,
        question: s.question,
        advisor: s.advisor,
        options: s.options.map((o) => ({ id: o.id, label: o.label })),
      };
  }
}

const list = (v: Answer["value"], n: number, allowed?: string[]) => {
  if (!Array.isArray(v) || v.length !== n || v.some((x) => typeof x !== "string" || (allowed && !allowed.includes(x))))
    throw new PlayError("bad answer");
  return v;
};
const one = (v: Answer["value"], allowed: string[]) => {
  if (typeof v !== "string" || !allowed.includes(v)) throw new PlayError("bad answer");
  return v;
};
const sorted = (buckets: string[], items: { text: string; bucket: number }[], pick: (i: number) => number) =>
  buckets
    .map(
      (b, k) =>
        `${b}: ${
          items
            .filter((_, i) => pick(i) === k)
            .map((x) => x.text)
            .join(", ") || "none"
        }`,
    )
    .join(". ");

/** Grade one answer: right or not, the verdict text, and the player's pick written out for the Mistake journal. */
function grade(lessonId: string, s: Exclude<Screen, { kind: "explain" }>, value: Answer["value"]) {
  switch (s.kind) {
    case "choice": {
      const pick = one(
        value,
        s.options.map((o) => o.id),
      );
      const correct = pick === s.answer;
      const label = (id: string) => s.options.find((o) => o.id === id)!.label;
      return {
        correct: correct || !!s.guess,
        guess: s.guess,
        why: (!correct && s.wrong?.[pick]) || s.why,
        right: correct ? undefined : label(s.answer),
        prompt: s.prompt,
        picked: label(pick),
      };
    }
    case "gap": {
      const pick = list(value, s.answer.length, s.bank);
      const correct = pick.every((w, i) => w === s.answer[i]);
      return { correct, why: s.why, right: correct ? undefined : s.answer.join(", "), prompt: s.text, picked: pick.join(", ") };
    }
    case "order": {
      const pick = list(value, s.steps.length, s.steps);
      if (new Set(pick).size !== pick.length) throw new PlayError("bad answer");
      const correct = pick.every((w, i) => w === s.steps[i]);
      return { correct, why: s.why, right: correct ? undefined : s.steps.join(" → "), prompt: s.prompt, picked: pick.join(" → ") };
    }
    case "sort": {
      const items = shownItems(lessonId, s);
      const pick = list(value, items.length, ["0", "1"]).map(Number);
      const correct = items.every((it, i) => it.bucket === pick[i]);
      return {
        correct,
        why: s.why,
        right: correct ? undefined : sorted(s.buckets, items, (i) => items[i].bucket),
        prompt: s.prompt,
        picked: sorted(s.buckets, items, (i) => pick[i]),
      };
    }
    case "scenario": {
      const o = s.options.find(
        (x) =>
          x.id ===
          one(
            value,
            s.options.map((x) => x.id),
          ),
      )!;
      const correct = o.grade === "great";
      return {
        correct,
        why: o.why,
        right: correct ? undefined : (o.better ?? s.options.find((x) => x.grade === "great")?.label),
        grade: o.grade,
        outcome: o.outcome,
        better: o.better,
        prompt: s.question,
        picked: o.label,
      };
    }
  }
}

/**
 * Replay `answers` from the start and return the player's view. Throws PlayError for answers out of order or not
 * allowed by the screen. With `retry` off (a test-out quiz), missed exercises don't come back.
 */
export function lessonPlay(lesson: Lesson, answers: Answer[], { retry = true } = {}): LessonView {
  if (answers.length > MAX_ANSWERS) throw new PlayError("too many answers");
  const seq = lesson.screens.map((screen) => ({ screen, retry: false }));
  const first = new Map<string, boolean>();
  const mistakes: LessonResult["mistakes"] = [];
  let pos = 0;
  let reveal: LessonReveal | undefined;
  for (const a of answers) {
    while (pos < seq.length && seq[pos].screen.kind === "explain") pos++;
    const step = seq[pos];
    if (!step || step.screen.kind === "explain" || step.screen.id !== a.screenId) throw new PlayError(`no exercise ${a.screenId} here`);
    const g = grade(lesson.id, step.screen, a.value);
    if (!step.retry && !g.guess) {
      first.set(step.screen.id, g.correct);
      if (!g.correct) {
        mistakes.push({
          lessonId: lesson.id,
          screenId: step.screen.id,
          prompt: g.prompt,
          picked: g.picked,
          right: g.right ?? "",
          why: g.why,
        });
        if (retry) seq.push({ screen: step.screen, retry: true });
      }
    }
    // Right on the second try: a teacher doesn't repeat the whole explanation, just praises and gives the rule
    // (Atheeb, 31 Oct 2026). Scenarios keep their story outcome.
    const gotIt = step.retry && g.correct && step.screen.kind !== "scenario";
    reveal = {
      screenId: step.screen.id,
      correct: g.correct,
      guess: g.guess,
      why: gotIt ? lesson.principle : g.why,
      cheer: gotIt ? GOT_IT : undefined,
      right: g.right,
      grade: "grade" in g ? g.grade : undefined,
      outcome: "outcome" in g ? g.outcome : undefined,
      better: "better" in g ? g.better : undefined,
      retry: step.retry,
    };
    pos++;
  }
  const screens: LessonScreen[] = [];
  for (let p = pos; p < seq.length; p++) {
    screens.push(seq[p].retry ? { ...show(lesson.id, seq[p].screen), retry: true } : show(lesson.id, seq[p].screen));
    if (seq[p].screen.kind !== "explain") break;
  }
  const view: LessonView = {
    lesson: { id: lesson.id, title: lesson.title, principle: lesson.principle },
    progress: { done: answers.length, total: seq.filter((x) => x.screen.kind !== "explain").length },
    reveal,
    screens,
  };
  if (screens.every((x) => x.kind === "explain")) {
    const right = [...first.values()].filter(Boolean).length;
    view.result = {
      accuracy: first.size ? Math.round((100 * right) / first.size) : 100,
      right,
      scored: first.size,
      mistakes,
      principle: lesson.principle,
      summary: lesson.summary,
      cardIds: lesson.cards.map((c) => c.id),
    };
  }
  return view;
}

/**
 * The test-out quiz for a module: one exercise from each lesson (its last scored one), no explain screens and no
 * second tries. Passing it marks every lesson in the module done (applyTestOut).
 */
export function testOutLesson(module: Module, lessons: Lesson[]): Lesson {
  const screens = lessons.flatMap((l) => {
    const s = l.screens.findLast((x) => x.kind !== "explain" && !(x.kind === "choice" && x.guess));
    return s ? [{ ...s, id: `${l.id}.${s.id}` }] : [];
  });
  return {
    id: `test-${module.id}`,
    title: `Test out: ${module.title}`,
    principle: module.goal,
    minutes: Math.max(1, Math.ceil(screens.length / 2)),
    screens,
    summary: lessons.map((l) => l.principle),
    cards: lessons.flatMap((l) => l.cards),
  };
}

/** Checks a request body is a list of answers, before it reaches the replay. */
export function parseAnswers(x: unknown): Answer[] {
  if (!Array.isArray(x) || x.length > MAX_ANSWERS) throw new PlayError("bad answers");
  return x.map((a) => {
    const v = a?.value;
    if (!a || typeof a.screenId !== "string" || !(typeof v === "string" || (Array.isArray(v) && v.length <= 12)))
      throw new PlayError("bad answer");
    return { screenId: a.screenId, value: v };
  });
}
