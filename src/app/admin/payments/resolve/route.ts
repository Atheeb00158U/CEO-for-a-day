// Mark a payment problem resolved from /admin/payments. Behind the admin password (src/proxy.ts covers /admin/*).
import { supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { resolveIssue } from "@/lib/server/membership";

export async function POST(request: Request) {
  // JSON only: a plain form on another site can't send it, so a logged-in admin's browser can't be tricked into it.
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send JSON" }, 415);
  const body = await request.json().catch(() => null);
  const ok = await resolveIssue(supabaseDb(), body?.id, body?.note, new Date());
  return ok ? json({ ok }) : json({ error: "No such open issue." }, 404);
}
