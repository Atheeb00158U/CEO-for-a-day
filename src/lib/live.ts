"use client";

// Live chat on the phone (docs/superpowers/specs/2026-11-04-community-design.md §7.3): one private Realtime channel,
// user:<my id>, open only while something listens and the app is in front. Only the server sends on it, so the
// payload can be shown as it is. The API stays the truth: screens poll while the channel is down.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./auth";
import type { LiveEvent } from "./community";

type Listener = (e: LiveEvent) => void;
const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;
/** Whose topic the channel is on: a different player signing in gets a new channel. */
let channelUser: string | null = null;
let watching = false;
let opening = false;
let up = false;

async function open() {
  const sb = supabase();
  if (!sb || channel || opening) return;
  opening = true;
  try {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id || !listeners.size || document.visibilityState !== "visible") return;
    await sb.realtime.setAuth(); // the player's own token, so the topic policy can check it
    channelUser = id;
    channel = sb
      .channel(`user:${id}`, { config: { private: true } })
      .on("broadcast", { event: "*" }, (m) => listeners.forEach((f) => f({ event: m.event, payload: m.payload } as LiveEvent)))
      .subscribe((status) => (up = status === "SUBSCRIBED"));
  } finally {
    opening = false;
  }
}

function close() {
  up = false;
  if (channel) void supabase()?.removeChannel(channel);
  channel = null;
  channelUser = null;
}

function sync() {
  if (listeners.size && document.visibilityState === "visible") void open();
  else close();
}

/** Listen to my live events; returns the unsubscribe. The channel closes when nobody listens or the app is hidden. */
export function onLive(fn: Listener): () => void {
  listeners.add(fn);
  if (listeners.size === 1) document.addEventListener("visibilitychange", sync);
  if (!watching) {
    // Sign-out, or another player signing in without a reload: drop the old player's channel.
    watching = true;
    supabase()?.auth.onAuthStateChange((_event, session) => {
      if ((session?.user.id ?? null) !== channelUser) {
        close();
        sync();
      }
    });
  }
  sync();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) document.removeEventListener("visibilitychange", sync);
    sync();
  };
}

/** Whether the channel is connected now (screens poll when it isn't). */
export const liveUp = () => up;
