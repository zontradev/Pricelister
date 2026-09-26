import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getSettingsService } from '../services/settingsService.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

export const renderSettings = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem;">
            <h2>Workspace Settings</h2>
            <div id="settings-role-badge"></div>
        </div>
        <div id="settings-content-area">
            <div class="skeleton-shimmer" style="width: 100%; height: 260px; border-radius: var(--radius-card);"></div>
        </div>
    `;

    const contentArea = container.querySelector('#settings-content-area');
    const roleBadgeArea = container.querySelector('#settings-role-badge');

    try {
        // 1. DETERMINE USER'S ROLE IN THIS WORKSPACE
        let userRole = 'WORKER';
        let isAdmin = false;
        let isCoAdmin = false;

        const wsRef = doc(db, 'Workspaces', workspaceId);
        const wsSnap = await getDoc(wsRef);
        const wsData = wsSnap.exists() ? wsSnap.data() : {};

        // Check if user is Workspace Creator / Owner
        if (wsData.adminId === currentUser.uid || workspaceId === currentUser.uid) {
            userRole = 'CREATOR_ADMIN';
            isAdmin = true;
        } else {
            // Check Members subcollection
            for (const sub of ['Members', 'members']) {
                try {
                    const mRef = doc(db, 'Workspaces', workspaceId, sub, currentUser.uid);
                    const mSnap = await getDoc(mRef);
                    if (mSnap.exists()) {
                        const mData = mSnap.data();
                        userRole = (mData.role || 'WORKER').toUpperCase();
                        break;
                    }
                    if (currentUser.email) {
                        const qMem = query(collection(db, 'Workspaces', workspaceId, sub), where('email', '==', currentUser.email));
                        const qSnap = await getDocs(qMem);
                        if (!qSnap.empty) {
                            userRole = (qSnap.docs[0].data().role || 'WORKER').toUpperCase();
                            break;
                        }
                    }
                } catch(e) {}
            }

            if (userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR') {
                isAdmin = true;
            } else if (userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN') {
                isCoAdmin = true;
            }
        }

        const canAccessSettings = isAdmin || isCoAdmin;

        // 2. WORKER RESTRICTION CHECK
        if (!canAccessSettings) {
            contentArea.innerHTML = `
                <div class="card" style="padding: 3rem 2rem; text-align: center; max-width: 540px; margin: 2rem auto; border-radius: var(--radius-card); box-shadow: var(--shadow-elevated);">
                    <div style="color: var(--primary); margin-bottom: 1.25rem;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h3 style="color: var(--text-primary); margin-bottom: 0.75rem; font-size: 1.4rem;">Access Restricted</h3>
                    <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.5rem;">
                        Workspace Settings and Vending Mode configurations can only be managed by <strong>Admins</strong> and <strong>Co-Admins</strong>.
                        Workers have limited operational permissions and cannot view or alter workspace preferences.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center;">
                        <button class="btn btn-secondary" onclick="window.location.hash='#/overview'">Back to Overview</button>
                        <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'">Create Invoices</button>
                    </div>
                </div>
            `;
            return;
        }

        // Show Admin/Co-Admin badge in header
        if (roleBadgeArea) {
            roleBadgeArea.innerHTML = `
                <span class="badge" style="background: ${isAdmin ? '#be123c' : '#9c27b0'}; color: white; padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 600;">
                    ${isAdmin ? 'Creator Admin' : 'Co-Admin'} Mode
                </span>
            `;
        }

        // 3. LOAD WORKSPACE SETTINGS FROM SERVER (ReceiptData & Workspaces)
        const settingsService = getSettingsService(workspaceId);
        const currentSettings = await settingsService.getWorkspaceSettings();

        // 4. RENDER SETTINGS INTERFACE
        contentArea.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.75rem; max-width: 1000px;">
                
                <!-- VENDING MODE (PRIMARY FEATURE) -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); grid-column: 1 / -1; border-left: 4px solid var(--primary); background: rgba(255, 255, 255, 0.95);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 260px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary); font-weight: 700;">Vending Mode (Inventory Automation)</h3>
                            </div>
                            <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.5; margin: 0;">
                                Enable real-time factual sales tracking. When active, every created invoice automatically deducts product items from your live stock.
                            </p>
                        </div>

                        <div>
                            <label class="switch-container">
                                <input type="checkbox" id="set-vending" class="switch-input" ${currentSettings.enableVending ? 'checked' : ''}>
                                <span class="switch-track">
                                    <span class="switch-thumb"></span>
                                </span>
                                <span id="vending-status-label" style="font-size: 0.9rem; font-weight: 600; color: ${currentSettings.enableVending ? 'var(--primary)' : 'var(--text-muted)'}; min-width: 80px;">
                                    ${currentSettings.enableVending ? 'ENABLED' : 'DISABLED'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div id="vending-info-banner" style="margin-top: 1.25rem; padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.85rem; background: ${currentSettings.enableVending ? 'rgba(16, 185, 129, 0.08)' : 'rgba(241, 245, 249, 0.8)'}; border: 1px solid ${currentSettings.enableVending ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}; color: ${currentSettings.enableVending ? '#047857' : 'var(--text-secondary)'};">
                        ${currentSettings.enableVending 
                            ? '<strong>Active Mode:</strong> Products added to customer or business invoices will reduce inventory quantity in real-time on save.' 
                            : '<strong>Standard Mode:</strong> Invoices are generated as records only. Product quantities in inventory will remain unaffected.'
                        }
                    </div>
                </div>

                <!-- GENERAL WORKSPACE INFO -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card);">
                    <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-primary);">
                        General Workspace
                    </h3>
                    
                    <form id="settings-general-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Workspace Name *</label>
                            <input type="text" id="set-name" class="form-control" value="${currentSettings.name || wsData.name || ''}" required>
                        </div>

                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Business Email *</label>
                            <input type="email" id="set-email" class="form-control" value="${currentSettings.email || wsData.email || ''}" required>
                        </div>

                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Business Phone</label>
                            <input type="text" id="set-phone" class="form-control" value="${currentSettings.phone || wsData.phone || ''}">
                        </div>

                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Business Address</label>
                            <textarea id="set-address" class="form-control" style="min-height: 80px;">${currentSettings.address || wsData.address || ''}</textarea>
                        </div>
                    </form>
                </div>

                <!-- RECEIPT & INVOICE PRINT SETTINGS -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card);">
                    <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; font-size: 1.1rem; color: var(--text-primary);">
                        Receipt & Print Details
                    </h3>

                    <form id="settings-receipt-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Shop / Display Name</label>
                            <input type="text" id="set-shop-name" class="form-control" value="${currentSettings.shopName || ''}" placeholder="Appears at top of receipts">
                        </div>

                        <div class="form-group">
                            <label style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Receipt End Message</label>
                            <input type="text" id="set-end-msg" class="form-control" value="${currentSettings.endMessage || ''}" placeholder="e.g. Thank you for your business!">
                        </div>

                        <div class="form-group" style="margin-top: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.9rem;">
                                <input type="checkbox" id="set-show-cust-name" ${currentSettings.customerName ? 'checked' : ''}>
                                <span>Print Customer Name on Receipts</span>
                            </label>
                        </div>

                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.9rem;">
                                <input type="checkbox" id="set-show-cust-num" ${currentSettings.customerNumber ? 'checked' : ''}>
                                <span>Print Customer Phone on Receipts</span>
                            </label>
                        </div>
                    </form>
                </div>

                <!-- SAVE ACTIONS -->
                <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 1rem; margin-top: 0.5rem;">
                    <button type="button" id="btn-save-settings" class="btn btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem;">
                        Save Workspace Settings
                    </button>
                </div>

            </div>
        `;

        // Switch interaction
        const vendingInput = contentArea.querySelector('#set-vending');
        const vendingLabel = contentArea.querySelector('#vending-status-label');
        const vendingBanner = contentArea.querySelector('#vending-info-banner');

        if (vendingInput) {
            vendingInput.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                vendingLabel.textContent = isChecked ? 'ENABLED' : 'DISABLED';
                vendingLabel.style.color = isChecked ? 'var(--primary)' : 'var(--text-muted)';
                if (isChecked) {
                    vendingBanner.style.background = 'rgba(16, 185, 129, 0.08)';
                    vendingBanner.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                    vendingBanner.style.color = '#047857';
                    vendingBanner.innerHTML = '<strong>Active Mode:</strong> Products added to customer or business invoices will reduce inventory quantity in real-time on save.';
                } else {
                    vendingBanner.style.background = 'rgba(241, 245, 249, 0.8)';
                    vendingBanner.style.borderColor = 'var(--border-color)';
                    vendingBanner.style.color = 'var(--text-secondary)';
                    vendingBanner.innerHTML = '<strong>Standard Mode:</strong> Invoices are generated as records only. Product quantities in inventory will remain unaffected.';
                }
            });
        }

        // Save handler
        const btnSave = contentArea.querySelector('#btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                btnSave.disabled = true;
                btnSave.textContent = 'Saving...';

                try {
                    const updatedPayload = {
                        enableVending: Boolean(contentArea.querySelector('#set-vending')?.checked),
                        name: contentArea.querySelector('#set-name')?.value.trim() || '',
                        email: contentArea.querySelector('#set-email')?.value.trim() || '',
                        phone: contentArea.querySelector('#set-phone')?.value.trim() || '',
                        address: contentArea.querySelector('#set-address')?.value.trim() || '',
                        shopName: contentArea.querySelector('#set-shop-name')?.value.trim() || '',
                        endMessage: contentArea.querySelector('#set-end-msg')?.value.trim() || '',
                        customerName: Boolean(contentArea.querySelector('#set-show-cust-name')?.checked),
                        customerNumber: Boolean(contentArea.querySelector('#set-show-cust-num')?.checked)
                    };

                    await settingsService.saveWorkspaceSettings(updatedPayload);
                    showAlert.success("Workspace settings & Vending mode saved successfully!");

                } catch (err) {
                    console.error("Save settings error:", err);
                    showAlert.error("Failed to save settings: " + (err.message || 'Unknown error'));
                } finally {
                    btnSave.disabled = false;
                    btnSave.textContent = 'Save Workspace Settings';
                }
            });
        }

    } catch (err) {
        console.error("Render settings error:", err);
        showAlert.error("Failed to load workspace settings.");
    }
};
