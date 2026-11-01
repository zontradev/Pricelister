/**
 * orderSchema.js
 * Source of truth for Customer Order validation.
 */

export const validateOrder = (data) => {
    const errors = [];

    if (!data.customerName || typeof data.customerName !== 'string' || data.customerName.trim().length < 2) {
        errors.push('Customer Name is required (minimum 2 characters).');
    }

    if (!data.customerPhone || typeof data.customerPhone !== 'string' || data.customerPhone.trim().length < 5) {
        errors.push('Customer Phone is required (minimum 5 digits).');
    }

    if (!data.customerAddress || typeof data.customerAddress !== 'string' || data.customerAddress.trim().length < 3) {
        errors.push('Delivery Address is required.');
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
        errors.push('Order must contain at least one product.');
    } else {
        data.items.forEach((item, index) => {
            if (!item.productName || typeof item.productName !== 'string' || item.productName.trim() === '') {
                errors.push(`Item #${index + 1}: Product name is required.`);
            }
            if (item.quantity === undefined || typeof item.quantity !== 'number' || item.quantity <= 0) {
                errors.push(`Item #${index + 1}: Quantity must be a positive number.`);
            }
            if (item.unitPrice === undefined || typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
                errors.push(`Item #${index + 1}: Unit price must be a non-negative number.`);
            }
        });
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
