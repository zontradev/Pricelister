/**
 * PriceLister - Customer Panel Setup Module (Admin & Co-admin Only)
 * Allows Workspace Admins to configure, activate/suspend, and launch their
 * standalone customer-facing product catalog & shopping cart portal.
 */

import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';

export const renderCustomerPanelSetup = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    // 1. Role Verification: Only Admin or Co-admin can configure Customer Panel
    const userRole = (window.__activeWorkspace?.role || 'WORKER').toUpperCase();
    const isAuthorized = userRole === 'CREATOR_ADMIN' || userRole === 'ADMIN' || userRole === 'CREATOR' || userRole === 'CO_ADMIN' || userRole === 'CO-ADMIN';

    if (!isAuthorized) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem 1.5rem; max-width: 550px; margin: 2rem auto;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Access Restricted</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                    Only Workspace Admins and Co-admins have permission to configure and manage the Customer Panel.
                </p>
                <button class="btn btn-primary" onclick="window.location.hash='#/overview'">Return to Overview</button>
            </div>
        `;
        return;
    }

    // 2. Fetch Data
    container.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; min-height:300px;">
            <div class="spinner"></div>
        </div>
    `;

    const settingsService = getSettingsService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    let panelSettings = {};
    let allCategories = [];

    try {
        [panelSettings, allCategories] = await Promise.all([
            settingsService.getCustomerPanelSettings(),
            categoryService.getAllCategories().catch(() => [])
        ]);
    } catch (err) {
        console.error("Error loading customer panel setup:", err);
        showAlert.error("Could not load Customer Panel settings.");
    }

    // Calculate customer link
    const baseUrl = window.location.origin + window.location.pathname.replace('app.html', 'customer.html');
    const customerPanelUrl = `${baseUrl}?ws=${workspaceId}`;

    const isEnabled = Boolean(panelSettings.enabled);
    const statusPillHtml = isEnabled 
        ? `<span id="header-status-pill" class="status-pill status-pill-active">● Active (Live)</span>` 
        : `<span id="header-status-pill" class="status-pill status-pill-danger">⏸️ Stopped (Closed)</span>`;

    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
            <div>
                <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.25rem;">
                    <h2 style="margin:0; font-size:1.75rem; font-weight:700;">Customer Panel Setup</h2>
                    ${statusPillHtml}
                </div>
                <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                    Setup a standalone web catalog where customers can view products, filter categories, and add items to a shopping cart.
                </p>
            </div>
            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                <button type="button" id="btn-copy-customer-link" class="btn btn-secondary" style="font-weight:600; display:flex; align-items:center; gap:0.4rem;" title="Copy shareable customer portal link">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy Link
                </button>
                <a href="${customerPanelUrl}" target="_blank" id="btn-launch-customer-panel" class="btn btn-primary" style="font-weight:700; display:flex; align-items:center; gap:0.4rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow:0 4px 14px rgba(16,185,129,0.3);" title="Open customer catalog in a separate new browser tab">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    Launch Panel ↗
                </a>
            </div>
        </div>

        <!-- SHAREABLE LINK HERO CARD -->
        <div class="card" style="margin-bottom: 1.5rem; background: #ffffff; border-left: 4px solid var(--primary); padding: 1.25rem 1.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div style="flex:1; min-width:280px;">
                    <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em;">Shareable Customer Catalog Link</span>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.35rem;">
                        <input type="text" id="customer-panel-url-input" readonly value="${customerPanelUrl}" class="form-control" style="font-family:monospace; font-size:0.85rem; background:var(--surface-50); color:var(--text-primary); cursor:pointer; flex:1;" title="Click to copy">
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-size:0.85rem; color:var(--text-secondary);">Customers can browse & calculate orders on any phone, tablet, or PC.</span>
                </div>
            </div>
        </div>

        <!-- CONFIGURATION FORM -->
        <form id="customer-panel-form" style="display:flex; flex-direction:column; gap:1.5rem;">
            
            <!-- 1. LIVE STATUS & AVAILABILITY -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">1. Panel Status & Availability</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Control whether the Customer Panel is currently accessible or temporarily suspended.</p>

                <div style="display:flex; align-items:center; gap:1rem; padding:1rem; border-radius:10px; background:var(--surface-50); border:1px solid var(--border-color);">
                    <div style="flex:1;">
                        <label style="font-weight:600; font-size:0.95rem; color:var(--text-primary); margin-bottom:0.2rem; display:block;">
                            Customer Panel Status
                        </label>
                        <span id="status-desc-text" style="font-size:0.82rem; color:var(--text-secondary);">
                            ${isEnabled ? 'The catalog is online. Customers can browse products and add items to cart.' : 'The catalog is stopped / closed. Customers will see a "Temporary Closed" message.'}
                        </span>
                    </div>
                    <div>
                        <select id="cp-status-select" class="form-control" style="font-weight:600; padding:0.5rem 1rem; width:180px;">
                            <option value="ACTIVE" ${isEnabled ? 'selected' : ''}>🟢 Active (Live)</option>
                            <option value="STOPPED" ${!isEnabled ? 'selected' : ''}>⏸️ Stopped (Closed)</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- 2. STORE BRANDING & MESSAGING -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">2. Store Branding & Contact</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Information visible to customers in the catalog header and cart inquiry.</p>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1rem; margin-bottom:1rem;">
                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Title *</label>
                        <input type="text" id="cp-store-name" required class="form-control" value="${escapeHtml(panelSettings.storeName || '')}" placeholder="e.g. Apex Mart & Electronics">
                    </div>
                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">WhatsApp Ordering Number</label>
                        <input type="text" id="cp-whatsapp" class="form-control" value="${escapeHtml(panelSettings.whatsappNumber || '')}" placeholder="e.g. +8801700000000 (with country code)">
                        <small style="color:var(--text-muted); font-size:0.75rem;">Allows customers to send cart orders directly to your WhatsApp with 1 click.</small>
                    </div>
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Banner Announcement Message</label>
                    <input type="text" id="cp-announcement" class="form-control" value="${escapeHtml(panelSettings.announcement || '')}" placeholder="e.g. Welcome! Add items to cart to see live totals or send inquiry.">
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem;">
                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Phone</label>
                        <input type="text" id="cp-phone" class="form-control" value="${escapeHtml(panelSettings.phone || '')}" placeholder="e.g. 01700000000">
                    </div>
                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Store Email</label>
                        <input type="email" id="cp-email" class="form-control" value="${escapeHtml(panelSettings.email || '')}" placeholder="e.g. store@example.com">
                    </div>
                    <div>
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Address / Location</label>
                        <input type="text" id="cp-address" class="form-control" value="${escapeHtml(panelSettings.address || '')}" placeholder="e.g. Block C, Dhaka, Bangladesh">
                    </div>
                </div>
            </div>

            <!-- 3. CATEGORIES VISIBILITY -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">3. Category Visibility</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Choose whether to expose all product categories or only specific ones to customers.</p>

                <div style="display:flex; gap:1.5rem; margin-bottom:1.25rem; flex-wrap:wrap;">
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">
                        <input type="radio" name="cp-cat-mode" value="ALL" ${panelSettings.categorySelectionMode !== 'SPECIFIC' ? 'checked' : ''}>
                        <span>Show All Categories (${allCategories.length} Categories)</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-weight:600;">
                        <input type="radio" name="cp-cat-mode" value="SPECIFIC" ${panelSettings.categorySelectionMode === 'SPECIFIC' ? 'checked' : ''}>
                        <span>Choose Specific Categories</span>
                    </label>
                </div>

                <div id="cp-specific-categories-container" style="display:${panelSettings.categorySelectionMode === 'SPECIFIC' ? 'block' : 'none'}; border:1px solid var(--border-color); border-radius:10px; padding:1rem; background:var(--surface-50);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Categories to Include:</span>
                        <div style="display:flex; gap:0.5rem;">
                            <button type="button" id="btn-select-all-cats" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;">Select All</button>
                            <button type="button" id="btn-deselect-all-cats" class="btn btn-secondary btn-sm" style="font-size:0.75rem; padding:0.2rem 0.5rem;">Clear</button>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:0.6rem;">
                        ${allCategories.map(cat => {
                            const isChecked = panelSettings.allowedCategories.includes(cat.name);
                            return `
                                <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; background:#ffffff; border:1px solid var(--border-color); border-radius:6px; cursor:pointer;">
                                    <input type="checkbox" class="cp-cat-checkbox" value="${escapeHtml(cat.name)}" ${isChecked ? 'checked' : ''}>
                                    <span style="width:10px; height:10px; border-radius:50%; background:${cat.color || '#3b82f6'}; flex-shrink:0;"></span>
                                    <span style="font-size:0.85rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(cat.name)}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- 4. PRICING & DISPLAY OPTIONS -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">4. Pricing & Details Options</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Control how prices and stock are presented to customers.</p>

                <div style="display:flex; flex-direction:column; gap:0.85rem;">
                    <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                        <input type="checkbox" id="cp-show-mrp" ${panelSettings.showMrp ? 'checked' : ''}>
                        <div>
                            <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show MRP / Original Price Strikethrough</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">Displays crossed-out MRP with discount percentage badge if MRP is higher than Selling Price.</span>
                        </div>
                    </label>

                    <label style="display:flex; align-items:center; gap:0.6rem; cursor:pointer;">
                        <input type="checkbox" id="cp-show-stock" ${panelSettings.showStockBadge ? 'checked' : ''}>
                        <div>
                            <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary); display:block;">Show In-Stock / Availability Badges</span>
                            <span style="font-size:0.8rem; color:var(--text-secondary);">Displays real-time stock availability badge on product cards.</span>
                        </div>
                    </label>
                </div>
            </div>

            <!-- 5. TERMS & CONDITIONS -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">5. Terms & Conditions</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Store policies, ordering instructions, and delivery details shown to customers in a modal or notice footer.</p>

                <textarea id="cp-terms" rows="4" class="form-control" style="width:100%; font-family:inherit; line-height:1.5;" placeholder="• Prices subject to change without notice.&#10;• Fast home delivery available.&#10;• For bulk inquiries, contact WhatsApp.">${escapeHtml(panelSettings.termsAndConditions || '')}</textarea>
            </div>

            <!-- 6. TEMPORARY CLOSED / SUSPENDED MESSAGE -->
            <div class="card" style="padding:1.5rem;">
                <h3 style="font-size:1.15rem; margin-bottom:0.25rem; font-weight:700; color:var(--text-primary);">6. Suspended / Temporary Closed Message</h3>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1.25rem;">Message displayed to customers when the panel is set to Stopped/Closed.</p>

                <textarea id="cp-closed-msg" rows="3" class="form-control" style="width:100%; font-family:inherit;" placeholder="Temporary Closed&#10;Shop is temporarily suspended, may start early.">${escapeHtml(panelSettings.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.')}</textarea>
            </div>

            <!-- SAVE ACTION BAR -->
            <div style="display:flex; justify-content:flex-end; gap:0.75rem; padding:1rem 0; align-items:center;">
                <button type="button" class="btn btn-secondary" onclick="window.location.hash='#/overview'">Cancel</button>
                <button type="submit" id="btn-save-customer-panel" class="btn btn-primary" style="padding:0.65rem 1.75rem; font-weight:700; font-size:0.95rem;">
                    Save Customer Panel Settings
                </button>
            </div>
        </form>
    `;

    // Form Interactions
    const form = document.getElementById('customer-panel-form');
    const statusSelect = document.getElementById('cp-status-select');
    const statusDesc = document.getElementById('status-desc-text');
    const headerPill = document.getElementById('header-status-pill');
    const urlInput = document.getElementById('customer-panel-url-input');
    const copyBtn = document.getElementById('btn-copy-customer-link');

    // Status change listener
    if (statusSelect) {
        statusSelect.addEventListener('change', () => {
            const isLive = statusSelect.value === 'ACTIVE';
            if (statusDesc) {
                statusDesc.textContent = isLive 
                    ? 'The catalog is online. Customers can browse products and add items to cart.'
                    : 'The catalog is stopped / closed. Customers will see a "Temporary Closed" message.';
            }
            if (headerPill) {
                headerPill.className = isLive ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
                headerPill.textContent = isLive ? '● Active (Live)' : '⏸️ Stopped (Closed)';
            }
        });
    }

    // Category Radio Buttons
    const catRadios = document.querySelectorAll('input[name="cp-cat-mode"]');
    const specificContainer = document.getElementById('cp-specific-categories-container');
    catRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (specificContainer) {
                specificContainer.style.display = r.value === 'SPECIFIC' ? 'block' : 'none';
            }
        });
    });

    // Select All / Clear Categories
    const btnSelectAll = document.getElementById('btn-select-all-cats');
    const btnClearAll = document.getElementById('btn-deselect-all-cats');
    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = true);
        });
    }
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            document.querySelectorAll('.cp-cat-checkbox').forEach(cb => cb.checked = false);
        });
    }

    // Copy URL helper
    const handleCopy = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(customerPanelUrl).then(() => {
                showAlert.success("Customer Panel link copied to clipboard!");
            }).catch(() => {
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }
    };

    const fallbackCopy = () => {
        if (urlInput) {
            urlInput.select();
            document.execCommand('copy');
            showAlert.success("Customer Panel link copied to clipboard!");
        }
    };

    if (copyBtn) copyBtn.addEventListener('click', handleCopy);
    if (urlInput) urlInput.addEventListener('click', handleCopy);

    // Save Settings Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-save-customer-panel');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Saving...';
            }

            try {
                const isLive = statusSelect ? statusSelect.value === 'ACTIVE' : true;
                const catMode = document.querySelector('input[name="cp-cat-mode"]:checked')?.value || 'ALL';
                
                const selectedCats = [];
                if (catMode === 'SPECIFIC') {
                    document.querySelectorAll('.cp-cat-checkbox:checked').forEach(cb => {
                        selectedCats.push(cb.value);
                    });
                }

                const updatedData = {
                    enabled: isLive,
                    storeName: document.getElementById('cp-store-name')?.value || 'PriceLister Store',
                    whatsappNumber: document.getElementById('cp-whatsapp')?.value || '',
                    announcement: document.getElementById('cp-announcement')?.value || '',
                    phone: document.getElementById('cp-phone')?.value || '',
                    email: document.getElementById('cp-email')?.value || '',
                    address: document.getElementById('cp-address')?.value || '',
                    categorySelectionMode: catMode,
                    allowedCategories: selectedCats,
                    showMrp: Boolean(document.getElementById('cp-show-mrp')?.checked),
                    showStockBadge: Boolean(document.getElementById('cp-show-stock')?.checked),
                    termsAndConditions: document.getElementById('cp-terms')?.value || '',
                    closedMessage: document.getElementById('cp-closed-msg')?.value || 'Temporary Closed\nShop is temporarily suspended, may start early.',
                    currencySymbol: getAppCurrencySymbol()
                };

                await settingsService.saveCustomerPanelSettings(updatedData);

                // Update sidebar status badge if present
                const sidebarStatus = document.getElementById('sidebar-customer-panel-status');
                if (sidebarStatus) {
                    sidebarStatus.className = isLive ? 'status-pill status-pill-active' : 'status-pill status-pill-danger';
                    sidebarStatus.textContent = isLive ? 'Live' : 'Closed';
                }

                showAlert.success("Customer Panel settings updated successfully!");
            } catch (err) {
                console.error("Save error:", err);
                showAlert.error("Failed to save Customer Panel settings.");
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Save Customer Panel Settings';
                }
            }
        });
    }
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};
