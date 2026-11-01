/**
 * clientSchema.js
 * Source of truth for Client validation.
 */
export const validateClient = (data) => {
    const errors = [];

    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Client Name is required.');
    }

    if (data.isClient !== undefined && typeof data.isClient !== 'boolean') {
        errors.push('isClient must be a boolean.');
    }

    // Optional fields
    if (data.phone && typeof data.phone !== 'string') errors.push('Phone must be text.');
    if (data.email && typeof data.email !== 'string') errors.push('Email must be text.');
    if (data.address && typeof data.address !== 'string') errors.push('Address must be text.');

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
