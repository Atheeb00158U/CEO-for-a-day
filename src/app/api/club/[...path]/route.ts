// Every /api/club/* route (docs/superpowers/specs/2026-11-04-community-design.md §6.2), in one table: the method and
// path pick the action and its per-minute limit. `club()` answers 401 without a token, 404 while the Club is off for
// this player, and 403 { can } when the gate refuses. Pushes run after the reply.
import { after } from "next/server";
import * as Club from "@/lib/server/club";
import type { Db } from "@/lib/server/db";
import { club, json } from "@/lib/server/http";
import { realtimeLive } from "@/lib/server/live";
import { webPush } from "@/lib/server/reminders";

type Ctx = { params: Promise<{ path: string[] }> };
type Act = (db: Db, userId: string, arg: string | undefined, q: URLSearchParams, body: Record<string, unknown>) => Promise<object>;

const side: Club.Side = {
  send: webPush,
  later: (task) => after(() => task().catch((e) => console.error("club:", e))),
  live: realtimeLive,
};

const ROUTES: Record<string, { max: number; act: Act }> = {
  "GET me": { max: 60, act: (db, u) => Club.me(db, u) },
  "POST me": { max: 10, act: (db, u, _a, _q, b) => Club.updateMe(db, u, b) },
  "POST join": { max: 5, act: (db, u, _a, _q, b) => Club.join(db, u, b) },
  "POST leave": { max: 3, act: (db, u) => Club.leave(db, u) },
  "GET feed": { max: 60, act: (db, u, _a, q) => Club.feed(db, u, { tab: q.get("tab"), cursor: q.get("cursor") }) },
  "GET post": { max: 60, act: (db, u, id, q) => Club.thread(db, u, id, q.get("after")) },
  "GET hotseat": { max: 30, act: (db, u, id) => Club.hotSeatThread(db, u, id ?? "") },
  "POST post": { max: 6, act: (db, u, _a, _q, b) => Club.createPost(db, u, b, new Date(), side) },
  "DELETE post": { max: 10, act: (db, u, id) => Club.deletePost(db, u, id) },
  "POST like": { max: 60, act: (db, u, _a, _q, b) => Club.like(db, u, b) },
  "POST follow": { max: 30, act: (db, u, _a, _q, b) => Club.follow(db, u, b, new Date(), side) },
  "POST block": { max: 10, act: (db, u, _a, _q, b) => Club.block(db, u, b) },
  "POST report": { max: 10, act: (db, u, _a, _q, b) => Club.report(db, u, b, new Date(), side) },
  "GET u": { max: 60, act: (db, u, handle, q) => Club.userProfile(db, u, handle ?? "", q.get("before")) },
  "GET activity": { max: 30, act: (db, u, _a, q) => Club.activity(db, u, q.get("before")) },
  "GET badge": { max: 60, act: (db, u) => Club.badge(db, u) },
  "GET reports": { max: 10, act: (db, u) => Club.myReports(db, u) },
  // Chats (step 2): chat/:id/<action> picks "<METHOD> chat/<action>".
  "GET inbox": { max: 60, act: (db, u, _a, q) => Club.chats(db, u, "active", q.get("before")) },
  "GET requests": { max: 30, act: (db, u, _a, q) => Club.chats(db, u, "request", q.get("before")) },
  "POST chat": { max: 10, act: (db, u, _a, _q, b) => Club.startChat(db, u, b) },
  "GET chat": { max: 120, act: (db, u, id, q) => Club.readChat(db, u, id, { before: q.get("before"), after: q.get("after") }) },
  "POST chat/send": { max: 30, act: (db, u, id, _q, b) => Club.sendMessage(db, u, id, b, new Date(), side) },
  "POST chat/seen": { max: 60, act: (db, u, id, _q, b) => Club.seen(db, u, id, b, new Date(), side) },
  "POST chat/typing": { max: 30, act: (db, u, id) => Club.typing(db, u, id, new Date(), side) },
  "POST chat/accept": { max: 10, act: (db, u, id) => Club.accept(db, u, id) },
  "POST chat/decline": { max: 10, act: (db, u, id) => Club.decline(db, u, id) },
  "POST chat/clear": { max: 10, act: (db, u, id) => Club.clearChat(db, u, id) },
};

async function handle(request: Request, { params }: Ctx) {
  const path = (await params).path;
  const name = path.length === 3 ? `${path[0]}/${path[2]}` : path.length <= 2 ? path[0] : "";
  const route = ROUTES[`${request.method} ${name}`];
  if (!route) return json({ error: "Not found" }, 404);
  const body = request.method === "POST" ? ((await request.json().catch(() => null)) ?? {}) : {};
  if (typeof body !== "object" || Array.isArray(body)) return json({ error: "Send JSON" }, 400);
  const q = new URL(request.url).searchParams;
  return club(request, `${request.method}-${name}`, (db, userId) => route.act(db, userId, path[1], q, body), route.max);
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
