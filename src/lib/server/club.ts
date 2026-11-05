// The Club on the server (docs/superpowers/specs/2026-11-04-community-design.md): joining, posts, replies, likes,
// follows, blocks, reports, activity and moderation (step 1), chats (step 2), pictures and group chats (step 3).
// Every check runs here; the phone only shows what comes back. Players are named by handle, never by id. Pushes go
// through `side` so the reply never waits on them.
import { randomUUID } from "node:crypto";
import { isMember } from "../access.ts";
import type { Career } from "../career.ts";
import {
  autoFlag,
  bannedAt,
  canInteract,
  canPost,
  checkHandle,
  CLUB_COPY,
  FEED_DAYS,
  groupLine,
  LIMITS,
  rankForYou,
  reasonLabel,
  reservedName,
  REPORT_REASONS,
  shownStreak,
  titleOf,
  URGENT,
  type ActivityItem,
  type AuthorView,
  type Can,
  type ChatRow,
  type ChatView,
  type ClubMe,
  type LiveEvent,
  type MessageView,
  type GateInput,
  type ImageView,
  type PostView,
  type ProfileView,
  type ReportView,
} from "../community.ts";
import type { CourseOutline } from "../course-types";
import { dayDiff, today, type GameState } from "../game-state.ts";
import { courseOutline, servableHotSeat, wolfQuestion } from "./content.ts";
import { pictureKind, toWebp } from "./club-image.ts";
import type { ChatInfo, ChatMemberRow, ClubProfileRow, Db, MessageRow, PostRow, ReportRow } from "./db.ts";
import { GameError, trustedCareers } from "./game.ts";
import { realtimeLive, type Live } from "./live.ts";
import { broadcast, deliver, istHour, webPush, type Message, type Send } from "./reminders.ts";

/** The gate refused: the route answers 403 `{ error: "club", can }` so the phone opens the right nudge. */
export class ClubGateError extends Error {
  constructor(readonly can: Can) {
    super(`club: ${can}`);
  }
}

/** How slow work (pushes) runs: in `after()` in the routes, awaited in tests. */
export interface Side {
  send: Send;
  later: (task: () => Promise<unknown>) => void;
  /** Live chat events (Realtime broadcast by default). */
  live?: Live;
}
export const background: Side = {
  send: webPush,
  later: (task) => void task().catch((e) => console.error("club:", e)),
  live: realtimeLive,
};

const H = 3600_000;
const MAX_ID = Number.MAX_SAFE_INTEGER;
const PAGE = 20;
const REPLIES_PAGE = 30;
/** Club pushes have their own cap, so a busy thread never crowds out the streak reminder. */
const CLUB_CAP = 3;
/** Midnight in India, as an ISO time: daily caps count from here. */
const istMidnight = (now: Date) => new Date(`${today(now)}T00:00:00+05:30`).toISOString();
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms).toISOString();
const ROOTS: PostRow["kind"][] = ["post", "rank_up", "hotseat", "question"];

/** Trimmed, with long runs of blank lines squeezed; refused when empty or too long. */
function textOf(x: unknown, max: number, empty = CLUB_COPY.error): string {
  const t =
    typeof x === "string"
      ? x
          .replace(/\r\n?/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim()
      : "";
  if (!t || [...t].length > max) throw new GameError(empty);
  return t;
}
const optional = (x: unknown, max: number) => (x === undefined || x === "" ? "" : textOf(x, max));
const idOf = (x: unknown): number => {
  const n = typeof x === "string" ? Number(x) : x;
  if (!Number.isSafeInteger(n) || (n as number) < 1) throw new GameError(CLUB_COPY.postGone);
  return n as number;
};
const refuseContacts = (text: string) => {
  const f = autoFlag(text);
  if (f.refuse) throw new GameError(f.refuse);
};
/** Profile fields are shown to everyone with no check by a person, so links and money words are refused too. */
function checkProfile(name: string | undefined, building: string | undefined) {
  const f = autoFlag(`${name ?? ""}\n${building ?? ""}`);
  if (f.refuse) throw new GameError(f.refuse);
  if (f.hold) throw new GameError(CLUB_COPY.profileLinks);
  if (name !== undefined && reservedName(name)) throw new GameError(CLUB_COPY.reservedName);
}

/** Signed URLs for these pictures, by id. A picture a moderator removed is never served. */
async function imagesFor(db: Db, ids: (string | null)[]): Promise<Map<string, ImageView>> {
  const want = [...new Set(ids.filter((x): x is string => !!x))];
  if (!want.length) return new Map();
  const rows = (await db.imagesByIds(want)).filter((i) => i.ownerId !== null);
  const urls = await db.signFiles(rows.map((i) => i.path));
  return new Map(rows.flatMap((i) => (urls[i.path] ? [[i.id, { url: urls[i.path], width: i.width, height: i.height }]] : [])));
}

/* ------------------------------------------------------------------ */
/* Who the player is to the Club.                                      */
/* ------------------------------------------------------------------ */
const START: Career = { rank: 1, title: "Street Seller", stars: 0, maxStars: 0 };

/** The rank from the server's own records only (never a phone save). */
export async function trustedCareer(db: Db, userId: string, course: CourseOutline | undefined = courseOutline()): Promise<Career> {
  if (!course) return START;
  return (await trustedCareers(db, [userId], course))[userId] ?? START;
}

interface Me {
  userId: string;
  profile: ClubProfileRow | null;
  bannedUntil: string | null;
  /** Both directions. */
  blocked: Set<string>;
  blockedOut: Set<string>;
}

async function meOf(db: Db, userId: string): Promise<Me> {
  const [profile, ban, blocks] = await Promise.all([db.clubProfile(userId), db.clubBan(userId), db.blocks(userId)]);
  return {
    userId,
    profile,
    bannedUntil: ban?.reason === "mod" ? ban.until : null,
    blocked: new Set([...blocks.out, ...blocks.in]),
    blockedOut: blocks.out,
  };
}

async function gateOf(db: Db, me: Me, now: Date, full: boolean): Promise<GateInput & { career: Career }> {
  const [membership, career] = full ? await Promise.all([db.getMembership(me.userId), trustedCareer(db, me.userId)]) : [null, START];
  return {
    signedIn: true,
    joined: !!me.profile,
    member: isMember(membership, now),
    rank: career.rank,
    bannedUntil: me.bannedUntil,
    career,
  };
}

async function mustInteract(db: Db, me: Me, now: Date) {
  const c = canInteract(await gateOf(db, me, now, false), now);
  if (c !== "ok") throw new ClubGateError(c);
}

/* ------------------------------------------------------------------ */
/* What the phone sees.                                                */
/* ------------------------------------------------------------------ */
const authorOf = (p: ClubProfileRow, now: Date): AuthorView => ({
  handle: p.handle,
  name: p.name,
  title: titleOf(p.rank),
  stars: p.stars,
  maxStars: p.maxStars,
  streak: shownStreak(p.streak, p.streakDay, today(now)),
});

/**
 * Whether `me` may see this post (not its author's hidden profile or its thread's Hot Seat rule; see `readable`). The
 * Wolf's posts are never hidden: no report can take down today's question or a Hot Seat thread.
 */
const visibleTo = (p: PostRow, me: Me) =>
  (!p.hiddenAt || p.authorId === null) && (!p.held || p.authorId === me.userId) && !(p.authorId && me.blocked.has(p.authorId));

/** Posts as the phone sees them, leaving out any `me` mustn't see (hidden, held, blocked, or a hidden author). */
async function viewsOf(db: Db, me: Me, posts: PostRow[], now: Date): Promise<PostView[]> {
  const shown = posts.filter((p) => visibleTo(p, me));
  const ids = [...new Set(shown.flatMap((p) => (p.authorId ? [p.authorId] : [])))];
  const [authors, liked, images] = await Promise.all([
    db.clubProfiles(ids),
    db.likedOf(
      me.userId,
      shown.map((p) => p.id),
    ),
    imagesFor(
      db,
      shown.map((p) => p.imageId),
    ),
  ]);
  const byId = new Map(authors.map((a) => [a.userId, a]));
  return shown.flatMap((p) => {
    const a = p.authorId ? byId.get(p.authorId) : null;
    if (p.authorId && (!a || (a.hiddenAt && a.userId !== me.userId))) return [];
    const image = p.imageId ? images.get(p.imageId) : undefined;
    return [
      {
        id: p.id,
        kind: p.kind,
        body: p.body,
        createdAt: p.createdAt,
        likes: p.likeCount,
        replies: p.replyCount,
        liked: liked.has(p.id),
        mine: p.authorId === me.userId,
        held: !!p.held && p.authorId === me.userId,
        author: a ? authorOf(a, now) : null,
        ...(image ? { image } : {}),
      },
    ];
  });
}

async function profileView(db: Db, me: Me, p: ClubProfileRow, now: Date): Promise<ProfileView> {
  const mine = p.userId === me.userId;
  const [counts, youFollow, followsYou] = await Promise.all([
    db.followCounts(p.userId),
    mine ? false : db.follows(me.userId, p.userId),
    mine ? false : db.follows(p.userId, me.userId),
  ]);
  return {
    handle: p.handle,
    name: p.name,
    building: p.building,
    title: titleOf(p.rank),
    rank: p.rank,
    stars: p.stars,
    maxStars: p.maxStars,
    streak: shownStreak(p.streak, p.streakDay, today(now)),
    ...counts,
    youFollow,
    followsYou,
    blocked: me.blockedOut.has(p.userId),
    mine,
    ...(mine ? { milestones: p.milestones } : {}),
  };
}

/**
 * A post `me` may read, with its thread's root: refused ("isn't there any more") when hidden, held or blocked, and
 * for a Hot Seat thread until the player has finished that Hot Seat.
 */
async function readable(db: Db, me: Me, id: number): Promise<{ post: PostRow; root: PostRow }> {
  const post = await db.getPost(id);
  const root = post?.parentId ? await db.getPost(post.parentId) : post;
  if (!post || !root || !visibleTo(post, me) || !visibleTo(root, me)) throw new GameError(CLUB_COPY.postGone);
  // A hidden profile's posts are out of every list; they can't be liked, replied to or reported either.
  const authors = [...new Set([post.authorId, root.authorId])].filter((a): a is string => !!a && a !== me.userId);
  const found = await db.clubProfiles(authors);
  if (found.length < authors.length || found.some((a) => a.hiddenAt)) throw new GameError(CLUB_COPY.postGone);
  if (root.kind === "hotseat" && !(await db.countRuns(me.userId, root.ref ?? ""))) throw new GameError(CLUB_COPY.hotSeatLocked);
  return { post, root };
}

/* ------------------------------------------------------------------ */
/* Pushes.                                                             */
/* ------------------------------------------------------------------ */
async function clubPush(db: Db, userId: string, msg: Message & { kind: string }, send: Send, now: Date) {
  const phones = await db.pushes(userId);
  if (!phones.length) return;
  // Like the game's reminders: nothing at all after a player has been away for over a week.
  const last = (await db.getProfile(userId))?.state.lastActiveDay;
  if (!last || dayDiff(last, today(now)) > 7) return;
  await deliver(
    db,
    userId,
    phones,
    msg,
    send,
    now,
    { sent: 0, gone: 0, failed: 0 },
    {
      count: (u, d) => db.clubNoticesOn(u, d),
      max: CLUB_CAP,
    },
  );
}

/** A new report: a push to each moderator's phones (MODERATOR_USER_IDS), with no guardrails, like /admin/notify. */
async function tellModerators(db: Db, reason: string, send: Send) {
  const ids = (process.env.MODERATOR_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const msg = {
    title: CLUB_COPY.pushReport(reasonLabel(reason)),
    body: CLUB_COPY.pushReportBody(URGENT.includes(reason)),
    url: "/admin/club",
    tag: "club-report",
  };
  for (const id of ids) await broadcast(db, msg, id, send);
}

/* ------------------------------------------------------------------ */
/* Joining, the player's own profile, leaving.                        */
/* ------------------------------------------------------------------ */
export async function me(db: Db, userId: string, now = new Date()): Promise<ClubMe> {
  const m = await meOf(db, userId);
  const g = await gateOf(db, m, now, true);
  if (m.profile) await refreshCareer(db, userId, now, g.career);
  const profile = m.profile && (await db.clubProfile(userId));
  return {
    ...(profile ? { profile: await profileView(db, m, profile, now) } : {}),
    can: { post: canPost(g, now), interact: canInteract(g, now) },
    title: g.career.title,
    rank: g.career.rank,
    ...(bannedAt(m.bannedUntil, now) ? { bannedUntil: m.bannedUntil! } : {}),
    badge: await badge(db, userId),
  };
}

export async function badge(db: Db, userId: string) {
  if (!(await db.clubProfile(userId))) return { activity: 0, chats: 0, requests: 0 };
  const [activity, unread] = await Promise.all([db.unseenActivity(userId), db.unreadChats(userId)]);
  return { activity, ...unread };
}

const nameOf = (x: unknown) => {
  const name = textOf(x, LIMITS.nameLength, CLUB_COPY.badName);
  if (name.toLowerCase() === "you" || name.includes("\n")) throw new GameError(CLUB_COPY.badName);
  return name;
};

export async function join(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  if (body.adult !== true) throw new GameError(CLUB_COPY.under18);
  if (body.rules !== true) throw new GameError(CLUB_COPY.mustAgree);
  const h = checkHandle(body.handle);
  if ("error" in h) throw new GameError(h.error);
  const name = nameOf(body.name);
  const building = optional(body.building, LIMITS.buildingLength);
  refuseContacts(h.handle);
  checkProfile(name, building);
  const existing = await db.clubProfile(userId);
  if (!existing) {
    const ban = await db.clubBan(userId);
    // 4: a banned player can't leave and join again to undo a hidden profile.
    if (ban?.reason === "mod" && bannedAt(ban.until, now)) throw new ClubGateError("banned");
    if (ban?.reason === "left" && bannedAt(ban.until, now)) throw new GameError(CLUB_COPY.rejoinWait);
    const [career, game] = await Promise.all([trustedCareer(db, userId), db.getProfile(userId)]);
    const at = now.toISOString();
    const ok = await db.insertClubProfile({
      userId,
      handle: h.handle,
      name,
      building,
      rank: career.rank,
      stars: career.stars,
      maxStars: career.maxStars,
      streak: game?.state.streak ?? 0,
      streakDay: game?.state.lastActiveDay ?? null,
      milestones: true,
      adultAt: at,
      rulesAt: at,
      hiddenAt: null,
      createdAt: at,
    });
    if (!ok) throw new GameError(CLUB_COPY.handleTaken);
  }
  const m = await meOf(db, userId);
  return { profile: await profileView(db, m, m.profile!, now) };
}

export async function updateMe(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const patch: Partial<ClubProfileRow> = {};
  if (body.name !== undefined) patch.name = nameOf(body.name);
  if (body.building !== undefined) patch.building = optional(body.building, LIMITS.buildingLength);
  if (typeof body.milestones === "boolean") patch.milestones = body.milestones;
  checkProfile(patch.name, patch.building);
  await db.updateClubProfile(userId, patch);
  const p = (await db.clubProfile(userId))!;
  return { profile: await profileView(db, m, p, now) };
}

/** "Leave the Club": everything goes, and joining again waits a day (a moderator's ban stays as it is). */
export async function leave(db: Db, userId: string, now = new Date()) {
  const m = await meOf(db, userId);
  if (!m.profile) throw new ClubGateError("join");
  // Storage doesn't cascade. Pictures that are evidence (an open report, hidden content) are kept apart first.
  await keepEvidence(db, userId, now);
  await db.removeFolder(userId);
  await db.deleteClubProfile(userId);
  if (!bannedAt(m.bannedUntil, now)) await db.setClubBan(userId, new Date(now.getTime() + LIMITS.newMs).toISOString(), "left");
  return { left: true };
}

/* ------------------------------------------------------------------ */
/* Keeping title and streak on the profile (called from game.ts).      */
/* ------------------------------------------------------------------ */
/** After any saved change: copy the streak to the Club profile when it moved (a no-op for players who haven't joined). */
export async function afterSave(db: Db, userId: string, before: GameState, next: GameState) {
  if (before.streak === next.streak && before.lastActiveDay === next.lastActiveDay) return;
  await db.updateClubProfile(userId, { streak: next.streak, streakDay: next.lastActiveDay });
}

/**
 * After a lesson, test-out or Hot Seat the server recorded: refresh the shown title from the server's records, and
 * post the rank-up once when it went up and the player shares milestones. Never run from a guest import.
 */
export async function refreshCareer(db: Db, userId: string, now = new Date(), known?: Career) {
  const p = await db.clubProfile(userId);
  if (!p) return;
  const c = known ?? (await trustedCareer(db, userId));
  if (c.rank === p.rank && c.stars === p.stars && c.maxStars === p.maxStars) return;
  await db.updateClubProfile(userId, { rank: c.rank, stars: c.stars, maxStars: c.maxStars });
  if (c.rank > p.rank && p.milestones)
    await db.insertPost({
      authorId: userId,
      kind: "rank_up",
      ref: String(c.rank),
      parentId: null,
      body: CLUB_COPY.rankUp(p.name, c.title),
      held: null,
      hiddenAt: null,
      createdAt: now.toISOString(),
    });
}

/* ------------------------------------------------------------------ */
/* Reading.                                                            */
/* ------------------------------------------------------------------ */
/** Today's Wolf question, created on the first read of the IST day. */
async function todaysQuestion(db: Db, now: Date): Promise<PostRow | null> {
  const day = today(now);
  const text = wolfQuestion(day);
  if (!text) return null;
  return (
    (await db.wolfPost("question", day)) ??
    (await db.insertPost({
      authorId: null,
      kind: "question",
      ref: day,
      parentId: null,
      body: text,
      held: null,
      hiddenAt: null,
      createdAt: now.toISOString(),
    })) ??
    (await db.wolfPost("question", day))
  );
}

/** Feed candidates per page; also the most ids a cursor carries. */
const CANDIDATES = 300;
const cursorOut = (asOf: string, seen: number[]) => Buffer.from(JSON.stringify({ asOf, seen })).toString("base64url");
function cursorIn(s: string | null): { asOf: string; seen: number[] } | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, "base64url").toString());
    if (
      typeof c.asOf === "string" &&
      !Number.isNaN(Date.parse(c.asOf)) &&
      Array.isArray(c.seen) &&
      c.seen.length <= CANDIDATES &&
      c.seen.every((x: unknown) => Number.isSafeInteger(x))
    )
      return c;
  } catch {
    /* a bad cursor reads as page 1 */
  }
  return null;
}

export async function feed(db: Db, userId: string, q: { tab: string | null; cursor: string | null }, now = new Date()) {
  const m = await meOf(db, userId);
  const following = q.tab === "following";
  const c = following ? null : cursorIn(q.cursor);
  const first = following ? !q.cursor : !c;
  const pinned = first ? await todaysQuestion(db, now) : null;
  const question = pinned ? (await viewsOf(db, m, [pinned], now))[0] : undefined;
  if (following) {
    const before = q.cursor ? idOf(q.cursor) : MAX_ID;
    const rows = await db.followingFeed(userId, before, PAGE);
    const posts = await viewsOf(db, m, rows, now);
    return { question, posts, ...(rows.length === PAGE ? { cursor: String(rows.at(-1)!.id) } : {}) };
  }
  const asOf = c?.asOf ?? now.toISOString();
  const seen = new Set(c?.seen ?? []);
  const candidates = (await db.feedCandidates(ago(new Date(asOf), FEED_DAYS * 24 * H), asOf, CANDIDATES)).filter(
    (p) => !(p.authorId && m.blocked.has(p.authorId)),
  );
  const follows = await db.followedAmong(userId, [...new Set(candidates.flatMap((p) => (p.authorId ? [p.authorId] : [])))]);
  const left = rankForYou(candidates, { follows }, new Date(asOf)).filter((p) => !seen.has(p.id));
  const page = left.slice(0, PAGE);
  const posts = await viewsOf(db, m, page, now);
  const served = [...seen, ...page.map((p) => p.id)];
  return { question, posts, ...(left.length > PAGE ? { cursor: cursorOut(asOf, served) } : {}) };
}

export async function thread(db: Db, userId: string, id: unknown, after: unknown, now = new Date()) {
  const m = await meOf(db, userId);
  const { root } = await readable(db, m, idOf(id));
  const from = Number(after) > 0 ? idOf(after) : 0;
  const rows = await db.replies(root.id, from, REPLIES_PAGE);
  const [post] = await viewsOf(db, m, [root], now);
  if (!post) throw new GameError(CLUB_COPY.postGone);
  return { post, replies: await viewsOf(db, m, rows, now), ...(rows.length === REPLIES_PAGE ? { after: rows.at(-1)!.id } : {}) };
}

/** A Hot Seat's thread, for players who finished it. The Wolf's opening post is made on first use. */
export async function hotSeatThread(db: Db, userId: string, hotSeatId: string, now = new Date()) {
  const hs = servableHotSeat(hotSeatId);
  if (!hs) throw new GameError(CLUB_COPY.postGone);
  if (!(await db.countRuns(userId, hs.id))) throw new GameError(CLUB_COPY.hotSeatLocked);
  const root =
    (await db.wolfPost("hotseat", hs.id)) ??
    (await db.insertPost({
      authorId: null,
      kind: "hotseat",
      ref: hs.id,
      parentId: null,
      body: CLUB_COPY.hotSeatPost,
      held: null,
      hiddenAt: null,
      createdAt: now.toISOString(),
    })) ??
    (await db.wolfPost("hotseat", hs.id));
  return { company: hs.company, ...(await thread(db, userId, root!.id, 0, now)) };
}

export async function userProfile(db: Db, userId: string, handle: string, before: unknown, now = new Date()) {
  const m = await meOf(db, userId);
  const h = checkHandle(handle);
  const p = "handle" in h ? await db.clubProfileByHandle(h.handle) : null;
  if (!p) throw new GameError(CLUB_COPY.notFound);
  const mine = p.userId === userId;
  if (!mine && (p.hiddenAt || (m.blocked.has(p.userId) && !m.blockedOut.has(p.userId)))) throw new GameError(CLUB_COPY.unavailable);
  const profile = await profileView(db, m, p, now);
  if (profile.blocked) return { ...profile, posts: [] };
  const rows = await db.postsBy(p.userId, before ? idOf(before) : MAX_ID, PAGE);
  return { ...profile, posts: await viewsOf(db, m, rows, now), ...(rows.length === PAGE ? { before: rows.at(-1)!.id } : {}) };
}

/* ------------------------------------------------------------------ */
/* Writing.                                                            */
/* ------------------------------------------------------------------ */
export async function createPost(db: Db, userId: string, body: Record<string, unknown>, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  const g = await gateOf(db, m, now, true);
  const can = canPost(g, now);
  if (can !== "ok") throw new ClubGateError(can);
  const text = textOf(body.body, LIMITS.postLength);
  const flag = autoFlag(text);
  if (flag.refuse) throw new GameError(flag.refuse);
  const parent = body.parentId === undefined || body.parentId === null ? null : (await readable(db, m, idOf(body.parentId))).post;
  if (parent && !ROOTS.includes(parent.kind)) throw new GameError(CLUB_COPY.postGone); // one level deep
  const kind = parent ? "reply" : "post";
  const rule = parent ? LIMITS.replies : LIMITS.posts;
  // New members get half the daily limit, so a throwaway account can't flood the feed on day one.
  const perDay = now.getTime() - Date.parse(m.profile!.createdAt) < LIMITS.newMs ? Math.floor(rule.perDay / 2) : rule.perDay;
  if ((await db.countPostsSince(userId, kind, istMidnight(now))) >= perDay)
    throw new GameError(parent ? CLUB_COPY.tooManyReplies : CLUB_COPY.tooManyPosts);
  if (await db.countPostsSince(userId, kind, ago(now, rule.gapMs))) throw new GameError(CLUB_COPY.slowDown);
  if (await db.lastPostBody(userId, ago(now, 24 * H), text)) throw new GameError(CLUB_COPY.repeat);
  const imageId = await attach(db, userId, body.imageId, now);
  const at = now.toISOString();
  const row = await db.insertPost({
    authorId: userId,
    kind,
    ref: null,
    parentId: parent?.id ?? null,
    body: text,
    held: flag.hold ?? null,
    hiddenAt: null,
    createdAt: at,
    imageId,
  });
  if (!row) throw new GameError(CLUB_COPY.error);
  if (flag.hold) {
    await db.insertReport({
      reporterId: null,
      targetKind: "post",
      targetId: String(row.id),
      targetUser: userId,
      reason: flag.hold,
      note: "",
      snapshot: text,
      dueAt: new Date(now.getTime() + 36 * H).toISOString(),
      createdAt: at,
      imageId,
    });
    side.later(() => tellModerators(db, flag.hold!, side.send));
  } else if (parent?.authorId && parent.authorId !== userId) {
    const to = parent.authorId;
    await db.addActivity({ userId: to, kind: "reply", actorId: userId, postId: row.id, createdAt: at });
    // Hot Seat threads have the Wolf at the top, so this never carries a Hot Seat reply's text.
    side.later(() =>
      clubPush(
        db,
        to,
        {
          kind: `club_reply:${parent.id}`, // one push per thread a day, at most 3 Club pushes in all
          title: CLUB_COPY.pushReply(m.profile!.name),
          body: [...text].slice(0, 80).join(""),
          url: `/app#club/post/${parent.id}`,
          tag: "club-reply",
        },
        side.send,
        now,
      ),
    );
  }
  return { post: (await viewsOf(db, m, [row], now))[0] };
}

export async function deletePost(db: Db, userId: string, id: unknown, now = new Date()) {
  const p = await db.getPost(idOf(id));
  if (!p || p.authorId !== userId) throw new GameError(CLUB_COPY.postGone);
  // Its picture goes too, unless it is evidence (an open report on it, or the post is hidden): then it is kept 180 days
  // apart from the player. Replies' pictures go in the hourly clean-up, which keeps reported ones the same way.
  const evidence = !!p.imageId && (!!p.hiddenAt || (await db.reportedImages([p.imageId])).size > 0);
  if (evidence) await keepRemoved(db, p.imageId, now);
  await db.deletePost(p.id);
  const [img] = p.imageId && !evidence ? await db.imagesByIds([p.imageId]) : [];
  if (img?.ownerId) {
    await db.removeFiles([img.path]);
    await db.deleteImages([img.id]);
  }
  return { deleted: true };
}

export async function like(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const { post } = await readable(db, m, idOf(body.postId));
  const on = body.on !== false;
  const was = (await db.likedOf(userId, [post.id])).has(post.id);
  if (on !== was) await db.setLike(post.id, userId, on);
  if (on && !was && post.authorId && post.authorId !== userId)
    await db.addActivity({ userId: post.authorId, kind: "like", actorId: userId, postId: post.id, createdAt: now.toISOString() });
  return { likes: (await db.getPost(post.id))?.likeCount ?? 0, liked: on };
}

/** Another player by handle: refused as "not found" when missing, yourself, or blocked either way. */
async function other(db: Db, m: Me, handle: unknown, allowBlockedByMe = false) {
  const h = checkHandle(handle);
  const p = "handle" in h ? await db.clubProfileByHandle(h.handle) : null;
  if (!p || p.userId === m.userId || (m.blocked.has(p.userId) && !(allowBlockedByMe && m.blockedOut.has(p.userId))))
    throw new GameError(CLUB_COPY.notFound);
  return p;
}

export async function follow(db: Db, userId: string, body: Record<string, unknown>, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const p = await other(db, m, body.handle);
  if (p.hiddenAt) throw new GameError(CLUB_COPY.notFound);
  const on = body.on !== false;
  if (!on) {
    await db.setFollow(userId, p.userId, false);
    return { following: false };
  }
  if (await db.follows(userId, p.userId)) return { following: true };
  if (
    (await db.countFollowsSince(userId, istMidnight(now))) >= LIMITS.follows.perDay ||
    (await db.followCounts(userId)).following >= LIMITS.follows.total
  )
    throw new GameError(CLUB_COPY.tooManyFollows);
  const at = now.toISOString();
  await db.setFollow(userId, p.userId, true, at);
  await db.addActivity({ userId: p.userId, kind: "follow", actorId: userId, createdAt: at });
  const name = m.profile!.name;
  const handle = m.profile!.handle;
  side.later(() =>
    clubPush(
      db,
      p.userId,
      {
        kind: `club_follow:${handle}`,
        title: CLUB_COPY.pushFollow(name),
        body: CLUB_COPY.pushFollowBody,
        url: `/app#club/@${handle}`,
        tag: "club-follow",
      },
      side.send,
      now,
    ),
  );
  return { following: true };
}

/** Silent, both ways: follows go, and neither sees the other. */
export async function block(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const p = await other(db, m, body.handle, true);
  const on = body.on !== false;
  await db.setBlock(userId, p.userId, on);
  if (on) await Promise.all([db.setFollow(userId, p.userId, false), db.setFollow(p.userId, userId, false)]);
  return { blocked: on };
}

/* ------------------------------------------------------------------ */
/* Reports and moderation.                                             */
/* ------------------------------------------------------------------ */
const REASON_IDS: readonly string[] = REPORT_REASONS.map((r) => r.id);

/** Any signed-in player can report (no Club profile needed), but only what they can see. */
export async function report(db: Db, userId: string, body: Record<string, unknown>, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  const reason = String(body.reason ?? "");
  if (!REASON_IDS.includes(reason)) throw new GameError(CLUB_COPY.error);
  const note = optional(body.note, LIMITS.noteLength);
  let target: { kind: "post" | "profile" | "message"; id: string; user: string | null; snapshot: string; imageId?: string | null };
  if (body.kind === "post") {
    const { post } = await readable(db, m, idOf(body.id));
    target = { kind: "post", id: String(post.id), user: post.authorId, snapshot: post.body, imageId: post.imageId };
  } else if (body.kind === "profile") {
    const p = await other(db, m, body.id, true);
    if (p.hiddenAt) throw new GameError(CLUB_COPY.notFound);
    target = { kind: "profile", id: p.userId, user: p.userId, snapshot: `${p.name} | @${p.handle} | ${p.building}` };
  } else if (body.kind === "message") {
    const msg = await db.getMessage(idOf(body.id));
    if (!msg || msg.hiddenAt || (msg.held && msg.senderId !== userId)) throw new GameError(CLUB_COPY.notFound);
    await chatOf(db, m, msg.chatId, CLUB_COPY.notFound, true); // a request they deleted can still be reported
    if (m.blocked.has(msg.senderId) || msg.event) throw new GameError(CLUB_COPY.notFound); // blocked: hidden from them in a group
    target = { kind: "message", id: String(msg.id), user: msg.senderId, snapshot: msg.body || "(picture)", imageId: msg.imageId };
  } else throw new GameError(CLUB_COPY.error);
  const midnight = istMidnight(now);
  if ((await db.countReportsSince(userId, midnight)) >= LIMITS.reports.perDay) throw new GameError(CLUB_COPY.tooManyReports);
  const urgent = URGENT.includes(reason);
  const at = now.toISOString();
  const fresh = await db.insertReport({
    reporterId: userId,
    targetKind: target.kind,
    targetId: target.id,
    targetUser: target.user,
    reason,
    note,
    snapshot: target.snapshot,
    dueAt: new Date(now.getTime() + (urgent ? 2 : 36) * H).toISOString(),
    createdAt: at,
    imageId: target.imageId ?? null,
  });
  if (!fresh) return { reported: true };
  // Hide at once so the 2-hour duty never waits for a person, but only on reports from accounts over a day old, and
  // at most 3 instant hides a reporter a day; or once 3 such players reported it.
  const old = async (id: string | null) => !!id && now.getTime() - Date.parse((await db.accountCreatedAt(id)) ?? at) > LIMITS.newMs;
  let hide = urgent && (await old(userId)) && (await db.countReportsSince(userId, midnight, true)) <= LIMITS.reports.instantPerDay;
  if (!hide) {
    const open = await db.openReportsOn(target.kind, target.id);
    const reporters = [...new Set(open.map((r) => r.reporterId))];
    hide = reporters.length >= 3 && (await Promise.all(reporters.map(old))).filter(Boolean).length >= 3;
  }
  if (hide) await hideTarget(db, target.kind, target.id, at);
  side.later(() => tellModerators(db, reason, side.send));
  return { reported: true };
}

const KEEP_DAYS = 180;
/**
 * A moderator removed the post or message this picture is in: it stops being served and leaves the owner's folder
 * (so deleting the account doesn't delete it), and the file is deleted after 180 days (IT Rules 3(1)(g)).
 */
async function keepRemoved(db: Db, imageId: string | null, now: Date) {
  const [img] = imageId ? await db.imagesByIds([imageId]) : [];
  if (!img?.ownerId) return;
  const to = `removed/${img.id}.webp`;
  await db.moveFile(img.path, to);
  await db.keepImage(img.id, to, new Date(now.getTime() + KEEP_DAYS * 24 * H).toISOString());
}

/** A moderator kept or restored the content after all: its picture goes back to its owner, if they're still here. */
async function restoreKept(db: Db, imageId: string | null, ownerId: string | null) {
  const [img] = imageId ? await db.imagesByIds([imageId]) : [];
  if (!img || img.ownerId || !ownerId || !(await db.clubProfile(ownerId))) return;
  const to = `${ownerId}/${img.id}.webp`;
  await db.moveFile(img.path, to);
  await db.restoreImage(img.id, ownerId, to);
}

async function hideTarget(db: Db, kind: string, id: string, at: string | null) {
  if (kind === "post" && at && (await db.getPost(Number(id)))?.authorId === null) return; // never the Wolf's
  if (kind === "post") await db.setPostState(Number(id), at ? { hiddenAt: at } : { hiddenAt: null, held: null });
  else if (kind === "profile") await db.updateClubProfile(id, { hiddenAt: at });
  else if (kind === "message") await db.setMessageState(Number(id), at ? { hiddenAt: at } : { hiddenAt: null, held: false });
}

export async function myReports(db: Db, userId: string): Promise<{ reports: ReportView[] }> {
  return {
    reports: (await db.myReports(userId)).map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt,
      ...(r.resolvedAt ? { resolvedAt: r.resolvedAt } : {}),
    })),
  };
}

export const ACTIONS = ["remove", "keep", "ban7", "ban30", "ban", "lift"] as const;
export type ModAction = (typeof ACTIONS)[number];
const BAN_DAYS: Partial<Record<ModAction, number>> = { ban7: 7, ban30: 30 };

/** /admin/club: act on a report's target and author, then resolve every open report on that target. */
export async function moderate(
  db: Db,
  input: { reportId: number; action: ModAction; hideAll?: boolean },
  now = new Date(),
  side: Side = background,
) {
  const r = await db.getReport(input.reportId);
  if (!r) return null;
  const at = now.toISOString();
  const { action } = input;
  const author = r.targetUser;
  const removes = action !== "keep" && action !== "lift";
  const held = r.targetKind === "message" && action === "keep" ? await db.getMessage(Number(r.targetId)) : null;
  await hideTarget(db, r.targetKind, r.targetId, removes ? at : null);
  const pictureOf = async () =>
    r.targetKind === "post"
      ? ((await db.getPost(Number(r.targetId)))?.imageId ?? null)
      : r.targetKind === "message"
        ? ((await db.getMessage(Number(r.targetId)))?.imageId ?? null)
        : null;
  if (removes) await keepRemoved(db, await pictureOf(), now);
  else await restoreKept(db, await pictureOf(), author);
  // A held message a moderator kept reaches the chat now: it moves to the top, live and with a push.
  if (held?.held && !held.hiddenAt) {
    await db.bumpChat(held.chatId, held.id, at);
    await deliverMessage(db, { ...held, held: false }, now, side);
  }
  if (author && action.startsWith("ban"))
    await db.setClubBan(author, BAN_DAYS[action] ? new Date(now.getTime() + BAN_DAYS[action]! * 24 * H).toISOString() : "infinity", "mod");
  if (author && action === "lift") await db.setClubBan(author, null);
  if (author && action === "ban" && input.hideAll) {
    // Hide everything they posted; each hidden item keeps its text in a resolved report row (the 180-day record).
    for (const p of await db.hidePostsBy(author, at)) {
      await db.insertReport({
        reporterId: null,
        targetKind: "post",
        targetId: String(p.id),
        targetUser: author,
        reason: r.reason,
        note: "",
        snapshot: p.body,
        dueAt: at,
        createdAt: at,
        imageId: p.imageId,
      });
      await db.resolveReports("post", String(p.id), "removed", at);
    }
    for (const msg of await db.hideMessagesBy(author, at)) {
      await db.insertReport({
        reporterId: null,
        targetKind: "message",
        targetId: String(msg.id),
        targetUser: author,
        reason: r.reason,
        note: "",
        snapshot: msg.body || "(picture)",
        dueAt: at,
        createdAt: at,
        imageId: msg.imageId,
      });
      await db.resolveReports("message", String(msg.id), "removed", at);
    }
    // Every picture in their hidden content, also what reports hid before now, is kept 180 days apart from them.
    await keepEvidence(db, author, now);
    await db.updateClubProfile(author, { hiddenAt: at });
  }
  const resolved = await db.resolveReports(r.targetKind, r.targetId, removes ? "removed" : "kept", at);
  const outcome = removes ? "removed" : "kept";
  const postId = r.targetKind === "post" && (await db.getPost(Number(r.targetId))) ? Number(r.targetId) : undefined;
  for (const x of resolved) {
    if (x.reporterId && (await db.clubProfile(x.reporterId)))
      await db.addActivity({ userId: x.reporterId, kind: "report_done", detail: outcome, createdAt: at });
  }
  if (removes && postId && author && (await db.clubProfile(author)))
    await db.addActivity({ userId: author, kind: "removed", postId, detail: r.reason, createdAt: at });
  return { ok: true, resolved: resolved.length };
}

/** The admin queue: open reports with the handles involved and each author's past removals. */
export async function queue(db: Db, now = new Date()) {
  const [open, done] = await Promise.all([db.reportQueue(), db.resolvedReports(ago(now, 180 * 24 * H))]);
  const ids = [...new Set([...open, ...done].flatMap((r) => [r.reporterId, r.targetUser]).filter((x): x is string => !!x))];
  const handles = new Map((await db.clubProfiles(ids)).map((p) => [p.userId, p.handle]));
  // Moderators see the picture too, removed ones included (signed for an hour, like the app's).
  const pics = await db.imagesByIds([...new Set([...open, ...done].flatMap((r) => (r.imageId ? [r.imageId] : [])))]);
  const urls = await db.signFiles(pics.map((i) => i.path));
  const urlOf = new Map(pics.map((i) => [i.id, urls[i.path]]));
  const removals = (u: string | null) => (u ? done.filter((d) => d.targetUser === u && d.status === "removed").length : 0);
  const row = (r: ReportRow) => ({
    ...r,
    reporter: r.reporterId ? (handles.get(r.reporterId) ?? "A player") : "Automatic",
    author: r.targetUser ? (handles.get(r.targetUser) ?? "Deleted account") : "The Wolf",
    removals: removals(r.targetUser),
    imageUrl: (r.imageId && urlOf.get(r.imageId)) || null,
  });

  return { open: open.map(row), done: done.filter((d) => Date.parse(d.resolvedAt!) > now.getTime() - 30 * 24 * H).map(row) };
}

/* ------------------------------------------------------------------ */
/* Activity.                                                           */
/* ------------------------------------------------------------------ */
export async function activity(db: Db, userId: string, before: unknown) {
  const m = await meOf(db, userId);
  if (!m.profile) throw new ClubGateError("join");
  const rows = await db.activity(userId, before ? idOf(before) : MAX_ID, REPLIES_PAGE);
  const actors = new Map(
    (await db.clubProfiles([...new Set(rows.flatMap((r) => (r.actorId ? [r.actorId] : [])))])).map((p) => [p.userId, p]),
  );
  const items: ActivityItem[] = [];
  const likesOn = new Map<number, ActivityItem>();
  for (const r of rows) {
    const a = r.actorId ? actors.get(r.actorId) : undefined;
    // Someone blocked either way, hidden or gone: leave the item out.
    if (r.actorId && (!a || a.hiddenAt || m.blocked.has(r.actorId))) continue;
    const actor = a ? { handle: a.handle, name: a.name } : null;
    const base = { id: r.id, kind: r.kind, createdAt: r.createdAt, seen: r.seen, actor };
    if (r.kind === "like" && r.postId) {
      const first = likesOn.get(r.postId);
      if (first) {
        first.others = (first.others ?? 0) + 1;
        continue;
      }
      const item = { ...base, postId: r.postId };
      likesOn.set(r.postId, item);
      items.push(item);
    } else if (r.kind === "reply" && r.postId) {
      const reply = await db.getPost(r.postId);
      const root = reply?.parentId ? await db.getPost(reply.parentId) : null;
      if (!reply || !root || !visibleTo(reply, m) || !visibleTo(root, m)) continue;
      // Never the text of a Hot Seat thread reply: it may give away an answer.
      items.push({ ...base, postId: root.id, ...(root.kind === "hotseat" ? {} : { text: [...reply.body].slice(0, 80).join("") }) });
    } else if (r.kind === "report_done") {
      items.push({ ...base, text: r.detail === "removed" ? CLUB_COPY.outcomeRemoved : CLUB_COPY.outcomeKept });
    } else if (r.kind === "removed") {
      items.push({ ...base, text: CLUB_COPY.removedYours(reasonLabel(r.detail ?? "other").toLowerCase()) });
    } else items.push(base);
  }
  if (rows.length) await db.markActivitySeen(userId, rows[0].id);
  return { items, ...(rows.length === REPLIES_PAGE ? { before: rows.at(-1)!.id } : {}) };
}

/* ------------------------------------------------------------------ */
/* Chats (step 2) and group chats (step 3).                            */
/* ------------------------------------------------------------------ */
const CHAT_PAGE = 50;
const INBOX_PAGE = 30;
/** Chat pushes: at most this many a day, one per chat an hour, none while the chat is open. */
const DM_CAP = 10;
const OPEN_MS = 60_000;
const TYPING_MS = 3000;
const typingAt = new Map<string, number>();

/** One chat per pair of players, whoever starts it. The string never goes to the phone. */
const pairOf = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
const withOf = (p: ClubProfileRow | null | undefined): ChatRow["with"] =>
  p ? { handle: p.handle, name: p.name, title: titleOf(p.rank) } : null;

/** What a viewer needs to see messages: pictures signed once for everyone, and the senders' names in a group. */
interface Shown {
  images?: Map<string, ImageView>;
  names?: Map<string, ClubProfileRow>;
  /** The viewer hasn't accepted this request: its pictures wait until they do (no URL is sent). */
  waitingPictures?: boolean;
}
const viewOf = (x: MessageRow, viewer: string, s: Shown = {}): MessageView => {
  const mine = x.senderId === viewer;
  const image = x.imageId ? s.images?.get(x.imageId) : undefined;
  const from = !mine ? s.names?.get(x.senderId) : undefined;
  return {
    id: x.id,
    chatId: x.chatId,
    mine,
    body: x.body,
    createdAt: x.createdAt,
    flagged: !!x.flagged,
    held: x.held && mine,
    ...(mine ? { clientId: x.clientId } : {}),
    ...(x.imageId && (image || s.waitingPictures) ? (s.waitingPictures && !mine ? { imageHidden: true as const } : { image }) : {}),
    ...(x.event ? { event: x.event } : {}),
    ...(from ? { from: { handle: from.handle, name: from.name } } : {}),
  };
};
/** The inbox line: the text, "Picture", or the group line. */
const preview = (x: MessageRow, viewer: string, names: Map<string, ClubProfileRow>) =>
  x.event
    ? groupLine(x.event, x.senderId === viewer ? CLUB_COPY.you : (names.get(x.senderId)?.name ?? CLUB_COPY.deletedAccount), x.body)
    : x.body || CLUB_COPY.picture;
/** Not waiting for a check, unless it's the viewer's own. */
const shownTo = (x: MessageRow, viewer: string) => !x.held || x.senderId === viewer;
const asked = (x?: ChatMemberRow) => x?.state === "request" || x?.state === "declined";

interface ChatCtx {
  info: ChatInfo;
  mine: ChatMemberRow;
  members: ChatMemberRow[];
  /** One-to-one only: the other side. */
  other: ChatMemberRow | undefined;
  /** null: the other player deleted their account (or a group). */
  otherProfile: ClubProfileRow | null;
}

/**
 * A chat `m` is in (not a request they deleted, unless `declinedToo`; not a group they left). A one-to-one chat is
 * refused when blocked either way; in a group, blocked players' messages are left out instead.
 */
async function chatOf(db: Db, m: Me, id: number, refusal: string = CLUB_COPY.chatGone, declinedToo = false): Promise<ChatCtx> {
  const [info, members] = await Promise.all([db.getChat(id), db.chatMembers(id)]);
  const mine = members.find((x) => x.userId === m.userId);
  if (!info || !mine || (mine.state === "declined" && !declinedToo) || mine.state === "left") throw new GameError(refusal);
  if (info.group) return { info, mine, members, other: undefined, otherProfile: null };
  const other = members.find((x) => x.userId !== m.userId);
  if (other && m.blocked.has(other.userId)) throw new GameError(refusal);
  return { info, mine, members, other, otherProfile: other ? await db.clubProfile(other.userId) : null };
}
/** The group's other members who hear from `m`: still in it, and not blocked either way. */
const listeners = (c: ChatCtx, m: Me) =>
  c.members.filter((x) => x.state === "active" && x.userId !== m.userId && !m.blocked.has(x.userId)).map((x) => x.userId);

/** Someone you can chat with: still in the Club, not hidden by a moderator or reports, and not banned. */
async function reachable(db: Db, p: ClubProfileRow | null, now: Date): Promise<boolean> {
  if (!p || p.hiddenAt) return false;
  const ban = await db.clubBan(p.userId);
  return !(ban?.reason === "mod" && bannedAt(ban.until, now));
}

/** Like the game's reminders: nothing at all after a player has been away for over a week. */
async function away(db: Db, userId: string, now: Date) {
  const last = (await db.getProfile(userId))?.state.lastActiveDay;
  return !last || dayDiff(last, today(now)) > 7;
}

const tell = (side: Side, events: { userId: string; e: LiveEvent }[]) => {
  if (events.length) side.later(() => (side.live ?? realtimeLive)(events));
};

/** New members get half the daily limits, as for posts. */
const chatCap = (m: Me, now: Date, n: number) => (now.getTime() - Date.parse(m.profile!.createdAt) < LIMITS.newMs ? Math.floor(n / 2) : n);

/** Start a chat with a player by handle, or open the one the pair already has. */
export async function startChat(db: Db, userId: string, body: Record<string, unknown>, now = new Date()) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const p = await other(db, m, body.handle);
  if (!(await reachable(db, p, now))) throw new GameError(CLUB_COPY.notFound);
  const pair = pairOf(userId, p.userId);
  const existing = await db.chatByPair(pair);
  if (existing) {
    // Opening a chat you already have needs no membership; a request you deleted comes back.
    const mine = (await db.chatMembers(existing.id)).find((x) => x.userId === userId);
    if (mine?.state === "declined") await db.setMember(existing.id, userId, { state: "active" });
    return { chatId: existing.id };
  }
  const can = canPost(await gateOf(db, m, now, true), now);
  if (can !== "ok") throw new ClubGateError(can);
  const chatId = await db.startChat({
    pair,
    creator: userId,
    other: p.userId,
    request: !(await db.follows(p.userId, userId)),
    since: istMidnight(now),
    perDay: chatCap(m, now, LIMITS.chats.perDay),
    requestsPerDay: chatCap(m, now, LIMITS.chats.requestsPerDay),
    at: now.toISOString(),
  });
  if (chatId === null) throw new GameError(CLUB_COPY.tooManyChats);
  return { chatId };
}

/** The inbox (`active`) or requests, newest first. Blocked players' chats drop out. */
export async function chats(db: Db, userId: string, state: "active" | "request", before: unknown) {
  const m = await meOf(db, userId);
  if (!m.profile) throw new ClubGateError("join");
  const rows = await db.inbox(userId, state, inboxCursor(before), INBOX_PAGE);
  const shown = rows.filter((r) => !(r.otherId && m.blocked.has(r.otherId)));
  const ids = [...new Set(shown.flatMap((r) => [r.otherId, r.last.senderId].filter((x): x is string => !!x)))];
  const profiles = new Map((await db.clubProfiles(ids)).map((p) => [p.userId, p]));
  const list: ChatRow[] = shown.map((r) => ({
    id: r.chatId,
    with: r.title === null ? withOf(r.otherId ? profiles.get(r.otherId) : null) : null,
    ...(r.title !== null ? { title: r.title } : {}),
    state,
    // A blocked player's last message in a group isn't shown.
    last: {
      body: m.blocked.has(r.last.senderId) ? "" : preview(r.last, userId, profiles),
      at: r.last.createdAt,
      mine: r.last.senderId === userId,
    },
    // As club_unread: a blocked player's message doesn't make a chat unread.
    unread: r.last.senderId !== userId && !m.blocked.has(r.last.senderId) && (state === "request" || r.last.id > r.lastReadId),
  }));
  const { requests } = await db.unreadChats(userId);
  const end = rows.at(-1);
  return { chats: list, requests, ...(rows.length === INBOX_PAGE && end ? { before: `${end.lastAt}|${end.chatId}` } : {}) };
}

/** "<last_at>|<chat id>": chats with the same last_at are never skipped. */
function inboxCursor(x: unknown): { at: string; id: number } | null {
  const [at, id] = typeof x === "string" ? x.split("|") : [];
  return at && !Number.isNaN(Date.parse(at)) && Number.isSafeInteger(Number(id)) ? { at, id: Number(id) } : null;
}

/** One chat: a page of messages (`before` for older, `after` to catch up), and the other side's "Seen". */
export async function readChat(
  db: Db,
  userId: string,
  id: unknown,
  q: { before?: unknown; after?: unknown },
  now = new Date(),
): Promise<ChatView> {
  const m = await meOf(db, userId);
  const chatId = idOf(id);
  const c = await chatOf(db, m, chatId);
  const { info, mine, other, otherProfile } = c;
  await db.setMember(chatId, userId, { activeAt: now.toISOString() }); // no push while they're reading it
  const after = q.after ? idOf(q.after) : undefined;
  const before = q.before ? idOf(q.before) : undefined;
  const rows = await db.messages(chatId, { before, after, afterCleared: mine.clearedId, limit: CHAT_PAGE });
  const visible = rows.filter((x) => shownTo(x, userId) && !m.blocked.has(x.senderId));
  let names: Map<string, ClubProfileRow> | undefined;
  let group: ChatView["chat"]["group"];
  if (info.group) {
    const active = c.members.filter((x) => x.state === "active");
    const ids = [...new Set([...active.map((x) => x.userId), ...visible.map((x) => x.senderId)])];
    names = new Map((await db.clubProfiles(ids)).map((p) => [p.userId, p]));
    group = {
      members: active.flatMap((x) => {
        const p = names!.get(x.userId);
        return p ? [{ handle: p.handle, name: p.name, title: titleOf(p.rank), mine: x.userId === userId }] : [];
      }),
      admin: info.createdBy === userId,
    };
  }
  // A request's receiver gets no picture URLs until they accept.
  const waitingPictures = mine.state === "request";
  const images = await imagesFor(
    db,
    visible.filter((x) => !waitingPictures || x.senderId === userId).map((x) => x.imageId),
  );
  const messages = visible.map((x) => viewOf(x, userId, { images, names, waitingPictures }));
  const last = visible.at(-1);
  return {
    chat: {
      id: chatId,
      with: info.group ? null : withOf(otherProfile),
      ...(info.group ? { title: info.title ?? "", group } : {}),
      state: mine.state === "request" ? "request" : "active",
      last: last ? { body: preview(last, userId, names ?? new Map()), at: last.createdAt, mine: last.senderId === userId } : null,
      unread: false,
      canSend: mine.state === "active" && (info.group || (await reachable(db, otherProfile, now))),
      waiting: !info.group && mine.state === "active" && asked(other),
    },
    messages,
    // A request's receiver reads without the sender being told (Instagram's rule). Groups show no "Seen".
    theirLastRead: !info.group && other?.state === "active" ? other.lastReadId : 0,
    ...(after === undefined && rows.length === CHAT_PAGE ? { before: rows[0].id } : {}),
  };
}

const CLIENT_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Send a message: text, a picture, or both. Contact details are refused; a link or scam words show a warning under
 * it (and go to the queue), and in a request they are held until a moderator approves them. A request allows 3
 * messages before it's accepted, and its pictures show once it is; after a silent "Delete" the sender still sees
 * "Sent", but nothing reaches the other player. In a group, it goes to every member who hasn't blocked either way.
 */
export async function sendMessage(
  db: Db,
  userId: string,
  id: unknown,
  body: Record<string, unknown>,
  now = new Date(),
  side: Side = background,
) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const chatId = idOf(id);
  const { info, mine, other, otherProfile } = await chatOf(db, m, chatId, CLUB_COPY.notSent);
  if (mine.state !== "active" || (!info.group && (!other || !(await reachable(db, otherProfile, now)))))
    throw new GameError(CLUB_COPY.notSent);
  const picture = body.imageId !== undefined && body.imageId !== null && body.imageId !== "";
  const text = picture ? optional(body.body, LIMITS.chats.messageLength) : textOf(body.body, LIMITS.chats.messageLength);
  const clientId = typeof body.clientId === "string" && CLIENT_ID.test(body.clientId) ? body.clientId : null;
  if (!clientId) throw new GameError(CLUB_COPY.error);
  const flag = autoFlag(text);
  if (flag.refuse) throw new GameError(flag.refuse);
  const held = !info.group && asked(other) && !!flag.hold;
  const imageId = picture ? pictureId(body.imageId) : null;
  const at = now.toISOString();
  // The picture is claimed inside club_send, under the chat lock, after the retry check: one picture, one message.
  const sent = await db.sendMessage(
    { chatId, senderId: userId, clientId, body: text, flagged: flag.hold ?? null, held, imageId },
    at,
    LIMITS.chats.requestMessages,
  );
  if (sent === "cap") throw new GameError(CLUB_COPY.waitAccept(otherProfile!.name));
  if (sent === "picture") throw new GameError(CLUB_COPY.pictureGone);
  const { row } = sent;
  const mineView = async () => viewOf(row, userId, { images: await imagesFor(db, [row.imageId]) });
  // A retry (same chat and clientId) gets the saved row back and nothing else happens.
  if (!sent.fresh) return { message: await mineView() };
  if (flag.hold) {
    await db.insertReport({
      reporterId: null,
      targetKind: "message",
      targetId: String(row.id),
      targetUser: userId,
      reason: flag.hold,
      note: "",
      snapshot: text,
      dueAt: new Date(now.getTime() + 36 * H).toISOString(),
      createdAt: at,
      imageId,
    });
    side.later(() => tellModerators(db, flag.hold!, side.send));
  }
  await deliverMessage(db, row, now, side);
  return { message: await mineView() };
}

/**
 * A new message reaches the chat: live to the other members and to the sender's own other phones, and a push. Never
 * a hidden or held row (so never its picture), nothing to a request the receiver deleted, and nothing across a block.
 * A request's receiver gets no picture URL until they accept. Group lines push nothing here (see addToGroup).
 */
async function deliverMessage(db: Db, row: MessageRow, now: Date, side: Side) {
  if (row.hiddenAt || row.held) return;
  const [info, members, sender, blocks] = await Promise.all([
    db.getChat(row.chatId),
    db.chatMembers(row.chatId),
    db.clubProfile(row.senderId),
    db.blocks(row.senderId),
  ]);
  if (!info) return;
  const chatId = row.chatId;
  const blocked = (u: string) => blocks.out.has(u) || blocks.in.has(u);
  const images = await imagesFor(db, [row.imageId]);
  const live = (u: string, s: Shown) => ({ userId: u, e: { event: "msg" as const, payload: { chatId, message: viewOf(row, u, s) } } });
  if (info.group) {
    const to = members.filter((x) => x.state === "active" && x.userId !== row.senderId && !blocked(x.userId));
    const names = sender ? new Map([[sender.userId, sender]]) : undefined;
    tell(side, [live(row.senderId, { images }), ...to.map((x) => live(x.userId, { images, names }))]);
    if (!sender || row.event) return;
    for (const x of to) {
      const reading = !!x.activeAt && now.getTime() - Date.parse(x.activeAt) < OPEN_MS;
      if (!reading)
        side.later(() => dmPush(db, x.userId, chatId, info.title ?? "", CLUB_COPY.pushGroupMessage(sender.name), side.send, now));
    }
    return;
  }
  const other = members.find((x) => x.userId !== row.senderId);
  const reaches = !!other && !!sender && other.state !== "declined" && !blocked(other.userId);
  tell(side, [
    live(row.senderId, { images }),
    ...(reaches ? [live(other!.userId, other!.state === "request" ? { waitingPictures: true } : { images })] : []),
  ]);
  if (reaches) {
    const name = sender!.name;
    const to = other!.userId;
    const reading = !!other!.activeAt && now.getTime() - Date.parse(other!.activeAt) < OPEN_MS;
    if (other!.state === "active" && !reading) side.later(() => dmPush(db, to, chatId, name, CLUB_COPY.pushMessage, side.send, now));
    // A request pushes once: on the sender's first message the receiver can see.
    const shown = (await db.messages(chatId, { afterCleared: 0, limit: 5 })).filter((x) => x.senderId === row.senderId && !x.held);
    if (other!.state === "request" && shown.length === 1)
      side.later(() =>
        clubPush(
          db,
          to,
          {
            kind: "club_request",
            title: CLUB_COPY.pushRequest(name),
            body: CLUB_COPY.pushRequestBody,
            url: "/app#club/requests",
            tag: "club-request",
          },
          side.send,
          now,
        ),
      );
  }
}

/** A chat push: quiet hours still apply, one per chat an hour, at most 10 a day, never the message text. */
async function dmPush(db: Db, userId: string, chatId: number, title: string, body: string, send: Send, now: Date) {
  const phones = await db.pushes(userId);
  if (!phones.length || (await away(db, userId, now))) return;
  await deliver(
    db,
    userId,
    phones,
    {
      kind: `dm:${chatId}:${istHour(now)}`,
      title,
      body,
      url: `/app#club/chat/${chatId}`,
      tag: `chat-${chatId}`,
      urgent: true,
    },
    send,
    now,
    { sent: 0, gone: 0, failed: 0 },
    { count: (u, d) => db.dmNoticesOn(u, d), max: DM_CAP },
  );
}

/** "Seen": moves forward only, and the other player hears it only in an accepted one-to-one chat. */
export async function seen(db: Db, userId: string, id: unknown, body: Record<string, unknown>, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  const chatId = idOf(id);
  const { mine, other } = await chatOf(db, m, chatId);
  const lastId = Math.min(idOf(body.lastId), await db.lastMessageId(chatId));
  if (mine.state !== "active") return { ok: true };
  const moved = lastId > mine.lastReadId;
  await db.setMember(chatId, userId, { activeAt: now.toISOString(), ...(moved ? { lastReadId: lastId } : {}) });
  if (moved && other?.state === "active") tell(side, [{ userId: other.userId, e: { event: "seen", payload: { chatId, lastId } } }]);
  return { ok: true };
}

/** "Ravi is typing…": at most one every 3 seconds a chat, never written down. */
export async function typing(db: Db, userId: string, id: unknown, now = new Date(), side: Side = background) {
  const chatId = idOf(id);
  const key = `${userId}:${chatId}`;
  if (now.getTime() - (typingAt.get(key) ?? 0) < TYPING_MS) return { ok: true };
  if (typingAt.size > 10_000) typingAt.clear();
  typingAt.set(key, now.getTime());
  const m = await meOf(db, userId);
  const c = await chatOf(db, m, chatId);
  if (c.mine.state !== "active" || !m.profile) return { ok: true };
  const to = c.info.group ? listeners(c, m) : c.other?.state === "active" && c.otherProfile ? [c.other.userId] : [];
  const handle = m.profile.handle;
  tell(
    side,
    to.map((u) => ({ userId: u, e: { event: "typing" as const, payload: { chatId, handle } } })),
  );
  return { ok: true };
}

/** The receiver takes a request: it moves to the inbox, "Seen" starts to count, and its pictures show. */
export async function accept(db: Db, userId: string, id: unknown, now = new Date()) {
  const m = await meOf(db, userId);
  await mustInteract(db, m, now);
  const chatId = idOf(id);
  const { mine } = await chatOf(db, m, chatId);
  if (mine.state === "request") await db.setMember(chatId, userId, { state: "active", activeAt: now.toISOString() });
  return { ok: true };
}

/** The receiver deletes a request. The sender isn't told. */
export async function decline(db: Db, userId: string, id: unknown) {
  const m = await meOf(db, userId);
  const chatId = idOf(id);
  const { mine } = await chatOf(db, m, chatId);
  if (mine.state === "request") await db.setMember(chatId, userId, { state: "declined" });
  return { ok: true };
}

/** "Delete chat": hides what's there for this player only; a new message brings the chat back. */
export async function clearChat(db: Db, userId: string, id: unknown) {
  const m = await meOf(db, userId);
  const chatId = idOf(id);
  await chatOf(db, m, chatId);
  await db.setMember(chatId, userId, { clearedId: await db.lastMessageId(chatId) });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Group chats (step 3).                                               */
/* ------------------------------------------------------------------ */
/** A group's name passes the same checks as a profile: no contacts, links, money words or the app's names. */
function groupTitle(x: unknown): string {
  const t = textOf(x, LIMITS.groups.titleLength, CLUB_COPY.badGroupName);
  if (t.includes("\n")) throw new GameError(CLUB_COPY.badGroupName);
  const f = autoFlag(t);
  if (f.refuse) throw new GameError(f.refuse);
  if (f.hold) throw new GameError(CLUB_COPY.groupNameLinks);
  if (reservedName(t)) throw new GameError(CLUB_COPY.reservedName);
  return t;
}

/** Someone `m` may put in a group: in the Club, reachable, not blocked either way, and following each other. */
async function groupable(db: Db, m: Me, handle: unknown, now: Date): Promise<ClubProfileRow> {
  const p = await other(db, m, handle);
  if (!(await reachable(db, p, now))) throw new GameError(CLUB_COPY.notFound);
  if (!(await db.follows(m.userId, p.userId)) || !(await db.follows(p.userId, m.userId))) throw new GameError(CLUB_COPY.mutualOnly);
  return p;
}

let lines = 0;
/** "Ravi added Priya" and the like: a message from whoever did it, delivered like any other. */
async function groupEvent(
  db: Db,
  side: Side,
  chatId: number,
  userId: string,
  event: NonNullable<MessageRow["event"]>,
  name: string,
  now: Date,
) {
  const at = now.toISOString();
  const sent = await db.sendMessage(
    { chatId, senderId: userId, clientId: `g-${event}-${now.getTime()}-${++lines}`, body: name, flagged: null, held: false, event },
    at,
    LIMITS.chats.requestMessages,
  );
  if (typeof sent === "object" && sent.fresh) await deliverMessage(db, sent.row, now, side);
}

/** People the player follows who follow them back: who can go in a group. */
export async function mutualList(db: Db, userId: string) {
  const m = await meOf(db, userId);
  if (!m.profile) throw new ClubGateError("join");
  const ids = (await db.mutuals(userId)).filter((id) => !m.blocked.has(id));
  const people = (await db.clubProfiles(ids))
    .filter((p) => !p.hiddenAt)
    .map((p) => ({ handle: p.handle, name: p.name, title: titleOf(p.rank) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { people };
}

/**
 * A new group: a member at Trader and above, with 2 to 19 people who follow each other with them (so no requests).
 * Counted with new chats, from the log that leaving the Club doesn't clear, under the same per-player lock.
 */
export async function createGroup(db: Db, userId: string, body: Record<string, unknown>, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  const can = canPost(await gateOf(db, m, now, true), now);
  if (can !== "ok") throw new ClubGateError(can);
  const title = groupTitle(body.title);
  const { minOthers, maxMembers } = LIMITS.groups;
  const handles = Array.isArray(body.handles)
    ? [...new Set(body.handles.map((h) => String(h).trim().replace(/^@/, "").toLowerCase()))]
    : [];
  if (handles.length < minOthers || handles.length > maxMembers - 1) throw new GameError(CLUB_COPY.pickPeople(minOthers, maxMembers - 1));
  const people: ClubProfileRow[] = [];
  for (const h of handles) people.push(await groupable(db, m, h, now));
  const ids = people.map((p) => p.userId);
  const chatId = await db.startGroup({
    creator: userId,
    others: ids,
    title,
    since: istMidnight(now),
    perDay: chatCap(m, now, LIMITS.chats.perDay),
    at: now.toISOString(),
  });
  if (chatId === null) throw new GameError(CLUB_COPY.tooManyChats);
  await groupEvent(db, side, chatId, userId, "created", "", now);
  const by = m.profile!.name;
  for (const u of ids) side.later(() => dmPush(db, u, chatId, title, CLUB_COPY.pushAddedToGroup(by), side.send, now));
  return { chatId };
}

/** A group the player made and is still in: only they add and remove people, while they can post. */
async function myGroup(db: Db, m: Me, id: unknown, now: Date) {
  const chatId = idOf(id);
  const c = await chatOf(db, m, chatId);
  if (!c.info.group) throw new GameError(CLUB_COPY.chatGone);
  if (c.info.createdBy !== m.userId) throw new GameError(CLUB_COPY.onlyMaker);
  const can = canPost(await gateOf(db, m, now, true), now);
  if (can !== "ok") throw new ClubGateError(can);
  if (groupBusy(chatId, now)) throw new GameError(CLUB_COPY.slowDown);
  return { chatId, c };
}

/** Adds and removes: at most 20 a minute in one group, so a maker can't flood its members with lines and pushes. */
const GROUP_OPS = 20;
const groupOps = new Map<number, number[]>();
function groupBusy(chatId: number, now: Date) {
  const t = now.getTime();
  if (groupOps.size > 10_000) groupOps.clear();
  const recent = (groupOps.get(chatId) ?? []).filter((x) => t - x < 60_000);
  if (recent.length >= GROUP_OPS) return true;
  groupOps.set(chatId, [...recent, t]);
  return false;
}

/** The maker adds someone who follows each other with them; they see only what comes after. */
export async function addToGroup(
  db: Db,
  userId: string,
  id: unknown,
  body: Record<string, unknown>,
  now = new Date(),
  side: Side = background,
) {
  const m = await meOf(db, userId);
  const { chatId, c } = await myGroup(db, m, id, now);
  const p = await groupable(db, m, body.handle, now);
  if (c.members.some((x) => x.userId === p.userId && x.state === "active")) return { ok: true };
  // The count and the add happen with the chat locked, so two adds at once can't pass 20 people.
  if (!(await db.addMember(chatId, p.userId, LIMITS.groups.maxMembers))) throw new GameError(CLUB_COPY.groupFull);

  await groupEvent(db, side, chatId, userId, "added", p.name, now);
  const by = m.profile!.name;
  const title = c.info.title ?? "";
  side.later(() => dmPush(db, p.userId, chatId, title, CLUB_COPY.pushAddedToGroup(by), side.send, now));
  return { ok: true };
}

/** The maker takes someone out. */
export async function removeFromGroup(
  db: Db,
  userId: string,
  id: unknown,
  body: Record<string, unknown>,
  now = new Date(),
  side: Side = background,
) {
  const m = await meOf(db, userId);
  const { chatId, c } = await myGroup(db, m, id, now);
  const h = checkHandle(body.handle);
  const p = "handle" in h ? await db.clubProfileByHandle(h.handle) : null;
  if (!p || p.userId === userId || !c.members.some((x) => x.userId === p.userId && x.state === "active"))
    throw new GameError(CLUB_COPY.notFound);
  await db.setMember(chatId, p.userId, { state: "left" });
  await groupEvent(db, side, chatId, userId, "removed", p.name, now);
  return { ok: true };
}

/** Leave a group (anyone, even when banned). If the maker leaves, nobody can add or remove people any more. */
export async function leaveGroup(db: Db, userId: string, id: unknown, now = new Date(), side: Side = background) {
  const m = await meOf(db, userId);
  const chatId = idOf(id);
  const c = await chatOf(db, m, chatId);
  if (!c.info.group) throw new GameError(CLUB_COPY.chatGone);
  await groupEvent(db, side, chatId, userId, "left", "", now);
  await db.setMember(chatId, userId, { state: "left" });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Pictures (step 3).                                                  */
/* ------------------------------------------------------------------ */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const pictureId = (x: unknown): string => {
  if (typeof x !== "string" || !UUID.test(x)) throw new GameError(CLUB_COPY.pictureGone);
  return x;
};

/**
 * A picture the player added in the last hour and hasn't used, taken by this post in one conditional update (only one
 * caller can win it). null: none. Messages claim theirs inside club_send instead.
 */
async function attach(db: Db, userId: string, x: unknown, now: Date): Promise<string | null> {
  if (x === undefined || x === null || x === "") return null;
  const img = await db.claimImage(pictureId(x), userId, ago(now, H), "post");
  if (!img) throw new GameError(CLUB_COPY.pictureGone);
  return img.id;
}

/**
 * POST /api/club/image: one JPEG, PNG or WebP (by its bytes) up to 5 MB, 20 a day. For a post the player must be
 * able to post; with `chat`, an active member of that chat. `read` gets the file only after those checks pass.
 * Stored as upright WebP, at most 1080 px, no EXIF or location, in '<user>/<id>.webp'.
 */
export async function uploadImage(db: Db, userId: string, chat: unknown, read: () => Promise<Uint8Array | null>, now = new Date()) {
  const m = await meOf(db, userId);
  if (chat) {
    await mustInteract(db, m, now);
    const { mine } = await chatOf(db, m, idOf(chat), CLUB_COPY.notSent);
    if (mine.state !== "active") throw new GameError(CLUB_COPY.notSent);
  } else {
    const can = canPost(await gateOf(db, m, now, true), now);
    if (can !== "ok") throw new ClubGateError(can);
  }
  const midnight = istMidnight(now);
  // A cheap first check, so a player over the cap isn't decoded; the real one is atomic (addImage).
  if ((await db.countImagesSince(userId, midnight)) >= LIMITS.pictures.perDay) throw new GameError(CLUB_COPY.tooManyPictures);
  const bytes = await read();
  if (!bytes || !bytes.length) throw new GameError(CLUB_COPY.pictureType);
  if (bytes.length > LIMITS.pictures.maxBytes) throw new GameError(CLUB_COPY.pictureTooBig);
  if (!pictureKind(bytes)) throw new GameError(CLUB_COPY.pictureType);
  const pic = await toWebp(bytes).catch(() => null);
  if (!pic) throw new GameError(CLUB_COPY.pictureType);
  const id = randomUUID();
  const path = `${userId}/${id}.webp`;
  // The row first (counted under the daily cap, atomically): if the upload fails, the hourly clean-up deletes the row.
  const row = { id, ownerId: userId, path, width: pic.width, height: pic.height, createdAt: now.toISOString() };
  if (!(await db.addImage(row, midnight, LIMITS.pictures.perDay))) throw new GameError(CLUB_COPY.tooManyPictures);
  await db.putFile(path, pic.data);
  return { imageId: id, width: pic.width, height: pic.height };
}

const PURGE_PAGE = 200;
const PURGE_ROUNDS = 10;
/**
 * Hourly (with the reminders): delete pictures nobody uses after a day, and removed ones after their 180 days. An
 * unused picture an open report points at (say, a deleted post's reply) is kept as evidence instead. At most 10
 * rounds an hour, so a failing delete can't loop for ever; the rest waits for the next hour.
 */
export async function purgeImages(db: Db, now = new Date()) {
  let n = 0;
  for (let round = 0; round < PURGE_ROUNDS; round++) {
    const stale = await db.staleImages(ago(now, 24 * H), PURGE_PAGE);
    const reported = await db.reportedImages(stale.filter((i) => i.ownerId).map((i) => i.id));
    for (const id of reported) await keepRemoved(db, id, now);
    const gone = stale.filter((i) => !reported.has(i.id));
    if (gone.length) {
      await db.removeFiles(gone.map((i) => i.path));
      await db.deleteImages(gone.map((i) => i.id));
    }
    n += gone.length;
    if (stale.length < PURGE_PAGE) break;
  }
  return { images: n };
}

/**
 * Before a player's own pictures are deleted (deleting a post or the account, leaving the Club): any that are evidence,
 * in an open report or in hidden content, are kept 180 days apart from them instead.
 */
export async function keepEvidence(db: Db, ownerId: string, now = new Date()) {
  for (const id of await db.evidenceImages(ownerId)) await keepRemoved(db, id, now);
}
