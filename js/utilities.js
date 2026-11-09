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

/**
 * Normalizes input date strings into the required standard DD-MM-YYYY format.
 * Prevents YYYY-MM-DD from ever reaching Firestore, eliminating Android crash vectors.
 * Accepts:
 *   - DD-MM-YYYY or DD/MM/YYYY
 *   - MM-DD-YYYY or MM/DD/YYYY
 *   - YYYY-MM-DD or YYYY/MM/DD (automatically reordered to DD-MM-YYYY)
 *   - Date objects
 */
export const normalizeProductDate = (raw) => {
    if (!raw) return '';
    const str = String(raw).trim();
    if (!str) return '';

    // If YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
        const y = isoMatch[1];
        const m = String(isoMatch[2]).padStart(2, '0');
        const d = String(isoMatch[3]).padStart(2, '0');
        return `${d}-${m}-${y}`;
    }

    // If DD-MM-YYYY or MM-DD-YYYY with hyphen or slash or dot
    const partMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (partMatch) {
        let p1 = String(partMatch[1]).padStart(2, '0');
        let p2 = String(partMatch[2]).padStart(2, '0');
        const y = partMatch[3];
        // Standardize to DD-MM-YYYY with hyphens
        return `${p1}-${p2}-${y}`;
    }

    // Attempt Date object parsing
    try {
        const dObj = new Date(str);
        if (!isNaN(dObj.getTime())) {
            const d = String(dObj.getDate()).padStart(2, '0');
            const m = String(dObj.getMonth() + 1).padStart(2, '0');
            const y = dObj.getFullYear();
            return `${d}-${m}-${y}`;
        }
    } catch (e) {}

    // Fallback: replace any slashes/dots with hyphens
    return str.replace(/[/.]/g, '-');
};

/**
 * Parses any date format (DD-MM-YYYY, MM-DD-YYYY, or legacy YYYY-MM-DD) into a valid JS Date.
 */
export const parseProductDate = (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;

    // Check DD-MM-YYYY or MM-DD-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
        const n1 = parseInt(dmyMatch[1], 10);
        const n2 = parseInt(dmyMatch[2], 10);
        const y = parseInt(dmyMatch[3], 10);

        // If n1 > 12, it is definitely DD-MM-YYYY (day is n1)
        if (n1 > 12 && n2 <= 12) {
            return new Date(y, n2 - 1, n1);
        }
        // If n2 > 12, it is MM-DD-YYYY (month is n1, day is n2)
        if (n2 > 12 && n1 <= 12) {
            return new Date(y, n1 - 1, n2);
        }
        // Default treat as DD-MM-YYYY (standard international order)
        return new Date(y, n2 - 1, n1);
    }

    // Check YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
        const y = parseInt(ymdMatch[1], 10);
        const m = parseInt(ymdMatch[2], 10);
        const d = parseInt(ymdMatch[3], 10);
        return new Date(y, m - 1, d);
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
};



