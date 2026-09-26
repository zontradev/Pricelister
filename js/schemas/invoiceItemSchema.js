/**
 * invoiceItemSchema.js
 * Source of truth for InvoiceItem validation.
 */
export const validateInvoiceItem = (data) => {
    const errors = [];

    // Required fields
    if (!data.productId || typeof data.productId !== 'string') {
        // Note: Android source used Integer, but web port uses string UUIDs. 
        // This is a documented web compatibility migration.
        errors.push('Product ID is required and must be a valid string.');
    }
    
    if (data.productName === undefined || data.productName === null || typeof data.productName !== 'string') {
        errors.push('Product Name snapshot is required.');
    }

    if (data.quantity === undefined || data.quantity === null || typeof data.quantity !== 'number' || data.quantity <= 0) {
        errors.push('Item quantity must be a positive number.');
    }

    if (data.unitPrice === undefined || data.unitPrice === null || typeof data.unitPrice !== 'number' || data.unitPrice < 0) {
        errors.push('Unit Price must be a valid non-negative number.');
    }

    // Calculated fields check (optional strictness: ensure they exist)
    if (data.totalPrice !== undefined && typeof data.totalPrice !== 'number') {
        errors.push('Total Price must be a number.');
    }
    
    if (data.unitCost !== undefined && typeof data.unitCost !== 'number') {
        errors.push('Unit Cost must be a number.');
    }

    if (data.itemProfit !== undefined && typeof data.itemProfit !== 'number') {
        errors.push('Item Profit must be a number.');
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
