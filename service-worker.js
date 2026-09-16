// Bei jeder inhaltlichen Änderung an DATEIEN (oder wenn erzwungen werden soll, dass
// installierte PWAs den alten Cache verwerfen) diese Versionsnummer hochzählen -- der
// activate-Handler unten löscht dann automatisch alle älteren Caches.
const CACHE_NAME = "letzte-welt-v2";
const DATEIEN = [
  "./index.html",
  "./style.css",
  "./spiel.js",
  "./netzwerk.js",
  "./karten-daten.js",
  "./manifest.json",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(DATEIEN)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: Updates werden sofort sichtbar, sobald online. Der Cache wird bei jedem
// erfolgreichen Abruf aktualisiert und dient nur noch als Fallback für den eigentlichen
// Zweck dieser PWA -- Offline-Spielbarkeit, wenn kein Netzwerk erreichbar ist.
self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request)
      .then((antwort) => {
        const kopie = antwort.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, kopie));
        return antwort;
      })
      .catch(() => caches.match(e.request))
  );
});
