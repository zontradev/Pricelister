/**
 * Categories Module Placeholder
 */

export const renderCategories = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Categories</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Add Category clicked')">Add Category</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No categories found.</p>
                <p class="text-sm text-muted">Category management (with unique internal code handling) will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
