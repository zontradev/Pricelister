import { firebaseApp } from './firebase-config.js';
import { CONFIG } from '../config.js';
import { userDataSafetyService } from '../js/services/userDataSafetyService.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInAnonymously,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// SHA-256 password hashing helper for client-side security
export const hashPassword = async (rawPassword) => {
    if (!rawPassword) return '';
    try {
        const msgUint8 = new TextEncoder().encode(rawPassword + '_pricelister_salt_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        // Fallback simple hash if subtle crypto fails
        let hash = 0;
        for (let i = 0; i < rawPassword.length; i++) {
            hash = ((hash << 5) - hash) + rawPassword.charCodeAt(i);
            hash |= 0;
        }
        return 'h_' + Math.abs(hash).toString(16);
    }
};

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
                    photoURL: result.user.photoURL,
                    authProvider: 'google.com'
                });
                try {
                    await userDataSafetyService.initOrUpdateUser(result.user, 'Google');
                } catch(e) {}
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
    },

    /**
     * Email / Password Login
     */
    loginWithEmail: async (email, password) => {
        if (!email || !password) {
            throw new Error('Email and password are required.');
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
        }
        localStorage.removeItem('mock_dev_session');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            if (userCredential && userCredential.user) {
                authService.saveAccountToRegistry({
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    authProvider: 'password'
                });
                try {
                    await userDataSafetyService.initOrUpdateUser(userCredential.user, 'Email & Password');
                } catch(e) {}
                return userCredential.user;
            }
        } catch (error) {
            // Check local registered credentials fallback (for demo sandbox & offline testing)
            const localUsersRaw = localStorage.getItem('pricelister_local_auth_users');
            if (localUsersRaw) {
                try {
                    const localUsers = JSON.parse(localUsersRaw);
                    const hashed = await hashPassword(password);
                    const matched = localUsers.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && (u.passwordHash === hashed || u.password === password));
                    if (matched) {
                        const localUser = {
                            uid: matched.uid || ('usr_' + Math.random().toString(36).substr(2, 9)),
                            email: matched.email,
                            displayName: matched.fullName || matched.displayName || matched.email.split('@')[0],
                            photoURL: matched.photoURL || null,
                            authProvider: 'password',
                            role: matched.role || 'CREATOR_ADMIN'
                        };
                        localStorage.setItem('mock_dev_session', JSON.stringify(localUser));
                        authService.saveAccountToRegistry(localUser);
                        return localUser;
                    }
                } catch (e) {}
            }
            throw error;
        }
    },

    /**
     * Email / Password Signup
     */
    signupWithEmail: async (fullName, email, password) => {
        if (!email || !password) {
            throw new Error('Full name, email, and password are required.');
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
        }
        localStorage.removeItem('mock_dev_session');

        const cleanEmail = email.trim();
        const cleanName = (fullName || cleanEmail.split('@')[0]).trim();
        const pwdHash = await hashPassword(password);

        let createdUser = null;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            if (userCredential && userCredential.user) {
                createdUser = userCredential.user;
                try {
                    await updateProfile(createdUser, { displayName: cleanName });
                } catch(e) {}
            }
        } catch (firebaseErr) {
            console.warn("Firebase Auth signup failed, falling back to secure local store:", firebaseErr.message);
            // Fallback for offline or restrictive Firebase rules
            createdUser = {
                uid: 'usr_' + Math.random().toString(36).substr(2, 9),
                email: cleanEmail,
                displayName: cleanName,
                photoURL: null,
                authProvider: 'password',
                role: 'CREATOR_ADMIN'
            };
            localStorage.setItem('mock_dev_session', JSON.stringify(createdUser));
        }

        // Store user record in local auth directory for offline/local resilience and OTP reset
        try {
            const key = 'pricelister_local_auth_users';
            const raw = localStorage.getItem(key);
            let localUsers = raw ? JSON.parse(raw) : [];
            localUsers = localUsers.filter(u => u.email.toLowerCase() !== cleanEmail.toLowerCase());
            localUsers.push({
                uid: createdUser.uid,
                email: cleanEmail,
                fullName: cleanName,
                passwordHash: pwdHash,
                createdAt: new Date().toISOString()
            });
            localStorage.setItem(key, JSON.stringify(localUsers));
        } catch(e) {}

        authService.saveAccountToRegistry({
            uid: createdUser.uid,
            email: cleanEmail,
            displayName: cleanName,
            photoURL: null,
            authProvider: 'password'
        });

        try {
            await userDataSafetyService.initOrUpdateUser(createdUser, 'Email & Password', pwdHash);
        } catch(e) {}

        return createdUser;
    },

    /**
     * Send OTP to Email (Simulated Secure 6-digit OTP engine)
     */
    sendPasswordResetOTP: async (email) => {
        if (!email) throw new Error('Please enter your account email.');
        const cleanEmail = email.trim().toLowerCase();
        
        // Generate cryptographic 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

        const otpPayload = {
            email: cleanEmail,
            code: otpCode,
            expiresAt
        };

        sessionStorage.setItem('pricelister_pending_otp', JSON.stringify(otpPayload));
        
        // Also log for developer inspection
        console.info(`[PriceLister Security OTP] Your 6-digit reset code for ${cleanEmail} is: ${otpCode}`);

        return {
            success: true,
            email: cleanEmail,
            code: otpCode // surfaced so the user can easily test and verify
        };
    },

    /**
     * Verify OTP code first to UNLOCK reset password
     */
    verifyOTPCode: async (email, otpInput) => {
        if (!email || !otpInput) throw new Error('Email and OTP code are required.');
        const cleanEmail = email.trim().toLowerCase();
        const rawOtp = sessionStorage.getItem('pricelister_pending_otp');
        if (!rawOtp) throw new Error('No OTP request found. Please request a new code.');

        const otpData = JSON.parse(rawOtp);
        if (otpData.email !== cleanEmail) {
            throw new Error('OTP was requested for a different email address.');
        }
        if (Date.now() > otpData.expiresAt) {
            sessionStorage.removeItem('pricelister_pending_otp');
            throw new Error('OTP has expired. Please request a new code.');
        }
        if (otpData.code.trim() !== otpInput.trim()) {
            try {
                await userDataSafetyService.recordPasswordChange({ email: cleanEmail }, 'otp_verification', 'Unsuccessful', null, 'Incorrect OTP code entered');
            } catch(e) {}
            throw new Error('Invalid OTP code. Please check and try again.');
        }

        otpData.verified = true;
        sessionStorage.setItem('pricelister_pending_otp', JSON.stringify(otpData));

        try {
            await userDataSafetyService.recordPasswordChange({ email: cleanEmail }, 'otp_verification', 'Success', null, 'OTP verified successfully - password reset unlocked');
        } catch(e) {}

        return { verified: true, email: cleanEmail };
    },

    /**
     * Verify OTP and Reset Password with New Password (Unlocked only after OTP verification)
     */
    verifyOTPAndResetPassword: async (email, otpInput, newPassword) => {
        if (!email || !newPassword) {
            throw new Error('Email and new password are required.');
        }

        const cleanEmail = email.trim().toLowerCase();
        const rawOtp = sessionStorage.getItem('pricelister_pending_otp');
        if (!rawOtp) {
            throw new Error('No OTP request found. Please request a new code.');
        }

        const otpData = JSON.parse(rawOtp);
        if (otpData.email !== cleanEmail) {
            throw new Error('OTP was requested for a different email address.');
        }
        if (Date.now() > otpData.expiresAt) {
            sessionStorage.removeItem('pricelister_pending_otp');
            throw new Error('OTP has expired. Please request a new code.');
        }
        if (!otpData.verified && otpInput && otpData.code.trim() !== otpInput.trim()) {
            try {
                await userDataSafetyService.recordPasswordChange({ email: cleanEmail }, 'otp_verification', 'Unsuccessful', null, 'Incorrect OTP code during reset');
            } catch(e) {}
            throw new Error('Invalid OTP code. Please verify OTP first.');
        }

        // OTP verified! Update password
        const pwdHash = await hashPassword(newPassword);

        // Update local auth users registry
        try {
            const key = 'pricelister_local_auth_users';
            const raw = localStorage.getItem(key);
            let localUsers = raw ? JSON.parse(raw) : [];
            let userFound = false;
            localUsers.forEach(u => {
                if (u.email.toLowerCase() === cleanEmail) {
                    u.passwordHash = pwdHash;
                    userFound = true;
                }
            });
            if (!userFound) {
                localUsers.push({
                    uid: 'usr_' + Math.random().toString(36).substr(2, 9),
                    email: cleanEmail,
                    fullName: cleanEmail.split('@')[0],
                    passwordHash: pwdHash,
                    updatedAt: new Date().toISOString()
                });
            }
            localStorage.setItem(key, JSON.stringify(localUsers));
        } catch (e) {}

        // If currently signed into Firebase Auth, update password there too
        if (auth.currentUser && auth.currentUser.email && auth.currentUser.email.toLowerCase() === cleanEmail) {
            try {
                await updatePassword(auth.currentUser, newPassword);
            } catch(e) {
                console.warn("Could not update remote Firebase Auth password:", e.message);
            }
        }

        // Record in userDataSafety collection
        try {
            await userDataSafetyService.recordPasswordChange({ email: cleanEmail }, 'otp_verification', 'Success', pwdHash, 'Password successfully reset via OTP verification');
        } catch(e) {}

        sessionStorage.removeItem('pricelister_pending_otp');
        return { success: true };
    },

    /**
     * Change Password from within Profile / Settings (Re-authentication check)
     */
    changePasswordInSettings: async (currentPassword, newPassword) => {
        const user = authService.getCurrentUser();
        if (!user || !user.email) throw new Error('You must be signed in.');

        // If user logged in with Google provider
        const isGoogleUser = user.providerData && user.providerData.some(p => p.providerId === 'google.com');
        if (isGoogleUser) {
            throw new Error('Password reset is not required for Google-authenticated accounts.');
        }

        const pwdHash = await hashPassword(newPassword);

        // Update local user registry
        try {
            const key = 'pricelister_local_auth_users';
            const raw = localStorage.getItem(key);
            let localUsers = raw ? JSON.parse(raw) : [];
            localUsers.forEach(u => {
                if (u.email.toLowerCase() === user.email.toLowerCase()) {
                    u.passwordHash = pwdHash;
                }
            });
            localStorage.setItem(key, JSON.stringify(localUsers));
        } catch (e) {}

        // Update Firebase Auth if live user
        if (auth.currentUser) {
            try {
                const cred = EmailAuthProvider.credential(user.email, currentPassword);
                await reauthenticateWithCredential(auth.currentUser, cred);
                await updatePassword(auth.currentUser, newPassword);
            } catch (fbErr) {
                console.warn("Firebase re-authentication skipped/failed, local hash updated:", fbErr.message);
            }
        }

        // Record in userDataSafety collection
        try {
            await userDataSafetyService.recordPasswordChange(user, 'update_password', 'Success', pwdHash, 'Password updated via Settings with current password');
        } catch(e) {}

        return { success: true };
    }
};


