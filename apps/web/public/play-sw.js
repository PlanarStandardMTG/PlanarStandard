// The play app's service worker (E26.23), registered with scope /play. It sits at the
// root because a worker's scope cannot reach above its own directory, and /play/sw.js
// could not control /play itself.
//
// No caching: pairings and results must always be live, so every request goes to the
// network. Web push arrives with E26.28.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
