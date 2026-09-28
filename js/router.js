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
import { renderCustomerPanelSetup } from './modules/customerPanelSetup.js';
import { renderOrders } from './modules/orders.js';
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

/**
 * Universal Edit Safety / Unsaved Changes Detector
 * Detects whether any active view or modal form currently has unsaved modifications.
 */
export const hasUnsavedChanges = () => {
    try {
        if (draftManager && typeof draftManager.hasActiveUnsavedChanges === 'function') {
            if (draftManager.hasActiveUnsavedChanges()) return true;
        }

        // 1. Settings Module: Floating bar active when user modified settings
        const floatingBar = document.getElementById('settings-floating-bar');
        if (floatingBar && (floatingBar.style.opacity === '1' || floatingBar.style.pointerEvents === 'auto')) {
            return true;
        }

        // 2. Product Form: Check if open with unsaved changes
        const prdFormContainer = document.getElementById('product-form-container');
        if (prdFormContainer && prdFormContainer.style.display !== 'none') {
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
        if (invEditor && invEditor.style.display !== 'none') {
            if (typeof invEditor._isDirty === 'function') {
                if (invEditor._isDirty()) return true;
            }
        }

        // 4. Category Form: Form open with non-empty input
        const catFormContainer = document.getElementById('category-form-container');
        if (catFormContainer && catFormContainer.style.display !== 'none') {
            const catName = document.getElementById('cat-name')?.value?.trim();
            const catSubmitBtn = document.getElementById('cat-submit-btn');
            if (catSubmitBtn && !catSubmitBtn.disabled && catName) return true;
        }

        // 5. Worker Permissions Manage Form: Form open with modified permissions
        const workerSaveBtn = document.getElementById('btn-save-manage');
        const manageWorkerContainer = document.getElementById('manage-worker-container');
        if (manageWorkerContainer && manageWorkerContainer.style.display !== 'none') {
            if (workerSaveBtn && !workerSaveBtn.disabled) return true;
        }

        // 6. Market Inserter: Open grid with pending rows containing user input
        const miGrid = document.getElementById('mi-grid-body');
        if (miGrid) {
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
        if (btnSaveCustomerPanel && !btnSaveCustomerPanel.disabled && btnSaveCustomerPanel.getAttribute('data-dirty') === 'true') {
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
    '/members': { render: (c, w) => renderMembers(c, w), title: 'Workspace / Members & Contributions' },
    '/products': { render: (c, w) => renderProducts(c, w), title: 'Products / All Products' },
    '/market-inserter': { render: (c, w) => renderMarketInserter(c, w), title: 'Products / Market Inserter' },
    '/categories': { render: (c, w) => renderCategories(c, w), title: 'Products / Categories' },
    '/invoices/customer': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/invoices/business': { render: (c, w) => renderInvoices(c, w, true), title: 'Sales / Business Invoices' },
    '/customers': { render: (c, w) => renderPeople(c, w, 'customers'), title: 'People / Customers' },
    '/businesses': { render: (c, w) => renderPeople(c, w, 'businesses'), title: 'People / Businesses' },
    '/clients': { render: (c, w) => renderPeople(c, w, 'clients'), title: 'People / Clients' },
    '/workspace': { render: (c, w) => renderWorkers(c, w), title: 'Workspace / Hub & Members' },
    '/workers': { render: (c, w) => renderWorkers(c, w), title: 'Workspace / Hub & Members' },
    '/settings': { render: (c, w) => renderSettings(c, w), title: 'Settings / General' },
    '/customer-panel': { render: (c, w) => renderCustomerPanelSetup(c, w), title: 'Workspace / Customer Panel Setup' },
    '/orders': { render: (c, w) => renderOrders(c, w), title: 'Workspace / Customer Orders' },
    '/profile': { render: (c, w) => renderProfile(c, w), title: 'Account / My Profile' },
    '/mailbox': { render: (c, w) => renderMailbox(c, w), title: 'Account / Mailbox' }
};


export const initRouter = async (workspaceIdParam = null) => {
    // Resolve current workspace ID once for the router
    const user = authService.getCurrentUser();
    if (!user) return; // Prevent routing if not logged in
    
    let currentWorkspaceId = workspaceIdParam;
    if (!currentWorkspaceId) {
        try {
            const ws = await firestoreService.checkWorkspaceExists(user.uid, user.email);
            if (ws) currentWorkspaceId = ws.id;
        } catch (e) {
            console.error("Failed to load workspace for router", e);
        }
    }

    let currentRenderedHash = window.location.hash || '#/overview';
    let isRevertingRoute = false;

    const handleRoute = async () => {
        if (!currentWorkspaceId) return; // Wait for workspace

        if (isRevertingRoute) {
            isRevertingRoute = false;
            return;
        }
        
        const hash = window.location.hash || '#/overview';

        // Edit Safety Check: Intercept navigation if there are unsaved edits
        if (hash !== currentRenderedHash && hasUnsavedChanges()) {
            const allowLeave = await showAlert.confirmUnsavedChanges();
            if (!allowLeave) {
                // User chose "Stay & Save Changes" -> cancel navigation and revert hash
                isRevertingRoute = true;
                window.location.hash = currentRenderedHash;
                return;
            }
        }

        currentRenderedHash = hash;
        const rawPath = hash.substring(1);
        
        let path = rawPath;
        let routeParam = null;

        // Support /analytics/:feature routes
        if (rawPath.startsWith('/analytics/')) {
            path = '/analytics';
            routeParam = rawPath.replace('/analytics/', '');
        }

        const route = routes[path];
        
        if (route) {
            // Update breadcrumbs
            const breadcrumbs = document.getElementById('breadcrumbs');
            if (breadcrumbs) breadcrumbs.textContent = routeParam ? `${route.title} / ${routeParam.replace(/_/g, ' ')}` : route.title;

            // Render fresh view to prevent stale cache, stock counts, and vending mode state
            const mainContainer = document.getElementById('workspace-container');
            const loader = document.getElementById('app-loader');
            const shell = document.getElementById('app-shell');

            try {
                if (mainContainer) {
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
                // Hide the full-page loader and show app shell once the FIRST render is fully complete
                if (loader) loader.style.display = 'none';
                if (shell && shell.style.display === 'none') shell.style.display = 'flex';
                document.body.classList.remove('app-loading');
            }


            // Update active nav state
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            let activeNav = document.querySelector(`.nav-item[href="#${path}"]`);
            if (!activeNav && (path === '/workers' || path === '/workspace')) {
                activeNav = document.querySelector('.nav-item[data-route="workspace"]') || document.querySelector('.nav-item[data-route="workers"]');
            } else if (!activeNav && path.startsWith('/analytics')) {
                activeNav = document.querySelector('.nav-item[data-route="analytics"]');
            }
            if (activeNav) activeNav.classList.add('active');
            
            // Close context panel on route change
            const contextPanel = document.getElementById('context-panel');
            if (contextPanel) contextPanel.classList.remove('open');
        } else {
            // Default or Not Found
            window.location.hash = '#/overview';
        }
    };

    // Sidebar & Internal Navigation Link Click Interceptor for Instant Edit Safety
    document.addEventListener('click', async (e) => {
        const link = e.target.closest('a[href^="#/"]');
        if (!link) return;
        const targetHash = link.getAttribute('href');
        if (targetHash && targetHash !== currentRenderedHash && hasUnsavedChanges()) {
            e.preventDefault();
            e.stopPropagation();
            const allowLeave = await showAlert.confirmUnsavedChanges();
            if (allowLeave) {
                currentRenderedHash = targetHash;
                window.location.hash = targetHash;
            }
        }
    }, true);

    // Browser Refresh / Window Close Edit Safety Guard
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    window.addEventListener('hashchange', handleRoute);
    
    // Initial load
    await handleRoute();
};
