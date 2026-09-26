/**
 * Settings Module Placeholder
 */

export const renderSettings = (container) => {
    container.innerHTML = `
        <div class="module-header">
            <h2>Workspace Settings</h2>
            <div class="module-actions">
                <button class="btn btn-primary" onclick="alert('Save Settings clicked')">Save Settings</button>
            </div>
        </div>
        
        <div class="card">
            <div class="empty-state">
                <p>Workspace configuration goes here.</p>
                <p class="text-sm text-muted">Settings module will be fully implemented in Phase 2.</p>
            </div>
        </div>
    `;
};
