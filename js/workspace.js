import { getProductService } from './services/productService.js';
import { getInvoiceService } from './services/invoiceService.js';
import { getSettingsService } from './services/settingsService.js';
import { calculateInvoiceTotal } from './utils/invoiceCalculator.js';
import { formatCurrency, getAppCurrencySymbol, setAppCurrencySymbol } from './utilities.js';
import { authService } from '../firebase/auth.js';

export const initWorkspace = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const shell = document.getElementById('app-shell');
    const closeContextBtn = document.getElementById('close-context');
    const contextPanel = document.getElementById('context-panel');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    const isMobile = () => window.innerWidth <= 768;

    // Restore desktop mini-sidebar preference
    if (!isMobile() && shell) {
        const isMini = localStorage.getItem('pricelister_sidebar_mini') === 'true';
        if (isMini) {
            shell.classList.add('sidebar-mini');
        }
    }

    // Set initial responsive state on mobile
    if (isMobile() && shell) {
        shell.classList.add('sidebar-collapsed');
    }

    const toggleSidebar = () => {
        if (!shell) return;
        if (isMobile()) {
            // Mobile off-canvas drawer toggle
            if (shell.classList.contains('sidebar-collapsed')) {
                shell.classList.remove('sidebar-collapsed');
            } else {
                shell.classList.add('sidebar-collapsed');
            }
        } else {
            // Desktop: toggle mini mode (icon-only hide / unhide)
            const isMiniNow = shell.classList.toggle('sidebar-mini');
            localStorage.setItem('pricelister_sidebar_mini', isMiniNow ? 'true' : 'false');
            
            // Update button title
            if (toggleBtn) {
                toggleBtn.setAttribute('title', isMiniNow ? 'Unhide / Expand Sidebar' : 'Collapse Sidebar (Mini Mode)');
            }
        }
    };

    const openMenuMobile = () => {
        if (!shell) return;
        if (isMobile()) {
            shell.classList.remove('sidebar-collapsed');
        } else {
            // If desktop and in mini mode, expand sidebar
            shell.classList.remove('sidebar-mini');
            localStorage.setItem('pricelister_sidebar_mini', 'false');
        }
    };

    const closeMenuMobile = () => {
        if (!shell) return;
        if (isMobile()) {
            shell.classList.add('sidebar-collapsed');
        }
    };

    // Toggle sidebar
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }

    // Topbar menu / expand button
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', openMenuMobile);
    }

    // Backdrop click closes drawer on mobile
    if (backdrop) {
        backdrop.addEventListener('click', closeMenuMobile);
    }

    // Auto-close drawer on mobile when clicking navigation links
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) {
                closeMenuMobile();
            }
        });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isMobile() && shell && !shell.classList.contains('sidebar-collapsed')) {
                closeMenuMobile();
            }
            if (contextPanel && contextPanel.classList.contains('open')) {
                contextPanel.classList.remove('open');
            }
        }
    });

    // Close context panel
    if (closeContextBtn) {
        closeContextBtn.addEventListener('click', () => {
            if (contextPanel) contextPanel.classList.remove('open');
        });
    }
};

export const toggleContextPanel = (title, contentHTML) => {
    const panel = document.getElementById('context-panel');
    const titleEl = document.getElementById('context-title');
    const contentEl = document.getElementById('context-content');
    
    if (titleEl) titleEl.textContent = title;
    if (contentEl) contentEl.innerHTML = contentHTML;
    if (panel) panel.classList.add('open');
};

// =========================================================================
// OVERVIEW DASHBOARD WITH DATE FILTERING & SKELETON LOADING
// =========================================================================

// Helpers for date ranges
const getMonthNameShort = (monthIdx) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIdx] || '';
};

const formatDateHuman = (dateObj) => {
    return `${dateObj.getDate()} ${getMonthNameShort(dateObj.getMonth())} ${dateObj.getFullYear()}`;
};

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

export const renderOverview = async (container, workspaceId) => {
    const now = new Date();
    
    // User info for friendly greeting
    const currentUser = authService?.getCurrentUser();
    let userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
    // Capitalize first letter
    userName = userName.charAt(0).toUpperCase() + userName.slice(1);

    // Initial Date Filter
    let activeFilter = 'LAST_6_MONTHS'; // 'THIS_MONTH', 'LAST_30_DAYS', 'LAST_6_MONTHS', 'THIS_YEAR', 'ALL_TIME'
    
    const calculateRange = (filterKey) => {
        const cur = new Date();
        if (filterKey === 'THIS_MONTH') {
            const s = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `1 ${getMonthNameShort(cur.getMonth())} – ${cur.getDate()} ${getMonthNameShort(cur.getMonth())}, ${cur.getFullYear()}`
            };
        } else if (filterKey === 'LAST_30_DAYS') {
            const s = new Date(cur.getTime() - (30 * 24 * 60 * 60 * 1000));
            s.setHours(0, 0, 0, 0);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `${getMonthNameShort(s.getMonth())} ${s.getDate()} – ${getMonthNameShort(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`
            };
        } else if (filterKey === 'THIS_YEAR') {
            const s = new Date(cur.getFullYear(), 0, 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `Jan 1 – ${getMonthNameShort(cur.getMonth())} ${cur.getDate()}, ${cur.getFullYear()}`
            };
        } else if (filterKey === 'ALL_TIME') {
            return {
                start: 0,
                end: Infinity,
                label: 'All Time Record'
            };
        } else {
            // Default: Last 6 Months
            const s = new Date(cur.getFullYear(), cur.getMonth() - 5, 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `${getMonthNameShort(s.getMonth())} 1, ${s.getFullYear()} – ${getMonthNameShort(e.getMonth())} ${e.getDate()}, ${e.getFullYear()}`
            };
        }
    };

    let currentRange = calculateRange(activeFilter);

    // Initial Dashboard DOM Skeleton
    container.innerHTML = `
        <div class="dash-container">
            
            <!-- Dashboard Top Header Row -->
            <div class="dash-header-row">
                <div class="dash-title-group">
                    <h1 class="dash-title">Dashboard</h1>
                    <p class="dash-subtitle">Welcome back, ${userName}. Here's what's happening with your business today.</p>
                </div>
                <div class="dash-date-picker-wrap">
                    <button class="dash-date-btn" id="dash-date-filter-btn" type="button" aria-expanded="false" title="Change Dashboard Date Filter">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span id="dash-active-range-label">${currentRange.label}</span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div class="dash-date-dropdown" id="dash-date-dropdown">
                        <button type="button" class="dash-date-opt ${activeFilter === 'LAST_6_MONTHS' ? 'active' : ''}" data-filter="LAST_6_MONTHS">Last 6 Months</button>
                        <button type="button" class="dash-date-opt ${activeFilter === 'THIS_MONTH' ? 'active' : ''}" data-filter="THIS_MONTH">This Month</button>
                        <button type="button" class="dash-date-opt ${activeFilter === 'LAST_30_DAYS' ? 'active' : ''}" data-filter="LAST_30_DAYS">Last 30 Days</button>
                        <button type="button" class="dash-date-opt ${activeFilter === 'THIS_YEAR' ? 'active' : ''}" data-filter="THIS_YEAR">This Year</button>
                        <button type="button" class="dash-date-opt ${activeFilter === 'ALL_TIME' ? 'active' : ''}" data-filter="ALL_TIME">All Time</button>
                    </div>
                </div>
            </div>

            <!-- Top Row: 4 Metric Cards with Sparklines -->
            <div class="dash-kpi-grid">
                
                <!-- 1. Total Revenue -->
                <div class="dash-kpi-card">
                    <div class="dash-kpi-top">
                        <div class="dash-kpi-icon-wrap dash-kpi-icon-green">
                            <span style="font-weight:800; font-size:1.15rem;">${getAppCurrencySymbol() || '$'}</span>
                        </div>
                        <div>
                            <div class="dash-kpi-label">Total Revenue</div>
                            <div class="dash-kpi-value" id="kpi-revenue">...</div>
                        </div>
                    </div>
                    <div class="dash-kpi-meta">
                        <span class="dash-trend-up">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            12.4%
                        </span>
                        <span class="dash-trend-sub">vs previous period</span>
                    </div>
                    <!-- Sparkline Wave SVG -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 50" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad-spark-green" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                                <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,38 Q30,15 60,32 T120,20 T180,35 T240,12 L240,50 L0,50 Z" fill="url(#grad-spark-green)"/>
                        <path d="M0,38 Q30,15 60,32 T120,20 T180,35 T240,12" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 2. Total Orders -->
                <div class="dash-kpi-card">
                    <div class="dash-kpi-top">
                        <div class="dash-kpi-icon-wrap dash-kpi-icon-blue">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        </div>
                        <div>
                            <div class="dash-kpi-label">Total Orders</div>
                            <div class="dash-kpi-value" id="kpi-orders">...</div>
                        </div>
                    </div>
                    <div class="dash-kpi-meta">
                        <span class="dash-trend-up">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            8.2%
                        </span>
                        <span class="dash-trend-sub">vs previous period</span>
                    </div>
                    <!-- Sparkline Wave SVG -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 50" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad-spark-blue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
                                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,35 Q30,22 60,30 T120,18 T180,25 T240,10 L240,50 L0,50 Z" fill="url(#grad-spark-blue)"/>
                        <path d="M0,35 Q30,22 60,30 T120,18 T180,25 T240,10" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 3. Total Products -->
                <div class="dash-kpi-card">
                    <div class="dash-kpi-top">
                        <div class="dash-kpi-icon-wrap dash-kpi-icon-purple">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        <div>
                            <div class="dash-kpi-label">Total Products</div>
                            <div class="dash-kpi-value" id="kpi-products">...</div>
                        </div>
                    </div>
                    <div class="dash-kpi-meta">
                        <span class="dash-trend-up">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            5.6%
                        </span>
                        <span class="dash-trend-sub">vs previous period</span>
                    </div>
                    <!-- Sparkline Wave SVG -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 50" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad-spark-purple" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.35"/>
                                <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,40 Q40,30 80,36 T160,18 T240,15 L240,50 L0,50 Z" fill="url(#grad-spark-purple)"/>
                        <path d="M0,40 Q40,30 80,36 T160,18 T240,15" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 4. Total Clients -->
                <div class="dash-kpi-card">
                    <div class="dash-kpi-top">
                        <div class="dash-kpi-icon-wrap dash-kpi-icon-orange">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                            <div class="dash-kpi-label">Total Clients</div>
                            <div class="dash-kpi-value" id="kpi-clients">...</div>
                        </div>
                    </div>
                    <div class="dash-kpi-meta">
                        <span class="dash-trend-up">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            10.1%
                        </span>
                        <span class="dash-trend-sub">vs previous period</span>
                    </div>
                    <!-- Sparkline Wave SVG -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 50" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="grad-spark-orange" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#f97316" stop-opacity="0.35"/>
                                <stop offset="100%" stop-color="#f97316" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,36 Q35,18 70,30 T140,24 T210,12 T240,16 L240,50 L0,50 Z" fill="url(#grad-spark-orange)"/>
                        <path d="M0,36 Q35,18 70,30 T140,24 T210,12 T240,16" fill="none" stroke="#f97316" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

            </div>

            <!-- Middle Row: 2 Major Interactive Graphs -->
            <div class="dash-charts-grid">
                
                <!-- Chart 1: Sales Overview Multi-Series Area Graph -->
                <div class="dash-card">
                    <div class="dash-card-header">
                        <div>
                            <h3 class="dash-card-title">Sales Overview</h3>
                            <p class="dash-card-subtitle">Revenue over the last 6 months</p>
                        </div>
                        <div class="dash-chart-legend">
                            <span class="dash-legend-item">
                                <span class="dash-legend-dot" style="background: #3b82f6;"></span>
                                Revenue
                            </span>
                            <span class="dash-legend-item">
                                <span class="dash-legend-dot" style="background: #8b5cf6;"></span>
                                Orders
                            </span>
                        </div>
                    </div>
                    
                    <!-- SVG Interactive Chart Container -->
                    <div class="dash-svg-chart-container" id="dash-sales-chart-container">
                        <svg class="dash-svg-chart" id="dash-sales-svg" viewBox="0 0 680 240" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chartRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.38"/>
                                    <stop offset="85%" stop-color="#93c5fd" stop-opacity="0.08"/>
                                    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                                </linearGradient>
                            </defs>

                            <!-- Horizontal Grid Lines -->
                            <g stroke="#f1f5f9" stroke-width="1.2" stroke-dasharray="4 4">
                                <line x1="50" y1="20" x2="660" y2="20" />
                                <line x1="50" y1="65" x2="660" y2="65" />
                                <line x1="50" y1="110" x2="660" y2="110" />
                                <line x1="50" y1="155" x2="660" y2="155" />
                                <line x1="50" y1="200" x2="660" y2="200" stroke-dasharray="0" stroke="#e2e8f0" />
                            </g>

                            <!-- Y-Axis Labels -->
                            <g fill="#94a3b8" font-size="11" font-weight="600" text-anchor="end">
                                <text x="40" y="24" id="chart-y-4">400K</text>
                                <text x="40" y="69" id="chart-y-3">300K</text>
                                <text x="40" y="114" id="chart-y-2">200K</text>
                                <text x="40" y="159" id="chart-y-1">100K</text>
                                <text x="40" y="204">0</text>
                            </g>

                            <!-- Area Paths and Lines -->
                            <path id="chart-revenue-area" d="" fill="url(#chartRevenueGrad)" />
                            <path id="chart-revenue-line" d="" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                            <path id="chart-orders-line" d="" fill="none" stroke="#8b5cf6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />

                            <!-- Interactive Coordinate Circles -->
                            <g id="chart-data-dots"></g>

                            <!-- Hover Guide Line -->
                            <line id="chart-hover-line" x1="0" y1="20" x2="0" y2="200" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="3 3" opacity="0" />

                            <!-- X-Axis Labels -->
                            <g id="chart-x-labels" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle"></g>
                        </svg>

                        <!-- Floating Glass Tooltip -->
                        <div class="dash-chart-tooltip" id="dash-chart-tooltip">
                            <div class="tooltip-month" id="tooltip-month-text">Month</div>
                            <div class="tooltip-row">
                                <span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:7px;height:7px;border-radius:50%;background:#3b82f6;"></span>Revenue:</span>
                                <strong id="tooltip-rev-text" style="color:#ffffff;">$0</strong>
                            </div>
                            <div class="tooltip-row">
                                <span style="display:flex;align-items:center;gap:0.3rem;"><span style="width:7px;height:7px;border-radius:50%;background:#8b5cf6;"></span>Orders:</span>
                                <strong id="tooltip-ord-text" style="color:#ffffff;">0</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Chart 2: Order Status Donut Chart -->
                <div class="dash-card">
                    <div class="dash-card-header">
                        <div>
                            <h3 class="dash-card-title">Order Status</h3>
                            <p class="dash-card-subtitle">Total orders by status</p>
                        </div>
                    </div>

                    <div class="dash-donut-layout">
                        <!-- SVG Donut -->
                        <div class="dash-donut-graphic-wrap">
                            <svg viewBox="0 0 160 160" width="160" height="160">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="#f1f5f9" stroke-width="18"/>
                                <g id="donut-segments"></g>
                            </svg>
                            <div class="dash-donut-center-text">
                                <div class="dash-donut-center-num" id="donut-total-count">0</div>
                                <div class="dash-donut-center-sub">Total Orders</div>
                            </div>
                        </div>

                        <!-- Breakdown List -->
                        <div class="dash-donut-breakdown-list" id="donut-breakdown-list">
                            <!-- Populated dynamically via JS -->
                        </div>
                    </div>
                </div>

            </div>

            <!-- Bottom Row: 3 Responsive Columns -->
            <div class="dash-bottom-grid">
                
                <!-- 1. Top Selling Products -->
                <div class="dash-card">
                    <div class="dash-card-header">
                        <div>
                            <h3 class="dash-card-title">Top Selling Products</h3>
                            <p class="dash-card-subtitle">Based on total sales</p>
                        </div>
                        <a href="#/products" class="dash-view-all-link">View All</a>
                    </div>
                    <div class="dash-table-container">
                        <table class="dash-table">
                            <thead>
                                <tr>
                                    <th style="width:36px;">#</th>
                                    <th>Product</th>
                                    <th>Category</th>
                                    <th style="text-align:right;">Sold</th>
                                    <th style="text-align:right;">Revenue</th>
                                </tr>
                            </thead>
                            <tbody id="dash-top-products-tbody">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 2. Recent Invoices -->
                <div class="dash-card">
                    <div class="dash-card-header">
                        <div>
                            <h3 class="dash-card-title">Recent Invoices</h3>
                            <p class="dash-card-subtitle">Latest transactions</p>
                        </div>
                        <a href="#/invoices/customer" class="dash-view-all-link">View All</a>
                    </div>
                    <div class="dash-table-container">
                        <table class="dash-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Client</th>
                                    <th>Amount</th>
                                    <th style="text-align:right;">Status</th>
                                </tr>
                            </thead>
                            <tbody id="dash-recent-invoices-tbody">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 3. Quick Actions -->
                <div class="dash-card">
                    <div class="dash-card-header">
                        <div>
                            <h3 class="dash-card-title">Quick Actions</h3>
                            <p class="dash-card-subtitle">Shortcuts & operations</p>
                        </div>
                    </div>
                    <div class="dash-actions-stack">
                        <a href="#/invoices/customer" class="dash-action-btn dash-action-btn-primary">
                            <span class="dash-action-left">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                <span>Create Invoice</span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </a>
                        <a href="#/products" class="dash-action-btn">
                            <span class="dash-action-left">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                <span>Add Product</span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </a>
                        <a href="#/market-inserter" class="dash-action-btn">
                            <span class="dash-action-left">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                <span>Create Order</span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </a>
                        <a href="#/customers" class="dash-action-btn">
                            <span class="dash-action-left">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                <span>Add Client</span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </a>
                        <a href="#/analytics" class="dash-action-btn">
                            <span class="dash-action-left">
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                <span>View Reports</span>
                            </span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </a>
                    </div>
                </div>

            </div>

        </div>
    `;

    // Dropdown toggle logic
    const dateBtn = container.querySelector('#dash-date-filter-btn');
    const dateDropdown = container.querySelector('#dash-date-dropdown');
    const activeRangeLabel = container.querySelector('#dash-active-range-label');

    if (dateBtn && dateDropdown) {
        dateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dateDropdown.classList.toggle('is-open');
            dateBtn.setAttribute('aria-expanded', isOpen);
        });

        document.addEventListener('click', () => {
            dateDropdown.classList.remove('is-open');
            dateBtn.setAttribute('aria-expanded', 'false');
        });

        dateDropdown.querySelectorAll('.dash-date-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const f = opt.getAttribute('data-filter');
                activeFilter = f;
                currentRange = calculateRange(f);
                if (activeRangeLabel) activeRangeLabel.textContent = currentRange.label;
                dateDropdown.querySelectorAll('.dash-date-opt').forEach(o => o.classList.toggle('active', o === opt));
                dateDropdown.classList.remove('is-open');
                dateBtn.setAttribute('aria-expanded', 'false');
                computeAndRenderDashboard();
            });
        });
    }

    if (!workspaceId) return;

    let cachedProducts = [];
    let cachedCustInvoices = [];
    let cachedBusInvoices = [];

    const formatCurr = (val) => formatCurrency(val);
    const formatNum = (val) => Number(val || 0).toLocaleString();

    // 0 -> X Count-up animation
    const animateNumber = (element, targetValue, isCurrency = true, duration = 750) => {
        if (!element) return;
        const target = Number(targetValue) || 0;
        const startVal = 0;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const currentVal = startVal + (target - startVal) * ease;

            element.textContent = isCurrency 
                ? formatCurr(currentVal) 
                : formatNum(Math.round(currentVal));

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = isCurrency ? formatCurr(target) : formatNum(target);
            }
        };
        requestAnimationFrame(update);
    };

    const computeAndRenderDashboard = () => {
        const allInvoices = [...cachedCustInvoices, ...cachedBusInvoices];
        
        // Filter within selected date range
        const filteredInvoices = allInvoices.filter(inv => {
            if (activeFilter === 'ALL_TIME') return true;
            const t = getInvoiceTime(inv);
            return t >= currentRange.start && t <= currentRange.end;
        });

        // 1. Calculate Top KPI Values
        let totalRevenue = 0;
        filteredInvoices.forEach(inv => {
            totalRevenue += Number(inv.totalPrice || 0);
        });

        const totalOrders = filteredInvoices.length;
        const totalProducts = cachedProducts.length;

        // Unique clients / customers count
        const clientSet = new Set();
        filteredInvoices.forEach(inv => {
            const name = inv.customerName || inv.clientName || inv.buyerName;
            if (name) clientSet.add(name.toLowerCase().trim());
        });
        const totalClients = Math.max(clientSet.size, 1);

        // Populate Top KPIs with smooth count-up
        animateNumber(container.querySelector('#kpi-revenue'), totalRevenue, true, 800);
        animateNumber(container.querySelector('#kpi-orders'), totalOrders, false, 700);
        animateNumber(container.querySelector('#kpi-products'), totalProducts, false, 600);
        animateNumber(container.querySelector('#kpi-clients'), totalClients, false, 600);

        // =========================================================================
        // 2. Sales Overview Multi-Series Area Chart Generator (Last 6 Months)
        // =========================================================================
        const monthNames = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
        const chartMonths = [];
        const monthData = [];

        // Build 6 monthly data points up to current month
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mIdx = d.getMonth();
            const y = d.getFullYear();
            const mName = getMonthNameShort(mIdx);
            chartMonths.push(mName);

            // Filter invoices in this month
            const mStart = new Date(y, mIdx, 1, 0, 0, 0, 0).getTime();
            const mEnd = new Date(y, mIdx + 1, 0, 23, 59, 59, 999).getTime();

            const mInvoices = allInvoices.filter(inv => {
                const t = getInvoiceTime(inv);
                return t >= mStart && t <= mEnd;
            });

            let mRev = 0;
            mInvoices.forEach(inv => mRev += Number(inv.totalPrice || 0));
            let mOrd = mInvoices.length;

            monthData.push({
                month: mName,
                revenue: mRev,
                orders: mOrd
            });
        }

        // SVG Coordinate Math
        const svgW = 680;
        const svgH = 240;
        const padL = 70;
        const padR = 640;
        const padT = 25;
        const padB = 200;

        const maxRev = Math.max(...monthData.map(d => d.revenue), 10000);
        // Round maxRev up to nice ceiling (e.g. 400K)
        const ceilingRev = Math.ceil(maxRev / 100000) * 100000 || 400000;
        const maxOrd = Math.max(...monthData.map(d => d.orders), 10);
        const ceilingOrd = Math.ceil(maxOrd / 10) * 10 || 100;

        // Update Y-Axis labels
        const y4 = container.querySelector('#chart-y-4');
        const y3 = container.querySelector('#chart-y-3');
        const y2 = container.querySelector('#chart-y-2');
        const y1 = container.querySelector('#chart-y-1');

        if (y4) y4.textContent = (ceilingRev / 1000) + 'K';
        if (y3) y3.textContent = ((ceilingRev * 0.75) / 1000) + 'K';
        if (y2) y2.textContent = ((ceilingRev * 0.5) / 1000) + 'K';
        if (y1) y1.textContent = ((ceilingRev * 0.25) / 1000) + 'K';

        // Calculate (X, Y) points
        const pointsRev = [];
        const pointsOrd = [];
        const stepX = (padR - padL) / (monthData.length - 1);

        monthData.forEach((d, i) => {
            const x = padL + i * stepX;
            const yRev = padB - (d.revenue / ceilingRev) * (padB - padT);
            const yOrd = padB - (d.orders / ceilingOrd) * (padB - padT);
            pointsRev.push({ x, y: yRev, raw: d.revenue, month: d.month });
            pointsOrd.push({ x, y: yOrd, raw: d.orders, month: d.month });
        });

        // Generate Smooth Cubic Bezier Path
        const getSvgPath = (pts) => {
            if (pts.length === 0) return '';
            let path = `M ${pts[0].x},${pts[0].y}`;
            for (let i = 0; i < pts.length - 1; i++) {
                const p0 = pts[i === 0 ? 0 : i - 1];
                const p1 = pts[i];
                const p2 = pts[i + 1];
                const p3 = pts[i + 2] || p2;

                const cp1x = p1.x + (p2.x - p0.x) / 6;
                const cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                const cp2y = p2.y - (p3.y - p1.y) / 6;

                path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
            }
            return path;
        };

        const revLinePath = getSvgPath(pointsRev);
        const ordLinePath = getSvgPath(pointsOrd);
        const revAreaPath = `${revLinePath} L ${pointsRev[pointsRev.length - 1].x},${padB} L ${pointsRev[0].x},${padB} Z`;

        const elRevArea = container.querySelector('#chart-revenue-area');
        const elRevLine = container.querySelector('#chart-revenue-line');
        const elOrdLine = container.querySelector('#chart-orders-line');
        const elXLabels = container.querySelector('#chart-x-labels');
        const elDataDots = container.querySelector('#chart-data-dots');

        if (elRevArea) elRevArea.setAttribute('d', revAreaPath);
        if (elRevLine) elRevLine.setAttribute('d', revLinePath);
        if (elOrdLine) elOrdLine.setAttribute('d', ordLinePath);

        // Render X-Axis Months
        if (elXLabels) {
            elXLabels.innerHTML = monthData.map((d, i) => {
                const x = padL + i * stepX;
                return `<text x="${x}" y="222">${d.month}</text>`;
            }).join('');
        }

        // Render Coordinate Dot Badges
        if (elDataDots) {
            elDataDots.innerHTML = pointsRev.map((pt, i) => `
                <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2.5" class="chart-dot" data-idx="${i}" />
                <circle cx="${pointsOrd[i].x}" cy="${pointsOrd[i].y}" r="3.5" fill="#ffffff" stroke="#8b5cf6" stroke-width="2" class="chart-dot" data-idx="${i}" />
            `).join('');
        }

        // Interactive Mousemove Hover on Chart
        const chartContainer = container.querySelector('#dash-sales-chart-container');
        const chartSvg = container.querySelector('#dash-sales-svg');
        const hoverLine = container.querySelector('#chart-hover-line');
        const tooltip = container.querySelector('#dash-chart-tooltip');
        const tooltipMonth = container.querySelector('#tooltip-month-text');
        const tooltipRev = container.querySelector('#tooltip-rev-text');
        const tooltipOrd = container.querySelector('#tooltip-ord-text');

        if (chartSvg && tooltip && hoverLine) {
            chartSvg.addEventListener('mousemove', (e) => {
                const rect = chartSvg.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * svgW;

                // Find closest data point index
                let closestIdx = 0;
                let minDiff = Infinity;
                pointsRev.forEach((pt, idx) => {
                    const diff = Math.abs(pt.x - mouseX);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = idx;
                    }
                });

                const ptRev = pointsRev[closestIdx];
                const ptOrd = pointsOrd[closestIdx];
                const d = monthData[closestIdx];

                // Position hover line
                hoverLine.setAttribute('x1', ptRev.x);
                hoverLine.setAttribute('x2', ptRev.x);
                hoverLine.setAttribute('opacity', '1');

                // Position floating tooltip
                const tooltipLeft = (ptRev.x / svgW) * 100;
                const tooltipTop = (ptRev.y / svgH) * 100;

                tooltip.style.left = `${tooltipLeft}%`;
                tooltip.style.top = `${tooltipTop}%`;
                tooltip.style.display = 'block';

                if (tooltipMonth) tooltipMonth.textContent = d.month;
                if (tooltipRev) tooltipRev.textContent = formatCurr(d.revenue);
                if (tooltipOrd) tooltipOrd.textContent = `${d.orders} orders`;
            });

            chartSvg.addEventListener('mouseleave', () => {
                hoverLine.setAttribute('opacity', '0');
                tooltip.style.display = 'none';
            });
        }

        // =========================================================================
        // 3. Order Status Donut Chart Generator
        // =========================================================================
        let statusCounts = {
            Completed: 0,
            Processing: 0,
            Pending: 0,
            Cancelled: 0,
            Returned: 0
        };

        filteredInvoices.forEach(inv => {
            const rawStatus = (inv.status || '').toUpperCase();
            if (rawStatus === 'PAID' || rawStatus === 'COMPLETED') {
                statusCounts.Completed++;
            } else if (rawStatus === 'PROCESSING') {
                statusCounts.Processing++;
            } else if (rawStatus === 'CANCELLED' || rawStatus === 'VOID') {
                statusCounts.Cancelled++;
            } else if (rawStatus === 'RETURNED') {
                statusCounts.Returned++;
            } else {
                statusCounts.Pending++;
            }
        });

        // If newly started workspace with 0 orders, display representative status breakdown
        const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        const effectiveTotal = totalCount > 0 ? totalCount : 1;

        const statusColors = {
            Completed: '#10b981',
            Processing: '#3b82f6',
            Pending: '#f59e0b',
            Cancelled: '#ef4444',
            Returned: '#8b5cf6'
        };

        const donutSegmentsEl = container.querySelector('#donut-segments');
        const donutTotalCountEl = container.querySelector('#donut-total-count');
        const donutBreakdownListEl = container.querySelector('#donut-breakdown-list');

        if (donutTotalCountEl) donutTotalCountEl.textContent = totalCount;

        if (donutSegmentsEl && donutBreakdownListEl) {
            const r = 58;
            const circumference = 2 * Math.PI * r; // ~364.42
            let accumulatedOffset = 0;

            donutSegmentsEl.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
                const pct = count / effectiveTotal;
                const strokeLength = pct * circumference;
                const dashArray = `${strokeLength} ${circumference}`;
                const dashOffset = -accumulatedOffset;
                accumulatedOffset += strokeLength;

                if (count === 0 && totalCount > 0) return '';
                return `
                    <circle cx="80" cy="80" r="${r}" fill="none"
                        stroke="${statusColors[status]}" stroke-width="18"
                        stroke-dasharray="${dashArray}"
                        stroke-dashoffset="${dashOffset}"
                        transform="rotate(-90 80 80)"
                        style="transition: stroke-dashoffset 0.6s ease;"
                    />
                `;
            }).join('');

            // Render right breakdown list
            donutBreakdownListEl.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
                const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0';
                return `
                    <div class="dash-donut-row">
                        <div class="dash-donut-row-left">
                            <span style="width:9px;height:9px;border-radius:50%;background:${statusColors[status]};display:inline-block;"></span>
                            <span>${status}</span>
                        </div>
                        <div class="dash-donut-row-right">
                            <span class="dash-donut-count">${count}</span>
                            <span class="dash-donut-pct">${pct}%</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // =========================================================================
        // 4. Top Selling Products Table
        // =========================================================================
        const productSalesMap = new Map();
        
        // Count sales from invoice items
        allInvoices.forEach(inv => {
            if (inv.items && Array.isArray(inv.items)) {
                inv.items.forEach(item => {
                    const key = (item.name || item.title || 'Product').trim();
                    const qty = Number(item.quantity || item.qty || 1);
                    const rev = Number(item.totalPrice || item.price * qty || 0);
                    const cat = item.category || 'General';

                    if (!productSalesMap.has(key)) {
                        productSalesMap.set(key, { name: key, category: cat, sold: 0, revenue: 0 });
                    }
                    const record = productSalesMap.get(key);
                    record.sold += qty;
                    record.revenue += rev;
                });
            }
        });

        // Top products list
        let topProducts = Array.from(productSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // If no sales yet, populate with catalog items
        if (topProducts.length === 0 && cachedProducts.length > 0) {
            topProducts = cachedProducts.slice(0, 5).map(p => ({
                name: p.name || p.title || 'Catalog Item',
                category: p.category || 'Standard',
                sold: 0,
                revenue: Number(p.price || 0)
            }));
        }

        const topProductsTbody = container.querySelector('#dash-top-products-tbody');
        if (topProductsTbody) {
            if (topProducts.length === 0) {
                topProductsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#94a3b8;">No products recorded yet.</td></tr>`;
            } else {
                topProductsTbody.innerHTML = topProducts.map((p, idx) => `
                    <tr>
                        <td style="color:#94a3b8;font-weight:700;">${idx + 1}</td>
                        <td>
                            <div class="dash-prod-cell">
                                <div class="dash-prod-icon">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                </div>
                                <span>${p.name}</span>
                            </div>
                        </td>
                        <td><span class="dash-badge-cat">${p.category}</span></td>
                        <td style="text-align:right;font-weight:600;">${p.sold}</td>
                        <td style="text-align:right;font-weight:700;color:#0f172a;">${formatCurr(p.revenue)}</td>
                    </tr>
                `).join('');
            }
        }

        // =========================================================================
        // 5. Recent Invoices Table
        // =========================================================================
        const recentInvoices = filteredInvoices
            .sort((a, b) => getInvoiceTime(b) - getInvoiceTime(a))
            .slice(0, 5);

        const recentInvoicesTbody = container.querySelector('#dash-recent-invoices-tbody');
        if (recentInvoicesTbody) {
            if (recentInvoices.length === 0) {
                recentInvoicesTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:#94a3b8;">No transactions found in this period.</td></tr>`;
            } else {
                recentInvoicesTbody.innerHTML = recentInvoices.map(inv => {
                    const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                    const isCancelled = (inv.status || '').toUpperCase() === 'CANCELLED';
                    const statusClass = isPaid ? 'dash-status-paid' : (isCancelled ? 'dash-status-cancelled' : 'dash-status-pending');
                    const statusLabel = isPaid ? 'Paid' : (isCancelled ? 'Cancelled' : 'Pending');
                    const clientName = inv.customerName || inv.clientName || inv.buyerName || 'Walk-in Customer';
                    const invNumber = inv.uniqueId || inv.busInvNumber || inv.id || 'INV-001';

                    return `
                        <tr>
                            <td><span style="font-family:monospace;font-size:0.82rem;font-weight:600;color:#3b82f6;">${invNumber}</span></td>
                            <td style="font-weight:500;color:#334155;">${clientName}</td>
                            <td style="font-weight:700;color:#0f172a;">${formatCurr(inv.totalPrice || 0)}</td>
                            <td style="text-align:right;"><span class="dash-badge-status ${statusClass}">${statusLabel}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }
    };

    // Load Live Workspace Data Concurrently
    try {
        const productService = getProductService(workspaceId);
        const invoiceService = getInvoiceService(workspaceId);

        const [products, custInvoices, busInvoices] = await Promise.all([
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => [])
        ]);

        cachedProducts = products || [];
        cachedCustInvoices = custInvoices || [];
        cachedBusInvoices = busInvoices || [];

        computeAndRenderDashboard();

    } catch (e) {
        console.error("Dashboard data load error:", e);
    }
};
