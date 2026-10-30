import { getInvoiceService } from '../services/invoiceService.js';
import { getProductService } from '../services/productService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCategoryService } from '../services/categoryService.js';
import { authService } from '../../firebase/auth.js';
import { getUserRestrictions } from '../auth-handler.js';
import { showAlert } from '../alert-handler.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { generateUniqueId } from '../../DataModel.js';
import { exportInvoicesExcel } from '../utils/exportEngine.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { openInvoiceDetailsModal } from './invoiceDetailsModal.js';
import { storageService } from '../../supabase/storage.js';
import { draftManager } from '../services/draftManager.js';

export const renderInvoices = async (container, workspaceId, isBusinessInvoice) => {
    const invoiceService = getInvoiceService(workspaceId);
    const productService = getProductService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const settingsService = getSettingsService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const currentUser = authService.getCurrentUser();
    const userRestrictions = getUserRestrictions();

    const typeLabel = isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice';

    let allProducts = [];
    let allCategories = [];
    let allBusinesses = [];
    let allClients = [];
    let allCustomers = [];
    let invoiceItems = [];
    let rawInvoices = [];
    let isVendingActive = false;

    // Recipient selection mode: 'customer' | 'client' | 'walkin'
    let recipientMode = isBusinessInvoice ? 'client' : 'customer';

    // State for Editing
    let editingInvoiceId = null;
    let editingInvoiceUniqueId = null;

    // Advanced Product Picker State
    let pickerSelections = {}; // productId -> quantity
    let pickerSearchQuery = '';
    let pickerCategoryFilter = 'ALL';

    // Toolbar Filter States
    let activeStatus = 'ALL';
    let activeDateFilter = 'ALL';
    let customDateVal = '';
    let activeSort = 'NEWEST';
    let searchQuery = '';

    // Quick Add Entity State
    let quickAddTargetType = null; // 'business' | 'client' | 'customer'
    let quickAddPreviewImgUrl = '';

    container.innerHTML = `
        <!-- ================= INVOICE LIST VIEW ================= -->
        <div id="invoice-list-view">
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2 style="margin: 0 0 0.35rem 0; font-size: 1.75rem; font-weight: 800; color: #09090b;">${typeLabel}s</h2>
                    <div id="inv-vending-badge" style="display: inline-block;"></div>
                </div>
                <div style="display:flex; gap:0.75rem; align-items:center; flex-shrink: 0;">
                    <button id="btn-export-invoices-excel" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:600; white-space:nowrap; padding: 0.55rem 1.15rem; border-radius:10px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Export Excel
                    </button>
                    ${userRestrictions.disableAdd ? '' : `
                    <button id="btn-add-invoice" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; white-space:nowrap; padding: 0.55rem 1.25rem; border-radius:10px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Add ${typeLabel}
                    </button>
                    `}
                </div>
            </div>

            <!-- FILTER & SEARCH TOOLBAR -->
            <div class="filter-toolbar">
                <div class="filter-group-left">
                    <!-- Status Pills -->
                    <div class="filter-pills" id="inv-status-pills">
                        <button type="button" class="filter-pill active" data-status="ALL">All <span class="pill-count" id="count-all">0</span></button>
                        <button type="button" class="filter-pill pill-paid" data-status="PAID">Paid <span class="pill-count" id="count-paid">0</span></button>
                        <button type="button" class="filter-pill pill-unpaid" data-status="UNPAID">Unpaid <span class="pill-count" id="count-unpaid">0</span></button>
                    </div>

                    <!-- Date Filter Dropdown -->
                    <select id="inv-filter-date" class="form-control" style="width: auto; padding: 0.4rem 0.85rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;">
                        <option value="ALL">All Dates</option>
                        <option value="TODAY">Today</option>
                        <option value="THIS_WEEK">This Week</option>
                        <option value="THIS_MONTH">This Month</option>
                        <option value="CUSTOM">Custom Date...</option>
                    </select>
                    
                    <input type="date" id="inv-custom-date" style="display:none; width: auto; padding: 0.35rem 0.75rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;" class="form-control">

                    <!-- Sort Dropdown -->
                    <select id="inv-sort-by" class="form-control" style="width: auto; padding: 0.4rem 0.85rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;">
                        <option value="NEWEST">Newest First</option>
                        <option value="OLDEST">Oldest First</option>
                        <option value="REVENUE_DESC">Highest Revenue</option>
                        <option value="REVENUE_ASC">Lowest Revenue</option>
                    </select>
                </div>

                <div class="filter-group-right">
                    <div class="search-input-wrap">
                        <span class="search-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                        <input type="text" id="inv-search-input" placeholder="Search by name, invoice #, ID...">
                    </div>
                </div>
            </div>
            
            <div class="card" style="padding: 0; overflow: hidden; border-radius: var(--radius-card, 14px); border: 1px solid var(--border-color) !important; box-shadow: var(--shadow-float); background: var(--bg-card);">
                <div class="table-container">
                    <table style="width:100%; border-collapse: collapse; text-align:left;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); color: var(--text-secondary); background: var(--surface-50);">
                                <th style="padding:0.95rem 1.25rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">Invoice #</th>
                                <th style="padding:0.95rem 1rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">Date</th>
                                <th style="padding:0.95rem 1rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">${isBusinessInvoice ? 'Business (Issuer) & Recipient' : 'Customer / Recipient'}</th>
                                <th style="padding:0.95rem 1rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">Status</th>
                                <th style="padding:0.95rem 1rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">Total</th>
                                <th style="padding:0.95rem 1.25rem; font-weight:700; font-size:0.84rem; border-bottom: 1px solid var(--border-color); background: var(--surface-50); color: var(--text-primary);">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="invoices-table-body">
                            ${Array(5).fill(0).map(() => `
                                <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 100px; height: 18px;"></div></td>
                                    <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 75px; height: 18px;"></div></td>
                                    <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 130px; height: 18px;"></div></td>
                                    <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 65px; height: 22px; border-radius: 9999px;"></div></td>
                                    <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 70px; height: 18px;"></div></td>
                                    <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 140px; height: 28px; border-radius: 8px;"></div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ================= EXPANDED INVOICE CREATION / EDIT VIEW ================= -->
        <div id="invoice-editor-view" style="display:none; margin-bottom: 2.5rem;">
            
            <!-- Top Back Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <button type="button" id="btn-back-to-list" class="btn btn-secondary" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px; padding: 0.55rem 1rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Back to Invoices
                </button>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span id="form-vending-indicator" style="font-size: 0.85rem; font-weight: 600;"></span>
                </div>
            </div>

            <!-- 2-COLUMN EXPANDED VIEW CONTAINER -->
            <div style="display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 1.5rem; align-items: start;" class="invoice-editor-grid">
                
                <!-- LEFT COLUMN: MAIN FORM -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                        <div>
                            <h3 id="inv-form-title" style="margin:0; font-size: 1.4rem; color: var(--text-primary); font-weight: 800;">New ${typeLabel}</h3>
                            <p id="inv-form-subtitle" style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Fill in the details below to generate your invoice.</p>
                        </div>
                    </div>

                    <form id="invoice-form" style="display:flex; flex-direction:column; gap:1.75rem;">
                        
                        <!-- SECTION 1: ISSUER (YOUR BUSINESS) -->
                        <div class="form-section" style="background: rgba(241, 245, 249, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap:wrap; gap:0.5rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:var(--primary, #2563eb); color:white; font-size:0.75rem; font-weight:800;">1</span>
                                    <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Issuer (Your Business) <span style="color:var(--danger);">*</span></h4>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    <button type="button" id="btn-browse-inv-business" class="btn btn-sm btn-primary" style="display:inline-flex; align-items:center; gap:5px; font-weight:700; font-size:0.78rem; padding:0.3rem 0.75rem;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                                        Browse Business
                                    </button>
                                    <button type="button" id="btn-quick-add-business" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>New Business
                                    </button>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: 0.75rem; position:relative;">
                                <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Select Business Profile (Search or Browse All)</label>
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <div style="position:relative; flex:1;">
                                        <input type="text" id="search-inv-business" class="form-control" placeholder="Search business by name, phone, email... or click Browse All" style="width:100%; padding:0.55rem 0.75rem; font-size:0.85rem;" autocomplete="off">
                                        <div id="dropdown-inv-business" class="entity-search-dropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1000; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 10px 20px rgba(0,0,0,0.12); max-height:220px; overflow-y:auto;">
                                            <!-- populated dynamically -->
                                        </div>
                                    </div>
                                    <button type="button" id="btn-trigger-inv-business-drawer" class="btn btn-secondary" style="padding:0.55rem 0.95rem; font-weight:700; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;" title="Open drawer to view and search all businesses">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                                        Browse Drawer
                                    </button>
                                </div>
                                <select id="inv-business" class="form-control" style="width:100%; padding:0.6rem; font-weight:600; display:none;" required>
                                    <option value="">Loading businesses...</option>
                                </select>
                            </div>

                            <!-- BUSINESS PROFILE CARD PREVIEW (Round Avatar / SVG + Details) -->
                            <div id="inv-business-preview-card" style="display:none; background:var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <!-- rendered dynamically -->
                            </div>
                        </div>

                        <!-- SECTION 2: BILLED TO (SMART PROFILE SELECTOR: Customer Profile | Client Business | Custom Walk-in) -->
                        <div class="form-section" style="background: rgba(241, 245, 249, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap:wrap; gap:0.5rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:var(--primary, #2563eb); color:white; font-size:0.75rem; font-weight:800;">2</span>
                                    <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Billed To (Recipient) <span style="color:var(--danger);">*</span></h4>
                                </div>
                                <div style="display:flex; gap:0.4rem; align-items:center;">
                                    <button type="button" id="btn-browse-inv-recipient" class="btn btn-sm btn-primary" style="display:inline-flex; align-items:center; gap:5px; font-weight:700; font-size:0.78rem; padding:0.3rem 0.75rem;">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                                        <span id="btn-browse-recipient-label">Browse Client</span>
                                    </button>
                                    <button type="button" id="btn-quick-add-customer" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>Customer
                                    </button>
                                    <button type="button" id="btn-quick-add-client" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.65rem; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>Client
                                    </button>
                                </div>
                            </div>

                            <!-- Smart Profile Switcher Pills -->
                            <div style="display: flex; gap: 0.4rem; margin-bottom: 0.85rem; background: var(--bg-card); padding: 0.3rem; border-radius: 8px; border: 1px solid var(--border-color); width: fit-content;" id="recipient-type-pills">
                                <button type="button" class="btn btn-sm ${recipientMode === 'customer' ? 'btn-primary' : 'btn-secondary'}" data-mode="customer" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 600; display:inline-flex; align-items:center; gap:5px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    Customer Profile
                                </button>
                                <button type="button" class="btn btn-sm ${recipientMode === 'client' ? 'btn-primary' : 'btn-secondary'}" data-mode="client" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 600; display:inline-flex; align-items:center; gap:5px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                    Client Business
                                </button>
                                <button type="button" class="btn btn-sm ${recipientMode === 'walkin' ? 'btn-primary' : 'btn-secondary'}" data-mode="walkin" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 600; display:inline-flex; align-items:center; gap:5px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Custom / Walk-in
                                </button>
                            </div>

                            <!-- Customer Profile Selector -->
                            <div id="wrap-recipient-customer" style="position:relative; ${recipientMode === 'customer' ? 'display:block;' : 'display:none;'}">
                                <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Select Customer Profile (Search or Browse All)</label>
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <div style="position:relative; flex:1;">
                                        <input type="text" id="search-inv-customer" class="form-control" placeholder="Search customer by name, phone, email... or click Browse All" style="width:100%; padding:0.55rem 0.75rem; font-size:0.85rem;" autocomplete="off">
                                        <div id="dropdown-inv-customer" class="entity-search-dropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1000; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 10px 20px rgba(0,0,0,0.12); max-height:220px; overflow-y:auto;">
                                            <!-- populated dynamically -->
                                        </div>
                                    </div>
                                    <button type="button" id="btn-trigger-inv-customer-drawer" class="btn btn-secondary" style="padding:0.55rem 0.95rem; font-weight:700; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;" title="Open drawer to view and search all customers">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                                        Browse Drawer
                                    </button>
                                </div>
                                <select id="inv-customer" class="form-control" style="width:100%; padding:0.6rem; font-weight:600; display:none;">
                                    <option value="">Select saved customer...</option>
                                </select>
                            </div>

                            <!-- Client Profile Selector -->
                            <div id="wrap-recipient-client" style="position:relative; ${recipientMode === 'client' ? 'display:block;' : 'display:none;'}">
                                <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Select Client Profile (Search or Browse All)</label>
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <div style="position:relative; flex:1;">
                                        <input type="text" id="search-inv-client" class="form-control" placeholder="Search client by name, phone, email... or click Browse All" style="width:100%; padding:0.55rem 0.75rem; font-size:0.85rem;" autocomplete="off">
                                        <div id="dropdown-inv-client" class="entity-search-dropdown" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1000; background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; box-shadow:0 10px 20px rgba(0,0,0,0.12); max-height:220px; overflow-y:auto;">
                                            <!-- populated dynamically -->
                                        </div>
                                    </div>
                                    <button type="button" id="btn-trigger-inv-client-drawer" class="btn btn-secondary" style="padding:0.55rem 0.95rem; font-weight:700; font-size:0.82rem; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;" title="Open drawer to view and search all clients">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                                        Browse Drawer
                                    </button>
                                </div>
                                <select id="inv-client" class="form-control" style="width:100%; padding:0.6rem; font-weight:600; display:none;">
                                    <option value="">Select saved client...</option>
                                </select>
                            </div>

                            <!-- RECIPIENT PROFILE CARD PREVIEW (Round Avatar / SVG + Details) -->
                            <div id="inv-recipient-preview-card" style="display:none; margin-top: 0.75rem; background:var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                                <!-- rendered dynamically -->
                            </div>

                            <!-- Walk-in / Custom manual fields -->
                            <div id="wrap-recipient-manual" style="margin-top:0.75rem; ${recipientMode === 'walkin' ? 'display:block;' : 'display:none;'}">
                                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem;">
                                    <div>
                                        <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Recipient / Customer Name <span style="color:var(--danger);">*</span></label>
                                        <input type="text" id="inv-customer-name" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. John Doe or Acme Corp">
                                    </div>
                                    <div>
                                        <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Phone Number</label>
                                        <input type="text" id="inv-customer-phone" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. +123456789">
                                    </div>
                                    <div>
                                        <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Email Address</label>
                                        <input type="email" id="inv-customer-email" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. client@example.com">
                                    </div>
                                    <div>
                                        <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Address</label>
                                        <input type="text" id="inv-customer-address" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. 123 Main St, City">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 3: INVOICE IDENTIFICATION & METADATA -->
                        <div class="form-section">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 0.75rem;">
                                <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:#e11d48; color:white; font-size:0.75rem; font-weight:800;">3</span>
                                <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Invoice Details</h4>
                            </div>
                            
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.85rem;">
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Invoice Title <span style="color:var(--danger);">*</span></label>
                                    <input type="text" id="inv-title" class="form-control" style="width:100%; padding:0.55rem; font-weight:600;" placeholder="e.g. Invoice / Tax Invoice" value="Invoice" required>
                                </div>
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                        <label style="font-weight: 600; font-size: 0.82rem; margin: 0;">Invoice Number <span style="color:var(--danger);">*</span></label>
                                        <button type="button" id="btn-regen-inv-id" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.72rem; display:inline-flex; align-items:center; gap:4px;">
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Re-roll
                                        </button>
                                    </div>
                                    <input type="text" id="inv-number-input" class="form-control" style="width:100%; padding:0.55rem; font-family: monospace; font-weight: 700; color: #e11d48;" required>
                                </div>
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block;">Payment Status</label>
                                    <select id="inv-status" class="form-control" style="width:100%; padding:0.55rem; font-weight: 600;">
                                        <option value="Paid">Paid</option>
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Draft">Draft</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 4: PRODUCTS SELECTION -->
                        <div class="form-section">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:var(--theme-primary, #e11d48); color:white; font-size:0.75rem; font-weight:800;">4</span>
                                    <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Line Items <span style="color:var(--danger);">*</span></h4>
                                </div>
                                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                                    <button type="button" id="btn-open-scanner" class="btn" style="font-size: 0.82rem; padding: 0.4rem 0.85rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.45rem; background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; border-radius:8px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                        <span>📷 / 🔍 Scanner</span>
                                    </button>
                                    <button type="button" id="btn-toggle-picker" class="btn btn-secondary" style="font-size: 0.82rem; padding: 0.4rem 0.9rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.45rem;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                        <span id="picker-toggle-text">Open Advanced Product Picker</span>
                                    </button>
                                </div>
                            </div>

                            <!-- ADVANCED PRODUCT PICKER CONTAINER -->
                            <div id="advanced-product-picker" class="product-picker-container" style="display:none; margin-bottom: 1.5rem;">
                                <div class="picker-search-bar">
                                    <div class="search-input-wrap" style="flex: 1; min-width: 220px;">
                                        <span class="search-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                                        <input type="text" id="picker-search-input" placeholder="Search by name, size, category, UPC..." autocomplete="off">
                                    </div>
                                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                                        <button type="button" id="picker-btn-select-all" class="btn btn-sm btn-secondary" style="font-size: 0.78rem;">Select All Visible</button>
                                        <button type="button" id="picker-btn-clear-sel" class="btn btn-sm btn-secondary" style="font-size: 0.78rem;">Deselect All</button>
                                    </div>
                                </div>

                                <!-- Category Filter Pills -->
                                <div id="picker-category-pills" style="display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                                    <!-- Dynamic category pills -->
                                </div>

                                <!-- Product Cards Grid -->
                                <div class="picker-grid" id="picker-grid-container">
                                    <!-- Dynamic product grid -->
                                </div>

                                <!-- Picker Footer Actions -->
                                <div class="picker-footer">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                        Selected: <strong id="picker-count-disp" style="color: #e11d48;">0</strong> products (<strong id="picker-units-disp">0</strong> units) &bull; Est. Total: <strong id="picker-subtotal-disp" style="color: var(--text-primary);">${formatCurrency(0)}</strong>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button type="button" id="picker-close-btn" class="btn btn-secondary">Hide Picker</button>
                                        <button type="button" id="picker-add-to-inv-btn" class="btn btn-primary" style="background:#e11d48; border-color:#e11d48;">Add Selected to Invoice</button>
                                    </div>
                                </div>
                            </div>

                            <!-- CURRENT INVOICE ITEMS LIST -->
                            <div id="invoice-items-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">
                                <!-- dynamic items list -->
                            </div>

                            <!-- Single Dropdown fallback -->
                            <div style="display:flex; gap:1rem; align-items:flex-end; background: var(--surface-50); padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid var(--border-color); flex-wrap: wrap;">
                                <div style="flex:2; min-width: 200px;">
                                    <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.25rem; display: block;">Quick Single Add</label>
                                    <select id="inv-add-product-select" class="form-control" style="width:100%; padding:0.5rem;">
                                        <option value="">Loading products...</option>
                                    </select>
                                </div>
                                <div style="flex:1; max-width: 120px; min-width: 80px;">
                                    <label style="font-size: 0.8rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 0.25rem; display: block;">Qty</label>
                                    <input type="number" id="inv-add-qty" min="1" value="1" class="form-control" style="width:100%; padding:0.5rem;">
                                </div>
                                <button type="button" id="inv-btn-add-item" class="btn btn-secondary" style="padding:0.55rem 1.1rem; font-weight:600;">Add Item</button>
                            </div>
                        </div>

                        <!-- SECTION 5: CHARGES & ADJUSTMENTS (Discount, Additional Cut, Tax, Shipping - for both Invoice types) -->
                        <div class="form-section" style="background: rgba(241, 245, 249, 0.4); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.25rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 0.85rem;">
                                <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:#e11d48; color:white; font-size:0.75rem; font-weight:800;">5</span>
                                <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Discounts, Tax & Shipping Adjustments</h4>
                            </div>
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:0.85rem;">
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Discount %</label>
                                    <div style="position:relative;">
                                        <input type="number" id="inv-discount" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem 1.5rem 0.55rem 0.65rem; font-weight:600;">
                                        <span style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); font-weight:700;">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Additional Cut / Surcharge (${getAppCurrencySymbol()})</label>
                                    <div style="display:flex; gap:4px; align-items:center;">
                                        <button type="button" id="inv-add-cut-sign-btn" data-sign="-" class="btn" style="padding:0.45rem 0.75rem; font-weight:800; font-size:1.05rem; line-height:1; background:#ffffff; color:#e11d48; border:1.5px solid #e11d48; border-radius:8px;" title="Click to shift between Cut (-) and Surcharge (+)">-</button>
                                        <div style="position:relative; flex:1;">
                                            <input type="number" id="inv-add-cut" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem 0.65rem 0.55rem 1.5rem; font-weight:600;">
                                            <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); font-weight:700;">${getAppCurrencySymbol()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Tax Rate %</label>
                                    <div style="position:relative;">
                                        <input type="number" id="inv-tax" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem 1.5rem 0.55rem 0.65rem; font-weight:600;">
                                        <span style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); font-weight:700;">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label style="font-weight: 600; font-size: 0.82rem; margin-bottom: 0.35rem; display: block; color: var(--text-secondary);">Shipping Cost (${getAppCurrencySymbol()})</label>
                                    <div style="position:relative;">
                                        <input type="number" id="inv-shipping" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem 0.65rem 0.55rem 1.5rem; font-weight:600;">
                                        <span style="position:absolute; left:8px; top:50%; transform:translateY(-50%); font-size:0.8rem; color:var(--text-muted); font-weight:700;">${getAppCurrencySymbol()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION 6: NOTE / PAYMENT TERMS -->
                        <div class="form-section">
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 0.5rem;">
                                <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; background:#e11d48; color:white; font-size:0.75rem; font-weight:800;">6</span>
                                <h4 style="margin: 0; color: var(--text-primary); font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Notes & Terms</h4>
                            </div>
                            <textarea id="inv-note" class="form-control" style="width:100%; padding:0.6rem; min-height: 70px;" placeholder="Optional payment terms, delivery instructions, or bank details..."></textarea>
                        </div>
                    </form>
                </div>

                <!-- RIGHT COLUMN: STICKY LIVE FINANCIAL SUMMARY CARD -->
                <div style="position: sticky; top: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                    <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); border: 1px solid var(--border-color);">
                        <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1.05rem; font-weight: 800; display: flex; align-items: center; justify-content: space-between;">
                            <span>Financial Summary</span>
                            <span id="summary-items-count" style="font-size: 0.78rem; font-weight: 600; background: rgba(225, 29, 72, 0.1); color: #e11d48; padding: 0.2rem 0.55rem; border-radius: 9999px;">0 items</span>
                        </h4>

                        <div id="inv-live-totals" style="font-size: 0.9rem; line-height: 1.75; display: flex; flex-direction: column; gap: 0.35rem;">
                            <!-- live totals rendered dynamically -->
                        </div>

                        <!-- Action Buttons -->
                        <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                            <button type="button" class="btn btn-primary" id="inv-submit-btn" style="width: 100%; padding: 0.75rem 1rem; font-weight: 700; font-size: 0.95rem; background: #ffffff !important; border: 1.5px solid #cbd5e1 !important; color: #0f172a !important; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                Save Invoice
                            </button>
                            <button type="button" class="btn btn-secondary" id="inv-cancel-btn" style="width: 100%; padding: 0.6rem 1rem; font-weight: 600; font-size: 0.85rem;">
                                Cancel & Discard
                            </button>
                        </div>
                    </div>

                    <!-- Quick tips card -->
                    <div style="background: rgba(241, 245, 249, 0.6); border: 1px dashed var(--border-color); border-radius: 10px; padding: 0.85rem 1rem; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5;">
                        <strong style="color: var(--text-primary); display:flex; align-items:center; gap:4px; margin-bottom: 2px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            Financial Calculation Note
                        </strong>
                        Tax % is calculated on the subtotal after subtracting discounts and additional cuts. Shipping is added directly to grand total.
                    </div>
                </div>
            </div>
        </div>

        <!-- ================= INVOICE ENTITY SLIDE-OVER DRAWER (Find Business & Find Clients) ================= -->
        <div id="inv-entity-drawer-overlay" class="app-drawer-overlay" style="display:none;"></div>
        <div id="inv-entity-drawer" class="app-drawer invoice-entity-drawer" style="display:none; width:520px; max-width:95vw;">
            <div class="app-drawer-header" style="padding:1.15rem 1.4rem; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border-color); background:var(--bg-card);">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                    <div id="inv-drawer-icon" style="width:34px; height:34px; border-radius:8px; background:rgba(37,99,235,0.1); color:var(--primary, #2563eb); display:flex; align-items:center; justify-content:center;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                    </div>
                    <div>
                        <h3 id="inv-drawer-title" class="app-drawer-title" style="font-size:1.05rem; font-weight:800; margin:0; color:var(--text-primary);">Find Business</h3>
                        <div id="inv-drawer-count" style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Showing all entries</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <button type="button" id="inv-drawer-btn-quick-add" class="btn btn-sm btn-secondary" style="font-size:0.75rem; font-weight:700; padding:0.35rem 0.65rem; display:inline-flex; align-items:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        <span id="inv-drawer-btn-quick-add-text">Add New</span>
                    </button>
                    <button type="button" id="inv-drawer-close-btn" class="app-drawer-close" aria-label="Close Drawer" title="Close (Esc)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <!-- SEARCH BAR & TOGGLES AT TOP OF DRAWER -->
            <div style="padding:0.9rem 1.4rem; background:var(--bg-main, #f5f7fa); border-bottom:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.6rem;">
                
                <!-- Client - Customer toggle pills (shown when in Find Clients mode) -->
                <div id="inv-drawer-client-toggle-wrap" style="display:none; gap:0.35rem; background:var(--bg-card); padding:0.25rem; border-radius:8px; border:1px solid var(--border-color); width:fit-content;">
                    <button type="button" id="inv-drawer-tab-clients" class="btn btn-sm btn-primary" style="padding:0.25rem 0.75rem; font-size:0.78rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                        Clients
                    </button>
                    <button type="button" id="inv-drawer-tab-customers" class="btn btn-sm btn-secondary" style="padding:0.25rem 0.75rem; font-size:0.78rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Customers
                    </button>
                </div>

                <!-- Search Input -->
                <div style="position:relative;">
                    <svg style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); pointer-events:none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" id="inv-drawer-search-input" class="form-control" placeholder="Search by name, phone, email, address..." style="width:100%; padding:0.6rem 2.2rem 0.6rem 2.4rem; font-size:0.88rem; border-radius:8px;" autocomplete="off">
                    <button type="button" id="inv-drawer-search-clear" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; display:none;">✕</button>
                </div>

                <!-- Primary Business rule banner (shown when in Find Business mode) -->
                <div id="inv-drawer-primary-note" style="display:none; font-size:0.75rem; color:var(--text-secondary); background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.18); border-radius:6px; padding:0.35rem 0.65rem; align-items:center; gap:5px;">
                    <span style="font-size:0.85rem;">⭐</span>
                    <span><strong>Primary Business:</strong> Only one business can be primary at a time. The primary business is automatically preselected for all new invoices.</span>
                </div>
            </div>

            <!-- DRAWER LIST CONTAINER (Shows all items with round logo, name, number, email) -->
            <div class="app-drawer-body" id="inv-drawer-list" style="padding:1.25rem 1.4rem; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:0.75rem;">
                <!-- Dynamically populated -->
            </div>
        </div>

        <!-- ================= UNIVERSAL QUICK ADD MODAL (Business / Client / Customer) ================= -->
        <div id="quick-add-entity-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.55); z-index:1050; align-items:center; justify-content:center; backdrop-filter: blur(4px);">
            <div class="card" style="background:var(--bg-card); width:94%; max-width:540px; max-height: 90vh; overflow-y: auto; padding:1.75rem; border-radius:14px; box-shadow:var(--shadow-lg); animation:fadeIn 0.2s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                    <h3 id="quick-add-modal-title" style="margin:0; font-size:1.2rem; color:var(--text-primary); font-weight:800;">Add Entry</h3>
                    <button type="button" id="btn-close-quick-add" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted); line-height:1;">&times;</button>
                </div>
                <form id="quick-add-form" style="display:flex; flex-direction:column; gap:1rem;">
                    
                    <!-- Avatar Upload / URL with Live Round Preview & Drag-Drop -->
                    <div id="qa-avatar-dropzone" style="display:flex; align-items:center; gap:1rem; background:var(--surface-50); padding:0.85rem; border-radius:10px; border:1.5px dashed var(--border-color); cursor:pointer; transition:all 0.2s ease;" title="Click or Drag & Drop photo here">
                        <div id="qa-avatar-preview" style="width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg, #e11d48, #be123c); display:flex; align-items:center; justify-content:center; color:white; font-size:1.5rem; font-weight:700; flex-shrink:0; overflow:hidden; border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.1); pointer-events:none;">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:0.8rem; font-weight:600; margin-bottom:0.25rem; display:block; color:var(--text-primary);">Photo / Avatar (Drag & Drop or Browse)</label>
                            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                                <label class="btn btn-sm btn-secondary" style="cursor:pointer; font-size:0.75rem; padding:0.25rem 0.6rem; display:inline-flex; align-items:center; gap:4px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    Upload Photo
                                    <input type="file" id="qa-photo-file" accept="image/*" style="display:none;">
                                </label>
                                <input type="url" id="qa-photo-url" class="form-control" placeholder="Or paste image URL" style="font-size:0.75rem; padding:0.25rem 0.5rem; flex:1; min-width:140px; height:28px;">
                            </div>
                        </div>
                    </div>

                    <!-- All Fields -->
                    <div>
                        <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Full Name / Business Name <span style="color:var(--danger);">*</span></label>
                        <input type="text" id="qa-name" required class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. Acme Innovations or John Doe">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Phone Number</label>
                            <input type="text" id="qa-phone" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. +123456789">
                        </div>
                        <div>
                            <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Email Address</label>
                            <input type="email" id="qa-email" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. contact@example.com">
                        </div>
                    </div>

                    <div>
                        <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Full Address</label>
                        <input type="text" id="qa-address" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. 123 Main St, Suite 400, New York, NY">
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Status</label>
                            <select id="qa-status" class="form-control" style="width:100%; padding:0.55rem;">
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Tags</label>
                            <input type="text" id="qa-tags" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. VIP, Wholesale, Retail">
                        </div>
                    </div>

                    <div>
                        <label style="font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; display:block;">Notes / Payment Terms</label>
                        <textarea id="qa-notes" class="form-control" style="width:100%; padding:0.55rem; min-height:55px;" placeholder="Optional details..."></textarea>
                    </div>

                    <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:0.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                        <button type="button" id="btn-cancel-quick-add" class="btn btn-secondary">Cancel</button>
                        <button type="submit" id="btn-save-quick-add" class="btn btn-primary" style="background:#e11d48; border-color:#e11d48;">Save & Select</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ================= SCANNER MODAL (Camera + Handheld Barcode Scanner) ================= -->
        <div id="inv-scanner-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.7); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center; padding:1rem;">
            <div class="card" style="background:#ffffff; width:100%; max-width:520px; border-radius:16px; border:1px solid var(--border-color); box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); overflow:hidden;">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem 1.25rem; border-bottom:1px solid var(--border-color); background:var(--surface-50);">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="width:32px; height:32px; border-radius:8px; background:var(--theme-subtle, rgba(225,29,72,0.1)); color:var(--theme-primary, #e11d48); display:flex; align-items:center; justify-content:center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#0f172a;">Barcode & QR Scanner</h3>
                            <p style="margin:0; font-size:0.75rem; color:#64748b;">Scan with camera or handheld laser scanner</p>
                        </div>
                    </div>
                    <button type="button" id="inv-scanner-close-btn" style="background:none; border:none; color:#64748b; font-size:1.5rem; cursor:pointer; line-height:1;">&times;</button>
                </div>

                <div style="padding:1.25rem;">
                    <!-- Camera Video Stream Area with Viewfinder Overlay -->
                    <div style="position:relative; width:100%; height:230px; background:#0f172a; border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                        <video id="inv-scanner-video" playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
                        <div id="inv-scanner-reticle" style="position:absolute; width:180px; height:120px; border:2px dashed var(--theme-primary, #e11d48); border-radius:10px; pointer-events:none; box-shadow:0 0 0 9999px rgba(0,0,0,0.35);">
                            <div style="position:absolute; top:50%; left:0; width:100%; height:2px; background:var(--theme-primary, #e11d48); opacity:0.8; transform:translateY(-50%);"></div>
                        </div>
                        <div id="inv-scanner-cam-status" style="position:absolute; bottom:8px; left:8px; right:8px; text-align:center; font-size:0.75rem; color:#ffffff; background:rgba(0,0,0,0.65); padding:4px 8px; border-radius:6px;">
                            Camera stream active &bull; Position barcode in box
                        </div>
                    </div>

                    <!-- Handheld Scanner / Manual Barcode Input -->
                    <div style="margin-top:1rem;">
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#0f172a; margin-bottom:0.35rem;">
                            Handheld Scanner / Manual UPC Barcode
                        </label>
                        <div style="display:flex; gap:0.5rem;">
                            <div style="position:relative; flex:1;">
                                <input type="text" id="inv-scanner-input" class="form-control" placeholder="Scan barcode or type UPC..." style="width:100%; padding:0.6rem 0.75rem; font-family:monospace; font-weight:700; font-size:0.95rem;">
                            </div>
                            <button type="button" id="inv-scanner-add-btn" class="btn" style="background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; font-weight:700; padding:0.6rem 1rem; border-radius:8px;">
                                Insert
                            </button>
                        </div>
                    </div>

                    <!-- Last Scanned Feedback Box -->
                    <div id="inv-scanner-feedback" style="display:none; margin-top:0.75rem; padding:0.65rem 0.85rem; border-radius:8px; font-size:0.82rem; font-weight:600;">
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1.25rem; background:var(--surface-50); border-top:1px solid var(--border-color);">
                    <button type="button" id="inv-scanner-toggle-cam-btn" class="btn btn-sm btn-secondary" style="font-size:0.8rem;">
                        Toggle Camera
                    </button>
                    <button type="button" id="inv-scanner-done-btn" class="btn btn-sm" style="background:#ffffff; color:#0f172a; border:1.5px solid #cbd5e1; font-weight:700; padding:0.4rem 1rem; border-radius:8px;">
                        Done Scanning
                    </button>
                </div>
            </div>
        </div>
    `;

    // References
    const listView = container.querySelector('#invoice-list-view');
    const editorView = container.querySelector('#invoice-editor-view');
    const tbody = container.querySelector('#invoices-table-body');
    const btnSubmit = container.querySelector('#inv-submit-btn');
    const formTitle = container.querySelector('#inv-form-title');
    const btnBackToList = container.querySelector('#btn-back-to-list');
    const btnCancel = container.querySelector('#inv-cancel-btn');

    // Quick Add Modal References
    const quickAddModal = container.querySelector('#quick-add-entity-modal');
    const quickAddTitle = container.querySelector('#quick-add-modal-title');
    const quickAddForm = container.querySelector('#quick-add-form');
    const btnCloseQuickAdd = container.querySelector('#btn-close-quick-add');
    const btnCancelQuickAdd = container.querySelector('#btn-cancel-quick-add');
    const qaPhotoFileInput = container.querySelector('#qa-photo-file');
    const qaPhotoUrlInput = container.querySelector('#qa-photo-url');
    const qaAvatarPreview = container.querySelector('#qa-avatar-preview');

    // ADVANCED PRODUCT PICKER LOGIC
    const pickerContainer = container.querySelector('#advanced-product-picker');
    const btnTogglePicker = container.querySelector('#btn-toggle-picker');
    const pickerToggleText = container.querySelector('#picker-toggle-text');
    const pickerSearchInput = container.querySelector('#picker-search-input');
    const pickerCategoryPills = container.querySelector('#picker-category-pills');
    const pickerGridContainer = container.querySelector('#picker-grid-container');
    const pickerCountDisp = container.querySelector('#picker-count-disp');
    const pickerUnitsDisp = container.querySelector('#picker-units-disp');
    const pickerSubtotalDisp = container.querySelector('#picker-subtotal-disp');
    const pickerCloseBtn = container.querySelector('#picker-close-btn');
    const pickerAddToInvBtn = container.querySelector('#picker-add-to-inv-btn');
    const pickerBtnSelectAll = container.querySelector('#picker-btn-select-all');
    const pickerBtnClearSel = container.querySelector('#picker-btn-clear-sel');

    // Helper: Category Name & ID Resolution
    function getCategoryName(catVal) {
        if (!catVal) return '';
        const found = allCategories.find(c => c.uniqueId === catVal || c.id === catVal || c.name === catVal);
        if (found && found.name) return found.name;
        if (/^[A-Za-z0-9_-]{7,}$/.test(catVal)) {
            return 'Other';
        }
        return catVal;
    }

    function getCategoryUniqueId(catVal) {
        if (!catVal) return '';
        const found = allCategories.find(c => c.uniqueId === catVal || c.id === catVal || c.name === catVal);
        return found ? (found.uniqueId || found.id || found.name) : catVal;
    }

    // Helper: Generate Random Invoice ID
    function generateRandomInvoiceId(isBus = false) {
        const prefix = isBus ? 'BUS' : 'INV';
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-${year}${month}${day}-${rand}`;
    }

    // Helper: Safe Date Parsing
    function getInvoiceTime(inv) {
        if (!inv) return 0;
        const ts = inv.timestamp || inv.createdAt || inv.updatedTimestamp;
        if (!ts) return 0;
        if (typeof ts === 'number') return ts;
        if (typeof ts.toDate === 'function') {
            try { return ts.toDate().getTime(); } catch (e) { }
        }
        if (typeof ts.seconds === 'number') {
            return ts.seconds * 1000;
        }
        if (typeof ts === 'string') {
            const parsed = Date.parse(ts);
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    }

    function formatInvoiceDate(inv) {
        const time = getInvoiceTime(inv);
        if (!time) return 'N/A';
        return new Date(time).toLocaleDateString();
    }

    // Helper: Form Snapshot for Dirty Checking
    const getInvoiceFormSnapshot = () => {
        return JSON.stringify({
            business: container.querySelector('#inv-business')?.value || '',
            recipientMode: recipientMode,
            client: container.querySelector('#inv-client')?.value || '',
            customer: container.querySelector('#inv-customer')?.value || '',
            custName: (container.querySelector('#inv-customer-name')?.value || '').trim(),
            custPhone: (container.querySelector('#inv-customer-phone')?.value || '').trim(),
            custEmail: (container.querySelector('#inv-customer-email')?.value || '').trim(),
            custAddress: (container.querySelector('#inv-customer-address')?.value || '').trim(),
            title: (container.querySelector('#inv-title')?.value || '').trim(),
            invNumber: (container.querySelector('#inv-number-input')?.value || '').trim(),
            discount: parseFloat(container.querySelector('#inv-discount')?.value || 0),
            addCut: parseFloat(container.querySelector('#inv-add-cut')?.value || 0),
            tax: parseFloat(container.querySelector('#inv-tax')?.value || 0),
            shipping: parseFloat(container.querySelector('#inv-shipping')?.value || 0),
            status: container.querySelector('#inv-status')?.value || 'Paid',
            note: (container.querySelector('#inv-note')?.value || '').trim(),
            items: invoiceItems.map(i => ({ id: i.productId, q: Number(i.quantity) || 1, p: Number(i.unitPrice) || 0 }))
        });
    };

    let initialInvoiceFormSnapshot = null;
    let invUnsavedIndicator = null;

    const getInvoiceDraftData = () => {
        return {
            editingInvoiceId,
            recipientMode,
            businessId: container.querySelector('#inv-business')?.value || '',
            customerId: container.querySelector('#inv-customer')?.value || '',
            clientId: container.querySelector('#inv-client')?.value || '',
            customerName: container.querySelector('#inv-customer-name')?.value || '',
            customerPhone: container.querySelector('#inv-customer-phone')?.value || '',
            customerEmail: container.querySelector('#inv-customer-email')?.value || '',
            customerAddress: container.querySelector('#inv-customer-address')?.value || '',
            title: container.querySelector('#inv-title')?.value || '',
            invNumber: container.querySelector('#inv-number-input')?.value || '',
            discount: container.querySelector('#inv-discount')?.value || '0',
            addCut: container.querySelector('#inv-add-cut')?.value || '0',
            tax: container.querySelector('#inv-tax')?.value || '0',
            shipping: container.querySelector('#inv-shipping')?.value || '0',
            status: container.querySelector('#inv-status')?.value || 'Paid',
            note: container.querySelector('#inv-note')?.value || '',
            items: invoiceItems
        };
    };

    const restoreInvoiceDraftIfAny = (draftKey) => {
        const draft = draftManager.getDraft(draftKey);
        if (!draft) return false;
        try {
            const data = typeof draft === 'string' ? JSON.parse(draft) : draft;
            if (data.businessId && container.querySelector('#inv-business')) container.querySelector('#inv-business').value = data.businessId;
            if (data.recipientMode) setRecipientMode(data.recipientMode);
            if (data.customerId && container.querySelector('#inv-customer')) container.querySelector('#inv-customer').value = data.customerId;
            if (data.clientId && container.querySelector('#inv-client')) container.querySelector('#inv-client').value = data.clientId;
            if (data.customerName !== undefined && container.querySelector('#inv-customer-name')) container.querySelector('#inv-customer-name').value = data.customerName;
            if (data.customerPhone !== undefined && container.querySelector('#inv-customer-phone')) container.querySelector('#inv-customer-phone').value = data.customerPhone;
            if (data.customerEmail !== undefined && container.querySelector('#inv-customer-email')) container.querySelector('#inv-customer-email').value = data.customerEmail;
            if (data.customerAddress !== undefined && container.querySelector('#inv-customer-address')) container.querySelector('#inv-customer-address').value = data.customerAddress;
            if (data.title !== undefined && container.querySelector('#inv-title')) container.querySelector('#inv-title').value = data.title;
            if (data.invNumber !== undefined && container.querySelector('#inv-number-input')) container.querySelector('#inv-number-input').value = data.invNumber;
            if (data.discount !== undefined && container.querySelector('#inv-discount')) container.querySelector('#inv-discount').value = data.discount;
            if (data.addCut !== undefined && container.querySelector('#inv-add-cut')) container.querySelector('#inv-add-cut').value = data.addCut;
            if (data.tax !== undefined && container.querySelector('#inv-tax')) container.querySelector('#inv-tax').value = data.tax;
            if (data.shipping !== undefined && container.querySelector('#inv-shipping')) container.querySelector('#inv-shipping').value = data.shipping;
            if (data.status !== undefined && container.querySelector('#inv-status')) container.querySelector('#inv-status').value = data.status;
            if (data.note !== undefined && container.querySelector('#inv-note')) container.querySelector('#inv-note').value = data.note;
            if (Array.isArray(data.items)) {
                invoiceItems = data.items;
            }
            updateBusinessPreview();
            updateRecipientPreview();
            renderItemsList();
            updateLiveTotals();
            return true;
        } catch (e) {
            console.warn("Error restoring invoice draft:", e);
            return false;
        }
    };

    const isInvoiceFormDirty = () => {
        if (!editorView || !document.body.contains(editorView) || editorView.style.display === 'none') return false;

        if (editingInvoiceId) {
            if (!initialInvoiceFormSnapshot) return false;
            return getInvoiceFormSnapshot() !== initialInvoiceFormSnapshot;
        } else {
            const hasItems = invoiceItems.length > 0;
            const hasCustName = Boolean(container.querySelector('#inv-customer-name')?.value?.trim());
            const hasNote = Boolean(container.querySelector('#inv-note')?.value?.trim());
            const hasDiscount = parseFloat(container.querySelector('#inv-discount')?.value || 0) > 0;
            const hasAddCut = parseFloat(container.querySelector('#inv-add-cut')?.value || 0) > 0;
            const hasShipping = parseFloat(container.querySelector('#inv-shipping')?.value || 0) > 0;
            const hasTax = parseFloat(container.querySelector('#inv-tax')?.value || 0) > 0;
            return hasItems || hasCustName || hasNote || hasDiscount || hasAddCut || hasShipping || hasTax;
        }
    };

    const updateInvoiceSubmitState = () => {
        if (!btnSubmit) return;
        const hasItems = invoiceItems.length > 0;
        const busSelected = Boolean(container.querySelector('#inv-business')?.value);
        const hasTitle = Boolean((container.querySelector('#inv-title')?.value || '').trim());
        const hasInvNum = Boolean((container.querySelector('#inv-number-input')?.value || '').trim());

        let recipientValid = false;
        if (recipientMode === 'customer') {
            recipientValid = Boolean(container.querySelector('#inv-customer')?.value || (container.querySelector('#inv-customer-name')?.value || '').trim());
        } else if (recipientMode === 'client') {
            recipientValid = Boolean(container.querySelector('#inv-client')?.value || (container.querySelector('#inv-customer-name')?.value || '').trim());
        } else {
            recipientValid = Boolean((container.querySelector('#inv-customer-name')?.value || '').trim());
        }

        const validRequired = hasItems && busSelected && hasTitle && hasInvNum && recipientValid;

        if (!validRequired) {
            btnSubmit.disabled = true;
        } else if (editingInvoiceId) {
            btnSubmit.disabled = !isInvoiceFormDirty();
        } else {
            btnSubmit.disabled = false;
        }

        const isDirty = isInvoiceFormDirty();
        if (invUnsavedIndicator) {
            invUnsavedIndicator.update(isDirty);
        }

        const draftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + (editingInvoiceId || 'new');
        if (isDirty) {
            draftManager.saveDraft(draftKey, getInvoiceDraftData());
            draftManager.registerActiveForm('invoice_editor', isInvoiceFormDirty);
        } else {
            draftManager.clearDraft(draftKey);
            draftManager.unregisterActiveForm('invoice_editor');
        }
    };

    if (editorView) {
        editorView._isDirty = isInvoiceFormDirty;
    }

    // Switch View Helper
    const showEditorView = (isEdit = false, invoice = null) => {
        if (listView) listView.style.display = 'none';
        if (editorView) editorView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const titleRow = container.querySelector('#inv-form-title')?.parentElement;
        if (titleRow && !invUnsavedIndicator) {
            invUnsavedIndicator = draftManager.mountUnsavedIndicator(titleRow, {
                formType: typeLabel,
                onSave: () => {
                    const submitBtn = container.querySelector('#btn-submit-invoice');
                    if (submitBtn && !submitBtn.disabled) {
                        submitBtn.click();
                    } else {
                        showAlert.info("Please fill all required invoice fields (*) and add at least 1 product.");
                    }
                }
            });
        }

        if (isEdit && invoice) {
            editingInvoiceId = invoice.id;
            editingInvoiceUniqueId = invoice.uniqueId || generateUniqueId();
            const displayInvNum = invoice.invoiceNumber || invoice.busInvNumber || invoice.uniqueId;
            if (formTitle) formTitle.textContent = `Edit ${typeLabel} (${displayInvNum})`;
            if (btnSubmit) btnSubmit.textContent = 'Update Invoice';
            populateFormForEdit(invoice);
            initialInvoiceFormSnapshot = getInvoiceFormSnapshot();

            const editDraftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + invoice.id;
            restoreInvoiceDraftIfAny(editDraftKey);

            updateInvoiceSubmitState();
        } else {
            editingInvoiceId = null;
            editingInvoiceUniqueId = generateUniqueId();
            if (formTitle) formTitle.textContent = `New ${typeLabel}`;
            if (btnSubmit) btnSubmit.textContent = 'Save Invoice';
            resetForm();
            initialInvoiceFormSnapshot = getInvoiceFormSnapshot();

            const newDraftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + 'new';
            const restored = restoreInvoiceDraftIfAny(newDraftKey);
            if (restored) {
                showAlert.info("Restored progressive unsaved invoice draft.");
            }

            updateInvoiceSubmitState();
        }
    };

    const showListView = () => {
        if (editorView) editorView.style.display = 'none';
        if (listView) listView.style.display = 'block';

        const draftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + (editingInvoiceId || 'new');
        draftManager.unregisterActiveForm('invoice_editor');
        if (invUnsavedIndicator) invUnsavedIndicator.update(false);

        editingInvoiceId = null;
        editingInvoiceUniqueId = null;
        initialInvoiceFormSnapshot = null;
    };

    const handleCloseEditor = async () => {
        if (isInvoiceFormDirty()) {
            const allowLeave = await showAlert.confirmUnsavedChanges();
            if (!allowLeave) return;
        }
        const draftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + (editingInvoiceId || 'new');
        draftManager.clearDraft(draftKey);
        showListView();
    };

    if (btnBackToList) btnBackToList.addEventListener('click', handleCloseEditor);
    if (btnCancel) btnCancel.addEventListener('click', handleCloseEditor);

    // Business Profile Preview Card Builder (Round Avatar / SVG + details)
    const updateBusinessPreview = () => {
        const busSelect = container.querySelector('#inv-business');
        const previewEl = container.querySelector('#inv-business-preview-card');
        if (!previewEl || !busSelect) return;

        const b = allBusinesses.find(x => x.id === busSelect.value);
        const searchBusInput = container.querySelector('#search-inv-business');
        if (searchBusInput && b) searchBusInput.value = b.name || '';

        if (b) {
            previewEl.style.display = 'block';
            const imgUrl = b.imageUrl || b.imageUri;
            const avatarHtml = imgUrl
                ? `<img src="${imgUrl}" alt="${escapeHtml(b.name)}" style="width:48px; height:48px; border-radius:10px; object-fit:cover; border:2px solid var(--primary, #2563eb); box-shadow:0 2px 6px rgba(0,0,0,0.08); flex-shrink:0;">`
                : `<div style="width:48px; height:48px; border-radius:10px; background:rgba(37,99,235,0.1); color:var(--primary, #2563eb); display:flex; align-items:center; justify-content:center; font-size:1.25rem; font-weight:700; border:1px solid rgba(37,99,235,0.25); flex-shrink:0;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 10h.01M6 14h.01M6 18h.01M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 10h.01M18 14h.01M18 18h.01M6 3h12v4H6z"/></svg>
                   </div>`;

            previewEl.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:0.9rem; flex:1; min-width:240px;">
                        ${avatarHtml}
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.98rem; color:var(--text-primary); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span>${escapeHtml(b.name)}</span>
                                <span style="font-size:0.7rem; background:rgba(37,99,235,0.1); color:var(--primary, #2563eb); padding:1px 6px; border-radius:4px; font-weight:700;">Issuer</span>
                                ${b.isPrimary ? `<span style="font-size:0.7rem; background:rgba(37,99,235,0.12); color:#2563eb; border:1px solid rgba(37,99,235,0.3); padding:1px 7px; border-radius:9999px; font-weight:700;">⭐ Primary Business (Default)</span>` : ''}
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px; display:flex; flex-wrap:wrap; gap:0.65rem;">
                                ${b.phone ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${escapeHtml(b.phone)}</span>` : ''}
                                ${b.email ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>${escapeHtml(b.email)}</span>` : ''}
                                ${b.address ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(b.address)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <button type="button" id="btn-change-inv-business" class="btn btn-sm btn-secondary" style="font-size:0.78rem; font-weight:700; padding:0.35rem 0.75rem; display:inline-flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                            Change Business
                        </button>
                        <button type="button" id="btn-clear-inv-business" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:0.35rem 0.6rem; color:var(--text-muted);" title="Clear selection">✕</button>
                    </div>
                </div>
            `;

            previewEl.querySelector('#btn-change-inv-business')?.addEventListener('click', () => {
                openEntityDrawer('business');
            });
            previewEl.querySelector('#btn-clear-inv-business')?.addEventListener('click', () => {
                busSelect.value = '';
                if (searchBusInput) searchBusInput.value = '';
                updateBusinessPreview();
            });
        } else {
            previewEl.style.display = 'none';
            previewEl.innerHTML = '';
        }
        updateInvoiceSubmitState();
    };

    // Recipient Profile Preview Card Builder
    const updateRecipientPreview = () => {
        const previewEl = container.querySelector('#inv-recipient-preview-card');
        if (!previewEl) return;

        let profile = null;
        let profileTypeLabel = 'Recipient';

        if (recipientMode === 'customer') {
            const custSelect = container.querySelector('#inv-customer');
            profile = allCustomers.find(x => x.id === custSelect?.value);
            profileTypeLabel = 'Customer Profile';
        } else if (recipientMode === 'client') {
            const cliSelect = container.querySelector('#inv-client');
            profile = allClients.find(x => x.id === cliSelect?.value);
            profileTypeLabel = 'Client Business';
        }

        if (profile) {
            const searchCustInput = container.querySelector('#search-inv-customer');
            const searchCliInput = container.querySelector('#search-inv-client');
            if (recipientMode === 'customer' && searchCustInput) searchCustInput.value = profile.name || '';
            if (recipientMode === 'client' && searchCliInput) searchCliInput.value = profile.name || '';

            previewEl.style.display = 'block';
            const imgUrl = profile.imageUrl || profile.imageUri;
            const avatarHtml = imgUrl
                ? `<img src="${imgUrl}" alt="${escapeHtml(profile.name)}" style="width:46px; height:46px; border-radius:10px; object-fit:cover; border:2px solid var(--primary, #2563eb); box-shadow:0 2px 6px rgba(0,0,0,0.08); flex-shrink:0;">`
                : `<div style="width:46px; height:46px; border-radius:10px; background:rgba(37,99,235,0.08); color:var(--primary, #2563eb); display:flex; align-items:center; justify-content:center; font-size:1.15rem; font-weight:700; border:1px solid rgba(37,99,235,0.2); flex-shrink:0;">
                    ${recipientMode === 'client'
                    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`
                    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
                }
                   </div>`;

            // Auto-fill hidden/manual fields
            const nameEl = container.querySelector('#inv-customer-name');
            const phoneEl = container.querySelector('#inv-customer-phone');
            const emailEl = container.querySelector('#inv-customer-email');
            const addrEl = container.querySelector('#inv-customer-address');

            if (nameEl) nameEl.value = profile.name || '';
            if (phoneEl) phoneEl.value = profile.phone || '';
            if (emailEl) emailEl.value = profile.email || '';
            if (addrEl) addrEl.value = profile.address || '';

            previewEl.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:0.9rem; flex:1; min-width:240px;">
                        ${avatarHtml}
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <span>${escapeHtml(profile.name)}</span>
                                <span style="font-size:0.7rem; background:rgba(37,99,235,0.1); color:#2563eb; padding:1px 6px; border-radius:4px; font-weight:700;">${profileTypeLabel}</span>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px; display:flex; flex-wrap:wrap; gap:0.65rem;">
                                ${profile.phone ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>${escapeHtml(profile.phone)}</span>` : ''}
                                ${profile.email ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>${escapeHtml(profile.email)}</span>` : ''}
                                ${profile.address ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${escapeHtml(profile.address)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <button type="button" id="btn-change-inv-recipient" class="btn btn-sm btn-secondary" style="font-size:0.78rem; font-weight:700; padding:0.35rem 0.75rem; display:inline-flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                            Change Recipient
                        </button>
                        <button type="button" id="btn-clear-inv-recipient" class="btn btn-sm btn-outline" style="font-size:0.75rem; padding:0.35rem 0.6rem; color:var(--text-muted);" title="Clear selection">✕</button>
                    </div>
                </div>
            `;

            previewEl.querySelector('#btn-change-inv-recipient')?.addEventListener('click', () => {
                openEntityDrawer(recipientMode === 'client' ? 'client' : 'customer');
            });
            previewEl.querySelector('#btn-clear-inv-recipient')?.addEventListener('click', () => {
                if (recipientMode === 'customer') {
                    const custSelect = container.querySelector('#inv-customer');
                    if (custSelect) custSelect.value = '';
                    if (searchCustInput) searchCustInput.value = '';
                } else if (recipientMode === 'client') {
                    const cliSelect = container.querySelector('#inv-client');
                    if (cliSelect) cliSelect.value = '';
                    if (searchCliInput) searchCliInput.value = '';
                }
                if (nameEl) nameEl.value = '';
                if (phoneEl) phoneEl.value = '';
                if (emailEl) emailEl.value = '';
                if (addrEl) addrEl.value = '';
                updateRecipientPreview();
            });
        } else {
            previewEl.style.display = 'none';
            previewEl.innerHTML = '';
        }
        updateInvoiceSubmitState();
    };

    // Mode switch handler
    const setRecipientMode = (mode) => {
        recipientMode = mode;
        const pills = container.querySelectorAll('#recipient-type-pills button');
        pills.forEach(b => {
            if (b.getAttribute('data-mode') === mode) {
                b.className = 'btn btn-sm btn-primary';
                b.style.background = '#e11d48';
                b.style.borderColor = '#e11d48';
            } else {
                b.className = 'btn btn-sm btn-secondary';
                b.style.background = '';
                b.style.borderColor = '';
            }
        });

        const wrapCust = container.querySelector('#wrap-recipient-customer');
        const wrapCli = container.querySelector('#wrap-recipient-client');
        const wrapMan = container.querySelector('#wrap-recipient-manual');

        if (wrapCust) wrapCust.style.display = mode === 'customer' ? 'block' : 'none';
        if (wrapCli) wrapCli.style.display = mode === 'client' ? 'block' : 'none';
        if (wrapMan) wrapMan.style.display = mode === 'walkin' ? 'block' : 'none';

        const browseLabel = container.querySelector('#btn-browse-recipient-label');
        if (browseLabel) {
            browseLabel.textContent = 'Browse Client';
        }

        if (mode === 'walkin') {
            const previewEl = container.querySelector('#inv-recipient-preview-card');
            if (previewEl) previewEl.style.display = 'none';
        } else {
            updateRecipientPreview();
        }
        updateInvoiceSubmitState();
    };

    // Populate Form for Editing
    const populateFormForEdit = (inv) => {
        // Business Issuer
        const busSelect = container.querySelector('#inv-business');
        if (busSelect) {
            const matchedBus = allBusinesses.find(b => (b.uniqueId && b.uniqueId === inv.businessId) || b.id === inv.businessId || b.name === inv.businessName);
            if (matchedBus) {
                busSelect.value = matchedBus.id;
            } else if (inv.businessId) {
                busSelect.value = inv.businessId;
            }
            updateBusinessPreview();
        }

        // Recipient resolution
        const matchedCust = allCustomers.find(c => (c.uniqueId && c.uniqueId === inv.customerId) || c.id === inv.customerId || (inv.customerName && c.name === inv.customerName));
        const matchedCli = allClients.find(c => (c.uniqueId && c.uniqueId === inv.clientId) || c.id === inv.clientId || (inv.customerName && c.name === inv.customerName));

        if (inv.clientId && matchedCli) {
            setRecipientMode('client');
            const cliSelect = container.querySelector('#inv-client');
            if (cliSelect) cliSelect.value = matchedCli.id;
        } else if (inv.customerId && matchedCust) {
            setRecipientMode('customer');
            const custSelect = container.querySelector('#inv-customer');
            if (custSelect) custSelect.value = matchedCust.id;
        } else if (matchedCust) {
            setRecipientMode('customer');
            const custSelect = container.querySelector('#inv-customer');
            if (custSelect) custSelect.value = matchedCust.id;
        } else if (matchedCli) {
            setRecipientMode('client');
            const cliSelect = container.querySelector('#inv-client');
            if (cliSelect) cliSelect.value = matchedCli.id;
        } else {
            setRecipientMode('walkin');
        }

        const nameEl = container.querySelector('#inv-customer-name');
        if (nameEl) nameEl.value = inv.customerName || '';

        const phoneEl = container.querySelector('#inv-customer-phone');
        if (phoneEl) phoneEl.value = inv.customerNumber || inv.clientPhone || '';

        const emailEl = container.querySelector('#inv-customer-email');
        if (emailEl) emailEl.value = inv.clientEmail || '';

        const addrEl = container.querySelector('#inv-customer-address');
        if (addrEl) addrEl.value = inv.clientAddress || '';

        updateRecipientPreview();

        // Invoice Meta
        const titleEl = container.querySelector('#inv-title');
        if (titleEl) titleEl.value = inv.title || 'Invoice';

        const invNumInput = container.querySelector('#inv-number-input');
        if (invNumInput) invNumInput.value = inv.invoiceNumber || inv.busInvNumber || `INV-${inv.timestamp || Date.now()}`;

        // Line Items
        invoiceItems = (inv.items || []).map(item => ({
            productId: item.productId,
            productName: item.productName,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            unitCost: Number(item.unitCost) || 0,
            totalPrice: Number(item.totalPrice) || ((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)),
            itemProfit: Number(item.itemProfit) || 0,
            sizeWeight: item.sizeWeight || ''
        }));

        // Adjustments (All 4 supported across both types)
        if (container.querySelector('#inv-discount')) container.querySelector('#inv-discount').value = inv.discountPercent || 0;
        if (container.querySelector('#inv-add-cut')) {
            const rawCut = inv.additionalCut !== undefined ? Number(inv.additionalCut) : 0;
            const signBtn = container.querySelector('#inv-add-cut-sign-btn');
            if (inv.cutSign === '+' || rawCut > 0) {
                if (signBtn) {
                    signBtn.textContent = '+';
                    signBtn.setAttribute('data-sign', '+');
                    signBtn.style.color = '#059669';
                    signBtn.style.borderColor = '#059669';
                }
                container.querySelector('#inv-add-cut').value = Math.abs(rawCut);
            } else {
                if (signBtn) {
                    signBtn.textContent = '-';
                    signBtn.setAttribute('data-sign', '-');
                    signBtn.style.color = '#e11d48';
                    signBtn.style.borderColor = '#e11d48';
                }
                container.querySelector('#inv-add-cut').value = Math.abs(rawCut);
            }
        }
        if (container.querySelector('#inv-tax')) container.querySelector('#inv-tax').value = inv.taxPercent || 0;
        if (container.querySelector('#inv-shipping')) container.querySelector('#inv-shipping').value = inv.shippingCost || 0;

        // Status & Note
        const statusEl = container.querySelector('#inv-status');
        if (statusEl) {
            const rawStatus = (inv.status || 'Paid').trim();
            if (rawStatus.toUpperCase() === 'PAID') statusEl.value = 'Paid';
            else if (rawStatus.toUpperCase() === 'UNPAID') statusEl.value = 'Unpaid';
            else statusEl.value = 'Draft';
        }

        const noteEl = container.querySelector('#inv-note');
        if (noteEl) noteEl.value = inv.note || '';

        renderItemsList();
        updateLiveTotals();
    };

    // Reset Form for Creation
    const resetForm = () => {
        container.querySelector('#invoice-form').reset();
        invoiceItems = [];
        pickerSelections = {};
        pickerContainer.style.display = 'none';
        if (pickerToggleText) pickerToggleText.textContent = 'Open Advanced Product Picker';

        const signBtn = container.querySelector('#inv-add-cut-sign-btn');
        if (signBtn) {
            signBtn.textContent = '-';
            signBtn.setAttribute('data-sign', '-');
            signBtn.style.color = '#e11d48';
            signBtn.style.borderColor = '#e11d48';
        }
        const searchBusInput = container.querySelector('#search-inv-business');
        const searchCustInput = container.querySelector('#search-inv-customer');
        const searchCliInput = container.querySelector('#search-inv-client');
        if (searchBusInput) searchBusInput.value = '';
        if (searchCustInput) searchCustInput.value = '';
        if (searchCliInput) searchCliInput.value = '';

        // Default Business Selection:
        // Automatically preselect designated Primary Business for new invoices
        const primaryBus = allBusinesses.find(b => b.isPrimary === true) || (allBusinesses.length > 0 ? allBusinesses[0] : null);
        const busSelect = container.querySelector('#inv-business');
        if (busSelect && primaryBus) {
            busSelect.value = primaryBus.id;
            if (searchBusInput) searchBusInput.value = primaryBus.name || '';
        }

        setRecipientMode(isBusinessInvoice ? 'client' : 'customer');

        const invNumInput = container.querySelector('#inv-number-input');
        if (invNumInput) invNumInput.value = generateRandomInvoiceId(isBusinessInvoice);

        const titleEl = container.querySelector('#inv-title');
        if (titleEl) titleEl.value = 'Invoice';

        const statusEl = container.querySelector('#inv-status');
        if (statusEl) statusEl.value = 'Paid';

        updateBusinessPreview();
        updateRecipientPreview();
        renderItemsList();
        updateLiveTotals();
    };

    const getVisibleProducts = () => {
        return allProducts.filter(p => {
            if (pickerCategoryFilter !== 'ALL') {
                const prodCatUniqueId = getCategoryUniqueId(p.category);
                if (prodCatUniqueId !== pickerCategoryFilter && p.category !== pickerCategoryFilter) {
                    return false;
                }
            }
            if (pickerSearchQuery) {
                const q = pickerSearchQuery.toLowerCase();
                const name = (p.name || '').toLowerCase();
                const catName = getCategoryName(p.category).toLowerCase();
                const catRaw = (p.category || '').toLowerCase();
                const upc = (p.upcCode || '').toLowerCase();
                const size = (p.sizeWeight || '').toLowerCase();
                return name.includes(q) || catName.includes(q) || catRaw.includes(q) || upc.includes(q) || size.includes(q);
            }
            return true;
        });
    };

    const updatePickerSummary = () => {
        let totalCount = 0;
        let totalUnits = 0;
        let totalCost = 0;

        Object.entries(pickerSelections).forEach(([id, qty]) => {
            const p = allProducts.find(x => x.id === id);
            if (p && qty > 0) {
                totalCount += 1;
                totalUnits += qty;
                totalCost += (Number(p.salePrice || 0) * qty);
            }
        });

        if (pickerCountDisp) pickerCountDisp.textContent = totalCount;
        if (pickerUnitsDisp) pickerUnitsDisp.textContent = totalUnits;
        if (pickerSubtotalDisp) pickerSubtotalDisp.textContent = formatCurrency(totalCost);

        const visible = getVisibleProducts();
        const selectableVisible = isVendingActive ? visible.filter(p => Number(p.quantity || 0) > 0) : visible;
        const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(p => pickerSelections[p.id] !== undefined);

        if (pickerBtnSelectAll) {
            if (selectableVisible.length === 0) {
                pickerBtnSelectAll.textContent = 'Select All Visible';
                pickerBtnSelectAll.disabled = true;
            } else {
                pickerBtnSelectAll.disabled = false;
                pickerBtnSelectAll.textContent = allVisibleSelected
                    ? `Deselect All Visible (${selectableVisible.length})`
                    : `Select All Visible (${selectableVisible.length})`;
            }
        }
    };

    const renderPickerCategories = () => {
        if (!pickerCategoryPills) return;
        const categoryMap = new Map();

        allCategories.forEach(c => {
            const uId = c.uniqueId || c.id || c.name;
            if (uId && c.name && c.name !== 'Uncategorized') {
                categoryMap.set(uId, { uniqueId: uId, name: c.name, count: 0 });
            }
        });

        allProducts.forEach(p => {
            if (!p.category) return;
            const uId = getCategoryUniqueId(p.category);
            const name = getCategoryName(p.category);
            if (!categoryMap.has(uId)) {
                categoryMap.set(uId, { uniqueId: uId, name, count: 0 });
            }
            categoryMap.get(uId).count += 1;
        });

        const allCatsList = Array.from(categoryMap.values());
        const hasProducts = allCatsList.some(c => c.count > 0);
        const categories = (hasProducts ? allCatsList.filter(c => c.count > 0) : allCatsList)
            .sort((a, b) => a.name.localeCompare(b.name));

        pickerCategoryPills.innerHTML = `
            <button type="button" class="filter-pill ${pickerCategoryFilter === 'ALL' ? 'active' : ''}" data-cat-id="ALL" style="font-size:0.75rem; padding:0.25rem 0.75rem;">All (${allProducts.length})</button>
            ${categories.map(c => `
                <button type="button" class="filter-pill ${pickerCategoryFilter === c.uniqueId ? 'active' : ''}" data-cat-id="${c.uniqueId}" style="font-size:0.75rem; padding:0.25rem 0.75rem;">${c.name} (${c.count})</button>
            `).join('')}
        `;

        pickerCategoryPills.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                pickerCategoryPills.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                const target = e.target.closest('.filter-pill');
                target.classList.add('active');
                pickerCategoryFilter = target.getAttribute('data-cat-id');
                renderPickerGrid();
                updatePickerSummary();
            });
        });
    };

    const renderPickerGrid = () => {
        if (!pickerGridContainer) return;

        const filtered = getVisibleProducts();

        if (filtered.length === 0) {
            pickerGridContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-weight: 500; font-size: 0.95rem;">No products match your search or category filter.</div>
                </div>
            `;
            updatePickerSummary();
            return;
        }

        pickerGridContainer.innerHTML = filtered.map(p => {
            const isSelected = pickerSelections[p.id] !== undefined;
            const currentQty = pickerSelections[p.id] || 1;
            const stockQty = Number(p.quantity || 0);
            const sizeLabel = p.sizeWeight || 'Standard';
            const categoryDisplayName = getCategoryName(p.category);

            const imgHtml = p.imageUri
                ? `<img src="${p.imageUri}" class="picker-img" alt="${p.name}" loading="lazy">`
                : `<div style="display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:var(--text-muted); opacity:0.35;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>`;

            return `
                <div class="picker-card ${isSelected ? 'is-selected' : ''}" data-id="${p.id}" data-stock="${stockQty}">
                    <div class="picker-card-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
                    <div class="picker-img-wrap">
                        ${imgHtml}
                    </div>
                    <div class="picker-title" title="${p.name}">${p.name}</div>
                    <div class="picker-meta">
                        <span>${sizeLabel}</span>
                        <span class="picker-stock-badge ${stockQty > 0 ? 'in-stock' : 'out-of-stock'}">
                            ${stockQty > 0 ? 'Stock: ' + stockQty : 'Out of stock'}
                        </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 0.25rem;">
                        <span class="picker-price">${formatCurrency(p.salePrice || 0)}</span>
                        ${categoryDisplayName ? `<span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">${categoryDisplayName}</span>` : ''}
                    </div>

                    ${isSelected ? `
                        <div class="picker-stepper" onclick="event.stopPropagation()">
                            <button type="button" class="stepper-btn btn-step-minus" data-id="${p.id}">&minus;</button>
                            <input type="number" class="form-control stepper-input step-val-input" data-id="${p.id}" value="${currentQty}" min="1" ${isVendingActive ? `max="${stockQty}"` : ''}>
                            <button type="button" class="stepper-btn btn-step-plus" data-id="${p.id}">&plus;</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Attach events to cards
        pickerGridContainer.querySelectorAll('.picker-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.picker-stepper')) return;
                const id = card.getAttribute('data-id');
                const stock = parseInt(card.getAttribute('data-stock'), 10) || 0;

                if (pickerSelections[id] !== undefined) {
                    delete pickerSelections[id];
                } else {
                    if (isVendingActive && stock <= 0) {
                        showAlert.warning("This product is currently out of stock in Vending Mode.");
                        return;
                    }
                    pickerSelections[id] = 1;
                }
                renderPickerGrid();
                updatePickerSummary();
            });
        });

        pickerGridContainer.querySelectorAll('.btn-step-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                if (pickerSelections[id] > 1) {
                    pickerSelections[id] -= 1;
                } else {
                    delete pickerSelections[id];
                }
                renderPickerGrid();
                updatePickerSummary();
            });
        });

        pickerGridContainer.querySelectorAll('.btn-step-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.getAttribute('data-id');
                const p = allProducts.find(x => x.id === id);
                const maxStock = Number(p?.quantity || 0);

                if (isVendingActive && (pickerSelections[id] >= maxStock)) {
                    showAlert.warning(`Stock limit reached (${maxStock} available in Vending Mode).`);
                    return;
                }

                pickerSelections[id] = (pickerSelections[id] || 1) + 1;
                renderPickerGrid();
                updatePickerSummary();
            });
        });

        pickerGridContainer.querySelectorAll('.step-val-input').forEach(input => {
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = input.getAttribute('data-id');
                const p = allProducts.find(x => x.id === id);
                let val = parseInt(input.value, 10);
                if (isNaN(val) || val < 1) val = 1;

                if (isVendingActive) {
                    const maxStock = Number(p?.quantity || 0);
                    if (val > maxStock) {
                        val = maxStock;
                        showAlert.warning(`Adjusted to maximum available stock (${maxStock}).`);
                    }
                }

                pickerSelections[id] = val;
                renderPickerGrid();
                updatePickerSummary();
            });
        });

        updatePickerSummary();
    };

    if (btnTogglePicker) {
        btnTogglePicker.addEventListener('click', async () => {
            const isHidden = pickerContainer.style.display === 'none';
            pickerContainer.style.display = isHidden ? 'block' : 'none';
            if (pickerToggleText) {
                pickerToggleText.textContent = isHidden ? 'Hide Advanced Picker' : 'Open Advanced Product Picker';
            }
            if (isHidden) {
                if (!allCategories || allCategories.length === 0) {
                    try {
                        allCategories = await categoryService.getAllCategories();
                    } catch (e) {
                        console.warn("Could not reload categories", e);
                    }
                }
                renderPickerCategories();
                renderPickerGrid();
                pickerSearchInput?.focus();
            }
        });
    }

    if (pickerCloseBtn) {
        pickerCloseBtn.addEventListener('click', () => {
            pickerContainer.style.display = 'none';
            if (pickerToggleText) pickerToggleText.textContent = 'Open Advanced Product Picker';
        });
    }

    if (pickerSearchInput) {
        pickerSearchInput.addEventListener('input', (e) => {
            pickerSearchQuery = e.target.value.trim();
            renderPickerGrid();
        });
    }

    if (pickerBtnSelectAll) {
        pickerBtnSelectAll.addEventListener('click', () => {
            const visible = getVisibleProducts();
            const selectableVisible = isVendingActive ? visible.filter(p => Number(p.quantity || 0) > 0) : visible;
            const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(p => pickerSelections[p.id] !== undefined);

            if (allVisibleSelected) {
                selectableVisible.forEach(p => {
                    delete pickerSelections[p.id];
                });
            } else {
                selectableVisible.forEach(p => {
                    if (pickerSelections[p.id] === undefined) {
                        pickerSelections[p.id] = 1;
                    }
                });
            }
            renderPickerGrid();
            updatePickerSummary();
        });
    }

    if (pickerBtnClearSel) {
        pickerBtnClearSel.addEventListener('click', () => {
            pickerSelections = {};
            renderPickerGrid();
            updatePickerSummary();
        });
    }

    if (pickerAddToInvBtn) {
        pickerAddToInvBtn.addEventListener('click', () => {
            const entries = Object.entries(pickerSelections);
            if (entries.length === 0) {
                showAlert.warning("Please select at least one product.");
                return;
            }

            let addedCount = 0;
            entries.forEach(([id, qty]) => {
                const prod = allProducts.find(p => p.id === id);
                if (prod && qty > 0) {
                    const existing = invoiceItems.find(item => item.productId === prod.id);
                    if (existing) {
                        existing.quantity += qty;
                    } else {
                        invoiceItems.push({
                            productId: prod.id,
                            productName: prod.name,
                            quantity: qty,
                            unitPrice: Number(prod.salePrice || 0),
                            unitCost: Number(prod.price || 0),
                            sizeWeight: prod.sizeWeight || ''
                        });
                    }
                    addedCount += 1;
                }
            });

            pickerSelections = {};
            pickerContainer.style.display = 'none';
            if (pickerToggleText) pickerToggleText.textContent = 'Open Advanced Product Picker';

            renderItemsList();
            updateLiveTotals();
            showAlert.success(`Added ${addedCount} products to the invoice!`);
        });
    }

    const btnRegenInvId = container.querySelector('#btn-regen-inv-id');
    if (btnRegenInvId) {
        btnRegenInvId.addEventListener('click', () => {
            const invNumField = container.querySelector('#inv-number-input');
            if (invNumField) {
                invNumField.value = generateRandomInvoiceId(isBusinessInvoice);
            }
        });
    }

    // Render items list
    const renderItemsList = () => {
        const list = container.querySelector('#invoice-items-list');
        const countBadge = container.querySelector('#summary-items-count');

        if (countBadge) {
            const totalUnits = invoiceItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            countBadge.textContent = `${invoiceItems.length} products (${totalUnits} units)`;
        }

        if (!list) return;
        if (invoiceItems.length === 0) {
            list.innerHTML = `<div style="color:var(--text-muted); font-size:0.875rem; padding:1.25rem 0; text-align:center; background:var(--surface-50); border-radius:8px; border:1px dashed var(--border-color);">No products added yet. Click above to pick products.</div>`;
        } else {
            list.innerHTML = invoiceItems.map((item, idx) => {
                const prod = allProducts.find(p => p.id === item.productId || p.uniqueId === item.productId);
                const thumbUrl = item.imageUrl || item.imageUri || prod?.imageUri || prod?.imageUrl || '';
                return `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.65rem 0.85rem; border:1px solid var(--border-color); border-radius:10px; gap: 0.75rem; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    <div style="display:flex; align-items:center; gap:0.75rem; flex: 2; min-width: 170px;">
                        <div style="width:40px; height:40px; border-radius:8px; overflow:hidden; background:var(--surface-100); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            ${thumbUrl ? `<img src="${thumbUrl}" alt="${item.productName}" style="width:100%; height:100%; object-fit:cover;">` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`}
                        </div>
                        <div>
                            <div style="font-weight:600; font-size: 0.9rem; color:var(--text-primary);">${item.productName}</div>
                            <div style="font-size:0.78rem; color:var(--text-muted);">${item.sizeWeight ? item.sizeWeight + ' &bull; ' : ''}${formatCurrency(item.unitPrice)} each</div>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="number" min="1" value="${item.quantity}" class="form-control item-qty-input" data-index="${idx}" style="width:70px; padding:0.25rem 0.5rem; text-align: center; height: 32px; font-size: 0.85rem; font-weight:600;">
                        <span style="font-weight:700; min-width: 75px; text-align: right; color: var(--text-primary); font-size:0.92rem;">${formatCurrency(item.quantity * item.unitPrice)}</span>
                        <button type="button" class="btn btn-sm btn-secondary remove-item-btn" data-index="${idx}" style="color:var(--danger); padding:0.25rem 0.55rem; font-size: 0.85rem;" title="Remove product">&times;</button>
                    </div>
                </div>
            `;
            }).join('');

            list.querySelectorAll('.item-qty-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 1) val = 1;

                    if (isVendingActive) {
                        const item = invoiceItems[idx];
                        const prod = allProducts.find(p => p.id === item.productId);
                        if (prod && val > prod.quantity) {
                            val = Math.max(1, prod.quantity);
                            showAlert.warning(`Stock limit reached for ${item.productName} (${prod.quantity} available).`);
                        }
                    }

                    invoiceItems[idx].quantity = val;
                    renderItemsList();
                    updateLiveTotals();
                    updateInvoiceSubmitState();
                });
            });

            list.querySelectorAll('.remove-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.closest('button').getAttribute('data-index'), 10);
                    invoiceItems.splice(idx, 1);
                    renderItemsList();
                    updateLiveTotals();
                    updateInvoiceSubmitState();
                });
            });
        }
        updateInvoiceSubmitState();
    };

    // Calculate live totals (Expanded breakdown with Tax, Discount, Cut, Shipping)
    const updateLiveTotals = () => {
        const liveTotalsEl = container.querySelector('#inv-live-totals');
        if (!liveTotalsEl) return;

        const cutSignBtn = container.querySelector('#inv-add-cut-sign-btn');
        const cutSign = cutSignBtn?.getAttribute('data-sign') || '-';
        const dPct = parseFloat(container.querySelector('#inv-discount')?.value || 0);
        const addCutRaw = parseFloat(container.querySelector('#inv-add-cut')?.value || 0);
        const addCut = cutSign === '-' ? -Math.abs(addCutRaw) : Math.abs(addCutRaw);
        const tPct = parseFloat(container.querySelector('#inv-tax')?.value || 0);
        const ship = parseFloat(container.querySelector('#inv-shipping')?.value || 0);

        const totals = calculateInvoiceTotal(invoiceItems, dPct, addCut, tPct, ship, cutSign);
        const discountAmt = totals.subtotal * (dPct / 100);
        const taxableBase = Math.max(0, totals.subtotal - discountAmt + addCut);

        liveTotalsEl.innerHTML = `
            <div style="display:flex; justify-content:space-between; color:var(--text-secondary);">
                <span>Subtotal</span>
                <strong style="color:var(--text-primary);">${formatCurrency(totals.subtotal)}</strong>
            </div>

            ${dPct > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#e11d48;">
                <span>Discount (${dPct}%)</span>
                <strong>-${formatCurrency(discountAmt)}</strong>
            </div>` : ''}

            ${addCutRaw > 0 ? `
            <div style="display:flex; justify-content:space-between; color:${cutSign === '-' ? '#e11d48' : '#059669'}; font-weight:600;">
                <span>${cutSign === '-' ? 'Additional Cut (-)' : 'Additional Surcharge (+)'}</span>
                <strong>${cutSign === '-' ? '-' : '+'}${formatCurrency(addCutRaw)}</strong>
            </div>` : ''}

            ${(dPct > 0 || addCutRaw > 0) && tPct > 0 ? `
            <div style="display:flex; justify-content:space-between; color:var(--text-muted); font-size:0.8rem; border-top:1px dashed var(--border-color); padding-top:2px;">
                <span>Taxable Base</span>
                <span>${formatCurrency(taxableBase)}</span>
            </div>` : ''}

            ${tPct > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#0284c7;">
                <span>Tax (${tPct}%)</span>
                <strong>+${formatCurrency(totals.taxAmount)}</strong>
            </div>` : ''}

            ${ship > 0 ? `
            <div style="display:flex; justify-content:space-between; color:#0d9488;">
                <span>Shipping Cost</span>
                <strong>+${formatCurrency(ship)}</strong>
            </div>` : ''}

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.65rem; border-top: 2px solid var(--border-color); padding-top: 0.65rem;">
                <span style="font-weight:800; font-size:1rem; color:var(--text-primary);">Grand Total</span>
                <span style="font-weight:900; font-size:1.35rem; color:var(--theme-primary, #e11d48);">${formatCurrency(totals.grandTotal)}</span>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:var(--text-muted); margin-top:4px;">
                <span>Est. Net Profit</span>
                <strong style="color:${totals.totalProfit >= 0 ? '#10b981' : '#ef4444'};">${userRestrictions.cannotSeeProfit ? '••••' : formatCurrency(totals.totalProfit)}</strong>
            </div>
        `;
        updateInvoiceSubmitState();
    };

    // Skeleton loader
    const renderSkeleton = () => {
        if (!tbody) return;
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 100px; height: 18px;"></div></td>
                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 75px; height: 18px;"></div></td>
                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 130px; height: 18px;"></div></td>
                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 65px; height: 22px; border-radius: 9999px;"></div></td>
                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 70px; height: 18px;"></div></td>
                <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 140px; height: 28px; border-radius: 8px;"></div></td>
            </tr>
        `).join('');
    };

    // Attach row events
    const attachInvoiceItemEvents = (invoices) => {
        container.querySelectorAll('.view-inv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (inv) {
                    openInvoiceDetailsModal(inv, {
                        onEdit: (invoiceToEdit) => {
                            showEditorView(true, invoiceToEdit);
                        },
                        allBusinesses,
                        allCustomers,
                        allClients
                    });
                }
            });
        });

        container.querySelectorAll('.export-pdf-inv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (inv) {
                    openInvoiceViewerModal(inv, (invoiceToEdit) => {
                        showEditorView(true, invoiceToEdit);
                    });
                }
            });
        });

        container.querySelectorAll('.edit-inv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (inv) {
                    const isCreatorSelf = (inv.creatorId && (inv.creatorId === currentUser?.uid || (currentUser?.email && inv.creatorId.toLowerCase() === (currentUser?.email || '').toLowerCase()))) || (inv.createdBy && (inv.createdBy === currentUser?.uid || (currentUser?.email && inv.createdBy.toLowerCase() === (currentUser?.email || '').toLowerCase())));
                    if (userRestrictions.disableUpdate) {
                        showAlert.warning("You are restricted from updating invoice data.");
                        return;
                    }
                    if (userRestrictions.disableUpdateOthers && !isCreatorSelf) {
                        showAlert.warning("You are restricted from updating invoices created by other members.");
                        return;
                    }
                    showEditorView(true, inv);
                }
            });
        });

        container.querySelectorAll('.del-inv').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (!inv) return;

                const isCreatorSelf = (inv.creatorId && (inv.creatorId === currentUser?.uid || (currentUser?.email && inv.creatorId.toLowerCase() === (currentUser?.email || '').toLowerCase()))) || (inv.createdBy && (inv.createdBy === currentUser?.uid || (currentUser?.email && inv.createdBy.toLowerCase() === (currentUser?.email || '').toLowerCase())));
                if (userRestrictions.disableDelete) {
                    showAlert.warning("You are restricted from deleting invoices.");
                    return;
                }
                if (userRestrictions.disableDeleteOthers && !isCreatorSelf) {
                    showAlert.warning("You are restricted from deleting invoices created by other members.");
                    return;
                }

                if (await showAlert.confirm('Are you sure you want to delete this invoice?')) {
                    try {
                        await invoiceService.deleteInvoice(id, isBusinessInvoice);
                        showAlert.success("Invoice deleted successfully.");
                    } catch (err) {
                        showAlert.error(err.message || "Failed to delete invoice.");
                    }
                }
            });
        });
    };

    // Filter and Render Rows
    const applyFiltersAndRender = () => {
        if (!tbody) return;

        const countAllEl = container.querySelector('#count-all');
        const countPaidEl = container.querySelector('#count-paid');
        const countUnpaidEl = container.querySelector('#count-unpaid');

        const validRaw = (rawInvoices || []).filter(Boolean);

        if (countAllEl) countAllEl.textContent = validRaw.length;
        if (countPaidEl) countPaidEl.textContent = validRaw.filter(i => (i.status || '').toUpperCase() === 'PAID').length;
        if (countUnpaidEl) countUnpaidEl.textContent = validRaw.filter(i => (i.status || '').toUpperCase() !== 'PAID').length;

        let filtered = validRaw.filter(inv => {
            if (!inv) return false;
            const s = (inv.status || 'Draft').toUpperCase();
            if (activeStatus === 'PAID') return s === 'PAID';
            if (activeStatus === 'UNPAID') return s !== 'PAID';
            return true;
        });

        if (activeDateFilter !== 'ALL') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

            filtered = filtered.filter(inv => {
                const invTime = getInvoiceTime(inv);
                if (activeDateFilter === 'TODAY') {
                    return invTime >= startOfToday;
                } else if (activeDateFilter === 'THIS_WEEK') {
                    const dayOfWeek = now.getDay();
                    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime();
                    return invTime >= startOfWeek;
                } else if (activeDateFilter === 'THIS_MONTH') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                    return invTime >= startOfMonth;
                } else if (activeDateFilter === 'CUSTOM' && customDateVal) {
                    const target = new Date(customDateVal);
                    const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
                    const targetEnd = targetStart + 86400000;
                    return invTime >= targetStart && invTime < targetEnd;
                }
                return true;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(inv => {
                const num = (inv.invoiceNumber || '').toLowerCase();
                const busNum = (inv.busInvNumber || '').toLowerCase();
                const uid = (inv.uniqueId || '').toLowerCase();
                const title = (inv.title || '').toLowerCase();
                const busName = (inv.businessName || '').toLowerCase();
                const custName = (inv.customerName || '').toLowerCase();
                const note = (inv.note || '').toLowerCase();
                return num.includes(q) || busNum.includes(q) || uid.includes(q) || title.includes(q) || busName.includes(q) || custName.includes(q) || note.includes(q);
            });
        }

        filtered.sort((a, b) => {
            if (activeSort === 'NEWEST') return getInvoiceTime(b) - getInvoiceTime(a);
            if (activeSort === 'OLDEST') return getInvoiceTime(a) - getInvoiceTime(b);
            if (activeSort === 'REVENUE_DESC') return (Number(b.totalPrice) || 0) - (Number(a.totalPrice) || 0);
            if (activeSort === 'REVENUE_ASC') return (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
            return 0;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 3.5rem 1rem; text-align: center;">
                        <div style="color: var(--text-muted); opacity: 0.35; margin-bottom: 0.75rem;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        </div>
                        <div style="font-weight: 600; font-size: 1.05rem; color: var(--text-primary); margin-bottom: 0.25rem;">No invoices match your selection</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Try selecting another status, date range, or clear your search query.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(inv => {
            const isPaid = (inv.status || '').toUpperCase() === 'PAID';
            const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
            const statusLabel = isPaid ? 'PAID' : (inv.status || 'UNPAID');

            const entityDisplay = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <div>
                        <div style="font-weight:700; color:var(--text-primary);">${inv.businessName || 'Business'}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                            ${inv.customerName ? `To: <strong>${inv.customerName}</strong>` : 'To: Walk-in Recipient'}
                            ${inv.customerNumber ? ` &bull; ${inv.customerNumber}` : ''}
                        </div>
                    </div>
                </div>
            `;

            const displayInvNumber = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId;
            const isCreatorSelf = (inv.creatorId && (inv.creatorId === currentUser?.uid || (currentUser?.email && inv.creatorId.toLowerCase() === (currentUser?.email || '').toLowerCase()))) || (inv.createdBy && (inv.createdBy === currentUser?.uid || (currentUser?.email && inv.createdBy.toLowerCase() === (currentUser?.email || '').toLowerCase())));
            const canEdit = !userRestrictions.disableUpdate && (!userRestrictions.disableUpdateOthers || isCreatorSelf);
            const canDelete = !userRestrictions.disableDelete && (!userRestrictions.disableDeleteOthers || isCreatorSelf);
            const showUniqueIdSub = inv.uniqueId && inv.uniqueId !== displayInvNumber;

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                    <td style="padding:1rem 1.25rem; border-bottom: 1px solid var(--border-color);">
                        <code style="font-family: monospace; font-size: 0.85rem; background: var(--surface-100); border: 1.5px solid var(--border-color); padding: 0.25rem 0.55rem; border-radius: 6px; font-weight: 700; color: var(--text-primary);">${displayInvNumber}</code>
                        ${showUniqueIdSub ? `<div style="font-size:0.72rem; font-family:monospace; color:var(--text-muted); margin-top:3px;" title="Document uniqueId">${inv.uniqueId}</div>` : ''}
                    </td>
                    <td style="padding:1rem; color: var(--text-secondary); font-size: 0.88rem; border-bottom: 1px solid var(--border-color);">${formatInvoiceDate(inv)}</td>
                    <td style="padding:1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color);">${entityDisplay}</td>
                    <td style="padding:1rem; border-bottom: 1px solid var(--border-color);">
                        <span class="${badgeClass}">${statusLabel}</span>
                    </td>
                    <td style="padding:1rem; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border-color);">${formatCurrency(inv.totalPrice)}</td>
                    <td style="padding:1rem 1.25rem; border-bottom: 1px solid var(--border-color);">
                        <div style="display:flex; gap:0.45rem; align-items:center; flex-wrap:nowrap;">
                            <button class="btn btn-sm btn-primary view-inv" data-id="${inv.id}" title="View Complete Invoice Details">View</button>
                            <button class="btn btn-sm btn-secondary export-pdf-inv" data-id="${inv.id}" title="Export PDF & Performance">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                PDF
                            </button>
                            ${canEdit ? `
                                <button class="btn btn-sm btn-secondary edit-inv" data-id="${inv.id}" title="Edit Invoice">Edit</button>
                            ` : (userRestrictions.disableUpdateOthers && !isCreatorSelf ? `
                                <button class="btn btn-sm btn-secondary" disabled style="opacity:0.4; cursor:not-allowed;" title="Restricted: Cannot edit data created by others">Locked</button>
                            ` : '')}
                            ${canDelete ? `
                                <button class="btn btn-sm btn-danger del-inv" data-id="${inv.id}" title="Delete Invoice">Delete</button>
                            ` : (userRestrictions.disableDeleteOthers && !isCreatorSelf ? `
                                <button class="btn btn-sm btn-secondary" disabled style="opacity:0.4; cursor:not-allowed;" title="Restricted: Cannot delete data created by others">Locked</button>
                            ` : '')}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        attachInvoiceItemEvents(filtered);
    };

    // Reload Entity Dropdowns
    const reloadBusinesses = async (selectedId = null) => {
        try {
            allBusinesses = (await peopleService.getAllBusinesses()) || [];
        } catch (e) {
            console.warn("reloadBusinesses error:", e);
            allBusinesses = [];
        }
        const busSelect = container.querySelector('#inv-business');
        if (!busSelect) return;
        busSelect.innerHTML = '<option value="">Select Business (Issuer)...</option>' +
            allBusinesses.map(b => `<option value="${b.id}">${b.name}${b.isPrimary ? ' ⭐ (Primary)' : ''}${b.phone ? ` (${b.phone})` : ''}</option>`).join('');

        if (selectedId) {
            busSelect.value = selectedId;
        } else if (!busSelect.value) {
            const primaryBus = allBusinesses.find(b => b.isPrimary === true) || (allBusinesses.length > 0 ? allBusinesses[0] : null);
            if (primaryBus) {
                busSelect.value = primaryBus.id;
            }
        }
        updateBusinessPreview();
        if (typeof isDrawerOpen !== 'undefined' && isDrawerOpen && typeof drawerTargetType !== 'undefined' && drawerTargetType === 'business') {
            renderEntityDrawerList(container.querySelector('#inv-drawer-search-input')?.value || '');
        }
    };

    const reloadClients = async (selectedId = null) => {
        try {
            allClients = (await peopleService.getAllClients()) || [];
        } catch (e) {
            console.warn("reloadClients error:", e);
            allClients = [];
        }
        const cliSelect = container.querySelector('#inv-client');
        if (!cliSelect) return;
        cliSelect.innerHTML = '<option value="">Select saved client...</option>' +
            allClients.map(c => `<option value="${c.id}">${c.name}${c.phone ? ` (${c.phone})` : ''}</option>`).join('');
        if (selectedId) {
            cliSelect.value = selectedId;
            setRecipientMode('client');
        }
        updateRecipientPreview();
        if (typeof isDrawerOpen !== 'undefined' && isDrawerOpen && typeof drawerTargetType !== 'undefined' && drawerTargetType === 'client') {
            renderEntityDrawerList(container.querySelector('#inv-drawer-search-input')?.value || '');
        }
    };

    const reloadCustomers = async (selectedId = null) => {
        try {
            allCustomers = (await peopleService.getAllCustomers()) || [];
        } catch (e) {
            console.warn("reloadCustomers error:", e);
            allCustomers = [];
        }
        const custSelect = container.querySelector('#inv-customer');
        if (!custSelect) return;
        custSelect.innerHTML = '<option value="">Select saved customer...</option>' +
            allCustomers.map(c => `<option value="${c.id}">${c.name}${c.phone ? ` (${c.phone})` : ''}</option>`).join('');
        if (selectedId) {
            custSelect.value = selectedId;
            setRecipientMode('customer');
        }
        updateRecipientPreview();
        if (typeof isDrawerOpen !== 'undefined' && isDrawerOpen && typeof drawerTargetType !== 'undefined' && drawerTargetType === 'customer') {
            renderEntityDrawerList(container.querySelector('#inv-drawer-search-input')?.value || '');
        }
    };

    // Load Data
    const loadData = async () => {
        try {
            renderSkeleton();

            try {
                allCategories = (await categoryService.getAllCategories()) || [];
            } catch (catErr) {
                console.warn("Could not load categories:", catErr);
                allCategories = [];
            }

            try {
                isVendingActive = await settingsService.isVendingEnabled();
            } catch (vendErr) {
                console.warn("Could not load vending status:", vendErr);
                isVendingActive = false;
            }

            const badgeEl = container.querySelector('#inv-vending-badge');
            const formVendingIndicator = container.querySelector('#form-vending-indicator');

            if (badgeEl) {
                badgeEl.innerHTML = isVendingActive
                    ? `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.8rem; font-weight: 600;">Vending Mode Active (Auto-deducts Stock)</span>`
                    : `<span class="badge" style="background: rgba(100, 116, 139, 0.1); color: #64748b; font-size: 0.8rem;">Vending Off (No Stock Deduction)</span>`;
            }

            if (formVendingIndicator) {
                formVendingIndicator.innerHTML = isVendingActive
                    ? `<span style="color: #059669; font-weight:600;">Vending Mode Active</span>`
                    : `<span style="color: var(--text-muted);">Vending Mode Off</span>`;
            }

            try {
                allProducts = (await productService.getAllActiveProducts()) || [];
            } catch (prodErr) {
                console.warn("Could not load products:", prodErr);
                allProducts = [];
            }

            const prodSelect = container.querySelector('#inv-add-product-select');
            if (prodSelect) {
                prodSelect.innerHTML = '<option value="">Select a product...</option>' +
                    allProducts.map(p => {
                        const catName = getCategoryName(p.category);
                        const catBadge = catName ? ` [${catName}]` : '';
                        return `<option value="${p.id}">${p.name}${catBadge} - ${formatCurrency(p.salePrice || 0)} (Stock: ${p.quantity || 0})</option>`;
                    }).join('');
            }

            try {
                renderPickerCategories();
            } catch (pickerErr) {
                console.warn("renderPickerCategories error:", pickerErr);
            }

            // Load businesses, clients & customers
            try { await reloadBusinesses(); } catch (bErr) { console.warn("reloadBusinesses error:", bErr); }
            try { await reloadClients(); } catch (cErr) { console.warn("reloadClients error:", cErr); }
            try { await reloadCustomers(); } catch (custErr) { console.warn("reloadCustomers error:", custErr); }

            // Auto-select if directed from People / Directory "Create Invoice"
            if (window.__preselectedInvoiceRecipient) {
                const pre = window.__preselectedInvoiceRecipient;
                window.__preselectedInvoiceRecipient = null;
                showEditorView(false);
                if (pre.mode === 'customer') {
                    setRecipientMode('customer');
                    const custSelect = container.querySelector('#inv-customer');
                    if (custSelect && pre.id) {
                        custSelect.value = pre.id;
                        updateRecipientPreview();
                    }
                } else if (pre.mode === 'client') {
                    setRecipientMode('client');
                    const cliSelect = container.querySelector('#inv-client');
                    if (cliSelect && pre.id) {
                        cliSelect.value = pre.id;
                        updateRecipientPreview();
                    }
                } else if (pre.mode === 'business') {
                    const busSelect = container.querySelector('#inv-business');
                    if (busSelect && pre.id) {
                        busSelect.value = pre.id;
                        updateBusinessPreview();
                    }
                }
            }

            // Realtime Invoice Listener
            if (container._invoiceUnsubscribe) {
                try {
                    container._invoiceUnsubscribe();
                } catch (e) { }
            }

            try {
                container._invoiceUnsubscribe = invoiceService.listenInvoices(isBusinessInvoice, (invoices) => {
                    rawInvoices = Array.isArray(invoices) ? invoices : [];
                    applyFiltersAndRender();
                });
            } catch (listenErr) {
                console.warn("listenInvoices fallback to getAllInvoices:", listenErr);
                rawInvoices = (await invoiceService.getAllInvoices(isBusinessInvoice)) || [];
                applyFiltersAndRender();
            }

            renderItemsList();
            updateLiveTotals();
        } catch (err) {
            console.error("loadData error:", err);
            showAlert.error("Failed to load invoice data.");
        }
    };

    // Listen to changes on Entity Dropdowns & Pills
    container.querySelector('#inv-business')?.addEventListener('change', updateBusinessPreview);
    container.querySelector('#inv-client')?.addEventListener('change', updateRecipientPreview);
    container.querySelector('#inv-customer')?.addEventListener('change', updateRecipientPreview);

    // Re-generate / Re-roll Invoice Number
    container.querySelector('#btn-regen-inv-id')?.addEventListener('click', () => {
        const invNumInput = container.querySelector('#inv-number-input');
        if (invNumInput) {
            invNumInput.value = generateRandomInvoiceId(isBusinessInvoice);
            updateInvoiceSubmitState();
            checkInvoiceDirty();
        }
    });

    container.querySelectorAll('#recipient-type-pills button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mode = e.currentTarget.getAttribute('data-mode');
            setRecipientMode(mode);
        });
    });

    // QUICK ADD MODAL HANDLERS
    const openQuickAddModal = (type) => {
        quickAddTargetType = type;
        quickAddForm.reset();
        quickAddPreviewImgUrl = '';
        if (qaAvatarPreview) {
            qaAvatarPreview.innerHTML = type === 'customer'
                ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
                : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
        }

        const submitBtn = container.querySelector('#btn-save-quick-add');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Save & Select';
        }

        if (type === 'business') {
            quickAddTitle.textContent = 'Add New Business (Issuer)';
        } else if (type === 'client') {
            quickAddTitle.textContent = 'Add New Client Profile';
        } else {
            quickAddTitle.textContent = 'Add New Customer Profile';
        }
        quickAddModal.style.display = 'flex';
        container.querySelector('#qa-name')?.focus();
    };

    const closeQuickAddModal = () => {
        quickAddModal.style.display = 'none';
        quickAddTargetType = null;
        quickAddPreviewImgUrl = '';
    };

    container.querySelector('#btn-quick-add-business')?.addEventListener('click', () => openQuickAddModal('business'));
    container.querySelector('#btn-quick-add-client')?.addEventListener('click', () => openQuickAddModal('client'));
    container.querySelector('#btn-quick-add-customer')?.addEventListener('click', () => openQuickAddModal('customer'));

    btnCloseQuickAdd?.addEventListener('click', closeQuickAddModal);
    btnCancelQuickAdd?.addEventListener('click', closeQuickAddModal);

    // Live Avatar Preview & Drag-and-Drop for Quick Add (File or URL)
    let pendingQaPhotoFile = null;

    const processQaPhotoFile = async (file) => {
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
                            pendingQaPhotoFile = file;
                            if (qaAvatarPreview) {
                                qaAvatarPreview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
                            }
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: "image/webp",
                            lastModified: Date.now()
                        });
                        pendingQaPhotoFile = compressedFile;
                        if (qaAvatarPreview) {
                            qaAvatarPreview.innerHTML = `<img src="${canvas.toDataURL('image/webp', 0.88)}" style="width:100%; height:100%; object-fit:cover;">`;
                        }
                        if (qaPhotoUrlInput) qaPhotoUrlInput.value = '';
                        resolve(compressedFile);
                    }, 'image/webp', 0.88);
                };
                img.onerror = () => {
                    pendingQaPhotoFile = file;
                    if (qaAvatarPreview) {
                        qaAvatarPreview.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
                    }
                    resolve(file);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    };

    const qaAvatarDropzone = container.querySelector('#qa-avatar-dropzone');
    if (qaAvatarDropzone && qaPhotoFileInput) {
        qaAvatarDropzone.addEventListener('click', (e) => {
            if (e.target.closest('input') || e.target.closest('label')) return;
            qaPhotoFileInput.click();
        });

        ['dragenter', 'dragover'].forEach(evtName => {
            qaAvatarDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                qaAvatarDropzone.style.borderColor = '#e11d48';
                qaAvatarDropzone.style.background = 'rgba(225,29,72,0.06)';
                qaAvatarDropzone.style.boxShadow = '0 0 0 2px rgba(225,29,72,0.2)';
            });
        });

        ['dragleave', 'dragend', 'drop'].forEach(evtName => {
            qaAvatarDropzone.addEventListener(evtName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                qaAvatarDropzone.style.borderColor = 'var(--border-color)';
                qaAvatarDropzone.style.background = 'var(--surface-50)';
                qaAvatarDropzone.style.boxShadow = 'none';
            });
        });

        qaAvatarDropzone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                await processQaPhotoFile(files[0]);
                showAlert.info("Photo loaded for entry.");
            }
        });
    }

    qaPhotoFileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await processQaPhotoFile(file);
        }
    });

    qaPhotoUrlInput?.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        pendingQaPhotoFile = null;
        if (url && qaAvatarPreview) {
            const fallbackSvg = quickAddTargetType === 'customer'
                ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
                : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
            qaAvatarPreview.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='${fallbackSvg.replace(/'/g, "\\'")}'">`;
        }
    });

    quickAddForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = container.querySelector('#btn-save-quick-add');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        let finalImageUrl = qaPhotoUrlInput?.value?.trim() || '';
        const file = pendingQaPhotoFile || qaPhotoFileInput?.files?.[0];

        if (file) {
            try {
                finalImageUrl = await storageService.uploadImage(file, workspaceId);
            } catch (imgErr) {
                console.warn("Storage upload error, proceeding without upload:", imgErr);
            }
        }

        const data = {
            name: container.querySelector('#qa-name').value.trim(),
            phone: container.querySelector('#qa-phone').value.trim(),
            email: container.querySelector('#qa-email').value.trim(),
            address: container.querySelector('#qa-address').value.trim(),
            status: container.querySelector('#qa-status').value || 'Active',
            tags: container.querySelector('#qa-tags')?.value?.split(',').map(s => s.trim()).filter(Boolean) || [],
            notes: container.querySelector('#qa-notes')?.value?.trim() || '',
            imageUrl: finalImageUrl,
            imageUri: finalImageUrl
        };

        try {
            if (!data.name) throw new Error("Name is required.");

            let newId = null;
            if (quickAddTargetType === 'business') {
                newId = await peopleService.addBusiness(data, currentUser?.uid);
                await reloadBusinesses(newId);
                showAlert.success(`Business "${data.name}" added and selected.`);
            } else if (quickAddTargetType === 'client') {
                newId = await peopleService.addClient(data, currentUser?.uid);
                await reloadClients(newId);
                showAlert.success(`Client "${data.name}" added and selected.`);
            } else if (quickAddTargetType === 'customer') {
                newId = await peopleService.addCustomer(data, currentUser?.uid);
                await reloadCustomers(newId);
                showAlert.success(`Customer "${data.name}" added and selected.`);
            }

            closeQuickAddModal();
            if (typeof isDrawerOpen !== 'undefined' && isDrawerOpen) {
                closeEntityDrawer();
            }
        } catch (err) {
            showAlert.error(err.message || "Failed to add entry.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save & Select';
        }
    });

    // Filter Toolbar Events
    container.querySelectorAll('#inv-status-pills .filter-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('#inv-status-pills .filter-pill').forEach(p => p.classList.remove('active'));
            const targetBtn = e.target.closest('.filter-pill');
            targetBtn.classList.add('active');
            activeStatus = targetBtn.getAttribute('data-status');
            applyFiltersAndRender();
        });
    });

    const dateFilterEl = container.querySelector('#inv-filter-date');
    const customDateEl = container.querySelector('#inv-custom-date');
    if (dateFilterEl) {
        dateFilterEl.addEventListener('change', (e) => {
            activeDateFilter = e.target.value;
            if (activeDateFilter === 'CUSTOM') {
                if (customDateEl) customDateEl.style.display = 'inline-block';
            } else {
                if (customDateEl) customDateEl.style.display = 'none';
                applyFiltersAndRender();
            }
        });
    }

    if (customDateEl) {
        customDateEl.addEventListener('change', (e) => {
            customDateVal = e.target.value;
            applyFiltersAndRender();
        });
    }

    const sortByEl = container.querySelector('#inv-sort-by');
    if (sortByEl) {
        sortByEl.addEventListener('change', (e) => {
            activeSort = e.target.value;
            applyFiltersAndRender();
        });
    }

    const searchInputEl = container.querySelector('#inv-search-input');
    if (searchInputEl) {
        searchInputEl.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            applyFiltersAndRender();
        });
    }

    // FORM OPEN EVENT
    const btnAddInv = container.querySelector('#btn-add-invoice');
    if (btnAddInv) {
        btnAddInv.addEventListener('click', () => {
            showEditorView(false);
        });
    }

    // Single item add fallback
    container.querySelector('#inv-btn-add-item')?.addEventListener('click', () => {
        const prodId = container.querySelector('#inv-add-product-select').value;
        const qty = parseInt(container.querySelector('#inv-add-qty').value, 10);

        if (!prodId || qty <= 0) {
            showAlert.warning("Please select a product and valid quantity.");
            return;
        }

        const product = allProducts.find(p => p.id === prodId);
        if (product) {
            if (isVendingActive && qty > product.quantity) {
                showAlert.warning(`Stock limit reached for ${product.name} (${product.quantity} in stock in Vending Mode).`);
                return;
            }

            const existing = invoiceItems.find(i => i.productId === product.id);
            if (existing) {
                if (isVendingActive && (existing.quantity + qty) > product.quantity) {
                    showAlert.warning(`Cannot exceed available stock of ${product.quantity}.`);
                    return;
                }
                existing.quantity += qty;
            } else {
                invoiceItems.push({
                    productId: product.id,
                    productName: product.name,
                    quantity: qty,
                    unitPrice: Number(product.salePrice || 0),
                    unitCost: Number(product.price || 0),
                    sizeWeight: product.sizeWeight || ''
                });
            }

            renderItemsList();
            updateLiveTotals();

            container.querySelector('#inv-add-product-select').value = '';
            container.querySelector('#inv-add-qty').value = 1;
        }
    });

    // Live Totals and dirty state recalculation on inputs
    ['inv-discount', 'inv-add-cut', 'inv-tax', 'inv-shipping'].forEach(id => {
        const el = container.querySelector('#' + id);
        if (el) {
            el.addEventListener('input', () => {
                updateLiveTotals();
            });
        }
    });

    // Sign Shift Toggle for Additional Cut (+ / -)
    const cutSignBtn = container.querySelector('#inv-add-cut-sign-btn');
    if (cutSignBtn) {
        cutSignBtn.addEventListener('click', () => {
            const curSign = cutSignBtn.getAttribute('data-sign') || '-';
            const nextSign = curSign === '-' ? '+' : '-';
            cutSignBtn.setAttribute('data-sign', nextSign);
            cutSignBtn.textContent = nextSign;
            if (nextSign === '+') {
                cutSignBtn.style.color = '#059669';
                cutSignBtn.style.borderColor = '#059669';
                cutSignBtn.setAttribute('title', 'Surcharge mode (+) - adds to total');
            } else {
                cutSignBtn.style.color = '#e11d48';
                cutSignBtn.style.borderColor = '#e11d48';
                cutSignBtn.setAttribute('title', 'Cut mode (-) - discounts from total');
            }
            updateLiveTotals();
        });
    }

    // SCANNER & BARCODE HANDLER (Camera + Handheld Scanner)
    const scannerModal = container.querySelector('#inv-scanner-modal');
    const btnOpenScanner = container.querySelector('#btn-open-scanner');
    const btnCloseScanner = container.querySelector('#inv-scanner-close-btn');
    const btnDoneScanner = container.querySelector('#inv-scanner-done-btn');
    const scannerInput = container.querySelector('#inv-scanner-input');
    const btnScannerAdd = container.querySelector('#inv-scanner-add-btn');
    const scannerVideo = container.querySelector('#inv-scanner-video');
    const scannerCamStatus = container.querySelector('#inv-scanner-cam-status');
    const btnToggleCam = container.querySelector('#inv-scanner-toggle-cam-btn');
    const scannerFeedback = container.querySelector('#inv-scanner-feedback');

    let scannerMediaStream = null;
    let scannerBarcodeInterval = null;

    const showScannerFeedback = (msg, isSuccess) => {
        if (!scannerFeedback) return;
        scannerFeedback.style.display = 'block';
        scannerFeedback.style.background = isSuccess ? '#ecfdf5' : '#fff1f2';
        scannerFeedback.style.color = isSuccess ? '#065f46' : '#9f1239';
        scannerFeedback.style.border = isSuccess ? '1px solid #a7f3d0' : '1px solid #fecdd3';
        scannerFeedback.textContent = msg;
        setTimeout(() => {
            if (scannerFeedback) scannerFeedback.style.display = 'none';
        }, 4000);
    };

    const processBarcodeMatch = (rawCode) => {
        const code = String(rawCode || '').trim();
        if (!code) return;

        let matchedProd = allProducts.find(p => 
            (p.upcCode && String(p.upcCode).trim() === code) ||
            (p.barcode && String(p.barcode).trim() === code) ||
            (p.uniqueId && String(p.uniqueId).trim() === code) ||
            (p.id && String(p.id).trim() === code)
        );

        let matchedVariation = null;

        if (!matchedProd) {
            for (const p of allProducts) {
                if (Array.isArray(p.variations)) {
                    const v = p.variations.find(v => 
                        (v.upcCode && String(v.upcCode).trim() === code) ||
                        (v.barcode && String(v.barcode).trim() === code)
                    );
                    if (v) {
                        matchedProd = p;
                        matchedVariation = v;
                        break;
                    }
                }
            }
        }

        if (!matchedProd) {
            showScannerFeedback(`No product found with barcode / UPC: "${code}"`, false);
            return;
        }

        const prodName = matchedVariation ? `${matchedProd.name} (${matchedVariation.sizeFlavor || 'Variant'})` : matchedProd.name;
        const prodPrice = Number(matchedVariation?.salePrice || matchedProd.salePrice || 0);
        const prodCost = Number(matchedVariation?.price || matchedProd.price || 0);
        const prodSize = matchedVariation?.sizeFlavor || matchedProd.sizeWeight || '';
        const prodImage = matchedProd.imageUri || matchedProd.imageUrl || '';

        const existing = invoiceItems.find(item => 
            item.productId === matchedProd.id && 
            (!matchedVariation || item.productName === prodName)
        );

        if (existing) {
            existing.quantity += 1;
        } else {
            invoiceItems.push({
                productId: matchedProd.id,
                productName: prodName,
                quantity: 1,
                unitPrice: prodPrice,
                unitCost: prodCost,
                sizeWeight: prodSize,
                imageUrl: prodImage
            });
        }

        renderItemsList();
        updateLiveTotals();
        showScannerFeedback(`✓ Inserted: ${prodName} (${formatCurrency(prodPrice)})`, true);
    };

    const startCameraScanner = async () => {
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                if (scannerCamStatus) scannerCamStatus.textContent = 'Requesting camera access...';
                scannerMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                if (scannerVideo) {
                    scannerVideo.srcObject = scannerMediaStream;
                    await scannerVideo.play();
                }
                if (scannerCamStatus) scannerCamStatus.textContent = 'Camera active • Position barcode in box';

                if ('BarcodeDetector' in window) {
                    try {
                        const detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'] });
                        scannerBarcodeInterval = setInterval(async () => {
                            if (scannerVideo && scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
                                try {
                                    const barcodes = await detector.detect(scannerVideo);
                                    if (barcodes.length > 0) {
                                        processBarcodeMatch(barcodes[0].rawValue);
                                    }
                                } catch (e) {
                                    // ignore per-frame decode failure
                                }
                            }
                        }, 500);
                    } catch (e) {
                        console.warn("BarcodeDetector error:", e);
                    }
                }
            } else {
                if (scannerCamStatus) scannerCamStatus.textContent = 'Camera not available • Use handheld scanner input';
            }
        } catch (err) {
            console.warn("Camera init error:", err);
            if (scannerCamStatus) scannerCamStatus.textContent = 'Camera preview unavailable • Use handheld scanner input below';
        }
    };

    const stopCameraScanner = () => {
        if (scannerBarcodeInterval) {
            clearInterval(scannerBarcodeInterval);
            scannerBarcodeInterval = null;
        }
        if (scannerMediaStream) {
            scannerMediaStream.getTracks().forEach(t => t.stop());
            scannerMediaStream = null;
        }
        if (scannerVideo) {
            scannerVideo.srcObject = null;
        }
    };

    if (btnOpenScanner) {
        btnOpenScanner.addEventListener('click', () => {
            if (scannerModal) {
                scannerModal.style.display = 'flex';
                if (scannerInput) {
                    scannerInput.value = '';
                    scannerInput.focus();
                }
                startCameraScanner();
            }
        });
    }

    const closeScannerModal = () => {
        stopCameraScanner();
        if (scannerModal) scannerModal.style.display = 'none';
    };

    if (btnCloseScanner) btnCloseScanner.addEventListener('click', closeScannerModal);
    if (btnDoneScanner) btnDoneScanner.addEventListener('click', closeScannerModal);

    if (btnToggleCam) {
        btnToggleCam.addEventListener('click', () => {
            if (scannerMediaStream) {
                stopCameraScanner();
                if (scannerCamStatus) scannerCamStatus.textContent = 'Camera stopped • Use handheld scanner below';
            } else {
                startCameraScanner();
            }
        });
    }

    if (btnScannerAdd && scannerInput) {
        btnScannerAdd.addEventListener('click', () => {
            const val = scannerInput.value.trim();
            if (val) {
                processBarcodeMatch(val);
                scannerInput.value = '';
                scannerInput.focus();
            }
        });
    }

    if (scannerInput) {
        scannerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = scannerInput.value.trim();
                if (val) {
                    processBarcodeMatch(val);
                    scannerInput.value = '';
                }
            }
        });
    }

    // Setup Searchable Entity Combos (Name, Phone, Email with photo avatar)
    const setupEntitySearch = (inputId, dropdownId, selectId, getEntities, onSelect) => {
        const input = container.querySelector('#' + inputId);
        const dropdown = container.querySelector('#' + dropdownId);
        const select = container.querySelector('#' + selectId);
        if (!input || !dropdown || !select) return;

        const renderDropdown = (query = '') => {
            const entities = getEntities();
            const q = query.trim().toLowerCase();
            const filtered = q ? entities.filter(item => {
                const name = (item.name || '').toLowerCase();
                const phone = (item.phone || item.mobile || '').toLowerCase();
                const email = (item.email || '').toLowerCase();
                return name.includes(q) || phone.includes(q) || email.includes(q);
            }) : entities;

            if (filtered.length === 0) {
                dropdown.innerHTML = `<div style="padding:0.75rem; text-align:center; font-size:0.8rem; color:#64748b;">No matches found</div>`;
                dropdown.style.display = 'block';
                return;
            }

            dropdown.innerHTML = filtered.map(item => {
                const imgUrl = item.imageUrl || item.imageUri;
                return `
                    <div class="entity-search-item" data-id="${item.id}" style="display:flex; align-items:center; gap:0.65rem; padding:0.5rem 0.75rem; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background 0.15s ease;">
                        <div style="width:34px; height:34px; border-radius:50%; overflow:hidden; background:#e2e8f0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            ${imgUrl ? `<img src="${imgUrl}" alt="${escapeHtml(item.name)}" style="width:100%; height:100%; object-fit:cover;">` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>`}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.85rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.name)}</div>
                            <div style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.phone || '')}${item.phone && item.email ? ' • ' : ''}${escapeHtml(item.email || '')}</div>
                        </div>
                    </div>
                `;
            }).join('');

            dropdown.querySelectorAll('.entity-search-item').forEach(el => {
                el.addEventListener('mouseenter', () => el.style.background = '#f8fafc');
                el.addEventListener('mouseleave', () => el.style.background = 'transparent');
                el.addEventListener('click', () => {
                    const id = el.getAttribute('data-id');
                    const chosen = entities.find(x => x.id === id);
                    if (chosen) {
                        select.value = chosen.id;
                        input.value = chosen.name;
                        dropdown.style.display = 'none';
                        onSelect(chosen);
                    }
                });
            });

            dropdown.style.display = 'block';
        };

        input.addEventListener('focus', () => renderDropdown(input.value));
        input.addEventListener('input', (e) => renderDropdown(e.target.value));

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    };

    setupEntitySearch('search-inv-business', 'dropdown-inv-business', 'inv-business', () => allBusinesses, () => {
        updateBusinessPreview();
        updateInvoiceSubmitState();
    });
    setupEntitySearch('search-inv-customer', 'dropdown-inv-customer', 'inv-customer', () => allCustomers, () => {
        updateRecipientPreview();
        updateInvoiceSubmitState();
    });
    setupEntitySearch('search-inv-client', 'dropdown-inv-client', 'inv-client', () => allClients, () => {
        updateRecipientPreview();
        updateInvoiceSubmitState();
    });

    // ========================================================
    // INVOICE ENTITY SLIDE-OVER DRAWER CONTROLLER
    // (Business Issuer & Customer / Client Recipient)
    // ========================================================
    let drawerTargetType = 'business'; // 'business' | 'customer' | 'client'
    let isDrawerOpen = false;

    const drawerOverlay = container.querySelector('#inv-entity-drawer-overlay');
    const drawerPanel = container.querySelector('#inv-entity-drawer');
    const drawerTitle = container.querySelector('#inv-drawer-title');
    const drawerIcon = container.querySelector('#inv-drawer-icon');
    const drawerCount = container.querySelector('#inv-drawer-count');
    const drawerSearchInput = container.querySelector('#inv-drawer-search-input');
    const drawerSearchClear = container.querySelector('#inv-drawer-search-clear');
    const drawerList = container.querySelector('#inv-drawer-list');
    const drawerCloseBtn = container.querySelector('#inv-drawer-close-btn');
    const drawerQuickAddBtn = container.querySelector('#inv-drawer-btn-quick-add');
    const drawerQuickAddText = container.querySelector('#inv-drawer-btn-quick-add-text');
    const drawerToggleWrap = container.querySelector('#inv-drawer-client-toggle-wrap');
    const drawerPrimaryNote = container.querySelector('#inv-drawer-primary-note');
    const drawerTabClients = container.querySelector('#inv-drawer-tab-clients');
    const drawerTabCustomers = container.querySelector('#inv-drawer-tab-customers');

    const updateDrawerClientToggleUI = (mode) => {
        if (!drawerTabClients || !drawerTabCustomers) return;
        if (mode === 'client') {
            drawerTabClients.className = 'btn btn-sm btn-primary';
            drawerTabCustomers.className = 'btn btn-sm btn-secondary';
        } else {
            drawerTabCustomers.className = 'btn btn-sm btn-primary';
            drawerTabClients.className = 'btn btn-sm btn-secondary';
        }
    };

    const openEntityDrawer = (targetType = 'business') => {
        drawerTargetType = targetType;
        isDrawerOpen = true;

        // Ensure drawer overlay and panel are appended directly to body to avoid ancestor overflow clipping
        if (drawerOverlay && drawerOverlay.parentElement !== document.body) {
            document.body.appendChild(drawerOverlay);
        }
        if (drawerPanel && drawerPanel.parentElement !== document.body) {
            document.body.appendChild(drawerPanel);
        }

        if (drawerOverlay) {
            drawerOverlay.style.display = 'block';
            drawerOverlay.classList.add('open', 'is-open');
            drawerOverlay.style.opacity = '1';
            drawerOverlay.style.pointerEvents = 'auto';
            drawerOverlay.style.zIndex = '10005';
        }
        if (drawerPanel) {
            drawerPanel.style.display = 'flex';
            drawerPanel.classList.add('open', 'is-open');
            drawerPanel.style.transform = 'translateX(0)';
            drawerPanel.style.zIndex = '10006';
        }

        if (targetType === 'business') {
            if (drawerTitle) drawerTitle.textContent = 'Find Business';
            if (drawerQuickAddText) drawerQuickAddText.textContent = 'Add Business';
            if (drawerToggleWrap) drawerToggleWrap.style.display = 'none';
            if (drawerPrimaryNote) drawerPrimaryNote.style.display = 'flex';
            if (drawerSearchInput) drawerSearchInput.placeholder = 'Search business by name, phone, email... (Primary)';
            if (drawerIcon) {
                drawerIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 10h.01M6 14h.01M6 18h.01M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 10h.01M18 14h.01M18 18h.01M6 3h12v4H6z"/></svg>`;
            }
        } else {
            // Find Clients Dialog / Drawer (Supports toggling Clients <-> Customers)
            if (drawerTitle) drawerTitle.textContent = 'Find Clients';
            if (drawerQuickAddText) drawerQuickAddText.textContent = targetType === 'client' ? 'Add Client' : 'Add Customer';
            if (drawerToggleWrap) drawerToggleWrap.style.display = 'flex';
            if (drawerPrimaryNote) drawerPrimaryNote.style.display = 'none';
            if (drawerSearchInput) drawerSearchInput.placeholder = 'Search clients or customers by name, phone, email...';
            updateDrawerClientToggleUI(targetType === 'client' ? 'client' : 'customer');
            if (drawerIcon) {
                drawerIcon.innerHTML = targetType === 'client'
                    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`
                    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
            }
        }

        if (drawerSearchInput) {
            drawerSearchInput.value = '';
            if (drawerSearchClear) drawerSearchClear.style.display = 'none';
            setTimeout(() => drawerSearchInput.focus(), 80);
        }

        renderEntityDrawerList('');
    };

    const closeEntityDrawer = () => {
        isDrawerOpen = false;
        if (drawerOverlay) {
            drawerOverlay.classList.remove('open', 'is-open');
            drawerOverlay.style.opacity = '0';
            drawerOverlay.style.pointerEvents = 'none';
            setTimeout(() => { if (!isDrawerOpen) drawerOverlay.style.display = 'none'; }, 250);
        }
        if (drawerPanel) {
            drawerPanel.classList.remove('open', 'is-open');
            drawerPanel.style.transform = 'translateX(100%)';
            setTimeout(() => { if (!isDrawerOpen) drawerPanel.style.display = 'none'; }, 280);
        }
    };

    const renderEntityDrawerList = (query = '') => {
        if (!drawerList) return;

        let rawList = [];
        let currentSelectedId = '';

        if (drawerTargetType === 'business') {
            rawList = allBusinesses || [];
            currentSelectedId = container.querySelector('#inv-business')?.value || '';
        } else if (drawerTargetType === 'client') {
            rawList = allClients || [];
            currentSelectedId = container.querySelector('#inv-client')?.value || '';
        } else {
            rawList = allCustomers || [];
            currentSelectedId = container.querySelector('#inv-customer')?.value || '';
        }

        const q = (query || '').toLowerCase().trim();
        const filtered = rawList.filter(item => {
            if (!q) return true;
            const name = (item.name || '').toLowerCase();
            const phone = (item.phone || item.number || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const address = (item.address || '').toLowerCase();
            const id = (item.id || item.uniqueId || '').toLowerCase();
            return name.includes(q) || phone.includes(q) || email.includes(q) || address.includes(q) || id.includes(q);
        });

        if (drawerCount) {
            drawerCount.textContent = `Showing ${filtered.length} of ${rawList.length} entries`;
        }

        if (filtered.length === 0) {
            drawerList.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                    <div style="font-size: 2.2rem; margin-bottom: 0.5rem; opacity: 0.5;">🔍</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">No ${drawerTargetType} found</div>
                    <p style="font-size: 0.82rem; margin: 0.35rem 0 1rem; color: var(--text-muted);">
                        ${q ? `No profiles match "${query}". Try refining your search.` : `No ${drawerTargetType} profiles exist yet.`}
                    </p>
                    <button type="button" class="btn btn-sm btn-primary" id="btn-drawer-empty-add" style="display: inline-flex; align-items: center; gap: 5px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Add New ${drawerTargetType.charAt(0).toUpperCase() + drawerTargetType.slice(1)}
                    </button>
                </div>
            `;
            const emptyAddBtn = drawerList.querySelector('#btn-drawer-empty-add');
            if (emptyAddBtn) {
                emptyAddBtn.addEventListener('click', () => {
                    openQuickAddModal(drawerTargetType);
                });
            }
            return;
        }

        drawerList.innerHTML = filtered.map(item => {
            const isSelected = item.id === currentSelectedId;
            const imgUrl = item.imageUrl || item.imageUri;
            const isBiz = (drawerTargetType === 'business');
            const isPrimaryBiz = isBiz && item.isPrimary === true;

            // Round Logo Thumbnail
            const avatarMarkup = imgUrl
                ? `<img src="${imgUrl}" alt="${escapeHtml(item.name || '')}" style="width: 48px; height: 48px; border-radius: 50% !important; object-fit: cover; border: 2px solid ${isPrimaryBiz ? 'var(--primary, #2563eb)' : 'var(--border-color)'}; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.06);">`
                : `<div style="width: 48px; height: 48px; border-radius: 50% !important; background: ${isBiz ? 'rgba(37, 99, 235, 0.1)' : 'rgba(100, 116, 139, 0.12)'}; color: ${isBiz ? '#2563eb' : '#475569'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.15rem; flex-shrink: 0; border: 2px solid ${isPrimaryBiz ? 'var(--primary, #2563eb)' : 'var(--border-color)'};">
                    ${isBiz 
                        ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 10h.01M6 14h.01M6 18h.01M10 10h.01M10 14h.01M10 18h.01M14 10h.01M14 14h.01M14 18h.01M18 10h.01M18 14h.01M18 18h.01M6 3h12v4H6z"/></svg>`
                        : (drawerTargetType === 'client'
                            ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`
                            : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
                          )
                    }
                  </div>`;

            return `
                <div class="entity-drawer-card ${isSelected ? 'selected' : ''}" data-entity-id="${item.id}" style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.9rem; padding: 0.9rem 1rem; border-radius: 12px; border: 1.5px solid ${isSelected ? 'var(--primary, #2563eb)' : 'var(--border-color)'}; background: ${isSelected ? 'var(--hover-bg, #f0f4fa)' : 'var(--bg-card, #ffffff)'}; cursor: pointer; transition: all 0.18s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                    
                    <div style="display: flex; gap: 0.85rem; align-items: flex-start; flex: 1; min-width: 0;">
                        ${avatarMarkup}
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                                <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary); line-height: 1.3;">${escapeHtml(item.name || 'Unnamed')}</span>
                                ${isPrimaryBiz ? `<span class="badge" style="background: rgba(37, 99, 235, 0.12); color: #2563eb; border: 1px solid rgba(37, 99, 235, 0.3); font-size: 0.7rem; padding: 1px 7px; border-radius: 9999px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">⭐ Primary (Default)</span>` : ''}
                                ${isSelected ? `<span class="badge" style="background: #15803d; color: #ffffff; font-size: 0.68rem; padding: 1px 6px; border-radius: 9999px; font-weight: 700;">Selected</span>` : ''}
                            </div>
                            
                            <!-- Phone Number -->
                            <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.22rem;">
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted); flex-shrink: 0;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>${escapeHtml(item.phone || item.number || 'No phone number')}</span>
                                </span>
                                
                                <!-- Email Address -->
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted); flex-shrink: 0;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.email || 'No email address')}</span>
                                </span>

                                ${item.address ? `
                                    <span style="display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted);">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.address)}</span>
                                    </span>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.45rem; flex-shrink: 0;">
                        ${(isBiz && !isPrimaryBiz) ? `
                            <button type="button" class="btn btn-sm btn-secondary btn-drawer-set-primary" data-bus-id="${item.id}" title="Set as default business for all new invoices (only one primary at a time)" style="font-size: 0.72rem; padding: 0.22rem 0.55rem; border-radius: 6px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;">
                                ★ Set Primary
                            </button>
                        ` : ''}
                        <button type="button" class="btn btn-sm ${isSelected ? 'btn-secondary' : 'btn-primary'} btn-drawer-select-item" data-item-id="${item.id}" style="font-size: 0.75rem; padding: 0.28rem 0.7rem; font-weight: 700;">
                            ${isSelected ? 'Selected' : 'Select'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Attach Card Click and Set Primary Events
        drawerList.querySelectorAll('.entity-drawer-card').forEach(card => {
            const itemId = card.getAttribute('data-entity-id');
            const selectItem = () => {
                if (drawerTargetType === 'business') {
                    const busSelect = container.querySelector('#inv-business');
                    if (busSelect) {
                        busSelect.value = itemId;
                        updateBusinessPreview();
                        updateInvoiceSubmitState();
                    }
                } else if (drawerTargetType === 'client') {
                    setRecipientMode('client');
                    const cliSelect = container.querySelector('#inv-client');
                    if (cliSelect) {
                        cliSelect.value = itemId;
                        updateRecipientPreview();
                        updateInvoiceSubmitState();
                    }
                } else {
                    setRecipientMode('customer');
                    const custSelect = container.querySelector('#inv-customer');
                    if (custSelect) {
                        custSelect.value = itemId;
                        updateRecipientPreview();
                        updateInvoiceSubmitState();
                    }
                }
                closeEntityDrawer();
            };

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-drawer-set-primary')) return;
                selectItem();
            });

            card.querySelector('.btn-drawer-select-item')?.addEventListener('click', (e) => {
                e.stopPropagation();
                selectItem();
            });
        });

        // Set Primary Business button handler (Business ONLY - guarantees strictly one primary)
        drawerList.querySelectorAll('.btn-drawer-set-primary').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const busId = btn.getAttribute('data-bus-id');
                try {
                    btn.disabled = true;
                    btn.textContent = 'Setting...';
                    await peopleService.setPrimaryBusiness(busId);
                    // Strictly guarantee only one business is primary at a time
                    allBusinesses.forEach(b => {
                        b.isPrimary = (b.id === busId);
                    });
                    if (!editingInvoiceId) {
                        const busSelect = container.querySelector('#inv-business');
                        if (busSelect) {
                            busSelect.value = busId;
                            updateBusinessPreview();
                            updateInvoiceSubmitState();
                        }
                    } else {
                        updateBusinessPreview();
                    }
                    const targetBus = allBusinesses.find(b => b.id === busId);
                    showAlert.success(`"${targetBus?.name || 'Business'}" is now the only Primary Business.`);
                    renderEntityDrawerList(drawerSearchInput?.value || '');
                } catch (err) {
                    showAlert.error(err.message || 'Failed to set Primary Business.');
                }
            });
        });
    };

    // Client - Customer toggle buttons inside drawer
    if (drawerTabClients) {
        drawerTabClients.addEventListener('click', () => {
            drawerTargetType = 'client';
            setRecipientMode('client');
            updateDrawerClientToggleUI('client');
            renderEntityDrawerList(drawerSearchInput?.value || '');
        });
    }

    if (drawerTabCustomers) {
        drawerTabCustomers.addEventListener('click', () => {
            drawerTargetType = 'customer';
            setRecipientMode('customer');
            updateDrawerClientToggleUI('customer');
            renderEntityDrawerList(drawerSearchInput?.value || '');
        });
    }

    // Attach drawer opening listeners (both direct and via container event delegation)
    container.addEventListener('click', (e) => {
        const btnBus = e.target.closest('#btn-browse-inv-business, #btn-trigger-inv-business-drawer, #btn-change-inv-business');
        if (btnBus) {
            e.preventDefault();
            e.stopPropagation();
            openEntityDrawer('business');
            return;
        }
        const btnRec = e.target.closest('#btn-browse-inv-recipient, #btn-trigger-inv-customer-drawer, #btn-trigger-inv-client-drawer, #btn-change-inv-recipient');
        if (btnRec) {
            e.preventDefault();
            e.stopPropagation();
            openEntityDrawer(recipientMode === 'client' ? 'client' : 'customer');
            return;
        }
    });

    container.querySelector('#btn-browse-inv-business')?.addEventListener('click', () => openEntityDrawer('business'));
    container.querySelector('#btn-trigger-inv-business-drawer')?.addEventListener('click', () => openEntityDrawer('business'));
    
    container.querySelector('#btn-browse-inv-recipient')?.addEventListener('click', () => {
        openEntityDrawer(recipientMode === 'client' ? 'client' : 'customer');
    });
    container.querySelector('#btn-trigger-inv-customer-drawer')?.addEventListener('click', () => openEntityDrawer('customer'));
    container.querySelector('#btn-trigger-inv-client-drawer')?.addEventListener('click', () => openEntityDrawer('client'));

    // Keyboard Escape key to close entity drawer
    const onDrawerEscKey = (e) => {
        if (e.key === 'Escape' && isDrawerOpen) {
            closeEntityDrawer();
        }
    };
    window.addEventListener('keydown', onDrawerEscKey);

    // Drawer close listeners
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeEntityDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeEntityDrawer);

    // Drawer search input
    if (drawerSearchInput) {
        drawerSearchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (drawerSearchClear) {
                drawerSearchClear.style.display = val ? 'block' : 'none';
            }
            renderEntityDrawerList(val);
        });
    }

    if (drawerSearchClear) {
        drawerSearchClear.addEventListener('click', () => {
            if (drawerSearchInput) drawerSearchInput.value = '';
            drawerSearchClear.style.display = 'none';
            renderEntityDrawerList('');
            drawerSearchInput?.focus();
        });
    }

    // Drawer quick add
    if (drawerQuickAddBtn) {
        drawerQuickAddBtn.addEventListener('click', () => {
            openQuickAddModal(drawerTargetType);
        });
    }

    // Escape key listener for drawer
    const handleDrawerKeyDown = (e) => {
        if (e.key === 'Escape' && isDrawerOpen) {
            e.stopPropagation();
            closeEntityDrawer();
        }
    };
    window.addEventListener('keydown', handleDrawerKeyDown);

    // Primary business changed global listener
    const handlePrimaryBusinessChange = (e) => {
        const newPrimaryId = e.detail?.businessId;
        allBusinesses.forEach(b => {
            b.isPrimary = (b.id === newPrimaryId);
        });
        if (!editingInvoiceId) {
            const busSelect = container.querySelector('#inv-business');
            if (busSelect) {
                busSelect.value = newPrimaryId;
                updateBusinessPreview();
                updateInvoiceSubmitState();
            }
        } else {
            updateBusinessPreview();
        }
        if (isDrawerOpen && drawerTargetType === 'business') {
            renderEntityDrawerList(drawerSearchInput?.value || '');
        }
    };
    window.addEventListener('pricelister-primary-business-changed', handlePrimaryBusinessChange);

    ['inv-title', 'inv-number-input', 'inv-customer-name', 'inv-customer-phone', 'inv-customer-email', 'inv-customer-address', 'inv-note'].forEach(id => {
        const el = container.querySelector('#' + id);
        if (el) {
            el.addEventListener('input', () => {
                updateInvoiceSubmitState();
            });
        }
    });

    ['inv-business', 'inv-client', 'inv-customer', 'inv-status'].forEach(id => {
        const el = container.querySelector('#' + id);
        if (el) {
            el.addEventListener('change', () => {
                updateInvoiceSubmitState();
            });
        }
    });

    container.querySelector('#qa-name')?.addEventListener('input', (e) => {
        const submitBtn = container.querySelector('#btn-save-quick-add');
        if (submitBtn) {
            submitBtn.disabled = !e.target.value.trim();
        }
    });

    // SAVE / UPDATE INVOICE HANDLER
    if (btnSubmit) {
        btnSubmit.addEventListener('click', async () => {
            try {
                if (invoiceItems.length === 0) {
                    throw new Error("Please add at least one product to the invoice.");
                }

                btnSubmit.disabled = true;
                btnSubmit.textContent = editingInvoiceId ? "Updating..." : "Saving...";

                let rawStatus = (container.querySelector('#inv-status')?.value || 'Paid').trim();
                if (rawStatus.toUpperCase() === 'PAID') rawStatus = 'Paid';
                else if (rawStatus.toUpperCase() === 'UNPAID') rawStatus = 'Unpaid';
                else rawStatus = 'Draft';

                const cutSign = (container.querySelector('#inv-add-cut-sign-btn')?.getAttribute('data-sign')) || '-';
                const discPct = parseFloat(container.querySelector('#inv-discount')?.value || 0);
                const addCutRaw = parseFloat(container.querySelector('#inv-add-cut')?.value || 0);
                const addCut = cutSign === '-' ? -Math.abs(addCutRaw) : Math.abs(addCutRaw);
                const taxPct = parseFloat(container.querySelector('#inv-tax')?.value || 0);
                const shippingCost = parseFloat(container.querySelector('#inv-shipping')?.value || 0);

                const calculatedTotals = calculateInvoiceTotal(invoiceItems, discPct, addCut, taxPct, shippingCost, cutSign);

                const invoiceData = {
                    isBusinessInvoice,
                    discountPercent: discPct,
                    additionalCut: addCut,
                    cutSign: cutSign,
                    taxPercent: taxPct,
                    shippingCost: shippingCost,
                    totalPrice: calculatedTotals.grandTotal,
                    totalProfit: calculatedTotals.totalProfit,
                    status: rawStatus,
                    note: container.querySelector('#inv-note')?.value || '',
                    timestamp: Date.now()
                };

                // Shared Issuer Data
                const bSelect = container.querySelector('#inv-business');
                if (!bSelect || !bSelect.value) throw new Error("Please select the issuing Business.");

                const bus = allBusinesses.find(b => b.id === bSelect.value);
                if (bus) {
                    invoiceData.businessId = bus.uniqueId || bus.id;
                    invoiceData.businessName = bus.name || '';
                    invoiceData.businessAddress = bus.address || '';
                    invoiceData.businessPhone = bus.phone || '';
                    invoiceData.businessEmail = bus.email || '';
                }

                // Shared Recipient Data (Customer / Client / Walk-in)
                if (recipientMode === 'customer') {
                    const cSelect = container.querySelector('#inv-customer');
                    const cust = allCustomers.find(c => c.id === cSelect?.value);
                    if (cust) {
                        invoiceData.customerId = cust.uniqueId || cust.id;
                        invoiceData.customerName = cust.name || '';
                        invoiceData.customerNumber = cust.phone || '';
                        invoiceData.clientEmail = cust.email || '';
                        invoiceData.clientAddress = cust.address || '';
                    } else {
                        invoiceData.customerName = (container.querySelector('#inv-customer-name')?.value || '').trim();
                        invoiceData.customerNumber = (container.querySelector('#inv-customer-phone')?.value || '').trim();
                        invoiceData.clientEmail = (container.querySelector('#inv-customer-email')?.value || '').trim();
                        invoiceData.clientAddress = (container.querySelector('#inv-customer-address')?.value || '').trim();
                    }
                } else if (recipientMode === 'client') {
                    const cSelect = container.querySelector('#inv-client');
                    const cli = allClients.find(c => c.id === cSelect?.value);
                    if (cli) {
                        invoiceData.clientId = cli.uniqueId || cli.id;
                        invoiceData.customerName = cli.name || '';
                        invoiceData.customerNumber = cli.phone || '';
                        invoiceData.clientPhone = cli.phone || '';
                        invoiceData.clientEmail = cli.email || '';
                        invoiceData.clientAddress = cli.address || '';
                    } else {
                        invoiceData.customerName = (container.querySelector('#inv-customer-name')?.value || '').trim();
                        invoiceData.customerNumber = (container.querySelector('#inv-customer-phone')?.value || '').trim();
                        invoiceData.clientPhone = (container.querySelector('#inv-customer-phone')?.value || '').trim();
                        invoiceData.clientEmail = (container.querySelector('#inv-customer-email')?.value || '').trim();
                        invoiceData.clientAddress = (container.querySelector('#inv-customer-address')?.value || '').trim();
                    }
                } else {
                    invoiceData.customerName = (container.querySelector('#inv-customer-name')?.value || '').trim();
                    invoiceData.customerNumber = (container.querySelector('#inv-customer-phone')?.value || '').trim();
                    invoiceData.clientPhone = (container.querySelector('#inv-customer-phone')?.value || '').trim();
                    invoiceData.clientEmail = (container.querySelector('#inv-customer-email')?.value || '').trim();
                    invoiceData.clientAddress = (container.querySelector('#inv-customer-address')?.value || '').trim();
                }

                if (!invoiceData.customerName) {
                    throw new Error("Recipient / Customer Name is required.");
                }

                const invTitle = (container.querySelector('#inv-title')?.value || '').trim();
                if (!invTitle) throw new Error("Invoice Title is required.");
                invoiceData.title = invTitle;

                const invNumber = (container.querySelector('#inv-number-input')?.value || '').trim();
                if (!invNumber) throw new Error("Invoice Number is required.");
                invoiceData.invoiceNumber = invNumber;
                invoiceData.busInvNumber = invNumber;

                if (editingInvoiceId) {
                    invoiceData.uniqueId = editingInvoiceUniqueId;
                    await invoiceService.updateInvoice(editingInvoiceId, invoiceData, invoiceItems, isVendingActive);
                    showAlert.success(`Invoice ${invoiceData.invoiceNumber} updated successfully!`);
                } else {
                    invoiceData.uniqueId = editingInvoiceUniqueId || generateUniqueId();
                    await invoiceService.createInvoice(invoiceData, invoiceItems, currentUser?.uid || '', isVendingActive);
                    showAlert.success(`Invoice ${invoiceData.invoiceNumber} created successfully! ${isVendingActive ? '(Stock deducted in Vending Mode)' : ''}`);
                }

                const draftKey = 'inv_' + (isBusinessInvoice ? 'bus_' : 'cust_') + (editingInvoiceId || 'new');
                draftManager.clearDraft(draftKey);
                draftManager.unregisterActiveForm('invoice_editor');
                if (invUnsavedIndicator) invUnsavedIndicator.update(false);

                showListView();
                await loadData();

            } catch (err) {
                showAlert.error(err.message || "Failed to save invoice.");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = editingInvoiceId ? "Update Invoice" : "Save Invoice";
            }
        });
    }

    // Export Invoices Excel Click Handler
    const btnExportInv = container.querySelector('#btn-export-invoices-excel');
    if (btnExportInv) {
        btnExportInv.addEventListener('click', () => {
            if (!rawInvoices || rawInvoices.length === 0) {
                showAlert.warning("No invoices available to export.");
                return;
            }
            exportInvoicesExcel(rawInvoices);
            showAlert.success(`Exported ${rawInvoices.length} invoices to Excel!`);
        });
    }

    loadData();
};
