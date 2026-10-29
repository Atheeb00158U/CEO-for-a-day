import { dailyFor } from "@/lib/engine";
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

const dailyFile = import.meta.glob<DailyPool>("/content/daily/daily.json", { eager: true, import: "default" });
/** The Daily Call pool, in schedule order (empty until content/daily/daily.json exists). */
export const DAILY: DailyPool = Object.values(dailyFile)[0] ?? { startDay: "2026-01-01", calls: [] };

/** Today's Daily Call. Undefined when there is none, or in production when today's call is still a draft (never a stand-in). */
export function todaysCall(day: string): DailyCall | undefined {
  const call = dailyFor(day, DAILY);
  return call && (!call.draft || process.env.NODE_ENV !== "production") ? call : undefined;
}
