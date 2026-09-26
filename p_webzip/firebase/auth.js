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
        // If developer is using the offline test session, bypass Firebase listener
        if (CONFIG.APP_MODE === 'test') {
            const devSession = localStorage.getItem('mock_dev_session');
            if (devSession) {
                callback(JSON.parse(devSession));
                return () => {}; // dummy unsubscribe
            }
        }

        return firebaseOnAuthStateChanged(auth, (user) => {
            if (user) {
                const appUser = {
                    uid: user.uid,
                    email: user.email || 'test.user@pricelister.app',
                    displayName: user.displayName || 'Test User',
                    photoURL: user.photoURL || null,
                    role: 'PENDING'
                };
                callback(appUser);
            } else {
                callback(null);
            }
        });
    },
    
    loginWithGoogle: async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    },
    
    loginAsGuest: async () => {
        // Purely local mock session, no Firebase setup required
        const mockUser = {
            uid: 'dev-mock-uid',
            email: 'developer@local.test',
            displayName: 'Local Developer',
            photoURL: null,
            role: 'CREATOR_ADMIN'
        };
        localStorage.setItem('mock_dev_session', JSON.stringify(mockUser));
        return mockUser;
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
        if (CONFIG.APP_MODE === 'test') {
            const devSession = localStorage.getItem('mock_dev_session');
            if (devSession) return JSON.parse(devSession);
        }
        return auth.currentUser;
    }
};
