/**
 * Businesses Module Placeholder
 */

export const renderBusinesses = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Businesses</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Add Business clicked')">Add Business</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No businesses found.</p>
                <p class="text-sm text-muted">Business management will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
