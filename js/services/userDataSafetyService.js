import { firebaseApp } from '../../firebase/firebase-config.js';
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const db = getFirestore(firebaseApp);
const COLLECTION_NAME = 'userDataSafety';

/**
 * User Data Safety Service
 * Manages the dedicated 'userDataSafety' collection independently from workspace members.
 * Handles user credentials, lifetime update logs, devices, workspace history, and footprint metrics.
 */
export const userDataSafetyService = {

    /**
     * Get user safety doc by user UID or email
     */
    getUserDataSafety: async (user) => {
        if (!user) return null;
        const uid = user.uid || (typeof user === 'string' ? user : null);
        const email = user.email || (typeof user === 'string' && user.includes('@') ? user : null);

        // 1. Check local cache first
        const cacheKey = 'pricelister_userdata_safety_' + (uid || email);
        let cached = null;
        try {
            const raw = localStorage.getItem(cacheKey);
            if (raw) cached = JSON.parse(raw);
        } catch (e) {}

        // 2. Fetch from Firestore if live user
        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                const snap = await getDoc(userDocRef);
                if (snap.exists()) {
                    const data = snap.data();
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    return data;
                }
            } catch (err) {
                console.warn("Could not read remote userDataSafety, returning cache:", err.message);
            }
        }

        return cached;
    },

    /**
     * Initialize or update User Data Safety record on login, signup, or profile load
     */
    initOrUpdateUser: async (user, authType = 'Email & Password', passwordHash = null, initialWsId = null) => {
        if (!user) return null;
        const uid = user.uid || 'usr_' + Math.random().toString(36).substr(2, 9);
        const email = (user.email || '').trim().toLowerCase();
        const name = user.displayName || user.fullName || (email ? email.split('@')[0] : 'PriceLister User');

        const deviceInfo = {
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown OS',
            language: typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en',
            resolution: typeof window !== 'undefined' ? `${window.screen?.width || 1920}x${window.screen?.height || 1080}` : '1920x1080',
            lastActive: new Date().toISOString()
        };

        const existing = await userDataSafetyService.getUserDataSafety(user);

        // Build updated payload adhering strictly to user schema
        const payload = {
            name: name,
            email: email,
            Auth: authType || (existing?.Auth || (user.providerData && user.providerData.some(p => p.providerId === 'google.com') ? 'Google' : 'Email & Password')),
            password: passwordHash || existing?.password || (authType === 'Google' ? '[OAuth: Google]' : ''),
            created: existing?.created || new Date().toISOString(),
            Subscription: existing?.Subscription || 'Free', // Free - Pro - Small Business - Large Business - Market Plan - Lite
            connectedWorkspace: initialWsId || existing?.connectedWorkspace || 'None/Un-Connected',
            SupabaseUsage: existing?.SupabaseUsage || {
                storageBytes: 0,
                fileCount: 0,
                lastSync: new Date().toISOString()
            },
            DataProgress: existing?.DataProgress || {
                firestoreReads: 0,
                firestoreWrites: 0,
                lastActive: new Date().toISOString()
            },
            DataPerformance: existing?.DataPerformance || {
                productCount: 0,
                invoiceCount: 0,
                categoryCount: 0,
                clientCount: 0,
                businessCount: 0,
                lastCalculated: new Date().toISOString()
            },
            // Lifetime update tree list
            LifetimeUpdate: existing?.LifetimeUpdate || [
                {
                    updateTime: new Date().toISOString(),
                    optionUsed: 'account_created',
                    status: 'Success',
                    details: 'Initial account established'
                }
            ],
            // User device tree list
            UserDevice: existing?.UserDevice || [deviceInfo],
            // Workspace history tree list
            WorkspaceHistory: existing?.WorkspaceHistory || (initialWsId && initialWsId !== 'None/Un-Connected' ? [
                {
                    workspaceId: initialWsId,
                    connectionDate: new Date().toISOString(),
                    leaveDate: null,
                    workspaceRole: user.role || 'CREATOR_ADMIN',
                    status: 'active'
                }
            ] : [])
        };

        // Append device if not already present
        if (existing && Array.isArray(payload.UserDevice)) {
            const hasDevice = payload.UserDevice.some(d => d.device === deviceInfo.device);
            if (!hasDevice) {
                payload.UserDevice.push(deviceInfo);
            }
        }

        // Save locally for instant offline UI responsiveness
        const cacheKey = 'pricelister_userdata_safety_' + (uid || email);
        try {
            localStorage.setItem(cacheKey, JSON.stringify(payload));
            if (email) {
                localStorage.setItem('pricelister_userdata_safety_' + email, JSON.stringify(payload));
            }
        } catch (e) {}

        // Persist to Firestore: /userDataSafety/{userId}
        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, payload, { merge: true });
            } catch (err) {
                console.warn("Could not save to remote userDataSafety (using local cache):", err.message);
            }
        }

        return payload;
    },

    /**
     * Record a password change (either through current password update or OTP verification)
     * Appends to LifetimeUpdate tree list with option used and Success/Unsuccessful status
     */
    recordPasswordChange: async (user, optionUsed, status, newPasswordHash, details = '') => {
        if (!user) return;
        const uid = user.uid || 'usr_unknown';
        const email = (user.email || '').trim().toLowerCase();

        const logEntry = {
            updateTime: new Date().toISOString(),
            optionUsed: optionUsed, // 'update_password' | 'otp_verification'
            status: status, // 'Success' | 'Unsuccessful'
            details: details || (status === 'Success' ? `Password updated via ${optionUsed}` : `Password update attempt failed`)
        };

        const existing = await userDataSafetyService.getUserDataSafety(user);
        const updatedLifetime = existing && Array.isArray(existing.LifetimeUpdate) ? [...existing.LifetimeUpdate, logEntry] : [logEntry];

        const updates = {
            LifetimeUpdate: updatedLifetime
        };
        if (status === 'Success' && newPasswordHash) {
            updates.password = newPasswordHash;
        }

        // Update local cache
        const cacheKey = 'pricelister_userdata_safety_' + (uid || email);
        if (existing) {
            Object.assign(existing, updates);
            try {
                localStorage.setItem(cacheKey, JSON.stringify(existing));
                if (email) localStorage.setItem('pricelister_userdata_safety_' + email, JSON.stringify(existing));
            } catch (e) {}
        }

        // Update remote Firestore
        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, updates, { merge: true });
            } catch (err) {
                console.warn("Failed to persist password log to Firestore:", err.message);
            }
        }
    },

    /**
     * Record workspace connection or leave in Workspace History tree list
     */
    recordWorkspaceConnection: async (user, workspaceId, role, action = 'join') => {
        if (!user || !workspaceId) return;
        const uid = user.uid || 'usr_unknown';
        const email = (user.email || '').trim().toLowerCase();

        const existing = await userDataSafetyService.getUserDataSafety(user);
        let history = existing?.WorkspaceHistory ? [...existing.WorkspaceHistory] : [];

        if (action === 'join') {
            // Check if already active in this workspace
            const existingEntry = history.find(h => h.workspaceId === workspaceId && h.status === 'active');
            if (!existingEntry) {
                history.push({
                    workspaceId: workspaceId,
                    connectionDate: new Date().toISOString(),
                    leaveDate: null,
                    workspaceRole: role || 'WORKER',
                    status: 'active'
                });
            }
        } else if (action === 'leave') {
            history.forEach(h => {
                if (h.workspaceId === workspaceId && h.status === 'active') {
                    h.status = 'leaved';
                    h.leaveDate = new Date().toISOString();
                }
            });
        }

        const updates = {
            connectedWorkspace: action === 'join' ? workspaceId : 'Leaved',
            WorkspaceHistory: history
        };

        const cacheKey = 'pricelister_userdata_safety_' + (uid || email);
        if (existing) {
            Object.assign(existing, updates);
            try {
                localStorage.setItem(cacheKey, JSON.stringify(existing));
                if (email) localStorage.setItem('pricelister_userdata_safety_' + email, JSON.stringify(existing));
            } catch (e) {}
        }

        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, updates, { merge: true });
            } catch (err) {
                console.warn("Could not sync workspace history to Firestore:", err.message);
            }
        }
    },

    /**
     * Update Data Performance footprint tree list
     */
    updateDataPerformance: async (user, metrics = {}) => {
        if (!user) return;
        const uid = user.uid || 'usr_unknown';
        const email = (user.email || '').trim().toLowerCase();

        const perfData = {
            productCount: Number(metrics.productCount || 0),
            invoiceCount: Number(metrics.invoiceCount || 0),
            categoryCount: Number(metrics.categoryCount || 0),
            clientCount: Number(metrics.clientCount || 0),
            businessCount: Number(metrics.businessCount || 0),
            lastCalculated: new Date().toISOString()
        };

        const updates = { DataPerformance: perfData };

        const cacheKey = 'pricelister_userdata_safety_' + (uid || email);
        const existing = await userDataSafetyService.getUserDataSafety(user);
        if (existing) {
            existing.DataPerformance = perfData;
            try {
                localStorage.setItem(cacheKey, JSON.stringify(existing));
                if (email) localStorage.setItem('pricelister_userdata_safety_' + email, JSON.stringify(existing));
            } catch (e) {}
        }

        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, updates, { merge: true });
            } catch (err) {}
        }
    }
};

