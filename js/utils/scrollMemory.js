/**
 * Universal Sectional Scroll Memory Manager
 * Temporarily stores the last scroll position of every route and sectional sub-view until page refresh.
 * Guarantees that scrolling down on one screen (e.g. Overview or Products list) never bleeds into another screen.
 */

// In-memory map (automatically wiped on browser tab reload/refresh)
const inMemoryScrollStore = new Map();

// Clear sessionStorage cache on fresh browser reload/refresh
try {
    if (typeof window !== 'undefined' && window.performance) {
        const navEntries = performance.getEntriesByType('navigation');
        if (navEntries.length > 0 && navEntries[0].type === 'reload') {
            for (let i = sessionStorage.length - 1; i >= 0; i--) {
                const k = sessionStorage.key(i);
                if (k && k.startsWith('pricelister_scroll_')) {
                    sessionStorage.removeItem(k);
                }
            }
        }
    }
} catch (e) {}

/**
 * Get the active scroll container element
 */
export const getScrollContainer = () => {
    const ws = document.getElementById('workspace-container') || document.querySelector('.workspace-area');
    if (ws && (ws.scrollHeight > ws.clientHeight || ws.scrollTop > 0)) {
        return ws;
    }
    const main = document.querySelector('.main-content');
    if (main && (main.scrollHeight > main.clientHeight || main.scrollTop > 0)) {
        return main;
    }
    return window;
};

/**
 * Get current scroll position Y across all possible scrolling elements
 */
export const getCurrentScrollY = () => {
    const ws = document.getElementById('workspace-container') || document.querySelector('.workspace-area');
    if (ws && ws.scrollTop > 0) return ws.scrollTop;
    const main = document.querySelector('.main-content');
    if (main && main.scrollTop > 0) return main.scrollTop;
    return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
};

/**
 * Set scroll position Y directly across all scrollable containers
 */
export const setScrollY = (y = 0, smooth = false) => {
    const targetY = Math.max(0, Math.round(Number(y) || 0));
    const behavior = smooth ? 'smooth' : 'auto';

    const ws = document.getElementById('workspace-container') || document.querySelector('.workspace-area');
    if (ws) {
        try { ws.scrollTo({ top: targetY, behavior }); } catch (e) { ws.scrollTop = targetY; }
    }
    const main = document.querySelector('.main-content');
    if (main) {
        try { main.scrollTo({ top: targetY, behavior }); } catch (e) { main.scrollTop = targetY; }
    }
    try { window.scrollTo({ top: targetY, behavior }); } catch (e) {}
    if (document.documentElement) {
        document.documentElement.scrollTop = targetY;
    }
    if (document.body) {
        document.body.scrollTop = targetY;
    }
};

/**
 * Save scroll position for a specific screen/route/sub-view key
 */
export const saveScrollPosition = (key) => {
    if (!key) return;
    const y = getCurrentScrollY();
    inMemoryScrollStore.set(key, y);
    try {
        sessionStorage.setItem('pricelister_scroll_' + key, String(y));
    } catch (e) {}
};

/**
 * Restore scroll position for a specific screen/route/sub-view key
 * Default is 0 so any unvisited screen starts fresh at the top!
 */
export const restoreScrollPosition = (key, defaultY = 0) => {
    let y = null;
    if (key) {
        if (inMemoryScrollStore.has(key)) {
            y = inMemoryScrollStore.get(key);
        } else {
            try {
                const stored = sessionStorage.getItem('pricelister_scroll_' + key);
                if (stored !== null && stored !== '') y = parseFloat(stored);
            } catch (e) {}
        }
    }
    const targetY = (y !== null && !isNaN(y)) ? y : defaultY;

    // Immediate execution
    setScrollY(targetY);

    // Staggered frames to accommodate async rendering and image/DOM painting
    requestAnimationFrame(() => {
        setScrollY(targetY);
    });
    setTimeout(() => {
        setScrollY(targetY);
    }, 40);
    setTimeout(() => {
        setScrollY(targetY);
    }, 120);
    setTimeout(() => {
        setScrollY(targetY);
    }, 280);
};

/**
 * Reset scroll to top immediately
 */
export const resetScrollToTop = (smooth = false) => {
    setScrollY(0, smooth);
    requestAnimationFrame(() => setScrollY(0, smooth));
};

// Global attachment for convenience across legacy callbacks
if (typeof window !== 'undefined') {
    window.__scrollMemory = {
        save: saveScrollPosition,
        restore: restoreScrollPosition,
        reset: resetScrollToTop,
        getY: getCurrentScrollY,
        setY: setScrollY
    };
}

