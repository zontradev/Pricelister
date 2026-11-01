import { storageService as supabaseStorage } from '../supabase/storage.js';

/**
 * Storage Service
 * Note: Migrated to use Supabase for Storage per requirements.
 */

// We re-export the Supabase storage service so that existing imports don't break,
// or we can direct developers to use the new module directly.
export const storageService = supabaseStorage;
