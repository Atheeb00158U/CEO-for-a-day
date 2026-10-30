import { describe, expect, it } from "vitest";
import { readDailyPool, readHotSeat } from "../content-files";
import { ECONOMY, finishXp } from "../game-state";
import type { HotSeat } from "../hotseat-types";
import { play, PlayError, type Pick } from "../play";
import { memoryDb, type LeagueRow } from "./db";
import {
  buy,
  claimQuest,
  finishRun,
  GameError,
  IMPORT_CAPS,
  importGuest,
  leagueTier,
  load,
  lockDaily,
  nextTier,
  startBooster,
  update,
} from "./game";

const kodak = readHotSeat("kodak");
const now = new Date("2026-10-28T06:30:00Z"); // Wednesday, noon IST
const U = "user-1";

function path(hs: HotSeat, choose = 0): Pick[] {
  const picks: Pick[] = [];
  for (let v = play(hs, picks); !v.result; v = play(hs, picks)) {
    const d = v.screens.at(-1)!;
    if (d.kind !== "decision") throw new Error("expected a decision");
    picks.push({ nodeId: d.id, optionId: d.options[Math.min(choose, d.options.length - 1)].id });
  }
  return picks;
}

describe("finishing a run on the server", () => {
  it("pays what the engine scores, once per run key", async () => {
    const db = memoryDb();
    const picks = path(kodak);
    const score = play(kodak, picks).result!.score;
    const a = await finishRun(db, U, kodak, { runKey: "run-aaaaaaaa", picks, hindsightUsed: false }, now);
    expect(a.record.score).toBe(score);
    expect(a.state.xp).toBe(finishXp(score, true, false));
    expect(a.state.coins).toBe(ECONOMY.starter.coins + ECONOMY.completionCoins);
    const again = await finishRun(db, U, kodak, { runKey: "run-aaaaaaaa", picks, hindsightUsed: false }, now);
    expect(again.state.xp).toBe(a.state.xp);
    expect(db.runs).toHaveLength(1);
    expect(db.leagues[0]).toMatchObject({ userId: U, weeklyXp: a.record.xp, tier: 0 });
  });

  it("counts each pick toward quests and the streak", async () => {
    const db = memoryDb();
    const picks = path(kodak);
    const { state } = await finishRun(db, U, kodak, { runKey: "run-bbbbbbbb", picks, hindsightUsed: false }, now);
    expect(state.quests.decisions).toBe(picks.length);
    expect(state.streak).toBe(1);
    expect(state.lastActiveDay).toBe("2026-10-28");
  });

  it("pays only the flat XP for a replay", async () => {
    const db = memoryDb();
    await finishRun(db, U, kodak, { runKey: "run-cccccccc", picks: path(kodak), hindsightUsed: false }, now);
    const before = (await load(db, U, now)).state.xp;
    const r = await finishRun(db, U, kodak, { runKey: "run-dddddddd", picks: path(kodak, 1), hindsightUsed: false }, now);
    expect(r.record.xp).toBe(ECONOMY.completionXp);
    expect(r.state.xp).toBe(before + ECONOMY.completionXp);
  });

  it("refuses a forged path, an unfinished run, a bad key and Hindsight the player hasn't got", async () => {
    const db = memoryDb();
    await expect(
      finishRun(db, U, kodak, { runKey: "run-eeeeeeee", picks: [{ nodeId: "x", optionId: "y" }], hindsightUsed: false }, now),
    ).rejects.toThrow(PlayError);
    await expect(
      finishRun(db, U, kodak, { runKey: "run-eeeeeeee", picks: path(kodak).slice(0, 1), hindsightUsed: false }, now),
    ).rejects.toThrow(PlayError);
    await expect(finishRun(db, U, kodak, { runKey: "x", picks: path(kodak), hindsightUsed: false }, now)).rejects.toThrow(GameError);
    await update(db, U, (s) => ({ ...s, hindsights: 0 }), now);
    await expect(finishRun(db, U, kodak, { runKey: "run-ffffffff", picks: path(kodak), hindsightUsed: true }, now)).rejects.toThrow(
      GameError,
    );
    expect(db.runs).toHaveLength(0);
  });

  it("charges Hindsight used in the run", async () => {
    const db = memoryDb();
    const { state } = await finishRun(db, U, kodak, { runKey: "run-gggggggg", picks: path(kodak), hindsightUsed: true }, now);
    expect(state.hindsights).toBe(ECONOMY.starter.hindsights - 1);
  });
});

describe("spending on the server", () => {
  it("refuses what the player can't afford, and a booster starts at server time", async () => {
    const db = memoryDb();
    await expect(buy(db, U, "freeze", now)).rejects.toThrow(GameError); // 120 coins, freeze costs 200
    await expect(buy(db, U, "gold", now)).rejects.toThrow(GameError);
    const b = await startBooster(db, U, now);
    expect(b.state.boosterUntil).toBe(now.getTime() + ECONOMY.boosterMinutes * 60_000);
    await expect(startBooster(db, U, now)).rejects.toThrow(GameError);
    await expect(claimQuest(db, U, "decisions", now)).rejects.toThrow(GameError);
  });

  it("retries when another write lands first", async () => {
    const db = memoryDb();
    await load(db, U, now);
    const real = db.saveProfile.bind(db);
    let clash = true;
    db.saveProfile = async (id, v, s, o) => {
      if (clash) {
        clash = false;
        await real(id, v, { ...(await db.getProfile(id))!.state, name: "Other" }); // someone else wrote meanwhile
        return false;
      }
      return real(id, v, s, o);
    };
    const r = await update(db, U, (s) => ({ ...s, coins: s.coins + 1 }), now);
    expect(r.state.name).toBe("Other");
    expect(r.state.coins).toBe(ECONOMY.starter.coins + 1);
  });
});

describe("the Daily Call on the server", () => {
  const call = readDailyPool().calls[0];
  it("pays once a day", async () => {
    const db = memoryDb();
    const a = await lockDaily(db, U, call, call.options[0], now);
    const b = await lockDaily(db, U, call, call.options[1], now);
    expect(b.state.daily?.optionId).toBe(call.options[0].id);
    expect(b.state.xp).toBe(a.state.xp);
    expect(b.state.dailyLog).toHaveLength(1);
  });
});

describe("bringing in a guest save", () => {
  it("caps every number, happens once, and never counts toward the league", async () => {
    const db = memoryDb();
    const save = {
      xp: 999999,
      coins: 999999,
      streak: 400,
      freezes: 99,
      best: { kodak: 100, "../x": 5 },
      badges: ["first_seat"],
      name: "Ravi",
    };
    const a = await importGuest(db, U, save, now);
    expect(a.state.xp).toBe(IMPORT_CAPS.xp);
    expect(a.state.coins).toBe(IMPORT_CAPS.coins);
    expect(a.state.streak).toBe(IMPORT_CAPS.streak);
    expect(a.state.freezes).toBe(IMPORT_CAPS.items);
    expect(a.state.best).toEqual({ kodak: 100 });
    expect(a.state.league.weeklyXp).toBe(0);
    const b = await importGuest(db, U, save, now);
    expect(b.state.xp).toBe(IMPORT_CAPS.xp);
  });

  it("is skipped for an account that has already played", async () => {
    const db = memoryDb();
    await finishRun(db, U, kodak, { runKey: "run-hhhhhhhh", picks: path(kodak), hindsightUsed: false }, now);
    const before = (await load(db, U, now)).state.xp;
    const r = await importGuest(db, U, { xp: 1500 }, now);
    expect(r.state.xp).toBe(before);
  });
});

describe("leagues", () => {
  const row = (userId: string, weeklyXp: number, tier = 1): LeagueRow => ({ weekId: "2026-10-19", userId, tier, cohort: 1, weeklyXp });

  it("moves the top 5 up and the bottom 5 down in a full cohort", () => {
    const rows = Array.from({ length: 20 }, (_, i) => row(`u${i}`, 1000 - i * 10));
    expect(nextTier(rows, "u0")).toBe(2);
    expect(nextTier(rows, "u4")).toBe(2);
    expect(nextTier(rows, "u5")).toBe(1);
    expect(nextTier(rows, "u15")).toBe(0);
  });

  it("in a small cohort, needs real XP to go up, and only no XP sends you down", () => {
    expect(nextTier([row("solo", 150)], "solo")).toBe(1); // tier 1 needs 200
    expect(nextTier([row("solo", 250)], "solo")).toBe(2);
    expect(nextTier([row("a", 300), row("b", 0)], "b")).toBe(0);
    expect(nextTier([row("a", 300), row("b", 10)], "b")).toBe(1);
  });

  it("settles last week on read, the same way every time, and drops a tier after a missed week", async () => {
    const db = memoryDb();
    db.leagues.push(row("solo", 250));
    const nextWeek = new Date("2026-10-28T06:30:00Z"); // week of 2026-10-26
    expect((await leagueTier(db, "solo", nextWeek)).tier).toBe(2);
    expect((await leagueTier(db, "solo", nextWeek)).tier).toBe(2);
    const twoLater = new Date("2026-11-04T06:30:00Z"); // skipped the week of 2026-10-26
    expect((await leagueTier(db, "solo", twoLater)).tier).toBe(0);
  });

  it("places a player in a cohort of their tier and fills it before opening another", async () => {
    const db = memoryDb();
    for (let i = 0; i < 31; i++) await db.addLeagueXp("2026-10-26", `p${i}`, 0, 10);
    const cohorts = db.leagues.map((l) => l.cohort);
    expect(cohorts.filter((c) => c === 1)).toHaveLength(30);
    expect(cohorts.filter((c) => c === 2)).toHaveLength(1);
  });
});
