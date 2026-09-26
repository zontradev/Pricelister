/**
 * categorySchema.js
 * Source of truth for Category validation.
 */
export const validateCategory = (data, existingCategories, isUpdate = false) => {
    const errors = [];

    // Required fields
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Category Name is required.');
    } else if (data.name.trim().length > 100) {
        errors.push('Category Name is too long.');
    }

    if (data.color && typeof data.color !== 'string') {
        errors.push('Color must be text.');
    }

    if (existingCategories) {
        const nameLower = data.name.trim().toLowerCase();
        const isDuplicate = existingCategories.some(cat => 
            cat.name.toLowerCase() === nameLower && (!isUpdate || cat.uniqueId !== data.uniqueId)
        );
        
        if (isDuplicate) {
            errors.push('A category with this name already exists.');
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
