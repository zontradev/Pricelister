/**
 * PriceLister - Corporate Level Invoice System, Performance Intelligence & Invoice Maker Studio
 * Complete Architecture:
 * - 4 Layout Size Presets (Customer POS Receipt, Customer A4, Business A4 300 DPI, Corporate Enterprise Large, US Letter, Custom)
 * - Multi-Page Pagination with Left/Top Page Navigator & Stacked Page Canvas
 * - Full-Screen by Default with Persisted Memory (localStorage) & Distinct Compact/Expand Icons
 * - Right-Click Hold Panning (Hand Tool) & Alt + Mouse Scroll (+ / -) Canvas Zooming
 * - Toggleable Canvas Border (On / Off) & Custom Color Picker
 * - Both BILLED FROM (Business Vendor) and BILLED TO (Customer) Prominently Shown
 * - Empty Notes Hidden (Notes section omitted if empty)
 * - In-Modal Custom Input Dialogs (Zero HTML prompt/alert boxes)
 * - Reload Session Handler (Page reload keeps fullscreen dialog open without closing)
 * - Custom Signature Upload from Drive & Draw Pad / Cursive Scripts
 * - Floating Draggable Photo & Text Elements with Vector Key (Arrow) & px Position Inputs
 * - Manually Customizable Corporate Stamp / Seal Text & Colors
 * - Expanded Financial Intelligence & COGS Scorecard
 * - Removed "Powered by Invoice maker" tag completely
 */

import { generateInvoicePdf, downloadInvoicePdf, printInvoicePdf, getInvoiceLayoutSpec, validateInvoiceLayout, calculateAnchorPosition, SPACING_TOKENS_PX } from '../utils/invoicePdfEngine.js';
import { formatCurrency, getAppCurrencySymbol, formatExactTimestamp } from '../utilities.js';
import { showAlert } from '../alert-handler.js';
import { getUserRestrictions } from '../auth-handler.js';

// =============================================================================
// SIGNATURE FONTS & CLOUD/BROWSER STORAGE (SUPABASE + LOCALSTORAGE)
// =============================================================================

export const NATIVE_SIGNATURE_FONTS = [
    // 1 Default Cursive
    {
        id: 'default_cursive',
        name: 'Dancing Script (Default Cursive)',
        category: 'cursive',
        fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
        isBold: false,
        previewText: 'Authorized Signatory'
    },
    // 3 New Cursive Alternative style signatures
    {
        id: 'cursive_great_vibes',
        name: 'Great Vibes (Flowing Calligraphy)',
        category: 'cursive',
        fontFamily: "'Great Vibes', cursive",
        isBold: false,
        previewText: 'Authorized Signatory'
    },
    {
        id: 'cursive_alex_brush',
        name: 'Alex Brush (Fluid Elegance)',
        category: 'cursive',
        fontFamily: "'Alex Brush', cursive",
        isBold: false,
        previewText: 'Authorized Signatory'
    },
    {
        id: 'cursive_allura',
        name: 'Allura (Artistic Flourish)',
        category: 'cursive',
        fontFamily: "'Allura', cursive",
        isBold: false,
        previewText: 'Authorized Signatory'
    },
    // 3 New Normal BOLD signature fonts
    {
        id: 'bold_cinzel',
        name: 'Cinzel Bold (Corporate Executive)',
        category: 'bold',
        fontFamily: "'Cinzel', serif",
        isBold: true,
        previewText: 'AUTHORIZED SIGNATORY'
    },
    {
        id: 'bold_outfit',
        name: 'Outfit Bold (Modern Sans Bold)',
        category: 'bold',
        fontFamily: "'Outfit', sans-serif",
        isBold: true,
        previewText: 'AUTHORIZED SIGNATORY'
    },
    {
        id: 'bold_merriweather',
        name: 'Merriweather Bold (Classic Formal)',
        category: 'bold',
        fontFamily: "'Merriweather', serif",
        isBold: true,
        previewText: 'AUTHORIZED SIGNATORY'
    }
];

const CUSTOM_FONTS_STORAGE_KEY = 'pricelister_custom_signature_fonts';

export const getCustomFonts = () => {
    try {
        const raw = localStorage.getItem(CUSTOM_FONTS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

export const getAllSignatureFonts = () => {
    const custom = getCustomFonts();
    return [...NATIVE_SIGNATURE_FONTS, ...custom];
};

export const injectCustomFontStylesheet = (fontName, fontUrl = null) => {
    if (!fontName || typeof document === 'undefined') return;
    const cleanId = `font-link-${fontName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (document.getElementById(cleanId)) return;

    const link = document.createElement('link');
    link.id = cleanId;
    link.rel = 'stylesheet';
    link.href = fontUrl || `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName.trim().replace(/\s+/g, '+'))}:wght@400;700;800&display=swap`;
    document.head.appendChild(link);
};

export const initSavedCustomFonts = async () => {
    const fonts = getCustomFonts();
    fonts.forEach(f => {
        injectCustomFontStylesheet(f.name, f.url);
    });

    if (typeof window !== 'undefined' && window.supabase) {
        try {
            const { data, error } = await window.supabase.from('custom_fonts').select('*');
            if (!error && Array.isArray(data) && data.length > 0) {
                const current = getCustomFonts();
                const currentIds = new Set(current.map(f => f.id));
                let changed = false;
                for (const row of data) {
                    if (!currentIds.has(row.id)) {
                        current.push({
                            id: row.id,
                            name: row.name,
                            category: row.category || 'custom',
                            fontFamily: row.family,
                            isBold: !!row.is_bold,
                            url: row.url || null
                        });
                        injectCustomFontStylesheet(row.name, row.url);
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(current));
                }
            }
        } catch (e) {
            // Non-blocking
        }
    }
};

if (typeof window !== 'undefined') {
    setTimeout(initSavedCustomFonts, 120);
}

export const saveCustomFont = async (fontObj) => {
    const fonts = getCustomFonts();
    const idx = fonts.findIndex(f => f.id === fontObj.id);
    if (idx >= 0) {
        fonts[idx] = fontObj;
    } else {
        fonts.push(fontObj);
    }
    localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(fonts));
    injectCustomFontStylesheet(fontObj.name, fontObj.url);

    if (typeof window !== 'undefined' && window.supabase) {
        try {
            await window.supabase.from('custom_fonts').upsert({
                id: fontObj.id,
                name: fontObj.name,
                family: fontObj.fontFamily,
                is_bold: fontObj.isBold,
                category: fontObj.category || 'custom',
                url: fontObj.url || null,
                created_at: new Date().toISOString()
            });
        } catch (err) {
            console.log("Supabase font sync notice:", err);
        }
    }
    return fonts;
};

export const deleteCustomFont = async (fontId) => {
    let fonts = getCustomFonts();
    fonts = fonts.filter(f => f.id !== fontId);
    localStorage.setItem(CUSTOM_FONTS_STORAGE_KEY, JSON.stringify(fonts));

    if (typeof window !== 'undefined' && window.supabase) {
        try {
            await window.supabase.from('custom_fonts').delete().eq('id', fontId);
        } catch (err) {
            console.log("Supabase font delete notice:", err);
        }
    }
    return fonts;
};

/**
 * Interactive In-Modal Add Custom Font Dialog
 */
export const showAddCustomFontModal = (onFontAdded) => {
    const existing = document.getElementById('iv-custom-font-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'iv-custom-font-modal';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(15, 23, 42, 0.65)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.zIndex = '100050';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';

    overlay.innerHTML = `
        <div style="background:#ffffff; border-radius:12px; width:100%; max-width:440px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3); border:1px solid #e2e8f0; overflow:hidden; animation:ivFadeIn 0.2s ease;">
            <div style="background:#0f172a; color:#ffffff; padding:0.9rem 1.25rem; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:0.9rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg></span> Add Custom Signature Font
                </div>
                <button type="button" id="iv-close-font-modal" style="background:none; border:none; color:#94a3b8; font-size:1.2rem; cursor:pointer; line-height:1;">&times;</button>
            </div>
            
            <div style="padding:1.25rem; display:flex; flex-direction:column; gap:0.9rem;">
                <div>
                    <label style="font-size:0.75rem; font-weight:700; color:#334155; display:block; margin-bottom:0.25rem;">Font Name (Google Fonts or System)</label>
                    <input type="text" id="iv-new-font-name" class="form-control" placeholder="e.g. Pacifico, Caveat, Sacramento, Montserrat" style="font-size:0.85rem; padding:0.45rem 0.65rem;">
                    <div style="font-size:0.68rem; color:#64748b; margin-top:0.2rem;">Tip: Any Google Font will be automatically loaded and available for future invoices.</div>
                </div>

                <div>
                    <label style="font-size:0.75rem; font-weight:700; color:#334155; display:block; margin-bottom:0.25rem;">Style Category</label>
                    <div style="display:flex; gap:0.5rem;">
                        <label style="flex:1; display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; padding:0.4rem 0.6rem; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; background:#f8fafc;">
                            <input type="radio" name="iv-font-cat" value="cursive" checked style="accent-color:#18181B;">
                            <span>Cursive Script</span>
                        </label>
                        <label style="flex:1; display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; padding:0.4rem 0.6rem; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; background:#f8fafc;">
                            <input type="radio" name="iv-font-cat" value="bold" style="accent-color:#18181B;">
                            <span>Normal BOLD</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label style="font-size:0.75rem; font-weight:700; color:#334155; display:block; margin-bottom:0.25rem;">Custom CSS Font URL (Optional)</label>
                    <input type="text" id="iv-new-font-url" class="form-control" placeholder="Leave empty for auto Google Font CDN URL" style="font-size:0.8rem; padding:0.4rem 0.65rem;">
                </div>

                <!-- Real-time Font Preview -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; text-align:center;">
                    <div style="font-size:0.68rem; color:#64748b; margin-bottom:0.25rem; font-weight:600;">Live Font Preview</div>
                    <div id="iv-modal-font-preview" style="min-height:44px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:#0f172a;">
                        Authorized Signatory
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.25rem;">
                    <button type="button" id="iv-cancel-font-btn" class="btn btn-secondary btn-sm" style="padding:0.4rem 0.8rem; font-size:0.8rem;">Cancel</button>
                    <button type="button" id="iv-save-font-btn" class="btn btn-primary btn-sm" style="padding:0.4rem 1rem; font-size:0.8rem; background:#18181B; border-color:#18181B; font-weight:700;">Save & Use Font</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#iv-new-font-name');
    const urlInput = overlay.querySelector('#iv-new-font-url');
    const previewEl = overlay.querySelector('#iv-modal-font-preview');
    const catRadios = overlay.querySelectorAll('input[name="iv-font-cat"]');
    const closeBtn = overlay.querySelector('#iv-close-font-modal');
    const cancelBtn = overlay.querySelector('#iv-cancel-font-btn');
    const saveBtn = overlay.querySelector('#iv-save-font-btn');

    let previewDebounce = null;
    const updatePreview = () => {
        const rawName = nameInput.value.trim();
        const customUrl = urlInput.value.trim();
        const selectedCat = Array.from(catRadios).find(r => r.checked)?.value || 'cursive';
        const isBold = selectedCat === 'bold';

        if (!rawName) {
            previewEl.style.fontFamily = 'inherit';
            previewEl.style.fontWeight = isBold ? 800 : 400;
            previewEl.style.fontSize = isBold ? '1.15rem' : '1.5rem';
            previewEl.textContent = isBold ? 'AUTHORIZED SIGNATORY' : 'Authorized Signatory';
            return;
        }

        injectCustomFontStylesheet(rawName, customUrl || null);
        previewEl.style.fontFamily = `'${rawName}', ${isBold ? 'sans-serif' : 'cursive'}`;
        previewEl.style.fontWeight = isBold ? 800 : 400;
        previewEl.style.fontSize = isBold ? '1.15rem' : '1.6rem';
        previewEl.textContent = isBold ? 'AUTHORIZED SIGNATORY' : 'Authorized Signatory';
    };

    nameInput.addEventListener('input', () => {
        if (previewDebounce) clearTimeout(previewDebounce);
        previewDebounce = setTimeout(updatePreview, 250);
    });

    urlInput.addEventListener('input', () => {
        if (previewDebounce) clearTimeout(previewDebounce);
        previewDebounce = setTimeout(updatePreview, 250);
    });

    catRadios.forEach(r => r.addEventListener('change', updatePreview));

    const closeModal = () => overlay.remove();
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', async () => {
        const name = nameInput.value.trim();
        if (!name) {
            showAlert.warning("Please enter a font name.");
            nameInput.focus();
            return;
        }

        const selectedCat = Array.from(catRadios).find(r => r.checked)?.value || 'cursive';
        const isBold = selectedCat === 'bold';
        const customUrl = urlInput.value.trim();
        const fontId = 'font_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36);

        const newFontObj = {
            id: fontId,
            name: `${name} (${isBold ? 'Bold' : 'Script'})`,
            category: selectedCat,
            fontFamily: `'${name}', ${isBold ? 'sans-serif' : 'cursive'}`,
            isBold: isBold,
            url: customUrl || null,
            previewText: isBold ? 'AUTHORIZED SIGNATORY' : 'Authorized Signatory'
        };

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
            await saveCustomFont(newFontObj);
            closeModal();
            showAlert.success(`Font "${name}" saved to browser & synced to cloud!`);
            if (typeof onFontAdded === 'function') {
                onFontAdded(newFontObj);
            }
        } catch (err) {
            console.error("Error saving custom font:", err);
            showAlert.error("Could not save font: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save & Use Font';
        }
    });

    setTimeout(() => nameInput.focus(), 60);
};

// =============================================================================
// SMOOTH SIGNATURE DRAWING PAD WITH RETINA SCALING & PRISTINE TRANSPARENT EXPORT
// =============================================================================

export class SignatureDrawingPad {
    constructor(canvasEl) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.strokes = [];
        this.currentStroke = null;
        this.currentColor = '#0f172a';
        this.lineWidth = 2.4;
        this.scale = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.max(2, window.devicePixelRatio) : 2;
        
        this.initCanvasSize();
        this.setupEvents();
        this.redraw();
    }

    initCanvasSize() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width > 0 ? rect.width : 340;
        const displayHeight = rect.height > 0 ? rect.height : 110;
        
        this.canvas.width = Math.round(displayWidth * this.scale);
        this.canvas.height = Math.round(displayHeight * this.scale);
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.scale, this.scale);
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
    }

    setupEvents() {
        if (!this.canvas) return;

        const getCanvasPoint = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        const handlePointerDown = (e) => {
            e.preventDefault();
            try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
            const pt = getCanvasPoint(e);
            this.currentStroke = {
                color: this.currentColor,
                width: this.lineWidth,
                points: [pt]
            };
            this.redraw();
        };

        const handlePointerMove = (e) => {
            if (!this.currentStroke) return;
            e.preventDefault();
            const pt = getCanvasPoint(e);
            this.currentStroke.points.push(pt);
            this.redraw();
        };

        const handlePointerUp = (e) => {
            if (!this.currentStroke) return;
            e.preventDefault();
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
            if (this.currentStroke.points.length > 0) {
                this.strokes.push(this.currentStroke);
            }
            this.currentStroke = null;
            this.redraw();
        };

        this.canvas.addEventListener('pointerdown', handlePointerDown);
        this.canvas.addEventListener('pointermove', handlePointerMove);
        this.canvas.addEventListener('pointerup', handlePointerUp);
        this.canvas.addEventListener('pointercancel', handlePointerUp);
    }

    setColor(color) {
        this.currentColor = color;
    }

    clear() {
        this.strokes = [];
        this.currentStroke = null;
        this.redraw();
    }

    undo() {
        if (this.strokes.length > 0) {
            this.strokes.pop();
            this.redraw();
        }
    }

    isEmpty() {
        return this.strokes.length === 0 && (!this.currentStroke || this.currentStroke.points.length === 0);
    }

    redraw() {
        const { ctx, displayWidth, displayHeight } = this;
        if (!ctx || !displayWidth || !displayHeight) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();

        // Draw baseline dashed guide
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        const lineY = displayHeight - 24;
        ctx.moveTo(15, lineY);
        ctx.lineTo(displayWidth - 15, lineY);
        ctx.stroke();

        // Guide text if empty
        if (this.isEmpty()) {
            ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText('Draw your signature here with mouse or touch', displayWidth / 2, displayHeight / 2 - 4);
            ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('Sign on or above the baseline guide', displayWidth / 2, displayHeight / 2 + 12);
        }
        ctx.restore();

        const allStrokes = [...this.strokes];
        if (this.currentStroke) allStrokes.push(this.currentStroke);

        for (const stroke of allStrokes) {
            this.drawStroke(stroke, ctx);
        }
    }

    drawStroke(stroke, targetCtx) {
        const { points, color, width } = stroke;
        if (!points || points.length === 0) return;

        targetCtx.save();
        targetCtx.strokeStyle = color;
        targetCtx.lineWidth = width;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';

        if (points.length === 1) {
            targetCtx.beginPath();
            targetCtx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
            targetCtx.fillStyle = color;
            targetCtx.fill();
            targetCtx.restore();
            return;
        }

        targetCtx.beginPath();
        targetCtx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            targetCtx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }

        targetCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        targetCtx.stroke();
        targetCtx.restore();
    }

    // Export pristine transparent PNG with ink strokes only
    toDataURL() {
        if (this.isEmpty()) return null;

        const offCanvas = document.createElement('canvas');
        offCanvas.width = this.canvas.width;
        offCanvas.height = this.canvas.height;
        const offCtx = offCanvas.getContext('2d');
        offCtx.scale(this.scale, this.scale);

        for (const stroke of this.strokes) {
            this.drawStroke(stroke, offCtx);
        }

        return offCanvas.toDataURL('image/png');
    }
}

let currentInvoice = null;

// Read default fullscreen preference from localStorage (Default: true)
const getInitialFullscreenPref = () => {
    try {
        const saved = localStorage.getItem('iv_dialog_fullscreen');
        return saved === null ? true : saved === 'true';
    } catch (e) {
        return true;
    }
};

export const getInitialSidebarPosPref = () => {
    try {
        return localStorage.getItem('iv_sidebar_position') || 'right'; // Default: RIGHT
    } catch (e) {
        return 'right';
    }
};

export const getInitialSidebarWidthPref = () => {
    try {
        const val = parseInt(localStorage.getItem('iv_sidebar_width'), 10);
        return (!isNaN(val) && val >= 280 && val <= 580) ? val : 380;
    } catch (e) {
        return 380;
    }
};

export const INVOICE_STYLE_THEMES = [
    { id: 'RUBY_EXECUTIVE', name: 'Ruby Executive', primary: '#18181B', dark: '#0f172a', desc: 'High-impact executive corporate' },
    { id: 'MIDNIGHT_NAVY', name: 'Midnight Corporate', primary: '#1e3a8a', dark: '#0f172a', desc: 'Wall St. & enterprise finance' },
    { id: 'EMERALD_CORP', name: 'Emerald Enterprise', primary: '#059669', dark: '#064e3b', desc: 'Modern commerce & tech' },
    { id: 'SWISS_EDITORIAL', name: 'Swiss Editorial', primary: '#18181b', dark: '#09090b', desc: 'Minimalist luxury monochrome' },
    { id: 'ONYX_GOLD', name: 'Luxury Onyx & Gold', primary: '#d97706', dark: '#1c1917', desc: 'Elite boutique & consulting' }
];

let currentOptions = {
    template: 'MODERN_RED',
    themeId: 'RUBY_EXECUTIVE',
    themeColor: '#18181B',
    sizePreset: 'BUSINESS_A4', // 'POS_RECEIPT', 'CUSTOMER_A4', 'BUSINESS_A4', 'CORPORATE_ENTERPRISE', 'US_LETTER', 'CUSTOM'
    customWidth: 800,
    customHeight: 1100,
    zoomLevel: 1.0,
    isFullscreen: getInitialFullscreenPref(),
    sidebarPosition: getInitialSidebarPosPref(),
    sidebarWidth: getInitialSidebarWidthPref(),
    showBilledFrom: true, // Default ON: user can toggle From on/off
    canvasEngineMode: (() => {
        try {
            return localStorage.getItem('iv_canvas_engine_mode') || 'vector';
        } catch (e) {
            return 'vector';
        }
    })(),
    enableDataChanges: false,
    brandingMode: 'WORKSPACE',
    currencySymbol: '$',
    itemsPerPage: 6,
    activePage: 1,
    customBranding: {
        title: '',
        subtitle: 'Commercial Sales Invoice',
        phone: '',
        email: '',
        address: '',
        notes: '',
        termsAndConditions: '1. Payment is due within 14 business days.\n2. Goods once sold are subject to standard manufacturer warranty.\n3. Please quote invoice reference number upon bank wire remittance.',
        taxId: 'TAX-9948201',
        bankDetails: 'Bank: Standard Corporate • Account: 0849201948 • SWIFT: SCBLBDDX',
        poNumber: 'PO-2026-8801'
    },
    canvasStyle: {
        background: '#ffffff',
        shadow: 'studio', // 'none' | 'studio' | 'crisp'
        workspaceBg: 'studio_dots' // 'studio_dots' | 'slate' | 'dark'
    },
    border: {
        enabled: false, // Default: OFF as requested
        color: '#18181B',
        width: 1,
        radius: 8,
        style: 'solid'
    },
    elements: {
        customTexts: [],
        dividers: [],
        floatingElements: [], // { id, type: 'text'|'photo', text, src, x, y, width, height, fontSize, color }
        signature: {
            enabled: false,
            type: 'font', // 'font' | 'draw' | 'upload'
            fontId: 'default_cursive',
            fontFamily: "'Dancing Script', 'Brush Script MT', cursive",
            isBold: false,
            signerName: 'Authorized Signatory',
            signerSubName: 'Authorized Signatory',
            signerTitle: 'Executive Officer',
            date: new Date().toLocaleDateString(),
            dataUrl: null
        },
        stamp: {
            enabled: false,
            type: 'APPROVED', // 'APPROVED' | 'PAID' | 'OFFICIAL' | 'CUSTOM'
            customText: 'APPROVED & VERIFIED',
            color: '#059669',
            dataUrl: null
        }
    }
};

let selectedFloatingElId = null;
let popstateHandler = null;

/**
 * Save current viewer session to sessionStorage for reload persistence
 */
const saveViewerSession = () => {
    try {
        if (currentInvoice) {
            sessionStorage.setItem('iv_active_session', JSON.stringify({
                invoice: currentInvoice,
                options: currentOptions,
                isOpen: true
            }));
        }
    } catch (e) {
        console.warn('Could not save viewer session:', e);
    }
};

/**
 * Clear viewer session from sessionStorage
 */
const clearViewerSession = () => {
    try {
        sessionStorage.removeItem('iv_active_session');
    } catch (e) {}
};

/**
 * Open Dedicated Invoice Viewer & Maker Modal
 * @param {Object} invoice - Full invoice object
 * @param {Function} onEditCallback - Optional callback when user edits original invoice
 */
export const openInvoiceViewerModal = async (invoice, onEditCallback = null) => {
    if (!invoice) return;
    
    // Deep clone invoice for safe live modifications
    currentInvoice = JSON.parse(JSON.stringify(invoice));
    currentOptions.currencySymbol = currentInvoice.currency || getAppCurrencySymbol();

    // Default branding from active workspace
    if (window.__activeWorkspace) {
        currentOptions.customBranding.title = window.__activeWorkspace.name || currentInvoice.businessName || '';
        currentOptions.customBranding.phone = window.__activeWorkspace.phone || currentInvoice.businessPhone || '';
        currentOptions.customBranding.email = window.__activeWorkspace.email || currentInvoice.businessEmail || '';
        currentOptions.customBranding.address = window.__activeWorkspace.address || currentInvoice.businessAddress || '';
    }

    // Remove existing modal if any
    const existingModal = document.getElementById('invoice-viewer-modal-overlay');
    if (existingModal) existingModal.remove();

    // Persist session state for reload resilience
    saveViewerSession();

    // Browser Back Button Interception (Panel Screen)
    const historyState = { isInvoiceViewerOpen: true, timestamp: Date.now() };
    window.history.pushState(historyState, '');

    const overlay = document.createElement('div');
    overlay.id = 'invoice-viewer-modal-overlay';
    overlay.className = `iv-modal-overlay ${currentOptions.isFullscreen ? 'is-fullscreen' : ''}`;

    overlay.innerHTML = `
        <div class="iv-modal-card ${currentOptions.isFullscreen ? 'is-fullscreen' : ''}" id="iv-modal-card" role="dialog" aria-modal="true" aria-label="Corporate Invoice System & Maker">
            
            <!-- Modal Header / Toolbar -->
            <div class="iv-modal-header">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <span class="iv-modal-header-icon" title="Corporate Invoice Studio">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </span>
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <h3 class="iv-modal-title">Corporate Invoice Viewer & Maker</h3>
                            <span class="badge" style="background:rgba(225,29,72,0.1); color:#18181B; font-size:0.68rem; font-weight:700; padding:0.15rem 0.45rem; border-radius:4px; text-transform:uppercase;">Enterprise Studio</span>
                        </div>
                        <span class="iv-modal-subtitle" id="iv-header-inv-num">Invoice #${escapeHtml(currentInvoice.busInvNumber || currentInvoice.invoiceNumber || currentInvoice.id || 'INV-001')}</span>
                    </div>
                </div>

                <!-- Right Action Buttons -->
                <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                    
                    <!-- Sidebar Position Switcher (Left / Right, Default: Right) -->
                    <button type="button" id="iv-btn-shift-sidebar" class="btn btn-secondary" style="font-weight:600; padding:0.4rem 0.75rem; font-size:0.8rem; display:flex; align-items:center; gap:0.4rem;" title="Switch Sidebar Position (Left / Right)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="${(currentOptions.sidebarPosition || 'right') === 'right' ? '15' : '9'}" y1="3" x2="${(currentOptions.sidebarPosition || 'right') === 'right' ? '15' : '9'}" y2="21"></line></svg>
                        <span id="iv-sidebar-pos-label">${(currentOptions.sidebarPosition || 'right') === 'right' ? 'Sidebar: Right' : 'Sidebar: Left'}</span>
                    </button>

                    <!-- Zoom & Scale Controls -->
                    <div class="iv-zoom-toolbar" title="Zoom: Alt + Mouse Scroll or slider">
                        <span>Zoom:</span>
                        <input type="range" id="iv-zoom-slider" class="iv-zoom-slider" min="40" max="180" value="${Math.round(currentOptions.zoomLevel * 100)}" step="5">
                        <span id="iv-zoom-display" style="width:38px; text-align:right;">${Math.round(currentOptions.zoomLevel * 100)}%</span>
                        <button type="button" id="iv-btn-zoom-reset" class="btn btn-sm btn-ghost" style="padding:0.15rem 0.4rem; font-size:0.7rem;" title="Reset Zoom to 100%">100%</button>
                    </div>

                    <button type="button" id="iv-btn-share-whatsapp" class="btn btn-secondary" style="font-weight:600; padding:0.4rem 0.8rem; font-size:0.82rem; display:flex; align-items:center; gap:0.35rem;" title="Share Invoice via WhatsApp">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        WhatsApp
                    </button>

                    <button type="button" id="iv-btn-print-action" class="btn btn-secondary" style="font-weight:600; padding:0.4rem 0.8rem; font-size:0.82rem; display:flex; align-items:center; gap:0.35rem;" title="Print Invoice">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print
                    </button>

                    <button type="button" id="iv-btn-download-pdf" class="btn btn-primary" style="font-weight:700; padding:0.4rem 1rem; font-size:0.82rem; display:flex; align-items:center; gap:0.4rem; background: linear-gradient(135deg, #ff3366 0%, #18181B 55%, #27272A 100%); box-shadow:0 4px 14px rgba(225,29,72,0.35);" title="Download Vector PDF">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export PDF
                    </button>

                    <!-- Fullscreen / Compact Dialog Toggle Button (Distinct Icons) -->
                    <button type="button" id="iv-btn-fullscreen-toggle" class="icon-btn" style="padding:0.4rem; color:var(--text-secondary); cursor:pointer; background:none; border:1px solid var(--border-color); border-radius:6px;" title="${currentOptions.isFullscreen ? 'Compact Window View' : 'Expand to Fullscreen Panel'}">
                        ${currentOptions.isFullscreen ? `
                            <!-- Compact Icon (Inward Arrows) -->
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" id="iv-fullscreen-icon"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
                        ` : `
                            <!-- Fullscreen Icon (Outward Arrows) -->
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" id="iv-fullscreen-icon"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        `}
                    </button>

                    <!-- Close Icon (Panel Back Screen) -->
                    <button type="button" id="iv-modal-close-btn" class="icon-btn" style="font-size:1.35rem; padding:0.25rem 0.5rem; color:var(--text-secondary); cursor:pointer; background:none; border:none; line-height:1;" title="Close Panel (Esc / Back)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                </div>
            </div>

            <!-- Modal Content Grid: Visual Canvas Workspace & Resizable Sidebar (Default: Right) -->
            <div class="iv-modal-grid sidebar-${currentOptions.sidebarPosition || 'right'}" id="iv-modal-grid" style="--iv-sidebar-width: ${currentOptions.sidebarWidth || 380}px;">
                
                <!-- TOOLS & CONTROLS COLUMN -->
                <div class="iv-controls-column" id="iv-controls-column">
                    
                    <!-- 1. INVOICE LAYOUT SIZE PRESETS & CORPORATE STYLES -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>1. Invoice Layout Size Presets</span>
                            <span style="font-size:0.72rem; color:var(--primary); font-weight:700;">Standard & Custom</span>
                        </label>
                        
                        <!-- Layout Sizes Select Tabs / Cards -->
                        <div style="display:flex; flex-direction:column; gap:0.4rem;">
                            
                            <!-- Customer Invoices -->
                            <span style="font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.15rem;">Customer Layouts</span>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem;">
                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'POS_RECEIPT' ? 'btn-primary' : 'btn-secondary'}" data-size="POS_RECEIPT" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>POS Bill Receipt Long</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">Continuous thermal roll</span>
                                </button>

                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'CUSTOMER_A4' ? 'btn-primary' : 'btn-secondary'}" data-size="CUSTOMER_A4" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>Customer A4 Standard</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">210 × 297 mm (Retail)</span>
                                </button>
                            </div>

                            <!-- Business Invoices -->
                            <span style="font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.35rem;">Business Layouts</span>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem;">
                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'BUSINESS_A4' ? 'btn-primary' : 'btn-secondary'}" data-size="BUSINESS_A4" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>A4 International (300 DPI)</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">2480 × 3508 px standard</span>
                                </button>

                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'CORPORATE_ENTERPRISE' ? 'btn-primary' : 'btn-secondary'}" data-size="CORPORATE_ENTERPRISE" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>Corporate Large (High DPI)</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">Executive multi-column</span>
                                </button>
                            </div>

                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.45rem;">
                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'US_LETTER' ? 'btn-primary' : 'btn-secondary'}" data-size="US_LETTER" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>US Letter Size</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">8.5″ × 11″ (Remittance)</span>
                                </button>

                                <button type="button" class="btn btn-sm iv-size-preset-btn ${currentOptions.sizePreset === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}" data-size="CUSTOM" style="font-size:0.75rem; text-align:left; padding:0.5rem 0.65rem; display:flex; flex-direction:column; gap:0.15rem;">
                                    <strong>Custom Size Handler</strong>
                                    <span style="font-size:0.65rem; opacity:0.85;">Input in pixels (W × H)</span>
                                </button>
                            </div>
                        </div>

                        <!-- Custom Size Inputs Handler -->
                        <div id="iv-custom-size-box" style="display:${currentOptions.sizePreset === 'CUSTOM' ? 'block' : 'none'}; margin-top:0.6rem; padding:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                            <span style="font-size:0.72rem; font-weight:700; color:#0f172a; display:block; margin-bottom:0.4rem;">Custom Dimensions (px):</span>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                                <div>
                                    <label style="font-size:0.7rem; color:#64748b; font-weight:600;">Width (px)</label>
                                    <input type="number" id="iv-custom-w-input" class="form-control" style="font-size:0.82rem; padding:0.35rem 0.5rem;" value="${currentOptions.customWidth}" min="300" max="3000" step="10">
                                </div>
                                <div>
                                    <label style="font-size:0.7rem; color:#64748b; font-weight:600;">Height (px)</label>
                                    <input type="number" id="iv-custom-h-input" class="form-control" style="font-size:0.82rem; padding:0.35rem 0.5rem;" value="${currentOptions.customHeight}" min="400" max="4000" step="10">
                                </div>
                            </div>
                        </div>

                        <!-- Professional Corporate Style Themes -->
                        <div style="display:flex; flex-direction:column; gap:0.35rem; margin-top:0.65rem;">
                            <span style="font-size:0.7rem; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Professional Style Themes</span>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                ${INVOICE_STYLE_THEMES.map(th => `
                                    <button type="button" class="iv-theme-palette-btn ${currentOptions.themeId === th.id ? 'active' : ''}" data-theme-id="${th.id}" data-theme-color="${th.primary}">
                                        <span class="iv-theme-dot" style="background:${th.primary};"></span>
                                        <div style="display:flex; flex-direction:column; overflow:hidden;">
                                            <strong style="font-size:0.72rem; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(th.name)}</strong>
                                            <span style="font-size:0.62rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(th.desc)}</span>
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- 2. CANVAS STYLE (NATIVE PAPER APPEARANCE & WORKSPACE) -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>2. Canvas Style</span>
                            <span style="font-size:0.72rem; color:var(--primary); font-weight:700;">Paper & Workspace</span>
                        </label>
                        
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem; display:flex; flex-direction:column; gap:0.6rem;">
                            <!-- Paper Background Color -->
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                                    <span style="font-size:0.74rem; font-weight:600; color:var(--text-primary);">Paper Color:</span>
                                    <div style="display:flex; align-items:center; gap:0.35rem;">
                                        <input type="color" id="iv-paper-bg-picker" value="${currentOptions.canvasStyle?.background || '#ffffff'}" style="width:24px; height:24px; padding:0; border:none; cursor:pointer; background:none;">
                                        <input type="text" id="iv-paper-bg-hex" class="form-control" style="width:75px; font-family:monospace; font-size:0.72rem; padding:0.2rem 0.4rem; text-align:center;" value="${currentOptions.canvasStyle?.background || '#ffffff'}">
                                    </div>
                                </div>
                                <div style="display:flex; gap:0.35rem; align-items:center;">
                                    ${[
                                        { color: '#ffffff', label: 'Pure White' },
                                        { color: '#f8fafc', label: 'Studio Slate' },
                                        { color: '#faf8f5', label: 'Warm Ivory' },
                                        { color: '#fffdf7', label: 'Subtle Cream' }
                                    ].map(bg => `
                                        <button type="button" class="iv-canvas-bg-swatch ${(currentOptions.canvasStyle?.background || '#ffffff') === bg.color ? 'active' : ''}" data-bg="${bg.color}" style="background:${bg.color};" title="${bg.label}"></button>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Paper Elevation / Shadow -->
                            <div>
                                <span style="font-size:0.72rem; font-weight:600; color:#64748b; display:block; margin-bottom:0.25rem;">Paper Elevation / Shadow:</span>
                                <div style="display:flex; gap:0.35rem;">
                                    <button type="button" class="btn btn-sm iv-canvas-shadow-btn ${(currentOptions.canvasStyle?.shadow || 'studio') === 'studio' ? 'btn-primary' : 'btn-secondary'}" data-shadow="studio" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Studio Floating</button>
                                    <button type="button" class="btn btn-sm iv-canvas-shadow-btn ${currentOptions.canvasStyle?.shadow === 'crisp' ? 'btn-primary' : 'btn-secondary'}" data-shadow="crisp" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Crisp Outline</button>
                                    <button type="button" class="btn btn-sm iv-canvas-shadow-btn ${currentOptions.canvasStyle?.shadow === 'none' ? 'btn-primary' : 'btn-secondary'}" data-shadow="none" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Flat Sheet</button>
                                </div>
                            </div>

                            <!-- Studio Workspace Backdrop -->
                            <div>
                                <span style="font-size:0.72rem; font-weight:600; color:#64748b; display:block; margin-bottom:0.25rem;">Workspace Backdrop:</span>
                                <div style="display:flex; gap:0.35rem;">
                                    <button type="button" class="btn btn-sm iv-workspace-bg-btn ${(currentOptions.canvasStyle?.workspaceBg || 'studio_dots') === 'studio_dots' ? 'btn-primary' : 'btn-secondary'}" data-ws="studio_dots" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Dotted Grid</button>
                                    <button type="button" class="btn btn-sm iv-workspace-bg-btn ${currentOptions.canvasStyle?.workspaceBg === 'slate' ? 'btn-primary' : 'btn-secondary'}" data-ws="slate" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Soft Slate</button>
                                    <button type="button" class="btn btn-sm iv-workspace-bg-btn ${currentOptions.canvasStyle?.workspaceBg === 'dark' ? 'btn-primary' : 'btn-secondary'}" data-ws="dark" style="flex:1; font-size:0.7rem; padding:0.25rem 0.4rem;">Dark Studio</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. CANVAS BORDER (STRICT OUTER PAGE BORDER - DEFAULT OFF) -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>3. Canvas Border</span>
                            <label style="display:flex; align-items:center; gap:0.3rem; font-size:0.72rem; font-weight:700; color:var(--primary); cursor:pointer; text-transform:none;">
                                <input type="checkbox" id="iv-toggle-border" ${currentOptions.border.enabled ? 'checked' : ''} style="accent-color:#18181B; cursor:pointer;">
                                <span>Enable Border</span>
                            </label>
                        </label>
                        
                        <div id="iv-border-controls-box" style="display:${currentOptions.border.enabled ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.75rem; font-weight:600; color:var(--text-primary);">Border Color:</span>
                                <div style="display:flex; align-items:center; gap:0.35rem;">
                                    <input type="color" id="iv-border-color-picker" value="${currentOptions.border.color}" style="width:26px; height:24px; padding:0; border:none; cursor:pointer; background:none;">
                                    <input type="text" id="iv-border-color-hex" class="form-control" style="width:75px; font-family:monospace; font-size:0.72rem; padding:0.2rem 0.4rem; text-align:center;" value="${currentOptions.border.color}">
                                </div>
                            </div>

                            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
                                ${['#18181B', '#0f172a', '#1e3a8a', '#059669', '#d97706', '#64748b', '#cbd5e1'].map(c => `
                                    <button type="button" class="iv-color-swatch" data-color="${c}" style="width:22px; height:22px; border-radius:50%; background:${c}; border:2px solid ${currentOptions.border.color === c ? '#0f172a' : '#ffffff'}; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.15);" title="${c}"></button>
                                `).join('')}
                            </div>

                            <!-- Width & Radius Sliders -->
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.6rem; margin-top:0.25rem;">
                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#64748b; margin-bottom:0.15rem;">
                                        <span>Width:</span>
                                        <span id="iv-border-width-val">${currentOptions.border.width}px</span>
                                    </div>
                                    <input type="range" id="iv-border-width-slider" min="0" max="8" value="${currentOptions.border.width}" style="width:100%; accent-color:#18181B;">
                                </div>

                                <div>
                                    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#64748b; margin-bottom:0.15rem;">
                                        <span>Radius:</span>
                                        <span id="iv-border-radius-val">${currentOptions.border.radius}px</span>
                                    </div>
                                    <input type="range" id="iv-border-radius-slider" min="0" max="24" value="${currentOptions.border.radius}" style="width:100%; accent-color:#18181B;">
                                </div>
                            </div>

                            <!-- Style (Solid, Double, Dashed) -->
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.2rem;">
                                <span style="font-size:0.72rem; font-weight:600; color:#64748b;">Border Style:</span>
                                <div style="display:flex; gap:0.25rem;">
                                    ${['solid', 'dashed', 'double'].map(st => `
                                        <button type="button" class="btn btn-sm iv-border-style-btn ${currentOptions.border.style === st ? 'btn-primary' : 'btn-secondary'}" data-style="${st}" style="padding:0.15rem 0.45rem; font-size:0.68rem; text-transform:capitalize;">${st}</button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 4. ELEMENTS & CORPORATE ADD-ONS -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>4. Elements, Uploads & Add-ons</span>
                            <span style="font-size:0.72rem; color:var(--primary); font-weight:700;">Signatures, Photos, Stamps</span>
                        </label>
                        
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            
                            <!-- Official Digital Signature (Fonts, Draw Pad & Drive Upload) -->
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                        <input type="checkbox" id="iv-toggle-signature" ${currentOptions.elements.signature.enabled ? 'checked' : ''} style="accent-color:#18181B;">
                                        <span>Official Digital Signature</span>
                                    </label>
                                    <span style="font-size:0.68rem; color:#64748b;">Signatory block</span>
                                </div>

                                <div id="iv-signature-settings" style="display:${currentOptions.elements.signature.enabled ? 'flex' : 'none'}; flex-direction:column; gap:0.5rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px dashed #cbd5e1;">
                                    <!-- All 4 Signer Details Editable: Name, Sub Name, Title, Date -->
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Signer Script / Name</label>
                                            <input type="text" id="iv-sig-name-input" class="form-control" style="font-size:0.78rem; padding:0.3rem 0.5rem;" value="${escapeHtml(currentOptions.elements.signature.signerName || 'Authorized Signatory')}" placeholder="Cursive Name">
                                        </div>
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Sub Name (Under Line)</label>
                                            <input type="text" id="iv-sig-subname-input" class="form-control" style="font-size:0.78rem; padding:0.3rem 0.5rem;" value="${escapeHtml(currentOptions.elements.signature.signerSubName || currentOptions.elements.signature.signerName || 'Authorized Signatory')}" placeholder="Printed Name">
                                        </div>
                                    </div>

                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Signer Title</label>
                                            <input type="text" id="iv-sig-title-input" class="form-control" style="font-size:0.78rem; padding:0.3rem 0.5rem;" value="${escapeHtml(currentOptions.elements.signature.signerTitle || 'Executive Officer')}" placeholder="Designation">
                                        </div>
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Signed Date</label>
                                            <input type="text" id="iv-sig-date-input" class="form-control" style="font-size:0.78rem; padding:0.3rem 0.5rem;" value="${escapeHtml(currentOptions.elements.signature.date || new Date().toLocaleDateString())}" placeholder="10/26/2026">
                                        </div>
                                    </div>

                                    <!-- 3 Mode Switcher Tabs -->
                                    <div style="display:flex; background:#e2e8f0; padding:2px; border-radius:6px; gap:2px; margin-top:0.15rem;">
                                        <button type="button" class="btn btn-sm iv-sig-mode-tab ${currentOptions.elements.signature.type === 'font' || (!currentOptions.elements.signature.dataUrl && currentOptions.elements.signature.type !== 'draw' && currentOptions.elements.signature.type !== 'upload') ? 'active' : ''}" data-mode="font" style="flex:1; font-size:0.68rem; padding:0.25rem 0.2rem; border:none; border-radius:4px; font-weight:600; cursor:pointer;">Font Style</button>
                                        <button type="button" class="btn btn-sm iv-sig-mode-tab ${currentOptions.elements.signature.type === 'draw' ? 'active' : ''}" data-mode="draw" style="flex:1; font-size:0.68rem; padding:0.25rem 0.2rem; border:none; border-radius:4px; font-weight:600; cursor:pointer;">Draw Pad</button>
                                        <button type="button" class="btn btn-sm iv-sig-mode-tab ${currentOptions.elements.signature.type === 'upload' ? 'active' : ''}" data-mode="upload" style="flex:1; font-size:0.68rem; padding:0.25rem 0.2rem; border:none; border-radius:4px; font-weight:600; cursor:pointer;">Drive File</button>
                                    </div>

                                    <!-- Panel 1: Font Style -->
                                    <div id="iv-sig-panel-font" style="display:${currentOptions.elements.signature.type === 'font' || (!currentOptions.elements.signature.dataUrl && currentOptions.elements.signature.type !== 'draw' && currentOptions.elements.signature.type !== 'upload') ? 'flex' : 'none'}; flex-direction:column; gap:0.45rem;">
                                        <div style="display:flex; gap:0.35rem; align-items:center;">
                                            <select id="iv-sig-font-select" class="form-select" style="font-size:0.74rem; padding:0.3rem 0.5rem; flex:1;">
                                                <!-- Populated dynamically -->
                                            </select>
                                            <button type="button" id="iv-btn-delete-font" class="btn btn-secondary btn-sm" style="display:none; padding:0.3rem 0.45rem; font-size:0.7rem; color:#18181B;" title="Delete custom font"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                            <button type="button" id="iv-btn-add-custom-font" class="btn btn-primary btn-sm" style="padding:0.3rem 0.55rem; font-size:0.7rem; white-space:nowrap; background:#18181B; border-color:#18181B;">Add Font</button>
                                        </div>
                                        
                                        <!-- Live Font Signature Preview Card -->
                                        <div id="iv-sig-font-preview-card" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:0.5rem 0.75rem; text-align:center; min-height:48px; display:flex; align-items:center; justify-content:center; box-shadow:inset 0 1px 3px rgba(0,0,0,0.03);">
                                            <!-- Dynamic text preview -->
                                        </div>
                                    </div>

                                    <!-- Panel 2: Draw Pad -->
                                    <div id="iv-sig-panel-draw" style="display:${currentOptions.elements.signature.type === 'draw' ? 'flex' : 'none'}; flex-direction:column; gap:0.4rem;">
                                        <div style="display:flex; justify-content:space-between; align-items:center;">
                                            <!-- Ink Color Swatches -->
                                            <div style="display:flex; gap:0.3rem; align-items:center;">
                                                <span style="font-size:0.65rem; color:#64748b; font-weight:600;">Ink:</span>
                                                <button type="button" class="iv-draw-ink-btn active" data-color="#0f172a" style="width:18px; height:18px; border-radius:50%; background:#0f172a; border:1px solid #cbd5e1; cursor:pointer;" title="Black Ink"></button>
                                                <button type="button" class="iv-draw-ink-btn" data-color="#1e3a8a" style="width:18px; height:18px; border-radius:50%; background:#1e3a8a; border:1px solid #cbd5e1; cursor:pointer;" title="Royal Navy Ink"></button>
                                                <button type="button" class="iv-draw-ink-btn" data-color="#991b1b" style="width:18px; height:18px; border-radius:50%; background:#991b1b; border:1px solid #cbd5e1; cursor:pointer;" title="Crimson Ink"></button>
                                            </div>
                                            <div style="display:flex; gap:0.3rem;">
                                                <button type="button" id="iv-btn-draw-undo" class="btn btn-secondary btn-sm" style="font-size:0.68rem; padding:0.2rem 0.45rem;" title="Undo stroke">Undo</button>
                                                <button type="button" id="iv-btn-draw-clear" class="btn btn-secondary btn-sm" style="font-size:0.68rem; padding:0.2rem 0.45rem;" title="Clear canvas">Clear</button>
                                            </div>
                                        </div>

                                        <!-- Drawing Canvas Surface -->
                                        <div style="position:relative; width:100%; border:1px solid #cbd5e1; border-radius:6px; background:#ffffff; overflow:hidden; touch-action:none; box-shadow:inset 0 1px 3px rgba(0,0,0,0.04);">
                                            <canvas id="iv-sig-draw-canvas" style="width:100%; height:110px; display:block; cursor:crosshair;"></canvas>
                                        </div>

                                        <button type="button" id="iv-btn-apply-draw" class="btn btn-primary btn-sm" style="width:100%; font-size:0.72rem; padding:0.35rem; background:#0f172a; border-color:#0f172a; font-weight:700;">
                                            Apply Hand-Drawn Signature
                                        </button>
                                    </div>

                                    <!-- Panel 3: Drive File -->
                                    <div id="iv-sig-panel-upload" style="display:${currentOptions.elements.signature.type === 'upload' ? 'flex' : 'none'}; flex-direction:column; gap:0.4rem;">
                                        <button type="button" id="iv-btn-upload-sig-file" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:0.35rem 0.5rem; display:flex; align-items:center; justify-content:center; gap:0.35rem;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            Upload Signature Image From Drive
                                        </button>
                                        <input type="file" id="iv-sig-file-input" accept="image/*" style="display:none;">

                                        <div id="iv-sig-upload-preview" style="text-align:center; padding:0.4rem; background:#ffffff; border:1px dashed #cbd5e1; border-radius:6px; display:${currentOptions.elements.signature.type === 'upload' && currentOptions.elements.signature.dataUrl ? 'block' : 'none'};">
                                            <img id="iv-sig-upload-thumb" src="${currentOptions.elements.signature.dataUrl || ''}" style="max-height:45px; max-width:160px; object-fit:contain;" alt="Uploaded Signature">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Corporate Seal Stamp / Customizable Text & Color -->
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.65rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; cursor:pointer;">
                                        <input type="checkbox" id="iv-toggle-stamp" ${currentOptions.elements.stamp.enabled ? 'checked' : ''} style="accent-color:#18181B;">
                                        <span>Corporate Stamp / Verification Seal</span>
                                    </label>
                                </div>

                                <div id="iv-stamp-settings" style="display:${currentOptions.elements.stamp.enabled ? 'flex' : 'none'}; flex-direction:column; gap:0.45rem; margin-top:0.5rem; padding-top:0.5rem; border-top:1px dashed #cbd5e1;">
                                    <div>
                                        <label style="font-size:0.68rem; font-weight:600; color:#64748b;">Custom Stamp Text:</label>
                                        <input type="text" id="iv-stamp-custom-text-input" class="form-control" style="font-size:0.78rem; padding:0.3rem 0.5rem;" value="${escapeHtml(currentOptions.elements.stamp.customText)}" placeholder="e.g. APPROVED & VERIFIED">
                                    </div>

                                    <div style="display:flex; align-items:center; justify-content:space-between;">
                                        <span style="font-size:0.68rem; font-weight:600; color:#64748b;">Stamp Color:</span>
                                        <div style="display:flex; gap:0.3rem;">
                                            ${['#059669', '#18181B', '#0f172a', '#d97706'].map(col => `
                                                <button type="button" class="iv-stamp-color-btn" data-color="${col}" style="width:18px; height:18px; border-radius:50%; background:${col}; border:1.5px solid ${currentOptions.elements.stamp.color === col ? '#000000' : '#ffffff'}; cursor:pointer;"></button>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Stamp Quick Presets -->
                                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.25rem; margin-top:0.15rem;">
                                        <button type="button" class="btn btn-sm iv-stamp-preset-btn" data-text="APPROVED & VERIFIED" data-col="#059669" style="font-size:0.65rem; padding:0.25rem;">Approved</button>
                                        <button type="button" class="btn btn-sm iv-stamp-preset-btn" data-text="PAID IN FULL" data-col="#18181B" style="font-size:0.65rem; padding:0.25rem;">Paid in Full</button>
                                        <button type="button" class="btn btn-sm iv-stamp-preset-btn" data-text="OFFICIAL CORPORATE SEAL" data-col="#0f172a" style="font-size:0.65rem; padding:0.25rem;">Official Seal</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Add Floating Photo Element & Custom Text Controls -->
                            <div style="display:flex; gap:0.4rem;">
                                <button type="button" id="iv-btn-add-floating-photo" class="btn btn-secondary btn-sm" style="flex:1; font-size:0.72rem; padding:0.4rem; display:flex; align-items:center; justify-content:center; gap:0.3rem;" title="Upload photo element placed directly on canvas">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    Add Photo Element
                                </button>
                                <input type="file" id="iv-photo-element-input" accept="image/*" style="display:none;">

                                <button type="button" id="iv-btn-add-custom-text" class="btn btn-secondary btn-sm" style="flex:1; font-size:0.72rem; padding:0.4rem; display:flex; align-items:center; justify-content:center; gap:0.3rem;" title="Add placeable custom text or banner">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Add Custom Text
                                </button>
                            </div>

                            <!-- Selected Floating Element Vector Positioning & Styling Box -->
                            <div id="iv-floating-pos-box" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:0.65rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                                    <span style="font-size:0.72rem; font-weight:800; color:#0f172a;" id="iv-selected-el-label">Selected Element</span>
                                    <button type="button" id="iv-btn-del-selected-el" class="btn btn-sm btn-ghost" style="color:#18181B; padding:0.15rem 0.35rem; font-size:0.7rem;">Delete</button>
                                </div>

                                <!-- Position Coordinates (X, Y) -->
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.7rem; margin-bottom:0.4rem;">
                                    <div>
                                        <label style="color:#64748b; font-weight:600;">X (px)</label>
                                        <input type="number" id="iv-el-pos-x" class="form-control" style="font-size:0.78rem; padding:0.25rem 0.4rem;">
                                    </div>
                                    <div>
                                        <label style="color:#64748b; font-weight:600;">Y (px)</label>
                                        <input type="number" id="iv-el-pos-y" class="form-control" style="font-size:0.78rem; padding:0.25rem 0.4rem;">
                                    </div>
                                </div>

                                <!-- Text-specific Controls (Shown when type === 'text') -->
                                <div id="iv-floating-text-controls" style="display:none; flex-direction:column; gap:0.35rem; margin-bottom:0.4rem;">
                                    <div>
                                        <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Text Content</label>
                                        <input type="text" id="iv-el-text-val" class="form-control" style="font-size:0.78rem; padding:0.25rem 0.4rem;">
                                    </div>
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Font Size (px)</label>
                                            <input type="number" id="iv-el-font-size" min="8" max="48" class="form-control" style="font-size:0.78rem; padding:0.25rem 0.4rem;">
                                        </div>
                                        <div>
                                            <label style="font-size:0.68rem; color:#64748b; font-weight:600;">Color</label>
                                            <div style="display:flex; align-items:center; gap:0.25rem;">
                                                <input type="color" id="iv-el-text-color" style="width:24px; height:24px; border:none; padding:0; cursor:pointer; background:none;">
                                                <input type="text" id="iv-el-text-color-hex" class="form-control" style="font-size:0.72rem; padding:0.2rem 0.3rem; font-family:monospace; width:70px;">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Photo-specific Controls (Shown when type === 'photo') -->
                                <div id="iv-floating-photo-controls" style="display:none; flex-direction:column; gap:0.35rem; margin-bottom:0.4rem;">
                                    <div>
                                        <div style="display:flex; justify-content:space-between; font-size:0.68rem; color:#64748b;">
                                            <span style="font-weight:600;">Photo Width (px):</span>
                                            <span id="iv-el-photo-width-val">140px</span>
                                        </div>
                                        <input type="range" id="iv-el-photo-width-slider" min="40" max="400" value="140" style="width:100%; accent-color:#18181B;">
                                    </div>
                                </div>

                                <span style="font-size:0.65rem; color:#94a3b8; display:block;">Drag on canvas or use Arrow keys (↑ ↓ ← →) to nudge.</span>
                            </div>

                        </div>
                    </div>

                    <!-- 5. BUSINESS & RECIPIENT BRANDING -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>5. Business Profile & Coordinates</span>
                            <span style="font-size:0.68rem; color:#64748b;">From & To details</span>
                        </label>

                        <!-- From / Supplier Details Toggle (Default: ON) -->
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.45rem 0.65rem; margin-bottom:0.65rem; display:flex; align-items:center; justify-content:space-between;">
                            <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; font-weight:700; color:#1e293b; cursor:pointer; margin:0;">
                                <input type="checkbox" id="iv-toggle-show-from" ${currentOptions.showBilledFrom !== false ? 'checked' : ''} style="accent-color:#18181B; width:15px; height:15px; cursor:pointer;">
                                <span>Include "BILLED FROM" (Supplier)</span>
                            </label>
                            <span id="iv-show-from-status" style="font-size:0.68rem; color:${currentOptions.showBilledFrom !== false ? '#059669' : '#64748b'}; font-weight:700;">${currentOptions.showBilledFrom !== false ? 'Shown' : 'Hidden'}</span>
                        </div>

                        <div class="iv-branding-radio-group">
                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="WORKSPACE" ${currentOptions.brandingMode === 'WORKSPACE' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.82rem; display:block;">Active Workspace Business</strong>
                                    <span style="font-size:0.72rem; color:var(--text-secondary);">Use current business name, address, phone & currency.</span>
                                </div>
                            </label>

                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="CUSTOM" ${currentOptions.brandingMode === 'CUSTOM' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.82rem; display:block;">Custom Business Profile</strong>
                                    <span style="font-size:0.72rem; color:var(--text-secondary);">Customize company name, tagline, email, and address.</span>
                                </div>
                            </label>

                            <label class="iv-branding-option">
                                <input type="radio" name="iv-branding-mode" value="NONE" ${currentOptions.brandingMode === 'NONE' ? 'checked' : ''}>
                                <div>
                                    <strong style="color:var(--text-primary); font-size:0.82rem; display:block;">Clean Minimalist Document</strong>
                                    <span style="font-size:0.72rem; color:var(--text-secondary);">Clean header without extra application branding.</span>
                                </div>
                            </label>
                        </div>

                        <!-- Custom Branding Inputs -->
                        <div id="iv-custom-branding-inputs" style="display:${currentOptions.brandingMode === 'CUSTOM' ? 'flex' : 'none'}; flex-direction:column; gap:0.45rem; margin-top:0.5rem; padding:0.65rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                            <div>
                                <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Company Title</label>
                                <input type="text" id="iv-custom-title" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.55rem;" value="${escapeHtml(currentOptions.customBranding.title)}" placeholder="e.g. Apex International Corp">
                            </div>
                            <div>
                                <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Subtitle / Tagline</label>
                                <input type="text" id="iv-custom-subtitle" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.55rem;" value="${escapeHtml(currentOptions.customBranding.subtitle)}" placeholder="Commercial Sales Invoice">
                            </div>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem;">
                                <div>
                                    <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Phone</label>
                                    <input type="text" id="iv-custom-phone" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.55rem;" value="${escapeHtml(currentOptions.customBranding.phone)}" placeholder="01700000000">
                                </div>
                                <div>
                                    <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Email</label>
                                    <input type="email" id="iv-custom-email" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.55rem;" value="${escapeHtml(currentOptions.customBranding.email)}" placeholder="billing@company.com">
                                </div>
                            </div>
                            <div>
                                <label style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Address / Location</label>
                                <input type="text" id="iv-custom-address" class="form-control" style="font-size:0.8rem; padding:0.35rem 0.55rem;" value="${escapeHtml(currentOptions.customBranding.address)}" placeholder="New York, NY">
                            </div>
                        </div>
                    </div>

                    <!-- 6. INVOICE NOTES & TERMS & CONDITIONS -->
                    <div class="iv-control-section">
                        <label class="iv-section-title">
                            <span>6. Notes & Terms & Conditions</span>
                            <span style="font-size:0.68rem; color:#94a3b8;">Hidden if empty</span>
                        </label>
                        <div style="display:flex; flex-direction:column; gap:0.45rem;">
                            <div>
                                <label style="font-size:0.68rem; font-weight:700; color:#64748b; display:block; margin-bottom:0.2rem;">Invoice Notes:</label>
                                <textarea id="iv-custom-notes" rows="2" class="form-control" style="font-size:0.78rem; font-family:inherit; resize:vertical;" placeholder="Leave empty to hide notes section entirely from invoice canvas.">${escapeHtml(currentInvoice.notes || currentOptions.customBranding.notes || '')}</textarea>
                            </div>
                            <div>
                                <label style="font-size:0.68rem; font-weight:700; color:#64748b; display:block; margin-bottom:0.2rem;">Terms & Conditions:</label>
                                <textarea id="iv-custom-terms" rows="3" class="form-control" style="font-size:0.78rem; font-family:inherit; resize:vertical;" placeholder="Enter legal terms, payment policy, warranty terms...">${escapeHtml(currentOptions.customBranding.termsAndConditions || '')}</textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 7. INVOICE ORIGIN -->
                    <div class="iv-control-section origin-divider-card" style="margin-top:0.45rem; padding:0.75rem; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-color);">
                        <label class="iv-section-title" style="margin-bottom:0.45rem; display:flex; align-items:center; justify-content:space-between;">
                            <span style="display:flex; align-items:center; gap:0.4rem; color:var(--text-primary); font-weight:700;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                7. Invoice Origin
                            </span>
                            <span class="badge" style="font-size:0.65rem; background:rgba(225,29,72,0.1); color:var(--theme-primary, #18181B); font-weight:700;">Origin Trace</span>
                        </label>
                        <div class="origin-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; font-size:0.75rem;">
                            <div class="origin-field-box" style="background:var(--surface-100); padding:0.4rem 0.55rem; border-radius:6px; border:1px solid var(--border-color);">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Invoice ID</div>
                                <div style="font-weight:700; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(currentInvoice.invoiceNumber || currentInvoice.busInvNumber || currentInvoice.uniqueId || currentInvoice.id || 'N/A'))}</div>
                            </div>
                            <div class="origin-field-box" style="background:var(--surface-100); padding:0.4rem 0.55rem; border-radius:6px; border:1px solid var(--border-color);">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Creator ID</div>
                                <div style="font-weight:600; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(currentInvoice.creatorId || currentInvoice.createdBy || currentInvoice.userId || 'System / Admin'))}</div>
                            </div>
                            <div class="origin-field-box" style="grid-column: span 2; background:var(--surface-100); padding:0.4rem 0.55rem; border-radius:6px; border:1px solid var(--border-color);">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Workspace ID</div>
                                <div style="font-weight:600; color:var(--text-primary); word-break:break-all;">${escapeHtml(String(currentInvoice.workspaceId || localStorage.getItem('pricelister_active_workspace') || 'Default Workspace'))}</div>
                            </div>
                            <div class="origin-field-box" style="grid-column: span 2; background:var(--surface-100); padding:0.4rem 0.55rem; border-radius:6px; border:1px solid var(--border-color);">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Created At</div>
                                <div style="font-weight:600; color:var(--text-primary);">${formatExactTimestamp(currentInvoice.createdAt || currentInvoice.timestamp || currentInvoice.date)}</div>
                            </div>
                            ${(currentInvoice.updatedAt || currentInvoice.updatedTimestamp) ? `
                            <div class="origin-field-box" style="grid-column: span 2; background:var(--surface-100); padding:0.4rem 0.55rem; border-radius:6px; border:1px solid var(--border-color);">
                                <div style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Updated At</div>
                                <div style="font-weight:600; color:var(--text-primary);">${formatExactTimestamp(currentInvoice.updatedAt || currentInvoice.updatedTimestamp)}</div>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- Bottom Action Buttons Bar -->
                    <div style="margin-top:auto; padding-top:1rem; display:flex; flex-direction:column; gap:0.5rem;">
                        <button type="button" id="iv-btn-download-bottom" class="btn btn-primary" style="width:100%; padding:0.65rem; font-weight:700; font-size:0.9rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; background: var(--theme-gradient, linear-gradient(135deg, #ff3366 0%, #18181B 55%, #27272A 100%)); box-shadow:0 4px 14px var(--theme-glow, rgba(225,29,72,0.35)); color:#ffffff;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export & Download PDF
                        </button>

                        ${onEditCallback ? `
                            <button type="button" id="iv-btn-edit-invoice" class="btn btn-secondary" style="width:100%; padding:0.5rem; font-weight:600; font-size:0.82rem; display:flex; align-items:center; justify-content:center; gap:0.4rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                Open in Full Invoice Form
                            </button>
                        ` : ''}
                    </div>

                </div>

                <!-- DRAGGABLE RESIZABLE SPLITTER (Between Canvas & Tool Sidebar) -->
                <div class="iv-splitter-handle" id="iv-splitter-handle" title="Drag with mouse to scale sidebar width">
                    <div class="iv-splitter-grip"></div>
                </div>

                <!-- PREVIEW COLUMN: VISUAL CANVAS WORKSPACE, PANNING, MULTI-PAGE NAVIGATOR -->
                <div class="iv-preview-column" id="iv-preview-column">
                    <div class="iv-preview-toolbar">
                        <div class="iv-view-tabs">
                            <button type="button" class="iv-view-tab active" id="iv-tab-visual">
                                <span style="display:flex; align-items:center; gap:0.35rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    Visual Canvas
                                </span>
                            </button>
                            <button type="button" class="iv-view-tab" id="iv-tab-perf">
                                <span style="display:flex; align-items:center; gap:0.35rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                                    Financial Intel & Margins
                                </span>
                            </button>
                            <button type="button" class="iv-view-tab" id="iv-tab-maker">
                                <span style="display:flex; align-items:center; gap:0.35rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                    Invoice Maker Editor
                                </span>
                            </button>
                            <button type="button" class="iv-view-tab" id="iv-tab-pdf">
                                <span style="display:flex; align-items:center; gap:0.35rem;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                                    Live Vector PDF
                                </span>
                            </button>
                        </div>

                        <!-- Top Page Navigator & Pan Hint -->
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <!-- Page Count Navigator (Visible when multi-page) -->
                            <div class="iv-page-nav-dock" id="iv-page-nav-dock" style="display:none;" title="Page Navigator">
                                <span style="font-size:0.68rem; font-weight:700; color:#64748b;">Pages:</span>
                                <div id="iv-page-buttons-container" style="display:flex; gap:0.25rem;"></div>
                            </div>

                            <!-- Canvas Mode Switcher: Live Vector PDF Engine vs Visual Canvas Studio -->
                            <div class="iv-engine-mode-dock" style="display:flex; align-items:center; background:#f1f5f9; padding:2px; border-radius:6px; border:1px solid #e2e8f0; font-size:0.72rem; font-weight:700;">
                                <button type="button" id="iv-btn-mode-vector" class="iv-engine-mode-btn" style="padding:3px 8px; border-radius:4px; border:none; cursor:pointer; font-size:0.72rem; font-weight:700; transition:all 0.15s ease; ${currentOptions.canvasEngineMode !== 'dom' ? 'background:#ffffff; color:#0f172a; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}" title="Canvas is directly driven 1:1 by Export Engine vector PDF">
                                    Live Vector PDF
                                </button>
                                <button type="button" id="iv-btn-mode-canvas" class="iv-engine-mode-btn" style="padding:3px 8px; border-radius:4px; border:none; cursor:pointer; font-size:0.72rem; font-weight:700; transition:all 0.15s ease; ${currentOptions.canvasEngineMode === 'dom' ? 'background:#ffffff; color:#0f172a; box-shadow:0 1px 3px rgba(0,0,0,0.1);' : 'background:transparent; color:#64748b;'}" title="Interactive Visual Canvas Studio HTML DOM preview">
                                    Visual Studio
                                </button>
                            </div>

                            <span style="font-size:0.72rem; color:#94a3b8; font-weight:500;" title="Pan Canvas: Hold Right Mouse Button & Drag. Zoom: Alt + Scroll Wheel">
                                Hold Right-Click to Pan
                            </span>

                            <label style="display:flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; cursor:pointer; color:var(--text-primary); user-select:none;">
                                <input type="checkbox" id="iv-toggle-data-changes" ${currentOptions.enableDataChanges ? 'checked' : ''} style="accent-color:#18181B; cursor:pointer;">
                                <span>Enable Data Changes</span>
                            </label>
                        </div>
                    </div>

                    <!-- Visual Invoice Paper Sheet Container with Zoom Wrapper & Hand Panning -->
                    <div class="iv-paper-scroll-wrapper" id="iv-paper-scroll-container">
                        
                        <div class="iv-paper-zoom-wrapper" id="iv-paper-zoom-wrapper">
                            <!-- Container where single or multi-page sheets are rendered -->
                            <div id="iv-pages-wrapper" style="display:flex; flex-direction:column; gap:2rem; align-items:center;">
                                <div class="iv-paper-sheet layout-business-a4" id="iv-paper-sheet">
                                    <!-- Rendered dynamically -->
                                </div>
                            </div>
                        </div>

                        <!-- Financial Intelligence Sheet -->
                        <div class="iv-perf-sheet" id="iv-perf-sheet" style="display:none; width:100%; max-width:880px; padding:1.75rem; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                            <!-- Rendered dynamically -->
                        </div>

                        <!-- Live Invoice Maker Editor -->
                        <div class="iv-maker-editor-sheet" id="iv-maker-editor-sheet" style="display:none; width:100%; max-width:880px; padding:1.75rem; background:#ffffff; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 4px 20px rgba(0,0,0,0.03);">
                            <!-- Rendered dynamically -->
                        </div>

                        <!-- Embedded PDF Preview Iframe -->
                        <iframe id="iv-pdf-iframe" class="iv-pdf-frame" style="display:none; width:100%; height:100%; min-height:750px;" title="PDF Preview Frame"></iframe>
                    </div>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Attach Event Handlers, Panning, Zoom, and History Back Interception
    setupViewerEvents(onEditCallback);

    // Initial Render
    applyBorderStyles();
    updateVisualPreview();
    updatePerformanceView();
    updateMakerEditorView();
};

/**
 * Close Modal & Clean up Browser Back Popstate & Session State
 */
const closeViewerModal = (triggerHistoryBack = true) => {
    if (popstateHandler) {
        window.removeEventListener('popstate', popstateHandler);
        popstateHandler = null;
    }
    if (currentPdfBlobUrl) {
        URL.revokeObjectURL(currentPdfBlobUrl);
        currentPdfBlobUrl = null;
    }
    currentLivePdfBlob = null;
    const overlay = document.getElementById('invoice-viewer-modal-overlay');
    if (overlay) overlay.remove();

    clearViewerSession();

    // If close was triggered by user click (instead of browser back button), pop the history entry
    if (triggerHistoryBack && window.history.state?.isInvoiceViewerOpen) {
        window.history.back();
    }
};

/**
 * Apply Canvas Style (Paper Background, Shadow, Workspace) & Outer Border Styling
 */
const applyBorderStyles = () => {
    const sheets = document.querySelectorAll('.iv-paper-sheet');
    const b = currentOptions.border || {};
    const cStyle = currentOptions.canvasStyle || {};

    sheets.forEach(paper => {
        // Native canvas paper background
        paper.style.backgroundColor = cStyle.background || '#ffffff';

        // Native canvas elevation/shadow
        if (cStyle.shadow === 'none') {
            paper.style.boxShadow = 'none';
        } else if (cStyle.shadow === 'crisp') {
            paper.style.boxShadow = '0 0 0 1px #e2e8f0, 0 4px 12px rgba(15, 23, 42, 0.08)';
        } else {
            paper.style.boxShadow = '0 14px 40px -6px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.05)';
        }

        // Strict Border controls (Only outer border, default off)
        if (!b.enabled) {
            paper.style.border = 'none';
            paper.style.borderRadius = '0px';
        } else {
            paper.style.border = `${b.width || 1}px ${b.style || 'solid'} ${b.color || '#18181B'}`;
            paper.style.borderRadius = `${b.radius || 0}px`;
        }

        const spec = getInvoiceLayoutSpec(currentOptions.sizePreset, currentOptions);
        paper.style.width = `${spec.canvasWidthPx}px`;
        paper.style.maxWidth = `${spec.canvasWidthPx}px`;
        paper.style.minHeight = `${spec.canvasMinHeightPx}px`;
        if (paper.classList.contains('iv-paper-vector-active')) {
            paper.style.height = `${spec.canvasMinHeightPx}px`;
        }
    });

    // Update workspace background
    const scrollContainer = document.getElementById('iv-paper-scroll-container');
    if (scrollContainer && cStyle.workspaceBg) {
        if (cStyle.workspaceBg === 'slate') {
            scrollContainer.style.background = '#f1f5f9';
            scrollContainer.style.backgroundImage = 'none';
        } else if (cStyle.workspaceBg === 'dark') {
            scrollContainer.style.background = '#09090b';
            scrollContainer.style.backgroundImage = 'none';
        } else {
            scrollContainer.style.background = '#f8fafc';
            scrollContainer.style.backgroundImage = 'radial-gradient(#cbd5e1 1.2px, transparent 1.2px)';
            scrollContainer.style.backgroundSize = '18px 18px';
        }
    }
};

/**
 * Render Visual Invoice Canvas (with Multi-Page Pagination for Business Layouts)
 */
const updateVisualPreview = () => {
    const pagesWrapper = document.getElementById('iv-pages-wrapper');
    if (!pagesWrapper || !currentInvoice) return;

    const inv = currentInvoice;
    const preset = currentOptions.sizePreset;
    const items = Array.isArray(inv.items) ? inv.items : [];

    // Resolve Brand Information (BILLED FROM)
    let bTitle = 'PriceLister Business';
    let bSubtitle = currentOptions.customBranding.subtitle || 'Commercial Sales Invoice';
    let bPhone = '';
    let bEmail = '';
    let bAddress = '';
    let bTaxId = currentOptions.customBranding.taxId || 'TAX-9948201';

    if (currentOptions.brandingMode === 'WORKSPACE') {
        bTitle = inv.businessName || window.__activeWorkspace?.name || 'Your Business';
        bPhone = inv.businessPhone || window.__activeWorkspace?.phone || '';
        bEmail = inv.businessEmail || window.__activeWorkspace?.email || '';
        bAddress = inv.businessAddress || window.__activeWorkspace?.address || '';
    } else if (currentOptions.brandingMode === 'CUSTOM') {
        bTitle = currentOptions.customBranding.title || 'Your Business';
        bSubtitle = currentOptions.customBranding.subtitle || 'Commercial Sales Invoice';
        bPhone = currentOptions.customBranding.phone || '';
        bEmail = currentOptions.customBranding.email || '';
        bAddress = currentOptions.customBranding.address || '';
    } else if (currentOptions.brandingMode === 'NONE') {
        bTitle = inv.businessName || 'Commercial Entity';
        bSubtitle = '';
    }

    // Resolve Recipient Information (BILLED TO)
    const isBusiness = Boolean(inv.isBusiness || inv.busInvNumber || inv.clientName);
    const clientName = isBusiness 
        ? (inv.clientName || inv.customerName || 'B2B Client Entity')
        : (inv.customerName || 'Customer Client');
    const clientPhone = inv.clientPhone || inv.customerNumber || '';
    const clientEmail = inv.clientEmail || '';
    const clientAddress = inv.clientAddress || inv.customerAddress || '';

    const invNumber = inv.busInvNumber || inv.invoiceNumber || inv.id || 'INV-001';
    const invStatus = (inv.status || 'PAID').toUpperCase();
    const isPaid = invStatus === 'PAID';
    const statusBadgeClass = isPaid ? 'iv-badge-paid' : 'iv-badge-unpaid';
    const accentColor = currentOptions.themeColor || (currentOptions.border.enabled ? (currentOptions.border.color || '#18181B') : '#18181B');

    // Financial calculations
    const subtotal = Number(inv.subtotal || 0);
    const discountPct = Number(inv.discountPercent || 0);
    const addCut = Number(inv.additionalCut || 0);
    const taxPct = Number(inv.taxPercent || 0);
    const shipping = Number(inv.shippingCost || 0);

    const discountAmount = discountPct > 0 ? (subtotal * discountPct) / 100 : 0;
    const baseForTax = Math.max(0, subtotal - discountAmount - addCut);
    const taxAmount = taxPct > 0 ? (baseForTax * taxPct) / 100 : 0;
    const grandTotal = Number(inv.totalPrice || inv.grandTotal || (baseForTax + taxAmount + shipping));

    // Optional Notes: ONLY show if not empty
    const rawNotes = (inv.notes || currentOptions.customBranding.notes || '').trim();
    const hasNotes = rawNotes.length > 0;

    // Optional Terms & Conditions: ONLY show if not empty
    const rawTerms = (currentOptions.customBranding.termsAndConditions || '').trim();
    const hasTerms = rawTerms.length > 0;

    // Reusable Visual Totals Box Renderer (100% parity with Vector PDF Export Engine)
    const renderVisualTotalsBox = (totalsTitle = 'Grand Total:', titleColor = accentColor) => `
        <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
            <span>Subtotal:</span>
            <span>${formatCurrency(subtotal, currentOptions.currencySymbol)}</span>
        </div>
        ${discountPct > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#059669; margin-bottom:0.35rem;">
                <span>Discount (${discountPct}%):</span>
                <span>-${formatCurrency(discountAmount, currentOptions.currencySymbol)}</span>
            </div>
        ` : ''}
        ${addCut > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#059669; margin-bottom:0.35rem;">
                <span>Special Cut:</span>
                <span>-${formatCurrency(addCut, currentOptions.currencySymbol)}</span>
            </div>
        ` : ''}
        ${taxPct > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
                <span>Tax / VAT (${taxPct}%):</span>
                <span>+${formatCurrency(taxAmount, currentOptions.currencySymbol)}</span>
            </div>
        ` : ''}
        ${shipping > 0 ? `
            <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:#64748b; margin-bottom:0.35rem;">
                <span>Shipping / Logistics:</span>
                <span>+${formatCurrency(shipping, currentOptions.currencySymbol)}</span>
            </div>
        ` : ''}
        <div style="display:flex; justify-content:space-between; font-size:1.15rem; font-weight:900; color:${titleColor}; border-top:2px solid ${titleColor}; padding-top:0.5rem; margin-top:0.4rem;">
            <span>${totalsTitle}</span>
            <span>${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
        </div>
    `;

    // Multi-page pagination: All standard paper layouts (Business A4, Corporate Enterprise, US Letter, Customer A4, Custom) paginate
    // Only POS_RECEIPT is a continuous single roll tape
    const isPaginatedPreset = preset !== 'POS_RECEIPT';
    const isBusinessLayout = isPaginatedPreset;
    const itemsPerPage = currentOptions.itemsPerPage || 6;
    const totalPages = isPaginatedPreset ? Math.max(1, Math.ceil(items.length / itemsPerPage)) : 1;

    // Update Top Page Navigator Dock
    const navDock = document.getElementById('iv-page-nav-dock');
    const navButtons = document.getElementById('iv-page-buttons-container');
    if (navDock && navButtons) {
        if (totalPages > 1) {
            navDock.style.display = 'flex';
            navButtons.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1).map(p => `
                <button type="button" class="iv-page-btn ${currentOptions.activePage === p ? 'active' : ''}" data-target-page="${p}">${p}</button>
            `).join('');

            navButtons.querySelectorAll('.iv-page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const pageNum = parseInt(btn.getAttribute('data-target-page'), 10);
                    currentOptions.activePage = pageNum;
                    const targetEl = document.getElementById(`iv-sheet-page-${pageNum}`);
                    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    updateVisualPreview();
                });
            });
        } else {
            navDock.style.display = 'none';
        }
    }

    // Check if Live Vector PDF Canvas Mode is active (default)
    const isVectorEngineMode = currentOptions.canvasEngineMode !== 'dom';

    if (isVectorEngineMode) {
        // Layout class
        let layoutClass = 'layout-business-a4';
        if (preset === 'POS_RECEIPT') layoutClass = 'layout-pos';
        else if (preset === 'CUSTOMER_A4') layoutClass = 'layout-customer-a4';
        else if (preset === 'CORPORATE_ENTERPRISE') layoutClass = 'layout-corporate-enterprise';
        else if (preset === 'US_LETTER') layoutClass = 'layout-us-letter';
        else if (preset === 'CUSTOM') layoutClass = 'layout-custom';

        const spec = getInvoiceLayoutSpec(preset, currentOptions);

        // Render Floating Placeable Elements over the live vector PDF
        const floatingElementsHtml = (currentOptions.elements.floatingElements || []).map(el => {
            const isSelected = selectedFloatingElId === el.id;
            if (el.type === 'photo') {
                return `
                    <div class="iv-floating-element ${isSelected ? 'is-selected' : ''}" data-el-id="${el.id}" style="left:${el.x}px; top:${el.y}px;" title="Drag or use arrow keys to reposition">
                        <img src="${el.src}" style="width:${el.width || 120}px; height:auto; display:block; border-radius:4px; pointer-events:none;" alt="Element Photo">
                    </div>
                `;
            } else {
                return `
                    <div class="iv-floating-element ${isSelected ? 'is-selected' : ''}" data-el-id="${el.id}" style="left:${el.x}px; top:${el.y}px; font-size:${el.fontSize || 13}px; color:${el.color || '#0f172a'}; font-weight:700; background:rgba(255,255,255,0.85); padding:2px 6px; border-radius:4px; border:1px dashed #cbd5e1;" title="Drag or use arrow keys to reposition">
                        ${escapeHtml(el.text)}
                    </div>
                `;
            }
        }).join('');

        let sheet = document.getElementById('iv-sheet-page-1');
        let sheetIframe = document.getElementById('iv-sheet-vector-iframe');
        let overlay = document.getElementById('iv-floating-overlay');

        if (sheet && sheetIframe && overlay && sheet.classList.contains('iv-paper-vector-active')) {
            sheet.className = `iv-paper-sheet iv-paper-vector-active ${layoutClass} ${currentOptions.enableDataChanges ? 'iv-data-change-active' : ''}`;
            sheet.style.width = `${spec.canvasWidthPx}px`;
            sheet.style.minHeight = `${spec.canvasMinHeightPx}px`;
            sheet.style.height = `${spec.canvasMinHeightPx}px`;
            sheet.style.maxWidth = `${spec.canvasWidthPx}px`;
            overlay.innerHTML = floatingElementsHtml;
        } else {
            const iframeSrc = currentPdfBlobUrl ? `${currentPdfBlobUrl}#toolbar=0&navpanes=0` : '';
            pagesWrapper.innerHTML = `
                <div class="iv-paper-sheet iv-paper-vector-active ${layoutClass} ${currentOptions.enableDataChanges ? 'iv-data-change-active' : ''}" id="iv-sheet-page-1" style="position:relative; width:${spec.canvasWidthPx}px; min-height:${spec.canvasMinHeightPx}px; height:${spec.canvasMinHeightPx}px; max-width:${spec.canvasWidthPx}px;">
                    <iframe id="iv-sheet-vector-iframe" class="iv-sheet-vector-frame" src="${iframeSrc}" title="Live Vector PDF Canvas Preview"></iframe>
                    <div class="iv-floating-overlay" id="iv-floating-overlay">
                        ${floatingElementsHtml}
                    </div>
                </div>
            `;
        }

        applyBorderStyles();
        wireFloatingElementsDragging();
        triggerLivePdfSync(50);
        return;
    }

    // Build pages HTML (Visual Canvas Studio DOM Mode)
    let pagesHtml = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const startIdx = (pageNum - 1) * itemsPerPage;
        const pageItems = isBusinessLayout ? items.slice(startIdx, startIdx + itemsPerPage) : items;
        const isFirstPage = pageNum === 1;
        const isLastPage = pageNum === totalPages;

        let pageContent = '';

        // =========================================================================
        // 1. POS BILL RECEIPT LONG
        // =========================================================================
        if (preset === 'POS_RECEIPT') {
            pageContent = `
                <div style="text-align:center; border-bottom:1px dashed #0f172a; padding-bottom:0.75rem; margin-bottom:0.75rem;">
                    <div style="font-size:1.15rem; font-weight:900; letter-spacing:0.04em; text-transform:uppercase;">${escapeHtml(bTitle)}</div>
                    ${bSubtitle ? `<div style="font-size:0.72rem; color:#64748b;">${escapeHtml(bSubtitle)}</div>` : ''}
                    <div style="font-size:0.72rem; color:#64748b; margin-top:0.2rem;">${[bAddress, bPhone].filter(Boolean).map(escapeHtml).join(' | ')}</div>
                    <div style="font-size:0.75rem; font-weight:700; margin-top:0.35rem;">RECEIPT: #${escapeHtml(invNumber)}</div>
                    <div style="font-size:0.7rem; color:#64748b;">${formatInvoiceDateClean(inv)} • Register 01</div>
                </div>

                <div style="margin-bottom:0.6rem; font-size:0.72rem; display:flex; justify-content:space-between;">
                    <span><strong>Customer:</strong> ${escapeHtml(clientName)}</span>
                    <span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span>
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:0.75rem; margin-bottom:0.75rem;">
                    <thead>
                        <tr style="border-bottom:1px dashed #0f172a; text-align:left;">
                            <th style="padding:0.25rem 0;">ITEM</th>
                            <th style="padding:0.25rem 0; text-align:center;">QTY</th>
                            <th style="padding:0.25rem 0; text-align:right;">PRICE</th>
                            <th style="padding:0.25rem 0; text-align:right;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map(item => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="border-bottom:1px dotted #e2e8f0;">
                                    <td style="padding:0.3rem 0;">
                                        <div><strong>${escapeHtml(item.name || item.productName || 'Item')}</strong></div>
                                        ${item.size || item.sizeWeight ? `<span style="font-size:0.65rem; color:#64748b;">(${escapeHtml(item.size || item.sizeWeight)})</span>` : ''}
                                    </td>
                                    <td style="padding:0.3rem 0; text-align:center;">${qty}</td>
                                    <td style="padding:0.3rem 0; text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="padding:0.3rem 0; text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div style="border-top:1px dashed #0f172a; padding-top:0.4rem; font-size:0.75rem; display:flex; flex-direction:column; gap:0.2rem;">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(subtotal, currentOptions.currencySymbol)}</span>
                    </div>
                    ${discountPct > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#059669;">
                            <span>Discount (${discountPct}%):</span>
                            <span>-${formatCurrency(discountAmount, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    ${addCut > 0 ? `
                        <div style="display:flex; justify-content:space-between; color:#059669;">
                            <span>Special Cut:</span>
                            <span>-${formatCurrency(addCut, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    ${taxPct > 0 ? `
                        <div style="display:flex; justify-content:space-between;">
                            <span>Tax (${taxPct}%):</span>
                            <span>+${formatCurrency(taxAmount, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    ${shipping > 0 ? `
                        <div style="display:flex; justify-content:space-between;">
                            <span>Shipping:</span>
                            <span>+${formatCurrency(shipping, currentOptions.currencySymbol)}</span>
                        </div>
                    ` : ''}
                    <div style="display:flex; justify-content:space-between; font-size:0.95rem; font-weight:900; border-top:1px solid #0f172a; padding-top:0.35rem; margin-top:0.2rem;">
                        <span>TOTAL DUE:</span>
                        <span>${formatCurrency(grandTotal, currentOptions.currencySymbol)}</span>
                    </div>
                </div>

                <div style="text-align:center; margin-top:1.25rem; border-top:1px dashed #0f172a; padding-top:0.75rem;">
                    <div style="font-family:monospace; font-size:1.4rem; letter-spacing:0.18em; font-weight:700; user-select:none;">||| | ||||| || |||||| |</div>
                    <div style="font-size:0.65rem; color:#64748b; margin-top:0.15rem;">*${escapeHtml(invNumber)}*</div>
                    <div style="font-size:0.7rem; font-weight:700; margin-top:0.45rem;">THANK YOU FOR YOUR PATRONAGE!</div>
                </div>
            `;
        }

        // =========================================================================
        // 2. CUSTOMER A4 STANDARD
        // =========================================================================
        else if (preset === 'CUSTOMER_A4') {
            pageContent = `
                ${isFirstPage ? `
                    <!-- Top 4mm Accent Color Bar (Matches Vector PDF Export) -->
                    <div style="height:4px; background:${accentColor}; border-radius:2px; margin-bottom:1.25rem;"></div>

                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size:1.6rem; font-weight:900; color:#0f172a; margin:0 0 0.2rem 0;">${escapeHtml(bTitle)}</h2>
                            ${bSubtitle ? `<div style="font-size:0.78rem; font-weight:700; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">${escapeHtml(bSubtitle)}</div>` : ''}
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.35rem;">${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : ''].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                        </div>

                        <div style="text-align:right;">
                            <div style="font-size:1.6rem; font-weight:900; color:${accentColor}; letter-spacing:0.02em;">CUSTOMER INVOICE</div>
                            <div style="font-size:0.95rem; font-family:monospace; font-weight:800; color:#0f172a; margin-top:0.2rem;">#${escapeHtml(invNumber)}</div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">Date: ${formatInvoiceDateClean(inv)}</div>
                            <div style="margin-top:0.35rem;"><span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span></div>
                        </div>
                    </div>

                    <!-- Dual Columns: BILLED FROM & BILLED TO -->
                    ${currentOptions.showBilledFrom !== false ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED FROM (STORE)</span>
                                <div style="font-weight:800; font-size:1rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(bTitle)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem; line-height:1.4;">
                                    ${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : '', `Tax ID: ${bTaxId}`].filter(Boolean).map(escapeHtml).join(' • ')}
                                </div>
                            </div>

                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED TO (CUSTOMER)</span>
                                <div style="font-weight:800; font-size:1rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem; line-height:1.4;">
                                    ${[clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:1fr; gap:1rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED TO (CUSTOMER)</span>
                                <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.82rem; color:#64748b; margin-top:0.15rem; line-height:1.4;">
                                    ${[clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}
                                </div>
                            </div>
                        </div>
                    `}
                ` : `
                    <!-- Continuation Header for Page 2+ -->
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid ${accentColor}; padding-bottom:0.75rem; margin-bottom:1.5rem;">
                        <div>
                            <span style="font-weight:800; font-size:1.1rem; color:#0f172a;">${escapeHtml(bTitle)}</span>
                            <span style="font-size:0.75rem; color:#64748b; margin-left:0.5rem;">Customer Invoice Continuation</span>
                        </div>
                        <div style="font-size:0.82rem; font-weight:700; color:#0f172a;">
                            Invoice #${escapeHtml(invNumber)} • Page ${pageNum} of ${totalPages}
                        </div>
                    </div>
                `}

                <!-- Items Table -->
                <table class="iv-preview-table">
                    <thead>
                        <tr style="background:#f8fafc; border-bottom:2px solid #cbd5e1; color:#0f172a;">
                            <th style="width:30px; text-align:center;">#</th>
                            <th>Item & Description</th>
                            <th style="width:60px; text-align:center;">Qty</th>
                            <th style="width:100px; text-align:right;">Unit Price</th>
                            <th style="width:105px; text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map((item, idx) => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                                    <td style="text-align:center; color:#94a3b8;">${startIdx + idx + 1}</td>
                                    <td>
                                        <strong>${escapeHtml(item.name || item.productName || 'Product')}</strong>
                                        ${item.size || item.sizeWeight ? `<span style="font-size:0.75rem; color:#64748b;"> (${escapeHtml(item.size || item.sizeWeight)})</span>` : ''}
                                    </td>
                                    <td style="text-align:center; font-weight:700;">${qty}</td>
                                    <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="text-align:right; font-weight:800;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${isLastPage ? `
                    <!-- Totals & Notes -->
                    <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                        <div style="flex:1;">
                            ${hasNotes ? `
                                <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Terms & Notes</span>
                                <p style="font-size:0.8rem; color:#64748b; margin-top:0.35rem; line-height:1.45;">
                                    ${escapeHtml(rawNotes)}
                                </p>
                            ` : ''}
                        </div>

                        <div style="width:240px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem;">
                            ${renderVisualTotalsBox('Grand Total:', accentColor)}
                        </div>
                    </div>

                    <div style="margin-top:2rem; border-top:1px dashed #cbd5e1; padding-top:0.75rem; text-align:center;">
                        <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">— Please detach and return with payment remittance —</span>
                    </div>
                ` : ''}
            `;
        }

        // =========================================================================
        // 3. BUSINESS A4 (STANDARD INTERNATIONAL - 300 DPI)
        // =========================================================================
        else if (preset === 'BUSINESS_A4') {
            pageContent = `
                ${isFirstPage ? `
                    <!-- Top 4mm Accent Color Bar (Matches Vector PDF Export) -->
                    <div style="height:4px; background:${accentColor}; border-radius:2px; margin-bottom:1.25rem;"></div>

                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size:1.65rem; font-weight:900; color:#0f172a; margin:0 0 0.15rem 0; letter-spacing:-0.02em;">${escapeHtml(bTitle)}</h2>
                            <div style="font-size:0.78rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">${escapeHtml(bSubtitle || 'COMMERCIAL SALES INVOICE')}</div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.35rem; line-height:1.4;">
                                ${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : ''].filter(Boolean).map(escapeHtml).join(' • ')}
                            </div>
                        </div>

                        <div style="text-align:right;">
                            <div style="font-size:1.75rem; font-weight:900; color:${accentColor}; line-height:1; letter-spacing:0.02em;">INVOICE</div>
                            <div style="font-size:0.95rem; font-family:monospace; font-weight:800; color:#0f172a; margin-top:0.3rem;">#${escapeHtml(invNumber)}</div>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">Date: <strong>${formatInvoiceDateClean(inv)}</strong></div>
                            <div style="margin-top:0.4rem;"><span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span></div>
                        </div>
                    </div>

                    <!-- Dual Cards: BILLED FROM & BILLED TO -->
                    ${currentOptions.showBilledFrom !== false ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED FROM (SUPPLIER)</span>
                                <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.25rem;">${escapeHtml(bTitle)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">
                                    ${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : '', `Tax ID: ${bTaxId}`].filter(Boolean).map(escapeHtml).join('<br>')}
                                </div>
                            </div>

                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                                <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.25rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">
                                    ${[clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).map(escapeHtml).join('<br>') || 'Direct Business Client'}
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:1fr; gap:1rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem 1.15rem;">
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:${accentColor}; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                                <div style="font-weight:800; font-size:1.1rem; color:#0f172a; margin-top:0.25rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.82rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">
                                    ${[clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).map(escapeHtml).join('<br>') || 'Direct Business Client'}
                                </div>
                            </div>
                        </div>
                    `}
                ` : `
                    <!-- Continuation Header for Page 2+ -->
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid ${accentColor}; padding-bottom:0.75rem; margin-bottom:1.5rem;">
                        <div>
                            <span style="font-weight:800; font-size:1.1rem; color:#0f172a;">${escapeHtml(bTitle)}</span>
                            <span style="font-size:0.75rem; color:#64748b; margin-left:0.5rem;">Continuation Sheet</span>
                        </div>
                        <div style="font-size:0.82rem; font-weight:700; color:#0f172a;">
                            Invoice #${escapeHtml(invNumber)} • Page ${pageNum} of ${totalPages}
                        </div>
                    </div>
                `}

                <!-- Line Items Table -->
                <table class="iv-preview-table">
                    <thead>
                        <tr style="background:${accentColor}; color:#ffffff;">
                            <th style="width:35px; text-align:center;">#</th>
                            <th>Item Description</th>
                            <th style="width:60px; text-align:center;">Qty</th>
                            <th style="width:105px; text-align:right;">Unit Price</th>
                            <th style="width:115px; text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map((item, idx) => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
                                    <td style="text-align:center; color:#94a3b8; font-weight:600;">${startIdx + idx + 1}</td>
                                    <td>
                                        <strong>${escapeHtml(item.name || item.productName || 'Product')}</strong>
                                        ${item.size || item.sizeWeight ? `<span style="font-size:0.75rem; color:#64748b;"> (${escapeHtml(item.size || item.sizeWeight)})</span>` : ''}
                                    </td>
                                    <td style="text-align:center; font-weight:700;">${qty}</td>
                                    <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${isLastPage ? `
                    <!-- Totals & Banking Instructions -->
                    <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                        <div style="flex:1;">
                            <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Bank & Wire Instructions</span>
                            <div style="font-size:0.78rem; color:#475569; margin-top:0.35rem; line-height:1.45; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.6rem 0.8rem;">
                                ${escapeHtml(currentOptions.customBranding.bankDetails)}
                            </div>

                            ${hasNotes ? `
                                <div style="margin-top:0.75rem;">
                                    <span style="font-size:0.72rem; font-weight:800; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Invoice Notes:</span>
                                    <p style="font-size:0.78rem; color:#64748b; margin-top:0.25rem; line-height:1.4;">
                                        ${escapeHtml(rawNotes)}
                                    </p>
                                </div>
                            ` : ''}
                        </div>

                        <div style="width:240px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.9rem;">
                            ${renderVisualTotalsBox('Grand Total:', accentColor)}
                        </div>
                    </div>

                    <div style="margin-top:2rem; border-top:1px dashed #cbd5e1; padding-top:0.75rem; text-align:center;">
                        <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">— Please detach and return with payment remittance —</span>
                    </div>
                ` : ''}
            `;
        }

        // =========================================================================
        // 4. CORPORATE LEVEL HIGH DPI INVOICE LARGE SIZE
        // =========================================================================
        else if (preset === 'CORPORATE_ENTERPRISE') {
            pageContent = `
                ${isFirstPage ? `
                    <!-- Solid Dark Executive Header Banner (Matches PDF Export Engine) -->
                    <div style="background:#0f172a; border-radius:6px; padding:1.25rem 1.5rem; margin-bottom:1.5rem; position:relative; overflow:hidden;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <h1 style="font-size:1.65rem; font-weight:900; color:#ffffff; margin:0; letter-spacing:-0.02em;">${escapeHtml(bTitle)}</h1>
                                <div style="font-size:0.8rem; color:#94a3b8; margin-top:0.35rem;">
                                    ${[bAddress, bPhone ? `Phone: ${bPhone}` : '', bEmail].filter(Boolean).map(escapeHtml).join(' • ')}
                                </div>
                            </div>

                            <div style="text-align:right;">
                                <div style="font-size:1.45rem; font-weight:900; color:#ffffff; letter-spacing:0.04em;">CORPORATE INVOICE</div>
                                <div style="font-size:0.82rem; color:#cbd5e1; margin-top:0.3rem;">#${escapeHtml(invNumber)} • Date: ${formatInvoiceDateClean(inv)}</div>
                                <div style="margin-top:0.4rem;"><span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span></div>
                            </div>
                        </div>
                        <div style="position:absolute; bottom:0; left:0; right:0; height:4px; background:${accentColor};"></div>
                    </div>

                    <!-- Coordinates Grid with BILLED FROM, BILLED TO & TAX COORDINATES -->
                    ${currentOptions.showBilledFrom !== false ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; margin-bottom:1.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.9rem 1rem;">
                            <div>
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">BILLED FROM</span>
                                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-top:0.25rem;">${escapeHtml(bTitle)}</div>
                                <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">${escapeHtml(bAddress || 'Corporate Headquarters')}</div>
                            </div>

                            <div>
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">BILLED TO (CLIENT)</span>
                                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-top:0.25rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ') || 'Verified Corporate Account'}</div>
                            </div>

                            <div>
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">TAX & WIRE COORDINATES</span>
                                <div style="font-size:0.78rem; color:#0f172a; margin-top:0.25rem;"><strong>Tax ID:</strong> ${escapeHtml(bTaxId)}</div>
                                <div style="font-size:0.75rem; color:#64748b; margin-top:0.2rem;">Terms: Net 30 Business Days</div>
                            </div>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:0.75rem; margin-bottom:1.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.9rem 1rem;">
                            <div>
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">BILLED TO (CLIENT)</span>
                                <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem; line-height:1.35;">${[clientPhone, clientAddress].filter(Boolean).map(escapeHtml).join('<br>') || 'Direct Client'}</div>
                            </div>

                            <div>
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.06em;">TAX & WIRE COORDINATES</span>
                                <div style="font-size:0.78rem; color:#0f172a; margin-top:0.25rem;"><strong>Tax ID:</strong> ${escapeHtml(bTaxId)}</div>
                                <div style="font-size:0.75rem; color:#475569; margin-top:0.25rem; line-height:1.3;">${escapeHtml(currentOptions.customBranding.bankDetails)}</div>
                            </div>
                    `}
                ` : `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #0f172a; padding-bottom:0.75rem; margin-bottom:1.5rem;">
                        <span style="font-weight:900; font-size:1.15rem; color:#0f172a;">${escapeHtml(bTitle)} • Executive Invoice</span>
                        <span style="font-size:0.8rem; font-weight:700; color:#64748b;">Page ${pageNum} of ${totalPages}</span>
                    </div>
                `}

                <!-- Items Table -->
                <table class="iv-preview-table">
                    <thead>
                        <tr style="background:#0f172a; color:#ffffff;">
                            <th style="width:35px; text-align:center;">#</th>
                            <th>Scope / Item Specification</th>
                            <th style="width:55px; text-align:center;">Qty</th>
                            <th style="width:110px; text-align:right;">Unit Rate</th>
                            <th style="width:120px; text-align:right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map((item, idx) => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
                                    <td style="text-align:center; color:#94a3b8; font-weight:700;">${startIdx + idx + 1}</td>
                                    <td>
                                        <strong>${escapeHtml(item.name || item.productName || 'Corporate Product')}</strong>
                                        ${item.size || item.sizeWeight ? `<span style="font-size:0.75rem; color:#64748b;"> • ${escapeHtml(item.size || item.sizeWeight)}</span>` : ''}
                                    </td>
                                    <td style="text-align:center; font-weight:700;">${qty}</td>
                                    <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="text-align:right; font-weight:800; color:#0f172a;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${isLastPage ? `
                    <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                        <div style="flex:1;">
                            ${hasNotes ? `
                                <span style="font-size:0.7rem; font-weight:800; text-transform:uppercase; color:#94a3b8;">Executive Notes:</span>
                                <p style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">${escapeHtml(rawNotes)}</p>
                            ` : ''}
                        </div>

                        <div style="width:260px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:1rem;">
                            ${renderVisualTotalsBox('Total Payable:', '#0f172a')}
                        </div>
                    </div>
                ` : ''}
            `;
        }

        // =========================================================================
        // 5. US LETTER SIZE (8.5 x 11 in)
        // =========================================================================
        else if (preset === 'US_LETTER') {
            pageContent = `
                ${isFirstPage ? `
                    <!-- Top 4mm Accent Color Bar (Matches Vector PDF Export) -->
                    <div style="height:4px; background:${accentColor}; border-radius:2px; margin-bottom:1.25rem;"></div>

                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid #e2e8f0;">
                        <div>
                            <h2 style="font-size:1.55rem; font-weight:900; color:#0f172a; margin:0;">${escapeHtml(bTitle)}</h2>
                            <div style="font-size:0.78rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.25rem;">${escapeHtml(bSubtitle || 'COMMERCIAL SALES INVOICE')}</div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.35rem;">${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : ''].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:1.65rem; font-weight:900; color:${accentColor};">INVOICE</div>
                            <div style="font-size:0.95rem; font-family:monospace; font-weight:800; color:#0f172a; margin-top:0.25rem;">#${escapeHtml(invNumber)}</div>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">Date: <strong>${formatInvoiceDateClean(inv)}</strong></div>
                            <div style="margin-top:0.4rem;"><span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span></div>
                        </div>
                    </div>

                    ${currentOptions.showBilledFrom !== false ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; padding:0.85rem 1rem; border:1px solid #e2e8f0; border-radius:6px;">
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED FROM (SUPPLIER)</span>
                                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(bTitle)}</div>
                                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">${[bAddress, bPhone ? `Tel: ${bPhone}` : '', `Tax ID: ${bTaxId}`].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                            </div>
                            <div style="background:#f8fafc; padding:0.85rem 1rem; border:1px solid #e2e8f0; border-radius:6px;">
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                                <div style="font-weight:800; font-size:0.95rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">${[clientPhone ? `Tel: ${clientPhone}` : '', clientEmail ? `Email: ${clientEmail}` : '', clientAddress].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}</div>
                            </div>
                        </div>
                    ` : `
                        <div style="display:grid; grid-template-columns:1fr; gap:0.75rem; margin-bottom:1.5rem;">
                            <div style="background:#f8fafc; padding:0.85rem 1rem; border:1px solid #e2e8f0; border-radius:6px;">
                                <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                                <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                                <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}</div>
                            </div>
                        </div>
                    `}
                ` : `
                    <div style="display:flex; justify-content:space-between; padding-bottom:0.75rem; border-bottom:1px solid #cbd5e1; margin-bottom:1.5rem;">
                        <strong>${escapeHtml(bTitle)} • Invoice #${escapeHtml(invNumber)}</strong>
                        <span>Page ${pageNum} of ${totalPages}</span>
                    </div>
                `}

                <table class="iv-preview-table">
                    <thead>
                        <tr style="background:${accentColor}; color:#ffffff;">
                            <th style="width:35px; text-align:center;">#</th>
                            <th>Item & Description</th>
                            <th style="width:55px; text-align:center;">Qty</th>
                            <th style="width:100px; text-align:right;">Unit Price</th>
                            <th style="width:110px; text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map((item, idx) => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
                                    <td style="text-align:center; color:#94a3b8; font-weight:600;">${startIdx + idx + 1}</td>
                                    <td><strong>${escapeHtml(item.name || item.productName || 'Item')}</strong></td>
                                    <td style="text-align:center; font-weight:700;">${qty}</td>
                                    <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                ${isLastPage ? `
                    <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                        <div style="flex:1;">
                            ${hasNotes ? `
                                <span style="font-size:0.7rem; font-weight:700; color:#94a3b8;">NOTES & TERMS:</span>
                                <p style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">${escapeHtml(rawNotes)}</p>
                            ` : ''}
                        </div>
                        <div style="width:240px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem;">
                            ${renderVisualTotalsBox('Total Due:', accentColor)}
                        </div>
                    </div>

                    <div style="margin-top:2rem; border-top:1px dashed #cbd5e1; padding-top:0.75rem; text-align:center;">
                        <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">— Please detach and return with payment remittance —</span>
                    </div>
                ` : ''}
            `;
        }

        // =========================================================================
        // 6. CUSTOM SIZE
        // =========================================================================
        else {
            pageContent = `
                ${isFirstPage ? `
                    <!-- Top 4mm Accent Color Bar (Matches Vector PDF Export) -->
                    <div style="height:4px; background:${accentColor}; border-radius:2px; margin-bottom:1.25rem;"></div>

                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; border-bottom:1px solid #e2e8f0; padding-bottom:1rem;">
                    <div>
                        <h2 style="font-size:1.55rem; font-weight:900; color:#0f172a; margin:0;">${escapeHtml(bTitle)}</h2>
                        <div style="font-size:0.78rem; color:${accentColor}; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; margin-top:0.25rem;">${escapeHtml(bSubtitle || 'COMMERCIAL SALES INVOICE')}</div>
                        <div style="font-size:0.8rem; color:#64748b; margin-top:0.35rem;">${[bAddress, bPhone ? `Tel: ${bPhone}` : '', bEmail ? `Email: ${bEmail}` : ''].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.6rem; font-weight:900; color:${accentColor};">INVOICE</div>
                        <div style="font-size:0.95rem; font-family:monospace; font-weight:800; color:#0f172a; margin-top:0.25rem;">#${escapeHtml(invNumber)}</div>
                        <div style="font-size:0.78rem; color:#64748b; margin-top:0.2rem;">Date: <strong>${formatInvoiceDateClean(inv)}</strong></div>
                        <div style="margin-top:0.4rem;"><span class="iv-status-pill ${statusBadgeClass}">${escapeHtml(invStatus)}</span></div>
                    </div>
                </div>

                ${currentOptions.showBilledFrom !== false ? `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:1.5rem;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem 1rem;">
                            <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED FROM (SUPPLIER)</span>
                            <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${escapeHtml(bTitle)}</div>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">${[bAddress, bPhone ? `Tel: ${bPhone}` : '', `Tax ID: ${bTaxId}`].filter(Boolean).map(escapeHtml).join(' • ')}</div>
                        </div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem 1rem;">
                            <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                            <div style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}</div>
                        </div>
                    </div>
                ` : `
                    <div style="display:grid; grid-template-columns:1fr; gap:0.75rem; margin-bottom:1.5rem;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem 1rem;">
                            <span style="font-size:0.68rem; font-weight:800; color:${accentColor}; text-transform:uppercase; letter-spacing:0.05em;">BILLED TO (RECIPIENT)</span>
                            <div style="font-weight:800; font-size:1.05rem; color:#0f172a; margin-top:0.2rem;">${escapeHtml(clientName)}</div>
                            <div style="font-size:0.8rem; color:#64748b; margin-top:0.15rem;">${[clientPhone, clientEmail].filter(Boolean).map(escapeHtml).join(' • ') || 'Customer Direct Sale'}</div>
                        </div>
                    </div>
                `}
                ` : `
                    <div style="display:flex; justify-content:space-between; padding-bottom:0.75rem; border-bottom:1px solid #cbd5e1; margin-bottom:1.5rem;">
                        <strong>${escapeHtml(bTitle)} • Invoice #${escapeHtml(invNumber)}</strong>
                        <span>Page ${pageNum} of ${totalPages}</span>
                    </div>
                `}

                <table class="iv-preview-table">
                    <thead>
                        <tr style="background:${accentColor}; color:#ffffff;">
                            <th style="width:35px; text-align:center;">#</th>
                            <th>Item & Description</th>
                            <th style="width:55px; text-align:center;">Qty</th>
                            <th style="width:100px; text-align:right;">Unit Price</th>
                            <th style="width:110px; text-align:right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageItems.map((item, idx) => {
                            const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                            const qty = Number(item.quantity) || 1;
                            return `
                                <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
                                    <td style="text-align:center; color:#94a3b8; font-weight:600;">${startIdx + idx + 1}</td>
                                    <td><strong>${escapeHtml(item.name || item.productName || 'Item')}</strong></td>
                                    <td style="text-align:center; font-weight:700;">${qty}</td>
                                    <td style="text-align:right;">${formatCurrency(price, currentOptions.currencySymbol)}</td>
                                    <td style="text-align:right; font-weight:700;">${formatCurrency(qty * price, currentOptions.currencySymbol)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div style="display:flex; justify-content:space-between; margin-top:1.5rem; gap:1.5rem;">
                    <div style="flex:1;">
                        ${hasNotes ? `
                            <span style="font-size:0.7rem; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">NOTES & TERMS:</span>
                            <p style="font-size:0.78rem; color:#64748b; margin-top:0.2rem; line-height:1.4;">${escapeHtml(rawNotes)}</p>
                        ` : ''}
                    </div>
                    <div style="width:240px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.85rem;">
                        ${renderVisualTotalsBox('Grand Total:', accentColor)}
                    </div>
                </div>

                <div style="margin-top:2rem; border-top:1px dashed #cbd5e1; padding-top:0.75rem; text-align:center;">
                    <span style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; letter-spacing:0.08em;">— Please detach and return with payment remittance —</span>
                </div>
            `;
        }

        // Bottom Dock: Terms & Conditions + Digital Signature & Corporate Seal (Anchored to Page Bottom)
        let bottomDockHtml = '';
        if (isLastPage) {
            const sig = currentOptions.elements.signature;
            const stamp = currentOptions.elements.stamp;

            const termsBlock = hasTerms ? `
                <div style="margin-bottom:0.85rem; padding-top:0.75rem; border-top:1px dashed #cbd5e1;">
                    <span style="font-size:0.68rem; font-weight:800; text-transform:uppercase; color:#94a3b8; letter-spacing:0.05em;">Terms & Conditions</span>
                    <div style="font-size:0.74rem; color:#64748b; margin-top:0.25rem; line-height:1.45; white-space:pre-line;">${escapeHtml(rawTerms)}</div>
                </div>
            ` : '';

            const badgesBlock = (sig.enabled || stamp.enabled) ? `
                <div style="display:flex; justify-content:space-between; align-items:flex-end; padding-top:0.75rem; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:1.25rem;">
                    <div>
                        ${sig.enabled ? `
                            <div class="iv-signature-box">
                                ${sig.dataUrl ? `
                                    <img src="${sig.dataUrl}" style="max-height:52px; max-width:200px; object-fit:contain; margin-bottom:0.25rem;" alt="Digital Signature">
                                ` : `
                                    <div class="iv-signature-cursive" style="font-family: ${sig.fontFamily || "'Dancing Script', 'Brush Script MT', cursive"}; font-weight: ${sig.isBold ? 800 : 400}; font-size: ${sig.isBold ? '1.25rem' : '1.75rem'}; letter-spacing: ${sig.isBold ? '0.04em' : 'normal'};">
                                        ${escapeHtml(sig.signerName || 'Authorized Signatory')}
                                    </div>
                                `}
                                <div style="font-size:0.75rem; font-weight:800; color:#0f172a; border-top:1px solid #cbd5e1; padding-top:0.35rem; width:100%; text-align:center;">
                                    ${escapeHtml(sig.signerSubName || sig.signerName || 'Authorized Signatory')}
                                </div>
                                <div style="font-size:0.68rem; color:#64748b; text-align:center;">
                                    ${escapeHtml(sig.signerTitle || 'Executive Officer')}
                                </div>
                                <div style="font-size:0.65rem; color:#94a3b8; margin-top:0.1rem; text-align:center;">
                                    Signed: ${escapeHtml(sig.date || new Date().toLocaleDateString())}
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div>
                        ${stamp.enabled ? `
                            <div class="iv-stamp-badge" style="border:3px double ${stamp.color || '#059669'}; color:${stamp.color || '#059669'}; background:rgba(5,150,105,0.06);">
                                <span style="font-size:0.82rem;">${escapeHtml(stamp.customText || 'APPROVED & VERIFIED')} ★</span>
                                <span style="font-size:0.65rem; font-weight:600; opacity:0.85;">${escapeHtml(bTitle)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : '';

            if (termsBlock || badgesBlock) {
                bottomDockHtml = `
                    <div class="iv-sheet-bottom-dock">
                        ${termsBlock}
                        ${badgesBlock}
                    </div>
                `;
            }
        }

        // Render Floating Placeable Elements (Photos and Texts with absolute positions)
        let floatingElementsHtml = '';
        if (isLastPage) {
            floatingElementsHtml = (currentOptions.elements.floatingElements || []).map(el => {
                const isSelected = selectedFloatingElId === el.id;
                if (el.type === 'photo') {
                    return `
                        <div class="iv-floating-element ${isSelected ? 'is-selected' : ''}" data-el-id="${el.id}" style="left:${el.x}px; top:${el.y}px;" title="Drag or use arrow keys to reposition">
                            <img src="${el.src}" style="width:${el.width || 120}px; height:auto; display:block; border-radius:4px; pointer-events:none;" alt="Element Photo">
                        </div>
                    `;
                } else {
                    return `
                        <div class="iv-floating-element ${isSelected ? 'is-selected' : ''}" data-el-id="${el.id}" style="left:${el.x}px; top:${el.y}px; font-size:${el.fontSize || 13}px; color:${el.color || '#0f172a'}; font-weight:700; background:rgba(255,255,255,0.85); padding:2px 6px; border-radius:4px; border:1px dashed #cbd5e1;" title="Drag or use arrow keys to reposition">
                            ${escapeHtml(el.text)}
                        </div>
                    `;
                }
            }).join('');
        }

        // Layout class
        let layoutClass = 'layout-business-a4';
        if (preset === 'POS_RECEIPT') layoutClass = 'layout-pos';
        else if (preset === 'CUSTOMER_A4') layoutClass = 'layout-customer-a4';
        else if (preset === 'CORPORATE_ENTERPRISE') layoutClass = 'layout-corporate-enterprise';
        else if (preset === 'US_LETTER') layoutClass = 'layout-us-letter';
        else if (preset === 'CUSTOM') layoutClass = 'layout-custom';

        pagesHtml += `
            ${totalPages > 1 ? `<div class="iv-page-separator">Page ${pageNum} of ${totalPages}</div>` : ''}
            <div class="iv-paper-sheet ${layoutClass} ${currentOptions.enableDataChanges ? 'iv-data-change-active' : ''}" id="iv-sheet-page-${pageNum}" style="position:relative;">
                ${pageContent}
                ${bottomDockHtml}
                ${floatingElementsHtml}
            </div>
        `;
    }

    pagesWrapper.innerHTML = pagesHtml;
    applyBorderStyles();
    wireFloatingElementsDragging();
    triggerLivePdfSync(180);
};

/**
 * Wire Floating Elements Dragging, Vector Key (Arrow) Repositioning & Live Styling Controls
 */
const wireFloatingElementsDragging = () => {
    const elements = document.querySelectorAll('.iv-floating-element');
    const posBox = document.getElementById('iv-floating-pos-box');
    const posXIn = document.getElementById('iv-el-pos-x');
    const posYIn = document.getElementById('iv-el-pos-y');
    const delBtn = document.getElementById('iv-btn-del-selected-el');

    const updateControlsForSelected = () => {
        const found = currentOptions.elements.floatingElements.find(e => e.id === selectedFloatingElId);
        if (found && posBox && posXIn && posYIn) {
            posBox.style.display = 'block';
            posXIn.value = found.x;
            posYIn.value = found.y;

            const label = document.getElementById('iv-selected-el-label');
            const textControls = document.getElementById('iv-floating-text-controls');
            const photoControls = document.getElementById('iv-floating-photo-controls');

            if (found.type === 'text') {
                if (label) label.textContent = 'Selected: Text Element';
                if (textControls) textControls.style.display = 'flex';
                if (photoControls) photoControls.style.display = 'none';

                const textIn = document.getElementById('iv-el-text-val');
                const fontSizeIn = document.getElementById('iv-el-font-size');
                const textColorPicker = document.getElementById('iv-el-text-color');
                const textColorHex = document.getElementById('iv-el-text-color-hex');

                if (textIn) textIn.value = found.text || '';
                if (fontSizeIn) fontSizeIn.value = found.fontSize || 13;
                if (textColorPicker) textColorPicker.value = found.color || '#0f172a';
                if (textColorHex) textColorHex.value = found.color || '#0f172a';
            } else if (found.type === 'photo') {
                if (label) label.textContent = 'Selected: Photo Element';
                if (textControls) textControls.style.display = 'none';
                if (photoControls) photoControls.style.display = 'flex';

                const widthSlider = document.getElementById('iv-el-photo-width-slider');
                const widthVal = document.getElementById('iv-el-photo-width-val');
                const currentW = found.width || 140;
                if (widthSlider) widthSlider.value = currentW;
                if (widthVal) widthVal.textContent = `${currentW}px`;
            }
        } else if (posBox) {
            posBox.style.display = 'none';
        }
    };

    elements.forEach(elNode => {
        const elId = elNode.getAttribute('data-el-id');

        elNode.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left click for dragging elements
            e.stopPropagation();

            const sheetIframe = document.getElementById('iv-sheet-vector-iframe');
            if (sheetIframe) sheetIframe.style.pointerEvents = 'none';

            selectedFloatingElId = elId;
            document.querySelectorAll('.iv-floating-element').forEach(el => el.classList.remove('is-selected'));
            elNode.classList.add('is-selected');
            updateControlsForSelected();

            const paperSheet = elNode.closest('.iv-paper-sheet');
            if (!paperSheet) return;

            const zoom = currentOptions.zoomLevel || 1;
            const rect = elNode.getBoundingClientRect();
            const shiftX = (e.clientX - rect.left) / zoom;
            const shiftY = (e.clientY - rect.top) / zoom;

            const onMouseMove = (moveEvent) => {
                const sheetRect = paperSheet.getBoundingClientRect();
                const unscaledX = (moveEvent.clientX - sheetRect.left) / zoom - shiftX;
                const unscaledY = (moveEvent.clientY - sheetRect.top) / zoom - shiftY;
                const spec = getInvoiceLayoutSpec(currentOptions.sizePreset, currentOptions);
                const targetEl = currentOptions.elements.floatingElements.find(item => item.id === elId);
                const elWidth = targetEl ? (targetEl.width || 120) : 120;
                const maxX = Math.max(0, spec.canvasWidthPx - elWidth);
                const maxY = Math.max(0, spec.canvasMinHeightPx - 30);
                const newX = Math.round(Math.min(maxX, Math.max(0, unscaledX)));
                const newY = Math.round(Math.min(maxY, Math.max(0, unscaledY)));

                elNode.style.left = `${newX}px`;
                elNode.style.top = `${newY}px`;

                if (targetEl) {
                    targetEl.x = newX;
                    targetEl.y = newY;
                    if (posXIn) posXIn.value = newX;
                    if (posYIn) posYIn.value = newY;
                }
            };

            const onMouseUp = () => {
                const sheetIframe = document.getElementById('iv-sheet-vector-iframe');
                if (sheetIframe) sheetIframe.style.pointerEvents = 'auto';

                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                saveViewerSession();
                triggerLivePdfSync(80);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });
    });

    if (posXIn) {
        posXIn.addEventListener('input', (e) => {
            const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
            if (found) {
                found.x = Number(e.target.value) || 0;
                const node = document.querySelector(`[data-el-id="${found.id}"]`);
                if (node) node.style.left = `${found.x}px`;
                saveViewerSession();
                triggerLivePdfSync(150);
            }
        });
    }

    if (posYIn) {
        posYIn.addEventListener('input', (e) => {
            const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
            if (found) {
                found.y = Number(e.target.value) || 0;
                const node = document.querySelector(`[data-el-id="${found.id}"]`);
                if (node) node.style.top = `${found.y}px`;
                saveViewerSession();
                triggerLivePdfSync(150);
            }
        });
    }

    // Floating Text Content Editor
    const textIn = document.getElementById('iv-el-text-val');
    if (textIn) {
        textIn.oninput = (e) => {
            const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
            if (found && found.type === 'text') {
                found.text = e.target.value;
                const node = document.querySelector(`[data-el-id="${found.id}"]`);
                if (node) node.textContent = found.text;
                saveViewerSession();
                triggerLivePdfSync(150);
            }
        };
    }

    // Floating Text Font Size Editor
    const fontSizeIn = document.getElementById('iv-el-font-size');
    if (fontSizeIn) {
        fontSizeIn.oninput = (e) => {
            const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
            if (found && found.type === 'text') {
                found.fontSize = Number(e.target.value) || 13;
                const node = document.querySelector(`[data-el-id="${found.id}"]`);
                if (node) node.style.fontSize = `${found.fontSize}px`;
                saveViewerSession();
                triggerLivePdfSync(150);
            }
        };
    }

    // Floating Text Color Editor
    const textColorPicker = document.getElementById('iv-el-text-color');
    const textColorHex = document.getElementById('iv-el-text-color-hex');
    const setFloatingTextColor = (col) => {
        const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
        if (found && found.type === 'text') {
            found.color = col;
            if (textColorPicker) textColorPicker.value = col;
            if (textColorHex) textColorHex.value = col;
            const node = document.querySelector(`[data-el-id="${found.id}"]`);
            if (node) node.style.color = col;
            saveViewerSession();
            triggerLivePdfSync(100);
        }
    };
    if (textColorPicker) textColorPicker.oninput = (e) => setFloatingTextColor(e.target.value);
    if (textColorHex) {
        textColorHex.oninput = (e) => {
            const val = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) setFloatingTextColor(val);
        };
    }

    // Floating Photo Width Slider
    const photoWidthSlider = document.getElementById('iv-el-photo-width-slider');
    const photoWidthVal = document.getElementById('iv-el-photo-width-val');
    if (photoWidthSlider) {
        photoWidthSlider.oninput = (e) => {
            const found = currentOptions.elements.floatingElements.find(item => item.id === selectedFloatingElId);
            if (found && found.type === 'photo') {
                const w = Number(e.target.value) || 140;
                found.width = w;
                if (photoWidthVal) photoWidthVal.textContent = `${w}px`;
                const node = document.querySelector(`[data-el-id="${found.id}"] img`);
                if (node) node.style.width = `${w}px`;
                saveViewerSession();
                triggerLivePdfSync(150);
            }
        };
    }

    if (delBtn) {
        delBtn.onclick = () => {
            if (selectedFloatingElId) {
                currentOptions.elements.floatingElements = currentOptions.elements.floatingElements.filter(i => i.id !== selectedFloatingElId);
                selectedFloatingElId = null;
                updateControlsForSelected();
                updateVisualPreview();
                triggerLivePdfSync(50);
                showAlert.info("Element deleted.");
            }
        };
    }
};

/**
 * Detailed Invoice Financial Intelligence View
 */
const updatePerformanceView = () => {
    const perfContainer = document.getElementById('iv-perf-sheet');
    if (!perfContainer || !currentInvoice) return;

    const inv = currentInvoice;
    const items = Array.isArray(inv.items) ? inv.items : [];
    
    let totalRevenue = Number(inv.totalPrice || inv.grandTotal || 0);
    let subtotal = Number(inv.subtotal || 0);
    let totalCost = 0;
    let calculatedProfit = 0;
    let totalItemQuantity = 0;

    const itemPerformance = items.map(item => {
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice || item.price || item.sellingPrice || 0);
        const unitCost = Number(item.unitCost || 0);
        const lineRev = Number(item.totalPrice) || (qty * unitPrice);
        const lineCost = qty * unitCost;
        const lineProfit = (item.itemProfit !== undefined && item.itemProfit !== null)
            ? Number(item.itemProfit)
            : (lineRev - lineCost);
        const marginPct = lineRev > 0 ? ((lineProfit / lineRev) * 100) : 0;

        totalCost += lineCost;
        calculatedProfit += lineProfit;
        totalItemQuantity += qty;
        if (!subtotal) subtotal += lineRev;

        return {
            name: item.name || item.productName || 'Product',
            size: item.size || item.sizeWeight || '',
            qty,
            unitPrice,
            unitCost,
            lineRev,
            lineCost,
            lineProfit,
            marginPct
        };
    });

    if (!totalRevenue) totalRevenue = subtotal;
    const finalProfit = (inv.totalProfit !== undefined && inv.totalProfit !== null) 
        ? Number(inv.totalProfit) 
        : calculatedProfit;
    const marginPct = totalRevenue > 0 ? ((finalProfit / totalRevenue) * 100) : 0;

    // Financial Health Grade & Safety Cushion
    let healthGrade = 'Grade A+ (High Yield)';
    let gradeBadgeStyle = 'background:rgba(16,185,129,0.12); color:#059669; border:1px solid rgba(16,185,129,0.3);';
    if (marginPct < 15) {
        healthGrade = 'Grade C (Low Margin Risk)';
        gradeBadgeStyle = 'background:rgba(225,29,72,0.12); color:#18181B; border:1px solid rgba(225,29,72,0.3);';
    } else if (marginPct < 30) {
        healthGrade = 'Grade B (Sustainable)';
        gradeBadgeStyle = 'background:rgba(245,158,11,0.12); color:#d97706; border:1px solid rgba(245,158,11,0.3);';
    }

    const discountAmount = Number(inv.discountPercent || 0) > 0 ? (subtotal * Number(inv.discountPercent)) / 100 : 0;
    const taxAmount = Number(inv.taxPercent || 0) > 0 ? (Math.max(0, subtotal - discountAmount) * Number(inv.taxPercent)) / 100 : 0;
    const breakEvenRev = totalCost;
    const safetyCushion = Math.max(0, totalRevenue - breakEvenRev);

    const userRestrictions = getUserRestrictions();

    perfContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
            <div>
                <h3 style="margin:0 0 0.15rem 0; font-size:1.35rem; font-weight:800; color:#0f172a;">Executive Financial Intelligence</h3>
                <p style="margin:0; font-size:0.8rem; color:#64748b;">Comprehensive profitability, unit economics, COGS, and safety margins</p>
            </div>
            <span style="font-size:0.78rem; font-weight:800; padding:0.35rem 0.75rem; border-radius:6px; ${gradeBadgeStyle}">${healthGrade} (${userRestrictions.cannotSeeProfit ? '••••' : Math.round(marginPct) + '%'})</span>
        </div>

        <!-- 6 Metrics Enterprise KPI Grid -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.65rem; margin-bottom:1.5rem;">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">Gross Revenue</div>
                <div style="font-size:1.35rem; font-weight:900; color:#0f172a; margin-top:0.2rem;">${formatCurrency(totalRevenue, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">${totalItemQuantity} total units billed</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">Total COGS (Cost)</div>
                <div style="font-size:1.35rem; font-weight:900; color:#64748b; margin-top:0.2rem;">${userRestrictions.cannotSeeCost ? '••••' : formatCurrency(totalCost, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">Procurement outlay</div>
            </div>

            <div style="background:rgba(225,29,72,0.04); border:1px solid rgba(225,29,72,0.2); border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#18181B; text-transform:uppercase;">Net Gross Profit</div>
                <div style="font-size:1.35rem; font-weight:900; color:#18181B; margin-top:0.2rem;">${userRestrictions.cannotSeeProfit ? '••••' : '+' + formatCurrency(finalProfit, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#18181B; font-weight:700;">${userRestrictions.cannotSeeProfit ? '•••• yield' : Math.round(marginPct) + '% net yield'}</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">Safety Cushion</div>
                <div style="font-size:1.35rem; font-weight:900; color:#059669; margin-top:0.2rem;">+${formatCurrency(safetyCushion, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">Above break-even</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">Discount Drag</div>
                <div style="font-size:1.35rem; font-weight:900; color:#d97706; margin-top:0.2rem;">-${formatCurrency(discountAmount, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">${Number(inv.discountPercent || 0)}% rate</div>
            </div>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748b; text-transform:uppercase;">Tax / VAT Total</div>
                <div style="font-size:1.35rem; font-weight:900; color:#0f172a; margin-top:0.2rem;">+${formatCurrency(taxAmount, currentOptions.currencySymbol)}</div>
                <div style="font-size:0.72rem; color:#94a3b8;">${Number(inv.taxPercent || 0)}% statutory</div>
            </div>
        </div>

        <!-- Itemized Margins Table -->
        <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700;">
                        <th style="padding:0.65rem 1rem;">Item Name</th>
                        <th style="padding:0.65rem; text-align:center;">Qty</th>
                        <th style="padding:0.65rem; text-align:right;">Unit Cost</th>
                        <th style="padding:0.65rem; text-align:right;">Sale Price</th>
                        <th style="padding:0.65rem; text-align:right;">Revenue</th>
                        <th style="padding:0.65rem 1rem; text-align:right;">Profit (Margin %)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemPerformance.map((item, idx) => `
                        <tr style="border-bottom:1px solid #f1f5f9; background:${idx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                            <td style="padding:0.65rem 1rem;">
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.size ? `<span style="font-size:0.75rem; color:#94a3b8;"> (${escapeHtml(item.size)})</span>` : ''}
                            </td>
                            <td style="padding:0.65rem; text-align:center; font-weight:700;">${item.qty}</td>
                            <td style="padding:0.65rem; text-align:right; color:#64748b;">${userRestrictions.cannotSeeCost ? '••••' : formatCurrency(item.unitCost, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem; text-align:right; font-weight:600;">${formatCurrency(item.unitPrice, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem; text-align:right; font-weight:700;">${formatCurrency(item.lineRev, currentOptions.currencySymbol)}</td>
                            <td style="padding:0.65rem 1rem; text-align:right; font-weight:700; color:#059669;">
                                ${userRestrictions.cannotSeeProfit ? '••••' : `+${formatCurrency(item.lineProfit, currentOptions.currencySymbol)} <span style="font-size:0.72rem; color:#64748b; font-weight:500;">(${Math.round(item.marginPct)}%)</span>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

/**
 * Embedded Live Invoice Maker Editor Sheet
 */
const updateMakerEditorView = () => {
    const editorContainer = document.getElementById('iv-maker-editor-sheet');
    if (!editorContainer || !currentInvoice) return;

    const inv = currentInvoice;
    const items = Array.isArray(inv.items) ? inv.items : [];

    editorContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid #e2e8f0; padding-bottom:0.75rem;">
            <div>
                <h3 style="margin:0 0 0.15rem 0; font-size:1.25rem; font-weight:800; color:#0f172a;">Live Invoice Maker Studio</h3>
                <p style="margin:0; font-size:0.8rem; color:#64748b;">Edit invoice data, recalculate totals, and add line items directly</p>
            </div>
            <button type="button" id="iv-maker-add-item-btn" class="btn btn-primary btn-sm" style="font-size:0.78rem; font-weight:700; display:flex; align-items:center; gap:0.35rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Add Line Item
            </button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; margin-bottom:1.25rem;">
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Invoice Number</label>
                <input type="text" id="iv-ed-inv-num" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;" value="${escapeHtml(inv.busInvNumber || inv.invoiceNumber || 'INV-001')}">
            </div>
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Customer / Client Name</label>
                <input type="text" id="iv-ed-client-name" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;" value="${escapeHtml(inv.clientName || inv.customerName || 'Valued Customer')}">
            </div>
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Payment Status</label>
                <select id="iv-ed-status" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;">
                    <option value="PAID" ${inv.status === 'PAID' ? 'selected' : ''}>PAID</option>
                    <option value="PENDING" ${inv.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                    <option value="OVERDUE" ${inv.status === 'OVERDUE' ? 'selected' : ''}>OVERDUE</option>
                </select>
            </div>
        </div>

        <div style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:1.25rem;">
            <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:1px solid #e2e8f0; color:#64748b; font-weight:700;">
                        <th style="padding:0.6rem 0.8rem;">Product / Item</th>
                        <th style="padding:0.6rem; width:80px; text-align:center;">Qty</th>
                        <th style="padding:0.6rem; width:100px; text-align:right;">Unit Cost</th>
                        <th style="padding:0.6rem; width:105px; text-align:right;">Unit Price</th>
                        <th style="padding:0.6rem; width:105px; text-align:right;">Total</th>
                        <th style="padding:0.6rem 0.8rem; width:40px; text-align:center;">Action</th>
                    </tr>
                </thead>
                <tbody id="iv-maker-items-tbody">
                    ${items.map((item, idx) => {
                        const qty = Number(item.quantity) || 1;
                        const price = Number(item.unitPrice || item.price || item.sellingPrice || 0);
                        const cost = Number(item.unitCost || 0);
                        return `
                            <tr style="border-bottom:1px solid #f1f5f9;" data-idx="${idx}">
                                <td style="padding:0.5rem 0.8rem;">
                                    <input type="text" class="form-control iv-maker-item-name" value="${escapeHtml(item.name || item.productName || 'Product')}" style="font-size:0.8rem; padding:0.3rem 0.5rem;">
                                </td>
                                <td style="padding:0.5rem;">
                                    <input type="number" class="form-control iv-maker-item-qty" value="${qty}" min="1" style="font-size:0.8rem; padding:0.3rem; text-align:center;">
                                </td>
                                <td style="padding:0.5rem;">
                                    ${userRestrictions.cannotSeeCost
                                        ? `<input type="text" class="form-control iv-maker-item-cost" value="••••" disabled readonly style="font-size:0.8rem; padding:0.3rem; text-align:right;">`
                                        : `<input type="number" class="form-control iv-maker-item-cost" value="${cost}" min="0" step="0.5" style="font-size:0.8rem; padding:0.3rem; text-align:right;">`}
                                </td>
                                <td style="padding:0.5rem;">
                                    <input type="number" class="form-control iv-maker-item-price" value="${price}" min="0" step="0.5" style="font-size:0.8rem; padding:0.3rem; text-align:right;">
                                </td>
                                <td style="padding:0.5rem; text-align:right; font-weight:700; color:#0f172a;">
                                    ${formatCurrency(qty * price, currentOptions.currencySymbol)}
                                </td>
                                <td style="padding:0.5rem 0.8rem; text-align:center;">
                                    <button type="button" class="btn btn-sm btn-ghost iv-maker-del-item" data-idx="${idx}" style="color:#18181B; padding:0.2rem;" title="Delete Item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.75rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.85rem; margin-bottom:1.25rem;">
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Discount (%)</label>
                <input type="number" id="iv-ed-discount" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;" value="${Number(inv.discountPercent || 0)}" min="0" max="100">
            </div>
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Tax / VAT (%)</label>
                <input type="number" id="iv-ed-tax" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;" value="${Number(inv.taxPercent || 0)}" min="0" max="100">
            </div>
            <div>
                <label style="font-size:0.72rem; font-weight:700; color:#64748b;">Shipping / Logistics ($)</label>
                <input type="number" id="iv-ed-shipping" class="form-control" style="font-size:0.85rem; padding:0.4rem 0.6rem;" value="${Number(inv.shippingCost || 0)}" min="0">
            </div>
        </div>
    `;

    wireMakerEditorInputs();
};

/**
 * Wire Live Maker Editor Input Listeners
 */
const wireMakerEditorInputs = () => {
    const recalculateInvoice = () => {
        if (!currentInvoice) return;
        
        let subtotal = 0;
        let totalCost = 0;
        (currentInvoice.items || []).forEach(item => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unitPrice || item.price || 0);
            const cost = Number(item.unitCost || 0);
            item.totalPrice = qty * price;
            item.itemProfit = (price - cost) * qty;
            subtotal += item.totalPrice;
            totalCost += cost * qty;
        });

        currentInvoice.subtotal = subtotal;
        const discountPct = Number(currentInvoice.discountPercent) || 0;
        const discountAmount = discountPct > 0 ? (subtotal * discountPct) / 100 : 0;
        const baseForTax = Math.max(0, subtotal - discountAmount);
        const taxPct = Number(currentInvoice.taxPercent) || 0;
        const taxAmount = taxPct > 0 ? (baseForTax * taxPct) / 100 : 0;
        const shipping = Number(currentInvoice.shippingCost) || 0;
        const grandTotal = baseForTax + taxAmount + shipping;

        currentInvoice.totalPrice = grandTotal;
        currentInvoice.grandTotal = grandTotal;
        currentInvoice.totalCost = totalCost;
        currentInvoice.totalProfit = grandTotal - totalCost;

        const headerInvNum = document.getElementById('iv-header-inv-num');
        if (headerInvNum) {
            headerInvNum.textContent = `Invoice #${currentInvoice.busInvNumber || currentInvoice.invoiceNumber || 'INV-001'}`;
        }

        saveViewerSession();
        updateVisualPreview();
        updatePerformanceView();
    };

    // Metadata inputs
    const invNumInput = document.getElementById('iv-ed-inv-num');
    if (invNumInput) {
        invNumInput.addEventListener('input', (e) => {
            currentInvoice.busInvNumber = e.target.value;
            currentInvoice.invoiceNumber = e.target.value;
            recalculateInvoice();
        });
    }

    const clientNameInput = document.getElementById('iv-ed-client-name');
    if (clientNameInput) {
        clientNameInput.addEventListener('input', (e) => {
            currentInvoice.clientName = e.target.value;
            currentInvoice.customerName = e.target.value;
            recalculateInvoice();
        });
    }

    const statusSelect = document.getElementById('iv-ed-status');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            currentInvoice.status = e.target.value;
            recalculateInvoice();
        });
    }

    // Financial adjustment inputs
    const discInput = document.getElementById('iv-ed-discount');
    if (discInput) {
        discInput.addEventListener('input', (e) => {
            currentInvoice.discountPercent = Number(e.target.value) || 0;
            recalculateInvoice();
        });
    }

    const taxInput = document.getElementById('iv-ed-tax');
    if (taxInput) {
        taxInput.addEventListener('input', (e) => {
            currentInvoice.taxPercent = Number(e.target.value) || 0;
            recalculateInvoice();
        });
    }

    const shipInput = document.getElementById('iv-ed-shipping');
    if (shipInput) {
        shipInput.addEventListener('input', (e) => {
            currentInvoice.shippingCost = Number(e.target.value) || 0;
            recalculateInvoice();
        });
    }

    // Item rows inputs
    document.querySelectorAll('#iv-maker-items-tbody tr').forEach(row => {
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        if (isNaN(idx) || !currentInvoice.items[idx]) return;

        const nameIn = row.querySelector('.iv-maker-item-name');
        const qtyIn = row.querySelector('.iv-maker-item-qty');
        const costIn = row.querySelector('.iv-maker-item-cost');
        const priceIn = row.querySelector('.iv-maker-item-price');
        const delBtn = row.querySelector('.iv-maker-del-item');

        if (nameIn) {
            nameIn.addEventListener('input', (e) => {
                currentInvoice.items[idx].name = e.target.value;
                currentInvoice.items[idx].productName = e.target.value;
                recalculateInvoice();
            });
        }

        if (qtyIn) {
            qtyIn.addEventListener('input', (e) => {
                currentInvoice.items[idx].quantity = Number(e.target.value) || 1;
                recalculateInvoice();
            });
        }

        if (costIn) {
            costIn.addEventListener('input', (e) => {
                currentInvoice.items[idx].unitCost = Number(e.target.value) || 0;
                recalculateInvoice();
            });
        }

        if (priceIn) {
            priceIn.addEventListener('input', (e) => {
                const val = Number(e.target.value) || 0;
                currentInvoice.items[idx].unitPrice = val;
                currentInvoice.items[idx].price = val;
                currentInvoice.items[idx].sellingPrice = val;
                recalculateInvoice();
            });
        }

        if (delBtn) {
            delBtn.addEventListener('click', () => {
                currentInvoice.items.splice(idx, 1);
                recalculateInvoice();
                updateMakerEditorView();
            });
        }
    });

    // Add item button
    const addItemBtn = document.getElementById('iv-maker-add-item-btn');
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            if (!Array.isArray(currentInvoice.items)) currentInvoice.items = [];
            currentInvoice.items.push({
                name: 'New Custom Line Item',
                productName: 'New Custom Line Item',
                quantity: 1,
                unitPrice: 150,
                price: 150,
                unitCost: 80,
                totalPrice: 150
            });
            recalculateInvoice();
            updateMakerEditorView();
        });
    }
};

/**
 * Custom In-Modal Prompt Modal (Replaces native window.prompt/window.alert)
 */
const showCustomPromptModal = ({ title, placeholder, initialValue = '', onConfirm }) => {
    const existing = document.getElementById('iv-inline-prompt-modal');
    if (existing) existing.remove();

    const overlay = document.getElementById('invoice-viewer-modal-overlay');
    if (!overlay) return;

    const modal = document.createElement('div');
    modal.id = 'iv-inline-prompt-modal';
    modal.className = 'iv-inline-prompt-backdrop';
    modal.innerHTML = `
        <div class="iv-inline-prompt-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h4 style="margin:0; font-size:1rem; font-weight:800; color:#0f172a;">${escapeHtml(title)}</h4>
                <button type="button" class="btn btn-sm btn-ghost" id="iv-prompt-close-btn" style="padding:0.2rem 0.4rem; font-size:1rem;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
            </div>
            <div>
                <textarea id="iv-prompt-input" rows="3" class="form-control" style="font-size:0.85rem; width:100%; resize:vertical;" placeholder="${escapeHtml(placeholder)}">${escapeHtml(initialValue)}</textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                <button type="button" id="iv-prompt-cancel-btn" class="btn btn-secondary btn-sm" style="font-weight:600;">Cancel</button>
                <button type="button" id="iv-prompt-submit-btn" class="btn btn-primary btn-sm" style="font-weight:700;">Add to Canvas</button>
            </div>
        </div>
    `;

    overlay.appendChild(modal);

    const input = document.getElementById('iv-prompt-input');
    if (input) setTimeout(() => input.focus(), 50);

    const closePrompt = () => modal.remove();

    document.getElementById('iv-prompt-close-btn').onclick = closePrompt;
    document.getElementById('iv-prompt-cancel-btn').onclick = closePrompt;
    document.getElementById('iv-prompt-submit-btn').onclick = () => {
        const val = input.value.trim();
        if (val) {
            onConfirm(val);
            closePrompt();
        } else {
            showAlert.warning("Please enter text before submitting.");
        }
    };
};

/**
 * Setup Event Listeners in Modal (Panning, Zoom, Fullscreen, Border, Uploads, Arrow Keys)
 */
const setupViewerEvents = (onEditCallback) => {
    const overlay = document.getElementById('invoice-viewer-modal-overlay');
    const modalContent = document.getElementById('iv-modal-card');
    const closeBtn = document.getElementById('iv-modal-close-btn');
    const btnDownloadTop = document.getElementById('iv-btn-download-pdf');
    const btnDownloadBottom = document.getElementById('iv-btn-download-bottom');
    const btnPrint = document.getElementById('iv-btn-print-action');
    const btnShareWhatsApp = document.getElementById('iv-btn-share-whatsapp');
    const btnEdit = document.getElementById('iv-btn-edit-invoice');
    const btnFullscreen = document.getElementById('iv-btn-fullscreen-toggle');
    const scrollContainer = document.getElementById('iv-paper-scroll-container');

    // Popstate Listener (Browser Back button closes panel screen only)
    popstateHandler = (e) => {
        closeViewerModal(false);
    };
    window.addEventListener('popstate', popstateHandler);

    // Close Button & Backdrop
    if (closeBtn) closeBtn.addEventListener('click', () => closeViewerModal(true));
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeViewerModal(true);
        });
    }

    // Escape Key Listener & Arrow Keys Vector Repositioning
    const onKeyDown = (e) => {
        if (e.key === 'Escape') {
            window.removeEventListener('keydown', onKeyDown);
            closeViewerModal(true);
            return;
        }

        // Arrow Keys for Vector Repositioning of Selected Floating Element
        if (selectedFloatingElId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            const targetEl = currentOptions.elements.floatingElements.find(i => i.id === selectedFloatingElId);
            if (targetEl) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp') targetEl.y = Math.max(0, targetEl.y - step);
                if (e.key === 'ArrowDown') targetEl.y += step;
                if (e.key === 'ArrowLeft') targetEl.x = Math.max(0, targetEl.x - step);
                if (e.key === 'ArrowRight') targetEl.x += step;

                const node = document.querySelector(`[data-el-id="${targetEl.id}"]`);
                if (node) {
                    node.style.left = `${targetEl.x}px`;
                    node.style.top = `${targetEl.y}px`;
                }
                const posXIn = document.getElementById('iv-el-pos-x');
                const posYIn = document.getElementById('iv-el-pos-y');
                if (posXIn) posXIn.value = targetEl.x;
                if (posYIn) posYIn.value = targetEl.y;
                saveViewerSession();
                triggerLivePdfSync(100);
            }
        }
    };
    window.addEventListener('keydown', onKeyDown);

    // =========================================================================
    // RIGHT-CLICK HOLD TO PAN CONTENT (HAND WORK)
    // =========================================================================
    if (scrollContainer) {
        let isRightClickPanning = false;
        let panStartX = 0;
        let panStartY = 0;
        let scrollStartX = 0;
        let scrollStartY = 0;

        scrollContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent browser context menu during canvas panning
        });

        scrollContainer.addEventListener('mousedown', (e) => {
            if (e.button === 2) { // Right mouse click
                e.preventDefault();
                isRightClickPanning = true;
                panStartX = e.clientX;
                panStartY = e.clientY;
                scrollStartX = scrollContainer.scrollLeft;
                scrollStartY = scrollContainer.scrollTop;
                scrollContainer.style.cursor = 'grabbing';
                scrollContainer.style.userSelect = 'none';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isRightClickPanning) {
                e.preventDefault();
                const dx = e.clientX - panStartX;
                const dy = e.clientY - panStartY;
                scrollContainer.scrollLeft = scrollStartX - dx;
                scrollContainer.scrollTop = scrollStartY - dy;
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (isRightClickPanning && e.button === 2) {
                isRightClickPanning = false;
                scrollContainer.style.cursor = '';
                scrollContainer.style.userSelect = '';
            }
        });

        // =========================================================================
        // ALT + MOUSE SCROLL (+ / -) TO ZOOM CANVAS
        // =========================================================================
        scrollContainer.addEventListener('wheel', (e) => {
            if (e.altKey) {
                e.preventDefault();
                let currentPct = Math.round(currentOptions.zoomLevel * 100);
                if (e.deltaY < 0) {
                    currentPct = Math.min(180, currentPct + 5);
                } else {
                    currentPct = Math.max(40, currentPct - 5);
                }
                setZoom(currentPct);
                const zoomSlider = document.getElementById('iv-zoom-slider');
                if (zoomSlider) zoomSlider.value = currentPct;
            }
        }, { passive: false });
    }

    // Fullscreen / Compact Panel Toggle with Distinct Icons & LocalStorage Memory
    if (btnFullscreen && modalContent) {
        btnFullscreen.addEventListener('click', () => {
            currentOptions.isFullscreen = !currentOptions.isFullscreen;
            try {
                localStorage.setItem('iv_dialog_fullscreen', currentOptions.isFullscreen ? 'true' : 'false');
            } catch (e) {}

            if (currentOptions.isFullscreen) {
                modalContent.classList.add('is-fullscreen');
                overlay.classList.add('is-fullscreen');
                btnFullscreen.title = 'Compact Window View';
                btnFullscreen.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" id="iv-fullscreen-icon"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
                `;
            } else {
                modalContent.classList.remove('is-fullscreen');
                overlay.classList.remove('is-fullscreen');
                btnFullscreen.title = 'Expand to Fullscreen Panel';
                btnFullscreen.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" id="iv-fullscreen-icon"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                `;
            }
            saveViewerSession();
        });
    }

    // Zoom Slider & Controls
    const zoomSlider = document.getElementById('iv-zoom-slider');
    const zoomDisplay = document.getElementById('iv-zoom-display');
    const zoomWrapper = document.getElementById('iv-paper-zoom-wrapper');
    const btnZoomReset = document.getElementById('iv-btn-zoom-reset');

    const setZoom = (val) => {
        const factor = Number(val) / 100;
        currentOptions.zoomLevel = factor;
        if (zoomDisplay) zoomDisplay.textContent = `${val}%`;
        if (zoomWrapper) zoomWrapper.style.transform = `scale(${factor})`;
        saveViewerSession();
    };

    if (zoomSlider) zoomSlider.addEventListener('input', (e) => setZoom(e.target.value));
    if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
            if (zoomSlider) zoomSlider.value = '100';
            setZoom(100);
        });
    }

    // Layout Size Preset Buttons
    document.querySelectorAll('.iv-size-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.iv-size-preset-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');

            const sizePreset = btn.getAttribute('data-size') || 'BUSINESS_A4';
            currentOptions.sizePreset = sizePreset;
            currentOptions.activePage = 1;

            const customSizeBox = document.getElementById('iv-custom-size-box');
            if (customSizeBox) {
                customSizeBox.style.display = sizePreset === 'CUSTOM' ? 'block' : 'none';
            }

            saveViewerSession();
            updateVisualPreview();
            updatePdfIframeIfActive();
        });
    });

    // Custom Size Inputs (Width & Height)
    const customWIn = document.getElementById('iv-custom-w-input');
    const customHIn = document.getElementById('iv-custom-h-input');
    if (customWIn) {
        customWIn.addEventListener('input', (e) => {
            currentOptions.customWidth = Number(e.target.value) || 800;
            applyBorderStyles();
            saveViewerSession();
            triggerLivePdfSync(180);
        });
    }
    if (customHIn) {
        customHIn.addEventListener('input', (e) => {
            currentOptions.customHeight = Number(e.target.value) || 1100;
            applyBorderStyles();
            saveViewerSession();
            triggerLivePdfSync(180);
        });
    }

    // Professional Corporate Style Themes (1-Click Color & Header Palettes)
    document.querySelectorAll('.iv-theme-palette-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.iv-theme-palette-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const themeId = btn.getAttribute('data-theme-id');
            const themeColor = btn.getAttribute('data-theme-color');
            currentOptions.themeId = themeId;
            currentOptions.themeColor = themeColor;
            
            // If border is currently enabled, sync border color to corporate theme color
            if (currentOptions.border.enabled) {
                currentOptions.border.color = themeColor;
                const bPicker = document.getElementById('iv-border-color-picker');
                const bHex = document.getElementById('iv-border-color-hex');
                if (bPicker) bPicker.value = themeColor;
                if (bHex) bHex.value = themeColor;
            }

            applyBorderStyles();
            updateVisualPreview();
            saveViewerSession();
            triggerLivePdfSync(120);
        });
    });

    // =========================================================================
    // CANVAS STYLE: PAPER BACKGROUND, SHADOW ELEVATION & WORKSPACE BACKDROP
    // =========================================================================
    const paperBgPicker = document.getElementById('iv-paper-bg-picker');
    const paperBgHex = document.getElementById('iv-paper-bg-hex');
    const setPaperBackground = (color) => {
        if (!currentOptions.canvasStyle) currentOptions.canvasStyle = {};
        currentOptions.canvasStyle.background = color;
        if (paperBgPicker) paperBgPicker.value = color;
        if (paperBgHex) paperBgHex.value = color;
        document.querySelectorAll('.iv-canvas-bg-swatch').forEach(sw => {
            sw.classList.toggle('active', sw.getAttribute('data-bg') === color);
        });
        applyBorderStyles();
        saveViewerSession();
        triggerLivePdfSync(150);
    };

    if (paperBgPicker) paperBgPicker.addEventListener('input', (e) => setPaperBackground(e.target.value));
    if (paperBgHex) {
        paperBgHex.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) setPaperBackground(val);
        });
    }

    document.querySelectorAll('.iv-canvas-bg-swatch').forEach(sw => {
        sw.addEventListener('click', () => {
            const bg = sw.getAttribute('data-bg');
            if (bg) setPaperBackground(bg);
        });
    });

    // Paper Elevation / Shadow Buttons
    document.querySelectorAll('.iv-canvas-shadow-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.iv-canvas-shadow-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            if (!currentOptions.canvasStyle) currentOptions.canvasStyle = {};
            currentOptions.canvasStyle.shadow = btn.getAttribute('data-shadow') || 'studio';
            applyBorderStyles();
            saveViewerSession();
        });
    });

    // Workspace Backdrop Buttons
    document.querySelectorAll('.iv-workspace-bg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.iv-workspace-bg-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            if (!currentOptions.canvasStyle) currentOptions.canvasStyle = {};
            currentOptions.canvasStyle.workspaceBg = btn.getAttribute('data-ws') || 'studio_dots';
            applyBorderStyles();
            saveViewerSession();
        });
    });

    // Canvas Border ON / OFF Toggle
    const toggleBorder = document.getElementById('iv-toggle-border');
    const borderControlsBox = document.getElementById('iv-border-controls-box');
    if (toggleBorder) {
        toggleBorder.addEventListener('change', () => {
            currentOptions.border.enabled = toggleBorder.checked;
            if (borderControlsBox) borderControlsBox.style.display = toggleBorder.checked ? 'flex' : 'none';
            applyBorderStyles();
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Border Color Customizer (Picker & Hex Input)
    const borderColorPicker = document.getElementById('iv-border-color-picker');
    const borderColorHex = document.getElementById('iv-border-color-hex');
    const setBorderColor = (color) => {
        currentOptions.border.color = color;
        if (borderColorPicker) borderColorPicker.value = color;
        if (borderColorHex) borderColorHex.value = color;
        applyBorderStyles();
        updateVisualPreview();
        saveViewerSession();
    };

    if (borderColorPicker) {
        borderColorPicker.addEventListener('input', (e) => setBorderColor(e.target.value));
    }
    if (borderColorHex) {
        borderColorHex.addEventListener('input', (e) => {
            const val = e.target.value.trim();
            if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                setBorderColor(val);
            }
        });
    }

    document.querySelectorAll('.iv-color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const c = swatch.getAttribute('data-color');
            if (c) setBorderColor(c);
        });
    });

    // Border Width & Radius Sliders
    const borderWidthSlider = document.getElementById('iv-border-width-slider');
    const borderWidthVal = document.getElementById('iv-border-width-val');
    if (borderWidthSlider) {
        borderWidthSlider.addEventListener('input', (e) => {
            currentOptions.border.width = Number(e.target.value);
            if (borderWidthVal) borderWidthVal.textContent = `${e.target.value}px`;
            applyBorderStyles();
            saveViewerSession();
            triggerLivePdfSync(150);
        });
    }

    const borderRadiusSlider = document.getElementById('iv-border-radius-slider');
    const borderRadiusVal = document.getElementById('iv-border-radius-val');
    if (borderRadiusSlider) {
        borderRadiusSlider.addEventListener('input', (e) => {
            currentOptions.border.radius = Number(e.target.value);
            if (borderRadiusVal) borderRadiusVal.textContent = `${e.target.value}px`;
            applyBorderStyles();
            saveViewerSession();
            triggerLivePdfSync(150);
        });
    }

    // Border Style Buttons
    document.querySelectorAll('.iv-border-style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.iv-border-style-btn').forEach(b => {
                b.classList.remove('btn-primary');
                b.classList.add('btn-secondary');
            });
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            currentOptions.border.style = btn.getAttribute('data-style') || 'solid';
            applyBorderStyles();
            saveViewerSession();
            triggerLivePdfSync(80);
        });
    });

    // =========================================================================
    // OFFICIAL DIGITAL SIGNATURE: FONTS, DRAW PAD & DRIVE UPLOAD
    // =========================================================================
    const toggleSig = document.getElementById('iv-toggle-signature');
    const sigSettings = document.getElementById('iv-signature-settings');
    const sigNameIn = document.getElementById('iv-sig-name-input');
    const sigSubNameIn = document.getElementById('iv-sig-subname-input');
    const sigTitleIn = document.getElementById('iv-sig-title-input');
    const sigDateIn = document.getElementById('iv-sig-date-input');
    const sigModeTabs = document.querySelectorAll('.iv-sig-mode-tab');
    const sigPanelFont = document.getElementById('iv-sig-panel-font');
    const sigPanelDraw = document.getElementById('iv-sig-panel-draw');
    const sigPanelUpload = document.getElementById('iv-sig-panel-upload');
    const sigFontSelect = document.getElementById('iv-sig-font-select');
    const btnAddCustomFont = document.getElementById('iv-btn-add-custom-font');
    const btnDeleteFont = document.getElementById('iv-btn-delete-font');
    const sigFontPreviewCard = document.getElementById('iv-sig-font-preview-card');
    const btnUploadSigFile = document.getElementById('iv-btn-upload-sig-file');
    const sigFileInput = document.getElementById('iv-sig-file-input');
    const sigUploadPreview = document.getElementById('iv-sig-upload-preview');
    const sigUploadThumb = document.getElementById('iv-sig-upload-thumb');

    // Drawing Pad references
    const drawCanvas = document.getElementById('iv-sig-draw-canvas');
    const btnDrawUndo = document.getElementById('iv-btn-draw-undo');
    const btnDrawClear = document.getElementById('iv-btn-draw-clear');
    const btnApplyDraw = document.getElementById('iv-btn-apply-draw');
    const inkButtons = document.querySelectorAll('.iv-draw-ink-btn');
    let sigPad = null;

    if (drawCanvas) {
        sigPad = new SignatureDrawingPad(drawCanvas);
    }

    // Populate Font Dropdown Helper
    const refreshFontDropdown = (targetFontId = null) => {
        if (!sigFontSelect) return;
        const allFonts = getAllSignatureFonts();
        const activeId = targetFontId || currentOptions.elements.signature.fontId || 'default_cursive';
        
        const cursiveGroup = allFonts.filter(f => f.category === 'cursive' && !f.id.startsWith('font_'));
        const boldGroup = allFonts.filter(f => f.category === 'bold' && !f.id.startsWith('font_'));
        const customGroup = allFonts.filter(f => f.id.startsWith('font_'));

        let html = `
            <optgroup label="Cursive Scripts (4)">
                ${cursiveGroup.map(f => `<option value="${f.id}" ${f.id === activeId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
            </optgroup>
            <optgroup label="Normal BOLD Styles (3)">
                ${boldGroup.map(f => `<option value="${f.id}" ${f.id === activeId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
            </optgroup>
        `;

        if (customGroup.length > 0) {
            html += `
                <optgroup label="Custom User Fonts (Saved)">
                    ${customGroup.map(f => `<option value="${f.id}" ${f.id === activeId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('')}
                </optgroup>
            `;
        }

        sigFontSelect.innerHTML = html;
        updateFontPreviewCard(activeId);

        // Show/hide delete button for custom fonts
        if (btnDeleteFont) {
            btnDeleteFont.style.display = activeId.startsWith('font_') ? 'inline-block' : 'none';
        }
    };

    // Update Live Font Preview Card
    const updateFontPreviewCard = (fontId) => {
        if (!sigFontPreviewCard) return;
        const allFonts = getAllSignatureFonts();
        const font = allFonts.find(f => f.id === fontId) || allFonts[0];
        const signerText = currentOptions.elements.signature.signerName || 'Authorized Signatory';
        
        injectCustomFontStylesheet(font.name, font.url);
        sigFontPreviewCard.style.fontFamily = font.fontFamily;
        sigFontPreviewCard.style.fontWeight = font.isBold ? 800 : 400;
        sigFontPreviewCard.style.fontSize = font.isBold ? '1.15rem' : '1.65rem';
        sigFontPreviewCard.style.color = '#0f172a';
        sigFontPreviewCard.style.letterSpacing = font.isBold ? '0.04em' : 'normal';
        sigFontPreviewCard.textContent = font.isBold ? signerText.toUpperCase() : signerText;
    };

    // Initialize Font Dropdown
    refreshFontDropdown(currentOptions.elements.signature.fontId);

    // Font Select Change Handler
    if (sigFontSelect) {
        sigFontSelect.addEventListener('change', () => {
            const fontId = sigFontSelect.value;
            const allFonts = getAllSignatureFonts();
            const font = allFonts.find(f => f.id === fontId);
            if (font) {
                currentOptions.elements.signature.type = 'font';
                currentOptions.elements.signature.fontId = font.id;
                currentOptions.elements.signature.fontFamily = font.fontFamily;
                currentOptions.elements.signature.isBold = font.isBold;
                currentOptions.elements.signature.dataUrl = null;
                currentOptions.elements.signature.enabled = true;
                if (toggleSig) toggleSig.checked = true;
                if (sigSettings) sigSettings.style.display = 'flex';
                
                updateFontPreviewCard(font.id);
                if (btnDeleteFont) {
                    btnDeleteFont.style.display = font.id.startsWith('font_') ? 'inline-block' : 'none';
                }

                updateVisualPreview();
                saveViewerSession();
            }
        });
    }

    // Mode Switcher Tabs
    sigModeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sigModeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.getAttribute('data-mode'); // 'font' | 'draw' | 'upload'
            
            if (sigPanelFont) sigPanelFont.style.display = mode === 'font' ? 'flex' : 'none';
            if (sigPanelDraw) sigPanelDraw.style.display = mode === 'draw' ? 'flex' : 'none';
            if (sigPanelUpload) sigPanelUpload.style.display = mode === 'upload' ? 'flex' : 'none';

            if (mode === 'font') {
                currentOptions.elements.signature.type = 'font';
                currentOptions.elements.signature.dataUrl = null;
                currentOptions.elements.signature.enabled = true;
                if (toggleSig) toggleSig.checked = true;
                updateVisualPreview();
                saveViewerSession();
            } else if (mode === 'draw' && sigPad) {
                setTimeout(() => {
                    sigPad.initCanvasSize();
                    sigPad.redraw();
                }, 40);
            }
        });
    });

    // Add Custom Font Dialog Trigger
    if (btnAddCustomFont) {
        btnAddCustomFont.addEventListener('click', () => {
            showAddCustomFontModal((newFont) => {
                currentOptions.elements.signature.type = 'font';
                currentOptions.elements.signature.fontId = newFont.id;
                currentOptions.elements.signature.fontFamily = newFont.fontFamily;
                currentOptions.elements.signature.isBold = newFont.isBold;
                currentOptions.elements.signature.dataUrl = null;
                currentOptions.elements.signature.enabled = true;
                if (toggleSig) toggleSig.checked = true;

                refreshFontDropdown(newFont.id);
                updateVisualPreview();
                saveViewerSession();
            });
        });
    }

    // Delete Custom Font Trigger
    if (btnDeleteFont) {
        btnDeleteFont.addEventListener('click', async () => {
            const fontId = sigFontSelect ? sigFontSelect.value : null;
            if (!fontId || !fontId.startsWith('font_')) return;

            const allFonts = getAllSignatureFonts();
            const font = allFonts.find(f => f.id === fontId);
            const confirmed = await showAlert.confirm(`Are you sure you want to remove the custom font "${font ? font.name : ''}"?`);
            if (confirmed) {
                await deleteCustomFont(fontId);
                showAlert.success("Custom font removed successfully.");
                currentOptions.elements.signature.fontId = 'default_cursive';
                currentOptions.elements.signature.fontFamily = "'Dancing Script', 'Brush Script MT', cursive";
                currentOptions.elements.signature.isBold = false;
                refreshFontDropdown('default_cursive');
                updateVisualPreview();
                saveViewerSession();
            }
        });
    }

    // Toggle Signature Enabled Checkbox
    if (toggleSig) {
        toggleSig.addEventListener('change', () => {
            currentOptions.elements.signature.enabled = toggleSig.checked;
            if (sigSettings) sigSettings.style.display = toggleSig.checked ? 'flex' : 'none';
            if (toggleSig.checked && currentOptions.elements.signature.type === 'draw' && sigPad) {
                setTimeout(() => {
                    sigPad.initCanvasSize();
                    sigPad.redraw();
                }, 40);
            }
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Signer Name Input (Script / Cursive text)
    if (sigNameIn) {
        sigNameIn.addEventListener('input', (e) => {
            currentOptions.elements.signature.signerName = e.target.value;
            updateFontPreviewCard(currentOptions.elements.signature.fontId);
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Signer Sub Name Input (Printed directly underneath signature line)
    if (sigSubNameIn) {
        sigSubNameIn.addEventListener('input', (e) => {
            currentOptions.elements.signature.signerSubName = e.target.value;
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Signer Title Input (Designation)
    if (sigTitleIn) {
        sigTitleIn.addEventListener('input', (e) => {
            currentOptions.elements.signature.signerTitle = e.target.value;
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Signed Date Input
    if (sigDateIn) {
        sigDateIn.addEventListener('input', (e) => {
            currentOptions.elements.signature.date = e.target.value;
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Drawing Pad Ink Color Selection
    inkButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            inkButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.getAttribute('data-color') || '#0f172a';
            if (sigPad) sigPad.setColor(color);
        });
    });

    // Drawing Pad Undo & Clear
    if (btnDrawUndo && sigPad) {
        btnDrawUndo.addEventListener('click', () => sigPad.undo());
    }

    if (btnDrawClear && sigPad) {
        btnDrawClear.addEventListener('click', () => sigPad.clear());
    }

    // Apply Drawn Signature
    if (btnApplyDraw && sigPad) {
        btnApplyDraw.addEventListener('click', () => {
            if (sigPad.isEmpty()) {
                showAlert.warning("Please draw your signature on the pad before applying.");
                return;
            }

            const dataUrl = sigPad.toDataURL();
            currentOptions.elements.signature.dataUrl = dataUrl;
            currentOptions.elements.signature.type = 'draw';
            currentOptions.elements.signature.enabled = true;
            if (toggleSig) toggleSig.checked = true;
            if (sigSettings) sigSettings.style.display = 'flex';

            updateVisualPreview();
            saveViewerSession();
            showAlert.success("Hand-drawn signature applied to invoice!");
        });
    }

    // Drive File Upload
    if (btnUploadSigFile && sigFileInput) {
        btnUploadSigFile.addEventListener('click', () => sigFileInput.click());
        sigFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                currentOptions.elements.signature.dataUrl = evt.target.result;
                currentOptions.elements.signature.type = 'upload';
                currentOptions.elements.signature.enabled = true;
                if (toggleSig) toggleSig.checked = true;
                if (sigSettings) sigSettings.style.display = 'flex';
                
                if (sigUploadPreview && sigUploadThumb) {
                    sigUploadThumb.src = evt.target.result;
                    sigUploadPreview.style.display = 'block';
                }

                updateVisualPreview();
                saveViewerSession();
                showAlert.success("Digital signature image uploaded from drive!");
            };
            reader.readAsDataURL(file);
        });
    }

    // =========================================================================
    // CUSTOMIZABLE CORPORATE STAMP / SEAL TEXT & COLOR
    // =========================================================================
    const toggleStamp = document.getElementById('iv-toggle-stamp');
    const stampSettings = document.getElementById('iv-stamp-settings');
    const stampTextInput = document.getElementById('iv-stamp-custom-text-input');

    if (toggleStamp) {
        toggleStamp.addEventListener('change', () => {
            currentOptions.elements.stamp.enabled = toggleStamp.checked;
            if (stampSettings) stampSettings.style.display = toggleStamp.checked ? 'flex' : 'none';
            updateVisualPreview();
            saveViewerSession();
        });
    }

    if (stampTextInput) {
        stampTextInput.addEventListener('input', (e) => {
            currentOptions.elements.stamp.customText = e.target.value;
            updateVisualPreview();
            saveViewerSession();
        });
    }

    document.querySelectorAll('.iv-stamp-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const col = btn.getAttribute('data-color');
            currentOptions.elements.stamp.color = col;
            updateVisualPreview();
            saveViewerSession();
        });
    });

    document.querySelectorAll('.iv-stamp-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const txt = btn.getAttribute('data-text');
            const col = btn.getAttribute('data-col');
            currentOptions.elements.stamp.customText = txt;
            currentOptions.elements.stamp.color = col;
            if (stampTextInput) stampTextInput.value = txt;
            updateVisualPreview();
            saveViewerSession();
        });
    });

    // =========================================================================
    // ADD FLOATING PHOTO & DRAGGABLE TEXT ELEMENTS (IN-MODAL DIALOG)
    // =========================================================================
    const btnAddPhoto = document.getElementById('iv-btn-add-floating-photo');
    const photoFileInput = document.getElementById('iv-photo-element-input');
    if (btnAddPhoto && photoFileInput) {
        btnAddPhoto.addEventListener('click', () => photoFileInput.click());
        photoFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                const newPhotoEl = {
                    id: 'photo_' + Date.now(),
                    type: 'photo',
                    src: evt.target.result,
                    x: 60,
                    y: 180,
                    width: 140
                };
                currentOptions.elements.floatingElements.push(newPhotoEl);
                selectedFloatingElId = newPhotoEl.id;
                updateVisualPreview();
                saveViewerSession();
                showAlert.success("Photo element added to canvas! Drag to position.");
            };
            reader.readAsDataURL(file);
        });
    }

    const btnAddText = document.getElementById('iv-btn-add-custom-text');
    if (btnAddText) {
        btnAddText.addEventListener('click', () => {
            showCustomPromptModal({
                title: "Add Custom Text / Banner",
                placeholder: "Enter custom text (e.g. Special Notice, Bank Transfer Instructions, QC Verification)",
                initialValue: "",
                onConfirm: (text) => {
                    const newTextEl = {
                        id: 'text_' + Date.now(),
                        type: 'text',
                        text: text,
                        x: 60,
                        y: 240,
                        fontSize: 13,
                        color: '#0f172a'
                    };
                    currentOptions.elements.floatingElements.push(newTextEl);
                    selectedFloatingElId = newTextEl.id;
                    updateVisualPreview();
                    saveViewerSession();
                    showAlert.success("Text banner added to canvas! Drag or use arrow keys.");
                }
            });
        });
    }

    // Toggle Enable Data Changes
    const toggleDataChanges = document.getElementById('iv-toggle-data-changes');
    if (toggleDataChanges) {
        toggleDataChanges.addEventListener('change', () => {
            currentOptions.enableDataChanges = toggleDataChanges.checked;
            updateVisualPreview();
            saveViewerSession();
            if (toggleDataChanges.checked) {
                showAlert.info("Data changes enabled. Live fields can be edited in Invoice Maker Editor tab.");
            }
        });
    }

    // Branding Radio Selection
    document.querySelectorAll('input[name="iv-branding-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            currentOptions.brandingMode = radio.value;
            const customBox = document.getElementById('iv-custom-branding-inputs');
            if (customBox) {
                customBox.style.display = radio.value === 'CUSTOM' ? 'flex' : 'none';
            }
            updateVisualPreview();
            updatePdfIframeIfActive();
            saveViewerSession();
        });
    });

    // Custom Branding Inputs live sync
    const bindInput = (id, key) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                currentOptions.customBranding[key] = e.target.value;
                updateVisualPreview();
                saveViewerSession();
            });
        }
    };
    bindInput('iv-custom-title', 'title');
    bindInput('iv-custom-subtitle', 'subtitle');
    bindInput('iv-custom-phone', 'phone');
    bindInput('iv-custom-email', 'email');
    bindInput('iv-custom-address', 'address');

    // Notes Input (Omitted if empty)
    const notesEl = document.getElementById('iv-custom-notes');
    if (notesEl) {
        notesEl.addEventListener('input', (e) => {
            currentOptions.customBranding.notes = e.target.value;
            currentInvoice.notes = e.target.value;
            updateVisualPreview();
            saveViewerSession();
        });
    }

    // Terms & Conditions Input (Omitted if empty)
    const termsEl = document.getElementById('iv-custom-terms');
    if (termsEl) {
        termsEl.addEventListener('input', (e) => {
            currentOptions.customBranding.termsAndConditions = e.target.value;
            updateVisualPreview();
            saveViewerSession();
            triggerLivePdfSync(150);
        });
    }

    // Toggle Show Billed From (Supplier) on/off (Default: ON)
    const toggleShowFrom = document.getElementById('iv-toggle-show-from');
    if (toggleShowFrom) {
        toggleShowFrom.addEventListener('change', () => {
            currentOptions.showBilledFrom = toggleShowFrom.checked;
            const statusEl = document.getElementById('iv-show-from-status');
            if (statusEl) {
                statusEl.textContent = toggleShowFrom.checked ? 'Shown' : 'Hidden';
                statusEl.style.color = toggleShowFrom.checked ? '#059669' : '#64748b';
            }
            updateVisualPreview();
            updatePdfIframeIfActive();
            saveViewerSession();
        });
    }

    // Switch Sidebar Position (Left / Right, Default: Right)
    const btnShiftSidebar = document.getElementById('iv-btn-shift-sidebar');
    if (btnShiftSidebar) {
        btnShiftSidebar.addEventListener('click', () => {
            const newPos = (currentOptions.sidebarPosition === 'right') ? 'left' : 'right';
            currentOptions.sidebarPosition = newPos;
            try {
                localStorage.setItem('iv_sidebar_position', newPos);
            } catch (e) {}

            const grid = document.getElementById('iv-modal-grid');
            if (grid) {
                grid.style.opacity = '0.35';
                setTimeout(() => {
                    grid.classList.remove('sidebar-left', 'sidebar-right');
                    grid.classList.add(`sidebar-${newPos}`);
                    grid.style.opacity = '1';
                    const label = document.getElementById('iv-sidebar-pos-label');
                    if (label) label.textContent = newPos === 'right' ? 'Sidebar: Right' : 'Sidebar: Left';
                }, 70);
            }
        });
    }

    // Draggable Splitter Handle between Visual Canvas & Sidebar
    const splitter = document.getElementById('iv-splitter-handle');
    const modalGrid = document.getElementById('iv-modal-grid');
    if (splitter && modalGrid) {
        let isDraggingSplitter = false;
        let startMouseX = 0;
        let startWidth = 380;

        const onMouseMove = (e) => {
            if (!isDraggingSplitter) return;
            const deltaX = e.clientX - startMouseX;
            let newWidth;
            if (currentOptions.sidebarPosition === 'left') {
                newWidth = startWidth + deltaX;
            } else {
                newWidth = startWidth - deltaX;
            }
            newWidth = Math.max(280, Math.min(580, Math.round(newWidth)));
            currentOptions.sidebarWidth = newWidth;
            modalGrid.style.setProperty('--iv-sidebar-width', `${newWidth}px`);
        };

        const onMouseUp = () => {
            if (!isDraggingSplitter) return;
            isDraggingSplitter = false;
            splitter.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            try {
                localStorage.setItem('iv_sidebar_width', String(currentOptions.sidebarWidth));
            } catch (e) {}
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDraggingSplitter = true;
            splitter.classList.add('is-dragging');
            startMouseX = e.clientX;
            startWidth = currentOptions.sidebarWidth || 380;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // WhatsApp Sharing Handler (Without Powered by Invoice Maker tag)
    if (btnShareWhatsApp) {
        btnShareWhatsApp.addEventListener('click', () => {
            const clientName = currentInvoice.customerName || currentInvoice.clientName || 'Valued Customer';
            const invNumber = currentInvoice.busInvNumber || currentInvoice.invoiceNumber || 'INV';
            const total = formatCurrency(currentInvoice.totalPrice || currentInvoice.grandTotal || 0, currentOptions.currencySymbol);
            const msg = `Hello ${clientName}, here are the details for your Invoice #${invNumber}. Grand Total: ${total}. Thank you for your business!`;
            const phone = (currentInvoice.customerNumber || currentInvoice.clientPhone || '').replace(/[^0-9]/g, '');
            const waUrl = phone 
                ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
                : `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    // Download PDF Action
    const handleDownload = async () => {
        try {
            showAlert.info("Downloading high-resolution vector PDF...");
            if (currentLivePdfBlob) {
                const filename = `Invoice_${currentInvoice.busInvNumber || currentInvoice.invoiceNumber || currentInvoice.id || 'INV'}.pdf`;
                const link = document.createElement('a');
                link.href = URL.createObjectURL(currentLivePdfBlob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(link.href), 1500);
                showAlert.success("Invoice PDF downloaded successfully!");
                return;
            }
            await downloadInvoicePdf(currentInvoice, {
                ...currentOptions,
                showBilledFrom: currentOptions.showBilledFrom !== false,
                borderColor: currentOptions.border.enabled ? currentOptions.border.color : (currentOptions.themeColor || '#18181B')
            });
            showAlert.success("Invoice PDF downloaded successfully!");
        } catch (err) {
            console.error("PDF generation failed:", err);
            showAlert.error("Failed to generate PDF. Please try again.");
        }
    };

    if (btnDownloadTop) btnDownloadTop.addEventListener('click', handleDownload);
    if (btnDownloadBottom) btnDownloadBottom.addEventListener('click', handleDownload);

    // Print Action
    if (btnPrint) {
        btnPrint.addEventListener('click', async () => {
            try {
                await printInvoicePdf(currentInvoice, {
                    ...currentOptions,
                    showBilledFrom: currentOptions.showBilledFrom !== false,
                    borderColor: currentOptions.border.enabled ? currentOptions.border.color : (currentOptions.themeColor || '#18181B')
                });
            } catch (err) {
                console.error("Print failed:", err);
                showAlert.error("Failed to print invoice.");
            }
        });
    }

    // Edit in Full Form Action
    if (btnEdit && onEditCallback) {
        btnEdit.addEventListener('click', () => {
            closeViewerModal(true);
            onEditCallback(currentInvoice);
        });
    }

    // View Navigation Tabs
    const tabVisual = document.getElementById('iv-tab-visual');
    const tabPerf = document.getElementById('iv-tab-perf');
    const tabMaker = document.getElementById('iv-tab-maker');
    const tabPdf = document.getElementById('iv-tab-pdf');
    const pagesWrapper = document.getElementById('iv-paper-zoom-wrapper');
    const perfSheet = document.getElementById('iv-perf-sheet');
    const makerSheet = document.getElementById('iv-maker-editor-sheet');
    const pdfFrame = document.getElementById('iv-pdf-iframe');

    const switchTab = (activeTabEl) => {
        [tabVisual, tabPerf, tabMaker, tabPdf].forEach(t => t?.classList.remove('active'));
        activeTabEl.classList.add('active');
        if (pagesWrapper) {
            pagesWrapper.style.display = 'none';
            pagesWrapper.classList.remove('iv-tab-hidden');
        }
        if (perfSheet) perfSheet.style.display = 'none';
        if (makerSheet) makerSheet.style.display = 'none';
        if (pdfFrame) pdfFrame.style.display = 'none';
    };

    if (tabVisual) {
        tabVisual.addEventListener('click', () => {
            switchTab(tabVisual);
            if (pagesWrapper) {
                pagesWrapper.classList.remove('iv-tab-hidden');
                pagesWrapper.style.display = 'flex';
            }
            triggerLivePdfSync(50);
        });
    }

    // Engine Mode Toggle Buttons (Vector vs Studio Canvas)
    const btnModeVector = document.getElementById('iv-btn-mode-vector');
    const btnModeCanvas = document.getElementById('iv-btn-mode-canvas');

    const updateEngineModeButtons = () => {
        const isVector = currentOptions.canvasEngineMode !== 'dom';
        if (btnModeVector) {
            btnModeVector.style.background = isVector ? '#ffffff' : 'transparent';
            btnModeVector.style.color = isVector ? '#0f172a' : '#64748b';
            btnModeVector.style.boxShadow = isVector ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
        }
        if (btnModeCanvas) {
            btnModeCanvas.style.background = !isVector ? '#ffffff' : 'transparent';
            btnModeCanvas.style.color = !isVector ? '#0f172a' : '#64748b';
            btnModeCanvas.style.boxShadow = !isVector ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
        }
    };

    if (btnModeVector) {
        btnModeVector.addEventListener('click', () => {
            currentOptions.canvasEngineMode = 'vector';
            try { localStorage.setItem('iv_canvas_engine_mode', 'vector'); } catch(e){}
            updateEngineModeButtons();
            updateVisualPreview();
            triggerLivePdfSync(30);
        });
    }

    if (btnModeCanvas) {
        btnModeCanvas.addEventListener('click', () => {
            currentOptions.canvasEngineMode = 'dom';
            try { localStorage.setItem('iv_canvas_engine_mode', 'dom'); } catch(e){}
            updateEngineModeButtons();
            updateVisualPreview();
        });
    }

    if (tabPerf) {
        tabPerf.addEventListener('click', () => {
            switchTab(tabPerf);
            updatePerformanceView();
            if (perfSheet) perfSheet.style.display = 'block';
        });
    }

    if (tabMaker) {
        tabMaker.addEventListener('click', () => {
            switchTab(tabMaker);
            updateMakerEditorView();
            if (makerSheet) makerSheet.style.display = 'block';
        });
    }

    if (tabPdf) {
        tabPdf.addEventListener('click', async () => {
            switchTab(tabPdf);
            if (pagesWrapper) {
                pagesWrapper.classList.add('iv-tab-hidden');
                pagesWrapper.style.display = 'flex';
            }
            if (pdfFrame) {
                pdfFrame.style.display = 'block';
                await updateLivePdfIframe();
            }
        });
    }
};

/**
 * Real-time Live Vector PDF Synchronizer with Async Sequence Guard
 */
let livePdfDebounceTimer = null;
let isGeneratingLivePdf = false;
let pendingLivePdfUpdate = false;
let currentPdfBlobUrl = null;
let currentLivePdfBlob = null;
let livePdfGenerationSeq = 0;

const triggerLivePdfSync = (delay = 100) => {
    if (!currentInvoice) return;

    if (livePdfDebounceTimer) clearTimeout(livePdfDebounceTimer);
    livePdfDebounceTimer = setTimeout(() => {
        updateLivePdfIframe();
    }, delay);
};

const updateLivePdfIframe = async () => {
    if (!currentInvoice) return;

    if (isGeneratingLivePdf) {
        pendingLivePdfUpdate = true;
        return;
    }

    isGeneratingLivePdf = true;
    const requestSeq = ++livePdfGenerationSeq;

    try {
        const { blob } = await generateInvoicePdf(currentInvoice, {
            ...currentOptions,
            exportEngine: 'vector',
            showBilledFrom: currentOptions.showBilledFrom !== false,
            borderColor: currentOptions.border.enabled ? currentOptions.border.color : (currentOptions.themeColor || '#18181B')
        });

        // Guard against stale asynchronous render results
        if (requestSeq !== livePdfGenerationSeq) {
            return;
        }

        if (blob) {
            currentLivePdfBlob = blob;
            const newBlobUrl = URL.createObjectURL(blob);
            const oldBlobUrl = currentPdfBlobUrl;
            currentPdfBlobUrl = newBlobUrl;

            // Update dedicated full-tab PDF iframe
            const pdfFrame = document.getElementById('iv-pdf-iframe');
            if (pdfFrame) {
                pdfFrame.src = newBlobUrl;
            }

            // Update vector canvas iframe inside the paper sheet (holds live vector PDF preview)
            const sheetVectorFrame = document.getElementById('iv-sheet-vector-iframe');
            if (sheetVectorFrame) {
                sheetVectorFrame.src = `${newBlobUrl}#toolbar=0&navpanes=0`;
            }

            if (oldBlobUrl) {
                setTimeout(() => {
                    URL.revokeObjectURL(oldBlobUrl);
                }, 1000);
            }
        }
    } catch (err) {
        if (requestSeq === livePdfGenerationSeq) {
            console.error("Live vector PDF update error:", err);
        }
    } finally {
        isGeneratingLivePdf = false;
        if (pendingLivePdfUpdate) {
            pendingLivePdfUpdate = false;
            updateLivePdfIframe();
        }
    }
};

const updatePdfIframeIfActive = async () => {
    triggerLivePdfSync(50);
};

const formatInvoiceDateClean = (inv) => {
    const timestamp = inv.timestamp || inv.createdAt;
    if (!timestamp) return new Date().toLocaleDateString();
    let d;
    if (typeof timestamp === 'number') d = new Date(timestamp);
    else if (timestamp && typeof timestamp.toDate === 'function') d = timestamp.toDate();
    else if (typeof timestamp === 'string') d = new Date(timestamp);
    else d = new Date();
    return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
};

const escapeHtml = (str) => {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Reload Handler: If user reloads the page while viewer was open in fullscreen,
 * restore and refresh the dialog screen automatically.
 */
const checkAndRestoreViewerSession = () => {
    try {
        const saved = sessionStorage.getItem('iv_active_session');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.isOpen && parsed.invoice) {
                if (parsed.options) {
                    Object.assign(currentOptions, parsed.options);
                }
                openInvoiceViewerModal(parsed.invoice);
            }
        }
    } catch (e) {
        console.warn('Session restore check error:', e);
    }
};

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndRestoreViewerSession);
    } else {
        checkAndRestoreViewerSession();
    }
}
