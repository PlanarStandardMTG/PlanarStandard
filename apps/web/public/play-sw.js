// The play app's service worker (E26.23), registered with scope /play. It sits at the
// root because a worker's scope cannot reach above its own directory, and /play/sw.js
// could not control /play itself.
//
// No caching: pairings and results must always be live, so every request goes to the
// network. It does show notifications the server pushes (E26.28).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let message = { title: "Planar Standard Play", body: "", url: "/play", tag: "play" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // An empty or unreadable push still says something rather than nothing.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      renotify: true,
      icon: "/play/icon-192.png",
      badge: "/play/icon-192.png",
      data: { url: message.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/play", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w ?? open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
