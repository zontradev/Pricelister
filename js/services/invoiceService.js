import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { Invoice, InvoiceItem } from '../../DataModel.js';
import { validateInvoice } from '../schemas/invoiceSchema.js';
import { calculateInvoiceTotal } from '../utils/invoiceCalculator.js';

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

        createInvoice: async (invoiceData, items, creatorId) => {
            // First construct the invoice object to validate
            const newInvoice = new Invoice({
                ...invoiceData,
                uniqueId: generateUniqueId(),
                items: items, // Will be structured and calculated below
                creatorId: creatorId,
                timestamp: Date.now()
            });

            // Ensure items are properly instantiated InvoiceItem models
            newInvoice.items = newInvoice.items.map(item => new InvoiceItem(item));

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

            // Also ensure each item's totalPrice/profit is set inside the item object
            // (The calculator calculates totals, but we need to ensure the item properties are populated)
            newInvoice.items.forEach(item => {
                const itemCalc = calculateInvoiceTotal([{...item}], 0, 0); // single item calculation helper equivalent
                item.totalPrice = item.quantity * item.unitPrice;
                item.itemProfit = item.totalPrice - (item.quantity * item.unitCost);
            });

            newInvoice.totalPrice = calculations.grandTotal;
            newInvoice.totalProfit = calculations.totalProfit;

            const repo = newInvoice.isBusinessInvoice ? businessInvoiceRepo : customerInvoiceRepo;
            const id = await repo.add(JSON.parse(JSON.stringify(newInvoice)));
            
            // Post-creation triggers
            
            // 1. Increment Invoice counts for connected Business (Issuer)
            if (newInvoice.businessId) {
                try {
                    const bus = await businessRepo.getById(newInvoice.businessId);
                    await businessRepo.update(newInvoice.businessId, { invoiceCount: (bus.invoiceCount || 0) + 1 });
                } catch(e) { console.error("Failed to update business invoice count", e); }
            }

            // 2. Increment Invoice counts for connected Client (Billed To) - only for Business Invoices
            if (newInvoice.isBusinessInvoice && newInvoice.clientId) {
                try {
                    const cli = await clientRepo.getById(newInvoice.clientId);
                    await clientRepo.update(newInvoice.clientId, { invoiceCount: (cli.invoiceCount || 0) + 1 });
                } catch(e) { console.error("Failed to update client invoice count", e); }
            }
            
            // NOTE: In a full system, saving an invoice would also trigger inventory reduction 
            // in productService. We leave that orchestration to higher-level controllers or Cloud Functions.
            
            return id;
        },

        updateInvoiceStatus: async (id, status, isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            await repo.update(id, { status });
        },

        archiveInvoice: async (id, isBusiness = false) => {
            const repo = isBusiness ? businessInvoiceRepo : customerInvoiceRepo;
            await repo.update(id, { isArchive: true });
        }
    };
};
