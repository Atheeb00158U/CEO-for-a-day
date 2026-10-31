// Hot Seats, Daily Calls and the course, read from content/ on the server. Nothing here may be imported by client code:
// these objects hold every answer. The phone gets only what src/lib/play.ts and the API routes hand out.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { callsPerRun, dailyFor, reviewedDebrief, type Debriefs } from "../engine.ts";
import { HOTSEATS_DIR, hotSeatIds, lessonFileIds, readCourse, readDailyPool, readHotSeat, readLesson } from "../content-files.ts";
import type { Card, CourseOutline, Lesson, Module } from "../course-types";
import type { CatalogEntry, DailyAnswer, DailyCall, DailyPool, DailyQuestion, HotSeat } from "../hotseat-types";
import { testOutLesson } from "../lesson-play.ts";
import type { Pick } from "../play.ts";
import { COURSE_TRIAL_ID, TRIAL_ID } from "../../content/catalog";

/** Drafts are playable only in `npm run dev`. The environment is passed in so tests can check production. */
export const canServe = (hs: { draft?: boolean }, nodeEnv = process.env.NODE_ENV) => !hs.draft || nodeEnv === "development";

// Content only changes with a deploy, so production reads each file once. Dev reads fresh, so edits show up.
const cache = new Map<string, unknown>();
function cached<T>(key: string, read: () => T): T {
  if (process.env.NODE_ENV !== "production") return read();
  if (!cache.has(key)) cache.set(key, read());
  return cache.get(key) as T;
}

const allHotSeats = () => cached("all", () => hotSeatIds().map(readHotSeat));

/** A Hot Seat the player may play, or undefined (unknown id, or a draft outside dev). */
export function servableHotSeat(id: string, nodeEnv = process.env.NODE_ENV): HotSeat | undefined {
  if (!/^[a-z0-9-]{1,60}$/.test(id)) return undefined;
  const hs = allHotSeats().find((h) => h.id === id);
  return hs && canServe(hs, nodeEnv) ? hs : undefined;
}

/** The pre-written debrief for this path, once a person has reviewed it. */
export function writtenDebrief(id: string, picks: Pick[]): string | undefined {
  const file = join(HOTSEATS_DIR, id, "debriefs.json");
  const all = cached(`debriefs:${id}`, () => (existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Debriefs) : undefined));
  return reviewedDebrief(all, picks);
}

const entry = (hs: HotSeat, available: boolean): CatalogEntry => ({
  id: hs.id,
  company: hs.company,
  title: hs.title,
  hook: hs.hook,
  years: hs.years,
  minutes: hs.minutes,
  calls: callsPerRun(hs),
  cover: available ? hs.cover : undefined,
  emblem: hs.emblem,
  complexity: hs.complexity,
  available,
  ...(hs.madeUp ? { madeUp: true } : {}),
});

/** Shown on the map as "coming soon" until a Hot Seat (even a draft) with the same id exists. */
const COMING_SOON: CatalogEntry[] = [
  {
    id: "blockbuster",
    company: "Blockbuster",
    title: "The $50 million offer",
    hook: "A tiny DVD-by-mail startup wants you to buy it.",
    complexity: 1,
    available: false,
  },
  {
    id: "nokia",
    company: "Nokia",
    title: "The phone that ruled the world",
    hook: "Everyone owns your phone. Then a touchscreen arrives.",
    complexity: 3,
    available: false,
  },
  {
    id: "maggi",
    company: "Maggi",
    title: "Two minutes to crisis",
    hook: "India's favourite noodles get pulled off the shelves.",
    complexity: 2,
    available: false,
  },
  {
    id: "netflix",
    company: "Netflix",
    title: "Kill your own business",
    hook: "Your DVD business is booming. Do you bet on streaming?",
    complexity: 3,
    available: false,
  },
  {
    id: "jio",
    company: "Jio",
    title: "Free for everyone",
    hook: "Launch a telecom network by giving data away.",
    complexity: 4,
    available: false,
  },
];

/**
 * Everything shown on the map. Drafts show as "coming soon" in dev too, so testing matches what players see.
 * Card fields only: no answers.
 */
export function catalog(): CatalogEntry[] {
  const all = allHotSeats();
  return [
    ...all.filter((hs) => !hs.draft).map((hs) => entry(hs, true)),
    ...all.filter((hs) => hs.draft).map((hs) => entry(hs, false)),
    ...COMING_SOON.filter((c) => !all.some((hs) => hs.id === c.id)),
  ];
}

/**
 * The trial's card, when the trial can be played here (production needs it published). With the course on, the
 * made-up kirana-year once it exists (after lesson 1); otherwise, and until then, TRIAL_ID as before.
 */
export function trial(
  nodeEnv = process.env.NODE_ENV,
  servable: (id: string) => HotSeat | undefined = (id) => servableHotSeat(id, nodeEnv),
): CatalogEntry | undefined {
  const hs = (courseOn(nodeEnv) && servable(COURSE_TRIAL_ID)) || servable(TRIAL_ID);
  return hs ? entry(hs, true) : undefined;
}

const dailyPool = () => cached<DailyPool>("daily", readDailyPool);

/**
 * Daily Calls are suspended (Atheeb, 30 Oct 2026) while the course is built. Off, there is no call today: Home
 * hides the card, /api/daily/lock refuses, and the 9 am teaser isn't sent. Set to true to bring them back.
 */
export const DAILY_CALLS_ON = false;

/** Today's Daily Call. Undefined when suspended, when there is none, or outside dev when today's call is still a draft. */
export function todaysCall(day: string, nodeEnv = process.env.NODE_ENV): DailyCall | undefined {
  if (!DAILY_CALLS_ON) return undefined;
  const call = dailyFor(day, dailyPool());
  return call && canServe(call, nodeEnv) ? call : undefined;
}

/** The call without its answers. */
export const questionOf = (c: DailyCall): DailyQuestion => ({
  id: c.id,
  company: c.company,
  year: c.year,
  title: c.title,
  media: c.media,
  setup: c.setup,
  question: c.question,
  advisor: c.advisor,
  options: c.options.map((o) => ({ id: o.id, label: o.label })),
});

/** The reveal for one option, or undefined if the call has no such option. */
export function answerOf(c: DailyCall, optionId: string): DailyAnswer | undefined {
  const option = c.options.find((o) => o.id === optionId);
  if (!option) return undefined;
  const real = c.options.find((o) => o.real);
  return {
    option,
    realChoice: !option.real && real ? { company: c.company, label: real.label } : undefined,
    realHistory: c.realHistory,
    sources: c.sources,
  };
}

/* ------------------------------------------------------------------ */
/* The course: lessons, flashcards and the Home path.                  */
/* ------------------------------------------------------------------ */

/**
 * The course is hidden from players until real lessons exist: on in `npm run dev` (and tests), off in production.
 * Off, the /app page gets no outline (Home and Notes look as they did) and the lesson and card routes answer 404.
 * Make this always true once Unit 1's lessons are published.
 */
export const courseOn = (nodeEnv = process.env.NODE_ENV) => nodeEnv !== "production";

const course = () => cached("course", readCourse);
const lessonsById = () => cached("lessons", () => new Map(lessonFileIds().map((id) => [id, readLesson(id)])));

/** A lesson the player may play, or undefined (course off, unknown id, or a draft outside dev). */
export function servableLesson(id: string, nodeEnv = process.env.NODE_ENV): Lesson | undefined {
  if (!courseOn(nodeEnv) || !/^[a-z0-9-]{1,60}$/.test(id)) return undefined;
  const l = lessonsById().get(id);
  return l && canServe(l, nodeEnv) ? l : undefined;
}

/** The units and modules players may see, with only the lessons they may play. */
function servableUnits(nodeEnv: typeof process.env.NODE_ENV) {
  return course()
    .units.filter((u) => canServe(u, nodeEnv))
    .map((u) => ({
      ...u,
      modules: u.modules
        .map((m) => ({ ...m, lessons: m.lessons.map((id) => servableLesson(id, nodeEnv)).filter((l): l is Lesson => !!l) }))
        .filter((m) => m.lessons.length > 0),
    }))
    .filter((u) => u.modules.length > 0);
}

/** The Home path, without screens or answers. Undefined while the course is off. */
export function courseOutline(nodeEnv = process.env.NODE_ENV): CourseOutline | undefined {
  if (!courseOn(nodeEnv)) return undefined;
  return {
    units: servableUnits(nodeEnv).map((u) => ({
      id: u.id,
      title: u.title,
      goal: u.goal,
      modules: u.modules.map((m) => ({
        id: m.id,
        title: m.title,
        goal: m.goal,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          principle: l.principle,
          minutes: l.minutes,
          exercises: l.screens.filter((s) => s.kind !== "explain").length,
        })),
        gates: m.gates,
      })),
    })),
  };
}

/** A module the player may test out of, with its playable lessons. */
export function servableModule(id: string, nodeEnv = process.env.NODE_ENV): { module: Module; lessons: Lesson[] } | undefined {
  if (!courseOn(nodeEnv) || !/^[a-z0-9-]{1,60}$/.test(id)) return undefined;
  for (const u of servableUnits(nodeEnv))
    for (const m of u.modules) if (m.id === id) return { module: { ...m, lessons: m.lessons.map((l) => l.id) }, lessons: m.lessons };
  return undefined;
}

/** Every lesson id in the course, drafts included: what a guest's imported progress may name. */
export const courseLessonIds = () => new Set(lessonsById().keys());

/** The flashcards of these lessons. Card answers aren't secret: they're study material, shown after each tap. */
export function cardsOf(lessonIds: string[], nodeEnv = process.env.NODE_ENV): (Card & { lessonId: string })[] {
  return lessonIds.flatMap((id) => (servableLesson(id, nodeEnv)?.cards ?? []).map((c) => ({ ...c, lessonId: id })));
}

/** Which lesson each card id belongs to, across the whole course. */
export const cardLessons = () =>
  cached("cardLessons", () => new Map([...lessonsById().values()].flatMap((l) => l.cards.map((c) => [c.id, l.id] as const))));

/** The lesson a request names: `lessonId`, or `testOut` (a module id) for that module's test-out quiz. */
export function lessonOf(body: { lessonId?: unknown; testOut?: unknown } | null, nodeEnv = process.env.NODE_ENV) {
  if (typeof body?.testOut === "string") {
    const m = servableModule(body.testOut, nodeEnv);
    return m && { lesson: testOutLesson(m.module, m.lessons), testOut: m.module.lessons };
  }
  const lesson = typeof body?.lessonId === "string" ? servableLesson(body.lessonId, nodeEnv) : undefined;
  return lesson && { lesson, testOut: undefined };
}
