import { dailyFor, playerOrder } from "@/lib/engine";
import type { Focus } from "@/lib/game-state";
import type { CatalogEntry, DailyCall, DailyPool, HotSeat } from "@/lib/hotseat-types";

/** Every content/hotseats/<id>/hotseat.json, found at build time. Validated by `npm run hotseat:check` and the tests, not here. */
const found = import.meta.glob<HotSeat>("/content/hotseats/*/hotseat.json", { eager: true, import: "default" });

// shortcut: every Hot Seat ships in the main bundle; switch to lazy glob imports when the Phase 5 performance budget needs it.
/** Playable Hot Seats. Drafts show on the map as "coming soon" (in dev too, so testing matches what players see); /admin shows them in full. */
export const HOT_SEATS: Record<string, HotSeat> = Object.fromEntries(
  Object.values(found)
    .filter((hs) => !hs.draft)
    .map((hs) => [hs.id, hs]),
);

const entry = (hs: HotSeat, available: boolean): CatalogEntry => ({
  id: hs.id,
  company: hs.company,
  title: hs.title,
  hook: hs.hook,
  cover: available ? hs.cover : undefined,
  emblem: hs.emblem,
  complexity: hs.complexity,
  available,
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

/** Everything shown on the map. */
export const CATALOG: CatalogEntry[] = [
  ...Object.values(HOT_SEATS).map((hs) => entry(hs, true)),
  ...Object.values(found)
    .filter((hs) => hs.draft)
    .map((hs) => entry(hs, false)),
  ...COMING_SOON.filter((c) => !found[`/content/hotseats/${c.id}/hotseat.json`]),
];

/**
 * The Hot Seat a new player tries on the welcome screens (its first two calls), and the first one on Home after.
 * Production uses it only once it's published; `npm run dev` also allows the draft, to test the welcome screens early.
 */
const TRIAL_ID = "kingfisher-airlines";
const trialDraft = found[`/content/hotseats/${TRIAL_ID}/hotseat.json`];
export const TRIAL: HotSeat | undefined = HOT_SEATS[TRIAL_ID] ?? (process.env.NODE_ENV !== "production" ? trialDraft : undefined);

/** Hot Seats that fit what the player said they want to get better at. Ids that don't exist yet are skipped. */
const FOCUS: Record<Focus, string[]> = {
  scratch: ["amul-one-brand", "indigo-one-plane-type", "maruti-800"],
  rival: ["new-coke", "nokia", "apple-1997-comeback", "tanishq-karatmeter"],
  money: ["kingfisher-airlines", "harshad-mehta", "lego-turnaround"],
  change: ["kodak", "blockbuster", "netflix", "intel-quits-memory"],
};

/** Home's order: the trial first, then Hot Seats for the player's focus, then their seeded order. */
export function homeOrder(items: CatalogEntry[], seed: string, focus?: Focus): CatalogEntry[] {
  const first = [TRIAL_ID, ...(focus ? FOCUS[focus] : [])];
  const rank = (c: CatalogEntry) => (first.includes(c.id) ? first.indexOf(c.id) : first.length);
  return playerOrder(items, seed)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
}

const dailyFile = import.meta.glob<DailyPool>("/content/daily/daily.json", { eager: true, import: "default" });
/** The Daily Call pool, in schedule order (empty until content/daily/daily.json exists). */
export const DAILY: DailyPool = Object.values(dailyFile)[0] ?? { startDay: "2026-01-01", calls: [] };

/** Today's Daily Call. Undefined when there is none, or in production when today's call is still a draft (never a stand-in). */
export function todaysCall(day: string): DailyCall | undefined {
  const call = dailyFor(day, DAILY);
  return call && (!call.draft || process.env.NODE_ENV !== "production") ? call : undefined;
}
