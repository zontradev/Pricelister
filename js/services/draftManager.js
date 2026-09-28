// draftManager.js - Enterprise Anti-Reload Protection & Progressive State Preservation
// Remembers user inputs/edits across page refreshes and manages Smart Unsaved Changes indicators.

class DraftManager {
    constructor() {
        this.registeredForms = new Map();
        this.setupBeforeUnload();
    }

    setupBeforeUnload() {
        if (typeof window === 'undefined') return;

        window.addEventListener('beforeunload', (e) => {
            if (this.hasAnyUnsaved()) {
                const message = 'You have unsaved changes in progress. Are you sure you want to leave or refresh?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });
    }

    // Generate unique storage key per workspace and form type
    getStorageKey(formKey, identifier = '') {
        const wsId = window.__activeWorkspaceId || 'global';
        return `pricelister_draft_${wsId}_${formKey}${identifier ? `_${identifier}` : ''}`;
    }

    saveDraft(formKey, data, identifier = '') {
        try {
            if (!data) return;
            const key = this.getStorageKey(formKey, identifier);
            sessionStorage.setItem(key, JSON.stringify({
                data,
                savedAt: Date.now()
            }));
        } catch (e) {
            console.warn('Draft save error:', e);
        }
    }

    getDraft(formKey, identifier = '') {
        try {
            const key = this.getStorageKey(formKey, identifier);
            const item = sessionStorage.getItem(key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            return parsed.data || null;
        } catch (e) {
            console.warn('Draft load error:', e);
            return null;
        }
    }

    clearDraft(formKey, identifier = '') {
        try {
            const key = this.getStorageKey(formKey, identifier);
            sessionStorage.removeItem(key);
        } catch (e) {
            console.warn('Draft clear error:', e);
        }
    }

    registerForm(id, isDirtyFn) {
        this.registeredForms.set(id, isDirtyFn);
    }

    registerActiveForm(id, isDirtyFn) {
        this.registerForm(id, isDirtyFn);
    }

    unregisterForm(id) {
        this.registeredForms.delete(id);
    }

    unregisterActiveForm(id) {
        this.unregisterForm(id);
    }

    hasActiveUnsavedChanges() {
        return this.hasAnyUnsaved();
    }

    hasAnyUnsaved() {
        for (const [id, isDirtyFn] of this.registeredForms.entries()) {
            try {
                if (typeof isDirtyFn === 'function' && isDirtyFn()) {
                    return true;
                }
            } catch (e) {
                console.warn(`Error checking dirty state for form ${id}:`, e);
            }
        }
        return false;
    }

    /**
     * Injects or attaches a Smart Unsaved Changes Indicator Pill at the top of a panel.
     * Clicking it opens an informative alert detailing unsaved changes & progressive auto-protection.
     */
    mountUnsavedIndicator(targetElement, { formType = 'edit', onSave = null } = {}) {
        if (!targetElement) return { update: () => {}, destroy: () => {} };

        // Create pill element
        const pill = document.createElement('div');
        pill.className = 'unsaved-changes-pill';
        pill.style.cssText = `
            display: none;
            align-items: center;
            gap: 0.5rem;
            background: rgba(225, 29, 72, 0.08);
            border: 1px solid rgba(225, 29, 72, 0.28);
            color: #e11d48;
            padding: 0.35rem 0.85rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            box-shadow: 0 2px 8px rgba(225, 29, 72, 0.12);
        `;

        pill.innerHTML = `
            <span class="unsaved-pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #e11d48; display: inline-block; animation: pulseGlow 1.5s infinite;"></span>
            <span class="unsaved-label">Unsaved changes detected</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left: 2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        `;

        pill.addEventListener('mouseenter', () => {
            pill.style.background = 'rgba(225, 29, 72, 0.14)';
            pill.style.transform = 'translateY(-1px)';
            pill.style.boxShadow = '0 4px 12px rgba(225, 29, 72, 0.2)';
        });

        pill.addEventListener('mouseleave', () => {
            pill.style.background = 'rgba(225, 29, 72, 0.08)';
            pill.style.transform = 'none';
            pill.style.boxShadow = '0 2px 8px rgba(225, 29, 72, 0.12)';
        });

        pill.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showUnsavedDetailsModal(formType, onSave);
        });

        // Prepend or inject
        targetElement.prepend(pill);

        return {
            update: (isDirty) => {
                if (isDirty) {
                    pill.style.display = 'inline-flex';
                } else {
                    pill.style.display = 'none';
                }
            },
            destroy: () => {
                pill.remove();
            }
        };
    }

    showUnsavedDetailsModal(formType, onSave = null) {
        // Remove existing if any
        document.getElementById('unsaved-details-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'unsaved-details-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            padding: 1rem;
        `;

        const isAdd = formType === 'add';
        const titleText = isAdd ? 'Unsaved New Entry in Progress' : 'Unsaved Changes Detected';
        const bodyText = isAdd 
            ? 'You are currently drafting a new entry. PriceLister auto-preserves your typed inputs even if you refresh or switch windows. Fill in the required fields and click <strong>Save / Create</strong> when ready to commit to cloud storage.'
            : 'You have modified fields or media in this form. Progressive state protection is active, but remember to click <strong>Update / Save Changes</strong> to sync your latest updates with the cloud.';

        modal.innerHTML = `
            <div class="card" style="background: #ffffff; border-radius: 16px; border: 1.5px solid #fecdd3; box-shadow: 0 20px 45px -10px rgba(225, 29, 72, 0.25); max-width: 460px; width: 100%; padding: 1.75rem; text-align: left; position: relative;">
                
                <div style="display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem;">
                    <div style="width: 46px; height: 46px; border-radius: 12px; background: #fff1f2; border: 1.5px solid #fecdd3; color: #e11d48; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(225,29,72,0.15);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary);">${titleText}</h3>
                        <span style="font-size: 0.76rem; font-weight: 700; color: #e11d48; text-transform: uppercase; letter-spacing: 0.05em;">Anti-Reload &amp; Draft Protected</span>
                    </div>
                </div>

                <p style="font-size: 0.88rem; line-height: 1.55; color: var(--text-secondary); margin: 0 0 1.25rem 0;">
                    ${bodyText}
                </p>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 0.95rem; font-size: 0.8rem; color: #475569; margin-bottom: 1.5rem; display: flex; gap: 0.6rem; align-items: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" style="flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    <span>Your text and selections will not be lost if you refresh this tab.</span>
                </div>

                <div style="display: flex; gap: 0.65rem; justify-content: flex-end; align-items: center;">
                    <button type="button" id="btn-close-unsaved-modal" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600; padding: 0.5rem 1.15rem;">
                        Got it, Continue Editing
                    </button>
                    ${onSave ? `
                        <button type="button" id="btn-quick-save-modal" class="btn btn-primary" style="background: linear-gradient(180deg, #27272a 0%, #18181b 100%); border: 1px solid #18181b; color: #ffffff; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 1.25rem; box-shadow: 0 4px 14px rgba(0,0,0,0.2);">
                            Save / Update Now
                        </button>
                    ` : ''}
                </div>

            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#btn-close-unsaved-modal')?.addEventListener('click', () => modal.remove());
        modal.querySelector('#btn-quick-save-modal')?.addEventListener('click', () => {
            modal.remove();
            if (typeof onSave === 'function') onSave();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }
}

export const draftManager = new DraftManager();
