/**
 * PRICELISTER — CODE STUDIO & SEQUENCE ENGINE SERVICE
 * Enterprise-grade Code Builder, Sequence Reservation, Template Persistence,
 * Collision Detection, and Audit History for Supermarkets, Retailers & Warehouses
 */

import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';

// =============================================================================
// PURE JAVASCRIPT CHECK DIGIT ALGORITHMS
// =============================================================================

/**
 * Modulo-10 Check Digit (Alternating 3 and 1 weight, standard EAN/UPC/GS1)
 */
export function calculateModulo10CheckDigit(digitsStr) {
    const clean = String(digitsStr || '').replace(/\D/g, '');
    if (!clean) return 0;
    let sum = 0;
    for (let i = clean.length - 1, weight = 3; i >= 0; i--, weight = (weight === 3 ? 1 : 3)) {
        sum += parseInt(clean.charAt(i), 10) * weight;
    }
    return (10 - (sum % 10)) % 10;
}

/**
 * Modulo-43 Check Digit (Standard Code 39 checksum)
 */
export function calculateModulo43CheckDigit(text) {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%";
    const clean = String(text || '').toUpperCase();
    let sum = 0;
    for (let i = 0; i < clean.length; i++) {
        const idx = chars.indexOf(clean.charAt(i));
        if (idx !== -1) sum += idx;
    }
    return chars.charAt(sum % 43);
}

/**
 * Luhn Check Digit (Modulo 10 doubling algorithm)
 */
export function calculateLuhnCheckDigit(digitsStr) {
    const clean = String(digitsStr || '').replace(/\D/g, '');
    if (!clean) return 0;
    let sum = 0;
    let shouldDouble = true;
    for (let i = clean.length - 1; i >= 0; i--) {
        let digit = parseInt(clean.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return (10 - (sum % 10)) % 10;
}

// Confusing characters set to exclude when requested (0, O, 1, I, l)
const CONFUSING_CHARS = new Set(['0', 'O', 'o', '1', 'I', 'l']);

// Secure random generator helper
function getRandomCharFromSet(charset, excludeConfusing = false) {
    let pool = charset;
    if (excludeConfusing) {
        pool = charset.split('').filter(c => !CONFUSING_CHARS.has(c)).join('');
        if (!pool) pool = charset;
    }
    const array = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
        return pool.charAt(array[0] % pool.length);
    }
    return pool.charAt(Math.floor(Math.random() * pool.length));
}

// =============================================================================
// =============================================================================
// DEFAULT ENTERPRISE CODE TEMPLATES SEED
// Clean minimal set:
// 1. Standard Product Code (Default normal - Random 13 Digits, cannot delete or customize)
// 2. Date Coder (Current Date e.g. 11/03/2026)
// 3. Timestamp Coder (Epoch Unix Milliseconds)
// 4. Supermarket Standard (GROC-RET-000001, modifiable / deletable)
// 5. Pricelister Origin (PL-PRODUCT-00001, modifiable / deletable)
// =============================================================================
export const DEFAULT_CODE_TEMPLATES = [
    {
        id: 'tmpl-standard-product-code',
        name: 'Standard Product Code',
        description: 'Default 13-digit random standard numeric product code (e.g. 8908796598438)',
        categoryFilter: 'all',
        isDefault: true,
        isSystemLocked: true, // Permanent default - cannot delete, cannot customize
        globalSeparator: '',
        prefix: '',
        suffix: '',
        fixedLength: 13,
        blocks: [
            { id: 'b1', type: 'random_numbers', name: '13-Digit Standard EAN/UPC', length: 13, separator: '' }
        ]
    },
    {
        id: 'tmpl-date-coder',
        name: 'Date Coder',
        description: 'Formatted date coder using current date (e.g. 11/03/2026 or YYMMDD)',
        categoryFilter: 'all',
        isDefault: false,
        isSystemLocked: false,
        globalSeparator: '/',
        prefix: '',
        suffix: '',
        fixedLength: 0,
        blocks: [
            { id: 'b1', type: 'date_based', name: 'Full Date String', format: 'MM/DD/YYYY', separator: '' }
        ]
    },
    {
        id: 'tmpl-timestamp-coder',
        name: 'Timestamp Coder',
        description: 'High-precision epoch unix timestamp identifier (e.g. 1703458345340)',
        categoryFilter: 'all',
        isDefault: false,
        isSystemLocked: false,
        globalSeparator: '',
        prefix: '',
        suffix: '',
        fixedLength: 0,
        blocks: [
            { id: 'b1', type: 'timestamp', name: 'Timestamp Milliseconds', format: 'YYYYMMDDHHmmss', separator: '' }
        ]
    },
    {
        id: 'tmpl-supermarket-standard',
        name: 'Supermarket Standard',
        description: 'Supermarket department, category tag, and 6-digit sequence (e.g. GROC-RET-000001)',
        categoryFilter: 'all',
        isDefault: false,
        isSystemLocked: false,
        globalSeparator: '-',
        prefix: '',
        suffix: '',
        fixedLength: 0,
        blocks: [
            { id: 'b1', type: 'fixed_text', name: 'Dept Code', value: 'GROC', length: 4, separator: '-' },
            { id: 'b2', type: 'fixed_text', name: 'Sub-Category', value: 'RET', length: 3, separator: '-' },
            { id: 'b3', type: 'sequential_number', name: 'Sequential ID', startingNumber: 1, step: 1, length: 6, padChar: '0', separator: '' }
        ]
    },
    {
        id: 'tmpl-pricelister-origin',
        name: 'Pricelister Origin',
        description: 'Pricelister origin brand prefix and sequential unit code (e.g. PL-PRODUCT-00001)',
        categoryFilter: 'all',
        isDefault: false,
        isSystemLocked: false,
        globalSeparator: '-',
        prefix: '',
        suffix: '',
        fixedLength: 0,
        blocks: [
            { id: 'b1', type: 'fixed_text', name: 'Brand Code', value: 'PL', length: 2, separator: '-' },
            { id: 'b2', type: 'fixed_text', name: 'Product Label', value: 'PRODUCT', length: 7, separator: '-' },
            { id: 'b3', type: 'sequential_number', name: 'Serial Sequence', startingNumber: 1, step: 1, length: 5, padChar: '0', separator: '' }
        ]
    }
];

// =============================================================================
// MAIN SERVICE FACTORY
// =============================================================================
export const getCodeStudioService = (workspaceId) => {
    const wsId = workspaceId || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    
    // Team-based SaaS Persistence: Primary Subcollection 'Templates', Mirrored to 'CodeTemplates'
    const templatesRepo = createRepository('Templates', wsId);
    const codeTemplatesRepo = createRepository('CodeTemplates', wsId);
    const sequencesRepo = createRepository('CodeSequences', wsId);
    const reservationsRepo = createRepository('CodeReservations', wsId);
    const historyRepo = createRepository('CodeHistory', wsId);
    const batchesRepo = createRepository('CodeBatches', wsId);
    const productsRepo = createRepository('Products', wsId);
    const customerInvoiceRepo = createRepository('Invoices', wsId);
    const businessInvoiceRepo = createRepository('BusinessInvoices', wsId);

    // Resolve real workspace ID (e.g. WS-XXXXX or 14-char base34 ID) instead of the raw document ID / auth UID
    const getRealWorkspaceId = () => {
        if (typeof window !== 'undefined' && window.__activeWorkspace) {
            if (window.__activeWorkspace.workspaceId) return window.__activeWorkspace.workspaceId;
            if (window.__activeWorkspace.realWorkspaceId) return window.__activeWorkspace.realWorkspaceId;
            if (window.__activeWorkspace.uniqueId) return window.__activeWorkspace.uniqueId;
        }
        const stored = (typeof localStorage !== 'undefined') ? (localStorage.getItem('pricelister_active_real_ws') || localStorage.getItem('pricelister_workspace_id')) : null;
        if (stored) return stored;
        return wsId;
    };

    return {
        // =====================================================================
        // 1. BLOCK EVALUATION & CODE ASSEMBLY ENGINE
        // =====================================================================
        generateBlockValue: (block, context = {}) => {
            if (!block) return '';
            const type = block.type || 'fixed_text';

            switch (type) {
                case 'fixed_text':
                    return String(block.value !== undefined ? block.value : (block.name || ''));

                case 'random_uppercase': {
                    const len = parseInt(block.length, 10) || 3;
                    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    let res = "";
                    for (let i = 0; i < len; i++) {
                        res += getRandomCharFromSet(charset, !!block.excludeConfusing);
                    }
                    return res;
                }

                case 'random_lowercase': {
                    const len = parseInt(block.length, 10) || 3;
                    const charset = "abcdefghijklmnopqrstuvwxyz";
                    let res = "";
                    for (let i = 0; i < len; i++) {
                        res += getRandomCharFromSet(charset, !!block.excludeConfusing);
                    }
                    return res;
                }

                case 'random_numbers': {
                    const len = parseInt(block.length, 10) || 4;
                    const charset = "0123456789";
                    let res = "";
                    for (let i = 0; i < len; i++) {
                        res += getRandomCharFromSet(charset, false);
                    }
                    return res;
                }

                case 'random_alphanumeric': {
                    const len = parseInt(block.length, 10) || 4;
                    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                    let res = "";
                    for (let i = 0; i < len; i++) {
                        res += getRandomCharFromSet(charset, !!block.excludeConfusing);
                    }
                    return res;
                }

                case 'sequential_number': {
                    const currentSeq = context.sequence !== undefined ? Number(context.sequence) : (Number(block.startingNumber) || 1);
                    const len = parseInt(block.length, 10) || 6;
                    const padChar = block.padChar || '0';
                    return String(currentSeq).padStart(len, padChar);
                }

                case 'timestamp': {
                    const d = context.date ? new Date(context.date) : new Date();
                    const fmt = block.format || 'HHmmss';
                    const yyyy = String(d.getFullYear());
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    const hh = String(d.getHours()).padStart(2, '0');
                    const min = String(d.getMinutes()).padStart(2, '0');
                    const ss = String(d.getSeconds()).padStart(2, '0');

                    return fmt
                        .replace(/YYYY/g, yyyy)
                        .replace(/YY/g, yyyy.slice(-2))
                        .replace(/MM/g, mm)
                        .replace(/DD/g, dd)
                        .replace(/HH/g, hh)
                        .replace(/mm/g, min)
                        .replace(/ss/g, ss);
                }

                case 'date_based': {
                    const d = context.date ? new Date(context.date) : new Date();
                    const fmt = block.format || 'YYMMDD';
                    const yyyy = String(d.getFullYear());
                    const yy = yyyy.slice(-2);
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    
                    // Simple ISO week calculation
                    const target = new Date(d.valueOf());
                    const dayNr = (d.getDay() + 6) % 7;
                    target.setDate(target.getDate() - dayNr + 3);
                    const firstThursday = target.valueOf();
                    target.setMonth(0, 1);
                    if (target.getDay() !== 4) {
                        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                    }
                    const week = String(1 + Math.ceil((firstThursday - target) / 604800000)).padStart(2, '0');

                    return fmt
                        .replace(/YYYY/g, yyyy)
                        .replace(/YY/g, yy)
                        .replace(/MM/g, mm)
                        .replace(/DD/g, dd)
                        .replace(/WW/g, week);
                }

                case 'product_info': {
                    const p = context.product || {};
                    const field = block.productField || 'category';
                    let rawVal = '';
                    if (field === 'sku') rawVal = p.upcCode || p.uniqueId || '';
                    else if (field === 'category') rawVal = p.category || '';
                    else if (field === 'brand') rawVal = p.brand || p.manufacturer || 'PL';
                    else if (field === 'variation') rawVal = context.variation?.sizeFlavor || context.variation?.upcCode || '';
                    else rawVal = p[field] || '';

                    // Clean and truncate according to block length constraint if specified
                    const clean = String(rawVal).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                    if (block.length && parseInt(block.length, 10) > 0) {
                        return clean.substring(0, parseInt(block.length, 10)).padEnd(parseInt(block.length, 10), 'X');
                    }
                    return clean || 'GEN';
                }

                case 'custom_input': {
                    return String(context.customInput !== undefined ? context.customInput : (block.defaultValue || 'CUSTOM'));
                }

                case 'check_digit': {
                    // Check digit is calculated dynamically across preceding assembled string in assembleCode()
                    const prevAccum = String(context.accumulatedString || '');
                    const algo = block.algorithm || 'modulo10';
                    if (algo === 'modulo43') return String(calculateModulo43CheckDigit(prevAccum));
                    if (algo === 'luhn') return String(calculateLuhnCheckDigit(prevAccum));
                    return String(calculateModulo10CheckDigit(prevAccum));
                }

                default:
                    return String(block.value || '');
            }
        },

        assembleCode: (blocks = [], separatorConfig = {}, context = {}) => {
            const prefix = separatorConfig.prefix || '';
            const suffix = separatorConfig.suffix || '';
            const globalSep = separatorConfig.globalSeparator !== undefined ? separatorConfig.globalSeparator : '-';
            const fixedLen = parseInt(separatorConfig.fixedLength, 10) || 0;

            const evaluatedSegments = [];

            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                if (b.visible === false) continue;

                // Evaluate block value (pass accumulated string for dynamic check digits)
                const accumulatedSoFar = prefix + evaluatedSegments.join('');
                const blockVal = getCodeStudioService(wsId).generateBlockValue(b, {
                    ...context,
                    accumulatedString: accumulatedSoFar
                });

                evaluatedSegments.push({
                    val: blockVal,
                    customSep: (b.separator !== undefined && b.separator !== null) ? b.separator : null
                });
            }

            // Build core body with separators
            let body = '';
            for (let i = 0; i < evaluatedSegments.length; i++) {
                body += evaluatedSegments[i].val;
                if (i < evaluatedSegments.length - 1) {
                    const sep = evaluatedSegments[i].customSep !== null ? evaluatedSegments[i].customSep : globalSep;
                    if (sep && sep !== 'none') {
                        body += sep;
                    }
                }
            }

            // Connect prefix and suffix respecting global separator when present
            let result = '';
            if (prefix) {
                result += prefix;
                if (body) {
                    // If global separator is set, and prefix does not end with it and body doesn't start with it, link with separator
                    if (globalSep && globalSep !== 'none' && !prefix.endsWith(globalSep) && !body.startsWith(globalSep)) {
                        result += globalSep;
                    }
                }
            }

            result += body;

            if (suffix) {
                if (result && globalSep && globalSep !== 'none' && !result.endsWith(globalSep) && !suffix.startsWith(globalSep)) {
                    result += globalSep;
                }
                result += suffix;
            }

            // Enforce fixed character length if set
            if (fixedLen > 0) {
                if (result.length > fixedLen) {
                    result = result.substring(0, fixedLen);
                } else if (result.length < fixedLen) {
                    result = result.padEnd(fixedLen, '0');
                }
            }

            return result;
        },

        // =====================================================================
        // 2. ATOMIC SEQUENCE COUNTER ENGINE (Strictly monotonic, sequence must not reverse)
        // =====================================================================
        atomicGetNextSequence: async (sequenceKey = 'default_supermarket', step = 1, startingNumber = 1) => {
            const allSeqs = await sequencesRepo.getAll();
            const existing = allSeqs.find(s => s.sequenceKey === sequenceKey || s.id === sequenceKey);
            const realWsId = getRealWorkspaceId();

            let nextSeqNum = startingNumber;
            if (existing && existing.id) {
                nextSeqNum = Number(existing.currentValue || 0) + step;
                await sequencesRepo.update(existing.id, {
                    currentValue: nextSeqNum,
                    sequenceKey,
                    workspaceId: realWsId,
                    connectionId: existing.connectionId || 'unlinked',
                    lastAllocatedAt: Date.now(),
                    step,
                    updatedAt: Date.now()
                });
            } else {
                const newId = `seq-${generateUniqueId()}`;
                await sequencesRepo.add({
                    id: newId,
                    workspaceId: realWsId,
                    sequenceKey,
                    currentValue: startingNumber,
                    step,
                    connectionId: 'unlinked',
                    createdAt: Date.now(),
                    lastAllocatedAt: Date.now()
                });
                nextSeqNum = startingNumber;
            }

            return nextSeqNum;
        },

        getSequenceStatus: async (sequenceKey = 'default_supermarket') => {
            const allSeqs = await sequencesRepo.getAll();
            const record = allSeqs.find(s => s.sequenceKey === sequenceKey || s.id === sequenceKey);
            return record ? Number(record.currentValue || 0) : 0;
        },

        resetSequenceCounter: async (sequenceKey = 'default_supermarket', resetValue = 1) => {
            const allSeqs = await sequencesRepo.getAll();
            const record = allSeqs.find(s => s.sequenceKey === sequenceKey || s.id === sequenceKey);
            const realWsId = getRealWorkspaceId();
            if (record) {
                await sequencesRepo.update(record.id, {
                    currentValue: resetValue,
                    workspaceId: realWsId,
                    lastAllocatedAt: Date.now(),
                    updatedAt: Date.now()
                });
            } else {
                await sequencesRepo.add({
                    id: `seq-${generateUniqueId()}`,
                    workspaceId: realWsId,
                    sequenceKey,
                    currentValue: resetValue,
                    connectionId: 'unlinked',
                    createdAt: Date.now(),
                    lastAllocatedAt: Date.now()
                });
            }
        },

        // =====================================================================
        // 3. COLLISION DETECTION & CODE RESERVATION
        // Verifies against: Products (catalog + variations) AND Invoices (customer + business)
        // Never reuse second time if product or invoice exists with this code
        // =====================================================================
        checkCodeUniqueness: async (candidateCode, excludeProductId = null, excludeInvoiceId = null) => {
            const clean = String(candidateCode || '').trim();
            if (!clean) return { isUnique: false, conflictType: 'empty', message: 'Code is empty' };

            // 1. Check active product catalog (including uniqueId and all variations)
            try {
                const allProducts = await productsRepo.getAll();
                for (const p of allProducts) {
                    if (excludeProductId && p.id === excludeProductId) continue;
                    if (!p.isArchive) {
                        if (p.upcCode && p.upcCode.trim().toLowerCase() === clean.toLowerCase()) {
                            return { isUnique: false, conflictType: 'product', conflictingItem: p, message: `Code already in use by product: "${p.name}"` };
                        }
                        if (p.uniqueId && p.uniqueId.trim().toLowerCase() === clean.toLowerCase()) {
                            return { isUnique: false, conflictType: 'product_id', conflictingItem: p, message: `Code matches unique ID of product: "${p.name}"` };
                        }
                        // Check variations
                        if (Array.isArray(p.variations)) {
                            for (const v of p.variations) {
                                if (v.upcCode && v.upcCode.trim().toLowerCase() === clean.toLowerCase()) {
                                    return { isUnique: false, conflictType: 'variation', conflictingItem: { product: p, variation: v }, message: `Code already in use by variation: "${p.name} (${v.sizeFlavor || ''})"` };
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("Error checking product code uniqueness:", e);
            }

            // 2. Check Customer Invoices & Business Invoices (Cross-usage collision guard)
            try {
                const [custInvoices, busInvoices] = await Promise.all([
                    customerInvoiceRepo.getAll().catch(() => []),
                    businessInvoiceRepo.getAll().catch(() => [])
                ]);
                const allInvoices = [...(custInvoices || []), ...(busInvoices || [])];
                for (const inv of allInvoices) {
                    if (excludeInvoiceId && (inv.id === excludeInvoiceId || inv.uniqueId === excludeInvoiceId)) continue;
                    const invNums = [inv.invoiceNumber, inv.busInvNumber, inv.uniqueId].filter(Boolean).map(s => String(s).trim().toLowerCase());
                    if (invNums.includes(clean.toLowerCase())) {
                        return { isUnique: false, conflictType: 'invoice', conflictingItem: inv, message: `Code already in use by invoice: "${inv.invoiceNumber || inv.busInvNumber || inv.id}"` };
                    }
                }
            } catch (e) {
                console.warn("Error checking invoice code uniqueness:", e);
            }

            // 3. Check Committed Code History (Codes linked to products/invoices can never be reused)
            try {
                const allHistory = await historyRepo.getAll();
                for (const h of allHistory) {
                    if (h.code && h.code.trim().toLowerCase() === clean.toLowerCase()) {
                        if (h.event === 'committed' || (h.connectionId && h.connectionId !== 'unlinked' && h.connectionId !== 'draft')) {
                            return { isUnique: false, conflictType: 'committed_history', conflictingItem: h, message: `Code already committed to ${h.purpose || 'record'} (${h.connectionId})` };
                        }
                    }
                }
            } catch (e) {
                console.warn("Error checking history code uniqueness:", e);
            }

            // 4. Check active pending reservations (prune expired reservations older than 2 hours)
            try {
                const allRes = await reservationsRepo.getAll();
                const now = Date.now();
                for (const r of allRes) {
                    if (r.code && r.code.trim().toLowerCase() === clean.toLowerCase()) {
                        if (r.expiresAt && r.expiresAt > now) {
                            return { isUnique: false, conflictType: 'reservation', conflictingItem: r, message: `Code currently reserved by session: ${r.purpose || 'Draft'}` };
                        }
                    }
                }
            } catch (e) {}

            return { isUnique: true, conflictType: null, message: 'Code is unique and available' };
        },

        reserveCode: async (code, purpose = 'product_creation', ttlMinutes = 60, metadata = {}) => {
            const resId = `res-${generateUniqueId()}`;
            const realWsId = getRealWorkspaceId();
            const record = {
                id: resId,
                workspaceId: realWsId,
                code: String(code).trim(),
                connectionId: metadata.connectionId || metadata.productId || metadata.invoiceNumber || 'unlinked',
                purpose,
                metadata,
                createdAt: Date.now(),
                expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
            };
            await reservationsRepo.add(record);
            return record;
        },

        releaseReservation: async (code) => {
            const allRes = await reservationsRepo.getAll();
            const clean = String(code).trim().toLowerCase();
            for (const r of allRes) {
                if (r.code && r.code.trim().toLowerCase() === clean) {
                    await reservationsRepo.delete(r.id);
                }
            }
        },

        commitReservedCode: async (code, targetId, targetType = 'product') => {
            await getCodeStudioService(wsId).releaseReservation(code);
            // Log & link to generation audit history
            await getCodeStudioService(wsId).linkCodeToTarget(code, targetId, targetType);
        },

        // =====================================================================
        // 4. CODE GENERATION TEMPLATES CRUD
        // =====================================================================
        getAllTemplates: async (includeArchived = false) => {
            let templates = await templatesRepo.getAll();
            if (!templates || templates.length === 0) {
                // Check if legacy templates exist in CodeTemplates
                try {
                    const legacy = await codeTemplatesRepo.getAll();
                    if (legacy && legacy.length > 0) {
                        templates = legacy;
                        for (const t of legacy) {
                            await templatesRepo.add(t).catch(() => {});
                        }
                    }
                } catch (e) {}
            }
            if (!templates || templates.length === 0) {
                for (const t of DEFAULT_CODE_TEMPLATES) {
                    const rec = { ...t, workspaceId: wsId, isArchived: false, createdAt: Date.now(), updatedAt: Date.now() };
                    await templatesRepo.add(rec);
                    await codeTemplatesRepo.add(rec).catch(() => {});
                }
                templates = await templatesRepo.getAll();
            }

            if (!includeArchived) {
                templates = templates.filter(t => !t.isArchived);
            }
            return templates.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        },

        getTemplateById: async (id) => {
            const all = await getCodeStudioService(wsId).getAllTemplates(true);
            return all.find(t => t.id === id);
        },

        getDefaultTemplate: async () => {
            const all = await getCodeStudioService(wsId).getAllTemplates(false);
            return all.find(t => t.isDefault) || all[0] || DEFAULT_CODE_TEMPLATES[0];
        },

        setDefaultTemplate: async (id) => {
            const all = await templatesRepo.getAll();
            for (const t of all) {
                const shouldBeDefault = (t.id === id);
                if (t.isDefault !== shouldBeDefault) {
                    await templatesRepo.update(t.id, { isDefault: shouldBeDefault, updatedAt: Date.now() });
                    await codeTemplatesRepo.update(t.id, { isDefault: shouldBeDefault, updatedAt: Date.now() }).catch(() => {});
                }
            }
        },

        saveTemplate: async (templateData) => {
            if (!templateData.name || !templateData.name.trim()) {
                throw new Error("Template name is required.");
            }

            if (templateData.id) {
                const existing = await templatesRepo.getById(templateData.id) || await codeTemplatesRepo.getById(templateData.id);
                if (existing) {
                    if (existing.isSystemLocked || existing.id === 'tmpl-standard-product-code') {
                        throw new Error("Default Standard Product Code template is permanently locked and cannot be customized.");
                    }
                    const updatePayload = {
                        ...templateData,
                        updatedAt: Date.now()
                    };
                    await templatesRepo.update(templateData.id, updatePayload);
                    await codeTemplatesRepo.update(templateData.id, updatePayload).catch(() => {});
                    return templateData.id;
                }
            }

            const newId = `tmpl-${generateUniqueId()}`;
            const newRecord = {
                ...templateData,
                id: newId,
                workspaceId: wsId,
                isDefault: !!templateData.isDefault,
                isSystemLocked: false,
                isArchived: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await templatesRepo.add(newRecord);
            await codeTemplatesRepo.add(newRecord).catch(() => {});
            return newId;
        },

        duplicateTemplate: async (id) => {
            const source = await getCodeStudioService(wsId).getTemplateById(id);
            if (!source) throw new Error("Source template not found.");

            const duplicate = {
                ...source,
                id: `tmpl-${generateUniqueId()}`,
                name: `${source.name} (Copy)`,
                isDefault: false,
                isSystemLocked: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await templatesRepo.add(duplicate);
            await codeTemplatesRepo.add(duplicate).catch(() => {});
            return duplicate;
        },

        archiveTemplate: async (id) => {
            const existing = await getCodeStudioService(wsId).getTemplateById(id);
            if (existing && (existing.isSystemLocked || existing.id === 'tmpl-standard-product-code')) {
                throw new Error("Default Standard Product Code template cannot be archived or deleted.");
            }
            await templatesRepo.update(id, { isArchived: true, isDefault: false, updatedAt: Date.now() });
            await codeTemplatesRepo.update(id, { isArchived: true, isDefault: false, updatedAt: Date.now() }).catch(() => {});
        },

        restoreTemplate: async (id) => {
            await templatesRepo.update(id, { isArchived: false, updatedAt: Date.now() });
            await codeTemplatesRepo.update(id, { isArchived: false, updatedAt: Date.now() }).catch(() => {});
        },

        deleteTemplate: async (id) => {
            const existing = await getCodeStudioService(wsId).getTemplateById(id);
            if (existing && (existing.isSystemLocked || existing.id === 'tmpl-standard-product-code')) {
                throw new Error("Default Standard Product Code template is permanent and cannot be deleted.");
            }
            await templatesRepo.delete(id);
            await codeTemplatesRepo.delete(id).catch(() => {});
        },

        // =====================================================================
        // 5. AUDIT HISTORY & GENERATION LOGGING
        // =====================================================================
        // =====================================================================
        // 5. AUDIT HISTORY, GENERATION LOGGING & CODE CONNECTION
        // Stores: barcode, timestamp, connectionID (*wherelinked), workspaceId (real ID)
        // =====================================================================
        logCodeGeneration: async ({
            code,
            barcode = null,
            format = 'Code 128',
            templateId = null,
            templateName = 'Custom Builder',
            connectionId = null,
            productId = null,
            productName = null,
            invoiceId = null,
            invoiceNumber = null,
            purpose = null,
            event = 'generated',
            generatedBy = 'admin'
        }) => {
            const finalCode = String(code || barcode || '').trim();
            if (!finalCode) return null;
            const realWsId = getRealWorkspaceId();
            const resolvedConnId = connectionId || productId || invoiceNumber || invoiceId || 'unlinked';
            const resolvedPurpose = purpose || (invoiceNumber || invoiceId ? 'invoice' : (productId ? 'product' : 'general'));

            const record = {
                id: `hist-${generateUniqueId()}`,
                workspaceId: realWsId,
                barcode: finalCode,
                code: finalCode,
                format,
                templateId,
                templateName,
                connectionId: resolvedConnId,
                productId: productId || null,
                productName: productName || null,
                invoiceNumber: invoiceNumber || (resolvedPurpose === 'invoice' ? resolvedConnId : null),
                purpose: resolvedPurpose,
                event,
                generatedBy,
                timestamp: Date.now(),
                createdAt: new Date().toISOString()
            };
            await historyRepo.add(record);
            return record;
        },

        linkCodeToTarget: async (code, connectionId, targetType = 'product') => {
            const clean = String(code || '').trim();
            if (!clean || !connectionId) return;
            const realWsId = getRealWorkspaceId();

            try {
                const allHistory = await historyRepo.getAll();
                let updated = false;

                for (const h of allHistory) {
                    if (h.code && h.code.trim().toLowerCase() === clean.toLowerCase()) {
                        await historyRepo.update(h.id, {
                            connectionId: String(connectionId).trim(),
                            workspaceId: realWsId,
                            event: 'committed',
                            targetType,
                            purpose: targetType,
                            linkedAt: Date.now(),
                            updatedAt: Date.now()
                        });
                        updated = true;
                    }
                }

                if (!updated) {
                    await historyRepo.add({
                        id: `hist-${generateUniqueId()}`,
                        workspaceId: realWsId,
                        barcode: clean,
                        code: clean,
                        connectionId: String(connectionId).trim(),
                        format: targetType === 'invoice' ? 'Invoice Number' : 'Product Barcode',
                        templateName: targetType === 'invoice' ? 'Invoice Coder' : 'Product Barcode',
                        purpose: targetType,
                        event: 'committed',
                        generatedBy: 'admin',
                        timestamp: Date.now(),
                        linkedAt: Date.now(),
                        createdAt: new Date().toISOString()
                    });
                }

                // Release temporary reservations if any
                await getCodeStudioService(wsId).releaseReservation(clean);
            } catch (e) {
                console.warn("Could not link code to target:", e);
            }
        },

        // =====================================================================
        // UNUSED CODE REUSE & MONOTONIC SEQUENCE ALLOCATION
        // "Else if code generated but never uses anywhere than it will use next time."
        // "secuence must not reverse."
        // =====================================================================
        allocateNextCodeForTemplate: async (templateId, purpose = 'invoice', currentTargetId = null) => {
            const svc = getCodeStudioService(wsId);
            const template = (templateId ? await svc.getTemplateById(templateId) : null) || await svc.getDefaultTemplate();
            if (!template) throw new Error("Template not found");

            // 1. Check if an uncommitted, unused code already exists for this template
            // "Else if code generated but never uses anywhere than it will use next time."
            try {
                const allHistory = await historyRepo.getAll();
                const unusedHistory = allHistory
                    .filter(h => h.templateId === template.id && (!h.connectionId || h.connectionId === 'unlinked' || h.connectionId === 'draft') && h.event !== 'committed')
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                for (const item of unusedHistory) {
                    const check = await svc.checkCodeUniqueness(item.code);
                    if (check.isUnique) {
                        // Reuse this previously generated code without advancing the sequence
                        return {
                            code: item.code,
                            template,
                            isReused: true,
                            historyId: item.id
                        };
                    }
                }
            } catch (e) {
                console.warn("Could not check unused history:", e);
            }

            // 2. Generate a new unique code moving the sequence forward ("secuence must not reverse")
            const seqKey = template.sequenceKey || template.id || 'default_sequence';
            let candidateCode = '';
            let isUnique = false;
            let attempts = 0;

            const hasSeqBlock = (template.blocks || []).some(b => b.type === 'sequential_number');
            const seqBlock = hasSeqBlock ? (template.blocks || []).find(b => b.type === 'sequential_number') : null;
            const startingNum = seqBlock ? (Number(seqBlock.startingNumber) || 1) : 1;
            const step = seqBlock ? (Number(seqBlock.step) || 1) : 1;

            while (!isUnique && attempts < 25) {
                attempts++;
                let seqVal = undefined;
                if (hasSeqBlock) {
                    seqVal = await svc.atomicGetNextSequence(seqKey, step, startingNum);
                }

                candidateCode = svc.assembleCode(template.blocks, template, {
                    sequence: seqVal
                });

                const check = await svc.checkCodeUniqueness(candidateCode);
                if (check.isUnique) {
                    isUnique = true;
                }
            }

            if (!isUnique) {
                candidateCode = `${candidateCode}-${Date.now().toString().slice(-4)}`;
            }

            // Log new code to CodeHistory on server
            const histRec = await svc.logCodeGeneration({
                code: candidateCode,
                format: template.name,
                templateId: template.id,
                templateName: template.name,
                connectionId: currentTargetId || 'unlinked',
                purpose,
                event: 'generated'
            });

            return {
                code: candidateCode,
                template,
                isReused: false,
                historyId: histRec?.id
            };
        },

        getCodeHistory: async ({ limit = 100, format = null, search = '' } = {}) => {
            let all = await historyRepo.getAll();
            if (format) all = all.filter(h => h.format === format);
            if (search) {
                const q = search.toLowerCase();
                all = all.filter(h => 
                    (h.code || '').toLowerCase().includes(q) ||
                    (h.barcode || '').toLowerCase().includes(q) ||
                    (h.connectionId || '').toLowerCase().includes(q) ||
                    (h.productName || '').toLowerCase().includes(q) ||
                    (h.templateName || '').toLowerCase().includes(q)
                );
            }
            return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limit);
        },

        clearCodeHistory: async () => {
            const all = await historyRepo.getAll();
            for (const h of all) {
                await historyRepo.delete(h.id);
            }
        },

        // =====================================================================
        // 6. BATCH CODE GENERATION ENGINE
        // =====================================================================
        executeBatchGeneration: async ({
            templateId,
            count = 10,
            startSequence = 1,
            productIds = [],
            targetMode = 'free_pool', // 'free_pool' | 'existing_products' | 'variations'
            options = {}
        }) => {
            const svc = getCodeStudioService(wsId);
            const template = await svc.getTemplateById(templateId) || await svc.getDefaultTemplate();
            
            const results = [];
            let duplicatesCount = 0;
            let successCount = 0;
            let currentSeq = Number(startSequence) || 1;

            let targetItems = [];
            if (targetMode === 'existing_products') {
                const allProducts = await productsRepo.getAll();
                targetItems = allProducts.filter(p => !p.isArchive && (!productIds.length || productIds.includes(p.id)));
            } else if (targetMode === 'variations') {
                const allProducts = await productsRepo.getAll();
                for (const p of allProducts) {
                    if (!p.isArchive && Array.isArray(p.variations)) {
                        for (const v of p.variations) {
                            targetItems.push({ product: p, variation: v });
                        }
                    }
                }
            } else {
                // Free pool generation
                for (let i = 0; i < count; i++) {
                    targetItems.push({ index: i });
                }
            }

            for (let i = 0; i < targetItems.length; i++) {
                const item = targetItems[i];
                let candidateCode = '';
                let attempts = 0;
                let isUnique = false;

                while (!isUnique && attempts < 5) {
                    attempts++;
                    candidateCode = svc.assembleCode(template.blocks, template, {
                        sequence: currentSeq,
                        product: item.product || {},
                        variation: item.variation || {}
                    });

                    // Collision detection check
                    const check = await svc.checkCodeUniqueness(candidateCode);
                    if (check.isUnique) {
                        isUnique = true;
                    } else {
                        duplicatesCount++;
                        // Advance sequence to resolve collision
                        currentSeq++;
                    }
                }

                if (isUnique) {
                    successCount++;
                    // Reserve generated sequence safely
                    await svc.reserveCode(candidateCode, 'batch_job', 120, {
                        templateId: template.id,
                        targetMode,
                        targetId: item.product?.id || null
                    });

                    results.push({
                        rowNumber: i + 1,
                        code: candidateCode,
                        sequence: currentSeq,
                        status: 'Valid',
                        productName: item.product?.name || (targetMode === 'free_pool' ? `Unassigned Pool #${i + 1}` : 'N/A'),
                        sku: item.product?.upcCode || item.variation?.upcCode || '',
                        targetId: item.product?.id || null
                    });

                    currentSeq++;
                } else {
                    results.push({
                        rowNumber: i + 1,
                        code: candidateCode,
                        sequence: currentSeq,
                        status: 'Collision Failed',
                        productName: item.product?.name || 'Unassigned',
                        sku: item.product?.upcCode || '',
                        targetId: item.product?.id || null
                    });
                }
            }

            const batchId = `btch-${generateUniqueId()}`;
            const batchSummary = {
                id: batchId,
                workspaceId: wsId,
                templateId: template.id,
                templateName: template.name,
                totalRequested: targetItems.length,
                successful: successCount,
                duplicate: duplicatesCount,
                failed: targetItems.length - successCount,
                rows: results,
                createdAt: Date.now()
            };

            await batchesRepo.add(batchSummary);
            return batchSummary;
        }
    };
};

