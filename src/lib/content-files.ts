// Reads Hot Seat folders from disk, for the server (src/lib/server/content.ts), Node scripts and the hotseat CLI.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DailyPool, HotSeat } from "./hotseat-types";

// From the project root (npm scripts, Vitest and Next all run there), so it also works inside the Next server build.
export const HOTSEATS_DIR = join(process.cwd(), "content/hotseats");

/** Ids of every folder in content/hotseats that has a hotseat.json, sorted. */
export const hotSeatIds = () =>
  readdirSync(HOTSEATS_DIR)
    .filter((id) => existsSync(join(HOTSEATS_DIR, id, "hotseat.json")))
    .sort();

/** Parsed but unvalidated; run checkHotSeat before trusting it. */
export const readHotSeat = (id: string): HotSeat => JSON.parse(readFileSync(join(HOTSEATS_DIR, id, "hotseat.json"), "utf8"));

export const DAILY_DIR = join(process.cwd(), "content/daily");

/** content/daily/daily.json, or an empty pool before the first Daily Call exists. Unvalidated; see checkDailyPool. */
export const readDailyPool = (): DailyPool =>
  existsSync(join(DAILY_DIR, "daily.json"))
    ? JSON.parse(readFileSync(join(DAILY_DIR, "daily.json"), "utf8"))
    : { startDay: "2026-01-01", calls: [] };
