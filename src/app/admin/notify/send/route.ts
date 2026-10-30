// Send a notification now, from /admin/notify. Behind the admin password (src/proxy.ts covers /admin/*).
import { supabaseAdmin, supabaseDb } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { broadcast } from "@/lib/server/reminders";

/** The player id for an email, or undefined. Fine at this size; switch to a lookup table past a few thousand players. */
async function userIdFor(email: string): Promise<string | undefined> {
  const sb = supabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return undefined;
  }
}

export async function POST(request: Request) {
  // JSON only: a plain form on another site can't send it, so a logged-in admin's browser can't be tricked into it.
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send JSON" }, 415);
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 60) : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 160) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!title || !text) return json({ error: "Write a title and a message." }, 400);
  let userId: string | undefined;
  if (email) {
    userId = await userIdFor(email);
    if (!userId) return json({ error: `No player signed in with ${email}.` }, 404);
  }
  return json(await broadcast(supabaseDb(), { title, body: text }, userId));
}
