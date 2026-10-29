"use client";

/**
 * The "add to home screen" prompt. The game is online only, so there is no offline service worker
 * (public/sw.js only removes the one an earlier version installed).
 */

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
