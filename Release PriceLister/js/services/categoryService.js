import { createRepository, firestoreService } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Category } from '../../DataModel.js';
import { validateCategory } from '../schemas/categorySchema.js';

export const getCategoryService = (workspaceId) => {
    const repo = createRepository('Categories', workspaceId);

    return {
        getAllCategories: async () => {
            return await repo.getAll();
        },
        
        listenCategories: (callback) => {
            return repo.listenAll(callback);
        },

        addCategory: async (categoryData, creatorId) => {
            const existingCategories = await repo.getAll();
            validateCategory(categoryData, existingCategories);

            const newCategory = new Category({
                ...categoryData,
                uniqueId: generateUniqueId('CAT'),
                creatorId: creatorId,
                timestamp: Date.now(),
                updatedTimestamp: Date.now()
            });

            const id = await repo.add(JSON.parse(JSON.stringify(newCategory)));
            await firestoreService.updateMetricsCounter(workspaceId, 'category', true, creatorId, 1);
            return { id, ...newCategory };
        },

        updateCategory: async (id, categoryData, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) {
                throw new Error("You don't have permission to update categories.");
            }

            const existingCategories = await repo.getAll();
            validateCategory(categoryData, existingCategories, true);

            const updatePayload = {
                name: categoryData.name,
                color: categoryData.color || '#cccccc',
                updatedTimestamp: Date.now()
            };

            await repo.update(id, updatePayload);
        },

        deleteCategory: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) {
                throw new Error("You don't have permission to delete categories.");
            }
            
            // Check if any active products are using this category
            const productRepo = createRepository('Products', workspaceId);
            const [allProducts, cat] = await Promise.all([
                productRepo.getAll().catch(() => []),
                repo.getById(id).catch(() => null)
            ]);

            const uId = cat?.uniqueId || id;
            const catName = (cat?.name || '').trim().toLowerCase();

            const connectedProds = (allProducts || []).filter(p => 
                !p.isArchive && (
                    p.category === uId || 
                    p.category === id || 
                    (p.category && p.category.trim().toLowerCase() === catName) ||
                    (p.categoryName && p.categoryName.trim().toLowerCase() === catName)
                )
            );

            if (connectedProds.length > 0) {
                const count = connectedProds.length;
                throw new Error(`Can't Delete category. The Category is used by ${count} product${count > 1 ? 's' : ''}. You have to Delete those products or rename this category.`);
            }

            await repo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'category', false, cat?.creatorId, 1);
        }
    };
};
