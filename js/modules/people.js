import { getPeopleService } from '../services/peopleService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { formatCurrency, getAppCurrencySymbol, formatExactTimestamp } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { storageService } from '../../supabase/storage.js';
import { draftManager } from '../services/draftManager.js';
import { getUserRestrictions } from '../auth-handler.js';
import { getFinanceService } from '../services/financeService.js';

export const renderPeople = async (container, workspaceId, defaultTab = 'customers') => {
    const peopleService = getPeopleService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();
    const userRestrictions = getUserRestrictions();
    
    let currentTab = defaultTab; // 'customers', 'clients', or 'businesses'
    let dataList = [];
    let allInvoices = [];
    let activePersonDetail = null; // When non-null, shows dedicated large informative detail view
    let activeDetailTab = 'invoices'; // 'invoices', 'notes'
    let detailInvoiceStatusFilter = 'ALL'; // 'ALL', 'PAID', 'UNPAID'
    let salesOverviewFilter = '6_MONTHS'; // 'TODAY', 'THIS_WEEK', 'THIS_MONTH', '6_MONTHS', '1_YEAR', 'ALL_TIME', 'CUSTOM'
    let customSalesDate = '';
    
    // Directory Search, Filter, Sort & Selection States
    let peopleSearchTerm = '';
    let peopleFilterQuery = 'all'; // 'all', 'unused', 'custom_count', 'count_range', 'spent_range', 'high_spent'
    let customInvoiceCountVal = '';
    let peopleCountMin = '';
    let peopleCountMax = '';
    let peopleSpentMin = '';
    let peopleSpentMax = '';
    let peopleSortQuery = 'newest'; // 'newest', 'oldest', 'spent_high', 'spent_low', 'invoices_high', 'name_asc', 'name_desc'
    const selectedPeopleIds = new Set();
    
    const isBusinessMode = defaultTab === 'businesses';

    // SVG Icons
    const ICONS = {
        person: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        client: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        business: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 10h.01M6 14h.01M6 18h.01M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 10h.01M18 14h.01M18 18h.01M6 3h12v4H6z"/></svg>`,
        phone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
        email: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
        location: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
        orders: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`,
        spent: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
        calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
        due: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
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
    // DEDICATED PERSON EDITOR PANEL (Modeled after Add Product)
    // -------------------------------------------------------------
    function getPersonFormMarkup() {
        const typeLabel = isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer');
        return `
            <!-- DEDICATED PERSON ADD / EDIT PANEL (Custom standalone screen like Add Product) -->
            <div id="person-form-container" class="prd-form-wrapper" style="display:none; animation: fadeIn 0.2s ease;">
                <!-- Form Top Header Bar -->
                <div class="prd-form-header-bar" style="padding:1.25rem 1.75rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; background:linear-gradient(135deg, rgba(24, 24, 27, 0.03) 0%, rgba(24, 24, 27, 0.01) 100%);">
                    <div style="display:flex; align-items:center; gap:0.85rem;">
                        <div id="person-form-header-avatar" style="width:46px; height:46px; border-radius:50%; background:#18181B; display:flex; align-items:center; justify-content:center; color:#FFFFFF; overflow:hidden; border:2px solid #E4E4E7; flex-shrink:0;">
                            <span id="person-form-header-svg">${currentTab === 'clients' ? ICONS.client : (isBusinessMode ? ICONS.business : ICONS.person)}</span>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <span class="badge" id="person-form-badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; padding:2px 8px; border-radius:999px;">
                                    New Profile
                                </span>
                                <h3 id="person-form-title" style="margin:0; font-size:1.25rem; font-weight:800; color:#18181B; letter-spacing:-0.02em;">
                                    Add ${typeLabel}
                                </h3>
                            </div>
                            <p id="person-form-subtitle" style="margin:0.2rem 0 0 0; font-size:0.82rem; color:#71717A;">
                                Configure directory profile parameters, contact channels, and transaction terms
                            </p>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button type="button" class="btn btn-secondary person-cancel-trigger" style="display:inline-flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.85rem; padding:0.45rem 1rem; border-radius:8px; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; cursor:pointer;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to Directory
                        </button>
                    </div>
                </div>

                <!-- Form Content -->
                <form id="person-form" style="padding:1.75rem; display:flex; flex-direction:column; gap:1.5rem;" novalidate>
                    <input type="hidden" id="person-id">

                    <div class="prd-form-grid" style="padding:0;">
                        <!-- Left Column: Core Info & Contact Details -->
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                            
                            <!-- Section 1: Profile Identification -->
                            <div class="prd-card-section" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:1.25rem 1.4rem;">
                                <div class="prd-card-title" style="font-size:0.92rem; font-weight:700; color:#18181B; display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid #E4E4E7;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    <span>Profile Information</span>
                                </div>

                                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem; margin-bottom:1rem;">
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Full Name / Company Title <span style="color:#ef4444;">*</span></label>
                                        <input type="text" id="person-name" required class="form-control" placeholder="e.g. Acme Corporation or Alexander Wright" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Status</label>
                                        <select id="person-status" class="form-control" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem; font-weight:600; background:#FFFFFF;">
                                            <option value="Active">Active</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Inactive">Inactive</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Tags & Categories</label>
                                    <input type="text" id="person-tags" class="form-control" placeholder="e.g. Retail, Wholesale, VIP, Regular Customer" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    <small style="color:#71717A; font-size:0.75rem; margin-top:3px; display:block;">Comma-separated values to group and filter records</small>
                                </div>
                            </div>

                            <!-- Section 2: Contact Coordinates & Address -->
                            <div class="prd-card-section" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:1.25rem 1.4rem;">
                                <div class="prd-card-title" style="font-size:0.92rem; font-weight:700; color:#18181B; display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid #E4E4E7;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>Contact & Address</span>
                                </div>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Phone Number</label>
                                        <input type="text" id="person-phone" class="form-control" placeholder="e.g. +1 (555) 000-0000" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Email Address</label>
                                        <input type="email" id="person-email" class="form-control" placeholder="e.g. contact@domain.com" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    </div>
                                </div>

                                <div style="margin-bottom:1rem;">
                                    <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Physical Address / Billing Street</label>
                                    <input type="text" id="person-address" class="form-control" placeholder="e.g. 124 Maple Drive, Boston, MA 02115" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                </div>

                                <div>
                                    <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Contact Person / Liaison</label>
                                    <input type="text" id="person-contact-liaison" class="form-control" placeholder="e.g. Operations Director or Account Rep" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                </div>
                            </div>

                            <!-- Section 3: Entity-Specific Information -->
                            <div class="prd-card-section" id="person-business-section" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:1.25rem 1.4rem;">
                                <div class="prd-card-title" style="font-size:0.92rem; font-weight:700; color:#18181B; display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid #E4E4E7;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                    <span>Business & Billing Details</span>
                                </div>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Tax ID / BIN / VAT No.</label>
                                        <input type="text" id="person-tax-id" class="form-control" placeholder="e.g. US-EIN-9481204" style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:0.35rem; color:#18181B;">Website / Portal URL</label>
                                        <input type="url" id="person-website" class="form-control" placeholder="https://..." style="width:100%; padding:0.55rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.88rem;">
                                    </div>
                                </div>

                                <div id="person-primary-business-wrap" style="display:${isBusinessMode ? 'flex' : 'none'}; align-items:center; gap:0.6rem; background:#F4F4F5; padding:0.75rem 1rem; border-radius:8px; border:1px solid #E4E4E7;">
                                    <input type="checkbox" id="person-primary" style="width:16px; height:16px; accent-color:#18181B; cursor:pointer;">
                                    <div>
                                        <label for="person-primary" style="font-size:0.85rem; font-weight:700; color:#18181B; cursor:pointer; margin:0;">Set as Primary Business</label>
                                        <small style="color:#71717A; font-size:0.75rem; display:block;">Use as default company header & issuer details for newly issued invoices.</small>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <!-- Right Column: Avatar Upload & Remarks -->
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                            
                            <!-- Section 4: Profile Photo / Logo Card -->
                            <div class="prd-card-section" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:1.25rem 1.4rem;">
                                <div class="prd-card-title" style="font-size:0.92rem; font-weight:700; color:#18181B; display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid #E4E4E7;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                    <span>Profile Photo / Logo</span>
                                </div>

                                <!-- Avatar Dropzone Area -->
                                <div id="person-avatar-dropzone" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:1.5rem 1rem; border:2px dashed #E4E4E7; border-radius:12px; background:#FAFAFA; cursor:pointer; transition:all 0.2s ease;">
                                    <div style="position:relative; width:88px; height:88px; border-radius:50%; background:#FFFFFF; border:2px solid #E4E4E7; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                                        <img id="person-avatar-preview" src="" alt="Avatar" style="width:100%; height:100%; object-fit:cover; display:none;">
                                        <div id="person-avatar-placeholder" style="color:#71717A; display:flex; align-items:center; justify-content:center;">
                                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                        </div>
                                    </div>

                                    <p style="margin:0 0 0.5rem; font-weight:700; font-size:0.85rem; color:#18181B;">Drag & drop photo here</p>
                                    <p style="margin:0 0 1rem; font-size:0.75rem; color:#71717A;">Supports JPG, PNG, WebP (auto-compressed)</p>

                                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; justify-content:center;">
                                        <label class="btn btn-secondary" style="margin:0; font-size:0.8rem; font-weight:700; padding:0.4rem 0.85rem; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            Browse File
                                            <input type="file" id="person-image-file" accept="image/*" style="display:none;">
                                        </label>
                                        <button type="button" id="person-remove-avatar-btn" class="btn btn-secondary" style="font-size:0.8rem; font-weight:600; padding:0.4rem 0.75rem; border:1px solid #E4E4E7; background:#FFFFFF; color:#71717A; border-radius:8px; display:none;">
                                            Remove
                                        </button>
                                    </div>

                                    <div style="margin-top:1rem; width:100%;">
                                        <input type="url" id="person-image-url" placeholder="Or paste public image URL (https://...)" class="form-control" style="width:100%; font-size:0.78rem; padding:0.45rem 0.65rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                    </div>
                                </div>
                            </div>

                            <!-- Section 5: Internal Remarks & Notes -->
                            <div class="prd-card-section" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:1.25rem 1.4rem;">
                                <div class="prd-card-title" style="font-size:0.92rem; font-weight:700; color:#18181B; display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid #E4E4E7;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                    <span>Internal Notes & Remarks</span>
                                </div>

                                <textarea id="person-notes" rows="4" class="form-control" placeholder="Add customer notes, credit limits, special payment agreements, or delivery preferences..." style="width:100%; padding:0.6rem 0.75rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.85rem; font-family:inherit; resize:vertical;"></textarea>
                            </div>

                        </div>
                    </div>

                    <!-- Action Footer -->
                    <div style="display:flex; justify-content:flex-end; align-items:center; padding:1.25rem 0 0 0; border-top:1px solid #E4E4E7; margin-top:0.5rem; gap:0.75rem;">
                        <button type="button" class="btn btn-secondary person-cancel-trigger" style="padding:0.55rem 1.5rem; font-size:0.88rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; cursor:pointer;">
                            Cancel
                        </button>
                        <button type="submit" id="person-submit-btn" class="btn btn-primary" style="padding:0.55rem 1.75rem; font-size:0.88rem; font-weight:700; background:#18181B; border:1px solid #18181B; color:#FFFFFF; border-radius:8px; cursor:pointer;">
                            Save Profile
                        </button>
                    </div>
                </form>
            </div>
        `;
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
                <div id="people-list-view">
                    <!-- HEADER -->
                    <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">${typeTitle}</h2>
                                <span class="badge" id="people-count-badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.8rem; padding:0.25rem 0.65rem; border-radius:999px;">
                                    ${count} ${countLabel}
                                </span>
                            </div>
                            <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:var(--text-secondary);">
                                Manage directory profiles, track transactions, outstanding balances, and customer history.
                            </p>
                        </div>
                        
                        <div style="display:flex; gap:0.6rem; align-items:center;">
                            ${userRestrictions.disableAdd ? '' : `
                            <button id="btn-add-person" class="btn btn-primary" style="display:flex; align-items:center; gap:0.5rem; font-weight:700; background:#18181B; border:1px solid #18181B; color:#ffffff; padding:0.55rem 1.25rem;">
                                ${ICONS.plus}
                                Add ${isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer')}
                            </button>
                            `}
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

                    <!-- SEARCH, QUERY FILTER & SORT TOOLBAR -->
                    <div id="people-search-toolbar" style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; margin-bottom:1rem; flex-wrap:wrap;">
                        <div style="position:relative; flex:1; min-width:240px; max-width:440px;">
                            <input type="text" id="people-search-input" placeholder="Search by name, phone, email, address, ID..." value="${escapeHtml(peopleSearchTerm)}" style="width:100%; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.85rem 0 2.25rem; font-size:0.85rem; background:#FFFFFF; color:#18181B; outline:none; transition:border-color 0.2s ease;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="2" style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:0.35rem;">
                                <label style="font-size:0.78rem; font-weight:700; color:#71717A; text-transform:uppercase;">Filter:</label>
                                <select id="people-filter-query" style="height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.75rem; font-size:0.82rem; font-weight:600; background:#FFFFFF; color:#18181B; outline:none; cursor:pointer;">
                                    <option value="all" ${peopleFilterQuery === 'all' ? 'selected' : ''}>All Profiles</option>
                                    <option value="unused" ${peopleFilterQuery === 'unused' ? 'selected' : ''}>Unused (0 Invoices)</option>
                                    <option value="custom_count" ${peopleFilterQuery === 'custom_count' ? 'selected' : ''}>Custom Invoice Count</option>
                                    <option value="count_range" ${peopleFilterQuery === 'count_range' ? 'selected' : ''}>Invoice Count Range</option>
                                    <option value="spent_range" ${peopleFilterQuery === 'spent_range' ? 'selected' : ''}>Spent Range ($ Min - Max)</option>
                                    <option value="high_spent" ${peopleFilterQuery === 'high_spent' ? 'selected' : ''}>High Spent (&gt; $500)</option>
                                </select>
                                <input type="number" id="people-custom-count" min="0" placeholder="Count..." value="${escapeHtml(customInvoiceCountVal)}" style="width:85px; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.65rem; font-size:0.82rem; font-weight:700; color:#18181B; background:#FFFFFF; outline:none; display:${peopleFilterQuery === 'custom_count' ? 'inline-block' : 'none'};" title="Filter by exact invoice count">
                                
                                <!-- Invoice Count Range Inputs -->
                                <div id="people-count-range-wrap" style="display:${peopleFilterQuery === 'count_range' ? 'inline-flex' : 'none'}; align-items:center; gap:4px;">
                                    <input type="number" id="people-count-min" min="0" placeholder="Min" value="${escapeHtml(peopleCountMin)}" style="width:65px; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.5rem; font-size:0.82rem; font-weight:700; color:#18181B; background:#FFFFFF; outline:none;" title="Minimum invoice count">
                                    <span style="font-size:0.75rem; color:#71717A; font-weight:700;">to</span>
                                    <input type="number" id="people-count-max" min="0" placeholder="Max" value="${escapeHtml(peopleCountMax)}" style="width:65px; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.5rem; font-size:0.82rem; font-weight:700; color:#18181B; background:#FFFFFF; outline:none;" title="Maximum invoice count">
                                </div>

                                <!-- Spent Range Inputs -->
                                <div id="people-spent-range-wrap" style="display:${peopleFilterQuery === 'spent_range' ? 'inline-flex' : 'none'}; align-items:center; gap:4px;">
                                    <input type="number" id="people-spent-min" min="0" placeholder="Min $" value="${escapeHtml(peopleSpentMin)}" style="width:72px; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.5rem; font-size:0.82rem; font-weight:700; color:#18181B; background:#FFFFFF; outline:none;" title="Minimum total spent">
                                    <span style="font-size:0.75rem; color:#71717A; font-weight:700;">to</span>
                                    <input type="number" id="people-spent-max" min="0" placeholder="Max $" value="${escapeHtml(peopleSpentMax)}" style="width:72px; height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.5rem; font-size:0.82rem; font-weight:700; color:#18181B; background:#FFFFFF; outline:none;" title="Maximum total spent">
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:0.35rem;">
                                <label style="font-size:0.78rem; font-weight:700; color:#71717A; text-transform:uppercase;">Sort:</label>
                                <select id="people-sort-query" style="height:38px; border-radius:8px; border:1px solid #E4E4E7; padding:0 0.75rem; font-size:0.82rem; font-weight:600; background:#FFFFFF; color:#18181B; outline:none; cursor:pointer;">
                                    <option value="newest" ${peopleSortQuery === 'newest' ? 'selected' : ''}>Newest Added</option>
                                    <option value="oldest" ${peopleSortQuery === 'oldest' ? 'selected' : ''}>Oldest Added</option>
                                    <option value="spent_high" ${peopleSortQuery === 'spent_high' ? 'selected' : ''}>Highest Spent</option>
                                    <option value="spent_low" ${peopleSortQuery === 'spent_low' ? 'selected' : ''}>Lowest Spent</option>
                                    <option value="invoices_high" ${peopleSortQuery === 'invoices_high' ? 'selected' : ''}>Most Invoices</option>
                                    <option value="name_asc" ${peopleSortQuery === 'name_asc' ? 'selected' : ''}>Name (A → Z)</option>
                                    <option value="name_desc" ${peopleSortQuery === 'name_desc' ? 'selected' : ''}>Name (Z → A)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- DIRECTORY TABLE CARD -->
                    <div class="card" id="people-table-card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left;">
                                <thead>
                                    <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em;">
                                        <th style="padding:1rem 0.5rem 1rem 1.25rem; width:38px;">
                                            <input type="checkbox" id="people-select-all" style="cursor:pointer; width:16px; height:16px; accent-color:#18181B; border-radius:4px;">
                                        </th>
                                        <th style="padding:1rem 1rem;">Profile & Name</th>
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
                                            <td style="padding:1rem 0.5rem 1rem 1.25rem;"><div class="skeleton-shimmer" style="width:16px; height:16px; border-radius:4px;"></div></td>
                                            <td style="padding:1rem 1rem;"><div class="skeleton-shimmer" style="width:160px; height:18px;"></div></td>
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

                    <!-- FLOATING PEOPLE BATCH ACTION BAR (Multi-selection) -->
                    <div id="people-batch-action-bar" class="prd-batch-action-bar" style="display:none;">
                        <div style="display:flex; align-items:center; gap:0.65rem;">
                            <span id="people-batch-count" class="prd-batch-badge">0 selected</span>
                            <button type="button" id="btn-people-batch-select-all" class="btn btn-secondary btn-sm" style="height:30px; font-size:0.75rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.65rem;" title="Select all active contacts or deselect all">
                                Select All
                            </button>
                            <button type="button" id="btn-people-batch-invert" class="btn btn-secondary btn-sm" style="height:30px; font-size:0.75rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.65rem; display:none;" title="Invert selection">
                                Invert
                            </button>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <button type="button" id="btn-people-batch-export" class="btn btn-primary btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1px solid #18181B; background:#18181B; color:#FFFFFF; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;" title="Export selected profiles as CSV">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                <span>Export Selected</span>
                            </button>
                            <button type="button" id="btn-people-batch-delete" class="btn btn-danger btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1.5px solid #fca5a5; background:#FFFFFF; color:#dc2626; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;" title="Delete all selected profiles">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                <span>Delete Selected</span>
                            </button>
                            <button type="button" id="btn-people-batch-cancel" class="btn btn-secondary btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.85rem;" title="Clear selection">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Dedicated Editor Panel Mounted in List View -->
                ${getPersonFormMarkup()}
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
                    color: #18181B;
                }
                .active-people-tab {
                    color: #18181B;
                    border-bottom-color: #18181B;
                    font-weight: 700;
                }
                .people-table-row {
                    border-bottom: 1px solid var(--border-color);
                    transition: background 0.15s ease;
                    cursor: pointer;
                }
                .people-table-row:hover {
                    background: #F4F4F5;
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
                <div id="people-detail-view">
                    <!-- BREADCRUMB & TOP NAV -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.88rem;">
                        <button type="button" id="btn-back-to-people" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-weight:600; display:flex; align-items:center; gap:0.35rem; padding:0;">
                            ${ICONS.back} Back to ${isBusinessMode ? 'Businesses' : (currentTab === 'clients' ? 'Clients' : 'Customers')}
                        </button>
                        <span style="color:var(--text-muted);">/</span>
                        <span style="color:var(--text-primary); font-weight:700;">${escapeHtml(p.name)}</span>
                    </div>

                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        ${(isBusinessMode || currentTab === 'businesses') ? (p.isPrimary ? `
                            <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.8rem; font-weight:700; padding:0.35rem 0.75rem; border-radius:999px; display:inline-flex; align-items:center; gap:5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Primary Business (Default)
                            </span>
                        ` : `
                            <button type="button" id="btn-detail-set-primary" class="btn btn-secondary" style="font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Set as Primary
                            </button>
                        `) : ''}
                        <button type="button" id="btn-edit-detail-profile" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:0.35rem;">
                            ${ICONS.edit} Edit Profile
                        </button>
                        <button type="button" id="btn-detail-create-invoice" class="btn btn-primary" style="background:#18181B; font-size:0.85rem; font-weight:700; display:flex; align-items:center; gap:0.35rem; box-shadow:0 3px 10px rgba(0,0,0,0.15); border:1px solid #18181B; color:#ffffff;">
                            ${ICONS.plus} Create Invoice
                        </button>
                    </div>
                </div>

                <!-- 1. TOP HERO PROFILE & KPI CARDS -->
                <div class="hero-kpi-grid" style="display:grid; grid-template-columns: minmax(320px, 1.4fr) repeat(auto-fit, minmax(170px, 1fr)); gap:1rem; margin-bottom:1.5rem; align-items:stretch;">
                    
                    <!-- HERO PROFILE CARD -->
                    <div class="card" style="padding:1.5rem; background:#ffffff; border:1px solid #E4E4E7; border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,0.04); display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
                        <div style="position:absolute; width:160px; height:160px; background:radial-gradient(circle, rgba(0,0,0,0.02) 0%, transparent 70%); top:-40px; right:-40px; border-radius:50%;"></div>
                        
                        <div>
                            <div style="display:flex; gap:1.25rem; align-items:center; margin-bottom:1rem;">
                                <!-- AVATAR WITH INSTANT UPLOAD HOVER -->
                                <div class="detail-hero-avatar-wrap" id="btn-quick-avatar-upload" title="Click to change profile picture" style="position:relative; width:80px; height:80px; border-radius:50%; overflow:hidden; background:linear-gradient(135deg, #F4F4F5 0%, #F4F4F5 100%); border:3px solid #18181B; display:flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.08);">
                                    ${p.imageUrl || p.imageUri ? `
                                        <img src="${escapeHtml(p.imageUrl || p.imageUri)}" alt="${escapeHtml(p.name)}" style="width:100%; height:100%; object-fit:cover;">
                                    ` : `
                                        <span style="font-size:1.75rem; font-weight:800; color:#18181B;">
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
                                        <span class="badge" style="background:#FAFAFA; color:#18181B; border:1px solid #E4E4E7; font-size:0.75rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:999px;">
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
                                        <span style="color:#18181B;">${ICONS.phone}</span> ${escapeHtml(p.phone)}
                                    </a>
                                ` : ''}
                                ${p.email ? `
                                    <a href="mailto:${p.email}" style="display:flex; align-items:center; gap:0.35rem; color:inherit; text-decoration:none; font-weight:500;">
                                        <span style="color:#18181B;">${ICONS.email}</span> ${escapeHtml(p.email)}
                                    </a>
                                ` : ''}
                                ${p.address ? `
                                    <span style="display:flex; align-items:center; gap:0.35rem; font-weight:500;">
                                        <span style="color:#18181B;">${ICONS.location}</span> ${escapeHtml(p.address)}
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
                            <div style="width:36px; height:36px; border-radius:10px; background:#FAFAFA; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.orders}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0;">
                                ${stats.count}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">
                                Verified transaction history
                            </div>
                        </div>
                    </div>

                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Spent</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#FAFAFA; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.spent}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin:0.25rem 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${currSym} ${stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">
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

                    <div class="card kpi-stat-card" style="padding:1.25rem; background:#ffffff; border-radius:16px; border:1px solid ${stats.due > 0 ? '#E4E4E7' : 'var(--border-color)'}; display:flex; flex-direction:column; justify-content:space-between;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Outstanding Due</span>
                            <div style="width:36px; height:36px; border-radius:10px; background:#F4F4F5; display:flex; align-items:center; justify-content:center;">
                                ${ICONS.due}
                            </div>
                        </div>
                        <div>
                            <div style="font-size:1.85rem; font-weight:800; color:${stats.due > 0 ? '#18181B' : 'var(--text-primary)'}; margin:0.25rem 0;">
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
                                    <code style="font-size:0.78rem; color:#27272A; background:#F4F4F5; padding:0.15rem 0.45rem; border-radius:4px;">${p.uniqueId || p.id}</code>
                                </div>
                            </div>
                        </div>

                        <!-- ORIGIN DIVIDER CARD -->
                        <div class="card origin-divider-card" style="padding:1.25rem; background:var(--bg-card); border-radius:16px; border:1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <h3 style="margin:0 0 0.85rem 0; font-size:0.95rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; justify-content:space-between;">
                                <span style="display:flex; align-items:center; gap:0.4rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                    ${typeLabel} Origin
                                </span>
                                <span class="badge" style="font-size:0.65rem; background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700;">Trace</span>
                            </h3>

                            <div class="origin-grid" style="display:grid; grid-template-columns:1fr; gap:0.6rem; font-size:0.8rem;">
                                <div class="origin-field-box" style="background:var(--surface-100); padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">${typeLabel} ID</div>
                                    <div style="font-weight:700; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(p.uniqueId || p.id || 'N/A'))}</div>
                                </div>
                                <div class="origin-field-box" style="background:var(--surface-100); padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Creator ID</div>
                                    <div style="font-weight:600; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(p.creatorId || p.createdBy || p.userId || 'System / Admin'))}</div>
                                </div>
                                <div class="origin-field-box" style="background:var(--surface-100); padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Workspace ID</div>
                                    <div style="font-weight:600; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(workspaceId || p.workspaceId || localStorage.getItem('pricelister_active_workspace') || 'Default Workspace'))}</div>
                                </div>
                                <div class="origin-field-box" style="background:var(--surface-100); padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Created At</div>
                                    <div style="font-weight:600; color:var(--text-primary);">${formatExactTimestamp(p.createdAt || p.timestamp || p.date)}</div>
                                </div>
                                ${(p.updatedAt || p.updatedTimestamp) ? `
                                <div class="origin-field-box" style="background:var(--surface-100); padding:0.55rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.68rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Updated At</div>
                                    <div style="font-weight:600; color:var(--text-primary);">${formatExactTimestamp(p.updatedAt || p.updatedTimestamp)}</div>
                                </div>` : ''}
                            </div>
                        </div>

                        <div class="card" style="padding:1.5rem; background:#ffffff; border-radius:16px; border:1px solid var(--border-color);">
                            <h3 style="margin:0 0 1rem 0; font-size:1rem; font-weight:700; color:var(--text-primary);">
                                Quick Actions
                            </h3>

                            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                                <button type="button" id="btn-quick-new-invoice" class="btn btn-primary btn-block" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; font-weight:700; background:#18181B; border:1px solid #18181B; color:#ffffff; padding:0.65rem;">
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
                                <div style="display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;">
                                    <button type="button" class="detail-subtab-btn ${activeDetailTab === 'invoices' ? 'active-subtab' : ''}" data-subtab="invoices">
                                        Orders & Invoices (${stats.invoices.length})
                                    </button>
                                    <button type="button" class="detail-subtab-btn ${activeDetailTab === 'emi' ? 'active-subtab' : ''}" data-subtab="emi">
                                        EMI Accounts
                                    </button>
                                    <button type="button" class="detail-subtab-btn ${activeDetailTab === 'notes' ? 'active-subtab' : ''}" data-subtab="notes">
                                        Notes & Remarks
                                    </button>

                                    ${activeDetailTab === 'invoices' ? (() => {
                                        const paidCount = stats.invoices.filter(i => {
                                            const s = String(i.status || '').toLowerCase();
                                            return s === 'paid' || s === 'completed';
                                        }).length;
                                        const unpaidCount = stats.invoices.length - paidCount;

                                        return `
                                            <div style="display:inline-flex; align-items:center; gap:0.35rem; margin-left:0.5rem; background:#F4F4F5; padding:3px 5px; border-radius:999px; border:1px solid #E4E4E7;">
                                                <button type="button" class="btn-detail-inv-filter ${detailInvoiceStatusFilter === 'ALL' ? 'active-filter-pill' : ''}" data-inv-status="ALL" style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:999px; border:none; cursor:pointer; ${detailInvoiceStatusFilter === 'ALL' ? 'background:#18181B; color:#FFFFFF;' : 'background:transparent; color:#71717A;'}">
                                                    All (${stats.invoices.length})
                                                </button>
                                                <button type="button" class="btn-detail-inv-filter ${detailInvoiceStatusFilter === 'PAID' ? 'active-filter-pill' : ''}" data-inv-status="PAID" style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:999px; border:none; cursor:pointer; ${detailInvoiceStatusFilter === 'PAID' ? 'background:#18181B; color:#FFFFFF;' : 'background:transparent; color:#71717A;'}">
                                                    Paid (${paidCount})
                                                </button>
                                                <button type="button" class="btn-detail-inv-filter ${detailInvoiceStatusFilter === 'UNPAID' ? 'active-filter-pill' : ''}" data-inv-status="UNPAID" style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:999px; border:none; cursor:pointer; ${detailInvoiceStatusFilter === 'UNPAID' ? 'background:#18181B; color:#FFFFFF;' : 'background:transparent; color:#71717A;'}">
                                                    Unpaid (${unpaidCount})
                                                </button>
                                            </div>
                                        `;
                                    })() : ''}
                                </div>

                                <button type="button" class="btn btn-secondary btn-sm" onclick="window.location.hash='#/${isBusinessMode ? 'invoices/business' : 'invoices/customer'}'" style="font-size:0.78rem; padding:0.3rem 0.75rem; font-weight:600;">
                                    View All Invoices &rarr;
                                </button>
                            </div>

                            ${activeDetailTab === 'invoices' ? (() => {
                                const displayedInvoices = stats.invoices.filter(inv => {
                                    if (detailInvoiceStatusFilter === 'ALL') return true;
                                    const s = String(inv.status || '').toLowerCase();
                                    const isPaid = s === 'paid' || s === 'completed';
                                    return detailInvoiceStatusFilter === 'PAID' ? isPaid : !isPaid;
                                });

                                return `
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
                                            ${displayedInvoices.length === 0 ? `
                                                <tr>
                                                    <td colspan="6" style="padding:2.5rem 1rem; text-align:center; color:var(--text-muted);">
                                                        <strong>No Invoices Found</strong>
                                                        <p style="margin:0.25rem 0 1rem 0; font-size:0.85rem;">No ${detailInvoiceStatusFilter !== 'ALL' ? detailInvoiceStatusFilter.toLowerCase() : ''} invoices found for this profile.</p>
                                                        <button type="button" id="btn-tab-empty-invoice" class="btn btn-primary btn-sm" style="background:#18181B; font-weight:700;">Create Invoice</button>
                                                    </td>
                                                </tr>
                                            ` : displayedInvoices.map(inv => {
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
                                                            <span class="badge" style="background:#FAFAFA; color:#18181B; border:1px solid #E4E4E7; font-size:0.75rem; font-weight:700; padding:0.2rem 0.55rem; border-radius:999px;">
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
                                `;
                            })() : activeDetailTab === 'emi' ? `
                                <div style="padding:0.5rem 0;">
                                    <div id="customer-emi-container">
                                        <div style="padding:1.5rem; text-align:center; color:#71717A;">Loading customer EMI accounts...</div>
                                    </div>
                                </div>
                            ` : `
                                <div style="padding:0.5rem 0;">
                                    <div style="margin-bottom:1rem;">
                                        <label style="font-weight:700; font-size:0.85rem; color:var(--text-primary); display:block; margin-bottom:0.4rem;">Customer Remarks & Notes</label>
                                        <textarea id="detail-notes-input" rows="4" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="Type notes regarding customer preferences, payment instructions, delivery address details...">${escapeHtml(p.notes || '')}</textarea>
                                    </div>
                                    <button type="button" id="btn-save-detail-notes" class="btn btn-primary" style="background:#18181B; border-color:#18181B; font-weight:700; padding:0.5rem 1.25rem;">
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
                                                <stop offset="0%" stop-color="#18181B" stop-opacity="0.35"/>
                                                <stop offset="100%" stop-color="#18181B" stop-opacity="0.0"/>
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
                                                <path d="${pathD}" fill="none" stroke="#18181B" stroke-width="3" stroke-linecap="round"/>
                                                ${pts.map(p => `
                                                    <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#ffffff" stroke="#18181B" stroke-width="2.5">
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
                                                    <span style="font-size:0.7rem; font-weight:700; color:var(--text-secondary);">${inv.status || 'Paid'}</span>
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

                <!-- Dedicated Editor Panel Mounted in Detail View -->
                ${getPersonFormMarkup()}
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
                    color: #18181B;
                }
                .active-subtab {
                    background: #F4F4F5;
                    color: #18181B;
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
    // DEDICATED PERSON EDITOR LOGIC & CONTROLS
    // -------------------------------------------------------------
    let returnToDetailAfterEditor = false;
    let initialPersonSnapshot = null;
    let pendingPersonAvatarFile = null;
    let personUnsavedIndicator = null;

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

                    const avatarPreview = container.querySelector('#person-avatar-preview');
                    const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
                    const removeImgBtn = container.querySelector('#person-remove-avatar-btn');
                    const imageUrlInput = container.querySelector('#person-image-url');

                    canvas.toBlob((blob) => {
                        if (!blob) {
                            pendingPersonAvatarFile = file;
                            if (avatarPreview) {
                                avatarPreview.src = e.target.result;
                                avatarPreview.style.display = 'block';
                            }
                            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                            if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
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
                        if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
                        if (imageUrlInput) imageUrlInput.value = '';
                        resolve(compressedFile);
                    }, 'image/webp', 0.88);
                };
                img.onerror = () => {
                    pendingPersonAvatarFile = file;
                    const avatarPreview = container.querySelector('#person-avatar-preview');
                    const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
                    const removeImgBtn = container.querySelector('#person-remove-avatar-btn');
                    if (avatarPreview) {
                        avatarPreview.src = e.target.result;
                        avatarPreview.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                    if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
                    resolve(file);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

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
            taxId: container.querySelector('#person-tax-id')?.value?.trim() || '',
            website: container.querySelector('#person-website')?.value?.trim() || '',
            isPrimary: Boolean(container.querySelector('#person-primary')?.checked),
            image: container.querySelector('#person-image-url')?.value?.trim() || ''
        });
    };

    const isPersonFormDirty = () => {
        const formContainer = container.querySelector('#person-form-container');
        if (!formContainer || !document.body.contains(formContainer) || formContainer.style.display === 'none') return false;

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
            if (data.taxId !== undefined && container.querySelector('#person-tax-id')) container.querySelector('#person-tax-id').value = data.taxId;
            if (data.website !== undefined && container.querySelector('#person-website')) container.querySelector('#person-website').value = data.website;
            if (data.isPrimary !== undefined && container.querySelector('#person-primary')) container.querySelector('#person-primary').checked = Boolean(data.isPrimary);
            if (data.image && container.querySelector('#person-image-url')) {
                container.querySelector('#person-image-url').value = data.image;
                const avatarPreview = container.querySelector('#person-avatar-preview');
                const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
                const removeImgBtn = container.querySelector('#person-remove-avatar-btn');
                if (avatarPreview) {
                    avatarPreview.src = data.image;
                    avatarPreview.style.display = 'block';
                }
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
            }
            return true;
        } catch (e) {
            console.warn("Could not parse person draft:", e);
            return false;
        }
    };

    const showPersonEditor = (person = null, fromDetail = false) => {
        returnToDetailAfterEditor = fromDetail;
        const formContainer = container.querySelector('#person-form-container');
        const listView = container.querySelector('#people-list-view');
        const detailView = container.querySelector('#people-detail-view');
        const batchBar = container.querySelector('#people-batch-action-bar');

        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = 'none';
        if (batchBar) batchBar.style.display = 'none';

        if (formContainer) {
            formContainer.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        const typeName = isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer');
        const badge = container.querySelector('#person-form-badge');
        const title = container.querySelector('#person-form-title');
        const subtitle = container.querySelector('#person-form-subtitle');
        const avatarPreview = container.querySelector('#person-avatar-preview');
        const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
        const removeImgBtn = container.querySelector('#person-remove-avatar-btn');
        const submitBtn = container.querySelector('#person-submit-btn');

        pendingPersonAvatarFile = null;

        if (person) {
            // Edit Mode
            const displayId = person.uniqueId || (person.id ? person.id.slice(0, 8) : 'N/A');
            const displayName = person.name || person.businessName || 'Profile';
            if (badge) badge.textContent = `Edit ${typeName} • #${displayId}`;
            if (title) title.textContent = `Edit ${typeName}: ${displayName}`;
            if (subtitle) subtitle.textContent = `Update directory credentials, contact channels, and transaction terms`;
            if (submitBtn) submitBtn.textContent = `Save ${typeName}`;

            if (container.querySelector('#person-id')) container.querySelector('#person-id').value = person.id || '';
            if (container.querySelector('#person-name')) container.querySelector('#person-name').value = person.name || person.businessName || '';
            if (container.querySelector('#person-phone')) container.querySelector('#person-phone').value = person.phone || '';
            if (container.querySelector('#person-email')) container.querySelector('#person-email').value = person.email || '';
            if (container.querySelector('#person-address')) container.querySelector('#person-address').value = person.address || '';
            if (container.querySelector('#person-contact-liaison')) container.querySelector('#person-contact-liaison').value = person.contactPerson || '';
            if (container.querySelector('#person-tags')) {
                const rawTags = Array.isArray(person.tags) ? person.tags : (person.tags ? String(person.tags).split(',') : []);
                container.querySelector('#person-tags').value = rawTags.map(t => String(t).trim()).filter(Boolean).join(', ');
            }
            if (container.querySelector('#person-status')) {
                container.querySelector('#person-status').value = person.status || 'Active';
            }
            if (container.querySelector('#person-notes')) {
                container.querySelector('#person-notes').value = person.notes || '';
            }
            if (container.querySelector('#person-tax-id')) {
                container.querySelector('#person-tax-id').value = person.taxId || person.bin || '';
            }
            if (container.querySelector('#person-website')) {
                container.querySelector('#person-website').value = person.website || '';
            }
            if (container.querySelector('#person-primary')) {
                container.querySelector('#person-primary').checked = Boolean(person.isPrimary);
            }

            const img = person.imageUrl || person.imageUri;
            if (container.querySelector('#person-image-url')) {
                container.querySelector('#person-image-url').value = img || '';
            }
            if (img && avatarPreview) {
                avatarPreview.src = img;
                avatarPreview.style.display = 'block';
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
            } else {
                if (avatarPreview) {
                    avatarPreview.src = '';
                    avatarPreview.style.display = 'none';
                }
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
                if (removeImgBtn) removeImgBtn.style.display = 'none';
            }
        } else {
            // Create Mode
            if (badge) badge.textContent = `New ${typeName} Profile`;
            if (title) title.textContent = `New ${typeName}`;
            if (subtitle) subtitle.textContent = `Add a new ${typeName.toLowerCase()} record to the directory for invoicing and relationship tracking`;
            if (submitBtn) submitBtn.textContent = `Save ${typeName}`;

            container.querySelector('#person-form')?.reset();
            if (container.querySelector('#person-id')) container.querySelector('#person-id').value = '';
            if (container.querySelector('#person-image-url')) container.querySelector('#person-image-url').value = '';
            if (avatarPreview) {
                avatarPreview.src = '';
                avatarPreview.style.display = 'none';
            }
            if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
            if (removeImgBtn) removeImgBtn.style.display = 'none';
            if (container.querySelector('#person-status')) container.querySelector('#person-status').value = 'Active';
            if (container.querySelector('#person-primary')) container.querySelector('#person-primary').checked = false;

            restorePersonDraftIfAny('new');
        }

        initialPersonSnapshot = getPersonFormSnapshot();
        checkPersonDirty();
    };

    const hidePersonEditor = () => {
        const formContainer = container.querySelector('#person-form-container');
        const listView = container.querySelector('#people-list-view');
        const detailView = container.querySelector('#people-detail-view');

        if (formContainer) formContainer.style.display = 'none';

        if (returnToDetailAfterEditor && activePersonDetail && detailView) {
            detailView.style.display = 'block';
        } else if (listView) {
            listView.style.display = 'block';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function setupPersonEditorView() {
        const formContainer = container.querySelector('#person-form-container');
        const form = container.querySelector('#person-form');
        const title = container.querySelector('#person-form-title');
        const avatarDropzone = container.querySelector('#person-avatar-dropzone');
        const avatarPreview = container.querySelector('#person-avatar-preview');
        const avatarPlaceholder = container.querySelector('#person-avatar-placeholder');
        const imageFileInput = container.querySelector('#person-image-file');
        const imageUrlInput = container.querySelector('#person-image-url');
        const removeImgBtn = container.querySelector('#person-remove-avatar-btn');

        if (!formContainer || !form) return;

        // Cancel triggers
        formContainer.querySelectorAll('.person-cancel-trigger').forEach(btn => {
            btn.onclick = async () => {
                if (isPersonFormDirty()) {
                    const leave = await showAlert.confirmUnsavedChanges();
                    if (!leave) return;
                }
                const id = container.querySelector('#person-id')?.value || 'new';
                draftManager.clearDraft(`person_${currentTab}_${id}`);
                draftManager.unregisterActiveForm('person_form');
                if (personUnsavedIndicator) personUnsavedIndicator.update(false);
                hidePersonEditor();
            };
        });

        // Remove avatar
        if (removeImgBtn) {
            removeImgBtn.onclick = () => {
                pendingPersonAvatarFile = null;
                if (imageUrlInput) imageUrlInput.value = '';
                if (imageFileInput) imageFileInput.value = '';
                if (avatarPreview) {
                    avatarPreview.src = '';
                    avatarPreview.style.display = 'none';
                }
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
                removeImgBtn.style.display = 'none';
                checkPersonDirty();
            };
        }

        // Image file change
        if (imageFileInput) {
            imageFileInput.onchange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await processPersonFile(file);
                    checkPersonDirty();
                }
            };
        }

        // Image URL input
        if (imageUrlInput) {
            imageUrlInput.oninput = () => {
                const val = imageUrlInput.value.trim();
                pendingPersonAvatarFile = null;
                if (val) {
                    if (avatarPreview) {
                        avatarPreview.src = val;
                        avatarPreview.style.display = 'block';
                    }
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
                    if (removeImgBtn) removeImgBtn.style.display = 'inline-flex';
                } else {
                    if (avatarPreview) avatarPreview.style.display = 'none';
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
                    if (removeImgBtn) removeImgBtn.style.display = 'none';
                }
                checkPersonDirty();
            };
        }

        // Avatar dropzone
        if (avatarDropzone && imageFileInput) {
            avatarDropzone.onclick = (e) => {
                if (e.target.closest('input') || e.target.closest('label') || e.target.closest('button')) return;
                imageFileInput.click();
            };

            ['dragenter', 'dragover'].forEach(evtName => {
                avatarDropzone.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    avatarDropzone.style.borderColor = '#18181B';
                    avatarDropzone.style.background = '#F4F4F5';
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                avatarDropzone.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    avatarDropzone.style.borderColor = '#E4E4E7';
                    avatarDropzone.style.background = '#FAFAFA';
                });
            });

            avatarDropzone.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    await processPersonFile(files[0]);
                    showAlert.info("Image selected. Ready to save.");
                    checkPersonDirty();
                }
            });
        }

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

        // Form dirty checking
        form.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', checkPersonDirty);
            el.addEventListener('change', checkPersonDirty);
        });

        // Form Submit
        form.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = container.querySelector('#person-submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            try {
                const id = container.querySelector('#person-id')?.value;
                let finalImageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';

                const file = pendingPersonAvatarFile || imageFileInput?.files?.[0];
                if (file) {
                    try {
                        finalImageUrl = await storageService.uploadImage(file, workspaceId);
                    } catch (imgErr) {
                        console.warn("Storage upload warning, falling back:", imgErr);
                    }
                }

                const nameVal = container.querySelector('#person-name')?.value?.trim() || '';
                if (!nameVal) {
                    throw new Error("Full Name / Company Title is required.");
                }

                const typeLabel = isBusinessMode ? 'Business' : (currentTab === 'clients' ? 'Client' : 'Customer');

                const payload = {
                    name: nameVal,
                    phone: container.querySelector('#person-phone')?.value?.trim() || '',
                    email: container.querySelector('#person-email')?.value?.trim() || '',
                    address: container.querySelector('#person-address')?.value?.trim() || '',
                    tags: container.querySelector('#person-tags')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [],
                    status: container.querySelector('#person-status')?.value || 'Active',
                    notes: container.querySelector('#person-notes')?.value || '',
                    contactPerson: container.querySelector('#person-contact-liaison')?.value?.trim() || '',
                    taxId: container.querySelector('#person-tax-id')?.value?.trim() || '',
                    website: container.querySelector('#person-website')?.value?.trim() || '',
                    isPrimary: Boolean(container.querySelector('#person-primary')?.checked),
                    imageUrl: finalImageUrl,
                    imageUri: finalImageUrl
                };

                if (isBusinessMode || currentTab === 'businesses') {
                    payload.businessName = payload.name;
                }

                if (!id && userRestrictions.disableAdd) {
                    throw new Error(`You do not have permission to add new ${typeLabel.toLowerCase()} profiles.`);
                }
                if (id && userRestrictions.disableUpdate) {
                    throw new Error(`You do not have permission to update ${typeLabel.toLowerCase()} profiles.`);
                }
                if (id && userRestrictions.disableUpdateOthers) {
                    const existing = dataList.find(p => p.id === id);
                    const isCreatorSelf = existing && ((existing.creatorId && (existing.creatorId === currentUser?.uid || (currentUser?.email && existing.creatorId.toLowerCase() === (currentUser?.email || '').toLowerCase()))) || (existing.createdBy && (existing.createdBy === currentUser?.uid || (currentUser?.email && existing.createdBy.toLowerCase() === (currentUser?.email || '').toLowerCase()))));
                    if (!isCreatorSelf) {
                        throw new Error("You are restricted from updating profiles created by other members.");
                    }
                }

                if (id) {
                    if (currentTab === 'customers') await peopleService.updateCustomer(id, payload);
                    else if (currentTab === 'businesses' || isBusinessMode) await peopleService.updateBusiness(id, payload);
                    else if (currentTab === 'clients') await peopleService.updateClient(id, payload);

                    if (payload.isPrimary) {
                        await peopleService.setPrimaryBusiness(id).catch(() => {});
                    }
                    showAlert.success(`${typeLabel} updated successfully!`);
                } else {
                    let newId;
                    if (currentTab === 'customers') newId = await peopleService.addCustomer(payload, currentUser?.uid);
                    else if (currentTab === 'businesses' || isBusinessMode) newId = await peopleService.addBusiness(payload, currentUser?.uid);
                    else if (currentTab === 'clients') newId = await peopleService.addClient(payload, currentUser?.uid);

                    if (payload.isPrimary && newId) {
                        await peopleService.setPrimaryBusiness(newId).catch(() => {});
                    }
                    showAlert.success(`${typeLabel} created successfully!`);
                }

                const curId = id || 'new';
                draftManager.clearDraft(`person_${currentTab}_${curId}`);
                draftManager.unregisterActiveForm('person_form');
                if (personUnsavedIndicator) personUnsavedIndicator.update(false);

                if (returnToDetailAfterEditor && activePersonDetail) {
                    activePersonDetail = { ...activePersonDetail, ...payload, id: id || activePersonDetail.id };
                    renderDedicatedDetailView();
                } else {
                    hidePersonEditor();
                    loadData();
                }
            } catch (err) {
                console.error("Save error:", err);
                showAlert.error("Failed to save profile: " + (err.message || 'Error'));
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Profile';
                }
            }
        };
    }

    // -------------------------------------------------------------
    // ATTACH LIST EVENTS
    // -------------------------------------------------------------
    function bindListEvents() {
        const btnAdd = container.querySelector('#btn-add-person');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                showPersonEditor(null, false);
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
                    hidePersonEditor();
                    loadData();
                });
            });
        }

        setupPersonEditorView();
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

        container.querySelectorAll('.btn-detail-inv-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                detailInvoiceStatusFilter = e.currentTarget.getAttribute('data-inv-status');
                renderDedicatedDetailView();
            });
        });

        const btnSetPrimary = container.querySelector('#btn-detail-set-primary');
        if (btnSetPrimary && activePersonDetail) {
            btnSetPrimary.addEventListener('click', async () => {
                try {
                    await peopleService.setPrimaryBusiness(activePersonDetail.id);
                    activePersonDetail.isPrimary = true;
                    showAlert.success(`"${activePersonDetail.name}" set as Primary Business. Invoices will default to this business.`);
                    renderDedicatedDetailView();
                } catch(err) {
                    showAlert.error(err.message || 'Failed to set primary business');
                }
            });
        }

        const btnEdit = container.querySelector('#btn-edit-detail-profile');
        if (btnEdit && activePersonDetail) {
            btnEdit.addEventListener('click', () => {
                showPersonEditor(activePersonDetail, true);
            });
        }

        setupPersonEditorView();

        // Create Invoice pre-filled with this person / business / client
        const triggerCreateInvoice = () => {
            const p = activePersonDetail;
            if (!p) return;
            const isBus = isBusinessMode || currentTab === 'businesses';
            const targetMode = currentTab === 'clients' ? 'client' : (currentTab === 'businesses' ? 'business' : 'customer');
            const targetRoute = isBus ? '/invoices/customer' : (targetMode === 'client' ? '/invoices/business' : '/invoices/customer');
            
            const preselectedPayload = {
                mode: targetMode,
                id: p.id,
                uniqueId: p.uniqueId || p.id,
                name: p.name,
                phone: p.phone || '',
                email: p.email || '',
                address: p.address || '',
                imageUrl: p.imageUrl || p.imageUri || ''
            };

            window.__preselectedInvoiceRecipient = preselectedPayload;
            try {
                sessionStorage.setItem('pricelister_preselected_invoice_target', JSON.stringify(preselectedPayload));
            } catch (e) {
                console.warn('Could not store preselected invoice recipient in sessionStorage', e);
            }

            if (window.navigateToRoute) {
                window.navigateToRoute(targetRoute, true);
            } else {
                window.location.hash = '#' + targetRoute;
            }
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

        if (activeDetailTab === 'emi' && activePersonDetail) {
            const emiContainer = container.querySelector('#customer-emi-container');
            if (emiContainer) {
                const finSvc = getFinanceService(workspaceId);
                finSvc.getAllEmiAccounts({ customerId: activePersonDetail.id }).then(emiList => {
                    const matched = (emiList || []).filter(e => 
                        e.customerId === activePersonDetail.id ||
                        (e.customerName && activePersonDetail.name && e.customerName.toLowerCase() === activePersonDetail.name.toLowerCase())
                    );
                    if (matched.length === 0) {
                        emiContainer.innerHTML = `
                            <div style="padding:2rem; text-align:center; color:#71717A; background:#FAFAFA; border:1px dashed #E4E4E7; border-radius:10px;">
                                No active or historical EMI accounts found for ${escapeHtml(activePersonDetail.name)}.
                            </div>
                        `;
                    } else {
                        emiContainer.innerHTML = `
                            <div style="overflow-x:auto;">
                                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.7rem; text-transform:uppercase;">
                                            <th style="padding:0.6rem 0.8rem;">Account #</th>
                                            <th style="padding:0.6rem 0.8rem;">Financed Amount</th>
                                            <th style="padding:0.6rem 0.8rem;">Total Paid</th>
                                            <th style="padding:0.6rem 0.8rem;">Remaining Due</th>
                                            <th style="padding:0.6rem 0.8rem;">Next Due Date</th>
                                            <th style="padding:0.6rem 0.8rem;">Status</th>
                                            <th style="padding:0.6rem 0.8rem; text-align:right;">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${matched.map(e => `
                                            <tr class="people-table-row">
                                                <td style="padding:0.6rem 0.8rem; font-family:monospace; font-weight:700;">${e.accountNumber}</td>
                                                <td style="padding:0.6rem 0.8rem;">${currSym} ${Number(e.totalPayable).toFixed(2)}</td>
                                                <td style="padding:0.6rem 0.8rem; font-weight:700; color:#18181B;">${currSym} ${Number(e.totalPaid).toFixed(2)}</td>
                                                <td style="padding:0.6rem 0.8rem; font-weight:700;">${currSym} ${Number(e.remainingBalance).toFixed(2)}</td>
                                                <td style="padding:0.6rem 0.8rem; color:#71717A;">${e.firstDueDate || '—'}</td>
                                                <td style="padding:0.6rem 0.8rem;">
                                                    <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; font-size:0.68rem; text-transform:uppercase;">${e.status}</span>
                                                </td>
                                                <td style="padding:0.6rem 0.8rem; text-align:right;">
                                                    <a href="#/finance-tracker" class="btn btn-secondary btn-sm" style="font-size:0.75rem; font-weight:700; text-decoration:none; display:inline-block;">
                                                        Manage in Finance &rarr;
                                                    </a>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }
                }).catch(() => {
                    emiContainer.innerHTML = `<div style="padding:1rem; text-align:center; color:#71717A;">Could not load EMI records.</div>`;
                });
            }
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
                    btnAvatar1.style.boxShadow = '0 0 0 4px #18181B, 0 8px 24px rgba(0,0,0,0.15)';
                    btnAvatar1.style.transform = 'scale(1.08)';
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                btnAvatar1.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    btnAvatar1.style.borderColor = '#18181B';
                    btnAvatar1.style.boxShadow = '0 4px 14px rgba(0,0,0,0.08)';
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
    // FLOATING BATCH ACTION BAR UPDATER
    // -------------------------------------------------------------
    const updatePeopleBatchBar = (filteredPeople = []) => {
        if (!container || !container.isConnected) return;
        let bar = document.getElementById('people-batch-action-bar');
        if (!bar) bar = container.querySelector('#people-batch-action-bar');
        if (bar && bar.parentElement !== document.body) {
            document.body.appendChild(bar);
        }
        const countEl = bar ? bar.querySelector('#people-batch-count') : null;
        const invertBtn = bar ? bar.querySelector('#btn-people-batch-invert') : null;
        const selectAllBtn = bar ? bar.querySelector('#btn-people-batch-select-all') : null;
        const count = selectedPeopleIds.size;

        if (bar) {
            if (count > 0) {
                bar.style.display = 'flex';
                setTimeout(() => bar.classList.add('visible'), 10);
            } else {
                bar.classList.remove('visible');
                setTimeout(() => { if (selectedPeopleIds.size === 0) bar.style.display = 'none'; }, 200);
            }
        }

        if (countEl) {
            countEl.textContent = `${count} selected`;
        }

        if (selectAllBtn) {
            const total = filteredPeople.length;
            selectAllBtn.textContent = (count === total && total > 0) ? 'Deselect All' : 'Select All';
        }

        // Invert button: only visible if 2 or more items are selected
        if (invertBtn) {
            if (count >= 2) {
                invertBtn.style.display = 'inline-flex';
            } else {
                invertBtn.style.display = 'none';
            }
        }

        container.querySelectorAll('.people-select-chk').forEach(chk => {
            const id = chk.getAttribute('data-id');
            chk.checked = selectedPeopleIds.has(id);
        });

        container.querySelectorAll('.people-table-row').forEach(row => {
            const id = row.getAttribute('data-id');
            if (selectedPeopleIds.has(id)) {
                row.style.backgroundColor = '#F4F4F5';
            } else {
                row.style.backgroundColor = '';
            }
        });

        const headerChk = container.querySelector('#people-select-all');
        if (headerChk) {
            const total = filteredPeople.length;
            headerChk.checked = total > 0 && count === total;
            headerChk.indeterminate = count > 0 && count < total;
        }
    };

    // -------------------------------------------------------------
    // REALTIME LIST RENDERER
    // -------------------------------------------------------------
    function renderRealtimeList(data) {
        dataList = data || [];

        if (activePersonDetail) {
            const updatedObj = dataList.find(x => x.id === activePersonDetail.id);
            if (updatedObj) activePersonDetail = updatedObj;
            renderDedicatedDetailView();
            return;
        }

        // Apply search filter
        let filtered = [...dataList];
        if (peopleSearchTerm) {
            const q = peopleSearchTerm.toLowerCase();
            filtered = filtered.filter(p => {
                const name = (p.name || p.businessName || '').toLowerCase();
                const phone = (p.phone || '').toLowerCase();
                const email = (p.email || '').toLowerCase();
                const addr = (p.address || '').toLowerCase();
                const uid = (p.uniqueId || p.id || '').toLowerCase();
                return name.includes(q) || phone.includes(q) || email.includes(q) || addr.includes(q) || uid.includes(q);
            });
        }

        // Apply query filter (all, unused, custom_count, count_range, spent_range, high_spent)
        if (peopleFilterQuery && peopleFilterQuery !== 'all') {
            filtered = filtered.filter(p => {
                const stats = getPersonStats(p);
                if (peopleFilterQuery === 'unused') return stats.count === 0;
                if (peopleFilterQuery === 'custom_count') {
                    if (customInvoiceCountVal === '' || isNaN(Number(customInvoiceCountVal))) return true;
                    return stats.count === Number(customInvoiceCountVal);
                }
                if (peopleFilterQuery === 'count_range') {
                    const min = peopleCountMin !== '' ? Number(peopleCountMin) : -Infinity;
                    const max = peopleCountMax !== '' ? Number(peopleCountMax) : Infinity;
                    return stats.count >= min && stats.count <= max;
                }
                if (peopleFilterQuery === 'spent_range') {
                    const min = peopleSpentMin !== '' ? Number(peopleSpentMin) : -Infinity;
                    const max = peopleSpentMax !== '' ? Number(peopleSpentMax) : Infinity;
                    return stats.totalSpent >= min && stats.totalSpent <= max;
                }
                if (peopleFilterQuery === 'high_spent') {
                    return stats.totalSpent >= 500;
                }
                return true;
            });
        }

        // Apply sort
        filtered.sort((a, b) => {
            const statsA = getPersonStats(a);
            const statsB = getPersonStats(b);
            if (peopleSortQuery === 'newest') {
                const tA = a.createdAt || a.timestamp || 0;
                const tB = b.createdAt || b.timestamp || 0;
                return Number(tB) - Number(tA);
            }
            if (peopleSortQuery === 'oldest') {
                const tA = a.createdAt || a.timestamp || 0;
                const tB = b.createdAt || b.timestamp || 0;
                return Number(tA) - Number(tB);
            }
            if (peopleSortQuery === 'spent_high') {
                return statsB.totalSpent - statsA.totalSpent;
            }
            if (peopleSortQuery === 'spent_low') {
                return statsA.totalSpent - statsB.totalSpent;
            }
            if (peopleSortQuery === 'invoices_high') {
                return statsB.count - statsA.count;
            }
            if (peopleSortQuery === 'name_asc') {
                return (a.name || '').localeCompare(b.name || '');
            }
            if (peopleSortQuery === 'name_desc') {
                return (b.name || '').localeCompare(a.name || '');
            }
            return 0;
        });
        
        // Update header count badge dynamically
        const countBadge = container.querySelector('#people-count-badge');
        if (countBadge) {
            const count = filtered.length;
            const label = isBusinessMode 
                ? (count === 1 ? 'Business' : 'Businesses') 
                : (currentTab === 'clients' ? (count === 1 ? 'Client' : 'Clients') : (count === 1 ? 'Customer' : 'Customers'));
            countBadge.textContent = `${count} ${label}`;
        }

        const tbody = container.querySelector('#people-list-body');
        if (!tbody) return;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:2.5rem; text-align:center; color: var(--text-muted);">No matching ${isBusinessMode ? 'businesses' : currentTab} found.</td></tr>`;
            updatePeopleBatchBar([]);
            return;
        }

        const currSym = getAppCurrencySymbol();

        tbody.innerHTML = filtered.map(person => {
            const stats = getPersonStats(person);
            const count = stats.count;
            const img = person.imageUrl || person.imageUri;
            const isSelected = selectedPeopleIds.has(person.id);

            const avatarFallback = currentTab === 'clients' 
                ? ICONS.client 
                : (isBusinessMode ? ICONS.business : ICONS.person);

            return `
                <tr class="people-table-row" data-id="${person.id}" style="${isSelected ? 'background:#F4F4F5;' : ''}">
                    <td style="padding:0.9rem 0.5rem 0.9rem 1.25rem;">
                        <input type="checkbox" class="people-select-chk" data-id="${person.id}" ${isSelected ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:#18181B;">
                    </td>
                    <td style="padding:0.9rem 1rem;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:38px; height:38px; border-radius:50%; background:#F4F4F5; border:1.5px solid #E4E4E7; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#18181B;">
                                ${img ? `
                                    <img src="${escapeHtml(img)}" alt="${escapeHtml(person.name)}" style="width:100%; height:100%; object-fit:cover;">
                                ` : avatarFallback}
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                    <strong style="color:var(--text-primary); font-size:0.92rem;">${escapeHtml(person.name)}</strong>
                                    ${(isBusinessMode || currentTab === 'businesses') && person.isPrimary ? `
                                        <span class="badge badge-primary-business" style="background:#FAFAFA; color:#18181B; border:1px solid #E4E4E7; font-size:0.68rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:999px; display:inline-flex; align-items:center; gap:3px;">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>Primary
                                        </span>
                                    ` : ''}
                                </div>
                                <small class="text-muted" style="font-family:monospace; font-size:0.75rem;">${person.uniqueId || person.id}</small>
                            </div>
                        </div>
                    </td>
                    <td style="padding:0.9rem 1rem; font-size:0.85rem;">
                        ${person.phone ? `<div style="display:flex; align-items:center; gap:4px;"><span style="color:#71717A;">${ICONS.phone}</span> ${escapeHtml(person.phone)}</div>` : ''}
                        ${person.email ? `<div style="color:var(--text-muted); display:flex; align-items:center; gap:4px;"><span style="color:#71717A;">${ICONS.email}</span> ${escapeHtml(person.email)}</div>` : ''}
                        ${!person.phone && !person.email ? '<span style="color:var(--text-muted);">—</span>' : ''}
                    </td>
                    <td style="padding:0.9rem 1rem; font-size:0.85rem; color:var(--text-secondary); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        ${escapeHtml(person.address || '—')}
                    </td>
                    <td style="padding:0.9rem 1rem; font-weight:700; color:var(--text-primary); font-size:0.9rem;">
                        ${currSym} ${stats.totalSpent.toFixed(2)}
                    </td>
                    <td style="padding:0.9rem 1rem;">
                        <span class="badge" style="background:#FAFAFA; color:#18181B; font-weight:700; font-size:0.78rem; padding:0.25rem 0.65rem; border-radius:999px; border:1px solid #E4E4E7; display:inline-flex; align-items:center; gap:4px; box-shadow:0 1px 2px rgba(0,0,0,0.02);">
                            ${count} ${count === 1 ? 'Invoice' : 'Invoices'}
                        </span>
                    </td>
                    <td style="padding:0.9rem 1.25rem; text-align:right;">
                        <div style="display:inline-flex; gap:0.4rem; align-items:center;">
                            ${(isBusinessMode || currentTab === 'businesses') && !person.isPrimary ? `
                                <button type="button" class="btn btn-sm btn-secondary set-primary-business-btn" data-id="${person.id}" title="Set as default business for all new invoices" style="font-weight:600; font-size:0.75rem; padding:0.25rem 0.55rem; display:inline-flex; align-items:center; gap:3px;">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                    Make Primary
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-sm btn-primary add-invoice-for-person" data-id="${person.id}" style="background:#18181B; border:1px solid #18181B; color:#ffffff; font-weight:700; font-size:0.78rem; padding:0.25rem 0.65rem; display:inline-flex; align-items:center; gap:3px;" title="Create new invoice for ${escapeHtml(person.name)}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Invoice
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary view-person-detail" data-id="${person.id}" style="font-weight:600; font-size:0.78rem; padding:0.25rem 0.65rem;">
                                View
                            </button>
                            <button type="button" class="btn btn-sm btn-secondary edit-person" data-id="${person.id}" style="font-size:0.78rem; padding:0.25rem 0.65rem;">
                                Edit
                            </button>
                            <button type="button" class="btn btn-sm btn-outline del-person" data-id="${person.id}" style="font-size:0.78rem; padding:0.25rem 0.65rem; color:#71717A; border-color:#E4E4E7;">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Wire Toolbar Search, Filter & Sort Events
        const searchInput = container.querySelector('#people-search-input');
        if (searchInput && !searchInput.__bound) {
            searchInput.__bound = true;
            searchInput.addEventListener('input', (e) => {
                peopleSearchTerm = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }

        const filterSelect = container.querySelector('#people-filter-query');
        if (filterSelect && !filterSelect.__bound) {
            filterSelect.__bound = true;
            filterSelect.addEventListener('change', (e) => {
                peopleFilterQuery = e.target.value;
                const countInput = container.querySelector('#people-custom-count');
                const countRangeWrap = container.querySelector('#people-count-range-wrap');
                const spentRangeWrap = container.querySelector('#people-spent-range-wrap');
                if (countInput) {
                    countInput.style.display = peopleFilterQuery === 'custom_count' ? 'inline-block' : 'none';
                    if (peopleFilterQuery === 'custom_count') countInput.focus();
                }
                if (countRangeWrap) {
                    countRangeWrap.style.display = peopleFilterQuery === 'count_range' ? 'inline-flex' : 'none';
                }
                if (spentRangeWrap) {
                    spentRangeWrap.style.display = peopleFilterQuery === 'spent_range' ? 'inline-flex' : 'none';
                }
                renderRealtimeList(dataList);
            });
        }

        const customCountInput = container.querySelector('#people-custom-count');
        if (customCountInput && !customCountInput.__bound) {
            customCountInput.__bound = true;
            customCountInput.addEventListener('input', (e) => {
                customInvoiceCountVal = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }

        const countMinInput = container.querySelector('#people-count-min');
        if (countMinInput && !countMinInput.__bound) {
            countMinInput.__bound = true;
            countMinInput.addEventListener('input', (e) => {
                peopleCountMin = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }
        const countMaxInput = container.querySelector('#people-count-max');
        if (countMaxInput && !countMaxInput.__bound) {
            countMaxInput.__bound = true;
            countMaxInput.addEventListener('input', (e) => {
                peopleCountMax = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }

        const spentMinInput = container.querySelector('#people-spent-min');
        if (spentMinInput && !spentMinInput.__bound) {
            spentMinInput.__bound = true;
            spentMinInput.addEventListener('input', (e) => {
                peopleSpentMin = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }
        const spentMaxInput = container.querySelector('#people-spent-max');
        if (spentMaxInput && !spentMaxInput.__bound) {
            spentMaxInput.__bound = true;
            spentMaxInput.addEventListener('input', (e) => {
                peopleSpentMax = e.target.value.trim();
                renderRealtimeList(dataList);
            });
        }

        const sortSelect = container.querySelector('#people-sort-query');
        if (sortSelect && !sortSelect.__bound) {
            sortSelect.__bound = true;
            sortSelect.addEventListener('change', (e) => {
                peopleSortQuery = e.target.value;
                renderRealtimeList(dataList);
            });
        }

        // Wire Item Action Buttons
        container.querySelectorAll('.add-invoice-for-person').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute('data-id');
                const p = filtered.find(x => x.id === id);
                if (p) {
                    const isBus = isBusinessMode || currentTab === 'businesses';
                    const targetMode = currentTab === 'clients' ? 'client' : (currentTab === 'businesses' ? 'business' : 'customer');
                    const targetRoute = isBus ? '/invoices/customer' : (targetMode === 'client' ? '/invoices/business' : '/invoices/customer');

                    const preselectedPayload = {
                        mode: targetMode,
                        id: p.id,
                        uniqueId: p.uniqueId || p.id,
                        name: p.name,
                        phone: p.phone || '',
                        email: p.email || '',
                        address: p.address || '',
                        imageUrl: p.imageUrl || p.imageUri || ''
                    };

                    window.__preselectedInvoiceRecipient = preselectedPayload;
                    try {
                        sessionStorage.setItem('pricelister_preselected_invoice_target', JSON.stringify(preselectedPayload));
                    } catch (err) {
                        console.warn('Could not store preselected invoice recipient in sessionStorage', err);
                    }

                    if (window.navigateToRoute) {
                        window.navigateToRoute(targetRoute, true);
                    } else {
                        window.location.hash = '#' + targetRoute;
                    }
                }
            });
        });

        container.querySelectorAll('.set-primary-business-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute('data-id');
                const p = filtered.find(x => x.id === id);
                try {
                    await peopleService.setPrimaryBusiness(id);
                    showAlert.success(`"${p?.name || 'Business'}" is now the Primary Business (default for new invoices).`);
                    const refreshed = await peopleService.getAllBusinesses();
                    renderRealtimeList(refreshed);
                } catch(err) {
                    showAlert.error(err.message || 'Failed to update primary business');
                }
            });
        });

        container.querySelectorAll('.view-person-detail').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute('data-id');
                const p = filtered.find(x => x.id === id);
                if (p) {
                    activePersonDetail = p;
                    activeDetailTab = 'invoices';
                    renderDedicatedDetailView();
                }
            });
        });

        // Checkbox events
        container.querySelectorAll('.people-select-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) {
                    selectedPeopleIds.add(id);
                } else {
                    selectedPeopleIds.delete(id);
                }
                updatePeopleBatchBar(filtered);
            });
            chk.addEventListener('click', (e) => e.stopPropagation());
        });

        // Row Click & Long-press (~450ms) to trigger multi-selection
        container.querySelectorAll('.people-table-row').forEach(row => {
            let pressTimer = null;
            let isLongPress = false;

            const startPress = () => {
                isLongPress = false;
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    const id = row.getAttribute('data-id');
                    if (selectedPeopleIds.has(id)) {
                        selectedPeopleIds.delete(id);
                    } else {
                        selectedPeopleIds.add(id);
                    }
                    updatePeopleBatchBar(filtered);
                }, 450);
            };

            const cancelPress = () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                    pressTimer = null;
                }
            };

            row.addEventListener('mousedown', startPress);
            row.addEventListener('mouseup', cancelPress);
            row.addEventListener('mouseleave', cancelPress);
            row.addEventListener('touchstart', startPress, { passive: true });
            row.addEventListener('touchend', cancelPress);
            row.addEventListener('touchmove', cancelPress);

            row.addEventListener('click', (e) => {
                if (isLongPress) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;

                const id = row.getAttribute('data-id');
                const p = filtered.find(x => x.id === id);

                // When multi-select mode is active, card click only toggles selection!
                if (selectedPeopleIds.size > 0) {
                    e.preventDefault();
                    if (selectedPeopleIds.has(id)) {
                        selectedPeopleIds.delete(id);
                    } else {
                        selectedPeopleIds.add(id);
                    }
                    updatePeopleBatchBar(filtered);
                    return;
                }

                // If not in multi-selection mode, open view
                if (p) {
                    activePersonDetail = p;
                    activeDetailTab = 'invoices';
                    renderDedicatedDetailView();
                }
            });
        });

        // Batch Action Bar Button Listeners
        const selectAllBtn = container.querySelector('#btn-people-batch-select-all');
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                const total = filtered.length;
                if (selectedPeopleIds.size === total && total > 0) {
                    selectedPeopleIds.clear();
                } else {
                    filtered.forEach(p => selectedPeopleIds.add(p.id));
                }
                updatePeopleBatchBar(filtered);
            };
        }

        const invertBtn = container.querySelector('#btn-people-batch-invert');
        if (invertBtn) {
            invertBtn.onclick = () => {
                filtered.forEach(p => {
                    if (selectedPeopleIds.has(p.id)) {
                        selectedPeopleIds.delete(p.id);
                    } else {
                        selectedPeopleIds.add(p.id);
                    }
                });
                updatePeopleBatchBar(filtered);
            };
        }

        const cancelBatchBtn = container.querySelector('#btn-people-batch-cancel');
        if (cancelBatchBtn) {
            cancelBatchBtn.onclick = () => {
                selectedPeopleIds.clear();
                updatePeopleBatchBar(filtered);
            };
        }

        const exportBatchBtn = container.querySelector('#btn-people-batch-export');
        if (exportBatchBtn) {
            exportBatchBtn.onclick = () => {
                const sel = filtered.filter(p => selectedPeopleIds.has(p.id));
                if (sel.length === 0) {
                    showAlert.warning("Please select at least one profile to export.");
                    return;
                }
                const header = ["ID", "Name", "Phone", "Email", "Address", "Total Spent", "Invoices"];
                const rows = sel.map(p => {
                    const stats = getPersonStats(p);
                    return [
                        `"${p.uniqueId || p.id || ''}"`,
                        `"${(p.name || '').replace(/"/g, '""')}"`,
                        `"${(p.phone || '').replace(/"/g, '""')}"`,
                        `"${(p.email || '').replace(/"/g, '""')}"`,
                        `"${(p.address || '').replace(/"/g, '""')}"`,
                        stats.totalSpent.toFixed(2),
                        stats.count
                    ].join(',');
                });
                const csvContent = "data:text/csv;charset=utf-8," + [header.join(','), ...rows].join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `${isBusinessMode ? 'businesses' : currentTab}_export_${Date.now()}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            };
        }

        const deleteBatchBtn = container.querySelector('#btn-people-batch-delete');
        if (deleteBatchBtn) {
            deleteBatchBtn.onclick = async () => {
                if (userRestrictions.disableDelete) {
                    showAlert.warning("You are restricted from deleting directory profiles.");
                    return;
                }
                const idsToDelete = Array.from(selectedPeopleIds);
                if (idsToDelete.length === 0) return;

                const typeName = isBusinessMode ? 'business' : (currentTab === 'clients' ? 'client' : 'customer');
                if (await showAlert.confirm(`Are you sure you want to delete all ${idsToDelete.length} selected ${typeName} profiles? Profiles associated with invoices will be protected.`)) {
                    let deletedCount = 0;
                    let skippedCount = 0;
                    for (const id of idsToDelete) {
                        const person = filtered.find(x => x.id === id);
                        const stats = getPersonStats(person);
                        if (stats.count > 0) {
                            skippedCount++;
                            continue;
                        }
                        try {
                            if (currentTab === 'customers') await peopleService.deleteCustomer(id);
                            else if (currentTab === 'businesses') await peopleService.deleteBusiness(id);
                            else if (currentTab === 'clients') await peopleService.deleteClient(id);
                            deletedCount++;
                        } catch (err) {
                            console.error(`Failed to delete person ${id}:`, err);
                        }
                    }
                    selectedPeopleIds.clear();
                    if (skippedCount > 0) {
                        showAlert.info(`Deleted ${deletedCount} profiles. (${skippedCount} skipped because they have existing invoices).`);
                    } else {
                        showAlert.success(`Successfully deleted ${deletedCount} profiles.`);
                    }
                    renderRealtimeList(dataList);
                }
            };
        }

        // Header Checkbox
        const headerChk = container.querySelector('#people-select-all');
        if (headerChk) {
            headerChk.onclick = (e) => {
                e.stopPropagation();
                if (headerChk.checked) {
                    filtered.forEach(p => selectedPeopleIds.add(p.id));
                } else {
                    selectedPeopleIds.clear();
                }
                updatePeopleBatchBar(filtered);
            };
        }

        // Keyboard Shortcut: Ctrl+A / Cmd+A when multi-select is active
        const handleKeyDown = (e) => {
            if (!container || !container.isConnected) return;
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
                if (selectedPeopleIds.size > 0 && !activePersonDetail) {
                    e.preventDefault();
                    filtered.forEach(p => selectedPeopleIds.add(p.id));
                    updatePeopleBatchBar(filtered);
                }
            }
        };
        window.removeEventListener('keydown', container.__peopleKeyHandler);
        container.__peopleKeyHandler = handleKeyDown;
        window.addEventListener('keydown', handleKeyDown);

        updatePeopleBatchBar(filtered);

        container.querySelectorAll('.edit-person').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.currentTarget.getAttribute('data-id');
                const p = dataList.find(x => x.id === id);
                if (p) {
                    showPersonEditor(p, false);
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

                const isCreatorSelf = (person?.creatorId && (person.creatorId === currentUser?.uid || (currentUser?.email && person.creatorId.toLowerCase() === (currentUser?.email || '').toLowerCase()))) || (person?.createdBy && (person.createdBy === currentUser?.uid || (currentUser?.email && person.createdBy.toLowerCase() === (currentUser?.email || '').toLowerCase())));
                if (userRestrictions.disableDelete) {
                    showAlert.warning("You are restricted from deleting directory profiles.");
                    return;
                }
                if (userRestrictions.disableDeleteOthers && !isCreatorSelf) {
                    showAlert.warning("You are restricted from deleting directory profiles created by other members.");
                    return;
                }

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
