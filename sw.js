// Network first, cached copy when offline, so the app opens without a connection.
const C = "dayboard-v1";
addEventListener("install", (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(["./", "index.html", "newtab.css", "newtab.js", "shim.js"]))); skipWaiting(); });
addEventListener("activate", (e) => e.waitUntil(clients.claim()));
addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(C).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
});
