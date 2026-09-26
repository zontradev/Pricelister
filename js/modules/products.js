import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { storageService } from '../../supabase/storage.js';

export const renderProducts = async (container, workspaceId) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    // UI Layout
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>Products</h2>
            <button id="btn-add-product" class="btn btn-primary">Add Product</button>
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
                    <h4 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">SECTION 5 — VARIATIONS</h4>
                    <div style="display:flex; gap:1rem;">
                        <div style="flex:2;">
                            <label>Variations (e.g. Size, Flavor, UPC)</label>
                            <input type="text" id="prd-variations" class="form-control" placeholder="e.g. Red, Blue, Green" style="width:100%; padding:0.5rem;">
                        </div>
                        <div style="flex:1;">
                            <label>Color</label>
                            <input type="color" id="prd-color" class="form-control" style="height:38px;">
                        </div>
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
                        <tr><td colspan="6" style="padding:1rem; text-align:center;">Loading...</td></tr>
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
            filtered = filtered.filter(p => p.category === catVal);
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
            const catName = categoriesList.find(c => c.id === prd.category)?.name || 'Unknown';
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
                        <button class="btn btn-sm btn-outline arch-prd" data-id="${prd.id}">Archive</button>
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
                categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                
            container.querySelector('#filter-category').innerHTML = '<option value="all">All Categories</option>' + 
                categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

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
                    container.querySelector('#prd-category').value = prd.category || '';
                    container.querySelector('#prd-upc').value = prd.upcCode || '';
                    container.querySelector('#prd-note').value = prd.note || '';
                    
                    container.querySelector('#prd-qty').value = prd.quantity || 0;
                    
                    container.querySelector('#prd-cost-price').value = prd.price || '';
                    container.querySelector('#prd-sale-price').value = prd.salePrice || '';
                    container.querySelector('#prd-base-price').value = prd.basePrice || '';
                    container.querySelector('#prd-mrp').value = prd.mrp || '';
                    
                    container.querySelector('#prd-mfg-date').value = prd.mfgDate || '';
                    container.querySelector('#prd-exp-date').value = prd.expDate || '';
                    
                    // Variations is an object/array in backend, we'll stringify for simple text input for now
                    let varStr = '';
                    if (prd.variations) {
                        varStr = typeof prd.variations === 'string' ? prd.variations : JSON.stringify(prd.variations);
                    }
                    container.querySelector('#prd-variations').value = varStr;
                    container.querySelector('#prd-color').value = prd.color || '#000000';
                    
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

        // Archive
        container.querySelectorAll('.arch-prd').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (await showAlert.confirm('Archive this product? It will not appear in the active list but remains available for existing invoices.')) {
                    try {
                        await productService.archiveProduct(id);
                        showAlert.success('Product archived');
                        loadData();
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });
    };

    // UI Toggles
    container.querySelector('#btn-add-product').addEventListener('click', () => {
        form.reset();
        container.querySelector('#prd-id').value = '';
        container.querySelector('#prd-color').value = '#000000';
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
                categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            // Auto-select the newly created category (case-insensitive find)
            const newCat = categoriesList.find(c => c.name.toLowerCase() === catName.trim().toLowerCase());
            if (newCat) catSelect.value = newCat.id;
            
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
        const data = {
            imageUri: container.querySelector('#prd-image').value,
            name: container.querySelector('#prd-name').value,
            sizeWeight: container.querySelector('#prd-size').value,
            category: container.querySelector('#prd-category').value,
            upcCode: container.querySelector('#prd-upc').value,
            note: container.querySelector('#prd-note').value,
            
            quantity: parseInt(container.querySelector('#prd-qty').value || 0, 10),
            
            price: container.querySelector('#prd-cost-price').value ? parseFloat(container.querySelector('#prd-cost-price').value) : 0,
            salePrice: parseFloat(container.querySelector('#prd-sale-price').value),
            basePrice: container.querySelector('#prd-base-price').value ? parseFloat(container.querySelector('#prd-base-price').value) : 0,
            mrp: container.querySelector('#prd-mrp').value ? parseFloat(container.querySelector('#prd-mrp').value) : 0,
            
            mfgDate: container.querySelector('#prd-mfg-date').value,
            expDate: container.querySelector('#prd-exp-date').value,
            
            variations: container.querySelector('#prd-variations').value,
            color: container.querySelector('#prd-color').value
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

    loadData();
};

