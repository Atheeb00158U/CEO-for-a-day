// The Club on the server (docs/superpowers/specs/2026-11-04-community-design.md, step 1): joining, posts, replies,
// likes, follows, blocks, reports, activity and moderation. Every check runs here; the phone only shows what comes
// back. Players are named by handle, never by id. Pushes go through `side` so the reply never waits on them.
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
  type ClubMe,
  type GateInput,
  type PostView,
  type ProfileView,
  type ReportView,
} from "../community.ts";
import type { CourseOutline } from "../course-types";
import { dayDiff, today, type GameState } from "../game-state.ts";
import { courseOutline, servableHotSeat, wolfQuestion } from "./content.ts";
import type { ClubProfileRow, Db, PostRow, ReportRow } from "./db.ts";
import { GameError, trustedCareers } from "./game.ts";
import { broadcast, deliver, webPush, type Message, type Send } from "./reminders.ts";

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
}
export const background: Side = { send: webPush, later: (task) => void task().catch((e) => console.error("club:", e)) };

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
  const [authors, liked] = await Promise.all([
    db.clubProfiles(ids),
    db.likedOf(
      me.userId,
      shown.map((p) => p.id),
    ),
  ]);
  const byId = new Map(authors.map((a) => [a.userId, a]));
  return shown.flatMap((p) => {
    const a = p.authorId ? byId.get(p.authorId) : null;
    if (p.authorId && (!a || (a.hiddenAt && a.userId !== me.userId))) return [];
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
  return { activity: (await db.clubProfile(userId)) ? await db.unseenActivity(userId) : 0, chats: 0, requests: 0 };
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

export async function deletePost(db: Db, userId: string, id: unknown) {
  const p = await db.getPost(idOf(id));
  if (!p || p.authorId !== userId) throw new GameError(CLUB_COPY.postGone);
  await db.deletePost(p.id);
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
  let target: { kind: "post" | "profile"; id: string; user: string | null; snapshot: string };
  if (body.kind === "post") {
    const { post } = await readable(db, m, idOf(body.id));
    target = { kind: "post", id: String(post.id), user: post.authorId, snapshot: post.body };
  } else if (body.kind === "profile") {
    const p = await other(db, m, body.id, true);
    if (p.hiddenAt) throw new GameError(CLUB_COPY.notFound);
    target = { kind: "profile", id: p.userId, user: p.userId, snapshot: `${p.name} | @${p.handle} | ${p.building}` };
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

async function hideTarget(db: Db, kind: string, id: string, at: string | null) {
  if (kind === "post" && at && (await db.getPost(Number(id)))?.authorId === null) return; // never the Wolf's
  if (kind === "post") await db.setPostState(Number(id), at ? { hiddenAt: at } : { hiddenAt: null, held: null });
  else if (kind === "profile") await db.updateClubProfile(id, { hiddenAt: at });
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
export async function moderate(db: Db, input: { reportId: number; action: ModAction; hideAll?: boolean }, now = new Date()) {
  const r = await db.getReport(input.reportId);
  if (!r) return null;
  const at = now.toISOString();
  const { action } = input;
  const author = r.targetUser;
  const removes = action !== "keep" && action !== "lift";
  await hideTarget(db, r.targetKind, r.targetId, removes ? at : null);
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
      });
      await db.resolveReports("post", String(p.id), "removed", at);
    }
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
  const removals = (u: string | null) => (u ? done.filter((d) => d.targetUser === u && d.status === "removed").length : 0);
  const row = (r: ReportRow) => ({
    ...r,
    reporter: r.reporterId ? (handles.get(r.reporterId) ?? "A player") : "Automatic",
    author: r.targetUser ? (handles.get(r.targetUser) ?? "Deleted account") : "The Wolf",
    removals: removals(r.targetUser),
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
