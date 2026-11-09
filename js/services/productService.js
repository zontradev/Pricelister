import { createRepository, firestoreService } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Product } from '../../DataModel.js';
import { validateProduct } from '../schemas/productSchema.js';
import { storageService } from '../../supabase/storage.js';
import { getAutomationService } from './automationService.js';
import { getSupplierService } from './supplierService.js';
import { normalizeProductDate } from '../utilities.js';

export const getProductService = (workspaceId) => {
    const repo = createRepository('Products', workspaceId);

    // Resolve clean business field workspaceId (never leak Firestore doc UID)
    const resolveBusinessWorkspaceId = () => {
        if (typeof window !== 'undefined' && window.__activeWorkspace?.workspaceId) {
            return window.__activeWorkspace.workspaceId;
        }
        return workspaceId;
    };

    // Resolve clean creator worker ID (appWorkerId or adminId from workspace)
    const resolveCreatorWorkerId = (explicitCreator) => {
        if (explicitCreator && explicitCreator !== 'system' && !explicitCreator.startsWith('usr_') && explicitCreator.length <= 16) {
            return explicitCreator;
        }
        if (typeof window !== 'undefined' && window.__activeWorkspace) {
            return window.__activeWorkspace.myAppWorkerId || window.__activeWorkspace.adminId || explicitCreator || 'MUI4JS8S83F33A';
        }
        return explicitCreator || 'MUI4JS8S83F33A';
    };

    return {
        getAllActiveProducts: async () => {
            const all = await repo.getAll();
            return all.filter(p => !p.isArchive);
        },

        listenProducts: (callback) => {
            return repo.listenAll((all) => {
                callback(all.filter(p => !p.isArchive));
            });
        },

        getAllArchivedProducts: async () => {
            const all = await repo.getAll();
            return all.filter(p => p.isArchive);
        },

        getProductById: async (id) => {
            return await repo.getById(id);
        },

        addProduct: async (productData, creatorId, workerPermission = null) => {
            if (workerPermission && workerPermission.disableAdd) {
                throw new Error("You don't have permission to add new products.");
            }

            // Normalize mfgDate & expDate to DD-MM-YYYY to prevent Android crash on YYYY-MM-DD
            const cleanedData = { ...productData };
            if (cleanedData.mfgDate) cleanedData.mfgDate = normalizeProductDate(cleanedData.mfgDate);
            if (cleanedData.expDate) cleanedData.expDate = normalizeProductDate(cleanedData.expDate);

            validateProduct(cleanedData);

            const safeWsId = resolveBusinessWorkspaceId();
            const safeCreatorId = resolveCreatorWorkerId(creatorId);

            const newProduct = new Product({
                ...cleanedData,
                workspaceId: safeWsId,
                uniqueId: generateUniqueId(),
                creatorId: safeCreatorId,
                timestamp: Date.now(),
                updatedTimestamp: Date.now(),
                isArchive: false
            });

            // Convert class instance to plain object for Firebase
            const id = await repo.add(JSON.parse(JSON.stringify(newProduct)));
            await firestoreService.updateMetricsCounter(workspaceId, 'product', true, creatorId, 1);

            // Trigger Automation Event Hooks
            try {
                const autoService = getAutomationService(workspaceId);
                await autoService.evaluateProductStock({ ...newProduct, id });
                await autoService.recordProductUpdateNotification({
                    action: 'created',
                    productId: id,
                    productName: newProduct.name,
                    changedByEmail: creatorId
                });
            } catch (err) {
                console.warn("[Automation] addProduct hook warning:", err);
            }

            return id;
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
                    workspaceId: resolveBusinessWorkspaceId(),
                    uniqueId: item.uniqueId || generateUniqueId(),
                    creatorId: resolveCreatorWorkerId(creatorId),
                    timestamp: item.timestamp || Date.now(),
                    updatedTimestamp: Date.now(),
                    isArchive: false
                });

                const id = await repo.add(JSON.parse(JSON.stringify(newProduct)));
                results.push({ id, uniqueId: newProduct.uniqueId, name: newProduct.name });

                // Trigger low-stock and creation event hooks
                try {
                    const autoService = getAutomationService(workspaceId);
                    await autoService.evaluateLowStockAlert({ ...newProduct, id });
                    await autoService.recordProductUpdateNotification({
                        productId: id,
                        productName: newProduct.name,
                        action: 'created',
                        changedFields: ['name', 'price', 'quantity'],
                        changedBy: creatorId,
                        changedByEmail: creatorId
                    });
                } catch (autoErr) {
                    console.warn("Automation trigger failed in addProduct:", autoErr);
                }
            }

            if (results.length > 0) {
                await firestoreService.updateMetricsCounter(workspaceId, 'product', true, creatorId, results.length);
            }

            return results;
        },

        updateProduct: async (id, productData, workerPermission = null, currentUserUid = null) => {
            if (workerPermission && workerPermission.disableUpdate) {
                throw new Error("You don't have permission to update this product.");
            }

            const currentUid = currentUserUid || workerPermission?.currentUserUid;
            if (workerPermission && workerPermission.disableUpdateOthers && currentUid) {
                const existing = await repo.getById(id);
                if (existing && existing.creatorId && existing.creatorId !== currentUid) {
                    throw new Error("You don't have permission to update products created by other members.");
                }
            }

            // Normalize mfgDate & expDate to DD-MM-YYYY to prevent Android crash on YYYY-MM-DD
            const cleanedData = { ...productData };
            if (cleanedData.mfgDate) cleanedData.mfgDate = normalizeProductDate(cleanedData.mfgDate);
            if (cleanedData.expDate) cleanedData.expDate = normalizeProductDate(cleanedData.expDate);

            validateProduct(cleanedData, true);

            // Clean up old image from Supabase if it was changed
            let oldProduct = null;
            try {
                oldProduct = await repo.getById(id);
                if (oldProduct && oldProduct.imageUri && cleanedData.imageUri && oldProduct.imageUri !== cleanedData.imageUri) {
                    await storageService.deleteImage(oldProduct.imageUri);
                }
            } catch(e) {
                console.error("Failed to cleanup old image:", e);
            }

            // Never update ID, uniqueId, creatorId, timestamp in an update operation
            const updatePayload = {
                ...cleanedData,
                updatedTimestamp: Date.now()
            };
            
            // Explicitly delete protected fields just in case they were passed in
            delete updatePayload.id;
            delete updatePayload.uniqueId;
            delete updatePayload.creatorId;
            delete updatePayload.timestamp;

            await repo.update(id, updatePayload);

            // Trigger Automation & Supplier Market Event Hooks
            try {
                const autoService = getAutomationService(workspaceId);
                const supService = getSupplierService(workspaceId);
                const mergedProduct = { ...(oldProduct || {}), ...updatePayload, id };
                const changedFields = [];

                if (oldProduct) {
                    // 1. Detect Cost Price Change
                    if (updatePayload.costPrice !== undefined && Number(oldProduct.costPrice || 0) !== Number(updatePayload.costPrice || 0)) {
                        changedFields.push('costPrice');
                        await autoService.recordPriceChangeNotification({
                            productId: id,
                            productName: mergedProduct.name,
                            sku: mergedProduct.upcCode || mergedProduct.uniqueId,
                            field: 'costPrice',
                            oldValue: oldProduct.costPrice,
                            newValue: updatePayload.costPrice,
                            changedBy: currentUid,
                            changedByEmail: currentUid
                        });
                        await supService.recordPriceHistory({
                            productId: id,
                            productName: mergedProduct.name,
                            sku: mergedProduct.upcCode || mergedProduct.uniqueId,
                            priceType: 'purchase_cost',
                            oldPrice: oldProduct.costPrice,
                            newPrice: updatePayload.costPrice,
                            changeSource: 'Direct Catalog Update',
                            responsibleUserId: currentUid || 'admin'
                        });
                    }

                    // 2. Detect Sale Price Change
                    if (updatePayload.salePrice !== undefined && Number(oldProduct.salePrice || 0) !== Number(updatePayload.salePrice || 0)) {
                        changedFields.push('salePrice');
                        await autoService.recordPriceChangeNotification({
                            productId: id,
                            productName: mergedProduct.name,
                            sku: mergedProduct.upcCode || mergedProduct.uniqueId,
                            field: 'salePrice',
                            oldValue: oldProduct.salePrice,
                            newValue: updatePayload.salePrice,
                            changedBy: currentUid,
                            changedByEmail: currentUid
                        });
                        await supService.recordPriceHistory({
                            productId: id,
                            productName: mergedProduct.name,
                            sku: mergedProduct.upcCode || mergedProduct.uniqueId,
                            priceType: 'retail_sale',
                            oldPrice: oldProduct.salePrice,
                            newPrice: updatePayload.salePrice,
                            changeSource: 'Direct Catalog Update',
                            responsibleUserId: currentUid || 'admin'
                        });
                    }

                    // 3. Detect Stock Quantity Change & Evaluate Low-Stock
                    if (updatePayload.quantity !== undefined && Number(oldProduct.quantity) !== Number(updatePayload.quantity)) {
                        changedFields.push('quantity');
                    }
                }

                // Evaluate Low Stock
                await autoService.evaluateProductStock(mergedProduct);

                // Record Product Update
                if (changedFields.length > 0 || (oldProduct && oldProduct.name !== updatePayload.name)) {
                    if (oldProduct && oldProduct.name !== updatePayload.name) changedFields.push('name');
                    await autoService.recordProductUpdateNotification({
                        action: 'updated',
                        productId: id,
                        productName: mergedProduct.name,
                        changedFields,
                        changedByEmail: currentUid
                    });
                }
            } catch (hookErr) {
                console.warn("[Automation] updateProduct hook warning:", hookErr);
            }
        },

        duplicateProduct: async (originalProductData, creatorId, workerPermission = null) => {
            if (workerPermission && workerPermission.disableAdd) {
                throw new Error("You don't have permission to add new products.");
            }

            // Create new instance from original, but reset identities
            const duplicate = new Product({
                ...originalProductData,
                id: null, // Reset Firestore ID
                workspaceId: resolveBusinessWorkspaceId(),
                uniqueId: generateUniqueId(), // Generate new identity
                name: `${originalProductData.name} (Copy)`,
                creatorId: resolveCreatorWorkerId(creatorId),
                timestamp: Date.now(),
                updatedTimestamp: Date.now(),
                isArchive: false
            });

            const id = await repo.add(JSON.parse(JSON.stringify(duplicate)));
            await firestoreService.updateMetricsCounter(workspaceId, 'product', true, creatorId, 1);
            return id;
        },

        deleteProduct: async (id, workerPermission = null, currentUserUid = null) => {
            if (workerPermission && workerPermission.disableDelete) {
                throw new Error("You don't have permission to delete products.");
            }

            let itemCreatorId = null;
            try {
                const prod = await repo.getById(id);
                itemCreatorId = prod?.creatorId || null;
                const currentUid = currentUserUid || workerPermission?.currentUserUid;
                if (workerPermission && workerPermission.disableDeleteOthers && currentUid && itemCreatorId && itemCreatorId !== currentUid) {
                    throw new Error("You don't have permission to delete products created by other members.");
                }
                if (prod && prod.imageUri) {
                    await storageService.deleteImage(prod.imageUri).catch(() => {});
                }
            } catch(e) {
                if (e.message && e.message.includes("permission")) throw e;
            }

            await repo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'product', false, itemCreatorId, 1);
        },

        archiveProduct: async (id, workerPermission = null, currentUserUid = null) => {
            if (workerPermission && workerPermission.disableDelete) {
                throw new Error("You don't have permission to delete/archive products.");
            }

            let itemCreatorId = null;
            try {
                const prod = await repo.getById(id);
                itemCreatorId = prod?.creatorId || null;
                const currentUid = currentUserUid || workerPermission?.currentUserUid;
                if (workerPermission && workerPermission.disableDeleteOthers && currentUid && itemCreatorId && itemCreatorId !== currentUid) {
                    throw new Error("You don't have permission to delete/archive products created by other members.");
                }
            } catch(e) {
                if (e.message && e.message.includes("permission")) throw e;
            }

            // Prefer archive over hard delete
            await repo.update(id, {
                isArchive: true,
                updatedTimestamp: Date.now()
            });
            await firestoreService.updateMetricsCounter(workspaceId, 'product', false, itemCreatorId, 1);
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
