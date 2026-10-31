import { describe, expect, it, vi } from "vitest";

// A fixed sample course, so edits to the real content/course can't break these tests.
vi.hoisted(() => {
  process.env.CFAD_COURSE_DIR = `${process.cwd()}/src/lib/__fixtures__/course`;
});
import { readCourse, readLesson } from "./content-files";
import type { Lesson } from "./course-types";
import { lessonPlay, parseAnswers, testOutLesson, type Answer, type LessonScreen } from "./lesson-play";
import { GOT_IT } from "./lesson-voice";
import { PlayError } from "./play";

const snp = readLesson("sample-sales-not-profit");
const margin = readLesson("sample-margin");
const fv = readLesson("sample-fixed-variable");

/** The right answer for a screen, worked out from the content (the test is allowed to know it). */
function rightAnswer(l: Lesson, shown: LessonScreen): Answer["value"] {
  const s = l.screens.find((x) => x.id === shown.id)!;
  if (s.kind === "choice") return s.answer;
  if (s.kind === "gap") return s.answer;
  if (s.kind === "order") return s.steps;
  if (s.kind === "scenario") return s.options.find((o) => o.grade === "great")!.id;
  if (s.kind === "sort" && shown.kind === "sort") return shown.items.map((t) => String(s.items.find((i) => i.text === t)!.bucket));
  throw new Error("not an exercise");
}
const wrongAnswer = (l: Lesson, shown: LessonScreen): Answer["value"] => {
  const right = rightAnswer(l, shown);
  if (shown.kind === "choice" || shown.kind === "scenario") return shown.options.find((o) => o.id !== right)!.id;
  if (shown.kind === "sort") return (right as string[]).map((b) => (b === "0" ? "1" : "0"));
  return [...(right as string[])].reverse();
};

/** Play a lesson to the end, answering wrong on the screens listed (first try only). */
function playThrough(l: Lesson, miss: string[] = [], opts?: { retry?: boolean }) {
  const answers: Answer[] = [];
  let v = lessonPlay(l, answers, opts);
  for (let n = 0; !v.result; n++) {
    if (n > 40) throw new Error("loop");
    const ex = v.screens.at(-1)!;
    const value = miss.includes(ex.id) && !ex.retry ? wrongAnswer(l, ex) : rightAnswer(l, ex);
    answers.push({ screenId: ex.id, value });
    v = lessonPlay(l, answers, opts);
  }
  return { answers, view: v };
}

describe("lesson replay", () => {
  it("starts with the hook and the first exercise, and gives no answer away", () => {
    const v = lessonPlay(snp, []);
    expect(v.screens.map((s) => s.kind)).toEqual(["explain", "choice"]);
    expect(v.reveal).toBeUndefined();
    const text = JSON.stringify(v);
    for (const s of snp.screens) if ("why" in s) expect(text).not.toContain(s.why);
    expect(text).not.toMatch(/"answer"|"why"|"grade"|"bucket"/);
  });

  it("never sends a scenario's grades or outcomes before the pick", () => {
    const { answers } = playThrough(snp);
    const before = lessonPlay(snp, answers.slice(0, -1));
    const scenario = snp.screens.find((s) => s.kind === "scenario")!;
    expect(before.screens.at(-1)!.kind).toBe("scenario");
    const text = JSON.stringify(before.screens);
    if (scenario.kind === "scenario")
      for (const o of scenario.options) {
        expect(text).not.toContain(o.outcome);
        expect(text).not.toContain(o.why);
      }
  });

  it("scores 100 with every answer right first time", () => {
    const { view } = playThrough(margin);
    expect(view.result).toMatchObject({ accuracy: 100, right: 4, scored: 4, mistakes: [] });
    expect(view.result!.cardIds).toEqual(["sample-margin-1", "sample-margin-2"]);
  });

  it("brings a missed exercise back once at the end, and scores the first try", () => {
    const { answers, view } = playThrough(fv, ["slow"]);
    expect(answers.map((a) => a.screenId)).toEqual(["buckets", "slow", "fill", "mix", "slow"]);
    expect(view.result).toMatchObject({ accuracy: 75, right: 3, scored: 4 });
    expect(view.result!.mistakes).toEqual([expect.objectContaining({ lessonId: fv.id, screenId: "slow", right: "Rent", picked: "Rice" })]);
    expect(view.progress).toEqual({ done: 5, total: 5 });
    expect(view.reveal).toMatchObject({ screenId: "slow", correct: true, retry: true });
  });

  it("praises a right second try and gives the rule, instead of repeating the first explanation", () => {
    const { view } = playThrough(fv, ["slow"]);
    expect(view.reveal).toMatchObject({ cheer: GOT_IT, why: fv.principle });
    const first = playThrough(fv).view;
    expect(first.reveal?.cheer).toBeUndefined();
  });

  it("doesn't bring a missed exercise back twice", () => {
    const answers: Answer[] = [];
    let v = lessonPlay(fv, answers);
    while (!v.result) {
      const ex = v.screens.at(-1)!;
      answers.push({ screenId: ex.id, value: ex.id === "slow" ? "a" : rightAnswer(fv, ex) });
      v = lessonPlay(fv, answers);
    }
    expect(answers.filter((a) => a.screenId === "slow")).toHaveLength(2);
    expect(v.result.accuracy).toBe(75);
  });

  it("tells the player why for a wrong pick, with that option's own line", () => {
    const v = lessonPlay(snp, [
      { screenId: "guess", value: "b" },
      { screenId: "sum", value: "a" },
    ]);
    expect(v.reveal).toMatchObject({ correct: false, right: "₹150", why: "₹500 is the sales. You still have to pay the costs." });
  });

  it("never marks a guess-first screen wrong, and doesn't score it", () => {
    const v = lessonPlay(snp, [{ screenId: "guess", value: "b" }]);
    expect(v.reveal).toMatchObject({ correct: true, guess: true, right: "Her costs ate most of the sales" });
    expect(playThrough(snp).view.result!.scored).toBe(4);
  });

  it("grades scenarios by grade and shows the outcome after the pick", () => {
    const { answers } = playThrough(snp);
    const last = answers.length - 1;
    const v = lessonPlay(snp, [...answers.slice(0, last), { screenId: "mini", value: "c" }]);
    expect(v.reveal).toMatchObject({ correct: false, grade: "bad", outcome: expect.stringContaining("less money") });
    expect(v.reveal!.better).toBeTruthy();
  });

  it("shows order steps shuffled, never already in order, the same on every replay", () => {
    const at = (n: number) => playThrough(margin).answers.slice(0, n);
    const steps = (v: ReturnType<typeof lessonPlay>) => v.screens.find((s) => s.kind === "order");
    const a = steps(lessonPlay(margin, at(3)));
    const b = steps(lessonPlay(margin, at(3)));
    const order = margin.screens.find((s) => s.kind === "order")!;
    expect(a).toEqual(b);
    if (a?.kind === "order" && order.kind === "order") {
      expect(a.steps).not.toEqual(order.steps);
      expect([...a.steps].sort()).toEqual([...order.steps].sort());
    }
  });

  it("refuses answers out of order or not on the screen", () => {
    expect(() => lessonPlay(snp, [{ screenId: "sum", value: "c" }])).toThrow(PlayError);
    expect(() => lessonPlay(snp, [{ screenId: "guess", value: "z" }])).toThrow(PlayError);
    expect(() =>
      lessonPlay(snp, [
        { screenId: "guess", value: "a" },
        { screenId: "sum", value: "c" },
        { screenId: "fill", value: ["left", "nope"] },
      ]),
    ).toThrow(PlayError);
    const done = playThrough(snp).answers;
    expect(() => lessonPlay(snp, [...done, { screenId: "mini", value: "a" }])).toThrow(PlayError);
    expect(() => parseAnswers([{ screenId: 3, value: "a" }])).toThrow(PlayError);
    expect(() => parseAnswers("nope")).toThrow(PlayError);
  });

  it("refuses an order answer that repeats a step", () => {
    const answers = playThrough(margin).answers.slice(0, 3);
    const order = margin.screens.find((s) => s.kind === "order")!;
    if (order.kind !== "order") throw new Error();
    const twice = [order.steps[0], order.steps[0], order.steps[1], order.steps[2]];
    expect(() => lessonPlay(margin, [...answers, { screenId: "steps", value: twice }])).toThrow(PlayError);
  });
});

describe("test-out quiz", () => {
  const mod = readCourse().units[0].modules[0];
  const quiz = testOutLesson(mod, mod.lessons.map(readLesson));

  it("asks one scored exercise per lesson, with no explain screens", () => {
    expect(quiz.id).toBe(`test-${mod.id}`);
    expect(quiz.screens.map((s) => s.id)).toEqual(["sample-sales-not-profit.mini", "sample-margin.steps"]);
    expect(quiz.cards.map((c) => c.id)).toHaveLength(4);
  });

  it("gives no second tries", () => {
    const { answers, view } = playThrough(quiz, ["sample-margin.steps"], { retry: false });
    expect(answers).toHaveLength(2);
    expect(view.result!.accuracy).toBe(50);
  });
});
