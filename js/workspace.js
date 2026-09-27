import { getProductService } from './services/productService.js';
import { getInvoiceService } from './services/invoiceService.js';
import { getSettingsService } from './services/settingsService.js';
import { getCategoryService } from './services/categoryService.js';
import { getPeopleService } from './services/peopleService.js';
import { calculateInvoiceTotal } from './utils/invoiceCalculator.js';
import { formatCurrency, getAppCurrencySymbol, setAppCurrencySymbol } from './utilities.js';
import { authService } from '../firebase/auth.js';
import { openInvoiceViewerModal } from './modules/invoiceViewer.js';
import { showAlert } from './alert-handler.js';

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
// TOTAL ANALYSIS EXPERT DASHBOARD (BUSINESS INTELLIGENCE & METRICS)
// =========================================================================

const getMonthNameShort = (monthIdx) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthIdx] || '';
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
    const currentUser = authService?.getCurrentUser();
    let userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Executive';
    userName = userName.charAt(0).toUpperCase() + userName.slice(1);

    // Initial Date Filter
    let activeFilter = 'LAST_6_MONTHS'; // 'THIS_MONTH', 'LAST_30_DAYS', 'LAST_6_MONTHS', 'THIS_YEAR', 'ALL_TIME'
    let activeChartSeries = 'ALL'; // 'ALL', 'REV', 'PROFIT'
    
    const calculateRange = (filterKey) => {
        const cur = new Date();
        if (filterKey === 'THIS_MONTH') {
            const s = new Date(cur.getFullYear(), cur.getMonth(), 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `This Month (${getMonthNameShort(cur.getMonth())} ${cur.getFullYear()})`
            };
        } else if (filterKey === 'LAST_30_DAYS') {
            const s = new Date(cur.getTime() - (30 * 24 * 60 * 60 * 1000));
            s.setHours(0, 0, 0, 0);
            const e = new Date();
            e.setHours(23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `Last 30 Days`
            };
        } else if (filterKey === 'THIS_YEAR') {
            const s = new Date(cur.getFullYear(), 0, 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `Year to Date (${cur.getFullYear()})`
            };
        } else if (filterKey === 'ALL_TIME') {
            return {
                start: 0,
                end: Infinity,
                label: 'All Time Records'
            };
        } else {
            // Default: Last 6 Months
            const s = new Date(cur.getFullYear(), cur.getMonth() - 5, 1, 0, 0, 0, 0);
            const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
            return {
                start: s.getTime(),
                end: e.getTime(),
                label: `Last 6 Months`
            };
        }
    };

    let currentRange = calculateRange(activeFilter);

    // Initial Dashboard Layout
    container.innerHTML = `
        <div class="dash-container" style="display:flex; flex-direction:column; gap:1.5rem; animation:fadeIn 0.25s ease;">
            
            <!-- EXECUTIVE TOP HEADER ROW -->
            <div class="dash-header-row" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div class="dash-title-group">
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <h1 class="dash-title" style="margin:0; font-size:1.85rem; font-weight:800; letter-spacing:-0.02em;">Analytics Expert Dashboard</h1>
                        <span class="badge" style="background:rgba(225,29,72,0.12); color:#e11d48; font-weight:700; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:6px;">LIVE INTELLIGENCE</span>
                    </div>
                    <p class="dash-subtitle" style="margin:0.25rem 0 0 0; color:var(--text-secondary); font-size:0.88rem;">
                        Welcome back, <strong>${userName}</strong>. Complete financial health, sales performance, and predictive metrics.
                    </p>
                </div>

                <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                    <!-- Date Filter Button & Dropdown -->
                    <div class="dash-date-picker-wrap" style="position:relative;">
                        <button class="dash-date-btn" id="dash-date-filter-btn" type="button" aria-expanded="false" style="display:flex; align-items:center; gap:0.45rem; padding:0.5rem 0.95rem; background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-pill); font-size:0.85rem; font-weight:600; cursor:pointer; box-shadow:var(--shadow-subtle);">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span id="dash-active-range-label">${currentRange.label}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div class="dash-date-dropdown" id="dash-date-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 6px); background:#ffffff; border:1px solid var(--border-color); border-radius:10px; box-shadow:var(--shadow-float); z-index:100; min-width:180px; padding:0.4rem;">
                            <button type="button" class="dash-date-opt ${activeFilter === 'LAST_6_MONTHS' ? 'active' : ''}" data-filter="LAST_6_MONTHS" style="width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:none; font-size:0.82rem; font-weight:600; cursor:pointer; border-radius:6px;">Last 6 Months</button>
                            <button type="button" class="dash-date-opt ${activeFilter === 'THIS_MONTH' ? 'active' : ''}" data-filter="THIS_MONTH" style="width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:none; font-size:0.82rem; font-weight:600; cursor:pointer; border-radius:6px;">This Month</button>
                            <button type="button" class="dash-date-opt ${activeFilter === 'LAST_30_DAYS' ? 'active' : ''}" data-filter="LAST_30_DAYS" style="width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:none; font-size:0.82rem; font-weight:600; cursor:pointer; border-radius:6px;">Last 30 Days</button>
                            <button type="button" class="dash-date-opt ${activeFilter === 'THIS_YEAR' ? 'active' : ''}" data-filter="THIS_YEAR" style="width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:none; font-size:0.82rem; font-weight:600; cursor:pointer; border-radius:6px;">This Year</button>
                            <button type="button" class="dash-date-opt ${activeFilter === 'ALL_TIME' ? 'active' : ''}" data-filter="ALL_TIME" style="width:100%; text-align:left; padding:0.5rem 0.75rem; border:none; background:none; font-size:0.82rem; font-weight:600; cursor:pointer; border-radius:6px;">All Time Records</button>
                        </div>
                    </div>

                    <!-- Quick Shortcuts -->
                    <a href="#/invoices/customer" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight:700; padding:0.5rem 1rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        New Invoice
                    </a>
                </div>
            </div>

            <!-- 8 EXPERT ANALYTICAL KPI METRIC TILES -->
            <div class="dash-kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                
                <!-- 1. Total Gross Revenue -->
                <div class="dash-kpi-card" style="background:#ffffff; border-radius:14px; padding:1.25rem; border:1px solid var(--border-color); box-shadow:var(--shadow-float); position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Gross Revenue</div>
                        <span style="width:30px; height:30px; border-radius:8px; background:rgba(225,29,72,0.1); color:#e11d48; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.95rem;">${getAppCurrencySymbol() || '$'}</span>
                    </div>
                    <div class="dash-kpi-value" id="kpi-revenue" style="font-size:1.65rem; font-weight:800; color:var(--text-primary); line-height:1.15;">...</div>
                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.4rem; font-size:0.78rem;">
                        <span style="color:#059669; font-weight:700;">▲ Active Trend</span>
                        <span style="color:var(--text-muted);">&bull; Total billed sales</span>
                    </div>
                    <!-- Sparkline Wave -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 45" preserveAspectRatio="none" style="width:100%; height:32px; margin-top:0.4rem;">
                        <defs>
                            <linearGradient id="grad-rev-dash" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#e11d48" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#e11d48" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,32 Q30,12 60,26 T120,16 T180,28 T240,10 L240,45 L0,45 Z" fill="url(#grad-rev-dash)"/>
                        <path d="M0,32 Q30,12 60,26 T120,16 T180,28 T240,10" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 2. Total Net Profit & Margin -->
                <div class="dash-kpi-card" style="background:#ffffff; border-radius:14px; padding:1.25rem; border:1px solid var(--border-color); box-shadow:var(--shadow-float); position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Net Gross Profit</div>
                        <span style="width:30px; height:30px; border-radius:8px; background:rgba(16,185,129,0.1); color:#059669; display:flex; align-items:center; justify-content:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        </span>
                    </div>
                    <div class="dash-kpi-value" id="kpi-profit" style="font-size:1.65rem; font-weight:800; color:#059669; line-height:1.15;">...</div>
                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.4rem; font-size:0.78rem;">
                        <span id="kpi-margin-pct" style="color:#059669; font-weight:700;">0% Margin</span>
                        <span style="color:var(--text-muted);">&bull; Revenue minus COGS</span>
                    </div>
                    <!-- Sparkline Wave -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 45" preserveAspectRatio="none" style="width:100%; height:32px; margin-top:0.4rem;">
                        <defs>
                            <linearGradient id="grad-profit-dash" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,35 Q30,18 60,30 T120,15 T180,24 T240,8 L240,45 L0,45 Z" fill="url(#grad-profit-dash)"/>
                        <path d="M0,35 Q30,18 60,30 T120,15 T180,24 T240,8" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 3. Total Invoices & AOV -->
                <div class="dash-kpi-card" style="background:#ffffff; border-radius:14px; padding:1.25rem; border:1px solid var(--border-color); box-shadow:var(--shadow-float); position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Orders & Invoices</div>
                        <span style="width:30px; height:30px; border-radius:8px; background:rgba(59,130,246,0.1); color:#2563eb; display:flex; align-items:center; justify-content:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        </span>
                    </div>
                    <div class="dash-kpi-value" id="kpi-orders" style="font-size:1.65rem; font-weight:800; color:var(--text-primary); line-height:1.15;">...</div>
                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.4rem; font-size:0.78rem;">
                        <span id="kpi-aov-val" style="color:#2563eb; font-weight:700;">AOV: $0</span>
                        <span style="color:var(--text-muted);">&bull; Avg order value</span>
                    </div>
                    <!-- Sparkline Wave -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 45" preserveAspectRatio="none" style="width:100%; height:32px; margin-top:0.4rem;">
                        <defs>
                            <linearGradient id="grad-ord-dash" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,30 Q35,16 70,28 T140,14 T210,22 T240,10 L240,45 L0,45 Z" fill="url(#grad-ord-dash)"/>
                        <path d="M0,30 Q35,16 70,28 T140,14 T210,22 T240,10" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

                <!-- 4. Inventory Valuation (Asset Worth) -->
                <div class="dash-kpi-card" style="background:#ffffff; border-radius:14px; padding:1.25rem; border:1px solid var(--border-color); box-shadow:var(--shadow-float); position:relative; overflow:hidden;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
                        <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">Stock Asset Valuation</div>
                        <span style="width:30px; height:30px; border-radius:8px; background:rgba(139,92,246,0.1); color:#7c3aed; display:flex; align-items:center; justify-content:center;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                        </span>
                    </div>
                    <div class="dash-kpi-value" id="kpi-inventory-val" style="font-size:1.65rem; font-weight:800; color:var(--text-primary); line-height:1.15;">...</div>
                    <div style="display:flex; align-items:center; gap:0.35rem; margin-top:0.4rem; font-size:0.78rem;">
                        <span id="kpi-sku-count" style="color:#7c3aed; font-weight:700;">0 SKUs Active</span>
                        <span style="color:var(--text-muted);">&bull; Total stock cost</span>
                    </div>
                    <!-- Sparkline Wave -->
                    <svg class="dash-sparkline-svg" viewBox="0 0 240 45" preserveAspectRatio="none" style="width:100%; height:32px; margin-top:0.4rem;">
                        <defs>
                            <linearGradient id="grad-purp-dash" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.25"/>
                                <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.0"/>
                            </linearGradient>
                        </defs>
                        <path d="M0,38 Q40,25 80,34 T160,16 T240,12 L240,45 L0,45 Z" fill="url(#grad-purp-dash)"/>
                        <path d="M0,38 Q40,25 80,34 T160,16 T240,12" fill="none" stroke="#8b5cf6" stroke-width="2.5" stroke-linecap="round"/>
                    </svg>
                </div>

            </div>

            <!-- DUAL MACRO INTELLIGENCE CHARTS (ROW 2) -->
            <div class="dash-charts-grid" style="display:grid; grid-template-columns:minmax(0, 1.6fr) minmax(0, 1fr); gap:1.5rem; align-items:start;">
                
                <!-- CHART 1: INTERACTIVE REVENUE VS PROFIT VS COGS WAVE AREA GRAPH -->
                <div class="dash-card" style="background:#ffffff; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float); padding:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
                        <div>
                            <h3 style="margin:0 0 0.2rem 0; font-size:1.2rem; font-weight:800; color:var(--text-primary);">Macro Financial Trajectory</h3>
                            <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Multi-series comparison of Gross Revenue, Net Profit, and COGS</p>
                        </div>

                        <!-- Chart Series Toggles -->
                        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.78rem; font-weight:700;">
                            <span style="display:inline-flex; align-items:center; gap:0.35rem; color:#e11d48;">
                                <span style="width:8px; height:8px; border-radius:50%; background:#e11d48;"></span> Revenue
                            </span>
                            <span style="display:inline-flex; align-items:center; gap:0.35rem; color:#10b981;">
                                <span style="width:8px; height:8px; border-radius:50%; background:#10b981;"></span> Net Profit
                            </span>
                            <span style="display:inline-flex; align-items:center; gap:0.35rem; color:#64748b;">
                                <span style="width:8px; height:8px; border-radius:50%; background:#64748b;"></span> COGS (Cost)
                            </span>
                        </div>
                    </div>

                    <!-- SVG Chart Container -->
                    <div class="dash-svg-chart-container" id="dash-sales-chart-container" style="position:relative; width:100%; background:var(--surface-50); border-radius:12px; border:1px solid var(--border-color); padding:1rem 0.5rem;">
                        <svg class="dash-svg-chart" id="dash-sales-svg" viewBox="0 0 680 240" preserveAspectRatio="none" style="width:100%; height:240px; display:block; overflow:visible;">
                            <defs>
                                <linearGradient id="chartRevGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#e11d48" stop-opacity="0.35"/>
                                    <stop offset="100%" stop-color="#e11d48" stop-opacity="0.01"/>
                                </linearGradient>
                                <linearGradient id="chartProfitGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
                                    <stop offset="100%" stop-color="#10b981" stop-opacity="0.01"/>
                                </linearGradient>
                            </defs>

                            <!-- Horizontal Grid Lines -->
                            <g stroke="rgba(0,0,0,0.06)" stroke-width="1.2" stroke-dasharray="4 4">
                                <line x1="55" y1="20" x2="660" y2="20" />
                                <line x1="55" y1="65" x2="660" y2="65" />
                                <line x1="55" y1="110" x2="660" y2="110" />
                                <line x1="55" y1="155" x2="660" y2="155" />
                                <line x1="55" y1="200" x2="660" y2="200" stroke-dasharray="0" stroke="rgba(0,0,0,0.12)" />
                            </g>

                            <!-- Y-Axis Labels -->
                            <g fill="#94a3b8" font-size="11" font-weight="600" text-anchor="end">
                                <text x="45" y="24" id="chart-y-4">40K</text>
                                <text x="45" y="69" id="chart-y-3">30K</text>
                                <text x="45" y="114" id="chart-y-2">20K</text>
                                <text x="45" y="159" id="chart-y-1">10K</text>
                                <text x="45" y="204">0</text>
                            </g>

                            <!-- Area and Line Paths -->
                            <path id="chart-revenue-area" d="" fill="url(#chartRevGrad)" />
                            <path id="chart-profit-area" d="" fill="url(#chartProfitGrad)" />
                            <path id="chart-revenue-line" d="" fill="none" stroke="#e11d48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                            <path id="chart-profit-line" d="" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            <path id="chart-cost-line" d="" fill="none" stroke="#64748b" stroke-width="1.8" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" />

                            <!-- Interactive Coordinate Circles -->
                            <g id="chart-data-dots"></g>

                            <!-- Hover Guide Line -->
                            <line id="chart-hover-line" x1="0" y1="20" x2="0" y2="200" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="3 3" opacity="0" />

                            <!-- X-Axis Labels -->
                            <g id="chart-x-labels" fill="#64748b" font-size="12" font-weight="600" text-anchor="middle"></g>
                        </svg>

                        <!-- Floating Glass Tooltip -->
                        <div class="dash-chart-tooltip" id="dash-chart-tooltip" style="display:none; position:absolute; transform:translate(-50%, -115%); background:rgba(15,23,42,0.92); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); color:#ffffff; padding:0.6rem 0.85rem; border-radius:8px; font-size:0.78rem; pointer-events:none; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:50;">
                            <div class="tooltip-month" id="tooltip-month-text" style="font-weight:700; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:0.25rem; margin-bottom:0.35rem;">Month</div>
                            <div class="tooltip-row" style="display:flex; justify-content:space-between; gap:0.75rem; margin-bottom:0.2rem;">
                                <span style="color:#fda4af;">Revenue:</span>
                                <strong id="tooltip-rev-text" style="color:#ffffff;">$0</strong>
                            </div>
                            <div class="tooltip-row" style="display:flex; justify-content:space-between; gap:0.75rem; margin-bottom:0.2rem;">
                                <span style="color:#6ee7b7;">Profit:</span>
                                <strong id="tooltip-profit-text" style="color:#ffffff;">$0</strong>
                            </div>
                            <div class="tooltip-row" style="display:flex; justify-content:space-between; gap:0.75rem;">
                                <span style="color:#94a3b8;">Orders:</span>
                                <strong id="tooltip-ord-text" style="color:#ffffff;">0</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- CHART 2: ORDER STATUS & REVENUE DISTRIBUTION DONUT -->
                <div class="dash-card" style="background:#ffffff; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float); padding:1.5rem;">
                    <div style="margin-bottom:1.25rem;">
                        <h3 style="margin:0 0 0.2rem 0; font-size:1.2rem; font-weight:800; color:var(--text-primary);">Order & Cash Status</h3>
                        <p style="margin:0; font-size:0.82rem; color:var(--text-secondary);">Fulfillment health and payment completion</p>
                    </div>

                    <div class="dash-donut-layout" style="display:flex; align-items:center; gap:1.25rem; justify-content:space-around;">
                        <!-- SVG Donut -->
                        <div class="dash-donut-graphic-wrap" style="position:relative; width:150px; height:150px; flex-shrink:0;">
                            <svg viewBox="0 0 160 160" width="150" height="150">
                                <circle cx="80" cy="80" r="58" fill="none" stroke="#f1f5f9" stroke-width="18"/>
                                <g id="donut-segments"></g>
                            </svg>
                            <div class="dash-donut-center-text" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                                <div class="dash-donut-center-num" id="donut-total-count" style="font-size:1.45rem; font-weight:800; color:var(--text-primary); line-height:1;">0</div>
                                <div class="dash-donut-center-sub" style="font-size:0.72rem; color:var(--text-muted); font-weight:600; margin-top:2px;">Orders</div>
                            </div>
                        </div>

                        <!-- Breakdown List -->
                        <div class="dash-donut-breakdown-list" id="donut-breakdown-list" style="flex:1; display:flex; flex-direction:column; gap:0.5rem;">
                            <!-- Populated dynamically via JS -->
                        </div>
                    </div>

                    <!-- Cash Flow Collection Bar -->
                    <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem; font-size:0.82rem;">
                            <span style="font-weight:700; color:var(--text-primary);">Collection Efficiency</span>
                            <span id="dash-collection-pct" style="font-weight:800; color:#059669;">0% Paid</span>
                        </div>
                        <div class="perf-bar-wrap" style="height:8px;">
                            <div class="perf-bar-fill" id="dash-collection-bar" style="width:0%;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;">
                            <span id="dash-paid-collected">Collected: $0</span>
                            <span id="dash-due-receivable" style="color:#d97706;">Due: $0</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- DEEP ANALYTICAL RANKING MATRICES (ROW 3) -->
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem; align-items:start;">
                
                <!-- 1. TOP PERFORMING PRODUCTS -->
                <div class="dash-card" style="background:#ffffff; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float); padding:0; overflow:hidden;">
                    <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 style="margin:0 0 0.15rem 0; font-size:1.15rem; font-weight:800;">⭐ Top Performing Products</h3>
                            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Highest revenue & gross profit contributors</p>
                        </div>
                        <a href="#/products" class="btn btn-sm btn-secondary" style="font-size:0.78rem; padding:0.25rem 0.65rem;">View All</a>
                    </div>
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                            <thead>
                                <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                    <th style="padding:0.65rem 1rem;">Product</th>
                                    <th style="padding:0.65rem; text-align:center;">Sold</th>
                                    <th style="padding:0.65rem; text-align:right;">Revenue</th>
                                    <th style="padding:0.65rem 1rem; text-align:right;">Profit</th>
                                </tr>
                            </thead>
                            <tbody id="dash-top-products-tbody">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 2. TOP VIP CUSTOMERS -->
                <div class="dash-card" style="background:#ffffff; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float); padding:0; overflow:hidden;">
                    <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 style="margin:0 0 0.15rem 0; font-size:1.15rem; font-weight:800;">👑 VIP Buyers Leaderboard</h3>
                            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Top accounts by cumulative spend</p>
                        </div>
                        <a href="#/customers" class="btn btn-sm btn-secondary" style="font-size:0.78rem; padding:0.25rem 0.65rem;">View People</a>
                    </div>
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                            <thead>
                                <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                    <th style="padding:0.65rem 1rem;">Customer / Client</th>
                                    <th style="padding:0.65rem; text-align:center;">Orders</th>
                                    <th style="padding:0.65rem 1rem; text-align:right;">Total Spent</th>
                                </tr>
                            </thead>
                            <tbody id="dash-vip-customers-tbody">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- 3. RECENT INVOICES WITH 1-CLICK PERFORMANCE PREVIEW -->
                <div class="dash-card" style="background:#ffffff; border-radius:var(--radius-card); border:1px solid var(--border-color); box-shadow:var(--shadow-float); padding:0; overflow:hidden;">
                    <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 style="margin:0 0 0.15rem 0; font-size:1.15rem; font-weight:800;">🧾 Recent Invoices Stream</h3>
                            <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Latest sales & performance</p>
                        </div>
                        <a href="#/invoices/customer" class="btn btn-sm btn-secondary" style="font-size:0.78rem; padding:0.25rem 0.65rem;">View Invoices</a>
                    </div>
                    <div class="table-container">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                            <thead>
                                <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                    <th style="padding:0.65rem 1rem;">Invoice #</th>
                                    <th style="padding:0.65rem;">Client</th>
                                    <th style="padding:0.65rem;">Total</th>
                                    <th style="padding:0.65rem 1rem; text-align:right;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="dash-recent-invoices-tbody">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
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
            const isOpen = dateDropdown.style.display === 'block';
            dateDropdown.style.display = isOpen ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            dateDropdown.style.display = 'none';
        });

        dateDropdown.querySelectorAll('.dash-date-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                const f = opt.getAttribute('data-filter');
                activeFilter = f;
                currentRange = calculateRange(f);
                if (activeRangeLabel) activeRangeLabel.textContent = currentRange.label;
                dateDropdown.querySelectorAll('.dash-date-opt').forEach(o => o.classList.toggle('active', o === opt));
                dateDropdown.style.display = 'none';
                computeAndRenderDashboard();
            });
        });
    }

    if (!workspaceId) return;

    let cachedProducts = [];
    let cachedCustInvoices = [];
    let cachedBusInvoices = [];
    let cachedCategories = [];
    let cachedCustomers = [];

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

        // 1. Calculate Comprehensive Analytical KPIs
        let totalRevenue = 0;
        let totalProfit = 0;
        let totalCOGS = 0;
        let paidRevenue = 0;
        let dueRevenue = 0;
        const productSalesAgg = {}; // productId -> { name, category, units, revenue, profit }
        const customerAgg = {}; // key -> { name, contact, orders, totalSpent }

        filteredInvoices.forEach(inv => {
            const grandTotal = Number(inv.totalPrice || inv.grandTotal || 0);
            totalRevenue += grandTotal;

            const isPaid = (inv.status || 'PAID').toUpperCase() === 'PAID';
            if (isPaid) paidRevenue += grandTotal;
            else dueRevenue += grandTotal;

            // Compute invoice profit
            let invProfit = 0;
            let invCost = 0;

            if (inv.items && Array.isArray(inv.items)) {
                inv.items.forEach(item => {
                    const qty = Number(item.quantity) || 1;
                    const uPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                    const uCost = Number(item.unitCost || 0);
                    const lineRev = Number(item.totalPrice) || (qty * uPrice);
                    const lineCost = qty * uCost;
                    const lineProfit = (item.itemProfit !== undefined && item.itemProfit !== null)
                        ? Number(item.itemProfit)
                        : (lineRev - lineCost);

                    invCost += lineCost;
                    invProfit += lineProfit;

                    const pKey = String(item.productId || item.productName || 'General');
                    if (!productSalesAgg[pKey]) {
                        productSalesAgg[pKey] = {
                            id: item.productId,
                            name: item.name || item.productName || 'Product',
                            category: item.category || 'General',
                            units: 0,
                            revenue: 0,
                            profit: 0
                        };
                    }
                    productSalesAgg[pKey].units += qty;
                    productSalesAgg[pKey].revenue += lineRev;
                    productSalesAgg[pKey].profit += lineProfit;
                });
            }

            if (inv.totalProfit !== undefined && inv.totalProfit !== null && !isNaN(inv.totalProfit)) {
                invProfit = Number(inv.totalProfit);
            }

            totalProfit += invProfit;
            totalCOGS += invCost;

            // Customer aggregation
            const cName = inv.customerName || inv.clientName || inv.businessName || 'Walk-in Customer';
            const cContact = inv.customerNumber || inv.clientPhone || inv.clientEmail || '';
            const cKey = (cName + '_' + cContact).toLowerCase();

            if (!customerAgg[cKey]) {
                customerAgg[cKey] = {
                    name: cName,
                    contact: cContact,
                    orders: 0,
                    totalSpent: 0
                };
            }
            customerAgg[cKey].orders += 1;
            customerAgg[cKey].totalSpent += grandTotal;
        });

        const totalOrders = filteredInvoices.length;
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
        const netMarginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100) : 0;

        // Inventory valuation
        let totalInventoryValuation = 0;
        cachedProducts.forEach(p => {
            const qty = Number(p.quantity || 0);
            const cost = Number(p.price || 0);
            totalInventoryValuation += (qty * cost);
        });

        // Populate Top KPIs with smooth animation
        animateNumber(container.querySelector('#kpi-revenue'), totalRevenue, true, 800);
        animateNumber(container.querySelector('#kpi-profit'), totalProfit, true, 800);
        animateNumber(container.querySelector('#kpi-orders'), totalOrders, false, 700);
        animateNumber(container.querySelector('#kpi-inventory-val'), totalInventoryValuation, true, 700);

        const marginLabel = container.querySelector('#kpi-margin-pct');
        if (marginLabel) marginLabel.textContent = `${Math.round(netMarginPct)}% Net Margin`;

        const aovLabel = container.querySelector('#kpi-aov-val');
        if (aovLabel) aovLabel.textContent = `AOV: ${formatCurr(avgOrderValue)}`;

        const skuCountLabel = container.querySelector('#kpi-sku-count');
        if (skuCountLabel) skuCountLabel.textContent = `${cachedProducts.length} SKUs Active`;

        // Collection efficiency
        const collectionPct = totalRevenue > 0 ? Math.round((paidRevenue / totalRevenue) * 100) : 100;
        const colPctEl = container.querySelector('#dash-collection-pct');
        const colBarEl = container.querySelector('#dash-collection-bar');
        const colPaidEl = container.querySelector('#dash-paid-collected');
        const colDueEl = container.querySelector('#dash-due-receivable');

        if (colPctEl) colPctEl.textContent = `${collectionPct}% Collected`;
        if (colBarEl) colBarEl.style.width = `${collectionPct}%`;
        if (colPaidEl) colPaidEl.textContent = `Paid: ${formatCurr(paidRevenue)}`;
        if (colDueEl) colDueEl.textContent = `Due: ${formatCurr(dueRevenue)}`;

        // =========================================================================
        // 2. Multi-Series Area Chart Generator (Last 6 Months)
        // =========================================================================
        const monthData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mIdx = d.getMonth();
            const y = d.getFullYear();
            const mName = getMonthNameShort(mIdx);

            const mStart = new Date(y, mIdx, 1, 0, 0, 0, 0).getTime();
            const mEnd = new Date(y, mIdx + 1, 0, 23, 59, 59, 999).getTime();

            const mInvoices = allInvoices.filter(inv => {
                const t = getInvoiceTime(inv);
                return t >= mStart && t <= mEnd;
            });

            let mRev = 0;
            let mProfit = 0;
            let mCost = 0;

            mInvoices.forEach(inv => {
                const gTot = Number(inv.totalPrice || inv.grandTotal || 0);
                mRev += gTot;

                let p = 0;
                let c = 0;
                if (inv.items && Array.isArray(inv.items)) {
                    inv.items.forEach(item => {
                        const qty = Number(item.quantity) || 1;
                        const uPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const uCost = Number(item.unitCost || 0);
                        const lRev = Number(item.totalPrice) || (qty * uPrice);
                        const lCost = qty * uCost;
                        c += lCost;
                        p += (item.itemProfit !== undefined && item.itemProfit !== null) ? Number(item.itemProfit) : (lRev - lCost);
                    });
                }
                if (inv.totalProfit !== undefined && inv.totalProfit !== null && !isNaN(inv.totalProfit)) {
                    p = Number(inv.totalProfit);
                }
                mProfit += p;
                mCost += c;
            });

            monthData.push({
                month: mName,
                revenue: mRev,
                profit: mProfit,
                cost: mCost,
                orders: mInvoices.length
            });
        }

        const svgW = 680;
        const svgH = 240;
        const padL = 70;
        const padR = 640;
        const padT = 25;
        const padB = 200;

        const maxVal = Math.max(...monthData.map(d => Math.max(d.revenue, d.profit, d.cost)), 5000);
        const ceilingVal = Math.ceil(maxVal / 10000) * 10000 || 50000;

        // Update Y-Axis labels
        const y4 = container.querySelector('#chart-y-4');
        const y3 = container.querySelector('#chart-y-3');
        const y2 = container.querySelector('#chart-y-2');
        const y1 = container.querySelector('#chart-y-1');

        if (y4) y4.textContent = (ceilingVal >= 1000 ? (ceilingVal / 1000) + 'K' : ceilingVal);
        if (y3) y3.textContent = (ceilingVal >= 1000 ? ((ceilingVal * 0.75) / 1000) + 'K' : Math.round(ceilingVal * 0.75));
        if (y2) y2.textContent = (ceilingVal >= 1000 ? ((ceilingVal * 0.5) / 1000) + 'K' : Math.round(ceilingVal * 0.5));
        if (y1) y1.textContent = (ceilingVal >= 1000 ? ((ceilingVal * 0.25) / 1000) + 'K' : Math.round(ceilingVal * 0.25));

        const pointsRev = [];
        const pointsProfit = [];
        const pointsCost = [];
        const stepX = (padR - padL) / (monthData.length - 1 || 1);

        monthData.forEach((d, i) => {
            const x = padL + i * stepX;
            const yRev = padB - (d.revenue / ceilingVal) * (padB - padT);
            const yProfit = padB - (d.profit / ceilingVal) * (padB - padT);
            const yCost = padB - (d.cost / ceilingVal) * (padB - padT);
            pointsRev.push({ x, y: yRev, raw: d.revenue, month: d.month });
            pointsProfit.push({ x, y: yProfit, raw: d.profit, month: d.month });
            pointsCost.push({ x, y: yCost, raw: d.cost, month: d.month });
        });

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
        const profitLinePath = getSvgPath(pointsProfit);
        const costLinePath = getSvgPath(pointsCost);

        const revAreaPath = `${revLinePath} L ${pointsRev[pointsRev.length - 1].x},${padB} L ${pointsRev[0].x},${padB} Z`;
        const profitAreaPath = `${profitLinePath} L ${pointsProfit[pointsProfit.length - 1].x},${padB} L ${pointsProfit[0].x},${padB} Z`;

        const elRevArea = container.querySelector('#chart-revenue-area');
        const elProfitArea = container.querySelector('#chart-profit-area');
        const elRevLine = container.querySelector('#chart-revenue-line');
        const elProfitLine = container.querySelector('#chart-profit-line');
        const elCostLine = container.querySelector('#chart-cost-line');
        const elXLabels = container.querySelector('#chart-x-labels');
        const elDataDots = container.querySelector('#chart-data-dots');

        if (elRevArea) elRevArea.setAttribute('d', revAreaPath);
        if (elProfitArea) elProfitArea.setAttribute('d', profitAreaPath);
        if (elRevLine) elRevLine.setAttribute('d', revLinePath);
        if (elProfitLine) elProfitLine.setAttribute('d', profitLinePath);
        if (elCostLine) elCostLine.setAttribute('d', costLinePath);

        if (elXLabels) {
            elXLabels.innerHTML = monthData.map((d, i) => {
                const x = padL + i * stepX;
                return `<text x="${x}" y="222">${d.month}</text>`;
            }).join('');
        }

        if (elDataDots) {
            elDataDots.innerHTML = pointsRev.map((pt, i) => `
                <circle cx="${pt.x}" cy="${pt.y}" r="4.5" fill="#ffffff" stroke="#e11d48" stroke-width="2.5" />
                <circle cx="${pointsProfit[i].x}" cy="${pointsProfit[i].y}" r="4" fill="#ffffff" stroke="#10b981" stroke-width="2.2" />
            `).join('');
        }

        // Chart Tooltip Hover
        const chartSvg = container.querySelector('#dash-sales-svg');
        const hoverLine = container.querySelector('#chart-hover-line');
        const tooltip = container.querySelector('#dash-chart-tooltip');
        const tooltipMonth = container.querySelector('#tooltip-month-text');
        const tooltipRev = container.querySelector('#tooltip-rev-text');
        const tooltipProfit = container.querySelector('#tooltip-profit-text');
        const tooltipOrd = container.querySelector('#tooltip-ord-text');

        if (chartSvg && tooltip && hoverLine) {
            chartSvg.addEventListener('mousemove', (e) => {
                const rect = chartSvg.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) / rect.width) * svgW;

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
                const d = monthData[closestIdx];

                hoverLine.setAttribute('x1', ptRev.x);
                hoverLine.setAttribute('x2', ptRev.x);
                hoverLine.setAttribute('opacity', '1');

                const tooltipLeft = (ptRev.x / svgW) * 100;
                const tooltipTop = (ptRev.y / svgH) * 100;

                tooltip.style.left = `${tooltipLeft}%`;
                tooltip.style.top = `${tooltipTop}%`;
                tooltip.style.display = 'block';

                if (tooltipMonth) tooltipMonth.textContent = d.month;
                if (tooltipRev) tooltipRev.textContent = formatCurr(d.revenue);
                if (tooltipProfit) tooltipProfit.textContent = `+${formatCurr(d.profit)}`;
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
            Paid: 0,
            Pending: 0,
            Processing: 0,
            Cancelled: 0
        };

        filteredInvoices.forEach(inv => {
            const rawStatus = (inv.status || '').toUpperCase();
            if (rawStatus === 'PAID' || rawStatus === 'COMPLETED') statusCounts.Paid++;
            else if (rawStatus === 'PROCESSING') statusCounts.Processing++;
            else if (rawStatus === 'CANCELLED' || rawStatus === 'VOID') statusCounts.Cancelled++;
            else statusCounts.Pending++;
        });

        const totalCount = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        const effectiveTotal = totalCount > 0 ? totalCount : 1;

        const statusColors = {
            Paid: '#10b981',
            Pending: '#f59e0b',
            Processing: '#3b82f6',
            Cancelled: '#ef4444'
        };

        const donutSegmentsEl = container.querySelector('#donut-segments');
        const donutTotalCountEl = container.querySelector('#donut-total-count');
        const donutBreakdownListEl = container.querySelector('#donut-breakdown-list');

        if (donutTotalCountEl) donutTotalCountEl.textContent = totalCount;

        if (donutSegmentsEl && donutBreakdownListEl) {
            const r = 58;
            const circumference = 2 * Math.PI * r;
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

            donutBreakdownListEl.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
                const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0';
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;">
                        <div style="display:flex; align-items:center; gap:0.4rem;">
                            <span style="width:8px; height:8px; border-radius:50%; background:${statusColors[status]};"></span>
                            <span style="color:var(--text-primary); font-weight:600;">${status}</span>
                        </div>
                        <div>
                            <strong style="color:var(--text-primary);">${count}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:4px;">(${pct}%)</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // =========================================================================
        // 4. Matrix 1: Top Performing Products
        // =========================================================================
        const topProductsTbody = container.querySelector('#dash-top-products-tbody');
        if (topProductsTbody) {
            const topProducts = Object.values(productSalesAgg)
                .sort((a, b) => b.revenue - a.revenue || b.profit - a.profit)
                .slice(0, 5);

            if (topProducts.length === 0) {
                topProductsTbody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No sales recorded in this period.</td></tr>`;
            } else {
                topProductsTbody.innerHTML = topProducts.map(p => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:0.65rem 1rem;">
                            <strong style="color:var(--text-primary);">${p.name}</strong>
                            <div style="font-size:0.72rem; color:var(--text-muted);">${p.category}</div>
                        </td>
                        <td style="padding:0.65rem; text-align:center; font-weight:700; color:#e11d48;">${p.units}</td>
                        <td style="padding:0.65rem; text-align:right; font-weight:700;">${formatCurr(p.revenue)}</td>
                        <td style="padding:0.65rem 1rem; text-align:right; font-weight:700; color:#059669;">+${formatCurr(p.profit)}</td>
                    </tr>
                `).join('');
            }
        }

        // =========================================================================
        // 5. Matrix 2: VIP Buyers Leaderboard
        // =========================================================================
        const vipCustomersTbody = container.querySelector('#dash-vip-customers-tbody');
        if (vipCustomersTbody) {
            const topBuyers = Object.values(customerAgg)
                .sort((a, b) => b.totalSpent - a.totalSpent || b.orders - a.orders)
                .slice(0, 5);

            if (topBuyers.length === 0) {
                vipCustomersTbody.innerHTML = `<tr><td colspan="3" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No buyers recorded in this period.</td></tr>`;
            } else {
                vipCustomersTbody.innerHTML = topBuyers.map((c, idx) => `
                    <tr style="border-bottom:1px solid var(--border-color);">
                        <td style="padding:0.65rem 1rem;">
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <span style="width:24px; height:24px; border-radius:50%; background:${idx === 0 ? '#fbbf24' : 'var(--surface-200)'}; color:${idx === 0 ? '#ffffff' : 'var(--text-primary)'}; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:800;">
                                    ${idx === 0 ? '👑' : (idx + 1)}
                                </span>
                                <div>
                                    <strong style="color:var(--text-primary);">${c.name}</strong>
                                    <div style="font-size:0.72rem; color:var(--text-muted);">${c.contact || 'Direct buyer'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="padding:0.65rem; text-align:center; font-weight:700;">${c.orders}</td>
                        <td style="padding:0.65rem 1rem; text-align:right; font-weight:800; color:#e11d48;">${formatCurr(c.totalSpent)}</td>
                    </tr>
                `).join('');
            }
        }

        // =========================================================================
        // 6. Matrix 3: Recent Invoices Stream with 1-Click Viewer
        // =========================================================================
        const recentInvsTbody = container.querySelector('#dash-recent-invoices-tbody');
        if (recentInvsTbody) {
            const recentInvoices = [...allInvoices]
                .sort((a, b) => getInvoiceTime(b) - getInvoiceTime(a))
                .slice(0, 5);

            if (recentInvoices.length === 0) {
                recentInvsTbody.innerHTML = `<tr><td colspan="4" style="padding:1.5rem; text-align:center; color:var(--text-muted);">No invoices created yet.</td></tr>`;
            } else {
                recentInvsTbody.innerHTML = recentInvoices.map(inv => {
                    const isPaid = (inv.status || 'PAID').toUpperCase() === 'PAID';
                    const displayNum = inv.busInvNumber || inv.invoiceNumber || inv.uniqueId || 'INV';
                    const cName = inv.customerName || inv.clientName || inv.businessName || 'Customer';

                    return `
                        <tr style="border-bottom:1px solid var(--border-color);">
                            <td style="padding:0.65rem 1rem;">
                                <code style="font-weight:700; color:var(--text-primary); font-size:0.78rem;">${displayNum}</code>
                            </td>
                            <td style="padding:0.65rem;">
                                <div style="font-weight:600; color:var(--text-primary); max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cName}</div>
                            </td>
                            <td style="padding:0.65rem; font-weight:700;">${formatCurr(inv.totalPrice || inv.grandTotal || 0)}</td>
                            <td style="padding:0.65rem 1rem; text-align:right;">
                                <button type="button" class="btn btn-sm btn-primary view-dash-inv-btn" data-invid="${inv.id}" style="padding:0.2rem 0.55rem; font-size:0.75rem; font-weight:700;">
                                    View
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                recentInvsTbody.querySelectorAll('.view-dash-inv-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target.getAttribute('data-invid');
                        const matched = allInvoices.find(i => i.id === id);
                        if (matched) {
                            openInvoiceViewerModal(matched);
                        }
                    });
                });
            }
        }
    };

    // Parallel fetch all data
    try {
        const [prods, cats, custInvs, busInvs, customers] = await Promise.all([
            getProductService(workspaceId).getAllActiveProducts().catch(() => []),
            getCategoryService(workspaceId).getAllCategories().catch(() => []),
            getInvoiceService(workspaceId).getAllInvoices(false).catch(() => []),
            getInvoiceService(workspaceId).getAllInvoices(true).catch(() => []),
            getPeopleService(workspaceId).getAllCustomers().catch(() => [])
        ]);

        cachedProducts = prods;
        cachedCategories = cats;
        cachedCustInvoices = custInvs;
        cachedBusInvoices = busInvs;
        cachedCustomers = customers;

        computeAndRenderDashboard();
    } catch (err) {
        console.error("Dashboard calculation error:", err);
        showAlert.error("Failed to load dashboard data.");
    }
};
