import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';

export const renderMailbox = async (container, workspaceId) => {
    // Clean up any previously attached active realtime listeners on this container
    if (container._mailboxUnsub && typeof container._mailboxUnsub === 'function') {
        container._mailboxUnsub();
        container._mailboxUnsub = null;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">Please sign in to view your mailbox.</div>`;
        return;
    }

    const userEmail = (currentUser.email || '').trim().toLowerCase();

    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin: 0 0 0.35rem 0;">Mailbox & Notifications</h2>
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                    View pending workspace joining requests, invitations, and system updates.
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button id="mb-tab-invites" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 600;">
                    Joining Requests <span id="mb-badge-count" class="badge" style="background: white; color: var(--primary); margin-left: 0.35rem; font-size: 0.75rem; padding: 0.1rem 0.45rem; border-radius: 10px; display: none;">0</span>
                </button>
                <button id="mb-tab-updates" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600;">
                    Updates & Notices
                </button>
            </div>
        </div>

        <!-- TAB 1: JOINING REQUESTS & INVITATIONS -->
        <div id="mb-section-invites" style="display: block;">
            <div id="mb-invites-list" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="skeleton-shimmer" style="width: 100%; height: 110px; border-radius: var(--radius-card);"></div>
                <div class="skeleton-shimmer" style="width: 100%; height: 110px; border-radius: var(--radius-card);"></div>
            </div>
        </div>

        <!-- TAB 2: UPDATES & NOTICES -->
        <div id="mb-section-updates" style="display: none;">
            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); margin-bottom: 1rem; border-left: 4px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 700; font-size: 0.75rem;">System</span>
                        <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Pricelister Web App Active</h4>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Real-time</span>
                </div>
                <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
                    Your account is securely connected. All additions, edits, and deletions are synchronized with the cloud in real-time.
                </p>
            </div>

            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); margin-bottom: 1rem; border-left: 4px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #2563eb; font-weight: 700; font-size: 0.75rem;">Feature Update</span>
                        <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">Market Inserter & Custom Exporter Enabled</h4>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">Recent</span>
                </div>
                <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
                    Batch insert up to 250 products at once using the Market Inserter or download custom Excel spreadsheets with automatic duplicate protection.
                </p>
            </div>
        </div>
    `;

    // Tab Switching
    const tabInvites = container.querySelector('#mb-tab-invites');
    const tabUpdates = container.querySelector('#mb-tab-updates');
    const secInvites = container.querySelector('#mb-section-invites');
    const secUpdates = container.querySelector('#mb-section-updates');
    const invitesList = container.querySelector('#mb-invites-list');
    const badgeCount = container.querySelector('#mb-badge-count');

    tabInvites.addEventListener('click', () => {
        tabInvites.className = 'btn btn-primary';
        tabUpdates.className = 'btn btn-secondary';
        secInvites.style.display = 'block';
        secUpdates.style.display = 'none';
    });

    tabUpdates.addEventListener('click', () => {
        tabUpdates.className = 'btn btn-primary';
        tabInvites.className = 'btn btn-secondary';
        secUpdates.style.display = 'block';
        secInvites.style.display = 'none';
    });

    // Real-time Invites Listener
    const renderInvites = (invites) => {
        if (!invites || invites.length === 0) {
            badgeCount.style.display = 'none';
            invitesList.innerHTML = `
                <div class="card" style="padding: 3rem 2rem; text-align: center; border-radius: var(--radius-card); background: var(--surface-50);">
                    <div style="color: var(--text-muted); margin-bottom: 1rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; color: var(--text-primary);">No Pending Requests</h3>
                    <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); max-width: 420px; margin: 0 auto;">
                        You have no incoming workspace invitations or joining requests at this time.
                    </p>
                </div>
            `;
            return;
        }

        badgeCount.textContent = invites.length;
        badgeCount.style.display = 'inline-block';

        invitesList.innerHTML = invites.map(inv => {
            const roleBadge = getRoleBadgeHtml(inv.role || 'WORKER');
            const dateStr = inv.timestamp ? new Date(inv.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

            return `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); border-left: 4px solid var(--primary); display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap; box-shadow: var(--shadow-elevated);">
                    <div style="flex: 1; min-width: 240px;">
                        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-weight: 700;">
                                ${inv.workspaceName || 'Workspace'}
                            </h3>
                            ${roleBadge}
                        </div>
                        <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                            Invited by: <strong style="color: var(--text-primary);">${inv.adminEmail || 'Workspace Owner'}</strong>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted);">
                            Received on ${dateStr}
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-accept-invite" data-id="${inv.id}" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 600; padding: 0.6rem 1.2rem;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Accept & Join
                        </button>
                        <button class="btn btn-outline btn-reject-invite" data-id="${inv.id}" style="color: var(--danger); border-color: var(--danger); font-weight: 600; padding: 0.6rem 1.2rem;">
                            Decline
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach action events
        invitesList.querySelectorAll('.btn-accept-invite').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const inviteId = e.currentTarget.getAttribute('data-id');
                const targetInvite = invites.find(i => i.id === inviteId);
                if (!targetInvite) return;

                if (await showAlert.confirm(`Accept invitation to join "${targetInvite.workspaceName || 'Workspace'}"?`)) {
                    btn.disabled = true;
                    btn.textContent = 'Joining...';
                    try {
                        await firestoreService.acceptWorkspaceInvite(targetInvite, currentUser);
                        showAlert.success("Invitation accepted! You have joined the workspace.");
                        window.location.reload();
                    } catch (err) {
                        console.error("Accept invite error:", err);
                        showAlert.error("Failed to accept invitation: " + (err.message || 'Unknown error'));
                        btn.disabled = false;
                        btn.textContent = 'Accept & Join';
                    }
                }
            });
        });

        invitesList.querySelectorAll('.btn-reject-invite').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const inviteId = e.currentTarget.getAttribute('data-id');
                if (await showAlert.confirm("Decline this workspace invitation?")) {
                    btn.disabled = true;
                    btn.textContent = 'Declining...';
                    try {
                        await firestoreService.rejectWorkspaceInvite(inviteId);
                        showAlert.success("Invitation declined.");
                    } catch (err) {
                        console.error("Reject invite error:", err);
                        showAlert.error("Failed to decline invitation: " + (err.message || 'Unknown error'));
                        btn.disabled = false;
                        btn.textContent = 'Decline';
                    }
                }
            });
        });
    };

    // Attach Realtime Listener
    try {
        const unsub = firestoreService.listenUserInvites(userEmail, (invs) => {
            renderInvites(invs);
        });
        container._mailboxUnsub = unsub;
    } catch (e) {
        console.error("Mailbox listener error:", e);
        invitesList.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: var(--danger);">Failed to load mailbox invitations.</div>`;
    }
};
