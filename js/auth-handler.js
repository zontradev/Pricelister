import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';
import { showAlert } from './alert-handler.js';
import { CONFIG } from '../config.js';
import { initRouter } from './router.js';
import { setAppCurrencySymbol } from './utilities.js';
import { openCurrencyPickerModal } from './modules/currencyModal.js';

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

    // Modal Google Login Button
    const modalGoogleBtn = document.getElementById('modal-google-login-btn');
    if (modalGoogleBtn) {
        modalGoogleBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            modalGoogleBtn.disabled = true;
            modalGoogleBtn.innerHTML = 'Signing In...';
            
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

    // Modal Test Enter Button
    const modalTestBtn = document.getElementById('modal-test-login-btn');
    if (modalTestBtn) {
        modalTestBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            modalTestBtn.disabled = true;
            modalTestBtn.innerHTML = 'Preparing Dev Sandbox...';
            
            try {
                const user = await authService.loginAsGuest();
                const workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                if (!workspace) {
                    await firestoreService.createWorkspace(user.uid, 'dev@pricelister.app', {
                        name: 'Developer Sandbox',
                        description: 'Main',
                        phone: '000-000-0000',
                        address: 'Local Test Environment',
                        email: 'dev@pricelister.app',
                        currency: '$',
                        currencySymbol: '$'
                    });
                }
                
                if (loginModal) loginModal.style.display = 'none';
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Test Entry Error:", error);
                showAlert.error('Test sign-in failed.');
                modalTestBtn.disabled = false;
                modalTestBtn.innerHTML = 'Test enter';
            }
        });
    }

    // Workspace Setup Form (Create Workspace)
    const setupForm = document.getElementById('workspace-setup-form');
    if (setupForm) {
        const wsCurrInput = document.getElementById('ws-currency');
        const wsCurrPreview = document.getElementById('ws-currency-preview');
        const btnWsFindCurrency = document.getElementById('btn-ws-find-currency');

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

            const workspaceData = {
                name: (document.getElementById('ws-name')?.value || "").trim(),
                description: (descInput?.value || "Main").trim(),
                phone: (document.getElementById('ws-phone')?.value || "").trim(),
                address: (document.getElementById('ws-address')?.value || "").trim(),
                email: (document.getElementById('ws-email')?.value || currentUser.email || "").trim(),
                adminName: currentUser.displayName || (document.getElementById('ws-name')?.value || "Eycon Contact").trim(),
                adminEmail: currentUser.email || "",
                currency: chosenCurrency,
                currencySymbol: chosenCurrency
            };
            
            try {
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

