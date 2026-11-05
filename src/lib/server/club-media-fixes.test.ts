// The Club, step 3: fixes from the PR #19 review, one test (or a few) per finding. memoryDb, as club-media.test.ts.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_COPY, LIMITS, POST_RANK } from "../community";
import { deleteAccount } from "./account";
import {
  addToGroup,
  block,
  chats,
  createGroup,
  createPost,
  deletePost,
  follow,
  join,
  leave,
  moderate,
  purgeImages,
  readChat,
  removeFromGroup,
  report,
  sendMessage,
  startChat,
  thread,
  uploadImage,
  type Side,
} from "./club";
import { decoding, MAX_PIXELS, readCapped, toWebp } from "./club-image";
import { courseOutline } from "./content";
import { memoryDb, type ImageRow } from "./db";
import type { RazorpayClient } from "./razorpay";

type Mem = ReturnType<typeof memoryDb>;
const T0 = new Date("2026-11-07T06:30:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const course = courseOutline()!;
const side: Side = { send: async () => "sent", later: (t) => void t(), live: async () => {} };

async function poster(db: Mem, u: string) {
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
  await db.saveMembership({ userId: u, plan: "monthly", subscriptionId: `sub_${u}`, status: "active", currentEnd: "2027-01-01T00:00:00Z" });
  await joinAs(db, u);
}
const joinAs = (db: Mem, u: string) =>
  join(db, u, { handle: u.repeat(3), name: u.toUpperCase(), building: "", adult: true, rules: true }, at(-3 * 24 * 60));
const jpeg = (w = 40, h = 30) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#c80" } })
    .jpeg()
    .toBuffer()
    .then((b) => new Uint8Array(b));
const upload = async (db: Mem, u: string, chat?: number, now = T0) =>
  (await uploadImage(db, u, chat ? String(chat) : null, jpeg, now)).imageId;
const img = (db: Mem, id: string) => db.club.images.find((i) => i.id === id);
let n = 0;
const say = (db: Mem, u: string, chatId: number, body: Record<string, unknown>) =>
  sendMessage(db, u, chatId, { clientId: `c${++n}`, ...body }, T0, side);
/** a (member) and b (joined), b follows a so the chat is active. */
async function pair() {
  const db = memoryDb();
  await poster(db, "a");
  await joinAs(db, "b");
  await follow(db, "b", { handle: "aaa" }, T0, side);
  const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
  return { db, chatId };
}
const fakeRp = (): RazorpayClient => ({
  createSubscription: async () => {
    throw new Error("not used");
  },
  cancelSubscription: async () => ({ status: "cancelled", current_end: null }),
  fetchSubscription: async () => ({ status: "cancelled", current_end: null }),
});

beforeEach(() => vi.stubEnv("MODERATOR_USER_IDS", ""));
afterEach(() => vi.unstubAllEnvs());

describe("1. one picture, one message or post", () => {
  it("a picture can't go into a second message, in this chat or another; a true retry gets the saved row", async () => {
    const { db, chatId } = await pair();
    await joinAs(db, "c");
    await follow(db, "c", { handle: "aaa" }, T0, side);
    const other = (await startChat(db, "a", { handle: "ccc" }, T0)).chatId;
    const imageId = await upload(db, "a", chatId);
    const first = await sendMessage(db, "a", chatId, { clientId: "same", imageId }, T0, side);
    const retry = await sendMessage(db, "a", chatId, { clientId: "same", imageId }, at(1), side);
    expect(retry.message.id).toBe(first.message.id);
    await expect(say(db, "a", chatId, { imageId })).rejects.toThrow(CLUB_COPY.pictureGone);
    await expect(say(db, "a", other, { imageId })).rejects.toThrow(CLUB_COPY.pictureGone);
    expect(db.club.messages.filter((m) => m.imageId === imageId)).toHaveLength(1);
  });

  it("a picture can't go into a second post, nor a used chat picture into a post", async () => {
    const { db, chatId } = await pair();
    const imageId = await upload(db, "a");
    await createPost(db, "a", { body: "one", imageId }, T0, side);
    await expect(createPost(db, "a", { body: "two", imageId }, at(1), side)).rejects.toThrow(CLUB_COPY.pictureGone);
    const chatPic = await upload(db, "a", chatId);
    await say(db, "a", chatId, { imageId: chatPic });
    await expect(createPost(db, "a", { body: "three", imageId: chatPic }, at(2), side)).rejects.toThrow(CLUB_COPY.pictureGone);
  });
});

describe("2. evidence is kept while a report is open, or the content is hidden", () => {
  async function reported() {
    const { db, chatId } = await pair();
    const imageId = await upload(db, "a");
    const { post } = await createPost(db, "a", { body: "Look", imageId }, T0, side);
    await report(db, "b", { kind: "post", id: post.id, reason: "sexual" }, T0, side);
    return { db, chatId, imageId, post };
  }
  const kept = (i?: ImageRow) => expect(i).toMatchObject({ ownerId: null, path: `removed/${i?.id}.webp` });

  it("deleting the post keeps its reported picture, and the report still shows it", async () => {
    const { db, imageId, post } = await reported();
    await deletePost(db, "a", post.id, T0);
    kept(img(db, imageId));
    expect(db.club.stored.has(`removed/${imageId}.webp`)).toBe(true);
    expect(db.club.reports[0].imageId).toBe(imageId);
  });

  it("leaving the Club keeps it", async () => {
    const { db, imageId } = await reported();
    await leave(db, "a", T0);
    kept(img(db, imageId));
    expect(db.club.reports[0].imageId).toBe(imageId);
  });

  it("deleting the account keeps it (and a reported chat picture too)", async () => {
    const { db, chatId, imageId } = await reported();
    const chatPic = await upload(db, "a", chatId);
    const { message } = await say(db, "a", chatId, { imageId: chatPic });
    await report(db, "b", { kind: "message", id: message.id, reason: "harass" }, T0, side);
    await deleteAccount(db, fakeRp, "a");
    for (const id of [imageId, chatPic]) kept(img(db, id));
    expect(db.club.reports.map((r) => r.imageId).sort()).toEqual([imageId, chatPic].sort());
    expect([...db.club.stored.keys()].every((k) => k.startsWith("removed/"))).toBe(true);
  });

  it("an unreported picture still goes with the account", async () => {
    const { db } = await pair();
    const imageId = await upload(db, "a");
    await createPost(db, "a", { body: "fine", imageId }, T0, side);
    await deleteAccount(db, fakeRp, "a");
    expect(db.club.images).toEqual([]);
    expect(db.club.stored.size).toBe(0);
  });

  it("a ban with hide-all keeps pictures of posts reports had already hidden", async () => {
    const { db } = await pair();
    const first = await upload(db, "a");
    const { post: hidden } = await createPost(db, "a", { body: "first", imageId: first }, T0, side);
    // A "private" report from an old account hides it at once.
    await report(db, "b", { kind: "post", id: hidden.id, reason: "private" }, T0, side);
    expect(db.club.posts.find((p) => p.id === hidden.id)?.hiddenAt).toBeTruthy();
    const { post: other } = await createPost(db, "a", { body: "second" }, at(1), side);
    await report(db, "b", { kind: "post", id: other.id, reason: "spam" }, at(1), side);
    const r = db.club.reports.find((x) => x.targetId === String(other.id))!;
    await moderate(db, { reportId: r.id, action: "ban", hideAll: true }, at(2), side);
    kept(img(db, first));
  });

  it("the clean-up keeps a reported reply's picture when its thread was deleted", async () => {
    const { db } = await pair();
    await poster(db, "c");
    const { post } = await createPost(db, "a", { body: "root" }, T0, side);
    const pic = await upload(db, "c");
    const { post: reply } = await createPost(db, "c", { body: "reply", parentId: post.id, imageId: pic }, T0, side);
    await report(db, "b", { kind: "post", id: reply.id, reason: "sexual" }, T0, side);
    await deletePost(db, "a", post.id, T0);
    await purgeImages(db, at(25 * 60));
    kept(img(db, pic));
  });
});

describe("3. decoding memory", () => {
  it("decodes at most 2 pictures at once", async () => {
    const pics = await Promise.all([1, 2, 3, 4, 5].map(() => jpeg(800, 600)));
    let most = 0;
    const timer = setInterval(() => (most = Math.max(most, decoding())), 0);
    const jobs = pics.map((p) => toWebp(p));
    most = Math.max(most, decoding());
    await Promise.all(jobs);
    clearInterval(timer);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(2);
  });

  it("refuses a picture over 24 MP", async () => {
    expect(MAX_PIXELS).toBe(24_000_000);
    const huge = new Uint8Array(
      await sharp({ create: { width: 6000, height: 4500, channels: 3, background: "#fff" } })
        .png()
        .toBuffer(),
    );
    await expect(toWebp(huge)).rejects.toThrow();
  });

  it("counts the real bytes, whatever content-length says", async () => {
    const body = new Uint8Array(2000);
    const lying = new Request("http://x/", { method: "POST", body, headers: { "content-length": "10" } });
    expect(await readCapped(lying, 1000)).toBeNull();
    const fine = new Request("http://x/", { method: "POST", body: new Uint8Array(500) });
    expect((await readCapped(fine, 1000))?.length).toBe(500);
  });
});

describe("4. the daily picture cap", () => {
  it("deleting a post doesn't give a picture back, and two uploads at the cap can't both pass", async () => {
    const db = memoryDb();
    await poster(db, "a");
    for (let i = 0; i < LIMITS.pictures.perDay - 2; i++) await upload(db, "a");
    const imageId = await upload(db, "a");
    const { post } = await createPost(db, "a", { body: "x", imageId }, T0, side);
    await deletePost(db, "a", post.id, T0);
    const both = await Promise.allSettled([upload(db, "a"), upload(db, "a")]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(upload(db, "a")).rejects.toThrow(CLUB_COPY.tooManyPictures);
  });
});

describe("5 and the unread dot: groups", () => {
  async function group() {
    const db = memoryDb();
    await poster(db, "a");
    for (const u of ["b", "c", "d"]) {
      await joinAs(db, u);
      await follow(db, u, { handle: "aaa" }, T0, side);
      await follow(db, "a", { handle: u.repeat(3) }, T0, side);
    }
    const { chatId } = await createGroup(db, "a", { title: "Shop owners", handles: ["bbb", "ccc"] }, T0, side);
    return { db, chatId };
  }

  it("adding is capped with the chat locked (two adds at once can't pass 20)", async () => {
    const { db, chatId } = await group();
    for (let i = 0; i < 17; i++)
      db.club.members.push({ chatId, userId: `x${i}`, state: "active", lastReadId: 0, clearedId: 0, activeAt: null });
    expect(await db.addMember(chatId, "d", 20)).toBe(false);
    expect(await db.addMember(chatId, "e", 21)).toBe(true);
  });

  it("at most 20 adds and removes a minute in one group", async () => {
    const { db, chatId } = await group();
    const now = at(5);
    for (let i = 0; i < 10; i++) {
      await addToGroup(db, "a", chatId, { handle: "ddd" }, now, side);
      await removeFromGroup(db, "a", chatId, { handle: "ddd" }, now, side);
    }
    await expect(addToGroup(db, "a", chatId, { handle: "ddd" }, now, side)).rejects.toThrow(CLUB_COPY.slowDown);
    await addToGroup(db, "a", chatId, { handle: "ddd" }, at(7), side);
  });

  it("a blocked player's last message doesn't show as unread", async () => {
    const { db, chatId } = await group();
    await block(db, "c", { handle: "bbb" }, T0);
    await db.setMember(chatId, "c", { lastReadId: await db.lastMessageId(chatId) }); // c read "a made this group"
    await say(db, "b", chatId, { body: "hello" });
    expect((await chats(db, "c", "active", null)).chats[0].unread).toBe(false);
    expect((await db.unreadChats("c")).chats).toBe(0);
  });
});

describe("6. Keep after Remove", () => {
  it("brings the picture back to its owner and the post", async () => {
    const { db } = await pair();
    const imageId = await upload(db, "a");
    const { post } = await createPost(db, "a", { body: "Look", imageId }, T0, side);
    await report(db, "b", { kind: "post", id: post.id, reason: "spam" }, T0, side);
    const r = db.club.reports[0];
    await moderate(db, { reportId: r.id, action: "remove" }, T0, side);
    expect(img(db, imageId)?.ownerId).toBeNull();
    await moderate(db, { reportId: r.id, action: "keep" }, at(1), side);
    expect(img(db, imageId)).toMatchObject({ ownerId: "a", path: `a/${imageId}.webp`, keepUntil: null });
    expect((await thread(db, "b", post.id, 0, at(2))).post.image?.url).toMatch(/^data:/);
  });
});

describe("7. the clean-up", () => {
  it("stops after 10 rounds even if nothing can be deleted", async () => {
    const db = memoryDb();
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: `id-${i}`,
      ownerId: null,
      path: `removed/${i}.webp`,
      width: 1,
      height: 1,
      usedBy: null,
      keepUntil: "2000-01-01T00:00:00Z",
      createdAt: "2000-01-01T00:00:00Z",
    }));
    const stale = vi.fn(async () => rows as ImageRow[]);
    db.staleImages = stale;
    await purgeImages(db, T0);
    expect(stale).toHaveBeenCalledTimes(10);
  });
});

describe("8. copy", () => {
  it("says HEIC doesn't work yet", () => {
    expect(CLUB_COPY.pictureType).toMatch(/HEIC/);
  });
});

it("a moderator's view of a chat picture still works after the reviewer's fixes", async () => {
  const { db, chatId } = await pair();
  const imageId = await upload(db, "a", chatId);
  await say(db, "a", chatId, { imageId });
  expect((await readChat(db, "b", chatId, {}, T0)).messages[0].image?.url).toMatch(/^data:/);
});
