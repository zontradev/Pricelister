/**
 * Customers Module Placeholder
 */

export const renderCustomers = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Customers</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Add Customer clicked')">Add Customer</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No customers found.</p>
                <p class="text-sm text-muted">Customer management will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
