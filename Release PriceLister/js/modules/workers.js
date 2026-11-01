import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getSettingsService } from '../services/settingsService.js';
import { openBannerPickerModal } from './bannerModal.js';
import { getFirestore, doc, collection, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

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

export const renderWorkers = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;
    
    // Show smooth initial skeleton loader
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:400px;">
            <div class="spinner"></div>
        </div>
    `;

    // Fetch workspace info and related stats
    let wsInfo = null;
    let productsList = [];
    let categoriesList = [];
    let panelSettings = {};

    try {
        const [wsData, prods, cats, pSet] = await Promise.all([
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null),
            getProductService(workspaceId).getAllActiveProducts().catch(() => []),
            getCategoryService(workspaceId).getAllCategories().catch(() => []),
            getSettingsService(workspaceId).getCustomerPanelSettings().catch(() => ({}))
        ]);
        wsInfo = wsData || window.__activeWorkspace || {};
        productsList = prods || [];
        categoriesList = cats || [];
        panelSettings = pSet || {};
    } catch (err) {
        console.error("Error loading workspace data:", err);
        wsInfo = window.__activeWorkspace || {};
    }

    if (!wsInfo || !wsInfo.id) {
        wsInfo = {
            id: workspaceId,
            workspaceId: workspaceId,
            name: window.__activeWorkspace?.name || 'My Workspace',
            adminEmail: currentUser.email,
            adminName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Admin'),
            role: window.__activeWorkspace?.role || 'CREATOR_ADMIN',
            timestamp: Date.now()
        };
    }

    const roleUpper = (wsInfo.role || 'WORKER').toUpperCase();
    const isAdmin = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'ADMIN' || roleUpper === 'CREATOR';
    const isCoAdmin = roleUpper === 'CO_ADMIN' || roleUpper === 'CO-ADMIN';
    const canManageWorkers = isAdmin || isCoAdmin;

    const wsDisplayName = wsInfo.name || 'PriceLister Workspace';
    const wsIdString = wsInfo.workspaceId || wsInfo.id || workspaceId;
    const adminEmailDisp = wsInfo.adminEmail || currentUser.email || 'admin@example.com';
    const adminNameDisp = wsInfo.adminName || (adminEmailDisp ? adminEmailDisp.split('@')[0] : 'Workspace Admin');
    const wsTagline = wsInfo.description || wsInfo.address || 'Build • Manage • Sell • Scale Together';
    
    // Format established / founded date
    let establishedStr = 'Recent';
    let foundedExactStr = '';
    const rawTs = wsInfo.createdTimestamp || wsInfo.createdAt || wsInfo.timestamp;
    if (rawTs) {
        try {
            const dateObj = typeof rawTs === 'number' ? new Date(rawTs) : (rawTs.toDate ? rawTs.toDate() : new Date(rawTs));
            establishedStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            foundedExactStr = dateObj.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            establishedStr = 'Verified';
            foundedExactStr = 'Verified';
        }
    }

    // Format last updated audit info
    let lastUpdatedStr = 'Live';
    const rawUpTs = wsInfo.updatedTimestamp || wsInfo.updatedAt || wsInfo.lastModified;
    if (rawUpTs) {
        try {
            const upObj = typeof rawUpTs === 'number' ? new Date(rawUpTs) : (rawUpTs.toDate ? rawUpTs.toDate() : new Date(rawUpTs));
            lastUpdatedStr = upObj.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            lastUpdatedStr = 'Live';
        }
    }
    const updatorEmailDisp = wsInfo.updatedByEmail || wsInfo.updatorEmail || wsInfo.lastUpdatedBy || adminEmailDisp;

    const isStoreLive = Boolean(panelSettings.isPublished || panelSettings.enabled);
    const storeUrl = window.location.origin + window.location.pathname.replace('app.html', 'customer.html') + `?ws=${encodeURIComponent(workspaceId)}`;

    container.innerHTML = `
        <div class="workspace-view-wrapper" style="max-width: 1320px; margin: 0 auto; padding-bottom: 3.5rem;">

            <!-- ======================================================== -->
            <!-- 1. TOP HERO COVER BANNER (LARGE BANNER & GLASS ARMATURE) -->
            <!-- ======================================================== -->
            <div class="ws-hero-banner" style="position:relative; border-radius: 22px; overflow: hidden; min-height: 270px; ${wsInfo.bannerUrl || wsInfo.banner ? `background: linear-gradient(180deg, rgba(9, 9, 11, 0.4) 0%, rgba(9, 9, 11, 0.88) 100%), url('${wsInfo.bannerUrl || wsInfo.banner}') center/cover no-repeat;` : `background: linear-gradient(135deg, #09090b 0%, #18181b 45%, #27272a 100%);`} color: #ffffff; box-shadow: 0 18px 45px -10px rgba(0, 0, 0, 0.35); border: 1.5px solid rgba(255, 255, 255, 0.14); margin-bottom: 1.75rem; transition: background 0.3s ease;">
                
                <!-- Ambient Glow Orbs -->
                <div style="position:absolute; width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.09) 0%, transparent 70%); top: -100px; right: -80px; pointer-events:none;"></div>
                <div style="position:absolute; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%); bottom: -60px; left: 10%; pointer-events:none;"></div>

                <!-- Main Hero Body -->
                <div style="padding: 2.5rem 2.25rem 2rem; position:relative; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.5rem;">
                    
                    <!-- Left: Avatar + Title + Tagline -->
                    <div style="display: flex; gap: 1.5rem; align-items: center; max-width: 800px;">
                        
                        <!-- Workspace Avatar / Badge (1:1 Aspect Ratio) -->
                        <div class="ws-hero-avatar" id="btn-hero-logo-box" title="Click to edit workspace settings" style="width: 88px; height: 88px; border-radius: 20px; background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(12px); border: 2.5px solid rgba(255, 255, 255, 0.45); display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 30px rgba(0,0,0,0.3); flex-shrink: 0; overflow:hidden; cursor:pointer;">
                            ${(wsInfo.logoUrl || wsInfo.logo) ? `
                                <img src="${wsInfo.logoUrl || wsInfo.logo}" alt="${escapeHtml(wsDisplayName)}" style="width:100%; height:100%; object-fit:contain; padding:4px;">
                            ` : `
                                <span style="font-size: 2.5rem; font-weight: 800; color: #ffffff; letter-spacing: -1px; text-shadow: 0 2px 10px rgba(0,0,0,0.35);">
                                    ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                                </span>
                            `}
                        </div>

                        <div>
                            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                                <h1 style="font-size: 2rem; font-weight: 800; margin: 0; letter-spacing: -0.025em; color: #ffffff; text-shadow: 0 2px 12px rgba(0,0,0,0.3);">
                                    ${escapeHtml(wsDisplayName)}
                                </h1>
                                <span style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.22rem 0.75rem; border-radius: 999px; background: rgba(16,185,129,0.25); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4); font-size: 0.74rem; font-weight: 700; backdrop-filter: blur(8px);">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Verified Workspace
                                </span>
                                <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.22rem 0.75rem; border-radius: 999px; background: rgba(255, 255, 255, 0.22); border: 1px solid rgba(255, 255, 255, 0.4); font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; backdrop-filter: blur(8px);">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    ${escapeHtml(roleUpper.replace('_', ' '))}
                                </span>
                                ${wsInfo.industry ? `
                                    <span style="display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.7rem; border-radius: 999px; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); font-size: 0.74rem; font-weight: 600; backdrop-filter: blur(8px); color: #f4f4f5;">
                                        ${escapeHtml(wsInfo.industry)}
                                    </span>
                                ` : ''}
                                ${wsInfo.tradeName && wsInfo.tradeName !== wsDisplayName ? `
                                    <span style="font-size: 0.82rem; opacity: 0.9; font-weight: 500;">
                                        (${escapeHtml(wsInfo.tradeName)})
                                    </span>
                                ` : ''}
                            </div>
                            <p style="margin: 0.45rem 0 0 0; font-size: 0.98rem; opacity: 0.92; font-weight: 400; line-height: 1.45; color: #f4f4f5;">
                                ${escapeHtml(wsTagline)}
                            </p>
                        </div>
                    </div>

                    <!-- Right Top Actions: Change Banner & Edit Workspace -->
                    <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
                        ${isAdmin ? `
                            <button type="button" id="btn-hero-change-banner" class="btn" style="background: rgba(255, 255, 255, 0.95); color: #18181b; font-weight: 700; font-size: 0.84rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: none; box-shadow: 0 4px 14px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 0.45rem; cursor: pointer; transition: all 0.2s ease;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                <span>Change Cover Banner</span>
                            </button>
                            <button type="button" id="btn-hero-edit-workspace" class="btn" style="background: rgba(255, 255, 255, 0.2); color: #ffffff; font-weight: 700; font-size: 0.84rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.35); backdrop-filter: blur(8px); display: flex; align-items: center; gap: 0.45rem; cursor: pointer; transition: all 0.2s ease;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                <span>Workspace Settings</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Bottom Glass Strip: Key Metadata Row -->
                <div style="background: rgba(15, 23, 42, 0.45); backdrop-filter: blur(14px); border-top: 1px solid rgba(255, 255, 255, 0.16); padding: 0.9rem 2.25rem; display: flex; gap: 1.75rem; align-items: center; flex-wrap: wrap; font-size: 0.85rem;">
                    
                    <!-- Workspace ID (Copyable) -->
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <span style="opacity: 0.75; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em;">Workspace ID:</span>
                        <code id="hero-ws-id-text" style="font-family: monospace; font-size: 0.85rem; font-weight: 700; color: #ffffff; background: rgba(255, 255, 255, 0.12); padding: 0.2rem 0.55rem; border-radius: 6px;">${escapeHtml(wsIdString)}</code>
                        <button type="button" id="btn-copy-workspace-id" class="btn-icon-subtle" title="Copy Workspace ID" style="background: transparent; border: none; color: #ffffff; opacity: 0.85; cursor: pointer; display: flex; align-items: center; padding: 0.2rem; transition: opacity 0.15s ease;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                    </div>

                    <!-- Admin Info -->
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="opacity: 0.75; font-size: 0.78rem; text-transform: uppercase;">Admin:</span>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                            <div style="width: 22px; height: 22px; border-radius: 50%; background: #ffffff; color: #881337; font-weight: 800; font-size: 0.7rem; display: flex; align-items: center; justify-content: center;">
                                ${escapeHtml((adminNameDisp.charAt(0) || 'A').toUpperCase())}
                            </div>
                            <span style="font-weight: 600;">${escapeHtml(adminNameDisp)}</span>
                        </div>
                    </div>

                    <!-- Admin Email -->
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.75;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        <span style="opacity: 0.9;">${escapeHtml(adminEmailDisp)}</span>
                    </div>

                    <!-- Members Counter -->
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.75;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <span id="hero-members-badge-text" style="font-weight: 600;">Loading members...</span>
                    </div>

                    <!-- Established Date -->
                    <div style="display: flex; align-items: center; gap: 0.45rem; margin-left: auto;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.75;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span style="opacity: 0.85;">Est. ${escapeHtml(establishedStr)}</span>
                    </div>

                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 2. QUICK STAT METRIC CARDS ROW (ELEVATED WHITE SURFACES)  -->
            <!-- ======================================================== -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.75rem;">
                
                <!-- Stat 1: Products -->
                <div class="ws-metric-card" onclick="if(window.navigateToRoute){window.navigateToRoute('/products')}else{window.location.hash='#/products'}" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem 1.35rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 8px 25px -5px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Catalog Items</div>
                        <div style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary); line-height: 1.15; margin-top: 0.15rem;">
                            ${productsList.length}
                        </div>
                    </div>
                </div>

                <!-- Stat 2: Categories / Catalog Lists -->
                <div class="ws-metric-card" onclick="if(window.navigateToRoute){window.navigateToRoute('/categories')}else{window.location.hash='#/categories'}" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem 1.35rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 8px 25px -5px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Categories</div>
                        <div style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary); line-height: 1.15; margin-top: 0.15rem;">
                            ${categoriesList.length}
                        </div>
                    </div>
                </div>

                <!-- Stat 3: Customer Storefront -->
                <div class="ws-metric-card" onclick="if(window.navigateToRoute){window.navigateToRoute('/customer-panel')}else{window.location.hash='#/customer-panel'}" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem 1.35rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 8px 25px -5px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Storefront</div>
                        <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); line-height: 1.15; margin-top: 0.15rem; display: flex; align-items: center; gap: 0.4rem;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isStoreLive ? '#10b981' : '#f59e0b'};"></span>
                            ${isStoreLive ? 'Live Portal' : 'Draft'}
                        </div>
                    </div>
                </div>

                <!-- Stat 4: Active Members -->
                <div class="ws-metric-card" onclick="if(window.navigateToRoute){window.navigateToRoute('/members')}else{window.location.hash='#/members'}" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 16px; padding: 1.25rem 1.35rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 8px 25px -5px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s ease;">
                    <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(147, 51, 234, 0.08); color: #7e22ce; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <div>
                        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Team Staff</div>
                        <div id="stat-members-count" style="font-size: 1.65rem; font-weight: 800; color: var(--text-primary); line-height: 1.15; margin-top: 0.15rem;">
                            1
                        </div>
                    </div>
                </div>

            </div>

            <!-- ======================================================== -->
            <!-- 3. WELCOME CALLOUT BANNER HUB                            -->
            <!-- ======================================================== -->
            <div class="ws-welcome-card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem 2rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03); margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem; position: relative; overflow: hidden;">
                
                <div style="position:absolute; right:0; top:0; bottom:0; width: 200px; background: linear-gradient(90deg, transparent 0%, rgba(225,29,72,0.03) 100%); pointer-events:none;"></div>

                <div style="display: flex; align-items: center; gap: 1.5rem; max-width: 760px;">
                    <!-- Graphical Tech Node Icon -->
                    <div style="width: 58px; height: 58px; border-radius: 16px; background: var(--surface-100); border: 1.5px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-primary); flex-shrink: 0; box-shadow: 0 6px 16px rgba(0,0,0,0.06);">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    </div>

                    <div>
                        <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); margin: 0 0 0.35rem 0; letter-spacing: -0.01em;">
                            Welcome to ${escapeHtml(wsDisplayName)}
                        </h2>
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin: 0; line-height: 1.5;">
                            This is your central operational hub for product catalogs, pricing lists, customer storefront, and team collaboration. Stay organized and scale your commerce workflow.
                        </p>
                    </div>
                </div>

                ${canManageWorkers ? `
                    <button type="button" id="btn-trigger-invite-hub" class="btn btn-primary" style="background: var(--btn-primary-bg); color: var(--btn-primary-text); font-weight: 700; font-size: 0.9rem; padding: 0.75rem 1.4rem; border-radius: 10px; border: 1px solid var(--btn-primary-border); box-shadow: var(--shadow-subtle); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: all 0.2s ease;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        <span>Invite Member</span>
                    </button>
                ` : ''}
            </div>

            <!-- ======================================================== -->
            <!-- 4. CORE TWO-COLUMN ARCHITECTURE                          -->
            <!-- ======================================================== -->
            <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.75rem; align-items: start;">
                
                <!-- ======================== LEFT COLUMN ======================== -->
                <div style="display: flex; flex-direction: column; gap: 1.75rem;">
                    
                    <!-- RECENT ACTIVITY FEED -->
                    <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Recent Activity
                            </h3>
                            <a href="#/overview" style="font-size: 0.82rem; font-weight: 700; color: var(--primary); text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
                                View all <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </a>
                        </div>

                        <!-- Activity Rows -->
                        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                            
                            <!-- Activity 1 -->
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px;">
                                <div style="display: flex; align-items: center; gap: 0.85rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Product Catalog Synced</div>
                                        <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.1rem;">${productsList.length} active inventory products in cloud</div>
                                    </div>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Live</span>
                            </div>

                            <!-- Activity 2 -->
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px;">
                                <div style="display: flex; align-items: center; gap: 0.85rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path></svg>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Customer Storefront</div>
                                        <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.1rem;">${isStoreLive ? 'Online storefront is active and public' : 'Storefront in draft mode'}</div>
                                    </div>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${isStoreLive ? 'Published' : 'Draft'}</span>
                            </div>

                            <!-- Activity 3 -->
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px;">
                                <div style="display: flex; align-items: center; gap: 0.85rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                    </div>
                                    <div>
                                        <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">Red Invoice Designer</div>
                                        <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.1rem;">Professional 4-template PDF bills & quotes</div>
                                    </div>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Ready</span>
                            </div>

                        </div>
                    </div>

                    <!-- QUICK ACTIONS HUB -->
                    <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                        <h3 style="margin: 0 0 1.25rem 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Quick Actions
                        </h3>

                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.85rem;">
                            
                            <!-- Action 1: Invite Member -->
                            ${canManageWorkers ? `
                                <div id="qa-invite-worker" style="padding: 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.15s ease;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                        </div>
                                        <div>
                                            <div style="font-weight: 700; font-size: 0.86rem; color: var(--text-primary);">Invite Worker</div>
                                            <div style="font-size: 0.74rem; color: var(--text-secondary);">Add new staff to workspace</div>
                                        </div>
                                    </div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            ` : ''}

                            <!-- Action 2: Add Product -->
                            <div onclick="if(window.navigateToRoute){window.navigateToRoute('/products')}else{window.location.hash='#/products'}" style="padding: 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.15s ease;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.86rem; color: var(--text-primary);">Add Product</div>
                                        <div style="font-size: 0.74rem; color: var(--text-secondary);">Create new catalog item</div>
                                    </div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>

                            <!-- Action 3: New Invoice -->
                            <div onclick="if(window.navigateToRoute){window.navigateToRoute('/invoices/customer')}else{window.location.hash='#/invoices/customer'}" style="padding: 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.15s ease;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.86rem; color: var(--text-primary);">Red PDF Invoice</div>
                                        <div style="font-size: 0.74rem; color: var(--text-secondary);">Generate sales quote / bill</div>
                                    </div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>

                            <!-- Action 4: Customer Panel -->
                            <div onclick="if(window.navigateToRoute){window.navigateToRoute('/customer-panel')}else{window.location.hash='#/customer-panel'}" style="padding: 1rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.15s ease;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path></svg>
                                    </div>
                                    <div>
                                        <div style="font-weight: 700; font-size: 0.86rem; color: var(--text-primary);">Customer Storefront</div>
                                        <div style="font-size: 0.74rem; color: var(--text-secondary);">Setup online store & catalog</div>
                                    </div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </div>

                        </div>
                    </div>

                </div>

                <!-- ======================== RIGHT COLUMN ======================== -->
                <div style="display: flex; flex-direction: column; gap: 1.75rem;">
                    
                    <!-- WORKSPACE INFORMATION CARD -->
                    <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.85rem;">
                            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Workspace Information</h3>
                            ${isAdmin ? `
                                <button type="button" id="btn-side-edit-ws" class="btn-icon-subtle" title="Edit Workspace" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; padding:0.2rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Mini Logo & Name Block -->
                        <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1rem;">
                            <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem;">
                                ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                            </div>
                            <div>
                                <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary);">${escapeHtml(wsDisplayName)}</div>
                                <span style="display: inline-block; padding: 0.15rem 0.55rem; border-radius: 6px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">${escapeHtml(roleUpper.replace('_', ' '))}</span>
                            </div>
                        </div>

                        <p style="font-size: 0.84rem; color: var(--text-secondary); line-height: 1.45; margin: 0 0 1.25rem 0;">
                            ${escapeHtml(wsInfo.description || 'This workspace is configured for catalog management, stock control, and collaborative team sales.')}
                        </p>

                        <!-- Key Details List (Enterprise Large-Scale) -->
                        <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.84rem;">
                            
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.6rem; border-bottom: 1px solid var(--border-color);">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    Workspace ID:
                                </span>
                                <span style="font-family: monospace; font-weight: 700; color: var(--text-primary); font-size: 0.82rem; background: var(--surface-50); padding: 0.15rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color);">${escapeHtml(wsIdString)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Founder / Admin:
                                </span>
                                <span style="font-weight: 700; color: var(--text-primary);">${escapeHtml(adminNameDisp)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    Contact Email:
                                </span>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.82rem;">${escapeHtml(adminEmailDisp)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    Founded / Established:
                                </span>
                                <span style="font-weight: 700; color: var(--text-primary);" title="${escapeHtml(foundedExactStr)}">${escapeHtml(establishedStr)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Last Modified:
                                </span>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.8rem;">${escapeHtml(lastUpdatedStr)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                                    Updated By:
                                </span>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.8rem;">${escapeHtml(updatorEmailDisp)}</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.6rem; border-top: 1px solid var(--border-color);">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    Architecture / Schema:
                                </span>
                                <span class="badge" style="background: var(--surface-100); color: var(--text-primary); font-weight: 700; font-size: 0.75rem; border: 1px solid var(--border-color);">v2.0.0 Enterprise</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    Security & Encryption:
                                </span>
                                <span class="badge" style="background: var(--surface-100); color: var(--text-primary); font-weight: 700; font-size: 0.75rem; border: 1px solid var(--border-color);">AES-256 Cloud</span>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="color: var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                    Base Currency:
                                </span>
                                <span style="font-weight: 800; color: var(--primary); font-family: monospace; font-size: 0.95rem;">${escapeHtml(wsInfo.currencySymbol || '$')}</span>
                            </div>

                        </div>
                    </div>

                    ${canManageWorkers ? `
                        <!-- PENDING JOIN REQUESTS CARD (Admin & Co-Admin only) -->
                        <div id="join-requests-section" class="card" style="display:none; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Join Requests</h3>
                                    <span id="join-requests-count-badge" style="background: var(--surface-100); color: var(--text-secondary); border: 1.5px solid var(--border-color); font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px;">0</span>
                                </div>
                                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">Admin &amp; Co-Admin Approval</span>
                            </div>
                            <div id="join-requests-container" style="display: flex; flex-direction: column; gap: 0.65rem;">
                                <!-- Dynamic Requests -->
                            </div>
                        </div>
                    ` : ''}

                    <!-- MEMBERS LIST SECTION -->
                    <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                        
                        <!-- Members Header -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">Members</h3>
                                <span id="members-count-badge" class="members-count-badge" style="background: var(--surface-100); color: var(--text-secondary); border: 1px solid var(--border-color); font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 999px;">...</span>
                            </div>
                            
                            ${canManageWorkers ? `
                                <button type="button" id="btn-quick-invite-member" class="btn btn-sm btn-primary" style="font-weight: 700; font-size: 0.78rem; padding: 0.45rem 1rem; border-radius: 8px;">
                                    Invite Member
                                </button>
                            ` : ''}
                        </div>

                        <!-- Search Member Filter -->
                        <div style="position: relative; margin-bottom: 1rem;">
                            <input type="text" id="member-search-input" class="form-control" placeholder="Search members by email or role..." style="padding-left: 2.2rem; font-size: 0.84rem; height: 36px; border-radius: 8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>

                        <!-- Members Cards Container -->
                        <div id="members-cards-container" style="display: flex; flex-direction: column; gap: 0.65rem; max-height: 420px; overflow-y: auto; padding-right: 0.2rem;">
                            <!-- Dynamic Member Cards Rendered by Snapshot -->
                            <div style="padding: 1rem; text-align:center; color: var(--text-muted); font-size: 0.85rem;">
                                Loading workspace members...
                            </div>
                        </div>

                    </div>

                </div>

            </div>

            <!-- ======================================================== -->
            <!-- ======================================================== -->
            <!-- 5. INVITE WORKER MODAL / DRAWER                          -->
            <!-- ======================================================== -->
            <div id="add-worker-container" style="display:none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="background: var(--bg-card); border-radius: 20px; max-width: 480px; width: 100%; box-shadow: var(--shadow-elevated); overflow: hidden; border: 1px solid var(--border-color); animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <div style="background: var(--surface-50); border-bottom: 1px solid var(--border-color); color: var(--text-primary); padding: 1.25rem 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem; letter-spacing:-0.015em;">
                            <div style="width:32px; height:32px; border-radius:8px; background:var(--surface-100); color:var(--text-primary); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </div>
                            Invite Team Member
                        </h3>
                        <button type="button" id="btn-close-invite-modal" style="background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.55rem; border-radius:8px; line-height:1; transition:all 0.15s ease;">✕</button>
                    </div>

                    <form id="add-worker-form" style="padding: 1.5rem; display:flex; flex-direction:column; gap:1.15rem; background: var(--bg-card);">
                        <div class="form-group">
                            <label style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem; display:block;">Worker Email Address *</label>
                            <input type="email" id="worker-email" required class="form-control" style="width:100%; font-size:0.9rem; background:var(--surface-100); border:1px solid var(--border-color); color:var(--text-primary); border-radius:10px; padding:0.6rem 0.85rem;" placeholder="worker@gmail.com">
                            <small style="font-size:0.75rem; color:var(--text-muted); margin-top:0.3rem; display:block;">Must be a valid Gmail address ending with @gmail.com</small>
                        </div>
                        
                        <div class="form-group">
                            <label style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem; display:block;">Workspace Role</label>
                            <select id="worker-role" class="form-control" style="width:100%; font-size:0.9rem; background:var(--surface-100); border:1px solid var(--border-color); color:var(--text-primary); border-radius:10px; padding:0.6rem 0.85rem;">
                                <option value="WORKER">Worker (Standard Operator)</option>
                                ${isAdmin ? '<option value="CO_ADMIN">Co-Admin (Elevated Manager - No Restrictions)</option>' : ''}
                            </select>
                        </div>

                        <!-- Restrictions Container (Applies to Workers only; hidden when Co-Admin is selected) -->
                        <div id="add-worker-restrictions-container" style="display:flex; flex-direction:column; gap:0.9rem;">
                            <!-- Group A: Action Restriction -->
                            <div class="form-group" style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.9rem 1rem;">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem;">
                                    <label style="font-size:0.78rem; font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">Action Restrictions (Group A)</label>
                                    <span style="font-size:0.68rem; background:var(--surface-200); color:var(--text-secondary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:700;">Worker Only</span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem; color:var(--text-primary);">
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="worker-disable-add" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Add New Data
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="worker-disable-delete-others" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Delete Others Data
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="worker-disable-update-others" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Update Other Data
                                    </label>
                                </div>
                            </div>

                            <!-- Group B: Visibility Restriction -->
                            <div class="form-group" style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.9rem 1rem;">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem;">
                                    <label style="font-size:0.78rem; font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">Visibility Restrictions (Group B)</label>
                                    <span style="font-size:0.68rem; background:var(--surface-200); color:var(--text-secondary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:700;">Worker Only</span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem; color:var(--text-primary);">
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="worker-cannot-see-cost" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to see Cost
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="worker-cannot-see-profit" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to see Profit Margin
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style="display:flex; gap:0.75rem; margin-top:0.35rem;">
                            <button type="submit" id="btn-submit-worker" class="btn btn-primary" style="flex:1; background:var(--btn-primary-bg); border:1px solid var(--btn-primary-border); color:var(--btn-primary-text); font-weight:700; border-radius:10px; padding:0.7rem; box-shadow:var(--shadow-subtle);">Send Invitation</button>
                            <button type="button" id="btn-cancel-worker" class="btn btn-secondary" style="font-weight:700; background:var(--surface-100); border:1px solid var(--border-color); color:var(--text-primary); border-radius:10px; padding:0.7rem 1.25rem;">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 6. MANAGE WORKER MODAL                                   -->
            <!-- ======================================================== -->
            <div id="manage-worker-container" style="display:none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
                <div class="card" style="background: var(--bg-card); border-radius: 20px; max-width: 520px; width: 100%; box-shadow: var(--shadow-elevated); overflow: hidden; border: 1px solid var(--border-color); animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <div style="background: var(--surface-50); border-bottom: 1px solid var(--border-color); color: var(--text-primary); padding: 1.25rem 1.5rem; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin: 0; font-size: 1.18rem; font-weight: 800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem; letter-spacing:-0.015em;">
                            <div style="width:32px; height:32px; border-radius:8px; background:var(--surface-100); color:var(--text-primary); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </div>
                            Manage Member
                        </h3>
                        <button type="button" id="btn-close-manage-modal" style="background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 1.1rem; cursor: pointer; padding: 0.2rem 0.55rem; border-radius:8px; line-height:1; transition:all 0.15s ease;">✕</button>
                    </div>

                    <form id="manage-worker-form" style="padding: 1.5rem; display:flex; flex-direction:column; gap:1.15rem; background: var(--bg-card); max-height: 80vh; overflow-y: auto;">
                        <input type="hidden" id="manage-email">
                        
                        <div style="background: var(--surface-50); padding: 0.85rem 1rem; border-radius: 12px; border: 1px solid var(--border-color);">
                            <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 0.25rem; letter-spacing:0.04em;">Member Email</span>
                            <div style="font-size: 0.96rem; font-weight: 800; color: var(--text-primary); word-break: break-all;" id="manage-email-display"></div>
                        </div>
                        
                        ${isAdmin ? `
                            <div class="form-group">
                                <label style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem; display:block;">Role Assignment</label>
                                <select id="manage-role" class="form-control" style="width:100%; font-size:0.9rem; background:var(--surface-100); border:1px solid var(--border-color); color:var(--text-primary); border-radius:10px; padding:0.6rem 0.85rem;">
                                    <option value="WORKER">Worker (Restricted Operator)</option>
                                    <option value="CO_ADMIN">Co-Admin (Elevated Manager - No Restrictions)</option>
                                </select>
                            </div>
                        ` : '<input type="hidden" id="manage-role" value="WORKER">'}

                        <!-- Restrictions Container (Applies to Workers only; hidden when Co-Admin is selected) -->
                        <div id="manage-restrictions-container" style="display:flex; flex-direction:column; gap:0.9rem;">
                            <!-- Group A: Action Restriction -->
                            <div class="form-group" style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.9rem 1rem;">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem;">
                                    <label style="font-size:0.78rem; font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">Action Restrictions (Group A)</label>
                                    <span style="font-size:0.68rem; background:var(--surface-200); color:var(--text-secondary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:700;">Worker Only</span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem; color:var(--text-primary);">
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="manage-disable-add" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Add New Data
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="manage-disable-delete-others" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Delete Others Data
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="manage-disable-update-others" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to Update Other Data
                                    </label>
                                </div>
                            </div>

                            <!-- Group B: Visibility Restriction -->
                            <div class="form-group" style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 0.9rem 1rem;">
                                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.55rem;">
                                    <label style="font-size:0.78rem; font-weight:800; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.04em;">Visibility Restrictions (Group B)</label>
                                    <span style="font-size:0.68rem; background:var(--surface-200); color:var(--text-secondary); padding:0.1rem 0.4rem; border-radius:4px; font-weight:700;">Worker Only</span>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.55rem; font-size:0.85rem; color:var(--text-primary);">
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="manage-cannot-see-cost" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to see Cost
                                    </label>
                                    <label style="display:flex; align-items:center; gap:0.65rem; cursor:pointer; color:var(--text-primary);">
                                        <input type="checkbox" id="manage-cannot-see-profit" style="accent-color: var(--text-primary); width:16px; height:16px;"> Unable to see Profit Margin
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style="display:flex; gap:0.75rem; margin-top:0.35rem; flex-wrap:wrap;">
                            <button type="submit" id="btn-save-manage" class="btn btn-primary" style="flex:1; background:var(--btn-primary-bg); border:1px solid var(--btn-primary-border); color:var(--btn-primary-text); font-weight:700; border-radius:10px; padding:0.7rem; box-shadow:var(--shadow-subtle);">Save Changes</button>
                            <button type="button" id="btn-remove-worker" class="btn btn-outline" style="color: #dc2626; border: 1.5px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.06); font-weight:700; border-radius:10px; padding:0.7rem 1.1rem;">Remove</button>
                            <button type="button" id="btn-cancel-manage" class="btn btn-secondary" style="font-weight:700; background:var(--surface-100); border:1px solid var(--border-color); color:var(--text-primary); border-radius:10px; padding:0.7rem 1.1rem;">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    `;

    // -------------------------------------------------------------
    // DOM Elements & Event Handlers
    // -------------------------------------------------------------
    const addContainer = container.querySelector('#add-worker-container');
    const manageContainer = container.querySelector('#manage-worker-container');
    const addForm = container.querySelector('#add-worker-form');
    const manageForm = container.querySelector('#manage-worker-form');
    const membersCardsContainer = container.querySelector('#members-cards-container');
    const memberSearchInput = container.querySelector('#member-search-input');
    const membersCountBadge = container.querySelector('#members-count-badge');
    const heroMembersBadgeText = container.querySelector('#hero-members-badge-text');
    const statMembersCount = container.querySelector('#stat-members-count');
    
    let currentMembersList = [];

    // 1. Copy Workspace ID
    const copyWsIdBtn = container.querySelector('#btn-copy-workspace-id');
    if (copyWsIdBtn) {
        copyWsIdBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(wsIdString).then(() => {
                showAlert.success(`Workspace ID copied: ${wsIdString}`);
            }).catch(() => {
                showAlert.info(`Workspace ID: ${wsIdString}`);
            });
        });
    }

    // 2. Edit Workspace trigger
    const editWsBtn = container.querySelector('#btn-hero-edit-workspace');
    const sideEditWsBtn = container.querySelector('#btn-side-edit-ws');
    const openEditModal = () => {
        window.location.hash = '#/settings';
    };
    if (editWsBtn) editWsBtn.addEventListener('click', openEditModal);
    if (sideEditWsBtn) sideEditWsBtn.addEventListener('click', openEditModal);

    // 3. Open Invite Modal Triggers
    const openInviteModal = () => {
        if (!canManageWorkers) return;
        if (manageContainer) manageContainer.style.display = 'none';
        if (addContainer) {
            addContainer.style.display = 'flex';
            container.querySelector('#worker-email')?.focus();
        }
    };

    const closeInviteModal = () => {
        if (addContainer) {
            addContainer.style.display = 'none';
            if (addForm) addForm.reset();
        }
    };

    container.querySelector('#btn-trigger-invite-hub')?.addEventListener('click', openInviteModal);
    container.querySelector('#btn-quick-invite-member')?.addEventListener('click', openInviteModal);
    container.querySelector('#qa-invite-worker')?.addEventListener('click', openInviteModal);
    container.querySelector('#btn-close-invite-modal')?.addEventListener('click', closeInviteModal);
    container.querySelector('#btn-cancel-worker')?.addEventListener('click', closeInviteModal);

    // Edit Workspace Settings Button
    container.querySelector('#btn-hero-edit-workspace')?.addEventListener('click', () => {
        if (window.navigateToRoute) {
            window.navigateToRoute('/settings');
        } else {
            window.location.hash = '#/settings';
        }
    });

    // Side Edit Workspace Button
    container.querySelector('#btn-side-edit-ws')?.addEventListener('click', () => {
        if (window.navigateToRoute) {
            window.navigateToRoute('/settings');
        } else {
            window.location.hash = '#/settings';
        }
    });

    // Hero Logo Box Click -> Navigates to Settings
    container.querySelector('#btn-hero-logo-box')?.addEventListener('click', () => {
        if (window.navigateToRoute) {
            window.navigateToRoute('/settings');
        } else {
            window.location.hash = '#/settings';
        }
    });

    // Copy Workspace ID to Clipboard
    container.querySelector('#btn-copy-workspace-id')?.addEventListener('click', () => {
        navigator.clipboard.writeText(wsIdString).then(() => {
            showAlert.success(`Workspace ID "${wsIdString}" copied to clipboard!`);
        }).catch(() => {
            showAlert.info(`Workspace ID: ${wsIdString}`);
        });
    });

    // Change Workspace Banner Action
    container.querySelector('#btn-hero-change-banner')?.addEventListener('click', () => {
        openBannerPickerModal(async (selectedBannerUrl) => {
            try {
                const wsRef = doc(db, 'Workspaces', workspaceId);
                await setDoc(wsRef, {
                    bannerUrl: selectedBannerUrl,
                    updatedAt: Date.now(),
                    lastUpdatedBy: currentUser.email || 'Admin'
                }, { merge: true });

                const heroBanner = container.querySelector('#hub-hero-banner');
                if (heroBanner) {
                    heroBanner.style.backgroundImage = `linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%), url('${selectedBannerUrl}')`;
                }
                if (window.__activeWorkspace) {
                    window.__activeWorkspace.bannerUrl = selectedBannerUrl;
                }
                showAlert.success('Workspace cover banner updated successfully!');
            } catch (err) {
                console.error('Error updating banner:', err);
                showAlert.error('Failed to update workspace banner.');
            }
        });
    });

    // 4. Close Manage Modal
    const closeManageModal = () => {
        if (manageContainer) manageContainer.style.display = 'none';
        initialManageSnapshot = null;
    };
    container.querySelector('#btn-close-manage-modal')?.addEventListener('click', closeManageModal);
    container.querySelector('#btn-cancel-manage')?.addEventListener('click', closeManageModal);

    // -------------------------------------------------------------
    // Real-Time Members Firestore Listener
    // -------------------------------------------------------------
    const renderMembersCards = (members) => {
        if (!membersCardsContainer) return;

        const query = (memberSearchInput?.value || '').trim().toLowerCase();
        const filtered = query ? members.filter(m => {
            const em = (m.email || '').toLowerCase();
            const r = (m.role || '').toLowerCase();
            return em.includes(query) || r.includes(query);
        }) : members;

        if (filtered.length === 0) {
            membersCardsContainer.innerHTML = `
                <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
                    No members found matching "${escapeHtml(query)}"
                </div>
            `;
            return;
        }

        membersCardsContainer.innerHTML = filtered.map(m => {
            const isCreator = Boolean(m.isCreator || m.role === 'CREATOR_ADMIN');
            const rUpper = (m.role || 'WORKER').toUpperCase();
            const statusUpper = (m.status || 'JOINED').toUpperCase();
            const isPending = statusUpper === 'PENDING';
            const isRestrictedWorker = !isPending && m.isRestricted && (m.disableAdd || m.disableUpdate || m.disableDelete);

            const isSelf = (m.email || '').toLowerCase() === (currentUser.email || '').toLowerCase();
            const nameInitial = ((m.email || 'M').charAt(0) || 'M').toUpperCase();

            // Role Badge styling
            let rolePillBg = '#f1f5f9';
            let rolePillColor = '#475569';
            let rolePillBorder = '#e2e8f0';
            if (isCreator) {
                rolePillBg = '#18181b';
                rolePillColor = '#ffffff';
                rolePillBorder = '#18181b';
            } else if (rUpper === 'ADMIN') {
                rolePillBg = 'var(--surface-100)';
                rolePillColor = 'var(--text-primary)';
                rolePillBorder = 'var(--border-color)';
            } else if (rUpper === 'CO_ADMIN' || rUpper === 'CO-ADMIN') {
                rolePillBg = '#eff6ff';
                rolePillColor = '#2563eb';
                rolePillBorder = '#bfdbfe';
            }

            // Status Indicator styling
            let statusDotColor = '#10b981';
            let statusBadgeHtml = `
                <span style="font-size: 0.68rem; font-weight: 600; padding: 0.1rem 0.45rem; border-radius: 4px; background: #ecfdf5; color: #065f46;">
                    Joined
                </span>
            `;
            if (isPending) {
                statusDotColor = '#f59e0b';
                statusBadgeHtml = `
                    <span style="font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; background: rgba(245, 158, 11, 0.15); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.35);">
                        (Pending)
                    </span>
                    ${m.hasExistingWorkspace ? `
                        <span style="font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; background: rgba(37, 99, 235, 0.12); color: #1d4ed8; border: 1px solid rgba(37, 99, 235, 0.3);">
                            (Connected in a Workspace)
                        </span>
                    ` : ''}
                `;
            } else if (isRestrictedWorker) {
                statusDotColor = '#ef4444';
                statusBadgeHtml = `
                    <span style="font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 4px; background: #fee2e2; color: #991b1b;">
                        Restricted
                    </span>
                `;
            }

            if (m.accessRevoked || m.isAccessBlocked) {
                statusDotColor = '#dc2626';
                statusBadgeHtml += `
                    <span style="font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 4px; background: #fee2e2; color: #991b1b; border: 1px solid #fecdd3; display:inline-flex; align-items:center; gap:3px;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Access Blocked
                    </span>
                `;
            }

            // Action button
            let actionBtnHtml = '';
            if (canManageWorkers && !isSelf) {
                if (isPending) {
                    actionBtnHtml = `
                        <button type="button" class="btn btn-sm btn-cancel-invite" data-email="${escapeHtml(m.email)}" style="font-size:0.75rem; padding:0.25rem 0.6rem; color:#dc2626; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:6px; font-weight:600; cursor:pointer;">
                            Cancel
                        </button>
                    `;
                } else if ((isAdmin && !isCreator) || (isCoAdmin && !isCreator && rUpper === 'WORKER')) {
                    actionBtnHtml = `
                        <button type="button" class="btn btn-sm btn-manage-member" 
                            data-email="${escapeHtml(m.email)}" 
                            data-role="${rUpper}"
                            data-cost="${m.cannotSeeCost ? '1' : '0'}"
                            data-profit="${m.cannotSeeProfit ? '1' : '0'}"
                            data-add="${m.disableAdd ? '1' : '0'}"
                            data-del-others="${m.disableDeleteOthers ? '1' : '0'}"
                            data-upd-others="${m.disableUpdateOthers ? '1' : '0'}"
                            data-revoked="${m.accessRevoked ? '1' : '0'}"
                            data-revoke-start="${m.revokeStart || ''}"
                            data-revoke-end="${m.revokeEnd || ''}"
                            data-revoke-start-fmt="${escapeHtml(m.revokeStartFormatted || '')}"
                            data-revoke-end-fmt="${escapeHtml(m.revokeEndFormatted || '')}"
                            style="font-size:0.75rem; padding:0.25rem 0.65rem; font-weight:700; border-radius:6px; border:1px solid var(--border-color); background:#ffffff; color:var(--text-primary); cursor:pointer;">
                            Manage
                        </button>
                    `;
                }
            }

            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0.85rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; transition: all 0.15s ease;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; overflow: hidden;">
                        
                        <!-- Avatar / Initial -->
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); color: #334155; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.88rem; flex-shrink: 0; position: relative;">
                            ${nameInitial}
                            <span style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; background: ${statusDotColor}; border: 2px solid #ffffff;"></span>
                        </div>

                        <!-- Email & Role -->
                        <div style="overflow: hidden;">
                            <div style="display: flex; align-items: center; gap: 0.4rem;">
                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px;">
                                    ${escapeHtml(m.email || 'Member')}
                                </div>
                                ${isSelf ? '<span style="font-size:0.7rem; color:var(--primary); font-weight:700;">(You)</span>' : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem; flex-wrap: wrap;">
                                <span style="font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 4px; background: ${rolePillBg}; color: ${rolePillColor}; border: 1px solid ${rolePillBorder};">
                                    ${escapeHtml(isCreator ? 'Creator Admin' : (rUpper === 'CO_ADMIN' ? 'Co-Admin' : rUpper))}
                                </span>
                                ${statusBadgeHtml}
                            </div>
                        </div>

                    </div>

                    <!-- Action Column -->
                    <div>
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
        }).join('');

        // Format Date Helper
        const formatDurationDate = (dateOrTimestamp) => {
            if (!dateOrTimestamp) return '';
            const d = new Date(dateOrTimestamp);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString(undefined, {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        const updateRevocationDurationPreview = () => {
            const startDisp = container.querySelector('#manage-revoke-start-disp');
            const endInput = container.querySelector('#manage-revoke-end-input');
            const durationText = container.querySelector('#manage-revoke-duration-text');
            if (!durationText) return;

            const startStr = startDisp ? startDisp.textContent : formatDurationDate(Date.now());
            if (endInput && endInput.value) {
                const endStr = formatDurationDate(endInput.value);
                durationText.textContent = `${startStr} — ${endStr}`;
            } else {
                durationText.textContent = `${startStr} — (Choose End Date/Time)`;
            }
        };

        // Attach action handlers
        container.querySelectorAll('.btn-manage-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const email = e.currentTarget.getAttribute('data-email');
                const r = e.currentTarget.getAttribute('data-role');
                const cannotCost = e.currentTarget.getAttribute('data-cost') === '1';
                const cannotProfit = e.currentTarget.getAttribute('data-profit') === '1';
                const dAdd = e.currentTarget.getAttribute('data-add') === '1';
                const dDelOthers = e.currentTarget.getAttribute('data-del-others') === '1';
                const dUpdOthers = e.currentTarget.getAttribute('data-upd-others') === '1';
                const isRevoked = e.currentTarget.getAttribute('data-revoked') === '1';
                const rStart = e.currentTarget.getAttribute('data-revoke-start');
                const rEnd = e.currentTarget.getAttribute('data-revoke-end');
                const rStartFmt = e.currentTarget.getAttribute('data-revoke-start-fmt');
                const rEndFmt = e.currentTarget.getAttribute('data-revoke-end-fmt');
                
                container.querySelector('#manage-email').value = email;
                container.querySelector('#manage-email-display').textContent = email;
                
                const roleSelect = container.querySelector('#manage-role');
                if (roleSelect) {
                    roleSelect.value = (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? 'CO_ADMIN' : 'WORKER';
                }
                
                const costBox = container.querySelector('#manage-cannot-see-cost');
                const profitBox = container.querySelector('#manage-cannot-see-profit');
                if (costBox) costBox.checked = cannotCost;
                if (profitBox) profitBox.checked = cannotProfit;

                const addBox = container.querySelector('#manage-disable-add');
                const delOthersBox = container.querySelector('#manage-disable-delete-others');
                const updOthersBox = container.querySelector('#manage-disable-update-others');
                if (addBox) addBox.checked = dAdd;
                if (delOthersBox) delOthersBox.checked = dDelOthers;
                if (updOthersBox) updOthersBox.checked = dUpdOthers;

                // Handle Restrictions Display depending on Role
                const restrContainer = container.querySelector('#manage-restrictions-container');
                if (restrContainer) {
                    restrContainer.style.display = (roleSelect && roleSelect.value === 'CO_ADMIN') ? 'none' : 'flex';
                }

                // Handle Revocation Controls
                const revokeToggle = container.querySelector('#manage-access-revoke-toggle');
                const revokeBox = container.querySelector('#manage-revoke-details-box');
                const startDisp = container.querySelector('#manage-revoke-start-disp');
                const endInput = container.querySelector('#manage-revoke-end-input');

                if (revokeToggle) revokeToggle.checked = isRevoked;
                if (revokeBox) revokeBox.style.display = isRevoked ? 'flex' : 'none';

                const nowMs = Date.now();
                const effectiveStart = rStart ? Number(rStart) : nowMs;
                if (startDisp) {
                    startDisp.textContent = rStartFmt || formatDurationDate(effectiveStart);
                    startDisp.dataset.timestamp = String(effectiveStart);
                }

                if (endInput) {
                    if (rEnd && !isNaN(Number(rEnd))) {
                        const d = new Date(Number(rEnd));
                        const pad = (n) => String(n).padStart(2, '0');
                        endInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    } else {
                        const d = new Date(nowMs + 24 * 60 * 60 * 1000);
                        const pad = (n) => String(n).padStart(2, '0');
                        endInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    }
                }
                updateRevocationDurationPreview();
                
                if (addContainer) addContainer.style.display = 'none';
                if (manageContainer) {
                    manageContainer.style.display = 'flex';
                }

                initialManageSnapshot = {
                    role: (roleSelect ? roleSelect.value : 'WORKER'),
                    cannotCost,
                    cannotProfit,
                    dAdd,
                    dDelOthers,
                    dUpdOthers,
                    isRevoked,
                    endVal: endInput ? endInput.value : ''
                };
                checkManageDirty();
            });
        });

        // Toggle Restrictions on Role Change
        const manageRoleSelect = container.querySelector('#manage-role');
        if (manageRoleSelect) {
            manageRoleSelect.addEventListener('change', () => {
                const restrContainer = container.querySelector('#manage-restrictions-container');
                if (restrContainer) {
                    restrContainer.style.display = manageRoleSelect.value === 'CO_ADMIN' ? 'none' : 'flex';
                }
                checkManageDirty();
            });
        }

        const workerRoleSelect = container.querySelector('#worker-role');
        if (workerRoleSelect) {
            workerRoleSelect.addEventListener('change', () => {
                const restrContainer = container.querySelector('#add-worker-restrictions-container');
                if (restrContainer) {
                    restrContainer.style.display = workerRoleSelect.value === 'CO_ADMIN' ? 'none' : 'flex';
                }
            });
        }

        // Revocation Toggle in Manage Form
        const revokeToggleEl = container.querySelector('#manage-access-revoke-toggle');
        const endInputEl = container.querySelector('#manage-revoke-end-input');
        if (revokeToggleEl) {
            revokeToggleEl.addEventListener('change', () => {
                const revokeBox = container.querySelector('#manage-revoke-details-box');
                if (revokeBox) {
                    revokeBox.style.display = revokeToggleEl.checked ? 'flex' : 'none';
                }
                updateRevocationDurationPreview();
                checkManageDirty();
            });
        }

        if (endInputEl) {
            endInputEl.addEventListener('input', () => {
                updateRevocationDurationPreview();
                checkManageDirty();
            });
        }

        container.querySelectorAll('.btn-cancel-invite').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const email = e.currentTarget.getAttribute('data-email');
                if (!email) return;

                const confirmed = await showAlert.confirm(`Are you sure you want to cancel the pending invitation for ${email}?`, "Cancel Invitation");
                if (!confirmed) return;

                e.currentTarget.disabled = true;
                e.currentTarget.textContent = 'Cancelling...';

                try {
                    const inviteRef = doc(db, 'Invites', `${workspaceId}_${email}`);
                    await deleteDoc(inviteRef).catch(() => null);

                    const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                    await deleteDoc(memberRef);

                    showAlert.success(`Invitation for ${email} has been cancelled.`);
                } catch (err) {
                    console.error("Failed to cancel invitation:", err);
                    showAlert.error("Failed to cancel invitation. Check permissions.");
                }
            });
        });
    };

    if (memberSearchInput) {
        memberSearchInput.addEventListener('input', () => {
            renderMembersCards(currentMembersList);
        });
    }

    // Subscribe to Members Subcollection
    try {
        const membersRef = collection(db, 'Workspaces/' + workspaceId + '/Members');
        onSnapshot(membersRef, (snap) => {
            const members = snap.docs.map(d => ({ email: d.id, ...d.data() }));

            // Ensure workspace creator is always represented
            if (wsInfo.adminEmail) {
                const hasCreator = members.some(m => (m.email || '').toLowerCase() === wsInfo.adminEmail.toLowerCase());
                if (!hasCreator) {
                    members.unshift({
                        email: wsInfo.adminEmail,
                        role: 'CREATOR_ADMIN',
                        status: 'JOINED',
                        isCreator: true,
                        joinedAt: wsInfo.timestamp || null
                    });
                }
            }

            currentMembersList = members;

            // Update Badges & Counters
            if (membersCountBadge) membersCountBadge.textContent = `${members.length}`;
            if (heroMembersBadgeText) heroMembersBadgeText.textContent = `${members.length} member${members.length === 1 ? '' : 's'}`;
            if (statMembersCount) statMembersCount.textContent = `${members.length}`;

            renderMembersCards(members);
        }, (error) => {
            console.error("Members Listener Error:", error);
            if (membersCardsContainer) {
                membersCardsContainer.innerHTML = '<div style="padding:1rem; text-align:center; color: var(--error);">Error loading members.</div>';
            }
        });
    } catch (e) {
        console.error("Failed to initialize members listener:", e);
    }

    // -------------------------------------------------------------
    // Join Requests Listener (Admin & Co-Admin only)
    // -------------------------------------------------------------
    if (canManageWorkers) {
        const joinReqSection = container.querySelector('#join-requests-section');
        const joinReqContainer = container.querySelector('#join-requests-container');
        const joinReqBadge = container.querySelector('#join-requests-count-badge');

        try {
            firestoreService.listenJoinRequests(workspaceId, (requests) => {
                if (!joinReqSection || !joinReqContainer) return;
                const pending = (requests || []).filter(r => r.status === 'PENDING');
                if (pending.length === 0) {
                    joinReqSection.style.display = 'none';
                    return;
                }

                joinReqSection.style.display = 'block';
                if (joinReqBadge) joinReqBadge.textContent = `${pending.length}`;

                joinReqContainer.innerHTML = pending.map(req => {
                    const reqDate = req.requestedAt ? new Date(req.requestedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';
                    const avatarLetter = (req.displayName || req.email || 'U').charAt(0).toUpperCase();

                    return `
                        <div class="join-req-item" data-email="${escapeHtml(req.email)}" style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-50); border:1.5px solid var(--border-color); border-radius:12px; padding:0.85rem 1rem;">
                            <div style="display:flex; align-items:center; gap:0.75rem; min-width:0;">
                                <div style="width:38px; height:38px; border-radius:50%; background:var(--surface-100); border:1.5px solid var(--border-color); overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; color:var(--text-primary);">
                                    ${req.photoURL ? `<img src="${escapeHtml(req.photoURL)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : avatarLetter}
                                </div>
                                <div style="min-width:0;">
                                    <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(req.displayName || req.email)}</div>
                                    <div style="font-size:0.78rem; color:var(--text-muted);">${escapeHtml(req.email)} &bull; <span style="opacity:0.85;">${reqDate}</span></div>
                                </div>
                            </div>
                            <div style="display:flex; gap:0.5rem; align-items:center; flex-shrink:0;">
                                <button type="button" class="btn btn-sm btn-primary btn-approve-request" data-email="${escapeHtml(req.email)}" style="border:1.5px solid #d4d4d8; background:#ffffff; color:#18181b; font-weight:700; padding:0.35rem 0.85rem; border-radius:8px; cursor:pointer;">
                                    Approve
                                </button>
                                <button type="button" class="btn btn-sm btn-outline btn-reject-request" data-email="${escapeHtml(req.email)}" style="border:1.5px solid #d4d4d8; background:transparent; color:var(--text-secondary); font-weight:600; padding:0.35rem 0.85rem; border-radius:8px; cursor:pointer;">
                                    Reject
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                // Attach handlers
                joinReqContainer.querySelectorAll('.btn-approve-request').forEach(b => {
                    b.addEventListener('click', async () => {
                        const targetEmail = b.getAttribute('data-email');
                        const targetReq = pending.find(r => r.email === targetEmail);
                        if (!targetReq) return;
                        b.disabled = true;
                        b.textContent = 'Approving...';
                        try {
                            await firestoreService.approveJoinRequest(workspaceId, targetReq);
                            showAlert.success(`Worker ${targetReq.displayName || targetEmail} joined workspace.`);
                        } catch (err) {
                            console.error("Approve error:", err);
                            showAlert.error("Failed to approve join request.");
                            b.disabled = false;
                            b.textContent = 'Approve';
                        }
                    });
                });

                joinReqContainer.querySelectorAll('.btn-reject-request').forEach(b => {
                    b.addEventListener('click', async () => {
                        const targetEmail = b.getAttribute('data-email');
                        b.disabled = true;
                        b.textContent = 'Rejecting...';
                        try {
                            await firestoreService.rejectJoinRequest(workspaceId, targetEmail);
                            showAlert.info(`Join request from ${targetEmail} rejected.`);
                        } catch (err) {
                            console.error("Reject error:", err);
                            showAlert.error("Failed to reject join request.");
                            b.disabled = false;
                            b.textContent = 'Reject';
                        }
                    });
                });

            });
        } catch (err) {
            console.warn("Failed to listen to join requests:", err);
        }
    }

    // -------------------------------------------------------------
    // Manage Worker Dirty Check & Submissions
    // -------------------------------------------------------------
    let initialManageSnapshot = null;
    const checkManageDirty = () => {
        const btnSave = container.querySelector('#btn-save-manage');
        if (!btnSave) return;
        if (!initialManageSnapshot) {
            btnSave.disabled = true;
            return;
        }

        const roleSelect = container.querySelector('#manage-role');
        const currentRole = roleSelect ? roleSelect.value : 'WORKER';
        const currentCost = Boolean(container.querySelector('#manage-cannot-see-cost')?.checked);
        const currentProfit = Boolean(container.querySelector('#manage-cannot-see-profit')?.checked);
        const currentDAdd = Boolean(container.querySelector('#manage-disable-add')?.checked);
        const currentDDelOthers = Boolean(container.querySelector('#manage-disable-delete-others')?.checked);
        const currentDUpdOthers = Boolean(container.querySelector('#manage-disable-update-others')?.checked);
        const currentRevoked = Boolean(container.querySelector('#manage-access-revoke-toggle')?.checked);
        const currentEndVal = container.querySelector('#manage-revoke-end-input')?.value || '';

        const isDirty = (
            currentRole !== initialManageSnapshot.role ||
            currentCost !== initialManageSnapshot.cannotCost ||
            currentProfit !== initialManageSnapshot.cannotProfit ||
            currentDAdd !== initialManageSnapshot.dAdd ||
            currentDDelOthers !== initialManageSnapshot.dDelOthers ||
            currentDUpdOthers !== initialManageSnapshot.dUpdOthers ||
            currentRevoked !== initialManageSnapshot.isRevoked ||
            currentEndVal !== initialManageSnapshot.endVal
        );

        btnSave.disabled = !isDirty;
    };

    ['#manage-role', '#manage-cannot-see-cost', '#manage-cannot-see-profit', '#manage-disable-add', '#manage-disable-delete-others', '#manage-disable-update-others', '#manage-access-revoke-toggle', '#manage-revoke-end-input'].forEach(sel => {
        const el = container.querySelector(sel);
        if (el) el.addEventListener('change', checkManageDirty);
    });

    // Invite Submission with Image 5 Confirmation Alert
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = container.querySelector('#btn-submit-worker');
            const emailInput = container.querySelector('#worker-email');
            const roleSelect = container.querySelector('#worker-role');

            const rawEmail = (emailInput.value || '').trim();
            const email = rawEmail.toLowerCase();
            const role = roleSelect ? roleSelect.value : 'WORKER';

            // Validation: Gmail format
            const isValidGmail = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
            if (!isValidGmail) {
                showAlert.error("Please enter a valid Gmail address (e.g. worker@gmail.com). Must end with @gmail.com.");
                emailInput.focus();
                return;
            }

            // Validation: Cannot invite self
            const myEmail = (currentUser.email || '').trim().toLowerCase();
            if (email === myEmail) {
                showAlert.error("You cannot invite yourself to the workspace.");
                emailInput.focus();
                return;
            }

            // Validation: Existing check
            const existingMember = currentMembersList.find(m => (m.email || '').trim().toLowerCase() === email);
            if (existingMember) {
                const st = (existingMember.status || 'JOINED').toUpperCase();
                if (st === 'PENDING') {
                    showAlert.error(`An invitation is already pending for ${email}.`);
                } else {
                    showAlert.error(`${email} is already a member of this workspace.`);
                }
                emailInput.focus();
                return;
            }

            const isCoAdmin = role === 'CO_ADMIN';
            const cannotSeeCost = isCoAdmin ? false : Boolean(container.querySelector('#worker-cannot-see-cost')?.checked);
            const cannotSeeProfit = isCoAdmin ? false : Boolean(container.querySelector('#worker-cannot-see-profit')?.checked);
            const disableAdd = isCoAdmin ? false : Boolean(container.querySelector('#worker-disable-add')?.checked);
            const disableDeleteOthers = isCoAdmin ? false : Boolean(container.querySelector('#worker-disable-delete-others')?.checked);
            const disableUpdateOthers = isCoAdmin ? false : Boolean(container.querySelector('#worker-disable-update-others')?.checked);

            // Confirm Dialog Matching Image 5 Style
            const confirmed = await showAlert.confirm(
                `Send team invitation to ${email}?`,
                'Confirm Team Invitation',
                {
                    confirmText: 'Send Invitation',
                    cancelText: 'Cancel',
                    isDestructive: false,
                    detailsHtml: `
                        <div style="display:flex; align-items:center; gap:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:0.75rem 1rem; margin-top:0.4rem;">
                            <div style="width:36px; height:36px; border-radius:50%; background:#18181b; color:#ffffff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.9rem;">
                                ${email.charAt(0).toUpperCase()}
                            </div>
                            <div style="overflow:hidden; flex:1;">
                                <div style="font-weight:700; font-size:0.88rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${email}</div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:0.15rem;">
                                    Assigned Role: <strong style="color:${isCoAdmin ? '#2563eb' : '#059669'};">${isCoAdmin ? 'Co-Admin (No Restrictions)' : 'Worker'}</strong>
                                </div>
                            </div>
                        </div>
                    `
                }
            );

            if (!confirmed) return;

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Sending...';

            try {
                const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                const existingDoc = await getDoc(memberRef);
                if (existingDoc.exists()) {
                    showAlert.error(`${email} already exists in workspace.`);
                    return;
                }

                // Check if user already has their own workspace in cloud
                let hasExistingWs = false;
                try {
                    hasExistingWs = await firestoreService.checkUserHasWorkspace(email);
                } catch (e) {
                    console.warn("Workspace check warning:", e);
                }

                // Create Invite Doc
                const inviteRef = doc(db, 'Invites', `${workspaceId}_${email}`);
                await setDoc(inviteRef, {
                    adminUid: workspaceId,
                    adminEmail: wsInfo.adminEmail || currentUser.email,
                    workerEmail: email,
                    workspaceName: wsInfo.name || 'Workspace',
                    role: role,
                    cannotSeeCost: cannotSeeCost,
                    cannotSeeProfit: cannotSeeProfit,
                    disableAdd: disableAdd,
                    disableDeleteOthers: disableDeleteOthers,
                    disableUpdateOthers: disableUpdateOthers,
                    hasExistingWorkspace: Boolean(hasExistingWs),
                    timestamp: Date.now()
                });

                // Add to Members subcollection as PENDING
                await setDoc(memberRef, {
                    email: email,
                    role: role,
                    status: 'PENDING',
                    cannotSeeCost: cannotSeeCost,
                    cannotSeeProfit: cannotSeeProfit,
                    disableAdd: disableAdd,
                    disableDeleteOthers: disableDeleteOthers,
                    disableUpdateOthers: disableUpdateOthers,
                    hasExistingWorkspace: Boolean(hasExistingWs),
                    addedAt: Date.now(),
                    timestamp: Date.now()
                });

                showAlert.success(`Invitation sent to ${email}`);
                closeInviteModal();
            } catch (err) {
                console.error("Invite error:", err);
                showAlert.error("Failed to send invite. Check permissions.");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Send Invitation';
            }
        });
    }

    // Save Manage Changes with Group A, Group B and Temporary Revocation
    if (manageForm) {
        manageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = container.querySelector('#btn-save-manage');
            btnSave.disabled = true;

            const email = container.querySelector('#manage-email').value;
            const roleSelect = container.querySelector('#manage-role');
            const newRole = roleSelect ? roleSelect.value : 'WORKER';
            const isCoAdmin = newRole === 'CO_ADMIN';
            
            const cannotSeeCost = isCoAdmin ? false : Boolean(container.querySelector('#manage-cannot-see-cost')?.checked);
            const cannotSeeProfit = isCoAdmin ? false : Boolean(container.querySelector('#manage-cannot-see-profit')?.checked);
            const dAdd = isCoAdmin ? false : Boolean(container.querySelector('#manage-disable-add')?.checked);
            const dDelOthers = isCoAdmin ? false : Boolean(container.querySelector('#manage-disable-delete-others')?.checked);
            const dUpdOthers = isCoAdmin ? false : Boolean(container.querySelector('#manage-disable-update-others')?.checked);
            
            // Temporary Revocation Logic
            const accessRevoked = isCoAdmin ? false : Boolean(container.querySelector('#manage-access-revoke-toggle')?.checked);
            let revokeStart = null;
            let revokeEnd = null;
            let revokeStartFormatted = '';
            let revokeEndFormatted = '';
            let isAccessBlocked = false;

            if (accessRevoked) {
                const startDisp = container.querySelector('#manage-revoke-start-disp');
                const endInput = container.querySelector('#manage-revoke-end-input');

                const parsedStart = startDisp && startDisp.dataset.timestamp ? Number(startDisp.dataset.timestamp) : Date.now();
                revokeStart = parsedStart;
                revokeStartFormatted = formatDurationDate(revokeStart);

                if (endInput && endInput.value) {
                    const parsedEnd = new Date(endInput.value).getTime();
                    if (!isNaN(parsedEnd)) {
                        revokeEnd = parsedEnd;
                        revokeEndFormatted = formatDurationDate(revokeEnd);
                    }
                }
                if (!revokeEnd) {
                    revokeEnd = revokeStart + (24 * 60 * 60 * 1000);
                    revokeEndFormatted = formatDurationDate(revokeEnd);
                }

                const nowMs = Date.now();
                isAccessBlocked = (nowMs >= revokeStart && nowMs <= revokeEnd);
            }

            const isRestricted = cannotSeeCost || cannotSeeProfit || dAdd || dDelOthers || dUpdOthers || accessRevoked;

            try {
                const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                await updateDoc(memberRef, {
                    role: newRole,
                    cannotSeeCost: cannotSeeCost,
                    cannotSeeProfit: cannotSeeProfit,
                    isRestricted: isRestricted,
                    disableAdd: dAdd,
                    disableDeleteOthers: dDelOthers,
                    disableUpdateOthers: dUpdOthers,
                    accessRevoked: accessRevoked,
                    revokeStart: revokeStart,
                    revokeEnd: revokeEnd,
                    revokeStartFormatted: revokeStartFormatted,
                    revokeEndFormatted: revokeEndFormatted,
                    isAccessBlocked: isAccessBlocked,
                    updatedAt: Date.now()
                });
                
                showAlert.success(`Member settings updated for ${email}`);
                closeManageModal();
            } catch (err) {
                console.error("Update member error:", err);
                showAlert.error("Failed to update member. Check permissions.");
            } finally {
                btnSave.disabled = false;
            }
        });

        // Remove Member
        container.querySelector('#btn-remove-worker')?.addEventListener('click', async () => {
            const email = container.querySelector('#manage-email').value;
            if (await showAlert.confirm(`Are you sure you want to remove ${email} from this workspace?`, "Remove Member")) {
                try {
                    await deleteDoc(doc(db, 'Workspaces/' + workspaceId + '/Members', email));
                    try {
                        await deleteDoc(doc(db, 'Invites', `${workspaceId}_${email}`));
                    } catch (e) {}
                    showAlert.success(`${email} has been removed.`);
                    closeManageModal();
                } catch (err) {
                    console.error("Remove member error:", err);
                    showAlert.error("Failed to remove member. Check permissions.");
                }
            }
        });
    }
};
