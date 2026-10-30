// The pure rules for lessons and flashcards (game-state.ts) and the FSRS wrapper (srs.ts).
import { describe, expect, it } from "vitest";
import {
  applyLesson,
  applyReview,
  applyTestOut,
  cardsToday,
  ECONOMY,
  fresh,
  lessonXp,
  rollover,
  TEST_OUT_PASS,
  withDefaults,
  type GameState,
  type LessonFinish,
} from "./game-state";
import { newCard, ratingOf, review } from "./srs";
import { Rating } from "ts-fsrs";

const now = new Date("2026-10-28T06:30:00Z"); // Wednesday, noon IST
const day = "2026-10-28";
const base = (patch: Partial<GameState> = {}): GameState => ({ ...fresh(), quests: { ...fresh().quests, day }, ...patch });
const finish = (patch: Partial<LessonFinish> = {}): LessonFinish => ({
  lessonId: "margin",
  accuracy: 80,
  cardIds: ["m-1", "m-2"],
  mistakes: [],
  ...patch,
});

describe("old saves", () => {
  // A save from before lessons and flashcards existed: no `lessons`, `cards`, `mistakes`, and `quests` without the
  // new counters. A shallow merge kept the old `quests` whole, so `quests.reviews` came back undefined.
  const old = {
    v: 1,
    seed: "abc",
    name: "Asha",
    xp: 340,
    quests: { day, decisions: 2, great: 1, xp: 40, claimed: ["great"] },
    settings: { voice: false },
    best: { kodak: 70 },
  } as unknown as Partial<GameState>;

  it("get every new field, at every depth, and keep what they had", () => {
    const s = withDefaults(old);
    expect(s.quests).toEqual({ day, decisions: 2, great: 1, xp: 40, claimed: ["great"], lessons: 0, replays: 0, reviews: 0, newCards: 0 });
    expect(s.settings).toEqual({ voice: false, sfx: true, dataSaver: false, lang: "en" });
    expect(s).toMatchObject({ name: "Asha", xp: 340, best: { kodak: 70 }, lessons: {}, cards: {}, mistakes: [] });
  });

  it("can play a lesson and review straight away", () => {
    const s = withDefaults(old);
    const { state } = applyLesson(s, finish(), now);
    expect(state.quests.lessons).toBe(1);
    expect(Number.isNaN(applyReview(state, [{ cardId: "m-1", pick: 0, ms: 5000 }], { "m-1": 0 }, now).state.quests.reviews)).toBe(false);
  });

  it("keep arrays as saved", () => {
    expect(withDefaults({ ...old, badges: ["first_seat"] }).badges).toEqual(["first_seat"]);
  });
});

describe("finishing a lesson", () => {
  it("pays XP with a first-try bonus, coins, best score and the lesson's cards", () => {
    const { state, xp } = applyLesson(base(), finish({ accuracy: 80 }), now);
    expect(xp).toBe(ECONOMY.lesson.xp + 4);
    expect(state.xp).toBe(xp);
    expect(state.coins).toBe(ECONOMY.starter.coins + ECONOMY.lesson.coins);
    expect(state.league.weeklyXp).toBe(xp);
    expect(state.lessons).toEqual({ margin: 80 });
    expect(state.cards).toEqual({ "m-1": newCard(day), "m-2": newCard(day) });
    expect(state).toMatchObject({ streak: 1, lastActiveDay: day });
  });

  it("pays a little for a few replays a day, then nothing, and keeps the best score", () => {
    let s = applyLesson(base(), finish({ accuracy: 90 }), now).state;
    const paid: number[] = [];
    for (let i = 0; i < ECONOMY.lesson.replaysPaid + 2; i++) {
      const r = applyLesson(s, finish({ accuracy: 50 }), now);
      paid.push(r.xp);
      s = r.state;
    }
    expect(paid).toEqual([...Array(ECONOMY.lesson.replaysPaid).fill(ECONOMY.lesson.replayXp), 0, 0]);
    expect(s.lessons.margin).toBe(90);
    expect(s.coins).toBe(ECONOMY.starter.coins + ECONOMY.lesson.coins);
  });

  it("doubles XP while a booster runs", () => {
    expect(lessonXp(100, true, 0, true)).toBe(2 * (ECONOMY.lesson.xp + ECONOMY.lesson.firstTryBonus));
  });

  it("keeps a card's schedule when the lesson is played again", () => {
    const s = base({ cards: { "m-1": review(newCard(day), Rating.Good, day) } });
    expect(applyLesson(s, finish(), now).state.cards["m-1"]).toEqual(s.cards["m-1"]);
  });

  it("puts mistakes in the journal, newest first, replacing the same exercise", () => {
    const m = (screenId: string) => ({ lessonId: "margin", screenId, prompt: "p", picked: "x", right: "y", why: "w" });
    let s = applyLesson(base(), finish({ mistakes: [m("a"), m("b")] }), now).state;
    s = applyLesson(s, finish({ mistakes: [m("b")] }), now).state;
    expect(s.mistakes.map((x) => x.screenId)).toEqual(["b", "a"]);
    expect(s.mistakes[0].day).toBe(day);
  });

  it("resets the lesson counters on a new day", () => {
    const s = applyLesson(base(), finish(), now).state;
    expect(rollover(s, new Date("2026-10-29T06:30:00Z")).quests).toMatchObject({ lessons: 0, replays: 0, reviews: 0, newCards: 0 });
  });
});

describe("test-out", () => {
  const t = { lessonIds: ["a", "b"], accuracy: 100, cardIds: ["a-1", "b-1"] };

  it("marks the module's lessons done and adds their cards, with no XP", () => {
    const s = applyTestOut(base({ lessons: { a: 60 } }), t, now);
    expect(s.lessons).toEqual({ a: 60, b: 100 });
    expect(Object.keys(s.cards)).toEqual(["a-1", "b-1"]);
    expect(s.xp).toBe(0);
  });

  it("changes nothing when the quiz isn't passed", () => {
    const s = base();
    expect(applyTestOut(s, { ...t, accuracy: TEST_OUT_PASS - 1 }, now)).toBe(s);
  });
});

describe("flashcards", () => {
  const deck = (n: number, make: (i: number) => GameState["cards"][string]) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`c${i}`, make(i)]));
  const answers = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]));

  it("grades from right/wrong and speed", () => {
    expect(ratingOf(false, 1000)).toBe(Rating.Again);
    expect(ratingOf(true, 2000)).toBe(Rating.Easy);
    expect(ratingOf(true, 6000)).toBe(Rating.Good);
    expect(ratingOf(true, 20_000)).toBe(Rating.Hard);
  });

  it("schedules by whole days: a right answer waits longer than a wrong one", () => {
    const good = review(newCard(day), Rating.Good, day);
    const again = review(newCard(day), Rating.Again, day);
    expect(good[0] > again[0]).toBe(true);
    expect(good).toMatchObject([expect.stringMatching(/^2026-1[01]-\d\d$/), expect.any(Number), expect.any(Number), 1, 0, day]);
    const later = review(good, Rating.Good, good[0]);
    expect(later[0] > good[0]).toBe(true);
    expect(review(good, Rating.Again, good[0])[4]).toBe(1);
  });

  it("offers today's 10: never the whole backlog, and at most 5 new", () => {
    const s = base({ cards: { ...deck(30, () => ["2026-10-01", 3, 5, 2, 0, "2026-09-20"]), n1: newCard(day) } });
    const today = cardsToday(s, now);
    expect(today).toHaveLength(ECONOMY.review.session);
    const fresh = base({ cards: deck(12, () => newCard(day)) });
    expect(cardsToday(fresh, now)).toHaveLength(ECONOMY.review.newPerDay);
  });

  it("puts the cards most likely forgotten first and skips ones not due", () => {
    const s = base({
      cards: {
        soon: ["2026-10-28", 10, 5, 3, 0, "2026-10-18"],
        stale: ["2026-10-01", 2, 5, 3, 0, "2026-09-29"],
        later: ["2026-11-20", 30, 5, 3, 0, "2026-10-20"],
        fresh: newCard(day),
      },
    });
    expect(cardsToday(s, now)).toEqual(["stale", "soon", "fresh"]);
    expect(cardsToday(s, now, ["later", "soon"])).toEqual(["soon", "later"]);
  });

  it("pays 1 XP a card up to the daily cap, keeps the streak at 3+ cards, and counts new ones", () => {
    const ids = Object.keys(deck(12, () => newCard(day)));
    const s = base({ cards: deck(12, () => newCard(day)) });
    const r = applyReview(
      s,
      ids.map((cardId) => ({ cardId, pick: 0, ms: 5000 })),
      answers(ids),
      now,
    );
    expect(r.counted).toBe(ECONOMY.review.newPerDay);
    expect(r.xp).toBe(ECONOMY.review.newPerDay);
    expect(r.state.quests).toMatchObject({ reviews: 5, newCards: 5 });
    expect(r.state.streak).toBe(1);
    const old = base({ cards: deck(25, () => ["2026-10-20", 3, 5, 2, 0, "2026-10-15"]), quests: { ...fresh().quests, day, reviews: 8 } });
    const ids2 = Object.keys(old.cards);
    const r2 = applyReview(
      old,
      ids2.map((cardId) => ({ cardId, pick: 0, ms: 5000 })),
      answers(ids2),
      now,
    );
    expect(r2.counted).toBe(ECONOMY.review.perDay - 8);
    expect(r2.xp).toBe(ECONOMY.review.xpCap - 8);
  });

  it("doesn't keep the streak for one or two cards", () => {
    const s = base({ cards: { a: newCard(day), b: newCard(day) } });
    const r = applyReview(
      s,
      [
        { cardId: "a", pick: 0, ms: 4000 },
        { cardId: "b", pick: 1, ms: 4000 },
      ],
      { a: 0, b: 0 },
      now,
    );
    expect(r.counted).toBe(2);
    expect(r.state.streak).toBe(0);
  });

  it("ignores cards not unlocked, unknown answers, repeats and a second send of the same session", () => {
    const s = base({ cards: { a: newCard(day), b: newCard(day), c: newCard(day) } });
    const reviews = ["a", "a", "b", "c", "zz"].map((cardId) => ({ cardId, pick: 0, ms: 4000 }));
    const once = applyReview(s, reviews, { a: 0, b: 0, zz: 0 }, now);
    expect(once.counted).toBe(2);
    const twice = applyReview(once.state, reviews, { a: 0, b: 0, zz: 0 }, now);
    expect(twice.counted).toBe(0);
    expect(twice.state).toBe(once.state);
  });

  it("reschedules a wrong card sooner than a right one", () => {
    const s = base({ cards: { a: newCard(day), b: newCard(day) } });
    const r = applyReview(
      s,
      [
        { cardId: "a", pick: 0, ms: 5000 },
        { cardId: "b", pick: 1, ms: 5000 },
      ],
      { a: 0, b: 0 },
      now,
    );
    expect(r.state.cards.a[0] > r.state.cards.b[0]).toBe(true);
  });
});
