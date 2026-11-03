/**
 * Simple SPA Router for Workspace
 */

import { renderOverview } from './workspace.js';
import { renderProducts } from './modules/products.js';
import { renderCategories } from './modules/categories.js';
import { renderMarketInserter } from './modules/marketInserter.js';
import { renderPeople } from './modules/people.js';
import { renderInvoices } from './modules/invoices.js';
import { renderSettings } from './modules/settings.js';
import { renderWorkers } from './modules/workers.js';
import { renderMembers } from './modules/members.js';
import { renderProfile } from './modules/profile.js';
import { renderMailbox } from './modules/mailbox.js';
import { renderAnalyticsHub } from './modules/analyticsHub.js';
import { renderSchemaAnalyzer } from './modules/schemaAnalyzer.js';
import { renderCustomerPanelSetup } from './modules/customerPanelSetup.js';
import { renderOrders } from './modules/orders.js';
import { renderBarcodeGenerator } from './modules/barcodeGenerator.js';
import { renderFinanceTracker } from './modules/financeTracker.js';
import { renderProfitCalculator } from './modules/profitCalculator.js';
import { renderShippingExport } from './modules/shippingExport.js';
import { renderSupplierMarket } from './modules/supplierMarket.js';
import { renderAutomationCenter } from './modules/automationCenter.js';
import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';

import { showAlert } from './alert-handler.js';
import { draftManager } from './services/draftManager.js';

// Placeholders for remaining modules
const renderPlaceholder = (container, title) => {
    container.innerHTML = `
        <div class="module-header"><h2>${title}</h2></div>
        <div class="empty-state"><p>This module is under construction.</p></div>
    `;
};

let isNavigatingAway = false;

/**
 * Reset and discard all active unsaved states across all modules
 */
export const discardActiveUnsavedChanges = () => {
    try {
        if (draftManager && typeof draftManager.clearAllActiveForms === 'function') {
            draftManager.clearAllActiveForms();
        }
        const floatingBar = document.getElementById('settings-floating-bar');
        if (floatingBar) {
            floatingBar.style.opacity = '0';
            floatingBar.style.pointerEvents = 'none';
            floatingBar.style.transform = 'translateX(-50%) translateY(100px)';
        }
        const prdForm = document.getElementById('product-form-container');
        if (prdForm) prdForm.style.display = 'none';
        const invEditor = document.getElementById('invoice-editor-view');
        if (invEditor) invEditor.style.display = 'none';
        const catForm = document.getElementById('category-form-container');
        if (catForm) catForm.style.display = 'none';
        const manageWorker = document.getElementById('manage-worker-container');
        if (manageWorker) manageWorker.style.display = 'none';
        const addWorker = document.getElementById('add-worker-container');
        if (addWorker) addWorker.style.display = 'none';
        document.querySelectorAll('.prd-batch-action-bar').forEach(b => {
            b.classList.remove('visible');
            b.style.display = 'none';
            b.remove();
        });
    } catch (e) {
        console.warn("Error discarding unsaved changes:", e);
    }
};

/**
 * Universal Edit Safety / Unsaved Changes Detector
 * Detects whether any active view or modal form currently has unsaved modifications.
 */
export const hasUnsavedChanges = () => {
    if (isNavigatingAway) return false;
    try {
        if (draftManager && typeof draftManager.hasActiveUnsavedChanges === 'function') {
            if (draftManager.hasActiveUnsavedChanges()) return true;
        }

        // 1. Settings Module: Floating bar active when user modified settings
        const floatingBar = document.getElementById('settings-floating-bar');
        if (floatingBar && document.body.contains(floatingBar) && (floatingBar.style.opacity === '1' || floatingBar.style.pointerEvents === 'auto')) {
            return true;
        }

        // 2. Product Form: Check if open with unsaved changes
        const prdFormContainer = document.getElementById('product-form-container');
        if (prdFormContainer && document.body.contains(prdFormContainer) && prdFormContainer.style.display !== 'none') {
            const prdId = document.getElementById('prd-id')?.value;
            if (!prdId) {
                const name = document.getElementById('prd-name')?.value?.trim();
                const sale = document.getElementById('prd-sale-price')?.value?.trim();
                const cost = document.getElementById('prd-cost-price')?.value?.trim();
                const note = document.getElementById('prd-note')?.value?.trim();
                const upc = document.getElementById('prd-upc')?.value?.trim();
                if (name || sale || cost || note || upc) return true;
            }
        }

        // 3. Invoice Editor: Editor open with unsaved modifications or items
        const invEditor = document.getElementById('invoice-editor-view');
        if (invEditor && document.body.contains(invEditor) && invEditor.style.display !== 'none') {
            if (typeof invEditor._isDirty === 'function') {
                if (invEditor._isDirty()) return true;
            }
        }

        // 4. Category Form: Form open with non-empty input
        const catFormContainer = document.getElementById('category-form-container');
        if (catFormContainer && document.body.contains(catFormContainer) && catFormContainer.style.display !== 'none') {
            const catName = document.getElementById('cat-name')?.value?.trim();
            const catSubmitBtn = document.getElementById('cat-submit-btn');
            if (catSubmitBtn && !catSubmitBtn.disabled && catName) return true;
        }

        // 5. Worker Permissions Manage Form: Form open with modified permissions
        const workerSaveBtn = document.getElementById('btn-save-manage');
        const manageWorkerContainer = document.getElementById('manage-worker-container');
        if (manageWorkerContainer && document.body.contains(manageWorkerContainer) && manageWorkerContainer.style.display !== 'none') {
            if (workerSaveBtn && !workerSaveBtn.disabled) return true;
        }

        // 6. Market Inserter: Open grid with pending rows containing user input
        const miGrid = document.getElementById('mi-grid-body');
        if (miGrid && document.body.contains(miGrid)) {
            const miRows = miGrid.querySelectorAll('tr.mi-grid-row');
            if (miRows && miRows.length > 0) {
                const hasData = Array.from(miRows).some(row => {
                    const nameInp = row.querySelector('.mi-inp-name')?.value?.trim();
                    return Boolean(nameInp);
                });
                if (hasData) return true;
            }
        }

        // 7. Customer Panel Setup: Form has unsaved modifications
        const btnSaveCustomerPanel = document.getElementById('btn-save-customer-panel');
        if (btnSaveCustomerPanel && document.body.contains(btnSaveCustomerPanel) && !btnSaveCustomerPanel.disabled && btnSaveCustomerPanel.getAttribute('data-dirty') === 'true') {
            return true;
        }
    } catch (e) {
        console.warn("Edit safety check warning:", e);
    }
    return false;
};

const routes = {
    '/overview': { render: (c, w) => renderOverview(c, w), title: 'Workspace / Overview' },
    '/analytics': { render: (c, w, feat) => renderAnalyticsHub(c, w, feat), title: 'Workspace / Data Analytics' },
    '/schema-analyzer': { render: (c, w, param) => renderSchemaAnalyzer(c, w, param), title: 'Workspace / Schema Analyzer' },
    '/members': { render: (c, w) => renderMembers(c, w), title: 'Workspace / Members & Contributions' },
    '/products': { render: (c, w) => renderProducts(c, w), title: 'Products / All Products' },
    '/market-inserter': { render: (c, w) => renderMarketInserter(c, w), title: 'Products / Market Inserter' },
    '/categories': { render: (c, w) => renderCategories(c, w), title: 'Products / Categories' },
    
    // TOOLS
    '/barcode-generator': { render: (c, w) => renderBarcodeGenerator(c, w), title: 'Tools / Barcode Generator' },
    '/finance-tracker': { render: (c, w, tab) => renderFinanceTracker(c, w, tab || 'overview'), title: 'Tools / Finance Tracker' },
    '/emi-calculator': { render: (c, w) => renderFinanceTracker(c, w, 'calculator'), title: 'Tools / EMI Calculator' },
    '/customer-emi': { render: (c, w) => renderFinanceTracker(c, w, 'emi_accounts'), title: 'Tools / Customer EMI' },
    '/emi-collection': { render: (c, w) => renderFinanceTracker(c, w, 'collection'), title: 'Tools / Payment Collection' },
    '/emi-overdue': { render: (c, w) => renderFinanceTracker(c, w, 'overdue'), title: 'Tools / Overdue Management' },
    '/profit-calculator': { render: (c, w) => renderProfitCalculator(c, w), title: 'Tools / Profit Calculator' },

    // SALES
    '/invoices/customer': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/invoices/business': { render: (c, w) => renderInvoices(c, w, true), title: 'Sales / Business Invoices' },
    '/customer-invoices': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/business-invoices': { render: (c, w) => renderInvoices(c, w, true), title: 'Sales / Business Invoices' },
    '/invoices': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/shipping-export': { render: (c, w) => renderShippingExport(c, w), title: 'Sales / Shipping & Export' },

    // CONTRACTS
    '/customers': { render: (c, w) => renderPeople(c, w, 'customers'), title: 'Contracts / Customers & Clients' },
    '/businesses': { render: (c, w) => renderPeople(c, w, 'businesses'), title: 'Contracts / Businesses' },
    '/clients': { render: (c, w) => renderPeople(c, w, 'clients'), title: 'Contracts / Clients' },
    '/suppliers': { render: (c, w) => renderSupplierMarket(c, w, 'directory'), title: 'Contracts / Supplyers' },

    // AUTOMATION (Module 05)
    '/notifications-center': { render: (c, w) => renderAutomationCenter(c, w, 'notifications'), title: 'Automation / Notifications Center' },
    '/automation-rules': { render: (c, w) => renderAutomationCenter(c, w, 'rules'), title: 'Automation / Automation Rules' },
    '/scheduled-reports': { render: (c, w) => renderAutomationCenter(c, w, 'reports'), title: 'Automation / Scheduled Reports' },
    '/task-monitor': { render: (c, w) => renderAutomationCenter(c, w, 'tasks'), title: 'Automation / Task Monitor' },
    '/notification-settings': { render: (c, w) => renderAutomationCenter(c, w, 'settings'), title: 'Automation / Notification Settings' },

    // SUPPLIER & MARKET (Module 06)
    '/supplier-directory': { render: (c, w) => renderSupplierMarket(c, w, 'directory'), title: 'Supplier & Market / Supplier Directory' },
    '/supplier-pricing': { render: (c, w) => renderSupplierMarket(c, w, 'pricing'), title: 'Supplier & Market / Supplier Pricing' },
    '/market-comparison': { render: (c, w) => renderSupplierMarket(c, w, 'comparison'), title: 'Supplier & Market / Market Comparison' },
    '/supplier-performance': { render: (c, w) => renderSupplierMarket(c, w, 'performance'), title: 'Supplier & Market / Supplier Performance' },
    '/price-history': { render: (c, w) => renderSupplierMarket(c, w, 'history'), title: 'Supplier & Market / Price History' },

    // WORKSPACE SETTINGS
    '/workspace': { render: (c, w) => renderWorkers(c, w), title: 'Workspace / Hub & Members' },
    '/workers': { render: (c, w) => renderWorkers(c, w), title: 'Workspace / Hub & Members' },
    '/settings': { render: (c, w) => renderSettings(c, w), title: 'Settings / General' },
    '/customer-panel': { render: (c, w) => renderCustomerPanelSetup(c, w), title: 'Workspace / Customer Panel Setup' },
    '/orders': { render: (c, w) => renderOrders(c, w), title: 'Workspace / Customer Orders' },
    '/profile': { render: (c, w) => renderProfile(c, w), title: 'Account / My Profile' },
    '/mailbox': { render: (c, w) => renderMailbox(c, w), title: 'Account / Mailbox' }
};


/**
 * Convert internal route path (e.g. '/overview', '/settings', '/members')
 * to a clean public URL path (e.g. '/Workspace/overview', '/Workspace/settings')
 * No .html and no # hash symbol in locator.
 */
export const getCleanUrlForRoute = (routePath = '/overview') => {
    let clean = (routePath || '/overview').replace(/^#/, '').trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    if (clean === '/workers') clean = '/workspace';
    if (clean === '/customer-invoices') clean = '/invoices/customer';
    if (clean === '/business-invoices') clean = '/invoices/business';
    return `/Workspace${clean}`;
};

/**
 * Extract normalized internal route from the current window location
 * Supports:
 *   - /Workspace/overview, /Workspace/settings, /Workspace/invoices/customer
 *   - /overview, /settings, /members
 *   - Route persistence fallback via sessionStorage (pricelister_last_route)
 *   - Legacy fallback: #/overview
 */
export const extractRouteFromUrl = () => {
    // 1. Check hash fallback if user accessed via old bookmark
    if (window.location.hash && window.location.hash.startsWith('#/')) {
        let h = window.location.hash.substring(1);
        if (h === '/customer-invoices') h = '/invoices/customer';
        if (h === '/business-invoices') h = '/invoices/business';
        return h;
    }

    // 2. Check clean path /Workspace/...
    const pathname = window.location.pathname || '';
    const wsMatch = pathname.match(/(?:\/|^)workspace(\/.*)?$/i);
    if (wsMatch) {
        let sub = (wsMatch[1] || '').trim();
        if (sub) {
            if (!sub.startsWith('/')) sub = '/' + sub;
            if (sub === '/customer-invoices') sub = '/invoices/customer';
            if (sub === '/business-invoices') sub = '/invoices/business';
            if (routes[sub] || sub.startsWith('/analytics/') || sub.startsWith('/schema-analyzer/')) {
                return sub;
            }
        }
    }

    // 3. Check direct route path match
    for (const r of Object.keys(routes)) {
        if (pathname.toLowerCase().endsWith(r.toLowerCase())) {
            return r;
        }
    }

    // 4. Persistence Fallback: If user refreshed (F5) or reloaded, check sessionStorage so active page is NEVER forgotten!
    try {
        const lastRoute = sessionStorage.getItem('pricelister_last_route');
        if (lastRoute && (routes[lastRoute] || lastRoute.startsWith('/analytics/') || lastRoute.startsWith('/schema-analyzer/'))) {
            return lastRoute;
        }
    } catch (e) {}

    return '/overview';
};

export const initRouter = async (workspaceIdParam = null) => {
    // Resolve current workspace ID for the router
    let currentWorkspaceId = workspaceIdParam;
    if (!currentWorkspaceId) {
        const user = authService.getCurrentUser();
        if (user && user.uid) {
            try {
                const ws = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                if (ws) currentWorkspaceId = ws.id;
            } catch (e) {
                console.error("Failed to load workspace for router", e);
            }
        }
    }

    // Fallback: active workspace from storage or demo sandbox
    if (!currentWorkspaceId) {
        currentWorkspaceId = localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    }

    let currentActiveRoute = null;

    /**
     * Core Route Execution Function
     */
    const executeRoute = async (targetPath) => {
        if (!currentWorkspaceId) return;

        // Security Guard: Immediately abort and eject if access is blocked
        if (typeof window !== 'undefined' && window.__activeWorkspace?.isAccessBlocked) {
            console.warn("[PriceLister Security] Blocked user attempted navigation. Redirecting to launcher.");
            showAlert.error(`Access Blocked: Your access is suspended until ${window.__activeWorkspace.revokeEndFormatted || 'the duration expires'}.`);
            window.location.href = 'index.html';
            return;
        }

        let path = targetPath || '/overview';
        let routeParam = null;

        // Support /analytics/:feature routes
        if (path.startsWith('/analytics/')) {
            routeParam = path.replace('/analytics/', '');
            path = '/analytics';
        }

        // Support /schema-analyzer/:param routes
        if (path.startsWith('/schema-analyzer/')) {
            routeParam = path.replace('/schema-analyzer/', '');
            path = '/schema-analyzer';
        } else if (path.startsWith('/schema-analyzer?')) {
            routeParam = path.replace('/schema-analyzer?', '');
            path = '/schema-analyzer';
        }

        let route = routes[path];
        if (!route && (path === '/workspace' || path === '/workers')) {
            route = routes['/workspace'] || routes['/workers'];
        }

        if (route) {
            currentActiveRoute = targetPath;
            try {
                sessionStorage.setItem('pricelister_last_route', targetPath);
            } catch (e) {}

            // Update breadcrumbs
            const breadcrumbs = document.getElementById('breadcrumbs');
            if (breadcrumbs) {
                breadcrumbs.textContent = routeParam ? `${route.title} / ${routeParam.replace(/_/g, ' ')}` : route.title;
            }

            // Render fresh view with YouTube-Style Smart Top Loading
            const topBar = document.getElementById('youtube-top-progress');
            const topLoader = document.getElementById('youtube-top-loader');
            if (topLoader) {
                topLoader.style.display = 'block';
                topLoader.style.opacity = '1';
            }
            if (topBar) {
                topBar.style.opacity = '1';
                topBar.style.width = '65%';
            }

            const mainContainer = document.getElementById('workspace-container');
            const loader = document.getElementById('app-loader');
            const shell = document.getElementById('app-shell');

            try {
                if (mainContainer) {
                    discardActiveUnsavedChanges();
                    mainContainer.innerHTML = '';
                    const routeContainer = document.createElement('div');
                    routeContainer.className = 'route-view';
                    mainContainer.appendChild(routeContainer);
                    await route.render(routeContainer, currentWorkspaceId, routeParam);
                }
            } catch (err) {
                console.error(`Error rendering route ${path}:`, err);
                if (mainContainer) {
                    mainContainer.innerHTML = `<div class="route-view" style="padding:2rem;"><div class="alert alert-danger">Error rendering page view: ${err.message || 'Unknown error'}</div></div>`;
                }
            } finally {
                isNavigatingAway = false;
                if (loader) loader.style.display = 'none';
                if (shell) shell.style.display = 'flex';
                document.body.classList.remove('app-loading');
                if (typeof window.__dismissWorkspaceLoader === 'function') {
                    window.__dismissWorkspaceLoader('route_rendered');
                }
            }

            // Update active sidebar nav indicators & hierarchical tree state
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            let activeNav = document.querySelector(`.nav-item[href="#${path}"]`) || 
                            document.querySelector(`.nav-item[data-route="${path.replace(/^\//, '')}"]`);
            if (!activeNav && (path === '/invoices/customer' || path === '/customer-invoices')) {
                activeNav = document.querySelector('.nav-item[data-route="customer-invoices"]') || 
                            document.querySelector('.nav-item[data-route="invoices/customer"]') ||
                            document.querySelector('.nav-item[href="#/invoices/customer"]');
            } else if (!activeNav && (path === '/invoices/business' || path === '/business-invoices')) {
                activeNav = document.querySelector('.nav-item[data-route="business-invoices"]') || 
                            document.querySelector('.nav-item[data-route="invoices/business"]') ||
                            document.querySelector('.nav-item[href="#/invoices/business"]');
            } else if (!activeNav && (path === '/workers' || path === '/workspace')) {
                activeNav = document.querySelector('.nav-item[data-route="workspace"]') || document.querySelector('.nav-item[data-route="workers"]');
            } else if (!activeNav && path.startsWith('/analytics')) {
                activeNav = document.querySelector('.nav-item[data-route="analytics"]');
            } else if (!activeNav && path.startsWith('/schema-analyzer')) {
                activeNav = document.querySelector('.nav-item[data-route="schema-analyzer"]');
            } else if (!activeNav && (path === '/suppliers' || path.startsWith('/supplier-'))) {
                activeNav = document.querySelector(`.nav-item[data-route="${path.replace(/^\//, '')}"]`) || document.querySelector('.nav-item[data-route="suppliers"]');
            } else if (!activeNav && path.startsWith('/automation-')) {
                activeNav = document.querySelector(`.nav-item[data-route="${path.replace(/^\//, '')}"]`) || document.querySelector('.nav-item[data-route="notifications-center"]');
            }

            if (activeNav) {
                activeNav.classList.add('active');
                // Ensure parent tree group is expanded and active
                document.querySelectorAll('.nav-tree-group').forEach(grp => grp.classList.remove('tree-group-has-active'));
                const parentGroup = activeNav.closest('.nav-tree-group');
                if (parentGroup) {
                    parentGroup.classList.add('expanded');
                    parentGroup.classList.add('tree-group-has-active');
                    const header = parentGroup.querySelector('.nav-tree-group-header');
                    if (header) header.setAttribute('aria-expanded', 'true');
                }
            }
            
            // Close context panel on route change
            const contextPanel = document.getElementById('context-panel');
            if (contextPanel) contextPanel.classList.remove('open');
        } else {
            // Default Fallback
            await navigateTo('/overview', true);
        }
    };

    /**
     * Programmatic Navigation Handler with Clean URL formatting
     */
    const navigateTo = async (targetRoute, replace = false) => {
        let rawTarget = (targetRoute || '/overview').replace(/^#/, '').trim();
        if (rawTarget === 'customer-invoices' || rawTarget === '/customer-invoices') rawTarget = '/invoices/customer';
        if (rawTarget === 'business-invoices' || rawTarget === '/business-invoices') rawTarget = '/invoices/business';
        const normalizedTarget = rawTarget.startsWith('/') ? rawTarget : '/' + rawTarget;

        if (normalizedTarget === currentActiveRoute && !replace) return;

        // Edit Safety Check: Intercept navigation if there are unsaved edits
        if (!isNavigatingAway && currentActiveRoute && currentActiveRoute !== normalizedTarget && hasUnsavedChanges()) {
            const allowLeave = await showAlert.confirmUnsavedChanges();
            if (!allowLeave) {
                return; // User cancelled navigation
            } else {
                isNavigatingAway = true;
                discardActiveUnsavedChanges();
            }
        }

        const cleanUrl = getCleanUrlForRoute(normalizedTarget);

        try {
            if (replace) {
                window.history.replaceState({ route: normalizedTarget }, '', cleanUrl);
            } else {
                window.history.pushState({ route: normalizedTarget }, '', cleanUrl);
            }
            sessionStorage.setItem('pricelister_last_route', normalizedTarget);
        } catch (e) {
            // In case of local strict origin restrictions, graceful fallback
            console.debug("History API navigation state update:", cleanUrl);
        }

        await executeRoute(normalizedTarget);
    };

    // Expose programmatic navigation globally
    window.navigateToRoute = navigateTo;

    // Tree Navigation Group Expand/Collapse Click Handler
    document.addEventListener('click', (e) => {
        const header = e.target.closest('.nav-tree-group-header');
        if (!header) return;
        const group = header.closest('.nav-tree-group');
        if (!group) return;

        // In mini sidebar mode, avoid collapsing group headers on click
        if (document.getElementById('app-shell')?.classList.contains('sidebar-mini')) return;

        group.classList.toggle('expanded');
        const isExp = group.classList.contains('expanded');
        header.setAttribute('aria-expanded', isExp ? 'true' : 'false');
    });

    // Sidebar & Internal Navigation Link Click Interceptor for Clean URLs & Edit Safety
    document.addEventListener('click', async (e) => {
        const link = e.target.closest('a[href^="#/"], a[data-route], a[href*="/Workspace/"]');
        if (!link) return;

        e.preventDefault();
        e.stopPropagation();

        let targetRoute = '/overview';
        const dRoute = link.getAttribute('data-route');
        if (dRoute) {
            if (dRoute === 'customer-invoices' || dRoute === 'invoices/customer') {
                targetRoute = '/invoices/customer';
            } else if (dRoute === 'business-invoices' || dRoute === 'invoices/business') {
                targetRoute = '/invoices/business';
            } else {
                targetRoute = '/' + dRoute.replace(/^\//, '');
            }
        } else if (link.getAttribute('href')?.startsWith('#/')) {
            targetRoute = link.getAttribute('href').substring(1);
        } else if (link.getAttribute('href')?.includes('/Workspace/')) {
            targetRoute = link.getAttribute('href').split('/Workspace')[1] || '/overview';
        }

        if (targetRoute === '/customer-invoices') targetRoute = '/invoices/customer';
        if (targetRoute === '/business-invoices') targetRoute = '/invoices/business';

        await navigateTo(targetRoute);
    }, true);

    // Global Keyboard Navigation: Ctrl+ArrowUp and Ctrl+ArrowDown
    window.addEventListener('keydown', async (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

        // Query all visible/registered sidebar navigation items in DOM order
        const navItems = Array.from(document.querySelectorAll('.sidebar .nav-item'));
        if (!navItems.length) return;

        e.preventDefault();

        // Determine current active navigation index
        let currentIndex = navItems.findIndex(el => el.classList.contains('active'));
        if (currentIndex === -1 && currentActiveRoute) {
            const cleanCur = currentActiveRoute.replace(/^\//, '');
            currentIndex = navItems.findIndex(el => {
                const r = el.getAttribute('data-route') || el.getAttribute('href')?.replace(/^#\/?/, '');
                return r === cleanCur || (r && cleanCur.startsWith(r));
            });
        }

        let targetIndex = 0;
        if (e.key === 'ArrowDown') {
            if (currentIndex === -1 || currentIndex >= navItems.length - 1) {
                targetIndex = 0; // Wrap from last (Settings) back to first (Overview)
            } else {
                targetIndex = currentIndex + 1;
            }
        } else if (e.key === 'ArrowUp') {
            if (currentIndex <= 0) {
                targetIndex = navItems.length - 1; // Wrap from first (Overview) directly to last station (Settings)
            } else {
                targetIndex = currentIndex - 1;
            }
        }

        const targetLink = navItems[targetIndex];
        if (targetLink) {
            // Expand the parent group if collapsed so the user sees the active destination
            const parentGroup = targetLink.closest('.nav-tree-group');
            if (parentGroup && !parentGroup.classList.contains('expanded')) {
                parentGroup.classList.add('expanded');
                const header = parentGroup.querySelector('.nav-tree-group-header');
                if (header) header.setAttribute('aria-expanded', 'true');
            }

            // Scroll the link smoothly into view in the sidebar
            targetLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

            let targetRoute = targetLink.getAttribute('href')?.replace(/^#/, '') || 
                              targetLink.getAttribute('data-route') || 
                              '/overview';
            if (!targetRoute.startsWith('/')) targetRoute = '/' + targetRoute;
            if (targetRoute === '/customer-invoices') targetRoute = '/invoices/customer';
            if (targetRoute === '/business-invoices') targetRoute = '/invoices/business';

            await navigateTo(targetRoute);
        }
    });

    // Browser Refresh / Window Close Edit Safety Guard
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Browser Back / Forward History PopState Listener
    window.addEventListener('popstate', async (e) => {
        const popRoute = e.state?.route || extractRouteFromUrl();
        if (popRoute !== currentActiveRoute) {
            if (!isNavigatingAway && hasUnsavedChanges()) {
                const allowLeave = await showAlert.confirmUnsavedChanges();
                if (!allowLeave) {
                    // Revert URL forward
                    if (currentActiveRoute) {
                        window.history.pushState({ route: currentActiveRoute }, '', getCleanUrlForRoute(currentActiveRoute));
                    }
                    return;
                } else {
                    isNavigatingAway = true;
                    discardActiveUnsavedChanges();
                }
            }
            await executeRoute(popRoute);
        }
    });

    // Hashchange Fallback (cleans up any legacy inline hash assignments immediately)
    window.addEventListener('hashchange', async () => {
        if (window.location.hash && window.location.hash.startsWith('#/')) {
            const hRoute = window.location.hash.substring(1);
            await navigateTo(hRoute, true);
        }
    });
    
    // Initial load: Sanitize address bar to clean /Workspace/... locator immediately
    const initialRoute = extractRouteFromUrl();
    const initialCleanUrl = getCleanUrlForRoute(initialRoute);
    try {
        window.history.replaceState({ route: initialRoute }, '', initialCleanUrl);
    } catch (e) {
        console.debug("Initial URL clean replace:", initialCleanUrl);
    }

    await executeRoute(initialRoute);
};
