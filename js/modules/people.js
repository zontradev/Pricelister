import { getPeopleService } from '../services/peopleService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';

export const renderPeople = async (container, workspaceId, defaultTab = 'customers') => {
    const peopleService = getPeopleService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const currentUser = authService.getCurrentUser();
    
    let currentTab = defaultTab;
    let dataList = [];
    let allInvoices = [];
    
    const isBusinessMode = defaultTab === 'businesses';
    
    // UI Layout
    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>${isBusinessMode ? 'Businesses' : 'Customers & Clients'}</h2>
            <button id="btn-add-person" class="btn btn-primary">Add New</button>
        </div>
        
        <!-- Tabs -->
        ${isBusinessMode ? '' : `
        <div style="display:flex; gap:1rem; border-bottom: 1px solid var(--border-color); margin-bottom: 2rem;">
            <button class="tab-btn ${currentTab === 'customers' ? 'active-tab' : ''}" data-tab="customers" style="padding: 0.5rem 1rem; background:none; border:none; cursor:pointer; font-weight:600; border-bottom: ${currentTab === 'customers' ? '2px solid var(--primary)' : 'none'};">Customers</button>
            <button class="tab-btn ${currentTab === 'clients' ? 'active-tab' : ''}" data-tab="clients" style="padding: 0.5rem 1rem; background:none; border:none; cursor:pointer; font-weight:600; border-bottom: ${currentTab === 'clients' ? '2px solid var(--primary)' : 'none'};">Clients</button>
        </div>
        `}
        
        <div id="person-form-container" class="card" style="display:none; margin-bottom: 2rem; padding: 1.5rem;">
            <h3 id="person-form-title">New Entry</h3>
            <form id="person-form" style="display:flex; flex-direction:column; gap:1rem; margin-top: 1rem;">
                <input type="hidden" id="person-id">
                
                <div style="display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label>Name / Company Name *</label>
                        <input type="text" id="person-name" required class="form-control" style="width:100%; padding:0.5rem;">
                    </div>
                    <div style="flex:1;">
                        <label>Phone</label>
                        <input type="text" id="person-phone" class="form-control" style="width:100%; padding:0.5rem;">
                    </div>
                </div>

                <div style="display:flex; gap:1rem;">
                    <div style="flex:1;">
                        <label>Email</label>
                        <input type="email" id="person-email" class="form-control" style="width:100%; padding:0.5rem;">
                    </div>
                    <div style="flex:1;">
                        <label>Address</label>
                        <input type="text" id="person-address" class="form-control" style="width:100%; padding:0.5rem;">
                    </div>
                </div>

                <div style="display:flex; gap:1rem; margin-top:1rem;">
                    <button type="submit" class="btn btn-primary" id="person-submit-btn">Save</button>
                    <button type="button" class="btn btn-secondary" id="person-cancel-btn">Cancel</button>
                </div>
            </form>
        </div>
        
        <div class="table-container">
            <table style="width:100%; border-collapse: collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                        <th style="padding:1rem;">Name</th>
                        <th style="padding:1rem;">Contact</th>
                        <th style="padding:1rem;">Address</th>
                        <th style="padding:1rem;">Usage</th>
                        <th style="padding:1rem;">Actions</th>
                    </tr>
                </thead>
                <tbody id="people-list-body">
                    ${Array(5).fill(0).map(() => `
                        <tr class="skeleton-row" style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 140px; height: 18px;"></div><div class="skeleton-shimmer" style="width: 80px; height: 12px; margin-top: 4px;"></div></td>
                            <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 120px; height: 16px;"></div></td>
                            <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 160px; height: 16px;"></div></td>
                            <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 70px; height: 22px; border-radius: 12px;"></div></td>
                            <td style="padding:1rem;"><div class="skeleton-shimmer" style="width: 80px; height: 28px; border-radius: 4px;"></div></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const formContainer = container.querySelector('#person-form-container');
    const form = container.querySelector('#person-form');
    const tbody = container.querySelector('#people-list-body');
    const title = container.querySelector('#person-form-title');

    let unsubscribe = null;
    let invUnsub1 = null;
    let invUnsub2 = null;

    // Helper to calculate invoice usage count via uniqueId
    const getInvoiceCountForPerson = (person) => {
        if (!person) return 0;
        const uId = person.uniqueId || person.id;
        const name = (person.name || '').trim().toLowerCase();
        const phone = (person.phone || '').trim();

        if (currentTab === 'businesses') {
            return allInvoices.filter(inv => 
                (inv.businessId && (inv.businessId === uId || inv.businessId === person.id)) ||
                (inv.businessName && inv.businessName.trim().toLowerCase() === name)
            ).length;
        } else if (currentTab === 'clients') {
            return allInvoices.filter(inv => 
                (inv.clientId && (inv.clientId === uId || inv.clientId === person.id)) ||
                (inv.clientEmail && inv.clientEmail === person.email) ||
                (inv.clientPhone && inv.clientPhone === phone)
            ).length;
        } else {
            return allInvoices.filter(inv => 
                (inv.customerId && (inv.customerId === uId || inv.customerId === person.id)) ||
                (inv.customerName && inv.customerName.trim().toLowerCase() === name) ||
                (inv.customerNumber && inv.customerNumber === phone)
            ).length;
        }
    };

    // Tab Switching logic
    if (!isBusinessMode) {
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                container.querySelectorAll('.tab-btn').forEach(b => {
                    b.style.borderBottom = 'none';
                    b.classList.remove('active-tab');
                });
                e.target.style.borderBottom = '2px solid var(--primary)';
                e.target.classList.add('active-tab');
                currentTab = e.target.getAttribute('data-tab');
                formContainer.style.display = 'none';
                loadData();
            });
        });
    }

    const loadData = async () => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        // Fetch all invoices to compute exact connected count
        try {
            const [custInvs, busInvs] = await Promise.all([
                invoiceService.getAllInvoices(false).catch(() => []),
                invoiceService.getAllInvoices(true).catch(() => [])
            ]);
            allInvoices = [...custInvs, ...busInvs];
        } catch (e) {
            console.warn("Could not fetch invoices for usage count:", e);
        }
        
        const renderList = (data) => {
            dataList = data;
            if (dataList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="padding:1rem; text-align:center; color: var(--text-muted);">No ${currentTab} found.</td></tr>`;
                return;
            }
            
            tbody.innerHTML = dataList.map(person => {
                const count = Math.max(getInvoiceCountForPerson(person), person.invoiceCount || 0);
                return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:1rem;">
                        <strong>${person.name}</strong><br>
                        <small class="text-muted" style="font-family: monospace; font-size: 0.78rem;">${person.uniqueId || person.id}</small>
                    </td>
                    <td style="padding:1rem;">${person.phone || '-'}<br>${person.email || '-'}</td>
                    <td style="padding:1rem;">${person.address || '-'}</td>
                    <td style="padding:1rem;">
                        <span class="badge" style="background: ${count > 0 ? 'var(--primary)' : 'rgba(100,116,139,0.2)'}; color: ${count > 0 ? 'white' : 'var(--text-secondary)'}; font-weight: 600; font-size: 0.8rem; padding: 0.3rem 0.65rem; border-radius: 6px;">
                            ${count} ${count === 1 ? 'Invoice' : 'Invoices'}
                        </span>
                    </td>
                    <td style="padding:1rem;">
                        <button class="btn btn-sm btn-secondary edit-person" data-id="${person.id}">Edit</button>
                        <button class="btn btn-sm btn-outline del-person" data-id="${person.id}">Delete</button>
                    </td>
                </tr>
                `;
            }).join('');
            attachListEvents();
        };

        try {
            if (currentTab === 'customers') unsubscribe = peopleService.listenCustomers(renderList);
            else if (currentTab === 'businesses') unsubscribe = peopleService.listenBusinesses(renderList);
            else if (currentTab === 'clients') unsubscribe = peopleService.listenClients(renderList);
        } catch (error) {
            showAlert.error(`Failed to listen to ${currentTab}`);
        }
    };
    
    const attachListEvents = () => {
        container.querySelectorAll('.edit-person').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                const p = dataList.find(x => x.id === id);
                if (p) {
                    container.querySelector('#person-id').value = p.id;
                    container.querySelector('#person-name').value = p.name;
                    container.querySelector('#person-phone').value = p.phone;
                    container.querySelector('#person-email').value = p.email;
                    container.querySelector('#person-address').value = p.address;
                    
                    title.textContent = `Edit ${currentTab.slice(0, -1)}`;
                    formContainer.style.display = 'block';
                    formContainer.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        container.querySelectorAll('.del-person').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                if (await showAlert.confirm('Delete this entry?')) {
                    try {
                        if (currentTab === 'customers') await peopleService.deleteCustomer(id);
                        else if (currentTab === 'businesses') await peopleService.deleteBusiness(id);
                        else if (currentTab === 'clients') await peopleService.deleteClient(id);
                        
                        showAlert.success('Deleted');
                        // Real-time listener handles the UI update
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });
    };

    // UI Toggles
    container.querySelector('#btn-add-person').addEventListener('click', () => {
        form.reset();
        container.querySelector('#person-id').value = '';
        title.textContent = `New ${currentTab.slice(0, -1)}`;
        formContainer.style.display = 'block';
    });

    container.querySelector('#person-cancel-btn').addEventListener('click', () => {
        formContainer.style.display = 'none';
        form.reset();
    });

    // Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = container.querySelector('#person-submit-btn');
        btn.disabled = true;
        
        const id = container.querySelector('#person-id').value;
        const data = {
            name: container.querySelector('#person-name').value,
            phone: container.querySelector('#person-phone').value,
            email: container.querySelector('#person-email').value,
            address: container.querySelector('#person-address').value
        };
        
        try {
            if (id) {
                if (currentTab === 'customers') await peopleService.updateCustomer(id, data);
                else if (currentTab === 'businesses') await peopleService.updateBusiness(id, data);
                else if (currentTab === 'clients') await peopleService.updateClient(id, data);
                showAlert.success('Updated successfully');
            } else {
                if (currentTab === 'customers') await peopleService.addCustomer(data, currentUser.uid);
                else if (currentTab === 'businesses') await peopleService.addBusiness(data, currentUser.uid);
                else if (currentTab === 'clients') await peopleService.addClient(data, currentUser.uid);
                showAlert.success('Added successfully');
            }
            formContainer.style.display = 'none';
            // Real-time listener handles the UI update
        } catch (error) {
            showAlert.error(error.message);
        } finally {
            btn.disabled = false;
        }
    });

    loadData();
};

