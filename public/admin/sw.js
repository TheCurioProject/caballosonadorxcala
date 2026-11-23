/* global self, caches, fetch, Response, URL, clients */
const PUBLIC_CACHE = "cala-caballo-public-v3";
const OFFLINE = "/cala/offline.html";
const PUBLIC_PATHS = new Set([
  OFFLINE,
  "/cala/pwa/icon-192.png",
  "/cala/pwa/icon-512.png",
  "/cala/pwa/maskable-512.png",
  "/cala/pwa/apple-touch-icon.png",
]);
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PUBLIC_CACHE).then((cache) => cache.addAll([...PUBLIC_PATHS])),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith("cala-caballo-public-") && key !== PUBLIC_CACHE,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache authenticated pages/API responses, queue mutations, or invent API successes.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (request.mode === "navigate" && url.pathname.startsWith("/admin/")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE);
        return (
          cached ??
          new Response(
            "Sin conexión. Vuelve a intentar cuando tengas internet.",
            {
              status: 503,
              headers: { "Content-Type": "text/plain;charset=utf-8" },
            },
          )
        );
      }),
    );
    return;
  }
  if (PUBLIC_PATHS.has(url.pathname) && !url.search) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
  }
});

// CALA notifications (bell + browser push). The server only sends what the
// person's role may see; the text arrives ready to show.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "CALA", body: event.data ? event.data.text() : "" };
  }
  const url =
    typeof data.url === "string" && data.url.startsWith("/admin/")
      ? data.url
      : "/admin/inicio/";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "CALA", {
        body: data.body || "",
        icon: "/cala/pwa/icon-192.png",
        badge: "/cala/pwa/icon-192.png",
        tag: data.id || undefined,
        data: { url, id: data.id },
      }),
      // Open CALA tabs refresh their bell at once.
      clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((list) =>
          list.forEach((client) =>
            client.postMessage({ type: "cala-notification", id: data.id }),
          ),
        ),
    ]),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    event.notification.data?.url || "/admin/inicio/",
    self.location.origin,
  ).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const open = list.find((client) =>
          client.url.startsWith(self.location.origin + "/admin/"),
        );
        if (open) {
          open.postMessage({ type: "cala-open", url });
          return open.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
