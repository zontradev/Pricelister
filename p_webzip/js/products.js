/**
 * Products Module Placeholder
 */

export const renderProducts = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Products</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Add Product clicked')">Add Product</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No products found.</p>
                <p class="text-sm text-muted">Products module will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
