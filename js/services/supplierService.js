/**
 * PRICELISTER — SUPPLIER & MARKET INTELLIGENCE SERVICE (MODULE 06)
 * Supplier Directory CRUD, Multi-Supplier SKU Pricing, Competitor Price Tracking,
 * Immutable Price History Audit, and Data-Driven Supplier Performance
 */

import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';

// Seed Initial Verified Suppliers for local dev / testing sandbox
const INITIAL_SUPPLIERS = [
    {
        id: 'sup-vanguard-01',
        workspaceId: 'ws_dev_mock',
        uniqueId: 'SUP-001',
        name: 'Vanguard Industrial Supplies',
        contactPerson: 'Marcus Vance',
        phone: '+1 (555) 382-9100',
        email: 'm.vance@vanguard-ind.com',
        address: '840 Commercial Blvd, Chicago, IL 60607',
        country: 'United States',
        businessInfo: {
            taxId: 'US-EIN-9481204',
            registrationNumber: 'IL-BUS-2018-9921',
            website: 'https://vanguard-ind.example.com'
        },
        status: 'Active', // 'Active' | 'Inactive' | 'Restricted'
        paymentTerms: 'Net 30',
        notes: 'Preferred supplier for executive fixtures and commercial hardware.',
        createdAt: 1727740800000,
        updatedAt: 1730000000000,
        creatorId: 'developer@local.test'
    },
    {
        id: 'sup-shenzhen-02',
        workspaceId: 'ws_dev_mock',
        uniqueId: 'SUP-002',
        name: 'Shenzhen Precision Manufacturing',
        contactPerson: 'Li Wei',
        phone: '+86 755 8829 1102',
        email: 'sales@shenzhen-precision.cn',
        address: 'Bldg 4, High-Tech Industrial Park, Nanshan, Shenzhen',
        country: 'China',
        businessInfo: {
            taxId: 'CN-USCI-91440300MA5F',
            registrationNumber: 'GD-SZ-2016-4412',
            website: 'https://sz-precision.example.com'
        },
        status: 'Active',
        paymentTerms: '50% Advance / Net 30',
        notes: 'High-volume contract electronics and precision metal fabrication.',
        createdAt: 1728000000000,
        updatedAt: 1730100000000,
        creatorId: 'developer@local.test'
    },
    {
        id: 'sup-nordic-03',
        workspaceId: 'ws_dev_mock',
        uniqueId: 'SUP-003',
        name: 'Nordic Woodcraft & Acoustics',
        contactPerson: 'Astrid Lindholm',
        phone: '+46 8 123 4567',
        email: 'astrid@nordicwood.se',
        address: 'Storgatan 44, 114 55 Stockholm',
        country: 'Sweden',
        businessInfo: {
            taxId: 'SE-556123456701',
            registrationNumber: 'SE-ORG-2014-88',
            website: 'https://nordicwood.example.se'
        },
        status: 'Active',
        paymentTerms: 'Net 45',
        notes: 'Sustainable timber, acoustic absorption panels, and ergonomic desk components.',
        createdAt: 1728500000000,
        updatedAt: 1730200000000,
        creatorId: 'developer@local.test'
    }
];

export const getSupplierService = (workspaceId) => {
    const wsId = workspaceId || 'ws_dev_mock';
    const supplierRepo = createRepository('Suppliers', wsId);
    const supplierPricesRepo = createRepository('SupplierPrices', wsId);
    const competitorRepo = createRepository('CompetitorPrices', wsId);
    const priceHistoryRepo = createRepository('PriceHistory', wsId);

    return {
        // =========================================================================
        // 1. SUPPLIER DIRECTORY CRUD (Feature A)
        // =========================================================================
        getAllSuppliers: async (statusFilter = 'all') => {
            let suppliers = await supplierRepo.getAll();
            if (!suppliers || suppliers.length === 0) {
                for (const s of INITIAL_SUPPLIERS) {
                    await supplierRepo.add({ ...s, workspaceId: wsId });
                }
                suppliers = await supplierRepo.getAll();
            }

            if (statusFilter && statusFilter !== 'all') {
                return suppliers.filter(s => s.status === statusFilter);
            }
            return suppliers.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        },

        getSupplierById: async (supplierId) => {
            return await supplierRepo.getById(supplierId);
        },

        addSupplier: async (supplierData, creatorId = 'admin') => {
            if (!supplierData.name || !supplierData.name.trim()) {
                throw new Error("Supplier company title is required.");
            }

            const newId = `sup-${generateUniqueId()}`;
            const newSupplier = {
                id: newId,
                workspaceId: wsId,
                uniqueId: `SUP-${String(Date.now()).slice(-4)}`,
                name: supplierData.name.trim(),
                contactPerson: supplierData.contactPerson ? supplierData.contactPerson.trim() : '',
                phone: supplierData.phone ? supplierData.phone.trim() : '',
                email: supplierData.email ? supplierData.email.trim() : '',
                address: supplierData.address ? supplierData.address.trim() : '',
                country: supplierData.country ? supplierData.country.trim() : 'Global',
                businessInfo: supplierData.businessInfo || {
                    taxId: supplierData.taxId || '',
                    website: supplierData.website || ''
                },
                status: supplierData.status || 'Active', // 'Active' | 'Inactive' | 'Restricted'
                paymentTerms: supplierData.paymentTerms || 'Net 30',
                notes: supplierData.notes || '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                creatorId: creatorId
            };

            await supplierRepo.add(newSupplier);
            return newSupplier;
        },

        updateSupplier: async (supplierId, updateData) => {
            const existing = await supplierRepo.getById(supplierId);
            if (!existing) throw new Error("Supplier not found.");

            const updated = {
                ...updateData,
                updatedAt: Date.now()
            };

            await supplierRepo.update(supplierId, updated);
            return { ...existing, ...updated };
        },

        archiveSupplier: async (supplierId) => {
            await supplierRepo.update(supplierId, { status: 'Inactive', updatedAt: Date.now() });
        },

        deleteSupplier: async (supplierId) => {
            await supplierRepo.delete(supplierId);
        },

        // =========================================================================
        // 2. SUPPLIER-SPECIFIC PRICING (Feature B)
        // =========================================================================
        getSupplierPricesByProduct: async (productId) => {
            const allPrices = await supplierPricesRepo.getAll();
            return allPrices.filter(sp => sp.productId === productId);
        },

        getAllSupplierPrices: async () => {
            return await supplierPricesRepo.getAll();
        },

        setSupplierPrice: async ({
            supplierId,
            supplierName,
            productId,
            productName,
            sku,
            variationId = null,
            costPrice,
            currency = '$',
            minOrderQty = 1,
            leadTimeDays = 7,
            validFrom = new Date().toISOString(),
            validTo = null,
            tierPrices = [],
            recordedBy = 'admin'
        }) => {
            if (!supplierId || !productId) throw new Error("Supplier ID and Product ID are required.");
            const allPrices = await supplierPricesRepo.getAll();
            
            // Check for existing active quote for this specific supplier & product/variation
            const existing = allPrices.find(p => 
                p.supplierId === supplierId && 
                p.productId === productId && 
                (variationId ? p.variationId === variationId : true)
            );

            const oldCost = existing ? Number(existing.costPrice) : null;
            const newCost = Number(costPrice);

            let priceRecordId;
            if (existing) {
                priceRecordId = existing.id;
                await supplierPricesRepo.update(priceRecordId, {
                    costPrice: newCost,
                    minOrderQty: Number(minOrderQty) || 1,
                    leadTimeDays: Number(leadTimeDays) || 7,
                    validFrom,
                    validTo,
                    tierPrices: tierPrices || [],
                    lastUpdated: Date.now(),
                    updatedBy: recordedBy
                });
            } else {
                priceRecordId = `sp-${generateUniqueId()}`;
                const newRecord = {
                    id: priceRecordId,
                    workspaceId: wsId,
                    supplierId,
                    supplierName,
                    productId,
                    productName,
                    sku: sku || 'SKU-GEN',
                    variationId,
                    costPrice: newCost,
                    currency,
                    minOrderQty: Number(minOrderQty) || 1,
                    leadTimeDays: Number(leadTimeDays) || 7,
                    validFrom,
                    validTo,
                    tierPrices: tierPrices || [],
                    isCurrent: true,
                    createdAt: Date.now(),
                    lastUpdated: Date.now(),
                    recordedBy
                };
                await supplierPricesRepo.add(newRecord);
            }

            // Record immutable price history entry if price changed
            if (oldCost !== null && oldCost !== newCost) {
                await getSupplierService(wsId).recordPriceHistory({
                    productId,
                    productName,
                    sku,
                    supplierId,
                    supplierName,
                    variationId,
                    priceType: 'purchase_cost',
                    oldPrice: oldCost,
                    newPrice: newCost,
                    changeSource: 'Supplier Price Quote Update',
                    responsibleUserId: recordedBy
                });
            }

            return priceRecordId;
        },

        deleteSupplierPrice: async (priceRecordId) => {
            await supplierPricesRepo.delete(priceRecordId);
        },

        // =========================================================================
        // 3. COMPETITOR PRICE TRACKING (Feature D)
        // =========================================================================
        getCompetitorPricesByProduct: async (productId) => {
            const all = await competitorRepo.getAll();
            return all.filter(c => c.productId === productId);
        },

        getAllCompetitorPrices: async () => {
            const all = await competitorRepo.getAll();
            return all.sort((a, b) => new Date(b.observationDate).getTime() - new Date(a.observationDate).getTime());
        },

        addCompetitorPrice: async ({
            productId,
            productName,
            sku,
            competitorName,
            competitorPrice,
            source = 'Published Price List',
            observationDate = new Date().toISOString().split('T')[0],
            notes = '',
            recordedBy = 'admin'
        }) => {
            if (!competitorName || !competitorPrice) {
                throw new Error("Competitor name and price are required.");
            }

            const compId = `comp-${generateUniqueId()}`;
            const record = {
                id: compId,
                workspaceId: wsId,
                productId,
                productName,
                sku,
                competitorName: competitorName.trim(),
                competitorPrice: Number(competitorPrice),
                source,
                observationDate,
                notes,
                recordedBy,
                createdAt: Date.now()
            };

            await competitorRepo.add(record);
            return record;
        },

        deleteCompetitorPrice: async (id) => {
            await competitorRepo.delete(id);
        },

        // =========================================================================
        // 4. IMMUTABLE PRICE HISTORY AUDIT (Feature F)
        // =========================================================================
        getPriceHistory: async ({ productId = null, supplierId = null } = {}) => {
            const all = await priceHistoryRepo.getAll();
            let filtered = all;
            if (productId) filtered = filtered.filter(h => h.productId === productId);
            if (supplierId) filtered = filtered.filter(h => h.supplierId === supplierId);
            return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        },

        recordPriceHistory: async ({
            productId,
            productName,
            sku,
            supplierId = null,
            supplierName = 'Direct Catalog',
            variationId = null,
            priceType = 'purchase_cost', // 'purchase_cost' | 'retail_sale' | 'competitor'
            oldPrice,
            newPrice,
            changeSource = 'Manual Edit',
            responsibleUserId = 'admin',
            responsibleUserName = 'Workspace Admin'
        }) => {
            const oldP = Number(oldPrice || 0);
            const newP = Number(newPrice || 0);
            const diffAmount = newP - oldP;
            const diffPercent = oldP > 0 ? Number(((diffAmount / oldP) * 100).toFixed(2)) : 100;

            const record = {
                id: `prchist-${generateUniqueId()}`,
                workspaceId: wsId,
                productId,
                productName,
                sku,
                supplierId,
                supplierName,
                variationId,
                priceType,
                oldPrice: oldP,
                newPrice: newP,
                diffAmount,
                diffPercent,
                changeSource,
                responsibleUserId,
                responsibleUserName,
                timestamp: Date.now(),
                recordedAt: new Date().toISOString()
            };

            await priceHistoryRepo.add(record);
            return record;
        },

        // =========================================================================
        // 5. DATA-DRIVEN SUPPLIER PERFORMANCE METRICS (Feature E)
        // =========================================================================
        getSupplierPerformanceMetrics: async (supplierId) => {
            const supplier = await supplierRepo.getById(supplierId);
            if (!supplier) throw new Error("Supplier not found");

            const allQuotes = await supplierPricesRepo.getAll();
            const supplierQuotes = allQuotes.filter(q => q.supplierId === supplierId);
            const allHistory = await priceHistoryRepo.getAll();
            const priceChanges = allHistory.filter(h => h.supplierId === supplierId);

            // Calculate actual price variance stability
            let priceVolatility = 0;
            if (priceChanges.length > 0) {
                const totalPct = priceChanges.reduce((sum, h) => sum + Math.abs(h.diffPercent || 0), 0);
                priceVolatility = Number((totalPct / priceChanges.length).toFixed(1));
            }

            // Calculate average lead time across quote catalog
            const avgLeadTime = supplierQuotes.length > 0 
                ? Math.round(supplierQuotes.reduce((acc, q) => acc + Number(q.leadTimeDays || 7), 0) / supplierQuotes.length)
                : 7;

            return {
                supplierId,
                supplierName: supplier.name,
                status: supplier.status,
                activeSKUCount: supplierQuotes.length,
                averageLeadTimeDays: avgLeadTime,
                totalRecordedPriceAdjustments: priceChanges.length,
                averagePriceVolatilityPct: priceVolatility,
                priceStabilityRating: priceVolatility <= 3 ? 'High (Stable)' : (priceVolatility <= 8 ? 'Moderate' : 'Volatile'),
                paymentTerms: supplier.paymentTerms || 'Net 30',
                country: supplier.country || 'Global'
            };
        }
    };
};

