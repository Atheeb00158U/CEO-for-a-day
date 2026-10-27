// Password gate for /admin (HTTP Basic Auth, any username). The password is ADMIN_PASSWORD on the server.
// Without it, /admin is open in `npm run dev` and closed everywhere else.
// shortcut: one shared password, no rate limiting or logout; move to real accounts in Phase 3.
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

const sha256 = (s: string) => createHash("sha256").update(s).digest();

export type AdminAccess = "ok" | "denied" | "unset";

export function adminAccess(
  authorization: string | null,
  password = process.env.ADMIN_PASSWORD,
  nodeEnv = process.env.NODE_ENV,
): AdminAccess {
  if (!password) return nodeEnv === "development" ? "ok" : "unset";
  const [scheme, encoded] = (authorization ?? "").split(" ");
  if (scheme !== "Basic" || !encoded) return "denied";
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  if (colon < 0) return "denied";
  // Hash both sides so the comparison is constant-time and never throws on a length mismatch.
  return timingSafeEqual(sha256(decoded.slice(colon + 1)), sha256(password)) ? "ok" : "denied";
}

const PRIVATE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export function proxy(request: NextRequest) {
  const access = adminAccess(request.headers.get("authorization"));
  if (access === "unset")
    return new NextResponse("Admin is not set up. Set ADMIN_PASSWORD on the server.", { status: 503, headers: PRIVATE });
  if (access === "denied") {
    return new NextResponse("Password needed.", {
      status: 401,
      headers: { ...PRIVATE, "WWW-Authenticate": 'Basic realm="CEO For A Day admin", charset="UTF-8"' },
    });
  }
  const response = NextResponse.next();
  for (const [k, v] of Object.entries(PRIVATE)) response.headers.set(k, v);
  return response;
}

export const config = { matcher: "/admin/:path*" };
