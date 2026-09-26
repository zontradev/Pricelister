import { CONFIG } from '../config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';

export const getFirebaseConfig = () => {
    return CONFIG.FIREBASE;
};

// Initialize Firebase
export const firebaseApp = initializeApp(getFirebaseConfig());

console.log(`[PriceLister] Firebase initialized in ${CONFIG.ENVIRONMENT} mode (App Mode: ${CONFIG.APP_MODE})`);

