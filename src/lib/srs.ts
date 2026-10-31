// Flashcard scheduling with FSRS (ts-fsrs), by the day: a card is due on an IST date, not at a minute.
// The state keeps one small tuple per card, because the whole save is rewritten on every action.
// Node runs this file directly (through game-state.ts), so it keeps relative .ts imports.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard } from "ts-fsrs";

/** [due day, stability, difficulty, reviews, lapses, last review day or ""]. Reviews 0 = a new card. */
export type CardState = [due: string, stability: number, difficulty: number, reps: number, lapses: number, last: string];

// Short-term steps are off, so every interval is whole days. No fuzz, so the phone and the server agree exactly.
const scheduler = fsrs(
  generatorParameters({ request_retention: 0.9, enable_short_term: false, enable_fuzz: false, maximum_interval: 365 }),
);

/** Midday in India on `day`: the clock every review runs on, so intervals land on whole IST days. */
const noon = (day: string) => new Date(day + "T12:00:00+05:30");
const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
const round = (x: number) => Math.round(x * 1e4) / 1e4;

export const newCard = (day: string): CardState => [day, 0, 0, 0, 0, ""];

function toFsrs([due, stability, difficulty, reps, lapses, last]: CardState): FsrsCard {
  const card = createEmptyCard(noon(due));
  if (!reps) return card;
  return {
    ...card,
    stability,
    difficulty,
    reps,
    lapses,
    state: State.Review,
    last_review: last ? noon(last) : undefined,
    scheduled_days: last ? Math.round((noon(due).getTime() - noon(last).getTime()) / 864e5) : 0,
  };
}

/** Right or wrong, and how long it took, as an FSRS rating: wrong = Again, slow = Hard, quick = Easy, else Good. */
export function ratingOf(right: boolean, ms: number): Rating {
  if (!right) return Rating.Again;
  if (ms > 12_000) return Rating.Hard;
  if (ms > 0 && ms <= 3_000) return Rating.Easy;
  return Rating.Good;
}

/** The card after one review on `day`. */
export function review(card: CardState, rating: Rating, day: string): CardState {
  const next = scheduler.next(toFsrs(card), noon(day), rating as Exclude<Rating, Rating.Manual>).card;
  return [istDay(next.due), round(next.stability), round(next.difficulty), next.reps, next.lapses, day];
}

/** How likely the player still remembers it on `day` (0–1). New cards count as 0. */
export const recall = (card: CardState, day: string) => (card[3] ? scheduler.get_retrievability(toFsrs(card), noon(day), false) : 0);
