import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';
import { setAppCurrencySymbol } from '../utilities.js';
import { authService } from '../../firebase/auth.js';

const db = getFirestore(firebaseApp);

export const getSettingsService = (workspaceId) => {
    return {
        getWorkspaceSettings: async () => {
            if (workspaceId === 'ws_dev_mock') {
                setAppCurrencySymbol('$');
                return {
                    enableVending: true,
                    shopName: 'PriceLister Demo Enterprise',
                    address: '100 Silicon Way, Suite 400, San Jose, CA',
                    phone: '+1 (555) 019-2834',
                    endMessage: 'Thank you for choosing PriceLister Enterprise!',
                    customerName: true,
                    customerNumber: true,
                    name: 'PriceLister Demo Enterprise',
                    email: 'developer@local.test',
                    currencySymbol: '$',
                    currency: '$'
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
                    currency: resolvedCurrency,
                    logoUrl: wsData.logoUrl || wsData.logo || receiptData["Logo Url"] || '',

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
            const cleanCurrency = (settings.currencySymbol || settings.currency || '$').trim().substring(0, 3) || '$';
            setAppCurrencySymbol(cleanCurrency);

            if (workspaceId === 'ws_dev_mock') {
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
                "Shop Name": settings.shopName || '',
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

            if (settings.logoUrl !== undefined) {
                receiptPayload["Logo Url"] = settings.logoUrl;
            }

            const wsPayload = {
                name: settings.name || settings.shopName || '',
                email: settings.email || '',
                phone: settings.phone || '',
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

            await Promise.all([
                setDoc(receiptRef, receiptPayload, { merge: true }),
                setDoc(wsRef, wsPayload, { merge: true })
            ]);

            return true;
        },

        isVendingEnabled: async () => {
            if (workspaceId === 'ws_dev_mock') return true;
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
            if (workspaceId === 'ws_dev_mock') {
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

            if (workspaceId === 'ws_dev_mock') {
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

