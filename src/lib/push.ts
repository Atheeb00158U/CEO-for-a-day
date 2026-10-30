"use client";

// Streak reminders (Web Push). Signed-in players turn them on from Profile or after a Hot Seat; the phone asks
// permission, registers the notification-only worker (public/sw.js) and hands the subscription to the server,
// which sends one reminder a day at the chosen hour (IST) if the player hasn't played yet.
import { api } from "./auth";

/** Why reminders can't be turned on here, or null when they can. */
export function pushBlocker(): "unsupported" | "install-first" | "denied" | null {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const installed = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  // iPhones only allow notifications for apps added to the Home Screen (iOS 16.4 and later).
  if (ios && !installed) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return null;
}

const keyBytes = (base64: string) => {
  const s = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/** The current subscription on this phone, if reminders are on. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushBlocker() === "unsupported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission and turn reminders on at `hour` (IST). Returns false if the player said no. */
export async function enableReminders(hour: number): Promise<boolean> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || pushBlocker()) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  await api("/api/push/subscribe", { body: { subscription: sub.toJSON(), hour } });
  return true;
}

export async function disableReminders(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await api("/api/push/unsubscribe", { body: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}
