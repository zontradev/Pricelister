/**
 * PriceLister - Global Search & Command Palette System
 * Linear / Stripe / Vercel-inspired command menu for instant navigation,
 * action execution, and deep entity searching (products, categories, invoices, currency, etc.).
 */

import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { openExcelImportModal, openExportModal } from './importExportModal.js';
import { openCurrencyPickerModal } from './currencyModal.js';
import { openAccountSwitcherModal } from '../auth-handler.js';
import { formatCurrency, getAppCurrencySymbol, setAppCurrencySymbol } from '../utilities.js';
import { showAlert } from '../alert-handler.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';
import { openInvoiceDetailsModal } from './invoiceDetailsModal.js';

let cachedWorkspaceId = null;
let liveDataCache = {
    products: [],
    categories: [],
    invoices: [],
    customers: [],
    businesses: [],
    lastFetched: 0
};
let isSearchModalOpen = false;
let currentActiveIndex = -1;
let currentSearchResults = [];
let currentCategoryFilter = 'ALL';

// Keyboard detection
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcutText = isMac ? '⌘K' : 'Ctrl+K';

/**
 * Built-in Quick Actions & System Capabilities
 */
const getStaticActions = (workspaceId) => [
    {
        id: 'act-import-excel',
        type: 'ACTION',
        title: 'Import Products (Excel / CSV)',
        subtitle: 'Bulk upload products, SKU, barcodes, and prices from spreadsheets',
        keywords: ['import', 'excel', 'csv', 'xlsx', 'sheet', 'upload', 'bulk', 'add products', 'spreadsheet', 'data'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        badge: 'Action',
        badgeClass: 'badge-action',
        handler: () => {
            openExcelImportModal(workspaceId, () => {
                showAlert.success('Products imported successfully!');
                refreshSearchCache(workspaceId, true);
                if (window.location.hash === '#/products') {
                    window.dispatchEvent(new CustomEvent('pricelister-refresh-products'));
                }
            });
        }
    },
    {
        id: 'act-export-products',
        type: 'ACTION',
        title: 'Export Products & Catalog',
        subtitle: 'Download Excel (.xlsx), CSV, or formatted printable PDF pricelist',
        keywords: ['export', 'download', 'pdf', 'excel', 'csv', 'pricelist', 'catalog', 'backup', 'products export'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
        badge: 'Export',
        badgeClass: 'badge-action',
        handler: () => {
            openExportModal(workspaceId);
        }
    },
    {
        id: 'act-add-product',
        type: 'ACTION',
        title: 'Add New Product',
        subtitle: 'Create a new product with price, barcode, category, and image',
        keywords: ['add product', 'new product', 'create product', 'product option', 'item', 'inventory', 'stock'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        badge: 'Product',
        badgeClass: 'badge-action-primary',
        handler: () => {
            if (window.location.hash !== '#/products') {
                window.location.hash = '#/products';
            }
            setTimeout(() => {
                const addBtn = document.getElementById('btn-add-product');
                if (addBtn) addBtn.click();
                const prdName = document.getElementById('prd-name');
                if (prdName) prdName.focus();
            }, 250);
        }
    },
    {
        id: 'act-market-inserter',
        type: 'ACTION',
        title: 'Market Inserter (Rapid Grid Editor)',
        subtitle: 'Spreadsheet-style fast batch entry for up to 250 products simultaneously',
        keywords: ['market inserter', 'grid', 'table', 'rapid entry', 'batch insert', 'paste table', 'multiple products'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"></path><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>`,
        badge: 'Editor',
        badgeClass: 'badge-action-secondary',
        handler: () => {
            window.location.hash = '#/market-inserter';
        }
    },
    {
        id: 'act-change-currency',
        type: 'ACTION',
        title: 'Change Currency & Country Symbol',
        subtitle: 'Configure currency symbol ($, €, ৳, £, ¥, AED, etc.) for invoices & catalog',
        keywords: ['currency', 'symbol', 'money', 'change currency', 'currency option', 'dollar', 'taka', 'euro', 'bdt', 'usd', 'inr', 'gbp', 'aed', 'country'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="6" x2="12" y2="18"></line><line x1="9" y1="9" x2="15" y2="9"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
        badge: 'Settings',
        badgeClass: 'badge-action',
        handler: () => {
            const currentSym = getAppCurrencySymbol();
            openCurrencyPickerModal(currentSym, (selected) => {
                if (selected && selected.symbol) {
                    setAppCurrencySymbol(selected.symbol);
                    showAlert.success(`Currency changed to ${selected.name} (${selected.symbol})`);
                }
            });
        }
    },
    {
        id: 'act-add-category',
        type: 'ACTION',
        title: 'Add New Category',
        subtitle: 'Create category tag with custom badge colors and grouping',
        keywords: ['add category', 'new category', 'create category', 'category option', 'tags', 'grouping'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`,
        badge: 'Category',
        badgeClass: 'badge-action',
        handler: () => {
            if (window.location.hash !== '#/categories') {
                window.location.hash = '#/categories';
            }
            setTimeout(() => {
                const addBtn = document.getElementById('btn-add-category');
                if (addBtn) addBtn.click();
            }, 250);
        }
    },
    {
        id: 'act-new-customer-invoice',
        type: 'ACTION',
        title: 'Create Customer Invoice (POS)',
        subtitle: 'Issue standard retail receipt / invoice for direct customer sales',
        keywords: ['new invoice', 'customer invoice', 'create invoice', 'pos', 'sales', 'billing', 'receipt', 'sell'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
        badge: 'Sales',
        badgeClass: 'badge-action-primary',
        handler: () => {
            if (window.location.hash !== '#/invoices/customer') {
                window.location.hash = '#/invoices/customer';
            }
            setTimeout(() => {
                const addBtn = document.getElementById('btn-add-invoice');
                if (addBtn) addBtn.click();
            }, 250);
        }
    },
    {
        id: 'act-new-business-invoice',
        type: 'ACTION',
        title: 'Create Business Invoice (B2B)',
        subtitle: 'Issue wholesale corporate invoice with tax, custom notes, and company info',
        keywords: ['business invoice', 'b2b invoice', 'wholesale invoice', 'corporate invoice', 'company bill'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        badge: 'B2B',
        badgeClass: 'badge-action',
        handler: () => {
            if (window.location.hash !== '#/invoices/business') {
                window.location.hash = '#/invoices/business';
            }
            setTimeout(() => {
                const addBtn = document.getElementById('btn-add-invoice');
                if (addBtn) addBtn.click();
            }, 250);
        }
    },
    {
        id: 'act-my-profile',
        type: 'ACTION',
        title: 'My Profile & Account Info',
        subtitle: 'View user email, role permissions, activity logs, and credentials',
        keywords: ['profile', 'my profile', 'account', 'user profile', 'profile option', 'email', 'avatar', 'password', 'user'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        badge: 'Account',
        badgeClass: 'badge-action',
        handler: () => {
            window.location.hash = '#/profile';
        }
    },
    {
        id: 'act-switch-account',
        type: 'ACTION',
        title: 'Switch / Change Account',
        subtitle: 'Quickly switch between multiple saved Google or email accounts',
        keywords: ['switch account', 'change account', 'multi account', 'login', 'other user', 'google login'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
        badge: 'Auth',
        badgeClass: 'badge-action',
        handler: () => {
            const user = authService.getCurrentUser();
            openAccountSwitcherModal(user);
        }
    },
    {
        id: 'act-customer-panel',
        type: 'ACTION',
        title: 'Customer Panel Setup & Portal',
        subtitle: 'Configure public shopping catalog, category visibility, WhatsApp orders, or launch portal',
        keywords: ['customer panel', 'customer portal', 'catalog setup', 'store setup', 'public catalog', 'shopping cart', 'terms', 'whatsapp order', 'launch panel'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
        badge: 'Store',
        badgeClass: 'badge-action-secondary',
        handler: () => {
            window.location.hash = '#/customer-panel';
        }
    },
    {
        id: 'act-workers-permissions',
        type: 'ACTION',
        title: 'Workers & Permissions Management',
        subtitle: 'Invite team members, assign Admin / Co-admin / Worker roles',
        keywords: ['workers', 'permissions', 'team', 'invite worker', 'roles', 'staff', 'employees', 'access control'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
        badge: 'Security',
        badgeClass: 'badge-action',
        handler: () => {
            window.location.hash = '#/workspace';
        }
    },
    {
        id: 'act-general-settings',
        type: 'ACTION',
        title: 'Workspace Settings',
        subtitle: 'Configure company name, contact info, default tax, invoice notes, and preferences',
        keywords: ['settings', 'workspace settings', 'company settings', 'configuration', 'tax', 'currency setting', 'general'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
        badge: 'Settings',
        badgeClass: 'badge-action',
        handler: () => {
            window.location.hash = '#/settings';
        }
    },
    {
        id: 'act-mailbox',
        type: 'ACTION',
        title: 'Open Mailbox & Alerts',
        subtitle: 'View workspace notifications, system messages, and worker updates',
        keywords: ['mailbox', 'inbox', 'messages', 'notifications', 'alerts', 'mail'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
        badge: 'Mail',
        badgeClass: 'badge-action',
        handler: () => {
            window.location.hash = '#/mailbox';
        }
    },
    {
        id: 'act-refresh-workspace',
        type: 'ACTION',
        title: 'Refresh Workspace & Sync Data',
        subtitle: 'Reload live catalog, stock counts, and sales records from cloud storage',
        keywords: ['refresh', 'reload', 'sync', 'update', 're-fetch', 'clear cache'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
        badge: 'System',
        badgeClass: 'badge-action',
        handler: () => {
            refreshCurrentWorkspaceView();
        }
    }
];

/**
 * Built-in Navigation Pages
 */
const getStaticNavRoutes = () => [
    {
        id: 'nav-overview',
        type: 'NAV',
        title: 'Workspace Overview',
        subtitle: 'KPI stat cards, sales charts, revenue metrics, and date filtering',
        keywords: ['overview', 'dashboard', 'home', 'kpi', 'revenue', 'analytics', 'charts', 'summary', 'sales report'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
        route: '#/overview',
        badge: 'Page'
    },
    {
        id: 'nav-products',
        type: 'NAV',
        title: 'All Products Catalog',
        subtitle: 'Browse and edit items, prices, barcodes, search, and stock status',
        keywords: ['products', 'all products', 'items', 'catalog', 'pricelist', 'inventory', 'prices', 'stock'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        route: '#/products',
        badge: 'Page'
    },
    {
        id: 'nav-categories',
        type: 'NAV',
        title: 'Categories & Grouping',
        subtitle: 'Manage item classification, category badges, and product counts',
        keywords: ['categories', 'grouping', 'tags', 'sections', 'item types', 'classification'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>`,
        route: '#/categories',
        badge: 'Page'
    },
    {
        id: 'nav-customer-invoices',
        type: 'NAV',
        title: 'Customer Invoices (Sales)',
        subtitle: 'View retail invoices, totals, dates, customer receipts, and status',
        keywords: ['customer invoices', 'invoices', 'receipts', 'retail sales', 'pos sales', 'orders'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`,
        route: '#/invoices/customer',
        badge: 'Page'
    },
    {
        id: 'nav-business-invoices',
        type: 'NAV',
        title: 'Business Invoices (B2B)',
        subtitle: 'Corporate sales, tax invoices, client billing records, and printouts',
        keywords: ['business invoices', 'b2b invoices', 'wholesale billing', 'corporate invoices', 'client invoices'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        route: '#/invoices/business',
        badge: 'Page'
    },
    {
        id: 'nav-analytics',
        type: 'NAV',
        title: 'Analytics & Data Intelligence Hub',
        subtitle: 'Detailed revenue growth, product turnover, sales forecasting, and charts',
        keywords: ['analytics', 'reports', 'charts', 'data check', 'insights', 'statistics', 'financial report', 'intelligence'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
        route: '#/analytics',
        badge: 'Page'
    },
    {
        id: 'nav-members',
        type: 'NAV',
        title: 'Members Activity & Contributions',
        subtitle: 'Audit trail of staff sales, modifications, additions, and timestamps',
        keywords: ['members', 'team activity', 'contributions', 'staff performance', 'audit trail', 'history', 'logs'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
        route: '#/members',
        badge: 'Page'
    },
    {
        id: 'nav-customers',
        type: 'NAV',
        title: 'Customers & Clients',
        subtitle: 'Customer directory, contact details, transaction history, and balances',
        keywords: ['customers', 'clients', 'people', 'buyers', 'contacts', 'phone numbers'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>`,
        route: '#/customers',
        badge: 'Page'
    },
    {
        id: 'nav-businesses',
        type: 'NAV',
        title: 'B2B Businesses Directory',
        subtitle: 'Corporate accounts, supplier / wholesale partners, and trade accounts',
        keywords: ['businesses', 'b2b', 'corporate partners', 'companies', 'dealers', 'vendors'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="9" y1="22" x2="9" y2="22.01"></line><line x1="15" y1="22" x2="15" y2="22.01"></line></svg>`,
        route: '#/businesses',
        badge: 'Page'
    },
    {
        id: 'nav-customer-panel',
        type: 'NAV',
        title: 'Customer Panel Setup',
        subtitle: 'Configure public shopping portal, terms, categories, and shareable catalog link',
        keywords: ['customer panel', 'customer portal', 'store', 'public catalog', 'shop setup', 'online cart'],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
        route: '#/customer-panel',
        badge: 'Page'
    }
];

/**
 * Refresh live workspace data cache in background
 */
export const refreshSearchCache = async (workspaceId, force = false) => {
    if (!workspaceId) return;
    const now = Date.now();
    // Cache for 45 seconds unless forced
    if (!force && liveDataCache.lastFetched && (now - liveDataCache.lastFetched < 45000)) {
        return;
    }

    try {
        const productService = getProductService(workspaceId);
        const categoryService = getCategoryService(workspaceId);
        const invoiceService = getInvoiceService(workspaceId);

        const [products, categories, invoices] = await Promise.all([
            productService.getAllActiveProducts().catch(() => []),
            categoryService.getAllCategories().catch(() => []),
            invoiceService.getAllInvoices().catch(() => [])
        ]);

        liveDataCache.products = Array.isArray(products) ? products : [];
        liveDataCache.categories = Array.isArray(categories) ? categories : [];
        liveDataCache.invoices = Array.isArray(invoices) ? invoices : [];
        liveDataCache.lastFetched = now;
    } catch (err) {
        console.warn('Global search cache update note:', err);
    }
};

/**
 * Reload current workspace view gracefully
 */
export const refreshCurrentWorkspaceView = () => {
    const currentHash = window.location.hash || '#/overview';
    const logoBrand = document.getElementById('sidebar-logo-brand');
    if (logoBrand) {
        logoBrand.classList.add('logo-spinning');
        setTimeout(() => logoBrand.classList.remove('logo-spinning'), 650);
    }

    showAlert.info('Refreshing workspace data...');
    refreshSearchCache(cachedWorkspaceId, true);

    // Trigger hashchange event or route re-render
    window.dispatchEvent(new CustomEvent('pricelister-currency-changed'));
    window.dispatchEvent(new CustomEvent('pricelister-refresh-products'));
    window.dispatchEvent(new HashChangeEvent('hashchange'));
};

/**
 * Highlight matched terms in text
 */
const highlightMatch = (text, query) => {
    if (!text) return '';
    if (!query || !query.trim()) return escapeHtml(text);
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return escapeHtml(text);

    let safe = escapeHtml(String(text));
    tokens.forEach(token => {
        const regex = new RegExp(`(${escapeRegex(token)})`, 'gi');
        safe = safe.replace(regex, '<mark class="palette-mark">$1</mark>');
    });
    return safe;
};

const escapeHtml = (str) => {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Perform Search query matching across Actions, Navigation, and Live Entities
 */
const performSearch = (query, filter = 'ALL') => {
    const q = (query || '').trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    const results = [];

    // 1. Static Actions
    if (filter === 'ALL' || filter === 'ACTION') {
        const actions = getStaticActions(cachedWorkspaceId);
        actions.forEach(action => {
            let score = 0;
            if (!tokens.length) {
                score = 1; // Show default actions
            } else {
                const titleLower = action.title.toLowerCase();
                const subLower = action.subtitle.toLowerCase();
                const keywords = action.keywords || [];

                tokens.forEach(t => {
                    if (titleLower.startsWith(t)) score += 10;
                    else if (titleLower.includes(t)) score += 6;
                    if (subLower.includes(t)) score += 3;
                    if (keywords.some(k => k.includes(t))) score += 5;
                });
            }

            if (score > 0) {
                results.push({
                    ...action,
                    score: score + 20, // Slight priority for immediate actions
                    categoryLabel: 'Actions & Tools'
                });
            }
        });
    }

    // 2. Navigation Pages
    if (filter === 'ALL' || filter === 'NAV') {
        const navs = getStaticNavRoutes();
        navs.forEach(nav => {
            let score = 0;
            if (!tokens.length) {
                score = 1;
            } else {
                const titleLower = nav.title.toLowerCase();
                const subLower = nav.subtitle.toLowerCase();
                const keywords = nav.keywords || [];

                tokens.forEach(t => {
                    if (titleLower.startsWith(t)) score += 10;
                    else if (titleLower.includes(t)) score += 6;
                    if (subLower.includes(t)) score += 3;
                    if (keywords.some(k => k.includes(t))) score += 4;
                });
            }

            if (score > 0) {
                results.push({
                    ...nav,
                    score: score + 10,
                    categoryLabel: 'Navigation Pages',
                    handler: () => {
                        window.location.hash = nav.route;
                    }
                });
            }
        });
    }

    // 3. Live Products (Catalog)
    if (filter === 'ALL' || filter === 'PRODUCT') {
        const products = liveDataCache.products || [];
        products.forEach(p => {
            if (!tokens.length && filter !== 'PRODUCT') return; // Don't overwhelm empty search with all products

            const nameLower = (p.name || '').toLowerCase();
            const barcodeLower = (p.barcode || p.sku || '').toLowerCase();
            const catLower = (p.category || '').toLowerCase();
            let score = 0;

            if (!tokens.length && filter === 'PRODUCT') {
                score = 1;
            } else {
                tokens.forEach(t => {
                    if (nameLower.startsWith(t)) score += 12;
                    else if (nameLower.includes(t)) score += 8;
                    if (barcodeLower.includes(t)) score += 10;
                    if (catLower.includes(t)) score += 4;
                });
            }

            if (score > 0) {
                const priceFormatted = formatCurrency(p.sellingPrice || p.price || 0);
                const stockText = typeof p.stock === 'number' ? `${p.stock} in stock` : 'Active';
                const sizeText = p.size ? ` • ${p.size}` : '';

                results.push({
                    id: `prd-${p.id}`,
                    type: 'PRODUCT',
                    title: p.name,
                    subtitle: `${priceFormatted} • ${p.category || 'General'}${sizeText} • ${stockText}`,
                    badge: p.category || 'Product',
                    badgeClass: 'badge-product',
                    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>`,
                    score: score,
                    categoryLabel: 'Products',
                    handler: () => {
                        window.location.hash = '#/products';
                        setTimeout(() => {
                            const searchInput = document.getElementById('product-search-input') || document.getElementById('search-products');
                            if (searchInput) {
                                searchInput.value = p.name;
                                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                        }, 250);
                    }
                });
            }
        });
    }

    // 4. Live Categories
    if (filter === 'ALL' || filter === 'CATEGORY') {
        const categories = liveDataCache.categories || [];
        categories.forEach(c => {
            if (!tokens.length && filter !== 'CATEGORY') return;

            const nameLower = (c.name || '').toLowerCase();
            let score = 0;

            if (!tokens.length && filter === 'CATEGORY') {
                score = 1;
            } else {
                tokens.forEach(t => {
                    if (nameLower.startsWith(t)) score += 10;
                    else if (nameLower.includes(t)) score += 6;
                });
            }

            if (score > 0) {
                results.push({
                    id: `cat-${c.id || c.name}`,
                    type: 'CATEGORY',
                    title: c.name,
                    subtitle: `Product Category • ${c.itemCount || 0} items listed`,
                    badge: 'Category',
                    badgeClass: 'badge-category',
                    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${c.color || '#3b82f6'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
                    score: score + 2,
                    categoryLabel: 'Categories',
                    handler: () => {
                        window.location.hash = '#/categories';
                    }
                });
            }
        });
    }

    // 5. Live Invoices
    if (filter === 'ALL' || filter === 'INVOICE') {
        const invoices = liveDataCache.invoices || [];
        invoices.forEach(inv => {
            if (!tokens.length && filter !== 'INVOICE') return;

            const invNum = String(inv.invoiceNumber || inv.id || '').toLowerCase();
            const recipient = String(inv.customerName || inv.clientName || inv.recipientName || '').toLowerCase();
            let score = 0;

            if (!tokens.length && filter === 'INVOICE') {
                score = 1;
            } else {
                tokens.forEach(t => {
                    if (invNum.includes(t)) score += 12;
                    if (recipient.includes(t)) score += 8;
                });
            }

            if (score > 0) {
                const totalFormatted = formatCurrency(inv.total || inv.grandTotal || 0);
                const invType = inv.isBusiness ? 'Business Invoice' : 'Customer Invoice';
                const route = inv.isBusiness ? '#/invoices/business' : '#/invoices/customer';

                results.push({
                    id: `inv-${inv.id}`,
                    type: 'INVOICE',
                    title: `Invoice #${inv.invoiceNumber || inv.id}`,
                    subtitle: `${invType} • ${inv.customerName || inv.clientName || 'General Customer'} • Total ${totalFormatted}`,
                    badge: inv.isBusiness ? 'B2B' : 'Customer',
                    badgeClass: inv.isBusiness ? 'badge-invoice-b2b' : 'badge-invoice',
                    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`,
                    score: score,
                    categoryLabel: 'Sales & Invoices',
                    handler: () => {
                        openInvoiceDetailsModal(inv, {
                            onEdit: (invoiceToEdit) => {
                                window.location.hash = inv.isBusiness ? '#/invoices/business' : '#/invoices/customer';
                            }
                        });
                    }
                });
            }
        });
    }

    // Sort descending by score
    results.sort((a, b) => b.score - a.score);

    // Limit to top 25 results to maintain peak performance & readability
    return results.slice(0, 25);
};

/**
 * Render Results DOM in Palette
 */
const renderSearchResults = (query, filter) => {
    const listContainer = document.getElementById('palette-results-list');
    const emptyState = document.getElementById('palette-empty-state');
    const countBadge = document.getElementById('palette-result-count');
    if (!listContainer) return;

    currentSearchResults = performSearch(query, filter);
    currentActiveIndex = currentSearchResults.length > 0 ? 0 : -1;

    if (countBadge) {
        countBadge.textContent = `${currentSearchResults.length} found`;
    }

    if (currentSearchResults.length === 0) {
        listContainer.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'flex';
            const querySpan = emptyState.querySelector('.palette-empty-query');
            if (querySpan) querySpan.textContent = query ? `"${query}"` : '';
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    listContainer.style.display = 'block';

    // Group results by categoryLabel
    const grouped = {};
    currentSearchResults.forEach((item, index) => {
        const cat = item.categoryLabel || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ ...item, globalIndex: index });
    });

    let html = '';
    Object.keys(grouped).forEach(catName => {
        html += `<div class="palette-group-header">${escapeHtml(catName)}</div>`;
        grouped[catName].forEach(item => {
            const isActive = item.globalIndex === currentActiveIndex ? 'palette-item-active' : '';
            const highlightedTitle = highlightMatch(item.title, query);
            const highlightedSubtitle = highlightMatch(item.subtitle, query);

            html += `
                <div class="palette-item ${isActive}" data-index="${item.globalIndex}" role="option" aria-selected="${item.globalIndex === currentActiveIndex}">
                    <div class="palette-item-icon">${item.icon}</div>
                    <div class="palette-item-content">
                        <div class="palette-item-title-row">
                            <span class="palette-item-title">${highlightedTitle}</span>
                            ${item.badge ? `<span class="palette-badge ${item.badgeClass || ''}">${escapeHtml(item.badge)}</span>` : ''}
                        </div>
                        ${item.subtitle ? `<div class="palette-item-subtitle">${highlightedSubtitle}</div>` : ''}
                    </div>
                    <div class="palette-item-action-hint">
                        <kbd class="palette-kbd">↵</kbd>
                    </div>
                </div>
            `;
        });
    });

    listContainer.innerHTML = html;

    // Attach click events
    listContainer.querySelectorAll('.palette-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-index'), 10);
            executeResultItem(idx);
        });

        el.addEventListener('mouseenter', () => {
            const idx = parseInt(el.getAttribute('data-index'), 10);
            setActiveIndex(idx);
        });
    });
};

/**
 * Change Active Keyboard Navigation Item
 */
const setActiveIndex = (index) => {
    if (index < 0 || index >= currentSearchResults.length) return;
    currentActiveIndex = index;

    const listContainer = document.getElementById('palette-results-list');
    if (!listContainer) return;

    listContainer.querySelectorAll('.palette-item').forEach(el => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        if (idx === currentActiveIndex) {
            el.classList.add('palette-item-active');
            el.setAttribute('aria-selected', 'true');
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
            el.classList.remove('palette-item-active');
            el.setAttribute('aria-selected', 'false');
        }
    });
};

/**
 * Execute item action / navigation
 */
const executeResultItem = (index) => {
    if (index < 0 || index >= currentSearchResults.length) return;
    const item = currentSearchResults[index];
    closeGlobalSearch();

    if (item && typeof item.handler === 'function') {
        try {
            item.handler();
        } catch (err) {
            console.error('Error executing search action:', err);
            showAlert.error('Could not execute selected action.');
        }
    }
};

/**
 * Open Global Search Command Palette
 */
export const openGlobalSearch = (initialQuery = '', filter = 'ALL') => {
    let overlay = document.getElementById('global-search-modal-overlay');
    if (!overlay) {
        createGlobalSearchModalDOM();
        overlay = document.getElementById('global-search-modal-overlay');
    }

    if (!overlay) return;

    currentCategoryFilter = filter;
    isSearchModalOpen = true;
    overlay.style.display = 'flex';
    document.body.classList.add('palette-modal-open');

    // Trigger pre-fetch of live records
    refreshSearchCache(cachedWorkspaceId);

    const input = document.getElementById('global-palette-input');
    if (input) {
        input.value = initialQuery;
        input.focus();
        if (initialQuery) input.select();
    }

    // Update filter pill UI
    updateFilterPillUI(filter);
    renderSearchResults(initialQuery, filter);
};

/**
 * Close Global Search Command Palette
 */
export const closeGlobalSearch = () => {
    const overlay = document.getElementById('global-search-modal-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
    document.body.classList.remove('palette-modal-open');
    isSearchModalOpen = false;
    currentActiveIndex = -1;
};

/**
 * Update Filter Pill active state
 */
const updateFilterPillUI = (filterKey) => {
    document.querySelectorAll('.palette-filter-pill').forEach(pill => {
        if (pill.getAttribute('data-filter') === filterKey) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
};

/**
 * Create Command Palette Modal DOM Elements
 */
const createGlobalSearchModalDOM = () => {
    const existing = document.getElementById('global-search-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'global-search-modal-overlay';
    overlay.className = 'palette-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
        <div class="palette-card" role="dialog" aria-modal="true" aria-label="Global Search and Quick Commands">
            <!-- Search Input Header -->
            <div class="palette-header">
                <div class="palette-input-wrapper">
                    <span class="palette-search-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input type="text" id="global-palette-input" class="palette-input" placeholder="Search anything (e.g. import, export, product, currency, profile, invoice)..." autocomplete="off" spellcheck="false">
                    <button type="button" id="palette-clear-btn" class="palette-clear-btn" title="Clear search text">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <kbd class="palette-esc-badge" id="palette-close-esc-btn" title="Close search (Esc)">ESC</kbd>
                </div>

                <!-- Category Filter Pills -->
                <div class="palette-filters-bar">
                    <button type="button" class="palette-filter-pill active" data-filter="ALL">All</button>
                    <button type="button" class="palette-filter-pill" data-filter="ACTION">Actions</button>
                    <button type="button" class="palette-filter-pill" data-filter="PRODUCT">Products</button>
                    <button type="button" class="palette-filter-pill" data-filter="NAV">Pages</button>
                    <button type="button" class="palette-filter-pill" data-filter="CATEGORY">Categories</button>
                    <button type="button" class="palette-filter-pill" data-filter="INVOICE">Invoices</button>
                    <span class="palette-result-count" id="palette-result-count">0 found</span>
                </div>
            </div>

            <!-- Scrollable Results Container -->
            <div class="palette-body" id="palette-body-container">
                <div id="palette-results-list" class="palette-results-list"></div>
                
                <!-- Empty State -->
                <div id="palette-empty-state" class="palette-empty-state" style="display:none;">
                    <div class="palette-empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><circle cx="11" cy="11" r="8"></line><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </div>
                    <div class="palette-empty-title">No matching results <span class="palette-empty-query"></span></div>
                    <p class="palette-empty-desc">Try searching for <strong>Import</strong>, <strong>Export</strong>, <strong>Add Product</strong>, <strong>Currency</strong>, <strong>Profile</strong>, or an item name.</p>
                    <div class="palette-quick-suggestions">
                        <button type="button" class="palette-suggestion-chip" data-query="import" style="display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Import Products
                        </button>
                        <button type="button" class="palette-suggestion-chip" data-query="export" style="display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Export Pricelist
                        </button>
                        <button type="button" class="palette-suggestion-chip" data-query="currency" style="display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                            Currency
                        </button>
                        <button type="button" class="palette-suggestion-chip" data-query="add product" style="display:inline-flex; align-items:center; gap:5px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Product
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer Keyboard Navigation Helper -->
            <div class="palette-footer">
                <div class="palette-footer-hints">
                    <span class="palette-hint-item"><kbd class="palette-kbd-sm">↑</kbd><kbd class="palette-kbd-sm">↓</kbd> Navigate</span>
                    <span class="palette-hint-item"><kbd class="palette-kbd-sm">↵</kbd> Select</span>
                    <span class="palette-hint-item"><kbd class="palette-kbd-sm">TAB</kbd> Category</span>
                    <span class="palette-hint-item"><kbd class="palette-kbd-sm">ESC</kbd> Close</span>
                </div>
                <div class="palette-footer-brand">
                    <span>PriceLister Global Search</span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event Listeners for Palette Modal
    const input = document.getElementById('global-palette-input');
    const clearBtn = document.getElementById('palette-clear-btn');
    const closeBtn = document.getElementById('palette-close-esc-btn');

    // Input live typing
    if (input) {
        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';
            renderSearchResults(query, currentCategoryFilter);
        });

        // Keydown controls
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(currentActiveIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(currentActiveIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeResultItem(currentActiveIndex);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeGlobalSearch();
            } else if (e.key === 'Tab') {
                e.preventDefault();
                cycleNextFilterPill(e.shiftKey ? -1 : 1);
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (input) {
                input.value = '';
                clearBtn.style.display = 'none';
                input.focus();
                renderSearchResults('', currentCategoryFilter);
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeGlobalSearch());
    }

    // Filter pill buttons
    overlay.querySelectorAll('.palette-filter-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const filterKey = pill.getAttribute('data-filter') || 'ALL';
            currentCategoryFilter = filterKey;
            updateFilterPillUI(filterKey);
            renderSearchResults(input ? input.value : '', filterKey);
            if (input) input.focus();
        });
    });

    // Quick suggestion chips
    overlay.querySelectorAll('.palette-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const q = chip.getAttribute('data-query') || '';
            if (input) {
                input.value = q;
                if (clearBtn) clearBtn.style.display = 'flex';
                input.focus();
                renderSearchResults(q, currentCategoryFilter);
            }
        });
    });

    // Backdrop click close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeGlobalSearch();
        }
    });
};

/**
 * Cycle Filter pills via TAB key
 */
const cycleNextFilterPill = (direction = 1) => {
    const filters = ['ALL', 'ACTION', 'PRODUCT', 'NAV', 'CATEGORY', 'INVOICE'];
    let idx = filters.indexOf(currentCategoryFilter);
    if (idx === -1) idx = 0;
    idx = (idx + direction + filters.length) % filters.length;
    currentCategoryFilter = filters[idx];
    updateFilterPillUI(currentCategoryFilter);
    const input = document.getElementById('global-palette-input');
    renderSearchResults(input ? input.value : '', currentCategoryFilter);
};

/**
 * Setup Topbar Search Trigger in Header
 */
const setupTopbarSearchTrigger = () => {
    const topbarActions = document.getElementById('topbar-actions');
    if (!topbarActions) return;

    // Check if trigger button already exists
    let searchTrigger = document.getElementById('global-search-trigger-btn');
    if (!searchTrigger) {
        searchTrigger = document.createElement('button');
        searchTrigger.id = 'global-search-trigger-btn';
        searchTrigger.className = 'topbar-search-btn';
        searchTrigger.setAttribute('type', 'button');
        searchTrigger.setAttribute('title', `Search anything in workspace (${shortcutText})`);
        searchTrigger.innerHTML = `
            <svg class="search-btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span class="search-btn-text">Search anything (e.g. Products, Import, Currency, Profile...)</span>
            <kbd class="search-btn-shortcut">${shortcutText}</kbd>
        `;

        searchTrigger.addEventListener('click', () => {
            openGlobalSearch();
        });

        // Insert at the beginning of topbar actions
        if (topbarActions.firstChild) {
            topbarActions.insertBefore(searchTrigger, topbarActions.firstChild);
        } else {
            topbarActions.appendChild(searchTrigger);
        }
    }
};

/**
 * Setup Sidebar Brand Logo Click -> Refresh Workspace
 */
const setupLogoRefreshInteraction = () => {
    const brandLogo = document.getElementById('sidebar-logo-brand') || document.querySelector('.sidebar-brand');
    if (brandLogo && !brandLogo._hasRefreshHandler) {
        brandLogo._hasRefreshHandler = true;
        brandLogo.style.cursor = 'pointer';
        brandLogo.setAttribute('title', 'PriceLister — Click to reload workspace & sync data');
        brandLogo.setAttribute('role', 'button');
        brandLogo.setAttribute('tabindex', '0');

        const handleLogoClick = (e) => {
            e.preventDefault();
            refreshCurrentWorkspaceView();
        };

        brandLogo.addEventListener('click', handleLogoClick);
        brandLogo.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                handleLogoClick(e);
            }
        });
    }
};

/**
 * Initialize Global Search System
 */
export const initGlobalSearch = (workspaceId) => {
    cachedWorkspaceId = workspaceId;

    // 1. Preload live cache in background
    refreshSearchCache(workspaceId);

    // 2. Setup Topbar Trigger Button
    setupTopbarSearchTrigger();

    // 3. Setup Logo Refresh
    setupLogoRefreshInteraction();

    // 4. Create Command Palette Modal DOM
    createGlobalSearchModalDOM();

    // 5. Global Keyboard Shortcuts: Ctrl+K / Cmd+K / Slash ('/')
    if (!window._globalSearchShortcutAttached) {
        window._globalSearchShortcutAttached = true;

        window.addEventListener('keydown', (e) => {
            // Check for Ctrl+K or Cmd+K
            if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
                e.preventDefault();
                if (isSearchModalOpen) {
                    closeGlobalSearch();
                } else {
                    openGlobalSearch();
                }
                return;
            }

            // Quick Slash '/' shortcut when not typing in an input/textarea/contenteditable
            if (e.key === '/' && !isSearchModalOpen) {
                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                const isEditable = document.activeElement && document.activeElement.isContentEditable;
                if (activeTag !== 'input' && activeTag !== 'textarea' && activeTag !== 'select' && !isEditable) {
                    e.preventDefault();
                    openGlobalSearch();
                }
            }
        });
    }
};
