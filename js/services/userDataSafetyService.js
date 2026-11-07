import { firebaseApp } from '../../firebase/firebase-config.js';
import { 
    getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const db = getFirestore(firebaseApp);
const COLLECTION_NAME = 'userCollection';

/**
 * User Collection Service (Permanently saves to /userCollection/{userId})
 * Strictly adheres to Firestore Security Rules:
 * match /userCollection/{userId} {
 *   allow read, write: if isOwner(userId);
 * }
 * Stores permanent personal user data: name (max <100 chars), photoURL (max 5mb), credentials, device list & history.
 * Persists independently across all workspaces.
 */
export const userDataSafetyService = {

    /**
     * Get user doc from /userCollection/{userId}
     */
    getUserDataSafety: async (user) => {
        if (!user) return null;
        const uid = user.uid || (typeof user === 'string' ? user : null);
        const email = user.email || (typeof user === 'string' && user.includes('@') ? user : null);

        // 1. Check local cache first
        const cacheKey = 'pricelister_usercollection_' + (uid || email);
        const legacyCacheKey = 'pricelister_userdata_safety_' + (uid || email);
        let cached = null;
        try {
            const raw = localStorage.getItem(cacheKey) || localStorage.getItem(legacyCacheKey);
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
                console.warn("Could not read remote userCollection, returning cache:", err.message);
            }
        }

        return cached;
    },

    /**
     * Initialize or update User record in /userCollection/{userId} on login, signup, or profile load
     */
    initOrUpdateUser: async (user, authType = 'Email & Password', passwordHash = null, initialWsId = null) => {
        if (!user) return null;
        const uid = user.uid || 'usr_' + Math.random().toString(36).substr(2, 9);
        const email = (user.email || '').trim().toLowerCase();
        const rawName = user.displayName || user.fullName || (email ? email.split('@')[0] : 'PriceLister User');
        const name = (rawName || '').trim().substring(0, 99); // Max char < 100
        const photoURL = user.photoURL || '';

        const deviceInfo = {
            device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser',
            platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown OS',
            language: typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en',
            resolution: typeof window !== 'undefined' ? `${window.screen?.width || 1920}x${window.screen?.height || 1080}` : '1920x1080',
            lastActive: new Date().toISOString()
        };

        const existing = await userDataSafetyService.getUserDataSafety(user);

        // Build updated payload adhering strictly to userCollection schema
        const payload = {
            name: name,
            photoURL: photoURL || existing?.photoURL || '',
            email: email,
            Auth: authType || (existing?.Auth || (user.providerData && user.providerData.some(p => p.providerId === 'google.com') ? 'Google' : 'Email & Password')),
            password: passwordHash || existing?.password || (authType === 'Google' ? '[OAuth: Google]' : ''),
            created: existing?.created || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
        const cacheKey = 'pricelister_usercollection_' + (uid || email);
        const legacyCacheKey = 'pricelister_userdata_safety_' + (uid || email);
        try {
            localStorage.setItem(cacheKey, JSON.stringify(payload));
            localStorage.setItem(legacyCacheKey, JSON.stringify(payload));
            if (email) {
                localStorage.setItem('pricelister_usercollection_' + email, JSON.stringify(payload));
            }
        } catch (e) {}

        // Persist to Firestore: /userCollection/{userId}
        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, payload, { merge: true });
            } catch (err) {
                console.warn("Could not save to remote userCollection (using local cache):", err.message);
            }
        }

        return payload;
    },

    /**
     * Update permanent personal user profile in /userCollection/{userId}
     * Name: Max char < 100
     * Photo: Max 5MB file upload
     */
    updateUserProfile: async (user, { name, photoURL }) => {
        if (!user) return null;
        const uid = user.uid || (typeof user === 'string' ? user : null);
        const email = (user.email || '').trim().toLowerCase();

        const updates = {
            updatedAt: new Date().toISOString()
        };

        if (name !== undefined && name !== null) {
            const trimmedName = String(name).trim().substring(0, 99); // Max char < 100
            updates.name = trimmedName;
        }

        if (photoURL !== undefined && photoURL !== null) {
            updates.photoURL = photoURL;
        }

        // Update local cache immediately
        const cacheKey = 'pricelister_usercollection_' + (uid || email);
        const legacyCacheKey = 'pricelister_userdata_safety_' + (uid || email);
        const existing = await userDataSafetyService.getUserDataSafety(user) || {};
        const merged = { ...existing, ...updates };

        try {
            localStorage.setItem(cacheKey, JSON.stringify(merged));
            localStorage.setItem(legacyCacheKey, JSON.stringify(merged));
            if (email) localStorage.setItem('pricelister_usercollection_' + email, JSON.stringify(merged));
        } catch (e) {}

        // Update Firestore: /userCollection/{userId}
        if (uid && uid !== 'dev-mock-uid') {
            try {
                const userDocRef = doc(db, COLLECTION_NAME, uid);
                await setDoc(userDocRef, updates, { merge: true });
            } catch (err) {
                console.warn("Could not save profile updates to userCollection in Firestore:", err.message);
            }
        }

        return merged;
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
     * Strictly stores the business field ID (e.g. "102ZM5J72FNB99"), NEVER the Firestore document ID (UID).
     */
    recordWorkspaceConnection: async (user, rawWorkspaceId, role, action = 'join') => {
        if (!user || !rawWorkspaceId) return;
        const uid = user.uid || 'usr_unknown';
        const email = (user.email || '').trim().toLowerCase();

        // Resolve clean business field ID:
        let resolvedWsId = rawWorkspaceId;
        if (typeof window !== 'undefined' && window.__activeWorkspace) {
            resolvedWsId = window.__activeWorkspace.workspaceId || window.__activeWorkspace.id || rawWorkspaceId;
        }

        const existing = await userDataSafetyService.getUserDataSafety(user);
        let history = existing?.WorkspaceHistory && Array.isArray(existing.WorkspaceHistory) ? [...existing.WorkspaceHistory] : [];

        if (action === 'join') {
            // Check if already active in this workspace
            const existingEntry = history.find(h => (h.workspaceId === resolvedWsId || h.workspaceId === rawWorkspaceId) && h.status === 'active');
            if (!existingEntry) {
                // If there are other active entries, close them cleanly
                history.forEach(h => {
                    if (h.status === 'active') {
                        h.status = 'leaved';
                        if (!h.leaveDate) h.leaveDate = new Date().toISOString();
                    }
                });
                history.unshift({
                    workspaceId: resolvedWsId,
                    connectionDate: new Date().toISOString(),
                    leaveDate: null,
                    workspaceRole: role || 'WORKER',
                    status: 'active'
                });
            } else {
                existingEntry.workspaceId = resolvedWsId;
                if (role) existingEntry.workspaceRole = role;
                existingEntry.status = 'active';
            }
        } else if (action === 'leave') {
            history.forEach(h => {
                if ((h.workspaceId === resolvedWsId || h.workspaceId === rawWorkspaceId) && h.status === 'active') {
                    h.status = 'leaved';
                    h.leaveDate = new Date().toISOString();
                }
            });
        }

        const updates = {
            connectedWorkspace: action === 'join' ? resolvedWsId : 'Leaved',
            WorkspaceHistory: history
        };

        const cacheKey = 'pricelister_usercollection_' + (uid || email);
        const legacyCacheKey = 'pricelister_userdata_safety_' + (uid || email);
        if (existing) {
            Object.assign(existing, updates);
            try {
                localStorage.setItem(cacheKey, JSON.stringify(existing));
                localStorage.setItem(legacyCacheKey, JSON.stringify(existing));
                if (email) localStorage.setItem('pricelister_usercollection_' + email, JSON.stringify(existing));
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
     * Start/sync Workspace History from current active workspace
     */
    syncCurrentWorkspaceHistory: async (user, workspace) => {
        if (!user || !workspace) return;
        const wsId = workspace.workspaceId || workspace.id;
        const role = workspace.role || 'WORKER';
        return await userDataSafetyService.recordWorkspaceConnection(user, wsId, role, 'join');
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

export const userCollectionService = userDataSafetyService;


