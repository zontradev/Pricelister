import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getProductService } from '../services/productService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { getPeopleService } from '../services/peopleService.js';
import { getSettingsService } from '../services/settingsService.js';
import { showAlert } from '../alert-handler.js';

export const renderProfile = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        container.innerHTML = `<div class="card" style="padding:2rem; text-align:center;">Please log in to view your profile.</div>`;
        return;
    }

    const productService = getProductService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const settingsService = getSettingsService(workspaceId);

    // Initial Skeleton Loading State
    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem;">
            <h2>My Profile</h2>
            <p style="color: var(--text-secondary); margin: 0.25rem 0 0 0;">Manage your account details and view workspace permissions.</p>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card);">
                <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem;">
                    <div class="skeleton-shimmer" style="width:72px; height:72px; border-radius:50%;"></div>
                    <div>
                        <div class="skeleton-shimmer" style="width:140px; height:22px; margin-bottom:8px;"></div>
                        <div class="skeleton-shimmer" style="width:180px; height:16px; margin-bottom:8px;"></div>
                        <div class="skeleton-shimmer" style="width:80px; height:20px; border-radius:10px;"></div>
                    </div>
                </div>
                <div style="background:var(--surface-50); padding:1.25rem; border-radius:10px; display:flex; flex-direction:column; gap:0.75rem;">
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                    <div class="skeleton-shimmer" style="width:100%; height:18px;"></div>
                </div>
            </div>
            <div class="card" style="padding: 2rem; border-radius: var(--radius-card);">
                <div class="skeleton-shimmer" style="width:180px; height:22px; margin-bottom:1.25rem;"></div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:1rem;">
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                    <div class="skeleton-shimmer" style="height:70px; border-radius:10px;"></div>
                </div>
            </div>
        </div>
    `;

    try {
        // Fetch workspace details and stats in parallel for fast loading
        const [wsData, products, custInvoices, busInvoices, businesses, customers, isVending] = await Promise.all([
            firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => null),
            productService.getAllActiveProducts().catch(() => []),
            invoiceService.getAllInvoices(false).catch(() => []),
            invoiceService.getAllInvoices(true).catch(() => []),
            peopleService.getAllBusinesses().catch(() => []),
            peopleService.getAllCustomers().catch(() => []),
            settingsService.isVendingEnabled().catch(() => false)
        ]);

        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        const email = currentUser.email;
        const photoURL = currentUser.photoURL;
        const role = wsData?.role || (wsData?.id === currentUser.uid ? 'CREATOR_ADMIN' : 'WORKER');
        const workspaceName = wsData?.name || wsData?.businessName || 'My Workspace';
        const totalInvoices = custInvoices.length + busInvoices.length;
        const initial = displayName.charAt(0).toUpperCase();

        const roleColor = role === 'CREATOR_ADMIN' ? 'var(--primary)' : '#2563eb';
        const roleBg = role === 'CREATOR_ADMIN' ? 'rgba(225, 29, 72, 0.12)' : 'rgba(37, 99, 235, 0.12)';

        container.innerHTML = `
            <div class="module-header" style="margin-bottom: 2rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <div>
                    <h2 style="margin:0 0 0.35rem 0;">My Profile</h2>
                    <p style="color: var(--text-secondary); margin: 0;">Account identity, access tier, and workspace footprint.</p>
                </div>
                <div style="display:flex; gap:0.75rem;">
                    <button id="btn-profile-settings" class="btn btn-secondary">Workspace Settings</button>
                    <button id="btn-profile-logout" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger);">Sign Out</button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.75rem; margin-bottom: 2rem;">
                
                <!-- PROFILE CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float); display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; align-items:center; gap:1.25rem; margin-bottom:1.5rem;">
                            ${photoURL 
                                ? `<img src="${photoURL}" alt="${displayName}" style="width:72px; height:72px; border-radius:50%; object-fit:cover; border:3px solid var(--surface-200); box-shadow:0 4px 10px rgba(0,0,0,0.1);">` 
                                : `<div style="width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg, #e11d48, #be123c); color:white; font-size:1.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(225,29,72,0.3);">${initial}</div>`
                            }
                            <div>
                                <h3 style="margin:0 0 0.25rem 0; font-size:1.35rem; color:var(--text-primary); font-weight:700;">${displayName}</h3>
                                <div style="font-size:0.9rem; color:var(--text-secondary); margin-bottom:0.5rem;">${email}</div>
                                <span class="badge" style="background:${roleBg}; color:${roleColor}; font-weight:700; font-size:0.78rem; padding:0.25rem 0.65rem;">
                                    ${role}
                                </span>
                            </div>
                        </div>

                        <div style="background:var(--surface-50); padding:1.25rem; border-radius:10px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:0.75rem; font-size:0.88rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Account Email</span>
                                <strong style="color:var(--text-primary);">${email}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">User ID</span>
                                <code style="font-family:monospace; font-size:0.8rem; background:rgba(0,0,0,0.04); padding:0.15rem 0.4rem; border-radius:4px;">${currentUser.uid.substring(0, 14)}...</code>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Active Role</span>
                                <strong style="color:${roleColor};">${role}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-secondary);">Auth Provider</span>
                                <span style="color:var(--text-primary); font-weight:500;">Google Authentication</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- WORKSPACE DETAILS CARD -->
                <div class="card" style="padding: 2rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                    <h3 style="margin:0 0 1.25rem 0; font-size:1.15rem; color:var(--text-primary); font-weight:700; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
                        Workspace Overview
                    </h3>

                    <div style="display:flex; flex-direction:column; gap:1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                            <span style="color:var(--text-secondary);">Workspace Name</span>
                            <strong style="color:var(--text-primary); font-size:1rem;">${workspaceName}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                            <span style="color:var(--text-secondary);">Workspace ID</span>
                            <code style="font-family:monospace; font-size:0.82rem; color:var(--primary); font-weight:600;">${workspaceId}</code>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.9rem;">
                            <span style="color:var(--text-secondary);">Vending Mode</span>
                            <span class="badge" style="background:${isVending ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.1)'}; color:${isVending ? '#059669' : '#64748b'}; font-weight:600;">
                                ${isVending ? 'Active (Auto-deducts)' : 'Disabled'}
                            </span>
                        </div>
                        
                        <!-- Quick Metric Chips -->
                        <div style="margin-top:0.75rem; display:grid; grid-template-columns: repeat(2, 1fr); gap:0.75rem;">
                            <div style="background:var(--surface-50); padding:0.85rem; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary);">${products.length}</div>
                                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:500;">Active Products</div>
                            </div>
                            <div style="background:var(--surface-50); padding:0.85rem; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--primary);">${totalInvoices}</div>
                                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:500;">Total Invoices</div>
                            </div>
                            <div style="background:var(--surface-50); padding:0.85rem; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary);">${businesses.length}</div>
                                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:500;">Businesses</div>
                            </div>
                            <div style="background:var(--surface-50); padding:0.85rem; border-radius:8px; border:1px solid var(--border-color); text-align:center;">
                                <div style="font-size:1.4rem; font-weight:700; color:var(--text-primary);">${customers.length}</div>
                                <div style="font-size:0.78rem; color:var(--text-secondary); font-weight:500;">Customers</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECURITY & ACTIONS CARD -->
            <div class="card" style="padding: 1.75rem; border-radius: var(--radius-card); box-shadow: var(--shadow-float);">
                <h3 style="margin:0 0 1rem 0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">Account Actions</h3>
                <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/customer'">+ Add Customer Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/invoices/business'">+ Add Business Invoice</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/products'">Manage Products</button>
                    <button class="btn btn-secondary" onclick="window.location.hash='#/categories'">Manage Categories</button>
                </div>
            </div>
        `;

        // Event Listeners
        container.querySelector('#btn-profile-settings')?.addEventListener('click', () => {
            window.location.hash = '#/settings';
        });

        container.querySelector('#btn-profile-logout')?.addEventListener('click', async () => {
            if (await showAlert.confirm('Are you sure you want to sign out?')) {
                await authService.logout();
                window.location.href = 'index.html';
            }
        });

    } catch (err) {
        console.error("renderProfile error:", err);
        container.innerHTML = `
            <div class="card" style="padding:2rem; text-align:center; color:var(--danger);">
                Failed to load profile details. Please try refreshing the page.
            </div>
        `;
    }
};
