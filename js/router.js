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
    '/products': { render: (c, w) => renderProducts(c, w), title: 'Products / All Products' },
    '/categories': { render: (c, w) => renderCategories(c, w), title: 'Products / Categories' },
    '/invoices/customer': { render: (c, w) => renderInvoices(c, w, false), title: 'Sales / Customer Invoices' },
    '/invoices/business': { render: (c, w) => renderInvoices(c, w, true), title: 'Sales / Business Invoices' },
    '/customers': { render: (c, w) => renderPeople(c, w, 'customers'), title: 'People / Customers' },
    '/businesses': { render: (c, w) => renderPeople(c, w, 'businesses'), title: 'People / Businesses' },
    '/clients': { render: (c, w) => renderPeople(c, w, 'clients'), title: 'People / Clients' },
    '/workers': { render: (c, w) => renderWorkers(c, w), title: 'Settings / Workers' },
    '/settings': { render: (c, w) => renderSettings(c, w), title: 'Settings / General' }
};

export const initRouter = async () => {
    // Resolve current workspace ID once for the router
    const user = authService.getCurrentUser();
    if (!user) return; // Prevent routing if not logged in
    
    let currentWorkspaceId = null;
    try {
        const ws = await firestoreService.checkWorkspaceExists(user.uid);
        if (ws) currentWorkspaceId = ws.id;
    } catch (e) {
        console.error("Failed to load workspace for router", e);
    }

    const routeCache = {};

    const handleRoute = async () => {
        if (!currentWorkspaceId) return; // Wait for workspace
        
        const hash = window.location.hash || '#/overview';
        const path = hash.substring(1);
        
        const route = routes[path];
        
        if (route) {
            // Update breadcrumbs
            const breadcrumbs = document.getElementById('breadcrumbs');
            if (breadcrumbs) breadcrumbs.textContent = route.title;

            // Render content using DOM Cache
            const mainContainer = document.getElementById('workspace-container');
            if (mainContainer) {
                // Hide all currently cached route views
                Array.from(mainContainer.children).forEach(child => {
                    child.style.display = 'none';
                });
                
                if (routeCache[path]) {
                    // Show cached container instantly
                    routeCache[path].style.display = 'block';
                } else {
                    // Create new container for this route and render
                    const routeContainer = document.createElement('div');
                    routeContainer.className = 'route-view';
                    
                    // Show local loading state if not the very first load
                    if (document.getElementById('app-shell').style.display !== 'none') {
                        routeContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading data...</div>';
                    }
                    
                    mainContainer.appendChild(routeContainer);
                    routeCache[path] = routeContainer;
                    
                    await route.render(routeContainer, currentWorkspaceId);
                }
            }
            
            // Hide the full-page loader and show app shell once the FIRST render is fully complete
            const loader = document.getElementById('app-loader');
            const shell = document.getElementById('app-shell');
            if (loader) loader.style.display = 'none';
            if (shell && shell.style.display === 'none') shell.style.display = 'flex';

            // Update active nav state
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const activeNav = document.querySelector(`.nav-item[href="#${path}"]`);
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
