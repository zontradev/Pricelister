/**
 * Workers and Permissions Module Placeholder
 */

export const renderWorkers = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Workers & Permissions</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Invite Worker clicked')">Invite Worker</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>No workers in this workspace.</p>
                <p class="text-sm text-muted">Role-based access (Creator Admin, Co-Admin, Worker) and restrictions will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
