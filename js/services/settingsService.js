import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

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

                return {
                    enableVending: receiptData["Vending"] !== undefined ? Boolean(receiptData["Vending"]) : (wsData.enableVending !== undefined ? Boolean(wsData.enableVending) : false),
                    shopName: receiptData["Shop Name"] || wsData.name || '',
                    address: receiptData["Address / Subtitle"] || wsData.address || '',
                    phone: receiptData["Phone Number"] || wsData.phone || '',
                    endMessage: receiptData["End Massage"] || '',
                    customerName: receiptData["Customer Name"] !== undefined ? receiptData["Customer Name"] : true,
                    customerNumber: receiptData["Customer number"] !== undefined ? receiptData["Customer number"] : true,
                    name: wsData.name || '',
                    email: wsData.email || ''
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
                    email: ''
                };
            }
        },

        saveWorkspaceSettings: async (settings) => {
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
                "last_updated": new Date()
            };

            const wsPayload = {
                name: settings.name || settings.shopName || '',
                email: settings.email || '',
                phone: settings.phone || '',
                address: settings.address || '',
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
        }
    };
};
