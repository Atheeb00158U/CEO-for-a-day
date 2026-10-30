import { describe, expect, it } from "vitest";
import { readDailyPool } from "../content-files";
import { fresh } from "../game-state";
import { memoryDb, type LeagueRow } from "./db";
import { broadcast, istHour, leagueEnding, morningCall, notifyOvertaken, reminderFor, sendReminders, type Send } from "./reminders";

const at = (iso: string) => new Date(iso);
const evening = at("2026-10-30T13:30:00Z"); // Friday 19:00 IST
const call = readDailyPool().calls[0];

function recorder() {
  const sent: { user: string; title: string }[] = [];
  const send: Send = async (row, msg) => (sent.push({ user: row.userId, title: msg.title }), row.userId === "gone" ? "gone" : "sent");
  return { sent, send };
}

async function player(db: ReturnType<typeof memoryDb>, id: string, last: string | null, hour: number, streak = 3) {
  await db.createProfile(id, { ...fresh(), name: id, streak, lastActiveDay: last });
  await db.savePush({ endpoint: `https://push.example/${id}`, userId: id, keys: { p256dh: "k", auth: "a" }, remindHour: hour });
}

describe("what to say", () => {
  it("works out the hour in India", () => {
    expect(istHour(evening)).toBe(19);
    expect(istHour(at("2026-10-30T18:30:00Z"))).toBe(0);
  });

  it("warns about a streak, then tries to win a player back on days 2, 4 and 7 only", () => {
    const say = (last: string) => reminderFor({ streak: 6, lastActiveDay: last }, evening)?.kind ?? null;
    expect(say("2026-10-30")).toBeNull(); // played today
    expect(say("2026-10-29")).toBe("streak");
    expect(say("2026-10-28")).toBe("winback2");
    expect(say("2026-10-27")).toBeNull();
    expect(say("2026-10-26")).toBe("winback4");
    expect(say("2026-10-23")).toBe("winback7");
    expect(say("2026-10-20")).toBeNull(); // away for over a week: left alone
    expect(reminderFor({ streak: 6, lastActiveDay: "2026-10-29" }, evening)?.title).toBe("Your 6-day streak ends tonight");
  });

  it("teases today's Daily Call to players from this week who haven't played today", () => {
    expect(morningCall({ lastActiveDay: "2026-10-29" }, call, evening)?.title).toBe(`Today's call: ${call.company}, ${call.year}`);
    expect(morningCall({ lastActiveDay: "2026-10-30" }, call, evening)).toBeNull();
    expect(morningCall({ lastActiveDay: "2026-10-10" }, call, evening)).toBeNull();
    expect(morningCall({ lastActiveDay: "2026-10-29" }, undefined, evening)).toBeNull();
  });

  it("says how far a player is from moving up when the league ends", () => {
    const row = (userId: string, weeklyXp: number): LeagueRow => ({ weekId: "2026-10-26", userId, tier: 0, cohort: 1, weeklyXp });
    const rows = [row("a", 150), row("b", 60), row("c", 20)];
    expect(leagueEnding(rows, "a")?.body).toMatch(/#1, in the zone/);
    expect(leagueEnding(rows, "b")?.body).toBe("You're #2. 91 more XP moves you up.");
  });
});

describe("sending each hour", () => {
  it("sends the streak warning at each player's own hour and removes dead phones", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-10-29", 19);
    await player(db, "b", "2026-10-30", 19); // played today
    await player(db, "c", "2026-10-29", 8); // other hour
    await player(db, "gone", "2026-10-29", 19);
    const { sent, send } = recorder();
    const tally = await sendReminders(db, call, send, evening);
    expect(sent.map((s) => s.user)).toEqual(["a", "gone"]);
    expect(tally).toMatchObject({ sent: 1, gone: 1 });
    expect((await db.pushes()).map((p) => p.userId)).toEqual(["a", "b", "c"]);
  });

  it("sends nothing in quiet hours, at most two a day, and each kind once", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-10-29", 9);
    const { sent, send } = recorder();
    await sendReminders(db, call, send, at("2026-10-30T17:30:00Z")); // 23:00 IST
    expect(sent).toHaveLength(0);
    const nine = at("2026-10-30T03:30:00Z"); // 09:00 IST: streak warning and the morning call
    await sendReminders(db, call, send, nine);
    await sendReminders(db, call, send, nine); // the same hour again: nothing new
    expect(sent.map((s) => s.title)).toEqual(["Your 3-day streak ends tonight", `Today's call: ${call.company}, ${call.year}`]);
    await notifyOvertaken(db, "x", 0, send, at("2026-10-30T06:30:00Z")); // over the cap already, and x isn't in a league
    expect(sent).toHaveLength(2);
  });

  it("tells a player they moved up, on Monday morning", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-11-01", 19);
    db.leagues.push({ weekId: "2026-10-26", userId: "a", tier: 0, cohort: 1, weeklyXp: 150 });
    const { sent, send } = recorder();
    await sendReminders(db, call, send, at("2026-11-02T03:30:00Z")); // Monday 09:00 IST
    expect(sent[0].title).toBe("You moved up to the Manager league!");
  });

  it("warns on Sunday that the league ends tonight", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-11-01", 19); // played today, so no streak warning
    await db.addLeagueXp("2026-10-26", "a", 0, 60);
    await db.addLeagueXp("2026-10-26", "b", 0, 150);
    const { sent, send } = recorder();
    await sendReminders(db, call, send, at("2026-11-01T13:30:00Z")); // Sunday 19:00 IST
    expect(sent).toEqual([{ user: "a", title: "Your Intern league ends tonight" }]);
  });
});

describe("overtaken alerts", () => {
  it("tells real players who were just passed, once a day", async () => {
    const db = memoryDb();
    const noon = at("2026-10-30T06:30:00Z");
    await player(db, "ravi", "2026-10-30", 19);
    await player(db, "asha", "2026-10-30", 19);
    await db.addLeagueXp("2026-10-26", "ravi", 0, 50);
    await db.addLeagueXp("2026-10-26", "asha", 0, 200);
    await db.addLeagueXp("2026-10-26", "me", 0, 40);
    await db.createProfile("me", { ...fresh(), name: "Kiran" });
    await db.addLeagueXp("2026-10-26", "me", 0, 30); // 40 → 70: passes Ravi, not Asha
    const { sent, send } = recorder();
    await notifyOvertaken(db, "me", 40, send, noon);
    await notifyOvertaken(db, "me", 40, send, noon);
    expect(sent).toEqual([{ user: "ravi", title: "Kiran just passed you" }]);
  });
});

describe("admin messages", () => {
  it("go to everyone, or to one player only", async () => {
    const db = memoryDb();
    for (const id of ["a", "b"]) await player(db, id, null, 9);
    const { sent, send } = recorder();
    expect(await broadcast(db, { title: "New", body: "Hot Seat" }, undefined, send)).toMatchObject({ phones: 2, sent: 2 });
    expect(await broadcast(db, { title: "Hi", body: "You" }, "b", send)).toMatchObject({ phones: 1, sent: 1 });
    expect(sent.map((s) => s.user)).toEqual(["a", "b", "b"]);
  });
});
