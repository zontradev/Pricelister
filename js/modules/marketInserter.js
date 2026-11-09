import { authService } from '../../firebase/auth.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { generateUniqueId } from '../utils/idGenerator.js';
import { getAppCurrencySymbol, normalizeProductDate } from '../utilities.js';
import { storageService } from '../../supabase/storage.js';

/**
 * Market Inserter Module (Dedicated In-Page Section)
 * Fast spreadsheet grid inserting up to 300 products at once with live duplicate detection,
 * instant image picking, cell resizing (+/-), anti-insertion validation, and batch breakdown report.
 */
export const renderMarketInserter = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
        showAlert.error('You must be logged in to insert products.');
        return;
    }

    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    // Load existing categories and active products for duplicate detection
    let categories = [];
    let existingProducts = [];
    try {
        const [cList, pList] = await Promise.all([
            categoryService.getAllCategories().catch(() => []),
            productService.getAllActiveProducts().catch(() => [])
        ]);
        categories = cList || [];
        existingProducts = pList || [];
    } catch (e) {
        console.warn("Could not pre-fetch data for Market Inserter:", e);
    }

    // Check if products were transferred from catalog for batch updating
    const batchTransferRaw = sessionStorage.getItem('plister_market_batch_transfer');
    let transferredProducts = [];
    if (batchTransferRaw) {
        try {
            transferredProducts = JSON.parse(batchTransferRaw) || [];
        } catch (e) {
            console.warn('Failed to parse transferred products:', e);
        }
    }
    const isBatchUpdateMode = transferredProducts.length > 0;

    // Row model state store: Maximum 300 at once
    const MAX_ROWS = 300;
    let rowDataList = [];

    const createBlankRow = () => ({
        id: 'row_' + Math.random().toString(36).substring(2, 9),
        name: '',
        category: categories.length > 0 ? (categories[0].uniqueId || categories[0].id) : '',
        sizeWeight: '',
        quantity: 0,
        basePrice: 0,
        price: 0,
        salePrice: 0,
        mrp: 0,
        upcCode: '',
        mfgDate: '',
        expDate: '',
        note: '',
        imageFile: null,
        previewUrl: '',
        variations: []
    });

    if (isBatchUpdateMode) {
        rowDataList = transferredProducts.map(p => ({
            id: 'row_' + Math.random().toString(36).substring(2, 9),
            existingId: p.id,
            name: p.name || '',
            category: p.category || (categories.length > 0 ? (categories[0].uniqueId || categories[0].id) : ''),
            sizeWeight: p.sizeWeight || '',
            quantity: Number(p.quantity) || 0,
            basePrice: Number(p.basePrice) || 0,
            price: Number(p.price) || 0,
            salePrice: Number(p.salePrice) || 0,
            mrp: Number(p.mrp) || 0,
            upcCode: p.upcCode || '',
            mfgDate: p.mfgDate || '',
            expDate: p.expDate || '',
            note: p.note || '',
            imageFile: null,
            previewUrl: p.imageUri || '',
            imageUri: p.imageUri || '',
            variations: Array.isArray(p.variations) ? JSON.parse(JSON.stringify(p.variations)) : []
        }));
    } else {
        // Initialize with 1 clean blank row (user can add +1, +5, +10, etc.)
        rowDataList.push(createBlankRow());
    }

    // Snapshot of initial data for detecting unsaved changes in update mode
    const initialSnapshot = JSON.parse(JSON.stringify(rowDataList.map(r => ({
        name: r.name,
        category: r.category,
        sizeWeight: r.sizeWeight,
        quantity: r.quantity,
        basePrice: r.basePrice,
        price: r.price,
        salePrice: r.salePrice,
        mrp: r.mrp,
        upcCode: r.upcCode,
        mfgDate: r.mfgDate,
        expDate: r.expDate,
        note: r.note
    }))));

    // Column widths in pixels
    const DEFAULT_COL_WIDTHS = {
        index: 44,
        image: 76,
        name: 220,
        category: 160,
        sizeWeight: 110,
        quantity: 95,
        basePrice: 105,
        price: 105,
        salePrice: 125,
        mrp: 100,
        upcCode: 135,
        variations: 120,
        mfgDate: 115,
        expDate: 115,
        note: 160,
        action: 80
    };
    let colWidths = { ...DEFAULT_COL_WIDTHS };
    let selectedCell = { col: null, rowIdx: null, el: null, trEl: null };
    let isSubmitting = false;

    // Options Highlighter State: support highlighting multiple cells, columns, or rows for productivity
    const highlightState = {
        scope: 'cell', // 'cell' | 'col' | 'row'
        activeColor: 'green',
        cells: new Map(), // key: `${rowIdx}_${col}` -> colorInfo
        rows: new Map(),  // key: rowIdx -> colorInfo
        cols: new Map()   // key: colName -> colorInfo
    };

    const HL_PRESETS = {
        green: { key: 'green', bg: '#dcfce7', inputBg: '#f0fdf4', border: '#86efac', text: '#14532d', className: 'mi-hl-green' },
        red: { key: 'red', bg: '#fee2e2', inputBg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', className: 'mi-hl-red' },
        blue: { key: 'blue', bg: '#dbeafe', inputBg: '#eff6ff', border: '#93c5fd', text: '#1e3a8a', className: 'mi-hl-blue' },
        yellow: { key: 'yellow', bg: '#fef9c3', inputBg: '#fefce8', border: '#fde047', text: '#713f12', className: 'mi-hl-yellow' }
    };

    const getCustomColorInfo = (hex) => {
        let c = (hex || '#8b5cf6').replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        const num = parseInt(c, 16) || 0;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return {
            key: hex,
            bg: `rgba(${r}, ${g}, ${b}, 0.22)`,
            inputBg: `rgba(${r}, ${g}, ${b}, 0.12)`,
            border: `rgba(${r}, ${g}, ${b}, 0.65)`,
            text: '#09090b',
            isCustom: true
        };
    };

    const applyColorToElement = (el, colorInfo) => {
        if (!el) return;
        removeColorFromElement(el);
        el.classList.add('mi-hl-applied');
        if (colorInfo.className) {
            el.classList.add(colorInfo.className);
        } else if (colorInfo.isCustom) {
            el.style.backgroundColor = colorInfo.bg;
            el.querySelectorAll('input:not([type="file"]), select, .form-control').forEach(inp => {
                inp.style.backgroundColor = colorInfo.inputBg;
                inp.style.borderColor = colorInfo.border;
            });
        }
    };

    const removeColorFromElement = (el) => {
        if (!el) return;
        el.classList.remove('mi-hl-green', 'mi-hl-red', 'mi-hl-blue', 'mi-hl-yellow', 'mi-hl-applied');
        el.style.backgroundColor = '';
        el.querySelectorAll('input:not([type="file"]), select, .form-control').forEach(inp => {
            inp.style.backgroundColor = '';
            inp.style.borderColor = '';
        });
    };

    container.innerHTML = `
        <style>
            /* True Fullscreen: overlay entire screen at highest z-index covering headers & sidebars like Critical Board */
            body.mi-fullscreen-active #sidebar,
            body.mi-fullscreen-active .sidebar,
            body.mi-fullscreen-active #app-topbar,
            body.mi-fullscreen-active .topbar,
            body.mi-fullscreen-active #sidebar-backdrop {
                display: none !important;
            }
            body.mi-fullscreen-active .main-content {
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                max-width: 100vw !important;
                height: 100vh !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                z-index: 100050 !important;
                overflow: hidden !important;
            }
            body.mi-fullscreen-active #workspace-container {
                padding: 0 !important;
                margin: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                max-width: 100vw !important;
            }
            body.mi-fullscreen-active .market-inserter-page.mi-fullscreen-mode {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 100060 !important;
                background: var(--surface-main, #ffffff) !important;
                padding: 0.85rem 1.25rem !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                overflow: hidden !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 0.65rem !important;
            }
            body.mi-fullscreen-active .market-inserter-page.mi-fullscreen-mode .card {
                flex: 1 1 auto !important;
                height: calc(100vh - 110px) !important;
                border-radius: 12px !important;
            }
            body.mi-fullscreen-active .market-inserter-page.mi-fullscreen-mode #mi-grid-container {
                max-height: calc(100vh - 180px) !important;
                height: 100% !important;
            }

            /* Outlined Grey Expand Button */
            .mi-btn-fullscreen {
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                padding: 0.45rem 0.85rem;
                border-radius: 8px;
                font-size: 0.82rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.16s ease;
                background: #ffffff;
                color: #27272a;
                border: 1.5px solid #d4d4d8;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            .mi-btn-fullscreen:hover {
                background: #f4f4f5;
                border-color: #a1a1aa;
                color: #18181b;
            }
            .market-inserter-page.mi-fullscreen-mode .mi-btn-fullscreen {
                background: #f4f4f5;
                border-color: #71717a;
                color: #09090b;
            }

            /* Excel-style Outline Box & Cell Borders */
            #mi-grid-container {
                cursor: default;
                user-select: text;
                transition: padding 0.15s ease;
            }
            #mi-grid-container.mi-panning {
                cursor: grab !important;
                user-select: none !important;
            }
            #mi-grid-container.mi-panning * {
                cursor: grab !important;
                user-select: none !important;
            }

            #mi-grid-table {
                border-collapse: separate;
                border-spacing: 0;
            }
            #mi-grid-table th, #mi-grid-table td {
                border-right: 1px solid #e4e4e7;
                border-bottom: 1px solid #e4e4e7;
                transition: padding 0.1s ease, font-size 0.1s ease;
            }
            #mi-grid-table th:first-child, #mi-grid-table td:first-child {
                border-left: 1px solid #e4e4e7;
            }
            #mi-grid-table tr:hover td {
                background-color: #fafafa;
            }

            /* Field Outline & Active Focus: Thin lined & highlighted with Silver Grey / Black (4dp rounded corners, No bulky outer border frame) */
            .mi-field-outlined,
            #mi-grid-table input.form-control:focus,
            #mi-grid-table select.form-control:focus,
            .mi-cell-selected input,
            .mi-cell-selected select {
                border-color: #18181b !important;
                box-shadow: 0 0 0 1.5px #18181b, 0 1px 2px rgba(0, 0, 0, 0.05) !important;
                background-color: #ffffff !important;
                border-radius: 4px !important;
                outline: none !important;
                color: #09090b !important;
            }

            .mi-field-outlined.mi-image-box,
            .mi-cell-selected .mi-image-box {
                border-color: #18181b !important;
                box-shadow: 0 0 0 1.5px #18181b !important;
                border-radius: 4px !important;
            }

            /* Selected Cell & Row Indicators: Silver Grey subtle background within grid lines (No heavy border frame on td) */
            .mi-cell-selected {
                background-color: rgba(24, 24, 27, 0.05) !important;
                outline: none !important;
                box-shadow: none !important;
            }
            .mi-cell-selected:not(:has(input, select, .mi-image-box)) {
                outline: 1.5px solid #18181b !important;
                outline-offset: -1.5px !important;
            }

            /* Table Header Selection: Thin-lined Silver Grey / Black highlight within grid, no floating border frame */
            th.mi-header-selected,
            th.mi-field-outlined {
                outline: 2px solid #18181b !important;
                outline-offset: -2px !important;
                box-shadow: inset 0 0 0 1px rgba(24, 24, 27, 0.15) !important;
                background-color: #f4f4f5 !important;
                color: #09090b !important;
                font-weight: 700 !important;
                border-radius: 0 !important;
            }

            .mi-row-selected {
                background-color: rgba(24, 24, 27, 0.02) !important;
            }

            /* User Options Highlighter Styles: Green, Red/Error, Blue, Yellow, and Custom (Multiple Productivity Highlights) */
            .mi-hl-green {
                background-color: #dcfce7 !important;
            }
            .mi-hl-green input, .mi-hl-green select, .mi-hl-green .form-control {
                background-color: #f0fdf4 !important;
                border-color: #86efac !important;
            }

            .mi-hl-red {
                background-color: #fee2e2 !important;
            }
            .mi-hl-red input, .mi-hl-red select, .mi-hl-red .form-control {
                background-color: #fef2f2 !important;
                border-color: #fca5a5 !important;
            }

            .mi-hl-blue {
                background-color: #dbeafe !important;
            }
            .mi-hl-blue input, .mi-hl-blue select, .mi-hl-blue .form-control {
                background-color: #eff6ff !important;
                border-color: #93c5fd !important;
            }

            .mi-hl-yellow {
                background-color: #fef9c3 !important;
            }
            .mi-hl-yellow input, .mi-hl-yellow select, .mi-hl-yellow .form-control {
                background-color: #fefce8 !important;
                border-color: #fde047 !important;
            }

            .mi-hl-color-btn.active-hl {
                outline: 2px solid #18181b !important;
                outline-offset: 1px !important;
                transform: scale(1.12);
            }

            #mi-grid-table .form-control {
                border-radius: 4px !important;
            }

            /* Anti-Insertion Error Highlighting */
            .mi-input-error {
                border-color: #ef4444 !important;
                background-color: #fef2f2 !important;
                box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
            }
            .mi-row-rejected {
                background-color: rgba(254, 242, 242, 0.5) !important;
            }

            /* Zoom level variations */
            #mi-grid-container[data-zoom="compact"] #mi-grid-table th,
            #mi-grid-container[data-zoom="compact"] #mi-grid-table td {
                padding-top: 0.2rem !important;
                padding-bottom: 0.2rem !important;
            }
            #mi-grid-container[data-zoom="compact"] .form-control {
                padding-top: 0.25rem !important;
                padding-bottom: 0.25rem !important;
                font-size: 0.78rem !important;
            }

            #mi-grid-container[data-zoom="relaxed"] #mi-grid-table th,
            #mi-grid-container[data-zoom="relaxed"] #mi-grid-table td {
                padding-top: 0.55rem !important;
                padding-bottom: 0.55rem !important;
            }
            #mi-grid-container[data-zoom="relaxed"] .form-control {
                padding-top: 0.55rem !important;
                padding-bottom: 0.55rem !important;
                font-size: 0.88rem !important;
            }

            /* Unsaved Changes Banner */
            #mi-unsaved-warning-bar {
                display: none;
                align-items: center;
                justify-content: space-between;
                padding: 0.55rem 0.9rem;
                background: #fffbeb;
                border: 1px solid #fde68a;
                border-radius: 8px;
                color: #92400e;
                font-size: 0.82rem;
                font-weight: 600;
                animation: fadeIn 0.18s ease-out;
            }
        </style>
        
        <div class="market-inserter-page" style="display: flex; flex-direction: column; gap: 1.25rem;">
            
            ${isBatchUpdateMode ? `
                <!-- Batch Updator Banner -->
                <div id="mi-transfer-mode-banner" style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:12px; padding:0.9rem 1.25rem; gap:1rem; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:38px; height:38px; border-radius:9px; background:#ffffff; border:1.5px solid #cbd5e1; display:flex; align-items:center; justify-content:center; flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0f172a;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></div>
                        <div>
                            <strong style="color:#0f172a; font-size:0.92rem;">Market Updator Mode: ${transferredProducts.length} Selected Products Loaded</strong>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:2px;">
                                Mass detail update — modify name, category, pricing, stock, barcodes, or variations in the grid below. Submitting will update these items directly in your catalog instead of adding duplicates.
                            </div>
                        </div>
                    </div>
                    <button type="button" id="mi-btn-discard-batch" class="btn btn-secondary btn-sm" style="height:32px; font-size:0.8rem; border:1.5px solid #cbd5e1; background:#ffffff; color:#64748b; border-radius:8px; font-weight:600;">
                        Discard Batch & Start Blank
                    </button>
                </div>
            ` : ''}

            <!-- 1. Header Toolbar Section -->
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 0;">
                <div>
                    <h2 style="margin: 0 0 0.25rem 0;">${isBatchUpdateMode ? 'Market Updator' : 'Market Inserter'}</h2>
                    <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">
                        ${isBatchUpdateMode 
                            ? `Mass detail update — editing ${transferredProducts.length} selected products simultaneously with instant catalog sync` 
                            : 'Fast spreadsheet grid — insert up to 300 products at once with live duplicate protection & instant image pickers'}
                    </p>
                </div>

                <!-- Quick Action Buttons -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.35rem; background: var(--surface-50); padding: 0.35rem 0.65rem; border-radius: 8px; border: 1px solid var(--border-color); font-size: 0.82rem; font-weight: 600;">
                        <span>Rows:</span>
                        <span id="mi-row-counter" style="color: var(--primary); font-weight: 700;">${rowDataList.length} / ${MAX_ROWS}</span>
                    </div>

                    <!-- Add Row buttons -->
                    <button id="mi-btn-add-1" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 1 Row</button>
                    <button id="mi-btn-add-5" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 5 Rows</button>
                    <button id="mi-btn-add-10" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 10 Rows</button>
                    <button id="mi-btn-add-50" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem; font-weight: 600;">+ 50 Rows</button>

                    <div style="height: 24px; width: 1px; background: var(--border-color); margin: 0 0.25rem;"></div>

                    <!-- Bulk category applicator -->
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <select id="mi-bulk-cat-select" class="form-control" style="font-size: 0.8rem; padding: 0.4rem 0.65rem; max-width: 150px;">
                            <option value="">Category for All...</option>
                            ${categories.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('')}
                        </select>
                        <button id="mi-btn-apply-cat" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.7rem;" title="Apply selected category to all rows">Apply</button>
                    </div>

                    <button id="mi-btn-clear-empty" class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.45rem 0.75rem;" title="Remove rows that have no product data">Clear Empty</button>

                    <div style="height: 24px; width: 1px; background: var(--border-color); margin: 0 0.25rem;"></div>

                    <!-- Outline / Cell Sizer (Ratio & Selected Cell Expand/Reduce) -->
                    <div style="display:flex; align-items:center; gap:0.4rem; background: var(--surface-50); padding: 0.25rem 0.6rem; border-radius: 8px; border: 1.5px solid var(--border-color); font-size: 0.78rem;" title="Select any cell to expand or reduce with + / -">
                        <span style="font-weight: 700; color: var(--text-secondary); display:flex; align-items:center; gap:3px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            Cell:
                        </span>
                        <span id="mi-active-cell-badge" style="font-size:0.72rem; color:var(--text-muted); font-family:monospace; background:#fff; border:1px solid var(--border-color); padding:0.1rem 0.45rem; border-radius:4px; max-width:130px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">All</span>
                        <!-- Decrease button (-) -->
                        <button type="button" id="mi-btn-cell-minus" class="icon-btn" style="width:24px; height:24px; font-size:14px; font-weight:700; border:1.5px solid #d4d4d8; background:#fff; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Reduce selected cell / column width (-)">−</button>
                        <!-- Increase button (+) -->
                        <button type="button" id="mi-btn-cell-plus" class="icon-btn" style="width:24px; height:24px; font-size:14px; font-weight:700; border:1.5px solid #d4d4d8; background:#fff; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Increase selected cell / column width (+)">+</button>
                        <span style="color:#d4d4d8; margin:0 2px;">|</span>
                        <!-- Vertical density toggle -->
                        <button type="button" id="mi-btn-density-toggle" class="btn btn-secondary" style="font-size:0.72rem; padding:0.18rem 0.5rem; border:1px solid #d4d4d8; background:#fff; font-weight:600; cursor:pointer;" title="Toggle row height: Compact, Normal, Relaxed">
                            <span id="mi-density-label">Normal</span>
                        </button>
                    </div>

                    <div style="height: 24px; width: 1px; background: var(--border-color); margin: 0 0.25rem;"></div>

                    <!-- Options Highlighter Tool (Cell / Column / Row with Green, Red, Blue, Yellow, Custom) -->
                    <div id="mi-highlighter-bar" style="display:flex; align-items:center; gap:0.45rem; background: var(--surface-50); padding: 0.22rem 0.55rem; border-radius: 8px; border: 1.5px solid var(--border-color); font-size: 0.78rem;" title="Options Highlighter: Mark cells, columns, or rows with colors">
                        <div style="display:flex; align-items:center; gap:4px; font-weight:700; color:var(--text-secondary);">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 11-6 6v3h3l6-6m-3-3 7-7a2 2 0 0 1 3 3l-7 7m-3-3 3 3"></path><line x1="22" y1="2" x2="22" y2="2"></line></svg>
                            <span>Highlight:</span>
                        </div>

                        <!-- Scope Toggle: Cell / Column / Row -->
                        <div class="mi-hl-scope-group" style="display:inline-flex; border:1px solid #d4d4d8; border-radius:6px; overflow:hidden; background:#fff;">
                            <button type="button" id="mi-hl-scope-cell" class="mi-hl-scope-btn" data-scope="cell" style="padding:0.18rem 0.45rem; font-size:0.72rem; font-weight:700; border:none; background:#18181b; color:#fff; cursor:pointer;" title="Apply highlight to selected cell only">Cell</button>
                            <button type="button" id="mi-hl-scope-col" class="mi-hl-scope-btn" data-scope="col" style="padding:0.18rem 0.45rem; font-size:0.72rem; font-weight:600; border:none; background:transparent; color:#52525b; cursor:pointer;" title="Apply highlight to entire column">Column</button>
                            <button type="button" id="mi-hl-scope-row" class="mi-hl-scope-btn" data-scope="row" style="padding:0.18rem 0.45rem; font-size:0.72rem; font-weight:600; border:none; background:transparent; color:#52525b; cursor:pointer;" title="Apply highlight to entire row">Row</button>
                        </div>

                        <!-- 4 Default Presets (Green, Red/Error, Blue, Yellow) + Custom Color Picker + Clear -->
                        <div style="display:inline-flex; align-items:center; gap:4px;">
                            <button type="button" class="mi-hl-color-btn" data-color="green" style="width:18px; height:18px; border-radius:50%; background:#22c55e; border:1.5px solid #16a34a; cursor:pointer; padding:0; transition:transform 0.1s ease;" title="Highlight Green"></button>
                            <button type="button" class="mi-hl-color-btn" data-color="red" style="width:18px; height:18px; border-radius:50%; background:#ef4444; border:1.5px solid #dc2626; cursor:pointer; padding:0; transition:transform 0.1s ease;" title="Highlight Red (Error)"></button>
                            <button type="button" class="mi-hl-color-btn" data-color="blue" style="width:18px; height:18px; border-radius:50%; background:#3b82f6; border:1.5px solid #2563eb; cursor:pointer; padding:0; transition:transform 0.1s ease;" title="Highlight Blue"></button>
                            <button type="button" class="mi-hl-color-btn" data-color="yellow" style="width:18px; height:18px; border-radius:50%; background:#eab308; border:1.5px solid #ca8a04; cursor:pointer; padding:0; transition:transform 0.1s ease;" title="Highlight Yellow"></button>

                            <!-- Custom Color Picker -->
                            <label style="position:relative; width:18px; height:18px; border-radius:50%; background:conic-gradient(red, yellow, lime, aqua, blue, magenta, red); border:1.5px solid #a1a1aa; cursor:pointer; display:inline-block; margin:0; vertical-align:middle;" title="Custom Color Picker">
                                <input type="color" id="mi-hl-custom-input" value="#8b5cf6" style="position:absolute; opacity:0; width:100%; height:100%; top:0; left:0; cursor:pointer;">
                            </label>

                            <!-- Eraser / Clear Highlight on Selection -->
                            <button type="button" id="mi-hl-clear-btn" class="icon-btn" style="width:20px; height:20px; border-radius:4px; border:1px solid #d4d4d8; background:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; color:#71717a; padding:0;" title="Remove highlight from selected cell / column / row">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>

                            <!-- Clear All Highlights -->
                            <button type="button" id="mi-hl-clear-all-btn" class="btn btn-secondary" style="font-size:0.68rem; padding:0.12rem 0.4rem; border-radius:4px; border:1px solid #d4d4d8; background:#fff; cursor:pointer; color:#71717a; font-weight:600;" title="Clear all highlights across grid">Clear All</button>
                        </div>
                    </div>

                    <div style="height: 24px; width: 1px; background: var(--border-color); margin: 0 0.25rem;"></div>

                    <!-- Fullscreen Expand Button (Outlined grey, remembered across refreshes) -->
                    <button type="button" id="mi-btn-fullscreen-toggle" class="mi-btn-fullscreen" title="Expand Market Inserter to Full Screen (Remembered across refreshes)">
                        <svg class="mi-icon-expand" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                        <svg class="mi-icon-collapse" style="display:none;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                        <span id="mi-fs-label">Expand</span>
                    </button>
                </div>
            </div>

            <!-- Unsaved Changes Warning Banner (Appears only when user entered actual data) -->
            <div id="mi-unsaved-warning-bar">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span><strong>Unsaved Changes:</strong> You have active product rows in progress. Do not refresh or close without inserting.</span>
                </div>
                <span style="font-size:0.75rem; color:#b45309; background:#fef3c7; padding:0.15rem 0.5rem; border-radius:4px; border:1px solid #fde68a;">Reload Protection Active</span>
            </div>

            <!-- 2. Grid Table Card (Bottom header hugs row length, no rigid 480px empty space) -->
            <div class="card" style="padding: 0; overflow: hidden; border-radius: 12px; border: 1.5px solid var(--border-color); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; position: relative; height: auto;">
                
                <!-- Quick Top Action & Counter Bar (Visible right above table cells) -->
                <div style="padding: 0.65rem 1.25rem; background: var(--surface-50, #f8fafc); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 5px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Spreadsheet View
                        </span>
                        <span style="font-size: 0.76rem; color: var(--text-muted); background: #ffffff; border: 1px solid var(--border-color); padding: 0.15rem 0.5rem; border-radius: 6px;">Right-click drag or Ctrl + move / Arrows to pan</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <button type="button" id="mi-btn-top-add-row" class="btn btn-secondary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.65rem; font-weight: 700; display:flex; align-items:center; gap:4px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Add Row
                        </button>
                        <button type="button" id="mi-btn-top-submit" class="btn btn-primary btn-sm" style="font-size: 0.78rem; padding: 0.35rem 0.85rem; font-weight: 700; display:flex; align-items:center; gap:4px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span id="mi-top-submit-label">Insert</span>
                        </button>
                    </div>
                </div>

                <div id="mi-grid-container" data-zoom="normal" style="max-height: calc(100vh - 240px); overflow: auto; background: var(--surface-0);">
                    <table id="mi-grid-table" style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 1350px; font-size: 0.85rem;">
                        <thead>
                            <tr style="position: sticky; top: 0; z-index: 10; background: var(--surface-100, #f1f5f9); color: var(--text-secondary); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid var(--border-color); box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                                <th class="mi-col-index" data-col="index" style="padding: 0.65rem 0.4rem; text-align: center; border-bottom: 1px solid var(--border-color); cursor:pointer;">#</th>
                                <th class="mi-col-image" data-col="image" style="padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); cursor:pointer;">Image</th>
                                <th class="mi-col-name" data-col="name" style="padding: 0.65rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Product Name *</th>
                                <th class="mi-col-category" data-col="category" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Category *</th>
                                <th class="mi-col-sizeWeight" data-col="sizeWeight" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Size / Weight</th>
                                <th class="mi-col-quantity" data-col="quantity" style="padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); cursor:pointer;">Stock (Qty)</th>
                                <th class="mi-col-basePrice" data-col="basePrice" style="padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); cursor:pointer;">Base Cost (${getAppCurrencySymbol()})</th>
                                <th class="mi-col-price" data-col="price" style="padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); cursor:pointer;">Wholesale (${getAppCurrencySymbol()})</th>
                                <th class="mi-col-salePrice" data-col="salePrice" style="padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); color: var(--primary); cursor:pointer;">Sale Price * (${getAppCurrencySymbol()})</th>
                                <th class="mi-col-mrp" data-col="mrp" style="padding: 0.65rem 0.5rem; text-align: right; border-bottom: 1px solid var(--border-color); cursor:pointer;">MRP (${getAppCurrencySymbol()})</th>
                                <th class="mi-col-upcCode" data-col="upcCode" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">UPC / Barcode</th>
                                <th class="mi-col-variations" data-col="variations" style="padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); cursor:pointer;">Variations</th>
                                <th class="mi-col-mfgDate" data-col="mfgDate" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Mfg Date</th>
                                <th class="mi-col-expDate" data-col="expDate" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Exp Date</th>
                                <th class="mi-col-note" data-col="note" style="padding: 0.65rem 0.5rem; text-align: left; border-bottom: 1px solid var(--border-color); cursor:pointer;">Note</th>
                                <th class="mi-col-action" data-col="action" style="padding: 0.65rem 0.5rem; text-align: center; border-bottom: 1px solid var(--border-color); cursor:pointer;">Action</th>
                            </tr>
                        </thead>
                        <tbody id="mi-tbody">
                            <!-- Dynamic Grid Rows Rendered Here -->
                        </tbody>
                    </table>
                </div>

                <!-- 3. Bottom Actions & Summary Bar (Positioned immediately below rows) -->
                <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); background: var(--surface-50, #f8fafc); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div id="mi-summary-text" style="font-size: 0.88rem; color: var(--text-secondary);">
                            <strong id="mi-valid-count" style="color: var(--text-primary); font-size: 1rem;">0</strong> products ready to insert
                        </div>
                        <div id="mi-duplicate-warning-pill" style="display: none; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: #d97706; background: rgba(245, 158, 11, 0.12); padding: 0.3rem 0.65rem; border-radius: 6px; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.25);">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            <span><strong id="mi-dup-count">0</strong> potential duplicates</span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <button id="mi-btn-cancel-to-products" class="btn btn-secondary" style="font-size: 0.88rem; padding: 0.6rem 1.25rem;">Back to Products</button>
                        <button id="mi-btn-submit" class="btn btn-primary" style="font-size: 0.92rem; font-weight: 700; padding: 0.65rem 2rem; display: flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <span id="mi-btn-submit-label">Insert Products</span>
                        </button>
                    </div>
                </div>

                <!-- 4. Real-time Batch Progress Overlay (Embedded in card) -->
                <div id="mi-progress-overlay" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.88); z-index: 1000; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center;">
                    <div style="background: var(--surface-0); padding: 2.5rem 2rem; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 1px solid var(--border-color);">
                        <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                        </div>
                        <h3 id="mi-progress-title" style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary);">Inserting Products...</h3>
                        <p id="mi-progress-desc" style="margin: 0 0 1.5rem 0; font-size: 0.85rem; color: var(--text-secondary);">Uploading image & saving: <strong id="mi-progress-item-name">Loading...</strong></p>
                        
                        <!-- Progress Bar -->
                        <div style="width: 100%; height: 10px; background: var(--surface-100, #e2e8f0); border-radius: 9999px; overflow: hidden; margin-bottom: 0.75rem;">
                            <div id="mi-progress-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.2s ease;"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                            <span id="mi-progress-count">0 of 0</span>
                            <span id="mi-progress-percent">0%</span>
                        </div>
                    </div>
                </div>

            </div>

            <!-- 5. Variations Sub-Modal -->
            <div id="mi-var-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); z-index: 100070; align-items: center; justify-content: center; padding: 1.5rem;">
                <div class="card" style="background: var(--surface-0); width: 100%; max-width: 540px; border-radius: 14px; padding: 1.5rem; border: 1px solid var(--border-color); box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                        <div>
                            <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-primary);">Manage Product Variations</h4>
                            <p id="mi-var-target-name" style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">Row variations</p>
                        </div>
                        <button id="mi-var-close-x" class="icon-btn" style="border: none; background: transparent; cursor: pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>
                    
                    <div id="mi-var-list" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem;">
                        <!-- Variation Rows -->
                    </div>

                    <button id="mi-var-add-row" class="btn btn-secondary" style="width: 100%; font-size: 0.82rem; margin-bottom: 1.25rem;">Add Variation Option</button>

                    <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                        <button id="mi-var-cancel" class="btn btn-secondary" style="font-size: 0.85rem;">Cancel</button>
                        <button id="mi-var-save" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700;">Save Variations</button>
                    </div>
                </div>
            </div>

            <!-- 6. Strict 3-Field Anti-Insertion & Batch Breakdown Modal -->
            <div id="mi-breakdown-modal" style="display: none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); z-index: 999999; align-items: center; justify-content: center; padding: 1.5rem;">
                <div class="card" style="background: var(--surface-0, #ffffff); width: 100%; max-width: 840px; max-height: 90vh; border-radius: 16px; padding: 1.5rem; border: 1.5px solid var(--border-color); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1.5px solid var(--border-color); padding-bottom: 0.85rem; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div id="mi-breakdown-icon" style="width: 42px; height: 42px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); color: #10b981; display: flex; align-items: center; justify-content: center;">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div>
                                <h3 id="mi-breakdown-title" style="margin: 0; font-size: 1.25rem; font-weight: 800; color: var(--text-primary); letter-spacing: -0.01em;">Batch Insertion Summary</h3>
                                <p style="margin: 2px 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">Required Fields to Insert a product (Product Name, Category & Sale Price)</p>
                            </div>
                        </div>
                        <button id="mi-breakdown-close-x" class="icon-btn" style="border: none; background: transparent; cursor: pointer; color: var(--text-muted); padding: 4px;" title="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                    </div>

                    <!-- KPI Metric Cards (Inserted, Rejected, Skipped) -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.85rem; margin-bottom: 1.25rem; flex-shrink: 0;">
                        <!-- 1. Inserted -->
                        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 0.85rem; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.04em;">Inserted</div>
                            <div id="mi-kpi-inserted" style="font-size: 1.75rem; font-weight: 900; color: #166534; margin: 2px 0;">0</div>
                            <div style="font-size: 0.72rem; color: #15803d;">Verified Cells</div>
                        </div>
                        <!-- 2. Rejected -->
                        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 10px; padding: 0.85rem; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: #b91c1c; text-transform: uppercase; letter-spacing: 0.04em;">Rejected (Anti-Insert)</div>
                            <div id="mi-kpi-rejected" style="font-size: 1.75rem; font-weight: 900; color: #991b1b; margin: 2px 0;">0</div>
                            <div style="font-size: 0.72rem; color: #b91c1c;">Missing required fields</div>
                        </div>
                        <!-- 3. Skipped -->
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; text-align: center;">
                            <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Skipped</div>
                            <div id="mi-kpi-skipped" style="font-size: 1.75rem; font-weight: 900; color: #334155; margin: 2px 0;">0</div>
                            <div style="font-size: 0.72rem; color: #64748b;">Completely blank rows</div>
                        </div>
                    </div>

                    <!-- Breakdown List Table -->
                    <div style="flex: 1 1 auto; overflow-y: auto; border: 1.5px solid var(--border-color); border-radius: 8px; margin-bottom: 1.25rem;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                            <thead style="position: sticky; top: 0; background: var(--surface-100); border-bottom: 1.5px solid var(--border-color); z-index: 5;">
                                <tr style="text-align: left; font-size: 0.74rem; text-transform: uppercase; color: var(--text-secondary);">
                                    <th style="padding: 0.55rem 0.75rem; width: 50px;">Row</th>
                                    <th style="padding: 0.55rem 0.75rem;">Product Name</th>
                                    <th style="padding: 0.55rem 0.75rem; width: 110px;">Status</th>
                                    <th style="padding: 0.55rem 0.75rem;">Anti-Insertion Evaluation</th>
                                </tr>
                            </thead>
                            <tbody id="mi-breakdown-tbody">
                                <!-- Dynamic evaluation breakdown rows -->
                            </tbody>
                        </table>
                    </div>

                    <!-- Footer Actions -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; flex-shrink: 0;">
                        <div id="mi-breakdown-hint" style="font-size: 0.8rem; color: var(--text-secondary);"></div>
                        <div style="display: flex; gap: 0.65rem; align-items: center;">
                            <button type="button" id="mi-breakdown-btn-fix" class="btn btn-warning" style="display: none; font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.15rem; background: #f59e0b; color: #fff; border: none; border-radius: 6px;">
                                Fix Rejected Rows in Grid
                            </button>
                            <button type="button" id="mi-breakdown-btn-catalog" class="btn btn-primary" style="font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 6px;">
                                Done &amp; Go to Products
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    `;

    const tbody = container.querySelector('#mi-tbody');
    const rowCounter = container.querySelector('#mi-row-counter');
    const validCountEl = container.querySelector('#mi-valid-count');
    const dupPill = container.querySelector('#mi-duplicate-warning-pill');
    const dupCountEl = container.querySelector('#mi-dup-count');
    const btnSubmitLabel = container.querySelector('#mi-btn-submit-label');
    const topSubmitLabel = container.querySelector('#mi-top-submit-label');
    const unsavedWarningBar = container.querySelector('#mi-unsaved-warning-bar');

    // Dynamic Column Width Style Sheet attached directly to container
    const colStylesEl = document.createElement('style');
    colStylesEl.id = 'mi-dynamic-col-styles';
    container.prepend(colStylesEl);

    const MIN_CELL_WIDTH = 50;
    const MAX_CELL_WIDTH = 460;

    const updateCellSizerButtonStates = () => {
        const btnPlus = container.querySelector('#mi-btn-cell-plus');
        const btnMinus = container.querySelector('#mi-btn-cell-minus');
        if (!btnPlus || !btnMinus) return;

        let canIncrease = false;
        let canDecrease = false;

        if (selectedCell.col && colWidths[selectedCell.col] !== undefined) {
            const currentW = colWidths[selectedCell.col];
            canIncrease = currentW < MAX_CELL_WIDTH;
            canDecrease = currentW > MIN_CELL_WIDTH;
        } else {
            // "All" mode: check if any column can increase / decrease within bounds
            const widths = Object.values(colWidths);
            canIncrease = widths.some(w => w < MAX_CELL_WIDTH);
            canDecrease = widths.some(w => w > MIN_CELL_WIDTH);
        }

        // Apply disabled state & unclickable styling
        btnPlus.disabled = !canIncrease;
        btnPlus.style.opacity = canIncrease ? '1' : '0.35';
        btnPlus.style.cursor = canIncrease ? 'pointer' : 'not-allowed';
        btnPlus.style.pointerEvents = canIncrease ? 'auto' : 'none';
        btnPlus.title = canIncrease 
            ? 'Increase selected cell / column width (+)' 
            : 'Maximum width limit reached (cannot increase further)';

        btnMinus.disabled = !canDecrease;
        btnMinus.style.opacity = canDecrease ? '1' : '0.35';
        btnMinus.style.cursor = canDecrease ? 'pointer' : 'not-allowed';
        btnMinus.style.pointerEvents = canDecrease ? 'auto' : 'none';
        btnMinus.title = canDecrease 
            ? 'Reduce selected cell / column width (−)' 
            : 'Minimum width limit reached (cannot reduce further)';
    };

    const updateColStyles = () => {
        let css = '';
        let totalWidth = 0;
        Object.entries(colWidths).forEach(([col, width]) => {
            totalWidth += width;
            css += `
                .mi-col-${col} {
                    width: ${width}px !important;
                    min-width: ${width}px !important;
                    max-width: ${width}px !important;
                    box-sizing: border-box !important;
                }
            `;
        });
        const gridTable = container.querySelector('#mi-grid-table');
        if (gridTable) {
            gridTable.style.minWidth = `${Math.max(1250, totalWidth)}px`;
        }
        colStylesEl.textContent = css;
        updateCellSizerButtonStates();
    };
    updateColStyles();

    // Helper: Determine if a row has any user-entered content (Category alone is IGNORED per rule!)
    const hasRowMeaningfulData = (r) => {
        if (!r) return false;
        if ((r.name || '').trim() !== '') return true;
        if ((r.upcCode || '').trim() !== '') return true;
        if ((r.note || '').trim() !== '') return true;
        if ((r.sizeWeight || '').trim() !== '') return true;
        if (Number(r.quantity) > 0) return true;
        if (Number(r.basePrice) > 0) return true;
        if (Number(r.price) > 0) return true;
        if (Number(r.salePrice) > 0) return true;
        if (Number(r.mrp) > 0) return true;
        if (r.imageFile) return true;
        if (r.variations && r.variations.length > 0) return true;
        if ((r.mfgDate || '').trim() !== '') return true;
        if ((r.expDate || '').trim() !== '') return true;
        // NOTE: Category alone does NOT trigger unsaved changes!
        return false;
    };

    // Helper: Check if grid has unsaved data entered by user
    const checkHasUnsavedData = () => {
        if (isSubmitting) return false;
        if (isBatchUpdateMode) {
            if (rowDataList.length !== initialSnapshot.length) return true;
            return rowDataList.some((r, i) => {
                const init = initialSnapshot[i];
                if (!init) return true;
                return (
                    (r.name || '') !== (init.name || '') ||
                    (r.category || '') !== (init.category || '') ||
                    Number(r.salePrice || 0) !== Number(init.salePrice || 0) ||
                    Number(r.price || 0) !== Number(init.price || 0) ||
                    Number(r.basePrice || 0) !== Number(init.basePrice || 0) ||
                    Number(r.quantity || 0) !== Number(init.quantity || 0) ||
                    (r.upcCode || '') !== (init.upcCode || '') ||
                    (r.sizeWeight || '') !== (init.sizeWeight || '') ||
                    (r.note || '') !== (init.note || '') ||
                    Boolean(r.imageFile)
                );
            });
        }
        return rowDataList.some(r => hasRowMeaningfulData(r));
    };

    // Expose detector globally so universal navigation router guards will check it
    window._marketInserterHasUnsaved = checkHasUnsavedData;

    // Browser-side Reload / Close Protection (beforeunload listener)
    const onBeforeUnloadHandler = (e) => {
        if (checkHasUnsavedData()) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', onBeforeUnloadHandler);

    // Duplicate detection helper
    const checkDuplicates = () => {
        const nameMap = new Map();
        let dupCount = 0;
        let validCount = 0;

        rowDataList.forEach((r, idx) => {
            const cleanName = (r.name || '').trim().toLowerCase();
            if (cleanName) {
                validCount++;
                if (!nameMap.has(cleanName)) {
                    nameMap.set(cleanName, []);
                }
                nameMap.get(cleanName).push(idx);
            }
        });

        rowDataList.forEach((r, idx) => {
            const rowEl = tbody.querySelector(`tr[data-index="${idx}"]`);
            if (!rowEl) return;
            const nameInput = rowEl.querySelector('.mi-input-name');
            const dupIndicator = rowEl.querySelector('.mi-dup-badge');
            const cleanName = (r.name || '').trim().toLowerCase();

            if (!cleanName) {
                if (nameInput) nameInput.style.borderColor = 'var(--border-color)';
                if (dupIndicator) dupIndicator.style.display = 'none';
                return;
            }

            const isSelfExisting = Boolean(r.existingId);
            const inCatalog = !isSelfExisting && existingProducts.some(p => (p.name || '').trim().toLowerCase() === cleanName);
            const inTableDup = nameMap.has(cleanName) && nameMap.get(cleanName).length > 1;

            if (inCatalog || inTableDup) {
                dupCount++;
                if (nameInput) {
                    nameInput.style.borderColor = '#f59e0b';
                    nameInput.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
                }
                if (dupIndicator) {
                    dupIndicator.style.display = 'inline-block';
                    dupIndicator.textContent = inCatalog ? 'Catalog Dup' : 'Table Dup';
                    dupIndicator.title = inCatalog ? 'This name already exists in your workspace catalog' : 'Duplicate name in this table';
                }
            } else {
                if (nameInput) {
                    nameInput.style.borderColor = 'var(--border-color)';
                    nameInput.style.backgroundColor = 'transparent';
                }
                if (dupIndicator) dupIndicator.style.display = 'none';
            }
        });

        validCountEl.textContent = validCount;
        const submitText = isBatchUpdateMode 
            ? (validCount > 0 ? `Update ${validCount} Products in Catalog` : 'Update Products') 
            : (validCount > 0 ? `Insert ${validCount} Products` : 'Insert Products');
        btnSubmitLabel.textContent = submitText;
        if (topSubmitLabel) {
            topSubmitLabel.textContent = isBatchUpdateMode 
                ? (validCount > 0 ? `Update (${validCount})` : 'Update') 
                : (validCount > 0 ? `Insert (${validCount})` : 'Insert');
        }

        // Live Warning banner when user has typed meaningful data
        const hasUnsaved = checkHasUnsavedData();
        if (unsavedWarningBar) {
            unsavedWarningBar.style.display = hasUnsaved ? 'flex' : 'none';
        }

        if (dupCount > 0) {
            dupPill.style.display = 'inline-flex';
            dupCountEl.textContent = dupCount;
        } else {
            dupPill.style.display = 'none';
        }
    };

    // Cell Selection Controller
    const clearCellSelection = () => {
        tbody.querySelectorAll('.mi-cell-selected').forEach(el => el.classList.remove('mi-cell-selected'));
        tbody.querySelectorAll('.mi-row-selected').forEach(el => el.classList.remove('mi-row-selected'));
        container.querySelectorAll('#mi-grid-table thead th.mi-header-selected').forEach(el => el.classList.remove('mi-header-selected'));
        container.querySelectorAll('.mi-field-outlined').forEach(el => el.classList.remove('mi-field-outlined'));
        selectedCell = { col: null, rowIdx: null, el: null, trEl: null };
        const activeCellBadge = container.querySelector('#mi-active-cell-badge');
        if (activeCellBadge) activeCellBadge.textContent = 'All';
        updateCellSizerButtonStates();
    };

    const outlineField = (el) => {
        container.querySelectorAll('.mi-field-outlined').forEach(e => e.classList.remove('mi-field-outlined'));
        if (el) {
            el.classList.add('mi-field-outlined');
            if (el.tagName !== 'TH' && el.tagName !== 'TD') {
                const td = el.closest('td');
                const tr = el.closest('tr');
                if (td && tr) {
                    const col = td.getAttribute('data-col');
                    const rowIdx = parseInt(tr.getAttribute('data-index'), 10);
                    selectedCell = { col, rowIdx, el: td, trEl: tr };
                    const activeCellBadge = container.querySelector('#mi-active-cell-badge');
                    if (activeCellBadge && col) {
                        const colLabels = {
                            index: '#',
                            image: 'Image',
                            name: 'Product Name',
                            category: 'Category',
                            sizeWeight: 'Size/Weight',
                            quantity: 'Stock',
                            basePrice: 'Base Cost',
                            price: 'Wholesale',
                            salePrice: 'Sale Price',
                            mrp: 'MRP',
                            upcCode: 'Barcode',
                            variations: 'Variations',
                            mfgDate: 'Mfg Date',
                            expDate: 'Exp Date',
                            note: 'Note',
                            action: 'Action'
                        };
                        activeCellBadge.textContent = colLabels[col] || col;
                    }
                    updateCellSizerButtonStates();
                }
            }
        }
    };

    const selectCell = (col, rowIdx, tdEl, trEl) => {
        // At a time ONLY ONE cell or column can be selected and highlighted
        tbody.querySelectorAll('.mi-cell-selected').forEach(el => el.classList.remove('mi-cell-selected'));
        tbody.querySelectorAll('.mi-row-selected').forEach(el => el.classList.remove('mi-row-selected'));
        container.querySelectorAll('#mi-grid-table thead th.mi-header-selected').forEach(el => el.classList.remove('mi-header-selected'));
        container.querySelectorAll('.mi-field-outlined').forEach(el => el.classList.remove('mi-field-outlined'));

        selectedCell = { col, rowIdx, el: tdEl, trEl };
        if (tdEl) {
            if (tdEl.tagName === 'TH') {
                tdEl.classList.add('mi-header-selected');
            } else {
                tdEl.classList.add('mi-cell-selected');
                const innerField = tdEl.querySelector('input:not([type="file"]), select, .mi-image-box');
                if (innerField) {
                    innerField.classList.add('mi-field-outlined');
                    try { innerField.focus(); } catch (e) {}
                }
            }
        }
        if (trEl) trEl.classList.add('mi-row-selected');

        const activeCellBadge = container.querySelector('#mi-active-cell-badge');
        if (activeCellBadge) {
            if (col) {
                const colLabels = {
                    index: '#',
                    image: 'Image',
                    name: 'Product Name',
                    category: 'Category',
                    sizeWeight: 'Size/Weight',
                    quantity: 'Stock',
                    basePrice: 'Base Cost',
                    price: 'Wholesale',
                    salePrice: 'Sale Price',
                    mrp: 'MRP',
                    upcCode: 'Barcode',
                    variations: 'Variations',
                    mfgDate: 'Mfg Date',
                    expDate: 'Exp Date',
                    note: 'Note',
                    action: 'Action'
                };
                activeCellBadge.textContent = colLabels[col] || col;
            } else {
                activeCellBadge.textContent = 'All';
            }
        }
        updateCellSizerButtonStates();
    };

    // Render Grid Table Rows
    const renderRows = () => {
        tbody.innerHTML = rowDataList.map((row, idx) => {
            const hasImage = Boolean(row.previewUrl || row.imageUri);
            const varCount = (row.variations || []).length;

            return `
                <tr data-index="${idx}" style="border-bottom: 1px solid var(--border-color); transition: background 0.15s ease;">
                    
                    <!-- 1. Index -->
                    <td class="mi-col-index" data-col="index" style="padding: 0.4rem; text-align: center; font-weight: 700; color: var(--text-muted); font-size: 0.78rem; background: var(--surface-50); cursor: pointer;">
                        ${idx + 1}
                    </td>

                    <!-- 2. Image Picker -->
                    <td class="mi-col-image" data-col="image" style="padding: 0.35rem 0.5rem; text-align: center; cursor: pointer;">
                        <input type="file" class="mi-file-input" data-index="${idx}" accept="image/*" style="display: none;">
                        <div class="mi-image-box" data-index="${idx}" style="width: 40px; height: 40px; border-radius: 8px; border: 1px dashed ${hasImage ? 'var(--primary)' : 'var(--border-color)'}; background: ${hasImage ? `url('${row.previewUrl || row.imageUri}') center/cover no-repeat` : 'var(--surface-50)'}; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; margin: 0 auto;" title="Click to choose product image">
                            ${!hasImage ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--text-muted);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>` : ''}
                            ${hasImage ? `<button type="button" class="mi-remove-img" data-index="${idx}" style="position:absolute; top:-4px; right:-4px; width:16px; height:16px; border-radius:50%; background:#ef4444; color:white; border:none; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer;" title="Remove image"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : ''}
                        </div>
                    </td>

                    <!-- 3. Product Name -->
                    <td class="mi-col-name" data-col="name" style="padding: 0.35rem 0.5rem; position: relative; cursor: pointer;">
                        <div style="display: flex; align-items: center; gap: 0.3rem;">
                            <input type="text" class="form-control mi-input mi-input-name" data-index="${idx}" data-field="name" value="${row.name || ''}" placeholder="e.g. Mango" style="width: 100%; padding: 0.4rem 0.55rem; font-size: 0.85rem; font-weight: 600;">
                            <span class="mi-dup-badge badge" style="display: none; background: #f59e0b; color: white; font-size: 0.65rem; padding: 0.15rem 0.4rem; border-radius: 4px; white-space: nowrap;"></span>
                        </div>
                    </td>

                    <!-- 4. Category -->
                    <td class="mi-col-category" data-col="category" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <select class="form-control mi-input" data-index="${idx}" data-field="category" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                            ${categories.map(c => `<option value="${c.uniqueId || c.id}" ${row.category === (c.uniqueId || c.id) || row.category === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                    </td>

                    <!-- 5. Size / Weight -->
                    <td class="mi-col-sizeWeight" data-col="sizeWeight" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="sizeWeight" value="${row.sizeWeight || ''}" placeholder="350g" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                    </td>

                    <!-- 6. Quantity -->
                    <td class="mi-col-quantity" data-col="quantity" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="quantity" value="${row.quantity || 0}" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 7. Base Price -->
                    <td class="mi-col-basePrice" data-col="basePrice" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="basePrice" value="${row.basePrice || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 8. Wholesale (Price) -->
                    <td class="mi-col-price" data-col="price" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="price" value="${row.price || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 9. Sale Price -->
                    <td class="mi-col-salePrice" data-col="salePrice" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="number" class="form-control mi-input mi-sale-price" data-index="${idx}" data-field="salePrice" value="${row.salePrice || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.85rem; font-weight: 700; text-align: right;">
                    </td>

                    <!-- 10. MRP -->
                    <td class="mi-col-mrp" data-col="mrp" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="number" class="form-control mi-input" data-index="${idx}" data-field="mrp" value="${row.mrp || 0}" step="any" min="0" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; text-align: right;">
                    </td>

                    <!-- 11. UPC Code -->
                    <td class="mi-col-upcCode" data-col="upcCode" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="upcCode" value="${row.upcCode || ''}" placeholder="Barcode" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; font-family: monospace;">
                    </td>

                    <!-- 12. Variations -->
                    <td class="mi-col-variations" data-col="variations" style="padding: 0.35rem 0.5rem; text-align: center; cursor: pointer;">
                        <button type="button" class="btn btn-secondary mi-btn-vars" data-index="${idx}" style="font-size: 0.72rem; padding: 0.3rem 0.5rem; width: 100%; white-space: nowrap; ${varCount > 0 ? 'border-color: var(--primary); color: var(--primary); font-weight:700;' : ''}">
                            ${varCount > 0 ? `+ Vars (${varCount})` : '+ Vars'}
                        </button>
                    </td>

                    <!-- 13. Mfg Date -->
                    <td class="mi-col-mfgDate" data-col="mfgDate" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="mfgDate" value="${row.mfgDate ? normalizeProductDate(row.mfgDate) : ''}" placeholder="DD-MM-YYYY" style="width: 100%; padding: 0.35rem 0.4rem; font-size: 0.75rem; font-family: monospace;">
                    </td>

                    <!-- 14. Exp Date -->
                    <td class="mi-col-expDate" data-col="expDate" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="expDate" value="${row.expDate ? normalizeProductDate(row.expDate) : ''}" placeholder="DD-MM-YYYY" style="width: 100%; padding: 0.35rem 0.4rem; font-size: 0.75rem; font-family: monospace;">
                    </td>

                    <!-- 15. Note -->
                    <td class="mi-col-note" data-col="note" style="padding: 0.35rem 0.5rem; cursor: pointer;">
                        <input type="text" class="form-control mi-input" data-index="${idx}" data-field="note" value="${row.note || ''}" placeholder="Optional description" style="width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem;">
                    </td>

                    <!-- 16. Actions -->
                    <td class="mi-col-action" data-col="action" style="padding: 0.35rem 0.4rem; text-align: center;">
                        <div style="display:flex; justify-content:center; gap:0.25rem;">
                            <button type="button" class="icon-btn mi-btn-dup" data-index="${idx}" style="width:26px; height:26px; border:none; background:transparent; cursor:pointer; color:var(--text-secondary); display:flex; align-items:center; justify-content:center;" title="Duplicate row">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                            <button type="button" class="icon-btn mi-btn-del" data-index="${idx}" style="width:26px; height:26px; border:none; background:transparent; cursor:pointer; color:var(--danger); display:flex; align-items:center; justify-content:center;" title="Delete row">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </td>

                </tr>
            `;
        }).join('');

        rowCounter.textContent = `${rowDataList.length} / ${MAX_ROWS}`;
        checkDuplicates();
        attachGridEvents();
    };

    // Attach Grid events
    const attachGridEvents = () => {
        // Input text/number/select changes
        tbody.querySelectorAll('.mi-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                const field = e.target.getAttribute('data-field');
                if (isNaN(idx) || !rowDataList[idx]) return;

                let val = e.target.value;
                if (['quantity', 'basePrice', 'price', 'salePrice', 'mrp'].includes(field)) {
                    val = Number(val) || 0;
                } else if (['mfgDate', 'expDate'].includes(field)) {
                    val = normalizeProductDate(val);
                }
                rowDataList[idx][field] = val;

                // Clear error outline if user just filled it
                e.target.classList.remove('mi-input-error');

                if (field === 'name') {
                    checkDuplicates();
                } else {
                    const hasUnsaved = checkHasUnsavedData();
                    if (unsavedWarningBar) unsavedWarningBar.style.display = hasUnsaved ? 'flex' : 'none';
                }
            });

            // One click or focus = select outlined field (single field outline)
            input.addEventListener('focus', () => {
                outlineField(input);
            });
            input.addEventListener('click', () => {
                outlineField(input);
            });
        });

        // Cell One-click (outlines field) & Double-click (selects cell; second dblclick reverts to all)
        tbody.querySelectorAll('td').forEach(td => {
            td.addEventListener('click', () => {
                const targetInput = td.querySelector('input:not([type="file"]), select, .mi-image-box') || td;
                outlineField(targetInput);
            });

            td.addEventListener('dblclick', () => {
                const col = td.getAttribute('data-col');
                const tr = td.closest('tr');
                const rowIdx = tr ? parseInt(tr.getAttribute('data-index'), 10) : null;
                const isAlreadySelected = selectedCell.el === td && selectedCell.col === col && selectedCell.rowIdx === rowIdx;
                if (isAlreadySelected) {
                    // Second Double Click: Revert to All
                    clearCellSelection();
                } else {
                    // Double Click: Select cell
                    selectCell(col, rowIdx, td, tr);
                }
            });
        });

        // Header One-click (outlines header) & Double-click (selects column; second dblclick reverts to all)
        container.querySelectorAll('#mi-grid-table thead th').forEach(th => {
            th.addEventListener('click', () => {
                outlineField(th);
            });

            th.addEventListener('dblclick', () => {
                const col = th.getAttribute('data-col');
                const isAlreadySelected = selectedCell.el === th && selectedCell.col === col;
                if (isAlreadySelected) {
                    // Second Double Click: Revert to All
                    clearCellSelection();
                } else {
                    // Double Click: Select column
                    selectCell(col, null, th, null);
                }
            });
        });

        // Arrow Keys Navigation: Move between outlined cells / inputs
        tbody.onkeydown = (e) => {
            const isArrow = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
            if (!isArrow) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return; // Keep Ctrl for horizontal/vertical pan shortcuts

            const target = e.target;
            const td = target?.closest('td');
            const tr = target?.closest('tr');
            if (!tr || !td) return;

            const rowIdx = parseInt(tr.getAttribute('data-index'), 10);
            if (isNaN(rowIdx)) return;

            const getRowFocusables = (rowElement) => {
                return Array.from(rowElement.querySelectorAll('.mi-image-box, input:not([type="file"]), select, .mi-btn-vars, .mi-btn-dup, .mi-btn-del'));
            };

            const currentRowFocusables = getRowFocusables(tr);
            const currentIdx = currentRowFocusables.indexOf(target);

            const navigateTo = (nextEl) => {
                if (!nextEl) return;
                e.preventDefault();
                nextEl.focus();
                outlineField(nextEl);
                const nextTd = nextEl.closest('td');
                if (nextTd) {
                    nextTd.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                }
            };

            if (e.key === 'ArrowUp') {
                if (rowIdx > 0) {
                    const prevTr = tbody.querySelector(`tr[data-index="${rowIdx - 1}"]`);
                    if (prevTr) {
                        const prevFocusables = getRowFocusables(prevTr);
                        const nextTarget = prevFocusables[currentIdx] || prevFocusables[prevFocusables.length - 1];
                        navigateTo(nextTarget);
                    }
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                if (rowIdx < rowDataList.length - 1) {
                    const nextTr = tbody.querySelector(`tr[data-index="${rowIdx + 1}"]`);
                    if (nextTr) {
                        const nextFocusables = getRowFocusables(nextTr);
                        const nextTarget = nextFocusables[currentIdx] || nextFocusables[nextFocusables.length - 1];
                        navigateTo(nextTarget);
                    }
                }
                return;
            }

            if (e.key === 'ArrowLeft') {
                const isText = target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number');
                if (isText && target.selectionStart !== null && target.selectionStart > 0) {
                    return; // Allow moving caret inside the input text
                }
                if (currentIdx > 0) {
                    navigateTo(currentRowFocusables[currentIdx - 1]);
                } else if (rowIdx > 0) {
                    const prevTr = tbody.querySelector(`tr[data-index="${rowIdx - 1}"]`);
                    if (prevTr) {
                        const prevFocusables = getRowFocusables(prevTr);
                        navigateTo(prevFocusables[prevFocusables.length - 1]);
                    }
                }
                return;
            }

            if (e.key === 'ArrowRight') {
                const isText = target.tagName === 'INPUT' && (target.type === 'text' || target.type === 'number');
                if (isText && target.selectionEnd !== null && target.selectionEnd < target.value.length) {
                    return; // Allow moving caret inside the input text
                }
                if (currentIdx < currentRowFocusables.length - 1) {
                    navigateTo(currentRowFocusables[currentIdx + 1]);
                } else if (rowIdx < rowDataList.length - 1) {
                    const nextTr = tbody.querySelector(`tr[data-index="${rowIdx + 1}"]`);
                    if (nextTr) {
                        const nextFocusables = getRowFocusables(nextTr);
                        navigateTo(nextFocusables[0]);
                    }
                }
                return;
            }
        };

        // Restore active user highlights across rows, columns, and individual cells
        highlightState.rows.forEach((colorInfo, rIdx) => {
            const tr = tbody.querySelector(`tr[data-index="${rIdx}"]`);
            if (tr) applyColorToElement(tr, colorInfo);
        });
        highlightState.cols.forEach((colorInfo, cName) => {
            container.querySelectorAll(`#mi-grid-table [data-col="${cName}"]`).forEach(el => {
                applyColorToElement(el, colorInfo);
            });
        });
        highlightState.cells.forEach((colorInfo, cellKey) => {
            const [rIdx, cName] = cellKey.split('_');
            const td = tbody.querySelector(`tr[data-index="${rIdx}"] td[data-col="${cName}"]`);
            if (td) applyColorToElement(td, colorInfo);
        });

        // Image Compression Helper
        const processMarketImageFile = async (file) => {
            if (!file || !file.type.startsWith('image/')) return file;
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDimension = 640;

                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        canvas.toBlob((blob) => {
                            if (!blob) {
                                resolve(file);
                                return;
                            }
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                                type: "image/webp",
                                lastModified: Date.now()
                            });
                            resolve(compressedFile);
                        }, 'image/webp', 0.85);
                    };
                    img.onerror = () => resolve(file);
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        };

        // Image pickers & Drag-Drop on spreadsheet cells
        tbody.querySelectorAll('.mi-image-box').forEach(box => {
            const idx = parseInt(box.getAttribute('data-index'));

            box.addEventListener('click', (e) => {
                if (e.target.classList.contains('mi-remove-img')) return;
                const fileInput = tbody.querySelector(`.mi-file-input[data-index="${idx}"]`);
                if (fileInput) fileInput.click();
            });

            ['dragenter', 'dragover'].forEach(evtName => {
                box.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    box.style.borderColor = '#18181B';
                    box.style.background = 'rgba(225,29,72,0.15)';
                    box.style.transform = 'scale(1.18)';
                    box.style.boxShadow = '0 0 0 3px rgba(225,29,72,0.25)';
                });
            });

            ['dragleave', 'dragend', 'drop'].forEach(evtName => {
                box.addEventListener(evtName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    box.style.transform = 'none';
                    box.style.boxShadow = 'none';
                });
            });

            box.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const files = e.dataTransfer?.files;
                if (files && files.length > 0 && rowDataList[idx]) {
                    const processed = await processMarketImageFile(files[0]);
                    rowDataList[idx].imageFile = processed;
                    rowDataList[idx].previewUrl = URL.createObjectURL(processed);
                    renderRows();
                }
            });
        });

        // File input changes
        tbody.querySelectorAll('.mi-file-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const idx = parseInt(e.target.getAttribute('data-index'));
                const file = e.target.files[0];
                if (file && rowDataList[idx]) {
                    const processed = await processMarketImageFile(file);
                    rowDataList[idx].imageFile = processed;
                    rowDataList[idx].previewUrl = URL.createObjectURL(processed);
                    renderRows();
                }
            });
        });

        // Remove image
        tbody.querySelectorAll('.mi-remove-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList[idx]) {
                    rowDataList[idx].imageFile = null;
                    rowDataList[idx].previewUrl = '';
                    rowDataList[idx].imageUri = '';
                    renderRows();
                }
            });
        });

        // Duplicate Row
        tbody.querySelectorAll('.mi-btn-dup').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList.length >= MAX_ROWS) {
                    showAlert.error(`Maximum row limit of ${MAX_ROWS} reached.`);
                    return;
                }
                const original = rowDataList[idx];
                const clone = {
                    ...original,
                    id: 'row_' + Math.random().toString(36).substring(2, 9),
                    name: original.name ? `${original.name} (Copy)` : '',
                    variations: JSON.parse(JSON.stringify(original.variations || []))
                };
                rowDataList.splice(idx + 1, 0, clone);
                renderRows();
            });
        });

        // Delete Row
        tbody.querySelectorAll('.mi-btn-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                if (rowDataList.length <= 1) {
                    rowDataList = [createBlankRow()];
                } else {
                    rowDataList.splice(idx, 1);
                }
                renderRows();
            });
        });

        // Variations Manager Trigger
        tbody.querySelectorAll('.mi-btn-vars').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                openVariationsEditor(idx);
            });
        });
    };

    // Helper: Add N rows up to MAX_ROWS (300)
    const addRows = (count) => {
        const available = MAX_ROWS - rowDataList.length;
        if (available <= 0) {
            showAlert.error(`Maximum limit of ${MAX_ROWS} rows reached.`);
            return;
        }
        const toAdd = Math.min(count, available);
        for (let i = 0; i < toAdd; i++) {
            rowDataList.push(createBlankRow());
        }
        renderRows();
        const gridCont = container.querySelector('#mi-grid-container');
        if (gridCont) gridCont.scrollTop = gridCont.scrollHeight;
    };

    container.querySelector('#mi-btn-add-1').addEventListener('click', () => addRows(1));
    container.querySelector('#mi-btn-add-5').addEventListener('click', () => addRows(5));
    container.querySelector('#mi-btn-add-10').addEventListener('click', () => addRows(10));
    container.querySelector('#mi-btn-add-50').addEventListener('click', () => addRows(50));

    // Clear Empty Rows (removes rows where user hasn't typed meaningful data)
    container.querySelector('#mi-btn-clear-empty').addEventListener('click', () => {
        const filtered = rowDataList.filter(r => hasRowMeaningfulData(r));
        if (filtered.length === 0) {
            rowDataList = [createBlankRow()];
        } else {
            rowDataList = filtered;
        }
        renderRows();
        showAlert.success('Empty rows cleared');
    });

    // Bulk Apply Category
    container.querySelector('#mi-btn-apply-cat').addEventListener('click', () => {
        const catSelect = container.querySelector('#mi-bulk-cat-select');
        const chosenCat = catSelect.value;
        if (!chosenCat) {
            showAlert.error('Please select a category first.');
            return;
        }
        rowDataList.forEach(r => {
            r.category = chosenCat;
        });
        renderRows();
        showAlert.success('Category applied to all rows');
    });

    // Back to Products Button with Unsaved Changes Protection
    container.querySelector('#mi-btn-cancel-to-products').addEventListener('click', async () => {
        if (checkHasUnsavedData()) {
            const allowLeave = await showAlert.confirmUnsavedChanges(
                'You have entered product rows that have not been inserted yet. Leaving now will discard all of these entries.'
            );
            if (!allowLeave) return;
        }
        window._marketInserterHasUnsaved = () => false;
        window.removeEventListener('beforeunload', onBeforeUnloadHandler);
        document.body.classList.remove('mi-fullscreen-active');
        document.body.style.overflow = '';
        window.location.hash = '#/products';
    });

    // Variations Sub-Modal Logic
    let activeVarRowIndex = null;
    let tempVars = [];
    const varModal = container.querySelector('#mi-var-modal');
    const varListEl = container.querySelector('#mi-var-list');
    const varTargetNameEl = container.querySelector('#mi-var-target-name');

    const renderVarList = () => {
        if (tempVars.length === 0) {
            varListEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No variations configured for this row. Click below to add.</div>`;
            return;
        }
        varListEl.innerHTML = tempVars.map((v, i) => `
            <div style="display:flex; gap:0.5rem; align-items:center; background:var(--surface-50); padding:0.5rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                <div style="flex:1;">
                    <label style="font-size:0.7rem; color:var(--text-secondary); display:block; margin-bottom:0.2rem;">Size / Flavor</label>
                    <input type="text" class="form-control mi-var-name" data-vidx="${i}" value="${v.sizeFlavor || ''}" placeholder="e.g. 500g / Vanilla" style="width:100%; font-size:0.8rem; padding:0.35rem 0.5rem;">
                </div>
                <div style="flex:1;">
                    <label style="font-size:0.7rem; color:var(--text-secondary); display:block; margin-bottom:0.2rem;">UPC / Barcode</label>
                    <input type="text" class="form-control mi-var-upc" data-vidx="${i}" value="${v.upcCode || ''}" placeholder="Barcode" style="width:100%; font-size:0.8rem; padding:0.35rem 0.5rem; font-family:monospace;">
                </div>
                <button type="button" class="icon-btn mi-var-remove" data-vidx="${i}" style="margin-top:1rem; border:none; background:transparent; cursor:pointer; color:var(--danger); width:28px; height:28px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
        `).join('');

        varListEl.querySelectorAll('.mi-var-name').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const vi = parseInt(e.target.getAttribute('data-vidx'));
                if (tempVars[vi]) tempVars[vi].sizeFlavor = e.target.value;
            });
        });

        varListEl.querySelectorAll('.mi-var-upc').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const vi = parseInt(e.target.getAttribute('data-vidx'));
                if (tempVars[vi]) tempVars[vi].upcCode = e.target.value;
            });
        });

        varListEl.querySelectorAll('.mi-var-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vi = parseInt(btn.getAttribute('data-vidx'));
                tempVars.splice(vi, 1);
                renderVarList();
            });
        });
    };

    const openVariationsEditor = (rowIndex) => {
        activeVarRowIndex = rowIndex;
        const row = rowDataList[rowIndex];
        varTargetNameEl.textContent = `Row #${rowIndex + 1}: ${row.name || 'Unnamed Product'}`;
        tempVars = JSON.parse(JSON.stringify(row.variations || []));
        renderVarList();
        varModal.style.display = 'flex';
    };

    container.querySelector('#mi-var-add-row').addEventListener('click', () => {
        tempVars.push({ sizeFlavor: '', upcCode: '' });
        renderVarList();
    });

    container.querySelector('#mi-var-save').addEventListener('click', () => {
        if (activeVarRowIndex !== null && rowDataList[activeVarRowIndex]) {
            const cleaned = tempVars.filter(v => (v.sizeFlavor || '').trim() !== '' || (v.upcCode || '').trim() !== '');
            rowDataList[activeVarRowIndex].variations = cleaned;
            renderRows();
        }
        varModal.style.display = 'none';
    });

    const closeVarModal = () => { varModal.style.display = 'none'; };
    container.querySelector('#mi-var-close-x').addEventListener('click', closeVarModal);
    container.querySelector('#mi-var-cancel').addEventListener('click', closeVarModal);

    // Fullscreen Toggle & Persistent Memory across reload/refresh
    const pageEl = container.querySelector('.market-inserter-page');
    const fsToggleBtn = container.querySelector('#mi-btn-fullscreen-toggle');
    const fsLabel = container.querySelector('#mi-fs-label');
    const iconExpand = fsToggleBtn?.querySelector('.mi-icon-expand');
    const iconCollapse = fsToggleBtn?.querySelector('.mi-icon-collapse');

    const applyFullscreenState = (isFullscreen) => {
        if (!pageEl) return;
        if (isFullscreen) {
            pageEl.classList.add('mi-fullscreen-mode');
            document.body.classList.add('mi-fullscreen-active');
            document.body.style.overflow = 'hidden';
            if (fsLabel) fsLabel.textContent = 'Collapse';
            if (iconExpand) iconExpand.style.display = 'none';
            if (iconCollapse) iconCollapse.style.display = 'inline-block';
        } else {
            pageEl.classList.remove('mi-fullscreen-mode');
            document.body.classList.remove('mi-fullscreen-active');
            document.body.style.overflow = '';
            if (fsLabel) fsLabel.textContent = 'Expand';
            if (iconExpand) iconExpand.style.display = 'inline-block';
            if (iconCollapse) iconCollapse.style.display = 'none';
        }
    };

    // Check remembered fullscreen state from localStorage
    const isPersistedFs = localStorage.getItem('plister_market_inserter_fullscreen') === 'true';
    if (isPersistedFs) {
        applyFullscreenState(true);
    }

    fsToggleBtn?.addEventListener('click', () => {
        const currentlyFs = pageEl.classList.contains('mi-fullscreen-mode');
        const newFsState = !currentlyFs;
        localStorage.setItem('plister_market_inserter_fullscreen', String(newFsState));
        applyFullscreenState(newFsState);
    });

    // Cell Sizer (+ and -) Controls: expand or reduce selected cell/column within strict limits
    const btnCellPlus = container.querySelector('#mi-btn-cell-plus');
    const btnCellMinus = container.querySelector('#mi-btn-cell-minus');

    btnCellPlus?.addEventListener('click', () => {
        if (btnCellPlus.disabled) return;
        if (selectedCell.col && colWidths[selectedCell.col] !== undefined) {
            if (colWidths[selectedCell.col] < MAX_CELL_WIDTH) {
                colWidths[selectedCell.col] = Math.min(MAX_CELL_WIDTH, colWidths[selectedCell.col] + 25);
                updateColStyles();
            }
        } else {
            // Proportionally expand all columns within MAX_CELL_WIDTH limit
            let changed = false;
            Object.keys(colWidths).forEach(k => {
                if (colWidths[k] < MAX_CELL_WIDTH) {
                    colWidths[k] = Math.min(MAX_CELL_WIDTH, Math.round(colWidths[k] * 1.1));
                    changed = true;
                }
            });
            if (changed) updateColStyles();
        }
        updateCellSizerButtonStates();
    });

    btnCellMinus?.addEventListener('click', () => {
        if (btnCellMinus.disabled) return;
        if (selectedCell.col && colWidths[selectedCell.col] !== undefined) {
            if (colWidths[selectedCell.col] > MIN_CELL_WIDTH) {
                colWidths[selectedCell.col] = Math.max(MIN_CELL_WIDTH, colWidths[selectedCell.col] - 25);
                updateColStyles();
            }
        } else {
            // Proportionally contract all columns within MIN_CELL_WIDTH limit
            let changed = false;
            Object.keys(colWidths).forEach(k => {
                if (colWidths[k] > MIN_CELL_WIDTH) {
                    colWidths[k] = Math.max(MIN_CELL_WIDTH, Math.round(colWidths[k] * 0.9));
                    changed = true;
                }
            });
            if (changed) updateColStyles();
        }
        updateCellSizerButtonStates();
    });

    // Ratio & Density Scale Controllers
    const gridCont = container.querySelector('#mi-grid-container');
    const densityLabel = container.querySelector('#mi-density-label');
    let currentDensityIdx = 1; // 0 = Compact, 1 = Normal, 2 = Relaxed
    const densityModes = [
        { name: 'Compact', attr: 'compact' },
        { name: 'Normal', attr: 'normal' },
        { name: 'Relaxed', attr: 'relaxed' }
    ];

    container.querySelector('#mi-btn-density-toggle')?.addEventListener('click', () => {
        currentDensityIdx = (currentDensityIdx + 1) % densityModes.length;
        const chosen = densityModes[currentDensityIdx];
        if (gridCont) gridCont.setAttribute('data-zoom', chosen.attr);
        if (densityLabel) densityLabel.textContent = chosen.name;
    });

    // ----------------------------------------------------
    // Options Highlighter Controllers (Cell / Column / Row)
    // ----------------------------------------------------
    const scopeBtnCell = container.querySelector('#mi-hl-scope-cell');
    const scopeBtnCol = container.querySelector('#mi-hl-scope-col');
    const scopeBtnRow = container.querySelector('#mi-hl-scope-row');
    const scopeBtns = [scopeBtnCell, scopeBtnCol, scopeBtnRow].filter(Boolean);

    const setHighlightScope = (newScope) => {
        highlightState.scope = newScope;
        scopeBtns.forEach(btn => {
            const isMatch = btn.getAttribute('data-scope') === newScope;
            btn.classList.toggle('active', isMatch);
            btn.style.background = isMatch ? '#18181b' : 'transparent';
            btn.style.color = isMatch ? '#ffffff' : '#52525b';
            btn.style.fontWeight = isMatch ? '700' : '600';
        });
    };

    scopeBtnCell?.addEventListener('click', () => setHighlightScope('cell'));
    scopeBtnCol?.addEventListener('click', () => setHighlightScope('col'));
    scopeBtnRow?.addEventListener('click', () => setHighlightScope('row'));

    const applyHighlightColor = (colorKeyOrHex) => {
        highlightState.activeColor = colorKeyOrHex;
        const colorInfo = HL_PRESETS[colorKeyOrHex] || getCustomColorInfo(colorKeyOrHex);

        // Update active indicator on preset buttons
        container.querySelectorAll('.mi-hl-color-btn').forEach(btn => {
            btn.classList.toggle('active-hl', btn.getAttribute('data-color') === colorKeyOrHex);
        });

        const scope = highlightState.scope;
        if (scope === 'col') {
            const col = selectedCell.col;
            if (!col) {
                showAlert.info('Select a column first (click column header or cell) to highlight.');
                return;
            }
            highlightState.cols.set(col, colorInfo);
            container.querySelectorAll(`#mi-grid-table [data-col="${col}"]`).forEach(el => {
                applyColorToElement(el, colorInfo);
            });
        } else if (scope === 'row') {
            const rowIdx = selectedCell.rowIdx;
            if (rowIdx === null || rowIdx === undefined || isNaN(rowIdx)) {
                showAlert.info('Select a row first to highlight.');
                return;
            }
            highlightState.rows.set(rowIdx, colorInfo);
            const tr = tbody.querySelector(`tr[data-index="${rowIdx}"]`);
            if (tr) applyColorToElement(tr, colorInfo);
        } else {
            // Scope: cell
            const td = selectedCell.el?.closest ? (selectedCell.el.closest('td') || (selectedCell.el.tagName === 'TD' ? selectedCell.el : null)) : null;
            const col = selectedCell.col;
            const rowIdx = selectedCell.rowIdx;

            if (td && rowIdx !== null && col) {
                const cellKey = `${rowIdx}_${col}`;
                highlightState.cells.set(cellKey, colorInfo);
                applyColorToElement(td, colorInfo);
            } else if (selectedCell.el?.tagName === 'TH' && selectedCell.col) {
                // If header selected while in cell mode, highlight column
                highlightState.cols.set(selectedCell.col, colorInfo);
                container.querySelectorAll(`#mi-grid-table [data-col="${selectedCell.col}"]`).forEach(el => {
                    applyColorToElement(el, colorInfo);
                });
            } else {
                showAlert.info('Click or select a cell to apply highlight.');
            }
        }
    };

    container.querySelectorAll('.mi-hl-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = btn.getAttribute('data-color');
            applyHighlightColor(color);
        });
    });

    const customColorInput = container.querySelector('#mi-hl-custom-input');
    customColorInput?.addEventListener('input', (e) => {
        const hex = e.target.value;
        applyHighlightColor(hex);
    });

    container.querySelector('#mi-hl-clear-btn')?.addEventListener('click', () => {
        const scope = highlightState.scope;
        if (scope === 'col' && selectedCell.col) {
            highlightState.cols.delete(selectedCell.col);
            container.querySelectorAll(`#mi-grid-table [data-col="${selectedCell.col}"]`).forEach(el => {
                removeColorFromElement(el);
            });
        } else if (scope === 'row' && selectedCell.rowIdx !== null) {
            highlightState.rows.delete(selectedCell.rowIdx);
            const tr = tbody.querySelector(`tr[data-index="${selectedCell.rowIdx}"]`);
            if (tr) removeColorFromElement(tr);
        } else if (selectedCell.rowIdx !== null && selectedCell.col) {
            const cellKey = `${selectedCell.rowIdx}_${selectedCell.col}`;
            highlightState.cells.delete(cellKey);
            const td = selectedCell.el?.closest ? (selectedCell.el.closest('td') || selectedCell.el) : null;
            if (td) removeColorFromElement(td);
        } else {
            showAlert.info('Select a highlighted cell, column, or row to clear.');
        }
    });

    container.querySelector('#mi-hl-clear-all-btn')?.addEventListener('click', () => {
        highlightState.cells.clear();
        highlightState.rows.clear();
        highlightState.cols.clear();
        container.querySelectorAll('.mi-hl-applied, .mi-hl-green, .mi-hl-red, .mi-hl-blue, .mi-hl-yellow').forEach(el => {
            removeColorFromElement(el);
        });
    });

    // Advanced Pan System: Right-click Drag, Ctrl + Mouse movement, & Arrow Keys
    if (gridCont) {
        let isRightClickPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let panScrollLeft = 0;
        let panScrollTop = 0;
        let hasMovedDuringPan = false;
        let lastCtrlX = 0;
        let lastCtrlY = 0;

        gridCont.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right click
                isRightClickPanning = true;
                hasMovedDuringPan = false;
                panStartX = e.clientX;
                panStartY = e.clientY;
                panScrollLeft = gridCont.scrollLeft;
                panScrollTop = gridCont.scrollTop;
                gridCont.classList.add('mi-panning');
            }
        });

        window.addEventListener('mousemove', (e) => {
            // 1. Right Click Drag Pan
            if (isRightClickPanning) {
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    hasMovedDuringPan = true;
                }
                gridCont.scrollLeft = panScrollLeft - dx;
                gridCont.scrollTop = panScrollTop - dy;
                return;
            }

            // 2. Ctrl + Mouse Movement Pan
            if (e.ctrlKey) {
                gridCont.classList.add('mi-panning');
                if (lastCtrlX !== 0 && lastCtrlY !== 0) {
                    const dx = e.clientX - lastCtrlX;
                    const dy = e.clientY - lastCtrlY;
                    gridCont.scrollLeft -= dx;
                    gridCont.scrollTop -= dy;
                }
                lastCtrlX = e.clientX;
                lastCtrlY = e.clientY;
            } else {
                lastCtrlX = 0;
                lastCtrlY = 0;
                if (!isRightClickPanning) gridCont.classList.remove('mi-panning');
            }
        });

        const stopRightClickPan = () => {
            if (isRightClickPanning) {
                isRightClickPanning = false;
                gridCont.classList.remove('mi-panning');
            }
        };
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) stopRightClickPan();
        });

        window.addEventListener('keyup', (e) => {
            if (e.key === 'Control') {
                lastCtrlX = 0;
                lastCtrlY = 0;
                if (!isRightClickPanning) gridCont.classList.remove('mi-panning');
            }
        });

        gridCont.addEventListener('mouseleave', () => {
            lastCtrlX = 0;
            lastCtrlY = 0;
            if (!isRightClickPanning) gridCont.classList.remove('mi-panning');
        });

        gridCont.addEventListener('contextmenu', (e) => {
            if (hasMovedDuringPan) {
                e.preventDefault();
                hasMovedDuringPan = false;
            }
        });

        // 3. Ctrl + Arrow Keys Smooth Pan (Without Ctrl, ArrowUp & ArrowDown scroll the page up & down naturally)
        window.addEventListener('keydown', (e) => {
            const isCtrlArrow = e.ctrlKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
            if (isCtrlArrow) {
                e.preventDefault();
                const step = e.shiftKey ? 140 : 70;
                if (e.key === 'ArrowLeft') gridCont.scrollLeft -= step;
                if (e.key === 'ArrowRight') gridCont.scrollLeft += step;
                if (e.key === 'ArrowUp') gridCont.scrollTop -= step;
                if (e.key === 'ArrowDown') gridCont.scrollTop += step;
            }
        });

        // Keyboard cell resizing shortcut: Alt + Plus / Alt + Minus
        gridCont.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                container.querySelector('#mi-btn-cell-plus')?.click();
            } else if (e.altKey && (e.key === '-' || e.key === '_')) {
                e.preventDefault();
                container.querySelector('#mi-btn-cell-minus')?.click();
            }
        });
    }

    // Top duplicate action shortcuts
    container.querySelector('#mi-btn-top-add-row')?.addEventListener('click', () => {
        addRows(1);
    });
    container.querySelector('#mi-btn-top-submit')?.addEventListener('click', () => {
        container.querySelector('#mi-btn-submit')?.click();
    });

    container.querySelector('#mi-btn-discard-batch')?.addEventListener('click', () => {
        sessionStorage.removeItem('plister_market_batch_transfer');
        renderMarketInserter(container, workspaceId);
    });

    // Breakdown Modal References & Logic
    const breakdownModal = container.querySelector('#mi-breakdown-modal');
    const breakdownTbody = container.querySelector('#mi-breakdown-tbody');
    const kpiInserted = container.querySelector('#mi-kpi-inserted');
    const kpiRejected = container.querySelector('#mi-kpi-rejected');
    const kpiSkipped = container.querySelector('#mi-kpi-skipped');
    const btnFixRejected = container.querySelector('#mi-breakdown-btn-fix');
    const btnBreakdownCatalog = container.querySelector('#mi-breakdown-btn-catalog');
    const breakdownHint = container.querySelector('#mi-breakdown-hint');
    const breakdownTitle = container.querySelector('#mi-breakdown-title');
    const breakdownIcon = container.querySelector('#mi-breakdown-icon');

    // Strict 3-Field Rule Evaluation Helper
    // Evaluates every row: Must have Product Name*, Category*, Sale Price* (> 0)
    const evaluateGridRows = () => {
        const results = [];
        let validCount = 0;
        let rejectedCount = 0;
        let skippedCount = 0;

        rowDataList.forEach((row, idx) => {
            const rowNum = idx + 1;
            const name = (row.name || '').trim();
            const category = (row.category || '').trim();
            const salePrice = Number(row.salePrice) || 0;

            const hasData = hasRowMeaningfulData(row);

            // 1. Skipped blank row
            if (!hasData && !name && salePrice === 0) {
                skippedCount++;
                results.push({
                    index: idx,
                    rowNum,
                    row,
                    status: 'SKIPPED',
                    name: '(Empty row)',
                    category: '',
                    salePrice: 0,
                    reason: 'Completely blank row (Skipped automatically)'
                });
                return;
            }

            // 2. Strict 3-Field Rule: Product Name*, Category*, Sale Price* (> 0)
            const missing = [];
            if (!name) missing.push('Product Name');
            if (!category) missing.push('Category');
            if (salePrice <= 0) missing.push('Sale Price');

            if (missing.length === 0) {
                validCount++;
                results.push({
                    index: idx,
                    rowNum,
                    row,
                    status: 'VALID',
                    name,
                    category,
                    salePrice,
                    reason: 'All 3 required fields valid'
                });
            } else {
                rejectedCount++;
                const fulfilled = 3 - missing.length;
                results.push({
                    index: idx,
                    rowNum,
                    row,
                    status: 'REJECTED',
                    missing,
                    name: name || '(No Name)',
                    category,
                    salePrice,
                    reason: `Failed Validation (${fulfilled}/3 fields): Missing ${missing.join(', ')}`
                });
            }
        });

        return {
            results,
            validRows: results.filter(r => r.status === 'VALID'),
            rejectedRows: results.filter(r => r.status === 'REJECTED'),
            skippedRows: results.filter(r => r.status === 'SKIPPED'),
            validCount,
            rejectedCount,
            skippedCount
        };
    };

    let lastEvaluation = null;
    let lastWasInserted = true;

    // Show Completion & Breakdown Modal
    const showBreakdownModal = (evaluation, wasInserted = true) => {
        lastEvaluation = evaluation;
        lastWasInserted = wasInserted;
        kpiInserted.textContent = evaluation.validCount;
        kpiRejected.textContent = evaluation.rejectedCount;
        kpiSkipped.textContent = evaluation.skippedCount;

        if (wasInserted) {
            breakdownTitle.textContent = isBatchUpdateMode ? 'Batch Update Complete' : 'Batch Insertion Complete';
            breakdownIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            breakdownIcon.style.color = '#10b981';
            breakdownIcon.style.background = 'rgba(16, 185, 129, 0.12)';
        } else {
            breakdownTitle.textContent = 'Insertion Guard: Incomplete Rows Detected';
            breakdownIcon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            breakdownIcon.style.color = '#ef4444';
            breakdownIcon.style.background = 'rgba(239, 68, 68, 0.12)';
        }

        breakdownTbody.innerHTML = evaluation.results.map(r => {
            let statusBadge = '';
            let rowBg = '';
            if (r.status === 'VALID') {
                statusBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; color:#15803d; background:#dcfce7; padding:0.2rem 0.55rem; border-radius:4px; border:1px solid #bbf7d0;">${wasInserted ? 'Inserted' : 'Ready'}</span>`;
            } else if (r.status === 'REJECTED') {
                statusBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:700; color:#b91c1c; background:#fee2e2; padding:0.2rem 0.55rem; border-radius:4px; border:1px solid #fecaca;">Rejected</span>`;
                rowBg = 'background: rgba(254, 242, 242, 0.4);';
            } else {
                statusBadge = `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; font-weight:600; color:#64748b; background:#f1f5f9; padding:0.2rem 0.55rem; border-radius:4px; border:1px solid #e2e8f0;">Skipped</span>`;
            }

            return `
                <tr style="border-bottom: 1px solid var(--border-color); ${rowBg}">
                    <td style="padding: 0.5rem 0.75rem; font-weight: 700; color: var(--text-muted);">${r.rowNum}</td>
                    <td style="padding: 0.5rem 0.75rem; font-weight: 600; color: var(--text-primary);">${r.name}</td>
                    <td style="padding: 0.5rem 0.75rem;">${statusBadge}</td>
                    <td style="padding: 0.5rem 0.75rem; color: var(--text-secondary); font-size: 0.8rem;">${r.reason}</td>
                </tr>
            `;
        }).join('');

        if (evaluation.rejectedCount > 0) {
            btnFixRejected.style.display = 'inline-flex';
            btnFixRejected.textContent = `Fix Rejected Rows (${evaluation.rejectedCount})`;
            breakdownHint.textContent = `${evaluation.rejectedCount} row(s) rejected due to missing required fields (Product Name, Category and Sale Price).`;
        } else {
            btnFixRejected.style.display = 'none';
            breakdownHint.textContent = `All active rows successfully verified under the validation rules.`;
        }

        // Action button states strictly based on user rules:
        if (wasInserted) {
            btnBreakdownCatalog.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Done &amp; Save`;
            btnBreakdownCatalog.className = 'btn btn-primary';
            btnBreakdownCatalog.style.cssText = 'font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 6px; background: #18181b; color: #ffffff; cursor: pointer;';
        } else {
            if (evaluation.validCount === 0) {
                // Rule 1: No valid products -> Cancel & Back instead of Done
                btnBreakdownCatalog.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Cancel &amp; Back`;
                btnBreakdownCatalog.className = 'btn';
                btnBreakdownCatalog.style.cssText = 'font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 6px; background: #ffffff; color: #18181b; border: 1.5px solid #d4d4d8; cursor: pointer;';
            } else if (evaluation.rejectedCount === 0) {
                // Rule 2: All valid -> Done & Save
                btnBreakdownCatalog.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Done &amp; Save`;
                btnBreakdownCatalog.className = 'btn btn-primary';
                btnBreakdownCatalog.style.cssText = 'font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 6px; background: #18181b; color: #ffffff; cursor: pointer;';
            } else {
                // Rule 3: Some valid -> Insert Valids
                btnBreakdownCatalog.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> Insert Valids (${evaluation.validCount})`;
                btnBreakdownCatalog.className = 'btn btn-primary';
                btnBreakdownCatalog.style.cssText = 'font-size: 0.84rem; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 6px; background: #16a34a; color: #ffffff; border: none; cursor: pointer;';
            }
        }

        // Mount directly to document.body so the backdrop covers the entire viewport including sidebar navigation
        if (breakdownModal && breakdownModal.parentElement !== document.body) {
            document.body.appendChild(breakdownModal);
        }
        breakdownModal.style.display = 'flex';
    };

    // Fix Rejected Rows button: Keeps ONLY rejected rows in grid and highlights missing inputs
    btnFixRejected?.addEventListener('click', () => {
        breakdownModal.style.display = 'none';
        const evaluation = evaluateGridRows();
        if (evaluation.rejectedRows.length > 0) {
            rowDataList = evaluation.rejectedRows.map(r => r.row);
            renderRows();

            // Highlight the missing inputs on each row
            evaluation.rejectedRows.forEach((r, newIdx) => {
                const tr = tbody.querySelector(`tr[data-index="${newIdx}"]`);
                if (!tr) return;
                tr.classList.add('mi-row-rejected');
                if (r.missing.includes('Product Name')) {
                    const inp = tr.querySelector('.mi-input-name');
                    if (inp) inp.classList.add('mi-input-error');
                }
                if (r.missing.includes('Category')) {
                    const sel = tr.querySelector('[data-field="category"]');
                    if (sel) sel.classList.add('mi-input-error');
                }
                if (r.missing.includes('Sale Price (> 0)')) {
                    const sp = tr.querySelector('.mi-sale-price');
                    if (sp) sp.classList.add('mi-input-error');
                }
            });

            showAlert.warning(`Grid loaded with ${evaluation.rejectedRows.length} rejected row(s). Please fill in the highlighted missing fields.`);
        }
    });

    btnBreakdownCatalog?.addEventListener('click', async () => {
        if (lastWasInserted) {
            breakdownModal.style.display = 'none';
            document.body.classList.remove('mi-fullscreen-active');
            document.body.style.overflow = '';
            window.location.hash = '#/products';
        } else if (lastEvaluation && lastEvaluation.validCount === 0) {
            // Cancel & Back to grid
            breakdownModal.style.display = 'none';
        } else if (lastEvaluation && lastEvaluation.validCount > 0) {
            // Insert Valids
            breakdownModal.style.display = 'none';
            const valids = lastEvaluation.validRows.map(r => r.row);
            await executeBatchInsertion(valids, lastEvaluation.rejectedRows);
        }
    });

    container.querySelector('#mi-breakdown-close-x')?.addEventListener('click', () => {
        breakdownModal.style.display = 'none';
    });

    // Cleanup modal from document.body on navigation
    window.addEventListener('hashchange', () => {
        if (breakdownModal && breakdownModal.parentElement === document.body) {
            breakdownModal.remove();
        }
    }, { once: true });

    // Initial render
    renderRows();

    // 4. Batch Insertion Engine (Handles full & partial valid insertions)
    const btnSubmit = container.querySelector('#mi-btn-submit');
    const progressOverlay = container.querySelector('#mi-progress-overlay');
    const progressBarFill = container.querySelector('#mi-progress-bar-fill');
    const progressCount = container.querySelector('#mi-progress-count');
    const progressPercent = container.querySelector('#mi-progress-percent');
    const progressItemName = container.querySelector('#mi-progress-item-name');

    const executeBatchInsertion = async (validProducts, rejectedRows = []) => {
        const toUpdate = validProducts.filter(r => r.existingId);
        const toAdd = validProducts.filter(r => !r.existingId);

        // Duplicate warning confirmation for brand new products
        if (toAdd.length > 0) {
            const dupCount = toAdd.filter(p => {
                const clean = p.name.trim().toLowerCase();
                return existingProducts.some(ep => (ep.name || '').trim().toLowerCase() === clean);
            }).length;

            if (dupCount > 0) {
                const proceed = await showAlert.confirm(`${dupCount} of the new products already exist in your workspace. Do you want to continue inserting them?`);
                if (!proceed) return;
            }
        }

        // Submitting flag active: Suppress unsaved changes alerts during insertion
        isSubmitting = true;
        window._marketInserterHasUnsaved = () => false;

        // Show progress overlay
        progressOverlay.style.display = 'flex';
        progressCount.textContent = `0 of ${validProducts.length}`;
        progressPercent.textContent = `0%`;
        progressBarFill.style.width = `0%`;

        try {
            // 1. Process updates for transferred existing products
            for (let i = 0; i < toUpdate.length; i++) {
                const item = toUpdate[i];
                const progressNum = i + 1;
                const percent = Math.round((progressNum / validProducts.length) * 100);
                progressBarFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                progressCount.textContent = `${progressNum} of ${validProducts.length}`;
                progressItemName.textContent = `Updating: ${item.name}`;

                let finalImageUri = item.imageUri || '';
                if (item.imageFile instanceof File || item.imageFile instanceof Blob) {
                    try {
                        finalImageUri = await storageService.uploadImage(item.imageFile, workspaceId);
                    } catch (imgErr) {
                        console.warn(`Failed to upload image for ${item.name}:`, imgErr);
                    }
                }

                const updatePayload = {
                    name: item.name || '',
                    category: item.category || '',
                    sizeWeight: item.sizeWeight || '',
                    quantity: Number(item.quantity) || 0,
                    basePrice: Number(item.basePrice) || 0,
                    price: Number(item.price) || 0,
                    salePrice: Number(item.salePrice) || 0,
                    mrp: Number(item.mrp) || 0,
                    mfgDate: item.mfgDate ? normalizeProductDate(item.mfgDate) : '',
                    expDate: item.expDate ? normalizeProductDate(item.expDate) : '',
                    note: item.note || '',
                    upcCode: item.upcCode || '',
                    variations: Array.isArray(item.variations) ? item.variations : []
                };
                if (finalImageUri) updatePayload.imageUri = finalImageUri;

                await productService.updateProduct(item.existingId, updatePayload, null, currentUser.uid);
            }

            // 2. Process additions if any
            if (toAdd.length > 0) {
                // Ensure date format is DD-MM-YYYY before saving to database
                const sanitizedToAdd = toAdd.map(item => ({
                    ...item,
                    mfgDate: item.mfgDate ? normalizeProductDate(item.mfgDate) : '',
                    expDate: item.expDate ? normalizeProductDate(item.expDate) : ''
                }));

                await productService.bulkAddProducts(
                    sanitizedToAdd,
                    currentUser.uid,
                    null,
                    (current, total, currentName) => {
                        const totalDone = toUpdate.length + current;
                        const percent = Math.round((totalDone / validProducts.length) * 100);
                        progressBarFill.style.width = `${percent}%`;
                        progressPercent.textContent = `${percent}%`;
                        progressCount.textContent = `${totalDone} of ${validProducts.length}`;
                        progressItemName.textContent = `Inserting: ${currentName}`;
                    }
                );
            }

            // Progress complete animation
            progressBarFill.style.width = '100%';
            progressPercent.textContent = '100%';
            progressItemName.textContent = 'Finalizing catalog records...';
            await new Promise(r => setTimeout(r, 350));

            progressOverlay.style.display = 'none';

            if (rejectedRows.length > 0) {
                // Partial valid insertion: some rows inserted, remaining rejected rows stay in grid
                rowDataList = rejectedRows.map(r => r.row);
                renderRows();
                rejectedRows.forEach((r, newIdx) => {
                    const tr = tbody.querySelector(`tr[data-index="${newIdx}"]`);
                    if (!tr) return;
                    tr.classList.add('mi-row-rejected');
                    if (r.missing.includes('Product Name')) tr.querySelector('.mi-input-name')?.classList.add('mi-input-error');
                    if (r.missing.includes('Category')) tr.querySelector('[data-field="category"]')?.classList.add('mi-input-error');
                    if (r.missing.includes('Sale Price (> 0)')) tr.querySelector('.mi-sale-price')?.classList.add('mi-input-error');
                });
                isSubmitting = false;
                showAlert.success(`Successfully inserted ${validProducts.length} valid product(s). ${rejectedRows.length} incomplete row(s) remain in grid.`);
            } else {
                sessionStorage.removeItem('plister_market_batch_transfer');
                window._marketInserterHasUnsaved = () => false;
                window.removeEventListener('beforeunload', onBeforeUnloadHandler);

                const finalEvaluation = {
                    validCount: validProducts.length,
                    rejectedCount: 0,
                    skippedCount: rowDataList.length - validProducts.length,
                    results: validProducts.map((p, i) => ({
                        rowNum: i + 1,
                        name: p.name,
                        status: 'VALID',
                        reason: 'Successfully inserted to catalog'
                    }))
                };
                showBreakdownModal(finalEvaluation, true);
            }

        } catch (err) {
            isSubmitting = false;
            progressOverlay.style.display = 'none';
            showAlert.error(err.message || 'Failed to complete batch operations');
        }
    };

    btnSubmit.addEventListener('click', async () => {
        // Evaluate all rows under Strict 3-Field Rule
        const evaluation = evaluateGridRows();

        if (evaluation.rejectedCount > 0) {
            // Highlight rejected rows in grid
            evaluation.rejectedRows.forEach(r => {
                const tr = tbody.querySelector(`tr[data-index="${r.index}"]`);
                if (!tr) return;
                tr.classList.add('mi-row-rejected');
                if (r.missing.includes('Product Name')) {
                    const inp = tr.querySelector('.mi-input-name');
                    if (inp) inp.classList.add('mi-input-error');
                }
                if (r.missing.includes('Category')) {
                    const sel = tr.querySelector('[data-field="category"]');
                    if (sel) sel.classList.add('mi-input-error');
                }
                if (r.missing.includes('Sale Price (> 0)')) {
                    const sp = tr.querySelector('.mi-sale-price');
                    if (sp) sp.classList.add('mi-input-error');
                }
            });
            showBreakdownModal(evaluation, false);
            return;
        }

        if (evaluation.validCount === 0) {
            showAlert.warning('Please enter product details. Every row requires Product Name*, Category*, and Sale Price* (> 0).');
            return;
        }

        const validProducts = evaluation.validRows.map(r => r.row);
        await executeBatchInsertion(validProducts, []);
    });
};

/**
 * Backward compatibility helper for modal caller -> redirects to the dedicated route
 */
export const openMarketInserterModal = (workspaceId, onDone) => {
    window.location.hash = '#/market-inserter';
};
