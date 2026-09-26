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
        window.dispatchEvent(new CustomEvent('pricelister-currency-changed', { detail: { currency: clean } }));
        return clean;
    } catch (e) {
        return '$';
    }
};

export const formatCurrency = (amount, customSymbol = null) => {
    const sym = (customSymbol !== null ? customSymbol : getAppCurrencySymbol()).trim().substring(0, 3) || '$';
    const num = Number(amount) || 0;
    const formattedNum = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
    return `${sym}${separator}${formattedNum}`;
};

export const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(new Date(timestamp));
};
