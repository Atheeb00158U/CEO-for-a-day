// Shared bits for the API routes: who is asking, a small rate limit, and turning game errors into replies.
import { NextResponse } from "next/server";
import { canOpen, type AccessContext, type Item } from "../access.ts";
import { PlayError } from "../play.ts";
import { freeList } from "./content.ts";
import { supabaseAdmin, supabaseDb, type Db } from "./db.ts";
import { GameError } from "./game.ts";
import { accessCache, accessContext, paywallFor } from "./membership.ts";

interface Claims {
  sub: string;
  email?: string;
}
// One check of the token per request, however many helpers ask (userFrom, emailFrom, accessCheck).
const verified = new WeakMap<Request, Promise<Claims | null>>();

/** The verified claims of the `Authorization: Bearer <token>` header, or null for a guest or a bad token. */
function claimsOf(request: Request): Promise<Claims | null> {
  let p = verified.get(request);
  if (!p) {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    p = token
      ? supabaseAdmin()
          .auth.getClaims(token)
          .then(({ data, error }) => {
            const c = data?.claims;
            if (error || !c?.sub) return null;
            return { sub: c.sub, email: typeof c.email === "string" ? c.email : undefined };
          })
      : Promise.resolve(null);
    verified.set(request, p);
  }
  return p;
}

/** The signed-in player's id from the `Authorization: Bearer <token>` header, verified with Supabase. */
export async function userFrom(request: Request): Promise<string | null> {
  return (await claimsOf(request))?.sub ?? null;
}

/** The signed-in player's email (the token's `email` claim), if any. */
export async function emailFrom(request: Request): Promise<string | undefined> {
  return (await claimsOf(request))?.email;
}

// Railway runs one instance, so a counter in memory is enough to stop one phone hammering the server.
const hits = new Map<string, { n: number; reset: number }>();
/** True when `key` has made more than `max` requests in the last minute. */
export function limited(key: string, max = 60, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || h.reset < now) {
    if (hits.size > 50_000) hits.clear();
    hits.set(key, { n: 1, reset: now + 60_000 });
    return false;
  }
  return ++h.n > max;
}

export const ipOf = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

const NO_STORE = { "Cache-Control": "no-store" };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

let db: Db | undefined;
const dbOf = () => (db ??= supabaseDb());

/**
 * Run a signed-in action: 401 without a valid token, 429 when rate limited, 400/409 for refused requests.
 * `max` is requests a minute for this route and player.
 */
export async function signedIn(request: Request, route: string, act: (db: Db, userId: string) => Promise<object | NextResponse>, max = 60) {
  if (limited(`${route}:${ipOf(request)}`, max * 3)) return json({ error: "Too many requests" }, 429);
  const userId = await userFrom(request);
  if (!userId) return json({ error: "Sign in first" }, 401);
  if (limited(`${route}:${userId}`, max)) return json({ error: "Too many requests" }, 429);
  try {
    const out = await act(dbOf(), userId);
    return out instanceof NextResponse ? out : json(out); // an action may answer itself, e.g. accessCheck's 402
  } catch (e) {
    if (e instanceof PlayError) return json({ error: e.message }, 400);
    if (e instanceof GameError) return json({ error: e.message }, 409);
    throw e;
  }
}

const ACCESS_TTL = 60_000;
const ACCESS_MAX = 5_000;

/** Cache a player's access for at most a minute; drop expired entries, and the oldest past ACCESS_MAX. */
function remember(userId: string, ctx: AccessContext, at: number) {
  accessCache.delete(userId); // re-inserted below, so the Map's order stays oldest first
  for (const [k, v] of accessCache) if (at - v.at >= ACCESS_TTL) accessCache.delete(k);
  for (const k of accessCache.keys()) {
    if (accessCache.size < ACCESS_MAX) break;
    accessCache.delete(k);
  }
  accessCache.set(userId, { ctx, at });
}

/** False when the paywall is off for everyone and nobody is a tester: nothing then needs a token or a read. */
const paywallPossible = () => process.env.PAYWALL_ON === "1" || !!(process.env.PAYWALL_TESTERS ?? "").trim();

/** This request's access context (the cache is good for a minute), or null while the paywall is off for them. */
async function contextOf(request: Request, now: Date): Promise<{ ctx: AccessContext; userId: string | null } | null> {
  if (!paywallPossible()) return null;
  const c = await claimsOf(request);
  if (!paywallFor(c?.email)) return null;
  // A guest is never a member and has no early access: no database read.
  let ctx: AccessContext = { paywall: true, member: false, early: new Set() };
  if (c) {
    const hit = accessCache.get(c.sub);
    if (hit && now.getTime() - hit.at < ACCESS_TTL) ctx = hit.ctx;
    else {
      ctx = await accessContext(dbOf(), c.sub, c.email, now);
      remember(c.sub, ctx, now.getTime());
    }
  }
  return { ctx, userId: c?.sub ?? null };
}

/**
 * The paywall (spec §4a): null when this player (or guest) may open `item`, otherwise a 402 `members_only` reply.
 * While the paywall is off for them, nothing is read from the database.
 */
export async function accessCheck(request: Request, item: Item, now = new Date()): Promise<NextResponse | null> {
  const a = await contextOf(request, now);
  if (!a) return null;
  return canOpen(item, a.ctx, freeList()) ? null : NextResponse.json({ error: "members_only" }, { status: 402, headers: NO_STORE });
}

/**
 * Which of these lessons the player may study cards for: free lessons, everything for a member, and any lesson a
 * signed-in player finished (they keep those cards for good). With the paywall off, all of them and no reads.
 */
export async function allowedLessonIds(request: Request, ids: string[], now = new Date()): Promise<string[]> {
  const a = await contextOf(request, now);
  if (!a) return ids;
  const free = freeList();
  const open = ids.filter((id) => canOpen({ kind: "lesson", id }, a.ctx, free));
  if (!a.userId || open.length === ids.length) return open;
  const done = (await dbOf().getProfile(a.userId))?.state.lessons ?? {};
  return ids.filter((id) => open.includes(id) || Object.hasOwn(done, id));
}
