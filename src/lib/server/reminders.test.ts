import { describe, expect, it } from "vitest";
import { fresh } from "../game-state";
import { memoryDb } from "./db";
import { istHour, reminderFor, sendReminders, type Send } from "./reminders";

const now = new Date("2026-10-30T13:30:00Z"); // 19:00 IST on 30 Oct

describe("streak reminders", () => {
  it("works out the hour in India", () => {
    expect(istHour(now)).toBe(19);
    expect(istHour(new Date("2026-10-30T18:30:00Z"))).toBe(0);
  });

  it("warns a player whose streak ends tonight", () => {
    expect(reminderFor({ streak: 6, lastActiveDay: "2026-10-29" }, now)?.title).toBe("Your 6-day streak ends tonight");
  });

  it("leaves alone a player who already played today, has never played, or stopped over a week ago", () => {
    expect(reminderFor({ streak: 6, lastActiveDay: "2026-10-30" }, now)).toBeNull();
    expect(reminderFor({ streak: 0, lastActiveDay: null }, now)).toBeNull();
    expect(reminderFor({ streak: 0, lastActiveDay: "2026-10-20" }, now)).toBeNull();
  });

  it("tells a recent player that today's call is ready", () => {
    expect(reminderFor({ streak: 0, lastActiveDay: "2026-10-26" }, now)?.title).toBe("Today's call is ready");
  });

  it("sends at each player's hour and deletes subscriptions that are gone", async () => {
    const db = memoryDb();
    for (const [id, last, hour] of [
      ["a", "2026-10-29", 19],
      ["b", "2026-10-30", 19],
      ["c", "2026-10-29", 8],
      ["d", "2026-10-29", 19],
    ] as const) {
      await db.createProfile(id, { ...fresh(), streak: 3, lastActiveDay: last });
      await db.savePush({ endpoint: `https://push.example/${id}`, userId: id, keys: { p256dh: "k", auth: "a" }, remindHour: hour });
    }
    const sent: string[] = [];
    const send: Send = async (row) => {
      sent.push(row.userId);
      return row.userId === "d" ? "gone" : "sent";
    };
    const tally = await sendReminders(db, send, now);
    expect(sent).toEqual(["a", "d"]);
    expect(tally).toMatchObject({ due: 3, sent: 1, skipped: 1, gone: 1 });
    expect((await db.pushesAt(19)).map((p) => p.userId)).toEqual(["a", "b"]);
  });
});
