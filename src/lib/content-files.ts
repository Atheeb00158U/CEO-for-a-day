// Reads Hot Seat folders and the course from disk, for the server (src/lib/server/content.ts), Node scripts and the hotseat CLI.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Course, Lesson } from "./course-types";
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

export const COURSE_DIR = join(process.cwd(), "content/course");

/** content/course/course.json, or an empty course before it exists. Unvalidated; see checkCourse. */
export const readCourse = (): Course =>
  existsSync(join(COURSE_DIR, "course.json")) ? JSON.parse(readFileSync(join(COURSE_DIR, "course.json"), "utf8")) : { units: [] };

/** Ids of every content/course/lessons/<id>.json, sorted. */
export const lessonFileIds = () =>
  existsSync(join(COURSE_DIR, "lessons"))
    ? readdirSync(join(COURSE_DIR, "lessons"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
        .sort()
    : [];

/** Parsed but unvalidated. */
export const readLesson = (id: string): Lesson => JSON.parse(readFileSync(join(COURSE_DIR, "lessons", `${id}.json`), "utf8"));
