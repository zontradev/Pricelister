import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getProductService } from '../services/productService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getSettingsService } from '../services/settingsService.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml, openAccountSwitcherModal } from '../auth-handler.js';
import { openExportModal } from './importExportModal.js';

export const renderProfile = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">Please log in to view your profile.</div>`;
        return;
    }

    const productService = getProductService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
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
        // Fetch workspace details and stats in parallel for fast loading
        const [wsData, products, custInvoices, busInvoices, businesses, customers, isVending] = await Promise.all([
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null),
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => []),
            peopleService.getAllBusinesses().catch(() => []),
            peopleService.getAllCustomers().catch(() => []),
            settingsService.isVendingEnabled().catch(() => false)
        ]);

        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        const email = currentUser.email;
        const photoURL = currentUser.photoURL;
        const role = wsData?.role || (wsData?.id === currentUser.uid ? 'CREATOR_ADMIN' : 'WORKER');
        const workspaceName = wsData?.name || wsData?.businessName || 'My Workspace';
        const totalInvoices = custInvoices.length + busInvoices.length;
        const initial = displayName.charAt(0).toUpperCase();

        const isAdmin = role === 'CREATOR_ADMIN' || role === 'ADMIN' || role === 'CREATOR' || wsData?.id === currentUser.uid;
        const isCoAdmin = role === 'CO_ADMIN' || role === 'CO-ADMIN';
        const canAccessSettings = isAdmin || isCoAdmin;

        // Fetch member specifics if Worker/Co-Admin
        let myMember = null;
        if (!isAdmin) {
            try {
                const adminUid = wsData?.id || workspaceId;
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

        // 3. Calculate Personal Contributions & Deletions
        let productCount = 0;
        let invoiceCount = 0;
        let categoryCount = 0;
        let clientCount = 0;
        let businessCount = 0;
        let totalDeleted = 0;
        let joinedTimestamp = Date.now();

        if (isAdmin && wsData) {
            productCount = Number(wsData.adminProductCount ?? products.length);
            invoiceCount = Number(wsData.adminInvoiceCount ?? totalInvoices);
            categoryCount = Number(wsData.adminCategoryCount ?? 0);
            clientCount = Number(wsData.adminClientCount ?? businesses.length);
            businessCount = Number(wsData.adminBusinessCount ?? businesses.length);
            totalDeleted = Number(wsData.adminTotalDeleted ?? wsData.adminTotalDeletedCount ?? 0);
            joinedTimestamp = wsData.createdAt;
        } else if (myMember) {
            productCount = Number(myMember.productAdded ?? 0);
            invoiceCount = Number(myMember.invoiceAdded ?? 0);
            categoryCount = Number(myMember.categoryAdded ?? 0);
            clientCount = Number(myMember.clientAdded ?? 0);
            businessCount = Number(myMember.businessAdded ?? 0);
            totalDeleted = Number(myMember.totalDeleted ?? 0);
            joinedTimestamp = myMember.joinedAt || myMember.timestamp || Date.now();
        }

        const joinedDateFormatted = (() => {
            if (!joinedTimestamp) return 'N/A';
            const d = typeof joinedTimestamp === 'number' 
                ? new Date(joinedTimestamp) 
                : (joinedTimestamp.toDate ? joinedTimestamp.toDate() : new Date());
            return isNaN(d.getTime()) ? 'Active Member' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        })();

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
                                <span style="color:var(--text-secondary);">User ID (appWorkerId)</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--text-primary); background:rgba(0,0,0,0.05); padding:0.15rem 0.5rem; border-radius:4px;">${displayUserId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Workspace ID</span>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:700; color:var(--primary); background:rgba(16,185,129,0.08); padding:0.15rem 0.5rem; border-radius:4px;">${displayWorkspaceId}</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Active Role</span>
                                <div>${getRoleBadgeHtml(role)}</div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Auth Provider</span>
                                <span style="color:var(--text-primary); font-weight:500;">Google Authentication</span>
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
                                    <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${products.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Active Products</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div style="font-size:1.35rem; font-weight:800; color:var(--primary);">${totalInvoices}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Total Invoices</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${businesses.length}</div>
                                    <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600; text-transform:uppercase;">Businesses</div>
                                </div>
                                <div style="background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1px solid var(--border-color); text-align:center;">
                                    <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary);">${customers.length}</div>
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
                            ACTIVITY & CREATION DASHBOARD
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
                        <strong style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${productCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Invoices Issued</span>
                        <strong style="font-size:1.75rem; font-weight:800; color:var(--primary);">${invoiceCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Categories Created</span>
                        <strong style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${categoryCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Clients Added</span>
                        <strong style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${clientCount}</strong>
                    </div>
                    <div style="background:var(--surface-50); padding:1.15rem; border-radius:12px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.35rem;">
                        <span style="font-size:0.78rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.03em;">Businesses Added</span>
                        <strong style="font-size:1.75rem; font-weight:800; color:var(--text-primary);">${businessCount}</strong>
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
                    <div style="font-size:1.6rem; font-weight:900; color:#b91c1c; font-family:monospace; background:white; padding:0.25rem 0.85rem; border-radius:8px; border:1px solid rgba(239,68,68,0.3);">
                        ${String(totalDeleted).padStart(2, '0')}
                    </div>
                </div>
            </div>

            <!-- ======================================================== -->
            <!-- 3. ACCOUNT ACTIONS & QUICK LINKS                         -->
            <!-- ======================================================== -->
            <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                <h3 style="margin:0 0 1rem 0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">Quick Navigation</h3>
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/customer'">+ Customer Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/business'">+ Business Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/categories'">Manage Categories</button>
                    <button id="btn-profile-export-fast" class="btn btn-secondary">Export Data</button>
                </div>
            </div>
        `;

        // Event Listeners
        container.querySelector('#btn-profile-switch-acc')?.addEventListener('click', () => {
            openAccountSwitcherModal(currentUser);
        });

        if (canAccessSettings) {
            container.querySelector('#btn-profile-settings')?.addEventListener('click', () => {
                window.location.hash = '#/settings';
            });
        }

        container.querySelector('#btn-profile-export-fast')?.addEventListener('click', () => {
            openExportModal(workspaceId, { products, categories: [], invoices: [...custInvoices, ...busInvoices], workspaceInfo: wsData });
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
