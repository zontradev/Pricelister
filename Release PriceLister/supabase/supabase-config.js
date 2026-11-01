import { CONFIG } from '../config.js';

/**
 * Supabase Config Placeholder
 */

export const supabaseApp = window.supabase ? window.supabase.createClient(
    "https://chewglmfaggzmlguglpg.supabase.co",
    "sb_publishable_TRH_eIv-Pv4IUVUJ0-mRLg_uxOc7z5R"
) : null;

export const getSupabaseConfig = () => {
    return {
        isInitialized: !!supabaseApp,
        url: "https://chewglmfaggzmlguglpg.supabase.co"
    };
};

if (CONFIG.FEATURE_FLAGS.enableSupabaseStorage) {
    console.log(`[PriceLister] Supabase initialized for Storage in ${CONFIG.ENVIRONMENT} mode`);
}
