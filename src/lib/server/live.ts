// Live chat events (docs/superpowers/specs/2026-11-04-community-design.md §7). The server saves first, then sends
// each event to the player's own private topic user:<id> through Realtime's REST broadcast endpoint with the secret
// key. Phones only listen (the realtime.messages policy has no INSERT), so nothing on a topic can be forged.
import type { LiveEvent } from "../community.ts";

export type Live = (to: { userId: string; e: LiveEvent }[]) => Promise<void>;

/** Sends with Realtime's REST broadcast. A failure is logged, never thrown: the message is already saved. */
export const realtimeLive: Live = async (list) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!list.length || !url || !key) return;
  try {
    const r = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: list.map(({ userId, e }) => ({ topic: `user:${userId}`, event: e.event, payload: e.payload, private: true })),
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) console.error("live: broadcast", r.status);
  } catch (e) {
    console.error("live:", e);
  }
};
