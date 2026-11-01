import { supabaseApp } from './supabase-config.js';

/**
 * Helper to convert browser File/Blob to optimized Base64 Data URL (resilient fallback)
 */
export const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
        if (!file) return resolve('');
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

/**
 * Resilient Supabase Storage Service
 * Handles images, workspace logos, cover banners, and catalog assets
 */
export const storageService = {
    fileToDataUrl,

    uploadImage: async (file, workspaceDocUid = 'default', prefix = 'asset') => {
        if (!file) return '';

        // Derive proper file extension and content type
        let ext = 'jpg';
        if (file.name && file.name.includes('.')) {
            ext = file.name.split('.').pop().toLowerCase();
        } else if (file.type) {
            ext = file.type.split('/')[1] || 'jpg';
            if (ext === 'svg+xml') ext = 'svg';
            if (ext === 'jpeg') ext = 'jpg';
        }

        const mimeType = file.type || (ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg');

        // Check if Supabase client is properly initialized
        if (supabaseApp && supabaseApp.storage) {
            try {
                const randPart = Math.random().toString(36).substring(2, 8);
                const fileName = `${prefix}_${Date.now()}_${randPart}.${ext}`;
                const filePath = `${workspaceDocUid}/${fileName}`;

                const { data, error } = await supabaseApp.storage
                    .from('product_images')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: mimeType
                    });

                if (!error) {
                    const { data: publicUrlData } = supabaseApp.storage
                        .from('product_images')
                        .getPublicUrl(filePath);

                    if (publicUrlData && publicUrlData.publicUrl) {
                        return publicUrlData.publicUrl;
                    }
                } else {
                    console.warn("Supabase upload returned error, switching to resilient fallback:", error.message);
                }
            } catch (err) {
                console.warn("Supabase cloud upload exception, falling back to local data URL:", err);
            }
        }

        // Resilient fallback: convert to base64 Data URL so user never loses image
        return await fileToDataUrl(file);
    },
    
    deleteImage: async (url) => {
        if (!supabaseApp || !url || url.startsWith('data:')) return;
        try {
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
