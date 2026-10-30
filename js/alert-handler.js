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
        background: var(--bg-card, #ffffff);
        border: 1px solid var(--border-color, #e2e8f0);
        color: var(--text-primary);
        box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.06);
        min-width: 320px;
        max-width: 440px;
        transform: translateX(-120%);
        opacity: 0;
        transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease;
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
        <button type="button" class="alert-close" aria-label="Close" style="background: none; border: none; font-size: 1.3rem; color: #a1a1aa; cursor: pointer; line-height: 1; padding: 0 0.15rem; transition: color 0.15s ease;">&times;</button>
    `;

    return el;
};

const dismissAlert = (targetEl) => {
    if (!targetEl || targetEl._isDismissing) return;
    targetEl._isDismissing = true;
    targetEl.classList.remove('show');
    targetEl.classList.add('dismissing');
    targetEl.style.transform = 'translateX(120%)';
    targetEl.style.opacity = '0';
    setTimeout(() => {
        try { targetEl.remove(); } catch(e) {}
    }, 320);
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

    // Wire manual close button with right-slide exit animation
    const closeBtn = alertEl.querySelector('.alert-close');
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            dismissAlert(alertEl);
        };
    }

    // Trigger smooth left-slide entrance animation
    requestAnimationFrame(() => {
        alertEl.classList.add('show');
        alertEl.style.transform = 'translateX(0)';
        alertEl.style.opacity = '1';
    });

    if (duration > 0) {
        setTimeout(() => {
            if (document.getElementById(alertEl.id)) {
                dismissAlert(alertEl);
            }
        }, duration);
    }
};

/**
 * Universal Backdrop & Modal Builder for High-Quality Alerts
 */
const createModalDialog = ({
    iconHtml,
    iconBg = 'rgba(37, 99, 235, 0.12)',
    iconColor = '#2563eb',
    title,
    message,
    badgeText = null,
    badgeBg = 'rgba(37, 99, 235, 0.1)',
    badgeColor = '#2563eb',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    confirmBtnBg = null,
    detailsHtml = null,
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
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
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
        background: var(--bg-card, #ffffff);
        padding: 2.25rem 2.25rem 2rem;
        border-radius: 24px;
        max-width: 480px;
        width: 100%;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.06);
        border: 1px solid var(--border-color, #e2e8f0);
        color: var(--text-primary);
        transform: scale(0.93) translateY(10px);
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        text-align: left;
        position: relative;
        overflow: hidden;
    `;

    // Default confirm button: Outlined grey with black text (or destructive red if isDestructive)
    const resolvedConfirmBg = confirmBtnBg || (isDestructive ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--btn-primary-bg, #ffffff)');
    const resolvedConfirmColor = isDestructive ? '#ffffff' : 'var(--btn-primary-text, #0f172a)';
    const resolvedConfirmBorder = isDestructive ? 'none' : '1.5px solid #cbd5e1';

    modal.innerHTML = `
        <!-- Top Right Close Button -->
        <button type="button" id="modal-btn-close" aria-label="Close" style="position: absolute; top: 1.25rem; right: 1.25rem; background: none; border: none; font-size: 1.35rem; color: var(--text-muted, #94a3b8); cursor: pointer; line-height: 1; padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease;">&times;</button>

        <!-- Top Icon Hero -->
        <div style="width: 58px; height: 58px; background: ${iconBg}; color: ${iconColor}; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 0 1.25rem 0; box-shadow: 0 8px 20px -4px ${iconBg}; border: 1px solid rgba(0,0,0,0.06);">
            ${iconHtml}
        </div>

        ${badgeText ? `
            <div style="margin-bottom: 0.6rem;">
                <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.2rem 0.65rem; border-radius: 999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid rgba(0,0,0,0.08);">
                    ${badgeText}
                </span>
            </div>
        ` : ''}

        <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary, #0f172a); margin: 0 0 0.55rem 0; letter-spacing: -0.02em;">
            ${title}
        </h3>

        <p style="font-size: 0.93rem; color: var(--text-secondary, #475569); margin: 0 0 1.5rem 0; line-height: 1.55;">
            ${message}
        </p>

        <!-- Optional Image 5 Detail Pill Card -->
        ${detailsHtml ? `
            <div style="margin-bottom: 1.65rem;">
                ${detailsHtml}
            </div>
        ` : ''}

        <!-- Actions -->
        <div style="display: flex; gap: 0.85rem; flex-wrap: wrap;">
            <button type="button" id="modal-btn-confirm" class="btn" style="flex: 1.2; min-width: 150px; padding: 0.85rem 1.4rem; font-weight: 700; font-size: 0.92rem; border-radius: 12px; border: ${resolvedConfirmBorder}; background: ${resolvedConfirmBg}; color: ${resolvedConfirmColor}; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.45rem; transition: all 0.15s ease;">
                ${confirmText}
            </button>
            <button type="button" id="modal-btn-cancel" class="btn" style="flex: 1; min-width: 120px; padding: 0.85rem 1.25rem; font-weight: 700; font-size: 0.92rem; border-radius: 12px; border: 1.5px solid #cbd5e1; background: var(--surface-100, #ffffff); color: var(--text-primary, #0f172a); cursor: pointer; transition: all 0.15s ease;">
                ${cancelText}
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
    const closeBtn = modal.querySelector('#modal-btn-close');

    confirmBtn?.addEventListener('click', () => {
        cleanup();
        onConfirm();
    });

    cancelBtn?.addEventListener('click', () => {
        cleanup();
        onCancel();
    });

    closeBtn?.addEventListener('click', () => {
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
     * Standard Confirmation Modal (Image 5 Parity)
     */
    confirm: (message, title = 'Confirm Action', options = {}) => {
        return new Promise((resolve) => {
            createModalDialog({
                iconHtml: options.iconHtml || '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
                iconBg: options.iconBg || (options.isDestructive ? 'rgba(239, 68, 68, 0.12)' : 'rgba(37, 99, 235, 0.12)'),
                iconColor: options.iconColor || (options.isDestructive ? '#ef4444' : '#2563eb'),
                title: title,
                message: message,
                confirmText: options.confirmText || 'Confirm',
                cancelText: options.cancelText || 'Cancel',
                isDestructive: options.isDestructive !== undefined ? options.isDestructive : false,
                confirmBtnBg: options.confirmBtnBg || null,
                detailsHtml: options.detailsHtml || null,
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
                background: var(--bg-card, #ffffff);
                padding: 2.25rem 2rem 1.85rem;
                border-radius: 22px;
                max-width: 440px;
                width: 100%;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08);
                border: 1px solid var(--border-color, #e2e8f0);
                color: var(--text-primary);
                transform: scale(0.93) translateY(10px);
                transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
            `;

            modal.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:1.25rem;">
                    <div style="width:48px; height:48px; border-radius:14px; background:var(--surface-100); color:var(--text-primary); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--border-color);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </div>
                    <div>
                        <h3 style="font-size:1.2rem; font-weight:800; color:var(--text-primary); margin:0; letter-spacing:-0.02em;">${title}</h3>
                        <p style="font-size:0.85rem; color:var(--text-secondary); margin:0.2rem 0 0 0;">${message}</p>
                    </div>
                </div>

                <form id="alert-prompt-form" style="display:flex; flex-direction:column; gap:1.25rem;">
                    <div>
                        ${inputType === 'number' ? `
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <button type="button" id="prompt-step-minus" class="btn btn-secondary" style="width:46px; height:46px; font-size:1.3rem; font-weight:700; padding:0; border-radius:12px; display:flex; align-items:center; justify-content:center; background:var(--surface-100); border:1.5px solid #cbd5e1; color:var(--text-primary);">&minus;</button>
                                <input type="number" id="alert-prompt-input" value="${defaultValue}" min="${min}" ${max !== null ? `max="${max}"` : ''} class="form-control" style="flex:1; height:46px; text-align:center; font-size:1.25rem; font-weight:800; border-radius:12px; background:var(--surface-100); border:1.5px solid #cbd5e1; color:var(--text-primary);" required autofocus>
                                <button type="button" id="prompt-step-plus" class="btn btn-secondary" style="width:46px; height:46px; font-size:1.3rem; font-weight:700; padding:0; border-radius:12px; display:flex; align-items:center; justify-content:center; background:var(--surface-100); border:1.5px solid #cbd5e1; color:var(--text-primary);">&plus;</button>
                            </div>
                        ` : `
                            <input type="${inputType}" id="alert-prompt-input" value="${defaultValue}" class="form-control" style="width:100%; height:44px; font-size:0.95rem; border-radius:12px; padding:0.5rem 0.85rem; background:var(--surface-100); border:1.5px solid #cbd5e1; color:var(--text-primary);" required autofocus>
                        `}
                    </div>

                    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
                        <button type="button" id="alert-prompt-cancel" class="btn btn-secondary" style="padding:0.65rem 1.35rem; font-weight:700; border-radius:12px; background:var(--surface-100); border:1.5px solid #cbd5e1; color:var(--text-primary);">${cancelText}</button>
                        <button type="submit" id="alert-prompt-ok" class="btn btn-primary" style="padding:0.65rem 1.5rem; font-weight:700; border-radius:12px; background:var(--btn-primary-bg); color:var(--btn-primary-text); border:1px solid var(--btn-primary-border);">${confirmText}</button>
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
