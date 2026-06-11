// sw.js
const VERSION = 'v1';
const SHELL_CACHE = `df-shell-${VERSION}`;
const DATA_CACHE = `df-data-${VERSION}`;
const IMG_CACHE = `df-images-${VERSION}`;
const IS_LOCAL = self.location.hostname === 'localhost';
const BASE = IS_LOCAL ? '' : '/dominion-forger';

const SHELL_FILES = [
    `${BASE}/`,
    `${BASE}/index.html`,
    `${BASE}/css/style.css`,
    `${BASE}/js/router.js`,
    `${BASE}/js/render.js`,
    `${BASE}/js/pages/home.js`,
    `${BASE}/js/pages/randomizer.js`,
    `${BASE}/js/pages/browse.js`,
    `${BASE}/js/pages/card.js`,
    `${BASE}/js/pages/expansions.js`,
    `${BASE}/js/pages/kingdoms.js`,
    `${BASE}/js/pages/statistics.js`,
    `${BASE}/js/pages/help.js`,
    `${BASE}/js/pages/feedback.js`,
    `${BASE}/js/pages/about.js`,
    `${BASE}/js/pages/search.js`,
    `${BASE}/manifest.json`,
    `${BASE}/images/website_icons/DFlogo.jpg`,
    `${BASE}/images/website_icons/DFlogo-192.jpg`,
    `${BASE}/images/website_icons/DFlogo-512.jpg`,
];

const DATA_FILES = [
    'Adventures',
    'Alchemy',
    'Allies',
    'Base',
    'Cornucopia & Guilds',
    'Dark Ages',
    'Dominion',
    'Empires',
    'Hinterlands',
    'Intrigue',
    'Menagerie',
    'Nocturne',
    'Plunder',
    'Promo',
    'Prosperity',
    'Renaissance',
    'Rising Sun',
    'Seaside',
].map(name => `${BASE}/parsed_text/${encodeURIComponent(name)}.json`);

// ── INSTALL — cache shell and all card data ──
self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        await Promise.allSettled(
            SHELL_FILES.map(f => shellCache.add(f).catch(err => console.warn(`[SW] skipped ${f}: ${err.message}`)))
        );
        const dataCache = await caches.open(DATA_CACHE);
        await Promise.allSettled(
            DATA_FILES.map(f => dataCache.add(f).catch(err => console.warn(`[SW] skipped ${f}: ${err.message}`)))
        );
        await self.skipWaiting();
    })());
});

// ── ACTIVATE — delete old caches ──
self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(k => k.startsWith('df-') && ![SHELL_CACHE, DATA_CACHE, IMG_CACHE].includes(k))
                .map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

// ── FETCH — serve from cache, fall back to network ──
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    const path = url.pathname;

    // Card images — cache on demand (only if user has opted in via cacheExpansionImages)
    if (path.includes(`${BASE}/images/expansions/`)) {
        e.respondWith((async () => {
            const imgCache = await caches.open(IMG_CACHE);
            const cached = await imgCache.match(e.request);
            if (cached) return cached;
            try {
                const response = await fetch(e.request);
                if (response.ok) imgCache.put(e.request, response.clone());
                return response;
            } catch {
                return new Response('', { status: 404 });
            }
        })());
        return;
    }

    // Card data
    if (path.includes('/parsed_text/')) {
        e.respondWith((async () => {
            const dataCache = await caches.open(DATA_CACHE);
            const cached = await dataCache.match(e.request);
            if (cached) return cached;
            const response = await fetch(e.request);
            if (response.ok) dataCache.put(e.request, response.clone());
            return response;
        })());
        return;
    }

    // App shell — network first, cache fallback
    e.respondWith((async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        try {
            const response = await fetch(e.request);
            if (response.ok) shellCache.put(e.request, response.clone());
            return response;
        } catch {
            const cached = await shellCache.match(e.request);
            if (cached) return cached;
            if (e.request.mode === 'navigate') {
                return shellCache.match(`${BASE}/index.html`);
            }
            return new Response('', { status: 404 });
        }
    })());
});

// ── MESSAGE — cache all images for an expansion ──
// Called from expansions.js when user marks an expansion as owned
self.addEventListener('message', e => {
    if (e.data?.type === 'CACHE_EXPANSION_IMAGES') {
        const { expansion, imageUrls } = e.data;
        caches.open(IMG_CACHE).then(cache => {
            cache.addAll(imageUrls).then(() => {
                e.source.postMessage({ type: 'EXPANSION_CACHED', expansion });
            }).catch(err => {
                e.source.postMessage({ type: 'EXPANSION_CACHE_FAILED', expansion, err: err.message });
            });
        });
    }

    if (e.data?.type === 'UNCACHE_EXPANSION_IMAGES') {
        const { imageUrls } = e.data;
        caches.open(IMG_CACHE).then(async cache => {
            await Promise.all(imageUrls.map(url => cache.delete(url)));
        });
    }
});
