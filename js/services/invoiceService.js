import { createRepository, firestoreService } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Invoice, InvoiceItem } from '../../DataModel.js';
import { validateInvoice } from '../schemas/invoiceSchema.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';
import { getProductService } from './productService.js';
import { getSettingsService } from './settingsService.js';

export const getInvoiceService = (workspaceId) => {
    const customerInvoiceRepo = createRepository('Invoices', workspaceId);
    const businessInvoiceRepo = createRepository('BusinessInvoices', workspaceId);
    const businessRepo = createRepository('BusinessProfiles', workspaceId);
    const clientRepo = createRepository('ClientProfiles', workspaceId);

    return {
        getAllInvoices: async (isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            const all = await repo.getAll();
            return all.filter(inv => !inv.isArchive);
        },

        listenInvoices: (isBusiness, callback) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            return repo.listenAll(data => {
                callback(data.filter(inv => !inv.isArchive));
            });
        },

        getInvoiceById: async (id, isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            return await repo.getById(id);
        },

        createInvoice: async (invoiceData, items, creatorId, enableVendingParam = null) => {
            const isBus = Boolean(invoiceData.isBusinessInvoice);
            
            // Format human-readable invoice number:
            // Customer: INV-<Timestamp>
            // Business: BusInv-000000 to BusInv-999999 (editable)
            let finalInvNumber = (invoiceData.invoiceNumber || invoiceData.busInvNumber || '').trim();
            if (!finalInvNumber) {
                if (isBus) {
                    finalInvNumber = "BusInv-" + String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
                } else {
                    finalInvNumber = "INV-" + Date.now();
                }
            }

            // Correct Unique ID: 13-character random unique identifier (e.g. VQmqSPAqgm3Ed)
            const trueUniqueId = invoiceData.uniqueId || generateUniqueId();

            // Construct invoice model
            const newInvoice = new Invoice({
                ...invoiceData,
                invoiceNumber: finalInvNumber,
                busInvNumber: isBus ? finalInvNumber : (invoiceData.busInvNumber || ""),
                uniqueId: trueUniqueId,
                items: items,
                creatorId: creatorId,
                timestamp: invoiceData.timestamp || Date.now()
            });

            // Ensure items are properly instantiated InvoiceItem models
            newInvoice.items = (newInvoice.items || []).map(item => new InvoiceItem(item));

            // Validate using schema
            validateInvoice(newInvoice);

            // Calculate totals using centralized calculator
            const calculations = calculateInvoiceTotal(
                newInvoice.items,
                newInvoice.discountPercent,
                newInvoice.additionalCut,
                newInvoice.taxPercent,
                newInvoice.shippingCost
            );

            newInvoice.items.forEach(item => {
                item.totalPrice = item.quantity * item.unitPrice;
                item.itemProfit = item.totalPrice - (item.quantity * item.unitCost);
            });

            newInvoice.totalPrice = calculations.grandTotal;
            newInvoice.totalProfit = calculations.totalProfit;

            const repo = newInvoice.isBusinessInvoice ? businessInvoiceRepo : customerInvoiceRepo;
            const id = await repo.add(JSON.parse(JSON.stringify(newInvoice)));
            await firestoreService.updateMetricsCounter(workspaceId, 'invoice', true, creatorId, 1);
            
            // VENDING MODE: Check if enabled, then deduct inventory quantities
            let shouldDeduct = enableVendingParam;
            if (shouldDeduct === null || shouldDeduct === undefined) {
                try {
                    const settingsService = getSettingsService(workspaceId);
                    shouldDeduct = await settingsService.isVendingEnabled();
                } catch(e) {
                    console.warn("Could not check vending status:", e);
                }
            }

            if (shouldDeduct) {
                const prodService = getProductService(workspaceId);
                for (const item of newInvoice.items) {
                    if (item.productId) {
                        await prodService.deductProductQuantity(item.productId, item.quantity);
                    }
                }
            }
            
            // Post-creation triggers
            // 1. Increment Invoice counts for connected Business (Issuer)
            if (newInvoice.businessId) {
                try {
                    const allBusinesses = await businessRepo.getAll();
                    const bus = allBusinesses.find(b => b.uniqueId === newInvoice.businessId || b.id === newInvoice.businessId);
                    if (bus) {
                        await businessRepo.update(bus.id, { invoiceCount: (bus.invoiceCount || 0) + 1 });
                    }
                } catch(e) { console.error("Failed to update business invoice count", e); }
            }

            // 2. Increment Invoice counts for connected Client (Billed To) - only for Business Invoices
            if (newInvoice.isBusinessInvoice && newInvoice.clientId) {
                try {
                    const allClients = await clientRepo.getAll();
                    const cli = allClients.find(c => c.uniqueId === newInvoice.clientId || c.id === newInvoice.clientId);
                    if (cli) {
                        await clientRepo.update(cli.id, { invoiceCount: (cli.invoiceCount || 0) + 1 });
                    }
                } catch(e) { console.error("Failed to update client invoice count", e); }
            }
            
            return id;
        },

        updateInvoice: async (id, invoiceData, items, enableVendingParam = null) => {
            const isBus = Boolean(invoiceData.isBusinessInvoice);
            const repo = isBus ? businessInvoiceRepo : customerInvoiceRepo;
            const existing = await repo.getById(id);

            if (!existing) {
                throw new Error("Invoice not found to update.");
            }

            // Ensure invoice items are structured properly
            const processedItems = (items || []).map(item => new InvoiceItem({
                productId: item.productId,
                productName: item.productName,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice) || 0,
                unitCost: Number(item.unitCost) || 0,
                totalPrice: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
                itemProfit: ((Number(item.quantity) || 1) * (Number(item.unitPrice) || 0)) - ((Number(item.quantity) || 1) * (Number(item.unitCost) || 0))
            }));

            const finalInvNumber = (invoiceData.invoiceNumber || invoiceData.busInvNumber || existing.invoiceNumber || existing.busInvNumber || '').trim();

            const updatedInvoice = new Invoice({
                ...existing,
                ...invoiceData,
                id: id,
                invoiceNumber: finalInvNumber,
                busInvNumber: isBus ? finalInvNumber : (invoiceData.busInvNumber || existing.busInvNumber || ""),
                uniqueId: existing.uniqueId || invoiceData.uniqueId || generateUniqueId(),
                items: processedItems,
                creatorId: existing.creatorId || invoiceData.creatorId || "",
                timestamp: existing.timestamp || invoiceData.timestamp || Date.now()
            });

            // Validate using schema
            validateInvoice(updatedInvoice);

            // Calculate totals
            const calculations = calculateInvoiceTotal(
                updatedInvoice.items,
                updatedInvoice.discountPercent,
                updatedInvoice.additionalCut,
                updatedInvoice.taxPercent,
                updatedInvoice.shippingCost
            );

            updatedInvoice.totalPrice = calculations.grandTotal;
            updatedInvoice.totalProfit = calculations.totalProfit;

            // Handle Vending Mode adjustments: compare old vs new item quantities
            let shouldDeduct = enableVendingParam;
            if (shouldDeduct === null || shouldDeduct === undefined) {
                try {
                    const settingsService = getSettingsService(workspaceId);
                    shouldDeduct = await settingsService.isVendingEnabled();
                } catch(e) {
                    console.warn("Could not check vending status:", e);
                }
            }

            if (shouldDeduct) {
                const prodService = getProductService(workspaceId);
                const oldItemsMap = {};
                (existing.items || []).forEach(it => {
                    if (it.productId) oldItemsMap[it.productId] = (oldItemsMap[it.productId] || 0) + (Number(it.quantity) || 0);
                });

                const newItemsMap = {};
                (updatedInvoice.items || []).forEach(it => {
                    if (it.productId) newItemsMap[it.productId] = (newItemsMap[it.productId] || 0) + (Number(it.quantity) || 0);
                });

                const allProdIds = new Set([...Object.keys(oldItemsMap), ...Object.keys(newItemsMap)]);
                for (const pId of allProdIds) {
                    const oldQty = oldItemsMap[pId] || 0;
                    const newQty = newItemsMap[pId] || 0;
                    const diff = newQty - oldQty;
                    if (diff > 0) {
                        // Needs more deducted
                        await prodService.deductProductQuantity(pId, diff);
                    } else if (diff < 0) {
                        // Restore inventory (negative deduction = add)
                        await prodService.deductProductQuantity(pId, diff);
                    }
                }
            }

            const payload = JSON.parse(JSON.stringify(updatedInvoice));
            await repo.update(id, payload);
            return id;
        },

        deleteInvoice: async (id, isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            let itemCreatorId = null;
            try {
                const inv = await repo.getById(id);
                itemCreatorId = inv?.creatorId || null;
            } catch(e) {}
            await repo.delete(id);
            await firestoreService.updateMetricsCounter(workspaceId, 'invoice', false, itemCreatorId, 1);
        },

        updateInvoiceStatus: async (id, status, isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            await repo.update(id, { status });
        }
    };
};
