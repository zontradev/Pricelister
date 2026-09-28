import { createRepository, firestoreService } from '../../firebase/firestore.js';
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
            try {
                const all = (await clientRepo.getAll()) || [];
                return all.filter(c => c && c.isClient !== true);
            } catch (e) {
                console.warn("getAllCustomers error:", e);
                return [];
            }
        },
        listenCustomers: (callback) => {
            return clientRepo.listenAll(data => {
                const list = Array.isArray(data) ? data : [];
                callback(list.filter(c => c && c.isClient !== true));
            });
        },
        addCustomer: async (data, creatorId) => {
            validateCustomer(data);
            const customer = new CustomerProfile({
                ...data,
                creatorId: creatorId,
                uniqueId: generateUniqueId(),
                timestamp: Date.now()
            });
            const id = await clientRepo.add(JSON.parse(JSON.stringify(customer)));
            await firestoreService.updateMetricsCounter(workspaceId, 'customer', true, creatorId, 1);
            return id;
        },
        updateCustomer: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            if (data.name !== undefined) validateCustomer(data);
            await clientRepo.update(id, data);
        },
        deleteCustomer: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");
            
            const invoiceRepo = createRepository('Invoices', workspaceId);
            const [allInvoices, cust] = await Promise.all([
                invoiceRepo.getAll().catch(() => []),
                clientRepo.getById(id).catch(() => null)
            ]);

            const uId = cust?.uniqueId || id;
            const name = (cust?.name || '').trim().toLowerCase();
            const phone = (cust?.phone || '').trim();

            const connectedInvs = (allInvoices || []).filter(inv =>
                (inv.customerId && (inv.customerId === uId || inv.customerId === id)) ||
                (inv.customerName && inv.customerName.trim().toLowerCase() === name) ||
                (phone && inv.customerNumber && inv.customerNumber.trim() === phone)
            );

            if (connectedInvs.length > 0) {
                const count = connectedInvs.length;
                throw new Error(`Can't Delete customer. The Customer is used by ${count} invoice${count > 1 ? 's' : ''}. You have to Delete those invoices or edit this customer.`);
            }

            await clientRepo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'customer', false, cust?.creatorId, 1);
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
                creatorId: creatorId,
                uniqueId: generateUniqueId(),
                timestamp: Date.now()
            });
            const id = await businessRepo.add(JSON.parse(JSON.stringify(business)));
            await firestoreService.updateMetricsCounter(workspaceId, 'business', true, creatorId, 1);
            return id;
        },
        updateBusiness: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            if (data.name !== undefined) validateBusiness(data);
            await businessRepo.update(id, data);
        },
        deleteBusiness: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");

            const invoiceRepo = createRepository('Invoices', workspaceId);
            const busInvoiceRepo = createRepository('BusinessInvoices', workspaceId);
            const [custInvs, busInvs, bus] = await Promise.all([
                invoiceRepo.getAll().catch(() => []),
                busInvoiceRepo.getAll().catch(() => []),
                businessRepo.getById(id).catch(() => null)
            ]);

            const allInvoices = [...(custInvs || []), ...(busInvs || [])];
            const uId = bus?.uniqueId || id;
            const name = (bus?.name || '').trim().toLowerCase();

            const connectedInvs = allInvoices.filter(inv =>
                (inv.businessId && (inv.businessId === uId || inv.businessId === id)) ||
                (inv.businessName && inv.businessName.trim().toLowerCase() === name)
            );

            if (connectedInvs.length > 0) {
                const count = connectedInvs.length;
                throw new Error(`Can't Delete business. The Business is used by ${count} invoice${count > 1 ? 's' : ''}. You have to Delete those invoices or edit this business.`);
            }

            await businessRepo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'business', false, bus?.creatorId, 1);
        },

        // --- CLIENTS ---
        getAllClients: async () => {
            try {
                const all = (await clientRepo.getAll()) || [];
                return all.filter(c => c && c.isClient === true);
            } catch (e) {
                console.warn("getAllClients error:", e);
                return [];
            }
        },
        listenClients: (callback) => {
            return clientRepo.listenAll(data => {
                const list = Array.isArray(data) ? data : [];
                callback(list.filter(c => c && c.isClient === true));
            });
        },
        addClient: async (data, creatorId) => {
            validateClient(data);
            const client = new ClientProfile({
                ...data,
                creatorId: creatorId,
                uniqueId: generateUniqueId(),
                isClient: true, // Preserve specific source mapping distinction
                timestamp: Date.now()
            });
            const id = await clientRepo.add(JSON.parse(JSON.stringify(client)));
            await firestoreService.updateMetricsCounter(workspaceId, 'client', true, creatorId, 1);
            return id;
        },
        updateClient: async (id, data, workerPermission = null) => {
            if (workerPermission && workerPermission.disableUpdate) throw new Error("Permission denied.");
            await clientRepo.update(id, data);
        },
        deleteClient: async (id, workerPermission = null) => {
            if (workerPermission && workerPermission.disableDelete) throw new Error("Permission denied.");

            const invoiceRepo = createRepository('Invoices', workspaceId);
            const [allInvoices, cl] = await Promise.all([
                invoiceRepo.getAll().catch(() => []),
                clientRepo.getById(id).catch(() => null)
            ]);

            const uId = cl?.uniqueId || id;
            const name = (cl?.name || '').trim().toLowerCase();
            const phone = (cl?.phone || '').trim();
            const email = (cl?.email || '').trim().toLowerCase();

            const connectedInvs = (allInvoices || []).filter(inv =>
                (inv.clientId && (inv.clientId === uId || inv.clientId === id)) ||
                (inv.clientName && inv.clientName.trim().toLowerCase() === name) ||
                (phone && inv.clientPhone && inv.clientPhone.trim() === phone) ||
                (email && inv.clientEmail && inv.clientEmail.trim().toLowerCase() === email)
            );

            if (connectedInvs.length > 0) {
                const count = connectedInvs.length;
                throw new Error(`Can't Delete client. The Client is used by ${count} invoice${count > 1 ? 's' : ''}. You have to Delete those invoices or edit this client.`);
            }

            await clientRepo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'client', false, cl?.creatorId, 1);
        }
    };
};
