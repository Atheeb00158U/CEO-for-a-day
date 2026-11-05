import { describe, expect, it } from "vitest";
import { readDailyPool } from "../content-files";
import { fresh } from "../game-state";
import { memoryDb, type LeagueRow } from "./db";
import {
  broadcast,
  cardsDue,
  deliver,
  hoursLeft,
  istHour,
  lastCall,
  leagueEnding,
  morningCall,
  notifyOvertaken,
  reminderFor,
  sendReminders,
  ttlAt,
  type Send,
} from "./reminders";

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
    expect(say("2026-10-27")).toBe("winback3");
    expect(say("2026-10-26")).toBe("winback4");
    expect(say("2026-10-23")).toBe("winback7");
    expect(say("2026-10-20")).toBeNull(); // away for over a week: left alone
    expect(reminderFor({ streak: 6, lastActiveDay: "2026-10-29" }, evening)?.title).toBe("5 hours left to keep your 6-day streak");
  });

  it("counts the hours left in the Indian day, and stops pushes from living into quiet hours", () => {
    expect(hoursLeft(evening)).toBe(5);
    expect(hoursLeft(at("2026-10-30T15:30:00Z"))).toBe(3); // 21:00
    expect(hoursLeft(at("2026-10-30T18:00:00Z"))).toBe(0); // 23:30
    expect(ttlAt(at("2026-10-30T03:30:00Z"))).toBe(6 * 3600); // 09:00: the six-hour cap
    expect(ttlAt(evening)).toBe(3 * 3600); // 19:00: gone by 10 pm
    expect(ttlAt(at("2026-10-30T16:00:00Z"))).toBe(3600); // 21:30: at least an hour
  });

  it("in the morning: today's Daily Call, else the next lesson, for players who played yesterday", () => {
    const s = (last: string) => ({ ...fresh(), lastActiveDay: last });
    const next = () => ({ title: "Profit is not cash", minutes: 4 });
    expect(morningCall(s("2026-10-29"), call, evening)?.title).toBe(`Today's call: ${call.company}, ${call.year}`);
    expect(morningCall(s("2026-10-29"), undefined, evening, next)).toMatchObject({
      title: "Next up: Profit is not cash",
      body: "One short lesson. About 4 minutes.",
    });
    expect(morningCall(s("2026-10-29"), undefined, evening)?.title).toBe("Make a CEO's decision today");
    expect(morningCall(s("2026-10-30"), call, evening)).toBeNull(); // played today
    expect(morningCall(s("2026-10-27"), call, evening)).toBeNull(); // on a break: the win-back covers it
  });

  it("gives a last call at 9 pm only while a streak is still open", () => {
    const nine = at("2026-10-30T15:30:00Z");
    expect(lastCall({ streak: 4, lastActiveDay: "2026-10-29" }, nine)?.title).toBe("3 hours left for your streak");
    expect(lastCall({ streak: 4, lastActiveDay: "2026-10-30" }, nine)).toBeNull();
    expect(lastCall({ streak: 0, lastActiveDay: "2026-10-29" }, nine)).toBeNull();
  });

  it("nudges about due flashcards, and says when they would keep the streak", () => {
    const cards = Object.fromEntries(["a", "b", "c"].map((id) => [id, ["2026-10-29", 1, 1, 2, 0, "2026-10-28"]]));
    const s = { ...fresh(), streak: 2, lastActiveDay: "2026-10-29", cards } as unknown as ReturnType<typeof fresh>;
    expect(cardsDue(s, evening)).toMatchObject({ kind: "cards_streak", title: "3 cards are ready for you" });
    expect(cardsDue({ ...s, lastActiveDay: "2026-10-30" }, evening)?.kind).toBe("cards");
    expect(cardsDue({ ...s, lastActiveDay: "2026-10-25" }, evening)).toBeNull(); // away too long
    expect(cardsDue({ ...s, cards: {} }, evening)).toBeNull();
  });

  it("says how far a player is from moving up when the league ends", () => {
    const row = (userId: string, weeklyXp: number): LeagueRow => ({ weekId: "2026-10-26", userId, tier: 0, cohort: 1, weeklyXp });
    const rows = [row("a", 150), row("b", 60), row("c", 20)];
    expect(leagueEnding(rows, "a")?.body).toMatch(/rank 1 and in line/);
    expect(leagueEnding(rows, "b")?.body).toBe("You are rank 2. Earn 91 more XP to move up.");
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

  it("sends nothing in quiet hours, and each kind once a day", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-10-29", 9);
    const { sent, send } = recorder();
    await sendReminders(db, call, send, at("2026-10-30T17:30:00Z")); // 23:00 IST
    expect(sent).toHaveLength(0);
    const nine = at("2026-10-30T03:30:00Z"); // 09:00 IST: the morning call and the streak warning
    await sendReminders(db, call, send, nine);
    await sendReminders(db, call, send, nine); // the same hour again: nothing new
    await sendReminders(db, call, send, at("2026-10-30T04:30:00Z")); // 10:00: the catch-up hour, already sent
    expect(sent.map((s) => s.title)).toEqual([`Today's call: ${call.company}, ${call.year}`, "15 hours left to keep your 3-day streak"]);
  });

  it("a whole day for a player who doesn't play: morning, cards, their hour, last call", async () => {
    const db = memoryDb();
    const cards = Object.fromEntries(["a", "b", "c", "d"].map((id) => [id, ["2026-10-29", 1, 1, 2, 0, "2026-10-28"]]));
    await db.createProfile("a", { ...fresh(), name: "a", streak: 5, lastActiveDay: "2026-10-29", cards } as never);
    await db.savePush({ endpoint: "https://push.example/a", userId: "a", keys: { p256dh: "k", auth: "a" }, remindHour: 18 });
    const { sent, send } = recorder();
    for (let h = 0; h < 24; h++) await sendReminders(db, undefined, send, new Date(Date.parse("2026-10-30T00:00:00+05:30") + h * 36e5));
    expect(sent.map((s) => s.title)).toEqual([
      "Make a CEO's decision today",
      "4 cards are ready for you",
      "6 hours left to keep your 5-day streak",
      "3 hours left for your streak",
    ]);
  });

  it("keeps the fourth place for saving a streak", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-10-29", 18);
    for (const k of ["x", "y", "z"]) await db.logNotice("a", k, "2026-10-30");
    const { sent, send } = recorder();
    await notifyOvertaken(db, "nobody", 0, send, at("2026-10-30T06:30:00Z"));
    await sendReminders(db, undefined, send, at("2026-10-30T12:30:00Z")); // 18:00: the streak warning still goes
    expect(sent.map((s) => s.title)).toEqual(["6 hours left to keep your 3-day streak"]);
    await sendReminders(db, undefined, send, at("2026-10-30T15:30:00Z")); // 21:00: the cap is reached
    expect(sent).toHaveLength(1);
  });

  it("makes up a missed run in the next hour, without a second warning straight after", async () => {
    const db = memoryDb();
    await player(db, "a", "2026-10-29", 20);
    const { sent, send } = recorder();
    await sendReminders(db, undefined, send, at("2026-10-30T15:30:00Z")); // 21:00, the 8 pm run was missed
    expect(sent.map((s) => s.title)).toEqual(["3 hours left to keep your 3-day streak"]); // and no last call for an 8 pm player
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
    expect(sent).toEqual([{ user: "ravi", title: "Kiran moved ahead of you" }]);
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

describe("Club pushes", () => {
  const clubCap = (db: ReturnType<typeof memoryDb>) => ({ count: (u: string, d: string) => db.clubNoticesOn(u, d), max: 3 });
  const tally = () => ({ sent: 0, gone: 0, failed: 0 });

  it("have their own cap of 3, keep quiet hours, and never use up the game's 4", async () => {
    const db = memoryDb();
    const { sent, send } = recorder();
    await player(db, "a", "2026-10-29", 19);
    const phones = await db.pushes("a");
    const night = at("2026-10-30T17:30:00Z"); // 23:00 IST
    expect(await deliver(db, "a", phones, { kind: "club_reply", title: "R", body: "x" }, send, night, tally(), clubCap(db))).toBe(false);
    for (const kind of ["club_reply", "club_follow", "club_request", "club_other"])
      await deliver(db, "a", phones, { kind, title: kind, body: "x", url: "/app#club", tag: "club" }, send, evening, tally(), clubCap(db));
    expect(sent.map((s) => s.title)).toEqual(["club_reply", "club_follow", "club_request"]);
    expect(await db.noticesOn("a", "2026-10-30")).toBe(0);
    await sendReminders(db, call, send, evening);
    expect(sent.at(-1)?.title).toBe("5 hours left to keep your 3-day streak");
  });
});
