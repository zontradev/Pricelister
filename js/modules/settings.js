import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRoleBadgeHtml } from '../auth-handler.js';
import { getSettingsService } from '../services/settingsService.js';
import { storageService } from '../../supabase/storage.js';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { downloadHeadersOnlyTemplate, downloadExampleDataTemplate } from '../utils/exportEngine.js';
import { openCurrencyPickerModal } from './currencyModal.js';

const db = getFirestore(firebaseApp);

const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const renderSettings = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:350px;">
            <div class="spinner"></div>
        </div>
    `;

    try {
        // 1. DETERMINE USER ROLE
        let userRole = 'WORKER';
        let isAdmin = false;
        let isCoAdmin = false;

        const wsRef = doc(db, 'Workspaces', workspaceId);
        const wsSnap = await getDoc(wsRef);
        const wsData = wsSnap.exists() ? wsSnap.data() : {};

        if (wsData.adminId === currentUser.uid || workspaceId === currentUser.uid) {
            userRole = 'CREATOR_ADMIN';
            isAdmin = true;
        } else {
            for (const sub of ['Members', 'members']) {
                try {
                    const mRef = doc(db, 'Workspaces', workspaceId, sub, currentUser.uid);
                    const mSnap = await getDoc(mRef);
                    if (mSnap.exists()) {
                        userRole = (mSnap.data().role || 'WORKER').toUpperCase();
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
                } catch (e) {}
            }

            if (userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR') {
                isAdmin = true;
            } else if (userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN') {
                isCoAdmin = true;
            }
        }

        const canAccessSettings = isAdmin || isCoAdmin;

        // Worker Restriction View
        if (!canAccessSettings) {
            container.innerHTML = `
                <div style="max-width: 560px; margin: 3rem auto; background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 20px; padding: 2.5rem; text-align: center; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06);">
                    <div style="width: 56px; height: 56px; border-radius: 14px; background: #f4f4f5; color: #18181b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    </div>
                    <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">Access Restricted</h3>
                    <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.55; margin-bottom: 1.5rem;">
                        Advanced Workspace Settings, Currency Configurations, and Inventory Automation can only be configured by <strong>Admins</strong> and <strong>Co-Admins</strong>.
                    </p>
                    <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="window.location.hash='#/workspace'" style="border-radius: 8px;">Workspace Hub</button>
                        <button class="btn btn-primary" onclick="window.location.hash='#/invoices/customer'" style="border-radius: 8px;">Create Invoices</button>
                        <button id="btn-worker-leave-ws" class="btn btn-outline" style="color:#e11d48; border-color:rgba(225,29,72,0.3); border-radius: 8px;">Leave Workspace</button>
                    </div>
                </div>
            `;

            container.querySelector('#btn-worker-leave-ws')?.addEventListener('click', async () => {
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

        // 2. LOAD SERVER SETTINGS
        const settingsService = getSettingsService(workspaceId);
        const currentSettings = await settingsService.getWorkspaceSettings();

        const wsDisplayName = currentSettings.name || wsData.name || 'PriceLister Workspace';
        const wsIdText = wsData.workspaceId || wsData.id || workspaceId;
        const wsEmail = currentSettings.email || wsData.email || currentUser.email || '';
        const wsPhone = currentSettings.phone || wsData.phone || '';
        const wsAddress = currentSettings.address || wsData.address || '';
        const wsShopName = currentSettings.shopName || wsDisplayName;
        const wsEndMsg = currentSettings.endMessage || 'Thank you for your business!';
        const wsCurrency = (currentSettings.currencySymbol || '$').trim().substring(0, 3) || '$';
        const isVendingActive = Boolean(currentSettings.enableVending);
        const printCustName = Boolean(currentSettings.customerName);
        const printCustPhone = Boolean(currentSettings.customerNumber);
        const logoUrl = currentSettings.logoUrl || wsData.logoUrl || wsData.logo || '';

        const wsCreatedDate = currentSettings.createdDate || (wsData.createdAt ? new Date(wsData.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent');
        const wsCreatedTimestamp = currentSettings.createdTimestamp || (wsData.createdAt ? new Date(wsData.createdAt).toISOString() : '');
        const wsCreatorEmail = currentSettings.creatorEmail || wsData.creatorEmail || wsData.adminEmail || currentUser.email || '';

        const wsUpdatedDate = currentSettings.updatedDate || (wsData.updatedAt ? new Date(wsData.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent');
        const wsUpdateTimestamp = currentSettings.updateTimestamp || (wsData.updatedAt ? new Date(wsData.updatedAt).toISOString() : '');
        const wsUpdatorEmail = currentSettings.updatorEmail || wsData.updatorEmail || wsCreatorEmail;

        // Render Advanced Settings Interface
        container.innerHTML = `
            <div class="advanced-settings-wrapper" style="max-width: 1180px; margin: 0 auto; padding-bottom: 5rem;">
                
                <!-- TOP HEADER HERO -->
                <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 20px; padding: 1.75rem 2rem; margin-bottom: 1.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem; box-shadow: 0 8px 30px -5px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 1.15rem;">
                        <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; font-weight: 800; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2); flex-shrink: 0;">
                            ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.6rem;">
                                <h2 style="margin: 0; font-size: 1.45rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.02em;">Advanced Workspace Settings</h2>
                                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.18rem 0.6rem; border-radius: 9999px; background: ${isAdmin ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(22, 163, 74, 0.12)'}; color: ${isAdmin ? '#ffffff' : '#16a34a'}; border: 1px solid ${isAdmin ? 'rgba(5, 150, 105, 0.8)' : 'rgba(22, 163, 74, 0.35)'};">
                                    ${isAdmin ? 'Creator Admin' : 'Co-Admin'}
                                </span>
                            </div>
                            <p style="margin: 0.25rem 0 0 0; color: var(--text-muted); font-size: 0.88rem;">
                                Manage business credentials, regional currency, automated stock deductions, receipt templates, and data backups.
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.65rem; align-items: center;">
                        <button type="button" class="btn btn-secondary" onclick="window.location.hash='#/workspace'" style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; font-weight: 600; padding: 0.55rem 1rem; border-radius: 10px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                            <span>Workspace Hub</span>
                        </button>
                    </div>
                </div>

                <!-- NAVIGATION TABS -->
                <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1.5px solid var(--border-color);" id="settings-tabs-nav">
                    <button type="button" class="settings-tab-btn active" data-tab="tab-general" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid var(--border-color); background: #ffffff; color: var(--text-primary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                        <span>General & Brand</span>
                    </button>
                    <button type="button" class="settings-tab-btn" data-tab="tab-currency" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        <span>Currency & Region</span>
                    </button>
                    <button type="button" class="settings-tab-btn" data-tab="tab-receipts" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>Receipts & Invoicing</span>
                    </button>
                    <button type="button" class="settings-tab-btn" data-tab="tab-vending" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                        <span>Automation & Stock</span>
                    </button>
                    <button type="button" class="settings-tab-btn" data-tab="tab-data" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        <span>Data & Excel Tools</span>
                    </button>
                    <button type="button" class="settings-tab-btn" data-tab="tab-security" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.15rem; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-size: 0.86rem; font-weight: 700; cursor: pointer; white-space: nowrap; transition: all 0.2s ease;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>Security & Audit</span>
                    </button>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 1: GENERAL & BRAND -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane active" id="tab-general">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                        
                        <!-- Card: Identity & Details -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #f4f4f5; color: #18181b; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Workspace Credentials</h3>
                            </div>

                            <form id="settings-general-form" style="display: flex; flex-direction: column; gap: 1.15rem;">
                                <!-- WORKSPACE LOGO (CHANGE OR ENTER) -->
                                <div class="form-group" style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 14px; padding: 1.25rem;">
                                    <label style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between;">
                                        <span style="display: flex; align-items: center; gap: 0.45rem;">
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            Workspace Logo
                                        </span>
                                        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">PNG, JPG, WEBP, or SVG</span>
                                    </label>
                                    
                                    <div style="display: flex; gap: 1.15rem; align-items: center; flex-wrap: wrap;">
                                        <!-- Logo Box / Dropzone -->
                                        <div id="ws-logo-dropzone" style="width: 82px; height: 82px; border-radius: 16px; background: #ffffff; border: 2px dashed var(--border-color); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; cursor: pointer; flex-shrink: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: all 0.2s ease;" title="Click or Drag & Drop to change workspace logo">
                                            <img id="ws-logo-preview-img" src="${escapeHtml(logoUrl)}" alt="Workspace Logo" style="width: 100%; height: 100%; object-fit: contain; padding: 4px; ${logoUrl ? '' : 'display: none;'}">
                                            <div id="ws-logo-placeholder" style="display: ${logoUrl ? 'none' : 'flex'}; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); color: #ffffff; font-size: 1.75rem; font-weight: 800;">
                                                ${escapeHtml((wsDisplayName.charAt(0) || 'W').toUpperCase())}
                                            </div>
                                            <div id="ws-logo-overlay-hint" style="position: absolute; inset: 0; background: rgba(0,0,0,0.55); color: #ffffff; display: none; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; text-align: center; padding: 4px;">
                                                Change
                                            </div>
                                        </div>

                                        <!-- Upload Controls & Remove -->
                                        <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 0.5rem;">
                                            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                                                <input type="file" id="set-logo-file" accept="image/png, image/jpeg, image/webp, image/svg+xml" style="display: none;">
                                                <button type="button" id="btn-upload-ws-logo" class="btn btn-sm btn-secondary" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.9rem; display: flex; align-items: center; gap: 0.35rem;">
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                    <span>Upload Logo</span>
                                                </button>
                                                <button type="button" id="btn-clear-ws-logo" class="btn btn-sm btn-outline" style="font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.75rem; color: var(--danger); border-color: rgba(239,68,68,0.3); display: ${logoUrl ? 'inline-flex' : 'none'}; align-items: center; gap: 0.3rem;" title="Remove current logo and restore monogram initial">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    <span>Remove</span>
                                                </button>
                                            </div>
                                            <small style="color: var(--text-muted); font-size: 0.75rem;">Square 256x256 or 512x512 pixels recommended with transparent or white background.</small>
                                        </div>
                                    </div>

                                    <!-- Direct URL input -->
                                    <div style="margin-top: 0.85rem;">
                                        <label style="font-weight: 600; font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.25rem; display: block;">Or enter direct image URL:</label>
                                        <input type="url" id="set-logo-url" class="form-control" value="${escapeHtml(logoUrl)}" placeholder="https://example.com/logo.png" style="border-radius: 8px; font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Workspace Name *</label>
                                    <input type="text" id="set-name" class="form-control" value="${escapeHtml(wsDisplayName)}" required style="border-radius: 8px; font-weight: 600;">
                                    <small style="color: var(--text-muted); font-size: 0.75rem;">Visible to all invited workers and displayed on customer portals.</small>
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Business Email *</label>
                                    <input type="email" id="set-email" class="form-control" value="${escapeHtml(wsEmail)}" required style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Business Phone / WhatsApp</label>
                                    <input type="text" id="set-phone" class="form-control" value="${escapeHtml(wsPhone)}" placeholder="+1 (555) 000-0000" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Registered Address</label>
                                    <textarea id="set-address" class="form-control" rows="3" placeholder="Suite, Street, City, Country" style="border-radius: 8px; font-family: inherit;">${escapeHtml(wsAddress)}</textarea>
                                </div>
                            </form>
                        </div>

                        <!-- Card: Workspace ID & Audit Trail -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                    <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.08); color: #2563eb; display: flex; align-items: center; justify-content: center;">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                                    </div>
                                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Identifier & Audit Trail</h3>
                                </div>

                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
                                    <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.4rem;">Unique Workspace ID</div>
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                                        <code style="font-family: monospace; font-size: 0.95rem; font-weight: 800; color: var(--primary);">${escapeHtml(wsIdText)}</code>
                                        <button type="button" id="btn-copy-settings-ws-id" class="btn btn-sm btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; border-radius: 6px;">
                                            Copy ID
                                        </button>
                                    </div>
                                </div>

                                <!-- Audit Metadata -->
                                <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 1.15rem; font-size: 0.82rem; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.5rem;">
                                    <div>
                                        <strong style="color: var(--text-primary);">Created Date:</strong> ${escapeHtml(wsCreatedDate)}
                                        ${wsCreatedTimestamp ? `<div style="font-family:monospace; font-size:0.72rem; color:var(--text-muted);">${escapeHtml(wsCreatedTimestamp)}</div>` : ''}
                                    </div>
                                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                        <strong style="color: var(--text-primary);">Last Updated:</strong> ${escapeHtml(wsUpdatedDate)}
                                        ${wsUpdateTimestamp ? `<div style="font-family:monospace; font-size:0.72rem; color:var(--text-muted);">${escapeHtml(wsUpdateTimestamp)}</div>` : ''}
                                    </div>
                                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                                        <strong style="color: var(--text-primary);">Last Modified By:</strong>
                                        <span style="font-weight:600; color:var(--text-primary);"> ${escapeHtml(wsUpdatorEmail || 'Admin')}</span>
                                    </div>
                                </div>
                            </div>

                            <div style="background: #fafaf9; border: 1px solid #e4e4e7; border-radius: 10px; padding: 0.85rem 1rem; margin-top: 1.5rem; display: flex; align-items: center; gap: 0.65rem;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                <span style="font-size: 0.8rem; color: var(--text-secondary);">Enterprise multi-tenant isolation with real-time Firestore sync.</span>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 2: CURRENCY & REGION -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-currency" style="display: none;">
                    <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#18181b" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                    Workspace Currency Configuration
                                </h3>
                                <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.88rem;">Select a country currency standard or type custom symbol characters (max 3 letters).</p>
                            </div>

                            <!-- Live Sample Badge -->
                            <div style="background: #fafaf9; border: 1.5px solid #e4e4e7; padding: 0.55rem 1.15rem; border-radius: 12px; display: flex; align-items: center; gap: 0.6rem;">
                                <span style="font-size: 0.78rem; font-weight: 700; color: #52525b; text-transform: uppercase;">Live Sample:</span>
                                <strong id="currency-live-preview" style="color: #09090b; font-family: monospace; font-size: 1.15rem; font-weight: 800;">${escapeHtml(wsCurrency)} 1,450.00</strong>
                            </div>
                        </div>

                        <!-- Input & Buttons Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; align-items: flex-end; margin-bottom: 1.5rem;">
                            <div>
                                <label style="font-weight: 700; font-size: 0.84rem; color: var(--text-primary); margin-bottom: 0.4rem; display: block;">
                                    Custom Currency Symbol (Max 3 Chars)
                                </label>
                                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                                    <input type="text" id="set-currency" class="form-control" maxlength="3" value="${escapeHtml(wsCurrency)}" placeholder="$" style="font-family: monospace; font-weight: 800; font-size: 1.25rem; width: 110px; text-align: center; border-radius: 10px; color: var(--primary);">
                                    <button type="button" id="btn-find-currency" class="btn btn-secondary" style="display: flex; align-items: center; gap: 0.45rem; font-weight: 700; font-size: 0.85rem; padding: 0.65rem 1rem; border-radius: 10px;">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        Find Country Symbol
                                    </button>
                                </div>
                            </div>

                            <!-- Popular Quick Presets -->
                            <div>
                                <label style="font-weight: 700; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.45rem; display: block;">
                                    Instant 1-Click Presets:
                                </label>
                                <div style="display: flex; gap: 0.45rem; flex-wrap: wrap;" id="currency-presets-container">
                                    <button type="button" class="btn-currency-quick" data-symbol="$" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">$ USD</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="৳" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">৳ BDT</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="€" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">€ EUR</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="£" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">£ GBP</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="₹" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">₹ INR</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="AED" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">AED</button>
                                    <button type="button" class="btn-currency-quick" data-symbol="¥" style="padding: 0.4rem 0.75rem; font-size: 0.82rem; font-weight: 700; border-radius: 8px; border: 1px solid var(--border-color); background: var(--surface-50); cursor: pointer;">¥ JPY</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 3: RECEIPTS & INVOICING -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-receipts" style="display: none;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
                        
                        <!-- Left Form -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(225, 29, 72, 0.08); color: #e11d48; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Printout & Ticket Details</h3>
                            </div>

                            <form id="settings-receipt-form" style="display: flex; flex-direction: column; gap: 1.15rem;">
                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Shop / Header Name</label>
                                    <input type="text" id="set-shop-name" class="form-control" value="${escapeHtml(wsShopName)}" placeholder="e.g. Apex Superstore" style="border-radius: 8px;">
                                </div>

                                <div class="form-group">
                                    <label style="font-weight: 700; font-size: 0.83rem; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Receipt Footer Note</label>
                                    <input type="text" id="set-end-msg" class="form-control" value="${escapeHtml(wsEndMsg)}" placeholder="e.g. Goods once sold are returnable within 7 days." style="border-radius: 8px;">
                                </div>

                                <div style="background: var(--surface-50); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-top: 0.5rem;">
                                    <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.65rem;">Customer Information on Invoices</div>
                                    
                                    <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.86rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">
                                        <input type="checkbox" id="set-show-cust-name" ${printCustName ? 'checked' : ''} style="width:16px; height:16px; accent-color:#e11d48;">
                                        <span>Print Customer Name on POS Invoices</span>
                                    </label>

                                    <label style="display: flex; align-items: center; gap: 0.65rem; cursor: pointer; font-size: 0.86rem; font-weight: 600; color: var(--text-primary);">
                                        <input type="checkbox" id="set-show-cust-num" ${printCustPhone ? 'checked' : ''} style="width:16px; height:16px; accent-color:#e11d48;">
                                        <span>Print Customer Phone Number on Receipts</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        <!-- Right: Interactive Live Ticket Box -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); display: flex; flex-direction: column;">
                            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem;">Interactive Live Receipt Preview</div>
                            
                            <div style="background: #fafafa; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 1.5rem; font-family: monospace; font-size: 0.82rem; color: #1e293b; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
                                        <strong id="preview-shop-title" style="font-size: 1rem; font-weight: 800; display: block; text-transform: uppercase;">${escapeHtml(wsShopName)}</strong>
                                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">INVOICE #INV-2026-0042</div>
                                        <div style="font-size: 0.72rem; color: #64748b;">${new Date().toLocaleDateString()}</div>
                                    </div>

                                    <div id="preview-cust-meta" style="margin-bottom: 0.75rem; font-size: 0.75rem; color: #475569;">
                                        ${printCustName ? '<div>Customer: Alex Rivera</div>' : ''}
                                        ${printCustPhone ? '<div>Phone: +1 555-0199</div>' : ''}
                                    </div>

                                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.4rem; font-weight: 700;">
                                        <span>ITEM</span>
                                        <span>QTY</span>
                                        <span>TOTAL</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.4rem 0;">
                                        <span>Premium Roast Blend</span>
                                        <span>2x</span>
                                        <span>${escapeHtml(wsCurrency)} 32.00</span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; padding: 0.2rem 0; border-top: 1px dashed #cbd5e1; margin-top: 0.4rem; font-weight: 800;">
                                        <span>TOTAL DUE</span>
                                        <span id="preview-ticket-total" style="color: #e11d48;">${escapeHtml(wsCurrency)} 32.00</span>
                                    </div>
                                </div>

                                <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 0.75rem; margin-top: 1rem; font-size: 0.74rem; color: #64748b;" id="preview-footer-note">
                                    ${escapeHtml(wsEndMsg)}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 4: AUTOMATION & VENDING MODE -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-vending" style="display: none;">
                    <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1.25rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 260px;">
                                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem;">
                                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(225, 29, 72, 0.08); color: #e11d48; display: flex; align-items: center; justify-content: center;">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                                    </div>
                                    <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">Vending Mode (Automated Stock Deductions)</h3>
                                </div>
                                <p style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.55; margin: 0;">
                                    When enabled, every generated customer POS receipt or wholesale business invoice will automatically deduct product quantities from active inventory in real time.
                                </p>
                            </div>

                            <div>
                                <label class="switch-container">
                                    <input type="checkbox" id="set-vending" class="switch-input" ${isVendingActive ? 'checked' : ''}>
                                    <span class="switch-track">
                                        <span class="switch-thumb"></span>
                                    </span>
                                    <span id="vending-status-label" style="font-size: 0.9rem; font-weight: 800; color: ${isVendingActive ? '#059669' : 'var(--text-muted)'}; min-width: 85px;">
                                        ${isVendingActive ? 'ENABLED' : 'DISABLED'}
                                    </span>
                                </label>
                            </div>
                        </div>

                        <!-- Comparison Cards -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
                            <div style="border: 1.5px solid ${isVendingActive ? '#10b981' : 'var(--border-color)'}; background: ${isVendingActive ? 'rgba(16, 185, 129, 0.05)' : '#ffffff'}; padding: 1.25rem; border-radius: 14px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 0.92rem; color: #059669; margin-bottom: 0.35rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Active Mode (Automated Tracking)
                                </div>
                                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                                    Invoices immediately decrease stock count. Provides instant alerts if a product falls below its threshold.
                                </p>
                            </div>

                            <div style="border: 1.5px solid ${!isVendingActive ? '#f59e0b' : 'var(--border-color)'}; background: ${!isVendingActive ? 'rgba(245, 158, 11, 0.05)' : '#ffffff'}; padding: 1.25rem; border-radius: 14px;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 0.92rem; color: #d97706; margin-bottom: 0.35rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Standard Mode (Records Only)
                                </div>
                                <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                                    Invoices are recorded as sales history without modifying warehouse inventory numbers.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 5: DATA & EXCEL TOOLS -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-data" style="display: none;">
                    <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
                            <div>
                                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Spreadsheet & Batch Migration Hub
                                </h3>
                                <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.88rem;">Import catalog spreadsheets, launch high-speed grid editors, and export formatted reports.</p>
                            </div>

                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button type="button" id="btn-settings-headers-template" class="btn btn-secondary" style="font-size: 0.82rem; font-weight: 700; border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Headers Only
                                </button>
                                <button type="button" id="btn-settings-sample-template" class="btn btn-secondary" style="font-size: 0.82rem; font-weight: 700; border-radius: 8px; display: flex; align-items: center; gap: 0.4rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Sample File
                                </button>
                            </div>
                        </div>

                        <!-- 3 Action Cards -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
                            
                            <div style="background: var(--surface-50); padding: 1.35rem; border-radius: 14px; border: 1.5px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.35rem;">Market Inserter (Rapid Grid)</div>
                                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">Direct 250-item spreadsheet editor with instant image picking, category assignment, and duplicate prevention.</p>
                                </div>
                                <button type="button" id="btn-settings-market-inserter" class="btn btn-primary" style="font-size: 0.86rem; font-weight: 700; width: 100%; border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
                                    Launch Market Inserter
                                </button>
                            </div>

                            <div style="background: var(--surface-50); padding: 1.35rem; border-radius: 14px; border: 1.5px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.35rem;">Excel & CSV Import</div>
                                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">Batch upload products with automatic column matching, auto-category grouping, and unit price calculation.</p>
                                </div>
                                <button type="button" id="btn-settings-import-excel" class="btn btn-secondary" style="font-size: 0.86rem; font-weight: 700; width: 100%; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Upload Spreadsheet
                                </button>
                            </div>

                            <div style="background: var(--surface-50); padding: 1.35rem; border-radius: 14px; border: 1.5px solid var(--border-color); display: flex; flex-direction: column; justify-content: space-between;">
                                <div>
                                    <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.35rem;">Custom Data Exporter</div>
                                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 1.25rem;">Download complete inventory catalogs, printable PDF pricelists, customer directories, or full JSON backups.</p>
                                </div>
                                <button type="button" id="btn-settings-export-data" class="btn btn-secondary" style="font-size: 0.86rem; font-weight: 700; width: 100%; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    Export Records
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- TAB 6: SECURITY & DANGER ZONE -->
                <!-- ======================================================== -->
                <div class="settings-tab-pane" id="tab-security" style="display: none;">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Security & Access Summary -->
                        <div style="background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02);">
                            <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); color: #059669; display: flex; align-items: center; justify-content: center;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                </div>
                                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">Role Policies & Permissions</h3>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; font-size: 0.85rem;">
                                <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem;">
                                    <strong style="color: var(--text-primary); display: block; margin-bottom: 0.35rem;">Admins & Co-Admins:</strong>
                                    Full management rights for products, categories, invoices, customer panel, workers, and settings.
                                </div>
                                <div style="background: var(--surface-50); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem;">
                                    <strong style="color: var(--text-primary); display: block; margin-bottom: 0.35rem;">Workers:</strong>
                                    Operational catalog browsing & POS invoice generation with granular add/edit/delete restriction flags.
                                </div>
                            </div>
                        </div>

                        <!-- Danger Zone -->
                        ${isAdmin ? `
                            <div style="background: #ffffff; border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                                    <div style="flex: 1; min-width: 260px;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                                            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); color: #dc2626; display: flex; align-items: center; justify-content: center;">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </div>
                                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #dc2626;">Delete Workspace</h3>
                                        </div>
                                        <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.55; margin: 0;">
                                            Permanently delete this workspace and wipe all catalog products, invoices, categories, clients, settings, and cloud media from the database.
                                            <br><strong style="color:var(--text-primary);">Requirement:</strong> Remove all active workers in Workspace Hub before deleting.
                                        </p>
                                    </div>
                                    <div>
                                        <button type="button" id="btn-delete-workspace" class="btn" style="background: #dc2626; color: #ffffff; font-weight: 800; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 15px rgba(220, 38, 38, 0.25); cursor: pointer;">
                                            Delete Entire Workspace
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div style="background: #ffffff; border: 1.5px solid rgba(239, 68, 68, 0.4); border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
                                    <div style="flex: 1; min-width: 260px;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                                            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); color: #dc2626; display: flex; align-items: center; justify-content: center;">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                            </div>
                                            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #dc2626;">Leave Workspace</h3>
                                        </div>
                                        <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.55; margin: 0;">
                                            Disconnect your account from this workspace. You will lose access to its products and invoices.
                                        </p>
                                    </div>
                                    <div>
                                        <button type="button" id="btn-leave-workspace" class="btn btn-outline" style="color: #dc2626; border-color: rgba(220, 38, 38, 0.4); font-weight: 800; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">
                                            Leave Workspace
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>

                <!-- ======================================================== -->
                <!-- FLOATING STICKY SAVE BAR (APPEARS ON CHANGE) -->
                <!-- ======================================================== -->
                <div id="settings-floating-bar" style="position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px); background: #ffffff; border: 1.5px solid var(--border-color); border-radius: 9999px; padding: 0.65rem 1.25rem 0.65rem 1.5rem; box-shadow: 0 15px 35px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 1.25rem; z-index: 1000; transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); opacity: 0; pointer-events: none;">
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        <span style="width: 9px; height: 9px; border-radius: 50%; background: #18181b; box-shadow: 0 0 8px rgba(0, 0, 0, 0.4); display: inline-block;"></span>
                        <span style="font-size: 0.86rem; font-weight: 700; color: var(--text-primary);">Unsaved Changes</span>
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <button type="button" id="btn-discard-settings" class="btn btn-sm btn-secondary" style="font-size: 0.82rem; font-weight: 700; border-radius: 9999px; padding: 0.4rem 0.9rem;">
                            Discard
                        </button>
                        <button type="button" id="btn-save-settings" class="btn btn-sm btn-primary" style="font-size: 0.82rem; font-weight: 700; border-radius: 9999px; padding: 0.4rem 1.25rem; background: linear-gradient(180deg, #27272a 0%, #18181b 100%); border: 1px solid #18181b; color: #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.2);">
                            Save Changes
                        </button>
                    </div>
                </div>

            </div>
        `;

        // Tab Navigation Interaction
        const tabButtons = container.querySelectorAll('.settings-tab-btn');
        const tabPanes = container.querySelectorAll('.settings-tab-pane');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = 'transparent';
                    b.style.borderColor = 'transparent';
                    b.style.color = 'var(--text-secondary)';
                });
                tabPanes.forEach(p => {
                    p.style.display = 'none';
                    p.classList.remove('active');
                });

                btn.classList.add('active');
                btn.style.background = '#ffffff';
                btn.style.borderColor = 'var(--border-color)';
                btn.style.color = 'var(--text-primary)';

                const activePane = container.querySelector(`#${targetId}`);
                if (activePane) {
                    activePane.style.display = 'block';
                    activePane.classList.add('active');
                }
            });
        });

        // Live Ticket Preview updates
        const shopNameInput = container.querySelector('#set-shop-name');
        const endMsgInput = container.querySelector('#set-end-msg');
        const custNameCheck = container.querySelector('#set-show-cust-name');
        const custPhoneCheck = container.querySelector('#set-show-cust-num');
        const previewShop = container.querySelector('#preview-shop-title');
        const previewEnd = container.querySelector('#preview-footer-note');
        const previewCustMeta = container.querySelector('#preview-cust-meta');

        const updateTicketPreview = () => {
            if (previewShop) previewShop.textContent = shopNameInput?.value || wsDisplayName;
            if (previewEnd) previewEnd.textContent = endMsgInput?.value || wsEndMsg;
            if (previewCustMeta) {
                let html = '';
                if (custNameCheck?.checked) html += '<div>Customer: Alex Rivera</div>';
                if (custPhoneCheck?.checked) html += '<div>Phone: +1 555-0199</div>';
                previewCustMeta.innerHTML = html;
            }
        };

        [shopNameInput, endMsgInput].forEach(inp => inp?.addEventListener('input', updateTicketPreview));
        [custNameCheck, custPhoneCheck].forEach(chk => chk?.addEventListener('change', updateTicketPreview));

        // Vending Switch
        const vendingInput = container.querySelector('#set-vending');
        const vendingLabel = container.querySelector('#vending-status-label');
        if (vendingInput) {
            vendingInput.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                if (vendingLabel) {
                    vendingLabel.textContent = isChecked ? 'ENABLED' : 'DISABLED';
                    vendingLabel.style.color = isChecked ? '#059669' : 'var(--text-muted)';
                }
                checkDirty();
            });
        }

        // Currency Picker & Quick Presets
        const currencyInput = container.querySelector('#set-currency');
        const currencyPreview = container.querySelector('#currency-live-preview');
        const previewTicketTotal = container.querySelector('#preview-ticket-total');
        const btnFindCurrency = container.querySelector('#btn-find-currency');

        const updateCurrencyPreview = (val) => {
            const sym = (val || '$').trim().substring(0, 3) || '$';
            if (currencyPreview) currencyPreview.textContent = `${sym} 1,450.00`;
            if (previewTicketTotal) previewTicketTotal.textContent = `${sym} 32.00`;
        };

        if (currencyInput) {
            currencyInput.addEventListener('input', (e) => {
                if (e.target.value.length > 3) {
                    e.target.value = e.target.value.substring(0, 3);
                }
                updateCurrencyPreview(e.target.value);
                checkDirty();
            });
        }

        if (btnFindCurrency) {
            btnFindCurrency.addEventListener('click', () => {
                openCurrencyPickerModal(currencyInput?.value || '$', (selectedSymbol, code, name) => {
                    const cleanSymbol = selectedSymbol.substring(0, 3);
                    if (currencyInput) currencyInput.value = cleanSymbol;
                    updateCurrencyPreview(cleanSymbol);
                    checkDirty();
                    showAlert.success(`Currency selected: ${name} (${cleanSymbol})`);
                });
            });
        }

        container.querySelectorAll('.btn-currency-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const sym = (btn.getAttribute('data-symbol') || '$').substring(0, 3);
                if (currencyInput) currencyInput.value = sym;
                updateCurrencyPreview(sym);
                checkDirty();
            });
        });

        // Copy Workspace ID in Settings
        container.querySelector('#btn-copy-settings-ws-id')?.addEventListener('click', () => {
            if (navigator.clipboard && wsIdText) {
                navigator.clipboard.writeText(wsIdText);
                showAlert.success("Workspace ID copied to clipboard!");
            }
        });

        // Workspace Logo Interactive Controls
        let selectedWsLogoFile = null;

        const logoFileInput = container.querySelector('#set-logo-file');
        const logoUrlInput = container.querySelector('#set-logo-url');
        const btnUploadLogo = container.querySelector('#btn-upload-ws-logo');
        const btnClearLogo = container.querySelector('#btn-clear-ws-logo');
        const logoPreviewImg = container.querySelector('#ws-logo-preview-img');
        const logoPlaceholder = container.querySelector('#ws-logo-placeholder');
        const logoDropzone = container.querySelector('#ws-logo-dropzone');
        const logoOverlayHint = container.querySelector('#ws-logo-overlay-hint');

        const updateLogoDisplay = (srcUrl) => {
            if (srcUrl) {
                if (logoPreviewImg) {
                    logoPreviewImg.src = srcUrl;
                    logoPreviewImg.style.display = 'block';
                }
                if (logoPlaceholder) logoPlaceholder.style.display = 'none';
                if (btnClearLogo) btnClearLogo.style.display = 'inline-flex';
            } else {
                if (logoPreviewImg) {
                    logoPreviewImg.src = '';
                    logoPreviewImg.style.display = 'none';
                }
                if (logoPlaceholder) {
                    logoPlaceholder.style.display = 'flex';
                    const curName = (container.querySelector('#set-name')?.value || wsDisplayName || 'W').trim();
                    logoPlaceholder.textContent = (curName.charAt(0) || 'W').toUpperCase();
                }
                if (btnClearLogo) btnClearLogo.style.display = 'none';
            }
        };

        const handleLogoFile = (file) => {
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showAlert.error("Please choose a valid image file (PNG, JPG, WEBP, or SVG).");
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                showAlert.warning("Logo image exceeds 5MB. Please choose a smaller image.");
                return;
            }
            selectedWsLogoFile = file;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result;
                updateLogoDisplay(dataUrl);
                if (logoUrlInput) {
                    logoUrlInput.value = dataUrl;
                }
                checkDirty();
            };
            reader.readAsDataURL(file);
        };

        btnUploadLogo?.addEventListener('click', () => logoFileInput?.click());
        logoDropzone?.addEventListener('click', () => logoFileInput?.click());

        logoFileInput?.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handleLogoFile(file);
        });

        logoUrlInput?.addEventListener('input', (e) => {
            selectedWsLogoFile = null;
            const urlVal = e.target.value.trim();
            updateLogoDisplay(urlVal);
            checkDirty();
        });

        btnClearLogo?.addEventListener('click', (e) => {
            e.stopPropagation();
            selectedWsLogoFile = null;
            if (logoFileInput) logoFileInput.value = '';
            if (logoUrlInput) logoUrlInput.value = '';
            updateLogoDisplay('');
            checkDirty();
        });

        // Dropzone drag-and-drop
        if (logoDropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                logoDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logoDropzone.style.borderColor = 'var(--primary)';
                    logoDropzone.style.background = '#f4f4f5';
                    if (logoOverlayHint) logoOverlayHint.style.display = 'flex';
                });
            });
            ['dragleave', 'drop'].forEach(eventName => {
                logoDropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    logoDropzone.style.borderColor = 'var(--border-color)';
                    logoDropzone.style.background = '#ffffff';
                    if (logoOverlayHint) logoOverlayHint.style.display = 'none';
                });
            });
            logoDropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer && e.dataTransfer.files;
                if (files && files.length > 0) {
                    handleLogoFile(files[0]);
                }
            });
            logoDropzone.addEventListener('mouseenter', () => {
                if (logoOverlayHint) logoOverlayHint.style.display = 'flex';
            });
            logoDropzone.addEventListener('mouseleave', () => {
                if (logoOverlayHint) logoOverlayHint.style.display = 'none';
            });
        }

        // Live Workspace Name monogram initial sync
        container.querySelector('#set-name')?.addEventListener('input', () => {
            if (!logoPreviewImg?.src || logoPreviewImg.style.display === 'none') {
                const curName = (container.querySelector('#set-name')?.value || wsDisplayName || 'W').trim();
                if (logoPlaceholder) logoPlaceholder.textContent = (curName.charAt(0) || 'W').toUpperCase();
            }
        });

        // Snapshot & Dirty Checking for Floating Bar
        let savedSnapshot = {
            enableVending: isVendingActive,
            currencySymbol: wsCurrency,
            name: wsDisplayName,
            email: wsEmail,
            phone: wsPhone,
            address: wsAddress,
            shopName: wsShopName,
            endMessage: wsEndMsg,
            customerName: printCustName,
            customerNumber: printCustPhone,
            logoUrl: logoUrl
        };

        const floatingBar = container.querySelector('#settings-floating-bar');
        const btnSave = container.querySelector('#btn-save-settings');
        const btnDiscard = container.querySelector('#btn-discard-settings');

        const checkDirty = () => {
            const curVending = Boolean(container.querySelector('#set-vending')?.checked);
            const curSymbol = (currencyInput?.value || '$').trim().substring(0, 3) || '$';
            const curName = (container.querySelector('#set-name')?.value || '').trim();
            const curEmail = (container.querySelector('#set-email')?.value || '').trim();
            const curPhone = (container.querySelector('#set-phone')?.value || '').trim();
            const curAddress = (container.querySelector('#set-address')?.value || '').trim();
            const curShop = (container.querySelector('#set-shop-name')?.value || '').trim();
            const curEndMsg = (container.querySelector('#set-end-msg')?.value || '').trim();
            const curCustName = Boolean(container.querySelector('#set-show-cust-name')?.checked);
            const curCustPhone = Boolean(container.querySelector('#set-show-cust-num')?.checked);
            const curLogoUrl = (container.querySelector('#set-logo-url')?.value || '').trim();

            const isLogoDirty = Boolean(selectedWsLogoFile) || (curLogoUrl !== (savedSnapshot.logoUrl || ''));

            const isDirty = (
                curVending !== savedSnapshot.enableVending ||
                curSymbol !== savedSnapshot.currencySymbol ||
                curName !== savedSnapshot.name ||
                curEmail !== savedSnapshot.email ||
                curPhone !== savedSnapshot.phone ||
                curAddress !== savedSnapshot.address ||
                curShop !== savedSnapshot.shopName ||
                curEndMsg !== savedSnapshot.endMessage ||
                curCustName !== savedSnapshot.customerName ||
                curCustPhone !== savedSnapshot.customerNumber ||
                isLogoDirty
            );

            if (floatingBar) {
                if (isDirty) {
                    floatingBar.style.opacity = '1';
                    floatingBar.style.pointerEvents = 'auto';
                    floatingBar.style.transform = 'translateX(-50%) translateY(0)';
                } else {
                    floatingBar.style.opacity = '0';
                    floatingBar.style.pointerEvents = 'none';
                    floatingBar.style.transform = 'translateX(-50%) translateY(100px)';
                }
            }
        };

        ['#set-name', '#set-email', '#set-phone', '#set-address', '#set-shop-name', '#set-end-msg', '#set-logo-url'].forEach(sel => {
            container.querySelector(sel)?.addEventListener('input', checkDirty);
        });
        ['#set-show-cust-name', '#set-show-cust-num'].forEach(sel => {
            container.querySelector(sel)?.addEventListener('change', checkDirty);
        });

        // Discard Handler
        btnDiscard?.addEventListener('click', () => {
            selectedWsLogoFile = null;
            if (container.querySelector('#set-name')) container.querySelector('#set-name').value = savedSnapshot.name;
            if (container.querySelector('#set-email')) container.querySelector('#set-email').value = savedSnapshot.email;
            if (container.querySelector('#set-phone')) container.querySelector('#set-phone').value = savedSnapshot.phone;
            if (container.querySelector('#set-address')) container.querySelector('#set-address').value = savedSnapshot.address;
            if (container.querySelector('#set-shop-name')) container.querySelector('#set-shop-name').value = savedSnapshot.shopName;
            if (container.querySelector('#set-end-msg')) container.querySelector('#set-end-msg').value = savedSnapshot.endMessage;
            if (container.querySelector('#set-show-cust-name')) container.querySelector('#set-show-cust-name').checked = savedSnapshot.customerName;
            if (container.querySelector('#set-show-cust-num')) container.querySelector('#set-show-cust-num').checked = savedSnapshot.customerNumber;
            if (container.querySelector('#set-logo-file')) container.querySelector('#set-logo-file').value = '';
            if (container.querySelector('#set-logo-url')) container.querySelector('#set-logo-url').value = savedSnapshot.logoUrl || '';
            updateLogoDisplay(savedSnapshot.logoUrl || '');
            if (currencyInput) currencyInput.value = savedSnapshot.currencySymbol;
            if (vendingInput) vendingInput.checked = savedSnapshot.enableVending;
            if (vendingLabel) {
                vendingLabel.textContent = savedSnapshot.enableVending ? 'ENABLED' : 'DISABLED';
                vendingLabel.style.color = savedSnapshot.enableVending ? '#059669' : 'var(--text-muted)';
            }
            updateCurrencyPreview(savedSnapshot.currencySymbol);
            updateTicketPreview();
            checkDirty();
            showAlert.info("Changes reverted back to saved settings.");
        });

        // Save Settings Handler
        btnSave?.addEventListener('click', async () => {
            let finalLogoUrl = (container.querySelector('#set-logo-url')?.value || '').trim();

            if (selectedWsLogoFile) {
                btnSave.disabled = true;
                btnSave.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Uploading Logo...`;
                try {
                    finalLogoUrl = await storageService.uploadImage(selectedWsLogoFile, workspaceId);
                } catch (uploadErr) {
                    console.warn("Storage logo upload failed:", uploadErr);
                    showAlert.warning("Logo upload had an issue. Saving local entered logo instead.");
                }
            }

            const updatedPayload = {
                enableVending: Boolean(container.querySelector('#set-vending')?.checked),
                currency: (currencyInput?.value || '$').trim().substring(0, 3) || '$',
                currencySymbol: (currencyInput?.value || '$').trim().substring(0, 3) || '$',
                name: (container.querySelector('#set-name')?.value || '').trim(),
                email: (container.querySelector('#set-email')?.value || '').trim(),
                phone: (container.querySelector('#set-phone')?.value || '').trim(),
                address: (container.querySelector('#set-address')?.value || '').trim(),
                shopName: (container.querySelector('#set-shop-name')?.value || '').trim(),
                endMessage: (container.querySelector('#set-end-msg')?.value || '').trim(),
                customerName: Boolean(container.querySelector('#set-show-cust-name')?.checked),
                customerNumber: Boolean(container.querySelector('#set-show-cust-num')?.checked),
                logoUrl: finalLogoUrl
            };

            if (!updatedPayload.name) {
                showAlert.warning("Workspace name cannot be empty.");
                return;
            }
            if (!updatedPayload.email) {
                showAlert.warning("Business email cannot be empty.");
                return;
            }

            btnSave.disabled = true;
            btnSave.innerHTML = `<span class="spinner-sm" style="display:inline-block; margin-right:6px;"></span> Saving...`;

            try {
                await settingsService.saveWorkspaceSettings(updatedPayload);
                selectedWsLogoFile = null;
                savedSnapshot = { ...updatedPayload };
                if (container.querySelector('#set-logo-url')) {
                    container.querySelector('#set-logo-url').value = finalLogoUrl;
                }
                updateLogoDisplay(finalLogoUrl);
                checkDirty();

                // Live UI sync for workspace logos & names
                if (window.__activeWorkspace) {
                    window.__activeWorkspace.logoUrl = finalLogoUrl;
                    window.__activeWorkspace.logo = finalLogoUrl;
                    window.__activeWorkspace.name = updatedPayload.name;
                }
                const sidebarLogo = document.querySelector('.sidebar-logo');
                if (sidebarLogo && finalLogoUrl) {
                    sidebarLogo.src = finalLogoUrl;
                }

                showAlert.success("Workspace credentials & settings saved successfully!");
            } catch (err) {
                console.error("Save settings error:", err);
                showAlert.error("Failed to save settings: " + (err.message || 'Unknown error'));
            } finally {
                btnSave.disabled = false;
                btnSave.textContent = 'Save Changes';
            }
        });

        // Data Management Buttons
        container.querySelector('#btn-settings-market-inserter')?.addEventListener('click', () => {
            window.location.hash = '#/market-inserter';
        });
        container.querySelector('#btn-settings-headers-template')?.addEventListener('click', () => downloadHeadersOnlyTemplate());
        container.querySelector('#btn-settings-sample-template')?.addEventListener('click', () => downloadExampleDataTemplate());
        container.querySelector('#btn-settings-import-excel')?.addEventListener('click', () => {
            openExcelImportModal(workspaceId, () => showAlert.success("Spreadsheet data successfully imported!"));
        });
        container.querySelector('#btn-settings-export-data')?.addEventListener('click', () => {
            openExportModal(workspaceId, { workspaceInfo: wsData });
        });

        // Delete Workspace Handler (Admin Only)
        container.querySelector('#btn-delete-workspace')?.addEventListener('click', async () => {
            const btnDel = container.querySelector('#btn-delete-workspace');
            try {
                btnDel.disabled = true;
                btnDel.textContent = 'Checking active workers...';

                const members = await firestoreService.getWorkspaceMembers(workspaceId);
                const activeOthers = members.filter(m => {
                    const mEmail = (m.email || '').toLowerCase();
                    const isSelf = mEmail === (currentUser.email || '').toLowerCase() || m.workerUid === currentUser.uid;
                    return !isSelf;
                });

                if (activeOthers.length > 0) {
                    showAlert.error(`Cannot delete workspace. Remove all active workers (${activeOthers.length} active member(s) remaining) before deleting.`);
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                    return;
                }

                if (!await showAlert.confirm("WARNING: Are you sure you want to PERMANENTLY destroy this workspace? All catalog products, invoices, categories, client records, and cloud storage will be permanently wiped!")) {
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                    return;
                }

                btnDel.textContent = 'Deleting all server data...';
                await firestoreService.deleteEntireWorkspace(workspaceId, currentUser);
                showAlert.success("Workspace and all associated server data successfully deleted.");
                window.location.href = 'index.html';
            } catch (err) {
                console.error("Delete workspace error:", err);
                showAlert.error(err.message || "Failed to delete workspace.");
                if (btnDel) {
                    btnDel.disabled = false;
                    btnDel.textContent = 'Delete Entire Workspace';
                }
            }
        });

        // Leave Workspace Handler (Worker / Co-Admin)
        container.querySelector('#btn-leave-workspace')?.addEventListener('click', async () => {
            if (await showAlert.confirm("Are you sure you want to leave this workspace? You will lose access to its products and invoices.")) {
                try {
                    await firestoreService.leaveWorkspace(workspaceId, currentUser);
                    showAlert.success("You have successfully left the workspace.");
                    window.location.href = 'index.html';
                } catch (err) {
                    showAlert.error("Failed to leave workspace: " + (err.message || 'Unknown error'));
                }
            }
        });

    } catch (err) {
        console.error("Render settings error:", err);
        showAlert.error("Failed to load workspace settings.");
    }
};
