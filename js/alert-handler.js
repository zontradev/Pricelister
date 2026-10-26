/**
 * Centralized Modern Alert & Dialog Handler
 * Provides world-class UI dialogs: Toasts, Confirms, Unsaved Changes Modals, Discard Handlers, Prompts
 */

const createAlertElement = (type, title, message) => {
    const alertId = 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const iconMap = {
        'success': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
        'error': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        'warning': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        'info': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
        'permission-denied': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
    };

    const el = document.createElement('div');
    el.className = `alert alert-${type}`;
    el.id = alertId;
    el.style.cssText = `
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 0.95rem 1.15rem;
        border-radius: 14px;
        background: #ffffff;
        box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06);
        min-width: 320px;
        max-width: 440px;
        transform: translateX(120%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease;
        position: relative;
        overflow: hidden;
    `;

    el.innerHTML = `
        <div class="alert-icon" style="flex-shrink: 0; margin-top: 2px;">
            ${iconMap[type] || ''}
        </div>
        <div class="alert-content" style="flex: 1; font-size: 0.88rem; line-height: 1.45; color: var(--text-primary, #18181b);">
            ${title ? `<div style="font-weight: 800; font-size: 0.92rem; margin-bottom: 0.2rem; letter-spacing: -0.01em;">${title}</div>` : ''}
            <div style="color: var(--text-secondary, #52525b);">${message}</div>
        </div>
        <button type="button" class="alert-close" aria-label="Close" style="background: none; border: none; font-size: 1.3rem; color: #a1a1aa; cursor: pointer; line-height: 1; padding: 0 0.15rem; transition: color 0.15s ease;" onclick="document.getElementById('${alertId}')?.remove()">&times;</button>
    `;

    return el;
};

const show = (type, title, message, duration = 4500) => {
    let container = document.getElementById('alert-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alert-container';
        document.body.appendChild(container);
    }

    const alertEl = createAlertElement(type, title, message);
    container.appendChild(alertEl);

    // Trigger smooth entrance animation
    requestAnimationFrame(() => {
        alertEl.classList.add('show');
        alertEl.style.transform = 'translateX(0)';
    });

    if (duration > 0) {
        setTimeout(() => {
            if (document.getElementById(alertEl.id)) {
                alertEl.style.transform = 'translateX(120%)';
                alertEl.style.opacity = '0';
                setTimeout(() => alertEl.remove(), 300);
            }
        }, duration);
    }
};

/**
 * Universal Backdrop & Modal Builder for High-Quality Alerts
 */
const createModalDialog = ({
    iconHtml,
    iconBg = 'rgba(239, 68, 68, 0.12)',
    iconColor = '#ef4444',
    title,
    message,
    badgeText = null,
    badgeBg = 'rgba(239, 68, 68, 0.1)',
    badgeColor = '#ef4444',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    confirmBtnBg = null,
    onConfirm,
    onCancel
}) => {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(9, 9, 11, 0.72);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal-card';
    modal.style.cssText = `
        background: #ffffff;
        padding: 2.25rem 2rem 1.85rem;
        border-radius: 22px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
        transform: scale(0.93) translateY(10px);
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        text-align: center;
        position: relative;
        overflow: hidden;
    `;

    const resolvedConfirmBg = confirmBtnBg || (isDestructive ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(180deg, #27272a 0%, #18181b 100%)');
    const resolvedConfirmColor = '#ffffff';

    modal.innerHTML = `
        <!-- Top Icon Hero -->
        <div style="width: 62px; height: 62px; background: ${iconBg}; color: ${iconColor}; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.35rem auto; box-shadow: 0 8px 20px -4px ${iconBg};">
            ${iconHtml}
        </div>

        ${badgeText ? `
            <div style="margin-bottom: 0.6rem;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.2rem 0.65rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor};">
                    ${badgeText}
                </span>
            </div>
        ` : ''}

        <h3 style="font-size: 1.35rem; font-weight: 800; color: #18181b; margin: 0 0 0.55rem 0; letter-spacing: -0.02em;">
            ${title}
        </h3>

        <p style="font-size: 0.92rem; color: #52525b; margin: 0 0 1.85rem 0; line-height: 1.55;">
            ${message}
        </p>

        <!-- Actions -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" id="modal-btn-cancel" class="btn" style="flex: 1; min-width: 130px; padding: 0.75rem 1.15rem; font-weight: 600; font-size: 0.88rem; border-radius: 12px; border: 1.5px solid #e4e4e7; background: #ffffff; color: #3f3f46; cursor: pointer; transition: all 0.15s ease;">
                ${cancelText}
            </button>
            <button type="button" id="modal-btn-confirm" class="btn" style="flex: 1; min-width: 140px; padding: 0.75rem 1.25rem; font-weight: 700; font-size: 0.88rem; border-radius: 12px; border: 1px solid transparent; background: ${resolvedConfirmBg}; color: ${resolvedConfirmColor}; box-shadow: 0 4px 14px rgba(0,0,0,0.18); cursor: pointer; transition: all 0.15s ease;">
                ${confirmText}
            </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1) translateY(0)';
    });

    const cleanup = () => {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.95) translateY(6px)';
        window.removeEventListener('keydown', keyHandler);
        setTimeout(() => overlay.remove(), 220);
    };

    const confirmBtn = modal.querySelector('#modal-btn-confirm');
    const cancelBtn = modal.querySelector('#modal-btn-cancel');

    confirmBtn?.addEventListener('click', () => {
        cleanup();
        onConfirm();
    });

    cancelBtn?.addEventListener('click', () => {
        cleanup();
        onCancel();
    });

    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            cleanup();
            onCancel();
        } else if (e.key === 'Enter') {
            cleanup();
            onConfirm();
        }
    };
    window.addEventListener('keydown', keyHandler);
};

export const showAlert = {
    success: (message, title = '') => show('success', title, message),
    error: (message, title = 'Error') => show('error', title, message),
    warning: (message, title = 'Warning') => show('warning', title, message),
    info: (message, title = '') => show('info', title, message),
    permissionDenied: (message = "You do not have permission to perform this action.") => 
        show('permission-denied', 'Access Denied', message),

    /**
     * Standard Confirmation Modal
     */
    confirm: (message, title = 'Confirm Action', options = {}) => {
        return new Promise((resolve) => {
            createModalDialog({
                iconHtml: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
                iconBg: options.isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                iconColor: options.isDestructive ? '#ef4444' : '#2563eb',
                title: title,
                message: message,
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                isDestructive: options.isDestructive !== undefined ? options.isDestructive : true,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    },

    /**
     * Dedicated High-Fidelity Discard Handler Dialog
     * Shown when discarding unsaved modifications in settings or forms
     */
    confirmDiscard: (customMessage = null) => {
        return new Promise((resolve) => {
            createModalDialog({
                iconHtml: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
                iconBg: 'rgba(239, 68, 68, 0.12)',
                iconColor: '#ef4444',
                badgeText: 'Discard Changes',
                badgeBg: 'rgba(239, 68, 68, 0.1)',
                badgeColor: '#dc2626',
                title: 'Discard Unsaved Changes?',
                message: customMessage || 'You have unsaved changes in your workspace settings. If you discard now, all changes will revert to the last saved state.',
                confirmText: 'Discard Changes',
                cancelText: 'Keep Editing',
                isDestructive: true,
                confirmBtnBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    },

    /**
     * Dedicated Unsaved Changes Navigation Guard Dialog
     * Shown when user attempts to leave or switch views with unsaved changes
     */
    confirmUnsavedChanges: (customMessage = null) => {
        return new Promise((resolve) => {
            createModalDialog({
                iconHtml: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                iconBg: 'rgba(245, 158, 11, 0.14)',
                iconColor: '#d97706',
                badgeText: 'Unsaved Edits',
                badgeBg: 'rgba(245, 158, 11, 0.15)',
                badgeColor: '#b45309',
                title: 'Unsaved Edits in Progress',
                message: customMessage || 'You have modified settings that have not been saved yet. Leaving now will discard all of these edits.',
                confirmText: 'Stay & Save',
                cancelText: 'Discard & Leave',
                confirmBtnBg: 'linear-gradient(180deg, #27272a 0%, #18181b 100%)',
                onConfirm: () => resolve(false), // Stay & Save -> do NOT leave (false)
                onCancel: () => resolve(true)   // Discard & Leave -> allow leave (true)
            });
        });
    },

    /**
     * Value adjustment Prompt Modal
     */
    prompt: ({ title = 'Adjust Value', message = 'Enter value below:', defaultValue = '', inputType = 'number', confirmText = 'Confirm', cancelText = 'Cancel', min = 0, max = null } = {}) => {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(9, 9, 11, 0.72);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.25rem;
                opacity: 0;
                transition: opacity 0.22s ease;
            `;

            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal-card';
            modal.style.cssText = `
                background: #ffffff;
                padding: 2.25rem 2rem 1.85rem;
                border-radius: 22px;
                max-width: 440px;
                width: 100%;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
                transform: scale(0.93) translateY(10px);
                transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
            `;

            modal.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:1.25rem;">
                    <div style="width:48px; height:48px; border-radius:14px; background:rgba(225, 29, 72, 0.1); color:#e11d48; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div>
                        <h3 style="font-size:1.2rem; font-weight:800; color:#18181b; margin:0; letter-spacing:-0.02em;">${title}</h3>
                        <p style="font-size:0.85rem; color:#71717a; margin:0.2rem 0 0 0;">${message}</p>
                    </div>
                </div>

                <form id="alert-prompt-form" style="display:flex; flex-direction:column; gap:1.25rem;">
                    <div>
                        ${inputType === 'number' ? `
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <button type="button" id="prompt-step-minus" class="btn btn-secondary" style="width:46px; height:46px; font-size:1.3rem; font-weight:700; padding:0; border-radius:12px; display:flex; align-items:center; justify-content:center;">&minus;</button>
                                <input type="number" id="alert-prompt-input" value="${defaultValue}" min="${min}" ${max !== null ? `max="${max}"` : ''} class="form-control" style="flex:1; height:46px; text-align:center; font-size:1.25rem; font-weight:800; border-radius:12px; color:#18181b;" required autofocus>
                                <button type="button" id="prompt-step-plus" class="btn btn-secondary" style="width:46px; height:46px; font-size:1.3rem; font-weight:700; padding:0; border-radius:12px; display:flex; align-items:center; justify-content:center;">&plus;</button>
                            </div>
                        ` : `
                            <input type="${inputType}" id="alert-prompt-input" value="${defaultValue}" class="form-control" style="width:100%; height:44px; font-size:0.95rem; border-radius:12px; padding:0.5rem 0.85rem;" required autofocus>
                        `}
                    </div>

                    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                        <button type="button" id="alert-prompt-cancel" class="btn btn-secondary" style="padding:0.65rem 1.35rem; font-weight:600; border-radius:12px;">${cancelText}</button>
                        <button type="submit" id="alert-prompt-ok" class="btn btn-primary" style="padding:0.65rem 1.5rem; font-weight:700; border-radius:12px; background:linear-gradient(180deg, #27272a 0%, #18181b 100%); color:#ffffff;">${confirmText}</button>
                    </div>
                </form>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const inputEl = modal.querySelector('#alert-prompt-input');
            const formEl = modal.querySelector('#alert-prompt-form');
            const btnMinus = modal.querySelector('#prompt-step-minus');
            const btnPlus = modal.querySelector('#prompt-step-plus');

            if (btnMinus && inputEl) {
                btnMinus.addEventListener('click', () => {
                    let v = parseInt(inputEl.value, 10) || 0;
                    if (v > min) inputEl.value = v - 1;
                });
            }
            if (btnPlus && inputEl) {
                btnPlus.addEventListener('click', () => {
                    let v = parseInt(inputEl.value, 10) || 0;
                    if (max === null || v < max) inputEl.value = v + 1;
                });
            }

            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1) translateY(0)';
                inputEl?.focus();
                if (inputEl) inputEl.select();
            });

            const cleanup = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'scale(0.95) translateY(6px)';
                setTimeout(() => overlay.remove(), 220);
            };

            modal.querySelector('#alert-prompt-cancel')?.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

            formEl?.addEventListener('submit', (e) => {
                e.preventDefault();
                const val = inputEl ? inputEl.value : '';
                cleanup();
                resolve(inputType === 'number' ? (parseInt(val, 10) || 0) : val);
            });
        });
    }
};
