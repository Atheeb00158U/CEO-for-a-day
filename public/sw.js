// The game is online only (Atheeb's call, 2026-10-29). Phones that installed the short-lived offline version still
// run an older copy of this file; when they next check for updates they get this one, which deletes the saved
// files and unregisters itself. Keep it here until no installed copy can still be running the old one.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((c) => c.navigate(c.url))),
  ),
);
