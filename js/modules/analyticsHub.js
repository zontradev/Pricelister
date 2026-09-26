import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getPeopleService } from '../services/peopleService.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { formatCurrency } from '../utilities.js';
import { showAlert } from '../alert-handler.js';

// Helper for currency formatting
const formatCurr = (n) => formatCurrency(n);
const formatNum = (n) => Number(n || 0).toLocaleString();

const getInvoiceTime = (inv) => {
    if (!inv) return 0;
    if (typeof inv.timestamp === 'number') return inv.timestamp;
    if (inv.timestamp && typeof inv.timestamp.toDate === 'function') return inv.timestamp.toDate().getTime();
    if (inv.timestamp && typeof inv.timestamp.seconds === 'number') return inv.timestamp.seconds * 1000;
    if (typeof inv.timestamp === 'string') {
        const p = new Date(inv.timestamp).getTime();
        if (!isNaN(p)) return p;
    }
    if (inv.createdAt) {
        if (typeof inv.createdAt === 'number') return inv.createdAt;
        if (typeof inv.createdAt.toDate === 'function') return inv.createdAt.toDate().getTime();
        const p = new Date(inv.createdAt).getTime();
        if (!isNaN(p)) return p;
    }
    return 0;
};

// Compute net profit and margin for an invoice
const getInvoiceProfit = (inv) => {
    if (inv.totalProfit !== undefined && inv.totalProfit !== null && !isNaN(inv.totalProfit)) {
        const profit = Number(inv.totalProfit) || 0;
        const total = Number(inv.totalPrice) || 0;
        const margin = total > 0 ? (profit / total) * 100 : 0;
        return { profit, margin, total };
    }
    if (inv.items && Array.isArray(inv.items)) {
        const calc = calculateInvoiceTotal(
            inv.items,
            inv.discountPercent || 0,
            inv.additionalCut || 0,
            inv.taxPercent || 0,
            inv.shippingCost || 0
        );
        const profit = calc.totalProfit || 0;
        const total = calc.grandTotal || Number(inv.totalPrice) || 0;
        const margin = total > 0 ? (profit / total) * 100 : 0;
        return { profit, margin, total };
    }
    return { profit: 0, margin: 0, total: Number(inv.totalPrice) || 0 };
};

export const renderAnalyticsHub = async (container, workspaceId, activeFeature = null) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const peopleService = getPeopleService(workspaceId);

    // Initial Skeleton Loading State
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
            <div>
                <h2 style="margin:0 0 0.35rem 0;">Data Check & Analytics</h2>
                <p style="color:var(--text-secondary); margin:0;">In-depth business intelligence, time-based trends, product performance, and ranking reports.</p>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            ${Array(6).fill(0).map(() => `
                <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); height: 130px;">
                    <div class="skeleton-shimmer" style="width: 32px; height: 32px; border-radius: 8px; margin-bottom: 12px;"></div>
                    <div class="skeleton-shimmer" style="width: 140px; height: 20px; margin-bottom: 6px;"></div>
                    <div class="skeleton-shimmer" style="width: 90px; height: 14px;"></div>
                </div>
            `).join('')}
        </div>
    `;

    try {
        // Fetch all datasets in parallel
        const [products, categories, custInvoices, busInvoices, businesses, customers] = await Promise.all([
            productService.getAllActiveProducts().catch(() => []),
            categoryService.getAllCategories().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => []),
            peopleService.getAllBusinesses().catch(() => []),
            peopleService.getAllCustomers().catch(() => [])
        ]);

        const allInvoices = [...custInvoices, ...busInvoices];

        // State for active feature subview
        let currentFeature = activeFeature;

        // Detail drilldown state
        let drilldownState = {
            type: null, // 'DAY', 'WEEK', 'MONTH', 'YEAR', 'BUSINESS', 'CLIENT'
            key: null,
            title: '',
            invoices: []
        };

        const renderView = () => {
            if (currentFeature) {
                renderFeatureDetail(currentFeature);
            } else {
                renderHubGrid();
            }
        };

        // =========================================================================
        // 1. HUB GRID VIEW (12 PRO CARDS)
        // =========================================================================
        const renderHubGrid = () => {
            container.innerHTML = `
                <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.75rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <h2 style="font-size: 1.85rem; color: var(--text-primary); margin:0 0 0.35rem 0; font-weight: 700; letter-spacing: -0.02em;">Data Check & Analytics</h2>
                        <p style="color:var(--text-secondary); margin:0; font-size:0.95rem;">Select any report to view deep analytics, trends, rankings, and financial breakdowns.</p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button class="btn btn-secondary" onclick="window.location.hash='#/overview'">&larr; Back to Overview</button>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
                    
                    <!-- 1. Data Overview -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-1" data-feature="DATA_VIEW" style="border-left: 4px solid #2196F3;">
                        <div class="pro-card-icon" style="color: #2196F3; background: rgba(33, 150, 243, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Data Overview</h3>
                            <p>Total creations & catalog counts</p>
                        </div>
                        <div class="pro-card-meta">${allInvoices.length} Total Invoices &bull; ${products.length} Products</div>
                    </div>

                    <!-- 2. Analytics & Interactive Charts -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-2" data-feature="CHART_VIEW" style="border-left: 4px solid #3F51B5;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #3F51B5; background: rgba(63, 81, 181, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Analytics & Charts</h3>
                            <p>Interactive revenue trend graphs</p>
                        </div>
                        <div class="pro-card-meta">Weekly, Monthly & Yearly views</div>
                    </div>

                    <!-- 3. Daily Report -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-3" data-feature="DAILY_DATA" style="border-left: 4px solid #009688;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #009688; background: rgba(0, 150, 136, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Daily Report</h3>
                            <p>Day-by-day sales & invoice list</p>
                        </div>
                        <div class="pro-card-meta">Click any day to drill down</div>
                    </div>

                    <!-- 4. Weekly Sales -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-4" data-feature="WEEKLY_DATA" style="border-left: 4px solid #4CAF50;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #4CAF50; background: rgba(76, 175, 80, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Weekly Sales</h3>
                            <p>7-day trend cards & totals</p>
                        </div>
                        <div class="pro-card-meta">Week-over-week comparison</div>
                    </div>

                    <!-- 5. Monthly Sales -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-5" data-feature="MONTHLY_DATA" style="border-left: 4px solid #FF9800;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #FF9800; background: rgba(255, 152, 0, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Monthly Sales</h3>
                            <p>Month-by-month revenue cards</p>
                        </div>
                        <div class="pro-card-meta">Received vs Pending ratio</div>
                    </div>

                    <!-- 6. Yearly Sales -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-6" data-feature="YEARLY_DATA" style="border-left: 4px solid #FF5722;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #FF5722; background: rgba(255, 87, 34, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Yearly Sales</h3>
                            <p>Annual historical performance</p>
                        </div>
                        <div class="pro-card-meta">Annual reviews & growth</div>
                    </div>

                    <!-- 7. High Value Items -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-1" data-feature="HIGH_VALUE_PRODUCTS" style="border-left: 4px solid #9C27B0;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #9C27B0; background: rgba(156, 39, 176, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>High Value Items</h3>
                            <p>Top ranked products leaderboard</p>
                        </div>
                        <div class="pro-card-meta">Ranked by revenue & quantity</div>
                    </div>

                    <!-- 8. Top Invoices -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-2" data-feature="HIGH_VALUE_INVOICE" style="border-left: 4px solid #E91E63;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #E91E63; background: rgba(233, 30, 99, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Top Invoices</h3>
                            <p>Highest sales invoices ranking</p>
                        </div>
                        <div class="pro-card-meta">Sorted highest to lowest</div>
                    </div>

                    <!-- 9. Top Businesses -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-3" data-feature="HIGH_VALUE_BUSINESS" style="border-left: 4px solid #673AB7;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #673AB7; background: rgba(103, 58, 183, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Top Businesses</h3>
                            <p>Usage & revenue volume rank</p>
                        </div>
                        <div class="pro-card-meta">${businesses.length} Total Partners</div>
                    </div>

                    <!-- 10. Top Clients -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-4" data-feature="HIGH_VALUE_CLIENT" style="border-left: 4px solid #00BCD4;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #00BCD4; background: rgba(0, 188, 212, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Top Clients</h3>
                            <p>Highest lifetime value (LTV)</p>
                        </div>
                        <div class="pro-card-meta">${customers.length} Total Clients & Customers</div>
                    </div>

                    <!-- 11. Top Profit Invoices -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-5" data-feature="PROFITED_INVOICE" style="border-left: 4px solid #10B981;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #10B981; background: rgba(16, 185, 129, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Top Profit Invoices</h3>
                            <p>Highest margin transactions</p>
                        </div>
                        <div class="pro-card-meta">Ranked by Net Profit & %</div>
                    </div>

                    <!-- 12. Profit Report -->
                    <div class="pro-grid-card anim-fade-up anim-stagger-6" data-feature="PROFIT_DATA" style="border-left: 4px solid #059669;">
                        <div class="pro-card-badge">PRO</div>
                        <div class="pro-card-icon" style="color: #059669; background: rgba(5, 150, 105, 0.1);">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                        </div>
                        <div class="pro-card-content">
                            <h3>Profit Report</h3>
                            <p>Timeframe margin analysis</p>
                        </div>
                        <div class="pro-card-meta">COGS, Revenue & Net Profit</div>
                    </div>

                </div>
            `;

            // Attach card click handlers
            container.querySelectorAll('.pro-grid-card').forEach(card => {
                card.addEventListener('click', () => {
                    const feat = card.getAttribute('data-feature');
                    currentFeature = feat;
                    drilldownState.type = null;
                    renderView();
                });
            });
        };

        // =========================================================================
        // 2. FEATURE DETAIL SUBVIEWS
        // =========================================================================
        const renderFeatureDetail = (featureId) => {
            // Check if viewing a drill-down invoice list
            if (drilldownState.type) {
                renderDrilldownInvoices();
                return;
            }

            switch (featureId) {
                case 'DATA_VIEW':
                    renderDataOverview();
                    break;
                case 'CHART_VIEW':
                    renderAnalyticsCharts();
                    break;
                case 'DAILY_DATA':
                    renderDailyReport();
                    break;
                case 'WEEKLY_DATA':
                    renderWeeklyReport();
                    break;
                case 'MONTHLY_DATA':
                    renderMonthlyReport();
                    break;
                case 'YEARLY_DATA':
                    renderYearlyReport();
                    break;
                case 'HIGH_VALUE_PRODUCTS':
                    renderHighValueProducts();
                    break;
                case 'HIGH_VALUE_INVOICE':
                    renderHighValueInvoices();
                    break;
                case 'HIGH_VALUE_BUSINESS':
                    renderHighValueBusinesses();
                    break;
                case 'HIGH_VALUE_CLIENT':
                    renderHighValueClients();
                    break;
                case 'PROFITED_INVOICE':
                    renderProfitedInvoices();
                    break;
                case 'PROFIT_DATA':
                    renderProfitReport();
                    break;
                default:
                    renderDataOverview();
            }
        };

        // Helper header for subviews
        const getSubHeader = (title, subtitle) => `
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.75rem; flex-wrap:wrap; gap:1rem;">
                <div style="display:flex; align-items:center; gap:1rem;">
                    <button id="btn-back-hub" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        All Reports
                    </button>
                    <div>
                        <h2 style="font-size: 1.6rem; color: var(--text-primary); margin:0 0 0.2rem 0; font-weight:700;">${title}</h2>
                        <p style="color:var(--text-secondary); margin:0; font-size:0.88rem;">${subtitle}</p>
                    </div>
                </div>
            </div>
        `;

        const attachBackToHub = () => {
            const btn = container.querySelector('#btn-back-hub');
            if (btn) {
                btn.addEventListener('click', () => {
                    currentFeature = null;
                    drilldownState.type = null;
                    renderView();
                });
            }
        };

        // -------------------------------------------------------------------------
        // FEATURE 1: DATA OVERVIEW
        // -------------------------------------------------------------------------
        const renderDataOverview = () => {
            const totalProductsCount = products.length;
            const totalCategoryCount = categories.length;
            const totalInvoicesCount = allInvoices.length;
            const businessInvoicesCount = busInvoices.length;
            const customerInvoicesCount = custInvoices.length;
            const businessProfilesCount = businesses.length;
            const clientProfilesCount = customers.filter(c => c.isClient).length;
            const regularCustomersCount = customers.filter(c => !c.isClient).length;
            
            const totalUnitsSold = allInvoices.reduce((acc, inv) => {
                const items = inv.items || [];
                return acc + items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            }, 0);

            const grossRevenue = allInvoices.reduce((acc, inv) => acc + (Number(inv.totalPrice) || 0), 0);
            const avgOrderValue = totalInvoicesCount > 0 ? (grossRevenue / totalInvoicesCount) : 0;

            container.innerHTML = `
                ${getSubHeader('Data Overview', 'Catalog inventory, sales breakdown, and partner creation statistics')}

                <!-- Inventory Statistics -->
                <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:1rem; font-weight:700;">Inventory & Catalog</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
                    <div class="card" style="padding:1.4rem; border-left:4px solid #009688;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Active Products</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(totalProductsCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #9C27B0;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Categories</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(totalCategoryCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #2196F3;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Total Items Sold</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(totalUnitsSold)} units</div>
                    </div>
                </div>

                <!-- Invoice Breakdown -->
                <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:1rem; font-weight:700;">Invoice Distribution</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
                    <div class="card" style="padding:1.4rem; border-left:4px solid #2196F3;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Total Invoices</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(totalInvoicesCount)}</div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.35rem;">Gross: ${formatCurr(grossRevenue)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #FF9800;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Business Invoices</div>
                        <div style="font-size:1.85rem; font-weight:700; color:#d97706; margin-top:0.35rem;">${formatNum(businessInvoicesCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #4CAF50;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Customer Invoices</div>
                        <div style="font-size:1.85rem; font-weight:700; color:#059669; margin-top:0.35rem;">${formatNum(customerInvoicesCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #8b5cf6;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Avg Invoice Value</div>
                        <div style="font-size:1.85rem; font-weight:700; color:#7c3aed; margin-top:0.35rem;">${formatCurr(avgOrderValue)}</div>
                    </div>
                </div>

                <!-- Directory Profiles -->
                <h3 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:1rem; font-weight:700;">Partner & Client Profiles</h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem;">
                    <div class="card" style="padding:1.4rem; border-left:4px solid #673AB7;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Registered Businesses</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(businessProfilesCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #E91E63;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Direct Clients</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(clientProfilesCount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #00BCD4;">
                        <div style="font-size:0.8rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Customers</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatNum(regularCustomersCount)}</div>
                    </div>
                </div>
            `;
            attachBackToHub();
        };

        // -------------------------------------------------------------------------
        // FEATURE 2: ANALYTICS & INTERACTIVE CHARTS (CHART_VIEW)
        // -------------------------------------------------------------------------
        let chartTimeframe = 'WEEK'; // 'WEEK', 'MONTH', 'YEAR'
        let chartTimeOffset = 0;

        const renderAnalyticsCharts = () => {
            // Compute range based on chartTimeframe and offset
            const startCal = new Date();
            const endCal = new Date();
            let label = '';
            let buckets = [];

            if (chartTimeframe === 'WEEK') {
                const cur = new Date();
                cur.setDate(cur.getDate() + (chartTimeOffset * 7));
                const day = cur.getDay(); // 0 is Sun
                const diff = cur.getDate() - day + (day === 0 ? -6 : 1); // Monday start
                startCal.setTime(new Date(cur.setDate(diff)).setHours(0, 0, 0, 0));
                endCal.setTime(new Date(startCal.getTime() + (6 * 24 * 60 * 60 * 1000)).setHours(23, 59, 59, 999));
                label = `${startCal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endCal.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                
                const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                buckets = days.map((d, idx) => {
                    const dayDate = new Date(startCal.getTime() + (idx * 24 * 60 * 60 * 1000));
                    return { key: d, label: d, dateStr: dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), sales: 0, profit: 0 };
                });
            } else if (chartTimeframe === 'MONTH') {
                const cur = new Date();
                cur.setMonth(cur.getMonth() + chartTimeOffset);
                startCal.setTime(new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0).getTime());
                endCal.setTime(new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999).getTime());
                label = startCal.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

                // 4 Week intervals
                buckets = [
                    { key: 'W1', label: '1 - 7', sales: 0, profit: 0 },
                    { key: 'W2', label: '8 - 14', sales: 0, profit: 0 },
                    { key: 'W3', label: '15 - 21', sales: 0, profit: 0 },
                    { key: 'W4', label: '22 - End', sales: 0, profit: 0 }
                ];
            } else if (chartTimeframe === 'YEAR') {
                const cur = new Date();
                cur.setFullYear(cur.getFullYear() + chartTimeOffset);
                startCal.setTime(new Date(cur.getFullYear(), 0, 1, 0, 0, 0, 0).getTime());
                endCal.setTime(new Date(cur.getFullYear(), 11, 31, 23, 59, 59, 999).getTime());
                label = `${startCal.getFullYear()}`;

                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                buckets = months.map(m => ({ key: m, label: m, sales: 0, profit: 0 }));
            }

            const periodInvoices = allInvoices.filter(inv => {
                const t = getInvoiceTime(inv);
                return t >= startCal.getTime() && t <= endCal.getTime();
            });

            // Populate buckets
            periodInvoices.forEach(inv => {
                const t = getInvoiceTime(inv);
                const invDate = new Date(t);
                const price = Number(inv.totalPrice) || 0;
                const profitData = getInvoiceProfit(inv);

                if (chartTimeframe === 'WEEK') {
                    const dayIdx = (invDate.getDay() + 6) % 7; // Mon = 0
                    if (buckets[dayIdx]) {
                        buckets[dayIdx].sales += price;
                        buckets[dayIdx].profit += profitData.profit;
                    }
                } else if (chartTimeframe === 'MONTH') {
                    const d = invDate.getDate();
                    const wIdx = d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : 3;
                    if (buckets[wIdx]) {
                        buckets[wIdx].sales += price;
                        buckets[wIdx].profit += profitData.profit;
                    }
                } else if (chartTimeframe === 'YEAR') {
                    const mIdx = invDate.getMonth();
                    if (buckets[mIdx]) {
                        buckets[mIdx].sales += price;
                        buckets[mIdx].profit += profitData.profit;
                    }
                }
            });

            const totalPeriodSales = periodInvoices.reduce((a, b) => a + (Number(b.totalPrice) || 0), 0);
            const totalPeriodProfit = periodInvoices.reduce((a, b) => a + getInvoiceProfit(b).profit, 0);
            const receivedAmount = periodInvoices.filter(i => (i.status || '').toUpperCase() === 'PAID').reduce((a, b) => a + (Number(b.totalPrice) || 0), 0);
            const pendingAmount = periodInvoices.filter(i => (i.status || '').toUpperCase() !== 'PAID').reduce((a, b) => a + (Number(b.totalPrice) || 0), 0);
            const collectionRate = totalPeriodSales > 0 ? (receivedAmount / totalPeriodSales) * 100 : 0;
            const profitMargin = totalPeriodSales > 0 ? (totalPeriodProfit / totalPeriodSales) * 100 : 0;
            const avgOrderVal = periodInvoices.length > 0 ? (totalPeriodSales / periodInvoices.length) : 0;

            const maxBucketValue = Math.max(...buckets.map(b => b.sales), 1);

            container.innerHTML = `
                ${getSubHeader('Analytics & Trends', 'Visual graphs, collection efficiency, and period revenue comparison')}

                <!-- TIMEFRAME CONTROLS -->
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; background:var(--bg-card); padding:0.85rem 1.25rem; border-radius:var(--radius-card); border:1px solid var(--border-color);">
                    <div style="display:flex; gap:0.4rem;">
                        <button class="btn btn-sm ${chartTimeframe === 'WEEK' ? 'btn-primary' : 'btn-secondary'}" id="btn-tf-week">Week</button>
                        <button class="btn btn-sm ${chartTimeframe === 'MONTH' ? 'btn-primary' : 'btn-secondary'}" id="btn-tf-month">Month</button>
                        <button class="btn btn-sm ${chartTimeframe === 'YEAR' ? 'btn-primary' : 'btn-secondary'}" id="btn-tf-year">Year</button>
                    </div>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <button class="icon-btn" id="btn-chart-prev" style="width:34px; height:34px; border:1px solid var(--border-color); border-radius:var(--radius-md);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                        <strong style="font-size:0.95rem; color:var(--text-primary); min-width:180px; text-align:center;">${label}</strong>
                        <button class="icon-btn" id="btn-chart-next" style="width:34px; height:34px; border:1px solid var(--border-color); border-radius:var(--radius-md);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                    </div>
                </div>

                <!-- KPI CARDS -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
                    <div class="card" style="padding:1.4rem; border-left:4px solid var(--primary);">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Total Sales</div>
                        <div style="font-size:1.75rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatCurr(totalPeriodSales)}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${periodInvoices.length} invoices</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #10b981;">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Collection Rate</div>
                        <div style="font-size:1.75rem; font-weight:700; color:#059669; margin-top:0.35rem;">${collectionRate.toFixed(1)}%</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Paid: ${formatCurr(receivedAmount)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #8b5cf6;">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Profit Margin</div>
                        <div style="font-size:1.75rem; font-weight:700; color:#7c3aed; margin-top:0.35rem;">${profitMargin.toFixed(1)}%</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Net: ${formatCurr(totalPeriodProfit)}</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #f59e0b;">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Avg Order Value</div>
                        <div style="font-size:1.75rem; font-weight:700; color:#d97706; margin-top:0.35rem;">${formatCurr(avgOrderVal)}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Pending: ${formatCurr(pendingAmount)}</div>
                    </div>
                </div>

                <!-- INTERACTIVE BAR CHART -->
                <div class="card" style="padding:1.75rem; border-radius:var(--radius-card); margin-bottom:2rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:0.5rem;">
                        <h3 style="margin:0; font-size:1.15rem; font-weight:700;">Revenue Distribution</h3>
                        <div style="display:flex; gap:1rem; font-size:0.82rem;">
                            <span style="display:inline-flex; align-items:center; gap:0.4rem;">
                                <span style="width:10px; height:10px; border-radius:3px; background:var(--primary); display:inline-block;"></span>
                                Sales Revenue
                            </span>
                            <span style="display:inline-flex; align-items:center; gap:0.4rem;">
                                <span style="width:10px; height:10px; border-radius:3px; background:#8b5cf6; display:inline-block;"></span>
                                Net Profit
                            </span>
                        </div>
                    </div>

                    <div style="display:flex; align-items:flex-end; gap:1.25rem; height:220px; padding-top:20px; border-bottom:2px solid var(--border-color); overflow-x:auto;">
                        ${buckets.map(b => {
                            const salesHeight = maxBucketValue > 0 ? ((b.sales / maxBucketValue) * 160).toFixed(0) : 0;
                            const profitHeight = maxBucketValue > 0 ? ((b.profit / maxBucketValue) * 160).toFixed(0) : 0;
                            return `
                                <div style="flex:1; min-width:40px; display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
                                    <div style="display:flex; align-items:flex-end; gap:4px; height:160px;">
                                        <div title="Sales: ${formatCurr(b.sales)}" style="width:16px; height:${Math.max(Number(salesHeight), 4)}px; background:linear-gradient(180deg, #ff3366, #e11d48); border-radius:4px 4px 0 0; transition:height 0.3s ease;"></div>
                                        <div title="Profit: ${formatCurr(b.profit)}" style="width:16px; height:${Math.max(Number(profitHeight), 2)}px; background:linear-gradient(180deg, #a78bfa, #7c3aed); border-radius:4px 4px 0 0; transition:height 0.3s ease;"></div>
                                    </div>
                                    <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); text-align:center; white-space:nowrap;">
                                        ${b.label}
                                        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:400;">${formatCurr(b.sales)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;

            attachBackToHub();

            container.querySelector('#btn-tf-week').addEventListener('click', () => { chartTimeframe = 'WEEK'; chartTimeOffset = 0; renderAnalyticsCharts(); });
            container.querySelector('#btn-tf-month').addEventListener('click', () => { chartTimeframe = 'MONTH'; chartTimeOffset = 0; renderAnalyticsCharts(); });
            container.querySelector('#btn-tf-year').addEventListener('click', () => { chartTimeframe = 'YEAR'; chartTimeOffset = 0; renderAnalyticsCharts(); });
            container.querySelector('#btn-chart-prev').addEventListener('click', () => { chartTimeOffset -= 1; renderAnalyticsCharts(); });
            container.querySelector('#btn-chart-next').addEventListener('click', () => { chartTimeOffset += 1; renderAnalyticsCharts(); });
        };

        // -------------------------------------------------------------------------
        // FEATURE 3: DAILY REPORT (DAILY_DATA)
        // -------------------------------------------------------------------------
        const renderDailyReport = () => {
            const dayMap = new Map();

            allInvoices.forEach(inv => {
                const t = getInvoiceTime(inv);
                if (!t) return;
                const d = new Date(t);
                const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                
                if (!dayMap.has(dayKey)) {
                    dayMap.set(dayKey, {
                        key: dayKey,
                        timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
                        dateStr: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                        totalSales: 0,
                        invoices: [],
                        paidCount: 0,
                        itemsCount: 0
                    });
                }
                const entry = dayMap.get(dayKey);
                entry.totalSales += Number(inv.totalPrice) || 0;
                entry.invoices.push(inv);
                if ((inv.status || '').toUpperCase() === 'PAID') entry.paidCount++;
                const items = inv.items || [];
                entry.itemsCount += items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            });

            const sortedDays = Array.from(dayMap.values()).sort((a, b) => b.timestamp - a.timestamp);

            container.innerHTML = `
                ${getSubHeader('Daily Report', 'Daily sales aggregations & click to view any day\'s invoice details')}
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${sortedDays.length === 0 ? '<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">No sales data available.</div>' : ''}
                    ${sortedDays.map((day, idx) => `
                        <div class="card daily-card-item" data-day="${day.key}" style="padding:1.4rem; border-radius:var(--radius-card); cursor:pointer; transition:transform 0.15s ease, box-shadow 0.15s ease; border-left:4px solid #009688;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                                <div>
                                    <h4 style="margin:0 0 0.25rem 0; font-size:1.1rem; color:var(--text-primary); font-weight:700;">${day.dateStr}</h4>
                                    <span style="font-size:0.8rem; color:var(--text-muted);">${day.invoices.length} Invoices &bull; ${day.itemsCount} Items</span>
                                </div>
                                <span class="badge" style="background:rgba(0,150,136,0.1); color:#009688; font-weight:700; font-size:0.75rem;">Day #${idx + 1}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.75rem; margin-top:0.5rem;">
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Daily Revenue</div>
                                    <strong style="font-size:1.35rem; color:var(--text-primary); font-weight:700;">${formatCurr(day.totalSales)}</strong>
                                </div>
                                <button class="btn btn-sm btn-secondary" style="font-size:0.78rem;">View Invoices &rarr;</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            attachBackToHub();

            container.querySelectorAll('.daily-card-item').forEach(el => {
                el.addEventListener('click', () => {
                    const key = el.getAttribute('data-day');
                    const day = dayMap.get(key);
                    if (day) {
                        drilldownState = {
                            type: 'DAY',
                            key: key,
                            title: `Daily Invoices: ${day.dateStr}`,
                            invoices: day.invoices
                        };
                        renderDrilldownInvoices();
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 4: WEEKLY SALES (WEEKLY_DATA)
        // -------------------------------------------------------------------------
        const renderWeeklyReport = () => {
            const weekMap = new Map();

            allInvoices.forEach(inv => {
                const t = getInvoiceTime(inv);
                if (!t) return;
                const d = new Date(t);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const startOfWeek = new Date(d.getFullYear(), d.getMonth(), diff);
                startOfWeek.setHours(0, 0, 0, 0);
                const weekKey = `${startOfWeek.getFullYear()}-W${Math.ceil((startOfWeek.getTime() - new Date(startOfWeek.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;

                if (!weekMap.has(weekKey)) {
                    const endOfWeek = new Date(startOfWeek.getTime() + (6 * 24 * 60 * 60 * 1000));
                    weekMap.set(weekKey, {
                        key: weekKey,
                        timestamp: startOfWeek.getTime(),
                        label: `${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
                        totalSales: 0,
                        invoices: []
                    });
                }
                const entry = weekMap.get(weekKey);
                entry.totalSales += Number(inv.totalPrice) || 0;
                entry.invoices.push(inv);
            });

            const sortedWeeks = Array.from(weekMap.values()).sort((a, b) => b.timestamp - a.timestamp);

            container.innerHTML = `
                ${getSubHeader('Weekly Sales', '7-day trend cards & weekly invoice breakdowns')}
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${sortedWeeks.length === 0 ? '<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">No sales data available.</div>' : ''}
                    ${sortedWeeks.map((week, idx) => `
                        <div class="card weekly-card-item" data-week="${week.key}" style="padding:1.4rem; border-radius:var(--radius-card); cursor:pointer; border-left:4px solid #4CAF50;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                                <div>
                                    <h4 style="margin:0 0 0.25rem 0; font-size:1.1rem; color:var(--text-primary); font-weight:700;">${week.label}</h4>
                                    <span style="font-size:0.8rem; color:var(--text-muted);">${week.invoices.length} Invoices</span>
                                </div>
                                <span class="badge" style="background:rgba(76,175,80,0.1); color:#4CAF50; font-weight:700; font-size:0.75rem;">Week #${idx + 1}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.75rem; margin-top:0.5rem;">
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Weekly Sales</div>
                                    <strong style="font-size:1.35rem; color:var(--text-primary); font-weight:700;">${formatCurr(week.totalSales)}</strong>
                                </div>
                                <button class="btn btn-sm btn-secondary" style="font-size:0.78rem;">View Week &rarr;</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            attachBackToHub();

            container.querySelectorAll('.weekly-card-item').forEach(el => {
                el.addEventListener('click', () => {
                    const key = el.getAttribute('data-week');
                    const week = weekMap.get(key);
                    if (week) {
                        drilldownState = {
                            type: 'WEEK',
                            key: key,
                            title: `Weekly Invoices: ${week.label}`,
                            invoices: week.invoices
                        };
                        renderDrilldownInvoices();
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 5: MONTHLY SALES (MONTHLY_DATA)
        // -------------------------------------------------------------------------
        const renderMonthlyReport = () => {
            const monthMap = new Map();

            allInvoices.forEach(inv => {
                const t = getInvoiceTime(inv);
                if (!t) return;
                const d = new Date(t);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

                if (!monthMap.has(monthKey)) {
                    monthMap.set(monthKey, {
                        key: monthKey,
                        timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
                        label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
                        totalSales: 0,
                        received: 0,
                        pending: 0,
                        invoices: []
                    });
                }
                const entry = monthMap.get(monthKey);
                const price = Number(inv.totalPrice) || 0;
                entry.totalSales += price;
                if ((inv.status || '').toUpperCase() === 'PAID') entry.received += price;
                else entry.pending += price;
                entry.invoices.push(inv);
            });

            const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.timestamp - a.timestamp);

            container.innerHTML = `
                ${getSubHeader('Monthly Sales', 'Month-by-month financial cards & collection ratio')}
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${sortedMonths.length === 0 ? '<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">No sales data available.</div>' : ''}
                    ${sortedMonths.map((month) => `
                        <div class="card monthly-card-item" data-month="${month.key}" style="padding:1.4rem; border-radius:var(--radius-card); cursor:pointer; border-left:4px solid #FF9800;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                                <div>
                                    <h4 style="margin:0 0 0.25rem 0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">${month.label}</h4>
                                    <span style="font-size:0.8rem; color:var(--text-muted);">${month.invoices.length} Invoices</span>
                                </div>
                            </div>
                            <div style="margin:0.75rem 0;">
                                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Total Invoiced</div>
                                <strong style="font-size:1.45rem; color:var(--text-primary); font-weight:700;">${formatCurr(month.totalSales)}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:0.75rem; font-size:0.82rem;">
                                <span style="color:#059669;">Paid: <strong>${formatCurr(month.received)}</strong></span>
                                <span style="color:#d97706;">Pending: <strong>${formatCurr(month.pending)}</strong></span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            attachBackToHub();

            container.querySelectorAll('.monthly-card-item').forEach(el => {
                el.addEventListener('click', () => {
                    const key = el.getAttribute('data-month');
                    const month = monthMap.get(key);
                    if (month) {
                        drilldownState = {
                            type: 'MONTH',
                            key: key,
                            title: `Monthly Invoices: ${month.label}`,
                            invoices: month.invoices
                        };
                        renderDrilldownInvoices();
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 6: YEARLY SALES (YEARLY_DATA)
        // -------------------------------------------------------------------------
        const renderYearlyReport = () => {
            const yearMap = new Map();

            allInvoices.forEach(inv => {
                const t = getInvoiceTime(inv);
                if (!t) return;
                const d = new Date(t);
                const yearKey = `${d.getFullYear()}`;

                if (!yearMap.has(yearKey)) {
                    yearMap.set(yearKey, {
                        key: yearKey,
                        year: d.getFullYear(),
                        totalSales: 0,
                        totalProfit: 0,
                        invoices: []
                    });
                }
                const entry = yearMap.get(yearKey);
                entry.totalSales += Number(inv.totalPrice) || 0;
                entry.totalProfit += getInvoiceProfit(inv).profit;
                entry.invoices.push(inv);
            });

            const sortedYears = Array.from(yearMap.values()).sort((a, b) => b.year - a.year);

            container.innerHTML = `
                ${getSubHeader('Yearly Sales', 'Annual financial reviews, total gross revenue & net margins')}
                
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                    ${sortedYears.length === 0 ? '<div class="card" style="padding:2rem; text-align:center; color:var(--text-muted);">No sales data available.</div>' : ''}
                    ${sortedYears.map((year) => `
                        <div class="card yearly-card-item" data-year="${year.key}" style="padding:1.6rem; border-radius:var(--radius-card); cursor:pointer; border-left:4px solid #FF5722;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                                <h3 style="margin:0; font-size:1.5rem; color:var(--text-primary); font-weight:700;">Year ${year.year}</h3>
                                <span class="badge" style="background:rgba(255,87,34,0.1); color:#FF5722; font-weight:700; font-size:0.8rem;">${year.invoices.length} Invoices</span>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Annual Gross Sales</div>
                                    <strong style="font-size:1.35rem; color:var(--text-primary); font-weight:700;">${formatCurr(year.totalSales)}</strong>
                                </div>
                                <div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Annual Net Profit</div>
                                    <strong style="font-size:1.35rem; color:#7c3aed; font-weight:700;">${formatCurr(year.totalProfit)}</strong>
                                </div>
                            </div>
                            <div style="border-top:1px solid var(--border-color); padding-top:0.75rem; text-align:right;">
                                <button class="btn btn-sm btn-secondary">Explore Invoices &rarr;</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            attachBackToHub();

            container.querySelectorAll('.yearly-card-item').forEach(el => {
                el.addEventListener('click', () => {
                    const key = el.getAttribute('data-year');
                    const year = yearMap.get(key);
                    if (year) {
                        drilldownState = {
                            type: 'YEAR',
                            key: key,
                            title: `Yearly Invoices: ${year.year}`,
                            invoices: year.invoices
                        };
                        renderDrilldownInvoices();
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 7: HIGH VALUE ITEMS (HIGH_VALUE_PRODUCTS)
        // -------------------------------------------------------------------------
        const renderHighValueProducts = () => {
            const productStatsMap = new Map();

            allInvoices.forEach(inv => {
                const items = inv.items || [];
                items.forEach(item => {
                    const pId = item.productId || item.name || 'unknown';
                    if (!productStatsMap.has(pId)) {
                        productStatsMap.set(pId, {
                            id: pId,
                            name: item.name || 'Unnamed Product',
                            image: item.image || '',
                            salePrice: Number(item.salePrice || item.price) || 0,
                            unitsSold: 0,
                            totalRevenue: 0,
                            invoiceCount: 0
                        });
                    }
                    const stat = productStatsMap.get(pId);
                    const qty = Number(item.quantity) || 1;
                    const price = Number(item.salePrice || item.price) || 0;
                    stat.unitsSold += qty;
                    stat.totalRevenue += (qty * price);
                    stat.invoiceCount += 1;
                });
            });

            // Match images with existing product catalog if missing
            productStatsMap.forEach(stat => {
                const found = products.find(p => p.id === stat.id || p.name === stat.name);
                if (found && found.image) stat.image = found.image;
            });

            const rankedProducts = Array.from(productStatsMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

            container.innerHTML = `
                ${getSubHeader('High Value Products', 'Top products ranked by gross revenue generated across all sales')}

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem; width:70px;">Rank</th>
                                    <th style="padding:1rem;">Product</th>
                                    <th style="padding:1rem;">Price</th>
                                    <th style="padding:1rem;">Units Sold</th>
                                    <th style="padding:1rem;">Invoices</th>
                                    <th style="padding:1rem 1.25rem;">Total Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rankedProducts.length === 0 ? '<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">No product sales recorded yet.</td></tr>' : ''}
                                ${rankedProducts.map((p, idx) => {
                                    const rankBadge = idx === 0 
                                        ? '<span style="background:#FFD700; color:#000; font-weight:800; padding:2px 8px; border-radius:12px; font-size:0.75rem;">#1</span>'
                                        : idx === 1 
                                        ? '<span style="background:#E0E0E0; color:#000; font-weight:800; padding:2px 8px; border-radius:12px; font-size:0.75rem;">#2</span>'
                                        : idx === 2 
                                        ? '<span style="background:#CD7F32; color:#fff; font-weight:800; padding:2px 8px; border-radius:12px; font-size:0.75rem;">#3</span>'
                                        : `<span style="color:var(--text-muted); font-weight:600; font-size:0.85rem;">#${idx + 1}</span>`;
                                    
                                    return `
                                        <tr style="border-bottom:1px solid var(--border-color); transition:background 0.15s ease;">
                                            <td style="padding:1rem 1.25rem; text-align:center;">${rankBadge}</td>
                                            <td style="padding:1rem;">
                                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                                    ${p.image ? `<img src="${p.image}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);">` : `<div style="width:36px; height:36px; border-radius:6px; background:var(--surface-100); display:flex; align-items:center; justify-content:center; color:var(--text-muted);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg></div>`}
                                                    <strong style="color:var(--text-primary); font-size:0.92rem;">${p.name}</strong>
                                                </div>
                                            </td>
                                            <td style="padding:1rem; font-size:0.88rem; color:var(--text-secondary);">${formatCurr(p.salePrice)}</td>
                                            <td style="padding:1rem;"><span class="badge" style="background:rgba(33,150,243,0.1); color:#2196F3; font-weight:700;">${formatNum(p.unitsSold)} units</span></td>
                                            <td style="padding:1rem; font-size:0.88rem; color:var(--text-secondary);">${p.invoiceCount}</td>
                                            <td style="padding:1rem 1.25rem; font-weight:700; color:var(--primary); font-size:0.95rem;">${formatCurr(p.totalRevenue)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();
        };

        // -------------------------------------------------------------------------
        // FEATURE 8: TOP INVOICES (HIGH_VALUE_INVOICE)
        // -------------------------------------------------------------------------
        const renderHighValueInvoices = () => {
            const sortedInvoices = allInvoices.slice().sort((a, b) => (Number(b.totalPrice) || 0) - (Number(a.totalPrice) || 0));

            container.innerHTML = `
                ${getSubHeader('Top Invoices', 'Highest revenue sales transactions ranked in descending order')}

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem; width:70px;">Rank</th>
                                    <th style="padding:1rem;">Invoice #</th>
                                    <th style="padding:1rem;">Customer / Business</th>
                                    <th style="padding:1rem;">Date</th>
                                    <th style="padding:1rem;">Status</th>
                                    <th style="padding:1rem 1.25rem;">Total Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedInvoices.length === 0 ? '<tr><td colspan="6" style="padding:2rem; text-align:center; color:var(--text-muted);">No invoices recorded yet.</td></tr>' : ''}
                                ${sortedInvoices.map((inv, idx) => {
                                    const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                                    const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
                                    const partyName = inv.isBusinessInvoice ? (inv.businessName || inv.clientName || 'Business Partner') : (inv.customerName || 'Customer');
                                    const invTime = getInvoiceTime(inv);
                                    const dateStr = invTime > 0 ? new Date(invTime).toLocaleDateString() : '—';

                                    return `
                                        <tr style="border-bottom:1px solid var(--border-color); transition:background 0.15s ease;">
                                            <td style="padding:1rem 1.25rem; text-align:center;"><span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span></td>
                                            <td style="padding:1rem;"><code style="font-family:monospace; background:rgba(0,0,0,0.04); padding:0.2rem 0.4rem; border-radius:4px;">${inv.uniqueId || inv.busInvNumber || inv.id}</code></td>
                                            <td style="padding:1rem;">
                                                <strong style="color:var(--text-primary); font-size:0.88rem;">${partyName}</strong>
                                                <div style="font-size:0.75rem; color:var(--text-muted);">${inv.isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice'}</div>
                                            </td>
                                            <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${dateStr}</td>
                                            <td style="padding:1rem;"><span class="${badgeClass}">${inv.status || 'UNPAID'}</span></td>
                                            <td style="padding:1rem 1.25rem; font-weight:700; color:var(--primary); font-size:1.05rem;">${formatCurr(inv.totalPrice)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();
        };

        // -------------------------------------------------------------------------
        // FEATURE 9: TOP BUSINESSES (HIGH_VALUE_BUSINESS)
        // -------------------------------------------------------------------------
        const renderHighValueBusinesses = () => {
            const busStats = businesses.map(b => {
                const linked = allInvoices.filter(inv => inv.businessId === b.uniqueId || inv.businessId === b.id || (inv.businessName && inv.businessName.toLowerCase() === (b.businessName || b.name || '').toLowerCase()));
                const totalRev = linked.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0);
                return {
                    ...b,
                    name: b.businessName || b.name || 'Unnamed Business',
                    invoiceCount: linked.length,
                    totalRevenue: totalRev,
                    invoices: linked
                };
            }).sort((a, b) => b.totalRevenue - a.totalRevenue);

            container.innerHTML = `
                ${getSubHeader('Top Businesses', 'Commercial business partners ranked by total invoiced transaction volume')}

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem; width:70px;">Rank</th>
                                    <th style="padding:1rem;">Business Name</th>
                                    <th style="padding:1rem;">Contact & Phone</th>
                                    <th style="padding:1rem;">Invoices Generated</th>
                                    <th style="padding:1rem 1.25rem;">Total Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${busStats.length === 0 ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No businesses registered yet.</td></tr>' : ''}
                                ${busStats.map((b, idx) => `
                                    <tr class="business-rank-row" data-id="${b.id || b.uniqueId}" style="border-bottom:1px solid var(--border-color); cursor:pointer;">
                                        <td style="padding:1rem 1.25rem; text-align:center;"><span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span></td>
                                        <td style="padding:1rem;">
                                            <strong style="color:var(--text-primary); font-size:0.92rem;">${b.name}</strong>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">${b.address || 'No address provided'}</div>
                                        </td>
                                        <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${b.phone || b.email || '—'}</td>
                                        <td style="padding:1rem;"><span class="badge" style="background:rgba(103,58,183,0.1); color:#673AB7; font-weight:700;">${b.invoiceCount} Invoices</span></td>
                                        <td style="padding:1rem 1.25rem; font-weight:700; color:var(--primary); font-size:1.05rem;">${formatCurr(b.totalRevenue)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();

            container.querySelectorAll('.business-rank-row').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.getAttribute('data-id');
                    const found = busStats.find(b => b.id === id || b.uniqueId === id);
                    if (found && found.invoices.length > 0) {
                        drilldownState = {
                            type: 'BUSINESS',
                            key: id,
                            title: `Business Invoices: ${found.name}`,
                            invoices: found.invoices
                        };
                        renderDrilldownInvoices();
                    } else {
                        showAlert('No invoices found for this business yet.', 'info');
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 10: TOP CLIENTS (HIGH_VALUE_CLIENT)
        // -------------------------------------------------------------------------
        const renderHighValueClients = () => {
            const clientStats = customers.map(c => {
                const linked = allInvoices.filter(inv => inv.clientId === c.uniqueId || inv.customerId === c.uniqueId || inv.clientId === c.id || (inv.clientName && inv.clientName.toLowerCase() === (c.name || '').toLowerCase()) || (inv.customerName && inv.customerName.toLowerCase() === (c.name || '').toLowerCase()));
                const totalRev = linked.reduce((s, inv) => s + (Number(inv.totalPrice) || 0), 0);
                return {
                    ...c,
                    name: c.name || 'Unnamed Client',
                    invoiceCount: linked.length,
                    totalRevenue: totalRev,
                    invoices: linked
                };
            }).sort((a, b) => b.totalRevenue - a.totalRevenue);

            container.innerHTML = `
                ${getSubHeader('Top Clients & Customers', 'Highest lifetime value (LTV) clients ranked by cumulative spending')}

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem; width:70px;">Rank</th>
                                    <th style="padding:1rem;">Client Name</th>
                                    <th style="padding:1rem;">Contact Info</th>
                                    <th style="padding:1rem;">Invoices</th>
                                    <th style="padding:1rem 1.25rem;">Lifetime Spend</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${clientStats.length === 0 ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No clients registered yet.</td></tr>' : ''}
                                ${clientStats.map((c, idx) => `
                                    <tr class="client-rank-row" data-id="${c.id || c.uniqueId}" style="border-bottom:1px solid var(--border-color); cursor:pointer;">
                                        <td style="padding:1rem 1.25rem; text-align:center;"><span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span></td>
                                        <td style="padding:1rem;">
                                            <strong style="color:var(--text-primary); font-size:0.92rem;">${c.name}</strong>
                                            <div style="font-size:0.75rem; color:var(--text-muted);">${c.address || '—'}</div>
                                        </td>
                                        <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${c.phone || c.email || '—'}</td>
                                        <td style="padding:1rem;"><span class="badge" style="background:rgba(0,188,212,0.1); color:#00BCD4; font-weight:700;">${c.invoiceCount} Invoices</span></td>
                                        <td style="padding:1rem 1.25rem; font-weight:700; color:var(--primary); font-size:1.05rem;">${formatCurr(c.totalRevenue)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();

            container.querySelectorAll('.client-rank-row').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.getAttribute('data-id');
                    const found = clientStats.find(c => c.id === id || c.uniqueId === id);
                    if (found && found.invoices.length > 0) {
                        drilldownState = {
                            type: 'CLIENT',
                            key: id,
                            title: `Client Invoices: ${found.name}`,
                            invoices: found.invoices
                        };
                        renderDrilldownInvoices();
                    } else {
                        showAlert('No invoices recorded for this client yet.', 'info');
                    }
                });
            });
        };

        // -------------------------------------------------------------------------
        // FEATURE 11: TOP PROFIT INVOICES (PROFITED_INVOICE)
        // -------------------------------------------------------------------------
        const renderProfitedInvoices = () => {
            const sortedByProfit = allInvoices.map(inv => ({
                ...inv,
                ...getInvoiceProfit(inv)
            })).sort((a, b) => b.profit - a.profit);

            container.innerHTML = `
                ${getSubHeader('Top Profit Invoices', 'Sales transactions ranked by highest Net Profit margin and estimated earnings')}

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem; width:70px;">Rank</th>
                                    <th style="padding:1rem;">Invoice #</th>
                                    <th style="padding:1rem;">Gross Revenue</th>
                                    <th style="padding:1rem;">Profit Margin</th>
                                    <th style="padding:1rem 1.25rem;">Net Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sortedByProfit.length === 0 ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No invoices available.</td></tr>' : ''}
                                ${sortedByProfit.map((inv, idx) => `
                                    <tr style="border-bottom:1px solid var(--border-color); transition:background 0.15s ease;">
                                        <td style="padding:1rem 1.25rem; text-align:center;"><span style="font-weight:700; color:var(--text-muted);">#${idx + 1}</span></td>
                                        <td style="padding:1rem;">
                                            <code style="font-family:monospace; background:rgba(0,0,0,0.04); padding:0.2rem 0.4rem; border-radius:4px;">${inv.uniqueId || inv.busInvNumber || inv.id}</code>
                                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${inv.isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice'}</div>
                                        </td>
                                        <td style="padding:1rem; font-weight:600; color:var(--text-primary); font-size:0.92rem;">${formatCurr(inv.total)}</td>
                                        <td style="padding:1rem;"><span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; font-weight:700;">+${inv.margin.toFixed(1)}% Margin</span></td>
                                        <td style="padding:1rem 1.25rem; font-weight:700; color:#059669; font-size:1.1rem;">+${formatCurr(inv.profit)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();
        };

        // -------------------------------------------------------------------------
        // FEATURE 12: PROFIT REPORT (PROFIT_DATA)
        // -------------------------------------------------------------------------
        let profitTimeframe = 'MONTH'; // 'WEEK', 'MONTH', 'YEAR'

        const renderProfitReport = () => {
            const now = new Date();
            let startMs = 0;
            let label = '';

            if (profitTimeframe === 'WEEK') {
                const cur = new Date();
                const day = cur.getDay();
                const diff = cur.getDate() - day + (day === 0 ? -6 : 1);
                const startOfWeek = new Date(cur.setDate(diff));
                startOfWeek.setHours(0, 0, 0, 0);
                startMs = startOfWeek.getTime();
                label = 'This Current Week';
            } else if (profitTimeframe === 'MONTH') {
                startMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                label = `${now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`;
            } else if (profitTimeframe === 'YEAR') {
                startMs = new Date(now.getFullYear(), 0, 1).getTime();
                label = `Year ${now.getFullYear()}`;
            }

            const periodInvoices = allInvoices.filter(inv => getInvoiceTime(inv) >= startMs);
            const grossRev = periodInvoices.reduce((a, b) => a + (Number(b.totalPrice) || 0), 0);
            const netProfit = periodInvoices.reduce((a, b) => a + getInvoiceProfit(b).profit, 0);
            const cogs = grossRev - netProfit;
            const margin = grossRev > 0 ? (netProfit / grossRev) * 100 : 0;

            container.innerHTML = `
                ${getSubHeader('Profit Report', `Timeframe profitability analysis for ${label}`)}

                <!-- TIMEFRAME SWITCHER -->
                <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
                    <button class="btn btn-sm ${profitTimeframe === 'WEEK' ? 'btn-primary' : 'btn-secondary'}" id="btn-ptf-week">This Week</button>
                    <button class="btn btn-sm ${profitTimeframe === 'MONTH' ? 'btn-primary' : 'btn-secondary'}" id="btn-ptf-month">This Month</button>
                    <button class="btn btn-sm ${profitTimeframe === 'YEAR' ? 'btn-primary' : 'btn-secondary'}" id="btn-ptf-year">This Year</button>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.25rem; margin-bottom:2rem;">
                    <div class="card" style="padding:1.4rem; border-left:4px solid #10b981;">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Net Profit</div>
                        <div style="font-size:1.85rem; font-weight:700; color:#059669; margin-top:0.35rem;">+${formatCurr(netProfit)}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Margin: ${margin.toFixed(1)}%</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid var(--primary);">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Gross Revenue</div>
                        <div style="font-size:1.85rem; font-weight:700; color:var(--text-primary); margin-top:0.35rem;">${formatCurr(grossRev)}</div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">${periodInvoices.length} invoices</div>
                    </div>
                    <div class="card" style="padding:1.4rem; border-left:4px solid #f59e0b;">
                        <div style="font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:600;">Est. Cost of Goods (COGS)</div>
                        <div style="font-size:1.85rem; font-weight:700; color:#d97706; margin-top:0.35rem;">${formatCurr(cogs)}</div>
                    </div>
                </div>

                <!-- DETAILED INVOICE PROFIT LIST -->
                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem;">Invoice #</th>
                                    <th style="padding:1rem;">Date</th>
                                    <th style="padding:1rem;">Revenue</th>
                                    <th style="padding:1rem;">Estimated Profit</th>
                                    <th style="padding:1rem 1.25rem;">Margin</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${periodInvoices.length === 0 ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No invoices recorded in this period.</td></tr>' : ''}
                                ${periodInvoices.map(inv => {
                                    const p = getInvoiceProfit(inv);
                                    const invTime = getInvoiceTime(inv);
                                    const dateStr = invTime > 0 ? new Date(invTime).toLocaleDateString() : '—';
                                    return `
                                        <tr style="border-bottom:1px solid var(--border-color);">
                                            <td style="padding:1rem 1.25rem;"><code style="font-family:monospace; background:rgba(0,0,0,0.04); padding:0.2rem 0.4rem; border-radius:4px;">${inv.uniqueId || inv.busInvNumber || inv.id}</code></td>
                                            <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${dateStr}</td>
                                            <td style="padding:1rem; font-weight:600; color:var(--text-primary); font-size:0.9rem;">${formatCurr(inv.totalPrice)}</td>
                                            <td style="padding:1rem; font-weight:700; color:#059669; font-size:0.95rem;">+${formatCurr(p.profit)}</td>
                                            <td style="padding:1rem 1.25rem;"><span class="badge" style="background:rgba(16,185,129,0.1); color:#059669; font-weight:700;">+${p.margin.toFixed(1)}%</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            attachBackToHub();

            container.querySelector('#btn-ptf-week').addEventListener('click', () => { profitTimeframe = 'WEEK'; renderProfitReport(); });
            container.querySelector('#btn-ptf-month').addEventListener('click', () => { profitTimeframe = 'MONTH'; renderProfitReport(); });
            container.querySelector('#btn-ptf-year').addEventListener('click', () => { profitTimeframe = 'YEAR'; renderProfitReport(); });
        };

        // -------------------------------------------------------------------------
        // DRILL-DOWN INVOICE LIST
        // -------------------------------------------------------------------------
        const renderDrilldownInvoices = () => {
            const list = drilldownState.invoices || [];

            container.innerHTML = `
                <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.75rem; flex-wrap:wrap; gap:1rem;">
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <button id="btn-back-drilldown" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                            Back to Report
                        </button>
                        <div>
                            <h2 style="font-size: 1.6rem; color: var(--text-primary); margin:0 0 0.2rem 0; font-weight:700;">${drilldownState.title}</h2>
                            <p style="color:var(--text-secondary); margin:0; font-size:0.88rem;">${list.length} Invoices &bull; Total: ${formatCurr(list.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0))}</p>
                        </div>
                    </div>
                </div>

                <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color); color:var(--text-muted); background:rgba(248,250,252,0.7); font-size:0.85rem;">
                                    <th style="padding:1rem 1.25rem;">Invoice #</th>
                                    <th style="padding:1rem;">Date</th>
                                    <th style="padding:1rem;">Customer / Business</th>
                                    <th style="padding:1rem;">Status</th>
                                    <th style="padding:1rem 1.25rem;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.length === 0 ? '<tr><td colspan="5" style="padding:2rem; text-align:center; color:var(--text-muted);">No invoices in this group.</td></tr>' : ''}
                                ${list.map(inv => {
                                    const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                                    const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
                                    const party = inv.isBusinessInvoice ? (inv.businessName || inv.clientName || 'Business Partner') : (inv.customerName || 'Customer');
                                    const invTime = getInvoiceTime(inv);
                                    const dateStr = invTime > 0 ? new Date(invTime).toLocaleDateString() : '—';
                                    return `
                                        <tr style="border-bottom:1px solid var(--border-color); transition:background 0.15s ease;">
                                            <td style="padding:1rem 1.25rem;"><code style="font-family:monospace; background:rgba(0,0,0,0.04); padding:0.2rem 0.4rem; border-radius:4px;">${inv.uniqueId || inv.busInvNumber || inv.id}</code></td>
                                            <td style="padding:1rem; font-size:0.85rem; color:var(--text-secondary);">${dateStr}</td>
                                            <td style="padding:1rem;">
                                                <strong style="color:var(--text-primary); font-size:0.88rem;">${party}</strong>
                                                <div style="font-size:0.75rem; color:var(--text-muted);">${inv.isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice'}</div>
                                            </td>
                                            <td style="padding:1rem;"><span class="${badgeClass}">${inv.status || 'UNPAID'}</span></td>
                                            <td style="padding:1rem 1.25rem; font-weight:700; color:var(--primary); font-size:0.95rem;">${formatCurr(inv.totalPrice)}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            container.querySelector('#btn-back-drilldown').addEventListener('click', () => {
                drilldownState.type = null;
                renderView();
            });
        };

        // Render initially
        renderView();

    } catch (e) {
        console.error("Failed to load Analytics Hub", e);
        showAlert("Failed to load analytics: " + e.message, "danger");
    }
};
