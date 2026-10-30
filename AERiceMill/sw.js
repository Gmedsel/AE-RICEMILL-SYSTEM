// ============================================
// AE RICEMILL — Service Worker (sw.js)
// PWA: Offline shell caching + network-first
// strategy for Firebase/CDN resources.
// ============================================

const CACHE_NAME   = 'aericemill';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/rice1.png',
    // Add any local icon files here, e.g.:
    // '/icons/icon-192.png',
    // '/icons/icon-512.png',
];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(SHELL_ASSETS);
        })
    );
    self.skipWaiting();
});

// ── Activate: clean up old caches ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch strategy ──
//   • Firebase Realtime DB & CDN (fonts, chart.js, FA) → Network-first
//   • App shell assets → Cache-first with network fallback
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Skip non-GET and chrome-extension requests
    if (event.request.method !== 'GET' || url.startsWith('chrome-extension')) {
        return;
    }

    // Network-first for Firebase, Google APIs, and CDN resources
    const isExternal =
        url.includes('firebaseio.com') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com') ||
        url.includes('cdnjs.cloudflare.com') ||
        url.includes('fonts.googleapis.com') ||
        url.includes('cdn.jsdelivr.net');

    if (isExternal) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // External CDN failed — return nothing (graceful degradation)
                return new Response('', { status: 503, statusText: 'Service Unavailable' });
            })
        );
        return;
    }

    // Cache-first for local app shell assets
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Only cache valid responses for same-origin assets
                if (
                    response &&
                    response.status === 200 &&
                    response.type === 'basic'
                ) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // If both cache and network fail, return the cached index.html
                // so navigation still works offline
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});