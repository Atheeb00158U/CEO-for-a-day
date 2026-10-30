// Streak reminders only. The game is online only (Atheeb's call, 2026-10-29): this worker caches nothing and never
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

self.addEventListener("push", (e) => {
  let msg = { title: "CEO For A Day", body: "Today's call is ready." };
  try {
    msg = { ...msg, ...e.data.json() };
  } catch {
    /* no payload: use the default */
  }
  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: "/icon.png",
      badge: "/icon.png",
      tag: "daily-reminder", // a newer reminder replaces an older one
      data: { url: "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "/app", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => c.url.startsWith(self.location.origin + "/app"));
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
