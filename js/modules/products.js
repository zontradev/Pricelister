import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { storageService } from '../../supabase/storage.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';

export const renderProducts = async (container, workspaceId) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    // UI Layout
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
            <div>
                <h2 style="margin:0 0 0.25rem 0;">Products</h2>
                <p style="margin:0; font-size:0.85rem; color:var(--text-secondary);">Manage your product catalog, prices, categories, and inventory</p>
            </div>
            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                <button id="btn-import-excel" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Import Excel
                </button>
                <button id="btn-export-products" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Export
                </button>
                <button id="btn-add-product" class="btn btn-primary" style="display:flex; align-items:center; gap:0.4rem; font-weight:600;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Product
                </button>
            </div>
        </div>
        
        <!-- CUSTOM CATEGORY MODAL -->
        <div id="quick-category-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
            <div class="card" style="background:white; width:100%; max-width:400px; padding:2rem; border-radius:var(--radius-md);">
                <h3 style="margin-bottom:1rem; color:var(--primary);">Create Category</h3>
                <div style="display:flex; flex-direction:column; gap:1rem;">
                    <div>
                        <label>Category Name *</label>
                        <input type="text" id="quick-cat-name" class="form-control" style="width:100%; padding:0.5rem;" placeholder="e.g. Beverages">
                    </div>
                    <div>
                        <label>Color</label>
                        <input type="color" id="quick-cat-color" value="#4a90e2" class="form-control" style="width:100%; height:40px; padding:0.25rem;">
                    </div>
                    <div style="display:flex; gap:1rem; margin-top:1rem;">
                        <button type="button" id="quick-cat-save-btn" class="btn btn-primary" style="flex:1;">Save</button>
                        <button type="button" id="quick-cat-cancel-btn" class="btn btn-secondary" style="flex:1;">Cancel</button>
                    </div>
                </div>
            </div>
        </div>

        
        <div id="product-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem;">
            <h3 id="prd-form-title">New Product</h3>
            <form id="product-form" style="display:flex; flex-direction:column; gap:1.5rem; margin-top: 1rem;">
                <input type="hidden" id="prd-id">
                
                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 1 — BASIC INFORMATION</h4>
                    
                    <div style="display:flex; gap:1rem; margin-bottom: 1rem; align-items: flex-end;">
                        <div style="flex:1;">
                            <label>Product Image (URL)</label>
                            <input type="text" id="prd-image" class="form-control" style="width:100%; padding:0.5rem;" placeholder="https://...">
                        </div>
                        <div style="flex:1; display:flex; gap:1rem; align-items:center;">
                            <span style="color:var(--text-muted); font-size:0.9rem;">OR</span>
                            <label class="btn btn-secondary" style="cursor:pointer; margin:0; padding:0.5rem 1rem;">
                                Upload from Desktop
                                <input type="file" id="prd-image-file" accept="image/*" style="display:none;">
                            </label>
                            <img id="prd-image-preview" src="" style="display:none; max-height:40px; border-radius:4px; border:1px solid var(--border-color);">
                        </div>
                    </div>

                    <div style="display:flex; gap:1rem; margin-bottom: 1rem;">
                        <div style="flex:2;">
                            <label>Product Name *</label>
                            <input type="text" id="prd-name" required class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Size / Weight</label>
                            <input type="text" id="prd-size" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>

                    <div style="display:flex; gap:1rem; margin-bottom: 1rem;">
                        <div style="flex:1; display: flex; align-items: flex-end; gap: 0.5rem;">
                            <div style="flex:1;">
                                <label>Category *</label>
                                <select id="prd-category" required class="form-control" style="width:100%; padding:0.5rem;">
                                    <option value="">Loading...</option>
                                </select>
                            </div>
                            <button type="button" id="btn-quick-cat" class="btn btn-secondary" style="padding:0.5rem 1rem;" title="Create New Category">+</button>
                        </div>
                        <div style="flex:1;">
                            <label>UPC Code</label>
                            <input type="text" id="prd-upc" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Note</label>
                            <input type="text" id="prd-note" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 2 — INVENTORY</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1; max-width: 200px;">
                            <label>Stock / Qty *</label>
                            <input type="number" id="prd-qty" value="0" min="0" required class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 3 — PRICING</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Cost Price</label>
                            <input type="number" id="prd-cost-price" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Sale Price *</label>
                            <input type="number" id="prd-sale-price" step="0.01" min="0" required class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Base Price</label>
                            <input type="number" id="prd-base-price" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>MRP</label>
                            <input type="number" id="prd-mrp" step="0.01" min="0" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 4 — DATES</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:1;">
                            <label>Manufacturing Date</label>
                            <input type="date" id="prd-mfg-date" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Expiration Date</label>
                            <input type="date" id="prd-exp-date" class="form-control" style="width:100%; padding:0.5rem;">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
                        <h4 style="margin:0;">SECTION 5 — VARIATIONS (SIZE/FLAVOR & UPC)</h4>
                        <button type="button" id="btn-add-variation-row" class="btn btn-secondary" style="font-size:0.8rem; padding:0.35rem 0.75rem; display:flex; align-items:center; gap:4px; font-weight:600;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            + Add Variation
                        </button>
                    </div>
                    <div id="prd-variations-list" style="display:flex; flex-direction:column; gap:0.6rem;">
                        <!-- Dynamic variation rows inserted here -->
                    </div>
                    <div id="prd-no-variations-msg" style="color:var(--text-muted); font-size:0.85rem; font-style:italic; padding:0.5rem 0;">
                        No variations added. Click "+ Add Variation" to create size/flavor and UPC code options.
                    </div>
                </div>

                <div style="display:flex; gap:1rem; margin-top:1rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <button type="submit" class="btn btn-primary" id="prd-submit-btn">Save Product</button>
                    <button type="button" class="btn btn-secondary" id="prd-cancel-btn">Cancel</button>
                </div>
            </form>
        </div>
        
        <div id="product-list-container">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; padding: 1rem; background: var(--surface-50); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <div style="display:flex; gap: 1rem; flex: 1;">
                    <select id="filter-sort" class="form-control" style="padding: 0.5rem; max-width: 250px;">
                        <option value="recent_created">Recently Created (Default)</option>
                        <option value="recent_updated">Recently Updated</option>
                        <option value="expire">Close to Expire</option>
                        <option value="az">A-Z</option>
                        <option value="oldest">Oldest</option>
                        <option value="low_qty">Low Quantity</option>
                        <option value="high_price">Highest Price</option>
                    </select>
                    <select id="filter-category" class="form-control" style="padding: 0.5rem; max-width: 250px;">
                        <option value="all">All Categories</option>
                    </select>
                </div>
                <div style="font-weight: 600; color: var(--text-muted);" id="product-count">0 Products</div>
            </div>

            <div class="table-container">
                <table style="width:100%; border-collapse: collapse; text-align:left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                            <th style="padding:1rem; width: 60px;">Image</th>
                            <th style="padding:1rem;">Name</th>
                            <th style="padding:1rem;">Category</th>
                            <th style="padding:1rem;">Price</th>
                            <th style="padding:1rem;">Stock</th>
                            <th style="padding:1rem;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="product-list-body">
                        ${Array(5).fill(0).map(() => `
                            <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 40px; height: 40px; border-radius: 6px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 140px; height: 18px;"></div><div class="skeleton-shimmer" style="width: 80px; height: 12px; margin-top: 4px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 90px; height: 22px; border-radius: 12px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 60px; height: 18px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 50px; height: 18px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 70px; height: 28px; border-radius: 4px;"></div></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const formContainer = container.querySelector('#product-form-container');
    const form = container.querySelector('#product-form');
    const tbody = container.querySelector('#product-list-body');
    const catSelect = container.querySelector('#prd-category');
    
    // Attach filter event listeners
    container.querySelector('#filter-sort').addEventListener('change', () => renderProductList());
    container.querySelector('#filter-category').addEventListener('change', () => renderProductList());
    
    let categoriesList = [];
    let activeProducts = [];

    const renderProductList = () => {
        const sortVal = container.querySelector('#filter-sort').value;
        const catVal = container.querySelector('#filter-category').value;
        
        let filtered = activeProducts.slice();

        if (catVal !== 'all') {
            filtered = filtered.filter(p => {
                const uId = categoriesList.find(c => c.uniqueId === p.category || c.id === p.category || c.name === p.category)?.uniqueId || p.category;
                return uId === catVal || p.category === catVal;
            });
        }

        filtered.sort((a, b) => {
            switch(sortVal) {
                case 'recent_created':
                    return (b.timestamp || 0) - (a.timestamp || 0);
                case 'recent_updated':
                    return (b.updatedTimestamp || b.timestamp || 0) - (a.updatedTimestamp || a.timestamp || 0);
                case 'expire':
                    const dA = a.expDate ? new Date(a.expDate).getTime() : Infinity;
                    const dB = b.expDate ? new Date(b.expDate).getTime() : Infinity;
                    return dA - dB;
                case 'az':
                    return (a.name || '').localeCompare(b.name || '');
                case 'oldest':
                    return (a.timestamp || 0) - (b.timestamp || 0);
                case 'low_qty':
                    return (a.quantity || 0) - (b.quantity || 0);
                case 'high_price':
                    return (b.salePrice || 0) - (a.salePrice || 0);
                default:
                    return (b.timestamp || 0) - (a.timestamp || 0);
            }
        });

        container.querySelector('#product-count').textContent = `${filtered.length} Products`;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:1rem; text-align:center; color: var(--text-muted);">No products found.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = filtered.map(prd => {
            const catName = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category)?.name || prd.category || 'Unknown';
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:1rem;">
                        ${prd.imageUri 
                            ? `<img src="${prd.imageUri}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 8px;">` 
                            : `<div style="width: 48px; height: 48px; background: var(--surface-200); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.7rem;">None</div>`}
                    </td>
                    <td style="padding:1rem;">
                        <strong>${prd.name}</strong><br>
                        <small style="color:var(--text-muted)">${prd.sizeWeight ? prd.sizeWeight : ''} ${prd.upcCode ? ' | UPC: ' + prd.upcCode : ''}</small>
                    </td>
                    <td style="padding:1rem;"><span class="badge">${catName}</span></td>
                    <td style="padding:1rem;">$${Number(prd.salePrice).toFixed(2)}</td>
                    <td style="padding:1rem;">${prd.quantity}</td>
                    <td style="padding:1rem;">
                        <button class="btn btn-sm btn-secondary edit-prd" data-id="${prd.id}">Edit</button>
                        <button class="btn btn-sm btn-secondary dup-prd" data-id="${prd.id}">Duplicate</button>
                        <button class="btn btn-sm btn-outline del-prd" data-id="${prd.id}" style="color:var(--danger);">Delete</button>
                    </td>
                </tr>
            `}).join('');
            
        attachListEvents();
    };

    const loadData = async () => {
        try {
            // Load categories for mapping and dropdown
            categoriesList = await categoryService.getAllCategories();
            catSelect.innerHTML = '<option value="">Select Category</option>' + 
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
                
            container.querySelector('#filter-category').innerHTML = '<option value="all">All Categories</option>' + 
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');

            // Load products
            activeProducts = await productService.getAllActiveProducts();
            
            renderProductList();
            
        } catch (error) {
            showAlert.error('Failed to load products');
        }
    };

    const attachListEvents = () => {
        // Edit
        container.querySelectorAll('.edit-prd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd) {
                    container.querySelector('#prd-id').value = prd.id;
                    container.querySelector('#prd-image').value = prd.imageUri || '';
                    const preview = container.querySelector('#prd-image-preview');
                    if (prd.imageUri) {
                        preview.src = prd.imageUri;
                        preview.style.display = 'block';
                    } else {
                        preview.style.display = 'none';
                    }
                    
                    container.querySelector('#prd-name').value = prd.name || '';
                    container.querySelector('#prd-size').value = prd.sizeWeight || '';
                    const matchedCat = categoriesList.find(c => c.uniqueId === prd.category || c.id === prd.category || c.name === prd.category);
                    container.querySelector('#prd-category').value = matchedCat ? (matchedCat.uniqueId || matchedCat.id) : (prd.category || '');
                    container.querySelector('#prd-upc').value = prd.upcCode || '';
                    container.querySelector('#prd-note').value = prd.note || '';
                    
                    container.querySelector('#prd-qty').value = prd.quantity || 0;
                    
                    container.querySelector('#prd-cost-price').value = prd.price || '';
                    container.querySelector('#prd-sale-price').value = prd.salePrice || '';
                    container.querySelector('#prd-base-price').value = prd.basePrice || '';
                    container.querySelector('#prd-mrp').value = prd.mrp || '';
                    
                    container.querySelector('#prd-mfg-date').value = prd.mfgDate || '';
                    container.querySelector('#prd-exp-date').value = prd.expDate || '';
                    
                    // Populate Variations
                    clearVariations();
                    if (Array.isArray(prd.variations)) {
                        prd.variations.forEach(v => {
                            if (v && (v.sizeFlavor || v.upcCode)) {
                                addVariationRow(v.sizeFlavor || '', v.upcCode || '');
                            }
                        });
                    } else if (typeof prd.variations === 'string' && prd.variations.trim().startsWith('[')) {
                        try {
                            const parsed = JSON.parse(prd.variations);
                            if (Array.isArray(parsed)) {
                                parsed.forEach(v => addVariationRow(v.sizeFlavor || '', v.upcCode || ''));
                            }
                        } catch(e) {}
                    }
                    
                    container.querySelector('#prd-form-title').textContent = 'Edit Product';
                    formContainer.style.display = 'block';
                    container.querySelector('#product-list-container').style.display = 'none';
                    formContainer.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        // Duplicate
        container.querySelectorAll('.dup-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd && await showAlert.confirm(`Duplicate ${prd.name}?`)) {
                    try {
                        await productService.duplicateProduct(prd, currentUser.uid);
                        showAlert.success('Product duplicated');
                        loadData();
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });

        // Delete Product
        container.querySelectorAll('.del-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const prd = activeProducts.find(p => p.id === id);
                if (prd && await showAlert.confirm(`Delete product "${prd.name}" permanently?`)) {
                    try {
                        await productService.deleteProduct(id);
                        showAlert.success('Product deleted successfully');
                        loadData();
                    } catch (err) {
                        showAlert.error(err.message || 'Failed to delete product');
                    }
                }
            });
        });
    };

    // Variations Dynamic Row Helper
    const varListEl = container.querySelector('#prd-variations-list');
    const varEmptyMsg = container.querySelector('#prd-no-variations-msg');
    const btnAddVar = container.querySelector('#btn-add-variation-row');

    const checkVariationsEmpty = () => {
        if (!varListEl || !varEmptyMsg) return;
        if (varListEl.children.length === 0) {
            varEmptyMsg.style.display = 'block';
        } else {
            varEmptyMsg.style.display = 'none';
        }
    };

    const clearVariations = () => {
        if (varListEl) varListEl.innerHTML = '';
        checkVariationsEmpty();
    };

    const addVariationRow = (sizeFlavor = '', upcCode = '') => {
        if (!varListEl) return;
        const row = document.createElement('div');
        row.className = 'prd-variation-item-row';
        row.style.cssText = 'display:flex; gap:0.75rem; align-items:center; background:var(--surface-50); padding:0.6rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);';
        row.innerHTML = `
            <div style="flex:2;">
                <input type="text" class="form-control var-size-input" placeholder="Size / Flavor / Variant (e.g. 500g, Strawberry)" value="${sizeFlavor || ''}" style="width:100%; padding:0.45rem; font-size:0.85rem;">
            </div>
            <div style="flex:2;">
                <input type="text" class="form-control var-upc-input" placeholder="UPC / Barcode (Optional)" value="${upcCode || ''}" style="width:100%; padding:0.45rem; font-size:0.85rem;">
            </div>
            <button type="button" class="btn-remove-var" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:4px 8px; font-size:1.3rem; line-height:1;" title="Remove variation">&times;</button>
        `;

        row.querySelector('.btn-remove-var').addEventListener('click', () => {
            row.remove();
            checkVariationsEmpty();
        });

        varListEl.appendChild(row);
        checkVariationsEmpty();
    };

    if (btnAddVar) {
        btnAddVar.addEventListener('click', () => {
            addVariationRow('', '');
        });
    }

    // UI Toggles
    container.querySelector('#btn-add-product').addEventListener('click', () => {
        form.reset();
        clearVariations();
        container.querySelector('#prd-id').value = '';
        container.querySelector('#prd-image-preview').style.display = 'none';
        container.querySelector('#prd-form-title').textContent = 'New Product';
        formContainer.style.display = 'block';
        container.querySelector('#product-list-container').style.display = 'none';
    });
    
    // Image Upload Handler
    container.querySelector('#prd-image-file').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const btnLabel = e.target.parentElement;
                const originalText = btnLabel.textContent;
                btnLabel.textContent = 'Uploading...';
                
                const url = await storageService.uploadImage(file);
                
                container.querySelector('#prd-image').value = url;
                const preview = container.querySelector('#prd-image-preview');
                preview.src = url;
                preview.style.display = 'block';
                
                btnLabel.innerHTML = 'Upload from Desktop<input type="file" id="prd-image-file" accept="image/*" style="display:none;">';
                // reattach listener since we rewrote innerHTML
                container.querySelector('#prd-image-file').addEventListener('change', arguments.callee);
                
            } catch (error) {
                showAlert.error('Image upload failed');
            }
        }
    });

    // Image URL Preview update
    container.querySelector('#prd-image').addEventListener('input', (e) => {
        const preview = container.querySelector('#prd-image-preview');
        if (e.target.value) {
            preview.src = e.target.value;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    });
    
    // Quick Add Category Modal Logic
    const catModal = container.querySelector('#quick-category-modal');
    const catNameInput = container.querySelector('#quick-cat-name');
    const catColorInput = container.querySelector('#quick-cat-color');
    const btnQuickCat = container.querySelector('#btn-quick-cat');
    const btnSaveCat = container.querySelector('#quick-cat-save-btn');
    const btnCancelCat = container.querySelector('#quick-cat-cancel-btn');

    btnQuickCat.addEventListener('click', () => {
        catNameInput.value = '';
        catColorInput.value = '#4a90e2';
        catModal.style.display = 'flex';
        catNameInput.focus();
    });

    btnCancelCat.addEventListener('click', () => {
        catModal.style.display = 'none';
    });

    btnSaveCat.addEventListener('click', async () => {
        const catName = catNameInput.value;
        const catColor = catColorInput.value;
        
        if (!catName || catName.trim() === '') {
            showAlert.error("Category name is required.");
            return;
        }

        btnSaveCat.disabled = true;
        btnSaveCat.textContent = 'Saving...';

        try {
            // The service will automatically validate duplicate names (case-insensitive) and generate uniqueId
            await categoryService.addCategory({ name: catName.trim(), color: catColor }, currentUser.uid);
            showAlert.success("Category added!");
            
            // Reload categories to update dropdown
            categoriesList = await categoryService.getAllCategories();
            catSelect.innerHTML = '<option value="">Select Category</option>' + 
                categoriesList.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('');
            
            // Auto-select the newly created category (case-insensitive find)
            const newCat = categoriesList.find(c => c.name.toLowerCase() === catName.trim().toLowerCase());
            if (newCat) catSelect.value = newCat.uniqueId || newCat.id;
            
            catModal.style.display = 'none';
        } catch (err) {
            showAlert.error(err.message);
        } finally {
            btnSaveCat.disabled = false;
            btnSaveCat.textContent = 'Save';
        }
    });

    container.querySelector('#prd-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
        container.querySelector('#product-list-container').style.display = 'block';
        form.reset();
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#prd-submit-btn');
        btn.disabled = true;
        
        const id = container.querySelector('#prd-id').value;

        // Collect dynamic variation items
        const collectedVariations = [];
        container.querySelectorAll('.prd-variation-item-row').forEach(row => {
            const size = row.querySelector('.var-size-input')?.value.trim() || '';
            const upc = row.querySelector('.var-upc-input')?.value.trim() || '';
            if (size || upc) {
                collectedVariations.push({ sizeFlavor: size, upcCode: upc });
            }
        });

        const data = {
            imageUri: container.querySelector('#prd-image').value,
            name: container.querySelector('#prd-name').value.trim(),
            sizeWeight: container.querySelector('#prd-size').value.trim(),
            category: container.querySelector('#prd-category').value,
            upcCode: container.querySelector('#prd-upc').value.trim(),
            note: container.querySelector('#prd-note').value.trim(),
            
            quantity: parseInt(container.querySelector('#prd-qty').value || 0, 10),
            
            price: container.querySelector('#prd-cost-price').value ? parseFloat(container.querySelector('#prd-cost-price').value) : 0,
            salePrice: parseFloat(container.querySelector('#prd-sale-price').value),
            basePrice: container.querySelector('#prd-base-price').value ? parseFloat(container.querySelector('#prd-base-price').value) : 0,
            mrp: container.querySelector('#prd-mrp').value ? parseFloat(container.querySelector('#prd-mrp').value) : 0,
            
            mfgDate: container.querySelector('#prd-mfg-date').value,
            expDate: container.querySelector('#prd-exp-date').value,
            
            variations: collectedVariations
        };
        
        try {
            if (id) {
                // IMPORTANT: When editing, load existing product, do NOT create new ID. Keep original ID.
                await productService.updateProduct(id, data);
                showAlert.success('Product updated');
            } else {
                await productService.addProduct(data, currentUser.uid);
                showAlert.success('Product added');
            }
            formContainer.style.display = 'none';
            container.querySelector('#product-list-container').style.display = 'block';
            loadData();
        } catch (error) {
            showAlert.error(error.message);
        } finally {
            btn.disabled = false;
        }
    });

    // Import Excel & Export Click Handlers
    const btnImport = container.querySelector('#btn-import-excel');
    if (btnImport) {
        btnImport.addEventListener('click', () => {
            openExcelImportModal(workspaceId, () => {
                loadData();
            });
        });
    }

    const btnExport = container.querySelector('#btn-export-products');
    if (btnExport) {
        btnExport.addEventListener('click', async () => {
            const [pList, cList] = await Promise.all([
                productService.getAllActiveProducts().catch(() => []),
                categoryService.getAllCategories().catch(() => [])
            ]);
            openExportModal(workspaceId, { products: pList, categories: cList });
        });
    }

    loadData();
};

