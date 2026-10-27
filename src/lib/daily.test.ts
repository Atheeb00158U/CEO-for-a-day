import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { dailyFor } from "./engine";
import { dailyXp } from "./game-state";
import { checkDailyPool } from "./hotseat-check";
import type { DailyCall, DailyPool } from "./hotseat-types";

const call = (id: string, patch: Partial<DailyCall> = {}): DailyCall => ({
  id,
  company: "Acme",
  year: "2001",
  title: "A test call",
  setup: "Something happens.",
  question: "What do you do?",
  options: [
    { id: "a", label: "Bold", grade: "great", outcome: "It works.", why: "Because.", takeaway: "Be bold." },
    { id: "b", label: "Safe", grade: "ok", real: true, outcome: "It is fine.", why: "Meh.", better: "Be bold.", takeaway: "Safe is slow." },
    { id: "c", label: "Bad", grade: "bad", outcome: "It fails.", why: "Ouch.", better: "Be bold.", takeaway: "Don't." },
  ],
  realHistory: "They played it safe.",
  sources: [{ label: "A source", url: "https://example.com" }],
  draft: true,
  ...patch,
});
const pool = (n: number): DailyPool => ({ startDay: "2026-11-01", calls: Array.from({ length: n }, (_, i) => call(`c${i}`)) });

describe("dailyFor", () => {
  it("plays the list in order from the start day", () => {
    expect(dailyFor("2026-11-01", pool(5))?.id).toBe("c0");
    expect(dailyFor("2026-11-04", pool(5))?.id).toBe("c3");
  });

  it("gives the same call for the same day", () => {
    expect(dailyFor("2026-11-03", pool(5))?.id).toBe(dailyFor("2026-11-03", pool(5))?.id);
  });

  it("never changes a day inside the list when calls are appended", () => {
    for (let d = 1; d <= 5; d++) {
      const day = `2026-11-0${d}`;
      expect(dailyFor(day, pool(9))?.id).toBe(dailyFor(day, pool(5))?.id);
    }
  });

  it("cycles past the end and has nothing for an empty pool", () => {
    expect(dailyFor("2026-11-06", pool(5))?.id).toBe("c0");
    expect(dailyFor("2026-11-01", pool(0))).toBeUndefined();
  });
});

describe("dailyXp", () => {
  it("pays by grade and doubles with a booster", () => {
    expect([dailyXp("great", false), dailyXp("ok", false), dailyXp("bad", false)]).toEqual([15, 10, 5]);
    expect(dailyXp("great", true)).toBe(30);
  });
});

describe("checkDailyPool", () => {
  const tmp = mkdtempSync(join(tmpdir(), "daily-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  const check = (name: string, p: DailyPool, today = "2026-11-01") => {
    const dir = join(tmp, name);
    mkdirSync(dir);
    writeFileSync(join(dir, "daily.json"), JSON.stringify(p));
    return checkDailyPool(dir, today);
  };

  it("accepts a valid pool of drafts and counts the days left", () => {
    const r = check("ok", pool(20));
    expect(r.errors).toEqual([]);
    expect(r.daysLeft).toBe(19);
  });

  it("warns when fewer than 14 days are left, or the list has run out", () => {
    expect(check("short", pool(5)).warnings.join("\n")).toMatch(/only 4 days of Daily Calls left/);
    expect(check("out", pool(5), "2026-11-09").warnings.join("\n")).toMatch(/ran out 4 days ago/);
  });

  it("rejects broken calls", () => {
    const twoReal = call("x", { options: call("x").options.map((o) => ({ ...o, real: true })) });
    const noBetter = call("y", { options: call("y").options.map((o) => ({ ...o, better: undefined })) });
    const errors = check("broken", { startDay: "2026-11-01", calls: [twoReal, noBetter, call("y")] }).errors.join("\n");
    expect(errors).toMatch(/daily x .*exactly one option marked real \(has 3\)/);
    expect(errors).toMatch(/daily y\/b: ok\/bad options need "better"/);
    expect(errors).toMatch(/daily y: the id is used twice/);
  });

  it("needs media for published calls, only warns about audio, and only warns for drafts", () => {
    const published = check("published", { startDay: "2026-11-01", calls: [call("p", { draft: false, media: "img:nothing" })] });
    expect(published.errors.join("\n")).toMatch(/daily p: media\/nothing\.webp is missing/);
    expect(published.warnings.join("\n")).toMatch(/daily p: no audio/);
    expect(check("draft", { startDay: "2026-11-01", calls: [call("d", { media: "img:nothing" })] }).errors).toEqual([]);
  });

  it("needs exactly three options", () => {
    const two = call("t", { options: call("t").options.slice(0, 2) });
    expect(check("two", { startDay: "2026-11-01", calls: [two] }).errors.join("\n")).toMatch(/options/);
  });
});
