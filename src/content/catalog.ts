import type { CatalogEntry, HotSeat } from "@/lib/hotseat-types";

/** Every content/hotseats/<id>/hotseat.json, found at build time. Validated by `npm run hotseat:check` and the tests, not here. */
const found = import.meta.glob<HotSeat>("/content/hotseats/*/hotseat.json", { eager: true, import: "default" });

// shortcut: every Hot Seat ships in the main bundle; switch to lazy glob imports when the Phase 5 performance budget needs it.
/** Playable Hot Seats. Drafts only show in `npm run dev`. */
export const HOT_SEATS: Record<string, HotSeat> = Object.fromEntries(
  Object.values(found)
    .filter((hs) => !hs.draft || process.env.NODE_ENV !== "production")
    .map((hs) => [hs.id, hs]),
);

/** Shown on the map as "coming soon" until a Hot Seat with the same id exists. */
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
  ...Object.values(HOT_SEATS).map((hs) => ({
    id: hs.id,
    company: hs.company,
    title: hs.title,
    hook: hs.hook,
    cover: hs.cover,
    complexity: hs.complexity,
    available: true,
  })),
  ...COMING_SOON.filter((c) => !HOT_SEATS[c.id]),
];
