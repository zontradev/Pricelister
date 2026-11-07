/**
 * PRICELISTER — MODULE 05: AUTOMATION & NOTIFICATIONS UI
 * 1. Notifications Center
 * 2. Automation Rules
 * 3. Scheduled Reports
 * 4. Task Monitor
 * 5. Notification Settings
 */

import { getAutomationService } from '../services/automationService.js';
import { showAlert } from '../alert-handler.js';
import { authService } from '../../firebase/auth.js';

let currentWorkspaceId = null;
let activeTab = 'notifications'; // 'notifications' | 'rules' | 'reports' | 'tasks' | 'settings'
let notifCategoryFilter = 'all';
let notifStatusFilter = 'all'; // 'all' | 'unread' | 'archived'
let searchQuery = '';

export const renderAutomationCenter = async (container, workspaceId, subView = null) => {
    currentWorkspaceId = workspaceId || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    
    // Route parameter mapper
    if (subView) {
        const sv = subView.toLowerCase();
        if (sv === 'rules' || sv === 'automation-rules') activeTab = 'rules';
        else if (sv === 'reports' || sv === 'scheduled-reports') activeTab = 'reports';
        else if (sv === 'tasks' || sv === 'task-monitor') activeTab = 'tasks';
        else if (sv === 'settings' || sv === 'notification-settings') activeTab = 'settings';
        else activeTab = 'notifications';
    }

    const autoService = getAutomationService(currentWorkspaceId);
    const unreadCount = await autoService.getUnreadCount();

    container.innerHTML = `
        <div style="padding: 1.75rem 2rem; max-width: 1400px; margin: 0 auto; min-height: 85vh;">
            <!-- Top Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h1 style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin: 0; letter-spacing: -0.02em;">Automation & Notifications</h1>
                        <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:999px;">Module 05</span>
                    </div>
                    <p style="margin: 0.35rem 0 0; color: #71717A; font-size: 0.88rem;">Intelligent event triggers, scheduled reporting digests, background task watchdog, and alert streams.</p>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;" id="auto-header-actions">
                    <!-- Contextual header actions injected by tab -->
                </div>
            </div>

            <!-- Tab Navigation Strip -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid #E4E4E7; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 2px;">
                <button class="auto-nav-tab ${activeTab === 'notifications' ? 'active' : ''}" data-tab="notifications">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    Notifications Center ${unreadCount > 0 ? `<span class="badge" id="tab-unread-pill" style="background:#18181B; color:#FFF; font-size:0.68rem; padding:0.1rem 0.45rem; border-radius:999px;">${unreadCount}</span>` : ''}
                </button>
                <button class="auto-nav-tab ${activeTab === 'rules' ? 'active' : ''}" data-tab="rules">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Automation Rules
                </button>
                <button class="auto-nav-tab ${activeTab === 'reports' ? 'active' : ''}" data-tab="reports">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Scheduled Reports
                </button>
                <button class="auto-nav-tab ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Task Monitor
                </button>
                <button class="auto-nav-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    Notification Settings
                </button>
            </div>

            <!-- Viewport Container -->
            <div id="auto-tab-viewport">
                <!-- Dynamically rendered -->
            </div>
        </div>

        <style>
            .auto-nav-tab {
                padding: 0.65rem 1.15rem;
                background: none;
                border: none;
                border-bottom: 2.5px solid transparent;
                font-size: 0.88rem;
                font-weight: 600;
                color: #71717A;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .auto-nav-tab:hover {
                color: #18181B;
            }
            .auto-nav-tab.active {
                color: #18181B;
                border-bottom-color: #18181B;
                font-weight: 700;
            }
            .filter-chip-btn {
                background: transparent;
                border: 1px solid transparent;
                color: #71717A;
                font-size: 0.8rem;
                font-weight: 600;
                padding: 0.3rem 0.65rem;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .filter-chip-btn:hover {
                background: #F4F4F5;
                color: #18181B;
            }
            .filter-chip-btn.active {
                background: #18181B;
                color: #FFFFFF;
                border-color: #18181B;
            }
        </style>
    `;

    bindTabEvents(container);
    renderCurrentSubView(container);
};

const bindTabEvents = (container) => {
    container.querySelectorAll('.auto-nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.auto-nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            renderCurrentSubView(container);
        });
    });
};

const renderCurrentSubView = async (container) => {
    const target = container.querySelector('#auto-tab-viewport');
    const headerActions = container.querySelector('#auto-header-actions');
    if (!target) return;

    if (activeTab === 'notifications') {
        renderNotificationsTab(target, headerActions);
    } else if (activeTab === 'rules') {
        renderRulesTab(target, headerActions);
    } else if (activeTab === 'reports') {
        renderReportsTab(target, headerActions);
    } else if (activeTab === 'tasks') {
        renderTasksTab(target, headerActions);
    } else if (activeTab === 'settings') {
        renderSettingsTab(target, headerActions);
    }
};

// =========================================================================
// 1. NOTIFICATIONS CENTER TAB
// =========================================================================
const renderNotificationsTab = async (target, headerActions) => {
    const autoService = getAutomationService(currentWorkspaceId);
    const notifications = await autoService.getAllNotifications(notifStatusFilter === 'archived');

    const currentUser = authService.getCurrentUser();
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    const rawRole = String(ws.role || currentUser?.role || 'WORKER').toUpperCase();
    const isAdmin = rawRole === 'CREATOR_ADMIN' || rawRole === 'ADMIN' || rawRole === 'CREATOR' || ws.workspaceRole === 1;
    const isCoAdmin = !isAdmin && (rawRole === 'CO_ADMIN' || rawRole === 'COADMIN' || ws.workspaceRole === 2);
    const isPrivileged = isAdmin || isCoAdmin;

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

    // Header actions
    if (headerActions) {
        headerActions.innerHTML = `
            <button id="btn-mark-all-read" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.4rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Mark All Read
            </button>
            <button id="btn-clear-read" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600;">Clear Read</button>
        `;

        headerActions.querySelector('#btn-mark-all-read')?.addEventListener('click', async () => {
            if (isPrivileged) {
                await autoService.markAllAsRead();
                showAlert.success("All workspace notifications marked as read.");
            } else {
                let updatedCount = 0;
                for (const n of notifications) {
                    if (!n.read && isUserRelated(n)) {
                        await autoService.markAsRead(n.id);
                        updatedCount++;
                    }
                }
                if (updatedCount > 0) {
                    showAlert.success(`${updatedCount} personal notifications marked as read.`);
                } else {
                    showAlert.info("Workspace alerts cannot be marked as read by workers (use Archive to clear from inbox).");
                }
            }
            renderNotificationsTab(target, headerActions);
        });

        headerActions.querySelector('#btn-clear-read')?.addEventListener('click', async () => {
            if (isPrivileged) {
                const all = await autoService.getAllNotifications(true);
                for (const n of all) {
                    if (n.read) await autoService.deleteNotification(n.id);
                }
                showAlert.info("Read notifications cleared.");
            } else {
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
                    showAlert.info("Workspace alerts can only be deleted by an Administrator.");
                }
            }
            renderNotificationsTab(target, headerActions);
        });
    }

    // Filter toolbar
    target.innerHTML = `
        <div>
            <!-- Status & Category Filters Strip -->
            <div class="card" style="padding: 0.85rem 1.25rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                <div style="display:flex; gap:0.35rem; align-items:center; flex-wrap:wrap;">
                    <button class="filter-chip-btn ${notifStatusFilter === 'all' ? 'active' : ''}" data-status="all">All</button>
                    <button class="filter-chip-btn ${notifStatusFilter === 'unread' ? 'active' : ''}" data-status="unread">Unread Only</button>
                    <button class="filter-chip-btn ${notifStatusFilter === 'archived' ? 'active' : ''}" data-status="archived">Archived</button>
                    <span style="color:#E4E4E7; margin:0 0.35rem;">|</span>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'all' ? 'active' : ''}" data-cat="all">All Types</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'low_stock' ? 'active' : ''}" data-cat="low_stock">Low Stock</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'price_change' ? 'active' : ''}" data-cat="price_change">Price Changes</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'product_update' ? 'active' : ''}" data-cat="product_update">Product Updates</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'scheduled_report' ? 'active' : ''}" data-cat="scheduled_report">Reports</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'import_export' ? 'active' : ''}" data-cat="import_export">Import/Export</button>
                    <button class="filter-chip-btn ${notifCategoryFilter === 'failed_task' ? 'active' : ''}" data-cat="failed_task">Failed Tasks</button>
                </div>
                <div style="position:relative; min-width:220px;">
                    <input type="text" id="notif-search-input" value="${escapeHtml(searchQuery)}" class="form-control" placeholder="Search alert text..." style="padding:0.4rem 0.65rem 0.4rem 2rem; font-size:0.8rem; border-radius:6px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="2" style="position:absolute; left:0.65rem; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
            </div>

            <!-- List View -->
            <div id="notif-list-container">
                <!-- Notifications injected -->
            </div>
        </div>
    `;

    // Filter event listeners
    target.querySelectorAll('.filter-chip-btn[data-status]').forEach(btn => {
        btn.addEventListener('click', () => {
            notifStatusFilter = btn.dataset.status;
            renderNotificationsTab(target, headerActions);
        });
    });

    target.querySelectorAll('.filter-chip-btn[data-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
            notifCategoryFilter = btn.dataset.cat;
            renderNotificationsTab(target, headerActions);
        });
    });

    const searchInput = target.querySelector('#notif-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderFilteredNotifList(target, notifications);
        });
    }

    renderFilteredNotifList(target, notifications);
};

const renderFilteredNotifList = (target, allNotifications) => {
    const listContainer = target.querySelector('#notif-list-container');
    if (!listContainer) return;

    let filtered = allNotifications.filter(n => {
        if (notifStatusFilter === 'unread' && n.read) return false;
        if (notifStatusFilter === 'archived' && !n.archived) return false;
        if (notifCategoryFilter !== 'all' && n.type !== notifCategoryFilter) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const t = (n.title || '').toLowerCase();
            const m = (n.message || '').toLowerCase();
            return t.includes(q) || m.includes(q);
        }
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="card" style="padding: 3.5rem 1rem; text-align:center; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; color:#71717A;">
                <div style="font-weight:700; color:#18181B; font-size:1rem; margin-bottom:0.25rem;">No notifications found</div>
                <p style="margin:0; font-size:0.85rem;">Adjust your filter criteria or enjoy a clean alert inbox.</p>
            </div>
        `;
        return;
    }

    const typeIcons = {
        low_stock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
        price_change: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
        product_update: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        scheduled_report: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>',
        import_export: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        failed_task: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    };

    const currentUser = authService.getCurrentUser();
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    const rawRole = String(ws.role || currentUser?.role || 'WORKER').toUpperCase();
    const isAdmin = rawRole === 'CREATOR_ADMIN' || rawRole === 'ADMIN' || rawRole === 'CREATOR' || ws.workspaceRole === 1;
    const isCoAdmin = !isAdmin && (rawRole === 'CO_ADMIN' || rawRole === 'COADMIN' || ws.workspaceRole === 2);
    const isPrivileged = isAdmin || isCoAdmin;

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

    listContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:0.65rem;">
            ${filtered.map(n => {
                const isPersonal = isUserRelated(n);
                const canDelete = isPrivileged || isPersonal;
                const canMarkRead = isPrivileged || isPersonal;
                const canArchive = true;

                return `
                <div class="card notif-row" data-id="${n.id}" style="padding: 1.15rem 1.4rem; background: ${n.read ? '#FFFFFF' : '#FAFAFA'}; border: 1px solid ${n.read ? '#E4E4E7' : '#18181B'}; border-radius: 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; transition: background 0.15s ease;">
                    <div style="display:flex; gap:0.85rem; align-items:flex-start; flex:1;">
                        <div style="width:34px; height:34px; border-radius:8px; background:#F4F4F5; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#18181B; margin-top:2px;">
                            ${typeIcons[n.type] || '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'}
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <strong style="color:#18181B; font-size:0.92rem;">${escapeHtml(n.title)}</strong>
                                ${!n.read ? `<span class="badge" style="background:#18181B; color:#FFFFFF; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:999px;">UNREAD</span>` : ''}
                                ${n.severity === 'critical' ? `<span class="badge" style="background:#F4F4F5; color:#18181B; border:1.5px solid #18181B; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:999px; font-weight:800;">CRITICAL</span>` : ''}
                                <span class="badge" style="background:#F4F4F5; color:#71717A; border:1px solid #E4E4E7; font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:4px; text-transform:uppercase;">${String(n.type || '').replace(/_/g, ' ')}</span>
                                ${isPersonal ? `<span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; border:1px solid rgba(16,185,129,0.25); font-size:0.65rem; padding:0.1rem 0.45rem; border-radius:4px; font-weight:700;">Personal</span>` : ''}
                            </div>
                            <p style="margin: 0.35rem 0 0.25rem; font-size: 0.85rem; color: #71717A; line-height: 1.45;">${escapeHtml(n.message)}</p>
                            <span style="font-size: 0.74rem; color: #A1A1AA; font-family: monospace;">${new Date(n.timestamp).toLocaleString()}</span>
                            ${n.metadata?.downloadUrl ? `
                                <div style="margin-top:0.4rem;">
                                    <a href="${n.metadata.downloadUrl}" download="${n.metadata.fileName || 'report.csv'}" class="btn btn-sm btn-secondary" style="font-size:0.75rem; padding:0.2rem 0.6rem; display:inline-flex; align-items:center; gap:4px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                        Download Generated File
                                    </a>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:0.35rem; align-items:center; flex-shrink:0;">
                        ${!n.read && canMarkRead ? `<button class="btn btn-sm btn-secondary btn-action-read" data-id="${n.id}" title="Mark as Read">Read</button>` : ''}
                        ${canArchive && !n.archived ? `<button class="btn btn-sm btn-secondary btn-action-archive" data-id="${n.id}" title="Archive">Archive</button>` : ''}
                        ${canDelete ? `<button class="btn btn-sm btn-outline btn-action-del" data-id="${n.id}" style="color:#71717A; border-color:#E4E4E7;" title="Delete">&times;</button>` : ''}
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;

    // Action button listeners
    const autoService = getAutomationService(currentWorkspaceId);
    listContainer.querySelectorAll('.btn-action-read').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await autoService.markAsRead(btn.dataset.id);
            const updated = await autoService.getAllNotifications(notifStatusFilter === 'archived');
            renderFilteredNotifList(target, updated);
        });
    });

    listContainer.querySelectorAll('.btn-action-archive').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await autoService.archiveNotification(btn.dataset.id);
            showAlert.info("Notification archived.");
            const updated = await autoService.getAllNotifications(notifStatusFilter === 'archived');
            renderFilteredNotifList(target, updated);
        });
    });

    listContainer.querySelectorAll('.btn-action-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const targetNotif = allNotifications.find(x => x.id === id);
            if (!isPrivileged && !isUserRelated(targetNotif)) {
                showAlert.error("Workspace notifications can only be deleted by an Administrator or Co-Admin. You may use Archive instead.");
                return;
            }
            await autoService.deleteNotification(id);
            const updated = await autoService.getAllNotifications(notifStatusFilter === 'archived');
            renderFilteredNotifList(target, updated);
        });
    });
};

// =========================================================================
// 2. AUTOMATION RULES TAB
// =========================================================================
const renderRulesTab = async (target, headerActions) => {
    const autoService = getAutomationService(currentWorkspaceId);
    const rules = await autoService.getAllRules();

    if (headerActions) {
        headerActions.innerHTML = `
            <button id="btn-add-rule" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Automation Rule
            </button>
        `;

        headerActions.querySelector('#btn-add-rule')?.addEventListener('click', () => {
            openNewRuleModal(target, headerActions);
        });
    }

    target.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            ${rules.map(r => `
                <div class="card" style="padding: 1.4rem 1.6rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex:1; min-width:300px;">
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">${escapeHtml(r.name)}</h3>
                            <span class="badge" style="background:#F4F4F5; border:1px solid #E4E4E7; font-size:0.72rem; font-family:monospace; color:#18181B;">${escapeHtml(r.triggerType)}</span>
                            <span class="badge" style="background:${r.enabled ? '#18181B' : '#F4F4F5'}; color:${r.enabled ? '#FFF' : '#71717A'}; border:1px solid #E4E4E7; font-size:0.7rem; font-weight:700;">
                                ${r.enabled ? 'ACTIVE' : 'PAUSED'}
                            </span>
                        </div>
                        <p style="margin:0.35rem 0 0.6rem; font-size:0.85rem; color:#71717A;">${escapeHtml(r.description || 'Configured automated trigger')}</p>
                        <div style="display:flex; gap:1.5rem; font-size:0.8rem; color:#18181B; background:#F4F4F5; padding:0.5rem 0.85rem; border-radius:8px; width:fit-content;">
                            <div><span style="color:#71717A;">Action:</span> <strong>${escapeHtml(r.actionType || 'notify_in_app')}</strong></div>
                            <div><span style="color:#71717A;">Target:</span> <strong>${escapeHtml(r.actionTarget || 'admins')}</strong></div>
                            ${r.threshold ? `<div><span style="color:#71717A;">Threshold:</span> <strong>&le; ${r.threshold} units</strong></div>` : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button class="btn btn-sm ${r.enabled ? 'btn-primary' : 'btn-secondary'} btn-toggle-rule" data-id="${r.id}" style="${r.enabled ? 'background:#18181B; color:#FFFFFF;' : ''}">
                            ${r.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button class="btn btn-sm btn-outline btn-del-rule" data-id="${r.id}" style="color:#71717A; border-color:#E4E4E7;">Delete</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    target.querySelectorAll('.btn-toggle-rule').forEach(btn => {
        btn.addEventListener('click', async () => {
            const rule = rules.find(r => r.id === btn.dataset.id);
            if (rule) {
                await autoService.toggleRule(rule.id, !rule.enabled);
                showAlert.info(`Rule "${rule.name}" is now ${!rule.enabled ? 'active' : 'paused'}.`);
                renderRulesTab(target, headerActions);
            }
        });
    });

    target.querySelectorAll('.btn-del-rule').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (confirm("Delete this automation rule?")) {
                await autoService.deleteRule(btn.dataset.id);
                showAlert.info("Automation rule removed.");
                renderRulesTab(target, headerActions);
            }
        });
    });
};

const openNewRuleModal = (target, headerActions) => {
    const modalId = 'modal-new-automation-rule';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    modal.innerHTML = `
        <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:540px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Create Automation Rule</h3>
                <button id="btn-close-modal" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#71717A;">&times;</button>
            </div>
            <form id="form-rule" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Rule Name *</label>
                    <input type="text" id="inp-rule-name" class="form-control" placeholder="e.g. Bulk Invoice Dispatch Watchdog" required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                </div>
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Trigger Condition (WHEN) *</label>
                    <select id="inp-rule-trigger" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                        <option value="low_stock">Product stock level falls below safety threshold</option>
                        <option value="price_change">Product selling price or purchase cost changes</option>
                        <option value="low_margin">Gross margin percentage drops below minimum target</option>
                        <option value="overdue_invoice">Sales invoice remains unpaid past due date</option>
                        <option value="failed_task">Background task execution encounters failure</option>
                    </select>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Action (THEN) *</label>
                        <select id="inp-rule-action" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="notify_in_app">Dispatch in-app alert notification</option>
                            <option value="notify_email">Send email notification alert</option>
                            <option value="flag_review">Flag item for managerial review</option>
                            <option value="queue_report">Trigger automated report run</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Target Audience</label>
                        <select id="inp-rule-target" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="admins">Admins & Co-Admins</option>
                            <option value="all_members">All Workspace Members</option>
                            <option value="finance">Finance & Billing Team</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; font-weight:700;">Deploy Rule</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-modal').onclick = close;
    modal.querySelector('#btn-cancel').onclick = close;

    modal.querySelector('#form-rule').onsubmit = async (e) => {
        e.preventDefault();
        const autoService = getAutomationService(currentWorkspaceId);
        await autoService.saveRule({
            name: document.getElementById('inp-rule-name').value.trim(),
            triggerType: document.getElementById('inp-rule-trigger').value,
            actionType: document.getElementById('inp-rule-action').value,
            actionTarget: document.getElementById('inp-rule-target').value,
            enabled: true
        });
        close();
        showAlert.success("New automation rule saved & activated.");
        renderRulesTab(target, headerActions);
    };
};

// =========================================================================
// 3. SCHEDULED REPORTS TAB
// =========================================================================
const renderReportsTab = async (target, headerActions) => {
    const autoService = getAutomationService(currentWorkspaceId);
    const reports = await autoService.getAllScheduledReports();

    if (headerActions) {
        headerActions.innerHTML = `
            <button id="btn-create-report" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Configure Scheduled Report
            </button>
        `;

        headerActions.querySelector('#btn-create-report')?.addEventListener('click', () => {
            openNewReportModal(target, headerActions);
        });
    }

    target.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.25rem;">
            <!-- Active Scheduled Reports Grid -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:1.25rem;">
                ${reports.map(rep => `
                    <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                                <div>
                                    <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:#18181B;">${escapeHtml(rep.name)}</h3>
                                    <div style="font-size:0.75rem; color:#71717A; font-family:monospace; margin-top:0.15rem;">${rep.id} • ${rep.category}</div>
                                </div>
                                <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.72rem; font-weight:700; text-transform:uppercase;">
                                    ${rep.format}
                                </span>
                            </div>

                            <div style="font-size:0.84rem; color:#71717A; margin:0.75rem 0; line-height:1.6;">
                                <div><strong>Frequency:</strong> ${escapeHtml(rep.frequency)} (${rep.timeOfDay || '09:00'})</div>
                                <div><strong>Audience:</strong> ${escapeHtml(rep.recipients)}</div>
                                <div><strong>Next Scheduled:</strong> ${new Date(rep.nextRunAt).toLocaleDateString()}</div>
                                <div><strong>Executions Completed:</strong> ${rep.executionCount || 0} times</div>
                            </div>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; padding-top:0.85rem; border-top:1px solid #E4E4E7;">
                            <button class="btn btn-sm btn-primary btn-run-report-now" data-id="${rep.id}" style="background:#18181B; color:#FFFFFF; font-weight:700;">
                                Run Report Now &rarr;
                            </button>
                            ${rep.lastDownloadUrl ? `
                                <a href="${rep.lastDownloadUrl}" download="${rep.category}.csv" class="btn btn-sm btn-secondary" style="font-size:0.78rem;">
                                    Download Latest
                                </a>
                            ` : '<span style="font-size:0.75rem; color:#A1A1AA;">No prior runs</span>'}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Historical Delivery Log Table -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px;">
                <h4 style="margin:0 0 1rem; font-size:1rem; font-weight:800; color:#18181B;">Recent Report Generation History</h4>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                                <th style="padding:0.75rem 1rem;">Execution Timestamp</th>
                                <th style="padding:0.75rem 1rem;">Report Name</th>
                                <th style="padding:0.75rem 1rem;">Records Included</th>
                                <th style="padding:0.75rem 1rem;">Duration</th>
                                <th style="padding:0.75rem 1rem;">Status</th>
                                <th style="padding:0.75rem 1rem; text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reports.flatMap(r => (r.deliveryHistory || []).map(h => ({ ...h, reportName: r.name }))).slice(0, 8).map(hist => `
                                <tr style="border-bottom:1px solid #E4E4E7;">
                                    <td style="padding:0.75rem 1rem; font-family:monospace; color:#71717A;">${new Date(hist.runAt).toLocaleString()}</td>
                                    <td style="padding:0.75rem 1rem; font-weight:700; color:#18181B;">${escapeHtml(hist.reportName)}</td>
                                    <td style="padding:0.75rem 1rem;">${hist.recordCount} items</td>
                                    <td style="padding:0.75rem 1rem; font-family:monospace; color:#71717A;">${hist.durationMs}ms</td>
                                    <td style="padding:0.75rem 1rem;">
                                        <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #18181B; font-weight:700; font-size:0.72rem;">${hist.status}</span>
                                    </td>
                                    <td style="padding:0.75rem 1rem; text-align:right;">
                                        <a href="${hist.downloadUrl}" download="${hist.fileName}" class="btn btn-sm btn-secondary" style="font-size:0.75rem;">Download</a>
                                    </td>
                                </tr>
                            `).join('') || `<tr><td colspan="6" style="padding:2rem; text-align:center; color:#71717A;">No report generation runs recorded yet. Click "Run Report Now" above to trigger an immediate export.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    target.querySelectorAll('.btn-run-report-now').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Generating...';
            try {
                const res = await autoService.executeScheduledReport(btn.dataset.id);
                showAlert.success("Report successfully generated & delivery recorded.");
                renderReportsTab(target, headerActions);
            } catch (err) {
                showAlert.error(`Report generation failed: ${err.message}`);
                btn.disabled = false;
                btn.textContent = 'Run Report Now →';
            }
        });
    });
};

const openNewReportModal = (target, headerActions) => {
    const modalId = 'modal-new-scheduled-report';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    modal.innerHTML = `
        <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:540px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Schedule New Report Digest</h3>
                <button id="btn-close-modal" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#71717A;">&times;</button>
            </div>
            <form id="form-report" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                <div>
                    <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Report Title *</label>
                    <input type="text" id="inp-rep-name" class="form-control" placeholder="e.g. Weekly Profit & Loss Statement" required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Category</label>
                        <select id="inp-rep-cat" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="revenue_cashflow">Revenue & Invoicing</option>
                            <option value="inventory_low_stock">Inventory & Low Stock</option>
                            <option value="pricing_margins">Pricing & Profit Margins</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Format</label>
                        <select id="inp-rep-fmt" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="csv">CSV Spreadsheet</option>
                            <option value="pdf">PDF Document</option>
                        </select>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Cadence (Frequency)</label>
                        <select id="inp-rep-freq" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Audience / Delivery</label>
                        <select id="inp-rep-recip" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            <option value="admins">Workspace Administrators</option>
                            <option value="all_members">All Workspace Members</option>
                            <option value="finance">Finance Department</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; font-weight:700;">Save Schedule</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-modal').onclick = close;
    modal.querySelector('#btn-cancel').onclick = close;

    modal.querySelector('#form-report').onsubmit = async (e) => {
        e.preventDefault();
        const autoService = getAutomationService(currentWorkspaceId);
        await autoService.saveScheduledReport({
            name: document.getElementById('inp-rep-name').value.trim(),
            category: document.getElementById('inp-rep-cat').value,
            format: document.getElementById('inp-rep-fmt').value,
            frequency: document.getElementById('inp-rep-freq').value,
            recipients: document.getElementById('inp-rep-recip').value,
            nextRunAt: new Date(Date.now() + 86400000).toISOString()
        });
        close();
        showAlert.success("Scheduled report created successfully.");
        renderReportsTab(target, headerActions);
    };
};

// =========================================================================
// 4. TASK MONITOR TAB (Feature F)
// =========================================================================
const renderTasksTab = async (target, headerActions) => {
    const autoService = getAutomationService(currentWorkspaceId);
    let tasks = await autoService.getAllTaskLogs();

    if (headerActions) {
        headerActions.innerHTML = `
            <button id="btn-simulate-fail" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600;">Simulate Test Task</button>
            <button id="btn-clear-tasks" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600;">Clear Logs</button>
        `;

        headerActions.querySelector('#btn-simulate-fail')?.addEventListener('click', async () => {
            await autoService.logTaskExecution({
                taskName: 'Catalog UPC Barcode Sweep',
                taskType: 'stock_sweep',
                triggerSource: 'MANUAL_DISPATCH',
                status: 'success',
                durationMs: 74
            });
            showAlert.success("Executed test task log.");
            renderTasksTab(target, headerActions);
        });

        headerActions.querySelector('#btn-clear-tasks')?.addEventListener('click', async () => {
            await autoService.clearTaskLogs();
            showAlert.info("Task logs cleared.");
            renderTasksTab(target, headerActions);
        });
    }

    target.innerHTML = `
        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; overflow:hidden;">
            <div style="padding:1rem 1.25rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.85rem; color:#71717A;">Real-time task scheduler and background daemon execution queue.</div>
                <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700;">${tasks.length} Logged Runs</span>
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                    <thead>
                        <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                            <th style="padding:0.75rem 1rem;">Task ID</th>
                            <th style="padding:0.75rem 1rem;">Job Description</th>
                            <th style="padding:0.75rem 1rem;">Trigger Source</th>
                            <th style="padding:0.75rem 1rem;">Timestamp</th>
                            <th style="padding:0.75rem 1rem;">Duration</th>
                            <th style="padding:0.75rem 1rem;">Status</th>
                            <th style="padding:0.75rem 1rem; text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(t => `
                            <tr style="border-bottom:1px solid #E4E4E7;">
                                <td style="padding:0.75rem 1rem; font-family:monospace; font-weight:700; color:#18181B;">${escapeHtml(t.id)}</td>
                                <td style="padding:0.75rem 1rem;">
                                    <div style="font-weight:700; color:#18181B;">${escapeHtml(t.taskName)}</div>
                                    ${t.failureReason ? `<div style="font-size:0.75rem; color:#18181B; margin-top:2px;">Reason: ${escapeHtml(t.failureReason)}</div>` : ''}
                                </td>
                                <td style="padding:0.75rem 1rem; font-family:monospace; font-size:0.78rem; color:#71717A;">${escapeHtml(t.triggerSource)}</td>
                                <td style="padding:0.75rem 1rem; font-family:monospace; font-size:0.78rem; color:#71717A;">${new Date(t.timestamp).toLocaleTimeString()}</td>
                                <td style="padding:0.75rem 1rem; font-family:monospace; color:#71717A;">${t.durationMs}ms</td>
                                <td style="padding:0.75rem 1rem;">
                                    <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid ${t.status === 'failed' ? '#18181B' : '#E4E4E7'}; font-weight:700; font-size:0.72rem;">
                                        ${t.status === 'success' ? '&check; Success' : (t.status === 'failed' ? '&times; Failed' : 'Retrying')}
                                    </span>
                                </td>
                                <td style="padding:0.75rem 1rem; text-align:right;">
                                    ${t.status === 'failed' ? `
                                        <button class="btn btn-sm btn-primary btn-retry-task" data-id="${t.id}" style="background:#18181B; color:#FFFFFF; font-weight:700; font-size:0.75rem;">
                                            Retry
                                        </button>
                                    ` : `<span style="font-size:0.75rem; color:#A1A1AA;">Completed</span>`}
                                </td>
                            </tr>
                        `).join('') || `<tr><td colspan="7" style="padding:2.5rem; text-align:center; color:#71717A;">No task logs recorded.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    target.querySelectorAll('.btn-retry-task').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Retrying...';
            try {
                await autoService.retryTask(btn.dataset.id);
                showAlert.success("Task retried successfully.");
                renderTasksTab(target, headerActions);
            } catch (err) {
                showAlert.error(`Retry failed: ${err.message}`);
                btn.disabled = false;
                btn.textContent = 'Retry';
            }
        });
    });
};

// =========================================================================
// 5. NOTIFICATION SETTINGS TAB (Feature G)
// =========================================================================
const renderSettingsTab = async (target, headerActions) => {
    const autoService = getAutomationService(currentWorkspaceId);
    const prefs = await autoService.getPreferences();

    if (headerActions) {
        headerActions.innerHTML = '';
    }

    target.innerHTML = `
        <div style="max-width:800px; display:flex; flex-direction:column; gap:1.5rem;">
            <!-- Categories Toggles -->
            <div class="card" style="padding:1.75rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px;">
                <h3 style="margin:0 0 0.5rem; font-size:1.1rem; font-weight:800; color:#18181B;">Notification Preferences</h3>
                <p style="margin:0 0 1.25rem; font-size:0.85rem; color:#71717A;">Select which operational events trigger alerts in your workspace.</p>

                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Low-Stock Alerts</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger when item stock reaches minimum threshold</span>
                        </div>
                        <input type="checkbox" id="pref-low-stock" ${prefs.categories.lowStock ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Price-Change Notifications</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger when item cost or sale prices are edited</span>
                        </div>
                        <input type="checkbox" id="pref-price-changes" ${prefs.categories.priceChanges ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Product Lifecycle Updates</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger on product creation, publishing, or archiving</span>
                        </div>
                        <input type="checkbox" id="pref-prod-updates" ${prefs.categories.productUpdates ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Scheduled Reports Digests</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger when recurring CSV/PDF digests complete</span>
                        </div>
                        <input type="checkbox" id="pref-reports" ${prefs.categories.scheduledReports ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Import & Export Operations</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger when bulk data uploads or CSV downloads complete</span>
                        </div>
                        <input type="checkbox" id="pref-import-export" ${prefs.categories.importExport ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Failed Task Watchdog</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Trigger when an automation daemon job encounters errors</span>
                        </div>
                        <input type="checkbox" id="pref-failed-tasks" ${prefs.categories.failedTasks ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>
                </div>
            </div>

            <!-- Delivery Channels -->
            <div class="card" style="padding:1.75rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px;">
                <h3 style="margin:0 0 0.5rem; font-size:1.1rem; font-weight:800; color:#18181B;">Delivery Channels</h3>
                <p style="margin:0 0 1.25rem; font-size:0.85rem; color:#71717A;">Configure where alerts are dispatched.</p>

                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">In-App Notifications</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Display badges and notification stream in topbar</span>
                        </div>
                        <input type="checkbox" id="pref-channel-inapp" ${prefs.channels.inApp ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
                        <div>
                            <strong style="font-size:0.9rem; color:#18181B; display:block;">Email Dispatch</strong>
                            <span style="font-size:0.78rem; color:#71717A;">Dispatch urgent critical warnings to configured inbox</span>
                        </div>
                        <input type="checkbox" id="pref-channel-email" ${prefs.channels.email ? 'checked' : ''} style="width:18px; height:18px;">
                    </label>

                    <div>
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Notification Recipient Email</label>
                        <input type="email" id="pref-email-addr" value="${escapeHtml(prefs.emailRecipient || '')}" class="form-control" placeholder="alerts@yourdomain.com" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end;">
                <button id="btn-save-preferences" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; font-weight:700; padding:0.6rem 1.5rem;">
                    Save Preferences
                </button>
            </div>
        </div>
    `;

    target.querySelector('#btn-save-preferences')?.addEventListener('click', async () => {
        const newPrefs = {
            categories: {
                lowStock: target.querySelector('#pref-low-stock').checked,
                priceChanges: target.querySelector('#pref-price-changes').checked,
                productUpdates: target.querySelector('#pref-prod-updates').checked,
                scheduledReports: target.querySelector('#pref-reports').checked,
                importExport: target.querySelector('#pref-import-export').checked,
                failedTasks: target.querySelector('#pref-failed-tasks').checked
            },
            channels: {
                inApp: target.querySelector('#pref-channel-inapp').checked,
                email: target.querySelector('#pref-channel-email').checked
            },
            emailRecipient: target.querySelector('#pref-email-addr').value.trim()
        };

        await autoService.savePreferences(newPrefs);
        showAlert.success("Notification preferences saved successfully.");
    });
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
