// Notifications only (streak reminders and the Club's). The game is online only (Atheeb's call, 2026-10-29): this worker caches nothing and never
// answers a request. It is registered when a signed-in player turns on reminders (src/lib/push.ts).
// It also still deletes the files the short-lived offline version saved on some phones.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

// The server sends { title, body, image?, tag?, url? } (src/lib/server/reminders.ts). iPhones show the title, the
// text and the app icon only; Android and desktop Chrome also show the picture, the badge and the button.
self.addEventListener("push", (e) => {
  let msg = { title: "CEO For A Day", body: "Your next lesson is ready." };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    /* no payload: use the default */
  }
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: "/icons/icon-192.png",
      badge: "/brand/wolf/badge.png", // Android's small status-bar icon: white on clear
      ...(msg.image ? { image: msg.image } : {}),
      tag: msg.tag || "daily-reminder", // a newer one with the same tag replaces the older
      renotify: true, // ...and still buzzes
      // Game reminders get a "Play now" button; the Club's (club-*, chat-*) don't.
      ...(/^(club|chat)-/.test(msg.tag ?? "") ? {} : { actions: [{ action: "play", title: "Play now" }] }),
      data: { url: msg.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "/app", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin + "/app"));
      // An open game goes to the link first (its hashchange listener opens the screen), then comes to the front.
      if (!open) return self.clients.openWindow(url);
      return (open.url === url || !open.navigate ? Promise.resolve(open) : open.navigate(url).catch(() => open)).then((c) =>
        (c ?? open).focus(),
      );
    }),
  );
});
