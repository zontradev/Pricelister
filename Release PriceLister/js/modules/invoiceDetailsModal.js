/**
 * PriceLister - Dedicated Invoice View Panel & Comprehensive Details Modal
 * Displays complete invoice billing, recipient details, issuer business profile,
 * multi-column line items, financial deductions & tax reconciliation,
 * executive profitability intelligence, and seamless 1-click PDF export actions.
 */

import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { showAlert } from '../alert-handler.js';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDateDisplay(inv) {
    if (!inv) return 'N/A';
    const ts = inv.timestamp || inv.createdAt || inv.updatedTimestamp;
    if (!ts) return 'N/A';
    let dateObj;
    if (typeof ts === 'number') {
        dateObj = new Date(ts);
    } else if (typeof ts === 'string') {
        dateObj = new Date(ts);
    } else if (ts && typeof ts.toDate === 'function') {
        dateObj = ts.toDate();
    } else {
        dateObj = new Date(ts);
    }
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Open Dedicated Invoice Details View Modal
 * @param {Object} invoice - Invoice data object
 * @param {Object} options - { onEdit, allBusinesses, allCustomers, allClients }
 */
export const openInvoiceDetailsModal = (invoice, options = {}) => {
    if (!invoice) return;

    const existingModal = document.getElementById('invoice-details-view-modal-overlay');
    if (existingModal) existingModal.remove();

    const isBusinessInvoice = Boolean(invoice.isBusinessInvoice);
    const isPaid = (invoice.status || 'Paid').toUpperCase() === 'PAID';
    const displayInvNumber = invoice.busInvNumber || invoice.invoiceNumber || invoice.uniqueId || invoice.id || 'INV-001';
    
    // Resolve Issuer Business
    const busName = invoice.businessName || window.__activeWorkspace?.name || 'Your Business';
    const busPhone = invoice.businessPhone || window.__activeWorkspace?.phone || '';
    const busEmail = invoice.businessEmail || window.__activeWorkspace?.email || '';
    const busAddress = invoice.businessAddress || window.__activeWorkspace?.address || '';
    const busImage = invoice.businessImageUrl || '';

    // Resolve Recipient (Customer or Client)
    const custName = invoice.customerName || invoice.clientName || 'Walk-in Customer';
    const custPhone = invoice.customerNumber || invoice.clientPhone || '';
    const custEmail = invoice.clientEmail || invoice.customerEmail || '';
    const custAddress = invoice.clientAddress || invoice.customerAddress || '';
    const custImage = invoice.customerImageUrl || invoice.clientImageUrl || '';
    const isClientRecipient = Boolean(invoice.clientId || invoice.clientEmail || invoice.clientAddress);

    // Items calculation
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    let itemsSubtotal = 0;
    let totalCOGS = 0;
    let totalProfit = 0;

    const formattedItems = items.map((item, idx) => {
        const qty = Number(item.quantity) || 1;
        const uPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
        const uCost = Number(item.unitCost || item.cost || item.price || 0);
        const lineTotal = Number(item.totalPrice) || (qty * uPrice);
        const lineCost = qty * uCost;
        const profit = (item.itemProfit !== undefined && item.itemProfit !== null) 
            ? Number(item.itemProfit) 
            : (lineTotal - lineCost);

        itemsSubtotal += lineTotal;
        totalCOGS += lineCost;
        totalProfit += profit;

        return {
            index: idx + 1,
            name: item.name || item.productName || 'Item',
            sizeWeight: item.sizeWeight || '',
            qty: qty,
            unitPrice: uPrice,
            unitCost: uCost,
            lineTotal: lineTotal,
            profit: profit
        };
    });

    const dPct = parseFloat(invoice.discountPercent || invoice.discount || 0);
    const addCut = parseFloat(invoice.additionalCut || 0);
    const tPct = parseFloat(invoice.taxPercent || invoice.tax || 0);
    const ship = parseFloat(invoice.shippingCost || invoice.shipping || 0);

    const subtotal = Number(invoice.subtotal || itemsSubtotal);
    const discountAmt = subtotal * (dPct / 100);
    const taxableBase = Math.max(0, subtotal - discountAmt - addCut);
    const taxAmt = taxableBase * (tPct / 100);
    const grandTotal = Number(invoice.totalPrice || invoice.grandTotal || invoice.total || (taxableBase + taxAmt + ship));

    const profitMarginPct = grandTotal > 0 ? Math.round((totalProfit / grandTotal) * 100) : 0;

    const overlay = document.createElement('div');
    overlay.id = 'invoice-details-view-modal-overlay';
    overlay.className = 'iv-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.68);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        overflow-y: auto;
        animation: fadeIn 0.2s ease;
    `;

    overlay.innerHTML = `
        <div class="card" role="dialog" aria-modal="true" style="width: 100%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; background: #ffffff; border-radius: var(--radius-card); box-shadow: var(--shadow-elevated); border: 1px solid var(--border-color); overflow: hidden; animation: scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);">
            
            <!-- MODAL HEADER -->
            <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--surface-50);">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <span style="width: 38px; height: 38px; border-radius: 10px; background: rgba(225, 29, 72, 0.1); color: #e11d48; display: flex; align-items: center; justify-content: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </span>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Invoice View</h3>
                            <code style="font-family: monospace; font-size: 0.82rem; font-weight: 700; background: #ffffff; border: 1px solid var(--border-color); padding: 0.2rem 0.5rem; border-radius: 6px; color: var(--text-primary);">${escapeHtml(displayInvNumber)}</code>
                            <span class="${isPaid ? 'badge-paid' : 'badge-unpaid'}" style="font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.65rem;">
                                ${isPaid ? 'PAID' : 'UNPAID'}
                            </span>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
                            Created on ${formatDateDisplay(invoice)} &bull; ${isBusinessInvoice ? 'Commercial Business Invoice' : 'Customer Sales Receipt'}
                        </div>
                    </div>
                </div>

                <!-- TOP QUICK ACTIONS -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <button type="button" id="btn-view-export-pdf" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; background: linear-gradient(135deg, #e11d48, #be123c); border-color: #e11d48; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.35); padding: 0.45rem 1rem; font-size: 0.85rem;" title="Open PDF Studio & Templates">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        Export PDF
                    </button>
                    <button type="button" id="btn-view-whatsapp" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600; padding: 0.45rem 0.85rem; font-size: 0.85rem;" title="Share Invoice via WhatsApp">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        WhatsApp
                    </button>
                    <button type="button" id="btn-view-edit" class="btn btn-secondary" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600; padding: 0.45rem 0.85rem; font-size: 0.85rem;" title="Edit this invoice">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit
                    </button>
                    <button type="button" id="btn-close-invoice-details-modal" class="icon-btn" style="background: none; border: none; font-size: 1.3rem; color: var(--text-secondary); cursor: pointer; padding: 0.25rem 0.5rem;" title="Close">✕</button>
                </div>
            </div>

            <!-- MODAL SCROLLABLE BODY -->
            <div style="padding: 1.75rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.5rem; flex: 1;">
                
                <!-- ROW 1: ISSUER & BILLING RECIPIENT CARDS -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                    
                    <!-- ISSUER BUSINESS CARD -->
                    <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.65rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">ISSUER (YOUR BUSINESS)</span>
                            <span style="font-size: 0.72rem; font-weight: 700; background: rgba(225, 29, 72, 0.08); color: #e11d48; padding: 0.15rem 0.45rem; border-radius: 4px;">Issuer</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.85rem;">
                            ${busImage ? `
                                <img src="${escapeHtml(busImage)}" alt="${escapeHtml(busName)}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color); flex-shrink: 0;">
                            ` : `
                                <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h2M18 15h2M9 3h6v4H9z"></path></svg>
                                </div>
                            `}
                            <div>
                                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(busName)}</h4>
                                ${busPhone ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${escapeHtml(busPhone)}</div>` : ''}
                                ${busEmail ? `<div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 1px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${escapeHtml(busEmail)}</div>` : ''}
                            </div>
                        </div>
                        ${busAddress ? `
                            <div style="font-size: 0.8rem; color: var(--text-secondary); background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); display: flex; align-items: flex-start; gap: 5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>${escapeHtml(busAddress)}</span>
                            </div>
                        ` : ''}
                    </div>

                    <!-- BILLING & RECIPIENT CARD -->
                    <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.65rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em;">BILLING & RECIPIENT</span>
                            <span style="font-size: 0.72rem; font-weight: 700; background: ${isClientRecipient ? 'rgba(14, 165, 233, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${isClientRecipient ? '#0284c7' : '#059669'}; padding: 0.15rem 0.45rem; border-radius: 4px;">
                                ${isClientRecipient ? 'B2B Client' : 'Customer'}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.85rem;">
                            ${custImage ? `
                                <img src="${escapeHtml(custImage)}" alt="${escapeHtml(custName)}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-color); flex-shrink: 0;">
                            ` : `
                                <div style="width: 44px; height: 44px; border-radius: 50%; background: ${isClientRecipient ? 'linear-gradient(135deg, #0284c7, #0369a1)' : 'linear-gradient(135deg, #10b981, #059669)'}; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                                    ${escapeHtml(custName.charAt(0).toUpperCase())}
                                </div>
                            `}
                            <div>
                                <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">${escapeHtml(custName)}</h4>
                                ${custPhone ? `<div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${escapeHtml(custPhone)}</div>` : ''}
                                ${custEmail ? `<div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 1px; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${escapeHtml(custEmail)}</div>` : ''}
                            </div>
                        </div>
                        ${custAddress ? `
                            <div style="font-size: 0.8rem; color: var(--text-secondary); background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); display: flex; align-items: flex-start; gap: 5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>${escapeHtml(custAddress)}</span>
                            </div>
                        ` : ''}
                    </div>

                </div>

                <!-- ROW 2: PURCHASED PRODUCTS & LINE ITEMS TABLE -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-card); overflow: hidden; background: #ffffff;">
                    <div style="padding: 0.85rem 1.25rem; background: var(--surface-50); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="margin: 0; font-size: 0.9rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.04em;">
                            Purchased Line Items (${formattedItems.length})
                        </h4>
                        <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">
                            Total Units: ${formattedItems.reduce((acc, i) => acc + i.qty, 0)}
                        </span>
                    </div>
                    <div class="table-container">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.86rem;">
                            <thead>
                                <tr style="background: var(--surface-50); border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">
                                    <th style="padding: 0.65rem 1rem; width: 40px;">#</th>
                                    <th style="padding: 0.65rem 1rem;">Item Description</th>
                                    <th style="padding: 0.65rem 1rem; text-align: right;">Unit Price</th>
                                    <th style="padding: 0.65rem 1rem; text-align: center; width: 70px;">Qty</th>
                                    <th style="padding: 0.65rem 1rem; text-align: right;">Line Total</th>
                                    <th style="padding: 0.65rem 1rem; text-align: right;">Profit Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${formattedItems.length === 0 ? `
                                    <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No items recorded in this invoice.</td></tr>
                                ` : formattedItems.map(item => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 0.75rem 1rem; color: var(--text-muted); font-weight: 600;">${item.index}</td>
                                        <td style="padding: 0.75rem 1rem;">
                                            <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(item.name)}</strong>
                                            ${item.sizeWeight ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(item.sizeWeight)}</div>` : ''}
                                        </td>
                                        <td style="padding: 0.75rem 1rem; text-align: right; color: var(--text-secondary);">${formatCurrency(item.unitPrice)}</td>
                                        <td style="padding: 0.75rem 1rem; text-align: center;">
                                            <span style="display: inline-block; padding: 0.15rem 0.55rem; background: var(--surface-100); border-radius: 9999px; font-weight: 700; color: var(--text-primary); font-size: 0.8rem;">
                                                ${item.qty}
                                            </span>
                                        </td>
                                        <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 800; color: var(--text-primary);">
                                            ${formatCurrency(item.lineTotal)}
                                        </td>
                                        <td style="padding: 0.75rem 1rem; text-align: right; font-weight: 700; color: #059669;">
                                            +${formatCurrency(item.profit)}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- ROW 3: PROFIT INTELLIGENCE & BILLING RECONCILIATION -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; align-items: start;">
                    
                    <!-- EXECUTIVE PROFIT INTELLIGENCE -->
                    <div style="background: rgba(225, 29, 72, 0.03); border: 1px solid rgba(225, 29, 72, 0.15); border-radius: var(--radius-card); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(225, 29, 72, 0.12); padding-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #e11d48; letter-spacing: 0.04em;">FINANCIAL & PROFIT INTELLIGENCE</span>
                            <span style="font-size: 0.72rem; font-weight: 800; background: #059669; color: #ffffff; padding: 0.15rem 0.5rem; border-radius: 9999px;">
                                ${profitMarginPct}% Margin
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                            <div style="background: #ffffff; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color);">
                                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Total COGS (Cost)</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary); margin-top: 2px;">
                                    ${formatCurrency(totalCOGS)}
                                </div>
                            </div>
                            <div style="background: #ffffff; padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(5, 150, 105, 0.2);">
                                <div style="font-size: 0.75rem; color: #059669; font-weight: 700;">Net Gross Profit</div>
                                <div style="font-size: 1.1rem; font-weight: 800; color: #059669; margin-top: 2px;">
                                    +${formatCurrency(totalProfit)}
                                </div>
                            </div>
                        </div>
                        ${invoice.note ? `
                            <div style="font-size: 0.8rem; color: var(--text-secondary); background: #ffffff; padding: 0.65rem 0.85rem; border-radius: 8px; border: 1px solid var(--border-color);">
                                <strong style="color: var(--text-primary);">Notes / Terms:</strong> ${escapeHtml(invoice.note)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- COMPLETE BILLING BREAKDOWN -->
                    <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: var(--radius-card); padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.88rem;">
                        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted);">BILLING RECONCILIATION</span>
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-secondary);">${invoice.title || 'Invoice'}</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; color: var(--text-secondary); margin-top: 0.25rem;">
                            <span>Items Subtotal</span>
                            <strong style="color: var(--text-primary);">${formatCurrency(subtotal)}</strong>
                        </div>

                        ${dPct > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: #e11d48;">
                                <span>Discount (${dPct}%)</span>
                                <strong>-${formatCurrency(discountAmt)}</strong>
                            </div>
                        ` : ''}

                        ${addCut > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: #e11d48;">
                                <span>Additional Cut</span>
                                <strong>-${formatCurrency(addCut)}</strong>
                            </div>
                        ` : ''}

                        ${(dPct > 0 || addCut > 0) && tPct > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.78rem; border-top: 1px dashed var(--border-color); padding-top: 2px;">
                                <span>Taxable Base</span>
                                <span>${formatCurrency(taxableBase)}</span>
                            </div>
                        ` : ''}

                        ${tPct > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: #0284c7;">
                                <span>Tax (${tPct}%)</span>
                                <strong>+${formatCurrency(taxAmt)}</strong>
                            </div>
                        ` : ''}

                        ${ship > 0 ? `
                            <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                                <span>Shipping & Handling</span>
                                <strong>+${formatCurrency(ship)}</strong>
                            </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid var(--border-color); padding-top: 0.75rem; margin-top: 0.35rem;">
                            <div>
                                <span style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); display: block;">Grand Total</span>
                                <span style="font-size: 0.75rem; font-weight: 700; color: ${isPaid ? '#059669' : '#d97706'};">${isPaid ? 'Amount Paid in Full' : 'Payment Balance Due'}</span>
                            </div>
                            <span style="font-size: 1.45rem; font-weight: 900; color: #e11d48; letter-spacing: -0.02em;">
                                ${formatCurrency(grandTotal)}
                            </span>
                        </div>
                    </div>

                </div>

            </div>

            <!-- MODAL FOOTER -->
            <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--border-color); background: var(--surface-50); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                    Unique ID: <code style="font-family: monospace; font-weight: 600;">${invoice.uniqueId || invoice.id}</code>
                </div>
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <button type="button" id="btn-footer-close" class="btn btn-secondary" style="padding: 0.45rem 1rem;">Close</button>
                    <button type="button" id="btn-footer-edit" class="btn btn-secondary" style="padding: 0.45rem 1rem; font-weight: 600;">Edit Invoice</button>
                    <button type="button" id="btn-footer-export-pdf" class="btn btn-primary" style="padding: 0.45rem 1.25rem; font-weight: 700; background: linear-gradient(135deg, #e11d48, #be123c); border-color: #e11d48;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        Export PDF & Templates
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.remove();
    };

    // Close handlers
    overlay.querySelector('#btn-close-invoice-details-modal')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-footer-close')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Edit Handlers
    const handleEdit = () => {
        closeModal();
        if (typeof options.onEdit === 'function') {
            options.onEdit(invoice);
        }
    };
    overlay.querySelector('#btn-view-edit')?.addEventListener('click', handleEdit);
    overlay.querySelector('#btn-footer-edit')?.addEventListener('click', handleEdit);

    // Export PDF Handlers (Directly launches Invoice Viewer & Performance -> PDF Studio)
    const handleExportPdf = () => {
        closeModal();
        openInvoiceViewerModal(invoice, (invoiceToEdit) => {
            if (typeof options.onEdit === 'function') {
                options.onEdit(invoiceToEdit);
            }
        });
    };
    overlay.querySelector('#btn-view-export-pdf')?.addEventListener('click', handleExportPdf);
    overlay.querySelector('#btn-footer-export-pdf')?.addEventListener('click', handleExportPdf);

    // WhatsApp Handler
    overlay.querySelector('#btn-view-whatsapp')?.addEventListener('click', () => {
        const phoneClean = (custPhone || '').replace(/[^0-9]/g, '');
        const message = `Hello ${custName},\nHere is your invoice #${displayInvNumber} for ${formatCurrency(grandTotal)} (${invoice.title || 'Invoice'}).\nStatus: ${isPaid ? 'PAID' : 'UNPAID'}.\nThank you for doing business with ${busName}!`;
        const encodedMsg = encodeURIComponent(message);
        const waUrl = phoneClean 
            ? `https://wa.me/${phoneClean}?text=${encodedMsg}`
            : `https://wa.me/?text=${encodedMsg}`;
        window.open(waUrl, '_blank');
    });
};
