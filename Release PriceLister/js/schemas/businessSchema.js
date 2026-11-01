/**
 * businessSchema.js
 * Source of truth for Business validation.
 */
export const validateBusiness = (data) => {
    const errors = [];

    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Business Name is required.');
    }

    // Optional fields
    if (data.phone && typeof data.phone !== 'string') errors.push('Business Phone must be text.');
    if (data.email && typeof data.email !== 'string') errors.push('Business Email must be text.');
    if (data.address && typeof data.address !== 'string') errors.push('Business Address must be text.');

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
