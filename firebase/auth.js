import { firebaseApp } from './firebase-config.js';
import { CONFIG } from '../config.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInAnonymously,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

export const authService = {
    onAuthStateChanged: (callback) => {
        // If developer is using the offline test session, immediately provide demo user
        const devSession = localStorage.getItem('mock_dev_session');
        if (devSession) {
            try {
                const user = JSON.parse(devSession);
                authService.saveAccountToRegistry(user);
                callback(user);
                return () => {}; // dummy unsubscribe
            } catch (e) {
                localStorage.removeItem('mock_dev_session');
            }
        }

        return firebaseOnAuthStateChanged(auth, (user) => {
            if (user) {
                const appUser = {
                    uid: user.uid,
                    email: user.email || 'user@pricelister.app',
                    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
                    photoURL: user.photoURL || null,
                    role: 'PENDING'
                };
                authService.saveAccountToRegistry(appUser);
                callback(appUser);
            } else {
                callback(null);
            }
        });
    },
    
    loginWithGoogle: async (forceSelectAccount = true) => {
        try {
            // Clear test session when initiating real production Google login
            localStorage.removeItem('mock_dev_session');
            if (forceSelectAccount) {
                googleProvider.setCustomParameters({ prompt: 'select_account' });
            } else {
                googleProvider.setCustomParameters({});
            }
            const result = await signInWithPopup(auth, googleProvider);
            if (result && result.user) {
                authService.saveAccountToRegistry({
                    uid: result.user.uid,
                    email: result.user.email,
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL
                });
            }
            return result.user;
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    },
    
    loginAsGuest: async () => {
        // Purely local mock session with full admin privileges for UI testing
        const mockUser = {
            uid: 'dev-mock-uid',
            email: 'developer@local.test',
            displayName: 'Demo Admin (Testing)',
            photoURL: null,
            role: 'CREATOR_ADMIN'
        };
        localStorage.setItem('mock_dev_session', JSON.stringify(mockUser));
        authService.saveAccountToRegistry(mockUser);
        return mockUser;
    },

    saveAccountToRegistry: (user) => {
        if (!user || !user.email) return;
        try {
            const key = 'pricelister_saved_accounts';
            const raw = localStorage.getItem(key);
            let list = raw ? JSON.parse(raw) : [];
            // Filter out duplicates
            list = list.filter(acc => acc.email.toLowerCase() !== user.email.toLowerCase());
            list.unshift({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                lastActive: Date.now()
            });
            // Keep top 6 accounts
            localStorage.setItem(key, JSON.stringify(list.slice(0, 6)));
        } catch (e) {
            console.warn("Account registry save error:", e);
        }
    },

    getSavedAccounts: () => {
        try {
            const raw = localStorage.getItem('pricelister_saved_accounts');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    },

    removeSavedAccount: (email) => {
        try {
            const key = 'pricelister_saved_accounts';
            const raw = localStorage.getItem(key);
            if (raw) {
                let list = JSON.parse(raw);
                list = list.filter(acc => acc.email.toLowerCase() !== (email || '').toLowerCase());
                localStorage.setItem(key, JSON.stringify(list));
            }
        } catch (e) {
            console.warn("Account removal error:", e);
        }
    },
    
    logout: async () => {
        try {
            localStorage.removeItem('mock_dev_session');
            await firebaseSignOut(auth);
            
            // Force reload to clear mock state properly
            if (!auth.currentUser) {
                window.location.reload();
            }
        } catch (error) {
            console.error("Logout Error:", error);
            throw error;
        }
    },
    
    getCurrentUser: () => {
        const devSession = localStorage.getItem('mock_dev_session');
        if (devSession) {
            try {
                return JSON.parse(devSession);
            } catch (e) {}
        }
        return auth.currentUser;
    }
};


