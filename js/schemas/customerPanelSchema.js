/**
 * customerPanelSchema.js
 * Source of truth for Customer Panel Settings & Configuration.
 */

export const VALID_DEPLOY_COUNTRIES = [
    'Global',
    'United States',
    'Bangladesh',
    'India',
    'Canada',
    'United Kingdom',
    'Australia',
    'Germany',
    'France',
    'United Arab Emirates',
    'Saudi Arabia',
    'Singapore',
    'Malaysia',
    'Japan',
    'Italy',
    'Spain',
    'Brazil',
    'Mexico',
    'Netherlands',
    'South Africa',
    'Pakistan',
    'Indonesia',
    'Turkey',
    'Sweden',
    'Switzerland',
    'Qatar'
];

export const VALID_BRANDING_MODES = ['PRICELISTER', 'CUSTOM', 'WORKSPACE'];

export const validateCustomerPanelSettings = (data) => {
    const errors = [];

    if (data.storeName && typeof data.storeName === 'string' && data.storeName.trim().length === 0) {
        errors.push('Store Title cannot be empty.');
    }

    if (data.brandingMode && !VALID_BRANDING_MODES.includes(data.brandingMode)) {
        errors.push(`Branding mode must be one of: ${VALID_BRANDING_MODES.join(', ')}.`);
    }

    if (data.deployCountry && !VALID_DEPLOY_COUNTRIES.includes(data.deployCountry)) {
        errors.push('Please select a valid deploy country from the supported list.');
    }

    if (data.customSlug && typeof data.customSlug === 'string') {
        const sanitized = data.customSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
        if (data.customSlug.trim() !== '' && sanitized.length < 2) {
            errors.push('Custom link slug must be at least 2 characters long.');
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join(' '));
    }

    return true;
};
