// The Club's pure rules (docs/superpowers/specs/2026-11-04-community-design.md): who may post, the automatic flags,
// the "For you" order, and every word the Club shows. Shared by the phone and the server; Node runs it too, so only
// relative .ts imports.
import { TITLES } from "./career.ts";
import { dayDiff } from "./game-state.ts";
import { GRIEVANCE } from "./legal.ts";

/** Trader. The one place the posting rank lives. */
export const POST_RANK = 3;

export type Can = "ok" | "signin" | "join" | "banned" | "pay" | "rank";
export interface GateInput {
  signedIn: boolean;
  joined: boolean;
  member: boolean;
  rank: number;
  /** A moderator's ban: an ISO time, or "infinity" for good. */
  bannedUntil: string | null;
}

/** Whether a ban is still running at `now`. */
export const bannedAt = (until: string | null, now: Date) => !!until && (until === "infinity" || Date.parse(until) > now.getTime());

/** Like, follow, block: signin > join > banned > ok. */
export function canInteract(p: GateInput, now: Date): Can {
  if (!p.signedIn) return "signin";
  if (!p.joined) return "join";
  if (bannedAt(p.bannedUntil, now)) return "banned";
  return "ok";
}

/** Post or reply: signin > join > banned > pay > rank > ok. */
export function canPost(p: GateInput, now: Date): Can {
  const c = canInteract(p, now);
  if (c !== "ok") return c;
  if (!p.member) return "pay";
  if (p.rank < POST_RANK) return "rank";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Limits.                                                             */
/* ------------------------------------------------------------------ */
export const LIMITS = {
  postLength: 500,
  buildingLength: 160,
  nameLength: 20,
  noteLength: 300,
  posts: { perDay: 10, gapMs: 30_000 },
  replies: { perDay: 50, gapMs: 10_000 },
  follows: { perDay: 200, total: 2000 },
  reports: { perDay: 20, instantPerDay: 3 },
  /** Chats (step 2): new chats a day (of which requests), messages before a request is accepted, message length. */
  chats: { perDay: 20, requestsPerDay: 5, requestMessages: 3, messageLength: 1000 },
  /** Pictures (step 3): a day, the biggest file, and the longest side once resized. */
  pictures: { perDay: 20, maxBytes: 5 * 1024 * 1024, maxSide: 1080 },
  /** Group chats: people in all (the maker too), and the name's length. */
  groups: { maxMembers: 20, minOthers: 2, titleLength: 30 },
  /** Accounts younger than this don't count toward hiding at once; Club members younger than this get half limits. */
  newMs: 24 * 3600_000,
};

const RESERVED = new Set(["wolf", "thewolf", "admin", "ceoforaday", "support", "moderator", "club"]);
/** Words a name may not contain, so nobody passes as the Wolf or the app itself. */
const RESERVED_NAME = /wolf|admin|moderator|ceoforaday|official|grievance/;

/** Whether a display name pretends to be the app (letters only, so "The W0lf"-style spacing still counts). */
export const reservedName = (name: string) =>
  RESERVED_NAME.test(
    name
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/[^a-z]/g, ""),
  );

/** A handle, lower-cased, or the sentence to show. */
export function checkHandle(raw: unknown): { handle: string } | { error: string } {
  const h = typeof raw === "string" ? raw.trim().replace(/^@/, "").toLowerCase() : "";
  if (!/^[a-z0-9_]{3,15}$/.test(h)) return { error: CLUB_COPY.badHandle };
  if (RESERVED.has(h)) return { error: CLUB_COPY.handleTaken };
  return { handle: h };
}

/* ------------------------------------------------------------------ */
/* Automatic flags.                                                    */
/* ------------------------------------------------------------------ */
/** Matched case-insensitively. A hit holds a post for a moderator (and, in chats, shows a warning). */
export const SCAM_PATTERNS: RegExp[] = [
  /\binvest\w*\b.{0,40}\bearn/i,
  /\bguarantee(d)? returns?\b/i,
  /\bdouble (your|ur) money\b/i,
  /\bpaisa double\b|\bdouble paisa\b/i,
  /\d+\s*%\s*(daily|weekly|monthly)\s+(return|profit)/i,
  /\bprofit every ?day\b|\bdaily profit\b/i,
  /\bcrypto/i,
  /\bforex\b/i,
  /\btrading tips?\b/i,
  /\btelegram\b/i,
  /\bwhats ?app me\b|\bwhatsapp (karo|pe aao|par aao)\b/i,
  /\bjoin my group\b/i,
  /\bwork from home\b/i,
  /\bloan approved\b/i,
  /\bsend (me )?(₹|rs\.?\s?|inr\s?)\d/i,
  /\bper day income\b|\bincome per day\b/i,
];

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const LINK = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|in|net|org|io|co|xyz|app|me|info|link|ly|site|shop|online|biz)\b/i;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** "ravi at gmail dot com", with or without brackets. */
const SPELLED_EMAIL = /\b[\w.+-]+\s*[([]?\s*at\s*[)\]]?\s*[a-z0-9-]+\s*[([]?\s*dot\s*[)\]]?\s*(com|in|net|org|co)\b/i;
const UPI = /\b[\w.-]{2,}@(ok)?(upi|ybl|paytm|axl|axis|ibl|sbi|apl|icici|hdfcbank)\b/i;

/** The text with spelled-out digits as digits, and digits split by spaces or punctuation joined up. */
function digitsOf(text: string): string {
  let t = text.toLowerCase();
  NUMBER_WORDS.forEach((w, i) => (t = t.replace(new RegExp(`\\b${w}\\b`, "g"), String(i))));
  return t.replace(/(\d)[\s.\-()_,/|]{1,3}(?=\d)/g, "$1");
}

/** An Indian mobile number, written plainly, split up or spelled out. */
export const hasPhone = (text: string) => /(?<!\d)(?:\+?91)?[6-9]\d{9}(?!\d)/.test(digitsOf(text));

export interface Flag {
  /** Refused: nothing is saved. */
  refuse?: string;
  /** Held for a moderator: only the author sees it. */
  hold?: "auto_link" | "auto_scam";
  /** A scam word: in chats, the warning line shows under the message. */
  warn?: true;
}

/** What the automatic checks make of a piece of text. */
export function autoFlag(text: string): Flag {
  if (hasPhone(text) || EMAIL.test(text) || SPELLED_EMAIL.test(text) || UPI.test(text)) return { refuse: CLUB_COPY.noContacts };
  if (SCAM_PATTERNS.some((p) => p.test(text))) return { hold: "auto_scam", warn: true };
  if (LINK.test(text)) return { hold: "auto_link" };
  return {};
}

/* ------------------------------------------------------------------ */
/* "For you".                                                          */
/* ------------------------------------------------------------------ */
export interface Rankable {
  id: number;
  authorId: string | null;
  kind: string;
  likeCount: number;
  replyCount: number;
  createdAt: string;
}

export const FEED_DAYS = 7;

/**
 * Posts from the last week, ranked as on Hacker News: (likes + 2 × replies + 1) ÷ (hours + 2)^1.5, × 1.5 for people
 * you follow and × 0.5 for rank-ups. Then no author twice in any five in a row. The same input and `asOf` always give
 * the same order, so pages line up.
 */
export function rankForYou<T extends Rankable>(posts: T[], viewer: { follows: Set<string> }, asOf: Date): T[] {
  const t = asOf.getTime();
  const fresh = posts.filter((p) => {
    const at = Date.parse(p.createdAt);
    return at <= t && at > t - FEED_DAYS * 864e5;
  });
  const score = (p: T) => {
    const hours = Math.max(0, (t - Date.parse(p.createdAt)) / 3600_000);
    let s = (p.likeCount + 2 * p.replyCount + 1) / Math.pow(hours + 2, 1.5);
    if (p.authorId && viewer.follows.has(p.authorId)) s *= 1.5;
    if (p.kind === "rank_up") s *= 0.5;
    return s;
  };
  const scored = fresh.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || b.p.id - a.p.id);
  const out: T[] = [];
  const left = scored.map((x) => x.p);
  while (left.length) {
    const recent = new Set(out.slice(-4).map((p) => p.authorId));
    const i = left.findIndex((p) => !recent.has(p.authorId));
    out.push(...left.splice(i < 0 ? 0 : i, 1));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* What the phone sees.                                                */
/* ------------------------------------------------------------------ */
export type PostKind = "post" | "reply" | "rank_up" | "hotseat" | "question";

export interface AuthorView {
  handle: string;
  name: string;
  title: string;
  stars: number;
  maxStars: number;
  streak: number;
}

export interface PostView {
  id: number;
  kind: PostKind;
  body: string;
  createdAt: string;
  likes: number;
  replies: number;
  liked: boolean;
  mine: boolean;
  /** Only ever true for the author. */
  held: boolean;
  /** null: the Wolf. */
  author: AuthorView | null;
  /** A signed URL, good for an hour. */
  image?: ImageView;
}

/** A picture as the phone gets it. */
export interface ImageView {
  url: string;
  width: number;
  height: number;
}

/** A player as others see them. Never an id, email, plan or seat. */
export interface ProfileView {
  handle: string;
  name: string;
  building: string;
  title: string;
  rank: number;
  stars: number;
  maxStars: number;
  streak: number;
  followers: number;
  following: number;
  youFollow: boolean;
  followsYou: boolean;
  /** You blocked them. */
  blocked: boolean;
  mine: boolean;
  /** Only on your own. */
  milestones?: boolean;
}

export type ActivityKind = "reply" | "like" | "follow" | "report_done" | "removed";
export interface ActivityItem {
  id: number;
  kind: ActivityKind;
  createdAt: string;
  seen: boolean;
  actor: { handle: string; name: string } | null;
  /** "and 3 others" for likes on one post. */
  others?: number;
  postId?: number;
  /** The start of a reply, or the outcome line. */
  text?: string;
}

export interface ReportView {
  id: number;
  reason: string;
  status: "open" | "removed" | "kept";
  createdAt: string;
  resolvedAt?: string;
}

/** A chat in the inbox or requests list. `with` is null once the other player deleted their account. */
export interface ChatRow {
  id: number;
  /** One-to-one: the other player (null once they deleted their account). Groups: null, with `title`. */
  with: { handle: string; name: string; title: string } | null;
  /** A group's name. */
  title?: string;
  /** request: a request to me. */
  state: "active" | "request";
  last: { body: string; at: string; mine: boolean } | null;
  unread: boolean;
}
export interface MessageView {
  id: number;
  chatId: number;
  mine: boolean;
  body: string;
  createdAt: string;
  /** A link or scam words: the warning line shows under it. */
  flagged: boolean;
  /** Only ever true for the sender: waiting for a check. */
  held: boolean;
  clientId?: string;
  image?: ImageView;
  /** A picture in a message request: shown once the request is accepted. */
  imageHidden?: true;
  /** A group line, e.g. "Ravi added Priya": the sender did it; for added and removed, `body` is the other name. */
  event?: "created" | "added" | "removed" | "left";
  /** In a group, who sent it (not on my own). */
  from?: { handle: string; name: string };
}
/** GET /api/club/chat/:id. */
export interface ChatView {
  chat: ChatRow & {
    canSend: boolean;
    /** I started it and they haven't accepted yet. */
    waiting: boolean;
    /** A group: who is in it, and whether I made it (only the maker adds and removes people). */
    group?: { members: { handle: string; name: string; title: string; mine: boolean }[]; admin: boolean };
  };
  messages: MessageView[];
  /** The other player's "Seen" (0 while they haven't accepted). */
  theirLastRead: number;
  /** More older messages: pass as ?before=. */
  before?: number;
}
/** What the server sends on a player's private topic user:<id>. */
export type LiveEvent =
  | { event: "msg"; payload: { chatId: number; message: MessageView } }
  | { event: "seen"; payload: { chatId: number; lastId: number } }
  | { event: "typing"; payload: { chatId: number; handle: string } };

/** GET /api/club/me. */
export interface ClubMe {
  profile?: ProfileView;
  can: { post: Can; interact: Can };
  title: string;
  rank: number;
  /** Until when a moderator's ban runs ("infinity" for good). */
  bannedUntil?: string;
  badge: { activity: number; chats: number; requests: number };
}

/** A group line as shown: `who` did it ("You" for the viewer); `name` is the other player for added and removed. */
export function groupLine(event: NonNullable<MessageView["event"]>, who: string, name: string): string {
  if (event === "created") return CLUB_COPY.groupCreated(who);
  if (event === "added") return CLUB_COPY.groupAdded(who, name);
  if (event === "removed") return CLUB_COPY.groupRemoved(who, name);
  return CLUB_COPY.groupLeft(who);
}

export const titleOf = (rank: number) => TITLES[Math.max(1, Math.min(TITLES.length, rank)) - 1];

/** The streak as shown: kept only while it was extended today or yesterday (IST), as in the top bar. */
export const shownStreak = (streak: number, streakDay: string | null, today: string) =>
  streakDay && dayDiff(streakDay, today) <= 1 ? streak : 0;

/** "now", "5m", "3h", "2d", then "3 Nov". */
export function timeAgo(iso: string, now = new Date()): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/* ------------------------------------------------------------------ */
/* Reports.                                                            */
/* ------------------------------------------------------------------ */
export const REPORT_REASONS = [
  { id: "spam", label: "Spam or selling" },
  { id: "scam", label: "Scam or money scheme" },
  { id: "hate", label: "Hate" },
  { id: "harass", label: "Bullying or threats" },
  { id: "sexual", label: "Sexual content" },
  { id: "private", label: "Private pictures of someone, or nudity" },
  { id: "fake", label: "Pretending to be me or someone else" },
  { id: "illegal", label: "Something illegal" },
  { id: "other", label: "Something else" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["id"];
/** Hidden at once and due within 2 hours (IT Rules 3(2)(b)); everything else within 36 hours. */
export const URGENT: readonly string[] = ["private", "fake"];
export const reasonLabel = (id: string) =>
  REPORT_REASONS.find((r) => r.id === id)?.label ?? (id === "auto_link" ? "A link" : id === "auto_scam" ? "Money scheme words" : id);

/* ------------------------------------------------------------------ */
/* Every word the Club shows.                                          */
/* ------------------------------------------------------------------ */
export const CLUB_COPY = {
  tab: "Club",
  title: "Club",
  forYou: "For you",
  following: "Following",
  rankingHelp: "Posts from the last 7 days. Posts with more replies and likes come first. New posts also come first for a while.",
  wolf: "The Wolf",
  question: "Question of the day",
  emptyFollowing: "Follow players to see their posts here.",
  caughtUp: "You've seen all the posts.",
  guestTitle: "Sign in to read the Club",
  guestText: "See what other players are building.",
  rankUp: (name: string, title: string) => (title === "CEO" ? `${name} reached the top: CEO.` : `${name} became a ${title}.`),
  newPost: "New post",
  placeholder: "What did you learn or try today?",
  replyPlaceholder: "Write a reply",
  post: "Post",
  reply: "Reply",
  cancel: "Cancel",
  rulesLine: "Be kind. No selling, money schemes or phone numbers.",
  left: (n: number) => `${n} left`,
  payLine: "Members with the title Trader or higher can post.",
  rankTitle: "Reach Trader to post.",
  rankText: (title: string) => `You are a ${title}. Finish Unit ${POST_RANK - 1} to become a Trader and post.`,
  playNow: "Play now",
  replyLocked: "Members at Trader can reply",
  bannedUntil: (date: string) => `You can't post until ${date}.`,
  bannedForGood: "You can't post in the Club.",
  held: "We are checking this post. Only you can see it for now.",
  showMore: "Show more",
  // Errors and limits.
  noContacts: "Remove phone numbers, emails and UPI IDs.",
  repeat: "You already posted this.",
  slowDown: "Please wait a minute before trying again.",
  tooManyPosts: "You have posted enough for today. You can post again tomorrow.",
  tooManyReplies: "You have replied enough for today. You can reply again tomorrow.",
  tooManyFollows: "You have followed enough players for today. Try again tomorrow.",
  tooManyReports: "You have sent enough reports for today. Try again tomorrow.",
  notFound: "Player not found.",
  postGone: "This post is no longer available.",
  handleTaken: "That username is taken.",
  badHandle: "Use 3 to 15 letters, numbers or underscores (_).",
  badName: "Use 1 to 20 letters for your name.",
  reservedName: "Pick a different name. This one is kept for the app.",
  profileLinks: "Remove links and money offers from your profile.",
  error: "Something went wrong. Try again.",
  // Join.
  joinTitle: "Join the Club",
  handle: "Username",
  name: "Name",
  building: "What I'm building (optional)",
  buildingExample: "A tiffin service in Pune",
  adult: "I am 18 or older",
  agree: "I agree to the Club rules",
  notice:
    "Other players can see your name, username, title, streak, what you're building and your posts. You can leave the Club at any time. This deletes all your Club data.",
  under18: "You must be 18 or older to join the Club.",
  mustAgree: "Select both boxes to join.",
  join: "Join",
  rejoinWait: "You left the Club. You can join again tomorrow.",
  // Profile.
  whatBuilding: "What I'm building",
  followers: (n: number) => (n === 1 ? "1 follower" : `${n} followers`),
  followingCount: (n: number) => `${n} following`,
  follow: "Follow",
  followingBtn: "Following",
  edit: "Edit",
  save: "Save",
  streak: (n: number) => `${n} day streak`,
  unavailable: "This profile isn't available.",
  milestones: "Share my milestones",
  milestonesLine: "Post when I get a new title.",
  posts: "Posts",
  noPosts: "No posts yet.",
  clubProfile: "Club profile",
  myReports: "My reports",
  reportProblem: "Report a problem",
  leave: "Leave the Club",
  leaveTitle: "Leave the Club?",
  leaveText: "This deletes your Club profile, posts, likes, follows and chats. Your game progress will not be deleted.",
  leaveYes: "Leave",
  stay: "Stay",
  // Post menu and reports.
  menu: "More",
  report: "Report",
  block: (name: string) => `Block ${name}`,
  unblock: (name: string) => `Unblock ${name}`,
  deletePost: "Delete post",
  deleteTitle: "Delete this post?",
  deleteYes: "Delete",
  keep: "Keep",
  blockTitle: (name: string) => `Block ${name}?`,
  blockText: "You cannot see or message each other in the Club. They will not be told.",
  blockYes: "Block",
  reportTitle: "What's wrong?",
  reportNote: "Tell us more (optional)",
  sendReport: "Send report",
  reportThanks: "We got your report. We will check it within 36 hours.",
  reportStatus: { open: "Waiting", removed: "Removed", kept: "Post kept: it follows our rules." },
  noReports: "You haven't reported anything.",
  outcomeRemoved: "We checked your report. We removed the post.",
  outcomeKept: "We checked your report. The post follows our rules, so we did not remove it.",
  removedYours: (reason: string) => `We removed your post because it broke the Club rules: ${reason}.`,
  // Activity.
  activity: "Activity",
  replied: (name: string) => `${name} replied to you`,
  liked: (name: string) => `${name} liked your post`,
  likedMany: (name: string, n: number) => `${name} and ${n} ${n === 1 ? "other" : "others"} liked your post`,
  followed: (name: string) => `${name} followed you`,
  emptyActivity: "No posts yet. Write your first post.",
  turnOnNotifications: "Turn on notifications to know when someone replies.",
  // Hot Seat threads.
  talk: "Talk about it",
  replies: (n: number) => (n === 1 ? "1 reply" : `${n} replies`),
  hotSeatPost: "What did you pick, and why?",
  hotSeatLocked: "Finish this Hot Seat to see what others chose.",
  // Pushes.
  pushReply: (name: string) => `${name} replied to you`,
  pushFollow: (name: string) => `${name} followed you`,
  pushFollowBody: "See their profile in the Club.",
  pushReport: (reason: string) => `New report: ${reason}`,
  pushReportBody: (urgent: boolean) => `Due in ${urgent ? "2 hours" : "36 hours"}.`,
  // Rules.
  rulesTitle: "Club rules",
  rules: [
    "Be kind. No hate, bullying or threats.",
    "No sexual content, and no private pictures of anyone.",
    "Don't pretend to be someone else.",
    'No money schemes, no "invest and earn" offers, no selling.',
    "No phone numbers, emails or UPI IDs.",
    "Nothing illegal, and nothing that harms children.",
    "Do not share false news that could harm people.",
    "Only share things you have the right to share.",
  ],
  rulesBreak: "If you break a rule, we may remove your post or stop you from posting.",
  rulesComplain: `To complain, tap Report, or write to our Grievance Officer: ${GRIEVANCE.name}, ${GRIEVANCE.email}, ${GRIEVANCE.address}.`,
  rulesReply: "We reply within 24 hours and solve the problem within 7 days.",
  // Chat (step 2).
  messages: "Messages",
  requestsRow: (n: number) => `Requests (${n})`,
  requestsTitle: "Requests",
  newMessage: "New message",
  newMessageHelp: "Type the username of the player you want to message.",
  start: "Start chat",
  message: "Message",
  emptyInbox: "No messages yet.",
  emptyRequests: "No requests.",
  messagePlaceholder: "Message…",
  send: "Send",
  sent: "Sent",
  seen: "Seen",
  typing: (name: string) => `${name} is typing…`,
  wantsToChat: (name: string) => `${name} wants to chat.`,
  requestNote: "They will not know you read this until you accept.",
  accept: "Accept",
  waitAccept: (name: string) => `Wait for ${name} to accept before you send more.`,
  waitingAccept: (name: string) => `${name} has not accepted yet.`,
  scamWarning: "Be careful. Never send money to someone you met here.",
  deleteChat: "Delete chat",
  deleteChatTitle: "Delete this chat?",
  deleteChatText: "It is removed from your messages only.",
  deletedAccount: "Deleted account",
  notSent: "Message not sent.",
  chatGone: "This chat is no longer available.",
  tooManyChats: "You cannot start more chats today. Try tomorrow.",
  pushMessage: "Sent you a message",
  pushRequest: (name: string) => `${name} wants to chat`,
  pushRequestBody: "Open your message requests in the Club.",
  reportMessage: "Report message",
  // Pictures (step 3).
  addPicture: "Add a picture",
  removePicture: "Remove picture",
  addingPicture: "Adding picture…",
  picture: "Picture",
  pictureTooBig: "That picture is too big. Pick one under 5 MB.",
  pictureType: "Use a JPG, PNG or WebP picture.",
  tooManyPictures: "You cannot add more pictures today. Try tomorrow.",
  pictureGone: "Could not add the picture. Try again.",
  pictureHidden: "Accept the chat to see the picture.",
  // Group chats (step 3).
  newGroup: "New group",
  groupName: "Group name",
  addPeople: "Add people",
  mutualOnly: "You can add people who follow you back.",
  noMutuals: "No one follows you back yet.",
  pickPeople: (min: number, max: number) => `Pick ${min} to ${max} people.`,
  makeGroup: "Make group",
  you: "You",
  groupCreated: (name: string) => `${name} made this group.`,
  groupAdded: (who: string, name: string) => `${who} added ${name}`,
  groupRemoved: (who: string, name: string) => `${who} removed ${name}`,
  groupLeft: (who: string) => `${who} left`,
  members: (n: number) => `${n} people`,
  remove: (name: string) => `Remove ${name}`,
  leaveGroup: "Leave group",
  leaveGroupTitle: "Leave this group?",
  leaveGroupText: "You will no longer get messages from this group.",
  groupFull: "A group can have up to 20 people.",
  onlyMaker: "Only the person who made the group can do this.",
  badGroupName: "Group name must have 1 to 30 letters.",
  groupNameLinks: "Remove links and money offers from the group name.",
  pushGroupMessage: (name: string) => `${name} sent a message`,
  pushAddedToGroup: (name: string) => `${name} added you to a group`,
  // Added with the phone screens.
  back: "Back",
  close: "Close",
  grievanceTitle: "Grievance Officer",
  legalIntro: "The Club is where players post and talk. You must be 18 or older to join. These are the rules:",
  legalComplain: "To complain about something in the game or the Club, tap Report in the app, or write to our Grievance Officer:",
  privacyTitle: "If you join the Club",
  /** Fixed sample posts behind the guest's sign-in card (not real posts). */
  samples: [
    { name: "Ravi K", title: "Trader", body: "Started selling chai at the bus stand. 40 cups on day one." },
    { name: "Priya S", title: "Shopkeeper", body: "Today I learned to count every cost before I set a price." },
    { name: "Imran A", title: "Brand Owner", body: "My first regular customer came back three times this week." },
  ],
};
