/**
 * PriceLister SPA Service Worker
 * Intercepts navigation requests to clean URLs (/Workspace/..., /home, /explore, etc.)
 * and serves the respective HTML file (app.html or index.html or login.html) without server 404 crashes.
 */

const CACHE_NAME = 'pricelister-spa-v4';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map(k => caches.delete(k))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept requests for our own origin
    if (url.origin !== self.location.origin) {
        return;
    }

    const path = url.pathname.toLowerCase();

    // 0. Static Asset rewriting for /workspace/css/..., /workspace/js/..., /demo/...
    if (event.request.mode !== 'navigate') {
        if (path.startsWith('/workspace/')) {
            const cleanPath = url.pathname.replace(/^\/workspace/i, '');
            event.respondWith(
                fetch(cleanPath).catch(() => fetch(event.request))
            );
            return;
        }
        if (path.startsWith('/demo/')) {
            const cleanPath = url.pathname.replace(/^\/demo/i, '');
            event.respondWith(
                fetch(cleanPath).catch(() => fetch(event.request))
            );
            return;
        }
        return;
    }

    if (event.request.mode === 'navigate') {
        // 1. Root / Landing Index.html redirect or navigation
        if (path === '/index.html' || path === '/' || path === '') {
            event.respondWith(
                fetch('/index.html')
                    .then(res => res.ok ? res : fetch(event.request))
                    .catch(() => caches.match('/index.html'))
                    .catch(() => fetch(event.request))
            );
            return;
        }

        // 2. Dedicated Login Route -> serve /login.html
        if (path.endsWith('/login.html') || path.endsWith('/login') || path === '/login') {
            event.respondWith(
                fetch('/login.html')
                    .then(res => res.ok ? res : fetch(event.request))
                    .catch(() => caches.match('/login.html'))
                    .catch(() => fetch(event.request))
            );
            return;
        }

        // 3. Landing views (/home, /explore, /pricing, /find, /terms, /privacy, /connection) -> serve /index.html
        const landingViews = ['/home', '/explore', '/pricing', '/find', '/terms', '/privacy', '/connection'];
        const isLandingView = landingViews.some(v => path.endsWith(v) || path === v || path === v + '/');
        if (isLandingView) {
            event.respondWith(
                fetch('/index.html')
                    .then(res => res.ok ? res : fetch(event.request))
                    .catch(() => caches.match('/index.html'))
                    .catch(() => fetch(event.request))
            );
            return;
        }

        // 4. App / Workspace Routes -> serve /app.html
        if (
            path.includes('/workspace') || 
            path.endsWith('/app.html') || 
            path.includes('/customer-invoices') || 
            path.includes('/business-invoices') ||
            path.includes('/demo')
        ) {
            event.respondWith(
                fetch('/app.html')
                    .then(res => res.ok ? res : fetch(event.request))
                    .catch(() => caches.match('/app.html'))
                    .catch(() => fetch(event.request))
            );
            return;
        }

        // 5. Default: passthrough to real network, fallback to /index.html if offline/404
        event.respondWith(
            fetch(event.request).catch(() => fetch('/index.html'))
        );
        return;
    }
});
