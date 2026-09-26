/**
 * Invoices Module Placeholder
 */

export const renderInvoices = (type) => {
    const container = document.getElementById('workspace-container');
    const isBusiness = type === 'business';
    const title = isBusiness ? 'Business Invoices' : 'Customer Invoices';

    container.innerHTML = `
        <div class="module-header">
            <h2>${title}</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Create Invoice clicked')">Create Invoice</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No ${isBusiness ? 'business' : 'customer'} invoices found.</p>
                <p class="text-sm text-muted">Invoices engine (type: ${type}) will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
