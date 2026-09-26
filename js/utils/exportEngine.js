/**
 * PriceLister - Export Engine
 * Generates Excel Workbooks, Sample Import Templates, Printable PDFs,
 * and Full Workspace Backups with granular user data choices.
 */

/**
 * Downloads a Blob to user machine with given filename
 */
const triggerFileDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Resolves Category UniqueId or raw string into clean category name
 */
const resolveCategoryName = (categoryVal, categories = []) => {
    if (!categoryVal) return 'Uncategorized';
    const match = categories.find(c => c.uniqueId === categoryVal || c.id === categoryVal || c.name === categoryVal);
    return match ? match.name : categoryVal;
};

/**
 * 1. GENERATE & DOWNLOAD SAMPLE EXCEL TEMPLATE
 * Pre-formatted with valid columns, sample items, and locked guidance.
 */
export const downloadSampleExcelTemplate = () => {
    if (!window.XLSX) {
        alert("Excel engine (SheetJS) is loading. Please try again in a moment.");
        return;
    }

    const headers = [
        "Product Name*", 
        "Category*", 
        "Size/Weight", 
        "Quantity", 
        "Cost", 
        "Base Price", 
        "MRP", 
        "Sale Price*", 
        "UPC Code", 
        "Mfg Date", 
        "Exp Date", 
        "Description",
        "Var 1 Name",
        "Var 1 UPC",
        "Var 2 Name",
        "Var 2 UPC"
    ];

    const sampleData = [
        [
            "Fresh Apple Gala",
            "Fruit",
            "1 kg",
            50,
            80.00,
            95.00,
            120.00,
            110.00,
            "012345678901",
            "2026-09-01",
            "2026-10-01",
            "Crisp sweet red gala apples",
            "Large 1kg",
            "012345678911",
            "Medium 500g",
            "012345678912"
        ],
        [
            "Banana Cavendish",
            "Fruit",
            "1 Dozen",
            40,
            40.00,
            48.00,
            60.00,
            55.00,
            "012345678902",
            "",
            "",
            "Fresh yellow bananas",
            "",
            "",
            "",
            ""
        ],
        [
            "Orange Valencia",
            "fruit",
            "1 kg",
            30,
            60.00,
            72.00,
            90.00,
            85.00,
            "012345678903",
            "",
            "",
            "Juicy sweet oranges (Note: 'fruit' auto-combines into 'Fruit')",
            "",
            "",
            "",
            ""
        ],
        [
            "Whole Pasteurized Milk",
            "Dairy",
            "1 Liter",
            100,
            1.20,
            1.40,
            1.85,
            1.75,
            "012345678904",
            "2026-09-20",
            "2026-09-30",
            "Grade A whole milk",
            "1L Bottle",
            "012345678914",
            "500ml Pouch",
            "012345678915"
        ],
        [
            "Artisan Sourdough Bread",
            "Bakery",
            "500 g",
            25,
            2.50,
            3.00,
            4.50,
            4.00,
            "012345678905",
            "2026-09-26",
            "2026-09-29",
            "Naturally fermented sourdough loaf",
            "",
            "",
            "",
            ""
        ]
    ];

    const ws = window.XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    // Set column widths
    ws['!cols'] = [
        { wch: 26 }, // Name
        { wch: 16 }, // Category
        { wch: 14 }, // Size/Weight
        { wch: 10 }, // Quantity
        { wch: 10 }, // Cost
        { wch: 12 }, // Base Price
        { wch: 10 }, // MRP
        { wch: 12 }, // Sale Price
        { wch: 16 }, // UPC
        { wch: 12 }, // Mfg
        { wch: 12 }, // Exp
        { wch: 30 }, // Description
        { wch: 14 }, // Var 1 Name
        { wch: 16 }, // Var 1 UPC
        { wch: 14 }, // Var 2 Name
        { wch: 16 }  // Var 2 UPC
    ];

    // Instructions sheet
    const instructions = [
        ["PRICELISTER - EXCEL IMPORT INSTRUCTIONS & RULES"],
        [""],
        ["1. Row 1 contains the column headers. Do not change the first row order or names."],
        ["2. Required columns are: Product Name*, Category*, and Sale Price* (all marked with *)."],
        ["3. If a Category does not exist on your workspace, PriceLister will automatically create it with a unique color code."],
        ["4. PriceLister automatically combines category case variations (e.g. 'fruit', 'Fruit', 'FRUIT') into one unified category."],
        ["5. Any row missing a Name, Category, or positive Sale Price will be safely skipped."],
        ["6. Numeric prices can have decimals or integers (e.g. 110 or 110.50)."]
    ];
    const wsInstructions = window.XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 80 }];

    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Products");
    window.XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerFileDownload(blob, "PriceLister_Product_Template.xlsx");
};

/**
 * 2. EXPORT PRODUCTS TO EXCEL WORKBOOK
 * Parity with ExportUtils.kt & ExcelPreviewScreen.kt
 */
export const exportProductsExcel = (products = [], categories = [], userOptions = {}) => {
    if (!window.XLSX) {
        alert("Excel engine is not ready. Please try again.");
        return;
    }

    const options = {
        showCategory: true,
        showSizeWeight: true,
        showQuantity: true,
        showBasePrice: true, // Cost
        showRealBasePrice: true, // Wholesale / Base Price
        showMrpPrice: true,
        showMfpExp: true,
        showSalePrice: true,
        showUpcCode: true,
        showDescription: true,
        showProductID: false,
        showVariations: true,
        ...userOptions
    };

    // Calculate max variations
    let maxVariations = 0;
    if (options.showVariations) {
        maxVariations = products.reduce((max, p) => {
            const cnt = (p.variations || []).filter(v => (v.sizeFlavor || '').trim() || (v.upcCode || '').trim()).length;
            return Math.max(max, cnt);
        }, 0);
        maxVariations = Math.min(maxVariations, 20); // Cap securely at 20
    }

    // Build Headers
    const headers = ["Product Name"];
    if (options.showCategory) headers.push("Category");
    if (options.showSizeWeight) headers.push("Size/Weight");
    if (options.showQuantity) headers.push("Quantity");
    if (options.showBasePrice) headers.push("Cost");
    if (options.showRealBasePrice) headers.push("Base Price");
    if (options.showMrpPrice) headers.push("MRP");
    if (options.showMfpExp) headers.push("Mfg / Exp");
    if (options.showSalePrice !== false) headers.push("Sale Price");
    if (options.showUpcCode) headers.push("UPC Code");
    if (options.showDescription) headers.push("Description");
    if (options.showProductID) headers.push("Product ID");

    if (options.showVariations) {
        for (let i = 1; i <= maxVariations; i++) {
            headers.push(`Var ${i} Name`);
            headers.push(`Var ${i} UPC`);
        }
    }

    // Build Data Rows
    const rows = products.map(product => {
        const row = [product.name || ''];

        if (options.showCategory) {
            row.push(resolveCategoryName(product.category, categories));
        }
        if (options.showSizeWeight) {
            row.push(product.sizeWeight || '');
        }
        if (options.showQuantity) {
            row.push(Number(product.quantity || 0));
        }
        if (options.showBasePrice) {
            row.push(Number(product.price || 0));
        }
        if (options.showRealBasePrice) {
            row.push(Number(product.basePrice || 0));
        }
        if (options.showMrpPrice) {
            row.push(Number(product.mrp || 0));
        }
        if (options.showMfpExp) {
            const mfg = product.mfgDate ? `M:${product.mfgDate}` : '';
            const exp = product.expDate ? `E:${product.expDate}` : '';
            row.push([mfg, exp].filter(Boolean).join(' | '));
        }
        if (options.showSalePrice !== false) {
            row.push(Number(product.salePrice || 0));
        }
        if (options.showUpcCode) {
            row.push(product.upcCode || '');
        }
        if (options.showDescription) {
            row.push(product.note || '');
        }
        if (options.showProductID) {
            row.push(product.uniqueId || product.id || '');
        }

        if (options.showVariations) {
            const vars = (product.variations || []).filter(v => (v.sizeFlavor || '').trim() || (v.upcCode || '').trim());
            for (let i = 0; i < maxVariations; i++) {
                if (vars[i]) {
                    row.push(vars[i].sizeFlavor || '');
                    row.push(vars[i].upcCode || '');
                } else {
                    row.push('');
                    row.push('');
                }
            }
        }

        return row;
    });

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Auto-compute column widths
    const colWidths = headers.map((h, i) => {
        let maxLen = h.length;
        rows.forEach(r => {
            const cell = String(r[i] || '');
            if (cell.length > maxLen) maxLen = Math.min(cell.length, 45);
        });
        return { wch: Math.max(maxLen + 3, 10) };
    });
    ws['!cols'] = colWidths;

    window.XLSX.utils.book_append_sheet(wb, ws, "Products");

    const dateStr = new Date().toISOString().split('T')[0];
    const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerFileDownload(blob, `PriceLister_Products_${dateStr}.xlsx`);
};

/**
 * 3. EXPORT PRODUCTS TO PRINTABLE PDF
 * Generates clean, high-resolution printable PDF catalog with headers and summaries
 */
export const exportProductsPdf = (products = [], categories = [], userOptions = {}, workspaceInfo = {}) => {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF generator engine is loading. Please try again.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });

    const options = {
        showCategory: true,
        showSizeWeight: true,
        showQuantity: true,
        showCost: false, // Hidden by default for public price lists
        showSalePrice: true,
        showUpcCode: false,
        title: workspaceInfo.name || 'PriceLister Catalog',
        subtitle: 'Product Price List & Inventory',
        ...userOptions
    };

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    // 1. Header Banner
    doc.setFillColor(16, 185, 129); // Emerald primary
    doc.rect(margin, margin, pageWidth - (margin * 2), 55, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(options.title, margin + 18, margin + 28);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${options.subtitle} • Generated on ${new Date().toLocaleDateString()}`, margin + 18, margin + 44);

    // 2. Build Columns for AutoTable
    const tableColumns = [
        { header: '#', dataKey: 'index' },
        { header: 'Product Name', dataKey: 'name' }
    ];

    if (options.showCategory) tableColumns.push({ header: 'Category', dataKey: 'category' });
    if (options.showSizeWeight) tableColumns.push({ header: 'Size/Weight', dataKey: 'size' });
    if (options.showQuantity) tableColumns.push({ header: 'Stock', dataKey: 'quantity' });
    if (options.showCost) tableColumns.push({ header: 'Cost', dataKey: 'cost' });
    if (options.showSalePrice !== false) tableColumns.push({ header: 'Price', dataKey: 'salePrice' });
    if (options.showUpcCode) tableColumns.push({ header: 'UPC Code', dataKey: 'upc' });

    const tableRows = products.map((p, idx) => ({
        index: idx + 1,
        name: p.name || 'Unnamed Product',
        category: resolveCategoryName(p.category, categories),
        size: p.sizeWeight || '—',
        quantity: p.quantity ?? '0',
        cost: typeof p.price === 'number' ? `$${p.price.toFixed(2)}` : '—',
        salePrice: typeof p.salePrice === 'number' ? `$${p.salePrice.toFixed(2)}` : '—',
        upc: p.upcCode || '—'
    }));

    // 3. Render Table
    doc.autoTable({
        columns: tableColumns,
        body: tableRows,
        startY: margin + 70,
        margin: { left: margin, right: margin },
        styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 6,
            textColor: [30, 41, 59]
        },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9.5
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        columnStyles: {
            index: { cellWidth: 28, halign: 'center' },
            quantity: { halign: 'center' },
            cost: { halign: 'right' },
            salePrice: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }
        },
        didDrawPage: (data) => {
            // Footer Page Number
            const str = `Page ${doc.internal.getNumberOfPages()} • Total Items: ${products.length}`;
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(str, pageWidth / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
        }
    });

    const dateStr = new Date().toISOString().split('T')[0];
    doc.save(`PriceLister_Catalog_${dateStr}.pdf`);
};

/**
 * 4. EXPORT INVOICES TO EXCEL
 */
export const exportInvoicesExcel = (invoices = [], userOptions = {}) => {
    if (!window.XLSX) return;

    const headers = [
        "Invoice #",
        "Type",
        "Customer / Business",
        "Phone / Email",
        "Date",
        "Status",
        "Items Count",
        "Subtotal",
        "Discount",
        "Tax",
        "Total Price"
    ];

    const rows = invoices.map(inv => [
        inv.invoiceNumber || inv.uniqueId || '',
        inv.isBusinessInvoice ? 'B2B Business' : 'Retail Customer',
        inv.customerName || inv.businessName || 'Cash Customer',
        inv.customerPhone || inv.businessEmail || '',
        inv.date ? new Date(inv.date).toLocaleDateString() : '',
        inv.status || 'Paid',
        (inv.items || []).length,
        Number(inv.subtotal || inv.totalPrice || 0),
        Number(inv.discount || 0),
        Number(inv.tax || 0),
        Number(inv.totalPrice || 0)
    ]);

    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));

    window.XLSX.utils.book_append_sheet(wb, ws, "Invoices");

    const dateStr = new Date().toISOString().split('T')[0];
    const excelBuffer = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    triggerFileDownload(blob, `PriceLister_Invoices_${dateStr}.xlsx`);
};

/**
 * 5. EXPORT FULL WORKSPACE BACKUP JSON
 */
export const exportWorkspaceBackupJson = ({ workspaceData, products, categories, invoices, businesses, customers }) => {
    const backupPackage = {
        version: "2.0",
        exportTimestamp: Date.now(),
        exportDate: new Date().toISOString(),
        workspace: workspaceData || {},
        counts: {
            products: (products || []).length,
            categories: (categories || []).length,
            invoices: (invoices || []).length,
            businesses: (businesses || []).length,
            customers: (customers || []).length
        },
        data: {
            products: products || [],
            categories: categories || [],
            invoices: invoices || [],
            businesses: businesses || [],
            customers: customers || []
        }
    };

    const jsonStr = JSON.stringify(backupPackage, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const dateStr = new Date().toISOString().split('T')[0];
    triggerFileDownload(blob, `PriceLister_WorkspaceBackup_${dateStr}.json`);
};
