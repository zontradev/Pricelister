/**
 * orders.js
 * Workspace Orders Management Module.
 * Displays customer orders placed via the Customer Portal (stored in Workspaces/{workspaceId}/Orders).
 */

import { getOrderService } from '../services/orderService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';

export const renderOrders = async (container, workspaceId) => {
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
            <div class="spinner"></div>
        </div>
    `;

    const orderService = getOrderService(workspaceId);
    let allOrders = [];
    let currentFilter = 'ALL';
    let searchQuery = '';

    const currency = getAppCurrencySymbol() || '$';

    try {
        allOrders = await orderService.getAllOrders();
    } catch (err) {
        console.error("Error fetching orders:", err);
        showAlert.error("Could not load customer orders.");
    }

    const renderUI = () => {
        // Filter orders
        const filtered = allOrders.filter(order => {
            const matchesStatus = currentFilter === 'ALL' || order.status === currentFilter;
            if (!matchesStatus) return false;

            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            const orderNum = (order.orderNumber || '').toLowerCase();
            const custName = (order.customerName || '').toLowerCase();
            const custPhone = (order.customerPhone || '').toLowerCase();
            const custAddr = (order.customerAddress || '').toLowerCase();
            const itemNames = (order.items || []).map(i => (i.productName || '').toLowerCase()).join(' ');

            return orderNum.includes(q) || custName.includes(q) || custPhone.includes(q) || custAddr.includes(q) || itemNames.includes(q);
        });

        // Compute metrics
        const totalCount = allOrders.length;
        const pendingCount = allOrders.filter(o => o.status === 'PENDING').length;
        const confirmedCount = allOrders.filter(o => o.status === 'CONFIRMED' || o.status === 'PROCESSING').length;
        const completedRevenue = allOrders
            .filter(o => o.status !== 'CANCELLED')
            .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

        container.innerHTML = `
            <!-- HEADER -->
            <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                        <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary);">Customer Orders</h2>
                        <span class="badge" style="background:rgba(225,29,72,0.1); color:var(--primary); font-weight:700; font-size:0.85rem; padding:0.25rem 0.75rem; border-radius:999px;">
                            ${totalCount} Total
                        </span>
                        ${pendingCount > 0 ? `
                            <span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700; font-size:0.85rem; padding:0.25rem 0.75rem; border-radius:999px; display:inline-flex; align-items:center; gap:0.35rem;">
                                <span style="width:7px; height:7px; border-radius:50%; background:#f59e0b;"></span>
                                ${pendingCount} Pending
                            </span>
                        ` : ''}
                    </div>
                    <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                        Review, manage, print slips, and fulfill orders received from your online storefront.
                    </p>
                </div>

                <div style="display:flex; gap:0.6rem; align-items:center;">
                    <a href="#/customer-panel" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                        Customer Panel Setup
                    </a>
                </div>
            </div>

            <!-- METRIC CARDS ROW -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                <div class="card" style="padding:1.25rem; border-left:4px solid var(--primary); background:#ffffff;">
                    <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Total Orders</span>
                    <h3 style="font-size:1.75rem; margin:0.25rem 0 0 0; font-weight:800; color:var(--text-primary);">${totalCount}</h3>
                </div>
                <div class="card" style="padding:1.25rem; border-left:4px solid #f59e0b; background:#ffffff;">
                    <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#b45309;">Pending Confirmation</span>
                    <h3 style="font-size:1.75rem; margin:0.25rem 0 0 0; font-weight:800; color:#b45309;">${pendingCount}</h3>
                </div>
                <div class="card" style="padding:1.25rem; border-left:4px solid #3b82f6; background:#ffffff;">
                    <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#1d4ed8;">Confirmed / Processing</span>
                    <h3 style="font-size:1.75rem; margin:0.25rem 0 0 0; font-weight:800; color:#1d4ed8;">${confirmedCount}</h3>
                </div>
                <div class="card" style="padding:1.25rem; border-left:4px solid #10b981; background:#ffffff;">
                    <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#065f46;">Order Volume</span>
                    <h3 style="font-size:1.75rem; margin:0.25rem 0 0 0; font-weight:800; color:#065f46;">${currency}${completedRevenue.toFixed(2)}</h3>
                </div>
            </div>

            <!-- CONTROLS ROW: SEARCH & STATUS TABS -->
            <div class="card" style="padding:1rem 1.25rem; margin-bottom:1.5rem; background:#ffffff;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                    
                    <!-- Search Box -->
                    <div style="flex:1; min-width:260px; max-width:400px; position:relative;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:0.85rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        <input type="text" id="order-search-input" class="form-control" style="padding-left:2.4rem; font-size:0.88rem;" placeholder="Search Order #, Customer, Phone, Product..." value="${escapeHtml(searchQuery)}">
                    </div>

                    <!-- Status Filter Tabs -->
                    <div style="display:flex; gap:0.4rem; overflow-x:auto; padding-bottom:0.2rem; align-items:center;">
                        ${[
                            { id: 'ALL', label: 'All' },
                            { id: 'PENDING', label: 'Pending' },
                            { id: 'CONFIRMED', label: 'Confirmed' },
                            { id: 'PROCESSING', label: 'Processing' },
                            { id: 'SHIPPED', label: 'Shipped' },
                            { id: 'COMPLETED', label: 'Completed' },
                            { id: 'CANCELLED', label: 'Cancelled' }
                        ].map(tab => `
                            <button type="button" class="btn btn-sm ${currentFilter === tab.id ? 'btn-primary' : 'btn-secondary'}" data-status="${tab.id}" style="font-size:0.82rem; font-weight:600; padding:0.35rem 0.85rem; border-radius:8px; white-space:nowrap; ${currentFilter === tab.id ? 'background:var(--primary); color:#ffffff;' : ''}">
                                ${tab.label}
                            </button>
                        `).join('')}
                    </div>

                </div>
            </div>

            <!-- ORDERS LIST / TABLE -->
            <div class="card" style="padding:0; overflow:hidden; background:#ffffff;">
                ${filtered.length === 0 ? `
                    <div style="text-align:center; padding:3.5rem 1.5rem;">
                        <div style="width:54px; height:54px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; color:var(--text-muted);">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        </div>
                        <h4 style="font-size:1.1rem; color:var(--text-primary); margin-bottom:0.3rem;">No Orders Found</h4>
                        <p style="color:var(--text-secondary); font-size:0.85rem; max-width:380px; margin:0 auto 1rem;">
                            ${searchQuery || currentFilter !== 'ALL' ? 'Try adjusting your search query or status filter.' : 'When customers place orders from your online catalog, they will appear here in real-time.'}
                        </p>
                    </div>
                ` : `
                    <div class="table-responsive">
                        <table class="table" style="width:100%; margin:0; border-collapse:collapse;">
                            <thead>
                                <tr style="background:var(--surface-50); border-bottom:1px solid var(--border-color); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">
                                    <th style="padding:0.85rem 1rem; text-align:left;">Order ID & Date</th>
                                    <th style="padding:0.85rem 1rem; text-align:left;">Customer</th>
                                    <th style="padding:0.85rem 1rem; text-align:left;">Items Ordered</th>
                                    <th style="padding:0.85rem 1rem; text-align:right;">Total Amount</th>
                                    <th style="padding:0.85rem 1rem; text-align:center;">Status</th>
                                    <th style="padding:0.85rem 1rem; text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.map(order => {
                                    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                    });
                                    const items = order.items || [];
                                    const itemCount = items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                                    const statusBadge = getStatusBadge(order.status);

                                    return `
                                        <tr style="border-bottom:1px solid var(--border-color); transition:background 0.15s ease;">
                                            <!-- Order ID & Date -->
                                            <td style="padding:1rem; vertical-align:top;">
                                                <div style="font-weight:700; font-size:0.92rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                                                    <span style="color:var(--primary); font-family:monospace;">#${escapeHtml(order.orderNumber || order.id)}</span>
                                                </div>
                                                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">
                                                    ${dateStr}
                                                </div>
                                            </td>

                                            <!-- Customer Info -->
                                            <td style="padding:1rem; vertical-align:top;">
                                                <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">
                                                    ${escapeHtml(order.customerName)}
                                                </div>
                                                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.15rem; display:flex; align-items:center; gap:0.4rem;">
                                                    <span>${escapeHtml(order.customerPhone)}</span>
                                                    ${order.customerPhone ? `
                                                        <a href="https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#059669; text-decoration:none; font-size:0.75rem; font-weight:700;" title="Message on WhatsApp">
                                                            [WhatsApp]
                                                        </a>
                                                    ` : ''}
                                                </div>
                                                <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.25rem; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:4px;" title="${escapeHtml(order.customerAddress)}">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                                    <span>${escapeHtml(order.customerAddress)}</span>
                                                </div>
                                                ${order.orderNote ? `
                                                    <div style="font-size:0.75rem; color:#b45309; background:#fef3c7; padding:0.15rem 0.45rem; border-radius:4px; margin-top:0.3rem; display:inline-block; max-width:240px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(order.orderNote)}">
                                                        Note: ${escapeHtml(order.orderNote)}
                                                    </div>
                                                ` : ''}
                                            </td>

                                            <!-- Items Ordered -->
                                            <td style="padding:1rem; vertical-align:top;">
                                                <div style="font-size:0.84rem; font-weight:600; color:var(--text-primary);">
                                                    ${itemCount} ${itemCount === 1 ? 'item' : 'items'} (${items.length} lines)
                                                </div>
                                                <div style="display:flex; flex-direction:column; gap:0.2rem; margin-top:0.3rem; max-width:220px;">
                                                    ${items.slice(0, 2).map(it => `
                                                        <span style="font-size:0.78rem; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                                            • ${it.quantity}x ${escapeHtml(it.productName)} (${currency}${Number(it.unitPrice || 0).toFixed(2)})
                                                        </span>
                                                    `).join('')}
                                                    ${items.length > 2 ? `
                                                        <span style="font-size:0.75rem; color:var(--primary); font-weight:600;">+${items.length - 2} more items...</span>
                                                    ` : ''}
                                                </div>
                                            </td>

                                            <!-- Total Amount -->
                                            <td style="padding:1rem; text-align:right; vertical-align:top;">
                                                <div style="font-size:1.05rem; font-weight:800; color:var(--text-primary);">
                                                    ${order.currencySymbol || currency}${Number(order.totalAmount || 0).toFixed(2)}
                                                </div>
                                                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">
                                                    ${escapeHtml(order.paymentMethod || 'Cash on Delivery')}
                                                </div>
                                            </td>

                                            <!-- Status Dropdown -->
                                            <td style="padding:1rem; text-align:center; vertical-align:top;">
                                                <select class="form-control order-status-select" data-order-id="${order.id || order.uniqueId}" style="font-size:0.78rem; font-weight:700; padding:0.3rem 0.6rem; border-radius:6px; display:inline-block; width:auto; text-align:center; cursor:pointer;">
                                                    <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>Pending</option>
                                                    <option value="CONFIRMED" ${order.status === 'CONFIRMED' ? 'selected' : ''}>Confirmed</option>
                                                    <option value="PROCESSING" ${order.status === 'PROCESSING' ? 'selected' : ''}>Processing</option>
                                                    <option value="SHIPPED" ${order.status === 'SHIPPED' ? 'selected' : ''}>Shipped</option>
                                                    <option value="COMPLETED" ${order.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
                                                    <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'selected' : ''}>Cancelled</option>
                                                </select>
                                            </td>

                                            <!-- Actions -->
                                            <td style="padding:1rem; text-align:right; vertical-align:top;">
                                                <div style="display:flex; justify-content:flex-end; gap:0.4rem; align-items:center;">
                                                    <button type="button" class="btn btn-secondary btn-sm btn-view-slip" data-order-id="${order.id || order.uniqueId}" style="font-size:0.78rem; font-weight:600; padding:0.35rem 0.65rem;" title="View Slip / Print Receipt">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                        Slip
                                                    </button>
                                                    <button type="button" class="btn btn-secondary btn-sm btn-convert-invoice" data-order-id="${order.id || order.uniqueId}" style="font-size:0.78rem; font-weight:600; padding:0.35rem 0.65rem; color:var(--primary);" title="Create Invoice from this Order">
                                                        +Invoice
                                                    </button>
                                                    <button type="button" class="btn btn-secondary btn-sm btn-delete-order" data-order-id="${order.id || order.uniqueId}" style="font-size:0.78rem; padding:0.35rem 0.5rem; color:#e11d48;" title="Delete Order">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        bindEvents();
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return '<span style="background:#fef3c7; color:#b45309; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Pending</span>';
            case 'CONFIRMED':
                return '<span style="background:#dbeafe; color:#1d4ed8; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Confirmed</span>';
            case 'PROCESSING':
                return '<span style="background:#f3e8ff; color:#7e22ce; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Processing</span>';
            case 'SHIPPED':
                return '<span style="background:#e0e7ff; color:#4338ca; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Shipped</span>';
            case 'COMPLETED':
                return '<span style="background:#ecfdf5; color:#065f46; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Completed</span>';
            case 'CANCELLED':
                return '<span style="background:#fee2e2; color:#991b1b; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">Cancelled</span>';
            default:
                return `<span style="background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:999px; font-size:0.75rem; font-weight:700;">${escapeHtml(status)}</span>`;
        }
    };

    const bindEvents = () => {
        // Search Input
        const searchInput = document.getElementById('order-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderUI();
            });
        }

        // Status Tabs
        document.querySelectorAll('button[data-status]').forEach(btn => {
            btn.addEventListener('click', () => {
                currentFilter = btn.getAttribute('data-status');
                renderUI();
            });
        });

        // Status Selectors
        document.querySelectorAll('.order-status-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const orderId = sel.getAttribute('data-order-id');
                const newStatus = sel.value;
                try {
                    await orderService.updateOrderStatus(orderId, newStatus);
                    showAlert.success(`Order status updated to ${newStatus}`);
                    const ord = allOrders.find(o => o.id === orderId || o.uniqueId === orderId);
                    if (ord) ord.status = newStatus;
                    renderUI();
                } catch (err) {
                    console.error("Status update error:", err);
                    showAlert.error("Could not update order status.");
                }
            });
        });

        // View Slip Buttons
        document.querySelectorAll('.btn-view-slip').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-order-id');
                const order = allOrders.find(o => o.id === orderId || o.uniqueId === orderId);
                if (order) showOrderSlipModal(order);
            });
        });

        // Convert to Invoice
        document.querySelectorAll('.btn-convert-invoice').forEach(btn => {
            btn.addEventListener('click', () => {
                const orderId = btn.getAttribute('data-order-id');
                const order = allOrders.find(o => o.id === orderId || o.uniqueId === orderId);
                if (!order) return;
                // Prepopulate session storage and navigate to invoice creation
                sessionStorage.setItem('pricelister_convert_order', JSON.stringify(order));
                window.location.hash = '#/invoices/customer';
                showAlert.success(`Opening Customer Invoice for ${order.customerName}...`);
            });
        });

        // Delete Order
        document.querySelectorAll('.btn-delete-order').forEach(btn => {
            btn.addEventListener('click', async () => {
                const orderId = btn.getAttribute('data-order-id');
                if (!confirm("Are you sure you want to delete this order?")) return;
                try {
                    await orderService.deleteOrder(orderId);
                    allOrders = allOrders.filter(o => o.id !== orderId && o.uniqueId !== orderId);
                    showAlert.success("Order deleted.");
                    renderUI();
                } catch (err) {
                    console.error("Delete error:", err);
                    showAlert.error("Could not delete order.");
                }
            });
        });
    };

    /**
     * Slip / Receipt Modal
     */
    const showOrderSlipModal = (order) => {
        let modal = document.getElementById('order-slip-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'order-slip-modal';
            document.body.appendChild(modal);
        }

        const dateStr = new Date(order.createdAt || Date.now()).toLocaleString(undefined, {
            dateStyle: 'medium', timeStyle: 'short'
        });
        const curr = order.currencySymbol || currency;

        modal.innerHTML = `
            <div style="position:fixed; inset:0; background:rgba(15,23,42,0.75); backdrop-filter:blur(6px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;">
                <div class="card" style="background:#ffffff; border-radius:18px; max-width:520px; width:100%; box-shadow:0 25px 60px -15px rgba(0,0,0,0.4); overflow:hidden; border:1px solid rgba(225,29,72,0.2); animation:modalPop 0.25s ease;">
                    
                    <!-- SLIP HEADER -->
                    <div style="background:linear-gradient(135deg, #881337 0%, #e11d48 50%, #be123c 100%); padding:1.5rem; text-align:center; color:#ffffff; position:relative;">
                        <button type="button" id="btn-close-slip" style="position:absolute; right:1rem; top:1rem; background:rgba(255,255,255,0.2); border:none; color:#ffffff; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:1.1rem; display:flex; align-items:center; justify-content:center;">✕</button>
                        <h3 style="margin:0 0 0.25rem 0; font-size:1.3rem; font-weight:800;">Order Slip</h3>
                        <p style="margin:0; font-size:0.82rem; opacity:0.9;">Customer Order Summary & Packing Slip</p>
                    </div>

                    <!-- SLIP BODY -->
                    <div id="slip-print-content" style="padding:1.5rem; font-size:0.88rem; color:var(--text-primary);">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px dashed var(--border-color); padding-bottom:1rem;">
                            <div>
                                <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Number</span>
                                <div style="font-size:1.15rem; font-weight:800; color:var(--primary); font-family:monospace;">#${escapeHtml(order.orderNumber || order.id)}</div>
                                <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                            </div>
                            <div style="text-align:right;">
                                <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Status</span>
                                <div>${getStatusBadge(order.status)}</div>
                            </div>
                        </div>

                        <!-- Customer Details Box -->
                        <div style="background:var(--surface-50); border-radius:10px; padding:0.9rem; margin-bottom:1.25rem; border:1px solid var(--border-color);">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Customer Information</span>
                            <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem; display:flex; align-items:center; gap:5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                <span>${escapeHtml(order.customerPhone)}</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem; display:flex; align-items:center; gap:5px;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>${escapeHtml(order.customerAddress)}</span>
                            </div>
                            ${order.orderNote ? `
                                <div style="font-size:0.8rem; color:#b45309; background:#fef3c7; padding:0.25rem 0.5rem; border-radius:6px; margin-top:0.4rem;">
                                    <strong>Note:</strong> ${escapeHtml(order.orderNote)}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Itemized Table -->
                        <div style="margin-bottom:1.25rem;">
                            <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                        <th style="text-align:left; padding:0.4rem 0;">Item</th>
                                        <th style="text-align:center; padding:0.4rem 0;">Qty</th>
                                        <th style="text-align:right; padding:0.4rem 0;">Price</th>
                                        <th style="text-align:right; padding:0.4rem 0;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(order.items || []).map(item => `
                                        <tr style="border-bottom:1px solid var(--surface-100);">
                                            <td style="padding:0.5rem 0; font-weight:600; color:var(--text-primary);">${escapeHtml(item.productName)}</td>
                                            <td style="padding:0.5rem 0; text-align:center;">${item.quantity}</td>
                                            <td style="padding:0.5rem 0; text-align:right;">${curr}${Number(item.unitPrice || 0).toFixed(2)}</td>
                                            <td style="padding:0.5rem 0; text-align:right; font-weight:700;">${curr}${Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Totals Breakdown -->
                        <div style="border-top:1px dashed var(--border-color); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.35rem;">
                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
                                <span>Subtotal</span>
                                <span>${curr}${Number(order.subtotal || order.totalAmount || 0).toFixed(2)}</span>
                            </div>
                            ${order.shippingCost ? `
                                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
                                    <span>Shipping</span>
                                    <span>${curr}${Number(order.shippingCost).toFixed(2)}</span>
                                </div>
                            ` : ''}
                            <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.5rem; margin-top:0.25rem;">
                                <span>Total Payable</span>
                                <span style="color:var(--primary);">${curr}${Number(order.totalAmount || 0).toFixed(2)}</span>
                            </div>
                        </div>

                    </div>

                    <!-- MODAL FOOTER ACTIONS -->
                    <div style="background:var(--surface-50); border-top:1px solid var(--border-color); padding:1rem 1.5rem; display:flex; justify-content:space-between; gap:0.75rem; align-items:center;">
                        <button type="button" id="btn-print-slip" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print Slip
                        </button>
                        <button type="button" id="btn-done-slip" class="btn btn-primary" style="font-weight:700; font-size:0.85rem; padding:0.5rem 1.25rem;">
                            Close
                        </button>
                    </div>

                </div>
            </div>
        `;

        document.getElementById('btn-close-slip')?.addEventListener('click', () => modal.remove());
        document.getElementById('btn-done-slip')?.addEventListener('click', () => modal.remove());
        document.getElementById('btn-print-slip')?.addEventListener('click', () => {
            const printContent = document.getElementById('slip-print-content').innerHTML;
            const printWindow = window.open('', '', 'width=650,height=750');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Order Slip - #${order.orderNumber || order.id}</title>
                        <style>
                            body { font-family: 'Inter', sans-serif; padding: 2rem; color: #0f172a; line-height: 1.5; }
                            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                            th, td { padding: 0.5rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                            th { text-align: left; background: #f8fafc; font-size: 0.75rem; text-transform: uppercase; }
                        </style>
                    </head>
                    <body>
                        <h2 style="margin:0 0 0.25rem 0;">PriceLister Order Slip</h2>
                        ${printContent}
                        <script>window.print(); window.close();</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        });
    };

    // Listen to real-time order updates
    orderService.listenOrders((updatedList) => {
        allOrders = updatedList;
        renderUI();
    });

    renderUI();
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
