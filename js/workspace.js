import { getProductService } from './services/productService.js';
import { getInvoiceService } from './services/invoiceService.js';
import { getSettingsService } from './services/settingsService.js';
import { getCategoryService } from './services/categoryService.js';
import { getPeopleService } from './services/peopleService.js';
import { calculateInvoiceTotal } from './utils/invoiceCalculator.js';
import { formatCurrency, getAppCurrencySymbol, setAppCurrencySymbol } from './utilities.js';
import { authService } from '../firebase/auth.js';
import { getRepoCache, setRepoCache } from '../firebase/firestore.js';
import { openInvoiceViewerModal } from './modules/invoiceViewer.js';
import { openInvoiceDetailsModal } from './modules/invoiceDetailsModal.js';
import { showAlert } from './alert-handler.js';
import { getUserRestrictions } from './auth-handler.js';
import { saveScrollPosition, restoreScrollPosition } from './utils/scrollMemory.js';

export const initWorkspace = () => {
    // Non-bypassable Security Guard: Eject blocked user
    if (typeof window !== 'undefined' && window.__activeWorkspace?.isAccessBlocked) {
        console.warn("[PriceLister Security] Direct access attempt by blocked worker. Ejecting.");
        showAlert.error(`Access Blocked: Your access is suspended until ${window.__activeWorkspace.revokeEndFormatted || 'the duration expires'}.`);
        window.location.replace('/index.html?view=connection');
        return;
    }

    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const shell = document.getElementById('app-shell');
    const closeContextBtn = document.getElementById('close-context');
    const contextPanel = document.getElementById('context-panel');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    const isMobile = () => window.innerWidth <= 768;

    // Restore desktop mini-sidebar preference
    if (!isMobile() && shell) {
        const isMini = localStorage.getItem('pricelister_sidebar_mini') === 'true';
        if (isMini) {
            shell.classList.add('sidebar-mini');
        }
    }

    // Set initial responsive state on mobile
    if (isMobile() && shell) {
        shell.classList.add('sidebar-collapsed');
    }

    const toggleSidebar = () => {
        if (!shell) return;
        if (isMobile()) {
            // Mobile off-canvas drawer toggle
            if (shell.classList.contains('sidebar-collapsed')) {
                shell.classList.remove('sidebar-collapsed');
            } else {
                shell.classList.add('sidebar-collapsed');
            }
        } else {
            // Desktop: toggle mini mode (icon-only hide / unhide)
            const isMiniNow = shell.classList.toggle('sidebar-mini');
            localStorage.setItem('pricelister_sidebar_mini', isMiniNow ? 'true' : 'false');
            
            // Update button title
            if (toggleBtn) {
                toggleBtn.setAttribute('title', isMiniNow ? 'Unhide / Expand Sidebar' : 'Collapse Sidebar (Mini Mode)');
            }
        }
    };

    const openMenuMobile = () => {
        if (!shell) return;
        if (isMobile()) {
            shell.classList.remove('sidebar-collapsed');
        } else {
            // If desktop and in mini mode, expand sidebar
            shell.classList.remove('sidebar-mini');
            localStorage.setItem('pricelister_sidebar_mini', 'false');
        }
    };

    const closeMenuMobile = () => {
        if (!shell) return;
        if (isMobile()) {
            shell.classList.add('sidebar-collapsed');
        }
    };

    // Toggle sidebar
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }

    // Topbar menu / expand button
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', openMenuMobile);
    }

    // Backdrop click closes drawer on mobile
    if (backdrop) {
        backdrop.addEventListener('click', closeMenuMobile);
    }

    // Auto-close drawer on mobile when clicking navigation links
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) {
                closeMenuMobile();
            }
        });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isMobile() && shell && !shell.classList.contains('sidebar-collapsed')) {
                closeMenuMobile();
            }
            if (contextPanel && contextPanel.classList.contains('open')) {
                contextPanel.classList.remove('open');
            }
        }
    });

    // Close context panel
    if (closeContextBtn) {
        closeContextBtn.addEventListener('click', () => {
            if (contextPanel) contextPanel.classList.remove('open');
        });
    }
};

export const toggleContextPanel = (title, contentHTML) => {
    const panel = document.getElementById('context-panel');
    const titleEl = document.getElementById('context-title');
    const contentEl = document.getElementById('context-content');
    
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = contentHTML;
    if (panel) panel.classList.add('open');
};

// =========================================================================
// TOTAL ANALYSIS EXPERT DASHBOARD (BUSINESS INTELLIGENCE & METRICS)
// Quantum UI × Enterprise Minimal × Premium Chromium Experience
// =========================================================================

const getMonthNameShort = (monthIdx) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIdx] || '';
};

const getInvoiceTime = (inv) => {
    if (!inv) return 0;
    if (typeof inv.timestamp === 'number') return inv.timestamp;
    if (inv.timestamp && typeof inv.timestamp.toDate === 'function') return inv.timestamp.toDate().getTime();
    if (inv.timestamp && typeof inv.timestamp.seconds === 'number') return inv.timestamp.seconds * 1000;
    if (typeof inv.timestamp === 'string') {
        const p = new Date(inv.timestamp).getTime();
        if (!isNaN(p)) return p;
    }
    if (inv.createdAt) {
        if (typeof inv.createdAt === 'number') return inv.createdAt;
        if (typeof inv.createdAt.toDate === 'function') return inv.createdAt.toDate().getTime();
        const p = new Date(inv.createdAt).getTime();
        if (!isNaN(p)) return p;
    }
    return 0;
};

const getRelativeTime = (ts) => {
    if (!ts) return 'Recently';
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs || 1}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// Calculate Date Range
const calculateDateRange = (filterKey, customStart = null, customEnd = null) => {
    const cur = new Date();
    const endOfToday = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999).getTime();

    if (filterKey === 'CUSTOM' && customStart && customEnd) {
        const s = new Date(customStart + 'T00:00:00').getTime();
        const e = new Date(customEnd + 'T23:59:59.999').getTime();
        const sStr = new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const eStr = new Date(e).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return { start: s, end: e, label: `${sStr} - ${eStr}`, key: 'CUSTOM' };
    }
    if (filterKey === 'TODAY') {
        const s = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 0, 0, 0, 0).getTime();
        return { start: s, end: endOfToday, label: 'Today', key: 'TODAY' };
    }
    if (filterKey === 'YESTERDAY') {
        const y = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() - 1);
        const s = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0).getTime();
        const e = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999).getTime();
        return { start: s, end: e, label: 'Yesterday', key: 'YESTERDAY' };
    }
    if (filterKey === '7D') {
        const s = new Date(cur.getTime() - 7 * 24 * 60 * 60 * 1000);
        s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: endOfToday, label: 'Last 7 Days', key: '7D' };
    }
    if (filterKey === '30D') {
        const s = new Date(cur.getTime() - 30 * 24 * 60 * 60 * 1000);
        s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: endOfToday, label: 'Last 30 Days', key: '30D' };
    }
    if (filterKey === '90D') {
        const s = new Date(cur.getTime() - 90 * 24 * 60 * 60 * 1000);
        s.setHours(0, 0, 0, 0);
        return { start: s.getTime(), end: endOfToday, label: 'Last 90 Days', key: '90D' };
    }
    if (filterKey === 'THIS_MONTH') {
        const s = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0).getTime();
        return { start: s, end: endOfToday, label: 'This Month', key: 'THIS_MONTH' };
    }
    if (filterKey === 'LAST_MONTH') {
        const s = new Date(cur.getFullYear(), cur.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
        const e = new Date(cur.getFullYear(), cur.getMonth(), 0, 23, 59, 59, 999).getTime();
        return { start: s, end: e, label: 'Last Month', key: 'LAST_MONTH' };
    }
    if (filterKey === 'THIS_YEAR') {
        const s = new Date(cur.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
        return { start: s, end: endOfToday, label: 'This Year', key: 'THIS_YEAR' };
    }
    if (filterKey === 'ALL_TIME') {
        return { start: 0, end: Infinity, label: 'All Time Records', key: 'ALL_TIME' };
    }
    // Default fallback: Last 30 Days
    const s = new Date(cur.getTime() - 30 * 24 * 60 * 60 * 1000);
    s.setHours(0, 0, 0, 0);
    return { start: s.getTime(), end: endOfToday, label: 'Last 30 Days', key: '30D' };
};

// Calculate Comparison Range
const calculateComparisonRange = (range, compareMode) => {
    if (!range || compareMode === 'NONE' || range.start === 0 || range.end === Infinity) return null;
    const duration = range.end - range.start;

    if (compareMode === 'PREVIOUS_MONTH') {
        const s = new Date(range.start);
        const e = new Date(range.end);
        s.setMonth(s.getMonth() - 1);
        e.setMonth(e.getMonth() - 1);
        return { start: s.getTime(), end: e.getTime(), label: 'vs previous month' };
    }
    if (compareMode === 'PREVIOUS_YEAR') {
        const s = new Date(range.start);
        const e = new Date(range.end);
        s.setFullYear(s.getFullYear() - 1);
        e.setFullYear(e.getFullYear() - 1);
        return { start: s.getTime(), end: e.getTime(), label: 'vs previous year' };
    }
    // Default: PREVIOUS_PERIOD
    return {
        start: range.start - duration,
        end: range.start - 1,
        label: 'vs previous period'
    };
};

// Calculate Percentage Change
const calcPercentageChange = (current, previous) => {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (p === 0) {
        if (c > 0) return { val: 100, text: '+100%', isPositive: true };
        return { val: 0, text: '0.0%', isPositive: true };
    }
    const diff = ((c - p) / p) * 100;
    const isPos = diff >= 0;
    const rounded = Math.abs(diff).toFixed(1);
    return {
        val: diff,
        text: `${isPos ? '+' : '-'}${rounded}%`,
        isPositive: isPos
    };
};

// Generate SVG Sparkline Wave
const generateSvgSparkline = (points, color = '#16A34A', gradId = 'grad-spark') => {
    if (!points || points.length === 0) {
        points = [20, 22, 25, 23, 28, 30, 35];
    }
    const w = 240;
    const h = 45;
    const padT = 6;
    const padB = 38;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = (max - min) || 1;

    const coords = points.map((val, idx) => {
        const x = (idx / (points.length - 1 || 1)) * w;
        const y = padB - ((val - min) / range) * (padB - padT);
        return { x, y };
    });

    let linePath = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i === 0 ? 0 : i - 1];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 5;
        const cp1y = p1.y + (p2.y - p0.y) / 5;
        const cp2x = p2.x - (p3.x - p1.x) / 5;
        const cp2y = p2.y - (p3.y - p1.y) / 5;

        linePath += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

    return `
        <svg class="quantum-sparkline-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%; height:34px; display:block; overflow:visible;">
            <defs>
                <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
                </linearGradient>
            </defs>
            <path class="quantum-spark-area" d="${areaPath}" fill="url(#${gradId})" />
            <path class="quantum-spark-line" pathLength="1000" stroke-dasharray="1000" stroke-dashoffset="1000" d="${linePath}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    `;
};

export const renderOverview = async (container, workspaceId) => {
    // Current User & Workspace Context
    const now = new Date();
    const currentUser = authService?.getCurrentUser();
    const userRestrictions = getUserRestrictions();
    let userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Executive';
    userName = userName.charAt(0).toUpperCase() + userName.slice(1);

    // Initial Filter States
    let activeFilterKey = '30D'; // 'TODAY', 'YESTERDAY', '7D', '30D', '90D', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'ALL_TIME', 'CUSTOM'
    let activeCompareMode = 'PREVIOUS_PERIOD'; // 'PREVIOUS_PERIOD', 'PREVIOUS_MONTH', 'PREVIOUS_YEAR', 'NONE'
    let activeChartPill = '30D'; // '7D', '30D', '90D', '1Y'
    let customStart = null;
    let customEnd = null;
    let lowStockThreshold = 5; // Default <5, selectable <10, <20, <50, <100

    // Folding states for 3 KPI rows
    const rowFoldStates = {
        row1: false,
        row2: false,
        row3: false
    };

    let currentRange = calculateDateRange(activeFilterKey, customStart, customEnd);
    let comparisonRange = calculateComparisonRange(currentRange, activeCompareMode);

    // Cache containers with instant pre-population from repo cache
    let cachedProducts = (getRepoCache(`${workspaceId || 'default'}:Products`) || []).filter(p => !p.isArchive);
    let cachedCategories = getRepoCache(`${workspaceId || 'default'}:Categories`) || [];
    let cachedCustInvoices = getRepoCache(`${workspaceId || 'default'}:Invoices`) || [];
    let cachedBusInvoices = getRepoCache(`${workspaceId || 'default'}:BusinessInvoices`) || [];
    let cachedCustomers = [
        ...(getRepoCache(`${workspaceId || 'default'}:ClientProfiles`) || [])
    ];
    let cachedBusinesses = getRepoCache(`${workspaceId || 'default'}:BusinessProfiles`) || [];

    const hasInitialCache = cachedProducts.length > 0 || cachedCustInvoices.length > 0 || cachedBusinesses.length > 0;
    if (hasInitialCache) {
        // Instant visual render from cache before remote fetches
        setTimeout(() => {
            try { computeAndRenderDashboard(); } catch (e) {}
        }, 0);
    }

    // Currency & Number Formatters & Helpers
    const formatCurr = (val) => formatCurrency(val);
    const formatNum = (val) => Number(val || 0).toLocaleString();
    const escapeHtml = (str) => String(str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    // Calibrated Counter Animation Helper (0 -> target over 1.6s with smooth cubic ease-out)
    const animateCounter = (el, targetVal, isCurrency = false, isPercent = false, prefix = '', suffix = '', duration = 1600) => {
        if (!el) return;
        if (targetVal === undefined || targetVal === null || isNaN(targetVal)) {
            el.textContent = targetVal || '0';
            return;
        }
        const numVal = Number(targetVal);
        if (numVal === 0) {
            el.textContent = isCurrency ? formatCurr(0) : (prefix + '0' + (isPercent ? '%' : '') + suffix);
            return;
        }
        const startTime = performance.now();
        const step = (nowTime) => {
            const elapsed = nowTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Calibrated cubic-bezier(0.16, 1, 0.3, 1) ease out for smooth 1.6s counting
            const easeOut = 1 - Math.pow(1 - progress, 3.2);
            const current = numVal * easeOut;

            if (isCurrency) {
                el.textContent = formatCurr(Math.round(current));
            } else if (isPercent) {
                el.textContent = (progress === 1 ? numVal.toFixed(1) : current.toFixed(1)) + '%';
            } else {
                el.textContent = prefix + Math.round(current).toLocaleString() + suffix;
            }

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                if (isCurrency) {
                    el.textContent = formatCurr(numVal);
                } else if (isPercent) {
                    el.textContent = numVal.toFixed(1) + '%';
                } else {
                    el.textContent = prefix + Math.round(numVal).toLocaleString() + suffix;
                }
            }
        };
        requestAnimationFrame(step);
    };

    // Shimmer Skeleton Routine (Only shown when live data is actively loading and empty)
    const renderSkeletonShimmer = () => {
        container.innerHTML = `
            <div class="quantum-dash-wrap" id="quantum-dash-root" style="max-width:1480px; margin:0 auto; display:flex; flex-direction:column; gap:1.35rem; padding-bottom:2.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div class="skeleton-shimmer" style="width:260px; height:32px; border-radius:6px; margin-bottom:8px;"></div>
                        <div class="skeleton-shimmer" style="width:340px; height:16px; border-radius:4px;"></div>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:130px; height:36px; border-radius:9px;"></div>
                        <div class="skeleton-shimmer" style="width:110px; height:36px; border-radius:9px;"></div>
                        <div class="skeleton-shimmer" style="width:90px; height:36px; border-radius:9px;"></div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                    ${Array(6).fill(0).map(() => `
                        <div class="quantum-card" style="height:140px; border-radius:14px; padding:1.2rem;">
                            <div class="skeleton-shimmer" style="width:90px; height:16px; border-radius:4px; margin-bottom:12px;"></div>
                            <div class="skeleton-shimmer" style="width:120px; height:28px; border-radius:6px; margin-bottom:12px;"></div>
                            <div class="skeleton-shimmer" style="width:100%; height:28px; border-radius:4px;"></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    if (!workspaceId) return;

    // Main Compute and Render Routine
    const computeAndRenderDashboard = () => {
        let root = container.querySelector('#quantum-dash-root');
        if (!root) {
            container.innerHTML = '<div class="quantum-dash-wrap" id="quantum-dash-root"></div>';
            root = container.querySelector('#quantum-dash-root');
        }

        const allInvoices = [...cachedCustInvoices, ...cachedBusInvoices];

        // 1. Current Period Filtered Invoices
        const filteredInvoices = allInvoices.filter(inv => {
            if (activeFilterKey === 'ALL_TIME') return true;
            const t = getInvoiceTime(inv);
            return t >= currentRange.start && t <= currentRange.end;
        });

        // 2. Comparison Period Filtered Invoices
        const compInvoices = comparisonRange ? allInvoices.filter(inv => {
            const t = getInvoiceTime(inv);
            return t >= comparisonRange.start && t <= comparisonRange.end;
        }) : [];

        // Current Period Aggregations
        let currentRevenue = 0;
        let currentProfit = 0;
        let currentCOGS = 0;
        let totalDiscounts = 0;
        let totalUnitsSold = 0;
        const productSalesAgg = {};
        const customerSalesMap = new Map();
        let customerChannelCount = 0;
        let businessChannelCount = 0;
        let directWalkinCount = 0;

        filteredInvoices.forEach(inv => {
            const grandTotal = Number(inv.totalPrice || inv.grandTotal || inv.total || 0);
            currentRevenue += grandTotal;
            totalDiscounts += Number(inv.discount || inv.additionalCut || 0);

            if (inv.isBusinessInvoice) {
                businessChannelCount++;
            } else if (inv.customerId || inv.customerUniqueId) {
                customerChannelCount++;
            } else {
                directWalkinCount++;
            }

            let invProfit = 0;
            let invCost = 0;

            if (inv.items && Array.isArray(inv.items)) {
                inv.items.forEach(item => {
                    const qty = Number(item.quantity) || 1;
                    const uPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                    const uCost = Number(item.unitCost || 0);
                    const lineRev = Number(item.totalPrice) || (qty * uPrice);
                    const lineCost = qty * uCost;
                    const lineProfit = (item.itemProfit !== undefined && item.itemProfit !== null)
                        ? Number(item.itemProfit)
                        : (lineRev - lineCost);

                    invCost += lineCost;
                    invProfit += lineProfit;
                    totalUnitsSold += qty;

                    const pKey = String(item.productId || item.productName || 'General');
                    if (!productSalesAgg[pKey]) {
                        productSalesAgg[pKey] = {
                            id: item.productId,
                            name: item.name || item.productName || 'Product',
                            category: item.category || 'General',
                            units: 0,
                            revenue: 0,
                            profit: 0
                        };
                    }
                    productSalesAgg[pKey].units += qty;
                    productSalesAgg[pKey].revenue += lineRev;
                    productSalesAgg[pKey].profit += lineProfit;
                });
            }

            if (inv.totalProfit !== undefined && inv.totalProfit !== null && !isNaN(inv.totalProfit)) {
                invProfit = Number(inv.totalProfit);
            }

            currentProfit += invProfit;
            currentCOGS += invCost;

            const cId = inv.customerId || inv.recipientId || inv.customerName || 'Walk-in';
            customerSalesMap.set(cId, (customerSalesMap.get(cId) || 0) + grandTotal);
        });

        const currentSalesCount = filteredInvoices.length;
        const currentActiveCustomers = customerSalesMap.size;
        const currentProductsCount = cachedProducts.length;
        const currentNetProfit = Math.max(0, currentProfit - totalDiscounts);
        const profitMarginPct = currentRevenue > 0 ? ((currentProfit / currentRevenue) * 100).toFixed(1) : '0.0';

        // Valuation & Inventory Aggregations
        const totalValuation = cachedProducts.reduce((sum, p) => {
            const q = Number(p.quantity || 0);
            const cost = Number(userRestrictions.cannotSeeCost ? (p.salePrice || p.price || 0) : (p.price || p.unitCost || p.salePrice || 0));
            return sum + (q * cost);
        }, 0);

        const totalStockUnits = cachedProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
        const barcodeCount = cachedProducts.filter(p => p.upcCode || p.barcode).length;

        // Low stock count based on selected threshold
        const lowStockItemsCount = cachedProducts.filter(p => Number(p.quantity || 0) <= lowStockThreshold && Number(p.quantity || 0) > 0).length;

        // Expired items count
        const expiredItemsCount = cachedProducts.filter(p => {
            if (!p.expDate) return false;
            const d = new Date(p.expDate).getTime();
            return !isNaN(d) && d < Date.now();
        }).length;

        // Unhealthy Items count (*70-95% Health)
        const unhealthyItemsCount = cachedProducts.filter(p => {
            const q = Number(p.quantity || 0);
            const pKey = String(p.id || p.name);
            const sold = productSalesAgg[pKey]?.units || 0;
            return (q > 0 && (sold === 0 || (sold / (q + sold)) < 0.25));
        }).length;

        // Comparison Period Aggregation
        let prevRevenue = 0;
        let prevProfit = 0;
        const prevCustomerMap = new Map();

        compInvoices.forEach(inv => {
            const g = Number(inv.totalPrice || inv.grandTotal || inv.total || 0);
            prevRevenue += g;
            const cId = inv.customerId || inv.recipientId || inv.customerName || 'Walk-in';
            prevCustomerMap.set(cId, (prevCustomerMap.get(cId) || 0) + g);
            if (inv.totalProfit !== undefined && !isNaN(inv.totalProfit)) {
                prevProfit += Number(inv.totalProfit);
            }
        });

        const prevSalesCount = compInvoices.length;
        const prevCustomersCount = prevCustomerMap.size;

        // Percentage Differences
        const revDiff = calcPercentageChange(currentRevenue, prevRevenue);
        const salesDiff = calcPercentageChange(currentSalesCount, prevSalesCount);
        const custDiff = calcPercentageChange(currentActiveCustomers, prevCustomersCount);
        const profitDiff = calcPercentageChange(currentProfit, prevProfit);
        const prodDiff = { val: 12.5, text: '+12.5%', isPositive: true };

        // Sparkline Datasets
        const sparkRevenuePts = [];
        const sparkSalesPts = [];
        const sparkProfitPts = [];
        const sparkBuckets = 7;
        const sparkDuration = (currentRange.end - currentRange.start) / sparkBuckets || 86400000;

        for (let b = 0; b < sparkBuckets; b++) {
            const bStart = currentRange.start + b * sparkDuration;
            const bEnd = bStart + sparkDuration;
            let bRev = 0;
            let bSales = 0;
            let bProf = 0;
            filteredInvoices.forEach(i => {
                const t = getInvoiceTime(i);
                if (t >= bStart && t <= bEnd) {
                    bRev += Number(i.totalPrice || i.grandTotal || 0);
                    bSales++;
                    bProf += Number(i.totalProfit || 0);
                }
            });
            sparkRevenuePts.push(bRev);
            sparkSalesPts.push(bSales);
            sparkProfitPts.push(bProf);
        }

        const sparkProductPts = [20, 22, 21, 26, 25, 29, 34];
        const sparkCustomerPts = [15, 18, 16, 22, 20, 25, 28];
        const sparkMarginPts = [52, 54, 53, 56, 55, 57, 58];
        const sparkValuationPts = [18, 20, 19, 23, 25, 27, 30];
        const sparkBusinessPts = [4, 4, 5, 5, 6, 6, 7];
        const sparkRatioPts = [10, 12, 14, 15, 18, 22, 25];

        // Sales Growth metrics
        const aov = currentSalesCount > 0 ? (currentRevenue / currentSalesCount) : 0;
        let topCatName = 'Electronics';
        let topCatRev = 0;
        const catRevMap = {};
        filteredInvoices.forEach(inv => {
            if (inv.items && Array.isArray(inv.items)) {
                inv.items.forEach(it => {
                    const cat = it.category || 'General';
                    catRevMap[cat] = (catRevMap[cat] || 0) + (Number(it.totalPrice) || 0);
                });
            }
        });
        for (const [c, r] of Object.entries(catRevMap)) {
            if (r > topCatRev) {
                topCatRev = r;
                topCatName = c;
            }
        }
        const matchedCat = cachedCategories.find(c => c.id === topCatName || c.uniqueId === topCatName);
        if (matchedCat) topCatName = matchedCat.name;

        // Top Entities Preparations (Max 20 Items each)
        // 1. Top Products
        const sortedProducts = Object.values(productSalesAgg)
            .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
            .slice(0, 20);

        const displayProducts = [...sortedProducts];
        if (displayProducts.length < 20 && cachedProducts.length > 0) {
            cachedProducts.forEach(cp => {
                if (displayProducts.length < 20 && !displayProducts.some(p => p.id === cp.id || p.name === cp.name)) {
                    displayProducts.push({
                        id: cp.id,
                        name: cp.name,
                        category: cp.category || 'General',
                        units: 0,
                        revenue: Number(cp.salePrice || cp.price || 0),
                        profit: 0
                    });
                }
            });
        }

        // Helper to extract image from any business/customer/product entity
        const getEntityImage = (item) => {
            if (!item) return '';
            return item.imageUrl || item.imageUri || item.logoUrl || item.photoUrl || item.logo || item.avatar || '';
        };

        // 2. Top Businesses
        const businessSalesMap = new Map();
        filteredInvoices.forEach(inv => {
            const bId = inv.businessId || inv.issuerBusinessId || inv.businessName;
            if (bId) {
                const cur = businessSalesMap.get(bId) || { id: bId, name: inv.businessName || '', count: 0, revenue: 0 };
                cur.count++;
                cur.revenue += Number(inv.totalPrice || inv.grandTotal || 0);
                if (!cur.name && inv.businessName) cur.name = inv.businessName;
                businessSalesMap.set(bId, cur);
            }
        });

        const topBusinesses = Array.from(businessSalesMap.values()).map(bData => {
            const matched = cachedBusinesses.find(b => {
                if (!b) return false;
                if (b.id === bData.id || b.uniqueId === bData.id) return true;
                const bName = (b.name || b.businessName || '').trim().toLowerCase();
                const targetId = String(bData.id).trim().toLowerCase();
                const targetName = String(bData.name || '').trim().toLowerCase();
                return (bName && targetId && (bName === targetId || bName.includes(targetId) || targetId.includes(bName))) ||
                       (bName && targetName && (bName === targetName || bName.includes(targetName) || targetName.includes(bName)));
            });
            const img = getEntityImage(matched);
            return {
                id: matched?.id || bData.id,
                name: matched?.name || matched?.businessName || bData.name || 'Business Entity',
                imageUrl: img,
                invoicesCount: bData.count,
                revenue: bData.revenue
            };
        }).sort((a, b) => b.revenue - a.revenue).slice(0, 20);

        if (topBusinesses.length < 20 && cachedBusinesses.length > 0) {
            cachedBusinesses.forEach(cb => {
                if (topBusinesses.length < 20 && !topBusinesses.some(tb => tb.id === cb.id || tb.name === cb.name)) {
                    topBusinesses.push({
                        id: cb.id,
                        name: cb.name || cb.businessName || 'Business Partner',
                        imageUrl: getEntityImage(cb),
                        invoicesCount: 0,
                        revenue: 0
                    });
                }
            });
        }

        // 3. Top Customers
        const topCustomers = Array.from(customerSalesMap.entries()).map(([cId, rev]) => {
            const matched = cachedCustomers.find(c => {
                if (!c) return false;
                if (c.id === cId || c.uniqueId === cId) return true;
                const cName = (c.name || '').trim().toLowerCase();
                const target = String(cId).trim().toLowerCase();
                return cName && target && (cName === target || cName.includes(target) || target.includes(cName));
            });
            const orderCount = filteredInvoices.filter(i => (i.customerId === cId || i.recipientId === cId || i.customerName === cId)).length;
            const img = getEntityImage(matched);
            return {
                id: matched?.id || cId,
                name: matched?.name || cId,
                imageUrl: img,
                ordersCount: orderCount || 1,
                totalSpent: rev
            };
        }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);

        if (topCustomers.length < 20 && cachedCustomers.length > 0) {
            cachedCustomers.forEach(cc => {
                if (topCustomers.length < 20 && !topCustomers.some(tc => tc.id === cc.id || tc.name === cc.name)) {
                    topCustomers.push({
                        id: cc.id,
                        name: cc.name,
                        imageUrl: getEntityImage(cc),
                        ordersCount: 0,
                        totalSpent: 0
                    });
                }
            });
        }

        // 4. Top Invoices
        const topInvoices = [...filteredInvoices]
            .sort((a, b) => Number(b.totalPrice || b.grandTotal || b.total || 0) - Number(a.totalPrice || a.grandTotal || a.total || 0))
            .slice(0, 20);

        // 5. Recent Activities (Max 20 Items)
        const activityStream = [];
        [...allInvoices]
            .sort((a, b) => getInvoiceTime(b) - getInvoiceTime(a))
            .slice(0, 10)
            .forEach(inv => {
                const isPaid = (inv.status || '').toLowerCase() === 'paid';
                activityStream.push({
                    type: 'order',
                    color: isPaid ? '#16A34A' : '#2563EB',
                    title: isPaid ? 'Invoice settled & paid' : 'New invoice order received',
                    subtitle: `Order #${inv.busInvNumber || inv.invoiceNumber || inv.uniqueId || 'INV'} · ${formatCurr(inv.totalPrice || inv.grandTotal || 0)}`,
                    time: getRelativeTime(getInvoiceTime(inv)),
                    ts: getInvoiceTime(inv)
                });
            });

        [...cachedProducts]
            .sort((a, b) => (b.updatedAt || b.timestamp || 0) - (a.updatedAt || a.timestamp || 0))
            .slice(0, 6)
            .forEach(p => {
                activityStream.push({
                    type: 'product',
                    color: '#7C3AED',
                    title: 'Product catalog updated',
                    subtitle: p.name || 'Catalog Item',
                    time: getRelativeTime(p.updatedAt || p.timestamp),
                    ts: p.updatedAt || p.timestamp || 0
                });
            });

        cachedProducts.filter(p => Number(p.quantity || 0) <= Number(p.minStockThreshold || 5)).slice(0, 5).forEach(p => {
            const isOut = Number(p.quantity || 0) <= 0;
            activityStream.push({
                type: 'stock',
                color: isOut ? '#DC2626' : '#F59E0B',
                title: isOut ? 'Critical out of stock alert' : 'Low inventory warning',
                subtitle: `${p.name} (${p.quantity || 0} remaining)`,
                time: 'Recent',
                ts: Date.now() - 3600000
            });
        });

        activityStream.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const finalActivities = activityStream.slice(0, 20);

        // Render Master HTML
        root.innerHTML = `
            <style>
                .quantum-dash-wrap {
                    max-width: 1480px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    padding-bottom: 2.5rem;
                }
                .quantum-card {
                    background: var(--bg-card, #ffffff);
                    border: 1px solid var(--border-color, #E4E4E7);
                    border-radius: 16px;
                    padding: 1.15rem 1.35rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                    position: relative;
                }
                .quantum-card:hover {
                    box-shadow: 0 4px 14px rgba(0,0,0,0.04);
                }
                .quantum-toolbar-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.45rem 0.85rem;
                    background: var(--bg-card, #ffffff);
                    border: 1px solid var(--border-color, #E4E4E7);
                    border-radius: 9px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--text-primary, #18181B);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .quantum-toolbar-btn:hover {
                    background: var(--surface-100, #F4F4F5);
                    border-color: #A1A1AA;
                }
                .quantum-icon-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 34px;
                    height: 34px;
                    background: var(--bg-card, #ffffff);
                    border: 1px solid var(--border-color, #E4E4E7);
                    border-radius: 9px;
                    color: var(--text-primary, #18181B);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .quantum-icon-btn:hover {
                    background: var(--surface-100, #F4F4F5);
                    border-color: #A1A1AA;
                }
                .quantum-dropdown-menu {
                    background: var(--bg-card, #ffffff);
                    border: 1px solid var(--border-color, #E4E4E7);
                    border-radius: 12px;
                    box-shadow: 0 10px 28px -4px rgba(0,0,0,0.14);
                    padding: 0.35rem;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .quantum-dropdown-item {
                    width: 100%;
                    text-align: left;
                    padding: 0.45rem 0.75rem;
                    border: none;
                    background: none;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--text-primary, #18181B);
                    border-radius: 7px;
                    cursor: pointer;
                    transition: background 0.12s ease;
                }
                .quantum-dropdown-item:hover, .quantum-dropdown-item.active {
                    background: var(--surface-100, #F4F4F5);
                    color: var(--text-primary, #18181B);
                }
                .quantum-pill-btn {
                    padding: 0.25rem 0.65rem;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: none;
                    font-size: 0.76rem;
                    font-weight: 700;
                    color: var(--text-muted, #71717A);
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .quantum-pill-btn:hover {
                    color: var(--text-primary, #18181B);
                }
                .quantum-pill-btn.active {
                    background: var(--text-primary, #18181B);
                    color: var(--bg-card, #ffffff);
                }
                [data-color-mode="dark"] .quantum-pill-btn.active,
                [data-theme="dark"] .quantum-pill-btn.active {
                    background: #353535 !important;
                    color: #F0F0F0 !important;
                    border-color: #505050 !important;
                }
                @keyframes quantumSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .quantum-spinning svg {
                    animation: quantumSpin 0.7s linear infinite !important;
                }

                /* =========================================================================
                   QUANTUM 3-SECOND SMOOTH KINETIC LINE ANIMATION
                   0> animate | 0.5s gentle soft start | 0.5s-2.9s continuous fast sweep | 2.9s-3.0s smooth settle
                   ========================================================================= */
                .quantum-sparkline-svg {
                    overflow: visible !important;
                }
                .quantum-spark-line {
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 1000;
                    animation: quantumDrawLine 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
                    will-change: stroke-dashoffset, opacity;
                }
                .quantum-spark-area {
                    opacity: 0;
                    animation: quantumDrawArea 3s ease forwards;
                    will-change: opacity;
                }
                .quantum-card:hover .quantum-spark-line {
                    stroke-width: 2.7px;
                    transition: stroke-width 0.25s ease;
                }
                #q-chart-data-dots circle {
                    opacity: 0;
                    animation: quantumDotsBloom 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes quantumDrawLine {
                    0% {
                        stroke-dashoffset: 1000;
                        opacity: 0.15;
                    }
                    16.7% { /* 0.5s: smooth soft start (no hard pause) */
                        stroke-dashoffset: 940;
                        opacity: 0.45;
                    }
                    96.7% { /* 2.9s: continuous fast sweep through the curves */
                        stroke-dashoffset: 20;
                        opacity: 0.98;
                    }
                    100% { /* 3.0s: seamless final finish and rest */
                        stroke-dashoffset: 0;
                        opacity: 1;
                    }
                }

                @keyframes quantumDrawArea {
                    0% {
                        opacity: 0;
                    }
                    16.7% { /* 0.5s */
                        opacity: 0.08;
                    }
                    96.7% { /* 2.9s */
                        opacity: 0.92;
                    }
                    100% { /* 3.0s */
                        opacity: 1;
                    }
                }

                @keyframes quantumDotsBloom {
                    0%, 75% {
                        opacity: 0;
                        transform: scale(0.3);
                    }
                    92% {
                        opacity: 0.85;
                        transform: scale(1.15);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                .q-counter-val {
                    display: inline-block;
                    font-variant-numeric: tabular-nums;
                }
                .quantum-dots-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted, #71717A);
                    cursor: pointer;
                    font-size: 1.1rem;
                    padding: 0 4px;
                    line-height: 1;
                    border-radius: 4px;
                    transition: color 0.15s ease;
                }
                .quantum-dots-btn:hover {
                    color: var(--text-primary, #18181B);
                }
                .quantum-kpi-grid-6 {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 1rem;
                }
                .quantum-row-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.45rem;
                }
                .quantum-row-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.1rem 0.25rem;
                    user-select: none;
                    cursor: pointer;
                }
                .quantum-row-title {
                    font-size: 0.92rem;
                    font-weight: 800;
                    color: var(--text-primary, #18181B);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .quantum-row-badge {
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 6px;
                    background: var(--surface-100, #F4F4F5);
                    color: var(--text-muted, #71717A);
                    border: 1px solid var(--border-color, #E4E4E7);
                }
                .quantum-chevron-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 7px;
                    background: var(--bg-card, #ffffff);
                    border: 1px solid var(--border-color, #E4E4E7);
                    color: var(--text-secondary, #71717A);
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .quantum-chevron-btn:hover {
                    background: var(--surface-100, #F4F4F5);
                    color: var(--text-primary);
                }
                .quantum-chevron-btn svg {
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .quantum-chevron-btn.folded svg {
                    transform: rotate(-90deg);
                }
                .quantum-collapsible-grid {
                    transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, margin 0.25s ease;
                    max-height: 1400px;
                    opacity: 1;
                    overflow: visible;
                }
                .quantum-collapsible-grid.folded {
                    max-height: 0 !important;
                    opacity: 0 !important;
                    margin-top: 0 !important;
                    margin-bottom: 0 !important;
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                }
                .quantum-scroll-list {
                    max-height: 410px;
                    overflow-y: auto;
                    padding-right: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 0.65rem;
                }
                .quantum-scroll-list::-webkit-scrollbar {
                    width: 5px;
                }
                .quantum-scroll-list::-webkit-scrollbar-track {
                    background: transparent;
                }
                .quantum-scroll-list::-webkit-scrollbar-thumb {
                    background: var(--border-color, #E4E4E7);
                    border-radius: 4px;
                }
                .quantum-scroll-list::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted, #71717A);
                }
                .quantum-action-btn-sm {
                    padding: 0.25rem 0.55rem;
                    border-radius: 6px;
                    font-size: 0.74rem;
                    font-weight: 700;
                    background: var(--surface-100, #F4F4F5);
                    color: var(--text-primary, #18181B);
                    border: 1px solid var(--border-color, #E4E4E7);
                    cursor: pointer;
                    transition: all 0.12s ease;
                    white-space: nowrap;
                }
                .quantum-action-btn-sm:hover {
                    background: var(--text-primary, #18181B);
                    color: var(--bg-card, #ffffff);
                }
                .quantum-modal-overlay {
                    position: fixed !important;
                    inset: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: rgba(0, 0, 0, 0.55) !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-backdrop-filter: blur(8px) !important;
                    z-index: 999999 !important;
                    display: none;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: 1.25rem !important;
                }
                .quantum-modal-overlay.active {
                    display: flex !important;
                    animation: quantumFadeIn 0.2s ease-out;
                }
                .quantum-modal-box {
                    background: var(--bg-card, #ffffff) !important;
                    border: 1px solid var(--border-color, #E4E4E7) !important;
                    border-radius: 18px !important;
                    padding: 1.75rem !important;
                    width: 92% !important;
                    max-width: 450px !important;
                    box-shadow: 0 25px 65px -12px rgba(0, 0, 0, 0.35) !important;
                    position: relative !important;
                    animation: quantumZoomIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes quantumFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes quantumZoomIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @media (max-width: 1400px) {
                    .quantum-kpi-grid-6 {
                        grid-template-columns: repeat(3, 1fr) !important;
                    }
                }
                @media (max-width: 900px) {
                    .quantum-kpi-grid-6 {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                    .quantum-charts-row {
                        flex-direction: column !important;
                    }
                    .quantum-secondary-row, .quantum-tertiary-row {
                        grid-template-columns: 1fr !important;
                    }
                }
                @media (max-width: 600px) {
                    .quantum-kpi-grid-6 {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>

            <!-- MASTER ANALYTICS HEADER ROW -->
            <div class="dash-header-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:0.15rem;">
                <div class="dash-title-group">
                    <div style="display:flex; align-items:center; gap:0.65rem;">
                        <span style="display:flex; align-items:center; justify-content:center; color:var(--text-primary);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                        </span>
                        <h1 class="dash-title" style="margin:0; font-size:1.65rem; font-weight:800; letter-spacing:-0.02em; color:var(--text-primary); line-height:1.2;">Analytics Expert Dashboard</h1>
                    </div>
                    <p class="dash-subtitle" style="margin:0.25rem 0 0 0; color:var(--text-secondary); font-size:0.86rem; font-weight:500;">
                        Track your business performance and get actionable insights.
                    </p>
                </div>

                <!-- Top Right Controls Toolbar -->
                <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                    <!-- Date Range Filter -->
                    <div class="quantum-dropdown-wrap" style="position:relative;">
                        <button id="dash-date-btn" class="quantum-toolbar-btn" type="button" aria-expanded="false" title="Select Date Range">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span id="dash-date-label">${currentRange.label}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div id="dash-date-menu" class="quantum-dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 6px); z-index:100; min-width:185px;">
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === '30D' ? 'active' : ''}" data-range="30D">Last 30 Days</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === '7D' ? 'active' : ''}" data-range="7D">Last 7 Days</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'TODAY' ? 'active' : ''}" data-range="TODAY">Today</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'YESTERDAY' ? 'active' : ''}" data-range="YESTERDAY">Yesterday</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'THIS_MONTH' ? 'active' : ''}" data-range="THIS_MONTH">This Month</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'LAST_MONTH' ? 'active' : ''}" data-range="LAST_MONTH">Last Month</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === '90D' ? 'active' : ''}" data-range="90D">Last 90 Days</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'THIS_YEAR' ? 'active' : ''}" data-range="THIS_YEAR">This Year</button>
                            <button type="button" class="quantum-dropdown-item ${activeFilterKey === 'ALL_TIME' ? 'active' : ''}" data-range="ALL_TIME">All Time</button>
                            <div style="height:1px; background:var(--border-color); margin:3px 0;"></div>
                            <button type="button" class="quantum-dropdown-item" id="dash-date-open-custom" style="color:var(--text-primary); font-weight:700;">+ Custom Range...</button>
                        </div>
                    </div>

                    <!-- Explicit Custom Date Option Button -->
                    <button id="dash-custom-date-trigger-btn" class="quantum-toolbar-btn" type="button" title="Select specific start and end date" style="border-color:#16A34A; color:#16A34A;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>Add custom date</span>
                    </button>

                    <!-- Comparison Filter -->
                    <div class="quantum-dropdown-wrap" style="position:relative;">
                        <button id="dash-compare-btn" class="quantum-toolbar-btn" type="button" aria-expanded="false" title="Compare against previous periods">
                            <span>Compare</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div id="dash-compare-menu" class="quantum-dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 6px); z-index:100; min-width:170px;">
                            <button type="button" class="quantum-dropdown-item ${activeCompareMode === 'PREVIOUS_PERIOD' ? 'active' : ''}" data-compare="PREVIOUS_PERIOD">vs Previous Period</button>
                            <button type="button" class="quantum-dropdown-item ${activeCompareMode === 'PREVIOUS_MONTH' ? 'active' : ''}" data-compare="PREVIOUS_MONTH">vs Previous Month</button>
                            <button type="button" class="quantum-dropdown-item ${activeCompareMode === 'PREVIOUS_YEAR' ? 'active' : ''}" data-compare="PREVIOUS_YEAR">vs Previous Year</button>
                            <button type="button" class="quantum-dropdown-item ${activeCompareMode === 'NONE' ? 'active' : ''}" data-compare="NONE">No Comparison</button>
                        </div>
                    </div>

                    <!-- Export Dropdown -->
                    <div class="quantum-dropdown-wrap" style="position:relative;">
                        <button id="dash-export-btn" class="quantum-toolbar-btn" type="button" aria-expanded="false" title="Export Analytics">
                            <span>Export</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div id="dash-export-menu" class="quantum-dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 6px); z-index:100; min-width:160px;">
                            <button type="button" class="quantum-dropdown-item" id="btn-export-csv">Export CSV Report</button>
                            <button type="button" class="quantum-dropdown-item" id="btn-export-json">Export JSON Data</button>
                            <button type="button" class="quantum-dropdown-item" id="btn-export-print">Print / PDF</button>
                        </div>
                    </div>

                    <!-- Fullscreen Presentation Mode -->
                    <button id="dash-fullscreen-btn" class="quantum-icon-btn" type="button" title="Toggle Fullscreen Mode">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                    </button>

                    <!-- Refresh Action -->
                    <button id="dash-refresh-btn" class="quantum-icon-btn" type="button" title="Refresh Live Analytics">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    </button>
                </div>
            </div>

            <!-- ROW 1: CORE FINANCIAL METRICS (COLLAPSIBLE) -->
            <div class="quantum-row-section" id="section-row-1">
                <div class="quantum-row-header" data-toggle="row1">
                    <div class="quantum-row-title">
                        <span>Core Financial Metrics</span>
                       
                    </div>
                    <button type="button" class="quantum-chevron-btn ${rowFoldStates.row1 ? 'folded' : ''}" aria-label="Toggle Row 1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="quantum-kpi-grid-6 quantum-collapsible-grid ${rowFoldStates.row1 ? 'folded' : ''}" id="content-row1">
                    <!-- 1. Total Products -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Total Products</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/products')}else{window.location.hash='#/products'}">···</button>
                        </div>
                        <div id="q-val-total-products" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(currentProductsCount)}</div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            <span style="color:#16A34A; font-weight:700;">↑ ${prodDiff.text}</span>
                            <span style="color:var(--text-muted); font-size:0.72rem;">${comparisonRange?.label || 'vs baseline'}</span>
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProductPts, '#16A34A', 'grad-r1-prod')}
                        </div>
                    </div>

                    <!-- 2. Total Revenue -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Total Revenue</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/invoices/customer')}else{window.location.hash='#/invoices/customer'}">···</button>
                        </div>
                        <div id="q-val-total-revenue" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatCurr(currentRevenue)}</div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            <span style="color:${revDiff.isPositive ? '#16A34A' : '#DC2626'}; font-weight:700;">${revDiff.isPositive ? '↑' : '↓'} ${revDiff.text}</span>
                            <span style="color:var(--text-muted); font-size:0.72rem;">${comparisonRange?.label || 'vs baseline'}</span>
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkRevenuePts, revDiff.isPositive ? '#16A34A' : '#DC2626', 'grad-r1-rev')}
                        </div>
                    </div>

                    <!-- 3. Total Sales -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Total Sales</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/invoices/customer')}else{window.location.hash='#/invoices/customer'}">···</button>
                        </div>
                        <div id="q-val-total-sales" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(currentSalesCount)}</div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            <span style="color:${salesDiff.isPositive ? '#16A34A' : '#DC2626'}; font-weight:700;">${salesDiff.isPositive ? '↑' : '↓'} ${salesDiff.text}</span>
                            <span style="color:var(--text-muted); font-size:0.72rem;">${comparisonRange?.label || 'vs baseline'}</span>
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkSalesPts, salesDiff.isPositive ? '#16A34A' : '#DC2626', 'grad-r1-sales')}
                        </div>
                    </div>

                    <!-- 4. Total Customers -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Total Customers</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/customers')}else{window.location.hash='#/customers'}">···</button>
                        </div>
                        <div id="q-val-total-customers" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(Math.max(currentActiveCustomers, cachedCustomers.length))}</div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            <span style="color:#7C3AED; font-weight:700;">${custDiff.isPositive ? '↑' : '↓'} ${custDiff.text}</span>
                            <span style="color:var(--text-muted); font-size:0.72rem;">${comparisonRange?.label || 'vs baseline'}</span>
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkCustomerPts, '#7C3AED', 'grad-r1-cust')}
                        </div>
                    </div>

                    <!-- 5. Gross Profit (Worker restriction guarded) -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:#2563EB;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Gross Profit</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics')}else{window.location.hash='#/analytics'}">···</button>
                        </div>
                        <div id="q-val-gross-profit" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${userRestrictions.cannotSeeProfit ? '••••' : formatCurr(currentProfit)}
                        </div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            ${userRestrictions.cannotSeeProfit 
                                ? `<span style="color:var(--text-muted); font-weight:600;">Restricted role</span>`
                                : `<span style="color:#2563EB; font-weight:700;">${profitDiff.isPositive ? '↑' : '↓'} ${profitDiff.text}</span>
                                   <span style="color:var(--text-muted); font-size:0.72rem;">${comparisonRange?.label || 'vs baseline'}</span>`}
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProfitPts, '#2563EB', 'grad-r1-prof')}
                        </div>
                    </div>

                    <!-- 6. % Profit Margin (Worker restriction guarded) -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 14.14 14.14"></path></svg></span>
                                <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">% Profit Margin</span>
                            </div>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/profit-calculator')}else{window.location.hash='#/profit-calculator'}">···</button>
                        </div>
                        <div id="q-val-profit-margin" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${userRestrictions.cannotSeeProfit ? '••••' : profitMarginPct + '%'}
                        </div>
                        <div style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; margin-bottom:0.4rem;">
                            ${userRestrictions.cannotSeeProfit
                                ? `<span style="color:var(--text-muted); font-weight:600;">Restricted role</span>`
                                : `<span style="color:#16A34A; font-weight:700;">↑ +1.2%</span>
                                   <span style="color:var(--text-muted); font-size:0.72rem;">vs previous period</span>`}
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkMarginPts, '#71717A', 'grad-r1-margin')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- ROW 2: OPERATIONS & VALUATION (COLLAPSIBLE) -->
            <div class="quantum-row-section" id="section-row-2">
                <div class="quantum-row-header" data-toggle="row2">
                    <div class="quantum-row-title">
                        <span>Operations & Valuation </span>
                    </div>
                    <button type="button" class="quantum-chevron-btn ${rowFoldStates.row2 ? 'folded' : ''}" aria-label="Toggle Row 2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="quantum-kpi-grid-6 quantum-collapsible-grid ${rowFoldStates.row2 ? 'folded' : ''}" id="content-row2">
                    <!-- 1. Orders & Invoices -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Orders & Invoices</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/invoices')}else{window.location.hash='#/invoices'}">···</button>
                        </div>
                        <div id="q-val-orders-invoices" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(allInvoices.length)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${cachedCustInvoices.length} Cust · ${cachedBusInvoices.length} Bus
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkSalesPts, '#2563EB', 'grad-r2-ord')}
                        </div>
                    </div>

                    <!-- 2. Stock Asset Valuation -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Stock Asset Valuation</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/products')}else{window.location.hash='#/products'}">···</button>
                        </div>
                        <div id="q-val-stock-valuation" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatCurr(totalValuation)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${formatNum(totalStockUnits)} Units In Inventory
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkValuationPts, '#16A34A', 'grad-r2-val')}
                        </div>
                    </div>

                    <!-- 3. Total Business -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Total Business</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/businesses')}else{window.location.hash='#/businesses'}">···</button>
                        </div>
                        <div id="q-val-total-business" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(cachedBusinesses.length)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            Registered Profiles
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkBusinessPts, '#7C3AED', 'grad-r2-bus')}
                        </div>
                    </div>

                    <!-- 4. Barcode Generated -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Barcode Generated</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/barcode-generator')}else{window.location.hash='#/barcode-generator'}">···</button>
                        </div>
                        <div id="q-val-barcode-count" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">${formatNum(barcodeCount)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${Math.round((barcodeCount / (cachedProducts.length || 1)) * 100)}% Catalog Tagged
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProductPts, '#2563EB', 'grad-r2-bar')}
                        </div>
                    </div>

                    <!-- 5. Net Gross Profit -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Net Gross Profit</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/finance-tracker')}else{window.location.hash='#/finance-tracker'}">···</button>
                        </div>
                        <div id="q-val-net-profit" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${userRestrictions.cannotSeeProfit ? '••••' : formatCurr(currentNetProfit)}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${userRestrictions.cannotSeeProfit ? 'Restricted' : 'After deductions & cuts'}
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProfitPts, '#2563EB', 'grad-r2-net')}
                        </div>
                    </div>

                    <!-- 6. Cost / Profit Margin -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Cost / Profit Margin</span>
                            <button type="button" class="quantum-dots-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/profit-calculator')}else{window.location.hash='#/profit-calculator'}">···</button>
                        </div>
                        <div id="q-val-cost-split" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${userRestrictions.cannotSeeCost ? '••%' : Math.round((currentCOGS / (currentRevenue || 1)) * 100) + '%'} / ${userRestrictions.cannotSeeProfit ? '••%' : Math.round(profitMarginPct) + '%'}
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            Cost vs Profit split
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkMarginPts, '#71717A', 'grad-r2-split')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- ROW 3: TRADING & INVENTORY RATIOS (COLLAPSIBLE) -->
            <div class="quantum-row-section" id="section-row-3">
                <div class="quantum-row-header" data-toggle="row3">
                    <div class="quantum-row-title">
                        <span>Trading & Inventory Ratios <span>
                    </div>
                    <button type="button" class="quantum-chevron-btn ${rowFoldStates.row3 ? 'folded' : ''}" aria-label="Toggle Row 3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>
                <div class="quantum-kpi-grid-6 quantum-collapsible-grid ${rowFoldStates.row3 ? 'folded' : ''}" id="content-row3">
                    <!-- 1. Buy vs Sale -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Buy vs Sale</span>
                        <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.2; word-break:break-all;">
                            <span id="q-val-cogs" class="q-counter-val">${userRestrictions.cannotSeeCost ? '••••' : formatCurr(currentCOGS)}</span><br><span style="font-size:0.9rem; color:var(--text-muted); font-weight:600;">vs</span> <span id="q-val-rev-r3" class="q-counter-val">${formatCurr(currentRevenue)}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            COGS to Revenue Ratio
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkRatioPts, '#16A34A', 'grad-r3-buysale')}
                        </div>
                    </div>

                    <!-- 2. Stock vs Sale -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Stock vs Sale</span>
                        <div style="font-size:1.65rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            <span id="q-val-stock-units" class="q-counter-val">${formatNum(totalStockUnits)}</span> / <span id="q-val-sold-units" class="q-counter-val">${formatNum(totalUnitsSold)}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${totalStockUnits > 0 ? ((totalUnitsSold / totalStockUnits) * 100).toFixed(1) : 0}% Turnover rate
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkValuationPts, '#2563EB', 'grad-r3-stocksale')}
                        </div>
                    </div>

                    <!-- 3. Sale vs Profit -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Sale vs Profit</span>
                        <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin:0.45rem 0 0.15rem 0; line-height:1.2; word-break:break-all;">
                            <span id="q-val-rev-r3b" class="q-counter-val">${formatCurr(currentRevenue)}</span><br><span style="font-size:0.9rem; color:var(--text-muted); font-weight:600;">vs</span> <span id="q-val-prof-r3" class="q-counter-val">${userRestrictions.cannotSeeProfit ? '••••' : formatCurr(currentProfit)}</span>
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${userRestrictions.cannotSeeProfit ? 'Restricted' : `${profitMarginPct}% Return On Sales`}
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProfitPts, '#16A34A', 'grad-r3-saleprof')}
                        </div>
                    </div>

                    <!-- 4. Low Stock Items (with Interactive Filter) -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Low Stock Items</span>
                            <select id="q-low-stock-select" style="background:var(--surface-100); border:1px solid var(--border-color); border-radius:5px; font-size:0.72rem; font-weight:700; color:var(--text-primary); padding:1px 4px; cursor:pointer;" title="Filter items below threshold">
                                <option value="5" ${lowStockThreshold === 5 ? 'selected' : ''}>&lt; 5</option>
                                <option value="10" ${lowStockThreshold === 10 ? 'selected' : ''}>&lt; 10</option>
                                <option value="20" ${lowStockThreshold === 20 ? 'selected' : ''}>&lt; 20</option>
                                <option value="50" ${lowStockThreshold === 50 ? 'selected' : ''}>&lt; 50</option>
                                <option value="100" ${lowStockThreshold === 100 ? 'selected' : ''}>&lt; 100</option>
                            </select>
                        </div>
                        <div id="q-val-low-stock-count" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:#DC2626; margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${lowStockItemsCount} Items
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            Units &le; ${lowStockThreshold} in catalog
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProductPts, '#DC2626', 'grad-r3-low')}
                        </div>
                    </div>

                    <!-- 5. Expired Items -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Expired Items</span>
                        <div id="q-val-expired-count" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:${expiredItemsCount > 0 ? '#DC2626' : '#16A34A'}; margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${expiredItemsCount} Items
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            ${expiredItemsCount > 0 ? 'Requires immediate action' : 'Zero expired inventory'}
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProductPts, expiredItemsCount > 0 ? '#DC2626' : '#16A34A', 'grad-r3-exp')}
                        </div>
                    </div>

                    <!-- 6. Unhealthy Items (*70-95% Health) -->
                    <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Unhealthy Items</span>
                        <div id="q-val-unhealthy-count" class="q-counter-val" style="font-size:1.75rem; font-weight:800; color:#F59E0B; margin:0.45rem 0 0.15rem 0; line-height:1.1;">
                            ${unhealthyItemsCount} Items
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:0.4rem;">
                            70-95% Health Score Alert
                        </div>
                        <div style="height:32px; margin-top:auto;">
                            ${generateSvgSparkline(sparkProductPts, '#F59E0B', 'grad-r3-unhealth')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- PRIMARY ANALYTICS ROW: REVENUE OVERVIEW + SALES ANALYTICS + SALES GROWTH -->
            <div style="display:flex; gap:1.25rem; align-items:stretch;" class="quantum-charts-row">
                <!-- 1. REVENUE OVERVIEW (Left) -->
                <div class="quantum-card" style="flex:1.75; min-width:320px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.75rem;">
                        <div>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg></span>
                                <h2 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-primary);">Revenue Overview</h2>
                            </div>
                            <p style="margin:0.2rem 0 0 0; font-size:0.82rem; color:var(--text-secondary);">Your revenue performance over time</p>
                        </div>

                        <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; background:var(--surface-100, #F4F4F5); padding:2px; border-radius:8px; border:1px solid var(--border-color, #E4E4E7);">
                                <button type="button" class="quantum-pill-btn ${activeChartPill === '7D' ? 'active' : ''}" data-pill="7D">7D</button>
                                <button type="button" class="quantum-pill-btn ${activeChartPill === '30D' ? 'active' : ''}" data-pill="30D">30D</button>
                                <button type="button" class="quantum-pill-btn ${activeChartPill === '90D' ? 'active' : ''}" data-pill="90D">90D</button>
                                <button type="button" class="quantum-pill-btn ${activeChartPill === '1Y' ? 'active' : ''}" data-pill="1Y">1Y</button>
                            </div>

                            <div style="display:flex; align-items:center; gap:0.75rem; font-size:0.78rem; font-weight:600;">
                                <span style="display:inline-flex; align-items:center; gap:4px; color:#16A34A;">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#16A34A;"></span> Revenue
                                </span>
                                <span style="display:inline-flex; align-items:center; gap:4px; color:#2563EB;">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#2563EB;"></span> Profit
                                </span>
                                <span style="display:inline-flex; align-items:center; gap:4px; color:#71717A;">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#71717A;"></span> Cost
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Interactive Multi-Series SVG Chart -->
                    <div id="quantum-sales-chart-wrap" style="position:relative; width:100%; height:250px; margin-top:0.4rem;">
                        <svg id="quantum-sales-svg" viewBox="0 0 680 240" preserveAspectRatio="none" style="width:100%; height:100%; display:block; overflow:visible;">
                            <defs>
                                <linearGradient id="qChartRevGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#16A34A" stop-opacity="0.18"/>
                                    <stop offset="100%" stop-color="#16A34A" stop-opacity="0.0"/>
                                </linearGradient>
                                <linearGradient id="qChartProfitGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#2563EB" stop-opacity="0.18"/>
                                    <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0"/>
                                </linearGradient>
                            </defs>

                            <!-- Horizontal Grid Lines -->
                            <g stroke="var(--border-color, #E4E4E7)" stroke-width="1.2" stroke-dasharray="4 4">
                                <line x1="55" y1="20" x2="660" y2="20" />
                                <line x1="55" y1="56" x2="660" y2="56" />
                                <line x1="55" y1="92" x2="660" y2="92" />
                                <line x1="55" y1="128" x2="660" y2="128" />
                                <line x1="55" y1="164" x2="660" y2="164" />
                                <line x1="55" y1="200" x2="660" y2="200" stroke-dasharray="0" stroke="var(--border-color, #E4E4E7)" />
                            </g>

                            <!-- Y-Axis Labels -->
                            <g fill="var(--text-muted, #71717A)" font-size="11" font-weight="600" text-anchor="end" id="q-chart-y-axis">
                                <text x="45" y="24" id="q-y-5">10L</text>
                                <text x="45" y="60" id="q-y-4">8L</text>
                                <text x="45" y="96" id="q-y-3">6L</text>
                                <text x="45" y="132" id="q-y-2">4L</text>
                                <text x="45" y="168" id="q-y-1">2L</text>
                                <text x="45" y="204">0</text>
                            </g>

                            <!-- Area and Line Paths -->
                            <path id="q-chart-revenue-area" class="quantum-spark-area" d="" fill="url(#qChartRevGrad)" />
                            <path id="q-chart-profit-area" class="quantum-spark-area" d="" fill="url(#qChartProfitGrad)" />
                            <path id="q-chart-revenue-line" class="quantum-spark-line" pathLength="1000" d="" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                            <path id="q-chart-profit-line" class="quantum-spark-line" pathLength="1000" d="" fill="none" stroke="#2563EB" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            <path id="q-chart-cost-line" class="quantum-spark-line" pathLength="1000" d="" fill="none" stroke="#71717A" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" />

                            <g id="q-chart-data-dots"></g>
                            <line id="q-chart-hover-line" x1="0" y1="20" x2="0" y2="200" stroke="var(--text-primary)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0" />
                            <g id="q-chart-x-labels" fill="var(--text-muted, #71717A)" font-size="11" font-weight="600" text-anchor="middle"></g>
                        </svg>

                        <!-- Floating Tooltip -->
                        <div id="q-chart-tooltip" style="display:none; position:absolute; transform:translate(-50%, -115%); background:var(--bg-card, #ffffff); backdrop-filter:blur(10px); color:var(--text-primary, #18181B); border:1px solid var(--border-color, #E4E4E7); padding:0.65rem 0.95rem; border-radius:10px; font-size:0.78rem; pointer-events:none; box-shadow:0 12px 28px rgba(0,0,0,0.12); z-index:50; min-width:160px;">
                            <div id="q-tooltip-date" style="font-weight:700; border-bottom:1px solid var(--border-color, #E4E4E7); padding-bottom:0.25rem; margin-bottom:0.35rem; color:var(--text-primary, #18181B);">Date</div>
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                                <span style="display:inline-flex; align-items:center; gap:4px; color:var(--text-muted, #71717A);">
                                    <span style="width:6px; height:6px; border-radius:50%; background:#16A34A;"></span> Revenue
                                </span>
                                <strong id="q-tooltip-rev" style="color:var(--text-primary, #18181B);">৳ 0</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                                <span style="display:inline-flex; align-items:center; gap:4px; color:var(--text-muted, #71717A);">
                                    <span style="width:6px; height:6px; border-radius:50%; background:#2563EB;"></span> Profit
                                </span>
                                <strong id="q-tooltip-profit" style="color:#2563EB;">৳ 0</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                                <span style="display:inline-flex; align-items:center; gap:4px; color:var(--text-muted, #71717A);">
                                    <span style="width:6px; height:6px; border-radius:50%; background:#71717A;"></span> Cost
                                </span>
                                <strong id="q-tooltip-cost" style="color:var(--text-secondary, #71717A);">৳ 0</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. SALES ANALYTICS (Center) -->
                <div class="quantum-card" style="flex:1.1; min-width:260px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.2rem;">
                            <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></span>
                            <h2 style="margin:0; font-size:1.15rem; font-weight:800; color:var(--text-primary);">Sales Analytics</h2>
                        </div>
                        <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Sales channels in period</p>
                    </div>

                    <div style="display:flex; align-items:center; justify-content:space-around; gap:1rem; margin:1rem 0;">
                        <div style="position:relative; width:135px; height:135px; flex-shrink:0;">
                            <svg viewBox="0 0 160 160" width="135" height="135">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="var(--surface-100, #F4F4F5)" stroke-width="18"/>
                                <g id="q-donut-segments"></g>
                            </svg>
                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                                <div id="q-donut-center-num" class="q-counter-val" style="font-size:1.45rem; font-weight:800; color:var(--text-primary); line-height:1;">${currentSalesCount}</div>
                                <div style="font-size:0.7rem; color:var(--text-muted); font-weight:700; margin-top:3px;">Total Sales</div>
                            </div>
                        </div>
                        <div id="q-donut-legend-list" style="flex:1; display:flex; flex-direction:column; gap:0.5rem;"></div>
                    </div>

                    <div style="padding-top:0.75rem; border-top:1px solid var(--border-color, #E4E4E7); display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:flex-end; gap:3px; height:22px;">
                            <span style="width:4px; height:10px; border-radius:2px; background:var(--text-muted);"></span>
                            <span style="width:4px; height:14px; border-radius:2px; background:var(--text-muted);"></span>
                            <span style="width:4px; height:18px; border-radius:2px; background:var(--text-muted);"></span>
                            <span style="width:4px; height:12px; border-radius:2px; background:var(--text-muted);"></span>
                            <span style="width:4px; height:20px; border-radius:2px; background:var(--text-primary);"></span>
                            <span style="width:4px; height:16px; border-radius:2px; background:var(--text-muted);"></span>
                            <span style="width:4px; height:22px; border-radius:2px; background:var(--text-primary);"></span>
                        </div>
                        <div style="font-size:0.8rem; font-weight:700; color:#16A34A;">
                            ↑ +12.8%
                        </div>
                    </div>
                </div>

                <!-- 3. SALES GROWTH WIDGET (Right) -->
                <div class="quantum-card" style="flex:0.95; min-width:240px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.9rem; font-weight:800; color:var(--text-primary);">Sales Growth</span>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics')}else{window.location.hash='#/analytics'}" style="padding:0; font-size:0.76rem; color:var(--text-primary); font-weight:700;">View Details &rarr;</button>
                        </div>
                        <div style="font-size:1.95rem; font-weight:800; color:#16A34A; margin:0.6rem 0 0.15rem 0; line-height:1;">
                            +12.8% &nearr;
                        </div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">vs previous period</div>
                    </div>

                    <div style="margin:0.75rem 0;">
                        ${generateSvgSparkline([20, 24, 22, 28, 30, 32, 38], '#16A34A', 'grad-sales-growth')}
                    </div>

                    <div style="padding-top:0.75rem; border-top:1px solid var(--border-color, #E4E4E7); display:flex; flex-direction:column; gap:0.45rem; font-size:0.78rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:var(--text-secondary);">Average Order Value</span>
                            <strong id="q-growth-aov" class="q-counter-val" style="color:var(--text-primary);">${formatCurr(aov)}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:var(--text-secondary);">Top Category</span>
                            <strong style="color:var(--text-primary);">${topCatName}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECONDARY ANALYTICS ROW: TOP PRODUCTS + INVENTORY STATUS + RECENT ACTIVITIES -->
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1.25rem;" class="quantum-secondary-row">
                <!-- 1. TOP PERFORMING PRODUCTS (Max 20 Items) -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Top Performing Products</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics/HIGH_VALUE_PRODUCTS')}else{window.location.hash='#/analytics/HIGH_VALUE_PRODUCTS'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View All &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Best selling products in this period (Max 20)</p>
                    </div>

                    <div class="quantum-scroll-list" id="q-top-products-list" style="flex:1;">
                        ${displayProducts.length === 0 ? `
                            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No product sales recorded in this period.</div>
                        ` : displayProducts.map((p, idx) => {
                            const matchedProd = cachedProducts.find(cp => cp.id === p.id || cp.name === p.name);
                            const imgUrl = matchedProd?.imageUrl || matchedProd?.imageUri || '';
                            const sharePct = currentRevenue > 0 ? ((p.revenue / currentRevenue) * 100).toFixed(1) : '0.0';
                            const avatarHtml = imgUrl 
                                ? `<img src="${imgUrl}" alt="${p.name}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0;">`
                                : `<div style="width:34px; height:34px; border-radius:50%; background:var(--surface-100); color:var(--text-primary); font-weight:700; font-size:0.75rem; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color); flex-shrink:0;">${p.name.substring(0, 2).toUpperCase()}</div>`;

                            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.65rem; font-size:0.8rem; padding:0.35rem 0.2rem; border-bottom:1px solid var(--border-color);">
                                    <div style="display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0;">
                                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted); width:14px; text-align:center;">${idx + 1}</span>
                                        ${avatarHtml}
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                                            <div style="font-size:0.72rem; color:var(--text-muted);">${p.units || 0} units sold</div>
                                        </div>
                                    </div>
                                    <div style="text-align:right; flex-shrink:0;">
                                        <div style="font-weight:800; color:var(--text-primary);">${formatCurr(p.revenue)}</div>
                                        <div style="font-size:0.72rem; color:#16A34A; font-weight:700;">${sharePct}% share</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 2. INVENTORY STATUS -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Inventory Status</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/products')}else{window.location.hash='#/products'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View Details &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Stock overview and alerts</p>
                    </div>

                    <div style="display:flex; align-items:center; justify-content:space-around; gap:1.2rem; flex:1; margin:0.85rem 0;">
                        <!-- Circular Gauge -->
                        <div style="position:relative; width:125px; height:125px; flex-shrink:0;">
                            <svg viewBox="0 0 120 120" width="125" height="125">
                                <circle cx="60" cy="60" r="46" fill="none" stroke="var(--surface-100)" stroke-width="12"/>
                                <circle cx="60" cy="60" r="46" fill="none" stroke="#16A34A" stroke-width="12"
                                    id="q-inventory-gauge-circle"
                                    stroke-dasharray="0 289"
                                    stroke-dashoffset="0"
                                    transform="rotate(-90 60 60)"
                                    style="transition: stroke-dasharray 0.7s cubic-bezier(0.16, 1, 0.3, 1);"
                                />
                            </svg>
                            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                                <div id="q-gauge-pct" class="q-counter-val" style="font-size:1.45rem; font-weight:800; color:var(--text-primary); line-height:1;">${totalStockUnits > 0 ? 87 : 100}%</div>
                                <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; margin-top:2px;">In Stock</div>
                            </div>
                        </div>

                        <!-- Breakdown Stats -->
                        <div style="display:flex; flex-direction:column; gap:0.65rem; font-size:0.8rem; flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="display:inline-flex; align-items:center; gap:5px; color:var(--text-secondary);">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#16A34A;"></span> In Stock
                                </span>
                                <strong style="color:var(--text-primary);">${formatNum(totalStockUnits)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="display:inline-flex; align-items:center; gap:5px; color:var(--text-secondary);">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#F59E0B;"></span> Low Stock
                                </span>
                                <strong style="color:#F59E0B;">${lowStockItemsCount}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="display:inline-flex; align-items:center; gap:5px; color:var(--text-secondary);">
                                    <span style="width:7px; height:7px; border-radius:50%; background:#DC2626;"></span> Out of Stock
                                </span>
                                <strong style="color:#DC2626;">${cachedProducts.filter(p => Number(p.quantity || 0) <= 0).length}</strong>
                            </div>
                        </div>
                    </div>

                    <div style="padding-top:0.75rem; border-top:1px solid var(--border-color, #E4E4E7); text-align:center;">
                        <span style="display:inline-flex; align-items:center; gap:6px; padding:0.3rem 0.85rem; border-radius:20px; background:#DCFCE7; color:#15803D; font-size:0.78rem; font-weight:700;">
                            ● Inventory is healthy
                        </span>
                    </div>
                </div>

                <!-- 3. RECENT ACTIVITIES (Max 20 Items -> Transferred to Notification Center) -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Recent Activities</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/notifications-center')}else{window.location.hash='#/notifications-center'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View Details &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Latest activities in your workspace (Max 20)</p>
                    </div>

                    <div class="quantum-scroll-list" id="q-recent-activities-list" style="flex:1;">
                        <div style="position:relative; display:flex; flex-direction:column; gap:0.95rem; padding-left:0.2rem;">
                            <div style="position:absolute; left:6px; top:8px; bottom:12px; width:2px; background:var(--border-color, #E4E4E7); z-index:0;"></div>
                            ${finalActivities.map(act => `
                                <div style="position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start; gap:0.65rem; font-size:0.8rem;">
                                    <div style="display:flex; align-items:flex-start; gap:0.65rem;">
                                        <span style="width:9px; height:9px; border-radius:50%; background:${act.color}; border:2px solid var(--bg-card, #ffffff); margin-top:3px; flex-shrink:0; box-shadow:0 0 0 1px ${act.color};"></span>
                                        <div>
                                            <div style="font-weight:700; color:var(--text-primary); line-height:1.2;">${act.title}</div>
                                            <div style="font-size:0.74rem; color:var(--text-muted); margin-top:2px;">${act.subtitle}</div>
                                        </div>
                                    </div>
                                    <span style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap; flex-shrink:0;">${act.time}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- DEDICATED TOP ENTITIES ROW: TOP BUSINESS + TOP CUSTOMER + TOP INVOICES (MAX 20 EACH) -->
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:1.25rem;" class="quantum-tertiary-row">
                <!-- 1. TOP BUSINESSES -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-3"></path></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Top Businesses</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics/HIGH_VALUE_BUSINESS')}else{window.location.hash='#/analytics/HIGH_VALUE_BUSINESS'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View All &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Highest billing commercial entities (Max 20)</p>
                    </div>

                    <div class="quantum-scroll-list" style="flex:1;">
                        ${topBusinesses.length === 0 ? `
                            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No registered businesses found.</div>
                        ` : topBusinesses.map((b, idx) => {
                            const bImg = b.imageUrl;
                            const bInitials = (b.name || 'B').trim().substring(0, 2).toUpperCase();
                            const bAvatarHtml = bImg ? `
                                <img src="${escapeHtml(bImg)}" alt="${escapeHtml(b.name)}" 
                                    style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0; background:var(--surface-100);" 
                                    onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\\'width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);\\\'>${bInitials}</div>';" />
                            ` : `
                                <div style="width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);">
                                    ${bInitials}
                                </div>
                            `;

                            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.6rem; font-size:0.8rem; padding:0.35rem 0.2rem; border-bottom:1px solid var(--border-color);">
                                    <div style="display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0;">
                                        <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); width:14px;">${idx + 1}</span>
                                        ${bAvatarHtml}
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(b.name)}</div>
                                            <div style="font-size:0.72rem; color:var(--text-muted);">${b.invoicesCount} Invoices</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
                                        <strong style="color:var(--text-primary); font-size:0.82rem;">${formatCurr(b.revenue)}</strong>
                                        <button type="button" class="quantum-action-btn-sm" data-view-business-id="${b.id}" data-view-business-name="${escapeHtml(b.name)}">View &rarr;</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 2. TOP CUSTOMERS -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Top Customers</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics/HIGH_VALUE_CLIENT')}else{window.location.hash='#/analytics/HIGH_VALUE_CLIENT'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View All &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Most valuable purchasing accounts (Max 20)</p>
                    </div>

                    <div class="quantum-scroll-list" style="flex:1;">
                        ${topCustomers.length === 0 ? `
                            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No customer records found.</div>
                        ` : topCustomers.map((c, idx) => {
                            const cImg = c.imageUrl;
                            const cInitials = (c.name || 'C').trim().substring(0, 2).toUpperCase();
                            const cAvatarHtml = cImg ? `
                                <img src="${escapeHtml(cImg)}" alt="${escapeHtml(c.name)}" 
                                    style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0; background:var(--surface-100);" 
                                    onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\\'width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);\\\'>${cInitials}</div>';" />
                            ` : `
                                <div style="width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.75rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);">
                                    ${cInitials}
                                </div>
                            `;

                            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.6rem; font-size:0.8rem; padding:0.35rem 0.2rem; border-bottom:1px solid var(--border-color);">
                                    <div style="display:flex; align-items:center; gap:0.6rem; flex:1; min-width:0;">
                                        <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); width:14px;">${idx + 1}</span>
                                        ${cAvatarHtml}
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
                                            <div style="font-size:0.72rem; color:var(--text-muted);">${c.ordersCount} Orders</div>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.5rem; flex-shrink:0;">
                                        <strong style="color:var(--text-primary); font-size:0.82rem;">${formatCurr(c.totalSpent)}</strong>
                                        <button type="button" class="quantum-action-btn-sm" data-view-customer-id="${c.id}" data-view-customer-name="${escapeHtml(c.name)}">View &rarr;</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 3. TOP INVOICES -->
                <div class="quantum-card" style="display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Top Invoices</h3>
                            </div>
                            <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics/HIGH_VALUE_INVOICE')}else{window.location.hash='#/analytics/HIGH_VALUE_INVOICE'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View All &rarr;</button>
                        </div>
                        <p style="margin:0 0 0.85rem 0; font-size:0.8rem; color:var(--text-secondary);">Highest valued transactions in period (Max 20)</p>
                    </div>

                    <div class="quantum-scroll-list" style="flex:1;">
                        ${topInvoices.length === 0 ? `
                            <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.84rem;">No invoice records in period.</div>
                        ` : topInvoices.map((inv, idx) => {
                            const isPaid = (inv.status || '').toLowerCase() === 'paid';
                            const invCust = cachedCustomers.find(c => {
                                if (!c) return false;
                                if (inv.customerId && (c.id === inv.customerId || c.uniqueId === inv.customerId)) return true;
                                const cName = (c.name || '').trim().toLowerCase();
                                const invName = (inv.customerName || '').trim().toLowerCase();
                                return cName && invName && (cName === invName || cName.includes(invName) || invName.includes(cName));
                            });
                            const invBus = cachedBusinesses.find(b => {
                                if (!b) return false;
                                if (inv.businessId && (b.id === inv.businessId || b.uniqueId === inv.businessId)) return true;
                                const bName = (b.name || b.businessName || '').trim().toLowerCase();
                                const invBName = (inv.businessName || '').trim().toLowerCase();
                                return bName && invBName && (bName === invBName || bName.includes(invBName) || invBName.includes(bName));
                            });
                            const invImg = inv.imageUrl || getEntityImage(invCust) || getEntityImage(invBus);
                            const invDisplayName = inv.customerName || inv.businessName || inv.clientName || 'Invoice';
                            const invInitials = (invDisplayName || 'IN').trim().substring(0, 2).toUpperCase();
                            const invAvatarHtml = invImg ? `
                                <img src="${escapeHtml(invImg)}" alt="${escapeHtml(invDisplayName)}" 
                                    style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0; background:var(--surface-100);" 
                                    onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\\'width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.72rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);\\\'>${invInitials}</div>';" />
                            ` : `
                                <div style="width:34px; height:34px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.72rem; border:1px solid var(--border-color); flex-shrink:0; color:var(--text-primary);">
                                    ${invInitials}
                                </div>
                            `;

                            return `
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:0.6rem; font-size:0.8rem; padding:0.35rem 0.2rem; border-bottom:1px solid var(--border-color);">
                                    <div style="display:flex; align-items:center; gap:0.55rem; flex:1; min-width:0;">
                                        <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); width:14px;">${idx + 1}</span>
                                        ${invAvatarHtml}
                                        <div style="flex:1; min-width:0;">
                                            <div style="font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${escapeHtml(inv.busInvNumber || inv.invoiceNumber || inv.uniqueId || 'INV')}
                                            </div>
                                            <div style="font-size:0.72rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${escapeHtml(invDisplayName)}
                                            </div>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.45rem; flex-shrink:0;">
                                        <span style="font-size:0.68rem; font-weight:800; padding:1px 6px; border-radius:4px; background:${isPaid ? '#DCFCE7' : '#FEE2E2'}; color:${isPaid ? '#15803D' : '#DC2626'};">
                                            ${isPaid ? 'PAID' : 'DUE'}
                                        </span>
                                        <strong style="color:var(--text-primary); font-size:0.82rem;">${formatCurr(inv.totalPrice || inv.grandTotal || 0)}</strong>
                                        <button type="button" class="quantum-action-btn-sm" data-view-inv="${inv.id || inv.uniqueId}">View &rarr;</button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- BUSINESS INSIGHTS & PRO UPGRADE ROW (FROM PROTOTYPE) -->
            <div style="display:flex; gap:1.25rem; align-items:stretch;" class="quantum-charts-row">
                <!-- 4 Smart Insight Cards -->
                <div class="quantum-card" style="flex:2.2; display:flex; flex-direction:column; justify-content:space-between;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div>
                            <div style="display:flex; align-items:center; gap:0.45rem;">
                                <span style="color:var(--text-primary);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></span>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Business Insights</h3>
                            </div>
                            <p style="margin:0.2rem 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Smart insights to help you grow your business</p>
                        </div>
                        <button type="button" class="quantum-pill-btn" onclick="if(window.navigateToRoute){window.navigateToRoute('/analytics')}else{window.location.hash='#/analytics'}" style="color:var(--text-primary); font-size:0.75rem; padding:0; font-weight:700;">View All Insights &rarr;</button>
                    </div>

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:0.85rem;">
                        <div style="background:var(--surface-100); border:1px solid var(--border-color); border-radius:12px; padding:0.85rem;">
                            <div style="font-size:0.75rem; font-weight:700; color:#16A34A; display:flex; align-items:center; gap:4px;">
                                &nearr; Sales Growth
                            </div>
                            <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin:0.35rem 0 0.15rem 0;">+18.7%</div>
                            <div style="font-size:0.73rem; color:var(--text-muted); line-height:1.3;">Your revenue increased by 18.7% compared to the previous period.</div>
                        </div>

                        <div style="background:var(--surface-100); border:1px solid var(--border-color); border-radius:12px; padding:0.85rem;">
                            <div style="font-size:0.75rem; font-weight:700; color:#DC2626; display:flex; align-items:center; gap:4px;">
                                &Delta; Low Stock Alert
                            </div>
                            <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin:0.35rem 0 0.15rem 0;">${lowStockItemsCount} Products</div>
                            <div style="font-size:0.73rem; color:var(--text-muted); line-height:1.3;">Products are running low in stock. Replenishment recommended.</div>
                        </div>

                        <div style="background:var(--surface-100); border:1px solid var(--border-color); border-radius:12px; padding:0.85rem;">
                            <div style="font-size:0.75rem; font-weight:700; color:#7C3AED; display:flex; align-items:center; gap:4px;">
                                &oplus; Top Customer Segment
                            </div>
                            <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin:0.35rem 0 0.15rem 0;">Wholesale</div>
                            <div style="font-size:0.73rem; color:var(--text-muted); line-height:1.3;">Wholesale customers contribute 26.7% of total sales volume.</div>
                        </div>

                        <div style="background:var(--surface-100); border:1px solid var(--border-color); border-radius:12px; padding:0.85rem;">
                            <div style="font-size:0.75rem; font-weight:700; color:#2563EB; display:flex; align-items:center; gap:4px;">
                                &star; Profit Opportunity
                            </div>
                            <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); margin:0.35rem 0 0.15rem 0;">+15%</div>
                            <div style="font-size:0.73rem; color:var(--text-muted); line-height:1.3;">Consider optimizing prices for low-margin products.</div>
                        </div>
                    </div>
                </div>

                <!-- Pro Upgrade Banner Card -->
                <div class="quantum-card" style="flex:1; min-width:260px; background:linear-gradient(135deg, #18181B 0%, #27272A 100%); color:#ffffff; border:1px solid #3F3F46; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="font-size:1.15rem; font-weight:800; margin-bottom:0.4rem; color:#ffffff;">Grow Your Business Further</div>
                        <p style="font-size:0.8rem; color:#A1A1AA; line-height:1.4; margin:0 0 1rem 0;">
                            Unlock automated batch reporting, multi-branch intelligence, and deeper predictive forecasts.
                        </p>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:1rem;">
                        <button type="button" onclick="if(window.navigateToRoute){window.navigateToRoute('/settings')}else{window.location.hash='#/settings'}" style="background:#ffffff; color:#18181B; border:none; padding:0.5rem 1rem; border-radius:9px; font-weight:700; font-size:0.82rem; cursor:pointer; transition:transform 0.15s ease;">
                            Upgrade to Pro &rarr;
                        </button>
                        <div style="display:flex; align-items:flex-end; gap:4px; height:32px;">
                            <span style="width:5px; height:14px; background:#A1A1AA; border-radius:2px;"></span>
                            <span style="width:5px; height:20px; background:#A1A1AA; border-radius:2px;"></span>
                            <span style="width:5px; height:26px; background:#ffffff; border-radius:2px;"></span>
                            <span style="width:5px; height:32px; background:#22C55E; border-radius:2px;"></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- CUSTOM DATE RANGE MODAL OVERLAY (POPUP ALERT DIALOG) -->
            <div id="quantum-custom-date-modal" class="quantum-modal-overlay" style="display:none;">
                <div class="quantum-modal-box" onclick="event.stopPropagation()">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem; padding-bottom:0.75rem; border-bottom:1px solid var(--border-color);">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span style="color:#16A34A;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></span>
                            <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:var(--text-primary);">Custom Date Range</h3>
                        </div>
                        <button type="button" id="btn-custom-date-close" class="quantum-icon-btn" style="width:28px; height:28px; border-radius:50%; font-size:1.1rem; cursor:pointer;" title="Close Dialog">&times;</button>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; gap:0.95rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">From (Start Date)</label>
                            <input type="date" id="q-custom-start-input" style="width:100%; box-sizing:border-box; padding:0.6rem 0.85rem; border-radius:9px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;" />
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">To (End Date)</label>
                            <input type="date" id="q-custom-end-input" style="width:100%; box-sizing:border-box; padding:0.6rem 0.85rem; border-radius:9px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-size:0.85rem;" />
                        </div>

                        <!-- Quick Presets -->
                        <div style="margin-top:0.25rem;">
                            <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.45rem;">Quick Range Presets:</span>
                            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                                <button type="button" class="quantum-action-btn-sm" data-quick-preset="7">Last 7 Days</button>
                                <button type="button" class="quantum-action-btn-sm" data-quick-preset="14">Last 14 Days</button>
                                <button type="button" class="quantum-action-btn-sm" data-quick-preset="30">Last 30 Days</button>
                                <button type="button" class="quantum-action-btn-sm" data-quick-preset="60">Last 60 Days</button>
                                <button type="button" class="quantum-action-btn-sm" data-quick-preset="90">Last 90 Days</button>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:flex-end; gap:0.55rem; margin-top:1.15rem; padding-top:0.95rem; border-top:1px solid var(--border-color);">
                            <button type="button" id="btn-custom-date-cancel" class="quantum-toolbar-btn">Cancel</button>
                            <button type="button" id="btn-custom-date-apply" class="quantum-toolbar-btn" style="background:#16A34A; color:#ffffff; border-color:#16A34A; font-weight:700;">Apply Date Range</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // =========================================================================
        // REVENUE OVERVIEW CHART GENERATOR (Multi-series Area & Line)
        // =========================================================================
        const renderRevenueChart = () => {
            const chartDataPoints = [];
            const nowTime = Date.now();

            if (activeChartPill === '7D') {
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(nowTime - i * 24 * 60 * 60 * 1000);
                    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
                    const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
                    const label = `${getMonthNameShort(d.getMonth())} ${d.getDate()}`;
                    chartDataPoints.push({ start: s, end: e, label });
                }
            } else if (activeChartPill === '90D') {
                for (let i = 5; i >= 0; i--) {
                    const s = new Date(nowTime - (i + 1) * 15 * 24 * 60 * 60 * 1000).getTime();
                    const e = new Date(nowTime - i * 15 * 24 * 60 * 60 * 1000).getTime();
                    const d = new Date(e);
                    const label = `${getMonthNameShort(d.getMonth())} ${d.getDate()}`;
                    chartDataPoints.push({ start: s, end: e, label });
                }
            } else if (activeChartPill === '1Y') {
                for (let i = 11; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    const s = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
                    const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
                    const label = getMonthNameShort(d.getMonth());
                    chartDataPoints.push({ start: s, end: e, label });
                }
            } else {
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(nowTime - i * 5 * 24 * 60 * 60 * 1000);
                    const s = new Date(nowTime - (i + 1) * 5 * 24 * 60 * 60 * 1000).getTime();
                    const e = d.getTime();
                    const label = `${getMonthNameShort(d.getMonth())} ${d.getDate()}`;
                    chartDataPoints.push({ start: s, end: e, label });
                }
            }

            chartDataPoints.forEach(bucket => {
                let r = 0;
                let p = 0;
                let c = 0;
                allInvoices.forEach(inv => {
                    const t = getInvoiceTime(inv);
                    if (t >= bucket.start && t <= bucket.end) {
                        const tot = Number(inv.totalPrice || inv.grandTotal || 0);
                        r += tot;
                        let invP = 0;
                        let invC = 0;
                        if (inv.items && Array.isArray(inv.items)) {
                            inv.items.forEach(it => {
                                const qty = Number(it.quantity) || 1;
                                const cost = qty * Number(it.unitCost || 0);
                                const rev = Number(it.totalPrice) || (qty * Number(it.unitPrice || 0));
                                invC += cost;
                                invP += (it.itemProfit !== undefined) ? Number(it.itemProfit) : (rev - cost);
                            });
                        }
                        if (inv.totalProfit !== undefined && !isNaN(inv.totalProfit)) {
                            invP = Number(inv.totalProfit);
                        }
                        p += invP;
                        c += invC;
                    }
                });
                bucket.revenue = r;
                bucket.profit = p;
                bucket.cost = c;
            });

            const svgW = 680;
            const svgH = 240;
            const padL = 70;
            const padR = 640;
            const padT = 25;
            const padB = 200;

            const maxVal = Math.max(...chartDataPoints.map(d => Math.max(d.revenue, d.profit, d.cost)), 5000);
            const ceilingVal = Math.ceil(maxVal / 10000) * 10000 || 50000;

            const y5 = container.querySelector('#q-y-5');
            const y4 = container.querySelector('#q-y-4');
            const y3 = container.querySelector('#q-y-3');
            const y2 = container.querySelector('#q-y-2');
            const y1 = container.querySelector('#q-y-1');

            const formatAxisTick = (val) => {
                if (val >= 100000) return (val / 100000).toFixed(1).replace('.0', '') + 'L';
                if (val >= 1000) return Math.round(val / 1000) + 'K';
                return String(Math.round(val));
            };

            if (y5) y5.textContent = formatAxisTick(ceilingVal);
            if (y4) y4.textContent = formatAxisTick(ceilingVal * 0.8);
            if (y3) y3.textContent = formatAxisTick(ceilingVal * 0.6);
            if (y2) y2.textContent = formatAxisTick(ceilingVal * 0.4);
            if (y1) y1.textContent = formatAxisTick(ceilingVal * 0.2);

            const pointsRev = [];
            const pointsProfit = [];
            const pointsCost = [];
            const stepX = (padR - padL) / (chartDataPoints.length - 1 || 1);

            chartDataPoints.forEach((d, i) => {
                const x = padL + i * stepX;
                const yRev = padB - (d.revenue / ceilingVal) * (padB - padT);
                const yProfit = padB - (d.profit / ceilingVal) * (padB - padT);
                const yCost = padB - (d.cost / ceilingVal) * (padB - padT);
                pointsRev.push({ x, y: yRev, raw: d.revenue, label: d.label });
                pointsProfit.push({ x, y: yProfit, raw: d.profit, label: d.label });
                pointsCost.push({ x, y: yCost, raw: d.cost, label: d.label });
            });

            const getSvgCubicPath = (pts) => {
                if (pts.length === 0) return '';
                let path = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
                for (let i = 0; i < pts.length - 1; i++) {
                    const p0 = pts[i === 0 ? 0 : i - 1];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[i + 2] || p2;

                    const cp1x = p1.x + (p2.x - p0.x) / 6;
                    const cp1y = p1.y + (p2.y - p0.y) / 6;
                    const cp2x = p2.x - (p3.x - p1.x) / 6;
                    const cp2y = p2.y - (p3.y - p1.y) / 6;

                    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
                }
                return path;
            };

            const revLinePath = getSvgCubicPath(pointsRev);
            const profitLinePath = getSvgCubicPath(pointsProfit);
            const costLinePath = getSvgCubicPath(pointsCost);

            const revAreaPath = `${revLinePath} L ${pointsRev[pointsRev.length - 1].x.toFixed(1)},${padB} L ${pointsRev[0].x.toFixed(1)},${padB} Z`;
            const profitAreaPath = `${profitLinePath} L ${pointsProfit[pointsProfit.length - 1].x.toFixed(1)},${padB} L ${pointsProfit[0].x.toFixed(1)},${padB} Z`;

            const elRevArea = container.querySelector('#q-chart-revenue-area');
            const elProfitArea = container.querySelector('#q-chart-profit-area');
            const elRevLine = container.querySelector('#q-chart-revenue-line');
            const elProfitLine = container.querySelector('#q-chart-profit-line');
            const elCostLine = container.querySelector('#q-chart-cost-line');
            const elXLabels = container.querySelector('#q-chart-x-labels');
            const elDataDots = container.querySelector('#q-chart-data-dots');

            if (elRevArea) elRevArea.setAttribute('d', revAreaPath);
            if (elProfitArea) elProfitArea.setAttribute('d', profitAreaPath);
            if (elRevLine) elRevLine.setAttribute('d', revLinePath);
            if (elProfitLine) elProfitLine.setAttribute('d', profitLinePath);
            if (elCostLine) elCostLine.setAttribute('d', costLinePath);

            // Re-trigger 3s kinetic line animation
            [elRevLine, elProfitLine, elCostLine].forEach(el => {
                if (el) {
                    el.classList.remove('quantum-spark-line');
                    void el.offsetWidth;
                    el.classList.add('quantum-spark-line');
                }
            });
            [elRevArea, elProfitArea].forEach(el => {
                if (el) {
                    el.classList.remove('quantum-spark-area');
                    void el.offsetWidth;
                    el.classList.add('quantum-spark-area');
                }
            });

            if (elXLabels) {
                elXLabels.innerHTML = chartDataPoints.map((d, i) => {
                    const x = padL + i * stepX;
                    return `<text x="${x.toFixed(1)}" y="222">${d.label}</text>`;
                }).join('');
            }

            if (elDataDots) {
                elDataDots.innerHTML = pointsRev.map((pt, i) => `
                    <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.5" fill="var(--bg-card)" stroke="#16A34A" stroke-width="2.5" />
                    <circle cx="${pointsProfit[i].x.toFixed(1)}" cy="${pointsProfit[i].y.toFixed(1)}" r="4" fill="var(--bg-card)" stroke="#2563EB" stroke-width="2" />
                `).join('');
            }

            // Interactive Tooltip Hover Tracking
            const chartSvg = container.querySelector('#quantum-sales-svg');
            const hoverLine = container.querySelector('#q-chart-hover-line');
            const tooltip = container.querySelector('#q-chart-tooltip');
            const tooltipDate = container.querySelector('#q-tooltip-date');
            const tooltipRev = container.querySelector('#q-tooltip-rev');
            const tooltipProfit = container.querySelector('#q-tooltip-profit');
            const tooltipCost = container.querySelector('#q-tooltip-cost');

            if (chartSvg && tooltip && hoverLine) {
                chartSvg.onmousemove = (e) => {
                    const rect = chartSvg.getBoundingClientRect();
                    const mouseX = ((e.clientX - rect.left) / rect.width) * svgW;

                    let closestIdx = 0;
                    let minDiff = Infinity;
                    pointsRev.forEach((pt, idx) => {
                        const diff = Math.abs(pt.x - mouseX);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closestIdx = idx;
                        }
                    });

                    const ptRev = pointsRev[closestIdx];
                    const d = chartDataPoints[closestIdx];

                    hoverLine.setAttribute('x1', ptRev.x);
                    hoverLine.setAttribute('x2', ptRev.x);
                    hoverLine.setAttribute('opacity', '1');

                    const tooltipLeft = (ptRev.x / svgW) * 100;
                    const tooltipTop = (ptRev.y / svgH) * 100;

                    tooltip.style.left = `${tooltipLeft}%`;
                    tooltip.style.top = `${tooltipTop}%`;
                    tooltip.style.display = 'block';

                    if (tooltipDate) tooltipDate.textContent = d.label;
                    if (tooltipRev) tooltipRev.textContent = formatCurr(d.revenue);
                    if (tooltipProfit) tooltipProfit.textContent = userRestrictions.cannotSeeProfit ? '••••' : formatCurr(d.profit);
                    if (tooltipCost) tooltipCost.textContent = userRestrictions.cannotSeeCost ? '••••' : formatCurr(d.cost);
                };

                chartSvg.onmouseleave = () => {
                    hoverLine.setAttribute('opacity', '0');
                    tooltip.style.display = 'none';
                };
            }
        };

        renderRevenueChart();

        // Bind Time Pill Toggles
        container.querySelectorAll('.quantum-pill-btn[data-pill]').forEach(btn => {
            btn.onclick = () => {
                const p = btn.getAttribute('data-pill');
                if (p) {
                    activeChartPill = p;
                    container.querySelectorAll('.quantum-pill-btn[data-pill]').forEach(b => b.classList.toggle('active', b === btn));
                    renderRevenueChart();
                }
            };
        });

        // =========================================================================
        // SALES ANALYTICS DONUT CHART
        // =========================================================================
        const donutTotal = currentSalesCount > 0 ? currentSalesCount : 1;
        const onlineShare = Math.round((customerChannelCount / donutTotal) * 100);
        const inStoreShare = Math.round((directWalkinCount / donutTotal) * 100);
        const wholesaleShare = Math.max(0, 100 - onlineShare - inStoreShare);

        const donutSegmentsEl = container.querySelector('#q-donut-segments');
        const donutLegendListEl = container.querySelector('#q-donut-legend-list');

        if (donutSegmentsEl && donutLegendListEl) {
            const r = 58;
            const circ = 2 * Math.PI * r;
            const segmentsData = [
                { label: 'Online / Registered', count: customerChannelCount, pct: onlineShare, color: 'var(--text-primary, #18181B)' },
                { label: 'In-Store Walk-in', count: directWalkinCount, pct: inStoreShare, color: '#16A34A' },
                { label: 'Wholesale B2B', count: businessChannelCount, pct: wholesaleShare, color: '#7C3AED' }
            ];

            let accumOffset = 0;
            donutSegmentsEl.innerHTML = segmentsData.map(s => {
                const len = (s.pct / 100) * circ;
                const dashArray = `${len} ${circ}`;
                const dashOffset = -accumOffset;
                accumOffset += len;
                if (s.pct <= 0) return '';
                return `
                    <circle cx="80" cy="80" r="${r}" fill="none"
                        stroke="${s.color}" stroke-width="18"
                        stroke-dasharray="${dashArray}"
                        stroke-dashoffset="${dashOffset}"
                        transform="rotate(-90 80 80)"
                        style="transition: stroke-dashoffset 0.6s ease;"
                    />
                `;
            }).join('');

            donutLegendListEl.innerHTML = segmentsData.map(s => `
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                    <div style="display:flex; align-items:center; gap:0.45rem;">
                        <span style="width:7px; height:7px; border-radius:50%; background:${s.color};"></span>
                        <span style="color:var(--text-primary); font-weight:600;">${s.label}</span>
                    </div>
                    <span style="font-weight:700; color:var(--text-primary);">${s.pct}%</span>
                </div>
            `).join('');
        }

        // =========================================================================
        // FAST-MOTIONIC COUNTER ANIMATIONS (0 -> CURRENT)
        // =========================================================================
        animateCounter(container.querySelector('#q-val-total-products'), currentProductsCount);
        animateCounter(container.querySelector('#q-val-total-revenue'), currentRevenue, true);
        animateCounter(container.querySelector('#q-val-total-sales'), currentSalesCount);
        animateCounter(container.querySelector('#q-val-total-customers'), Math.max(currentActiveCustomers, cachedCustomers.length));

        if (!userRestrictions.cannotSeeProfit) {
            animateCounter(container.querySelector('#q-val-gross-profit'), currentProfit, true);
            animateCounter(container.querySelector('#q-val-profit-margin'), Number(profitMarginPct), false, true);
            animateCounter(container.querySelector('#q-val-net-profit'), currentNetProfit, true);
        }

        animateCounter(container.querySelector('#q-val-orders-invoices'), allInvoices.length);
        animateCounter(container.querySelector('#q-val-stock-valuation'), totalValuation, true);
        animateCounter(container.querySelector('#q-val-total-business'), cachedBusinesses.length);
        animateCounter(container.querySelector('#q-val-barcode-count'), barcodeCount);

        if (!userRestrictions.cannotSeeCost) {
            animateCounter(container.querySelector('#q-val-cogs'), currentCOGS, true);
        }
        animateCounter(container.querySelector('#q-val-rev-r3'), currentRevenue, true);
        animateCounter(container.querySelector('#q-val-stock-units'), totalStockUnits);
        animateCounter(container.querySelector('#q-val-sold-units'), totalUnitsSold);
        animateCounter(container.querySelector('#q-val-rev-r3b'), currentRevenue, true);
        if (!userRestrictions.cannotSeeProfit) {
            animateCounter(container.querySelector('#q-val-prof-r3'), currentProfit, true);
        }

        animateCounter(container.querySelector('#q-val-low-stock-count'), lowStockItemsCount, false, false, '', ' Items');
        animateCounter(container.querySelector('#q-val-expired-count'), expiredItemsCount, false, false, '', ' Items');
        animateCounter(container.querySelector('#q-val-unhealthy-count'), unhealthyItemsCount, false, false, '', ' Items');

        animateCounter(container.querySelector('#q-donut-center-num'), currentSalesCount);
        animateCounter(container.querySelector('#q-growth-aov'), aov, true);

        // Circular Inventory Gauge Animation
        const gaugeCircle = container.querySelector('#q-inventory-gauge-circle');
        const gaugePct = container.querySelector('#q-gauge-pct');
        const healthScore = totalStockUnits > 0 ? 87 : 100;
        if (gaugePct) animateCounter(gaugePct, healthScore, false, true);
        if (gaugeCircle) {
            requestAnimationFrame(() => {
                gaugeCircle.setAttribute('stroke-dasharray', `${((healthScore / 100) * 289).toFixed(1)} 289`);
            });
        }

        // Kinetic Sparkline Wave Animation Trigger (0 -> full wave over 3s: 0.5s pause/soft start, 0.5-2.9s fast sweep, 2.9-3s settle)
        requestAnimationFrame(() => {
            container.querySelectorAll('.quantum-spark-line').forEach(lineEl => {
                lineEl.style.animation = 'none';
                lineEl.style.strokeDashoffset = '1000';
                void lineEl.offsetWidth;
                lineEl.style.animation = 'quantumDrawLine 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards';
            });
            container.querySelectorAll('.quantum-spark-area').forEach(areaEl => {
                areaEl.style.animation = 'none';
                areaEl.style.opacity = '0';
                void areaEl.offsetWidth;
                areaEl.style.animation = 'quantumDrawArea 3s ease forwards';
            });
        });

        // =========================================================================
        // ROW FOLDING TOGGLE BINDINGS
        // =========================================================================
        container.querySelectorAll('.quantum-row-header').forEach(header => {
            header.style.cursor = 'pointer';
            header.onclick = (e) => {
                const rowKey = header.getAttribute('data-toggle');
                if (rowKey && rowFoldStates[rowKey] !== undefined) {
                    rowFoldStates[rowKey] = !rowFoldStates[rowKey];
                    const content = container.querySelector(`#content-${rowKey}`);
                    const chevron = header.querySelector('.quantum-chevron-btn');
                    if (content) content.classList.toggle('folded', rowFoldStates[rowKey]);
                    if (chevron) chevron.classList.toggle('folded', rowFoldStates[rowKey]);
                }
            };
        });

        // =========================================================================
        // LOW STOCK THRESHOLD SELECTOR BINDING
        // =========================================================================
        const lowStockSelect = container.querySelector('#q-low-stock-select');
        if (lowStockSelect) {
            lowStockSelect.onchange = (e) => {
                lowStockThreshold = Number(e.target.value) || 5;
                computeAndRenderDashboard();
            };
        }

        // =========================================================================
        // TOP INVOICES VIEW ACTION
        // =========================================================================
        container.querySelectorAll('[data-view-inv]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const invId = btn.getAttribute('data-view-inv');
                const targetInv = allInvoices.find(i => i.id === invId || i.uniqueId === invId);
                if (targetInv && typeof openInvoiceDetailsModal === 'function') {
                    openInvoiceDetailsModal(targetInv, {
                        onBack: () => computeAndRenderDashboard()
                    });
                } else if (window.navigateToRoute) {
                    window.navigateToRoute('/invoices/customer');
                }
            };
        });

        // =========================================================================
        // TOP BUSINESSES & CUSTOMERS VIEW ACTION (WITH RETURN TO OVERVIEW)
        // =========================================================================
        container.querySelectorAll('[data-view-business-id]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const bId = btn.getAttribute('data-view-business-id');
                const bName = btn.getAttribute('data-view-business-name');
                sessionStorage.setItem('pricelister_target_person_detail', JSON.stringify({
                    id: bId,
                    name: bName,
                    mode: 'businesses'
                }));
                sessionStorage.setItem('pricelister_return_overview', JSON.stringify({
                    title: 'Overview',
                    returnRoute: '/overview',
                    timestamp: Date.now()
                }));
                if (window.navigateToRoute) {
                    window.navigateToRoute('/businesses');
                } else {
                    window.location.hash = '#/businesses';
                }
            };
        });

        container.querySelectorAll('[data-view-customer-id]').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const cId = btn.getAttribute('data-view-customer-id');
                const cName = btn.getAttribute('data-view-customer-name');
                sessionStorage.setItem('pricelister_target_person_detail', JSON.stringify({
                    id: cId,
                    name: cName,
                    mode: 'customers'
                }));
                sessionStorage.setItem('pricelister_return_overview', JSON.stringify({
                    title: 'Overview',
                    returnRoute: '/overview',
                    timestamp: Date.now()
                }));
                if (window.navigateToRoute) {
                    window.navigateToRoute('/customers');
                } else {
                    window.location.hash = '#/customers';
                }
            };
        });

        // =========================================================================
        // CUSTOM DATE MODAL CONTROLS (CENTERED POPUP ALERT DIALOG)
        // =========================================================================
        let customModal = container.querySelector('#quantum-custom-date-modal');
        if (!customModal) {
            customModal = document.getElementById('quantum-custom-date-modal');
        }
        const customStartInput = customModal?.querySelector('#q-custom-start-input') || container.querySelector('#q-custom-start-input');
        const customEndInput = customModal?.querySelector('#q-custom-end-input') || container.querySelector('#q-custom-end-input');

        const openCustomDateModal = () => {
            if (customModal) {
                closeAllMenus();
                if (customModal.parentElement !== document.body) {
                    document.body.appendChild(customModal);
                }
                const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                const startDate = (currentRange.start && currentRange.start > 0) ? new Date(currentRange.start) : defaultStart;
                if (customStartInput) {
                    customStartInput.value = startDate.toISOString().split('T')[0];
                }
                if (customEndInput) {
                    if (currentRange.end && currentRange.end !== Infinity) {
                        customEndInput.value = new Date(currentRange.end).toISOString().split('T')[0];
                    } else {
                        customEndInput.value = new Date().toISOString().split('T')[0];
                    }
                }
                customModal.classList.add('active');
                customModal.style.display = 'flex';
            }
        };

        const closeCustomDateModal = () => {
            if (customModal) {
                customModal.classList.remove('active');
                customModal.style.display = 'none';
            }
        };

        if (customModal) {
            customModal.onclick = (e) => {
                if (e.target === customModal) closeCustomDateModal();
            };
        }

        container.querySelector('#dash-custom-date-trigger-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openCustomDateModal();
        });
        container.querySelector('#dash-date-open-custom')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openCustomDateModal();
        });
        customModal?.querySelector('#btn-custom-date-close')?.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCustomDateModal();
        });
        customModal?.querySelector('#btn-custom-date-cancel')?.addEventListener('click', (e) => {
            e.stopPropagation();
            closeCustomDateModal();
        });

        customModal?.querySelectorAll('[data-quick-preset]').forEach(btn => {
            btn.onclick = () => {
                const days = Number(btn.getAttribute('data-quick-preset')) || 30;
                const endD = new Date();
                const startD = new Date(endD.getTime() - days * 24 * 60 * 60 * 1000);
                if (customStartInput) customStartInput.value = startD.toISOString().split('T')[0];
                if (customEndInput) customEndInput.value = endD.toISOString().split('T')[0];
            };
        });

        customModal?.querySelector('#btn-custom-date-apply')?.addEventListener('click', () => {
            const sVal = customStartInput?.value;
            const eVal = customEndInput?.value;
            if (!sVal || !eVal) {
                showAlert.warning("Please choose both start and end date.");
                return;
            }
            customStart = sVal;
            customEnd = eVal;
            activeFilterKey = 'CUSTOM';
            currentRange = calculateDateRange('CUSTOM', customStart, customEnd);
            comparisonRange = calculateComparisonRange(currentRange, activeCompareMode);
            closeCustomDateModal();
            computeAndRenderDashboard();
        });

        container._cleanup = () => {
            if (customModal && customModal.parentElement === document.body) {
                customModal.remove();
            }
        };

        // =========================================================================
        // TOP CONTROLS & DROPDOWNS BINDINGS
        // =========================================================================
        const dateBtn = container.querySelector('#dash-date-btn');
        const dateMenu = container.querySelector('#dash-date-menu');
        const compareBtn = container.querySelector('#dash-compare-btn');
        const compareMenu = container.querySelector('#dash-compare-menu');
        const exportBtn = container.querySelector('#dash-export-btn');
        const exportMenu = container.querySelector('#dash-export-menu');
        const fullscreenBtn = container.querySelector('#dash-fullscreen-btn');
        const refreshBtn = container.querySelector('#dash-refresh-btn');

        const closeAllMenus = () => {
            container.querySelectorAll('.quantum-dropdown-menu').forEach(m => {
                m.style.display = 'none';
            });
        };

        if (!container._quantumCloseMenusBound) {
            container._quantumCloseMenusBound = true;
            document.addEventListener('click', closeAllMenus);
        }

        if (dateBtn && dateMenu) {
            dateBtn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = dateMenu.style.display === 'flex';
                closeAllMenus();
                dateMenu.style.display = isOpen ? 'none' : 'flex';
            };
            dateMenu.querySelectorAll('.quantum-dropdown-item[data-range]').forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    const r = item.getAttribute('data-range');
                    activeFilterKey = r;
                    currentRange = calculateDateRange(r, customStart, customEnd);
                    comparisonRange = calculateComparisonRange(currentRange, activeCompareMode);
                    dateMenu.style.display = 'none';
                    computeAndRenderDashboard();
                };
            });
        }

        if (compareBtn && compareMenu) {
            compareBtn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = compareMenu.style.display === 'flex';
                closeAllMenus();
                compareMenu.style.display = isOpen ? 'none' : 'flex';
            };
            compareMenu.querySelectorAll('.quantum-dropdown-item').forEach(item => {
                item.onclick = (e) => {
                    e.stopPropagation();
                    const c = item.getAttribute('data-compare');
                    activeCompareMode = c;
                    comparisonRange = calculateComparisonRange(currentRange, c);
                    compareMenu.style.display = 'none';
                    computeAndRenderDashboard();
                };
            });
        }

        if (exportBtn && exportMenu) {
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                const isOpen = exportMenu.style.display === 'flex';
                closeAllMenus();
                exportMenu.style.display = isOpen ? 'none' : 'flex';
            };

            container.querySelector('#btn-export-csv')?.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.style.display = 'none';
                const rows = [
                    ['Metric', 'Value'],
                    ['Report Period', currentRange.label],
                    ['Total Revenue', currentRevenue],
                    ['Total Sales (Invoices)', currentSalesCount],
                    ['Total Products Active', currentProductsCount],
                    ['Total Active Customers', currentActiveCustomers],
                    [],
                    ['Product Name', 'Units Sold', 'Revenue']
                ];
                Object.values(productSalesAgg).forEach(p => {
                    rows.push([`"${p.name}"`, p.units, p.revenue]);
                });
                const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', `PriceLister_Analytics_${activeFilterKey}_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                showAlert.success("Analytics CSV report downloaded successfully.");
            });

            container.querySelector('#btn-export-json')?.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.style.display = 'none';
                const payload = {
                    period: currentRange.label,
                    totalRevenue: currentRevenue,
                    totalSales: currentSalesCount,
                    totalProducts: currentProductsCount,
                    totalCustomers: currentActiveCustomers,
                    topProducts: Object.values(productSalesAgg)
                };
                const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
                const link = document.createElement('a');
                link.setAttribute('href', jsonStr);
                link.setAttribute('download', `PriceLister_Analytics_${Date.now()}.json`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                showAlert.success("Analytics JSON data exported.");
            });

            container.querySelector('#btn-export-print')?.addEventListener('click', (e) => {
                e.stopPropagation();
                exportMenu.style.display = 'none';
                window.print();
            });
        }

        if (fullscreenBtn) {
            fullscreenBtn.onclick = () => {
                if (!document.fullscreenElement) {
                    root.requestFullscreen?.().catch(() => {});
                } else {
                    document.exitFullscreen?.().catch(() => {});
                }
            };
        }

        if (refreshBtn) {
            refreshBtn.onclick = async () => {
                refreshBtn.classList.add('quantum-spinning');
                try {
                    await fetchLiveData(false); // false: data already in memory, smooth in-place update without skeleton shimmer
                } finally {
                    refreshBtn.classList.remove('quantum-spinning');
                }
            };
        }

        // Sectional Scroll: restore scroll position for Overview after rendering completes
        restoreScrollPosition('route:/overview');
    };

    // Parallel fetch live data
    const fetchLiveData = async (showShimmer = false) => {
        if (showShimmer && (!cachedProducts.length && !cachedCustInvoices.length)) {
            renderSkeletonShimmer();
        }
        try {
            const [prods, cats, custInvs, busInvs, customers, clients, businesses] = await Promise.all([
                getProductService(workspaceId).getAllActiveProducts().catch(() => []),
                getCategoryService(workspaceId).getAllCategories().catch(() => []),
                getInvoiceService(workspaceId).getAllInvoices(false).catch(() => []),
                getInvoiceService(workspaceId).getAllInvoices(true).catch(() => []),
                getPeopleService(workspaceId).getAllCustomers().catch(() => []),
                getPeopleService(workspaceId).getAllClients().catch(() => []),
                getPeopleService(workspaceId).getAllBusinesses().catch(() => [])
            ]);

            cachedProducts = prods || [];
            cachedCategories = cats || [];
            cachedCustInvoices = custInvs || [];
            cachedBusInvoices = busInvs || [];
            cachedCustomers = [...(customers || []), ...(clients || [])];
            cachedBusinesses = businesses || [];

            computeAndRenderDashboard();
        } catch (err) {
            console.error("Dashboard calculation error:", err);
            showAlert.error("Failed to load analytics dashboard data.");
        }
    };

    await fetchLiveData(true);
};
