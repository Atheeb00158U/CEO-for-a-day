// Lessons and flashcards on the server: the replay pays once, reviews are graded here, guest imports are capped.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readCourse, readLesson } from "../content-files";
import type { Lesson } from "../course-types";
import { ECONOMY, fresh } from "../game-state";
import { lessonPlay, testOutLesson, type Answer } from "../lesson-play";
import { newCard } from "../srs";
import { memoryDb } from "./db";
import { cardLessons, courseLessonIds, courseOutline, lessonOf, servableLesson } from "./content";
import { finishLesson, importCourse, importGuest, load, parseReviews, reviewCards } from "./game";
import { POST as lessonRoute } from "../../app/api/lesson/route";

const now = new Date("2026-10-28T06:30:00Z"); // Wednesday, noon IST
const day = "2026-10-28";
const U = "user-1";
const margin = readLesson("sample-margin");

/** Every answer right (or wrong on `miss`), from the content. */
function answersFor(l: Lesson, miss: string[] = [], retry = true): Answer[] {
  const answers: Answer[] = [];
  for (let v = lessonPlay(l, answers, { retry }); !v.result; v = lessonPlay(l, answers, { retry })) {
    const shown = v.screens.at(-1)!;
    const s = l.screens.find((x) => x.id === shown.id)!;
    let value: Answer["value"];
    if (s.kind === "choice") value = miss.includes(s.id) && !shown.retry ? s.options.find((o) => o.id !== s.answer)!.id : s.answer;
    else if (s.kind === "gap") value = s.answer;
    else if (s.kind === "order") value = miss.includes(s.id) && !shown.retry ? [...s.steps].reverse() : s.steps;
    else if (s.kind === "scenario") value = s.options.find((o) => o.grade === "great")!.id;
    else if (s.kind === "sort" && shown.kind === "sort") value = shown.items.map((t) => String(s.items.find((i) => i.text === t)!.bucket));
    else throw new Error("not an exercise");
    answers.push({ screenId: shown.id, value });
  }
  return answers;
}

describe("the course switch and content", () => {
  it("is off in production: no outline, no lessons", () => {
    expect(courseOutline("production")).toBeUndefined();
    expect(servableLesson("sample-margin", "production")).toBeUndefined();
    expect(lessonOf({ lessonId: "sample-margin" }, "production")).toBeUndefined();
    expect(lessonOf({ testOut: "sample-profit" }, "production")).toBeUndefined();
  });

  it("serves draft lessons only in dev, and the outline holds no screens", () => {
    expect(servableLesson("sample-margin", "test")).toBeUndefined();
    expect(servableLesson("sample-margin", "development")?.id).toBe("sample-margin");
    expect(servableLesson("../x", "development")).toBeUndefined();
    const outline = courseOutline("development")!;
    expect(outline.units[0].modules[0].lessons[0]).toEqual({
      id: "sample-sales-not-profit",
      title: "Sales are not profit",
      principle: "Sales are not profit. Profit is what's left.",
      minutes: 3,
      exercises: 5,
    });
    expect(JSON.stringify(outline)).not.toMatch(/"screens"|"why"|"answer"/);
  });

  it("knows which lesson each card belongs to", () => {
    expect(courseLessonIds().has("sample-margin")).toBe(true);
    expect(cardLessons().get("sample-margin-1")).toBe("sample-margin");
  });
});

describe("POST /api/lesson", () => {
  afterEach(() => vi.unstubAllEnvs());
  const post = (body: unknown) =>
    lessonRoute(
      new Request("http://x/api/lesson", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "1.2.3.4" } }),
    );

  it("returns the next screens and, after an answer, its verdict", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const first = await (await post({ lessonId: "sample-margin", answers: [] })).json();
    expect(first.screens.map((s: { kind: string }) => s.kind)).toEqual(["explain", "explain", "choice"]);
    expect(JSON.stringify(first)).not.toContain(margin.screens[2].kind === "choice" ? margin.screens[2].why : "x");
    const next = await (await post({ lessonId: "sample-margin", answers: [{ screenId: "sum", value: "a" }] })).json();
    expect(next.reveal).toMatchObject({ screenId: "sum", correct: false, right: "₹1" });
  });

  it("answers 404 for a draft outside dev, and 400 for a forged answer", async () => {
    expect((await post({ lessonId: "sample-margin", answers: [] })).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development");
    expect((await post({ lessonId: "sample-margin", answers: [{ screenId: "steps", value: "a" }] })).status).toBe(400);
    expect((await post({ testOut: "sample-profit", answers: [] })).status).toBe(200);
  });
});

describe("finishing a lesson on the server", () => {
  it("pays what the replay scores, once per play key", async () => {
    const db = memoryDb();
    const answers = answersFor(margin, ["sum"]);
    const a = await finishLesson(db, U, margin, { playKey: "play-aaaaaaaa", answers }, now);
    expect(a.result.accuracy).toBe(75);
    expect(a.gained).toBe(ECONOMY.lesson.xp + 4);
    expect(a.state.lessons).toEqual({ "sample-margin": 75 });
    expect(Object.keys(a.state.cards)).toEqual(["sample-margin-1", "sample-margin-2"]);
    expect(a.state.mistakes.map((m) => m.screenId)).toEqual(["sum"]);
    const again = await finishLesson(db, U, margin, { playKey: "play-aaaaaaaa", answers }, now);
    expect(again.gained).toBe(0);
    expect(again.state.xp).toBe(a.state.xp);
    expect(db.lessonPlays).toHaveLength(1);
    expect(db.leagues[0]).toMatchObject({ userId: U, weeklyXp: a.gained });
  });

  it("refuses an unfinished lesson and a bad key", async () => {
    const db = memoryDb();
    const answers = answersFor(margin);
    await expect(finishLesson(db, U, margin, { playKey: "play-bbbbbbbb", answers: answers.slice(0, 2) }, now)).rejects.toThrow(
      /isn't finished/,
    );
    await expect(finishLesson(db, U, margin, { playKey: "x", answers }, now)).rejects.toThrow(/bad play key/);
  });

  it("passes a module on a good test-out, with no XP", async () => {
    const db = memoryDb();
    const m = readCourse().units[0].modules[0];
    const quiz = testOutLesson(m, m.lessons.map(readLesson));
    const r = await finishLesson(db, U, quiz, { playKey: "play-cccccccc", answers: answersFor(quiz, [], false), testOut: m.lessons }, now);
    expect(r.gained).toBe(0);
    expect(r.state.lessons).toEqual({ "sample-sales-not-profit": 100, "sample-margin": 100 });
    expect(Object.keys(r.state.cards)).toHaveLength(4);
  });

  it("changes nothing on a failed test-out", async () => {
    const db = memoryDb();
    const m = readCourse().units[0].modules[0];
    const quiz = testOutLesson(m, m.lessons.map(readLesson));
    const r = await finishLesson(
      db,
      U,
      quiz,
      { playKey: "play-dddddddd", answers: answersFor(quiz, ["sample-margin.steps"], false), testOut: m.lessons },
      now,
    );
    expect(r.result.accuracy).toBe(50);
    expect(r.state.lessons).toEqual({});
  });
});

describe("reviewing cards on the server", () => {
  it("grades against the content, pays once, and saves the schedule", async () => {
    const db = memoryDb();
    await finishLesson(db, U, margin, { playKey: "play-eeeeeeee", answers: answersFor(margin) }, now);
    const xpBefore = (await load(db, U, now)).state.xp;
    const reviews = parseReviews([
      { cardId: "sample-margin-1", pick: 0, ms: 4000 },
      { cardId: "sample-margin-2", pick: 0, ms: 4000 },
      { cardId: "not-mine", pick: 0, ms: 4000 },
    ]);
    const answers = { "sample-margin-1": 0, "sample-margin-2": 1 };
    const r = await reviewCards(db, U, reviews, answers, now);
    expect(r.counted).toBe(2);
    expect(r.gained).toBe(2);
    expect(r.state.xp).toBe(xpBefore + 2);
    expect(r.state.cards["sample-margin-1"][5]).toBe(day);
    // The wrong one comes back sooner.
    expect(r.state.cards["sample-margin-1"][0] > r.state.cards["sample-margin-2"][0]).toBe(true);
    const again = await reviewCards(db, U, reviews, answers, now);
    expect(again.gained).toBe(0);
    expect(again.state.xp).toBe(r.state.xp);
  });

  it("refuses a malformed session", () => {
    expect(() => parseReviews([{ cardId: "a", pick: 0.5, ms: 1 }])).toThrow();
    expect(() => parseReviews(Array(51).fill({ cardId: "a", pick: 0, ms: 1 }))).toThrow();
  });
});

describe("old saves on the server", () => {
  it("load fills fields an old profile lacks, at every depth", async () => {
    const db = memoryDb();
    const old = { ...fresh(), quests: { day, decisions: 1, great: 0, xp: 5, claimed: [] } } as Record<string, unknown>;
    delete old.lessons;
    delete old.cards;
    delete old.mistakes;
    delete old.runs;
    delete old.dailyLog;
    delete old.league;
    await db.createProfile(U, old as never);
    const { state } = await load(db, U, now);
    expect(state.quests).toMatchObject({ decisions: 1, lessons: 0, reviews: 0, newCards: 0, replays: 0 });
    expect(state).toMatchObject({ lessons: {}, cards: {}, mistakes: [] });
  });
});

describe("bringing in a guest's lessons", () => {
  const known = {
    lessons: new Set(["sample-margin", "sample-fixed-variable"]),
    cardLesson: new Map([
      ["sample-margin-1", "sample-margin"],
      ["sample-fv-1", "sample-fixed-variable"],
    ]),
  };

  it("keeps only known lessons and their cards, capped and checked", () => {
    const out = importCourse(
      {
        lessons: { "sample-margin": 250, "made-up": 100 },
        cards: {
          "sample-margin-1": ["2026-11-01", 999, 42, 3, 9, "2026-10-20"],
          "sample-fv-1": newCard(day), // its lesson wasn't imported
          "made-up-1": newCard(day),
        } as never,
      },
      known,
      now,
    );
    expect(out.lessons).toEqual({ "sample-margin": 100 });
    expect(out.cards).toEqual({ "sample-margin-1": ["2026-11-01", 365, 10, 3, 3, "2026-10-20"] });
  });

  it("drops cards due too far ahead or malformed", () => {
    const out = importCourse(
      { lessons: { "sample-margin": 50 }, cards: { "sample-margin-1": ["2030-01-01", 1, 5, 1, 0, day] } as never },
      known,
      now,
    );
    expect(out.cards).toEqual({});
    expect(importCourse({ lessons: "x" as never, cards: [1, 2] as never }, known, now)).toEqual({ lessons: {}, cards: {} });
  });

  it("merges into a new account through importGuest", async () => {
    const db = memoryDb();
    const r = await importGuest(
      db,
      U,
      { xp: 10, lessons: { "sample-margin": 80 }, cards: { "sample-margin-1": newCard(day) } },
      now,
      known,
    );
    expect(r.state.lessons).toEqual({ "sample-margin": 80 });
    expect(r.state.cards).toEqual({ "sample-margin-1": newCard(day) });
  });
});
