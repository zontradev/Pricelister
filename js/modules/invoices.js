import { getInvoiceService } from '../services/invoiceService.js';
import { getProductService } from '../services/productService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCategoryService } from '../services/categoryService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { toggleContextPanel } from '../workspace.js';
import { generateUniqueId } from '../../DataModel.js';
import { exportInvoicesExcel } from '../utils/exportEngine.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';

export const renderInvoices = async (container, workspaceId, isBusinessInvoice) => {
    const invoiceService = getInvoiceService(workspaceId);
    const productService = getProductService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const settingsService = getSettingsService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    const typeLabel = isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice';
    
    let allProducts = [];
    let allCategories = [];
    let allBusinesses = [];
    let allClients = [];
    let allCustomers = [];
    let invoiceItems = [];
    let rawInvoices = [];
    let isVendingActive = false;

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

    container.innerHTML = `
        <!-- ================= INVOICE LIST VIEW ================= -->
        <div id="invoice-list-view">
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2 style="margin: 0 0 0.35rem 0;">${typeLabel}s</h2>
                    <div id="inv-vending-badge" style="display: inline-block;"></div>
                </div>
                <div style="display:flex; gap:0.6rem; align-items:center;">
                    <button id="btn-export-invoices-excel" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Export Excel
                    </button>
                    <button id="btn-add-invoice" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        + Add ${typeLabel}
                    </button>
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
                        <input type="text" id="inv-search-input" placeholder="Search by name, ID, uniqueId...">
                    </div>
                </div>
            </div>
            
            <div class="card" style="padding: 0; overflow: hidden; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                <div class="table-container">
                    <table style="width:100%; border-collapse: collapse; text-align:left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); background: rgba(248, 250, 252, 0.7);">
                                <th style="padding:1rem 1.25rem;">Invoice #</th>
                                <th style="padding:1rem;">Date</th>
                                <th style="padding:1rem;">${isBusinessInvoice ? 'Business (Issuer) & Client' : 'Customer'}</th>
                                <th style="padding:1rem;">Status</th>
                                <th style="padding:1rem;">Total</th>
                                <th style="padding:1rem 1.25rem;">Actions</th>
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

        <!-- ================= INVOICE CREATION / EDIT VIEW ================= -->
        <div id="invoice-editor-view" style="display:none; margin-bottom: 2.5rem;">
            
            <!-- Top Back Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <button type="button" id="btn-back-to-list" class="btn btn-secondary" style="font-weight: 600; display: inline-flex; align-items: center; gap: 6px; padding: 0.55rem 1rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    &larr; Back to Invoices
                </button>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <span id="form-vending-indicator" style="font-size: 0.85rem; font-weight: 600;"></span>
                </div>
            </div>

            <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <h3 id="inv-form-title" style="margin:0; font-size: 1.45rem; color: var(--text-primary); font-weight: 700;">New ${typeLabel}</h3>
                        <p id="inv-form-subtitle" style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--text-secondary);">Fill in the details below to generate your invoice.</p>
                    </div>
                </div>

                <form id="invoice-form" style="display:flex; flex-direction:column; gap:1.75rem;">
                    
                    <!-- SECTION 1: ISSUER (YOUR BUSINESS) -->
                    <div class="form-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION 1 — ISSUER (YOUR BUSINESS) *</h4>
                            <button type="button" id="btn-quick-add-business" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.25rem 0.65rem; display:inline-flex; align-items:center; gap:4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> + New Business
                            </button>
                        </div>
                        <div style="display:flex; gap:1rem; align-items:flex-end;">
                            <div style="flex:1;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Select Business <span style="color:var(--danger);">*</span></label>
                                <select id="inv-business" class="form-control" style="width:100%; padding:0.55rem;" required>
                                    <option value="">Loading businesses...</option>
                                </select>
                            </div>
                        </div>
                        <div id="inv-business-preview" style="display:none; margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); background: var(--surface-50); padding: 0.5rem 0.75rem; border-radius: 6px;"></div>
                    </div>

                    <!-- SECTION 2: BILLED TO (CLIENT OR CUSTOMER) -->
                    ${isBusinessInvoice ? `
                    <div class="form-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION 2 — BILLED TO (CLIENT BUSINESS) *</h4>
                            <button type="button" id="btn-quick-add-client" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.25rem 0.65rem; display:inline-flex; align-items:center; gap:4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> + New Client
                            </button>
                        </div>
                        <div style="display:flex; gap:1rem; align-items:flex-end; flex-wrap: wrap;">
                            <div style="flex:1; min-width: 220px;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Select Client <span style="color:var(--danger);">*</span></label>
                                <select id="inv-client" class="form-control" style="width:100%; padding:0.55rem;" required>
                                    <option value="">Select Client...</option>
                                </select>
                            </div>
                        </div>
                        <div id="inv-client-preview" style="display:none; margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); background: var(--surface-50); padding: 0.5rem 0.75rem; border-radius: 6px;"></div>
                    </div>

                    <!-- SECTION 3: BUSINESS INVOICE INFO -->
                    <div class="form-section">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION 3 — BUSINESS INVOICE INFO</h4>
                        <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                            <div style="flex:1; min-width: 220px;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Title <span style="color:var(--danger);">*</span></label>
                                <input type="text" id="inv-title" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. Invoice" value="Invoice" required>
                            </div>
                            <div style="flex:1; min-width: 220px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                    <label style="font-weight: 600; font-size: 0.85rem; margin: 0;">Business Invoice Number <span style="color:var(--danger);">*</span></label>
                                    <button type="button" id="btn-regen-bus-id" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.72rem; display:inline-flex; align-items:center; gap:4px;">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Re-roll
                                    </button>
                                </div>
                                <input type="text" id="inv-bus-number" class="form-control" style="width:100%; padding:0.55rem; font-family: monospace; font-weight: 700; color: var(--primary);" placeholder="BusInv-000000" required>
                            </div>
                        </div>
                    </div>
                    ` : `
                    <div class="form-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION 2 — INVOICE IDENTIFICATION & CUSTOMER</h4>
                            <button type="button" id="btn-quick-add-customer" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; padding: 0.25rem 0.65rem; display:inline-flex; align-items:center; gap:4px;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> + New Customer
                            </button>
                        </div>
                        <div style="display:flex; gap:1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                            <div style="flex:1; min-width: 220px;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Invoice Number</label>
                                <input type="text" id="inv-cust-number" class="form-control" style="width:100%; padding:0.55rem; font-family: monospace; font-weight: 700; background: var(--surface-50); color: var(--primary);" readonly>
                            </div>
                        </div>

                        <div style="display:flex; gap:1rem; align-items:flex-end; flex-wrap: wrap;">
                            <div style="flex:1; min-width: 180px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Select Customer</label>
                                <select id="inv-customer" class="form-control" style="width:100%; padding:0.55rem;">
                                    <option value="">Walk-in / None</option>
                                </select>
                            </div>
                            <div style="flex:1; min-width: 180px;">
                                <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Customer Name <span style="color:var(--danger);">*</span></label>
                                <input type="text" id="inv-customer-name" required class="form-control" style="width:100%; padding:0.55rem;" placeholder="Enter customer name">
                            </div>
                            <div style="flex:1; min-width: 180px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Customer Phone</label>
                                <input type="text" id="inv-customer-phone" class="form-control" style="width:100%; padding:0.55rem;" placeholder="Phone number">
                            </div>
                        </div>
                    </div>
                    `}

                    <!-- SECTION: PRODUCTS SELECTION -->
                    <div class="form-section">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                            <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION ${isBusinessInvoice ? '4' : '3'} — PRODUCTS SELECTION <span style="color:var(--danger);">*</span></h4>
                            <button type="button" id="btn-toggle-picker" class="btn btn-secondary" style="font-size: 0.82rem; padding: 0.4rem 0.9rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.45rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                <span id="picker-toggle-text">Open Advanced Product Picker</span>
                            </button>
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
                                    Selected: <strong id="picker-count-disp" style="color: var(--primary);">0</strong> products (<strong id="picker-units-disp">0</strong> units) &bull; Est. Total: <strong id="picker-subtotal-disp" style="color: var(--text-primary);">${formatCurrency(0)}</strong>
                                </div>
                                <div style="display: flex; gap: 0.5rem;">
                                    <button type="button" id="picker-close-btn" class="btn btn-secondary">Hide Picker</button>
                                    <button type="button" id="picker-add-to-inv-btn" class="btn btn-primary">Add Selected to Invoice</button>
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
                            <button type="button" id="inv-btn-add-item" class="btn btn-secondary" style="padding:0.55rem 1.1rem;">+ Add Item</button>
                        </div>
                    </div>

                    <!-- CHARGES / ADJUSTMENTS -->
                    <div class="form-section">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION ${isBusinessInvoice ? '5' : '4'} — ${isBusinessInvoice ? 'BUSINESS CHARGES' : 'ADJUSTMENTS'}</h4>
                        <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                            <div style="flex:1; min-width: 140px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Discount %</label>
                                <input type="number" id="inv-discount" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                            </div>
                            <div style="flex:1; min-width: 140px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Additional Cut (${getAppCurrencySymbol()})</label>
                                <input type="number" id="inv-add-cut" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                            </div>
                            ${isBusinessInvoice ? `
                            <div style="flex:1; min-width: 140px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Tax %</label>
                                <input type="number" id="inv-tax" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                            </div>
                            <div style="flex:1; min-width: 140px;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Shipping Cost (${getAppCurrencySymbol()})</label>
                                <input type="number" id="inv-shipping" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- PAYMENT STATUS -->
                    <div class="form-section">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION ${isBusinessInvoice ? '6' : '5'} — PAYMENT STATUS</h4>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1; max-width: 220px;">
                                <select id="inv-status" class="form-control" style="width:100%; padding:0.55rem; font-weight: 600;">
                                    <option value="Paid">Paid</option>
                                    <option value="Unpaid">Unpaid</option>
                                    <option value="Draft">Draft</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    ${isBusinessInvoice ? `
                    <div class="form-section">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">SECTION 7 — NOTE</h4>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1;">
                                <textarea id="inv-note" class="form-control" style="width:100%; padding:0.55rem; min-height: 70px;" placeholder="Optional invoice instructions or payment terms..."></textarea>
                            </div>
                        </div>
                    </div>
                    ` : ''}

                    <!-- TOTALS SUMMARY -->
                    <div class="form-section" style="background:var(--surface-50); padding:1.25rem; border-radius:var(--radius-card); border: 1px solid var(--border-color);">
                        <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em; font-weight: 700;">TOTALS</h4>
                        <div id="inv-live-totals" style="font-size:1.05rem; line-height:1.6;">
                            <!-- live totals -->
                        </div>
                    </div>

                    <div style="display:flex; gap:1rem; margin-top:0.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="inv-cancel-btn" style="padding: 0.65rem 1.5rem;">Cancel</button>
                        <button type="button" class="btn btn-primary" id="inv-submit-btn" style="padding: 0.65rem 2rem;">Save Invoice</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ================= QUICK ADD MODAL (Business / Client / Customer) ================= -->
        <div id="quick-add-entity-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1050; align-items:center; justify-content:center;">
            <div class="card" style="background:var(--bg-card); width:90%; max-width:480px; padding:1.75rem; border-radius:12px; box-shadow:var(--shadow-lg); animation:fadeIn 0.2s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                    <h3 id="quick-add-modal-title" style="margin:0; font-size:1.25rem; color:var(--text-primary);">Add Entry</h3>
                    <button type="button" id="btn-close-quick-add" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
                </div>
                <form id="quick-add-form" style="display:flex; flex-direction:column; gap:1rem;">
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; margin-bottom:0.35rem; display:block;">Name *</label>
                        <input type="text" id="qa-name" required class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. Acme Corp or John Doe">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; margin-bottom:0.35rem; display:block;">Phone</label>
                        <input type="text" id="qa-phone" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. +123456789">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; margin-bottom:0.35rem; display:block;">Email</label>
                        <input type="email" id="qa-email" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. contact@example.com">
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; margin-bottom:0.35rem; display:block;">Address</label>
                        <input type="text" id="qa-address" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. 123 Main St, City">
                    </div>
                    <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:0.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                        <button type="button" id="btn-cancel-quick-add" class="btn btn-secondary">Cancel</button>
                        <button type="submit" id="btn-save-quick-add" class="btn btn-primary">Save & Select</button>
                    </div>
                </form>
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

    // Helper: Generate Random Business Invoice ID
    function generateRandomBusInvId() {
        const random6Digits = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        return `BusInv-${random6Digits}`;
    }

    // Helper: Safe Date Parsing & Formatting for Firestore / Epoch Timestamps
    function getInvoiceTime(inv) {
        if (!inv) return 0;
        const ts = inv.timestamp || inv.createdAt || inv.updatedTimestamp;
        if (!ts) return 0;
        if (typeof ts === 'number') return ts;
        if (typeof ts.toDate === 'function') {
            try { return ts.toDate().getTime(); } catch (e) {}
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
            client: container.querySelector('#inv-client')?.value || '',
            customer: container.querySelector('#inv-customer')?.value || '',
            custName: (container.querySelector('#inv-customer-name')?.value || '').trim(),
            custPhone: (container.querySelector('#inv-customer-phone')?.value || '').trim(),
            title: (container.querySelector('#inv-title')?.value || '').trim(),
            busInvNumber: (container.querySelector('#inv-bus-number')?.value || '').trim(),
            custInvNumber: (container.querySelector('#inv-cust-number')?.value || '').trim(),
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

    const isInvoiceFormDirty = () => {
        if (!editorView || editorView.style.display === 'none') return false;
        
        if (editingInvoiceId) {
            if (!initialInvoiceFormSnapshot) return false;
            return getInvoiceFormSnapshot() !== initialInvoiceFormSnapshot;
        } else {
            // New invoice: dirty if user added products, entered customer name/phone, custom note, or non-zero adjustment
            const hasItems = invoiceItems.length > 0;
            const hasCustName = Boolean(container.querySelector('#inv-customer-name')?.value?.trim());
            const hasCustPhone = Boolean(container.querySelector('#inv-customer-phone')?.value?.trim());
            const hasNote = Boolean(container.querySelector('#inv-note')?.value?.trim());
            const hasDiscount = parseFloat(container.querySelector('#inv-discount')?.value || 0) > 0;
            const hasAddCut = parseFloat(container.querySelector('#inv-add-cut')?.value || 0) > 0;
            const hasShipping = parseFloat(container.querySelector('#inv-shipping')?.value || 0) > 0;
            const hasTax = parseFloat(container.querySelector('#inv-tax')?.value || 0) > 0;
            return hasItems || hasCustName || hasCustPhone || hasNote || hasDiscount || hasAddCut || hasShipping || hasTax;
        }
    };

    const updateInvoiceSubmitState = () => {
        if (!btnSubmit) return;
        const hasItems = invoiceItems.length > 0;
        const busSelected = Boolean(container.querySelector('#inv-business')?.value);
        
        let validRequired = false;
        if (isBusinessInvoice) {
            const clientSelected = Boolean(container.querySelector('#inv-client')?.value);
            const hasTitle = Boolean((container.querySelector('#inv-title')?.value || '').trim());
            const hasBusNum = Boolean((container.querySelector('#inv-bus-number')?.value || '').trim());
            validRequired = hasItems && busSelected && clientSelected && hasTitle && hasBusNum;
        } else {
            const hasCustName = Boolean((container.querySelector('#inv-customer-name')?.value || '').trim());
            validRequired = hasItems && busSelected && hasCustName;
        }

        if (!validRequired) {
            btnSubmit.disabled = true;
            return;
        }

        if (editingInvoiceId) {
            // Smart Button: disabled if no changes have been made to the invoice
            btnSubmit.disabled = !isInvoiceFormDirty();
        } else {
            btnSubmit.disabled = false;
        }
    };

    // Attach dirty check helper to editor DOM element for router safety
    if (editorView) {
        editorView._isDirty = isInvoiceFormDirty;
    }

    // Switch View Helper
    const showEditorView = (isEdit = false, invoice = null) => {
        if (listView) listView.style.display = 'none';
        if (editorView) editorView.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (isEdit && invoice) {
            editingInvoiceId = invoice.id;
            editingInvoiceUniqueId = invoice.uniqueId || generateUniqueId();
            const displayInvNum = invoice.invoiceNumber || invoice.busInvNumber || invoice.uniqueId;
            if (formTitle) formTitle.textContent = `Edit ${typeLabel} (${displayInvNum})`;
            if (btnSubmit) btnSubmit.textContent = 'Update Invoice';
            populateFormForEdit(invoice);
            initialInvoiceFormSnapshot = getInvoiceFormSnapshot();
            updateInvoiceSubmitState();
        } else {
            editingInvoiceId = null;
            editingInvoiceUniqueId = generateUniqueId();
            if (formTitle) formTitle.textContent = `New ${typeLabel}`;
            if (btnSubmit) btnSubmit.textContent = 'Save Invoice';
            resetForm();
            initialInvoiceFormSnapshot = getInvoiceFormSnapshot();
            updateInvoiceSubmitState();
        }
    };

    const showListView = () => {
        if (editorView) editorView.style.display = 'none';
        if (listView) listView.style.display = 'block';
        editingInvoiceId = null;
        editingInvoiceUniqueId = null;
        initialInvoiceFormSnapshot = null;
    };

    const handleCloseEditor = async () => {
        if (isInvoiceFormDirty()) {
            const allowLeave = await showAlert.confirmUnsavedChanges();
            if (!allowLeave) return;
        }
        showListView();
    };

    if (btnBackToList) btnBackToList.addEventListener('click', handleCloseEditor);
    if (btnCancel) btnCancel.addEventListener('click', handleCloseEditor);

    // Populate Form for Editing
    const populateFormForEdit = (inv) => {
        // Shared Business Issuer
        const busSelect = container.querySelector('#inv-business');
        if (busSelect) {
            // Find by uniqueId or id
            const matchedBus = allBusinesses.find(b => (b.uniqueId && b.uniqueId === inv.businessId) || b.id === inv.businessId || b.name === inv.businessName);
            if (matchedBus) {
                busSelect.value = matchedBus.id;
            } else if (inv.businessId) {
                busSelect.value = inv.businessId;
            }
            updateBusinessPreview();
        }

        if (isBusinessInvoice) {
            // Client select
            const cliSelect = container.querySelector('#inv-client');
            if (cliSelect) {
                const matchedCli = allClients.find(c => (c.uniqueId && c.uniqueId === inv.clientId) || c.id === inv.clientId || c.name === inv.customerName);
                if (matchedCli) {
                    cliSelect.value = matchedCli.id;
                } else if (inv.clientId) {
                    cliSelect.value = inv.clientId;
                }
                updateClientPreview();
            }

            const titleEl = container.querySelector('#inv-title');
            if (titleEl) titleEl.value = inv.title || 'Invoice';

            const busInvField = container.querySelector('#inv-bus-number');
            if (busInvField) busInvField.value = inv.busInvNumber || inv.invoiceNumber || '';
        } else {
            // Customer
            const custSelect = container.querySelector('#inv-customer');
            if (custSelect) {
                const matchedCust = allCustomers.find(c => (c.uniqueId && c.uniqueId === inv.customerId) || c.id === inv.customerId || c.name === inv.customerName);
                if (matchedCust) custSelect.value = matchedCust.id;
            }

            const custNameEl = container.querySelector('#inv-customer-name');
            if (custNameEl) custNameEl.value = inv.customerName || '';

            const custPhoneEl = container.querySelector('#inv-customer-phone');
            if (custPhoneEl) custPhoneEl.value = inv.customerNumber || '';

            const custInvNumEl = container.querySelector('#inv-cust-number');
            if (custInvNumEl) custInvNumEl.value = inv.invoiceNumber || `INV-${inv.timestamp || Date.now()}`;
        }

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

        // Adjustments
        if (container.querySelector('#inv-discount')) container.querySelector('#inv-discount').value = inv.discountPercent || 0;
        if (container.querySelector('#inv-add-cut')) container.querySelector('#inv-add-cut').value = inv.additionalCut || 0;
        if (container.querySelector('#inv-tax')) container.querySelector('#inv-tax').value = inv.taxPercent || 0;
        if (container.querySelector('#inv-shipping')) container.querySelector('#inv-shipping').value = inv.shippingCost || 0;
        
        // Status & Note
        const statusEl = container.querySelector('#inv-status');
        if (statusEl) {
            const rawStatus = (inv.status || 'Paid').trim();
            // Normalize to title case
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

        if (isBusinessInvoice) {
            const busInvField = container.querySelector('#inv-bus-number');
            if (busInvField) busInvField.value = generateRandomBusInvId();
            const titleEl = container.querySelector('#inv-title');
            if (titleEl) titleEl.value = 'Invoice';
        } else {
            const custInvField = container.querySelector('#inv-cust-number');
            if (custInvField) custInvField.value = `INV-${Date.now()}`;
        }

        const statusEl = container.querySelector('#inv-status');
        if (statusEl) statusEl.value = 'Paid';

        updateBusinessPreview();
        updateClientPreview();
        renderItemsList();
        updateLiveTotals();
    };

    // Business Preview Helper
    const updateBusinessPreview = () => {
        const busSelect = container.querySelector('#inv-business');
        const previewEl = container.querySelector('#inv-business-preview');
        if (!previewEl || !busSelect) return;
        const b = allBusinesses.find(x => x.id === busSelect.value);
        if (b) {
            previewEl.style.display = 'block';
            previewEl.innerHTML = `<strong>${b.name}</strong> &bull; ${b.phone || 'No phone'} &bull; ${b.address || 'No address'}`;
        } else {
            previewEl.style.display = 'none';
        }
    };

    // Client Preview Helper
    const updateClientPreview = () => {
        const cliSelect = container.querySelector('#inv-client');
        const previewEl = container.querySelector('#inv-client-preview');
        if (!previewEl || !cliSelect) return;
        const c = allClients.find(x => x.id === cliSelect.value);
        if (c) {
            previewEl.style.display = 'block';
            previewEl.innerHTML = `<strong>${c.name}</strong> &bull; ${c.phone || 'No phone'} &bull; ${c.email || 'No email'} &bull; ${c.address || 'No address'}`;
        } else {
            previewEl.style.display = 'none';
        }
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

        // Update Select All Visible / Deselect All Visible button state dynamically
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

    // Toggle Select All Visible / Deselect All Visible for current section
    if (pickerBtnSelectAll) {
        pickerBtnSelectAll.addEventListener('click', () => {
            const visible = getVisibleProducts();
            const selectableVisible = isVendingActive ? visible.filter(p => Number(p.quantity || 0) > 0) : visible;
            const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every(p => pickerSelections[p.id] !== undefined);

            if (allVisibleSelected) {
                // Deselect only the currently visible section items (keeping other sections untouched!)
                selectableVisible.forEach(p => {
                    delete pickerSelections[p.id];
                });
            } else {
                // Select all currently visible items (accumulating with previous category selections!)
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

    // Clear all selections across all sections
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

    const btnRegenBusId = container.querySelector('#btn-regen-bus-id');
    if (btnRegenBusId) {
        btnRegenBusId.addEventListener('click', () => {
            const busInvField = container.querySelector('#inv-bus-number');
            if (busInvField) {
                busInvField.value = generateRandomBusInvId();
            }
        });
    }

    // Render items list
    const renderItemsList = () => {
        const list = container.querySelector('#invoice-items-list');
        if (!list) return;
        if (invoiceItems.length === 0) {
            list.innerHTML = `<div style="color:var(--text-muted); font-size:0.875rem; padding:0.75rem 0; text-align:center; background:var(--surface-50); border-radius:8px;">No products added yet. Click above to pick products.</div>`;
        } else {
            list.innerHTML = invoiceItems.map((item, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.65rem 0.85rem; border:1px solid var(--border-color); border-radius:8px; gap: 0.5rem; flex-wrap: wrap;">
                    <div style="flex: 2; min-width: 150px;">
                        <div style="font-weight:600; font-size: 0.9rem; color:var(--text-primary);">${item.productName}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted);">${item.sizeWeight ? item.sizeWeight + ' &bull; ' : ''}${formatCurrency(item.unitPrice)} each</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="number" min="1" value="${item.quantity}" class="form-control item-qty-input" data-index="${idx}" style="width:70px; padding:0.25rem 0.5rem; text-align: center; height: 32px; font-size: 0.85rem;">
                        <span style="font-weight:700; min-width: 75px; text-align: right; color: var(--text-primary);">${formatCurrency(item.quantity * item.unitPrice)}</span>
                        <button type="button" class="btn btn-sm btn-secondary remove-item-btn" data-index="${idx}" style="color:var(--danger); padding:0.25rem 0.55rem; font-size: 0.85rem;">&times;</button>
                    </div>
                </div>
            `).join('');

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

    // Calculate live totals
    const updateLiveTotals = () => {
        const liveTotalsEl = container.querySelector('#inv-live-totals');
        if (!liveTotalsEl) return;

        const dPct = parseFloat(container.querySelector('#inv-discount')?.value || 0);
        const addCut = parseFloat(container.querySelector('#inv-add-cut')?.value || 0);
        const tPct = parseFloat(container.querySelector('#inv-tax')?.value || 0);
        const ship = parseFloat(container.querySelector('#inv-shipping')?.value || 0);

        const totals = calculateInvoiceTotal(invoiceItems, dPct, addCut, tPct, ship);

        liveTotalsEl.innerHTML = `
            <div>Subtotal: ${formatCurrency(totals.subtotal)}</div>
            ${dPct > 0 ? `<div style="color:var(--primary);">Discount (${dPct}%): -${formatCurrency(totals.subtotal * (dPct/100))}</div>` : ''}
            ${addCut > 0 ? `<div style="color:var(--primary);">Additional Cut: -${formatCurrency(addCut)}</div>` : ''}
            ${tPct > 0 ? `<div>Tax (${tPct}%): +${formatCurrency(totals.taxAmount)}</div>` : ''}
            ${ship > 0 ? `<div>Shipping: +${formatCurrency(ship)}</div>` : ''}
            <div style="font-weight:700; font-size:1.25rem; margin-top:0.5rem; color:var(--primary); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">Grand Total: ${formatCurrency(totals.grandTotal)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">Est. Profit: ${formatCurrency(totals.totalProfit)}</div>
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
        // View Action
        container.querySelectorAll('.view-inv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (inv) {
                    const displayInvId = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId;
                    const itemsHtml = (inv.items || []).map(item => `
                        <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid var(--border-color);">
                            <div>
                                <div style="font-weight:600; color:var(--text-primary);">${item.productName}</div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">${item.quantity} &times; ${formatCurrency(item.unitPrice)}</div>
                            </div>
                            <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center;">
                                ${formatCurrency(item.totalPrice || (item.quantity * item.unitPrice))}
                            </div>
                        </div>
                    `).join('');
                    
                    const toName = isBusinessInvoice 
                        ? (inv.customerName || (inv.clientEmail ? `Client (${inv.clientEmail})` : 'Client Business'))
                        : (inv.customerName || 'Customer');
                    
                    const html = `
                        <div style="padding:0.5rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; background: var(--surface-50); padding: 1rem; border-radius: 8px;">
                                <div>
                                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">Invoice Number</div>
                                    <div style="font-weight:700; font-size:1.15rem; font-family:monospace; color:var(--primary); margin-top:0.25rem;">${displayInvId}</div>
                                    <div style="font-size:0.75rem; font-family:monospace; color:var(--text-muted); margin-top:0.15rem;">ID: ${inv.uniqueId || '-'}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">Issued Date</div>
                                    <div style="font-weight:600; font-size:1.05rem; margin-top:0.25rem; color:var(--text-primary);">${formatInvoiceDate(inv)}</div>
                                </div>
                            </div>
                            
                            <div style="background:var(--bg-card); border: 1px solid var(--border-color); padding:1.25rem; border-radius:8px; margin-bottom:2rem;">
                                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); margin-bottom:0.5rem; letter-spacing:0.5px;">Issuer (Business)</div>
                                <div style="font-weight:700; font-size:1rem; color:var(--text-primary);">${inv.businessName || 'Your Business'}</div>
                                ${inv.businessAddress ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">${inv.businessAddress}</div>` : ''}
                                ${inv.businessPhone ? `<div style="font-size:0.85rem; color:var(--text-secondary);">Phone: ${inv.businessPhone}</div>` : ''}
                                
                                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); margin-top:1rem; margin-bottom:0.5rem; letter-spacing:0.5px;">Billed To</div>
                                <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary);">${toName}</div>
                                ${inv.customerNumber || inv.clientPhone ? `<div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">Phone: ${inv.customerNumber || inv.clientPhone}</div>` : ''}
                                ${inv.clientEmail ? `<div style="font-size:0.85rem; color:var(--text-secondary);">Email: ${inv.clientEmail}</div>` : ''}
                                ${inv.clientAddress ? `<div style="font-size:0.85rem; color:var(--text-secondary);">Address: ${inv.clientAddress}</div>` : ''}
                                
                                <div style="display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.75rem; margin-top:1rem; border-radius: 4px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; background: ${(inv.status || '').toUpperCase() === 'PAID' ? 'rgba(16,185,129,0.15)' : 'rgba(225,29,72,0.15)'}; color: ${(inv.status || '').toUpperCase() === 'PAID' ? '#059669' : '#e11d48'}; border: 1px solid ${(inv.status || '').toUpperCase() === 'PAID' ? 'rgba(16,185,129,0.3)' : 'rgba(225,29,72,0.3)'};">
                                    STATUS: ${inv.status || 'DRAFT'}
                                </div>
                            </div>
                            
                            <h4 style="margin-bottom:0.5rem; padding-bottom:0.5rem; border-bottom:2px solid var(--surface-200); color:var(--text-secondary);">Line Items</h4>
                            <div style="margin-bottom:2rem;">
                                ${itemsHtml}
                            </div>
                            
                            <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 8px;">
                                ${inv.discountPercent > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--text-secondary);"><span style="font-size:0.9rem;">Discount (${inv.discountPercent}%)</span><span></span></div>` : ''}
                                ${inv.taxPercent > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--text-secondary);"><span style="font-size:0.9rem;">Tax (${inv.taxPercent}%)</span><span></span></div>` : ''}
                                ${inv.shippingCost > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--text-secondary);"><span style="font-size:0.9rem;">Shipping</span><span>+${formatCurrency(inv.shippingCost)}</span></div>` : ''}
                                
                                <div style="display:flex; justify-content:space-between; margin-top:0.5rem; padding-top:1rem; border-top:1px solid var(--border-color); font-weight:700; font-size:1.25rem; color:var(--text-primary);">
                                    <span>Grand Total</span>
                                    <span style="color:var(--primary);">${formatCurrency(inv.totalPrice)}</span>
                                </div>
                            </div>
                            
                            <div style="margin-top: 2rem; display:flex; gap:0.5rem;">
                                <button class="btn btn-primary btn-block" onclick="window.print()" style="padding: 0.75rem; font-size: 1rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"></path></svg>
                                    Print / Save as PDF
                                </button>
                            </div>
                        </div>
                    `;
                    toggleContextPanel('Invoice Details', html);
                }
            });
        });

        // Edit Action
        container.querySelectorAll('.edit-inv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const inv = invoices.find(i => i.id === id);
                if (inv) {
                    showEditorView(true, inv);
                }
            });
        });

        // Delete Action
        container.querySelectorAll('.del-inv').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
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

        if (countAllEl) countAllEl.textContent = rawInvoices.length;
        if (countPaidEl) countPaidEl.textContent = rawInvoices.filter(i => (i.status || '').toUpperCase() === 'PAID').length;
        if (countUnpaidEl) countUnpaidEl.textContent = rawInvoices.filter(i => (i.status || '').toUpperCase() !== 'PAID').length;

        // Filter by status
        let filtered = rawInvoices.filter(inv => {
            const s = (inv.status || 'Draft').toUpperCase();
            if (activeStatus === 'PAID') return s === 'PAID';
            if (activeStatus === 'UNPAID') return s !== 'PAID';
            return true;
        });

        // Filter by date
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

        // Filter by search query
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

        // Sort
        filtered.sort((a, b) => {
            if (activeSort === 'NEWEST') return getInvoiceTime(b) - getInvoiceTime(a);
            if (activeSort === 'OLDEST') return getInvoiceTime(a) - getInvoiceTime(b);
            if (activeSort === 'REVENUE_DESC') return (Number(b.totalPrice) || 0) - (Number(a.totalPrice) || 0);
            if (activeSort === 'REVENUE_ASC') return (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
            return 0;
        });

        // Render rows
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
            
            const entityDisplay = isBusinessInvoice 
                ? `<strong>${inv.businessName || 'Business'}</strong>${inv.customerName || inv.clientEmail ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">To: ${inv.customerName || inv.clientEmail}</div>` : ''}`
                : `<strong>${inv.customerName || 'Walk-in Customer'}</strong>${inv.customerNumber ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${inv.customerNumber}</div>` : ''}`;

            const displayInvNumber = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId;

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                    <td style="padding:1rem 1.25rem;">
                        <code style="font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.04); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 700; color: var(--text-primary);">${displayInvNumber}</code>
                        ${inv.uniqueId ? `<div style="font-size:0.72rem; font-family:monospace; color:var(--text-muted); margin-top:3px;" title="Document uniqueId">${inv.uniqueId}</div>` : ''}
                    </td>
                    <td style="padding:1rem; color: var(--text-secondary); font-size: 0.9rem;">${formatInvoiceDate(inv)}</td>
                    <td style="padding:1rem; color: var(--text-primary);">${entityDisplay}</td>
                    <td style="padding:1rem;">
                        <span class="${badgeClass}">${statusLabel}</span>
                    </td>
                    <td style="padding:1rem; font-weight: 700; color: var(--text-primary);">${formatCurrency(inv.totalPrice)}</td>
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn btn-sm btn-secondary view-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">View</button>
                            <button class="btn btn-sm btn-secondary edit-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem; font-weight:600;">Edit</button>
                            <button class="btn btn-sm btn-outline del-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem; color:var(--danger);">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        attachInvoiceItemEvents(filtered);
    };

    // Load Data
    const loadData = async () => {
        try {
            renderSkeleton();

            // Load Categories safely
            try {
                allCategories = await categoryService.getAllCategories();
            } catch (catErr) {
                console.warn("Could not load categories:", catErr);
                allCategories = [];
            }

            // Load Vending status safely
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

            // Load products safely
            try {
                allProducts = await productService.getAllActiveProducts();
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

            renderPickerCategories();

            // Load businesses safely
            try {
                await reloadBusinesses();
            } catch (bErr) {
                console.warn("Could not reload businesses:", bErr);
            }

            // Load clients or customers safely
            try {
                if (isBusinessInvoice) {
                    await reloadClients();
                } else {
                    await reloadCustomers();
                }
            } catch (entErr) {
                console.warn("Could not reload clients/customers:", entErr);
            }

            // Realtime Invoice Listener
            if (container._invoiceUnsubscribe) {
                try {
                    container._invoiceUnsubscribe();
                } catch (e) {}
            }
            
            container._invoiceUnsubscribe = invoiceService.listenInvoices(isBusinessInvoice, (invoices) => {
                rawInvoices = invoices || [];
                applyFiltersAndRender();
            });

            renderItemsList();
            updateLiveTotals();
        } catch (err) {
            console.error("loadData error:", err);
            showAlert.error("Failed to load invoice data.");
        }
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
            allBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        if (selectedId) {
            busSelect.value = selectedId;
        } else if (allBusinesses.length === 1 && !busSelect.value) {
            busSelect.value = allBusinesses[0].id;
        }
        updateBusinessPreview();
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
        cliSelect.innerHTML = '<option value="">None / Custom</option>' + 
            allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (selectedId) cliSelect.value = selectedId;
        updateClientPreview();
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
        custSelect.innerHTML = '<option value="">Walk-in / None</option>' + 
            allCustomers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (selectedId) {
            custSelect.value = selectedId;
            const c = allCustomers.find(x => x.id === selectedId);
            if (c) {
                const nameEl = container.querySelector('#inv-customer-name');
                const phoneEl = container.querySelector('#inv-customer-phone');
                if (nameEl) nameEl.value = c.name;
                if (phoneEl) phoneEl.value = c.phone || '';
            }
        }
    };

    // Listen to changes on Entity Dropdowns
    container.querySelector('#inv-business')?.addEventListener('change', updateBusinessPreview);
    container.querySelector('#inv-client')?.addEventListener('change', updateClientPreview);
    container.querySelector('#inv-customer')?.addEventListener('change', (e) => {
        const c = allCustomers.find(x => x.id === e.target.value);
        if (c) {
            container.querySelector('#inv-customer-name').value = c.name;
            container.querySelector('#inv-customer-phone').value = c.phone || '';
        } else {
            container.querySelector('#inv-customer-name').value = '';
            container.querySelector('#inv-customer-phone').value = '';
        }
    });

    // QUICK ADD MODAL HANDLERS
    const openQuickAddModal = (type) => {
        quickAddTargetType = type;
        quickAddForm.reset();
        const submitBtn = container.querySelector('#btn-save-quick-add');
        if (submitBtn) submitBtn.disabled = true;

        if (type === 'business') {
            quickAddTitle.textContent = 'Add New Business (Issuer)';
        } else if (type === 'client') {
            quickAddTitle.textContent = 'Add New Client (Billed To)';
        } else {
            quickAddTitle.textContent = 'Add New Customer';
        }
        quickAddModal.style.display = 'flex';
        container.querySelector('#qa-name')?.focus();
    };

    const closeQuickAddModal = () => {
        quickAddModal.style.display = 'none';
        quickAddTargetType = null;
    };

    container.querySelector('#btn-quick-add-business')?.addEventListener('click', () => openQuickAddModal('business'));
    container.querySelector('#btn-quick-add-client')?.addEventListener('click', () => openQuickAddModal('client'));
    container.querySelector('#btn-quick-add-customer')?.addEventListener('click', () => openQuickAddModal('customer'));

    btnCloseQuickAdd?.addEventListener('click', closeQuickAddModal);
    btnCancelQuickAdd?.addEventListener('click', closeQuickAddModal);

    quickAddForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = container.querySelector('#btn-save-quick-add');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const data = {
            name: container.querySelector('#qa-name').value.trim(),
            phone: container.querySelector('#qa-phone').value.trim(),
            email: container.querySelector('#qa-email').value.trim(),
            address: container.querySelector('#qa-address').value.trim()
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

    ['inv-title', 'inv-bus-number', 'inv-customer-name', 'inv-customer-phone', 'inv-note'].forEach(id => {
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

    // Quick Add Name Input Listener for Smart Button
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

                // Status Title Case ("Paid", "Unpaid", "Draft")
                let rawStatus = (container.querySelector('#inv-status')?.value || 'Paid').trim();
                if (rawStatus.toUpperCase() === 'PAID') rawStatus = 'Paid';
                else if (rawStatus.toUpperCase() === 'UNPAID') rawStatus = 'Unpaid';
                else rawStatus = 'Draft';

                const invoiceData = {
                    isBusinessInvoice,
                    discountPercent: parseFloat(container.querySelector('#inv-discount')?.value || 0),
                    additionalCut: parseFloat(container.querySelector('#inv-add-cut')?.value || 0),
                    taxPercent: parseFloat(container.querySelector('#inv-tax')?.value || 0),
                    shippingCost: parseFloat(container.querySelector('#inv-shipping')?.value || 0),
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

                if (isBusinessInvoice) {
                    // 5 mandatory items: Business*, Client*, Title*, Invoice Number*, At least one item*
                    const cSelect = container.querySelector('#inv-client');
                    if (!cSelect || !cSelect.value) {
                        throw new Error("Client (Billed To) is required for Business Invoices.");
                    }

                    const cli = allClients.find(c => c.id === cSelect.value);
                    if (!cli) {
                        throw new Error("Please select a valid Client.");
                    }

                    invoiceData.clientId = cli.uniqueId || cli.id;
                    invoiceData.clientAddress = cli.address || '';
                    invoiceData.clientPhone = cli.phone || '';
                    invoiceData.clientEmail = cli.email || '';
                    invoiceData.customerName = cli.name || '';
                    invoiceData.customerNumber = cli.phone || '';

                    const invTitle = (container.querySelector('#inv-title')?.value || '').trim();
                    if (!invTitle) throw new Error("Invoice Title is required.");
                    invoiceData.title = invTitle;
                    
                    const busInvNum = (container.querySelector('#inv-bus-number')?.value || '').trim();
                    if (!busInvNum) throw new Error("Business Invoice Number is required.");
                    invoiceData.busInvNumber = busInvNum;
                    invoiceData.invoiceNumber = busInvNum;

                } else {
                    // 3 mandatory items: Business*, Customer Name*, At least one item*
                    const cSelect = container.querySelector('#inv-customer');
                    if (cSelect && cSelect.value) {
                        const cust = allCustomers.find(c => c.id === cSelect.value);
                        if (cust) {
                            invoiceData.customerId = cust.uniqueId || cust.id;
                        }
                    }

                    const cName = container.querySelector('#inv-customer-name')?.value.trim();
                    if (!cName) throw new Error("Customer Name is required.");
                    
                    invoiceData.customerName = cName;
                    invoiceData.customerNumber = container.querySelector('#inv-customer-phone')?.value.trim() || '';
                    
                    const custInvNum = container.querySelector('#inv-cust-number')?.value.trim();
                    invoiceData.invoiceNumber = custInvNum || `INV-${Date.now()}`;
                }

                if (editingInvoiceId) {
                    // Preserving document uniqueId
                    invoiceData.uniqueId = editingInvoiceUniqueId;
                    await invoiceService.updateInvoice(editingInvoiceId, invoiceData, invoiceItems, isVendingActive);
                    showAlert.success(`Invoice ${invoiceData.invoiceNumber} updated successfully!`);
                } else {
                    // Correct 13-character base64 uniqueId
                    invoiceData.uniqueId = editingInvoiceUniqueId || generateUniqueId();
                    await invoiceService.createInvoice(invoiceData, invoiceItems, currentUser?.uid || '', isVendingActive);
                    showAlert.success(`Invoice ${invoiceData.invoiceNumber} created successfully! ${isVendingActive ? '(Stock deducted in Vending Mode)' : ''}`);
                }

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
