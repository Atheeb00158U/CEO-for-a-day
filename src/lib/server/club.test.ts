// The Club on the server (spec §9.2), against memoryDb. Ranks come from the real course outline.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_COPY, POST_RANK } from "../community";
import { fresh } from "../game-state";
import { readHotSeat } from "../content-files";
import { play, type Pick } from "../play";
import type { HotSeat } from "../hotseat-types";
import {
  activity,
  block,
  ClubGateError,
  createPost,
  deletePost,
  feed,
  follow,
  hotSeatThread,
  join,
  leave,
  like,
  me,
  moderate,
  myReports,
  refreshCareer,
  report,
  thread,
  trustedCareer,
  userProfile,
  type Side,
} from "./club";
import { courseOutline } from "./content";
import { memoryDb } from "./db";
import { finishRun, GameError, importGuest, update } from "./game";
import type { Send } from "./reminders";

type Mem = ReturnType<typeof memoryDb>;
const T0 = new Date("2026-11-07T06:30:00Z"); // Saturday, noon IST
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const course = courseOutline()!;
const kodak = readHotSeat("kodak");

function path(hs: HotSeat): Pick[] {
  const picks: Pick[] = [];
  for (let v = play(hs, picks); !v.result; v = play(hs, picks)) {
    const d = v.screens.at(-1)!;
    if (d.kind !== "decision") throw new Error("expected a decision");
    picks.push({ nodeId: d.id, optionId: d.options[0].id });
  }
  return picks;
}

/** Server records for every module of the first `units` units. */
async function records(db: Mem, u: string, units = POST_RANK - 1) {
  for (const unit of course.units.slice(0, units))
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
const member = (db: Mem, u: string) =>
  db.saveMembership({ userId: u, plan: "monthly", subscriptionId: `sub_${u}`, status: "active", currentEnd: "2027-01-01T00:00:00Z" });
/** Handles must be 3+ characters: "a" joins as "aaa". */
const hd = (u: string) => u.repeat(3);
const joinAs = (db: Mem, u: string, when = at(-3 * 24 * 60)) =>
  join(db, u, { handle: hd(u), name: u.toUpperCase(), building: "", adult: true, rules: true }, when);
/** A paying member at Trader who joined three days ago. */
async function poster(db: Mem, u: string) {
  await records(db, u);
  await member(db, u);
  await joinAs(db, u);
}

function fakeSide() {
  const tasks: Promise<unknown>[] = [];
  const pushes: { user: string; title: string; body: string }[] = [];
  const send: Send = async (row, msg) => (pushes.push({ user: row.userId, title: msg.title, body: msg.body }), "sent");
  const side: Side = { send, later: (t) => void tasks.push(t()) };
  return { side, pushes, settle: () => Promise.all(tasks) };
}
const phone = (db: Mem, u: string) =>
  db.savePush({ endpoint: `https://push/${u}`, userId: u, keys: { p256dh: "k", auth: "a" }, remindHour: 19 });
const gate = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ClubGateError) return e.can;
    throw e;
  }
  return "ok";
};

beforeEach(() => vi.stubEnv("MODERATOR_USER_IDS", ""));
afterEach(() => vi.unstubAllEnvs());

describe("joining", () => {
  it("needs both ticks and a free handle", async () => {
    const db = memoryDb();
    const ok = { handle: "ravik", name: "Ravi", building: "Chai stall", adult: true, rules: true };
    await expect(join(db, "a", { ...ok, adult: false }, T0)).rejects.toThrow(CLUB_COPY.under18);
    await expect(join(db, "a", { ...ok, rules: false }, T0)).rejects.toThrow(CLUB_COPY.mustAgree);
    await expect(join(db, "a", { ...ok, handle: "x" }, T0)).rejects.toThrow(CLUB_COPY.badHandle);
    await expect(join(db, "a", { ...ok, building: "Call 9876543210" }, T0)).rejects.toThrow(CLUB_COPY.noContacts);
    const r = await join(db, "a", ok, T0);
    expect(r.profile).toMatchObject({ handle: "ravik", name: "Ravi", building: "Chai stall", mine: true, title: "Street Seller" });
    await expect(join(db, "b", { ...ok, handle: "RaviK" }, T0)).rejects.toThrow(CLUB_COPY.handleTaken);
    expect(db.club.profiles.get("a")?.adultAt).toBe(T0.toISOString());
  });

  it("never shows an id, email or plan", async () => {
    const db = memoryDb();
    await poster(db, "a");
    const p = await userProfile(db, "a", hd("a"), undefined, T0);
    expect(JSON.stringify(p)).not.toMatch(/sub_|userId|email|plan/);
  });
});

describe("the gate", () => {
  it("asks a free player to pay, a member below Trader to rank up, and lets a Trader member post", async () => {
    const db = memoryDb();
    await joinAs(db, "free");
    expect(await gate(createPost(db, "free", { body: "hi" }, T0))).toBe("pay");
    await member(db, "low");
    await records(db, "low", POST_RANK - 2);
    await joinAs(db, "low");
    expect(await gate(createPost(db, "low", { body: "hi" }, T0))).toBe("rank");
    await poster(db, "top");
    expect((await trustedCareer(db, "top")).rank).toBe(POST_RANK);
    expect(await gate(createPost(db, "top", { body: "hi" }, T0))).toBe("ok");
    expect(await gate(createPost(db, "nobody", { body: "hi" }, T0))).toBe("join");
    expect(await gate(like(db, "nobody", { postId: 1 }, T0))).toBe("join");
    expect((await me(db, "low", T0)).can).toEqual({ post: "rank", interact: "ok" });
  });

  it("takes the rank from server records, never an imported save", async () => {
    const db = memoryDb();
    await member(db, "a");
    const lessons = Object.fromEntries(course.units.flatMap((u) => u.modules.flatMap((m) => m.lessons.map((l) => [l.id, 100]))));
    await importGuest(db, "a", { lessons, best: { kodak: 100 } }, T0, { lessons: new Set(Object.keys(lessons)), cardLesson: new Map() });
    await joinAs(db, "a");
    expect(db.club.profiles.get("a")?.rank).toBe(1);
    expect(await gate(createPost(db, "a", { body: "hi" }, T0))).toBe("rank");
    await refreshCareer(db, "a", T0);
    expect(db.club.profiles.get("a")?.rank).toBe(1);
  });
});

describe("posting limits", () => {
  it("caps posts a day, spaces them out, and refuses the same text twice", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await createPost(db, "a", { body: "first" }, at(0));
    await expect(createPost(db, "a", { body: "second" }, at(0.2))).rejects.toThrow(CLUB_COPY.slowDown);
    await expect(createPost(db, "a", { body: "first" }, at(1))).rejects.toThrow(CLUB_COPY.repeat);
    for (let i = 1; i < 10; i++) await createPost(db, "a", { body: `post ${i}` }, at(i));
    await expect(createPost(db, "a", { body: "one more" }, at(20))).rejects.toThrow(CLUB_COPY.tooManyPosts);
  });

  it("gives a new member half the limit on day one", async () => {
    const db = memoryDb();
    await records(db, "a");
    await member(db, "a");
    await joinAs(db, "a", T0);
    for (let i = 0; i < 5; i++) await createPost(db, "a", { body: `post ${i}` }, at(i));
    await expect(createPost(db, "a", { body: "one more" }, at(10))).rejects.toThrow(CLUB_COPY.tooManyPosts);
  });

  it("refuses contact details and holds a link for the author's eyes only", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    await expect(createPost(db, "a", { body: "ping me ravi@gmail.com" }, T0)).rejects.toThrow(CLUB_COPY.noContacts);
    const { post } = await createPost(db, "a", { body: "my shop: www.ravichai.in" }, T0);
    expect(post.held).toBe(true);
    expect((await userProfile(db, "a", hd("a"), undefined, T0)).posts.map((p) => p.id)).toEqual([post.id]);
    expect((await userProfile(db, "b", hd("a"), undefined, T0)).posts).toEqual([]);
    expect((await feed(db, "b", { tab: null, cursor: null }, T0)).posts).toEqual([]);
    await expect(thread(db, "b", post.id, null, T0)).rejects.toThrow(GameError);
    expect((await db.reportQueue())[0]).toMatchObject({ reason: "auto_link", reporterId: null, targetId: String(post.id) });
  });
});

describe("the feed", () => {
  it("counts replies, toggles likes once, and tells the author", async () => {
    const db = memoryDb();
    const { side, pushes, settle } = fakeSide();
    await poster(db, "a");
    await poster(db, "b");
    await phone(db, "a");
    const { post } = await createPost(db, "a", { body: "Sold 40 cups today" }, T0);
    await createPost(db, "b", { body: "Well done", parentId: post.id }, at(1), side);
    await settle();
    expect(pushes).toEqual([{ user: "a", title: "B replied to you", body: "Well done" }]);
    expect((await db.getPost(post.id))?.replyCount).toBe(1);
    expect((await like(db, "b", { postId: post.id, on: true }, at(2))).likes).toBe(1);
    expect((await like(db, "b", { postId: post.id, on: true }, at(2))).likes).toBe(1);
    expect((await like(db, "b", { postId: post.id, on: false }, at(2))).likes).toBe(0);
    await expect(
      createPost(db, "b", { body: "deep", parentId: (await thread(db, "b", post.id, null, at(3))).replies[0].id }, at(4)),
    ).rejects.toThrow(GameError);
    const items = (await activity(db, "a", null)).items;
    expect(items.map((i) => i.kind).sort()).toEqual(["like", "reply"]);
    expect(items.find((i) => i.kind === "reply")).toMatchObject({ text: "Well done", postId: post.id, actor: { handle: hd("b") } });
    expect(await db.unseenActivity("a")).toBe(0);
  });

  it("shows follows in Following, and a block hides both ways and drops follows", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    const { post } = await createPost(db, "a", { body: "hello" }, T0);
    expect((await feed(db, "b", { tab: "following", cursor: null }, T0)).posts).toEqual([]);
    await follow(db, "b", { handle: hd("a"), on: true }, T0, fakeSide().side);
    expect((await feed(db, "b", { tab: "following", cursor: null }, T0)).posts.map((p) => p.id)).toEqual([post.id]);
    expect((await userProfile(db, "b", hd("a"), undefined, T0)).youFollow).toBe(true);
    await block(db, "a", { handle: hd("b"), on: true }, T0);
    expect(await db.follows("b", "a")).toBe(false);
    expect((await feed(db, "b", { tab: null, cursor: null }, T0)).posts).toEqual([]);
    await expect(userProfile(db, "b", hd("a"), undefined, T0)).rejects.toThrow(CLUB_COPY.unavailable);
    expect((await userProfile(db, "a", hd("b"), undefined, T0)).blocked).toBe(true);
    await expect(follow(db, "b", { handle: hd("a") }, T0)).rejects.toThrow(CLUB_COPY.notFound);
    await expect(like(db, "b", { postId: post.id }, T0)).rejects.toThrow(GameError);
  });

  it("pages For you and creates the Wolf's question once a day", async () => {
    const db = memoryDb();
    await poster(db, "a");
    for (let i = 0; i < 25; i++)
      await db.insertPost({
        authorId: "a",
        kind: "post",
        ref: null,
        parentId: null,
        body: `p${i}`,
        held: null,
        hiddenAt: null,
        createdAt: at(-i).toISOString(),
      });
    const one = await feed(db, "a", { tab: null, cursor: null }, T0);
    expect(one.question?.author).toBeNull();
    expect(one.posts).toHaveLength(20);
    const two = await feed(db, "a", { tab: null, cursor: one.cursor! }, at(5));
    expect(two.question).toBeUndefined();
    expect(two.posts).toHaveLength(5);
    expect(new Set([...one.posts, ...two.posts].map((p) => p.id)).size).toBe(25);
    await feed(db, "a", { tab: null, cursor: null }, at(60));
    expect(db.club.posts.filter((p) => p.kind === "question")).toHaveLength(1);
  });

  it("deletes the author's own post, replies and likes with it", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await poster(db, "b");
    const { post } = await createPost(db, "a", { body: "hello" }, T0);
    await createPost(db, "b", { body: "hi", parentId: post.id }, at(1));
    await like(db, "b", { postId: post.id }, at(1));
    await expect(deletePost(db, "b", post.id)).rejects.toThrow(GameError);
    await deletePost(db, "a", post.id);
    expect(db.club.posts).toEqual([]);
    expect(db.club.likes).toEqual([]);
  });
});

describe("Hot Seat threads", () => {
  it("are refused without a run, created once with one, and stay off profiles, Following and pushes", async () => {
    const db = memoryDb();
    const { side, pushes, settle } = fakeSide();
    await poster(db, "a");
    await poster(db, "b");
    await phone(db, "a");
    await follow(db, "a", { handle: hd("b") }, T0);
    await expect(hotSeatThread(db, "a", "kodak", T0)).rejects.toThrow(CLUB_COPY.hotSeatLocked);
    await finishRun(db, "a", kodak, { runKey: "run-club-a", picks: path(kodak), hindsightUsed: false }, T0);
    await finishRun(db, "b", kodak, { runKey: "run-club-b", picks: path(kodak), hindsightUsed: false }, T0);
    const t = await hotSeatThread(db, "a", "kodak", T0);
    expect(t.post).toMatchObject({ kind: "hotseat", body: CLUB_COPY.hotSeatPost, author: null });
    expect((await hotSeatThread(db, "b", "kodak", T0)).post.id).toBe(t.post.id);
    await createPost(db, "b", { body: "I sold the film arm", parentId: t.post.id }, at(1), side);
    await settle();
    expect(pushes).toEqual([]);
    expect((await userProfile(db, "a", hd("b"), undefined, at(2))).posts).toEqual([]);
    expect((await feed(db, "a", { tab: "following", cursor: null }, at(2))).posts).toEqual([]);
    await poster(db, "c");
    await expect(thread(db, "c", t.post.id, null, at(2))).rejects.toThrow(CLUB_COPY.hotSeatLocked);
    await expect(createPost(db, "c", { body: "me too", parentId: t.post.id }, at(3))).rejects.toThrow(CLUB_COPY.hotSeatLocked);
  });
});

describe("reports and moderation", () => {
  async function setup() {
    const db = memoryDb();
    await poster(db, "a");
    for (const u of ["r1", "r2", "r3"]) await joinAs(db, u);
    const { post } = await createPost(db, "a", { body: "Buy my course" }, T0);
    return { db, post };
  }

  it("hides at once on a private report, and on 3 reports", async () => {
    const { db, post } = await setup();
    expect(await report(db, "r1", { kind: "post", id: post.id, reason: "spam" }, T0, fakeSide().side)).toEqual({ reported: true });
    expect((await db.getPost(post.id))?.hiddenAt).toBeNull();
    await report(db, "r2", { kind: "post", id: post.id, reason: "spam" }, T0, fakeSide().side);
    await report(db, "r3", { kind: "post", id: post.id, reason: "other" }, T0, fakeSide().side);
    expect((await db.getPost(post.id))?.hiddenAt).toBe(T0.toISOString());
    const second = await createPost(db, "a", { body: "Another" }, at(1));
    await report(db, "r1", { kind: "post", id: second.post.id, reason: "private" }, at(2), fakeSide().side);
    expect((await db.getPost(second.post.id))?.hiddenAt).not.toBeNull();
    expect((await db.reportQueue()).find((r) => r.reason === "private")?.dueAt).toBe(
      new Date(at(2).getTime() + 2 * 3600_000).toISOString(),
    );
  });

  it("doesn't hide at once for new accounts, or past 3 instant hides a day", async () => {
    const { db, post } = await setup();
    db.accounts.set("r1", at(-60).toISOString());
    await report(db, "r1", { kind: "post", id: post.id, reason: "fake" }, T0, fakeSide().side);
    expect((await db.getPost(post.id))?.hiddenAt).toBeNull();
    const posts = [];
    for (let i = 0; i < 4; i++) posts.push((await createPost(db, "a", { body: `p${i}` }, at(1 + i))).post.id);
    for (const id of posts) await report(db, "r2", { kind: "post", id, reason: "private" }, at(10), fakeSide().side);
    expect(posts.map((id) => !!db.club.posts.find((p) => p.id === id)?.hiddenAt)).toEqual([true, true, true, false]);
  });

  it("refuses a report on something the reporter can't see", async () => {
    const { db } = await setup();
    const held = await createPost(db, "a", { body: "www.x.com" }, at(1));
    await expect(report(db, "r1", { kind: "post", id: held.post.id, reason: "spam" }, T0)).rejects.toThrow(GameError);
    await expect(report(db, "r1", { kind: "profile", id: "ghost", reason: "fake" }, T0)).rejects.toThrow(CLUB_COPY.notFound);
  });

  it("lets anyone signed in report, and tells moderators", async () => {
    const { db, post } = await setup();
    vi.stubEnv("MODERATOR_USER_IDS", "mod");
    await phone(db, "mod");
    const { side, pushes, settle } = fakeSide();
    await report(db, "outsider", { kind: "post", id: post.id, reason: "scam", note: "asks for money" }, T0, side);
    await settle();
    expect(pushes).toEqual([{ user: "mod", title: "New report: Scam or money scheme", body: "Due in 36 hours." }]);
    expect((await myReports(db, "outsider")).reports).toMatchObject([{ reason: "scam", status: "open" }]);
  });

  it("Keep restores and tells reporters; Remove keeps the snapshot after the author deletes their account", async () => {
    const { db, post } = await setup();
    await report(db, "r1", { kind: "post", id: post.id, reason: "private" }, T0, fakeSide().side);
    const id = (await db.reportQueue())[0].id;
    expect(await moderate(db, { reportId: id, action: "keep" }, at(5))).toEqual({ ok: true, resolved: 1 });
    expect((await db.getPost(post.id))?.hiddenAt).toBeNull();
    expect((await activity(db, "r1", null)).items[0].text).toBe(CLUB_COPY.outcomeKept);
    await report(db, "r2", { kind: "post", id: post.id, reason: "spam" }, at(7), fakeSide().side);
    const id2 = (await db.reportQueue())[0].id;
    await moderate(db, { reportId: id2, action: "remove" }, at(8));
    expect((await db.getPost(post.id))?.hiddenAt).not.toBeNull();
    expect((await activity(db, "a", null)).items[0].text).toBe(CLUB_COPY.removedYours("spam or selling"));
    await db.deleteUser("a");
    expect(await db.getReport(id2)).toMatchObject({ snapshot: "Buy my course", status: "removed", targetUser: "a" });
    expect(await moderate(db, { reportId: 99999, action: "keep" }, at(9))).toBeNull();
  });

  it("a ban survives leaving and rejoining; leaving makes you wait a day", async () => {
    const { db, post } = await setup();
    await report(db, "r1", { kind: "post", id: post.id, reason: "hate" }, T0, fakeSide().side);
    await moderate(db, { reportId: (await db.reportQueue())[0].id, action: "ban7" }, T0);
    expect(await gate(createPost(db, "a", { body: "x" }, at(1)))).toBe("banned");
    await leave(db, "a", at(1));
    await joinAs(db, "a", at(2));
    expect(await gate(createPost(db, "a", { body: "x" }, at(3)))).toBe("banned");
    await leave(db, "r1", at(3));
    await expect(joinAs(db, "r1", at(4))).rejects.toThrow(CLUB_COPY.rejoinWait);
    await joinAs(db, "r1", at(25 * 60));
  });
});

describe("title and streak on the profile", () => {
  it("copies the streak only when it changes", async () => {
    const db = memoryDb();
    await joinAs(db, "a");
    const spy = vi.spyOn(db, "updateClubProfile");
    await update(db, "a", (s) => ({ ...s, coins: s.coins + 1 }), T0);
    expect(spy).not.toHaveBeenCalled();
    await update(db, "a", (s) => ({ ...s, streak: 4, lastActiveDay: "2026-11-07" }), T0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(db.club.profiles.get("a")).toMatchObject({ streak: 4, streakDay: "2026-11-07" });
  });

  it("refreshes the title after a lesson or Hot Seat, posting the rank-up once and only with milestones on", async () => {
    const db = memoryDb();
    await joinAs(db, "a");
    await joinAs(db, "b");
    db.club.profiles.get("b")!.milestones = false;
    for (const u of ["a", "b"]) {
      await records(db, u);
      await finishRun(db, u, kodak, { runKey: `run-rank-${u}`, picks: path(kodak), hindsightUsed: false }, T0);
    }
    expect(db.club.profiles.get("a")?.rank).toBe(POST_RANK);
    expect(db.club.profiles.get("b")?.rank).toBe(POST_RANK);
    await refreshCareer(db, "a", T0);
    const rankUps = db.club.posts.filter((p) => p.kind === "rank_up");
    expect(rankUps.map((p) => [p.authorId, p.body])).toEqual([["a", "A became a Trader."]]);
  });
});

describe("leaving and deleting", () => {
  it("Leave removes every Club row but keeps the game", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await poster(db, "b");
    await db.createProfile("a", fresh());
    const { post } = await createPost(db, "a", { body: "hi" }, T0);
    await createPost(db, "b", { body: "hey", parentId: post.id }, at(1));
    await like(db, "b", { postId: post.id }, at(1));
    await follow(db, "a", { handle: hd("b") }, at(1));
    await leave(db, "a", at(2));
    const c = db.club;
    expect(c.profiles.has("a")).toBe(false);
    expect(c.posts).toEqual([]);
    expect([...c.likes, ...c.follows, ...c.activity.filter((x) => x.userId === "a" || x.actorId === "a")]).toEqual([]);
    expect(await db.getProfile("a")).not.toBeNull();
  });

  it("deleting the account removes every Club row; reports keep the snapshot", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await poster(db, "b");
    const { post } = await createPost(db, "b", { body: "hello" }, T0);
    await report(db, "a", { kind: "post", id: post.id, reason: "spam" }, T0, fakeSide().side);
    await like(db, "a", { postId: post.id }, T0);
    await follow(db, "a", { handle: hd("b") }, T0);
    await block(db, "b", { handle: hd("a") }, T0);
    await db.setClubBan("a", "infinity", "mod");
    await db.deleteUser("a");
    const c = db.club;
    const rows = JSON.stringify([[...c.profiles.values()], c.posts, c.likes, c.follows, c.blocks, c.activity, [...c.bans.keys()]]);
    expect(rows).not.toContain('"a"');
    expect(c.reports[0]).toMatchObject({ reporterId: null, snapshot: "hello" });
    expect((await db.getPost(post.id))?.likeCount).toBe(0);
  });
});
