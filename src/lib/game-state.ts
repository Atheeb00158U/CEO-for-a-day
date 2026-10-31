import type { DailyCall, DailyOption, Grade, TraitKey } from "./hotseat-types";
import { DEMOTE, leagueRows, PROMOTE } from "./league.ts";
import { newCard, ratingOf, recall, review, type CardState } from "./srs.ts";

/* ------------------------------------------------------------------ */
/* Economy. Tune these in one place.                                   */
/* ------------------------------------------------------------------ */
export const ECONOMY = {
  completionXp: 10, // flat XP for finishing a Hot Seat (score adds 0–100 on top)
  completionCoins: 20,
  boosterMinutes: 15,
  prices: { freeze: 200, booster: 150, hindsight: 100 },
  starter: { coins: 120, freezes: 1, hindsights: 1, boosters: 1 },
  dailyXp: { great: 15, ok: 10, bad: 5 } satisfies Record<Grade, number>,
  /** A lesson pays `xp` plus up to `firstTryBonus` for first-try accuracy the first time; a replay pays `replayXp`, a few a day. */
  lesson: { xp: 10, firstTryBonus: 5, coins: 5, replayXp: 5, replaysPaid: 5 },
  /** Flashcards: 1 XP a card up to `xpCap` a day. "Daily 10": at most `perDay` reviews a day, `newPerDay` of them new. */
  review: { xp: 1, xpCap: 10, session: 10, perDay: 20, newPerDay: 5, streakMin: 3 },
};

export const LEAGUES = ["Intern", "Manager", "Director", "VP", "CEO", "Tycoon"] as const;

export const BADGES: Record<string, { name: string; desc: string }> = {
  first_seat: { name: "First day", desc: "Finish your first Hot Seat" },
  turnaround: { name: "Turnaround artist", desc: "Fix a bad call later in the same Hot Seat" },
  perfect: { name: "Flawless", desc: "Score 95 or more" },
  beat_history: { name: "Beat history", desc: "Get a better ending than the real company" },
  streak_3: { name: "On a roll", desc: "Reach a 3-day streak" },
  fired: { name: "Clean desk", desc: "Get fired by the board. Everyone does once." },
};

export interface RunRecord {
  hotSeatId: string;
  score: number;
  xp: number;
  endingId: string;
  endingTier: string;
  at: number;
  notes: { year: string; title: string; choice: string; grade: Grade; real: boolean; takeaway: string; better?: string }[];
  patterns: string[];
}

export interface GameState {
  v: 1;
  seed: string;
  name: string;
  xp: number;
  coins: number;
  streak: number;
  bestStreak: number;
  lastActiveDay: string | null;
  freezes: number;
  boosters: number;
  boosterUntil: number;
  hindsights: number;
  league: { tier: number; weekId: string; weeklyXp: number };
  runs: RunRecord[];
  best: Record<string, number>;
  quests: Quests;
  badges: string[];
  traits: Record<TraitKey, number>;
  settings: { voice: boolean; sfx: boolean; dataSaver: boolean; lang: "en" | "hi" | "ta" | "bn" };
  /** Today's Daily Call, saved the moment it's locked in so closing the app can't buy a second try. */
  daily: { day: string; id: string; optionId: string; grade: Grade; xp: number } | null;
  /** Takeaways from past Daily Calls, newest first (last 60). */
  dailyLog: DailyNote[];
  /** First-visit answers. `done` once the player finishes or skips the welcome screens. */
  onboarding: Onboarding;
  /** Best first-try accuracy (0–100) per finished lesson. Presence means done (a test-out counts). */
  lessons: Record<string, number>;
  /** The review schedule of every flashcard the player has unlocked, by card id. */
  cards: Record<string, CardState>;
  /** Lesson answers the player got wrong the first time, newest first (last 40). */
  mistakes: LessonMistake[];
}

/** Today's counters (IST): quests read them, and the lesson and review caps use them. */
export interface Quests {
  day: string;
  decisions: number;
  great: number;
  xp: number;
  claimed: string[];
  /** Lessons finished today, and how many of them were replays. */
  lessons: number;
  replays: number;
  /** Flashcards reviewed today, and how many of them were new. */
  reviews: number;
  newCards: number;
}

export interface LessonMistake {
  lessonId: string;
  screenId: string;
  prompt: string;
  picked: string;
  right: string;
  why: string;
  day: string;
}

export type Doing = "job" | "starting" | "running" | "student" | "curious";
export type Focus = "scratch" | "rival" | "money" | "change";
export interface Onboarding {
  done: boolean;
  doing?: Doing;
  focus?: Focus;
  /** Minutes a day the player wants to play. Sets the daily decisions quest. */
  minutes?: 5 | 10 | 15;
}

/** Decisions a day for the "Make N decisions" quest: about one decision a minute and a half. */
export const decisionGoal = (minutes: Onboarding["minutes"] = 5) => ({ 5: 3, 10: 6, 15: 9 })[minutes];

export interface DailyNote {
  day: string;
  company: string;
  title: string;
  choice: string;
  grade: Grade;
  real: boolean;
  takeaway: string;
  better?: string;
}

// One clock for everyone: the date in India. Streaks, quests, the Daily Call and league weeks all turn over at
// midnight IST, on the phone and on the server alike, wherever the player is.
const IST_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" in India. */
export const today = (d = new Date()) => IST_DATE.format(d);
/** The Monday (IST) that starts this league week, as "YYYY-MM-DD". */
export const weekId = (d = new Date()) => {
  const t = new Date(today(d) + "T00:00:00Z");
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
};
/** The moment an IST date starts. */
export const istMidnight = (day: string) => new Date(day + "T00:00:00+05:30");
export const dayDiff = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

const freshQuests = (day: string): Quests => ({
  day,
  decisions: 0,
  great: 0,
  xp: 0,
  claimed: [],
  lessons: 0,
  replays: 0,
  reviews: 0,
  newCards: 0,
});

export function fresh(): GameState {
  const seed = Math.random().toString(36).slice(2, 10);
  return {
    v: 1,
    seed,
    name: "You",
    xp: 0,
    coins: ECONOMY.starter.coins,
    streak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    freezes: ECONOMY.starter.freezes,
    boosters: ECONOMY.starter.boosters,
    boosterUntil: 0,
    hindsights: ECONOMY.starter.hindsights,
    league: { tier: 0, weekId: weekId(), weeklyXp: 0 },
    runs: [],
    best: {},
    quests: freshQuests(today()),
    badges: [],
    traits: { horizon: 0, risk: 0, disrupt: 0 },
    settings: { voice: true, sfx: true, dataSaver: false, lang: "en" },
    daily: null,
    dailyLog: [],
    onboarding: { done: false },
    lessons: {},
    cards: {},
    mistakes: [],
  };
}

const isPlain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
function merge(base: unknown, saved: unknown): unknown {
  if (!isPlain(base) || !isPlain(saved)) return saved === undefined ? base : saved;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(saved)) out[k] = merge(base[k], v);
  return out;
}

/**
 * A save from any older version, with every field it lacks filled from `fresh()` at every depth (a save from before
 * `quests.lessons` existed gets 0, not undefined). Arrays and values in the save are kept as they are.
 */
export const withDefaults = (saved: Partial<GameState>): GameState => merge(fresh(), saved) as GameState;

/**
 * Roll daily/weekly state forward: streak freezes, quest reset, league week.
 * Signed-in players' leagues are settled on the server instead (`settleLeague: false`).
 */
export function rollover(s: GameState, now = new Date(), { settleLeague = true } = {}): GameState {
  const t = today(now);
  const next = { ...s };
  if (next.quests.day !== t) next.quests = freshQuests(t);
  if (next.lastActiveDay && next.streak > 0) {
    const gap = dayDiff(next.lastActiveDay, t);
    if (gap > 1) {
      const missed = gap - 1;
      if (next.freezes >= missed) {
        next.freezes -= missed; // freezes cover the missed days
        next.lastActiveDay = today(new Date(now.getTime() - 864e5));
      } else next.streak = 0;
    }
  }
  if (settleLeague && next.league.weekId !== weekId(now)) {
    // Settle last week: top players move up a league, bottom players move down.
    const rows = leagueRows({
      seed: next.seed,
      weekId: next.league.weekId,
      tier: next.league.tier,
      yourXp: next.league.weeklyXp,
      yourName: next.name,
      now,
    });
    const rank = rows.findIndex((r) => r.you);
    let tier = next.league.tier;
    if (next.league.weeklyXp > 0 && rank < PROMOTE) tier = Math.min(LEAGUES.length - 1, tier + 1);
    else if (rank >= rows.length - DEMOTE) tier = Math.max(0, tier - 1);
    next.league = { tier, weekId: weekId(now), weeklyXp: 0 };
  }
  return next;
}

/** Count today as an active day: extends the streak, or restarts it after a gap. */
export function touchStreak(x: GameState, now = new Date()): GameState {
  const t = today(now);
  if (x.lastActiveDay === t) return x;
  const gap = x.lastActiveDay ? dayDiff(x.lastActiveDay, t) : null;
  const streak = gap === 1 ? x.streak + 1 : 1;
  const badges = streak >= 3 && !x.badges.includes("streak_3") ? [...x.badges, "streak_3"] : x.badges;
  return { ...x, streak, bestStreak: Math.max(x.bestStreak, streak), lastActiveDay: t, badges };
}

/** XP for a Daily Call: by grade, doubled while a booster runs. */
export const dailyXp = (grade: Grade, boosted: boolean) => ECONOMY.dailyXp[grade] * (boosted ? 2 : 1);

/**
 * Lock in today's Daily Call: one play per day. Counts as a decision for the streak and quests, pays dailyXp,
 * and saves the takeaway. A second play the same day returns the state unchanged.
 */
export function applyDaily(
  s: GameState,
  call: Pick<DailyCall, "id" | "company" | "title">,
  option: DailyOption,
  now = new Date(),
): GameState {
  const day = today(now);
  if (s.daily?.day === day) return s;
  const xp = dailyXp(option.grade, s.boosterUntil > now.getTime());
  const x = touchStreak(rollover(s, now), now);
  const note: DailyNote = {
    day,
    company: call.company,
    title: call.title,
    choice: option.label,
    grade: option.grade,
    real: !!option.real,
    takeaway: option.takeaway,
    better: option.better,
  };
  return {
    ...x,
    xp: x.xp + xp,
    league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
    quests: {
      ...x.quests,
      decisions: x.quests.decisions + 1,
      great: x.quests.great + (option.grade === "great" ? 1 : 0),
      xp: x.quests.xp + xp,
    },
    daily: { day, id: call.id, optionId: option.id, grade: option.grade, xp },
    dailyLog: [note, ...x.dailyLog].slice(0, 60),
  };
}

/* ------------------------------------------------------------------ */
/* Rewards and spending. Pure, so the phone (guests) and the server     */
/* (signed-in players) run the same rules.                               */
/* ------------------------------------------------------------------ */

/** Today's quests. The decisions goal follows the minutes a day the player picked at the start. */
export const questsFor = (s: Pick<GameState, "onboarding">) => {
  const n = decisionGoal(s.onboarding.minutes);
  return [
    { id: "decisions", label: `Make ${n} decisions`, goal: n, reward: 15, read: (q: GameState["quests"]) => q.decisions },
    { id: "great", label: "Make 2 great calls", goal: 2, reward: 25, read: (q: GameState["quests"]) => q.great },
    { id: "xp", label: "Earn 60 XP", goal: 60, reward: 30, read: (q: GameState["quests"]) => q.xp },
  ];
};

/** Count one decision toward the streak and today's quests. */
export function applyDecision(x: GameState, grade: Grade, now = new Date()): GameState {
  const y = touchStreak(x, now);
  return { ...y, quests: { ...y.quests, decisions: y.quests.decisions + 1, great: y.quests.great + (grade === "great" ? 1 : 0) } };
}

/** XP for a finished Hot Seat. Only the first finish of each pays the score, so replays can't farm league XP. */
export const finishXp = (score: number, firstTime: boolean, boosted: boolean) =>
  (ECONOMY.completionXp + (firstTime ? score : 0)) * (boosted ? 2 : 1);

export interface Finish {
  run: Omit<RunRecord, "xp" | "at">;
  traits: Record<TraitKey, number>;
  flags: { recovered: boolean; beatHistory: boolean };
  /** Each pick's grade, to count toward quests (the server counts at the finish; guests count as they play). */
  grades?: Grade[];
}

/** Pay out a finished Hot Seat: XP, coins, badges, traits and best score. Returns the new state and the record. */
export function applyFinish(s: GameState, f: Finish, now = new Date()): { state: GameState; record: RunRecord } {
  const firstTime = s.best[f.run.hotSeatId] === undefined;
  const xp = finishXp(f.run.score, firstTime, s.boosterUntil > now.getTime());
  const record: RunRecord = { ...f.run, xp, at: now.getTime() };
  let x = s;
  for (const g of f.grades ?? []) x = applyDecision(x, g, now);
  const badges = new Set(x.badges);
  badges.add("first_seat");
  if (f.flags.recovered) badges.add("turnaround");
  if (f.run.score >= 95) badges.add("perfect");
  if (f.flags.beatHistory) badges.add("beat_history");
  if (f.run.endingTier === "fired") badges.add("fired");
  const t = { ...x.traits };
  (Object.keys(f.traits) as TraitKey[]).forEach((k) => (t[k] += f.traits[k]));
  const state: GameState = {
    ...x,
    xp: x.xp + xp,
    coins: x.coins + ECONOMY.completionCoins,
    league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
    runs: [record, ...x.runs].slice(0, 50),
    best: { ...x.best, [f.run.hotSeatId]: Math.max(x.best[f.run.hotSeatId] ?? 0, f.run.score) },
    quests: { ...x.quests, xp: x.quests.xp + xp },
    badges: [...badges],
    traits: t,
  };
  return { state, record };
}

/** Buy from the shop. Returns null when the player can't afford it. */
export function applyBuy(s: GameState, item: keyof typeof ECONOMY.prices): GameState | null {
  const price = ECONOMY.prices[item];
  if (!(item in ECONOMY.prices) || s.coins < price) return null;
  return {
    ...s,
    coins: s.coins - price,
    freezes: s.freezes + (item === "freeze" ? 1 : 0),
    boosters: s.boosters + (item === "booster" ? 1 : 0),
    hindsights: s.hindsights + (item === "hindsight" ? 1 : 0),
  };
}

/** Start a double-XP booster now (or extend a running one). Null when the player has none. */
export function applyBooster(s: GameState, now = Date.now()): GameState | null {
  if (s.boosters < 1) return null;
  return { ...s, boosters: s.boosters - 1, boosterUntil: Math.max(now, s.boosterUntil) + ECONOMY.boosterMinutes * 60_000 };
}

/** Spend one Hindsight. Null when the player has none. */
export const applyHindsight = (s: GameState): GameState | null => (s.hindsights < 1 ? null : { ...s, hindsights: s.hindsights - 1 });

/** Claim a finished quest's coins, once a day. Null when it isn't done or was already claimed. */
export function applyClaim(s: GameState, id: string): GameState | null {
  const q = questsFor(s).find((x) => x.id === id);
  if (!q || s.quests.claimed.includes(id) || q.read(s.quests) < q.goal) return null;
  return { ...s, coins: s.coins + q.reward, quests: { ...s.quests, claimed: [...s.quests.claimed, id] } };
}

/* ------------------------------------------------------------------ */
/* Lessons and flashcards. Pure too: guests run these on the phone,     */
/* signed-in players on the server (src/lib/server/game.ts).             */
/* ------------------------------------------------------------------ */

/** A finished lesson, as the server's replay (src/lib/lesson-play.ts) worked it out. */
export interface LessonFinish {
  lessonId: string;
  /** First-try accuracy, 0–100. */
  accuracy: number;
  /** The lesson's flashcards: finishing it adds them to the deck. */
  cardIds: string[];
  mistakes: Omit<LessonMistake, "day">[];
}

const L = ECONOMY.lesson;
const R = ECONOMY.review;

/** XP for a lesson: the full amount the first time, a little for a few replays a day, then nothing. */
export const lessonXp = (accuracy: number, firstTime: boolean, replaysToday: number, boosted: boolean) =>
  (firstTime
    ? L.xp + Math.round((Math.max(0, Math.min(100, accuracy)) / 100) * L.firstTryBonus)
    : replaysToday < L.replaysPaid
      ? L.replayXp
      : 0) * (boosted ? 2 : 1);

/** New cards join the deck due today. Cards already in it keep their schedule. */
const unlock = (cards: GameState["cards"], ids: string[], day: string) => {
  const out = { ...cards };
  for (const id of ids) out[id] ??= newCard(day);
  return out;
};

/** Pay out a finished lesson: XP, coins the first time, best accuracy, its cards, and its mistakes for the journal. */
export function applyLesson(s: GameState, f: LessonFinish, now = new Date()): { state: GameState; xp: number } {
  const day = today(now);
  const firstTime = s.lessons[f.lessonId] === undefined;
  const xp = lessonXp(f.accuracy, firstTime, s.quests.replays, s.boosterUntil > now.getTime());
  const x = touchStreak(s, now);
  const fixed = new Set(f.mistakes.map((m) => `${m.lessonId}/${m.screenId}`));
  const mistakes = [
    ...f.mistakes.map((m) => ({ ...m, day })),
    ...x.mistakes.filter((m) => !fixed.has(`${m.lessonId}/${m.screenId}`)),
  ].slice(0, 40);
  const state: GameState = {
    ...x,
    xp: x.xp + xp,
    coins: x.coins + (firstTime ? L.coins : 0),
    league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
    lessons: { ...x.lessons, [f.lessonId]: Math.max(x.lessons[f.lessonId] ?? 0, Math.round(f.accuracy)) },
    cards: unlock(x.cards, f.cardIds, day),
    mistakes,
    quests: { ...x.quests, lessons: x.quests.lessons + 1, replays: x.quests.replays + (firstTime ? 0 : 1), xp: x.quests.xp + xp },
  };
  return { state, xp };
}

/** The score a test-out quiz needs to pass a module's lessons. */
export const TEST_OUT_PASS = 80;

/**
 * A passed test-out: the module's lessons count as done (at the quiz's accuracy) and their cards join the deck.
 * It skips ahead, so it pays no XP. Lessons already done keep their best. A failed quiz changes nothing.
 */
export function applyTestOut(s: GameState, t: { lessonIds: string[]; accuracy: number; cardIds: string[] }, now = new Date()): GameState {
  if (t.accuracy < TEST_OUT_PASS) return s;
  const x = touchStreak(s, now);
  const lessons = { ...x.lessons };
  for (const id of t.lessonIds) lessons[id] ??= Math.round(t.accuracy);
  return { ...x, lessons, cards: unlock(x.cards, t.cardIds, today(now)) };
}

/**
 * Today's cards ("Daily 10"): the ones the player is most likely to have forgotten first, then new ones. Never the
 * whole backlog: at most `review.session`, within today's `perDay` and `newPerDay`. With `pool` (a Practice node),
 * only those cards, due or not.
 */
export function cardsToday(s: GameState, now = new Date(), pool?: string[]): string[] {
  const day = today(now);
  const size = Math.max(0, Math.min(R.session, R.perDay - s.quests.reviews));
  const ids = (pool ?? Object.keys(s.cards)).filter((id) => s.cards[id] && s.cards[id][5] !== day);
  const old = ids
    .filter((id) => s.cards[id][3] > 0 && (pool || s.cards[id][0] <= day))
    .map((id) => ({ id, r: recall(s.cards[id], day) }))
    .sort((a, b) => a.r - b.r)
    .map((c) => c.id);
  const fresh = ids.filter((id) => s.cards[id][3] === 0).slice(0, Math.max(0, R.newPerDay - s.quests.newCards));
  return [...old, ...fresh].slice(0, size);
}

/** One flashcard answer: the option tapped (its index) and how long it took. */
export interface CardReview {
  cardId: string;
  pick: number;
  ms: number;
}

/**
 * Grade a review session and reschedule its cards. `answers` is each card's right option, from the content. Cards
 * the player hasn't unlocked, cards already reviewed today and anything past today's limits are skipped, so a retry
 * pays nothing twice. Pays 1 XP a card up to the daily cap; 3 or more cards keep the streak.
 */
export function applyReview(
  s: GameState,
  reviews: CardReview[],
  answers: Record<string, number>,
  now = new Date(),
): { state: GameState; xp: number; counted: number } {
  const day = today(now);
  const cards = { ...s.cards };
  let left = R.perDay - s.quests.reviews;
  let newLeft = R.newPerDay - s.quests.newCards;
  let n = 0;
  let nNew = 0;
  for (const r of reviews.slice(0, 50)) {
    const c = cards[r.cardId];
    if (!c || c[5] === day || answers[r.cardId] === undefined || left <= 0) continue;
    const isNew = c[3] === 0;
    if (isNew && newLeft <= 0) continue;
    cards[r.cardId] = review(c, ratingOf(r.pick === answers[r.cardId], r.ms), day);
    left--;
    n++;
    if (isNew) {
      newLeft--;
      nNew++;
    }
  }
  if (!n) return { state: s, xp: 0, counted: 0 };
  const paidToday = Math.min(R.xpCap, s.quests.reviews * R.xp);
  const xp = Math.min(n * R.xp, R.xpCap - paidToday) * (s.boosterUntil > now.getTime() ? 2 : 1);
  const x = n >= R.streakMin ? touchStreak(s, now) : s;
  const state: GameState = {
    ...x,
    xp: x.xp + xp,
    league: { ...x.league, weeklyXp: x.league.weeklyXp + xp },
    cards,
    quests: { ...x.quests, reviews: x.quests.reviews + n, newCards: x.quests.newCards + nNew, xp: x.quests.xp + xp },
  };
  return { state, xp, counted: n };
}
