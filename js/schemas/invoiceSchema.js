/**
 * invoiceSchema.js
 * Source of truth for Invoice validation.
 */
import { validateInvoiceItem } from './invoiceItemSchema.js';

export const validateInvoice = (data) => {
    const errors = [];

    if (data.isBusinessInvoice !== undefined && typeof data.isBusinessInvoice !== 'boolean') {
        errors.push('isBusinessInvoice must be a boolean.');
    }

    // Issuer Business is mandatory for both invoice types
    if (!data.businessId || typeof data.businessId !== 'string' || data.businessId.trim() === '') {
        errors.push('Issuer Business is required.');
    }

    if (data.isBusinessInvoice) {
        // 5 mandatory items for Business Invoice: Business*, Client*, Title*, Invoice Number*, At least one item*
        if (!data.clientId || typeof data.clientId !== 'string' || data.clientId.trim() === '') {
            errors.push('Client (Billed To) is required for a Business Invoice.');
        }
        if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
            errors.push('Invoice Title is required.');
        }
        const invNum = data.invoiceNumber || data.busInvNumber;
        if (!invNum || typeof invNum !== 'string' || invNum.trim() === '') {
            errors.push('Business Invoice Number is required.');
        }
    } else {
        // 3 mandatory items for Customer Invoice: Business*, Customer Name*, At least one item*
        if (!data.customerName || typeof data.customerName !== 'string' || data.customerName.trim() === '') {
            errors.push('Customer Name is required.');
        }
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
        errors.push('Invoice must contain at least one item.');
    } else {
        data.items.forEach((item, index) => {
            try {
                validateInvoiceItem(item);
            } catch (err) {
                errors.push(`Item ${index + 1}: ${err.message}`);
            }
        });
    }

    // Number fields validation
    if (data.discountPercent !== undefined && (typeof data.discountPercent !== 'number' || data.discountPercent < 0 || data.discountPercent > 100)) {
        errors.push('Discount Percent must be a number between 0 and 100.');
    }
    if (data.additionalCut !== undefined && (typeof data.additionalCut !== 'number' || data.additionalCut < 0)) {
        errors.push('Additional Cut must be a valid non-negative number.');
    }
    if (data.taxPercent !== undefined && (typeof data.taxPercent !== 'number' || data.taxPercent < 0 || data.taxPercent > 100)) {
        errors.push('Tax Percent must be a number between 0 and 100.');
    }
    if (data.shippingCost !== undefined && (typeof data.shippingCost !== 'number' || data.shippingCost < 0)) {
        errors.push('Shipping Cost must be a valid non-negative number.');
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
