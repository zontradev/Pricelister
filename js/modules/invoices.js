import { getInvoiceService } from '../services/invoiceService.js';
import { getProductService } from '../services/productService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getSettingsService } from '../services/settingsService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { toggleContextPanel } from '../workspace.js';

export const renderInvoices = async (container, workspaceId, isBusinessInvoice) => {
    const invoiceService = getInvoiceService(workspaceId);
    const productService = getProductService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const settingsService = getSettingsService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    const typeLabel = isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice';
    
    let allProducts = [];
    let allBusinesses = [];
    let allClients = [];
    let allCustomers = [];
    let invoiceItems = [];
    let rawInvoices = [];
    let isVendingActive = false;

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

    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
            <div>
                <h2 style="margin: 0 0 0.35rem 0;">${typeLabel}s</h2>
                <div id="inv-vending-badge" style="display: inline-block;"></div>
            </div>
            <button id="btn-add-invoice" class="btn btn-primary">+ Create ${typeLabel}</button>
        </div>
        
        <!-- INVOICE FORM -->
        <div id="invoice-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1.5rem;">
                <h3 id="inv-form-title" style="margin:0; font-size: 1.35rem; color: var(--text-primary);">New ${typeLabel}</h3>
                <span id="form-vending-indicator" style="font-size: 0.8rem; font-weight: 600;"></span>
            </div>

            <form id="invoice-form" style="display:flex; flex-direction:column; gap:1.5rem;">
                
                <!-- Shared Issuer Section -->
                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION 1 — ISSUER (YOUR BUSINESS)</h4>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:1;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Select Business *</label>
                            <select id="inv-business" class="form-control" style="width:100%; padding:0.55rem;" required>
                                <option value="">Loading...</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${isBusinessInvoice ? `
                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION 2 — BILLED TO (CLIENT BUSINESS)</h4>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:1;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Select Client</label>
                            <select id="inv-client" class="form-control" style="width:100%; padding:0.55rem;">
                                <option value="">None</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION 3 — BUSINESS INVOICE INFO</h4>
                    <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 220px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Title</label>
                            <input type="text" id="inv-title" class="form-control" style="width:100%; padding:0.55rem;" placeholder="e.g. Commercial Supply Order">
                        </div>
                        <div style="flex:1; min-width: 220px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                                <label style="font-weight: 500; font-size: 0.85rem; margin: 0;">Business Invoice Number</label>
                                <button type="button" id="btn-regen-bus-id" class="btn btn-sm btn-secondary" style="padding: 0.15rem 0.5rem; font-size: 0.72rem;">🎲 Re-roll</button>
                            </div>
                            <input type="text" id="inv-bus-number" class="form-control" style="width:100%; padding:0.55rem; font-family: monospace; font-weight: 700; color: var(--primary);" placeholder="BusInv-000000">
                            <small class="text-muted" style="font-size:0.75rem; margin-top: 0.25rem; display: block;">Auto-generated random ID (BusInv-000000 to BusInv-999999). Fully editable.</small>
                        </div>
                    </div>
                </div>
                ` : `
                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION 2 — INVOICE IDENTIFICATION & CUSTOMER</h4>
                    <div style="display:flex; gap:1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 220px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Invoice Number</label>
                            <input type="text" id="inv-cust-number" class="form-control" style="width:100%; padding:0.55rem; font-family: monospace; font-weight: 700; background: var(--surface-50); color: var(--primary);" readonly>
                            <small class="text-muted" style="font-size:0.75rem; margin-top: 0.25rem; display: block;">Auto-generated timestamp invoice number (INV-Timestamp).</small>
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
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Or Customer Name *</label>
                            <input type="text" id="inv-customer-name" required class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                        <div style="flex:1; min-width: 180px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Customer Phone</label>
                            <input type="text" id="inv-customer-phone" class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                    </div>
                </div>
                `}

                <!-- PRODUCT PICKER & ITEMS SECTION -->
                <div class="form-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                        <h4 style="margin: 0; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION ${isBusinessInvoice ? '4' : '3'} — PRODUCTS SELECTION</h4>
                        <button type="button" id="btn-toggle-picker" class="btn btn-secondary" style="font-size: 0.82rem; padding: 0.4rem 0.9rem; font-weight: 600; display: inline-flex; align-items: center; gap: 0.4rem;">
                            <span>📦</span> <span id="picker-toggle-text">Open Advanced Product Picker</span>
                        </button>
                    </div>

                    <!-- ADVANCED PRODUCT PICKER CONTAINER -->
                    <div id="advanced-product-picker" class="product-picker-container" style="display:none; margin-bottom: 1.5rem;">
                        <div class="picker-search-bar">
                            <div class="search-input-wrap" style="flex: 1; min-width: 220px;">
                                <span class="search-icon">🔍</span>
                                <input type="text" id="picker-search-input" placeholder="Search by name, size, category, UPC..." autocomplete="off">
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <button type="button" id="picker-btn-select-all" class="btn btn-sm btn-secondary" style="font-size: 0.78rem;">Select All Visible</button>
                                <button type="button" id="picker-btn-clear-sel" class="btn btn-sm btn-secondary" style="font-size: 0.78rem;">Deselect All</button>
                            </div>
                        </div>

                        <!-- Category Filter Pills -->
                        <div id="picker-category-pills" style="display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 0.75rem;">
                            <!-- Injected dynamically -->
                        </div>

                        <!-- Product Cards Grid -->
                        <div class="picker-grid" id="picker-grid-container">
                            <!-- Injected dynamically -->
                        </div>

                        <!-- Picker Footer Actions -->
                        <div class="picker-footer">
                            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                                Selected: <strong id="picker-count-disp" style="color: var(--primary);">0</strong> products (<strong id="picker-units-disp">0</strong> units) &bull; Est. Total: <strong id="picker-subtotal-disp" style="color: var(--text-primary);">$0.00</strong>
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
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION ${isBusinessInvoice ? '5' : '4'} — ${isBusinessInvoice ? 'BUSINESS CHARGES' : 'ADJUSTMENTS'}</h4>
                    <div style="display:flex; gap:1rem; flex-wrap: wrap;">
                        <div style="flex:1; min-width: 140px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Discount %</label>
                            <input type="number" id="inv-discount" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                        <div style="flex:1; min-width: 140px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Additional Cut ($)</label>
                            <input type="number" id="inv-add-cut" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                        ${isBusinessInvoice ? `
                        <div style="flex:1; min-width: 140px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Tax %</label>
                            <input type="number" id="inv-tax" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                        <div style="flex:1; min-width: 140px;">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Shipping Cost ($)</label>
                            <input type="number" id="inv-shipping" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.55rem;">
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- PAYMENT STATUS -->
                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION ${isBusinessInvoice ? '6' : '5'} — PAYMENT STATUS</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1; max-width: 220px;">
                            <select id="inv-status" class="form-control" style="width:100%; padding:0.55rem; font-weight: 600;">
                                <option value="UNPAID">Unpaid</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${isBusinessInvoice ? `
                <div class="form-section">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">SECTION 7 — NOTE</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <textarea id="inv-note" class="form-control" style="width:100%; padding:0.55rem; min-height: 70px;" placeholder="Optional invoice instructions or payment terms..."></textarea>
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- TOTALS SUMMARY -->
                <div class="form-section" style="background:var(--surface-50); padding:1.25rem; border-radius:var(--radius-card); border: 1px solid var(--border-color);">
                    <h4 style="margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.85rem; letter-spacing: 0.05em;">TOTALS</h4>
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
                    <option value="ALL">📅 All Dates</option>
                    <option value="TODAY">Today</option>
                    <option value="THIS_WEEK">This Week</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Date...</option>
                </select>
                
                <input type="date" id="inv-custom-date" style="display:none; width: auto; padding: 0.35rem 0.75rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;" class="form-control">

                <!-- Sort Dropdown -->
                <select id="inv-sort-by" class="form-control" style="width: auto; padding: 0.4rem 0.85rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;">
                    <option value="NEWEST">⚡ Newest First</option>
                    <option value="OLDEST">⏳ Oldest First</option>
                    <option value="REVENUE_DESC">💰 Highest Revenue</option>
                    <option value="REVENUE_ASC">📉 Lowest Revenue</option>
                </select>
            </div>

            <div class="filter-group-right">
                <div class="search-input-wrap">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="inv-search-input" placeholder="Search by name, ID...">
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
                            <th style="padding:1rem;">${isBusinessInvoice ? 'Business' : 'Customer'}</th>
                            <th style="padding:1rem;">Status</th>
                            <th style="padding:1rem;">Total</th>
                            <th style="padding:1rem 1.25rem;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="invoices-table-body">
                        <!-- Loaded via JS -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const formContainer = container.querySelector('#invoice-form-container');
    const tbody = container.querySelector('#invoices-table-body');
    const btnSubmit = container.querySelector('#inv-submit-btn');

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
        if (pickerSubtotalDisp) pickerSubtotalDisp.textContent = `$${totalCost.toFixed(2)}`;
    };

    const renderPickerCategories = () => {
        if (!pickerCategoryPills) return;
        const categories = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
        
        pickerCategoryPills.innerHTML = `
            <button type="button" class="filter-pill ${pickerCategoryFilter === 'ALL' ? 'active' : ''}" data-cat="ALL" style="font-size:0.75rem; padding:0.25rem 0.75rem;">All (${allProducts.length})</button>
            ${categories.map(c => `
                <button type="button" class="filter-pill ${pickerCategoryFilter === c ? 'active' : ''}" data-cat="${c}" style="font-size:0.75rem; padding:0.25rem 0.75rem;">${c}</button>
            `).join('')}
        `;

        pickerCategoryPills.querySelectorAll('.filter-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                pickerCategoryPills.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
                const target = e.target.closest('.filter-pill');
                target.classList.add('active');
                pickerCategoryFilter = target.getAttribute('data-cat');
                renderPickerGrid();
            });
        });
    };

    const renderPickerGrid = () => {
        if (!pickerGridContainer) return;

        let filtered = allProducts.filter(p => {
            if (pickerCategoryFilter !== 'ALL' && p.category !== pickerCategoryFilter) return false;
            if (pickerSearchQuery) {
                const q = pickerSearchQuery.toLowerCase();
                const name = (p.name || '').toLowerCase();
                const cat = (p.category || '').toLowerCase();
                const upc = (p.upcCode || '').toLowerCase();
                const size = (p.sizeWeight || '').toLowerCase();
                return name.includes(q) || cat.includes(q) || upc.includes(q) || size.includes(q);
            }
            return true;
        });

        if (filtered.length === 0) {
            pickerGridContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
                    <div style="font-weight: 500;">No products match your search.</div>
                </div>
            `;
            return;
        }

        pickerGridContainer.innerHTML = filtered.map(p => {
            const isSelected = pickerSelections[p.id] !== undefined;
            const currentQty = pickerSelections[p.id] || 1;
            const stockQty = Number(p.quantity || 0);
            const isOutOfStock = stockQty <= 0;
            const sizeLabel = p.sizeWeight || 'Standard';

            const imgHtml = p.imageUri 
                ? `<img src="${p.imageUri}" class="picker-img" alt="${p.name}" loading="lazy">`
                : `<div style="font-size: 2rem; color: var(--text-muted); opacity: 0.5;">📦</div>`;

            return `
                <div class="picker-card ${isSelected ? 'is-selected' : ''}" data-id="${p.id}" data-stock="${stockQty}">
                    <div class="picker-card-check">✓</div>
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
                        <span class="picker-price">$${Number(p.salePrice || 0).toFixed(2)}</span>
                        ${p.category ? `<span style="font-size:0.7rem; color:var(--text-muted);">${p.category}</span>` : ''}
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
                // If clicked inside stepper, ignore
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

        // Attach events to stepper buttons
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

    // Toggle advanced picker visibility
    if (btnTogglePicker) {
        btnTogglePicker.addEventListener('click', () => {
            const isHidden = pickerContainer.style.display === 'none';
            pickerContainer.style.display = isHidden ? 'block' : 'none';
            if (pickerToggleText) {
                pickerToggleText.textContent = isHidden ? 'Hide Advanced Picker' : 'Open Advanced Product Picker';
            }
            if (isHidden) {
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
            allProducts.forEach(p => {
                const stock = Number(p.quantity || 0);
                if (isVendingActive && stock <= 0) return;
                if (pickerSelections[p.id] === undefined) {
                    pickerSelections[p.id] = 1;
                }
            });
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

    // Helper: Generate Random Business Invoice ID
    const generateRandomBusInvId = () => {
        const random6Digits = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
        return `BusInv-${random6Digits}`;
    };

    // Re-roll button for Business Invoice
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
        if (invoiceItems.length === 0) {
            list.innerHTML = `<div style="color:var(--text-muted); font-size:0.875rem; padding:0.75rem 0; text-align:center; background:var(--surface-50); border-radius:8px;">No products added yet. Click above to pick products.</div>`;
        } else {
            list.innerHTML = invoiceItems.map((item, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.65rem 0.85rem; border:1px solid var(--border-color); border-radius:8px; gap: 0.5rem; flex-wrap: wrap;">
                    <div style="flex: 2; min-width: 150px;">
                        <div style="font-weight:600; font-size: 0.9rem; color:var(--text-primary);">${item.productName}</div>
                        <div style="font-size:0.78rem; color:var(--text-muted);">${item.sizeWeight ? item.sizeWeight + ' &bull; ' : ''}$${Number(item.unitPrice).toFixed(2)} each</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <input type="number" min="1" value="${item.quantity}" class="form-control item-qty-input" data-index="${idx}" style="width:70px; padding:0.25rem 0.5rem; text-align: center; height: 32px; font-size: 0.85rem;">
                        <span style="font-weight:700; min-width: 75px; text-align: right; color: var(--text-primary);">$${(item.quantity * item.unitPrice).toFixed(2)}</span>
                        <button type="button" class="btn btn-sm btn-secondary remove-item-btn" data-index="${idx}" style="color:var(--danger); padding:0.25rem 0.55rem; font-size: 0.85rem;">&times;</button>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.item-qty-input').forEach(input => {
                input.addEventListener('change', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'), 10);
                    let val = parseInt(e.target.value, 10);
                    if (isNaN(val) || val < 1) val = 1;

                    // If vending active, check against stock
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
                });
            });

            list.querySelectorAll('.remove-item-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.closest('button').getAttribute('data-index'), 10);
                    invoiceItems.splice(idx, 1);
                    renderItemsList();
                    updateLiveTotals();
                });
            });
        }
    };

    // Shimmer Skeleton
    const renderSkeleton = () => {
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
                    const displayInvId = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId;
                    const itemsHtml = (inv.items || []).map(item => `
                        <div style="display:flex; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid var(--border-color);">
                            <div>
                                <div style="font-weight:600; color:var(--text-primary);">${item.productName}</div>
                                <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.25rem;">${item.quantity} &times; $${Number(item.unitPrice).toFixed(2)}</div>
                            </div>
                            <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center;">
                                $${Number(item.totalPrice || (item.quantity * item.unitPrice)).toFixed(2)}
                            </div>
                        </div>
                    `).join('');
                    
                    const toName = isBusinessInvoice ? (inv.businessName || 'Business Client') : (inv.customerName || 'Customer');
                    
                    const html = `
                        <div style="padding:0.5rem;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:1.5rem; background: var(--surface-50); padding: 1rem; border-radius: 8px;">
                                <div>
                                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">Invoice Number</div>
                                    <div style="font-weight:700; font-size:1.15rem; font-family:monospace; color:var(--primary); margin-top:0.25rem;">${displayInvId}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">Issued Date</div>
                                    <div style="font-weight:600; font-size:1.05rem; margin-top:0.25rem; color:var(--text-primary);">${new Date(inv.timestamp).toLocaleDateString()}</div>
                                </div>
                            </div>
                            
                            <div style="background:var(--bg-card); border: 1px solid var(--border-color); padding:1.25rem; border-radius:8px; margin-bottom:2rem;">
                                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); margin-bottom:0.5rem; letter-spacing:0.5px;">Billed To</div>
                                <div style="font-weight:700; font-size:1.1rem; color:var(--text-primary);">${toName}</div>
                                ${inv.customerNumber ? `<div style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.25rem;">Phone: ${inv.customerNumber}</div>` : ''}
                                ${inv.clientEmail ? `<div style="font-size:0.9rem; color:var(--text-secondary); margin-top:0.25rem;">Email: ${inv.clientEmail}</div>` : ''}
                                <div style="display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.75rem; margin-top:1rem; border-radius: 4px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; background: ${inv.status === 'PAID' ? 'rgba(16,185,129,0.15)' : 'rgba(225,29,72,0.15)'}; color: ${inv.status === 'PAID' ? '#059669' : '#e11d48'}; border: 1px solid ${inv.status === 'PAID' ? 'rgba(16,185,129,0.3)' : 'rgba(225,29,72,0.3)'};">
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
                                ${inv.shippingCost > 0 ? `<div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; color:var(--text-secondary);"><span style="font-size:0.9rem;">Shipping</span><span>+$${Number(inv.shippingCost).toFixed(2)}</span></div>` : ''}
                                
                                <div style="display:flex; justify-content:space-between; margin-top:0.5rem; padding-top:1rem; border-top:1px solid var(--border-color); font-weight:700; font-size:1.25rem; color:var(--text-primary);">
                                    <span>Grand Total</span>
                                    <span style="color:var(--primary);">$${Number(inv.totalPrice).toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <div style="margin-top: 2rem;">
                                <button class="btn btn-primary btn-block" onclick="window.print()" style="padding: 0.75rem; font-size: 1rem; display:flex; align-items:center; justify-content:center; gap:0.5rem;">
                                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                    Print / Save as PDF
                                </button>
                            </div>
                        </div>
                    `;
                    toggleContextPanel('Invoice Details', html);
                }
            });
        });

        container.querySelectorAll('.edit-inv').forEach(btn => {
            btn.addEventListener('click', () => {
                showAlert.info("Invoice editing is coming in the next update. For now, you can archive it and create a new one.");
            });
        });

        container.querySelectorAll('.arch-inv').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (await showAlert.confirm('Archive invoice?')) {
                    const id = e.target.getAttribute('data-id');
                    await invoiceService.archiveInvoice(id, isBusinessInvoice);
                    showAlert.success("Invoice archived.");
                }
            });
        });
    };

    const applyFiltersAndRender = () => {
        // 1. Update count badges
        const countAllEl = container.querySelector('#count-all');
        const countPaidEl = container.querySelector('#count-paid');
        const countUnpaidEl = container.querySelector('#count-unpaid');

        if (countAllEl) countAllEl.textContent = rawInvoices.length;
        if (countPaidEl) countPaidEl.textContent = rawInvoices.filter(i => (i.status || '').toUpperCase() === 'PAID').length;
        if (countUnpaidEl) countUnpaidEl.textContent = rawInvoices.filter(i => (i.status || '').toUpperCase() !== 'PAID').length;

        // 2. Filter by status
        let filtered = rawInvoices.filter(inv => {
            const s = (inv.status || 'DRAFT').toUpperCase();
            if (activeStatus === 'PAID') return s === 'PAID';
            if (activeStatus === 'UNPAID') return s !== 'PAID';
            return true;
        });

        // 3. Filter by date
        if (activeDateFilter !== 'ALL') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            filtered = filtered.filter(inv => {
                const invTime = inv.timestamp || 0;
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

        // 4. Filter by search query (including invoiceNumber, busInvNumber, uniqueId)
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(inv => {
                const num = (inv.invoiceNumber || '').toLowerCase();
                const busNum = (inv.busInvNumber || '').toLowerCase();
                const uid = (inv.uniqueId || '').toLowerCase();
                const title = (inv.title || '').toLowerCase();
                const name = (isBusinessInvoice ? (inv.businessName || '') : (inv.customerName || '')).toLowerCase();
                const note = (inv.note || '').toLowerCase();
                return num.includes(q) || busNum.includes(q) || uid.includes(q) || title.includes(q) || name.includes(q) || note.includes(q);
            });
        }

        // 5. Sort
        filtered.sort((a, b) => {
            if (activeSort === 'NEWEST') return (b.timestamp || 0) - (a.timestamp || 0);
            if (activeSort === 'OLDEST') return (a.timestamp || 0) - (b.timestamp || 0);
            if (activeSort === 'REVENUE_DESC') return (Number(b.totalPrice) || 0) - (Number(a.totalPrice) || 0);
            if (activeSort === 'REVENUE_ASC') return (Number(a.totalPrice) || 0) - (Number(b.totalPrice) || 0);
            return 0;
        });

        // 6. Render rows
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="padding: 3.5rem 1rem; text-align: center;">
                        <div style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.7;">🧾</div>
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
            const entityName = isBusinessInvoice ? (inv.businessName || 'Business Client') : (inv.customerName || 'Customer');
            const displayInvNumber = inv.invoiceNumber || inv.busInvNumber || inv.uniqueId;

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                    <td style="padding:1rem 1.25rem;"><code style="font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.04); padding: 0.2rem 0.4rem; border-radius: 4px; font-weight: 700; color: var(--text-primary);">${displayInvNumber}</code></td>
                    <td style="padding:1rem; color: var(--text-secondary); font-size: 0.9rem;">${new Date(inv.timestamp).toLocaleDateString()}</td>
                    <td style="padding:1rem; font-weight: 500; color: var(--text-primary);">${entityName}</td>
                    <td style="padding:1rem;">
                        <span class="${badgeClass}">${statusLabel}</span>
                    </td>
                    <td style="padding:1rem; font-weight: 700; color: var(--text-primary);">$${Number(inv.totalPrice).toFixed(2)}</td>
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn btn-sm btn-secondary view-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">View</button>
                            <button class="btn btn-sm btn-secondary edit-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem;">Edit</button>
                            <button class="btn btn-sm btn-secondary arch-inv" data-id="${inv.id}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem; color:var(--danger);">Archive</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        attachInvoiceItemEvents(filtered);
    };
    
    // Calculate live totals
    const updateLiveTotals = () => {
        const dPct = parseFloat(container.querySelector('#inv-discount')?.value || 0);
        const addCut = parseFloat(container.querySelector('#inv-add-cut')?.value || 0);
        const tPct = parseFloat(container.querySelector('#inv-tax')?.value || 0);
        const ship = parseFloat(container.querySelector('#inv-shipping')?.value || 0);

        const totals = calculateInvoiceTotal(invoiceItems, dPct, addCut, tPct, ship);

        container.querySelector('#inv-live-totals').innerHTML = `
            <div>Subtotal: $${totals.subtotal.toFixed(2)}</div>
            ${dPct > 0 ? `<div style="color:var(--primary);">Discount (${dPct}%): -$${(totals.subtotal * (dPct/100)).toFixed(2)}</div>` : ''}
            ${addCut > 0 ? `<div style="color:var(--primary);">Additional Cut: -$${addCut.toFixed(2)}</div>` : ''}
            ${tPct > 0 ? `<div>Tax (${tPct}%): +$${totals.taxAmount.toFixed(2)}</div>` : ''}
            ${ship > 0 ? `<div>Shipping: +$${ship.toFixed(2)}</div>` : ''}
            <div style="font-weight:700; font-size:1.25rem; margin-top:0.5rem; color:var(--primary); border-top: 1px solid var(--border-color); padding-top: 0.5rem;">Grand Total: $${totals.grandTotal.toFixed(2)}</div>
            <div style="font-size:0.85rem; color:var(--text-muted);">Est. Profit: $${totals.totalProfit.toFixed(2)}</div>
        `;
    };

    const loadData = async () => {
        try {
            // Load Vending status from Settings Service
            isVendingActive = await settingsService.isVendingEnabled();
            const badgeEl = container.querySelector('#inv-vending-badge');
            const formVendingIndicator = container.querySelector('#form-vending-indicator');

            if (badgeEl) {
                badgeEl.innerHTML = isVendingActive
                    ? `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.8rem; font-weight: 600;">⚡ Vending Mode Active (Stock Auto-deducts)</span>`
                    : `<span class="badge" style="background: rgba(100, 116, 139, 0.1); color: #64748b; font-size: 0.8rem;">Vending Off (No Stock Deduction)</span>`;
            }

            if (formVendingIndicator) {
                formVendingIndicator.innerHTML = isVendingActive
                    ? `<span style="color: #059669;">⚡ Vending Mode Active</span>`
                    : `<span style="color: var(--text-muted);">Vending Mode Off</span>`;
            }

            // Load products for dropdown and advanced picker
            allProducts = await productService.getAllActiveProducts();
            const prodSelect = container.querySelector('#inv-add-product-select');
            prodSelect.innerHTML = '<option value="">Select a product...</option>' + 
                allProducts.map(p => `<option value="${p.id}">${p.name} - $${p.salePrice} (Stock: ${p.quantity})</option>`).join('');

            // Load businesses
            allBusinesses = await peopleService.getAllBusinesses();
            const busSelect = container.querySelector('#inv-business');
            busSelect.innerHTML = '<option value="">Select Business...</option>' + 
                allBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

            if (isBusinessInvoice) {
                allClients = await peopleService.getAllClients();
                const cliSelect = container.querySelector('#inv-client');
                cliSelect.innerHTML = '<option value="">None</option>' + 
                    allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            } else {
                allCustomers = await peopleService.getAllCustomers();
                const custSelect = container.querySelector('#inv-customer');
                custSelect.innerHTML = '<option value="">Walk-in / None</option>' + 
                    allCustomers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                custSelect.addEventListener('change', (e) => {
                    const c = allCustomers.find(x => x.id === e.target.value);
                    if (c) {
                        container.querySelector('#inv-customer-name').value = c.name;
                        container.querySelector('#inv-customer-phone').value = c.phone || '';
                    } else {
                        container.querySelector('#inv-customer-name').value = '';
                        container.querySelector('#inv-customer-phone').value = '';
                    }
                });
            }

            renderSkeleton();

            // Realtime Invoice Listener
            if (container._invoiceUnsubscribe) {
                container._invoiceUnsubscribe();
            }
            
            container._invoiceUnsubscribe = invoiceService.listenInvoices(isBusinessInvoice, (invoices) => {
                rawInvoices = invoices;
                applyFiltersAndRender();
            });

            renderItemsList();
            updateLiveTotals();
        } catch (err) {
            console.error("loadData error:", err);
            showAlert.error("Failed to load invoice data.");
        }
    };

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

    // FORM OPEN / CLOSE EVENTS
    container.querySelector('#btn-add-invoice').addEventListener('click', () => {
        container.querySelector('#invoice-form').reset();
        invoiceItems = [];
        pickerSelections = {};
        pickerContainer.style.display = 'none';
        if (pickerToggleText) pickerToggleText.textContent = 'Open Advanced Product Picker';

        if (isBusinessInvoice) {
            // Auto generate random id BusInv-000000 to BusInv-999999 (editable)
            const busInvField = container.querySelector('#inv-bus-number');
            if (busInvField) busInvField.value = generateRandomBusInvId();
        } else {
            // Customer invoice = timestamp to inv number INV-Timestamp
            const custInvField = container.querySelector('#inv-cust-number');
            if (custInvField) custInvField.value = `INV-${Date.now()}`;
        }

        renderItemsList();
        updateLiveTotals();
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    container.querySelector('#inv-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
    });

    // Single item add
    container.querySelector('#inv-btn-add-item').addEventListener('click', () => {
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
            
            // reset add row
            container.querySelector('#inv-add-product-select').value = '';
            container.querySelector('#inv-add-qty').value = 1;
        }
    });

    // Adjustment input listeners
    ['inv-discount', 'inv-add-cut', 'inv-tax', 'inv-shipping'].forEach(id => {
        const el = container.querySelector('#' + id);
        if (el) {
            el.addEventListener('input', updateLiveTotals);
        }
    });

    // SAVE INVOICE HANDLER
    btnSubmit.addEventListener('click', async () => {
        try {
            if (invoiceItems.length === 0) {
                throw new Error("Please add at least one product to the invoice.");
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = "Saving...";

            const invoiceData = {
                isBusinessInvoice,
                discountPercent: parseFloat(container.querySelector('#inv-discount')?.value || 0),
                additionalCut: parseFloat(container.querySelector('#inv-add-cut')?.value || 0),
                taxPercent: parseFloat(container.querySelector('#inv-tax')?.value || 0),
                shippingCost: parseFloat(container.querySelector('#inv-shipping')?.value || 0),
                status: container.querySelector('#inv-status').value,
                note: container.querySelector('#inv-note')?.value || '',
                timestamp: Date.now()
            };

            // Shared Issuer Data
            const bSelect = container.querySelector('#inv-business');
            if (!bSelect.value) throw new Error("Please select the issuing Business.");
            
            const bus = allBusinesses.find(b => b.id === bSelect.value);
            invoiceData.businessId = bus.id;
            invoiceData.businessName = bus.name;
            invoiceData.businessAddress = bus.address;
            invoiceData.businessPhone = bus.phone;
            invoiceData.businessEmail = bus.email;

            if (isBusinessInvoice) {
                const cSelect = container.querySelector('#inv-client');
                if (cSelect.value) {
                    const cli = allClients.find(c => c.id === cSelect.value);
                    invoiceData.clientId = cli.id;
                    invoiceData.clientAddress = cli.address;
                    invoiceData.clientPhone = cli.phone;
                    invoiceData.clientEmail = cli.email;
                }

                invoiceData.title = container.querySelector('#inv-title')?.value || 'Business Invoice';
                
                // Business Invoice: BusInv-000000 to BusInv-999999 (editable)
                const busInvNum = container.querySelector('#inv-bus-number')?.value.trim();
                invoiceData.busInvNumber = busInvNum || generateRandomBusInvId();
                invoiceData.invoiceNumber = invoiceData.busInvNumber;

            } else {
                const cName = container.querySelector('#inv-customer-name').value.trim();
                if (!cName) throw new Error("Customer Name is required.");
                
                invoiceData.customerName = cName;
                invoiceData.customerNumber = container.querySelector('#inv-customer-phone').value.trim();
                
                // Customer Invoice: INV-<Timestamp>
                const custInvNum = container.querySelector('#inv-cust-number')?.value.trim();
                invoiceData.invoiceNumber = custInvNum || `INV-${Date.now()}`;
            }

            // Save via service with vending flag
            await invoiceService.createInvoice(invoiceData, invoiceItems, currentUser.uid, isVendingActive);

            showAlert.success(`Invoice ${invoiceData.invoiceNumber} created successfully! ${isVendingActive ? '(Stock deducted in Vending Mode)' : ''}`);
            formContainer.style.display = 'none';

            // Refresh data and active products inventory
            await loadData();

        } catch (err) {
            showAlert.error(err.message || "Failed to create invoice.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Save Invoice";
        }
    });

    loadData();
};
