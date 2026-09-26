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

    if (data.isBusinessInvoice) {
        if (!data.businessId || typeof data.businessId !== 'string') {
            errors.push('Business ID is required for a Business Invoice.');
        }
    } else {
        if ((!data.customerName || typeof data.customerName !== 'string' || data.customerName.trim() === '') &&
            (!data.customerNumber || typeof data.customerNumber !== 'string' || data.customerNumber.trim() === '')) {
            errors.push('Customer Name or Number is required for a standard Customer Invoice.');
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
