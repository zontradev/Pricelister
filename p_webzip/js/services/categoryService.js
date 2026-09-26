import { createRepository } from '../../firebase/firestore.js';
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
            
            // Note: In real app, we should check if products are using this category before delete, 
            // or warn the user. For now, just delete.
            await repo.delete(id);
        }
    };
};
