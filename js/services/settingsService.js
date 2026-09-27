import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { setAppCurrencySymbol } from '../utilities.js';
import { authService } from '../../firebase/auth.js';

const db = getFirestore(firebaseApp);

export const getSettingsService = (workspaceId) => {
    return {
        getWorkspaceSettings: async () => {
            try {
                const receiptRef = doc(db, 'ReceiptData', workspaceId);
                const wsRef = doc(db, 'Workspaces', workspaceId);

                const [receiptSnap, wsSnap] = await Promise.all([
                    getDoc(receiptRef).catch(() => null),
                    getDoc(wsRef).catch(() => null)
                ]);

                const receiptData = receiptSnap && receiptSnap.exists() ? receiptSnap.data() : {};
                const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};

                const localCurrency = localStorage.getItem('pricelister_currency_symbol') || '$';
                const resolvedCurrency = receiptData["Currency"] || wsData.currency || wsData.currencySymbol || localCurrency;
                setAppCurrencySymbol(resolvedCurrency);

                return {
                    enableVending: receiptData["Vending"] !== undefined ? Boolean(receiptData["Vending"]) : (wsData.enableVending !== undefined ? Boolean(wsData.enableVending) : false),
                    shopName: receiptData["Shop Name"] || wsData.name || '',
                    address: receiptData["Address / Subtitle"] || wsData.address || '',
                    phone: receiptData["Phone Number"] || wsData.phone || '',
                    endMessage: receiptData["End Massage"] || '',
                    customerName: receiptData["Customer Name"] !== undefined ? receiptData["Customer Name"] : true,
                    customerNumber: receiptData["Customer number"] !== undefined ? receiptData["Customer number"] : true,
                    name: wsData.name || '',
                    email: wsData.email || '',
                    currencySymbol: resolvedCurrency,
                    currency: resolvedCurrency
                };
            } catch (err) {
                console.error("Error fetching workspace settings:", err);
                return {
                    enableVending: false,
                    shopName: '',
                    address: '',
                    phone: '',
                    endMessage: '',
                    customerName: true,
                    customerNumber: true,
                    name: '',
                    email: '',
                    currencySymbol: localStorage.getItem('pricelister_currency_symbol') || '$',
                    currency: localStorage.getItem('pricelister_currency_symbol') || '$'
                };
            }
        },

        saveWorkspaceSettings: async (settings) => {
            const receiptRef = doc(db, 'ReceiptData', workspaceId);
            const wsRef = doc(db, 'Workspaces', workspaceId);

            const cleanCurrency = (settings.currencySymbol || settings.currency || '$').trim().substring(0, 3) || '$';
            setAppCurrencySymbol(cleanCurrency);

            const receiptPayload = {
                "Vending": Boolean(settings.enableVending),
                "Shop Name": settings.shopName || '',
                "Address / Subtitle": settings.address || '',
                "Phone Number": settings.phone || '',
                "End Massage": settings.endMessage || '',
                "Customer Name": settings.customerName !== undefined ? settings.customerName : true,
                "Customer number": settings.customerNumber !== undefined ? settings.customerNumber : true,
                "Currency": cleanCurrency,
                "last_updated": new Date()
            };

            const wsPayload = {
                name: settings.name || settings.shopName || '',
                email: settings.email || '',
                phone: settings.phone || '',
                address: settings.address || '',
                currency: cleanCurrency,
                currencySymbol: cleanCurrency,
                enableVending: Boolean(settings.enableVending)
            };

            await Promise.all([
                setDoc(receiptRef, receiptPayload, { merge: true }),
                setDoc(wsRef, wsPayload, { merge: true })
            ]);

            return true;
        },

        isVendingEnabled: async () => {
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
            try {
                const uid = overrideUid || authService?.getCurrentUser()?.uid || workspaceId;
                
                // Read from subfield: Workspaces/{workspaceId}/CustomerPanel/{uid}
                const subfieldRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', uid);
                const panelRef = doc(db, 'CustomerPanelSettings', workspaceId);
                const wsRef = doc(db, 'Workspaces', workspaceId);

                const [subfieldSnap, panelSnap, wsSnap] = await Promise.all([
                    getDoc(subfieldRef).catch(() => null),
                    getDoc(panelRef).catch(() => null),
                    getDoc(wsRef).catch(() => null)
                ]);

                // Also attempt reading any document in CustomerPanel subcollection if specific UID wasn't found
                let subfieldData = subfieldSnap && subfieldSnap.exists() ? subfieldSnap.data() : null;
                if (!subfieldData) {
                    try {
                        const subColRef = collection(db, 'Workspaces', workspaceId, 'CustomerPanel');
                        const subColSnap = await getDocs(subColRef).catch(() => null);
                        if (subColSnap && !subColSnap.empty) {
                            subfieldData = subColSnap.docs[0].data();
                        }
                    } catch (e) {}
                }

                const panelData = panelSnap && panelSnap.exists() ? panelSnap.data() : {};
                const wsData = wsSnap && wsSnap.exists() ? wsSnap.data() : {};
                const embeddedData = wsData.customerPanel || {};

                // Merge data giving priority to subfield > standalone collection > embedded ws
                const merged = { ...embeddedData, ...panelData, ...(subfieldData || {}) };

                const defaultStoreName = merged.storeName || wsData.name || 'PriceLister Store';
                const defaultCurrency = wsData.currency || wsData.currencySymbol || localStorage.getItem('pricelister_currency_symbol') || '$';

                // isPublished / enabled flag
                const isPublished = merged.isPublished !== undefined ? Boolean(merged.isPublished) : (merged.enabled !== undefined ? Boolean(merged.enabled) : false);

                return {
                    isPublished: isPublished,
                    enabled: isPublished,
                    storeName: defaultStoreName,
                    announcement: merged.announcement || 'Welcome to our online catalog! Browse items and add to cart to calculate total or order directly.',
                    termsAndConditions: merged.termsAndConditions || '• Prices are subject to change without prior notice.\n• Stock availability is updated in real time.\n• For questions or orders, please contact us.',
                    categorySelectionMode: merged.categorySelectionMode || 'ALL', // 'ALL' or 'SPECIFIC'
                    allowedCategories: Array.isArray(merged.allowedCategories) ? merged.allowedCategories : [],
                    showMrp: merged.showMrp !== undefined ? Boolean(merged.showMrp) : true,
                    showStockBadge: merged.showStockBadge !== undefined ? Boolean(merged.showStockBadge) : true,
                    whatsappNumber: merged.whatsappNumber || wsData.phone || '',
                    phone: merged.phone || wsData.phone || '',
                    email: merged.email || wsData.email || '',
                    address: merged.address || wsData.address || '',
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
                    storeName: 'PriceLister Store',
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
            try {
                const uid = overrideUid || authService?.getCurrentUser()?.uid || workspaceId;
                
                // Target 1: Workspaces/{workspaceId}/CustomerPanel/{uid}
                const subfieldRef = doc(db, 'Workspaces', workspaceId, 'CustomerPanel', uid);
                // Target 2: CustomerPanelSettings/{workspaceId} (public mirror for unauthenticated customer page)
                const panelRef = doc(db, 'CustomerPanelSettings', workspaceId);
                // Target 3: Workspaces/{workspaceId} (embedded mirror)
                const wsRef = doc(db, 'Workspaces', workspaceId);

                const isPublished = panelSettings.isPublished !== undefined ? Boolean(panelSettings.isPublished) : Boolean(panelSettings.enabled);

                const payload = {
                    isPublished: isPublished,
                    enabled: isPublished,
                    storeName: (panelSettings.storeName || '').trim(),
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

                await Promise.all([
                    setDoc(subfieldRef, payload, { merge: true }),
                    setDoc(panelRef, payload, { merge: true }),
                    setDoc(wsRef, { customerPanel: payload }, { merge: true })
                ]);

                return true;
            } catch (err) {
                console.error("Error saving customer panel settings:", err);
                throw err;
            }
        }
    };
};

