import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { setAppCurrencySymbol } from '../utilities.js';
import { authService } from '../../firebase/auth.js';

const db = getFirestore(firebaseApp);

export const getSettingsService = (workspaceId) => {
    const isMock = !workspaceId || 
                   workspaceId === 'ws_dev_mock' || 
                   workspaceId === 'demo' || 
                   workspaceId === 'dev-mock-uid' || 
                   Boolean(localStorage.getItem('mock_dev_session'));

    return {
        getWorkspaceSettings: async () => {
            if (isMock) {
                let mockSaved = {};
                try {
                    const raw = localStorage.getItem('pricelister_mock_settings');
                    if (raw) mockSaved = JSON.parse(raw) || {};
                } catch (e) {}

                const baseCurrency = mockSaved.currencySymbol || mockSaved.currency || '$';
                setAppCurrencySymbol(baseCurrency);

                const defaultDemoSettings = {
                    enableVending: true,
                    shopName: 'PriceLister Demo Enterprise',
                    tradeName: 'PriceLister Global Commerce',
                    country: 'United Kingdom',
                    operatedCountry: 'United Kingdom',
                    industry: 'Retail & Commerce',
                    tagline: 'Leading Wholesale and Retail Supply Ecosystem',
                    description: 'Leading Wholesale and Retail Supply Ecosystem',
                    website: 'https://pricelister.app',
                    taxId: 'TAX-UK-GB9948201',
                    address: '100 Regent Street, London W1B 5SR, United Kingdom',
                    phone: '+44 20 7946 0912',
                    supportPhone: '+44 20 7946 0915',
                    endMessage: 'Thank you for choosing PriceLister Enterprise!',
                    customerName: true,
                    customerNumber: true,
                    name: 'PriceLister Demo Enterprise',
                    email: 'developer@local.test',
                    currencySymbol: '€',
                    currency: 'EUR',
                    logoUrl: '',
                    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
                    createdAt: Date.now() - 86400000 * 30,
                    createdTimestamp: new Date(Date.now() - 86400000 * 30).toISOString(),
                    createdDate: '1 month ago',
                    creatorEmail: 'developer@local.test',
                    creatorName: 'Demo Admin',
                    updatedAt: Date.now(),
                    updateTimestamp: new Date().toISOString(),
                    updatedDate: 'Just now',
                    updatorEmail: 'developer@local.test',
                    updatorName: 'Demo Admin',
                    updatorRole: 'CREATOR_ADMIN'
                };

                return {
                    ...defaultDemoSettings,
                    ...mockSaved
                };
            }

            try {
                const receiptRef = doc(db, 'ReceiptData', workspaceId);
                const wsRef = doc(db, 'Workspaces', workspaceId);

                const [receiptSnap, wsSnap] = await Promise.all([
                    getDoc(receiptRef).catch(() => null),
                    getDoc(wsRef).catch(() => null)
                ]);

                const receiptData = receiptSnap && receiptSnap.exists() ? receiptSnap.data() : {};
                const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};

                // Check local offline fallback if Firestore had no data
                let localOffline = {};
                try {
                    const rawOff = localStorage.getItem(`pricelister_offline_settings_${workspaceId}`);
                    if (rawOff) localOffline = JSON.parse(rawOff) || {};
                } catch (e) {}

                const localCurrency = localStorage.getItem('pricelister_currency_symbol') || '$';
                const resolvedCurrency = receiptData["Currency"] || wsData.currency || wsData.currencySymbol || localCurrency;
                setAppCurrencySymbol(resolvedCurrency);

                return {
                    enableVending: receiptData["Vending"] !== undefined ? Boolean(receiptData["Vending"]) : (wsData.enableVending !== undefined ? Boolean(wsData.enableVending) : false),
                    shopName: receiptData["Shop Name"] || wsData.tradeName || wsData.shopName || wsData.name || '',
                    tradeName: wsData.tradeName || receiptData["Shop Name"] || wsData.name || '',
                    country: wsData.country || wsData.operatedCountry || receiptData["Country"] || 'United States',
                    operatedCountry: wsData.operatedCountry || wsData.country || receiptData["Country"] || 'United States',
                    industry: wsData.industry || wsData.category || 'General',
                    tagline: wsData.tagline || wsData.description || '',
                    description: wsData.description || wsData.tagline || 'Main',
                    website: wsData.website || '',
                    taxId: wsData.taxId || wsData.vatNumber || receiptData["Tax Id"] || '',
                    address: receiptData["Address / Subtitle"] || wsData.address || '',
                    phone: receiptData["Phone Number"] || wsData.phone || '',
                    supportPhone: wsData.supportPhone || '',
                    endMessage: receiptData["End Massage"] || '',
                    customerName: receiptData["Customer Name"] !== undefined ? receiptData["Customer Name"] : true,
                    customerNumber: receiptData["Customer number"] !== undefined ? receiptData["Customer number"] : true,
                    name: wsData.name || '',
                    email: wsData.email || '',
                    currencySymbol: resolvedCurrency,
                    currency: resolvedCurrency,
                    logoUrl: wsData.logoUrl || wsData.logo || receiptData["Logo Url"] || '',
                    bannerUrl: wsData.bannerUrl || wsData.banner || receiptData["Banner Url"] || '',

                    // Creation & Audit Trail Data Model
                    createdAt: wsData.createdAt || null,
                    createdTimestamp: wsData.createdTimestamp || receiptData["created_timestamp"] || (wsData.createdAt ? new Date(wsData.createdAt).toISOString() : ''),
                    createdDate: wsData.createdDate || receiptData["created_date"] || '',
                    creatorEmail: wsData.creatorEmail || wsData.adminEmail || '',
                    creatorName: wsData.creatorName || wsData.adminName || '',
                    
                    updatedAt: wsData.updatedAt || null,
                    updateTimestamp: wsData.updateTimestamp || receiptData["updated_timestamp"] || '',
                    updatedDate: wsData.updatedDate || (wsData.updatedAt ? new Date(wsData.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''),
                    updatorEmail: wsData.updatorEmail || receiptData["updated_by_email"] || '',
                    updatorName: wsData.updatorName || '',
                    updatorRole: wsData.updatorRole || ''
                };
            } catch (err) {
                console.error("Error fetching workspace settings:", err);
                return {
                    enableVending: false,
                    shopName: '',
                    tradeName: '',
                    industry: 'General',
                    tagline: '',
                    website: '',
                    taxId: '',
                    address: '',
                    phone: '',
                    supportPhone: '',
                    endMessage: '',
                    customerName: true,
                    customerNumber: true,
                    name: '',
                    email: '',
                    currencySymbol: localStorage.getItem('pricelister_currency_symbol') || '$',
                    currency: localStorage.getItem('pricelister_currency_symbol') || '$',
                    logoUrl: '',
                    bannerUrl: ''
                };
            }
        },

        saveWorkspaceSettings: async (settings) => {
            const cleanCurrency = (settings.currencySymbol || settings.currency || '$').trim().substring(0, 3) || '$';
            setAppCurrencySymbol(cleanCurrency);

            if (isMock) {
                let existing = {};
                try {
                    const raw = localStorage.getItem('pricelister_mock_settings');
                    if (raw) existing = JSON.parse(raw) || {};
                } catch (e) {}

                const updatedMock = {
                    ...existing,
                    ...settings,
                    name: settings.name || settings.shopName || existing.name || 'PriceLister Demo Enterprise',
                    shopName: settings.shopName || settings.tradeName || settings.name || existing.shopName || 'PriceLister Demo Enterprise',
                    tradeName: settings.tradeName || settings.shopName || settings.name || existing.tradeName || 'PriceLister Global Commerce',
                    industry: settings.industry || existing.industry || 'Retail & Commerce',
                    tagline: settings.tagline || settings.description || existing.tagline || '',
                    description: settings.description || settings.tagline || existing.description || 'Main',
                    website: settings.website || existing.website || '',
                    taxId: settings.taxId || existing.taxId || '',
                    address: settings.address || existing.address || '',
                    phone: settings.phone || existing.phone || '',
                    supportPhone: settings.supportPhone || existing.supportPhone || '',
                    logoUrl: settings.logoUrl !== undefined ? settings.logoUrl : (existing.logoUrl || ''),
                    bannerUrl: settings.bannerUrl !== undefined ? settings.bannerUrl : (existing.bannerUrl || ''),
                    currency: cleanCurrency,
                    currencySymbol: cleanCurrency,
                    updatedAt: Date.now(),
                    updateTimestamp: new Date().toISOString(),
                    updatedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    updatorEmail: 'developer@local.test',
                    updatorName: 'Demo Admin',
                    updatorRole: 'CREATOR_ADMIN'
                };

                try {
                    localStorage.setItem('pricelister_mock_settings', JSON.stringify(updatedMock));
                    localStorage.setItem('pricelister_currency_symbol', cleanCurrency);
                } catch (e) {}

                if (window.__activeWorkspace) {
                    Object.assign(window.__activeWorkspace, updatedMock);
                }
                return true;
            }

            const currentUser = authService.getCurrentUser();
            const now = new Date();
            const nowEpoch = now.getTime();
            const nowIso = now.toISOString();
            const nowFormatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const updatorEmail = currentUser?.email || settings.email || '';
            const updatorUid = currentUser?.uid || '';
            const updatorName = currentUser?.displayName || (updatorEmail ? updatorEmail.split('@')[0] : 'Admin');

            const receiptRef = doc(db, 'ReceiptData', workspaceId);
            const wsRef = doc(db, 'Workspaces', workspaceId);

            const receiptPayload = {
                "Vending": Boolean(settings.enableVending),
                "Shop Name": settings.shopName || settings.tradeName || settings.name || '',
                "Address / Subtitle": settings.address || '',
                "Phone Number": settings.phone || '',
                "End Massage": settings.endMessage || '',
                "Customer Name": settings.customerName !== undefined ? settings.customerName : true,
                "Customer number": settings.customerNumber !== undefined ? settings.customerNumber : true,
                "Currency": cleanCurrency,
                "updated_by_email": updatorEmail,
                "updated_timestamp": nowIso,
                "last_updated": now
            };

            if (settings.taxId !== undefined) {
                receiptPayload["Tax Id"] = settings.taxId;
            }
            if (settings.logoUrl !== undefined) {
                receiptPayload["Logo Url"] = settings.logoUrl;
            }
            if (settings.bannerUrl !== undefined) {
                receiptPayload["Banner Url"] = settings.bannerUrl;
            }

            const wsPayload = {
                name: settings.name || settings.shopName || '',
                tradeName: settings.tradeName || settings.shopName || settings.name || '',
                industry: settings.industry || 'General',
                tagline: settings.tagline || settings.description || '',
                description: settings.description || settings.tagline || 'Main',
                website: settings.website || '',
                taxId: settings.taxId || '',
                email: settings.email || '',
                phone: settings.phone || '',
                supportPhone: settings.supportPhone || '',
                address: settings.address || '',
                currency: cleanCurrency,
                currencySymbol: cleanCurrency,
                enableVending: Boolean(settings.enableVending),

                // Audit Trail
                updatedAt: nowEpoch,
                updateTimestamp: nowIso,
                updatedDate: nowFormatted,
                updatorEmail: updatorEmail,
                updatorUid: updatorUid,
                updatorName: updatorName,
                updatorRole: settings.userRole || 'ADMIN'
            };

            if (settings.logoUrl !== undefined) {
                wsPayload.logoUrl = settings.logoUrl;
                wsPayload.logo = settings.logoUrl;
            }
            if (settings.bannerUrl !== undefined) {
                wsPayload.bannerUrl = settings.bannerUrl;
                wsPayload.banner = settings.bannerUrl;
            }

            // Save local cache mirror immediately
            try {
                localStorage.setItem(`pricelister_offline_settings_${workspaceId}`, JSON.stringify({ ...receiptPayload, ...wsPayload }));
                localStorage.setItem('pricelister_currency_symbol', cleanCurrency);
            } catch (e) {}

            if (window.__activeWorkspace) {
                Object.assign(window.__activeWorkspace, wsPayload);
            }

            try {
                await Promise.all([
                    setDoc(receiptRef, receiptPayload, { merge: true }),
                    setDoc(wsRef, wsPayload, { merge: true })
                ]);
            } catch (cloudErr) {
                console.warn("Firestore settings cloud write warning (stored in local storage mirror):", cloudErr);
            }

            return true;
        },

        isVendingEnabled: async () => {
            if (isMock) return true;
            try {
                const receiptRef = doc(db, 'ReceiptData', workspaceId);
                const snap = await getDoc(receiptRef);
                if (snap && snap.exists() && snap.data()["Vending"] !== undefined) {
                    return Boolean(snap.data()["Vending"]);
                }
                const wsRef = doc(db, 'Workspaces', workspaceId);
                const wsSnap = await getDoc(wsRef);
                if (wsSnap && wsSnap.exists() && wsSnap.data().enableVending !== undefined) {
                    return Boolean(wsSnap.data().enableVending);
                }
            } catch (e) {
                console.warn("Failed to check vending status:", e);
            }
            return false;
        },

        getCustomerPanelSettings: async (overrideUid = null) => {
            if (isMock) {
                return {
                    isPublished: true,
                    enabled: true,
                    storeName: 'PriceLister Demo Enterprise',
                    announcement: 'Welcome to our online demo catalog! Browse items and calculate total or place orders.',
                    termsAndConditions: '• Prices are subject to change without prior notice.\n• Stock availability is updated in real time.\n• For questions or orders, please contact us.',
                    categorySelectionMode: 'ALL',
                    allowedCategories: [],
                    showMrp: true,
                    showStockBadge: true,
                    whatsappNumber: '+1 (555) 019-2834',
                    phone: '+1 (555) 019-2834',
                    email: 'developer@local.test',
                    address: '100 Silicon Way, Suite 400, San Jose, CA',
                    closedMessage: 'Temporary Closed\nShop is temporarily suspended, may start early.',
                    currencySymbol: '$',
                    publishedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    uid: 'dev-mock-uid'
                };
            }

            try {
                const uid = overrideUid || authService?.getCurrentUser()?.uid || workspaceId;
                
                // Read from subfield: Workspaces/{workspaceId}/CustomerPanel/{uid}
                const subfieldRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', uid);
                const subfieldGlobalRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', 'settings');
                const receiptRef = doc(db, 'ReceiptData', workspaceId);
                const wsRef = doc(db, 'Workspaces', workspaceId);
                const panelRef = doc(db, 'CustomerPanelSettings', workspaceId);

                const [subfieldSnap, subfieldGlobalSnap, receiptSnap, wsSnap, panelSnap] = await Promise.all([
                    getDoc(subfieldRef).catch(() => null),
                    getDoc(subfieldGlobalRef).catch(() => null),
                    getDoc(receiptRef).catch(() => null),
                    getDoc(wsRef).catch(() => null),
                    getDoc(panelRef).catch(() => null)
                ]);

                // Also attempt reading any document in CustomerPanel subcollection if specific UID wasn't found
                let subfieldData = (subfieldSnap && subfieldSnap.exists()) 
                    ? subfieldSnap.data() 
                    : ((subfieldGlobalSnap && subfieldGlobalSnap.exists()) ? subfieldGlobalSnap.data() : null);

                if (!subfieldData) {
                    try {
                        const subColRef = collection(db, 'Workspaces', workspaceId, 'CustomerPanel');
                        const subColSnap = await getDocs(subColRef).catch(() => null);
                        if (subColSnap && !subColSnap.empty) {
                            subfieldData = subColSnap.docs[0].data();
                        }
                    } catch (e) {}
                }

                const receiptData = receiptSnap && receiptSnap.exists() ? receiptSnap.data() : {};
                const panelData = panelSnap && panelSnap.exists() ? panelSnap.data() : {};
                const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};
                const embeddedData = wsData.customerPanel || receiptData.customerPanel || {};

                // Local cache fallback
                let localCached = {};
                try {
                    const raw = localStorage.getItem(`pricelister_customer_panel_${workspaceId}`);
                    if (raw) localCached = JSON.parse(raw) || {};
                } catch (e) {}

                // Merge data giving priority to subfield > embedded ws/receiptData > standalone collection > local cache
                const merged = { ...localCached, ...embeddedData, ...panelData, ...(subfieldData || {}) };

                const defaultStoreName = merged.storeName || wsData.name || receiptData["Shop Name"] || 'PriceLister Store';
                const defaultCurrency = wsData.currency || wsData.currencySymbol || receiptData["Currency"] || localStorage.getItem('pricelister_currency_symbol') || '$';

                // isPublished / enabled flag
                const isPublished = merged.isPublished !== undefined 
                    ? Boolean(merged.isPublished) 
                    : (merged.enabled !== undefined ? Boolean(merged.enabled) : (receiptData.customerPanelPublished !== undefined ? Boolean(receiptData.customerPanelPublished) : false));

                return {
                    isPublished: isPublished,
                    enabled: isPublished,
                    brandingMode: merged.brandingMode || 'PRICELISTER', // 'PRICELISTER', 'CUSTOM', 'WORKSPACE'
                    storeName: defaultStoreName,
                    storeLogo: merged.storeLogo || '',
                    workspaceLogo: merged.workspaceLogo || wsData.logoUrl || wsData.imageUri || receiptData["Logo Url"] || '',
                    customSlug: merged.customSlug || '',
                    deployCountry: merged.deployCountry || 'Global',
                    announcement: merged.announcement || 'Welcome to our online catalog! Browse items and add to cart to calculate total or order directly.',
                    termsAndConditions: merged.termsAndConditions || '• Prices are subject to change without prior notice.\n• Stock availability is updated in real time.\n• For questions or orders, please contact us.',
                    categorySelectionMode: merged.categorySelectionMode || 'ALL', // 'ALL' or 'SPECIFIC'
                    allowedCategories: Array.isArray(merged.allowedCategories) ? merged.allowedCategories : [],
                    showMrp: merged.showMrp !== undefined ? Boolean(merged.showMrp) : true,
                    showStockBadge: merged.showStockBadge !== undefined ? Boolean(merged.showStockBadge) : true,
                    whatsappNumber: merged.whatsappNumber || wsData.phone || receiptData["Phone Number"] || '',
                    phone: merged.phone || wsData.phone || receiptData["Phone Number"] || '',
                    email: merged.email || wsData.email || '',
                    address: merged.address || wsData.address || receiptData["Address / Subtitle"] || '',
                    closedMessage: merged.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.',
                    currencySymbol: merged.currencySymbol || defaultCurrency,
                    publishedAt: merged.publishedAt || null,
                    updatedAt: merged.updatedAt || null,
                    uid: uid
                };
            } catch (err) {
                console.error("Error loading customer panel settings:", err);
                return {
                    isPublished: false,
                    enabled: false,
                    brandingMode: 'PRICELISTER',
                    storeName: 'PriceLister Store',
                    storeLogo: '',
                    workspaceLogo: '',
                    customSlug: '',
                    deployCountry: 'Global',
                    announcement: 'Welcome to our online catalog!',
                    termsAndConditions: '• Prices are subject to change without prior notice.',
                    categorySelectionMode: 'ALL',
                    allowedCategories: [],
                    showMrp: true,
                    showStockBadge: true,
                    whatsappNumber: '',
                    phone: '',
                    email: '',
                    address: '',
                    closedMessage: 'Temporary Closed\nShop is temporarily suspended, may start early.',
                    currencySymbol: '$',
                    publishedAt: null,
                    updatedAt: null
                };
            }
        },

        saveCustomerPanelSettings: async (panelSettings, overrideUid = null) => {
            const uid = overrideUid || authService?.getCurrentUser()?.uid || workspaceId;
            const isPublished = panelSettings.isPublished !== undefined ? Boolean(panelSettings.isPublished) : Boolean(panelSettings.enabled);

            const payload = {
                isPublished: isPublished,
                enabled: isPublished,
                brandingMode: panelSettings.brandingMode || 'PRICELISTER',
                storeName: (panelSettings.storeName || '').trim(),
                storeLogo: (panelSettings.storeLogo || '').trim(),
                workspaceLogo: (panelSettings.workspaceLogo || '').trim(),
                customSlug: (panelSettings.customSlug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                deployCountry: (panelSettings.deployCountry || 'Global').trim(),
                announcement: (panelSettings.announcement || '').trim(),
                termsAndConditions: (panelSettings.termsAndConditions || '').trim(),
                categorySelectionMode: panelSettings.categorySelectionMode === 'SPECIFIC' ? 'SPECIFIC' : 'ALL',
                allowedCategories: Array.isArray(panelSettings.allowedCategories) ? panelSettings.allowedCategories : [],
                showMrp: Boolean(panelSettings.showMrp),
                showStockBadge: Boolean(panelSettings.showStockBadge),
                whatsappNumber: (panelSettings.whatsappNumber || '').trim(),
                phone: (panelSettings.phone || '').trim(),
                email: (panelSettings.email || '').trim(),
                address: (panelSettings.address || '').trim(),
                closedMessage: (panelSettings.closedMessage || 'Temporary Closed\nShop is temporarily suspended, may start early.').trim(),
                currencySymbol: (panelSettings.currencySymbol || '$').trim(),
                updatedAt: new Date().toISOString(),
                publishedAt: isPublished ? (panelSettings.publishedAt || new Date().toISOString()) : null,
                publishedBy: uid
            };

            // 1. Immediately persist locally so state is never lost in this browser/session
            try {
                localStorage.setItem(`pricelister_customer_panel_${workspaceId}`, JSON.stringify(payload));
                localStorage.setItem(`pricelister_customer_panel_published_${workspaceId}`, isPublished ? 'true' : 'false');
            } catch (e) {
                console.warn("Could not save customer panel to localStorage cache:", e);
            }

            if (isMock) {
                return true;
            }


            // Target 1: Workspaces/{workspaceId}/CustomerPanel/{uid} (Primary user subfield)
            const subfieldRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', uid);
            // Target 2: Workspaces/{workspaceId}/CustomerPanel/settings (Universal workspace subfield)
            const subfieldGlobalRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', 'settings');
            // Target 3: ReceiptData/{workspaceId} (Standard workspace data doc, accessible to all admins/co-admins)
            const receiptRef = doc(db, 'ReceiptData', workspaceId);
            // Target 4: Workspaces/{workspaceId} (Embedded workspace field)
            const wsRef = doc(db, 'Workspaces', workspaceId);
            // Target 5: CustomerPanelSettings/{workspaceId} (Public root collection mirror)
            const panelRef = doc(db, 'CustomerPanelSettings', workspaceId);

            const writeTasks = [
                setDoc(subfieldRef, payload, { merge: true }).catch(err => {
                    console.warn("CustomerPanel subfield write notice:", err.message);
                    return { error: err, target: 'subfieldRef' };
                }),
                setDoc(subfieldGlobalRef, payload, { merge: true }).catch(err => {
                    console.warn("CustomerPanel global subfield write notice:", err.message);
                    return { error: err, target: 'subfieldGlobalRef' };
                }),
                setDoc(receiptRef, { customerPanel: payload, customerPanelPublished: isPublished }, { merge: true }).catch(err => {
                    console.warn("ReceiptData write notice:", err.message);
                    return { error: err, target: 'receiptRef' };
                }),
                setDoc(wsRef, { customerPanel: payload }, { merge: true }).catch(err => {
                    console.warn("Workspaces write notice:", err.message);
                    return { error: err, target: 'wsRef' };
                }),
                setDoc(panelRef, payload, { merge: true }).catch(err => {
                    console.warn("CustomerPanelSettings write notice:", err.message);
                    return { error: err, target: 'panelRef' };
                })
            ];

            const results = await Promise.all(writeTasks);
            const successfulWrites = results.filter(r => !r || !r.error);

            if (successfulWrites.length === 0) {
                console.warn("Firestore cloud write restricted by security rules; stored in offline local storage mirror.");
            }

            return true;
        }
    };
};

