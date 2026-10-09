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
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', iso: 'gb', defaultCurrency: 'GBP', defaultCurrencyName: 'British Pound', defaultSymbol: '£', region: 'England' },
    { code: 'US', name: 'United States', flag: '🇺🇸', iso: 'us', defaultCurrency: 'USD', defaultCurrencyName: 'US Dollar', defaultSymbol: '$', region: 'North America' },
    { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', iso: 'bd', defaultCurrency: 'BDT', defaultCurrencyName: 'Bangladeshi Taka', defaultSymbol: '৳', region: 'South Asia' },
    { code: 'IN', name: 'India', flag: '🇮🇳', iso: 'in', defaultCurrency: 'INR', defaultCurrencyName: 'Indian Rupee', defaultSymbol: '₹', region: 'South Asia' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', iso: 'de', defaultCurrency: 'EUR', defaultCurrencyName: 'Euro', defaultSymbol: '€', region: 'Europe' },
    { code: 'FR', name: 'France', flag: '🇫🇷', iso: 'fr', defaultCurrency: 'EUR', defaultCurrencyName: 'Euro', defaultSymbol: '€', region: 'Europe' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹', iso: 'it', defaultCurrency: 'EUR', defaultCurrencyName: 'Euro', defaultSymbol: '€', region: 'Europe' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸', iso: 'es', defaultCurrency: 'EUR', defaultCurrencyName: 'Euro', defaultSymbol: '€', region: 'Europe' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', iso: 'ca', defaultCurrency: 'CAD', defaultCurrencyName: 'Canadian Dollar', defaultSymbol: 'CA$', region: 'North America' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', iso: 'au', defaultCurrency: 'AUD', defaultCurrencyName: 'Australian Dollar', defaultSymbol: 'AU$', region: 'Oceania' },
    { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', iso: 'ae', defaultCurrency: 'AED', defaultCurrencyName: 'UAE Dirham', defaultSymbol: 'د.إ', region: 'Middle East' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', iso: 'sa', defaultCurrency: 'SAR', defaultCurrencyName: 'Saudi Riyal', defaultSymbol: '﷼', region: 'Middle East' },
    { code: 'SG', name: 'Singapore', flag: '🇸🇬', iso: 'sg', defaultCurrency: 'SGD', defaultCurrencyName: 'Singapore Dollar', defaultSymbol: 'S$', region: 'Southeast Asia' },
    { code: 'MY', name: 'Malaysia', flag: '🇲🇾', iso: 'my', defaultCurrency: 'MYR', defaultCurrencyName: 'Malaysian Ringgit', defaultSymbol: 'RM', region: 'Southeast Asia' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵', iso: 'jp', defaultCurrency: 'JPY', defaultCurrencyName: 'Japanese Yen', defaultSymbol: '¥', region: 'East Asia' },
    { code: 'NL', name: 'Netherlands', flag: '🇳🇱', iso: 'nl', defaultCurrency: 'EUR', defaultCurrencyName: 'Euro', defaultSymbol: '€', region: 'Europe' },
    { code: 'CH', name: 'Switzerland', flag: '🇨🇭', iso: 'ch', defaultCurrency: 'CHF', defaultCurrencyName: 'Swiss Franc', defaultSymbol: 'CHF', region: 'Europe' },
    { code: 'TR', name: 'Turkey', flag: '🇹🇷', iso: 'tr', defaultCurrency: 'TRY', defaultCurrencyName: 'Turkish Lira', defaultSymbol: '₺', region: 'Eurasia' },
    { code: 'PK', name: 'Pakistan', flag: '🇵🇰', iso: 'pk', defaultCurrency: 'PKR', defaultCurrencyName: 'Pakistani Rupee', defaultSymbol: '₨', region: 'South Asia' },
    { code: 'ID', name: 'Indonesia', flag: '🇮🇩', iso: 'id', defaultCurrency: 'IDR', defaultCurrencyName: 'Indonesian Rupiah', defaultSymbol: 'Rp', region: 'Southeast Asia' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷', iso: 'br', defaultCurrency: 'BRL', defaultCurrencyName: 'Brazilian Real', defaultSymbol: 'R$', region: 'South America' },
    { code: 'MX', name: 'Mexico', flag: '🇲🇽', iso: 'mx', defaultCurrency: 'MXN', defaultCurrencyName: 'Mexican Peso', defaultSymbol: 'MX$', region: 'Latin America' },
    { code: 'ZA', name: 'South Africa', flag: '🇿🇦', iso: 'za', defaultCurrency: 'ZAR', defaultCurrencyName: 'South African Rand', defaultSymbol: 'R', region: 'Africa' },
    { code: 'SE', name: 'Sweden', flag: '🇸🇪', iso: 'se', defaultCurrency: 'SEK', defaultCurrencyName: 'Swedish Krona', defaultSymbol: 'kr', region: 'Scandinavia' },
    { code: 'QA', name: 'Qatar', flag: '🇶🇦', iso: 'qa', defaultCurrency: 'QAR', defaultCurrencyName: 'Qatari Riyal', defaultSymbol: '﷼', region: 'Middle East' },
    { code: 'GL', name: 'Global / International', flag: '🌐', iso: 'un', defaultCurrency: 'USD', defaultCurrencyName: 'US Dollar', defaultSymbol: '$', region: 'Global' }
];

export const WORKSPACE_ROLE_LEVELS = {
    ADMIN: 0,
    CO_ADMIN: 1,
    MANAGER: 2,
    WORKER: 3,
    VISITOR: 4
};

export const PERMISSIONS = {
    WORKSPACE_VIEW: 'workspace.view',
    WORKSPACE_UPDATE_IDENTITY: 'workspace.update_identity',
    WORKSPACE_UPDATE_COUNTRY_CURRENCY: 'workspace.update_country_currency',
    WORKSPACE_MANAGE_MEMBERS: 'workspace.manage_members',
    WORKSPACE_MANAGE_ROLE_TAGS: 'workspace.manage_role_tags',
    WORKSPACE_PROMOTE_MEMBERS: 'workspace.promote_members',
    WORKSPACE_DEMOTE_MEMBERS: 'workspace.demote_members',
    BUSINESS_CREATE: 'business.create',
    BUSINESS_EDIT: 'business.edit',
    INVOICE_CREATE: 'invoice.create',
    INVOICE_EDIT: 'invoice.edit',
    INVOICE_DELETE: 'invoice.delete',
    REPORTS_VIEW: 'reports.view',
    REPORTS_VIEW_PROFIT: 'reports.view_profit',
    DATA_EXPORT: 'data.export',
    DATA_IMPORT: 'data.import'
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
        canViewProfit: true,
        canCreateEdit: true,
        description: 'Supreme authority over the workspace. Manages settings, identity, country, currency, invitations, promotions, demotions & role tags.',
        permissions: [
            PERMISSIONS.WORKSPACE_VIEW,
            PERMISSIONS.WORKSPACE_UPDATE_IDENTITY,
            PERMISSIONS.WORKSPACE_UPDATE_COUNTRY_CURRENCY,
            PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
            PERMISSIONS.WORKSPACE_MANAGE_ROLE_TAGS,
            PERMISSIONS.WORKSPACE_PROMOTE_MEMBERS,
            PERMISSIONS.WORKSPACE_DEMOTE_MEMBERS,
            PERMISSIONS.BUSINESS_CREATE,
            PERMISSIONS.BUSINESS_EDIT,
            PERMISSIONS.INVOICE_CREATE,
            PERMISSIONS.INVOICE_EDIT,
            PERMISSIONS.INVOICE_DELETE,
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.REPORTS_VIEW_PROFIT,
            PERMISSIONS.DATA_EXPORT,
            PERMISSIONS.DATA_IMPORT
        ]
    },
    1: {
        level: 1,
        id: 'CO_ADMIN',
        name: 'Co-Admin',
        defaultTag: 'Co-Administration',
        allowedTags: ['Co-Administration', 'Co-Founder', 'Head Manager', 'Vice President', 'Partner', 'Associate Director'],
        canBeRestricted: false,
        canManageMembers: true,
        canChangeSettings: false, // Protected workspace ownership/identity restricted to Admin
        canViewProfit: true,
        canCreateEdit: true,
        description: 'Elevated workspace administration. Handles Visitors, Workers, and Managers. Cannot modify Admin or protected workspace ownership.',
        permissions: [
            PERMISSIONS.WORKSPACE_VIEW,
            PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
            PERMISSIONS.WORKSPACE_MANAGE_ROLE_TAGS,
            PERMISSIONS.WORKSPACE_PROMOTE_MEMBERS,
            PERMISSIONS.WORKSPACE_DEMOTE_MEMBERS,
            PERMISSIONS.BUSINESS_CREATE,
            PERMISSIONS.BUSINESS_EDIT,
            PERMISSIONS.INVOICE_CREATE,
            PERMISSIONS.INVOICE_EDIT,
            PERMISSIONS.INVOICE_DELETE,
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.REPORTS_VIEW_PROFIT,
            PERMISSIONS.DATA_EXPORT,
            PERMISSIONS.DATA_IMPORT
        ]
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
        canViewProfit: false, // Default: profit hidden unless explicitly authorized
        canCreateEdit: true,
        description: 'Operational manager. Handles invoices, catalog operations & sales floor. Cannot view profit by default or alter workspace settings.',
        permissions: [
            PERMISSIONS.WORKSPACE_VIEW,
            PERMISSIONS.BUSINESS_CREATE,
            PERMISSIONS.BUSINESS_EDIT,
            PERMISSIONS.INVOICE_CREATE,
            PERMISSIONS.INVOICE_EDIT,
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.DATA_EXPORT
        ]
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
        canViewProfit: false,
        canCreateEdit: true,
        description: 'Standard operator for sales and inventory. Can be restricted from add, update, or delete. Cannot view profit.',
        permissions: [
            PERMISSIONS.WORKSPACE_VIEW,
            PERMISSIONS.INVOICE_CREATE,
            PERMISSIONS.INVOICE_EDIT,
            PERMISSIONS.BUSINESS_CREATE,
            PERMISSIONS.BUSINESS_EDIT
        ]
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
        canViewProfit: false,
        canCreateEdit: false,
        description: 'Read-only observer. Restricted from editing or adding data and strictly cannot view profit.',
        permissions: [
            PERMISSIONS.WORKSPACE_VIEW
        ]
    }
};

export function getRoleLevel(role) {
    if (typeof role === 'number') return Math.max(0, Math.min(4, Math.floor(role)));
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

/**
 * Centralized authorization check
 * @param {Object|number|string} userOrRole - Current member object, role level, or role string
 * @param {string} permission - The required permission string from PERMISSIONS
 * @returns {boolean}
 */
export function hasPermission(userOrRole, permission) {
    if (!userOrRole && userOrRole !== 0) return false;
    
    let level = 3;
    let memberData = null;
    
    if (typeof userOrRole === 'object') {
        memberData = userOrRole;
        level = memberData.workspaceRole !== undefined ? getRoleLevel(memberData.workspaceRole) : getRoleLevel(memberData.role);
    } else {
        level = getRoleLevel(userOrRole);
    }

    // Role 0 (Admin) has unrestricted power
    if (level === 0) return true;

    // Check base permissions of the role
    const roleMeta = WORKSPACE_ROLES[level] || WORKSPACE_ROLES[3];
    let granted = roleMeta.permissions.includes(permission);

    // Apply specific member restrictions if present
    if (memberData) {
        // Profit view override
        if (permission === PERMISSIONS.REPORTS_VIEW_PROFIT) {
            if (memberData.canViewProfit === true) granted = true;
            if (memberData.canViewProfit === false && level !== 0) granted = false;
        }

        // Action restriction overrides (disableAdd, disableUpdate, disableDelete)
        if (memberData.disableAdd && (permission === PERMISSIONS.BUSINESS_CREATE || permission === PERMISSIONS.INVOICE_CREATE || permission === 'product.create')) {
            granted = false;
        }
        if (memberData.disableUpdate && (permission === PERMISSIONS.BUSINESS_EDIT || permission === PERMISSIONS.INVOICE_EDIT || permission === 'product.edit')) {
            granted = false;
        }
        if (memberData.disableDelete && (permission === PERMISSIONS.INVOICE_DELETE || permission === 'product.delete')) {
            granted = false;
        }
        if (level === 4) {
            // Visitors strictly cannot edit or add
            if (permission !== PERMISSIONS.WORKSPACE_VIEW) granted = false;
        }
    }

    return granted;
}

/**
 * Hierarchy Authority Rule: Can the actor manage the target?
 * - Role 0 (Admin) can manage anyone (except another action that removes the last admin).
 * - Role 1 (Co-Admin) can manage roles 2, 3, 4. Cannot manage Role 0 or another Role 1.
 * - Roles 2, 3, 4 cannot manage any member.
 */
export function canManageMember(actingRole, targetRole) {
    const actorLevel = getRoleLevel(actingRole);
    const targetLevel = getRoleLevel(targetRole);

    if (actorLevel === 0) return true;
    if (actorLevel === 1) {
        return targetLevel > 1; // Can manage 2, 3, 4
    }
    return false;
}

/**
 * Can the actor edit the target's role tag?
 * - Members cannot change their own tag unless authorized:
 *   - Admin can change their own and anyone else's tag.
 *   - Co-Admin can change their own and roles 2, 3, 4 tags.
 *   - Lower roles cannot change any tag.
 */
export function canChangeRoleTag(actingRole, targetRole, isSelf = false) {
    const actorLevel = getRoleLevel(actingRole);
    if (actorLevel === 0) return true;
    if (actorLevel === 1) {
        if (isSelf) return true;
        const targetLevel = getRoleLevel(targetRole);
        return targetLevel > 1;
    }
    return false;
}

/**
 * Can the actor promote or demote a target to a target role level?
 * - Actor level 0 (Admin): can set any level 1..4 (cannot demote last admin).
 * - Actor level 1 (Co-Admin): can only promote/demote between 2, 3, 4. Cannot touch 0 or 1, and cannot promote anyone to 0 or 1.
 * - Lower roles cannot promote/demote.
 */
export function canPromoteDemote(actingRole, fromRole, toRoleLevel) {
    const actorLevel = getRoleLevel(actingRole);
    const targetLevel = getRoleLevel(fromRole);
    const newLevel = getRoleLevel(toRoleLevel);

    if (actorLevel === 0) {
        return newLevel >= 0 && newLevel <= 4;
    }
    if (actorLevel === 1) {
        // Co-admin cannot modify role 0 or 1, and cannot promote to role 0 or 1
        if (targetLevel <= 1) return false;
        if (newLevel <= 1) return false;
        return true;
    }
    return false;
}

export class WorkspaceInfo {
    constructor(data = {}) {
        this.workspaceId = data.workspaceId || generateWorkspaceId();
        this.name = data.name || "";
        this.tradeName = data.tradeName || data.shopName || "";
        
        // Independent Country and Region
        this.country = data.country || data.operatedCountry || "United Kingdom";
        this.operatedCountry = data.operatedCountry || data.country || "United Kingdom";
        this.countryCode = data.countryCode || "GB";
        this.region = data.region || "";

        // Independent Currency fields
        this.currencyCode = data.currencyCode || "EUR";
        this.currencyName = data.currencyName || "Euro";
        this.currencySymbol = data.currencySymbol || data.currency || "€";
        this.currency = this.currencySymbol;

        this.industry = data.industry || data.category || "General Commercial";
        this.tagline = data.tagline || data.description || "";
        this.description = data.description || data.tagline || "Main";
        this.website = data.website || "";
        this.taxId = data.taxId || data.vatNumber || "";
        this.phone = data.phone || "";
        this.supportPhone = data.supportPhone || "";
        this.email = data.email || data.adminEmail || "";
        this.address = data.address || data.businessAddress || "";
        this.businessAddress = this.address;
        this.logoUrl = data.logoUrl || data.logo || "";
        this.logo = this.logoUrl;
        this.bannerUrl = data.bannerUrl || data.banner || "";
        this.banner = this.bannerUrl;
        this.adminEmail = data.adminEmail || data.email || "";
        this.adminName = data.adminName || "";
        this.adminId = data.adminId || generateWorkerId();
        
        // System Role & Role Tag
        this.role = data.role || "CREATOR_ADMIN";
        this.workspaceRole = data.workspaceRole !== undefined ? Number(data.workspaceRole) : getRoleLevel(data.role);
        this.roleTag = data.roleTag || data.customTag || (this.workspaceRole === 0 ? "Founder" : "Administrator");
        this.workspaceStatus = data.workspaceStatus || "Active";
        
        this.createdAt = Number(data.createdAt) || Date.now();
        this.workersCount = Number(data.workersCount) || 0;
        this.adminProductCount = Number(data.adminProductCount) || 0;
        this.adminInvoiceCount = Number(data.adminInvoiceCount) || 0;
        this.adminCategoryCount = Number(data.adminCategoryCount) || 0;
        this.adminBusinessCount = Number(data.adminBusinessCount) || 0;
        this.adminClientCount = Number(data.adminClientCount) || 0;
        this.adminTotalDeleted = Number(data.adminTotalDeleted) || 0;
        this.adminTotalDeletedCount = Number(data.adminTotalDeletedCount) || 0;
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

export class WorkspaceMember {
    constructor(data = {}) {
        this.membershipId = data.membershipId || generateUniqueId();
        this.workspaceId = data.workspaceId || "";
        this.userId = data.userId || data.workerUid || "";
        this.email = (data.email || "").toLowerCase();
        this.name = data.name || (this.email ? this.email.split('@')[0] : "Member");
        this.workspaceRole = data.workspaceRole !== undefined ? getRoleLevel(data.workspaceRole) : getRoleLevel(data.role || 3);
        const roleMeta = getRoleMeta(this.workspaceRole);
        this.role = roleMeta.id;
        this.roleTag = data.roleTag || data.customTag || roleMeta.defaultTag;
        this.membershipStatus = data.membershipStatus || data.status || "Joined";
        this.status = this.membershipStatus;
        this.isRestricted = Boolean(data.isRestricted);
        this.disableAdd = Boolean(data.disableAdd);
        this.disableUpdate = Boolean(data.disableUpdate);
        this.disableDelete = Boolean(data.disableDelete);
        this.canViewProfit = data.canViewProfit !== undefined ? Boolean(data.canViewProfit) : (this.workspaceRole <= 1);
        this.invitedBy = data.invitedBy || data.adminEmail || "";
        this.joinedAt = data.joinedAt || data.timestamp || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
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

