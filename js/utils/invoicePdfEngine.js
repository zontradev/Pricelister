/**
 * PriceLister - High-Performance Invoice PDF Generator Engine
 * Generates vector-sharp, customizable PDF invoices with multiple template designs,
 * app-themed red styling (#e11d48), and flexible branding options (PriceLister, Workspace, Custom, or White-label).
 */

import { formatCurrency, getAppCurrencySymbol } from '../utilities.js';

/**
 * Color Palettes (RGB for jsPDF)
 */
const COLORS = {
    primaryRed: [225, 29, 72],       // #e11d48
    primaryDarkRed: [190, 18, 60],   // #be123c
    primaryLightRed: [255, 241, 242], // rgba(225,29,72,0.06)
    slateDark: [15, 23, 42],         // #0f172a
    slateGray: [71, 85, 105],        // #475569
    slateMuted: [148, 163, 184],     // #94a3b8
    borderLight: [226, 232, 240],    // #e2e8f0
    surfaceLight: [248, 250, 252],   // #f8fafc
    successGreen: [16, 185, 129],    // #10b981
    warningAmber: [245, 158, 11]     // #f59e0b
};

/**
 * Clean Date Formatter
 */
const formatPdfDate = (timestamp) => {
    if (!timestamp) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    let d;
    if (typeof timestamp === 'number') d = new Date(timestamp);
    else if (timestamp && typeof timestamp.toDate === 'function') d = timestamp.toDate();
    else if (typeof timestamp === 'string') d = new Date(timestamp);
    else d = new Date();
    
    return isNaN(d.getTime()) 
        ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * Format Currency for PDF
 */
const formatPdfCurrency = (amount, customSymbol = null) => {
    const sym = customSymbol || getAppCurrencySymbol();
    const num = Number(amount) || 0;
    const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const separator = /^[A-Za-z]+$/.test(sym) ? ' ' : '';
    return `${sym}${separator}${formatted}`;
};

/**
 * Generate Invoice PDF Document
 * @param {Object} invoice - The invoice data object
 * @param {Object} options - Customization options
 * @returns {Object} { doc, blob, dataUri, filename }
 */
export const generateInvoicePdf = async (invoice, options = {}) => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        throw new Error("jsPDF library is not loaded. Please verify your connection.");
    }

    const template = options.template || 'MODERN_RED'; // 'MODERN_RED', 'MINIMAL_LUXURY', 'EXECUTIVE_RECEIPT', 'DARK_HEADER'
    const brandingMode = options.brandingMode || 'WORKSPACE'; // 'WORKSPACE', 'PRICELISTER', 'CUSTOM', 'NONE'
    const customBranding = options.customBranding || {};
    const currencySym = options.currencySymbol || invoice.currency || getAppCurrencySymbol();

    // Create jsPDF Instance (Portrait, mm, A4)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - (margin * 2);

    // Resolve Brand Information
    let brandTitle = 'PriceLister';
    let brandSubtitle = 'Business & Sales Invoice';
    let brandPhone = '';
    let brandEmail = '';
    let brandAddress = '';
    let showLogo = true;

    if (brandingMode === 'WORKSPACE') {
        brandTitle = invoice.businessName || window.__activeWorkspace?.name || 'Your Business';
        brandSubtitle = 'Sales Invoice';
        brandPhone = invoice.businessPhone || window.__activeWorkspace?.phone || '';
        brandEmail = invoice.businessEmail || window.__activeWorkspace?.email || '';
        brandAddress = invoice.businessAddress || window.__activeWorkspace?.address || '';
        showLogo = true;
    } else if (brandingMode === 'PRICELISTER') {
        brandTitle = 'PriceLister';
        brandSubtitle = 'Official Sales & Commercial Invoice';
        brandPhone = invoice.businessPhone || '';
        brandEmail = invoice.businessEmail || '';
        brandAddress = invoice.businessAddress || '';
        showLogo = true;
    } else if (brandingMode === 'CUSTOM') {
        brandTitle = customBranding.title || invoice.businessName || 'Your Business';
        brandSubtitle = customBranding.subtitle || 'Invoice';
        brandPhone = customBranding.phone || invoice.businessPhone || '';
        brandEmail = customBranding.email || invoice.businessEmail || '';
        brandAddress = customBranding.address || invoice.businessAddress || '';
        showLogo = customBranding.showLogo !== false;
    } else if (brandingMode === 'NONE') {
        brandTitle = invoice.businessName || 'Invoice';
        brandSubtitle = '';
        brandPhone = invoice.businessPhone || '';
        brandEmail = invoice.businessEmail || '';
        brandAddress = invoice.businessAddress || '';
        showLogo = false;
    }

    // Resolve Billed-to Info
    const isBusiness = Boolean(invoice.isBusiness || invoice.busInvNumber || invoice.clientName || invoice.clientId);
    const clientName = isBusiness 
        ? (invoice.clientName || invoice.customerName || 'B2B Client')
        : (invoice.customerName || 'Walk-in Customer');
    const clientPhone = invoice.clientPhone || invoice.customerNumber || '';
    const clientEmail = invoice.clientEmail || '';
    const clientAddress = invoice.clientAddress || '';

    const invNumber = invoice.busInvNumber || invoice.invoiceNumber || invoice.id || 'INV-001';
    const invDate = formatPdfDate(invoice.timestamp || invoice.createdAt);
    const invStatus = (invoice.status || 'PAID').toUpperCase();

    // Line Items parsing
    const rawItems = Array.isArray(invoice.items) ? invoice.items : [];
    const tableRows = rawItems.map((item, idx) => {
        const name = item.name || item.productName || `Item #${idx + 1}`;
        const size = item.size ? ` (${item.size})` : '';
        const qty = item.quantity || item.qty || 1;
        const price = Number(item.price || item.sellingPrice || item.unitPrice || 0);
        const total = Number(item.total || (qty * price) || 0);

        return [
            String(idx + 1),
            `${name}${size}`,
            String(qty),
            formatPdfCurrency(price, currencySym),
            formatPdfCurrency(total, currencySym)
        ];
    });

    let currentY = margin;

    // =========================================================================
    // TEMPLATE 1: MODERN CORPORATE RED (#e11d48 Accent)
    // =========================================================================
    if (template === 'MODERN_RED') {
        // Top Red Accent Line
        doc.setFillColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.rect(0, 0, pageWidth, 5, 'F');

        currentY = 16;

        // Header Left: Brand Info
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(brandTitle, margin, currentY);

        if (brandSubtitle) {
            currentY += 5.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text(brandSubtitle.toUpperCase(), margin, currentY);
        }

        if (brandAddress || brandPhone || brandEmail) {
            currentY += 4.5;
            doc.setFontSize(8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            const contactText = [brandAddress, brandPhone ? `Phone: ${brandPhone}` : '', brandEmail ? `Email: ${brandEmail}` : ''].filter(Boolean).join(' • ');
            doc.text(contactText, margin, currentY);
        }

        // Header Right: Invoice Title & Number
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text('INVOICE', pageWidth - margin, 16, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(`#${invNumber}`, pageWidth - margin, 22, { align: 'right' });

        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        doc.text(`Date: ${invDate}`, pageWidth - margin, 27, { align: 'right' });

        // Status Badge Pill on Right
        const isPaid = invStatus === 'PAID';
        const badgeColor = isPaid ? COLORS.successGreen : COLORS.primaryRed;
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(pageWidth - margin - 24, 30, 24, 6, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(invStatus, pageWidth - margin - 12, 34.2, { align: 'center' });

        // Divider
        currentY = Math.max(currentY + 8, 42);
        doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);

        // Client & Billing Info Block
        currentY += 6;
        doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
        doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
        doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
        doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'S');

        // Billed To Column
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text('BILLED TO', margin + 6, currentY + 5.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(clientName, margin + 6, currentY + 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        const clientMeta = [clientPhone ? `Phone: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).join(' • ');
        doc.text(clientMeta || 'Customer Direct Sale', margin + 6, currentY + 16.5);

        // Payment / Ref Column (Right)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text('PAYMENT DETAILS', pageWidth - margin - 60, currentY + 5.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(`Status: ${invStatus}`, pageWidth - margin - 60, currentY + 10.5);
        doc.text(`Type: ${isBusiness ? 'B2B Wholesale' : 'Customer POS'}`, pageWidth - margin - 60, currentY + 15.5);

        currentY += 28;

        // AutoTable for Line Items
        doc.autoTable({
            startY: currentY,
            head: [['#', 'Item & Description', 'Qty', 'Unit Price', 'Total']],
            body: tableRows,
            margin: { left: margin, right: margin },
            theme: 'plain',
            headStyles: {
                fillColor: COLORS.primaryRed,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                cellPadding: 3.5
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: COLORS.slateDark,
                cellPadding: 3.5
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 32, halign: 'right' },
                4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            },
            alternateRowStyles: {
                fillColor: COLORS.surfaceLight
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // =========================================================================
    // TEMPLATE 2: MINIMALIST CLEAN LUXURY (Fine borders, elegant typography)
    // =========================================================================
    else if (template === 'MINIMAL_LUXURY') {
        currentY = 18;

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(brandTitle, margin, currentY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text(`INVOICE #${invNumber}`, pageWidth - margin, currentY, { align: 'right' });

        currentY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        doc.text([brandAddress, brandPhone].filter(Boolean).join(' • '), margin, currentY);
        doc.text(`Issued: ${invDate}`, pageWidth - margin, currentY, { align: 'right' });

        currentY += 8;
        doc.setDrawColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.setLineWidth(0.8);
        doc.line(margin, currentY, pageWidth - margin, currentY);

        // Billed to
        currentY += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text('CLIENT / RECIPIENT', margin, currentY);

        currentY += 4.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(clientName, margin, currentY);

        if (clientPhone || clientEmail || clientAddress) {
            currentY += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text([clientPhone, clientEmail, clientAddress].filter(Boolean).join(' | '), margin, currentY);
        }

        currentY += 8;

        // AutoTable
        doc.autoTable({
            startY: currentY,
            head: [['ITEM', 'QTY', 'UNIT PRICE', 'AMOUNT']],
            body: tableRows.map(r => [r[1], r[2], r[3], r[4]]),
            margin: { left: margin, right: margin },
            theme: 'plain',
            headStyles: {
                fillColor: COLORS.surfaceLight,
                textColor: COLORS.slateDark,
                fontStyle: 'bold',
                fontSize: 8.5,
                cellPadding: 3,
                lineWidth: { bottom: 0.5 },
                lineColor: COLORS.borderLight
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: COLORS.slateDark,
                cellPadding: 3,
                lineWidth: { bottom: 0.2 },
                lineColor: COLORS.borderLight
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 35, halign: 'right' },
                3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // =========================================================================
    // TEMPLATE 3: EXECUTIVE RECEIPT / THERMAL STYLE
    // =========================================================================
    else if (template === 'EXECUTIVE_RECEIPT') {
        currentY = 16;

        // Centered Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(brandTitle.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

        currentY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        if (brandAddress) {
            doc.text(brandAddress, pageWidth / 2, currentY, { align: 'center' });
            currentY += 4;
        }
        if (brandPhone) {
            doc.text(`Phone: ${brandPhone}`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 4;
        }

        // Dashed line
        currentY += 2;
        doc.setDrawColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        doc.setLineDashPattern([], 0); // reset

        currentY += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`RECEIPT: #${invNumber}`, margin, currentY);
        doc.text(`DATE: ${invDate}`, pageWidth - margin, currentY, { align: 'right' });

        currentY += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`CUSTOMER: ${clientName}`, margin, currentY);
        doc.text(`STATUS: ${invStatus}`, pageWidth - margin, currentY, { align: 'right' });

        currentY += 6;

        // AutoTable
        doc.autoTable({
            startY: currentY,
            head: [['ITEM', 'QTY', 'PRICE', 'TOTAL']],
            body: tableRows.map(r => [r[1], r[2], r[3], r[4]]),
            margin: { left: margin, right: margin },
            theme: 'plain',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: COLORS.slateDark,
                fontStyle: 'bold',
                fontSize: 8.5,
                cellPadding: 2.5
            },
            bodyStyles: {
                fontSize: 8,
                textColor: COLORS.slateDark,
                cellPadding: 2.5
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 16, halign: 'center' },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 32, halign: 'right' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // =========================================================================
    // TEMPLATE 4: DARK HEADER ELEGANCE (Slate Navy Header with Crimson Accent)
    // =========================================================================
    else {
        // Dark Solid Header
        doc.setFillColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.rect(0, 0, pageWidth, 38, 'F');

        doc.setFillColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.rect(0, 36, pageWidth, 2, 'F');

        currentY = 16;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(brandTitle, margin, currentY);

        currentY += 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text([brandAddress, brandPhone].filter(Boolean).join(' • '), margin, currentY);

        // Header Right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text('INVOICE', pageWidth - margin, 16, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text(`#${invNumber} • ${invDate}`, pageWidth - margin, 22, { align: 'right' });

        currentY = 48;

        // Billed to
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text('BILLED TO:', margin, currentY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(clientName, margin + 22, currentY);

        currentY += 8;

        // AutoTable
        doc.autoTable({
            startY: currentY,
            head: [['#', 'PRODUCT DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT']],
            body: tableRows,
            margin: { left: margin, right: margin },
            theme: 'striped',
            headStyles: {
                fillColor: COLORS.slateDark,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
                cellPadding: 3.5
            },
            bodyStyles: {
                fontSize: 8.5,
                textColor: COLORS.slateDark,
                cellPadding: 3
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 32, halign: 'right' },
                4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // =========================================================================
    // TOTALS CALCULATION BOX (Bottom Right)
    // =========================================================================
    const totalsBoxWidth = 82;
    const totalsBoxX = pageWidth - margin - totalsBoxWidth;

    // Check if totals box needs a new page
    if (currentY + 50 > pageHeight - margin) {
        doc.addPage();
        currentY = margin + 10;
    }

    const subtotal = Number(invoice.subtotal || invoice.totalPrice || 0);
    const discountPct = Number(invoice.discountPercent || 0);
    const taxPct = Number(invoice.taxPercent || 0);
    const shipping = Number(invoice.shippingCost || 0);
    const grandTotal = Number(invoice.totalPrice || invoice.grandTotal || subtotal);

    // Totals Background Box
    doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
    doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, 38, 2, 2, 'F');
    doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
    doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, 38, 2, 2, 'S');

    let totY = currentY + 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);

    // Subtotal
    doc.text('Subtotal:', totalsBoxX + 6, totY);
    doc.text(formatPdfCurrency(subtotal, currencySym), totalsBoxX + totalsBoxWidth - 6, totY, { align: 'right' });

    // Discount
    if (discountPct > 0) {
        totY += 5;
        doc.text(`Discount (${discountPct}%):`, totalsBoxX + 6, totY);
        const discAmt = (subtotal * discountPct) / 100;
        doc.text(`-${formatPdfCurrency(discAmt, currencySym)}`, totalsBoxX + totalsBoxWidth - 6, totY, { align: 'right' });
    }

    // Tax
    if (taxPct > 0) {
        totY += 5;
        doc.text(`Tax (${taxPct}%):`, totalsBoxX + 6, totY);
        const taxAmt = (subtotal * taxPct) / 100;
        doc.text(`+${formatPdfCurrency(taxAmt, currencySym)}`, totalsBoxX + totalsBoxWidth - 6, totY, { align: 'right' });
    }

    // Shipping
    if (shipping > 0) {
        totY += 5;
        doc.text('Shipping:', totalsBoxX + 6, totY);
        doc.text(`+${formatPdfCurrency(shipping, currencySym)}`, totalsBoxX + totalsBoxWidth - 6, totY, { align: 'right' });
    }

    // Grand Total Divider & Line
    totY += 6;
    doc.setDrawColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
    doc.setLineWidth(0.5);
    doc.line(totalsBoxX + 4, totY - 1.5, totalsBoxX + totalsBoxWidth - 4, totY - 1.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
    doc.text('Grand Total:', totalsBoxX + 6, totY + 3);
    doc.text(formatPdfCurrency(grandTotal, currencySym), totalsBoxX + totalsBoxWidth - 6, totY + 3, { align: 'right' });

    // Notes / Terms on Left Side of Totals
    const notesX = margin;
    const notesWidth = totalsBoxX - margin - 8;
    let notesY = currentY + 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
    doc.text('NOTES & PAYMENT INSTRUCTIONS', notesX, notesY);

    notesY += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
    const notesText = invoice.notes || customBranding.notes || 'Thank you for your business! Payment is due according to agreed billing terms. For questions regarding this invoice, please reach out with the reference number above.';
    const splitNotes = doc.splitTextToSize(notesText, notesWidth);
    doc.text(splitNotes, notesX, notesY);

    // =========================================================================
    // FOOTER
    // =========================================================================
    const footerY = pageHeight - 8;
    doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
    
    if (brandingMode !== 'NONE') {
        doc.text(`Generated by PriceLister • Page ${doc.internal.getNumberOfPages()}`, margin, footerY);
    } else {
        doc.text(`Page ${doc.internal.getNumberOfPages()}`, margin, footerY);
    }
    doc.text(formatPdfDate(Date.now()), pageWidth - margin, footerY, { align: 'right' });

    // Generate output formats
    const filename = `Invoice_${invNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${invDate.replace(/\s+/g, '_')}.pdf`;
    const blob = doc.output('blob');
    const dataUri = doc.output('datauristring');

    return {
        doc,
        blob,
        dataUri,
        filename
    };
};

/**
 * Trigger Instant Download of PDF Invoice
 */
export const downloadInvoicePdf = async (invoice, options = {}) => {
    const { blob, filename } = await generateInvoicePdf(invoice, options);
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
 * Open PDF Print Dialog
 */
export const printInvoicePdf = async (invoice, options = {}) => {
    const { blob } = await generateInvoicePdf(invoice, options);
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
        printWindow.focus();
    }
};
