/**
 * Clients Module Placeholder
 */

export const renderClients = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Clients</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Add Client clicked')">Add Client</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No clients found.</p>
                <p class="text-sm text-muted">Client management will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
