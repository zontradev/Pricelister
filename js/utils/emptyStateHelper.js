/**
 * PriceLister Enterprise Empty State Helper
 * Renders distinct, bespoke empty states with custom SVG illustrations,
 * contextual typography, and permission-aware action buttons.
 */

// Helper to escape HTML to prevent XSS
const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * 1. PRODUCTS EMPTY STATES
 */

// 1.1 Initial Workspace Empty State: No Products Added Yet
export const renderProductsInitialEmptyState = ({ canCreate = true } = {}) => {
    return `
        <div class="empty-state-card" style="padding: 4.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <!-- 3D Outlined Product Box SVG -->
            <div style="width: 84px; height: 84px; border-radius: 20px; background: #f4f4f5; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; border: 1.5px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    <circle cx="12" cy="7" r="1.5" fill="#18181B"></circle>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 800; color: var(--text-primary, #18181B); letter-spacing: -0.01em;">
                No Product Added yet.
            </h3>
            <p style="margin: 0 0 1.75rem 0; font-size: 0.92rem; color: var(--text-secondary, #71717A); max-width: 440px; line-height: 1.55;">
                Start adding products to amplify your business and grow production.
            </p>

            ${canCreate ? `
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; justify-content: center;">
                    <button type="button" id="btn-empty-add-product" class="btn btn-primary" style="padding: 0.65rem 1.6rem; font-size: 0.92rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.12);">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Add Product
                    </button>
                    <button type="button" id="btn-empty-market-inserter" class="btn" style="padding: 0.65rem 1.6rem; font-size: 0.92rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        Use Market Inserter
                    </button>
                </div>
            ` : `
                <div style="font-size: 0.82rem; color: #71717A; background: #f4f4f5; padding: 0.45rem 1rem; border-radius: 8px; border: 1px solid #e4e4e7;">
                    Visitor / Restricted mode active — read-only access.
                </div>
            `}
        </div>
    `;
};

// 1.2 Search Result Empty State
export const renderProductsSearchEmptyState = ({ searchVal = '' } = {}) => {
    return `
        <div class="empty-state-card" style="padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <div style="width: 76px; height: 76px; border-radius: 20px; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1.5px solid #fee2e2;">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.4rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary, #18181B);">
                No Search Result Found.
            </h3>
            <p style="margin: 0 0 1.5rem 0; font-size: 0.88rem; color: var(--text-secondary, #71717A); max-width: 420px; line-height: 1.5;">
                No products match your search query ${searchVal ? `<strong>"${escapeHtml(searchVal)}"</strong>` : ''}. Try checking for typos or searching by another SKU / barcode.
            </p>

            <button type="button" id="btn-empty-clear-search" class="btn" style="padding: 0.55rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 8px; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; cursor: pointer;">
                Clear Search Query
            </button>
        </div>
    `;
};

// 1.3 Category Filter Empty State
export const renderProductsCategoryEmptyState = ({ catName = '', canCreate = true } = {}) => {
    return `
        <div class="empty-state-card" style="padding: 4rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <div style="width: 76px; height: 76px; border-radius: 20px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1.5px solid #dcfce7;">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.4rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary, #18181B);">
                Empty category.
            </h3>
            <p style="margin: 0 0 1.5rem 0; font-size: 0.9rem; color: var(--text-secondary, #71717A); max-width: 440px; line-height: 1.5;">
                No product added inside the category <strong style="color: var(--text-primary); font-family: monospace; font-size: 0.95rem;">"#${escapeHtml(catName || 'Selected')}"</strong>.
            </p>

            <div style="display: flex; gap: 0.75rem; align-items: center; justify-content: center; flex-wrap: wrap;">
                ${canCreate ? `
                    <button type="button" id="btn-empty-add-cat-prod" class="btn btn-primary" style="padding: 0.55rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 8px; cursor: pointer;">
                        + Add Product in #${escapeHtml(catName)}
                    </button>
                ` : ''}
                <button type="button" id="btn-empty-clear-cat" class="btn" style="padding: 0.55rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 8px; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; cursor: pointer;">
                    Show All Categories
                </button>
            </div>
        </div>
    `;
};


/**
 * 2. INVOICES EMPTY STATES
 */

// 2.1 Initial Workspace Invoices Empty State: No Invoices Added Yet
export const renderInvoicesInitialEmptyState = ({ canCreate = true, isBusinessInvoice = false } = {}) => {
    return `
        <div class="empty-state-card" style="padding: 4.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <!-- SVG Empty Invoice Logo -->
            <div style="width: 86px; height: 86px; border-radius: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; border: 1.5px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="8" y1="13" x2="16" y2="13"></line>
                    <line x1="8" y1="17" x2="13" y2="17"></line>
                    <circle cx="16" cy="17" r="1.5" fill="#18181B"></circle>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 800; color: var(--text-primary, #18181B); letter-spacing: -0.01em;">
                No Invoice added yet.
            </h3>
            <p style="margin: 0 0 1.75rem 0; font-size: 0.92rem; color: var(--text-secondary, #71717A); max-width: 460px; line-height: 1.55;">
                Start making invoices to track your business records and analyze your customers.
            </p>

            ${canCreate ? `
                <!-- Outlined grey semi big sized Create Invoice Button per user rule -->
                <button type="button" id="btn-empty-create-invoice" class="btn" style="padding: 0.7rem 2.25rem; font-size: 0.95rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.15s ease;">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Create ${isBusinessInvoice ? 'Business Invoice' : 'Invoice'}
                </button>
            ` : `
                <div style="font-size: 0.82rem; color: #71717A; background: #f4f4f5; padding: 0.45rem 1rem; border-radius: 8px; border: 1px solid #e4e4e7;">
                    Visitor / Restricted mode active — invoice creation is restricted.
                </div>
            `}
        </div>
    `;
};

// 2.2 Invoices Filter / Search / Target Empty State
export const renderInvoicesFilterEmptyState = ({ searchQuery = '', targetType = '', targetQuery = '', isRange = false } = {}) => {
    let msg = 'No invoices match your active filters.';
    if (targetType && targetQuery) {
        msg = `No invoices found for targeted ${targetType === 'customer' ? 'Customer' : 'Business'} matching "${escapeHtml(targetQuery)}".`;
    } else if (searchQuery) {
        msg = `No invoices match your search query "${escapeHtml(searchQuery)}".`;
    } else if (isRange) {
        msg = 'No invoices found within the specified amount or item count range.';
    }

    return `
        <div class="empty-state-card" style="padding: 3.8rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <div style="width: 76px; height: 76px; border-radius: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1.5px solid #e2e8f0;">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <path d="M11 8v6"></path>
                    <path d="M8 11h6"></path>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.4rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary, #18181B);">
                No Matching Invoices Found
            </h3>
            <p style="margin: 0 0 1.5rem 0; font-size: 0.9rem; color: var(--text-secondary, #71717A); max-width: 440px; line-height: 1.5;">
                ${msg} Try clearing your filters or search term to see all invoices.
            </p>

            <button type="button" id="btn-empty-clear-inv-filters" class="btn" style="padding: 0.55rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 8px; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; cursor: pointer;">
                Reset All Filters
            </button>
        </div>
    `;
};


/**
 * 3. CUSTOMERS, CLIENTS & BUSINESSES EMPTY STATES
 */

// 3.1 Initial Empty State: No People Added Yet
export const renderPeopleInitialEmptyState = ({ type = 'customers', canCreate = true } = {}) => {
    const isBus = type === 'businesses';
    const isClient = type === 'clients';
    const label = isBus ? 'Business' : (isClient ? 'Client' : 'Customer');

    return `
        <div class="empty-state-card" style="padding: 4.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <div style="width: 86px; height: 86px; border-radius: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; border: 1.5px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);">
                ${isBus ? `
                    <!-- Business Storefront / Enterprise SVG -->
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                        <circle cx="12" cy="11" r="1.5" fill="#18181B"></circle>
                    </svg>
                ` : `
                    <!-- Customer Avatar Card SVG -->
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#18181B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                `}
            </div>

            <h3 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 800; color: var(--text-primary, #18181B); letter-spacing: -0.01em;">
                No ${label} added yet.
            </h3>
            <p style="margin: 0 0 1.75rem 0; font-size: 0.92rem; color: var(--text-secondary, #71717A); max-width: 450px; line-height: 1.55;">
                ${isBus 
                    ? 'Register your primary business profile, branches, and entity billing credentials.' 
                    : `Start adding ${label.toLowerCase()} profiles to track customer balances, invoices, and contact data.`}
            </p>

            ${canCreate ? `
                <button type="button" id="btn-empty-add-person" class="btn" style="padding: 0.7rem 2rem; font-size: 0.92rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add ${label}
                </button>
            ` : `
                <div style="font-size: 0.82rem; color: #71717A; background: #f4f4f5; padding: 0.45rem 1rem; border-radius: 8px; border: 1px solid #e4e4e7;">
                    Visitor / Restricted mode active — entry creation disabled.
                </div>
            `}
        </div>
    `;
};

// 3.2 Search Result Empty State
export const renderPeopleSearchEmptyState = ({ type = 'customers', searchQuery = '' } = {}) => {
    const isBus = type === 'businesses';
    const label = isBus ? 'Businesses' : (type === 'clients' ? 'Clients' : 'Customers');

    return `
        <div class="empty-state-card" style="padding: 3.8rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-card, #ffffff); border-radius: 16px;">
            <div style="width: 76px; height: 76px; border-radius: 20px; background: #f8fafc; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1.5px solid #e2e8f0;">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
            </div>

            <h3 style="margin: 0 0 0.4rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary, #18181B);">
                No ${label} Found
            </h3>
            <p style="margin: 0 0 1.5rem 0; font-size: 0.9rem; color: var(--text-secondary, #71717A); max-width: 440px; line-height: 1.5;">
                No ${label.toLowerCase()} match your search query ${searchQuery ? `<strong>"${escapeHtml(searchQuery)}"</strong>` : ''}.
            </p>

            <button type="button" id="btn-empty-clear-people-search" class="btn" style="padding: 0.55rem 1.4rem; font-size: 0.88rem; font-weight: 700; border-radius: 8px; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; cursor: pointer;">
                Clear Search
            </button>
        </div>
    `;
};

