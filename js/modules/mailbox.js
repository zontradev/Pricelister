import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml, handleSecureJoinInvite } from '../auth-handler.js';
import { getAutomationService } from '../services/automationService.js';

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const renderMailbox = async (container, workspaceId) => {
    // Clean up any previously attached active realtime listeners on this container
    if (container._mailboxUnsub && typeof container._mailboxUnsub === 'function') {
        container._mailboxUnsub();
        container._mailboxUnsub = null;
    }
    if (container._notifsUnsub && typeof container._notifsUnsub === 'function') {
        container._notifsUnsub();
        container._notifsUnsub = null;
    }

    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">Please sign in to view your mailbox.</div>`;
        return;
    }

    const userEmail = (currentUser.email || '').trim().toLowerCase();
    const activeWsId = workspaceId || (window.__activeWorkspace && (window.__activeWorkspace.id || window.__activeWorkspace.workspaceId)) || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    const autoService = getAutomationService(activeWsId);

    // Authority Role Detection
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    const rawRole = String(ws.role || currentUser.role || 'WORKER').toUpperCase();
    const isAdmin = rawRole === 'CREATOR_ADMIN' || rawRole === 'ADMIN' || rawRole === 'CREATOR' || ws.workspaceRole === 1;
    const isCoAdmin = !isAdmin && (rawRole === 'CO_ADMIN' || rawRole === 'COADMIN' || ws.workspaceRole === 2);
    const isPrivileged = isAdmin || isCoAdmin;

    // Helper: Determine if a notification is personal / related to this user
    const isUserRelated = (n) => {
        if (!n) return false;
        const target = (n.targetEmail || n.workerEmail || n.recipient || '').toLowerCase().trim();
        if (userEmail && target === userEmail) return true;
        const t = String(n.type || '').toUpperCase();
        if (t === 'ROLE_PROMOTION' || t === 'ROLE_DEMOTION' || t === 'INVITATION' || t === 'INVITE') {
            if (!target || target === userEmail) return true;
        }
        const msg = String(n.message || '').toLowerCase();
        const title = String(n.title || '').toLowerCase();
        if (userEmail && (msg.includes(userEmail) || title.includes(userEmail))) return true;
        return false;
    };

    // State for Notifications view
    let activeTab = 'notifications'; // 'notifications' | 'invites' | 'updates'
    let notifStatusFilter = 'all'; // 'all' | 'unread' | 'archived'
    let notifCategoryFilter = 'all';
    let searchQuery = '';
    let currentNotifications = [];

    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin: 0 0 0.35rem 0; font-size: 1.55rem; font-weight: 800; color: #18181B; letter-spacing: -0.02em;">Mailbox &amp; Notifications</h2>
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.88rem;">
                    View pending workspace joining requests, notifications center alerts, and system updates.
                </p>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button id="mb-tab-notifications" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    <span>Notifications Center</span>
                    <span id="mb-badge-notifs" class="badge" style="background: #ef4444; color: #ffffff; margin-left: 0.25rem; font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; font-weight: 800; display: none;">0</span>
                </button>
                <button id="mb-tab-invites" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    <span>Joining Requests</span>
                    <span id="mb-badge-count" class="badge" style="background: #18181B; color: #ffffff; margin-left: 0.25rem; font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 999px; font-weight: 800; display: none;">0</span>
                </button>
                <button id="mb-tab-updates" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <span>Updates &amp; Notices</span>
                </button>
            </div>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 1: NOTIFICATIONS CENTER                              -->
        <!-- ======================================================== -->
        <div id="mb-section-notifications" style="display: block;">
            <!-- Header Bulk Actions for Notifications -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                <div style="font-size:0.86rem; color:#71717A;">
                    ${isPrivileged 
                        ? '<strong>Administrator View:</strong> Full access to mark as read and delete notifications.' 
                        : '<strong>Worker View:</strong> Workspace notifications can be archived. Personal role promotions, demotions & invitations can be deleted.'}
                </div>
                <div style="display:flex; gap:0.5rem; align-items:center;">
                    <button id="mb-notif-mark-all-read" class="btn btn-sm btn-secondary" style="font-size:0.8rem; font-weight:700; display:inline-flex; align-items:center; gap:0.35rem;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Mark All Read
                    </button>
                    <button id="mb-notif-clear-read" class="btn btn-sm btn-secondary" style="font-size:0.8rem; font-weight:700;">
                        Clear Read
                    </button>
                </div>
            </div>

            <!-- Status & Category Filter Strip -->
            <div class="card" style="padding: 0.85rem 1.15rem; background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:12px; margin-bottom:1.15rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;" id="mb-notif-chips-container">
                    <button class="mb-chip-btn ${notifStatusFilter === 'all' ? 'active' : ''}" data-status="all">All</button>
                    <button class="mb-chip-btn ${notifStatusFilter === 'unread' ? 'active' : ''}" data-status="unread">Unread Only</button>
                    <button class="mb-chip-btn ${notifStatusFilter === 'archived' ? 'active' : ''}" data-status="archived">Archived</button>
                    <span style="color:#E4E4E7; margin:0 0.25rem;">|</span>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">All Types</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'roles' ? 'active' : ''}" data-cat="roles">Role Updates</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'low_stock' ? 'active' : ''}" data-cat="low_stock">Low Stock</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'price_change' ? 'active' : ''}" data-cat="price_change">Price Changes</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'product_update' ? 'active' : ''}" data-cat="product_update">Product Updates</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'scheduled_report' ? 'active' : ''}" data-cat="scheduled_report">Reports</button>
                    <button class="mb-chip-btn ${notifCategoryFilter === 'failed_task' ? 'active' : ''}" data-cat="failed_task">Failed Tasks</button>
                </div>
                <div style="position:relative; min-width:210px;">
                    <input type="text" id="mb-notif-search-input" value="${escapeHtml(searchQuery)}" class="form-control" placeholder="Search notifications..." style="padding:0.4rem 0.65rem 0.4rem 2rem; font-size:0.8rem; border-radius:8px; border:1px solid #E4E4E7;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="2" style="position:absolute; left:0.65rem; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
            </div>

            <!-- Notifications Feed Container -->
            <div id="mb-notifications-feed">
                <div class="skeleton-shimmer" style="width: 100%; height: 95px; border-radius: var(--radius-card); margin-bottom: 0.65rem;"></div>
                <div class="skeleton-shimmer" style="width: 100%; height: 95px; border-radius: var(--radius-card);"></div>
            </div>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 2: JOINING REQUESTS & INVITATIONS                    -->
        <!-- ======================================================== -->
        <div id="mb-section-invites" style="display: none;">
            <div id="mb-invites-list" style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="skeleton-shimmer" style="width: 100%; height: 110px; border-radius: var(--radius-card);"></div>
                <div class="skeleton-shimmer" style="width: 100%; height: 110px; border-radius: var(--radius-card);"></div>
            </div>
        </div>

        <!-- ======================================================== -->
        <!-- TAB 3: UPDATES & NOTICES                                 -->
        <!-- ======================================================== -->
        <div id="mb-section-updates" style="display: none;">
            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); margin-bottom: 1rem; border-left: 4px solid var(--primary); background:#FFFFFF; border:1px solid #E4E4E7; border-left: 4px solid #18181B;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge" style="background: #F4F4F5; color: #18181B; border: 1px solid #E4E4E7; font-weight: 700; font-size: 0.75rem;">System</span>
                        <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary); font-weight:800;">PriceLister Unified Notifications Active</h4>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">Real-time</span>
                </div>
                <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
                    Your account is securely connected. All workspace role changes, promotion digests, joining requests, and system alerts are synchronized across devices in real time.
                </p>
            </div>

            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); margin-bottom: 1rem; background:#FFFFFF; border:1px solid #E4E4E7; border-left: 4px solid #71717A;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span class="badge" style="background: #F4F4F5; color: #71717A; border: 1px solid #E4E4E7; font-weight: 700; font-size: 0.75rem;">Governance Policy</span>
                        <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary); font-weight:800;">Enterprise Role &amp; Mailbox Rules Active</h4>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">Policy</span>
                </div>
                <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5;">
                    Workspace administrators manage workspace-level alert streams. Workers can view, archive, and independently manage personal notifications and workspace invitations.
                </p>
            </div>
        </div>

        <style>
            .mb-chip-btn {
                background: transparent;
                border: 1px solid transparent;
                color: #71717A;
                font-size: 0.78rem;
                font-weight: 700;
                padding: 0.3rem 0.65rem;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .mb-chip-btn:hover {
                background: #F4F4F5;
                color: #18181B;
            }
            .mb-chip-btn.active {
                background: #18181B;
                color: #FFFFFF;
                border-color: #18181B;
            }
        </style>
    `;

    // Tab Switching Elements
    const tabNotifs = container.querySelector('#mb-tab-notifications');
    const tabInvites = container.querySelector('#mb-tab-invites');
    const tabUpdates = container.querySelector('#mb-tab-updates');
    const secNotifs = container.querySelector('#mb-section-notifications');
    const secInvites = container.querySelector('#mb-section-invites');
    const secUpdates = container.querySelector('#mb-section-updates');
    const badgeNotifs = container.querySelector('#mb-badge-notifs');
    const badgeInvites = container.querySelector('#mb-badge-count');
    const notifsFeed = container.querySelector('#mb-notifications-feed');
    const invitesList = container.querySelector('#mb-invites-list');

    const switchTab = (tabName) => {
        activeTab = tabName;
        tabNotifs.className = (tabName === 'notifications') ? 'btn btn-primary' : 'btn btn-secondary';
        tabInvites.className = (tabName === 'invites') ? 'btn btn-primary' : 'btn btn-secondary';
        tabUpdates.className = (tabName === 'updates') ? 'btn btn-primary' : 'btn btn-secondary';

        secNotifs.style.display = (tabName === 'notifications') ? 'block' : 'none';
        secInvites.style.display = (tabName === 'invites') ? 'block' : 'none';
        secUpdates.style.display = (tabName === 'updates') ? 'block' : 'none';
    };

    tabNotifs.addEventListener('click', () => switchTab('notifications'));
    tabInvites.addEventListener('click', () => switchTab('invites'));
    tabUpdates.addEventListener('click', () => switchTab('updates'));

    // =========================================================================
    // NOTIFICATIONS CENTER ENGINE IN MAILBOX
    // =========================================================================
    const typeIcons = {
        ROLE_PROMOTION: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        ROLE_DEMOTION: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
        low_stock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        price_change: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        product_update: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        scheduled_report: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>',
        import_export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        failed_task: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };

    const renderNotificationsFeed = (notifs) => {
        currentNotifications = notifs || [];
        const unreadCount = currentNotifications.filter(n => !n.read && !n.archived).length;
        if (badgeNotifs) {
            badgeNotifs.textContent = String(unreadCount);
            badgeNotifs.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        }

        // Apply filters
        let filtered = currentNotifications.filter(n => {
            if (notifStatusFilter === 'unread' && n.read) return false;
            if (notifStatusFilter === 'archived' && !n.archived) return false;
            if (notifStatusFilter !== 'archived' && n.archived) return false;

            if (notifCategoryFilter === 'roles') {
                const t = String(n.type || '').toUpperCase();
                if (t !== 'ROLE_PROMOTION' && t !== 'ROLE_DEMOTION') return false;
            } else if (notifCategoryFilter !== 'all' && n.type !== notifCategoryFilter) {
                return false;
            }

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const t = (n.title || '').toLowerCase();
                const m = (n.message || '').toLowerCase();
                return t.includes(q) || m.includes(q);
            }
            return true;
        });

        if (filtered.length === 0) {
            notifsFeed.innerHTML = `
                <div class="card" style="padding: 3rem 1.5rem; text-align:center; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px;">
                    <div style="color: #71717A; margin-bottom: 0.75rem;">
                        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </div>
                    <div style="font-weight:800; color:#18181B; font-size:1.05rem; margin-bottom:0.25rem;">No notifications found</div>
                    <p style="margin:0; font-size:0.85rem; color:#71717A;">All clear! Adjust your filter criteria or check back later for new alerts.</p>
                </div>
            `;
            return;
        }

        notifsFeed.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                ${filtered.map(n => {
                    const isPersonal = isUserRelated(n);
                    const canDelete = isPrivileged || isPersonal;
                    const canMarkRead = isPrivileged || isPersonal;
                    const canArchive = true;
                    const typeKey = String(n.type || '');
                    const iconHtml = typeIcons[typeKey] || typeIcons[typeKey.toLowerCase()] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

                    return `
                        <div class="card mb-notif-card" data-id="${n.id}" style="padding: 1.15rem 1.35rem; background: ${n.read ? '#FFFFFF' : '#FAFAFA'}; border: 1.5px solid ${n.read ? '#E4E4E7' : '#18181B'}; border-radius: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; transition: background 0.15s ease;">
                            <div style="display:flex; gap:0.85rem; align-items:flex-start; flex:1; min-width:0;">
                                <div style="width:36px; height:36px; border-radius:10px; background:#F4F4F5; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#18181B; margin-top:2px;">
                                    ${iconHtml}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                                        <strong style="color:#18181B; font-size:0.94rem;">${escapeHtml(n.title)}</strong>
                                        ${!n.read ? `<span class="badge" style="background:#18181B; color:#FFFFFF; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:999px; font-weight:800;">UNREAD</span>` : ''}
                                        ${n.severity === 'critical' ? `<span class="badge" style="background:#F4F4F5; color:#18181B; border:1.5px solid #18181B; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:999px; font-weight:800;">CRITICAL</span>` : ''}
                                        <span class="badge" style="background:#F4F4F5; color:#71717A; border:1px solid #E4E4E7; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:4px; text-transform:uppercase; font-weight:700;">${typeKey.replace(/_/g, ' ')}</span>
                                        ${isPersonal ? `<span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.25); font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:4px; font-weight:700;">Personal</span>` : ''}
                                    </div>
                                    <p style="margin: 0.35rem 0 0.25rem; font-size: 0.86rem; color: #71717A; line-height: 1.45; word-break: break-word;">${escapeHtml(n.message)}</p>
                                    <span style="font-size: 0.74rem; color: #A1A1AA; font-family: monospace;">${n.timestamp ? new Date(n.timestamp).toLocaleString() : 'Recently'}</span>
                                    ${n.metadata?.downloadUrl ? `
                                        <div style="margin-top:0.4rem;">
                                            <a href="${n.metadata.downloadUrl}" download="${n.metadata.fileName || 'report.csv'}" class="btn btn-sm btn-secondary" style="font-size:0.75rem; padding:0.2rem 0.6rem; display:inline-flex; align-items:center; gap:4px; font-weight:700;">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                Download Generated File
                                            </a>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div style="display:flex; gap:0.4rem; align-items:center; flex-shrink:0;">
                                ${!n.read && canMarkRead ? `<button class="btn btn-sm btn-secondary mb-btn-read" data-id="${n.id}" style="font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem;" title="Mark as Read">Read</button>` : ''}
                                ${canArchive && !n.archived ? `<button class="btn btn-sm btn-secondary mb-btn-archive" data-id="${n.id}" style="font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem;" title="Archive Notification">Archive</button>` : ''}
                                ${canDelete ? `
                                    <button class="btn btn-sm btn-outline mb-btn-del" data-id="${n.id}" style="color:#71717A; border-color:#E4E4E7; font-size:1.1rem; padding:0.1rem 0.55rem; line-height:1;" title="Delete Notification">&times;</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        // Wire Item Actions
        notifsFeed.querySelectorAll('.mb-btn-read').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                btn.disabled = true;
                await autoService.markAsRead(id);
                window.dispatchEvent(new CustomEvent('notification-count-changed'));
                const refreshed = await autoService.getAllNotifications(notifStatusFilter === 'archived');
                renderNotificationsFeed(refreshed);
            });
        });

        notifsFeed.querySelectorAll('.mb-btn-archive').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                btn.disabled = true;
                await autoService.archiveNotification(id);
                showAlert.info("Notification moved to archive.");
                window.dispatchEvent(new CustomEvent('notification-count-changed'));
                const refreshed = await autoService.getAllNotifications(notifStatusFilter === 'archived');
                renderNotificationsFeed(refreshed);
            });
        });

        notifsFeed.querySelectorAll('.mb-btn-del').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const targetNotif = currentNotifications.find(x => x.id === id);
                if (!isPrivileged && !isUserRelated(targetNotif)) {
                    showAlert.error("Workspace notifications can only be deleted by an Administrator or Co-Admin. You may use Archive instead.");
                    return;
                }
                btn.disabled = true;
                await autoService.deleteNotification(id);
                showAlert.success("Notification removed.");
                window.dispatchEvent(new CustomEvent('notification-count-changed'));
                const refreshed = await autoService.getAllNotifications(notifStatusFilter === 'archived');
                renderNotificationsFeed(refreshed);
            });
        });
    };

    // Filter Chips Event Listeners
    container.querySelectorAll('.mb-chip-btn[data-status]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.mb-chip-btn[data-status]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifStatusFilter = btn.dataset.status;
            renderNotificationsFeed(currentNotifications);
        });
    });

    container.querySelectorAll('.mb-chip-btn[data-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.mb-chip-btn[data-cat]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifCategoryFilter = btn.dataset.cat;
            renderNotificationsFeed(currentNotifications);
        });
    });

    const searchInput = container.querySelector('#mb-notif-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderNotificationsFeed(currentNotifications);
        });
    }

    // Header Bulk Actions
    const btnMarkAllRead = container.querySelector('#mb-notif-mark-all-read');
    if (btnMarkAllRead) {
        btnMarkAllRead.addEventListener('click', async () => {
            if (isPrivileged) {
                await autoService.markAllAsRead();
                showAlert.success("All workspace notifications marked as read.");
            } else {
                // Worker: only marks her related notifications
                let updatedCount = 0;
                for (const n of currentNotifications) {
                    if (!n.read && isUserRelated(n)) {
                        await autoService.markAsRead(n.id);
                        updatedCount++;
                    }
                }
                if (updatedCount > 0) {
                    showAlert.success(`${updatedCount} personal notifications marked as read.`);
                } else {
                    showAlert.info("No unread personal notifications. Workspace alerts can be cleared using Archive.");
                }
            }
            window.dispatchEvent(new CustomEvent('notification-count-changed'));
            const refreshed = await autoService.getAllNotifications(notifStatusFilter === 'archived');
            renderNotificationsFeed(refreshed);
        });
    }

    const btnClearRead = container.querySelector('#mb-notif-clear-read');
    if (btnClearRead) {
        btnClearRead.addEventListener('click', async () => {
            if (isPrivileged) {
                const all = await autoService.getAllNotifications(true);
                for (const n of all) {
                    if (n.read) await autoService.deleteNotification(n.id);
                }
                showAlert.info("All read notifications cleared.");
            } else {
                // Worker: only clears her related read notifications
                const all = await autoService.getAllNotifications(true);
                let clearedCount = 0;
                for (const n of all) {
                    if (n.read && isUserRelated(n)) {
                        await autoService.deleteNotification(n.id);
                        clearedCount++;
                    }
                }
                if (clearedCount > 0) {
                    showAlert.info(`${clearedCount} read personal notifications cleared.`);
                } else {
                    showAlert.info("No personal read notifications to clear. Workspace alerts can only be deleted by an Administrator.");
                }
            }
            window.dispatchEvent(new CustomEvent('notification-count-changed'));
            const refreshed = await autoService.getAllNotifications(notifStatusFilter === 'archived');
            renderNotificationsFeed(refreshed);
        });
    }

    // Attach Realtime Listener for Notifications
    try {
        container._notifsUnsub = autoService.listenNotifications((notifs) => {
            renderNotificationsFeed(notifs);
        });
    } catch (e) {
        console.warn("Notifications listener warning:", e);
        autoService.getAllNotifications().then(notifs => renderNotificationsFeed(notifs));
    }

    // =========================================================================
    // TAB 2: JOINING REQUESTS & INVITATIONS
    // =========================================================================
    const renderInvites = (invites) => {
        const pending = (invites || []).filter(i => (i.status || 'PENDING').toUpperCase() === 'PENDING');
        if (badgeInvites) {
            badgeInvites.textContent = String(pending.length);
            badgeInvites.style.display = pending.length > 0 ? 'inline-block' : 'none';
        }

        if (pending.length === 0) {
            invitesList.innerHTML = `
                <div class="card" style="padding: 3rem 2rem; text-align: center; border-radius: var(--radius-card); background: #FFFFFF; border: 1px solid #E4E4E7;">
                    <div style="color: var(--text-muted); margin-bottom: 1rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </div>
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.15rem; color: var(--text-primary); font-weight:800;">No Pending Requests</h3>
                    <p style="margin: 0; font-size: 0.88rem; color: var(--text-secondary); max-width: 420px; margin: 0 auto;">
                        You have no incoming workspace invitations or joining requests at this time.
                    </p>
                </div>
            `;
            return;
        }

        invitesList.innerHTML = pending.map(inv => {
            const roleBadge = getRoleBadgeHtml(inv.role || 'WORKER', inv.roleTag || 'Worker');
            const dateStr = inv.timestamp ? new Date(inv.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

            return `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); border-left: 4px solid #18181B; display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap; box-shadow: var(--shadow-subtle); background:#FFFFFF; border:1px solid #E4E4E7; border-left: 4px solid #18181B;">
                    <div style="flex: 1; min-width: 240px;">
                        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                            <h3 style="margin: 0; font-size: 1.15rem; color: var(--text-primary); font-weight: 800;">
                                ${escapeHtml(inv.workspaceName || 'PriceLister Workspace')}
                            </h3>
                            ${roleBadge}
                        </div>
                        <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                            Invited by: <strong style="color: var(--text-primary);">${escapeHtml(inv.adminEmail || 'Workspace Owner')}</strong>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-muted); font-family: monospace;">
                            Received on ${dateStr}
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
                        <button class="btn btn-primary btn-accept-invite" data-id="${inv.id}" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; padding: 0.6rem 1.2rem; background:#18181B; color:#FFFFFF; border:none; border-radius:10px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Accept &amp; Join
                        </button>
                        <button class="btn btn-outline btn-reject-invite" data-id="${inv.id}" style="color: #71717A; border-color: #E4E4E7; font-weight: 700; padding: 0.6rem 1.1rem; border-radius:10px;">
                            Decline
                        </button>
                        <button class="btn btn-outline btn-delete-invite" data-id="${inv.id}" style="color: #71717A; border-color: #E4E4E7; font-size: 1.2rem; padding: 0.35rem 0.75rem; border-radius:10px; line-height: 1;" title="Delete Invitation">&times;</button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach action events for Invites
        invitesList.querySelectorAll('.btn-accept-invite').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const inviteId = e.currentTarget.getAttribute('data-id');
                const targetInvite = pending.find(i => i.id === inviteId);
                if (!targetInvite) return;

                btn.disabled = true;
                btn.textContent = 'Joining...';
                await handleSecureJoinInvite(targetInvite, currentUser, () => {
                    showAlert.success("Invitation accepted! You have joined the workspace.");
                    window.location.reload();
                });
                btn.disabled = false;
                btn.textContent = 'Accept & Join';
            });
        });

        invitesList.querySelectorAll('.btn-reject-invite, .btn-delete-invite').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const inviteId = e.currentTarget.getAttribute('data-id');
                const isDel = btn.classList.contains('btn-delete-invite');
                const promptMsg = isDel ? "Delete this workspace invitation?" : "Decline this workspace invitation?";
                if (await showAlert.confirm(promptMsg)) {
                    btn.disabled = true;
                    btn.textContent = isDel ? 'Deleting...' : 'Declining...';
                    try {
                        await firestoreService.rejectWorkspaceInvite(inviteId);
                        showAlert.success(isDel ? "Invitation deleted." : "Invitation declined.");
                        window.dispatchEvent(new CustomEvent('notification-count-changed'));
                    } catch (err) {
                        console.error("Reject invite error:", err);
                        showAlert.error("Action failed: " + (err.message || 'Unknown error'));
                        btn.disabled = false;
                        btn.textContent = isDel ? '×' : 'Decline';
                    }
                }
            });
        });
    };

    // Attach Realtime Listener for Invites
    try {
        container._mailboxUnsub = firestoreService.listenUserInvites(userEmail, (invs) => {
            renderInvites(invs);
        });
    } catch (e) {
        console.error("Mailbox invites listener error:", e);
        invitesList.innerHTML = `<div class="card" style="padding: 2rem; text-align: center; color: var(--danger);">Failed to load mailbox invitations.</div>`;
    }
};
