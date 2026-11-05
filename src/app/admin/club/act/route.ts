// Act on a Club report from /admin/club. Behind the admin password (src/proxy.ts covers /admin/*).
import { after } from "next/server";
import { ACTIONS, background, moderate, type ModAction, type Side } from "@/lib/server/club";
import { supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export async function POST(request: Request) {
  // JSON only: a plain form on another site can't send it, so a logged-in admin's browser can't be tricked into it.
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send JSON" }, 415);
  const body = await request.json().catch(() => null);
  const reportId = Number(body?.reportId);
  if (!Number.isSafeInteger(reportId) || !ACTIONS.includes(body?.action)) return json({ error: "Unknown action." }, 400);
  // A kept message reaches the chat (live event and push) after the reply.
  const side: Side = { ...background, later: (task) => after(() => task().catch((e) => console.error("club:", e))) };
  const r = await moderate(supabaseDb(), { reportId, action: body.action as ModAction, hideAll: body.hideAll === true }, new Date(), side);
  return r ? json(r) : json({ error: "No such report." }, 404);
}
