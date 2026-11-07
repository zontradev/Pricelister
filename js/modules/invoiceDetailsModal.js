/**
 * PriceLister - Dedicated Invoice View Panel & Comprehensive Details Screen
 * Displays complete invoice billing, recipient details, issuer business profile,
 * multi-column line items, financial deductions & tax reconciliation,
 * executive profitability intelligence, and seamless 1-click PDF export actions.
 * Pure Enterprise Monochrome (Grey / Black combo) - WhatsApp icon emerald green.
 */

import { formatCurrency, getAppCurrencySymbol, formatExactTimestamp } from '../utilities.js';
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
    const ts = inv.timestamp || inv.createdAt || inv.updatedTimestamp || inv.invoiceDate || inv.date || inv.issueDate;
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
    if (isNaN(dateObj.getTime())) return String(ts);
    return dateObj.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric'
    });
}

/**
 * Render Dedicated Invoice View Panel (Grey/Black combo - WhatsApp icon green)
 * Replaces dialog overlay with a full, dedicated view screen matching Product View.
 */
export const renderInvoiceDetailPanel = (targetContainer, invoice, options = {}) => {
    if (!targetContainer || !invoice) return;

    const isBusinessInvoice = Boolean(invoice.isBusinessInvoice);
    const isPaid = (invoice.status || 'Paid').toUpperCase() === 'PAID';
    const displayInvNumber = invoice.busInvNumber || invoice.invoiceNumber || invoice.uniqueId || invoice.id || 'INV-001';
    
    // Resolve Issuer Business
    let busImage = invoice.businessImageUrl || invoice.businessImage || invoice.businessLogo || invoice.issuerLogo || invoice.logoUrl || invoice.logo || '';
    const busName = invoice.businessName || window.__activeWorkspace?.name || 'Your Business';
    const busPhone = invoice.businessPhone || window.__activeWorkspace?.phone || '';
    const busEmail = invoice.businessEmail || window.__activeWorkspace?.email || '';
    const busAddress = invoice.businessAddress || window.__activeWorkspace?.address || '';

    // Fallback business image lookup from passed options, global cache, or active workspace
    let busPool = [];
    if (Array.isArray(options.allBusinesses)) busPool.push(...options.allBusinesses);
    if (typeof window !== 'undefined' && Array.isArray(window.__cachedBusinesses)) busPool.push(...window.__cachedBusinesses);
    if (typeof localStorage !== 'undefined') {
        try {
            const db = JSON.parse(localStorage.getItem('pricelister_demo_db_v2') || '{}');
            const demoBus = db.Businesses || db.BusinessProfiles || [];
            if (Array.isArray(demoBus)) busPool.push(...demoBus);
        } catch(e) {}
    }

    if (!busImage && busPool.length > 0) {
        const targetBusId = invoice.businessId || invoice.issuerId;
        const targetBusName = (busName || '').trim().toLowerCase();
        const foundBus = busPool.find(b => {
            if (!b) return false;
            if (targetBusId && (b.id === targetBusId || b.uniqueId === targetBusId || b.businessId === targetBusId)) return true;
            const bName = (b.name || '').trim().toLowerCase();
            if (targetBusName && bName && (bName === targetBusName || bName.includes(targetBusName) || targetBusName.includes(bName))) return true;
            return false;
        });
        if (foundBus) {
            busImage = foundBus.imageUrl || foundBus.imageUri || foundBus.logoUrl || foundBus.logo || foundBus.photoUrl || foundBus.photoURL || foundBus.image || '';
        }
    }

    // Still no business logo? Fallback to active workspace logo or banner
    if (!busImage && typeof window !== 'undefined' && window.__activeWorkspace) {
        busImage = window.__activeWorkspace.logoUrl || window.__activeWorkspace.logo || window.__activeWorkspace.bannerUrl || window.__activeWorkspace.banner || '';
    }

    // Resolve Recipient (Customer or Client)
    let custImage = invoice.customerImageUrl || invoice.customerPhoto || invoice.customerPhotoURL || invoice.clientImageUrl || invoice.clientPhoto || invoice.customerImage || invoice.clientImage || invoice.photoURL || invoice.photoUrl || invoice.avatar || invoice.imageUrl || invoice.imageUri || '';
    const custName = invoice.customerName || invoice.clientName || 'Walk-in Customer';
    const custPhone = invoice.customerNumber || invoice.customerPhone || invoice.clientPhone || '';
    const custEmail = invoice.clientEmail || invoice.customerEmail || '';
    const custAddress = invoice.clientAddress || invoice.customerAddress || '';
    const isClientRecipient = Boolean(invoice.clientId || invoice.isBusinessInvoice);

    // Fallback recipient image lookup from customer/client pools
    if (!custImage) {
        let recPool = [];
        if (Array.isArray(options.allCustomers)) recPool.push(...options.allCustomers);
        if (Array.isArray(options.allClients)) recPool.push(...options.allClients);
        if (typeof window !== 'undefined' && Array.isArray(window.__cachedCustomers)) recPool.push(...window.__cachedCustomers);
        if (typeof window !== 'undefined' && Array.isArray(window.__cachedClients)) recPool.push(...window.__cachedClients);
        if (typeof localStorage !== 'undefined') {
            try {
                const db = JSON.parse(localStorage.getItem('pricelister_demo_db_v2') || '{}');
                const demoCust = db.Customers || db.CustomerProfiles || [];
                const demoCli = db.Clients || db.ClientProfiles || [];
                if (Array.isArray(demoCust)) recPool.push(...demoCust);
                if (Array.isArray(demoCli)) recPool.push(...demoCli);
            } catch(e) {}
        }

        const targetId = invoice.customerId || invoice.clientId || invoice.recipientId;
        const targetName = (custName || '').trim().toLowerCase();
        const targetPhone = (custPhone || '').trim();
        const targetEmail = (custEmail || '').trim().toLowerCase();

        const foundRec = recPool.find(r => {
            if (!r) return false;
            if (targetId && (r.id === targetId || r.uniqueId === targetId || r.customerId === targetId || r.clientId === targetId)) return true;
            const rName = (r.name || r.customerName || r.clientName || '').trim().toLowerCase();
            if (targetName && rName && (rName === targetName || rName.includes(targetName) || targetName.includes(rName))) return true;
            const rPhone = (r.phone || r.customerPhone || r.clientPhone || '').trim();
            if (targetPhone && rPhone && rPhone === targetPhone) return true;
            const rEmail = (r.email || r.customerEmail || r.clientEmail || '').trim().toLowerCase();
            if (targetEmail && rEmail && rEmail === targetEmail) return true;
            return false;
        });

        if (foundRec) {
            custImage = foundRec.imageUrl || foundRec.imageUri || foundRec.photoUrl || foundRec.photoURL || foundRec.photo || foundRec.avatar || foundRec.picture || foundRec.image || '';
        }
    }

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

    targetContainer.innerHTML = `
        <div class="invoice-detail-panel" style="animation: fadeIn 0.2s ease; display:flex; flex-direction:column; gap:1.25rem;">
            
            <!-- TOP NAVIGATION & ACTION BAR -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding-bottom:1rem; border-bottom:1px solid #E4E4E7;">
                <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                    <button type="button" id="btn-detail-back-invoices" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.55rem 1.1rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF; color:#18181B; cursor:pointer;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Invoices
                    </button>
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <h2 style="margin:0; font-size:1.25rem; font-weight:800; color:#18181B; line-height:1.2;">${escapeHtml(invoice.title || (isBusinessInvoice ? 'B2B Commercial Invoice' : 'Customer Sales Invoice'))}</h2>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:800; background:#FAFAFA; border:1.5px solid #E4E4E7; padding:0.2rem 0.55rem; border-radius:6px; color:#18181B;">#${escapeHtml(displayInvNumber)}</code>
                                <span style="font-size:0.75rem; font-weight:800; padding:0.2rem 0.55rem; border-radius:6px; ${isPaid ? 'background:#18181B; color:#FFFFFF;' : 'background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7;'}">
                                    ${isPaid ? 'PAID' : 'UNPAID'}
                                </span>
                            </div>
                            <div style="font-size:0.78rem; color:#71717A; display:flex; align-items:center; gap:6px;">
                                <span>ID: <code style="font-family:monospace; font-size:0.75rem; color:#18181B;">${escapeHtml(invoice.uniqueId || invoice.id || displayInvNumber)}</code></span>
                                <span>•</span>
                                <span>Created: ${escapeHtml(formatDateDisplay(invoice))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- TOP ACTIONS -->
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <button type="button" id="btn-detail-whatsapp" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.55rem 1.1rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF; color:#18181B;" title="Share Invoice via WhatsApp">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2.2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        WhatsApp
                    </button>
                    <button type="button" id="btn-detail-export-pdf" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.55rem 1.25rem; border:1px solid #18181B; border-radius:8px; background:#18181B; color:#FFFFFF;" title="Open PDF Studio & Templates">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        Export PDF & Templates
                    </button>
                    <button type="button" id="btn-detail-edit-invoice" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.55rem 1.1rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF; color:#18181B;" title="Edit this invoice">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit Invoice
                    </button>
                </div>
            </div>

            <!-- ROW 1: ISSUER & BILLING RECIPIENT CARDS (Crisp Grey/Black Combo) -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
                
                <!-- ISSUER BUSINESS CARD -->
                <div class="card" style="background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #E4E4E7; padding-bottom:0.6rem;">
                        <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#71717A; letter-spacing:0.05em;">ISSUER (YOUR BUSINESS)</span>
                        <span style="font-size:0.7rem; font-weight:800; background:#F4F4F5; color:#18181B; padding:0.15rem 0.5rem; border-radius:4px; border:1px solid #E4E4E7;">Issuer</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.85rem;">
                        ${busImage ? `
                            <img src="${escapeHtml(busImage)}" alt="${escapeHtml(busName)}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1.5px solid #E4E4E7; flex-shrink:0;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                            <div style="display:none; width:44px; height:44px; border-radius:50%; background:#18181B; color:#FFFFFF; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; flex-shrink:0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h2M18 15h2M9 3h6v4H9z"></path></svg>
                            </div>
                        ` : `
                            <div style="width:44px; height:44px; border-radius:50%; background:#18181B; color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; flex-shrink:0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 7v14M21 7v14M6 11h2M6 15h2M10 11h2M10 15h2M14 11h2M14 15h2M18 11h2M18 15h2M9 3h6v4H9z"></path></svg>
                            </div>
                        `}
                        <div>
                            <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">${escapeHtml(busName)}</h4>
                            ${busPhone ? `<div style="font-size:0.82rem; color:#71717A; margin-top:2px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${escapeHtml(busPhone)}</div>` : ''}
                            ${busEmail ? `<div style="font-size:0.82rem; color:#71717A; margin-top:1px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${escapeHtml(busEmail)}</div>` : ''}
                        </div>
                    </div>
                    ${busAddress ? `
                        <div style="font-size:0.82rem; color:#71717A; background:#FAFAFA; padding:0.5rem 0.75rem; border-radius:6px; border:1px solid #E4E4E7; display:flex; align-items:flex-start; gap:6px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${escapeHtml(busAddress)}</span>
                        </div>
                    ` : ''}
                </div>

                <!-- BILLING & RECIPIENT CARD -->
                <div class="card" style="background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #E4E4E7; padding-bottom:0.6rem;">
                        <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#71717A; letter-spacing:0.05em;">BILLING & RECIPIENT</span>
                        <span style="font-size:0.7rem; font-weight:800; background:#F4F4F5; color:#18181B; padding:0.15rem 0.5rem; border-radius:4px; border:1px solid #E4E4E7;">
                            ${isClientRecipient ? 'B2B Client' : 'Customer'}
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.85rem;">
                        ${custImage ? `
                            <img src="${escapeHtml(custImage)}" alt="${escapeHtml(custName)}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:1.5px solid #E4E4E7; flex-shrink:0;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                            <div style="display:none; width:44px; height:44px; border-radius:50%; background:#18181B; color:#FFFFFF; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; flex-shrink:0;">
                                ${escapeHtml(custName.charAt(0).toUpperCase())}
                            </div>
                        ` : `
                            <div style="width:44px; height:44px; border-radius:50%; background:#18181B; color:#FFFFFF; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.1rem; flex-shrink:0;">
                                ${escapeHtml(custName.charAt(0).toUpperCase())}
                            </div>
                        `}
                        <div>
                            <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">${escapeHtml(custName)}</h4>
                            ${custPhone ? `<div style="font-size:0.82rem; color:#71717A; margin-top:2px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${escapeHtml(custPhone)}</div>` : ''}
                            ${custEmail ? `<div style="font-size:0.82rem; color:#71717A; margin-top:1px; display:flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg> ${escapeHtml(custEmail)}</div>` : ''}
                        </div>
                    </div>
                    ${custAddress ? `
                        <div style="font-size:0.82rem; color:#71717A; background:#FAFAFA; padding:0.5rem 0.75rem; border-radius:6px; border:1px solid #E4E4E7; display:flex; align-items:flex-start; gap:6px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span>${escapeHtml(custAddress)}</span>
                        </div>
                    ` : ''}
                </div>

            </div>

            <!-- ROW 2: PURCHASED PRODUCTS & LINE ITEMS TABLE -->
            <div class="card" style="background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:14px; overflow:hidden;">
                <div style="padding:0.85rem 1.25rem; background:#FAFAFA; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                    <h4 style="margin:0; font-size:0.88rem; font-weight:800; color:#18181B; text-transform:uppercase; letter-spacing:0.04em;">
                        Purchased Line Items (${formattedItems.length})
                    </h4>
                    <span style="font-size:0.8rem; font-weight:700; color:#71717A;">
                        Total Units: ${formattedItems.reduce((acc, i) => acc + i.qty, 0)}
                    </span>
                </div>
                <div class="table-container" style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.86rem;">
                        <thead>
                            <tr style="background:#FAFAFA; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                                <th style="padding:0.65rem 1.25rem; width:45px;">#</th>
                                <th style="padding:0.65rem 1rem;">Item Description</th>
                                <th style="padding:0.65rem 1rem; text-align:right;">Unit Price</th>
                                <th style="padding:0.65rem 1rem; text-align:center; width:80px;">Qty</th>
                                <th style="padding:0.65rem 1rem; text-align:right;">Line Total</th>
                                <th style="padding:0.65rem 1.25rem; text-align:right;">Profit Margin</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${formattedItems.length === 0 ? `
                                <tr><td colspan="6" style="padding:2rem; text-align:center; color:#71717A;">No items recorded in this invoice.</td></tr>
                            ` : formattedItems.map(item => `
                                <tr style="border-bottom:1px solid #E4E4E7;">
                                    <td style="padding:0.8rem 1.25rem; color:#71717A; font-weight:600;">${item.index}</td>
                                    <td style="padding:0.8rem 1rem;">
                                        <strong style="color:#18181B; font-size:0.9rem;">${escapeHtml(item.name)}</strong>
                                        ${item.sizeWeight ? `<div style="font-size:0.75rem; color:#71717A; margin-top:2px;">${escapeHtml(item.sizeWeight)}</div>` : ''}
                                    </td>
                                    <td style="padding:0.8rem 1rem; text-align:right; color:#71717A;">${formatCurrency(item.unitPrice)}</td>
                                    <td style="padding:0.8rem 1rem; text-align:center;">
                                        <span style="display:inline-block; padding:0.15rem 0.55rem; background:#F4F4F5; border:1px solid #E4E4E7; border-radius:999px; font-weight:700; color:#18181B; font-size:0.8rem;">
                                            ${item.qty}
                                        </span>
                                    </td>
                                    <td style="padding:0.8rem 1rem; text-align:right; font-weight:800; color:#18181B;">
                                        ${formatCurrency(item.lineTotal)}
                                    </td>
                                    <td style="padding:0.8rem 1.25rem; text-align:right; font-weight:800; color:#18181B;">
                                        +${formatCurrency(item.profit)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- ROW 3: PROFIT INTELLIGENCE & BILLING RECONCILIATION (Pure Grey/Black Combo) -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; align-items:start;">
                
                <!-- EXECUTIVE PROFIT INTELLIGENCE -->
                <div class="card" style="background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #E4E4E7; padding-bottom:0.6rem;">
                        <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#18181B; letter-spacing:0.04em;">FINANCIAL & PROFIT INTELLIGENCE</span>
                        <span style="font-size:0.72rem; font-weight:800; background:#18181B; color:#FFFFFF; padding:0.15rem 0.55rem; border-radius:999px;">
                            ${profitMarginPct}% Margin
                        </span>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div style="background:#FAFAFA; padding:0.85rem; border-radius:8px; border:1px solid #E4E4E7;">
                            <div style="font-size:0.75rem; color:#71717A; font-weight:600;">Total COGS (Cost)</div>
                            <div style="font-size:1.2rem; font-weight:800; color:#18181B; margin-top:3px;">
                                ${formatCurrency(totalCOGS)}
                            </div>
                        </div>
                        <div style="background:#FAFAFA; padding:0.85rem; border-radius:8px; border:1px solid #E4E4E7;">
                            <div style="font-size:0.75rem; color:#71717A; font-weight:700;">Net Gross Profit</div>
                            <div style="font-size:1.2rem; font-weight:800; color:#18181B; margin-top:3px;">
                                +${formatCurrency(totalProfit)}
                            </div>
                        </div>
                    </div>
                    ${invoice.note ? `
                        <div style="font-size:0.82rem; color:#71717A; background:#FAFAFA; padding:0.65rem 0.85rem; border-radius:8px; border:1px solid #E4E4E7;">
                            <strong style="color:#18181B;">Notes / Terms:</strong> ${escapeHtml(invoice.note)}
                        </div>
                    ` : ''}
                </div>

                <!-- COMPLETE BILLING RECONCILIATION -->
                <div class="card" style="background:#FFFFFF; border:1.5px solid #E4E4E7; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:0.5rem; font-size:0.88rem;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #E4E4E7; padding-bottom:0.6rem;">
                        <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#71717A;">BILLING RECONCILIATION</span>
                        <span style="font-size:0.75rem; font-weight:700; color:#18181B;">${invoice.title || 'Invoice'}</span>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; color:#71717A; margin-top:0.25rem;">
                        <span>Items Subtotal</span>
                        <strong style="color:#18181B;">${formatCurrency(subtotal)}</strong>
                    </div>

                    ${dPct > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#18181B;">
                            <span>Discount (${dPct}%)</span>
                            <strong>-${formatCurrency(discountAmt)}</strong>
                        </div>
                    ` : ''}

                    ${addCut > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#18181B;">
                            <span>Additional Cut</span>
                            <strong>-${formatCurrency(addCut)}</strong>
                        </div>
                    ` : ''}

                    ${tPct > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#18181B;">
                            <span>Tax (${tPct}%)</span>
                            <strong>+${formatCurrency(taxAmt)}</strong>
                        </div>
                    ` : ''}

                    ${ship > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#71717A;">
                            <span>Shipping & Handling</span>
                            <strong style="color:#18181B;">+${formatCurrency(ship)}</strong>
                        </div>
                    ` : ''}

                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid #E4E4E7; padding-top:0.75rem; margin-top:0.35rem;">
                        <div>
                            <span style="font-size:0.95rem; font-weight:800; color:#18181B; display:block;">Grand Total</span>
                            <span style="font-size:0.75rem; font-weight:700; color:#71717A;">${isPaid ? 'Amount Paid in Full' : 'Payment Balance Due'}</span>
                        </div>
                        <span style="font-size:1.55rem; font-weight:900; color:#18181B; letter-spacing:-0.02em;">
                            ${formatCurrency(grandTotal)}
                        </span>
                    </div>
                </div>

            </div>

            <!-- ROW 4: INVOICE ORIGIN (Mirroring Product Origin) -->
            <div class="card origin-divider-card" style="margin-top:0.25rem; padding:1.25rem 1.5rem; border-radius:14px; background:#FFFFFF; border:1.5px solid #E4E4E7; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:1rem; padding-bottom:0.65rem; border-bottom:1px solid #E4E4E7;">
                    <div style="width:28px; height:28px; border-radius:7px; background:#F4F4F5; color:#18181B; display:flex; align-items:center; justify-content:center; border:1px solid #E4E4E7;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    </div>
                    <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">Invoice Origin</h3>
                </div>
                <div class="origin-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Invoice ID:</span>
                        <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:800; color:#18181B;">${escapeHtml(invoice.uniqueId || invoice.id || displayInvNumber)}</code>
                    </div>
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Creator ID:</span>
                        <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:800; color:#18181B;">${escapeHtml(invoice.creatorId || invoice.createdBy || invoice.appWorkerId || window.__activeWorkspace?.myAppWorkerId || window.__activeWorkspace?.adminId || 'System / Admin')}</code>
                    </div>
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Workspace ID:</span>
                        <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:800; color:#18181B;">${escapeHtml(invoice.workspaceId || window.__activeWorkspace?.workspaceId || 'Default Workspace')}</code>
                    </div>
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Created at:</span>
                        <span class="origin-value" style="font-size:0.88rem; font-weight:600; color:#18181B;">${escapeHtml(formatDateDisplay(invoice))}</span>
                    </div>
                    ${(invoice.updatedAt || invoice.updatedTimestamp) && (invoice.updatedAt !== (invoice.createdAt || invoice.timestamp)) ? `
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Updated at:</span>
                        <span class="origin-value" style="font-size:0.88rem; font-weight:600; color:#18181B;">${escapeHtml(formatExactTimestamp(invoice.updatedAt || invoice.updatedTimestamp))}</span>
                    </div>
                    ` : ''}
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Invoice Status:</span>
                        <span class="origin-value" style="font-size:0.88rem; font-weight:800; color:${isPaid ? '#059669' : '#D97706'};">${isPaid ? 'PAID' : (escapeHtml(invoice.status) || 'UNPAID')}</span>
                    </div>
                </div>
            </div>

        </div>
    `;

    // Event Bindings
    targetContainer.querySelector('#btn-detail-back-invoices')?.addEventListener('click', () => {
        if (typeof options.onBack === 'function') {
            options.onBack();
        }
    });

    targetContainer.querySelector('#btn-detail-edit-invoice')?.addEventListener('click', () => {
        if (typeof options.onEdit === 'function') {
            options.onEdit(invoice);
        }
    });

    targetContainer.querySelector('#btn-detail-export-pdf')?.addEventListener('click', () => {
        openInvoiceViewerModal(invoice, (invoiceToEdit) => {
            if (typeof options.onEdit === 'function') {
                options.onEdit(invoiceToEdit);
            }
        });
    });

    targetContainer.querySelector('#btn-detail-whatsapp')?.addEventListener('click', () => {
        const phoneClean = (custPhone || '').replace(/[^0-9]/g, '');
        const message = `Hello ${custName},\nHere is your invoice #${displayInvNumber} for ${formatCurrency(grandTotal)} (${invoice.title || 'Invoice'}).\nStatus: ${isPaid ? 'PAID' : 'UNPAID'}.\nThank you for doing business with ${busName}!`;
        const encodedMsg = encodeURIComponent(message);
        const waUrl = phoneClean 
            ? `https://wa.me/${phoneClean}?text=${encodedMsg}`
            : `https://wa.me/?text=${encodedMsg}`;
        window.open(waUrl, '_blank');
    });
};

/**
 * Open Dedicated Invoice Details View Modal (Fallback for non-page callers)
 */
export const openInvoiceDetailsModal = (invoice, options = {}) => {
    if (!invoice) return;

    // If caller provided a target container, mount directly
    if (options.targetContainer) {
        renderInvoiceDetailPanel(options.targetContainer, invoice, options);
        return;
    }

    // Otherwise render as a clean full view overlay
    const existingOverlay = document.getElementById('invoice-details-view-modal-overlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'invoice-details-view-modal-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(8px); z-index: 99999; overflow-y: auto;
        padding: 1.5rem; display: flex; justify-content: center; align-items: flex-start;
    `;

    const card = document.createElement('div');
    card.style.cssText = `width: 100%; max-width: 1060px; background: #FFFFFF; border-radius: 18px; border: 1px solid #E4E4E7; padding: 1.75rem; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.25); margin: auto;`;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    renderInvoiceDetailPanel(card, invoice, {
        ...options,
        onBack: close,
        onEdit: (inv) => {
            close();
            if (typeof options.onEdit === 'function') options.onEdit(inv);
        }
    });

    overlay.onclick = (e) => {
        if (e.target === overlay) close();
    };
};
