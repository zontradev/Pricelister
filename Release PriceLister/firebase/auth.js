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
        // If user explicitly signed out, do not auto-login to demo or any previous session
        const isExplicitSignedOut = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_signed_out') === 'true';
        if (isExplicitSignedOut) {
            setTimeout(() => callback(null), 0);
            return () => {};
        }

        // If developer is using the offline test session or demo mode, immediately provide demo user
        const devSession = localStorage.getItem('mock_dev_session');
        const activeWs = localStorage.getItem('pricelister_active_ws');
        const isLocalHost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.protocol === 'file:'
        );
        const isLandingPage = typeof window !== 'undefined' && (
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/index.html') ||
            window.location.pathname.endsWith('/home') ||
            window.location.pathname.endsWith('/explore') ||
            window.location.pathname.endsWith('/pricing') ||
            window.location.pathname.endsWith('/find') ||
            window.location.pathname.endsWith('/privacy') ||
            window.location.pathname.endsWith('/terms')
        );
        const isDemo = activeWs === 'ws_dev_mock' || 
                       activeWs === 'demo' || 
                       Boolean(devSession) || 
                       (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo')) ||
                       (isLocalHost && !isLandingPage && (!activeWs || activeWs === 'ws_dev_mock'));

        if (isDemo) {
            let user = null;
            if (devSession) {
                try { user = JSON.parse(devSession); } catch (e) {}
            }
            // Sanitize: ensure user is a valid object with uid, not a boolean or invalid string
            if (!user || typeof user !== 'object' || !user.uid) {
                user = {
                    uid: 'dev-mock-uid',
                    email: 'developer@local.test',
                    displayName: 'Demo Admin (Testing)',
                    photoURL: null,
                    role: 'CREATOR_ADMIN'
                };
                localStorage.setItem('mock_dev_session', JSON.stringify(user));
            }
            localStorage.setItem('pricelister_active_ws', 'ws_dev_mock');
            authService.saveAccountToRegistry(user);
            setTimeout(() => callback(user), 0);
            return () => {}; // dummy unsubscribe
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
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('pricelister_signed_out');
            }
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
            const isLocalHost = typeof window !== 'undefined' && (
                window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1' || 
                window.location.protocol === 'file:'
            );
            if (CONFIG.APP_MODE === 'test' || isLocalHost) {
                console.info("Fallback to dev mock account due to local/test environment error:", error?.code || error?.message);
                return await authService.loginAsGuest();
            }
            throw error;
        }
    },
    
    loginAsGuest: async () => {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
        }
        // Purely local mock session with full admin privileges for UI testing
        const mockUser = {
            uid: 'dev-mock-uid',
            email: 'developer@local.test',
            displayName: 'Demo Admin (Testing)',
            photoURL: null,
            role: 'CREATOR_ADMIN'
        };
        localStorage.setItem('mock_dev_session', JSON.stringify(mockUser));
        localStorage.setItem('pricelister_active_ws', 'ws_dev_mock');
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
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('pricelister_signed_out', 'true');
            }
            localStorage.removeItem('mock_dev_session');
            localStorage.removeItem('pricelister_active_ws');
            try {
                await firebaseSignOut(auth);
            } catch (e) {}
            
            // Redirect to home impression panel
            if (typeof window !== 'undefined') {
                window.location.href = '/home';
            }
        } catch (error) {
            console.error("Logout Error:", error);
            if (typeof window !== 'undefined') {
                window.location.href = '/home';
            }
        }
    },
    
    getCurrentUser: () => {
        const isExplicitSignedOut = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_signed_out') === 'true';
        if (isExplicitSignedOut) {
            return null;
        }

        const devSession = localStorage.getItem('mock_dev_session');
        const activeWs = localStorage.getItem('pricelister_active_ws');
        const isLocalHost = typeof window !== 'undefined' && (
            window.location.hostname === 'localhost' || 
            window.location.hostname === '127.0.0.1' || 
            window.location.protocol === 'file:'
        );
        const isLandingPage = typeof window !== 'undefined' && (
            window.location.pathname === '/' ||
            window.location.pathname.endsWith('/index.html') ||
            window.location.pathname.endsWith('/home') ||
            window.location.pathname.endsWith('/explore') ||
            window.location.pathname.endsWith('/pricing') ||
            window.location.pathname.endsWith('/find') ||
            window.location.pathname.endsWith('/privacy') ||
            window.location.pathname.endsWith('/terms')
        );
        const isDemo = activeWs === 'ws_dev_mock' || 
                       activeWs === 'demo' || 
                       Boolean(devSession) || 
                       (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo')) ||
                       (isLocalHost && !isLandingPage && (!activeWs || activeWs === 'ws_dev_mock'));

        if (isDemo) {
            let user = null;
            if (devSession) {
                try { user = JSON.parse(devSession); } catch (e) {}
            }
            if (user && typeof user === 'object' && user.uid) {
                return user;
            }
            return {
                uid: 'dev-mock-uid',
                email: 'developer@local.test',
                displayName: 'Demo Admin (Testing)',
                photoURL: null,
                role: 'CREATOR_ADMIN'
            };
        }
        return auth.currentUser;
    }
};


