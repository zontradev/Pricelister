import { authService } from '../firebase/auth.js';
import { firestoreService } from '../firebase/firestore.js';
import { showAlert } from './alert-handler.js';
import { CONFIG } from '../config.js';
import { initRouter } from './router.js';

let routerInitialized = false;

const formatRoleBadge = (role, element) => {
    if (!element) return;
    
    const raw = (role || 'WORKER').toUpperCase();
    if (raw === 'CREATOR_ADMIN' || raw === 'ADMIN') {
        element.textContent = 'Admin';
        element.style.background = 'rgba(225, 29, 72, 0.12)';
        element.style.color = '#e11d48';
    } else if (raw === 'CO_ADMIN' || raw === 'CO-ADMIN') {
        element.textContent = 'Co-admin';
        element.style.background = '#fae8ff';
        element.style.color = '#c026d3';
    } else {
        element.textContent = 'Worker';
        element.style.background = '#e2e8f0';
        element.style.color = '#475569';
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
                        // User has a workspace, show launcher instead of redirecting automatically
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (authContainer) authContainer.style.display = 'none';
                        if (setupContainer) setupContainer.style.display = 'none';
                        if (launcherContainer) {
                            launcherContainer.style.display = 'block';
                            document.getElementById('launcher-workspace-name').textContent = workspace.name || 'Your Workspace';
                            document.getElementById('launcher-account-email').textContent = user.email;
                            document.getElementById('launcher-avatar').textContent = user.email.charAt(0).toUpperCase();
                            
                            const idEl = document.getElementById('launcher-workspace-id');
                            if(idEl) idEl.textContent = workspace.workspaceId || workspace.id;
                            
                            const roleEl = document.getElementById('launcher-user-role');
                            formatRoleBadge(workspace.role, roleEl);
                            
                            const dateEl = document.getElementById('launcher-joined-date');
                            if(dateEl) {
                                if (workspace.createdAt && workspace.createdAt.toDate) {
                                    dateEl.textContent = workspace.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                                } else {
                                    dateEl.textContent = 'Recently';
                                }
                            }
                        }
                    } else {
                        // Show first-time setup
                        document.body.classList.remove('app-loading');
                        if (loader) loader.style.display = 'none';
                        if (authContainer) authContainer.style.display = 'none';
                        if (launcherContainer) launcherContainer.style.display = 'none';
                        
                        // Check for pending invites
                        if (user.email) {
                            const invites = await firestoreService.getPendingInvites(user.email);
                            if (invites && invites.length > 0) {
                                const section = document.getElementById('pending-invites-section');
                                const list = document.getElementById('pending-invites-list');
                                if (section && list) {
                                    section.style.display = 'block';
                                    list.innerHTML = invites.map(inv => `
                                        <div style="background: var(--surface-100); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                                            <div>
                                                <strong style="display:block; color: var(--text-primary); font-size:1.05rem;">${inv.workspaceName || 'A Workspace'}</strong>
                                                <small style="color: var(--text-secondary);">Invited by: ${inv.adminEmail}</small>
                                            </div>
                                            <div style="display: flex; gap: 0.5rem;">
                                                <button class="btn btn-sm btn-primary accept-invite-btn" data-id="${inv.id}">Join</button>
                                                <button class="btn btn-sm btn-outline reject-invite-btn" data-id="${inv.id}">Decline</button>
                                            </div>
                                        </div>
                                    `).join('');
                                    
                                    // Attach events
                                    document.querySelectorAll('.accept-invite-btn').forEach(btn => {
                                        btn.addEventListener('click', async (e) => {
                                            const id = e.target.getAttribute('data-id');
                                            const invite = invites.find(i => i.id === id);
                                            try {
                                                e.target.disabled = true;
                                                e.target.textContent = 'Joining...';
                                                await firestoreService.acceptWorkspaceInvite(invite, user);
                                                // After accepting, they have a workspace. Send them in!
                                                window.location.href = 'app.html';
                                            } catch (err) {
                                                e.target.disabled = false;
                                                e.target.textContent = 'Join';
                                                if (window.showAlert) window.showAlert.error("Failed to join workspace.");
                                            }
                                        });
                                    });
                                    
                                    document.querySelectorAll('.reject-invite-btn').forEach(btn => {
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
                                }
                            }
                        }
                        
                        if (setupContainer) setupContainer.style.display = 'block';
                    }
                } catch (error) {
                    showAlert.error('Error checking account status. Please check your Firestore rules.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                    if (authContainer) authContainer.style.display = 'block'; // Show auth so they can try again
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
                        // Cannot be in app without workspace
                        window.location.href = 'index.html';
                        return;
                    }
                    // Logged in user on private page -> let router load shell and hide loader
                    document.body.classList.remove('app-loading');
                    // loader and shell are handled by router.js now
                    
                    // Update UI with user info
                    document.getElementById('user-email').textContent = user.email;
                    formatRoleBadge(workspace.role, document.getElementById('user-role'));
                    document.getElementById('user-avatar').textContent = user.email.charAt(0).toUpperCase();

                    const roleUpper = (workspace.role || 'WORKER').toUpperCase();
                    const isWorker = roleUpper === 'WORKER';
                    const settingsNavLink = document.querySelector('a[data-route="settings"]');
                    if (settingsNavLink && isWorker) {
                        settingsNavLink.title = "Settings (Admins only)";
                        settingsNavLink.innerHTML = 'Settings <span style="font-size:0.75rem; opacity:0.6;">🔒</span>';
                    }

                    if (!routerInitialized) {
                        initRouter(workspace.id);
                        routerInitialized = true;
                    }
                } catch (error) {
                    showAlert.error('Error loading workspace. Please check your Firestore rules.');
                    document.body.classList.remove('app-loading');
                    if (loader) loader.style.display = 'none';
                }
            } else {
                // Not logged in on private page -> redirect to public page
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
                await authService.loginWithGoogle();
                showAlert.success('Google sign-in successful.');
                if (loginModal) loginModal.style.display = 'none';
                // Redirect/Flow handled by onAuthStateChanged
            } catch (error) {
                showAlert.error('Sign-in couldn\'t be completed. Please try again.');
                modalGoogleBtn.disabled = false;
                modalGoogleBtn.innerHTML = 'Login with Google';
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
                // 1. Sign in anonymously (no login credentials required)
                const user = await authService.loginAsGuest();
                
                // 2. Automatically generate a developer workspace so they skip the setup screen
                const workspace = await firestoreService.checkWorkspaceExists(user.uid, user.email);
                if (!workspace) {
                    await firestoreService.createWorkspace(user.uid, 'dev@pricelister.app', {
                        name: 'Developer Sandbox',
                        phone: '000-000-0000',
                        address: 'Local Test Environment',
                        email: 'dev@pricelister.app'
                    });
                }
                
                if (loginModal) loginModal.style.display = 'none';
                
                // Note: onAuthStateChanged will naturally pick up the login and route to app.html,
                // but we can force it here for snappiness.
                window.location.href = 'app.html';
            } catch (error) {
                console.error("Test Entry Error:", error);
                
                // Show a more specific error message if it's a known Firebase issue
                let errorMsg = 'Test sign-in failed.';
                if (error.code === 'auth/operation-not-allowed') {
                    errorMsg = 'Anonymous sign-in is disabled. Please enable it in Firebase Console -> Authentication -> Sign-in method.';
                } else if (error.code === 'permission-denied') {
                    errorMsg = 'Firestore rules blocked the workspace creation. Check database rules.';
                } else {
                    errorMsg = error.message || errorMsg;
                }
                
                showAlert.error(errorMsg);
                modalTestBtn.disabled = false;
                modalTestBtn.innerHTML = 'Test enter';
            }
        });
    }

    // Workspace Setup Form
    const setupForm = document.getElementById('workspace-setup-form');
    if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentUser = authService.getCurrentUser();
            if (!currentUser) return;
            
            const btn = setupForm.querySelector('button');
            btn.disabled = true;
            btn.textContent = 'Creating Workspace...';
            
            const workspaceData = {
                name: document.getElementById('ws-name').value,
                phone: document.getElementById('ws-phone').value,
                address: document.getElementById('ws-address').value,
                email: document.getElementById('ws-email').value
            };
            
            try {
                await firestoreService.createWorkspace(currentUser.uid, currentUser.email, workspaceData);
                showAlert.success('Workspace created successfully.');
                window.location.href = 'app.html';
            } catch (error) {
                showAlert.error('Something went wrong. Please try again.');
                btn.disabled = false;
                btn.textContent = 'Create Workspace';
            }
        });
    }

    // Logout Button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await authService.logout();
                // Redirect handled by onAuthStateChanged
            } catch (error) {
                showAlert.error('An error occurred while logging out.');
            }
        });
    }

    // Change Account Button (Launcher)
    const changeAccountBtn = document.getElementById('launcher-change-account-btn');
    if (changeAccountBtn) {
        changeAccountBtn.addEventListener('click', async () => {
            try {
                await authService.logout();
                // Handled by onAuthStateChanged
            } catch (error) {
                showAlert.error('An error occurred while logging out.');
            }
        });
    }
};
