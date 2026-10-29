"use client";

import { SFX } from "./sfx";

/** Installing the app: the service worker (public/sw.js) and the "add to home screen" prompt. */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());

// Chrome fires this once, early, so it is caught as soon as this module loads.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own sheet instead of Chrome's mini bar
    deferred = e as InstallEvent;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    changed();
  });
}

export function onInstallChange(f: () => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

export function registerServiceWorker() {
  // Not in dev: a cached page there hides every code change.
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js", { scope: "/app" })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => reg.active?.postMessage({ save: SFX.map((n) => `/sfx/${n}.mp3`) }))
    .catch(() => {});
}

/**
 * How this phone can install the app.
 * "button": Chrome can install it in one tap. "ios" and "android": the player follows the browser's menu.
 * "inapp": inside Instagram, Facebook and the like, which can't install, so open a real browser first.
 * null: already installed, or not a phone.
 */
export type InstallWay = "button" | "ios" | "android" | "inapp" | null;

export function installWay(): InstallWay {
  if (typeof window === "undefined") return null;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (matchMedia("(display-mode: standalone)").matches || nav.standalone) return null;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return null;
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|LinkedInApp/.test(ua)) return "inapp";
  if (deferred) return "button";
  return ios ? "ios" : "android";
}

/** Shows Chrome's own install dialog. True if the player said yes. */
export async function install() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  changed();
  return outcome === "accepted";
}

const DISMISSED = "ceo-install-dismissed";
const REST_DAYS = 3;

export function installSnoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED) ?? 0) < REST_DAYS * 864e5;
  } catch {
    return false;
  }
}

export function snoozeInstall() {
  try {
    localStorage.setItem(DISMISSED, String(Date.now()));
  } catch {
    /* private mode: it just asks again next time */
  }
}

/**
 * Fetches every picture and clip in a Hot Seat through the service worker, which keeps them, so any path plays
 * offline later. Narration isn't fetched ahead (a full tree is many megabytes): lines played are kept, and offline
 * the rest fall back to the browser voice.
 */
export function saveForOffline(content: object) {
  if (!navigator.serviceWorker?.controller) return;
  const refs = new Set(JSON.stringify(content).match(/"(img|vid):[^"]+"/g));
  for (const r of refs) {
    const [kind, name] = r.slice(1, -1).split(":");
    fetch(`/media/${name}.${kind === "vid" ? "mp4" : "webp"}`).catch(() => {});
  }
}
