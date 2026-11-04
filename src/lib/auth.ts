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

/** Leaves for Google and comes back to /app signed in. The fallback when Google's own button isn't set up. */
export const signInWithGoogle = () =>
  supabase()?.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/app` } });

/* ------------------------------------------------------------------ */
/* Google's own sign-in button (Google Identity Services).              */
/* Google's page then names ceoforaday.in, not the Supabase address,    */
/* and offers the accounts already signed in on this browser.           */
/* ------------------------------------------------------------------ */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface Gis {
  initialize(o: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    nonce: string;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: Gis } };
  }
}

let gis: Promise<Gis> | undefined;
const loadGis = () =>
  (gis ??= new Promise<Gis>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const tag = document.createElement("script");
    tag.src = "https://accounts.google.com/gsi/client";
    tag.async = true;
    tag.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("Google sign-in didn't load")));
    tag.onerror = () => {
      gis = undefined;
      reject(new Error("Google sign-in didn't load"));
    };
    document.head.appendChild(tag);
  }));

const sha256Hex = async (s: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/**
 * Draw Google's sign-in button into `el`. A tap signs in through Supabase with Google's ID token; the nonce
 * (hashed for Google, raw for Supabase) stops a stolen token being replayed. Throws if Google's script can't load.
 */
export async function renderGoogleButton(el: HTMLElement, onError: (message: string) => void) {
  const sb = supabase();
  if (!sb || !GOOGLE_CLIENT_ID) throw new Error("Google sign-in isn't set up");
  const id = await loadGis();
  const nonce = crypto.randomUUID();
  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: await sha256Hex(nonce),
    use_fedcm_for_prompt: true,
    itp_support: true,
    callback: async ({ credential }) => {
      const { error } = await sb.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
      if (error) onError("Sign-in didn't work. Try again.");
    },
  });
  id.renderButton(el, {
    type: "standard",
    theme: "filled_black",
    size: "large",
    shape: "pill",
    text: "continue_with",
    logo_alignment: "center",
    width: Math.min(400, Math.max(200, Math.round(el.clientWidth))),
  });
}

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
