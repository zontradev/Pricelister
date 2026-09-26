/**
 * Application Utilities
 */

export const generateUniqueId = (prefix = 'ID') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now().toString(36)}`;
};

export const getAppCurrencySymbol = () => {
    try {
        return (localStorage.getItem('pricelister_currency_symbol') || '$').substring(0, 3);
    } catch (e) {
        return '$';
    }
};

export const setAppCurrencySymbol = (symbol) => {
    try {
        const clean = (symbol || '$').trim().substring(0, 3) || '$';
        localStorage.setItem('pricelister_currency_symbol', clean);
        return clean;
    } catch (e) {
        return '$';
    }
};

export const formatCurrency = (amount, customSymbol = null) => {
    const sym = customSymbol !== null ? customSymbol.substring(0, 3) : getAppCurrencySymbol();
    const num = Number(amount) || 0;
    return `${sym} ${num.toFixed(2)}`;
};

export const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(timestamp));
};
