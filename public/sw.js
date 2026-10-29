// Offline play for the installed app. Registered from /app with scope "/app", so the website and /admin are never
// controlled, and nothing from /admin is ever cached. Hand-written on purpose: one page, two caches, no build step.
const SHELL = "shell-v1"; // the /app page itself, network first
const ASSETS = "assets-v1"; // hashed JS/CSS and media, cache first

self.addEventListener("install", (e) => e.waitUntil(precache().then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// The first visit loads before this worker controls the page, so save the page and the files it named now.
async function precache() {
  const res = await fetch("/app", { cache: "no-store" });
  if (!res.ok) return;
  const html = await res.clone().text();
  await (await caches.open(SHELL)).put("/app", res);
  const assets = await caches.open(ASSETS);
  const files = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g));
  await Promise.allSettled([...files, "/icons/icon-192.png", "/manifest.webmanifest"].map((f) => assets.add(f)));
}

// The page sends files it loaded before this worker took over (the sound effects), so they work offline too.
self.addEventListener("message", (e) => {
  if (Array.isArray(e.data?.save))
    e.waitUntil(caches.open(ASSETS).then((c) => Promise.allSettled(e.data.save.map((f) => c.match(f).then((hit) => hit || c.add(f))))));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/admin")) return;
  if (req.mode === "navigate") e.respondWith(page(req));
  else if (/^\/(_next\/static|media|audio|sfx|icons|brand)\//.test(url.pathname)) e.respondWith(asset(req, url.pathname));
});

async function page(req) {
  try {
    const res = await fetch(req);
    if (res.ok && new URL(req.url).pathname === "/app") await (await caches.open(SHELL)).put("/app", res.clone());
    return res;
  } catch {
    return (await caches.match("/app")) ?? Response.error();
  }
}

async function asset(req, path) {
  const cache = await caches.open(ASSETS);
  let res = await cache.match(path);
  if (!res) {
    res = await fetch(path); // the whole file, never a byte range, so it can be cached
    if (res.status !== 200) return res; // a missing recording stays a 404 and the app uses the browser voice
    await cache.put(path, res.clone());
  }
  const range = req.headers.get("range");
  return range ? slice(res, range) : res;
}

// Audio and video ask for byte ranges (Safari insists on a 206 reply), so cut them from the cached file.
async function slice(res, range) {
  const buf = await res.arrayBuffer();
  const [, a, b] = /bytes=(\d*)-(\d*)/.exec(range) ?? [];
  const size = buf.byteLength;
  const start = a ? Number(a) : b ? Math.max(0, size - Number(b)) : 0;
  const end = a && b ? Math.min(Number(b), size - 1) : size - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
