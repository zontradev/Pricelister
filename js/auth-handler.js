import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';
import { storageService } from '../firebase/storage.js';
import { showAlert } from './alert-handler.js';
import { CONFIG } from '../config.js';
import { initRouter } from './router.js';
import { setAppCurrencySymbol } from './utilities.js';
import { openCurrencyPickerModal } from './modules/currencyModal.js';
import { initGlobalSearch } from './modules/globalSearch.js';

let routerInitialized = false;
let roleListenerUnsub = null;

/**
 * Universal Role Badge Configurations
 * Admin: Green-glow gradient
 * Co-admin: Green text, subtle green/grey accent
 * Worker: Black text, grey accent
 * No pink or blue colors!
 */
export const getRoleBadgeConfig = (role) => {
    const raw = (role || 'WORKER').toUpperCase();
    if (raw === 'CREATOR_ADMIN' || raw === 'ADMIN' || raw === 'CREATOR') {
        return {
            text: 'Admin',
            className: 'badge-role badge-role-admin',
            style: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(16, 185, 129, 0.45); border: 1px solid rgba(5, 150, 105, 0.8) !important; font-weight: 700;'
        };
    } else if (raw === 'CO_ADMIN' || raw === 'CO-ADMIN') {
        return {
            text: 'Co-admin',
            className: 'badge-role badge-role-coadmin',
            style: 'background: rgba(22, 163, 74, 0.12) !important; color: #16a34a !important; border: 1px solid rgba(22, 163, 74, 0.35) !important; font-weight: 600;'
        };
    } else {
        return {
            text: 'Worker',
            className: 'badge-role badge-role-worker',
            style: 'background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; font-weight: 600;'
        };
    }
};

export const formatRoleBadge = (role, element) => {
    if (!element) return;
    const config = getRoleBadgeConfig(role);
    element.textContent = config.text;
    element.className = config.className;
    element.style = config.style;
};

export const getRoleBadgeHtml = (role) => {
    const config = getRoleBadgeConfig(role);
    return `<span class="${config.className}" style="${config.style}">${config.text}</span>`;
};

/**
 * Rapid Multi-Account Switcher Modal
 * Enables instantaneous switching between saved accounts and adding new Google accounts.
 */
export const openAccountSwitcherModal = (currentUser) => {
    const existing = document.getElementById('account-switcher-overlay');
    if (existing) existing.remove();

    const savedAccounts = authService.getSavedAccounts();
    const currentEmail = currentUser?.email || '';

    const overlay = document.createElement('div');
    overlay.id = 'account-switcher-overlay';
    overlay.className = 'account-switcher-overlay';

    overlay.innerHTML = `
        <div class="account-switcher-modal" role="dialog" aria-modal="true" aria-labelledby="acc-switch-title">
            <div class="account-switcher-header">
                <h3 id="acc-switch-title" style="display:flex; align-items:center; gap:0.5rem;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                    Account Switcher
                </h3>
                <button type="button" class="icon-btn" id="close-account-switcher" style="font-size:1.25rem; cursor:pointer; background:none; border:none; color:var(--text-secondary);">×</button>
            </div>
            <div class="account-switcher-body">
                <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.75rem; letter-spacing:0.05em;">
                    Accounts on this Device
                </div>
                <div id="account-switcher-list">
                    ${savedAccounts.length > 0 ? savedAccounts.map(acc => {
                        const isActive = acc.email && acc.email.toLowerCase() === currentEmail.toLowerCase();
                        const initial = (acc.displayName || acc.email || 'U').charAt(0).toUpperCase();
                        return `
                            <div class="account-card-item ${isActive ? 'active' : ''}" data-email="${acc.email}">
                                <div class="account-card-left">
                                    ${acc.photoURL 
                                        ? `<img src="${acc.photoURL}" class="user-picture" alt="${acc.displayName}">` 
                                        : `<div class="user-avatar" style="width:36px; height:36px; min-width:36px; font-size:0.9rem;">${initial}</div>`
                                    }
                                    <div class="account-card-info">
                                        <span class="account-card-name">${acc.displayName || acc.email}</span>
                                        <span class="account-card-email">${acc.email}</span>
                                    </div>
                                </div>
                                <div>
                                    ${isActive 
                                        ? `<span class="account-card-badge-active">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Active
                                           </span>` 
                                        : `<button class="btn btn-xs btn-outline switch-to-acc-btn" data-email="${acc.email}">Switch</button>`
                                    }
                                </div>
                            </div>
                        `;
                    }).join('') : `
                        <div class="account-card-item active">
                            <div class="account-card-left">
                                <div class="user-avatar" style="width:36px; height:36px; min-width:36px;">${(currentEmail || 'U').charAt(0).toUpperCase()}</div>
                                <div class="account-card-info">
                                    <span class="account-card-name">${currentUser?.displayName || currentEmail}</span>
                                    <span class="account-card-email">${currentEmail}</span>
                                </div>
                            </div>
                            <span class="account-card-badge-active">Active</span>
                        </div>
                    `}
                </div>
            </div>
            <div class="account-switcher-footer">
                <button type="button" id="btn-add-new-account" class="btn btn-primary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; padding:0.65rem; font-weight:600;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>+ Add / Switch with Another Google Account</span>
                </button>
                <div style="display:flex; gap:0.5rem; justify-content:space-between; margin-top:0.25rem;">
                    <button type="button" id="btn-signout-current" class="btn btn-xs btn-outline" style="flex:1; color:var(--danger); border-color:var(--danger);">Sign Out Current</button>
                    <button type="button" id="btn-signout-all" class="btn btn-xs btn-outline" style="flex:1;">Clear & Sign Out All</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    const closeBtn = overlay.querySelector('#close-account-switcher');
    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Add new account button
    const addBtn = overlay.querySelector('#btn-add-new-account');
    if (addBtn) {
        addBtn.onclick = async () => {
            addBtn.disabled = true;
            addBtn.innerHTML = 'Connecting to Google...';
            try {
                await authService.loginWithGoogle(true);
                overlay.remove();
                window.location.reload();
            } catch (err) {
                console.error("Account switch failed:", err);
                addBtn.disabled = false;
                addBtn.innerHTML = '+ Add / Switch with Another Google Account';
            }
        };
    }

    // Switch account item clicks
    overlay.querySelectorAll('.switch-to-acc-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            btn.disabled = true;
            btn.textContent = 'Switching...';
            try {
                await authService.loginWithGoogle(true);
                overlay.remove();
                window.location.reload();
            } catch (err) {
                btn.disabled = false;
                btn.textContent = 'Switch';
            }
        };
    });

    // Sign out current
    const signoutCurrentBtn = overlay.querySelector('#btn-signout-current');
    if (signoutCurrentBtn) {
        signoutCurrentBtn.onclick = async () => {
            await authService.logout();
        };
    }

    // Sign out all
    const signoutAllBtn = overlay.querySelector('#btn-signout-all');
    if (signoutAllBtn) {
        signoutAllBtn.onclick = async () => {
            localStorage.removeItem('pricelister_saved_accounts');
            await authService.logout();
        };
    }
};

export const initAuthHandler = (pageType) => {
    const loader = document.getElementById('app-loader');
    const shell = document.getElementById('app-shell');
    const authContainer = document.getElementById('auth-container');
    const setupContainer = document.getElementById('workspace-setup-container');

    // TEST MODE INDICATOR
    if (CONFIG.APP_MODE === 'test') {
        const testBadge = document.createElement('div');
        testBadge.className = 'test-mode-badge';
        testBadge.textContent = 'TEST MODE';
        document.body.appendChild(testBadge);
    }

    authService.onAuthStateChanged(async (user) => {
        if (pageType === 'index') {
            const launcherContainer = document.getElementById('workspace-launcher-container');
            if (user) {
                // If logged in on public page, check if workspace exists
                try {
                    const workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                    if (workspace) {
                        // User has a workspace, show launcher
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (authContainer) authContainer.style.display = 'none';
                        if (setupContainer) setupContainer.style.display = 'none';
                        if (launcherContainer) {
                            launcherContainer.style.display = 'block';
                            const nameEl = document.getElementById('launcher-workspace-name');
                            if (nameEl) nameEl.textContent = workspace.name || 'Your Workspace';
                            
                            const emailEl = document.getElementById('launcher-account-email');
                            if (emailEl) emailEl.textContent = user.email;

                            const photoEl = document.getElementById('launcher-photo');
                            const avatarEl = document.getElementById('launcher-avatar');
                            if (user.photoURL && photoEl) {
                                photoEl.src = user.photoURL;
                                photoEl.style.display = 'block';
                                if (avatarEl) avatarEl.style.display = 'none';
                            } else if (avatarEl) {
                                avatarEl.textContent = (user.email || 'U').charAt(0).toUpperCase();
                                avatarEl.style.display = 'flex';
                                if (photoEl) photoEl.style.display = 'none';
                            }
                            
                            const idEl = document.getElementById('launcher-workspace-id');
                            if (idEl) idEl.textContent = workspace.workspaceId || workspace.id;
                            
                            const roleEl = document.getElementById('launcher-user-role');
                            formatRoleBadge(workspace.role, roleEl);
                            
                            const dateEl = document.getElementById('launcher-joined-date');
                            if (dateEl) {
                                if (workspace.createdAt) {
                                    const d = typeof workspace.createdAt === 'number' 
                                        ? new Date(workspace.createdAt) 
                                        : (workspace.createdAt.toDate ? workspace.createdAt.toDate() : new Date());
                                    dateEl.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                                } else {
                                    dateEl.textContent = 'Recently';
                                }
                            }
                        }
                    } else {
                        // NO WORKSPACE FOUND: Show setup with join notifications & create form
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (authContainer) authContainer.style.display = 'none';
                        if (launcherContainer) launcherContainer.style.display = 'none';
                        
                        // Populate account details in setup card
                        const setupEmail = document.getElementById('setup-account-email');
                        if (setupEmail) setupEmail.textContent = user.email;

                        const setupPhoto = document.getElementById('setup-account-photo');
                        const setupAvatar = document.getElementById('setup-account-avatar');
                        if (user.photoURL && setupPhoto) {
                            setupPhoto.src = user.photoURL;
                            setupPhoto.style.display = 'block';
                            if (setupAvatar) setupAvatar.style.display = 'none';
                        } else if (setupAvatar) {
                            setupAvatar.textContent = (user.email || 'U').charAt(0).toUpperCase();
                            setupAvatar.style.display = 'flex';
                            if (setupPhoto) setupPhoto.style.display = 'none';
                        }
                        
                        // Check for pending invites
                        if (user.email) {
                            const invites = await firestoreService.getPendingInvites(user.email);
                            const section = document.getElementById('pending-invites-section');
                            const list = document.getElementById('pending-invites-list');
                            if (section && list) {
                                if (invites && invites.length > 0) {
                                    section.style.display = 'block';
                                    list.innerHTML = invites.map(inv => `
                                        <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                            <div>
                                                <strong style="display:block; color: var(--text-primary); font-size:1.05rem;">${inv.workspaceName || 'PriceLister Workspace'}</strong>
                                                <div style="color: var(--text-secondary); font-size:0.82rem; margin-top:0.2rem;">
                                                    Invited by: <strong>${inv.adminEmail}</strong> • Role: <span class="badge-role badge-role-worker">${inv.role || 'Worker'}</span>
                                                </div>
                                            </div>
                                            <div style="display: flex; gap: 0.5rem;">
                                                <button class="btn btn-sm btn-primary accept-invite-btn" data-id="${inv.id}" style="font-weight:600; padding:0.4rem 0.85rem;">Join Workspace</button>
                                                <button class="btn btn-sm btn-outline reject-invite-btn" data-id="${inv.id}" style="padding:0.4rem 0.65rem;">Decline</button>
                                            </div>
                                        </div>
                                    `).join('');
                                    
                                    // Attach events
                                    list.querySelectorAll('.accept-invite-btn').forEach(btn => {
                                        btn.addEventListener('click', async (e) => {
                                            const id = e.target.getAttribute('data-id');
                                            const invite = invites.find(i => i.id === id);
                                            try {
                                                e.target.disabled = true;
                                                e.target.textContent = 'Joining...';
                                                await firestoreService.acceptWorkspaceInvite(invite, user);
                                                window.location.href = 'app.html';
                                            } catch (err) {
                                                e.target.disabled = false;
                                                e.target.textContent = 'Join Workspace';
                                                if (window.showAlert) window.showAlert.error("Failed to join workspace.");
                                            }
                                        });
                                    });
                                    
                                    list.querySelectorAll('.reject-invite-btn').forEach(btn => {
                                        btn.addEventListener('click', async (e) => {
                                            const id = e.target.getAttribute('data-id');
                                            try {
                                                e.target.disabled = true;
                                                e.target.textContent = '...';
                                                await firestoreService.rejectWorkspaceInvite(id);
                                                e.target.parentElement.parentElement.remove();
                                                if (list.children.length === 0) {
                                                    section.style.display = 'none';
                                                }
                                            } catch (err) {
                                                e.target.disabled = false;
                                                e.target.textContent = 'Decline';
                                                if (window.showAlert) window.showAlert.error("Failed to decline invite.");
                                            }
                                        });
                                    });
                                } else {
                                    section.style.display = 'none';
                                }
                            }
                        }
                        
                        if (setupContainer) setupContainer.style.display = 'block';
                    }
                } catch (error) {
                    console.error("Auth check error:", error);
                    showAlert.error('Error checking account status. Please check connection.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                    if (authContainer) authContainer.style.display = 'block';
                }
            } else {
                // Not logged in -> show landing page content
                document.body.classList.remove('app-loading');
                if (loader) loader.style.display = 'none';
                if (authContainer) authContainer.style.display = 'block';
                if (setupContainer) setupContainer.style.display = 'none';
                if (launcherContainer) launcherContainer.style.display = 'none';
            }
        } else if (pageType === 'app') {
            if (user) {
                try {
                    const workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                    if (!workspace) {
                        // Cannot be in app without workspace -> redirect to index for setup
                        window.location.href = 'index.html';
                        return;
                    }
                    if (workspace.currency || workspace.currencySymbol) {
                        setAppCurrencySymbol(workspace.currency || workspace.currencySymbol);
                    }
                    document.body.classList.remove('app-loading');
                    
                    // Update bottom-left UI with user profile info
                    const userEmailEl = document.getElementById('user-email');
                    if (userEmailEl) userEmailEl.textContent = user.email;

                    const userRoleEl = document.getElementById('user-role');
                    formatRoleBadge(workspace.role, userRoleEl);

                    const userPhoto = document.getElementById('user-picture');
                    const userAvatar = document.getElementById('user-avatar');
                    if (user.photoURL && userPhoto) {
                        userPhoto.src = user.photoURL;
                        userPhoto.style.display = 'block';
                        if (userAvatar) userAvatar.style.display = 'none';
                    } else if (userAvatar) {
                        userAvatar.textContent = (user.email || 'U').charAt(0).toUpperCase();
                        userAvatar.style.display = 'flex';
                        if (userPhoto) userPhoto.style.display = 'none';
                    }

                    // Setup Realtime Role Listener
                    if (roleListenerUnsub) roleListenerUnsub();
                    roleListenerUnsub = firestoreService.listenToUserRole(user.uid, user.email, (newRole) => {
                        if (newRole) {
                            formatRoleBadge(newRole, document.getElementById('user-role'));
                        }
                    });

                    // Manage permissions
                    const roleUpper = (workspace.role || 'WORKER').toUpperCase();
                    const isWorker = roleUpper === 'WORKER';
                    const settingsNavLink = document.querySelector('a[data-route="settings"]');
                    if (settingsNavLink && isWorker) {
                        settingsNavLink.title = "Settings (Admins only)";
                        settingsNavLink.innerHTML = 'Settings <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-1px; margin-left:4px; opacity:0.6;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
                    }

                    // Customer Panel access: Admins and Co-admins only
                    const customerPanelNavWrapper = document.getElementById('nav-item-customer-panel-wrapper');
                    if (customerPanelNavWrapper) {
                        customerPanelNavWrapper.style.display = isWorker ? 'none' : 'block';
                    }

                    // Update Customer Panel live status badge in sidebar
                    const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
                    if (sidebarStatus) {
                        const isPanelLive = Boolean(workspace.customerPanel && (workspace.customerPanel.isPublished !== undefined ? workspace.customerPanel.isPublished : workspace.customerPanel.enabled));
                        sidebarStatus.className = isPanelLive ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
                        sidebarStatus.textContent = isPanelLive ? 'Live' : 'Closed';
                    }

                    window.__activeWorkspace = workspace;
                    window.__activeWorkspaceId = workspace.id;

                    // If in Demo Sandbox mode, inject indicator and reset helper into topbar
                    if (user.uid === 'dev-mock-uid') {
                        const topbarActions = document.getElementById('topbar-actions');
                        if (topbarActions && !document.getElementById('demo-mode-indicator')) {
                            const demoTag = document.createElement('div');
                            demoTag.id = 'demo-mode-indicator';
                            demoTag.style.display = 'flex';
                            demoTag.style.alignItems = 'center';
                            demoTag.style.gap = '0.5rem';
                            demoTag.innerHTML = `
                                <span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; background:rgba(14, 165, 233, 0.12); color:#0284c7; padding:0.25rem 0.65rem; border-radius:9999px; border:1px solid rgba(14, 165, 233, 0.3);">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                    Demo Sandbox Mode
                                </span>
                                <button type="button" id="btn-reset-demo-data" class="btn btn-sm btn-secondary" style="font-size:0.72rem; padding:0.2rem 0.55rem;" title="Reset demo dataset to initial state">
                                    Reset Demo Data
                                </button>
                            `;
                            topbarActions.prepend(demoTag);

                            demoTag.querySelector('#btn-reset-demo-data')?.addEventListener('click', async () => {
                                if (await showAlert.confirm("Reset all demo data back to clean factory default?")) {
                                    localStorage.removeItem('pricelister_demo_db_v2');
                                    showAlert.success("Demo data reset successfully!");
                                    setTimeout(() => window.location.reload(), 300);
                                }
                            });
                        }
                    }

                    initGlobalSearch(workspace.id);
                    renderTopbarAdminProfile(user, workspace);

                    if (!routerInitialized) {
                        initRouter(workspace.id);
                        routerInitialized = true;
                    }
                } catch (error) {
                    console.error("Workspace load error:", error);
                    showAlert.error('Error loading workspace.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                }
            } else {
                window.location.href = 'index.html';
            }
        }
    });

    /**
     * Topbar Admin & Workspace Profile Pill (Top-Right Action Header)
     */
    function renderTopbarAdminProfile(user, workspace) {
        const topbarActions = document.getElementById('topbar-actions');
        if (!topbarActions || !user || !workspace) return;

        let group = document.getElementById('topbar-right-group');
        if (!group) {
            group = document.createElement('div');
            group.id = 'topbar-right-group';
            group.className = 'topbar-right-group';
            topbarActions.appendChild(group);
        }

        const roleUpper = (workspace.role || 'WORKER').toUpperCase();
        const isAdmin = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'ADMIN' || roleUpper === 'CREATOR';
        const isCoAdmin = roleUpper === 'CO_ADMIN' || roleUpper === 'CO-ADMIN';
        const roleLabel = isAdmin ? 'Admin' : (isCoAdmin ? 'Co-Admin' : 'Worker');
        const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Admin');
        const wsDisplayName = workspace.name || 'PriceLister Workspace';
        const wsIdText = workspace.workspaceId || workspace.id || '';
        const initial = (displayName.charAt(0) || 'A').toUpperCase();

        group.innerHTML = `
            <!-- Quick Help / Shortcuts Icon Button -->
            <button type="button" class="topbar-icon-action-btn" id="topbar-btn-help" title="Quick Help & Shortcuts (Ctrl+K)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </button>

            <!-- Notification Bell Button -->
            <button type="button" class="topbar-icon-action-btn" id="topbar-btn-notif" title="Workspace Mailbox & Notifications">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span class="topbar-icon-badge-dot"></span>
            </button>

            <!-- Admin / Workspace Profile Pill Trigger -->
            <div class="topbar-profile-pill" id="topbar-profile-pill-trigger" title="Workspace Profile & Quick Switcher">
                <div class="topbar-profile-avatar-wrap">
                    ${user.photoURL 
                        ? `<img src="${user.photoURL}" class="topbar-profile-avatar" alt="${displayName}">`
                        : `<div class="topbar-profile-avatar">${initial}</div>`
                    }
                    <span class="topbar-profile-status-dot" title="Online & Connected"></span>
                </div>
                <div class="topbar-profile-meta">
                    <span class="topbar-profile-name">${displayName}</span>
                    <span class="topbar-profile-role">${roleLabel}</span>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--text-muted); margin-left: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>

            <!-- Dropdown Popover Menu -->
            <div class="topbar-profile-dropdown" id="topbar-profile-dropdown-menu">
                <div style="padding: 0.65rem 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.4rem;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(225,29,72,0.25);">
                            ${(wsDisplayName.charAt(0) || 'W').toUpperCase()}
                        </div>
                        <div style="overflow: hidden; flex: 1;">
                            <div style="font-weight: 800; font-size: 0.88rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${wsDisplayName}</div>
                            <div style="font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email || ''}</div>
                        </div>
                    </div>

                    <div style="margin-top: 0.65rem; background: var(--surface-50); padding: 0.35rem 0.6rem; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.72rem; font-family: monospace; color: var(--text-secondary); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${wsIdText}
                        </div>
                        <button type="button" id="topbar-copy-ws-id" style="background: none; border: none; padding: 2px 4px; cursor: pointer; color: var(--primary); font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; gap: 3px;" title="Copy Workspace ID">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span>Copy</span>
                        </button>
                    </div>
                </div>

                <!-- Navigation Links -->
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <a href="#/workspace" class="topbar-dropdown-item" style="display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.84rem; font-weight: 600; transition: background 0.15s ease;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <span>Workspace Hub</span>
                    </a>
                    <a href="#/settings" class="topbar-dropdown-item" style="display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.84rem; font-weight: 600; transition: background 0.15s ease;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        <span>Advanced Settings</span>
                    </a>
                    <a href="#/profile" class="topbar-dropdown-item" style="display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: var(--text-primary); text-decoration: none; font-size: 0.84rem; font-weight: 600; transition: background 0.15s ease;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span>My Profile</span>
                    </a>

                    <div style="height: 1px; background: var(--border-color); margin: 0.35rem 0;"></div>

                    <button type="button" id="topbar-switch-acc-btn" class="topbar-dropdown-item" style="width: 100%; border: none; background: none; text-align: left; display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: var(--text-primary); font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                        <span>Change Account</span>
                    </button>

                    <button type="button" id="topbar-logout-btn" class="topbar-dropdown-item" style="width: 100%; border: none; background: none; text-align: left; display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: #e11d48; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        <span>Sign Out</span>
                    </button>
                </div>
            </div>
        `;

        // Event Listeners for Topbar Elements
        const trigger = group.querySelector('#topbar-profile-pill-trigger');
        const dropdown = group.querySelector('#topbar-profile-dropdown-menu');
        const btnHelp = group.querySelector('#topbar-btn-help');
        const btnNotif = group.querySelector('#topbar-btn-notif');
        const copyWsBtn = group.querySelector('#topbar-copy-ws-id');
        const switchAccBtn = group.querySelector('#topbar-switch-acc-btn');
        const logoutBtn = group.querySelector('#topbar-logout-btn');

        if (trigger && dropdown) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('show');
            });

            // Close on click outside
            document.addEventListener('click', (e) => {
                if (!group.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });
        }

        if (btnHelp) {
            btnHelp.addEventListener('click', () => {
                const searchBtn = document.getElementById('global-search-trigger-btn');
                if (searchBtn) searchBtn.click();
            });
        }

        if (btnNotif) {
            btnNotif.addEventListener('click', () => {
                window.location.hash = '#/mailbox';
            });
        }

        if (copyWsBtn) {
            copyWsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (navigator.clipboard && wsIdText) {
                    navigator.clipboard.writeText(wsIdText);
                    const origHtml = copyWsBtn.innerHTML;
                    copyWsBtn.innerHTML = `<span>Copied!</span>`;
                    setTimeout(() => {
                        copyWsBtn.innerHTML = origHtml;
                    }, 1800);
                }
            });
        }

        if (switchAccBtn) {
            switchAccBtn.addEventListener('click', () => {
                dropdown.classList.remove('show');
                openAccountSwitcherModal();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (await showAlert.confirm('Are you sure you want to sign out?')) {
                    await authService.logout();
                    window.location.href = 'index.html';
                }
            });
        }
    }

    // Login Modal Logic
    const loginModal = document.getElementById('login-modal-container');
    
    document.querySelectorAll('.open-login-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.style.display = 'flex';
        });
    });

    const closeLoginModal = document.getElementById('close-login-modal');
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', () => {
            if (loginModal) loginModal.style.display = 'none';
        });
    }

    // Modal Google Login Button (Production Google OAuth)
    const modalGoogleBtn = document.getElementById('modal-google-login-btn');
    if (modalGoogleBtn) {
        modalGoogleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            modalGoogleBtn.disabled = true;
            modalGoogleBtn.innerHTML = 'Connecting to Google...';
            
            try {
                await authService.loginWithGoogle(true);
                showAlert.success('Google sign-in successful.');
                if (loginModal) loginModal.style.display = 'none';
            } catch (error) {
                showAlert.error('Sign-in couldn\'t be completed. Please try again.');
                modalGoogleBtn.disabled = false;
                modalGoogleBtn.innerHTML = 'Continue with Google';
            }
        });
    }

    // Modal Test Enter Button (Demo UI Sandbox)
    const modalTestBtn = document.getElementById('modal-test-login-btn');
    if (modalTestBtn) {
        modalTestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            modalTestBtn.disabled = true;
            modalTestBtn.innerHTML = '<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Preparing Demo Sandbox...';
            
            try {
                await authService.loginAsGuest();
                showAlert.success('Entering Demo UI Sandbox with complete test data.');
                if (loginModal) loginModal.style.display = 'none';
                setTimeout(() => {
                    window.location.href = 'app.html';
                }, 150);
            } catch (error) {
                console.error("Test Entry Error:", error);
                showAlert.error('Test sign-in failed.');
                modalTestBtn.disabled = false;
                modalTestBtn.innerHTML = 'Test Enter &bull; Demo UI Sandbox';
            }
        });
    }

    // Workspace Setup Form (Create Workspace)
    const setupForm = document.getElementById('workspace-setup-form');
    if (setupForm) {
        const wsCurrInput = document.getElementById('ws-currency');
        const wsCurrPreview = document.getElementById('ws-currency-preview');
        const btnWsFindCurrency = document.getElementById('btn-ws-find-currency');

        // Workspace Logo File Picking & Drag & Drop Zone
        let selectedWsLogoFile = null;
        let wsLogoDataUrl = '';
        const wsLogoFileInput = document.getElementById('ws-logo-file-input');
        const btnWsChooseLogo = document.getElementById('btn-ws-choose-logo');
        const btnWsRemoveLogo = document.getElementById('btn-ws-remove-logo');
        const wsLogoImgPreview = document.getElementById('ws-logo-img-preview');
        const wsLogoEmptyState = document.getElementById('ws-logo-empty-state');
        const wsLogoBox = document.getElementById('ws-logo-preview-box');
        const wsLogoDropzone = document.getElementById('ws-logo-dropzone');
        const dropPrompt = document.getElementById('ws-logo-drop-prompt');

        const processWorkspaceLogoFile = (file) => {
            return new Promise((resolve, reject) => {
                if (!file || !file.type.startsWith('image/')) {
                    reject(new Error('Please select a valid image file (PNG, JPG, WEBP).'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const maxDim = 800;
                        let w = img.width;
                        let h = img.height;

                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = w;
                        canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);

                        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                    type: 'image/jpeg',
                                    lastModified: Date.now()
                                });
                                resolve({ file: optimizedFile, dataUrl });
                            } else {
                                resolve({ file, dataUrl: e.target.result });
                            }
                        }, 'image/jpeg', 0.88);
                    };
                    img.onerror = () => {
                        resolve({ file, dataUrl: e.target.result });
                    };
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        };

        const handleFileSelection = async (file) => {
            if (!file) return;
            try {
                if (dropPrompt) dropPrompt.innerHTML = `<strong>Processing image...</strong>`;
                const { file: optimizedFile, dataUrl } = await processWorkspaceLogoFile(file);
                selectedWsLogoFile = optimizedFile;
                wsLogoDataUrl = dataUrl;

                if (wsLogoImgPreview) {
                    wsLogoImgPreview.src = wsLogoDataUrl;
                    wsLogoImgPreview.style.display = 'block';
                }
                if (wsLogoEmptyState) wsLogoEmptyState.style.display = 'none';
                if (btnWsRemoveLogo) btnWsRemoveLogo.style.display = 'inline-block';
                if (btnWsChooseLogo) btnWsChooseLogo.textContent = 'Change File';
                if (dropPrompt) dropPrompt.innerHTML = `<strong>Logo selected:</strong> ${file.name} (${(optimizedFile.size / 1024).toFixed(1)} KB)`;
                if (wsLogoDropzone) {
                    wsLogoDropzone.style.borderColor = '#10b981';
                    wsLogoDropzone.style.background = 'rgba(16, 185, 129, 0.04)';
                }
            } catch (err) {
                console.error("Logo processing error:", err);
                showAlert.error(err.message || 'Failed to process image file.');
                if (dropPrompt) dropPrompt.innerHTML = `<strong>Drag & drop image here</strong>, or click to browse.`;
            }
        };

        // Click Triggers for File Picker
        if (btnWsChooseLogo && wsLogoFileInput) {
            btnWsChooseLogo.addEventListener('click', (e) => {
                e.stopPropagation();
                wsLogoFileInput.click();
            });
        }

        if (wsLogoBox && wsLogoFileInput) {
            wsLogoBox.addEventListener('click', (e) => {
                e.stopPropagation();
                wsLogoFileInput.click();
            });
        }

        if (wsLogoDropzone && wsLogoFileInput) {
            wsLogoDropzone.addEventListener('click', (e) => {
                if (e.target !== btnWsRemoveLogo && !btnWsRemoveLogo.contains(e.target)) {
                    wsLogoFileInput.click();
                }
            });
        }

        // File Input Change Listener
        if (wsLogoFileInput) {
            wsLogoFileInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    handleFileSelection(file);
                }
            });
        }

        // Drag & Drop Listeners
        const dropTargets = [wsLogoDropzone, wsLogoBox].filter(Boolean);
        dropTargets.forEach(target => {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                target.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                target.addEventListener(eventName, () => {
                    if (wsLogoDropzone) {
                        wsLogoDropzone.style.borderColor = '#e11d48';
                        wsLogoDropzone.style.background = 'rgba(225, 29, 72, 0.06)';
                        wsLogoDropzone.style.transform = 'scale(1.01)';
                    }
                });
            });

            ['dragleave'].forEach(eventName => {
                target.addEventListener(eventName, () => {
                    if (wsLogoDropzone) {
                        wsLogoDropzone.style.transform = 'scale(1)';
                        if (!selectedWsLogoFile) {
                            wsLogoDropzone.style.borderColor = '#cbd5e1';
                            wsLogoDropzone.style.background = 'var(--surface-50)';
                        }
                    }
                });
            });

            target.addEventListener('drop', (e) => {
                if (wsLogoDropzone) {
                    wsLogoDropzone.style.transform = 'scale(1)';
                }
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    handleFileSelection(dt.files[0]);
                }
            });
        });

        // Remove Logo Button
        if (btnWsRemoveLogo) {
            btnWsRemoveLogo.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedWsLogoFile = null;
                wsLogoDataUrl = '';
                if (wsLogoFileInput) wsLogoFileInput.value = '';
                if (wsLogoImgPreview) {
                    wsLogoImgPreview.src = '';
                    wsLogoImgPreview.style.display = 'none';
                }
                if (wsLogoEmptyState) wsLogoEmptyState.style.display = 'flex';
                btnWsRemoveLogo.style.display = 'none';
                if (wsLogoDropzone) {
                    wsLogoDropzone.style.borderColor = '#cbd5e1';
                    wsLogoDropzone.style.background = 'var(--surface-50)';
                }
                if (dropPrompt) {
                    dropPrompt.innerHTML = `<strong>Drag & drop image here</strong>, or click to browse (PNG, JPG, WEBP).`;
                }
                if (btnWsChooseLogo) {
                    btnWsChooseLogo.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Choose File
                    `;
                }
            });
        }

        const updateWsCurrPreview = (val) => {
            const sym = (val || '$').trim().substring(0, 3) || '$';
            if (wsCurrPreview) {
                const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
                wsCurrPreview.textContent = `${sym}${separator}1,250.00`;
            }
        };

        if (wsCurrInput) {
            wsCurrInput.addEventListener('input', (e) => {
                updateWsCurrPreview(e.target.value);
            });
        }

        if (btnWsFindCurrency) {
            btnWsFindCurrency.addEventListener('click', () => {
                openCurrencyPickerModal(wsCurrInput?.value || '$', (selectedSymbol) => {
                    const cleanSymbol = (selectedSymbol || '$').trim().substring(0, 3) || '$';
                    if (wsCurrInput) wsCurrInput.value = cleanSymbol;
                    updateWsCurrPreview(cleanSymbol);
                });
            });
        }

        setupForm.querySelectorAll('.btn-ws-curr-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const sym = (btn.getAttribute('data-symbol') || '$').substring(0, 3);
                if (wsCurrInput) wsCurrInput.value = sym;
                updateWsCurrPreview(sym);
            });
        });

        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUser = authService.getCurrentUser();
            if (!currentUser) return;
            
            const btn = setupForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating Workspace...';
            
            const descInput = document.getElementById('ws-desc');
            const chosenCurrency = (document.getElementById('ws-currency')?.value || "$").trim().substring(0, 3) || "$";

            let finalLogoUrl = wsLogoDataUrl || '';
            if (selectedWsLogoFile) {
                try {
                    btn.textContent = 'Uploading Workspace Logo...';
                    finalLogoUrl = await storageService.uploadImage(selectedWsLogoFile, currentUser.uid);
                } catch (uploadErr) {
                    console.warn("Logo storage upload failed, saving local data url:", uploadErr);
                    finalLogoUrl = wsLogoDataUrl || '';
                }
            }

            const workspaceData = {
                name: (document.getElementById('ws-name')?.value || "").trim(),
                description: (descInput?.value || "Main").trim(),
                phone: (document.getElementById('ws-phone')?.value || "").trim(),
                address: (document.getElementById('ws-address')?.value || "").trim(),
                email: (document.getElementById('ws-email')?.value || currentUser.email || "").trim(),
                adminName: currentUser.displayName || (document.getElementById('ws-name')?.value || "Eycon Contact").trim(),
                adminEmail: currentUser.email || "",
                currency: chosenCurrency,
                currencySymbol: chosenCurrency,
                logoUrl: finalLogoUrl,
                logo: finalLogoUrl
            };
            
            try {
                btn.textContent = 'Finalizing Workspace...';
                setAppCurrencySymbol(chosenCurrency);
                await firestoreService.createWorkspace(currentUser.uid, currentUser.email, workspaceData);
                showAlert.success('Workspace created successfully!');
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Create Workspace Error:", error);
                showAlert.error('Failed to create workspace. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Create Workspace →';
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await authService.logout();
            } catch (error) {
                showAlert.error('An error occurred while logging out.');
            }
        });
    }

    // Change Account Buttons (Opens Rapid Account Switcher Modal)
    const attachAccountSwitcherTriggers = () => {
        const triggers = [
            document.getElementById('sidebar-switch-account-btn'),
            document.getElementById('launcher-change-account-btn'),
            document.getElementById('setup-change-account-btn')
        ];

        triggers.forEach(btn => {
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const user = authService.getCurrentUser();
                    openAccountSwitcherModal(user);
                };
            }
        });

        // Also make bottom-left user info card clickable to view profile / switch account
        const userCard = document.getElementById('sidebar-user-card');
        if (userCard) {
            userCard.onclick = () => {
                window.location.hash = '#/profile';
            };
        }
    };

    attachAccountSwitcherTriggers();
};

