import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getSettingsService } from '../services/settingsService.js';
import { storageService } from '../../supabase/storage.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { downloadHeadersOnlyTemplate, downloadExampleDataTemplate } from '../utils/exportEngine.js';
import { openCurrencyPickerModal } from './currencyModal.js';
import { openBannerPickerModal, CURATED_BANNER_PRESETS } from './bannerModal.js';
import { COUNTRIES_LIST } from '../../DataModel.js';
import { CURRENCY_LIST, getCurrencyByCode } from '../utils/currencyData.js';
import { getThemeMode, applyThemeMode } from '../utils/themeManager.js';

const db = getFirestore(firebaseApp);

const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const INDUSTRY_OPTIONS = [
    'General Commercial',
    'Retail & Supermarket',
    'Wholesale & Distribution',
    'Electronics & Gadget',
    'Fashion & Apparel',
    'Food, Beverage & Restaurant',
    'Pharmacy & Healthcare',
    'Manufacturing & Industrial',
    'Automotive & Parts',
    'Beauty, Cosmetics & Salon',
    'Hardware & Constrution',
    'Bookstore & Stationery',
    'Professional Services',
    'E-Commerce',
    'Other'
];

export const renderSettings = async (container, workspaceId = 'ws_dev_mock') => {
    let currentUser = authService.getCurrentUser();
    const isExplicitDemo = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_explicit_demo') === 'true') ||
                           (typeof localStorage !== 'undefined' && localStorage.getItem('pricelister_demo_mode') === 'true') ||
                           (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo=true'));

    const isMock = workspaceId === 'ws_dev_mock' || 
                   !workspaceId || 
                   workspaceId === 'demo' || 
                   workspaceId === 'dev-mock-uid' ||
                   workspaceId === 'DEMO-SANDBOX-01' ||
                   currentUser?.uid === 'dev-mock-uid' ||
                   Boolean(currentUser?.isDemo) ||
                   isExplicitDemo;

    if (!currentUser) {
        if (isMock) {
            currentUser = {
                uid: 'dev-mock-uid',
                email: 'developer@local.test',
                displayName: 'Demo Admin',
                role: 'CREATOR_ADMIN'
            };
        } else {
            return;
        }
    }

    container.innerHTML = `
        <div class="workspace-settings-skeleton" style="display:flex; flex-direction:column; gap:1.5rem; max-width:1400px; margin:0 auto; width:100%; padding:0.5rem 0;">
            <!-- 1. Header Skeleton -->
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <div class="skeleton-shimmer" style="width:140px; height:12px; border-radius:4px;"></div>
                    <div class="skeleton-shimmer" style="width:280px; height:28px; border-radius:8px;"></div>
                    <div class="skeleton-shimmer" style="width:420px; height:14px; border-radius:4px;"></div>
                </div>
                <div style="display:flex; gap:0.65rem;">
                    <div class="skeleton-shimmer" style="width:130px; height:38px; border-radius:8px;"></div>
                    <div class="skeleton-shimmer" style="width:110px; height:38px; border-radius:8px;"></div>
                </div>
            </div>

            <!-- 2. Settings Navigation Tabs Skeleton -->
            <div style="display:flex; gap:0.65rem; border-bottom:1.5px solid #e4e4e7; padding-bottom:0.75rem;">
                <div class="skeleton-shimmer" style="width:120px; height:34px; border-radius:9999px;"></div>
                <div class="skeleton-shimmer" style="width:110px; height:34px; border-radius:9999px;"></div>
                <div class="skeleton-shimmer" style="width:130px; height:34px; border-radius:9999px;"></div>
                <div class="skeleton-shimmer" style="width:100px; height:34px; border-radius:9999px;"></div>
            </div>

            <!-- 3. Workspace Branding Card Skeleton -->
            <div class="card" style="padding:1.5rem; border:1.5px solid #e4e4e7; border-radius:14px; background:#ffffff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                    <div class="skeleton-shimmer" style="width:190px; height:20px; border-radius:6px;"></div>
                    <div class="skeleton-shimmer" style="width:90px; height:16px; border-radius:4px;"></div>
                </div>
                
                <!-- Banner & Logo Skeleton -->
                <div style="position:relative; margin-bottom:2rem;">
                    <div class="skeleton-shimmer" style="width:100%; height:130px; border-radius:12px;"></div>
                    <div class="skeleton-shimmer" style="width:84px; height:84px; border-radius:20px; border:3px solid #ffffff; position:absolute; bottom:-25px; left:20px; box-shadow:0 4px 10px rgba(0,0,0,0.06);"></div>
                </div>

                <!-- Form Fields Grid Skeleton -->
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem; margin-top:2rem;">
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:130px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:120px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem; grid-column:1 / -1;">
                        <div class="skeleton-shimmer" style="width:150px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:70px; border-radius:8px;"></div>
                    </div>
                </div>
            </div>

            <!-- 4. Contact & Regional Settings Skeleton -->
            <div class="card" style="padding:1.5rem; border:1.5px solid #e4e4e7; border-radius:14px; background:#ffffff;">
                <div class="skeleton-shimmer" style="width:210px; height:20px; border-radius:6px; margin-bottom:1.25rem;"></div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:100px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:110px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:90px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <div class="skeleton-shimmer" style="width:115px; height:13px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:100%; height:40px; border-radius:8px;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        // 1. DETERMINE USER ROLE
        let userRole = 'WORKER';
        let isAdmin = false;
        let isCoAdmin = false;
        let wsData = (typeof window !== 'undefined' && window.__activeWorkspace) ? { ...window.__activeWorkspace } : {};
        let resolvedWsDocId = (typeof window !== 'undefined' && window.__activeWorkspace?.id) || workspaceId;

        if (isMock) {
            userRole = 'CREATOR_ADMIN';
            isAdmin = true;
            try {
                const raw = localStorage.getItem('pricelister_mock_settings');
                if (raw) wsData = JSON.parse(raw) || {};
            } catch (e) {}
        } else {
            try {
                const wsRef = doc(db, 'Workspaces', resolvedWsDocId);
                const wsSnap = await getDoc(wsRef);
                if (wsSnap && wsSnap.exists()) {
                    wsData = { ...wsData, ...wsSnap.data() };
                    resolvedWsDocId = wsSnap.id;
                } else if (workspaceId && workspaceId !== resolvedWsDocId) {
                    const fallbackRef = doc(db, 'Workspaces', workspaceId);
                    const fallbackSnap = await getDoc(fallbackRef);
                    if (fallbackSnap && fallbackSnap.exists()) {
                        wsData = { ...wsData, ...fallbackSnap.data() };
                        resolvedWsDocId = fallbackSnap.id;
                    } else {
                        const qWs = query(collection(db, 'Workspaces'), where('workspaceId', '==', workspaceId));
                        const qSnap = await getDocs(qWs);
                        if (!qSnap.empty) {
                            wsData = { ...wsData, ...qSnap.docs[0].data() };
                            resolvedWsDocId = qSnap.docs[0].id;
                        }
                    }
                }
            } catch (err) {
                console.warn("Could not load workspace doc from Firestore:", err);
                try {
                    const rawOff = localStorage.getItem(`pricelister_offline_settings_${workspaceId}`);
                    if (rawOff) wsData = { ...wsData, ...(JSON.parse(rawOff) || {}) };
                } catch (e) {}
            }

            const isCreator = Boolean(
                wsData.adminId === currentUser?.uid || 
                wsData.adminUid === currentUser?.uid || 
                resolvedWsDocId === currentUser?.uid || 
                (wsData.email && currentUser?.email && currentUser.email.toLowerCase() === wsData.email.toLowerCase()) ||
                (wsData.adminEmail && currentUser?.email && currentUser.email.toLowerCase() === wsData.adminEmail.toLowerCase())
            );

            if (isCreator) {
                userRole = 'CREATOR_ADMIN';
                isAdmin = true;
            } else if (wsData.role === 'CREATOR_ADMIN' || wsData.role === 'ADMIN' || wsData.role === 'CREATOR' || wsData.role === 'OWNER') {
                isAdmin = true;
                userRole = wsData.role;
            } else if (wsData.role === 'CO_ADMIN' || wsData.role === 'COADMIN') {
                isCoAdmin = true;
                userRole = wsData.role;
            } else {
                for (const sub of ['Members', 'members']) {
                    try {
                        const mRef = doc(db, 'Workspaces', resolvedWsDocId, sub, currentUser.uid);
                        const mSnap = await getDoc(mRef);
                        if (mSnap.exists()) {
                            userRole = (mSnap.data().role || 'WORKER').toUpperCase();
                            break;
                        }
                        if (currentUser.email) {
                            const cleanEmail = currentUser.email.toLowerCase();
                            const mEmailRef = doc(db, 'Workspaces', resolvedWsDocId, sub, cleanEmail);
                            const mEmailSnap = await getDoc(mEmailRef);
                            if (mEmailSnap.exists()) {
                                userRole = (mEmailSnap.data().role || 'WORKER').toUpperCase();
                                break;
                            }
                            const qMem = query(collection(db, 'Workspaces', resolvedWsDocId, sub), where('email', '==', currentUser.email));
                            const qSnap = await getDocs(qMem);
                            if (!qSnap.empty) {
                                userRole = (qSnap.docs[0].data().role || 'WORKER').toUpperCase();
                                break;
                            }
                        }
                    } catch (e) {}
                }

                if (userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR') {
                    isAdmin = true;
                } else if (userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN') {
                    isCoAdmin = true;
                }
            }
        }

        const canAccessSettings = isAdmin || isCoAdmin;

        // Worker Restriction View
        if (!canAccessSettings) {
            container.innerHTML = `
                <div style="max-width: 560px; margin: 3rem auto; background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 20px; padding: 2.5rem; text-align: center; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06);">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: #f4f4f5; color: #18181b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Access Restricted</h3>
                    <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.55; margin-bottom: 1.5rem;">
                        Advanced Workspace Settings, Currency Configurations, and Inventory Automation can only be configured by <strong>Admins</strong> and <strong>Co-Admins</strong>.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="window.location.hash='#/workspace'" style="border-radius: 8px;">Workspace Hub</button>
                        <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'" style="border-radius: 8px;">Create Invoices</button>
                        <button id="btn-worker-leave-ws" class="btn btn-outline" style="color:#18181B; border-color:rgba(225,29,72,0.3); border-radius: 8px;">Leave Workspace</button>
                    </div>
                </div>
            `;

            container.querySelector('#btn-worker-leave-ws')?.addEventListener('click', async () => {
                if (await showAlert.confirm("Are you sure you want to leave this workspace? You will lose access to its products and invoices.")) {
                    try {
                        await firestoreService.leaveWorkspace(workspaceId, currentUser);
                        showAlert.success("You have left the workspace.");
                        window.location.replace('/index.html?view=connection');
                    } catch (e) {
                        showAlert.error("Failed to leave workspace: " + (e.message || 'Unknown error'));
                    }
                }
            });
            return;
        }

        // 2. LOAD SERVER SETTINGS
        const settingsService = getSettingsService(workspaceId);
        let currentSettings = await settingsService.getWorkspaceSettings();

        const wsDisplayName = currentSettings.name || wsData.name || 'PriceLister Workspace';
        const wsTradeName = currentSettings.tradeName || currentSettings.shopName || wsDisplayName;
        const wsIndustry = currentSettings.industry || wsData.industry || 'General Commercial';
        const wsTagline = currentSettings.tagline || currentSettings.description || wsData.description || 'Build • Manage • Sell • Scale Together';
        const wsWebsite = currentSettings.website || wsData.website || '';
        const wsTaxId = currentSettings.taxId || wsData.taxId || '';
        const wsIdText = wsData.workspaceId || wsData.id || workspaceId;
        const wsEmail = currentSettings.email || wsData.email || currentUser.email || '';
        const wsPhone = currentSettings.phone || wsData.phone || '';
        const wsSupportPhone = currentSettings.supportPhone || wsData.supportPhone || '';
        const wsAddress = currentSettings.address || wsData.address || '';
        const wsShopName = currentSettings.shopName || wsTradeName;
        const wsEndMsg = currentSettings.endMessage || 'Thank you for choosing us!';
        const wsCurrency = (currentSettings.currencySymbol || '$').trim().substring(0, 3) || '$';
        const wsCountry = currentSettings.country || currentSettings.countryName || wsData.country || 'United Kingdom';
        const wsCountryCode = currentSettings.countryCode || wsData.countryCode || 'GB';
        const wsRegion = currentSettings.region || wsData.region || 'England';
        const wsCurrencyCode = (currentSettings.currencyCode || wsData.currencyCode || 'EUR').toUpperCase();
        const wsCurrencyName = currentSettings.currencyName || wsData.currencyName || 'Euro';
        const matchedCountry = COUNTRIES_LIST.find(c => c.name.toLowerCase() === wsCountry.toLowerCase() || c.code === wsCountryCode) || { flag: '', name: wsCountry };
        const isVendingActive = Boolean(currentSettings.enableVending);
        const printCustName = Boolean(currentSettings.customerName);
        const printCustPhone = Boolean(currentSettings.customerNumber);
        
        const logoUrl = currentSettings.logoUrl || wsData.logoUrl || wsData.logo || '';
        const bannerUrl = currentSettings.bannerUrl || wsData.bannerUrl || wsData.banner || '';

        const parseDateSafe = (val) => {
            if (!val) return null;
            if (typeof val?.toDate === 'function') {
                try { return val.toDate(); } catch (e) {}
            }
            if (val?.seconds) return new Date(val.seconds * 1000);
            try {
                const d = new Date(val);
                return isNaN(d.getTime()) ? null : d;
            } catch (e) {
                return null;
            }
        };

        const createdDateObj = parseDateSafe(wsData.createdAt);
        const wsCreatedDate = currentSettings.createdDate || (createdDateObj ? createdDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent');
        const wsCreatedTimestamp = currentSettings.createdTimestamp || (createdDateObj ? createdDateObj.toISOString() : '');
        const wsCreatorEmail = currentSettings.creatorEmail || wsData.creatorEmail || wsData.adminEmail || currentUser.email || '';

        const updatedDateObj = parseDateSafe(wsData.updatedAt);
        const wsUpdatedDate = currentSettings.updatedDate || (updatedDateObj ? updatedDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent');
        const wsUpdateTimestamp = currentSettings.updateTimestamp || (updatedDateObj ? updatedDateObj.toISOString() : '');
        const wsUpdatorEmail = currentSettings.updatorEmail || wsData.updatorEmail || wsCreatorEmail;
        const currentColorMode = localStorage.getItem('pricelister_color_mode') || 'light';

        // Render Advanced Settings Interface
        container.innerHTML = `
            <div class="advanced-settings-wrapper" style="width: 100%; margin: 0; padding: 0.25rem 0 3.5rem;">
                
                <!-- TOP HEADER HERO -->
                <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1rem 1.35rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: 0 4px 20px -3px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 0.9rem;">
                        <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18); flex-shrink: 0;">
                            ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">Workspace Settings &amp; Brand</h2>
                                <span style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px; background: #FAFAFA; color: #18181B; border: 1px solid #E4E4E7;">
                                    ${isAdmin ? 'Creator Admin' : 'Co-Admin'}
                                </span>
                            </div>
                            <p style="margin: 0.15rem 0 0 0; color: var(--text-muted); font-size: 0.82rem;">
                                Configure workspace logo (1:1), high-res cover banner (16:9 / 1920×1080), brand credentials, regional currency, automated stock vending, and receipts.
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap;">
                        <button type="button" class="btn btn-secondary" onclick="window.location.hash='#/workspace'" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; padding: 0.5rem 0.85rem; border-radius: 8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                            <span>Workspace Hub</span>
                        </button>
                        <button type="button" id="btn-header-save-settings" class="btn btn-save-clean" style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.15rem; border-radius: 8px; background: #18181b; color: #ffffff; border: 1.5px solid #18181b; cursor: pointer; transition: all 0.2s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            <span class="btn-save-label">Save Settings</span>
                            <span id="header-unsaved-dot" style="display: none; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; border: 1px solid #d97706;"></span>
                        </button>
                    </div>
                </div>

                <!-- LIVE INTERACTIVE BRAND HERO PREVIEW CARD -->
                <div id="settings-live-brand-hero" style="
                    position: relative;
                    border-radius: 16px;
                    overflow: hidden;
                    background: ${bannerUrl ? `url('${escapeHtml(bannerUrl)}') center/cover no-repeat, #18181b` : 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)'};
                    color: #ffffff;
                    box-shadow: 0 12px 32px -8px rgba(0,0,0,0.22);
                    border: 1.5px solid rgba(255,255,255,0.12);
                    margin-bottom: 0.75rem;
                    transition: background 0.3s ease;
                ">
                    <!-- Dark Gradient Overlay for Readability -->
                    <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(9,9,11,0.4) 0%, rgba(9,9,11,0.88) 100%); backdrop-filter: blur(${bannerUrl ? '1px' : '0px'});"></div>
                    
                    <div style="position: relative; z-index: 2; padding: 1.6rem 1.85rem 1.25rem; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1.25rem;">
                        <div style="display: flex; gap: 1.15rem; align-items: center;">
                            <!-- 1:1 Square Logo Preview Box -->
                            <div id="hero-live-logo-wrap" style="width: 70px; height: 70px; border-radius: 14px; background: rgba(255,255,255,0.18); backdrop-filter: blur(12px); border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; box-shadow: 0 6px 16px rgba(0,0,0,0.28);">
                                <img id="hero-live-logo-img" src="${escapeHtml(logoUrl)}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; ${logoUrl ? '' : 'display:none;'}">
                                <span id="hero-live-logo-fallback" style="font-size: 1.9rem; font-weight: 800; color: #ffffff; ${logoUrl ? 'display:none;' : 'display:flex;'}">
                                    ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                                </span>
                            </div>

                            <div>
                                <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
                                    <h1 id="hero-live-title" style="margin: 0; font-size: 1.55rem; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                                        ${escapeHtml(wsDisplayName)}
                                    </h1>
                                    <span id="hero-live-industry-pill" style="font-size: 0.7rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 999px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(8px); text-transform: uppercase;">
                                        ${escapeHtml(wsIndustry)}
                                    </span>
                                    <span style="font-size: 0.7rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 999px; background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); backdrop-filter: blur(8px);">
                                        Verified Workspace
                                    </span>
                                </div>
                                <p id="hero-live-tagline" style="margin: 0.25rem 0 0 0; font-size: 0.88rem; color: #e4e4e7; max-width: 650px; line-height: 1.4;">
                                    ${escapeHtml(wsTagline)}
                                </p>
                            </div>
                        </div>

                        <!-- Live Banner Switcher Quick Button -->
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" id="btn-hero-change-banner" class="btn" style="background: rgba(255,255,255,0.92); color: #18181b; font-weight: 700; font-size: 0.8rem; padding: 0.45rem 0.85rem; border-radius: 8px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.18); display: flex; align-items: center; gap: 0.4rem; cursor: pointer;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span>Change Banner Image</span>
                            </button>
                        </div>
                    </div>

                    <!-- Bottom Glass Info Strip (Separate Country, Region & Currency) -->
                    <div style="background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,0.15); padding: 0.65rem 1.85rem; display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap; font-size: 0.78rem; color: #f1f5f9;">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="opacity: 0.75; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.04em;">Workspace ID:</span>
                            <code style="font-family: monospace; font-weight: 700; color: #ffffff; background: rgba(255,255,255,0.12); padding: 0.12rem 0.45rem; border-radius: 5px;">${escapeHtml(wsIdText)}</code>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="opacity: 0.75; text-transform: uppercase; font-size: 0.7rem;">Country:</span>
                            <strong id="hero-live-country" style="color: #ffffff; display: flex; align-items: center; gap: 0.3rem;">
                                <span>${escapeHtml(matchedCountry.flag || '')}</span>
                                <span>${escapeHtml(wsCountry)}</span>
                            </strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="opacity: 0.75; text-transform: uppercase; font-size: 0.7rem;">Region:</span>
                            <strong id="hero-live-region" style="color: #cbd5e1;">${escapeHtml(wsRegion || 'Global')}</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="opacity: 0.75; text-transform: uppercase; font-size: 0.7rem;">Currency:</span>
                            <strong id="hero-live-currency" style="color: #ffffff; font-family: monospace; font-size: 0.9rem;">
                                ${escapeHtml(wsCurrencyCode)} (${escapeHtml(wsCurrency)})
                            </strong>
                        </div>
                        <div style="margin-left: auto; display: flex; align-items: center; gap: 0.4rem; opacity: 0.85;">
                            <span>Est. ${escapeHtml(wsCreatedDate)}</span>
                        </div>
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- SETTINGS SECTIONS: TOP STICKY NAVIGATION BAR              -->
                <!-- ======================================================== -->
                <div class="settings-top-sections-bar" style="position: sticky; top: 0.5rem; z-index: 35; background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 14px; padding: 0.65rem 1rem; margin-bottom: 0.75rem; box-shadow: 0 4px 20px -3px rgba(0,0,0,0.04); backdrop-filter: blur(12px);">
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem; margin-bottom: 0.55rem;">
                        <div style="display: flex; align-items: center; gap: 0.55rem;">
                            <div style="width: 28px; height: 28px; border-radius: 7px; background: #18181b; color: #ffffff; display: flex; align-items: center; justify-content: center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </div>
                            <span style="font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary);">Settings Sections</span>
                            <span id="rail-unsaved-pill" style="display: none; font-size: 0.68rem; font-weight: 700; padding: 0.12rem 0.55rem; border-radius: 999px; background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); margin-left: 0.35rem;">Unsaved Changes</span>
                        </div>

                        <div style="display: flex; align-items: center; gap: 0.55rem; margin-left: auto;">
                            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.74rem; color: var(--text-muted); background: #f4f4f5; padding: 0.22rem 0.55rem; border-radius: 6px; border: 1px solid #e4e4e7;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isMock ? '#10B981' : '#18181b'};"></span>
                                <span>${isMock ? 'Demo Sandbox · Local' : 'Cloud Firestore · Live'}</span>
                            </span>
                            <button type="button" id="btn-top-save-settings" class="btn btn-save-clean" style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 700; padding: 0.45rem 1rem; border-radius: 8px; background: #18181b; color: #ffffff; border: 1.5px solid #18181b; cursor: pointer; transition: all 0.2s ease;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                <span class="btn-save-label">Save Settings</span>
                            </button>
                        </div>
                    </div>

                    <nav id="settings-top-nav" style="display: flex; gap: 0.45rem; overflow-x: auto; padding-top: 0.65rem; border-top: 1px solid var(--border-color); scrollbar-width: thin;">
                        <button type="button" class="settings-tab-btn settings-top-btn active" data-tab="tab-general">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            <span>General, Brand &amp; Media</span>
                        </button>
                        <button type="button" class="settings-tab-btn settings-top-btn" data-tab="tab-currency">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                            <span>Country &amp; Currency</span>
                        </button>
                        <button type="button" class="settings-tab-btn settings-top-btn" data-tab="tab-receipts">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                            <span>Receipts &amp; Invoicing</span>
                        </button>
                        <button type="button" class="settings-tab-btn settings-top-btn" data-tab="tab-vending">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                            <span>Automation &amp; Stock</span>
                        </button>
                        <button type="button" class="settings-tab-btn settings-top-btn" data-tab="tab-data">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            <span>Data &amp; Excel Tools</span>
                        </button>
                        <button type="button" class="settings-tab-btn settings-top-btn" data-tab="tab-security">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            <span>Security &amp; Danger Zone</span>
                        </button>
                    </nav>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 1: GENERAL, BRAND & MEDIA -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane active" id="tab-general">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- SECTION 0: APPEARANCE & THEME MODE -->
                        <div class="card" style="border: 1px solid var(--border-color); border-radius: 18px; padding: 1.75rem; background: var(--bg-card); box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.65rem;">
                                    <div style="width: 34px; height: 34px; border-radius: 9px; background: var(--surface-100); color: var(--text-primary); display: flex; align-items: center; justify-content: center;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                    </div>
                                    <div>
                                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Theme &amp; Appearance</h3>
                                        <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">Select the interface appearance. 3 standard modes supported: Light, Dark, and System.</p>
                                    </div>
                                </div>
                                <span style="font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.65rem; border-radius: 999px; background: var(--surface-100); color: var(--text-secondary); border: 1px solid var(--border-color);">
                                    Active: <strong id="settings-active-theme-label" style="color:var(--text-primary); text-transform:capitalize;">${getThemeMode()}</strong>
                                </span>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                                <!-- LIGHT MODE CARD -->
                                <div class="settings-theme-card" data-theme-mode="light" style="cursor: pointer; border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1.1rem; background: var(--surface-50); transition: all 0.18s ease; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 28px; height: 28px; border-radius: 6px; background: #ffffff; border: 1px solid #d4d4d8; display: flex; align-items: center; justify-content: center; color: #18181b;">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                                </div>
                                                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary);">Light Mode</span>
                                            </div>
                                            <div class="settings-theme-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;"></div>
                                        </div>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.45;">
                                            Clean daylight interface with crisp white cards, light workspace and zinc borders.
                                        </p>
                                    </div>
                                    <div style="margin-top: 0.85rem; height: 24px; border-radius: 6px; background: #ffffff; border: 1px solid #e4e4e7; display: flex; align-items: center; padding: 0 8px; gap: 4px;">
                                        <div style="width: 8px; height: 8px; border-radius: 2px; background: #18181b;"></div>
                                        <div style="width: 32px; height: 4px; border-radius: 2px; background: #e4e4e7;"></div>
                                        <div style="width: 20px; height: 4px; border-radius: 2px; background: #e4e4e7; margin-left: auto;"></div>
                                    </div>
                                </div>

                                <!-- DARK GRAPHITE MODE CARD -->
                                <div class="settings-theme-card" data-theme-mode="dark" style="cursor: pointer; border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1.1rem; background: var(--surface-50); transition: all 0.18s ease; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 28px; height: 28px; border-radius: 6px; background: #272727; border: 1px solid #414141; display: flex; align-items: center; justify-content: center; color: #E6E6E6;">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                                </div>
                                                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary);">Dark (Graphite)</span>
                                            </div>
                                            <div class="settings-theme-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;"></div>
                                        </div>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.45;">
                                            Sophisticated layered graphite workspace (#181818, #272727) with silver-white typography.
                                        </p>
                                    </div>
                                    <div style="margin-top: 0.85rem; height: 24px; border-radius: 6px; background: #272727; border: 1px solid #414141; display: flex; align-items: center; padding: 0 8px; gap: 4px;">
                                        <div style="width: 8px; height: 8px; border-radius: 2px; background: #E6E6E6;"></div>
                                        <div style="width: 32px; height: 4px; border-radius: 2px; background: #414141;"></div>
                                        <div style="width: 20px; height: 4px; border-radius: 2px; background: #414141; margin-left: auto;"></div>
                                    </div>
                                </div>

                                <!-- SYSTEM AUTO SYNC CARD -->
                                <div class="settings-theme-card" data-theme-mode="system" style="cursor: pointer; border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1.1rem; background: var(--surface-50); transition: all 0.18s ease; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                                <div style="width: 28px; height: 28px; border-radius: 6px; background: var(--surface-100); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-primary);">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                                </div>
                                                <span style="font-weight: 800; font-size: 0.92rem; color: var(--text-primary);">System Auto</span>
                                            </div>
                                            <div class="settings-theme-dot" style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border-color); display: flex; align-items: center; justify-content: center;"></div>
                                        </div>
                                        <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.45;">
                                            Automatically harmonizes with your operating system's light or dark mode preferences.
                                        </p>
                                    </div>
                                    <div style="margin-top: 0.85rem; height: 24px; border-radius: 6px; background: linear-gradient(90deg, #ffffff 50%, #272727 50%); border: 1px solid var(--border-color); display: flex; align-items: center; padding: 0 8px; gap: 4px;">
                                        <div style="width: 8px; height: 8px; border-radius: 2px; background: #18181b;"></div>
                                        <div style="width: 20px; height: 4px; border-radius: 2px; background: #cbd5e1;"></div>
                                        <div style="width: 20px; height: 4px; border-radius: 2px; background: #505050; margin-left: auto;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 1: VISUAL MEDIA (LOGO 1:1 & BANNER 16:9) -->
                        <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 34px; height: 34px; border-radius: 9px; background: var(--surface-100); color: var(--text-primary); display: flex; align-items: center; justify-content: center;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                </div>
                                <div>
                                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Brand Visual Media (Logo &amp; Banner)</h3>
                                    <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary);">Upload square logo and high-res wide banner to personalize receipts, storefront, and dashboard.</p>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                                
                                <!-- 1. WORKSPACE LOGO (1:1 RECOMMENDED) -->
                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                            <label style="font-weight: 800; font-size: 0.88rem; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                                                Workspace Logo
                                            </label>
                                            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; background: var(--surface-100); color: var(--text-primary); border: 1px solid var(--border-color);">
                                                1:1 Recommended
                                            </span>
                                        </div>

                                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.85rem;">
                                            <!-- Logo Dropzone / Box (Square 1:1) -->
                                            <div id="ws-logo-dropzone" style="width: 84px; height: 84px; border-radius: 18px; background: #ffffff; border: 2px dashed var(--border-color); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s ease;" title="Click or Drag & Drop to change logo">
                                                <img id="ws-logo-preview-img" src="${escapeHtml(logoUrl)}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; ${logoUrl ? '' : 'display: none;'}">
                                                <div id="ws-logo-placeholder" style="display: ${logoUrl ? 'none' : 'flex'}; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); color: #ffffff; font-size: 1.85rem; font-weight: 800;">
                                                    ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                                                </div>
                                                <div id="ws-logo-overlay-hint" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); color: #ffffff; display: none; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; text-align: center;">
                                                    Upload
                                                </div>
                                            </div>

                                            <div style="flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 0.45rem;">
                                                <input type="file" id="set-logo-file" accept="image/png, image/jpeg, image/webp, image/svg+xml" style="display: none;">
                                                <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
                                                    <button type="button" id="btn-upload-ws-logo" class="btn btn-sm btn-secondary" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.85rem; display: flex; align-items: center; gap: 0.35rem;">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                        <span>Upload File</span>
                                                    </button>
                                                    <button type="button" id="btn-clear-ws-logo" class="btn btn-sm btn-outline" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.75rem; color: var(--danger); border-color: rgba(239,68,68,0.3); display: ${logoUrl ? 'inline-flex' : 'none'}; align-items: center; gap: 0.3rem;">
                                                        <span>Clear</span>
                                                    </button>
                                                </div>
                                                <small style="color: var(--text-muted); font-size: 0.74rem;">Square 256×256 to 1024×1024 px. Transparent PNG or SVG looks best.</small>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label style="font-weight: 600; font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Or direct Logo URL:</label>
                                        <input type="url" id="set-logo-url" class="form-control" value="${escapeHtml(logoUrl)}" placeholder="https://example.com/logo.png" style="border-radius: 8px; font-size: 0.82rem; padding: 0.45rem 0.65rem; background: #ffffff;">
                                    </div>
                                </div>

                                <!-- 2. WORKSPACE BANNER (16:9 / 1920x1080 RECOMMENDED) -->
                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between;">
                                    <div>
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                            <label style="font-weight: 800; font-size: 0.88rem; color: var(--text-primary); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line></svg>
                                                Cover Banner
                                            </label>
                                            <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px; background: #FAFAFA; color: #18181B; border: 1px solid #E4E4E7;">
                                                1920×1080 (16:9) Recommended
                                            </span>
                                        </div>

                                        <!-- Banner Dropzone Preview (16:9 Aspect Ratio) -->
                                        <div id="ws-banner-dropzone" style="
                                            position: relative;
                                            width: 100%;
                                            aspect-ratio: 16/7;
                                            border-radius: 12px;
                                            border: 2px dashed var(--border-color);
                                            background: ${bannerUrl ? `url('${escapeHtml(bannerUrl)}') center/cover no-repeat, #18181b` : 'linear-gradient(135deg, #18181b 0%, #27272a 100%)'};
                                            overflow: hidden;
                                            cursor: pointer;
                                            display: flex;
                                            align-items: center;
                                            justify-content: center;
                                            margin-bottom: 0.75rem;
                                            transition: all 0.2s ease;
                                        " title="Click or Drag & Drop to change banner">
                                            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.35);"></div>
                                            <div id="ws-banner-placeholder-text" style="position: relative; z-index: 2; text-align: center; color: #ffffff; padding: 0.5rem;">
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 4px; display: block; opacity: 0.85;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                <span style="font-size: 0.75rem; font-weight: 700;">${bannerUrl ? 'Click to Change Banner' : 'Drag & Drop or Choose Image'}</span>
                                            </div>
                                        </div>

                                        <!-- Controls: Internet Presets Picker vs Upload -->
                                        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.65rem;">
                                            <button type="button" id="btn-pick-internet-banner" class="btn btn-sm btn-primary" style="font-size: 0.8rem; font-weight: 700; padding: 0.45rem 0.95rem; display: flex; align-items: center; gap: 0.4rem; background: linear-gradient(180deg, #27272a 0%, #18181b 100%);">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                                <span>Choose from Internet Presets</span>
                                            </button>

                                            <input type="file" id="set-banner-file" accept="image/png, image/jpeg, image/webp" style="display: none;">
                                            <button type="button" id="btn-upload-ws-banner" class="btn btn-sm btn-secondary" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.85rem; display: flex; align-items: center; gap: 0.35rem;">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                <span>Upload</span>
                                            </button>

                                            <button type="button" id="btn-clear-ws-banner" class="btn btn-sm btn-outline" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.75rem; color: var(--danger); border-color: rgba(239,68,68,0.3); display: ${bannerUrl ? 'inline-flex' : 'none'}; align-items: center; gap: 0.3rem;">
                                                <span>Clear</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style="font-weight: 600; font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Or direct Banner Image URL:</label>
                                        <input type="url" id="set-banner-url" class="form-control" value="${escapeHtml(bannerUrl)}" placeholder="https://images.unsplash.com/..." style="border-radius: 8px; font-size: 0.82rem; padding: 0.45rem 0.65rem; background: #ffffff;">
                                    </div>
                                </div>

                            </div>
                        </div>

                        <!-- SECTION 2: BUSINESS CREDENTIALS & REGISTRATION -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 34px; height: 34px; border-radius: 9px; background: rgba(59, 130, 246, 0.08); color: #18181B; display: flex; align-items: center; justify-content: center;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Business Identity &amp; Classification</h3>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                                
                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Workspace Display Name <span style="color:#18181B;">*</span></label>
                                    <input type="text" id="set-name" class="form-control" value="${escapeHtml(wsDisplayName)}" required style="border-radius: 8px; font-weight: 600;">
                                    <small style="color: var(--text-muted); font-size: 0.74rem;">Visible across navigation header and internal staff logs.</small>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Commercial Trade / Storefront Name</label>
                                    <input type="text" id="set-trade-name" class="form-control" value="${escapeHtml(wsTradeName)}" placeholder="e.g. Apex Global Trade" style="border-radius: 8px; font-weight: 600;">
                                    <small style="color: var(--text-muted); font-size: 0.74rem;">Printed on invoices, customer portal header, and receipts.</small>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Industry / Business Category</label>
                                    <select id="set-industry" class="form-control" style="border-radius: 8px; font-weight: 600; cursor: pointer;">
                                        ${INDUSTRY_OPTIONS.map(opt => `
                                            <option value="${escapeHtml(opt)}" ${opt === wsIndustry ? 'selected' : ''}>${escapeHtml(opt)}</option>
                                        `).join('')}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Slogan / Business Tagline</label>
                                    <input type="text" id="set-tagline" class="form-control" value="${escapeHtml(wsTagline)}" placeholder="e.g. Build • Manage • Sell • Scale" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Website / Online Storefront URL</label>
                                    <input type="url" id="set-website" class="form-control" value="${escapeHtml(wsWebsite)}" placeholder="https://example.com" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Tax ID / VAT / GST / BIN Registration</label>
                                    <input type="text" id="set-tax-id" class="form-control" value="${escapeHtml(wsTaxId)}" placeholder="e.g. VAT-99482-TX" style="border-radius: 8px;">
                                </div>

                            </div>
                        </div>

                        <!-- SECTION 3: OFFICIAL CONTACT & PHYSICAL LOCATION -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 34px; height: 34px; border-radius: 9px; background: #F4F4F5; color: #18181B; display: flex; align-items: center; justify-content: center;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Official Contact &amp; Physical Location</h3>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Official Business Email <span style="color:#18181B;">*</span></label>
                                    <input type="email" id="set-email" class="form-control" value="${escapeHtml(wsEmail)}" required style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Primary Business Phone / WhatsApp</label>
                                    <input type="text" id="set-phone" class="form-control" value="${escapeHtml(wsPhone)}" placeholder="+1 (555) 000-0000" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Secondary / Support Hotline</label>
                                    <input type="text" id="set-support-phone" class="form-control" value="${escapeHtml(wsSupportPhone)}" placeholder="+1 (555) 000-0001" style="border-radius: 8px;">
                                </div>

                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Registered Headquarters Physical Address</label>
                                    <textarea id="set-address" class="form-control" rows="3" placeholder="Suite, Street Number, City, State/Province, Postal Code, Country" style="border-radius: 8px; font-family: inherit;">${escapeHtml(wsAddress)}</textarea>
                                </div>
                            </div>
                        </div>

                    </div>

                </div>

                <!-- ======================================================== -->
                <!-- TAB 2: COUNTRY & CURRENCY SETTINGS                         -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-currency" style="display: none;">
                    <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                        
                        <!-- Top Header with Live Sample -->
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                            <div>
                                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.55rem;">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    Country &amp; Currency Preferences
                                </h3>
                                <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.88rem;">
                                    Country and accounting currency are two independent settings. The workspace can operate in one nation while using another nation's currency.
                                </p>
                            </div>

                            <!-- Live Sample Badge -->
                            <div style="background: #fafaf9; border: 1.5px solid #e4e4e7; padding: 0.6rem 1.25rem; border-radius: 12px; display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 0.75rem; font-weight: 700; color: #52525b; text-transform: uppercase;">Live Ledger Preview:</span>
                                <strong id="currency-live-preview" style="color: #09090b; font-family: monospace; font-size: 1.1rem; font-weight: 800;">
                                    ${escapeHtml(matchedCountry.flag || '')} ${escapeHtml(wsCountry)} • ${escapeHtml(wsCurrencyCode)} (${escapeHtml(wsCurrency)}) 1,450.00
                                </strong>
                            </div>
                        </div>

                        <!-- Financial Accounting Advisory Notice -->
                        <div style="background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.35); border-radius: 14px; padding: 1.1rem 1.35rem; margin-bottom: 1.75rem; display: flex; gap: 0.9rem; align-items: flex-start;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(245, 158, 11, 0.15); color: #d97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <div>
                                <strong style="color: #92400e; font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">Financial Integrity Advisory</strong>
                                <p style="color: #78350f; font-size: 0.83rem; margin: 0; line-height: 1.55;">
                                    Currency codes and symbols are stored independently. Updating the workspace currency updates display formatting and future transaction ledgers. <strong>Historical financial records are preserved in their originally recorded amounts and will not be silently recalculated.</strong>
                                </p>
                            </div>
                        </div>

                        <!-- 2-Column Independent Settings Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 1.75rem;">
                            
                            <!-- Card 1: Country & Jurisdiction -->
                            <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.35rem; display: flex; flex-direction: column; gap: 1.15rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.65rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">1. Operating Jurisdiction</h4>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">
                                        Workspace Country <span style="color:#18181B;">*</span>
                                    </label>
                                    <select id="set-country" class="form-control" style="border-radius: 8px; font-weight: 600; cursor: pointer;">
                                        ${COUNTRIES_LIST.map(c => `
                                            <option value="${escapeHtml(c.name)}" data-code="${escapeHtml(c.code)}" data-flag="${escapeHtml(c.flag)}" data-region="${escapeHtml(c.region || '')}" ${c.name.toLowerCase() === wsCountry.toLowerCase() || c.code === wsCountryCode ? 'selected' : ''}>
                                                ${escapeHtml(c.flag)} ${escapeHtml(c.name)} (${escapeHtml(c.code)})
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small style="color: var(--text-muted); font-size: 0.74rem; margin-top: 0.3rem; display: block;">
                                        Official operating nation. Changing country does NOT alter your chosen currency.
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">
                                        Workspace Region / State / Province
                                    </label>
                                    <input type="text" id="set-region" class="form-control" value="${escapeHtml(wsRegion)}" placeholder="e.g. England, California, Bavaria..." style="border-radius: 8px; font-weight: 600;">
                                    <small style="color: var(--text-muted); font-size: 0.74rem; margin-top: 0.3rem; display: block;">
                                        Sub-national jurisdiction displayed in the workspace header banner.
                                    </small>
                                </div>
                            </div>

                            <!-- Card 2: Accounting Currency Standard -->
                            <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.35rem; display: flex; flex-direction: column; gap: 1.15rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.65rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                    <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: var(--text-primary);">2. Monetary Currency (ISO 4217)</h4>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">
                                        Select Currency Code (ISO 4217) <span style="color:#18181B;">*</span>
                                    </label>
                                    <select id="set-currency-code" class="form-control" style="border-radius: 8px; font-weight: 700; font-family: monospace; cursor: pointer;">
                                        ${CURRENCY_LIST.map(c => `
                                            <option value="${escapeHtml(c.code)}" data-name="${escapeHtml(c.name)}" data-symbol="${escapeHtml(c.symbol)}" ${c.code.toUpperCase() === wsCurrencyCode.toUpperCase() ? 'selected' : ''}>
                                                ${escapeHtml(c.flag || '')} ${escapeHtml(c.code)} — ${escapeHtml(c.name)} (${escapeHtml(c.symbol)})
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small style="color: var(--text-muted); font-size: 0.74rem; margin-top: 0.3rem; display: block;">
                                        Standard ISO 4217 financial code stored independently from symbol.
                                    </small>
                                </div>

                                <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 0.75rem;">
                                    <div class="form-group">
                                        <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">
                                            Currency Full Name
                                        </label>
                                        <input type="text" id="set-currency-name" class="form-control" value="${escapeHtml(wsCurrencyName)}" placeholder="e.g. Euro, Pound Sterling" style="border-radius: 8px; font-weight: 600;">
                                    </div>

                                    <div class="form-group">
                                        <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">
                                            Symbol (Max 3)
                                        </label>
                                        <div style="display: flex; gap: 0.4rem; align-items: center;">
                                            <input type="text" id="set-currency" class="form-control" maxlength="3" value="${escapeHtml(wsCurrency)}" placeholder="$" style="font-family: monospace; font-weight: 800; font-size: 1.15rem; text-align: center; border-radius: 8px; color: var(--primary);">
                                            <button type="button" id="btn-find-currency" class="btn btn-secondary" title="Search World Currencies" style="padding: 0.5rem 0.65rem; border-radius: 8px;">
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <!-- Popular Quick Presets Strip -->
                        <div style="border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                            <label style="font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.55rem; display: block;">
                                Instant 1-Click Currency Presets:
                            </label>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="currency-presets-container">
                                <button type="button" class="btn-currency-quick" data-code="USD" data-name="US Dollar" data-symbol="$" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">$ USD</button>
                                <button type="button" class="btn-currency-quick" data-code="EUR" data-name="Euro" data-symbol="€" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">€ EUR</button>
                                <button type="button" class="btn-currency-quick" data-code="GBP" data-name="British Pound" data-symbol="£" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">£ GBP</button>
                                <button type="button" class="btn-currency-quick" data-code="BDT" data-name="Bangladeshi Taka" data-symbol="৳" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">৳ BDT</button>
                                <button type="button" class="btn-currency-quick" data-code="INR" data-name="Indian Rupee" data-symbol="₹" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">₹ INR</button>
                                <button type="button" class="btn-currency-quick" data-code="AED" data-name="UAE Dirham" data-symbol="AED" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">AED</button>
                                <button type="button" class="btn-currency-quick" data-code="CAD" data-name="Canadian Dollar" data-symbol="CA$" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">CA$</button>
                                <button type="button" class="btn-currency-quick" data-code="JPY" data-name="Japanese Yen" data-symbol="¥" style="padding: 0.45rem 0.85rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">¥ JPY</button>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 3: RECEIPTS & INVOICING -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-receipts" style="display: none;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                        
                        <!-- Left Form -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(225, 29, 72, 0.08); color: #18181B; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Printout &amp; Ticket Details</h3>
                            </div>

                            <form id="settings-receipt-form" style="display: flex; flex-direction: column; gap: 1.15rem;">
                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Receipt Header / Shop Name</label>
                                    <input type="text" id="set-shop-name" class="form-control" value="${escapeHtml(wsShopName)}" placeholder="e.g. Apex Superstore" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Receipt Footer Note</label>
                                    <input type="text" id="set-end-msg" class="form-control" value="${escapeHtml(wsEndMsg)}" placeholder="e.g. Goods once sold are returnable within 7 days." style="border-radius: 8px;">
                                </div>

                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-top: 0.5rem;">
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.65rem;">Customer Information on Invoices</div>
                                    
                                    <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.86rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
                                        <input type="checkbox" id="set-show-cust-name" ${printCustName ? 'checked' : ''} style="width:16px; height:16px; accent-color:#18181B;">
                                        <span>Print Customer Name on POS Invoices</span>
                                    </label>

                                    <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.86rem; font-weight: 600; color: var(--text-primary);">
                                        <input type="checkbox" id="set-show-cust-num" ${printCustPhone ? 'checked' : ''} style="width:16px; height:16px; accent-color:#18181B;">
                                        <span>Print Customer Phone Number on Receipts</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        <!-- Right: Interactive Live Ticket Box -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
                            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem;">Interactive Live Receipt Preview</div>
                            
                            <div style="background: #fafafa; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 1.5rem; font-family: monospace; font-size: 0.82rem; color: #1e293b; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                                        <strong id="preview-shop-title" style="font-size: 1rem; font-weight: 800; display: block; text-transform: uppercase;">${escapeHtml(wsShopName)}</strong>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">INVOICE #INV-2026-0042</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">${new Date().toLocaleDateString()}</div>
                                    </div>

                                    <div id="preview-cust-meta" style="margin-bottom: 0.75rem; font-size: 0.75rem; color: #475569;">
                                        ${printCustName ? '<div>Customer: Alex Rivera</div>' : ''}
                                        ${printCustPhone ? '<div>Phone: +1 555-0199</div>' : ''}
                                    </div>

                                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.4rem; font-weight: 700;">
                                        <span>ITEM</span>
                                        <span>QTY</span>
                                        <span>TOTAL</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
                                        <span>Premium Item</span>
                                        <span>2x</span>
                                        <span>${escapeHtml(wsCurrency)} 32.00</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.2rem 0; border-top: 1px dashed #cbd5e1; margin-top: 0.4rem; font-weight: 800;">
                                        <span>TOTAL DUE</span>
                                        <span id="preview-ticket-total" style="color: var(--text-primary);">${escapeHtml(wsCurrency)} 32.00</span>
                                    </div>
                                </div>

                                <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem; margin-top: 1rem; font-size: 0.74rem; color: #64748b;" id="preview-footer-note">
                                    ${escapeHtml(wsEndMsg)}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 4: AUTOMATION & VENDING MODE -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-vending" style="display: none;">
                    <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.25rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 260px;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--surface-100); color: var(--text-primary); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                    </div>
                                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">Vending Mode (Automated Stock Deductions)</h3>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.55; margin: 0;">
                                    When enabled, creating customer POS receipts or business invoices will automatically decrement product stock quantities in real time.
                                </p>
                            </div>

                            <label class="switch-toggle" style="position: relative; display: inline-flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                                <input type="checkbox" id="set-vending" ${isVendingActive ? 'checked' : ''} style="width: 22px; height: 22px; accent-color: #18181b;">
                                <span id="vending-status-text" style="font-size: 0.9rem; font-weight: 800; color: ${isVendingActive ? 'var(--text-primary)' : 'var(--text-muted)'};">
                                    ${isVendingActive ? 'ENABLED' : 'DISABLED'}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 5: DATA & BACKUP TOOLS -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-data" style="display: none;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                        
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); color: #18181B; display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    </div>
                                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Excel &amp; CSV Migration Tools</h3>
                                </div>
                                <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 1.25rem;">
                                    Import hundreds of products simultaneously from spreadsheet templates or export complete catalog backups.
                                </p>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                    <button type="button" id="btn-settings-headers-template" class="btn btn-sm btn-secondary" style="flex: 1; font-size: 0.8rem; font-weight: 600; padding: 0.5rem 0.75rem; border-radius: 8px;">
                                        Headers Template (.xlsx)
                                    </button>
                                    <button type="button" id="btn-settings-sample-template" class="btn btn-sm btn-secondary" style="flex: 1; font-size: 0.8rem; font-weight: 600; padding: 0.5rem 0.75rem; border-radius: 8px;">
                                        Sample Data Template (.xlsx)
                                    </button>
                                </div>
                                <button type="button" id="btn-settings-import-excel" class="btn btn-primary" style="font-size: 0.86rem; font-weight: 700; padding: 0.65rem; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    <span>Import Excel File (.xlsx)</span>
                                </button>
                            </div>
                        </div>

                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: #F4F4F5; color: #18181B; display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                                    </div>
                                    <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Market Inserter &amp; Export Backup</h3>
                                </div>
                                <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 1.25rem;">
                                    Use the spreadsheet-like grid editor for ultra-fast bulk entry or download an encrypted full JSON backup.
                                </p>
                            </div>

                            <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
                                <button type="button" id="btn-settings-market-inserter" class="btn btn-secondary" style="flex: 1; font-size: 0.85rem; font-weight: 700; padding: 0.65rem; border-radius: 10px;">
                                    Open Market Inserter Grid
                                </button>
                                <button type="button" id="btn-settings-export-data" class="btn btn-outline" style="flex: 1; font-size: 0.85rem; font-weight: 700; padding: 0.65rem; border-radius: 10px;">
                                    Export Full Backup
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 6: SECURITY, AUDIT & DANGER ZONE -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-security" style="display: none;">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Unique ID & Audit Card -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); color: #18181B; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Unique Identifier &amp; Audit Trail</h3>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1.25rem;">
                                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">Unique Workspace ID</div>
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                                        <code style="font-family: monospace; font-size: 0.95rem; font-weight: 800; color: var(--primary);">${escapeHtml(wsIdText)}</code>
                                        <button type="button" id="btn-copy-settings-ws-id" class="btn btn-sm btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">
                                            Copy ID
                                        </button>
                                    </div>
                                </div>

                                <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.15rem; font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.5rem;">
                                    <div>
                                        <strong style="color: var(--text-primary);">Created Date:</strong> ${escapeHtml(wsCreatedDate)}
                                        ${wsCreatedTimestamp ? `<div style="font-family:monospace; font-size:0.72rem; color:var(--text-muted);">${escapeHtml(wsCreatedTimestamp)}</div>` : ''}
                                    </div>
                                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                        <strong style="color: var(--text-primary);">Last Updated:</strong> ${escapeHtml(wsUpdatedDate)}
                                        ${wsUpdateTimestamp ? `<div style="font-family:monospace; font-size:0.72rem; color:var(--text-muted);">${escapeHtml(wsUpdateTimestamp)}</div>` : ''}
                                    </div>
                                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                        <strong style="color: var(--text-primary);">Last Modified By:</strong>
                                        <span style="font-weight:600; color:var(--text-primary);"> ${escapeHtml(wsUpdatorEmail || 'Admin')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Danger Zone -->
                        <div style="background: #ffffff; border: 1.5px solid rgba(239, 68, 68, 0.25); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(239,68,68,0.03);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.1); color: var(--danger); display: flex; align-items: center; justify-content: center;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--danger);">Danger Zone</h3>
                            </div>
                            
                            <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">
                                ${isAdmin 
                                    ? 'Permanently destroy this workspace. All catalog products, invoices, categories, clients, and assets will be purged forever.' 
                                    : 'Disconnect your account from this workspace and remove your access.'}
                            </p>

                            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                                ${isAdmin ? `
                                    <button type="button" id="btn-delete-workspace" class="btn btn-outline" style="color: #ffffff; background: #18181B; border-color: #27272A; font-weight: 700; font-size: 0.85rem; padding: 0.6rem 1.25rem; border-radius: 10px;">
                                        Delete Entire Workspace
                                    </button>
                                ` : `
                                    <button type="button" id="btn-leave-workspace" class="btn btn-outline" style="color: var(--danger); border-color: rgba(239,68,68,0.4); font-weight: 700; font-size: 0.85rem; padding: 0.6rem 1.25rem; border-radius: 10px;">
                                        Leave Workspace
                                    </button>
                                `}
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        `;

        // Tab Switching
        const tabBtns = container.querySelectorAll('.settings-tab-btn');
        const tabPanes = container.querySelectorAll('.settings-tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => {
                    const isActive = b.getAttribute('data-tab') === targetTab;
                    b.classList.toggle('active', isActive);
                    if (b.classList.contains('settings-top-btn')) {
                        b.style.background = isActive ? '#18181b' : 'transparent';
                        b.style.color = isActive ? '#ffffff' : 'var(--text-secondary)';
                        b.style.borderColor = isActive ? '#18181b' : 'transparent';
                    } else {
                        b.style.border = isActive ? '1px solid var(--border-color)' : '1px solid transparent';
                        b.style.background = isActive ? '#ffffff' : 'transparent';
                        b.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
                    }
                });
                tabPanes.forEach(p => {
                    p.style.display = p.id === targetTab ? 'block' : 'none';
                    p.classList.toggle('active', p.id === targetTab);
                });
            });
        });

        // Theme Mode settings controller
        const themeCards = container.querySelectorAll('.settings-theme-card');
        const activeThemeLabel = container.querySelector('#settings-active-theme-label');

        const syncSettingsThemeCards = (mode) => {
            const effective = (mode === 'system') ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light') : mode;
            themeCards.forEach(c => {
                const cMode = c.getAttribute('data-theme-mode');
                const isSelected = cMode === mode;
                c.classList.toggle('selected', isSelected);
                if (isSelected) {
                    c.style.borderColor = effective === 'dark' ? '#E6E6E6' : '#18181B';
                    c.style.boxShadow = '0 0 0 2px rgba(80, 80, 80, 0.25)';
                } else {
                    c.style.borderColor = 'var(--border-color)';
                    c.style.boxShadow = 'none';
                }
                const dot = c.querySelector('.settings-theme-dot');
                if (dot) {
                    dot.style.background = isSelected ? (effective === 'dark' ? '#E6E6E6' : '#18181B') : 'transparent';
                }
            });
            if (activeThemeLabel) {
                activeThemeLabel.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            }
        };

        syncSettingsThemeCards(getThemeMode());

        themeCards.forEach(card => {
            card.addEventListener('click', () => {
                const selectedMode = card.getAttribute('data-theme-mode');
                applyThemeMode(selectedMode);
                syncSettingsThemeCards(selectedMode);
                showAlert.success(`Theme updated to ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}.`);
            });
        });

        // 1. Query all form input controls
        const vendingInput = container.querySelector('#set-vending');
        const vendingLabel = container.querySelector('#vending-status-text');

        const setShopName = container.querySelector('#set-shop-name');
        const setEndMsg = container.querySelector('#set-end-msg');
        const setCustName = container.querySelector('#set-show-cust-name');
        const setCustNum = container.querySelector('#set-show-cust-num');
        const previewShopTitle = container.querySelector('#preview-shop-title');
        const previewCustMeta = container.querySelector('#preview-cust-meta');
        const previewFooterNote = container.querySelector('#preview-footer-note');

        const countrySelect = container.querySelector('#set-country');
        const regionInput = container.querySelector('#set-region');
        const currencyCodeSelect = container.querySelector('#set-currency-code');
        const currencyNameInput = container.querySelector('#set-currency-name');
        const currencyInput = container.querySelector('#set-currency');
        const currencyPreview = container.querySelector('#currency-live-preview');
        const previewTicketTotal = container.querySelector('#preview-ticket-total');
        const btnFindCurrency = container.querySelector('#btn-find-currency');
        const heroLiveCurrency = container.querySelector('#hero-live-currency');
        const heroLiveCountry = container.querySelector('#hero-live-country');
        const heroLiveRegion = container.querySelector('#hero-live-region');

        let selectedWsLogoFile = null;
        let selectedWsBannerFile = null;

        const logoFileInput = container.querySelector('#set-logo-file');
        const logoUrlInput = container.querySelector('#set-logo-url');
        const btnUploadLogo = container.querySelector('#btn-upload-ws-logo');
        const btnClearLogo = container.querySelector('#btn-clear-ws-logo');
        const logoPreviewImg = container.querySelector('#ws-logo-preview-img');
        const logoPlaceholder = container.querySelector('#ws-logo-placeholder');
        const logoDropzone = container.querySelector('#ws-logo-dropzone');
        const logoOverlayHint = container.querySelector('#ws-logo-overlay-hint');
        const heroLiveLogoImg = container.querySelector('#hero-live-logo-img');
        const heroLiveLogoFallback = container.querySelector('#hero-live-logo-fallback');

        const bannerFileInput = container.querySelector('#set-banner-file');
        const bannerUrlInput = container.querySelector('#set-banner-url');
        const btnUploadBanner = container.querySelector('#btn-upload-ws-banner');
        const btnClearBanner = container.querySelector('#btn-clear-ws-banner');
        const bannerDropzone = container.querySelector('#ws-banner-dropzone');
        const btnPickInternetBanner = container.querySelector('#btn-pick-internet-banner');
        const btnHeroChangeBanner = container.querySelector('#btn-hero-change-banner');
        const heroBrandCard = container.querySelector('#settings-live-brand-hero');

        const nameInput = container.querySelector('#set-name');
        const taglineInput = container.querySelector('#set-tagline');
        const industrySelect = container.querySelector('#set-industry');
        const emailInput = container.querySelector('#set-email');
        const tradeNameInput = container.querySelector('#set-trade-name');
        const websiteInput = container.querySelector('#set-website');
        const taxIdInput = container.querySelector('#set-tax-id');
        const phoneInput = container.querySelector('#set-phone');
        const supportPhoneInput = container.querySelector('#set-support-phone');
        const addressInput = container.querySelector('#set-address');

        const btnHeaderSave = container.querySelector('#btn-header-save-settings');
        const btnTopSave = container.querySelector('#btn-top-save-settings');
        const headerUnsavedDot = container.querySelector('#header-unsaved-dot');
        const railUnsavedPill = container.querySelector('#rail-unsaved-pill');

        const getAllSaveButtons = () => [btnHeaderSave, btnTopSave].filter(Boolean);
        const getAllDiscardButtons = () => [];

        // 2. Snapshot & Dirty Checking for All Save Buttons
        const captureFormState = () => ({
            enableVending: Boolean(vendingInput?.checked),
            currencySymbol: (currencyInput ? currencyInput.value.trim().substring(0, 3) : (wsCurrency || '$')),
            currencyCode: (currencyCodeSelect ? currencyCodeSelect.value.toUpperCase() : (wsCurrencyCode || 'USD')),
            currencyName: (currencyNameInput ? currencyNameInput.value.trim() : (wsCurrencyName || '')),
            country: (countrySelect ? countrySelect.value.trim() : (wsCountry || '')),
            countryCode: (countrySelect?.selectedOptions?.[0]?.getAttribute('data-code') || wsCountryCode || '').trim(),
            region: (regionInput ? regionInput.value.trim() : (wsRegion || '')),
            name: (nameInput ? nameInput.value.trim() : (wsDisplayName || '')),
            tradeName: (tradeNameInput ? tradeNameInput.value.trim() : (wsTradeName || '')),
            industry: industrySelect ? industrySelect.value : (wsIndustry || 'General Commercial'),
            tagline: (taglineInput ? taglineInput.value.trim() : (wsTagline || '')),
            website: (websiteInput ? websiteInput.value.trim() : (wsWebsite || '')),
            taxId: (taxIdInput ? taxIdInput.value.trim() : (wsTaxId || '')),
            email: (emailInput ? emailInput.value.trim() : (wsEmail || '')),
            phone: (phoneInput ? phoneInput.value.trim() : (wsPhone || '')),
            supportPhone: (supportPhoneInput ? supportPhoneInput.value.trim() : (wsSupportPhone || '')),
            address: (addressInput ? addressInput.value.trim() : (wsAddress || '')),
            shopName: (setShopName ? setShopName.value.trim() : (wsShopName || '')),
            endMessage: (setEndMsg ? setEndMsg.value.trim() : (wsEndMsg || '')),
            customerName: Boolean(setCustName?.checked),
            customerNumber: Boolean(setCustNum?.checked),
            logoUrl: (logoUrlInput ? logoUrlInput.value.trim() : (logoUrl || '')),
            bannerUrl: (bannerUrlInput ? bannerUrlInput.value.trim() : (bannerUrl || '')),
            hasLogoFile: Boolean(selectedWsLogoFile),
            hasBannerFile: Boolean(selectedWsBannerFile)
        });

        let savedSnapshot = captureFormState();

        function checkDirty() {
            const current = captureFormState();
            const isDirty = (
                current.enableVending !== savedSnapshot.enableVending ||
                current.currencySymbol !== savedSnapshot.currencySymbol ||
                current.currencyCode !== savedSnapshot.currencyCode ||
                current.currencyName !== savedSnapshot.currencyName ||
                current.country !== savedSnapshot.country ||
                current.region !== savedSnapshot.region ||
                current.name !== savedSnapshot.name ||
                current.tradeName !== savedSnapshot.tradeName ||
                current.industry !== savedSnapshot.industry ||
                current.tagline !== savedSnapshot.tagline ||
                current.website !== savedSnapshot.website ||
                current.taxId !== savedSnapshot.taxId ||
                current.email !== savedSnapshot.email ||
                current.phone !== savedSnapshot.phone ||
                current.supportPhone !== savedSnapshot.supportPhone ||
                current.address !== savedSnapshot.address ||
                current.shopName !== savedSnapshot.shopName ||
                current.endMessage !== savedSnapshot.endMessage ||
                current.customerName !== savedSnapshot.customerName ||
                current.customerNumber !== savedSnapshot.customerNumber ||
                current.logoUrl !== savedSnapshot.logoUrl ||
                current.bannerUrl !== savedSnapshot.bannerUrl ||
                current.hasLogoFile ||
                current.hasBannerFile
            );

            const allSaveBtns = getAllSaveButtons();
            allSaveBtns.forEach(btn => {
                if (isDirty) {
                    btn.removeAttribute('disabled');
                    btn.disabled = false;
                    btn.classList.add('btn-save-dirty');
                    btn.classList.remove('btn-save-clean', 'btn-disabled');
                    btn.style.setProperty('background', '#18181b', 'important');
                    btn.style.setProperty('color', '#ffffff', 'important');
                    btn.style.setProperty('border', '1.5px solid #18181b', 'important');
                    btn.style.setProperty('opacity', '1', 'important');
                    btn.style.setProperty('cursor', 'pointer', 'important');
                    btn.style.setProperty('pointer-events', 'auto', 'important');
                    btn.style.setProperty('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.25)', 'important');
                } else {
                    btn.setAttribute('disabled', 'true');
                    btn.disabled = true;
                    btn.classList.remove('btn-save-dirty');
                    btn.classList.add('btn-save-clean');
                    btn.style.setProperty('background', '#f4f4f5', 'important');
                    btn.style.setProperty('color', '#a1a1aa', 'important');
                    btn.style.setProperty('border', '1px solid #e4e4e7', 'important');
                    btn.style.setProperty('opacity', '0.5', 'important');
                    btn.style.setProperty('cursor', 'not-allowed', 'important');
                    btn.style.setProperty('pointer-events', 'none', 'important');
                    btn.style.setProperty('box-shadow', 'none', 'important');
                }
            });

            // Discard Buttons: only shown when changes occurred
            const allDiscardBtns = getAllDiscardButtons();
            allDiscardBtns.forEach(btn => {
                btn.style.display = isDirty ? 'inline-flex' : 'none';
                btn.disabled = !isDirty;
            });

            if (headerUnsavedDot) {
                headerUnsavedDot.style.display = isDirty ? 'inline-block' : 'none';
            }
            if (railUnsavedPill) {
                railUnsavedPill.style.display = isDirty ? 'inline-block' : 'none';
            }
        }

        // 3. Attach Form Event Listeners
        if (vendingInput && vendingLabel) {
            vendingInput.addEventListener('change', () => {
                const checked = vendingInput.checked;
                vendingLabel.textContent = checked ? 'ENABLED' : 'DISABLED';
                vendingLabel.style.color = checked ? '#18181B' : 'var(--text-muted)';
                checkDirty();
            });
        }

        const updateTicketPreview = () => {
            if (previewShopTitle) previewShopTitle.textContent = (setShopName?.value || wsShopName || 'STORE').toUpperCase();
            if (previewFooterNote) previewFooterNote.textContent = setEndMsg?.value || wsEndMsg || '';
            if (previewCustMeta) {
                let html = '';
                if (setCustName?.checked) html += '<div>Customer: Alex Rivera</div>';
                if (setCustNum?.checked) html += '<div>Phone: +1 555-0199</div>';
                previewCustMeta.innerHTML = html;
            }
        };

        if (setShopName) setShopName.addEventListener('input', () => { updateTicketPreview(); checkDirty(); });
        if (setEndMsg) setEndMsg.addEventListener('input', () => { updateTicketPreview(); checkDirty(); });
        if (setCustName) setCustName.addEventListener('change', () => { updateTicketPreview(); checkDirty(); });
        if (setCustNum) setCustNum.addEventListener('change', () => { updateTicketPreview(); checkDirty(); });

        const updateCurrencyPreview = () => {
            const sym = (currencyInput?.value || '$').trim().substring(0, 3) || '$';
            const code = (currencyCodeSelect?.value || 'EUR').toUpperCase();
            const countryName = countrySelect?.value || wsCountry || 'United Kingdom';
            const selectedOpt = countrySelect?.selectedOptions && countrySelect.selectedOptions[0];
            const flag = (selectedOpt && selectedOpt.getAttribute('data-flag')) || matchedCountry.flag || '';
            const regionVal = (regionInput?.value || '').trim() || 'Global';

            if (currencyPreview) {
                currencyPreview.textContent = `${flag} ${countryName} • ${code} (${sym}) 1,450.00`;
            }
            if (previewTicketTotal) previewTicketTotal.textContent = `${sym} 32.00`;
            if (heroLiveCurrency) heroLiveCurrency.textContent = `${code} (${sym})`;
            if (heroLiveCountry) {
                heroLiveCountry.innerHTML = `<span>${escapeHtml(flag)}</span> <span>${escapeHtml(countryName)}</span>`;
            }
            if (heroLiveRegion) {
                heroLiveRegion.textContent = regionVal;
            }
        };

        if (countrySelect) {
            countrySelect.addEventListener('change', () => {
                updateCurrencyPreview();
                checkDirty();
            });
        }

        if (regionInput) {
            regionInput.addEventListener('input', () => {
                updateCurrencyPreview();
                checkDirty();
            });
        }

        if (currencyCodeSelect) {
            currencyCodeSelect.addEventListener('change', (e) => {
                const opt = e.target.selectedOptions && e.target.selectedOptions[0];
                if (opt) {
                    const cName = opt.getAttribute('data-name');
                    const cSym = opt.getAttribute('data-symbol');
                    if (cName && currencyNameInput) currencyNameInput.value = cName;
                    if (cSym && currencyInput) currencyInput.value = cSym.substring(0, 3);
                }
                updateCurrencyPreview();
                checkDirty();
            });
        }

        if (currencyNameInput) {
            currencyNameInput.addEventListener('input', () => {
                checkDirty();
            });
        }

        if (currencyInput) {
            currencyInput.addEventListener('input', (e) => {
                if (e.target.value.length > 3) {
                    e.target.value = e.target.value.substring(0, 3);
                }
                updateCurrencyPreview();
                checkDirty();
            });
        }

        if (btnFindCurrency) {
            btnFindCurrency.addEventListener('click', () => {
                openCurrencyPickerModal(currencyInput?.value || '$', (selectedSymbol, code, name) => {
                    const cleanSymbol = selectedSymbol.substring(0, 3);
                    if (currencyInput) currencyInput.value = cleanSymbol;
                    if (currencyCodeSelect && code) currencyCodeSelect.value = code;
                    if (currencyNameInput && name) currencyNameInput.value = name;
                    updateCurrencyPreview();
                    checkDirty();
                    showAlert.success(`Currency selected: ${name} (${cleanSymbol})`);
                });
            });
        }

        container.querySelectorAll('.btn-currency-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const sym = (btn.getAttribute('data-symbol') || '$').substring(0, 3);
                const code = btn.getAttribute('data-code');
                const name = btn.getAttribute('data-name');
                if (currencyInput) currencyInput.value = sym;
                if (currencyCodeSelect && code) currencyCodeSelect.value = code;
                if (currencyNameInput && name) currencyNameInput.value = name;
                updateCurrencyPreview();
                checkDirty();
            });
        });

        // Copy Workspace ID in Settings
        container.querySelector('#btn-copy-settings-ws-id')?.addEventListener('click', () => {
            if (navigator.clipboard && wsIdText) {
                navigator.clipboard.writeText(wsIdText);
                showAlert.success("Workspace ID copied to clipboard!");
            }
        });

        // =============================================================
        // LOGO & BANNER MEDIA CONTROLS & LIVE HERO PREVIEW SYNC
        // =============================================================
        const updateLogoDisplay = (srcUrl) => {
            if (srcUrl) {
                if (logoPreviewImg) {
                    logoPreviewImg.src = srcUrl;
                    logoPreviewImg.style.display = 'block';
                }
                if (logoPlaceholder) logoPlaceholder.style.display = 'none';
                if (btnClearLogo) btnClearLogo.style.display = 'inline-flex';

                if (heroLiveLogoImg) {
                    heroLiveLogoImg.src = srcUrl;
                    heroLiveLogoImg.style.display = 'block';
                }
                if (heroLiveLogoFallback) heroLiveLogoFallback.style.display = 'none';
            } else {
                if (logoPreviewImg) {
                    logoPreviewImg.src = '';
                    logoPreviewImg.style.display = 'none';
                }
                if (logoPlaceholder) {
                    logoPlaceholder.style.display = 'flex';
                    const curName = (container.querySelector('#set-name')?.value || wsDisplayName || 'W').trim();
                    logoPlaceholder.textContent = (curName.charAt(0) || 'W').toUpperCase();
                }
                if (btnClearLogo) btnClearLogo.style.display = 'none';

                if (heroLiveLogoImg) {
                    heroLiveLogoImg.src = '';
                    heroLiveLogoImg.style.display = 'none';
                }
                if (heroLiveLogoFallback) {
                    heroLiveLogoFallback.style.display = 'flex';
                    const curName = (container.querySelector('#set-name')?.value || wsDisplayName || 'W').trim();
                    heroLiveLogoFallback.textContent = (curName.charAt(0) || 'W').toUpperCase();
                }
            }
        };

        const handleLogoFile = (file) => {
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showAlert.error("Please choose a valid image file (PNG, JPG, WEBP, or SVG).");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showAlert.warning("Logo image exceeds 5MB. Please choose a smaller image.");
                return;
            }
            selectedWsLogoFile = file;
            checkDirty();
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result;
                updateLogoDisplay(dataUrl);
                if (logoUrlInput) {
                    logoUrlInput.value = dataUrl;
                }
                checkDirty();
            };
            reader.readAsDataURL(file);
        };

        btnUploadLogo?.addEventListener('click', () => logoFileInput?.click());
        logoDropzone?.addEventListener('click', () => logoFileInput?.click());

        logoFileInput?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleLogoFile(file);
        });

        logoUrlInput?.addEventListener('input', (e) => {
            selectedWsLogoFile = null;
            const urlVal = e.target.value.trim();
            updateLogoDisplay(urlVal);
            checkDirty();
        });

        btnClearLogo?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWsLogoFile = null;
            if (logoFileInput) logoFileInput.value = '';
            if (logoUrlInput) logoUrlInput.value = '';
            updateLogoDisplay('');
            checkDirty();
        });

        const updateBannerDisplay = (bannerSrc) => {
            if (bannerSrc) {
                if (bannerDropzone) {
                    bannerDropzone.style.background = `url('${bannerSrc}') center/cover no-repeat, #18181b`;
                }
                if (heroBrandCard) {
                    heroBrandCard.style.background = `url('${bannerSrc}') center/cover no-repeat, #18181b`;
                }
                if (btnClearBanner) btnClearBanner.style.display = 'inline-flex';
            } else {
                if (bannerDropzone) {
                    bannerDropzone.style.background = 'linear-gradient(135deg, #18181b 0%, #27272a 100%)';
                }
                if (heroBrandCard) {
                    heroBrandCard.style.background = 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #27272a 100%)';
                }
                if (btnClearBanner) btnClearBanner.style.display = 'none';
            }
        };

        const handleBannerFile = (file) => {
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showAlert.error("Please choose a valid image file (PNG, JPG, WEBP).");
                return;
            }
            if (file.size > 8 * 1024 * 1024) {
                showAlert.warning("Banner image exceeds 8MB. Please choose a smaller image.");
                return;
            }
            selectedWsBannerFile = file;
            checkDirty();
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result;
                updateBannerDisplay(dataUrl);
                if (bannerUrlInput) bannerUrlInput.value = dataUrl;
                checkDirty();
            };
            reader.readAsDataURL(file);
        };

        btnUploadBanner?.addEventListener('click', () => bannerFileInput?.click());
        bannerDropzone?.addEventListener('click', () => bannerFileInput?.click());

        bannerFileInput?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleBannerFile(file);
        });

        bannerUrlInput?.addEventListener('input', (e) => {
            selectedWsBannerFile = null;
            const urlVal = e.target.value.trim();
            updateBannerDisplay(urlVal);
            checkDirty();
        });

        btnClearBanner?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWsBannerFile = null;
            if (bannerFileInput) bannerFileInput.value = '';
            if (bannerUrlInput) bannerUrlInput.value = '';
            updateBannerDisplay('');
            checkDirty();
        });

        // Open Internet Banner Preset Modal
        const triggerBannerModal = () => {
            openBannerPickerModal(bannerUrlInput?.value || bannerUrl, (chosenUrl) => {
                selectedWsBannerFile = null;
                if (bannerUrlInput) bannerUrlInput.value = chosenUrl;
                updateBannerDisplay(chosenUrl);
                checkDirty();
                showAlert.success("Workspace cover banner updated!");
            });
        };

        btnPickInternetBanner?.addEventListener('click', triggerBannerModal);
        btnHeroChangeBanner?.addEventListener('click', triggerBannerModal);

        // Live Brand Title, Tagline, Industry, and Email Sync
        nameInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim() || 'Workspace';
            const heroTitle = container.querySelector('#hero-live-title');
            if (heroTitle) heroTitle.textContent = val;
            if (!logoUrlInput?.value) {
                if (logoPlaceholder) logoPlaceholder.textContent = (val.charAt(0) || 'W').toUpperCase();
                if (heroLiveLogoFallback) heroLiveLogoFallback.textContent = (val.charAt(0) || 'W').toUpperCase();
            }
            checkDirty();
        });

        taglineInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim() || 'Build • Manage • Sell • Scale Together';
            const heroTag = container.querySelector('#hero-live-tagline');
            if (heroTag) heroTag.textContent = val;
            checkDirty();
        });

        industrySelect?.addEventListener('change', (e) => {
            const val = e.target.value || 'General Commercial';
            const heroInd = container.querySelector('#hero-live-industry-pill');
            if (heroInd) heroInd.textContent = val;
            checkDirty();
        });

        emailInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim() || '';
            const heroEmail = container.querySelector('#hero-live-email');
            if (heroEmail) heroEmail.textContent = val;
            checkDirty();
        });

        [tradeNameInput, websiteInput, taxIdInput, phoneInput, supportPhoneInput, addressInput].forEach(inp => {
            inp?.addEventListener('input', checkDirty);
        });

        // Unified Discard Handler with Modal Safety
        const performDiscard = async () => {
            const confirmed = await showAlert.confirmDiscard("Discard all unsaved edits? All changes since your last save will be reverted.");
            if (!confirmed) return;

            selectedWsLogoFile = null;
            selectedWsBannerFile = null;
            if (nameInput) nameInput.value = savedSnapshot.name;
            if (tradeNameInput) tradeNameInput.value = savedSnapshot.tradeName;
            if (industrySelect) industrySelect.value = savedSnapshot.industry;
            if (taglineInput) taglineInput.value = savedSnapshot.tagline;
            if (websiteInput) websiteInput.value = savedSnapshot.website;
            if (taxIdInput) taxIdInput.value = savedSnapshot.taxId;
            if (emailInput) emailInput.value = savedSnapshot.email;
            if (phoneInput) phoneInput.value = savedSnapshot.phone;
            if (supportPhoneInput) supportPhoneInput.value = savedSnapshot.supportPhone;
            if (addressInput) addressInput.value = savedSnapshot.address;
            if (setShopName) setShopName.value = savedSnapshot.shopName;
            if (setEndMsg) setEndMsg.value = savedSnapshot.endMessage;
            if (setCustName) setCustName.checked = savedSnapshot.customerName;
            if (setCustNum) setCustNum.checked = savedSnapshot.customerNumber;
            
            if (countrySelect && savedSnapshot.country) countrySelect.value = savedSnapshot.country;
            if (regionInput) regionInput.value = savedSnapshot.region || '';
            if (currencyCodeSelect && savedSnapshot.currencyCode) currencyCodeSelect.value = savedSnapshot.currencyCode;
            if (currencyNameInput) currencyNameInput.value = savedSnapshot.currencyName || '';

            if (logoFileInput) logoFileInput.value = '';
            if (logoUrlInput) logoUrlInput.value = savedSnapshot.logoUrl || '';
            updateLogoDisplay(savedSnapshot.logoUrl || '');

            if (bannerFileInput) bannerFileInput.value = '';
            if (bannerUrlInput) bannerUrlInput.value = savedSnapshot.bannerUrl || '';
            updateBannerDisplay(savedSnapshot.bannerUrl || '');

            if (currencyInput) currencyInput.value = savedSnapshot.currencySymbol;
            if (vendingInput) vendingInput.checked = savedSnapshot.enableVending;
            if (vendingLabel) {
                vendingLabel.textContent = savedSnapshot.enableVending ? 'ENABLED' : 'DISABLED';
                vendingLabel.style.color = savedSnapshot.enableVending ? '#18181B' : 'var(--text-muted)';
            }
            updateCurrencyPreview(savedSnapshot.currencySymbol);
            updateTicketPreview();
            
            const heroTitle = container.querySelector('#hero-live-title');
            if (heroTitle) heroTitle.textContent = savedSnapshot.name;
            const heroTag = container.querySelector('#hero-live-tagline');
            if (heroTag) heroTag.textContent = savedSnapshot.tagline;
            const heroInd = container.querySelector('#hero-live-industry-pill');
            if (heroInd) heroInd.textContent = savedSnapshot.industry;
            const heroEmail = container.querySelector('#hero-live-email');
            if (heroEmail) heroEmail.textContent = savedSnapshot.email;

            checkDirty();
            showAlert.info("Changes discarded. Reverted to previously saved settings.");
        };

        getAllDiscardButtons().forEach(btn => {
            btn.addEventListener('click', performDiscard);
        });

        // Unified Save Handler
        const performSave = async () => {
            let finalLogoUrl = (logoUrlInput?.value || '').trim();
            let finalBannerUrl = (bannerUrlInput?.value || '').trim();

            const saveBtns = getAllSaveButtons();
            saveBtns.forEach(btn => {
                btn.disabled = true;
                btn.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Saving...`;
            });

            if (selectedWsLogoFile) {
                saveBtns.forEach(btn => {
                    btn.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Uploading Logo...`;
                });
                try {
                    if (isMock) {
                        finalLogoUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsDataURL(selectedWsLogoFile);
                        });
                    } else {
                        finalLogoUrl = await storageService.uploadImage(selectedWsLogoFile, workspaceId);
                    }
                } catch (uploadErr) {
                    console.warn("Storage logo upload failed:", uploadErr);
                    showAlert.warning("Logo upload had an issue. Saving local URL instead.");
                }
            }

            if (selectedWsBannerFile) {
                saveBtns.forEach(btn => {
                    btn.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Uploading Banner...`;
                });
                try {
                    if (isMock) {
                        finalBannerUrl = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onload = (e) => resolve(e.target.result);
                            reader.readAsDataURL(selectedWsBannerFile);
                        });
                    } else {
                        finalBannerUrl = await storageService.uploadImage(selectedWsBannerFile, workspaceId);
                    }
                } catch (uploadErr) {
                    console.warn("Storage banner upload failed:", uploadErr);
                    showAlert.warning("Banner upload had an issue. Saving local URL instead.");
                }
            }

            const chosenCountry = (countrySelect?.value || wsCountry || 'United Kingdom').trim();
            const chosenCountryCode = countrySelect?.selectedOptions?.[0]?.getAttribute('data-code') || wsCountryCode || 'GB';
            const chosenRegion = (regionInput?.value || wsRegion || '').trim();
            const chosenCurrencyCode = (currencyCodeSelect?.value || wsCurrencyCode || 'USD').toUpperCase();
            const chosenCurrencyName = (currencyNameInput?.value || wsCurrencyName || 'US Dollar').trim();

            const updatedPayload = {
                enableVending: Boolean(vendingInput?.checked),
                currency: (currencyInput?.value || '$').trim().substring(0, 3) || '$',
                currencySymbol: (currencyInput?.value || '$').trim().substring(0, 3) || '$',
                currencyCode: chosenCurrencyCode,
                currencyName: chosenCurrencyName,
                country: chosenCountry,
                countryCode: chosenCountryCode,
                countryName: chosenCountry,
                operatedCountry: chosenCountry,
                region: chosenRegion,
                name: (nameInput?.value || '').trim(),
                tradeName: (tradeNameInput?.value || nameInput?.value || '').trim(),
                industry: industrySelect?.value || 'General Commercial',
                tagline: (taglineInput?.value || '').trim(),
                description: (taglineInput?.value || '').trim(),
                website: (websiteInput?.value || '').trim(),
                taxId: (taxIdInput?.value || '').trim(),
                email: (emailInput?.value || '').trim(),
                phone: (phoneInput?.value || '').trim(),
                supportPhone: (supportPhoneInput?.value || '').trim(),
                address: (addressInput?.value || '').trim(),
                shopName: (setShopName?.value || tradeNameInput?.value || nameInput?.value || '').trim(),
                endMessage: (setEndMsg?.value || '').trim(),
                customerName: Boolean(setCustName?.checked),
                customerNumber: Boolean(setCustNum?.checked),
                logoUrl: finalLogoUrl,
                bannerUrl: finalBannerUrl
            };

            const resetSaveButtons = () => {
                saveBtns.forEach(btn => {
                    btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span class="btn-save-label">Save Settings</span><span id="header-unsaved-dot" style="display:none; width:8px; height:8px; border-radius:50%; background:#18181b; border:1px solid #E4E4E7;"></span>`;
                });
            };

            try {
                const settingsSvc = getSettingsService(workspaceId);
                await settingsSvc.saveWorkspaceSettings(updatedPayload);


                // Cache in localStorage so local demo & offline always work flawlessly
                try {
                    localStorage.setItem('pricelister_mock_settings', JSON.stringify(updatedPayload));
                    localStorage.setItem('pricelister_offline_settings_' + workspaceId, JSON.stringify(updatedPayload));
                } catch (storeErr) {
                    console.warn("Local cache save notice:", storeErr);
                }

                currentSettings = { ...currentSettings, ...updatedPayload };
                selectedWsLogoFile = null;
                selectedWsBannerFile = null;

                savedSnapshot = captureFormState();
                checkDirty();

                // Live update sidebar logo if present
                const sidebarLogo = document.querySelector('#sidebar-workspace-logo');
                if (sidebarLogo && finalLogoUrl) {
                    sidebarLogo.src = finalLogoUrl;
                }

                showAlert.success("Workspace credentials, banner & settings saved successfully!");
            } catch (err) {
                console.error("Save settings error:", err);
                showAlert.error("Failed to save settings: " + (err.message || 'Unknown error'));
            } finally {
                resetSaveButtons();
                checkDirty();
            }
        };

        getAllSaveButtons().forEach(btn => {
            btn.addEventListener('click', performSave);
        });

        // Initial evaluation ensures Save Changes is strictly disabled until actual modifications happen
        checkDirty();

        // Data Management Buttons
        container.querySelector('#btn-settings-market-inserter')?.addEventListener('click', () => {
            window.location.hash = '#/market-inserter';
        });
        container.querySelector('#btn-settings-headers-template')?.addEventListener('click', () => {
            try { downloadHeadersOnlyTemplate(); } catch (e) { console.warn("Template download notice:", e); }
        });
        container.querySelector('#btn-settings-sample-template')?.addEventListener('click', () => {
            try { downloadExampleDataTemplate(); } catch (e) { console.warn("Template download notice:", e); }
        });
        container.querySelector('#btn-settings-import-excel')?.addEventListener('click', () => {
            try {
                openExcelImportModal(workspaceId, () => showAlert.success("Spreadsheet data successfully imported!"));
            } catch (e) { console.warn("Import modal notice:", e); }
        });
        container.querySelector('#btn-settings-export-data')?.addEventListener('click', () => {
            try {
                openExportModal(workspaceId, { workspaceInfo: wsData });
            } catch (e) { console.warn("Export modal notice:", e); }
        });

        // Delete Workspace Handler (Admin Only)
        container.querySelector('#btn-delete-workspace')?.addEventListener('click', async () => {
            const btnDel = container.querySelector('#btn-delete-workspace');
            try {
                btnDel.disabled = true;
                btnDel.textContent = 'Checking active workers...';

                const members = await firestoreService.getWorkspaceMembers(workspaceId);
                const activeOthers = members.filter(m => {
                    const mEmail = (m.email || '').toLowerCase();
                    const isSelf = mEmail === (currentUser.email || '').toLowerCase() || m.workerUid === currentUser.uid;
                    return !isSelf;
                });

                if (activeOthers.length > 0) {
                    showAlert.error(`Cannot delete workspace. Remove all active workers (${activeOthers.length} active member(s) remaining) before deleting.`);
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                    return;
                }

                if (!await showAlert.confirm("WARNING: Are you sure you want to PERMANENTLY destroy this workspace? All catalog products, invoices, categories, client records, and cloud storage will be permanently wiped!")) {
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                    return;
                }

                btnDel.textContent = 'Deleting all server data...';
                await firestoreService.deleteEntireWorkspace(workspaceId, currentUser);
                showAlert.success("Workspace and all associated server data successfully deleted.");
                window.location.replace('/index.html?view=connection');
            } catch (err) {
                console.error("Delete workspace error:", err);
                showAlert.error(err.message || "Failed to delete workspace.");
                if (btnDel) {
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                }
            }
        });

        // Leave Workspace Handler (Worker / Co-Admin)
        container.querySelector('#btn-leave-workspace')?.addEventListener('click', async () => {
            if (await showAlert.confirm("Are you sure you want to leave this workspace? You will lose access to its products and invoices.")) {
                try {
                    await firestoreService.leaveWorkspace(workspaceId, currentUser);
                    showAlert.success("You have successfully left the workspace.");
                    window.location.replace('/index.html?view=connection');
                } catch (err) {
                    showAlert.error("Failed to leave workspace: " + (err.message || 'Unknown error'));
                }
            }
        });

    } catch (err) {
        console.error("Render settings error:", err);
        showAlert.error("Failed to load workspace settings.");
    }
};

