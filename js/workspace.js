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

    // Set initial responsive state on load
    if (isMobile() && shell) {
        shell.classList.add('sidebar-collapsed');
    }

    const openMenu = () => {
        if (!shell) return;
        shell.classList.remove('sidebar-collapsed');
    };

    const closeMenu = () => {
        if (!shell) return;
        shell.classList.add('sidebar-collapsed');
    };

    // Toggle sidebar (Hide)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', closeMenu);
    }

    // Toggle sidebar (Show)
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', openMenu);
    }

    // Backdrop click closes drawer on mobile
    if (backdrop) {
        backdrop.addEventListener('click', closeMenu);
    }

    // Auto-close drawer on mobile when clicking navigation links
    document.querySelectorAll('.sidebar .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (isMobile()) {
                closeMenu();
            }
        });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isMobile() && shell && !shell.classList.contains('sidebar-collapsed')) {
                closeMenu();
            }
            if (contextPanel && contextPanel.classList.contains('open')) {
                contextPanel.classList.remove('open');
            }
        }
    });

    // Close context panel
    if (closeContextBtn) {
        closeContextBtn.addEventListener('click', () => {
            contextPanel.classList.remove('open');
        });
    }
};

export const toggleContextPanel = (title, contentHTML) => {
    const panel = document.getElementById('context-panel');
    const titleEl = document.getElementById('context-title');
    const contentEl = document.getElementById('context-content');
    
    titleEl.textContent = title;
    contentEl.innerHTML = contentHTML;
    
    panel.classList.add('open');
};

// Render function for the Overview Dashboard
export const renderOverview = async (container, workspaceId) => {
    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem;">
            <div>
                <h2 style="font-size: 1.85rem; color: var(--text-primary); margin-bottom: 0.35rem; font-weight: 700; letter-spacing: -0.02em;">Workspace Overview</h2>
                <p style="color: var(--text-secondary); margin: 0; font-size: 0.95rem;">Real-time revenue metrics, collection health, and recent operations.</p>
            </div>
            <div class="module-actions" style="display: flex; gap: 0.75rem;">
                <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'">+ Create Invoice</button>
            </div>
        </div>

        <!-- REVENUE LINE MEASUREMENT COMPONENT -->
        <div class="revenue-measure-card">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                    <h3 style="font-size: 1.1rem; color: var(--text-primary); margin: 0; font-weight: 600;">Revenue Flow & Collection Health</h3>
                    <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">Live measurement of paid cashflow versus outstanding pending receivables</div>
                </div>
                <div id="revenue-measure-stats" style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary);">
                    <span style="color: #059669;">Received: $0.00 (0%)</span> &bull; <span style="color: #ea580c;">Pending: $0.00 (0%)</span>
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

        <!-- PRIMARY FINANCIAL METRICS (ELEVATED CARDS) -->
        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Total Sales -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid var(--primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Total Sales</h3>
                        <div class="stat-value" id="dash-total-sales" style="font-size: 2rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em;">$0.00</div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(225, 29, 72, 0.08); border-radius: 10px; color:var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Gross invoiced across all sales</div>
            </div>

            <!-- Revenue Received -->
            <div class="card stat-card" style="padding: 1.6rem; border-radius: var(--radius-card); background: rgba(255, 255, 255, 0.88); border-left: 4px solid #10b981;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h3 style="font-size: 0.8rem; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.5rem; font-weight: 600;">Revenue Received</h3>
                        <div class="stat-value" id="dash-revenue-received" style="font-size: 2rem; font-weight: 700; color: #059669; letter-spacing: -0.02em;">$0.00</div>
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
                        <div class="stat-value" id="dash-revenue-pending" style="font-size: 2rem; font-weight: 700; color: #d97706; letter-spacing: -0.02em;">$0.00</div>
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
                        <div class="stat-value" id="dash-total-profit" style="font-size: 2rem; font-weight: 700; color: #7c3aed; letter-spacing: -0.02em;">$0.00</div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(139, 92, 246, 0.08); border-radius: 10px; color:#7c3aed;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Net profit from paid sales</div>
            </div>
        </div>

        <!-- SECONDARY COUNTERS -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(225, 29, 72, 0.08); border-radius: 10px; color:var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Active Products</div>
                    <div id="dash-products" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">...</div>
                </div>
            </div>
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; color:#059669;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Customer Invoices</div>
                    <div id="dash-cust-inv" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">...</div>
                </div>
            </div>
            <div class="card" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background: rgba(245, 158, 11, 0.1); border-radius: 10px; color:#d97706;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line><line x1="9" y1="6" x2="9" y2="6.01"></line><line x1="15" y1="6" x2="15" y2="6.01"></line><line x1="9" y1="10" x2="9" y2="10.01"></line><line x1="15" y1="10" x2="15" y2="10.01"></line><line x1="9" y1="14" x2="9" y2="14.01"></line><line x1="15" y1="14" x2="15" y2="14.01"></line></svg></div>
                <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Business Invoices</div>
                    <div id="dash-bus-inv" style="font-size: 1.4rem; font-weight: 700; color: var(--text-primary);">...</div>
                </div>
            </div>
        </div>
        
        <!-- RECENT ACTIVITY & QUICK ACTIONS -->
        <div class="dashboard-bottom" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem;">
            <div class="card" style="padding: 1.5rem; border-radius: var(--radius-card); flex-grow: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: var(--text-primary); font-size: 1.15rem; font-weight: 600;">Recent Invoices & Activity</h3>
                    <button class="btn btn-sm btn-secondary" onclick="window.location.hash='#/invoices/customer'" style="font-size: 0.78rem;">View All &rarr;</button>
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
                            <tr><td colspan="5" style="padding:1.5rem; text-align:center; color: var(--text-muted);">
                                <div class="skeleton-shimmer" style="width: 100%; height: 20px; margin-bottom: 0.5rem;"></div>
                                <div class="skeleton-shimmer" style="width: 80%; height: 20px;"></div>
                            </td></tr>
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

    try {
        const productService = getProductService(workspaceId);
        const invoiceService = getInvoiceService(workspaceId);

        // Fetch Data concurrently
        const [products, custInvoices, busInvoices] = await Promise.all([
            productService.getAllActiveProducts(),
            invoiceService.getAllInvoices(false),
            invoiceService.getAllInvoices(true)
        ]);

        const allInvoices = [...custInvoices, ...busInvoices];
        
        // Calculations
        let totalSales = 0;
        let revenueReceived = 0;
        let revenuePending = 0;
        let totalProfit = 0;

        allInvoices.forEach(inv => {
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

        // Update Line Measurement UI
        const barReceivedEl = container.querySelector('#bar-received');
        const barPendingEl = container.querySelector('#bar-pending');
        const measureStatsEl = container.querySelector('#revenue-measure-stats');
        const legendReceivedEl = container.querySelector('#legend-received-amt');
        const legendPendingEl = container.querySelector('#legend-pending-amt');
        const legendTotalSalesEl = container.querySelector('#legend-total-sales');

        if (barReceivedEl) barReceivedEl.style.width = paidPercent.toFixed(1) + '%';
        if (barPendingEl) barPendingEl.style.width = pendingPercent.toFixed(1) + '%';
        
        const formatCurr = (n) => '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (measureStatsEl) {
            measureStatsEl.innerHTML = `
                <span style="color: #059669;">Received: ${formatCurr(revenueReceived)} (${paidPercent.toFixed(1)}%)</span>
                &nbsp;&bull;&nbsp;
                <span style="color: #ea580c;">Pending: ${formatCurr(revenuePending)} (${pendingPercent.toFixed(1)}%)</span>
            `;
        }

        if (legendReceivedEl) legendReceivedEl.textContent = formatCurr(revenueReceived);
        if (legendPendingEl) legendPendingEl.textContent = formatCurr(revenuePending);
        if (legendTotalSalesEl) legendTotalSalesEl.textContent = formatCurr(totalSales);

        // Update Metrics Cards
        const elTotalSales = container.querySelector('#dash-total-sales');
        const elRevReceived = container.querySelector('#dash-revenue-received');
        const elRevPending = container.querySelector('#dash-revenue-pending');
        const elTotalProfit = container.querySelector('#dash-total-profit');
        const elProducts = container.querySelector('#dash-products');
        const elCustInv = container.querySelector('#dash-cust-inv');
        const elBusInv = container.querySelector('#dash-bus-inv');

        if (elTotalSales) elTotalSales.textContent = formatCurr(totalSales);
        if (elRevReceived) elRevReceived.textContent = formatCurr(revenueReceived);
        if (elRevPending) elRevPending.textContent = formatCurr(revenuePending);
        if (elTotalProfit) elTotalProfit.textContent = formatCurr(totalProfit);
        if (elProducts) elProducts.textContent = products.length;
        if (elCustInv) elCustInv.textContent = custInvoices.length;
        if (elBusInv) elBusInv.textContent = busInvoices.length;

        // Recent Activity Table
        const recent = allInvoices.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 6);
        const activityTbody = container.querySelector('#dash-activity');
        
        if (activityTbody) {
            if (recent.length === 0) {
                activityTbody.innerHTML = `<tr><td colspan="5" style="padding:2rem 1rem; text-align:center; color: var(--text-muted);">No invoices recorded yet.</td></tr>`;
            } else {
                activityTbody.innerHTML = recent.map(inv => {
                    const isPaid = (inv.status || '').toUpperCase() === 'PAID';
                    const badgeClass = isPaid ? 'badge-paid' : 'badge-unpaid';
                    return `
                        <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                            <td style="padding:0.85rem 1rem; font-size:0.85rem; color:var(--text-secondary); font-weight:500;">${inv.isBusinessInvoice ? 'Business' : 'Customer'}</td>
                            <td style="padding:0.85rem 1rem;"><code style="font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.04); padding: 0.2rem 0.4rem; border-radius: 4px;">${inv.uniqueId}</code></td>
                            <td style="padding:0.85rem 1rem; font-size: 0.85rem; color: var(--text-secondary);">${new Date(inv.timestamp).toLocaleDateString()}</td>
                            <td style="padding:0.85rem 1rem; font-weight: 700; color: var(--text-primary); font-size: 0.9rem;">$${Number(inv.totalPrice || 0).toFixed(2)}</td>
                            <td style="padding:0.85rem 1rem;"><span class="${badgeClass}">${inv.status || 'UNPAID'}</span></td>
                        </tr>
                    `;
                }).join('');
            }
        }

    } catch (e) {
        console.error("Failed to load dashboard data", e);
    }
};
