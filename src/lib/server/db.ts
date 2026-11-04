// Storage for the server. The game logic (src/lib/server/game.ts) talks to this interface only, so tests run it
// against `memoryDb()` and production against Supabase. Tables: supabase/migrations/.
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TEST_OUT_PASS, type DailyNote, type GameState } from "../game-state.ts";
import type { Grade } from "../hotseat-types";
import { FOUNDING } from "../offer";

/** The saved part of a player's state. Runs, the Daily log and the league live in their own tables. */
export type SavedState = Omit<GameState, "runs" | "dailyLog" | "league">;

export interface Profile {
  state: SavedState;
  version: number;
  imported: boolean;
}

export interface RunRow {
  userId: string;
  runKey: string;
  hotSeatId: string;
  picks: { nodeId: string; optionId: string }[];
  score: number;
  xp: number;
  endingId: string;
  endingTier: string;
  notes: unknown;
  patterns: string[];
  createdAt?: string;
}

export interface DailyRow {
  userId: string;
  day: string;
  callId: string;
  optionId: string;
  grade: Grade;
  xp: number;
  note: DailyNote;
}

export interface LessonPlayRow {
  userId: string;
  playKey: string;
  /** A lesson id, or `test-<module id>` for a test-out quiz. */
  lessonId: string;
  answers: unknown;
  accuracy: number;
  xp: number;
}

export interface LeagueRow {
  weekId: string;
  userId: string;
  tier: number;
  cohort: number;
  weeklyXp: number;
}

/** What the server can prove a player finished, for the career ladder. Never read from the phone's save. */
export interface CareerRecords {
  /** Lessons played on the server (lesson_plays) or finished before the paywall (early_access). */
  lessons: string[];
  /** Modules whose test-out quiz the player passed (lesson_plays rows "test-<module id>"). */
  testOuts: string[];
  /** Hot Seats played to an ending (runs) or before the paywall (early_access). */
  hotSeats: string[];
}

export interface PushRow {
  endpoint: string;
  userId: string;
  keys: { p256dh: string; auth: string };
  remindHour: number;
}

export interface MembershipRow {
  userId: string;
  plan: "founding" | "monthly" | "yearly";
  subscriptionId: string;
  status: string;
  currentEnd: string | null;
}

export interface PaymentIssue {
  kind: string;
  subscriptionId: string;
  userId: string | null;
}

export interface SeatRow {
  seatNo: number;
  userId: string | null;
  subscriptionId: string;
  /** Set while the seat is an unpaid hold; null once the first charge keeps it. */
  heldUntil: number | null;
  cancelledAt: number | null;
}

/* The Club (supabase/migrations/20261105090000_club.sql). */
export interface ClubProfileRow {
  userId: string;
  handle: string;
  name: string;
  building: string;
  rank: number;
  stars: number;
  maxStars: number;
  streak: number;
  streakDay: string | null;
  milestones: boolean;
  adultAt: string;
  rulesAt: string;
  hiddenAt: string | null;
  createdAt: string;
}

export interface PostRow {
  id: number;
  /** null: the Wolf. */
  authorId: string | null;
  kind: "post" | "reply" | "rank_up" | "hotseat" | "question";
  ref: string | null;
  parentId: number | null;
  body: string;
  likeCount: number;
  replyCount: number;
  held: string | null;
  hiddenAt: string | null;
  createdAt: string;
}

export interface ReportRow {
  id: number;
  reporterId: string | null;
  targetKind: "post" | "profile" | "message";
  targetId: string;
  targetUser: string | null;
  reason: string;
  note: string;
  snapshot: string;
  status: "open" | "removed" | "kept";
  dueAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export type ActivityKind = "reply" | "like" | "follow" | "report_done" | "removed";
export interface ActivityRow {
  id: number;
  userId: string;
  kind: ActivityKind;
  actorId: string | null;
  postId: number | null;
  /** report_done: "removed" or "kept"; removed: the report reason. */
  detail: string | null;
  seen: boolean;
  createdAt: string;
}

/* Chats (supabase/migrations/20261106090000_club_chat.sql). */
export interface ChatMemberRow {
  chatId: number;
  userId: string;
  state: "active" | "request" | "declined" | "left";
  lastReadId: number;
  clearedId: number;
  activeAt: string | null;
}
export interface MessageRow {
  id: number;
  chatId: number;
  senderId: string;
  clientId: string;
  body: string;
  flagged: "auto_scam" | "auto_link" | null;
  held: boolean;
  hiddenAt: string | null;
  createdAt: string;
}
export interface InboxRow {
  chatId: number;
  lastAt: string;
  lastReadId: number;
  /** null once the other player deleted their account. */
  otherId: string | null;
  /** The last message this player may see. */
  last: MessageRow;
}

export interface Db {
  getProfile(userId: string): Promise<Profile | null>;
  /** Creates the profile unless one exists. */
  createProfile(userId: string, state: SavedState): Promise<void>;
  /** Writes only if the stored version still equals `version`; returns whether it did. */
  saveProfile(userId: string, version: number, state: SavedState, opts?: { imported?: boolean }): Promise<boolean>;
  /** Returns false if this user already has a run with the same runKey. */
  insertRun(row: RunRow): Promise<boolean>;
  listRuns(userId: string, limit: number): Promise<RunRow[]>;
  countRuns(userId: string, hotSeatId?: string): Promise<number>;
  /** Returns false if this user already has a lesson play with the same playKey. */
  insertLessonPlay(row: LessonPlayRow): Promise<boolean>;
  /** Lesson ids this player finished on the server (lesson_plays), test-out quizzes left out. */
  finishedLessons(userId: string): Promise<Set<string>>;
  /** Each player's career records, in a few queries for the whole group. Players with none are left out. */
  careerRecords(userIds: string[]): Promise<Record<string, CareerRecords>>;
  /** Returns false if the user already played a Daily Call that day. */
  insertDaily(row: DailyRow): Promise<boolean>;
  getDaily(userId: string, day: string): Promise<DailyRow | null>;
  listDaily(userId: string, limit: number): Promise<DailyRow[]>;
  /** Adds XP to the week's league, placing the player in a cohort of their tier first if needed. */
  addLeagueXp(weekId: string, userId: string, tier: number, xp: number): Promise<void>;
  getLeague(weekId: string, userId: string): Promise<LeagueRow | null>;
  /** The player's most recent league row before `weekId`. */
  lastLeague(userId: string, beforeWeekId: string): Promise<LeagueRow | null>;
  cohort(weekId: string, cohort: number): Promise<LeagueRow[]>;
  /** Each player's in-game name, by id. */
  names(userIds: string[]): Promise<Record<string, string>>;
  savePush(row: PushRow): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
  pushesAt(hour: number): Promise<PushRow[]>;
  /** Every subscription, or one player's. */
  pushes(userId?: string): Promise<PushRow[]>;
  /** Record a notification as sent. False if this kind already went to this player that day. */
  logNotice(userId: string, kind: string, day: string): Promise<boolean>;
  /** How many notifications a player got that day. */
  noticesOn(userId: string, day: string): Promise<number>;
  deleteUser(userId: string): Promise<void>;
  /** How many founding seats are taken (paid founding members). */
  countFoundingSeats(): Promise<number>;
  getMembership(userId: string): Promise<MembershipRow | null>;
  membershipBySubscription(subscriptionId: string): Promise<MembershipRow | null>;
  saveMembership(row: MembershipRow): Promise<void>;
  /**
   * Compare-and-swap: write `row` only while the player's stored subscription is still `expected` (null: only when
   * they have no membership row yet). Returns whether it wrote.
   */
  replaceMembership(userId: string, expected: string | null, row: MembershipRow): Promise<boolean>;
  /** Record a webhook event as handled. False if it already was. */
  insertPaymentEvent(eventId: string): Promise<boolean>;
  /** Whether this webhook event id was already handled. */
  hasPaymentEvent(eventId: string): Promise<boolean>;
  /** A payment problem a person must sort out by hand (payment_issues). No PII beyond the ids. */
  recordPaymentIssue(kind: string, subscriptionId: string, userId?: string): Promise<void>;
  /** Hold the lowest free founding seat for 30 minutes; null when all 1,000 are taken. */
  claimSeat(userId: string, subscriptionId: string): Promise<number | null>;
  /** The first charge: keep the held seat for good. False when no seat is held for it (the hold ran out or moved). */
  keepSeat(subscriptionId: string): Promise<boolean>;
  /** Whether this player ever kept (paid for) a founding seat; cancelling gives up the founding price for good. */
  hasKeptSeat(userId: string): Promise<boolean>;
  /** Mark a kept seat cancelled; an unpaid hold is simply removed. */
  cancelSeat(subscriptionId: string): Promise<void>;
  /** `lesson:<id>` / `hotseat:<id>` keys this player finished before the paywall. */
  earlyAccess(userId: string): Promise<Set<string>>;
  /** The founding seat number held or kept for this subscription, if any. */
  seatOf(subscriptionId: string): Promise<number | null>;
  /** When the account was created (auth.users), or null if it doesn't exist. */
  accountCreatedAt(userId: string): Promise<string | null>;

  /* The Club. Every list leaves out hidden posts; held ones are filtered in club.ts. */
  clubProfile(userId: string): Promise<ClubProfileRow | null>;
  clubProfileByHandle(handle: string): Promise<ClubProfileRow | null>;
  clubProfiles(userIds: string[]): Promise<ClubProfileRow[]>;
  /** False when the handle is taken. */
  insertClubProfile(row: ClubProfileRow): Promise<boolean>;
  /** Does nothing for a player who hasn't joined. */
  updateClubProfile(userId: string, patch: Partial<Omit<ClubProfileRow, "userId" | "handle">>): Promise<void>;
  /** "Leave the Club": everything the profile owns goes with it. */
  deleteClubProfile(userId: string): Promise<void>;
  clubBan(userId: string): Promise<{ until: string; reason: "mod" | "left" } | null>;
  /** `until` null lifts it. */
  setClubBan(userId: string, until: string | null, reason?: "mod" | "left"): Promise<void>;
  /** null when a once-only post (the Wolf's, a rank-up) already exists. */
  insertPost(row: Omit<PostRow, "id" | "likeCount" | "replyCount">): Promise<PostRow | null>;
  getPost(id: number): Promise<PostRow | null>;
  wolfPost(kind: "hotseat" | "question", ref: string): Promise<PostRow | null>;
  deletePost(id: number): Promise<void>;
  setPostState(id: number, patch: { held?: string | null; hiddenAt?: string | null }): Promise<void>;
  /** Hide every visible post and reply by this author; returns what it hid. */
  hidePostsBy(authorId: string, at: string): Promise<PostRow[]>;
  /** Visible, not held root posts made after `since` and at or before `asOf`, newest first. */
  feedCandidates(since: string, asOf: string, limit: number): Promise<PostRow[]>;
  /** Visible, not held root posts by people `viewer` follows, newest first, ids below `before`. */
  followingFeed(viewer: string, before: number, limit: number): Promise<PostRow[]>;
  /** Root posts (held included), newest first. */
  postsBy(authorId: string, before: number, limit: number): Promise<PostRow[]>;
  /** Replies (held included), oldest first, ids above `after`. */
  replies(parentId: number, after: number, limit: number): Promise<PostRow[]>;
  countPostsSince(authorId: string, kind: "post" | "reply", since: string): Promise<number>;
  /** Whether this author posted this exact text since `since`. */
  lastPostBody(authorId: string, since: string, body: string): Promise<boolean>;
  setLike(postId: number, userId: string, on: boolean): Promise<void>;
  likedOf(userId: string, postIds: number[]): Promise<Set<number>>;
  setFollow(follower: string, followee: string, on: boolean, at?: string): Promise<void>;
  followCounts(userId: string): Promise<{ followers: number; following: number }>;
  follows(follower: string, followee: string): Promise<boolean>;
  /** Which of `ids` this player follows. */
  followedAmong(follower: string, ids: string[]): Promise<Set<string>>;
  countFollowsSince(follower: string, since: string): Promise<number>;
  setBlock(blocker: string, blocked: string, on: boolean): Promise<void>;
  /** Who this player blocked (`out`) and who blocked them (`in`). */
  blocks(userId: string): Promise<{ out: Set<string>; in: Set<string> }>;
  /** False when this reporter already reported it. */
  insertReport(row: Omit<ReportRow, "id" | "status" | "resolvedAt">): Promise<boolean>;
  getReport(id: number): Promise<ReportRow | null>;
  openReportsOn(targetKind: string, targetId: string): Promise<ReportRow[]>;
  /** `instantOnly`: only reports with a reason that hides at once (private, fake). */
  countReportsSince(reporterId: string, since: string, instantOnly?: boolean): Promise<number>;
  /** Open reports, soonest due first. */
  reportQueue(): Promise<ReportRow[]>;
  /** Reports resolved since `since`, newest first. */
  resolvedReports(since: string): Promise<ReportRow[]>;
  /** Resolve every open report on a target; returns them. */
  resolveReports(targetKind: string, targetId: string, status: "removed" | "kept", at: string): Promise<ReportRow[]>;
  myReports(reporterId: string): Promise<ReportRow[]>;
  addActivity(row: {
    userId: string;
    kind: ActivityKind;
    actorId?: string;
    postId?: number;
    detail?: string;
    createdAt: string;
  }): Promise<void>;
  activity(userId: string, before: number, limit: number): Promise<ActivityRow[]>;
  markActivitySeen(userId: string, upTo: number): Promise<void>;
  unseenActivity(userId: string): Promise<number>;
  /** How many Club notifications (kinds starting club_) a player got that day. */
  clubNoticesOn(userId: string, day: string): Promise<number>;

  /* Chats. */
  chatByPair(pair: string): Promise<{ id: number } | null>;
  /** Makes the chat and its members; a pair that already has one gets that chat. */
  createChat(pair: string, createdBy: string, members: { userId: string; state: ChatMemberRow["state"] }[], at: string): Promise<number>;
  chatMembers(chatId: number): Promise<ChatMemberRow[]>;
  setMember(chatId: number, userId: string, patch: Partial<Omit<ChatMemberRow, "chatId" | "userId">>): Promise<void>;
  /** Newest first, chats with something this player may see (rpc club_inbox). */
  inbox(userId: string, state: "active" | "request", before: string | null, limit: number): Promise<InboxRow[]>;
  /** Saves once per (sender, clientId) and moves the chat to the top unless held (rpc club_send). */
  sendMessage(row: Omit<MessageRow, "id" | "hiddenAt" | "createdAt">, at: string): Promise<MessageRow>;
  getMessage(id: number): Promise<MessageRow | null>;
  /** Not hidden; ascending by id. `before`: the newest `limit` below it; `after`: the first `limit` above it. */
  messages(chatId: number, opts: { before?: number; after?: number; afterCleared: number; limit: number }): Promise<MessageRow[]>;
  /** The newest message id in a chat, hidden ones too (0 when empty). */
  lastMessageId(chatId: number): Promise<number>;
  countMessages(chatId: number, senderId: string): Promise<number>;
  setMessageState(id: number, patch: { held?: boolean; hiddenAt?: string | null }): Promise<void>;
  /** "Ban and hide everything": hides every message they sent and returns them. */
  hideMessagesBy(senderId: string, at: string): Promise<MessageRow[]>;
  /** Chats this player started since then; `requestsOnly`: those that began as a request. */
  countChatsSince(userId: string, since: string, requestsOnly: boolean): Promise<number>;
  unreadChats(userId: string): Promise<{ chats: number; requests: number }>;
  /** Chat pushes (kinds starting dm:) a player got that day. */
  dmNoticesOn(userId: string, day: string): Promise<number>;
}

/** Notification kinds with their own daily cap (the Club's), not counted in the game's. */
export const ownCap = (kind: string) => kind.startsWith("club_") || kind.startsWith("dm:");

/* ------------------------------------------------------------------ */
/* In memory, for tests.                                               */
/* ------------------------------------------------------------------ */
export function memoryDb(): Db & {
  profiles: Map<string, Profile>;
  runs: RunRow[];
  lessonPlays: LessonPlayRow[];
  leagues: LeagueRow[];
  foundingSeats: number;
  seats: SeatRow[];
  early: Map<string, Set<string>>;
  paymentIssues: PaymentIssue[];
  club: ReturnType<typeof clubStore>;
  /** auth.users created_at by id; an id missing here counts as an old account. */
  accounts: Map<string, string>;
} {
  const club = clubStore();
  const accounts = new Map<string, string>();
  const profiles = new Map<string, Profile>();
  const runs: RunRow[] = [];
  const lessonPlays: LessonPlayRow[] = [];
  const daily: DailyRow[] = [];
  const leagues: LeagueRow[] = [];
  const pushes = new Map<string, PushRow>();
  const notices = new Set<string>();
  const memberships = new Map<string, MembershipRow>();
  const events = new Set<string>();
  const seats: SeatRow[] = [];
  const early = new Map<string, Set<string>>();
  const paymentIssues: PaymentIssue[] = [];
  const SEAT_HOLD_MS = 30 * 60 * 1000;
  /** A seat is used if it is kept, or an unpaid hold that has not run out. */
  const live = (s: SeatRow) => s.heldUntil === null || s.heldUntil > Date.now();
  const clone = <T>(x: T): T => structuredClone(x);
  return {
    profiles,
    runs,
    lessonPlays,
    leagues,
    async getProfile(id) {
      const p = profiles.get(id);
      return p ? clone(p) : null;
    },
    async createProfile(id, state) {
      if (!profiles.has(id)) profiles.set(id, { state: clone(state), version: 0, imported: false });
    },
    async saveProfile(id, version, state, opts) {
      const p = profiles.get(id);
      if (!p || p.version !== version) return false;
      profiles.set(id, { state: clone(state), version: version + 1, imported: opts?.imported ?? p.imported });
      return true;
    },
    async insertRun(row) {
      if (runs.some((r) => r.userId === row.userId && r.runKey === row.runKey)) return false;
      runs.unshift({ ...clone(row), createdAt: new Date().toISOString() });
      return true;
    },
    async listRuns(id, limit) {
      return clone(runs.filter((r) => r.userId === id).slice(0, limit));
    },
    async countRuns(id, hotSeatId) {
      return runs.filter((r) => r.userId === id && (!hotSeatId || r.hotSeatId === hotSeatId)).length;
    },
    async insertLessonPlay(row) {
      if (lessonPlays.some((r) => r.userId === row.userId && r.playKey === row.playKey)) return false;
      lessonPlays.unshift(clone(row));
      return true;
    },
    async finishedLessons(id) {
      return new Set(lessonPlays.filter((r) => r.userId === id && !r.lessonId.startsWith("test-")).map((r) => r.lessonId));
    },
    async careerRecords(ids) {
      const out: Record<string, CareerRecords> = {};
      const of = (id: string) => (out[id] ??= { lessons: [], testOuts: [], hotSeats: [] });
      for (const r of lessonPlays.filter((r) => ids.includes(r.userId)))
        if (!r.lessonId.startsWith("test-")) of(r.userId).lessons.push(r.lessonId);
        else if (r.accuracy >= TEST_OUT_PASS) of(r.userId).testOuts.push(r.lessonId.slice(5));
      for (const r of runs.filter((r) => ids.includes(r.userId))) of(r.userId).hotSeats.push(r.hotSeatId);
      for (const id of ids)
        for (const key of early.get(id) ?? []) {
          const [kind, item] = key.split(":");
          of(id)[kind === "lesson" ? "lessons" : "hotSeats"].push(item);
        }
      return out;
    },
    async insertDaily(row) {
      if (daily.some((d) => d.userId === row.userId && d.day === row.day)) return false;
      daily.unshift(clone(row));
      return true;
    },
    async getDaily(id, day) {
      return clone(daily.find((d) => d.userId === id && d.day === day) ?? null);
    },
    async listDaily(id, limit) {
      return clone(daily.filter((d) => d.userId === id).slice(0, limit));
    },
    async addLeagueXp(weekId, userId, tier, xp) {
      let row = leagues.find((l) => l.weekId === weekId && l.userId === userId);
      if (!row) {
        const sizes = new Map<number, number>();
        for (const l of leagues) if (l.weekId === weekId && l.tier === tier) sizes.set(l.cohort, (sizes.get(l.cohort) ?? 0) + 1);
        const open = [...sizes].filter(([, n]) => n < 30).map(([c]) => c);
        const cohort = open.length
          ? Math.max(...open)
          : Math.max(0, ...leagues.filter((l) => l.weekId === weekId).map((l) => l.cohort)) + 1;
        row = { weekId, userId, tier, cohort, weeklyXp: 0 };
        leagues.push(row);
      }
      row.weeklyXp += Math.max(0, xp);
    },
    async getLeague(weekId, userId) {
      return clone(leagues.find((l) => l.weekId === weekId && l.userId === userId) ?? null);
    },
    async lastLeague(userId, before) {
      const mine = leagues.filter((l) => l.userId === userId && l.weekId < before).sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
      return clone(mine[0] ?? null);
    },
    async cohort(weekId, cohort) {
      return clone(leagues.filter((l) => l.weekId === weekId && l.cohort === cohort));
    },
    async names(ids) {
      return Object.fromEntries(ids.filter((id) => profiles.has(id)).map((id) => [id, profiles.get(id)!.state.name]));
    },
    async savePush(row) {
      pushes.set(row.endpoint, clone(row));
    },
    async deletePush(endpoint) {
      pushes.delete(endpoint);
    },
    async pushesAt(hour) {
      return clone([...pushes.values()].filter((p) => p.remindHour === hour));
    },
    async pushes(userId) {
      return clone([...pushes.values()].filter((p) => !userId || p.userId === userId));
    },
    async logNotice(id, kind, day) {
      const k = `${id}|${day}|${kind}`;
      if (notices.has(k)) return false;
      notices.add(k);
      return true;
    },
    async noticesOn(id, day) {
      return [...notices].filter((k) => k.startsWith(`${id}|${day}|`) && !ownCap(k.split("|")[2])).length;
    },
    async clubNoticesOn(id, day) {
      return [...notices].filter((k) => k.startsWith(`${id}|${day}|club_`)).length;
    },
    async dmNoticesOn(id, day) {
      return [...notices].filter((k) => k.startsWith(`${id}|${day}|dm:`)).length;
    },
    async deleteUser(id) {
      profiles.delete(id);
      // As the migration's cascades: the Club profile and all it owns, the ban; reports keep their snapshot.
      club.dropProfile(id);
      club.bans.delete(id);
      for (const r of club.reports) if (r.reporterId === id) r.reporterId = null;
      accounts.delete(id);
      for (const list of [runs, lessonPlays, daily, leagues] as { userId: string }[][])
        for (let i = list.length - 1; i >= 0; i--) if (list[i].userId === id) list.splice(i, 1);
      for (const [k, p] of pushes) if (p.userId === id) pushes.delete(k);
      memberships.delete(id);
      early.delete(id);
      for (const p of paymentIssues) if (p.userId === id) p.userId = null;
      // A paid seat stays used with no owner (same as the migration's on delete set null).
      for (let i = seats.length - 1; i >= 0; i--) {
        if (seats[i].userId !== id) continue;
        if (seats[i].heldUntil !== null) seats.splice(i, 1);
        else seats[i].userId = null;
      }
    },
    seats,
    early,
    paymentIssues,
    club,
    accounts,
    async accountCreatedAt(id) {
      return accounts.get(id) ?? "2000-01-01T00:00:00.000Z";
    },
    ...club.methods,
    foundingSeats: 0,
    async countFoundingSeats() {
      // `foundingSeats` is a test hook for a count with no rows behind it; it adds to the real seats.
      return this.foundingSeats + seats.filter(live).length;
    },
    async getMembership(id) {
      return clone(memberships.get(id) ?? null);
    },
    async membershipBySubscription(subscriptionId) {
      return clone([...memberships.values()].find((m) => m.subscriptionId === subscriptionId) ?? null);
    },
    async saveMembership(row) {
      memberships.set(row.userId, clone(row));
    },
    async replaceMembership(userId, expected, row) {
      if ((memberships.get(userId)?.subscriptionId ?? null) !== expected) return false;
      memberships.set(userId, clone(row));
      return true;
    },
    async insertPaymentEvent(eventId) {
      if (events.has(eventId)) return false;
      events.add(eventId);
      return true;
    },
    async hasPaymentEvent(eventId) {
      return events.has(eventId);
    },
    async recordPaymentIssue(kind, subscriptionId, userId) {
      paymentIssues.push({ kind, subscriptionId, userId: userId ?? null });
    },
    async claimSeat(userId, subscriptionId) {
      // A player who kept a seat before gets no second one (20261104100000_seat_rules.sql).
      if (seats.some((s) => s.userId === userId && s.heldUntil === null)) return null;
      // Same steps as claim_founding_seat(): drop this player's unpaid hold and any expired holds, then take the lowest free seat.
      for (let i = seats.length - 1; i >= 0; i--) {
        const s = seats[i];
        if (s.heldUntil !== null && (s.userId === userId || !live(s))) seats.splice(i, 1);
      }
      const used = new Set(seats.map((s) => s.seatNo));
      for (let n = 1; n <= FOUNDING.seats; n++) {
        if (used.has(n)) continue;
        seats.push({ seatNo: n, userId, subscriptionId, heldUntil: Date.now() + SEAT_HOLD_MS, cancelledAt: null });
        return n;
      }
      return null;
    },
    async keepSeat(subscriptionId) {
      const s = seats.find((x) => x.subscriptionId === subscriptionId);
      if (s) s.heldUntil = null;
      return !!s;
    },
    async hasKeptSeat(userId) {
      return seats.some((s) => s.userId === userId && s.heldUntil === null);
    },
    async cancelSeat(subscriptionId) {
      for (let i = seats.length - 1; i >= 0; i--) {
        const s = seats[i];
        if (s.subscriptionId !== subscriptionId) continue;
        if (s.heldUntil !== null) seats.splice(i, 1);
        else if (s.cancelledAt === null) s.cancelledAt = Date.now();
      }
    },
    async earlyAccess(userId) {
      return new Set(early.get(userId) ?? []);
    },
    async seatOf(subscriptionId) {
      return seats.find((s) => s.subscriptionId === subscriptionId)?.seatNo ?? null;
    },
  };
}

/** The Club's tables in memory, with the migration's cascades and count triggers. */
function clubStore() {
  const profiles = new Map<string, ClubProfileRow>();
  const bans = new Map<string, { until: string; reason: "mod" | "left" }>();
  const posts: PostRow[] = [];
  const likes: { postId: number; userId: string }[] = [];
  const follows: { follower: string; followee: string; at: string }[] = [];
  const blocks: { blocker: string; blocked: string }[] = [];
  const reports: ReportRow[] = [];
  const activity: ActivityRow[] = [];
  /** club_post_log: what the daily caps count, untouched by deleting a post (20261105150000_club_fixes.sql). */
  const postLog: { authorId: string; kind: string; body: string; createdAt: string }[] = [];
  const chats: { id: number; pair: string; createdBy: string | null; lastAt: string; createdAt: string }[] = [];
  const members: ChatMemberRow[] = [];
  const messages: MessageRow[] = [];
  let nextId = 1;
  const clone = <T>(x: T): T => structuredClone(x);
  const prune = <T>(list: T[], gone: (x: T) => boolean) => {
    for (let i = list.length - 1; i >= 0; i--) if (gone(list[i])) list.splice(i, 1);
  };
  const root = (p: PostRow) => p.kind === "post" || p.kind === "rank_up";
  const since = (at: string, from: string) => Date.parse(at) >= Date.parse(from);
  /** reply_count counts only replies everyone can see (the club_count trigger). */
  const shown = (p: PostRow) => !p.held && !p.hiddenAt;
  const bump = (p: PostRow, d: number) => {
    const parent = p.parentId === null ? undefined : posts.find((x) => x.id === p.parentId);
    if (parent) parent.replyCount += d;
  };
  /** Change held/hidden, moving the parent's reply count as the trigger does. */
  const restate = (p: PostRow, patch: Partial<Pick<PostRow, "held" | "hiddenAt">>) => {
    const was = shown(p);
    Object.assign(p, patch);
    if (was !== shown(p)) bump(p, shown(p) ? 1 : -1);
  };

  function dropPosts(gone: (p: PostRow) => boolean) {
    const ids = new Set(posts.filter(gone).map((p) => p.id));
    for (const p of posts) if (p.parentId !== null && ids.has(p.parentId)) ids.add(p.id); // replies cascade
    for (const p of posts) if (ids.has(p.id) && p.parentId !== null && !ids.has(p.parentId) && shown(p)) bump(p, -1);
    prune(likes, (l) => ids.has(l.postId));
    prune(activity, (a) => a.postId !== null && ids.has(a.postId));
    prune(posts, (p) => ids.has(p.id));
  }

  function dropProfile(id: string) {
    if (!profiles.delete(id)) return;
    dropPosts((p) => p.authorId === id);
    prune(postLog, (l) => l.authorId === id);
    for (const l of likes.filter((l) => l.userId === id)) {
      const p = posts.find((x) => x.id === l.postId);
      if (p) p.likeCount--;
    }
    prune(likes, (l) => l.userId === id);
    prune(follows, (f) => f.follower === id || f.followee === id);
    prune(blocks, (b) => b.blocker === id || b.blocked === id);
    prune(activity, (a) => a.userId === id || a.actorId === id);
    prune(members, (m) => m.userId === id);
    prune(messages, (m) => m.senderId === id);
    for (const c of chats) if (c.createdBy === id) c.createdBy = null;
  }

  const methods: Pick<
    Db,
    | "clubProfile"
    | "clubProfileByHandle"
    | "clubProfiles"
    | "insertClubProfile"
    | "updateClubProfile"
    | "deleteClubProfile"
    | "clubBan"
    | "setClubBan"
    | "insertPost"
    | "getPost"
    | "wolfPost"
    | "deletePost"
    | "setPostState"
    | "hidePostsBy"
    | "feedCandidates"
    | "followingFeed"
    | "postsBy"
    | "replies"
    | "countPostsSince"
    | "lastPostBody"
    | "setLike"
    | "likedOf"
    | "setFollow"
    | "followCounts"
    | "follows"
    | "followedAmong"
    | "countFollowsSince"
    | "setBlock"
    | "blocks"
    | "insertReport"
    | "getReport"
    | "openReportsOn"
    | "countReportsSince"
    | "reportQueue"
    | "resolvedReports"
    | "resolveReports"
    | "myReports"
    | "addActivity"
    | "activity"
    | "markActivitySeen"
    | "unseenActivity"
    | "chatByPair"
    | "createChat"
    | "chatMembers"
    | "setMember"
    | "inbox"
    | "sendMessage"
    | "getMessage"
    | "messages"
    | "lastMessageId"
    | "countMessages"
    | "setMessageState"
    | "hideMessagesBy"
    | "countChatsSince"
    | "unreadChats"
  > = {
    async clubProfile(id) {
      return clone(profiles.get(id) ?? null);
    },
    async clubProfileByHandle(handle) {
      return clone([...profiles.values()].find((p) => p.handle === handle) ?? null);
    },
    async clubProfiles(ids) {
      return clone(ids.flatMap((id) => (profiles.has(id) ? [profiles.get(id)!] : [])));
    },
    async insertClubProfile(row) {
      if ([...profiles.values()].some((p) => p.handle === row.handle) || profiles.has(row.userId)) return false;
      profiles.set(row.userId, clone(row));
      return true;
    },
    async updateClubProfile(id, patch) {
      const p = profiles.get(id);
      if (p) Object.assign(p, clone(patch));
    },
    async deleteClubProfile(id) {
      dropProfile(id);
    },
    async clubBan(id) {
      return clone(bans.get(id) ?? null);
    },
    async setClubBan(id, until, reason = "mod") {
      if (until === null) bans.delete(id);
      else bans.set(id, { until, reason });
    },
    async insertPost(row) {
      if (
        posts.some(
          (p) =>
            (row.authorId === null && p.kind === row.kind && p.ref === row.ref) ||
            (row.kind === "rank_up" && p.kind === "rank_up" && p.authorId === row.authorId && p.ref === row.ref),
        )
      )
        return null;
      const p: PostRow = { ...clone(row), id: nextId++, likeCount: 0, replyCount: 0 };
      posts.push(p);
      if (shown(p)) bump(p, 1);
      if (p.authorId && (p.kind === "post" || p.kind === "reply"))
        postLog.push({ authorId: p.authorId, kind: p.kind, body: p.body, createdAt: p.createdAt });
      return clone(p);
    },
    async getPost(id) {
      return clone(posts.find((p) => p.id === id) ?? null);
    },
    async wolfPost(kind, ref) {
      return clone(posts.find((p) => p.authorId === null && p.kind === kind && p.ref === ref) ?? null);
    },
    async deletePost(id) {
      dropPosts((p) => p.id === id);
    },
    async setPostState(id, patch) {
      const p = posts.find((x) => x.id === id);
      if (p) restate(p, patch);
    },
    async hidePostsBy(authorId, at) {
      const hit = posts.filter((p) => p.authorId === authorId && p.hiddenAt === null);
      for (const p of hit) restate(p, { hiddenAt: at });
      return clone(hit);
    },
    async feedCandidates(from, asOf, limit) {
      return clone(
        posts
          .filter((p) => root(p) && !p.hiddenAt && !p.held && Date.parse(p.createdAt) > Date.parse(from) && p.createdAt <= asOf)
          .sort((a, b) => b.id - a.id)
          .slice(0, limit),
      );
    },
    async followingFeed(viewer, before, limit) {
      const followed = new Set(follows.filter((f) => f.follower === viewer).map((f) => f.followee));
      return clone(
        posts
          .filter((p) => root(p) && !p.hiddenAt && !p.held && p.id < before && p.authorId && followed.has(p.authorId))
          .sort((a, b) => b.id - a.id)
          .slice(0, limit),
      );
    },
    async postsBy(authorId, before, limit) {
      return clone(
        posts
          .filter((p) => p.authorId === authorId && root(p) && !p.hiddenAt && p.id < before)
          .sort((a, b) => b.id - a.id)
          .slice(0, limit),
      );
    },
    async replies(parentId, after, limit) {
      return clone(posts.filter((p) => p.parentId === parentId && !p.hiddenAt && p.id > after).slice(0, limit));
    },
    async countPostsSince(authorId, kind, from) {
      return postLog.filter((p) => p.authorId === authorId && p.kind === kind && since(p.createdAt, from)).length;
    },
    async lastPostBody(authorId, from, body) {
      return postLog.some((p) => p.authorId === authorId && p.body === body && since(p.createdAt, from));
    },
    async setLike(postId, userId, on) {
      const i = likes.findIndex((l) => l.postId === postId && l.userId === userId);
      const p = posts.find((x) => x.id === postId);
      if (on && i < 0 && p) {
        likes.push({ postId, userId });
        p.likeCount++;
      }
      if (!on && i >= 0) {
        likes.splice(i, 1);
        if (p) p.likeCount--;
      }
    },
    async likedOf(userId, ids) {
      return new Set(likes.filter((l) => l.userId === userId && ids.includes(l.postId)).map((l) => l.postId));
    },
    async setFollow(follower, followee, on, at = new Date().toISOString()) {
      const i = follows.findIndex((f) => f.follower === follower && f.followee === followee);
      if (on && i < 0) follows.push({ follower, followee, at });
      if (!on && i >= 0) follows.splice(i, 1);
    },
    async followCounts(id) {
      return { followers: follows.filter((f) => f.followee === id).length, following: follows.filter((f) => f.follower === id).length };
    },
    async follows(follower, followee) {
      return follows.some((f) => f.follower === follower && f.followee === followee);
    },
    async followedAmong(follower, ids) {
      return new Set(follows.filter((f) => f.follower === follower && ids.includes(f.followee)).map((f) => f.followee));
    },
    async countFollowsSince(follower, from) {
      return follows.filter((f) => f.follower === follower && since(f.at, from)).length;
    },
    async setBlock(blocker, blocked, on) {
      const i = blocks.findIndex((b) => b.blocker === blocker && b.blocked === blocked);
      if (on && i < 0) blocks.push({ blocker, blocked });
      if (!on && i >= 0) blocks.splice(i, 1);
    },
    async blocks(id) {
      return {
        out: new Set(blocks.filter((b) => b.blocker === id).map((b) => b.blocked)),
        in: new Set(blocks.filter((b) => b.blocked === id).map((b) => b.blocker)),
      };
    },
    async insertReport(row) {
      if (
        row.reporterId &&
        reports.some((r) => r.reporterId === row.reporterId && r.targetKind === row.targetKind && r.targetId === row.targetId)
      )
        return false;
      reports.push({ ...clone(row), id: nextId++, status: "open", resolvedAt: null });
      return true;
    },
    async getReport(id) {
      return clone(reports.find((r) => r.id === id) ?? null);
    },
    async openReportsOn(kind, id) {
      return clone(reports.filter((r) => r.targetKind === kind && r.targetId === id && r.status === "open"));
    },
    async countReportsSince(reporterId, from, instantOnly) {
      return reports.filter(
        (r) => r.reporterId === reporterId && since(r.createdAt, from) && (!instantOnly || r.reason === "private" || r.reason === "fake"),
      ).length;
    },
    async reportQueue() {
      return clone(reports.filter((r) => r.status === "open").sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)));
    },
    async resolvedReports(from) {
      return clone(
        reports
          .filter((r) => r.status !== "open" && r.resolvedAt && since(r.resolvedAt, from))
          .sort((a, b) => Date.parse(b.resolvedAt!) - Date.parse(a.resolvedAt!)),
      );
    },
    async resolveReports(kind, id, status, at) {
      const hit = reports.filter((r) => r.targetKind === kind && r.targetId === id && r.status === "open");
      for (const r of hit) Object.assign(r, { status, resolvedAt: at });
      return clone(hit);
    },
    async myReports(reporterId) {
      return clone(reports.filter((r) => r.reporterId === reporterId).sort((a, b) => b.id - a.id));
    },
    async addActivity(row) {
      if (
        row.kind === "like" &&
        activity.some((a) => a.kind === "like" && a.userId === row.userId && a.actorId === row.actorId && a.postId === row.postId)
      )
        return;
      activity.push({
        id: nextId++,
        userId: row.userId,
        kind: row.kind,
        actorId: row.actorId ?? null,
        postId: row.postId ?? null,
        detail: row.detail ?? null,
        seen: false,
        createdAt: row.createdAt,
      });
    },
    async activity(id, before, limit) {
      return clone(
        activity
          .filter((a) => a.userId === id && a.id < before)
          .sort((a, b) => b.id - a.id)
          .slice(0, limit),
      );
    },
    async markActivitySeen(id, upTo) {
      for (const a of activity) if (a.userId === id && a.id <= upTo) a.seen = true;
    },
    async unseenActivity(id) {
      return activity.filter((a) => a.userId === id && !a.seen).length;
    },
    async chatByPair(pair) {
      const c = chats.find((x) => x.pair === pair);
      return c ? { id: c.id } : null;
    },
    async createChat(pair, createdBy, list, at) {
      const old = chats.find((x) => x.pair === pair);
      if (old) return old.id;
      const id = nextId++;
      chats.push({ id, pair, createdBy, lastAt: at, createdAt: at });
      for (const m of list) members.push({ chatId: id, userId: m.userId, state: m.state, lastReadId: 0, clearedId: 0, activeAt: null });
      return id;
    },
    async chatMembers(chatId) {
      return clone(members.filter((m) => m.chatId === chatId));
    },
    async setMember(chatId, userId, patch) {
      const m = members.find((x) => x.chatId === chatId && x.userId === userId);
      if (m) Object.assign(m, patch);
    },
    async inbox(userId, state, before, limit) {
      const out: InboxRow[] = [];
      for (const me of members.filter((m) => m.userId === userId && m.state === state)) {
        const c = chats.find((x) => x.id === me.chatId)!;
        if (before && c.lastAt >= before) continue;
        const last = messages
          .filter((x) => x.chatId === c.id && !x.hiddenAt && (!x.held || x.senderId === userId) && x.id > me.clearedId)
          .at(-1);
        if (!last) continue;
        const other = members.find((m) => m.chatId === c.id && m.userId !== userId);
        out.push({ chatId: c.id, lastAt: c.lastAt, lastReadId: me.lastReadId, otherId: other?.userId ?? null, last: clone(last) });
      }
      return out.sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.chatId - a.chatId).slice(0, limit);
    },
    async sendMessage(row, at) {
      const old = messages.find((m) => m.senderId === row.senderId && m.clientId === row.clientId);
      if (old) return clone(old);
      const m: MessageRow = { ...clone(row), id: nextId++, hiddenAt: null, createdAt: at };
      messages.push(m);
      const c = chats.find((x) => x.id === row.chatId);
      if (c && !row.held) c.lastAt = at;
      return clone(m);
    },
    async getMessage(id) {
      return clone(messages.find((m) => m.id === id) ?? null);
    },
    async messages(chatId, { before, after, afterCleared, limit }) {
      const shown = messages.filter(
        (m) =>
          m.chatId === chatId &&
          !m.hiddenAt &&
          m.id > afterCleared &&
          (before === undefined || m.id < before) &&
          (after === undefined || m.id > after),
      );
      return clone(after !== undefined ? shown.slice(0, limit) : shown.slice(-limit));
    },
    async lastMessageId(chatId) {
      return messages.filter((m) => m.chatId === chatId).at(-1)?.id ?? 0;
    },
    async countMessages(chatId, senderId) {
      return messages.filter((m) => m.chatId === chatId && m.senderId === senderId).length;
    },
    async setMessageState(id, patch) {
      const m = messages.find((x) => x.id === id);
      if (m) Object.assign(m, patch);
    },
    async hideMessagesBy(senderId, at) {
      const hit = messages.filter((m) => m.senderId === senderId && m.hiddenAt === null);
      for (const m of hit) m.hiddenAt = at;
      return clone(hit);
    },
    async countChatsSince(userId, from, requestsOnly) {
      const asked = (id: number) =>
        members.some((m) => m.chatId === id && m.userId !== userId && (m.state === "request" || m.state === "declined"));
      return chats.filter((c) => c.createdBy === userId && since(c.createdAt, from) && (!requestsOnly || asked(c.id))).length;
    },
    async unreadChats(userId) {
      let chatsN = 0;
      let requests = 0;
      for (const me of members.filter((m) => m.userId === userId)) {
        const shown = messages.filter((x) => x.chatId === me.chatId && !x.hiddenAt && !x.held && x.id > me.clearedId);
        if (me.state === "active" && shown.some((x) => x.senderId !== userId && x.id > me.lastReadId)) chatsN++;
        if (me.state === "request" && shown.length) requests++;
      }
      return { chats: chatsN, requests };
    },
  };
  return { profiles, bans, posts, likes, follows, blocks, reports, activity, postLog, chats, members, messages, dropProfile, methods };
}

/* ------------------------------------------------------------------ */
/* Supabase, for the running app.                                      */
/* ------------------------------------------------------------------ */
let admin: SupabaseClient | undefined;
/** The server's Supabase client (secret key). Created on first use, so `next build` needs no keys. */
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server");
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

const must = <T>(r: { data: T | null; error: { message: string; code?: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
};
/** Like `must`, for queries that return a list (never null once there's no error). */
const list = <T>(r: { data: T[] | null; error: { message: string } | null }): T[] => must(r) ?? [];
/** Every row of a query, page by page (Supabase returns at most 1,000 rows a request). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = list(await page(from, from + 999));
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
/** True for a unique-key clash, which several writes use to mean "already done". */
const duplicate = (e: { code?: string } | null) => e?.code === "23505";

const runOf = (r: Record<string, unknown>): RunRow => ({
  userId: r.user_id as string,
  runKey: r.run_key as string,
  hotSeatId: r.hot_seat_id as string,
  picks: r.picks as RunRow["picks"],
  score: r.score as number,
  xp: r.xp as number,
  endingId: r.ending_id as string,
  endingTier: r.ending_tier as string,
  notes: r.notes,
  patterns: r.patterns as string[],
  createdAt: r.created_at as string,
});
const dailyOf = (r: Record<string, unknown>): DailyRow => ({
  userId: r.user_id as string,
  day: r.day as string,
  callId: r.call_id as string,
  optionId: r.option_id as string,
  grade: r.grade as Grade,
  xp: r.xp as number,
  note: r.note as DailyNote,
});
const leagueOf = (r: Record<string, unknown>): LeagueRow => ({
  weekId: r.week_id as string,
  userId: r.user_id as string,
  tier: r.tier as number,
  cohort: r.cohort as number,
  weeklyXp: r.weekly_xp as number,
});
const pushOf = (r: Record<string, unknown>): PushRow => ({
  endpoint: r.endpoint as string,
  userId: r.user_id as string,
  keys: r.keys as PushRow["keys"],
  remindHour: r.remind_hour as number,
});

const membershipOf = (r: Record<string, unknown>): MembershipRow => ({
  userId: r.user_id as string,
  plan: r.plan as MembershipRow["plan"],
  subscriptionId: r.razorpay_subscription_id as string,
  status: r.status as string,
  currentEnd: (r.current_end as string | null) ?? null,
});

const clubProfileOf = (r: Record<string, unknown>): ClubProfileRow => ({
  userId: r.user_id as string,
  handle: r.handle as string,
  name: r.name as string,
  building: r.building as string,
  rank: r.rank as number,
  stars: r.stars as number,
  maxStars: r.max_stars as number,
  streak: r.streak as number,
  streakDay: (r.streak_day as string | null) ?? null,
  milestones: r.milestones as boolean,
  adultAt: r.adult_at as string,
  rulesAt: r.rules_at as string,
  hiddenAt: (r.hidden_at as string | null) ?? null,
  createdAt: r.created_at as string,
});
const CLUB_PROFILE_COLS: Record<string, keyof ClubProfileRow> = {
  user_id: "userId",
  handle: "handle",
  name: "name",
  building: "building",
  rank: "rank",
  stars: "stars",
  max_stars: "maxStars",
  streak: "streak",
  streak_day: "streakDay",
  milestones: "milestones",
  adult_at: "adultAt",
  rules_at: "rulesAt",
  hidden_at: "hiddenAt",
  created_at: "createdAt",
};
/** The columns for a (partial) Club profile. */
const clubProfileRow = (p: Partial<ClubProfileRow>) =>
  Object.fromEntries(Object.entries(CLUB_PROFILE_COLS).flatMap(([col, k]) => (p[k] === undefined ? [] : [[col, p[k]]])));
const postOf = (r: Record<string, unknown>): PostRow => ({
  id: Number(r.id),
  authorId: (r.author_id as string | null) ?? null,
  kind: r.kind as PostRow["kind"],
  ref: (r.ref as string | null) ?? null,
  parentId: r.parent_id == null ? null : Number(r.parent_id),
  body: r.body as string,
  likeCount: r.like_count as number,
  replyCount: r.reply_count as number,
  held: (r.held as string | null) ?? null,
  hiddenAt: (r.hidden_at as string | null) ?? null,
  createdAt: r.created_at as string,
});
const reportOf = (r: Record<string, unknown>): ReportRow => ({
  id: Number(r.id),
  reporterId: (r.reporter_id as string | null) ?? null,
  targetKind: r.target_kind as ReportRow["targetKind"],
  targetId: r.target_id as string,
  targetUser: (r.target_user as string | null) ?? null,
  reason: r.reason as string,
  note: r.note as string,
  snapshot: r.snapshot as string,
  status: r.status as ReportRow["status"],
  dueAt: r.due_at as string,
  resolvedAt: (r.resolved_at as string | null) ?? null,
  createdAt: r.created_at as string,
});
const memberOf = (r: Record<string, unknown>): ChatMemberRow => ({
  chatId: Number(r.chat_id),
  userId: r.user_id as string,
  state: r.state as ChatMemberRow["state"],
  lastReadId: Number(r.last_read_id),
  clearedId: Number(r.cleared_id),
  activeAt: (r.active_at as string | null) ?? null,
});
const messageOf = (r: Record<string, unknown>): MessageRow => ({
  id: Number(r.id),
  chatId: Number(r.chat_id),
  senderId: r.sender_id as string,
  clientId: r.client_id as string,
  body: r.body as string,
  flagged: (r.flagged as MessageRow["flagged"]) ?? null,
  held: !!r.held,
  hiddenAt: (r.hidden_at as string | null) ?? null,
  createdAt: r.created_at as string,
});
const MEMBER_COLS: Record<string, keyof ChatMemberRow> = {
  state: "state",
  last_read_id: "lastReadId",
  cleared_id: "clearedId",
  active_at: "activeAt",
};
const activityOf = (r: Record<string, unknown>): ActivityRow => ({
  id: Number(r.id),
  userId: r.user_id as string,
  kind: r.kind as ActivityKind,
  actorId: (r.actor_id as string | null) ?? null,
  postId: r.post_id == null ? null : Number(r.post_id),
  detail: (r.detail as string | null) ?? null,
  seen: r.seen as boolean,
  createdAt: r.created_at as string,
});

export function supabaseDb(sb = supabaseAdmin()): Db {
  return {
    async getProfile(id) {
      const p = must<Profile | null>(await sb.from("profiles").select("state, version, imported").eq("id", id).maybeSingle());
      return p && { state: p.state, version: p.version, imported: p.imported };
    },
    async createProfile(id, state) {
      must(await sb.from("profiles").upsert({ id, state }, { onConflict: "id", ignoreDuplicates: true }));
    },
    async saveProfile(id, version, state, opts) {
      const rows = list(
        await sb
          .from("profiles")
          .update({ state, version: version + 1, updated_at: new Date().toISOString(), ...(opts?.imported ? { imported: true } : {}) })
          .eq("id", id)
          .eq("version", version)
          .select("id"),
      );
      return rows.length === 1;
    },
    async insertRun(row) {
      const { error } = await sb.from("runs").insert({
        user_id: row.userId,
        run_key: row.runKey,
        hot_seat_id: row.hotSeatId,
        picks: row.picks,
        score: row.score,
        xp: row.xp,
        ending_id: row.endingId,
        ending_tier: row.endingTier,
        notes: row.notes,
        patterns: row.patterns,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async listRuns(id, limit) {
      return list(await sb.from("runs").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(limit)).map(runOf);
    },
    async countRuns(id, hotSeatId) {
      let q = sb.from("runs").select("id", { count: "exact", head: true }).eq("user_id", id);
      if (hotSeatId) q = q.eq("hot_seat_id", hotSeatId);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async insertLessonPlay(row) {
      const { error } = await sb.from("lesson_plays").insert({
        user_id: row.userId,
        play_key: row.playKey,
        lesson_id: row.lessonId,
        answers: row.answers,
        accuracy: row.accuracy,
        xp: row.xp,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async finishedLessons(userId) {
      // Test-out quizzes are stored as "test-<module id>"; no lesson id starts with "test-".
      const rows = list(await sb.from("lesson_plays").select("lesson_id").eq("user_id", userId).not("lesson_id", "like", "test-%"));
      return new Set(rows.map((r) => r.lesson_id as string));
    },
    async careerRecords(ids) {
      const out: Record<string, CareerRecords> = {};
      if (!ids.length) return out;
      const of = (id: string) => (out[id] ??= { lessons: [], testOuts: [], hotSeats: [] });
      // One query per table for the whole group, paged because Supabase returns at most 1,000 rows at a time.
      const [plays, runs, early] = await Promise.all([
        all<{ user_id: string; lesson_id: string; accuracy: number }>((a, b) =>
          sb.from("lesson_plays").select("user_id, lesson_id, accuracy").in("user_id", ids).order("id").range(a, b),
        ),
        all<{ user_id: string; hot_seat_id: string }>((a, b) =>
          sb.from("runs").select("user_id, hot_seat_id").in("user_id", ids).order("id").range(a, b),
        ),
        all<{ user_id: string; kind: string; item_id: string }>((a, b) =>
          sb
            .from("early_access")
            .select("user_id, kind, item_id")
            .in("user_id", ids)
            .order("user_id")
            .order("kind")
            .order("item_id")
            .range(a, b),
        ),
      ]);
      for (const r of plays)
        if (!r.lesson_id.startsWith("test-")) of(r.user_id).lessons.push(r.lesson_id);
        else if (r.accuracy >= TEST_OUT_PASS) of(r.user_id).testOuts.push(r.lesson_id.slice(5));
      for (const r of runs) of(r.user_id).hotSeats.push(r.hot_seat_id);
      for (const r of early) of(r.user_id)[r.kind === "lesson" ? "lessons" : "hotSeats"].push(r.item_id);
      return out;
    },
    async insertDaily(row) {
      const { error } = await sb.from("daily_plays").insert({
        user_id: row.userId,
        day: row.day,
        call_id: row.callId,
        option_id: row.optionId,
        grade: row.grade,
        xp: row.xp,
        note: row.note,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async getDaily(id, day) {
      const r = must(await sb.from("daily_plays").select("*").eq("user_id", id).eq("day", day).maybeSingle());
      return r && dailyOf(r);
    },
    async listDaily(id, limit) {
      return list(await sb.from("daily_plays").select("*").eq("user_id", id).order("day", { ascending: false }).limit(limit)).map(dailyOf);
    },
    async addLeagueXp(weekId, userId, tier, xp) {
      must(await sb.rpc("add_league_xp", { p_week: weekId, p_user: userId, p_tier: tier, p_xp: xp }));
    },
    async getLeague(weekId, userId) {
      const r = must(await sb.from("league_members").select("*").eq("week_id", weekId).eq("user_id", userId).maybeSingle());
      return r && leagueOf(r);
    },
    async lastLeague(userId, before) {
      const r = must(
        await sb
          .from("league_members")
          .select("*")
          .eq("user_id", userId)
          .lt("week_id", before)
          .order("week_id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      );
      return r && leagueOf(r);
    },
    async cohort(weekId, cohort) {
      return list(await sb.from("league_members").select("*").eq("week_id", weekId).eq("cohort", cohort)).map(leagueOf);
    },
    async names(ids) {
      if (!ids.length) return {};
      const rows = list<{ id: string; name: string }>(await sb.from("profiles").select("id, name:state->>name").in("id", ids));
      return Object.fromEntries(rows.map((r) => [r.id, r.name]));
    },
    async savePush(row) {
      must(
        await sb
          .from("push_subscriptions")
          .upsert({ endpoint: row.endpoint, user_id: row.userId, keys: row.keys, remind_hour: row.remindHour }, { onConflict: "endpoint" }),
      );
    },
    async deletePush(endpoint) {
      must(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint));
    },
    async pushesAt(hour) {
      return list(await sb.from("push_subscriptions").select("*").eq("remind_hour", hour)).map(pushOf);
    },
    async pushes(userId) {
      let q = sb.from("push_subscriptions").select("*");
      if (userId) q = q.eq("user_id", userId);
      return list(await q).map(pushOf);
    },
    async logNotice(id, kind, day) {
      const { error } = await sb.from("notifications_sent").insert({ user_id: id, kind, day });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async noticesOn(id, day) {
      const { count, error } = await sb
        .from("notifications_sent")
        .select("kind", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("day", day)
        .not("kind", "like", "club\\_%")
        .not("kind", "like", "dm:%");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async deleteUser(id) {
      // An unpaid hold goes with the player, as in memoryDb; a kept seat stays used (user_id set null by the cascade).
      must(await sb.from("founding_seats").delete().eq("user_id", id).not("held_until", "is", null));
      // Every table cascades from auth.users, so deleting the user removes all their rows (the Club's too; a report
      // keeps its snapshot with reporter_id set null, and the Wolf's posts stay).
      const { error } = await sb.auth.admin.deleteUser(id);
      if (error) throw new Error(error.message);
    },
    async countFoundingSeats() {
      const { count, error } = await sb
        .from("founding_seats")
        .select("seat_no", { count: "exact", head: true })
        .or(`held_until.is.null,held_until.gt."${new Date().toISOString()}"`)
        .abortSignal(AbortSignal.timeout(3000));
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async getMembership(userId) {
      const r = must<Record<string, unknown> | null>(await sb.from("memberships").select("*").eq("user_id", userId).maybeSingle());
      return r && membershipOf(r);
    },
    async membershipBySubscription(subscriptionId) {
      const r = must<Record<string, unknown> | null>(
        await sb.from("memberships").select("*").eq("razorpay_subscription_id", subscriptionId).maybeSingle(),
      );
      return r && membershipOf(r);
    },
    async saveMembership(row) {
      must(
        await sb.from("memberships").upsert(
          {
            user_id: row.userId,
            plan: row.plan,
            razorpay_subscription_id: row.subscriptionId,
            status: row.status,
            current_end: row.currentEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        ),
      );
    },
    async replaceMembership(userId, expected, row) {
      const values = {
        user_id: userId,
        plan: row.plan,
        razorpay_subscription_id: row.subscriptionId,
        status: row.status,
        current_end: row.currentEnd,
        updated_at: new Date().toISOString(),
      };
      if (expected === null) {
        // The primary key on user_id makes a second insert fail: someone else wrote first.
        const { error } = await sb.from("memberships").insert(values);
        if (duplicate(error)) return false;
        if (error) throw new Error(error.message);
        return true;
      }
      const rows = list(
        await sb.from("memberships").update(values).eq("user_id", userId).eq("razorpay_subscription_id", expected).select("user_id"),
      );
      return rows.length > 0;
    },
    async insertPaymentEvent(eventId) {
      const { error } = await sb.from("payment_events").insert({ event_id: eventId });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async hasPaymentEvent(eventId) {
      return list(await sb.from("payment_events").select("event_id").eq("event_id", eventId).limit(1)).length > 0;
    },
    async recordPaymentIssue(kind, subscriptionId, userId) {
      must(await sb.from("payment_issues").insert({ kind, subscription_id: subscriptionId, user_id: userId ?? null }));
    },
    async claimSeat(userId, subscriptionId) {
      return must<number | null>(await sb.rpc("claim_founding_seat", { p_user: userId, p_subscription: subscriptionId }));
    },
    async keepSeat(subscriptionId) {
      const rows = list(
        await sb.from("founding_seats").update({ held_until: null }).eq("razorpay_subscription_id", subscriptionId).select("seat_no"),
      );
      return rows.length > 0;
    },
    async hasKeptSeat(userId) {
      const rows = list(await sb.from("founding_seats").select("seat_no").eq("user_id", userId).is("held_until", null).limit(1));
      return rows.length > 0;
    },
    async cancelSeat(subscriptionId) {
      must(await sb.from("founding_seats").delete().eq("razorpay_subscription_id", subscriptionId).not("held_until", "is", null));
      must(
        await sb
          .from("founding_seats")
          .update({ cancelled_at: new Date().toISOString() })
          .eq("razorpay_subscription_id", subscriptionId)
          .is("cancelled_at", null),
      );
    },
    async earlyAccess(userId) {
      const rows = list(await sb.from("early_access").select("kind, item_id").eq("user_id", userId));
      return new Set(rows.map((r) => `${r.kind}:${r.item_id}`));
    },
    async seatOf(subscriptionId) {
      const rows = list(await sb.from("founding_seats").select("seat_no").eq("razorpay_subscription_id", subscriptionId).limit(1));
      return rows.length ? Number(rows[0].seat_no) : null;
    },
    async accountCreatedAt(id) {
      const { data, error } = await sb.auth.admin.getUserById(id);
      if (error) return null;
      return data.user?.created_at ?? null;
    },
    async clubNoticesOn(id, day) {
      const { count, error } = await sb
        .from("notifications_sent")
        .select("kind", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("day", day)
        .like("kind", "club\\_%");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async clubProfile(id) {
      const r = must<Record<string, unknown> | null>(await sb.from("club_profiles").select("*").eq("user_id", id).maybeSingle());
      return r && clubProfileOf(r);
    },
    async clubProfileByHandle(handle) {
      const r = must<Record<string, unknown> | null>(await sb.from("club_profiles").select("*").eq("handle", handle).maybeSingle());
      return r && clubProfileOf(r);
    },
    async clubProfiles(ids) {
      if (!ids.length) return [];
      return list(await sb.from("club_profiles").select("*").in("user_id", ids)).map(clubProfileOf);
    },
    async insertClubProfile(row) {
      const { error } = await sb.from("club_profiles").insert(clubProfileRow(row));
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async updateClubProfile(id, patch) {
      const values = clubProfileRow(patch);
      if (Object.keys(values).length) must(await sb.from("club_profiles").update(values).eq("user_id", id));
    },
    async deleteClubProfile(id) {
      must(await sb.from("club_profiles").delete().eq("user_id", id));
    },
    async clubBan(id) {
      const r = must<{ until: string; reason: "mod" | "left" } | null>(
        await sb.from("club_bans").select("until, reason").eq("user_id", id).maybeSingle(),
      );
      return r && { until: r.until, reason: r.reason };
    },
    async setClubBan(id, until, reason = "mod") {
      if (until === null) must(await sb.from("club_bans").delete().eq("user_id", id));
      else
        must(
          await sb
            .from("club_bans")
            .upsert({ user_id: id, until, reason, created_at: new Date().toISOString() }, { onConflict: "user_id" }),
        );
    },
    async insertPost(row) {
      const { data, error } = await sb
        .from("club_posts")
        .insert({
          author_id: row.authorId,
          kind: row.kind,
          ref: row.ref,
          parent_id: row.parentId,
          body: row.body,
          held: row.held,
          hidden_at: row.hiddenAt,
          created_at: row.createdAt,
        })
        .select("*")
        .single();
      if (duplicate(error)) return null;
      if (error) throw new Error(error.message);
      return postOf(data);
    },
    async getPost(id) {
      const r = must<Record<string, unknown> | null>(await sb.from("club_posts").select("*").eq("id", id).maybeSingle());
      return r && postOf(r);
    },
    async wolfPost(kind, ref) {
      const r = must<Record<string, unknown> | null>(
        await sb.from("club_posts").select("*").is("author_id", null).eq("kind", kind).eq("ref", ref).maybeSingle(),
      );
      return r && postOf(r);
    },
    async deletePost(id) {
      must(await sb.from("club_posts").delete().eq("id", id));
    },
    async setPostState(id, patch) {
      const values: Record<string, unknown> = {};
      if (patch.held !== undefined) values.held = patch.held;
      if (patch.hiddenAt !== undefined) values.hidden_at = patch.hiddenAt;
      must(await sb.from("club_posts").update(values).eq("id", id));
    },
    async hidePostsBy(authorId, at) {
      return list(await sb.from("club_posts").update({ hidden_at: at }).eq("author_id", authorId).is("hidden_at", null).select("*")).map(
        postOf,
      );
    },
    async feedCandidates(since, asOf, limit) {
      return list(
        await sb
          .from("club_posts")
          .select("*")
          .in("kind", ["post", "rank_up"])
          .is("hidden_at", null)
          .is("held", null)
          .gt("created_at", since)
          .lte("created_at", asOf)
          .order("created_at", { ascending: false })
          .limit(limit),
      ).map(postOf);
    },
    async followingFeed(viewer, before, limit) {
      return list<Record<string, unknown>>(await sb.rpc("club_following", { p_viewer: viewer, p_before: before, p_limit: limit })).map(
        postOf,
      );
    },
    async postsBy(authorId, before, limit) {
      return list(
        await sb
          .from("club_posts")
          .select("*")
          .eq("author_id", authorId)
          .in("kind", ["post", "rank_up"])
          .is("hidden_at", null)
          .lt("id", before)
          .order("id", { ascending: false })
          .limit(limit),
      ).map(postOf);
    },
    async replies(parentId, after, limit) {
      return list(
        await sb.from("club_posts").select("*").eq("parent_id", parentId).is("hidden_at", null).gt("id", after).order("id").limit(limit),
      ).map(postOf);
    },
    async countPostsSince(authorId, kind, since) {
      // From club_post_log, so deleting a post doesn't reset the caps.
      const { count, error } = await sb
        .from("club_post_log")
        .select("author_id", { count: "exact", head: true })
        .eq("author_id", authorId)
        .eq("kind", kind)
        .gte("created_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async lastPostBody(authorId, since, body) {
      const rows = list(
        await sb
          .from("club_post_log")
          .select("author_id")
          .eq("author_id", authorId)
          .eq("body_md5", createHash("md5").update(body).digest("hex"))
          .gte("created_at", since)
          .limit(1),
      );
      return rows.length > 0;
    },
    async setLike(postId, userId, on) {
      if (!on) return void must(await sb.from("club_likes").delete().eq("post_id", postId).eq("user_id", userId));
      const { error } = await sb.from("club_likes").insert({ post_id: postId, user_id: userId });
      if (error && !duplicate(error)) throw new Error(error.message);
    },
    async likedOf(userId, ids) {
      if (!ids.length) return new Set<number>();
      const rows = list(await sb.from("club_likes").select("post_id").eq("user_id", userId).in("post_id", ids));
      return new Set(rows.map((r) => Number(r.post_id)));
    },
    async setFollow(follower, followee, on, at = new Date().toISOString()) {
      if (!on) return void must(await sb.from("club_follows").delete().eq("follower_id", follower).eq("followee_id", followee));
      const { error } = await sb.from("club_follows").insert({ follower_id: follower, followee_id: followee, created_at: at });
      if (error && !duplicate(error)) throw new Error(error.message);
    },
    async followCounts(id) {
      const count = async (col: string) => {
        const { count, error } = await sb.from("club_follows").select("follower_id", { count: "exact", head: true }).eq(col, id);
        if (error) throw new Error(error.message);
        return count ?? 0;
      };
      const [followers, following] = await Promise.all([count("followee_id"), count("follower_id")]);
      return { followers, following };
    },
    async follows(follower, followee) {
      const rows = list(
        await sb.from("club_follows").select("follower_id").eq("follower_id", follower).eq("followee_id", followee).limit(1),
      );
      return rows.length > 0;
    },
    async followedAmong(follower, ids) {
      if (!ids.length) return new Set<string>();
      const rows = list(await sb.from("club_follows").select("followee_id").eq("follower_id", follower).in("followee_id", ids));
      return new Set(rows.map((r) => r.followee_id as string));
    },
    async countFollowsSince(follower, since) {
      const { count, error } = await sb
        .from("club_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("follower_id", follower)
        .gte("created_at", since);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async setBlock(blocker, blocked, on) {
      if (!on) return void must(await sb.from("club_blocks").delete().eq("blocker_id", blocker).eq("blocked_id", blocked));
      const { error } = await sb.from("club_blocks").insert({ blocker_id: blocker, blocked_id: blocked });
      if (error && !duplicate(error)) throw new Error(error.message);
    },
    async blocks(id) {
      const [out, inn] = await Promise.all([
        all<{ blocked_id: string }>((a, b) =>
          sb.from("club_blocks").select("blocked_id").eq("blocker_id", id).order("blocked_id").range(a, b),
        ),
        all<{ blocker_id: string }>((a, b) =>
          sb.from("club_blocks").select("blocker_id").eq("blocked_id", id).order("blocker_id").range(a, b),
        ),
      ]);
      return { out: new Set(out.map((r) => r.blocked_id)), in: new Set(inn.map((r) => r.blocker_id)) };
    },
    async insertReport(row) {
      const { error } = await sb.from("club_reports").insert({
        reporter_id: row.reporterId,
        target_kind: row.targetKind,
        target_id: row.targetId,
        target_user: row.targetUser,
        reason: row.reason,
        note: row.note,
        snapshot: row.snapshot,
        due_at: row.dueAt,
        created_at: row.createdAt,
      });
      if (duplicate(error)) return false;
      if (error) throw new Error(error.message);
      return true;
    },
    async getReport(id) {
      const r = must<Record<string, unknown> | null>(await sb.from("club_reports").select("*").eq("id", id).maybeSingle());
      return r && reportOf(r);
    },
    async openReportsOn(kind, id) {
      return list(await sb.from("club_reports").select("*").eq("target_kind", kind).eq("target_id", id).eq("status", "open")).map(reportOf);
    },
    async countReportsSince(reporterId, since, instantOnly) {
      let q = sb.from("club_reports").select("id", { count: "exact", head: true }).eq("reporter_id", reporterId).gte("created_at", since);
      if (instantOnly) q = q.in("reason", ["private", "fake"]);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async reportQueue() {
      return list(await sb.from("club_reports").select("*").eq("status", "open").order("due_at").limit(500)).map(reportOf);
    },
    async resolvedReports(since) {
      return list(
        await sb
          .from("club_reports")
          .select("*")
          .neq("status", "open")
          .gte("resolved_at", since)
          .order("resolved_at", { ascending: false })
          .limit(1000),
      ).map(reportOf);
    },
    async resolveReports(kind, id, status, at) {
      return list(
        await sb
          .from("club_reports")
          .update({ status, resolved_at: at })
          .eq("target_kind", kind)
          .eq("target_id", id)
          .eq("status", "open")
          .select("*"),
      ).map(reportOf);
    },
    async myReports(reporterId) {
      return list(await sb.from("club_reports").select("*").eq("reporter_id", reporterId).order("id", { ascending: false }).limit(100)).map(
        reportOf,
      );
    },
    async addActivity(row) {
      const { error } = await sb.from("club_activity").insert({
        user_id: row.userId,
        kind: row.kind,
        actor_id: row.actorId ?? null,
        post_id: row.postId ?? null,
        detail: row.detail ?? null,
        created_at: row.createdAt,
      });
      if (error && !duplicate(error)) throw new Error(error.message);
    },
    async activity(id, before, limit) {
      return list(
        await sb.from("club_activity").select("*").eq("user_id", id).lt("id", before).order("id", { ascending: false }).limit(limit),
      ).map(activityOf);
    },
    async markActivitySeen(id, upTo) {
      must(await sb.from("club_activity").update({ seen: true }).eq("user_id", id).lte("id", upTo).eq("seen", false));
    },
    async unseenActivity(id) {
      const { count, error } = await sb
        .from("club_activity")
        .select("id", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("seen", false);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async dmNoticesOn(id, day) {
      const { count, error } = await sb
        .from("notifications_sent")
        .select("kind", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("day", day)
        .like("kind", "dm:%");
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async chatByPair(pair) {
      const r = must<{ id: number } | null>(await sb.from("club_chats").select("id").eq("pair", pair).maybeSingle());
      return r && { id: Number(r.id) };
    },
    async createChat(pair, createdBy, members, at) {
      const { data, error } = await sb
        .from("club_chats")
        .insert({ pair, created_by: createdBy, last_at: at, created_at: at })
        .select("id")
        .single();
      if (duplicate(error))
        // two taps at once: the other request made it
        return Number(must<{ id: number }>(await sb.from("club_chats").select("id").eq("pair", pair).single()).id);
      if (error) throw new Error(error.message);
      const id = Number(data.id);
      must(await sb.from("club_chat_members").insert(members.map((m) => ({ chat_id: id, user_id: m.userId, state: m.state }))));
      return id;
    },
    async chatMembers(chatId) {
      return list(await sb.from("club_chat_members").select("*").eq("chat_id", chatId)).map(memberOf);
    },
    async setMember(chatId, userId, patch) {
      const values = Object.fromEntries(
        Object.entries(MEMBER_COLS).flatMap(([col, k]) =>
          patch[k as keyof typeof patch] === undefined ? [] : [[col, patch[k as keyof typeof patch]]],
        ),
      );
      if (Object.keys(values).length) must(await sb.from("club_chat_members").update(values).eq("chat_id", chatId).eq("user_id", userId));
    },
    async inbox(userId, state, before, limit) {
      const rows = list<Record<string, unknown>>(
        await sb.rpc("club_inbox", { p_user: userId, p_state: state, p_before: before ?? "infinity", p_limit: limit }),
      );
      return rows.map((r) => ({
        chatId: Number(r.chat_id),
        lastAt: r.last_at as string,
        lastReadId: Number(r.last_read_id),
        otherId: (r.other_id as string | null) ?? null,
        last: messageOf({
          id: r.msg_id,
          chat_id: r.chat_id,
          sender_id: r.msg_sender,
          client_id: "",
          body: r.msg_body,
          flagged: r.msg_flagged,
          held: false,
          hidden_at: null,
          created_at: r.msg_at,
        }),
      }));
    },
    async sendMessage(row, at) {
      const r = must<Record<string, unknown>>(
        await sb
          .rpc("club_send", {
            p_chat: row.chatId,
            p_sender: row.senderId,
            p_client: row.clientId,
            p_body: row.body,
            p_flagged: row.flagged,
            p_held: row.held,
          })
          .single(),
      );
      void at; // the database stamps created_at
      return messageOf(r);
    },
    async getMessage(id) {
      const r = must<Record<string, unknown> | null>(await sb.from("club_messages").select("*").eq("id", id).maybeSingle());
      return r && messageOf(r);
    },
    async messages(chatId, { before, after, afterCleared, limit }) {
      let q = sb
        .from("club_messages")
        .select("*")
        .eq("chat_id", chatId)
        .is("hidden_at", null)
        .gt("id", Math.max(afterCleared, after ?? 0));
      if (before !== undefined) q = q.lt("id", before);
      const rows = list(await q.order("id", { ascending: after !== undefined }).limit(limit)).map(messageOf);
      return after !== undefined ? rows : rows.reverse();
    },
    async lastMessageId(chatId) {
      const r = must<{ id: number } | null>(
        await sb.from("club_messages").select("id").eq("chat_id", chatId).order("id", { ascending: false }).limit(1).maybeSingle(),
      );
      return r ? Number(r.id) : 0;
    },
    async countMessages(chatId, senderId) {
      const { count, error } = await sb
        .from("club_messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", chatId)
        .eq("sender_id", senderId);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async setMessageState(id, patch) {
      const values = {
        ...(patch.held === undefined ? {} : { held: patch.held }),
        ...(patch.hiddenAt === undefined ? {} : { hidden_at: patch.hiddenAt }),
      };
      if (Object.keys(values).length) must(await sb.from("club_messages").update(values).eq("id", id));
    },
    async hideMessagesBy(senderId, at) {
      return list(await sb.from("club_messages").update({ hidden_at: at }).eq("sender_id", senderId).is("hidden_at", null).select("*")).map(
        messageOf,
      );
    },
    async countChatsSince(userId, since, requestsOnly) {
      const ids = list<{ id: number }>(
        await sb.from("club_chats").select("id").eq("created_by", userId).gte("created_at", since).limit(100),
      ).map((r) => r.id);
      if (!requestsOnly || !ids.length) return ids.length;
      const { count, error } = await sb
        .from("club_chat_members")
        .select("chat_id", { count: "exact", head: true })
        .in("chat_id", ids)
        .neq("user_id", userId)
        .in("state", ["request", "declined"]);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async unreadChats(userId) {
      const r = must<{ chats: number; requests: number }>(await sb.rpc("club_unread", { p_user: userId }).single());
      return { chats: r.chats ?? 0, requests: r.requests ?? 0 };
    },
  };
}
