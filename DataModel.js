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

export class WorkspaceInfo {
    constructor(data = {}) {
        this.workspaceId = data.workspaceId || generateWorkspaceId();
        this.name = data.name || "";
        this.description = data.description || "Main";
        this.adminEmail = data.adminEmail || "";
        this.adminName = data.adminName || "";
        this.adminId = data.adminId || generateWorkerId();
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
