import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getSettingsService } from '../services/settingsService.js';
import { openBannerPickerModal } from './bannerModal.js';
import { getFirestore, doc, collection, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs, increment } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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

    // Clean up any stale orphaned modals from previous visits
    const staleManageModal = document.getElementById('manage-worker-container');
    if (staleManageModal && staleManageModal.parentElement === document.body) {
        staleManageModal.remove();
    }
    const staleAddModal = document.getElementById('add-worker-container');
    if (staleAddModal && staleAddModal.parentElement === document.body) {
        staleAddModal.remove();
    }

    
    // Show smooth initial skeleton loader with console-grade shimmering
    container.innerHTML = `
        <div class="workspace-hub-skeleton" style="display:flex; flex-direction:column; gap:1.5rem; max-width:1400px; margin:0 auto; width:100%; padding:0.5rem 0;">
            <!-- 1. Header Banner & Identity Card Skeleton -->
            <div class="card" style="padding:0; overflow:hidden; border:1.5px solid #e4e4e7; border-radius:16px; background:#ffffff;">
                <div class="skeleton-shimmer" style="width:100%; height:130px; border-radius:16px 16px 0 0;"></div>
                <div style="padding:1.5rem; display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1.25rem; margin-top:-50px; position:relative; z-index:2;">
                    <div style="display:flex; align-items:flex-end; gap:1.25rem; flex-wrap:wrap;">
                        <div class="skeleton-shimmer" style="width:96px; height:96px; border-radius:24px; border:4px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.08);"></div>
                        <div style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:0.25rem;">
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                <div class="skeleton-shimmer" style="width:240px; height:26px; border-radius:8px;"></div>
                                <div class="skeleton-shimmer" style="width:90px; height:22px; border-radius:9999px;"></div>
                            </div>
                            <div class="skeleton-shimmer" style="width:320px; height:14px; border-radius:4px;"></div>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.65rem;">
                        <div class="skeleton-shimmer" style="width:120px; height:40px; border-radius:10px;"></div>
                        <div class="skeleton-shimmer" style="width:130px; height:40px; border-radius:10px;"></div>
                    </div>
                </div>
            </div>

            <!-- 2. Quick Action KPI Cards Row Skeleton -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                <div class="card" style="padding:1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; background:#ffffff; display:flex; align-items:center; gap:0.85rem;">
                    <div class="skeleton-shimmer" style="width:44px; height:44px; border-radius:10px; flex-shrink:0;"></div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="skeleton-shimmer" style="width:65%; height:14px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:85%; height:11px; border-radius:4px;"></div>
                    </div>
                </div>
                <div class="card" style="padding:1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; background:#ffffff; display:flex; align-items:center; gap:0.85rem;">
                    <div class="skeleton-shimmer" style="width:44px; height:44px; border-radius:10px; flex-shrink:0;"></div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="skeleton-shimmer" style="width:65%; height:14px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:85%; height:11px; border-radius:4px;"></div>
                    </div>
                </div>
                <div class="card" style="padding:1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; background:#ffffff; display:flex; align-items:center; gap:0.85rem;">
                    <div class="skeleton-shimmer" style="width:44px; height:44px; border-radius:10px; flex-shrink:0;"></div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="skeleton-shimmer" style="width:65%; height:14px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:85%; height:11px; border-radius:4px;"></div>
                    </div>
                </div>
                <div class="card" style="padding:1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; background:#ffffff; display:flex; align-items:center; gap:0.85rem;">
                    <div class="skeleton-shimmer" style="width:44px; height:44px; border-radius:10px; flex-shrink:0;"></div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:0.4rem;">
                        <div class="skeleton-shimmer" style="width:65%; height:14px; border-radius:4px;"></div>
                        <div class="skeleton-shimmer" style="width:85%; height:11px; border-radius:4px;"></div>
                    </div>
                </div>
            </div>

            <!-- 3. Members List Container Skeleton -->
            <div class="card" style="padding:1.5rem; border:1.5px solid #e4e4e7; border-radius:14px; background:#ffffff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div class="skeleton-shimmer" style="width:110px; height:24px; border-radius:6px;"></div>
                        <div class="skeleton-shimmer" style="width:36px; height:22px; border-radius:9999px;"></div>
                    </div>
                    <div class="skeleton-shimmer" style="width:260px; height:38px; border-radius:10px;"></div>
                </div>
                <!-- Member Cards Shimmer Row -->
                <div style="display:flex; flex-direction:column; gap:0.85rem;">
                    <div style="padding:1.15rem 1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div class="skeleton-shimmer" style="width:52px; height:52px; border-radius:14px; flex-shrink:0;"></div>
                            <div style="display:flex; flex-direction:column; gap:0.45rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <div class="skeleton-shimmer" style="width:160px; height:18px; border-radius:5px;"></div>
                                    <div class="skeleton-shimmer" style="width:90px; height:18px; border-radius:9999px;"></div>
                                </div>
                                <div class="skeleton-shimmer" style="width:190px; height:13px; border-radius:4px;"></div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.85rem;">
                            <div class="skeleton-shimmer" style="width:110px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:120px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:85px; height:34px; border-radius:8px;"></div>
                        </div>
                    </div>
                    <div style="padding:1.15rem 1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div class="skeleton-shimmer" style="width:52px; height:52px; border-radius:14px; flex-shrink:0;"></div>
                            <div style="display:flex; flex-direction:column; gap:0.45rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <div class="skeleton-shimmer" style="width:140px; height:18px; border-radius:5px;"></div>
                                    <div class="skeleton-shimmer" style="width:80px; height:18px; border-radius:9999px;"></div>
                                </div>
                                <div class="skeleton-shimmer" style="width:170px; height:13px; border-radius:4px;"></div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.85rem;">
                            <div class="skeleton-shimmer" style="width:110px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:120px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:85px; height:34px; border-radius:8px;"></div>
                        </div>
                    </div>
                    <div style="padding:1.15rem 1.25rem; border:1.5px solid #e4e4e7; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1rem;">
                            <div class="skeleton-shimmer" style="width:52px; height:52px; border-radius:14px; flex-shrink:0;"></div>
                            <div style="display:flex; flex-direction:column; gap:0.45rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <div class="skeleton-shimmer" style="width:150px; height:18px; border-radius:5px;"></div>
                                    <div class="skeleton-shimmer" style="width:75px; height:18px; border-radius:9999px;"></div>
                                </div>
                                <div class="skeleton-shimmer" style="width:180px; height:13px; border-radius:4px;"></div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.85rem;">
                            <div class="skeleton-shimmer" style="width:110px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:120px; height:22px; border-radius:6px;"></div>
                            <div class="skeleton-shimmer" style="width:85px; height:34px; border-radius:8px;"></div>
                        </div>
                    </div>
                </div>
            </div>
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
        <div class="workspace-view-wrapper" style="max-width: 1680px; width: 100%; margin: 0 auto; padding: 0 1.5rem 3.5rem; box-sizing: border-box;">

            <!-- ======================================================== -->
            <!-- 1. TOP HERO COVER BANNER (LARGE BANNER & GLASS ARMATURE) -->
            <!-- ======================================================== -->
            <div class="ws-hero-banner" style="position:relative; border-radius: 24px; overflow: hidden; min-height: 280px; ${wsInfo.bannerUrl || wsInfo.banner ? `background: linear-gradient(180deg, rgba(9, 9, 11, 0.4) 0%, rgba(9, 9, 11, 0.88) 100%), url('${wsInfo.bannerUrl || wsInfo.banner}') center/cover no-repeat;` : `background: linear-gradient(135deg, #09090b 0%, #18181b 45%, #27272a 100%);`} color: #ffffff; box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.35); border: 1.5px solid rgba(255, 255, 255, 0.14); margin-bottom: 2rem; transition: background 0.3s ease;">
                
                <!-- Ambient Glow Orbs -->
                <div style="position:absolute; width: 440px; height: 440px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%); top: -120px; right: -80px; pointer-events:none;"></div>
                <div style="position:absolute; width: 340px; height: 340px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%); bottom: -60px; left: 10%; pointer-events:none;"></div>

                <!-- Main Hero Body -->
                <div style="padding: 2.75rem 2.5rem 2.25rem; position:relative; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1.75rem;">
                    
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
            <!-- 4. CORE TWO-COLUMN ARCHITECTURE (EXPANDED ENTERPRISE CONSOLE) -->
            <!-- ======================================================== -->
            <div style="display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 2rem; align-items: start; margin-bottom: 2.25rem;">
                
                <!-- ======================== LEFT COLUMN ======================== -->
                <div style="display: flex; flex-direction: column; gap: 1.75rem;">
                    
                    <!-- RECENT ACTIVITY FEED -->
                    <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Recent Activity
                            </h3>
                            <a href="#/overview" style="font-size: 0.82rem; font-weight: 700; color: #18181B; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
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
                                <span style="font-weight: 800; color: #18181B; font-family: monospace; font-size: 0.95rem;">${escapeHtml(wsInfo.currencySymbol || '$')}</span>
                            </div>

                        </div>
                    </div>

                    ${canManageWorkers ? `
                        <!-- PENDING JOIN REQUESTS CARD (Admin & Co-Admin only) -->
                        <div id="join-requests-section" class="card" style="display:none; background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.5rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03);">
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

                </div>

            </div>

            <!-- ======================================================== -->
            <!-- 5. FULL-WIDTH ENTERPRISE MEMBERS DIRECTORY & MANAGEMENT  -->
            <!-- ======================================================== -->
            <div class="card" style="background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 20px; padding: 1.85rem 2rem; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.03); width: 100%; margin-top: 2rem; margin-bottom: 2.5rem; box-sizing: border-box;">
                
                <!-- Members Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.55rem;">
                                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em;">Members</h3>
                                <span id="members-count-badge" class="members-count-badge" style="background: var(--surface-100); color: var(--text-secondary); border: 1.5px solid var(--border-color); font-size: 0.78rem; font-weight: 800; padding: 0.15rem 0.65rem; border-radius: 999px;">...</span>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">Manage workspace team members, role assignments, staff permissions, and usage</div>
                        </div>
                    </div>
                    
                    ${canManageWorkers ? `
                        <button type="button" id="btn-quick-invite-member" class="btn btn-sm btn-primary" style="font-weight: 700; font-size: 0.82rem; padding: 0.5rem 1.15rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.45rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                            <span>Invite Member</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Search Member Filter -->
                <div style="position: relative; margin-bottom: 1.35rem;">
                    <input type="text" id="member-search-input" class="form-control" placeholder="Search members by name, email, role, or ID..." style="padding-left: 2.4rem; font-size: 0.86rem; height: 42px; border-radius: 10px; width: 100%;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position: absolute; left: 0.9rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>

                <!-- Members Cards Container (NO FIXED HEIGHT! Dynamic growth as members increase!) -->
                <div id="members-cards-container" style="display: flex; flex-direction: column; gap: 1rem; width: 100%;">
                    <!-- Dynamic Member Cards Rendered by Snapshot -->
                    <div style="padding: 2.5rem; text-align:center; color: var(--text-muted); font-size: 0.88rem;">
                        Loading workspace members...
                    </div>
                </div>

            </div>

            <!-- ======================================================== -->
            <!-- ======================================================== -->
            <!-- 5. INVITE WORKER MODAL / DRAWER                          -->
            <!-- ======================================================== -->
            <!-- ======================================================== -->
            <!-- ======================================================== -->
            <!-- 5. INVITE WORKER MODAL / DRAWER (Clean Single-Column Layout) -->
            <!-- ======================================================== -->
            <div id="add-worker-container" style="display:none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(9, 9, 11, 0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100010; align-items: center; justify-content: center; padding: 1.25rem;">
                <div class="card" style="background: #FFFFFF !important; border-radius: 20px; max-width: 480px; width: 100%; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.22); overflow: hidden; border: 1px solid #E4E4E7 !important; animation: modalPop 0.24s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- Header -->
                    <div style="background: #FFFFFF !important; border: none !important; border-bottom: none !important; padding: 1.5rem 1.85rem 0.65rem 1.85rem; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 40px; height: 40px; border-radius: 12px; background: #F4F4F5; color: #09090B; display: flex; align-items: center; justify-content: center; border: 1px solid #E4E4E7; flex-shrink: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: #09090B; letter-spacing: -0.02em;">Invite Team Member</h3>
                                <p style="margin: 0.15rem 0 0 0; font-size: 0.8rem; color: #71717A;">Direct workspace invitation</p>
                            </div>
                        </div>
                        <button type="button" id="btn-close-invite-modal" aria-label="Close" style="background: #F4F4F5; border: 1px solid #E4E4E7; color: #71717A; font-size: 1.25rem; cursor: pointer; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; line-height: 1; transition: all 0.15s ease;">&times;</button>
                    </div>

                    <!-- Clean Form Body (Only Email & Worker Access) -->
                    <form id="add-worker-form" style="padding: 1rem 1.85rem 1.85rem 1.85rem; display: flex; flex-direction: column; gap: 1.25rem; background: #FFFFFF !important;">
                        <div class="form-group" style="margin: 0;">
                            <label style="font-size: 0.84rem; font-weight: 800; color: #09090B; margin-bottom: 0.45rem; display: block;">Worker Email Address *</label>
                            <input type="email" id="worker-email" required class="form-control" style="width: 100%; height: 44px; font-size: 0.92rem; background: #F4F4F5; border: 1px solid #E4E4E7; color: #09090B; border-radius: 10px; padding: 0.6rem 0.85rem; box-sizing: border-box;" placeholder="colleague@gmail.com">
                            <small style="font-size: 0.74rem; color: #71717A; margin-top: 0.35rem; display: block;">Enter the email of the person you wish to invite.</small>
                        </div>

                        <!-- Clean Initial Worker Access Note -->
                        <div style="background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 12px; padding: 0.95rem 1.1rem; display: flex; flex-direction: column; gap: 0.45rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 0.78rem; font-weight: 800; color: #09090B; text-transform: uppercase; letter-spacing: 0.04em;">Initial Access Level</span>
                                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 6px; background: #FFFFFF; color: #09090B; border: 1px solid #E4E4E7;">Worker</span>
                            </div>
                            <p style="margin: 0; font-size: 0.78rem; color: #71717A; line-height: 1.45;">
                                All members join as standard <strong>Workers</strong> with clean default access. Once they join the workspace, you can manage their restrictions or promote them to <strong>Co-Admin</strong> in the <strong>Manage Worker</strong> panel.
                            </p>
                        </div>
                        
                        <!-- Bottom Action Buttons -->
                        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.25rem; border-top: 1px solid #E4E4E7; padding-top: 1.25rem;">
                            <button type="button" id="btn-cancel-worker" class="btn" style="height: 44px; font-weight: 700; background: #FFFFFF; border: 1.5px solid #E4E4E7; color: #09090B; border-radius: 12px; padding: 0 1.5rem; cursor: pointer; transition: all 0.15s ease;">Cancel</button>
                            <button type="submit" id="btn-submit-worker" class="btn" style="height: 44px; background: #09090B; border: none; color: #FFFFFF; font-weight: 700; border-radius: 12px; padding: 0 1.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.15s ease;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                <span>Send Invitation</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 6. MANAGE WORKER MODAL (Wider 2-Col Layout with Promote/Demote & Temporary Blocked) -->
            <!-- ======================================================== -->
            <div id="manage-worker-container" style="display:none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(9, 9, 11, 0.72); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100010; align-items: center; justify-content: center; padding: 1.25rem;">
                <div class="card" style="background: #FFFFFF !important; border-radius: 20px; max-width: 820px; width: 100%; box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.22); overflow: hidden; border: 1px solid #E4E4E7 !important; animation: modalPop 0.24s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- Header: Background & surface totally #FFFFFF & no border with clear spacing -->
                    <div style="background: #FFFFFF !important; border: none !important; border-bottom: none !important; padding: 1.5rem 1.85rem 0.65rem 1.85rem; display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 40px; height: 40px; border-radius: 12px; background: #F4F4F5; color: #09090B; display: flex; align-items: center; justify-content: center; border: 1px solid #E4E4E7; flex-shrink: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #09090B; letter-spacing: -0.02em;">Manage Team Member</h3>
                                <p style="margin: 0.15rem 0 0 0; font-size: 0.82rem; color: #71717A;">Role transition, restriction enforcement, and temporary access suspension</p>
                            </div>
                        </div>
                        <button type="button" id="btn-close-manage-modal" aria-label="Close" style="background: #F4F4F5; border: 1px solid #E4E4E7; color: #71717A; font-size: 1.25rem; cursor: pointer; width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; line-height: 1; transition: all 0.15s ease;">&times;</button>
                    </div>

                    <!-- Wider 2-Column Body -->
                    <form id="manage-worker-form" style="padding: 1rem 1.85rem 1.85rem 1.85rem; display: flex; flex-direction: column; gap: 1.35rem; background: #FFFFFF !important; max-height: 82vh; overflow-y: auto;">
                        <input type="hidden" id="manage-email">
                        <input type="hidden" id="manage-prev-role" value="WORKER">

                        <div style="display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 1.75rem; align-items: start;">
                            
                            <!-- LEFT COLUMN: MEMBER PROFILE & ROLE SHIFT (PROMOTE / DEMOTE) & TEMPORARY BLOCKED -->
                            <div style="display: flex; flex-direction: column; gap: 1.15rem;">
                                
                                <!-- Identity Preview Card -->
                                <div style="background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 14px; padding: 0.95rem 1.15rem;">
                                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                                        <div id="manage-avatar-circle" style="width: 44px; height: 44px; border-radius: 50%; background: #09090B; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.05rem; flex-shrink: 0;">
                                            M
                                        </div>
                                        <div style="overflow: hidden; flex: 1;">
                                            <div id="manage-email-display" style="font-size: 0.94rem; font-weight: 800; color: #09090B; word-break: break-all;">member@gmail.com</div>
                                            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.25rem; flex-wrap: wrap;">
                                                <span id="manage-role-pill-badge" style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 6px; background: #F4F4F5; color: #09090B; border: 1px solid #E4E4E7;">Worker</span>
                                                <span id="manage-status-pill-badge" style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 6px; background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0;">Active</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Role Assignment with Promote / Demote UI -->
                                <div class="form-group" style="background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 14px; padding: 1.1rem; margin: 0;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.45rem;">
                                        <label style="font-size: 0.84rem; font-weight: 800; color: #09090B; margin: 0;">Role Assignment & Level</label>
                                        <span id="manage-role-shift-tag" style="font-size: 0.72rem; color: #71717A; font-weight: 700;">Standard Operator</span>
                                    </div>

                                    ${isAdmin ? `
                                        <select id="manage-role" class="form-control" style="width: 100%; height: 42px; font-size: 0.92rem; background: #F4F4F5; border: 1px solid #E4E4E7; color: #09090B; border-radius: 10px; padding: 0.55rem 0.85rem; font-weight: 700; box-sizing: border-box;">
                                            <option value="WORKER">Worker (Standard Operator)</option>
                                            <option value="CO_ADMIN">Co-Admin (Elevated Manager - Full Access)</option>
                                        </select>
                                    ` : '<input type="hidden" id="manage-role" value="WORKER">'}

                                    <!-- Promote / Demote Quick Action Button -->
                                    <div id="manage-role-action-box" style="margin-top: 0.85rem;">
                                        <button type="button" id="btn-quick-shift-role" style="width: 100%; height: 42px; border-radius: 10px; font-size: 0.84rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.18s ease; border: 1.5px solid rgba(19, 223, 29, 1); background: #09090B; color: #FFFFFF;">
                                            <span id="btn-quick-shift-text" style="display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                                Promote to Co-Admin
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                <!-- TEMPORARY BLOCKED OPTION & FUNCTIONAL BLOCK -->
                                <div style="background: #FFFFFF; border: 1.5px solid #E4E4E7; border-radius: 14px; padding: 1.1rem;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <div style="display: flex; align-items: center; gap: 0.65rem;">
                                            <div style="width: 34px; height: 34px; border-radius: 9px; background: #F4F4F5; color: #09090B; display: flex; align-items: center; justify-content: center; border: 1px solid #E4E4E7; flex-shrink: 0;">
                                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            </div>
                                            <div>
                                                <strong style="font-size: 0.86rem; color: #09090B; display: block;">Temporary Blocked</strong>
                                                <span style="font-size: 0.74rem; color: #71717A;">Suspend this worker's workspace access</span>
                                            </div>
                                        </div>
                                        
                                        <!-- Self-contained custom switch toggle -->
                                        <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer; user-select: none;">
                                            <input type="checkbox" id="manage-access-revoke-toggle" style="position: absolute; opacity: 0; width: 0; height: 0;">
                                            <span id="manage-toggle-track" style="width: 44px; height: 24px; background: #E4E4E7; border-radius: 999px; transition: background 0.2s ease; display: inline-block; position: relative;">
                                                <span id="manage-toggle-thumb" style="width: 18px; height: 18px; background: #FFFFFF; border-radius: 50%; position: absolute; top: 3px; left: 3px; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 1px 3px rgba(0,0,0,0.25);"></span>
                                            </span>
                                        </label>
                                    </div>

                                    <!-- Revocation details box shown when toggle is checked -->
                                    <div id="manage-revoke-details-box" style="display: none; flex-direction: column; gap: 0.65rem; margin-top: 0.85rem; padding-top: 0.85rem; border-top: 1px solid #E4E4E7;">
                                        <div style="font-size: 0.76rem; color: #71717A; display: flex; justify-content: space-between; align-items: center;">
                                            <span>Suspension Duration:</span>
                                            <span id="manage-revoke-duration-text" style="font-weight: 700; color: #09090B;">Now &mdash; Choose End</span>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                             <span style="font-size: 0.74rem; color: #71717A; white-space: nowrap;">Blocked Until:</span>
                                             <input type="datetime-local" id="manage-revoke-end-input" class="form-control" style="flex: 1; height: 38px; font-size: 0.82rem; background: #F4F4F5; border: 1px solid #E4E4E7; border-radius: 8px; padding: 0.35rem 0.5rem; color: #09090B;">
                                        </div>
                                        <div style="font-size: 0.72rem; color: #09090B; background: #F4F4F5; padding: 0.45rem 0.65rem; border-radius: 8px; border: 1px solid #E4E4E7; line-height: 1.4;">
                                            <strong>Functional Block Active:</strong> When saved, this worker will be instantly ejected and prevented from loading this workspace until unblocked.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- RIGHT COLUMN: RESTRICTIONS CHECKBOXES & CO-ADMIN ENFORCEMENT GUARD -->
                            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.15rem;">
                                    <span style="font-size: 0.84rem; font-weight: 800; color: #09090B;">Worker Restrictions</span>
                                    <span id="manage-restrictions-badge" style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.65rem; border-radius: 999px; background: #F4F4F5; color: #09090B; border: 1px solid #E4E4E7;">
                                        Customizable for Worker
                                    </span>
                                </div>

                                <!-- Co-Admin Restriction Guard Notice: Visible when role is CO_ADMIN -->
                                <div id="manage-coadmin-guard-notice" style="display: none; padding: 1rem; border-radius: 12px; background: #FAFAFA; border: 1px dashed #E4E4E7; color: #71717A; font-size: 0.82rem; line-height: 1.5;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 800; color: #09090B; margin-bottom: 0.35rem;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#09090B" stroke-width="2.3"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                        Co-Admin Restriction Guard
                                    </div>
                                    Co-Admins have full managerial privileges and cannot be restricted. If you want to restrict this team member, <strong>you must demote them to Worker first</strong>.
                                    <div style="margin-top: 0.75rem;">
                                        <button type="button" id="btn-guard-demote-to-worker" style="padding: 0.45rem 0.95rem; font-size: 0.78rem; font-weight: 800; background: #FFFFFF; border: 1px solid #E4E4E7; color: #09090B; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s ease;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                            Demote to Worker to Apply Restrictions
                                        </button>
                                    </div>
                                </div>

                                <!-- Checkbox Groups Container -->
                                <div id="manage-restrictions-container" style="display: flex; flex-direction: column; gap: 0.85rem; transition: opacity 0.2s ease;">
                                    <!-- Action Restrictions -->
                                    <div class="form-group" style="background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 12px; padding: 0.85rem 1rem; margin: 0;">
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.55rem;">
                                            <label style="font-size: 0.78rem; font-weight: 800; color: #09090B; text-transform: uppercase; letter-spacing: 0.04em;">Action Restrictions</label>
                                            <span style="font-size: 0.68rem; background: #F4F4F5; color: #71717A; padding: 0.1rem 0.45rem; border-radius: 4px; font-weight: 700;">Worker Only</span>
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.85rem; color: #09090B;">
                                            <label class="manage-restr-label" style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; color: #09090B;">
                                                <input type="checkbox" id="manage-disable-add" class="manage-restr-box" style="accent-color: #09090B; width: 16px; height: 16px; cursor: pointer;"> Unable to Add New Data
                                            </label>
                                            <label class="manage-restr-label" style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; color: #09090B;">
                                                <input type="checkbox" id="manage-disable-delete-others" class="manage-restr-box" style="accent-color: #09090B; width: 16px; height: 16px; cursor: pointer;"> Unable to Delete Others Data
                                            </label>
                                            <label class="manage-restr-label" style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; color: #09090B;">
                                                <input type="checkbox" id="manage-disable-update-others" class="manage-restr-box" style="accent-color: #09090B; width: 16px; height: 16px; cursor: pointer;"> Unable to Update Other Data
                                            </label>
                                        </div>
                                    </div>

                                    <!-- Visibility Restrictions -->
                                    <div class="form-group" style="background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 12px; padding: 0.85rem 1rem; margin: 0;">
                                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.55rem;">
                                            <label style="font-size: 0.78rem; font-weight: 800; color: #09090B; text-transform: uppercase; letter-spacing: 0.04em;">Visibility Restrictions</label>
                                            <span style="font-size: 0.68rem; background: #F4F4F5; color: #71717A; padding: 0.1rem 0.45rem; border-radius: 4px; font-weight: 700;">Worker Only</span>
                                        </div>
                                        <div style="display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.85rem; color: #09090B;">
                                            <label class="manage-restr-label" style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; color: #09090B;">
                                                <input type="checkbox" id="manage-cannot-see-cost" class="manage-restr-box" style="accent-color: #09090B; width: 16px; height: 16px; cursor: pointer;"> Unable to see Cost
                                            </label>
                                            <label class="manage-restr-label" style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; color: #09090B;">
                                                <input type="checkbox" id="manage-cannot-see-profit" class="manage-restr-box" style="accent-color: #09090B; width: 16px; height: 16px; cursor: pointer;"> Unable to see Profit Margin
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Action Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px solid #E4E4E7; padding-top: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                            <button type="button" id="btn-remove-worker" class="btn" style="color: #09090B; border: 1px solid #E4E4E7; background: #FFFFFF; font-weight: 700; border-radius: 12px; height: 44px; padding: 0 1.25rem; cursor: pointer; transition: all 0.15s ease;">
                                Remove Member
                            </button>
                            <div style="display: flex; gap: 0.75rem;">
                                <button type="button" id="btn-cancel-manage" class="btn" style="height: 44px; font-weight: 700; background: #FFFFFF; border: 1.5px solid #E4E4E7; color: #09090B; border-radius: 12px; padding: 0 1.4rem; cursor: pointer; transition: all 0.15s ease;">Cancel</button>
                                <button type="submit" id="btn-save-manage" class="btn" style="height: 44px; background: #09090B; border: none; color: #FFFFFF; font-weight: 700; border-radius: 12px; padding: 0 1.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.15s ease;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    `;

    // -------------------------------------------------------------
    // DOM Elements & Event Handlers
    // -------------------------------------------------------------
    let addContainer = container.querySelector('#add-worker-container');
    let manageContainer = container.querySelector('#manage-worker-container');
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
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        if (curManage) curManage.style.display = 'none';
        const curAdd = document.getElementById('add-worker-container') || addContainer;
        if (curAdd) {
            if (curAdd.parentElement !== document.body) {
                document.body.appendChild(curAdd);
            }
            curAdd.style.position = 'fixed';
            curAdd.style.inset = '0';
            curAdd.style.width = '100vw';
            curAdd.style.height = '100vh';
            curAdd.style.zIndex = '100010';
            curAdd.style.display = 'flex';
            const emailInput = curAdd.querySelector('#worker-email');
            if (emailInput) {
                emailInput.value = '';
                emailInput.focus();
            }
        }
    };

    const closeInviteModal = () => {
        const curAdd = document.getElementById('add-worker-container') || addContainer;
        if (curAdd) {
            curAdd.style.display = 'none';
            const curForm = curAdd.querySelector('#add-worker-form') || addForm;
            if (curForm) curForm.reset();
        }
    };

    // Invite Submission Handler
    const handleInviteSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const curAdd = document.getElementById('add-worker-container') || addContainer;
        const aDoc = curAdd || document;
        const emailInput = aDoc.querySelector('#worker-email');
        const submitBtn = aDoc.querySelector('#btn-submit-worker');

        if (!emailInput) return;
        const cleanEmail = (emailInput.value || '').trim().toLowerCase();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!cleanEmail || !emailRegex.test(cleanEmail)) {
            showAlert.error("Please enter a valid email address.");
            emailInput.focus();
            return;
        }

        if (currentUser?.email && cleanEmail === currentUser.email.toLowerCase()) {
            showAlert.error("You cannot invite yourself to your own workspace.");
            return;
        }

        const existingMember = currentMembersList.find(m => (m.email || '').toLowerCase() === cleanEmail);
        if (existingMember) {
            if (existingMember.status === 'PENDING') {
                showAlert.warning(`An invitation has already been sent to ${cleanEmail}.`);
                return;
            } else {
                showAlert.warning(`${cleanEmail} is already a member of this workspace.`);
                return;
            }
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <div class="spinner-border spinner-border-sm" style="width: 14px; height: 14px; border: 2px solid #FFFFFF; border-right-color: transparent; border-radius: 50%; display: inline-block; animation: spin 0.75s linear infinite;"></div>
                <span>Sending...</span>
            `;
        }

        try {
            const wsName = wsInfo.name || 'PriceLister Workspace';
            const adminEmail = wsInfo.adminEmail || currentUser.email || '';
            const nowMs = Date.now();
            const inviteDocId = `${workspaceId}_${cleanEmail}`;

            // 1. Write Invite document to Firestore 'Invites' collection (exact schema matching Image 5)
            const invitePayload = {
                adminEmail: adminEmail,
                adminUid: workspaceId,
                timestamp: nowMs,
                workerEmail: cleanEmail,
                workspaceName: wsName,
                workspaceId: wsInfo.workspaceId || wsInfo.id || workspaceId,
                role: 'WORKER',
                workspaceRole: 3,
                roleTag: 'Worker',
                status: 'PENDING'
            };

            if (!isMock) {
                const inviteRef = doc(db, 'Invites', inviteDocId);
                await setDoc(inviteRef, invitePayload);
            }

            // 2. Write Pending Member document to 'Workspaces/{workspaceId}/Members/{cleanEmail}'
            const pendingMemberPayload = {
                email: cleanEmail,
                role: 'WORKER',
                workspaceRole: 3,
                roleTag: 'Worker',
                status: 'PENDING',
                invitedAt: nowMs,
                invitedBy: adminEmail,
                cannotSeeCost: false,
                cannotSeeProfit: false,
                isRestricted: false,
                disableAdd: false,
                disableDeleteOthers: false,
                disableUpdateOthers: false,
                accessRevoked: false,
                isAccessBlocked: false
            };

            if (!isMock) {
                const memberRef = doc(db, `Workspaces/${workspaceId}/Members`, cleanEmail);
                await setDoc(memberRef, pendingMemberPayload, { merge: true });
            }

            // 3. Dispatch Email Notification & User Mailbox entry
            try {
                await firestoreService.sendEmailNotification({
                    to: cleanEmail,
                    subject: `Invitation to join "${wsName}" on PriceLister`,
                    html: `
                        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1.5px solid #e4e4e7; border-radius: 16px; background: #ffffff;">
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 18px;">
                                <div style="width: 40px; height: 40px; border-radius: 10px; background: #09090b; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem;">P</div>
                                <div>
                                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #09090b;">Workspace Invitation</h2>
                                    <p style="margin: 0.15rem 0 0; font-size: 0.8rem; color: #71717a;">PriceLister Team Collaboration</p>
                                </div>
                            </div>
                            <p style="color: #27272a; font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px;">
                                You have been invited by <strong>${escapeHtml(adminEmail)}</strong> to join the workspace <strong>${escapeHtml(wsName)}</strong> as a team member.
                            </p>
                            <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                                <div style="font-size: 0.76rem; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Initial Role</div>
                                <div style="font-size: 0.92rem; font-weight: 800; color: #09090b; margin-top: 2px;">Worker (Standard Operator)</div>
                            </div>
                            <p style="color: #71717a; font-size: 0.84rem; line-height: 1.5; margin-bottom: 0;">
                                Log in to PriceLister with <strong>${escapeHtml(cleanEmail)}</strong> to view and accept this invitation.
                            </p>
                        </div>
                    `,
                    text: `You have been invited by ${adminEmail} to join "${wsName}" workspace on PriceLister as a Worker. Log in with ${cleanEmail} to accept.`,
                    type: 'workspace_invite',
                    metadata: {
                        workspaceId,
                        workspaceName: wsName,
                        adminEmail,
                        invitedAt: nowMs
                    }
                });
            } catch (mailErr) {
                console.warn("Invite email notification notice:", mailErr);
            }

            // 4. Update Mock list if in mock / demo mode
            if (isMock) {
                try {
                    let mockList = JSON.parse(localStorage.getItem('pricelister_mock_members') || '[]');
                    mockList.push({ ...pendingMemberPayload });
                    localStorage.setItem('pricelister_mock_members', JSON.stringify(mockList));
                    currentMembersList = mockList;
                    renderMembersCards(mockList);
                } catch (e) {}
            }

            showAlert.success(`Invitation successfully sent to ${cleanEmail}`);
            closeInviteModal();
        } catch (err) {
            console.error("Failed to send invitation:", err);
            showAlert.error(`Failed to send invitation: ${err.message || 'Check Firestore permissions'}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>Send Invitation</span>
                `;
            }
        }
    };

    container.querySelector('#btn-trigger-invite-hub')?.addEventListener('click', openInviteModal);
    container.querySelector('#btn-quick-invite-member')?.addEventListener('click', openInviteModal);
    container.querySelector('#qa-invite-worker')?.addEventListener('click', openInviteModal);
    (addContainer || document).querySelector('#btn-close-invite-modal')?.addEventListener('click', closeInviteModal);
    (addContainer || document).querySelector('#btn-cancel-worker')?.addEventListener('click', closeInviteModal);
    
    // Wire Invite Form Submission on both local container and document
    const curAddEl = document.getElementById('add-worker-container') || addContainer;
    (curAddEl || document).querySelector('#add-worker-form')?.addEventListener('submit', handleInviteSubmit);
    if (addForm) addForm.addEventListener('submit', handleInviteSubmit);

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

    // 4. Manage Modal Controller & Helpers
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
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        const mDoc = curManage || document;
        const startDisp = mDoc.querySelector('#manage-revoke-start-disp');
        const endInput = mDoc.querySelector('#manage-revoke-end-input');
        const durationText = mDoc.querySelector('#manage-revoke-duration-text');
        if (!durationText) return;

        const startStr = startDisp ? startDisp.textContent : formatDurationDate(Date.now());
        if (endInput && endInput.value) {
            const endStr = formatDurationDate(endInput.value);
            durationText.textContent = `${startStr} — ${endStr}`;
        } else {
            durationText.textContent = `${startStr} — (Choose End Date/Time)`;
        }
    };

    const syncManageRoleUI = (targetRole) => {
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        const mDoc = curManage || document;
        const roleSelect = mDoc.querySelector('#manage-role');
        const role = targetRole || (roleSelect ? roleSelect.value : 'WORKER');
        const isCoAdmin = (role === 'CO_ADMIN' || role === 'CO-ADMIN');

        if (roleSelect && roleSelect.value !== (isCoAdmin ? 'CO_ADMIN' : 'WORKER')) {
            roleSelect.value = isCoAdmin ? 'CO_ADMIN' : 'WORKER';
        }

        const shiftBtn = mDoc.querySelector('#btn-quick-shift-role');
        const shiftText = mDoc.querySelector('#btn-quick-shift-text');
        const shiftTag = mDoc.querySelector('#manage-role-shift-tag');
        const roleBadge = mDoc.querySelector('#manage-role-pill-badge');
        const guardNotice = mDoc.querySelector('#manage-coadmin-guard-notice');
        const restrBadge = mDoc.querySelector('#manage-restrictions-badge');
        const boxes = mDoc.querySelectorAll('.manage-restr-box');
        const labels = mDoc.querySelectorAll('.manage-restr-label');

        if (isCoAdmin) {
            if (shiftBtn) {
                shiftBtn.style.background = '#FFFFFF';
                shiftBtn.style.color = '#09090B';
                shiftBtn.style.border = '1.5px solid #E4E4E7';
            }
            if (shiftText) {
                shiftText.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="display:inline-block; vertical-align:middle; margin-right:4px;"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                    Demote to Worker
                `;
            }
            if (shiftTag) shiftTag.textContent = 'Elevated Manager (Full Access)';
            if (roleBadge) {
                roleBadge.textContent = 'Co-Admin';
                roleBadge.style.background = '#27272A';
                roleBadge.style.color = '#FFFFFF';
                roleBadge.style.borderColor = '#27272A';
            }

            if (guardNotice) guardNotice.style.display = 'block';

            boxes.forEach(b => {
                b.checked = false;
                b.disabled = true;
            });
            labels.forEach(l => {
                l.style.pointerEvents = 'none';
                l.style.opacity = '0.45';
            });

            if (restrBadge) {
                restrBadge.textContent = 'Co-Admin: Unrestricted';
                restrBadge.style.background = '#F4F4F5';
                restrBadge.style.color = '#09090B';
                restrBadge.style.borderColor = '#E4E4E7';
            }
        } else {
            if (shiftBtn) {
                shiftBtn.style.background = '#16A34A';
                shiftBtn.style.color = '#FFFFFF';
                shiftBtn.style.border = 'none';
            }
            if (shiftText) {
                shiftText.innerHTML = `
                    Promote to Co-Admin
                `;
            }
            if (shiftTag) shiftTag.textContent = 'Standard Operator';
            if (roleBadge) {
                roleBadge.textContent = 'Worker';
                roleBadge.style.background = '#F4F4F5';
                roleBadge.style.color = '#09090B';
                roleBadge.style.borderColor = '#E4E4E7';
            }

            if (guardNotice) guardNotice.style.display = 'none';

            boxes.forEach(b => {
                b.disabled = false;
            });
            labels.forEach(l => {
                l.style.pointerEvents = 'auto';
                l.style.opacity = '1';
            });

            let count = 0;
            boxes.forEach(b => { if (b.checked) count++; });
            if (restrBadge) {
                restrBadge.textContent = count > 0 ? `${count} / 5 Active` : 'Customizable for Worker';
                restrBadge.style.background = count > 0 ? '#18181B' : '#F4F4F5';
                restrBadge.style.color = count > 0 ? '#FFFFFF' : '#09090B';
                restrBadge.style.borderColor = count > 0 ? '#18181B' : '#E4E4E7';
            }
        }
    };

    const syncRevokeToggleUI = (isBlocked) => {
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        const mDoc = curManage || document;
        const toggle = mDoc.querySelector('#manage-access-revoke-toggle');
        const track = mDoc.querySelector('#manage-toggle-track');
        const thumb = mDoc.querySelector('#manage-toggle-thumb');
        const box = mDoc.querySelector('#manage-revoke-details-box');
        const statusBadge = mDoc.querySelector('#manage-status-pill-badge');

        const checked = (typeof isBlocked === 'boolean') ? isBlocked : (toggle ? toggle.checked : false);
        if (toggle && toggle.checked !== checked) toggle.checked = checked;

        if (track) track.style.background = checked ? '#18181B' : '#E4E4E7';
        if (thumb) thumb.style.transform = checked ? 'translateX(20px)' : 'translateX(0)';
        if (box) box.style.display = checked ? 'flex' : 'none';

        if (statusBadge) {
            if (checked) {
                statusBadge.textContent = 'Temporary Blocked';
                statusBadge.style.background = '#18181B';
                statusBadge.style.color = '#FFFFFF';
                statusBadge.style.borderColor = '#18181B';
            } else {
                statusBadge.textContent = 'Active';
                statusBadge.style.background = '#F4F4F5';
                statusBadge.style.color = '#09090B';
                statusBadge.style.borderColor = '#E4E4E7';
            }
        }
        updateRevocationDurationPreview();
    };

    let initialManageSnapshot = null;
    const checkManageDirty = () => {
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        const mDoc = curManage || document;
        const btnSave = mDoc.querySelector('#btn-save-manage');
        if (btnSave) btnSave.disabled = false;
    };

    const closeManageModal = () => {
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        if (curManage) curManage.style.display = 'none';
        initialManageSnapshot = null;
    };
    (manageContainer || document).querySelector('#btn-close-manage-modal')?.addEventListener('click', closeManageModal);
    (manageContainer || document).querySelector('#btn-cancel-manage')?.addEventListener('click', closeManageModal);

    const openManageForButton = (btn) => {
        if (!btn) return;
        const email = (btn.getAttribute('data-email') || '').trim();
        if (!email) return;

        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        if (!curManage) {
            console.error("manage-worker-container not found in DOM");
            return;
        }

        // Close Invite modal if open
        const curAdd = document.getElementById('add-worker-container') || addContainer;
        if (curAdd) curAdd.style.display = 'none';

        // 1. Move to body and make modal visible immediately!
        if (curManage.parentElement !== document.body) {
            document.body.appendChild(curManage);
        }
        curManage.style.position = 'fixed';
        curManage.style.inset = '0';
        curManage.style.width = '100vw';
        curManage.style.height = '100vh';
        curManage.style.zIndex = '100010';
        curManage.style.display = 'flex';

        // 2. Populate data safely
        try {
            const mDoc = curManage;
            const memberData = (currentMembersList || []).find(x => (x.email || '').toLowerCase() === email.toLowerCase());
            const isCreator = Boolean(memberData?.role === 'CREATOR_ADMIN' || memberData?.isCreator);
            const isSelf = currentUser && ((currentUser.email || '').toLowerCase() === email.toLowerCase());

            const r = (memberData?.role || btn.getAttribute('data-role') || 'WORKER').toUpperCase();
            const cannotCost = memberData ? Boolean(memberData.cannotSeeCost) : btn.getAttribute('data-cost') === '1';
            const cannotProfit = memberData ? Boolean(memberData.cannotSeeProfit) : btn.getAttribute('data-profit') === '1';
            const dAdd = memberData ? Boolean(memberData.disableAdd) : btn.getAttribute('data-add') === '1';
            const dDelOthers = memberData ? Boolean(memberData.disableDeleteOthers) : btn.getAttribute('data-del-others') === '1';
            const dUpdOthers = memberData ? Boolean(memberData.disableUpdateOthers) : btn.getAttribute('data-upd-others') === '1';
            const isRevoked = memberData ? Boolean(memberData.accessRevoked || memberData.isAccessBlocked) : (btn.getAttribute('data-revoked') === '1' || btn.getAttribute('data-blocked') === '1');
            const rStart = memberData?.revokeStart || btn.getAttribute('data-revoke-start');
            const rEnd = memberData?.revokeEnd || btn.getAttribute('data-revoke-end');
            const rStartFmt = memberData?.revokeStartFormatted || btn.getAttribute('data-revoke-start-fmt');

            const emailInp = mDoc.querySelector('#manage-email');
            if (emailInp) emailInp.value = email;

            const emailDisp = mDoc.querySelector('#manage-email-display');
            if (emailDisp) emailDisp.textContent = email;

            const prevRoleInput = mDoc.querySelector('#manage-prev-role');
            if (prevRoleInput) {
                prevRoleInput.value = (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? 'CO_ADMIN' : 'WORKER';
            }

            const avatarCircle = mDoc.querySelector('#manage-avatar-circle');
            if (avatarCircle) {
                const managePhoto = memberData?.photoURL || memberData?.photo || (isCreator ? (window.__activeWorkspace?.adminPhotoURL || (isSelf ? currentUser.photoURL : '')) : (isSelf ? currentUser.photoURL : ''));
                if (managePhoto) {
                    avatarCircle.innerHTML = `<img src="${escapeHtml(managePhoto)}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    avatarCircle.textContent = (email.charAt(0) || 'M').toUpperCase();
                }
            }

            const roleSelect = mDoc.querySelector('#manage-role');
            if (roleSelect) {
                roleSelect.value = (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? 'CO_ADMIN' : 'WORKER';
            }

            const costBox = mDoc.querySelector('#manage-cannot-see-cost');
            const profitBox = mDoc.querySelector('#manage-cannot-see-profit');
            if (costBox) costBox.checked = cannotCost;
            if (profitBox) profitBox.checked = cannotProfit;

            const addBox = mDoc.querySelector('#manage-disable-add');
            const delOthersBox = mDoc.querySelector('#manage-disable-delete-others');
            const updOthersBox = mDoc.querySelector('#manage-disable-update-others');
            if (addBox) addBox.checked = dAdd;
            if (delOthersBox) delOthersBox.checked = dDelOthers;
            if (updOthersBox) updOthersBox.checked = dUpdOthers;

            syncManageRoleUI(r);

            const startDisp = mDoc.querySelector('#manage-revoke-start-disp');
            const endInput = mDoc.querySelector('#manage-revoke-end-input');

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

            syncRevokeToggleUI(isRevoked);

            initialManageSnapshot = {
                role: (roleSelect ? roleSelect.value : 'WORKER'),
                cannotCost: (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? false : cannotCost,
                cannotProfit: (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? false : cannotProfit,
                dAdd: (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? false : dAdd,
                dDelOthers: (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? false : dDelOthers,
                dUpdOthers: (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? false : dUpdOthers,
                isRevoked,
                endVal: endInput ? endInput.value : ''
            };

            const btnSave = mDoc.querySelector('#btn-save-manage');
            if (btnSave) btnSave.disabled = false;
        } catch (popErr) {
            console.warn("Manage modal population notice:", popErr);
        }
    };

    window.openManageWorkerModal = function(btn) {
        if (!btn) return;
        openManageForButton(btn);
    };

    window.openManageWorkerByEmail = function(targetEmail) {
        if (!targetEmail) return;
        const btn = document.querySelector(`.btn-manage-member[data-email="${targetEmail}"]`) || 
                    document.querySelector(`button[data-email="${targetEmail}"]`);
        if (btn) {
            openManageForButton(btn);
        } else {
            const m = (currentMembersList || []).find(x => (x.email || '').toLowerCase() === targetEmail.toLowerCase());
            if (m) {
                const syntheticBtn = document.createElement('button');
                syntheticBtn.setAttribute('data-email', m.email || targetEmail);
                syntheticBtn.setAttribute('data-role', (m.role || 'WORKER').toUpperCase());
                syntheticBtn.setAttribute('data-cost', m.cannotSeeCost ? '1' : '0');
                syntheticBtn.setAttribute('data-profit', m.cannotSeeProfit ? '1' : '0');
                syntheticBtn.setAttribute('data-add', m.disableAdd ? '1' : '0');
                syntheticBtn.setAttribute('data-del-others', m.disableDeleteOthers ? '1' : '0');
                syntheticBtn.setAttribute('data-upd-others', m.disableUpdateOthers ? '1' : '0');
                syntheticBtn.setAttribute('data-revoked', m.accessRevoked ? '1' : '0');
                syntheticBtn.setAttribute('data-blocked', m.isAccessBlocked ? '1' : '0');
                syntheticBtn.setAttribute('data-revoke-start', m.revokeStart || '');
                syntheticBtn.setAttribute('data-revoke-end', m.revokeEnd || '');
                syntheticBtn.setAttribute('data-revoke-start-fmt', m.revokeStartFormatted || '');
                syntheticBtn.setAttribute('data-revoke-end-fmt', m.revokeEndFormatted || '');
                openManageForButton(syntheticBtn);
            }
        }
    };

    // Global document delegation for manage buttons as fail-safe
    if (!document.__manageWorkerGlobalDelegated) {
        document.__manageWorkerGlobalDelegated = true;
        document.addEventListener('click', (e) => {
            const manageBtn = e.target.closest('.btn-manage-member');
            if (manageBtn) {
                e.preventDefault();
                e.stopPropagation();
                openManageForButton(manageBtn);
            }
        });
    }

    // -------------------------------------------------------------
    // Real-Time Members Firestore Listener
    // -------------------------------------------------------------
    const renderMembersCards = (members) => {
        if (!membersCardsContainer) return;

        const query = (memberSearchInput?.value || '').trim().toLowerCase();
        const filtered = query ? members.filter(m => {
            const em = (m.email || '').toLowerCase();
            const nm = (m.name || m.displayName || '').toLowerCase();
            const r = (m.role || '').toLowerCase();
            const rTag = (m.roleTag || '').toLowerCase();
            const wId = (m.appWorkerId || m.workerUid || '').toLowerCase();
            return em.includes(query) || nm.includes(query) || r.includes(query) || rTag.includes(query) || wId.includes(query);
        }) : members;

        if (filtered.length === 0) {
            membersCardsContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.88rem; background: var(--surface-50); border: 1.5px dashed var(--border-color); border-radius: 14px;">
                    No members found matching "${escapeHtml(query)}"
                </div>
            `;
            return;
        }

        // Strict 3-Tier Sorting Rule:
        // Tier 1: Creator Admin on the very top (highlighted with green outline)
        // Tier 2: My Card (You) directly after creator admin
        // Tier 3: Other members (Co-Admins -> Workers -> Visitors)
        const sortedMembers = [...filtered].sort((a, b) => {
            const aCreator = Boolean(a.isCreator || a.role === 'CREATOR_ADMIN' || (wsInfo.adminEmail && (a.email || '').toLowerCase() === (wsInfo.adminEmail || '').toLowerCase()) || (wsInfo.email && (a.email || '').toLowerCase() === (wsInfo.email || '').toLowerCase()));
            const bCreator = Boolean(b.isCreator || b.role === 'CREATOR_ADMIN' || (wsInfo.adminEmail && (b.email || '').toLowerCase() === (wsInfo.adminEmail || '').toLowerCase()) || (wsInfo.email && (b.email || '').toLowerCase() === (wsInfo.email || '').toLowerCase()));
            if (aCreator && !bCreator) return -1;
            if (!aCreator && bCreator) return 1;

            const aSelf = currentUser && (a.email || '').toLowerCase() === (currentUser.email || '').toLowerCase();
            const bSelf = currentUser && (b.email || '').toLowerCase() === (currentUser.email || '').toLowerCase();
            if (aSelf && !bSelf) return -1;
            if (!aSelf && bSelf) return 1;

            const roleWeight = { 'CREATOR_ADMIN': 1, 'ADMIN': 1, 'CO_ADMIN': 2, 'CO-ADMIN': 2, 'WORKER': 3, 'VISITOR': 4 };
            const aWeight = Number(a.workspaceRole) || roleWeight[(a.role || 'WORKER').toUpperCase()] || 99;
            const bWeight = Number(b.workspaceRole) || roleWeight[(b.role || 'WORKER').toUpperCase()] || 99;
            if (aWeight !== bWeight) return aWeight - bWeight;

            return (a.email || '').localeCompare(b.email || '');
        });

        membersCardsContainer.innerHTML = sortedMembers.map(m => {
            const isCreator = Boolean(m.isCreator || m.role === 'CREATOR_ADMIN' || (wsInfo.adminEmail && (m.email || '').toLowerCase() === (wsInfo.adminEmail || '').toLowerCase()) || (wsInfo.email && (m.email || '').toLowerCase() === (wsInfo.email || '').toLowerCase()));
            const rUpper = (m.role || (isCreator ? 'CREATOR_ADMIN' : 'WORKER')).toUpperCase();
            const statusUpper = (m.status || 'JOINED').toUpperCase();
            const isPending = statusUpper === 'PENDING';
            const isBlocked = Boolean(m.accessRevoked || m.isAccessBlocked);
            
            const hasRestrictions = !isPending && !isCreator && Boolean(
                m.isRestricted || m.cannotSeeCost || m.cannotSeeProfit || 
                m.disableAdd || m.disableDeleteOthers || m.disableDelete || 
                m.disableUpdateOthers || m.disableUpdate || isBlocked
            );

            const isSelf = currentUser && (m.email || '').toLowerCase() === (currentUser.email || '').toLowerCase();
            
            // Member Display Name & Initial
            let displayName = (m.name || m.displayName || '').trim();
            if (!displayName) {
                if (isCreator && wsInfo.adminName) {
                    displayName = wsInfo.adminName;
                } else if (m.email) {
                    displayName = m.email.split('@')[0];
                } else {
                    displayName = 'Member';
                }
            }
            const nameInitial = (displayName.charAt(0) || 'M').toUpperCase();
            
            // Member Photo
            const memberPhoto = m.photoURL || m.photo || (isCreator ? (wsInfo.adminPhotoURL || (isSelf ? currentUser.photoURL : '')) : (isSelf ? currentUser.photoURL : ''));

            // App Worker ID Resolution
            let rawWorkerId = m.appWorkerId || m.workerUid || m.workerId || m.id;
            if (!rawWorkerId || rawWorkerId.length > 20) {
                if (isCreator) {
                    rawWorkerId = wsInfo.adminId || 'ADMIN-HEAD';
                } else if (m.workerUid) {
                    rawWorkerId = m.workerUid.substring(0, 10).toUpperCase();
                } else {
                    rawWorkerId = 'WRK-' + (m.email ? Math.abs(m.email.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0)).toString(36).toUpperCase().substring(0, 6) : '01');
                }
            }
            const cleanWorkerId = String(rawWorkerId).replace(/^#/, '');

            // Combined AssetsUsage: Product + Cat + Invoice + Client + Business + Barcode + Everything used inside workspace
            const pAdded = Number(isCreator ? (wsInfo.adminProductCount ?? m.productAdded ?? 0) : (m.productAdded ?? m.productCount ?? 0));
            const invAdded = Number(isCreator ? (wsInfo.adminInvoiceCount ?? m.invoiceAdded ?? 0) : (m.invoiceAdded ?? m.invoiceCount ?? 0));
            const catAdded = Number(isCreator ? (wsInfo.adminCategoryCount ?? m.categoryAdded ?? 0) : (m.categoryAdded ?? m.categoryCount ?? 0));
            const clientAdded = Number(isCreator ? (wsInfo.adminClientCount ?? m.clientAdded ?? 0) : (m.clientAdded ?? m.clientCount ?? 0));
            const busAdded = Number(isCreator ? (wsInfo.adminBusinessCount ?? m.businessAdded ?? 0) : (m.businessAdded ?? m.businessCount ?? 0));
            const barcodeAdded = Number(isCreator ? (wsInfo.adminBarcodeCount ?? m.barcodesCreated ?? 0) : (m.barcodesCreated ?? m.barcodeAdded ?? 0));
            const explicitUsage = Number(m.assetsUsage ?? m.totalUsage ?? 0);

            // Cross-reference live items in memory created by this worker ID or email
            const wIdLower = cleanWorkerId.toLowerCase();
            const emailLower = (m.email || '').toLowerCase();
            let liveTouchedCount = 0;
            if (Array.isArray(productsList) && (wIdLower || emailLower)) {
                liveTouchedCount += productsList.filter(p => {
                    const c = String(p.creatorId || p.createdBy || p.creator || '').toLowerCase();
                    return (wIdLower && c === wIdLower) || (emailLower && c === emailLower);
                }).length;
            }
            if (Array.isArray(categoriesList) && (wIdLower || emailLower)) {
                liveTouchedCount += categoriesList.filter(c => {
                    const cr = String(c.creatorId || c.createdBy || c.creator || '').toLowerCase();
                    return (wIdLower && cr === wIdLower) || (emailLower && cr === emailLower);
                }).length;
            }

            const totalAssetsUsage = Math.max(pAdded + invAdded + catAdded + clientAdded + busAdded + barcodeAdded + explicitUsage, liveTouchedCount);

            // Card Border and Background Styling (Spacious Full-Width Enterprise Architecture)
            let cardStyle = 'background: var(--bg-card); border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.35rem 1.75rem; transition: all 0.2s ease; box-shadow: var(--shadow-subtle); width: 100%; box-sizing: border-box;';
            
            if (isCreator) {
                // Creator in very top Green outlined highlighted
                cardStyle = 'background: var(--bg-card); border: 2px solid #10B981 !important; border-radius: 18px; padding: 1.35rem 1.75rem; transition: all 0.2s ease; box-shadow: 0 6px 25px -4px rgba(16, 185, 129, 0.18); position: relative; width: 100%; box-sizing: border-box;';
            } else if (isBlocked) {
                // Access Suspended / Blocked
                cardStyle = 'background: var(--bg-card); border: 1.5px solid var(--border-color); border-bottom: 4px solid #EF4444 !important; border-radius: 18px; padding: 1.35rem 1.75rem; transition: all 0.2s ease; box-shadow: 0 2px 10px rgba(239, 68, 68, 0.08); width: 100%; box-sizing: border-box;';
            } else if (hasRestrictions) {
                // Restricted worker: yellow/amber bottom border
                cardStyle = 'background: var(--bg-card); border: 1.5px solid var(--border-color); border-bottom: 4px solid #F59E0B !important; border-radius: 18px; padding: 1.35rem 1.75rem; transition: all 0.2s ease; box-shadow: 0 2px 10px rgba(245, 158, 11, 0.08); width: 100%; box-sizing: border-box;';
            }

            // Role Badge styling
            let rolePillHtml = '';
            if (isCreator) {
                rolePillHtml = `
                    <span style="font-size: 0.74rem; font-weight: 800; padding: 0.22rem 0.65rem; border-radius: 6px; background: #ECFDF5; color: #047857; border: 1.5px solid #10B981; display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#10B981"     xmlns="http://www.w3.org/2000/svg"> <path d="M13.5 1L3 14h7l-1 9L21 10h-7l1.5-9z"/></svg> <span>Creator Admin</span>
                    </span>
                `;
            } else if (rUpper === 'CO_ADMIN' || rUpper === 'CO-ADMIN') {
                rolePillHtml = `
                    <span style="font-size: 0.74rem; font-weight: 800; padding: 0.22rem 0.65rem; border-radius: 6px; background: #18181B; color: #FFFFFF; border: 1px solid #18181B; display: inline-flex; align-items: center; gap: 4px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>${escapeHtml(m.roleTag || 'Co-Admin')}</span>
                    </span>
                `;
            } else {
                rolePillHtml = `
                    <span style="font-size: 0.74rem; font-weight: 700; padding: 0.22rem 0.6rem; border-radius: 6px; background: #F4F4F5; color: #18181B; border: 1px solid #E4E4E7;">
                        ${escapeHtml(m.roleTag || 'Worker')}
                    </span>
                `;
            }

            // Status Indicator styling
            let statusDotColor = isBlocked ? '#EF4444' : (isPending ? '#71717A' : (hasRestrictions ? '#F59E0B' : '#10B981'));
            let statusBadgeHtml = `
                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 6px; background: #F4F4F5; color: #18181B; border: 1px solid #E4E4E7; display: inline-flex; align-items: center; gap: 4px;">
                    <span style="width: 7px; height: 7px; border-radius: 50%; background: ${statusDotColor};"></span>
                    Joined
                </span>
            `;
            if (isPending) {
                statusBadgeHtml = `
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 6px; background: #F4F4F5; color: #71717A; border: 1px solid #E4E4E7; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #71717A;"></span>
                        Pending Invite
                    </span>
                `;
            } else if (isBlocked) {
                statusBadgeHtml = `
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 6px; background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #EF4444;"></span>
                        Access Blocked
                    </span>
                `;
            } else if (hasRestrictions) {
                statusBadgeHtml = `
                    <span style="font-size: 0.72rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 6px; background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; display: inline-flex; align-items: center; gap: 4px;">
                        <span style="width: 7px; height: 7px; border-radius: 50%; background: #F59E0B;"></span>
                        Restricted
                    </span>
                `;
            }

            // Joined date resolution
            let joinedDateFormatted = 'Active Member';
            const rawJoined = m.joinedAt || m.timestamp || m.createdAt;
            if (rawJoined) {
                try {
                    const jd = typeof rawJoined === 'number' ? new Date(rawJoined) : (rawJoined.toDate ? rawJoined.toDate() : new Date(rawJoined));
                    if (!isNaN(jd.getTime())) {
                        joinedDateFormatted = jd.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                    }
                } catch (e) {}
            }

            // Action button (Manage button outlined grey)
            let actionBtnHtml = '';
            if (canManageWorkers && !isSelf) {
                if (isPending) {
                    actionBtnHtml = `
                        <button type="button" class="btn btn-sm btn-secondary btn-cancel-invite" data-email="${escapeHtml(m.email)}" style="font-size:0.82rem; padding:0.5rem 1.15rem; border-radius:10px; font-weight:700; cursor:pointer; transition:all 0.15s ease;">
                            Cancel Invite
                        </button>
                    `;
                } else if ((isAdmin && !isCreator) || (isCoAdmin && !isCreator && rUpper === 'WORKER')) {
                    actionBtnHtml = `
                        <button type="button" class="btn btn-sm btn-secondary btn-manage-member" 
                            onclick="window.openManageWorkerModal(this)"
                            data-email="${escapeHtml(m.email)}" 
                            data-role="${rUpper}"
                            data-cost="${m.cannotSeeCost ? '1' : '0'}"
                            data-profit="${m.cannotSeeProfit ? '1' : '0'}"
                            data-add="${m.disableAdd ? '1' : '0'}"
                            data-del-others="${m.disableDeleteOthers ? '1' : '0'}"
                            data-upd-others="${m.disableUpdateOthers ? '1' : '0'}"
                            data-revoked="${m.accessRevoked ? '1' : '0'}"
                            data-blocked="${m.isAccessBlocked ? '1' : '0'}"
                            data-revoke-start="${m.revokeStart || ''}"
                            data-revoke-end="${m.revokeEnd || ''}"
                            data-revoke-start-fmt="${escapeHtml(m.revokeStartFormatted || '')}"
                            data-revoke-end-fmt="${escapeHtml(m.revokeEndFormatted || '')}"
                            style="font-size:0.84rem; padding:0.55rem 1.25rem; font-weight:700; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:0.5rem; transition:all 0.15s ease;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            <span>Manage</span>
                        </button>
                    `;
                }
            }

            // Dedicated Bottom Restriction Strip (error/yellow for visibility)
            let restrictionBottomBarHtml = '';
            if (isBlocked) {
                restrictionBottomBarHtml = `
                    <div style="margin-top: 1rem; padding: 0.75rem 1.15rem; background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: #B91C1C; font-size: 0.82rem; font-weight: 800;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                            <span>WORKSPACE ACCESS SUSPENDED</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #991B1B; font-weight: 600;">
                            Worker is blocked from accessing workspace operations & data
                        </div>
                    </div>
                `;
            } else if (hasRestrictions) {
                const tags = [];
                if (m.cannotSeeCost) tags.push('Hide Cost Price');
                if (m.cannotSeeProfit) tags.push('Hide Profit Margin');
                if (m.disableAdd) tags.push('Disable Add');
                if (m.disableUpdateOthers) tags.push('No Edit Others');
                if (m.disableDeleteOthers) tags.push('No Delete Others');
                if (m.disableDelete && !m.disableDeleteOthers) tags.push('No Delete');

                restrictionBottomBarHtml = `
                    <div style="margin-top: 1rem; padding: 0.75rem 1.15rem; background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.65rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; color: #B45309; font-size: 0.82rem; font-weight: 800;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            <span>Active Restrictions & Visibility Limits:</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
                            ${tags.map(t => `<span style="font-size: 0.74rem; font-weight: 800; background: #FEF3C7; color: #92400E; padding: 0.2rem 0.55rem; border-radius: 6px; border: 1px solid #FCD34D;">${escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                `;
            }

            return `
                <div class="member-large-card" style="${cardStyle}">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
                        
                        <!-- Left Details: Avatar + Info -->
                        <div style="display: flex; align-items: center; gap: 1.25rem; min-width: 280px; flex: 1;">
                            
                            <!-- Large Avatar (56px) -->
                            <div style="width: 56px; height: 56px; border-radius: 16px; background: var(--surface-100); color: var(--text-primary); border: 1.5px solid ${isCreator ? '#10B981' : 'var(--border-color)'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.25rem; flex-shrink: 0; position: relative; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                ${memberPhoto ? `
                                    <img src="${escapeHtml(memberPhoto)}" alt="${escapeHtml(displayName)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                    <span style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${nameInitial}</span>
                                ` : nameInitial}
                                <span style="position: absolute; bottom: 3px; right: 3px; width: 12px; height: 12px; border-radius: 50%; background: ${statusDotColor}; border: 2.5px solid #FFFFFF; z-index: 2;"></span>
                            </div>

                            <!-- Name, Email & Metadata Badges -->
                            <div style="display: flex; flex-direction: column; gap: 0.35rem; min-width: 0; flex: 1;">
                                
                                <!-- Row 1: Name + (You) + Role Pill + Status -->
                                <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
                                    <span style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary); letter-spacing: -0.01em;">
                                        ${escapeHtml(displayName)}
                                    </span>
                                    ${isSelf ? '<span style="font-size: 0.74rem; font-weight: 800; color: var(--text-primary); background: var(--surface-100); padding: 0.18rem 0.55rem; border-radius: 6px; border: 1px solid var(--border-color);">(You)</span>' : ''}
                                    ${rolePillHtml}
                                    ${statusBadgeHtml}
                                </div>

                                <!-- Row 2: Full Email -->
                                <div style="font-size: 0.88rem; color: var(--text-secondary); font-weight: 500; word-break: break-all;">
                                    ${escapeHtml(m.email || 'No email')}
                                </div>

                                <!-- Row 3: ID (#appWorkerId) + AssetsUsage + Joined Date -->
                                <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap; margin-top: 0.25rem;">
                                    
                                    <!-- ID Badge -->
                                    <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; font-weight: 700; background: var(--surface-100); color: var(--text-primary); padding: 0.22rem 0.65rem; border-radius: 6px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 5px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        ID: #${escapeHtml(cleanWorkerId)}
                                    </span>

                                    <!-- AssetsUsage Badge -->
                                    <span style="font-size: 0.78rem; font-weight: 700; background: var(--surface-100); color: var(--text-primary); padding: 0.22rem 0.7rem; border-radius: 6px; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 5px;" title="Combined workspace footprint (products, invoices, categories, clients, businesses, barcodes)">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                        <span>AssetsUsage: <strong style="color: var(--text-primary); font-weight: 800; font-size: 0.84rem;">${totalAssetsUsage}</strong></span>
                                    </span>

                                    <!-- Joined Date Badge -->
                                    <span style="font-size: 0.76rem; font-weight: 600; color: var(--text-secondary); background: var(--surface-100); border: 1px solid var(--border-color); padding: 0.22rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        <span>Joined: ${escapeHtml(joinedDateFormatted)}</span>
                                    </span>

                                    ${isCreator ? `
                                        <span style="font-size: 0.74rem; font-weight: 700; color: #047857; background: #ECFDF5; border: 1.5px solid #A7F3D0; padding: 0.2rem 0.65rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                                            Head Administrator
                                        </span>
                                    ` : ''}
                                </div>

                            </div>
                        </div>

                        <!-- Right Details: Action Button -->
                        <div style="flex-shrink: 0;">
                            ${actionBtnHtml}
                        </div>

                    </div>

                    <!-- Bottom Restriction / Visibility Bar -->
                    ${restrictionBottomBarHtml}
                </div>
            `;
        }).join('');

        // Attach action handlers directly to buttons
        container.querySelectorAll('.btn-manage-member').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openManageForButton(e.currentTarget);
            });
        });

        // Also delegate on membersCardsContainer for robust zero-failure handling
        if (membersCardsContainer && !membersCardsContainer.__manageClickBound) {
            membersCardsContainer.__manageClickBound = true;
            membersCardsContainer.addEventListener('click', (e) => {
                const manageBtn = e.target.closest('.btn-manage-member');
                if (manageBtn) {
                    e.stopPropagation();
                    openManageForButton(manageBtn);
                }
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

    // Subscribe to Members Subcollection (with Mock / Demo sandbox fallback)
    const isMock = workspaceId === 'ws_dev_mock' || workspaceId === 'dev-mock-uid' || !workspaceId ||
                   (typeof localStorage !== 'undefined' && localStorage.getItem('pricelister_demo_mode') === 'true');

    let unsubMembers = null;
    let unsubJoinRequests = null;

    if (isMock) {
        firestoreService.getWorkspaceMembers(workspaceId).then(mockMembers => {
            const members = Array.isArray(mockMembers) ? [...mockMembers] : [];
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
            if (membersCountBadge) membersCountBadge.textContent = `${members.length}`;
            if (heroMembersBadgeText) heroMembersBadgeText.textContent = `${members.length} member${members.length === 1 ? '' : 's'}`;
            if (statMembersCount) statMembersCount.textContent = `${members.length}`;
            renderMembersCards(members);
        }).catch(err => {
            console.warn("Mock members load warning:", err);
        });
    } else {
        try {
            const membersRef = collection(db, 'Workspaces/' + workspaceId + '/Members');
            unsubMembers = onSnapshot(membersRef, (snap) => {
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
    }

    // -------------------------------------------------------------
    // Join Requests Listener (Admin & Co-Admin only)
    // -------------------------------------------------------------
    if (canManageWorkers) {
        const joinReqSection = container.querySelector('#join-requests-section');
        const joinReqContainer = container.querySelector('#join-requests-container');
        const joinReqBadge = container.querySelector('#join-requests-count-badge');

        try {
            unsubJoinRequests = firestoreService.listenJoinRequests(workspaceId, (requests) => {
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

    // Wire Manage Modal Promote/Demote & Role Handlers
    (manageContainer || document).querySelector('#btn-quick-shift-role')?.addEventListener('click', () => {
        const mDoc = manageContainer || document;
        const roleSelect = mDoc.querySelector('#manage-role');
        const currentRole = roleSelect ? roleSelect.value : 'WORKER';
        const nextRole = (currentRole === 'CO_ADMIN') ? 'WORKER' : 'CO_ADMIN';
        if (roleSelect) roleSelect.value = nextRole;
        syncManageRoleUI(nextRole);
        checkManageDirty();
    });

    (manageContainer || document).querySelector('#btn-guard-demote-to-worker')?.addEventListener('click', () => {
        const mDoc = manageContainer || document;
        const roleSelect = mDoc.querySelector('#manage-role');
        if (roleSelect) roleSelect.value = 'WORKER';
        syncManageRoleUI('WORKER');
        checkManageDirty();
        showAlert.info("Member demoted to Worker. You can now configure restriction checkboxes below.");
    });

    (manageContainer || document).querySelector('#manage-role')?.addEventListener('change', (e) => {
        syncManageRoleUI(e.target.value);
        checkManageDirty();
    });

    (manageContainer || document).querySelectorAll('.manage-restr-box').forEach(b => {
        b.addEventListener('change', () => {
            const mDoc = manageContainer || document;
            const roleSelect = mDoc.querySelector('#manage-role');
            if (roleSelect && roleSelect.value !== 'CO_ADMIN') {
                let count = 0;
                mDoc.querySelectorAll('.manage-restr-box').forEach(x => { if (x.checked) count++; });
                const restrBadge = mDoc.querySelector('#manage-restrictions-badge');
                if (restrBadge) {
                    restrBadge.textContent = count > 0 ? `${count} / 5 Active` : 'Customizable for Worker';
                    restrBadge.style.background = count > 0 ? '#18181B' : '#F4F4F5';
                    restrBadge.style.color = count > 0 ? '#FFFFFF' : '#09090B';
                    restrBadge.style.borderColor = count > 0 ? '#18181B' : '#E4E4E7';
                }
            }
            checkManageDirty();
        });
    });

    // Wire Temporary Blocked Switch Handlers
    (manageContainer || document).querySelector('#manage-access-revoke-toggle')?.addEventListener('change', (e) => {
        syncRevokeToggleUI(e.target.checked);
        checkManageDirty();
    });

    (manageContainer || document).querySelector('#manage-revoke-end-input')?.addEventListener('input', () => {
        updateRevocationDurationPreview();
        checkManageDirty();
    });

    // Save Manage Changes with Action Restrictions, Visibility Restrictions and Temporary Revocation
    const handleManageSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const curManage = document.getElementById('manage-worker-container') || manageContainer;
        const mDoc = curManage || document;
        const btnSave = mDoc.querySelector('#btn-save-manage');
        if (btnSave) btnSave.disabled = true;

        const email = (mDoc.querySelector('#manage-email')?.value || '').trim().toLowerCase();
        if (!email) {
            if (btnSave) btnSave.disabled = false;
            return;
        }

        const prevRole = mDoc.querySelector('#manage-prev-role')?.value || 'WORKER';
        const roleSelect = mDoc.querySelector('#manage-role');
        const newRole = roleSelect ? roleSelect.value : 'WORKER';
        const isCoAdmin = (newRole === 'CO_ADMIN');
        
        // If Co-Admin, all restrictions are strictly disabled and cleared
        const cannotSeeCost = isCoAdmin ? false : Boolean(mDoc.querySelector('#manage-cannot-see-cost')?.checked);
        const cannotSeeProfit = isCoAdmin ? false : Boolean(mDoc.querySelector('#manage-cannot-see-profit')?.checked);
        const dAdd = isCoAdmin ? false : Boolean(mDoc.querySelector('#manage-disable-add')?.checked);
        const dDelOthers = isCoAdmin ? false : Boolean(mDoc.querySelector('#manage-disable-delete-others')?.checked);
        const dUpdOthers = isCoAdmin ? false : Boolean(mDoc.querySelector('#manage-disable-update-others')?.checked);
        
        // Temporary Revocation & Functional Block Logic
        const accessRevoked = Boolean(mDoc.querySelector('#manage-access-revoke-toggle')?.checked);
        let revokeStart = null;
        let revokeEnd = null;
        let revokeStartFormatted = '';
        let revokeEndFormatted = '';
        let isAccessBlocked = false;

        if (accessRevoked) {
            const startDisp = mDoc.querySelector('#manage-revoke-start-disp');
            const endInput = mDoc.querySelector('#manage-revoke-end-input');

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
            isAccessBlocked = (nowMs >= revokeStart && nowMs <= revokeEnd) || accessRevoked;
        }

        const isRestricted = cannotSeeCost || cannotSeeProfit || dAdd || dDelOthers || dUpdOthers || accessRevoked;
        const isPromoted = (prevRole === 'WORKER' && newRole === 'CO_ADMIN');
        const isDemoted = (prevRole === 'CO_ADMIN' && newRole === 'WORKER');

        // New System Role Rule: Promote resets tag to 'Co-Admin', Demote resets tag to 'Worker'
        let finalRoleTag;
        if (isPromoted) {
            finalRoleTag = 'Co-Admin';
        } else if (isDemoted) {
            finalRoleTag = 'Worker';
        } else {
            finalRoleTag = memberData?.roleTag || (isCoAdmin ? 'Co-Admin' : 'Worker');
        }

        const targetWorkspaceRole = isCoAdmin ? 2 : 3;

        try {
            const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
            const updatePayload = {
                role: newRole,
                workspaceRole: targetWorkspaceRole,
                roleTag: finalRoleTag,
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
            };

            // Notification Handler: Record in worker document & dispatch to console and Firestore
            if (isPromoted) {
                updatePayload.lastNotification = {
                    type: 'ROLE_PROMOTION',
                    title: 'Promoted to Co-Admin',
                    message: `Promoted by ${currentUser.email || 'Admin'}`,
                    timestamp: Date.now()
                };
            } else if (isDemoted) {
                updatePayload.lastNotification = {
                    type: 'ROLE_DEMOTION',
                    title: 'Demoted to Worker',
                    message: `Shifted to Worker by ${currentUser.email || 'Admin'}`,
                    timestamp: Date.now()
                };
            }

            // If mock / demo sandbox, update in local storage mock members
            if (isMock) {
                try {
                    let mockList = JSON.parse(localStorage.getItem('pricelister_mock_members') || '[]');
                    const idx = mockList.findIndex(m => (m.email || '').toLowerCase() === email.toLowerCase());
                    if (idx >= 0) {
                        mockList[idx] = { ...mockList[idx], ...updatePayload };
                    } else {
                        mockList.push({ email, ...updatePayload });
                    }
                    localStorage.setItem('pricelister_mock_members', JSON.stringify(mockList));
                    currentMembersList = mockList;
                    renderMembersCards(mockList);
                } catch (e) {
                    console.warn("Mock member update notice:", e);
                }
            } else {
                await setDoc(memberRef, updatePayload, { merge: true });

                // Synchronize role and restriction status with Connections collection if workerUid exists
                try {
                    let workerUid = null;
                    const mSnap = await getDoc(memberRef);
                    if (mSnap.exists()) {
                        workerUid = mSnap.data()?.workerUid;
                    }
                    if (workerUid) {
                        const connRef = doc(db, 'Connections', workerUid);
                        await setDoc(connRef, {
                            role: newRole,
                            workspaceRole: targetWorkspaceRole,
                            roleTag: finalRoleTag,
                            isAccessBlocked: isAccessBlocked,
                            accessRevoked: accessRevoked,
                            updatedAt: Date.now()
                        }, { merge: true });
                    }
                } catch (cErr) {
                    console.warn("Connection sync warning on manage save:", cErr);
                }
            }

                // Send Firestore Notification & Console Broadcast
                if (isPromoted) {
                    // Send to worker console
                    console.log(
                        '%c[PriceLister Firebase Firestore]%c Worker Promoted to Co-Admin: %c' + email + '%c. Notification dispatched to worker console and stored in Firestore.',
                        'background: #18181B; color: #FFFFFF; font-weight: 800; padding: 2px 8px; border-radius: 4px;',
                        'color: #09090B; font-weight: 700;',
                        'color: #18181B; font-weight: 800;',
                        'color: #71717A;'
                    );

                    try {
                        const notifRef = doc(collection(db, 'Workspaces/' + workspaceId + '/Notifications'));
                        await setDoc(notifRef, {
                            type: 'ROLE_PROMOTION',
                            targetEmail: email,
                            promotedBy: currentUser.email || 'Admin',
                            previousRole: 'WORKER',
                            newRole: 'CO_ADMIN',
                            title: 'You have been promoted to Co-Admin!',
                            message: `Admin ${currentUser.email || 'Admin'} promoted you to Co-Admin in workspace ${wsInfo.name || 'PriceLister'}. You now have full management privileges.`,
                            read: false,
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        console.warn("Could not save promotion notification doc:", e);
                    }

                    showAlert.success(`Worker ${email} promoted to Co-Admin! Notification sent to worker console and saved in Firebase Firestore.`);
                } else if (isDemoted) {
                    console.log(
                        '%c[PriceLister Firebase Firestore]%c Co-Admin Demoted to Worker: %c' + email + '%c. Restrictions can now be applied.',
                        'background: #18181B; color: #FFFFFF; font-weight: 800; padding: 2px 8px; border-radius: 4px;',
                        'color: #09090B; font-weight: 700;',
                        'color: #18181B; font-weight: 800;',
                        'color: #71717A;'
                    );

                    try {
                        const notifRef = doc(collection(db, 'Workspaces/' + workspaceId + '/Notifications'));
                        await setDoc(notifRef, {
                            type: 'ROLE_DEMOTION',
                            targetEmail: email,
                            demotedBy: currentUser.email || 'Admin',
                            previousRole: 'CO_ADMIN',
                            newRole: 'WORKER',
                            title: 'Role Shifted to Worker',
                            message: `Your role has been shifted to Worker in workspace ${wsInfo.name || 'PriceLister'}. Restrictions may now apply.`,
                            read: false,
                            timestamp: Date.now()
                        });
                    } catch (e) {
                        console.warn("Could not save demotion notification doc:", e);
                    }

                    showAlert.info(`Co-Admin ${email} demoted to Worker. Restrictions applied.`);
                } else if (isAccessBlocked) {
                    console.warn('[PriceLister Firebase Firestore] Worker ' + email + ' is now functionally BLOCKED from workspace ' + workspaceId);
                    showAlert.warning(`Worker ${email} is now Temporarily Blocked and suspended from the workspace.`);
                } else {
                    showAlert.success(`Member settings updated for ${email}`);
                }
                
                closeManageModal();
            } catch (err) {
                console.error("Update member error:", err);
                showAlert.error("Failed to update member. Check permissions.");
            } finally {
                btnSave.disabled = false;
            }
        };

        if (manageForm) manageForm.addEventListener('submit', handleManageSubmit);
        (manageContainer || document).querySelector('#manage-worker-form')?.addEventListener('submit', handleManageSubmit);

        // Remove Member
        (manageContainer || document).querySelector('#btn-remove-worker')?.addEventListener('click', async () => {
            const mDoc = manageContainer || document;
            const email = (mDoc.querySelector('#manage-email').value || '').trim().toLowerCase();
            if (!email) return;

            if (await showAlert.confirm(
                `Are you sure you want to remove ${email} from this workspace? They will immediately lose access and be notified by email.`,
                "Remove Member",
                { confirmText: "Remove Member", cancelText: "Cancel", isDestructive: true }
            )) {
                const btnRemove = mDoc.querySelector('#btn-remove-worker');
                if (btnRemove) {
                    btnRemove.disabled = true;
                    btnRemove.textContent = 'Removing...';
                }

                try {
                    const wsInfo = window.__activeWorkspace || {};
                    const wsName = wsInfo.name || 'PriceLister Workspace';
                    const adminEmail = wsInfo.adminEmail || wsInfo.email || (currentUser?.email || '');

                    // 1. Get member record to resolve workerUid before deletion
                    let workerUid = null;
                    try {
                        const mSnap = await getDoc(doc(db, `Workspaces/${workspaceId}/Members`, email));
                        if (mSnap.exists()) {
                            workerUid = mSnap.data()?.workerUid;
                        }
                    } catch (e) {
                        console.warn("Could not read member before deletion:", e);
                    }

                    // 2. Delete member document from workspace
                    await deleteDoc(doc(db, `Workspaces/${workspaceId}/Members`, email));

                    // 3. Delete worker's Connection document to sever access immediately
                    if (workerUid) {
                        await deleteDoc(doc(db, 'Connections', workerUid)).catch(e => console.warn("Connection delete error:", e));
                    }
                    
                    // Also query Connections collection by adminUid and email as safety fallback
                    try {
                        const connQuery = query(collection(db, 'Connections'), where('adminUid', '==', workspaceId));
                        const connSnaps = await getDocs(connQuery);
                        connSnaps.forEach(async (cDoc) => {
                            const cData = cDoc.data();
                            if ((cData.email && cData.email.toLowerCase() === email) || cDoc.id === workerUid) {
                                await deleteDoc(doc(db, 'Connections', cDoc.id)).catch(() => {});
                            }
                        });
                    } catch (e) {}

                    // 4. Delete any pending invite
                    try {
                        await deleteDoc(doc(db, 'Invites', `${workspaceId}_${email}`));
                    } catch (e) {}

                    // 5. Decrement workersCount in workspace document
                    try {
                        await updateDoc(doc(db, 'Workspaces', workspaceId), {
                            workersCount: increment(-1)
                        });
                    } catch (e) {}

                    // 6. Send Email Notification via Firestore trigger email and mailbox
                    try {
                        await firestoreService.notifyWorkerRemoved(wsName, email, adminEmail);
                    } catch (e) {
                        console.warn("Failed to dispatch worker removal notification:", e);
                    }

                    showAlert.success(`${email} has been removed from the workspace.`);
                    closeManageModal();
                } catch (err) {
                    console.error("Remove member error:", err);
                    showAlert.error("Failed to remove member. Check permissions.");
                    if (btnRemove) {
                        btnRemove.disabled = false;
                        btnRemove.textContent = 'Remove Member';
                    }
                }
            }
        });

    container._cleanup = () => {
        if (typeof unsubMembers === 'function') {
            unsubMembers();
            unsubMembers = null;
        }
        if (typeof unsubJoinRequests === 'function') {
            unsubJoinRequests();
            unsubJoinRequests = null;
        }
    };
};
