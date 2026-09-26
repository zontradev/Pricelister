import { supabaseApp } from './supabase-config.js';

/**
 * Supabase Storage Service Placeholder for Phase 1
 */

export const storageService = {
    uploadImage: async (file) => {
        if (!supabaseApp) throw new Error("Supabase is not initialized. Check your internet connection or script loading.");
        
        // Generate a unique path for Android compatibility: timestamp_filename
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `${fileName}`;

        // Upload to the exact bucket used in Android
        const { data, error } = await supabaseApp.storage
            .from('product_images')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
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
            // Android uses format: https://[project-id].supabase.co/storage/v1/object/public/product_images/filename.jpg
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
    }
};
