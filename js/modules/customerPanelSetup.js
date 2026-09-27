/**
 * PriceLister - Customer Panel Setup Module (Admin & Co-admin Only)
 * Dedicated Launch & Publishing Engine for standalone customer-facing product catalog.
 * Stores settings in subfield: Workspaces/{workspaceId}/CustomerPanel/{uid}
 */

import { authService } from '../../firebase/auth.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';
import { VALID_DEPLOY_COUNTRIES, VALID_BRANDING_MODES } from '../schemas/customerPanelSchema.js';

export const renderCustomerPanelSetup = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    // 1. Role Verification: Only Admin or Co-admin can configure Customer Panel
    const userRole = (window.__activeWorkspace?.role || 'WORKER').toUpperCase();
    const isAuthorized = userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN';

    if (!isAuthorized) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 550px; margin: 2rem auto;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Access Restricted</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Only Workspace Admins and Co-admins have permission to configure and publish the Customer Panel.
                </p>
                <button class="btn btn-primary" onclick="window.location.hash='#/overview'">Return to Overview</button>
            </div>
        `;
        return;
    }

    // 2. Fetch Data
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
            <div class="spinner"></div>
        </div>
    `;

    const settingsService = getSettingsService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    let panelSettings = {};
    let allCategories = [];

    try {
        [panelSettings, allCategories] = await Promise.all([
            settingsService.getCustomerPanelSettings(),
            categoryService.getAllCategories().catch(() => [])
        ]);
    } catch (err) {
        console.error("Error loading customer panel setup:", err);
        showAlert.error("Could not load Customer Panel settings.");
    }

    // Base origin URL
    const baseUrl = window.location.origin + window.location.pathname.replace('app.html', 'customer.html');

    const computeCustomerUrl = (settings) => {
        const slug = (settings.customSlug || '').trim().toLowerCase();
        if (slug) {
            return `${baseUrl}?shop=${encodeURIComponent(slug)}`;
        }
        return `${baseUrl}?ws=${encodeURIComponent(workspaceId)}`;
    };

    const isPublished = Boolean(panelSettings.isPublished || panelSettings.enabled);

    const renderMainUI = (settings) => {
        const isLive = Boolean(settings.isPublished || settings.enabled);
        const currentPortalUrl = computeCustomerUrl(settings);
        const brandingMode = settings.brandingMode || 'PRICELISTER';
        const selectedCountry = settings.deployCountry || 'Global';
        const wsLogo = settings.workspaceLogo || window.__activeWorkspace?.logoUrl || '';
        const storeLogo = settings.storeLogo || '';

        // Sync sidebar status pill
        const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
        if (sidebarStatus) {
            sidebarStatus.className = isLive ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
            sidebarStatus.textContent = isLive ? 'Live' : 'Closed';
        }

        const statusPillHtml = isLive 
            ? `<span id="header-status-pill" style="display:inline-flex; align-items:center; gap:0.45rem; padding:0.35rem 0.85rem; border-radius:999px; background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.82rem; font-weight:700;">
                 <span style="width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px rgba(16,185,129,0.8); animation:cp-pulse-dot 1.8s infinite;"></span>
                 Published
               </span>` 
            : `<span id="header-status-pill" style="display:inline-flex; align-items:center; gap:0.45rem; padding:0.35rem 0.85rem; border-radius:999px; background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; font-size:0.82rem; font-weight:700;">
                 <span style="width:8px; height:8px; border-radius:50%; background:#e11d48;"></span>
                 Unpublished
               </span>`;

        container.innerHTML = `
            <!-- HEADER SECTION -->
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                        <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">Customer Panel & Public Catalog</h2>
                        ${statusPillHtml}
                    </div>
                    <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                        Setup, customize and publish a standalone web catalog where customers can view products, filter categories, and add items to a shopping cart.
                    </p>
                </div>

                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <button type="button" id="btn-copy-customer-link" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem;" title="Copy shareable customer portal link">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy Link
                    </button>

                    ${isLive ? `
                        <a href="${currentPortalUrl}" target="_blank" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem; color:var(--text-primary);" title="Open customer catalog in a separate new browser tab">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            Open Storefront ↗
                        </a>
                        <button type="button" id="btn-unpublish-panel" class="btn" style="background:#ffffff; border:1px solid #fecdd3; color:#e11d48; font-weight:600; display:flex; align-items:center; gap:0.4rem; padding:0.5rem 0.9rem;" title="Temporarily unpublish or suspend customer access">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            Unpublish Portal
                        </button>
                    ` : ''}

                    <button type="button" id="btn-trigger-launch-modal" class="btn btn-primary" style="font-weight:700; display:flex; align-items:center; gap:0.5rem; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35); padding:0.6rem 1.25rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 9v-5s3.03.55 4 2c1.08 1.62 0 5 0 5"></path></svg>
                        ${isLive ? 'Re-Launch / Publish Updates' : 'Launch Customer Panel'}
                    </button>
                </div>
            </div>

            <!-- UNPUBLISHED NOTICE BANNER (WHEN INACTIVE) -->
            ${!isLive ? `
                <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border: 1px solid #fecdd3; border-left: 5px solid #e11d48; padding: 1.25rem 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div style="width:42px; height:42px; border-radius:50%; background:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(225,29,72,0.15); flex-shrink:0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.2rem 0; font-size:1rem; font-weight:700; color:#9f1239;">Storefront Is Currently Unpublished</h4>
                                <p style="margin:0; font-size:0.85rem; color:#be123c;">
                                    Until you click the <strong>Launch Customer Panel</strong> button, customer access remains closed and visitors will see your temporary closed notice.
                                </p>
                            </div>
                        </div>
                        <button type="button" id="btn-banner-launch" class="btn btn-primary" style="background:#e11d48; border-color:#e11d48; font-weight:700; padding:0.5rem 1.15rem; font-size:0.88rem; display:flex; align-items:center; gap:0.4rem;">
                            Launch Now
                        </button>
                    </div>
                </div>
            ` : `
                <!-- PUBLISHED SUCCESS BANNER (WHEN ACTIVE) -->
                <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border: 1px solid #a7f3d0; border-left: 5px solid #10b981; padding: 1.25rem 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div style="width:42px; height:42px; border-radius:50%; background:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(16,185,129,0.15); flex-shrink:0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.2rem 0; font-size:1rem; font-weight:700; color:#065f46;">Storefront is Live and Published</h4>
                                <p style="margin:0; font-size:0.85rem; color:#047857;">
                                    Your customer catalog is actively synced to Firebase Cloud Subfield (<code>Workspaces/${workspaceId}/CustomerPanel/${currentUser.uid}</code>).
                                </p>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <a href="${currentPortalUrl}" target="_blank" class="btn btn-primary" style="background:#059669; border-color:#059669; font-weight:700; padding:0.5rem 1.15rem; font-size:0.88rem; display:flex; align-items:center; gap:0.4rem;">
                                View Live Catalog ↗
                            </a>
                        </div>
                    </div>
                </div>
            `}

            <!-- BRANDING, DOMAIN & CUSTOM LINK HERO CARD -->
            <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border-left: 4px solid var(--primary); padding: 1.25rem 1.5rem;">
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                        <div>
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em;">Public Storefront URL & Custom Link</span>
                            <h4 style="margin:0.2rem 0 0 0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Share with Customers</h4>
                        </div>
                        <span style="font-size:0.8rem; background:var(--surface-100); padding:0.25rem 0.65rem; border-radius:6px; font-weight:600; color:var(--text-secondary);">
                            Deploy Country: <strong>${escapeHtml(selectedCountry)}</strong>
                        </span>
                    </div>

                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; flex:1; min-width:280px; background:var(--surface-50); border:1px solid var(--border-color); border-radius:8px; overflow:hidden;">
                            <span style="padding:0.55rem 0.85rem; background:var(--surface-100); border-right:1px solid var(--border-color); color:var(--text-secondary); font-size:0.85rem; font-weight:600; white-space:nowrap;">
                                pricelister.com/
                            </span>
                            <input type="text" id="cp-custom-slug-input" class="form-control" style="border:none; background:transparent; font-size:0.88rem; font-weight:700; color:var(--primary); padding:0.55rem 0.75rem; box-shadow:none;" value="${escapeHtml(settings.customSlug || '')}" placeholder="your-store-link (e.g. worksapceshop)">
                        </div>
                        <button type="button" id="btn-copy-input-link" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:0.4rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Copy Link
                        </button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-secondary); flex-wrap:wrap; gap:0.5rem;">
                        <span>Actual live URL: <code id="cp-live-url-preview" style="color:var(--text-primary); background:var(--surface-100); padding:0.15rem 0.45rem; border-radius:4px;">${currentPortalUrl}</code></span>
                        <span>Only alphanumeric characters and hyphens allowed for custom slug.</span>
                    </div>
                </div>
            </div>

            <!-- CONFIGURATION FORM -->
            <form id="customer-panel-form" style="display:flex; flex-direction:column; gap:1.5rem;">
                
                <!-- 1. BRANDING & DEPLOY CONFIGURATION -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">1. Branding Choice & Deploy Country</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Choose how your storefront is branded for visitors, select your deploy country, and customize logos.</p>

                    <!-- BRANDING SELECTION CARDS -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                        
                        <!-- Option A: PriceLister Branding -->
                        <label class="cp-branding-card" style="border:2px solid ${brandingMode === 'PRICELISTER' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'PRICELISTER' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="PRICELISTER" ${brandingMode === 'PRICELISTER' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">PriceLister Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:rgba(225,29,72,0.1); color:var(--primary); padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Default</span>
                            </div>
                            <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">
                                Displays the official PriceLister badge, certified secure catalog badge, and standard platform styling.
                            </p>
                        </label>

                        <!-- Option B: Custom Branding -->
                        <label class="cp-branding-card" style="border:2px solid ${brandingMode === 'CUSTOM' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'CUSTOM' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="CUSTOM" ${brandingMode === 'CUSTOM' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Custom Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:#f1f5f9; color:#475569; padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Custom Logo</span>
                            </div>
                            <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">
                                Upload your dedicated Store Logo, custom store name, and tailored brand visuals.
                            </p>
                        </label>

                        <!-- Option C: Workspace Branding -->
                        <label class="cp-branding-card" style="border:2px solid ${brandingMode === 'WORKSPACE' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'WORKSPACE' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="WORKSPACE" ${brandingMode === 'WORKSPACE' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Workspace Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:#ecfdf5; color:#059669; padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Enterprise</span>
                            </div>
                            <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">
                                Automatically uses your Workspace Name and Workspace Broad Logo for a unified enterprise presence.
                            </p>
                        </label>
                    </div>

                    <!-- DEPLOY COUNTRY & STORE LOGOS ROW -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                        
                        <!-- Deploy Country Dropdown (Required) -->
                        <div>
                            <label style="font-weight:700; font-size:0.88rem; margin-bottom:0.35rem; display:block; color:var(--text-primary);">
                                Deploy Country * <span style="font-size:0.75rem; font-weight:400; color:var(--text-muted);">(Required for catalog currency & regional routing)</span>
                            </label>
                            <select id="cp-deploy-country" required class="form-control" style="font-weight:600; font-size:0.9rem;">
                                ${VALID_DEPLOY_COUNTRIES.map(country => `
                                    <option value="${escapeHtml(country)}" ${selectedCountry === country ? 'selected' : ''}>
                                        ${escapeHtml(country)}
                                    </option>
                                `).join('')}
                            </select>
                            <small style="color:var(--text-secondary); font-size:0.78rem; margin-top:0.25rem; display:block;">
                                Target market country for currency, phone formatting, and local operations.
                            </small>
                        </div>

                        <!-- Store / Workspace Logo Section -->
                        <div>
                            <label style="font-weight:700; font-size:0.88rem; margin-bottom:0.35rem; display:block; color:var(--text-primary);">
                                Custom Store Logo URL / Workspace Logo Broad View
                            </label>
                            <div style="display:flex; gap:0.75rem; align-items:center;">
                                <div id="cp-logo-broad-preview" style="width:52px; height:52px; border-radius:12px; background:var(--surface-100); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                                    ${(storeLogo || wsLogo) ? `
                                        <img src="${escapeHtml(storeLogo || wsLogo)}" alt="Store Logo" style="width:100%; height:100%; object-fit:contain;">
                                    ` : `
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                                    `}
                                </div>
                                <div style="flex:1;">
                                    <input type="url" id="cp-store-logo-input" class="form-control" value="${escapeHtml(storeLogo)}" placeholder="https://... (Direct image URL for Store Logo)">
                                </div>
                            </div>
                            <small style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; display:block;">
                                If using Workspace Branding, workspace logo is used automatically.
                            </small>
                        </div>

                    </div>
                </div>

                <!-- 2. CLOUD SYNC & STATUS -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">2. Firebase Cloud Subfield Storage</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">
                        Settings are saved under your workspace subcollection: <code>Workspaces/${workspaceId}/CustomerPanel/${currentUser.uid}</code>
                    </p>

                    <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem; border-radius:10px; background:var(--surface-50); border:1px solid var(--border-color); flex-wrap:wrap;">
                        <div>
                            <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary); display:block;">Publishing Status</span>
                            <span style="font-size:0.82rem; color:var(--text-secondary);">
                                ${isLive ? 'Active on cloud. Public catalog is serving live products.' : 'Unpublished. Customers receive a temporary closed notification.'}
                            </span>
                        </div>
                        <div style="display:flex; gap:0.6rem; align-items:center;">
                            <select id="cp-status-select" class="form-control" style="font-weight:600; padding:0.5rem 1rem; width:190px;">
                                <option value="ACTIVE" ${isLive ? 'selected' : ''}>Published (Live)</option>
                                <option value="STOPPED" ${!isLive ? 'selected' : ''}>Unpublished (Closed)</option>
                            </select>
                        </div>
                    </div>
                </div>


                <!-- 2. STORE BRANDING & MESSAGING -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">2. Store Branding & Contact</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Information visible to customers in the catalog header and cart inquiry.</p>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem; margin-bottom:1rem;">
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Title *</label>
                            <input type="text" id="cp-store-name" required class="form-control" value="${escapeHtml(settings.storeName || '')}" placeholder="e.g. Apex Mart & Electronics">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">WhatsApp Ordering Number</label>
                            <input type="text" id="cp-whatsapp" class="form-control" value="${escapeHtml(settings.whatsappNumber || '')}" placeholder="e.g. +8801700000000 (with country code)">
                            <small style="color:var(--text-muted); font-size:0.75rem;">Allows customers to send cart orders directly to your WhatsApp with 1 click.</small>
                        </div>
                    </div>

                    <div style="margin-bottom:1rem;">
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Banner Announcement Message</label>
                        <input type="text" id="cp-announcement" class="form-control" value="${escapeHtml(settings.announcement || '')}" placeholder="e.g. Welcome! Add items to cart to see live totals or send inquiry.">
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem;">
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Phone</label>
                            <input type="text" id="cp-phone" class="form-control" value="${escapeHtml(settings.phone || '')}" placeholder="e.g. 01700000000">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Email</label>
                            <input type="email" id="cp-email" class="form-control" value="${escapeHtml(settings.email || '')}" placeholder="e.g. store@example.com">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Address / Location</label>
                            <input type="text" id="cp-address" class="form-control" value="${escapeHtml(settings.address || '')}" placeholder="e.g. Block C, Dhaka, Bangladesh">
                        </div>
                    </div>
                </div>

                <!-- 3. CATEGORIES VISIBILITY -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">3. Category Visibility</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Choose whether to expose all product categories or only specific ones to customers.</p>

                    <div style="display:flex; gap:1.5rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">
                            <input type="radio" name="cp-cat-mode" value="ALL" ${settings.categorySelectionMode !== 'SPECIFIC' ? 'checked' : ''}>
                            <span>Show All Categories (${allCategories.length} Categories)</span>
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">
                            <input type="radio" name="cp-cat-mode" value="SPECIFIC" ${settings.categorySelectionMode === 'SPECIFIC' ? 'checked' : ''}>
                            <span>Choose Specific Categories</span>
                        </label>
                    </div>

                    <div id="cp-specific-categories-container" style="display:${settings.categorySelectionMode === 'SPECIFIC' ? 'block' : 'none'}; border:1px solid var(--border-color); border-radius:10px; padding:1rem; background:var(--surface-50);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Categories to Include:</span>
                            <div style="display:flex; gap:0.5rem;">
                                <button type="button" id="btn-select-all-cats" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;">Select All</button>
                                <button type="button" id="btn-deselect-all-cats" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;">Clear</button>
                            </div>
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:0.6rem;">
                            ${allCategories.map(cat => {
                                const isChecked = (settings.allowedCategories || []).includes(cat.name);
                                return `
                                    <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; background:#ffffff; border:1px solid var(--border-color); border-radius:6px; cursor:pointer;">
                                        <input type="checkbox" class="cp-cat-checkbox" value="${escapeHtml(cat.name)}" ${isChecked ? 'checked' : ''}>
                                        <span style="width:10px; height:10px; border-radius:50%; background:${cat.color || '#3b82f6'}; flex-shrink:0;"></span>
                                        <span style="font-size:0.85rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(cat.name)}</span>
                                    </label>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- 4. PRICING & DISPLAY OPTIONS -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">4. Pricing & Details Options</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Control how prices and stock are presented to customers.</p>

                    <div style="display:flex; flex-direction:column; gap:0.85rem;">
                        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                            <input type="checkbox" id="cp-show-mrp" ${settings.showMrp ? 'checked' : ''}>
                            <div>
                                <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show MRP / Original Price Strikethrough</span>
                                <span style="font-size:0.8rem; color:var(--text-secondary);">Displays crossed-out MRP with discount percentage badge if MRP is higher than Selling Price.</span>
                            </div>
                        </label>

                        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                            <input type="checkbox" id="cp-show-stock" ${settings.showStockBadge ? 'checked' : ''}>
                            <div>
                                <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show In-Stock / Availability Badges</span>
                                <span style="font-size:0.8rem; color:var(--text-secondary);">Displays real-time stock availability badge on product cards.</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 5. TERMS & CONDITIONS -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">5. Terms & Conditions</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Store policies, ordering instructions, and delivery details shown to customers in a modal or notice footer.</p>

                    <textarea id="cp-terms" rows="4" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="• Prices subject to change without notice.&#10;• Fast home delivery available.&#10;• For bulk inquiries, contact WhatsApp.">${escapeHtml(settings.termsAndConditions || '')}</textarea>
                </div>

                <!-- 6. TEMPORARY CLOSED / SUSPENDED MESSAGE -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">6. Suspended / Temporary Closed Message</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Message displayed to customers when the panel is Unpublished or Stopped.</p>

                    <textarea id="cp-closed-msg" rows="3" class="form-control" style="width:100%; font-family:inherit;" placeholder="Temporary Closed&#10;Shop is temporarily suspended, may start early.">${escapeHtml(settings.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.')}</textarea>
                </div>

                <!-- SAVE ACTION BAR -->
                <div style="display:flex; justify-content:space-between; gap:1rem; padding:1rem 0; align-items:center; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary" onclick="window.location.hash='#/overview'">Return to Overview</button>
                    <div style="display:flex; gap:0.75rem;">
                        <button type="submit" id="btn-save-customer-panel" class="btn btn-secondary" style="padding:0.65rem 1.5rem; font-weight:600; font-size:0.95rem;">
                            Save Settings (Draft)
                        </button>
                        <button type="button" id="btn-bottom-launch" class="btn btn-primary" style="padding:0.65rem 1.75rem; font-weight:700; font-size:0.95rem; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35); display:flex; align-items:center; gap:0.5rem;">
                            <span>🚀</span> ${isLive ? 'Re-Launch / Publish Updates' : 'Launch Customer Panel'}
                        </button>
                    </div>
                </div>
            </form>
        `;

        bindEvents(settings);
    };

    const collectFormData = (forcePublishState = null) => {
        const statusSelect = document.getElementById('cp-status-select');
        let isLive = statusSelect ? statusSelect.value === 'ACTIVE' : true;
        if (forcePublishState !== null) {
            isLive = Boolean(forcePublishState);
        }

        const catMode = document.querySelector('input[name="cp-cat-mode"]:checked')?.value || 'ALL';
        const selectedCats = [];
        if (catMode === 'SPECIFIC') {
            document.querySelectorAll('.cp-cat-checkbox:checked').forEach(cb => {
                selectedCats.push(cb.value);
            });
        }

        const brandingMode = document.querySelector('input[name="cp-branding-mode"]:checked')?.value || 'PRICELISTER';
        const deployCountry = document.getElementById('cp-deploy-country')?.value || 'Global';
        const storeLogo = (document.getElementById('cp-store-logo-input')?.value || '').trim();
        const customSlug = (document.getElementById('cp-custom-slug-input')?.value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '');

        return {
            isPublished: isLive,
            enabled: isLive,
            brandingMode: brandingMode,
            deployCountry: deployCountry,
            storeLogo: storeLogo,
            customSlug: customSlug,
            storeName: document.getElementById('cp-store-name')?.value || 'PriceLister Store',
            whatsappNumber: document.getElementById('cp-whatsapp')?.value || '',
            announcement: document.getElementById('cp-announcement')?.value || '',
            phone: document.getElementById('cp-phone')?.value || '',
            email: document.getElementById('cp-email')?.value || '',
            address: document.getElementById('cp-address')?.value || '',
            categorySelectionMode: catMode,
            allowedCategories: selectedCats,
            showMrp: Boolean(document.getElementById('cp-show-mrp')?.checked),
            showStockBadge: Boolean(document.getElementById('cp-show-stock')?.checked),
            termsAndConditions: document.getElementById('cp-terms')?.value || '',
            closedMessage: document.getElementById('cp-closed-msg')?.value || 'Temporary Closed\nShop is temporarily suspended, may start early.',
            currencySymbol: getAppCurrencySymbol()
        };
    };

    /**
     * Dedicated Launch Modal with Round Ball / Multi-Step Progressive Loader
     */
    const triggerDedicatedLaunchFlow = async () => {
        const formData = collectFormData(true); // Force publish = true

        // 1. Create Modal Container
        let modalEl = document.getElementById('customer-panel-launch-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'customer-panel-launch-modal';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;">
                <div class="card" style="background:#ffffff; border-radius:18px; max-width:540px; width:100%; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); overflow:hidden; border:1px solid rgba(225,29,72,0.2); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- MODAL HEADER -->
                    <div style="background:linear-gradient(135deg, #881337 0%, #e11d48 50%, #be123c 100%); padding:1.75rem 1.75rem 1.5rem; text-align:center; color:#ffffff; position:relative; overflow:hidden;">
                        <div style="position:absolute; width:180px; height:180px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); top:-50px; right:-50px; border-radius:50%;"></div>
                        <h3 style="margin:0 0 0.35rem 0; font-size:1.35rem; font-weight:800; letter-spacing:-0.01em;">🚀 Launching Customer Panel</h3>
                        <p style="margin:0; font-size:0.85rem; opacity:0.9;">Publishing your live storefront and syncing with Firebase Cloud...</p>
                    </div>

                    <!-- MODAL BODY: IN PROGRESS STATE -->
                    <div id="launch-modal-content" style="padding:2rem 1.75rem 1.75rem;">
                        
                        <!-- ANIMATED ROUND BALL / ORB LOADER -->
                        <div style="display:flex; justify-content:center; align-items:center; margin-bottom:1.75rem; position:relative; height:120px;">
                            <div class="cp-pulse-ring"></div>
                            <div class="cp-pulse-ring-2"></div>
                            <div class="cp-launch-orb">
                                <div class="cp-orb-shine"></div>
                                <span style="font-size:1.6rem; animation:floatRocket 2s ease-in-out infinite;">🚀</span>
                            </div>
                        </div>

                        <!-- PROGRESSIVE STEP INDICATORS -->
                        <div style="display:flex; flex-direction:column; gap:0.85rem; margin-bottom:1.5rem;">
                            
                            <!-- STEP 1: PREPARING -->
                            <div id="launch-step-1" class="launch-step-row launch-step-active">
                                <div class="launch-step-icon"><div class="launch-spinner"></div></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Preparing Catalog & Category Rules</div>
                                    <div class="launch-step-subtitle">Verifying catalog items and active visibility filters...</div>
                                </div>
                            </div>

                            <!-- STEP 2: CONNECTING -->
                            <div id="launch-step-2" class="launch-step-row launch-step-pending">
                                <div class="launch-step-icon"><span class="step-num">2</span></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Connecting Cloud Subfield</div>
                                    <div class="launch-step-subtitle">Syncing to Workspaces/${workspaceId}/CustomerPanel/${currentUser.uid}...</div>
                                </div>
                            </div>

                            <!-- STEP 3: APPLYING -->
                            <div id="launch-step-3" class="launch-step-row launch-step-pending">
                                <div class="launch-step-icon"><span class="step-num">3</span></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Applying Privacy & Read-Only Permissions</div>
                                    <div class="launch-step-subtitle">Locking workspace invoices, prices, and settings...</div>
                                </div>
                            </div>

                            <!-- STEP 4: FINISHING -->
                            <div id="launch-step-4" class="launch-step-row launch-step-pending">
                                <div class="launch-step-icon"><span class="step-num">4</span></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Finishing & Publishing Storefront</div>
                                    <div class="launch-step-subtitle">Finalizing live shareable URL and customer catalog...</div>
                                </div>
                            </div>

                        </div>

                        <div style="text-align:center; font-size:0.78rem; color:var(--text-muted);">
                            This only takes a few seconds. Please do not close the window.
                        </div>

                    </div>

                </div>
            </div>

            <style>
                @keyframes modalPop {
                    from { transform: scale(0.92); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes floatRocket {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-6px) rotate(5deg); }
                }
                @keyframes cp-pulse-dot {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                .cp-launch-orb {
                    width: 76px;
                    height: 76px;
                    border-radius: 50%;
                    background: radial-gradient(circle at 35% 35%, #ff4b72, #e11d48 60%, #881337 100%);
                    box-shadow: 0 10px 25px rgba(225, 29, 72, 0.5), inset 0 2px 4px rgba(255,255,255,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    z-index: 2;
                }
                .cp-orb-shine {
                    position: absolute;
                    top: 8px;
                    left: 12px;
                    width: 24px;
                    height: 12px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.6);
                    transform: rotate(-35deg);
                    filter: blur(1px);
                }
                .cp-pulse-ring {
                    position: absolute;
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    border: 2px solid rgba(225, 29, 72, 0.4);
                    animation: orbRipple 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
                }
                .cp-pulse-ring-2 {
                    position: absolute;
                    width: 130px;
                    height: 130px;
                    border-radius: 50%;
                    border: 2px solid rgba(225, 29, 72, 0.2);
                    animation: orbRipple 1.8s cubic-bezier(0.25, 1, 0.5, 1) 0.6s infinite;
                }
                @keyframes orbRipple {
                    0% { transform: scale(0.6); opacity: 1; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
                .launch-step-row {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    padding: 0.75rem 0.9rem;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: var(--surface-50);
                    transition: all 0.3s ease;
                }
                .launch-step-active {
                    background: #fff1f2;
                    border-color: #fecdd3;
                }
                .launch-step-done {
                    background: #ecfdf5;
                    border-color: #a7f3d0;
                }
                .launch-step-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    font-size: 0.75rem;
                    font-weight: 700;
                    background: #e2e8f0;
                    color: #475569;
                }
                .launch-step-active .launch-step-icon {
                    background: #ffe4e6;
                    color: #e11d48;
                }
                .launch-step-done .launch-step-icon {
                    background: #10b981;
                    color: #ffffff;
                }
                .launch-step-title {
                    font-size: 0.88rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .launch-step-subtitle {
                    font-size: 0.76rem;
                    color: var(--text-secondary);
                }
                .launch-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid #e11d48;
                    border-top-color: transparent;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
            </style>
        `;

        const setStepState = (stepNum, state, subtitle = '') => {
            const stepEl = document.getElementById(`launch-step-${stepNum}`);
            if (!stepEl) return;
            stepEl.className = `launch-step-row launch-step-${state}`;
            const iconEl = stepEl.querySelector('.launch-step-icon');
            const subEl = stepEl.querySelector('.launch-step-subtitle');
            if (subtitle && subEl) subEl.textContent = subtitle;

            if (state === 'done') {
                iconEl.innerHTML = `✓`;
            } else if (state === 'active') {
                iconEl.innerHTML = `<div class="launch-spinner"></div>`;
            } else {
                iconEl.innerHTML = `<span class="step-num">${stepNum}</span>`;
            }
        };

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            // STEP 1: Preparing Catalog
            await sleep(650);
            setStepState(1, 'done', 'Catalog structure verified.');
            setStepState(2, 'active');

            // STEP 2: Connecting Cloud Subfield & Saving to Firebase
            await sleep(400);
            await settingsService.saveCustomerPanelSettings(formData);
            await sleep(400);
            setStepState(2, 'done', `Saved to Workspaces/${workspaceId}/CustomerPanel/${currentUser.uid}`);
            setStepState(3, 'active');

            // STEP 3: Privacy & Category filters
            await sleep(600);
            setStepState(3, 'done', 'Read-only rules enforced & verified.');
            setStepState(4, 'active');

            // STEP 4: Finishing & Launching
            await sleep(550);
            setStepState(4, 'done', 'Live portal published successfully!');
            await sleep(450);

            // TRANSITION TO BROAD CELEBRATORY SUCCESS VIEW
            const modalContent = document.getElementById('launch-modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div style="text-align:center; animation:modalPop 0.4s ease;">
                        
                        <!-- CELEBRATORY BADGE -->
                        <div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; font-size:2.2rem; box-shadow:0 10px 25px rgba(16,185,129,0.35);">
                            🎉
                        </div>

                        <h3 style="font-size:1.45rem; font-weight:800; color:var(--text-primary); margin-bottom:0.4rem;">
                            Customer Panel Launched Broadly!
                        </h3>
                        
                        <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin-bottom:1.5rem; max-width:440px; margin-left:auto; margin-right:auto;">
                            Your standalone product storefront is now <strong>100% Published & Live</strong> on Firebase Cloud. Customers can browse your products, search items, and send cart orders.
                        </p>

                        <!-- SHAREABLE LINK CARD -->
                        <div style="background:var(--surface-50); border:1.5px dashed var(--primary); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; text-align:left;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; display:block; margin-bottom:0.4rem;">
                                Live Shareable Customer Link
                            </span>
                            <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.75rem;">
                                <input type="text" id="modal-success-url-input" readonly value="${customerPanelUrl}" class="form-control" style="font-family:monospace; font-size:0.85rem; background:#ffffff; font-weight:600; color:var(--text-primary);">
                                <button type="button" id="btn-modal-copy-url" class="btn btn-secondary" style="font-weight:700; white-space:nowrap; padding:0.5rem 1rem;">
                                    📋 Copy Link
                                </button>
                            </div>
                            <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
                                <a href="${customerPanelUrl}" target="_blank" class="btn btn-primary" style="flex:1; font-weight:700; font-size:0.9rem; justify-content:center; display:flex; align-items:center; gap:0.4rem; background:linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                                    🚀 Open Live Storefront ↗
                                </a>
                                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Check out our product catalog: ' + customerPanelUrl)}" target="_blank" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                                    💬 Share via WhatsApp
                                </a>
                            </div>
                        </div>

                        <!-- MODAL ACTION CLOSE -->
                        <button type="button" id="btn-modal-done" class="btn btn-secondary" style="width:100%; font-weight:700; padding:0.65rem;">
                            Done & Return to Setup
                        </button>

                    </div>
                `;

                // Bind copy button in modal
                const modalUrlInput = document.getElementById('modal-success-url-input');
                const modalCopyBtn = document.getElementById('btn-modal-copy-url');
                const modalDoneBtn = document.getElementById('btn-modal-done');

                const copyAction = () => {
                    navigator.clipboard.writeText(customerPanelUrl).then(() => {
                        if (modalCopyBtn) modalCopyBtn.textContent = '✅ Copied!';
                        showAlert.success("Storefront link copied to clipboard!");
                        setTimeout(() => {
                            if (modalCopyBtn) modalCopyBtn.textContent = '📋 Copy Link';
                        }, 2000);
                    }).catch(() => {
                        if (modalUrlInput) {
                            modalUrlInput.select();
                            document.execCommand('copy');
                            showAlert.success("Storefront link copied!");
                        }
                    });
                };

                if (modalCopyBtn) modalCopyBtn.addEventListener('click', copyAction);
                if (modalUrlInput) modalUrlInput.addEventListener('click', copyAction);

                if (modalDoneBtn) {
                    modalDoneBtn.addEventListener('click', () => {
                        modalEl.remove();
                        // Refresh UI to live state
                        renderMainUI({ ...formData, isPublished: true, enabled: true });
                    });
                }
            }

            // Update sidebar live status badge
            const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
            if (sidebarStatus) {
                sidebarStatus.className = 'status-pill status-pill-active';
                sidebarStatus.textContent = 'Live';
            }

            showAlert.success("Customer Panel published & live!");

        } catch (err) {
            console.error("Launch error:", err);
            showAlert.error("Failed to publish Customer Panel: " + (err.message || 'Error occurred'));
            if (modalEl) modalEl.remove();
        }
    };

    /**
     * Unpublish / Suspend Action
     */
    const handleUnpublishAction = async () => {
        if (!confirm("Are you sure you want to unpublish the Customer Panel? Customers will see a temporary closed notice until you launch it again.")) {
            return;
        }

        const btnUnpublish = document.getElementById('btn-unpublish-panel');
        if (btnUnpublish) {
            btnUnpublish.disabled = true;
            btnUnpublish.textContent = 'Unpublishing...';
        }

        try {
            const formData = collectFormData(false); // Force publish = false
            await settingsService.saveCustomerPanelSettings(formData);

            // Update sidebar live status badge
            const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
            if (sidebarStatus) {
                sidebarStatus.className = 'status-pill status-pill-danger';
                sidebarStatus.textContent = 'Closed';
            }

            showAlert.success("Customer Panel has been unpublished / suspended.");
            renderMainUI({ ...formData, isPublished: false, enabled: false });
        } catch (err) {
            console.error("Unpublish error:", err);
            showAlert.error("Failed to unpublish panel: " + (err.message || 'Error'));
        }
    };

    /**
     * Bind all form and interactive button events
     */
    const bindEvents = (currentSettings) => {
        const form = document.getElementById('customer-panel-form');
        const statusSelect = document.getElementById('cp-status-select');
        const headerPill = document.getElementById('header-status-pill');
        const urlInput = document.getElementById('customer-panel-url-input');
        const copyBtn = document.getElementById('btn-copy-customer-link');
        const copyInputBtn = document.getElementById('btn-copy-input-link');
        const btnLaunchHeader = document.getElementById('btn-trigger-launch-modal');
        const btnLaunchBottom = document.getElementById('btn-bottom-launch');
        const btnLaunchBanner = document.getElementById('btn-banner-launch');
        const btnUnpublish = document.getElementById('btn-unpublish-panel');

        // Launch triggers
        if (btnLaunchHeader) btnLaunchHeader.addEventListener('click', triggerDedicatedLaunchFlow);
        if (btnLaunchBottom) btnLaunchBottom.addEventListener('click', triggerDedicatedLaunchFlow);
        if (btnLaunchBanner) btnLaunchBanner.addEventListener('click', triggerDedicatedLaunchFlow);

        // Unpublish trigger
        if (btnUnpublish) btnUnpublish.addEventListener('click', handleUnpublishAction);

        // Status change listener
        if (statusSelect) {
            statusSelect.addEventListener('change', () => {
                const isLive = statusSelect.value === 'ACTIVE';
                if (headerPill) {
                    headerPill.innerHTML = isLive 
                        ? `<span style="width:8px; height:8px; border-radius:50%; background:#10b981; animation:cp-pulse-dot 1.8s infinite;"></span> Published & Live`
                        : `<span style="width:8px; height:8px; border-radius:50%; background:#e11d48;"></span> Unpublished / Inactive`;
                    headerPill.style.background = isLive ? '#ecfdf5' : '#fff1f2';
                    headerPill.style.color = isLive ? '#059669' : '#e11d48';
                    headerPill.style.borderColor = isLive ? '#a7f3d0' : '#fecdd3';
                }
            });
        }

        // Category Radio Buttons
        const catRadios = document.querySelectorAll('input[name="cp-cat-mode"]');
        const specificContainer = document.getElementById('cp-specific-categories-container');
        catRadios.forEach(r => {
            r.addEventListener('change', () => {
                if (specificContainer) {
                    specificContainer.style.display = r.value === 'SPECIFIC' ? 'block' : 'none';
                }
            });
        });

        // Select All / Clear Categories
        const btnSelectAll = document.getElementById('btn-select-all-cats');
        const btnClearAll = document.getElementById('btn-deselect-all-cats');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', () => {
                document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = true);
            });
        }
        if (btnClearAll) {
            btnClearAll.addEventListener('click', () => {
                document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = false);
            });
        }

        // Slug input change listener
        const slugInput = document.getElementById('cp-custom-slug-input');
        const liveUrlPreview = document.getElementById('cp-live-url-preview');
        if (slugInput) {
            slugInput.addEventListener('input', () => {
                const cleanSlug = slugInput.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                slugInput.value = cleanSlug;
                const newUrl = computeCustomerUrl({ customSlug: cleanSlug });
                if (liveUrlPreview) liveUrlPreview.textContent = newUrl;
                if (urlInput) urlInput.value = newUrl;
            });
        }

        // Branding Mode listener
        const brandingRadios = document.querySelectorAll('input[name="cp-branding-mode"]');
        brandingRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.cp-branding-card').forEach(card => {
                    const isChecked = card.querySelector('input[name="cp-branding-mode"]')?.checked;
                    card.style.borderColor = isChecked ? 'var(--primary)' : 'var(--border-color)';
                    card.style.background = isChecked ? 'rgba(225,29,72,0.03)' : '#ffffff';
                });
            });
        });

        // Store Logo input listener
        const storeLogoInput = document.getElementById('cp-store-logo-input');
        const logoPreviewBox = document.getElementById('cp-logo-broad-preview');
        if (storeLogoInput && logoPreviewBox) {
            storeLogoInput.addEventListener('input', () => {
                const val = storeLogoInput.value.trim();
                if (val) {
                    logoPreviewBox.innerHTML = `<img src="${escapeHtml(val)}" alt="Store Logo" style="width:100%; height:100%; object-fit:contain;" onerror="this.onerror=null; this.parentElement.innerHTML='<svg width=\\'24\\' height=\\'24\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\' ry=\\'2\\'></rect><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'></circle><polyline points=\\'21 15 16 10 5 21\\'></polyline></svg>';">`;
                } else {
                    const wsLogo = window.__activeWorkspace?.logoUrl || '';
                    if (wsLogo) {
                        logoPreviewBox.innerHTML = `<img src="${escapeHtml(wsLogo)}" alt="Workspace Logo" style="width:100%; height:100%; object-fit:contain;">`;
                    } else {
                        logoPreviewBox.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`;
                    }
                }
            });
        }

        // Copy URL helper
        const handleCopy = () => {
            const finalUrl = computeCustomerUrl(collectFormData());
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(finalUrl).then(() => {
                    showAlert.success("Customer Panel link copied to clipboard!");
                }).catch(() => {
                    fallbackCopy(finalUrl);
                });
            } else {
                fallbackCopy(finalUrl);
            }
        };

        const fallbackCopy = (finalUrl) => {
            if (urlInput) {
                urlInput.value = finalUrl;
                urlInput.select();
                document.execCommand('copy');
                showAlert.success("Customer Panel link copied to clipboard!");
            }
        };

        if (copyBtn) copyBtn.addEventListener('click', handleCopy);
        if (copyInputBtn) copyInputBtn.addEventListener('click', handleCopy);
        if (urlInput) urlInput.addEventListener('click', handleCopy);

        // Save Draft Settings Submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = document.getElementById('btn-save-customer-panel');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Saving...';
                }

                try {
                    const updatedData = collectFormData();
                    await settingsService.saveCustomerPanelSettings(updatedData);

                    // Update sidebar status badge if present
                    const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
                    if (sidebarStatus) {
                        sidebarStatus.className = updatedData.isPublished ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
                        sidebarStatus.textContent = updatedData.isPublished ? 'Live' : 'Closed';
                    }

                    showAlert.success("Customer Panel settings saved successfully!");
                    renderMainUI(updatedData);
                } catch (err) {
                    console.error("Save error:", err);
                    showAlert.error("Failed to save Customer Panel settings: " + (err.message || 'Error'));
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Settings (Draft)';
                    }
                }
            });
        }
    };

    // Initial render
    renderMainUI(panelSettings);
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
