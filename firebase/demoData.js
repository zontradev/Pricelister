/**
 * PriceLister - Comprehensive Demo Dataset for UI Testing Sandbox
 * Provides complete, realistic seed data for Products, Categories,
 * Businesses, Clients, Customers, and Invoices.
 */

export const getInitialDemoData = () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const categories = [
        { id: 'cat_electronics', uniqueId: 'cat_electronics', name: 'Electronics', description: 'Consumer & Pro Tech' },
        { id: 'cat_audio', uniqueId: 'cat_audio', name: 'Audio & Sound', description: 'Headphones & Speakers' },
        { id: 'cat_computing', uniqueId: 'cat_computing', name: 'Computing & Office', description: 'Desks, Keyboards, PC' },
        { id: 'cat_accessories', uniqueId: 'cat_accessories', name: 'Accessories', description: 'Cables & Peripherals' }
    ];

    const products = [
        {
            id: 'prd_sony_xm5',
            uniqueId: 'PRD-1001',
            name: 'Sony WH-1000XM5 Wireless Headphones',
            category: 'cat_audio',
            price: 260,
            salePrice: 399,
            mrp: 429,
            quantity: 42,
            sizeWeight: '250g / Midnight Black',
            upcCode: '880923412091',
            imageUri: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
            note: 'Flagship industry-leading noise canceling headphones.',
            createdAt: new Date(now - 60 * DAY).toISOString()
        },
        {
            id: 'prd_macbook_m3',
            uniqueId: 'PRD-1002',
            name: 'Apple MacBook Pro 14" M3 Pro',
            category: 'cat_computing',
            price: 1450,
            salePrice: 1999,
            mrp: 2099,
            quantity: 18,
            sizeWeight: '1.6kg / Space Black / 18GB',
            upcCode: '194253718290',
            imageUri: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60',
            note: '14-core GPU, 512GB SSD, Liquid Retina XDR display.',
            createdAt: new Date(now - 75 * DAY).toISOString()
        },
        {
            id: 'prd_airpods_max',
            uniqueId: 'PRD-1003',
            name: 'Apple AirPods Max (Silver)',
            category: 'cat_audio',
            price: 380,
            salePrice: 549,
            mrp: 579,
            quantity: 25,
            sizeWeight: '384g / Silver Aluminum',
            upcCode: '194252085393',
            imageUri: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop&q=60',
            note: 'High-fidelity audio with active noise cancellation and spatial audio.',
            createdAt: new Date(now - 50 * DAY).toISOString()
        },
        {
            id: 'prd_mx_master_3s',
            uniqueId: 'PRD-1004',
            name: 'Logitech MX Master 3S Wireless Mouse',
            category: 'cat_computing',
            price: 65,
            salePrice: 99.99,
            mrp: 109,
            quantity: 64,
            sizeWeight: '141g / Graphite',
            upcCode: '097855174512',
            imageUri: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60',
            note: 'Quiet click, 8K DPI tracking on any surface.',
            createdAt: new Date(now - 90 * DAY).toISOString()
        },
        {
            id: 'prd_keychron_q1',
            uniqueId: 'PRD-1005',
            name: 'Keychron Q1 Pro Wireless Mechanical Keyboard',
            category: 'cat_computing',
            price: 130,
            salePrice: 199,
            mrp: 219,
            quantity: 30,
            sizeWeight: '1.7kg / CNC Aluminum / Red Switches',
            upcCode: '697412984102',
            imageUri: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
            note: 'Custom QMK/VIA programmable wireless mechanical keyboard.',
            createdAt: new Date(now - 45 * DAY).toISOString()
        },
        {
            id: 'prd_dell_4k',
            uniqueId: 'PRD-1006',
            name: 'Dell UltraSharp 27" 4K USB-C Monitor',
            category: 'cat_electronics',
            price: 410,
            salePrice: 589,
            mrp: 649,
            quantity: 12,
            sizeWeight: '6.5kg / IPS Black / 90W PD',
            upcCode: '884116417208',
            imageUri: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60',
            note: '98% DCI-P3 color gamut, hub monitor with Ethernet & 90W charging.',
            createdAt: new Date(now - 30 * DAY).toISOString()
        },
        {
            id: 'prd_samsung_990',
            uniqueId: 'PRD-1007',
            name: 'Samsung 990 PRO 2TB NVMe SSD',
            category: 'cat_accessories',
            price: 110,
            salePrice: 179.99,
            mrp: 199,
            quantity: 55,
            sizeWeight: 'PCIe 4.0 / 7450 MB/s',
            upcCode: '887276709840',
            imageUri: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&auto=format&fit=crop&q=60',
            note: 'Top tier gaming and productivity workstation storage.',
            createdAt: new Date(now - 40 * DAY).toISOString()
        }
    ];

    const businesses = [
        {
            id: 'bus_apex',
            uniqueId: 'BUS-001',
            name: 'Apex Global Technologies Ltd.',
            phone: '+1 (555) 234-5678',
            email: 'billing@apexglobal.tech',
            address: '100 Silicon Way, Suite 400, San Jose, CA',
            status: 'Active',
            tags: 'Headquarters, Enterprise, Supplier',
            notes: 'Net 30 payment terms.',
            imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&auto=format&fit=crop&q=60'
        },
        {
            id: 'bus_nova',
            uniqueId: 'BUS-002',
            name: 'Nova Retail Innovations',
            phone: '+1 (555) 876-5432',
            email: 'accounts@novaretail.io',
            address: '750 Broadway Ave, New York, NY',
            status: 'Active',
            tags: 'Wholesale Partner, Retail',
            notes: 'Preferred commercial client.',
            imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&auto=format&fit=crop&q=60'
        }
    ];

    const clients = [
        {
            id: 'cli_marcus',
            uniqueId: 'CLI-001',
            name: 'Marcus Vance Enterprise Systems',
            phone: '+1 (555) 345-9812',
            email: 'marcus@vancesystems.com',
            address: '420 Innovation Blvd, Austin, TX',
            status: 'Active',
            tags: 'Corporate, B2B VIP',
            notes: 'Key IT deployment partner.',
            imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=60'
        },
        {
            id: 'cli_elena',
            uniqueId: 'CLI-002',
            name: 'Elena Rostova Studio Media',
            phone: '+1 (555) 678-1234',
            email: 'elena@rostovamedia.com',
            address: '88 Creative Loft St, Seattle, WA',
            status: 'Active',
            tags: 'Design Agency, Priority',
            notes: 'Monthly audio and hardware orders.',
            imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60'
        }
    ];

    const customers = [
        {
            id: 'cust_alexander',
            uniqueId: 'CUST-001',
            name: 'Alexander Wright',
            phone: '+1 (555) 123-4567',
            email: 'alex.wright@gmail.com',
            address: '124 Maple Drive, Boston, MA',
            status: 'Active',
            tags: 'VIP, Power Buyer',
            notes: 'Prefers expedited delivery.',
            imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=60'
        },
        {
            id: 'cust_sophia',
            uniqueId: 'CUST-002',
            name: 'Sophia Martinez',
            phone: '+1 (555) 987-6543',
            email: 'sophia.m@outlook.com',
            address: '56 Ocean Vista Ave, Miami, FL',
            status: 'Active',
            tags: 'Retail, Frequent',
            notes: 'Enjoys audio gear and monitors.',
            imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60'
        },
        {
            id: 'cust_david',
            uniqueId: 'CUST-003',
            name: 'David Chen',
            phone: '+1 (555) 432-8765',
            email: 'david.chen@techcorp.org',
            address: '900 Fremont St, San Francisco, CA',
            status: 'Active',
            tags: 'Tech Lead',
            notes: 'Workstation bulk purchases.',
            imageUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=60'
        }
    ];

    // Invoices distributed over time to provide beautiful graphs & charts
    const customerInvoices = [
        {
            id: 'inv_c_1',
            uniqueId: 'INV-2026-001',
            invoiceNumber: 'INV-2026-001',
            title: 'Invoice',
            customerName: 'Alexander Wright',
            customerPhone: '+1 (555) 123-4567',
            customerEmail: 'alex.wright@gmail.com',
            customerAddress: '124 Maple Drive, Boston, MA',
            businessId: 'bus_apex',
            status: 'Paid',
            items: [
                { productId: 'prd_sony_xm5', name: 'Sony WH-1000XM5 Wireless Headphones', quantity: 2, price: 260, unitPrice: 399, total: 798 },
                { productId: 'prd_mx_master_3s', name: 'Logitech MX Master 3S Wireless Mouse', quantity: 1, price: 65, unitPrice: 99.99, total: 99.99 }
            ],
            subtotal: 897.99,
            discount: 5,
            additionalCut: 0,
            tax: 8.5,
            shipping: 15,
            total: 941.13,
            note: 'Thank you for your business! Delivered via Express.',
            timestamp: now - (2 * 3600 * 1000), // 2 hours ago (Today)
            createdAt: new Date(now - (2 * 3600 * 1000)).toISOString()
        },
        {
            id: 'inv_c_2',
            uniqueId: 'INV-2026-002',
            invoiceNumber: 'INV-2026-002',
            title: 'Invoice',
            customerName: 'Sophia Martinez',
            customerPhone: '+1 (555) 987-6543',
            customerEmail: 'sophia.m@outlook.com',
            customerAddress: '56 Ocean Vista Ave, Miami, FL',
            businessId: 'bus_apex',
            status: 'Paid',
            items: [
                { productId: 'prd_airpods_max', name: 'Apple AirPods Max (Silver)', quantity: 1, price: 380, unitPrice: 549, total: 549 },
                { productId: 'prd_samsung_990', name: 'Samsung 990 PRO 2TB NVMe SSD', quantity: 2, price: 110, unitPrice: 179.99, total: 359.98 }
            ],
            subtotal: 908.98,
            discount: 0,
            additionalCut: 0,
            tax: 7,
            shipping: 0,
            total: 972.61,
            note: 'Paid via Stripe Online Checkout.',
            timestamp: now - (2 * DAY), // 2 days ago (This Week)
            createdAt: new Date(now - (2 * DAY)).toISOString()
        },
        {
            id: 'inv_c_3',
            uniqueId: 'INV-2026-003',
            invoiceNumber: 'INV-2026-003',
            title: 'Invoice',
            customerName: 'David Chen',
            customerPhone: '+1 (555) 432-8765',
            customerEmail: 'david.chen@techcorp.org',
            customerAddress: '900 Fremont St, San Francisco, CA',
            businessId: 'bus_apex',
            status: 'Paid',
            items: [
                { productId: 'prd_macbook_m3', name: 'Apple MacBook Pro 14" M3 Pro', quantity: 1, price: 1450, unitPrice: 1999, total: 1999 },
                { productId: 'prd_dell_4k', name: 'Dell UltraSharp 27" 4K USB-C Monitor', quantity: 1, price: 410, unitPrice: 589, total: 589 }
            ],
            subtotal: 2588,
            discount: 10,
            additionalCut: 50,
            tax: 9,
            shipping: 25,
            total: 2511.08,
            note: 'Standard commercial invoice.',
            timestamp: now - (12 * DAY), // 12 days ago (This Month)
            createdAt: new Date(now - (12 * DAY)).toISOString()
        },
        {
            id: 'inv_c_4',
            uniqueId: 'INV-2026-004',
            invoiceNumber: 'INV-2026-004',
            title: 'Invoice',
            customerName: 'Alexander Wright',
            customerPhone: '+1 (555) 123-4567',
            customerEmail: 'alex.wright@gmail.com',
            customerAddress: '124 Maple Drive, Boston, MA',
            businessId: 'bus_apex',
            status: 'Unpaid',
            items: [
                { productId: 'prd_keychron_q1', name: 'Keychron Q1 Pro Wireless Mechanical Keyboard', quantity: 3, price: 130, unitPrice: 199, total: 597 }
            ],
            subtotal: 597,
            discount: 0,
            additionalCut: 0,
            tax: 8.5,
            shipping: 12,
            total: 659.75,
            note: 'Payment due within 14 calendar days.',
            timestamp: now - (25 * DAY), // Last Month
            createdAt: new Date(now - (25 * DAY)).toISOString()
        },
        {
            id: 'inv_c_5',
            uniqueId: 'INV-2026-005',
            invoiceNumber: 'INV-2026-005',
            title: 'Invoice',
            customerName: 'Sophia Martinez',
            customerPhone: '+1 (555) 987-6543',
            customerEmail: 'sophia.m@outlook.com',
            customerAddress: '56 Ocean Vista Ave, Miami, FL',
            businessId: 'bus_apex',
            status: 'Paid',
            items: [
                { productId: 'prd_sony_xm5', name: 'Sony WH-1000XM5 Wireless Headphones', quantity: 1, price: 260, unitPrice: 399, total: 399 }
            ],
            subtotal: 399,
            discount: 0,
            additionalCut: 0,
            tax: 7,
            shipping: 0,
            total: 426.93,
            note: 'Completed sale.',
            timestamp: now - (60 * DAY), // 2 Months ago
            createdAt: new Date(now - (60 * DAY)).toISOString()
        }
    ];

    const businessInvoices = [
        {
            id: 'inv_b_1',
            uniqueId: 'BINV-2026-101',
            busInvNumber: 'BINV-2026-101',
            title: 'Commercial Business Invoice',
            clientName: 'Marcus Vance Enterprise Systems',
            clientPhone: '+1 (555) 345-9812',
            clientEmail: 'marcus@vancesystems.com',
            clientAddress: '420 Innovation Blvd, Austin, TX',
            businessId: 'bus_apex',
            status: 'Paid',
            items: [
                { productId: 'prd_macbook_m3', name: 'Apple MacBook Pro 14" M3 Pro', quantity: 4, price: 1450, unitPrice: 1999, total: 7996 },
                { productId: 'prd_dell_4k', name: 'Dell UltraSharp 27" 4K USB-C Monitor', quantity: 4, price: 410, unitPrice: 589, total: 2356 }
            ],
            subtotal: 10352,
            discount: 8,
            additionalCut: 100,
            tax: 8.25,
            shipping: 60,
            total: 10255.85,
            note: 'B2B Procurement Contract Batch #A-49.',
            timestamp: now - (5 * DAY), // 5 days ago
            createdAt: new Date(now - (5 * DAY)).toISOString()
        },
        {
            id: 'inv_b_2',
            uniqueId: 'BINV-2026-102',
            busInvNumber: 'BINV-2026-102',
            title: 'Commercial Business Invoice',
            clientName: 'Elena Rostova Studio Media',
            clientPhone: '+1 (555) 678-1234',
            clientEmail: 'elena@rostovamedia.com',
            clientAddress: '88 Creative Loft St, Seattle, WA',
            businessId: 'bus_nova',
            status: 'Paid',
            items: [
                { productId: 'prd_airpods_max', name: 'Apple AirPods Max (Silver)', quantity: 3, price: 380, unitPrice: 549, total: 1647 },
                { productId: 'prd_keychron_q1', name: 'Keychron Q1 Pro Wireless Mechanical Keyboard', quantity: 2, price: 130, unitPrice: 199, total: 398 }
            ],
            subtotal: 2045,
            discount: 5,
            additionalCut: 0,
            tax: 9.5,
            shipping: 30,
            total: 2157.06,
            note: 'Studio sound room equipment replenishment.',
            timestamp: now - (18 * DAY), // 18 days ago
            createdAt: new Date(now - (18 * DAY)).toISOString()
        },
        {
            id: 'inv_b_3',
            uniqueId: 'BINV-2026-103',
            busInvNumber: 'BINV-2026-103',
            title: 'Commercial Business Invoice',
            clientName: 'Marcus Vance Enterprise Systems',
            clientPhone: '+1 (555) 345-9812',
            clientEmail: 'marcus@vancesystems.com',
            clientAddress: '420 Innovation Blvd, Austin, TX',
            businessId: 'bus_apex',
            status: 'Unpaid',
            items: [
                { productId: 'prd_samsung_990', name: 'Samsung 990 PRO 2TB NVMe SSD', quantity: 10, price: 110, unitPrice: 179.99, total: 1799.90 }
            ],
            subtotal: 1799.90,
            discount: 5,
            additionalCut: 0,
            tax: 8.25,
            shipping: 20,
            total: 1871.01,
            note: 'Bulk storage deployment - Net 30 terms.',
            timestamp: now - (90 * DAY), // 3 months ago
            createdAt: new Date(now - (90 * DAY)).toISOString()
        }
    ];

    // Map clients and customers with isClient flags
    const clientsWithFlag = clients.map(c => ({ ...c, isClient: true }));
    const customersWithFlag = customers.map(c => ({ ...c, isClient: false }));
    const clientProfiles = [...clientsWithFlag, ...customersWithFlag];

    // Enrich customer invoices with calculated fields and isBusinessInvoice: false
    const formattedCustomerInvoices = customerInvoices.map(inv => {
        let totalProfit = 0;
        const enrichedItems = (inv.items || []).map(item => {
            const qty = Number(item.quantity) || 1;
            const uPrice = Number(item.unitPrice || item.price || 0);
            const uCost = Number(item.price || item.unitCost || 0);
            const lineRev = Number(item.total) || (qty * uPrice);
            const lineCost = qty * uCost;
            const profit = lineRev - lineCost;
            totalProfit += profit;
            return {
                ...item,
                quantity: qty,
                unitPrice: uPrice,
                unitCost: uCost,
                totalPrice: lineRev,
                total: lineRev,
                itemProfit: profit
            };
        });

        return {
            ...inv,
            isBusinessInvoice: false,
            totalPrice: inv.total,
            grandTotal: inv.total,
            totalProfit: Math.round(totalProfit * 100) / 100,
            items: enrichedItems,
            status: inv.status || 'Paid'
        };
    });

    // Enrich business invoices with calculated fields and isBusinessInvoice: true
    const formattedBusinessInvoices = businessInvoices.map(inv => {
        let totalProfit = 0;
        const enrichedItems = (inv.items || []).map(item => {
            const qty = Number(item.quantity) || 1;
            const uPrice = Number(item.unitPrice || item.price || 0);
            const uCost = Number(item.price || item.unitCost || 0);
            const lineRev = Number(item.total) || (qty * uPrice);
            const lineCost = qty * uCost;
            const profit = lineRev - lineCost;
            totalProfit += profit;
            return {
                ...item,
                quantity: qty,
                unitPrice: uPrice,
                unitCost: uCost,
                totalPrice: lineRev,
                total: lineRev,
                itemProfit: profit
            };
        });

        return {
            ...inv,
            isBusinessInvoice: true,
            totalPrice: inv.total,
            grandTotal: inv.total,
            totalProfit: Math.round(totalProfit * 100) / 100,
            items: enrichedItems,
            status: inv.status || 'Paid'
        };
    });

    const members = [
        { email: 'developer@local.test', role: 'CREATOR_ADMIN', displayName: 'Demo Admin (Testing)', lastActive: now },
        { email: 'sarah.coadmin@pricelister.app', role: 'CO_ADMIN', displayName: 'Sarah Jenkins', lastActive: now - DAY },
        { email: 'john.worker@pricelister.app', role: 'WORKER', displayName: 'John Doe', lastActive: now - 3 * DAY }
    ];

    const settings = {
        isVendingEnabled: true,
        currency: '$',
        currencySymbol: '$',
        theme: 'crimson',
        companyName: 'PriceLister Demo Enterprise'
    };

    return {
        Categories: categories,
        Products: products,
        BusinessProfiles: businesses,
        ClientProfiles: clientProfiles,
        Invoices: formattedCustomerInvoices,
        BusinessInvoices: formattedBusinessInvoices,
        Businesses: businesses,
        Clients: clientsWithFlag,
        Customers: customersWithFlag,
        CustomerInvoices: formattedCustomerInvoices,
        Members: members,
        Settings: settings
    };
};

