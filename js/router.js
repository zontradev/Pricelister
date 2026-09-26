/**
 * Simple SPA Router for Workspace
 */

import { renderOverview } from './workspace.js';
import { renderProducts } from './modules/products.js';
import { renderCategories } from './modules/categories.js';
import { renderPeople } from './modules/people.js';
import { renderInvoices } from './modules/invoices.js';
import { renderSettings } from './modules/settings.js';
import { renderWorkers } from './modules/workers.js';
import { renderProfile } from './modules/profile.js';
import { renderAnalyticsHub } from './modules/analyticsHub.js';
import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';

// Placeholders for remaining modules
const renderPlaceholder = (container, title) => {
    container.innerHTML = `
        <div class="module-header"><h2>${title}</h2></div>
        <div class="empty-state"><p>This module is under construction.</p></div>
    `;
};

const routes = {
    '/overview': { render: (c, w) => renderOverview(c, w), title: 'Workspace / Overview' },
    '/analytics': { render: (c, w, feat) => renderAnalyticsHub(c, w, feat), title: 'Workspace / Data Analytics' },
    '/products': { render: (c, w) => renderProducts(c, w), title: 'Products / All Products' },
    '/categories': { render: (c, w) => renderCategories(c, w), title: 'Products / Categories' },
    '/invoices/customer': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/invoices/business': { render: (c, w) => renderInvoices(c, w, true), title: 'Sales / Business Invoices' },
    '/customers': { render: (c, w) => renderPeople(c, w, 'customers'), title: 'People / Customers' },
    '/businesses': { render: (c, w) => renderPeople(c, w, 'businesses'), title: 'People / Businesses' },
    '/clients': { render: (c, w) => renderPeople(c, w, 'clients'), title: 'People / Clients' },
    '/workers': { render: (c, w) => renderWorkers(c, w), title: 'Settings / Workers' },
    '/settings': { render: (c, w) => renderSettings(c, w), title: 'Settings / General' },
    '/profile': { render: (c, w) => renderProfile(c, w), title: 'Account / My Profile' }
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

    const handleRoute = async () => {
        if (!currentWorkspaceId) return; // Wait for workspace
        
        const hash = window.location.hash || '#/overview';
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
            const activeNav = document.querySelector(`.nav-item[href="#${path}"]`) || document.querySelector(`.nav-item[data-route="analytics"]`);
            if (activeNav) activeNav.classList.add('active');
            
            // Close context panel on route change
            const contextPanel = document.getElementById('context-panel');
            if (contextPanel) contextPanel.classList.remove('open');
        } else {
            // Default or Not Found
            window.location.hash = '#/overview';
        }
    };

    window.addEventListener('hashchange', handleRoute);
    
    // Initial load
    await handleRoute();
};
