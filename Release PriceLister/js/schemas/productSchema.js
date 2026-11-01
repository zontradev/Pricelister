/**
 * productSchema.js
 * Source of truth for Product validation.
 */
export const validateProduct = (data) => {
    const errors = [];

    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Product Name is required.');
    }
    if (data.salePrice === undefined || data.salePrice === null || typeof data.salePrice !== 'number' || data.salePrice < 0) {
        errors.push('Sale Price must be a valid non-negative number.');
    }
    if (!data.category || data.category.trim() === '') {
        errors.push('Category is required.');
    }
    if (data.quantity !== undefined && data.quantity !== null && (typeof data.quantity !== 'number' || data.quantity < 0 || !Number.isInteger(data.quantity))) {
        errors.push('Quantity must be a valid non-negative integer.');
    }

    // Optional Price fields
    if (data.price !== undefined && data.price !== null && (typeof data.price !== 'number' || data.price < 0)) {
        errors.push('Cost Price must be a valid non-negative number.');
    }
    if (data.basePrice !== undefined && data.basePrice !== null && (typeof data.basePrice !== 'number' || data.basePrice < 0)) {
        errors.push('Base Price must be a valid non-negative number.');
    }
    if (data.mrp !== undefined && data.mrp !== null && (typeof data.mrp !== 'number' || data.mrp < 0)) {
        errors.push('MRP must be a valid non-negative number.');
    }

    // Optional string fields
    if (data.sizeWeight && typeof data.sizeWeight !== 'string') errors.push('Size/Weight must be text.');
    if (data.mfgDate && typeof data.mfgDate !== 'string') errors.push('Manufacturing Date must be text.');
    if (data.expDate && typeof data.expDate !== 'string') errors.push('Expiration Date must be text.');
    if (data.note && typeof data.note !== 'string') errors.push('Note must be text.');
    if (data.upcCode && typeof data.upcCode !== 'string') errors.push('UPC Code must be text.');
    if (data.color && typeof data.color !== 'string') errors.push('Color must be text.');

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
