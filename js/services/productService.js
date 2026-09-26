import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Product } from '../../DataModel.js';
import { validateProduct } from '../schemas/productSchema.js';
import { storageService } from '../../supabase/storage.js';

export const getProductService = (workspaceId) => {
    const repo = createRepository('Products', workspaceId);

    return {
        getAllActiveProducts: async () => {
            const all = await repo.getAll();
            return all.filter(p => !p.isArchive);
        },

        getAllArchivedProducts: async () => {
            const all = await repo.getAll();
            return all.filter(p => p.isArchive);
        },

        getProductById: async (id) => {
            return await repo.getById(id);
        },

        addProduct: async (productData, creatorId) => {
            validateProduct(productData);

            const newProduct = new Product({
                ...productData,
                workspaceId: workspaceId,
                uniqueId: generateUniqueId(),
                creatorId: creatorId,
                timestamp: Date.now(),
                updatedTimestamp: Date.now(),
                isArchive: false
            });

            // Convert class instance to plain object for Firebase
            return await repo.add(JSON.parse(JSON.stringify(newProduct)));
        },

        bulkAddProducts: async (productsList, creatorId, workerPermission = null, onProgress = null) => {
            if (workerPermission && workerPermission.disableAdd) {
                throw new Error("You don't have permission to add products.");
            }

            const results = [];
            const total = productsList.length;

            for (let i = 0; i < total; i++) {
                const item = productsList[i];
                if (onProgress) {
                    onProgress(i + 1, total, item.name || `Product ${i + 1}`);
                }

                let finalImageUri = item.imageUri || "";
                if (item.imageFile instanceof File || item.imageFile instanceof Blob) {
                    try {
                        finalImageUri = await storageService.uploadImage(item.imageFile, workspaceId);
                    } catch (imgErr) {
                        console.warn(`Failed to upload image for ${item.name}:`, imgErr);
                    }
                }

                const newProduct = new Product({
                    name: item.name || "",
                    category: item.category || "",
                    sizeWeight: item.sizeWeight || "",
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.price) || 0.0,
                    salePrice: Number(item.salePrice) || 0.0,
                    basePrice: Number(item.basePrice) || 0.0,
                    mrp: Number(item.mrp) || 0.0,
                    mfgDate: item.mfgDate || "",
                    expDate: item.expDate || "",
                    note: item.note || "",
                    upcCode: item.upcCode || "",
                    imageUri: finalImageUri,
                    variations: Array.isArray(item.variations) ? item.variations : [],
                    labelColor: item.labelColor || "",
                    workspaceId: workspaceId,
                    uniqueId: item.uniqueId || generateUniqueId(),
                    creatorId: creatorId,
                    timestamp: item.timestamp || Date.now(),
                    updatedTimestamp: Date.now(),
                    isArchive: false
                });

                const id = await repo.add(JSON.parse(JSON.stringify(newProduct)));
                results.push({ id, uniqueId: newProduct.uniqueId, name: newProduct.name });
            }

            return results;
        },

        updateProduct: async (id, productData, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) {
                throw new Error("You don't have permission to update this product.");
            }

            validateProduct(productData, true);

            // Clean up old image from Supabase if it was changed
            try {
                const oldProduct = await repo.getById(id);
                if (oldProduct && oldProduct.imageUri && productData.imageUri && oldProduct.imageUri !== productData.imageUri) {
                    await storageService.deleteImage(oldProduct.imageUri);
                }
            } catch(e) {
                console.error("Failed to cleanup old image:", e);
            }

            // Never update ID, uniqueId, creatorId, timestamp in an update operation
            const updatePayload = {
                ...productData,
                updatedTimestamp: Date.now()
            };
            
            // Explicitly delete protected fields just in case they were passed in
            delete updatePayload.id;
            delete updatePayload.uniqueId;
            delete updatePayload.creatorId;
            delete updatePayload.timestamp;

            await repo.update(id, updatePayload);
        },

        duplicateProduct: async (originalProductData, creatorId, workerPermission = null) => {
            if (workerPermission && workerPermission.disableAdd) {
                throw new Error("You don't have permission to add new products.");
            }

            // Create new instance from original, but reset identities
            const duplicate = new Product({
                ...originalProductData,
                id: null, // Reset Firestore ID
                workspaceId: workspaceId,
                uniqueId: generateUniqueId(), // Generate new identity
                name: `${originalProductData.name} (Copy)`,
                creatorId: creatorId,
                timestamp: Date.now(),
                updatedTimestamp: Date.now(),
                isArchive: false
            });

            return await repo.add(JSON.parse(JSON.stringify(duplicate)));
        },

        deleteProduct: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) {
                throw new Error("You don't have permission to delete products.");
            }

            try {
                const prod = await repo.getById(id);
                if (prod && prod.imageUri) {
                    await storageService.deleteImage(prod.imageUri).catch(() => {});
                }
            } catch(e) {}

            await repo.delete(id);
        },

        archiveProduct: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) {
                throw new Error("You don't have permission to delete/archive products.");
            }

            // Prefer archive over hard delete
            await repo.update(id, {
                isArchive: true,
                updatedTimestamp: Date.now()
            });
        },
        
        restoreProduct: async (id, workerPermission = null) => {
             if (workerPermission && workerPermission.disableUpdate) {
                throw new Error("You don't have permission to update this product.");
            }

            await repo.update(id, {
                isArchive: false,
                updatedTimestamp: Date.now()
            });
        },

        deductProductQuantity: async (id, quantityToDeduct) => {
            try {
                const prod = await repo.getById(id);
                if (prod) {
                    const currentQty = Number(prod.quantity) || 0;
                    const newQty = Math.max(0, currentQty - quantityToDeduct);
                    await repo.update(id, {
                        quantity: newQty,
                        updatedTimestamp: Date.now()
                    });
                    return newQty;
                }
            } catch (err) {
                console.error("Failed to deduct product quantity in vending mode:", err);
            }
            return null;
        }
    };
};
