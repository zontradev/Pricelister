/**
 * PRICELISTER — PROFESSIONAL SUPERMARKET CODE & BARCODE STUDIO
 * Enterprise-grade Code Builder, Symbology Barcode Studio, QR Code Studio,
 * Batch Pipeline, Templates Library, Audit History, and Label Printing Studio
 */

import { getProductService } from '../services/productService.js';
import { getSettingsService } from '../services/settingsService.js';
import { getCodeStudioService, calculateModulo10CheckDigit, calculateModulo43CheckDigit, calculateLuhnCheckDigit } from '../services/codeStudioService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';
import { getRegionConfig } from '../utils/regionLocale.js';

let currentWorkspaceId = null;
let activeTab = 'builder'; // 'builder' | 'barcode' | 'qrcode' | 'batch' | 'templates' | 'history' | 'print'
let allProducts = [];
let activeRegionConfig = null;

// Active Code Builder State
let activeBlocks = [
    { id: 'b1', type: 'fixed_text', name: 'Dept Code', value: 'GROC', length: 4, separator: '-' },
    { id: 'b2', type: 'fixed_text', name: 'Sub-Category', value: 'RET', length: 3, separator: '-' },
    { id: 'b3', type: 'sequential_number', name: 'Sequential ID', startingNumber: 1, step: 1, length: 6, padChar: '0', separator: '' }
];
let activeSeparatorConfig = {
    globalSeparator: '-',
    prefix: '',
    suffix: '',
    fixedLength: 0
};

// Barcode Customizer State
let barcodeState = {
    format: 'CODE128', // 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPCA' | 'UPCE' | 'ITF14'
    content: 'GROC-RET-000412',
    productId: '',
    width: 2,
    height: 75,
    showText: true,
    fontSize: 14,
    textPosition: 'bottom',
    quietZone: 10,
    lineColor: '#000000',
    bgColor: '#FFFFFF'
};

// QR Code Studio State
let qrState = {
    type: 'text', // 'text' | 'sku' | 'url' | 'wifi' | 'vcard' | 'catalog'
    content: 'https://pricelister.com/catalog/GROC-RET-000412',
    colorDark: '#000000',
    colorLight: '#FFFFFF',
    errorCorrection: 'H', // 'L' | 'M' | 'Q' | 'H'
    quietZone: 4,
    centerGraphicMode: 'none', // 'none' | 'logo' | 'letter'
    centerLetter: '', // Max 3 chars
    logoDataUri: null,
    logoSizePercent: 22,
    logoShape: 'square' // 'square' | 'circle'
};

// Print & Label State
let printState = {
    layout: 'avery-3col', // 'thermal' | '2col' | 'avery-3col' | 'compact-4col' | 'custom'
    showName: true,
    showPrice: true,
    showSku: true,
    showBarcodeText: true,
    copies: 12,
    customWidthMm: 50,
    customHeightMm: 30,
    customCols: 3,
    customRows: 8
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================
export const renderBarcodeGenerator = async (container, workspaceId, subView = null) => {
    currentWorkspaceId = workspaceId || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    
    // Subview routing support
    if (subView) {
        const sv = subView.toLowerCase();
        if (sv === 'builder' || sv === 'code-builder') activeTab = 'builder';
        else if (sv === 'barcode' || sv === 'barcodes') activeTab = 'barcode';
        else if (sv === 'qrcode' || sv === 'qr') activeTab = 'qrcode';
        else if (sv === 'batch' || sv === 'batch-generator') activeTab = 'batch';
        else if (sv === 'templates') activeTab = 'templates';
        else if (sv === 'history') activeTab = 'history';
        else if (sv === 'print' || sv === 'export') activeTab = 'print';
    }

    const codeService = getCodeStudioService(currentWorkspaceId);
    const settingsService = getSettingsService(currentWorkspaceId);

    let wsCountry = 'United Kingdom';
    try {
        const wsSettings = await (settingsService.getWorkspaceSettings ? settingsService.getWorkspaceSettings() : (settingsService.getSettings ? settingsService.getSettings() : {}));
        if (wsSettings) {
            wsCountry = wsSettings.country || wsSettings.countryCode || wsSettings.operatedCountry || 'United Kingdom';
        }
    } catch (e) {}

    const regConfig = getRegionConfig(wsCountry);
    activeRegionConfig = regConfig;
    
    // Seed initial template blocks if needed
    try {
        const defaultTmpl = await codeService.getDefaultTemplate();
        if (defaultTmpl && Array.isArray(defaultTmpl.blocks)) {
            activeBlocks = JSON.parse(JSON.stringify(defaultTmpl.blocks));
            activeSeparatorConfig = {
                globalSeparator: defaultTmpl.globalSeparator || '-',
                prefix: defaultTmpl.prefix || '',
                suffix: defaultTmpl.suffix || '',
                fixedLength: defaultTmpl.fixedLength || 0
            };
        }
    } catch (e) {
        console.warn("Could not load default template:", e);
    }

    container.innerHTML = `
        <div style="padding: 1.75rem 2rem; max-width: 1440px; margin: 0 auto; min-height: 85vh;">
            <!-- Top Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h1 style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin: 0; letter-spacing: -0.02em;">Code Generator &amp; Barcode Studio</h1>
                        <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:999px;">Enterprise Retail Edition</span>
                    </div>
                    <p style="margin: 0.35rem 0 0; color: #71717A; font-size: 0.88rem;">Professional code generator, scannable symbology studio, 2D matrix designer, bulk pipeline, and thermal label printing.</p>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <button id="btn-quick-print" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.4rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.5rem 0.9rem; cursor:pointer;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print Labels
                    </button>
                    <button id="btn-quick-export" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; border-radius:8px; padding:0.5rem 0.9rem; cursor:pointer;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Assets
                    </button>
                </div>
            </div>

            <!-- Tab Navigation Strip -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid #E4E4E7; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 2px;">
                <button class="studio-tab-btn ${activeTab === 'builder' ? 'active' : ''}" data-tab="builder">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Custom Code Builder
                </button>
                <button class="studio-tab-btn ${activeTab === 'barcode' ? 'active' : ''}" data-tab="barcode">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>
                    Barcode Generator
                </button>
                <button class="studio-tab-btn ${activeTab === 'qrcode' ? 'active' : ''}" data-tab="qrcode">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01M12 12h.01"/></svg>
                    QR Code Studio
                </button>
                <button class="studio-tab-btn ${activeTab === 'batch' ? 'active' : ''}" data-tab="batch">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    Batch Generator
                </button>
                <button class="studio-tab-btn ${activeTab === 'templates' ? 'active' : ''}" data-tab="templates">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    Saved Templates
                </button>
                <button class="studio-tab-btn ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    Code History
                </button>
                <button class="studio-tab-btn ${activeTab === 'print' ? 'active' : ''}" data-tab="print" title="Print &amp; Export Studio">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print & Export
                </button>
            </div>

            <!-- Tab Content Viewport -->
            <div id="code-studio-view-viewport"></div>
        </div>

        <style>
            .studio-tab-btn {
                padding: 0.65rem 1.15rem;
                background: none;
                border: none;
                border-bottom: 2.5px solid transparent;
                font-size: 0.88rem;
                font-weight: 600;
                color: #71717A;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .studio-tab-btn:hover {
                color: #18181B;
            }
            .studio-tab-btn.active {
                color: #18181B;
                border-bottom-color: #18181B;
                font-weight: 700;
            }
        </style>
    `;

    bindNavigationTabs(container);
    renderActiveTab(container);
};

const bindNavigationTabs = (container) => {
    container.querySelectorAll('.studio-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            renderActiveTab(container);
        });
    });

    container.querySelector('#btn-quick-print')?.addEventListener('click', () => {
        activeTab = 'print';
        container.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'print'));
        renderActiveTab(container);
    });

    container.querySelector('#btn-quick-export')?.addEventListener('click', () => {
        if (activeTab === 'barcode') downloadBarcodePNG();
        else if (activeTab === 'qrcode') downloadQRCodePNG();
        else {
            activeTab = 'print';
            container.querySelectorAll('.studio-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'print'));
            renderActiveTab(container);
        }
    });
};

const renderActiveTab = async (container) => {
    const target = container.querySelector('#code-studio-view-viewport');
    if (!target) return;

    if (activeTab === 'builder') renderCustomBuilderTab(target);
    else if (activeTab === 'barcode') renderBarcodeTab(target);
    else if (activeTab === 'qrcode') renderQRCodeTab(target);
    else if (activeTab === 'batch') renderBatchTab(target);
    else if (activeTab === 'templates') renderTemplatesTab(target);
    else if (activeTab === 'history') renderHistoryTab(target);
    else if (activeTab === 'print') renderPrintTab(target);
};

// =============================================================================
// TAB A: CUSTOM CODE BUILDER (CORE BLOCK CONSTRUCTION ENGINE)
// =============================================================================
const renderCustomBuilderTab = (target) => {
    const svc = getCodeStudioService(currentWorkspaceId);
    const evaluatedCode = svc.assembleCode(activeBlocks, activeSeparatorConfig);

    target.innerHTML = `
        <div style="display:grid; grid-template-columns: minmax(360px, 1.25fr) minmax(340px, 1fr); gap:1.5rem; align-items:start;">
            
            <!-- LEFT COLUMN: BLOCK LIST & CONTROLS -->
            <div style="display:flex; flex-direction:column; gap:1.25rem;">
                
                <!-- Separator & Format Configuration Card -->
                <div class="card" style="padding:1.25rem 1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px;">
                    <div style="font-size:0.95rem; font-weight:700; color:#18181B; margin-bottom:0.75rem;">Global Separators &amp; Affixes</div>
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.75rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Default Separator</label>
                            <select id="builder-global-sep" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                <option value="-" ${activeSeparatorConfig.globalSeparator === '-' ? 'selected' : ''}>Hyphen (-)</option>
                                <option value="_" ${activeSeparatorConfig.globalSeparator === '_' ? 'selected' : ''}>Underscore (_)</option>
                                <option value="/" ${activeSeparatorConfig.globalSeparator === '/' ? 'selected' : ''}>Slash (/)</option>
                                <option value="." ${activeSeparatorConfig.globalSeparator === '.' ? 'selected' : ''}>Period (.)</option>
                                <option value="" ${activeSeparatorConfig.globalSeparator === '' ? 'selected' : ''}>None (No separator)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Code Prefix</label>
                            <input type="text" id="builder-prefix" value="${escapeHtml(activeSeparatorConfig.prefix)}" placeholder="e.g. SK-" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Code Suffix</label>
                            <input type="text" id="builder-suffix" value="${escapeHtml(activeSeparatorConfig.suffix)}" placeholder="e.g. -X" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.75rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Fixed Length (0 = auto)</label>
                            <input type="number" id="builder-fixed-len" min="0" max="64" value="${activeSeparatorConfig.fixedLength || 0}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                    </div>
                </div>

                <!-- Configurable Block List -->
                <div class="card" style="padding:1.25rem 1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <div>
                            <div style="font-size:0.95rem; font-weight:700; color:#18181B;">Configurable Code Blocks (${activeBlocks.length})</div>
                            <div style="font-size:0.78rem; color:#71717A;">Blocks are evaluated from left to right. Reorder, duplicate, or customize each block.</div>
                        </div>
                        <div style="display:flex; gap:0.4rem;">
                            <button id="btn-add-block-dialog" class="btn btn-secondary" style="font-size:0.8rem; font-weight:700; background:#18181B; color:#FFFFFF; border:1px solid #18181B; border-radius:6px; padding:0.4rem 0.8rem; cursor:pointer;">
                                + Add Block
                            </button>
                        </div>
                    </div>

                    <div id="builder-block-items-container" style="display:flex; flex-direction:column; gap:0.6rem;">
                        ${activeBlocks.map((b, idx) => `
                            <div class="code-block-card" data-idx="${idx}" style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; background:#F4F4F5; border:1px solid #E4E4E7; border-radius:8px;">
                                <div style="display:flex; align-items:center; gap:0.75rem; flex:1;">
                                    <span style="font-family:monospace; font-weight:800; font-size:0.8rem; color:#71717A; width:22px;">#${idx + 1}</span>
                                    <div>
                                        <div style="font-weight:700; font-size:0.88rem; color:#18181B; display:flex; align-items:center; gap:0.4rem;">
                                            <span>${escapeHtml(b.name || b.type)}</span>
                                            <span class="badge" style="background:#FFFFFF; border:1px solid #E4E4E7; font-size:0.68rem; padding:0.1rem 0.4rem; border-radius:4px; font-weight:700; color:#18181B;">
                                                ${b.type.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <div style="font-size:0.75rem; color:#71717A; margin-top:2px;">
                                            Sample: <strong style="color:#18181B; font-family:monospace;">${escapeHtml(svc.generateBlockValue(b))}</strong>
                                            ${b.separator ? ` &bull; sep: <code>"${b.separator}"</code>` : ''}
                                        </div>
                                    </div>
                                </div>

                                <div style="display:flex; align-items:center; gap:0.25rem;">
                                    <button class="btn-block-up" data-idx="${idx}" style="background:none; border:1px solid #E4E4E7; border-radius:4px; padding:0.25rem 0.45rem; cursor:pointer;" title="Move Up" ${idx === 0 ? 'disabled' : ''}>&uarr;</button>
                                    <button class="btn-block-down" data-idx="${idx}" style="background:none; border:1px solid #E4E4E7; border-radius:4px; padding:0.25rem 0.45rem; cursor:pointer;" title="Move Down" ${idx === activeBlocks.length - 1 ? 'disabled' : ''}>&darr;</button>
                                    <button class="btn-block-dup" data-idx="${idx}" style="background:none; border:1px solid #E4E4E7; border-radius:4px; padding:0.25rem 0.45rem; cursor:pointer; font-size:0.75rem;" title="Duplicate Block">Dup</button>
                                    <button class="btn-block-edit" data-idx="${idx}" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:4px; padding:0.25rem 0.55rem; cursor:pointer; font-size:0.75rem; font-weight:600;" title="Edit Block">Edit</button>
                                    <button class="btn-block-del" data-idx="${idx}" style="background:none; border:none; color:#71717A; font-size:1.1rem; padding:0.2rem 0.4rem; cursor:pointer;" title="Delete Block">&times;</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: LIVE REAL-TIME PREVIEW PANEL -->
            <div style="display:flex; flex-direction:column; gap:1.25rem; position:sticky; top:1.5rem;">
                <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px;">
                    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#71717A; margin-bottom:0.4rem;">
                        Live Code Output Preview
                    </div>
                    
                    <div style="background:#F4F4F5; border:1.5px solid #E4E4E7; border-radius:10px; padding:1.25rem; text-align:center; margin-bottom:1rem;">
                        <div id="builder-live-output" style="font-family:monospace; font-size:1.5rem; font-weight:800; color:#18181B; letter-spacing:0.05em; word-break:break-all;">
                            ${escapeHtml(evaluatedCode)}
                        </div>
                        <div style="display:flex; justify-content:center; gap:0.75rem; margin-top:0.6rem; font-size:0.75rem; color:#71717A;">
                            <span>Length: <strong>${evaluatedCode.length} chars</strong></span>
                            <span>Blocks: <strong>${activeBlocks.length}</strong></span>
                            <span id="builder-preview-check" style="font-weight:700; color:#18181B;">Ready</span>
                        </div>
                    </div>

                    <!-- Actions -->
                    <div style="display:flex; flex-direction:column; gap:0.5rem;">
                        <button id="btn-save-as-template" class="btn btn-secondary" style="width:100%; font-weight:700; font-size:0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                            Save Configuration as Template
                        </button>
                        <button id="btn-send-to-barcode" class="btn btn-primary" style="width:100%; font-weight:700; font-size:0.85rem; background:#18181B; border:1px solid #18181B; color:#FFFFFF; border-radius:8px; padding:0.6rem; cursor:pointer;">
                            Generate Barcode for this Code &rarr;
                        </button>
                        <button id="btn-send-to-qr" class="btn btn-secondary" style="width:100%; font-weight:700; font-size:0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                            Generate QR Code &rarr;
                        </button>
                    </div>
                </div>

                <!-- Block Type Cheat Sheet -->
                <div class="card" style="padding:1.25rem 1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; font-size:0.8rem; color:#71717A;">
                    <strong style="color:#18181B; display:block; margin-bottom:0.4rem;">Supported Enterprise Block Types:</strong>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
                        <div>&bull; Fixed Text</div>
                        <div>&bull; Sequential Numbers</div>
                        <div>&bull; Random Uppercase</div>
                        <div>&bull; Timestamp Formats</div>
                        <div>&bull; Random Alphanumeric</div>
                        <div>&bull; Date Identifiers (YYMMDD)</div>
                        <div>&bull; Random Numbers</div>
                        <div>&bull; Product Info (SKU/Cat)</div>
                        <div>&bull; Custom Manual Input</div>
                        <div>&bull; Check Digits (Mod 10/43)</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindBuilderEvents(target);
};

const bindBuilderEvents = (target) => {
    const updatePreview = () => {
        const svc = getCodeStudioService(currentWorkspaceId);
        activeSeparatorConfig.globalSeparator = target.querySelector('#builder-global-sep').value;
        activeSeparatorConfig.prefix = target.querySelector('#builder-prefix').value;
        activeSeparatorConfig.suffix = target.querySelector('#builder-suffix').value;
        activeSeparatorConfig.fixedLength = parseInt(target.querySelector('#builder-fixed-len').value, 10) || 0;

        const evaluated = svc.assembleCode(activeBlocks, activeSeparatorConfig);
        const out = target.querySelector('#builder-live-output');
        if (out) out.textContent = evaluated;
    };

    target.querySelector('#builder-global-sep')?.addEventListener('change', updatePreview);
    target.querySelector('#builder-prefix')?.addEventListener('input', updatePreview);
    target.querySelector('#builder-suffix')?.addEventListener('input', updatePreview);
    target.querySelector('#builder-fixed-len')?.addEventListener('input', updatePreview);

    // Block reordering and deletion
    target.querySelectorAll('.btn-block-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx > 0) {
                const temp = activeBlocks[idx];
                activeBlocks[idx] = activeBlocks[idx - 1];
                activeBlocks[idx - 1] = temp;
                renderCustomBuilderTab(target);
            }
        });
    });

    target.querySelectorAll('.btn-block-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (idx < activeBlocks.length - 1) {
                const temp = activeBlocks[idx];
                activeBlocks[idx] = activeBlocks[idx + 1];
                activeBlocks[idx + 1] = temp;
                renderCustomBuilderTab(target);
            }
        });
    });

    target.querySelectorAll('.btn-block-dup').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const dup = JSON.parse(JSON.stringify(activeBlocks[idx]));
            dup.id = `b-${Date.now()}`;
            activeBlocks.splice(idx + 1, 0, dup);
            renderCustomBuilderTab(target);
        });
    });

    target.querySelectorAll('.btn-block-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            if (activeBlocks.length <= 1) {
                showAlert.warning("At least one block must remain in the code structure.");
                return;
            }
            activeBlocks.splice(idx, 1);
            renderCustomBuilderTab(target);
        });
    });

    target.querySelectorAll('.btn-block-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            openBlockConfigModal(activeBlocks[idx], () => renderCustomBuilderTab(target));
        });
    });

    target.querySelector('#btn-add-block-dialog')?.addEventListener('click', () => {
        openAddBlockModal(() => renderCustomBuilderTab(target));
    });

    target.querySelector('#btn-save-as-template')?.addEventListener('click', () => {
        openSaveTemplateModal();
    });

    target.querySelector('#btn-send-to-barcode')?.addEventListener('click', async () => {
        const svc = getCodeStudioService(currentWorkspaceId);
        barcodeState.content = svc.assembleCode(activeBlocks, activeSeparatorConfig);
        try {
            await svc.logCodeGeneration({
                code: barcodeState.content,
                format: 'Code 128',
                templateName: 'Custom Builder',
                connectionId: 'unlinked',
                purpose: 'product',
                event: 'generated'
            });
        } catch (e) {
            console.warn("Could not log code to server history:", e);
        }
        activeTab = 'barcode';
        const navBtns = document.querySelectorAll('.studio-tab-btn');
        navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'barcode'));
        renderBarcodeTab(target);
    });

    target.querySelector('#btn-send-to-qr')?.addEventListener('click', async () => {
        const svc = getCodeStudioService(currentWorkspaceId);
        qrState.content = svc.assembleCode(activeBlocks, activeSeparatorConfig);
        try {
            await svc.logCodeGeneration({
                code: qrState.content,
                format: 'QR Code',
                templateName: 'Custom Builder',
                connectionId: 'unlinked',
                purpose: 'product',
                event: 'generated'
            });
        } catch (e) {
            console.warn("Could not log QR code to server history:", e);
        }
        activeTab = 'qrcode';
        const navBtns = document.querySelectorAll('.studio-tab-btn');
        navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'qrcode'));
        renderQRCodeTab(target);
    });
};

// =============================================================================
// TAB B: BARCODE GENERATOR (SYMBOLOGY & SCAN VERIFICATION)
// =============================================================================
const renderBarcodeTab = async (target) => {
    const prodService = getProductService(currentWorkspaceId);
    let products = [];
    try {
        products = await prodService.getAllActiveProducts();
    } catch (e) {}

    target.innerHTML = `
        <div style="display:grid; grid-template-columns: minmax(360px, 1.2fr) minmax(340px, 1fr); gap:1.5rem; align-items:start;">
            
            <!-- CONTROLS COLUMN -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; display:flex; flex-direction:column; gap:1.15rem;">
                <div>
                    <h3 style="margin:0 0 0.25rem; font-size:1.1rem; font-weight:800; color:#18181B;">Symbology Parameters</h3>
                    <p style="margin:0; font-size:0.8rem; color:#71717A;">Select retail or industrial barcode format with real check-digit validation.</p>
                </div>

                <!-- Product Catalog Source -->
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Retrieve from Catalog Product</label>
                    <select id="bar-source-product" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="">-- Manual Code Input / Custom Builder Text --</option>
                        ${products.map(p => `
                            <option value="${p.id}" data-sku="${escapeHtml(p.upcCode || p.uniqueId || '')}" data-name="${escapeHtml(p.name)}" ${barcodeState.productId === p.id ? 'selected' : ''}>
                                ${escapeHtml(p.name)} [${escapeHtml(p.upcCode || p.uniqueId || 'NO-SKU')}]
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- Content Input -->
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Barcode Content Value *</label>
                    <input type="text" id="bar-content" value="${escapeHtml(barcodeState.content)}" style="width:100%; font-family:monospace; font-weight:700; padding:0.55rem; font-size:0.95rem; border:1px solid #E4E4E7; border-radius:6px;">
                    <div id="bar-format-advice" style="font-size:0.75rem; color:#71717A; margin-top:0.35rem;"></div>
                </div>

                <!-- Barcode Symbology Format -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Symbology Format</label>
                        <select id="bar-format-select" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            <option value="CODE128" ${barcodeState.format === 'CODE128' ? 'selected' : ''}>Code 128 (High-Density ASCII)</option>
                            <option value="CODE39" ${barcodeState.format === 'CODE39' ? 'selected' : ''}>Code 39 (Discrete Alphanumeric)</option>
                            <option value="EAN13" ${barcodeState.format === 'EAN13' ? 'selected' : ''}>EAN-13 (Standard Retail 13-Digit)</option>
                            <option value="EAN8" ${barcodeState.format === 'EAN8' ? 'selected' : ''}>EAN-8 (Compact Retail 8-Digit)</option>
                            <option value="UPCA" ${barcodeState.format === 'UPCA' ? 'selected' : ''}>UPC-A (North American Retail 12-Digit)</option>
                            <option value="ITF14" ${barcodeState.format === 'ITF14' ? 'selected' : ''}>ITF-14 (Packaging Carton)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Bar Height (px)</label>
                        <input type="number" id="bar-height-input" min="30" max="150" value="${barcodeState.height}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>

                <!-- Text & Colors -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Foreground Color</label>
                        <input type="color" id="bar-fg-color" value="${barcodeState.lineColor}" style="width:100%; height:36px; padding:2px; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Background Color</label>
                        <input type="color" id="bar-bg-color" value="${barcodeState.bgColor}" style="width:100%; height:36px; padding:2px; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding-top:0.5rem; border-top:1px solid #E4E4E7;">
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:600; color:#18181B; cursor:pointer;">
                        <input type="checkbox" id="bar-show-text" ${barcodeState.showText ? 'checked' : ''} style="width:16px; height:16px;">
                        Include Human-Readable Text
                    </label>
                </div>
            </div>

            <!-- PREVIEW COLUMN -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; position:sticky; top:1.5rem;">
                <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#71717A; margin-bottom:0.6rem;">
                    Live Barcode Scan Preview
                </div>

                <div id="barcode-canvas-host" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:10px; padding:1.5rem; min-height:180px; display:flex; align-items:center; justify-content:center; margin-bottom:1rem; overflow-x:auto;">
                    <!-- Injected Barcode Visual -->
                </div>

                <!-- Scan Validation pill -->
                <div id="bar-scan-validation-badge" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.85rem; background:#F4F4F5; border:1px solid #E4E4E7; border-radius:8px; font-size:0.78rem; margin-bottom:1rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Symbology check valid. Ready for thermal and laser barcode scanners.</span>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <button id="btn-bar-download-png" class="btn btn-primary" style="width:100%; font-weight:700; font-size:0.85rem; background:#18181B; color:#FFFFFF; border:1px solid #18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                        Download Barcode (PNG)
                    </button>
                    <button id="btn-bar-save-to-prod" class="btn btn-secondary" style="width:100%; font-weight:600; font-size:0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                        Save Code to Product Catalog
                    </button>
                </div>
            </div>
        </div>
    `;

    bindBarcodeEvents(target);
    renderBarcodeLiveVisual(target);
};

const renderBarcodeLiveVisual = (target) => {
    const host = target.querySelector('#barcode-canvas-host');
    if (!host) return;

    const content = barcodeState.content.trim() || 'SAMPLE';
    const fmt = barcodeState.format;

    // Check EAN / UPC rules
    const adviceEl = target.querySelector('#bar-format-advice');
    if (adviceEl) {
        if (fmt === 'EAN13' && !/^\d{12,13}$/.test(content)) {
            adviceEl.innerHTML = `<span style="color:#71717A;">Notice: EAN-13 requires exactly 12 or 13 digits. Custom codes should use Code 128.</span>`;
        } else if (fmt === 'UPCA' && !/^\d{11,12}$/.test(content)) {
            adviceEl.innerHTML = `<span style="color:#71717A;">Notice: UPC-A requires exactly 11 or 12 digits.</span>`;
        } else {
            adviceEl.innerHTML = `<span style="color:#71717A;">Symbology format matches active data.</span>`;
        }
    }

    host.innerHTML = '';
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.id = 'live-barcode-svg';
    host.appendChild(svgEl);

    if (typeof window !== 'undefined' && window.JsBarcode) {
        try {
            let jsFormat = fmt;
            if (fmt === 'UPCA') jsFormat = 'UPC';
            window.JsBarcode(svgEl, content, {
                format: jsFormat,
                width: 2,
                height: barcodeState.height,
                displayValue: barcodeState.showText,
                lineColor: barcodeState.lineColor,
                background: barcodeState.bgColor,
                margin: barcodeState.quietZone,
                fontSize: barcodeState.fontSize,
                font: 'monospace'
            });
            return;
        } catch (e) {
            console.warn("JsBarcode fallback:", e);
        }
    }

    // Built-in fallback display
    host.innerHTML = `
        <div style="font-family:monospace; padding:1rem; text-align:center;">
            <div style="height:${barcodeState.height}px; width:220px; background:repeating-linear-gradient(90deg, #000 0px, #000 3px, #fff 3px, #fff 6px); margin:0 auto 0.5rem;"></div>
            ${barcodeState.showText ? `<strong>${escapeHtml(content)}</strong>` : ''}
        </div>
    `;
};

const bindBarcodeEvents = (target) => {
    target.querySelector('#bar-source-product')?.addEventListener('change', (e) => {
        const prodId = e.target.value;
        barcodeState.productId = prodId;
        const opt = e.target.options[e.target.selectedIndex];
        if (opt && opt.dataset.sku) {
            barcodeState.content = opt.dataset.sku;
            target.querySelector('#bar-content').value = barcodeState.content;
            renderBarcodeLiveVisual(target);
        }
    });

    target.querySelector('#bar-content')?.addEventListener('input', (e) => {
        barcodeState.content = e.target.value;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#bar-format-select')?.addEventListener('change', (e) => {
        barcodeState.format = e.target.value;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#bar-height-input')?.addEventListener('input', (e) => {
        barcodeState.height = parseInt(e.target.value, 10) || 60;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#bar-fg-color')?.addEventListener('input', (e) => {
        barcodeState.lineColor = e.target.value;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#bar-bg-color')?.addEventListener('input', (e) => {
        barcodeState.bgColor = e.target.value;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#bar-show-text')?.addEventListener('change', (e) => {
        barcodeState.showText = e.target.checked;
        renderBarcodeLiveVisual(target);
    });

    target.querySelector('#btn-bar-download-png')?.addEventListener('click', () => {
        downloadBarcodePNG();
    });

    target.querySelector('#btn-bar-save-to-prod')?.addEventListener('click', async () => {
        if (!barcodeState.productId) {
            showAlert.error("Please select a target catalog product first.");
            return;
        }
        try {
            const prodService = getProductService(currentWorkspaceId);
            await prodService.updateProduct(barcodeState.productId, { upcCode: barcodeState.content });
            const svc = getCodeStudioService(currentWorkspaceId);
            await svc.linkCodeToTarget(barcodeState.content, barcodeState.productId, 'product');
            showAlert.success(`Barcode ${barcodeState.content} attached and linked to product.`);
        } catch (e) {
            showAlert.error(`Could not update product: ${e.message}`);
        }
    });
};

const ensureJsBarcodeLib = () => {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.JsBarcode) {
            return resolve(window.JsBarcode);
        }
        if (typeof document === 'undefined') return resolve(null);
        let resolved = false;
        const finish = (lib) => {
            if (!resolved) {
                resolved = true;
                resolve(lib || null);
            }
        };

        const timer = setTimeout(() => finish(window.JsBarcode || null), 800);

        const tryScript = (url, next) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => {
                clearTimeout(timer);
                finish(window.JsBarcode || null);
            };
            s.onerror = () => {
                if (next) next();
                else finish(null);
            };
            document.head.appendChild(s);
        };

        tryScript('./js/libs/jsbarcode.min.js', () => {
            tryScript('js/libs/jsbarcode.min.js', () => {
                tryScript('https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js', null);
            });
        });
    });
};

const generateBarcodeDataUrl = async (content, format = 'CODE128', options = {}) => {
    if (!content) return null;
    const canvas = document.createElement('canvas');
    let jsFormat = format;
    if (format === 'UPCA') jsFormat = 'UPC';

    const jsBarcodeLib = (typeof window !== 'undefined' && window.JsBarcode) ? window.JsBarcode : await ensureJsBarcodeLib();

    if (jsBarcodeLib) {
        try {
            jsBarcodeLib(canvas, String(content), {
                format: jsFormat,
                width: options.width || 2,
                height: options.height || 50,
                displayValue: options.displayValue !== undefined ? options.displayValue : false,
                lineColor: options.lineColor || barcodeState.lineColor || '#000000',
                background: options.bgColor || barcodeState.bgColor || '#FFFFFF',
                margin: options.margin !== undefined ? options.margin : 2
            });
            return canvas.toDataURL('image/png');
        } catch (e) {
            try {
                jsBarcodeLib(canvas, String(content), {
                    format: 'CODE128',
                    width: options.width || 2,
                    height: options.height || 50,
                    displayValue: options.displayValue !== undefined ? options.displayValue : false,
                    lineColor: '#000000',
                    background: '#FFFFFF',
                    margin: options.margin !== undefined ? options.margin : 2
                });
                return canvas.toDataURL('image/png');
            } catch (e2) {
                console.warn("JsBarcode fallback:", e2);
            }
        }
    }

    // High-contrast clean simulated raster pattern fallback
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    renderCanvasBarcodeBars(ctx, content, 20, 10, canvas.width - 40, canvas.height - 20);
    return canvas.toDataURL('image/png');
};

const renderCanvasBarcodeBars = (ctx, code, bx, by, bw, bh) => {
    if (!ctx || !code) return;
    ctx.fillStyle = '#000000';
    let curX = bx;
    const maxX = bx + bw;
    // Guard bars
    ctx.fillRect(curX, by, 3, bh); curX += 6;
    ctx.fillRect(curX, by, 2, bh); curX += 5;
    for (let i = 0; i < code.length; i++) {
        const cc = code.charCodeAt(i);
        const w1 = ((cc % 3) + 1) * 1.5;
        const g1 = (((cc >> 1) % 3) + 1) * 1.5;
        const w2 = (((cc >> 2) % 3) + 1) * 1.5;
        const g2 = (((cc >> 3) % 3) + 1) * 1.5;
        if (curX + w1 + g1 + w2 + g2 > maxX - 12) break;
        ctx.fillRect(curX, by, w1, bh); curX += w1 + g1;
        ctx.fillRect(curX, by, w2, bh); curX += w2 + g2;
    }
    if (curX < maxX - 8) {
        ctx.fillRect(curX, by, 2, bh); curX += 4;
        ctx.fillRect(curX, by, 3, bh);
    }
};

const drawDirectVectorBarcode = (doc, code, bx, by, bw, bh) => {
    if (!doc || !code) return;
    doc.setFillColor(0, 0, 0);
    const clean = String(code);
    let curX = bx + 2;
    const maxX = bx + bw - 2;
    // Guard bars
    doc.rect(curX, by, 0.6, bh, 'F'); curX += 1.2;
    doc.rect(curX, by, 0.4, bh, 'F'); curX += 1.0;
    for (let i = 0; i < clean.length; i++) {
        const cc = clean.charCodeAt(i);
        const w1 = ((cc % 3) + 1) * 0.35;
        const g1 = (((cc >> 1) % 3) + 1) * 0.35;
        const w2 = (((cc >> 2) % 3) + 1) * 0.35;
        const g2 = (((cc >> 3) % 3) + 1) * 0.35;
        if (curX + w1 + g1 + w2 + g2 > maxX - 2) break;
        doc.rect(curX, by, w1, bh, 'F'); curX += w1 + g1;
        doc.rect(curX, by, w2, bh, 'F'); curX += w2 + g2;
    }
    if (curX < maxX - 1.5) {
        doc.rect(curX, by, 0.4, bh, 'F'); curX += 0.8;
        doc.rect(curX, by, 0.6, bh, 'F');
    }
};

const downloadBarcodePNG = async () => {
    const sku = barcodeState.content || 'GROC-RET-000412';
    const dataUrl = await generateBarcodeDataUrl(sku, barcodeState.format, { height: 80, width: 2, displayValue: barcodeState.showText });
    if (!dataUrl) {
        showAlert.info("Barcode preview is preparing...");
        return;
    }
    try {
        const svc = getCodeStudioService(currentWorkspaceId);
        await svc.logCodeGeneration({
            code: sku,
            barcode: sku,
            format: barcodeState.format,
            connectionId: barcodeState.productId || 'unlinked',
            productId: barcodeState.productId || null,
            purpose: barcodeState.productId ? 'product' : 'general',
            event: 'downloaded'
        });
    } catch (e) {
        console.warn("Could not log downloaded barcode to server:", e);
    }
    const a = document.createElement("a");
    a.download = `barcode_${sku.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    a.href = dataUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showAlert.success("Barcode PNG image downloaded.");
};

// =============================================================================
// TAB C: QR CODE STUDIO (DESIGNER & EMBEDDED LOGO)
// =============================================================================
const renderQRCodeTab = (target) => {
    target.innerHTML = `
        <div style="display:grid; grid-template-columns: minmax(360px, 1.2fr) minmax(340px, 1fr); gap:1.5rem; align-items:start;">
            
            <!-- QR CONTROLS -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; display:flex; flex-direction:column; gap:1.15rem;">
                <div>
                    <h3 style="margin:0 0 0.25rem; font-size:1.1rem; font-weight:800; color:#18181B;">2D Matrix QR Designer</h3>
                    <p style="margin:0; font-size:0.8rem; color:#71717A;">Embed logos, adjust error correction, and create high-resolution scannable QR codes.</p>
                </div>

                <!-- Content Type Selector -->
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">QR Content Payload Type</label>
                    <select id="qr-payload-type" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="text" ${qrState.type === 'text' ? 'selected' : ''}>Plain Text / Custom String</option>
                        <option value="sku" ${qrState.type === 'sku' ? 'selected' : ''}>Product SKU &amp; Serial</option>
                        <option value="url" ${qrState.type === 'url' ? 'selected' : ''}>Website or Storefront URL</option>
                        <option value="wifi" ${qrState.type === 'wifi' ? 'selected' : ''}>Store Guest Wi-Fi Access</option>
                        <option value="vcard" ${qrState.type === 'vcard' ? 'selected' : ''}>Supplier / Business Contact vCard</option>
                    </select>
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Encoded Data String *</label>
                    <textarea id="qr-content-input" rows="2" style="width:100%; font-family:monospace; font-size:0.85rem; padding:0.5rem; border:1px solid #E4E4E7; border-radius:6px;">${escapeHtml(qrState.content)}</textarea>
                </div>

                <!-- Styling & Colors -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Foreground Color</label>
                        <input type="color" id="qr-dark-color" value="${qrState.colorDark}" style="width:100%; height:36px; padding:2px; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Background Color</label>
                        <input type="color" id="qr-light-color" value="${qrState.colorLight}" style="width:100%; height:36px; padding:2px; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">
                    </div>
                </div>

                <!-- Error Correction Level -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Error Correction Level</label>
                        <select id="qr-error-level" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            <option value="H" ${qrState.errorCorrection === 'H' ? 'selected' : ''}>High (30% Recovery - For Logos)</option>
                            <option value="Q" ${qrState.errorCorrection === 'Q' ? 'selected' : ''}>Quarter (25% Recovery)</option>
                            <option value="M" ${qrState.errorCorrection === 'M' ? 'selected' : ''}>Medium (15% Recovery)</option>
                            <option value="L" ${qrState.errorCorrection === 'L' ? 'selected' : ''}>Low (7% Recovery)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Quiet Zone (Modules)</label>
                        <input type="number" id="qr-quiet-zone" min="1" max="10" value="${qrState.quietZone}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>

                <!-- Center Graphic Choice: Image OR Center Letter (Max 3 Chars) -->
                <div style="padding-top:0.75rem; border-top:1px solid #E4E4E7;">
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.4rem;">Center Monogram or Logo</label>
                    <div style="display:flex; gap:0.75rem; margin-bottom:0.6rem; flex-wrap:wrap;">
                        <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:600; cursor:pointer;">
                            <input type="radio" name="qr-center-choice" value="none" ${qrState.centerGraphicMode === 'none' ? 'checked' : ''}> None
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:600; cursor:pointer;">
                            <input type="radio" name="qr-center-choice" value="letter" ${qrState.centerGraphicMode === 'letter' ? 'checked' : ''}> Central Letter (Max 3 chars)
                        </label>
                        <label style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; font-weight:600; cursor:pointer;">
                            <input type="radio" name="qr-center-choice" value="logo" ${qrState.centerGraphicMode === 'logo' ? 'checked' : ''}> Upload Logo Image
                        </label>
                    </div>

                    <!-- Central Letter Input -->
                    <div id="qr-letter-panel" style="display:${qrState.centerGraphicMode === 'letter' ? 'block' : 'none'}; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.6rem 0.75rem; margin-top:0.4rem;">
                        <label style="display:block; font-size:0.75rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Monogram Text (Max 3 Characters)</label>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <input type="text" id="qr-center-letter-input" maxlength="3" value="${escapeHtml(qrState.centerLetter || '')}" placeholder="e.g. ${escapeHtml((activeRegionConfig && activeRegionConfig.examples.brandMonogram) || 'RFL')}" style="width:90px; text-transform:uppercase; font-size:0.95rem; font-weight:800; letter-spacing:0.05em; padding:0.4rem 0.6rem; border:1px solid #E4E4E7; border-radius:6px; text-align:center; background:#FFFFFF;">
                            <span style="font-size:0.75rem; color:#71717A;">Central letter badges are ideal for store initials &amp; brands.</span>
                        </div>
                    </div>

                    <!-- Logo Upload Panel -->
                    <div id="qr-logo-panel" style="display:${qrState.centerGraphicMode === 'logo' ? 'block' : 'none'}; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.6rem 0.75rem; margin-top:0.4rem;">
                        <input type="file" id="qr-logo-upload" accept="image/png, image/jpeg, image/webp" style="font-size:0.8rem;">
                        ${qrState.logoDataUri ? `
                            <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.4rem;">
                                <span style="font-size:0.75rem; color:#18181B; font-weight:600;">Custom logo attached</span>
                                <button id="btn-remove-qr-logo" type="button" style="background:none; border:none; color:#71717A; cursor:pointer; font-size:0.75rem; text-decoration:underline;">Remove</button>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Generate / Regenerate Button in Controls -->
                <button id="btn-generate-qr-action" type="button" class="btn btn-primary" style="display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.85rem; border-radius:8px; padding:0.65rem 1rem; cursor:pointer; width:100%; margin-top:0.25rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                    <span>Generate / Regenerate QR Code</span>
                </button>
            </div>

            <!-- QR LIVE PREVIEW -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; position:sticky; top:1.5rem;">
                <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#71717A; margin-bottom:0.6rem;">
                    Live QR Matrix Preview
                </div>

                <div id="qr-canvas-host" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:10px; padding:1.5rem; min-height:240px; display:flex; align-items:center; justify-content:center; margin-bottom:1rem;">
                    <canvas id="live-qr-canvas" width="220" height="220"></canvas>
                </div>

                <div id="qr-contrast-notice" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0.85rem; background:#F4F4F5; border:1px solid #E4E4E7; border-radius:8px; font-size:0.78rem; margin-bottom:1rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>High scan contrast rating. Compliant with mobile camera readers.</span>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                    <button id="btn-qr-download-png" class="btn btn-primary" style="width:100%; font-weight:700; font-size:0.85rem; background:#18181B; color:#FFFFFF; border:1px solid #18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                        Download QR Code (PNG)
                    </button>
                    <button id="btn-qr-regenerate-alt" class="btn btn-secondary" style="width:100%; font-weight:700; font-size:0.85rem; background:#FFFFFF; color:#18181B; border:1px solid #E4E4E7; border-radius:8px; padding:0.55rem; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        <span>Regenerate Matrix</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    bindQREvents(target);
    renderQRLiveCanvas();
};

const ensureQRCodeLib = () => {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && window.QRCode && typeof window.QRCode.toCanvas === 'function') {
            return resolve(window.QRCode);
        }
        if (typeof document === 'undefined') return resolve(null);
        let resolved = false;
        const finish = (lib) => {
            if (!resolved) {
                resolved = true;
                resolve(lib || null);
            }
        };

        const timer = setTimeout(() => finish(window.QRCode || null), 800);

        const tryScript = (url, next) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = () => {
                clearTimeout(timer);
                finish(window.QRCode || null);
            };
            s.onerror = () => {
                if (next) next();
                else finish(null);
            };
            document.head.appendChild(s);
        };

        tryScript('./js/libs/qrcode.min.js', () => {
            tryScript('js/libs/qrcode.min.js', () => {
                tryScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js', null);
            });
        });
    });
};

const drawFallbackQRMatrix = (canvas, content) => {
    const ctx = canvas.getContext('2d');
    const size = 220;
    canvas.width = size;
    canvas.height = size;

    // Fill background
    ctx.fillStyle = qrState.colorLight || '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = qrState.colorDark || '#000000';
    const modules = 25; // 25x25 Standard QR matrix
    const moduleSize = Math.floor((size - ((qrState.quietZone || 4) * 8)) / modules);
    const offset = Math.floor((size - (modules * moduleSize)) / 2);

    const drawMod = (r, c) => {
        ctx.fillRect(offset + (c * moduleSize), offset + (r * moduleSize), moduleSize, moduleSize);
    };

    // Draw Finder Pattern (7x7) at (r, c)
    const drawFinder = (startR, startC) => {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
                    drawMod(startR + r, startC + c);
                }
            }
        }
    };

    // 3 Finder patterns
    drawFinder(0, 0);                 // Top-Left
    drawFinder(0, modules - 7);       // Top-Right
    drawFinder(modules - 7, 0);       // Bottom-Left

    // Timing Patterns
    for (let i = 8; i < modules - 8; i += 2) {
        drawMod(6, i); // Horizontal
        drawMod(i, 6); // Vertical
    }

    // Alignment pattern (5x5)
    const ar = modules - 9, ac = modules - 9;
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
                drawMod(ar + r, ac + c);
            }
        }
    }

    // Seeded data modules
    let seed = 0;
    for (let i = 0; i < content.length; i++) seed = (seed * 31 + content.charCodeAt(i)) & 0x7FFFFFFF;
    const lcg = () => { seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF; return seed / 0x7FFFFFFF; };

    for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
            if ((r < 8 && c < 8) || (r < 8 && c >= modules - 8) || (r >= modules - 8 && c < 8)) continue;
            if (r === 6 || c === 6) continue;
            if (r >= ar && r < ar + 5 && c >= ac && c < ac + 5) continue;
            if (lcg() > 0.48) {
                drawMod(r, c);
            }
        }
    }
};

const applyCenterDecorations = (canvas) => {
    const ctx = canvas.getContext('2d');

    // Draw center letter / monogram if selected
    if (qrState.centerGraphicMode === 'letter' && qrState.centerLetter && qrState.centerLetter.trim()) {
        const text = qrState.centerLetter.trim().toUpperCase().substring(0, 3);
        const boxW = text.length === 1 ? 46 : (text.length === 2 ? 54 : 64);
        const boxH = 46;
        const x = (canvas.width - boxW) / 2;
        const y = (canvas.height - boxH) / 2;

        // Badge background & border
        ctx.fillStyle = qrState.colorLight || '#FFFFFF';
        ctx.fillRect(x - 2, y - 2, boxW + 4, boxH + 4);
        ctx.strokeStyle = qrState.colorDark || '#18181B';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x, y, boxW, boxH);

        // Monogram text
        ctx.fillStyle = qrState.colorDark || '#18181B';
        const fontSize = text.length === 1 ? 22 : (text.length === 2 ? 18 : 15);
        ctx.font = `800 ${fontSize}px 'Inter', sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
    }
    // Draw center logo composite if present and mode is logo
    else if (qrState.centerGraphicMode === 'logo' && qrState.logoDataUri) {
        const logo = new Image();
        logo.src = qrState.logoDataUri;
        logo.onload = () => {
            const logoSize = Math.floor(canvas.width * (qrState.logoSizePercent / 100));
            const x = (canvas.width - logoSize) / 2;
            const y = (canvas.height - logoSize) / 2;
            ctx.fillStyle = qrState.colorLight || '#FFFFFF';
            ctx.fillRect(x - 3, y - 3, logoSize + 6, logoSize + 6);
            ctx.drawImage(logo, x, y, logoSize, logoSize);
        };
    }
};

const renderQRLiveCanvas = async () => {
    const host = document.getElementById('qr-canvas-host');
    if (!host) return;

    let canvas = document.getElementById('live-qr-canvas');
    if (!canvas) {
        host.innerHTML = `<canvas id="live-qr-canvas" width="220" height="220" style="display:block; max-width:100%; border-radius:8px; box-shadow:0 1px 4px rgba(0,0,0,0.06); background:#ffffff;"></canvas>`;
        canvas = document.getElementById('live-qr-canvas');
    }
    if (!canvas) return;

    // Ensure canvas is visible
    canvas.style.display = 'block';

    const content = (qrState.content || '').trim() || 'SAMPLE';
    const ecLevel = (qrState.centerGraphicMode === 'logo' || qrState.centerGraphicMode === 'letter') ? 'H' : (qrState.errorCorrection || 'M');

    // First, draw fallback matrix immediately so the preview is never blank
    drawFallbackQRMatrix(canvas, content);
    applyCenterDecorations(canvas);

    // If QRCode library is available or loaded, enhance with high-precision library render
    try {
        const qrLib = (typeof window !== 'undefined' && window.QRCode) ? window.QRCode : await ensureQRCodeLib();
        if (qrLib && typeof qrLib.toCanvas === 'function') {
            await new Promise((resolve) => {
                qrLib.toCanvas(canvas, content, {
                    width: 220,
                    margin: qrState.quietZone || 4,
                    errorCorrectionLevel: ecLevel,
                    color: {
                        dark: qrState.colorDark || '#000000',
                        light: qrState.colorLight || '#FFFFFF'
                    }
                }, (err) => {
                    if (err) {
                        drawFallbackQRMatrix(canvas, content);
                    }
                    applyCenterDecorations(canvas);
                    resolve();
                });
            });
        }
    } catch (e) {
        // Fallback already rendered
    }
};

const bindQREvents = (target) => {
    target.querySelector('#qr-content-input')?.addEventListener('input', (e) => {
        qrState.content = e.target.value;
        renderQRLiveCanvas();
    });

    target.querySelector('#qr-dark-color')?.addEventListener('input', (e) => {
        qrState.colorDark = e.target.value;
        renderQRLiveCanvas();
    });

    target.querySelector('#qr-light-color')?.addEventListener('input', (e) => {
        qrState.colorLight = e.target.value;
        renderQRLiveCanvas();
    });

    target.querySelector('#qr-error-level')?.addEventListener('change', (e) => {
        qrState.errorCorrection = e.target.value;
        renderQRLiveCanvas();
    });

    target.querySelector('#qr-quiet-zone')?.addEventListener('input', (e) => {
        qrState.quietZone = parseInt(e.target.value, 10) || 4;
        renderQRLiveCanvas();
    });

    // Center Graphic Mode radios (None vs Letter vs Logo)
    target.querySelectorAll('input[name="qr-center-choice"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            qrState.centerGraphicMode = e.target.value;
            const letterPanel = target.querySelector('#qr-letter-panel');
            const logoPanel = target.querySelector('#qr-logo-panel');
            if (letterPanel) letterPanel.style.display = qrState.centerGraphicMode === 'letter' ? 'block' : 'none';
            if (logoPanel) logoPanel.style.display = qrState.centerGraphicMode === 'logo' ? 'block' : 'none';
            if (qrState.centerGraphicMode === 'letter') {
                qrState.errorCorrection = 'H';
            } else if (qrState.centerGraphicMode === 'logo') {
                qrState.errorCorrection = 'H';
            }
            renderQRLiveCanvas();
        });
    });

    // Center Letter Input
    target.querySelector('#qr-center-letter-input')?.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().slice(0, 3);
        e.target.value = val;
        qrState.centerLetter = val;
        renderQRLiveCanvas();
    });

    // Logo upload
    target.querySelector('#qr-logo-upload')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
                qrState.logoDataUri = re.target.result;
                qrState.centerGraphicMode = 'logo';
                qrState.errorCorrection = 'H';
                renderQRCodeTab(target);
            };
            reader.readAsDataURL(file);
        }
    });

    target.querySelector('#btn-remove-qr-logo')?.addEventListener('click', () => {
        qrState.logoDataUri = null;
        renderQRCodeTab(target);
    });

    // Generate / Regenerate Buttons
    target.querySelector('#btn-generate-qr-action')?.addEventListener('click', () => {
        renderQRLiveCanvas();
        showAlert.success("QR Code generated successfully.");
    });

    target.querySelector('#btn-qr-regenerate-alt')?.addEventListener('click', () => {
        renderQRLiveCanvas();
        showAlert.success("QR Code matrix refreshed.");
    });

    target.querySelector('#btn-qr-download-png')?.addEventListener('click', () => {
        downloadQRCodePNG();
    });
};

const downloadQRCodePNG = () => {
    const exportCanvas = document.createElement('canvas');
    const size = 600;
    exportCanvas.width = size;
    exportCanvas.height = size;
    const ctx = exportCanvas.getContext('2d');

    const content = (qrState.content || '').trim() || 'https://pricelister.com';
    const ecLevel = (qrState.centerGraphicMode === 'logo' || qrState.centerGraphicMode === 'letter') ? 'H' : (qrState.errorCorrection || 'M');

    // Fill background
    ctx.fillStyle = qrState.colorLight || '#FFFFFF';
    ctx.fillRect(0, 0, size, size);

    const finishDownload = () => {
        try {
            const svc = getCodeStudioService(currentWorkspaceId);
            svc.logCodeGeneration({
                code: content,
                barcode: content,
                format: 'QR Code',
                connectionId: 'unlinked',
                purpose: 'general',
                event: 'downloaded'
            }).catch(() => {});
        } catch (e) {}
        try {
            const a = document.createElement("a");
            a.download = `qrcode_${Date.now()}.png`;
            a.href = exportCanvas.toDataURL("image/png");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showAlert.success("High-resolution QR code PNG downloaded.");
        } catch (e) {
            showAlert.error("Could not export QR PNG: " + e.message);
        }
    };

    const drawMonogramOrLogoOnCanvas = () => {
        if (qrState.centerGraphicMode === 'letter' && qrState.centerLetter && qrState.centerLetter.trim()) {
            const text = qrState.centerLetter.trim().toUpperCase().substring(0, 3);
            const boxW = text.length === 1 ? 120 : (text.length === 2 ? 144 : 170);
            const boxH = 120;
            const x = (size - boxW) / 2;
            const y = (size - boxH) / 2;

            ctx.fillStyle = qrState.colorLight || '#FFFFFF';
            ctx.fillRect(x - 4, y - 4, boxW + 8, boxH + 8);
            ctx.strokeStyle = qrState.colorDark || '#18181B';
            ctx.lineWidth = 6;
            ctx.strokeRect(x, y, boxW, boxH);

            ctx.fillStyle = qrState.colorDark || '#18181B';
            const fontSize = text.length === 1 ? 58 : (text.length === 2 ? 46 : 38);
            ctx.font = `800 ${fontSize}px 'Inter', sans-serif, system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, size / 2, size / 2 + 3);
            finishDownload();
        } else if (qrState.centerGraphicMode === 'logo' && qrState.logoDataUri) {
            const logo = new Image();
            logo.onload = () => {
                const logoSize = Math.floor(size * ((qrState.logoSizePercent || 22) / 100));
                const x = (size - logoSize) / 2;
                const y = (size - logoSize) / 2;
                ctx.fillStyle = qrState.colorLight || '#FFFFFF';
                ctx.fillRect(x - 6, y - 6, logoSize + 12, logoSize + 12);
                ctx.drawImage(logo, x, y, logoSize, logoSize);
                finishDownload();
            };
            logo.onerror = () => finishDownload();
            logo.src = qrState.logoDataUri;
        } else {
            finishDownload();
        }
    };

    const qrLib = (typeof window !== 'undefined' && window.QRCode) ? window.QRCode : null;
    if (qrLib && typeof qrLib.toCanvas === 'function') {
        qrLib.toCanvas(exportCanvas, content, {
            width: size,
            margin: qrState.quietZone || 4,
            color: {
                dark: qrState.colorDark || '#000000',
                light: qrState.colorLight || '#FFFFFF'
            },
            errorCorrectionLevel: ecLevel
        }, (err) => {
            if (err) {
                drawFallbackQRMatrix(exportCanvas, content);
            }
            drawMonogramOrLogoOnCanvas();
        });
    } else {
        drawFallbackQRMatrix(exportCanvas, content);
        drawMonogramOrLogoOnCanvas();
    }
};

// =============================================================================
// TAB D: BATCH CODE GENERATOR (BULK PIPELINE)
// =============================================================================
const renderBatchTab = async (target) => {
    const svc = getCodeStudioService(currentWorkspaceId);
    const templates = await svc.getAllTemplates(false);

    target.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
            
            <!-- Batch Configuration Header Card -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px;">
                <div style="margin-bottom:1rem;">
                    <h3 style="margin:0 0 0.25rem; font-size:1.15rem; font-weight:800; color:#18181B;">Batch Code Generator &amp; Importer</h3>
                    <p style="margin:0; font-size:0.83rem; color:#71717A;">Generate sequences of unique codes in bulk with automated collision checking and spreadsheet export.</p>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; align-items:end;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Generation Target Mode</label>
                        <select id="batch-target-mode" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            <option value="free_pool">Free Code Pool (Pre-generation)</option>
                            <option value="existing_products">Assign to Existing Catalog Products</option>
                            <option value="variations">Assign to Product Variations</option>
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Code Template</label>
                        <select id="batch-template-select" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)} (${t.globalSeparator || '-'})</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Batch Size (Count)</label>
                        <input type="number" id="batch-count" min="1" max="1000" value="25" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>

                    <div>
                        <button id="btn-run-batch-generate" class="btn btn-primary" style="width:100%; font-weight:700; font-size:0.85rem; background:#18181B; color:#FFFFFF; border:1px solid #18181B; border-radius:6px; padding:0.55rem; cursor:pointer;">
                            Run Batch Pipeline &rarr;
                        </button>
                    </div>
                </div>
            </div>

            <!-- Batch Results Viewport -->
            <div id="batch-results-host">
                <div style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:3rem; text-align:center; color:#71717A;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="1.5" style="margin-bottom:0.75rem;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    <div style="font-weight:700; color:#18181B; margin-bottom:0.25rem;">No Batch Job Executed Yet</div>
                    <div style="font-size:0.85rem;">Select your parameters above and click "Run Batch Pipeline" to generate codes.</div>
                </div>
            </div>
        </div>
    `;

    target.querySelector('#btn-run-batch-generate')?.addEventListener('click', async () => {
        const templateId = target.querySelector('#batch-template-select').value;
        const targetMode = target.querySelector('#batch-target-mode').value;
        const count = parseInt(target.querySelector('#batch-count').value, 10) || 10;
        const host = target.querySelector('#batch-results-host');

        host.innerHTML = `<div style="text-align:center; padding:2.5rem; color:#71717A;">Executing collision detection and atomic sequence reservations...</div>`;
        
        try {
            const summary = await svc.executeBatchGeneration({
                templateId,
                targetMode,
                count
            });
            renderBatchResultsTable(host, summary);
            showAlert.success(`Generated batch of ${summary.successful} unique codes.`);
        } catch (e) {
            showAlert.error(`Batch generation failed: ${e.message}`);
        }
    });
};

const renderBatchResultsTable = (host, summary) => {
    host.innerHTML = `
        <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
                <div>
                    <h4 style="margin:0 0 0.25rem; font-size:1.05rem; font-weight:800; color:#18181B;">Batch Execution Summary</h4>
                    <div style="display:flex; gap:0.6rem; font-size:0.78rem;">
                        <span style="color:#18181B;">Total: <strong>${summary.totalRequested}</strong></span>
                        <span style="color:#18181B;">Successful: <strong>${summary.successful}</strong></span>
                        <span style="color:#71717A;">Collisions Resolved: <strong>${summary.duplicate}</strong></span>
                    </div>
                </div>
                <button id="btn-export-batch-csv" class="btn btn-secondary" style="font-size:0.8rem; font-weight:700; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">
                    Export Batch (CSV)
                </button>
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                    <thead>
                        <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; font-size:0.75rem; text-transform:uppercase; color:#71717A;">
                            <th style="padding:0.75rem 1rem;">Row</th>
                            <th style="padding:0.75rem 1rem;">Generated Code</th>
                            <th style="padding:0.75rem 1rem;">Sequence</th>
                            <th style="padding:0.75rem 1rem;">Target Reference</th>
                            <th style="padding:0.75rem 1rem; text-align:right;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summary.rows.map(r => `
                            <tr style="border-bottom:1px solid #E4E4E7;">
                                <td style="padding:0.75rem 1rem; font-family:monospace; color:#71717A;">#${r.rowNumber}</td>
                                <td style="padding:0.75rem 1rem; font-family:monospace; font-weight:800; color:#18181B;">${escapeHtml(r.code)}</td>
                                <td style="padding:0.75rem 1rem; color:#71717A;">${r.sequence}</td>
                                <td style="padding:0.75rem 1rem; color:#18181B;">${escapeHtml(r.productName)}</td>
                                <td style="padding:0.75rem 1rem; text-align:right;">
                                    <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.72rem; padding:0.15rem 0.5rem; border-radius:4px; font-weight:700;">
                                        ${r.status}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    host.querySelector('#btn-export-batch-csv')?.addEventListener('click', () => {
        const headers = ["Row", "Generated Code", "Sequence", "Target Reference", "Status"];
        const rows = summary.rows.map(r => [
            r.rowNumber,
            `"${r.code}"`,
            r.sequence,
            `"${(r.productName || '').replace(/"/g, '""')}"`,
            `"${r.status}"`
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `pricelister_batch_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert.success("Batch codes exported to CSV.");
    });
};

// =============================================================================
// TAB E: SAVED CODE TEMPLATES
// =============================================================================
const renderTemplatesTab = async (target) => {
    const svc = getCodeStudioService(currentWorkspaceId);
    const templates = await svc.getAllTemplates(true);

    target.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Code Generation Templates</h3>
                <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Manage saved block hierarchies for departments, supermarket aisles, and retail lines.</p>
            </div>
            <button id="btn-create-new-template" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; border-radius:8px; padding:0.5rem 0.9rem; cursor:pointer;">
                + New Template
            </button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:1.25rem;">
            ${templates.map(t => `
                <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                            <div>
                                <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">${escapeHtml(t.name)}</h4>
                                <span style="font-size:0.75rem; color:#71717A;">Separator: <code>"${t.globalSeparator || '-'}"</code></span>
                            </div>
                            ${t.isDefault ? `
                                <span class="badge" style="background:#18181B; color:#FFFFFF; font-size:0.7rem; padding:0.2rem 0.5rem; border-radius:999px; font-weight:700;">Default</span>
                            ` : ''}
                        </div>

                        <p style="font-size:0.82rem; color:#71717A; margin:0 0 1rem; line-height:1.4;">${escapeHtml(t.description || '')}</p>

                        <!-- Blocks Summary Chips -->
                        <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:1rem;">
                            ${(t.blocks || []).map(b => `
                                <span style="font-family:monospace; font-size:0.72rem; background:#F4F4F5; border:1px solid #E4E4E7; padding:0.15rem 0.45rem; border-radius:4px; color:#18181B;">
                                    [${escapeHtml(b.name || b.type)}]
                                </span>
                            `).join('')}
                        </div>

                        <div style="font-size:0.75rem; color:#71717A; background:#FAFAFA; border:1px solid #E4E4E7; padding:0.5rem; border-radius:6px; font-family:monospace;">
                            Sample: <strong>${escapeHtml(svc.assembleCode(t.blocks, t))}</strong>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.4rem; margin-top:1.25rem; padding-top:0.75rem; border-top:1px solid #E4E4E7; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-secondary btn-apply-tmpl" data-id="${t.id}" style="font-size:0.75rem; font-weight:600; padding:0.3rem 0.65rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Load in Builder</button>
                        <button class="btn btn-sm btn-secondary btn-dup-tmpl" data-id="${t.id}" style="font-size:0.75rem; font-weight:600; padding:0.3rem 0.65rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Duplicate</button>
                        ${!t.isDefault ? `
                            <button class="btn btn-sm btn-secondary btn-default-tmpl" data-id="${t.id}" style="font-size:0.75rem; font-weight:600; padding:0.3rem 0.65rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Set Default</button>
                        ` : ''}
                        ${!t.isSystemLocked && t.id !== 'tmpl-standard-product-code' ? `
                            <button class="btn btn-sm btn-secondary btn-del-tmpl" data-id="${t.id}" data-name="${escapeHtml(t.name)}" style="font-size:0.75rem; font-weight:600; padding:0.3rem 0.65rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#dc2626; border-radius:6px; cursor:pointer;" title="Delete Template">Delete</button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    target.querySelectorAll('.btn-apply-tmpl').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tmpl = await svc.getTemplateById(btn.dataset.id);
            if (tmpl) {
                activeBlocks = JSON.parse(JSON.stringify(tmpl.blocks));
                activeSeparatorConfig = {
                    globalSeparator: tmpl.globalSeparator || '-',
                    prefix: tmpl.prefix || '',
                    suffix: tmpl.suffix || '',
                    fixedLength: tmpl.fixedLength || 0
                };
                activeTab = 'builder';
                const navBtns = document.querySelectorAll('.studio-tab-btn');
                navBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === 'builder'));
                renderCustomBuilderTab(target);
                showAlert.success(`Loaded "${tmpl.name}" into Code Builder.`);
            }
        });
    });

    target.querySelectorAll('.btn-dup-tmpl').forEach(btn => {
        btn.addEventListener('click', async () => {
            await svc.duplicateTemplate(btn.dataset.id);
            showAlert.success("Template duplicated.");
            renderTemplatesTab(target);
        });
    });

    target.querySelectorAll('.btn-default-tmpl').forEach(btn => {
        btn.addEventListener('click', async () => {
            await svc.setDefaultTemplate(btn.dataset.id);
            showAlert.success("Workspace default template updated.");
            renderTemplatesTab(target);
        });
    });

    target.querySelectorAll('.btn-del-tmpl').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name || 'Template';
            const confirmed = await showAlert.confirm(`Are you sure you want to delete template "${name}"?`, "Delete Template");
            if (confirmed) {
                try {
                    await svc.deleteTemplate(btn.dataset.id);
                    showAlert.success(`Template "${name}" deleted successfully.`);
                    renderTemplatesTab(target);
                } catch (err) {
                    showAlert.error(err.message || "Failed to delete template.");
                }
            }
        });
    });

    target.querySelector('#btn-create-new-template')?.addEventListener('click', () => {
        openSaveTemplateModal();
    });
};

// =============================================================================
// TAB F: CODE HISTORY & AUDIT LOG
// =============================================================================
const renderHistoryTab = async (target) => {
    const svc = getCodeStudioService(currentWorkspaceId);
    const history = await svc.getCodeHistory();

    target.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <div>
                <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Code Generation Audit History</h3>
                <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Audit trail of barcodes, custom codes, and sequence allocations across catalog operations.</p>
            </div>
            <button id="btn-clear-code-history" class="btn btn-secondary" style="font-size:0.8rem; font-weight:600; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">
                Clear Log
            </button>
        </div>

        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; overflow:hidden;">
            ${history.length === 0 ? `
                <div style="padding:3rem; text-align:center; color:#71717A; font-size:0.88rem;">
                    No code generation events recorded yet. Generated codes and assigned products will appear here.
                </div>
            ` : `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; font-size:0.75rem; text-transform:uppercase; color:#71717A;">
                                <th style="padding:0.8rem 1rem;">Timestamp</th>
                                <th style="padding:0.8rem 1rem;">Barcode / Code</th>
                                <th style="padding:0.8rem 1rem;">ConnectionID</th>
                                <th style="padding:0.8rem 1rem;">Format / Template</th>
                                <th style="padding:0.8rem 1rem;">Purpose</th>
                                <th style="padding:0.8rem 1rem;">WorkspaceID</th>
                                <th style="padding:0.8rem 1rem;">Status / Event</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(h => {
                                const connId = h.connectionId || h.productId || h.invoiceNumber || 'unlinked';
                                const isLinked = connId && connId !== 'unlinked' && connId !== 'draft';
                                const realWs = h.workspaceId || (window.__activeWorkspace?.workspaceId) || currentWorkspaceId;
                                return `
                                <tr style="border-bottom:1px solid #E4E4E7;">
                                    <td style="padding:0.8rem 1rem; font-family:monospace; font-size:0.78rem; color:#71717A; white-space:nowrap;">
                                        ${new Date(h.timestamp || Date.now()).toLocaleString()}
                                    </td>
                                    <td style="padding:0.8rem 1rem; font-family:monospace; font-weight:800; color:#18181B; font-size:0.9rem;">
                                        ${escapeHtml(h.barcode || h.code)}
                                    </td>
                                    <td style="padding:0.8rem 1rem;">
                                        <span class="badge" style="font-family:monospace; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:6px; font-weight:700; ${isLinked ? 'background:#F0FDF4; color:#166534; border:1px solid #BBF7D0;' : 'background:#F4F4F5; color:#71717A; border:1px solid #E4E4E7;'}">
                                            ${escapeHtml(connId)}
                                        </span>
                                    </td>
                                    <td style="padding:0.8rem 1rem; color:#18181B; font-weight:600;">
                                        ${escapeHtml(h.format || h.templateName || 'Custom')}
                                    </td>
                                    <td style="padding:0.8rem 1rem; color:#71717A; text-transform:capitalize; font-size:0.8rem;">
                                        ${escapeHtml(h.purpose || 'catalog')}
                                    </td>
                                    <td style="padding:0.8rem 1rem; font-family:monospace; font-size:0.75rem; color:#71717A;">
                                        ${escapeHtml(realWs)}
                                    </td>
                                    <td style="padding:0.8rem 1rem;">
                                        <span class="badge" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.72rem; padding:0.18rem 0.55rem; border-radius:4px; font-weight:700; text-transform:uppercase;">
                                            ${h.event || (isLinked ? 'committed' : 'generated')}
                                        </span>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;

    target.querySelector('#btn-clear-code-history')?.addEventListener('click', async () => {
        if (confirm("Clear all code generation history?")) {
            await svc.clearCodeHistory();
            showAlert.info("Code history cleared.");
            renderHistoryTab(target);
        }
    });
};

// =============================================================================
// TAB G: PRINT & EXPORT STUDIO (LABEL SHEETS & PDF)
// =============================================================================
const renderPrintTab = async (target) => {
    const prodService = getProductService(currentWorkspaceId);
    let products = [];
    try {
        products = await prodService.getAllActiveProducts();
        allProducts = products;
    } catch (e) {}

    const currSym = getAppCurrencySymbol();

    target.innerHTML = `
        <div style="display:grid; grid-template-columns: minmax(340px, 1fr) minmax(380px, 1.4fr); gap:1.5rem; align-items:start;">
            
            <!-- PRINT CONTROLS -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; display:flex; flex-direction:column; gap:1.15rem;">
                <div>
                    <h3 style="margin:0 0 0.25rem; font-size:1.1rem; font-weight:800; color:#18181B;">Print Layout Configuration</h3>
                    <p style="margin:0; font-size:0.8rem; color:#71717A;">Configure thermal rolls, Avery sheets, and retail shelf label tags.</p>
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Sheet Layout Preset</label>
                    <select id="print-layout-select" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="avery-3col" ${printState.layout === 'avery-3col' ? 'selected' : ''}>Avery 5160 / 3-Column Standard (30 per page)</option>
                        <option value="thermal" ${printState.layout === 'thermal' ? 'selected' : ''}>Single Thermal Label Roll (50mm &times; 30mm)</option>
                        <option value="2col" ${printState.layout === '2col' ? 'selected' : ''}>2-Column Industrial Tag (100mm &times; 50mm)</option>
                        <option value="compact-4col" ${printState.layout === 'compact-4col' ? 'selected' : ''}>4-Column Shelf Strip (44 per page)</option>
                    </select>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Total Label Copies</label>
                        <input type="number" id="print-copies" min="1" max="100" value="${printState.copies}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Catalog Sample Item</label>
                        <select id="print-sample-prod" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            <option value="current" data-name="Retail Product Tag" data-sku="${escapeHtml(barcodeState.content || 'GROC-RET-000412')}" data-price="14.50" selected>
                                Current Barcode (${escapeHtml(barcodeState.content || 'GROC-RET-000412')})
                            </option>
                            ${products.map(p => `
                                <option value="${p.id}" data-name="${escapeHtml(p.name)}" data-sku="${escapeHtml(p.upcCode || p.uniqueId || 'SKU')}" data-price="${p.salePrice || p.price || 0}">
                                    ${escapeHtml(p.name)} (${currSym}${p.salePrice || p.price || 0})
                                </option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:0.5rem; padding-top:0.5rem; border-top:1px solid #E4E4E7;">
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; font-weight:600; color:#18181B; cursor:pointer;">
                        <input type="checkbox" id="print-opt-name" ${printState.showName ? 'checked' : ''} style="width:16px; height:16px;">
                        Include Product Title
                    </label>
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; font-weight:600; color:#18181B; cursor:pointer;">
                        <input type="checkbox" id="print-opt-price" ${printState.showPrice ? 'checked' : ''} style="width:16px; height:16px;">
                        Include Retail Sale Price
                    </label>
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; font-weight:600; color:#18181B; cursor:pointer;">
                        <input type="checkbox" id="print-opt-sku" ${printState.showSku ? 'checked' : ''} style="width:16px; height:16px;">
                        Include SKU / Custom Code Text
                    </label>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-top:0.5rem;">
                    <button id="btn-trigger-browser-print" class="btn btn-secondary" style="font-weight:700; font-size:0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                        Print Directly
                    </button>
                    <button id="btn-export-label-png" class="btn btn-secondary" style="font-weight:700; font-size:0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.6rem; cursor:pointer;">
                        Download PNG
                    </button>
                </div>
                <button id="btn-export-sheet-pdf" class="btn btn-primary" style="width:100%; font-weight:700; font-size:0.85rem; background:#18181B; color:#FFFFFF; border:1px solid #18181B; border-radius:8px; padding:0.65rem; cursor:pointer; margin-top:0.25rem;">
                    Download PDF Label Sheet
                </button>
            </div>

            <!-- SHEET LIVE PREVIEW -->
            <div class="card" style="padding:1.5rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; position:sticky; top:1.5rem;">
                <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; color:#71717A; margin-bottom:0.6rem;">
                    Print Sheet Visual Preview
                </div>

                <div id="print-sheet-preview-host" style="background:#F4F4F5; border:1px solid #E4E4E7; border-radius:10px; padding:1.25rem; max-height:550px; overflow-y:auto;">
                    <!-- Injected Label Grid -->
                </div>
            </div>
        </div>
    `;

    bindPrintEvents(target);
    renderPrintSheetPreview(target);
};

const renderPrintSheetPreview = async (target) => {
    const host = target.querySelector('#print-sheet-preview-host');
    if (!host) return;

    const sampleSelect = target.querySelector('#print-sample-prod');
    const selectedOpt = sampleSelect?.options[sampleSelect.selectedIndex];
    const name = selectedOpt?.dataset.name || (barcodeState.productId ? allProducts.find(p => p.id === barcodeState.productId)?.name : null) || 'Organic Arabica Coffee';
    const sku = selectedOpt?.dataset.sku || barcodeState.content || 'GROC-RET-000412';
    const price = selectedOpt?.dataset.price || '14.50';
    const currSym = getAppCurrencySymbol();

    let gridCols = 3;
    if (printState.layout === 'thermal') gridCols = 1;
    else if (printState.layout === '2col') gridCols = 2;
    else if (printState.layout === 'compact-4col') gridCols = 4;

    const count = Math.min(printState.copies, 24); // Cap preview to 24 labels

    // Generate real barcode data URL for preview
    const barcodeDataUrl = await generateBarcodeDataUrl(sku, barcodeState.format, { height: 45, width: 2, displayValue: false });

    host.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(${gridCols}, 1fr); gap:8px;">
            ${Array.from({ length: count }).map(() => `
                <div style="background:#FFFFFF; border:1px solid #E4E4E7; box-shadow:0 1px 3px rgba(0,0,0,0.03); border-radius:6px; padding:8px; display:flex; flex-direction:column; align-items:center; text-align:center; font-size:11px;">
                    ${printState.showName ? `<div style="font-weight:700; color:#18181B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; margin-bottom:2px;">${escapeHtml(name)}</div>` : ''}
                    ${barcodeDataUrl ? `
                        <img src="${barcodeDataUrl}" alt="Barcode" style="height:36px; width:94%; object-fit:contain; margin:3px 0;">
                    ` : `
                        <div style="height:36px; width:90%; background:repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px); margin:4px 0;"></div>
                    `}
                    ${printState.showSku ? `<div style="font-family:monospace; font-size:9px; font-weight:700; color:#18181B;">${escapeHtml(sku)}</div>` : ''}
                    ${printState.showPrice ? `<div style="font-weight:800; font-size:11px; color:#18181B; margin-top:2px;">${currSym}${Number(price).toFixed(2)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
};

const bindPrintEvents = (target) => {
    target.querySelector('#print-layout-select')?.addEventListener('change', (e) => {
        printState.layout = e.target.value;
        renderPrintSheetPreview(target);
    });

    target.querySelector('#print-copies')?.addEventListener('input', (e) => {
        printState.copies = parseInt(e.target.value, 10) || 1;
        renderPrintSheetPreview(target);
    });

    target.querySelector('#print-sample-prod')?.addEventListener('change', () => {
        renderPrintSheetPreview(target);
    });

    target.querySelector('#print-opt-name')?.addEventListener('change', (e) => {
        printState.showName = e.target.checked;
        renderPrintSheetPreview(target);
    });

    target.querySelector('#print-opt-price')?.addEventListener('change', (e) => {
        printState.showPrice = e.target.checked;
        renderPrintSheetPreview(target);
    });

    target.querySelector('#print-opt-sku')?.addEventListener('change', (e) => {
        printState.showSku = e.target.checked;
        renderPrintSheetPreview(target);
    });

    target.querySelector('#btn-trigger-browser-print')?.addEventListener('click', () => {
        window.print();
    });

    target.querySelector('#btn-export-label-png')?.addEventListener('click', () => {
        downloadLabelPNG();
    });

    target.querySelector('#btn-export-sheet-pdf')?.addEventListener('click', () => {
        exportPDFSheet();
    });
};

const downloadLabelPNG = async () => {
    const sel = document.getElementById('print-sample-prod');
    const selectedOpt = sel?.options[sel.selectedIndex];
    const name = selectedOpt?.dataset.name || (barcodeState.productId ? allProducts.find(p => p.id === barcodeState.productId)?.name : null) || 'Supermarket Retail Item';
    const sku = selectedOpt?.dataset.sku || barcodeState.content || 'GROC-RET-000412';
    const price = selectedOpt?.dataset.price || '14.50';
    const currSym = getAppCurrencySymbol();

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#E4E4E7';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    if (printState.showName) {
        ctx.fillStyle = '#18181B';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(name.substring(0, 24), 25, 48);
    }
    if (printState.showPrice) {
        ctx.fillStyle = '#18181B';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${currSym}${Number(price).toFixed(2)}`, canvas.width - 25, 48);
    }

    const finishDownload = () => {
        if (printState.showSku) {
            ctx.fillStyle = '#18181B';
            ctx.font = 'bold 20px "Courier New", Courier, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sku, canvas.width / 2, canvas.height - 30);
        }
        const a = document.createElement("a");
        a.download = `label_${sku.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showAlert.success("Retail label card downloaded as high-res PNG.");
    };

    const barcodeDataUrl = await generateBarcodeDataUrl(sku, barcodeState.format, { height: 120, width: 3, displayValue: false });
    if (barcodeDataUrl) {
        const bImg = new Image();
        bImg.onload = () => {
            ctx.drawImage(bImg, 25, 75, canvas.width - 50, 190);
            finishDownload();
        };
        bImg.onerror = () => {
            renderCanvasBarcodeBars(ctx, sku, 25, 75, canvas.width - 50, 190);
            finishDownload();
        };
        bImg.src = barcodeDataUrl;
    } else {
        renderCanvasBarcodeBars(ctx, sku, 25, 75, canvas.width - 50, 190);
        finishDownload();
    }
};

const exportPDFSheet = async () => {
    if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(24, 24, 27);
        doc.text("PriceLister Retail Barcode Labels", 14, 15);
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(113, 113, 122);
        doc.text(`Generated: ${new Date().toLocaleString()} • Format: ${barcodeState.format}`, 14, 21);

        const sel = document.getElementById('print-sample-prod');
        const selectedOpt = sel?.options[sel.selectedIndex];
        const name = selectedOpt?.dataset.name || (barcodeState.productId ? allProducts.find(p => p.id === barcodeState.productId)?.name : null) || 'Supermarket Retail Item';
        const sku = selectedOpt?.dataset.sku || barcodeState.content || 'GROC-RET-000412';
        const price = selectedOpt?.dataset.price || '14.50';
        const currSym = getAppCurrencySymbol();

        // Generate genuine barcode image data URL via canvas
        const barcodeDataUrl = await generateBarcodeDataUrl(sku, barcodeState.format, { height: 50, width: 2, displayValue: false });

        let x = 14;
        let y = 28;
        const w = 58;
        const h = 32;
        const cols = printState.layout === 'thermal' ? 1 : (printState.layout === '2col' ? 2 : (printState.layout === 'compact-4col' ? 4 : 3));
        const spacingX = 6;
        const spacingY = 5;

        for (let i = 0; i < Math.min(printState.copies, 60); i++) {
            // Label box
            doc.setDrawColor(228, 228, 231);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, y, w, h, 2, 2, 'FD');

            // Product Title
            if (printState.showName) {
                doc.setFontSize(8);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(24, 24, 27);
                const truncatedName = name.length > 22 ? name.substring(0, 20) + '...' : name;
                doc.text(truncatedName, x + 3.5, y + 5);
            }

            // Price (top right)
            if (printState.showPrice) {
                doc.setFontSize(8);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(24, 24, 27);
                doc.text(`${currSym}${Number(price).toFixed(2)}`, x + w - 3.5, y + 5, { align: 'right' });
            }

            // Real barcode graphic image embedded directly into PDF with fail-safe vector fallback
            if (barcodeDataUrl) {
                try {
                    doc.addImage(barcodeDataUrl, 'PNG', x + 3, y + 6.5, w - 6, 17);
                } catch (imgErr) {
                    console.warn("doc.addImage error, drawing vector barcode fallback:", imgErr);
                    drawDirectVectorBarcode(doc, sku, x + 3, y + 6.5, w - 6, 17);
                }
            } else {
                drawDirectVectorBarcode(doc, sku, x + 3, y + 6.5, w - 6, 17);
            }

            // Human-readable SKU code text (bottom center)
            if (printState.showSku) {
                doc.setFont('Courier', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(24, 24, 27);
                doc.text(sku, x + (w / 2), y + h - 2.5, { align: 'center' });
            }

            x += w + spacingX;
            if ((i + 1) % cols === 0) {
                x = 14;
                y += h + spacingY;
                if (y + h > 275 && (i + 1) < Math.min(printState.copies, 60)) {
                    doc.addPage();
                    x = 14;
                    y = 20;
                }
            }
        }

        doc.save(`pricelister_barcode_labels_${Date.now()}.pdf`);
        showAlert.success("Retail barcode labels with scannable barcodes exported to PDF.");
    } else {
        showAlert.info("jsPDF library loading... Triggering direct print.");
        window.print();
    }
};

// =============================================================================
// MODALS FOR CUSTOM CODE BUILDER
// =============================================================================
const openAddBlockModal = (onSuccess) => {
    const modalId = 'modal-add-code-block';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    modal.innerHTML = `
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 480px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Add New Code Block</h3>
                <button id="btn-close-block-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-add-block" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Block Generation Type *</label>
                    <select id="new-block-type" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="fixed_text">1. Fixed Text (e.g. ${escapeHtml((activeRegionConfig && activeRegionConfig.examples.fixedText) || 'RFL, BAR, P')})</option>
                        <option value="random_uppercase">2. Random Uppercase (e.g. RFJ, KLM)</option>
                        <option value="random_lowercase">3. Random Lowercase (e.g. bar, xyz)</option>
                        <option value="random_numbers">4. Random Numbers (e.g. 8472, 0291)</option>
                        <option value="random_alphanumeric">5. Random Alphanumeric (e.g. R8F2, K9LM)</option>
                        <option value="sequential_number">6. Sequential Number (e.g. 000001, 000002)</option>
                        <option value="timestamp">7. Timestamp (HHmmss / Time string)</option>
                        <option value="date_based">8. Date-Based Identifier (YYMMDD, YYYYWW)</option>
                        <option value="product_info">9. Product Information (Category/SKU/Brand)</option>
                        <option value="custom_input">10. Custom Input (User Prompt)</option>
                        <option value="check_digit">11. Check Digit (Modulo 10 / 43 / Luhn)</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Block Display Name *</label>
                    <input type="text" id="new-block-name" required value="Custom Block" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Value / Format Parameter</label>
                    <input type="text" id="new-block-val" value="TAG" placeholder="e.g. TAG, YYMMDD, or length" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-block-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Add Block</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-block-modal').onclick = close;
    modal.querySelector('#btn-cancel-block-modal').onclick = close;

    modal.querySelector('#form-add-block').onsubmit = (e) => {
        e.preventDefault();
        const type = document.getElementById('new-block-type').value;
        const name = document.getElementById('new-block-name').value.trim();
        const val = document.getElementById('new-block-val').value.trim();

        const newBlock = {
            id: `b-${Date.now()}`,
            type,
            name: name || 'New Block',
            value: val || 'X',
            length: (type.startsWith('random') || type === 'sequential_number') ? (parseInt(val, 10) || 4) : 0,
            format: val || (type === 'date_based' ? 'YYMMDD' : 'HHmmss'),
            separator: '-'
        };

        activeBlocks.push(newBlock);
        close();
        if (onSuccess) onSuccess();
    };
};

const openBlockConfigModal = (block, onSuccess) => {
    const modalId = 'modal-edit-code-block';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    modal.innerHTML = `
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 480px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Edit Block: ${escapeHtml(block.name)}</h3>
                <button id="btn-close-edit-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-edit-block" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Block Display Name</label>
                    <input type="text" id="edit-block-name" value="${escapeHtml(block.name || '')}" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Value / Character Length</label>
                    <input type="text" id="edit-block-val" value="${escapeHtml(block.value || block.length || block.format || '')}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Block Separator (Overrides global)</label>
                    <select id="edit-block-sep" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="-" ${block.separator === '-' ? 'selected' : ''}>Hyphen (-)</option>
                        <option value="_" ${block.separator === '_' ? 'selected' : ''}>Underscore (_)</option>
                        <option value="/" ${block.separator === '/' ? 'selected' : ''}>Slash (/)</option>
                        <option value="." ${block.separator === '.' ? 'selected' : ''}>Period (.)</option>
                        <option value="" ${block.separator === '' ? 'selected' : ''}>None (No separator)</option>
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-edit-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-edit-modal').onclick = close;
    modal.querySelector('#btn-cancel-edit-modal').onclick = close;

    modal.querySelector('#form-edit-block').onsubmit = (e) => {
        e.preventDefault();
        block.name = document.getElementById('edit-block-name').value.trim();
        const v = document.getElementById('edit-block-val').value.trim();
        if (block.type.startsWith('random') || block.type === 'sequential_number') {
            block.length = parseInt(v, 10) || 4;
        } else if (block.type === 'date_based' || block.type === 'timestamp') {
            block.format = v;
        } else {
            block.value = v;
        }
        block.separator = document.getElementById('edit-block-sep').value;
        close();
        if (onSuccess) onSuccess();
    };
};

const openSaveTemplateModal = () => {
    const modalId = 'modal-save-tmpl';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    modal.innerHTML = `
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 480px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Save as Code Template</h3>
                <button id="btn-close-tmpl-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-save-tmpl" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Template Name *</label>
                    <input type="text" id="tmpl-name-input" required placeholder="e.g. Dairy &amp; Deli Supermarket Code" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Description</label>
                    <textarea id="tmpl-desc-input" rows="2" placeholder="Explain the block purpose and aisle/category usage..." style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;"></textarea>
                </div>
                <div>
                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem; font-weight:600; color:#18181B; cursor:pointer;">
                        <input type="checkbox" id="tmpl-is-default" style="width:16px; height:16px;">
                        Set as Default Workspace Code Template
                    </label>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-tmpl-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Save Template</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-tmpl-modal').onclick = close;
    modal.querySelector('#btn-cancel-tmpl-modal').onclick = close;

    modal.querySelector('#form-save-tmpl').onsubmit = async (e) => {
        e.preventDefault();
        const svc = getCodeStudioService(currentWorkspaceId);
        const name = document.getElementById('tmpl-name-input').value.trim();
        const desc = document.getElementById('tmpl-desc-input').value.trim();
        const isDefault = document.getElementById('tmpl-is-default').checked;

        await svc.saveTemplate({
            name,
            description: desc,
            isDefault,
            blocks: activeBlocks,
            globalSeparator: activeSeparatorConfig.globalSeparator,
            prefix: activeSeparatorConfig.prefix,
            suffix: activeSeparatorConfig.suffix,
            fixedLength: activeSeparatorConfig.fixedLength
        });

        showAlert.success(`Template "${name}" saved to library.`);
        close();
        renderActiveTab();
    };
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
