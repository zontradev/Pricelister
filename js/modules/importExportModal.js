/**
 * PriceLister - Import & Export UI Modals
 * Provides interactive Drag & Drop Excel Import with real-time validation,
 * Category auto-clustering & color assignment preview, and granular PDF/Excel Exporter.
 */

import { parseExcelFile, analyzeAndValidateRows, executeBatchImport } from '../utils/excelImportEngine.js';
import { 
    downloadHeadersOnlyTemplate,
    downloadExampleDataTemplate,
    downloadSampleExcelTemplate, 
    exportProductsExcel, 
    exportProductsPdf, 
    exportInvoicesExcel, 
    exportWorkspaceBackupJson 
} from '../utils/exportEngine.js';
import { authService } from '../../firebase/auth.js';
import { firestoreService } from '../../firebase/firestore.js';
import { getProductService } from '../services/productService.js';
import { getCategoryService } from '../services/categoryService.js';
import { showAlert } from '../alert-handler.js';
import { formatCurrency } from '../utilities.js';

/**
 * 1. EXCEL & CSV IMPORT MODAL
 */
export const openExcelImportModal = async (workspaceId, onImportSuccess) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    // Fetch existing categories and products for deduplication and matching
    let existingCategories = [];
    let existingProducts = [];
    try {
        [existingCategories, existingProducts] = await Promise.all([
            categoryService.getAllCategories().catch(() => []),
            productService.getAllActiveProducts().catch(() => [])
        ]);
    } catch (e) {
        console.warn("Could not pre-fetch categories/products:", e);
    }

    // Modal DOM Container
    const existingModal = document.getElementById('excel-import-modal-overlay');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'excel-import-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 1.5rem; animation: fadeIn 0.2s ease;
    `;

    modalOverlay.innerHTML = `
        <div class="card" style="background: var(--surface-0, #ffffff); width: 100%; max-width: 900px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--border-color);">
            
            <!-- Modal Header -->
            <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50, #f8fafc); flex-wrap:wrap; gap:0.75rem;">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="width:36px; height:36px; border-radius:10px; background: rgba(16, 185, 129, 0.15); display:flex; align-items:center; justify-content:center; color: var(--primary);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Excel & CSV Product Import</h3>
                        <p style="margin:0.15rem 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Batch insert products with automatic category clustering & color codes</p>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    <button id="btn-modal-headers-template" class="btn btn-secondary" style="font-size:0.78rem; padding:0.35rem 0.75rem; display:flex; align-items:center; gap:0.3rem;" title="Download blank template with column headers only">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Headers Only
                    </button>
                    <button id="btn-modal-sample-template" class="btn btn-secondary" style="font-size:0.78rem; padding:0.35rem 0.75rem; display:flex; align-items:center; gap:0.3rem;" title="Download complete example template with sample rows">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Example File
                    </button>
                    <button id="btn-modal-close-import" class="icon-btn" style="border:none; background:transparent; cursor:pointer; color:var(--text-secondary);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>

            <!-- Modal Body -->
            <div id="import-modal-body" style="padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1;">
                
                <!-- STEP 1: Upload & Dropzone Area -->
                <div id="import-dropzone" style="border: 2px dashed var(--primary, #10b981); border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center; background: rgba(16, 185, 129, 0.03); cursor: pointer; transition: all 0.2s ease;">
                    <input type="file" id="import-file-input" accept=".xlsx, .xls, .csv" style="display: none;">
                    <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.12); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </div>
                    <h4 style="margin: 0 0 0.4rem 0; font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">Click or Drag & Drop your Excel / CSV file here</h4>
                    <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: var(--text-secondary);">Supports .xlsx, .xls, and .csv spreadsheets with auto-detected headers</p>
                    <button type="button" class="btn btn-primary" style="font-size: 0.85rem; padding: 0.5rem 1.25rem;">Browse File</button>
                </div>

                <!-- Parsing / Loading Spinner (hidden initially) -->
                <div id="import-loading-state" style="display: none; padding: 3rem 1rem; text-align: center;">
                    <div class="spinner-sm" style="width: 36px; height: 36px; border-width: 3px; display: inline-block; margin-bottom: 1rem;"></div>
                    <h4 id="import-loading-title" style="margin: 0 0 0.4rem 0; font-size: 1.1rem; color: var(--text-primary);">Analyzing Excel Spreadsheets...</h4>
                    <p id="import-loading-desc" style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Checking header row and clustering categories</p>
                </div>

                <!-- STEP 2: Analysis & Inspection UI (hidden until file parsed) -->
                <div id="import-analysis-container" style="display: none;">
                    
                    <!-- Metrics Row -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
                        <div style="background: var(--surface-50); padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid var(--border-color);">
                            <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Total Rows</span>
                            <div id="stat-total-rows" style="font-size: 1.4rem; font-weight: 800; color: var(--text-primary); margin-top: 0.15rem;">0</div>
                        </div>
                        <div style="background: rgba(16, 185, 129, 0.08); padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.3);">
                            <span style="font-size: 0.72rem; font-weight: 700; color: #16a34a; text-transform: uppercase;">Valid to Import</span>
                            <div id="stat-valid-rows" style="font-size: 1.4rem; font-weight: 800; color: #16a34a; margin-top: 0.15rem;">0</div>
                        </div>
                        <div style="background: rgba(239, 68, 68, 0.08); padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.3);">
                            <span style="font-size: 0.72rem; font-weight: 700; color: #dc2626; text-transform: uppercase;">Skipped Rows</span>
                            <div id="stat-skipped-rows" style="font-size: 1.4rem; font-weight: 800; color: #dc2626; margin-top: 0.15rem;">0</div>
                        </div>
                        <div style="background: rgba(59, 130, 246, 0.08); padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid rgba(59, 130, 246, 0.3);">
                            <span style="font-size: 0.72rem; font-weight: 700; color: #2563eb; text-transform: uppercase;">New Categories</span>
                            <div id="stat-new-categories" style="font-size: 1.4rem; font-weight: 800; color: #2563eb; margin-top: 0.15rem;">0</div>
                        </div>
                    </div>

                    <!-- Category Grouping Pills -->
                    <div style="margin-bottom: 1.25rem; background: var(--surface-50); padding: 1rem; border-radius: 10px; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.5rem; display:flex; justify-content:space-between; align-items:center;">
                            <span>CATEGORY AUTO-CLUSTERING & COLOR CODES</span>
                            <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;">Case-insensitive grouping</span>
                        </div>
                        <div id="import-category-chips" style="display: flex; flex-wrap: wrap; gap: 0.45rem;">
                            <!-- Category chips inserted dynamically -->
                        </div>
                    </div>

                    <!-- Table Filter Tabs -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="display: flex; gap: 0.4rem;">
                            <button id="tab-filter-all" class="btn btn-secondary active-filter-tab" style="font-size: 0.78rem; padding: 0.3rem 0.75rem; border-radius: 6px;">All Rows</button>
                            <button id="tab-filter-valid" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.75rem; border-radius: 6px;">Valid Only</button>
                            <button id="tab-filter-skipped" class="btn btn-secondary" style="font-size: 0.78rem; padding: 0.3rem 0.75rem; border-radius: 6px;">Skipped Only</button>
                        </div>
                        <span id="preview-row-counter" style="font-size: 0.78rem; color: var(--text-secondary);">Showing 0 items</span>
                    </div>

                    <!-- Preview Table -->
                    <div style="max-height: 280px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                            <thead style="background: var(--surface-50); position: sticky; top: 0; z-index: 2; border-bottom: 1px solid var(--border-color);">
                                <tr>
                                    <th style="padding: 0.5rem 0.75rem; width: 60px;">Row</th>
                                    <th style="padding: 0.5rem 0.75rem; width: 90px;">Status</th>
                                    <th style="padding: 0.5rem 0.75rem;">Product Name</th>
                                    <th style="padding: 0.5rem 0.75rem;">Category</th>
                                    <th style="padding: 0.5rem 0.75rem;">Size/Weight</th>
                                    <th style="padding: 0.5rem 0.75rem; text-align: right;">Sale Price</th>
                                    <th style="padding: 0.5rem 0.75rem;">UPC</th>
                                </tr>
                            </thead>
                            <tbody id="import-preview-table-body">
                                <!-- Populated dynamically -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Progress Bar Container (hidden until user clicks Import) -->
                <div id="import-progress-container" style="display: none; margin-top: 1.5rem; background: var(--surface-50); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span id="import-progress-text" style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Importing products...</span>
                        <span id="import-progress-percent" style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">0%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: var(--surface-200, #e2e8f0); border-radius: 4px; overflow: hidden;">
                        <div id="import-progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.2s ease;"></div>
                    </div>
                </div>

            </div>

            <!-- Modal Footer -->
            <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50, #f8fafc);">
                <button id="btn-import-cancel" class="btn btn-secondary" style="font-size: 0.85rem;">Cancel</button>
                <div style="display: flex; gap: 0.75rem;">
                    <button id="btn-import-rechoose" class="btn btn-secondary" style="display: none; font-size: 0.85rem;">Choose Different File</button>
                    <button id="btn-import-confirm" class="btn btn-primary" style="display: none; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 1.5rem;" disabled>
                        Confirm & Import 0 Products
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modalOverlay);

    // DOM Elements
    const dropzone = modalOverlay.querySelector('#import-dropzone');
    const fileInput = modalOverlay.querySelector('#import-file-input');
    const loadingState = modalOverlay.querySelector('#import-loading-state');
    const loadingTitle = modalOverlay.querySelector('#import-loading-title');
    const loadingDesc = modalOverlay.querySelector('#import-loading-desc');
    const analysisContainer = modalOverlay.querySelector('#import-analysis-container');
    const btnClose = modalOverlay.querySelector('#btn-modal-close-import');
    const btnCancel = modalOverlay.querySelector('#btn-import-cancel');
    const btnSample = modalOverlay.querySelector('#btn-modal-sample-template');
    const btnRechoose = modalOverlay.querySelector('#btn-import-rechoose');
    const btnConfirm = modalOverlay.querySelector('#btn-import-confirm');
    const categoryChips = modalOverlay.querySelector('#import-category-chips');
    const tableBody = modalOverlay.querySelector('#import-preview-table-body');
    const rowCounter = modalOverlay.querySelector('#preview-row-counter');
    const progressContainer = modalOverlay.querySelector('#import-progress-container');
    const progressText = modalOverlay.querySelector('#import-progress-text');
    const progressPercent = modalOverlay.querySelector('#import-progress-percent');
    const progressBar = modalOverlay.querySelector('#import-progress-bar');

    // Filter Tab Buttons
    const tabAll = modalOverlay.querySelector('#tab-filter-all');
    const tabValid = modalOverlay.querySelector('#tab-filter-valid');
    const tabSkipped = modalOverlay.querySelector('#tab-filter-skipped');

    let currentAnalysisResult = null;
    let currentFilter = 'all'; // 'all', 'valid', 'skipped'

    const btnHeadersTemplate = modalOverlay.querySelector('#btn-modal-headers-template');

    const closeModal = () => modalOverlay.remove();
    btnClose.addEventListener('click', closeModal);
    btnCancel.addEventListener('click', closeModal);
    if (btnHeadersTemplate) {
        btnHeadersTemplate.addEventListener('click', () => downloadHeadersOnlyTemplate());
    }
    if (btnSample) {
        btnSample.addEventListener('click', () => downloadExampleDataTemplate());
    }

    // Drag & Drop Handling
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#059669';
        dropzone.style.background = 'rgba(16, 185, 129, 0.08)';
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--primary, #10b981)';
        dropzone.style.background = 'rgba(16, 185, 129, 0.03)';
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary, #10b981)';
        dropzone.style.background = 'rgba(16, 185, 129, 0.03)';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleSelectedFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleSelectedFile(e.target.files[0]);
        }
    });

    btnRechoose.addEventListener('click', () => {
        fileInput.value = '';
        currentAnalysisResult = null;
        analysisContainer.style.display = 'none';
        btnRechoose.style.display = 'none';
        btnConfirm.style.display = 'none';
        dropzone.style.display = 'block';
    });

    // Process & Analyze File
    const handleSelectedFile = async (file) => {
        dropzone.style.display = 'none';
        loadingState.style.display = 'block';
        loadingTitle.textContent = `Analyzing ${file.name}...`;
        loadingDesc.textContent = 'Parsing sheet, clustering categories and checking row validity';

        try {
            const rawRows = await parseExcelFile(file);
            const analysis = analyzeAndValidateRows(rawRows, existingCategories, existingProducts);
            currentAnalysisResult = analysis;

            renderAnalysisUI(analysis);
        } catch (err) {
            loadingState.style.display = 'none';
            dropzone.style.display = 'block';
            showAlert(`Excel Error: ${err.message}`, 'danger');
        }
    };

    const renderAnalysisUI = (analysis) => {
        loadingState.style.display = 'none';
        analysisContainer.style.display = 'block';
        btnRechoose.style.display = 'inline-block';
        btnConfirm.style.display = 'inline-block';

        // Update Stat Badges
        modalOverlay.querySelector('#stat-total-rows').textContent = analysis.summary.totalParsedRows;
        modalOverlay.querySelector('#stat-valid-rows').textContent = analysis.summary.validCount;
        modalOverlay.querySelector('#stat-skipped-rows').textContent = analysis.summary.skippedCount;
        modalOverlay.querySelector('#stat-new-categories').textContent = analysis.summary.newCategoriesCount;

        // Render Category Chips
        categoryChips.innerHTML = '';
        analysis.categoryMap.forEach((info) => {
            const chip = document.createElement('div');
            chip.style.cssText = `
                display: flex; align-items: center; gap: 6px; padding: 4px 10px;
                border-radius: 20px; font-size: 0.75rem; font-weight: 600;
                background: ${info.isNew ? 'rgba(59, 130, 246, 0.1)' : 'var(--surface-100, #f1f5f9)'};
                border: 1px solid ${info.isNew ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-color)'};
                color: var(--text-primary);
            `;
            chip.innerHTML = `
                <span style="width: 10px; height: 10px; border-radius: 50%; background: ${info.color}; display: inline-block;"></span>
                <span>${info.canonicalName}</span>
                <span style="opacity: 0.65; font-size: 0.7rem;">(${info.count} items)</span>
                ${info.isNew ? '<span style="font-size:0.65rem; color:#2563eb; background:#eff6ff; padding:1px 5px; border-radius:4px;">NEW</span>' : ''}
            `;
            categoryChips.appendChild(chip);
        });

        if (analysis.categoryMap.size === 0) {
            categoryChips.innerHTML = `<span style="font-size:0.75rem; color:var(--text-muted);">No categories found in file</span>`;
        }

        // Enable / Disable Confirm Button
        btnConfirm.disabled = analysis.summary.validCount === 0;
        btnConfirm.textContent = `Confirm & Import ${analysis.summary.validCount} Products`;

        renderTableRows();
    };

    const renderTableRows = () => {
        if (!currentAnalysisResult) return;
        const allRows = currentAnalysisResult.parsedRows;

        let filtered = allRows;
        if (currentFilter === 'valid') {
            filtered = allRows.filter(r => r.isValid);
        } else if (currentFilter === 'skipped') {
            filtered = allRows.filter(r => !r.isValid);
        }

        rowCounter.textContent = `Showing ${filtered.length} of ${allRows.length} rows`;
        tableBody.innerHTML = '';

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                        No rows found matching current filter (${currentFilter}).
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';
            if (!row.isValid) {
                tr.style.background = 'rgba(239, 68, 68, 0.04)';
            }

            const statusBadge = row.isValid
                ? `<span style="display:inline-flex; align-items:center; gap:3px; color:#16a34a; font-weight:700; font-size:0.72rem; background:rgba(16,185,129,0.12); padding:2px 6px; border-radius:4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Valid
                   </span>`
                : `<span title="${row.errors.join(' • ')}" style="cursor:help; display:inline-flex; align-items:center; gap:3px; color:#dc2626; font-weight:700; font-size:0.72rem; background:rgba(239,68,68,0.12); padding:2px 6px; border-radius:4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Skipped
                   </span>`;

            const catBadge = row.resolvedCategoryName
                ? `<span style="display:inline-flex; align-items:center; gap:4px;">
                    <span style="width:8px; height:8px; border-radius:50%; background:${row.resolvedCategoryColor};"></span>
                    ${row.resolvedCategoryName}
                   </span>`
                : '<span style="color:var(--text-muted); font-style:italic;">Missing</span>';

            const errTip = !row.isValid ? `<div style="font-size:0.7rem; color:#dc2626; margin-top:2px;">${row.errors.join(', ')}</div>` : '';

            tr.innerHTML = `
                <td style="padding: 0.45rem 0.75rem; color:var(--text-secondary); font-mono; font-size:0.75rem;">${row.rowNumber}</td>
                <td style="padding: 0.45rem 0.75rem;">${statusBadge}</td>
                <td style="padding: 0.45rem 0.75rem; font-weight:600; color:var(--text-primary);">
                    ${row.productData.name || '<span style="color:#dc2626;">[Missing Name]</span>'}
                    ${errTip}
                </td>
                <td style="padding: 0.45rem 0.75rem;">${catBadge}</td>
                <td style="padding: 0.45rem 0.75rem; color:var(--text-secondary);">${row.productData.sizeWeight || '—'}</td>
                <td style="padding: 0.45rem 0.75rem; text-align:right; font-weight:700; color:var(--primary);">${row.productData.salePrice > 0 ? formatCurrency(row.productData.salePrice) : '—'}</td>
                <td style="padding: 0.45rem 0.75rem; color:var(--text-secondary); font-size:0.75rem;">${row.productData.upcCode || '—'}</td>
            `;

            tableBody.appendChild(tr);
        });
    };

    // Filter Tab Click Handlers
    const setFilter = (filterType, btnActive) => {
        currentFilter = filterType;
        [tabAll, tabValid, tabSkipped].forEach(btn => btn.classList.remove('btn-primary'));
        [tabAll, tabValid, tabSkipped].forEach(btn => btn.classList.add('btn-secondary'));
        btnActive.classList.remove('btn-secondary');
        btnActive.classList.add('btn-primary');
        renderTableRows();
    };

    tabAll.addEventListener('click', () => setFilter('all', tabAll));
    tabValid.addEventListener('click', () => setFilter('valid', tabValid));
    tabSkipped.addEventListener('click', () => setFilter('skipped', tabSkipped));

    // Confirm & Execute Import
    btnConfirm.addEventListener('click', async () => {
        if (!currentAnalysisResult || currentAnalysisResult.summary.validCount === 0) return;

        const validRows = currentAnalysisResult.parsedRows.filter(r => r.isValid);
        const newCategories = currentAnalysisResult.newCategoriesToCreate;

        btnConfirm.disabled = true;
        btnRechoose.disabled = true;
        btnCancel.disabled = true;
        progressContainer.style.display = 'block';

        try {
            const result = await executeBatchImport({
                validRows,
                newCategoriesToCreate: newCategories,
                workspaceId,
                creatorId: currentUser.uid,
                onProgress: (statusMsg, percent) => {
                    progressText.textContent = statusMsg;
                    progressPercent.textContent = `${percent}%`;
                    progressBar.style.width = `${percent}%`;
                }
            });

            showAlert(`Success! Imported ${result.importedProductsCount} products and created ${result.createdCategoriesCount} categories.`, 'success');
            
            setTimeout(() => {
                closeModal();
                if (onImportSuccess) onImportSuccess();
            }, 1200);

        } catch (err) {
            showAlert(`Import Failed: ${err.message}`, 'danger');
            btnConfirm.disabled = false;
            btnRechoose.disabled = false;
            btnCancel.disabled = false;
            progressText.textContent = `Error: ${err.message}`;
            progressText.style.color = '#dc2626';
        }
    });
};

/**
 * 2. EXPORT MODAL WITH GRANULAR DATA CHOICES
 * Parity with ExportScreen.kt, ExcelPreviewScreen.kt, and PdfPreviewScreen.kt
 */
export const openExportModal = async (workspaceId, preloadedData = {}) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const productService = getProductService(workspaceId);
    const categoryService = getCategoryService(workspaceId);

    // Pre-fetch all data if not provided
    let products = preloadedData.products || [];
    let categories = preloadedData.categories || [];
    let invoices = preloadedData.invoices || [];
    let businesses = preloadedData.businesses || [];
    let customers = preloadedData.customers || [];
    let clients = preloadedData.clients || [];
    let workspaceInfo = preloadedData.workspaceInfo || {};

    if (products.length === 0 || categories.length === 0) {
        try {
            const [pList, cList, wsData] = await Promise.all([
                productService.getAllActiveProducts().catch(() => []),
                categoryService.getAllCategories().catch(() => []),
                firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email).catch(() => ({}))
            ]);
            products = pList;
            categories = cList;
            workspaceInfo = wsData || {};
        } catch (e) {
            console.warn("Could not fetch data for exporter:", e);
        }
    }

    const existingModal = document.getElementById('export-modal-overlay');
    if (existingModal) existingModal.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'export-modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        padding: 1.5rem; animation: fadeIn 0.2s ease;
    `;

    modalOverlay.innerHTML = `
        <div class="card" style="background: var(--surface-0, #ffffff); width: 100%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--border-color);">
            
            <!-- Header -->
            <div style="padding: 1.25rem 1.75rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50, #f8fafc);">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <div style="width:36px; height:36px; border-radius:10px; background: rgba(59, 130, 246, 0.15); display:flex; align-items:center; justify-content:center; color: #2563eb;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </div>
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Export Workspace Data</h3>
                        <p style="margin:0.15rem 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Select format and customize columns for Excel, PDF, or Backup</p>
                    </div>
                </div>
                <button id="btn-close-export-modal" class="icon-btn" style="border:none; background:transparent; cursor:pointer; color:var(--text-secondary);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Body -->
            <div style="padding: 1.5rem 1.75rem; overflow-y: auto; flex: 1;">
                
                <!-- Format Choice Cards -->
                <div style="margin-bottom: 1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.6rem;">
                        <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; margin: 0; display: block;">
                            1. Choose Export Format (Select 1)
                        </label>
                        <span id="export-selected-badge" style="font-size: 0.75rem; font-weight: 600; color: var(--primary); background: rgba(16, 185, 129, 0.1); padding: 0.15rem 0.5rem; border-radius: 9999px;">Excel Selected</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;" id="export-format-group">
                        <div id="card-format-excel" class="export-format-card active" style="border: 2px solid var(--primary); background: rgba(16, 185, 129, 0.08); border-radius: 12px; padding: 1.1rem 0.75rem; text-align: center; cursor: pointer; transition: all 0.2s ease; position: relative; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12);">
                            <div class="format-check-pill" style="position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;">✓</div>
                            <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">📊</div>
                            <strong style="display: block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.2rem;">Excel (.XLSX)</strong>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Spreadsheet workbook</span>
                        </div>
                        <div id="card-format-pdf" class="export-format-card" style="border: 1px solid var(--border-color); background: var(--surface-50); border-radius: 12px; padding: 1.1rem 0.75rem; text-align: center; cursor: pointer; transition: all 0.2s ease; position: relative; opacity: 0.75;">
                            <div class="format-check-pill" style="position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border-color); display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;"></div>
                            <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">📄</div>
                            <strong style="display: block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.2rem;">Printable PDF</strong>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Price list & catalog</span>
                        </div>
                        <div id="card-format-backup" class="export-format-card" style="border: 1px solid var(--border-color); background: var(--surface-50); border-radius: 12px; padding: 1.1rem 0.75rem; text-align: center; cursor: pointer; transition: all 0.2s ease; position: relative; opacity: 0.75;">
                            <div class="format-check-pill" style="position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--border-color); display: none; align-items: center; justify-content: center; font-size: 11px; font-weight: bold;"></div>
                            <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">💾</div>
                            <strong style="display: block; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.2rem;">Full Backup (JSON)</strong>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Full database (max 100MB)</span>
                        </div>
                    </div>
                </div>

                <!-- Entity & Filter Section -->
                <div id="export-filter-section" style="margin-bottom: 1.5rem; background: var(--surface-50); padding: 1rem 1.25rem; border-radius: 10px; border: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 180px;">
                            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Category Filter</label>
                            <select id="export-cat-filter" class="form-control" style="width: 100%; padding: 0.45rem 0.6rem; font-size: 0.85rem;">
                                <option value="ALL">All Categories (${products.length} Products)</option>
                                ${categories.map(c => `<option value="${c.uniqueId || c.id}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex: 1; min-width: 180px;">
                            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem; display: block;">Stock Status</label>
                            <select id="export-stock-filter" class="form-control" style="width: 100%; padding: 0.45rem 0.6rem; font-size: 0.85rem;">
                                <option value="ALL">All Stock Levels</option>
                                <option value="IN_STOCK">In Stock (> 0)</option>
                                <option value="OUT_OF_STOCK">Out of Stock (= 0)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Custom Column Checkboxes (Parity with ExcelPreviewScreen.kt) -->
                <div id="export-columns-section">
                    <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; margin-bottom: 0.6rem; display: block;">
                        2. Select Columns to Include
                    </label>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; background: var(--surface-50); padding: 1rem 1.25rem; border-radius: 10px; border: 1px solid var(--border-color);">
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-category" checked> Category
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-size-weight" checked> Size / Weight
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-quantity" checked> Quantity / Stock
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-cost" checked> Cost (Base Price)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-base-price" checked> Wholesale Price
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-mrp" checked> MRP
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-mfp-exp" checked> Mfg / Exp Dates
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-sale-price" checked disabled> Sale Price (Always)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-upc" checked> UPC / Barcode
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-desc" checked> Description / Note
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-product-id"> Product ID (Unique)
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
                            <input type="checkbox" id="col-variations" checked> Variations (1..20)
                        </label>
                    </div>
                </div>

            </div>

            <!-- Footer -->
            <div style="padding: 1rem 1.75rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--surface-50, #f8fafc);">
                <span id="export-summary-count" style="font-size: 0.85rem; color: var(--text-secondary);">
                    Ready to export <strong>${products.length}</strong> items
                </span>
                <div style="display: flex; gap: 0.75rem;">
                    <button id="btn-export-cancel" class="btn btn-secondary" style="font-size: 0.85rem;">Cancel</button>
                    <button id="btn-export-download" class="btn btn-primary" style="font-size: 0.85rem; font-weight: 700; padding: 0.5rem 1.5rem; display: flex; align-items: center; gap: 0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Download Excel (.xlsx)
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modalOverlay);

    // Format selection handling (MUTUALLY EXCLUSIVE, ONLY 1 HIGHLIGHTED AT A TIME)
    let selectedFormat = 'excel'; // 'excel', 'pdf', 'backup'
    const cardExcel = modalOverlay.querySelector('#card-format-excel');
    const cardPdf = modalOverlay.querySelector('#card-format-pdf');
    const cardBackup = modalOverlay.querySelector('#card-format-backup');
    const selectedBadge = modalOverlay.querySelector('#export-selected-badge');
    const columnsSection = modalOverlay.querySelector('#export-columns-section');
    const filterSection = modalOverlay.querySelector('#export-filter-section');
    const btnDownload = modalOverlay.querySelector('#btn-export-download');
    const catFilter = modalOverlay.querySelector('#export-cat-filter');
    const stockFilter = modalOverlay.querySelector('#export-stock-filter');

    const updateFormatSelection = (fmt) => {
        selectedFormat = fmt;
        const allCards = [
            { id: 'excel', el: cardExcel, label: 'Excel (.XLSX)', badge: 'Excel Selected' },
            { id: 'pdf', el: cardPdf, label: 'Printable PDF', badge: 'PDF Selected' },
            { id: 'backup', el: cardBackup, label: 'Full Backup (JSON)', badge: 'Backup (JSON) Selected' }
        ];

        allCards.forEach(item => {
            const isMatch = (item.id === fmt);
            const pill = item.el.querySelector('.format-check-pill');
            if (isMatch) {
                item.el.classList.add('active');
                item.el.style.border = '2px solid var(--primary)';
                item.el.style.background = 'rgba(16, 185, 129, 0.08)';
                item.el.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                item.el.style.opacity = '1';
                if (pill) {
                    pill.style.display = 'flex';
                    pill.style.background = 'var(--primary)';
                    pill.style.border = 'none';
                    pill.textContent = '✓';
                }
                if (selectedBadge) selectedBadge.textContent = item.badge;
            } else {
                item.el.classList.remove('active');
                item.el.style.border = '1px solid var(--border-color)';
                item.el.style.background = 'var(--surface-50)';
                item.el.style.boxShadow = 'none';
                item.el.style.opacity = '0.7';
                if (pill) {
                    pill.style.display = 'none';
                    pill.textContent = '';
                }
            }
        });

        if (fmt === 'excel') {
            columnsSection.style.display = 'block';
            filterSection.style.display = 'block';
            btnDownload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Download Excel (.xlsx)`;
        } else if (fmt === 'pdf') {
            columnsSection.style.display = 'block';
            filterSection.style.display = 'block';
            btnDownload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Download Printable PDF`;
        } else if (fmt === 'backup') {
            columnsSection.style.display = 'none';
            filterSection.style.display = 'none';
            btnDownload.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Download Full Backup (JSON)`;
        }
    };

    cardExcel.addEventListener('click', () => updateFormatSelection('excel'));
    cardPdf.addEventListener('click', () => updateFormatSelection('pdf'));
    cardBackup.addEventListener('click', () => updateFormatSelection('backup'));

    const closeModal = () => modalOverlay.remove();
    modalOverlay.querySelector('#btn-close-export-modal').addEventListener('click', closeModal);
    modalOverlay.querySelector('#btn-export-cancel').addEventListener('click', closeModal);

    // Execute Download
    btnDownload.addEventListener('click', () => {
        // Filter products
        const selectedCat = catFilter.value;
        const selectedStock = stockFilter.value;

        let filteredProducts = [...products];
        if (selectedCat !== 'ALL') {
            filteredProducts = filteredProducts.filter(p => p.category === selectedCat || p.categoryName === selectedCat);
        }
        if (selectedStock === 'IN_STOCK') {
            filteredProducts = filteredProducts.filter(p => Number(p.quantity || 0) > 0);
        } else if (selectedStock === 'OUT_OF_STOCK') {
            filteredProducts = filteredProducts.filter(p => Number(p.quantity || 0) <= 0);
        }

        const options = {
            showCategory: modalOverlay.querySelector('#col-category').checked,
            showSizeWeight: modalOverlay.querySelector('#col-size-weight').checked,
            showQuantity: modalOverlay.querySelector('#col-quantity').checked,
            showBasePrice: modalOverlay.querySelector('#col-cost').checked,
            showRealBasePrice: modalOverlay.querySelector('#col-base-price').checked,
            showMrpPrice: modalOverlay.querySelector('#col-mrp').checked,
            showMfpExp: modalOverlay.querySelector('#col-mfp-exp').checked,
            showSalePrice: true,
            showUpcCode: modalOverlay.querySelector('#col-upc').checked,
            showDescription: modalOverlay.querySelector('#col-desc').checked,
            showProductID: modalOverlay.querySelector('#col-product-id').checked,
            showVariations: modalOverlay.querySelector('#col-variations').checked,
            title: workspaceInfo.name || 'PriceLister Catalog'
        };

        if (selectedFormat === 'excel') {
            try {
                exportProductsExcel(filteredProducts, categories, options);
                showAlert(`Exported ${filteredProducts.length} products to Excel!`, 'success');
                closeModal();
            } catch (err) {
                showAlert(err.message || 'Failed to export Excel file', 'error');
            }
        } else if (selectedFormat === 'pdf') {
            try {
                exportProductsPdf(filteredProducts, categories, options, workspaceInfo);
                showAlert(`Generated PDF for ${filteredProducts.length} products!`, 'success');
                closeModal();
            } catch (err) {
                showAlert(err.message || 'Failed to generate PDF', 'error');
            }
        } else if (selectedFormat === 'backup') {
            try {
                exportWorkspaceBackupJson({
                    workspaceData: workspaceInfo,
                    products,
                    categories,
                    invoices,
                    businesses,
                    customers,
                    clients
                });
                showAlert(`Full workspace backup exported successfully!`, 'success');
                closeModal();
            } catch (err) {
                showAlert(err.message || 'Backup failed: File exceeds limit or cannot be processed', 'error');
            }
        }
    });
};
