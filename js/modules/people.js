import { getPeopleService } from '../services/peopleService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { storageService } from '../../supabase/storage.js';

export const renderPeople = async (container, workspaceId, defaultTab = 'customers') => {
    const peopleService = getPeopleService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    let currentTab = defaultTab; // 'customers', 'clients', or 'businesses'
    let dataList = [];
    let allInvoices = [];
    let activePersonDetail = null; // When non-null, shows dedicated large informative detail view
    let activeDetailTab = 'invoices'; // 'invoices', 'payments', 'notes'
    
    const isBusinessMode = defaultTab === 'businesses';

    // Fetch invoices to link real transaction data
    const fetchInvoices = async () => {
        try {
            const [custInvs, busInvs] = await Promise.all([
                invoiceService.getAllInvoices(false).catch(() => []),
                invoiceService.getAllInvoices(true).catch(() => [])
            ]);
            allInvoices = [...custInvs, ...busInvs];
        } catch (e) {
            console.warn("Could not fetch invoices:", e);
            allInvoices = [];
        }
    };

    // Calculate invoice stats for a person
    const getPersonStats = (person) => {
        if (!person) return { count: 0, totalSpent: 0, lastDate: null, due: 0, invoices: [] };
        const uId = person.uniqueId || person.id;
        const name = (person.name || '').trim().toLowerCase();
        const phone = (person.phone || '').trim();
        const email = (person.email || '').trim().toLowerCase();

        const matchedInvoices = allInvoices.filter(inv => {
            if (currentTab === 'businesses' || isBusinessMode) {
                return (inv.businessId && (inv.businessId === uId || inv.businessId === person.id)) ||
                       (inv.businessName && inv.businessName.trim().toLowerCase() === name);
            } else if (currentTab === 'clients') {
                return (inv.clientId && (inv.clientId === uId || inv.clientId === person.id)) ||
                       (email && inv.clientEmail && inv.clientEmail.trim().toLowerCase() === email) ||
                       (phone && inv.clientPhone && inv.clientPhone.trim() === phone) ||
                       (inv.clientName && inv.clientName.trim().toLowerCase() === name);
            } else {
                return (inv.customerId && (inv.customerId === uId || inv.customerId === person.id)) ||
                       (inv.customerName && inv.customerName.trim().toLowerCase() === name) ||
                       (phone && inv.customerNumber && inv.customerNumber.trim() === phone);
            }
        });

        // Sort descending by timestamp / date
        matchedInvoices.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

        let totalSpent = 0;
        let due = 0;

        matchedInvoices.forEach(inv => {
            const amt = Number(inv.totalPrice || inv.total || inv.amount || 0);
            totalSpent += amt;
            const status = String(inv.status || 'Paid').toLowerCase();
            if (status === 'unpaid' || status === 'pending' || status === 'due') {
                due += amt;
            }
        });

        const lastInv = matchedInvoices[0];
        const lastDate = lastInv ? (lastInv.timestamp ? new Date(lastInv.timestamp).toLocaleDateString() : 'Recent') : 'No Orders Yet';

        return {
            count: matchedInvoices.length,
            totalSpent,
            due,
            lastDate,
            invoices: matchedInvoices
        };
    };

    // Calculate 6-month monthly spend history for chart
    const getMonthlyChartData = (invoices) => {
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                label: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                amount: 0
            });
        }

        invoices.forEach(inv => {
            const t = Number(inv.timestamp) || 0;
            if (t > 0) {
                const invDate = new Date(t);
                const mIdx = months.findIndex(m => m.year === invDate.getFullYear() && m.month === invDate.getMonth());
                if (mIdx !== -1) {
                    months[mIdx].amount += Number(inv.totalPrice || inv.total || inv.amount || 0);
                }
            }
        });

        return months;
    };

    // Escape helper
    const escapeHtml = (str) => {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    };

    // -------------------------------------------------------------
    // RENDER MAIN VIEW (List or Details)
    // -------------------------------------------------------------
    const render = () => {
        if (activePersonDetail) {
            renderDedicatedDetailView();
        } else {
            renderListView();
        }
    };

    // -------------------------------------------------------------
    // LIST VIEW
    // -------------------------------------------------------------
    const renderListView = () => {
        const typeTitle = isBusinessMode ? 'Businesses & B2B' : 'Customers & Clients';

        container.innerHTML = `
            <div class="people-module-container" style="animation: fadeIn 0.25s ease;">
                <!-- HEADER -->
                <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">${typeTitle}</h2>
                            <span class="badge" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; font-weight:700; font-size:0.8rem; padding:0.25rem 0.65rem; border-radius:999px;">
                                ${dataList.length} ${isBusinessMode ? 'Businesses' : (currentTab === 'clients' ? 'Clients' : 'Customers')}
                            </span>
                        </div>
                        <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:var(--text-secondary);">
                            Manage directory profiles, track transactions, outstanding balances, and customer history.
                        </p>
                    </div>
                    
                    <div style="display:flex; gap:0.6rem; align-items:center;">
                        <button id="btn-add-person" class="btn btn-primary" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow:0 4px 12px rgba(225,29,72,0.3); padding:0.55rem 1.25rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}
                        </button>
                    </div>
                </div>
                
                <!-- TABS (When not in B2B standalone mode) -->
                ${!isBusinessMode ? `
                    <div style="display:flex; gap:0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                        <button class="people-tab-btn ${currentTab === 'customers' ? 'active-people-tab' : ''}" data-tab="customers">
                            <span style="font-size:1.1rem;">👤</span> Customers (${dataList.filter(d => !d.isClient).length || dataList.length})
                        </button>
                        <button class="people-tab-btn ${currentTab === 'clients' ? 'active-people-tab' : ''}" data-tab="clients">
                            <span style="font-size:1.1rem;">💼</span> Clients
                        </button>
                    </div>
                ` : ''}

                <!-- ADD / EDIT PERSON MODAL FORM -->
                <div id="person-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem; border:1px solid #fecdd3; background:#ffffff; box-shadow:0 10px 25px rgba(225,29,72,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                        <h3 id="person-form-title" style="margin:0; font-size:1.2rem; font-weight:700; color:var(--text-primary);">New Entry</h3>
                        <button type="button" id="person-cancel-x" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);">✕</button>
                    </div>

                    <form id="person-form" style="display:flex; flex-direction:column; gap:1.25rem;">
                        <input type="hidden" id="person-id">
                        
                        <!-- AVATAR / PHOTO UPLOAD SECTION -->
                        <div style="display:flex; align-items:center; gap:1.25rem; background:var(--surface-50); padding:1rem; border-radius:12px; border:1px dashed var(--border-color); flex-wrap:wrap;">
                            <div style="position:relative; width:68px; height:68px; border-radius:50%; overflow:hidden; background:#ffffff; border:2px solid #fecdd3; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                                <img id="person-avatar-preview" src="" alt="Avatar" style="width:100%; height:100%; object-fit:cover; display:none;">
                                <div id="person-avatar-placeholder" style="font-size:1.8rem; color:#e11d48; font-weight:700;">👤</div>
                            </div>
                            <div style="flex:1; min-width:220px;">
                                <label style="font-weight:700; font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Profile Image / Logo</label>
                                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                                    <label class="btn btn-secondary" style="cursor:pointer; font-size:0.82rem; padding:0.35rem 0.75rem; margin:0; font-weight:600;">
                                        📁 Choose Image File
                                        <input type="file" id="person-image-file" accept="image/*" style="display:none;">
                                    </label>
                                    <input type="text" id="person-image-url" placeholder="or paste Image URL (https://...)" class="form-control" style="flex:1; min-width:180px; font-size:0.82rem; padding:0.35rem 0.6rem;">
                                </div>
                                <small style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; display:block;">Supported formats: JPG, PNG, WEBP, SVG. Appears in directory and invoice slips.</small>
                            </div>
                        </div>

                        <!-- BASIC FIELDS -->
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Full Name / Company Title *</label>
                                <input type="text" id="person-name" required class="form-control" placeholder="e.g. Rahman Traders" style="width:100%; padding:0.55rem 0.75rem;">
                            </div>
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Phone Number</label>
                                <input type="text" id="person-phone" class="form-control" placeholder="e.g. +880 1712 345678" style="width:100%; padding:0.55rem 0.75rem;">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Email Address</label>
                                <input type="email" id="person-email" class="form-control" placeholder="e.g. contact@example.com" style="width:100%; padding:0.55rem 0.75rem;">
                            </div>
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Address / Location</label>
                                <input type="text" id="person-address" class="form-control" placeholder="e.g. House 12, Road 5, Dhaka" style="width:100%; padding:0.55rem 0.75rem;">
                            </div>
                        </div>

                        <!-- TAGS & NOTES -->
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Tags (Comma Separated)</label>
                                <input type="text" id="person-tags" class="form-control" placeholder="e.g. Retail, Wholesale, Regular Customer, VIP" style="width:100%; padding:0.55rem 0.75rem;">
                            </div>
                            <div>
                                <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Status</label>
                                <select id="person-status" class="form-control" style="width:100%; padding:0.55rem 0.75rem;">
                                    <option value="Active">🟢 Active</option>
                                    <option value="Pending">🟡 Pending</option>
                                    <option value="Inactive">⚪ Inactive</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Internal Notes & Remarks</label>
                            <textarea id="person-notes" rows="2" class="form-control" placeholder="Add custom customer notes, delivery guidelines, or payment terms..." style="width:100%; padding:0.55rem 0.75rem; font-family:inherit;"></textarea>
                        </div>

                        <!-- ACTIONS -->
                        <div style="display:flex; gap:0.75rem; margin-top:0.5rem; justify-content:flex-end;">
                            <button type="button" class="btn btn-secondary" id="person-cancel-btn" style="padding:0.55rem 1.25rem;">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="person-submit-btn" style="background:#e11d48; border-color:#e11d48; font-weight:700; padding:0.55rem 1.5rem;">Save Profile</button>
                        </div>
                    </form>
                </div>

                <!-- DIRECTORY TABLE -->
                <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em;">
                                    <th style="padding:1rem 1.25rem;">Profile & Name</th>
                                    <th style="padding:1rem;">Contact Info</th>
                                    <th style="padding:1rem;">Address</th>
                                    <th style="padding:1rem;">Total Spent</th>
                                    <th style="padding:1rem;">Invoices</th>
                                    <th style="padding:1rem 1.25rem; text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="people-list-body">
                                ${Array(4).fill(0).map(() => `
                                    <tr style="border-bottom:1px solid var(--border-color);">
                                        <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width:160px; height:18px;"></div></td>
                                        <td style="padding:1rem;"><div class="skeleton-shimmer" style="width:120px; height:16px;"></div></td>
                                        <td style="padding:1rem;"><div class="skeleton-shimmer" style="width:140px; height:16px;"></div></td>
                                        <td style="padding:1rem;"><div class="skeleton-shimmer" style="width:80px; height:16px;"></div></td>
                                        <td style="padding:1rem;"><div class="skeleton-shimmer" style="width:60px; height:20px; border-radius:999px;"></div></td>
                                        <td style="padding:1rem 1.25rem; text-align:right;"><div class="skeleton-shimmer" style="width:100px; height:28px; border-radius:6px; margin-left:auto;"></div></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>
                .people-tab-btn {
                    padding: 0.65rem 1.25rem;
                    background: none;
                    border: none;
                    border-bottom: 2.5px solid transparent;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    transition: all 0.2s ease;
                }
                .people-tab-btn:hover {
                    color: #e11d48;
                }
                .active-people-tab {
                    color: #e11d48;
                    border-bottom-color: #e11d48;
                    font-weight: 700;
                }
                .people-table-row {
                    border-bottom: 1px solid var(--border-color);
                    transition: background 0.15s ease;
                    cursor: pointer;
                }
                .people-table-row:hover {
                    background: #fff8f8;
                }
            </style>
        `;

        bindListEvents();
    };

    // -------------------------------------------------------------
    // DEDICATED INFORMATIVE & LARGE DETAIL VIEW
    // -------------------------------------------------------------
    const renderDedicatedDetailView = () => {
        const p = activePersonDetail;
        if (!p) {
            renderListView();
            return;
        }

        const stats = getPersonStats(p);
        const monthlyData = getMonthlyChartData(stats.invoices);
        const currSym = getAppCurrencySymbol();
        const typeLabel = isBusinessMode ? 'Business' : (p.isClient ? 'Client' : 'Customer');

        // Tags parsing
        const rawTags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',') : ['Regular Customer']);
        const tags = rawTags.map(t => String(t).trim()).filter(Boolean);
        if (tags.length === 0) tags.push(typeLabel);

        // Compute maximum value for chart scaling
        const maxVal = Math.max(...monthlyData.map(m => m.amount), 1000);

        container.innerHTML = `
            <div class="dedicated-detail-container" style="animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- BREADCRUMB & TOP NAV -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem;">
                        <button type="button" id="btn-back-to-people" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.35rem; padding:0;">
                            <span>←</span> Back to ${isBusinessMode ? 'Businesses' : (currentTab === 'clients' ? 'Clients' : 'Customers')}
                        </button>
                        <span style="color:var(--text-muted);">/</span>
                        <span style="color:var(--text-primary); font-weight:700;">${escapeHtml(p.name)}</span>
                    </div>

                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" id="btn-edit-detail-profile" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:0.35rem;">
                            ✏️ Edit Profile
                        </button>
                        <button type="button" id="btn-detail-create-invoice" class="btn btn-primary" style="background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.35rem; box-shadow:0 3px 10px rgba(225,29,72,0.25);">
                            + Create Invoice
                        </button>
                    </div>
                </div>

                <!-- ================= 1. TOP HERO PROFILE & KPI CARDS ================= -->
                <div class="hero-kpi-grid" style="display:grid; grid-template-columns: minmax(320px, 1.4fr) repeat(auto-fit, minmax(170px, 1fr)); gap:1rem; margin-bottom:1.5rem; align-items:stretch;">
                    
                    <!-- HERO PROFILE CARD -->
                    <div class="card" style="padding:1.5rem; background:#ffffff; border:1px solid #fecdd3; border-radius:16px; box-shadow:0 8px 24px rgba(225,29,72,0.06); display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
                        <div style="position:absolute; width:160px; height:160px; background:radial-gradient(circle, rgba(225,29,72,0.08) 0%, transparent 70%); top:-40px; right:-40px; border-radius:50%;"></div>
                        
                        <div>
                            <div style="display:flex; gap:1.25rem; align-items:center; margin-bottom:1rem;">
                                <!-- AVATAR WITH INSTANT UPLOAD HOVER -->
                                <div class="detail-hero-avatar-wrap" id="btn-quick-avatar-upload" title="Click to change profile picture" style="position:relative; width:80px; height:80px; border-radius:50%; overflow:hidden; background:linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%); border:3px solid #e11d48; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; box-shadow:0 4px 14px rgba(225,29,72,0.2);">
                                    ${p.imageUrl || p.imageUri ? `
                                        <img src="${escapeHtml(p.imageUrl || p.imageUri)}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover;">
                                    ` : `
                                        <span style="font-size:2rem; font-weight:800; color:#e11d48;">
                                            ${(p.name || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    `}
                                    <div class="avatar-hover-overlay">📷</div>
                                </div>

                                <div style="flex:1; min-width:160px;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.25rem;">
                                        <h1 style="margin:0; font-size:1.5rem; font-weight:800; color:var(--text-primary); line-height:1.2;">
                                            ${escapeHtml(p.name)}
                                        </h1>
                                        <span class="badge" style="background:#ecfdf5; color:#059669; border:1px solid #a7f3d0; font-size:0.75rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:999px;">
                                            ${p.status || 'Active'}
                                        </span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.35rem; color:var(--text-secondary); font-size:0.85rem; font-weight:600;">
                                        <span>💼</span> ${typeLabel} Profile
                                    </div>
                                </div>
                            </div>

                            <!-- INLINE METADATA -->
                            <div style="display:flex; flex-wrap:wrap; gap:1rem; font-size:0.83rem; color:var(--text-secondary); margin-bottom:1rem; padding-top:0.5rem; border-top:1px solid #f1f5f9;">
                                ${p.phone ? `
                                    <a href="tel:${p.phone}" style="display:flex; align-items:center; gap:0.35rem; color:inherit; text-decoration:none; font-weight:500;">
                                        <span style="color:#e11d48;">📞</span> ${escapeHtml(p.phone)}
                                    </a>
                                ` : ''}
                                ${p.email ? `
                                    <a href="mailto:${p.email}" style="display:flex; align-items:center; gap:0.35rem; color:inherit; text-decoration:none; font-weight:500;">
                                        <span style="color:#e11d48;">✉️</span> ${escapeHtml(p.email)}
                                    </a>
                                ` : ''}
                                ${p.address ? `
                                    <span style="display:flex; align-items:center; gap:0.35rem; font-weight:500;">
                                        <span style="color:#e11d48;">📍</span> ${escapeHtml(p.address)}
                                    </span>
                                ` : ''}
                            </div>
                        </div>

                        <!-- TAGS BADGES -->
                        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                            ${tags.map(tag => `
                                <span style="background:#f8fafc; border:1px solid var(--border-color); color:var(--text-secondary); font-size:0.75rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:6px;">
                                    ${escapeHtml(tag)}
                                </span>
                            `).join('')}
                        </div>
                    </div>

                    <!-- 4 STAT CARDS -->
                    
                    <!-- 1. Total Orders / Invoices -->
                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Orders</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#eff6ff; color:#3b82f6; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                                🛒
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0;">
                                ${stats.count}
                            </div>
                            <div style="font-size:0.75rem; color:#10b981; font-weight:700; display:flex; align-items:center; gap:0.25rem;">
                                <span>↑ 20%</span> <span style="color:var(--text-muted); font-weight:500;">vs last 3 months</span>
                            </div>
                        </div>
                    </div>

                    <!-- 2. Total Spent / Revenue -->
                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Spent</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#ecfdf5; color:#10b981; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                                💵
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${currSym} ${stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style="font-size:0.75rem; color:#10b981; font-weight:700; display:flex; align-items:center; gap:0.25rem;">
                                <span>↑ 15%</span> <span style="color:var(--text-muted); font-weight:500;">active spend</span>
                            </div>
                        </div>
                    </div>

                    <!-- 3. Last Order -->
                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Last Order</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#fdf2f8; color:#db2777; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                                📅
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.35rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0; white-space:nowrap;">
                                ${stats.lastDate}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">
                                ${stats.invoices.length > 0 ? 'Latest invoice synced' : 'No recorded transactions'}
                            </div>
                        </div>
                    </div>

                    <!-- 4. Outstanding Due / Pending -->
                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid ${stats.due > 0 ? '#fecdd3' : 'var(--border-color)'}; display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Outstanding Due</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#fff1f2; color:#e11d48; display:flex; align-items:center; justify-content:center; font-size:1.1rem;">
                                ⚠️
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:${stats.due > 0 ? '#e11d48' : 'var(--text-primary)'}; margin:0.25rem 0;">
                                ${currSym} ${stats.due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">
                                ${stats.due > 0 ? 'Pending payment settlement' : 'All invoices cleared'}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ================= 2. TWO-COLUMN WORKSPACE BODY ================= -->
                <div style="display:grid; grid-template-columns: 310px 1fr; gap:1.25rem; align-items:start;" class="detail-body-grid">
                    
                    <!-- LEFT COLUMN: DETAILED INFO & QUICK ACTIONS -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        
                        <!-- Customer Information Card -->
                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                <span>👤</span> ${typeLabel} Information
                            </h3>

                            <div style="display:flex; flex-direction:column; gap:0.85rem; font-size:0.88rem;">
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Full Name</span>
                                    <strong style="color:var(--text-primary);">${escapeHtml(p.name)}</strong>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Phone</span>
                                    <span style="color:var(--text-primary);">${p.phone ? `<a href="tel:${p.phone}" style="color:var(--primary); font-weight:600; text-decoration:none;">${escapeHtml(p.phone)}</a>` : '—'}</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Email</span>
                                    <span style="color:var(--text-primary);">${p.email ? `<a href="mailto:${p.email}" style="color:var(--primary); font-weight:600; text-decoration:none;">${escapeHtml(p.email)}</a>` : '—'}</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Address</span>
                                    <span style="color:var(--text-primary);">${escapeHtml(p.address || '—')}</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Customer Type</span>
                                    <span style="color:var(--text-primary); font-weight:600;">${typeLabel} Profile</span>
                                </div>
                                <div>
                                    <span style="color:var(--text-muted); font-size:0.75rem; font-weight:600; text-transform:uppercase; display:block;">Account ID</span>
                                    <code style="font-size:0.78rem; color:#be123c; background:#fff1f2; padding:0.15rem 0.45rem; border-radius:4px;">${p.uniqueId || p.id}</code>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Actions Card -->
                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                <span>⚡</span> Quick Actions
                            </h3>

                            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                <button type="button" id="btn-quick-new-invoice" class="btn btn-primary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:700; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding:0.65rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Create Invoice
                                </button>
                                
                                <button type="button" id="btn-quick-add-note" class="btn btn-secondary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:600; padding:0.6rem;">
                                    <span>📝</span> Add / Edit Notes
                                </button>
                                
                                <button type="button" id="btn-quick-avatar-upload-2" class="btn btn-secondary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:600; padding:0.6rem;">
                                    <span>📷</span> Change Photo / Image
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT MAIN COLUMN: TABS, INVOICE TABLE & SALES CHART -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        
                        <!-- TABBED SECTION CARD -->
                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            
                            <!-- TAB BUTTONS -->
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                                <div style="display:flex; gap:0.75rem;">
                                    <button type="button" class="detail-subtab-btn ${activeDetailTab === 'invoices' ? 'active-subtab' : ''}" data-subtab="invoices">
                                        Orders & Invoices (${stats.invoices.length})
                                    </button>
                                    <button type="button" class="detail-subtab-btn ${activeDetailTab === 'notes' ? 'active-subtab' : ''}" data-subtab="notes">
                                        Notes & Remarks
                                    </button>
                                </div>

                                <button type="button" class="btn btn-secondary btn-sm" onclick="window.location.hash='#/${isBusinessMode ? 'invoices/business' : 'invoices/customer'}'" style="font-size:0.78rem; padding:0.3rem 0.75rem; font-weight:600;">
                                    View All Invoices ↗
                                </button>
                            </div>

                            <!-- TAB CONTENT: INVOICES TABLE -->
                            ${activeDetailTab === 'invoices' ? `
                                <div style="overflow-x:auto;">
                                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                                        <thead>
                                            <tr style="border-bottom:1px solid var(--border-color); font-size:0.75rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">
                                                <th style="padding:0.75rem;"># Invoice No</th>
                                                <th style="padding:0.75rem;">Date</th>
                                                <th style="padding:0.75rem;">Items</th>
                                                <th style="padding:0.75rem;">Total Amount</th>
                                                <th style="padding:0.75rem;">Status</th>
                                                <th style="padding:0.75rem; text-align:right;">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${stats.invoices.length === 0 ? `
                                                <tr>
                                                    <td colspan="6" style="padding:2.5rem 1rem; text-align:center; color:var(--text-muted);">
                                                        <div style="font-size:2rem; margin-bottom:0.5rem;">🧾</div>
                                                        <strong>No Invoices Found</strong>
                                                        <p style="margin:0.25rem 0 1rem 0; font-size:0.85rem;">No invoices have been billed to this profile yet.</p>
                                                        <button type="button" id="btn-tab-empty-invoice" class="btn btn-primary btn-sm" style="background:#e11d48; font-weight:700;">+ Create First Invoice</button>
                                                    </td>
                                                </tr>
                                            ` : stats.invoices.map(inv => {
                                                const invId = inv.id;
                                                const invNum = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId || 'INV-DRAFT';
                                                const dateStr = inv.timestamp ? new Date(inv.timestamp).toLocaleDateString() : 'Recent';
                                                const itemsCount = (inv.items || []).length;
                                                const amount = Number(inv.totalPrice || inv.total || 0);
                                                const st = String(inv.status || 'Paid');
                                                const isPaid = st.toLowerCase() === 'paid' || st.toLowerCase() === 'completed';

                                                return `
                                                    <tr style="border-bottom:1px solid var(--border-color);" class="detail-inv-row">
                                                        <td style="padding:0.85rem 0.75rem; font-weight:700; color:var(--text-primary); font-family:monospace;">
                                                            ${escapeHtml(invNum)}
                                                        </td>
                                                        <td style="padding:0.85rem 0.75rem; font-size:0.85rem; color:var(--text-secondary);">
                                                            ${dateStr}
                                                        </td>
                                                        <td style="padding:0.85rem 0.75rem; font-size:0.85rem; color:var(--text-secondary);">
                                                            ${itemsCount} ${itemsCount === 1 ? 'item' : 'items'}
                                                        </td>
                                                        <td style="padding:0.85rem 0.75rem; font-weight:800; color:var(--text-primary);">
                                                            ${currSym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td style="padding:0.85rem 0.75rem;">
                                                            <span class="badge" style="background:${isPaid ? '#ecfdf5' : '#fff1f2'}; color:${isPaid ? '#059669' : '#e11d48'}; border:1px solid ${isPaid ? '#a7f3d0' : '#fecdd3'}; font-size:0.75rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:999px;">
                                                                ${escapeHtml(st)}
                                                            </span>
                                                        </td>
                                                        <td style="padding:0.85rem 0.75rem; text-align:right;">
                                                            <button type="button" class="btn btn-secondary btn-sm btn-view-invoice-modal" data-invid="${invId}" style="font-size:0.78rem; padding:0.25rem 0.65rem; font-weight:600;">
                                                                View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : `
                                <!-- TAB CONTENT: NOTES & REMARKS -->
                                <div style="padding:0.5rem 0;">
                                    <div style="margin-bottom:1rem;">
                                        <label style="font-weight:700; font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.4rem;">Customer Remarks & Notes</label>
                                        <textarea id="detail-notes-input" rows="4" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="Type notes regarding customer preferences, payment instructions, delivery address details...">${escapeHtml(p.notes || '')}</textarea>
                                    </div>
                                    <button type="button" id="btn-save-detail-notes" class="btn btn-primary" style="background:#e11d48; border-color:#e11d48; font-weight:700; padding:0.5rem 1.25rem;">
                                        💾 Save Notes
                                    </button>
                                </div>
                            `}

                        </div>

                        <!-- BOTTOM: SALES OVERVIEW CHART & RECENT INVOICES SUMMARY -->
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
                            
                            <!-- 6-MONTH SALES OVERVIEW GRAPH (SVG Area Curve) -->
                            <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                                    <div>
                                        <h3 style="margin:0; font-size:1rem; font-weight:700; color:var(--text-primary);">Sales Overview</h3>
                                        <span style="font-size:0.78rem; color:var(--text-muted);">Last 6 months purchase trend</span>
                                    </div>
                                    <span class="badge" style="background:#fff1f2; color:#e11d48; font-size:0.75rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:6px;">
                                        ● This Customer
                                    </span>
                                </div>

                                <!-- SVG Interactive Area Curve -->
                                <div style="height:170px; width:100%; position:relative;">
                                    <svg viewBox="0 0 500 160" style="width:100%; height:100%; overflow:visible;">
                                        <defs>
                                            <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stop-color="#e11d48" stop-opacity="0.35"/>
                                                <stop offset="100%" stop-color="#e11d48" stop-opacity="0.0"/>
                                            </linearGradient>
                                        </defs>

                                        <!-- Grid Lines -->
                                        <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4"/>
                                        <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4"/>
                                        <line x1="0" y1="130" x2="500" y2="130" stroke="#f1f5f9" stroke-width="1"/>

                                        <!-- Construct SVG Curve Points -->
                                        ${(() => {
                                            const pts = monthlyData.map((m, idx) => {
                                                const x = (idx / (monthlyData.length - 1)) * 480 + 10;
                                                const y = 130 - (m.amount / maxVal) * 100;
                                                return { x, y, ...m };
                                            });

                                            let pathD = `M ${pts[0].x} ${pts[0].y}`;
                                            for (let i = 1; i < pts.length; i++) {
                                                const prev = pts[i - 1];
                                                const curr = pts[i];
                                                const cx1 = prev.x + (curr.x - prev.x) / 2;
                                                const cx2 = cx1;
                                                pathD += ` C ${cx1} ${prev.y}, ${cx2} ${curr.y}, ${curr.x} ${curr.y}`;
                                            }

                                            const areaD = `${pathD} L ${pts[pts.length - 1].x} 130 L ${pts[0].x} 130 Z`;

                                            return `
                                                <path d="${areaD}" fill="url(#detailGrad)"/>
                                                <path d="${pathD}" fill="none" stroke="#e11d48" stroke-width="3" stroke-linecap="round"/>
                                                ${pts.map(p => `
                                                    <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="#e11d48" stroke-width="2.5">
                                                        <title>${p.label}: ${currSym} ${p.amount.toFixed(2)}</title>
                                                    </circle>
                                                `).join('')}
                                            `;
                                        })()}
                                    </svg>
                                </div>

                                <!-- X Axis Labels -->
                                <div style="display:flex; justify-content:space-between; margin-top:0.5rem; font-size:0.75rem; color:var(--text-muted); font-weight:600; padding:0 5px;">
                                    ${monthlyData.map(m => `<span>${m.label}</span>`).join('')}
                                </div>
                            </div>

                            <!-- QUICK RECENT INVOICES SNIPPET -->
                            <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                                <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary);">
                                    Recent Invoice History
                                </h3>

                                <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                    ${stats.invoices.slice(0, 4).map(inv => {
                                        const num = inv.invoiceNumber || inv.busInvNumber || 'INV';
                                        const dt = inv.timestamp ? new Date(inv.timestamp).toLocaleDateString() : 'Recent';
                                        const amt = Number(inv.totalPrice || inv.total || 0);
                                        const isPaid = String(inv.status || 'Paid').toLowerCase() === 'paid';

                                        return `
                                            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.75rem; background:var(--surface-50); border-radius:8px; border:1px solid var(--border-color);">
                                                <div>
                                                    <strong style="font-size:0.85rem; font-family:monospace; color:var(--text-primary); display:block;">${escapeHtml(num)}</strong>
                                                    <span style="font-size:0.75rem; color:var(--text-muted);">${dt}</span>
                                                </div>
                                                <div style="text-align:right;">
                                                    <strong style="font-size:0.88rem; color:var(--text-primary); display:block;">${currSym} ${amt.toFixed(2)}</strong>
                                                    <span style="font-size:0.7rem; font-weight:700; color:${isPaid ? '#059669' : '#e11d48'};">${inv.status || 'Paid'}</span>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                    ${stats.invoices.length === 0 ? `
                                        <div style="text-align:center; padding:1.5rem 0; font-size:0.85rem; color:var(--text-muted);">
                                            No recent transactions logged
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                        </div>

                    </div>

                </div>

            </div>

            <style>
                .detail-subtab-btn {
                    padding: 0.45rem 0.9rem;
                    background: none;
                    border: none;
                    font-size: 0.88rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    cursor: pointer;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                }
                .detail-subtab-btn:hover {
                    background: var(--surface-50);
                    color: #e11d48;
                }
                .active-subtab {
                    background: #fff1f2;
                    color: #e11d48;
                    font-weight: 700;
                }
                .detail-inv-row:hover {
                    background: #fff8f8;
                }
                .detail-hero-avatar-wrap .avatar-hover-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    color: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .detail-hero-avatar-wrap:hover .avatar-hover-overlay {
                    opacity: 1;
                }
                @media (max-width: 900px) {
                    .detail-body-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
        `;

        bindDetailEvents();
    };

    // -------------------------------------------------------------
    // ATTACH LIST EVENTS
    // -------------------------------------------------------------
    const bindListEvents = () => {
        const formContainer = container.querySelector('#person-form-container');
        const form = container.querySelector('#person-form');
        const title = container.querySelector('#person-form-title');
        const tbody = container.querySelector('#people-list-body');
        const btnAdd = container.querySelector('#btn-add-person');
        const btnCancel = container.querySelector('#person-cancel-btn');
        const btnCancelX = container.querySelector('#person-cancel-x');

        const avatarPreview = container.querySelector('#person-avatar-preview');
        const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
        const imageFileInput = container.querySelector('#person-image-file');
        const imageUrlInput = container.querySelector('#person-image-url');

        // Toggle add modal
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                form.reset();
                container.querySelector('#person-id').value = '';
                if (avatarPreview) avatarPreview.style.display = 'none';
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'block';
                title.textContent = `New ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}`;
                formContainer.style.display = 'block';
                formContainer.scrollIntoView({ behavior: 'smooth' });
            });
        }

        if (btnCancel) btnCancel.addEventListener('click', () => formContainer.style.display = 'none');
        if (btnCancelX) btnCancelX.addEventListener('click', () => formContainer.style.display = 'none');

        // Image file preview
        if (imageFileInput) {
            imageFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        if (avatarPreview) {
                            avatarPreview.src = re.target.result;
                            avatarPreview.style.display = 'block';
                        }
                        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Image URL preview
        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', () => {
                const val = imageUrlInput.value.trim();
                if (val) {
                    if (avatarPreview) {
                        avatarPreview.src = val;
                        avatarPreview.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                }
            });
        }

        // Tab Switching
        if (!isBusinessMode) {
            container.querySelectorAll('.people-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetTab = e.currentTarget.getAttribute('data-tab');
                    if (targetTab === currentTab) return;
                    currentTab = targetTab;
                    activePersonDetail = null;
                    formContainer.style.display = 'none';
                    loadData();
                });
            });
        }

        // Form Submit
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = container.querySelector('#person-submit-btn');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Saving...';
                }

                try {
                    const id = container.querySelector('#person-id').value;
                    let finalImageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';

                    // Upload image if file selected
                    const file = imageFileInput?.files?.[0];
                    if (file) {
                        try {
                            finalImageUrl = await storageService.uploadImage(file, workspaceId);
                        } catch (imgErr) {
                            console.warn("Storage upload warning, falling back:", imgErr);
                        }
                    }

                    const payload = {
                        name: container.querySelector('#person-name').value.trim(),
                        phone: container.querySelector('#person-phone').value.trim(),
                        email: container.querySelector('#person-email').value.trim(),
                        address: container.querySelector('#person-address').value.trim(),
                        tags: container.querySelector('#person-tags')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [],
                        status: container.querySelector('#person-status')?.value || 'Active',
                        notes: container.querySelector('#person-notes')?.value || '',
                        imageUrl: finalImageUrl,
                        imageUri: finalImageUrl
                    };

                    if (id) {
                        if (currentTab === 'customers') await peopleService.updateCustomer(id, payload);
                        else if (currentTab === 'businesses') await peopleService.updateBusiness(id, payload);
                        else if (currentTab === 'clients') await peopleService.updateClient(id, payload);
                        showAlert.success("Profile updated successfully!");
                    } else {
                        if (currentTab === 'customers') await peopleService.addCustomer(payload, currentUser?.uid);
                        else if (currentTab === 'businesses') await peopleService.addBusiness(payload, currentUser?.uid);
                        else if (currentTab === 'clients') await peopleService.addClient(payload, currentUser?.uid);
                        showAlert.success("Profile created successfully!");
                    }

                    formContainer.style.display = 'none';
                } catch (err) {
                    console.error("Save error:", err);
                    showAlert.error("Failed to save profile: " + (err.message || 'Error'));
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Save Profile';
                    }
                }
            });
        }
    };

    // -------------------------------------------------------------
    // ATTACH DETAIL EVENTS
    // -------------------------------------------------------------
    const bindDetailEvents = () => {
        const btnBack = container.querySelector('#btn-back-to-people');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                activePersonDetail = null;
                render();
            });
        }

        // Subtabs (Invoices vs Notes)
        container.querySelectorAll('.detail-subtab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeDetailTab = e.currentTarget.getAttribute('data-subtab');
                renderDedicatedDetailView();
            });
        });

        // Edit Profile from details
        const btnEdit = container.querySelector('#btn-edit-detail-profile');
        if (btnEdit && activePersonDetail) {
            btnEdit.addEventListener('click', () => {
                const p = activePersonDetail;
                activePersonDetail = null;
                renderListView();

                const formContainer = container.querySelector('#person-form-container');
                const title = container.querySelector('#person-form-title');
                const avatarPreview = container.querySelector('#person-avatar-preview');
                const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');

                container.querySelector('#person-id').value = p.id;
                container.querySelector('#person-name').value = p.name || '';
                container.querySelector('#person-phone').value = p.phone || '';
                container.querySelector('#person-email').value = p.email || '';
                container.querySelector('#person-address').value = p.address || '';
                if (container.querySelector('#person-tags')) {
                    container.querySelector('#person-tags').value = (p.tags || []).join(', ');
                }
                if (container.querySelector('#person-notes')) {
                    container.querySelector('#person-notes').value = p.notes || '';
                }

                const img = p.imageUrl || p.imageUri;
                if (img && avatarPreview) {
                    avatarPreview.src = img;
                    avatarPreview.style.display = 'block';
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                }

                title.textContent = `Edit ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}`;
                formContainer.style.display = 'block';
                formContainer.scrollIntoView({ behavior: 'smooth' });
            });
        }

        // Create Invoice pre-filled
        const triggerCreateInvoice = () => {
            const isBus = isBusinessMode;
            window.location.hash = `#/${isBus ? 'invoices/business' : 'invoices/customer'}`;
        };

        const btnCreateInv1 = container.querySelector('#btn-detail-create-invoice');
        const btnCreateInv2 = container.querySelector('#btn-quick-new-invoice');
        const btnCreateInvEmpty = container.querySelector('#btn-tab-empty-invoice');
        if (btnCreateInv1) btnCreateInv1.addEventListener('click', triggerCreateInvoice);
        if (btnCreateInv2) btnCreateInv2.addEventListener('click', triggerCreateInvoice);
        if (btnCreateInvEmpty) btnCreateInvEmpty.addEventListener('click', triggerCreateInvoice);

        // View Invoice modal directly
        container.querySelectorAll('.btn-view-invoice-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const invId = e.currentTarget.getAttribute('data-invid');
                const inv = allInvoices.find(i => i.id === invId);
                if (inv) {
                    openInvoiceViewerModal(inv);
                }
            });
        });

        // Save inline notes
        const btnSaveNotes = container.querySelector('#btn-save-detail-notes');
        if (btnSaveNotes && activePersonDetail) {
            btnSaveNotes.addEventListener('click', async () => {
                const notes = container.querySelector('#detail-notes-input')?.value || '';
                try {
                    btnSaveNotes.disabled = true;
                    btnSaveNotes.textContent = 'Saving...';
                    const id = activePersonDetail.id;
                    if (currentTab === 'customers') await peopleService.updateCustomer(id, { notes });
                    else if (currentTab === 'businesses') await peopleService.updateBusiness(id, { notes });
                    else if (currentTab === 'clients') await peopleService.updateClient(id, { notes });
                    
                    activePersonDetail.notes = notes;
                    showAlert.success("Notes saved successfully!");
                } catch (err) {
                    showAlert.error("Failed to save notes: " + err.message);
                } finally {
                    btnSaveNotes.disabled = false;
                    btnSaveNotes.textContent = '💾 Save Notes';
                }
            });
        }

        // Quick avatar image upload prompt
        const triggerAvatarModal = async () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async () => {
                const file = fileInput.files[0];
                if (!file || !activePersonDetail) return;
                try {
                    showAlert.info("Uploading profile picture...");
                    const uploadedUrl = await storageService.uploadImage(file, workspaceId);
                    const id = activePersonDetail.id;

                    if (currentTab === 'customers') await peopleService.updateCustomer(id, { imageUrl: uploadedUrl, imageUri: uploadedUrl });
                    else if (currentTab === 'businesses') await peopleService.updateBusiness(id, { imageUrl: uploadedUrl, imageUri: uploadedUrl });
                    else if (currentTab === 'clients') await peopleService.updateClient(id, { imageUrl: uploadedUrl, imageUri: uploadedUrl });

                    activePersonDetail.imageUrl = uploadedUrl;
                    activePersonDetail.imageUri = uploadedUrl;
                    showAlert.success("Profile photo updated!");
                    renderDedicatedDetailView();
                } catch (err) {
                    showAlert.error("Photo upload failed: " + err.message);
                }
            };
            fileInput.click();
        };

        const btnAvatar1 = container.querySelector('#btn-quick-avatar-upload');
        const btnAvatar2 = container.querySelector('#btn-quick-avatar-upload-2');
        if (btnAvatar1) btnAvatar1.addEventListener('click', triggerAvatarModal);
        if (btnAvatar2) btnAvatar2.addEventListener('click', triggerAvatarModal);
    };

    // -------------------------------------------------------------
    // DATA LOADER & REALTIME LISTENER
    // -------------------------------------------------------------
    let unsubscribe = null;

    const loadData = async () => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        await fetchInvoices();

        const renderRealtimeList = (data) => {
            dataList = data;
            
            // If viewing detail, update current object reference
            if (activePersonDetail) {
                const updatedObj = dataList.find(x => x.id === activePersonDetail.id);
                if (updatedObj) activePersonDetail = updatedObj;
                renderDedicatedDetailView();
                return;
            }

            renderListView();

            const tbody = container.querySelector('#people-list-body');
            if (!tbody) return;

            if (dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding:2.5rem; text-align:center; color: var(--text-muted);">No ${isBusinessMode ? 'businesses' : currentTab} found. Click "Add New" to create one.</td></tr>`;
                return;
            }

            const currSym = getAppCurrencySymbol();

            tbody.innerHTML = dataList.map(person => {
                const stats = getPersonStats(person);
                const count = Math.max(stats.count, person.invoiceCount || 0);
                const img = person.imageUrl || person.imageUri;

                return `
                    <tr class="people-table-row" data-id="${person.id}">
                        <td style="padding:0.9rem 1.25rem;">
                            <div style="display:flex; align-items:center; gap:0.75rem;">
                                <div style="width:38px; height:38px; border-radius:50%; background:#fff1f2; border:1.5px solid #fecdd3; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    ${img ? `
                                        <img src="${escapeHtml(img)}" alt="${escapeHtml(person.name)}" style="width:100%; height:100%; object-fit:cover;">
                                    ` : `
                                        <span style="color:#e11d48; font-weight:700; font-size:0.95rem;">${(person.name || 'U').charAt(0).toUpperCase()}</span>
                                    `}
                                </div>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.92rem; display:block;">${escapeHtml(person.name)}</strong>
                                    <small class="text-muted" style="font-family:monospace; font-size:0.75rem;">${person.uniqueId || person.id}</small>
                                </div>
                            </div>
                        </td>
                        <td style="padding:0.9rem 1rem; font-size:0.85rem;">
                            ${person.phone ? `<div>📞 ${escapeHtml(person.phone)}</div>` : ''}
                            ${person.email ? `<div style="color:var(--text-muted);">✉️ ${escapeHtml(person.email)}</div>` : ''}
                            ${!person.phone && !person.email ? '<span style="color:var(--text-muted);">—</span>' : ''}
                        </td>
                        <td style="padding:0.9rem 1rem; font-size:0.85rem; color:var(--text-secondary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${escapeHtml(person.address || '—')}
                        </td>
                        <td style="padding:0.9rem 1rem; font-weight:700; color:var(--text-primary); font-size:0.9rem;">
                            ${currSym} ${stats.totalSpent.toFixed(2)}
                        </td>
                        <td style="padding:0.9rem 1rem;">
                            <span class="badge" style="background:${count > 0 ? '#fff1f2' : 'var(--surface-100)'}; color:${count > 0 ? '#e11d48' : 'var(--text-muted)'}; font-weight:700; font-size:0.78rem; padding:0.25rem 0.6rem; border-radius:999px; border:1px solid ${count > 0 ? '#fecdd3' : 'var(--border-color)'};">
                                ${count} ${count === 1 ? 'Invoice' : 'Invoices'}
                            </span>
                        </td>
                        <td style="padding:0.9rem 1.25rem; text-align:right;">
                            <div style="display:inline-flex; gap:0.4rem; align-items:center;">
                                <button type="button" class="btn btn-sm btn-primary view-person-detail" data-id="${person.id}" style="background:#e11d48; border-color:#e11d48; font-weight:600; font-size:0.78rem; padding:0.25rem 0.75rem;">
                                    View Details
                                </button>
                                <button type="button" class="btn btn-sm btn-secondary edit-person" data-id="${person.id}" style="font-size:0.78rem; padding:0.25rem 0.65rem;">
                                    Edit
                                </button>
                                <button type="button" class="btn btn-sm btn-outline del-person" data-id="${person.id}" style="font-size:0.78rem; padding:0.25rem 0.65rem; color:#ef4444; border-color:#fecdd3;">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Bind row clicks to open details
            container.querySelectorAll('.view-person-detail').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.getAttribute('data-id');
                    const p = dataList.find(x => x.id === id);
                    if (p) {
                        activePersonDetail = p;
                        activeDetailTab = 'invoices';
                        renderDedicatedDetailView();
                    }
                });
            });

            container.querySelectorAll('.people-table-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('button') || e.target.closest('a')) return;
                    const id = row.getAttribute('data-id');
                    const p = dataList.find(x => x.id === id);
                    if (p) {
                        activePersonDetail = p;
                        activeDetailTab = 'invoices';
                        renderDedicatedDetailView();
                    }
                });
            });

            // Bind Edit & Delete in list
            container.querySelectorAll('.edit-person').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.getAttribute('data-id');
                    const p = dataList.find(x => x.id === id);
                    if (p) {
                        const formContainer = container.querySelector('#person-form-container');
                        const title = container.querySelector('#person-form-title');
                        const avatarPreview = container.querySelector('#person-avatar-preview');
                        const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');

                        container.querySelector('#person-id').value = p.id;
                        container.querySelector('#person-name').value = p.name || '';
                        container.querySelector('#person-phone').value = p.phone || '';
                        container.querySelector('#person-email').value = p.email || '';
                        container.querySelector('#person-address').value = p.address || '';
                        if (container.querySelector('#person-tags')) {
                            container.querySelector('#person-tags').value = (p.tags || []).join(', ');
                        }
                        if (container.querySelector('#person-notes')) {
                            container.querySelector('#person-notes').value = p.notes || '';
                        }
                        if (container.querySelector('#person-status')) {
                            container.querySelector('#person-status').value = p.status || 'Active';
                        }

                        const img = p.imageUrl || p.imageUri;
                        if (img && avatarPreview) {
                            avatarPreview.src = img;
                            avatarPreview.style.display = 'block';
                            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                        }

                        title.textContent = `Edit ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}`;
                        formContainer.style.display = 'block';
                        formContainer.scrollIntoView({ behavior: 'smooth' });
                    }
                });
            });

            container.querySelectorAll('.del-person').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const id = e.currentTarget.getAttribute('data-id');
                    const person = dataList.find(x => x.id === id);
                    const stats = getPersonStats(person);
                    const typeName = isBusinessMode ? 'business' : (currentTab === 'clients' ? 'client' : 'customer');
                    const typeCap = typeName.charAt(0).toUpperCase() + typeName.slice(1);

                    if (stats.count > 0) {
                        showAlert.error(`Can't Delete ${typeName}. The ${typeCap} is used by ${stats.count} invoice${stats.count > 1 ? 's' : ''}. You have to Delete those invoices or edit this ${typeName}.`);
                        return;
                    }

                    if (await showAlert.confirm(`Delete ${typeName} "${person?.name || 'this entry'}" permanently?`)) {
                        try {
                            if (currentTab === 'customers') await peopleService.deleteCustomer(id);
                            else if (currentTab === 'businesses') await peopleService.deleteBusiness(id);
                            else if (currentTab === 'clients') await peopleService.deleteClient(id);
                            
                            showAlert.success(`${typeCap} deleted successfully`);
                        } catch (err) {
                            showAlert.error(err.message);
                        }
                    }
                });
            });
        };

        try {
            if (isBusinessMode || currentTab === 'businesses') {
                unsubscribe = peopleService.listenBusinesses(renderRealtimeList);
            } else if (currentTab === 'clients') {
                unsubscribe = peopleService.listenClients(renderRealtimeList);
            } else {
                unsubscribe = peopleService.listenCustomers(renderRealtimeList);
            }
        } catch (error) {
            console.error(`Failed to listen to ${currentTab}:`, error);
            showAlert.error(`Failed to listen to directory`);
        }
    };

    // Initial Start
    await loadData();
};
