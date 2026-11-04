// The Club's one-to-one chats (spec §9.3), against memoryDb with a fake Live that records events.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_COPY, POST_RANK, type LiveEvent } from "../community";
import { fresh } from "../game-state";
import {
  accept,
  badge,
  block,
  chats,
  ClubGateError,
  clearChat,
  decline,
  follow,
  join,
  leave,
  moderate,
  readChat,
  report,
  seen,
  sendMessage,
  startChat,
  typing,
  type Side,
} from "./club";
import { courseOutline } from "./content";
import { memoryDb } from "./db";
import { deleteAccount } from "./account";
import type { Send } from "./reminders";

type Mem = ReturnType<typeof memoryDb>;
const T0 = new Date("2026-11-07T06:30:00Z"); // Saturday, noon IST
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const course = courseOutline()!;

async function records(db: Mem, u: string) {
  for (const unit of course.units.slice(0, POST_RANK - 1))
    for (const m of unit.modules) {
      for (const l of m.lessons)
        await db.insertLessonPlay({ userId: u, playKey: `${u}-${l.id}`, lessonId: l.id, answers: [], accuracy: 100, xp: 0 });
      for (const g of m.gates)
        await db.insertRun({
          userId: u,
          runKey: `${u}-${g}`,
          hotSeatId: g,
          picks: [],
          score: 50,
          xp: 0,
          endingId: "e",
          endingTier: "ok",
          notes: [],
          patterns: [],
        });
    }
}
const hd = (u: string) => u.repeat(3);
const joinAs = (db: Mem, u: string) =>
  join(db, u, { handle: hd(u), name: u.toUpperCase(), building: "", adult: true, rules: true }, at(-3 * 24 * 60));
/** A paying member at Trader who joined three days ago. */
async function poster(db: Mem, u: string) {
  await records(db, u);
  await db.saveMembership({ userId: u, plan: "monthly", subscriptionId: `sub_${u}`, status: "active", currentEnd: "2027-01-01T00:00:00Z" });
  await joinAs(db, u);
}

function fakeSide() {
  const tasks: Promise<unknown>[] = [];
  const pushes: { user: string; title: string; body: string; url?: string }[] = [];
  const events: { userId: string; e: LiveEvent }[] = [];
  const send: Send = async (row, msg) => (pushes.push({ user: row.userId, title: msg.title, body: msg.body, url: msg.url }), "sent");
  const side: Side = { send, later: (t) => void tasks.push(t()), live: async (list) => void events.push(...list) };
  return { side, pushes, events, settle: () => Promise.all(tasks) };
}
/** A phone with reminders on, for a player who played today (nothing goes to players away over a week). */
async function phone(db: Mem, u: string, lastActiveDay = "2026-11-07") {
  await db.createProfile(u, { ...fresh(), lastActiveDay });
  await db.savePush({ endpoint: `https://push/${u}`, userId: u, keys: { p256dh: "k", auth: "a" }, remindHour: 19 });
}
let n = 0;
const say = (db: Mem, u: string, chatId: number, body: string, side: Side, when = T0) =>
  sendMessage(db, u, chatId, { body, clientId: `c${++n}` }, when, side);
const gate = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ClubGateError) return e.can;
    throw e;
  }
  return "ok";
};

/** a (a member at Trader) and b (free), both joined; b follows a unless `request`. */
async function pair(request = false) {
  const db = memoryDb();
  await poster(db, "a");
  await joinAs(db, "b");
  if (!request) await follow(db, "b", { handle: "aaa" }, T0, fakeSide().side);
  const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
  return { db, chatId };
}

beforeEach(() => vi.stubEnv("MODERATOR_USER_IDS", ""));
afterEach(() => vi.unstubAllEnvs());

describe("starting a chat", () => {
  it("makes one chat per pair, whoever starts it", async () => {
    const { db, chatId } = await pair();
    expect((await startChat(db, "a", { handle: "bbb" }, T0)).chatId).toBe(chatId);
    expect((await startChat(db, "b", { handle: "aaa" }, T0)).chatId).toBe(chatId); // b is free: an existing chat opens
    expect(db.club.chats).toHaveLength(1);
  });

  it("is a request when the receiver doesn't follow the sender", async () => {
    const { db, chatId } = await pair(true);
    expect(db.club.members.find((m) => m.userId === "b")?.state).toBe("request");
    const s = fakeSide();
    await say(db, "a", chatId, "Hello from Pune", s.side);
    expect((await chats(db, "b", "request", null)).chats.map((c) => c.with?.handle)).toEqual(["aaa"]);
    expect((await chats(db, "b", "active", null)).chats).toEqual([]);
    expect(await badge(db, "b")).toMatchObject({ requests: 1, chats: 0 });
  });

  it("a free player can reply in an accepted chat but can't start one", async () => {
    const { db, chatId } = await pair(true);
    await db.saveMembership({ userId: "c", plan: "monthly", subscriptionId: "x", status: "cancelled", currentEnd: null });
    await joinAs(db, "c");
    expect(await gate(startChat(db, "b", { handle: "ccc" }, T0))).toBe("pay");
    const s = fakeSide();
    await say(db, "a", chatId, "Hi", s.side);
    await expect(say(db, "b", chatId, "Hi back", s.side)).rejects.toThrow(CLUB_COPY.notSent); // accept first
    await accept(db, "b", chatId, T0);
    expect((await say(db, "b", chatId, "Hi back", s.side)).message.mine).toBe(true);
  });

  it("needs a joined player and refuses blocked or unknown handles", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await expect(startChat(db, "a", { handle: "nobody" }, T0)).rejects.toThrow(CLUB_COPY.notFound);
    await joinAs(db, "b");
    await block(db, "b", { handle: "aaa" }, T0);
    await expect(startChat(db, "a", { handle: "bbb" }, T0)).rejects.toThrow(CLUB_COPY.notFound);
    expect(await gate(startChat(db, "z", { handle: "aaa" }, T0))).toBe("join");
  });

  it("refuses hidden or banned players, and a ban stops sending", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    await joinAs(db, "c");
    await db.updateClubProfile("c", { hiddenAt: T0.toISOString() });
    await expect(startChat(db, "a", { handle: "ccc" }, T0)).rejects.toThrow(CLUB_COPY.notFound);
    await db.setClubBan("b", "infinity", "mod");
    await expect(say(db, "a", chatId, "hi", s.side)).rejects.toThrow(CLUB_COPY.notSent);
    expect((await readChat(db, "a", chatId, {}, T0)).chat.canSend).toBe(false);
    expect(await gate(say(db, "b", chatId, "hi", s.side))).toBe("banned");
  });

  it("no chat push to a player away for over a week", async () => {
    const { db, chatId } = await pair();
    await phone(db, "b", "2026-10-20");
    const s = fakeSide();
    await say(db, "a", chatId, "hello", s.side);
    await s.settle();
    expect(s.pushes).toEqual([]);
  });

  it("allows 5 requests a day", async () => {
    const db = memoryDb();
    await poster(db, "a");
    for (const u of ["b", "c", "d", "e", "f", "g"]) await joinAs(db, u);
    for (const u of ["b", "c", "d", "e", "f"]) await startChat(db, "a", { handle: hd(u) }, T0);
    await expect(startChat(db, "a", { handle: "ggg" }, T0)).rejects.toThrow(CLUB_COPY.tooManyChats);
  });
});

describe("sending", () => {
  it("allows 3 messages before a request is accepted", async () => {
    const { db, chatId } = await pair(true);
    const s = fakeSide();
    for (const t of ["one", "two", "three"]) await say(db, "a", chatId, t, s.side);
    await expect(say(db, "a", chatId, "four", s.side)).rejects.toThrow(CLUB_COPY.waitAccept("B"));
    await accept(db, "b", chatId, T0);
    await say(db, "a", chatId, "four", s.side);
  });

  it("a declined request is silent: the sender still sees it sent, nothing reaches the receiver", async () => {
    const { db, chatId } = await pair(true);
    const s = fakeSide();
    await say(db, "a", chatId, "one", s.side);
    await decline(db, "b", chatId);
    const r = await say(db, "a", chatId, "two", s.side);
    await s.settle();
    expect(r.message.body).toBe("two");
    expect(s.events.filter((e) => e.userId === "b").map((e) => (e.e.payload as { message: { body: string } }).message.body)).toEqual([
      "one",
    ]);
    expect((await chats(db, "b", "request", null)).chats).toEqual([]);
    await expect(readChat(db, "b", chatId, {}, T0)).rejects.toThrow(CLUB_COPY.chatGone);
    expect((await readChat(db, "a", chatId, {}, T0)).chat.waiting).toBe(true);
  });

  it("a block gives 'Message not sent' and the chat leaves the inbox", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    await say(db, "a", chatId, "hello", s.side);
    await block(db, "b", { handle: "aaa" }, T0);
    await expect(say(db, "a", chatId, "still there?", s.side)).rejects.toThrow(CLUB_COPY.notSent);
    expect((await chats(db, "b", "active", null)).chats).toEqual([]);
    await s.settle();
    expect(s.events.filter((e) => e.userId === "b")).toHaveLength(1); // only the message before the block
    await block(db, "b", { handle: "aaa", on: false }, T0);
    expect((await chats(db, "b", "active", null)).chats).toHaveLength(1); // unblocking brings it back
  });

  it("a retry with the same clientId sends once", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    const one = await sendMessage(db, "a", chatId, { body: "hi", clientId: "same" }, T0, s.side);
    const two = await sendMessage(db, "a", chatId, { body: "hi", clientId: "same" }, T0, s.side);
    expect(two.message.id).toBe(one.message.id);
    expect(db.club.messages).toHaveLength(1);
  });

  it("refuses phone numbers, emails and UPI ids", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    for (const t of ["call 98765 43210", "mail me a@b.com", "pay ravi@okicici"])
      await expect(say(db, "a", chatId, t, s.side)).rejects.toThrow(CLUB_COPY.noContacts);
    expect(db.club.messages).toHaveLength(0);
  });

  it("delivers a scam or link message with the warning and a report", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    const r = await say(db, "a", chatId, "Join my telegram for trading tips", s.side);
    await say(db, "a", chatId, "see shopname.in", s.side);
    expect(r.message.flagged).toBe(true);
    const b = await readChat(db, "b", chatId, {}, T0);
    expect(b.messages.map((m) => m.flagged)).toEqual([true, true]);
    expect(db.club.reports.map((x) => [x.targetKind, x.reason])).toEqual([
      ["message", "auto_scam"],
      ["message", "auto_link"],
    ]);
  });

  it("holds a scam message in a request until a moderator keeps it", async () => {
    const { db, chatId } = await pair(true);
    const s = fakeSide();
    await say(db, "a", chatId, "hello", s.side);
    const r = await say(db, "a", chatId, "double your money in a week", s.side);
    await s.settle();
    expect(r.message.held).toBe(true);
    expect((await readChat(db, "b", chatId, {}, T0)).messages.map((m) => m.body)).toEqual(["hello"]);
    expect((await readChat(db, "a", chatId, {}, T0)).messages).toHaveLength(2);
    expect(s.events.filter((e) => e.userId === "b")).toHaveLength(1);
    const rep = db.club.reports.find((x) => x.targetKind === "message")!;
    await moderate(db, { reportId: rep.id, action: "keep" }, T0);
    expect((await readChat(db, "b", chatId, {}, T0)).messages).toHaveLength(2);
  });

  it("sends the events to the receiver and the sender's own topic", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    await say(db, "a", chatId, "hello", s.side);
    await s.settle();
    expect(s.events.map((e) => [e.userId, e.e.event, (e.e.payload as { message: { mine: boolean } }).message.mine])).toEqual([
      ["a", "msg", true],
      ["b", "msg", false],
    ]);
  });
});

describe("seen and typing", () => {
  it("seen moves forward only and isn't told for requests", async () => {
    const { db, chatId } = await pair(true);
    const s = fakeSide();
    const m1 = (await say(db, "a", chatId, "one", s.side)).message;
    await seen(db, "b", chatId, { lastId: m1.id }, T0, s.side);
    expect((await readChat(db, "a", chatId, {}, T0)).theirLastRead).toBe(0);
    await accept(db, "b", chatId, T0);
    const m2 = (await say(db, "a", chatId, "two", s.side)).message;
    await seen(db, "b", chatId, { lastId: m2.id }, T0, s.side);
    await seen(db, "b", chatId, { lastId: m1.id }, T0, s.side);
    await s.settle();
    expect((await readChat(db, "a", chatId, {}, T0)).theirLastRead).toBe(m2.id);
    expect(s.events.filter((e) => e.e.event === "seen")).toEqual([
      { userId: "a", e: { event: "seen", payload: { chatId, lastId: m2.id } } },
    ]);
  });

  it("typing is throttled to one every 3 s and never written", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    const before = JSON.stringify(db.club.members);
    await typing(db, "a", chatId, at(0), s.side);
    await typing(db, "a", chatId, at(0.02), s.side);
    await typing(db, "a", chatId, at(0.1), s.side);
    await s.settle();
    expect(s.events).toEqual([
      { userId: "b", e: { event: "typing", payload: { chatId, handle: "aaa" } } },
      { userId: "b", e: { event: "typing", payload: { chatId, handle: "aaa" } } },
    ]);
    expect(JSON.stringify(db.club.members)).toBe(before);
  });
});

describe("pushes", () => {
  it("one per chat an hour, none while the chat is open, never the text", async () => {
    const { db, chatId } = await pair();
    await phone(db, "b");
    const s = fakeSide();
    await say(db, "a", chatId, "secret plan", s.side, at(0));
    await say(db, "a", chatId, "more", s.side, at(5));
    await s.settle();
    expect(s.pushes).toEqual([{ user: "b", title: "A", body: CLUB_COPY.pushMessage, url: `/app#club/chat/${chatId}` }]);
    expect(await db.noticesOn("b", "2026-11-07")).toBe(0); // not counted in the game's cap of 2
    expect(await db.dmNoticesOn("b", "2026-11-07")).toBe(1);
    await readChat(db, "b", chatId, {}, at(70));
    await say(db, "a", chatId, "now", s.side, at(70.5));
    await s.settle();
    expect(s.pushes).toHaveLength(1);
    await say(db, "a", chatId, "later", s.side, at(130));
    await s.settle();
    expect(s.pushes).toHaveLength(2);
  });

  it("a request pushes once", async () => {
    const { db, chatId } = await pair(true);
    await phone(db, "b");
    const s = fakeSide();
    await say(db, "a", chatId, "one", s.side);
    await say(db, "a", chatId, "two", s.side);
    await s.settle();
    expect(s.pushes.map((p) => p.title)).toEqual([CLUB_COPY.pushRequest("A")]);
  });
});

describe("reports, clearing and deleting", () => {
  it("reports a message, keeps the snapshot and hides it on removal", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    const m = (await say(db, "a", chatId, "you are useless", s.side)).message;
    await report(db, "b", { kind: "message", id: m.id, reason: "harass" }, T0, s.side);
    const r = db.club.reports.find((x) => x.reporterId === "b")!;
    expect(r).toMatchObject({ targetKind: "message", snapshot: "you are useless", targetUser: "a" });
    await moderate(db, { reportId: r.id, action: "remove" }, T0);
    expect((await readChat(db, "b", chatId, {}, T0)).messages).toEqual([]);
    await joinAs(db, "z");
    await expect(report(db, "z", { kind: "message", id: m.id, reason: "harass" }, T0, s.side)).rejects.toThrow(CLUB_COPY.notFound);
  });

  it("Delete chat hides it for me only until a new message", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    await say(db, "a", chatId, "one", s.side);
    await clearChat(db, "b", chatId);
    expect((await chats(db, "b", "active", null)).chats).toEqual([]);
    expect((await readChat(db, "a", chatId, {}, T0)).messages).toHaveLength(1);
    await say(db, "a", chatId, "two", s.side);
    expect((await readChat(db, "b", chatId, {}, T0)).messages.map((m) => m.body)).toEqual(["two"]);
  });

  it("Leave the Club and account deletion remove chat data", async () => {
    const { db, chatId } = await pair();
    const s = fakeSide();
    await say(db, "a", chatId, "one", s.side);
    await say(db, "b", chatId, "two", s.side);
    await leave(db, "b", T0);
    expect(db.club.members.some((m) => m.userId === "b")).toBe(false);
    expect(db.club.messages.some((m) => m.senderId === "b")).toBe(false);
    const view = await readChat(db, "a", chatId, {}, T0);
    expect(view.chat.with).toBeNull(); // "Deleted account", no composer
    expect(view.chat.canSend).toBe(false);
    await deleteAccount(db, () => ({ fetchSubscription: async () => ({ status: "cancelled", current_end: null }) }) as never, "a");
    expect(db.club.members).toEqual([]);
    expect(db.club.messages).toEqual([]);
  });
});
