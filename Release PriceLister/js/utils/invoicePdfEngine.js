/**
 * PriceLister - High-Performance Vector Invoice PDF Generator Engine
 * Complete Vector PDF Generator matching Canvas Layouts:
 * - 4 Layout Size Presets (POS Receipt 80mm, Customer A4, Business A4, Corporate Enterprise, US Letter, Custom)
 * - Dynamic Canvas Border Rendering (Color, Width, Radius, Style, On/Off)
 * - Real-Time Color Mapping (Headers, Totals, Badges, Dividers match canvas border/accent color)
 * - Dual "BILLED FROM" (Supplier) and "BILLED TO" (Client) Cards
 * - Customizable Corporate Stamp / Seal with manual text and custom color
 * - Official Digital Signature (Drive image upload / Draw canvas / Cursive script)
 * - Floating Draggable Photo & Text Elements mapped from canvas coordinates to PDF mm
 * - Multi-page pagination and notes handling (hidden if empty)
 * - Clean document footer (Removed "Powered by Invoice maker")
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
 * Convert Hex Color to [R, G, B] Array
 */
const hexToRgb = (hex) => {
    if (!hex || typeof hex !== 'string') return null;
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
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
 * In-memory Image Compatibility Cache for Ultra-Fast Lightweight Vector PDF Generation
 */
const imageCompatibilityCache = new Map();

/**
 * Ensure image data is loaded, dimensions are known, and format is supported by jsPDF
 */
const ensureCompatibleImageData = async (src) => {
    if (!src || typeof src !== 'string' || typeof Image === 'undefined') return null;
    if (imageCompatibilityCache.has(src)) {
        return imageCompatibilityCache.get(src);
    }
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 200;
                canvas.height = img.naturalHeight || img.height || 200;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const result = {
                    dataUrl: canvas.toDataURL('image/png'),
                    format: 'PNG',
                    width: canvas.width,
                    height: canvas.height
                };
                imageCompatibilityCache.set(src, result);
                resolve(result);
            } catch (e) {
                const isPng = src.includes('image/png');
                const result = {
                    dataUrl: src,
                    format: isPng ? 'PNG' : 'JPEG',
                    width: img.naturalWidth || 200,
                    height: img.naturalHeight || 200
                };
                imageCompatibilityCache.set(src, result);
                resolve(result);
            }
        };
        img.onerror = () => {
            console.warn("Failed to load image for PDF:", src ? src.substring(0, 50) : '');
            resolve(null);
        };
        img.src = src;
    });
};

/**
 * Standard Design Spacing Tokens (mm for PDF, px for Web Canvas)
 */
export const SPACING_TOKENS_MM = {
    XS: 4,
    SM: 8,
    MD: 12,
    LG: 16,
    XL: 24,
    XXL: 32
};

export const SPACING_TOKENS_PX = {
    XS: 15,
    SM: 30,
    MD: 45,
    LG: 60,
    XL: 90,
    XXL: 120
};

/**
 * Authoritative Canonical Invoice Layout Specifications
 * Defines geometry, physical dimensions, orientation, safe area boundaries, and canvas pixel coordinate space
 */
export const INVOICE_LAYOUT_SPECS = {
    POS_RECEIPT: {
        preset: 'POS_RECEIPT',
        combinationId: 'COMBINATION_C',
        name: 'POS Bill Receipt Long (Combination C)',
        widthMm: 80,
        heightMm: 200, // Dynamic continuous roll
        canvasWidthPx: 340,
        canvasMinHeightPx: 750,
        orientation: 'portrait',
        marginsMm: { top: 4, right: 4, bottom: 4, left: 4 },
        hasDualCards: false,
        supportsContinuation: false
    },
    CUSTOMER_A4: {
        preset: 'CUSTOMER_A4',
        combinationId: 'COMBINATION_B',
        name: 'Compact Customer Invoice (Combination B)',
        widthMm: 210,
        heightMm: 297,
        canvasWidthPx: 680,
        canvasMinHeightPx: 960,
        orientation: 'portrait',
        marginsMm: { top: 12, right: 12, bottom: 12, left: 12 },
        hasDualCards: false,
        supportsContinuation: true
    },
    BUSINESS_A4: {
        preset: 'BUSINESS_A4',
        combinationId: 'COMBINATION_D',
        name: 'A4 International Standard (Combination D / A)',
        widthMm: 210,
        heightMm: 297,
        canvasWidthPx: 740,
        canvasMinHeightPx: 1040,
        orientation: 'portrait',
        marginsMm: { top: 14, right: 14, bottom: 14, left: 14 },
        hasDualCards: true,
        supportsContinuation: true
    },
    CORPORATE_ENTERPRISE: {
        preset: 'CORPORATE_ENTERPRISE',
        combinationId: 'COMBINATION_F',
        name: 'Corporate Large Executive (Combination F)',
        widthMm: 210,
        heightMm: 297,
        canvasWidthPx: 820,
        canvasMinHeightPx: 1160,
        orientation: 'portrait',
        marginsMm: { top: 14, right: 14, bottom: 14, left: 14 },
        hasDualCards: true,
        supportsContinuation: true
    },
    US_LETTER: {
        preset: 'US_LETTER',
        combinationId: 'COMBINATION_E',
        name: 'US Letter Size (Combination E)',
        widthMm: 215.9,
        heightMm: 279.4,
        canvasWidthPx: 720,
        canvasMinHeightPx: 930,
        orientation: 'portrait',
        marginsMm: { top: 13, right: 13, bottom: 13, left: 13 },
        hasDualCards: true,
        supportsContinuation: true
    },
    CUSTOM: {
        preset: 'CUSTOM',
        combinationId: 'COMBINATION_G',
        name: 'Custom Page Size (Combination G)',
        widthMm: 210,
        heightMm: 297,
        canvasWidthPx: 800,
        canvasMinHeightPx: 1000,
        orientation: 'portrait',
        marginsMm: { top: 12, right: 12, bottom: 12, left: 12 },
        hasDualCards: true,
        supportsContinuation: true
    }
};

// Explicit Aliases for Combinations A through G
INVOICE_LAYOUT_SPECS.COMBINATION_A = { ...INVOICE_LAYOUT_SPECS.BUSINESS_A4, combinationId: 'COMBINATION_A', name: 'Standard Corporate Invoice (Combination A)' };
INVOICE_LAYOUT_SPECS.COMBINATION_B = { ...INVOICE_LAYOUT_SPECS.CUSTOMER_A4, combinationId: 'COMBINATION_B' };
INVOICE_LAYOUT_SPECS.COMBINATION_C = { ...INVOICE_LAYOUT_SPECS.POS_RECEIPT, combinationId: 'COMBINATION_C' };
INVOICE_LAYOUT_SPECS.COMBINATION_D = { ...INVOICE_LAYOUT_SPECS.BUSINESS_A4, combinationId: 'COMBINATION_D' };
INVOICE_LAYOUT_SPECS.COMBINATION_E = { ...INVOICE_LAYOUT_SPECS.US_LETTER, combinationId: 'COMBINATION_E' };
INVOICE_LAYOUT_SPECS.COMBINATION_F = { ...INVOICE_LAYOUT_SPECS.CORPORATE_ENTERPRISE, combinationId: 'COMBINATION_F' };
INVOICE_LAYOUT_SPECS.COMBINATION_G = { ...INVOICE_LAYOUT_SPECS.CUSTOM, combinationId: 'COMBINATION_G' };

/**
 * Derive authoritative layout specification for a given preset and options
 */
export const getInvoiceLayoutSpec = (sizePreset = 'BUSINESS_A4', options = {}) => {
    const base = INVOICE_LAYOUT_SPECS[sizePreset] || INVOICE_LAYOUT_SPECS.BUSINESS_A4;
    const spec = { ...base, marginsMm: { ...base.marginsMm } };

    if (sizePreset === 'CUSTOM' || sizePreset === 'COMBINATION_G') {
        const cWidth = Number(options.customWidth);
        const cHeight = Number(options.customHeight);
        if (cWidth && cHeight && !isNaN(cWidth) && !isNaN(cHeight)) {
            spec.canvasWidthPx = Math.max(300, Math.round(cWidth));
            spec.canvasMinHeightPx = Math.max(400, Math.round(cHeight));
            spec.widthMm = Math.max(50, Math.round(spec.canvasWidthPx * 0.264583));
            spec.heightMm = Math.max(70, Math.round(spec.canvasMinHeightPx * 0.264583));
        }
    }

    if (options.orientation) {
        if (options.orientation === 'landscape' && spec.widthMm < spec.heightMm) {
            const tmpMm = spec.widthMm;
            spec.widthMm = spec.heightMm;
            spec.heightMm = tmpMm;
            const tmpPx = spec.canvasWidthPx;
            spec.canvasWidthPx = spec.canvasMinHeightPx;
            spec.canvasMinHeightPx = tmpPx;
            spec.orientation = 'landscape';
        } else if (options.orientation === 'portrait' && spec.widthMm > spec.heightMm) {
            const tmpMm = spec.widthMm;
            spec.widthMm = spec.heightMm;
            spec.heightMm = tmpMm;
            const tmpPx = spec.canvasWidthPx;
            spec.canvasWidthPx = spec.canvasMinHeightPx;
            spec.canvasMinHeightPx = tmpPx;
            spec.orientation = 'portrait';
        }
    } else {
        spec.orientation = spec.widthMm > spec.heightMm ? 'landscape' : 'portrait';
    }

    // Normalized Safe Content Area
    spec.safeAreaMm = {
        left: spec.marginsMm.left,
        top: spec.marginsMm.top,
        right: spec.widthMm - spec.marginsMm.right,
        bottom: spec.heightMm - spec.marginsMm.bottom,
        width: spec.widthMm - spec.marginsMm.left - spec.marginsMm.right,
        height: spec.heightMm - spec.marginsMm.top - spec.marginsMm.bottom
    };

    const pxPerMm = spec.canvasWidthPx / spec.widthMm;
    spec.safeAreaPx = {
        left: Math.round(spec.safeAreaMm.left * pxPerMm),
        top: Math.round(spec.safeAreaMm.top * pxPerMm),
        right: Math.round(spec.safeAreaMm.right * pxPerMm),
        bottom: Math.round(spec.safeAreaMm.bottom * pxPerMm),
        width: Math.round(spec.safeAreaMm.width * pxPerMm),
        height: Math.round(spec.safeAreaMm.height * pxPerMm)
    };

    spec.spacingTokensMm = SPACING_TOKENS_MM;
    spec.spacingTokensPx = SPACING_TOKENS_PX;

    // Resolve combination identifier
    if (sizePreset === 'POS_RECEIPT' || sizePreset === 'COMBINATION_C') {
        spec.combination = 'COMBINATION_C';
    } else if (options.showBilledFrom === false || sizePreset === 'CUSTOMER_A4' || sizePreset === 'COMBINATION_B') {
        spec.combination = 'COMBINATION_B';
    } else if (sizePreset === 'CORPORATE_ENTERPRISE' || sizePreset === 'COMBINATION_F') {
        spec.combination = 'COMBINATION_F';
    } else if (sizePreset === 'US_LETTER' || sizePreset === 'COMBINATION_E') {
        spec.combination = 'COMBINATION_E';
    } else if (sizePreset === 'CUSTOM' || sizePreset === 'COMBINATION_G') {
        spec.combination = 'COMBINATION_G';
    } else {
        spec.combination = 'COMBINATION_D';
    }

    return spec;
};

/**
 * Calculate Anchor Position for safe element positioning
 */
export const calculateAnchorPosition = (anchor = 'content-flow', elementSize = { width: 0, height: 0 }, containerBounds = { left: 0, top: 0, width: 210, height: 297 }) => {
    const elW = Number(elementSize.width) || 0;
    const elH = Number(elementSize.height) || 0;
    const bLeft = Number(containerBounds.left) || 0;
    const bTop = Number(containerBounds.top) || 0;
    const bWidth = Number(containerBounds.width) || 0;
    const bHeight = Number(containerBounds.height) || 0;
    const bRight = bLeft + bWidth;
    const bBottom = bTop + bHeight;

    switch (anchor) {
        case 'top-left':
            return { x: bLeft, y: bTop, anchor };
        case 'top-right':
            return { x: bRight - elW, y: bTop, anchor };
        case 'bottom-left':
            return { x: bLeft, y: bBottom - elH, anchor };
        case 'bottom-right':
            return { x: bRight - elW, y: bBottom - elH, anchor };
        case 'center':
            return { x: bLeft + Math.max(0, (bWidth - elW) / 2), y: bTop + Math.max(0, (bHeight - elH) / 2), anchor };
        case 'relative-to-page-safe-area':
            return { x: bLeft, y: bTop, anchor };
        case 'content-flow':
        case 'relative-to-section':
        default:
            return { x: bLeft, y: bTop, anchor: 'content-flow' };
    }
};

/**
 * Validate Invoice Layout & Detect Potential Collisions / Boundary Overflow
 * Returns structured layout diagnostics: { isValid: boolean, diagnostics: Array<{ elementId, pageNumber, affectedRegion, reason }> }
 */
export const validateInvoiceLayout = (invoice = {}, spec = null, options = {}) => {
    if (!spec) spec = getInvoiceLayoutSpec(options.sizePreset || 'BUSINESS_A4', options);
    const diagnostics = [];

    const safeArea = spec.safeAreaMm || {
        left: spec.marginsMm.left,
        top: spec.marginsMm.top,
        right: spec.widthMm - spec.marginsMm.right,
        bottom: spec.heightMm - spec.marginsMm.bottom,
        width: spec.widthMm - spec.marginsMm.left - spec.marginsMm.right,
        height: spec.heightMm - spec.marginsMm.top - spec.marginsMm.bottom
    };

    // 1. Dimensions Check
    if (spec.widthMm <= 0 || spec.heightMm <= 0) {
        diagnostics.push({
            elementId: 'page_geometry',
            pageNumber: 1,
            affectedRegion: 'PAGE',
            reason: `Invalid page dimensions: ${spec.widthMm}mm x ${spec.heightMm}mm.`
        });
    }

    // 2. Safe Area Check
    if (safeArea.width < 40 || safeArea.height < 50) {
        diagnostics.push({
            elementId: 'safe_area',
            pageNumber: 1,
            affectedRegion: 'SAFE_AREA',
            reason: `Safe content area is critically constrained (${safeArea.width.toFixed(1)}mm x ${safeArea.height.toFixed(1)}mm).`
        });
    }

    // 3. Floating Elements Boundary Check
    const floatingElements = options.elements?.floatingElements || [];
    const scaleX = spec.widthMm / spec.canvasWidthPx;
    const scaleY = spec.heightMm / spec.canvasMinHeightPx;

    floatingElements.forEach((el, idx) => {
        const xMm = (el.x || 0) * scaleX;
        const yMm = (el.y || 0) * scaleY;
        const wMm = (el.width || 120) * scaleX;
        const hMm = el.height ? el.height * scaleY : (el.type === 'photo' ? wMm * 0.75 : 12 * scaleY);

        if (xMm < 0 || yMm < 0) {
            diagnostics.push({
                elementId: el.id || `floating_${idx}`,
                pageNumber: 1,
                affectedRegion: 'FLOATING_LAYER',
                reason: `Element coordinate (${xMm.toFixed(1)}mm, ${yMm.toFixed(1)}mm) is negative.`
            });
        }
        if (xMm + wMm > spec.widthMm || yMm + hMm > spec.heightMm) {
            diagnostics.push({
                elementId: el.id || `floating_${idx}`,
                pageNumber: 1,
                affectedRegion: 'FLOATING_LAYER',
                reason: `Element overflows page boundary (${(xMm + wMm).toFixed(1)}mm > ${spec.widthMm}mm).`
            });
        }
    });

    // 4. Signatures & Stamps Collision Check
    const sigEnabled = options.elements?.signature?.enabled;
    const stampEnabled = options.elements?.stamp?.enabled;
    const isPos = spec.preset === 'POS_RECEIPT';

    if (sigEnabled && stampEnabled && !isPos) {
        const sigW = 42;
        const stampW = 46;
        const requiredWidth = sigW + stampW + 8;
        if (safeArea.width < requiredWidth) {
            diagnostics.push({
                elementId: 'signature_stamp_collision',
                pageNumber: 1,
                affectedRegion: 'SIGNATURE_AND_STAMP',
                reason: `Horizontal width (${safeArea.width.toFixed(1)}mm) requires vertical stacking for signature (${sigW}mm) and stamp (${stampW}mm).`
            });
        }
    }

    return {
        isValid: diagnostics.filter(d => d.reason.includes('Invalid') || d.reason.includes('negative')).length === 0,
        diagnostics
    };
};

/**
 * Generate High-Fidelity Invoice PDF Document
 * @param {Object} invoice - The invoice data object
 * @param {Object} options - Customization options matching canvas
 * @returns {Object} { doc, blob, dataUri, filename }
 */
export const generateInvoicePdf = async (invoice, options = {}) => {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) {
        throw new Error("jsPDF library is not loaded. Please verify your connection.");
    }

    const brandingMode = options.brandingMode || 'WORKSPACE';
    const customBranding = options.customBranding || {};
    const currencySym = options.currencySymbol || invoice.currency || getAppCurrencySymbol();
    const sizePreset = options.sizePreset || 'BUSINESS_A4';
    const showBilledFrom = options.showBilledFrom !== false;
    const spec = getInvoiceLayoutSpec(sizePreset, options);

    const rawInvNum = invoice.busInvNumber || invoice.invoiceNumber || invoice.id || 'INV-001';
    const invDate = formatPdfDate(invoice.timestamp || invoice.createdAt);
    const filename = `Invoice_${rawInvNum.replace(/[^a-zA-Z0-9_-]/g, '_')}_${invDate.replace(/\s+/g, '_')}.pdf`;

    // Explicit export strategy:
    // Default: 'vector' (authoritative vector PDF with native vector text and crisp rendering)
    // Only use 'canvas_snapshot' if caller explicitly requests options.exportEngine === 'canvas_snapshot' or options.useRasterSnapshot === true
    const exportEngine = options.exportEngine || (options.useRasterSnapshot ? 'canvas_snapshot' : 'vector');

    if (exportEngine === 'canvas_snapshot') {
        const domSheets = (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') 
            ? Array.from(document.querySelectorAll('.iv-paper-sheet')) 
            : [];
            
        if (domSheets.length > 0 && typeof window !== 'undefined' && window.html2canvas) {
            try {
                let defaultPageW = spec.widthMm;
                let defaultPageH = spec.heightMm;

                const doc = new jsPDF({
                    orientation: spec.orientation,
                    unit: 'mm',
                    format: [defaultPageW, defaultPageH],
                    compress: true
                });

                const zoomWrapper = document.getElementById('iv-paper-zoom-wrapper');
                const originalTransform = zoomWrapper ? zoomWrapper.style.transform : '';
                try {
                    for (let i = 0; i < domSheets.length; i++) {
                        const sheet = domSheets[i];
                        if (i > 0) {
                            doc.addPage([defaultPageW, defaultPageH], spec.orientation);
                        }

                        const canvas = await window.html2canvas(sheet, {
                            scale: 2.2,
                            useCORS: true,
                            allowTaint: true,
                            logging: false,
                            backgroundColor: '#ffffff'
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        let pWidth = defaultPageW;
                        let pHeight = defaultPageH;

                        if (sizePreset === 'POS_RECEIPT') {
                            pHeight = Math.max(90, Math.round(pWidth * (canvas.height / canvas.width)));
                        }

                        doc.addImage(imgData, 'JPEG', 0, 0, pWidth, pHeight, undefined, 'FAST');
                    }
                } finally {
                    if (zoomWrapper) zoomWrapper.style.transform = originalTransform;
                }

                const blob = doc.output('blob');
                const dataUri = doc.output('datauristring');
                return { doc, blob, dataUri, filename };
            } catch (snapErr) {
                console.warn("Raster canvas snapshot error, proceeding with vector engine:", snapErr);
            }
        }
    }

    // Dynamic accent color from custom border color or theme
    const userAccentHex = (options.border && options.border.color) || options.borderColor || options.themeColor || '#e11d48';
    const parsedAccentRgb = hexToRgb(userAccentHex);
    if (parsedAccentRgb) {
        COLORS.primaryRed = parsedAccentRgb;
        COLORS.primaryDarkRed = [
            Math.max(0, parsedAccentRgb[0] - 30),
            Math.max(0, parsedAccentRgb[1] - 30),
            Math.max(0, parsedAccentRgb[2] - 30)
        ];
    }

    // Determine PDF format and dimensions from canonical layout specification
    let pdfFormat;
    let pdfOrientation = spec.orientation;
    const rawItems = Array.isArray(invoice.items) ? invoice.items : [];

    const isPos = sizePreset === 'POS_RECEIPT' || sizePreset === 'COMBINATION_C' || spec.preset === 'POS_RECEIPT';

    if (isPos) {
        const receiptHeightMm = Math.max(160, 95 + (rawItems.length * 11));
        pdfFormat = [spec.widthMm, receiptHeightMm];
    } else if (sizePreset === 'CUSTOM' || sizePreset === 'COMBINATION_G') {
        pdfFormat = [spec.widthMm, spec.heightMm];
    } else if (sizePreset === 'US_LETTER' || sizePreset === 'COMBINATION_E') {
        pdfFormat = 'letter';
    } else {
        pdfFormat = 'a4';
    }

    // Create jsPDF Instance
    const doc = new jsPDF({
        orientation: pdfOrientation,
        unit: 'mm',
        format: pdfFormat,
        compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = spec.marginsMm.left;
    const contentWidth = pageWidth - (margin * 2);

    // Decoupled coordinate scaling from canonical layout specification
    const scaleX = pageWidth / spec.canvasWidthPx;
    const scaleY = pageHeight / spec.canvasMinHeightPx;

    // Resolve Brand Information (BILLED FROM)
    let brandTitle = 'PriceLister Business';
    let brandSubtitle = customBranding.subtitle || 'Commercial Sales Invoice';
    let brandPhone = '';
    let brandEmail = '';
    let brandAddress = '';
    let brandTaxId = customBranding.taxId || 'TAX-9948201';

    if (brandingMode === 'WORKSPACE') {
        brandTitle = invoice.businessName || window.__activeWorkspace?.name || 'Your Business';
        brandPhone = invoice.businessPhone || window.__activeWorkspace?.phone || '';
        brandEmail = invoice.businessEmail || window.__activeWorkspace?.email || '';
        brandAddress = invoice.businessAddress || window.__activeWorkspace?.address || '';
    } else if (brandingMode === 'PRICELISTER') {
        brandTitle = 'PriceLister';
        brandSubtitle = 'Official Commercial Invoice';
    } else if (brandingMode === 'CUSTOM') {
        brandTitle = customBranding.title || invoice.businessName || 'Your Business';
        brandSubtitle = customBranding.subtitle || 'Commercial Sales Invoice';
        brandPhone = customBranding.phone || invoice.businessPhone || '';
        brandEmail = customBranding.email || invoice.businessEmail || '';
        brandAddress = customBranding.address || invoice.businessAddress || '';
    } else if (brandingMode === 'NONE') {
        brandTitle = invoice.businessName || 'Invoice';
        brandSubtitle = '';
    }

    // Resolve Recipient Information (BILLED TO)
    const isBusiness = Boolean(invoice.isBusiness || invoice.busInvNumber || invoice.clientName || invoice.clientId);
    const clientName = isBusiness 
        ? (invoice.clientName || invoice.customerName || 'B2B Client Entity')
        : (invoice.customerName || 'Customer Client');
    const clientPhone = invoice.clientPhone || invoice.customerNumber || '';
    const clientEmail = invoice.clientEmail || '';
    const clientAddress = invoice.clientAddress || '';

    const invNumber = rawInvNum;
    const invStatus = (invoice.status || 'PAID').toUpperCase();

    // Line Items parsing
    const tableRows = rawItems.map((item, idx) => {
        const name = item.name || item.productName || `Item #${idx + 1}`;
        const size = item.size || item.sizeWeight ? ` (${item.size || item.sizeWeight})` : '';
        const qty = item.quantity || item.qty || 1;
        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
        const total = Number(item.totalPrice || (qty * price) || 0);

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
    // 1. POS BILL RECEIPT LONG (80mm Continuous Roll)
    // =========================================================================
    if (isPos) {
        currentY = 6;

        // Centered Header
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(brandTitle.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

        if (brandSubtitle) {
            currentY += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text(brandSubtitle, pageWidth / 2, currentY, { align: 'center' });
        }

        if (brandAddress || brandPhone) {
            currentY += 3.5;
            doc.setFontSize(7);
            doc.text([brandAddress, brandPhone].filter(Boolean).join(' | '), pageWidth / 2, currentY, { align: 'center' });
        }

        // Receipt # and Date
        currentY += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`RECEIPT: #${invNumber}`, pageWidth / 2, currentY, { align: 'center' });

        currentY += 3.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${invDate} • Register 01`, pageWidth / 2, currentY, { align: 'center' });

        // Dashed Tear Separator
        currentY += 3;
        doc.setDrawColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        doc.setLineDashPattern([], 0);

        // Customer & Status
        currentY += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`Customer: ${clientName}`, margin, currentY);
        doc.text(`Status: ${invStatus}`, pageWidth - margin, currentY, { align: 'right' });

        currentY += 3;

        // Compact AutoTable for 80mm
        doc.autoTable({
            startY: currentY,
            head: [['ITEM', 'QTY', 'PRICE', 'TOTAL']],
            body: tableRows.map(r => [r[1], r[2], r[3], r[4]]),
            margin: { left: margin, right: margin },
            showHead: 'everyPage',
            theme: 'plain',
            headStyles: {
                fillColor: [245, 245, 245],
                textColor: COLORS.slateDark,
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: 1.5,
                lineWidth: { bottom: 0.3 },
                lineColor: [200, 200, 200]
            },
            bodyStyles: {
                fontSize: 7,
                textColor: COLORS.slateDark,
                cellPadding: 1.5
            },
            columnStyles: {
                0: { cellWidth: 32 },
                1: { cellWidth: 9, halign: 'center' },
                2: { cellWidth: 15, halign: 'right' },
                3: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 4;
    }

    // =========================================================================
    // 2. CORPORATE ENTERPRISE LARGE (Executive Layout)
    // =========================================================================
    else if (sizePreset === 'CORPORATE_ENTERPRISE' || sizePreset === 'COMBINATION_F' || spec.preset === 'CORPORATE_ENTERPRISE') {
        // Dark Solid Executive Header Bar
        const darkHeaderHeight = 32;
        doc.setFillColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.rect(margin, margin, contentWidth, darkHeaderHeight, 'F');

        doc.setFillColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.rect(margin, margin + darkHeaderHeight - 2, contentWidth, 2, 'F');

        // Header Left: Corporate Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.text(brandTitle, margin + 6, margin + 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text([brandAddress, brandPhone ? `Phone: ${brandPhone}` : '', brandEmail].filter(Boolean).join(' • '), margin + 6, margin + 18);

        // Header Right: Invoice Info
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('CORPORATE INVOICE', pageWidth - margin - 6, margin + 11, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text(`#${invNumber} • Date: ${invDate}`, pageWidth - margin - 6, margin + 18, { align: 'right' });

        currentY = margin + darkHeaderHeight + 6;

        // Coordinates Grid (BILLED FROM, BILLED TO, TAX & WIRE)
        if (showBilledFrom) {
            const colW = (contentWidth - 6) / 3;
            doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'S');

            // Col 1: Billed From
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('BILLED FROM', margin + 4, currentY + 5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(brandTitle, margin + 4, currentY + 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text(brandAddress || 'Corporate Headquarters', margin + 4, currentY + 15);

            // Col 2: Billed To
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('BILLED TO (CLIENT)', margin + colW + 4, currentY + 5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(clientName, margin + colW + 4, currentY + 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text(clientPhone || clientEmail || 'Verified Corporate Account', margin + colW + 4, currentY + 15);

            // Col 3: Coordinates
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('TAX & WIRE COORDINATES', margin + (colW * 2) + 4, currentY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(`Tax ID: ${brandTaxId}`, margin + (colW * 2) + 4, currentY + 10);
            doc.text(`Terms: Net 30 Business Days`, margin + (colW * 2) + 4, currentY + 15);
        } else {
            // When Billed From is omitted, expand Billed To across 58% and Coordinates across 42%
            const col1W = (contentWidth - 4) * 0.58;
            doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'F');
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'S');

            // Billed To (Full focus)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('BILLED TO (CLIENT)', margin + 4, currentY + 5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(clientName, margin + 4, currentY + 10.5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text([clientPhone, clientEmail, clientAddress].filter(Boolean).join(' • ') || 'Verified Corporate Account', margin + 4, currentY + 15.5);

            // Coordinates
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('TAX & WIRE COORDINATES', margin + col1W + 4, currentY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(`Tax ID: ${brandTaxId}`, margin + col1W + 4, currentY + 10);
            doc.text(`Terms: Net 30 Business Days`, margin + col1W + 4, currentY + 15);
        }

        currentY += 28;

        // AutoTable
        doc.autoTable({
            startY: currentY,
            head: [['#', 'SCOPE / ITEM SPECIFICATION', 'QTY', 'UNIT RATE', 'AMOUNT']],
            body: tableRows,
            margin: { left: margin, right: margin },
            showHead: 'everyPage',
            theme: 'striped',
            headStyles: {
                fillColor: COLORS.slateDark,
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
                cellPadding: 3.5
            },
            bodyStyles: {
                fontSize: 8,
                textColor: COLORS.slateDark,
                cellPadding: 3.2
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 32, halign: 'right' },
                4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            }
        });

        currentY = doc.lastAutoTable.finalY + 6;
    }

    // =========================================================================
    // 3. STANDARD BUSINESS A4, CUSTOMER A4, US LETTER & CUSTOM
    // =========================================================================
    else {
        // Top Accent Color Bar
        doc.setFillColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.rect(margin, margin, contentWidth, 4, 'F');

        currentY = margin + 11;

        // Header Left: Brand Info
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(19);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(brandTitle, margin, currentY);

        if (brandSubtitle) {
            currentY += 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text(brandSubtitle.toUpperCase(), margin, currentY);
        }

        if (brandAddress || brandPhone || brandEmail) {
            currentY += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            const contactText = [brandAddress, brandPhone ? `Tel: ${brandPhone}` : '', brandEmail ? `Email: ${brandEmail}` : ''].filter(Boolean).join(' • ');
            doc.text(contactText, margin, currentY);
        }

        // Header Right: Invoice Title & Number
        const headerTitle = (sizePreset === 'CUSTOMER_A4') ? 'CUSTOMER INVOICE' : 'INVOICE';
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text(headerTitle, pageWidth - margin, margin + 11, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text(`#${invNumber}`, pageWidth - margin, margin + 16.5, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        doc.text(`Date: ${invDate}`, pageWidth - margin, margin + 21, { align: 'right' });

        // Status Badge Pill on Right
        const isPaid = invStatus === 'PAID';
        const badgeColor = isPaid ? COLORS.successGreen : COLORS.primaryRed;
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(pageWidth - margin - 22, margin + 23.5, 22, 5.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(invStatus, pageWidth - margin - 11, margin + 27.5, { align: 'center' });

        // Divider Line
        currentY = Math.max(currentY + 7, margin + 34);
        doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, currentY, pageWidth - margin, currentY);

        // Dual Columns: BILLED FROM & BILLED TO
        currentY += 5;
        if (showBilledFrom) {
            const boxW = (contentWidth - 6) / 2;
            doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
            doc.roundedRect(margin, currentY, boxW, 23, 2, 2, 'F');
            doc.roundedRect(margin + boxW + 6, currentY, boxW, 23, 2, 2, 'F');
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.roundedRect(margin, currentY, boxW, 23, 2, 2, 'S');
            doc.roundedRect(margin + boxW + 6, currentY, boxW, 23, 2, 2, 'S');

            // Billed From Card
            const fromLabel = (sizePreset === 'CUSTOMER_A4') ? 'BILLED FROM (STORE)' : 'BILLED FROM (SUPPLIER)';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text(fromLabel, margin + 4, currentY + 5.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(brandTitle, margin + 4, currentY + 11);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text([brandAddress, brandPhone ? `Tel: ${brandPhone}` : '', `Tax ID: ${brandTaxId}`].filter(Boolean).join(' • '), margin + 4, currentY + 16.5);

            // Billed To Card
            const toLabel = (sizePreset === 'CUSTOMER_A4') ? 'BILLED TO (CUSTOMER)' : 'BILLED TO (RECIPIENT)';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text(toLabel, margin + boxW + 10, currentY + 5.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(clientName, margin + boxW + 10, currentY + 11);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text([clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).join(' • ') || 'Customer Direct Sale', margin + boxW + 10, currentY + 16.5);
        } else {
            // Full-width Billed To Card when Billed From is toggled off
            doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 23, 2, 2, 'F');
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.roundedRect(margin, currentY, contentWidth, 23, 2, 2, 'S');

            const toLabel = (sizePreset === 'CUSTOMER_A4') ? 'BILLED TO (CUSTOMER)' : 'BILLED TO (RECIPIENT)';
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text(toLabel, margin + 4, currentY + 5.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(clientName, margin + 4, currentY + 11);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text([clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).join(' • ') || 'Customer Direct Sale', margin + 4, currentY + 16.5);
        }

        currentY += 29;

        // AutoTable for Line Items
        const isCustomerA4 = sizePreset === 'CUSTOMER_A4' || sizePreset === 'COMBINATION_B' || spec.preset === 'CUSTOMER_A4';
        doc.autoTable({
            startY: currentY,
            head: [['#', 'Item & Description', 'Qty', 'Unit Price', 'Total']],
            body: tableRows,
            margin: { left: margin, right: margin },
            showHead: 'everyPage',
            theme: 'plain',
            headStyles: {
                fillColor: isCustomerA4 ? [248, 250, 252] : COLORS.primaryRed,
                textColor: isCustomerA4 ? COLORS.slateDark : [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 8.5,
                cellPadding: 3.5,
                lineWidth: isCustomerA4 ? { bottom: 0.5 } : 0,
                lineColor: [203, 213, 225]
            },
            bodyStyles: {
                fontSize: 8,
                textColor: COLORS.slateDark,
                cellPadding: 3.2
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
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
    // TOTALS CALCULATION BOX
    // =========================================================================
    const subtotal = Number(invoice.subtotal || 0);
    const discountPct = Number(invoice.discountPercent || 0);
    const addCut = Number(invoice.additionalCut || 0);
    const taxPct = Number(invoice.taxPercent || 0);
    const shipping = Number(invoice.shippingCost || 0);

    const discountAmount = discountPct > 0 ? (subtotal * discountPct) / 100 : 0;
    const baseForTax = Math.max(0, subtotal - discountAmount - addCut);
    const taxAmount = taxPct > 0 ? (baseForTax * taxPct) / 100 : 0;
    const grandTotal = Number(invoice.totalPrice || invoice.grandTotal || (baseForTax + taxAmount + shipping));

    if (isPos) {
        // POS Simple Totals
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);

        doc.text('Subtotal:', margin, currentY);
        doc.text(formatPdfCurrency(subtotal, currencySym), pageWidth - margin, currentY, { align: 'right' });
        currentY += 4;

        if (discountPct > 0) {
            doc.setTextColor(COLORS.successGreen[0], COLORS.successGreen[1], COLORS.successGreen[2]);
            doc.text(`Discount (${discountPct}%):`, margin, currentY);
            doc.text(`-${formatPdfCurrency(discountAmount, currencySym)}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 4;
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        }

        if (taxPct > 0) {
            doc.text(`Tax / VAT (${taxPct}%):`, margin, currentY);
            doc.text(`+${formatPdfCurrency(taxAmount, currencySym)}`, pageWidth - margin, currentY, { align: 'right' });
            currentY += 4;
        }

        doc.setDrawColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4.5;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('TOTAL DUE:', margin, currentY);
        doc.text(formatPdfCurrency(grandTotal, currencySym), pageWidth - margin, currentY, { align: 'right' });
        currentY += 8;

        // POS Barcode Simulation & Footer
        doc.setFont('courier', 'bold');
        doc.setFontSize(11);
        doc.text('||| | ||||| || |||||| |', pageWidth / 2, currentY, { align: 'center' });
        currentY += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
        doc.text(`*${invNumber}*`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
        doc.text('THANK YOU FOR YOUR PATRONAGE!', pageWidth / 2, currentY, { align: 'center' });
    } else {
        // Standard / Corporate / Letter Totals Box
        const totalsBoxWidth = Math.min(80, contentWidth * 0.45);
        const totalsBoxX = pageWidth - margin - totalsBoxWidth;

        // Check if totals box needs a new page
        if (currentY + 55 > pageHeight - margin) {
            doc.addPage();
            currentY = margin + 10;
        }

        let extraRows = 0;
        if (discountPct > 0) extraRows++;
        if (addCut > 0) extraRows++;
        if (taxPct > 0) extraRows++;
        if (shipping > 0) extraRows++;
        const boxHeight = 26 + (extraRows * 5.5);

        doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
        doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, boxHeight, 2, 2, 'F');
        doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
        doc.roundedRect(totalsBoxX, currentY, totalsBoxWidth, boxHeight, 2, 2, 'S');

        let totY = currentY + 5.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);

        doc.text('Subtotal:', totalsBoxX + 5, totY);
        doc.text(formatPdfCurrency(subtotal, currencySym), totalsBoxX + totalsBoxWidth - 5, totY, { align: 'right' });

        if (discountPct > 0) {
            totY += 5;
            doc.setTextColor(COLORS.successGreen[0], COLORS.successGreen[1], COLORS.successGreen[2]);
            doc.text(`Discount (${discountPct}%):`, totalsBoxX + 5, totY);
            doc.text(`-${formatPdfCurrency(discountAmount, currencySym)}`, totalsBoxX + totalsBoxWidth - 5, totY, { align: 'right' });
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
        }

        if (taxPct > 0) {
            totY += 5;
            doc.text(`Tax / VAT (${taxPct}%):`, totalsBoxX + 5, totY);
            doc.text(`+${formatPdfCurrency(taxAmount, currencySym)}`, totalsBoxX + totalsBoxWidth - 5, totY, { align: 'right' });
        }

        if (shipping > 0) {
            totY += 5;
            doc.text('Shipping:', totalsBoxX + 5, totY);
            doc.text(`+${formatPdfCurrency(shipping, currencySym)}`, totalsBoxX + totalsBoxWidth - 5, totY, { align: 'right' });
        }

        // Grand Total Row
        totY += 6;
        doc.setDrawColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.setLineWidth(0.5);
        doc.line(totalsBoxX + 3, totY - 1.5, totalsBoxX + totalsBoxWidth - 3, totY - 1.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
        doc.text('Grand Total:', totalsBoxX + 5, totY + 3);
        doc.text(formatPdfCurrency(grandTotal, currencySym), totalsBoxX + totalsBoxWidth - 5, totY + 3, { align: 'right' });

        // Notes on Left (Hidden if empty)
        const notesText = (invoice.notes || customBranding.notes || '').trim();
        if (notesText) {
            const notesX = margin;
            const notesWidth = totalsBoxX - margin - 8;
            let notesY = currentY + 4;

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
            doc.text('NOTES & PAYMENT INSTRUCTIONS', notesX, notesY);

            notesY += 4.5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            const splitNotes = typeof doc.splitTextToSize === 'function' ? doc.splitTextToSize(notesText, notesWidth) : [notesText];
            doc.text(splitNotes, notesX, notesY);
        }

        // Bank Wire Transfer Card (For Business & Corporate)
        if (customBranding.bankDetails && ['BUSINESS_A4', 'CORPORATE_ENTERPRISE', 'COMBINATION_A', 'COMBINATION_D', 'COMBINATION_F'].includes(sizePreset)) {
            const bankY = currentY + (notesText ? 24 : 4);
            const bankW = totalsBoxX - margin - 8;
            doc.setFillColor(COLORS.surfaceLight[0], COLORS.surfaceLight[1], COLORS.surfaceLight[2]);
            doc.roundedRect(margin, bankY, bankW, 14, 1.5, 1.5, 'F');
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.roundedRect(margin, bankY, bankW, 14, 1.5, 1.5, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(COLORS.primaryRed[0], COLORS.primaryRed[1], COLORS.primaryRed[2]);
            doc.text('WIRE & SETTLEMENT COORDINATES', margin + 3.5, bankY + 4.5);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(customBranding.bankDetails, margin + 3.5, bankY + 9.5);
        }

        currentY = Math.max(currentY + boxHeight + 4, currentY + 35);

        // US Letter Remittance Slip Tear Line
        if ((sizePreset === 'US_LETTER' || sizePreset === 'COMBINATION_E') && currentY + 22 < pageHeight - margin) {
            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(margin, pageHeight - margin - 22, pageWidth - margin, pageHeight - margin - 22);
            doc.setLineDashPattern([], 0);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
            doc.text('✃ Please detach and return with payment remittance ✃', pageWidth / 2, pageHeight - margin - 18, { align: 'center' });
        }
    }

    // =========================================================================
    // SIGNATURE & CORPORATE STAMP / SEAL (Rendered on Last Page)
    // =========================================================================
    if (!isPos) {
        // Terms & Conditions Block (Rendered if non-empty, matching canvas)
        const termsText = (options.customBranding?.termsAndConditions || invoice.termsAndConditions || '').trim();
        if (termsText) {
            const splitTerms = typeof doc.splitTextToSize === 'function' ? doc.splitTextToSize(termsText, contentWidth) : [termsText];
            const termsHeight = 8 + (splitTerms.length * 3.5);
            if (currentY + termsHeight + 25 > pageHeight - margin) {
                doc.addPage();
                currentY = margin + 10;
            }

            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.setLineDashPattern([1.5, 1.5], 0);
            doc.line(margin, currentY, pageWidth - margin, currentY);
            doc.setLineDashPattern([], 0);

            currentY += 4.5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
            doc.text('TERMS & CONDITIONS', margin, currentY);

            currentY += 4;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.8);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text(splitTerms, margin, currentY);

            currentY += (splitTerms.length * 3.5) + 3;
        }

        // Digital Signature & Corporate Stamp / Seal (Rendered on Last Page)
        let lastPage = doc.internal.getNumberOfPages();
        doc.setPage(lastPage);

        const sigEnabled = Boolean(options.elements?.signature?.enabled);
        const stampEnabled = Boolean(options.elements?.stamp?.enabled);

        const sigW = 44;
        const sigH = 20;
        const stampW = 46;
        const stampH = 14;

        let sigX = margin;
        let sigY = pageHeight - margin - 22;
        let stampX = pageWidth - margin - stampW;
        let stampY = pageHeight - margin - 24;

        // Collision Check: Check horizontal safe space between signature and stamp
        if (sigEnabled && stampEnabled && (sigX + sigW + 6 > stampX)) {
            // Stack stamp above signature
            stampX = pageWidth - margin - stampW;
            stampY = sigY - stampH - 4;
        }

        // Prevent stamps/signatures from covering totals or line items
        const minDockY = Math.min(sigEnabled ? sigY : 9999, stampEnabled ? stampY : 9999);
        if (minDockY !== 9999 && currentY + 4 > minDockY) {
            doc.addPage();
            lastPage = doc.internal.getNumberOfPages();
            doc.setPage(lastPage);
            currentY = margin + 10;
            sigY = pageHeight - margin - 22;
            stampY = pageHeight - margin - 24;
            if (sigEnabled && stampEnabled && (sigX + sigW + 6 > stampX)) {
                stampY = sigY - stampH - 4;
            }
        }

        if (sigEnabled) {
            const sig = options.elements.signature;
            if (sig.dataUrl) {
                try {
                    const sigObj = await ensureCompatibleImageData(sig.dataUrl);
                    if (sigObj && sigObj.width > 0) {
                        const actualH = Math.min(16, sigW * (sigObj.height / sigObj.width));
                        doc.addImage(sigObj.dataUrl, sigObj.format, sigX, sigY - actualH + 2, sigW, actualH);
                    }
                } catch (e) {
                    console.warn("Could not add signature image to PDF:", e);
                }
            } else {
                if (sig.isBold) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                } else {
                    doc.setFont('times', 'italic');
                    doc.setFontSize(12);
                }
                doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
                doc.text(sig.signerName || 'Authorized Signatory', sigX + (sigW / 2), sigY, { align: 'center' });
            }

            doc.setDrawColor(COLORS.borderLight[0], COLORS.borderLight[1], COLORS.borderLight[2]);
            doc.setLineWidth(0.3);
            doc.line(sigX, sigY + 2, sigX + sigW, sigY + 2);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(COLORS.slateDark[0], COLORS.slateDark[1], COLORS.slateDark[2]);
            doc.text(sig.signerSubName || sig.signerName || 'Authorized Signatory', sigX + (sigW / 2), sigY + 5.5, { align: 'center' });

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(COLORS.slateGray[0], COLORS.slateGray[1], COLORS.slateGray[2]);
            doc.text(sig.signerTitle || 'Managing Director', sigX + (sigW / 2), sigY + 9, { align: 'center' });
        }

        // Corporate Stamp / Seal
        if (stampEnabled) {
            const stamp = options.elements.stamp;
            const stampRgb = hexToRgb(stamp.color || '#059669') || [5, 150, 105];
            const stampText = stamp.customText || 'APPROVED & VERIFIED';

            doc.setDrawColor(stampRgb[0], stampRgb[1], stampRgb[2]);
            doc.setLineWidth(0.5);
            doc.roundedRect(stampX, stampY, stampW, stampH, 2, 2, 'S');
            doc.setLineWidth(0.2);
            doc.roundedRect(stampX + 0.8, stampY + 0.8, stampW - 1.6, stampH - 1.6, 1.5, 1.5, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(stampRgb[0], stampRgb[1], stampRgb[2]);
            doc.text(`★ ${stampText} ★`, stampX + (stampW / 2), stampY + 5.5, { align: 'center' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.text(brandTitle, stampX + (stampW / 2), stampY + 10.5, { align: 'center' });
        }
    }

    // =========================================================================
    // FLOATING CANVAS ELEMENTS (Photos & Custom Texts positioned anywhere)
    // =========================================================================
    if (Array.isArray(options.elements?.floatingElements) && options.elements.floatingElements.length > 0) {
        doc.setPage(doc.internal.getNumberOfPages());
        for (const el of options.elements.floatingElements) {
            if (el.type === 'photo' && el.src) {
                const xMm = el.x * scaleX;
                const yMm = el.y * scaleY;
                const wMm = (el.width || 140) * scaleX;
                try {
                    const imgObj = await ensureCompatibleImageData(el.src);
                    if (imgObj && imgObj.width > 0) {
                        const hMm = wMm * (imgObj.height / imgObj.width);
                        doc.addImage(imgObj.dataUrl, imgObj.format, xMm, yMm, wMm, hMm);
                    }
                } catch (err) {
                    console.warn("Could not add floating photo to PDF:", err);
                }
            } else if (el.type === 'text' && el.text) {
                const xMm = el.x * scaleX;
                const yMm = el.y * scaleY;
                const fontSizePt = Math.max(7, Math.round((el.fontSize || 13) * 0.75));
                const textRgb = hexToRgb(el.color || '#0f172a') || [15, 23, 42];

                doc.setFont('helvetica', 'bold');
                doc.setFontSize(fontSizePt);
                doc.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
                const lines = String(el.text).split('\n');
                doc.text(lines, xMm, yMm, { baseline: 'top' });
            }
        }
    }

    // =========================================================================
    // CANVAS BORDER RENDERING & CLEAN FOOTER (On All Pages)
    // =========================================================================
    if (!isPos) {
        const totalPdfPages = doc.internal.getNumberOfPages();
        const borderConfig = options.border;

        for (let p = 1; p <= totalPdfPages; p++) {
            doc.setPage(p);

            // Draw Canvas Border on All Pages if Enabled
            if (borderConfig && borderConfig.enabled) {
                const bColor = hexToRgb(borderConfig.color) || COLORS.primaryRed;
                const bWidth = Math.max(0.2, (borderConfig.width || 1) * 0.25);
                const bRadius = Math.min(6, (borderConfig.radius || 8) * 0.25);

                doc.setDrawColor(bColor[0], bColor[1], bColor[2]);
                doc.setLineWidth(bWidth);
                if (borderConfig.style === 'dashed') {
                    doc.setLineDashPattern([2, 2], 0);
                    doc.roundedRect(3, 3, pageWidth - 6, pageHeight - 6, bRadius, bRadius, 'S');
                    doc.setLineDashPattern([], 0);
                } else if (borderConfig.style === 'double') {
                    doc.roundedRect(2.4, 2.4, pageWidth - 4.8, pageHeight - 4.8, bRadius, bRadius, 'S');
                    doc.roundedRect(3.8, 3.8, pageWidth - 7.6, pageHeight - 7.6, Math.max(0.5, bRadius - 1), Math.max(0.5, bRadius - 1), 'S');
                } else {
                    doc.roundedRect(3, 3, pageWidth - 6, pageHeight - 6, bRadius, bRadius, 'S');
                }
            }

            // Continuation & Page Numbering on Multi-Page Documents
            if (totalPdfPages > 1) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(COLORS.slateMuted[0], COLORS.slateMuted[1], COLORS.slateMuted[2]);
                doc.text(`Invoice #${invNumber} • Page ${p} of ${totalPdfPages}`, pageWidth - margin, pageHeight - margin + 3.5, { align: 'right' });
            }
        }
    }

    // Output Formats
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
