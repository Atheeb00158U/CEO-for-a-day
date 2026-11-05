import { describe, expect, it } from "vitest";
import { achievements, cheerFor, earnedKeys, FAMILIES, progressOf } from "./achievements";
import { fresh } from "./game-state";

const fam = (id: string) => FAMILIES.find((f) => f.id === id)!;

describe("achievements", () => {
  it("starts every family at level 0", () => {
    expect(achievements(fresh()).every((p) => p.level === 0)).toBe(true);
    expect(earnedKeys(fresh())).toEqual([]);
  });

  it("levels up at each threshold and stops at the top", () => {
    const s = { ...fresh(), xp: 1000 };
    expect(progressOf(fam("xp"), s)).toMatchObject({ level: 2, next: 3000 });
    expect(progressOf(fam("xp"), { ...s, xp: 99999 })).toMatchObject({ level: 4, next: null });
  });

  it("counts the current streak when the best streak lags behind it", () => {
    expect(progressOf(fam("streak"), { ...fresh(), streak: 7, bestStreak: 0 }).level).toBe(2);
  });

  it("lists every level reached, plus special badges, and cheers each", () => {
    const s = { ...fresh(), xp: 1000, badges: ["fired", "first_seat"] };
    expect(earnedKeys(s)).toEqual(["xp:1", "xp:2", "fired"]);
    expect(cheerFor("xp:2")).toMatchObject({ id: "xp", level: 2, line: "You earned 1,000 XP." });
    expect(cheerFor("fired")).toMatchObject({ id: "fired", name: "Clean desk" });
  });
});
