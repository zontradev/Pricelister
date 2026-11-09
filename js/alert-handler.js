/**
 * Centralized Modern Alert & Dialog Handler
 * Provides world-class UI dialogs: Toasts, Confirms, Unsaved Changes Modals, Discard Handlers, Prompts
 * Strictly adheres to Reference Image 1:
 * - Pure centered card, rounded corners (20px)
 * - Top-right dismiss '✕' button
 * - Centered 64px round icon badge with clean outline SVG (context-aware per action)
 * - Big bold title (font-weight: 800)
 * - Centered description text
 * - Clean subtle divider line (#E4E4E7)
 * - Side-by-side action buttons: Outlined Cancel (left) & Solid Action button (right) with inline SVG icon
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
        border: 1px solid var(--border-color, #e4e4e7);
        color: var(--text-primary);
        box-shadow: 0 12px 32px -8px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.04);
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
        <div class="alert-content" style="flex: 1; font-size: 0.88rem; line-height: 1.45; color: var(--text-primary, #09090b);">
            ${title ? `<div style="font-weight: 800; font-size: 0.92rem; margin-bottom: 0.2rem; letter-spacing: -0.01em;">${title}</div>` : ''}
            <div style="color: var(--text-secondary, #71717a);">${message}</div>
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
 * Universal Modal Dialog Builder matching Reference Image 1:
 * - Centered card with 20px border radius, white background, soft shadow (0 20px 50px -12px rgba(0,0,0,0.12))
 * - Absolute top-right close '✕' button
 * - Centered 64px round icon badge (soft background #F1F5F9, dark icon)
 * - Centered title (1.35rem, font-weight: 800, color #09090B)
 * - Centered message (0.92rem, color #71717A)
 * - Thin divider (1px #E4E4E7)
 * - Side-by-side action buttons: Outlined Cancel (left) & Black Solid Action (right) with inline action SVG
 */
const createModalDialog = ({
    iconHtml,
    iconBg = '#f1f5f9',
    iconColor = '#09090b',
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmIconHtml = null,
    isDestructive = false,
    confirmBtnBg = null,
    detailsHtml = null,
    onConfirm,
    onCancel,
    onClose = null
}) => {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(9, 9, 11, 0.45);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        opacity: 0;
        transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal-card';
    modal.style.cssText = `
        background: #ffffff;
        padding: 2.25rem 2rem 1.85rem;
        border-radius: 20px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
        border: 1px solid #e4e4e7;
        color: #09090b;
        transform: scale(0.94) translateY(8px);
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
        text-align: center;
        position: relative;
        overflow: hidden;
        box-sizing: border-box;
    `;

    // Determine action button background and text
    const resolvedConfirmBg = confirmBtnBg || '#18181b';
    const resolvedConfirmColor = '#ffffff';

    // Default action icon if not provided
    const resolvedConfirmIcon = confirmIconHtml || (isDestructive 
        ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
        : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    );

    modal.innerHTML = `
        <!-- Top Right Close Button -->
        <button type="button" id="modal-btn-close" aria-label="Close" style="position: absolute; top: 1.25rem; right: 1.25rem; background: none; border: none; font-size: 1.25rem; color: #a1a1aa; cursor: pointer; line-height: 1; padding: 4px; border-radius: 6px; transition: color 0.15s ease;">&times;</button>

        <!-- Top Centered Icon Hero (64x64 circle badge matching Ref Image 1) -->
        <div style="width: 64px; height: 64px; background: ${iconBg}; color: ${iconColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.35rem; border: 1px solid rgba(0,0,0,0.04);">
            ${iconHtml}
        </div>

        <!-- Big Bold Title -->
        <h3 style="font-size: 1.35rem; font-weight: 800; color: #09090b; margin: 0 0 0.5rem 0; letter-spacing: -0.02em;">
            ${title}
        </h3>

        <!-- Subtitle / Description -->
        <p style="font-size: 0.92rem; color: #71717a; margin: 0 0 1.5rem 0; line-height: 1.55; padding: 0 0.5rem;">
            ${message}
        </p>

        <!-- Optional Detail Content -->
        ${detailsHtml ? `
            <div style="margin-bottom: 1.35rem; text-align: left;">
                ${detailsHtml}
            </div>
        ` : ''}

        <!-- Thin Horizontal Divider Line -->
        <div style="height: 1px; background: #e4e4e7; margin: 0 0 1.25rem 0; width: 100%;"></div>

        <!-- Two Action Buttons Side-by-Side: Cancel (left) & Action (right) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; width: 100%;">
            <button type="button" id="modal-btn-cancel" class="btn" style="height: 46px; font-weight: 700; font-size: 0.92rem; border-radius: 12px; border: 1.5px solid #e4e4e7; background: #ffffff; color: #09090b; cursor: pointer; transition: all 0.15s ease; display: inline-flex; align-items: center; justify-content: center;">
                ${cancelText}
            </button>
            <button type="button" id="modal-btn-confirm" class="btn" style="height: 46px; font-weight: 700; font-size: 0.92rem; border-radius: 12px; border: none; background: ${resolvedConfirmBg}; color: ${resolvedConfirmColor}; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.15s ease;">
                ${resolvedConfirmIcon}
                <span>${confirmText}</span>
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

    const onDismiss = typeof onClose === 'function' ? onClose : onCancel;

    confirmBtn?.addEventListener('click', () => {
        cleanup();
        onConfirm();
    });

    cancelBtn?.addEventListener('click', () => {
        cleanup();
        onCancel();
    });

    // Close button (x): uses onDismiss (defaults to onClose if provided, e.g. Stay)
    closeBtn?.addEventListener('click', () => {
        cleanup();
        onDismiss();
    });

    // Clicking outside modal in the empty backdrop area triggers onDismiss (Stay for unsaved edits)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cleanup();
            onDismiss();
        }
    });

    const keyHandler = (e) => {
        if (e.key === 'Escape') {
            cleanup();
            onDismiss();
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
     * Standard Confirmation Modal (Matching Reference Image 1 exactly)
     * Auto-detects action type (Log Out, Delete, Discard, Remove, Export, Duplicate)
     * and customizes icon, labels, and button icon for each section.
     */
    confirm: (message, title = 'Confirm Action', options = {}) => {
        return new Promise((resolve) => {
            const rawMsg = (message || '').toLowerCase();
            const rawTitle = (title || '').toLowerCase();

            // 1. Detect Logout Action (Exact Match with Reference Image 1)
            const isLogout = rawMsg.includes('sign out') || rawMsg.includes('log out') || rawMsg.includes('logout') || rawTitle.includes('log out') || rawTitle.includes('sign out');
            
            // 2. Detect Delete Action
            const isDelete = options.isDestructive || rawMsg.includes('delete') || rawMsg.includes('remove') || rawMsg.includes('destroy') || rawTitle.includes('delete') || rawTitle.includes('remove');

            // 3. Detect Leave Workspace Action
            const isLeave = rawMsg.includes('leave this workspace') || rawTitle.includes('leave workspace');

            // 4. Detect Duplicate Action
            const isDuplicate = rawMsg.includes('duplicate') || rawTitle.includes('duplicate');

            // 5. Detect Reset Action
            const isReset = rawMsg.includes('reset') || rawTitle.includes('reset');

            // Determine Icon Badge and Confirm Button Icon
            let iconHtml = options.iconHtml;
            let confirmIcon = options.confirmIconHtml || null;
            let resolvedTitle = title;
            let confirmText = options.confirmText;

            if (isLogout) {
                if (!options.title || options.title === 'Confirm Action') resolvedTitle = 'Log Out';
                if (!confirmText) confirmText = 'Log Out';
                options.isDestructive = false;
                if (!options.confirmBtnBg) options.confirmBtnBg = '#09090b';
                // Exit door SVG matching Reference Image 1 & Image 2
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#09090B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
                }
            } else if (isDelete) {
                if (!options.title || options.title === 'Confirm Action') resolvedTitle = 'Delete Item';
                if (!confirmText) confirmText = 'Delete';
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
                }
            } else if (isLeave) {
                if (!options.title || options.title === 'Confirm Action') resolvedTitle = 'Leave Workspace';
                if (!confirmText) confirmText = 'Leave';
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
                }
            } else if (isDuplicate) {
                if (!options.title || options.title === 'Confirm Action') resolvedTitle = 'Duplicate Item';
                if (!confirmText) confirmText = 'Duplicate';
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }
            } else if (isReset) {
                if (!options.title || options.title === 'Confirm Action') resolvedTitle = 'Reset Data';
                if (!confirmText) confirmText = 'Reset';
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>';
                }
            } else {
                if (!iconHtml) {
                    iconHtml = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
                }
                if (!confirmIcon) {
                    confirmIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                }
                if (!confirmText) confirmText = 'Confirm';
            }

            createModalDialog({
                iconHtml: iconHtml,
                iconBg: '#F4F4F5',
                iconColor: '#18181B',
                title: resolvedTitle,
                message: message,
                confirmText: confirmText,
                cancelText: options.cancelText || 'Cancel',
                confirmIconHtml: confirmIcon,
                isDestructive: false,
                confirmBtnBg: options.confirmBtnBg || '#18181B',
                detailsHtml: options.detailsHtml || null,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    },

    /**
     * Dedicated Discard Handler Dialog
     * Shown when discarding unsaved modifications in settings or forms
     */
    confirmDiscard: (customMessage = null) => {
        return new Promise((resolve) => {
            createModalDialog({
                iconHtml: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
                iconBg: '#F4F4F5',
                iconColor: '#18181B',
                title: 'Discard Changes',
                message: customMessage || 'Are you sure you want to discard your changes? All unsaved modifications will be permanently lost.',
                confirmText: 'Discard Changes',
                cancelText: 'Keep Editing',
                confirmIconHtml: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
                isDestructive: false,
                confirmBtnBg: '#18181B',
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
                iconHtml: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
                iconBg: 'rgba(245, 158, 11, 0.12)',
                iconColor: '#d97706',
                title: 'Unsaved Edits',
                message: customMessage || 'You have modified settings that have not been saved yet. Leaving now will discard all of these edits.',
                confirmText: 'Stay & Save',
                cancelText: 'Discard & Leave',
                confirmIconHtml: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
                confirmBtnBg: '#09090b',
                onConfirm: () => resolve(false), // Stay & Save -> do NOT leave (false)
                onCancel: () => resolve(true),   // Discard & Leave -> allow leave (true)
                onClose: () => resolve(false)    // Close button (x), backdrop click, or Escape -> STAY (false)!
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
                background: rgba(9, 9, 11, 0.45);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.25rem;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;

            const modal = document.createElement('div');
            modal.className = 'custom-alert-modal-card';
            modal.style.cssText = `
                background: #ffffff;
                padding: 2.25rem 2rem 1.85rem;
                border-radius: 20px;
                max-width: 440px;
                width: 100%;
                box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04);
                border: 1px solid #e4e4e7;
                color: #09090b;
                transform: scale(0.94) translateY(8px);
                transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
                text-align: center;
                position: relative;
                box-sizing: border-box;
            `;

            modal.innerHTML = `
                <!-- Top Right Close Button -->
                <button type="button" id="alert-prompt-close" aria-label="Close" style="position: absolute; top: 1.25rem; right: 1.25rem; background: none; border: none; font-size: 1.25rem; color: #a1a1aa; cursor: pointer; line-height: 1; padding: 4px; border-radius: 6px;">&times;</button>

                <!-- Centered Icon Badge -->
                <div style="width: 64px; height: 64px; border-radius: 50%; background: #f1f5f9; color: #09090b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.35rem; border: 1px solid #e4e4e7;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </div>

                <h3 style="font-size: 1.35rem; font-weight: 800; color: #09090b; margin: 0 0 0.5rem 0; letter-spacing: -0.02em;">${title}</h3>
                <p style="font-size: 0.92rem; color: #71717a; margin: 0 0 1.5rem 0; line-height: 1.5;">${message}</p>

                <form id="alert-prompt-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div>
                        ${inputType === 'number' ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <button type="button" id="prompt-step-minus" class="btn" style="width: 46px; height: 46px; font-size: 1.3rem; font-weight: 700; padding: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1.5px solid #e4e4e7; color: #09090b; cursor: pointer;">&minus;</button>
                                <input type="number" id="alert-prompt-input" value="${defaultValue}" min="${min}" ${max !== null ? `max="${max}"` : ''} class="form-control" style="flex: 1; height: 46px; text-align: center; font-size: 1.25rem; font-weight: 800; border-radius: 12px; background: #f4f4f5; border: 1.5px solid #e4e4e7; color: #09090b;" required autofocus>
                                <button type="button" id="prompt-step-plus" class="btn" style="width: 46px; height: 46px; font-size: 1.3rem; font-weight: 700; padding: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #ffffff; border: 1.5px solid #e4e4e7; color: #09090b; cursor: pointer;">&plus;</button>
                            </div>
                        ` : `
                            <input type="${inputType}" id="alert-prompt-input" value="${defaultValue}" class="form-control" style="width: 100%; height: 46px; font-size: 0.95rem; border-radius: 12px; padding: 0.5rem 0.85rem; background: #f4f4f5; border: 1.5px solid #e4e4e7; color: #09090b; box-sizing: border-box;" required autofocus>
                        `}
                    </div>

                    <div style="height: 1px; background: #e4e4e7; width: 100%;"></div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; width: 100%;">
                        <button type="button" id="alert-prompt-cancel" class="btn" style="height: 46px; font-weight: 700; font-size: 0.92rem; border-radius: 12px; background: #ffffff; border: 1.5px solid #e4e4e7; color: #09090b; cursor: pointer;">${cancelText}</button>
                        <button type="submit" id="alert-prompt-ok" class="btn" style="height: 46px; font-weight: 700; font-size: 0.92rem; border-radius: 12px; background: #09090b; color: #ffffff; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>${confirmText}</span>
                        </button>
                    </div>
                </form>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const inputEl = modal.querySelector('#alert-prompt-input');
            const formEl = modal.querySelector('#alert-prompt-form');
            const btnMinus = modal.querySelector('#prompt-step-minus');
            const btnPlus = modal.querySelector('#prompt-step-plus');
            const closeBtn = modal.querySelector('#alert-prompt-close');

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

            closeBtn?.addEventListener('click', () => {
                cleanup();
                resolve(null);
            });

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
