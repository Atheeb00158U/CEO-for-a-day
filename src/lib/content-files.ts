// Reads Hot Seat folders from disk, for Node scripts and the hotseat CLI (the app uses import.meta.glob in catalog.ts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HotSeat } from "./hotseat-types";

// From the project root (npm scripts, Vitest and Next all run there), so it also works inside the Next server build.
export const HOTSEATS_DIR = join(process.cwd(), "content/hotseats");

/** Ids of every folder in content/hotseats that has a hotseat.json, sorted. */
export const hotSeatIds = () =>
  readdirSync(HOTSEATS_DIR)
    .filter((id) => existsSync(join(HOTSEATS_DIR, id, "hotseat.json")))
    .sort();

/** Parsed but unvalidated; run checkHotSeat before trusting it. */
export const readHotSeat = (id: string): HotSeat => JSON.parse(readFileSync(join(HOTSEATS_DIR, id, "hotseat.json"), "utf8"));
