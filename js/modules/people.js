import { getPeopleService } from '../services/peopleService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { storageService } from '../../supabase/storage.js';
import { draftManager } from '../services/draftManager.js';

export const renderPeople = async (container, workspaceId, defaultTab = 'customers') => {
    const peopleService = getPeopleService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    let currentTab = defaultTab; // 'customers', 'clients', or 'businesses'
    let dataList = [];
    let allInvoices = [];
    let activePersonDetail = null; // When non-null, shows dedicated large informative detail view
    let activeDetailTab = 'invoices'; // 'invoices', 'notes'
    let salesOverviewFilter = '6_MONTHS'; // 'TODAY', 'THIS_WEEK', 'THIS_MONTH', '6_MONTHS', '1_YEAR', 'ALL_TIME', 'CUSTOM'
    let customSalesDate = '';
    
    const isBusinessMode = defaultTab === 'businesses';

    // SVG Icons
    const ICONS = {
        person: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        client: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        business: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 10h.01M6 14h.01M6 18h.01M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 10h.01M18 14h.01M18 18h.01M6 3h12v4H6z"/></svg>`,
        phone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
        email: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
        location: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
        orders: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
        spent: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
        calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#db2777" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        due: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
        plus: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        camera: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`,
        note: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
        back: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
        close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
    };

    // Fetch invoices to link real transaction data
    async function fetchInvoices() {
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
    }

    // Calculate invoice stats for a person
    function getPersonStats(person) {
        if (!person) return { count: 0, totalSpent: 0, lastDate: null, due: 0, invoices: [] };
        const uId = person.uniqueId || person.id;
        const pId = person.id;
        const name = (person.name || person.businessName || '').trim().toLowerCase();
        const phone = (person.phone || '').trim().toLowerCase();
        const email = (person.email || '').trim().toLowerCase();

        const matchedInvoices = allInvoices.filter(inv => {
            if (!inv) return false;
            if (currentTab === 'businesses' || isBusinessMode) {
                const bId = (inv.businessId || '').trim();
                const bName = (inv.businessName || inv.issuerName || '').trim().toLowerCase();
                return (bId && (bId === uId || bId === pId)) ||
                       (name && bName && (bName === name || bName.includes(name) || name.includes(bName)));
            } else if (currentTab === 'clients') {
                const cId = (inv.clientId || '').trim();
                const cEmail = (inv.clientEmail || inv.email || '').trim().toLowerCase();
                const cPhone = (inv.clientPhone || inv.phone || '').trim().toLowerCase();
                const cName = (inv.clientName || inv.name || '').trim().toLowerCase();
                return (cId && (cId === uId || cId === pId)) ||
                       (email && cEmail && cEmail === email) ||
                       (phone && cPhone && cPhone === phone) ||
                       (name && cName && (cName === name || cName.includes(name) || name.includes(cName)));
            } else {
                const custId = (inv.customerId || inv.recipientId || '').trim();
                const custName = (inv.customerName || inv.recipientName || inv.name || '').trim().toLowerCase();
                const custPhone = (inv.customerNumber || inv.customerPhone || inv.phone || '').trim().toLowerCase();
                const custEmail = (inv.customerEmail || inv.email || '').trim().toLowerCase();
                return (custId && (custId === uId || custId === pId)) ||
                       (name && custName && (custName === name || custName.includes(name) || name.includes(custName))) ||
                       (phone && custPhone && custPhone === phone) ||
                       (email && custEmail && custEmail === email);
            }
        });

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

        const computedCount = Math.max(matchedInvoices.length, Number(person.invoiceCount) || 0);

        return {
            count: computedCount,
            totalSpent,
            due,
            lastDate,
            invoices: matchedInvoices
        };
    }

    // Calculate time-filtered chart data
    function getFilteredChartData(invoices, filterMode, customVal = '') {
        const now = new Date();
        let slots = [];

        if (filterMode === 'TODAY') {
            for (let h = 0; h < 24; h += 4) {
                slots.push({ label: `${h}:00`, start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), h).getTime(), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), h + 4).getTime(), amount: 0 });
            }
        } else if (filterMode === 'THIS_WEEK') {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const curDay = now.getDay();
            for (let i = 0; i < 7; i++) {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - curDay + i);
                slots.push({ label: dayNames[i], start: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime(), amount: 0 });
            }
        } else if (filterMode === 'THIS_MONTH') {
            const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let w = 1; w <= totalDays; w += 6) {
                const endW = Math.min(w + 5, totalDays);
                slots.push({ label: `${w}-${endW}`, start: new Date(now.getFullYear(), now.getMonth(), w).getTime(), end: new Date(now.getFullYear(), now.getMonth(), endW, 23, 59, 59).getTime(), amount: 0 });
            }
        } else if (filterMode === '1_YEAR') {
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                slots.push({ label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), amount: 0 });
            }
        } else if (filterMode === 'CUSTOM' && customVal) {
            const target = new Date(customVal);
            for (let h = 0; h < 24; h += 4) {
                slots.push({ label: `${h}:00`, start: new Date(target.getFullYear(), target.getMonth(), target.getDate(), h).getTime(), end: new Date(target.getFullYear(), target.getMonth(), target.getDate(), h + 4).getTime(), amount: 0 });
            }
        } else {
            // Default: 6 MONTHS
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                slots.push({ label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear(), month: d.getMonth(), amount: 0 });
            }
        }

        invoices.forEach(inv => {
            const t = Number(inv.timestamp) || 0;
            const amt = Number(inv.totalPrice || inv.total || inv.amount || 0);
            if (t > 0) {
                if (filterMode === '6_MONTHS' || filterMode === '1_YEAR' || filterMode === 'ALL_TIME') {
                    const invDate = new Date(t);
                    const idx = slots.findIndex(s => s.year === invDate.getFullYear() && s.month === invDate.getMonth());
                    if (idx !== -1) slots[idx].amount += amt;
                } else {
                    const idx = slots.findIndex(s => t >= s.start && t <= s.end);
                    if (idx !== -1) slots[idx].amount += amt;
                }
            }
        });

        return slots;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // -------------------------------------------------------------
    // RENDER MAIN VIEW (List or Details)
    // -------------------------------------------------------------
    function render() {
        if (activePersonDetail) {
            renderDedicatedDetailView();
        } else {
            renderListView();
            renderRealtimeList(dataList);
        }
    }

    // -------------------------------------------------------------
    // LIST VIEW
    // -------------------------------------------------------------
    function renderListView() {
        const typeTitle = isBusinessMode ? 'Businesses & Issuers' : (currentTab === 'clients' ? 'Client Directory' : 'Customer Directory');
        const count = dataList.length;
        const countLabel = isBusinessMode 
            ? (count === 1 ? 'Business' : 'Businesses') 
            : (currentTab === 'clients' ? (count === 1 ? 'Client' : 'Clients') : (count === 1 ? 'Customer' : 'Customers'));

        container.innerHTML = `
            <div class="people-module-container" style="animation: fadeIn 0.25s ease;">
                <!-- HEADER -->
                <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">${typeTitle}</h2>
                            <span class="badge" id="people-count-badge" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; font-weight:700; font-size:0.8rem; padding:0.25rem 0.65rem; border-radius:999px;">
                                ${count} ${countLabel}
                            </span>
                        </div>
                        <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:var(--text-secondary);">
                            Manage directory profiles, track transactions, outstanding balances, and customer history.
                        </p>
                    </div>
                    
                    <div style="display:flex; gap:0.6rem; align-items:center;">
                        <button id="btn-add-person" class="btn btn-primary" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); box-shadow:0 4px 12px rgba(225,29,72,0.3); padding:0.55rem 1.25rem;">
                            ${ICONS.plus}
                            Add ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}
                        </button>
                    </div>
                </div>
                
                <!-- TABS (Customers vs Clients vs Businesses) -->
                ${!isBusinessMode ? `
                    <div style="display:flex; gap:0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;" id="people-tab-group">
                        <button class="people-tab-btn ${currentTab === 'customers' ? 'active-people-tab' : ''}" data-tab="customers" style="display:inline-flex; align-items:center; gap:6px;">
                            ${ICONS.person}
                            <span>Customers</span>
                        </button>
                        <button class="people-tab-btn ${currentTab === 'clients' ? 'active-people-tab' : ''}" data-tab="clients" style="display:inline-flex; align-items:center; gap:6px;">
                            ${ICONS.client}
                            <span>Clients</span>
                        </button>
                    </div>
                ` : ''}

                <!-- ADD / EDIT PERSON MODAL FORM -->
                <div id="person-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem; border:1px solid #fecdd3; background:#ffffff; box-shadow:0 10px 25px rgba(225,29,72,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                        <h3 id="person-form-title" style="margin:0; font-size:1.2rem; font-weight:700; color:var(--text-primary);">New Entry</h3>
                        <button type="button" id="person-cancel-x" style="background:none; border:none; cursor:pointer; color:var(--text-muted); display:flex; align-items:center;">${ICONS.close}</button>
                    </div>

                    <form id="person-form" style="display:flex; flex-direction:column; gap:1.25rem;">
                        <input type="hidden" id="person-id">
                        
                        <!-- AVATAR / PHOTO UPLOAD SECTION -->
                        <div id="person-avatar-dropzone" style="display:flex; align-items:center; gap:1.25rem; background:var(--surface-50); padding:1rem; border-radius:12px; border:1.5px dashed var(--border-color); flex-wrap:wrap; transition:all 0.2s ease; cursor:pointer;" title="Click or Drag & Drop image here">
                            <div style="position:relative; width:68px; height:68px; border-radius:50%; overflow:hidden; background:#ffffff; border:2px solid #fecdd3; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                                <img id="person-avatar-preview" src="" alt="Avatar" style="width:100%; height:100%; object-fit:cover; display:none;">
                                <div id="person-avatar-placeholder" style="color:#e11d48; display:flex; align-items:center; justify-content:center;">
                                    ${currentTab === 'clients' ? ICONS.client : (isBusinessMode ? ICONS.business : ICONS.person)}
                                </div>
                            </div>
                            <div style="flex:1; min-width:220px;">
                                <label style="font-weight:700; font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Profile Image / Logo (Drag & Drop or Browse)</label>
                                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                                    <label class="btn btn-secondary" style="cursor:pointer; font-size:0.82rem; padding:0.35rem 0.75rem; margin:0; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                                        ${ICONS.camera} Choose Photo File
                                        <input type="file" id="person-image-file" accept="image/*" style="display:none;">
                                    </label>
                                    <input type="url" id="person-image-url" placeholder="or paste Image URL (https://...)" class="form-control" style="flex:1; min-width:180px; font-size:0.82rem; padding:0.35rem 0.6rem;">
                                </div>
                                <small style="color:var(--text-muted); font-size:0.75rem; margin-top:0.25rem; display:block;">Drag & drop JPG, PNG, WEBP directly onto this area, or browse files.</small>
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
                                <select id="person-status" class="form-control" style="width:100%; padding:0.55rem 0.75rem; font-weight:600;">
                                    <option value="Active">Active</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Inactive">Inactive</option>
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
    function renderDedicatedDetailView() {
        const p = activePersonDetail;
        if (!p) {
            renderListView();
            renderRealtimeList(dataList);
            return;
        }

        const stats = getPersonStats(p);
        const monthlyData = getFilteredChartData(stats.invoices, salesOverviewFilter, customSalesDate);
        const currSym = getAppCurrencySymbol();
        const typeLabel = isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer');

        const rawTags = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(',') : ['Regular Customer']);
        const tags = rawTags.map(t => String(t).trim()).filter(Boolean);
        if (tags.length === 0) tags.push(typeLabel);

        const maxVal = Math.max(...monthlyData.map(m => m.amount), 1000);

        container.innerHTML = `
            <div class="dedicated-detail-container" style="animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- BREADCRUMB & TOP NAV -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem;">
                        <button type="button" id="btn-back-to-people" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.35rem; padding:0;">
                            ${ICONS.back} Back to ${isBusinessMode ? 'Businesses' : (currentTab === 'clients' ? 'Clients' : 'Customers')}
                        </button>
                        <span style="color:var(--text-muted);">/</span>
                        <span style="color:var(--text-primary); font-weight:700;">${escapeHtml(p.name)}</span>
                    </div>

                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" id="btn-edit-detail-profile" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:0.35rem;">
                            ${ICONS.edit} Edit Profile
                        </button>
                        <button type="button" id="btn-detail-create-invoice" class="btn btn-primary" style="background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.35rem; box-shadow:0 3px 10px rgba(225,29,72,0.25);">
                            ${ICONS.plus} Create Invoice
                        </button>
                    </div>
                </div>

                <!-- 1. TOP HERO PROFILE & KPI CARDS -->
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
                                        <span style="font-size:1.75rem; font-weight:800; color:#e11d48;">
                                            ${(p.name || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    `}
                                    <div class="avatar-hover-overlay">${ICONS.camera}</div>
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
                                        ${currentTab === 'clients' ? ICONS.client : (isBusinessMode ? ICONS.business : ICONS.person)} ${typeLabel} Profile
                                    </div>
                                </div>
                            </div>

                            <!-- INLINE METADATA -->
                            <div style="display:flex; flex-wrap:wrap; gap:1rem; font-size:0.83rem; color:var(--text-secondary); margin-bottom:1rem; padding-top:0.5rem; border-top:1px solid #f1f5f9;">
                                ${p.phone ? `
                                    <a href="tel:${p.phone}" style="display:flex; align-items:center; gap:0.35rem; color:inherit; text-decoration:none; font-weight:500;">
                                        <span style="color:#e11d48;">${ICONS.phone}</span> ${escapeHtml(p.phone)}
                                    </a>
                                ` : ''}
                                ${p.email ? `
                                    <a href="mailto:${p.email}" style="display:flex; align-items:center; gap:0.35rem; color:inherit; text-decoration:none; font-weight:500;">
                                        <span style="color:#e11d48;">${ICONS.email}</span> ${escapeHtml(p.email)}
                                    </a>
                                ` : ''}
                                ${p.address ? `
                                    <span style="display:flex; align-items:center; gap:0.35rem; font-weight:500;">
                                        <span style="color:#e11d48;">${ICONS.location}</span> ${escapeHtml(p.address)}
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
                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Orders</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#eff6ff; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.orders}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0;">
                                ${stats.count}
                            </div>
                            <div style="font-size:0.75rem; color:#10b981; font-weight:700;">
                                Verified transaction history
                            </div>
                        </div>
                    </div>

                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Spent</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#ecfdf5; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.spent}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${currSym} ${stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style="font-size:0.75rem; color:#10b981; font-weight:700;">
                                Active volume
                            </div>
                        </div>
                    </div>

                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Last Order</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#fdf2f8; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.calendar}
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

                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid ${stats.due > 0 ? '#fecdd3' : 'var(--border-color)'}; display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Outstanding Due</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#fff1f2; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.due}
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

                <!-- 2. TWO-COLUMN WORKSPACE BODY -->
                <div style="display:grid; grid-template-columns: 310px 1fr; gap:1.25rem; align-items:start;" class="detail-body-grid">
                    
                    <!-- LEFT COLUMN: DETAILED INFO & QUICK ACTIONS -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        
                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                ${currentTab === 'clients' ? ICONS.client : (isBusinessMode ? ICONS.business : ICONS.person)} ${typeLabel} Information
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

                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary);">
                                Quick Actions
                            </h3>

                            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                <button type="button" id="btn-quick-new-invoice" class="btn btn-primary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:700; background:linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding:0.65rem;">
                                    ${ICONS.plus} Create Invoice
                                </button>
                                
                                <button type="button" id="btn-quick-add-note" class="btn btn-secondary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:600; padding:0.6rem;">
                                    ${ICONS.note} Add / Edit Notes
                                </button>
                                
                                <button type="button" id="btn-quick-avatar-upload-2" class="btn btn-secondary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:600; padding:0.6rem;">
                                    ${ICONS.camera} Change Photo / Image
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT MAIN COLUMN: TABS, INVOICE TABLE & SALES CHART -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        
                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            
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
                                    View All Invoices &rarr;
                                </button>
                            </div>

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
                                <div style="padding:0.5rem 0;">
                                    <div style="margin-bottom:1rem;">
                                        <label style="font-weight:700; font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.4rem;">Customer Remarks & Notes</label>
                                        <textarea id="detail-notes-input" rows="4" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="Type notes regarding customer preferences, payment instructions, delivery address details...">${escapeHtml(p.notes || '')}</textarea>
                                    </div>
                                    <button type="button" id="btn-save-detail-notes" class="btn btn-primary" style="background:#e11d48; border-color:#e11d48; font-weight:700; padding:0.5rem 1.25rem;">
                                        Save Notes
                                    </button>
                                </div>
                            `}

                        </div>

                        <!-- SALES OVERVIEW CHART & RECENT INVOICES SUMMARY -->
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
                            
                            <!-- SALES OVERVIEW GRAPH WITH COMPREHENSIVE TIME FILTERS -->
                            <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                                    <div>
                                        <h3 style="margin:0; font-size:1rem; font-weight:700; color:var(--text-primary);">Sales Overview</h3>
                                        <span style="font-size:0.78rem; color:var(--text-muted);">Purchase performance trend</span>
                                    </div>
                                    
                                    <!-- Time Filters -->
                                    <div style="display:flex; align-items:center; gap:0.35rem;">
                                        <select id="sales-overview-filter-select" class="form-control" style="font-size:0.78rem; padding:0.25rem 0.5rem; border-radius:6px; height:30px;">
                                            <option value="6_MONTHS" ${salesOverviewFilter === '6_MONTHS' ? 'selected' : ''}>6 Months</option>
                                            <option value="1_YEAR" ${salesOverviewFilter === '1_YEAR' ? 'selected' : ''}>1 Year</option>
                                            <option value="THIS_MONTH" ${salesOverviewFilter === 'THIS_MONTH' ? 'selected' : ''}>This Month</option>
                                            <option value="THIS_WEEK" ${salesOverviewFilter === 'THIS_WEEK' ? 'selected' : ''}>This Week</option>
                                            <option value="TODAY" ${salesOverviewFilter === 'TODAY' ? 'selected' : ''}>Today</option>
                                            <option value="ALL_TIME" ${salesOverviewFilter === 'ALL_TIME' ? 'selected' : ''}>All Time</option>
                                            <option value="CUSTOM" ${salesOverviewFilter === 'CUSTOM' ? 'selected' : ''}>Specific Date...</option>
                                        </select>
                                        <input type="date" id="sales-overview-custom-date" style="display:${salesOverviewFilter === 'CUSTOM' ? 'inline-block' : 'none'}; font-size:0.78rem; padding:0.2rem 0.4rem; height:30px;" class="form-control" value="${customSalesDate}">
                                    </div>
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

                                        <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4"/>
                                        <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4"/>
                                        <line x1="0" y1="130" x2="500" y2="130" stroke="#f1f5f9" stroke-width="1"/>

                                        ${(() => {
                                            if (monthlyData.length === 0) return '';
                                            const pts = monthlyData.map((m, idx) => {
                                                const x = monthlyData.length === 1 ? 250 : (idx / (monthlyData.length - 1)) * 480 + 10;
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
    function bindListEvents() {
        const formContainer = container.querySelector('#person-form-container');
        const form = container.querySelector('#person-form');
        const title = container.querySelector('#person-form-title');
        const btnAdd = container.querySelector('#btn-add-person');
        const btnCancel = container.querySelector('#person-cancel-btn');
        const btnCancelX = container.querySelector('#person-cancel-x');

        const avatarDropzone = container.querySelector('#person-avatar-dropzone');
        const avatarPreview = container.querySelector('#person-avatar-preview');
        const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
        const imageFileInput = container.querySelector('#person-image-file');
        const imageUrlInput = container.querySelector('#person-image-url');

        let pendingPersonAvatarFile = null;

        const processPersonFile = async (file) => {
            if (!file || !file.type.startsWith('image/')) {
                showAlert.warning("Please provide a valid image file.");
                return;
            }

            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDimension = 512;

                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (!blob) {
                                pendingPersonAvatarFile = file;
                                if (avatarPreview) {
                                    avatarPreview.src = e.target.result;
                                    avatarPreview.style.display = 'block';
                                }
                                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                                resolve(file);
                                return;
                            }
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                                type: "image/webp",
                                lastModified: Date.now()
                            });
                            pendingPersonAvatarFile = compressedFile;
                            if (avatarPreview) {
                                avatarPreview.src = canvas.toDataURL('image/webp', 0.88);
                                avatarPreview.style.display = 'block';
                            }
                            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                            if (imageUrlInput) imageUrlInput.value = '';
                            resolve(compressedFile);
                        }, 'image/webp', 0.88);
                    };
                    img.onerror = () => {
                        pendingPersonAvatarFile = file;
                        if (avatarPreview) {
                            avatarPreview.src = e.target.result;
                            avatarPreview.style.display = 'block';
                        }
                        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                        resolve(file);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        };

        if (avatarDropzone && imageFileInput) {
            avatarDropzone.addEventListener('click', (e) => {
                if (e.target.closest('input') || e.target.closest('label')) return;
                imageFileInput.click();
            });

            ['dragenter', 'dragover'].forEach(evtName => {
                avatarDropzone.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    avatarDropzone.style.borderColor = '#e11d48';
                    avatarDropzone.style.background = 'rgba(225,29,72,0.06)';
                    avatarDropzone.style.boxShadow = '0 0 0 2px rgba(225,29,72,0.2)';
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                avatarDropzone.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    avatarDropzone.style.borderColor = 'var(--border-color)';
                    avatarDropzone.style.background = 'var(--surface-50)';
                    avatarDropzone.style.boxShadow = 'none';
                });
            });

            avatarDropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    await processPersonFile(files[0]);
                    showAlert.info("Image selected. Ready to save.");
                }
            });
        }

        // Unsaved changes state & snapshot helpers
        let personUnsavedIndicator = null;
        let initialPersonSnapshot = null;

        const getPersonFormSnapshot = () => {
            return JSON.stringify({
                id: container.querySelector('#person-id')?.value || '',
                name: container.querySelector('#person-name')?.value?.trim() || '',
                phone: container.querySelector('#person-phone')?.value?.trim() || '',
                email: container.querySelector('#person-email')?.value?.trim() || '',
                address: container.querySelector('#person-address')?.value?.trim() || '',
                tags: container.querySelector('#person-tags')?.value?.trim() || '',
                status: container.querySelector('#person-status')?.value || 'Active',
                notes: container.querySelector('#person-notes')?.value?.trim() || '',
                image: container.querySelector('#person-image-url')?.value?.trim() || ''
            });
        };

        const isPersonFormDirty = () => {
            const formContainer = container.querySelector('#person-form-container');
            if (!formContainer || formContainer.style.display === 'none') return false;

            const id = container.querySelector('#person-id')?.value;
            if (id) {
                if (!initialPersonSnapshot) return false;
                return getPersonFormSnapshot() !== initialPersonSnapshot;
            } else {
                const name = container.querySelector('#person-name')?.value?.trim() || '';
                const phone = container.querySelector('#person-phone')?.value?.trim() || '';
                const email = container.querySelector('#person-email')?.value?.trim() || '';
                const address = container.querySelector('#person-address')?.value?.trim() || '';
                const notes = container.querySelector('#person-notes')?.value?.trim() || '';
                const img = container.querySelector('#person-image-url')?.value?.trim() || '';
                return Boolean(name || phone || email || address || notes || img || pendingPersonAvatarFile);
            }
        };

        const checkPersonDirty = () => {
            const isDirty = isPersonFormDirty();
            if (personUnsavedIndicator) {
                personUnsavedIndicator.update(isDirty);
            }
            const id = container.querySelector('#person-id')?.value || 'new';
            const draftKey = `person_${currentTab}_${id}`;
            if (isDirty) {
                draftManager.saveDraft(draftKey, getPersonFormSnapshot());
                draftManager.registerActiveForm('person_form', isPersonFormDirty);
            } else {
                draftManager.clearDraft(draftKey);
                draftManager.unregisterActiveForm('person_form');
            }
        };

        const restorePersonDraftIfAny = (targetId = 'new') => {
            const draftKey = `person_${currentTab}_${targetId}`;
            const draft = draftManager.getDraft(draftKey);
            if (!draft) return false;
            try {
                const data = typeof draft === 'string' ? JSON.parse(draft) : draft;
                if (data.name !== undefined && container.querySelector('#person-name')) container.querySelector('#person-name').value = data.name;
                if (data.phone !== undefined && container.querySelector('#person-phone')) container.querySelector('#person-phone').value = data.phone;
                if (data.email !== undefined && container.querySelector('#person-email')) container.querySelector('#person-email').value = data.email;
                if (data.address !== undefined && container.querySelector('#person-address')) container.querySelector('#person-address').value = data.address;
                if (data.tags !== undefined && container.querySelector('#person-tags')) container.querySelector('#person-tags').value = data.tags;
                if (data.status !== undefined && container.querySelector('#person-status')) container.querySelector('#person-status').value = data.status;
                if (data.notes !== undefined && container.querySelector('#person-notes')) container.querySelector('#person-notes').value = data.notes;
                if (data.image && container.querySelector('#person-image-url')) {
                    container.querySelector('#person-image-url').value = data.image;
                    const avatarPreview = container.querySelector('#person-avatar-preview');
                    const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
                    if (avatarPreview) {
                        avatarPreview.src = data.image;
                        avatarPreview.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                }
                return true;
            } catch (e) {
                console.warn("Could not parse person draft:", e);
                return false;
            }
        };

        // Mount Unsaved Indicator
        const formHeaderRow = title?.parentElement;
        if (formHeaderRow && !personUnsavedIndicator) {
            personUnsavedIndicator = draftManager.mountUnsavedIndicator(formHeaderRow, {
                formType: isBusinessMode ? 'Business Profile' : (currentTab === 'clients' ? 'Client Profile' : 'Customer Profile'),
                onSave: () => {
                    const submitBtn = container.querySelector('#person-submit-btn');
                    if (submitBtn && !submitBtn.disabled) {
                        form.requestSubmit();
                    } else {
                        showAlert.info("Please fill required name field (*) before saving.");
                    }
                }
            });
        }

        form?.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', checkPersonDirty);
            el.addEventListener('change', checkPersonDirty);
        });

        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                form.reset();
                pendingPersonAvatarFile = null;
                container.querySelector('#person-id').value = '';
                if (avatarPreview) avatarPreview.style.display = 'none';
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'block';
                title.textContent = `New ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}`;
                
                initialPersonSnapshot = null;
                const restored = restorePersonDraftIfAny('new');
                if (restored) {
                    showAlert.info("Restored progressive unsaved draft.");
                }

                checkPersonDirty();
                formContainer.style.display = 'block';
                formContainer.scrollIntoView({ behavior: 'smooth' });
            });
        }

        const handleCancelPersonForm = async () => {
            if (isPersonFormDirty()) {
                const leave = await showAlert.confirmUnsavedChanges();
                if (!leave) return;
            }
            const id = container.querySelector('#person-id')?.value || 'new';
            const draftKey = `person_${currentTab}_${id}`;
            draftManager.clearDraft(draftKey);
            draftManager.unregisterActiveForm('person_form');
            if (personUnsavedIndicator) personUnsavedIndicator.update(false);
            formContainer.style.display = 'none';
        };

        if (btnCancel) btnCancel.addEventListener('click', handleCancelPersonForm);
        if (btnCancelX) btnCancelX.addEventListener('click', handleCancelPersonForm);

        if (imageFileInput) {
            imageFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await processPersonFile(file);
                    checkPersonDirty();
                }
            });
        }

        if (imageUrlInput) {
            imageUrlInput.addEventListener('input', () => {
                const val = imageUrlInput.value.trim();
                pendingPersonAvatarFile = null;
                if (val) {
                    if (avatarPreview) {
                        avatarPreview.src = val;
                        avatarPreview.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                }
                checkPersonDirty();
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

                    const file = pendingPersonAvatarFile || imageFileInput?.files?.[0];
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

                    const curId = id || 'new';
                    const draftKey = `person_${currentTab}_${curId}`;
                    draftManager.clearDraft(draftKey);
                    draftManager.unregisterActiveForm('person_form');
                    if (personUnsavedIndicator) personUnsavedIndicator.update(false);

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
    function bindDetailEvents() {
        const btnBack = container.querySelector('#btn-back-to-people');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                activePersonDetail = null;
                render();
            });
        }

        const filterSelect = container.querySelector('#sales-overview-filter-select');
        const customDateInput = container.querySelector('#sales-overview-custom-date');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                salesOverviewFilter = e.target.value;
                if (salesOverviewFilter === 'CUSTOM') {
                    if (customDateInput) customDateInput.style.display = 'inline-block';
                } else {
                    if (customDateInput) customDateInput.style.display = 'none';
                    renderDedicatedDetailView();
                }
            });
        }
        if (customDateInput) {
            customDateInput.addEventListener('change', (e) => {
                customSalesDate = e.target.value;
                renderDedicatedDetailView();
            });
        }

        container.querySelectorAll('.detail-subtab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeDetailTab = e.currentTarget.getAttribute('data-subtab');
                renderDedicatedDetailView();
            });
        });

        const btnEdit = container.querySelector('#btn-edit-detail-profile');
        if (btnEdit && activePersonDetail) {
            btnEdit.addEventListener('click', () => {
                const p = activePersonDetail;
                activePersonDetail = null;
                renderListView();
                renderRealtimeList(dataList);

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

        // Create Invoice pre-filled with this person
        const triggerCreateInvoice = () => {
            const p = activePersonDetail;
            if (!p) return;
            const isBus = isBusinessMode || currentTab === 'businesses' || (p.isClient && currentTab === 'clients');
            window.__preselectedInvoiceRecipient = {
                mode: currentTab === 'clients' ? 'client' : (currentTab === 'businesses' ? 'business' : 'customer'),
                id: p.id,
                uniqueId: p.uniqueId || p.id,
                name: p.name,
                phone: p.phone || '',
                email: p.email || '',
                address: p.address || '',
                imageUrl: p.imageUrl || p.imageUri || ''
            };
            window.location.hash = `#/${isBus ? 'invoices/business' : 'invoices/customer'}`;
        };

        const btnCreateInv1 = container.querySelector('#btn-detail-create-invoice');
        const btnCreateInv2 = container.querySelector('#btn-quick-new-invoice');
        const btnCreateInvEmpty = container.querySelector('#btn-tab-empty-invoice');
        if (btnCreateInv1) btnCreateInv1.addEventListener('click', triggerCreateInvoice);
        if (btnCreateInv2) btnCreateInv2.addEventListener('click', triggerCreateInvoice);
        if (btnCreateInvEmpty) btnCreateInvEmpty.addEventListener('click', triggerCreateInvoice);

        container.querySelectorAll('.btn-view-invoice-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const invId = e.currentTarget.getAttribute('data-invid');
                const inv = allInvoices.find(i => i.id === invId);
                if (inv) {
                    openInvoiceViewerModal(inv);
                }
            });
        });

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
                    btnSaveNotes.textContent = 'Save Notes';
                }
            });
        }

        const handleDirectAvatarUpload = async (file) => {
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

        const triggerAvatarModal = async () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async () => {
                const file = fileInput.files[0];
                if (file) {
                    await handleDirectAvatarUpload(file);
                }
            };
            fileInput.click();
        };

        const btnAvatar1 = container.querySelector('#btn-quick-avatar-upload');
        const btnAvatar2 = container.querySelector('#btn-quick-avatar-upload-2');
        if (btnAvatar1) {
            btnAvatar1.addEventListener('click', triggerAvatarModal);

            // Drag and Drop support on hero avatar
            ['dragenter', 'dragover'].forEach(evtName => {
                btnAvatar1.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btnAvatar1.style.borderColor = '#ffffff';
                    btnAvatar1.style.boxShadow = '0 0 0 4px #e11d48, 0 8px 24px rgba(225,29,72,0.4)';
                    btnAvatar1.style.transform = 'scale(1.08)';
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                btnAvatar1.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btnAvatar1.style.borderColor = '#e11d48';
                    btnAvatar1.style.boxShadow = '0 4px 14px rgba(225,29,72,0.2)';
                    btnAvatar1.style.transform = 'none';
                });
            });

            btnAvatar1.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    await handleDirectAvatarUpload(files[0]);
                }
            });
        }
        if (btnAvatar2) btnAvatar2.addEventListener('click', triggerAvatarModal);
    };

    // -------------------------------------------------------------
    // REALTIME LIST RENDERER
    // -------------------------------------------------------------
    function renderRealtimeList(data) {
        dataList = data || [];
        
        // Update header count badge dynamically
        const countBadge = container.querySelector('#people-count-badge');
        if (countBadge) {
            const count = dataList.length;
            const label = isBusinessMode 
                ? (count === 1 ? 'Business' : 'Businesses') 
                : (currentTab === 'clients' ? (count === 1 ? 'Client' : 'Clients') : (count === 1 ? 'Customer' : 'Customers'));
            countBadge.textContent = `${count} ${label}`;
        }

        if (activePersonDetail) {
            const updatedObj = dataList.find(x => x.id === activePersonDetail.id);
            if (updatedObj) activePersonDetail = updatedObj;
            renderDedicatedDetailView();
            return;
        }

        const tbody = container.querySelector('#people-list-body');
        if (!tbody) return;

        if (dataList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:2.5rem; text-align:center; color: var(--text-muted);">No ${isBusinessMode ? 'businesses' : currentTab} found. Click "Add New" to create one.</td></tr>`;
            return;
        }

        const currSym = getAppCurrencySymbol();

        tbody.innerHTML = dataList.map(person => {
            const stats = getPersonStats(person);
            const count = stats.count;
            const img = person.imageUrl || person.imageUri;

            const avatarFallback = currentTab === 'clients' 
                ? ICONS.client 
                : (isBusinessMode ? ICONS.business : ICONS.person);

            return `
                <tr class="people-table-row" data-id="${person.id}">
                    <td style="padding:0.9rem 1.25rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:38px; height:38px; border-radius:50%; background:#fff1f2; border:1.5px solid #fecdd3; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#e11d48;">
                                ${img ? `
                                    <img src="${escapeHtml(img)}" alt="${escapeHtml(person.name)}" style="width:100%; height:100%; object-fit:cover;">
                                ` : avatarFallback}
                            </div>
                            <div>
                                <strong style="color:var(--text-primary); font-size:0.92rem; display:block;">${escapeHtml(person.name)}</strong>
                                <small class="text-muted" style="font-family:monospace; font-size:0.75rem;">${person.uniqueId || person.id}</small>
                            </div>
                        </div>
                    </td>
                    <td style="padding:0.9rem 1rem; font-size:0.85rem;">
                        ${person.phone ? `<div style="display:flex; align-items:center; gap:4px;"><span style="color:#e11d48;">${ICONS.phone}</span> ${escapeHtml(person.phone)}</div>` : ''}
                        ${person.email ? `<div style="color:var(--text-muted); display:flex; align-items:center; gap:4px;"><span style="color:#e11d48;">${ICONS.email}</span> ${escapeHtml(person.email)}</div>` : ''}
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
                            <button type="button" class="btn btn-sm btn-primary add-invoice-for-person" data-id="${person.id}" style="background:linear-gradient(135deg, #e11d48, #be123c); border:none; font-weight:700; font-size:0.78rem; padding:0.25rem 0.65rem; display:inline-flex; align-items:center; gap:3px;" title="Create new invoice for ${escapeHtml(person.name)}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                + Invoice
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary view-person-detail" data-id="${person.id}" style="font-weight:600; font-size:0.78rem; padding:0.25rem 0.65rem;">
                                View
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

        container.querySelectorAll('.add-invoice-for-person').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute('data-id');
                const p = dataList.find(x => x.id === id);
                if (p) {
                    const isBus = isBusinessMode || currentTab === 'businesses' || (p.isClient && currentTab === 'clients');
                    window.__preselectedInvoiceRecipient = {
                        mode: currentTab === 'clients' ? 'client' : (currentTab === 'businesses' ? 'business' : 'customer'),
                        id: p.id,
                        uniqueId: p.uniqueId || p.id,
                        name: p.name,
                        phone: p.phone || '',
                        email: p.email || '',
                        address: p.address || '',
                        imageUrl: p.imageUrl || p.imageUri || ''
                    };
                    window.location.hash = `#/${isBus ? 'invoices/business' : 'invoices/customer'}`;
                }
            });
        });

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

    // -------------------------------------------------------------
    // DATA LOADER & REALTIME LISTENER
    // -------------------------------------------------------------
    let unsubscribe = null;
    let unsubscribeCustInvs = null;
    let unsubscribeBusInvs = null;

    async function loadData() {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        if (unsubscribeCustInvs) {
            unsubscribeCustInvs();
            unsubscribeCustInvs = null;
        }
        if (unsubscribeBusInvs) {
            unsubscribeBusInvs();
            unsubscribeBusInvs = null;
        }

        renderListView();
        await fetchInvoices();

        // Listen for invoice changes so invoice pill counts update in real-time
        try {
            unsubscribeCustInvs = invoiceService.listenInvoices(false, () => {
                fetchInvoices().then(() => {
                    if (dataList && dataList.length > 0 && !activePersonDetail) {
                        renderRealtimeList(dataList);
                    }
                });
            });
            unsubscribeBusInvs = invoiceService.listenInvoices(true, () => {
                fetchInvoices().then(() => {
                    if (dataList && dataList.length > 0 && !activePersonDetail) {
                        renderRealtimeList(dataList);
                    }
                });
            });
        } catch (e) {
            console.warn("Invoice listeners warning:", e);
        }

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

    await loadData();
};
