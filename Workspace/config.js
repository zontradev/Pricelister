export const CONFIG = {
    APP_NAME: "PriceLister",
    APP_VERSION: "1.0.0",
    APP_MODE: "production", // "test" or "production"
    ENVIRONMENT: "development",
    DEFAULT_CURRENCY: "USD",
    DEFAULT_DATE_FORMAT: "YYYY-MM-DD",
    
    FIREBASE: {
        apiKey: "AIzaSyCOOTpA3z0x1hnpWuGx5r8YJneS9LlquW4",
        authDomain: "pricelister-service.firebaseapp.com",
        projectId: "pricelister-service",
        storageBucket: "pricelister-service.firebasestorage.app",
        messagingSenderId: "761541292596",
        appId: "1:761541292596:web:18f807948f5a057713d061",
        measurementId: "G-7SQ9KE8V4Q"
    },
    
    SUPABASE: {
        // Placeholders for Supabase configuration
        url: "https://oeqyyrchdpsdmsbmmphb.supabase.co",
        anonKey: "sb_publishable_31u9s2JkP-L-5XG_K4Xg-A_9b5K-Q"
    },
    
    FEATURE_FLAGS: {
        enableSupabaseStorage: true, // Supabase configured for storage
        enableAdvancedReporting: false
    },
    
    PAGINATION_LIMIT: 50,
    SEARCH_LIMIT: 20
};
