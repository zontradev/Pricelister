import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { getUserRestrictions } from '../auth-handler.js';
import { showAlert } from '../alert-handler.js';
import { storageService } from '../../supabase/storage.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { formatCurrency, getAppCurrencySymbol, formatExactTimestamp, escapeHtml } from '../utilities.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { draftManager } from '../services/draftManager.js';
import { getCodeStudioService } from '../services/codeStudioService.js';

export const renderProducts = async (container, workspaceId) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();

    let categoriesList = [];
    let activeProducts = [];
    let allInvoices = [];
    let activeProductDetail = null; // When set, renders dedicated analytical Product Detail View
    let currentLayout = localStorage.getItem('pricelister_product_layout') || 'list';
    let currentPage = 1;
    const pageSize = 15;
    let selectedProductIds = new Set();
    const layoutDisplayNames = {
        'list': 'List',
        'large_list': 'Large List',
        'grid_4': 'Grid (4x4)',
        'hexa': 'Hexa (6x6)',
        'octa': 'Octa (8x8)',
        'hexadecagon': '16x16 Cube',
        'hexa_octa': '32x32 Cube'
    };

    // Fetch all historical invoices to power real product sales analytics
    async function fetchAllInvoices() {
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
    }

    // Calculate detailed real-time analytics for a specific product
    function calculateProductAnalytics(product, timeRange = '6_MONTHS') {
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

        // Time-based Trend Data Calculation
        const now = new Date();
        let monthlyTrend = [];

        if (timeRange === 'TODAY') {
            // Hourly breakdown for today
            for (let h = 0; h < 24; h += 4) {
                const label = `${h.toString().padStart(2, '0')}:00`;
                monthlyTrend.push({ label, hour: h, units: 0, revenue: 0, profit: 0 });
            }
            const todayStr = now.toDateString();
            matchedInvoicesWithItems.forEach(entry => {
                const d = new Date(entry.timestamp);
                if (d.toDateString() === todayStr) {
                    const h = d.getHours();
                    const slot = monthlyTrend.find(s => h >= s.hour && h < s.hour + 4) || monthlyTrend[monthlyTrend.length - 1];
                    if (slot) {
                        slot.units += entry.unitsSold;
                        slot.revenue += entry.revenue;
                        slot.profit += entry.profit;
                    }
                }
            });
        } else if (timeRange === 'THIS_WEEK') {
            // Last 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(now.getDate() - i);
                monthlyTrend.push({
                    label: d.toLocaleDateString('default', { weekday: 'short' }),
                    dateStr: d.toDateString(),
                    units: 0,
                    revenue: 0,
                    profit: 0
                });
            }
            matchedInvoicesWithItems.forEach(entry => {
                const entryDateStr = new Date(entry.timestamp).toDateString();
                const slot = monthlyTrend.find(s => s.dateStr === entryDateStr);
                if (slot) {
                    slot.units += entry.unitsSold;
                    slot.revenue += entry.revenue;
                    slot.profit += entry.profit;
                }
            });
        } else if (timeRange === '1_YEAR') {
            // 12 months
            for (let i = 11; i >= 0; i--) {
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
        } else {
            // Default: 6 Months
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
        }

        // Market Demand & Inventory Velocity Analysis
        // Average units sold per month over recent window
        const totalRecentUnits = monthlyTrend.reduce((acc, curr) => acc + curr.units, 0);
        const monthlyVelocity = totalRecentUnits > 0 ? (totalRecentUnits / (monthlyTrend.length || 1)) : (totalUnitsSold > 0 ? totalUnitsSold : 0);
        const currentStock = Number(product.quantity) || 0;

        let demandRating = 'Stable';
        let demandBadgeClass = 'demand-badge-stable';
        if (monthlyVelocity >= 25 || totalUnitsSold >= 50) {
            demandRating = 'High Demand';
            demandBadgeClass = 'demand-badge-high';
        } else if (monthlyVelocity >= 10 || totalUnitsSold >= 20) {
            demandRating = 'Moderate Demand';
            demandBadgeClass = 'demand-badge-moderate';
        } else if (totalUnitsSold === 0) {
            demandRating = 'No Sales Yet';
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
                stockRunoutMsg = 'Critical: Stock runout imminent';
            } else if (days <= 21) {
                stockRunoutMsg = 'Restock recommended soon';
            } else {
                stockRunoutMsg = 'Healthy inventory buffer';
            }
        } else if (currentStock === 0) {
            stockRunoutDays = '0 Days';
            stockRunoutMsg = 'Out of stock';
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
                        <stop offset="0%" stop-color="var(--theme-primary, #18181B)" stop-opacity="0.32" />
                        <stop offset="100%" stop-color="var(--theme-primary, #18181B)" stop-opacity="0.01" />
                    </linearGradient>
                </defs>
                
                <!-- Grid Lines -->
                <line x1="${padding.left}" y1="${padding.top}" x2="${width - padding.right}" y2="${padding.top}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
                <line x1="${padding.left}" y1="${padding.top + chartH / 2}" x2="${width - padding.right}" y2="${padding.top + chartH / 2}" stroke="rgba(0,0,0,0.06)" stroke-dasharray="4" />
                <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="rgba(0,0,0,0.12)" />

                <!-- Y-Axis Values -->
                <text x="${padding.left - 8}" y="${padding.top + 4}" font-size="10" fill="#94a3b8" text-anchor="end" font-weight="600">${formatCurrency(maxRev)}</text>
                <text x="${padding.left - 8}" y="${padding.top + chartH / 2 + 4}" font-size="10" fill="#94a3b8" text-anchor="end">${formatCurrency(maxRev / 2)}</text>
                <text x="${padding.left - 8}" y="${height - padding.bottom + 4}" font-size="10" fill="#94a3b8" text-anchor="end">0</text>

                <!-- Area Fill with Animated Fade -->
                <path d="${areaD}" fill="url(#prdGrad)" class="trend-area-animated" />

                <!-- Line Curve with Animated Draw -->
                <path d="${lineD}" fill="none" stroke="var(--theme-primary, #18181B)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="trend-curve-animated" />

                <!-- Data Dots & X-Labels -->
                ${points.map((p) => `
                    <g class="chart-point-group" style="cursor:pointer;">
                        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="var(--theme-primary, #18181B)" stroke-width="2.5" />
                        <text x="${p.x}" y="${height - 10}" font-size="11" fill="#64748b" text-anchor="middle" font-weight="600">${p.label}</text>
                        <title>${p.label}: ${formatCurrency(p.revenue)} (${p.units} units sold, ${formatCurrency(p.profit)} profit)</title>
                    </g>
                `).join('')}
            </svg>
        `;
    };

    // Render Dedicated Product Detail View
    function renderProductDetailView(prd, activeTrendRange = '6_MONTHS') {
        activeProductDetail = prd;
        const userRestrictions = getUserRestrictions();
        const analytics = calculateProductAnalytics(prd, activeTrendRange);
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
                        <button type="button" id="btn-detail-schema-analyze" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:0.35rem; border-color:#6366f1; color:#4f46e5; background:rgba(99,102,241,0.06);" title="Analyze connections, demand velocity & affinity in Schema Analyzer">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            Schema Analysis
                        </button>
                        <button type="button" id="btn-detail-edit" class="btn btn-primary" style="font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; background: linear-gradient(135deg, #ff3366 0%, #18181B 55%, #27272A 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);">
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
                : `<div id="detail-prd-avatar-placeholder" style="width:100%; height:100%; border-radius:14px; background:linear-gradient(135deg, #fce7f3 0%, #F4F4F5 100%); color:#18181B; display:flex; align-items:center; justify-content:center; font-weight:800; border:2px solid rgba(225,29,72,0.15);">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                   </div>`
            }
                            <label for="detail-img-file-input" style="position:absolute; bottom:-6px; right:-6px; width:34px; height:34px; border-radius:50%; background:#18181B; color:#ffffff; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 3px 8px rgba(225,29,72,0.4); border:2px solid #ffffff; transition:transform 0.2s;" title="Upload or change product photo">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                                <input type="file" id="detail-img-file-input" accept="image/*" style="display:none;">
                            </label>
                        </div>

                        <!-- Product Identity & Meta Information -->
                        <div style="flex:1; min-width:260px;">
                            <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; margin-bottom:0.4rem;">
                                <h1 style="margin:0; font-size:1.65rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em;">${prd.name}</h1>
                                <span class="badge" style="background:rgba(225,29,72,0.1); color:#18181B; font-weight:700; padding:0.25rem 0.65rem; border-radius:6px;">${catName}</span>
                                <span class="${analytics.demandBadgeClass}">${analytics.demandRating}</span>
                            </div>

                            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap; margin-bottom:0.75rem; font-size:0.85rem; color:var(--text-secondary);">
                                ${prd.sizeWeight ? `<span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px; font-weight:600; display:inline-flex; align-items:center; gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> ${prd.sizeWeight}</span>` : ''}
                                ${prd.upcCode ? `<span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px; font-family:monospace; font-weight:700;">Barcode: ${prd.upcCode}</span>` : ''}
                                <span style="background:var(--surface-100); padding:0.2rem 0.5rem; border-radius:5px;">ID: <code style="font-family:monospace; font-size:0.8rem;">${prd.uniqueId || prd.id}</code></span>
                                ${prd.expDate ? `<span style="color:#d97706; font-weight:600; display:inline-flex; align-items:center; gap:3px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Exp: ${prd.expDate}</span>` : ''}
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
                                Cost: <strong>${userRestrictions.cannotSeeCost ? '••••' : formatCurrency(prd.price || 0)}</strong> &bull; Profit: <strong style="color:var(--text-primary);">${userRestrictions.cannotSeeProfit ? '••••' : '+' + formatCurrency(analytics.unitGrossProfit)}</strong>
                            </div>
                            <div style="margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--border-color); font-size:0.82rem; font-weight:700; color:${(prd.quantity || 0) > 5 ? '#059669' : '#dc2626'}; display:flex; align-items:center; justify-content:flex-end; gap:4px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                ${(prd.quantity || 0) > 0 ? `${prd.quantity} Units in Stock` : 'Out of Stock (0 Units)'}
                            </div>
                        </div>
                    </div>

                    <!-- 6 ANALYTICAL KPI METRIC CARDS -->
                    <div class="detail-kpi-grid">
                        <!-- KPI 1: Invoices Made -->
                        <div class="detail-kpi-card highlight-red">
                            <div class="detail-kpi-label">
                                <span>Invoices Generated</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            </div>
                            <div class="detail-kpi-value" style="color:#18181B;">${analytics.invoiceCount}</div>
                            <div class="detail-kpi-sub">Total sales receipts issued</div>
                        </div>

                        <!-- KPI 2: Total Revenue -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Total Revenue</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${formatCurrency(analytics.totalRevenue)}</div>
                            <div class="detail-kpi-sub">Gross sales from this item</div>
                        </div>

                        <!-- KPI 3: Total Gross Profit -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Gross Profit</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                            </div>
                            <div class="detail-kpi-value" style="color:var(--text-primary);">${userRestrictions.cannotSeeProfit ? '••••' : formatCurrency(analytics.totalProfit)}</div>
                            <div class="detail-kpi-sub">${userRestrictions.cannotSeeProfit ? '•••• margin' : `${Math.round(analytics.overallMarginPercent)}% net gross margin`}</div>
                        </div>

                        <!-- KPI 4: Total Units Sold -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Total Units Sold</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${analytics.totalUnitsSold}</div>
                            <div class="detail-kpi-sub">${analytics.monthlyVelocity} units / mo velocity</div>
                        </div>

                        <!-- KPI 5: Last Sale Report -->
                        <div class="detail-kpi-card">
                            <div class="detail-kpi-label">
                                <span>Last Sale Report</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
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
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                            </div>
                            <div class="detail-kpi-value">${analytics.stockRunoutDays}</div>
                            <div class="detail-kpi-sub">${analytics.stockRunoutMsg}</div>
                        </div>
                    </div>
                </div>

                <!-- 2-COLUMN DEEP ANALYTICAL SECTION -->
                <div style="display:grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap:1.5rem; align-items:start;">
                    
                    <!-- LEFT COLUMN: TREND & INVOICE HISTORY -->
                    <div style="display:flex; flex-direction:column; gap:1.5rem;">
                        
                        <!-- Sales & Revenue Trend Chart with Time Filter -->
                        <div class="card" style="padding:1.5rem; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
                                <div>
                                    <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700;">Sales & Revenue Trend</h3>
                                    <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Revenue, sales volume, and demand fluctuations over time</p>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <select id="prd-detail-trend-range" class="form-control" style="width:auto; padding:0.35rem 0.75rem; border-radius:var(--radius-pill); font-size:0.8rem; height:34px; font-weight:600;">
                                        <option value="6_MONTHS" ${activeTrendRange === '6_MONTHS' ? 'selected' : ''}>Last 6 Months</option>
                                        <option value="1_YEAR" ${activeTrendRange === '1_YEAR' ? 'selected' : ''}>Last 1 Year</option>
                                        <option value="THIS_WEEK" ${activeTrendRange === 'THIS_WEEK' ? 'selected' : ''}>This Week (7 Days)</option>
                                        <option value="TODAY" ${activeTrendRange === 'TODAY' ? 'selected' : ''}>Today (Hourly)</option>
                                    </select>
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
                                    <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                        Favorite Customers
                                    </h3>
                                    <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Top buyers ranked by purchase volume & demand</p>
                                </div>
                                <span class="badge" style="background:rgba(225,29,72,0.1); color:#18181B; font-weight:700;">
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
                                                ${idx === 0 ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>' : (idx + 1)}
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
                            <h3 style="margin:0 0 0.2rem 0; font-size:1.15rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                Market Demand & Pricing
                            </h3>
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
                                    <div style="font-size:1.15rem; font-weight:800; color:#18181B;">Order +${analytics.recommendedReorder} Units</div>
                                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">Maintains a healthy 45-day supply buffer based on current burn rate.</div>
                                </div>

                                <!-- Pricing & Profit Breakdown -->
                                <div style="background:var(--surface-50); padding:1rem; border-radius:10px; border:1px solid var(--border-color);">
                                    <div style="font-size:0.82rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.6rem;">Unit Profitability Breakdown</div>
                                    <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem; font-size:0.85rem;">
                                        <span style="color:var(--text-secondary);">Unit Cost Price:</span>
                                        <strong>${userRestrictions.cannotSeeCost ? '••••' : formatCurrency(prd.price || 0)}</strong>
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
                                        <strong style="color:var(--text-primary);">${userRestrictions.cannotSeeProfit ? '••••' : `+${formatCurrency(analytics.unitGrossProfit)} (${Math.round(analytics.unitMarginPercent)}%)`}</strong>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>

                </div>

                <!-- Product Origin Section Divider -->
                <div class="card origin-divider-card" style="margin-top:1.5rem; padding:1.5rem; border-radius:var(--radius-card); background:var(--bg-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float);">
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border-color);">
                        <div style="width:28px; height:28px; border-radius:6px; background:var(--theme-subtle, rgba(225,29,72,0.1)); color:var(--theme-primary, #18181B); display:flex; align-items:center; justify-content:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-primary);">Product Origin</h3>
                    </div>
                    <div class="origin-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                        <div class="origin-field-box">
                            <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Product ID:</span>
                            <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:700; color:var(--text-primary);">${prd.uniqueId || prd.id || 'N/A'}</code>
                        </div>
                        <div class="origin-field-box">
                            <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Creator ID:</span>
                            <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:700; color:var(--text-primary);">${prd.creatorId || prd.createdBy || 'System / Admin'}</code>
                        </div>
                        <div class="origin-field-box">
                            <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Workspace ID:</span>
                            <code class="origin-value" style="font-family:monospace; font-size:0.88rem; font-weight:700; color:var(--text-primary);">${workspaceId || 'Default Workspace'}</code>
                        </div>
                        <div class="origin-field-box">
                            <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Created at:</span>
                            <span class="origin-value" style="font-size:0.88rem; font-weight:600; color:var(--text-primary);">${formatExactTimestamp(prd.createdAt || prd.timestamp)}</span>
                        </div>
                        ${(prd.updatedAt || prd.updatedTimestamp) && (prd.updatedAt !== prd.createdAt) ? `
                        <div class="origin-field-box">
                            <span class="origin-label" style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted); display:block; margin-bottom:0.25rem;">Updated at:</span>
                            <span class="origin-value" style="font-size:0.88rem; font-weight:600; color:var(--text-primary);">${formatExactTimestamp(prd.updatedAt || prd.updatedTimestamp)}</span>
                        </div>
                        ` : ''}
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

        // Trend range change
        const trendSelect = container.querySelector('#prd-detail-trend-range');
        if (trendSelect) {
            trendSelect.addEventListener('change', (e) => {
                renderProductDetailView(prd, e.target.value);
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

        // Schema Analyze from Detail View
        const btnSchemaAnalyze = container.querySelector('#btn-detail-schema-analyze');
        if (btnSchemaAnalyze) {
            btnSchemaAnalyze.addEventListener('click', () => {
                window.location.hash = `#/schema-analyzer/products?id=${prd.id || prd.uniqueId}`;
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

        // Adjust Stock (Interactive modal prompt)
        const btnAdjustStock = container.querySelector('#btn-detail-adjust-stock');
        if (btnAdjustStock) {
            btnAdjustStock.addEventListener('click', async () => {
                const inputVal = await showAlert.prompt({
                    title: 'Adjust Stock Quantity',
                    message: `Set total inventory stock for <strong>${prd.name}</strong>:`,
                    defaultValue: prd.quantity || 0,
                    inputType: 'number',
                    confirmText: 'Update Stock',
                    min: 0
                });
                if (inputVal !== null && inputVal.trim() !== '') {
                    const newQty = parseInt(inputVal, 10);
                    if (!isNaN(newQty) && newQty >= 0) {
                        try {
                            await productService.updateProduct(prd.id, { quantity: newQty });
                            prd.quantity = newQty;
                            showAlert.success(`Stock updated to ${newQty} units`);
                            renderProductDetailView(prd, activeTrendRange);
                        } catch (err) {
                            showAlert.error(err.message || 'Failed to update stock');
                        }
                    } else {
                        showAlert.error('Please enter a valid positive integer.');
                    }
                }
            });
        }

        // 1-Click Photo Upload directly from detail hero + Drag & Drop
        const imgInput = container.querySelector('#detail-img-file-input');
        const detailAvatarWrap = container.querySelector('#detail-prd-avatar')?.parentElement || container.querySelector('#detail-prd-avatar-placeholder')?.parentElement;

        const handleDetailImageUpload = async (file) => {
            if (!file || !file.type.startsWith('image/')) {
                showAlert.error('Please drop or select a valid image file (PNG, JPG, WEBP).');
                return;
            }
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
        };

        if (imgInput) {
            imgInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    await handleDetailImageUpload(file);
                }
            });
        }

        if (detailAvatarWrap) {
            detailAvatarWrap.style.cursor = 'pointer';
            detailAvatarWrap.setAttribute('title', 'Click or Drag & Drop to update photo');

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evtName => {
                detailAvatarWrap.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(evtName => {
                detailAvatarWrap.addEventListener(evtName, () => {
                    detailAvatarWrap.style.transform = 'scale(1.04)';
                    detailAvatarWrap.style.outline = '3px dashed #18181B';
                    detailAvatarWrap.style.outlineOffset = '2px';
                });
            });

            ['dragleave', 'drop'].forEach(evtName => {
                detailAvatarWrap.addEventListener(evtName, () => {
                    detailAvatarWrap.style.transform = 'scale(1)';
                    detailAvatarWrap.style.outline = 'none';
                });
            });

            detailAvatarWrap.addEventListener('drop', async (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    await handleDetailImageUpload(dt.files[0]);
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

    // Dedicated Product Editor Screen Controls (Totally custom alone screen)
    const showProductEditorView = () => {
        const formContainer = container.querySelector('#product-form-container');
        const headerContainer = container.querySelector('.prd-header-container');
        const kpiGrid = container.querySelector('.prd-kpi-grid');
        const listContainer = container.querySelector('#product-list-container');
        if (headerContainer) headerContainer.style.display = 'none';
        if (kpiGrid) kpiGrid.style.display = 'none';
        if (listContainer) listContainer.style.display = 'none';
        if (formContainer) {
            formContainer.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const hideProductEditorView = () => {
        const formContainer = container.querySelector('#product-form-container');
        const headerContainer = container.querySelector('.prd-header-container');
        const kpiGrid = container.querySelector('.prd-kpi-grid');
        const listContainer = container.querySelector('#product-list-container');
        if (formContainer) formContainer.style.display = 'none';
        if (headerContainer) headerContainer.style.display = 'flex';
        if (kpiGrid) kpiGrid.style.display = 'grid';
        if (listContainer) listContainer.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Main Product View Layout (List + Form + Modals)
    function renderProductMainView() {
        const userRestrictions = getUserRestrictions();
        container.innerHTML = `
            <!-- Image 3: Modern Products Header -->
            <div class="prd-header-container">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <div class="prd-header-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                    </div>
                    <div>
                        <h1 style="margin:0 0 0.2rem 0; font-size:1.6rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em;">Products</h1>
                        <p style="margin:0; font-size:0.86rem; color:var(--text-secondary);">Manage, organize, and track your workspace product catalog.</p>
                    </div>
                </div>

                <div style="display:flex; gap:0.65rem; align-items:center; flex-wrap:wrap;">
                    ${userRestrictions.disableAdd ? '' : `
                    <button id="btn-market-inserter" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.85rem; padding:0.6rem 1rem; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-50); color:var(--text-primary);" title="Open Market Inserter spreadsheet grid">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                        Market Inserter
                    </button>
                    <button id="btn-import-excel" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.85rem; padding:0.6rem 1rem; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-50); color:var(--text-primary);">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>
                        Import Excel
                    </button>
                    `}
                    <button id="btn-export-products" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.85rem; padding:0.6rem 1rem; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-50); color:var(--text-primary);">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export
                    </button>
                    ${userRestrictions.disableAdd ? '' : `
                    <button id="btn-add-product" class="btn btn-primary" style="display:flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.88rem; padding:0.6rem 1.25rem; border-radius:10px; white-space:nowrap;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add Product
                    </button>
                    `}
                </div>
            </div>

            <!-- Image 3: 2 KPI Cards Row (Total Products & Categories) -->
            <div class="prd-kpi-grid">
                <!-- Card 1: Total Products -->
                <div class="prd-kpi-card">
                    <div>
                        <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Total Products</div>
                        <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin-top:0.15rem; line-height:1.15;" id="kpi-total-products">${activeProducts.length}</div>
                        <div style="font-size:0.75rem; color:var(--text-primary); font-weight:700; margin-top:0.35rem; display:flex; align-items:center; gap:4px;">
                            <span style="width:6px; height:6px; border-radius:50%; background:#10b981;"></span> Active in catalog
                        </div>
                    </div>
                    <div class="prd-kpi-icon" style="background:var(--surface-100); color:var(--text-primary); border:1px solid var(--border-color);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                    </div>
                </div>

                <!-- Card 2: Categories -->
                <div class="prd-kpi-card" onclick="if(window.navigateToRoute){window.navigateToRoute('/categories')}else{window.location.hash='#/categories'}" style="cursor:pointer;">
                    <div>
                        <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Categories</div>
                        <div style="font-size:1.85rem; font-weight:800; color:var(--text-primary); margin-top:0.15rem; line-height:1.15;" id="kpi-total-categories">${categoriesList.length}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:700; margin-top:0.35rem; display:flex; align-items:center; gap:4px;">
                            <span style="width:6px; height:6px; border-radius:50%; background:currentColor;"></span> Organized groups
                        </div>
                    </div>
                    <div class="prd-kpi-icon" style="background:var(--surface-100); color:var(--text-primary); border:1px solid var(--border-color);">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                </div>
            </div>

            <!-- CUSTOM CATEGORY MODAL -->
            <div id="quick-category-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.6); backdrop-filter:blur(4px); z-index:9999; align-items:center; justify-content:center; padding:1rem;">
                <div class="card" style="background:var(--bg-card); width:100%; max-width:420px; padding:1.75rem; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-elevated);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <div style="width:32px; height:32px; border-radius:8px; background:var(--primary-subtle); display:flex; align-items:center; justify-content:center; color:var(--primary);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 9h16"></path><path d="M4 15h16"></path><path d="M10 3L8 21"></path><path d="M16 3l-2 18"></path></svg>
                            </div>
                            <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:var(--text-primary);">New Category</h3>
                        </div>
                        <button type="button" id="quick-cat-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.3rem; line-height:1;">&times;</button>
                    </div>

                    <div style="display:flex; flex-direction:column; gap:1.1rem;">
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Category Name <span style="color:var(--danger)">*</span></label>
                            <input type="text" id="quick-cat-name" class="form-control" style="width:100%; padding:0.6rem 0.75rem;" placeholder="e.g. Beverages, Bakery, Electronics">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Category Tag Color</label>
                            <div style="display:flex; gap:0.6rem; align-items:center;">
                                <input type="color" id="quick-cat-color" value="#18181B" class="form-control" style="width:48px; height:38px; padding:2px; border-radius:6px; cursor:pointer;">
                                <div style="display:flex; gap:0.3rem; flex-wrap:wrap;">
                                    <span class="quick-color-preset" data-color="#18181B" style="width:22px; height:22px; border-radius:50%; background:#18181B; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                    <span class="quick-color-preset" data-color="#10b981" style="width:22px; height:22px; border-radius:50%; background:#10b981; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                    <span class="quick-color-preset" data-color="#3b82f6" style="width:22px; height:22px; border-radius:50%; background:#3b82f6; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                    <span class="quick-color-preset" data-color="#f59e0b" style="width:22px; height:22px; border-radius:50%; background:#f59e0b; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                    <span class="quick-color-preset" data-color="#8b5cf6" style="width:22px; height:22px; border-radius:50%; background:#8b5cf6; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                    <span class="quick-color-preset" data-color="#06b6d4" style="width:22px; height:22px; border-radius:50%; background:#06b6d4; cursor:pointer; display:inline-block; border:1px solid rgba(0,0,0,0.1);"></span>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.75rem; margin-top:0.5rem;">
                            <button type="button" id="quick-cat-cancel-btn" class="btn btn-secondary" style="flex:1; padding:0.55rem;">Cancel</button>
                            <button type="button" id="quick-cat-save-btn" class="btn btn-primary" style="flex:1; padding:0.55rem; font-weight:700;">Save Category</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PRODUCT FORM CONTAINER -->
            <div id="product-form-container" class="prd-form-wrapper" style="display:none;">
                <!-- Form Top Header Bar -->
                <div class="prd-form-header-bar">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div id="prd-form-header-logo-box" class="prd-header-logo-box" title="Product Photo / Icon">
                            <img id="prd-header-logo-img" src="" alt="Product Logo" style="display:none; width:100%; height:100%; object-fit:cover;">
                            <svg id="prd-header-logo-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="color:#fff;">
                                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                                <polyline points="2 17 12 22 22 17"></polyline>
                                <polyline points="2 12 12 17 22 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span class="badge" id="prd-form-badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.04em;">New Catalog Entry</span>
                                <h3 id="prd-form-title" style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary);">Add New Product</h3>
                            </div>
                            <p style="margin:0; font-size:0.83rem; color:var(--text-secondary);">Configure pricing parameters, live profit margins, barcode & inventory stock</p>
                        </div>
                    </div>
                    <div style="display:flex; gap:0.6rem; align-items:center;">
                        <button type="button" class="btn btn-secondary prd-cancel-trigger" style="display:inline-flex; align-items:center; gap:0.45rem; font-weight:700; font-size:0.88rem; padding:0.5rem 1.1rem; border-radius:10px; border:1.5px solid #cbd5e1; background:#ffffff; color:#0f172a;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back to Products
                        </button>
                    </div>
                </div>

                <form id="product-form" novalidate>
                    <input type="hidden" id="prd-id">
                    
                    <div class="prd-form-grid">
                        <!-- Left Column: Core Product Info, Pricing & Inventory -->
                        <div class="prd-form-main-col">
                            <!-- Card 1: Basic Info -->
                            <div class="prd-card-section">
                                <div class="prd-card-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                    <span>Product Information</span>
                                </div>
                                
                                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem; margin-bottom: 1rem;">
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Product Name <span style="color:var(--danger)">*</span></label>
                                        <input type="text" id="prd-name" required class="form-control" style="width:100%; padding:0.6rem 0.75rem; font-weight:500;" placeholder="e.g. Arabica Dark Roast Coffee Beans">
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Size / Packaging</label>
                                        <input type="text" id="prd-size" class="form-control" style="width:100%; padding:0.6rem 0.75rem;" placeholder="e.g. 500g, 1L, 12-Pack">
                                    </div>
                                </div>

                                <!-- Row 2: Category (Dedicated Individual Row) -->
                                <div style="margin-bottom: 1rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                                        <label style="font-size:0.82rem; font-weight:600; color:var(--text-primary); margin:0;">Category <span style="color:var(--danger)">*</span></label>
                                        <div id="prd-cat-chip-preview" style="display:none; align-items:center; gap:5px; font-size:0.75rem; font-weight:700; padding:0.15rem 0.6rem; border-radius:999px; background:#ECFDF5; border:1px solid #A7F3D0;">
                                            <span id="prd-cat-chip-dot" style="width:8px; height:8px; border-radius:50%; background:#10B981; display:inline-block;"></span>
                                            <span id="prd-cat-chip-name" style="color:#065F46;">Category</span>
                                        </div>
                                    </div>
                                    <div style="display:flex; gap:0.4rem;">
                                        <select id="prd-category" required class="form-control" style="flex:1; padding:0.6rem 0.75rem;">
                                            <option value="">Select Category</option>
                                        </select>
                                        <button type="button" id="btn-quick-cat" class="btn btn-secondary" style="padding:0.6rem 0.85rem; font-weight:700;" title="Create New Category">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                </div>

                                <!-- Row 3: UPC / Product Code (Dedicated Individual Row with Full Action Suite) -->
                                <div style="margin-bottom: 1rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; flex-wrap:wrap; gap:4px;">
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <label style="font-size:0.82rem; font-weight:600; color:var(--text-primary); margin:0;">UPC / Product Code</label>
                                            <span id="prd-generator-name-tag" style="font-size:0.68rem; font-weight:700; color:#71717A; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:4px; padding:0.1rem 0.4rem; display:inline-flex; align-items:center; gap:3px;">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                                <span id="prd-current-tmpl-label">Standard Product Code</span>
                                            </span>
                                        </div>
                                        <span id="prd-code-status-pill" style="font-size:0.7rem; font-weight:700; padding:0.1rem 0.45rem; border-radius:999px; background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7;">Unique Code</span>
                                    </div>
                                    <div style="display:flex; gap:0.4rem; flex-wrap:nowrap;">
                                        <input type="text" id="prd-upc" class="form-control" style="flex:1; padding:0.6rem 0.75rem; font-family:monospace; font-weight:700;" placeholder="e.g. 8908796598438">
                                        <button type="button" id="btn-scan-main-upc" class="btn btn-secondary" style="padding:0.6rem 0.75rem; font-size:0.75rem; font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="Scan Barcode with Camera or Handheld Laser">
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>
                                            Scan
                                        </button>
                                        <button type="button" id="btn-generate-upc" class="btn btn-secondary" style="padding:0.6rem 0.75rem; font-size:0.75rem; font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:4px;" title="Auto-Generate Using Workspace Template">
                                            <svg class="gen-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path></svg>
                                            <span class="gen-text">Auto Gen</span>
                                        </button>
                                        <button type="button" id="btn-code-assistant" class="btn btn-secondary" style="padding:0.6rem 0.75rem; font-size:0.75rem; font-weight:700; white-space:nowrap; display:flex; align-items:center; gap:3px;" title="Choose Code Template or Configure Options">
                                            Templates &darr;
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label style="display:block; font-size:0.82rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Internal Notes / Description</label>
                                    <textarea id="prd-note" rows="2" class="form-control" style="width:100%; padding:0.55rem 0.75rem; font-size:0.85rem; resize:vertical;" placeholder="Optional supplier notes, SKU identifiers, shelf location, or batch notes..."></textarea>
                                </div>
                            </div>

                            <!-- Card 2: Pricing, Cost & Margins -->
                            <div class="prd-card-section">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); flex-wrap:wrap; gap:0.5rem;">
                                    <div class="prd-card-title" style="margin:0; padding:0; border:none;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                        <span>Pricing & Profit Margins</span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                                        <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Markup Presets:</span>
                                        <span class="prd-quick-chip" data-markup="15">+15%</span>
                                        <span class="prd-quick-chip" data-markup="25">+25%</span>
                                        <span class="prd-quick-chip" data-markup="35">+35%</span>
                                        <span class="prd-quick-chip" data-markup="50">+50%</span>
                                        <span class="prd-quick-chip" data-markup="100">2x (100%)</span>
                                    </div>
                                </div>

                                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem;">
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Cost Price (COGS)</label>
                                        <div style="position:relative;">
                                            <input type="number" id="prd-cost-price" step="0.01" min="0" class="form-control prd-calc-trigger" style="width:100%; padding:0.6rem 0.75rem; font-weight:600;" placeholder="0.00">
                                        </div>
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Unit purchase cost</small>
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Sale Price <span style="color:var(--danger)">*</span></label>
                                        <div style="position:relative;">
                                            <input type="number" id="prd-sale-price" step="0.01" min="0" required class="form-control prd-calc-trigger" style="width:100%; padding:0.6rem 0.75rem; font-weight:700; color:var(--primary); border-color:rgba(225,29,72,0.4);" placeholder="0.00">
                                        </div>
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Customer retail price</small>
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Base / Floor Price</label>
                                        <input type="number" id="prd-base-price" step="0.01" min="0" class="form-control" style="width:100%; padding:0.6rem 0.75rem;" placeholder="0.00">
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Minimum wholesale</small>
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">MRP (Max Retail)</label>
                                        <input type="number" id="prd-mrp" step="0.01" min="0" class="form-control prd-calc-trigger" style="width:100%; padding:0.6rem 0.75rem;" placeholder="0.00">
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Printed box MRP</small>
                                    </div>
                                </div>
                            </div>

                            <!-- Card 3: Inventory & Dates -->
                            <div class="prd-card-section">
                                <div class="prd-card-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                                    <span>Inventory & Stock Life</span>
                                </div>

                                <div style="display:grid; grid-template-columns: 1.3fr 1fr 1fr; gap:1rem; align-items:start;">
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Stock On Hand <span style="color:var(--danger)">*</span></label>
                                        <div style="display:flex; gap:0.4rem; align-items:center;">
                                            <input type="number" id="prd-qty" value="0" min="0" required class="form-control prd-calc-trigger" style="width:100%; padding:0.6rem 0.75rem; font-weight:700;">
                                        </div>
                                        <div style="display:flex; gap:0.25rem; margin-top:0.4rem; flex-wrap:wrap;">
                                            <button type="button" class="prd-stepper-btn" data-step="-5">-5</button>
                                            <button type="button" class="prd-stepper-btn" data-step="-1">-1</button>
                                            <button type="button" class="prd-stepper-btn" data-step="1">+1</button>
                                            <button type="button" class="prd-stepper-btn" data-step="5">+5</button>
                                            <button type="button" class="prd-stepper-btn" data-step="10">+10</button>
                                            <button type="button" class="prd-stepper-btn" data-step="50">+50</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Mfg Date</label>
                                        <input type="date" id="prd-mfg-date" class="form-control" style="width:100%; padding:0.55rem 0.65rem; font-size:0.82rem;">
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Production date</small>
                                    </div>
                                    <div>
                                        <label style="display:block; font-size:0.8rem; font-weight:600; margin-bottom:0.35rem; color:var(--text-primary);">Exp Date</label>
                                        <input type="date" id="prd-exp-date" class="form-control" style="width:100%; padding:0.55rem 0.65rem; font-size:0.82rem;">
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Expiry warning</small>
                                    </div>
                                </div>
                            </div>

                            <!-- Card 4: Variations -->
                            <div class="prd-card-section" style="margin-bottom:0;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
                                    <div class="prd-card-title" style="margin:0; padding:0; border:none;">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                        <span>Product Variations & Barcodes</span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                        <!-- Realtime Batch Generator Toggle Button -->
                                        <button type="button" id="btn-toggle-var-batch" class="btn btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.65rem; display:flex; align-items:center; gap:4px; font-weight:700; background:#FAFAFA;" title="When enabled, any added variation block gets automatically barcoded using the selected template">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                            <span id="var-batch-label">Batch Auto-Barcode: OFF</span>
                                        </button>
                                        <!-- Template Dialog Button -->
                                        <button type="button" id="btn-var-template-dialog" class="btn btn-secondary" style="font-size:0.75rem; padding:0.35rem 0.65rem; display:flex; align-items:center; gap:4px; font-weight:700;" title="Select Generator Template for Variations">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                            <span id="var-current-tmpl-label">Template &darr;</span>
                                        </button>
                                        <!-- Add Variant Button -->
                                        <button type="button" id="btn-add-variation-row" class="btn btn-primary" style="font-size:0.75rem; padding:0.35rem 0.75rem; display:flex; align-items:center; gap:4px; font-weight:700; background:#18181B; color:#FFFFFF;">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            Add Variant
                                        </button>
                                    </div>
                                </div>
                                <div id="prd-variations-list" style="display:flex; flex-direction:column; gap:0.75rem;">
                                    <!-- Dynamic 2-row variation blocks -->
                                </div>
                                <div id="prd-no-variations-msg" style="color:var(--text-muted); font-size:0.82rem; font-style:italic; padding:0.4rem 0;">
                                    No custom variations configured. Click "Add Variant" to create flavor, size, or secondary UPC mappings.
                                </div>
                            </div>
                        </div>

                        <!-- Right Column: Media Hub & Real-Time Margin Engine -->
                        <div class="prd-form-side-col" style="display:flex; flex-direction:column; gap:1.25rem;">
                            <!-- Media Card -->
                            <div class="prd-card-section" style="margin-bottom:0;">
                                <div class="prd-card-title">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span>Product Media</span>
                                </div>

                                <div class="prd-media-box" id="prd-media-dropzone" style="margin-bottom:0.9rem;">
                                    <img id="prd-image-preview" class="prd-media-img" src="" style="display:none;">
                                    <div id="prd-media-empty-state" style="text-align:center; padding:1.5rem; color:var(--text-muted);">
                                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.4rem; opacity:0.5;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        <div style="font-size:0.82rem; font-weight:600; color:var(--text-primary);">No Image Selected</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);">Upload photo or paste direct image URL below</div>
                                    </div>
                                </div>

                                <div style="display:flex; gap:0.5rem; margin-bottom:0.75rem;">
                                    <label class="btn btn-secondary" style="cursor:pointer; flex:1; justify-content:center; padding:0.5rem; font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        <span id="prd-upload-label-text">Upload Image</span>
                                        <input type="file" id="prd-image-file" accept="image/*" style="display:none;">
                                    </label>
                                    <button type="button" id="btn-clear-img" class="btn btn-outline" style="padding:0.5rem 0.75rem; font-size:0.8rem; color:var(--danger);" title="Clear Image">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>

                                <div>
                                    <label style="display:block; font-size:0.76rem; font-weight:600; margin-bottom:0.25rem; color:var(--text-muted);">Direct Image URL</label>
                                    <input type="text" id="prd-image" class="form-control" style="width:100%; padding:0.45rem 0.65rem; font-size:0.82rem;" placeholder="https://example.com/photo.jpg">
                                </div>
                            </div>

                            <!-- Live Margin & Financial Calculator Card -->
                            <div class="prd-calc-card">
                                <div class="prd-calc-header">
                                    <div>
                                        <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700;">Live Financials</div>
                                        <div style="font-size:1.05rem; font-weight:800; color:#ffffff;">Profit & Margin Engine</div>
                                    </div>
                                    <div id="calc-profit-pill" class="margin-pill" style="background:rgba(100, 116, 139, 0.2); color:#cbd5e1; font-size:0.75rem;">
                                        Awaiting Price Input
                                    </div>
                                </div>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom:1rem;">
                                    <div class="prd-metric-box">
                                        <div class="prd-metric-label">Unit Profit</div>
                                        <div class="prd-metric-value" id="calc-unit-profit" style="color:#ffffff;">$0.00</div>
                                    </div>
                                    <div class="prd-metric-box">
                                        <div class="prd-metric-label">Markup %</div>
                                        <div class="prd-metric-value" id="calc-markup">0.0%</div>
                                    </div>
                                    <div class="prd-metric-box">
                                        <div class="prd-metric-label">Profit Margin</div>
                                        <div class="prd-metric-value" id="calc-margin">0.0%</div>
                                    </div>
                                    <div class="prd-metric-box">
                                        <div class="prd-metric-label">MRP Discount</div>
                                        <div class="prd-metric-value" id="calc-mrp-discount">0%</div>
                                    </div>
                                </div>

                                <div style="background:rgba(0,0,0,0.25); border-radius:var(--radius-md); padding:0.75rem 0.9rem; border:1px solid rgba(255,255,255,0.06);">
                                    <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; margin-bottom:0.4rem;">Batch Inventory Valuation</div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                        <span style="color:#cbd5e1;">Total Cost Investment:</span>
                                        <strong id="calc-total-cost" style="color:#ffffff;">$0.00</strong>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                                        <span style="color:#cbd5e1;">Total Retail Value:</span>
                                        <strong id="calc-total-sale" style="color:#ffffff;">$0.00</strong>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; padding-top:0.35rem; border-top:1px solid rgba(255,255,255,0.1); margin-top:0.35rem;">
                                        <span style="color:#cbd5e1; font-weight:600;">Expected Batch Profit:</span>
                                        <strong id="calc-total-profit" style="color:#ffffff;">$0.00</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Action Bar -->
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.75rem; background:var(--surface-50); border-top:1px solid var(--border-color); flex-wrap:wrap; gap:1rem;">
                        <div style="font-size:0.8rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                            <span>Changes are saved immediately to your workspace catalog</span>
                        </div>
                        <div style="display:flex; gap:0.75rem; align-items:center;">
                            <button type="button" class="btn btn-secondary prd-cancel-trigger" id="prd-cancel-btn" style="padding:0.6rem 1.25rem; font-weight:600;">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="prd-submit-btn" style="padding:0.6rem 1.75rem; font-weight:700; display:flex; align-items:center; gap:0.5rem; border-radius:10px;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                <span>Save Product</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            
            <!-- PRODUCT LIST CONTAINER (Image 3 Modern Elevated Catalog) -->
            <!-- PRODUCT LIST CONTAINER -->
            <div id="product-list-container" style="display:block;">
                <!-- Straight Toolbar (Image 2: Search -> Category -> Filter -> Layouts -> Product Count) -->
                <div class="prd-toolbar prd-toolbar-straight" style="display:flex; align-items:center; gap:0.55rem; margin-bottom:1.25rem; flex-wrap:wrap; background:#ffffff; padding:0.65rem 0.9rem; border-radius:12px; border:1px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                    <!-- Smart Search Input -->
                    <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:210px; position:relative;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.2" style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); pointer-events:none;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="filter-search" class="form-control" style="width:100%; padding-left:2.2rem; font-size:0.85rem;" placeholder="Search by name, SKU, UPC, variant UPC...">
                    </div>
                    <!-- Category Dropdown -->
                    <select id="filter-category" class="form-control" style="width:auto; min-width:130px; font-size:0.83rem; font-weight:500;">
                        <option value="all">All Categories</option>
                    </select>
                    <!-- Sort / Filter Dropdown -->
                    <select id="filter-sort" class="form-control" style="width:auto; min-width:145px; font-size:0.83rem; font-weight:500;">
                        <option value="recent_created">Recently Created</option>
                        <option value="recent_updated">Recently Updated</option>
                        <option value="az">A to Z</option>
                        <option value="expire">Close to Expire</option>
                        <option value="low_qty">Low Quantity</option>
                        <option value="high_price">Highest Price</option>
                        <option value="oldest">Oldest</option>
                    </select>
                    <!-- Layout & Theme Drawer Trigger per User Requirement (Clean List > trigger) -->
                    <button type="button" id="btn-open-layout-drawer" class="btn btn-secondary prd-layout-trigger-btn" style="height:38px; padding:0 0.85rem; font-size:0.83rem; font-weight:600; display:inline-flex; align-items:center; gap:0.45rem; border-radius:10px; border:1px solid var(--border-color); background:var(--surface-50); color:var(--text-primary); cursor:pointer;" title="Choose Layout & Theme">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        <span>Layout:</span> <strong id="current-layout-label">${layoutDisplayNames[currentLayout] || 'List'}</strong>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <!-- Product Count Badge -->
                    <div id="product-count" style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); background:var(--surface-100); padding:0.45rem 0.85rem; border-radius:8px; border:1px solid var(--border-color); white-space:nowrap;">
                        0 Products
                    </div>
                </div>

                <!-- TABLE VIEW (for Default List layout) -->
                <div id="prd-table-card-container" class="prd-table-card" style="${currentLayout === 'list' ? 'display:block;' : 'display:none;'}">
                    <div class="table-container" style="overflow-x:auto;">
                        <table class="prd-table-modern">
                            <thead>
                                <tr>
                                    <th style="width:40px; text-align:center;">
                                        <input type="checkbox" id="prd-select-all" style="cursor:pointer; width:16px; height:16px; accent-color:var(--text-primary); border-radius:4px;">
                                    </th>
                                    <th style="min-width:240px;">Product</th>
                                    <th style="min-width:130px;">Category</th>
                                    <th style="min-width:120px;">Brand / Size</th>
                                    <th style="min-width:140px;">Price</th>
                                    <th style="min-width:130px;">Stock</th>
                                    <th style="min-width:120px; text-align:right; padding-right:1.5rem;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="product-list-body">
                                <!-- Injected dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- GRID / LARGE-LIST CARDS VIEW (for all 6 finding layouts) -->
                <div id="prd-grid-card-container" style="${currentLayout !== 'list' ? 'display:block;' : 'display:none;'}">
                    <!-- Injected dynamically -->
                </div>
            </div>

            <!-- FLOATING BATCH ACTION BAR (Multi-selection for category change, delete, or transfer to Market Updator) -->
            <div id="prd-batch-action-bar" class="prd-batch-action-bar" style="display:none;">
                <div style="display:flex; align-items:center; gap:0.65rem;">
                    <span id="prd-batch-count" class="prd-batch-badge">0 selected</span>
                    <button type="button" id="btn-batch-select-all" class="btn btn-secondary btn-sm" style="height:30px; font-size:0.75rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.65rem;" title="Select all active products or deselect all">
                        Select All
                    </button>
                    <button type="button" id="btn-batch-invert" class="btn btn-secondary btn-sm" style="height:30px; font-size:0.75rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.65rem; display:none;" title="Invert selection">
                        Invert
                    </button>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <button type="button" id="btn-batch-category" class="btn btn-secondary btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;" title="Change category for all selected products">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                        <span>Change Category</span>
                    </button>

                    <button type="button" id="btn-batch-transfer-market" class="btn btn-primary btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1px solid var(--btn-primary-border); background:var(--btn-primary-bg); color:var(--btn-primary-text); border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;" title="Transfer selected products to Market Updator for mass editing">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        <span>Transfer to Market Updator</span>
                    </button>

                    <button type="button" id="btn-batch-delete" class="btn btn-danger btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1.5px solid #fca5a5; background:var(--surface-100); color:#dc2626; border-radius:8px; display:inline-flex; align-items:center; gap:0.4rem;" title="Delete all selected products">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        <span>Delete Selected</span>
                    </button>

                    <button type="button" id="btn-batch-clear" class="btn btn-secondary btn-sm" style="height:32px; font-size:0.8rem; font-weight:700; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B; border-radius:8px; padding:0 0.85rem;" title="Clear selection">
                        Cancel
                    </button>
                </div>
            </div>

            <!-- BATCH CHANGE CATEGORY MODAL (Mounted top-level when opened) -->
            <div id="batch-category-modal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.65); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:9999999; align-items:center; justify-content:center;">
                <div class="modal-box" style="background:#FFFFFF; border-radius:16px; width:92%; max-width:440px; padding:1.5rem; box-shadow:0 20px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.08); border:1px solid #E4E4E7; color:#18181B;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="margin:0; font-size:1.1rem; font-weight:800; color:#18181B;">Batch Change Category</h3>
                        <button type="button" id="batch-cat-close" class="btn btn-secondary btn-sm" style="width:28px; height:28px; padding:0; border-radius:6px; border:1px solid #E4E4E7; background:#FFFFFF; color:#71717A; cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                    <p style="font-size:0.84rem; color:#71717A; margin-top:0; margin-bottom:1.25rem;">
                        Select the new category to apply to all <strong id="batch-cat-count" style="color:#18181B;">0</strong> selected products:
                    </p>
                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.4rem;">Target Category</label>
                        <select id="batch-cat-dropdown" class="form-control" style="width:100%; height:40px; font-size:0.85rem; border-radius:8px; border:1px solid #E4E4E7; background:#FAFAFA; color:#18181B;">
                            <!-- Injected dynamically -->
                        </select>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:0.65rem;">
                        <button type="button" id="batch-cat-cancel" class="btn btn-secondary" style="height:36px; padding:0 1rem; border-radius:8px; font-weight:600; border:1px solid #E4E4E7; background:#FFFFFF; color:#18181B;">Cancel</button>
                        <button type="button" id="batch-cat-confirm" class="btn btn-primary" style="height:36px; padding:0 1.25rem; border-radius:8px; font-weight:700; border:1px solid #18181B; background:#18181B; color:#FFFFFF;">Apply Category</button>
                    </div>
                </div>
            </div>

            <!-- SLIDE-OVER LAYOUT DRAWER (Contains .prd-layout-selector with 7 layout modes) -->
            <div id="prd-layout-drawer-overlay" class="app-drawer-overlay" style="display:none;"></div>
            <div id="prd-layout-drawer" class="app-drawer" style="display:none;">
                <div class="app-drawer-header">
                    <div>
                        <h3 class="app-drawer-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            <span>Product Display Layout</span>
                        </h3>
                        <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-secondary);">Choose your preferred density and finding layout</p>
                    </div>
                    <button type="button" id="prd-layout-drawer-close" class="app-drawer-close" title="Close Drawer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
                <div class="app-drawer-body">
                    
                    <!-- PRODUCT CATALOG LAYOUT SYSTEM (7 Layout Modes) -->
                    <div>
                        <div class="app-drawer-section-title" style="justify-content:space-between; margin-bottom: 0.85rem;">
                            <div style="display:flex; align-items:center; gap:0.4rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                <span>Catalog Finding Modes</span>
                            </div>
                            <span style="font-size:0.72rem; color:var(--text-muted); font-weight:700;">7 Modes</span>
                        </div>

                        <div class="prd-layout-selector layout-drawer-options" id="prd-layout-selector">
                            <!-- 1. Default List -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'list' ? 'active' : ''}" data-layout="list">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                        <strong style="font-size:0.86rem; color:var(--text-primary);">List (Default Table)</strong>
                                    </div>
                                    <span class="badge" style="background:var(--surface-100); color:var(--text-secondary); border:1px solid var(--border-color); font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">Table</span>
                                </div>
                            </button>

                            <!-- 2. Large List -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'large_list' ? 'active' : ''}" data-layout="large_list">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="7" rx="2"></rect><rect x="3" y="14" width="18" height="7" rx="2"></rect></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">Large List</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">Expanded</span>
                                </div>
                            </button>

                            <!-- 3. Grid 4x4 (4 Cube View) -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'grid_4' ? 'active' : ''}" data-layout="grid_4">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">Grid 4x4 (4 Cube View)</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">4 Cubes / Row</span>
                                </div>
                            </button>

                            <!-- 4. Hexa (6x6 Grid) -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'hexa' ? 'active' : ''}" data-layout="hexa">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z"></path></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">Hexa (6 per Row)</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">6 Cubes / Row</span>
                                </div>
                            </button>

                            <!-- 5. Octa (8x8 Grid) -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'octa' ? 'active' : ''}" data-layout="octa">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">Octa (8 per Row)</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">8 Cubes / Row</span>
                                </div>
                            </button>

                            <!-- 6. Hexadecagon (16x16 Grid - 16 cubes in a row for maximum products) -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'hexadecagon' ? 'active' : ''}" data-layout="hexadecagon">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">16x16 Cube (16 in a Row)</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">16 Cubes / Row</span>
                                </div>
                            </button>

                            <!-- 7. Hexa-Octa (32x32 Grid - 32 cubes in a row for maximum products) -->
                            <button type="button" class="layout-drawer-card prd-layout-pill-btn ${currentLayout === 'hexa_octa' ? 'active' : ''}" data-layout="hexa_octa">
                                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><line x1="2" y1="9" x2="22" y2="9"></line><line x1="2" y1="15" x2="22" y2="15"></line></svg>
                                        <strong style="font-size:0.86rem; color:#0f172a;">32x32 Cube (32 in a Row)</strong>
                                    </div>
                                    <span class="badge" style="background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; font-size:0.7rem; font-weight:700; padding:2px 6px; border-radius:4px;">32 Cubes / Row</span>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        setupMainViewEvents();
        renderProductList();
    };

    function renderProductList() {
        const userRestrictions = getUserRestrictions();
        const tbody = container.querySelector('#product-list-body');
        const tableCardContainer = container.querySelector('#prd-table-card-container');
        const gridCardContainer = container.querySelector('#prd-grid-card-container');
        if (!tbody) return;

        const searchVal = (container.querySelector('#filter-search')?.value || '').trim().toLowerCase();
        const sortVal = container.querySelector('#filter-sort')?.value || 'recent_created';
        const catVal = container.querySelector('#filter-category')?.value || 'all';

        let filtered = activeProducts.slice();

        if (catVal !== 'all') {
            filtered = filtered.filter(p => {
                const uId = categoriesList.find(c => c.uniqueId === p.category || c.id === p.category || c.name === p.category)?.uniqueId || p.category;
                return uId === catVal || p.category === catVal;
            });
        }

        // SMART SEARCH: Searching by Name, SKU, Barcode / UPC, Brand, Size, Note & Variant UPCs
        if (searchVal) {
            filtered = filtered.filter(p => {
                const name = (p.name || '').toLowerCase();
                const sku = (p.sku || p.upcCode || p.barcode || p.uniqueId || p.id || '').toLowerCase();
                const size = (p.sizeWeight || '').toLowerCase();
                const note = (p.note || '').toLowerCase();
                const brand = (p.brand || '').toLowerCase();

                if (name.includes(searchVal) || sku.includes(searchVal) || size.includes(searchVal) || note.includes(searchVal) || brand.includes(searchVal)) {
                    return true;
                }

                // Check variant UPC codes & variant titles
                if (Array.isArray(p.variations) && p.variations.length > 0) {
                    return p.variations.some(v => {
                        const vUpc = (v.upcCode || v.barcode || v.sku || '').toLowerCase();
                        const vName = (v.sizeFlavor || v.name || v.title || '').toLowerCase();
                        return vUpc.includes(searchVal) || vName.includes(searchVal);
                    });
                } else if (typeof p.variations === 'string' && p.variations.toLowerCase().includes(searchVal)) {
                    return true;
                }

                return false;
            });
        }

        filtered.sort((a, b) => {
            switch (sortVal) {
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

        // Full product display (no page limits / infinite by number of products)
        const totalItems = filtered.length;
        const pageItems = filtered;

        const countEl = container.querySelector('#product-count');
        if (countEl) countEl.textContent = `${totalItems} Product${totalItems === 1 ? '' : 's'}`;

        // Toggle Table vs Grid Container cleanly
        if (currentLayout === 'list') {
            if (tableCardContainer) tableCardContainer.style.setProperty('display', 'block', 'important');
            if (gridCardContainer) {
                gridCardContainer.style.setProperty('display', 'none', 'important');
                gridCardContainer.className = '';
                gridCardContainer.innerHTML = '';
            }
        } else {
            if (tableCardContainer) tableCardContainer.style.setProperty('display', 'none', 'important');
            if (gridCardContainer) {
                gridCardContainer.style.setProperty('display', 'grid', 'important');
                const gridClassMap = {
                    'large_list': 'prd-large-list',
                    'grid_4': 'prd-grid prd-grid-4',
                    'hexa': 'prd-grid prd-grid-hexa',
                    'octa': 'prd-grid prd-grid-octa',
                    'hexadecagon': 'prd-grid prd-grid-hexadecagon',
                    'hexa_octa': 'prd-grid prd-grid-hexa-octa'
                };
                gridCardContainer.className = gridClassMap[currentLayout] || 'prd-grid prd-grid-4';
            }
        }

        if (totalItems === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="padding:3rem 1.5rem; text-align:center; color: var(--text-muted);"><div style="font-weight:600; font-size:1rem; margin-bottom:0.25rem;">No products match your criteria</div><div style="font-size:0.83rem;">Try adjusting your search terms or category filter.</div></td></tr>`;
            if (gridCardContainer) {
                gridCardContainer.innerHTML = `<div style="padding:3rem 1.5rem; text-align:center; color: var(--text-muted); grid-column: 1 / -1;"><div style="font-weight:600; font-size:1rem; margin-bottom:0.25rem;">No products match your criteria</div><div style="font-size:0.83rem;">Try adjusting your search terms or category filter.</div></div>`;
            }
            return;
        }

        // 1. Render Table Rows for List Layout
        tbody.innerHTML = pageItems.map(prd => {
            const catObj = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category);
            const catName = catObj?.name || prd.category || 'General';
            const catColor = catObj?.color || '#18181B';

            const isCreatorSelf = (prd.creatorId && (
                prd.creatorId === currentUser.uid || 
                (currentUser.email && prd.creatorId.toLowerCase() === (currentUser.email || '').toLowerCase())
            )) || (prd.createdBy && (
                prd.createdBy === currentUser.uid || 
                (currentUser.email && prd.createdBy.toLowerCase() === (currentUser.email || '').toLowerCase())
            ));

            const canEdit = !userRestrictions.disableUpdate && (!userRestrictions.disableUpdateOthers || isCreatorSelf);
            const canDelete = !userRestrictions.disableDelete && (!userRestrictions.disableDeleteOthers || isCreatorSelf);
            const canDuplicate = !userRestrictions.disableAdd;

            const skuCode = prd.upcCode ? `UPC: ${prd.upcCode}` : (prd.uniqueId ? `#${prd.uniqueId.substring(0, 8)}` : `#${prd.id.substring(0, 8)}`);

            const salePriceFormatted = formatCurrency(prd.salePrice || 0);
            let mrpMarkup = '';
            if (prd.mrp && Number(prd.mrp) > Number(prd.salePrice)) {
                const discountPct = Math.round((1 - (Number(prd.salePrice) / Number(prd.mrp))) * 100);
                mrpMarkup = `
                    <div style="display:flex; align-items:center; gap:4px; margin-top:2px;">
                        <span style="font-size:0.75rem; text-decoration:line-through; color:#94a3b8;">${formatCurrency(prd.mrp)}</span>
                        <span style="background:#F4F4F5; border:1px solid #E4E4E7; color:var(--text-primary); font-size:0.7rem; font-weight:700; padding:1px 5px; border-radius:4px;">-${discountPct}%</span>
                    </div>
                `;
            }

            const qty = Number(prd.quantity) || 0;
            let stockStatusDot = '#10b981';
            let stockStatusText = `${qty} in stock`;
            let stockColor = '#059669';

            if (qty <= 0) {
                stockStatusDot = '#ef4444';
                stockStatusText = 'Out of stock';
                stockColor = '#dc2626';
            } else if (qty <= 5) {
                stockStatusDot = '#f59e0b';
                stockStatusText = `${qty} low stock`;
                stockColor = '#d97706';
            }

            const creatorBadge = prd.creatorId
                ? (isCreatorSelf
                    ? `<span class="badge" style="background:#F4F4F5; border:1px solid #E4E4E7; color:var(--text-primary); font-size:0.7rem; padding:1px 5px; border-radius:4px; font-weight:700;" title="Created by you">By You</span>`
                    : `<span class="badge" style="background:rgba(100,116,139,0.1); color:#64748b; font-size:0.7rem; padding:1px 5px; border-radius:4px;" title="Created by member ${prd.creatorId}">Member</span>`)
                : '';

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                    <td style="width:40px; text-align:center; padding:0.95rem 0.5rem 0.95rem 1.15rem;">
                        <input type="checkbox" class="prd-select-chk" data-id="${prd.id}" ${selectedProductIds.has(prd.id) ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:var(--text-primary); border-radius:4px;">
                    </td>
                    <td style="padding:0.95rem 1.15rem;">
                        <div style="display:flex; align-items:center; gap:0.85rem;">
                            <div class="prd-thumb-box view-prd-img" data-id="${prd.id}" style="cursor:pointer;" title="Click to view details">
                                ${prd.imageUri 
                                    ? `<img src="${prd.imageUri}" alt="${prd.name}">` 
                                    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`
                                }
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
                                    <strong class="view-prd-title" data-id="${prd.id}" style="cursor:pointer; color:var(--text-primary); font-size:0.9rem; font-weight:700;">${prd.name}</strong>
                                    ${creatorBadge}
                                </div>
                                <div style="font-size:0.75rem; color:var(--text-muted); font-family:monospace; margin-top:2px;">
                                    ${skuCode}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td style="padding:0.95rem 1.15rem;">
                        <span class="prd-cat-tag" style="background:var(--surface-100); color:var(--text-primary); border:1px solid var(--border-color);">
                            ${catName}
                        </span>
                    </td>
                    <td style="padding:0.95rem 1.15rem; font-size:0.85rem; color:var(--text-secondary);">
                        ${prd.sizeWeight || '<span style="color:var(--text-muted);">Standard</span>'}
                    </td>
                    <td style="padding:0.95rem 1.15rem;">
                        <div style="font-weight:800; color:var(--text-primary); font-size:0.92rem;">${salePriceFormatted}</div>
                        ${mrpMarkup}
                    </td>
                    <td style="padding:0.95rem 1.15rem;">
                        <div class="prd-stock-indicator" style="color:${stockColor};">
                            <span class="prd-stock-dot" style="background:${stockStatusDot};"></span>
                            <span>${stockStatusText}</span>
                        </div>
                    </td>
                    <td style="padding:0.95rem 1.5rem 0.95rem 1.15rem; text-align:right;">
                        <div style="display:inline-flex; gap:0.35rem; align-items:center; justify-content:flex-end;">
                            <button class="btn btn-sm view-prd" data-id="${prd.id}" style="padding:0.32rem 0.65rem; font-size:0.8rem; font-weight:700; background:var(--surface-50); color:var(--text-primary); border:1px solid var(--border-color); border-radius:8px;" title="View Product Analytics">
                                View &rsaquo;
                            </button>
                            ${canEdit ? `
                                <button class="btn btn-sm btn-secondary edit-prd" data-id="${prd.id}" style="padding:0.32rem 0.55rem; font-size:0.8rem; border-radius:8px;" title="Edit Product">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                            ` : (userRestrictions.disableUpdateOthers && !isCreatorSelf ? `
                                <button class="btn btn-sm btn-secondary restricted-action" disabled style="opacity:0.4; cursor:not-allowed; padding:0.32rem 0.55rem; border-radius:8px;" title="Restricted: Cannot edit data created by others">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </button>
                            ` : '')}
                            ${canDuplicate ? `
                                <button class="btn btn-sm btn-secondary dup-prd" data-id="${prd.id}" style="padding:0.32rem 0.55rem; font-size:0.8rem; border-radius:8px;" title="Duplicate Product">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                </button>
                            ` : ''}
                            ${canDelete ? `
                                <button class="btn btn-sm btn-outline del-prd" data-id="${prd.id}" style="padding:0.32rem 0.55rem; font-size:0.8rem; border-radius:8px; color:var(--danger); border-color:rgba(239,68,68,0.3);" title="Delete Product">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            ` : (userRestrictions.disableDeleteOthers && !isCreatorSelf ? `
                                <button class="btn btn-sm btn-secondary restricted-action" disabled style="opacity:0.4; cursor:not-allowed; padding:0.32rem 0.55rem; border-radius:8px; color:var(--text-muted);" title="Restricted: Cannot delete data created by others">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </button>
                            ` : '')}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 2. Render Cards for Large List & Finding Grids
        if (gridCardContainer) {
            if (currentLayout === 'large_list') {
                gridCardContainer.innerHTML = pageItems.map(prd => {
                    const catObj = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category);
                    const catName = catObj?.name || prd.category || 'General';
                    const salePriceFormatted = formatCurrency(prd.salePrice || 0);
                    const qty = Number(prd.quantity) || 0;
                    const skuCode = prd.upcCode ? `UPC: ${prd.upcCode}` : (prd.uniqueId ? `#${prd.uniqueId.substring(0, 8)}` : `#${prd.id.substring(0, 8)}`);

                    return `
                        <div class="prd-large-list-card" data-id="${prd.id}">
                            <div style="display:flex; align-items:center; padding-right:0.65rem;" onclick="event.stopPropagation();">
                                <input type="checkbox" class="prd-select-chk" data-id="${prd.id}" ${selectedProductIds.has(prd.id) ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:#0f172a; border-radius:4px;">
                            </div>
                            <div style="display:flex; align-items:center; gap:1.15rem; flex:1; min-width:240px;">
                                <div class="prd-thumb-box view-prd-img" data-id="${prd.id}" style="width:68px; height:68px; border-radius:12px; cursor:pointer; flex-shrink:0;">
                                    ${prd.imageUri ? `<img src="${prd.imageUri}" alt="${prd.name}">` : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`}
                                </div>
                                <div>
                                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                                        <strong class="view-prd-title" data-id="${prd.id}" style="cursor:pointer; color:var(--text-primary); font-size:1rem; font-weight:700;">${prd.name}</strong>
                                        <span class="badge" style="background:var(--surface-100); color:var(--text-primary); font-size:0.72rem; font-weight:700; padding:2px 7px; border-radius:5px; border:1px solid var(--border-color);">${catName}</span>
                                    </div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px; display:flex; gap:0.65rem; align-items:center;">
                                        <span>${prd.sizeWeight || 'Standard'}</span>
                                        <span>&bull;</span>
                                        <code style="font-family:monospace; color:var(--text-muted);">${skuCode}</code>
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; align-items:center; gap:1.5rem;">
                                <div style="text-align:right;">
                                    <div style="font-weight:800; font-size:1.25rem; color:var(--text-primary);">${salePriceFormatted}</div>
                                    <div style="font-size:0.8rem; font-weight:700; color:${qty > 0 ? '#059669' : '#dc2626'};">${qty > 0 ? `${qty} in stock` : 'Out of stock'}</div>
                                </div>
                                <button type="button" class="btn btn-sm view-prd" data-id="${prd.id}" style="padding:0.4rem 0.85rem; font-size:0.85rem; font-weight:700; background:var(--surface-50); color:var(--text-primary); border:1px solid var(--border-color); border-radius:8px;">
                                    View &rsaquo;
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else if (currentLayout === 'hexa_octa') {
                // 32x32 Cube: Photo square 1:1, followed by price only (no name)
                gridCardContainer.innerHTML = pageItems.map(prd => {
                    const salePriceFormatted = formatCurrency(prd.salePrice || 0);
                    const qty = Number(prd.quantity) || 0;
                    return `
                        <div class="prd-find-card prd-find-cube-32 view-prd" data-id="${prd.id}" title="${prd.name} - ${salePriceFormatted} (${qty} in stock)">
                            <label class="prd-find-chk-wrap" onclick="event.stopPropagation();" title="Select product">
                                <input type="checkbox" class="prd-select-chk" data-id="${prd.id}" ${selectedProductIds.has(prd.id) ? 'checked' : ''} style="cursor:pointer; width:11px; height:11px; accent-color:#0f172a; border-radius:3px;">
                            </label>
                            <div class="prd-find-card-thumb prd-find-img-wrap" style="aspect-ratio:1/1; width:100%; border-radius:4px; overflow:hidden; margin-bottom:2px;">
                                ${prd.imageUri ? `<img src="${prd.imageUri}" alt="${prd.name}" style="aspect-ratio:1/1; width:100%; height:100%; object-fit:cover; display:block;">` : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`}
                            </div>
                            <div class="prd-find-info" style="text-align:center; width:100%; padding:0;">
                                <span class="prd-find-card-price prd-find-price" style="font-size:0.62rem; font-weight:800; line-height:1; display:block; color:var(--text-primary);">${salePriceFormatted}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                // Finding Grids & Cube Views: Photo & name stock & price with selection checkboxes
                gridCardContainer.innerHTML = pageItems.map(prd => {
                    const salePriceFormatted = formatCurrency(prd.salePrice || 0);
                    const qty = Number(prd.quantity) || 0;
                    const isMicro = currentLayout === 'hexadecagon';
                    return `
                        <div class="prd-find-card view-prd" data-id="${prd.id}" title="${prd.name} - ${salePriceFormatted} (${qty} in stock)">
                            <label class="prd-find-chk-wrap" onclick="event.stopPropagation();" title="Select product">
                                <input type="checkbox" class="prd-select-chk" data-id="${prd.id}" ${selectedProductIds.has(prd.id) ? 'checked' : ''} style="cursor:pointer; width:${isMicro ? '12px' : '15px'}; height:${isMicro ? '12px' : '15px'}; accent-color:#0f172a; border-radius:3px;">
                            </label>
                            <div class="prd-find-card-thumb prd-find-img-wrap">
                                ${prd.imageUri ? `<img src="${prd.imageUri}" alt="${prd.name}">` : `<svg width="${isMicro ? '14' : '22'}" height="${isMicro ? '14' : '22'}" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>`}
                            </div>
                            <div class="prd-find-info">
                                <div class="prd-find-card-name prd-find-name">${prd.name}</div>
                                <div class="prd-find-card-meta prd-find-meta">
                                    <span class="prd-find-card-price prd-find-price">${salePriceFormatted}</span>
                                    <span class="prd-find-card-stock prd-find-stock ${qty <= 0 ? 'stock-out' : (qty <= 5 ? 'stock-low' : 'stock-ok')}">${qty}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        attachListEvents();
    };

    function updateBatchBar() {
        if (!container || !container.isConnected) return;
        let bar = document.getElementById('prd-batch-action-bar');
        if (!bar) bar = container.querySelector('#prd-batch-action-bar');
        if (bar && bar.parentElement !== document.body) {
            document.body.appendChild(bar);
        }
        const countEl = bar ? bar.querySelector('#prd-batch-count') : null;
        const catCountEl = bar ? bar.querySelector('#batch-cat-count') : null;
        const invertBtn = bar ? bar.querySelector('#btn-batch-invert') : null;
        const selectAllBtn = bar ? bar.querySelector('#btn-batch-select-all') : null;
        const count = selectedProductIds.size;

        if (bar) {
            if (count > 0) {
                bar.style.display = 'flex';
                setTimeout(() => bar.classList.add('visible'), 10);
                if (countEl) countEl.textContent = `${count} selected`;
                if (catCountEl) catCountEl.textContent = `${count}`;
                if (invertBtn) invertBtn.style.display = count >= 2 ? 'inline-flex' : 'none';
                if (selectAllBtn) {
                    const allActiveIds = activeProducts.map(p => p.id);
                    const allSelected = allActiveIds.length > 0 && allActiveIds.every(id => selectedProductIds.has(id));
                    selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
                }
            } else {
                bar.classList.remove('visible');
                setTimeout(() => { bar.style.display = 'none'; }, 260);
            }
        }
        const selectAll = container.querySelector('#prd-select-all');
        if (selectAll) {
            const pageChk = container.querySelectorAll('.prd-select-chk');
            if (pageChk.length > 0) {
                selectAll.checked = Array.from(pageChk).every(c => c.checked);
            } else {
                selectAll.checked = false;
            }
        }
    }

    function attachListEvents() {
        const userRestrictions = getUserRestrictions();

        // Checkbox change listener
        container.querySelectorAll('.prd-select-chk').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                if (id) {
                    if (e.target.checked) selectedProductIds.add(id);
                    else selectedProductIds.delete(id);
                    updateBatchBar();
                }
            });
        });
        updateBatchBar();

        // Dedicated View Panel Trigger
        const openDetail = (id) => {
            const prd = activeProducts.find(p => p.id === id);
            if (prd) {
                renderProductDetailView(prd);
            }
        };

        // Long-press and card click handling for Multi-selection
        let pressTimer = null;
        let isLongPress = false;

        container.querySelectorAll('.prd-item-row, .prd-find-card, .prd-large-list-card, .prd-cube-card, .prd-grid-card').forEach(card => {
            const getCardId = () => card.getAttribute('data-id') || card.querySelector('.prd-select-chk')?.getAttribute('data-id');

            const startPress = (e) => {
                if (e.target.closest('button, a, input, select')) return;
                isLongPress = false;
                clearTimeout(pressTimer);
                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    const id = getCardId();
                    if (id) {
                        if (selectedProductIds.has(id)) {
                            selectedProductIds.delete(id);
                        } else {
                            selectedProductIds.add(id);
                        }
                        const chk = card.querySelector('.prd-select-chk');
                        if (chk) chk.checked = selectedProductIds.has(id);
                        updateBatchBar();
                    }
                }, 450);
            };
            const cancelPress = () => clearTimeout(pressTimer);

            card.addEventListener('mousedown', startPress);
            card.addEventListener('mouseup', cancelPress);
            card.addEventListener('mouseleave', cancelPress);
            card.addEventListener('touchstart', startPress, { passive: true });
            card.addEventListener('touchend', cancelPress);
            card.addEventListener('touchcancel', cancelPress);

            card.addEventListener('click', (e) => {
                if (isLongPress) {
                    e.preventDefault();
                    e.stopPropagation();
                    isLongPress = false;
                    return;
                }
                if (e.target.closest('.edit-prd, .dup-prd, .del-prd, .prd-select-chk, .restricted-action')) return;
                
                // If multi-select mode is active, clicking card toggles selection instead of opening view!
                if (selectedProductIds.size > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = getCardId();
                    if (id) {
                        if (selectedProductIds.has(id)) selectedProductIds.delete(id);
                        else selectedProductIds.add(id);
                        const chk = card.querySelector('.prd-select-chk');
                        if (chk) chk.checked = selectedProductIds.has(id);
                        updateBatchBar();
                    }
                    return;
                }

                const id = getCardId();
                if (id) openDetail(id);
            });
        });

        // Pagination page number buttons
        container.querySelectorAll('.prd-page-num').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.getAttribute('data-page'), 10);
                if (!isNaN(page) && page !== currentPage) {
                    currentPage = page;
                    renderProductList();
                }
            });
        });

        // Edit Product Click with Double Permission Check
        container.querySelectorAll('.edit-prd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd) {
                    const isCreatorSelf = (prd.creatorId && (
                        prd.creatorId === currentUser.uid || 
                        (currentUser.email && prd.creatorId.toLowerCase() === (currentUser.email || '').toLowerCase())
                    )) || (prd.createdBy && (
                        prd.createdBy === currentUser.uid || 
                        (currentUser.email && prd.createdBy.toLowerCase() === (currentUser.email || '').toLowerCase())
                    ));

                    if (userRestrictions.disableUpdate) {
                        showAlert.warning("You are restricted from updating product data.");
                        return;
                    }
                    if (userRestrictions.disableUpdateOthers && !isCreatorSelf) {
                        showAlert.warning("You are restricted from updating products created by other members.");
                        return;
                    }

                    const formContainer = container.querySelector('#product-form-container');
                    container.querySelector('#prd-id').value = prd.id;
                    container.querySelector('#prd-image').value = prd.imageUri || '';
                    updateImagePreview(prd.imageUri || '');

                    container.querySelector('#prd-name').value = prd.name || '';
                    container.querySelector('#prd-size').value = prd.sizeWeight || '';
                    const matchedCat = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category);
                    container.querySelector('#prd-category').value = matchedCat ? (matchedCat.uniqueId || matchedCat.id) : (prd.category || '');
                    container.querySelector('#prd-upc').value = prd.upcCode || '';
                    container.querySelector('#prd-note').value = prd.note || '';

                    container.querySelector('#prd-qty').value = prd.quantity || 0;

                    if (userRestrictions.cannotSeeCost) {
                        const costEl = container.querySelector('#prd-cost-price');
                        if (costEl) {
                            costEl.type = 'text';
                            costEl.value = '••••';
                            costEl.disabled = true;
                            costEl.readOnly = true;
                        }
                    } else {
                        container.querySelector('#prd-cost-price').value = prd.price !== undefined && prd.price !== null ? prd.price : '';
                    }
                    container.querySelector('#prd-sale-price').value = prd.salePrice !== undefined && prd.salePrice !== null ? prd.salePrice : '';
                    container.querySelector('#prd-base-price').value = prd.basePrice !== undefined && prd.basePrice !== null ? prd.basePrice : '';
                    container.querySelector('#prd-mrp').value = prd.mrp !== undefined && prd.mrp !== null ? prd.mrp : '';

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
                        } catch (e) { }
                    }

                    const badgeEl = container.querySelector('#prd-form-badge');
                    if (badgeEl) badgeEl.textContent = 'Edit Product Mode';
                    container.querySelector('#prd-form-title').textContent = 'Edit Product Details';

                    const submitBtn = container.querySelector('#prd-submit-btn');
                    if (submitBtn) {
                        submitBtn.innerHTML = `
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            <span>Update Product</span>
                        `;
                    }

                    showProductEditorView();

                    updateLiveProfitSummary();
                    initialProductSnapshot = getProductFormSnapshot();
                    restoreProductDraftIfAny(prd.id);
                    checkProductDirty();
                }
            });
        });

        // View Product Details Button, Title, and Thumbnail Clicks
        container.querySelectorAll('.view-prd, .view-prd-title, .view-prd-img').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = el.getAttribute('data-id') || el.closest('[data-id]')?.getAttribute('data-id');
                if (id) openDetail(id);
            });
        });

        // Duplicate with Double Permission Check
        container.querySelectorAll('.dup-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (userRestrictions.disableAdd) {
                    showAlert.warning("You are restricted from adding new data.");
                    return;
                }
                const id = e.currentTarget.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd && await showAlert.confirm(`Duplicate ${prd.name}?`)) {
                    try {
                        await productService.duplicateProduct(prd, currentUser.uid, userRestrictions);
                        showAlert.success('Product duplicated');
                        await loadData();
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });

        // Delete Product with Double Permission Check
        container.querySelectorAll('.del-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd) {
                    const isCreatorSelf = (prd.creatorId && (
                        prd.creatorId === currentUser.uid || 
                        (currentUser.email && prd.creatorId.toLowerCase() === (currentUser.email || '').toLowerCase())
                    )) || (prd.createdBy && (
                        prd.createdBy === currentUser.uid || 
                        (currentUser.email && prd.createdBy.toLowerCase() === (currentUser.email || '').toLowerCase())
                    ));

                    if (userRestrictions.disableDelete) {
                        showAlert.warning("You are restricted from deleting products.");
                        return;
                    }
                    if (userRestrictions.disableDeleteOthers && !isCreatorSelf) {
                        showAlert.warning("You are restricted from deleting products created by other members.");
                        return;
                    }

                    if (await showAlert.confirm(`Delete product "${prd.name}" permanently?`)) {
                        try {
                            await productService.deleteProduct(id, userRestrictions, currentUser.uid);
                            showAlert.success('Product deleted successfully');
                            await loadData();
                        } catch (err) {
                            showAlert.error(err.message || 'Failed to delete product');
                        }
                    }
                }
            });
        });
    };

    // Live Media Preview & Dynamic Header Logo Helper
    const updateImagePreview = (url) => {
        const preview = container.querySelector('#prd-image-preview');
        const emptyState = container.querySelector('#prd-media-empty-state');
        const headerLogoBox = container.querySelector('#prd-form-header-logo-box');
        const headerLogoImg = container.querySelector('#prd-header-logo-img');
        const headerLogoSvg = container.querySelector('#prd-header-logo-svg');

        const hasValidImg = Boolean(url && typeof url === 'string' && url.trim() !== '');

        if (preview && emptyState) {
            if (hasValidImg) {
                preview.src = url.trim();
                preview.style.display = 'block';
                emptyState.style.display = 'none';
            } else {
                preview.src = '';
                preview.style.display = 'none';
                emptyState.style.display = 'block';
            }
        }

        if (headerLogoBox && headerLogoImg && headerLogoSvg) {
            if (hasValidImg) {
                headerLogoImg.src = url.trim();
                headerLogoImg.style.display = 'block';
                headerLogoSvg.style.display = 'none';
                headerLogoBox.classList.add('has-img');
            } else {
                headerLogoImg.src = '';
                headerLogoImg.style.display = 'none';
                headerLogoSvg.style.display = 'block';
                headerLogoBox.classList.remove('has-img');
            }
        }
    };

    // Live Financial & Profit Margin Calculator Engine
    const updateLiveProfitSummary = () => {
        const cost = parseFloat(container.querySelector('#prd-cost-price')?.value || 0) || 0;
        const sale = parseFloat(container.querySelector('#prd-sale-price')?.value || 0) || 0;
        const mrp = parseFloat(container.querySelector('#prd-mrp')?.value || 0) || 0;
        const qty = parseInt(container.querySelector('#prd-qty')?.value || 0, 10) || 0;

        const unitProfit = sale - cost;
        const markupPct = cost > 0 ? ((unitProfit / cost) * 100) : (sale > 0 ? 100 : 0);
        const marginPct = sale > 0 ? ((unitProfit / sale) * 100) : 0;
        const mrpDiscountPct = (mrp > 0 && mrp > sale) ? (((mrp - sale) / mrp) * 100) : 0;

        const totalCostVal = qty * cost;
        const totalSaleVal = qty * sale;
        const totalProfitVal = qty * unitProfit;

        const unitProfitEl = container.querySelector('#calc-unit-profit');
        const markupEl = container.querySelector('#calc-markup');
        const marginEl = container.querySelector('#calc-margin');
        const mrpDiscEl = container.querySelector('#calc-mrp-discount');
        const totalCostEl = container.querySelector('#calc-total-cost');
        const totalSaleEl = container.querySelector('#calc-total-sale');
        const totalProfitEl = container.querySelector('#calc-total-profit');
        const profitPill = container.querySelector('#calc-profit-pill');

        const userRestrictions = getUserRestrictions();
        if (userRestrictions.cannotSeeCost) {
            if (totalCostEl) totalCostEl.textContent = '••••';
            if (markupEl) markupEl.textContent = '••••';
            if (marginEl) marginEl.textContent = '••••';
            if (unitProfitEl) unitProfitEl.textContent = '••••';
            if (totalProfitEl) totalProfitEl.textContent = '••••';
            if (profitPill) {
                profitPill.textContent = '••••';
                profitPill.style.background = 'rgba(100, 116, 139, 0.2)';
                profitPill.style.color = '#cbd5e1';
            }
            if (totalSaleEl) totalSaleEl.textContent = formatCurrency(totalSaleVal);
            if (mrpDiscEl) mrpDiscEl.textContent = mrpDiscountPct > 0 ? `${mrpDiscountPct.toFixed(1)}% Off` : '0%';
            return;
        }

        if (userRestrictions.cannotSeeProfit) {
            if (unitProfitEl) unitProfitEl.textContent = '••••';
            if (markupEl) markupEl.textContent = '••••';
            if (marginEl) marginEl.textContent = '••••';
            if (totalProfitEl) totalProfitEl.textContent = '••••';
            if (profitPill) {
                profitPill.textContent = '••••';
                profitPill.style.background = 'rgba(100, 116, 139, 0.2)';
                profitPill.style.color = '#cbd5e1';
            }
            if (totalCostEl) totalCostEl.textContent = formatCurrency(totalCostVal);
            if (totalSaleEl) totalSaleEl.textContent = formatCurrency(totalSaleVal);
            if (mrpDiscEl) mrpDiscEl.textContent = mrpDiscountPct > 0 ? `${mrpDiscountPct.toFixed(1)}% Off` : '0%';
            return;
        }

        if (unitProfitEl) {
            unitProfitEl.textContent = (unitProfit >= 0 ? '+' : '') + formatCurrency(unitProfit);
            unitProfitEl.style.color = '#ffffff';
        }
        if (markupEl) {
            markupEl.textContent = `${markupPct.toFixed(1)}%`;
            markupEl.style.color = markupPct >= 0 ? '#ffffff' : '#ef4444';
        }
        if (marginEl) {
            marginEl.textContent = `${marginPct.toFixed(1)}%`;
            marginEl.style.color = marginPct >= 0 ? '#ffffff' : '#ef4444';
        }
        if (mrpDiscEl) {
            mrpDiscEl.textContent = mrpDiscountPct > 0 ? `${mrpDiscountPct.toFixed(1)}% Off` : '0%';
        }
        if (totalCostEl) totalCostEl.textContent = formatCurrency(totalCostVal);
        if (totalSaleEl) totalSaleEl.textContent = formatCurrency(totalSaleVal);
        if (totalProfitEl) {
            totalProfitEl.textContent = (totalProfitVal >= 0 ? '+' : '') + formatCurrency(totalProfitVal);
            totalProfitEl.style.color = '#ffffff';
        }

        if (profitPill) {
            if (sale === 0 && cost === 0) {
                profitPill.textContent = 'Awaiting Price Input';
                profitPill.style.background = 'rgba(100, 116, 139, 0.2)';
                profitPill.style.color = '#cbd5e1';
            } else if (unitProfit > 0) {
                profitPill.textContent = `Profitable (+${marginPct.toFixed(1)}% Margin)`;
                profitPill.style.background = 'rgba(255, 255, 255, 0.15)';
                profitPill.style.color = '#ffffff';
            } else if (unitProfit === 0) {
                profitPill.textContent = 'Break-Even (0% Margin)';
                profitPill.style.background = 'rgba(255, 255, 255, 0.1)';
                profitPill.style.color = '#cbd5e1';
            } else {
                profitPill.textContent = `Loss (${marginPct.toFixed(1)}% Margin)`;
                profitPill.style.background = 'rgba(255, 255, 255, 0.1)';
                profitPill.style.color = '#cbd5e1';
            }
        }
    };

    // Product Smart Button State & Snapshot Helper
    let initialProductSnapshot = null;
    let prdUnsavedIndicator = null;

    function getProductFormSnapshot() {
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
    }

    function isProductFormDirty() {
        const formContainer = container.querySelector('#product-form-container');
        if (!formContainer || !document.body.contains(formContainer) || formContainer.style.display === 'none') return false;

        const isEditMode = Boolean(container.querySelector('#prd-id')?.value);
        if (isEditMode) {
            if (!initialProductSnapshot) return false;
            return getProductFormSnapshot() !== initialProductSnapshot;
        } else {
            const name = container.querySelector('#prd-name')?.value?.trim() || '';
            const size = container.querySelector('#prd-size')?.value?.trim() || '';
            const cat = container.querySelector('#prd-category')?.value || '';
            const upc = container.querySelector('#prd-upc')?.value?.trim() || '';
            const note = container.querySelector('#prd-note')?.value?.trim() || '';
            const sale = container.querySelector('#prd-sale-price')?.value?.trim() || '';
            const cost = container.querySelector('#prd-cost-price')?.value?.trim() || '';
            const variations = container.querySelectorAll('.prd-variation-item-row');
            return Boolean(name || size || cat || upc || note || sale || cost || variations.length > 0);
        }
    }

    function checkProductDirty() {
        const isDirty = isProductFormDirty();
        if (prdUnsavedIndicator) {
            prdUnsavedIndicator.update(isDirty);
        }

        const curId = container.querySelector('#prd-id')?.value || 'new';
        if (isDirty) {
            draftManager.saveDraft(`product_${curId}`, getProductFormSnapshot());
            draftManager.registerActiveForm('product_form', isProductFormDirty);
        } else {
            draftManager.clearDraft(`product_${curId}`);
            draftManager.unregisterActiveForm('product_form');
        }
    }

    function restoreProductDraftIfAny(targetId = 'new') {
        const draft = draftManager.getDraft(`product_${targetId}`);
        if (!draft) return false;
        try {
            const data = typeof draft === 'string' ? JSON.parse(draft) : draft;
            if (data.name !== undefined) container.querySelector('#prd-name').value = data.name;
            if (data.size !== undefined) container.querySelector('#prd-size').value = data.size;
            if (data.category !== undefined) container.querySelector('#prd-category').value = data.category;
            if (data.upc !== undefined) container.querySelector('#prd-upc').value = data.upc;
            if (data.note !== undefined) container.querySelector('#prd-note').value = data.note;
            if (data.qty !== undefined) container.querySelector('#prd-qty').value = data.qty;
            if (data.cost !== undefined) container.querySelector('#prd-cost-price').value = data.cost || '';
            if (data.sale !== undefined) container.querySelector('#prd-sale-price').value = data.sale || '';
            if (data.base !== undefined) container.querySelector('#prd-base-price').value = data.base || '';
            if (data.mrp !== undefined) container.querySelector('#prd-mrp').value = data.mrp || '';
            if (data.mfg !== undefined) container.querySelector('#prd-mfg-date').value = data.mfg || '';
            if (data.exp !== undefined) container.querySelector('#prd-exp-date').value = data.exp || '';
            if (data.image) {
                container.querySelector('#prd-image').value = data.image;
                updateImagePreview(data.image);
            }
            if (Array.isArray(data.variations)) {
                clearVariations();
                data.variations.forEach(v => addVariationRow(v.size || v.sizeFlavor || '', v.upc || v.upcCode || ''));
            }
            updateLiveProfitSummary();
            return true;
        } catch (e) {
            console.warn("Could not parse product draft:", e);
            return false;
        }
    }

    let isVarBatchAutoBarcodeActive = false;
    let selectedVariationTemplate = null;
    let selectedMainTemplate = null;

    // Helper: Open Camera & Handheld Barcode Scanner Dialog
    function openBarcodeScannerDialog(onScanned) {
        const modalId = 'prd-barcode-scanner-modal';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(8px);
            z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
        `;

        modal.innerHTML = `
            <div class="card" style="background:#ffffff; width:100%; max-width:500px; border-radius:18px; border:1px solid var(--border-color); box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); overflow:hidden; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="display:flex; justify-content:space-between; align-items:center; padding:1.15rem 1.4rem; border-bottom:1px solid var(--border-color); background:var(--surface-50);">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <div style="width:34px; height:34px; border-radius:10px; background:#F4F4F5; color:#18181B; display:flex; align-items:center; justify-content:center; border:1px solid #E4E4E7;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><rect x="7" y="7" width="10" height="10" rx="1"></rect></svg>
                        </div>
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">Scan Barcode</h3>
                            <p style="margin:2px 0 0; font-size:0.75rem; color:#71717A;">Scan real barcode via camera or USB handheld laser</p>
                        </div>
                    </div>
                    <button type="button" id="prd-scanner-close-btn" style="background:#F4F4F5; border:1px solid #E4E4E7; border-radius:8px; width:30px; height:30px; color:#71717A; font-size:1.25rem; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;">&times;</button>
                </div>

                <div style="padding:1.25rem 1.4rem;">
                    <!-- Video viewfinder -->
                    <div style="position:relative; width:100%; height:210px; background:#09090B; border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                        <video id="prd-scanner-video" playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
                        <div style="position:absolute; width:170px; height:110px; border:2px dashed #FFFFFF; border-radius:10px; pointer-events:none; box-shadow:0 0 0 9999px rgba(0,0,0,0.38);">
                            <div style="position:absolute; top:50%; left:0; width:100%; height:2px; background:#EF4444; opacity:0.85; transform:translateY(-50%);"></div>
                        </div>
                        <div id="prd-scanner-cam-status" style="position:absolute; bottom:8px; left:8px; right:8px; text-align:center; font-size:0.72rem; color:#ffffff; background:rgba(0,0,0,0.7); padding:4px 8px; border-radius:6px;">
                            Initializing camera...
                        </div>
                    </div>

                    <!-- Manual input / USB scanner -->
                    <div style="margin-top:1rem;">
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">
                            Handheld Laser Scanner / Manual Code
                        </label>
                        <div style="display:flex; gap:0.5rem;">
                            <input type="text" id="prd-scanner-manual-input" class="form-control" placeholder="Scan barcode or type digits..." style="flex:1; padding:0.55rem 0.75rem; font-family:monospace; font-weight:700; font-size:0.92rem;">
                            <button type="button" id="prd-scanner-insert-btn" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; padding:0.55rem 1rem; border-radius:8px;">
                                Apply
                            </button>
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.85rem 1.4rem; background:var(--surface-50); border-top:1px solid var(--border-color);">
                    <button type="button" id="prd-scanner-toggle-cam" class="btn btn-secondary" style="font-size:0.78rem; padding:0.4rem 0.85rem; font-weight:600;">
                        Toggle Camera
                    </button>
                    <button type="button" id="prd-scanner-done-btn" class="btn btn-secondary" style="font-size:0.78rem; padding:0.4rem 0.85rem; font-weight:700;">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        let stream = null;
        let detectInterval = null;
        const video = modal.querySelector('#prd-scanner-video');
        const statusEl = modal.querySelector('#prd-scanner-cam-status');
        const inputEl = modal.querySelector('#prd-scanner-manual-input');

        const stopCamera = () => {
            if (detectInterval) { clearInterval(detectInterval); detectInterval = null; }
            if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
            if (video) video.srcObject = null;
        };

        const closeScanner = () => {
            stopCamera();
            modal.remove();
        };

        const applyCode = (code) => {
            const clean = String(code || '').trim();
            if (!clean) return;
            closeScanner();
            if (typeof onScanned === 'function') {
                onScanned(clean);
            }
        };

        modal.querySelector('#prd-scanner-close-btn').onclick = closeScanner;
        modal.querySelector('#prd-scanner-done-btn').onclick = closeScanner;
        modal.querySelector('#prd-scanner-insert-btn').onclick = () => applyCode(inputEl.value);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyCode(inputEl.value);
            }
        });

        const startCamera = async () => {
            try {
                if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
                    });
                    if (video) {
                        video.srcObject = stream;
                        await video.play();
                    }
                    if (statusEl) statusEl.textContent = 'Camera active • Align barcode inside the box';

                    if ('BarcodeDetector' in window) {
                        try {
                            const detector = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'] });
                            detectInterval = setInterval(async () => {
                                if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                                    try {
                                        const codes = await detector.detect(video);
                                        if (codes && codes.length > 0 && codes[0].rawValue) {
                                            applyCode(codes[0].rawValue);
                                        }
                                    } catch (err) {}
                                }
                            }, 450);
                        } catch (e) {
                            console.warn("BarcodeDetector unavailable", e);
                        }
                    }
                } else {
                    if (statusEl) statusEl.textContent = 'Camera not supported • Use handheld scanner above';
                }
            } catch (err) {
                if (statusEl) statusEl.textContent = 'Camera unavailable • Use handheld scanner above';
            }
        };

        modal.querySelector('#prd-scanner-toggle-cam').onclick = () => {
            if (stream) {
                stopCamera();
                if (statusEl) statusEl.textContent = 'Camera stopped • Use handheld scanner';
            } else {
                startCamera();
            }
        };

        startCamera();
        setTimeout(() => inputEl.focus(), 80);
    }

    // Helper: Open Template Selection Dialog
    async function openTemplateSelectionDialog(codeService, onSelected) {
        let templates = [];
        try {
            templates = await codeService.getAllTemplates(false);
        } catch (err) {
            console.warn("Failed fetching templates, using defaults:", err);
        }
        if (!templates || templates.length === 0) {
            templates = [
                { id: 'tmpl-standard-product-code', name: 'Standard Product Code', isDefault: true, isSystemLocked: true, description: 'Permanent default standard 13-digit random numeric barcode', blocks: [{ type: 'random_numbers', length: 13 }] },
                { id: 'tmpl-date-coder', name: 'Date Coder', description: 'Real-time creation date timestamp coder (DDMMYYYY)', blocks: [{ type: 'date', format: 'DDMMYYYY' }] },
                { id: 'tmpl-timestamp', name: 'Timestamp Coder', description: 'High-precision epoch millisecond timestamp barcode', blocks: [{ type: 'timestamp', format: 'milliseconds' }] },
                { id: 'tmpl-supermarket', name: 'Supermarket Standard', description: 'Standard grocery store sequence: GROC-RET-000001', blocks: [{ type: 'fixed_text', value: 'GROC' }, { type: 'fixed_text', value: 'RET' }, { type: 'sequential', length: 6, startNumber: 1 }] },
                { id: 'tmpl-pricelister-origin', name: 'Pricelister Origin', description: 'Core product sequence: PL-PRODUCT-00001', blocks: [{ type: 'fixed_text', value: 'PL' }, { type: 'fixed_text', value: 'PRODUCT' }, { type: 'sequential', length: 5, startNumber: 1 }] }
            ];
        }

        const modalId = 'modal-code-gen-picker';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(8px);
            z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div class="card" style="background: #FFFFFF; border-radius: 18px; width: 100%; max-width: 860px; border: 1px solid #E4E4E7; box-shadow: 0 25px 60px -15px rgba(0,0,0,0.25); overflow: hidden; animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center; background:#FAFAFA;">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <div style="width:34px; height:34px; border-radius:10px; background:#F4F4F5; color:#18181B; display:flex; align-items:center; justify-content:center; border:1px solid #E4E4E7;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Select Code Generator Template</h3>
                            <p style="margin: 2px 0 0; font-size: 0.78rem; color: #71717A;">Choose a workspace generator model to produce barcodes</p>
                        </div>
                    </div>
                    <button id="btn-close-picker-modal" style="background:#F4F4F5; border:1px solid #E4E4E7; border-radius:8px; width:30px; height:30px; color:#71717A; font-size:1.25rem; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1;">&times;</button>
                </div>
                <div style="padding: 0.75rem 1.5rem; border-bottom: 1px solid #E4E4E7; background: #FFFFFF;">
                    <div style="position: relative;">
                        <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #71717A; display: flex; align-items: center;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </span>
                        <input type="text" id="tmpl-search-input" class="form-control" placeholder="Search coder models by name, prefix, format (e.g. Supermarket, Date, 13-digit)..." style="width: 100%; padding: 0.55rem 0.75rem 0.55rem 2.25rem; font-size: 0.86rem; border: 1.5px solid #E4E4E7; border-radius: 8px;">
                    </div>
                </div>
                <div id="tmpl-items-grid" style="padding: 1.25rem 1.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 0.85rem; max-height: 65vh; overflow-y: auto;">
                    <!-- Template cards rendered dynamically -->
                </div>
            </div>
        `;

        const gridContainer = modal.querySelector('#tmpl-items-grid');
        const searchInput = modal.querySelector('#tmpl-search-input');

        const renderTemplateCards = (filterText = '') => {
            const query = filterText.trim().toLowerCase();
            const filtered = templates.filter(t => {
                if (!query) return true;
                const n = (t.name || '').toLowerCase();
                const d = (t.description || '').toLowerCase();
                const id = (t.id || '').toLowerCase();
                return n.includes(query) || d.includes(query) || id.includes(query);
            });

            if (filtered.length === 0) {
                gridContainer.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem 1rem; color: #71717A;">
                        <p style="margin: 0; font-size: 0.9rem; font-weight: 600;">No code generators found matching "${escapeHtml(filterText)}"</p>
                        <p style="margin: 4px 0 0; font-size: 0.78rem;">Try searching for "Date", "Supermarket", "Random", or "Timestamp"</p>
                    </div>
                `;
                return;
            }

            gridContainer.innerHTML = filtered.map(t => {
                let sample = '';
                try {
                    sample = codeService.assembleCode(t.blocks, t);
                } catch (e) {
                    sample = t.name || 'CODE';
                }
                return `
                    <div class="tmpl-picker-item" data-id="${t.id}" style="padding: 1rem 1.15rem; border: 1.5px solid #E4E4E7; border-radius: 12px; cursor: pointer; transition: all 0.15s ease; background: #FFFFFF; display:flex; flex-direction:column; justify-content:space-between; gap:0.5rem;" onmouseover="this.style.borderColor='#18181B'; this.style.background='#FAFAFA';" onmouseout="this.style.borderColor='#E4E4E7'; this.style.background='#FFFFFF';">
                        <div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                                <strong style="color: #18181B; font-size: 0.95rem;">${escapeHtml(t.name)}</strong>
                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                    ${t.isSystemLocked || t.id === 'tmpl-standard-product-code' ? `<span class="badge" style="background:#F4F4F5; color:#18181B; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px; border:1px solid #E4E4E7;">Permanent Standard</span>` : ''}
                                    ${t.isDefault ? `<span class="badge" style="background:#18181B; color:#FFF; font-size:0.65rem; padding:0.15rem 0.45rem; border-radius:4px;">Default</span>` : ''}
                                </div>
                            </div>
                            <div style="font-size: 0.8rem; color: #71717A; line-height: 1.35;">${escapeHtml(t.description || '')}</div>
                        </div>
                        <div style="font-family: monospace; font-size: 0.82rem; font-weight: 700; color: #18181B; background: #FAFAFA; padding: 0.45rem 0.65rem; border-radius: 6px; border: 1px solid #E4E4E7; display:flex; align-items:center; justify-content:space-between;">
                            <span>Sample: <strong>${escapeHtml(sample)}</strong></span>
                            <span style="font-size:0.72rem; color:#71717A; white-space:nowrap;">Select &rarr;</span>
                        </div>
                    </div>
                `;
            }).join('');

            gridContainer.querySelectorAll('.tmpl-picker-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const targetId = item.dataset.id;
                    let tmpl = null;
                    try {
                        tmpl = await codeService.getTemplateById(targetId);
                    } catch (e) {}
                    if (!tmpl) {
                        tmpl = templates.find(t => t.id === targetId);
                    }
                    close();
                    if (tmpl && typeof onSelected === 'function') {
                        onSelected(tmpl);
                    }
                });
            });
        };

        renderTemplateCards('');
        searchInput?.addEventListener('input', (e) => {
            renderTemplateCards(e.target.value);
        });
        setTimeout(() => searchInput?.focus(), 80);
    }

    function checkVariationsEmpty() {
        const varListEl = container.querySelector('#prd-variations-list');
        const varEmptyMsg = container.querySelector('#prd-no-variations-msg');
        if (!varListEl || !varEmptyMsg) return;
        varEmptyMsg.style.display = varListEl.children.length === 0 ? 'block' : 'none';
    }

    function clearVariations() {
        const varListEl = container.querySelector('#prd-variations-list');
        if (varListEl) varListEl.innerHTML = '';
        checkVariationsEmpty();
    }

    // Advanced 2-Row Variation Block with Realtime Barcoding, Scanning & Template Controls
    function addVariationRow(sizeFlavor = '', upcCode = '', autoGenerateBarcode = false) {
        const varListEl = container.querySelector('#prd-variations-list');
        if (!varListEl) return;
        const row = document.createElement('div');
        row.className = 'prd-variation-item-row';
        row.style.cssText = 'display:flex; flex-direction:column; gap:0.6rem; background:#FFFFFF; padding:0.85rem 1rem; border-radius:12px; border:1.5px solid var(--border-color); box-shadow:0 1px 3px rgba(0,0,0,0.02); transition:all 0.15s ease;';
        
        row.innerHTML = `
            <!-- Row 1: Variation Name -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem;">
                <div style="flex:1; display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Variation Name:</span>
                    <input type="text" class="form-control var-size-input" placeholder="e.g. 500g, Strawberry, Large, Blue..." value="${escapeHtml(sizeFlavor || '')}" style="flex:1; padding:0.45rem 0.65rem; font-size:0.86rem; font-weight:600;">
                </div>
                <button type="button" class="btn-remove-var" style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:6px; color:#EF4444; cursor:pointer; padding:0.25rem 0.55rem; font-size:0.85rem; display:inline-flex; align-items:center; gap:3px;" title="Delete variation">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    <span>Remove</span>
                </button>
            </div>

            <!-- Row 2: Barcode & Options (Scan - Gen - Template) -->
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:nowrap;">
                <div style="flex:1; position:relative;">
                    <input type="text" class="form-control var-upc-input" placeholder="UPC / Barcode" value="${escapeHtml(upcCode || '')}" style="width:100%; padding:0.45rem 0.65rem; font-size:0.85rem; font-family:monospace; font-weight:700;">
                </div>
                <!-- Scan Button -->
                <button type="button" class="btn btn-secondary var-btn-scan" style="padding:0.45rem 0.65rem; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:3px; white-space:nowrap;" title="Scan Barcode for this Variant">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>
                    Scan
                </button>
                <!-- Gen Button -->
                <button type="button" class="btn btn-secondary var-btn-gen" style="padding:0.45rem 0.65rem; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:3px; white-space:nowrap;" title="Generate Barcode for this Variant">
                    <svg class="var-gen-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 5v14"></path><path d="M8 5v14"></path><path d="M12 5v14"></path><path d="M17 5v14"></path><path d="M21 5v14"></path></svg>
                    <span class="var-gen-text">Gen</span>
                </button>
                <!-- Template Button -->
                <button type="button" class="btn btn-secondary var-btn-tmpl" style="padding:0.45rem 0.65rem; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:3px; white-space:nowrap;" title="Pick Template for this Variant">
                    Template &darr;
                </button>
            </div>
        `;

        const sizeInput = row.querySelector('.var-size-input');
        const upcInput = row.querySelector('.var-upc-input');
        const btnScan = row.querySelector('.var-btn-scan');
        const btnGen = row.querySelector('.var-btn-gen');
        const btnTmpl = row.querySelector('.var-btn-tmpl');

        sizeInput.addEventListener('input', checkProductDirty);
        upcInput.addEventListener('input', checkProductDirty);

        row.querySelector('.btn-remove-var').addEventListener('click', () => {
            row.remove();
            checkVariationsEmpty();
            checkProductDirty();
        });

        // Scan button for variant
        btnScan.addEventListener('click', () => {
            openBarcodeScannerDialog((scannedCode) => {
                upcInput.value = scannedCode;
                checkProductDirty();
                showAlert.success(`Applied scanned barcode to variant: ${scannedCode}`);
            });
        });

        // Generator helper for variant
        const generateVariantBarcode = async (templateToUse = null) => {
            const codeService = getCodeStudioService(workspaceId);
            btnGen.disabled = true;
            const originalHtml = btnGen.innerHTML;
            btnGen.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon" style="animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                <span>Generating...</span>
            `;

            try {
                const tmpl = templateToUse || selectedVariationTemplate || await codeService.getDefaultTemplate();
                const nextSeq = await codeService.atomicGetNextSequence(tmpl.id || 'default_supermarket');
                const pName = container.querySelector('#prd-name')?.value.trim() || '';
                const pCat = container.querySelector('#prd-category')?.value.trim() || '';
                const vName = sizeInput.value.trim();

                let candidate = codeService.assembleCode(tmpl.blocks, tmpl, {
                    sequence: nextSeq,
                    product: { name: pName, category: pCat },
                    variation: { sizeFlavor: vName }
                });

                const check = await codeService.checkCodeUniqueness(candidate);
                if (!check.isUnique) {
                    const fallbackSeq = await codeService.atomicGetNextSequence(tmpl.id || 'default_supermarket');
                    candidate = codeService.assembleCode(tmpl.blocks, tmpl, {
                        sequence: fallbackSeq,
                        product: { name: pName, category: pCat },
                        variation: { sizeFlavor: vName }
                    });
                }

                await codeService.reserveCode(candidate, 'product_draft', 60, { template: tmpl.name, variant: vName });
                upcInput.value = candidate;
                checkProductDirty();
                showAlert.success(`Generated variant code "${candidate}" using "${tmpl.name}".`);
            } catch (err) {
                console.error("Variant code generation error:", err);
                showAlert.error(`Variant code generation failed: ${err.message}`);
            } finally {
                btnGen.disabled = false;
                btnGen.innerHTML = originalHtml;
            }
        };

        btnGen.addEventListener('click', () => generateVariantBarcode());

        // Template button for variant
        btnTmpl.addEventListener('click', () => {
            const codeService = getCodeStudioService(workspaceId);
            openTemplateSelectionDialog(codeService, (chosenTmpl) => {
                generateVariantBarcode(chosenTmpl);
            });
        });

        varListEl.appendChild(row);
        checkVariationsEmpty();
        checkProductDirty();

        // If batch generator is running / enabled and no UPC was supplied, auto-generate barcode immediately
        if ((autoGenerateBarcode || isVarBatchAutoBarcodeActive) && !upcCode) {
            generateVariantBarcode();
        }
    }

    function setupMainViewEvents() {
        const userRestrictions = getUserRestrictions();
        const codeService = getCodeStudioService(workspaceId);
        const formContainer = container.querySelector('#product-form-container');
        const form = container.querySelector('#product-form');
        const catSelect = container.querySelector('#prd-category');

        // Populate Category Dropdowns with colored chip indicators
        const updateCategoryChip = () => {
            const val = catSelect?.value;
            const previewChip = container.querySelector('#prd-cat-chip-preview');
            const chipDot = container.querySelector('#prd-cat-chip-dot');
            const chipName = container.querySelector('#prd-cat-chip-name');
            if (!previewChip || !chipDot || !chipName) return;
            const foundCat = categoriesList.find(c => c.uniqueId === val || c.id === val || c.name === val);
            if (foundCat) {
                const color = foundCat.color || '#10B981';
                previewChip.style.display = 'inline-flex';
                chipDot.style.background = color;
                chipName.textContent = foundCat.name;
                previewChip.style.borderColor = color + '40';
                previewChip.style.background = color + '14';
            } else {
                previewChip.style.display = 'none';
            }
        };

        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select Category</option>' +
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">● ${escapeHtml(c.name)}</option>`).join('');
            catSelect.addEventListener('change', updateCategoryChip);
            updateCategoryChip();
        }
        const filterCat = container.querySelector('#filter-category');
        if (filterCat) {
            filterCat.innerHTML = '<option value="all">All Categories</option>' +
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">● ${escapeHtml(c.name)}</option>`).join('');
        }

        container.querySelector('#filter-search')?.addEventListener('input', () => {
            currentPage = 1;
            renderProductList();
        });
        container.querySelector('#filter-sort')?.addEventListener('change', () => {
            currentPage = 1;
            renderProductList();
        });
        container.querySelector('#filter-category')?.addEventListener('change', () => {
            currentPage = 1;
            renderProductList();
        });

        // 1. Layout & Theme Drawer Controls (per User Request)
        const openLayoutDrawer = () => {
            const drawer = container.querySelector('#prd-layout-drawer');
            const overlay = container.querySelector('#prd-layout-drawer-overlay');
            if (drawer && overlay) {
                drawer.style.display = 'flex';
                overlay.style.display = 'block';
                setTimeout(() => {
                    drawer.classList.add('open');
                    overlay.classList.add('open');
                }, 10);
            }
        };

        const closeLayoutDrawer = () => {
            const drawer = container.querySelector('#prd-layout-drawer');
            const overlay = container.querySelector('#prd-layout-drawer-overlay');
            if (drawer && overlay) {
                drawer.classList.remove('open');
                overlay.classList.remove('open');
                setTimeout(() => {
                    drawer.style.display = 'none';
                    overlay.style.display = 'none';
                }, 280);
            }
        };

        container.querySelector('#btn-open-layout-drawer')?.addEventListener('click', openLayoutDrawer);
        container.querySelector('#prd-layout-drawer-close')?.addEventListener('click', closeLayoutDrawer);
        container.querySelector('#prd-layout-drawer-overlay')?.addEventListener('click', closeLayoutDrawer);

        // 2. Theme Selection inside Drawer
        const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('pricelister_theme') || 'monochrome';
        container.querySelectorAll('.prd-theme-btn').forEach(btn => {
            const th = btn.getAttribute('data-theme');
            if (th === currentTheme) {
                btn.style.borderColor = '#0f172a';
                btn.style.background = '#f8fafc';
                btn.style.fontWeight = '700';
            }
            btn.addEventListener('click', () => {
                document.documentElement.setAttribute('data-theme', th);
                localStorage.setItem('pricelister_theme', th);
                container.querySelectorAll('.prd-theme-btn').forEach(b => {
                    const isActive = (b.getAttribute('data-theme') === th);
                    b.style.borderColor = isActive ? '#0f172a' : '#cbd5e1';
                    b.style.background = isActive ? '#f8fafc' : '#ffffff';
                    b.style.fontWeight = isActive ? '700' : '500';
                });
                showAlert.success(`Theme switched to ${th.toUpperCase()}`);
            });
        });

        // 3. Layout Selector (Inside Drawer: 7 Layout Modes)
        container.querySelectorAll('.prd-layout-pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layout = e.currentTarget.getAttribute('data-layout');
                if (layout) {
                    currentLayout = layout;
                    localStorage.setItem('pricelister_product_layout', layout);
                    container.querySelectorAll('.prd-layout-pill-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');

                    const labelEl = container.querySelector('#current-layout-label');
                    if (labelEl) labelEl.textContent = layoutDisplayNames[layout] || layout;

                    const tblContainer = container.querySelector('#prd-table-card-container');
                    const gridContainer = container.querySelector('#prd-grid-card-container');
                    if (tblContainer) tblContainer.style.display = currentLayout === 'list' ? 'block' : 'none';
                    if (gridContainer) gridContainer.style.display = currentLayout !== 'list' ? 'block' : 'none';

                    currentPage = 1;
                    closeLayoutDrawer();
                    renderProductList();
                }
            });
        });

        // 4. Select All Checkbox
        container.querySelector('#prd-select-all')?.addEventListener('change', (e) => {
            const isChecked = e.currentTarget.checked;
            container.querySelectorAll('.prd-select-chk').forEach(chk => {
                chk.checked = isChecked;
                const id = chk.getAttribute('data-id');
                if (id) {
                    if (isChecked) selectedProductIds.add(id);
                    else selectedProductIds.delete(id);
                }
            });
            updateBatchBar();
        });

        // 5. Multi-Product Batch Actions
        // Batch Action A: Change Category
        const getBatchCategoryModal = () => {
            return document.getElementById('batch-category-modal') || container.querySelector('#batch-category-modal');
        };

        container.querySelector('#btn-batch-category')?.addEventListener('click', () => {
            if (selectedProductIds.size === 0) return;
            const modal = getBatchCategoryModal();
            if (!modal) return;
            if (modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
            const catDropdown = modal.querySelector('#batch-cat-dropdown');
            const catCount = modal.querySelector('#batch-cat-count');
            if (catDropdown) {
                catDropdown.innerHTML = categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
            }
            if (catCount) catCount.textContent = selectedProductIds.size;
            modal.style.display = 'flex';
        });

        // Event delegation for batch category modal buttons whether inside container or mounted on document.body
        if (!window.__batchCatClickBound) {
            window.__batchCatClickBound = true;
            document.addEventListener('click', async (e) => {
                const closeBtn = e.target.closest('#batch-cat-close');
                const cancelBtn = e.target.closest('#batch-cat-cancel');
                const confirmBtn = e.target.closest('#batch-cat-confirm');

                if (closeBtn || cancelBtn) {
                    const modal = getBatchCategoryModal();
                    if (modal) modal.style.display = 'none';
                    return;
                }

                if (confirmBtn) {
                    const modal = getBatchCategoryModal();
                    if (!modal) return;
                    const targetCat = modal.querySelector('#batch-cat-dropdown')?.value;
                    if (!targetCat) {
                        showAlert.error('Please select a target category.');
                        return;
                    }
                    const count = selectedProductIds.size;
                    if (count === 0) {
                        modal.style.display = 'none';
                        return;
                    }
                    try {
                        const targetCatObj = categoriesList.find(c => c.uniqueId === targetCat || c.id === targetCat || c.name === targetCat);
                        const targetCatName = targetCatObj ? targetCatObj.name : targetCat;
                        for (const id of selectedProductIds) {
                            await productService.updateProduct(id, { category: targetCat }, userRestrictions, currentUser.uid);
                        }
                        showAlert.success(`Successfully updated category to "${targetCatName}" for ${count} product(s)!`);
                        selectedProductIds.clear();
                        modal.style.display = 'none';
                        activeProducts = await productService.getAllActiveProducts();
                        renderProductList();
                        updateBatchBar();
                    } catch (err) {
                        showAlert.error(err.message || 'Failed to update category for selected products');
                    }
                }
            });
        }

        // Batch Action B: Transfer to Market Updator for mass detail editing
        container.querySelector('#btn-batch-transfer-market')?.addEventListener('click', () => {
            if (selectedProductIds.size === 0) {
                showAlert.error('Please select at least 1 product to transfer.');
                return;
            }
            const selectedProds = activeProducts.filter(p => selectedProductIds.has(p.id));
            sessionStorage.setItem('plister_market_batch_transfer', JSON.stringify(selectedProds));
            showAlert.success(`Transferred ${selectedProds.length} products into Market Updator!`);
            window.location.hash = '#/market-inserter';
        });

        // Batch Action C: Delete Selected
        container.querySelector('#btn-batch-delete')?.addEventListener('click', async () => {
            const count = selectedProductIds.size;
            if (count === 0) return;
            const confirmed = await showAlert.confirm(`Are you sure you want to permanently delete all ${count} selected product(s)? This action cannot be undone.`);
            if (!confirmed) return;
            try {
                for (const id of selectedProductIds) {
                    await productService.deleteProduct(id, userRestrictions, currentUser.uid);
                }
                showAlert.success(`Successfully deleted ${count} product(s).`);
                selectedProductIds.clear();
                activeProducts = await productService.getAllActiveProducts();
                renderProductList();
                updateBatchBar();
            } catch (err) {
                showAlert.error(err.message || 'Failed to delete selected products');
            }
        });

        // Batch Action D: Clear Selection
        container.querySelector('#btn-batch-clear')?.addEventListener('click', () => {
            selectedProductIds.clear();
            container.querySelectorAll('.prd-select-chk').forEach(c => c.checked = false);
            const selectAll = container.querySelector('#prd-select-all');
            if (selectAll) selectAll.checked = false;
            updateBatchBar();
        });

        // Batch Action E: Select All / Deselect All Button
        container.querySelector('#btn-batch-select-all')?.addEventListener('click', () => {
            const allActiveIds = activeProducts.map(p => p.id);
            const allSelected = allActiveIds.length > 0 && allActiveIds.every(id => selectedProductIds.has(id));
            if (allSelected) {
                selectedProductIds.clear();
            } else {
                allActiveIds.forEach(id => selectedProductIds.add(id));
            }
            container.querySelectorAll('.prd-select-chk').forEach(c => {
                c.checked = selectedProductIds.has(c.getAttribute('data-id'));
            });
            updateBatchBar();
        });

        // Batch Action F: Invert Selection
        container.querySelector('#btn-batch-invert')?.addEventListener('click', () => {
            const allActiveIds = activeProducts.map(p => p.id);
            allActiveIds.forEach(id => {
                if (selectedProductIds.has(id)) {
                    selectedProductIds.delete(id);
                } else {
                    selectedProductIds.add(id);
                }
            });
            container.querySelectorAll('.prd-select-chk').forEach(c => {
                c.checked = selectedProductIds.has(c.getAttribute('data-id'));
            });
            updateBatchBar();
        });

        // Keyboard Shortcut: Ctrl+A / Cmd+A when multi-selection is active
        const handleProductsCtrlA = (e) => {
            if (!container || !container.isConnected) return;
            if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
                if (selectedProductIds.size > 0) {
                    e.preventDefault();
                    activeProducts.forEach(p => selectedProductIds.add(p.id));
                    container.querySelectorAll('.prd-select-chk').forEach(c => c.checked = true);
                    updateBatchBar();
                }
            }
        };
        window.removeEventListener('keydown', container.__prdKeyHandler);
        container.__prdKeyHandler = handleProductsCtrlA;
        window.addEventListener('keydown', handleProductsCtrlA);

        // Prev / Next Pagination Buttons
        container.querySelector('#prd-page-prev')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderProductList();
            }
        });
        container.querySelector('#prd-page-next')?.addEventListener('click', () => {
            currentPage++;
            renderProductList();
        });

        const btnAddVar = container.querySelector('#btn-add-variation-row');
        if (btnAddVar) {
            btnAddVar.addEventListener('click', () => addVariationRow('', '', isVarBatchAutoBarcodeActive));
        }

        // Realtime Variation Batch Auto-Barcode Toggle
        const btnToggleVarBatch = container.querySelector('#btn-toggle-var-batch');
        const varBatchLabel = container.querySelector('#var-batch-label');
        if (btnToggleVarBatch && varBatchLabel) {
            btnToggleVarBatch.addEventListener('click', () => {
                isVarBatchAutoBarcodeActive = !isVarBatchAutoBarcodeActive;
                if (isVarBatchAutoBarcodeActive) {
                    btnToggleVarBatch.style.background = '#18181B';
                    btnToggleVarBatch.style.color = '#FFFFFF';
                    varBatchLabel.textContent = 'Batch Auto-Barcode: ON';
                    showAlert.info("Batch generator active. Newly added variations will automatically get barcodes generated.");
                } else {
                    btnToggleVarBatch.style.background = '#FAFAFA';
                    btnToggleVarBatch.style.color = '#18181B';
                    varBatchLabel.textContent = 'Batch Auto-Barcode: OFF';
                }
            });
        }

        // Variation Template Selection Dialog
        const btnVarTmplDialog = container.querySelector('#btn-var-template-dialog');
        const varCurrentTmplLabel = container.querySelector('#var-current-tmpl-label');
        if (btnVarTmplDialog) {
            btnVarTmplDialog.addEventListener('click', () => {
                openTemplateSelectionDialog(codeService, (chosenTmpl) => {
                    selectedVariationTemplate = chosenTmpl;
                    if (varCurrentTmplLabel) {
                        varCurrentTmplLabel.textContent = chosenTmpl.name;
                    }
                    showAlert.success(`Selected template "${chosenTmpl.name}" for variations.`);
                });
            });
        }

        // Main Product Scan Barcode Button
        const btnScanMainUpc = container.querySelector('#btn-scan-main-upc');
        if (btnScanMainUpc) {
            btnScanMainUpc.addEventListener('click', () => {
                openBarcodeScannerDialog((scannedCode) => {
                    const upcInput = container.querySelector('#prd-upc');
                    if (upcInput) {
                        upcInput.value = scannedCode;
                        const pill = container.querySelector('#prd-code-status-pill');
                        if (pill) {
                            pill.textContent = 'Scanned Code';
                            pill.style.background = '#18181B';
                            pill.style.color = '#FFFFFF';
                        }
                        checkProductDirty();
                        showAlert.success(`Scanned barcode: ${scannedCode}`);
                    }
                });
            });
        }

        form?.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => {
                checkProductDirty();
                if (el.classList.contains('prd-calc-trigger')) {
                    updateLiveProfitSummary();
                }
            });
            el.addEventListener('change', () => {
                checkProductDirty();
                if (el.classList.contains('prd-calc-trigger')) {
                    updateLiveProfitSummary();
                }
            });
        });

        // Mount Smart Unsaved Changes Indicator on form header
        const titleBadgeRow = container.querySelector('#prd-form-title')?.parentElement;
        if (titleBadgeRow) {
            prdUnsavedIndicator = draftManager.mountUnsavedIndicator(titleBadgeRow, {
                formType: 'Product Form',
                onSave: () => {
                    const submitBtn = container.querySelector('#prd-submit-btn');
                    if (submitBtn && !submitBtn.disabled) {
                        form.requestSubmit();
                    } else {
                        showAlert.info("Please complete all required fields (*) before saving.");
                    }
                }
            });
        }

        // Add Product Click
        container.querySelector('#btn-add-product')?.addEventListener('click', async () => {
            form.reset();
            clearVariations();
            container.querySelector('#prd-id').value = '';
            updateImagePreview('');
            selectedMainTemplate = null;
            selectedVariationTemplate = null;
            isVarBatchAutoBarcodeActive = false;

            const btnToggleVarBatch = container.querySelector('#btn-toggle-var-batch');
            const varBatchLabel = container.querySelector('#var-batch-label');
            if (btnToggleVarBatch && varBatchLabel) {
                btnToggleVarBatch.style.background = '#FAFAFA';
                btnToggleVarBatch.style.color = '#18181B';
                varBatchLabel.textContent = 'Batch Auto-Barcode: OFF';
            }

            const tmplLabel = container.querySelector('#prd-current-tmpl-label');
            if (tmplLabel) {
                try {
                    const def = await codeService.getDefaultTemplate();
                    tmplLabel.textContent = def?.name || 'Standard Product Code';
                } catch (e) {
                    tmplLabel.textContent = 'Standard Product Code';
                }
            }

            const badgeEl = container.querySelector('#prd-form-badge');
            if (badgeEl) badgeEl.textContent = 'New Catalog Entry';
            container.querySelector('#prd-form-title').textContent = 'Add New Product';

            const submitBtn = container.querySelector('#prd-submit-btn');
            if (submitBtn) {
                submitBtn.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    <span>Save Product</span>
                `;
            }

            updateLiveProfitSummary();
            initialProductSnapshot = null;

            const restored = restoreProductDraftIfAny('new');
            if (restored) {
                showAlert.info("Restored your progressive unsaved product draft.");
            }

            checkProductDirty();
            showProductEditorView();
        });

        // Product Code Generation Engine & Assistant
        // (codeService is initialized at the top of setupMainViewEvents)

        // Mode A: Auto-Generate using Workspace Default/Selected Template with Loading State
        const btnGenUpc = container.querySelector('#btn-generate-upc');
        btnGenUpc?.addEventListener('click', async () => {
            if (btnGenUpc.disabled) return;
            const originalHtml = btnGenUpc.innerHTML;
            btnGenUpc.disabled = true;
            btnGenUpc.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin-icon" style="animation: spin 0.8s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                <span>Generating...</span>
            `;

            try {
                const targetTmpl = selectedMainTemplate || await codeService.getDefaultTemplate();
                const nextSeq = await codeService.atomicGetNextSequence(targetTmpl.id || 'default_supermarket');
                const pName = container.querySelector('#prd-name')?.value.trim() || '';
                const pCat = container.querySelector('#prd-category')?.value.trim() || '';

                let candidate = codeService.assembleCode(targetTmpl.blocks, targetTmpl, {
                    sequence: nextSeq,
                    product: { name: pName, category: pCat }
                });

                // Collision detection verification
                const check = await codeService.checkCodeUniqueness(candidate);
                if (!check.isUnique) {
                    const fallbackSeq = await codeService.atomicGetNextSequence(targetTmpl.id || 'default_supermarket');
                    candidate = codeService.assembleCode(targetTmpl.blocks, targetTmpl, {
                        sequence: fallbackSeq,
                        product: { name: pName, category: pCat }
                    });
                }

                // Reserve the code safely
                await codeService.reserveCode(candidate, 'product_draft', 60, { template: targetTmpl.name });

                const upcInput = container.querySelector('#prd-upc');
                if (upcInput) {
                    upcInput.value = candidate;
                    const pill = container.querySelector('#prd-code-status-pill');
                    if (pill) {
                        pill.textContent = 'Reserved & Unique';
                        pill.style.background = '#18181B';
                        pill.style.color = '#FFFFFF';
                    }
                    const tmplLabel = container.querySelector('#prd-current-tmpl-label');
                    if (tmplLabel) {
                        tmplLabel.textContent = targetTmpl.name;
                    }
                    checkProductDirty();
                    showAlert.success(`Generated code "${candidate}" using "${targetTmpl.name}".`);
                }
            } catch (err) {
                console.error("Auto code generation error:", err);
                showAlert.error(`Code generation failed: ${err.message}`);
            } finally {
                btnGenUpc.disabled = false;
                btnGenUpc.innerHTML = originalHtml;
            }
        });

        // Mode B: Choose Template Modal (Topmost Level Overlay)
        container.querySelector('#btn-code-assistant')?.addEventListener('click', async () => {
            openTemplateSelectionDialog(codeService, async (tmpl) => {
                selectedMainTemplate = tmpl;
                const tmplLabel = container.querySelector('#prd-current-tmpl-label');
                if (tmplLabel) {
                    tmplLabel.textContent = tmpl.name;
                }

                if (btnGenUpc) {
                    btnGenUpc.click();
                }
            });
        });

        // Mode C: Manual Entry Uniqueness Checking
        let uniquenessTimer = null;
        container.querySelector('#prd-upc')?.addEventListener('input', (e) => {
            clearTimeout(uniquenessTimer);
            const val = e.target.value.trim();
            const pill = container.querySelector('#prd-code-status-pill');
            if (!val) {
                if (pill) {
                    pill.textContent = 'Custom Code';
                    pill.style.background = '#F4F4F5';
                    pill.style.color = '#18181B';
                }
                return;
            }
            uniquenessTimer = setTimeout(async () => {
                const check = await codeService.checkCodeUniqueness(val, container.querySelector('#prd-id')?.value);
                if (pill) {
                    if (check.isUnique) {
                        pill.textContent = 'Unique Code';
                        pill.style.background = '#F4F4F5';
                        pill.style.color = '#18181B';
                        pill.style.border = '1px solid #E4E4E7';
                    } else {
                        pill.textContent = 'Already in Use';
                        pill.style.background = '#F4F4F5';
                        pill.style.color = '#71717A';
                        pill.style.border = '1px solid #18181B';
                    }
                }
            }, 300);
        });

        // Quantity Stepper Buttons
        container.querySelectorAll('.prd-stepper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const step = parseInt(e.currentTarget.getAttribute('data-step') || '0', 10);
                const qtyInput = container.querySelector('#prd-qty');
                if (qtyInput) {
                    const cur = parseInt(qtyInput.value || '0', 10) || 0;
                    qtyInput.value = Math.max(0, cur + step);
                    updateLiveProfitSummary();
                    checkProductDirty();
                }
            });
        });

        // Quick Markup Preset Chips
        container.querySelectorAll('.prd-quick-chip[data-markup]').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const markup = parseFloat(e.currentTarget.getAttribute('data-markup') || '0');
                const cost = parseFloat(container.querySelector('#prd-cost-price')?.value || 0) || 0;
                if (cost > 0) {
                    const newSale = Math.round((cost * (1 + markup / 100)) * 100) / 100;
                    const saleInput = container.querySelector('#prd-sale-price');
                    if (saleInput) {
                        saleInput.value = newSale.toFixed(2);
                        updateLiveProfitSummary();
                        checkProductDirty();
                    }
                } else {
                    showAlert.info("Please enter a Cost Price first to apply markup presets.");
                }
            });
        });
        // Image Upload Handler + Dropzone Integration
        const prdFileInput = container.querySelector('#prd-image-file');
        const prdDropzone = container.querySelector('#prd-media-dropzone');
        const uploadLabel = container.querySelector('#prd-upload-label-text');

        const handleProductImageFile = async (file) => {
            if (!file || !file.type.startsWith('image/')) {
                showAlert.error('Please select or drop a valid image file (PNG, JPG, WEBP).');
                return;
            }
            try {
                if (uploadLabel) uploadLabel.textContent = 'Uploading...';
                if (prdDropzone) {
                    prdDropzone.style.opacity = '0.7';
                }

                const url = await storageService.uploadImage(file, workspaceId);

                const prdImgInput = container.querySelector('#prd-image');
                if (prdImgInput) prdImgInput.value = url;
                updateImagePreview(url);
                checkProductDirty();
                showAlert.success('Image uploaded successfully');
            } catch (error) {
                showAlert.error('Image upload failed: ' + (error.message || 'Error'));
            } finally {
                if (uploadLabel) uploadLabel.textContent = 'Upload Image';
                if (prdDropzone) prdDropzone.style.opacity = '1';
            }
        };

        if (prdFileInput) {
            prdFileInput.addEventListener('change', async (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    await handleProductImageFile(file);
                }
            });
        }

        if (prdDropzone && prdFileInput) {
            prdDropzone.style.cursor = 'pointer';
            prdDropzone.setAttribute('title', 'Click or Drag & Drop product image here');

            prdDropzone.addEventListener('click', (e) => {
                if (!e.target.closest('#btn-clear-img')) {
                    prdFileInput.click();
                }
            });

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evtName => {
                prdDropzone.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            ['dragenter', 'dragover'].forEach(evtName => {
                prdDropzone.addEventListener(evtName, () => {
                    prdDropzone.style.borderColor = '#18181B';
                    prdDropzone.style.background = 'rgba(225, 29, 72, 0.05)';
                    prdDropzone.style.transform = 'scale(1.01)';
                });
            });

            ['dragleave', 'drop'].forEach(evtName => {
                prdDropzone.addEventListener(evtName, () => {
                    prdDropzone.style.borderColor = 'var(--border-color)';
                    prdDropzone.style.background = 'var(--surface-50)';
                    prdDropzone.style.transform = 'scale(1)';
                });
            });

            prdDropzone.addEventListener('drop', async (e) => {
                const dt = e.dataTransfer;
                if (dt && dt.files && dt.files.length > 0) {
                    await handleProductImageFile(dt.files[0]);
                }
            });
        }

        // Direct Image URL Input Handler
        container.querySelector('#prd-image')?.addEventListener('input', (e) => {
            updateImagePreview(e.target.value);
            checkProductDirty();
        });

        // Clear Image Handler
        container.querySelector('#btn-clear-img')?.addEventListener('click', () => {
            const imgInput = container.querySelector('#prd-image');
            if (imgInput) imgInput.value = '';
            updateImagePreview('');
            checkProductDirty();
        });

        // Quick Category Modal
        const catModal = container.querySelector('#quick-category-modal');
        const catNameInput = container.querySelector('#quick-cat-name');
        const catColorInput = container.querySelector('#quick-cat-color');
        const btnQuickCat = container.querySelector('#btn-quick-cat');
        const btnSaveCat = container.querySelector('#quick-cat-save-btn');
        const btnCancelCat = container.querySelector('#quick-cat-cancel-btn');
        const btnCloseCat = container.querySelector('#quick-cat-close-btn');

        if (btnQuickCat) {
            btnQuickCat.addEventListener('click', () => {
                catNameInput.value = '';
                catColorInput.value = '#18181B';
                btnSaveCat.disabled = true;
                catModal.style.display = 'flex';
                catNameInput.focus();
            });
        }

        container.querySelectorAll('.quick-color-preset').forEach(preset => {
            preset.addEventListener('click', (e) => {
                const color = e.currentTarget.getAttribute('data-color');
                if (color && catColorInput) {
                    catColorInput.value = color;
                }
            });
        });

        catNameInput?.addEventListener('input', (e) => {
            btnSaveCat.disabled = !e.target.value.trim();
        });

        btnCancelCat?.addEventListener('click', () => {
            catModal.style.display = 'none';
        });

        btnCloseCat?.addEventListener('click', () => {
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
                checkProductDirty();
            } catch (err) {
                showAlert.error(err.message);
            } finally {
                btnSaveCat.disabled = false;
                btnSaveCat.textContent = 'Save Category';
            }
        });

        // Cancel Form (both top and bottom triggers)
        const handleCancelForm = async () => {
            if (isProductFormDirty()) {
                const leave = await showAlert.confirmUnsavedChanges();
                if (!leave) return;
            }
            const curId = container.querySelector('#prd-id')?.value || 'new';
            draftManager.clearDraft(`product_${curId}`);
            draftManager.unregisterActiveForm('product_form');
            if (prdUnsavedIndicator) prdUnsavedIndicator.update(false);

            hideProductEditorView();
            form.reset();
            initialProductSnapshot = null;
            checkProductDirty();
        };

        container.querySelectorAll('.prd-cancel-trigger').forEach(btn => {
            btn.addEventListener('click', handleCancelForm);
        });

        // Form Submit
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = container.querySelector('#prd-submit-btn');

            const name = container.querySelector('#prd-name')?.value?.trim();
            const category = container.querySelector('#prd-category')?.value;
            const salePriceRaw = container.querySelector('#prd-sale-price')?.value;
            const salePrice = parseFloat(salePriceRaw);

            if (!name) {
                showAlert.warning("Please enter a Product Name.");
                container.querySelector('#prd-name')?.focus();
                return;
            }
            if (!category) {
                showAlert.warning("Please select a Category.");
                container.querySelector('#prd-category')?.focus();
                return;
            }
            if (salePriceRaw === '' || isNaN(salePrice) || salePrice < 0) {
                showAlert.warning("Please enter a valid Sale Price.");
                container.querySelector('#prd-sale-price')?.focus();
                return;
            }

            if (btn) btn.disabled = true;

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
                name: name,
                sizeWeight: container.querySelector('#prd-size').value.trim(),
                category: category,
                upcCode: container.querySelector('#prd-upc').value.trim(),
                note: container.querySelector('#prd-note').value.trim(),

                quantity: parseInt(container.querySelector('#prd-qty').value || 0, 10),

                price: (() => {
                    if (userRestrictions.cannotSeeCost) {
                        if (id) {
                            const existingPrd = activeProducts.find(p => p.id === id);
                            return existingPrd && existingPrd.price !== undefined ? existingPrd.price : 0;
                        }
                        return 0;
                    }
                    return container.querySelector('#prd-cost-price').value ? parseFloat(container.querySelector('#prd-cost-price').value) : 0;
                })(),
                salePrice: salePrice,
                basePrice: container.querySelector('#prd-base-price').value ? parseFloat(container.querySelector('#prd-base-price').value) : 0,
                mrp: container.querySelector('#prd-mrp').value ? parseFloat(container.querySelector('#prd-mrp').value) : 0,

                mfgDate: container.querySelector('#prd-mfg-date').value,
                expDate: container.querySelector('#prd-exp-date').value,

                variations: collectedVariations
            };

            if (id && userRestrictions.disableUpdate) {
                showAlert.error('You do not have permission to update products.');
                btn.disabled = false;
                return;
            }
            if (id && userRestrictions.disableUpdateOthers) {
                const existingPrd = activeProducts.find(p => p.id === id);
                const isCreatorSelf = existingPrd && ((existingPrd.creatorId && (existingPrd.creatorId === currentUser.uid || (currentUser.email && existingPrd.creatorId.toLowerCase() === (currentUser.email || '').toLowerCase()))) || (existingPrd.createdBy && (existingPrd.createdBy === currentUser.uid || (currentUser.email && existingPrd.createdBy.toLowerCase() === (currentUser.email || '').toLowerCase()))));
                if (!isCreatorSelf) {
                    showAlert.error('You are restricted from updating products created by other members.');
                    btn.disabled = false;
                    return;
                }
            }
            if (!id && userRestrictions.disableAdd) {
                showAlert.error('You do not have permission to add new products.');
                btn.disabled = false;
                return;
            }

            try {
                if (id) {
                    await productService.updateProduct(id, data, userRestrictions, currentUser.uid);
                    showAlert.success('Product updated');
                } else {
                    await productService.addProduct(data, currentUser.uid, userRestrictions);
                    if (data.upcCode) {
                        try {
                            await codeService.commitReservedCode(data.upcCode, id || 'catalog');
                        } catch (e) {}
                    }
                    showAlert.success('Product added');
                }

                // Clear draft and active form
                const curId = id || 'new';
                draftManager.clearDraft(`product_${curId}`);
                draftManager.unregisterActiveForm('product_form');
                if (prdUnsavedIndicator) prdUnsavedIndicator.update(false);

                hideProductEditorView();
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

    async function loadData() {
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
