import { getCategoryService } from '../services/categoryService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';

export const renderCategories = async (container, workspaceId) => {
    const categoryService = getCategoryService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    // UI Layout
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>Categories</h2>
            <button id="btn-add-category" class="btn btn-primary">Add Category</button>
        </div>
        
        <div id="category-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem;">
            <h3 id="cat-form-title">New Category</h3>
            <form id="category-form" style="display:flex; gap:1rem; align-items:flex-end;">
                <input type="hidden" id="cat-id">
                <input type="hidden" id="cat-unique-id">
                <div style="flex:1;">
                    <label>Category Name</label>
                    <input type="text" id="cat-name" required placeholder="e.g. Baby Diapers" class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                <div>
                    <label>Color</label>
                    <input type="color" id="cat-color" value="#4a90e2" class="form-control" style="height:38px;">
                </div>
                <button type="submit" class="btn btn-primary" id="cat-submit-btn">Save</button>
                <button type="button" class="btn btn-secondary" id="cat-cancel-btn">Cancel</button>
            </form>
        </div>
        
        <div class="table-container">
            <table style="width:100%; border-collapse: collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                        <th style="padding:1rem;">Color</th>
                        <th style="padding:1rem;">Name</th>
                        <th style="padding:1rem;">Actions</th>
                    </tr>
                </thead>
                <tbody id="category-list-body">
                    <tr><td colspan="3" style="padding:1rem; text-align:center;">Loading...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    const formContainer = document.getElementById('category-form-container');
    const form = document.getElementById('category-form');
    const tbody = document.getElementById('category-list-body');
    
    let unsubscribe = null;
    
    // Load and render
    const loadCategories = () => {
        try {
            unsubscribe = categoryService.listenCategories((categories) => {
                if (categories.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="3" style="padding:1rem; text-align:center; color: var(--text-muted);">No categories found.</td></tr>`;
                    return;
                }
                
                tbody.innerHTML = categories.map(cat => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:1rem;">
                        <div style="width:24px; height:24px; border-radius:4px; background-color: ${cat.color || '#ccc'}"></div>
                    </td>
                    <td style="padding:1rem;"><strong>${cat.name}</strong></td>
                    <td style="padding:1rem;">
                        <button class="btn btn-sm btn-secondary edit-cat" data-id="${cat.id}">Edit</button>
                        <button class="btn btn-sm btn-outline del-cat" data-id="${cat.id}">Delete</button>
                    </td>
                </tr>
            `).join('');
            
            // Attach event listeners
            document.querySelectorAll('.edit-cat').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const cat = categories.find(c => c.id === id);
                    if (cat) {
                        document.getElementById('cat-id').value = cat.id;
                        document.getElementById('cat-unique-id').value = cat.uniqueId;
                        document.getElementById('cat-name').value = cat.name;
                        document.getElementById('cat-color').value = cat.color;
                        document.getElementById('cat-form-title').textContent = 'Edit Category';
                        formContainer.style.display = 'block';
                    }
                });
            });
            
            document.querySelectorAll('.del-cat').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (await showAlert.confirm('Delete this category?')) {
                        const id = e.target.getAttribute('data-id');
                        try {
                            await categoryService.deleteCategory(id);
                            showAlert.success('Deleted');
                            // UI updates automatically via listener
                        } catch (err) {
                            showAlert.error(err.message);
                        }
                    }
                });
            });
            
        }); // Close listenCategories callback
        } catch (error) {
            showAlert.error('Failed to load categories');
        }
    };
    
    // UI Toggles
    document.getElementById('btn-add-category').addEventListener('click', () => {
        form.reset();
        document.getElementById('cat-id').value = '';
        document.getElementById('cat-form-title').textContent = 'New Category';
        formContainer.style.display = 'block';
    });

    document.getElementById('cat-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
        form.reset();
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('cat-submit-btn');
        btn.disabled = true;
        
        const id = document.getElementById('cat-id').value;
        const data = {
            name: document.getElementById('cat-name').value,
            color: document.getElementById('cat-color').value,
            uniqueId: document.getElementById('cat-unique-id').value
        };
        
        try {
            if (id) {
                await categoryService.updateCategory(id, data);
                showAlert.success('Category updated');
            } else {
                await categoryService.addCategory(data, currentUser.uid);
                showAlert.success('Category added');
            }
            formContainer.style.display = 'none';
            // UI updates automatically via listener
        } catch (error) {
            showAlert.error(error.message);
        } finally {
            btn.disabled = false;
        }
    });

    loadCategories();
};
