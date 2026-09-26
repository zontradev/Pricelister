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

export class Invoice {
    constructor(data = {}) {
        this.additionalCut = data.additionalCut || 0.0;
        this.businessAddress = data.businessAddress || "";
        this.businessEmail = data.businessEmail || "";
        this.businessId = data.businessId || "";
        this.businessName = data.businessName || "";
        this.businessPhone = data.businessPhone || "";
        this.clientId = data.clientId || "";
        this.creatorId = data.creatorId || "";
        this.customerName = data.customerName || "";
        this.customerNumber = data.customerNumber || "";
        this.discountPercent = data.discountPercent || 0.0;
        this.invoiceNumber = data.invoiceNumber || "";
        this.isBusinessInvoice = data.isBusinessInvoice !== undefined ? data.isBusinessInvoice : false;
        this.items = data.items || []; // Array of InvoiceItem
        this.status = data.status || "Draft"; // Ensure Title Case like Android ("Paid", "Draft")
        this.timestamp = data.timestamp || Date.now();
        this.totalPrice = data.totalPrice || 0.0;
        this.totalProfit = data.totalProfit || 0.0;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
        
        if (this.isBusinessInvoice) {
            this.busInvNumber = data.busInvNumber || "";
            this.clientAddress = data.clientAddress || "";
            this.clientEmail = data.clientEmail || "";
            this.clientPhone = data.clientPhone || "";
            this.note = data.note || "";
            this.shippingCost = data.shippingCost || 0.0;
            this.taxPercent = data.taxPercent || 0.0;
            this.title = data.title || "Invoice";
        }
    }
}

export class InvoiceItem {
    constructor(data = {}) {
        this.productId = data.productId || null;
        this.productName = data.productName || "";
        this.quantity = data.quantity || 1;
        this.unitPrice = data.unitPrice || 0.0;
        this.totalPrice = data.totalPrice || 0.0;
        this.unitCost = data.unitCost || 0.0; // Crucial: explicitly store unit cost
        this.itemProfit = data.itemProfit || 0.0; // Crucial: explicitly store item profit
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
        this.id = data.id || null;
        this.uniqueId = data.uniqueId || generateInvoiceUniqueId();
        this.name = data.name || "";
        this.address = data.address || "";
        this.phone = data.phone || "";
        this.email = data.email || "";
        this.timestamp = data.timestamp || Date.now();
        this.updatedTimestamp = data.updatedTimestamp || Date.now();
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
