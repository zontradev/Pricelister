import { authService } from '../../firebase/auth.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { getAppCurrencySymbol } from '../utilities.js';

/**
 * Market Inserter Module (Dedicated In-Page Section)
 * Fast spreadsheet grid inserting up to 250 products at once with live duplicate detection,
 * instant image picking, variations, and batch progress tracking.
 */
export const renderMarketInserter = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        showAlert.error('You must be logged in to insert products.');
        return;
    }

    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    // Load existing categories and active products for duplicate detection
    let categories = [];
    let existingProducts = [];
    try {
        const [cList, pList] = await Promise.all([
            categoryService.getAllCategories().catch(() => []),
            productService.getAllActiveProducts().catch(() => [])
        ]);
        categories = cList || [];
        existingProducts = pList || [];
    } catch (e) {
        console.warn("Could not pre-fetch data for Market Inserter:", e);
    }

    // Row model state store
    const MAX_ROWS = 250;
    let rowDataList = [];

    const createBlankRow = () => ({
        id: 'row_' + Math.random().toString(36).substring(2, 9),
        name: '',
        category: categories.length > 0 ? (categories[0].uniqueId || categories[0].id) : '',
        sizeWeight: '',
        quantity: 0,
        basePrice: 0,
        price: 0,
        salePrice: 0,
        mrp: 0,
        upcCode: '',
        mfgDate: '',
        expDate: '',
        note: '',
        imageFile: null,
        previewUrl: '',
        variations: []
    });

    // Initialize with default 10 rows
    for (let i = 0; i < 10; i++) {
        rowDataList.push(createBlankRow());
    }

    container.innerHTML = `
        <div class="market-inserter-page" style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            <!-- 1. Header Toolbar Section -->
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 0;">
                <div>
                    <h2 style="margin: 0 0 0.25rem 0;">Market Inserter</h2>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                        Fast spreadsheet grid — insert up to 250 products at once with live duplicate protection & instant image pickers
                    </p>
                </div>

                <!-- Quick Action Buttons -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.35rem; background: var(--surface-50); padding: 0.35rem 0.65rem; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.82rem; font-weight: 600;">
                        <span>Rows:</span>
                        <span id="mi-row-counter" style="color: var(--primary); font-weight: 700;">10 / 250</span>
                    </div>

                    <!-- Add Row buttons -->
                    <button id="mi-btn-add-1" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 1 Row</button>
                    <button id="mi-btn-add-5" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 5 Rows</button>
                    <button id="mi-btn-add-10" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 10 Rows</button>
                    <button id="mi-btn-add-50" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 50 Rows</button>

                    <div style="height: 24px; width: 1px; background: var(--border-color); margin: 0 0.25rem;"></div>

                    <!-- Bulk category applicator -->
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <select id="mi-bulk-cat-select" class="form-control" style="font-size: 0.8rem; padding: 0.4rem 0.65rem; max-width: 150px;">
                            <option value="">Category for All...</option>
                            ${categories.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('')}
                        </select>
                        <button id="mi-btn-apply-cat" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.7rem;" title="Apply selected category to all rows">Apply</button>
                    </div>

                    <button id="mi-btn-clear-empty" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem;" title="Remove rows that have no product name">Clear Empty</button>
                </div>
            </div>

            <!-- 2. Grid Table Card (In-Page Section) -->
            <div class="card" style="padding: 0; overflow: hidden; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; position: relative;">
                
                <div id="mi-grid-container" style="max-height: calc(100vh - 290px); min-height: 480px; overflow: auto; background: var(--surface-0);">
                    <table id="mi-grid-table" style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1400px; font-size: 0.85rem;">
                        <thead>
                            <tr style="position: sticky; top: 0; z-index: 10; background: var(--surface-100, #f1f5f9); color: var(--text-secondary); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                                <th style="width: 44px; padding: 0.65rem 0.4rem; text-align: center; border-bottom: 1px solid var(--border-color);">#</th>
                                <th style="width: 76px; padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">Image</th>
                                <th style="min-width: 190px; padding: 0.65rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border-color);">Product Name *</th>
                                <th style="width: 155px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Category *</th>
                                <th style="width: 105px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Size / Weight</th>
                                <th style="width: 90px; padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Stock (Qty)</th>
                                <th style="width: 100px; padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Base Cost (${getAppCurrencySymbol()})</th>
                                <th style="width: 100px; padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">Wholesale (${getAppCurrencySymbol()})</th>
                                <th style="width: 110px; padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--primary);">Sale Price * (${getAppCurrencySymbol()})</th>
                                <th style="width: 95px; padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color);">MRP (${getAppCurrencySymbol()})</th>
                                <th style="width: 130px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">UPC / Barcode</th>
                                <th style="width: 120px; padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">Variations</th>
                                <th style="width: 115px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Mfg Date</th>
                                <th style="width: 115px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Exp Date</th>
                                <th style="min-width: 140px; padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color);">Note</th>
                                <th style="width: 75px; padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color);">Action</th>
                            </tr>
                        </thead>
                        <tbody id="mi-tbody">
                            <!-- Dynamic Grid Rows Rendered Here -->
                        </tbody>
                    </table>
                </div>

                <!-- 3. Bottom Actions & Summary Bar -->
                <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: var(--surface-50, #f8fafc); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div id="mi-summary-text" style="font-size: 0.88rem; color: var(--text-secondary);">
                            <strong id="mi-valid-count" style="color: var(--text-primary); font-size: 1rem;">0</strong> products ready to insert
                        </div>
                        <div id="mi-duplicate-warning-pill" style="display: none; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: #d97706; background: rgba(245, 158, 11, 0.12); padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.25);">
                            <span>⚠️ <strong id="mi-dup-count">0</strong> potential duplicates</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <button id="mi-btn-cancel-to-products" class="btn btn-secondary" style="font-size: 0.88rem; padding: 0.6rem 1.25rem;">Back to Products</button>
                        <button id="mi-btn-submit" class="btn btn-primary" style="font-size: 0.92rem; font-weight: 700; padding: 0.65rem 2rem; display: flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            <span id="mi-btn-submit-label">Insert Products</span>
                        </button>
                    </div>
                </div>

                <!-- 4. Real-time Batch Progress Overlay (Embedded in card) -->
                <div id="mi-progress-overlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.88); z-index: 1000; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center;">
                    <div style="background: var(--surface-0); padding: 2.5rem 2rem; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid var(--border-color);">
                        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                        </div>
                        <h3 id="mi-progress-title" style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Inserting Products...</h3>
                        <p id="mi-progress-desc" style="margin: 0 0 1.5rem 0; font-size: 0.85rem; color: var(--text-secondary);">Uploading image & saving: <strong id="mi-progress-item-name">Loading...</strong></p>
                        
                        <!-- Progress Bar -->
                        <div style="width: 100%; height: 10px; background: var(--surface-100, #e2e8f0); border-radius: 9999px; overflow: hidden; margin-bottom: 0.75rem;">
                            <div id="mi-progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.2s ease;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                            <span id="mi-progress-count">0 of 0</span>
                            <span id="mi-progress-percent">0%</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- 5. Variations Sub-Modal -->
            <div id="mi-var-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 100000; align-items: center; justify-content: center; padding: 1.5rem;">
                <div class="card" style="background: var(--surface-0); width: 100%; max-width: 540px; border-radius: 14px; padding: 1.5rem; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                        <div>
                            <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Manage Product Variations</h4>
                            <p id="mi-var-target-name" style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">Row variations</p>
                        </div>
                        <button id="mi-var-close-x" class="icon-btn" style="border: none; background: transparent; cursor: pointer;">✕</button>
                    </div>
                    
                    <div id="mi-var-list" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem;">
                        <!-- Variation Rows -->
                    </div>

                    <button id="mi-var-add-row" class="btn btn-secondary" style="width: 100%; font-size: 0.82rem; margin-bottom: 1.25rem;">+ Add Variation Option</button>

                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button id="mi-var-cancel" class="btn btn-secondary" style="font-size: 0.85rem;">Cancel</button>
                        <button id="mi-var-save" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700;">Save Variations</button>
                    </div>
                </div>
            </div>

        </div>
    `;

    const tbody = container.querySelector('#mi-tbody');
    const rowCounter = container.querySelector('#mi-row-counter');
    const validCountEl = container.querySelector('#mi-valid-count');
    const dupPill = container.querySelector('#mi-duplicate-warning-pill');
    const dupCountEl = container.querySelector('#mi-dup-count');
    const btnSubmitLabel = container.querySelector('#mi-btn-submit-label');

    // Duplicate detection helper
    const checkDuplicates = () => {
        const nameMap = new Map();
        let dupCount = 0;
        let validCount = 0;

        rowDataList.forEach((r, idx) => {
            const cleanName = (r.name || '').trim().toLowerCase();
            if (cleanName) {
                validCount++;
                if (!nameMap.has(cleanName)) {
                    nameMap.set(cleanName, []);
                }
                nameMap.get(cleanName).push(idx);
            }
        });

        rowDataList.forEach((r, idx) => {
            const rowEl = tbody.querySelector(`tr[data-index="${idx}"]`);
            if (!rowEl) return;
            const nameInput = rowEl.querySelector('.mi-input-name');
            const dupIndicator = rowEl.querySelector('.mi-dup-badge');
            const cleanName = (r.name || '').trim().toLowerCase();

            if (!cleanName) {
                if (nameInput) nameInput.style.borderColor = 'var(--border-color)';
                if (dupIndicator) dupIndicator.style.display = 'none';
                return;
            }

            const inCatalog = existingProducts.some(p => (p.name || '').trim().toLowerCase() === cleanName);
            const inTableDup = nameMap.has(cleanName) && nameMap.get(cleanName).length > 1;

            if (inCatalog || inTableDup) {
                dupCount++;
                if (nameInput) {
                    nameInput.style.borderColor = '#f59e0b';
                    nameInput.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
                }
                if (dupIndicator) {
                    dupIndicator.style.display = 'inline-block';
                    dupIndicator.textContent = inCatalog ? 'Catalog Dup' : 'Table Dup';
                    dupIndicator.title = inCatalog ? 'This name already exists in your workspace catalog' : 'Duplicate name in this table';
                }
            } else {
                if (nameInput) {
                    nameInput.style.borderColor = 'var(--border-color)';
                    nameInput.style.backgroundColor = 'transparent';
                }
                if (dupIndicator) dupIndicator.style.display = 'none';
            }
        });

        validCountEl.textContent = validCount;
        btnSubmitLabel.textContent = validCount > 0 ? `Insert ${validCount} Products` : 'Insert Products';

        if (dupCount > 0) {
            dupPill.style.display = 'inline-flex';
            dupCountEl.textContent = dupCount;
        } else {
            dupPill.style.display = 'none';
        }
    };

    // Render Grid Table Rows
    const renderRows = () => {
        tbody.innerHTML = rowDataList.map((row, idx) => {
            const hasImage = Boolean(row.previewUrl || row.imageUri);
            const varCount = (row.variations || []).length;

            return `
                <tr data-index="${idx}" style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                    
                    <!-- 1. Index -->
                    <td style="padding: 0.4rem; text-align: center; font-weight: 700; color: var(--text-muted); font-size: 0.78rem; background: var(--surface-50);">
                        ${idx + 1}
                    </td>

                    <!-- 2. Image Picker -->
                    <td style="padding: 0.35rem 0.5rem; text-align: center;">
                        <input type="file" class="mi-file-input" data-index="${idx}" accept="image/*" style="display: none;">
                        <div class="mi-image-box" data-index="${idx}" style="width: 40px; height: 40px; border-radius: 8px; border: 1px dashed ${hasImage ? 'var(--primary)' : 'var(--border-color)'}; background: ${hasImage ? `url('${row.previewUrl || row.imageUri}') center/cover no-repeat` : 'var(--surface-50)'}; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; margin: 0 auto;" title="Click to choose product image">
                            ${!hasImage ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--text-muted);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>` : ''}
                            ${hasImage ? `<button type="button" class="mi-remove-img" data-index="${idx}" style="position:absolute; top:-4px; right:-4px; width:16px; height:16px; border-radius:50%; background:#ef4444; color:white; border:none; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer;" title="Remove image">✕</button>` : ''}
                        </div>
                    </td>

                    <!-- 3. Product Name -->
                    <td style="padding: 0.35rem 0.5rem; position: relative;">
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <input type="text" class="form-control mi-input mi-input-name" data-index="${idx}" data-field="name" value="${row.name || ''}" placeholder="e.g. Mango" style="width: 100%; padding: 0.4rem 0.55rem; font-size: 0.85rem; font-weight: 600;">
                            <span class="mi-dup-badge badge" style="display: none; background: #f59e0b; color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; white-space: nowrap;"></span>
                        </div>
                    </td>

                    <!-- 4. Category -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <select class="form-control mi-input" data-index="${idx}" data-field="category" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                            ${categories.map(c => `<option value="${c.uniqueId || c.id}" ${row.category === (c.uniqueId || c.id) || row.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </td>

                    <!-- 5. Size / Weight -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="sizeWeight" value="${row.sizeWeight || ''}" placeholder="350g" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                    </td>

                    <!-- 6. Quantity -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="quantity" value="${row.quantity || 0}" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 7. Base Price -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="basePrice" value="${row.basePrice || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 8. Wholesale (Price) -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="price" value="${row.price || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 9. Sale Price -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="number" class="form-control mi-input mi-sale-price" data-index="${idx}" data-field="salePrice" value="${row.salePrice || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.85rem; font-weight: 700; text-align: right; border-color: var(--primary);">
                    </td>

                    <!-- 10. MRP -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="mrp" value="${row.mrp || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 11. UPC Code -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="upcCode" value="${row.upcCode || ''}" placeholder="Barcode" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; font-family: monospace;">
                    </td>

                    <!-- 12. Variations -->
                    <td style="padding: 0.35rem 0.5rem; text-align: center;">
                        <button type="button" class="btn btn-secondary mi-btn-vars" data-index="${idx}" style="font-size: 0.72rem; padding: 0.3rem 0.5rem; width: 100%; white-space: nowrap; ${varCount > 0 ? 'border-color: var(--primary); color: var(--primary); font-weight:700;' : ''}">
                            ${varCount > 0 ? `+ Vars (${varCount})` : '+ Vars'}
                        </button>
                    </td>

                    <!-- 13. Mfg Date -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="date" class="form-control mi-input" data-index="${idx}" data-field="mfgDate" value="${row.mfgDate || ''}" style="width: 100%; padding: 0.35rem 0.4rem; font-size: 0.75rem;">
                    </td>

                    <!-- 14. Exp Date -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="date" class="form-control mi-input" data-index="${idx}" data-field="expDate" value="${row.expDate || ''}" style="width: 100%; padding: 0.35rem 0.4rem; font-size: 0.75rem;">
                    </td>

                    <!-- 15. Note -->
                    <td style="padding: 0.35rem 0.5rem;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="note" value="${row.note || ''}" placeholder="Optional description" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                    </td>

                    <!-- 16. Actions -->
                    <td style="padding: 0.35rem 0.4rem; text-align: center;">
                        <div style="display:flex; justify-content:center; gap:0.25rem;">
                            <button type="button" class="icon-btn mi-btn-dup" data-index="${idx}" style="width:26px; height:26px; font-size:12px; border:none; background:transparent; cursor:pointer;" title="Duplicate row">📋</button>
                            <button type="button" class="icon-btn mi-btn-del" data-index="${idx}" style="width:26px; height:26px; font-size:12px; border:none; background:transparent; cursor:pointer; color:var(--danger);" title="Delete row">🗑️</button>
                        </div>
                    </td>

                </tr>
            `;
        }).join('');

        rowCounter.textContent = `${rowDataList.length} / ${MAX_ROWS}`;
        checkDuplicates();
        attachGridEvents();
    };

    // Attach Grid events
    const attachGridEvents = () => {
        // Input text/number/select changes
        tbody.querySelectorAll('.mi-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                const field = e.target.getAttribute('data-field');
                if (isNaN(idx) || !rowDataList[idx]) return;

                let val = e.target.value;
                if (['quantity', 'basePrice', 'price', 'salePrice', 'mrp'].includes(field)) {
                    val = Number(val) || 0;
                }
                rowDataList[idx][field] = val;

                if (field === 'name') {
                    checkDuplicates();
                }
            });
        });

        // Image pickers
        tbody.querySelectorAll('.mi-image-box').forEach(box => {
            box.addEventListener('click', (e) => {
                if (e.target.classList.contains('mi-remove-img')) return;
                const idx = parseInt(box.getAttribute('data-index'));
                const fileInput = tbody.querySelector(`.mi-file-input[data-index="${idx}"]`);
                if (fileInput) fileInput.click();
            });
        });

        // File input changes
        tbody.querySelectorAll('.mi-file-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                const file = e.target.files[0];
                if (file && rowDataList[idx]) {
                    rowDataList[idx].imageFile = file;
                    rowDataList[idx].previewUrl = URL.createObjectURL(file);
                    renderRows();
                }
            });
        });

        // Remove image
        tbody.querySelectorAll('.mi-remove-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList[idx]) {
                    rowDataList[idx].imageFile = null;
                    rowDataList[idx].previewUrl = '';
                    rowDataList[idx].imageUri = '';
                    renderRows();
                }
            });
        });

        // Duplicate Row
        tbody.querySelectorAll('.mi-btn-dup').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList.length >= MAX_ROWS) {
                    showAlert.error(`Maximum row limit of ${MAX_ROWS} reached.`);
                    return;
                }
                const original = rowDataList[idx];
                const clone = {
                    ...original,
                    id: 'row_' + Math.random().toString(36).substring(2, 9),
                    name: original.name ? `${original.name} (Copy)` : '',
                    variations: JSON.parse(JSON.stringify(original.variations || []))
                };
                rowDataList.splice(idx + 1, 0, clone);
                renderRows();
            });
        });

        // Delete Row
        tbody.querySelectorAll('.mi-btn-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList.length <= 1) {
                    rowDataList = [createBlankRow()];
                } else {
                    rowDataList.splice(idx, 1);
                }
                renderRows();
            });
        });

        // Variations Manager Trigger
        tbody.querySelectorAll('.mi-btn-vars').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                openVariationsEditor(idx);
            });
        });
    };

    // Helper: Add N rows
    const addRows = (count) => {
        const available = MAX_ROWS - rowDataList.length;
        if (available <= 0) {
            showAlert.error(`Maximum limit of ${MAX_ROWS} rows reached.`);
            return;
        }
        const toAdd = Math.min(count, available);
        for (let i = 0; i < toAdd; i++) {
            rowDataList.push(createBlankRow());
        }
        renderRows();
        const gridCont = container.querySelector('#mi-grid-container');
        if (gridCont) gridCont.scrollTop = gridCont.scrollHeight;
    };

    container.querySelector('#mi-btn-add-1').addEventListener('click', () => addRows(1));
    container.querySelector('#mi-btn-add-5').addEventListener('click', () => addRows(5));
    container.querySelector('#mi-btn-add-10').addEventListener('click', () => addRows(10));
    container.querySelector('#mi-btn-add-50').addEventListener('click', () => addRows(50));

    // Clear Empty Rows
    container.querySelector('#mi-btn-clear-empty').addEventListener('click', () => {
        const filtered = rowDataList.filter(r => (r.name || '').trim() !== '');
        if (filtered.length === 0) {
            rowDataList = [createBlankRow()];
        } else {
            rowDataList = filtered;
        }
        renderRows();
        showAlert.success('Empty rows cleared');
    });

    // Bulk Apply Category
    container.querySelector('#mi-btn-apply-cat').addEventListener('click', () => {
        const catSelect = container.querySelector('#mi-bulk-cat-select');
        const chosenCat = catSelect.value;
        if (!chosenCat) {
            showAlert.error('Please select a category first.');
            return;
        }
        rowDataList.forEach(r => {
            r.category = chosenCat;
        });
        renderRows();
        showAlert.success('Category applied to all rows');
    });

    // Back to Products Button
    container.querySelector('#mi-btn-cancel-to-products').addEventListener('click', () => {
        window.location.hash = '#/products';
    });

    // Variations Sub-Modal Logic
    let activeVarRowIndex = null;
    let tempVars = [];
    const varModal = container.querySelector('#mi-var-modal');
    const varListEl = container.querySelector('#mi-var-list');
    const varTargetNameEl = container.querySelector('#mi-var-target-name');

    const renderVarList = () => {
        if (tempVars.length === 0) {
            varListEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No variations configured for this row. Click below to add.</div>`;
            return;
        }
        varListEl.innerHTML = tempVars.map((v, i) => `
            <div style="display:flex; gap:0.5rem; align-items:center; background:var(--surface-50); padding:0.5rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                <div style="flex:1;">
                    <label style="font-size:0.7rem; color:var(--text-secondary); display:block; margin-bottom:0.2rem;">Size / Flavor</label>
                    <input type="text" class="form-control mi-var-name" data-vidx="${i}" value="${v.sizeFlavor || ''}" placeholder="e.g. 500g / Vanilla" style="width:100%; font-size:0.8rem; padding:0.35rem 0.5rem;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:0.7rem; color:var(--text-secondary); display:block; margin-bottom:0.2rem;">UPC / Barcode</label>
                    <input type="text" class="form-control mi-var-upc" data-vidx="${i}" value="${v.upcCode || ''}" placeholder="Barcode" style="width:100%; font-size:0.8rem; padding:0.35rem 0.5rem; font-family:monospace;">
                </div>
                <button type="button" class="icon-btn mi-var-remove" data-vidx="${i}" style="margin-top:1rem; border:none; background:transparent; cursor:pointer; color:var(--danger); width:28px; height:28px;">✕</button>
            </div>
        `).join('');

        varListEl.querySelectorAll('.mi-var-name').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const vi = parseInt(e.target.getAttribute('data-vidx'));
                if (tempVars[vi]) tempVars[vi].sizeFlavor = e.target.value;
            });
        });

        varListEl.querySelectorAll('.mi-var-upc').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const vi = parseInt(e.target.getAttribute('data-vidx'));
                if (tempVars[vi]) tempVars[vi].upcCode = e.target.value;
            });
        });

        varListEl.querySelectorAll('.mi-var-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vi = parseInt(btn.getAttribute('data-vidx'));
                tempVars.splice(vi, 1);
                renderVarList();
            });
        });
    };

    const openVariationsEditor = (rowIndex) => {
        activeVarRowIndex = rowIndex;
        const row = rowDataList[rowIndex];
        varTargetNameEl.textContent = `Row #${rowIndex + 1}: ${row.name || 'Unnamed Product'}`;
        tempVars = JSON.parse(JSON.stringify(row.variations || []));
        renderVarList();
        varModal.style.display = 'flex';
    };

    container.querySelector('#mi-var-add-row').addEventListener('click', () => {
        tempVars.push({ sizeFlavor: '', upcCode: '' });
        renderVarList();
    });

    container.querySelector('#mi-var-save').addEventListener('click', () => {
        if (activeVarRowIndex !== null && rowDataList[activeVarRowIndex]) {
            const cleaned = tempVars.filter(v => (v.sizeFlavor || '').trim() !== '' || (v.upcCode || '').trim() !== '');
            rowDataList[activeVarRowIndex].variations = cleaned;
            renderRows();
        }
        varModal.style.display = 'none';
    });

    const closeVarModal = () => { varModal.style.display = 'none'; };
    container.querySelector('#mi-var-close-x').addEventListener('click', closeVarModal);
    container.querySelector('#mi-var-cancel').addEventListener('click', closeVarModal);

    // Initial render
    renderRows();

    // 4. Submit Batch Insertion
    const btnSubmit = container.querySelector('#mi-btn-submit');
    const progressOverlay = container.querySelector('#mi-progress-overlay');
    const progressBarFill = container.querySelector('#mi-progress-bar-fill');
    const progressCount = container.querySelector('#mi-progress-count');
    const progressPercent = container.querySelector('#mi-progress-percent');
    const progressItemName = container.querySelector('#mi-progress-item-name');

    btnSubmit.addEventListener('click', async () => {
        const validProducts = rowDataList.filter(r => (r.name || '').trim() !== '');

        if (validProducts.length === 0) {
            showAlert.error('Please enter at least 1 product name before inserting.');
            return;
        }

        // Validate categories
        for (let i = 0; i < validProducts.length; i++) {
            const p = validProducts[i];
            if (!p.category) {
                if (categories.length > 0) {
                    p.category = categories[0].uniqueId || categories[0].id;
                } else {
                    showAlert.error(`Product "${p.name}" requires a category.`);
                    return;
                }
            }
        }

        // Duplicate warning confirmation
        const dupCount = validProducts.filter(p => {
            const clean = p.name.trim().toLowerCase();
            return existingProducts.some(ep => (ep.name || '').trim().toLowerCase() === clean);
        }).length;

        if (dupCount > 0) {
            const proceed = await showAlert.confirm(`${dupCount} of the products to be inserted already exist in your workspace. Do you want to continue inserting them?`);
            if (!proceed) return;
        }

        // Show progress overlay
        progressOverlay.style.display = 'flex';
        progressCount.textContent = `0 of ${validProducts.length}`;
        progressPercent.textContent = `0%`;
        progressBarFill.style.width = `0%`;

        try {
            await productService.bulkAddProducts(
                validProducts,
                currentUser.uid,
                null,
                (current, total, currentName) => {
                    const percent = Math.round((current / total) * 100);
                    progressBarFill.style.width = `${percent}%`;
                    progressPercent.textContent = `${percent}%`;
                    progressCount.textContent = `${current} of ${total}`;
                    progressItemName.textContent = currentName;
                }
            );

            showAlert.success(`Successfully inserted ${validProducts.length} products to your catalog!`);
            window.location.hash = '#/products';

        } catch (err) {
            progressOverlay.style.display = 'none';
            showAlert.error(err.message || 'Failed to complete batch insertion');
        }
    });
};

/**
 * Backward compatibility helper for modal caller -> redirects to the dedicated route
 */
export const openMarketInserterModal = (workspaceId, onDone) => {
    window.location.hash = '#/market-inserter';
};

