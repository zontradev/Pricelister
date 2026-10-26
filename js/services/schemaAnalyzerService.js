/**
 * schemaAnalyzerService.js
 * Advanced relational intelligence, connection mapping, demand velocity,
 * basket co-occurrence affinity, and schema integrity engine for PriceLister.
 */

import { getProductService } from './productService.js';
import { getCategoryService } from './categoryService.js';
import { getInvoiceService } from './invoiceService.js';
import { getPeopleService } from './peopleService.js';
import { getOrderService } from './orderService.js';
import { createRepository } from '../../firebase/firestore.js';
import { getInitialDemoData } from '../../firebase/demoData.js';

// Safe timestamp normalization helper
const parseTimestamp = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    if (typeof val === 'string') {
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

// Normalized string comparison helper
const cleanStr = (s) => String(s || '').trim();
const matchIds = (a, b) => {
    if (a === null || a === undefined || b === null || b === undefined) return false;
    return String(a).trim() === String(b).trim();
};

export const getSchemaAnalyzerService = (workspaceId) => {
    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);
    const invoiceService = getInvoiceService(workspaceId);
    const peopleService = getPeopleService(workspaceId);
    const orderService = getOrderService(workspaceId);
    const membersRepo = createRepository('Members', workspaceId);

    return {
        /**
         * Fetch all workspace entities in parallel
         */
        fetchAllData: async () => {
            let [
                products,
                categories,
                customerInvoices,
                businessInvoices,
                businesses,
                clients,
                customers,
                orders,
                members
            ] = await Promise.all([
                productService.getAllActiveProducts().catch(() => []),
                categoryService.getAllCategories().catch(() => []),
                invoiceService.getAllInvoices(false).catch(() => []),
                invoiceService.getAllInvoices(true).catch(() => []),
                peopleService.getAllBusinesses().catch(() => []),
                peopleService.getAllClients().catch(() => []),
                peopleService.getAllCustomers().catch(() => []),
                orderService.getAllOrders().catch(() => []),
                membersRepo.getAll().catch(() => [])
            ]);

            products = products || [];
            categories = categories || [];
            customerInvoices = customerInvoices || [];
            businessInvoices = businessInvoices || [];
            businesses = businesses || [];
            clients = clients || [];
            customers = customers || [];
            orders = orders || [];
            members = members || [];

            // If workspace is fresh with no data or in test sandbox, load seed demo data for instant analysis
            if (products.length === 0 && customerInvoices.length === 0) {
                try {
                    const demo = getInitialDemoData();
                    if (demo) {
                        products = demo.products || [];
                        categories = demo.categories || [];
                        customerInvoices = demo.customerInvoices || demo.Invoices || [];
                        businessInvoices = demo.businessInvoices || [];
                        businesses = demo.businesses || demo.BusinessProfiles || [];
                        clients = demo.clients || demo.ClientProfiles || [];
                        customers = demo.customers || [];
                    }
                } catch (e) {
                    console.warn("Demo data fallback warning:", e);
                }
            }

            const allInvoices = [...customerInvoices, ...businessInvoices];
            const allParties = [...businesses, ...clients, ...customers];

            return {
                products,
                categories,
                customerInvoices,
                businessInvoices,
                allInvoices,
                businesses,
                clients,
                customers,
                allParties,
                orders,
                members
            };
        },

        /**
         * Compute comprehensive workspace schema graph & topological summary
         */
        computeSchemaTopology: (data) => {
            const {
                products,
                categories,
                customerInvoices,
                businessInvoices,
                allInvoices,
                businesses,
                clients,
                customers,
                orders,
                members
            } = data;

            // Map lookups for fast entity resolution
            const categoryMap = new Map(categories.map(c => [String(c.id || c.uniqueId), c]));
            const productMap = new Map();
            products.forEach(p => {
                if (p.id) productMap.set(String(p.id), p);
                if (p.uniqueId) productMap.set(String(p.uniqueId), p);
            });
            const businessMap = new Map(businesses.map(b => [String(b.id || b.uniqueId), b]));
            const clientMap = new Map(clients.map(c => [String(c.id || c.uniqueId), c]));

            let productToInvoiceEdges = 0;
            let productToCategoryEdges = 0;
            let invoiceToBusinessEdges = 0;
            let invoiceToClientEdges = 0;
            let orderToProductEdges = 0;
            let memberToCreationEdges = 0;

            // 1. Category -> Product edges
            products.forEach(p => {
                if (p.category && categoryMap.has(String(p.category))) {
                    productToCategoryEdges++;
                }
            });

            // 2. Invoice edges
            allInvoices.forEach(inv => {
                // Party relations
                if (inv.isBusinessInvoice && inv.businessId && businessMap.has(String(inv.businessId))) {
                    invoiceToBusinessEdges++;
                } else if (!inv.isBusinessInvoice && (inv.clientId || inv.customerId)) {
                    invoiceToClientEdges++;
                }

                // Line item relations
                if (Array.isArray(inv.items)) {
                    inv.items.forEach(it => {
                        if (it.productId && productMap.has(String(it.productId))) {
                            productToInvoiceEdges++;
                        }
                    });
                }
            });

            // 3. Order edges
            orders.forEach(ord => {
                if (Array.isArray(ord.items)) {
                    ord.items.forEach(it => {
                        if (it.productId && productMap.has(String(it.productId))) {
                            orderToProductEdges++;
                        }
                    });
                }
            });

            // 4. Member creator edges
            const memberIdSet = new Set(members.map(m => String(m.userId || m.membershipId || m.id)));
            products.forEach(p => {
                if (p.creatorId && memberIdSet.has(String(p.creatorId))) memberToCreationEdges++;
            });
            allInvoices.forEach(inv => {
                if (inv.creatorId && memberIdSet.has(String(inv.creatorId))) memberToCreationEdges++;
            });

            const totalNodes = products.length + categories.length + allInvoices.length +
                businesses.length + clients.length + customers.length + orders.length + members.length;

            const totalEdges = productToInvoiceEdges + productToCategoryEdges +
                invoiceToBusinessEdges + invoiceToClientEdges + orderToProductEdges + memberToCreationEdges;

            return {
                nodeCounts: {
                    products: products.length,
                    categories: categories.length,
                    invoices: allInvoices.length,
                    customerInvoices: customerInvoices.length,
                    businessInvoices: businessInvoices.length,
                    businesses: businesses.length,
                    clients: clients.length,
                    customers: customers.length,
                    orders: orders.length,
                    members: members.length,
                    totalNodes
                },
                edgeCounts: {
                    productToInvoiceEdges,
                    productToCategoryEdges,
                    invoiceToBusinessEdges,
                    invoiceToClientEdges,
                    orderToProductEdges,
                    memberToCreationEdges,
                    totalEdges
                },
                densityScore: totalNodes > 1 ? Number(((2 * totalEdges) / (totalNodes * (totalNodes - 1))).toFixed(4)) : 0
            };
        },

        /**
         * Analyze deep connections, demand velocity, and affinity for a specific product
         */
        analyzeProductConnections: (productId, data) => {
            const { products, categories, allInvoices, orders, businesses, clients, customers } = data;
            
            // Find target product
            const targetProduct = products.find(p => matchIds(p.id, productId) || matchIds(p.uniqueId, productId));
            if (!targetProduct) return null;

            const targetPId = String(targetProduct.id || '');
            const targetPUniqueId = String(targetProduct.uniqueId || '');
            const targetName = cleanStr(targetProduct.name).toLowerCase();

            // Category match
            const category = categories.find(c => matchIds(c.id, targetProduct.category) || matchIds(c.uniqueId, targetProduct.category));

            // Invoices referencing this product
            const matchedInvoices = [];
            let totalQuantityInvoiced = 0;
            let totalRevenueGenerated = 0;
            let totalProfitGenerated = 0;

            // Basket co-occurrence accumulator: { [otherProductId]: { product, count, totalQty } }
            const coOccurrenceMap = new Map();

            // Client & Business demand accumulator
            const partyDemandMap = new Map();

            // Timestamp tracking
            const timelineBuckets = {
                daily: new Map(),
                weekly: new Map(),
                monthly: new Map(),
                dayOfWeek: [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
            };

            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

            let qtyLast7Days = 0;
            let qtyLast30Days = 0;
            let invoicesLast7Days = 0;
            let invoicesLast30Days = 0;

            allInvoices.forEach(inv => {
                if (!inv.items || !Array.isArray(inv.items)) return;

                // Check if target product is in this invoice
                let foundItemInInv = null;
                for (const it of inv.items) {
                    const itPId = String(it.productId || '');
                    const itName = cleanStr(it.productName).toLowerCase();
                    if ((itPId && (itPId === targetPId || itPId === targetPUniqueId)) || (itName && targetName && itName === targetName)) {
                        foundItemInInv = it;
                        break;
                    }
                }

                if (!foundItemInInv) return;

                const invTime = parseTimestamp(inv.timestamp || inv.createdAt);
                const invDate = new Date(invTime || now);
                const qty = Number(foundItemInInv.quantity) || 1;
                const unitPrice = Number(foundItemInInv.unitPrice) || 0;
                const totalPrice = Number(foundItemInInv.totalPrice) || (qty * unitPrice);
                const profit = Number(foundItemInInv.itemProfit) || 0;

                totalQuantityInvoiced += qty;
                totalRevenueGenerated += totalPrice;
                totalProfitGenerated += profit;

                // Velocity counts
                if (invTime >= sevenDaysAgo) {
                    qtyLast7Days += qty;
                    invoicesLast7Days++;
                }
                if (invTime >= thirtyDaysAgo) {
                    qtyLast30Days += qty;
                    invoicesLast30Days++;
                }

                // Timeline clustering
                if (invTime > 0) {
                    const dayKey = invDate.toISOString().split('T')[0];
                    timelineBuckets.daily.set(dayKey, (timelineBuckets.daily.get(dayKey) || 0) + qty);

                    const monthKey = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;
                    timelineBuckets.monthly.set(monthKey, (timelineBuckets.monthly.get(monthKey) || 0) + qty);

                    timelineBuckets.dayOfWeek[invDate.getDay()] += qty;
                }

                // Party breakdown
                let partyId = inv.isBusinessInvoice ? inv.businessId : (inv.clientId || inv.customerId);
                let partyName = inv.isBusinessInvoice ? (inv.businessName || 'Unnamed Business') : (inv.customerName || 'Direct Customer');
                let partyType = inv.isBusinessInvoice ? 'Business' : 'Customer';

                const partyKey = `${partyType}:${partyId || partyName}`;
                if (!partyDemandMap.has(partyKey)) {
                    partyDemandMap.set(partyKey, {
                        partyId,
                        partyName,
                        partyType,
                        totalQuantity: 0,
                        totalSpend: 0,
                        invoiceCount: 0,
                        lastInvoiceTimestamp: 0
                    });
                }
                const pEntry = partyDemandMap.get(partyKey);
                pEntry.totalQuantity += qty;
                pEntry.totalSpend += totalPrice;
                pEntry.invoiceCount++;
                if (invTime > pEntry.lastInvoiceTimestamp) {
                    pEntry.lastInvoiceTimestamp = invTime;
                }

                // Basket Co-occurrence Affinity ("which use likes more")
                inv.items.forEach(otherIt => {
                    const otherPId = String(otherIt.productId || '');
                    const otherName = cleanStr(otherIt.productName);
                    // Skip self
                    if ((otherPId && (otherPId === targetPId || otherPId === targetPUniqueId)) ||
                        (otherName.toLowerCase() === targetName)) {
                        return;
                    }

                    const coKey = otherPId || otherName;
                    if (!coOccurrenceMap.has(coKey)) {
                        coOccurrenceMap.set(coKey, {
                            productId: otherPId,
                            productName: otherName || 'Unnamed Product',
                            coInvoicedCount: 0,
                            totalCoQuantity: 0
                        });
                    }
                    const coEntry = coOccurrenceMap.get(coKey);
                    coEntry.coInvoicedCount++;
                    coEntry.totalCoQuantity += Number(otherIt.quantity) || 1;
                });

                matchedInvoices.push({
                    id: inv.id,
                    uniqueId: inv.uniqueId,
                    invoiceNumber: inv.invoiceNumber || inv.busInvNumber || 'N/A',
                    isBusinessInvoice: Boolean(inv.isBusinessInvoice),
                    status: inv.status || 'Paid',
                    timestamp: invTime,
                    dateFormatted: invTime ? new Date(invTime).toLocaleDateString() : 'Unknown date',
                    partyName,
                    quantity: qty,
                    unitPrice,
                    totalPrice,
                    profit
                });
            });

            // Sort invoices by recency (newest first)
            matchedInvoices.sort((a, b) => b.timestamp - a.timestamp);

            // Storefront orders referencing this product
            const matchedOrders = [];
            orders.forEach(ord => {
                if (!ord.items || !Array.isArray(ord.items)) return;
                const found = ord.items.find(it => {
                    const itPId = String(it.productId || '');
                    const itName = cleanStr(it.productName).toLowerCase();
                    return (itPId && (itPId === targetPId || itPId === targetPUniqueId)) || (itName && targetName && itName === targetName);
                });
                if (found) {
                    matchedOrders.push({
                        id: ord.id || ord.uniqueId,
                        orderNumber: ord.orderNumber || 'ORD',
                        customerName: ord.customerName || ord.customerPhone || 'Online Shopper',
                        quantity: Number(found.quantity) || 1,
                        unitPrice: Number(found.unitPrice) || 0,
                        status: ord.status || 'PENDING',
                        createdAt: parseTimestamp(ord.createdAt)
                    });
                }
            });

            // Precompute global invoice occurrences for all products to calculate true Apriori Association Lift
            const globalProductInvoiceCounts = new Map();
            let totalWorkspaceProfit = 0;
            allInvoices.forEach(inv => {
                totalWorkspaceProfit += Number(inv.totalProfit) || 0;
                if (!inv.items || !Array.isArray(inv.items)) return;
                const seenInThisInv = new Set();
                inv.items.forEach(it => {
                    const id = String(it.productId || cleanStr(it.productName).toLowerCase());
                    if (id && !seenInThisInv.has(id)) {
                        seenInThisInv.add(id);
                        globalProductInvoiceCounts.set(id, (globalProductInvoiceCounts.get(id) || 0) + 1);
                    }
                });
            });

            const totalWorkspaceInvoices = Math.max(allInvoices.length, 1);

            // Process Co-occurrence Affinity rankings with Association Rule Mining (Support, Confidence, Lift)
            const coOccurrenceList = Array.from(coOccurrenceMap.values()).map(co => {
                const confidencePct = matchedInvoices.length > 0
                    ? Math.round((co.coInvoicedCount / matchedInvoices.length) * 100)
                    : 0;

                const otherPId = co.productId || cleanStr(co.productName).toLowerCase();
                const otherTotalInvoices = globalProductInvoiceCounts.get(otherPId) || co.coInvoicedCount;
                
                // Lift = (P(A & B)) / (P(A) * P(B)) = (coCount * totalInvs) / (targetInvs * otherInvs)
                const lift = (matchedInvoices.length > 0 && otherTotalInvoices > 0)
                    ? Number(((co.coInvoicedCount * totalWorkspaceInvoices) / (matchedInvoices.length * otherTotalInvoices)).toFixed(2))
                    : 1.0;

                let liftLabel = 'Independent Pair';
                let liftColor = '#64748b';
                if (lift >= 2.5) {
                    liftLabel = 'Very High Affinity';
                    liftColor = '#10B981';
                } else if (lift >= 1.5) {
                    liftLabel = 'Strong Association';
                    liftColor = '#059669';
                } else if (lift >= 1.0) {
                    liftLabel = 'Moderate Pairing';
                    liftColor = '#3B82F6';
                }

                return {
                    ...co,
                    affinityPercentage: confidencePct,
                    confidencePct,
                    lift,
                    liftLabel,
                    liftColor
                };
            }).sort((a, b) => b.coInvoicedCount - a.coInvoicedCount);

            // Process Top Buyers with Recency & Retention Status
            const topBuyers = Array.from(partyDemandMap.values()).map(tb => {
                const daysSinceLastOrder = tb.lastInvoiceTimestamp > 0
                    ? Math.max(0, Math.floor((now - tb.lastInvoiceTimestamp) / (24 * 60 * 60 * 1000)))
                    : 999;

                let retentionStatus = 'ACTIVE_VIP';
                let retentionLabel = 'Active VIP';
                let retentionColor = '#10B981';

                if (daysSinceLastOrder > 90) {
                    retentionStatus = 'CHURN_RISK';
                    retentionLabel = 'Dormant (At Risk)';
                    retentionColor = '#EF4444';
                } else if (daysSinceLastOrder > 60) {
                    retentionStatus = 'COOLING_OFF';
                    retentionLabel = 'Cooling Off';
                    retentionColor = '#F59E0B';
                } else if (daysSinceLastOrder > 30) {
                    retentionStatus = 'STEADY';
                    retentionLabel = 'Steady Buyer';
                    retentionColor = '#3B82F6';
                }

                // Loyalty Index out of 100 (combination of frequency, recency, and monetary)
                const recencyScore = Math.max(0, 40 - Math.min(40, daysSinceLastOrder * 0.4));
                const frequencyScore = Math.min(30, tb.invoiceCount * 6);
                const monetaryScore = Math.min(30, (tb.totalSpend / 100) * 3);
                const loyaltyIndex = Math.min(100, Math.round(recencyScore + frequencyScore + monetaryScore));

                return {
                    ...tb,
                    daysSinceLastOrder,
                    retentionStatus,
                    retentionLabel,
                    retentionColor,
                    loyaltyIndex
                };
            }).sort((a, b) => b.totalQuantity - a.totalQuantity);

            // Demand Velocity & Stock Burn Runway
            const currentStock = Number(targetProduct.quantity) || 0;
            const dailyBurnRate = qtyLast30Days > 0 ? (qtyLast30Days / 30) : (qtyLast7Days > 0 ? (qtyLast7Days / 7) : 0);
            const stockRunwayDays = dailyBurnRate > 0 ? Math.round(currentStock / dailyBurnRate) : (currentStock > 0 ? 999 : 0);

            // Advanced Restock Calculations (Reorder Point & Safety Buffer)
            const leadTimeDays = 7;
            const safetyStock = Math.ceil(1.65 * dailyBurnRate * Math.sqrt(leadTimeDays));
            const reorderPoint = Math.ceil((dailyBurnRate * leadTimeDays) + safetyStock);
            
            let stockStatus = 'OPTIMAL';
            let stockStatusLabel = 'Optimal Inventory';
            let stockStatusColor = '#10B981';

            if (currentStock === 0) {
                stockStatus = 'OUT_OF_STOCK';
                stockStatusLabel = 'Out of Stock (Zero Units)';
                stockStatusColor = '#EF4444';
            } else if (currentStock <= safetyStock) {
                stockStatus = 'CRITICAL_RESTOCK';
                stockStatusLabel = 'Critical Restock Urgency';
                stockStatusColor = '#EF4444';
            } else if (currentStock <= reorderPoint) {
                stockStatus = 'REORDER_RECOMMENDED';
                stockStatusLabel = 'Reorder Level Reached';
                stockStatusColor = '#F59E0B';
            } else if (stockRunwayDays > 90) {
                stockStatus = 'SURPLUS';
                stockStatusLabel = 'Surplus Stock Runway';
                stockStatusColor = '#64748b';
            }

            // Demand Volatility (Coefficient of Variation CV = StdDev / Mean)
            const monthlyValues = Array.from(timelineBuckets.monthly.values());
            let volatilityCV = 0;
            let volatilityLabel = 'Stable Demand';
            let volatilityColor = '#10B981';

            if (monthlyValues.length > 1) {
                const mean = monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length;
                if (mean > 0) {
                    const variance = monthlyValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / monthlyValues.length;
                    const stdDev = Math.sqrt(variance);
                    volatilityCV = Number((stdDev / mean).toFixed(2));
                    if (volatilityCV >= 0.7) {
                        volatilityLabel = 'Spiky / Erratic Demand';
                        volatilityColor = '#EF4444';
                    } else if (volatilityCV >= 0.35) {
                        volatilityLabel = 'Moderate Fluctuation';
                        volatilityColor = '#F59E0B';
                    }
                }
            }

            // Financial Performance & GMROI (Gross Margin Return on Investment)
            const costPrice = Number(targetProduct.price) || 0;
            const salePrice = Number(targetProduct.salePrice || targetProduct.price) || 0;
            const unitGrossProfit = Math.max(0, salePrice - costPrice);
            const grossMarginPct = salePrice > 0 ? Number(((unitGrossProfit / salePrice) * 100).toFixed(1)) : 0;
            const inventoryHoldingCost = currentStock * costPrice;
            const profitContributionPct = totalWorkspaceProfit > 0
                ? Number(((totalProfitGenerated / totalWorkspaceProfit) * 100).toFixed(1))
                : 0;
            const gmroi = inventoryHoldingCost > 0
                ? Number(((totalProfitGenerated / inventoryHoldingCost) * 100).toFixed(1))
                : 0;

            // Format day of week labels
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const peakDayIndex = timelineBuckets.dayOfWeek.indexOf(Math.max(...timelineBuckets.dayOfWeek));
            const peakDayName = timelineBuckets.dayOfWeek[peakDayIndex] > 0 ? dayNames[peakDayIndex] : 'N/A';

            return {
                product: targetProduct,
                category,
                summary: {
                    totalInvoicesCount: matchedInvoices.length,
                    totalOrdersCount: matchedOrders.length,
                    totalQuantityInvoiced,
                    totalRevenueGenerated,
                    totalProfitGenerated,
                    currentStock,
                    qtyLast7Days,
                    qtyLast30Days,
                    invoicesLast7Days,
                    invoicesLast30Days,
                    dailyBurnRate: Number(dailyBurnRate.toFixed(2)),
                    stockRunwayDays,
                    peakDayName
                },
                advancedMath: {
                    volatilityCV,
                    volatilityLabel,
                    volatilityColor,
                    unitGrossProfit,
                    grossMarginPct,
                    inventoryHoldingCost,
                    profitContributionPct,
                    gmroi,
                    safetyStock,
                    reorderPoint,
                    stockStatus,
                    stockStatusLabel,
                    stockStatusColor
                },
                invoices: matchedInvoices,
                orders: matchedOrders,
                coOccurrenceList: coOccurrenceList.slice(0, 15),
                topBuyers: topBuyers.slice(0, 10),
                timeline: {
                    monthly: Array.from(timelineBuckets.monthly.entries()).map(([month, qty]) => ({ month, qty })),
                    dayOfWeek: dayNames.map((name, i) => ({ day: name, qty: timelineBuckets.dayOfWeek[i] }))
                }
            };
        },

        /**
         * Analyze all workspace entities for connection links, orphans, and schema integrity
         */
        auditSchemaHealth: (data) => {
            const { products, categories, allInvoices, businesses, clients, customers } = data;

            const categoryIdSet = new Set(categories.map(c => String(c.id || c.uniqueId)));
            const productIdSet = new Set();
            products.forEach(p => {
                if (p.id) productIdSet.add(String(p.id));
                if (p.uniqueId) productIdSet.add(String(p.uniqueId));
            });

            const businessIdSet = new Set(businesses.map(b => String(b.id || b.uniqueId)));
            const clientCustomerIdSet = new Set([
                ...clients.map(c => String(c.id || c.uniqueId)),
                ...customers.map(c => String(c.id || c.uniqueId))
            ]);

            const issues = [];

            // 1. Products with missing or invalid Category ID
            let uncategorizedProductsCount = 0;
            let invalidCategoryProductsCount = 0;
            products.forEach(p => {
                if (!p.category) {
                    uncategorizedProductsCount++;
                } else if (!categoryIdSet.has(String(p.category))) {
                    invalidCategoryProductsCount++;
                }
            });

            if (uncategorizedProductsCount > 0) {
                issues.push({
                    type: 'WARNING',
                    entity: 'Products',
                    code: 'UNCATEGORIZED_PRODUCTS',
                    title: `${uncategorizedProductsCount} Products have no Category`,
                    description: 'Products without categories may not filter properly in customer storefronts and catalogs.',
                    count: uncategorizedProductsCount,
                    actionHash: '#/products'
                });
            }

            if (invalidCategoryProductsCount > 0) {
                issues.push({
                    type: 'CRITICAL',
                    entity: 'Products',
                    code: 'DANGLING_CATEGORY_REFERENCE',
                    title: `${invalidCategoryProductsCount} Products reference deleted categories`,
                    description: 'These products contain category IDs that no longer exist in the Categories table.',
                    count: invalidCategoryProductsCount,
                    actionHash: '#/categories'
                });
            }

            // 2. Invoices referencing deleted or unlinked products
            let orphanInvoiceItemsCount = 0;
            const orphanInvoiceIds = new Set();

            allInvoices.forEach(inv => {
                if (Array.isArray(inv.items)) {
                    inv.items.forEach(it => {
                        const itId = String(it.productId || '');
                        if (itId && !productIdSet.has(itId)) {
                            orphanInvoiceItemsCount++;
                            orphanInvoiceIds.add(inv.invoiceNumber || inv.busInvNumber || inv.id);
                        }
                    });
                }
            });

            if (orphanInvoiceItemsCount > 0) {
                issues.push({
                    type: 'INFO',
                    entity: 'Invoices',
                    code: 'ORPHAN_INVOICE_ITEMS',
                    title: `${orphanInvoiceItemsCount} Invoice items reference deleted catalog products`,
                    description: `Historical line items in ${orphanInvoiceIds.size} invoices reference product IDs no longer in your active catalog. This is normal for removed items, but tracked for historical schema accuracy.`,
                    count: orphanInvoiceItemsCount,
                    actionHash: '#/invoices/customer'
                });
            }

            // 3. Invoices referencing deleted Business or Client profiles
            let danglingBusinessInvoicesCount = 0;
            allInvoices.forEach(inv => {
                if (inv.isBusinessInvoice && inv.businessId && !businessMapHas(inv.businessId, businessIdSet)) {
                    danglingBusinessInvoicesCount++;
                }
            });

            function businessMapHas(bId, set) {
                return set.has(String(bId));
            }

            if (danglingBusinessInvoicesCount > 0) {
                issues.push({
                    type: 'WARNING',
                    entity: 'Business Invoices',
                    code: 'DANGLING_BUSINESS_PROFILE',
                    title: `${danglingBusinessInvoicesCount} Invoices reference unlinked business profiles`,
                    description: 'Invoices created for business accounts whose profiles were deleted or not permanently saved.',
                    count: danglingBusinessInvoicesCount,
                    actionHash: '#/invoices/business'
                });
            }

            // 4. Products with 0 usage (Dormant products)
            const usedProductIds = new Set();
            allInvoices.forEach(inv => {
                if (Array.isArray(inv.items)) {
                    inv.items.forEach(it => {
                        if (it.productId) usedProductIds.add(String(it.productId));
                        if (it.productName) usedProductIds.add(cleanStr(it.productName).toLowerCase());
                    });
                }
            });

            const dormantProducts = products.filter(p => {
                const idMatch = usedProductIds.has(String(p.id)) || usedProductIds.has(String(p.uniqueId));
                const nameMatch = usedProductIds.has(cleanStr(p.name).toLowerCase());
                return !idMatch && !nameMatch;
            });

            if (dormantProducts.length > 0) {
                issues.push({
                    type: 'INFO',
                    entity: 'Products',
                    code: 'DORMANT_ZERO_DEMAND_PRODUCTS',
                    title: `${dormantProducts.length} Products have 0 invoice demand (Dormant)`,
                    description: 'Products in your catalog that have never been included in any invoice or customer order.',
                    count: dormantProducts.length,
                    actionHash: '#/products'
                });
            }

            // 5. Product field completeness audit
            let missingUpc = 0;
            let missingPrice = 0;
            let missingImage = 0;

            products.forEach(p => {
                if (!p.upcCode) missingUpc++;
                if (!p.salePrice && !p.price) missingPrice++;
                if (!p.imageUri) missingImage++;
            });

            const totalFieldChecks = products.length * 3;
            const passedFieldChecks = totalFieldChecks - (missingUpc + missingPrice + missingImage);
            const completenessScore = totalFieldChecks > 0 ? Math.round((passedFieldChecks / totalFieldChecks) * 100) : 100;

            // Calculate overall Schema Health Index (100 - penalties)
            let healthScore = 100;
            if (invalidCategoryProductsCount > 0) healthScore -= Math.min(25, invalidCategoryProductsCount * 5);
            if (danglingBusinessInvoicesCount > 0) healthScore -= Math.min(15, danglingBusinessInvoicesCount * 3);
            if (uncategorizedProductsCount > 0) healthScore -= Math.min(10, Math.ceil(uncategorizedProductsCount / 2));
            healthScore = Math.max(10, Math.min(100, healthScore));

            return {
                healthScore,
                completenessScore,
                issues,
                counts: {
                    uncategorizedProductsCount,
                    invalidCategoryProductsCount,
                    orphanInvoiceItemsCount,
                    danglingBusinessInvoicesCount,
                    dormantProductsCount: dormantProducts.length,
                    missingUpc,
                    missingPrice,
                    missingImage
                },
                dormantProducts: dormantProducts.slice(0, 50)
            };
        }
    };
};
