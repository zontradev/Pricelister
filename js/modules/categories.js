import { getCategoryService } from '../services/categoryService.js';
import { getProductService } from '../services/productService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';

export const renderCategories = async (container, workspaceId) => {
    const categoryService = getCategoryService(workspaceId);
    const productService = getProductService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    let allCategories = [];
    let allProducts = [];
    let searchQuery = '';
    let sortMode = 'NEWEST'; // Default: Recently Created

    // UI Layout
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; flex-wrap:wrap; gap:1rem;">
            <div>
                <h2 style="margin:0 0 0.35rem 0;">Categories</h2>
                <div style="font-size:0.9rem; color:var(--text-secondary);" id="cat-count-badge">Loading categories...</div>
            </div>
            <button id="btn-add-category" class="btn btn-primary" style="display:inline-flex; align-items:center; gap:6px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
                + Add Category
            </button>
        </div>
        
        <!-- Category Create / Edit Card -->
        <div id="category-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.75rem; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem; margin-bottom:1.25rem;">
                <h3 id="cat-form-title" style="margin:0; font-size:1.25rem; color:var(--text-primary);">New Category</h3>
                <button type="button" id="btn-close-cat-form" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">&times;</button>
            </div>
            <form id="category-form" style="display:flex; flex-direction:column; gap:1.25rem;">
                <input type="hidden" id="cat-id">
                <input type="hidden" id="cat-unique-id">
                <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
                    <div style="flex:2; min-width:220px;">
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Category Name <span style="color:var(--danger);">*</span></label>
                        <input type="text" id="cat-name" required placeholder="e.g. Baby Diapers, Skin Care..." class="form-control" style="width:100%; padding:0.55rem;">
                    </div>
                    <div style="flex:1; min-width:130px;">
                        <label style="font-weight:600; font-size:0.85rem; margin-bottom:0.35rem; display:block;">Accent Color</label>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <input type="color" id="cat-color" value="#4a90e2" class="form-control" style="height:38px; width:48px; padding:0.15rem; cursor:pointer;">
                            <span id="color-hex-label" style="font-size:0.85rem; font-family:monospace; color:var(--text-secondary);">#4a90e2</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:0.75rem; justify-content:flex-end; border-top:1px solid var(--border-color); padding-top:1rem;">
                    <button type="button" class="btn btn-secondary" id="cat-cancel-btn">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="cat-submit-btn">Save Category</button>
                </div>
            </form>
        </div>

        <!-- Filter & Search Bar -->
        <div class="filter-toolbar" style="margin-bottom:1.5rem;">
            <div class="filter-group-left" style="display:flex; align-items:center; gap:0.75rem;">
                <select id="cat-sort-by" class="form-control" style="width: auto; padding: 0.4rem 0.85rem; border-radius: var(--radius-pill); font-size: 0.82rem; height: 38px;">
                    <option value="NEWEST" selected>Recently Created (Newest)</option>
                    <option value="OLDEST">Oldest First</option>
                    <option value="AZ">Alphabetical (A - Z)</option>
                    <option value="ZA">Alphabetical (Z - A)</option>
                </select>
            </div>
            <div class="filter-group-right">
                <div class="search-input-wrap">
                    <span class="search-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                    <input type="text" id="cat-search-input" placeholder="Search categories by name or ID...">
                </div>
            </div>
        </div>
        
        <div class="card" style="padding:0; overflow:hidden; border-radius:var(--radius-card); box-shadow:var(--shadow-float);">
            <div class="table-container">
                <table style="width:100%; border-collapse: collapse; text-align:left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted); background: rgba(248, 250, 252, 0.7);">
                            <th style="padding:1rem 1.25rem;">Color</th>
                            <th style="padding:1rem;">Category Name</th>
                            <th style="padding:1rem;">Products</th>
                            <th style="padding:1rem;">Created</th>
                            <th style="padding:1rem 1.25rem;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="category-list-body">
                        ${Array(5).fill(0).map(() => `
                            <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 24px; height: 24px; border-radius: 50%;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 150px; height: 18px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 80px; height: 22px; border-radius: 12px;"></div></td>
                                <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 90px; height: 16px;"></div></td>
                                <td style="padding:1rem 1.25rem;"><div class="skeleton-shimmer" style="width: 70px; height: 28px; border-radius: 4px;"></div></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const formContainer = container.querySelector('#category-form-container');
    const form = container.querySelector('#category-form');
    const tbody = container.querySelector('#category-list-body');
    const colorInput = container.querySelector('#cat-color');
    const colorHexLabel = container.querySelector('#color-hex-label');
    const countBadge = container.querySelector('#cat-count-badge');
    const searchInput = container.querySelector('#cat-search-input');
    const sortSelect = container.querySelector('#cat-sort-by');
    
    let unsubscribe = null;

    if (colorInput && colorHexLabel) {
        colorInput.addEventListener('input', (e) => {
            colorHexLabel.textContent = e.target.value;
        });
    }

    const renderList = () => {
        let filtered = allCategories.slice();

        // Filter by search query
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(c => {
                const name = (c.name || '').toLowerCase();
                const uId = (c.uniqueId || c.id || '').toLowerCase();
                return name.includes(q) || uId.includes(q);
            });
        }

        // Sort: Recently Created first by default
        filtered.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            if (sortMode === 'NEWEST') return timeB - timeA;
            if (sortMode === 'OLDEST') return timeA - timeB;
            if (sortMode === 'AZ') return (a.name || '').localeCompare(b.name || '');
            if (sortMode === 'ZA') return (b.name || '').localeCompare(a.name || '');
            return timeB - timeA;
        });

        if (countBadge) {
            countBadge.textContent = `${allCategories.length} total categories ${searchQuery ? `(${filtered.length} matching)` : ''}`;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="padding: 3rem 1rem; text-align: center;">
                        <div style="color: var(--text-muted); opacity: 0.35; margin-bottom: 0.5rem;">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">No categories found</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Try clearing your search or add a new category.</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filtered.map(cat => {
            // Count products in this category
            const uId = cat.uniqueId || cat.id;
            const catName = (cat.name || '').trim().toLowerCase();
            const prodCount = allProducts.filter(p => 
                !p.isArchive && (
                    p.category === uId || 
                    p.category === cat.id || 
                    (p.category && p.category.trim().toLowerCase() === catName) ||
                    (p.categoryName && p.categoryName.trim().toLowerCase() === catName)
                )
            ).length;
            const createdStr = cat.timestamp ? new Date(cat.timestamp).toLocaleDateString() : '-';

            return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                    <td style="padding:1rem 1.25rem;">
                        <div style="width:28px; height:28px; border-radius:6px; background-color: ${cat.color || '#4a90e2'}; border:1px solid rgba(0,0,0,0.1); box-shadow:0 1px 3px rgba(0,0,0,0.08);"></div>
                    </td>
                    <td style="padding:1rem;">
                        <strong style="font-size:0.95rem; color:var(--text-primary);">${cat.name}</strong><br>
                        <small class="text-muted" style="font-family:monospace; font-size:0.75rem;">${cat.uniqueId || cat.id}</small>
                    </td>
                    <td style="padding:1rem;">
                        <span class="badge" style="background:rgba(74,144,226,0.12); color:#2563eb; font-weight:600; font-size:0.8rem;">
                            ${prodCount} ${prodCount === 1 ? 'Product' : 'Products'}
                        </span>
                    </td>
                    <td style="padding:1rem; color:var(--text-secondary); font-size:0.88rem;">${createdStr}</td>
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn btn-sm btn-secondary edit-cat" data-id="${cat.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem;">Edit</button>
                            <button class="btn btn-sm btn-outline del-cat" data-id="${cat.id}" style="padding:0.25rem 0.65rem; font-size:0.8rem; color:var(--danger);">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners
        container.querySelectorAll('.edit-cat').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const cat = allCategories.find(c => c.id === id);
                if (cat) {
                    container.querySelector('#cat-id').value = cat.id;
                    container.querySelector('#cat-unique-id').value = cat.uniqueId || '';
                    container.querySelector('#cat-name').value = cat.name || '';
                    container.querySelector('#cat-color').value = cat.color || '#4a90e2';
                    if (colorHexLabel) colorHexLabel.textContent = cat.color || '#4a90e2';
                    container.querySelector('#cat-form-title').textContent = 'Edit Category';
                    formContainer.style.display = 'block';
                    formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        container.querySelectorAll('.del-cat').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const cat = allCategories.find(c => c.id === id);
                const uId = cat?.uniqueId || id;
                const catName = (cat?.name || '').trim().toLowerCase();
                const connectedProds = allProducts.filter(p => 
                    !p.isArchive && (
                        p.category === uId || 
                        p.category === id || 
                        (p.category && p.category.trim().toLowerCase() === catName) ||
                        (p.categoryName && p.categoryName.trim().toLowerCase() === catName)
                    )
                );

                if (connectedProds.length > 0) {
                    showAlert.error(`Can't Delete category. The Category is used by ${connectedProds.length} product${connectedProds.length > 1 ? 's' : ''}. You have to Delete those products or rename this category.`);
                    return;
                }

                if (await showAlert.confirm(`Delete category "${cat?.name || 'this category'}" permanently?`)) {
                    try {
                        await categoryService.deleteCategory(id);
                        showAlert.success('Category deleted successfully');
                    } catch (err) {
                        showAlert.error(err.message || 'Failed to delete category');
                    }
                }
            });
        });
    };

    // Load and listen to categories
    const loadCategories = async () => {
        try {
            // Load products once in parallel to calculate category item counts
            allProducts = await productService.getAllActiveProducts().catch(() => []);
        } catch(e) {
            console.warn("Could not load products for category counts:", e);
        }

        try {
            if (unsubscribe) {
                unsubscribe();
            }
            unsubscribe = categoryService.listenCategories((categories) => {
                allCategories = categories;
                renderList();
            });
        } catch (error) {
            showAlert.error('Failed to load categories');
        }
    };

    // Search and Sort Event Listeners
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderList();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortMode = e.target.value;
            renderList();
        });
    }

    // UI Toggles
    container.querySelector('#btn-add-category').addEventListener('click', () => {
        form.reset();
        container.querySelector('#cat-id').value = '';
        container.querySelector('#cat-unique-id').value = '';
        container.querySelector('#cat-color').value = '#4a90e2';
        if (colorHexLabel) colorHexLabel.textContent = '#4a90e2';
        container.querySelector('#cat-form-title').textContent = 'New Category';
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    container.querySelector('#cat-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
        form.reset();
    });

    container.querySelector('#btn-close-cat-form')?.addEventListener('click', () => {
        formContainer.style.display = 'none';
        form.reset();
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#cat-submit-btn');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        const id = container.querySelector('#cat-id').value;
        const data = {
            name: container.querySelector('#cat-name').value.trim(),
            color: container.querySelector('#cat-color').value,
            uniqueId: container.querySelector('#cat-unique-id').value || undefined
        };
        
        try {
            if (!data.name) throw new Error("Category Name is required.");

            if (id) {
                await categoryService.updateCategory(id, data);
                showAlert.success('Category updated successfully');
            } else {
                await categoryService.addCategory(data, currentUser?.uid);
                showAlert.success('Category added successfully');
            }
            formContainer.style.display = 'none';
            form.reset();
        } catch (error) {
            showAlert.error(error.message || 'Failed to save category');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save Category';
        }
    });

    loadCategories();
};
