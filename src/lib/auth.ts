"use client";

// Google sign-in, in the browser. Only the session lives here: progress is read and written through the API
// routes, which check this session's token. Without the Supabase env vars (CI, a fresh checkout) everyone plays as a
// guest.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function supabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    client =
      url && key && typeof window !== "undefined"
        ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
        : null;
  }
  return client;
}

/** The current access token, refreshed if it's about to expire, or null for a guest. */
export async function token(): Promise<string | null> {
  const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}

/** Leaves for Google and comes back to /app signed in. */
export const signInWithGoogle = () =>
  supabase()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/app` } });

export const signOut = () => supabase()?.auth.signOut();

/** A request to one of our API routes, with the player's token when signed in. Throws with the server's message. */
export async function api<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = await token();
  const r = await fetch(url, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: { ...(init.body === undefined ? {} : { "Content-Type": "application/json" }), ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data?.error ?? `${url} ${r.status}`);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
