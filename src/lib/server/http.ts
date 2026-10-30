// Shared bits for the API routes: who is asking, a small rate limit, and turning game errors into replies.
import { NextResponse } from "next/server";
import { PlayError } from "../play.ts";
import { supabaseAdmin, supabaseDb, type Db } from "./db.ts";
import { GameError } from "./game.ts";

/** The signed-in player's id from the `Authorization: Bearer <token>` header, verified with Supabase. */
export async function userFrom(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getClaims(token);
  return error || !data?.claims?.sub ? null : data.claims.sub;
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
export async function signedIn(request: Request, route: string, act: (db: Db, userId: string) => Promise<unknown>, max = 60) {
  if (limited(`${route}:${ipOf(request)}`, max * 3)) return json({ error: "Too many requests" }, 429);
  const userId = await userFrom(request);
  if (!userId) return json({ error: "Sign in first" }, 401);
  if (limited(`${route}:${userId}`, max)) return json({ error: "Too many requests" }, 429);
  try {
    return json(await act(dbOf(), userId));
  } catch (e) {
    if (e instanceof PlayError) return json({ error: e.message }, 400);
    if (e instanceof GameError) return json({ error: e.message }, 409);
    throw e;
  }
}
