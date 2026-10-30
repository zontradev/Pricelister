/**
 * PriceLister SPA Service Worker
 * Intercepts navigation requests to clean URLs (/Workspace/..., /home, /explore, etc.)
 * and serves the respective HTML file (app.html or index.html) without server 404 crashes.
 */

const CACHE_NAME = 'pricelister-spa-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const path = url.pathname.toLowerCase();

    // 0. Asset rewrites for subroutes (/workspace/css/..., /workspace/js/..., /demo/...)
    if (event.request.mode !== 'navigate') {
        if (path.startsWith('/workspace/')) {
            const cleanPath = url.pathname.replace(/^\/workspace/i, '');
            event.respondWith(fetch(cleanPath).catch(() => fetch(event.request)));
            return;
        }
        if (path.startsWith('/demo/')) {
            const cleanPath = url.pathname.replace(/^\/demo/i, '');
            event.respondWith(fetch(cleanPath).catch(() => fetch(event.request)));
            return;
        }
    }

    if (event.request.mode === 'navigate') {
        // 1. App / Workspace Routes -> serve /app.html
        if (
            path.includes('/workspace') || 
            path.endsWith('/app.html') || 
            path.includes('/customer-invoices') || 
            path.includes('/business-invoices') ||
            path.includes('/demo')
        ) {
            event.respondWith(
                fetch('/app.html').catch(() => caches.match('/app.html'))
            );
            return;
        }

        // 2. Landing views (/home, /explore, /pricing, /find, /terms, /privacy) -> serve /index.html
        const landingViews = ['/home', '/explore', '/pricing', '/find', '/terms', '/privacy'];
        const isLandingView = landingViews.some(v => path.endsWith(v) || path === v || path === v + '/');
        if (isLandingView || path === '/' || path === '') {
            event.respondWith(
                fetch('/index.html').catch(() => caches.match('/index.html'))
            );
            return;
        }
    }
});
