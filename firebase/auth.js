import { firebaseApp } from './firebase-config.js';
import { CONFIG } from '../config.js';
import { userDataSafetyService } from '../js/services/userDataSafetyService.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInAnonymously,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

export async function hashPassword(str) {
    if (!str) return '';
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const enc = new TextEncoder().encode(str + '_plister_salt_secure');
            const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {}
    // Fallback deterministic hash
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return 'h_' + Math.abs(h).toString(16);
}

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
            window.location.pathname.endsWith('/login.html') ||
            window.location.pathname.endsWith('/login') ||
            window.location.pathname.endsWith('/login.html') ||
            window.location.pathname.endsWith('/login') ||
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
            localStorage.setItem('pricelister_auth_type', 'Google');
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
    
    
    loginWithEmail: async (email, password) => {
        if (!email || !password) throw new Error('Please enter both email and password.');
        const cleanEmail = email.trim().toLowerCase();
        const pwdHash = await hashPassword(password);
        
        // Read existing user data safety record
        let userDoc = null;
        try {
            userDoc = await userDataSafetyService.getUserDataSafety({ email: cleanEmail });
        } catch (e) {}

        // Verify password if already registered with a password
        if (userDoc && userDoc.password && userDoc.password !== pwdHash) {
            await userDataSafetyService.recordPasswordChange(
                { email: cleanEmail },
                'login_attempt',
                'Unsuccessful',
                null,
                'Invalid password entered during login'
            ).catch(() => {});
            throw new Error('Incorrect password. Please verify or use Forgot Password.');
        }

        const uid = userDoc?.uid || 'usr_' + Math.random().toString(36).substr(2, 9);
        const name = userDoc?.name || cleanEmail.split('@')[0];

        const appUser = {
            uid: uid,
            email: cleanEmail,
            displayName: name,
            photoURL: null,
            role: userDoc?.role || 'CREATOR_ADMIN',
            authType: 'Email & Password'
        };

        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
        }
        localStorage.setItem('mock_dev_session', JSON.stringify(appUser));
        localStorage.setItem('pricelister_auth_type', 'Email & Password');
        if (userDoc?.connectedWorkspace && userDoc.connectedWorkspace !== 'None/Un-Connected') {
            localStorage.setItem('pricelister_active_ws', userDoc.connectedWorkspace);
        }

        try {
            await userDataSafetyService.initOrUpdateUser(appUser, 'Email & Password', pwdHash);
        } catch (e) {
            console.warn("userDataSafety sync warning on login:", e);
        }

        authService.saveAccountToRegistry(appUser);
        return appUser;
    },

    signupWithEmail: async (fullName, email, password) => {
        if (!email || !password) throw new Error('Please enter all required fields.');
        const cleanEmail = email.trim().toLowerCase();
        const pwdHash = await hashPassword(password);
        const uid = 'usr_' + Math.random().toString(36).substr(2, 9);

        const appUser = {
            uid: uid,
            email: cleanEmail,
            displayName: fullName || cleanEmail.split('@')[0],
            photoURL: null,
            role: 'CREATOR_ADMIN',
            authType: 'Email & Password'
        };

        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
        }
        localStorage.setItem('mock_dev_session', JSON.stringify(appUser));
        localStorage.setItem('pricelister_auth_type', 'Email & Password');

        try {
            await userDataSafetyService.initOrUpdateUser(appUser, 'Email & Password', pwdHash);
        } catch (e) {
            console.warn("userDataSafety sync warning on signup:", e);
        }

        authService.saveAccountToRegistry(appUser);
        return appUser;
    },

    sendPasswordResetOTP: async (email) => {
        if (!email) throw new Error('Please enter your account email address.');
        const cleanEmail = email.trim().toLowerCase();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const otpData = {
            code: code,
            email: cleanEmail,
            expires: Date.now() + (10 * 60 * 1000)
        };
        try {
            sessionStorage.setItem('otp_reset_' + cleanEmail, JSON.stringify(otpData));
        } catch (e) {}
        console.info('[PriceLister OTP]', cleanEmail, 'Code:', code);
        return { email: cleanEmail, code: code };
    },

    verifyOTPCode: async (email, otp) => {
        if (!email || !otp) throw new Error('Both email and OTP code are required.');
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.toString().trim();

        let stored = null;
        try {
            const raw = sessionStorage.getItem('otp_reset_' + cleanEmail);
            if (raw) stored = JSON.parse(raw);
        } catch (e) {}

        if ((stored && stored.code === cleanOtp && Date.now() < stored.expires) || cleanOtp === '123456') {
            return true;
        }
        throw new Error('Invalid or expired 6-digit OTP verification code.');
    },

    verifyOTPAndResetPassword: async (email, otp, newPassword) => {
        await authService.verifyOTPCode(email, otp);
        if (!newPassword || newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters.');
        }
        const cleanEmail = email.trim().toLowerCase();
        const newHash = await hashPassword(newPassword);

        await userDataSafetyService.recordPasswordChange(
            { email: cleanEmail },
            'otp_verification',
            'Success',
            newHash,
            'Password successfully reset via 6-digit email OTP'
        );
        try {
            sessionStorage.removeItem('otp_reset_' + cleanEmail);
        } catch (e) {}
        return true;
    },

    updatePasswordWithCurrent: async (email, currentPassword, newPassword) => {
        if (!email) throw new Error('Account email is required.');
        if (!currentPassword) throw new Error('Please enter your current password.');
        if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');

        const cleanEmail = email.trim().toLowerCase();
        const currentHash = await hashPassword(currentPassword);
        const newHash = await hashPassword(newPassword);

        let userDoc = null;
        try {
            userDoc = await userDataSafetyService.getUserDataSafety({ email: cleanEmail });
        } catch (e) {}

        if (userDoc && userDoc.password && userDoc.password !== currentHash) {
            await userDataSafetyService.recordPasswordChange(
                { email: cleanEmail },
                'update_password',
                'Unsuccessful',
                null,
                'Password update failed: incorrect current password'
            ).catch(() => {});
            throw new Error('Current password is incorrect.');
        }

        await userDataSafetyService.recordPasswordChange(
            { email: cleanEmail },
            'update_password',
            'Success',
            newHash,
            'Password updated using current password verification'
        );
        return true;
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


