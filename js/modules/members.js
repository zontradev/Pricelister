import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getProductService } from '../services/productService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

export const renderMembers = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // Skeleton loading state
    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 1.5rem;">
            <h2>Workspace Members</h2>
            <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">View activity, creations, and deletion statistics for all connected members.</p>
        </div>
        <div class="card" style="padding: 2.5rem; text-align:center;">
            <div class="spinner-sm" style="display:inline-block; margin-right:8px;"></div>
            Loading member contributions & activity...
        </div>
    `;

    try {
        // 1. Fetch Workspace Document & Catalog Data in parallel
        const productService = getProductService(workspaceId);
        const invoiceService = getInvoiceService(workspaceId);
        const categoryService = getCategoryService(workspaceId);
        const peopleService = getPeopleService(workspaceId);

        const [wsInfo, products, custInvoices, busInvoices, categories, clients, businesses, rawMembers] = await Promise.all([
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null),
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => []),
            categoryService.getAllCategories().catch(() => []),
            peopleService.getAllClients().catch(() => []),
            peopleService.getAllBusinesses().catch(() => []),
            firestoreService.getWorkspaceMembers(workspaceId).catch(() => [])
        ]);

        if (!wsInfo) {
            container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">No workspace information available.</div>`;
            return;
        }

        const adminUid = wsInfo.id || workspaceId;
        const allInvoices = (custInvoices || []).concat(busInvoices || []);

        // Helper: Check if an item matches a member's creator ID
        const countMemberItems = (items, memberIds, isMainAdmin = false) => {
            return (items || []).filter(item => {
                if (!item) return false;
                const cId = String(item.creatorId || item.workerId || item.appWorkerId || item.creator || '').trim().toLowerCase();
                if (!cId) return isMainAdmin;
                return memberIds.includes(cId) || (isMainAdmin && (cId === 'admin' || cId === 'creator' || cId === 'unknown'));
            }).length;
        };

        // 3. Separate Admin, Co-Admins, and Workers
        const adminEmail = (wsInfo.adminEmail || '').toLowerCase();
        const adminIds = [
            wsInfo.adminId, 
            adminUid, 
            wsInfo.workspaceId, 
            currentUser.uid, 
            adminEmail
        ].filter(Boolean).map(s => String(s).trim().toLowerCase());
        
        const adminPCount = countMemberItems(products, adminIds, true);
        const adminInvCount = countMemberItems(allInvoices, adminIds, true);
        const adminCatCount = countMemberItems(categories, adminIds, true);
        const adminClientCount = countMemberItems(clients, adminIds, true);
        const adminBusCount = countMemberItems(businesses, adminIds, true);

        const adminData = {
            name: wsInfo.adminName || 'Founder',
            email: wsInfo.adminEmail || 'admin@workspace.com',
            id: wsInfo.adminId || adminUid,
            role: 'CREATOR_ADMIN',
            isPending: false,
            joinedAt: wsInfo.createdAt,
            productCount: Math.max(adminPCount, Number(wsInfo.adminProductCount ?? 0)),
            invoiceCount: Math.max(adminInvCount, Number(wsInfo.adminInvoiceCount ?? 0)),
            categoryCount: Math.max(adminCatCount, Number(wsInfo.adminCategoryCount ?? 0)),
            clientCount: Math.max(adminClientCount, Number(wsInfo.adminClientCount ?? 0)),
            businessCount: Math.max(adminBusCount, Number(wsInfo.adminBusinessCount ?? 0)),
            totalDeleted: Number(wsInfo.adminTotalDeleted ?? wsDataFallback(wsInfo.adminTotalDeletedCount, 0))
        };

        const mapMemberDataWithLiveCounts = (m) => {
            const mData = mapMemberData(m);
            const mIds = [
                m.email, 
                m.workerUid, 
                m.appWorkerId, 
                m.uniqueId, 
                m.id
            ].filter(Boolean).map(s => String(s).trim().toLowerCase());

            const pCount = countMemberItems(products, mIds, false);
            const invCount = countMemberItems(allInvoices, mIds, false);
            const catCount = countMemberItems(categories, mIds, false);
            const clCount = countMemberItems(clients, mIds, false);
            const bCount = countMemberItems(businesses, mIds, false);

            mData.productCount = Math.max(pCount, mData.productCount);
            mData.invoiceCount = Math.max(invCount, mData.invoiceCount);
            mData.categoryCount = Math.max(catCount, mData.categoryCount);
            mData.clientCount = Math.max(clCount, mData.clientCount);
            mData.businessCount = Math.max(bCount, mData.businessCount);
            return mData;
        };

        const coAdmins = rawMembers.filter(m => {
            const rUpper = (m.role || '').toUpperCase();
            return (rUpper === 'CO_ADMIN' || rUpper === 'CO-ADMIN') && (m.email || '').toLowerCase() !== adminEmail;
        }).map(m => mapMemberDataWithLiveCounts(m));

        const workers = rawMembers.filter(m => {
            const rUpper = (m.role || '').toUpperCase();
            return (rUpper !== 'CO_ADMIN' && rUpper !== 'CO-ADMIN' && rUpper !== 'CREATOR_ADMIN' && rUpper !== 'ADMIN') && (m.email || '').toLowerCase() !== adminEmail;
        }).map(m => mapMemberDataWithLiveCounts(m));

        // Aggregate Totals across all members
        const allMemberList = [adminData, ...coAdmins, ...workers];
        const totalTeamProducts = allMemberList.reduce((acc, m) => acc + (m.productCount || 0), 0);
        const totalTeamInvoices = allMemberList.reduce((acc, m) => acc + (m.invoiceCount || 0), 0);
        const totalTeamCategories = allMemberList.reduce((acc, m) => acc + (m.categoryCount || 0), 0);
        const totalTeamDeletions = allMemberList.reduce((acc, m) => acc + (m.totalDeleted || 0), 0);

        container.innerHTML = `
            <div class="module-header" style="margin-bottom: 1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                    <h2 style="margin:0 0 0.35rem 0;">Workspace Members</h2>
                    <p style="color: var(--text-secondary); margin: 0;">View activity, creations, and deletion statistics for all connected members.</p>
                </div>
                <div style="display:flex; gap:0.75rem;">
                    <button class="btn btn-secondary" onclick="window.location.hash='#/workers'" style="font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        Permissions & Invite
                    </button>
                </div>
            </div>

            <!-- 1. WORKSPACE HEADER SECTION (Android Parity) -->
            <div class="card" style="padding: 1.75rem 2rem; border-radius: 14px; margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--surface-0), var(--surface-50)); border: 1px solid var(--border-color); box-shadow: var(--shadow-sm);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="font-size:0.72rem; font-weight:800; color:var(--primary); letter-spacing:0.08em; text-transform:uppercase; margin-bottom:0.35rem;">
                            WORKSPACE ACTIVITY HUB
                        </div>
                        <h1 style="font-size:1.6rem; font-weight:800; color:var(--text-primary); margin:0 0 0.4rem 0;">
                            ${wsInfo.name || 'Workspace'}
                        </h1>
                        <p style="color: var(--text-secondary); font-size:0.92rem; margin:0;">
                            Tracking creation contributions and deletion audits across all team members.
                        </p>
                    </div>
                    <div style="background:var(--surface-100); padding:0.6rem 1rem; border-radius:10px; border:1px solid var(--border-color); font-size:0.85rem;">
                        <span style="color:var(--text-secondary);">Workspace ID:</span> 
                        <code style="font-family:monospace; font-weight:700; color:var(--text-primary); margin-left:4px;">${wsInfo.workspaceId || adminUid}</code>
                    </div>
                </div>

                <!-- Aggregate Statistics Overview -->
                <div style="margin-top:1.5rem; display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem; border-top:1px solid var(--border-color); padding-top:1.25rem;">
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Members</div>
                        <div style="font-size:1.45rem; font-weight:800; color:var(--text-primary);">${allMemberList.length}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Products Created</div>
                        <div style="font-size:1.45rem; font-weight:800; color:var(--text-primary);">${totalTeamProducts}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Invoices Created</div>
                        <div style="font-size:1.45rem; font-weight:800; color:var(--primary);">${totalTeamInvoices}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Categories</div>
                        <div style="font-size:1.45rem; font-weight:800; color:var(--text-primary);">${totalTeamCategories}</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-size:0.75rem; font-weight:600; color:#b91c1c; text-transform:uppercase;">Total Deletions</div>
                        <div style="font-size:1.45rem; font-weight:800; color:#b91c1c;">${totalTeamDeletions}</div>
                    </div>
                </div>
            </div>

            <!-- Search Filter Bar -->
            <div style="margin-bottom: 1.5rem; display:flex; gap:0.75rem;">
                <input type="text" id="members-search-input" placeholder="Search members by email, name or ID..." style="flex:1; padding:0.65rem 1rem; border-radius:10px; border:1px solid var(--border-color); font-size:0.9rem; background:var(--surface-0); color:var(--text-primary);">
            </div>

            <!-- 2. MEMBERS LIST SECTION (Android Parity) -->
            <div id="members-container-list" style="display:flex; flex-direction:column; gap:1.75rem;">
                
                <!-- SECTION: ADMINISTRATOR -->
                <div class="member-group-section" data-group="admin">
                    <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.75rem; padding-left:0.25rem;">
                        ADMINISTRATOR
                    </div>
                    ${renderMemberRowHtml(adminData, true)}
                </div>

                <!-- SECTION: CO-ADMINS -->
                ${coAdmins.length > 0 ? `
                    <div class="member-group-section" data-group="coadmin">
                        <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.75rem; padding-left:0.25rem;">
                            CO-ADMINS (${coAdmins.length})
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.85rem;">
                            ${coAdmins.map(ca => renderMemberRowHtml(ca, false)).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- SECTION: WORKERS -->
                ${workers.length > 0 ? `
                    <div class="member-group-section" data-group="worker">
                        <div style="font-size:0.75rem; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.75rem; padding-left:0.25rem;">
                            WORKERS (${workers.length})
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.85rem;">
                            ${workers.map(w => renderMemberRowHtml(w, false)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${coAdmins.length === 0 && workers.length === 0 ? `
                    <div class="card" style="padding: 2rem; text-align:center; color:var(--text-secondary); border-radius:12px;">
                        <p style="margin:0;">No additional workers or co-admins joined this workspace yet.</p>
                        <button class="btn btn-sm btn-primary mt-12" onclick="window.location.hash='#/workers'" style="margin-top:0.75rem;">+ Invite Worker</button>
                    </div>
                ` : ''}
            </div>
        `;

        // Attach Expand / Collapse Toggle Listeners
        container.querySelectorAll('.member-row-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.getAttribute('data-target');
                const content = container.querySelector(`#${targetId}`);
                const arrow = header.querySelector('.expand-icon');
                if (content) {
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    if (arrow) {
                        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                }
            });
        });

        // Search Filter
        const searchInput = container.querySelector('#members-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                container.querySelectorAll('.member-card-wrapper').forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(query) ? 'block' : 'none';
                });
            });
        }

    } catch (err) {
        console.error("renderMembers error:", err);
        container.innerHTML = `
            <div class="card" style="padding:2rem; text-align:center; color:var(--danger);">
                Failed to load members activity. Please refresh the page.
            </div>
        `;
    }
};

const wsDataFallback = (val, fallback) => {
    return (val !== undefined && val !== null) ? val : fallback;
};

const mapMemberData = (m) => {
    const isPending = (m.status || '').toUpperCase() === 'PENDING';
    const isRestricted = !isPending && Boolean(m.isRestricted);
    return {
        name: isPending ? 'Pending Invite' : (m.name || 'Worker'),
        email: m.email || '—',
        id: m.appWorkerId || m.workerUid || 'N/A',
        role: m.role || 'Worker',
        isPending: isPending,
        isRestricted: isRestricted,
        status: m.status || (isRestricted ? 'Restricted' : 'Joined'),
        joinedAt: m.joinedAt || m.timestamp || 0,
        productCount: Number(m.productAdded ?? 0),
        invoiceCount: Number(m.invoiceAdded ?? 0),
        categoryCount: Number(m.categoryAdded ?? 0),
        clientCount: Number(m.clientAdded ?? 0),
        businessCount: Number(m.businessAdded ?? 0),
        totalDeleted: Number(m.totalDeleted ?? 0)
    };
};

const renderMemberRowHtml = (member, defaultExpanded = false) => {
    const uniqueRowId = 'member-row-' + Math.random().toString(36).substring(2, 9);
    
    // Status dot color logic matching MembersScreen.kt
    let dotColor = '#10b981'; // Joined Green
    let statusText = 'Joined';
    if (member.isPending) {
        dotColor = '#f59e0b'; // Pending Orange
        statusText = 'Pending';
    } else if (member.isRestricted) {
        dotColor = '#ef4444'; // Restricted Red
        statusText = 'Restricted';
    }

    const joinedDateFormatted = (() => {
        if (!member.joinedAt) return 'N/A';
        const d = typeof member.joinedAt === 'number' 
            ? new Date(member.joinedAt) 
            : (member.joinedAt.toDate ? member.joinedAt.toDate() : new Date());
        return isNaN(d.getTime()) ? 'Active' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    })();

    return `
        <div class="member-card-wrapper card" style="padding:0; border-radius:12px; border:1px solid var(--border-color); overflow:hidden; box-shadow:var(--shadow-sm); margin-bottom:0.75rem;">
            <!-- Header Row -->
            <div class="member-row-header" data-target="${uniqueRowId}" style="padding:1.15rem 1.5rem; display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:var(--surface-0); transition:background 0.15s ease;">
                <div style="display:flex; align-items:center; gap:1rem; overflow:hidden;">
                    <!-- Status dot -->
                    <div style="width:10px; height:10px; min-width:10px; border-radius:50%; background:${dotColor}; box-shadow:0 0 6px ${dotColor}80;"></div>
                    
                    <div style="overflow:hidden;">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <strong style="font-size:1rem; color:var(--text-primary);">${member.email}</strong>
                            ${getRoleBadgeHtml(member.role)}
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.15rem;">
                            <span style="font-weight:600; color:${member.isPending ? dotColor : 'var(--text-primary)'};">${member.name}</span>
                            ${member.id !== 'N/A' ? ` • <code style="font-family:monospace; font-size:0.78rem;">ID: ${member.id}</code>` : ''}
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:1rem;">
                    <div style="text-align:right; font-size:0.8rem; color:var(--text-muted); display:none; @media(min-width:600px){display:block;}">
                        <div>Created: <strong style="color:var(--text-primary);">${member.productCount + member.invoiceCount}</strong></div>
                    </div>
                    <button type="button" class="icon-btn" aria-label="Toggle Details" style="pointer-events:none;">
                        <svg class="expand-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s ease; transform:${defaultExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Expandable Metrics Body (Matching Android ExpandableMemberRow) -->
            <div id="${uniqueRowId}" class="member-row-body" style="display:${defaultExpanded ? 'block' : 'none'}; padding:1.25rem 1.5rem; background:var(--surface-50); border-top:1px solid var(--border-color);">
                <div style="font-size:0.72rem; font-weight:800; color:var(--primary); text-transform:uppercase; letter-spacing:0.06em; margin-bottom:1rem;">
                    JOINED: ${joinedDateFormatted.toUpperCase()}
                </div>

                <!-- Clean Grid of Member Creations -->
                <div style="background:var(--surface-0); border:1px solid var(--border-color); border-radius:10px; padding:1.25rem; margin-bottom:1rem;">
                    <div style="font-size:0.88rem; font-weight:700; color:var(--text-primary); margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        Creation Contributions
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap:1rem;">
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Products</div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${member.productCount}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Invoices</div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--primary); margin-top:2px;">${member.invoiceCount}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Categories</div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${member.categoryCount}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Clients</div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${member.clientCount}</div>
                        </div>
                        <div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">Businesses</div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${member.businessCount}</div>
                        </div>
                    </div>
                </div>

                <!-- Highlighted Deletion Tracker -->
                <div style="background:rgba(239, 68, 68, 0.08); border:1.5px solid rgba(239, 68, 68, 0.3); border-radius:8px; padding:0.85rem 1.15rem; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#ef4444;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <strong style="color:#b91c1c; font-size:0.88rem;">Total Deletions</strong>
                    </div>
                    <div style="font-size:1.35rem; font-weight:900; color:#b91c1c; font-family:monospace; background:white; padding:0.15rem 0.65rem; border-radius:6px; border:1px solid rgba(239,68,68,0.25);">
                        ${String(member.totalDeleted).padStart(2, '0')}
                    </div>
                </div>
            </div>
        </div>
    `;
};
