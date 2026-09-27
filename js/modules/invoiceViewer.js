/**
 * PriceLister - Dedicated Invoice Viewer, Performance Analytics & PDF Template Selection Modal
 * Provides interactive real-time visual invoice preview, 4 app-themed red PDF templates,
 * deep financial performance intelligence (COGS, Net Profit, Margin %, Item-by-Item profit distribution),
 * flexible branding options (PriceLister, Workspace, Custom, White-label), and 1-click PDF download & WhatsApp sharing.
 */

import { generateInvoicePdf, downloadInvoicePdf, printInvoicePdf } from '../utils/invoicePdfEngine.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { showAlert } from '../alert-handler.js';

let currentInvoice = null;
let currentOptions = {
    template: 'MODERN_RED',
    brandingMode: 'WORKSPACE',
    currencySymbol: '$',
    customBranding: {
        title: '',
        subtitle: 'Commercial Invoice',
        phone: '',
        email: '',
        address: '',
        notes: ''
    }
};

/**
 * Open Dedicated Invoice Viewer Modal
 * @param {Object} invoice - Full invoice object
 * @param {Function} onEditCallback - Optional callback when user clicks "Edit Invoice"
 */
export const openInvoiceViewerModal = async (invoice, onEditCallback = null) => {
    if (!invoice) return;
    currentInvoice = invoice;
    currentOptions.currencySymbol = invoice.currency || getAppCurrencySymbol();
    
    // Set default custom branding values based on workspace
    if (window.__activeWorkspace) {
        currentOptions.customBranding.title = window.__activeWorkspace.name || invoice.businessName || '';
        currentOptions.customBranding.phone = window.__activeWorkspace.phone || invoice.businessPhone || '';
        currentOptions.customBranding.email = window.__activeWorkspace.email || invoice.businessEmail || '';
        currentOptions.customBranding.address = window.__activeWorkspace.address || invoice.businessAddress || '';
    }

    const existingModal = document.getElementById('invoice-viewer-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'invoice-viewer-modal-overlay';
    overlay.className = 'iv-modal-overlay';

    overlay.innerHTML = `
        <div class="iv-modal-card" role="dialog" aria-modal="true" aria-label="Invoice Viewer and PDF Exporter">
            <!-- Modal Header -->
            <div class="iv-modal-header">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="iv-modal-header-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </span>
                    <div>
                        <h3 class="iv-modal-title">Invoice Viewer & Performance</h3>
                        <span class="iv-modal-subtitle">Invoice #${escapeHtml(invoice.busInvNumber || invoice.invoiceNumber || invoice.id || 'INV-001')}</span>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <button type="button" id="iv-btn-share-whatsapp" class="btn btn-secondary" style="font-weight:600; padding:0.45rem 0.85rem; font-size:0.85rem; display:flex; align-items:center; gap:0.35rem;" title="Share Invoice via WhatsApp">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        WhatsApp
                    </button>
                    <button type="button" id="iv-btn-print-action" class="btn btn-secondary" style="font-weight:600; padding:0.45rem 0.85rem; font-size:0.85rem; display:flex; align-items:center; gap:0.35rem;" title="Print Invoice">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print
                    </button>
                    <button type="button" id="iv-btn-download-pdf" class="btn btn-primary" style="font-weight:700; padding:0.45rem 1.15rem; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem; background: linear-gradient(135deg, #ff3366 0%, #e11d48 55%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);" title="Download PDF File">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download PDF
                    </button>
                    <button type="button" id="iv-modal-close-btn" class="icon-btn" style="font-size:1.4rem; padding:0.25rem; margin-left:0.25rem; color:var(--text-secondary); cursor:pointer; background:none; border:none;" title="Close">✕</button>
                </div>
            </div>

            <!-- Modal Content (2 Columns) -->
            <div class="iv-modal-grid">
                
                <!-- LEFT COLUMN: LIVE PREVIEWS & FINANCIAL PERFORMANCE -->
                <div class="iv-preview-column">
                    <div class="iv-preview-toolbar">
                        <div class="iv-view-tabs">
                            <button type="button" class="iv-view-tab active" id="iv-tab-visual">Visual Preview</button>
                            <button type="button" class="iv-view-tab" id="iv-tab-perf">📊 Invoice Performance</button>
                            <button type="button" class="iv-view-tab" id="iv-tab-pdf">Live Vector PDF</button>
                        </div>
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">Real-time sync</span>
                    </div>

                    <!-- Visual Invoice Paper Sheet Container -->
                    <div class="iv-paper-scroll-wrapper" id="iv-paper-scroll-container">
                        <!-- Visual Sheet -->
                        <div class="iv-paper-sheet" id="iv-paper-sheet">
                            <!-- Injected live via updateVisualPreview() -->
                        </div>

                        <!-- Dedicated Financial Performance Container (Hidden by default) -->
                        <div class="iv-perf-sheet" id="iv-perf-sheet" style="display:none; padding:1.5rem; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                            <!-- Injected live via updatePerformanceView() -->
                        </div>

                        <!-- Embedded PDF Iframe (Hidden by default) -->
                        <iframe id="iv-pdf-iframe" class="iv-pdf-frame" style="display:none;" title="PDF Preview Frame"></iframe>
                    </div>
                </div>

                <!-- RIGHT COLUMN: TEMPLATE & BRANDING CONTROLS -->
                <div class="iv-controls-column">
                    
                    <!-- 1. TEMPLATE SELECTOR -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>1. Select PDF Template</span>
                            <span style="font-size:0.72rem; color:var(--primary); font-weight:600;">App Red Theme</span>
                        </label>
                        <div class="iv-templates-grid">
                            
                            <!-- Template 1: Modern Corporate Red -->
                            <div class="iv-template-card active" data-template="MODERN_RED">
                                <div class="iv-tmpl-preview-bar" style="background:#e11d48;"></div>
                                <div class="iv-tmpl-content">
                                    <div class="iv-tmpl-name">🔴 Modern Corporate Red</div>
                                    <div class="iv-tmpl-desc">Vercel/Stripe bold crimson header banner & highlighted totals block.</div>
                                </div>
                            </div>

                            <!-- Template 2: Minimalist Clean Luxury -->
                            <div class="iv-template-card" data-template="MINIMAL_LUXURY">
                                <div class="iv-tmpl-preview-bar" style="background:#cbd5e1; border-top: 2px solid #e11d48;"></div>
                                <div class="iv-tmpl-content">
                                    <div class="iv-tmpl-name">✨ Minimalist Clean Luxury</div>
                                    <div class="iv-tmpl-desc">Spacious fine borders, crimson dividers & high-end typography.</div>
                                </div>
                            </div>

                            <!-- Template 3: Executive Receipt Style -->
                            <div class="iv-template-card" data-template="EXECUTIVE_RECEIPT">
                                <div class="iv-tmpl-preview-bar" style="background:#475569; border-top: 2px dashed #e11d48;"></div>
                                <div class="iv-tmpl-content">
                                    <div class="iv-tmpl-name">🧾 Executive Receipt Style</div>
                                    <div class="iv-tmpl-desc">Classic receipt / POS format with dashed separators and centered brand.</div>
                                </div>
                            </div>

                            <!-- Template 4: Dark Header Elegance -->
                            <div class="iv-template-card" data-template="DARK_HEADER">
                                <div class="iv-tmpl-preview-bar" style="background:#0f172a; border-bottom: 2px solid #e11d48;"></div>
                                <div class="iv-tmpl-content">
                                    <div class="iv-tmpl-name">🖤 Dark Header Elegance</div>
                                    <div class="iv-tmpl-desc">Solid slate navy header with vibrant red badges & striped table.</div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- 2. BRANDING MODE -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">2. Branding & White-Labeling</label>
                        <div class="iv-branding-radio-group">
                            
                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="WORKSPACE" ${currentOptions.brandingMode === 'WORKSPACE' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.85rem; display:block;">🏷️ Workspace Store Branding</strong>
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">Use current workspace name, address, phone & currency.</span>
                                </div>
                            </label>

                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="PRICELISTER" ${currentOptions.brandingMode === 'PRICELISTER' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.85rem; display:block;">⭐ PriceLister Official Branding</strong>
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">Include PriceLister logo & official commercial header.</span>
                                </div>
                            </label>

                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="CUSTOM" ${currentOptions.brandingMode === 'CUSTOM' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.85rem; display:block;">✏️ Custom Company Branding</strong>
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">Specify custom title, custom address, phone, and tagline.</span>
                                </div>
                            </label>

                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="NONE" ${currentOptions.brandingMode === 'NONE' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.85rem; display:block;">🚫 White-Label (No Branding)</strong>
                                    <span style="font-size:0.75rem; color:var(--text-secondary);">Pure clean document with zero external platform logos.</span>
                                </div>
                            </label>

                        </div>

                        <!-- Custom Branding Inputs (Revealed when CUSTOM is checked) -->
                        <div id="iv-custom-branding-inputs" style="display:${currentOptions.brandingMode === 'CUSTOM' ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem; margin-top:0.75rem; padding:0.75rem; background:var(--surface-50); border:1px solid var(--border-color); border-radius:8px;">
                            <div>
                                <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Company / Store Title</label>
                                <input type="text" id="iv-custom-title" class="form-control" style="font-size:0.82rem; padding:0.4rem 0.6rem;" value="${escapeHtml(currentOptions.customBranding.title)}" placeholder="e.g. Apex Global Solutions">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Subtitle / Tagline</label>
                                <input type="text" id="iv-custom-subtitle" class="form-control" style="font-size:0.82rem; padding:0.4rem 0.6rem;" value="${escapeHtml(currentOptions.customBranding.subtitle)}" placeholder="e.g. Commercial Sales Invoice">
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                                <div>
                                    <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Phone</label>
                                    <input type="text" id="iv-custom-phone" class="form-control" style="font-size:0.82rem; padding:0.4rem 0.6rem;" value="${escapeHtml(currentOptions.customBranding.phone)}" placeholder="01700000000">
                                </div>
                                <div>
                                    <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Email</label>
                                    <input type="email" id="iv-custom-email" class="form-control" style="font-size:0.82rem; padding:0.4rem 0.6rem;" value="${escapeHtml(currentOptions.customBranding.email)}" placeholder="info@company.com">
                                </div>
                            </div>
                            <div>
                                <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Address / Location</label>
                                <input type="text" id="iv-custom-address" class="form-control" style="font-size:0.82rem; padding:0.4rem 0.6rem;" value="${escapeHtml(currentOptions.customBranding.address)}" placeholder="Dhaka, Bangladesh">
                            </div>
                        </div>
                    </div>

                    <!-- 3. NOTES & TERMS OVERRIDE -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">3. Custom Invoice Notes / Terms</label>
                        <textarea id="iv-custom-notes" rows="2" class="form-control" style="font-size:0.82rem; font-family:inherit; resize:vertical;" placeholder="Thank you for your business! Payment due within 7 days.">${escapeHtml(invoice.notes || '')}</textarea>
                    </div>

                    <!-- ACTION BUTTONS BAR -->
                    <div style="margin-top:auto; padding-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <button type="button" id="iv-btn-download-bottom" class="btn btn-primary" style="width:100%; padding:0.65rem; font-weight:700; font-size:0.92rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; background: linear-gradient(135deg, #ff3366 0%, #e11d48 55%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export & Download PDF
                        </button>

                        ${onEditCallback ? `
                            <button type="button" id="iv-btn-edit-invoice" class="btn btn-secondary" style="width:100%; padding:0.55rem; font-weight:600; font-size:0.85rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Edit Invoice Data
                            </button>
                        ` : ''}
                    </div>

                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Attach Event Listeners
    setupViewerEvents(invoice, onEditCallback);

    // Initial Visual Preview & Performance Render
    updateVisualPreview();
    updatePerformanceView();
};

/**
 * Dedicated Invoice Financial Performance & Profitability View
 */
const updatePerformanceView = () => {
    const perfContainer = document.getElementById('iv-perf-sheet');
    if (!perfContainer || !currentInvoice) return;

    const inv = currentInvoice;
    const items = Array.isArray(inv.items) ? inv.items : [];
    
    let totalRevenue = Number(inv.totalPrice || inv.grandTotal || 0);
    let subtotal = Number(inv.subtotal || 0);
    let totalCost = 0;
    let calculatedProfit = 0;
    let totalItemQuantity = 0;

    const itemPerformance = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
        const unitCost = Number(item.unitCost || 0);
        const lineRev = Number(item.totalPrice) || (qty * unitPrice);
        const lineCost = qty * unitCost;
        const lineProfit = (item.itemProfit !== undefined && item.itemProfit !== null)
            ? Number(item.itemProfit)
            : (lineRev - lineCost);
        const marginPct = lineRev > 0 ? ((lineProfit / lineRev) * 100) : 0;

        totalCost += lineCost;
        calculatedProfit += lineProfit;
        totalItemQuantity += qty;
        if (!subtotal) subtotal += lineRev;

        return {
            name: item.name || item.productName || 'Product',
            size: item.size || item.sizeWeight || '',
            qty,
            unitPrice,
            unitCost,
            lineRev,
            lineCost,
            lineProfit,
            marginPct
        };
    });

    if (!totalRevenue) totalRevenue = subtotal;
    const finalProfit = (inv.totalProfit !== undefined && inv.totalProfit !== null) 
        ? Number(inv.totalProfit) 
        : calculatedProfit;
    const marginPct = totalRevenue > 0 ? ((finalProfit / totalRevenue) * 100) : 0;

    let marginClass = 'margin-pill-great';
    let marginStatus = 'Excellent Margin';
    if (marginPct < 15) {
        marginClass = 'margin-pill-low';
        marginStatus = 'Low Margin';
    } else if (marginPct < 30) {
        marginClass = 'margin-pill-warning';
        marginStatus = 'Moderate Margin';
    } else if (marginPct < 50) {
        marginClass = 'margin-pill-good';
        marginStatus = 'Healthy Margin';
    }

    perfContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
            <div>
                <h3 style="margin:0 0 0.15rem 0; font-size:1.25rem; font-weight:800; color:#0f172a;">Invoice Financial Intelligence</h3>
                <p style="margin:0; font-size:0.8rem; color:#64748b;">Comprehensive profitability, COGS, and line-item margins</p>
            </div>
            <span class="margin-pill ${marginClass}">${marginStatus} (${Math.round(marginPct)}%)</span>
        </div>

        <!-- 4 KPI Metrics Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem; margin-bottom:1.5rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Gross Revenue</div>
                <div style="font-size:1.35rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${formatCurrency(totalRevenue, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">${totalItemQuantity} total units billed</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Total COGS (Cost)</div>
                <div style="font-size:1.35rem; font-weight:800; color:#64748b; margin-top:0.2rem;">${formatCurrency(totalCost, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Procurement cost</div>
            </div>

            <div style="background:rgba(225,29,72,0.04); border:1px solid rgba(225,29,72,0.2); border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#e11d48; text-transform:uppercase;">Net Gross Profit</div>
                <div style="font-size:1.35rem; font-weight:800; color:#e11d48; margin-top:0.2rem;">+${formatCurrency(finalProfit, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.75rem; color:#e11d48; font-weight:600;">${Math.round(marginPct)}% net margin</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.72rem; font-weight:700; color:#64748b; text-transform:uppercase;">Avg Item Price</div>
                <div style="font-size:1.35rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${formatCurrency(totalItemQuantity > 0 ? (totalRevenue / totalItemQuantity) : 0, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Per unit average</div>
            </div>
        </div>

        <!-- Profit Distribution Share Bar -->
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:1rem; margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem; font-size:0.82rem; font-weight:700; color:#0f172a;">
                <span>Profit Share by Product</span>
                <span style="color:#059669;">Total: +${formatCurrency(finalProfit, currentOptions.currencySymbol)}</span>
            </div>
            <div class="perf-bar-wrap" style="height:10px;">
                <div class="perf-bar-fill" style="width:100%;"></div>
            </div>
        </div>

        <!-- Itemized Margin Table -->
        <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700;">
                        <th style="padding:0.65rem 1rem;">Item Name</th>
                        <th style="padding:0.65rem; text-align:center;">Qty</th>
                        <th style="padding:0.65rem; text-align:right;">Unit Cost</th>
                        <th style="padding:0.65rem; text-align:right;">Sale Price</th>
                        <th style="padding:0.65rem; text-align:right;">Revenue</th>
                        <th style="padding:0.65rem 1rem; text-align:right;">Profit (Margin)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemPerformance.map((item, idx) => `
                        <tr style="border-bottom:1px solid #f1f5f9; background:${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                            <td style="padding:0.65rem 1rem;">
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.size ? `<span style="font-size:0.75rem; color:#94a3b8;"> (${escapeHtml(item.size)})</span>` : ''}
                            </td>
                            <td style="padding:0.65rem; text-align:center; font-weight:700;">${item.qty}</td>
                            <td style="padding:0.65rem; text-align:right; color:#64748b;">${formatCurrency(item.unitCost, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem; text-align:right; font-weight:600;">${formatCurrency(item.unitPrice, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem; text-align:right; font-weight:700;">${formatCurrency(item.lineRev, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem 1rem; text-align:right; font-weight:700; color:#059669;">
                                +${formatCurrency(item.lineProfit, currentOptions.currencySymbol)}
                                <span style="font-size:0.72rem; color:#64748b; font-weight:500;">(${Math.round(item.marginPct)}%)</span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

/**
 * Update the HTML Visual Preview sheet matching chosen options
 */
const updateVisualPreview = () => {
    const paper = document.getElementById('iv-paper-sheet');
    if (!paper || !currentInvoice) return;

    const inv = currentInvoice;
    const isBusiness = Boolean(inv.isBusiness || inv.busInvNumber || inv.clientName);
    const clientName = isBusiness 
        ? (inv.clientName || inv.customerName || 'B2B Client')
        : (inv.customerName || 'Walk-in Customer');
    const invNumber = inv.busInvNumber || inv.invoiceNumber || inv.id || 'INV-001';
    const invStatus = (inv.status || 'PAID').toUpperCase();

    // Resolve Brand
    let bTitle = 'PriceLister';
    let bSubtitle = 'Sales Invoice';
    let bPhone = '';
    let bEmail = '';
    let bAddress = '';

    if (currentOptions.brandingMode === 'WORKSPACE') {
        bTitle = inv.businessName || window.__activeWorkspace?.name || 'Your Business';
        bSubtitle = 'Sales Invoice';
        bPhone = inv.businessPhone || window.__activeWorkspace?.phone || '';
        bEmail = inv.businessEmail || window.__activeWorkspace?.email || '';
        bAddress = inv.businessAddress || window.__activeWorkspace?.address || '';
    } else if (currentOptions.brandingMode === 'PRICELISTER') {
        bTitle = 'PriceLister';
        bSubtitle = 'Official Commercial Invoice';
    } else if (currentOptions.brandingMode === 'CUSTOM') {
        bTitle = currentOptions.customBranding.title || 'Your Business';
        bSubtitle = currentOptions.customBranding.subtitle || 'Commercial Invoice';
        bPhone = currentOptions.customBranding.phone || '';
        bEmail = currentOptions.customBranding.email || '';
        bAddress = currentOptions.customBranding.address || '';
    } else if (currentOptions.brandingMode === 'NONE') {
        bTitle = inv.businessName || 'Invoice';
        bSubtitle = '';
    }

    const items = Array.isArray(inv.items) ? inv.items : [];
    const subtotal = Number(inv.subtotal || inv.totalPrice || 0);
    const discountPct = Number(inv.discountPercent || 0);
    const taxPct = Number(inv.taxPercent || 0);
    const shipping = Number(inv.shippingCost || 0);
    const grandTotal = Number(inv.totalPrice || inv.grandTotal || subtotal);

    const isPaid = invStatus === 'PAID';
    const statusBadgeClass = isPaid ? 'iv-badge-paid' : 'iv-badge-unpaid';

    let html = '';

    // TEMPLATE 1: MODERN CORPORATE RED
    if (currentOptions.template === 'MODERN_RED') {
        html = `
            <div class="iv-paper-header-strip" style="background:#e11d48; height:5px; margin:-1.5rem -1.5rem 1.25rem;"></div>
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem;">
                <div>
                    <h2 style="font-size:1.45rem; font-weight:800; color:#0f172a; margin:0 0 0.15rem 0;">${escapeHtml(bTitle)}</h2>
                    ${bSubtitle ? `<div style="font-size:0.75rem; font-weight:700; color:#e11d48; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtml(bSubtitle)}</div>` : ''}
                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.35rem;">
                        ${[bAddress, bPhone ? `Phone: ${bPhone}` : '', bEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                    </div>
                </div>

                <div style="text-align:right;">
                    <div style="font-size:1.5rem; font-weight:800; color:#e11d48; line-height:1;">INVOICE</div>
                    <div style="font-size:0.85rem; font-family:monospace; font-weight:700; color:#0f172a; margin-top:0.25rem;">#${escapeHtml(invNumber)}</div>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">Date: ${formatInvoiceDateClean(inv)}</div>
                    <div style="margin-top:0.35rem;">
                        <span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span>
                    </div>
                </div>
            </div>

            <!-- Billed To Box -->
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem 1rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; color:#e11d48; letter-spacing:0.05em;">BILLED TO</span>
                    <div style="font-weight:700; font-size:0.95rem; color:#0f172a; margin-top:0.15rem;">${escapeHtml(clientName)}</div>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.1rem;">
                        ${[inv.clientPhone || inv.customerNumber, inv.clientEmail, inv.clientAddress].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}
                    </div>
                </div>
                <div style="text-align:right; font-size:0.78rem; color:#64748b;">
                    <div><strong>Type:</strong> ${isBusiness ? 'B2B Wholesale' : 'Customer POS'}</div>
                    <div><strong>Payment:</strong> ${escapeHtml(invStatus)}</div>
                </div>
            </div>

            <!-- Table -->
            <table class="iv-preview-table">
                <thead>
                    <tr style="background:#e11d48; color:#ffffff;">
                        <th style="width:30px; text-align:center;">#</th>
                        <th>Item Description</th>
                        <th style="width:50px; text-align:center;">Qty</th>
                        <th style="width:90px; text-align:right;">Unit Price</th>
                        <th style="width:95px; text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => {
                        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const qty = item.quantity || 1;
                        return `
                            <tr>
                                <td style="text-align:center; color:#94a3b8;">${idx + 1}</td>
                                <td>
                                    <strong>${escapeHtml(item.name || item.productName || 'Product')}</strong>
                                    ${item.size || item.sizeWeight ? `<span style="font-size:0.75rem; color:#64748b;"> (${escapeHtml(item.size || item.sizeWeight)})</span>` : ''}
                                </td>
                                <td style="text-align:center;">${qty}</td>
                                <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <!-- Totals & Notes -->
            <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                <div style="flex:1;">
                    <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Notes & Terms:</span>
                    <p style="font-size:0.78rem; color:#64748b; margin-top:0.25rem; line-height:1.4;">
                        ${escapeHtml(inv.notes || currentOptions.customBranding.notes || 'Thank you for your business! Payment is due according to agreed billing terms.')}
                    </p>
                </div>

                <div style="width:220px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(subtotal, currentOptions.currencySymbol)}</span>
                    </div>
                    ${discountPct > 0 ? `
                        <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#059669; margin-bottom:0.35rem;">
                            <span>Discount (${discountPct}%):</span>
                            <span>-${formatCurrency((subtotal * discountPct) / 100, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    ${taxPct > 0 ? `
                        <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
                            <span>Tax (${taxPct}%):</span>
                            <span>+${formatCurrency((subtotal * taxPct) / 100, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    ${shipping > 0 ? `
                        <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
                            <span>Shipping:</span>
                            <span>+${formatCurrency(shipping, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:1.05rem; font-weight:800; color:#e11d48; border-top:1px solid #e11d48; padding-top:0.5rem; margin-top:0.35rem;">
                        <span>Grand Total:</span>
                        <span>${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // TEMPLATE 2: MINIMALIST CLEAN LUXURY
    else if (currentOptions.template === 'MINIMAL_LUXURY') {
        html = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; padding-bottom:1rem; border-bottom:2px solid #e11d48;">
                <div>
                    <h2 style="font-size:1.35rem; font-weight:700; color:#0f172a; margin:0;">${escapeHtml(bTitle)}</h2>
                    <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">${[bAddress, bPhone].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.15rem; font-weight:800; color:#e11d48;">INVOICE #${escapeHtml(invNumber)}</div>
                    <div style="font-size:0.78rem; color:#64748b;">Issued: ${formatInvoiceDateClean(inv)}</div>
                </div>
            </div>

            <div style="margin-bottom:1.5rem;">
                <span style="font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase;">CLIENT RECIPIENT</span>
                <div style="font-size:0.95rem; font-weight:700; color:#0f172a; margin-top:0.15rem;">${escapeHtml(clientName)}</div>
                <div style="font-size:0.78rem; color:#64748b;">${[inv.clientPhone || inv.customerNumber, inv.clientEmail, inv.clientAddress].filter(Boolean).map(escapeHtml).join(' | ') || 'Customer Direct'}</div>
            </div>

            <table class="iv-preview-table" style="border:none;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:1px solid #cbd5e1; color:#0f172a;">
                        <th>ITEM</th>
                        <th style="width:50px; text-align:center;">QTY</th>
                        <th style="width:90px; text-align:right;">PRICE</th>
                        <th style="width:95px; text-align:right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const qty = item.quantity || 1;
                        return `
                            <tr style="border-bottom:1px solid #f1f5f9;">
                                <td><strong>${escapeHtml(item.name || item.productName || 'Product')}</strong> ${item.size || item.sizeWeight ? `<span style="font-size:0.75rem; color:#64748b;">(${escapeHtml(item.size || item.sizeWeight)})</span>` : ''}</td>
                                <td style="text-align:center;">${qty}</td>
                                <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">
                <div style="width:200px;">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#64748b; margin-bottom:0.35rem;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(subtotal, currentOptions.currencySymbol)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:1.05rem; font-weight:800; color:#0f172a; border-top:1px solid #0f172a; padding-top:0.5rem;">
                        <span>Total:</span>
                        <span style="color:#e11d48;">${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // TEMPLATE 3: EXECUTIVE RECEIPT
    else if (currentOptions.template === 'EXECUTIVE_RECEIPT') {
        html = `
            <div style="text-align:center; margin-bottom:1rem; padding-bottom:0.75rem; border-bottom:2px dashed #0f172a;">
                <h2 style="font-size:1.35rem; font-weight:800; color:#0f172a; margin:0; text-transform:uppercase;">${escapeHtml(bTitle)}</h2>
                <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">${[bAddress, bPhone].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                <div style="font-size:0.85rem; font-weight:700; margin-top:0.35rem;">RECEIPT #${escapeHtml(invNumber)}</div>
                <div style="font-size:0.75rem; color:#64748b;">${formatInvoiceDateClean(inv)} • Customer: ${escapeHtml(clientName)}</div>
            </div>

            <table class="iv-preview-table" style="border:none; font-size:0.8rem;">
                <thead>
                    <tr style="background:#f1f5f9; color:#0f172a;">
                        <th>ITEM</th>
                        <th style="width:40px; text-align:center;">QTY</th>
                        <th style="width:75px; text-align:right;">PRICE</th>
                        <th style="width:80px; text-align:right;">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const qty = item.quantity || 1;
                        return `
                            <tr>
                                <td>${escapeHtml(item.name || item.productName || 'Product')}</td>
                                <td style="text-align:center;">${qty}</td>
                                <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="border-top:1px dashed #0f172a; margin-top:1rem; padding-top:0.75rem; display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; color:#0f172a;">
                <span>GRAND TOTAL:</span>
                <span style="color:#e11d48;">${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
            </div>
        `;
    }

    // TEMPLATE 4: DARK HEADER ELEGANCE
    else {
        html = `
            <div style="background:#0f172a; color:#ffffff; padding:1.25rem; margin:-1.5rem -1.5rem 1.25rem; border-bottom:3px solid #e11d48; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size:1.35rem; font-weight:800; margin:0; color:#ffffff;">${escapeHtml(bTitle)}</h2>
                    <div style="font-size:0.75rem; color:#94a3b8; margin-top:0.2rem;">${[bAddress, bPhone].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:1.3rem; font-weight:800; color:#ffffff;">INVOICE</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">#${escapeHtml(invNumber)} • ${formatInvoiceDateClean(inv)}</div>
                </div>
            </div>

            <div style="margin-bottom:1.25rem; display:flex; justify-content:space-between; font-size:0.82rem;">
                <div>
                    <strong style="color:#e11d48; text-transform:uppercase; font-size:0.72rem;">BILLED TO:</strong>
                    <div style="font-size:0.95rem; font-weight:700; color:#0f172a;">${escapeHtml(clientName)}</div>
                </div>
                <div>
                    <span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span>
                </div>
            </div>

            <table class="iv-preview-table">
                <thead>
                    <tr style="background:#0f172a; color:#ffffff;">
                        <th style="width:30px; text-align:center;">#</th>
                        <th>Product Description</th>
                        <th style="width:50px; text-align:center;">Qty</th>
                        <th style="width:90px; text-align:right;">Price</th>
                        <th style="width:95px; text-align:right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, idx) => {
                        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const qty = item.quantity || 1;
                        return `
                            <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                <td style="text-align:center; color:#94a3b8;">${idx + 1}</td>
                                <td><strong>${escapeHtml(item.name || item.productName || 'Product')}</strong></td>
                                <td style="text-align:center;">${qty}</td>
                                <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div style="display:flex; justify-content:flex-end; margin-top:1.5rem;">
                <div style="width:220px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem;">
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#64748b; margin-bottom:0.35rem;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(subtotal, currentOptions.currencySymbol)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; color:#0f172a; border-top:1px solid #e11d48; padding-top:0.5rem; margin-top:0.35rem;">
                        <span>Grand Total:</span>
                        <span style="color:#e11d48;">${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    paper.innerHTML = html;
};

/**
 * Setup Event Listeners in Modal
 */
const setupViewerEvents = (invoice, onEditCallback) => {
    const overlay = document.getElementById('invoice-viewer-modal-overlay');
    const closeBtn = document.getElementById('iv-modal-close-btn');
    const btnDownloadTop = document.getElementById('iv-btn-download-pdf');
    const btnDownloadBottom = document.getElementById('iv-btn-download-bottom');
    const btnPrint = document.getElementById('iv-btn-print-action');
    const btnShareWhatsApp = document.getElementById('iv-btn-share-whatsapp');
    const btnEdit = document.getElementById('iv-btn-edit-invoice');

    // Close
    if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    // WhatsApp Sharing Handler
    if (btnShareWhatsApp) {
        btnShareWhatsApp.addEventListener('click', () => {
            const clientName = invoice.customerName || invoice.clientName || 'Valued Customer';
            const invNumber = invoice.busInvNumber || invoice.invoiceNumber || 'INV';
            const total = formatCurrency(invoice.totalPrice || invoice.grandTotal || 0, currentOptions.currencySymbol);
            const msg = `Hello ${clientName}, here are the details for your Invoice #${invNumber}. Grand Total: ${total}. Thank you for your business!`;
            const phone = (invoice.customerNumber || invoice.clientPhone || '').replace(/[^0-9]/g, '');
            const waUrl = phone 
                ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
                : `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    // Template Cards Selection
    document.querySelectorAll('.iv-template-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.iv-template-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentOptions.template = card.getAttribute('data-template') || 'MODERN_RED';
            updateVisualPreview();
            updatePdfIframeIfActive();
        });
    });

    // Branding Radio Selection
    document.querySelectorAll('input[name="iv-branding-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            currentOptions.brandingMode = radio.value;
            const customBox = document.getElementById('iv-custom-branding-inputs');
            if (customBox) {
                customBox.style.display = radio.value === 'CUSTOM' ? 'flex' : 'none';
            }
            updateVisualPreview();
            updatePdfIframeIfActive();
        });
    });

    // Custom Branding Inputs live sync
    const bindInput = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                currentOptions.customBranding[key] = e.target.value;
                updateVisualPreview();
            });
        }
    };

    bindInput('iv-custom-title', 'title');
    bindInput('iv-custom-subtitle', 'subtitle');
    bindInput('iv-custom-phone', 'phone');
    bindInput('iv-custom-email', 'email');
    bindInput('iv-custom-address', 'address');

    const notesEl = document.getElementById('iv-custom-notes');
    if (notesEl) {
        notesEl.addEventListener('input', (e) => {
            currentOptions.customBranding.notes = e.target.value;
            invoice.notes = e.target.value;
            updateVisualPreview();
        });
    }

    // Download PDF Action
    const handleDownload = async () => {
        try {
            showAlert.info("Generating high-resolution PDF...");
            await downloadInvoicePdf(invoice, currentOptions);
            showAlert.success("Invoice PDF downloaded successfully!");
        } catch (err) {
            console.error("PDF generation failed:", err);
            showAlert.error("Failed to generate PDF. Please try again.");
        }
    };

    if (btnDownloadTop) btnDownloadTop.addEventListener('click', handleDownload);
    if (btnDownloadBottom) btnDownloadBottom.addEventListener('click', handleDownload);

    // Print Action
    if (btnPrint) {
        btnPrint.addEventListener('click', async () => {
            try {
                await printInvoicePdf(invoice, currentOptions);
            } catch (err) {
                console.error("Print failed:", err);
                showAlert.error("Failed to print invoice.");
            }
        });
    }

    // Edit Action
    if (btnEdit && onEditCallback) {
        btnEdit.addEventListener('click', () => {
            overlay.remove();
            onEditCallback(invoice);
        });
    }

    // View Tabs (Visual vs Performance vs Live PDF Iframe)
    const tabVisual = document.getElementById('iv-tab-visual');
    const tabPerf = document.getElementById('iv-tab-perf');
    const tabPdf = document.getElementById('iv-tab-pdf');
    const paperSheet = document.getElementById('iv-paper-sheet');
    const perfSheet = document.getElementById('iv-perf-sheet');
    const pdfFrame = document.getElementById('iv-pdf-iframe');

    const switchTab = (activeTabEl) => {
        [tabVisual, tabPerf, tabPdf].forEach(t => t?.classList.remove('active'));
        activeTabEl.classList.add('active');
        if (paperSheet) paperSheet.style.display = 'none';
        if (perfSheet) perfSheet.style.display = 'none';
        if (pdfFrame) pdfFrame.style.display = 'none';
    };

    if (tabVisual) {
        tabVisual.addEventListener('click', () => {
            switchTab(tabVisual);
            if (paperSheet) paperSheet.style.display = 'block';
        });
    }

    if (tabPerf) {
        tabPerf.addEventListener('click', () => {
            switchTab(tabPerf);
            updatePerformanceView();
            if (perfSheet) perfSheet.style.display = 'block';
        });
    }

    if (tabPdf) {
        tabPdf.addEventListener('click', async () => {
            switchTab(tabPdf);
            if (pdfFrame) {
                pdfFrame.style.display = 'block';
                const { dataUri } = await generateInvoicePdf(invoice, currentOptions);
                pdfFrame.src = dataUri;
            }
        });
    }
};

const updatePdfIframeIfActive = async () => {
    const tabPdf = document.getElementById('iv-tab-pdf');
    const pdfFrame = document.getElementById('iv-pdf-iframe');
    if (tabPdf && tabPdf.classList.contains('active') && pdfFrame && currentInvoice) {
        const { dataUri } = await generateInvoicePdf(currentInvoice, currentOptions);
        pdfFrame.src = dataUri;
    }
};

const formatInvoiceDateClean = (inv) => {
    const timestamp = inv.timestamp || inv.createdAt;
    if (!timestamp) return new Date().toLocaleDateString();
    let d;
    if (typeof timestamp === 'number') d = new Date(timestamp);
    else if (timestamp && typeof timestamp.toDate === 'function') d = timestamp.toDate();
    else if (typeof timestamp === 'string') d = new Date(timestamp);
    else d = new Date();
    return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
