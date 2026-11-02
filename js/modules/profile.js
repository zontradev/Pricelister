import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { userDataSafetyService } from '../services/userDataSafetyService.js';
import { getProductService } from '../services/productService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getSettingsService } from '../services/settingsService.js';
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

        // Resolve authenticated provider for credentials & password management
        const storedAuthType = localStorage.getItem('pricelister_auth_type');
        const isGoogleUser = (currentUser.providerData && currentUser.providerData.some(p => p.providerId === 'google.com')) || storedAuthType === 'Google';
        const isEmailPwdUser = storedAuthType === 'Email & Password' || currentUser.authType === 'Email & Password' || (!isGoogleUser && Boolean(currentUser.email));
        const authProviderLabel = isGoogleUser ? 'Google Authentication' : (isEmailPwdUser ? 'Email & Password' : 'Demo Sandbox');
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
                                <span style="color:var(--text-primary); font-weight:700;">${authProviderLabel}</span>
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
            
            <!-- ======================================================== -->
            <!-- SECURITY & PASSWORD MANAGEMENT (EMAIL / PASSWORD ONLY)   -->
            <!-- ======================================================== -->
            ${isEmailPwdUser ? `
            <div class="card" id="card-security-reset-password" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); margin-bottom: 2rem; border: 1.5px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="font-size:0.75rem; font-weight:800; color:#18181B; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.25rem;">
                            ACCOUNT CREDENTIALS & SECURITY
                        </div>
                        <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            Password & Access Security
                        </h3>
                    </div>
                    <span class="badge" style="background:rgba(225,29,72,0.1); color:#18181B; font-weight:800; font-size:0.76rem; padding:4px 10px; border-radius:9999px;">
                        Email / Password Auth
                    </span>
                </div>

                <!-- VIEW 1: CHOOSE PASSWORD OPTION (Default View - Options NOT shown directly) -->
                <div id="prof-pwd-view-select" style="display:block;">
                    <p style="font-size:0.88rem; color:var(--text-secondary); margin-bottom:1.25rem; line-height:1.5;">
                        Choose an option below to manage your password:
                    </p>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                        <!-- Option 1: Reset Password via OTP -->
                        <div style="background:var(--surface-50); border:1.5px solid var(--border-color); border-radius:14px; padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; transition:all 0.18s ease;">
                            <div>
                                <div style="display:flex; align-items:center; gap:0.65rem; margin-bottom:0.5rem;">
                                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(225,29,72,0.12); color:#18181B; display:flex; align-items:center; justify-content:center;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    </div>
                                    <div>
                                        <strong style="font-size:0.95rem; color:var(--text-primary); display:block;">1. Reset Password</strong>
                                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Via 6-digit email OTP verification</span>
                                    </div>
                                </div>
                                <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; margin:0;">
                                    Generates a secure 6-digit one-time code sent to your email. OTP verification is required first before unlocking password reset inputs.
                                </p>
                            </div>
                            <button type="button" id="prof-btn-choose-otp" class="btn" style="background:#18181B; color:#ffffff; font-weight:700; border-radius:9px; padding:0.6rem 1rem; border:none; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <span>Reset via OTP</span> &rarr;
                            </button>
                        </div>

                        <!-- Option 2: Update Password using Current Password -->
                        <div style="background:var(--surface-50); border:1.5px solid var(--border-color); border-radius:14px; padding:1.35rem; display:flex; flex-direction:column; justify-content:space-between; gap:1rem; transition:all 0.18s ease;">
                            <div>
                                <div style="display:flex; align-items:center; gap:0.65rem; margin-bottom:0.5rem;">
                                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(15,23,42,0.08); color:var(--text-primary); display:flex; align-items:center; justify-content:center;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    </div>
                                    <div>
                                        <strong style="font-size:0.95rem; color:var(--text-primary); display:block;">2. Update Password</strong>
                                        <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Using your existing current password</span>
                                    </div>
                                </div>
                                <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.45; margin:0;">
                                    Directly verify your current active password to set a new password without needing an email verification code.
                                </p>
                            </div>
                            <button type="button" id="prof-btn-choose-current" class="btn" style="background:var(--surface-100); color:var(--text-primary); border:1.5px solid var(--border-color); font-weight:700; border-radius:9px; padding:0.6rem 1rem; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <span>Update via Current Password</span> &rarr;
                            </button>
                        </div>
                    </div>
                </div>

                <!-- VIEW 2: DEDICATED PANEL: RESET PASSWORD BY OTP -->
                <div id="prof-pwd-view-otp" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Reset Password by OTP Verification</h4>
                        <button type="button" id="prof-otp-back-btn" class="btn btn-secondary btn-sm" style="font-size:0.78rem;">Back to Options</button>
                    </div>

                    <!-- Step 1: Send OTP -->
                    <div id="prof-otp-step-send">
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">
                            Click below to generate a 6-digit verification code to <strong>${email}</strong>.
                        </p>
                        <button type="button" id="prof-btn-send-otp" class="btn" style="background:#18181B; color:#ffffff; font-weight:700; border-radius:9px; padding:0.65rem 1.25rem; border:none; cursor:pointer; font-size:0.88rem;">
                            Send 6-Digit OTP to ${email} &rarr;
                        </button>
                    </div>

                    <!-- Step 2: 6 Blocks OTP Input -->
                    <div id="prof-otp-step-boxes" style="display:none; margin-top:1rem;">
                        <div style="background:rgba(225,29,72,0.08); padding:0.75rem 1rem; border-radius:10px; margin-bottom:1.25rem; font-size:0.84rem; color:#27272A;">
                            Verification code sent to <strong>${email}</strong>. <span id="prof-otp-hint" style="font-weight:700; display:block; margin-top:4px;"></span>
                        </div>

                        <div style="margin-bottom:1.25rem;">
                            <label style="display:block; font-size:0.82rem; font-weight:700; color:var(--text-primary); margin-bottom:0.6rem;">
                                Enter 6-Digit OTP Code
                            </label>
                            <div class="otp-blocks-row" id="prof-otp-blocks-row" style="display:flex; gap:0.65rem; justify-content:flex-start; max-width:380px;">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="0" autocomplete="off">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="1" autocomplete="off">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="2" autocomplete="off">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="3" autocomplete="off">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="4" autocomplete="off">
                                <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="prof-otp-digit" data-idx="5" autocomplete="off">
                            </div>
                        </div>

                        <button type="button" id="prof-btn-verify-otp-first" class="btn" style="background:#0f172a; color:#ffffff; font-weight:700; border-radius:9px; padding:0.65rem 1.25rem; border:none; cursor:pointer; font-size:0.88rem;">
                            Verify OTP to Unlock Password Reset &rarr;
                        </button>
                    </div>

                    <!-- Step 3: Unlocked Password Fields -->
                    <div id="prof-otp-step-unlocked" style="display:none; margin-top:1.25rem;">
                        <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); padding:0.85rem 1rem; border-radius:10px; margin-bottom:1.25rem; font-size:0.84rem; color:#059669; font-weight:700; display:flex; align-items:center; gap:0.5rem;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>Identity Verified via OTP! Reset password unlocked.</span>
                        </div>

                        <form id="prof-form-otp-new-pwd" style="display:flex; flex-direction:column; gap:0.85rem; max-width:440px;">
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-new-pwd" placeholder="Enter at least 6 characters" required style="width:100%; height:42px; border:1.5px solid var(--border-color); border-radius:9px; padding:0 2.5rem 0 0.85rem; background:var(--surface-50); color:var(--text-primary); font-size:0.9rem;">
                                    <button type="button" class="prof-pwd-eye-toggle" data-target="prof-otp-new-pwd" style="position:absolute; right:8px; background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Confirm New Password</label>
                                <div style="position:relative; display:flex; align-items:center;">
                                    <input type="password" id="prof-otp-confirm-pwd" placeholder="Confirm new password" required style="width:100%; height:42px; border:1.5px solid var(--border-color); border-radius:9px; padding:0 2.5rem 0 0.85rem; background:var(--surface-50); color:var(--text-primary); font-size:0.9rem;">
                                    <button type="button" class="prof-pwd-eye-toggle" data-target="prof-otp-confirm-pwd" style="position:absolute; right:8px; background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                </div>
                            </div>

                            <button type="submit" id="prof-btn-save-otp-pwd" class="btn" style="background:#059669; color:#ffffff; font-weight:700; border-radius:9px; padding:0.7rem 1.25rem; border:none; cursor:pointer; font-size:0.9rem; margin-top:0.4rem;">
                                Save & Apply New Password &rarr;
                            </button>
                        </form>
                    </div>
                </div>

                <!-- VIEW 3: DEDICATED PANEL: UPDATE PASSWORD USING CURRENT PASSWORD -->
                <div id="prof-pwd-view-current" style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem;">
                        <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">Update Password via Current Password</h4>
                        <button type="button" id="prof-current-back-btn" class="btn btn-secondary btn-sm" style="font-size:0.78rem;">Back to Options</button>
                    </div>

                    <form id="prof-form-update-current-pwd" style="display:flex; flex-direction:column; gap:0.85rem; max-width:440px;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Current Password</label>
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="password" id="prof-cur-old-pwd" placeholder="Enter current active password" required style="width:100%; height:42px; border:1.5px solid var(--border-color); border-radius:9px; padding:0 2.5rem 0 0.85rem; background:var(--surface-50); color:var(--text-primary); font-size:0.9rem;">
                                <button type="button" class="prof-pwd-eye-toggle" data-target="prof-cur-old-pwd" style="position:absolute; right:8px; background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">New Password</label>
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="password" id="prof-cur-new-pwd" placeholder="Enter at least 6 characters" required style="width:100%; height:42px; border:1.5px solid var(--border-color); border-radius:9px; padding:0 2.5rem 0 0.85rem; background:var(--surface-50); color:var(--text-primary); font-size:0.9rem;">
                                <button type="button" class="prof-pwd-eye-toggle" data-target="prof-cur-new-pwd" style="position:absolute; right:8px; background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.35rem;">Confirm New Password</label>
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="password" id="prof-cur-confirm-pwd" placeholder="Confirm new password" required style="width:100%; height:42px; border:1.5px solid var(--border-color); border-radius:9px; padding:0 2.5rem 0 0.85rem; background:var(--surface-50); color:var(--text-primary); font-size:0.9rem;">
                                <button type="button" class="prof-pwd-eye-toggle" data-target="prof-cur-confirm-pwd" style="position:absolute; right:8px; background:none; border:none; color:var(--text-secondary); cursor:pointer; padding:4px;">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                        </div>

                        <button type="submit" id="prof-btn-save-cur-pwd" class="btn" style="background:#0f172a; color:#ffffff; font-weight:700; border-radius:9px; padding:0.7rem 1.25rem; border:none; cursor:pointer; font-size:0.9rem; margin-top:0.4rem;">
                            Verify & Update Password &rarr;
                        </button>
                    </form>
                </div>
            </div>
            ` : ''}

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
        // -------------------------------------------------------------
        // SECURITY & PASSWORD MANAGEMENT HANDLERS (DEDICATED PANELS)
        // -------------------------------------------------------------
        if (isEmailPwdUser) {
            const viewSelect = container.querySelector('#prof-pwd-view-select');
            const viewOtp = container.querySelector('#prof-pwd-view-otp');
            const viewCurrent = container.querySelector('#prof-pwd-view-current');

            const btnChooseOtp = container.querySelector('#prof-btn-choose-otp');
            const btnChooseCurrent = container.querySelector('#prof-btn-choose-current');
            const btnOtpBack = container.querySelector('#prof-otp-back-btn');
            const btnCurrentBack = container.querySelector('#prof-current-back-btn');

            const btnSendOtp = container.querySelector('#prof-btn-send-otp');
            const stepOtpSend = container.querySelector('#prof-otp-step-send');
            const stepOtpBoxes = container.querySelector('#prof-otp-step-boxes');
            const stepOtpUnlocked = container.querySelector('#prof-otp-step-unlocked');
            const btnVerifyOtpFirst = container.querySelector('#prof-btn-verify-otp-first');
            const formOtpNewPwd = container.querySelector('#prof-form-otp-new-pwd');
            const formUpdateCurrentPwd = container.querySelector('#prof-form-update-current-pwd');

            let profVerifiedOtp = '';

            // Switch to Dedicated OTP Panel
            if (btnChooseOtp) {
                btnChooseOtp.addEventListener('click', () => {
                    if (viewSelect) viewSelect.style.display = 'none';
                    if (viewOtp) viewOtp.style.display = 'block';
                    if (viewCurrent) viewCurrent.style.display = 'none';
                });
            }

            // Switch to Dedicated Current Password Panel
            if (btnChooseCurrent) {
                btnChooseCurrent.addEventListener('click', () => {
                    if (viewSelect) viewSelect.style.display = 'none';
                    if (viewOtp) viewOtp.style.display = 'none';
                    if (viewCurrent) viewCurrent.style.display = 'block';
                });
            }

            // Back to Options Selection View
            const backToSelect = () => {
                if (viewSelect) viewSelect.style.display = 'block';
                if (viewOtp) viewOtp.style.display = 'none';
                if (viewCurrent) viewCurrent.style.display = 'none';
            };
            if (btnOtpBack) btnOtpBack.addEventListener('click', backToSelect);
            if (btnCurrentBack) btnCurrentBack.addEventListener('click', backToSelect);

            // Step 1: Send OTP Code
            if (btnSendOtp) {
                btnSendOtp.addEventListener('click', async () => {
                    try {
                        btnSendOtp.disabled = true;
                        btnSendOtp.textContent = 'Generating OTP...';
                        const res = await authService.sendPasswordResetOTP(email);
                        showAlert.success('Verification code generated!');
                        if (stepOtpSend) stepOtpSend.style.display = 'none';
                        if (stepOtpBoxes) stepOtpBoxes.style.display = 'block';
                        const hintEl = container.querySelector('#prof-otp-hint');
                        if (hintEl) hintEl.textContent = 'Your OTP Code: ' + res.code;
                        const firstBox = container.querySelector('.prof-otp-digit');
                        if (firstBox) firstBox.focus();
                    } catch (err) {
                        showAlert.error(err.message || 'Could not send OTP.');
                        btnSendOtp.disabled = false;
                        btnSendOtp.textContent = 'Send 6-Digit OTP to ' + email + ' \u2192';
                    }
                });
            }

            // Step 2: 6-Block OTP Input Handling
            const otpDigits = Array.from(container.querySelectorAll('.prof-otp-digit'));
            otpDigits.forEach((box, idx) => {
                box.addEventListener('input', (e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    e.target.value = val ? val[val.length - 1] : '';
                    if (val) {
                        e.target.classList.add('pop');
                        setTimeout(() => e.target.classList.remove('pop'), 250);
                        if (idx < otpDigits.length - 1) otpDigits[idx + 1].focus();
                    }
                });

                box.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !box.value && idx > 0) {
                        otpDigits[idx - 1].focus();
                    }
                });

                box.addEventListener('paste', (e) => {
                    e.preventDefault();
                    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
                    if (text) {
                        for (let i = 0; i < otpDigits.length; i++) {
                            if (i < text.length) otpDigits[i].value = text[i];
                        }
                        const nextIdx = Math.min(text.length, otpDigits.length - 1);
                        otpDigits[nextIdx].focus();
                    }
                });
            });

            // Step 3: Verify OTP to Unlock Password Reset
            if (btnVerifyOtpFirst) {
                btnVerifyOtpFirst.addEventListener('click', async () => {
                    const otpCode = otpDigits.map(d => d.value.trim()).join('');
                    if (!otpCode || otpCode.length !== 6) {
                        showAlert.error('Please enter the full 6-digit OTP code.');
                        return;
                    }
                    try {
                        btnVerifyOtpFirst.disabled = true;
                        btnVerifyOtpFirst.textContent = 'Verifying OTP...';
                        await authService.verifyOTPCode(email, otpCode);
                        profVerifiedOtp = otpCode;
                        showAlert.success('OTP verified! Reset password unlocked.');
                        if (stepOtpBoxes) stepOtpBoxes.style.display = 'none';
                        if (stepOtpUnlocked) stepOtpUnlocked.style.display = 'block';
                    } catch (err) {
                        showAlert.error(err.message || 'Invalid or expired OTP code.');
                        btnVerifyOtpFirst.disabled = false;
                        btnVerifyOtpFirst.textContent = 'Verify OTP to Unlock Password Reset \u2192';
                    }
                });
            }

            // Step 4: Submit New Password via OTP
            if (formOtpNewPwd) {
                formOtpNewPwd.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const newPwd = container.querySelector('#prof-otp-new-pwd')?.value;
                    const confirmPwd = container.querySelector('#prof-otp-confirm-pwd')?.value;
                    const saveBtn = container.querySelector('#prof-btn-save-otp-pwd');

                    if (newPwd !== confirmPwd) {
                        showAlert.error('New passwords do not match.');
                        return;
                    }
                    if (newPwd.length < 6) {
                        showAlert.error('New password must be at least 6 characters.');
                        return;
                    }

                    try {
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.textContent = 'Updating password...';
                        }
                        await authService.verifyOTPAndResetPassword(email, profVerifiedOtp, newPwd);
                        showAlert.success('Password successfully reset & saved!');
                        backToSelect();
                    } catch (err) {
                        showAlert.error(err.message || 'Failed to update password.');
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Save & Apply New Password \u2192';
                        }
                    }
                });
            }

            // Submit Password Update via Current Password
            if (formUpdateCurrentPwd) {
                formUpdateCurrentPwd.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const curPwd = container.querySelector('#prof-cur-old-pwd')?.value;
                    const newPwd = container.querySelector('#prof-cur-new-pwd')?.value;
                    const confirmPwd = container.querySelector('#prof-cur-confirm-pwd')?.value;
                    const saveBtn = container.querySelector('#prof-btn-save-cur-pwd');

                    if (newPwd !== confirmPwd) {
                        showAlert.error('New passwords do not match.');
                        return;
                    }
                    if (newPwd.length < 6) {
                        showAlert.error('New password must be at least 6 characters.');
                        return;
                    }

                    try {
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.textContent = 'Verifying & updating...';
                        }
                        await authService.updatePasswordWithCurrent(email, curPwd, newPwd);
                        showAlert.success('Password successfully updated!');
                        formUpdateCurrentPwd.reset();
                        backToSelect();
                    } catch (err) {
                        showAlert.error(err.message || 'Password update failed.');
                        if (saveBtn) {
                            saveBtn.disabled = false;
                            saveBtn.textContent = 'Verify & Update Password \u2192';
                        }
                    }
                });
            }

            // Eye hide/unhide toggles in profile
            container.querySelectorAll('.prof-pwd-eye-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    const targetId = btn.getAttribute('data-target');
                    const targetInput = container.querySelector('#' + targetId);
                    if (!targetInput) return;
                    if (targetInput.type === 'password') {
                        targetInput.type = 'text';
                        btn.style.opacity = '1';
                    } else {
                        targetInput.type = 'password';
                        btn.style.opacity = '0.6';
                    }
                });
            });
        }

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

    } catch (err) {
        console.error("renderProfile error:", err);
        container.innerHTML = `
            <div class="card" style="padding:2rem; text-align:center; color:var(--danger);">
                Failed to load profile details. Please try refreshing the page.
            </div>
        `;
    }
};
