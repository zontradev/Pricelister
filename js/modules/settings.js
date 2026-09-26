import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getSettingsService } from '../services/settingsService.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { downloadSampleExcelTemplate } from '../utils/exportEngine.js';

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
            roleBadgeArea.innerHTML = getRoleBadgeHtml(isAdmin ? 'CREATOR_ADMIN' : 'CO_ADMIN');
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

                <!-- 4. DATA MANAGEMENT & EXPORT / IMPORT -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); grid-column: 1 / -1; background: var(--surface-0); border: 1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.25rem 0; display:flex; align-items:center; gap:0.5rem;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Data Management & Excel Tools
                            </h3>
                            <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Import spreadsheets with auto-category grouping, generate custom Excel & PDF reports, or download full backups.</p>
                        </div>
                        <button id="btn-settings-sample-template" class="btn btn-secondary" style="font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Sample Excel Template
                        </button>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                        <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <strong style="display:block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Excel & CSV Import</strong>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Batch add products with automatic column detection, category clustering, and custom color assignment.</p>
                            </div>
                            <button id="btn-settings-import-excel" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 600; width: 100%; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Launch Import Tool
                            </button>
                        </div>

                        <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <strong style="display:block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Custom Data Exporter</strong>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Export customizable Excel spreadsheets, printable PDF price lists with catalogs, or full JSON backups.</p>
                            </div>
                            <button id="btn-settings-export-data" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600; width: 100%; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Launch Exporter
                            </button>
                        </div>
                    </div>
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

        // Data Management Button Handlers
        const btnSample = contentArea.querySelector('#btn-settings-sample-template');
        if (btnSample) {
            btnSample.addEventListener('click', () => downloadSampleExcelTemplate());
        }

        const btnImport = contentArea.querySelector('#btn-settings-import-excel');
        if (btnImport) {
            btnImport.addEventListener('click', () => {
                openExcelImportModal(workspaceId, () => {
                    showAlert.success("Spreadsheet data successfully imported into workspace!");
                });
            });
        }

        const btnExport = contentArea.querySelector('#btn-settings-export-data');
        if (btnExport) {
            btnExport.addEventListener('click', () => {
                openExportModal(workspaceId, { workspaceInfo: wsData });
            });
        }

    } catch (err) {
        console.error("Render settings error:", err);
        showAlert.error("Failed to load workspace settings.");
    }
};
