import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getProductService } from '../services/productService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getSettingsService } from '../services/settingsService.js';
import { userDataSafetyService } from '../services/userDataSafetyService.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml, openAccountSwitcherModal, getUserRestrictions } from '../auth-handler.js';
import { openExportModal } from './importExportModal.js';

export const renderProfile = async (container, workspaceId) => {
    // Clean up any previously attached active realtime listeners on this container
    if (container._profileUnsubs && Array.isArray(container._profileUnsubs)) {
        container._profileUnsubs.forEach(unsub => {
            try { if (typeof unsub === 'function') unsub(); } catch(e) {}
        });
        container._profileUnsubs = [];
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">Please log in to view your profile.</div>`;
        return;
    }

    const productService = getProductService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const settingsService = getSettingsService(workspaceId);

    // Initial Skeleton Loading State
    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem;">
            <h2>My Profile</h2>
            <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">Manage your account details and view workspace footprint.</p>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card);">
                <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem;">
                    <div class="skeleton-shimmer" style="width:72px; height:72px; border-radius:50%;"></div>
                    <div>
                        <div class="skeleton-shimmer" style="width:140px; height:22px; margin-bottom:8px;"></div>
                        <div class="skeleton-shimmer" style="width:180px; height:16px; margin-bottom:8px;"></div>
                        <div class="skeleton-shimmer" style="width:80px; height:20px; border-radius:10px;"></div>
                    </div>
                </div>
                <div style="background:var(--surface-50); padding:1.25rem; border-radius:10px; display:flex; flex-direction:column; gap:0.75rem;">
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                </div>
            </div>
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card);">
                <div class="skeleton-shimmer" style="width:180px; height:22px; margin-bottom:1.25rem;"></div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem;">
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch initial workspace details
        const [wsData, initialProducts, initialCustInvoices, initialBusInvoices, initialBusinesses, initialCustomers, initialClients, initialCategories, isVending] = await Promise.all([
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null),
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => []),
            peopleService.getAllBusinesses().catch(() => []),
            peopleService.getAllCustomers().catch(() => []),
            peopleService.getAllClients().catch(() => []),
            categoryService.getAllCategories().catch(() => []),
            settingsService.isVendingEnabled().catch(() => false)
        ]);

        const adminUid = wsData?.id || workspaceId;
        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        const email = currentUser.email;
        const photoURL = currentUser.photoURL;
        const role = wsData?.role || (wsData?.id === currentUser.uid ? 'CREATOR_ADMIN' : 'WORKER');
        const workspaceName = wsData?.name || wsData?.businessName || 'My Workspace';
        const initial = displayName.charAt(0).toUpperCase();

        const isAdmin = role === 'CREATOR_ADMIN' || role === 'ADMIN' || role === 'CREATOR' || wsData?.id === currentUser.uid;
        const isCoAdmin = role === 'CO_ADMIN' || role === 'CO-ADMIN';
        const canAccessSettings = isAdmin || isCoAdmin;

        // Fetch member specifics if Worker/Co-Admin
        let myMember = null;
        if (!isAdmin) {
            try {
                const members = await firestoreService.getWorkspaceMembers(adminUid);
                myMember = members.find(m => m.email?.toLowerCase() === email.toLowerCase());
            } catch (err) {
                console.warn("Could not load worker member doc:", err);
            }
        }

        // 1. Resolve User ID (appWorkerId for workers, adminId for admin)
        const displayUserId = isAdmin
            ? (wsData?.adminId || wsData?.workspaceId || currentUser.uid.substring(0, 14))
            : (myMember?.appWorkerId || myMember?.workerId || myMember?.uniqueId || myMember?.id || currentUser.uid.substring(0, 14));

        // 2. Resolve Workspace ID (14-character workspaceId, NOT the Firestore document uid)
        const displayWorkspaceId = wsData?.workspaceId 
            || (wsData?.adminId && wsData.adminId.length === 14 ? wsData.adminId : null)
            || wsData?.uniqueId 
            || (workspaceId.length === 14 ? workspaceId : 'N/A');

        // All possible identity aliases for the current user to detect items created by her/him
        const userIds = [
            currentUser.uid,
            currentUser.email,
            displayUserId,
            myMember?.appWorkerId,
            myMember?.workerUid,
            myMember?.uniqueId,
            myMember?.id,
            wsData?.adminId,
            wsData?.workspaceId
        ].filter(Boolean).map(s => String(s).trim().toLowerCase());

        // Helper: Check if an item was created by the current user
        const isUserItem = (item) => {
            if (!item) return false;
            const cId = String(item.creatorId || item.workerId || item.appWorkerId || item.creator || '').trim().toLowerCase();
            if (!cId) {
                // If item has no creatorId and user is admin/creator of the workspace, treat as admin's
                return isAdmin;
            }
            return userIds.includes(cId) || (isAdmin && (cId === 'admin' || cId === 'creator' || cId === 'unknown'));
        };

        let joinedTimestamp = isAdmin ? (wsData?.createdAt || Date.now()) : (myMember?.joinedAt || myMember?.timestamp || Date.now());
        const joinedDateFormatted = (() => {
            if (!joinedTimestamp) return 'Active Member';
            const d = typeof joinedTimestamp === 'number' 
                ? new Date(joinedTimestamp) 
                : (joinedTimestamp.toDate ? joinedTimestamp.toDate() : new Date());
            return isNaN(d.getTime()) ? 'Active Member' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        })();

        // Live Real-Time State Stores
        let liveProducts = initialProducts || [];
        let liveCustInvoices = initialCustInvoices || [];
        let liveBusInvoices = initialBusInvoices || [];
        let liveCategories = initialCategories || [];
        let liveCustomers = initialCustomers || [];
        let liveBusinesses = initialBusinesses || [];
        let liveClients = initialClients || [];
        let docMetrics = isAdmin ? (wsData || {}) : (myMember || {});

        // Initial initial footprint numbers
        const initPCount = liveProducts.filter(isUserItem).length;
        const initInvCount = (liveCustInvoices.concat(liveBusInvoices)).filter(isUserItem).length;
        const initCatCount = liveCategories.filter(isUserItem).length;
        const initClientCount = liveClients.filter(isUserItem).length;
        const initBusCount = liveBusinesses.filter(isUserItem).length;
        const initDelCount = Number(isAdmin ? (docMetrics?.adminTotalDeleted ?? docMetrics?.adminTotalDeletedCount ?? 0) : (docMetrics?.totalDeleted ?? 0));

        const userRestrictions = getUserRestrictions();
        const roleUpper = (role || 'WORKER').toUpperCase();
        const isCreator = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'CREATOR' || isAdmin;

        const isGoogleUser = Boolean(
            (currentUser.providerData && currentUser.providerData.some(p => p.providerId === 'google.com')) || 
            currentUser.authProvider === 'google.com' || 
            currentUser.authProvider === 'google'
        );

        let restrictionsCardHtml = '';
        if (isCreator) {
            restrictionsCardHtml = `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); border-left: 4px solid #10b981; background: var(--bg-card); margin-bottom: 2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:40px; height:40px; border-radius:10px; background:rgba(16,185,129,0.12); color:#059669; display:flex; align-items:center; justify-content:center;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Creator Admin — Full Unrestricted Access</h4>
                                <p style="margin:0; font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Creator safety protection is active. As the workspace creator, all restrictions are unconditionally bypassed.</p>
                            </div>
                        </div>
                        <span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; font-weight:700; padding:0.35rem 0.75rem; border-radius:6px;">All Access Granted</span>
                    </div>
                </div>
            `;
        } else if (userRestrictions.isRestricted) {
            const restrictionBadges = [];
            if (userRestrictions.cannotSeeCost) restrictionBadges.push(`<span class="badge" style="background:rgba(239,68,68,0.1); color:#dc2626; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; font-size:0.8rem;">Restricted: Cannot View Cost (••••)</span>`);
            if (userRestrictions.cannotSeeProfit) restrictionBadges.push(`<span class="badge" style="background:rgba(245,158,11,0.1); color:#d97706; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; font-size:0.8rem;">Restricted: Cannot View Profit (••••)</span>`);
            if (userRestrictions.disableAdd) restrictionBadges.push(`<span class="badge" style="background:rgba(100,116,139,0.1); color:#64748b; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; font-size:0.8rem;">Restricted: Creation Disabled</span>`);
            if (userRestrictions.disableUpdate) restrictionBadges.push(`<span class="badge" style="background:rgba(100,116,139,0.1); color:#64748b; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; font-size:0.8rem;">Restricted: Modification Disabled</span>`);
            if (userRestrictions.disableDelete) restrictionBadges.push(`<span class="badge" style="background:rgba(239,68,68,0.1); color:#dc2626; font-weight:700; padding:0.35rem 0.65rem; border-radius:6px; font-size:0.8rem;">Restricted: Deletion Disabled</span>`);

            restrictionsCardHtml = `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); border-left: 4px solid #f59e0b; background: var(--bg-card); margin-bottom: 2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.75rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:40px; height:40px; border-radius:10px; background:rgba(245,158,11,0.12); color:#d97706; display:flex; align-items:center; justify-content:center;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Active Restrictions & Policy</h4>
                                <p style="margin:0; font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Your workspace administrator has assigned the following active restrictions to your account:</p>
                            </div>
                        </div>
                        <span class="badge" style="background:rgba(245,158,11,0.12); color:#d97706; font-weight:700; padding:0.35rem 0.75rem; border-radius:6px;">Restricted Member</span>
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
                        ${restrictionBadges.join('')}
                    </div>
                </div>
            `;
        } else {
            restrictionsCardHtml = `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); border-left: 4px solid var(--primary); background: var(--bg-card); margin-bottom: 2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:40px; height:40px; border-radius:10px; background:var(--primary-subtle); color:var(--primary); display:flex; align-items:center; justify-content:center;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                            </div>
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Standard Member — Full Data Access</h4>
                                <p style="margin:0; font-size:0.8rem; color:var(--text-muted); margin-top:2px;">You currently have full operational access to products, invoices, and analytics in this workspace.</p>
                            </div>
                        </div>
                        <span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; font-weight:700; padding:0.35rem 0.75rem; border-radius:6px;">Standard Access</span>
                    </div>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="module-header" style="margin-bottom: 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                    <h2 style="margin:0 0 0.35rem 0;">My Profile</h2>
                    <p style="color: var(--text-secondary); margin: 0;">Account identity, credentials, and personal contribution footprint.</p>
                </div>
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center;">
                    <button id="btn-profile-switch-acc" class="btn btn-primary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                        Switch / Add Account
                    </button>
                    ${canAccessSettings ? `
                        <button id="btn-profile-settings" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            Workspace Settings
                        </button>
                    ` : ''}
                    ${!isAdmin ? `
                        <button id="btn-profile-leave-ws" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger); font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Leave Workspace
                        </button>
                    ` : ''}
                    <button id="btn-profile-logout" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger); font-weight:600;">Sign Out</button>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 1. PROFILE MAIN ITEMS (USER IDENTITY & WORKSPACE CARDS) -->
            <!-- ======================================================== -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
                
                <!-- USER IDENTITY CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem;">
                            ${photoURL 
                                ? `<img src="${photoURL}" alt="${displayName}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:3px solid var(--surface-200); box-shadow:0 4px 10px rgba(0,0,0,0.1);">` 
                                : `<div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #334155, #0f172a); color:white; font-size:1.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.15);">${initial}</div>`
                            }
                            <div>
                                <h3 style="margin:0 0 0.25rem 0; font-size:1.35rem; color:var(--text-primary); font-weight:700;">${displayName}</h3>
                                <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.5rem;">${email}</div>
                                <div>
                                    ${getRoleBadgeHtml(role)}
                                </div>
                            </div>
                        </div>

                        <div style="background:var(--surface-50); padding:1.25rem; border-radius:10px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Account Email</span>
                                <strong style="color:var(--text-primary);">${email}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">User ID</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--text-primary); background:rgba(0,0,0,0.05); padding:0.15rem 0.5rem; border-radius:4px;">${displayUserId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Connected Workspace</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--primary); background:rgba(16,185,129,0.08); padding:0.15rem 0.5rem; border-radius:4px;">${displayWorkspaceId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Active Role</span>
                                <div>${getRoleBadgeHtml(role)}</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Auth Provider</span>
                                <span style="color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                                    ${isGoogleUser ? `
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                                        Google OAuth
                                    ` : `
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        Email & Password
                                    `}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- WORKSPACE DETAILS CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                            <h3 style="margin:0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">
                                Workspace Overview
                            </h3>
                            <span class="badge" style="background:${isVending ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)'}; color:${isVending ? '#059669' : '#64748b'}; font-weight:700; font-size:0.75rem;">
                                ${isVending ? 'Vending Mode Active' : 'Standard Mode'}
                            </span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.9rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Workspace Name</span>
                                <strong style="color:var(--text-primary); font-size:1.05rem;">${workspaceName}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Workspace Code</span>
                                <code style="font-family:monospace; font-size:0.88rem; color:var(--primary); font-weight:700;">${displayWorkspaceId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Joined Workspace</span>
                                <strong style="color:var(--text-primary);">${joinedDateFormatted}</strong>
                            </div>
                            
                            <!-- Quick Metric Grid -->
                            <div style="margin-top:0.75rem; display:grid; grid-template-columns: repeat(2, 1fr); gap:0.75rem;">
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-products" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveProducts.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Active Products</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-invoices" style="font-size:1.35rem; font-weight:800; color:var(--primary);">${liveCustInvoices.length + liveBusInvoices.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Total Invoices</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-businesses" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveBusinesses.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Businesses</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-customers" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveCustomers.length + liveClients.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Customers</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 2. MY CONTRIBUTIONS & CREATIONS DASHBOARD CARD           -->
            <!-- ======================================================== -->
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">
                            ACTIVITY & CREATION DASHBOARD (LIVE)
                        </div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                            My Creations & Activity Footprint
                        </h3>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); background:var(--surface-50); padding:0.4rem 0.85rem; border-radius:8px; border:1px solid var(--border-color);">
                        Member since: <strong style="color:var(--text-primary);">${joinedDateFormatted}</strong>
                    </div>
                </div>

                <!-- Clean Grid of Creation Metrics (Matching Android MembersScreen.kt) -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Products Created</span>
                        <strong id="prof-metric-products" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initPCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Invoices Issued</span>
                        <strong id="prof-metric-invoices" style="font-size:1.75rem; font-weight:800; color:var(--primary);">${initInvCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Categories Created</span>
                        <strong id="prof-metric-categories" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initCatCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Clients Added</span>
                        <strong id="prof-metric-clients" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initClientCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Businesses Added</span>
                        <strong id="prof-metric-businesses" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initBusCount}</strong>
                    </div>
                </div>

                <!-- Highlighted Deletion Tracker (Matching MembersScreen.kt DeleteSweep) -->
                <div style="background:rgba(239, 68, 68, 0.08); border:1.5px solid rgba(239, 68, 68, 0.35); border-radius:10px; padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:38px; height:38px; border-radius:8px; background:rgba(239, 68, 68, 0.15); color:#ef4444; display:flex; align-items:center; justify-content:center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <div>
                            <strong style="color:#b91c1c; font-size:0.95rem; display:block;">Total Deletions Tracker</strong>
                            <span style="color:#ef4444; font-size:0.8rem;">Recorded item removals & audit deletions</span>
                        </div>
                    </div>
                    <div id="prof-metric-deletions" style="font-size:1.6rem; font-weight:900; color:#b91c1c; font-family:monospace; background:white; padding:0.25rem 0.85rem; border-radius:8px; border:1px solid rgba(239,68,68,0.3);">
                        ${String(initDelCount).padStart(2, '0')}
                    </div>
                </div>
            </div>

            ${restrictionsCardHtml}

            <!-- ======================================================== -->
            <!-- SECURITY & PASSWORD MANAGEMENT                            -->
            <!-- ======================================================== -->
            ${isGoogleUser ? `
                <div class="card" style="padding: 1.5rem 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem; border-left: 4px solid #4285F4; background: var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <div style="width:44px; height:44px; border-radius:12px; background:rgba(66, 133, 244, 0.1); color:#4285F4; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <svg width="22" height="22" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 style="margin:0 0 0.25rem 0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Google Account Security</h4>
                            <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">You are signed in with Google Authentication. Password changes are handled securely by Google &bull; In-app password reset is not required.</p>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="card" style="padding: 1.75rem 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem;">
                    <!-- Card Top Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.35rem; border-bottom:1px solid var(--border-color); padding-bottom:0.85rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.18rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Security & Password
                            </h3>
                            <p style="margin:0.25rem 0 0 0; font-size:0.84rem; color:var(--text-secondary);">Choose your password action to enter the dedicated management panel.</p>
                        </div>
                        <span class="badge" style="background:rgba(225,29,72,0.1); color:#e11d48; font-weight:700; font-size:0.75rem;">Email / Password</span>
                    </div>

                    <!-- 1. HUB SELECTION VIEW (Options not shown directly, choose first) -->
                    <div id="prof-pwd-hub-selection" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                        <!-- CHOICE 1: UPDATE PASSWORD -->
                        <div id="prof-card-opt-update" style="border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; background:var(--surface-50); cursor:pointer; transition:all 0.2s ease; display:flex; flex-direction:column; justify-content:space-between; gap:1rem;">
                            <div style="display:flex; align-items:flex-start; gap:0.85rem;">
                                <div style="width:42px; height:42px; border-radius:10px; background:rgba(24,24,27,0.08); display:flex; align-items:center; justify-content:center; color:var(--text-primary); flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>
                                <div>
                                    <strong style="display:block; font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">Update Password</strong>
                                    <span style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; display:block;">Change your password immediately using your current active password.</span>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end;">
                                <button type="button" class="btn btn-sm btn-primary" style="font-weight:700; pointer-events:none; border-radius:8px;">
                                    Update Password &rarr;
                                </button>
                            </div>
                        </div>

                        <!-- CHOICE 2: RESET PASSWORD (BY OTP) -->
                        <div id="prof-card-opt-reset" style="border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; background:var(--surface-50); cursor:pointer; transition:all 0.2s ease; display:flex; flex-direction:column; justify-content:space-between; gap:1rem;">
                            <div style="display:flex; align-items:flex-start; gap:0.85rem;">
                                <div style="width:42px; height:42px; border-radius:10px; background:rgba(225,29,72,0.1); display:flex; align-items:center; justify-content:center; color:#e11d48; flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                                <div>
                                    <strong style="display:block; font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">Reset Password</strong>
                                    <span style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; display:block;">Forgot your current password? Verify with a 6-digit OTP code sent to your email.</span>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end;">
                                <button type="button" class="btn btn-sm btn-outline" style="font-weight:700; pointer-events:none; border-radius:8px; color:#e11d48; border-color:#e11d48;">
                                    Reset by OTP &rarr;
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 2. DEDICATED PANEL: UPDATE PASSWORD (USING CURRENT PASSWORD) -->
                    <div id="prof-panel-update-pwd" style="display:none;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary btn-prof-back-hub" style="font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                                &larr; Back to Options
                            </button>
                            <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Update Using Current Password</span>
                        </div>

                        <form id="prof-change-pwd-form" style="max-width:440px; display:flex; flex-direction:column; gap:1.1rem;">
                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Current Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-curr-pwd" required placeholder="Enter current password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-curr-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-new-pwd" required minlength="6" placeholder="At least 6 characters" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-new-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Confirm New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-conf-pwd" required minlength="6" placeholder="Repeat new password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-conf-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button type="submit" id="btn-prof-save-pwd" class="btn btn-primary" style="font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                                    <span>Update Password</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- 3. DEDICATED PANEL: RESET PASSWORD (BY EMAIL OTP) -->
                    <div id="prof-panel-reset-otp" style="display:none;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary btn-prof-back-hub" style="font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                                &larr; Back to Options
                            </button>
                            <span style="font-size:0.8rem; font-weight:700; color:#e11d48;">Reset by Email OTP</span>
                        </div>

                        <!-- Step 1: Send OTP -->
                        <div id="prof-otp-step-1" style="max-width:440px;">
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem; line-height:1.5;">
                                We'll send a 6-digit verification code to your registered email address <strong>${email}</strong>.
                            </p>
                            <button type="button" id="btn-prof-trigger-otp" class="btn btn-primary" style="font-weight:700; background:#e11d48; border-color:#e11d48;">
                                Send 6-Digit OTP Code &rarr;
                            </button>
                        </div>

                        <!-- Step 2: Verify OTP FIRST (Password inputs are locked & hidden) -->
                        <div id="prof-otp-step-2" style="display:none; max-width:440px; flex-direction:column; gap:1rem;">
                            <div style="background:rgba(225, 29, 72, 0.08); padding:0.85rem 1rem; border-radius:10px; font-size:0.82rem; color:#be123c;">
                                Verification code generated! <span id="prof-otp-hint" style="font-weight:700; display:block; margin-top:4px;"></span>
                            </div>

                            <div style="text-align:center;">
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.5rem; color:var(--text-primary);">Enter 6-Digit OTP Code</label>
                                <div style="display:flex; justify-content:center; gap:0.55rem; margin-bottom:0.75rem;" id="prof-otp-blocks-wrap">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="0" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="1" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="2" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="3" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="4" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-digit-box" data-idx="5" style="width:50px; height:56px; text-align:center; font-family:var(--custom-user-font, 'Outfit', sans-serif); font-variant-numeric:tabular-nums; font-size:1.7rem; font-weight:800; border-radius:12px; border:2px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); outline:none; transition:all 0.16s ease;">
                                </div>
                            </div>

                            <div>
                                <button type="button" id="btn-prof-verify-otp-only" class="btn btn-primary" style="font-weight:700; background:#e11d48; border-color:#e11d48; width:100%;">
                                    Verify OTP Code to Unlock &rarr;
                                </button>
                            </div>
                        </div>

                        <!-- Step 3: Unlocked Password Form (Only shown after valid OTP verification) -->
                        <form id="prof-otp-step-3" style="display:none; max-width:440px; flex-direction:column; gap:1.1rem;">
                            <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.3); padding:0.85rem 1rem; border-radius:10px; font-size:0.82rem; color:#059669; font-weight:700;">
                                &#10004; OTP Code Verified! Password Reset Unlocked.
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-new-pwd" required minlength="6" placeholder="At least 6 characters" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-otp-new-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Confirm New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-conf-pwd" required minlength="6" placeholder="Repeat new password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-otp-conf-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button type="submit" id="btn-prof-save-unlocked-pwd" class="btn btn-primary" style="font-weight:700; background:#e11d48; border-color:#e11d48; width:100%;">
                                    Confirm & Update Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `}

            <!-- ======================================================== -->
            <!-- 1. PROFILE MAIN ITEMS (USER IDENTITY & WORKSPACE CARDS) -->
            <!-- ======================================================== -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
                
                <!-- USER IDENTITY CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem;">
                            ${photoURL 
                                ? `<img src="${photoURL}" alt="${displayName}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:3px solid var(--surface-200); box-shadow:0 4px 10px rgba(0,0,0,0.1);">` 
                                : `<div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #334155, #0f172a); color:white; font-size:1.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.15);">${initial}</div>`
                            }
                            <div>
                                <h3 style="margin:0 0 0.25rem 0; font-size:1.35rem; color:var(--text-primary); font-weight:700;">${displayName}</h3>
                                <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.5rem;">${email}</div>
                                <div>
                                    ${getRoleBadgeHtml(role)}
                                </div>
                            </div>
                        </div>

                        <div style="background:var(--surface-50); padding:1.25rem; border-radius:10px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Account Email</span>
                                <strong style="color:var(--text-primary);">${email}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">User ID</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--text-primary); background:rgba(0,0,0,0.05); padding:0.15rem 0.5rem; border-radius:4px;">${displayUserId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Connected Workspace</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--primary); background:rgba(16,185,129,0.08); padding:0.15rem 0.5rem; border-radius:4px;">${displayWorkspaceId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Active Role</span>
                                <div>${getRoleBadgeHtml(role)}</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Auth Provider</span>
                                <span style="color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                                    ${isGoogleUser ? `
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                                        Google OAuth
                                    ` : `
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        Email & Password
                                    `}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- WORKSPACE DETAILS CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                            <h3 style="margin:0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">
                                Workspace Overview
                            </h3>
                            <span class="badge" style="background:${isVending ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)'}; color:${isVending ? '#059669' : '#64748b'}; font-weight:700; font-size:0.75rem;">
                                ${isVending ? 'Vending Mode Active' : 'Standard Mode'}
                            </span>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.9rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Workspace Name</span>
                                <strong style="color:var(--text-primary); font-size:1.05rem;">${workspaceName}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Workspace Code</span>
                                <code style="font-family:monospace; font-size:0.88rem; color:var(--primary); font-weight:700;">${displayWorkspaceId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                                <span style="color:var(--text-secondary);">Joined Workspace</span>
                                <strong style="color:var(--text-primary);">${joinedDateFormatted}</strong>
                            </div>
                            
                            <!-- Quick Metric Grid -->
                            <div style="margin-top:0.75rem; display:grid; grid-template-columns: repeat(2, 1fr); gap:0.75rem;">
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-products" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveProducts.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Active Products</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-invoices" style="font-size:1.35rem; font-weight:800; color:var(--primary);">${liveCustInvoices.length + liveBusInvoices.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Total Invoices</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-businesses" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveBusinesses.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Businesses</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div id="prof-overview-customers" style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${liveCustomers.length + liveClients.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Customers</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 2. MY CONTRIBUTIONS & CREATIONS DASHBOARD CARD           -->
            <!-- ======================================================== -->
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">
                            ACTIVITY & CREATION DASHBOARD (LIVE)
                        </div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                            My Creations & Activity Footprint
                        </h3>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); background:var(--surface-50); padding:0.4rem 0.85rem; border-radius:8px; border:1px solid var(--border-color);">
                        Member since: <strong style="color:var(--text-primary);">${joinedDateFormatted}</strong>
                    </div>
                </div>

                <!-- Clean Grid of Creation Metrics (Matching Android MembersScreen.kt) -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Products Created</span>
                        <strong id="prof-metric-products" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initPCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Invoices Issued</span>
                        <strong id="prof-metric-invoices" style="font-size:1.75rem; font-weight:800; color:var(--primary);">${initInvCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Categories Created</span>
                        <strong id="prof-metric-categories" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initCatCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Clients Added</span>
                        <strong id="prof-metric-clients" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initClientCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Businesses Added</span>
                        <strong id="prof-metric-businesses" style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${initBusCount}</strong>
                    </div>
                </div>

                <!-- Highlighted Deletion Tracker (Matching MembersScreen.kt DeleteSweep) -->
                <div style="background:rgba(239, 68, 68, 0.08); border:1.5px solid rgba(239, 68, 68, 0.35); border-radius:10px; padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:38px; height:38px; border-radius:8px; background:rgba(239, 68, 68, 0.15); color:#ef4444; display:flex; align-items:center; justify-content:center;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </div>
                        <div>
                            <strong style="color:#b91c1c; font-size:0.95rem; display:block;">Total Deletions Tracker</strong>
                            <span style="color:#ef4444; font-size:0.8rem;">Recorded item removals & audit deletions</span>
                        </div>
                    </div>
                    <div id="prof-metric-deletions" style="font-size:1.6rem; font-weight:900; color:#b91c1c; font-family:monospace; background:white; padding:0.25rem 0.85rem; border-radius:8px; border:1px solid rgba(239,68,68,0.3);">
                        ${String(initDelCount).padStart(2, '0')}
                    </div>
                </div>
            </div>

            ${restrictionsCardHtml}

            <!-- ======================================================== -->
            <!-- SECURITY & PASSWORD MANAGEMENT                            -->
            <!-- ======================================================== -->
            ${isGoogleUser ? `
                <div class="card" style="padding: 1.5rem 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem; border-left: 4px solid #4285F4; background: var(--bg-card);">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <div style="width:44px; height:44px; border-radius:12px; background:rgba(66, 133, 244, 0.1); color:#4285F4; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <svg width="22" height="22" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 style="margin:0 0 0.25rem 0; font-size:1.05rem; font-weight:700; color:var(--text-primary);">Google Account Security</h4>
                            <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">You are signed in with Google Authentication. Password changes are handled securely by Google &bull; In-app password reset is not required.</p>
                        </div>
                    </div>
                </div>
            ` : `
                <div class="card" style="padding: 1.75rem 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem;">
                    <!-- Card Top Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.35rem; border-bottom:1px solid var(--border-color); padding-bottom:0.85rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.18rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                Security & Password
                            </h3>
                            <p style="margin:0.25rem 0 0 0; font-size:0.84rem; color:var(--text-secondary);">Choose your password action to enter the dedicated management panel.</p>
                        </div>
                        <span class="badge" style="background:rgba(225,29,72,0.1); color:#e11d48; font-weight:700; font-size:0.75rem;">Email / Password</span>
                    </div>

                    <!-- 1. HUB SELECTION VIEW (Options not shown directly, choose first) -->
                    <div id="prof-pwd-hub-selection" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                        <!-- CHOICE 1: UPDATE PASSWORD -->
                        <div id="prof-card-opt-update" style="border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; background:var(--surface-50); cursor:pointer; transition:all 0.2s ease; display:flex; flex-direction:column; justify-content:space-between; gap:1rem;">
                            <div style="display:flex; align-items:flex-start; gap:0.85rem;">
                                <div style="width:42px; height:42px; border-radius:10px; background:rgba(24,24,27,0.08); display:flex; align-items:center; justify-content:center; color:var(--text-primary); flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>
                                <div>
                                    <strong style="display:block; font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">Update Password</strong>
                                    <span style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; display:block;">Change your password immediately using your current active password.</span>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end;">
                                <button type="button" class="btn btn-sm btn-primary" style="font-weight:700; pointer-events:none; border-radius:8px;">
                                    Update Password &rarr;
                                </button>
                            </div>
                        </div>

                        <!-- CHOICE 2: RESET PASSWORD (BY OTP) -->
                        <div id="prof-card-opt-reset" style="border:1.5px solid var(--border-color); border-radius:14px; padding:1.4rem; background:var(--surface-50); cursor:pointer; transition:all 0.2s ease; display:flex; flex-direction:column; justify-content:space-between; gap:1rem;">
                            <div style="display:flex; align-items:flex-start; gap:0.85rem;">
                                <div style="width:42px; height:42px; border-radius:10px; background:rgba(225,29,72,0.1); display:flex; align-items:center; justify-content:center; color:#e11d48; flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                                <div>
                                    <strong style="display:block; font-size:1.02rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">Reset Password</strong>
                                    <span style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; display:block;">Forgot your current password? Verify with a 6-digit OTP code sent to your email.</span>
                                </div>
                            </div>
                            <div style="display:flex; justify-content:flex-end;">
                                <button type="button" class="btn btn-sm btn-outline" style="font-weight:700; pointer-events:none; border-radius:8px; color:#e11d48; border-color:#e11d48;">
                                    Reset by OTP &rarr;
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 2. DEDICATED PANEL: UPDATE PASSWORD (USING CURRENT PASSWORD) -->
                    <div id="prof-panel-update-pwd" style="display:none;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary btn-prof-back-hub" style="font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                                &larr; Back to Options
                            </button>
                            <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Update Using Current Password</span>
                        </div>

                        <form id="prof-change-pwd-form" style="max-width:440px; display:flex; flex-direction:column; gap:1.1rem;">
                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Current Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-curr-pwd" required placeholder="Enter current password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-curr-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-new-pwd" required minlength="6" placeholder="At least 6 characters" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-new-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Confirm New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-conf-pwd" required minlength="6" placeholder="Repeat new password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-conf-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button type="submit" id="btn-prof-save-pwd" class="btn btn-primary" style="font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                                    <span>Update Password</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- 3. DEDICATED PANEL: RESET PASSWORD (BY EMAIL OTP) -->
                    <div id="prof-panel-reset-otp" style="display:none;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem;">
                            <button type="button" class="btn btn-sm btn-secondary btn-prof-back-hub" style="font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                                &larr; Back to Options
                            </button>
                            <span style="font-size:0.8rem; font-weight:700; color:#e11d48;">Reset by Email OTP</span>
                        </div>

                        <!-- Step 1: Send OTP -->
                        <div id="prof-otp-step-1" style="max-width:440px;">
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem; line-height:1.5;">
                                We'll send a 6-digit verification code to your registered email address <strong>${email}</strong>.
                            </p>
                            <button type="button" id="btn-prof-trigger-otp" class="btn btn-primary" style="font-weight:700; background:#e11d48; border-color:#e11d48;">
                                Send 6-Digit OTP Code &rarr;
                            </button>
                        </div>

                        <!-- Step 2: Verify OTP & Set New Password -->
                        <form id="prof-otp-step-2" style="display:none; max-width:440px; flex-direction:column; gap:1.1rem;">
                            <div style="background:rgba(225, 29, 72, 0.08); padding:0.85rem 1rem; border-radius:10px; font-size:0.82rem; color:#be123c;">
                                Verification code generated! <span id="prof-otp-hint" style="font-weight:700; display:block; margin-top:4px;"></span>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">6-Digit OTP Code</label>
                                <input type="text" id="prof-otp-code-input" placeholder="e.g. 548219" maxlength="6" required class="form-control" style="letter-spacing:0.2em; font-weight:800; font-size:1.1rem; text-align:center; height:42px;">
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-new-pwd" required minlength="6" placeholder="At least 6 characters" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-otp-new-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:var(--text-primary);">Confirm New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-conf-pwd" required minlength="6" placeholder="Repeat new password" class="form-control" style="width:100%; padding-right:2.5rem; height:42px;">
                                    <button type="button" class="prof-pwd-toggle" data-target="prof-otp-conf-pwd" style="position:absolute; right:0.75rem; background:none; border:none; color:var(--text-muted); cursor:pointer;">
                                        <svg class="eye-open" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <svg class="eye-closed" style="display:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button type="submit" id="btn-prof-verify-reset-pwd" class="btn btn-primary" style="font-weight:700; background:#e11d48; border-color:#e11d48;">
                                    Verify OTP & Reset Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            `}

            <!-- ======================================================== -->
            <!-- 3. ACCOUNT ACTIONS & QUICK LINKS                         -->
            <!-- ======================================================== -->
            <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                <h3 style="margin:0 0 1rem 0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">Quick Navigation</h3>
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/customer'">Customer Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/business'">Business Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/categories'">Manage Categories</button>
                    <button id="btn-profile-export-fast" class="btn btn-secondary">Export Data</button>
                </div>
            </div>
        `;

        // -------------------------------------------------------------
        // LIVE REALTIME FOOTPRINT CALCULATOR & 0 -> X NUMBER ANIMATOR
        // -------------------------------------------------------------
        const prevNumbers = new Map();
        const animateCount = (el, target, padZero = 0, duration = 800) => {
            if (!el) return;
            const targetVal = Number(target) || 0;
            const startVal = prevNumbers.has(el) ? prevNumbers.get(el) : 0;
            prevNumbers.set(el, targetVal);

            const startTime = performance.now();
            const update = (now) => {
                const progress = Math.min((now - startTime) / duration, 1);
                // Smooth cubic ease out
                const ease = 1 - Math.pow(1 - progress, 3);
                const cur = Math.round(startVal + (targetVal - startVal) * ease);
                el.textContent = padZero > 0 ? String(cur).padStart(padZero, '0') : cur.toLocaleString();
                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    el.textContent = padZero > 0 ? String(targetVal).padStart(padZero, '0') : targetVal.toLocaleString();
                }
            };
            requestAnimationFrame(update);
        };

        const updateLiveFootprint = () => {
            // 1. Live creations by matching creatorId
            const pCreated = liveProducts.filter(isUserItem).length;
            const invCreated = (liveCustInvoices.concat(liveBusInvoices)).filter(isUserItem).length;
            const catCreated = liveCategories.filter(isUserItem).length;
            const clientCreated = liveClients.filter(isUserItem).length;
            const busCreated = liveBusinesses.filter(isUserItem).length;
            
            // 2. Persistent Firestore counters from member / workspace doc
            const storedP = Number(isAdmin ? docMetrics?.adminProductCount : docMetrics?.productAdded) || 0;
            const storedInv = Number(isAdmin ? docMetrics?.adminInvoiceCount : docMetrics?.invoiceAdded) || 0;
            const storedCat = Number(isAdmin ? docMetrics?.adminCategoryCount : docMetrics?.categoryAdded) || 0;
            const storedClient = Number(isAdmin ? docMetrics?.adminClientCount : docMetrics?.clientAdded) || 0;
            const storedBus = Number(isAdmin ? docMetrics?.adminBusinessCount : docMetrics?.businessAdded) || 0;
            const storedDel = Number(isAdmin ? (docMetrics?.adminTotalDeleted ?? docMetrics?.adminTotalDeletedCount) : docMetrics?.totalDeleted) || 0;

            const finalP = Math.max(pCreated, storedP);
            const finalInv = Math.max(invCreated, storedInv);
            const finalCat = Math.max(catCreated, storedCat);
            const finalClient = Math.max(clientCreated, storedClient);
            const finalBus = Math.max(busCreated, storedBus);
            const finalDel = storedDel;

            // Update DOM counters with 0 -> X animation
            animateCount(container.querySelector('#prof-metric-products'), finalP);
            animateCount(container.querySelector('#prof-metric-invoices'), finalInv);
            animateCount(container.querySelector('#prof-metric-categories'), finalCat);
            animateCount(container.querySelector('#prof-metric-clients'), finalClient);
            animateCount(container.querySelector('#prof-metric-businesses'), finalBus);
            animateCount(container.querySelector('#prof-metric-deletions'), finalDel, 2);

            // Update overview summary cards with 0 -> X animation
            animateCount(container.querySelector('#prof-overview-products'), liveProducts.length);
            animateCount(container.querySelector('#prof-overview-invoices'), liveCustInvoices.length + liveBusInvoices.length);
            animateCount(container.querySelector('#prof-overview-businesses'), liveBusinesses.length);
            animateCount(container.querySelector('#prof-overview-customers'), liveCustomers.length + liveClients.length);
        };

        // -------------------------------------------------------------
        // SETUP REALTIME LISTENERS (Products, Invoices, People, Deletions)
        // -------------------------------------------------------------
        const unsubs = [];

        // 1. Listen to Products
        try {
            const unsubProd = productService.listenProducts((allProds) => {
                liveProducts = allProds || [];
                updateLiveFootprint();
            });
            if (typeof unsubProd === 'function') unsubs.push(unsubProd);
        } catch (e) {
            console.warn("Product listener error:", e);
        }

        // 2. Listen to Customer Invoices
        try {
            const unsubCustInv = invoiceService.listenInvoices(false, (invs) => {
                liveCustInvoices = invs || [];
                updateLiveFootprint();
            });
            if (typeof unsubCustInv === 'function') unsubs.push(unsubCustInv);
        } catch (e) {
            console.warn("Cust Invoice listener error:", e);
        }

        // 3. Listen to Business Invoices
        try {
            const unsubBusInv = invoiceService.listenInvoices(true, (invs) => {
                liveBusInvoices = invs || [];
                updateLiveFootprint();
            });
            if (typeof unsubBusInv === 'function') unsubs.push(unsubBusInv);
        } catch (e) {
            console.warn("Bus Invoice listener error:", e);
        }

        // 4. Listen to Categories
        try {
            const unsubCat = categoryService.listenCategories((cats) => {
                liveCategories = cats || [];
                updateLiveFootprint();
            });
            if (typeof unsubCat === 'function') unsubs.push(unsubCat);
        } catch (e) {
            console.warn("Category listener error:", e);
        }

        // 5. Listen to Peoples (Customers, Businesses, Clients)
        try {
            const unsubCust = peopleService.listenCustomers((custs) => {
                liveCustomers = custs || [];
                updateLiveFootprint();
            });
            if (typeof unsubCust === 'function') unsubs.push(unsubCust);
        } catch (e) {
            console.warn("Customer listener error:", e);
        }

        try {
            const unsubBus = peopleService.listenBusinesses((buses) => {
                liveBusinesses = buses || [];
                updateLiveFootprint();
            });
            if (typeof unsubBus === 'function') unsubs.push(unsubBus);
        } catch (e) {
            console.warn("Business listener error:", e);
        }

        try {
            const unsubClients = peopleService.listenClients((cls) => {
                liveClients = cls || [];
                updateLiveFootprint();
            });
            if (typeof unsubClients === 'function') unsubs.push(unsubClients);
        } catch (e) {
            console.warn("Client listener error:", e);
        }

        // 6. Listen to Member / Workspace Doc for Metrics Counters (Additions & Deletions)
        try {
            const unsubMetrics = firestoreService.listenMemberMetrics(adminUid, email, (data) => {
                if (data) {
                    docMetrics = data;
                    updateLiveFootprint();
                }
            });
            if (typeof unsubMetrics === 'function') unsubs.push(unsubMetrics);
        } catch (e) {
            console.warn("Metrics listener error:", e);
        }

        // Store active unsubscriptions on the container
        container._profileUnsubs = unsubs;

        // Run initial live calculation
        updateLiveFootprint();

        // -------------------------------------------------------------
        // STATIC BUTTON EVENT LISTENERS
        // -------------------------------------------------------------
        container.querySelector('#btn-profile-switch-acc')?.addEventListener('click', () => {
            openAccountSwitcherModal(currentUser);
        });

        if (canAccessSettings) {
            container.querySelector('#btn-profile-settings')?.addEventListener('click', () => {
                window.location.hash = '#/settings';
            });
        }

        container.querySelector('#btn-profile-export-fast')?.addEventListener('click', () => {
            openExportModal(workspaceId, { 
                products: liveProducts, 
                categories: liveCategories, 
                invoices: [...liveCustInvoices, ...liveBusInvoices], 
                workspaceInfo: wsData 
            });
        });

        container.querySelector('#btn-profile-leave-ws')?.addEventListener('click', async () => {
            if (await showAlert.confirm('Are you sure you want to leave this workspace? You will lose access until invited again.')) {
                try {
                    
                    try {
                        await userDataSafetyService.recordWorkspaceConnection(currentUser, workspaceId, wsData?.role || 'Worker', 'leave');
                    } catch (e) {}
                    await firestoreService.leaveWorkspace(workspaceId, currentUser);
                    showAlert.success("You have left the workspace.");
                    window.location.href = 'index.html';
                } catch (err) {
                    showAlert.error("Failed to leave workspace: " + (err.message || 'Unknown error'));
                }
            }
        });

        container.querySelector('#btn-profile-logout')?.addEventListener('click', async () => {
            if (await showAlert.confirm('Are you sure you want to sign out?')) {
                await authService.logout();
                window.location.href = 'index.html';
            }
        });

        // -------------------------------------------------------------
        // IN-APP PASSWORD MANAGEMENT (TWO DEDICATED PANELS)
        // -------------------------------------------------------------
        const hubView = container.querySelector('#prof-pwd-hub-selection');
        const updatePanel = container.querySelector('#prof-panel-update-pwd');
        const resetPanel = container.querySelector('#prof-panel-reset-otp');

        // Navigation between choice hub and dedicated panels
        container.querySelector('#prof-card-opt-update')?.addEventListener('click', () => {
            if (hubView) hubView.style.display = 'none';
            if (updatePanel) updatePanel.style.display = 'block';
            if (resetPanel) resetPanel.style.display = 'none';
        });

        container.querySelector('#prof-card-opt-reset')?.addEventListener('click', () => {
            if (hubView) hubView.style.display = 'none';
            if (updatePanel) updatePanel.style.display = 'none';
            if (resetPanel) {
                resetPanel.style.display = 'block';
                const s1 = container.querySelector('#prof-otp-step-1');
                const s2 = container.querySelector('#prof-otp-step-2');
                if (s1) s1.style.display = 'block';
                if (s2) s2.style.display = 'none';
            }
        });

        container.querySelectorAll('.btn-prof-back-hub').forEach(btn => {
            btn.addEventListener('click', () => {
                if (hubView) hubView.style.display = 'grid';
                if (updatePanel) updatePanel.style.display = 'none';
                if (resetPanel) resetPanel.style.display = 'none';
            });
        });

        // Password visibility eye toggles
        container.querySelectorAll('.prof-pwd-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = container.querySelector('#' + targetId);
                const eyeOpen = btn.querySelector('.eye-open');
                const eyeClosed = btn.querySelector('.eye-closed');
                if (input) {
                    if (input.type === 'password') {
                        input.type = 'text';
                        if (eyeOpen) eyeOpen.style.display = 'none';
                        if (eyeClosed) eyeClosed.style.display = 'block';
                    } else {
                        input.type = 'password';
                        if (eyeOpen) eyeOpen.style.display = 'block';
                        if (eyeClosed) eyeClosed.style.display = 'none';
                    }
                }
            });
        });

        // 1. Submit Handler: Update Password (Using Current Password)
        const pwdForm = container.querySelector('#prof-change-pwd-form');
        if (pwdForm) {
            pwdForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const currPwd = container.querySelector('#prof-curr-pwd')?.value || '';
                const newPwd = container.querySelector('#prof-new-pwd')?.value || '';
                const confPwd = container.querySelector('#prof-conf-pwd')?.value || '';
                const submitBtn = container.querySelector('#btn-prof-save-pwd');

                if (newPwd !== confPwd) {
                    showAlert.error('New passwords do not match. Please verify.');
                    return;
                }
                if (newPwd.length < 6) {
                    showAlert.error('New password must be at least 6 characters.');
                    return;
                }

                try {
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<span>Updating Password...</span>';
                    }
                    await authService.changePasswordInSettings(currPwd, newPwd);
                    showAlert.success('Password updated successfully!');
                    pwdForm.reset();
                    // Return back to hub
                    if (hubView) hubView.style.display = 'grid';
                    if (updatePanel) updatePanel.style.display = 'none';
                } catch (err) {
                    console.error("Password change error:", err);
                    showAlert.error(err.message || 'Failed to update password.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>Update Password</span>';
                    }
                }
            });
        }

        // 2. Step 1: Send OTP for Reset
        const btnTriggerOtp = container.querySelector('#btn-prof-trigger-otp');
        const otpStep1 = container.querySelector('#prof-otp-step-1');
        const otpStep2 = container.querySelector('#prof-otp-step-2');
        const otpStep3 = container.querySelector('#prof-otp-step-3');
        const otpHint = container.querySelector('#prof-otp-hint');
        const btnVerifyOtpOnly = container.querySelector('#btn-prof-verify-otp-only');
        let verifiedOtpCode = '';

        btnTriggerOtp?.addEventListener('click', async () => {
            try {
                btnTriggerOtp.disabled = true;
                btnTriggerOtp.textContent = 'Sending OTP...';
                const res = await authService.sendPasswordResetOTP(email);
                showAlert.success('6-digit OTP code sent to ' + email);
                if (otpHint) otpHint.textContent = 'Verification OTP: ' + res.code;
                if (otpStep1) otpStep1.style.display = 'none';
                if (otpStep2) otpStep2.style.display = 'flex';
                if (otpStep3) otpStep3.style.display = 'none';
            } catch (err) {
                showAlert.error(err.message || 'Failed to generate OTP.');
            } finally {
                btnTriggerOtp.disabled = false;
                btnTriggerOtp.textContent = 'Send 6-Digit OTP Code \u2192';
            }
        });

        // 3. Modern 6-Block OTP Input UX in Profile
        const profDigitBoxes = Array.from(container.querySelectorAll('.prof-digit-box'));
        const getProfOtpValue = () => profDigitBoxes.map(b => b.value.trim()).join('');

        // Restore remembered custom font from Critical Board
        try {
            const savedFontData = localStorage.getItem('pricelister_custom_font');
            if (savedFontData) {
                const parsed = JSON.parse(savedFontData);
                if (parsed?.name) {
                    container.style.setProperty('--custom-user-font', `'${parsed.name}', 'Outfit', sans-serif`);
                }
            }
        } catch(e) {}

        profDigitBoxes.forEach((box, idx) => {
            box.addEventListener('input', (e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                e.target.value = val ? val[0] : '';
                if (e.target.value) {
                    box.style.borderColor = 'var(--text-primary)';
                    box.style.background = 'var(--surface-main, #ffffff)';
                    box.style.transform = 'scale(1.15)';
                    setTimeout(() => { box.style.transform = 'scale(1)'; }, 140);
                    if (idx < 5) profDigitBoxes[idx + 1].focus();
                } else {
                    box.style.borderColor = 'var(--border-color)';
                    box.style.transform = 'scale(1)';
                }
            });

            box.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !box.value && idx > 0) {
                    profDigitBoxes[idx - 1].focus();
                    profDigitBoxes[idx - 1].value = '';
                    profDigitBoxes[idx - 1].style.borderColor = 'var(--border-color)';
                }
            });

            box.addEventListener('paste', (e) => {
                e.preventDefault();
                const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                if (pasteData) {
                    pasteData.slice(0, 6).split('').forEach((digit, i) => {
                        if (profDigitBoxes[i]) {
                            profDigitBoxes[i].value = digit;
                            profDigitBoxes[i].style.borderColor = 'var(--text-primary)';
                        }
                    });
                    const nextFocus = Math.min(pasteData.length, 5);
                    profDigitBoxes[nextFocus].focus();
                }
            });
        });

        // Step 2: Verify OTP FIRST to unlock password form
        btnVerifyOtpOnly?.addEventListener('click', async () => {
            const otpCode = getProfOtpValue();
            if (!otpCode || otpCode.length !== 6) {
                showAlert.error('Please enter the full 6-digit OTP code.');
                return;
            }

            try {
                btnVerifyOtpOnly.disabled = true;
                btnVerifyOtpOnly.textContent = 'Verifying OTP...';
                await authService.verifyOTPCode(email, otpCode);
                verifiedOtpCode = otpCode;
                showAlert.success('OTP verified! Reset password unlocked.');
                if (otpStep2) otpStep2.style.display = 'none';
                if (otpStep3) otpStep3.style.display = 'flex';
            } catch (err) {
                showAlert.error(err.message || 'Invalid or expired OTP code.');
            } finally {
                btnVerifyOtpOnly.disabled = false;
                btnVerifyOtpOnly.textContent = 'Verify OTP Code to Unlock \u2192';
            }
        });

        // 4. Step 3: Save Unlocked Password
        if (otpStep3) {
            otpStep3.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newPwd = container.querySelector('#prof-otp-new-pwd')?.value || '';
                const confPwd = container.querySelector('#prof-otp-conf-pwd')?.value || '';
                const submitBtn = container.querySelector('#btn-prof-save-unlocked-pwd');

                if (newPwd !== confPwd) {
                    showAlert.error('New passwords do not match. Please verify.');
                    return;
                }
                if (newPwd.length < 6) {
                    showAlert.error('New password must be at least 6 characters.');
                    return;
                }

                try {
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving New Password...';
                    }
                    await authService.verifyOTPAndResetPassword(email, verifiedOtpCode, newPwd);
                    showAlert.success('Password successfully reset with OTP!');
                    otpStep3.reset();
                    // Return back to hub
                    if (hubView) hubView.style.display = 'grid';
                    if (resetPanel) resetPanel.style.display = 'none';
                } catch (err) {
                    console.error("OTP Reset error:", err);
                    showAlert.error(err.message || 'Failed to reset password.');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Confirm & Update Password';
                    }
                }
            });
        }

    } catch (err) {
        console.error("renderProfile error:", err);
        container.innerHTML = `
            <div class="card" style="padding:2rem; text-align:center; color:var(--danger);">
                Failed to load profile details. Please try refreshing the page.
            </div>
        `;
    }
};