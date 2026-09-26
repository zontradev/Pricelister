import { supabaseApp } from './supabase-config.js';

/**
 * Supabase Storage Service Placeholder for Phase 1
 */

export const storageService = {
    uploadImage: async (file, workspaceDocUid = 'default') => {
        if (!supabaseApp) throw new Error("Supabase is not initialized. Check your internet connection or script loading.");
        
        // Exact Android parity format: {workspaceDocUid}/product_{timestamp}_{6char_random}.jpg
        const randPart = Math.random().toString(36).substring(2, 8);
        const fileName = `product_${Date.now()}_${randPart}.jpg`;
        const filePath = `${workspaceDocUid}/${fileName}`;

        // Upload to the exact product_images bucket in Supabase
        const { data, error } = await supabaseApp.storage
            .from('product_images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type || 'image/jpeg'
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }

        // Retrieve the public URL
        const { data: publicUrlData } = supabaseApp.storage
            .from('product_images')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    },
    
    deleteImage: async (url) => {
        if (!supabaseApp || !url) return;
        try {
            // Extracts the exact "{workspaceDocUid}/product_{timestamp}_{random}.jpg" path from the public URL
            const parts = url.split('/product_images/');
            if (parts.length > 1) {
                const filePath = parts[1];
                const { error } = await supabaseApp.storage
                    .from('product_images')
                    .remove([filePath]);
                if (error) {
                    console.error("Supabase Delete Error:", error);
                }
            }
        } catch(e) {
            console.error("Failed to delete image:", e);
        }
    },

    deleteWorkspaceAssets: async (workspaceDocUid) => {
        if (!supabaseApp || !workspaceDocUid) return;
        try {
            const { data: files, error: listErr } = await supabaseApp.storage
                .from('product_images')
                .list(workspaceDocUid);
            if (listErr) {
                console.warn("Could not list workspace assets:", listErr);
                return;
            }
            if (files && files.length > 0) {
                const paths = files.map(f => `${workspaceDocUid}/${f.name}`);
                const { error: removeErr } = await supabaseApp.storage
                    .from('product_images')
                    .remove(paths);
                if (removeErr) {
                    console.warn("Could not delete workspace assets:", removeErr);
                }
            }
        } catch (e) {
            console.warn("deleteWorkspaceAssets error:", e);
        }
    }
};
