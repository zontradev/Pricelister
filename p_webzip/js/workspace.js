import { getProductService } from './services/productService.js';
import { getInvoiceService } from './services/invoiceService.js';

export const initWorkspace = () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const shell = document.getElementById('app-shell');
    const closeContextBtn = document.getElementById('close-context');
    const contextPanel = document.getElementById('context-panel');
    
    const openSidebarBtn = document.getElementById('open-sidebar');
    
    // Toggle sidebar (Hide)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            shell.classList.add('sidebar-collapsed');
            if (openSidebarBtn) openSidebarBtn.style.display = 'block';
        });
    }

    // Toggle sidebar (Show)
    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', () => {
            shell.classList.remove('sidebar-collapsed');
            openSidebarBtn.style.display = 'none';
        });
    }

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
        <div class="module-header" style="margin-bottom: 2rem;">
            <div>
                <h2 style="font-size: 1.75rem; color: var(--text-primary); margin-bottom: 0.25rem;">Workspace Overview</h2>
                <p style="color: var(--text-secondary);">Here is what is happening in your business today.</p>
            </div>
            <div class="module-actions" style="display: flex; gap: 0.75rem;">
                <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'">New Invoice</button>
            </div>
        </div>
        
        <div class="dashboard-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <div class="card stat-card" style="padding: 1.5rem; border-radius: var(--radius-lg); border-left: 4px solid var(--primary); background: linear-gradient(to right, rgba(59,130,246,0.05), transparent);">
                <h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Total Products</h3>
                <div class="stat-value" id="dash-products" style="font-size: 2.25rem; font-weight: 700; color: var(--text-primary);">...</div>
            </div>
            <div class="card stat-card" style="padding: 1.5rem; border-radius: var(--radius-lg); border-left: 4px solid #10b981; background: linear-gradient(to right, rgba(16,185,129,0.05), transparent);">
                <h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Customer Invoices</h3>
                <div class="stat-value" id="dash-cust-inv" style="font-size: 2.25rem; font-weight: 700; color: var(--text-primary);">...</div>
            </div>
            <div class="card stat-card" style="padding: 1.5rem; border-radius: var(--radius-lg); border-left: 4px solid #f59e0b; background: linear-gradient(to right, rgba(245,158,11,0.05), transparent);">
                <h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Business Invoices</h3>
                <div class="stat-value" id="dash-bus-inv" style="font-size: 2.25rem; font-weight: 700; color: var(--text-primary);">...</div>
            </div>
            <div class="card stat-card" style="padding: 1.5rem; border-radius: var(--radius-lg); border-left: 4px solid #8b5cf6; background: linear-gradient(to right, rgba(139,92,246,0.05), transparent);">
                <h3 style="font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Total Revenue</h3>
                <div class="stat-value" id="dash-revenue" style="font-size: 2.25rem; font-weight: 700; color: var(--text-primary);">...</div>
            </div>
        </div>
        
        <div class="dashboard-bottom" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
            <div class="card mt-20" style="padding: 1.5rem; border-radius: var(--radius-lg); flex-grow: 1;">
                <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Recent Activity</h3>
                <div class="table-container" style="margin-top: 1rem;">
                    <table style="width:100%; border-collapse: collapse; text-align:left;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); font-size: 0.9rem;">
                                <th style="padding:1rem;">Type</th>
                                <th style="padding:1rem;">ID</th>
                                <th style="padding:1rem;">Date</th>
                                <th style="padding:1rem;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="dash-activity">
                            <tr><td colspan="4" style="padding:1rem; text-align:center; color: var(--text-muted);">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card mt-20" style="padding: 1.5rem; border-radius: var(--radius-lg); max-width: 400px; width: 100%;">
                <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);">Quick Actions</h3>
                <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                    <button class="btn btn-outline" style="justify-content: flex-start; padding: 0.85rem 1rem;" onclick="window.location.hash='#/products'">📦 Manage Products</button>
                    <button class="btn btn-outline" style="justify-content: flex-start; padding: 0.85rem 1rem;" onclick="window.location.hash='#/customers'">👥 Add Customer</button>
                    <button class="btn btn-outline" style="justify-content: flex-start; padding: 0.85rem 1rem;" onclick="window.location.hash='#/invoices/customer'">🧾 Create Invoice</button>
                    <button class="btn btn-outline" style="justify-content: flex-start; padding: 0.85rem 1rem;" onclick="window.location.hash='#/workers'">⚙️ Manage Workers</button>
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
        
        // Calculate Revenue (only from PAID invoices)
        const totalRevenue = allInvoices
            .filter(inv => inv.status === 'PAID')
            .reduce((sum, inv) => sum + (inv.totalPrice || 0), 0);

        // Sort for recent activity
        const recent = allInvoices.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

        // Update UI
        document.getElementById('dash-products').textContent = products.length;
        document.getElementById('dash-cust-inv').textContent = custInvoices.length;
        document.getElementById('dash-bus-inv').textContent = busInvoices.length;
        document.getElementById('dash-revenue').textContent = '$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const activityTbody = document.getElementById('dash-activity');
        if (recent.length === 0) {
            activityTbody.innerHTML = `<tr><td colspan="4" style="padding:1rem; text-align:center; color: var(--text-muted);">No recent activity.</td></tr>`;
        } else {
            activityTbody.innerHTML = recent.map(inv => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:1rem;">${inv.isBusinessInvoice ? 'Business Invoice' : 'Customer Invoice'}</td>
                    <td style="padding:1rem;"><strong>${inv.uniqueId}</strong></td>
                    <td style="padding:1rem;">${new Date(inv.timestamp).toLocaleDateString()}</td>
                    <td style="padding:1rem;"><span class="badge" style="background:${inv.status === 'PAID' ? '#4CAF50' : '#f44336'};">${inv.status}</span></td>
                </tr>
            `).join('');
        }

    } catch (e) {
        console.error("Failed to load dashboard data", e);
    }
};
