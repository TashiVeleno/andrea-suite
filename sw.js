// Service worker minimo: rende l'app installabile e la apre anche senza rete.
// Prima prova sempre la rete (così vedi subito l'ultima versione), la copia salvata serve solo offline.
// Le librerie esterne con la versione nell'indirizzo (Firebase, coriandoli) non cambiano mai: si salvano alla prima apertura.
// I dati non passano di qui: restano nel telefono (localStorage) e nel cloud (Firebase).
const CACHE = "andrea-suite-v3";
const LIBRARIES = ["https://www.gstatic.com/firebasejs/10.8.0/", "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/"];
const FILES = ["./", "./index.html", "./manifest.json", "./icons/icon-192.png?v=2", "./icons/icon-512.png?v=2"];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET") return;
    if (LIBRARIES.some(prefix => url.href.startsWith(prefix))) {
        event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE).then(cache => cache.put(event.request, copy));
            }
            return response;
        })));
        return;
    }
    if (url.origin !== self.location.origin) return; // accesso Google e database Firebase: sempre dalla rete
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request, { ignoreSearch: true })
                .then(hit => hit || (event.request.mode === "navigate" ? caches.match("./index.html") : undefined))
                .then(hit => hit || Response.error()))
    );
});
