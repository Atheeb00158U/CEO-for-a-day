import { describe, expect, it } from "vitest";
import { fresh, rollover, touchStreak, weekId, type GameState } from "./game-state";
import { DEMOTE, leagueRows, PROMOTE } from "./league";

const now = new Date(2026, 9, 27, 12); // Tue 27 Oct 2026, local time
const base = (patch: Partial<GameState>): GameState => ({
  ...fresh(),
  quests: { day: "2026-10-27", decisions: 0, great: 0, xp: 0, claimed: [] },
  league: { tier: 2, weekId: weekId(now), weeklyXp: 0 },
  ...patch,
});

describe("streaks", () => {
  it("grows by one on the next day and awards the 3-day badge", () => {
    const s = touchStreak(base({ streak: 2, lastActiveDay: "2026-10-26" }), now);
    expect(s).toMatchObject({ streak: 3, lastActiveDay: "2026-10-27" });
    expect(s.badges).toContain("streak_3");
  });

  it("does nothing on a second play the same day", () => {
    const s = base({ streak: 4, lastActiveDay: "2026-10-27" });
    expect(touchStreak(s, now)).toBe(s);
  });

  it("uses freezes to cover missed days", () => {
    const s = rollover(base({ streak: 5, lastActiveDay: "2026-10-25", freezes: 1 }), now);
    expect(s).toMatchObject({ streak: 5, freezes: 0, lastActiveDay: "2026-10-26" });
    expect(touchStreak(s, now).streak).toBe(6);
  });

  it("resets the streak when there aren't enough freezes", () => {
    const s = rollover(base({ streak: 5, lastActiveDay: "2026-10-23", freezes: 1 }), now);
    expect(s.streak).toBe(0);
    expect(s.freezes).toBe(1);
  });
});

describe("daily quests", () => {
  it("reset on a new day", () => {
    const s = rollover(base({ quests: { day: "2026-10-26", decisions: 3, great: 2, xp: 60, claimed: ["xp"] } }), now);
    expect(s.quests).toEqual({ day: "2026-10-27", decisions: 0, great: 0, xp: 0, claimed: [] });
  });
});

describe("league week rollover", () => {
  const lastWeek = "2026-10-19";
  const settle = (weeklyXp: number) => {
    const s = base({ league: { tier: 2, weekId: lastWeek, weeklyXp } });
    const rows = leagueRows({ seed: s.seed, weekId: lastWeek, tier: 2, yourXp: weeklyXp, yourName: s.name, now });
    return { after: rollover(s, now).league, rank: rows.findIndex((r) => r.you), size: rows.length };
  };

  it("promotes a top player and resets weekly XP", () => {
    const { after, rank } = settle(1_000_000);
    expect(rank).toBeLessThan(PROMOTE);
    expect(after).toEqual({ tier: 3, weekId: "2026-10-26", weeklyXp: 0 });
  });

  it("demotes a bottom player", () => {
    const { after, rank, size } = settle(0);
    expect(rank).toBeGreaterThanOrEqual(size - DEMOTE);
    expect(after.tier).toBe(1);
  });

  it("leaves the league alone mid-week", () => {
    const s = base({ league: { tier: 2, weekId: weekId(now), weeklyXp: 120 } });
    expect(rollover(s, now).league).toEqual(s.league);
  });
});
