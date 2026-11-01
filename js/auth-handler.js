import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';
import { storageService } from '../firebase/storage.js';
import { showAlert } from './alert-handler.js';

export { authService, showAlert };
import { CONFIG } from '../config.js';
import { initRouter } from './router.js';
import { setAppCurrencySymbol } from './utilities.js';
import { openBannerPickerModal } from './modules/bannerModal.js';
import { initGlobalSearch } from './modules/globalSearch.js';
import { openCriticalBoardModal } from './modules/customFontManager.js';
if (typeof window !== 'undefined') {
    window.openCriticalBoardModal = openCriticalBoardModal;
}
import { CURRENCY_LIST, getCurrencyByCode } from './utils/currencyData.js';
import { COUNTRIES_LIST, WORKSPACE_ROLES, getRoleLevel, getRoleMeta } from '../DataModel.js';

let routerInitialized = false;
let roleListenerUnsub = null;

/**
 * Universal Access Restriction Checker
 * Creator Admin is strictly and always exempt from all restrictions.
 */
export const getUserRestrictions = () => {
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    const currentUser = authService?.getCurrentUser() || {};
    const roleUpper = (ws.role || currentUser.role || 'WORKER').toUpperCase();
    const isCreatorAdmin = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'CREATOR' || (ws.adminEmail && currentUser.email && ws.adminEmail.toLowerCase() === currentUser.email.toLowerCase());
    const isCoAdmin = roleUpper === 'CO_ADMIN' || roleUpper === 'COADMIN';
    const isPrivileged = isCreatorAdmin || isCoAdmin;

    if (isPrivileged) {
        return {
            cannotSeeCost: false,
            cannotSeeProfit: false,
            disableAdd: false,
            disableUpdate: false,
            disableDelete: false,
            disableDeleteOthers: false,
            disableUpdateOthers: false,
            isAccessBlocked: false,
            accessRevoked: false,
            revokeStart: null,
            revokeEnd: null,
            revokeStartFormatted: '',
            revokeEndFormatted: '',
            isRestricted: false,
            isCreator: isCreatorAdmin,
            isCoAdmin: isCoAdmin
        };
    }

    const isAccessBlocked = Boolean(ws.isAccessBlocked);

    return {
        cannotSeeCost: Boolean(ws.cannotSeeCost),
        cannotSeeProfit: Boolean(ws.cannotSeeProfit),
        disableAdd: Boolean(ws.disableAdd),
        disableUpdate: Boolean(ws.disableUpdate),
        disableDelete: Boolean(ws.disableDelete),
        disableDeleteOthers: Boolean(ws.disableDeleteOthers),
        disableUpdateOthers: Boolean(ws.disableUpdateOthers),
        isAccessBlocked,
        accessRevoked: Boolean(ws.accessRevoked),
        revokeStart: ws.revokeStart || null,
        revokeEnd: ws.revokeEnd || null,
        revokeStartFormatted: ws.revokeStartFormatted || '',
        revokeEndFormatted: ws.revokeEndFormatted || '',
        isRestricted: Boolean(ws.isRestricted || ws.cannotSeeCost || ws.cannotSeeProfit || ws.disableAdd || ws.disableUpdate || ws.disableDelete || ws.disableDeleteOthers || ws.disableUpdateOthers || isAccessBlocked)
    };
};

if (typeof window !== 'undefined') {
    window.getUserRestrictions = getUserRestrictions;
}

/**
 * Universal Role Badge Configurations
 * Admin: Green-glow gradient
 * Co-admin: Green text, subtle green/grey accent
 * Manager: Deep slate/navy with subtle border
 * Worker: Black text, grey accent
 * Visitor: Warm amber badge
 */
export const getRoleBadgeConfig = (role, customTag = null) => {
    const level = getRoleLevel(role);
    const meta = WORKSPACE_ROLES[level] || WORKSPACE_ROLES[3];
    const label = (customTag && typeof customTag === 'string' && customTag.trim()) ? customTag.trim() : meta.defaultTag;

    switch (level) {
        case 0:
            return {
                level: 0,
                text: label,
                className: 'badge-role badge-role-admin',
                style: 'background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; color: #ffffff !important; box-shadow: 0 0 12px rgba(16, 185, 129, 0.45); border: 1px solid rgba(5, 150, 105, 0.8) !important; font-weight: 700;'
            };
        case 1:
            return {
                level: 1,
                text: label,
                className: 'badge-role badge-role-coadmin',
                style: 'background: rgba(22, 163, 74, 0.12) !important; color: #16a34a !important; border: 1px solid rgba(22, 163, 74, 0.35) !important; font-weight: 700;'
            };
        case 2:
            return {
                level: 2,
                text: label,
                className: 'badge-role badge-role-manager',
                style: 'background: rgba(59, 130, 246, 0.12) !important; color: #1d4ed8 !important; border: 1px solid rgba(59, 130, 246, 0.35) !important; font-weight: 700;'
            };
        case 3:
            return {
                level: 3,
                text: label,
                className: 'badge-role badge-role-worker',
                style: 'background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; font-weight: 600;'
            };
        case 4:
            return {
                level: 4,
                text: label,
                className: 'badge-role badge-role-visitor',
                style: 'background: rgba(245, 158, 11, 0.12) !important; color: #b45309 !important; border: 1px solid rgba(245, 158, 11, 0.35) !important; font-weight: 600;'
            };
        default:
            return {
                level: 3,
                text: label,
                className: 'badge-role badge-role-worker',
                style: 'background: #f1f5f9 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; font-weight: 600;'
            };
    }
};

export const formatRoleBadge = (role, element, customTag = null) => {
    if (!element) return;
    const config = getRoleBadgeConfig(role, customTag);
    element.textContent = config.text;
    element.className = config.className;
    element.style = config.style;
};

export const getRoleBadgeHtml = (role, customTag = null) => {
    const config = getRoleBadgeConfig(role, customTag);
    return `<span class="${config.className}" style="${config.style}">${config.text}</span>`;
};

/**
 * Rapid Multi-Account Switcher Modal
 * Enables instantaneous switching between saved accounts and adding new Google accounts.
 */
export const openAccountSwitcherModal = (currentUser) => {
    const existing = document.getElementById('account-switcher-overlay');
    if (existing) existing.remove();

    const resolvedUser = currentUser || authService.getCurrentUser() || {};
    const savedAccounts = authService.getSavedAccounts();
    const currentEmail = (resolvedUser?.email || '').toLowerCase();

    const overlay = document.createElement('div');
    overlay.id = 'account-switcher-overlay';
    overlay.className = 'account-switcher-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(9, 9, 11, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        animation: fadeIn 0.18s ease-out;
    `;

    overlay.innerHTML = `
        <div class="account-switcher-modal" role="dialog" aria-modal="true" aria-labelledby="acc-switch-title" style="
            background: #ffffff;
            border: 1px solid #e4e4e7;
            border-radius: 22px;
            width: 100%;
            max-width: 460px;
            box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0,0,0,0.06);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        ">
            <!-- Modal Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid #f1f5f9; background: #fafafa;">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(24, 24, 27, 0.08); display: flex; align-items: center; justify-content: center; color: #18181b;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                    </div>
                    <div>
                        <h3 id="acc-switch-title" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181b; letter-spacing: -0.02em;">Switch Account</h3>
                        <p style="margin: 0.1rem 0 0 0; font-size: 0.78rem; color: #71717a;">Select or add an account to continue</p>
                    </div>
                </div>
                <button type="button" class="icon-btn" id="close-account-switcher" aria-label="Close" style="font-size: 1.35rem; cursor: pointer; background: none; border: none; color: #71717a; line-height: 1; padding: 4px 8px; border-radius: 6px; transition: background 0.15s ease;">&times;</button>
            </div>

            <!-- Modal Body: Saved Accounts List -->
            <div style="padding: 1.25rem 1.5rem; max-height: 380px; overflow-y: auto;">
                <div style="font-size: 0.72rem; font-weight: 800; color: #a1a1aa; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.06em;">
                    Accounts on this Device
                </div>
                <div id="account-switcher-list" style="display: flex; flex-direction: column; gap: 0.65rem;">
                    ${savedAccounts.length > 0 ? savedAccounts.map(acc => {
                        const accEmail = (acc.email || '').toLowerCase();
                        const isActive = accEmail && accEmail === currentEmail;
                        const initial = (acc.displayName || acc.email || 'U').charAt(0).toUpperCase();
                        return `
                            <div class="account-card-item ${isActive ? 'active' : ''}" data-email="${acc.email}" style="
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                padding: 0.85rem 1rem;
                                border-radius: 14px;
                                border: 1.5px solid ${isActive ? '#10b981' : '#e4e4e7'};
                                background: ${isActive ? 'rgba(16, 185, 129, 0.05)' : '#ffffff'};
                                transition: all 0.18s ease;
                            ">
                                <div style="display: flex; align-items: center; gap: 0.85rem; overflow: hidden; flex: 1;">
                                    ${acc.photoURL 
                                        ? `<img src="${acc.photoURL}" style="width: 38px; height: 38px; min-width: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #e4e4e7;" alt="${acc.displayName}">` 
                                        : `<div style="width: 38px; height: 38px; min-width: 38px; border-radius: 50%; background: linear-gradient(135deg, #27272a 0%, #18181b 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">${initial}</div>`
                                    }
                                    <div style="overflow: hidden; flex: 1;">
                                        <div style="font-weight: 700; font-size: 0.9rem; color: #18181b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${acc.displayName || acc.email}</div>
                                        <div style="font-size: 0.78rem; color: #71717a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${acc.email}</div>
                                    </div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.45rem;">
                                    ${isActive 
                                        ? `<span style="font-size: 0.72rem; font-weight: 800; color: #059669; background: rgba(16, 185, 129, 0.15); padding: 0.25rem 0.6rem; border-radius: 999px; display: inline-flex; align-items: center; gap: 3px;">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Active
                                           </span>` 
                                        : `<button type="button" class="btn btn-xs switch-to-acc-btn" data-email="${acc.email}" style="padding: 0.35rem 0.75rem; font-weight: 700; font-size: 0.78rem; border-radius: 8px; background: #18181b; color: #ffffff; border: none; cursor: pointer;">Switch</button>
                                           <button type="button" class="btn-remove-acc" data-email="${acc.email}" title="Remove from this device" style="background: none; border: none; color: #a1a1aa; cursor: pointer; padding: 4px; font-size: 1rem; line-height: 1; transition: color 0.15s ease;">&times;</button>`
                                    }
                                </div>
                            </div>
                        `;
                    }).join('') : `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; border-radius: 14px; border: 1.5px solid #10b981; background: rgba(16, 185, 129, 0.05);">
                            <div style="display: flex; align-items: center; gap: 0.85rem; overflow: hidden;">
                                <div style="width: 38px; height: 38px; min-width: 38px; border-radius: 50%; background: #18181b; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700;">${(currentEmail || 'U').charAt(0).toUpperCase()}</div>
                                <div>
                                    <div style="font-weight: 700; font-size: 0.9rem; color: #18181b;">${resolvedUser?.displayName || currentEmail || 'Current Session'}</div>
                                    <div style="font-size: 0.78rem; color: #71717a;">${currentEmail || 'Active'}</div>
                                </div>
                            </div>
                            <span style="font-size: 0.72rem; font-weight: 800; color: #059669; background: rgba(16, 185, 129, 0.15); padding: 0.25rem 0.6rem; border-radius: 999px;">Active</span>
                        </div>
                    `}
                </div>
            </div>

            <!-- Modal Footer: Actions -->
            <div style="padding: 1.25rem 1.5rem; border-top: 1px solid #f1f5f9; background: #fafafa; display: flex; flex-direction: column; gap: 0.75rem;">
                <button type="button" id="btn-add-new-account" class="btn btn-block" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem; font-weight: 700; font-size: 0.88rem; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); color: #ffffff; border-radius: 12px; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.12);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Add / Switch Account</span>
                </button>
                <div style="display: flex; gap: 0.5rem; justify-content: space-between;">
                    <button type="button" id="btn-signout-current" class="btn btn-xs" style="flex: 1; padding: 0.45rem; font-size: 0.76rem; font-weight: 700; color: #ef4444; background: #ffffff; border: 1px solid #fecdd3; border-radius: 8px; cursor: pointer;">Sign Out Current</button>
                    <button type="button" id="btn-signout-all" class="btn btn-xs" style="flex: 1; padding: 0.45rem; font-size: 0.76rem; font-weight: 600; color: #71717a; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; cursor: pointer;">Clear &amp; Sign Out All</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Close Actions
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
            addBtn.innerHTML = '<span>Connecting to Google...</span>';
            try {
                await authService.loginWithGoogle(true);
                overlay.remove();
                window.location.reload();
            } catch (err) {
                console.error("Account switch failed:", err);
                showAlert.error('Could not connect to the selected Google account. Please try again.');
                addBtn.disabled = false;
                addBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>Add / Switch Account</span>';
            }
        };
    }

    // Switch account item clicks with custom confirmation dialog
    overlay.querySelectorAll('.switch-to-acc-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const targetEmail = btn.getAttribute('data-email') || '';
            const confirmed = await showAlert.confirm(
                `Would you like to switch your active session to ${targetEmail}?`,
                'Switch Account Session',
                { confirmText: 'Switch Session', cancelText: 'Cancel', isDestructive: false }
            );
            if (!confirmed) return;

            btn.disabled = true;
            btn.textContent = 'Switching...';
            try {
                await authService.loginWithGoogle(true);
                overlay.remove();
                window.location.reload();
            } catch (err) {
                showAlert.error('Account switch failed. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Switch';
            }
        };
    });

    // Remove single account from device registry
    overlay.querySelectorAll('.btn-remove-acc').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const targetEmail = btn.getAttribute('data-email') || '';
            const confirmed = await showAlert.confirm(
                `Remove "${targetEmail}" from this device's saved accounts?`,
                'Remove Saved Account',
                { confirmText: 'Remove', cancelText: 'Keep', isDestructive: true }
            );
            if (confirmed) {
                authService.removeSavedAccount(targetEmail);
                overlay.remove();
                openAccountSwitcherModal(currentUser);
                showAlert.info(`Account "${targetEmail}" removed from this device.`);
            }
        };
    });

    // Sign out current with custom alert dialog
    const signoutCurrentBtn = overlay.querySelector('#btn-signout-current');
    if (signoutCurrentBtn) {
        signoutCurrentBtn.onclick = async () => {
            const confirmed = await showAlert.confirm(
                `Are you sure you want to sign out of ${currentEmail || 'this account'}?`,
                'Sign Out Confirmation',
                { confirmText: 'Sign Out', cancelText: 'Stay', isDestructive: true }
            );
            if (confirmed) {
                overlay.remove();
                await authService.logout();
            }
        };
    }

    // Sign out all with custom alert dialog
    const signoutAllBtn = overlay.querySelector('#btn-signout-all');
    if (signoutAllBtn) {
        signoutAllBtn.onclick = async () => {
            const confirmed = await showAlert.confirm(
                'Are you sure you want to clear and sign out all saved accounts on this device?',
                'Clear All Saved Accounts',
                { confirmText: 'Clear & Sign Out All', cancelText: 'Cancel', isDestructive: true }
            );
            if (confirmed) {
                overlay.remove();
                localStorage.removeItem('pricelister_saved_accounts');
                await authService.logout();
            }
        };
    }
};

/**
 * Update Landing Page Floating Header Auth State
 * Handles (Login) (Enter Workspace ->) vs Connected User Avatar vs Unconnected Google Avatar + (Create Workspace ->)
 */
export const updateLandingHeaderAuthState = async (user, cachedWorkspace = null) => {
    const loggedOutGroup = document.getElementById('header-auth-logged-out');
    const connectedGroup = document.getElementById('header-auth-connected');
    const notConnectedGroup = document.getElementById('header-auth-not-connected');

    if (!user) {
        if (loggedOutGroup) loggedOutGroup.style.display = 'flex';
        if (connectedGroup) connectedGroup.style.display = 'none';
        if (notConnectedGroup) notConnectedGroup.style.display = 'none';
        return;
    }

    // User is signed in -> Drop/hide logged-out buttons
    if (loggedOutGroup) loggedOutGroup.style.display = 'none';

    let workspace = cachedWorkspace;
    if (workspace === null || workspace === undefined) {
        try {
            workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
        } catch (e) {
            console.warn("Could not check workspace:", e);
            workspace = null;
        }
    }

    if (workspace) {
        // 1. User IS connected to a workspace -> Show rounded photo + Enter Workspace
        if (notConnectedGroup) notConnectedGroup.style.display = 'none';
        if (connectedGroup) connectedGroup.style.display = 'flex';

        const photoEl = document.getElementById('header-avatar-img-connected');
        const initEl = document.getElementById('header-avatar-init-connected');
        if (user.photoURL && photoEl) {
            photoEl.src = user.photoURL;
            photoEl.style.display = 'block';
            if (initEl) initEl.style.display = 'none';
        } else if (initEl) {
            initEl.textContent = ((user.displayName || user.email || 'U').charAt(0)).toUpperCase();
            initEl.style.display = 'flex';
            if (photoEl) photoEl.style.display = 'none';
        }

        const titleEl = document.getElementById('header-connected-ws-title');
        if (titleEl) {
            const wsName = workspace.name || 'Workspace';
            titleEl.innerHTML = `<span>${wsName}</span> &rarr;`;
        }

        const enterLink = document.getElementById('header-btn-enter-connected');
        if (enterLink) {
            enterLink.href = 'app.html';
        }
    } else {
        // 2. User is NOT connected to any workspace yet -> Show Google account icon + (Create Workspace ->)
        if (connectedGroup) connectedGroup.style.display = 'none';
        if (notConnectedGroup) notConnectedGroup.style.display = 'flex';

        const photoEl = document.getElementById('header-avatar-img-unconnected');
        const initEl = document.getElementById('header-avatar-init-unconnected');
        if (user.photoURL && photoEl) {
            photoEl.src = user.photoURL;
            photoEl.style.display = 'block';
            if (initEl) initEl.style.display = 'none';
        } else if (initEl) {
            initEl.textContent = ((user.displayName || user.email || 'G').charAt(0)).toUpperCase();
            initEl.style.display = 'flex';
            if (photoEl) photoEl.style.display = 'none';
        }
    }
};

/**
 * Initialize Landing Page Header Interactive Triggers
 */
export const initLandingHeaderActions = () => {
    // 1. (Login) button: logs in with Google, stays on index.html
    const loginBtn = document.getElementById('header-btn-login');
    if (loginBtn) {
        loginBtn.onclick = async (e) => {
            e.preventDefault();
            try {
                loginBtn.disabled = true;
                loginBtn.style.opacity = '0.7';
                await authService.loginWithGoogle(true);
                showAlert.success('Signed in successfully.');
            } catch (err) {
                console.error("Sign-in error:", err);
                showAlert.error('Sign-in failed. Please try again.');
            } finally {
                loginBtn.disabled = false;
                loginBtn.style.opacity = '1';
            }
        };
    }

    // 2. (Enter Workspace ->) logged-out button
    const enterWsBtn = document.getElementById('header-btn-enter-ws');
    if (enterWsBtn) {
        enterWsBtn.onclick = async (e) => {
            e.preventDefault();
            const currentUser = authService.getCurrentUser();
            if (currentUser) {
                const ws = await firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email);
                if (ws) {
                    window.location.href = 'app.html';
                } else {
                    const setupContainer = document.getElementById('workspace-setup-container');
                    if (setupContainer) {
                        setupContainer.style.display = 'block';
                        setupContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            } else {
                if (typeof window.openLoginModal === 'function') {
                    window.openLoginModal();
                } else {
                    await authService.loginWithGoogle(true);
                }
            }
        };
    }

    // 3. (Create Workspace ->) button for unconnected user: opens workspace setup panel
    const createWsBtn = document.getElementById('header-btn-create-ws');
    if (createWsBtn) {
        createWsBtn.onclick = (e) => {
            e.preventDefault();
            const setupContainer = document.getElementById('workspace-setup-container');
            if (setupContainer) {
                setupContainer.style.display = 'block';
                setupContainer.scrollIntoView({ behavior: 'smooth' });
            }
        };
    }

    // 4. Sign out buttons in header
    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        const confirmed = await showAlert.confirm(
            'Are you sure you want to log out of your account?',
            'Logout Confirmation',
            { confirmText: 'Logout', cancelText: 'Cancel', isDestructive: true }
        );
        if (confirmed) {
            await authService.logout();
        }
    };

    const logoutConnected = document.getElementById('header-btn-logout-connected');
    if (logoutConnected) logoutConnected.onclick = handleLogout;

    const logoutUnconnected = document.getElementById('header-btn-logout-unconnected');
    if (logoutUnconnected) logoutUnconnected.onclick = handleLogout;
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

    if (pageType === 'index') {
        initLandingHeaderActions();
    }

    authService.onAuthStateChanged(async (user) => {
        if (pageType === 'index') {
            const launcherContainer = document.getElementById('workspace-launcher-container');
            document.body.classList.remove('app-loading');
            if (loader) loader.style.display = 'none';
            if (authContainer) authContainer.style.display = 'block';
            if (launcherContainer) launcherContainer.style.display = 'none';
            if (setupContainer) setupContainer.style.display = 'none';

            if (user) {
                // If logged in on public page, check if workspace exists
                try {
                    const workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                    await updateLandingHeaderAuthState(user, workspace);

                    if (workspace) {
                        // User has a workspace: Keep landing page visible, populate launcher DOM elements
                        if (launcherContainer) {
                            const nameEl = document.getElementById('launcher-workspace-name');
                            if (nameEl) nameEl.textContent = workspace.name || 'Your Workspace';

                            // Banner Cover
                            const coverBanner = document.getElementById('launcher-cover-banner');
                            if (coverBanner) {
                                if (workspace.bannerUrl) {
                                    coverBanner.style.backgroundImage = `linear-gradient(180deg, rgba(15, 23, 42, 0.3) 0%, rgba(15, 23, 42, 0.88) 100%), url('${workspace.bannerUrl}')`;
                                } else {
                                    coverBanner.style.backgroundImage = 'linear-gradient(135deg, #09090b 0%, #1e293b 100%)';
                                }
                            }

                            // Workspace Logo & Fallback
                            const logoImg = document.getElementById('launcher-workspace-logo');
                            const logoFallback = document.getElementById('launcher-workspace-logo-fallback');
                            if (workspace.logoUrl && logoImg) {
                                logoImg.src = workspace.logoUrl;
                                logoImg.style.display = 'block';
                                if (logoFallback) logoFallback.style.display = 'none';
                            } else if (logoFallback) {
                                logoFallback.textContent = ((workspace.name || 'W').charAt(0)).toUpperCase();
                                logoFallback.style.display = 'flex';
                                if (logoImg) logoImg.style.display = 'none';
                            }
                            
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
                            const wsIdStr = workspace.workspaceId || workspace.id;
                            if (idEl) idEl.textContent = wsIdStr;
                            
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

                            // Workspace Size (Members Count)
                            const sizeEl = document.getElementById('launcher-workspace-size');
                            if (sizeEl) {
                                const memberCount = (workspace.members && Array.isArray(workspace.members)) 
                                    ? workspace.members.length 
                                    : (workspace.workersCount || workspace.memberCount || 1);
                                sizeEl.textContent = `${memberCount} Member${memberCount === 1 ? '' : 's'}`;
                            }

                            // Copy Workspace ID
                            const copyBtn = document.getElementById('launcher-copy-id-btn');
                            if (copyBtn) {
                                copyBtn.onclick = () => {
                                    navigator.clipboard.writeText(wsIdStr).then(() => {
                                        showAlert.success(`Workspace ID "${wsIdStr}" copied to clipboard!`);
                                    }).catch(() => {
                                        showAlert.info(`Workspace ID: ${wsIdStr}`);
                                    });
                                };
                            }

                            // Header Titles & Blocked State Notice
                            const launcherCard = launcherContainer.querySelector('.workspace-found-card');
                            const titleEl = launcherCard ? launcherCard.querySelector('h1') : null;
                            const descEl = launcherCard ? launcherCard.querySelector('p') : null;
                            const enterBtn = document.getElementById('launcher-enter-btn');

                            // Ensure Admin Email row exists
                            let adminRow = document.getElementById('launcher-admin-email-row');
                            if (!adminRow) {
                                const kvContainer = launcherContainer.querySelector('div[style*="display: flex; flex-direction: column; gap: 0.85rem"]');
                                if (kvContainer) {
                                    adminRow = document.createElement('div');
                                    adminRow.id = 'launcher-admin-email-row';
                                    adminRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
                                    adminRow.innerHTML = `
                                        <span style="color:#64748b; font-weight:600; font-size:0.85rem;">Admin:</span>
                                        <span id="launcher-admin-email-text" style="font-weight:700; color:#0f172a; font-size:0.86rem;">${workspace.adminEmail || 'Administrator'}</span>
                                    `;
                                    kvContainer.insertBefore(adminRow, kvContainer.firstChild);
                                }
                            } else {
                                const aText = document.getElementById('launcher-admin-email-text');
                                if (aText) aText.textContent = workspace.adminEmail || 'Administrator';
                            }

                            // Dynamic Duration Row for Temporary Revocation
                            let durationRow = document.getElementById('launcher-duration-row');
                            if (workspace.isAccessBlocked) {
                                if (titleEl) {
                                    titleEl.innerHTML = `<span style="color:#e11d48; display:inline-flex; align-items:center; gap:8px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Temporary Access Blocked</span>`;
                                }
                                if (descEl) {
                                    descEl.innerHTML = `Access to this workspace is currently suspended by workspace administration.`;
                                    descEl.style.color = '#e11d48';
                                    descEl.style.fontWeight = '700';
                                }

                                if (!durationRow) {
                                    const kvContainer = launcherContainer.querySelector('div[style*="display: flex; flex-direction: column; gap: 0.85rem"]');
                                    if (kvContainer) {
                                        durationRow = document.createElement('div');
                                        durationRow.id = 'launcher-duration-row';
                                        durationRow.style.cssText = 'display:flex; flex-direction:column; gap:0.25rem; background:#fee2e2; padding:0.75rem 0.9rem; border-radius:12px; border:1.5px solid #fecdd3; margin-top:0.4rem;';
                                        durationRow.innerHTML = `
                                            <span style="color:#991b1b; font-weight:700; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em;">Access Block Duration:</span>
                                            <span id="launcher-block-duration-text" style="color:#7f1d1d; font-weight:800; font-size:0.82rem; font-family:monospace;">
                                                ${workspace.revokeStartFormatted || 'Immediate'} — ${workspace.revokeEndFormatted || 'Indefinite'}
                                            </span>
                                        `;
                                        kvContainer.appendChild(durationRow);
                                    }
                                } else {
                                    const dText = document.getElementById('launcher-block-duration-text');
                                    if (dText) dText.textContent = `${workspace.revokeStartFormatted || 'Immediate'} — ${workspace.revokeEndFormatted || 'Indefinite'}`;
                                    durationRow.style.display = 'flex';
                                }

                                // Hard Lock Enter Workspace Button
                                if (enterBtn) {
                                    enterBtn.disabled = true;
                                    enterBtn.style.background = '#94a3b8';
                                    enterBtn.style.cursor = 'not-allowed';
                                    enterBtn.style.boxShadow = 'none';
                                    enterBtn.innerHTML = `
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                        <span>Temporary Access Blocked</span>
                                    `;
                                    enterBtn.onclick = (e) => {
                                        e.preventDefault();
                                        showAlert.error(`Access Blocked: Your access is suspended until ${workspace.revokeEndFormatted || 'the duration expires'}. Please contact ${workspace.adminEmail || 'the workspace admin'}.`);
                                    };
                                }
                            } else {
                                if (titleEl) titleEl.textContent = 'Workspace Found';
                                if (descEl) {
                                    descEl.textContent = 'Ready to manage your business.';
                                    descEl.style.color = '#64748b';
                                    descEl.style.fontWeight = '500';
                                }
                                if (durationRow) durationRow.style.display = 'none';

                                if (enterBtn) {
                                    enterBtn.disabled = false;
                                    enterBtn.style.background = '#09090b';
                                    enterBtn.style.cursor = 'pointer';
                                    enterBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
                                    enterBtn.innerHTML = `
                                        <span>Enter Workspace</span>
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                    `;
                                    enterBtn.onclick = () => {
                                        window.location.href = 'app.html';
                                    };
                                }
                            }

                            // Switch Account Button on Launcher Card
                            const launcherChangeAccBtn = document.getElementById('launcher-change-account-btn');
                            if (launcherChangeAccBtn) {
                                launcherChangeAccBtn.onclick = (e) => {
                                    e.preventDefault();
                                    openAccountSwitcherModal(user);
                                };
                            }

                            // Logout Button on Launcher Card
                            const launcherLogoutBtn = document.getElementById('launcher-logout-btn');
                            if (launcherLogoutBtn) {
                                launcherLogoutBtn.onclick = async () => {
                                    const confirmed = await showAlert.confirm(
                                        'Are you sure you want to log out of your account?',
                                        'Logout Confirmation',
                                        { confirmText: 'Logout', cancelText: 'Cancel', isDestructive: true }
                                    );
                                    if (confirmed) {
                                        await authService.logout();
                                    }
                                };
                            }
                        }
                    } else {
                        // NO WORKSPACE FOUND: Keep landing page visible, populate setup DOM elements
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (authContainer) authContainer.style.display = 'block';
                        if (launcherContainer) launcherContainer.style.display = 'none';
                        if (setupContainer) setupContainer.style.display = 'none';
                        
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
                        
                        // Dedicated Mailbox & Invitations Area
                        const section = document.getElementById('pending-invites-section');
                        const list = document.getElementById('pending-invites-list');
                        const emptyState = document.getElementById('mailbox-empty-state');
                        const badgeCount = document.getElementById('mailbox-badge-count');

                        if (section) section.style.display = 'block';

                        let invites = [];
                        if (user.email) {
                            try {
                                invites = await firestoreService.getPendingInvites(user.email);
                            } catch (e) {
                                console.warn("Could not fetch invites:", e);
                            }
                        }

                        if (badgeCount) {
                            badgeCount.textContent = `${invites.length} Request${invites.length === 1 ? '' : 's'}`;
                        }

                        if (invites && invites.length > 0) {
                            if (list) {
                                list.style.display = 'flex';
                                list.innerHTML = invites.map(inv => `
                                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 1.15rem 1.35rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03); gap: 1rem; flex-wrap: wrap;">
                                        <div>
                                            <strong style="display:block; color: #0f172a; font-size:1.05rem; font-weight:800;">${inv.workspaceName || 'PriceLister Workspace'}</strong>
                                            <div style="color: #64748b; font-size:0.84rem; margin-top:0.25rem; display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                                <span>Invited by: <strong style="color:#334155;">${inv.adminEmail}</strong></span>
                                                <span>&bull;</span>
                                                <span>Role: <span class="badge-role badge-role-worker" style="padding: 0.15rem 0.5rem; border-radius: 999px;">${inv.role || 'Worker'}</span></span>
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 0.6rem; align-items: center;">
                                            <button type="button" class="btn btn-sm accept-invite-btn" data-id="${inv.id}" style="font-weight:700; padding:0.5rem 1.1rem; background:#09090b; color:#ffffff; border-radius:8px; border:none; cursor:pointer;">Join Workspace</button>
                                            <button type="button" class="btn btn-sm btn-outline reject-invite-btn" data-id="${inv.id}" style="padding:0.5rem 0.85rem; font-weight:600; border-radius:8px; border:1px solid #e2e8f0; background:#ffffff; color:#64748b; cursor:pointer;">Decline</button>
                                        </div>
                                    </div>
                                `).join('');

                                // Attach Join & Decline Events
                                list.querySelectorAll('.accept-invite-btn').forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        const id = btn.getAttribute('data-id');
                                        const invite = invites.find(i => i.id === id);
                                        try {
                                            btn.disabled = true;
                                            btn.textContent = 'Joining...';
                                            await firestoreService.acceptWorkspaceInvite(invite, user);
                                            window.location.href = 'app.html';
                                        } catch (err) {
                                            btn.disabled = false;
                                            btn.textContent = 'Join Workspace';
                                            showAlert.error("Failed to join workspace.");
                                        }
                                    });
                                });

                                list.querySelectorAll('.reject-invite-btn').forEach(btn => {
                                    btn.addEventListener('click', async (e) => {
                                        const id = btn.getAttribute('data-id');
                                        try {
                                            btn.disabled = true;
                                            btn.textContent = '...';
                                            await firestoreService.rejectWorkspaceInvite(id);
                                            btn.closest('div[style*="background: #ffffff"]')?.remove();
                                            invites = invites.filter(i => i.id !== id);
                                            if (badgeCount) {
                                                badgeCount.textContent = `${invites.length} Request${invites.length === 1 ? '' : 's'}`;
                                            }
                                            if (invites.length === 0) {
                                                list.style.display = 'none';
                                                if (emptyState) emptyState.style.display = 'block';
                                            }
                                        } catch (err) {
                                            btn.disabled = false;
                                            btn.textContent = 'Decline';
                                            showAlert.error("Failed to decline invite.");
                                        }
                                    });
                                });
                            }
                            if (emptyState) emptyState.style.display = 'none';
                        } else {
                            if (list) {
                                list.style.display = 'none';
                                list.innerHTML = '';
                            }
                            if (emptyState) emptyState.style.display = 'block';
                        }
                        
                        if (setupContainer && setupContainer.getAttribute('data-explicit-show') === 'true') {
                            setupContainer.style.display = 'block';
                        } else if (setupContainer) {
                            setupContainer.style.display = 'none';
                        }

                        // Setup Account Actions
                        const setupChangeAccBtn = document.getElementById('setup-change-account-btn');
                        if (setupChangeAccBtn) {
                            setupChangeAccBtn.onclick = (e) => {
                                e.preventDefault();
                                openAccountSwitcherModal(user);
                            };
                        }

                        const setupLogoutBtn = document.getElementById('setup-logout-btn');
                        if (setupLogoutBtn) {
                            setupLogoutBtn.onclick = async () => {
                                const confirmed = await showAlert.confirm(
                                    'Are you sure you want to log out of your account?',
                                    'Logout Confirmation',
                                    { confirmText: 'Logout', cancelText: 'Cancel', isDestructive: true }
                                );
                                if (confirmed) {
                                    await authService.logout();
                                }
                            };
                        }
                    }
                } catch (error) {
                    console.error("Auth check error:", error);
                    showAlert.error('Error checking account status. Please check connection.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                    if (authContainer) authContainer.style.display = 'block';
                }
            } else {
                // Not logged in -> show landing page content & logged-out header actions
                document.body.classList.remove('app-loading');
                if (loader) loader.style.display = 'none';
                if (authContainer) authContainer.style.display = 'block';
                if (setupContainer) setupContainer.style.display = 'none';
                if (launcherContainer) launcherContainer.style.display = 'none';
                await updateLandingHeaderAuthState(null);
            }
        } else if (pageType === 'app') {
            const isLocalHost = typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:'
            );
            const isDemoRequest = localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock' || 
                                  localStorage.getItem('pricelister_active_ws') === 'demo' || 
                                  Boolean(localStorage.getItem('mock_dev_session')) ||
                                  (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo')) ||
                                  (isLocalHost && (!localStorage.getItem('pricelister_active_ws') || localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock'));

            let activeUser = user;
            if (!activeUser && (isDemoRequest || isLocalHost)) {
                console.log("[PriceLister] Activating Demo Admin session for testing & development.");
                activeUser = {
                    uid: 'dev-mock-uid',
                    email: 'developer@local.test',
                    displayName: 'Demo Admin (Testing)',
                    photoURL: null,
                    role: 'CREATOR_ADMIN'
                };
                localStorage.setItem('pricelister_active_ws', 'ws_dev_mock');
                localStorage.setItem('mock_dev_session', JSON.stringify(activeUser));
            }

            if (activeUser) {
                try {
                    let workspace = await firestoreService.checkWorkspaceExists(activeUser.uid, activeUser.email);
                    if (!workspace && localStorage.getItem('pricelister_active_ws')) {
                        localStorage.removeItem('pricelister_active_ws');
                        workspace = await firestoreService.checkWorkspaceExists(activeUser.uid, activeUser.email);
                    }
                    if (!workspace && isDemoRequest) {
                        workspace = await firestoreService.checkWorkspaceExists('dev-mock-uid', 'developer@local.test');
                    }
                    if (!workspace) {
                        // Cannot be in app without workspace -> redirect to index for setup
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (typeof window.__dismissWorkspaceLoader === 'function') window.__dismissWorkspaceLoader('no_workspace');
                        window.location.href = 'index.html';
                        return;
                    }

                    // Maximum Protection Security Guard: Temporary Access Blocked
                    if (workspace.isAccessBlocked) {
                        console.warn("[PriceLister Security] User access is temporarily blocked. Ejecting to launcher.");
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (typeof window.__dismissWorkspaceLoader === 'function') window.__dismissWorkspaceLoader('access_blocked');
                        showAlert.error(`Access Blocked: Your access is suspended until ${workspace.revokeEndFormatted || 'the duration expires'}. Please contact ${workspace.adminEmail || 'the workspace admin'}.`);
                        setTimeout(() => {
                            window.location.href = 'index.html';
                        }, 450);
                        return;
                    }
                    if (workspace.currency || workspace.currencySymbol) {
                        setAppCurrencySymbol(workspace.currency || workspace.currencySymbol);
                    }
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                    if (shell) shell.style.display = 'flex';
                    if (typeof window.__dismissWorkspaceLoader === 'function') {
                        window.__dismissWorkspaceLoader('workspace_loaded');
                    }
                    
                    // Update bottom-left UI with user profile info
                    const userEmailEl = document.getElementById('user-email');
                    if (userEmailEl) userEmailEl.textContent = activeUser.email;

                    const userRoleEl = document.getElementById('user-role');
                    formatRoleBadge(workspace.role, userRoleEl);

                    const userPhoto = document.getElementById('user-picture');
                    const userAvatar = document.getElementById('user-avatar');
                    if (activeUser.photoURL && userPhoto) {
                        userPhoto.src = activeUser.photoURL;
                        userPhoto.style.display = 'block';
                        if (userAvatar) userAvatar.style.display = 'none';
                    } else if (userAvatar) {
                        userAvatar.textContent = (activeUser.email || 'U').charAt(0).toUpperCase();
                        userAvatar.style.display = 'flex';
                        if (userPhoto) userPhoto.style.display = 'none';
                    }

                    // Setup Realtime Role Listener
                    if (roleListenerUnsub) roleListenerUnsub();
                    roleListenerUnsub = firestoreService.listenToUserRole(activeUser.uid, activeUser.email, (newRole) => {
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
                    if (activeUser.uid === 'dev-mock-uid') {
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

                    try {
                        initGlobalSearch(workspace.id);
                    } catch (e) {
                        console.warn("Global search initialization warning:", e);
                    }
                    try {
                        renderTopbarAdminProfile(activeUser, workspace);
                    } catch (e) {
                        console.warn("Topbar profile rendering warning:", e);
                    }

                    if (!routerInitialized) {
                        initRouter(workspace.id);
                        routerInitialized = true;
                    }
                } catch (error) {
                    console.error("Workspace load error:", error);
                    showAlert.error('Error loading workspace.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                    if (shell) shell.style.display = 'flex';
                    if (typeof window.__dismissWorkspaceLoader === 'function') {
                        window.__dismissWorkspaceLoader('error_dismiss');
                    }
                }
            } else {
                document.body.classList.remove('app-loading');
                if (loader) loader.style.display = 'none';
                if (typeof window.__dismissWorkspaceLoader === 'function') {
                    window.__dismissWorkspaceLoader('unauthenticated_redirect');
                }
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
        const currentColorMode = document.documentElement.getAttribute('data-color-mode') || localStorage.getItem('pricelister_color_mode') || 'light';

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
            <div class="topbar-profile-pill" id="topbar-profile-pill-trigger" title="Workspace Profile & Settings">
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
                        <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--surface-100); color: var(--text-primary); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; flex-shrink: 0; border: 1px solid var(--border-color);">
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

                <!-- Themes Toggle Drawer (Holds all 4 appearance modes as vertical list with active indicator) -->
                <div style="padding: 0.35rem 0.65rem 0.55rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.4rem;">
                    <!-- Drawer Header / Toggle Button -->
                    <button type="button" id="appearance-drawer-toggle-btn" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.65rem; background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 9px; cursor: pointer; transition: all 0.15s ease;">
                        <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                            <span style="font-weight: 800; font-size: 0.78rem; color: var(--text-primary);">Theme &amp; Mode</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span id="drawer-active-theme-label" style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--surface-100); border: 1px solid var(--border-color); color: var(--text-primary); text-transform: capitalize;">
                                ${currentColorMode === 'deep-dark' ? 'Deep Dark' : currentColorMode}
                            </span>
                            <svg id="drawer-chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition: transform 0.2s ease; transform: rotate(0deg);"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                    </button>

                    <!-- Drawer List: All 4 Themes in List, Showing which theme is active (By default closed) -->
                    <div id="appearance-drawer-list" style="display: none; flex-direction: column; gap: 3px; margin-top: 0.35rem; background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 9px; padding: 0.35rem; transition: max-height 0.2s ease;">
                        
                        <!-- 1. Light Mode -->
                        <button type="button" class="theme-drawer-item ${currentColorMode === 'light' ? 'active' : ''}" data-mode="light" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.6rem; border-radius: 7px; border: 1px solid ${currentColorMode === 'light' ? 'var(--text-primary)' : 'transparent'}; background: ${currentColorMode === 'light' ? 'var(--surface-100)' : 'transparent'}; color: var(--text-primary); cursor: pointer; text-align: left; transition: all 0.15s ease;">
                            <div style="display: flex; align-items: center; gap: 0.55rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                <div>
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">Light Mode</div>
                                    <div style="font-size: 0.66rem; color: var(--text-secondary);">Minimal soft white</div>
                                </div>
                            </div>
                            <span class="drawer-check" style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); visibility: ${currentColorMode === 'light' ? 'visible' : 'hidden'};">✓</span>
                        </button>

                        <!-- 2. Dark Mode -->
                        <button type="button" class="theme-drawer-item ${currentColorMode === 'dark' ? 'active' : ''}" data-mode="dark" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.6rem; border-radius: 7px; border: 1px solid ${currentColorMode === 'dark' ? 'var(--text-primary)' : 'transparent'}; background: ${currentColorMode === 'dark' ? 'var(--surface-100)' : 'transparent'}; color: var(--text-primary); cursor: pointer; text-align: left; transition: all 0.15s ease;">
                            <div style="display: flex; align-items: center; gap: 0.55rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                <div>
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">Dark Mode</div>
                                    <div style="font-size: 0.66rem; color: var(--text-secondary);">Executive smooth charcoal</div>
                                </div>
                            </div>
                            <span class="drawer-check" style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); visibility: ${currentColorMode === 'dark' ? 'visible' : 'hidden'};">✓</span>
                        </button>

                        <!-- 3. Deep Dark Mode -->
                        <button type="button" class="theme-drawer-item ${currentColorMode === 'deep-dark' ? 'active' : ''}" data-mode="deep-dark" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.6rem; border-radius: 7px; border: 1px solid ${currentColorMode === 'deep-dark' ? 'var(--text-primary)' : 'transparent'}; background: ${currentColorMode === 'deep-dark' ? 'var(--surface-100)' : 'transparent'}; color: var(--text-primary); cursor: pointer; text-align: left; transition: all 0.15s ease;">
                            <div style="display: flex; align-items: center; gap: 0.55rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3"></rect></svg>
                                <div>
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">Deep Dark Mode</div>
                                    <div style="font-size: 0.66rem; color: var(--text-secondary);">Pure pitch black AMOLED</div>
                                </div>
                            </div>
                            <span class="drawer-check" style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); visibility: ${currentColorMode === 'deep-dark' ? 'visible' : 'hidden'};">✓</span>
                        </button>

                        <!-- 4. Auto System Mode -->
                        <button type="button" class="theme-drawer-item ${currentColorMode === 'system' ? 'active' : ''}" data-mode="system" style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.6rem; border-radius: 7px; border: 1px solid ${currentColorMode === 'system' ? 'var(--text-primary)' : 'transparent'}; background: ${currentColorMode === 'system' ? 'var(--surface-100)' : 'transparent'}; color: var(--text-primary); cursor: pointer; text-align: left; transition: all 0.15s ease;">
                            <div style="display: flex; align-items: center; gap: 0.55rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                <div>
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">Auto System</div>
                                    <div style="font-size: 0.66rem; color: var(--text-secondary);">Sync with device theme</div>
                                </div>
                            </div>
                            <span class="drawer-check" style="font-size: 0.8rem; font-weight: 800; color: var(--text-primary); visibility: ${currentColorMode === 'system' ? 'visible' : 'hidden'};">✓</span>
                        </button>

                    </div>
                </div>

                <!-- Critical Board Action Hero (Added per Reference Image) -->
                <div style="padding: 0.45rem 0.65rem 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 0.4rem;">
                    <button type="button" id="topbar-open-critical-board-btn" style="width: 100%; border: 1px solid var(--border-color); background: var(--surface-50); display: flex; align-items: center; justify-content: space-between; padding: 0.55rem 0.75rem; border-radius: 9px; cursor: pointer; text-align: left; transition: all 0.18s ease;">
                        <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="width: 28px; height: 28px; border-radius: 7px; background: var(--surface-100); color: var(--text-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-color);">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            </div>
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: var(--text-primary); line-height: 1.2;">Critical Board</div>
                                <div style="font-size: 0.68rem; color: var(--text-secondary);">Custom Fonts &amp; Layout</div>
                            </div>
                        </div>
                        <span style="font-size: 0.62rem; font-weight: 800; background: var(--text-primary); color: var(--surface-main); padding: 2px 6px; border-radius: 999px;">Custom</span>
                    </button>
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

                    <button type="button" id="topbar-logout-btn" class="topbar-dropdown-item" style="width: 100%; border: none; background: none; text-align: left; display: flex; align-items: center; gap: 0.65rem; padding: 0.45rem 0.65rem; border-radius: 8px; color: var(--text-primary); font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: background 0.15s ease;">
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
        const cbBtn = group.querySelector('#topbar-open-critical-board-btn');
        const switchAccBtn = group.querySelector('#topbar-switch-acc-btn');
        const logoutBtn = group.querySelector('#topbar-logout-btn');

        // Appearance Mode Drawer Toggle (By default closed)
        const drawerToggleBtn = group.querySelector('#appearance-drawer-toggle-btn');
        const drawerList = group.querySelector('#appearance-drawer-list');
        const drawerChevron = group.querySelector('#drawer-chevron-icon');

        if (drawerToggleBtn && drawerList) {
            drawerToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isExpanded = drawerList.style.display === 'flex';
                drawerList.style.display = isExpanded ? 'none' : 'flex';
                if (drawerChevron) {
                    drawerChevron.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
                }
            });
        }

        // Appearance Mode: List Item Selection with Active Indicator & Badge Sync
        group.querySelectorAll('.theme-drawer-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mode = e.currentTarget.getAttribute('data-mode');
                document.documentElement.setAttribute('data-color-mode', mode);
                localStorage.setItem('pricelister_color_mode', mode);

                // Update List items active state
                group.querySelectorAll('.theme-drawer-item').forEach(b => {
                    const isThis = b.getAttribute('data-mode') === mode;
                    b.classList.toggle('active', isThis);
                    b.style.borderColor = isThis ? 'var(--text-primary)' : 'transparent';
                    b.style.background = isThis ? 'var(--surface-100)' : 'transparent';
                    const check = b.querySelector('.drawer-check');
                    if (check) check.style.visibility = isThis ? 'visible' : 'hidden';
                });

                // Update Active Badge in Drawer Header
                const activeLabel = group.querySelector('#drawer-active-theme-label');
                if (activeLabel) {
                    activeLabel.textContent = mode === 'deep-dark' ? 'Deep Dark' : mode;
                }

                window.dispatchEvent(new CustomEvent('pricelister-color-mode-changed', { detail: { mode } }));
                window.dispatchEvent(new CustomEvent('pricelister-theme-changed', { detail: { colorMode: mode } }));
            });
        });

        // Critical Board (Custom Font & Layout) Opener
        if (cbBtn) {
            cbBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dropdown) dropdown.classList.remove('show');
                if (typeof window.openCriticalBoard === 'function') {
                    window.openCriticalBoard('font');
                } else if (typeof openCriticalBoardModal === 'function') {
                    openCriticalBoardModal('font');
                }
            });
        }

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
                openAccountSwitcherModal(user);
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

        // Global fallback delegate for Critical Board opener
        if (!window.__cbGlobalListenerAttached) {
            window.__cbGlobalListenerAttached = true;
            document.addEventListener('click', (e) => {
                const cbTrigger = e.target.closest('#topbar-open-critical-board-btn, #nav-item-critical-board, [data-action="open-critical-board"], .open-critical-board-btn');
                if (cbTrigger) {
                    e.preventDefault();
                    e.stopPropagation();
                    const dd = document.getElementById('topbar-profile-dropdown-menu');
                    if (dd) dd.classList.remove('show');
                    if (typeof window.openCriticalBoard === 'function') {
                        window.openCriticalBoard('font');
                    } else if (typeof openCriticalBoardModal === 'function') {
                        openCriticalBoardModal('font');
                    }
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
        const wsCountrySelect = document.getElementById('ws-country');
        const wsRegionInput = document.getElementById('ws-region');
        const wsCurrencySelect = document.getElementById('ws-currency-select');

        // Populate Countries (Name, Flag, Code)
        if (wsCountrySelect) {
            wsCountrySelect.innerHTML = '<option value="">Select country...</option>';
            COUNTRIES_LIST.forEach(country => {
                const opt = document.createElement('option');
                opt.value = country.name;
                opt.textContent = `${country.flag} ${country.name} (${country.code})`;
                opt.dataset.countryCode = country.code;
                opt.dataset.defaultCurrency = country.defaultCurrency;
                opt.dataset.defaultSymbol = country.defaultSymbol;
                opt.dataset.region = country.region || '';
                wsCountrySelect.appendChild(opt);
            });
        }

        // Populate Currencies (Code, Full Name, Symbol, Flag)
        if (wsCurrencySelect) {
            wsCurrencySelect.innerHTML = '<option value="">Select currency...</option>';
            CURRENCY_LIST.forEach(curr => {
                const opt = document.createElement('option');
                opt.value = curr.code;
                opt.textContent = `${curr.flag} ${curr.code} — ${curr.name} (${curr.symbol})`;
                opt.dataset.currencyCode = curr.code;
                opt.dataset.currencyName = curr.name;
                opt.dataset.currencySymbol = curr.symbol;
                wsCurrencySelect.appendChild(opt);
            });
        }

        // Workspace Logo Handling
        let selectedWsLogoFile = null;
        let wsLogoDataUrl = '';
        const wsLogoFileInput = document.getElementById('ws-logo-file-input');
        const wsLogoUrlInput = document.getElementById('ws-logo-url-input');
        const btnWsChooseLogo = document.getElementById('btn-ws-choose-logo');
        const btnWsRemoveLogo = document.getElementById('btn-ws-remove-logo');
        const wsLogoImgPreview = document.getElementById('ws-logo-img-preview');
        const wsLogoEmptyState = document.getElementById('ws-logo-empty-state');
        const wsLogoBox = document.getElementById('ws-logo-preview-box');
        const wsLogoDropzone = document.getElementById('ws-logo-dropzone');
        const dropPrompt = document.getElementById('ws-logo-drop-prompt');

        // Workspace Banner Handling
        let selectedWsBannerFile = null;
        let wsBannerDataUrl = '';
        const wsBannerFileInput = document.getElementById('ws-banner-file-input');
        const wsBannerUrlInput = document.getElementById('ws-banner-url-input');
        const btnWsChooseBanner = document.getElementById('btn-ws-choose-banner');
        const btnWsRemoveBanner = document.getElementById('btn-ws-remove-banner');
        const btnWsPickInternetBanner = document.getElementById('btn-ws-pick-internet-banner');
        const wsBannerDropzone = document.getElementById('ws-banner-dropzone');
        const bannerDropPrompt = document.getElementById('ws-banner-drop-prompt');

        const processImageFile = (file, maxDim = 1200) => {
            return new Promise((resolve, reject) => {
                if (!file || !file.type.startsWith('image/')) {
                    reject(new Error('Please select a valid image file (PNG, JPG, WEBP).'));
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
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

        const handleLogoSelection = async (file) => {
            if (!file) return;
            try {
                if (dropPrompt) dropPrompt.innerHTML = `<strong>Processing logo...</strong>`;
                const { file: optimizedFile, dataUrl } = await processImageFile(file, 800);
                selectedWsLogoFile = optimizedFile;
                wsLogoDataUrl = dataUrl;

                if (wsLogoImgPreview) {
                    wsLogoImgPreview.src = wsLogoDataUrl;
                    wsLogoImgPreview.style.display = 'block';
                }
                if (wsLogoEmptyState) wsLogoEmptyState.style.display = 'none';
                if (btnWsRemoveLogo) btnWsRemoveLogo.style.display = 'inline-block';
                if (btnWsChooseLogo) btnWsChooseLogo.textContent = 'Change';
                if (dropPrompt) dropPrompt.innerHTML = `<strong>Logo selected:</strong> ${file.name}`;
                if (wsLogoUrlInput) wsLogoUrlInput.value = '';
            } catch (err) {
                console.error("Logo processing error:", err);
                showAlert.error(err.message || 'Failed to process logo.');
            }
        };

        const handleBannerSelection = async (file) => {
            if (!file) return;
            try {
                if (bannerDropPrompt) bannerDropPrompt.innerHTML = `<strong>Processing banner...</strong>`;
                const { file: optimizedFile, dataUrl } = await processImageFile(file, 1920);
                selectedWsBannerFile = optimizedFile;
                wsBannerDataUrl = dataUrl;

                if (wsBannerDropzone) {
                    wsBannerDropzone.style.background = `url('${dataUrl}') center/cover no-repeat, #18181b`;
                }
                if (btnWsRemoveBanner) btnWsRemoveBanner.style.display = 'inline-block';
                if (btnWsChooseBanner) btnWsChooseBanner.textContent = 'Change';
                if (bannerDropPrompt) bannerDropPrompt.innerHTML = `<strong>Banner selected:</strong> ${file.name}`;
                if (wsBannerUrlInput) wsBannerUrlInput.value = '';
            } catch (err) {
                console.error("Banner processing error:", err);
                showAlert.error(err.message || 'Failed to process banner.');
            }
        };

        // Logo File Picker Events
        btnWsChooseLogo?.addEventListener('click', (e) => { e.stopPropagation(); wsLogoFileInput?.click(); });
        wsLogoBox?.addEventListener('click', (e) => { e.stopPropagation(); wsLogoFileInput?.click(); });
        wsLogoFileInput?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleLogoSelection(file);
        });

        wsLogoUrlInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                selectedWsLogoFile = null;
                wsLogoDataUrl = val;
                if (wsLogoImgPreview) {
                    wsLogoImgPreview.src = val;
                    wsLogoImgPreview.style.display = 'block';
                }
                if (wsLogoEmptyState) wsLogoEmptyState.style.display = 'none';
                if (btnWsRemoveLogo) btnWsRemoveLogo.style.display = 'inline-block';
            }
        });

        btnWsRemoveLogo?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWsLogoFile = null;
            wsLogoDataUrl = '';
            if (wsLogoFileInput) wsLogoFileInput.value = '';
            if (wsLogoUrlInput) wsLogoUrlInput.value = '';
            if (wsLogoImgPreview) {
                wsLogoImgPreview.src = '';
                wsLogoImgPreview.style.display = 'none';
            }
            if (wsLogoEmptyState) wsLogoEmptyState.style.display = 'flex';
            btnWsRemoveLogo.style.display = 'none';
            if (btnWsChooseLogo) btnWsChooseLogo.textContent = 'Upload File';
            if (dropPrompt) dropPrompt.innerHTML = 'Drag & drop square logo, or enter URL below.';
        });

        // Banner File & Presets Picker Events
        btnWsChooseBanner?.addEventListener('click', (e) => { e.stopPropagation(); wsBannerFileInput?.click(); });
        wsBannerFileInput?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleBannerSelection(file);
        });

        btnWsPickInternetBanner?.addEventListener('click', (e) => {
            e.stopPropagation();
            openBannerPickerModal(wsBannerUrlInput?.value || wsBannerDataUrl, (chosenUrl) => {
                selectedWsBannerFile = null;
                wsBannerDataUrl = chosenUrl;
                if (wsBannerUrlInput) wsBannerUrlInput.value = chosenUrl;
                if (wsBannerDropzone) {
                    wsBannerDropzone.style.background = `url('${chosenUrl}') center/cover no-repeat, #18181b`;
                }
                if (btnWsRemoveBanner) btnWsRemoveBanner.style.display = 'inline-block';
                if (bannerDropPrompt) bannerDropPrompt.innerHTML = `<strong>Preset selected:</strong> Ready for workspace`;
                showAlert.success("Preset banner applied!");
            });
        });

        wsBannerUrlInput?.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (val) {
                selectedWsBannerFile = null;
                wsBannerDataUrl = val;
                if (wsBannerDropzone) {
                    wsBannerDropzone.style.background = `url('${val}') center/cover no-repeat, #18181b`;
                }
                if (btnWsRemoveBanner) btnWsRemoveBanner.style.display = 'inline-block';
            }
        });

        btnWsRemoveBanner?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWsBannerFile = null;
            wsBannerDataUrl = '';
            if (wsBannerFileInput) wsBannerFileInput.value = '';
            if (wsBannerUrlInput) wsBannerUrlInput.value = '';
            if (wsBannerDropzone) {
                wsBannerDropzone.style.background = 'linear-gradient(135deg, #18181b 0%, #27272a 100%)';
            }
            btnWsRemoveBanner.style.display = 'none';
            if (btnWsChooseBanner) btnWsChooseBanner.textContent = 'Upload';
            if (bannerDropPrompt) bannerDropPrompt.innerHTML = '<span style="font-size:0.74rem; font-weight:700;">Drag & drop banner or choose from library</span>';
        });

        const updateWsCurrPreview = (val) => {
            const sym = (val || '€').trim().substring(0, 4) || '€';
            if (wsCurrPreview) {
                const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
                wsCurrPreview.textContent = `${sym}${separator}1,250.00`;
            }
        };

        // Initialize Defaults (Example: United Kingdom country + EUR currency)
        if (wsCountrySelect) {
            const ukOption = Array.from(wsCountrySelect.options).find(o => o.value === 'United Kingdom');
            if (ukOption) {
                wsCountrySelect.value = 'United Kingdom';
                if (wsRegionInput && !wsRegionInput.value) {
                    wsRegionInput.value = 'England';
                }
            } else if (wsCountrySelect.options.length > 1) {
                wsCountrySelect.selectedIndex = 1;
            }

            wsCountrySelect.addEventListener('change', () => {
                const selectedOpt = wsCountrySelect.options[wsCountrySelect.selectedIndex];
                if (!selectedOpt) return;
                const defReg = selectedOpt.dataset.region || '';
                if (wsRegionInput && !wsRegionInput.value && defReg) {
                    wsRegionInput.value = defReg;
                }
            });
        }

        if (wsCurrencySelect) {
            // Default currency EUR per explicit user prompt requirement
            const eurOption = Array.from(wsCurrencySelect.options).find(o => o.value === 'EUR');
            if (eurOption) {
                wsCurrencySelect.value = 'EUR';
                if (wsCurrInput) wsCurrInput.value = '€';
                updateWsCurrPreview('€');
            } else if (wsCurrencySelect.options.length > 1) {
                wsCurrencySelect.selectedIndex = 1;
                const opt = wsCurrencySelect.options[wsCurrencySelect.selectedIndex];
                if (wsCurrInput) wsCurrInput.value = opt.dataset.currencySymbol || '$';
                updateWsCurrPreview(opt.dataset.currencySymbol || '$');
            }

            wsCurrencySelect.addEventListener('change', () => {
                const opt = wsCurrencySelect.options[wsCurrencySelect.selectedIndex];
                if (opt && opt.dataset.currencySymbol && wsCurrInput) {
                    wsCurrInput.value = opt.dataset.currencySymbol;
                    updateWsCurrPreview(opt.dataset.currencySymbol);
                }
            });
        }

        if (wsCurrInput) {
            wsCurrInput.addEventListener('input', (e) => {
                updateWsCurrPreview(e.target.value);
            });
        }

        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUser = authService.getCurrentUser();
            if (!currentUser) return;

            const termsBox = document.getElementById('ws-terms-agreement');
            if (termsBox && !termsBox.checked) {
                showAlert.error('Please accept the Terms & Conditions and Privacy Policy to create your workspace.');
                termsBox.focus();
                return;
            }
            
            const btn = setupForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Creating Workspace...';
            
            const wsName = (document.getElementById('ws-name')?.value || "").trim();
            const wsTradeName = (document.getElementById('ws-trade-name')?.value || wsName).trim();
            const wsIndustry = (document.getElementById('ws-industry')?.value || "General Commercial").trim();
            const descInput = document.getElementById('ws-desc');
            
            // Country & Region (Independent)
            const selectedCountryName = wsCountrySelect?.value || "United Kingdom";
            const matchedCountry = COUNTRIES_LIST.find(c => c.name === selectedCountryName) || {
                code: 'GB', name: 'United Kingdom', flag: '🇬🇧', region: 'England'
            };
            const regionVal = (document.getElementById('ws-region')?.value || matchedCountry.region || "").trim();

            // Currency & Symbol (Independent)
            const selectedCurrCode = wsCurrencySelect?.value || "EUR";
            const matchedCurr = CURRENCY_LIST.find(c => c.code === selectedCurrCode) || {
                code: 'EUR', name: 'Euro', symbol: '€'
            };
            const chosenSymbol = (wsCurrInput?.value || matchedCurr.symbol || "€").trim().substring(0, 4) || "€";

            let finalLogoUrl = (wsLogoUrlInput?.value || wsLogoDataUrl || '').trim();
            let finalBannerUrl = (wsBannerUrlInput?.value || wsBannerDataUrl || '').trim();

            if (selectedWsLogoFile) {
                try {
                    btn.textContent = 'Uploading Workspace Logo...';
                    finalLogoUrl = await storageService.uploadImage(selectedWsLogoFile, currentUser.uid);
                } catch (uploadErr) {
                    console.warn("Logo storage upload failed, saving local data url:", uploadErr);
                    finalLogoUrl = wsLogoDataUrl || '';
                }
            }

            if (selectedWsBannerFile) {
                try {
                    btn.textContent = 'Uploading Workspace Banner...';
                    finalBannerUrl = await storageService.uploadImage(selectedWsBannerFile, currentUser.uid);
                } catch (uploadErr) {
                    console.warn("Banner storage upload failed, saving local data url:", uploadErr);
                    finalBannerUrl = wsBannerDataUrl || '';
                }
            }

            const workspaceData = {
                name: wsName,
                tradeName: wsTradeName,
                industry: wsIndustry,
                tagline: (descInput?.value || "Build • Manage • Sell • Scale").trim(),
                description: (descInput?.value || "Main").trim(),
                phone: (document.getElementById('ws-phone')?.value || "").trim(),
                supportPhone: (document.getElementById('ws-support-phone')?.value || "").trim(),
                website: (document.getElementById('ws-website')?.value || "").trim(),
                taxId: (document.getElementById('ws-tax-id')?.value || "").trim(),
                address: (document.getElementById('ws-address')?.value || "").trim(),
                businessAddress: (document.getElementById('ws-address')?.value || "").trim(),
                email: (document.getElementById('ws-email')?.value || currentUser.email || "").trim(),
                adminName: currentUser.displayName || wsName || "Admin",
                adminEmail: currentUser.email || "",
                
                // Explicit Country and Region
                country: selectedCountryName,
                countryName: selectedCountryName,
                countryCode: matchedCountry.code,
                operatedCountry: selectedCountryName,
                region: regionVal,

                // Explicit Currency fields
                currencyCode: matchedCurr.code,
                currencyName: matchedCurr.name,
                currencySymbol: chosenSymbol,
                currency: chosenSymbol,

                // Authority System: Role 0 ADMIN
                workspaceRole: 0,
                role: 'CREATOR_ADMIN',
                roleTag: 'Founder',
                workspaceStatus: 'Active',

                logoUrl: finalLogoUrl,
                logo: finalLogoUrl,
                bannerUrl: finalBannerUrl,
                banner: finalBannerUrl
            };
            
            try {
                btn.textContent = 'Finalizing Workspace...';
                setAppCurrencySymbol(chosenSymbol);
                await firestoreService.createWorkspace(currentUser.uid, currentUser.email, workspaceData);
                showAlert.success('Workspace created successfully!');
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Create Workspace Error:", error);
                showAlert.error('Failed to create workspace. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Initialize Workspace & Launch Console →';
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const confirmed = await showAlert.confirm(
                'Are you sure you want to sign out?',
                'Logout Confirmation',
                { confirmText: 'Logout', cancelText: 'Cancel', isDestructive: true }
            );
            if (confirmed) {
                try {
                    await authService.logout();
                } catch (error) {
                    showAlert.error('An error occurred while logging out.');
                }
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
                    if (btn.id === 'setup-change-account-btn') {
                        showAlert.info('Choose an account to switch to.');
                    }
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

/**
 * Universal Color Theme Applier (Glow Red, Glow Blue, Glow Green)
 */
export function applyTheme(themeName) {
    const valid = ['red', 'blue', 'green', 'enterprise', 'monochrome'].includes(themeName) ? themeName : 'enterprise';
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', valid);
    }
    try {
        localStorage.setItem('pricelister_theme', valid);
    } catch (e) {}
    if (typeof window !== 'undefined') {
        window.__activeTheme = valid;
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: valid } }));
    }
}

// Auto-apply theme immediately on file import
try {
    const savedTheme = localStorage.getItem('pricelister_theme') || 'enterprise';
    applyTheme(savedTheme);
} catch (e) {}


