// The Club, step 3 (spec §9.4): pictures and group chats, against memoryDb (its bucket is a Map) with a fake Live.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLUB_COPY, LIMITS, POST_RANK, type LiveEvent, type MessageView } from "../community";
import { fresh } from "../game-state";
import {
  accept,
  addToGroup,
  block,
  chats,
  ClubGateError,
  createGroup,
  createPost,
  deletePost,
  follow,
  join,
  leave,
  leaveGroup,
  moderate,
  mutualList,
  purgeImages,
  queue,
  readChat,
  removeFromGroup,
  report,
  sendMessage,
  startChat,
  thread,
  uploadImage,
  type Side,
} from "./club";
import { pictureKind } from "./club-image";
import { courseOutline } from "./content";
import { memoryDb } from "./db";
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
  const pushes: { user: string; title: string; body: string }[] = [];
  const events: { userId: string; e: LiveEvent }[] = [];
  const send: Send = async (row, msg) => (pushes.push({ user: row.userId, title: msg.title, body: msg.body }), "sent");
  const side: Side = { send, later: (t) => void tasks.push(t()), live: async (list) => void events.push(...list) };
  return { side, pushes, events, settle: () => Promise.all(tasks) };
}
const gate = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof ClubGateError) return e.can;
    throw e;
  }
  return "ok";
};

/** A JPEG `w` × `h` stored sideways (EXIF orientation 6) with a GPS location, as a phone camera writes it. */
const cameraJpeg = (w = 300, h = 200) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 30 } } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "18/1 31/1 0/1" } })
    .toBuffer()
    .then((b) => new Uint8Array(b));
const upload = async (db: Mem, u: string, bytes?: Uint8Array, chat?: number, now = T0) =>
  uploadImage(db, u, chat ? String(chat) : null, async () => bytes ?? (await cameraJpeg()), now);
let n = 0;
const say = (db: Mem, u: string, chatId: number, body: Record<string, unknown>, side: Side, when = T0) =>
  sendMessage(db, u, chatId, { clientId: `c${++n}`, ...body }, when, side);

beforeEach(() => vi.stubEnv("MODERATOR_USER_IDS", ""));
afterEach(() => vi.unstubAllEnvs());

describe("uploading a picture", () => {
  it("comes out upright WebP, at most 1080 px, with no EXIF or location", async () => {
    const db = memoryDb();
    await poster(db, "a");
    const r = await upload(db, "a");
    expect([r.width, r.height]).toEqual([200, 300]); // turned upright
    const img = db.club.images[0];
    expect(img.path).toBe(`a/${r.imageId}.webp`);
    const meta = await sharp(db.club.stored.get(img.path)!).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();

    const big = new Uint8Array(
      await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#fff" } })
        .png()
        .toBuffer(),
    );
    expect(await upload(db, "a", big)).toMatchObject({ width: 1080, height: 720 });
  });

  it("refuses files over 5 MB and anything that isn't JPEG, PNG or WebP by its bytes", async () => {
    const db = memoryDb();
    await poster(db, "a");
    const huge = new Uint8Array(6 * 1024 * 1024);
    huge.set([0xff, 0xd8, 0xff]);
    await expect(upload(db, "a", huge)).rejects.toThrow(CLUB_COPY.pictureTooBig);
    const gif = new Uint8Array(
      await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } })
        .gif()
        .toBuffer(),
    );
    expect(pictureKind(gif)).toBeNull(); // whatever it's called, a GIF is a GIF
    await expect(upload(db, "a", gif)).rejects.toThrow(CLUB_COPY.pictureType);
    await expect(upload(db, "a", new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]))).rejects.toThrow(CLUB_COPY.pictureType); // broken
    expect(db.club.images).toEqual([]);
  });

  it("needs the posting gate (or an active chat), and stops at 20 a day", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    expect(await gate(upload(db, "b"))).toBe("pay");
    // b, free, can add a picture in a chat a member started with them (and b accepted).
    const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
    await expect(upload(db, "b", undefined, chatId)).rejects.toThrow(CLUB_COPY.notSent);
    await accept(db, "b", chatId, T0);
    expect((await upload(db, "b", undefined, chatId)).imageId).toBeTruthy();
    const small = await cameraJpeg(20, 20);
    for (let i = 1; i < LIMITS.pictures.perDay; i++) await upload(db, "b", small, chatId);
    await expect(upload(db, "b", small, chatId)).rejects.toThrow(CLUB_COPY.tooManyPictures);
  });
});

describe("pictures in posts", () => {
  it("shows the picture to readers as a signed URL", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    const { imageId } = await upload(db, "a");
    const { post } = await createPost(db, "a", { body: "My new shop sign", imageId }, T0, fakeSide().side);
    expect(post.image).toMatchObject({ width: 200, height: 300 });
    const seen = await thread(db, "b", post.id, 0, T0);
    expect(seen.post.image?.url).toMatch(/^data:image\/webp;base64,/);
  });

  it("refuses another player's picture, a used one, and one over an hour old", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await poster(db, "c");
    const side = fakeSide().side;
    const mine = await upload(db, "a");
    const theirs = await upload(db, "c");
    await expect(createPost(db, "a", { body: "hi", imageId: theirs.imageId }, T0, side)).rejects.toThrow(CLUB_COPY.pictureGone);
    await createPost(db, "a", { body: "first", imageId: mine.imageId }, T0, side);
    await expect(createPost(db, "a", { body: "again", imageId: mine.imageId }, at(1), side)).rejects.toThrow(CLUB_COPY.pictureGone);
    const old = await upload(db, "c");
    await expect(createPost(db, "c", { body: "late", imageId: old.imageId }, at(61), side)).rejects.toThrow(CLUB_COPY.pictureGone);
    await expect(createPost(db, "c", { body: "bad", imageId: "../x" }, T0, side)).rejects.toThrow(CLUB_COPY.pictureGone);
  });

  it("works in replies, and deleting the post deletes its picture", async () => {
    const db = memoryDb();
    await poster(db, "a");
    const side = fakeSide().side;
    const { post } = await createPost(db, "a", { body: "Root" }, T0, side);
    const { imageId } = await upload(db, "a");
    const { post: reply } = await createPost(db, "a", { body: "A reply", parentId: post.id, imageId }, at(1), side);
    expect(reply.image).toBeTruthy();
    await deletePost(db, "a", reply.id);
    expect(db.club.images).toEqual([]);
    expect(db.club.stored.size).toBe(0);
  });
});

describe("pictures in chats", () => {
  it("can be sent alone; in a request it waits until the receiver accepts", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b"); // b doesn't follow a: a request
    const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
    const s = fakeSide();
    const { imageId } = await upload(db, "a", undefined, chatId);
    const r = await say(db, "a", chatId, { imageId }, s.side);
    expect(r.message).toMatchObject({ body: "", image: { width: 200 } });
    await s.settle();
    const toB = s.events.find((e) => e.userId === "b")!.e.payload as { message: MessageView };
    expect(toB.message.image).toBeUndefined();
    expect(toB.message.imageHidden).toBe(true);
    expect((await chats(db, "b", "request", null)).chats[0].last?.body).toBe(CLUB_COPY.picture);
    expect((await readChat(db, "b", chatId, {}, T0)).messages[0]).toMatchObject({ imageHidden: true });
    await accept(db, "b", chatId, T0);
    expect((await readChat(db, "b", chatId, {}, T0)).messages[0].image?.url).toMatch(/^data:/);
  });

  it("a held message's picture reaches nobody but the sender", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
    const s = fakeSide();
    const { imageId } = await upload(db, "a", undefined, chatId);
    const r = await say(db, "a", chatId, { body: "see shop.in", imageId }, s.side);
    await s.settle();
    expect(r.message.image).toBeTruthy(); // the sender sees their own
    expect(s.events.filter((e) => e.userId === "b")).toEqual([]);
    expect((await readChat(db, "b", chatId, {}, T0)).messages).toEqual([]);
  });

  it("a message needs text or a picture", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    const { chatId } = await startChat(db, "a", { handle: "bbb" }, T0);
    await expect(say(db, "a", chatId, { body: " " }, fakeSide().side)).rejects.toThrow(CLUB_COPY.error);
  });
});

describe("reports, moderation and deleting", () => {
  it("moderators see the picture; removing it keeps it 180 days apart from the owner, then the clean-up deletes it", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await joinAs(db, "b");
    const side = fakeSide().side;
    const { imageId } = await upload(db, "a");
    const { post } = await createPost(db, "a", { body: "Look", imageId }, T0, side);
    await report(db, "b", { kind: "post", id: post.id, reason: "sexual" }, T0, side);
    const q = await queue(db, T0);
    expect(q.open[0].imageUrl).toMatch(/^data:image\/webp/);
    await moderate(db, { reportId: q.open[0].id, action: "remove" }, T0);
    expect([...db.club.stored.keys()]).toEqual([`removed/${imageId}.webp`]);
    expect((await queue(db, T0)).done[0].imageUrl).toMatch(/^data:/);
    // The owner leaving or deleting the account doesn't touch it; the clean-up does after 180 days.
    await db.deleteUser("a");
    expect(db.club.stored.size).toBe(1);
    vi.useFakeTimers({ now: at(181 * 24 * 60), toFake: ["Date"] });
    await purgeImages(db, at(181 * 24 * 60));
    vi.useRealTimers();
    expect(db.club.stored.size).toBe(0);
    expect(db.club.images).toEqual([]);
  });

  it("deleting the account or leaving the Club deletes the player's pictures from storage", async () => {
    const db = memoryDb();
    await poster(db, "a");
    await poster(db, "c");
    const side = fakeSide().side;
    await createPost(db, "a", { body: "One", imageId: (await upload(db, "a")).imageId }, T0, side);
    await upload(db, "c");
    await db.deleteUser("a");
    expect([...db.club.stored.keys()].every((k) => k.startsWith("c/"))).toBe(true);
    await leave(db, "c", T0);
    expect(db.club.stored.size).toBe(0);
    expect(db.club.images).toEqual([]);
  });

  it("the clean-up deletes pictures never used after a day, and keeps used ones", async () => {
    const db = memoryDb();
    await poster(db, "a");
    const used = await upload(db, "a");
    await createPost(db, "a", { body: "Kept", imageId: used.imageId }, T0, fakeSide().side);
    await upload(db, "a");
    expect(await purgeImages(db, at(60))).toEqual({ images: 0 });
    expect(await purgeImages(db, at(25 * 60))).toEqual({ images: 1 });
    expect(db.club.images.map((i) => i.id)).toEqual([used.imageId]);
  });
});

describe("group chats", () => {
  /** a (member at Trader) follows each other with b, c and d; e follows a only. */
  async function crowd() {
    const db = memoryDb();
    await poster(db, "a");
    const s = fakeSide();
    for (const u of ["b", "c", "d", "e"]) {
      await joinAs(db, u);
      await follow(db, u, { handle: "aaa" }, T0, s.side);
      if (u !== "e") await follow(db, "a", { handle: hd(u) }, T0, s.side);
    }
    return db;
  }

  it("is made from 2 to 19 people who follow each other with the maker", async () => {
    const db = await crowd();
    const s = fakeSide();
    expect((await mutualList(db, "a")).people.map((p) => p.handle)).toEqual(["bbb", "ccc", "ddd"]);
    await expect(createGroup(db, "a", { title: "Pune sellers", handles: ["bbb"] }, T0, s.side)).rejects.toThrow(
      CLUB_COPY.pickPeople(2, 19),
    );
    await expect(createGroup(db, "a", { title: "Pune sellers", handles: ["bbb", "eee"] }, T0, s.side)).rejects.toThrow(
      CLUB_COPY.mutualOnly,
    );
    await expect(createGroup(db, "a", { title: "Join my group on telegram", handles: ["bbb", "ccc"] }, T0, s.side)).rejects.toThrow(
      CLUB_COPY.groupNameLinks,
    );
    expect(await gate(createGroup(db, "b", { title: "Mine", handles: ["aaa", "ccc"] }, T0, s.side))).toBe("pay");
    const { chatId } = await createGroup(db, "a", { title: "Pune sellers", handles: ["bbb", "@CCC"] }, T0, s.side);
    const inbox = (await chats(db, "b", "active", null)).chats[0];
    expect(inbox).toMatchObject({ title: "Pune sellers", with: null, last: { body: CLUB_COPY.groupCreated("A") } });
    const view = await readChat(db, "c", chatId, {}, T0);
    expect(view.chat.group?.members.map((m) => m.handle).sort()).toEqual(["aaa", "bbb", "ccc"]);
    expect(view.chat.group?.admin).toBe(false);
  });

  it("fans every message out to each member, with the sender's name, and pushes without the text", async () => {
    const db = await crowd();
    const s = fakeSide();
    const { chatId } = await createGroup(db, "a", { title: "Pune sellers", handles: ["bbb", "ccc"] }, T0, s.side);
    for (const u of ["b", "c"]) {
      await db.createProfile(u, { ...fresh(), lastActiveDay: "2026-11-07" });
      await db.savePush({ endpoint: `https://push/${u}`, userId: u, keys: { p256dh: "k", auth: "a" }, remindHour: 19 });
    }
    const t = fakeSide();
    await say(db, "b", chatId, { body: "Hello all" }, t.side, at(5)); // b is free: members can talk in a group
    await t.settle();
    expect(t.events.map((e) => e.userId).sort()).toEqual(["a", "b", "c"]);
    const toC = t.events.find((e) => e.userId === "c")!.e.payload as { message: MessageView };
    expect(toC.message.from).toEqual({ handle: "bbb", name: "B" });
    expect(t.pushes).toEqual([{ user: "c", title: "Pune sellers", body: CLUB_COPY.pushGroupMessage("B") }]);
  });

  it("the maker adds and removes; anyone leaves; 20 people at most", async () => {
    const db = await crowd();
    const s = fakeSide();
    const { chatId } = await createGroup(db, "a", { title: "Pune sellers", handles: ["bbb", "ccc"] }, T0, s.side);
    await say(db, "b", chatId, { body: "before d" }, s.side);
    await expect(addToGroup(db, "b", chatId, { handle: "ddd" }, T0, s.side)).rejects.toThrow(CLUB_COPY.onlyMaker);
    await addToGroup(db, "a", chatId, { handle: "ddd" }, T0, s.side);
    const d = await readChat(db, "d", chatId, {}, T0);
    expect(d.messages.map((m) => m.event ?? m.body)).toEqual(["added"]); // nothing from before they joined
    await removeFromGroup(db, "a", chatId, { handle: "ccc" }, T0, s.side);
    await expect(readChat(db, "c", chatId, {}, T0)).rejects.toThrow(CLUB_COPY.chatGone);
    await leaveGroup(db, "b", chatId, T0, s.side);
    await expect(say(db, "b", chatId, { body: "hi" }, s.side)).rejects.toThrow(CLUB_COPY.notSent);
    const a = await readChat(db, "a", chatId, {}, T0);
    expect(a.chat.group?.members.map((m) => m.handle).sort()).toEqual(["aaa", "ddd"]);
    expect(a.messages.filter((m) => m.event).map((m) => m.event)).toEqual(["created", "added", "removed", "left"]);

    // Full at 20.
    for (let i = 0; i < 18; i++)
      db.club.members.push({ chatId, userId: `x${i}`, state: "active", lastReadId: 0, clearedId: 0, activeAt: null });
    await expect(addToGroup(db, "a", chatId, { handle: "bbb" }, T0, s.side)).rejects.toThrow(CLUB_COPY.groupFull);
  });

  it("a block hides that player's messages in the group, and they can't be reported", async () => {
    const db = await crowd();
    const s = fakeSide();
    const { chatId } = await createGroup(db, "a", { title: "Pune sellers", handles: ["bbb", "ccc"] }, T0, s.side);
    const { message } = await say(db, "b", chatId, { body: "from b" }, s.side);
    await block(db, "c", { handle: "bbb" }, T0);
    expect((await readChat(db, "c", chatId, {}, T0)).messages.map((m) => m.body)).not.toContain("from b");
    await expect(report(db, "c", { kind: "message", id: message.id, reason: "spam" }, T0, s.side)).rejects.toThrow(CLUB_COPY.notFound);
    await report(db, "a", { kind: "message", id: message.id, reason: "spam" }, T0, s.side);
    expect(db.club.reports).toHaveLength(1);
  });
});
