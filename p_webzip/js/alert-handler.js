/**
 * Centralized Alert Handler
 * Supports: success, error, warning, info, permission-denied
 */

const createAlertElement = (type, title, message) => {
    const alertId = 'alert-' + Date.now();
    const iconMap = {
        'success': '✓',
        'error': '✕',
        'warning': '⚠',
        'info': 'i',
        'permission-denied': '⛔'
    };

    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.id = alertId;
    el.innerHTML = `
        <div class="alert-icon">${iconMap[type] || ''}</div>
        <div class="alert-content">
            ${title ? `<strong>${title}</strong><br>` : ''}
            <span>${message}</span>
        </div>
        <button class="alert-close" onclick="document.getElementById('${alertId}').remove()">&times;</button>
    `;

    return el;
};

const show = (type, title, message, duration = 5000) => {
    const container = document.getElementById('alert-container');
    if (!container) return;

    const alertEl = createAlertElement(type, title, message);
    container.appendChild(alertEl);

    // Trigger animation
    requestAnimationFrame(() => {
        alertEl.classList.add('show');
    });

    if (duration > 0) {
        setTimeout(() => {
            if (document.getElementById(alertEl.id)) {
                alertEl.classList.remove('show');
                setTimeout(() => alertEl.remove(), 300); // Wait for transition
            }
        }, duration);
    }
};

export const showAlert = {
    success: (message, title = '') => show('success', title, message),
    error: (message, title = 'Error') => show('error', title, message),
    warning: (message, title = 'Warning') => show('warning', title, message),
    info: (message, title = '') => show('info', title, message),
    permissionDenied: (message = "You do not have permission to perform this action.") => 
        show('permission-denied', 'Access Denied', message),
    confirm: (message, title = 'Confirm Action') => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(15, 23, 42, 0.6)';
            overlay.style.backdropFilter = 'blur(4px)';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.2s ease';

            const modal = document.createElement('div');
            modal.className = 'card';
            modal.style.background = 'var(--bg-card)';
            modal.style.padding = '2rem';
            modal.style.borderRadius = 'var(--radius-lg)';
            modal.style.maxWidth = '400px';
            modal.style.width = '90%';
            modal.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
            modal.style.transform = 'scale(0.95)';
            modal.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            modal.style.textAlign = 'center';

            modal.innerHTML = `
                <div style="width: 56px; height: 56px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
                    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem;">${title}</h3>
                <p style="font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">${message}</p>
                <div style="display: flex; gap: 0.75rem;">
                    <button id="alert-confirm-cancel" class="btn btn-secondary" style="flex: 1; padding: 0.75rem;">Cancel</button>
                    <button id="alert-confirm-ok" class="btn btn-primary" style="flex: 1; padding: 0.75rem; background: #ef4444; border-color: #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);">Confirm</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            });

            const cleanup = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 200);
            };

            document.getElementById('alert-confirm-cancel').addEventListener('click', () => { cleanup(); resolve(false); });
            document.getElementById('alert-confirm-ok').addEventListener('click', () => { cleanup(); resolve(true); });
        });
    }
};
