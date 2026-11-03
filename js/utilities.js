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

export const formatExactTimestamp = (val) => {
    if (!val) return 'N/A';
    const date = (typeof val?.toDate === 'function') ? val.toDate() : new Date(val);
    if (isNaN(date.getTime())) return String(val);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'long' });
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${day} (${month}) ${year} ${hours}:${minutes} ${ampm}`;
};

export const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};


