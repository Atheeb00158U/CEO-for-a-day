// Hot Seats and Daily Calls, read from content/ on the server. Nothing here may be imported by client code:
// these objects hold every answer. The phone gets only what src/lib/play.ts and the API routes hand out.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { callsPerRun, dailyFor, reviewedDebrief, type Debriefs } from "../engine.ts";
import { HOTSEATS_DIR, hotSeatIds, readDailyPool, readHotSeat } from "../content-files.ts";
import type { CatalogEntry, DailyAnswer, DailyCall, DailyPool, DailyQuestion, HotSeat } from "../hotseat-types";
import type { Pick } from "../play.ts";
import { TRIAL_ID } from "../../content/catalog";

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

/** The trial's card, when the trial can be played here (production needs it published). */
export function trial(nodeEnv = process.env.NODE_ENV): CatalogEntry | undefined {
  const hs = servableHotSeat(TRIAL_ID, nodeEnv);
  return hs && entry(hs, true);
}

const dailyPool = () => cached<DailyPool>("daily", readDailyPool);

/** Today's Daily Call. Undefined when there is none, or outside dev when today's call is still a draft (never a stand-in). */
export function todaysCall(day: string, nodeEnv = process.env.NODE_ENV): DailyCall | undefined {
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
