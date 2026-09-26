import { getProductService } from './services/productService.js';
import { getInvoiceService } from './services/invoiceService.js';
import { calculateInvoiceTotal } from './utils/invoiceCalculator.js';

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
    // Current date state
    const now = new Date();
    
    // Default range: This Month (1st of month to today, e.g. 1 Sep - 26 Sep)
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let activeFilter = 'THIS_MONTH'; // 'THIS_MONTH', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'LAST_MONTH', 'THIS_YEAR', 'ALL_TIME', 'CUSTOM'
    let currentRange = {
        start: defaultStart.getTime(),
        end: defaultEnd.getTime(),
        label: `1 ${getMonthNameShort(now.getMonth())} – ${now.getDate()} ${getMonthNameShort(now.getMonth())} ${now.getFullYear()}`
    };

    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
            <div>
                <h2 style="font-size: 1.85rem; color: var(--text-primary); margin-bottom: 0.35rem; font-weight: 700; letter-spacing: -0.02em;">Workspace Overview</h2>
                <p id="overview-subtitle" style="color: var(--text-secondary); margin: 0; font-size: 0.92rem;">
                    Showing data from <strong style="color: var(--primary);">${currentRange.label}</strong>
                </p>
            </div>
            <div class="module-actions" style="display: flex; gap: 0.75rem;">
                <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'">+ Add Customer Invoice</button>
            </div>
        </div>

        <!-- DATE RANGE SELECTOR TOOLBAR -->
        <div class="overview-filter-bar">
            <div class="date-preset-pills" id="overview-preset-pills">
                <button class="date-pill active" data-preset="THIS_MONTH" title="1st of current month to today">This Month (1st – Today)</button>
                <button class="date-pill" data-preset="TODAY">Today</button>
                <button class="date-pill" data-preset="YESTERDAY">Yesterday</button>
                <button class="date-pill" data-preset="THIS_WEEK">This Week</button>
                <button class="date-pill" data-preset="LAST_MONTH">Last Month</button>
                <button class="date-pill" data-preset="THIS_YEAR">This Year</button>
                <button class="date-pill" data-preset="ALL_TIME">All Time</button>
            </div>

            <button class="overview-date-btn" id="btn-custom-date-modal" title="Select specific day or custom date range">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span id="active-range-text">${currentRange.label}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
        </div>

        <!-- CUSTOM DATE RANGE & SPECIFIC DAY SELECTION MODAL -->
        <div class="overview-modal-backdrop" id="overview-custom-modal">
            <div class="overview-modal-card">
                <div class="overview-modal-header">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Select Date or Range</h3>
                    </div>
                    <button type="button" id="btn-close-date-modal" style="background:none; border:none; font-size:1.4rem; color:var(--text-muted); cursor:pointer;">&times;</button>
                </div>
                <div class="overview-modal-body">
                    <!-- Specific Single Day -->
                    <div style="margin-bottom: 1.25rem;">
                        <label style="display:block; font-weight:600; font-size:0.85rem; margin-bottom:0.4rem; color:var(--text-primary);">
                            Pick a Specific Day
                        </label>
                        <div style="display:flex; gap:0.5rem;">
                            <input type="date" id="modal-single-day" class="form-control" style="flex:1; padding:0.55rem 0.75rem;">
                            <button type="button" id="btn-apply-single-day" class="btn btn-secondary" style="font-size:0.85rem; padding:0.5rem 0.85rem;">Select Day</button>
                        </div>
                    </div>

                    <div style="display:flex; align-items:center; gap:0.75rem; margin:1.25rem 0; color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">
                        <div style="flex:1; height:1px; background:var(--border-color);"></div>
                        <span>OR CUSTOM RANGE</span>
                        <div style="flex:1; height:1px; background:var(--border-color);"></div>
                    </div>

                    <!-- Custom Range From / To -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; margin-bottom: 1.25rem;">
                        <div>
                            <label style="display:block; font-weight:600; font-size:0.82rem; margin-bottom:0.35rem; color:var(--text-primary);">From Date</label>
                            <input type="date" id="modal-range-from" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div>
                            <label style="display:block; font-weight:600; font-size:0.82rem; margin-bottom:0.35rem; color:var(--text-primary);">To Date</label>
                            <input type="date" id="modal-range-to" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>

                    <!-- Extra Quick Presets -->
                    <div>
                        <label style="display:block; font-weight:600; font-size:0.82rem; margin-bottom:0.4rem; color:var(--text-muted); text-transform:uppercase;">Additional Periods</label>
                        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                            <button type="button" class="btn btn-sm btn-secondary modal-quick-preset" data-days="7">Last 7 Days</button>
                            <button type="button" class="btn btn-sm btn-secondary modal-quick-preset" data-days="30">Last 30 Days</button>
                            <button type="button" class="btn btn-sm btn-secondary modal-quick-preset" data-days="90">Last 3 Months</button>
                            <button type="button" class="btn btn-sm btn-secondary modal-quick-preset" data-preset="LAST_YEAR">Last Year</button>
                        </div>
                    </div>
                </div>
                <div class="overview-modal-footer">
                    <button type="button" id="btn-cancel-date-modal" class="btn btn-secondary">Cancel</button>
                    <button type="button" id="btn-apply-range" class="btn btn-primary">Apply Range</button>
                </div>
            </div>
        </div>

        <!-- REVENUE LINE MEASUREMENT COMPONENT -->
        <div class="revenue-measure-card anim-fade-up anim-stagger-1">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                    <span class="live-indicator-dot"></span>
                    <div>
                        <h3 style="font-size: 1.1rem; color: var(--text-primary); margin: 0; font-weight: 600;">Revenue Flow & Collection Health</h3>
                        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">Live measurement of paid cashflow versus outstanding pending receivables in selected period</div>
                    </div>
                </div>
                <div id="revenue-measure-stats" style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                    <span class="skeleton-shimmer" style="width: 220px; height: 18px;"></span>
                </div>
            </div>

            <div class="revenue-bar-wrap">
                <div class="revenue-segmented-bar">
                    <div id="bar-received" class="segment-received" style="width: 0%;"></div>
                    <div id="bar-pending" class="segment-pending" style="width: 0%;"></div>
                </div>
                <div class="revenue-bar-legend">
                    <div style="display: flex; gap: 1.25rem; font-size: 0.82rem;">
                        <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                            Received Revenue: <strong id="legend-received-amt" style="color: var(--text-primary);">$0.00</strong>
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
                            Pending Invoices: <strong id="legend-pending-amt" style="color: var(--text-primary);">$0.00</strong>
                        </span>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">
                        Total Invoiced: <strong id="legend-total-sales" style="color: var(--text-primary);">$0.00</strong>
                    </div>
                </div>
            </div>
        </div>

        <!-- PRIMARY FINANCIAL METRICS (ELEVATED CARDS WITH SKELETON LOADERS) -->
        <div class="dashboard-grid anim-fade-up anim-stagger-2" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Total Sales -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Total Sales</h3>
                        <div class="stat-value" id="dash-total-sales" style="font-size: 2rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">
                            <span class="skeleton-shimmer" style="width: 120px; height: 32px;"></span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(225, 29, 72, 0.08); border-radius: 10px; color:var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Gross invoiced in selected period</div>
            </div>

            <!-- Revenue Received -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Revenue Received</h3>
                        <div class="stat-value" id="dash-revenue-received" style="font-size: 2rem; font-weight: 700; color: #059669; letter-spacing: -0.02em;">
                            <span class="skeleton-shimmer" style="width: 120px; height: 32px;"></span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(16, 185, 129, 0.08); border-radius: 10px; color:#059669;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Collected from paid invoices</div>
            </div>

            <!-- Revenue Pending -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid #f59e0b;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: #d97706; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Pending Invoices</h3>
                        <div class="stat-value" id="dash-revenue-pending" style="font-size: 2rem; font-weight: 700; color: #d97706; letter-spacing: -0.02em;">
                            <span class="skeleton-shimmer" style="width: 120px; height: 32px;"></span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(245, 158, 11, 0.08); border-radius: 10px; color:#d97706;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Awaiting customer/client payment</div>
            </div>

            <!-- Total Profit -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid #8b5cf6;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Total Profit</h3>
                        <div class="stat-value" id="dash-total-profit" style="font-size: 2rem; font-weight: 700; color: #7c3aed; letter-spacing: -0.02em;">
                            <span class="skeleton-shimmer" style="width: 120px; height: 32px;"></span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(139, 92, 246, 0.08); border-radius: 10px; color:#7c3aed;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Net profit from paid sales</div>
            </div>
        </div>

        <!-- SECONDARY COUNTERS -->
        <div class="anim-fade-up anim-stagger-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(225, 29, 72, 0.08); border-radius: 10px; color:var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Active Products</div>
                    <div id="dash-products" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);"><span class="skeleton-shimmer" style="width: 40px; height: 22px;"></span></div>
                </div>
            </div>
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; color:#059669;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Customer Invoices</div>
                    <div id="dash-cust-inv" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);"><span class="skeleton-shimmer" style="width: 40px; height: 22px;"></span></div>
                </div>
            </div>
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(245, 158, 11, 0.1); border-radius: 10px; color:#d97706;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Business Invoices</div>
                    <div id="dash-bus-inv" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);"><span class="skeleton-shimmer" style="width: 40px; height: 22px;"></span></div>
                </div>
            </div>
        </div>
        
        <!-- DATA ANALYTICS & REPORTS HUB (DATA CHECK PRO CARDS) -->
        <div class="anim-fade-up anim-stagger-4" style="margin-bottom: 2rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                <div>
                    <h3 style="margin:0; font-size:1.2rem; font-weight:700; color:var(--text-primary);">Data Check & Analytics Reports</h3>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Interactive business intelligence, historical trends, rankings, and financial breakdowns</p>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/analytics'" style="font-size:0.82rem; font-weight:600;">
                    Open Full Analytics Hub &rarr;
                </button>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/DATA_VIEW'" style="border-left: 4px solid #2196F3; padding:1.15rem;">
                    <div class="pro-card-icon" style="color:#2196F3; background:rgba(33,150,243,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Data Overview</h4>
                        <p style="font-size:0.78rem;">Catalog & creations count</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/CHART_VIEW'" style="border-left: 4px solid #3F51B5; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#3F51B5; background:rgba(63,81,181,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Analytics & Charts</h4>
                        <p style="font-size:0.78rem;">Interactive revenue graphs</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/DAILY_DATA'" style="border-left: 4px solid #009688; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#009688; background:rgba(0,150,136,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Daily Report</h4>
                        <p style="font-size:0.78rem;">Daily sales & drill-down</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/HIGH_VALUE_PRODUCTS'" style="border-left: 4px solid #9C27B0; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#9C27B0; background:rgba(156,39,176,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">High Value Items</h4>
                        <p style="font-size:0.78rem;">Top ranked products</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/HIGH_VALUE_BUSINESS'" style="border-left: 4px solid #673AB7; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#673AB7; background:rgba(103,58,183,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Top Businesses</h4>
                        <p style="font-size:0.78rem;">Revenue volume rank</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/HIGH_VALUE_CLIENT'" style="border-left: 4px solid #00BCD4; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#00BCD4; background:rgba(0,188,212,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Top Clients</h4>
                        <p style="font-size:0.78rem;">Highest customer LTV</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/PROFITED_INVOICE'" style="border-left: 4px solid #10B981; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#10B981; background:rgba(16,185,129,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Top Profit Invoices</h4>
                        <p style="font-size:0.78rem;">Highest margin sales</p>
                    </div>
                </div>

                <div class="pro-grid-card" onclick="window.location.hash='#/analytics/PROFIT_DATA'" style="border-left: 4px solid #059669; padding:1.15rem;">
                    <div class="pro-card-badge">PRO</div>
                    <div class="pro-card-icon" style="color:#059669; background:rgba(5,150,105,0.1); margin-bottom:0.5rem; width:36px; height:36px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    </div>
                    <div class="pro-card-content">
                        <h4 style="margin:0 0 2px 0; font-size:0.95rem; color:var(--text-primary);">Profit Report</h4>
                        <p style="font-size:0.78rem;">Timeframe margin review</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- RECENT ACTIVITY & QUICK ACTIONS -->
        <div class="dashboard-bottom anim-fade-up anim-stagger-5" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem;">
            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: var(--text-primary); font-size: 1.15rem; font-weight: 600;">Period Invoices & Activity</h3>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/invoices/customer'" style="font-size: 0.78rem;">View Invoices &rarr;</button>
                </div>
                <div class="table-container" style="margin-top: 0.75rem;">
                    <table style="width:100%; border-collapse: collapse; text-align:left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem; background: rgba(248, 250, 252, 0.7);">
                                <th style="padding:0.75rem 1rem;">Type</th>
                                <th style="padding:0.75rem 1rem;">ID</th>
                                <th style="padding:0.75rem 1rem;">Date</th>
                                <th style="padding:0.75rem 1rem;">Total</th>
                                <th style="padding:0.75rem 1rem;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="dash-activity">
                            ${Array(4).fill(0).map(() => `
                                <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding:0.85rem 1rem;"><div class="skeleton-shimmer" style="width: 70px; height: 16px;"></div></td>
                                    <td style="padding:0.85rem 1rem;"><div class="skeleton-shimmer" style="width: 100px; height: 16px;"></div></td>
                                    <td style="padding:0.85rem 1rem;"><div class="skeleton-shimmer" style="width: 80px; height: 16px;"></div></td>
                                    <td style="padding:0.85rem 1rem;"><div class="skeleton-shimmer" style="width: 60px; height: 16px;"></div></td>
                                    <td style="padding:0.85rem 1rem;"><div class="skeleton-shimmer" style="width: 65px; height: 22px; border-radius:12px;"></div></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); max-width: 420px; width: 100%;">
                <h3 style="margin-bottom: 0.5rem; color: var(--text-primary); font-size: 1.15rem; font-weight: 600;">Workspace Operations</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.25rem;">Quick shortcuts to manage your workspace features.</p>
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button class="btn btn-secondary" style="justify-content: flex-start; padding: 0.85rem 1.1rem; border-radius: var(--radius-btn);" onclick="window.location.hash='#/products'">
                        Manage Products Inventory
                    </button>
                    <button class="btn btn-secondary" style="justify-content: flex-start; padding: 0.85rem 1.1rem; border-radius: var(--radius-btn);" onclick="window.location.hash='#/customers'">
                        Customers Directory
                    </button>
                    <button class="btn btn-secondary" style="justify-content: flex-start; padding: 0.85rem 1.1rem; border-radius: var(--radius-btn);" onclick="window.location.hash='#/invoices/customer'">
                        Customer Invoices
                    </button>
                    <button class="btn btn-secondary" style="justify-content: flex-start; padding: 0.85rem 1.1rem; border-radius: var(--radius-btn);" onclick="window.location.hash='#/invoices/business'">
                        Business B2B Invoices
                    </button>
                    <button class="btn btn-secondary" style="justify-content: flex-start; padding: 0.85rem 1.1rem; border-radius: var(--radius-btn);" onclick="window.location.hash='#/workers'">
                        Members & Permissions
                    </button>
                </div>
            </div>
        </div>
    `;

    if (!workspaceId) return;

    let cachedProducts = [];
    let cachedCustInvoices = [];
    let cachedBusInvoices = [];

    const previousNumbers = new Map();

    const animateNumber = (element, targetValue, isCurrency = true, duration = 750) => {
        if (!element) return;
        const target = Number(targetValue) || 0;
        const startVal = previousNumbers.get(element) ?? 0;
        previousNumbers.set(element, target);

        if (startVal === target) {
            element.textContent = isCurrency ? formatCurr(target) : formatNum(target);
            return;
        }

        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const currentVal = startVal + (target - startVal) * ease;

            element.textContent = isCurrency ? formatCurr(currentVal) : formatNum(Math.round(currentVal));

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = isCurrency ? formatCurr(target) : formatNum(target);
            }
        };

        requestAnimationFrame(update);
    };

    // Function to calculate and render metrics based on active date range
    const computeAndRenderMetrics = () => {
        const subtitleEl = container.querySelector('#overview-subtitle');
        const activeRangeTextEl = container.querySelector('#active-range-text');
        
        if (subtitleEl) {
            subtitleEl.innerHTML = `Showing data from <strong style="color: var(--primary);">${currentRange.label}</strong>`;
        }
        if (activeRangeTextEl) {
            activeRangeTextEl.textContent = currentRange.label;
        }

        const allInvoices = [...cachedCustInvoices, ...cachedBusInvoices];
        
        // Filter invoices strictly within selected date range
        const filteredInvoices = allInvoices.filter(inv => {
            if (activeFilter === 'ALL_TIME') return true;
            const t = getInvoiceTime(inv);
            return t >= currentRange.start && t <= currentRange.end;
        });

        const filteredCustInvoices = cachedCustInvoices.filter(inv => {
            if (activeFilter === 'ALL_TIME') return true;
            const t = getInvoiceTime(inv);
            return t >= currentRange.start && t <= currentRange.end;
        });

        const filteredBusInvoices = cachedBusInvoices.filter(inv => {
            if (activeFilter === 'ALL_TIME') return true;
            const t = getInvoiceTime(inv);
            return t >= currentRange.start && t <= currentRange.end;
        });

        // Calculations
        let totalSales = 0;
        let revenueReceived = 0;
        let revenuePending = 0;
        let totalProfit = 0;

        filteredInvoices.forEach(inv => {
            const isPaid = (inv.status || '').toUpperCase() === 'PAID';
            const price = Number(inv.totalPrice) || 0;
            totalSales += price;

            if (isPaid) {
                revenueReceived += price;

                // Calculate Net Profit
                if (inv.items && Array.isArray(inv.items)) {
                    const calc = calculateInvoiceTotal(
                        inv.items, 
                        inv.discountPercent || 0, 
                        inv.additionalCut || 0, 
                        inv.taxPercent || 0, 
                        inv.shippingCost || 0
                    );
                    totalProfit += (calc.totalProfit || 0);
                }
            } else {
                revenuePending += price;
            }
        });

        // Compute Percentages for Revenue Line Measurement
        const paidPercent = totalSales > 0 ? ((revenueReceived / totalSales) * 100) : 0;
        const pendingPercent = totalSales > 0 ? ((revenuePending / totalSales) * 100) : 0;

        // Update Line Measurement UI with Smooth Transition
        const barReceivedEl = container.querySelector('#bar-received');
        const barPendingEl = container.querySelector('#bar-pending');
        const measureStatsEl = container.querySelector('#revenue-measure-stats');
        const legendReceivedEl = container.querySelector('#legend-received-amt');
        const legendPendingEl = container.querySelector('#legend-pending-amt');
        const legendTotalSalesEl = container.querySelector('#legend-total-sales');

        if (barReceivedEl) barReceivedEl.style.width = paidPercent.toFixed(1) + '%';
        if (barPendingEl) barPendingEl.style.width = pendingPercent.toFixed(1) + '%';

        if (measureStatsEl) {
            measureStatsEl.innerHTML = `
                <span style="color: #059669; font-weight:700;">Received: ${formatCurr(revenueReceived)} (${paidPercent.toFixed(1)}%)</span>
                &nbsp;&bull;&nbsp;
                <span style="color: #ea580c; font-weight:700;">Pending: ${formatCurr(revenuePending)} (${pendingPercent.toFixed(1)}%)</span>
            `;
        }

        if (legendReceivedEl) legendReceivedEl.textContent = formatCurr(revenueReceived);
        if (legendPendingEl) legendPendingEl.textContent = formatCurr(revenuePending);
        if (legendTotalSalesEl) legendTotalSalesEl.textContent = formatCurr(totalSales);

        // Update Metrics Cards with Smooth Count-Up Animation
        const elTotalSales = container.querySelector('#dash-total-sales');
        const elRevReceived = container.querySelector('#dash-revenue-received');
        const elRevPending = container.querySelector('#dash-revenue-pending');
        const elTotalProfit = container.querySelector('#dash-total-profit');
        const elProducts = container.querySelector('#dash-products');
        const elCustInv = container.querySelector('#dash-cust-inv');
        const elBusInv = container.querySelector('#dash-bus-inv');

        animateNumber(elTotalSales, totalSales, true, 800);
        animateNumber(elRevReceived, revenueReceived, true, 800);
        animateNumber(elRevPending, revenuePending, true, 800);
        animateNumber(elTotalProfit, totalProfit, true, 800);
        animateNumber(elProducts, cachedProducts.length, false, 600);
        animateNumber(elCustInv, filteredCustInvoices.length, false, 600);
        animateNumber(elBusInv, filteredBusInvoices.length, false, 600);

        // Recent Invoices Table (in period)
        const recent = filteredInvoices.sort((a, b) => getInvoiceTime(b) - getInvoiceTime(a)).slice(0, 6);
        const activityTbody = container.querySelector('#dash-activity');
        
        if (activityTbody) {
            if (recent.length === 0) {
                activityTbody.innerHTML = `<tr><td colspan="5" style="padding:2rem 1rem; text-align:center; color: var(--text-muted);">No invoices recorded in this date range.</td></tr>`;
            } else {
                activityTbody.innerHTML = recent.map(inv => {
                    const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                    const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
                    const invTime = getInvoiceTime(inv);
                    const dateStr = invTime > 0 ? new Date(invTime).toLocaleDateString() : '—';
                    return `
                        <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                            <td style="padding:0.85rem 1rem; font-size:0.85rem; color:var(--text-secondary); font-weight:500;">${inv.isBusinessInvoice ? 'Business' : 'Customer'}</td>
                            <td style="padding:0.85rem 1rem;"><code style="font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.04); padding: 0.2rem 0.4rem; border-radius: 4px;">${inv.uniqueId || inv.busInvNumber || inv.id || '—'}</code></td>
                            <td style="padding:0.85rem 1rem; font-size: 0.85rem; color: var(--text-secondary);">${dateStr}</td>
                            <td style="padding:0.85rem 1rem; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">$${Number(inv.totalPrice || 0).toFixed(2)}</td>
                            <td style="padding:0.85rem 1rem;"><span class="${badgeClass}">${inv.status || 'UNPAID'}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }
    };

    // Helper to apply preset date filters
    const applyDatePreset = (preset) => {
        activeFilter = preset;
        const currentDate = new Date();

        // Update active pill button
        container.querySelectorAll('.date-pill').forEach(pill => {
            if (pill.getAttribute('data-preset') === preset) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });

        switch (preset) {
            case 'THIS_MONTH': {
                const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
                const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999);
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `1 ${getMonthNameShort(currentDate.getMonth())} – ${currentDate.getDate()} ${getMonthNameShort(currentDate.getMonth())} ${currentDate.getFullYear()}`
                };
                break;
            }
            case 'TODAY': {
                const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
                const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999);
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `Today (${currentDate.getDate()} ${getMonthNameShort(currentDate.getMonth())} ${currentDate.getFullYear()})`
                };
                break;
            }
            case 'YESTERDAY': {
                const yest = new Date(currentDate);
                yest.setDate(yest.getDate() - 1);
                const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
                const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `Yesterday (${yest.getDate()} ${getMonthNameShort(yest.getMonth())})`
                };
                break;
            }
            case 'THIS_WEEK': {
                const day = currentDate.getDay(); // 0 = Sunday
                const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // Monday start
                const start = new Date(currentDate.setDate(diff));
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setHours(23, 59, 59, 999);
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `This Week (${formatDateHuman(start)} – ${formatDateHuman(end)})`
                };
                break;
            }
            case 'LAST_MONTH': {
                const firstDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1, 0, 0, 0, 0);
                const lastDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59, 999);
                currentRange = {
                    start: firstDayLastMonth.getTime(),
                    end: lastDayLastMonth.getTime(),
                    label: `Last Month (${getMonthNameShort(firstDayLastMonth.getMonth())} ${firstDayLastMonth.getFullYear()})`
                };
                break;
            }
            case 'THIS_YEAR': {
                const start = new Date(currentDate.getFullYear(), 0, 1, 0, 0, 0, 0);
                const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999);
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `This Year (${currentDate.getFullYear()})`
                };
                break;
            }
            case 'ALL_TIME': {
                currentRange = {
                    start: 0,
                    end: Infinity,
                    label: 'All Time'
                };
                break;
            }
        }

        computeAndRenderMetrics();
    };

    // Attach pill events
    container.querySelectorAll('.date-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const preset = pill.getAttribute('data-preset');
            applyDatePreset(preset);
        });
    });

    // Custom Date Modal Dialog Logic
    const modal = container.querySelector('#overview-custom-modal');
    const btnOpenModal = container.querySelector('#btn-custom-date-modal');
    const btnCloseModal = container.querySelector('#btn-close-date-modal');
    const btnCancelModal = container.querySelector('#btn-cancel-date-modal');
    const btnApplyRange = container.querySelector('#btn-apply-range');
    const btnApplySingleDay = container.querySelector('#btn-apply-single-day');
    const singleDayInput = container.querySelector('#modal-single-day');
    const rangeFromInput = container.querySelector('#modal-range-from');
    const rangeToInput = container.querySelector('#modal-range-to');

    // Pre-fill modal inputs with today's ISO date string (YYYY-MM-DD)
    const todayISO = now.toISOString().split('T')[0];
    if (singleDayInput) singleDayInput.value = todayISO;
    if (rangeFromInput) rangeFromInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    if (rangeToInput) rangeToInput.value = todayISO;

    const openModal = () => { if (modal) modal.classList.add('open'); };
    const closeModal = () => { if (modal) modal.classList.remove('open'); };

    if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    // Apply Single Day Selection
    if (btnApplySingleDay && singleDayInput) {
        btnApplySingleDay.addEventListener('click', () => {
            const val = singleDayInput.value;
            if (!val) return;
            const [y, m, d] = val.split('-').map(Number);
            const start = new Date(y, m - 1, d, 0, 0, 0, 0);
            const end = new Date(y, m - 1, d, 23, 59, 59, 999);

            activeFilter = 'CUSTOM';
            currentRange = {
                start: start.getTime(),
                end: end.getTime(),
                label: `Specific Day (${d} ${getMonthNameShort(m - 1)} ${y})`
            };

            container.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            closeModal();
            computeAndRenderMetrics();
        });
    }

    // Apply Custom Date Range
    if (btnApplyRange && rangeFromInput && rangeToInput) {
        btnApplyRange.addEventListener('click', () => {
            const fromVal = rangeFromInput.value;
            const toVal = rangeToInput.value;
            if (!fromVal || !toVal) return;

            const [y1, m1, d1] = fromVal.split('-').map(Number);
            const [y2, m2, d2] = toVal.split('-').map(Number);

            const start = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
            const end = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);

            activeFilter = 'CUSTOM';
            currentRange = {
                start: start.getTime(),
                end: end.getTime(),
                label: `${d1} ${getMonthNameShort(m1 - 1)} ${y1} – ${d2} ${getMonthNameShort(m2 - 1)} ${y2}`
            };

            container.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            closeModal();
            computeAndRenderMetrics();
        });
    }

    // Modal Quick Preset Buttons (e.g. Last 7 Days, Last 30 Days, Last 90 Days, Last Year)
    container.querySelectorAll('.modal-quick-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const days = btn.getAttribute('data-days');
            const preset = btn.getAttribute('data-preset');
            const cur = new Date();

            if (days) {
                const numDays = parseInt(days, 10);
                const start = new Date(cur.getTime() - (numDays * 24 * 60 * 60 * 1000));
                start.setHours(0, 0, 0, 0);
                const end = new Date();
                end.setHours(23, 59, 59, 999);

                activeFilter = 'CUSTOM';
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `Last ${numDays} Days (${formatDateHuman(start)} – ${formatDateHuman(end)})`
                };
            } else if (preset === 'LAST_YEAR') {
                const prevYear = cur.getFullYear() - 1;
                const start = new Date(prevYear, 0, 1, 0, 0, 0, 0);
                const end = new Date(prevYear, 11, 31, 23, 59, 59, 999);

                activeFilter = 'CUSTOM';
                currentRange = {
                    start: start.getTime(),
                    end: end.getTime(),
                    label: `Year ${prevYear}`
                };
            }

            container.querySelectorAll('.date-pill').forEach(p => p.classList.remove('active'));
            closeModal();
            computeAndRenderMetrics();
        });
    });

    // Initial Data Fetch
    try {
        const productService = getProductService(workspaceId);
        const invoiceService = getInvoiceService(workspaceId);

        // Fetch Data concurrently with error resilience
        const [products, custInvoices, busInvoices] = await Promise.all([
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => [])
        ]);

        cachedProducts = products || [];
        cachedCustInvoices = custInvoices || [];
        cachedBusInvoices = busInvoices || [];

        // Compute metrics with default (1st of month to today)
        computeAndRenderMetrics();

    } catch (e) {
        console.error("Failed to load dashboard data", e);
    }
};
