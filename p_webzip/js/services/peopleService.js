import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { CustomerProfile, BusinessProfile, ClientProfile } from '../../DataModel.js';
import { validateCustomer } from '../schemas/customerSchema.js';
import { validateBusiness } from '../schemas/businessSchema.js';
import { validateClient } from '../schemas/clientSchema.js';

export const getPeopleService = (workspaceId) => {
    const businessRepo = createRepository('BusinessProfiles', workspaceId);
    const clientRepo = createRepository('ClientProfiles', workspaceId);

    return {
        // --- CUSTOMERS (Stored in ClientProfiles with isClient: false) ---
        getAllCustomers: async () => {
            const all = await clientRepo.getAll();
            return all.filter(c => c.isClient === false);
        },
        listenCustomers: (callback) => {
            return clientRepo.listenAll(data => {
                callback(data.filter(c => c.isClient === false));
            });
        },
        addCustomer: async (data, creatorId) => {
            validateCustomer(data);
            const customer = new CustomerProfile({
                ...data,
                uniqueId: generateUniqueId(),
                timestamp: Date.now()
            });
            return await clientRepo.add(JSON.parse(JSON.stringify(customer)));
        },
        updateCustomer: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            if (data.name !== undefined) validateCustomer(data);
            await clientRepo.update(id, data);
        },
        deleteCustomer: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");
            await clientRepo.delete(id);
        },

        // --- BUSINESSES ---
        getAllBusinesses: async () => {
            return await businessRepo.getAll();
        },
        listenBusinesses: (callback) => {
            return businessRepo.listenAll(callback);
        },
        addBusiness: async (data, creatorId) => {
            validateBusiness(data);
            const business = new BusinessProfile({
                ...data,
                uniqueId: generateUniqueId(),
                timestamp: Date.now()
            });
            return await businessRepo.add(JSON.parse(JSON.stringify(business)));
        },
        updateBusiness: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            if (data.name !== undefined) validateBusiness(data);
            await businessRepo.update(id, data);
        },
        deleteBusiness: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");
            await businessRepo.delete(id);
        },

        // --- CLIENTS ---
        getAllClients: async () => {
            const all = await clientRepo.getAll();
            return all.filter(c => c.isClient !== false); // Explicitly filter for clients
        },
        listenClients: (callback) => {
            return clientRepo.listenAll(data => {
                callback(data.filter(c => c.isClient !== false));
            });
        },
        addClient: async (data, creatorId) => {
            validateClient(data);
            const client = new ClientProfile({
                ...data,
                uniqueId: generateUniqueId(),
                isClient: true, // Preserve specific source mapping distinction
                timestamp: Date.now()
            });
            return await clientRepo.add(JSON.parse(JSON.stringify(client)));
        },
        updateClient: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            await clientRepo.update(id, data);
        },
        deleteClient: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");
            await clientRepo.delete(id);
        }
    };
};
