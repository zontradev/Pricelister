import { createRepository, firestoreService } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { CustomerProfile, BusinessProfile, ClientProfile } from '../../DataModel.js';
import { validateCustomer } from '../schemas/customerSchema.js';
import { validateBusiness } from '../schemas/businessSchema.js';
import { validateClient } from '../schemas/clientSchema.js';
import { getUserRestrictions } from '../auth-handler.js';

export const getPeopleService = (workspaceId) => {
    const businessRepo = createRepository('BusinessProfiles', workspaceId);
    const clientRepo = createRepository('ClientProfiles', workspaceId);

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

    // Helper to resolve effective Primary Business ID across server, collection, and workspace
    const resolveEffectivePrimaryId = (list = []) => {
        // 1. Direct explicit boolean flag on business document in collection
        const explicitPrimary = list.find(b => b && b.isPrimary === true);
        if (explicitPrimary) return explicitPrimary.id;

        // 2. Server-side workspace configuration (window.__activeWorkspace)
        const wsPrimary = (typeof window !== 'undefined' && window.__activeWorkspace?.primaryBusinessId) ? window.__activeWorkspace.primaryBusinessId : null;
        if (wsPrimary && list.some(b => b && b.id === wsPrimary)) return wsPrimary;

        // 3. Demo / Local storage shared database
        try {
            const demoDb = JSON.parse(localStorage.getItem('pricelister_demo_db_v2') || '{}');
            const demoWsPrimary = demoDb.Workspaces?.[workspaceId]?.primaryBusinessId;
            if (demoWsPrimary && list.some(b => b && b.id === demoWsPrimary)) return demoWsPrimary;
        } catch(e) {}

        // 4. Local device fallback
        try {
            const localPrimary = localStorage.getItem('pricelister_primary_business_' + workspaceId);
            if (localPrimary && list.some(b => b && b.id === localPrimary)) return localPrimary;
        } catch(e) {}

        return list[0]?.id || null;
    };

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
        listenCustomers: (callback, onError = null) => {
            return clientRepo.listenAll(data => {
                const list = Array.isArray(data) ? data : [];
                callback(list.filter(c => c && c.isClient !== true));
            }, [], onError);
        },
        addCustomer: async (data, creatorId) => {
            validateCustomer(data);
            const cleanCreatorId = resolveCreatorWorkerId(creatorId);
            const cleanWorkspaceId = resolveBusinessWorkspaceId();
            const customer = new CustomerProfile({
                ...data,
                workspaceId: cleanWorkspaceId,
                creatorId: cleanCreatorId,
                appWorkerId: cleanCreatorId,
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

            // Strict ID-to-ID matching: never match by duplicate names or numbers
            const connectedInvs = (allInvoices || []).filter(inv =>
                (inv.customerId && (inv.customerId === uId || inv.customerId === id)) ||
                (inv.customerUniqueId && (inv.customerUniqueId === uId || inv.customerUniqueId === id)) ||
                (inv.customerDocId && (inv.customerDocId === uId || inv.customerDocId === id)) ||
                (inv.recipientId && (inv.recipientId === uId || inv.recipientId === id))
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
            const list = (await businessRepo.getAll()) || [];
            const effectivePrimaryId = resolveEffectivePrimaryId(list);
            return list.map(b => ({
                ...b,
                isPrimary: Boolean(b.id === effectivePrimaryId)
            }));
        },
        listenBusinesses: (callback, onError = null) => {
            return businessRepo.listenAll(data => {
                const list = Array.isArray(data) ? data : [];
                const effectivePrimaryId = resolveEffectivePrimaryId(list);
                const mapped = list.map(b => ({
                    ...b,
                    isPrimary: Boolean(b.id === effectivePrimaryId)
                }));
                callback(mapped);
            }, [], onError);
        },
        setPrimaryBusiness: async (id) => {
            // Strict Role Enforcement: Only Admin & Co-Admin can set Primary Business
            const restrictions = getUserRestrictions();
            const canSetPrimary = Boolean(restrictions?.isCreator || restrictions?.isCoAdmin || restrictions?.isPrivileged);
            if (!canSetPrimary) {
                throw new Error("Permission Denied: Only Workspace Admins and Co-Admins can set the Primary Business.");
            }

            const list = (await businessRepo.getAll()) || [];
            const target = list.find(b => b.id === id);
            if (!target) throw new Error("Business profile not found.");

            // 1. Sync isPrimary across all business documents in collection
            for (const b of list) {
                const makePrimary = (b.id === id);
                if (b.isPrimary !== makePrimary) {
                    try {
                        await businessRepo.update(b.id, { isPrimary: makePrimary });
                    } catch(err) {
                        console.warn("Could not sync isPrimary to repo:", err);
                    }
                }
            }

            // 2. Persist primary business to server workspace record (shared across ALL members)
            try {
                await firestoreService.updateWorkspacePrimaryBusiness(workspaceId, id, target.name || target.businessName || '');
            } catch(wsErr) {
                console.warn("Could not sync primary business to workspace document:", wsErr);
            }

            // 3. Update active workspace state in memory
            if (typeof window !== 'undefined' && window.__activeWorkspace) {
                window.__activeWorkspace.primaryBusinessId = id;
                window.__activeWorkspace.primaryBusinessName = target.name || target.businessName || '';
            }

            // 4. Update demo database in localStorage if active
            try {
                const rawDemo = localStorage.getItem('pricelister_demo_db_v2');
                if (rawDemo) {
                    const demoDb = JSON.parse(rawDemo);
                    if (Array.isArray(demoDb.Businesses)) {
                        demoDb.Businesses.forEach(b => { b.isPrimary = (b.id === id); });
                    }
                    if (Array.isArray(demoDb.BusinessProfiles)) {
                        demoDb.BusinessProfiles.forEach(b => { b.isPrimary = (b.id === id); });
                    }
                    if (!demoDb.Workspaces) demoDb.Workspaces = {};
                    if (!demoDb.Workspaces[workspaceId]) demoDb.Workspaces[workspaceId] = {};
                    demoDb.Workspaces[workspaceId].primaryBusinessId = id;
                    demoDb.Workspaces[workspaceId].primaryBusinessName = target.name || target.businessName || '';
                    localStorage.setItem('pricelister_demo_db_v2', JSON.stringify(demoDb));
                }
                localStorage.setItem('pricelister_primary_business_' + workspaceId, id);
                window.dispatchEvent(new CustomEvent('pricelister-primary-business-changed', {
                    detail: { businessId: id, business: target }
                }));
            } catch(e) {}
            return id;
        },
        getPrimaryBusiness: async () => {
            const list = (await businessRepo.getAll()) || [];
            const effectivePrimaryId = resolveEffectivePrimaryId(list);
            const found = list.find(b => b.id === effectivePrimaryId);
            return found ? { ...found, isPrimary: true } : (list[0] || null);
        },
        addBusiness: async (data, creatorId) => {
            validateBusiness(data);
            const cleanCreatorId = resolveCreatorWorkerId(creatorId);
            const cleanWorkspaceId = resolveBusinessWorkspaceId();
            const business = new BusinessProfile({
                ...data,
                workspaceId: cleanWorkspaceId,
                creatorId: cleanCreatorId,
                appWorkerId: cleanCreatorId,
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

            // Strict ID-to-ID matching: never match by duplicate business names
            const connectedInvs = allInvoices.filter(inv =>
                (inv.businessId && (inv.businessId === uId || inv.businessId === id)) ||
                (inv.businessUniqueId && (inv.businessUniqueId === uId || inv.businessUniqueId === id)) ||
                (inv.businessDocId && (inv.businessDocId === uId || inv.businessDocId === id)) ||
                (inv.issuerId && (inv.issuerId === uId || inv.issuerId === id))
            );

            if (connectedInvs.length > 0) {
                const count = connectedInvs.length;
                throw new Error(`Can't Delete business. The Business is used by ${count} invoice${count > 1 ? 's' : ''}. You have to Delete those invoices or edit this business.`);
            }

            await businessRepo.delete(id);
            try {
                if (localStorage.getItem('pricelister_primary_business_' + workspaceId) === id) {
                    localStorage.removeItem('pricelister_primary_business_' + workspaceId);
                }
            } catch(e) {}
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
        listenClients: (callback, onError = null) => {
            return clientRepo.listenAll(data => {
                const list = Array.isArray(data) ? data : [];
                callback(list.filter(c => c && c.isClient === true));
            }, [], onError);
        },
        addClient: async (data, creatorId) => {
            validateClient(data);
            const cleanCreatorId = resolveCreatorWorkerId(creatorId);
            const cleanWorkspaceId = resolveBusinessWorkspaceId();
            const client = new ClientProfile({
                ...data,
                workspaceId: cleanWorkspaceId,
                creatorId: cleanCreatorId,
                appWorkerId: cleanCreatorId,
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

            // Strict ID-to-ID matching: never match by duplicate client names, phones or emails
            const connectedInvs = (allInvoices || []).filter(inv =>
                (inv.clientId && (inv.clientId === uId || inv.clientId === id)) ||
                (inv.clientUniqueId && (inv.clientUniqueId === uId || inv.clientUniqueId === id)) ||
                (inv.clientDocId && (inv.clientDocId === uId || inv.clientDocId === id))
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
