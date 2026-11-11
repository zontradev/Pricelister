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

// Helper to resolve clean Worker ID (avoiding raw Firebase UIDs)
function resolveInvoiceWorkerId(inv) {
    if (!inv) return 'ADMIN-HEAD';
    if (inv.appWorkerId && inv.appWorkerId.length <= 20) return inv.appWorkerId;
    if (inv.workerId && inv.workerId.length <= 20) return inv.workerId;
    
    const cId = inv.creatorId || inv.createdBy || inv.userId;
    if (cId && cId.length <= 18 && !/^[A-Za-z0-9]{25,}$/.test(cId)) {
        return cId;
    }
    
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    const curUid = (typeof firebase !== 'undefined' && firebase.auth?.().currentUser?.uid) || '';
    
    if (cId && (cId === ws.creatorUid || cId === ws.ownerId || cId === ws.adminUid || (curUid && cId === curUid && (ws.role === 'CREATOR_ADMIN' || ws.role === 'ADMIN')))) {
        return ws.adminId || 'ADMIN-HEAD';
    }
    
    const members = (typeof window !== 'undefined' && (window.__cachedMembers || window.__workspaceMembers)) || [];
    if (Array.isArray(members) && cId) {
        const found = members.find(m => m && (m.workerUid === cId || m.uid === cId || m.id === cId));
        if (found) {
            const resolved = found.appWorkerId || found.workerId || found.adminId;
            if (resolved) return resolved;
        }
    }
    
    if (ws.myAppWorkerId && curUid && cId === curUid) {
        return ws.myAppWorkerId;
    }
    return ws.adminId || ws.myAppWorkerId || 'ADMIN-HEAD';
}

function resolveInvoiceWorkspaceId(inv) {
    const ws = (typeof window !== 'undefined' && window.__activeWorkspace) ? window.__activeWorkspace : {};
    if (ws.workspaceId) return ws.workspaceId;
    if (ws.realWorkspaceId) return ws.realWorkspaceId;
    if (ws.uniqueId) return ws.uniqueId;
    
    const wsId = inv?.workspaceId;
    if (wsId && wsId.length <= 18 && !/^[A-Za-z0-9]{25,}$/.test(wsId)) {
        return wsId;
    }
    return 'PL-WORKSPACE';
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

    // Fallback business image lookup from passed options, global cache, or active workspace - Strict ID-to-ID
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

    let foundBus = null;
    const targetBusId = invoice.businessId || invoice.businessUniqueId || invoice.businessDocId || invoice.issuerId;
    if (busPool.length > 0 && targetBusId) {
        foundBus = busPool.find(b => {
            if (!b) return false;
            return (b.id === targetBusId || b.uniqueId === targetBusId || b.businessId === targetBusId || 
                   (b.uniqueId && b.uniqueId === invoice.businessUniqueId) || 
                   (b.id && b.id === invoice.businessDocId));
        });
        if (foundBus && !busImage) {
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

    // Fallback recipient image & object lookup from customer/client pools - Strict ID-to-ID
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

    let foundRec = null;
    const targetRecLookupId = invoice.customerId || invoice.customerUniqueId || invoice.customerDocId || invoice.clientId || invoice.clientUniqueId || invoice.clientDocId || invoice.recipientId;

    if (recPool.length > 0 && targetRecLookupId) {
        foundRec = recPool.find(r => {
            if (!r) return false;
            return (r.id === targetRecLookupId || r.uniqueId === targetRecLookupId || 
                   r.customerId === targetRecLookupId || r.clientId === targetRecLookupId ||
                   (r.uniqueId && r.uniqueId === invoice.customerUniqueId) || 
                   (r.id && r.id === invoice.customerDocId) ||
                   (r.uniqueId && r.uniqueId === invoice.clientUniqueId) || 
                   (r.id && r.id === invoice.clientDocId));
        });

        if (foundRec && !custImage) {
            custImage = foundRec.imageUrl || foundRec.imageUri || foundRec.photoUrl || foundRec.photoURL || foundRec.photo || foundRec.avatar || foundRec.picture || foundRec.image || '';
        }
    }

    const isClientRecipient = Boolean(invoice.clientId || invoice.isBusinessInvoice || (foundRec && (foundRec.type === 'client' || foundRec._entityType === 'client')));

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

    // Check if navigated from People / Contact view
    let returnPersonNav = null;
    try {
        const rawPerson = sessionStorage.getItem('pricelister_return_person');
        if (rawPerson) returnPersonNav = JSON.parse(rawPerson);
    } catch(e) {}
    if (!returnPersonNav && options.returnPerson) {
        returnPersonNav = options.returnPerson;
    }

    targetContainer.innerHTML = `
        <div class="invoice-detail-panel" style="animation: fadeIn 0.2s ease; display:flex; flex-direction:column; gap:1.25rem;">
            
            <!-- TOP NAVIGATION & ACTION BAR -->
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; padding-bottom:1rem; border-bottom:1px solid #E4E4E7;">
                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap;">
                    ${returnPersonNav ? `
                        <button type="button" id="btn-detail-back-to-person" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.5rem 0.95rem; border:1px solid #76767aff; border-radius:8px; background:#FFFFFF; color:#18181B; cursor:pointer;" title="Back to ${escapeHtml(returnPersonNav.name || 'Contact')}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                            <span>Back to ${returnPersonNav.mode === 'businesses' ? 'Business' : (returnPersonNav.mode === 'clients' ? 'Client' : 'Customer')}: ${escapeHtml(returnPersonNav.name || 'Contact')}</span>
                        </button>
                        <span style="color:#71717A; font-size:0.82rem; font-weight:600;">or</span>
                    ` : ''}
                    <button type="button" id="btn-detail-back-invoices" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:6px; font-weight:700; padding:0.5rem 0.95rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF; color:#18181B; cursor:pointer;">
                        ${!returnPersonNav ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>` : ''}
                        <span>Back to Invoices</span>
                    </button>
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                        <div style="display:flex; flex-direction:column; gap:2px;">
                            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                <h2 style="margin:0; font-size:1.25rem; font-weight:800; color:#18181B; line-height:1.2;">${escapeHtml(invoice.title || (isBusinessInvoice ? 'B2B Commercial Invoice' : 'Customer Sales Invoice'))}</h2>
                                <code style="font-family:monospace; font-size:0.85rem; font-weight:800; background:#FAFAFA; border:1.5px solid #E4E4E7; padding:0.2rem 0.55rem; border-radius:6px; color:#18181B;">#${escapeHtml(displayInvNumber)}</code>
                                <span style="font-size:0.75rem; font-weight:800; padding:0.2rem 0.55rem; border-radius:6px; ${isPaid ? 'background:#ffffff; color:#18181B;' : 'background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7;'}">
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
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" id="btn-view-issuer-contact" class="btn btn-xs btn-outline" style="font-size:0.72rem; font-weight:700; padding:0.18rem 0.55rem; border-radius:6px; border:1.5px solid #d4d4d8; background:#ffffff; color:#18181b; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s ease;" title="View Issuer Business Profile in Directory">
                                <span>View</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </button>
                            <span style="font-size:0.7rem; font-weight:800; background:#F4F4F5; color:#18181B; padding:0.15rem 0.5rem; border-radius:4px; border:1px solid #E4E4E7;">Issuer</span>
                        </div>
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
                        <div style="display:flex; align-items:center; gap:6px;">
                            <button type="button" id="btn-view-recipient-contact" class="btn btn-xs btn-outline" style="font-size:0.72rem; font-weight:700; padding:0.18rem 0.55rem; border-radius:6px; border:1.5px solid #d4d4d8; background:#ffffff; color:#18181b; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s ease;" title="View ${isClientRecipient ? 'Client' : 'Customer'} Profile in Directory">
                                <span>View</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </button>
                            <span style="font-size:0.7rem; font-weight:800; background:#F4F4F5; color:#18181B; padding:0.15rem 0.5rem; border-radius:4px; border:1px solid #E4E4E7;">
                                ${isClientRecipient ? 'B2B Client' : 'Customer'}
                            </span>
                        </div>
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
                        <span style="font-size:0.72rem; font-weight:800; background:#FFFFFF; color:#18181B; padding:0.15rem 0.55rem; border-radius:999px;">
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
                        <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:800; color:#18181B;">${escapeHtml(resolveInvoiceWorkerId(invoice))}</code>
                    </div>
                    <div class="origin-field-box">
                        <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:#71717A; display:block; margin-bottom:0.25rem;">Workspace ID:</span>
                        <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:800; color:#18181B;">${escapeHtml(resolveInvoiceWorkspaceId(invoice))}</code>
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
        try { sessionStorage.removeItem('pricelister_return_person'); } catch(e) {}
        if (typeof options.onBack === 'function') {
            options.onBack();
        }
    });

    targetContainer.querySelector('#btn-detail-back-to-person')?.addEventListener('click', () => {
        if (!returnPersonNav) return;
        try {
            sessionStorage.removeItem('pricelister_return_person');
            sessionStorage.setItem('pricelister_target_person_detail', JSON.stringify({
                mode: returnPersonNav.mode,
                id: returnPersonNav.id,
                uniqueId: returnPersonNav.uniqueId,
                name: returnPersonNav.name
            }));
        } catch(e) {}

        const targetRoute = '/' + (returnPersonNav.mode || 'businesses');
        if (window.navigateToRoute) {
            window.navigateToRoute(targetRoute);
        } else {
            window.location.hash = '#' + targetRoute;
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

    // View Issuer Business Profile directly from Invoice card
    targetContainer.querySelector('#btn-view-issuer-contact')?.addEventListener('click', () => {
        const targetBusId = invoice.businessId || invoice.issuerId || (foundBus?.id || foundBus?.uniqueId || '');
        const targetBusName = busName || foundBus?.name || '';
        const returnContext = {
            invoiceId: invoice.id || invoice.uniqueId,
            uniqueId: invoice.uniqueId || invoice.id,
            invoiceNumber: displayInvNumber,
            isBusinessInvoice: isBusinessInvoice,
            returnRoute: isBusinessInvoice ? '/invoices/business' : '/invoices/customer',
            invoice: invoice
        };
        try {
            sessionStorage.setItem('pricelister_return_invoice', JSON.stringify(returnContext));
            sessionStorage.setItem('pricelister_last_viewed_invoice', JSON.stringify(invoice));
            sessionStorage.setItem('pricelister_target_person_detail', JSON.stringify({
                mode: 'businesses',
                id: targetBusId,
                name: targetBusName,
                phone: busPhone || foundBus?.phone || '',
                email: busEmail || foundBus?.email || ''
            }));
        } catch(e) {}

        if (typeof options.onViewContact === 'function') {
            options.onViewContact('businesses', { id: targetBusId, name: targetBusName, returnContext });
            return;
        }

        if (window.navigateToRoute) {
            window.navigateToRoute('/businesses');
        } else {
            window.location.hash = '#/businesses';
        }
    });

    // View Recipient Customer / Client Profile directly from Invoice card
    targetContainer.querySelector('#btn-view-recipient-contact')?.addEventListener('click', () => {
        const targetRecId = invoice.customerId || invoice.clientId || invoice.recipientId || (foundRec?.id || foundRec?.uniqueId || '');
        const targetRecName = custName || foundRec?.name || foundRec?.customerName || foundRec?.clientName || '';
        const targetMode = isClientRecipient ? 'clients' : 'customers';
        const targetRoute = isClientRecipient ? '/clients' : '/customers';
        const returnContext = {
            invoiceId: invoice.id || invoice.uniqueId,
            uniqueId: invoice.uniqueId || invoice.id,
            invoiceNumber: displayInvNumber,
            isBusinessInvoice: isBusinessInvoice,
            returnRoute: isBusinessInvoice ? '/invoices/business' : '/invoices/customer',
            invoice: invoice
        };
        try {
            sessionStorage.setItem('pricelister_return_invoice', JSON.stringify(returnContext));
            sessionStorage.setItem('pricelister_last_viewed_invoice', JSON.stringify(invoice));
            sessionStorage.setItem('pricelister_target_person_detail', JSON.stringify({
                mode: targetMode,
                id: targetRecId,
                name: targetRecName,
                phone: custPhone || foundRec?.phone || '',
                email: custEmail || foundRec?.email || ''
            }));
        } catch(e) {}

        if (typeof options.onViewContact === 'function') {
            options.onViewContact(targetMode, { id: targetRecId, name: targetRecName, returnContext });
            return;
        }

        if (window.navigateToRoute) {
            window.navigateToRoute(targetRoute);
        } else {
            window.location.hash = '#' + targetRoute;
        }
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
