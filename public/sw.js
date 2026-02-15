// Mi Talento PWA Service Worker
// Cache-first for static assets, Network-first for API calls

const CACHE_VERSION = 'mi-talento-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Static assets to pre-cache on install
const PRECACHE_URLS = [
    '/dashboard',
    '/offline.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
];

// Install — pre-cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Pre-caching static assets');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys
                        .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                        .map((key) => {
                            console.log('[SW] Deleting old cache:', key);
                            return caches.delete(key);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch — smart caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip Firebase/external API requests (let them go through normally)
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('securetoken') ||
        url.pathname.startsWith('/api/')
    ) {
        return;
    }

    // Strategy: Cache-first for static assets (JS, CSS, images, fonts)
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Strategy: Network-first for pages (HTML navigation)
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstWithOfflineFallback(request));
        return;
    }

    // Default: Network-first with cache fallback
    event.respondWith(networkFirst(request));
});

// --- Caching Strategies ---

// Cache-first: check cache, fallback to network
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

// Network-first: try network, fallback to cache
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

// Network-first for navigation with offline fallback page
async function networkFirstWithOfflineFallback(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Show offline fallback page
        return caches.match('/offline.html');
    }
}

// --- Helpers ---

function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot|ico)$/i.test(pathname) ||
        pathname.startsWith('/_next/static/');
}
