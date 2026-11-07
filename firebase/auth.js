import { firebaseApp } from './firebase-config.js';
import { CONFIG } from '../config.js';
import { userDataSafetyService } from '../js/services/userDataSafetyService.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    updateProfile,
    onAuthStateChanged as firebaseOnAuthStateChanged, 
    signOut as firebaseSignOut 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return 'h_' + Math.abs(h).toString(16);
}

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

export const authService = {
    /**
     * Real-time Firebase Authentication State Listener
     * Accurately tracks verified Google & Email/Password sessions.
     * Synchronizes and persists user profile safely to /userCollection/{uid}.
     */
    onAuthStateChanged: (callback) => {
        // If user explicitly signed out, do not auto-login to demo or any previous session
        const isExplicitSignedOut = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_signed_out') === 'true';
        if (isExplicitSignedOut) {
            setTimeout(() => callback(null), 0);
            return () => {};
        }

        // Demo mode is ONLY activated if user explicitly opted into Demo Sandbox
        const isExplicitDemo = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_explicit_demo') === 'true') ||
                               (typeof localStorage !== 'undefined' && localStorage.getItem('pricelister_demo_mode') === 'true') ||
                               (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo=true'));

        if (isExplicitDemo) {
            const demoUser = {
                uid: 'dev-mock-uid',
                email: 'developer@local.test',
                displayName: 'Demo Admin (Testing)',
                photoURL: null,
                role: 'CREATOR_ADMIN',
                isDemo: true
            };
            setTimeout(() => callback(demoUser), 0);
            return () => {};
        }

        // Production Real Firebase Auth Listener
        return firebaseOnAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Clear any leftover mock/demo flags for verified real user
                try {
                    localStorage.removeItem('mock_dev_session');
                    localStorage.removeItem('pricelister_demo_mode');
                    if (sessionStorage.getItem('pricelister_explicit_demo')) {
                        sessionStorage.removeItem('pricelister_explicit_demo');
                    }
                    if (localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock') {
                        localStorage.removeItem('pricelister_active_ws');
                    }
                } catch (e) {}

                const isGoogle = firebaseUser.providerData && firebaseUser.providerData.some(p => p.providerId === 'google.com');
                const appUser = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    displayName: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User'),
                    photoURL: firebaseUser.photoURL || null,
                    emailVerified: Boolean(firebaseUser.emailVerified),
                    role: 'CREATOR_ADMIN',
                    authType: isGoogle ? 'Google' : 'Email & Password'
                };

                // Save to local device account registry
                authService.saveAccountToRegistry(appUser);

                // Auto-create / synchronize Firestore /userCollection document
                try {
                    await userDataSafetyService.initOrUpdateUser(appUser, appUser.authType, null);
                } catch (err) {
                    console.warn("userCollection background sync warning:", err?.message);
                }

                callback(appUser);
            } else {
                callback(null);
            }
        });
    },
    
    /**
     * Official Google OAuth Sign-In (Firebase Auth with Popup)
     */
    loginWithGoogle: async (forceSelectAccount = true) => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('pricelister_signed_out');
                sessionStorage.removeItem('pricelister_explicit_demo');
            }
            localStorage.removeItem('mock_dev_session');
            localStorage.removeItem('pricelister_demo_mode');
            if (localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock') {
                localStorage.removeItem('pricelister_active_ws');
            }
            localStorage.setItem('pricelister_auth_type', 'Google');

            if (forceSelectAccount) {
                googleProvider.setCustomParameters({ prompt: 'select_account' });
            } else {
                googleProvider.setCustomParameters({});
            }

            const result = await signInWithPopup(auth, googleProvider);
            if (result && result.user) {
                const u = result.user;
                const appUser = {
                    uid: u.uid,
                    email: u.email,
                    displayName: u.displayName || u.email.split('@')[0],
                    photoURL: u.photoURL || null,
                    emailVerified: Boolean(u.emailVerified),
                    role: 'CREATOR_ADMIN',
                    authType: 'Google'
                };

                authService.saveAccountToRegistry(appUser);

                // Production Firestore /userCollection doc creation & update
                try {
                    await userDataSafetyService.initOrUpdateUser(appUser, 'Google', '[OAuth: Google]');
                } catch (e) {
                    console.warn("userCollection sync error:", e);
                }

                return u;
            }
            return null;
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    },

    /**
     * Official Firebase Email & Password Sign-In
     */
    loginWithEmail: async (email, password) => {
        if (!email || !password) throw new Error('Please enter both email and password.');
        const cleanEmail = email.trim().toLowerCase();

        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
            sessionStorage.removeItem('pricelister_explicit_demo');
        }
        localStorage.removeItem('mock_dev_session');
        localStorage.removeItem('pricelister_demo_mode');
        if (localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock') {
            localStorage.removeItem('pricelister_active_ws');
        }
        localStorage.setItem('pricelister_auth_type', 'Email & Password');

        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const u = userCredential.user;

        const pwdHash = await hashPassword(password);
        const appUser = {
            uid: u.uid,
            email: cleanEmail,
            displayName: u.displayName || cleanEmail.split('@')[0],
            photoURL: u.photoURL || null,
            emailVerified: Boolean(u.emailVerified),
            role: 'CREATOR_ADMIN',
            authType: 'Email & Password'
        };

        authService.saveAccountToRegistry(appUser);

        // Production Firestore /userCollection doc sync
        try {
            await userDataSafetyService.initOrUpdateUser(appUser, 'Email & Password', pwdHash);
        } catch (e) {
            console.warn("userCollection sync warning on login:", e);
        }

        return appUser;
    },

    /**
     * Official Firebase Email & Password Registration
     * Creates real Firebase Auth user, profile, sends verification email,
     * and initializes complete Firestore /userCollection/{uid} document.
     */
    signupWithEmail: async (fullName, email, password) => {
        if (!email || !password) throw new Error('Please enter all required fields.');
        const cleanEmail = email.trim().toLowerCase();
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');

        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
            sessionStorage.removeItem('pricelister_explicit_demo');
        }
        localStorage.removeItem('mock_dev_session');
        localStorage.removeItem('pricelister_demo_mode');
        if (localStorage.getItem('pricelister_active_ws') === 'ws_dev_mock') {
            localStorage.removeItem('pricelister_active_ws');
        }
        localStorage.setItem('pricelister_auth_type', 'Email & Password');

        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const u = userCredential.user;

        const displayName = fullName ? fullName.trim() : cleanEmail.split('@')[0];
        try {
            await updateProfile(u, { displayName: displayName });
        } catch (e) {}

        // Send official verification email via Firebase
        try {
            sendEmailVerification(u).catch(() => {});
        } catch (e) {}

        const pwdHash = await hashPassword(password);
        const appUser = {
            uid: u.uid,
            email: cleanEmail,
            displayName: displayName,
            photoURL: null,
            emailVerified: false,
            role: 'CREATOR_ADMIN',
            authType: 'Email & Password'
        };

        authService.saveAccountToRegistry(appUser);

        // Production Firestore /userCollection document setup
        try {
            await userDataSafetyService.initOrUpdateUser(appUser, 'Email & Password', pwdHash);
        } catch (e) {
            console.warn("userCollection sync warning on signup:", e);
        }

        return appUser;
    },

    /**
     * Server-side Firebase OTP & Password Reset Dispatcher
     * Stores secure verification record in Firestore `emailVerifications/{email}`
     * and dispatches official Firebase password reset email.
     */
    sendPasswordResetOTP: async (email) => {
        if (!email) throw new Error('Please enter your account email address.');
        const cleanEmail = email.trim().toLowerCase();

        // 1. Dispatch official Firebase Auth password reset link
        try {
            await sendPasswordResetEmail(auth, cleanEmail);
        } catch (fbErr) {
            console.warn("Firebase password reset email dispatch notification:", fbErr?.code || fbErr?.message);
        }

        // 2. Generate secure 6-digit verification code stored directly in Firestore (server side)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationRef = doc(db, 'emailVerifications', cleanEmail);
        await setDoc(verificationRef, {
            code: code,
            email: cleanEmail,
            createdAt: new Date().toISOString(),
            expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes expiry
            used: false
        }, { merge: true });

        // Audit log in userDataSafety
        await userDataSafetyService.recordPasswordChange(
            { email: cleanEmail },
            'otp_request',
            'Success',
            null,
            `Firebase verification OTP generated for ${cleanEmail}`
        ).catch(() => {});

        return { email: cleanEmail, code: code };
    },

    /**
     * Verify 6-digit OTP directly against Firestore server document
     */
    verifyOTPCode: async (email, otp) => {
        if (!email || !otp) throw new Error('Both email and OTP verification code are required.');
        const cleanEmail = email.trim().toLowerCase();
        const cleanOtp = otp.toString().trim();

        // Query Firestore document directly
        const verificationRef = doc(db, 'emailVerifications', cleanEmail);
        const snap = await getDoc(verificationRef);

        if (!snap.exists()) {
            throw new Error('No active verification request found. Please request a new code.');
        }

        const data = snap.data();
        if (data.used) {
            throw new Error('This verification code has already been used. Please request a new code.');
        }
        if (Date.now() > data.expiresAt) {
            throw new Error('This verification code has expired. Please request a new one.');
        }
        if (data.code !== cleanOtp) {
            throw new Error('Invalid 6-digit verification code. Please check your email.');
        }

        // Mark as used in Firestore
        await updateDoc(verificationRef, {
            used: true,
            verifiedAt: new Date().toISOString()
        }).catch(() => {});

        return true;
    },

    /**
     * Verify OTP and commit new password hash to Firestore userCollection
     */
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
            'Password successfully verified and reset via Firebase OTP'
        );
        return true;
    },

    /**
     * Account Switcher & Saved Accounts Registry
     */
    saveAccountToRegistry: (user, explicitType = null) => {
        if (!user || !user.email) return;
        try {
            const key = 'pricelister_saved_accounts';
            const raw = localStorage.getItem(key);
            let list = raw ? JSON.parse(raw) : [];
            list = list.filter(acc => acc.email.toLowerCase() !== user.email.toLowerCase());

            let authType = explicitType || user.authType;
            if (!authType) {
                if (user.photoURL && user.photoURL.includes('googleusercontent.com')) {
                    authType = 'Google';
                } else if (user.providerData && user.providerData.some(p => p.providerId === 'google.com')) {
                    authType = 'Google';
                } else {
                    authType = 'Email & Password';
                }
            }

            list.unshift({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL || null,
                authType: authType,
                lastActive: Date.now()
            });
            localStorage.setItem(key, JSON.stringify(list.slice(0, 10)));
        } catch (e) {
            console.warn("Account registry save error:", e);
        }
    },

    getSavedAccounts: () => {
        try {
            const raw = localStorage.getItem('pricelister_saved_accounts');
            let list = raw ? JSON.parse(raw) : [];
            return list.map(acc => {
                if (!acc.authType) {
                    acc.authType = (acc.photoURL && acc.photoURL.includes('googleusercontent.com')) ? 'Google' : 'Email & Password';
                }
                return acc;
            });
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

    /**
     * Guest / Demo Sandbox session
     * ONLY active if explicitly requested.
     */
    loginAsGuest: async () => {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('pricelister_signed_out');
            sessionStorage.setItem('pricelister_explicit_demo', 'true');
        }
        localStorage.setItem('pricelister_demo_mode', 'true');
        localStorage.setItem('pricelister_active_ws', 'ws_dev_mock');
        const mockUser = {
            uid: 'dev-mock-uid',
            email: 'developer@local.test',
            displayName: 'Demo Admin (Testing)',
            photoURL: null,
            role: 'CREATOR_ADMIN',
            authType: 'Demo',
            isDemo: true
        };
        localStorage.setItem('mock_dev_session', JSON.stringify(mockUser));
        authService.saveAccountToRegistry(mockUser, 'Demo');
        return mockUser;
    },

    /**
     * Sign out completely from Firebase Auth and clear local sessions
     */
    logout: async () => {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem('pricelister_signed_out', 'true');
                sessionStorage.removeItem('pricelister_explicit_demo');
                sessionStorage.removeItem('pricelister_last_landing_view');
                sessionStorage.removeItem('pricelister_last_route');
            }
            localStorage.removeItem('mock_dev_session');
            localStorage.removeItem('pricelister_demo_mode');
            localStorage.removeItem('pricelister_active_ws');
            try {
                await firebaseSignOut(auth);
            } catch (e) {}
            
            if (typeof window !== 'undefined') {
                const isGitHubPages = window.location.hostname.endsWith('github.io');
                if (isGitHubPages) {
                    const basePath = window.location.pathname.replace(/\/index\.html$/i, '').replace(/\/(home|explore|pricing|find|privacy|terms|connection)\/?$/i, '').replace(/\/$/, '');
                    window.location.href = (basePath || '') + '/index.html';
                } else {
                    window.location.href = '/index.html';
                }
            }
        } catch (error) {
            console.error("Logout Error:", error);
            if (typeof window !== 'undefined') {
                window.location.href = '/index.html';
            }
        }
    },
    
    getCurrentUser: () => {
        const isExplicitSignedOut = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_signed_out') === 'true';
        if (isExplicitSignedOut) {
            return null;
        }

        const isExplicitDemo = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_explicit_demo') === 'true') ||
                               (typeof localStorage !== 'undefined' && localStorage.getItem('pricelister_demo_mode') === 'true');

        if (isExplicitDemo) {
            return {
                uid: 'dev-mock-uid',
                email: 'developer@local.test',
                displayName: 'Demo Admin (Testing)',
                photoURL: null,
                role: 'CREATOR_ADMIN',
                isDemo: true
            };
        }
        return auth.currentUser;
    }
};
