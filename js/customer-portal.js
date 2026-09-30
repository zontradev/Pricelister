/**
 * PriceLister - Customer Portal Client Controller
 * Standalone catalog, real-time search, category filtering, and shopping cart engine.
 */

import { getFirestore, doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../firebase/firebase-config.js';
import { getProductService } from './services/productService.js';
import { getCategoryService } from './services/categoryService.js';
import { getOrderService } from './services/orderService.js';

const db = getFirestore(firebaseApp);

let currentWorkspaceId = null;
let storeSettings = {};
let allProducts = [];
let filteredProducts = [];
let categoriesList = [];
let activeCategory = 'ALL';
let currentSearchQuery = '';
let cart = {}; // { productId: { product, quantity } }
let activeCustomerRegion = null; // { code, name, flag, iso, currencyCode, symbol }

export const COUNTRY_CURRENCY_DIRECTORY = [
    { code: 'BD', name: 'Bangladesh', iso: 'bd', currencyCode: 'BDT', symbol: '৳', timezones: ['Asia/Dhaka'], languages: ['bn', 'bn-BD'] },
    { code: 'US', name: 'United States', iso: 'us', currencyCode: 'USD', symbol: '$', timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'America/Honolulu', 'America/Phoenix', 'America/Detroit', 'America/Indiana', 'America/Boise'], languages: ['en-US', 'en'] },
    { code: 'IN', name: 'India', iso: 'in', currencyCode: 'INR', symbol: '₹', timezones: ['Asia/Kolkata', 'Asia/Calcutta'], languages: ['hi', 'en-IN', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'] },
    { code: 'CA', name: 'Canada', iso: 'ca', currencyCode: 'CAD', symbol: 'CA$', timezones: ['America/Toronto', 'America/Vancouver', 'America/Montreal', 'America/Edmonton', 'America/Winnipeg', 'America/Halifax', 'America/St_Johns'], languages: ['en-CA', 'fr-CA'] },
    { code: 'GB', name: 'United Kingdom', iso: 'gb', currencyCode: 'GBP', symbol: '£', timezones: ['Europe/London', 'Europe/Belfast'], languages: ['en-GB'] },
    { code: 'AU', name: 'Australia', iso: 'au', currencyCode: 'AUD', symbol: 'AU$', timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Hobart', 'Australia/Darwin'], languages: ['en-AU'] },
    { code: 'DE', name: 'Germany', iso: 'de', currencyCode: 'EUR', symbol: '€', timezones: ['Europe/Berlin'], languages: ['de', 'de-DE'] },
    { code: 'FR', name: 'France', iso: 'fr', currencyCode: 'EUR', symbol: '€', timezones: ['Europe/Paris'], languages: ['fr', 'fr-FR'] },
    { code: 'AE', name: 'United Arab Emirates', iso: 'ae', currencyCode: 'AED', symbol: 'د.إ', timezones: ['Asia/Dubai'], languages: ['ar-AE', 'ar'] },
    { code: 'SA', name: 'Saudi Arabia', iso: 'sa', currencyCode: 'SAR', symbol: '﷼', timezones: ['Asia/Riyadh'], languages: ['ar-SA'] },
    { code: 'SG', name: 'Singapore', iso: 'sg', currencyCode: 'SGD', symbol: 'S$', timezones: ['Asia/Singapore'], languages: ['en-SG', 'zh-SG', 'ms-SG', 'ta-SG'] },
    { code: 'MY', name: 'Malaysia', iso: 'my', currencyCode: 'MYR', symbol: 'RM', timezones: ['Asia/Kuala_Lumpur', 'Asia/Kuching'], languages: ['ms', 'ms-MY', 'zh-MY', 'en-MY'] },
    { code: 'JP', name: 'Japan', iso: 'jp', currencyCode: 'JPY', symbol: '¥', timezones: ['Asia/Tokyo'], languages: ['ja', 'ja-JP'] },
    { code: 'IT', name: 'Italy', iso: 'it', currencyCode: 'EUR', symbol: '€', timezones: ['Europe/Rome'], languages: ['it', 'it-IT'] },
    { code: 'ES', name: 'Spain', iso: 'es', currencyCode: 'EUR', symbol: '€', timezones: ['Europe/Madrid', 'Atlantic/Canary'], languages: ['es', 'es-ES'] },
    { code: 'BR', name: 'Brazil', iso: 'br', currencyCode: 'BRL', symbol: 'R$', timezones: ['America/Sao_Paulo', 'America/Rio_Branco', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Recife', 'America/Cuiaba'], languages: ['pt-BR', 'pt'] },
    { code: 'MX', name: 'Mexico', iso: 'mx', currencyCode: 'MXN', symbol: 'MX$', timezones: ['America/Mexico_City', 'America/Cancun', 'America/Monterrey', 'America/Tijuana', 'America/Chihuahua', 'America/Hermosillo', 'America/Mazatlan'], languages: ['es-MX'] },
    { code: 'NL', name: 'Netherlands', iso: 'nl', currencyCode: 'EUR', symbol: '€', timezones: ['Europe/Amsterdam'], languages: ['nl', 'nl-NL'] },
    { code: 'ZA', name: 'South Africa', iso: 'za', currencyCode: 'ZAR', symbol: 'R', timezones: ['Africa/Johannesburg'], languages: ['en-ZA', 'af'] },
    { code: 'PK', name: 'Pakistan', iso: 'pk', currencyCode: 'PKR', symbol: '₨', timezones: ['Asia/Karachi'], languages: ['ur', 'ur-PK', 'en-PK'] },
    { code: 'ID', name: 'Indonesia', iso: 'id', currencyCode: 'IDR', symbol: 'Rp', timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak'], languages: ['id', 'id-ID'] },
    { code: 'TR', name: 'Turkey', iso: 'tr', currencyCode: 'TRY', symbol: '₺', timezones: ['Europe/Istanbul', 'Asia/Istanbul'], languages: ['tr', 'tr-TR'] },
    { code: 'SE', name: 'Sweden', iso: 'se', currencyCode: 'SEK', symbol: 'kr', timezones: ['Europe/Stockholm'], languages: ['sv', 'sv-SE'] },
    { code: 'CH', name: 'Switzerland', iso: 'ch', currencyCode: 'CHF', symbol: 'CHF', timezones: ['Europe/Zurich'], languages: ['de-CH', 'fr-CH', 'it-CH'] },
    { code: 'QA', name: 'Qatar', iso: 'qa', currencyCode: 'QAR', symbol: '﷼', timezones: ['Asia/Qatar'], languages: ['ar-QA'] }
];

/**
 * Smart Regional Currency Resolver
 * Evaluates customer origin against Store Launch countries (Global or specific country subset).
 * E.g. Customer in Bangladesh sees ৳, USA customer sees $, etc.
 */
const resolveCustomerRegionAndCurrency = (settings) => {
    const urlParams = new URLSearchParams(window.location.search);
    const countryParam = (urlParams.get('country') || urlParams.get('region') || urlParams.get('geo') || '').trim().toLowerCase();
    const currencyParam = (urlParams.get('currency') || urlParams.get('curr') || '').trim();
    const savedCountry = (localStorage.getItem(`pricelister_customer_selected_country_${currentWorkspaceId}`) || localStorage.getItem('pricelister_customer_selected_country') || '').trim().toLowerCase();

    // 1. Determine Deployed Countries
    let storeCountries = [];
    if (Array.isArray(settings.deployCountries) && settings.deployCountries.length > 0) {
        storeCountries = settings.deployCountries;
    } else if (settings.deployCountry) {
        storeCountries = [settings.deployCountry];
    } else {
        storeCountries = ['Global'];
    }

    const isGlobalDeploy = storeCountries.includes('Global') || storeCountries.includes('GLOBAL') || storeCountries.includes('global');

    // Helper: is country allowed
    const isCountryAllowed = (countryObj) => {
        if (!countryObj) return false;
        if (isGlobalDeploy) return true;
        return storeCountries.some(c => {
            const clean = String(c || '').trim().toLowerCase();
            return clean === countryObj.name.toLowerCase() || 
                   clean === countryObj.code.toLowerCase() || 
                   clean === countryObj.iso.toLowerCase() ||
                   (clean === 'usa' && countryObj.code === 'US') ||
                   (clean === 'uk' && countryObj.code === 'GB');
        });
    };

    // 2. Candidate Detection:
    let detectedObj = null;

    // A. URL Currency Param (?currency=BDT or ?currency=৳)
    if (currencyParam) {
        detectedObj = COUNTRY_CURRENCY_DIRECTORY.find(c => 
            c.currencyCode.toLowerCase() === currencyParam.toLowerCase() || 
            c.symbol === currencyParam
        );
    }

    // B. URL Country Param (?country=bd or ?country=bangladesh or ?country=us)
    if (!detectedObj && countryParam) {
        detectedObj = COUNTRY_CURRENCY_DIRECTORY.find(c => 
            c.name.toLowerCase() === countryParam || 
            c.code.toLowerCase() === countryParam || 
            c.iso.toLowerCase() === countryParam ||
            (countryParam === 'usa' && c.code === 'US') ||
            (countryParam === 'uk' && c.code === 'GB')
        );
    }

    // C. User Saved Selection in LocalStorage
    if (!detectedObj && savedCountry) {
        detectedObj = COUNTRY_CURRENCY_DIRECTORY.find(c => 
            c.name.toLowerCase() === savedCountry || 
            c.code.toLowerCase() === savedCountry || 
            c.iso.toLowerCase() === savedCountry
        );
    }

    // D. Auto Detect via Timezone
    if (!detectedObj) {
        try {
            const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            if (userTz) {
                detectedObj = COUNTRY_CURRENCY_DIRECTORY.find(c => 
                    (c.timezones || []).some(tz => userTz === tz || userTz.startsWith(tz) || tz.startsWith(userTz))
                );
            }
        } catch (e) {}
    }

    // E. Auto Detect via Browser Languages
    if (!detectedObj) {
        try {
            const navLangs = navigator.languages || [navigator.language || ''];
            for (const lang of navLangs) {
                if (!lang) continue;
                const cleanLang = lang.trim().toLowerCase();
                detectedObj = COUNTRY_CURRENCY_DIRECTORY.find(c => 
                    (c.languages || []).some(l => l.toLowerCase() === cleanLang || cleanLang.startsWith(l.toLowerCase()))
                );
                if (detectedObj) break;
            }
        } catch (e) {}
    }

    // 3. Fallback Selection
    const allowedList = COUNTRY_CURRENCY_DIRECTORY.filter(c => isCountryAllowed(c));

    let finalRegion = null;
    if (detectedObj && isCountryAllowed(detectedObj)) {
        finalRegion = detectedObj;
    } else if (allowedList.length > 0) {
        finalRegion = allowedList[0];
    } else {
        // Fallback default
        finalRegion = COUNTRY_CURRENCY_DIRECTORY.find(c => c.code === 'US') || {
            code: 'US',
            name: 'United States',
            iso: 'us',
            currencyCode: 'USD',
            symbol: settings.currencySymbol || '$'
        };
    }

    activeCustomerRegion = finalRegion;
    settings.currencySymbol = finalRegion.symbol;
    return finalRegion;
};

export const BENCHMARK_EXCHANGE_RATES = {
    'US': { rate: 1.00, currency: 'USD', symbol: '$' },
    'BD': { rate: 120.00, currency: 'BDT', symbol: '৳' },
    'IN': { rate: 83.50, currency: 'INR', symbol: '₹' },
    'CA': { rate: 1.36, currency: 'CAD', symbol: 'CA$' },
    'GB': { rate: 0.79, currency: 'GBP', symbol: '£' },
    'AU': { rate: 1.52, currency: 'AUD', symbol: 'AU$' },
    'DE': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'FR': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'AE': { rate: 3.67, currency: 'AED', symbol: 'د.إ' },
    'SA': { rate: 3.75, currency: 'SAR', symbol: '﷼' },
    'SG': { rate: 1.35, currency: 'SGD', symbol: 'S$' },
    'MY': { rate: 4.70, currency: 'MYR', symbol: 'RM' },
    'JP': { rate: 155.00, currency: 'JPY', symbol: '¥' },
    'IT': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'ES': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'BR': { rate: 5.40, currency: 'BRL', symbol: 'R$' },
    'MX': { rate: 18.20, currency: 'MXN', symbol: 'MX$' },
    'NL': { rate: 0.92, currency: 'EUR', symbol: '€' },
    'ZA': { rate: 18.50, currency: 'ZAR', symbol: 'R' },
    'PK': { rate: 278.00, currency: 'PKR', symbol: '₨' },
    'ID': { rate: 16200.00, currency: 'IDR', symbol: 'Rp' },
    'TR': { rate: 32.50, currency: 'TRY', symbol: '₺' },
    'SE': { rate: 10.60, currency: 'SEK', symbol: 'kr' },
    'CH': { rate: 0.90, currency: 'CHF', symbol: 'CHF' },
    'QA': { rate: 3.64, currency: 'QAR', symbol: '﷼' }
};

/**
 * Dynamic Currency Converter
 * Converts base USD amount to active regional currency and applies regional tax
 */
export const convertPrice = (amountInUsd) => {
    const num = Number(amountInUsd) || 0;
    const regCode = (activeCustomerRegion?.code || 'US').toUpperCase();
    
    let rate = 1.0;
    let taxPct = 0;

    // Currency conversion is active if enabled or if non-USD country is active
    const isExchangeActive = storeSettings.currencyExchangeEnabled !== false;

    if (isExchangeActive) {
        taxPct = Math.max(0, Number(storeSettings.defaultTaxPct || 0));

        // 1. Check custom rates if configured by admin for this country
        if (storeSettings.customCountryRates && storeSettings.customCountryRates[regCode]) {
            const custom = storeSettings.customCountryRates[regCode];
            if (custom.rate !== undefined && Number(custom.rate) > 0) {
                rate = Number(custom.rate);
            }
            if (custom.taxPct !== undefined) {
                taxPct = Number(custom.taxPct);
            }
        } else if (BENCHMARK_EXCHANGE_RATES[regCode]) {
            rate = Number(BENCHMARK_EXCHANGE_RATES[regCode].rate) || 1.0;
        }
    }

    const converted = num * rate;
    const taxAmount = (converted * taxPct) / 100;
    const finalPrice = converted + taxAmount;

    return { converted, taxAmount, finalPrice, rate, taxPct };
};

/**
 * Direct formatter for amounts already in target currency
 */
export const formatCurrencyValue = (amount) => {
    const sym = (activeCustomerRegion?.symbol || storeSettings.currencySymbol || '$').trim();
    const val = Number(amount) || 0;
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
    return `${sym}${separator}${formatted}`;
};

// Helper for formatting USD prices into local currency
const formatPrice = (amount, isAlreadyConverted = false) => {
    if (isAlreadyConverted) {
        return formatCurrencyValue(amount);
    }
    const { finalPrice } = convertPrice(amount);
    return formatCurrencyValue(finalPrice);
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Initialize Customer Portal
 */
export const initCustomerPortal = async () => {
    try {
        // 1. Resolve Workspace ID or Custom Slug from URL or Storage
        const urlParams = new URLSearchParams(window.location.search);
        currentWorkspaceId = urlParams.get('ws') || urlParams.get('workspace') || urlParams.get('id');
        const customSlugParam = urlParams.get('shop') || urlParams.get('slug');

        if (!currentWorkspaceId && customSlugParam) {
            // Check known local workspace mapping
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('pricelister_customer_panel_')) {
                        const raw = localStorage.getItem(key);
                        if (raw && raw.includes(`"customSlug":"${customSlugParam.toLowerCase()}"`)) {
                            currentWorkspaceId = key.replace('pricelister_customer_panel_', '');
                            break;
                        }
                    }
                }
            } catch (e) {}
        }

        if (!currentWorkspaceId) {
            try {
                currentWorkspaceId = localStorage.getItem('pricelister_last_public_ws') || 
                                     localStorage.getItem('pricelister_active_workspace_id') ||
                                     localStorage.getItem('pricelister_last_workspace_id');
            } catch (e) {}
        }

        // Seamless fallback to demo/mock sandbox if accessed standalone
        if (!currentWorkspaceId) {
            currentWorkspaceId = 'ws_dev_mock';
        }

        // Save for convenient return
        try {
            localStorage.setItem('pricelister_last_public_ws', currentWorkspaceId);
        } catch (e) {}

        // Load Cart from LocalStorage
        loadCartFromStorage();

        // 2. Fetch Store Settings with Timeout Protection
        try {
            await loadStoreSettings();
        } catch (err) {
            console.warn("Could not load remote store settings, using fallback:", err);
        }

        // 3. If Store is explicitly Suspended / Stopped -> Render Temporary Closed
        if (storeSettings.enabled === false && storeSettings.isPublished === false) {
            renderTemporaryClosedState();
            return;
        }

        // 4. Fetch Products & Categories
        try {
            await loadProductsAndCategories();
        } catch (err) {
            console.warn("Could not load products:", err);
            allProducts = [];
            filteredProducts = [];
            categoriesList = [];
        }

        // 5. Render Main Customer Catalog
        renderCustomerCatalogUI();
    } catch (fatalErr) {
        console.error("Customer Portal Init Error:", fatalErr);
        renderErrorState("Could not load storefront. Please refresh the page or verify the store link.");
    }
};

/**
 * Load Store & Customer Panel Settings from Firestore with Timeout Protection
 */
const loadStoreSettings = async () => {
    // 3.5s timeout promise so page never hangs indefinitely
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 3500));

    const fetchPromise = (async () => {
        try {
            const subColRef = collection(db, 'Workspaces', currentWorkspaceId, 'CustomerPanel');
            const panelRef = doc(db, 'CustomerPanelSettings', currentWorkspaceId);
            const wsRef = doc(db, 'Workspaces', currentWorkspaceId);
            const receiptRef = doc(db, 'ReceiptData', currentWorkspaceId);

            const [subColSnap, panelSnap, wsSnap, receiptSnap] = await Promise.all([
                getDocs(subColRef).catch(() => null),
                getDoc(panelRef).catch(() => null),
                getDoc(wsRef).catch(() => null),
                getDoc(receiptRef).catch(() => null)
            ]);

            let subfieldData = null;
            if (subColSnap && !subColSnap.empty) {
                subfieldData = subColSnap.docs[0].data();
            }

            const panelData = panelSnap && panelSnap.exists() ? panelSnap.data() : {};
            const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};
            const receiptData = receiptSnap && receiptSnap.exists() ? receiptSnap.data() : {};
            const embeddedData = wsData.customerPanel || receiptData.customerPanel || {};

            return { subfieldData, panelData, wsData, receiptData, embeddedData };
        } catch (e) {
            console.warn("Remote settings fetch warning:", e);
            return {};
        }
    })();

    const remoteResult = await Promise.race([fetchPromise, timeoutPromise]);
    const { subfieldData = null, panelData = {}, wsData = {}, receiptData = {}, embeddedData = {} } = (remoteResult && typeof remoteResult === 'object') ? remoteResult : {};

    // Local storage cache fallback
    let localData = {};
    try {
        const raw = localStorage.getItem(`pricelister_customer_panel_${currentWorkspaceId}`);
        if (raw) localData = JSON.parse(raw) || {};
    } catch (e) {}

    const merged = { ...localData, ...embeddedData, ...panelData, ...(subfieldData || {}) };

    // Default to true if not explicitly set to false, or check published fields
    let isPublished = true;
    if (merged.isPublished !== undefined) {
        isPublished = Boolean(merged.isPublished);
    } else if (merged.enabled !== undefined) {
        isPublished = Boolean(merged.enabled);
    } else if (receiptData.customerPanelPublished !== undefined) {
        isPublished = Boolean(receiptData.customerPanelPublished);
    }

    const defaultAnnouncements = [
        'Welcome! Browse our catalog and add items to your cart.',
        'Welcome to our online demo catalog! Browse items and calculate total or place orders.',
        'Welcome to our online catalog! Browse items and add to cart to calculate total or order directly.',
        'Welcome to our online catalog!'
    ];
    const cleanAnnouncement = (merged.announcement && merged.announcement.trim() !== '' && !defaultAnnouncements.includes(merged.announcement.trim())) 
        ? merged.announcement.trim() 
        : '';

    const brandingMode = merged.brandingMode || 'PRICELISTER';
    let storeName = merged.storeName || wsData.name || receiptData["Shop Name"] || 'PriceLister Store';
    let storeSubtitle = merged.storeSubtitle || wsData.address || receiptData["Address / Subtitle"] || 'Published by PriceLister.';

    if (brandingMode === 'PRICELISTER') {
        storeName = 'Price Lister Store';
        storeSubtitle = 'Published by PriceLister.';
    }

    storeSettings = {
        enabled: isPublished,
        isPublished: isPublished,
        brandingMode: brandingMode,
        storeName: storeName,
        storeSubtitle: storeSubtitle,
        storeLogo: merged.storeLogo || '',
        storeBanner: merged.storeBanner || merged.bannerUrl || wsData.bannerUrl || receiptData["Banner Url"] || '',
        workspaceLogo: merged.workspaceLogo || wsData.logoUrl || wsData.imageUri || receiptData["Logo Url"] || '',
        customSlug: merged.customSlug || '',
        deployCountry: merged.deployCountry || 'Global',
        deployCountries: Array.isArray(merged.deployCountries) && merged.deployCountries.length > 0 ? merged.deployCountries : [merged.deployCountry || 'Global'],
        currencyExchangeEnabled: merged.currencyExchangeEnabled !== undefined ? Boolean(merged.currencyExchangeEnabled) : false,
        exchangeMode: merged.exchangeMode || 'AUTO_INTERNATIONAL',
        defaultTaxPct: Math.max(0, Number(merged.defaultTaxPct || 0)),
        customCountryRates: merged.customCountryRates || {},
        announcement: cleanAnnouncement,
        termsAndConditions: merged.termsAndConditions || '• Prices are subject to change without prior notice.\n• All orders are confirmed before dispatch.',
        categorySelectionMode: merged.categorySelectionMode || 'ALL',
        allowedCategories: Array.isArray(merged.allowedCategories) ? merged.allowedCategories : [],
        showMrp: merged.showMrp !== undefined ? Boolean(merged.showMrp) : true,
        showStockBadge: merged.showStockBadge !== undefined ? Boolean(merged.showStockBadge) : true,
        whatsappNumber: merged.whatsappNumber || wsData.phone || receiptData["Phone Number"] || '',
        facebookId: merged.facebookId || merged.facebookUrl || wsData.facebookId || '',
        phone: merged.phone || wsData.phone || receiptData["Phone Number"] || '',
        email: merged.email || wsData.email || '',
        address: merged.address || wsData.address || receiptData["Address / Subtitle"] || '',
        closedMessage: merged.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.',
        currencySymbol: merged.currencySymbol || wsData.currency || wsData.currencySymbol || receiptData["Currency"] || '$'
    };

    // Auto-detect Regional Currency (e.g. Bangladesh -> ৳, USA -> $) based on store launch rules
    resolveCustomerRegionAndCurrency(storeSettings);

    // Update Browser Document Title
    document.title = `${storeSettings.storeName} — Online Product Catalog`;
};

/**
 * Fetch Catalog Products & Extract Categories
 */
const loadProductsAndCategories = async () => {
    try {
        const prodService = getProductService(currentWorkspaceId);
        const catService = getCategoryService(currentWorkspaceId);

        let [itemsRaw, categoriesRaw] = await Promise.all([
            prodService.getAllActiveProducts().catch(() => []),
            catService.getAllCategories().catch(() => [])
        ]);

        // Fallback to direct collection query if service returned empty and workspace is remote
        if ((!itemsRaw || itemsRaw.length === 0) && currentWorkspaceId !== 'ws_dev_mock') {
            try {
                const productsRef = collection(db, `Workspaces/${currentWorkspaceId}/Products`);
                const querySnapshot = await getDocs(productsRef);
                itemsRaw = [];
                querySnapshot.forEach(docSnap => {
                    const d = docSnap.data();
                    if (!d.isArchive) itemsRaw.push({ id: docSnap.id, ...d });
                });
            } catch (e) {
                console.warn("Direct Firestore fallback error:", e);
            }
        }

        const items = [];
        const catMap = new Map();

        (itemsRaw || []).forEach(data => {
            if (!data.isArchive) {
                const resolvedSellingPrice = Number(
                    data.salePrice !== undefined ? data.salePrice : 
                    (data.sellingPrice !== undefined ? data.sellingPrice : (data.price || 0))
                );

                const resolvedStock = Number(
                    data.quantity !== undefined ? data.quantity : (data.stock !== undefined ? data.stock : 0)
                );

                let catName = data.category || 'General';
                if (categoriesRaw && Array.isArray(categoriesRaw)) {
                    const match = categoriesRaw.find(c => c.uniqueId === catName || c.id === catName || c.name === catName);
                    if (match) catName = match.name;
                }

                const prd = {
                    id: data.id || data.uniqueId,
                    uniqueId: data.uniqueId || data.id,
                    ...data,
                    name: data.name || 'Unnamed Product',
                    category: String(catName || 'General').trim(),
                    size: data.size || data.sizeWeight || '',
                    sizeWeight: data.sizeWeight || data.size || '',
                    sellingPrice: resolvedSellingPrice,
                    salePrice: resolvedSellingPrice,
                    price: resolvedSellingPrice,
                    mrp: Number(data.mrp || 0),
                    stock: resolvedStock,
                    quantity: resolvedStock,
                    imageUrl: data.imageUri || data.imageUrl || '',
                    imageUri: data.imageUri || data.imageUrl || '',
                    description: data.note || data.description || '',
                    note: data.note || data.description || '',
                    barcode: data.upcCode || data.barcode || data.sku || '',
                    upcCode: data.upcCode || data.barcode || data.sku || '',
                    variations: Array.isArray(data.variations) ? data.variations : []
                };
                items.push(prd);

                catMap.set(prd.category, (catMap.get(prd.category) || 0) + 1);
            }
        });

        // Apply allowed category filter if admin specified specific categories
        if (storeSettings.categorySelectionMode === 'SPECIFIC' && Array.isArray(storeSettings.allowedCategories) && storeSettings.allowedCategories.length > 0) {
            allProducts = items.filter(p => storeSettings.allowedCategories.includes(p.category));
        } else {
            allProducts = items;
        }

        // Build category list
        categoriesList = Array.from(catMap.keys()).map(name => ({
            name: name,
            count: catMap.get(name)
        }));

        filteredProducts = [...allProducts];
    } catch (err) {
        console.warn("Could not load products:", err);
        allProducts = [];
        filteredProducts = [];
        categoriesList = [];
    }
};

/**
 * LocalStorage Cart Management
 */
const loadCartFromStorage = () => {
    try {
        const raw = localStorage.getItem(`pricelister_customer_cart_${currentWorkspaceId}`);
        if (raw) {
            cart = JSON.parse(raw) || {};
        }
    } catch (e) {
        cart = {};
    }
};

const saveCartToStorage = () => {
    try {
        localStorage.setItem(`pricelister_customer_cart_${currentWorkspaceId}`, JSON.stringify(cart));
    } catch (e) {}
    updateCartHeaderBadge();
};

const getCartTotals = () => {
    let count = 0;
    let total = 0;

    Object.keys(cart).forEach(id => {
        const item = cart[id];
        const qty = item.quantity || 0;
        const rawPrice = Number(item.product.sellingPrice || item.product.salePrice || item.product.price || 0);
        const { finalPrice } = convertPrice(rawPrice);
        count += qty;
        total += (qty * finalPrice);
    });

    return { count, total };
};

/**
 * Render Main Catalog View
 */
const renderCustomerCatalogUI = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    const brandLogoSrc = (storeSettings.brandingMode === 'CUSTOM' && storeSettings.storeLogo)
        ? storeSettings.storeLogo
        : ((storeSettings.brandingMode === 'WORKSPACE' && storeSettings.workspaceLogo) ? storeSettings.workspaceLogo : 'pricelister_org.png');

    // Determine Deployed Countries for Target Range Banner
    let storeCountries = [];
    if (Array.isArray(storeSettings.deployCountries) && storeSettings.deployCountries.length > 0) {
        storeCountries = storeSettings.deployCountries;
    } else if (storeSettings.deployCountry) {
        storeCountries = [storeSettings.deployCountry];
    } else {
        storeCountries = ['Global'];
    }

    const isGlobalDeploy = storeCountries.includes('Global') || storeCountries.includes('GLOBAL') || storeCountries.includes('global');

    const allowedRegions = isGlobalDeploy 
        ? COUNTRY_CURRENCY_DIRECTORY 
        : COUNTRY_CURRENCY_DIRECTORY.filter(c => {
            return storeCountries.some(sc => {
                const clean = String(sc || '').trim().toLowerCase();
                return clean === c.name.toLowerCase() || 
                       clean === c.code.toLowerCase() || 
                       clean === c.iso.toLowerCase() ||
                       (clean === 'usa' && c.code === 'US') ||
                       (clean === 'uk' && c.code === 'GB');
            });
        });

    const activeRegCode = (activeCustomerRegion?.code || 'US').toUpperCase();

    const brandTagline = storeSettings.storeSubtitle || (storeSettings.brandingMode === 'PRICELISTER' 
        ? 'Published by PriceLister.' 
        : (storeSettings.brandingMode === 'WORKSPACE' ? 'Enterprise Storefront' : 'Online Storefront'));

    app.innerHTML = `
        <!-- HEADER -->
        <header class="cp-header">
            <div class="cp-header-inner">
                <a href="javascript:void(0)" class="cp-brand" id="cp-brand-link">
                    <div style="width:40px; height:40px; border-radius:10px; overflow:hidden; background:var(--surface-100); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid var(--border-color); box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                        <img src="${escapeHtml(brandLogoSrc)}" alt="Logo" class="cp-logo" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='pricelister_org.png';">
                    </div>
                    <div>
                        <div class="cp-store-name">${escapeHtml(storeSettings.storeName)}</div>
                        <div class="cp-store-tagline">${escapeHtml(brandTagline)}</div>
                    </div>
                </a>

                <!-- Search Input -->
                <div class="cp-search-wrapper">
                    <span class="cp-search-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </span>
                    <input type="text" id="cp-search-input" class="cp-search-input" placeholder="Search products, size, description, barcode..." autocomplete="off">
                    <button type="button" id="cp-clear-search-btn" class="cp-clear-search" title="Clear">✕</button>
                </div>

                <!-- Smart Region & Currency Selector Pill -->
                <button type="button" id="cp-open-region-btn" class="cp-region-pill" title="Selected Region & Currency: ${escapeHtml(activeCustomerRegion?.name || 'Store Region')} (${escapeHtml(activeCustomerRegion?.currencyCode || '')})">
                    <span>${activeCustomerRegion?.iso ? `<img src="https://flagcdn.com/w20/${activeCustomerRegion.iso}.png" width="16" height="11" style="vertical-align:middle; border-radius:2px;">` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`}</span>
                    <span>${escapeHtml(activeCustomerRegion?.symbol || '$')}</span>
                    <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${escapeHtml(activeCustomerRegion?.currencyCode || '')}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>

                <!-- Contact Store Trigger Button -->
                <button type="button" id="cp-open-contact-btn" class="cp-contact-btn" title="Contact store & inquiries">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    <span>Contact Store</span>
                </button>

                <!-- Shopping Cart Trigger Button -->
                <button type="button" id="cp-open-cart-btn" class="cp-cart-btn" title="View your shopping cart">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                    <span>Cart</span>
                    <span id="cp-header-cart-count" class="cp-cart-count-badge">0</span>
                    <span id="cp-header-cart-total" class="cp-cart-total-text">$0.00</span>
                </button>
            </div>
        </header>

        <!-- TARGET RANGE & REGION DISPATCH BAR -->
        <div class="cp-target-range-banner">
            <div class="cp-target-range-inner">
                <div class="cp-target-range-left">
                    <span style="display:inline-flex; align-items:center; color:var(--primary);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg></span>
                    <span style="font-weight:700; color:var(--text-primary); font-size:0.8rem;">
                        ${isGlobalDeploy ? 'Global Dispatch:' : `Target Delivery Range (${allowedRegions.length} Regions):`}
                    </span>
                    
                    ${isGlobalDeploy ? `
                        <span id="cp-target-global-summary" style="font-size:0.78rem; color:var(--text-secondary);">
                            Universal Worldwide Catalog • Converted for <strong>${escapeHtml(activeCustomerRegion?.name || 'Local Region')} (${escapeHtml(activeCustomerRegion?.symbol || '$')})</strong>
                        </span>
                    ` : `
                        <div class="cp-target-range-chips">
                            ${allowedRegions.map(r => {
                                const isSelected = activeRegCode === r.code;
                                return `
                                    <button type="button" class="cp-target-country-chip ${isSelected ? 'active' : ''}" data-code="${r.code}" title="Switch price & currency to ${escapeHtml(r.name)} (${escapeHtml(r.currencyCode)})">
                                        <span>${r.iso ? `<img src="https://flagcdn.com/w20/${r.iso}.png" width="16" height="11" style="vertical-align:middle; border-radius:2px;">` : `<span style="font-weight:700; font-size:0.75rem;">${r.code}</span>`}</span>
                                        <span>${escapeHtml(r.name)}</span>
                                        <span style="opacity:0.8; font-family:monospace;">(${escapeHtml(r.symbol)})</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <button type="button" id="cp-banner-change-region-btn" class="cp-target-change-btn">
                        <span style="display:inline-flex; align-items:center; gap:0.35rem;">Currency &amp; Rates (${escapeHtml(activeCustomerRegion?.symbol || '$')}) <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ANNOUNCEMENT BANNER -->
        ${storeSettings.announcement ? `
            <div class="cp-announcement-bar">
                <div class="cp-announcement-inner">
                    <div class="cp-announcement-text">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary); flex-shrink:0;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                        <span>${escapeHtml(storeSettings.announcement)}</span>
                    </div>
                    ${storeSettings.termsAndConditions ? `
                        <button type="button" id="cp-open-terms-btn" class="cp-terms-btn">Terms & Conditions</button>
                    ` : ''}
                </div>
            </div>
        ` : ''}

        <!-- STOREFRONT HERO BANNER (16:9 / 1920x1080 Aspect Compatible) -->
        ${storeSettings.storeBanner ? `
            <div class="cp-storefront-hero" style="max-width: 1280px; margin: 1rem auto 0 auto; padding: 0 1.25rem;">
                <div style="position:relative; border-radius: 18px; overflow: hidden; height: 220px; background: linear-gradient(180deg, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.85) 100%), url('${escapeHtml(storeSettings.storeBanner)}') center/cover no-repeat; display: flex; align-items: flex-end; padding: 1.75rem; color: #ffffff; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.12);">
                    <div style="display: flex; align-items: center; gap: 1.25rem; z-index: 2;">
                        <div style="width: 64px; height: 64px; border-radius: 14px; background: #ffffff; padding: 4px; box-shadow: 0 8px 20px rgba(0,0,0,0.25); flex-shrink: 0; overflow:hidden; border: 2px solid rgba(255,255,255,0.8);">
                            <img src="${escapeHtml(brandLogoSrc)}" alt="${escapeHtml(storeSettings.storeName)}" style="width:100%; height:100%; object-fit:contain;" onerror="this.src='pricelister_org.png';">
                        </div>
                        <div>
                            <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.02em; text-shadow: 0 2px 10px rgba(0,0,0,0.4);">${escapeHtml(storeSettings.storeName)}</h2>
                            <p style="margin: 0.25rem 0 0 0; font-size: 0.88rem; opacity: 0.95; color: #f8fafc; text-shadow: 0 1px 4px rgba(0,0,0,0.4);">${escapeHtml(brandTagline)}</p>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}

        <!-- CATEGORY HORIZONTAL FILTER -->
        <div class="cp-filter-bar-container">
            <div class="cp-filter-bar" id="cp-filter-bar">
                <button type="button" class="cp-cat-chip active" data-category="ALL">
                    All Items (${allProducts.length})
                </button>
                ${categoriesList.map(cat => `
                    <button type="button" class="cp-cat-chip" data-category="${escapeHtml(cat.name)}">
                        ${escapeHtml(cat.name)} (${cat.count})
                    </button>
                `).join('')}
            </div>
        </div>

        <!-- MAIN CATALOG CONTENT -->
        <main class="cp-main-container">
            <div class="cp-catalog-header">
                <div>
                    <h1 class="cp-catalog-title" id="cp-section-title">All Products</h1>
                </div>
                <div class="cp-product-count-label" id="cp-count-label">
                    Showing ${filteredProducts.length} items
                </div>
            </div>

            <!-- Product Cards Grid -->
            <div class="cp-products-grid" id="cp-products-grid">
                <!-- Injected dynamically -->
            </div>
        </main>

        <!-- SLIDE-OUT CART DRAWER -->
        <div class="cp-cart-overlay" id="cp-cart-overlay">
            <div class="cp-cart-drawer">
                <div class="cp-cart-header">
                    <div class="cp-cart-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                        <span>Your Shopping Cart</span>
                    </div>
                    <button type="button" id="cp-close-cart-btn" class="cp-cart-close-btn" title="Close cart">✕</button>
                </div>

                <div class="cp-cart-body" id="cp-cart-items-list">
                    <!-- Items rendered dynamically -->
                </div>

                <div class="cp-cart-footer">
                    <div class="cp-cart-summary-row">
                        <span>Total Items</span>
                        <strong id="cp-drawer-items-count">0 items</strong>
                    </div>
                    <div class="cp-cart-total-row">
                        <span>Total Amount</span>
                        <span id="cp-drawer-grand-total" style="color:var(--primary);">$0.00</span>
                    </div>

                    <!-- CUSTOMER CHECKOUT ORDER FORM -->
                    <div style="margin:0.85rem 0; background:var(--surface-50); border:1px solid var(--border-color); border-radius:10px; padding:0.85rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Customer Delivery Information</span>
                        
                        <div>
                            <input type="text" id="cp-checkout-name" placeholder="Full Name *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="tel" id="cp-checkout-phone" placeholder="Phone Number (e.g. 01700000000) *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="text" id="cp-checkout-address" placeholder="Delivery Address / City *" required class="form-control" style="height:36px; font-size:0.85rem; padding:0 0.75rem;">
                        </div>
                        <div>
                            <input type="text" id="cp-checkout-note" placeholder="Order Note / Landmark (Optional)" class="form-control" style="height:34px; font-size:0.82rem; padding:0 0.75rem;">
                        </div>
                    </div>

                    <div class="cp-cart-actions" style="display:flex; flex-direction:column; gap:0.5rem;">
                        <button type="button" id="cp-btn-place-order" class="cp-btn-place-order-red" title="Place order to server and WhatsApp automatically">
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span>PLACE ORDER</span>
                        </button>

                        ${storeSettings.whatsappNumber ? `
                            <button type="button" id="cp-btn-order-whatsapp" class="cp-btn-whatsapp-order" style="padding:0.6rem; font-size:0.85rem;" title="Send order via WhatsApp">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
                                Send Order via WhatsApp
                            </button>
                        ` : ''}
                        
                        <button type="button" id="cp-btn-print-slip" class="cp-btn-print-order" style="padding:0.55rem; font-size:0.82rem;" title="Download or print order slip">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                            Print / Download Estimate Slip
                        </button>
                    </div>

                    <button type="button" id="cp-btn-clear-cart" class="cp-btn-clear-cart" style="margin-top:0.4rem;">Clear Shopping Cart</button>
                </div>
            </div>
        </div>

        <!-- ORDER CONFIRMATION SLIP MODAL CONTAINER -->
        <div id="cp-order-slip-modal-container"></div>

        <!-- PRODUCT QUICK VIEW MODAL CONTAINER -->
        <div id="cp-quickview-modal-container"></div>

        <!-- TERMS & CONDITIONS MODAL CONTAINER -->
        <div id="cp-terms-modal-container"></div>
    `;

    // Attach Event Listeners
    setupCatalogEventListeners();

    // Render Initial Product Cards & Cart state
    renderProductCardsGrid();
    updateCartHeaderBadge();
};

/**
 * Render Product Cards in Grid
 */
const renderProductCardsGrid = () => {
    const grid = document.getElementById('cp-products-grid');
    const countLabel = document.getElementById('cp-count-label');
    if (!grid) return;

    if (countLabel) {
        countLabel.textContent = `Showing ${filteredProducts.length} items`;
    }

    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background:#ffffff; border-radius:12px; border:1px solid var(--border-color);">
                <div style="margin-bottom:0.75rem; color:var(--text-muted);">
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                </div>
                <h3 style="color:var(--text-primary); margin-bottom:0.35rem;">No Products Found</h3>
                <p style="color:var(--text-secondary); font-size:0.9rem;">Try adjusting your search or category filter.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filteredProducts.map(p => {
        const inCartQty = cart[p.id] ? cart[p.id].quantity : 0;
        const sellingPrice = Number(p.sellingPrice || p.price || 0);
        const mrp = Number(p.mrp || p.wholesalePrice || 0);
        const hasDiscount = storeSettings.showMrp && mrp > sellingPrice;
        const discountPct = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

        const isOutOfStock = typeof p.stock === 'number' && p.stock <= 0;
        const stockHtml = storeSettings.showStockBadge 
            ? `<div class="cp-card-stock-badge ${isOutOfStock ? 'cp-stock-out' : 'cp-stock-in'}">${isOutOfStock ? 'Out of Stock' : (typeof p.stock === 'number' ? `${p.stock} in stock` : 'In Stock')}</div>`
            : '';

        return `
            <div class="cp-product-card" data-id="${p.id}">
                ${hasDiscount ? `<div class="cp-card-badge-top cp-badge-discount">${discountPct}% OFF</div>` : ''}
                
                <div class="cp-card-image-wrap" onclick="window.cpOpenQuickView('${p.id}')">
                    ${p.imageUrl ? `
                        <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" class="cp-card-img" loading="lazy" onerror="this.src='pricelister_org.png';">
                    ` : `
                        <div class="cp-card-img-placeholder">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
                        </div>
                    `}
                </div>

                <div class="cp-card-body">
                    <div class="cp-card-meta-row">
                        <span class="cp-card-category">${escapeHtml(p.category || 'General')}</span>
                        ${p.size ? `<span class="cp-card-size">${escapeHtml(p.size)}</span>` : ''}
                    </div>

                    <h3 class="cp-card-title" onclick="window.cpOpenQuickView('${p.id}')" title="${escapeHtml(p.name)}">
                        ${escapeHtml(p.name)}
                    </h3>

                    ${p.description ? `
                        <p class="cp-card-description">${escapeHtml(p.description)}</p>
                    ` : ''}

                    <div class="cp-card-price-row">
                        <span class="cp-card-selling-price">${formatPrice(sellingPrice)}</span>
                        ${hasDiscount ? `<span class="cp-card-mrp">${formatPrice(mrp)}</span>` : ''}
                    </div>

                    ${stockHtml}

                    <!-- Action Button / Stepper -->
                    <div class="cp-card-action-container" id="card-action-${p.id}">
                        ${inCartQty > 0 ? `
                            <div class="cp-stepper-wrap">
                                <button type="button" class="cp-stepper-btn" onclick="window.cpUpdateQty('${p.id}', -1)">−</button>
                                <span class="cp-stepper-qty">${inCartQty}</span>
                                <button type="button" class="cp-stepper-btn" onclick="window.cpUpdateQty('${p.id}', 1)">+</button>
                            </div>
                        ` : `
                            <button type="button" class="cp-btn-add-cart" onclick="window.cpAddToCart('${p.id}')" ${isOutOfStock ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                Add to Cart
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Filter & Search Products
 */
const applyFilters = () => {
    const q = currentSearchQuery.trim().toLowerCase();

    filteredProducts = allProducts.filter(p => {
        // Category check
        if (activeCategory !== 'ALL' && p.category !== activeCategory) {
            return false;
        }

        // Search text check
        if (q) {
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const sizeMatch = (p.size || '').toLowerCase().includes(q);
            const descMatch = (p.description || '').toLowerCase().includes(q);
            const barcodeMatch = (p.barcode || p.sku || '').toLowerCase().includes(q);
            const catMatch = (p.category || '').toLowerCase().includes(q);
            return nameMatch || sizeMatch || descMatch || barcodeMatch || catMatch;
        }

        return true;
    });

    renderProductCardsGrid();
};

/**
 * Cart Operations (Attached to window for inline onclicks)
 */
window.cpAddToCart = (productId) => {
    const prd = allProducts.find(p => p.id === productId);
    if (!prd) return;

    if (!cart[productId]) {
        cart[productId] = {
            product: prd,
            quantity: 1
        };
    } else {
        cart[productId].quantity += 1;
    }

    saveCartToStorage();
    renderProductCardsGrid();
    renderCartDrawerList();
};

window.cpUpdateQty = (productId, delta) => {
    if (!cart[productId]) return;

    cart[productId].quantity += delta;
    if (cart[productId].quantity <= 0) {
        delete cart[productId];
    }

    saveCartToStorage();
    renderProductCardsGrid();
    renderCartDrawerList();
};

window.cpRemoveFromCart = (productId) => {
    if (cart[productId]) {
        delete cart[productId];
        saveCartToStorage();
        renderProductCardsGrid();
        renderCartDrawerList();
    }
};

/**
 * Update Header Cart Count & Price Badge
 */
const updateCartHeaderBadge = () => {
    const badge = document.getElementById('cp-header-cart-count');
    const totalEl = document.getElementById('cp-header-cart-total');
    const { count, total } = getCartTotals();

    if (badge) badge.textContent = count;
    if (totalEl) totalEl.textContent = formatCurrencyValue(total);
};

/**
 * Render Cart Items inside Drawer
 */
const renderCartDrawerList = () => {
    const list = document.getElementById('cp-cart-items-list');
    const itemsCountEl = document.getElementById('cp-drawer-items-count');
    const grandTotalEl = document.getElementById('cp-drawer-grand-total');
    if (!list) return;

    const items = Object.values(cart);
    const { count, total } = getCartTotals();

    if (itemsCountEl) itemsCountEl.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    if (grandTotalEl) grandTotalEl.textContent = formatCurrencyValue(total);

    if (items.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color:var(--text-muted);">
                <div style="width:56px; height:56px; border-radius:50%; background:var(--surface-100); display:inline-flex; align-items:center; justify-content:center; color:var(--text-muted); margin-bottom:0.75rem;">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                </div>
                <div style="font-weight:600; font-size:1rem; color:var(--text-primary); margin-bottom:0.25rem;">Your Cart is Empty</div>
                <p style="font-size:0.85rem;">Browse the catalog and add products to calculate your total.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = items.map(item => {
        const p = item.product;
        const qty = item.quantity;
        const price = Number(p.sellingPrice || p.price || 0);
        const subtotal = qty * price;

        return `
            <div class="cp-cart-item">
                <img src="${p.imageUrl ? escapeHtml(p.imageUrl) : 'pricelister_org.png'}" alt="${escapeHtml(p.name)}" class="cp-cart-item-img" onerror="this.src='pricelister_org.png';">
                
                <div class="cp-cart-item-info">
                    <div class="cp-cart-item-title">${escapeHtml(p.name)}</div>
                    <div class="cp-cart-item-price">${formatPrice(price)} each ${p.size ? `• ${escapeHtml(p.size)}` : ''}</div>
                    <div class="cp-cart-item-subtotal">${formatPrice(subtotal)}</div>
                </div>

                <div style="display:flex; align-items:center; gap:0.4rem;">
                    <div class="cp-stepper-wrap" style="width:84px; height:30px;">
                        <button type="button" class="cp-stepper-btn" style="width:24px; height:24px;" onclick="window.cpUpdateQty('${p.id}', -1)">−</button>
                        <span class="cp-stepper-qty" style="font-size:0.8rem;">${qty}</span>
                        <button type="button" class="cp-stepper-btn" style="width:24px; height:24px;" onclick="window.cpUpdateQty('${p.id}', 1)">+</button>
                    </div>

                    <button type="button" class="cp-cart-item-delete" onclick="window.cpRemoveFromCart('${p.id}')" title="Remove item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

/**
 * Event Listeners Setup
 */
const setupCatalogEventListeners = () => {
    // Search input
    const searchInput = document.getElementById('cp-search-input');
    const clearSearchBtn = document.getElementById('cp-clear-search-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchQuery = e.target.value;
            if (clearSearchBtn) clearSearchBtn.style.display = currentSearchQuery ? 'block' : 'none';
            applyFilters();
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                currentSearchQuery = '';
                clearSearchBtn.style.display = 'none';
                applyFilters();
                searchInput.focus();
            }
        });
    }

    // Category chips
    document.querySelectorAll('.cp-cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.cp-cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            activeCategory = chip.getAttribute('data-category') || 'ALL';
            const titleEl = document.getElementById('cp-section-title');
            if (titleEl) {
                titleEl.textContent = activeCategory === 'ALL' ? 'All Products' : activeCategory;
            }

            applyFilters();
        });
    });

    // Cart Drawer Open/Close
    const cartOverlay = document.getElementById('cp-cart-overlay');
    const openCartBtn = document.getElementById('cp-open-cart-btn');
    const closeCartBtn = document.getElementById('cp-close-cart-btn');

    if (openCartBtn && cartOverlay) {
        openCartBtn.addEventListener('click', () => {
            renderCartDrawerList();
            cartOverlay.classList.add('open');
        });
    }

    if (closeCartBtn && cartOverlay) {
        closeCartBtn.addEventListener('click', () => {
            cartOverlay.classList.remove('open');
        });
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', (e) => {
            if (e.target === cartOverlay) {
                cartOverlay.classList.remove('open');
            }
        });
    }

    // Clear Cart
    const clearCartBtn = document.getElementById('cp-btn-clear-cart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', () => {
            if (Object.keys(cart).length === 0) return;
            if (confirm("Are you sure you want to clear your shopping cart?")) {
                cart = {};
                saveCartToStorage();
                renderProductCardsGrid();
                renderCartDrawerList();
            }
        });
    }

    // Place Order Directly to Workspace
    const btnPlaceOrder = document.getElementById('cp-btn-place-order');
    if (btnPlaceOrder) {
        btnPlaceOrder.addEventListener('click', async () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Please add products before placing an order.");
                return;
            }

            const custName = (document.getElementById('cp-checkout-name')?.value || '').trim();
            const custPhone = (document.getElementById('cp-checkout-phone')?.value || '').trim();
            const custAddress = (document.getElementById('cp-checkout-address')?.value || '').trim();
            const custNote = (document.getElementById('cp-checkout-note')?.value || '').trim();

            if (!custName || custName.length < 2) {
                alert("Please enter your Full Name (minimum 2 characters).");
                document.getElementById('cp-checkout-name')?.focus();
                return;
            }

            if (!custPhone || custPhone.length < 5) {
                alert("Please enter a valid Phone Number (minimum 5 digits).");
                document.getElementById('cp-checkout-phone')?.focus();
                return;
            }

            if (!custAddress || custAddress.length < 3) {
                alert("Please enter your Delivery Address.");
                document.getElementById('cp-checkout-address')?.focus();
                return;
            }

            const { total } = getCartTotals();

            // Set loading state
            btnPlaceOrder.disabled = true;
            btnPlaceOrder.innerHTML = `
                <div style="width:16px; height:16px; border:2px solid #ffffff; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
                <span>PLACING ORDER...</span>
            `;

            try {
                const orderService = getOrderService(currentWorkspaceId);
                const curSymbol = activeCustomerRegion?.symbol || storeSettings.currencySymbol || '$';
                const curCode = activeCustomerRegion?.currencyCode || 'USD';
                const regInfo = convertPrice(1);

                const orderPayload = {
                    customerName: custName,
                    customerPhone: custPhone,
                    customerAddress: custAddress,
                    orderNote: custNote,
                    currencySymbol: curSymbol,
                    currencyCode: curCode,
                    exchangeRate: regInfo.rate || 1.0,
                    taxPct: regInfo.taxPct || 0,
                    items: items.map(it => {
                        const rawPrice = Number(it.product.sellingPrice || it.product.price || 0);
                        const conv = convertPrice(rawPrice);
                        const qty = Number(it.quantity) || 1;
                        return {
                            productId: it.product.id || it.product.uniqueId,
                            productName: it.product.name,
                            quantity: qty,
                            unitPrice: conv.finalPrice,
                            baseUnitPriceUsd: rawPrice,
                            totalPrice: qty * conv.finalPrice,
                            imageUri: it.product.imageUrl || '',
                            sizeWeight: it.product.size || ''
                        };
                    }),
                    subtotal: total,
                    totalAmount: total,
                    status: 'PENDING',
                    paymentMethod: 'Cash on Delivery (COD)',
                    source: 'CUSTOMER_PORTAL'
                };

                const createdOrder = await orderService.createOrder(orderPayload);

                // Clear cart after successful order placement
                cart = {};
                saveCartToStorage();
                renderProductCardsGrid();
                updateCartHeaderBadge();

                // Close cart drawer
                const cartOverlay = document.getElementById('cp-cart-overlay');
                if (cartOverlay) cartOverlay.classList.remove('open');

                // Display dedicated Order Confirmation Slip Modal
                showCustomerPlacedOrderSlipModal(createdOrder);

                // AUTOMATICALLY SEND TO WHATSAPP AS WELL
                if (storeSettings.whatsappNumber) {
                    try {
                        let cleanPhone = String(storeSettings.whatsappNumber).replace(/[^0-9]/g, '');
                        if (!cleanPhone.startsWith('880') && cleanPhone.startsWith('01')) {
                            cleanPhone = '88' + cleanPhone;
                        }

                        let msg = `*New Order #${createdOrder.orderNumber || createdOrder.id}*\n`;
                        msg += `Customer: *${custName}*\n`;
                        if (custPhone) msg += `*Phone:* ${custPhone}\n`;
                        msg += `Store: *${storeSettings.storeName}*\n`;
                        msg += `----------------------------------------\n`;
                        items.forEach((item, index) => {
                            const p = item.product;
                            const price = formatPrice(p.sellingPrice || p.price || 0);
                            const conv = convertPrice(p.sellingPrice || p.price || 0);
                            const lineTotal = formatCurrencyValue(item.quantity * conv.finalPrice);
                            msg += `${index + 1}. *${p.name}* ${p.size ? `(${p.size})` : ''}\n`;
                            msg += `   Qty: ${item.quantity} × ${price} = *${lineTotal}*\n`;
                        });
                        msg += `----------------------------------------\n`;
                        msg += `*Grand Total: ${formatCurrencyValue(total)}*\n`;
                        if (custAddress) msg += `*Delivery Address:* ${custAddress}\n`;
                        if (custNote) msg += `*Note:* ${custNote}\n`;
                        msg += `\n_Placed via PriceLister Customer Portal_`;

                        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                        window.open(waUrl, '_blank');
                    } catch (waErr) {
                        console.warn("Auto WhatsApp open warning:", waErr);
                    }
                }

            } catch (err) {
                console.error("Order placement error:", err);
                alert("Could not place order: " + (err.message || 'Please check your connection.'));
            } finally {
                btnPlaceOrder.disabled = false;
                btnPlaceOrder.innerHTML = `
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span>PLACE ORDER</span>
                `;
            }
        });
    }

    // WhatsApp Order Dispatcher
    const btnWhatsapp = document.getElementById('cp-btn-order-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Please add some items before sending an order.");
                return;
            }

            const custName = document.getElementById('cp-checkout-name')?.value?.trim() || 'Customer';
            const custPhone = document.getElementById('cp-checkout-phone')?.value?.trim() || '';
            const custAddress = document.getElementById('cp-checkout-address')?.value?.trim() || '';
            const custNote = document.getElementById('cp-checkout-note')?.value?.trim() || '';
            const { total } = getCartTotals();

            let msg = `*New Order from ${custName}*\n`;
            if (custPhone) msg += `*Phone:* ${custPhone}\n`;
            msg += `Store: *${storeSettings.storeName}*\n`;
            msg += `----------------------------------------\n`;

            items.forEach((item, index) => {
                const p = item.product;
                const price = formatPrice(p.sellingPrice || p.price || 0);
                const conv = convertPrice(p.sellingPrice || p.price || 0);
                const lineTotal = formatCurrencyValue(item.quantity * conv.finalPrice);
                msg += `${index + 1}. *${p.name}* ${p.size ? `(${p.size})` : ''}\n`;
                msg += `   Qty: ${item.quantity} × ${price} = *${lineTotal}*\n`;
            });

            msg += `----------------------------------------\n`;
            msg += `*Grand Total: ${formatCurrencyValue(total)}*\n`;
            if (custAddress) {
                msg += `*Delivery Address:* ${custAddress}\n`;
            }
            if (custNote) {
                msg += `*Note:* ${custNote}\n`;
            }
            msg += `\n_Generated via PriceLister Customer Portal_`;

            // Clean phone number for WhatsApp
            let cleanPhone = storeSettings.whatsappNumber.replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('880') && cleanPhone.startsWith('01')) {
                cleanPhone = '88' + cleanPhone;
            }

            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    // Print Estimate Order Slip
    const btnPrint = document.getElementById('cp-btn-print-slip');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            const items = Object.values(cart);
            if (items.length === 0) {
                alert("Your cart is empty! Add products to print an order slip.");
                return;
            }
            printOrderSlip();
        });
    }

    // Region & Currency Switcher Trigger
    const btnOpenRegion = document.getElementById('cp-open-region-btn');
    if (btnOpenRegion) {
        btnOpenRegion.addEventListener('click', () => {
            showCustomerRegionSwitcherModal();
        });
    }

    const btnBannerChangeRegion = document.getElementById('cp-banner-change-region-btn');
    if (btnBannerChangeRegion) {
        btnBannerChangeRegion.addEventListener('click', () => {
            showCustomerRegionSwitcherModal();
        });
    }

    // Target Range Country Chips 1-Click Switch
    document.querySelectorAll('.cp-target-country-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const code = chip.getAttribute('data-code');
            const chosen = COUNTRY_CURRENCY_DIRECTORY.find(c => c.code === code);
            if (chosen) {
                applyCustomerRegion(chosen);
            }
        });
    });

    // Contact Store Modal
    const btnOpenContact = document.getElementById('cp-open-contact-btn');
    if (btnOpenContact) {
        btnOpenContact.addEventListener('click', () => {
            showCustomerContactModal();
        });
    }

    // Terms & Conditions Modal
    const btnTerms = document.getElementById('cp-open-terms-btn');
    if (btnTerms) {
        btnTerms.addEventListener('click', () => {
            showCustomerTermsModal();
        });
    }
};

/**
 * Terms & Policies Modal
 */
const showCustomerTermsModal = () => {
    let container = document.getElementById('cp-terms-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cp-terms-modal-container';
        document.body.appendChild(container);
    }

    container.innerHTML = `
        <div class="cp-modal-overlay" id="cp-terms-modal-overlay" style="display:flex; animation:fadeIn 0.2s ease;">
            <div class="cp-modal-card" style="max-width:480px; border-radius:18px; overflow:hidden; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:1.25rem 1.5rem; text-align:center; color:#ffffff; position:relative;">
                    <button type="button" class="cp-cart-close-btn" id="btn-close-terms-modal" style="position:absolute; right:1rem; top:1rem; color:#94a3b8; font-size:1.4rem;">✕</button>
                    <h3 style="margin:0; font-size:1.2rem; font-weight:800;">Terms &amp; Policies</h3>
                </div>
                <div style="padding:1.5rem; background:#ffffff; font-size:0.88rem; color:var(--text-secondary); line-height:1.6; white-space:pre-line; max-height:60vh; overflow-y:auto;">
                    ${escapeHtml(storeSettings.termsAndConditions || '• Prices subject to change without notice.\n• All orders are confirmed before dispatch.')}
                </div>
                <div style="padding:0.85rem 1.25rem; background:var(--surface-50); border-top:1px solid var(--border-color); text-align:center;">
                    <button type="button" class="btn btn-secondary" id="btn-done-terms-modal" style="width:100%; font-weight:700; padding:0.55rem;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-close-terms-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('btn-done-terms-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('cp-terms-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'cp-terms-modal-overlay') {
            container.remove();
        }
    });
};

/**
 * Apply Customer Region Selection & Live Recalculation
 */
export const applyCustomerRegion = (chosen) => {
    if (!chosen) return;

    activeCustomerRegion = chosen;
    storeSettings.currencySymbol = chosen.symbol;

    try {
        localStorage.setItem(`pricelister_customer_selected_country_${currentWorkspaceId}`, chosen.code);
        localStorage.setItem('pricelister_customer_selected_country', chosen.code);
    } catch (e) {}

    // 1. Update Header Button Pill
    const headerBtn = document.getElementById('cp-open-region-btn');
    if (headerBtn) {
        headerBtn.innerHTML = `
            <span>${chosen.iso ? `<img src="https://flagcdn.com/w20/${chosen.iso}.png" width="16" height="11" style="vertical-align:middle; border-radius:2px;">` : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`}</span>
            <span>${escapeHtml(chosen.symbol || '$')}</span>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${escapeHtml(chosen.currencyCode || '')}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
        `;
        headerBtn.title = `Selected Region & Currency: ${chosen.name} (${chosen.currencyCode})`;
    }

    // 2. Update Target Country Chips Active State
    document.querySelectorAll('.cp-target-country-chip').forEach(chip => {
        const cCode = chip.getAttribute('data-code');
        if (cCode === chosen.code) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // 3. Update Banner Button Text
    const bannerBtn = document.getElementById('cp-banner-change-region-btn');
    if (bannerBtn) {
        bannerBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:0.35rem;">Currency &amp; Rates (${escapeHtml(chosen.symbol || '$')}) <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span>`;
    }

    // 4. Update Global Summary Text if present
    const globalSummary = document.getElementById('cp-target-global-summary');
    if (globalSummary) {
        globalSummary.innerHTML = `Universal Worldwide Catalog • Converted for <strong>${escapeHtml(chosen.name)} (${escapeHtml(chosen.symbol)})</strong>`;
    }

    // 5. Re-render Product Grid with converted prices & rates
    renderProductCardsGrid();

    // 6. Update Cart Drawer and Badges
    updateCartHeaderBadge();
    renderCartDrawerList();

    // 7. Update QuickView modal if currently open
    const qvOverlay = document.getElementById('cp-qv-overlay');
    if (qvOverlay) {
        const qvPrdId = qvOverlay.getAttribute('data-product-id');
        if (qvPrdId) {
            window.cpOpenQuickView(qvPrdId);
        }
    }
};

/**
 * Regional Currency Switcher Modal
 * Lets customer choose their country/currency among allowed launch regions.
 */
const showCustomerRegionSwitcherModal = () => {
    let container = document.getElementById('cp-region-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cp-region-modal-container';
        document.body.appendChild(container);
    }

    // 1. Determine Deployed Countries
    let storeCountries = [];
    if (Array.isArray(storeSettings.deployCountries) && storeSettings.deployCountries.length > 0) {
        storeCountries = storeSettings.deployCountries;
    } else if (storeSettings.deployCountry) {
        storeCountries = [storeSettings.deployCountry];
    } else {
        storeCountries = ['Global'];
    }

    const isGlobalDeploy = storeCountries.includes('Global') || storeCountries.includes('GLOBAL') || storeCountries.includes('global');

    // Filter allowed countries
    const allowedRegions = isGlobalDeploy 
        ? COUNTRY_CURRENCY_DIRECTORY 
        : COUNTRY_CURRENCY_DIRECTORY.filter(c => {
            return storeCountries.some(sc => {
                const clean = String(sc || '').trim().toLowerCase();
                return clean === c.name.toLowerCase() || 
                       clean === c.code.toLowerCase() || 
                       clean === c.iso.toLowerCase() ||
                       (clean === 'usa' && c.code === 'US') ||
                       (clean === 'uk' && c.code === 'GB');
            });
        });

    const displayList = allowedRegions.length > 0 ? allowedRegions : COUNTRY_CURRENCY_DIRECTORY;

    container.innerHTML = `
        <div class="cp-modal-overlay" id="cp-region-modal-overlay" style="display:flex; animation:fadeIn 0.2s ease;">
            <div class="cp-modal-card" style="max-width:500px; border-radius:18px; overflow:hidden; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- HEADER -->
                <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:1.35rem 1.5rem; text-align:center; color:#ffffff; position:relative;">
                    <button type="button" class="cp-cart-close-btn" id="btn-close-region-modal" style="position:absolute; right:1rem; top:1rem; color:#94a3b8; font-size:1.4rem;">✕</button>
                    <div style="width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.1); display:inline-flex; align-items:center; justify-content:center; margin-bottom:0.5rem; color:#ffffff;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                    </div>
                    <h3 style="margin:0 0 0.2rem 0; font-size:1.25rem; font-weight:800;">Select Region &amp; Currency</h3>
                    <p style="margin:0; font-size:0.82rem; opacity:0.85;">
                        ${isGlobalDeploy ? 'Global publish active • Prices automatically adjust based on country' : `Store published to ${displayList.length} target region${displayList.length > 1 ? 's' : ''}`}
                    </p>
                </div>

                <!-- SEARCH (IF MULTIPLE COUNTRIES) -->
                ${displayList.length > 4 ? `
                    <div style="padding:0.75rem 1.25rem 0.25rem; background:#ffffff;">
                        <input type="text" id="cp-region-search-input" placeholder="Search country or currency (e.g. Bangladesh, USA, EUR)..." class="form-control" style="font-size:0.85rem; height:36px;">
                    </div>
                ` : ''}

                <!-- LIST OF REGIONS -->
                <div id="cp-region-list-container" style="padding:0.85rem 1.25rem; max-height:55vh; overflow-y:auto; display:flex; flex-direction:column; gap:0.55rem; background:#ffffff;">
                    ${displayList.map(r => {
                        const isSelected = activeCustomerRegion && (activeCustomerRegion.code === r.code || activeCustomerRegion.name === r.name);
                        
                        // Calculate live country rate & tax for preview
                        let rate = 1.0;
                        let taxPct = Math.max(0, Number(storeSettings.defaultTaxPct || 0));
                        if (storeSettings.customCountryRates && storeSettings.customCountryRates[r.code]) {
                            const custom = storeSettings.customCountryRates[r.code];
                            if (custom.rate !== undefined && Number(custom.rate) > 0) rate = Number(custom.rate);
                            if (custom.taxPct !== undefined) taxPct = Number(custom.taxPct);
                        } else if (BENCHMARK_EXCHANGE_RATES[r.code]) {
                            rate = Number(BENCHMARK_EXCHANGE_RATES[r.code].rate) || 1.0;
                        }

                        const preview10 = (10.0 * rate) + ((10.0 * rate * taxPct) / 100);

                        return `
                            <div class="cp-region-item-row" data-code="${r.code}" data-name="${escapeHtml(r.name)}" data-currency="${escapeHtml(r.currencyCode)}" style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border-radius:10px; border:1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background:${isSelected ? 'rgba(225,29,72,0.04)' : 'var(--surface-50)'}; cursor:pointer; transition:all 0.15s ease;" onmouseover="this.style.borderColor='var(--primary)';" onmouseout="this.style.borderColor='${isSelected ? 'var(--primary)' : 'var(--border-color)'}';">
                                <div style="display:flex; align-items:center; gap:0.75rem;">
                                    <span style="font-size:1.45rem;">${r.flag}</span>
                                    <div>
                                        <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${escapeHtml(r.name)}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem; margin-top:2px;">
                                            <span>1 USD = ${rate} ${escapeHtml(r.symbol)}</span>
                                            ${taxPct > 0 ? `<span style="background:rgba(225,29,72,0.1); color:var(--primary); padding:1px 4px; border-radius:4px; font-weight:700;">+${taxPct}% Tax</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.6rem;">
                                    <div style="text-align:right;">
                                        <span style="font-weight:800; font-size:1.05rem; color:var(--primary); font-family:monospace;">${escapeHtml(r.symbol)}</span>
                                        <div style="font-size:0.7rem; color:var(--text-muted);">$10 = ${escapeHtml(r.symbol)}${preview10.toFixed(2)}</div>
                                    </div>
                                    ${isSelected ? `
                                        <span style="width:22px; height:22px; border-radius:50%; background:var(--primary); color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800;">✓</span>
                                    ` : `
                                        <span style="width:22px; height:22px; border-radius:50%; border:1.5px solid var(--border-color);"></span>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- FOOTER -->
                <div style="padding:0.85rem 1.25rem; background:var(--surface-50); border-top:1px solid var(--border-color); text-align:center;">
                    <button type="button" class="btn btn-secondary" id="btn-done-region-modal" style="width:100%; font-weight:700; padding:0.55rem;">
                        Close
                    </button>
                </div>

            </div>
        </div>
    `;

    // Search filter within modal
    const searchInp = document.getElementById('cp-region-search-input');
    if (searchInp) {
        searchInp.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.cp-region-item-row').forEach(row => {
                const name = (row.getAttribute('data-name') || '').toLowerCase();
                const code = (row.getAttribute('data-code') || '').toLowerCase();
                const curr = (row.getAttribute('data-currency') || '').toLowerCase();
                const match = name.includes(q) || code.includes(q) || curr.includes(q);
                row.style.display = match ? 'flex' : 'none';
            });
        });
    }

    // Handle Region Selection Click
    document.querySelectorAll('.cp-region-item-row').forEach(row => {
        row.addEventListener('click', () => {
            const code = row.getAttribute('data-code');
            const chosen = COUNTRY_CURRENCY_DIRECTORY.find(c => c.code === code);
            if (chosen) {
                applyCustomerRegion(chosen);
                container.remove();
            }
        });
    });

    document.getElementById('btn-close-region-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('btn-done-region-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('cp-region-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'cp-region-modal-overlay') {
            container.remove();
        }
    });
};

/**
 * Contact Store Modal with WhatsApp, Facebook, Call, Email, and Location
 */
const showCustomerContactModal = () => {
    let container = document.getElementById('cp-contact-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cp-contact-modal-container';
        document.body.appendChild(container);
    }

    const brandLogoSrc = (storeSettings.brandingMode === 'CUSTOM' && storeSettings.storeLogo)
        ? storeSettings.storeLogo
        : ((storeSettings.brandingMode === 'WORKSPACE' && storeSettings.workspaceLogo) ? storeSettings.workspaceLogo : 'pricelister_org.png');

    // Resolve Facebook URL
    let fbLink = '';
    let fbDisplay = storeSettings.facebookId || '';
    if (storeSettings.facebookId) {
        const raw = storeSettings.facebookId.trim();
        if (raw.startsWith('http://') || raw.startsWith('https://')) {
            fbLink = raw;
            fbDisplay = raw.replace(/^https?:\/\/(www\.)?facebook\.com\//i, '@');
        } else {
            const handle = raw.replace(/^@/, '');
            fbLink = `https://facebook.com/${handle}`;
            fbDisplay = `@${handle}`;
        }
    }

    // Resolve WhatsApp Link
    let cleanWa = (storeSettings.whatsappNumber || '').replace(/[^0-9]/g, '');
    if (cleanWa && !cleanWa.startsWith('880') && cleanWa.startsWith('01')) {
        cleanWa = '88' + cleanWa;
    }
    const waUrl = cleanWa ? `https://api.whatsapp.com/send?phone=${cleanWa}&text=${encodeURIComponent(`Hello ${storeSettings.storeName}, I am browsing your online catalog and would like to inquire about products.`)}` : '';

    container.innerHTML = `
        <div class="cp-modal-overlay" id="cp-contact-modal-overlay" style="display:flex; animation:fadeIn 0.2s ease;">
            <div class="cp-modal-card" style="max-width:520px; border-radius:18px; overflow:hidden; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- HEADER -->
                <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding:1.5rem; text-align:center; color:#ffffff; position:relative;">
                    <button type="button" class="cp-cart-close-btn" id="btn-close-contact-modal" style="position:absolute; right:1rem; top:1rem; color:#94a3b8; font-size:1.4rem;">✕</button>
                    
                    <div style="width:58px; height:58px; border-radius:14px; background:#ffffff; display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem; padding:4px; box-shadow:0 6px 16px rgba(0,0,0,0.25);">
                        <img src="${escapeHtml(brandLogoSrc)}" alt="Logo" style="width:100%; height:100%; object-fit:contain; border-radius:10px;" onerror="this.src='pricelister_org.png';">
                    </div>

                    <h3 style="margin:0 0 0.25rem 0; font-size:1.3rem; font-weight:800; letter-spacing:-0.01em;">${escapeHtml(storeSettings.storeName)}</h3>
                    <p style="margin:0; font-size:0.84rem; opacity:0.85;">${escapeHtml(storeSettings.storeSubtitle || 'Online Product Catalog')}</p>
                </div>

                <!-- CONTACT CHANNELS BODY -->
                <div style="padding:1.5rem; display:flex; flex-direction:column; gap:0.85rem; max-height:65vh; overflow-y:auto; background:#ffffff;">
                    
                    <!-- WhatsApp Direct Contact -->
                    ${cleanWa ? `
                        <a href="${waUrl}" target="_blank" style="text-decoration:none; display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.15rem; background:#ecfdf5; border:1.5px solid #a7f3d0; border-radius:12px; transition:all 0.15s ease; color:#065f46;" onmouseover="this.style.background='#d1fae5'; this.style.borderColor='#6ee7b7';" onmouseout="this.style.background='#ecfdf5'; this.style.borderColor='#a7f3d0';">
                            <div style="display:flex; align-items:center; gap:0.85rem;">
                                <div style="width:40px; height:40px; border-radius:10px; background:#25d366; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 10px rgba(37,211,102,0.35);">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 15 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/></svg>
                                </div>
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem; color:#065f46;">Chat on WhatsApp</div>
                                    <div style="font-size:0.8rem; color:#059669; font-family:monospace;">${escapeHtml(storeSettings.whatsappNumber)}</div>
                                </div>
                            </div>
                            <span style="font-size:0.85rem; font-weight:700; color:#059669; background:#ffffff; padding:0.35rem 0.75rem; border-radius:999px; border:1px solid #a7f3d0;">Message ↗</span>
                        </a>
                    ` : ''}

                    <!-- Facebook Page / Messenger -->
                    ${fbLink ? `
                        <a href="${fbLink}" target="_blank" style="text-decoration:none; display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.15rem; background:#eff6ff; border:1.5px solid #bfdbfe; border-radius:12px; transition:all 0.15s ease; color:#1e40af;" onmouseover="this.style.background='#dbeafe'; this.style.borderColor='#93c5fd';" onmouseout="this.style.background='#eff6ff'; this.style.borderColor='#bfdbfe';">
                            <div style="display:flex; align-items:center; gap:0.85rem;">
                                <div style="width:40px; height:40px; border-radius:10px; background:#1877f2; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 3px 10px rgba(24,119,242,0.35);">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                </div>
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem; color:#1e40af;">Facebook Page</div>
                                    <div style="font-size:0.8rem; color:#2563eb;">${escapeHtml(fbDisplay)}</div>
                                </div>
                            </div>
                            <span style="font-size:0.85rem; font-weight:700; color:#2563eb; background:#ffffff; padding:0.35rem 0.75rem; border-radius:999px; border:1px solid #bfdbfe;">Visit Page ↗</span>
                        </a>
                    ` : ''}

                    <!-- Direct Phone Call -->
                    ${storeSettings.phone ? `
                        <a href="tel:${escapeHtml(storeSettings.phone)}" style="text-decoration:none; display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.15rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; transition:all 0.15s ease; color:var(--text-primary);" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#f8fafc';">
                            <div style="display:flex; align-items:center; gap:0.85rem;">
                                <div style="width:40px; height:40px; border-radius:10px; background:#475569; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                </div>
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Call Store Direct</div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(storeSettings.phone)}</div>
                                </div>
                            </div>
                            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary); background:#ffffff; padding:0.35rem 0.75rem; border-radius:999px; border:1px solid #cbd5e1; display:inline-flex; align-items:center; gap:0.35rem;">
                                Call Now
                            </span>
                        </a>
                    ` : ''}

                    <!-- Email Support -->
                    ${storeSettings.email ? `
                        <a href="mailto:${escapeHtml(storeSettings.email)}" style="text-decoration:none; display:flex; align-items:center; justify-content:space-between; padding:0.9rem 1.15rem; background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; transition:all 0.15s ease; color:var(--text-primary);" onmouseover="this.style.background='#f1f5f9';" onmouseout="this.style.background='#f8fafc';">
                            <div style="display:flex; align-items:center; gap:0.85rem;">
                                <div style="width:40px; height:40px; border-radius:10px; background:#0284c7; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">Email Support</div>
                                    <div style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(storeSettings.email)}</div>
                                </div>
                            </div>
                            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary); background:#ffffff; padding:0.35rem 0.75rem; border-radius:999px; border:1px solid #cbd5e1; display:inline-flex; align-items:center; gap:0.35rem;">
                                Send Email
                            </span>
                        </a>
                    ` : ''}

                    <!-- Store Location Address -->
                    ${storeSettings.address ? `
                        <div style="padding:0.9rem 1.15rem; background:var(--surface-50); border:1px solid var(--border-color); border-radius:12px; display:flex; gap:0.85rem; align-items:flex-start;">
                            <div style="width:36px; height:36px; border-radius:8px; background:var(--surface-200); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            </div>
                            <div>
                                <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary); margin-bottom:0.15rem;">Store Address &amp; Location</div>
                                <div style="font-size:0.85rem; color:var(--text-secondary); line-height:1.4;">${escapeHtml(storeSettings.address)}</div>
                            </div>
                        </div>
                    ` : ''}

                    ${!cleanWa && !fbLink && !storeSettings.phone && !storeSettings.email && !storeSettings.address ? `
                        <div style="text-align:center; padding:2rem 1rem; color:var(--text-muted);">
                            <p style="margin:0; font-size:0.9rem;">Store owner has not configured contact details yet.</p>
                        </div>
                    ` : ''}

                </div>

                <!-- FOOTER -->
                <div style="padding:1rem 1.5rem; background:var(--surface-50); border-top:1px solid var(--border-color); text-align:center;">
                    <button type="button" class="btn btn-secondary" id="btn-done-contact-modal" style="width:100%; font-weight:700; padding:0.6rem;">
                        Close
                    </button>
                </div>

            </div>
        </div>
    `;

    document.getElementById('btn-close-contact-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('btn-done-contact-modal')?.addEventListener('click', () => container.remove());
    document.getElementById('cp-contact-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'cp-contact-modal-overlay') {
            container.remove();
        }
    });
};

/**
 * Display Confirmed Order Slip Modal after placing order
 */
const showCustomerPlacedOrderSlipModal = (order) => {
    let container = document.getElementById('cp-order-slip-modal-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'cp-order-slip-modal-container';
        document.body.appendChild(container);
    }

    const curr = order.currencySymbol || storeSettings.currencySymbol || '$';
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
    });

    container.innerHTML = `
        <div style="position:fixed; inset:0; background:rgba(15,23,42,0.8); backdrop-filter:blur(8px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:1rem;">
            <div class="card" style="background:#ffffff; border-radius:18px; max-width:540px; width:100%; box-shadow:0 25px 60px -15px rgba(0,0,0,0.5); overflow:hidden; border:1px solid rgba(225,29,72,0.2); animation:modalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1);">
                
                <!-- MODAL HEADER -->
                <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%); padding:1.5rem; text-align:center; color:#ffffff; position:relative;">
                    <div style="width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; margin:0 auto 0.75rem;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <h3 style="margin:0 0 0.25rem 0; font-size:1.35rem; font-weight:800;">Order Placed Successfully!</h3>
                    <p style="margin:0; font-size:0.85rem; opacity:0.95;">Sent directly to workspace team for fast confirmation & dispatch</p>
                </div>

                <!-- SLIP BODY -->
                <div id="placed-slip-content" style="padding:1.5rem; font-size:0.88rem; color:var(--text-primary); max-height:65vh; overflow-y:auto;">
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.25rem; border-bottom:1px dashed var(--border-color); padding-bottom:1rem;">
                        <div>
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Number</span>
                            <div style="font-size:1.15rem; font-weight:800; color:var(--primary); font-family:monospace;">#${escapeHtml(order.orderNumber || order.id)}</div>
                            <span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Order Status</span>
                            <div style="margin-top:0.2rem;"><span style="background:#fef3c7; color:#b45309; font-weight:700; font-size:0.78rem; padding:0.2rem 0.6rem; border-radius:999px; display:inline-flex; align-items:center; gap:0.35rem;"><span style="width:7px; height:7px; border-radius:50%; background:#d97706;"></span> Pending Confirmation</span></div>
                        </div>
                    </div>

                    <!-- Customer Info Box -->
                    <div style="background:var(--surface-50); border-radius:10px; padding:0.9rem; margin-bottom:1.25rem; border:1px solid var(--border-color);">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Customer Details</span>
                        <div style="font-weight:700; color:var(--text-primary); font-size:0.95rem;">${escapeHtml(order.customerName)}</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.2rem;">Phone: ${escapeHtml(order.customerPhone)}</div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem;">Address: ${escapeHtml(order.customerAddress)}</div>
                        ${order.orderNote ? `
                            <div style="font-size:0.8rem; color:#b45309; background:#fef3c7; padding:0.25rem 0.5rem; border-radius:6px; margin-top:0.4rem;">
                                <strong>Note:</strong> ${escapeHtml(order.orderNote)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Items List -->
                    <div style="margin-bottom:1.25rem;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
                            <thead>
                                <tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase;">
                                    <th style="text-align:left; padding:0.4rem 0;">Item</th>
                                    <th style="text-align:center; padding:0.4rem 0;">Qty</th>
                                    <th style="text-align:right; padding:0.4rem 0;">Price</th>
                                    <th style="text-align:right; padding:0.4rem 0;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(order.items || []).map(item => `
                                    <tr style="border-bottom:1px solid var(--surface-100);">
                                        <td style="padding:0.5rem 0; font-weight:600; color:var(--text-primary);">${escapeHtml(item.productName)}</td>
                                        <td style="padding:0.5rem 0; text-align:center;">${item.quantity}</td>
                                        <td style="padding:0.5rem 0; text-align:right;">${curr}${Number(item.unitPrice || 0).toFixed(2)}</td>
                                        <td style="padding:0.5rem 0; text-align:right; font-weight:700;">${curr}${Number(item.totalPrice || (item.quantity * item.unitPrice) || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Total Breakdown -->
                    <div style="border-top:1px dashed var(--border-color); padding-top:0.75rem; display:flex; flex-direction:column; gap:0.35rem;">
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-secondary);">
                            <span>Subtotal</span>
                            <span>${curr}${Number(order.subtotal || order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:800; color:var(--text-primary); border-top:1px solid var(--border-color); padding-top:0.5rem; margin-top:0.25rem;">
                            <span>Total Payable (COD)</span>
                            <span style="color:var(--primary);">${curr}${Number(order.totalAmount || 0).toFixed(2)}</span>
                        </div>
                    </div>

                </div>

                <!-- MODAL FOOTER -->
                <div style="background:var(--surface-50); border-top:1px solid var(--border-color); padding:1rem 1.5rem; display:flex; justify-content:space-between; gap:0.6rem; align-items:center; flex-wrap:wrap;">
                    <button type="button" id="btn-print-placed-slip" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print Slip
                    </button>
                    ${storeSettings.whatsappNumber ? `
                        <button type="button" id="btn-wa-placed-slip" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; display:flex; align-items:center; gap:0.4rem; color:#059669;">
                            WhatsApp Share
                        </button>
                    ` : ''}
                    <button type="button" id="btn-close-placed-slip" class="btn btn-primary" style="font-weight:700; font-size:0.85rem; padding:0.5rem 1.25rem; background:linear-gradient(135deg, #10b981 0%, #059669 100%);">
                        Continue Browsing
                    </button>
                </div>

            </div>
        </div>
    `;

    document.getElementById('btn-close-placed-slip')?.addEventListener('click', () => container.remove());
    document.getElementById('btn-print-placed-slip')?.addEventListener('click', () => {
        const printContent = document.getElementById('placed-slip-content').innerHTML;
        const printWindow = window.open('', '', 'width=650,height=750');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Order Slip - #${order.orderNumber || order.id}</title>
                    <style>
                        body { font-family: 'Inter', sans-serif; padding: 2rem; color: #0f172a; line-height: 1.5; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                        th, td { padding: 0.5rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                        th { text-align: left; background: #f8fafc; font-size: 0.75rem; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <h2 style="margin:0 0 0.25rem 0;">${escapeHtml(storeSettings.storeName)} — Order Slip</h2>
                    ${printContent}
                    <script>window.print(); window.close();</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    const waBtn = document.getElementById('btn-wa-placed-slip');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            let msg = `*Confirmed Order #${order.orderNumber || order.id}*\n`;
            msg += `Customer: *${order.customerName}* (${order.customerPhone})\n`;
            msg += `Store: *${storeSettings.storeName}*\n`;
            msg += `----------------------------------------\n`;
            (order.items || []).forEach((item, idx) => {
                msg += `${idx + 1}. *${item.productName}* × ${item.quantity} = ${curr}${Number(item.totalPrice).toFixed(2)}\n`;
            });
            msg += `----------------------------------------\n`;
            msg += `*Total: ${curr}${Number(order.totalAmount).toFixed(2)}*\n`;
            if (order.customerAddress) msg += `*Address:* ${order.customerAddress}\n`;

            let cleanPhone = (storeSettings.whatsappNumber || '').replace(/[^0-9]/g, '');
            if (!cleanPhone.startsWith('880') && cleanPhone.startsWith('01')) cleanPhone = '88' + cleanPhone;
            window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }
};

/**
 * Print Order Slip
 */
const printOrderSlip = () => {
    const items = Object.values(cart);
    const { count, total } = getCartTotals();
    const custName = document.getElementById('cp-order-customer-name')?.value?.trim() || 'General Customer';
    const custAddress = document.getElementById('cp-order-customer-address')?.value?.trim() || 'Direct Inquiry';
    const orderDate = new Date().toLocaleString();

    const printWin = window.open('', '_blank', 'width=700,height=800');
    if (!printWin) return;

    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Slip — ${escapeHtml(storeSettings.storeName)}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 2rem; color: #1e293b; max-width: 650px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; margin-bottom: 1.5rem; }
                .store-title { font-size: 1.6rem; font-weight: bold; margin: 0; color: #0f172a; }
                .meta { font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; }
                .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem; margin-bottom: 1.5rem; font-size: 0.9rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
                th { text-align: left; padding: 0.65rem; border-bottom: 2px solid #cbd5e1; font-size: 0.85rem; text-transform: uppercase; color: #475569; }
                td { padding: 0.65rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; }
                .text-right { text-align: right; }
                .total-row { font-size: 1.15rem; font-weight: bold; border-top: 2px solid #0f172a; }
                .footer { text-align: center; font-size: 0.8rem; color: #94a3b8; margin-top: 2rem; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="store-title">${escapeHtml(storeSettings.storeName)}</h1>
                <div class="meta">Customer Order Slip & Estimate</div>
                <div class="meta">${escapeHtml(orderDate)}</div>
            </div>

            <div class="info-box">
                <div><strong>Customer:</strong> ${escapeHtml(custName)}</div>
                ${custAddress ? `<div><strong>Delivery Address / Notes:</strong> ${escapeHtml(custAddress)}</div>` : ''}
                ${storeSettings.phone ? `<div><strong>Store Contact:</strong> ${escapeHtml(storeSettings.phone)}</div>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => {
                        const p = item.product;
                        const price = Number(p.sellingPrice || p.price || 0);
                        return `
                            <tr>
                                <td><strong>${escapeHtml(p.name)}</strong> ${p.size ? `(${escapeHtml(p.size)})` : ''}</td>
                                <td class="text-right">${formatPrice(price)}</td>
                                <td class="text-right">${item.quantity}</td>
                                <td class="text-right">${formatPrice(item.quantity * price)}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="total-row">
                        <td colspan="3" class="text-right">Grand Total:</td>
                        <td class="text-right">${formatPrice(total)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer">
                Thank you for your business! • Powered by PriceLister
            </div>
            <script>
                window.onload = function() { window.print(); };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
};

/**
 * Open Product Quick View Modal
 */
window.cpOpenQuickView = (productId) => {
    const p = allProducts.find(item => item.id === productId);
    if (!p) return;

    const modalContainer = document.getElementById('cp-quickview-modal-container');
    if (!modalContainer) return;

    const sellingPrice = Number(p.sellingPrice || p.price || 0);
    const mrp = Number(p.mrp || p.wholesalePrice || 0);
    const hasDiscount = storeSettings.showMrp && mrp > sellingPrice;
    const discountPct = hasDiscount ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
    const inCartQty = cart[p.id] ? cart[p.id].quantity : 0;

    modalContainer.innerHTML = `
        <div class="cp-modal-overlay" id="cp-qv-overlay">
            <div class="cp-modal-card">
                <div class="cp-modal-header">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:700;">${escapeHtml(p.name)}</h3>
                    <button type="button" class="cp-cart-close-btn" onclick="document.getElementById('cp-qv-overlay').remove()">✕</button>
                </div>
                <div class="cp-modal-body">
                    <div class="cp-qv-grid">
                        <div>
                            <img src="${p.imageUrl ? escapeHtml(p.imageUrl) : 'pricelister_org.png'}" alt="${escapeHtml(p.name)}" class="cp-qv-img" onerror="this.src='pricelister_org.png';">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            <div style="display:flex; gap:0.4rem; align-items:center;">
                                <span class="cp-card-category">${escapeHtml(p.category || 'General')}</span>
                                ${p.size ? `<span class="cp-card-size">${escapeHtml(p.size)}</span>` : ''}
                            </div>

                            <div style="display:flex; align-items:baseline; gap:0.6rem;">
                                <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${formatPrice(sellingPrice)}</span>
                                ${hasDiscount ? `<span class="cp-card-mrp" style="font-size:0.95rem;">${formatPrice(mrp)}</span>` : ''}
                                ${hasDiscount ? `<span class="cp-badge-discount" style="font-size:0.75rem; padding:0.15rem 0.45rem; border-radius:4px;">${discountPct}% OFF</span>` : ''}
                            </div>

                            ${p.barcode || p.sku ? `
                                <div style="font-size:0.8rem; color:var(--text-muted); font-family:monospace;">
                                    SKU / Barcode: ${escapeHtml(p.barcode || p.sku)}
                                </div>
                            ` : ''}

                            ${p.description ? `
                                <div style="margin-top:0.5rem; font-size:0.88rem; color:var(--text-secondary); line-height:1.5;">
                                    <strong>Description:</strong><br>
                                    ${escapeHtml(p.description)}
                                </div>
                            ` : ''}

                            <div style="margin-top:auto; padding-top:1rem;">
                                <button type="button" class="cp-btn-add-cart" style="height:42px; font-size:0.95rem;" onclick="window.cpAddToCart('${p.id}'); document.getElementById('cp-qv-overlay').remove();">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
                                    ${inCartQty > 0 ? `Add Another (${inCartQty} in cart)` : 'Add to Shopping Cart'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('cp-qv-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'cp-qv-overlay') {
            e.target.remove();
        }
    });
};

/**
 * Open Terms Modal
 */
const openTermsModal = () => {
    const modalContainer = document.getElementById('cp-terms-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="cp-modal-overlay" id="cp-terms-overlay">
            <div class="cp-modal-card" style="max-width:500px;">
                <div class="cp-modal-header">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:700;">Terms & Ordering Policies</h3>
                    <button type="button" class="cp-cart-close-btn" onclick="document.getElementById('cp-terms-overlay').remove()">✕</button>
                </div>
                <div class="cp-modal-body">
                    <div style="font-size:0.92rem; color:var(--text-secondary); line-height:1.6; white-space:pre-line;">
                        ${escapeHtml(storeSettings.termsAndConditions)}
                    </div>
                    ${storeSettings.phone || storeSettings.email ? `
                        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid var(--border-color); font-size:0.85rem; color:var(--text-muted);">
                            ${storeSettings.phone ? `<div>Phone: ${escapeHtml(storeSettings.phone)}</div>` : ''}
                            ${storeSettings.email ? `<div>Email: ${escapeHtml(storeSettings.email)}</div>` : ''}
                            ${storeSettings.address ? `<div>Address: ${escapeHtml(storeSettings.address)}</div>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.getElementById('cp-terms-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'cp-terms-overlay') {
            e.target.remove();
        }
    });
};

/**
 * Temporary Closed State
 */
const renderTemporaryClosedState = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container">
            <div class="cp-closed-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            </div>
            
            <div style="font-size:0.85rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.05em; margin-bottom:0.25rem;">
                ${escapeHtml(storeSettings.storeName)}
            </div>

            <h1 class="cp-closed-title">Temporary Closed</h1>
            
            <div class="cp-closed-message">
                ${escapeHtml(storeSettings.closedMessage || 'Shop Temporary appended / suspended. May start early.')}
            </div>

            ${storeSettings.phone || storeSettings.email || storeSettings.address ? `
                <div class="cp-closed-contact-box">
                    <strong style="color:var(--text-primary); display:block; margin-bottom:0.35rem;">Store Contact Info:</strong>
                    ${storeSettings.phone ? `<div>Phone: ${escapeHtml(storeSettings.phone)}</div>` : ''}
                    ${storeSettings.whatsappNumber ? `<div>WhatsApp: ${escapeHtml(storeSettings.whatsappNumber)}</div>` : ''}
                    ${storeSettings.email ? `<div>Email: ${escapeHtml(storeSettings.email)}</div>` : ''}
                    ${storeSettings.address ? `<div>Address: ${escapeHtml(storeSettings.address)}</div>` : ''}
                </div>
            ` : ''}

            <div style="margin-top:1.5rem; font-size:0.75rem; color:var(--text-muted);">
                Powered by PriceLister
            </div>
        </div>
    `;
};

/**
 * Missing / Invalid Workspace
 */
const renderNoWorkspaceState = () => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container" style="margin-top:12vh;">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--surface-100); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem; color:var(--text-muted);">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            </div>
            <h1 class="cp-closed-title">Store Link Required</h1>
            <p class="cp-closed-message">
                Please open the Customer Panel using a valid shareable link provided by the store admin (e.g. <code>customer.html?ws=YOUR_STORE_ID</code>).
            </p>
        </div>
    `;
};

/**
 * Error State
 */
const renderErrorState = (msg) => {
    const app = document.getElementById('customer-app');
    if (!app) return;

    app.innerHTML = `
        <div class="cp-closed-container" style="margin-top:12vh;">
            <div style="width:48px; height:48px; border-radius:50%; background:#fff1f2; color:#e11d48; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h1 class="cp-closed-title">Notice</h1>
            <p class="cp-closed-message">${escapeHtml(msg)}</p>
        </div>
    `;
};
