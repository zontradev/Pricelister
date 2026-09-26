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
import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';

import { showAlert } from './alert-handler.js';

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
        // 1. Settings Module: Save Workspace Settings or Change Currency buttons enabled
        const btnSaveSettings = document.getElementById('btn-save-settings');
        const btnChangeCurr = document.getElementById('btn-change-currency');
        if ((btnSaveSettings && !btnSaveSettings.disabled) || (btnChangeCurr && !btnChangeCurr.disabled)) {
            return true;
        }

        // 2. Product Form: Form open with unsaved product edits or new input
        const prdFormContainer = document.getElementById('product-form-container');
        const prdSubmitBtn = document.getElementById('prd-submit-btn');
        if (prdFormContainer && prdFormContainer.style.display !== 'none') {
            if (prdSubmitBtn && !prdSubmitBtn.disabled) return true;
        }

        // 3. Category Form: Form open with unsaved changes
        const catFormContainer = document.getElementById('category-form-container');
        const catSubmitBtn = document.getElementById('cat-submit-btn');
        if (catFormContainer && catFormContainer.style.display !== 'none') {
            if (catSubmitBtn && !catSubmitBtn.disabled) return true;
        }

        // 5. Worker Permissions Manage Form: Form open with modified permissions
        const workerSaveBtn = document.getElementById('btn-save-manage');
        const manageWorkerContainer = document.getElementById('manage-worker-container');
        if (manageWorkerContainer && manageWorkerContainer.style.display !== 'none') {
            if (workerSaveBtn && !workerSaveBtn.disabled) return true;
        }

        // 6. Market Inserter: Open grid with pending rows
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
    '/workers': { render: (c, w) => renderWorkers(c, w), title: 'Settings / Workers' },
    '/settings': { render: (c, w) => renderSettings(c, w), title: 'Settings / General' },
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
            if (mainContainer) {
                mainContainer.innerHTML = '';
                const routeContainer = document.createElement('div');
                routeContainer.className = 'route-view';
                mainContainer.appendChild(routeContainer);
                await route.render(routeContainer, currentWorkspaceId, routeParam);
            }
            
            // Hide the full-page loader and show app shell once the FIRST render is fully complete
            const loader = document.getElementById('app-loader');
            const shell = document.getElementById('app-shell');
            if (loader) loader.style.display = 'none';
            if (shell && shell.style.display === 'none') shell.style.display = 'flex';

            // Update active nav state
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            let activeNav = document.querySelector(`.nav-item[href="#${path}"]`);
            if (!activeNav && path.startsWith('/analytics')) {
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
