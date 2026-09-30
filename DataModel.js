/**
 * DataModel.js - Single source of truth for frontend data structures.
 * Based on existing Android application data concepts.
 */

// Base64 + Timestamp Model (Android Kotlin equivalent)
// Yields exactly 13-character strings like VQI0vLEl3waPb
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function generateUniqueId() {
    let t = Date.now();
    let id = '';
    
    // First 7 characters based on timestamp (64^7 covers ~139 years of ms)
    for (let i = 0; i < 7; i++) {
        id = BASE64_CHARS.charAt(t % 64) + id;
        t = Math.floor(t / 64);
    }
    
    // Remaining 6 characters of randomness (64^6 = ~68 billion combinations)
    for (let i = 0; i < 6; i++) {
        id += BASE64_CHARS.charAt(Math.floor(Math.random() * 64));
    }
    
    return id;
}

export function generateInvoiceUniqueId() {
    return generateUniqueId();
}

// --- Base34 14-Character Generator (Android ProductViewModel.kt Parity) ---
export function generateWorkspaceId() {
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let time = Date.now();
    const timeSb = [];
    while (time > 0) {
        timeSb.push(chars[time % 34]);
        time = Math.floor(time / 34);
    }
    const timestampPart = timeSb.reverse().join("");
    const randomLen = Math.max(14 - timestampPart.length, 4);
    let randomPart = "";
    for (let i = 0; i < randomLen; i++) {
        randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    return (timestampPart + randomPart).substring(0, 14);
}

// --- Worker ID Generator (Android ProductViewModel.kt Parity) ---
export function generateWorkerId() {
    const timestampPart = Date.now().toString(36).toUpperCase();
    const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let randomPart = "";
    for (let i = 0; i < 6; i++) {
        randomPart += chars[Math.floor(Math.random() * chars.length)];
    }
    return timestampPart + randomPart;
}

export const COUNTRIES_LIST = [
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', iso: 'gb', defaultCurrency: 'GBP', defaultSymbol: '£' },
    { code: 'US', name: 'United States', flag: '🇺🇸', iso: 'us', defaultCurrency: 'USD', defaultSymbol: '$' },
    { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', iso: 'bd', defaultCurrency: 'BDT', defaultSymbol: '৳' },
    { code: 'IN', name: 'India', flag: '🇮🇳', iso: 'in', defaultCurrency: 'INR', defaultSymbol: '₹' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', iso: 'de', defaultCurrency: 'EUR', defaultSymbol: '€' },
    { code: 'FR', name: 'France', flag: '🇫🇷', iso: 'fr', defaultCurrency: 'EUR', defaultSymbol: '€' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', iso: 'it', defaultCurrency: 'EUR', defaultSymbol: '€' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', iso: 'es', defaultCurrency: 'EUR', defaultSymbol: '€' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', iso: 'ca', defaultCurrency: 'CAD', defaultSymbol: 'CA$' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', iso: 'au', defaultCurrency: 'AUD', defaultSymbol: 'AU$' },
    { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', iso: 'ae', defaultCurrency: 'AED', defaultSymbol: 'د.إ' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', iso: 'sa', defaultCurrency: 'SAR', defaultSymbol: '﷼' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬', iso: 'sg', defaultCurrency: 'SGD', defaultSymbol: 'S$' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾', iso: 'my', defaultCurrency: 'MYR', defaultSymbol: 'RM' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', iso: 'jp', defaultCurrency: 'JPY', defaultSymbol: '¥' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱', iso: 'nl', defaultCurrency: 'EUR', defaultSymbol: '€' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭', iso: 'ch', defaultCurrency: 'CHF', defaultSymbol: 'CHF' },
    { code: 'TR', name: 'Turkey', flag: '🇹🇷', iso: 'tr', defaultCurrency: 'TRY', defaultSymbol: '₺' },
    { code: 'PK', name: 'Pakistan', flag: '🇵🇰', iso: 'pk', defaultCurrency: 'PKR', defaultSymbol: '₨' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩', iso: 'id', defaultCurrency: 'IDR', defaultSymbol: 'Rp' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', iso: 'br', defaultCurrency: 'BRL', defaultSymbol: 'R$' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', iso: 'mx', defaultCurrency: 'MXN', defaultSymbol: 'MX$' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', iso: 'za', defaultCurrency: 'ZAR', defaultSymbol: 'R' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪', iso: 'se', defaultCurrency: 'SEK', defaultSymbol: 'kr' },
    { code: 'QA', name: 'Qatar', flag: '🇶🇦', iso: 'qa', defaultCurrency: 'QAR', defaultSymbol: '﷼' },
    { code: 'GL', name: 'Global / International', flag: '🌐', iso: 'un', defaultCurrency: 'USD', defaultSymbol: '$' }
];

export const WORKSPACE_ROLE_LEVELS = {
    ADMIN: 0,
    CO_ADMIN: 1,
    MANAGER: 2,
    WORKER: 3,
    VISITOR: 4
};

export const WORKSPACE_ROLES = {
    0: {
        level: 0,
        id: 'ADMIN',
        name: 'Admin / Founder',
        defaultTag: 'Administrator',
        allowedTags: ['Administrator', 'Founder', 'Owner', 'Chief', 'CEO', 'Managing Director', 'President', 'Creator'],
        canBeRestricted: false,
        canManageMembers: true,
        canChangeSettings: true,
        description: 'Supreme control over workspace, all members, promotions, demotions & settings.'
    },
    1: {
        level: 1,
        id: 'CO_ADMIN',
        name: 'Co-Admin',
        defaultTag: 'Co-Administration',
        allowedTags: ['Co-Administration', 'Co-Founder', 'Head Manager', 'Vice President', 'Partner', 'Associate Director'],
        canBeRestricted: false,
        canManageMembers: true,
        canChangeSettings: true,
        description: 'Elevated management power. Handles visitors, workers, managers and full workspace operations.'
    },
    2: {
        level: 2,
        id: 'MANAGER',
        name: 'Manager',
        defaultTag: 'Store Manager',
        allowedTags: ['Store Manager', 'Cashier', 'Supervisor', 'Sales Manager', 'Shift Lead', 'Floor Manager'],
        canBeRestricted: true,
        canManageMembers: false,
        canChangeSettings: false,
        description: 'Operational manager. Handles invoices, catalog & sales. Cannot change workspace settings.'
    },
    3: {
        level: 3,
        id: 'WORKER',
        name: 'Worker',
        defaultTag: 'Staff',
        allowedTags: ['Staff', 'Assistant', 'Employee', 'Sales Associate', 'Operator', 'Clerk'],
        canBeRestricted: true,
        canManageMembers: false,
        canChangeSettings: false,
        description: 'Standard operator for sales and inventory. Can be restricted from add/update/delete.'
    },
    4: {
        level: 4,
        id: 'VISITOR',
        name: 'Visitor',
        defaultTag: 'Visitor',
        allowedTags: ['Visitor', 'Observer', 'Guest', 'Auditor'],
        canBeRestricted: true,
        isDefaultRestricted: true,
        canManageMembers: false,
        canChangeSettings: false,
        description: 'Read-only observer. Restricted from editing/adding data and cannot see profit.'
    }
};

export function getRoleLevel(role) {
    if (typeof role === 'number') return Math.max(0, Math.min(4, role));
    const r = String(role || '').toUpperCase().trim();
    if (r === 'CREATOR_ADMIN' || r === 'ADMIN' || r === 'CREATOR' || r === 'FOUNDER' || r === '0') return 0;
    if (r === 'CO_ADMIN' || r === 'CO-ADMIN' || r === 'COADMIN' || r === '1') return 1;
    if (r === 'MANAGER' || r === 'STORE_MANAGER' || r === '2') return 2;
    if (r === 'WORKER' || r === 'STAFF' || r === 'EMPLOYEE' || r === '3') return 3;
    if (r === 'VISITOR' || r === 'GUEST' || r === 'OBSERVER' || r === '4') return 4;
    return 3;
}

export function getRoleMeta(role) {
    const level = getRoleLevel(role);
    return WORKSPACE_ROLES[level] || WORKSPACE_ROLES[3];
}

export class WorkspaceInfo {
    constructor(data = {}) {
        this.workspaceId = data.workspaceId || generateWorkspaceId();
        this.name = data.name || "";
        this.tradeName = data.tradeName || data.shopName || "";
        this.country = data.country || data.operatedCountry || "United States";
        this.operatedCountry = data.operatedCountry || data.country || "United States";
        this.industry = data.industry || data.category || "General";
        this.tagline = data.tagline || data.description || "";
        this.description = data.description || data.tagline || "Main";
        this.website = data.website || "";
        this.taxId = data.taxId || data.vatNumber || "";
        this.phone = data.phone || "";
        this.supportPhone = data.supportPhone || "";
        this.email = data.email || data.adminEmail || "";
        this.address = data.address || "";
        this.logoUrl = data.logoUrl || data.logo || "";
        this.logo = data.logo || data.logoUrl || "";
        this.bannerUrl = data.bannerUrl || data.banner || "";
        this.banner = data.banner || data.bannerUrl || "";
        this.adminEmail = data.adminEmail || data.email || "";
        this.adminName = data.adminName || "";
        this.adminId = data.adminId || generateWorkerId();
        this.role = data.role || "CREATOR_ADMIN";
        this.workspaceRole = data.workspaceRole !== undefined ? Number(data.workspaceRole) : getRoleLevel(data.role);
        this.roleTag = data.roleTag || data.customTag || "Founder";
        this.createdAt = Number(data.createdAt) || Date.now();
        this.workersCount = Number(data.workersCount) || 0;
        this.adminProductCount = Number(data.adminProductCount) || 0;
        this.adminInvoiceCount = Number(data.adminInvoiceCount) || 0;
        this.adminCategoryCount = Number(data.adminCategoryCount) || 0;
        this.adminBusinessCount = Number(data.adminBusinessCount) || 0;
        this.adminClientCount = Number(data.adminClientCount) || 0;
        this.adminTotalDeleted = Number(data.adminTotalDeleted) || 0;
        this.adminTotalDeletedCount = Number(data.adminTotalDeletedCount) || 0;
        this.currency = data.currency || data.currencySymbol || "$";
        this.currencySymbol = data.currencySymbol || data.currency || "$";
    }
}

export class Invoice {
    constructor(data = {}) {
        this.additionalCut = Number(data.additionalCut) || 0.0;
        this.busInvNumber = data.busInvNumber || data.invoiceNumber || "";
        this.businessAddress = data.businessAddress || "";
        this.businessEmail = data.businessEmail || "";
        this.businessId = data.businessId || "";
        this.businessName = data.businessName || "";
        this.businessPhone = data.businessPhone || "";
        this.clientAddress = data.clientAddress || "";
        this.clientEmail = data.clientEmail || "";
        this.clientPhone = data.clientPhone || "";
        this.clientId = data.clientId || "";
        this.creatorId = data.creatorId || "";
        this.customerId = data.customerId || "";
        this.customerName = data.customerName || "";
        this.customerNumber = data.customerNumber !== undefined ? String(data.customerNumber) : "";
        this.discountPercent = Number(data.discountPercent) || 0.0;
        this.invoiceNumber = data.invoiceNumber || data.busInvNumber || "";
        this.isBusinessInvoice = data.isBusinessInvoice !== undefined ? Boolean(data.isBusinessInvoice) : false;
        this.items = (data.items || []).map(item => new InvoiceItem(item));
        this.note = data.note !== undefined ? String(data.note) : "";
        this.shippingCost = Number(data.shippingCost) || 0.0;
        this.status = data.status || "Paid"; // "Paid", "Unpaid", "Draft"
        this.taxPercent = Number(data.taxPercent) || 0.0;
        this.timestamp = Number(data.timestamp) || Date.now();
        this.title = data.title || "Invoice";
        this.totalPrice = Number(data.totalPrice) || 0.0;
        this.totalProfit = Number(data.totalProfit) || 0.0;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
    }
}

export class InvoiceItem {
    constructor(data = {}) {
        let pId = data.productId;
        if (pId !== null && pId !== undefined && pId !== '' && !isNaN(Number(pId)) && typeof pId !== 'boolean') {
            const num = Number(pId);
            pId = Number.isInteger(num) ? num : num;
        } else if (pId === undefined) {
            pId = null;
        }

        this.itemProfit = Number(data.itemProfit) !== undefined && !isNaN(Number(data.itemProfit)) 
            ? Number(data.itemProfit) 
            : 0.0;
        this.productId = pId;
        this.productName = data.productName || "";
        this.quantity = Number(data.quantity) || 1;
        this.totalPrice = Number(data.totalPrice) !== undefined && !isNaN(Number(data.totalPrice)) 
            ? Number(data.totalPrice) 
            : (this.quantity * (Number(data.unitPrice) || 0.0));
        this.unitCost = Number(data.unitCost) || 0.0;
        this.unitPrice = Number(data.unitPrice) || 0.0;
    }
}

export class Product {
    constructor(data = {}) {
        this.id = data.id || null; // Firebase document ID
        this.uniqueId = data.uniqueId || generateUniqueId();
        this.name = data.name || "";
        this.sizeWeight = data.sizeWeight || "";
        this.quantity = data.quantity || 0;
        this.price = data.price || 0.0; // cost price
        this.salePrice = data.salePrice || 0.0;
        this.basePrice = data.basePrice || 0.0;
        this.mrp = data.mrp || 0.0;
        this.mfgDate = data.mfgDate || "";
        this.expDate = data.expDate || "";
        this.note = data.note || "";
        this.category = data.category || ""; // Maps to Category ID
        this.upcCode = data.upcCode || "";
        this.imageUri = data.imageUri || "";
        this.variations = data.variations || []; 
        this.labelColor = data.labelColor || data.color || ""; // REPLACED: color -> labelColor
        this.timestamp = data.timestamp || Date.now();
        this.updatedTimestamp = data.updatedTimestamp || Date.now();
        this.creatorId = data.creatorId || "";
        this.workspaceId = data.workspaceId || "";
        // Note: isArchive is kept for web UI functionality. If Android crashes, we can remove it.
        this.isArchive = data.isArchive !== undefined ? data.isArchive : false;
    }
}

export class BusinessProfile {
    constructor(data = {}) {
        this.address = data.address || "";
        this.email = data.email || "";
        this.id = data.id || null;
        this.invoiceCount = Number(data.invoiceCount) || 0;
        this.name = data.name || "";
        this.phone = data.phone || "";
        this.imageUrl = data.imageUrl || data.imageUri || "";
        this.imageUri = data.imageUri || data.imageUrl || "";
        this.tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map(s => s.trim()) : []);
        this.notes = data.notes || data.note || "";
        this.status = data.status || "Active";
        this.timestamp = Number(data.timestamp) || Date.now();
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
        this.updatedTimestamp = data.updatedTimestamp || Date.now();
        this.creatorId = data.creatorId || "";
    }
}

export class ClientProfile {
    constructor(data = {}) {
        this.id = data.id || null;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
        this.isClient = data.isClient !== undefined ? data.isClient : true;
        this.name = data.name || "";
        this.phone = data.phone || "";
        this.address = data.address || "";
        this.email = data.email || "";
        this.imageUrl = data.imageUrl || data.imageUri || "";
        this.imageUri = data.imageUri || data.imageUrl || "";
        this.tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map(s => s.trim()) : []);
        this.notes = data.notes || data.note || "";
        this.status = data.status || "Active";
        this.creatorId = data.creatorId || "";
        this.timestamp = data.timestamp || Date.now();
    }
}

export class CustomerProfile {
    constructor(data = {}) {
        this.id = data.id || null;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
        this.isClient = data.isClient !== undefined ? data.isClient : false; // Required by Android
        this.name = data.name || "";
        this.phone = data.phone || "";
        this.address = data.address || "";
        this.email = data.email || "";
        this.imageUrl = data.imageUrl || data.imageUri || "";
        this.imageUri = data.imageUri || data.imageUrl || "";
        this.tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map(s => s.trim()) : []);
        this.notes = data.notes || data.note || "";
        this.status = data.status || "Active";
        this.creatorId = data.creatorId || "";
        this.timestamp = data.timestamp || Date.now();
    }
}

export class Category {
    constructor(data = {}) {
        this.id = data.id || null;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId(); // standardizing internal ID naming
        this.name = data.name || data.displayName || ""; // standardizing name
        this.color = data.color || "#cccccc"; // NEW: color
        this.timestamp = data.timestamp || Date.now();
        this.updatedTimestamp = data.updatedTimestamp || Date.now(); // NEW: updatedTimestamp
        this.creatorId = data.creatorId || null;
    }
}

export class UserRole {
    static CREATOR_ADMIN = 'CREATOR_ADMIN';
    static CO_ADMIN = 'CO_ADMIN';
    static WORKER = 'WORKER';
}

export class WorkerPermission {
    constructor(data = {}) {
        this.isRestricted = data.isRestricted || false;
        this.disableAdd = data.disableAdd || false;
        this.disableUpdate = data.disableUpdate || false;
        this.disableDelete = data.disableDelete || false;
    }
}

export class Order {
    constructor(data = {}) {
        this.id = data.id || null;
        this.orderNumber = data.orderNumber || ('ORD-' + Math.floor(100000 + Math.random() * 900000));
        this.uniqueId = data.uniqueId || generateUniqueId();
        this.customerName = (data.customerName || '').trim();
        this.customerPhone = (data.customerPhone || '').trim();
        this.customerAddress = (data.customerAddress || '').trim();
        this.orderNote = (data.orderNote || '').trim();
        this.items = (data.items || []).map(item => ({
            productId: item.productId || item.id || null,
            productName: item.productName || item.name || '',
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice || item.price || item.salePrice) || 0.0,
            totalPrice: Number(item.totalPrice) || ((Number(item.quantity) || 1) * (Number(item.unitPrice || item.price || item.salePrice) || 0.0)),
            imageUri: item.imageUri || item.imageUrl || '',
            sizeWeight: item.sizeWeight || '',
            mrp: Number(item.mrp) || 0.0
        }));
        this.subtotal = Number(data.subtotal) || 0.0;
        this.shippingCost = Number(data.shippingCost) || 0.0;
        this.totalAmount = Number(data.totalAmount) || 0.0;
        this.currencySymbol = data.currencySymbol || '$';
        this.status = data.status || 'PENDING'; // 'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'
        this.paymentMethod = data.paymentMethod || 'COD';
        this.source = data.source || 'CUSTOMER_PANEL';
        this.workspaceId = data.workspaceId || '';
        this.createdAt = Number(data.createdAt) || Date.now();
        this.updatedAt = Number(data.updatedAt) || Date.now();
        this.isArchive = Boolean(data.isArchive);
    }
}

export class CustomerPanelConfig {
    constructor(data = {}) {
        this.isPublished = Boolean(data.isPublished || data.enabled);
        this.enabled = this.isPublished;
        this.brandingMode = data.brandingMode || 'PRICELISTER'; // 'PRICELISTER', 'CUSTOM', 'WORKSPACE'
        this.storeName = (data.storeName || '').trim() || 'PriceLister Store';
        this.storeLogo = data.storeLogo || data.logoUrl || '';
        this.workspaceLogo = data.workspaceLogo || '';
        this.customSlug = (data.customSlug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        this.deployCountry = data.deployCountry || 'Global';
        this.whatsappNumber = (data.whatsappNumber || '').trim();
        this.phone = (data.phone || '').trim();
        this.email = (data.email || '').trim();
        this.address = (data.address || '').trim();
        this.announcement = (data.announcement || '').trim();
        this.termsAndConditions = (data.termsAndConditions || '').trim();
        this.categorySelectionMode = data.categorySelectionMode === 'SPECIFIC' ? 'SPECIFIC' : 'ALL';
        this.allowedCategories = Array.isArray(data.allowedCategories) ? data.allowedCategories : [];
        this.showMrp = data.showMrp !== undefined ? Boolean(data.showMrp) : true;
        this.showStockBadge = data.showStockBadge !== undefined ? Boolean(data.showStockBadge) : true;
        this.closedMessage = data.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.';
        this.currencySymbol = data.currencySymbol || '$';
        this.publishedAt = data.publishedAt || null;
        this.updatedAt = data.updatedAt || null;
        this.uid = data.uid || null;
    }
}

