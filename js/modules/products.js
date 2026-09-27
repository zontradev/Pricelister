import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { storageService } from '../../supabase/storage.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';

export const renderProducts = async (container, workspaceId) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    let categoriesList = [];
    let activeProducts = [];
    let allInvoices = [];
    let activeProductDetail = null; // When set, renders dedicated analytical Product Detail View

    // Fetch all historical invoices to power real product sales analytics
    const fetchAllInvoices = async () => {
        try {
            const [custInvs, busInvs] = await Promise.all([
                invoiceService.getAllInvoices(false).catch(() => []),
                invoiceService.getAllInvoices(true).catch(() => [])
            ]);
            allInvoices = [...custInvs, ...busInvs];
        } catch (e) {
            console.warn("Could not fetch invoices for product analytics:", e);
            allInvoices = [];
        }
    };

    // Calculate detailed real-time analytics for a specific product
    const calculateProductAnalytics = (product) => {
        if (!product) return null;

        const pId = String(product.id || '');
        const pUniqueId = String(product.uniqueId || '');
        const pName = String(product.name || '').trim().toLowerCase();

        // Find all invoices and line items matching this product
        const matchedInvoicesWithItems = [];
        let totalUnitsSold = 0;
        let totalRevenue = 0;
        let totalProfit = 0;
        const customerPurchases = {}; // customerKey -> { name, contact, totalUnits, totalSpent, lastTimestamp }

        allInvoices.forEach(inv => {
            const items = inv.items || [];
            const matchingItems = items.filter(item => {
                const itemId = String(item.productId || '');
                const itemName = String(item.productName || '').trim().toLowerCase();
                return (pId && itemId === pId) || (pUniqueId && itemId === pUniqueId) || (itemName && itemName === pName);
            });

            if (matchingItems.length > 0) {
                let invUnitsForProd = 0;
                let invRevForProd = 0;
                let invProfitForProd = 0;

                matchingItems.forEach(item => {
                    const qty = Number(item.quantity) || 1;
                    const unitPrice = Number(item.unitPrice) || Number(product.salePrice) || 0;
                    const unitCost = Number(item.unitCost) || Number(product.price) || 0;
                    const lineTotal = Number(item.totalPrice) || (qty * unitPrice);
                    const lineProfit = (item.itemProfit !== undefined && item.itemProfit !== null) 
                        ? Number(item.itemProfit) 
                        : (lineTotal - (qty * unitCost));

                    invUnitsForProd += qty;
                    invRevForProd += lineTotal;
                    invProfitForProd += lineProfit;

                    totalUnitsSold += qty;
                    totalRevenue += lineTotal;
                    totalProfit += lineProfit;
                });

                const custName = inv.customerName || inv.clientName || inv.businessName || 'Walk-in Customer';
                const custContact = inv.customerNumber || inv.clientPhone || inv.clientEmail || '';
                const custKey = (custName + '_' + custContact).toLowerCase();

                if (!customerPurchases[custKey]) {
                    customerPurchases[custKey] = {
                        name: custName,
                        contact: custContact,
                        totalUnits: 0,
                        totalSpent: 0,
                        lastTimestamp: inv.timestamp || Date.now(),
                        invoicesCount: 0
                    };
                }
                customerPurchases[custKey].totalUnits += invUnitsForProd;
                customerPurchases[custKey].totalSpent += invRevForProd;
                customerPurchases[custKey].invoicesCount += 1;
                if ((inv.timestamp || 0) > customerPurchases[custKey].lastTimestamp) {
                    customerPurchases[custKey].lastTimestamp = inv.timestamp;
                }

                matchedInvoicesWithItems.push({
                    invoice: inv,
                    unitsSold: invUnitsForProd,
                    revenue: invRevForProd,
                    profit: invProfitForProd,
                    unitPrice: matchingItems[0]?.unitPrice || product.salePrice || 0,
                    timestamp: inv.timestamp || (inv.createdAt ? new Date(inv.createdAt).getTime() : Date.now())
                });
            }
        });

        // Sort matched invoices newest first
        matchedInvoicesWithItems.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

        // Favorite / Top Customers ranking (which customer likes it more)
        const topCustomers = Object.values(customerPurchases)
            .sort((a, b) => b.totalUnits - a.totalUnits || b.totalSpent - a.totalSpent);

        // Last sale report
        const lastSale = matchedInvoicesWithItems[0] || null;

        // 6-Month Trend Data for SVG Chart
        const now = new Date();
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthlyTrend.push({
                label: d.toLocaleString('default', { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
                units: 0,
                revenue: 0,
                profit: 0
            });
        }

        matchedInvoicesWithItems.forEach(entry => {
            const d = new Date(entry.timestamp);
            const m = d.getMonth();
            const y = d.getFullYear();
            const slot = monthlyTrend.find(s => s.month === m && s.year === y);
            if (slot) {
                slot.units += entry.unitsSold;
                slot.revenue += entry.revenue;
                slot.profit += entry.profit;
            }
        });

        // Market Demand & Inventory Velocity Analysis
        // Average units sold per month over the 6-month window
        const totalRecentUnits = monthlyTrend.reduce((acc, curr) => acc + curr.units, 0);
        const monthlyVelocity = totalRecentUnits > 0 ? (totalRecentUnits / 6) : (totalUnitsSold > 0 ? totalUnitsSold : 0);
        const currentStock = Number(product.quantity) || 0;

        let demandRating = 'Stable';
        let demandBadgeClass = 'demand-badge-stable';
        if (monthlyVelocity >= 25 || totalUnitsSold >= 50) {
            demandRating = 'High Demand 🔥';
            demandBadgeClass = 'demand-badge-high';
        } else if (monthlyVelocity >= 10 || totalUnitsSold >= 20) {
            demandRating = 'Moderate Demand 📈';
            demandBadgeClass = 'demand-badge-moderate';
        } else if (totalUnitsSold === 0) {
            demandRating = 'No Sales Yet ⏳';
            demandBadgeClass = 'demand-badge-slow';
        }

        // Days of stock remaining calculation
        let stockRunoutDays = 'N/A';
        let stockRunoutMsg = 'Sufficient stock level';
        if (monthlyVelocity > 0) {
            const dailyBurn = monthlyVelocity / 30;
            const days = Math.round(currentStock / dailyBurn);
            stockRunoutDays = `~${days} Days`;
            if (days <= 7) {
                stockRunoutMsg = '🚨 Critical: Stock runout imminent';
            } else if (days <= 21) {
                stockRunoutMsg = '⚠️ Restock recommended soon';
            } else {
                stockRunoutMsg = '✅ Healthy inventory buffer';
            }
        } else if (currentStock === 0) {
            stockRunoutDays = '0 Days';
            stockRunoutMsg = '❌ Out of stock';
        }

        // Recommended reorder quantity
        const recommendedReorder = Math.max(15, Math.ceil(monthlyVelocity * 1.5));

        // Margin & Profitability %
        const unitCost = Number(product.price) || 0;
        const unitSalePrice = Number(product.salePrice) || 0;
        const unitGrossProfit = unitSalePrice - unitCost;
        const unitMarginPercent = unitSalePrice > 0 ? ((unitGrossProfit / unitSalePrice) * 100) : 0;
        const overallMarginPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : unitMarginPercent;

        return {
            invoiceCount: matchedInvoicesWithItems.length,
            totalUnitsSold,
            totalRevenue,
            totalProfit,
            overallMarginPercent,
            unitGrossProfit,
            unitMarginPercent,
            lastSale,
            topCustomers,
            monthlyTrend,
            demandRating,
            demandBadgeClass,
            monthlyVelocity: Math.round(monthlyVelocity * 10) / 10,
            stockRunoutDays,
            stockRunoutMsg,
            recommendedReorder,
            invoicesList: matchedInvoicesWithItems
        };
    };

    // Helper: Generate Smooth Interactive SVG Curve Area Chart
    const generateProductTrendSvg = (monthlyTrend) => {
        const width = 640;
        const height = 200;
        const padding = { top: 20, right: 30, bottom: 35, left: 50 };

        const maxRev = Math.max(...monthlyTrend.map(m => m.revenue), 100);
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;

        const points = monthlyTrend.map((d, i) => {
            const x = padding.left + (i * (chartW / (monthlyTrend.length - 1 || 1)));
            const y = padding.top + chartH - ((d.revenue / maxRev) * chartH);
            return { x, y, ...d };
        });

        const lineD = points.reduce((acc, p, i, arr) => {
            if (i === 0) return `M ${p.x} ${p.y}`;
            const prev = arr[i - 1];
            const cx1 = prev.x + (p.x - prev.x) / 2;
            const cy1 = prev.y;
            const cx2 = prev.x + (p.x - prev.x) / 2;
            const cy2 = p.y;
            return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
        }, '');

        const areaD = `${lineD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

        return `
            <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; overflow:visible; display:block;">
                <defs>
                    <linearGradient id="prdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#e11d48" stop-opacity="0.32" />
                        <stop offset="100%" stop-color="#e11d48" stop-opacity="0.01" />
                    </linearGradient>
                </defs>
                
                <!-- Grid Lines -->
                <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
                <line x1="${padding.left}" y1="${padding.top + chartH/2}" x2="${width - padding.right}" y2="${padding.top + chartH/2}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
                <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(0,0,0,0.12)" />

                <!-- Y-Axis Values -->
                <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="#94a3b8" text-anchor="end" font-weight="600">${formatCurrency(maxRev)}</text>
                <text x="${padding.left - 8}" y="${padding.top + chartH/2 + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${formatCurrency(maxRev/2)}</text>
                <text x="${padding.left - 8}" y="${height - padding.bottom + 4}" font-size="10" fill="#94a3b8" text-anchor="end">0</text>

                <!-- Area Fill -->
                <path d="${areaD}" fill="url(#prdGrad)" />

                <!-- Line Curve -->
                <path d="${lineD}" fill="none" stroke="#e11d48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Data Dots & X-Labels -->
                ${points.map((p) => `
                    <g class="chart-point-group" style="cursor:pointer;">
                        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="#e11d48" stroke-width="2.5" />
                        <text x="${p.x}" y="${height - 10}" font-size="11" fill="#64748b" text-anchor="middle" font-weight="600">${p.label}</text>
                        <title>${p.label}: ${formatCurrency(p.revenue)} (${p.units} units sold, ${formatCurrency(p.profit)} profit)</title>
                    </g>
                `).join('')}
            </svg>
        `;
    };

    // Render Dedicated Product Detail View
    const renderProductDetailView = (prd) => {
        activeProductDetail = prd;
        const analytics = calculateProductAnalytics(prd);
        const catName = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category)?.name || prd.category || 'General';

        container.innerHTML = `
            <div class="detail-view-container">
                <!-- Top Navigation & Action Bar -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom: 0.5rem;">
                    <button type="button" id="btn-back-to-products" class="btn btn-secondary" style="display:inline-flex; align-items:center; gap:0.45rem; font-weight:600; padding:0.55rem 1.1rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        Back to Products List
                    </button>
                    <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                        <button type="button" id="btn-detail-adjust-stock" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:0.35rem;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            Adjust Stock
                        </button>
                        <button type="button" id="btn-detail-duplicate" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:0.35rem;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Duplicate
                        </button>
                        <button type="button" id="btn-detail-edit" class="btn btn-primary" style="font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; background: linear-gradient(135deg, #ff3366 0%, #e11d48 55%, #be123c 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            Edit Product
                        </button>
                    </div>
                </div>

                <!-- HERO PRODUCT CARD -->
                <div class="detail-hero-card">
                    <div style="display:flex; gap:1.5rem; align-items:flex-start; flex-wrap:wrap;">
                        <!-- Product Image Box + Instant Upload Button -->
                        <div style="position:relative; width:115px; height:115px; flex-shrink:0;">
                            ${prd.imageUri 
                                ? `<img id="detail-prd-avatar" src="${prd.imageUri}" style="width:100%; height:100%; object-fit:cover; border-radius:14px; border:2px solid var(--border-color); box-shadow:0 4px 12px rgba(0,0,0,0.06);">`
                                : `<div id="detail-prd-avatar-placeholder" style="width:100%; height:100%; border-radius:14px; background:linear-gradient(135deg, #fce7f3 0%, #ffe4e6 100%); color:#e11d48; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:800; border:2px solid rgba(225,29,72,0.15);">📦</div>`
                            }
                            <label for="detail-img-file-input" style="position:absolute; bottom:-6px; right:-6px; width:34px; height:34px; border-radius:50%; background:#e11d48; color:#ffffff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 3px 8px rgba(225,29,72,0.4); border:2px solid #ffffff; transition:transform 0.2s;" title="Upload or change product photo">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                <input type="file" id="detail-img-file-input" accept="image/*" style="display:none;">
                            </label>
                        </div>

                        <!-- Product Identity & Meta Information -->
                        <div style="flex:1; min-width:260px;">
                            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.4rem;">
                                <h1 style="margin:0; font-size:1.65rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em;">${prd.name}</h1>
                                <span class="badge" style="background:rgba(225,29,72,0.1); color:#e11d48; font-weight:700; padding:0.25rem 0.65rem; border-radius:6px;">${catName}</span>
                                <span class="${analytics.demandBadgeClass}">${analytics.demandRating}</span>
                            </div>

                            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap; margin-bottom:0.75rem; font-size:0.85rem; color:var(--text-secondary);">
                                ${prd.sizeWeight ? `<span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px; font-weight:600;">⚖️ ${prd.sizeWeight}</span>` : ''}
                                ${prd.upcCode ? `<span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px; font-family:monospace; font-weight:700;">Barcode: ${prd.upcCode}</span>` : ''}
                                <span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px;">ID: <code style="font-family:monospace; font-size:0.8rem;">${prd.uniqueId || prd.id}</code></span>
                                ${prd.expDate ? `<span style="color:#d97706; font-weight:600;">⏳ Exp: ${prd.expDate}</span>` : ''}
                            </div>

                            <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); max-width:750px;">
                                ${prd.note ? `<strong>Note:</strong> ${prd.note}` : '<em style="color:var(--text-muted)">No description note provided.</em>'}
                            </p>
                        </div>

                        <!-- Quick Inventory & Price Summary Tag -->
                        <div style="text-align:right; min-width:180px; padding:0.85rem 1.15rem; background:var(--surface-50); border-radius:12px; border:1px solid var(--border-color);">
                            <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Selling Price</div>
                            <div style="font-size:1.6rem; font-weight:800; color:var(--primary); line-height:1.1;">${formatCurrency(prd.salePrice)}</div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem;">
                                Cost: <strong>${formatCurrency(prd.price || 0)}</strong> &bull; Profit: <strong style="color:#059669;">+${formatCurrency(analytics.unitGrossProfit)}</strong>
                            </div>
                            <div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-color); font-size:0.82rem; font-weight:700; color:${(prd.quantity || 0) > 5 ? '#059669' : '#dc2626'};">
                                📦 ${(prd.quantity || 0) > 0 ? `${prd.quantity} Units in Stock` : 'Out of Stock (0 Units)'}
                            </div>
                        </div>
                    </div>

                    <!-- 6 ANALYTICAL KPI METRIC CARDS -->
                    <div class="detail-kpi-grid">
                        <!-- KPI 1: Invoices Made -->
                        <div class="detail-kpi-card highlight-red">
                            <div class="detail-kpi-label">
                                <span>Invoices Generated</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="detail-kpi-value" style="color:#e11d48;">${analytics.invoiceCount}</div>
                            <div class="detail-kpi-sub">Total sales receipts issued</div>
                        </div>

                        <!-- KPI 2: Total Revenue -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Total Revenue</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${formatCurrency(analytics.totalRevenue)}</div>
                            <div class="detail-kpi-sub">Gross sales from this item</div>
                        </div>

                        <!-- KPI 3: Total Gross Profit -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Gross Profit</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                            </div>
                            <div class="detail-kpi-value" style="color:#059669;">${formatCurrency(analytics.totalProfit)}</div>
                            <div class="detail-kpi-sub">${Math.round(analytics.overallMarginPercent)}% net gross margin</div>
                        </div>

                        <!-- KPI 4: Total Units Sold -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Total Units Sold</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${analytics.totalUnitsSold}</div>
                            <div class="detail-kpi-sub">${analytics.monthlyVelocity} units / mo velocity</div>
                        </div>

                        <!-- KPI 5: Last Sale Report -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Last Sale Report</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            </div>
                            <div class="detail-kpi-value" style="font-size:1.15rem; font-weight:700;">
                                ${analytics.lastSale ? (analytics.lastSale.timestamp ? new Date(analytics.lastSale.timestamp).toLocaleDateString() : 'Recent') : 'No Sales Yet'}
                            </div>
                            <div class="detail-kpi-sub">
                                ${analytics.lastSale ? `Buyer: ${analytics.lastSale.invoice.customerName || 'Customer'} (${analytics.lastSale.unitsSold} pcs)` : 'Awaiting first order'}
                            </div>
                        </div>

                        <!-- KPI 6: Stock Runout Forecast -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Stock Runout</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${analytics.stockRunoutDays}</div>
                            <div class="detail-kpi-sub">${analytics.stockRunoutMsg}</div>
                        </div>
                    </div>
                </div>

                <!-- 2-COLUMN DEEP ANALYTICAL SECTION -->
                <div style="display:grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap:1.5rem; align-items:start;">
                    
                    <!-- LEFT COLUMN: 6-MONTH TREND & INVOICE HISTORY -->
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        
                        <!-- 6-Month Sales & Revenue Trend Chart -->
                        <div class="card" style="padding:1.5rem; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                                <div>
                                    <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700;">6-Month Sales & Revenue Trend</h3>
                                    <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Monthly revenue, sales volume, and demand fluctuations</p>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; font-weight:600; color:var(--primary);">
                                    <span style="width:10px; height:10px; border-radius:50%; background:#e11d48; display:inline-block;"></span>
                                    Gross Revenue ($)
                                </div>
                            </div>
                            
                            <!-- Dynamic SVG Trend Curve -->
                            <div style="background:var(--surface-50); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
                                ${generateProductTrendSvg(analytics.monthlyTrend)}
                            </div>
                        </div>

                        <!-- Invoices History Table for this Product -->
                        <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                            <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700;">Invoices History</h3>
                                    <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">All invoices containing <strong>${prd.name}</strong></p>
                                </div>
                                <span class="badge" style="background:var(--surface-100); color:var(--text-primary); font-weight:700;">
                                    ${analytics.invoicesList.length} Records
                                </span>
                            </div>

                            <div class="table-container">
                                <table style="width:100%; border-collapse:collapse; text-align:left;">
                                    <thead>
                                        <tr style="background:var(--surface-50); border-bottom:2px solid var(--border-color); color:var(--text-muted); font-size:0.82rem;">
                                            <th style="padding:0.75rem 1.25rem;">Invoice #</th>
                                            <th style="padding:0.75rem;">Date</th>
                                            <th style="padding:0.75rem;">Customer / Client</th>
                                            <th style="padding:0.75rem; text-align:center;">Qty</th>
                                            <th style="padding:0.75rem;">Line Total</th>
                                            <th style="padding:0.75rem 1.25rem; text-align:right;">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${analytics.invoicesList.length === 0 ? `
                                            <tr>
                                                <td colspan="6" style="padding:2.5rem; text-align:center; color:var(--text-muted);">
                                                    No invoices have included this product yet.
                                                </td>
                                            </tr>
                                        ` : analytics.invoicesList.slice(0, 15).map(item => `
                                            <tr style="border-bottom:1px solid var(--border-color); font-size:0.88rem;">
                                                <td style="padding:0.85rem 1.25rem;">
                                                    <code style="font-weight:700; color:var(--text-primary); font-size:0.82rem;">${item.invoice.invoiceNumber || item.invoice.busInvNumber || item.invoice.uniqueId || 'INV'}</code>
                                                </td>
                                                <td style="padding:0.85rem; color:var(--text-secondary);">
                                                    ${item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Recent'}
                                                </td>
                                                <td style="padding:0.85rem;">
                                                    <strong>${item.invoice.customerName || item.invoice.clientName || item.invoice.businessName || 'Customer'}</strong>
                                                </td>
                                                <td style="padding:0.85rem; text-align:center; font-weight:700; color:var(--primary);">
                                                    ${item.unitsSold}
                                                </td>
                                                <td style="padding:0.85rem; font-weight:700;">
                                                    ${formatCurrency(item.revenue)}
                                                </td>
                                                <td style="padding:0.85rem 1.25rem; text-align:right;">
                                                    <button type="button" class="btn btn-sm btn-secondary view-inv-from-prd" data-invid="${item.invoice.id}" style="padding:0.25rem 0.65rem; font-size:0.78rem;">
                                                        View Invoice
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN: FAVORITE CUSTOMERS & MARKET DEMAND -->
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        
                        <!-- FAVORITE CUSTOMERS ("WHICH CUSTOMER LIKES MORE") -->
                        <div class="card" style="padding:1.5rem; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.15rem;">
                                <div>
                                    <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700;">⭐ Favorite Customers</h3>
                                    <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Top buyers ranked by purchase volume & demand</p>
                                </div>
                                <span class="badge" style="background:rgba(225,29,72,0.1); color:#e11d48; font-weight:700;">
                                    ${analytics.topCustomers.length} Buyers
                                </span>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:0.65rem;">
                                ${analytics.topCustomers.length === 0 ? `
                                    <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.85rem; background:var(--surface-50); border-radius:10px;">
                                        No customer purchase history available for this product.
                                    </div>
                                ` : analytics.topCustomers.slice(0, 6).map((cust, idx) => `
                                    <div class="fav-customer-item">
                                        <div style="display:flex; align-items:center; gap:0.75rem;">
                                            <div style="width:36px; height:36px; border-radius:50%; background:${idx === 0 ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)' : 'var(--surface-200)'}; color:${idx === 0 ? '#ffffff' : 'var(--text-primary)'}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                                                ${idx === 0 ? '👑' : (idx + 1)}
                                            </div>
                                            <div>
                                                <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${cust.name}</div>
                                                <div style="font-size:0.75rem; color:var(--text-muted);">${cust.contact || `${cust.invoicesCount} orders`} &bull; Last: ${new Date(cust.lastTimestamp).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div style="text-align:right;">
                                            <div style="font-weight:800; color:var(--primary); font-size:0.95rem;">${cust.totalUnits} Units</div>
                                            <div style="font-size:0.78rem; font-weight:600; color:var(--text-secondary);">${formatCurrency(cust.totalSpent)}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- MARKET DEMAND & PRICING INTELLIGENCE -->
                        <div class="card" style="padding:1.5rem; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                            <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700;">📊 Market Demand & Pricing</h3>
                            <p style="margin:0 0 1.25rem 0; font-size:0.82rem; color:var(--text-secondary);">Demand velocity, price margins, and restocking analysis</p>

                            <div style="display:flex; flex-direction:column; gap:1rem;">
                                <!-- Demand Velocity Rating -->
                                <div style="background:var(--surface-50); padding:1rem; border-radius:10px; border:1px solid var(--border-color);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">Sales Velocity</span>
                                        <span class="${analytics.demandBadgeClass}">${analytics.demandRating}</span>
                                    </div>
                                    <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary);">${analytics.monthlyVelocity} <span style="font-size:0.85rem; font-weight:500; color:var(--text-muted);">units / month</span></div>
                                    <div class="perf-bar-wrap">
                                        <div class="perf-bar-fill" style="width:${Math.min(100, (analytics.monthlyVelocity / 30) * 100)}%;"></div>
                                    </div>
                                </div>

                                <!-- Restock Recommendation -->
                                <div style="background:var(--surface-50); padding:1rem; border-radius:10px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.25rem;">Smart Restock Recommendation</div>
                                    <div style="font-size:1.15rem; font-weight:800; color:#2563eb;">Order +${analytics.recommendedReorder} Units</div>
                                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">Maintains a healthy 45-day supply buffer based on current burn rate.</div>
                                </div>

                                <!-- Pricing & Profit Breakdown -->
                                <div style="background:var(--surface-50); padding:1rem; border-radius:10px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.6rem;">Unit Profitability Breakdown</div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.85rem;">
                                        <span style="color:var(--text-secondary);">Unit Cost Price:</span>
                                        <strong>${formatCurrency(prd.price || 0)}</strong>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.85rem;">
                                        <span style="color:var(--text-secondary);">Unit Selling Price:</span>
                                        <strong>${formatCurrency(prd.salePrice || 0)}</strong>
                                    </div>
                                    ${prd.mrp ? `
                                        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.85rem;">
                                            <span style="color:var(--text-secondary);">MRP (Max Retail):</span>
                                            <strong>${formatCurrency(prd.mrp)}</strong>
                                        </div>
                                    ` : ''}
                                    <div style="display:flex; justify-content:space-between; padding-top:0.5rem; margin-top:0.5rem; border-top:1px solid var(--border-color); font-size:0.9rem;">
                                        <span style="font-weight:700; color:var(--text-primary);">Net Markup Margin:</span>
                                        <strong style="color:#059669;">+${formatCurrency(analytics.unitGrossProfit)} (${Math.round(analytics.unitMarginPercent)}%)</strong>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>

                </div>
            </div>
        `;

        // Attach Detail View Events
        const btnBack = container.querySelector('#btn-back-to-products');
        if (btnBack) {
            btnBack.addEventListener('click', () => {
                activeProductDetail = null;
                renderProductMainView();
            });
        }

        // Edit Product from Detail View
        const btnEditDetail = container.querySelector('#btn-detail-edit');
        if (btnEditDetail) {
            btnEditDetail.addEventListener('click', () => {
                activeProductDetail = null;
                renderProductMainView();
                // Trigger edit form
                setTimeout(() => {
                    const editBtn = container.querySelector(`.edit-prd[data-id="${prd.id}"]`);
                    if (editBtn) editBtn.click();
                }, 50);
            });
        }

        // Duplicate Product from Detail View
        const btnDupDetail = container.querySelector('#btn-detail-duplicate');
        if (btnDupDetail) {
            btnDupDetail.addEventListener('click', async () => {
                if (await showAlert.confirm(`Duplicate ${prd.name}?`)) {
                    try {
                        await productService.duplicateProduct(prd, currentUser.uid);
                        showAlert.success('Product duplicated');
                        await loadData();
                        activeProductDetail = null;
                        renderProductMainView();
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        }

        // Adjust Stock (+ / - count prompt)
        const btnAdjustStock = container.querySelector('#btn-detail-adjust-stock');
        if (btnAdjustStock) {
            btnAdjustStock.addEventListener('click', async () => {
                const inputVal = prompt(`Adjust Stock for "${prd.name}":\nEnter new total inventory quantity:`, prd.quantity || 0);
                if (inputVal !== null && inputVal.trim() !== '') {
                    const newQty = parseInt(inputVal, 10);
                    if (!isNaN(newQty) && newQty >= 0) {
                        try {
                            await productService.updateProduct(prd.id, { quantity: newQty });
                            prd.quantity = newQty;
                            showAlert.success(`Stock updated to ${newQty} units`);
                            renderProductDetailView(prd);
                        } catch (err) {
                            showAlert.error(err.message || 'Failed to update stock');
                        }
                    } else {
                        showAlert.error('Please enter a valid positive integer.');
                    }
                }
            });
        }

        // 1-Click Photo Upload directly from detail hero
        const imgInput = container.querySelector('#detail-img-file-input');
        if (imgInput) {
            imgInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    try {
                        showAlert.info('Uploading product photo...');
                        const url = await storageService.uploadImage(file, workspaceId);
                        await productService.updateProduct(prd.id, { imageUri: url });
                        prd.imageUri = url;
                        showAlert.success('Photo updated successfully!');
                        renderProductDetailView(prd);
                    } catch (err) {
                        showAlert.error('Image upload failed: ' + err.message);
                    }
                }
            });
        }

        // View Invoice from product history
        container.querySelectorAll('.view-inv-from-prd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const invId = e.target.getAttribute('data-invid');
                const matchedInv = allInvoices.find(i => i.id === invId);
                if (matchedInv) {
                    openInvoiceViewerModal(matchedInv);
                }
            });
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Main Product View Layout (List + Form + Modals)
    const renderProductMainView = () => {
        container.innerHTML = `
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.25rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <h2 style="margin:0 0 0.25rem 0;">Products</h2>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Manage your product catalog, prices, categories, and inventory</p>
                </div>
                <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <button id="btn-market-inserter" class="btn btn-primary" style="display:flex; align-items:center; gap:0.4rem; font-weight:700; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow:0 3px 10px rgba(16, 185, 129, 0.25);" title="Open Market Inserter spreadsheet grid (up to 250 products)">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                        Market Inserter
                    </button>
                    <button id="btn-import-excel" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Import Excel
                    </button>
                    <button id="btn-export-products" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Export
                    </button>
                    <button id="btn-add-product" class="btn btn-primary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add Product
                    </button>
                </div>
            </div>

            <!-- CUSTOM CATEGORY MODAL -->
            <div id="quick-category-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
                <div class="card" style="background:white; width:100%; max-width:400px; padding:2rem; border-radius:var(--radius-md);">
                    <h3 style="margin-bottom:1rem; color:var(--primary);">Create Category</h3>
                    <div style="display:flex; flex-direction:column; gap:1rem;">
                        <div>
                            <label>Category Name *</label>
                            <input type="text" id="quick-cat-name" class="form-control" style="width:100%; padding:0.5rem;" placeholder="e.g. Beverages">
                        </div>
                        <div>
                            <label>Color</label>
                            <input type="color" id="quick-cat-color" value="#4a90e2" class="form-control" style="width:100%; height:40px; padding:0.25rem;">
                        </div>
                        <div style="display:flex; gap:1rem; margin-top:1rem;">
                            <button type="button" id="quick-cat-save-btn" class="btn btn-primary" style="flex:1;">Save</button>
                            <button type="button" id="quick-cat-cancel-btn" class="btn btn-secondary" style="flex:1;">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PRODUCT FORM CONTAINER -->
            <div id="product-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem;">
                <h3 id="prd-form-title">New Product</h3>
                <form id="product-form" style="display:flex; flex-direction:column; gap:1.5rem; margin-top: 1rem;">
                    <input type="hidden" id="prd-id">
                    
                    <div class="form-section">
                        <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 1 — BASIC INFORMATION</h4>
                        
                        <div style="display:flex; gap:1rem; margin-bottom: 1rem; align-items: flex-end;">
                            <div style="flex:1;">
                                <label>Product Image (URL)</label>
                                <input type="text" id="prd-image" class="form-control" style="width:100%; padding:0.5rem;" placeholder="https://...">
                            </div>
                            <div style="flex:1; display:flex; gap:1rem; align-items:center;">
                                <span style="color:var(--text-muted); font-size:0.9rem;">OR</span>
                                <label class="btn btn-secondary" style="cursor:pointer; margin:0; padding:0.5rem 1rem;">
                                    Upload from Desktop
                                    <input type="file" id="prd-image-file" accept="image/*" style="display:none;">
                                </label>
                                <img id="prd-image-preview" src="" style="display:none; max-height:40px; border-radius:4px; border:1px solid var(--border-color);">
                            </div>
                        </div>

                        <div style="display:flex; gap:1rem; margin-bottom: 1rem;">
                            <div style="flex:2;">
                                <label>Product Name *</label>
                                <input type="text" id="prd-name" required class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                            <div style="flex:1;">
                                <label>Size / Weight</label>
                                <input type="text" id="prd-size" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>

                        <div style="display:flex; gap:1rem; margin-bottom: 1rem;">
                            <div style="flex:1; display: flex; align-items: flex-end; gap: 0.5rem;">
                                <div style="flex:1;">
                                    <label>Category *</label>
                                    <select id="prd-category" required class="form-control" style="width:100%; padding:0.5rem;">
                                        <option value="">Loading...</option>
                                    </select>
                                </div>
                                <button type="button" id="btn-quick-cat" class="btn btn-secondary" style="padding:0.5rem 1rem;" title="Create New Category">+</button>
                            </div>
                            <div style="flex:1;">
                                <label>UPC Code</label>
                                <input type="text" id="prd-upc" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>
                        
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1;">
                                <label>Note</label>
                                <input type="text" id="prd-note" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 2 — INVENTORY</h4>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1; max-width: 200px;">
                                <label>Stock / Qty *</label>
                                <input type="number" id="prd-qty" value="0" min="0" required class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 3 — PRICING</h4>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1;">
                                <label>Cost Price</label>
                                <input type="number" id="prd-cost-price" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                            <div style="flex:1;">
                                <label>Sale Price *</label>
                                <input type="number" id="prd-sale-price" step="0.01" min="0" required class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                            <div style="flex:1;">
                                <label>Base Price</label>
                                <input type="number" id="prd-base-price" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                            <div style="flex:1;">
                                <label>MRP</label>
                                <input type="number" id="prd-mrp" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 4 — DATES</h4>
                        <div style="display:flex; gap:1rem;">
                            <div style="flex:1;">
                                <label>Manufacturing Date</label>
                                <input type="date" id="prd-mfg-date" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                            <div style="flex:1;">
                                <label>Expiration Date</label>
                                <input type="date" id="prd-exp-date" class="form-control" style="width:100%; padding:0.5rem;">
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
                            <h4 style="margin:0;">SECTION 5 — VARIATIONS (SIZE/FLAVOR & UPC)</h4>
                            <button type="button" id="btn-add-variation-row" class="btn btn-secondary" style="font-size:0.8rem; padding:0.35rem 0.75rem; display:flex; align-items:center; gap:4px; font-weight:600;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                + Add Variation
                            </button>
                        </div>
                        <div id="prd-variations-list" style="display:flex; flex-direction:column; gap:0.6rem;">
                            <!-- Dynamic variation rows inserted here -->
                        </div>
                        <div id="prd-no-variations-msg" style="color:var(--text-muted); font-size:0.85rem; font-style:italic; padding:0.5rem 0;">
                            No variations added. Click "+ Add Variation" to create size/flavor and UPC code options.
                        </div>
                    </div>

                    <div style="display:flex; gap:1rem; margin-top:1rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" id="prd-submit-btn">Save Product</button>
                        <button type="button" class="btn btn-secondary" id="prd-cancel-btn">Cancel</button>
                    </div>
                </form>
            </div>
            
            <!-- PRODUCT LIST CONTAINER -->
            <div id="product-list-container">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding: 1rem; background: var(--surface-50); border-radius: var(--radius-md); border: 1px solid var(--border-color); flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; gap: 1rem; flex: 1; flex-wrap:wrap;">
                        <select id="filter-sort" class="form-control" style="padding: 0.5rem; max-width: 250px;">
                            <option value="recent_created">Recently Created (Default)</option>
                            <option value="recent_updated">Recently Updated</option>
                            <option value="expire">Close to Expire</option>
                            <option value="az">A-Z</option>
                            <option value="oldest">Oldest</option>
                            <option value="low_qty">Low Quantity</option>
                            <option value="high_price">Highest Price</option>
                        </select>
                        <select id="filter-category" class="form-control" style="padding: 0.5rem; max-width: 250px;">
                            <option value="all">All Categories</option>
                        </select>
                    </div>
                    <div style="font-weight: 600; color: var(--text-muted);" id="product-count">0 Products</div>
                </div>

                <div class="table-container">
                    <table style="width:100%; border-collapse: collapse; text-align:left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                                <th style="padding:1rem; width: 60px;">Image</th>
                                <th style="padding:1rem;">Name</th>
                                <th style="padding:1rem;">Category</th>
                                <th style="padding:1rem;">Price</th>
                                <th style="padding:1rem;">Stock</th>
                                <th style="padding:1rem 1.25rem;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="product-list-body">
                            <!-- Injected dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        setupMainViewEvents();
        renderProductList();
    };

    const renderProductList = () => {
        const tbody = container.querySelector('#product-list-body');
        if (!tbody) return;

        const sortVal = container.querySelector('#filter-sort')?.value || 'recent_created';
        const catVal = container.querySelector('#filter-category')?.value || 'all';
        
        let filtered = activeProducts.slice();

        if (catVal !== 'all') {
            filtered = filtered.filter(p => {
                const uId = categoriesList.find(c => c.uniqueId === p.category || c.id === p.category || c.name === p.category)?.uniqueId || p.category;
                return uId === catVal || p.category === catVal;
            });
        }

        filtered.sort((a, b) => {
            switch(sortVal) {
                case 'recent_created':
                    return (b.timestamp || 0) - (a.timestamp || 0);
                case 'recent_updated':
                    return (b.updatedTimestamp || b.timestamp || 0) - (a.updatedTimestamp || a.timestamp || 0);
                case 'expire':
                    const dA = a.expDate ? new Date(a.expDate).getTime() : Infinity;
                    const dB = b.expDate ? new Date(b.expDate).getTime() : Infinity;
                    return dA - dB;
                case 'az':
                    return (a.name || '').localeCompare(b.name || '');
                case 'oldest':
                    return (a.timestamp || 0) - (b.timestamp || 0);
                case 'low_qty':
                    return (a.quantity || 0) - (b.quantity || 0);
                case 'high_price':
                    return (b.salePrice || 0) - (a.salePrice || 0);
                default:
                    return (b.timestamp || 0) - (a.timestamp || 0);
            }
        });

        const countEl = container.querySelector('#product-count');
        if (countEl) countEl.textContent = `${filtered.length} Products`;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:2.5rem; text-align:center; color: var(--text-muted);">No products found.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = filtered.map(prd => {
            const catName = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category)?.name || prd.category || 'General';
            const isCreatorSelf = prd.creatorId && (prd.creatorId === currentUser.uid || prd.creatorId.toLowerCase() === (currentUser.email || '').toLowerCase());
            const creatorTag = prd.creatorId 
                ? (isCreatorSelf 
                    ? `<span class="badge" style="background:rgba(16,185,129,0.12); color:#059669; font-size:0.72rem; padding:0.1rem 0.45rem; border-radius:4px; font-weight:600;" title="Created by you">By You</span>` 
                    : `<span class="badge" style="background:rgba(100,116,139,0.1); color:#64748b; font-size:0.72rem; padding:0.1rem 0.45rem; border-radius:4px;" title="Creator ID: ${prd.creatorId}">Creator: ${prd.creatorId.substring(0, 8)}</span>`)
                : '';

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                    <td style="padding:1rem;">
                        ${prd.imageUri 
                            ? `<img src="${prd.imageUri}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 8px; cursor:pointer;" class="view-prd-img" data-id="${prd.id}">` 
                            : `<div style="width: 44px; height: 44px; background: var(--surface-200); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.7rem; cursor:pointer;" class="view-prd-img" data-id="${prd.id}">None</div>`}
                    </td>
                    <td style="padding:1rem;">
                        <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.2rem;">
                            <strong style="cursor:pointer; color:var(--text-primary);" class="view-prd-title" data-id="${prd.id}">${prd.name}</strong>
                            ${creatorTag}
                        </div>
                        <small style="color:var(--text-muted)">${prd.sizeWeight ? prd.sizeWeight : ''} ${prd.upcCode ? ' | UPC: ' + prd.upcCode : ''}</small>
                    </td>
                    <td style="padding:1rem;"><span class="badge">${catName}</span></td>
                    <td style="padding:1rem; font-weight:700; color:var(--text-primary);">${formatCurrency(prd.salePrice)}</td>
                    <td style="padding:1rem;">
                        <span class="badge" style="background:${(prd.quantity || 0) > 5 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color:${(prd.quantity || 0) > 5 ? '#059669' : '#dc2626'}; font-weight:700;">
                            ${prd.quantity || 0}
                        </span>
                    </td>
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex; gap:0.4rem; align-items:center;">
                            <button class="btn btn-sm btn-primary view-prd" data-id="${prd.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem; font-weight:700; background:linear-gradient(135deg, #ff3366, #e11d48);">View</button>
                            <button class="btn btn-sm btn-secondary edit-prd" data-id="${prd.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem;">Edit</button>
                            <button class="btn btn-sm btn-secondary dup-prd" data-id="${prd.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem;">Duplicate</button>
                            <button class="btn btn-sm btn-outline del-prd" data-id="${prd.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem; color:var(--danger);">Delete</button>
                        </div>
                    </td>
                </tr>
            `}).join('');
            
        attachListEvents();
    };

    const attachListEvents = () => {
        // Dedicated View Panel Trigger
        const openDetail = (id) => {
            const prd = activeProducts.find(p => p.id === id);
            if (prd) {
                renderProductDetailView(prd);
            }
        };

        container.querySelectorAll('.view-prd, .view-prd-title, .view-prd-img').forEach(el => {
            el.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openDetail(id);
            });
        });

        // Edit
        container.querySelectorAll('.edit-prd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd) {
                    const formContainer = container.querySelector('#product-form-container');
                    container.querySelector('#prd-id').value = prd.id;
                    container.querySelector('#prd-image').value = prd.imageUri || '';
                    const preview = container.querySelector('#prd-image-preview');
                    if (prd.imageUri) {
                        preview.src = prd.imageUri;
                        preview.style.display = 'block';
                    } else {
                        preview.style.display = 'none';
                    }
                    
                    container.querySelector('#prd-name').value = prd.name || '';
                    container.querySelector('#prd-size').value = prd.sizeWeight || '';
                    const matchedCat = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category);
                    container.querySelector('#prd-category').value = matchedCat ? (matchedCat.uniqueId || matchedCat.id) : (prd.category || '');
                    container.querySelector('#prd-upc').value = prd.upcCode || '';
                    container.querySelector('#prd-note').value = prd.note || '';
                    
                    container.querySelector('#prd-qty').value = prd.quantity || 0;
                    
                    container.querySelector('#prd-cost-price').value = prd.price || '';
                    container.querySelector('#prd-sale-price').value = prd.salePrice || '';
                    container.querySelector('#prd-base-price').value = prd.basePrice || '';
                    container.querySelector('#prd-mrp').value = prd.mrp || '';
                    
                    container.querySelector('#prd-mfg-date').value = prd.mfgDate || '';
                    container.querySelector('#prd-exp-date').value = prd.expDate || '';
                    
                    // Populate Variations
                    clearVariations();
                    if (Array.isArray(prd.variations)) {
                        prd.variations.forEach(v => {
                            if (v && (v.sizeFlavor || v.upcCode)) {
                                addVariationRow(v.sizeFlavor || '', v.upcCode || '');
                            }
                        });
                    } else if (typeof prd.variations === 'string' && prd.variations.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(prd.variations);
                            if (Array.isArray(parsed)) {
                                parsed.forEach(v => addVariationRow(v.sizeFlavor || '', v.upcCode || ''));
                            }
                        } catch(e) {}
                    }
                    
                    container.querySelector('#prd-form-title').textContent = 'Edit Product';
                    container.querySelector('#prd-submit-btn').textContent = 'Update Product';
                    formContainer.style.display = 'block';
                    container.querySelector('#product-list-container').style.display = 'none';
                    formContainer.scrollIntoView({ behavior: 'smooth' });

                    initialProductSnapshot = getProductFormSnapshot();
                    checkProductDirty();
                }
            });
        });

        // Duplicate
        container.querySelectorAll('.dup-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd && await showAlert.confirm(`Duplicate ${prd.name}?`)) {
                    try {
                        await productService.duplicateProduct(prd, currentUser.uid);
                        showAlert.success('Product duplicated');
                        await loadData();
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });

        // Delete Product
        container.querySelectorAll('.del-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd && await showAlert.confirm(`Delete product "${prd.name}" permanently?`)) {
                    try {
                        await productService.deleteProduct(id);
                        showAlert.success('Product deleted successfully');
                        await loadData();
                    } catch (err) {
                        showAlert.error(err.message || 'Failed to delete product');
                    }
                }
            });
        });
    };

    // Product Smart Button State & Snapshot Helper
    let initialProductSnapshot = null;

    const getProductFormSnapshot = () => {
        const variations = [];
        container.querySelectorAll('.prd-variation-item-row').forEach(row => {
            variations.push({
                size: row.querySelector('.var-size-input')?.value.trim() || '',
                upc: row.querySelector('.var-upc-input')?.value.trim() || ''
            });
        });

        return JSON.stringify({
            image: container.querySelector('#prd-image')?.value.trim() || '',
            name: container.querySelector('#prd-name')?.value.trim() || '',
            size: container.querySelector('#prd-size')?.value.trim() || '',
            category: container.querySelector('#prd-category')?.value || '',
            upc: container.querySelector('#prd-upc')?.value.trim() || '',
            note: container.querySelector('#prd-note')?.value.trim() || '',
            qty: parseInt(container.querySelector('#prd-qty')?.value || 0, 10),
            cost: parseFloat(container.querySelector('#prd-cost-price')?.value || 0),
            sale: parseFloat(container.querySelector('#prd-sale-price')?.value || 0),
            base: parseFloat(container.querySelector('#prd-base-price')?.value || 0),
            mrp: parseFloat(container.querySelector('#prd-mrp')?.value || 0),
            mfg: container.querySelector('#prd-mfg-date')?.value || '',
            exp: container.querySelector('#prd-exp-date')?.value || '',
            variations
        });
    };

    const checkProductDirty = () => {
        const submitBtn = container.querySelector('#prd-submit-btn');
        if (!submitBtn) return;

        const name = container.querySelector('#prd-name')?.value.trim();
        const category = container.querySelector('#prd-category')?.value;
        const salePrice = container.querySelector('#prd-sale-price')?.value;
        const isEditMode = Boolean(container.querySelector('#prd-id')?.value);

        const hasRequired = Boolean(name && category && salePrice !== '' && !isNaN(parseFloat(salePrice)));

        if (!hasRequired) {
            submitBtn.disabled = true;
            return;
        }

        if (isEditMode && initialProductSnapshot) {
            const currentSnap = getProductFormSnapshot();
            submitBtn.disabled = (currentSnap === initialProductSnapshot);
        } else {
            submitBtn.disabled = false;
        }
    };

    const checkVariationsEmpty = () => {
        const varListEl = container.querySelector('#prd-variations-list');
        const varEmptyMsg = container.querySelector('#prd-no-variations-msg');
        if (!varListEl || !varEmptyMsg) return;
        varEmptyMsg.style.display = varListEl.children.length === 0 ? 'block' : 'none';
    };

    const clearVariations = () => {
        const varListEl = container.querySelector('#prd-variations-list');
        if (varListEl) varListEl.innerHTML = '';
        checkVariationsEmpty();
    };

    const addVariationRow = (sizeFlavor = '', upcCode = '') => {
        const varListEl = container.querySelector('#prd-variations-list');
        if (!varListEl) return;
        const row = document.createElement('div');
        row.className = 'prd-variation-item-row';
        row.style.cssText = 'display:flex; gap:0.75rem; align-items:center; background:var(--surface-50); padding:0.6rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);';
        row.innerHTML = `
            <div style="flex:2;">
                <input type="text" class="form-control var-size-input" placeholder="Size / Flavor / Variant (e.g. 500g, Strawberry)" value="${sizeFlavor || ''}" style="width:100%; padding:0.45rem; font-size:0.85rem;">
            </div>
            <div style="flex:2;">
                <input type="text" class="form-control var-upc-input" placeholder="UPC / Barcode (Optional)" value="${upcCode || ''}" style="width:100%; padding:0.45rem; font-size:0.85rem;">
            </div>
            <button type="button" class="btn-remove-var" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:4px 8px; font-size:1.3rem; line-height:1;" title="Remove variation">&times;</button>
        `;

        row.querySelectorAll('input').forEach(inp => {
            inp.addEventListener('input', checkProductDirty);
        });

        row.querySelector('.btn-remove-var').addEventListener('click', () => {
            row.remove();
            checkVariationsEmpty();
            checkProductDirty();
        });

        varListEl.appendChild(row);
        checkVariationsEmpty();
        checkProductDirty();
    };

    const setupMainViewEvents = () => {
        const formContainer = container.querySelector('#product-form-container');
        const form = container.querySelector('#product-form');
        const catSelect = container.querySelector('#prd-category');

        // Populate Category Dropdowns
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select Category</option>' + 
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
        }
        const filterCat = container.querySelector('#filter-category');
        if (filterCat) {
            filterCat.innerHTML = '<option value="all">All Categories</option>' + 
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
        }

        container.querySelector('#filter-sort')?.addEventListener('change', () => renderProductList());
        container.querySelector('#filter-category')?.addEventListener('change', () => renderProductList());

        const btnAddVar = container.querySelector('#btn-add-variation-row');
        if (btnAddVar) {
            btnAddVar.addEventListener('click', () => addVariationRow('', ''));
        }

        form?.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', checkProductDirty);
            el.addEventListener('change', checkProductDirty);
        });

        // Add Product Click
        container.querySelector('#btn-add-product')?.addEventListener('click', () => {
            form.reset();
            clearVariations();
            container.querySelector('#prd-id').value = '';
            container.querySelector('#prd-image-preview').style.display = 'none';
            container.querySelector('#prd-form-title').textContent = 'New Product';
            container.querySelector('#prd-submit-btn').textContent = 'Save Product';
            initialProductSnapshot = null;
            checkProductDirty();
            formContainer.style.display = 'block';
            container.querySelector('#product-list-container').style.display = 'none';
        });

        // Image Upload Handler
        container.querySelector('#prd-image-file')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const btnLabel = e.target.parentElement;
                    btnLabel.textContent = 'Uploading...';
                    
                    const url = await storageService.uploadImage(file, workspaceId);
                    
                    container.querySelector('#prd-image').value = url;
                    const preview = container.querySelector('#prd-image-preview');
                    preview.src = url;
                    preview.style.display = 'block';
                    checkProductDirty();
                    
                    btnLabel.innerHTML = 'Upload from Desktop<input type="file" id="prd-image-file" accept="image/*" style="display:none;">';
                } catch (error) {
                    showAlert.error('Image upload failed');
                }
            }
        });

        container.querySelector('#prd-image')?.addEventListener('input', (e) => {
            const preview = container.querySelector('#prd-image-preview');
            if (preview) {
                if (e.target.value) {
                    preview.src = e.target.value;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            }
            checkProductDirty();
        });

        // Quick Category Modal
        const catModal = container.querySelector('#quick-category-modal');
        const catNameInput = container.querySelector('#quick-cat-name');
        const catColorInput = container.querySelector('#quick-cat-color');
        const btnQuickCat = container.querySelector('#btn-quick-cat');
        const btnSaveCat = container.querySelector('#quick-cat-save-btn');
        const btnCancelCat = container.querySelector('#quick-cat-cancel-btn');

        if (btnQuickCat) {
            btnQuickCat.addEventListener('click', () => {
                catNameInput.value = '';
                catColorInput.value = '#4a90e2';
                btnSaveCat.disabled = true;
                catModal.style.display = 'flex';
                catNameInput.focus();
            });
        }

        catNameInput?.addEventListener('input', (e) => {
            btnSaveCat.disabled = !e.target.value.trim();
        });

        btnCancelCat?.addEventListener('click', () => {
            catModal.style.display = 'none';
        });

        btnSaveCat?.addEventListener('click', async () => {
            const catName = catNameInput.value;
            const catColor = catColorInput.value;
            
            if (!catName || catName.trim() === '') {
                showAlert.error("Category name is required.");
                return;
            }

            btnSaveCat.disabled = true;
            btnSaveCat.textContent = 'Saving...';

            try {
                await categoryService.addCategory({ name: catName.trim(), color: catColor }, currentUser.uid);
                showAlert.success("Category added!");
                
                categoriesList = await categoryService.getAllCategories();
                catSelect.innerHTML = '<option value="">Select Category</option>' + 
                    categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
                
                const newCat = categoriesList.find(c => c.name.toLowerCase() === catName.trim().toLowerCase());
                if (newCat) catSelect.value = newCat.uniqueId || newCat.id;
                
                catModal.style.display = 'none';
            } catch (err) {
                showAlert.error(err.message);
            } finally {
                btnSaveCat.disabled = false;
                btnSaveCat.textContent = 'Save';
            }
        });

        // Cancel Form
        container.querySelector('#prd-cancel-btn')?.addEventListener('click', async () => {
            const submitBtn = container.querySelector('#prd-submit-btn');
            if (submitBtn && !submitBtn.disabled) {
                const leave = await showAlert.confirmUnsavedChanges();
                if (!leave) return;
            }
            formContainer.style.display = 'none';
            container.querySelector('#product-list-container').style.display = 'block';
            form.reset();
            initialProductSnapshot = null;
            checkProductDirty();
        });

        // Form Submit
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#prd-submit-btn');
            btn.disabled = true;
            
            const id = container.querySelector('#prd-id').value;

            const collectedVariations = [];
            container.querySelectorAll('.prd-variation-item-row').forEach(row => {
                const size = row.querySelector('.var-size-input')?.value.trim() || '';
                const upc = row.querySelector('.var-upc-input')?.value.trim() || '';
                if (size || upc) {
                    collectedVariations.push({ sizeFlavor: size, upcCode: upc });
                }
            });

            const data = {
                imageUri: container.querySelector('#prd-image').value,
                name: container.querySelector('#prd-name').value.trim(),
                sizeWeight: container.querySelector('#prd-size').value.trim(),
                category: container.querySelector('#prd-category').value,
                upcCode: container.querySelector('#prd-upc').value.trim(),
                note: container.querySelector('#prd-note').value.trim(),
                
                quantity: parseInt(container.querySelector('#prd-qty').value || 0, 10),
                
                price: container.querySelector('#prd-cost-price').value ? parseFloat(container.querySelector('#prd-cost-price').value) : 0,
                salePrice: parseFloat(container.querySelector('#prd-sale-price').value),
                basePrice: container.querySelector('#prd-base-price').value ? parseFloat(container.querySelector('#prd-base-price').value) : 0,
                mrp: container.querySelector('#prd-mrp').value ? parseFloat(container.querySelector('#prd-mrp').value) : 0,
                
                mfgDate: container.querySelector('#prd-mfg-date').value,
                expDate: container.querySelector('#prd-exp-date').value,
                
                variations: collectedVariations
            };
            
            try {
                if (id) {
                    await productService.updateProduct(id, data);
                    showAlert.success('Product updated');
                } else {
                    await productService.addProduct(data, currentUser.uid);
                    showAlert.success('Product added');
                }
                formContainer.style.display = 'none';
                container.querySelector('#product-list-container').style.display = 'block';
                await loadData();
            } catch (error) {
                showAlert.error(error.message);
            } finally {
                btn.disabled = false;
            }
        });

        // Market Inserter
        container.querySelector('#btn-market-inserter')?.addEventListener('click', () => {
            window.location.hash = '#/market-inserter';
        });

        // Import Excel
        container.querySelector('#btn-import-excel')?.addEventListener('click', () => {
            openExcelImportModal(workspaceId, () => {
                loadData();
            });
        });

        // Export
        container.querySelector('#btn-export-products')?.addEventListener('click', async () => {
            const [pList, cList] = await Promise.all([
                productService.getAllActiveProducts().catch(() => []),
                categoryService.getAllCategories().catch(() => [])
            ]);
            openExportModal(workspaceId, { products: pList, categories: cList });
        });
    };

    const loadData = async () => {
        try {
            const [cats, prods] = await Promise.all([
                categoryService.getAllCategories().catch(() => []),
                productService.getAllActiveProducts().catch(() => []),
                fetchAllInvoices()
            ]);
            categoriesList = cats;
            activeProducts = prods;
            
            if (activeProductDetail) {
                // If viewing a detail, refresh it
                const refreshed = activeProducts.find(p => p.id === activeProductDetail.id);
                if (refreshed) {
                    renderProductDetailView(refreshed);
                } else {
                    renderProductMainView();
                }
            } else {
                renderProductMainView();
            }
        } catch (error) {
            showAlert.error('Failed to load products');
        }
    };

    await loadData();
};
