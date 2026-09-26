import { getInvoiceService } from '../services/invoiceService.js';
import { getProductService } from '../services/productService.js';
import { getPeopleService } from '../services/peopleService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { toggleContextPanel } from '../workspace.js';

export const renderInvoices = async (container, workspaceId, isBusinessInvoice) => {
    const invoiceService = getInvoiceService(workspaceId);
    const productService = getProductService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    const typeLabel = isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice';
    
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>${typeLabel}s</h2>
            <button id="btn-add-invoice" class="btn btn-primary">Create ${typeLabel}</button>
        </div>
        
        <!-- INVOICE FORM -->
        <div id="invoice-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem;">
            <h3 id="inv-form-title">New ${typeLabel}</h3>
            <form id="invoice-form" style="display:flex; flex-direction:column; gap:1.5rem; margin-top: 1rem;">
                
                <!-- Shared Issuer Section -->
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 1 — ISSUER (YOUR BUSINESS)</h4>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:1;">
                            <label>Select Business *</label>
                            <select id="inv-business" class="form-control" style="width:100%; padding:0.5rem;" required>
                                <option value="">Loading...</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${isBusinessInvoice ? `
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 2 — BILLED TO (CLIENT BUSINESS)</h4>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:1;">
                            <label>Select Client</label>
                            <select id="inv-client" class="form-control" style="width:100%; padding:0.5rem;">
                                <option value="">None</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 3 — BUSINESS INVOICE INFO</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Title</label>
                            <input type="text" id="inv-title" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Business Invoice Number</label>
                            <input type="text" id="inv-bus-number" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>
                ` : `
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 2 — BILLED TO (CUSTOMER)</h4>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:1;">
                            <label>Select Customer</label>
                            <select id="inv-customer" class="form-control" style="width:100%; padding:0.5rem;">
                                <option value="">Walk-in / None</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label>Or Customer Name *</label>
                            <input type="text" id="inv-customer-name" required class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Customer Phone</label>
                            <input type="text" id="inv-customer-phone" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>
                `}

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION ${isBusinessInvoice ? '4' : '2'} — PRODUCTS</h4>
                    <div id="invoice-items-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom:1rem;">
                        <!-- dynamic items go here -->
                    </div>
                    <div style="display:flex; gap:1rem; align-items:flex-end;">
                        <div style="flex:2;">
                            <label>Product</label>
                            <select id="inv-add-product-select" class="form-control" style="width:100%; padding:0.5rem;">
                                <option value="">Loading products...</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label>Qty</label>
                            <input type="number" id="inv-add-qty" min="1" value="1" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <button type="button" id="inv-btn-add-item" class="btn btn-secondary" style="padding:0.5rem 1rem;">Add to Invoice</button>
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION ${isBusinessInvoice ? '5' : '3'} — ${isBusinessInvoice ? 'BUSINESS CHARGES' : 'ADJUSTMENTS'}</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Discount %</label>
                            <input type="number" id="inv-discount" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Additional Cut ($)</label>
                        </div>
                        ${isBusinessInvoice ? `
                        <div style="flex:1;">
                            <label>Tax %</label>
                            <input type="number" id="inv-tax" value="0" min="0" max="100" step="0.01" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Shipping Cost ($)</label>
                            <input type="number" id="inv-shipping" value="0" min="0" step="0.01" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION ${isBusinessInvoice ? '6' : '4'} — PAYMENT</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1; max-width: 200px;">
                            <label>Status</label>
                            <select id="inv-status" class="form-control" style="width:100%; padding:0.5rem;">
                                <option value="UNPAID">Unpaid</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </div>
                    </div>
                </div>

                ${isBusinessInvoice ? `
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 7 — NOTE</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Note</label>
                            <textarea id="inv-note" class="form-control" style="width:100%; padding:0.5rem;"></textarea>
                        </div>
                    </div>
                </div>
                ` : ''}

                <div class="form-section" style="background:var(--bg-light); padding:1rem; border-radius:var(--radius-md);">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION ${isBusinessInvoice ? '8' : '5'} — TOTALS</h4>
                    <div id="inv-live-totals" style="font-size:1.1rem; line-height:1.5;">
                        <!-- live totals -->
                    </div>
                </div>

                <div style="display:flex; gap:1rem; margin-top:1rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <button type="button" class="btn btn-primary" id="inv-submit-btn">Save Invoice</button>
                    <button type="button" class="btn btn-secondary" id="inv-cancel-btn">Cancel</button>
                </div>
            </form>
        </div>
        
        <div class="table-container">
            <table style="width:100%; border-collapse: collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                        <th style="padding:1rem;">Invoice #</th>
                        <th style="padding:1rem;">Date</th>
                        <th style="padding:1rem;">${isBusinessInvoice ? 'Business' : 'Customer'}</th>
                        <th style="padding:1rem;">Status</th>
                        <th style="padding:1rem;">Total</th>
                        <th style="padding:1rem;">Actions</th>
                    </tr>
                </thead>
                <tbody id="invoice-list-body">
                    <tr><td colspan="6" style="padding:1rem; text-align:center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    // References
    const formContainer = document.getElementById('invoice-form-container');
    const tbody = document.getElementById('invoice-list-body');
    const itemsListEl = document.getElementById('invoice-items-list');
    const btnSubmit = document.getElementById('inv-submit-btn');

    let allProducts = [];
    let allCustomers = [];
    let allBusinesses = [];
    let allClients = [];
    let invoiceItems = []; // current items being added
    
    // Calculate live totals
    const updateLiveTotals = () => {
        const dPct = parseFloat(document.getElementById('inv-discount')?.value || 0);
        const addCut = parseFloat(document.getElementById('inv-add-cut')?.value || 0);
        const tPct = parseFloat(document.getElementById('inv-tax')?.value || 0);
        const ship = parseFloat(document.getElementById('inv-shipping')?.value || 0);

        const totals = calculateInvoiceTotal(invoiceItems, dPct, addCut, tPct, ship);

        document.getElementById('inv-live-totals').innerHTML = `
            <div>Subtotal: $${totals.subtotal.toFixed(2)}</div>
            ${dPct > 0 ? `<div style="color:red;">Discount (${dPct}%): -$${(totals.subtotal * (dPct/100)).toFixed(2)}</div>` : ''}
            ${addCut > 0 ? `<div style="color:red;">Additional Cut: -$${addCut.toFixed(2)}</div>` : ''}
            ${tPct > 0 ? `<div>Tax (${tPct}%): +$${((totals.subtotal - (totals.subtotal * (dPct/100)) - addCut) * (tPct/100)).toFixed(2)}</div>` : ''}
            ${ship > 0 ? `<div>Shipping: +$${ship.toFixed(2)}</div>` : ''}
            <div style="font-weight:bold; font-size:1.25rem; margin-top:0.5rem; border-top:1px solid #ccc; padding-top:0.5rem;">Grand Total: $${totals.grandTotal.toFixed(2)}</div>
            <div style="font-size:0.9rem; color:var(--text-muted);">Total Profit: $${totals.totalProfit.toFixed(2)}</div>
        `;
    };

    const renderItemsList = () => {
        if (invoiceItems.length === 0) {
            itemsListEl.innerHTML = '<span style="color:var(--text-muted);">No items added yet.</span>';
        } else {
            itemsListEl.innerHTML = invoiceItems.map((item, idx) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:var(--bg-light); border:1px solid var(--border-color); border-radius:4px;">
                    <div>
                        <strong>${item.productName}</strong> x ${item.quantity}
                        <div style="font-size:0.85rem; color:var(--text-muted);">@ $${item.unitPrice.toFixed(2)} each</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <strong>$${(item.quantity * item.unitPrice).toFixed(2)}</strong>
                        <button type="button" class="btn btn-sm btn-outline rem-item" data-idx="${idx}">&times;</button>
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('.rem-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = e.target.getAttribute('data-idx');
                    invoiceItems.splice(idx, 1);
                    renderItemsList();
                    updateLiveTotals();
                });
            });
        }
    };

    const loadData = async () => {
        try {
            // Load products for dropdown
            allProducts = await productService.getAllActiveProducts();
            const prodSelect = document.getElementById('inv-add-product-select');
            prodSelect.innerHTML = '<option value="">Select a product...</option>' + 
                allProducts.map(p => `<option value="${p.id}">${p.name} - $${p.salePrice}</option>`).join('');

            // Load businesses for BOTH since it's now shared
            allBusinesses = await peopleService.getAllBusinesses();
            const busSelect = document.getElementById('inv-business');
            busSelect.innerHTML = '<option value="">Select Business...</option>' + 
                allBusinesses.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

            if (isBusinessInvoice) {
                allClients = await peopleService.getAllClients();
                const cliSelect = document.getElementById('inv-client');
                cliSelect.innerHTML = '<option value="">None</option>' + 
                    allClients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            } else {
                allCustomers = await peopleService.getAllCustomers();
                const custSelect = document.getElementById('inv-customer');
                custSelect.innerHTML = '<option value="">Walk-in / None</option>' + 
                    allCustomers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

                custSelect.addEventListener('change', (e) => {
                    const c = allCustomers.find(x => x.id === e.target.value);
                    if (c) {
                        document.getElementById('inv-customer-name').value = c.name;
                        document.getElementById('inv-customer-phone').value = c.phone || '';
                    } else {
                        document.getElementById('inv-customer-name').value = '';
                        document.getElementById('inv-customer-phone').value = '';
                    }
                });
            }

            // Realtime Invoice Listener
            if (container._invoiceUnsubscribe) {
                container._invoiceUnsubscribe();
            }
            
            container._invoiceUnsubscribe = invoiceService.listenInvoices(isBusinessInvoice, (invoices) => {
                if (invoices.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" style="padding:1rem; text-align:center; color:var(--text-muted);">No invoices found.</td></tr>`;
                } else {
                    // Sort by newest first
                    invoices.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    
                    tbody.innerHTML = invoices.map(inv => {
                        const stat = (inv.status || 'DRAFT').toUpperCase();
                        let statBg = 'rgba(244, 67, 54, 0.15)'; // default Red (UNPAID)
                        let statCol = '#f44336';
                        if (stat === 'PAID') { 
                            statBg = 'rgba(76, 175, 80, 0.15)'; 
                            statCol = '#4CAF50'; // Green
                        } else if (stat === 'DRAFT') { 
                            statBg = 'rgba(158, 158, 158, 0.15)'; 
                            statCol = '#9e9e9e'; // Gray
                        }
                        
                        return `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding:1rem;"><strong>${inv.uniqueId}</strong></td>
                            <td style="padding:1rem;">${new Date(inv.timestamp).toLocaleDateString()}</td>
                            <td style="padding:1rem;">${isBusinessInvoice ? (inv.businessName || 'Business') : (inv.customerName || 'Customer')}</td>
                            <td style="padding:1rem;">
                                <div style="display: inline-flex; align-items: center; justify-content: center; min-width: 70px; padding: 0 8px; height: 28px; border-radius: 4px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; background: ${statBg}; color: ${statCol}; border: 1px solid ${statCol};">
                                    ${inv.status || 'DRAFT'}
                                </div>
                            </td>
                            <td style="padding:1rem;"><strong>$${Number(inv.totalPrice).toFixed(2)}</strong></td>
                            <td style="padding:1rem;">
                                <button class="btn btn-sm btn-outline view-inv" data-id="${inv.id}">View</button>
                                <button class="btn btn-sm btn-outline edit-inv" data-id="${inv.id}">Edit</button>
                                <button class="btn btn-sm btn-outline arch-inv" data-id="${inv.id}">Archive</button>
                            </td>
                        </tr>
                        `;
                    }).join('');

                    // Re-attach list events inside the listener!
                    document.querySelectorAll('.view-inv').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const id = e.target.getAttribute('data-id');
                            const inv = invoices.find(i => i.id === id);
                            if (inv) {
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
                                                <div style="font-size:0.75rem; text-transform:uppercase; font-weight:600; color:var(--text-muted); letter-spacing:0.5px;">Invoice ID</div>
                                                <div style="font-weight:700; font-size:1.15rem; font-family:monospace; color:var(--primary); margin-top:0.25rem;">${inv.uniqueId}</div>
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
                                            <div style="display: inline-flex; align-items: center; justify-content: center; padding: 0.25rem 0.75rem; margin-top:1rem; border-radius: 4px; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.5px; background: ${inv.status === 'PAID' ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)'}; color: ${inv.status === 'PAID' ? '#4CAF50' : '#f44336'}; border: 1px solid ${inv.status === 'PAID' ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'};">
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

                    document.querySelectorAll('.edit-inv').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            showAlert.info("Invoice editing is coming in the next update. For now, you can archive it and create a new one.");
                        });
                    });

                    document.querySelectorAll('.arch-inv').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            if (await showAlert.confirm('Archive invoice?')) {
                                const id = e.target.getAttribute('data-id');
                                await invoiceService.archiveInvoice(id);
                            }
                        });
                    });
                }
            });


            renderItemsList();
            updateLiveTotals();
        } catch (err) {
            showAlert.error("Failed to load invoices.");
        }
    };

    // Events
    document.getElementById('btn-add-invoice').addEventListener('click', () => {
        document.getElementById('invoice-form').reset();
        invoiceItems = [];
        renderItemsList();
        updateLiveTotals();
        formContainer.style.display = 'block';
    });

    document.getElementById('inv-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
    });

    document.getElementById('inv-btn-add-item').addEventListener('click', () => {
        const prodId = document.getElementById('inv-add-product-select').value;
        const qty = parseInt(document.getElementById('inv-add-qty').value, 10);

        if (!prodId || qty <= 0) return;

        const product = allProducts.find(p => p.id === prodId);
        if (product) {
            invoiceItems.push({
                productId: product.id,
                productName: product.name,
                quantity: qty,
                unitPrice: product.salePrice,
                unitCost: product.price || 0
            });
            renderItemsList();
            updateLiveTotals();
            
            // reset add row
            document.getElementById('inv-add-product-select').value = '';
            document.getElementById('inv-add-qty').value = 1;
        }
    });

    // Listen to changes in adjustment fields to update live totals
    ['inv-discount', 'inv-add-cut', 'inv-tax', 'inv-shipping'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateLiveTotals);
        }
    });

    btnSubmit.addEventListener('click', async () => {
        try {
            btnSubmit.disabled = true;

            const invoiceData = {
                isBusinessInvoice,
                discountPercent: parseFloat(document.getElementById('inv-discount')?.value || 0),
                additionalCut: parseFloat(document.getElementById('inv-add-cut')?.value || 0),
                taxPercent: parseFloat(document.getElementById('inv-tax')?.value || 0),
                shippingCost: parseFloat(document.getElementById('inv-shipping')?.value || 0),
                status: document.getElementById('inv-status').value,
                note: document.getElementById('inv-note')?.value || ''
            };

            // Shared Issuer Data
            const bSelect = document.getElementById('inv-business');
            if (!bSelect.value) throw new Error("Please select the issuing Business.");
            
            const bus = allBusinesses.find(b => b.id === bSelect.value);
            invoiceData.businessId = bus.id;
            invoiceData.businessName = bus.name;
            invoiceData.businessAddress = bus.address;
            invoiceData.businessPhone = bus.phone;
            invoiceData.businessEmail = bus.email;

            if (isBusinessInvoice) {
                const cSelect = document.getElementById('inv-client');
                if (cSelect.value) {
                    const cli = allClients.find(c => c.id === cSelect.value);
                    invoiceData.clientId = cli.id;
                    invoiceData.clientAddress = cli.address;
                    invoiceData.clientPhone = cli.phone;
                    invoiceData.clientEmail = cli.email;
                }

                invoiceData.title = document.getElementById('inv-title').value;
                invoiceData.busInvNumber = document.getElementById('inv-bus-number').value;

            } else {
                const cName = document.getElementById('inv-customer-name').value;
                if (!cName) throw new Error("Customer Name is required.");
                
                invoiceData.customerName = cName;
                invoiceData.customerNumber = document.getElementById('inv-customer-phone').value;
                
                // If a known customer was selected from dropdown, we could link ID here in the future
                // Android source primarily uses name/number directly in invoice, but linking is good practice.
            }

            await invoiceService.createInvoice(invoiceData, invoiceItems, currentUser.uid);
            showAlert.success("Invoice saved!");
            formContainer.style.display = 'none';
            loadData();

        } catch (err) {
            showAlert.error(err.message);
        } finally {
            btnSubmit.disabled = false;
        }
    });

    loadData();
};
