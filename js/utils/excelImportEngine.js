/**
 * PriceLister - Excel & CSV Import Engine
 * Handles smart header detection, row validation, category auto-clustering,
 * color allocation, and batch Firestore synchronization.
 */

import { generateUniqueId } from './idGenerator.js';
import { getFirestore, collection, doc, writeBatch, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

// Curated palette of modern vibrant colors for newly detected categories
const CATEGORY_COLOR_PALETTE = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', 
    '#06b6d4', '#14b8a6', '#6366f1', '#f97316', '#84cc16', 
    '#0ea5e9', '#a855f7', '#d946ef', '#ef4444', '#64748b'
];

/**
 * Standard header mappings to normalize varied column naming conventions
 */
const COLUMN_ALIASES = {
    name: ['product name', 'product_name', 'item name', 'item_name', 'name', 'title', 'product', 'item', 'description of goods'],
    category: ['category', 'category name', 'cat', 'group', 'type', 'department', 'dept', 'classification'],
    sizeWeight: ['size/weight', 'size / weight', 'size_weight', 'size', 'weight', 'unit', 'pack size', 'pack_size', 'volume', 'net weight'],
    quantity: ['quantity', 'qty', 'stock', 'count', 'inventory', 'balance', 'units'],
    price: ['cost', 'cost price', 'cost_price', 'purchase price', 'buy price', 'buying price', 'purchase_rate'],
    basePrice: ['base price', 'base_price', 'baseprice', 'wholesale', 'wholesale price', 'trade price', 'b2b price'],
    mrp: ['mrp', 'max retail price', 'list price', 'maximum retail price', 'm.r.p.'],
    salePrice: ['price', 'sale price', 'saleprice', 'sale_price', 'selling price', 'selling_rate', 'retail price', 'rate', 'unit price', 'amount'],
    upcCode: ['upc code', 'upc', 'upc_code', 'barcode', 'bar code', 'code', 'ean', 'sku', 'isbn'],
    note: ['description', 'note', 'notes', 'details', 'info', 'comment', 'remarks'],
    mfgDate: ['mfg', 'mfg date', 'mfg_date', 'manufacturing date', 'manufacture date', 'prod date'],
    expDate: ['exp', 'exp date', 'exp_date', 'expiry', 'expiry date', 'expiration date'],
    uniqueId: ['product id', 'product_id', 'id', 'item id', 'unique id', 'unique_id', 'code_id']
};

/**
 * Parses raw file (XLSX, XLS, CSV) into 2D rows
 */
export const parseExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
        if (!window.XLSX) {
            reject(new Error("SheetJS (XLSX) library is not loaded. Please check your internet connection."));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = window.XLSX.read(data, { type: 'array', cellDates: true });
                
                // Read the first active sheet
                const firstSheetName = workbook.SheetNames[0];
                if (!firstSheetName) {
                    throw new Error("The selected Excel file has no worksheets.");
                }
                
                const worksheet = workbook.Sheets[firstSheetName];
                // Get raw 2D array representation
                const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                
                if (!rawRows || rawRows.length === 0) {
                    throw new Error("The Excel sheet is empty.");
                }

                resolve(rawRows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file from disk."));
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Finds the header row and returns mapped column indices with smart data inspection
 */
const detectHeaderMapping = (rawRows) => {
    let bestRowIdx = 0;
    let maxMatchCount = 0;

    // 1. First pass: Locate the row with the most header-like text
    for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;

        let matches = 0;
        row.forEach((cellVal) => {
            if (cellVal == null) return;
            const str = String(cellVal).trim().toLowerCase();
            if (!str) return;

            // Check if matches variation
            if (/^var(?:iation)?\s*\d+/i.test(str)) {
                matches++;
                return;
            }

            for (const [, aliases] of Object.entries(COLUMN_ALIASES)) {
                if (aliases.some(alias => str === alias || (alias.length > 4 && str.includes(alias)))) {
                    matches++;
                    break;
                }
            }
        });

        if (matches > maxMatchCount) {
            maxMatchCount = matches;
            bestRowIdx = r;
        }
    }

    const headerRow = rawRows[bestRowIdx] || [];
    const dataRows = rawRows.slice(bestRowIdx + 1);

    const mapping = {};
    const nameCandidates = [];
    const salePriceCandidates = [];
    const categoryCandidates = [];

    // Helper to count non-empty data cells in a column
    const countColumnData = (colIdx) => {
        let count = 0;
        for (let i = 0; i < Math.min(dataRows.length, 50); i++) {
            const val = dataRows[i] ? dataRows[i][colIdx] : null;
            if (val !== null && val !== undefined && String(val).trim() !== '') {
                count++;
            }
        }
        return count;
    };

    headerRow.forEach((cellVal, colIdx) => {
        if (cellVal == null) return;
        const str = String(cellVal).trim().toLowerCase();
        if (!str) return;

        // 1. Check for Variation columns FIRST (Strict regex so they never steal "name" or "upc")
        const varNameMatch = str.match(/^var(?:iation)?\s*(\d+)\s*(?:name|flavor|size)?$/i) 
            || str.match(/^var(?:iation)?\s*(\d+)\s*name$/i)
            || str.match(/^var(?:iation)?\s*(\d+)\s*flavor$/i)
            || str.match(/^var(?:iation)?\s*(\d+)\s*size$/i);

        if (varNameMatch) {
            const varNum = parseInt(varNameMatch[1], 10);
            mapping[`var_${varNum}_name`] = colIdx;
            return; // Skip standard alias matching
        }

        const varUpcMatch = str.match(/^var(?:iation)?\s*(\d+)\s*(?:upc|barcode|code)$/i);
        if (varUpcMatch) {
            const varNum = parseInt(varUpcMatch[1], 10);
            mapping[`var_${varNum}_upc`] = colIdx;
            return; // Skip standard alias matching
        }

        // 2. Collect candidates for Product Name (Prioritize 'product name' over generic 'name')
        if (str === 'product name' || str === 'product_name' || str === 'item name' || str === 'item_name') {
            nameCandidates.push({ colIdx, priority: 10, str });
            return;
        } else if (str === 'name' || str === 'product' || str === 'item' || str === 'title' || str === 'description of goods') {
            nameCandidates.push({ colIdx, priority: 5, str });
            return;
        }

        // 3. Collect candidates for Category
        if (str === 'category' || str === 'category name' || str === 'group' || str === 'type' || str === 'dept') {
            categoryCandidates.push({ colIdx, priority: str === 'category' ? 10 : 5, str });
            return;
        }

        // 4. Collect candidates for Sale Price
        if (str === 'sale price' || str === 'saleprice' || str === 'sale_price' || str === 'selling price' || str === 'retail price') {
            salePriceCandidates.push({ colIdx, priority: 10, str });
            return;
        } else if (str === 'price' || str === 'rate' || str === 'amount') {
            salePriceCandidates.push({ colIdx, priority: 5, str });
            return;
        }

        // 5. Match other standard fields
        for (const [canonicalField, aliases] of Object.entries(COLUMN_ALIASES)) {
            if (canonicalField === 'name' || canonicalField === 'category' || canonicalField === 'salePrice') continue;
            if (mapping[canonicalField] === undefined && aliases.some(alias => str === alias || (alias.length > 4 && str.includes(alias)))) {
                mapping[canonicalField] = colIdx;
                break;
            }
        }
    });

    // Smart Disambiguation for Product Name:
    // If col 1 is 'Product Name' and col 2 is 'Name', check if col 1 has data. If col 1 has no data but col 2 does, choose col 2!
    if (nameCandidates.length > 0) {
        let bestNameCandidate = null;
        let highestScore = -1;

        nameCandidates.forEach(cand => {
            const dataCount = countColumnData(cand.colIdx);
            // Combined score = priority * 10 + data presence weight
            const score = (dataCount > 0 ? 100 : 0) + (dataCount * 2) + cand.priority;
            if (score > highestScore) {
                highestScore = score;
                bestNameCandidate = cand;
            }
        });

        if (bestNameCandidate) {
            mapping.name = bestNameCandidate.colIdx;
        }
    }

    // Smart Disambiguation for Category:
    if (categoryCandidates.length > 0) {
        let bestCatCandidate = null;
        let highestScore = -1;
        categoryCandidates.forEach(cand => {
            const dataCount = countColumnData(cand.colIdx);
            const score = (dataCount > 0 ? 100 : 0) + (dataCount * 2) + cand.priority;
            if (score > highestScore) {
                highestScore = score;
                bestCatCandidate = cand;
            }
        });
        if (bestCatCandidate) mapping.category = bestCatCandidate.colIdx;
    }

    // Smart Disambiguation for Sale Price:
    if (salePriceCandidates.length > 0) {
        let bestSaleCandidate = null;
        let highestScore = -1;
        salePriceCandidates.forEach(cand => {
            const dataCount = countColumnData(cand.colIdx);
            const score = (dataCount > 0 ? 100 : 0) + (dataCount * 2) + cand.priority;
            if (score > highestScore) {
                highestScore = score;
                bestSaleCandidate = cand;
            }
        });
        if (bestSaleCandidate) mapping.salePrice = bestSaleCandidate.colIdx;
    }

    return {
        headerRowIndex: bestRowIdx,
        columnMap: mapping,
        confidence: maxMatchCount
    };
};

/**
 * Clean numeric string/values safely
 */
const parseNumericSafe = (val, defaultValue = 0) => {
    if (val === null || val === undefined || val === '') return defaultValue;
    if (typeof val === 'number') return isNaN(val) ? defaultValue : val;
    
    // Strip currency symbols and commas
    const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Formats dates safely to YYYY-MM-DD
 */
const formatDateSafe = (val) => {
    if (!val) return '';
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    return String(val).trim();
};

/**
 * Analyzes raw rows, checks validation, categorizes groups, and creates canonical map
 */
export const analyzeAndValidateRows = (rawRows, existingCategories = [], existingProducts = []) => {
    const { headerRowIndex, columnMap } = detectHeaderMapping(rawRows);
    
    // Existing categories lookup maps:
    const existingById = new Map();
    const existingByName = new Map();
    
    existingCategories.forEach(cat => {
        if (cat.uniqueId) existingById.set(cat.uniqueId, cat);
        if (cat.name) existingByName.set(cat.name.trim().toLowerCase(), cat);
    });

    const existingProductNames = new Set(existingProducts.map(p => p.name?.trim().toLowerCase()).filter(Boolean));

    // 1. First pass: Collect all valid category occurrences to compute frequency & best casing
    const categoryFrequencyMap = new Map(); // key: lowercase -> { count: number, casings: Map<string, number> }

    const dataRows = rawRows.slice(headerRowIndex + 1);
    
    dataRows.forEach((row) => {
        if (!row || row.every(c => c === '' || c === null || c === undefined)) return; // skip totally empty lines

        const catCol = columnMap.category;
        const rawCat = catCol !== undefined ? String(row[catCol] || '').trim() : '';

        if (rawCat) {
            const lower = rawCat.toLowerCase();
            if (!categoryFrequencyMap.has(lower)) {
                categoryFrequencyMap.set(lower, { count: 0, casings: new Map() });
            }
            const info = categoryFrequencyMap.get(lower);
            info.count += 1;
            info.casings.set(rawCat, (info.casings.get(rawCat) || 0) + 1);
        }
    });

    // Determine canonical category mapping
    // key: lowercase -> { canonicalName, isExisting, categoryId, color, isNew, count }
    const canonicalCategoryMap = new Map();
    let nextColorIdx = Math.floor(Math.random() * CATEGORY_COLOR_PALETTE.length);

    categoryFrequencyMap.forEach((info, lowerKey) => {
        // Pick the casing with highest frequency (e.g. "Fruit" over "FruIT" or "fruit")
        let bestCasing = '';
        let highestCount = -1;
        info.casings.forEach((cnt, casing) => {
            if (cnt > highestCount) {
                highestCount = cnt;
                bestCasing = casing;
            }
        });
        // Capitalize first letter nicely if all lower
        if (bestCasing === bestCasing.toLowerCase()) {
            bestCasing = bestCasing.charAt(0).toUpperCase() + bestCasing.slice(1);
        }

        // Check if matching in existing categories
        if (existingByName.has(lowerKey)) {
            const existing = existingByName.get(lowerKey);
            canonicalCategoryMap.set(lowerKey, {
                canonicalName: existing.name,
                isExisting: true,
                categoryId: existing.uniqueId || existing.id,
                color: existing.color || '#10b981',
                count: info.count,
                isNew: false
            });
        } else {
            // New category will be created with fresh uniqueId & pleasant color
            const assignedColor = CATEGORY_COLOR_PALETTE[nextColorIdx % CATEGORY_COLOR_PALETTE.length];
            nextColorIdx++;
            const generatedCatId = generateUniqueId('CAT');

            canonicalCategoryMap.set(lowerKey, {
                canonicalName: bestCasing,
                isExisting: false,
                categoryId: generatedCatId,
                color: assignedColor,
                count: info.count,
                isNew: true
            });
        }
    });

    // 2. Second Pass: Detailed validation for each row
    const parsedRows = [];
    let validCount = 0;
    let skippedCount = 0;

    dataRows.forEach((row, relIdx) => {
        const actualRowNumber = headerRowIndex + 2 + relIdx; // 1-based spreadsheet row number
        
        // Skip totally blank rows
        if (!row || row.every(c => c === '' || c === null || c === undefined)) {
            return;
        }

        const errors = [];

        // Extract Name
        const nameCol = columnMap.name;
        const nameVal = nameCol !== undefined ? String(row[nameCol] || '').trim() : '';
        if (!nameVal) {
            errors.push("Missing required Product Name");
        }

        // Extract Category
        const catCol = columnMap.category;
        const rawCategory = catCol !== undefined ? String(row[catCol] || '').trim() : '';
        if (!rawCategory) {
            errors.push("Missing required Category");
        }

        // Extract Sale Price
        const saleCol = columnMap.salePrice;
        const rawSalePrice = saleCol !== undefined ? row[saleCol] : '';
        const salePrice = parseNumericSafe(rawSalePrice, 0);
        if (salePrice <= 0 || (rawSalePrice === '' && rawSalePrice !== 0)) {
            errors.push("Missing or invalid Sale Price (must be > 0)");
        }

        // Optional Fields
        const sizeWeight = columnMap.sizeWeight !== undefined ? String(row[columnMap.sizeWeight] || '').trim() : '';
        const quantity = parseNumericSafe(columnMap.quantity !== undefined ? row[columnMap.quantity] : 0, 0);
        const costPrice = parseNumericSafe(columnMap.price !== undefined ? row[columnMap.price] : 0, 0);
        const basePrice = parseNumericSafe(columnMap.basePrice !== undefined ? row[columnMap.basePrice] : 0, 0);
        const mrp = parseNumericSafe(columnMap.mrp !== undefined ? row[columnMap.mrp] : 0, 0);
        const upcCode = columnMap.upcCode !== undefined ? String(row[columnMap.upcCode] || '').trim() : '';
        const note = columnMap.note !== undefined ? String(row[columnMap.note] || '').trim() : '';
        const mfgDate = formatDateSafe(columnMap.mfgDate !== undefined ? row[columnMap.mfgDate] : '');
        const expDate = formatDateSafe(columnMap.expDate !== undefined ? row[columnMap.expDate] : '');
        
        // Variations parsing (Var 1..10)
        const variations = [];
        for (let v = 1; v <= 10; v++) {
            const vNameCol = columnMap[`var_${v}_name`];
            const vUpcCol = columnMap[`var_${v}_upc`];
            if (vNameCol !== undefined || vUpcCol !== undefined) {
                const vName = vNameCol !== undefined ? String(row[vNameCol] || '').trim() : '';
                const vUpc = vUpcCol !== undefined ? String(row[vUpcCol] || '').trim() : '';
                if (vName || vUpc) {
                    variations.push({ sizeFlavor: vName, upcCode: vUpc });
                }
            }
        }

        // Resolve Category Mapping
        const catMapping = rawCategory ? canonicalCategoryMap.get(rawCategory.toLowerCase()) : null;
        const resolvedCategoryId = catMapping ? catMapping.categoryId : '';
        const resolvedCategoryName = catMapping ? catMapping.canonicalName : rawCategory;
        const resolvedCategoryColor = catMapping ? catMapping.color : '#94a3b8';

        const isValid = errors.length === 0;
        if (isValid) {
            validCount++;
        } else {
            skippedCount++;
        }

        // Check if duplicate product name
        const isDuplicateName = isValid && existingProductNames.has(nameVal.toLowerCase());

        parsedRows.push({
            rowNumber: actualRowNumber,
            isValid,
            errors,
            isDuplicateName,
            rawCategory,
            resolvedCategoryName,
            resolvedCategoryId,
            resolvedCategoryColor,
            productData: {
                name: nameVal,
                category: resolvedCategoryId, // Stores Category uniqueId
                categoryName: resolvedCategoryName,
                sizeWeight,
                quantity: String(quantity),
                price: costPrice,
                salePrice: salePrice,
                basePrice: basePrice,
                mrp: mrp,
                upcCode: upcCode,
                note: note,
                mfgDate: mfgDate,
                expDate: expDate,
                variations: variations,
                imageUri: '',
                isArchive: false
            }
        });
    });

    const newCategoriesToCreate = Array.from(canonicalCategoryMap.values()).filter(c => c.isNew);
    const existingCategoriesMatched = Array.from(canonicalCategoryMap.values()).filter(c => !c.isNew);

    return {
        headerRowIndex,
        columnMap,
        summary: {
            totalParsedRows: parsedRows.length,
            validCount,
            skippedCount,
            newCategoriesCount: newCategoriesToCreate.length,
            existingCategoriesCount: existingCategoriesMatched.length
        },
        categoryMap: canonicalCategoryMap,
        newCategoriesToCreate,
        existingCategoriesMatched,
        parsedRows
    };
};

/**
 * Executes atomic batch import into Firestore
 */
export const executeBatchImport = async ({
    validRows,
    newCategoriesToCreate,
    workspaceId,
    creatorId,
    onProgress
}) => {
    if (!workspaceId) throw new Error("Missing Workspace ID");
    if (!validRows || validRows.length === 0) throw new Error("No valid products to import.");

    const now = Date.now();
    let importedProductsCount = 0;
    let createdCategoriesCount = 0;

    // 1. Create New Categories first
    if (newCategoriesToCreate && newCategoriesToCreate.length > 0) {
        if (onProgress) onProgress(`Creating ${newCategoriesToCreate.length} new categories...`, 10);
        
        const catBatch = writeBatch(db);
        newCategoriesToCreate.forEach(cat => {
            const catDocRef = doc(collection(db, `Workspaces/${workspaceId}/Categories`));
            catBatch.set(catDocRef, {
                uniqueId: cat.categoryId,
                name: cat.canonicalName,
                color: cat.color,
                creatorId: creatorId,
                timestamp: now,
                updatedTimestamp: now
            });
            createdCategoriesCount++;
        });
        await catBatch.commit();
    }

    // 2. Batch Insert Products in chunks of 250
    const CHUNK_SIZE = 250;
    const totalValid = validRows.length;

    for (let i = 0; i < totalValid; i += CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach(row => {
            const p = row.productData;
            const productDocRef = doc(collection(db, `Workspaces/${workspaceId}/Products`));
            
            const productDocData = {
                workspaceId: workspaceId,
                uniqueId: generateUniqueId(),
                name: p.name,
                category: p.category, // Stored as category uniqueId
                sizeWeight: p.sizeWeight || '',
                quantity: String(p.quantity ?? '0'),
                price: Number(p.price ?? 0),
                salePrice: Number(p.salePrice ?? 0),
                basePrice: Number(p.basePrice ?? 0),
                mrp: Number(p.mrp ?? 0),
                mfgDate: p.mfgDate || '',
                expDate: p.expDate || '',
                upcCode: p.upcCode || '',
                note: p.note || '',
                variations: p.variations || [],
                imageUri: p.imageUri || '',
                creatorId: creatorId,
                isArchive: false,
                timestamp: now,
                updatedTimestamp: now
            };

            batch.set(productDocRef, productDocData);
            importedProductsCount++;
        });

        const percent = Math.min(95, Math.round(15 + ((i + chunk.length) / totalValid) * 80));
        if (onProgress) onProgress(`Imported ${importedProductsCount} of ${totalValid} products...`, percent);
        
        await batch.commit();
    }

    // 3. Update Workspace Activity & Creator Contribution Counters
    if (onProgress) onProgress(`Updating workspace contribution metrics...`, 98);
    try {
        const wsRef = doc(db, `Workspaces/${workspaceId}`);
        await updateDoc(wsRef, {
            adminProductCount: increment(importedProductsCount),
            adminCategoryCount: increment(createdCategoriesCount)
        });
    } catch (e) {
        console.warn("Could not increment workspace admin counters:", e);
    }

    if (onProgress) onProgress(`Import Complete! Successfully added ${importedProductsCount} products.`, 100);

    return {
        importedProductsCount,
        createdCategoriesCount
    };
};
