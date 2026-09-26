import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getSettingsService } from '../services/settingsService.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { downloadHeadersOnlyTemplate, downloadExampleDataTemplate } from '../utils/exportEngine.js';
import { openCurrencyPickerModal } from './currencyModal.js';

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
                        Workers have operational permissions and cannot alter workspace preferences.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="window.location.hash='#/overview'">Back to Overview</button>
                        <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'">Create Invoices</button>
                        <button id="btn-worker-leave-ws" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);">Leave Workspace</button>
                    </div>
                </div>
            `;

            contentArea.querySelector('#btn-worker-leave-ws')?.addEventListener('click', async () => {
                if (await showAlert.confirm("Are you sure you want to leave this workspace? You will lose access to its products and invoices.")) {
                    try {
                        await firestoreService.leaveWorkspace(workspaceId, currentUser);
                        showAlert.success("You have left the workspace.");
                        window.location.href = 'index.html';
                    } catch (e) {
                        showAlert.error("Failed to leave workspace: " + (e.message || 'Unknown error'));
                    }
                }
            });
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

                <!-- CURRENCY CONFIGURATION CARD -->
                <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); grid-column: 1 / -1; background: #ffffff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; flex-wrap: wrap;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary); font-weight: 700;">Workspace Currency</h3>
                            </div>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.88rem;">
                                Choose standard country currency or enter custom text (max 3 characters).
                            </p>
                        </div>

                        <!-- Live formatted preview -->
                        <div style="background: var(--surface-50); border: 1px solid var(--border-color); padding: 0.45rem 1rem; border-radius: 10px; font-size: 0.88rem; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <span style="color: var(--text-muted); font-size: 0.8rem; font-weight: 500;">Live Sample:</span>
                            <strong id="currency-live-preview" style="color: var(--primary); font-family: monospace; font-size: 1.05rem;">${currentSettings.currencySymbol || '$'} 1,250.00</strong>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; align-items: flex-end;">
                        <div>
                            <label style="font-weight: 600; font-size: 0.85rem; margin-bottom: 0.4rem; display: block; color: var(--text-primary);">
                                Currency Symbol (Max 3 Characters)
                            </label>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                <input type="text" id="set-currency" class="form-control" maxlength="3" value="${currentSettings.currencySymbol || '$'}" placeholder="e.g. $" style="font-family: monospace; font-weight: 700; font-size: 1.15rem; width: 110px; text-align: center; letter-spacing: 1px;">
                                <button type="button" id="btn-find-currency" class="btn btn-secondary" style="display: flex; align-items: center; gap: 0.45rem; font-weight: 600; font-size: 0.85rem; padding: 0.65rem 1rem; white-space: nowrap;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                    Find Country / Symbol
                                </button>
                            </div>
                            <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 0.35rem; display: block;">
                                You can type custom letters (e.g. <code>৳</code>, <code>$</code>, <code>EUR</code>, <code>AED</code>) or click search to select a country.
                            </small>
                        </div>

                        <!-- Popular shortcuts -->
                        <div>
                            <label style="font-weight: 600; font-size: 0.8rem; margin-bottom: 0.4rem; display: block; color: var(--text-muted);">
                                Popular Quick Presets:
                            </label>
                            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;" id="currency-presets-container">
                                <button type="button" class="btn-currency-quick" data-symbol="$" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇺🇸 $ USD</button>
                                <button type="button" class="btn-currency-quick" data-symbol="৳" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇧🇩 ৳ BDT</button>
                                <button type="button" class="btn-currency-quick" data-symbol="€" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇪🇺 € EUR</button>
                                <button type="button" class="btn-currency-quick" data-symbol="£" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇬🇧 £ GBP</button>
                                <button type="button" class="btn-currency-quick" data-symbol="₹" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇮🇳 ₹ INR</button>
                                <button type="button" class="btn-currency-quick" data-symbol="د.إ" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇦🇪 د.إ AED</button>
                                <button type="button" class="btn-currency-quick" data-symbol="¥" style="padding: 0.35rem 0.65rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">🇯🇵 ¥ JPY</button>
                            </div>
                        </div>
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
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                            <button id="btn-settings-headers-template" class="btn btn-secondary" style="font-size:0.8rem; display:flex; align-items:center; gap:0.35rem;" title="Download blank Excel sheet with column headers only">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Headers Only
                            </button>
                            <button id="btn-settings-sample-template" class="btn btn-secondary" style="font-size:0.8rem; display:flex; align-items:center; gap:0.35rem;" title="Download Excel template with sample grocery items">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Example File
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                        <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <strong style="display:block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Market Inserter (Grid)</strong>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Insert up to 250 products at once in a fast spreadsheet grid with live image picking & duplicate protection.</p>
                            </div>
                            <button id="btn-settings-market-inserter" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700; width: 100%; display:flex; align-items:center; justify-content:center; gap:0.4rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                                Launch Market Inserter
                            </button>
                        </div>

                        <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <strong style="display:block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Excel & CSV Import</strong>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Batch add products with automatic column detection, category clustering, and custom color assignment.</p>
                            </div>
                            <button id="btn-settings-import-excel" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600; width: 100%; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Launch Import Tool
                            </button>
                        </div>

                        <div style="background: var(--surface-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <strong style="display:block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.25rem;">Custom Data Exporter</strong>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Export customizable Excel spreadsheets, printable PDF price lists with catalogs, or full JSON backups.</p>
                            </div>
                            <button id="btn-settings-export-data" class="btn btn-secondary" style="font-size: 0.85rem; font-weight: 600; width: 100%; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
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

                <!-- DANGER ZONE -->
                ${isAdmin ? `
                    <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); grid-column: 1 / -1; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.03); margin-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 260px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--danger);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--danger); font-weight: 700;">Danger Zone — Delete Entire Workspace</h3>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; margin: 0;">
                                    Permanently destroy this workspace and wipe all products, invoices, categories, clients, settings, and cloud media from the server.
                                    <br><strong style="color:var(--text-primary);">Requirement:</strong> Must have <strong>0 members</strong> connected inside the workspace (except admin).
                                </p>
                            </div>
                            <div>
                                <button type="button" id="btn-delete-workspace" class="btn" style="background: var(--danger); color: white; font-weight: 700; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(239, 68, 68, 0.25); cursor: pointer;">
                                    Delete Entire Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); grid-column: 1 / -1; border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.02); margin-top: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 260px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--danger);"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                    <h3 style="margin: 0; font-size: 1.15rem; color: var(--danger); font-weight: 700;">Leave Workspace</h3>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.5; margin: 0;">
                                    Disconnect your account from this workspace. You will be redirected to create or join a new workspace.
                                </p>
                            </div>
                            <div>
                                <button type="button" id="btn-leave-workspace" class="btn btn-outline" style="color: var(--danger); border-color: var(--danger); font-weight: 700; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">
                                    Leave Workspace
                                </button>
                            </div>
                        </div>
                    </div>
                `}

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

        // Currency Live Preview & Modal Picker Handlers
        const currencyInput = contentArea.querySelector('#set-currency');
        const currencyPreview = contentArea.querySelector('#currency-live-preview');
        const btnFindCurrency = contentArea.querySelector('#btn-find-currency');

        const updateCurrencyPreview = (val) => {
            const sym = (val || '$').trim().substring(0, 3) || '$';
            if (currencyPreview) {
                currencyPreview.textContent = `${sym} 1,250.00`;
            }
        };

        if (currencyInput) {
            currencyInput.addEventListener('input', (e) => {
                if (e.target.value.length > 3) {
                    e.target.value = e.target.value.substring(0, 3);
                }
                updateCurrencyPreview(e.target.value);
            });
        }

        if (btnFindCurrency) {
            btnFindCurrency.addEventListener('click', () => {
                openCurrencyPickerModal(currencyInput?.value || '$', (selectedSymbol, code, name) => {
                    const cleanSymbol = selectedSymbol.substring(0, 3);
                    if (currencyInput) currencyInput.value = cleanSymbol;
                    updateCurrencyPreview(cleanSymbol);
                    showAlert.success(`Currency set to ${name} (${cleanSymbol})`);
                });
            });
        }

        contentArea.querySelectorAll('.btn-currency-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const sym = (btn.getAttribute('data-symbol') || '$').substring(0, 3);
                if (currencyInput) currencyInput.value = sym;
                updateCurrencyPreview(sym);
            });
        });

        // Save handler
        const btnSave = contentArea.querySelector('#btn-save-settings');
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                btnSave.disabled = true;
                btnSave.textContent = 'Saving...';

                try {
                    const updatedPayload = {
                        enableVending: Boolean(contentArea.querySelector('#set-vending')?.checked),
                        currency: (contentArea.querySelector('#set-currency')?.value || '$').trim().substring(0, 3) || '$',
                        currencySymbol: (contentArea.querySelector('#set-currency')?.value || '$').trim().substring(0, 3) || '$',
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
                    showAlert.success("Workspace settings & Currency preferences saved successfully!");

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
        const btnMarketInserter = contentArea.querySelector('#btn-settings-market-inserter');
        if (btnMarketInserter) {
            btnMarketInserter.addEventListener('click', () => {
                window.location.hash = '#/market-inserter';
            });
        }

        const btnHeaders = contentArea.querySelector('#btn-settings-headers-template');
        if (btnHeaders) {
            btnHeaders.addEventListener('click', () => downloadHeadersOnlyTemplate());
        }

        const btnSample = contentArea.querySelector('#btn-settings-sample-template');
        if (btnSample) {
            btnSample.addEventListener('click', () => downloadExampleDataTemplate());
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

        // Danger Zone: Delete Workspace Handler (Admin Only)
        const btnDeleteWs = contentArea.querySelector('#btn-delete-workspace');
        if (btnDeleteWs) {
            btnDeleteWs.addEventListener('click', async () => {
                try {
                    btnDeleteWs.disabled = true;
                    btnDeleteWs.textContent = 'Checking workspace members...';

                    const members = await firestoreService.getWorkspaceMembers(workspaceId);
                    const activeOtherMembers = members.filter(m => {
                        const mEmail = (m.email || '').toLowerCase();
                        const isSelf = mEmail === (currentUser.email || '').toLowerCase() || m.workerUid === currentUser.uid;
                        return !isSelf;
                    });

                    if (activeOtherMembers.length > 0) {
                        showAlert.error(`Cannot delete workspace. There are still ${activeOtherMembers.length} active member(s) connected. Please remove all members first from the Workers tab before deleting this workspace.`);
                        btnDeleteWs.disabled = false;
                        btnDeleteWs.textContent = 'Delete Entire Workspace';
                        return;
                    }

                    const confirmed = await showAlert.confirm("WARNING: Are you sure you want to PERMANENTLY delete this workspace? All products, sales, invoices, categories, client data, and image files will be wiped completely from the server!");
                    if (!confirmed) {
                        btnDeleteWs.disabled = false;
                        btnDeleteWs.textContent = 'Delete Entire Workspace';
                        return;
                    }

                    btnDeleteWs.textContent = 'Deleting all server data...';
                    await firestoreService.deleteEntireWorkspace(workspaceId, currentUser);
                    showAlert.success("Workspace and all associated server data successfully deleted.");
                    window.location.href = 'index.html';
                } catch (err) {
                    console.error("Delete workspace error:", err);
                    showAlert.error(err.message || "Failed to delete workspace.");
                    btnDeleteWs.disabled = false;
                    btnDeleteWs.textContent = 'Delete Entire Workspace';
                }
            });
        }

        // Danger Zone: Leave Workspace Handler (Worker/Co-Admin)
        const btnLeaveWs = contentArea.querySelector('#btn-leave-workspace');
        if (btnLeaveWs) {
            btnLeaveWs.addEventListener('click', async () => {
                if (await showAlert.confirm("Are you sure you want to leave this workspace? You will lose access to its products and invoices.")) {
                    try {
                        btnLeaveWs.disabled = true;
                        btnLeaveWs.textContent = 'Leaving...';
                        await firestoreService.leaveWorkspace(workspaceId, currentUser);
                        showAlert.success("You have successfully left the workspace.");
                        window.location.href = 'index.html';
                    } catch (err) {
                        console.error("Leave workspace error:", err);
                        showAlert.error("Failed to leave workspace: " + (err.message || 'Unknown error'));
                        btnLeaveWs.disabled = false;
                        btnLeaveWs.textContent = 'Leave Workspace';
                    }
                }
            });
        }

    } catch (err) {
        console.error("Render settings error:", err);
        showAlert.error("Failed to load workspace settings.");
    }
};
