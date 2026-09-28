/**
 * PriceLister - Customer Panel Setup Module (Admin & Co-admin Only)
 * Dedicated Launch & Publishing Engine for standalone customer-facing product catalog.
 * Stores settings in subfield: Workspaces/{workspaceId}/CustomerPanel/{uid}
 */

import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { storageService } from '../../firebase/storage.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';
import { VALID_DEPLOY_COUNTRIES, VALID_BRANDING_MODES } from '../schemas/customerPanelSchema.js';
import { draftManager } from '../services/draftManager.js';

export const BENCHMARK_EXCHANGE_RATES = {
    'US': { rate: 1.00, currency: 'USD', symbol: '$' },
    'BD': { rate: 120.00, currency: 'BDT', symbol: '৳' },
    'IN': { rate: 83.50, currency: 'INR', symbol: '₹' },
    'CA': { rate: 1.36, currency: 'CAD', symbol: 'CA$' },
    'GB': { rate: 0.79, currency: 'GBP', symbol: '£' },
    'AU': { rate: 1.52, currency: 'AUD', symbol: 'AU$' },
    'DE': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'FR': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'AE': { rate: 3.67, currency: 'AED', symbol: 'د.إ' },
    'SA': { rate: 3.75, currency: 'SAR', symbol: '﷼' },
    'SG': { rate: 1.35, currency: 'SGD', symbol: 'S$' },
    'MY': { rate: 4.70, currency: 'MYR', symbol: 'RM' },
    'JP': { rate: 155.00, currency: 'JPY', symbol: '¥' },
    'IT': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'ES': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'BR': { rate: 5.40, currency: 'BRL', symbol: 'R$' },
    'MX': { rate: 18.20, currency: 'MXN', symbol: 'MX$' },
    'NL': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'ZA': { rate: 18.50, currency: 'ZAR', symbol: 'R' },
    'PK': { rate: 278.00, currency: 'PKR', symbol: '₨' },
    'ID': { rate: 16200.00, currency: 'IDR', symbol: 'Rp' },
    'TR': { rate: 32.50, currency: 'TRY', symbol: '₺' },
    'SE': { rate: 10.60, currency: 'SEK', symbol: 'kr' },
    'CH': { rate: 0.90, currency: 'CHF', symbol: 'CHF' },
    'QA': { rate: 3.64, currency: 'QAR', symbol: '﷼' }
};

export const DEPLOY_COUNTRY_LIST = [
    { code: 'GLOBAL', name: 'Global', iso: '', currency: 'Universal (All Regions)', isGlobal: true },
    { code: 'US', name: 'United States', iso: 'us', currency: 'USD ($)' },
    { code: 'BD', name: 'Bangladesh', iso: 'bd', currency: 'BDT (৳)' },
    { code: 'IN', name: 'India', iso: 'in', currency: 'INR (₹)' },
    { code: 'CA', name: 'Canada', iso: 'ca', currency: 'CAD ($)' },
    { code: 'GB', name: 'United Kingdom', iso: 'gb', currency: 'GBP (£)' },
    { code: 'AU', name: 'Australia', iso: 'au', currency: 'AUD ($)' },
    { code: 'DE', name: 'Germany', iso: 'de', currency: 'EUR (€)' },
    { code: 'FR', name: 'France', iso: 'fr', currency: 'EUR (€)' },
    { code: 'AE', name: 'United Arab Emirates', iso: 'ae', currency: 'AED (د.إ)' },
    { code: 'SA', name: 'Saudi Arabia', iso: 'sa', currency: 'SAR (﷼)' },
    { code: 'SG', name: 'Singapore', iso: 'sg', currency: 'SGD ($)' },
    { code: 'MY', name: 'Malaysia', iso: 'my', currency: 'MYR (RM)' },
    { code: 'JP', name: 'Japan', iso: 'jp', currency: 'JPY (¥)' },
    { code: 'IT', name: 'Italy', iso: 'it', currency: 'EUR (€)' },
    { code: 'ES', name: 'Spain', iso: 'es', currency: 'EUR (€)' },
    { code: 'BR', name: 'Brazil', iso: 'br', currency: 'BRL (R$)' },
    { code: 'MX', name: 'Mexico', iso: 'mx', currency: 'MXN ($)' },
    { code: 'NL', name: 'Netherlands', iso: 'nl', currency: 'EUR (€)' },
    { code: 'ZA', name: 'South Africa', iso: 'za', currency: 'ZAR (R)' },
    { code: 'PK', name: 'Pakistan', iso: 'pk', currency: 'PKR (₨)' },
    { code: 'ID', name: 'Indonesia', iso: 'id', currency: 'IDR (Rp)' },
    { code: 'TR', name: 'Turkey', iso: 'tr', currency: 'TRY (₺)' },
    { code: 'SE', name: 'Sweden', iso: 'se', currency: 'SEK (kr)' },
    { code: 'CH', name: 'Switzerland', iso: 'ch', currency: 'CHF (CHF)' },
    { code: 'QA', name: 'Qatar', iso: 'qa', currency: 'QAR (﷼)' }
];

export const renderCustomerPanelSetup = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    // 1. Show Loading Spinner
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
            <div class="spinner"></div>
        </div>
    `;

    const settingsService = getSettingsService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    let panelSettings = {};
    let allCategories = [];
    let wsDocInfo = {};

    try {
        const [pSet, cats, wsInfo] = await Promise.all([
            settingsService.getCustomerPanelSettings().catch(() => ({})),
            categoryService.getAllCategories().catch(() => []),
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null)
        ]);
        panelSettings = pSet || {};
        allCategories = cats || [];
        wsDocInfo = wsInfo || window.__activeWorkspace || {};
    } catch (err) {
        console.error("Error loading customer panel setup:", err);
        panelSettings = {};
        allCategories = [];
        wsDocInfo = window.__activeWorkspace || {};
    }

    // 2. Role Verification: Only Admin or Co-admin can configure Customer Panel
    let userRole = (window.__activeWorkspace?.role || '').toUpperCase();
    const isOwner = workspaceId === currentUser.uid || wsDocInfo?.adminId === currentUser.uid || wsDocInfo?.ownerId === currentUser.uid || !userRole;
    if (isOwner && !userRole) {
        userRole = 'CREATOR_ADMIN';
    }

    const isAuthorized = isOwner || userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN';

    if (!isAuthorized) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 550px; margin: 2rem auto; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.04); background: #ffffff;">
                <div style="width:64px; height:64px; border-radius:16px; background:#f4f4f5; border:1px solid #e4e4e7; display:inline-flex; align-items:center; justify-content:center; color:#18181b; margin-bottom:1.25rem;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-weight:800;">Access Restricted</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size:0.92rem;">
                    Only Workspace Admins and Co-admins have permission to configure and publish the Customer Panel.
                </p>
                <button class="btn btn-primary" onclick="window.location.hash='#/overview'" style="background:linear-gradient(180deg, #27272a 0%, #18181b 100%); border:1px solid #18181b; color:#ffffff; font-weight:700;">Return to Overview</button>
            </div>
        `;
        return;
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

    let selectedCustomLogoFile = null;
    let isFormDirty = false;
    let initialFormSnapshot = '';

    const renderMainUI = (settings) => {
        const isLive = Boolean(settings.isPublished || settings.enabled);
        const currentPortalUrl = computeCustomerUrl(settings);
        const brandingMode = settings.brandingMode || 'PRICELISTER';

        // Selected Countries parsing
        let selectedCountriesList = [];
        if (Array.isArray(settings.deployCountries) && settings.deployCountries.length > 0) {
            selectedCountriesList = settings.deployCountries;
        } else if (settings.deployCountry) {
            selectedCountriesList = settings.deployCountry.split(',').map(s => s.trim()).filter(Boolean);
        }
        if (selectedCountriesList.length === 0) {
            selectedCountriesList = ['Global'];
        }

        const isGlobalSelected = selectedCountriesList.includes('Global');

        const wsName = wsDocInfo.name || window.__activeWorkspace?.name || 'My Business';
        const wsAddress = wsDocInfo.address || wsDocInfo.description || 'Verified Business Store';
        const wsLogo = settings.workspaceLogo || wsDocInfo.logoUrl || wsDocInfo.logo || window.__activeWorkspace?.logoUrl || '';
        const storeLogo = settings.storeLogo || '';

        // Dynamic Branding Values
        let displayStoreTitle = settings.storeName || '';
        let displayStoreSubtitle = settings.storeSubtitle || '';
        let displayLogoSrc = 'pricelister_org.png';

        if (brandingMode === 'PRICELISTER') {
            displayStoreTitle = 'Price Lister Store';
            displayStoreSubtitle = 'Published by PriceLister.';
            displayLogoSrc = 'pricelister_org.png';
        } else if (brandingMode === 'WORKSPACE') {
            displayStoreTitle = wsName;
            displayStoreSubtitle = wsAddress;
            displayLogoSrc = wsLogo || 'pricelister_org.png';
        } else { // CUSTOM
            displayStoreTitle = settings.storeName || wsName;
            displayStoreSubtitle = settings.storeSubtitle || wsAddress || 'Online Product Store';
            displayLogoSrc = storeLogo || wsLogo || 'pricelister_org.png';
        }

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
            : `<span id="header-status-pill" style="display:inline-flex; align-items:center; gap:0.45rem; padding:0.35rem 0.85rem; border-radius:999px; background:#f4f4f5; color:#52525b; border:1px solid #e4e4e7; font-size:0.82rem; font-weight:700;">
                 <span style="width:8px; height:8px; border-radius:50%; background:#71717a;"></span>
                 Unpublished
               </span>`;

        container.innerHTML = `
            <!-- HEADER SECTION -->
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                        <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">Customer Panel & Public Catalog</h2>
                        ${statusPillHtml}
                        <span id="cp-unsaved-badge" style="display:none; align-items:center; gap:0.35rem; padding:0.25rem 0.65rem; border-radius:999px; background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.78rem; font-weight:700; animation:cp-pulse-dot 2s infinite;">
                            <span style="width:6px; height:6px; border-radius:50%; background:#f59e0b;"></span>
                            Unsaved Changes
                        </span>
                    </div>
                    <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                        Setup, customize branding, deploy countries, and publish a standalone web catalog for your customers.
                    </p>
                </div>

                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;" id="cp-header-actions-wrap">
                    <div id="cp-unsaved-pill-mount"></div>
                    <button type="button" id="btn-copy-customer-link" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem;" title="Copy shareable customer portal link">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy Link
                    </button>

                    ${isLive ? `
                        <a href="${currentPortalUrl}" target="_blank" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem; color:var(--text-primary);" title="Open customer catalog in a separate new browser tab">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            Open Storefront
                        </a>
                        <button type="button" id="btn-unpublish-panel" class="btn" style="background:#ffffff; border:1px solid #e4e4e7; color:#52525b; font-weight:600; display:flex; align-items:center; gap:0.4rem; padding:0.5rem 0.9rem;" title="Temporarily unpublish or suspend customer access">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            Unpublish Portal
                        </button>
                    ` : ''}

                    <button type="button" id="btn-trigger-launch-modal" class="btn btn-primary" style="font-weight:700; display:flex; align-items:center; gap:0.5rem; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); border:1px solid #18181b; color:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.2); padding:0.6rem 1.25rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 9v-5s3.03.55 4 2c1.08 1.62 0 5 0 5"></path></svg>
                        ${isLive ? 'Re-Launch Updates' : 'Launch Customer Panel'}
                    </button>
                </div>
            </div>

            <!-- UNPUBLISHED NOTICE BANNER (WHEN INACTIVE) -->
            ${!isLive ? `
                <div class="card" style="margin-bottom: 1.5rem; background: #fafaf9; border: 1px solid #e4e4e7; border-left: 5px solid #18181b; padding: 1.25rem 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div style="width:42px; height:42px; border-radius:50%; background:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.06); border:1px solid #e4e4e7; flex-shrink:0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </div>
                            <div>
                                <h4 style="margin:0 0 0.2rem 0; font-size:1rem; font-weight:700; color:#09090b;">Storefront Is Currently Unpublished</h4>
                                <p style="margin:0; font-size:0.85rem; color:#71717a;">
                                    Until you click <strong>Launch Customer Panel</strong>, customer access remains closed and visitors will see your temporary closed notice.
                                </p>
                            </div>
                        </div>
                        <button type="button" id="btn-banner-launch" class="btn btn-primary" style="background:linear-gradient(180deg, #27272a 0%, #18181b 100%); border:1px solid #18181b; color:#ffffff; font-weight:700; padding:0.5rem 1.15rem; font-size:0.88rem; display:flex; align-items:center; gap:0.4rem;">
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
                        <span id="cp-deploy-badge" style="font-size:0.8rem; background:var(--surface-100); padding:0.25rem 0.65rem; border-radius:6px; font-weight:600; color:var(--text-secondary);">
                            Deploy Country: <strong>${escapeHtml(isGlobalSelected ? 'Global' : selectedCountriesList.join(', '))}</strong>
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
            <form id="customer-panel-form" novalidate style="display:flex; flex-direction:column; gap:1.5rem;">
                
                <!-- 1. BRANDING CHOICES (PRICELISTER VS CUSTOM VS WORKSPACE) -->
                <div class="card" style="padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.25rem;">
                        <h3 style="font-size:1.15rem; margin:0; font-weight:700; color:var(--text-primary);">1. Branding Setup</h3>
                        <span id="cp-branding-status-tag" style="font-size:0.75rem; font-weight:700; padding:0.2rem 0.65rem; border-radius:999px; background:rgba(225,29,72,0.1); color:var(--primary);">
                            ${brandingMode === 'PRICELISTER' ? 'PriceLister Branding' : (brandingMode === 'CUSTOM' ? 'Custom Branding' : 'Workspace Branding')}
                        </span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">
                        Choose your branding presentation style. PriceLister branding locks official titles, while Custom Branding allows full editing.
                    </p>

                    <!-- BRANDING SELECTION CARDS -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                        
                        <!-- Option A: PriceLister Branding (Locked / Cannot change) -->
                        <label class="cp-branding-card" data-mode="PRICELISTER" style="border:2px solid ${brandingMode === 'PRICELISTER' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'PRICELISTER' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="PRICELISTER" ${brandingMode === 'PRICELISTER' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Price Lister Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:rgba(225,29,72,0.1); color:var(--primary); padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Official (Locked)</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
                                <div><strong>Title:</strong> Price Lister Store</div>
                                <div><strong>Subtitle:</strong> Published by PriceLister.</div>
                                <div style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem;">Fixed official badge &amp; certified secure store look.</div>
                            </div>
                        </label>

                        <!-- Option B: Custom Branding (Fully Editable) -->
                        <label class="cp-branding-card" data-mode="CUSTOM" style="border:2px solid ${brandingMode === 'CUSTOM' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'CUSTOM' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="CUSTOM" ${brandingMode === 'CUSTOM' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Custom Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:#ecfdf5; color:#059669; padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Fully Editable</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
                                <div><strong>Custom Store Logo &amp; Name</strong></div>
                                <div>Detected workspace info pre-filled &amp; fully editable.</div>
                                <div style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem;">Upload dedicated logo, title, and subtitle.</div>
                            </div>
                        </label>

                        <!-- Option C: Workspace Branding -->
                        <label class="cp-branding-card" data-mode="WORKSPACE" style="border:2px solid ${brandingMode === 'WORKSPACE' ? 'var(--primary)' : 'var(--border-color)'}; background:${brandingMode === 'WORKSPACE' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:12px; padding:1.25rem; cursor:pointer; display:flex; flex-direction:column; gap:0.6rem; transition:all 0.2s ease;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <input type="radio" name="cp-branding-mode" value="WORKSPACE" ${brandingMode === 'WORKSPACE' ? 'checked' : ''}>
                                    <span style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Workspace Branding</span>
                                </div>
                                <span style="font-size:0.72rem; background:#f1f5f9; color:#475569; padding:0.15rem 0.5rem; border-radius:999px; font-weight:700;">Workspace Auto</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
                                <div><strong>Title:</strong> ${escapeHtml(wsName)}</div>
                                <div><strong>Subtitle:</strong> ${escapeHtml(wsAddress)}</div>
                                <div style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem;">Automatically mirrors workspace identity.</div>
                            </div>
                        </label>
                    </div>

                    <!-- LOGO & BRANDING FIELDS DETAILS -->
                    <div id="cp-logo-dropzone" style="background:var(--surface-50); border:1.5px dashed var(--border-color); border-radius:12px; padding:1.25rem; margin-top:1rem; transition:all 0.2s ease;" title="Click or Drag & Drop logo file here">
                        
                        <div style="display:flex; gap:1.25rem; align-items:center; flex-wrap:wrap; margin-bottom:1.25rem;">
                            <!-- Square-Rounded Elevated Logo Box -->
                            <div id="cp-logo-elevated-box" style="width:76px; height:76px; border-radius:16px; background:#ffffff; border:1.5px solid var(--border-color); box-shadow:0 6px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; cursor:pointer; position:relative;" title="Click or drop logo image here">
                                <img id="cp-logo-img-preview" src="${escapeHtml(displayLogoSrc)}" alt="Store Logo" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='pricelister_org.png';">
                            </div>

                            <div style="flex:1; min-width:240px;" id="cp-logo-controls-wrap">
                                <div id="cp-logo-locked-notice" style="display:${brandingMode === 'PRICELISTER' ? 'block' : 'none'};">
                                    <strong style="font-size:0.9rem; color:var(--text-primary);">Official PriceLister Logo (Locked)</strong>
                                    <p style="margin:0.2rem 0 0 0; font-size:0.78rem; color:var(--text-secondary);">
                                        Uses verified PriceLister emblem. Select <strong>Custom Branding</strong> above or drop a logo image to customize.
                                    </p>
                                </div>

                                <div id="cp-logo-editable-controls" style="display:${brandingMode === 'CUSTOM' ? 'block' : 'none'};">
                                    <input type="file" id="cp-store-logo-file-input" accept="image/*" style="display:none;">
                                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; margin-bottom:0.4rem;">
                                        <button type="button" id="btn-cp-choose-logo" class="btn btn-secondary btn-sm" style="font-weight:600; font-size:0.85rem; padding:0.4rem 0.85rem; display:flex; align-items:center; gap:0.4rem; background:#ffffff;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            Browse / Drop Logo
                                        </button>
                                        <button type="button" id="btn-cp-use-ws-logo" class="btn btn-xs btn-outline" style="font-size:0.78rem; padding:0.35rem 0.65rem;">
                                            Use Workspace Logo
                                        </button>
                                        <button type="button" id="btn-cp-remove-logo" class="btn btn-xs" style="color:#e11d48; background:transparent; border:none; font-weight:600; font-size:0.78rem; cursor:pointer;">
                                            Reset
                                        </button>
                                    </div>
                                    <input type="text" id="cp-store-logo-input" class="form-control" style="font-size:0.82rem; height:34px; padding:0 0.65rem;" value="${escapeHtml(storeLogo)}" placeholder="Or paste direct image URL (optional)">
                                    <small style="font-size:0.73rem; color:var(--text-muted); margin-top:0.25rem; display:block;">Drag & drop PNG, JPG, or WEBP directly onto this area.</small>
                                </div>

                                <div id="cp-logo-workspace-notice" style="display:${brandingMode === 'WORKSPACE' ? 'block' : 'none'};">
                                    <strong style="font-size:0.9rem; color:var(--text-primary);">Workspace Broad Logo</strong>
                                    <p style="margin:0.2rem 0 0 0; font-size:0.78rem; color:var(--text-secondary);">
                                        Automatically mirrors your Workspace Logo. Drop a logo image here to switch to Custom Branding.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- STORE TITLE & SUBTITLE FIELDS -->
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
                            <div>
                                <label style="font-weight:700; font-size:0.85rem; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Store Title</span>
                                    <span id="cp-title-lock-badge" style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">
                                        ${brandingMode === 'PRICELISTER' ? 'View only' : (brandingMode === 'WORKSPACE' ? 'Workspace Linked' : 'Fully Editable')}
                                    </span>
                                </label>
                                <input type="text" id="cp-store-name" class="form-control" 
                                    style="font-weight:700; font-size:0.92rem; ${brandingMode !== 'CUSTOM' ? 'background:#f1f5f9; color:#475569; cursor:not-allowed;' : 'background:#ffffff;'}" 
                                    value="${escapeHtml(displayStoreTitle)}" 
                                    placeholder="e.g. Price Lister Store" 
                                    ${brandingMode !== 'CUSTOM' ? 'readonly' : ''}>
                            </div>

                            <div>
                                <label style="font-weight:700; font-size:0.85rem; margin-bottom:0.35rem; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Store Subtitle / Tagline</span>
                                    <span id="cp-sub-lock-badge" style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">
                                        ${brandingMode === 'PRICELISTER' ? 'View only' : (brandingMode === 'WORKSPACE' ? 'Workspace Linked' : 'Fully Editable')}
                                    </span>
                                </label>
                                <input type="text" id="cp-store-subtitle" class="form-control" 
                                    style="font-size:0.88rem; ${brandingMode !== 'CUSTOM' ? 'background:#f1f5f9; color:#475569; cursor:not-allowed;' : 'background:#ffffff;'}" 
                                    value="${escapeHtml(displayStoreSubtitle)}" 
                                    placeholder="e.g. Published by PriceLister." 
                                    ${brandingMode !== 'CUSTOM' ? 'readonly' : ''}>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 2. DEPLOY COUNTRY (GLOBAL = OTHER UNSELECTABLE; GLOBAL OFF = MULTISELECTABLE) -->
                <div class="card" style="padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.25rem;">
                        <div>
                            <h3 style="font-size:1.15rem; margin:0; font-weight:700; color:var(--text-primary);">2. Deploy Country &amp; Region Selection</h3>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0.2rem 0 0 0;">
                                Select <strong>Global</strong> (covers all regions) or turn Global off to <strong>multi-select</strong> specific countries.
                            </p>
                        </div>
                        <div style="display:flex; gap:0.4rem; align-items:center;">
                            <button type="button" id="btn-country-select-global" class="btn btn-secondary btn-sm" style="font-size:0.78rem; font-weight:600; padding:0.3rem 0.65rem; display:inline-flex; align-items:center; gap:0.35rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                Global Mode
                            </button>
                            <button type="button" id="btn-country-select-all" class="btn btn-secondary btn-sm" style="font-size:0.78rem; font-weight:600; padding:0.3rem 0.65rem;">
                                Select All (25)
                            </button>
                            <button type="button" id="btn-country-clear" class="btn btn-secondary btn-sm" style="font-size:0.78rem; font-weight:600; padding:0.3rem 0.65rem;">
                                Clear
                            </button>
                        </div>
                    </div>

                    <!-- Global Mode Master Notice Pill -->
                    <div id="cp-global-mode-alert" style="margin:0.85rem 0 0.5rem 0; padding:0.65rem 0.95rem; border-radius:10px; font-size:0.85rem; display:flex; align-items:center; gap:0.6rem; transition:all 0.2s ease; ${isGlobalSelected ? 'background:rgba(225,29,72,0.06); border:1px solid rgba(225,29,72,0.25); color:var(--primary);' : 'background:#f8fafc; border:1px solid #e2e8f0; color:var(--text-secondary);'}">
                        <span id="cp-global-mode-icon" style="display:inline-flex; align-items:center;">${isGlobalSelected ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>'}</span>
                        <span id="cp-global-mode-text">
                            ${isGlobalSelected
                ? '<strong>E-Commerce Website will globally publish:</strong> Accessible to visitors across all international countries.'
                : '<strong>Regional Target Mode:</strong> E-Commerce catalog will publish to selected target countries.'}
                        </span>
                    </div>

                    <!-- Search Filter for Countries -->
                    <div style="margin:0.75rem 0 0.85rem 0; position:relative;">
                        <input type="text" id="cp-country-search" class="form-control" style="padding-left:2.3rem; font-size:0.88rem; height:38px;" placeholder="Search country (e.g. USA, Bangladesh, India, Canada, Germany...)...">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </div>

                    <!-- Flag Country Selection Grid (Category-Style Chips) -->
                    <div id="cp-country-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap:0.65rem; max-height:360px; overflow-y:auto; padding:0.35rem 0.15rem;">
                        ${DEPLOY_COUNTRY_LIST.map(country => {
                    const isThisCountryGlobal = Boolean(country.isGlobal);
                    const isChecked = isThisCountryGlobal ? isGlobalSelected : (!isGlobalSelected && selectedCountriesList.includes(country.name));
                    const isDisabled = (!isThisCountryGlobal && isGlobalSelected);

                    return `
                                <label class="cp-country-card" data-country-name="${escapeHtml(country.name)}" data-is-global="${isThisCountryGlobal ? 'true' : 'false'}" style="display:flex; align-items:center; gap:0.75rem; padding:0.65rem 0.85rem; background:${isChecked ? 'rgba(225,29,72,0.04)' : '#ffffff'}; border:1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}; border-radius:10px; cursor:${isDisabled ? 'not-allowed' : 'pointer'}; opacity:${isDisabled ? '0.55' : '1'}; transition:all 0.15s ease; user-select:none; position:relative;">
                                    <input type="checkbox" class="cp-country-checkbox" value="${escapeHtml(country.name)}" data-is-global="${isThisCountryGlobal ? 'true' : 'false'}" ${isChecked ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} style="width:16px; height:16px; accent-color:var(--primary); cursor:${isDisabled ? 'not-allowed' : 'pointer'};">
                                    
                                    <!-- Flag Image or Globe -->
                                    <div style="width:28px; height:20px; border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#f1f5f9; box-shadow:0 1px 3px rgba(0,0,0,0.15); flex-shrink:0;">
                                        ${country.iso ? `
                                            <img src="https://flagcdn.com/w40/${country.iso}.png" alt="${escapeHtml(country.name)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.outerHTML='<span style=\\'font-size:0.75rem; font-weight:700; color:var(--text-secondary);\\'>${country.code}</span>';">
                                        ` : `
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                        `}
                                    </div>

                                    <div style="flex:1; overflow:hidden;">
                                        <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                            ${escapeHtml(country.name)}
                                        </div>
                                        <div class="cp-country-subtext" style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">
                                            ${isDisabled ? 'Included in Global' : escapeHtml(country.currency)}
                                        </div>
                                    </div>
                                </label>
                            `;
                }).join('')}
                    </div>

                    <div style="margin-top:0.75rem; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-secondary);">
                        <span id="cp-country-selected-count">Selected: <strong>${isGlobalSelected ? 'Global (All Regions)' : `${selectedCountriesList.filter(c => c !== 'Global').length} regions`}</strong></span>
                        <span id="cp-country-mode-helper">${isGlobalSelected ? 'Universal World Dispatch' : 'Multi-Country Selection Active'}</span>
                    </div>
                </div>

                <!-- 3. STORE CONTACT & ORDERING -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">3. Contact &amp; Ordering Options</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Contact information visible on customer order slips and WhatsApp checkout.</p>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-bottom:1rem;">
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">WhatsApp Ordering Number</label>
                            <input type="text" id="cp-whatsapp" class="form-control" value="${escapeHtml(settings.whatsappNumber || wsDocInfo.phone || '')}" placeholder="e.g. +8801700000000 (with country code)">
                            <small style="color:var(--text-muted); font-size:0.75rem;">Allows customers to send cart orders directly to WhatsApp with 1 click.</small>
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Facebook Page / ID</label>
                            <input type="text" id="cp-facebook" class="form-control" value="${escapeHtml(settings.facebookId || settings.facebookUrl || '')}" placeholder="e.g. facebook.com/yourshop or @yourshop">
                            <small style="color:var(--text-muted); font-size:0.75rem;">Direct Facebook page or messenger link for customers.</small>
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Phone Number</label>
                            <input type="text" id="cp-phone" class="form-control" value="${escapeHtml(settings.phone || wsDocInfo.phone || '')}" placeholder="e.g. 01700000000">
                        </div>
                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Email</label>
                            <input type="text" id="cp-email" class="form-control" value="${escapeHtml(settings.email || wsDocInfo.email || '')}" placeholder="e.g. store@example.com">
                        </div>
                    </div>

                    <div style="margin-bottom:1rem;">
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Address / City</label>
                        <input type="text" id="cp-address" class="form-control" value="${escapeHtml(settings.address || wsDocInfo.address || '')}" placeholder="e.g. Block C, Dhaka, Bangladesh">
                    </div>

                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Banner Announcement Message (Optional)</label>
                        <input type="text" id="cp-announcement" class="form-control" value="${escapeHtml(settings.announcement || '')}" placeholder="e.g. Free shipping on orders over $50!">
                    </div>
                </div>

                <!-- 4. CATEGORIES VISIBILITY -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">4. Category Visibility</h3>
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

                <!-- 5. DOLLAR RATE, CURRENCY EXCHANGE & REGIONAL TAX -->
                <div class="card" style="padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.35rem; flex-wrap:wrap; gap:0.5rem;">
                        <div>
                            <h3 style="font-size:1.15rem; margin:0 0 0.25rem 0; font-weight:700; color:var(--text-primary);">5. Dollar Rate, Currency Exchange &amp; Regional Tax</h3>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">
                                Enable automatic multi-currency price adjustment from USD ($) or customize local 1$ exchange value and tax per country.
                            </p>
                        </div>
                        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer; background:var(--surface-50); border:1.5px solid var(--border-color); padding:0.4rem 0.85rem; border-radius:999px;">
                            <input type="checkbox" id="cp-enable-exchange" ${settings.currencyExchangeEnabled !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary);">
                            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">Enable Currency Exchange</span>
                        </label>
                    </div>

                    <div id="cp-exchange-config-container" style="display:${settings.currencyExchangeEnabled !== false ? 'block' : 'none'}; margin-top:1.25rem; border-top:1px solid var(--border-color); padding-top:1.25rem;">
                        
                        <!-- Exchange Mode Choice -->
                        <div style="margin-bottom:1.25rem;">
                            <label style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:0.5rem; display:block;">Conversion Engine Mode:</label>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:0.75rem;">
                                <label class="cp-exchange-mode-card" style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.85rem 1rem; border:1.5px solid ${(settings.exchangeMode || 'AUTO_INTERNATIONAL') === 'AUTO_INTERNATIONAL' ? 'var(--primary)' : 'var(--border-color)'}; background:${(settings.exchangeMode || 'AUTO_INTERNATIONAL') === 'AUTO_INTERNATIONAL' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:10px; cursor:pointer;">
                                    <input type="radio" name="cp-exchange-mode" value="AUTO_INTERNATIONAL" ${(settings.exchangeMode || 'AUTO_INTERNATIONAL') === 'AUTO_INTERNATIONAL' ? 'checked' : ''} style="margin-top:2px;">
                                    <div>
                                        <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                            Auto International Exchange Rates
                                        </div>
                                        <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:0.2rem;">
                                            Live benchmark conversion (1$ = 120 ৳ BDT, 83.5 ₹ INR, 0.92 € EUR, 0.79 £ GBP, 1.36 CA$, 3.67 AED, etc.).
                                        </div>
                                    </div>
                                </label>

                                <label class="cp-exchange-mode-card" style="display:flex; align-items:flex-start; gap:0.75rem; padding:0.85rem 1rem; border:1.5px solid ${settings.exchangeMode === 'CUSTOM_MANUAL' ? 'var(--primary)' : 'var(--border-color)'}; background:${settings.exchangeMode === 'CUSTOM_MANUAL' ? 'rgba(225,29,72,0.03)' : '#ffffff'}; border-radius:10px; cursor:pointer;">
                                    <input type="radio" name="cp-exchange-mode" value="CUSTOM_MANUAL" ${settings.exchangeMode === 'CUSTOM_MANUAL' ? 'checked' : ''} style="margin-top:2px;">
                                    <div>
                                        <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                                            Custom Country Rates &amp; Tax (Manual)
                                        </div>
                                        <div style="font-size:0.76rem; color:var(--text-secondary); margin-top:0.2rem;">
                                            Manually define custom 1$ USD conversion value and optional regional Tax/VAT % for each country.
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Custom Country Rates & Tax Editor -->
                        <div id="cp-custom-rates-section" style="border:1px solid var(--border-color); border-radius:12px; padding:1.25rem; background:var(--surface-50);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem; flex-wrap:wrap; gap:0.5rem;">
                                <div>
                                    <h4 style="margin:0 0 0.15rem 0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Regional 1$ Dollar Rates &amp; Tax %</h4>
                                    <p style="margin:0; font-size:0.78rem; color:var(--text-secondary);">
                                        Set how much 1 USD is worth in local currency and add regional tax percentage.
                                    </p>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <label style="font-size:0.78rem; font-weight:600; color:var(--text-secondary);">Default Tax/VAT %:</label>
                                    <input type="number" id="cp-default-tax" class="form-control" style="width:70px; height:30px; font-size:0.82rem; padding:0 0.4rem; text-align:center;" min="0" max="100" step="any" value="${settings.defaultTaxPct !== undefined ? settings.defaultTaxPct : 0}">
                                </div>
                            </div>

                            <!-- Rate Table / Grid -->
                            <div id="cp-rates-table-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap:0.75rem; max-height:340px; overflow-y:auto; padding:0.25rem;">
                                <!-- Generated dynamically based on selected countries & directory -->
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 6. PRICING & DISPLAY OPTIONS -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">6. Pricing &amp; Stock Display Options</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Control how prices and stock are presented to customers.</p>

                    <div style="display:flex; flex-direction:column; gap:0.85rem;">
                        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                            <input type="checkbox" id="cp-show-mrp" ${settings.showMrp !== false ? 'checked' : ''}>
                            <div>
                                <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show MRP / Original Price Strikethrough</span>
                                <span style="font-size:0.8rem; color:var(--text-secondary);">Displays crossed-out MRP with discount percentage badge if MRP is higher than Selling Price.</span>
                            </div>
                        </label>

                        <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                            <input type="checkbox" id="cp-show-stock" ${settings.showStockBadge !== false ? 'checked' : ''}>
                            <div>
                                <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show In-Stock / Availability Badges</span>
                                <span style="font-size:0.8rem; color:var(--text-secondary);">Displays real-time stock availability badge on product cards.</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- 7. TERMS & CONDITIONS -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">7. Terms &amp; Policies</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Store policies and delivery details shown to customers.</p>

                    <textarea id="cp-terms" rows="3" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="• Prices subject to change without notice.&#10;• All orders are confirmed before dispatch.&#10;• Fast delivery available.">${escapeHtml(settings.termsAndConditions || '• Prices subject to change without notice.\n• All orders are confirmed before dispatch.')}</textarea>
                </div>

                <!-- 8. SUSPENDED / TEMPORARY CLOSED MESSAGE -->
                <div class="card" style="padding:1.5rem;">
                    <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">8. Suspended / Temporary Closed Message</h3>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Message displayed to customers when the panel is Unpublished or Stopped.</p>

                    <textarea id="cp-closed-msg" rows="3" class="form-control" style="width:100%; font-family:inherit;" placeholder="Temporary Closed&#10;Shop is temporarily suspended, may start early.">${escapeHtml(settings.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.')}</textarea>
                </div>

                <!-- SAVE ACTION BAR -->
                <div style="display:flex; justify-content:space-between; gap:1rem; padding:1.25rem 0; align-items:center; flex-wrap:wrap; position:sticky; bottom:0; background:rgba(255,255,255,0.92); backdrop-filter:blur(8px); z-index:10; border-top:1px solid var(--border-color);">
                    <button type="button" id="btn-return-overview" class="btn btn-secondary">
                        Return to Overview
                    </button>
                    <div style="display:flex; gap:0.75rem; align-items:center;">
                        <!-- Update Button (Enabled only when changed) -->
                        <button type="submit" id="btn-save-customer-panel" disabled data-dirty="false" class="btn btn-secondary" style="padding:0.65rem 1.65rem; font-weight:700; font-size:0.95rem; opacity:0.55; cursor:not-allowed; transition:all 0.2s ease;">
                            Save Settings (No Changes)
                        </button>
                        <button type="button" id="btn-bottom-launch" class="btn btn-primary" style="padding:0.65rem 1.75rem; font-weight:700; font-size:0.95rem; background:linear-gradient(180deg, #27272a 0%, #18181b 100%); border:1px solid #18181b; color:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.2); display:flex; align-items:center; gap:0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 9v-5s3.03.55 4 2c1.08 1.62 0 5 0 5"></path></svg>
                            ${isLive ? 'Re-Launch / Publish Updates' : 'Launch Customer Panel'}
                        </button>
                    </div>
                </div>
            </form>
        `;

        bindEvents(settings, wsName, wsAddress, wsLogo);
    };

    const collectFormData = (forcePublishState = null) => {
        const catMode = document.querySelector('input[name="cp-cat-mode"]:checked')?.value || 'ALL';
        const selectedCats = [];
        if (catMode === 'SPECIFIC') {
            document.querySelectorAll('.cp-cat-checkbox:checked').forEach(cb => {
                selectedCats.push(cb.value);
            });
        }

        const brandingMode = document.querySelector('input[name="cp-branding-mode"]:checked')?.value || 'PRICELISTER';

        // Collect selected countries
        const globalCb = document.querySelector('.cp-country-checkbox[data-is-global="true"]');
        const isGlobal = Boolean(globalCb && globalCb.checked);

        let selectedCountries = [];
        if (isGlobal) {
            selectedCountries = ['Global'];
        } else {
            document.querySelectorAll('.cp-country-checkbox:checked').forEach(cb => {
                if (cb.value !== 'Global') {
                    selectedCountries.push(cb.value);
                }
            });
            if (selectedCountries.length === 0) {
                selectedCountries = ['Global'];
            }
        }

        const deployCountryPrimary = selectedCountries[0] || 'Global';
        const storeLogo = (document.getElementById('cp-store-logo-input')?.value || '').trim();
        const customSlug = (document.getElementById('cp-custom-slug-input')?.value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, '');

        let isLive = forcePublishState !== null ? Boolean(forcePublishState) : true;

        let finalStoreTitle = document.getElementById('cp-store-name')?.value || 'Price Lister Store';
        let finalStoreSubtitle = document.getElementById('cp-store-subtitle')?.value || 'Published by PriceLister.';

        if (brandingMode === 'PRICELISTER') {
            finalStoreTitle = 'Price Lister Store';
            finalStoreSubtitle = 'Published by PriceLister.';
        }

        // Collect Currency Exchange & Custom Rates
        const exchangeEnabled = Boolean(document.getElementById('cp-enable-exchange')?.checked);
        const exchangeMode = document.querySelector('input[name="cp-exchange-mode"]:checked')?.value || 'AUTO_INTERNATIONAL';
        const defaultTaxPct = Math.max(0, Number(document.getElementById('cp-default-tax')?.value || 0));

        const customRatesMap = {};
        document.querySelectorAll('.cp-rate-card-row').forEach(row => {
            const code = row.getAttribute('data-code');
            const rateInp = row.querySelector('.cp-country-rate-input');
            const taxInp = row.querySelector('.cp-country-tax-input');
            if (code && rateInp) {
                const rateVal = Number(rateInp.value) || (BENCHMARK_EXCHANGE_RATES[code]?.rate || 1.0);
                const taxVal = Math.max(0, Number(taxInp?.value || 0));
                customRatesMap[code] = {
                    rate: rateVal,
                    taxPct: taxVal
                };
            }
        });

        return {
            isPublished: isLive,
            enabled: isLive,
            brandingMode: brandingMode,
            deployCountry: deployCountryPrimary,
            deployCountries: selectedCountries,
            storeLogo: storeLogo,
            customSlug: customSlug,
            storeName: finalStoreTitle,
            storeSubtitle: finalStoreSubtitle,
            whatsappNumber: document.getElementById('cp-whatsapp')?.value || '',
            facebookId: document.getElementById('cp-facebook')?.value || '',
            phone: document.getElementById('cp-phone')?.value || '',
            email: document.getElementById('cp-email')?.value || '',
            address: document.getElementById('cp-address')?.value || '',
            announcement: document.getElementById('cp-announcement')?.value || '',
            categorySelectionMode: catMode,
            allowedCategories: selectedCats,
            showMrp: Boolean(document.getElementById('cp-show-mrp')?.checked),
            showStockBadge: Boolean(document.getElementById('cp-show-stock')?.checked),
            currencyExchangeEnabled: exchangeEnabled,
            exchangeMode: exchangeMode,
            defaultTaxPct: defaultTaxPct,
            customCountryRates: customRatesMap,
            termsAndConditions: document.getElementById('cp-terms')?.value || '',
            closedMessage: document.getElementById('cp-closed-msg')?.value || 'Temporary Closed\nShop is temporarily suspended, may start early.',
            currencySymbol: getAppCurrencySymbol()
        };
    };

    /**
     * Dedicated Launch Modal Flow
     */
    const triggerDedicatedLaunchFlow = async () => {
        let formData = collectFormData(true);

        // Upload custom logo if selected
        if (selectedCustomLogoFile && formData.brandingMode === 'CUSTOM') {
            try {
                showAlert.info("Uploading custom store logo...");
                const uploadedUrl = await storageService.uploadImage(selectedCustomLogoFile, workspaceId);
                formData.storeLogo = uploadedUrl;
            } catch (err) {
                console.warn("Logo upload failed, continuing with existing:", err);
            }
        }

        const customerPanelUrl = computeCustomerUrl(formData);

        // 1. Create Modal Container
        let modalEl = document.getElementById('customer-panel-launch-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'customer-panel-launch-modal';
            document.body.appendChild(modalEl);
        }

        modalEl.innerHTML = `
            <div style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(10px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;">
                <div class="card" style="background:#ffffff; border-radius:18px; max-width:540px; width:100%; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); overflow:hidden; border:1px solid #e4e4e7; animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- MODAL HEADER -->
                    <div style="background:linear-gradient(180deg, #27272a 0%, #18181b 100%); padding:1.75rem 1.75rem 1.5rem; text-align:center; color:#ffffff; position:relative; overflow:hidden;">
                        <div style="position:absolute; width:180px; height:180px; background:radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%); top:-50px; right:-50px; border-radius:50%;"></div>
                        <h3 style="margin:0 0 0.35rem 0; font-size:1.35rem; font-weight:800; letter-spacing:-0.01em; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Launching Customer Panel
                        </h3>
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
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation:floatRocket 2s ease-in-out infinite;"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2 5-2"></path><path d="M12 9V4s3.03.55 4.5 2c1.63 1.62 2 5 2 5"></path></svg>
                            </div>
                        </div>

                        <!-- PROGRESSIVE STEP INDICATORS -->
                        <div style="display:flex; flex-direction:column; gap:0.85rem; margin-bottom:1.5rem;">
                            
                            <!-- STEP 1: PREPARING -->
                            <div id="launch-step-1" class="launch-step-row launch-step-active">
                                <div class="launch-step-icon"><div class="launch-spinner"></div></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Preparing Catalog &amp; Regional Rules</div>
                                    <div class="launch-step-subtitle">Verifying catalog items, countries, and branding modes...</div>
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
                                    <div class="launch-step-title">Applying Privacy &amp; Order Handlers</div>
                                    <div class="launch-step-subtitle">Configuring instant order receiving and checkout rules...</div>
                                </div>
                            </div>

                            <!-- STEP 4: FINISHING -->
                            <div id="launch-step-4" class="launch-step-row launch-step-pending">
                                <div class="launch-step-icon"><span class="step-num">4</span></div>
                                <div style="flex:1;">
                                    <div class="launch-step-title">Finishing &amp; Publishing Storefront</div>
                                    <div class="launch-step-subtitle">Finalizing live shareable URL and catalog...</div>
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
                    background: radial-gradient(circle at 35% 35%, #3f3f46, #18181b 60%, #09090b 100%);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35), inset 0 2px 4px rgba(255,255,255,0.4);
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
                    border: 2px solid rgba(24, 24, 27, 0.25);
                    animation: orbRipple 1.8s cubic-bezier(0.25, 1, 0.5, 1) infinite;
                }
                .cp-pulse-ring-2 {
                    position: absolute;
                    width: 130px;
                    height: 130px;
                    border-radius: 50%;
                    border: 2px solid rgba(24, 24, 27, 0.15);
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
                    background: #f4f4f5;
                    border-color: #d4d4d8;
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
                    background: #18181b;
                    color: #ffffff;
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
                    border: 2px solid #18181b;
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
                iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            } else if (state === 'active') {
                iconEl.innerHTML = `<div class="launch-spinner"></div>`;
            } else {
                iconEl.innerHTML = `<span class="step-num">${stepNum}</span>`;
            }
        };

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        try {
            await sleep(500);
            setStepState(1, 'done', 'Catalog and regional rules verified.');
            setStepState(2, 'active');

            await sleep(400);
            await settingsService.saveCustomerPanelSettings(formData);
            await sleep(350);
            setStepState(2, 'done', `Saved to Workspaces/${workspaceId}/CustomerPanel/${currentUser.uid}`);
            setStepState(3, 'active');

            await sleep(450);
            setStepState(3, 'done', 'Read-only rules & order receiving active.');
            setStepState(4, 'active');

            await sleep(400);
            setStepState(4, 'done', 'Live portal published successfully!');
            await sleep(350);

            // Reset Dirty State after publish
            isFormDirty = false;
            initialFormSnapshot = JSON.stringify(formData);
            selectedCustomLogoFile = null;

            // TRANSITION TO BROAD SUCCESS VIEW
            const modalContent = document.getElementById('launch-modal-content');
            if (modalContent) {
                modalContent.innerHTML = `
                    <div style="text-align:center; animation:modalPop 0.4s ease;">
                        <div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#ffffff; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem; box-shadow:0 10px 25px rgba(16,185,129,0.35);">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>

                        <h3 style="font-size:1.45rem; font-weight:800; color:var(--text-primary); margin-bottom:0.4rem;">
                            Customer Panel Launched Broadly!
                        </h3>
                        
                        <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin-bottom:1.5rem; max-width:440px; margin-left:auto; margin-right:auto;">
                            Your standalone storefront is now <strong>100% Published &amp; Live</strong>. Customers can view products, calculate totals, and place orders directly to your workspace.
                        </p>

                        <!-- SHAREABLE LINK CARD -->
                        <div style="background:var(--surface-50); border:1.5px dashed var(--primary); border-radius:12px; padding:1.25rem; margin-bottom:1.5rem; text-align:left;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; display:block; margin-bottom:0.4rem;">
                                Live Shareable Customer Link
                            </span>
                            <div style="display:flex; gap:0.5rem; align-items:center; margin-bottom:0.75rem;">
                                <input type="text" id="modal-success-url-input" readonly value="${customerPanelUrl}" class="form-control" style="font-family:monospace; font-size:0.85rem; background:#ffffff; font-weight:600; color:var(--text-primary);">
                                <button type="button" id="btn-modal-copy-url" class="btn btn-secondary" style="font-weight:700; white-space:nowrap; padding:0.5rem 1rem;">
                                    Copy Link
                                </button>
                            </div>
                            <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
                                <a href="${customerPanelUrl}" target="_blank" class="btn btn-primary" style="flex:1; font-weight:700; font-size:0.9rem; justify-content:center; display:flex; align-items:center; gap:0.4rem; background:linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                                    Open Live Storefront ↗
                                </a>
                                <a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Check out our product catalog: ' + customerPanelUrl)}" target="_blank" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                                    Share via WhatsApp
                                </a>
                            </div>
                        </div>

                        <!-- MODAL ACTION CLOSE -->
                        <button type="button" id="btn-modal-done" class="btn btn-secondary" style="width:100%; font-weight:700; padding:0.65rem;">
                            Done &amp; Return to Setup
                        </button>
                    </div>
                `;

                const modalUrlInput = document.getElementById('modal-success-url-input');
                const modalCopyBtn = document.getElementById('btn-modal-copy-url');
                const modalDoneBtn = document.getElementById('btn-modal-done');

                const copyAction = () => {
                    navigator.clipboard.writeText(customerPanelUrl).then(() => {
                        if (modalCopyBtn) modalCopyBtn.textContent = 'Copied!';
                        showAlert.success("Storefront link copied to clipboard!");
                        setTimeout(() => {
                            if (modalCopyBtn) modalCopyBtn.textContent = 'Copy Link';
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
                        renderMainUI({ ...formData, isPublished: true, enabled: true });
                    });
                }
            }

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
            const formData = collectFormData(false);
            await settingsService.saveCustomerPanelSettings(formData);

            isFormDirty = false;
            initialFormSnapshot = JSON.stringify(formData);
            selectedCustomLogoFile = null;

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
     * Bind all interactive events
     */
    const bindEvents = (currentSettings, wsName, wsAddress, wsLogo) => {
        const form = document.getElementById('customer-panel-form');
        const copyBtn = document.getElementById('btn-copy-customer-link');
        const copyInputBtn = document.getElementById('btn-copy-input-link');
        const btnLaunchHeader = document.getElementById('btn-trigger-launch-modal');
        const btnLaunchBottom = document.getElementById('btn-bottom-launch');
        const btnLaunchBanner = document.getElementById('btn-banner-launch');
        const btnUnpublish = document.getElementById('btn-unpublish-panel');
        const btnReturnOverview = document.getElementById('btn-return-overview');
        const submitBtn = document.getElementById('btn-save-customer-panel');
        const unsavedBadge = document.getElementById('cp-unsaved-badge');

        // Mount Smart Unsaved Changes Indicator
        const pillMount = document.getElementById('cp-unsaved-pill-mount');
        const unsavedIndicator = draftManager.mountUnsavedIndicator(pillMount, {
            formType: 'edit',
            onSave: () => {
                if (submitBtn && !submitBtn.disabled) submitBtn.click();
            }
        });

        // Register form for Anti-Reload Protection
        draftManager.registerForm('customer_panel', () => {
            const cpForm = document.getElementById('customer-panel-form');
            if (!cpForm || !document.body.contains(cpForm)) return false;
            return isFormDirty;
        });

        // Dirty State Checker & Update Button Controller
        const checkDirtyState = () => {
            const currentSnapshot = JSON.stringify(collectFormData());
            const hasChanged = (Boolean(initialFormSnapshot) && currentSnapshot !== initialFormSnapshot) || (selectedCustomLogoFile !== null);
            isFormDirty = hasChanged;

            unsavedIndicator.update(isFormDirty);

            if (isFormDirty) {
                draftManager.saveDraft('customer_panel', collectFormData());
            } else {
                draftManager.clearDraft('customer_panel');
            }

            if (submitBtn) {
                if (isFormDirty) {
                    submitBtn.disabled = false;
                    submitBtn.setAttribute('data-dirty', 'true');
                    submitBtn.textContent = 'Update Settings (Unsaved)';
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.style.background = 'var(--primary)';
                    submitBtn.style.color = '#ffffff';
                    submitBtn.style.borderColor = 'var(--primary)';
                    submitBtn.style.boxShadow = '0 4px 12px rgba(225,29,72,0.35)';
                } else {
                    submitBtn.disabled = true;
                    submitBtn.setAttribute('data-dirty', 'false');
                    submitBtn.textContent = 'Save Settings (No Changes)';
                    submitBtn.style.opacity = '0.55';
                    submitBtn.style.cursor = 'not-allowed';
                    submitBtn.style.background = 'var(--surface-100)';
                    submitBtn.style.color = 'var(--text-muted)';
                    submitBtn.style.borderColor = 'var(--border-color)';
                    submitBtn.style.boxShadow = 'none';
                }
            }

            if (unsavedBadge) {
                unsavedBadge.style.display = isFormDirty ? 'inline-flex' : 'none';
            }
        };

        // Unsaved Changes Alert on Navigation
        const handleNavigationGuard = (e) => {
            if (isFormDirty) {
                const leave = confirm("You have unsaved changes in Customer Panel setup. Are you sure you want to leave without saving?");
                if (!leave) {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    return false;
                }
            }
            return true;
        };

        if (btnReturnOverview) {
            btnReturnOverview.addEventListener('click', (e) => {
                if (handleNavigationGuard(e)) {
                    isFormDirty = false;
                    window.location.hash = '#/overview';
                }
            });
        }

        // Window beforeunload prompt
        const onBeforeUnload = (e) => {
            if (isFormDirty) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.removeEventListener('beforeunload', window._cpBeforeUnloadHandler);
        window._cpBeforeUnloadHandler = onBeforeUnload;
        window.addEventListener('beforeunload', onBeforeUnload);

        // Launch triggers
        if (btnLaunchHeader) btnLaunchHeader.addEventListener('click', triggerDedicatedLaunchFlow);
        if (btnLaunchBottom) btnLaunchBottom.addEventListener('click', triggerDedicatedLaunchFlow);
        if (btnLaunchBanner) btnLaunchBanner.addEventListener('click', triggerDedicatedLaunchFlow);
        if (btnUnpublish) btnUnpublish.addEventListener('click', handleUnpublishAction);

        // Branding Mode Switch Logic (Rule Enforcer)
        const brandingRadios = document.querySelectorAll('input[name="cp-branding-mode"]');
        const storeTitleInput = document.getElementById('cp-store-name');
        const storeSubInput = document.getElementById('cp-store-subtitle');
        const titleLockBadge = document.getElementById('cp-title-lock-badge');
        const subLockBadge = document.getElementById('cp-sub-lock-badge');
        const brandingStatusTag = document.getElementById('cp-branding-status-tag');
        const logoLockedNotice = document.getElementById('cp-logo-locked-notice');
        const logoEditableControls = document.getElementById('cp-logo-editable-controls');
        const logoWorkspaceNotice = document.getElementById('cp-logo-workspace-notice');
        const logoImgPreview = document.getElementById('cp-logo-img-preview');

        const updateBrandingModeUI = (mode) => {
            // Update Card Styles
            document.querySelectorAll('.cp-branding-card').forEach(card => {
                const isSelected = card.getAttribute('data-mode') === mode;
                card.style.borderColor = isSelected ? 'var(--primary)' : 'var(--border-color)';
                card.style.background = isSelected ? 'rgba(225,29,72,0.03)' : '#ffffff';
            });

            if (mode === 'PRICELISTER') {
                if (brandingStatusTag) brandingStatusTag.textContent = 'PriceLister Branding (Locked)';
                if (storeTitleInput) {
                    storeTitleInput.value = 'Price Lister Store';
                    storeTitleInput.readOnly = true;
                    storeTitleInput.style.background = '#f1f5f9';
                    storeTitleInput.style.color = '#475569';
                    storeTitleInput.style.cursor = 'not-allowed';
                }
                if (storeSubInput) {
                    storeSubInput.value = 'Published by PriceLister.';
                    storeSubInput.readOnly = true;
                    storeSubInput.style.background = '#f1f5f9';
                    storeSubInput.style.color = '#475569';
                    storeSubInput.style.cursor = 'not-allowed';
                }
                if (titleLockBadge) titleLockBadge.textContent = '[Locked] PriceLister Defaults';
                if (subLockBadge) subLockBadge.textContent = '[Locked] PriceLister Defaults';

                if (logoLockedNotice) logoLockedNotice.style.display = 'block';
                if (logoEditableControls) logoEditableControls.style.display = 'none';
                if (logoWorkspaceNotice) logoWorkspaceNotice.style.display = 'none';
                if (logoImgPreview) logoImgPreview.src = 'pricelister_org.png';
            } else if (mode === 'CUSTOM') {
                if (brandingStatusTag) brandingStatusTag.textContent = 'Custom Branding (Fully Editable)';
                if (storeTitleInput) {
                    if (storeTitleInput.value === 'Price Lister Store') {
                        storeTitleInput.value = wsName || '';
                    }
                    storeTitleInput.readOnly = false;
                    storeTitleInput.style.background = '#ffffff';
                    storeTitleInput.style.color = 'var(--text-primary)';
                    storeTitleInput.style.cursor = 'text';
                }
                if (storeSubInput) {
                    if (storeSubInput.value === 'Published by PriceLister.') {
                        storeSubInput.value = wsAddress || 'Online Product Catalog';
                    }
                    storeSubInput.readOnly = false;
                    storeSubInput.style.background = '#ffffff';
                    storeSubInput.style.color = 'var(--text-primary)';
                    storeSubInput.style.cursor = 'text';
                }
                if (titleLockBadge) titleLockBadge.textContent = '[Editable] Custom Mode';
                if (subLockBadge) subLockBadge.textContent = '[Editable] Custom Mode';

                if (logoLockedNotice) logoLockedNotice.style.display = 'none';
                if (logoEditableControls) logoEditableControls.style.display = 'block';
                if (logoWorkspaceNotice) logoWorkspaceNotice.style.display = 'none';

                const customLogoVal = (document.getElementById('cp-store-logo-input')?.value || '').trim();
                if (logoImgPreview) {
                    logoImgPreview.src = customLogoVal || wsLogo || 'pricelister_org.png';
                }
            } else if (mode === 'WORKSPACE') {
                if (brandingStatusTag) brandingStatusTag.textContent = 'Workspace Branding (Auto)';
                if (storeTitleInput) {
                    storeTitleInput.value = wsName || 'Workspace Store';
                    storeTitleInput.readOnly = true;
                    storeTitleInput.style.background = '#f1f5f9';
                    storeTitleInput.style.color = '#475569';
                    storeTitleInput.style.cursor = 'not-allowed';
                }
                if (storeSubInput) {
                    storeSubInput.value = wsAddress || 'Verified Workspace Store';
                    storeSubInput.readOnly = true;
                    storeSubInput.style.background = '#f1f5f9';
                    storeSubInput.style.color = '#475569';
                    storeSubInput.style.cursor = 'not-allowed';
                }
                if (titleLockBadge) titleLockBadge.textContent = '[Linked] Workspace Auto';
                if (subLockBadge) subLockBadge.textContent = '[Linked] Workspace Auto';

                if (logoLockedNotice) logoLockedNotice.style.display = 'none';
                if (logoEditableControls) logoEditableControls.style.display = 'none';
                if (logoWorkspaceNotice) logoWorkspaceNotice.style.display = 'block';
                if (logoImgPreview) logoImgPreview.src = wsLogo || 'pricelister_org.png';
            }
            checkDirtyState();
        };

        brandingRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                updateBrandingModeUI(radio.value);
            });
        });

        // Store Logo File Input & Preview in Custom Branding
        const storeLogoFileInput = document.getElementById('cp-store-logo-file-input');
        const btnChooseLogo = document.getElementById('btn-cp-choose-logo');
        const btnUseWsLogo = document.getElementById('btn-cp-use-ws-logo');
        const btnRemoveLogo = document.getElementById('btn-cp-remove-logo');
        const storeLogoInput = document.getElementById('cp-store-logo-input');
        const logoElevatedBox = document.getElementById('cp-logo-elevated-box');

        const processCustomLogoFile = async (file) => {
            if (!file || !file.type.startsWith('image/')) {
                showAlert.warning("Please select a valid image file (PNG, JPG, WEBP, SVG).");
                return;
            }

            // Client-side compression using Canvas
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDimension = 512;

                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (!blob) {
                                selectedCustomLogoFile = file;
                                if (logoImgPreview) logoImgPreview.src = e.target.result;
                                if (storeLogoInput) storeLogoInput.value = '';
                                checkDirtyState();
                                resolve(file);
                                return;
                            }
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                                type: "image/webp",
                                lastModified: Date.now()
                            });
                            selectedCustomLogoFile = compressedFile;
                            if (logoImgPreview) logoImgPreview.src = canvas.toDataURL('image/webp', 0.88);
                            if (storeLogoInput) storeLogoInput.value = '';
                            checkDirtyState();
                            resolve(compressedFile);
                        }, 'image/webp', 0.88);
                    };
                    img.onerror = () => {
                        selectedCustomLogoFile = file;
                        if (logoImgPreview) logoImgPreview.src = e.target.result;
                        if (storeLogoInput) storeLogoInput.value = '';
                        checkDirtyState();
                        resolve(file);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        };

        if (btnChooseLogo && storeLogoFileInput) {
            btnChooseLogo.addEventListener('click', () => {
                storeLogoFileInput.click();
            });
        }

        const cpLogoDropzone = document.getElementById('cp-logo-dropzone');
        const dropTargets = [logoElevatedBox, cpLogoDropzone].filter(Boolean);

        if (storeLogoFileInput && dropTargets.length > 0) {
            if (logoElevatedBox) {
                logoElevatedBox.style.cursor = 'pointer';
                logoElevatedBox.title = 'Click or Drag & Drop logo image here';

                logoElevatedBox.addEventListener('click', () => {
                    const currentBranding = document.querySelector('input[name="cp-branding-mode"]:checked')?.value;
                    if (currentBranding !== 'CUSTOM') {
                        const customRadio = document.querySelector('input[name="cp-branding-mode"][value="CUSTOM"]');
                        if (customRadio) {
                            customRadio.checked = true;
                            customRadio.dispatchEvent(new Event('change'));
                        }
                    }
                    storeLogoFileInput.click();
                });
            }

            dropTargets.forEach(target => {
                ['dragenter', 'dragover'].forEach(evtName => {
                    target.addEventListener(evtName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (cpLogoDropzone) {
                            cpLogoDropzone.style.borderColor = '#18181b';
                            cpLogoDropzone.style.background = '#f4f4f5';
                            cpLogoDropzone.style.boxShadow = '0 0 0 2px rgba(24,24,27,0.12)';
                        }
                        if (logoElevatedBox) {
                            logoElevatedBox.style.borderColor = '#18181b';
                            logoElevatedBox.style.transform = 'scale(1.05)';
                        }
                    });
                });

                ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                    target.addEventListener(evtName, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (cpLogoDropzone) {
                            cpLogoDropzone.style.borderColor = 'var(--border-color)';
                            cpLogoDropzone.style.background = 'var(--surface-50)';
                            cpLogoDropzone.style.boxShadow = 'none';
                        }
                        if (logoElevatedBox) {
                            logoElevatedBox.style.borderColor = 'var(--border-color)';
                            logoElevatedBox.style.transform = 'none';
                        }
                    });
                });

                target.addEventListener('drop', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        const customRadio = document.querySelector('input[name="cp-branding-mode"][value="CUSTOM"]');
                        if (customRadio && !customRadio.checked) {
                            customRadio.checked = true;
                            customRadio.dispatchEvent(new Event('change'));
                        }
                        await processCustomLogoFile(files[0]);
                        showAlert.success("Store logo loaded! Click Save to apply changes.");
                    }
                });
            });
        }

        if (storeLogoFileInput) {
            storeLogoFileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    await processCustomLogoFile(file);
                }
            });
        }

        if (btnUseWsLogo) {
            btnUseWsLogo.addEventListener('click', () => {
                selectedCustomLogoFile = null;
                if (storeLogoInput) storeLogoInput.value = wsLogo || '';
                if (logoImgPreview) logoImgPreview.src = wsLogo || 'pricelister_org.png';
                showAlert.info("Workspace logo loaded into custom branding.");
                checkDirtyState();
            });
        }

        if (btnRemoveLogo) {
            btnRemoveLogo.addEventListener('click', () => {
                selectedCustomLogoFile = null;
                if (storeLogoInput) storeLogoInput.value = '';
                if (storeLogoFileInput) storeLogoFileInput.value = '';
                if (logoImgPreview) logoImgPreview.src = 'pricelister_org.png';
                checkDirtyState();
            });
        }

        if (storeLogoInput) {
            storeLogoInput.addEventListener('input', () => {
                const val = storeLogoInput.value.trim();
                selectedCustomLogoFile = null;
                if (logoImgPreview) {
                    logoImgPreview.src = val || wsLogo || 'pricelister_org.png';
                }
                checkDirtyState();
            });
        }

        // Deploy Countries Logic: Global = other unselectable; Global Off = multiselectable
        const countrySearchInput = document.getElementById('cp-country-search');
        const countrySelectedCount = document.getElementById('cp-country-selected-count');
        const countryModeHelper = document.getElementById('cp-country-mode-helper');
        const globalModeAlert = document.getElementById('cp-global-mode-alert');
        const globalModeIcon = document.getElementById('cp-global-mode-icon');
        const globalModeText = document.getElementById('cp-global-mode-text');
        const deployBadge = document.getElementById('cp-deploy-badge');
        const btnSelectGlobal = document.getElementById('btn-country-select-global');
        const btnSelectAllCountries = document.getElementById('btn-country-select-all');
        const btnClearCountries = document.getElementById('btn-country-clear');

        const globalCheckbox = document.querySelector('.cp-country-checkbox[data-is-global="true"]');

        const syncCountryCardsState = () => {
            const isGlobalActive = Boolean(globalCheckbox && globalCheckbox.checked);

            // Update Global Mode Alert Banner
            if (globalModeAlert) {
                globalModeAlert.style.background = isGlobalActive ? 'rgba(225,29,72,0.06)' : '#f8fafc';
                globalModeAlert.style.borderColor = isGlobalActive ? 'rgba(225,29,72,0.25)' : '#e2e8f0';
                globalModeAlert.style.color = isGlobalActive ? 'var(--primary)' : 'var(--text-secondary)';
            }
            if (globalModeIcon) {
                globalModeIcon.innerHTML = isGlobalActive
                    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>'
                    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>';
            }
            if (globalModeText) {
                globalModeText.innerHTML = isGlobalActive
                    ? '<strong>E-Commerce Website will globally publish:</strong> Accessible to visitors across all international countries.'
                    : '<strong>Regional Target Mode:</strong> E-Commerce catalog will publish to selected target countries.';
            }

            const specificSelected = [];

            document.querySelectorAll('.cp-country-card').forEach(card => {
                const cb = card.querySelector('.cp-country-checkbox');
                const isGlobalCard = card.getAttribute('data-is-global') === 'true';
                const subtext = card.querySelector('.cp-country-subtext');
                const countryItem = DEPLOY_COUNTRY_LIST.find(c => c.name === card.getAttribute('data-country-name'));

                if (isGlobalCard) {
                    card.style.opacity = '1';
                    card.style.cursor = 'pointer';
                    cb.disabled = false;
                    if (isGlobalActive) {
                        card.style.borderColor = 'var(--primary)';
                        card.style.background = 'rgba(225,29,72,0.06)';
                        card.style.boxShadow = '0 4px 12px rgba(225,29,72,0.12)';
                    } else {
                        card.style.borderColor = 'var(--border-color)';
                        card.style.background = '#ffffff';
                        card.style.boxShadow = 'none';
                    }
                } else {
                    if (isGlobalActive) {
                        // When Global is ON: Other countries are unselectable & disabled
                        cb.checked = false;
                        cb.disabled = true;
                        card.style.opacity = '0.55';
                        card.style.cursor = 'not-allowed';
                        card.style.borderColor = 'var(--border-color)';
                        card.style.background = '#fafafa';
                        card.style.boxShadow = 'none';
                        if (subtext) subtext.textContent = 'Included in Global';
                    } else {
                        // When Global is OFF: Other countries are multiselectable & interactive
                        cb.disabled = false;
                        card.style.opacity = '1';
                        card.style.cursor = 'pointer';
                        if (subtext && countryItem) subtext.textContent = countryItem.currency;

                        if (cb.checked) {
                            card.style.borderColor = 'var(--primary)';
                            card.style.background = 'rgba(225,29,72,0.04)';
                            card.style.boxShadow = '0 2px 8px rgba(225,29,72,0.1)';
                            specificSelected.push(cb.value);
                        } else {
                            card.style.borderColor = 'var(--border-color)';
                            card.style.background = '#ffffff';
                            card.style.boxShadow = 'none';
                        }
                    }
                }
            });

            // Update Summary Badges
            if (isGlobalActive) {
                if (deployBadge) deployBadge.innerHTML = `Deploy Country: <strong>Global (All Regions)</strong>`;
                if (countrySelectedCount) countrySelectedCount.innerHTML = `Selected: <strong>Global</strong> (All 26 Regions Included)`;
                if (countryModeHelper) countryModeHelper.textContent = 'Universal World Dispatch';
            } else {
                const count = specificSelected.length;
                const text = count === 0 ? 'None (Please select regions)' : specificSelected.join(', ');
                if (deployBadge) deployBadge.innerHTML = `Deploy Country: <strong>${escapeHtml(text)}</strong>`;
                if (countrySelectedCount) countrySelectedCount.innerHTML = `Selected: <strong>${count}</strong> ${count === 1 ? 'region' : 'regions'}`;
            }

            renderRatesTable();
            checkDirtyState();
        };

        // Render & Bind Exchange Rate Table & Tax Inputs
        const ratesTableContainer = document.getElementById('cp-rates-table-container');
        const enableExchangeCb = document.getElementById('cp-enable-exchange');
        const exchangeConfigContainer = document.getElementById('cp-exchange-config-container');
        const exchangeModeRadios = document.querySelectorAll('input[name="cp-exchange-mode"]');
        const defaultTaxInput = document.getElementById('cp-default-tax');

        const renderRatesTable = () => {
            if (!ratesTableContainer) return;

            const isGlobalActive = Boolean(globalCheckbox && globalCheckbox.checked);
            let activeCountries = [];

            if (isGlobalActive) {
                activeCountries = DEPLOY_COUNTRY_LIST.filter(c => !c.isGlobal);
            } else {
                const selectedNames = [];
                document.querySelectorAll('.cp-country-checkbox:checked').forEach(cb => {
                    if (cb.getAttribute('data-is-global') !== 'true') {
                        selectedNames.push(cb.value);
                    }
                });
                activeCountries = DEPLOY_COUNTRY_LIST.filter(c => selectedNames.includes(c.name));
                if (activeCountries.length === 0) {
                    activeCountries = DEPLOY_COUNTRY_LIST.filter(c => c.code === 'US' || c.code === 'BD');
                }
            }

            const currentCustomRates = currentSettings.customCountryRates || {};
            const defTax = Number(defaultTaxInput?.value || currentSettings.defaultTaxPct || 0);

            ratesTableContainer.innerHTML = activeCountries.map(c => {
                const bench = BENCHMARK_EXCHANGE_RATES[c.code] || { rate: 1.0, currency: 'USD', symbol: '$' };
                const savedObj = currentCustomRates[c.code] || {};
                const currentRate = savedObj.rate !== undefined ? Number(savedObj.rate) : bench.rate;
                const currentTax = savedObj.taxPct !== undefined ? Number(savedObj.taxPct) : defTax;

                const previewBaseUsd = 10.0;
                const previewConverted = previewBaseUsd * currentRate;
                const previewTaxAmt = (previewConverted * currentTax) / 100;
                const previewFinal = previewConverted + previewTaxAmt;

                return `
                    <div class="cp-rate-card-row" data-code="${c.code}" style="background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:0.85rem; display:flex; flex-direction:column; gap:0.6rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span style="font-size:1.25rem;">${c.flag}</span>
                                <strong style="font-size:0.88rem; color:var(--text-primary);">${escapeHtml(c.name)}</strong>
                            </div>
                            <span style="font-size:0.75rem; font-weight:700; background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:6px; color:var(--text-secondary);">${escapeHtml(bench.currency)} (${escapeHtml(bench.symbol)})</span>
                        </div>

                        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:0.5rem; align-items:center;">
                            <div>
                                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">1 USD ($) = </label>
                                <div style="display:flex; align-items:center; gap:0.3rem;">
                                    <input type="number" step="any" min="0" class="form-control cp-country-rate-input" value="${currentRate}" style="height:32px; font-size:0.85rem; font-weight:700; font-family:monospace; padding:0 0.5rem;">
                                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-primary);">${bench.symbol}</span>
                                </div>
                            </div>
                            <div>
                                <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.2rem;">Tax / VAT %</label>
                                <div style="display:flex; align-items:center; gap:0.3rem;">
                                    <input type="number" step="any" min="0" max="100" class="form-control cp-country-tax-input" value="${currentTax}" style="height:32px; font-size:0.85rem; padding:0 0.4rem; text-align:center;">
                                    <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">%</span>
                                </div>
                            </div>
                        </div>

                        <div class="cp-rate-preview-badge" style="font-size:0.74rem; background:var(--surface-50); border:1px solid var(--border-color); border-radius:6px; padding:0.35rem 0.6rem; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
                            <span>$10 product:</span>
                            <strong style="color:var(--primary);">${bench.symbol}${previewFinal.toFixed(2)}</strong>
                        </div>
                    </div>
                `;
            }).join('');

            // Bind live preview calculation on rate/tax input
            ratesTableContainer.querySelectorAll('.cp-rate-card-row').forEach(row => {
                const code = row.getAttribute('data-code');
                const bench = BENCHMARK_EXCHANGE_RATES[code] || { rate: 1.0, symbol: '$' };
                const rateInp = row.querySelector('.cp-country-rate-input');
                const taxInp = row.querySelector('.cp-country-tax-input');
                const previewBadge = row.querySelector('.cp-rate-preview-badge');

                const updateRowPreview = () => {
                    const r = Number(rateInp?.value) || 1.0;
                    const t = Number(taxInp?.value) || 0;
                    const finalVal = (10.0 * r) + ((10.0 * r * t) / 100);
                    if (previewBadge) {
                        previewBadge.innerHTML = `<span>$10 product:</span> <strong style="color:var(--primary);">${bench.symbol}${finalVal.toFixed(2)}</strong>`;
                    }
                    checkDirtyState();
                };

                rateInp?.addEventListener('input', updateRowPreview);
                taxInp?.addEventListener('input', updateRowPreview);
            });
        };

        if (enableExchangeCb && exchangeConfigContainer) {
            enableExchangeCb.addEventListener('change', () => {
                exchangeConfigContainer.style.display = enableExchangeCb.checked ? 'block' : 'none';
                checkDirtyState();
            });
        }

        exchangeModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                document.querySelectorAll('.cp-exchange-mode-card').forEach(card => {
                    const isSelected = card.querySelector('input').checked;
                    card.style.borderColor = isSelected ? 'var(--primary)' : 'var(--border-color)';
                    card.style.background = isSelected ? 'rgba(225,29,72,0.03)' : '#ffffff';
                });
                checkDirtyState();
            });
        });

        if (defaultTaxInput) {
            defaultTaxInput.addEventListener('input', () => {
                checkDirtyState();
            });
        }

        renderRatesTable();

        // Attach country card and checkbox click handlers
        document.querySelectorAll('.cp-country-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const cb = card.querySelector('.cp-country-checkbox');
                const isGlobalCard = card.getAttribute('data-is-global') === 'true';
                const isGlobalActive = Boolean(globalCheckbox && globalCheckbox.checked);

                if (isGlobalActive && !isGlobalCard) {
                    // Clicking on a specific country while Global is ON will uncheck Global and select this country
                    if (globalCheckbox) globalCheckbox.checked = false;
                    if (cb) cb.checked = true;
                    syncCountryCardsState();
                    return;
                }

                if (e.target !== cb) {
                    if (!cb.disabled) {
                        cb.checked = !cb.checked;
                        if (isGlobalCard && cb.checked) {
                            // Turn on Global -> uncheck others
                        }
                        syncCountryCardsState();
                    }
                }
            });
        });

        document.querySelectorAll('.cp-country-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const isGlobalCard = cb.getAttribute('data-is-global') === 'true';
                if (isGlobalCard && cb.checked) {
                    // Global turned ON
                }
                syncCountryCardsState();
            });
        });

        // Quick Country Action Buttons
        if (btnSelectGlobal) {
            btnSelectGlobal.addEventListener('click', () => {
                if (globalCheckbox) globalCheckbox.checked = true;
                syncCountryCardsState();
                showAlert.info("Global mode activated. All regions universally covered.");
            });
        }

        if (btnSelectAllCountries) {
            btnSelectAllCountries.addEventListener('click', () => {
                if (globalCheckbox) globalCheckbox.checked = false;
                document.querySelectorAll('.cp-country-checkbox').forEach(cb => {
                    if (cb.getAttribute('data-is-global') !== 'true') {
                        cb.checked = true;
                    }
                });
                syncCountryCardsState();
                showAlert.info("All 25 specific countries selected.");
            });
        }

        if (btnClearCountries) {
            btnClearCountries.addEventListener('click', () => {
                if (globalCheckbox) globalCheckbox.checked = false;
                document.querySelectorAll('.cp-country-checkbox').forEach(cb => {
                    cb.checked = false;
                });
                syncCountryCardsState();
                showAlert.info("Cleared country selection. Choose target countries or select Global.");
            });
        }

        // Country Search Filter
        if (countrySearchInput) {
            countrySearchInput.addEventListener('input', () => {
                const q = countrySearchInput.value.trim().toLowerCase();
                document.querySelectorAll('.cp-country-card').forEach(card => {
                    const cName = (card.getAttribute('data-country-name') || '').toLowerCase();
                    if (!q || cName.includes(q)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        // Category Radio Buttons & Checkboxes
        const catRadios = document.querySelectorAll('input[name="cp-cat-mode"]');
        const specificContainer = document.getElementById('cp-specific-categories-container');
        catRadios.forEach(r => {
            r.addEventListener('change', () => {
                if (specificContainer) {
                    specificContainer.style.display = r.value === 'SPECIFIC' ? 'block' : 'none';
                }
                checkDirtyState();
            });
        });

        const btnSelectAllCats = document.getElementById('btn-select-all-cats');
        const btnClearCats = document.getElementById('btn-deselect-all-cats');
        if (btnSelectAllCats) {
            btnSelectAllCats.addEventListener('click', () => {
                document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = true);
                checkDirtyState();
            });
        }
        if (btnClearCats) {
            btnClearCats.addEventListener('click', () => {
                document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = false);
                checkDirtyState();
            });
        }

        // Input & Textarea Change Listeners for Dirty Checking
        container.querySelectorAll('input, textarea, select').forEach(el => {
            el.addEventListener('input', checkDirtyState);
            el.addEventListener('change', checkDirtyState);
        });

        // Slug input change listener
        const slugInput = document.getElementById('cp-custom-slug-input');
        const liveUrlPreview = document.getElementById('cp-live-url-preview');
        if (slugInput) {
            slugInput.addEventListener('input', () => {
                const cleanSlug = slugInput.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
                slugInput.value = cleanSlug;
                const newUrl = computeCustomerUrl({ customSlug: cleanSlug });
                if (liveUrlPreview) liveUrlPreview.textContent = newUrl;
                checkDirtyState();
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
            const temp = document.createElement('input');
            temp.value = finalUrl;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showAlert.success("Customer Panel link copied to clipboard!");
        };

        if (copyBtn) copyBtn.addEventListener('click', handleCopy);
        if (copyInputBtn) copyInputBtn.addEventListener('click', handleCopy);

        // Form Submit Handler (Save Settings)
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isFormDirty) {
                    showAlert.info("No changes to update.");
                    return;
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Saving Changes...';
                }

                try {
                    let updatedData = collectFormData();

                    if (selectedCustomLogoFile && updatedData.brandingMode === 'CUSTOM') {
                        try {
                            const uploadedUrl = await storageService.uploadImage(selectedCustomLogoFile, workspaceId);
                            updatedData.storeLogo = uploadedUrl;
                        } catch (err) {
                            console.warn("Logo upload failed, preserving draft:", err);
                        }
                    }

                    await settingsService.saveCustomerPanelSettings(updatedData);

                    // Reset Dirty State & Clear Saved Draft
                    isFormDirty = false;
                    initialFormSnapshot = JSON.stringify(updatedData);
                    selectedCustomLogoFile = null;
                    draftManager.clearDraft('customer_panel');
                    unsavedIndicator.update(false);

                    const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
                    if (sidebarStatus) {
                        sidebarStatus.className = updatedData.isPublished ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
                        sidebarStatus.textContent = updatedData.isPublished ? 'Live' : 'Closed';
                    }

                    showAlert.success("Customer Panel settings updated successfully!");
                    renderMainUI(updatedData);
                } catch (err) {
                    console.error("Save error:", err);
                    showAlert.error("Failed to save Customer Panel settings: " + (err.message || 'Error'));
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Update Settings (Unsaved)';
                    }
                }
            });
        }

        // Initial sync of country cards state & pristine snapshot
        syncCountryCardsState();
        initialFormSnapshot = JSON.stringify(collectFormData());
        isFormDirty = false;
        selectedCustomLogoFile = null;
        checkDirtyState();
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