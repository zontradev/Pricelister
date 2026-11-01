/**
 * PriceLister — Custom Font Manager & Critical Board
 * Advanced Browser Customization (Font Upload, Live Usability Check, UI Divider Block Positions & Layouts)
 */

import { showAlert } from '../alert-handler.js';

// Pre-defined high-quality curated Google & System Fonts (Expanded Professional Suite)
export const FONT_PRESETS = [
    { id: 'Inter', name: 'Inter', fontStack: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", category: 'Enterprise Default', webUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap' },
    { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', fontStack: "'Plus Jakarta Sans', sans-serif", category: 'Clean SaaS', webUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap' },
    { id: 'Geist', name: 'Geist', fontStack: "'Geist', -apple-system, sans-serif", category: 'Modern Engineering', webUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap' },
    { id: 'Manrope', name: 'Manrope', fontStack: "'Manrope', sans-serif", category: 'Modern Grotesque', webUrl: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap' },
    { id: 'Sora', name: 'Sora', fontStack: "'Sora', sans-serif", category: 'Fintech Precision', webUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap' },
    { id: 'DM Sans', name: 'DM Sans', fontStack: "'DM Sans', sans-serif", category: 'Geometric Minimal', webUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap' },
    { id: 'Outfit', name: 'Outfit', fontStack: "'Outfit', sans-serif", category: 'Balanced Round', webUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap' },
    { id: 'Roboto', name: 'Roboto', fontStack: "'Roboto', sans-serif", category: 'Google Classic', webUrl: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap' },
    { id: 'Space Grotesk', name: 'Space Grotesk', fontStack: "'Space Grotesk', sans-serif", category: 'Tech & Modern', webUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap' },
    { id: 'Public Sans', name: 'Public Sans', fontStack: "'Public Sans', sans-serif", category: 'Editorial Clean', webUrl: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap' },
    { id: 'JetBrains Mono', name: 'JetBrains Mono', fontStack: "'JetBrains Mono', monospace", category: 'Ledger Monospace', webUrl: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap' },
    { id: 'Fira Code', name: 'Fira Code', fontStack: "'Fira Code', monospace", category: 'Developer Monospace', webUrl: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap' }
];

/**
 * Apply Custom Font Everywhere across app.html DOM
 */
export const applyCustomFont = async (fontName, dataUrl = '', isSystem = false) => {
    try {
        if (!fontName) throw new Error("Font name is required.");

        // If it's a binary font data URL, register it in document.fonts
        if (dataUrl && dataUrl.startsWith('data:')) {
            const fontFace = new FontFace(fontName, `url(${dataUrl})`);
            await fontFace.load();
            document.fonts.add(fontFace);
        }

        // Generate dynamic CSS rule injecting everywhere
        let fontCss = '';
        if (dataUrl && dataUrl.startsWith('data:')) {
            fontCss += `@font-face { font-family: "${fontName}"; src: url("${dataUrl}"); font-display: swap; }\n`;
        }

        fontCss += `
            html, body, button, input, select, textarea, .topbar, .sidebar, .card, table, kbd, .btn, .nav-item {
                font-family: "${fontName}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
            :root {
                --font-sans: "${fontName}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
        `;

        let styleEl = document.getElementById('pricelister-custom-font-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'pricelister-custom-font-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = fontCss;

        // Persist in localStorage
        localStorage.setItem('pricelister_custom_font', JSON.stringify({
            name: fontName,
            dataUrl: dataUrl || '',
            isSystem: Boolean(isSystem),
            appliedAt: Date.now()
        }));

        window.__customFontName = fontName;
        window.dispatchEvent(new CustomEvent('pricelister-custom-font-changed', {
            detail: { fontName, dataUrl }
        }));

        return true;
    } catch (err) {
        console.error("applyCustomFont error:", err);
        throw err;
    }
};

/**
 * Reset Font to Default Inter
 */
export const resetToDefaultFont = () => {
    localStorage.removeItem('pricelister_custom_font');
    const styleEl = document.getElementById('pricelister-custom-font-style');
    if (styleEl) styleEl.remove();
    window.__customFontName = null;
    window.dispatchEvent(new CustomEvent('pricelister-custom-font-changed', {
        detail: { fontName: 'Inter', isDefault: true }
    }));
};

/**
 * Apply Custom Layout & UI Divider Block Positions
 */
export const applyCustomLayout = (layout) => {
    const config = {
        sidebarPosition: layout.sidebarPosition || 'left',
        density: layout.density || 'comfortable',
        dividerStyle: layout.dividerStyle || 'minimal',
        radius: layout.radius || '10px',
        ...layout
    };

    // 1. Sidebar Position (left, right, top, bottom)
    const validPositions = ['left', 'right', 'top', 'bottom'];
    const pos = validPositions.includes(config.sidebarPosition) ? config.sidebarPosition : 'left';
    document.documentElement.setAttribute('data-sidebar-pos', pos);

    // 2. Density
    document.documentElement.setAttribute('data-density', config.density);

    // 3. UI Divider Block Style
    document.documentElement.setAttribute('data-divider-style', config.dividerStyle);
    if (config.dividerStyle === 'accent') {
        const customBorder = localStorage.getItem('pricelister_custom_border_color') || '#D4D4D8';
        document.documentElement.style.setProperty('--border-color', customBorder);
        document.documentElement.style.setProperty('--border-subtle', customBorder);
        document.documentElement.style.setProperty('--custom-border-color', customBorder);
    }

    // 4. Radius
    if (config.radius) {
        document.documentElement.style.setProperty('--radius-card', config.radius);
    }

    localStorage.setItem('pricelister_custom_layout', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('pricelister-custom-layout-changed', { detail: config }));
    return config;
};

/**
 * Reset Custom Layout to Enterprise Defaults
 */
export const resetToDefaultLayout = () => {
    localStorage.removeItem('pricelister_custom_layout');
    document.documentElement.setAttribute('data-sidebar-pos', 'left');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.removeAttribute('data-divider-style');
    document.documentElement.style.removeProperty('--radius-card');
    window.dispatchEvent(new CustomEvent('pricelister-custom-layout-changed', { detail: { sidebarPosition: 'left' } }));
};

/**
 * Legacy Accent Helper (Default is neutral grey)
 */
export const applyCustomAccent = (color) => {
    if (!color) return;
    localStorage.setItem('pricelister_custom_accent_color', color);
    document.documentElement.style.setProperty('--primary', color);
    document.documentElement.style.setProperty('--theme-primary', color);
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--divider-accent', color);
    window.dispatchEvent(new CustomEvent('pricelister-custom-accent-changed', { detail: { color } }));
};

/**
 * Reset Custom Accent Color to Standard
 */
export const resetCustomAccent = () => {
    localStorage.removeItem('pricelister_custom_accent_color');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--theme-primary');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--divider-accent');
    window.dispatchEvent(new CustomEvent('pricelister-custom-accent-changed', { detail: { color: null } }));
};

/**
 * Initialize on app boot
 */
export const initCustomFontAndLayout = () => {
    try {
        const savedColor = localStorage.getItem('pricelister_custom_accent_color');
        if (savedColor) {
            applyCustomAccent(savedColor);
        }

        const savedBorder = localStorage.getItem('pricelister_custom_border_color');
        if (savedBorder) {
            document.documentElement.style.setProperty('--border-color', savedBorder);
            document.documentElement.style.setProperty('--border-subtle', savedBorder);
        }

        const savedFont = localStorage.getItem('pricelister_custom_font');
        if (savedFont) {
            const parsed = JSON.parse(savedFont);
            if (parsed && parsed.name) {
                applyCustomFont(parsed.name, parsed.dataUrl, parsed.isSystem).catch(e => {
                    console.warn("Could not auto-apply custom font on init:", e);
                });
            }
        }

        const savedLayout = localStorage.getItem('pricelister_custom_layout');
        if (savedLayout) {
            const lParsed = JSON.parse(savedLayout);
            if (lParsed) {
                applyCustomLayout(lParsed);
            }
        }
    } catch (e) {
        console.warn("initCustomFontAndLayout error:", e);
    }
};

/**
 * Open the Critical Board / Advanced Browser Settings Modal
 */
export const openCriticalBoardModal = (initialTab = 'font') => {
    // Current layout configuration declared upfront
    let currentLayoutConfig = {
        sidebarPosition: 'left',
        density: 'comfortable',
        dividerStyle: 'minimal',
        radius: '10px'
    };

    try {
        const savedL = localStorage.getItem('pricelister_custom_layout');
        if (savedL) currentLayoutConfig = { ...currentLayoutConfig, ...JSON.parse(savedL) };
    } catch(e) {}

    // Inject dedicated modern CSS for Critical Board
    if (!document.getElementById('critical-board-injected-styles')) {
        const style = document.createElement('style');
        style.id = 'critical-board-injected-styles';
        style.textContent = `
            .critical-board-overlay {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1.25rem;
                background: rgba(9, 9, 11, 0.72);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                animation: cbFadeIn 0.18s ease-out;
            }
            @keyframes cbFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .critical-board-dialog {
                width: 100%;
                max-width: 960px;
                max-height: 90vh;
                background: var(--bg-card, #ffffff);
                border: 1.5px solid var(--border-color, #e2e8f0);
                border-radius: 8px;
                box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: cbSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes cbSlideUp {
                from { opacity: 0; transform: translateY(12px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .cb-header {
                padding: 1.15rem 1.5rem;
                border-bottom: 1.5px solid var(--border-color, #e2e8f0);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: var(--surface-50, #f8fafc);
                flex-shrink: 0;
            }
            .cb-header-icon {
                width: 40px;
                height: 40px;
                border-radius: 4px;
                background: rgba(37, 99, 235, 0.1);
                color: var(--primary, #2563eb);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(37, 99, 235, 0.2);
                flex-shrink: 0;
            }
            .cb-badge {
                font-size: 0.7rem;
                font-weight: 700;
                padding: 0.18rem 0.55rem;
                border-radius: 4px;
                background: var(--surface-100, #f1f5f9);
                border: 1px solid var(--border-color, #e2e8f0);
                color: var(--text-secondary, #64748b);
            }
            .cb-close-btn {
                background: transparent;
                border: 1.5px solid var(--border-color, #e2e8f0);
                border-radius: 4px;
                width: 32px;
                height: 32px;
                font-size: 1.1rem;
                font-weight: 700;
                color: var(--text-muted, #64748b);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }
            .cb-close-btn:hover {
                background: var(--surface-100, #f1f5f9);
                color: var(--text-primary, #0f172a);
                border-color: var(--text-primary, #0f172a);
            }
            .cb-tabs-bar {
                display: flex;
                gap: 0.35rem;
                padding: 0.55rem 1.5rem;
                background: var(--surface-50, #f8fafc);
                border-bottom: 1.5px solid var(--border-color, #e2e8f0);
                flex-shrink: 0;
                overflow-x: auto;
            }
            .cb-tab-btn {
                border-radius: 4px !important;
                padding: 0.48rem 1rem;
                font-size: 0.82rem;
                font-weight: 700;
                border: 1.5px solid transparent;
                background: transparent;
                color: var(--text-secondary, #64748b);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                transition: all 0.15s ease;
                white-space: nowrap;
            }
            .cb-tab-btn:hover {
                color: var(--text-primary, #0f172a);
                background: rgba(0, 0, 0, 0.03);
            }
            .cb-tab-btn.active {
                background: var(--bg-card, #ffffff);
                border-color: var(--border-color, #e2e8f0);
                color: var(--text-primary, #0f172a);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            }
            .cb-body {
                padding: 1.5rem;
                overflow-y: auto;
                flex: 1;
            }
            .cb-preset-btn {
                border-radius: 4px !important;
                padding: 0.65rem 0.85rem !important;
                min-height: 60px !important;
                background: var(--surface-50, #f8fafc) !important;
                border: 1.5px solid var(--border-color, #e2e8f0) !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                cursor: pointer !important;
                text-align: left !important;
                transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1) !important;
                box-sizing: border-box !important;
            }
            .cb-preset-btn:hover {
                background: var(--surface-100, #f1f5f9) !important;
                border-color: var(--primary, #2563eb) !important;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
            }
            .cb-preset-btn.active {
                background: rgba(37, 99, 235, 0.08) !important;
                border-color: var(--primary, #2563eb) !important;
                box-shadow: 0 0 0 1px var(--primary, #2563eb) !important;
            }
            .cb-border-swatch, .cb-accent-swatch {
                border-radius: 4px !important;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
            }
            .cb-border-swatch:hover, .cb-accent-swatch:hover {
                transform: scale(1.15);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .cb-density-btn, .cb-radius-btn, .cb-layout-sidebar-btn, .cb-divider-btn {
                border-radius: 4px !important;
                transition: all 0.15s ease;
            }
        `;
        document.head.appendChild(style);
    }

    let modalOverlay = document.getElementById('critical-board-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'critical-board-modal-overlay';
        modalOverlay.className = 'critical-board-overlay';
        modalOverlay.innerHTML = `
            <div class="critical-board-dialog" id="critical-board-dialog" role="dialog" aria-modal="true" aria-labelledby="cb-modal-title">
                
                <!-- HEADER -->
                <div class="cb-header">
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div class="cb-header-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                        </div>
                        <div>
                            <div style="display:flex; align-items:center; gap:0.5rem;">
                                <h3 id="cb-modal-title" style="margin:0; font-size:1.25rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.01em;">Critical Board</h3>
                                <span class="cb-badge">Browser Customizer</span>
                            </div>
                            <p style="margin:2px 0 0 0; font-size:0.8rem; color:var(--text-secondary);">Advanced Browser PriceLister Settings: Custom Font Manager, UI Divider Block Positions &amp; Workspace Layout.</p>
                        </div>
                    </div>
                    <button type="button" id="cb-close-btn" class="cb-close-btn" title="Close (Esc)">✕</button>
                </div>

                <!-- NAVIGATION TABS -->
                <div class="cb-tabs-bar">
                    <button type="button" class="cb-tab-btn active" data-tab="font">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                        Custom Font Manager
                    </button>
                    <button type="button" class="cb-tab-btn" data-tab="layout">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="3" x2="12" y2="21"></line></svg>
                        UI Dividers &amp; Layout
                    </button>
                    <button type="button" class="cb-tab-btn" data-tab="more">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        More Settings &amp; Diagnostics
                    </button>
                </div>

                <!-- BODY -->
                <div class="cb-body" id="cb-body-container">
                    
                    <!-- TAB 1: CUSTOM FONT MANAGER -->
                    <div class="cb-tab-pane active" id="cb-tab-font">
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                            
                            <!-- Font Upload Dropzone -->
                            <div style="background:var(--surface-50); border:1.5px dashed var(--border-color); border-radius:12px; padding:1.25rem; text-align:center; cursor:pointer;" id="cb-font-dropzone">
                                <input type="file" id="cb-font-file-input" accept=".ttf,.otf,.woff,.woff2" style="display:none;">
                                <div style="width:44px; height:44px; border-radius:10px; background:rgba(37,99,235,0.1); color:var(--primary, #2563eb); display:flex; align-items:center; justify-content:center; margin:0 auto 0.65rem;">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </div>
                                <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary); margin-bottom:0.25rem;">Upload Custom Font File</div>
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 0.75rem 0;">Drag &amp; drop or click to upload <strong>.ttf, .otf, .woff, or .woff2</strong> font file.</p>
                                <button type="button" class="btn btn-sm btn-primary" id="cb-btn-browse-font" style="padding:0.4rem 1rem; font-size:0.82rem; font-weight:700;">
                                    Choose Font File
                                </button>
                            </div>

                            <!-- Font Name & Usability Health Check Indicator -->
                            <div style="display:grid; grid-template-columns: 1fr auto; gap:0.75rem; align-items:flex-end;">
                                <div>
                                    <label style="font-size:0.82rem; font-weight:700; color:var(--text-primary); display:block; margin-bottom:0.35rem;">Font Family Name</label>
                                    <input type="text" id="cb-font-name-input" class="form-control" placeholder="e.g. MyBrandFont or Inter" style="font-size:0.88rem; padding:0.55rem 0.75rem; width:100%;">
                                </div>
                                <button type="button" id="cb-btn-test-font" class="btn btn-secondary" style="font-size:0.82rem; font-weight:700; padding:0.55rem 1rem; height:38px; display:inline-flex; align-items:center; gap:5px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Verify Usability
                                </button>
                            </div>

                            <!-- Live Usability Result Banner -->
                            <div id="cb-font-status-banner" style="display:none; padding:0.6rem 0.85rem; border-radius:8px; font-size:0.82rem; font-weight:600; align-items:center; gap:8px;">
                                <!-- dynamically populated -->
                            </div>

                            <!-- LIVE FONT PREVIEW SANDBOX -->
                            <div style="background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:12px; padding:1.25rem; box-shadow:0 2px 8px rgba(0,0,0,0.03);">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.4rem;">
                                    <span style="font-weight:700; font-size:0.82rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary);">Interactive Font Preview Sandbox</span>
                                    <span id="cb-preview-active-font-badge" style="font-size:0.72rem; font-weight:700; color:var(--primary, #2563eb); background:rgba(37,99,235,0.08); padding:2px 8px; border-radius:999px;">Current: Inter</span>
                                </div>

                                <div id="cb-live-font-sandbox" style="display:flex; flex-direction:column; gap:0.65rem; transition: font-family 0.15s ease;">
                                    <div style="font-size:1.45rem; font-weight:800; color:var(--text-primary); line-height:1.2;">PriceLister ERP — Minimal Enterprise Workspace</div>
                                    <div style="font-size:0.9rem; color:var(--text-secondary); line-height:1.45;">The quick brown fox jumps over the lazy dog. 0123456789 • ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
                                    <div style="font-size:0.85rem; font-weight:700; color:var(--text-primary); background:var(--surface-50); padding:0.5rem 0.75rem; border-radius:8px; border:1px solid var(--border-color);">
                                        Invoice #INV-2026-9042 • Total: $15,490.00 • Tax: 8.5% • Paid in Full
                                    </div>
                                    <textarea id="cb-font-custom-tester-input" class="form-control" rows="2" style="font-size:0.88rem; width:100%; margin-top:0.25rem;" placeholder="Type custom sample text to test symbols, accents or language glyphs..."></textarea>
                                </div>
                            </div>

                            <!-- QUICK CURATED PRESETS -->
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.65rem;">
                                    <label style="font-size:0.84rem; font-weight:700; color:var(--text-primary); margin:0;">Select One-Click Professional Fonts:</label>
                                    <span style="font-size:0.72rem; color:var(--text-muted); font-weight:600;">Square 4dp Mini-round • 12 Curated Presets</span>
                                </div>
                                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:0.65rem;" id="cb-presets-grid">
                                    ${FONT_PRESETS.map(p => `
                                        <button type="button" class="cb-preset-btn" data-font="${p.id}" style="border-radius:4px !important; padding:0.65rem 0.85rem; min-height:62px; background:var(--surface-50); border:1.5px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between; cursor:pointer; text-align:left; transition:all 0.18s cubic-bezier(0.16, 1, 0.3, 1); box-sizing:border-box;">
                                            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; width:100%;">
                                                <span class="cb-preset-name" style="font-family:${p.fontStack}; font-size:0.88rem; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${p.name}</span>
                                                <span class="cb-preset-check" style="font-size:0.75rem; font-weight:800; color:var(--primary, #2563eb); display:none;">✓</span>
                                            </div>
                                            <div style="font-size:0.68rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                                ${p.category}
                                            </div>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- ACTIONS -->
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; flex-wrap:wrap; gap:0.75rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                                <button type="button" id="cb-btn-reset-font" class="btn btn-outline" style="color:var(--danger); border-color:rgba(239,68,68,0.3); font-size:0.82rem; font-weight:700; padding:0.45rem 0.85rem;">
                                    Reset to Default Inter
                                </button>
                                <div style="display:flex; gap:0.5rem; align-items:center;">
                                    <button type="button" id="cb-btn-apply-font" class="btn btn-secondary" style="font-size:0.85rem; font-weight:700; padding:0.5rem 1.15rem;">
                                        Apply Font Everywhere
                                    </button>
                                    <button type="button" id="cb-btn-apply-refresh" class="btn btn-primary" style="font-size:0.85rem; font-weight:700; padding:0.5rem 1.25rem; display:inline-flex; align-items:center; gap:5px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        Save &amp; Refresh Index
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>

                    <!-- TAB 2: UI DIVIDERS & CUSTOM LAYOUT -->
                    <div class="cb-tab-pane" id="cb-tab-layout" style="display:none;">
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                            
                            <!-- 1. Sidebar Position -->
                            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.15rem;">
                                <label style="font-weight:700; font-size:0.9rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Sidebar Alignment Position</label>
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 0.75rem 0;">Choose whether navigation sidebar docks to the Left, Right, Top, or Bottom side of PriceLister.</p>
                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem;" id="cb-layout-sidebar-group">
                                    <button type="button" class="btn btn-sm btn-primary cb-layout-sidebar-btn" data-pos="left" style="font-size:0.82rem; font-weight:700; padding:0.45rem 0.65rem; justify-content:center;">
                                        ◀ Left Sidebar
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-layout-sidebar-btn" data-pos="right" style="font-size:0.82rem; font-weight:700; padding:0.45rem 0.65rem; justify-content:center;">
                                        Right Sidebar ▶
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-layout-sidebar-btn" data-pos="top" style="font-size:0.82rem; font-weight:700; padding:0.45rem 0.65rem; justify-content:center;">
                                        ▲ Top Dock
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-layout-sidebar-btn" data-pos="bottom" style="font-size:0.82rem; font-weight:700; padding:0.45rem 0.65rem; justify-content:center;">
                                        ▼ Bottom Dock
                                    </button>
                                </div>
                            </div>

                            <!-- 2. UI Divider Block Style -->
                            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.15rem;">
                                <label style="font-weight:700; font-size:0.9rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">UI Divider Block Style</label>
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 0.75rem 0;">Customize the visual weight of dividers between workspace panels, sections and tables.</p>
                                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem;" id="cb-divider-style-grid">
                                    <button type="button" class="btn btn-sm btn-primary cb-divider-btn" data-divider="minimal" style="font-size:0.8rem; font-weight:700; padding:0.45rem;">
                                        Minimal Solid (Default)
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-divider-btn" data-divider="accent" style="font-size:0.8rem; font-weight:700; padding:0.45rem;">
                                        Custom Color Accent
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-divider-btn" data-divider="dashed" style="font-size:0.8rem; font-weight:700; padding:0.45rem;">
                                        Soft Dashed
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-divider-btn" data-divider="deep" style="font-size:0.8rem; font-weight:700; padding:0.45rem;">
                                        Deep Slate
                                    </button>
                                </div>
                            </div>

                            <!-- 2.1 Workspace Border Color (Outline Customizer) - Visible ONLY when Custom Color Accent is selected -->
                            <div id="cb-border-customizer-card" style="display: ${currentLayoutConfig.dividerStyle === 'accent' ? 'block' : 'none'}; background:var(--bg-card); border:1.5px solid var(--border-color); border-radius:8px; padding:1.25rem;">
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.4rem;">
                                    <div>
                                        <label style="font-weight:700; font-size:0.92rem; color:var(--text-primary); display:block; margin:0;">
                                            Workspace Border Color (Outline Customizer)
                                        </label>
                                        <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0 0 0;">
                                            Adjust the global border outline color applied to cards, tables, inputs, dividers, and panels. Changes apply only when you click Apply or Save.
                                        </p>
                                    </div>
                                    <span id="cb-current-border-badge" style="font-size:0.75rem; font-weight:800; font-family:monospace; padding:0.2rem 0.6rem; border-radius:4px; background:var(--surface-100); border:1.5px solid var(--border-color); color:var(--text-primary);">
                                        ${localStorage.getItem('pricelister_custom_border_color') || '#D4D4D8'}
                                    </span>
                                </div>

                                <!-- Quick Preset Swatches -->
                                <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap; margin:0.85rem 0 0.75rem 0;">
                                    <span style="font-size:0.72rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-right:0.25rem;">Presets:</span>
                                    <button type="button" class="cb-border-swatch" data-color="#D4D4D8" style="background:#D4D4D8; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Default Zinc (#D4D4D8)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#E2E8F0" style="background:#E2E8F0; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Subtle Slate (#E2E8F0)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#D1D5DB" style="background:#D1D5DB; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Smooth Grey (#D1D5DB)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#CBD5E1" style="background:#CBD5E1; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Silver (#CBD5E1)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#3F3F46" style="background:#3F3F46; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(255,255,255,0.2); cursor:pointer;" title="Dark Zinc (#3F3F46)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#27272A" style="background:#27272A; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(255,255,255,0.2); cursor:pointer;" title="Charcoal (#27272A)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#000000" style="background:#000000; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(255,255,255,0.3); cursor:pointer;" title="Pitch AMOLED (#000000)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#3B82F6" style="background:#3B82F6; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Electric Blue (#3B82F6)"></button>
                                    <button type="button" class="cb-border-swatch" data-color="#10B981" style="background:#10B981; width:26px; height:26px; border-radius:4px; border:1.5px solid rgba(0,0,0,0.15); cursor:pointer;" title="Emerald (#10B981)"></button>
                                </div>

                                <!-- Color Picker & Manual Input -->
                                <div style="display:flex; align-items:center; gap:0.65rem; flex-wrap:wrap; margin-top:0.75rem;">
                                    <div style="display:flex; align-items:center; gap:0.5rem; background:var(--surface-50); border:1.5px solid var(--border-color); border-radius:4px; padding:0.35rem 0.6rem;">
                                        <input type="color" id="cb-border-color-picker" value="${localStorage.getItem('pricelister_custom_border_color') || '#D4D4D8'}" style="width:26px; height:26px; padding:0; border:none; cursor:pointer; background:transparent;">
                                        <input type="text" id="cb-border-color-hex" value="${(localStorage.getItem('pricelister_custom_border_color') || '#D4D4D8').toUpperCase()}" maxlength="7" style="width:85px; font-size:0.82rem; font-weight:700; font-family:monospace; border:none; background:transparent; color:var(--text-primary); outline:none;">
                                    </div>
                                    <button type="button" id="cb-btn-apply-border" class="btn btn-sm btn-primary" style="border-radius:4px !important; font-size:0.82rem; font-weight:700; padding:0.45rem 1rem;">
                                        Apply Border Color
                                    </button>
                                    <button type="button" id="cb-btn-reset-border" class="btn btn-sm btn-secondary" style="border-radius:4px !important; font-size:0.82rem; font-weight:700; padding:0.45rem 0.85rem;">
                                        Reset Default
                                    </button>
                                </div>
                            </div>

                            <!-- 3. Workspace Density -->
                            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.15rem;">
                                <label style="font-weight:700; font-size:0.9rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Workspace Density &amp; Spacing</label>
                                <p style="font-size:0.8rem; color:var(--text-secondary); margin:0 0 0.75rem 0;">Adjust padding and vertical compact density for data lists and forms.</p>
                                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                    <button type="button" class="btn btn-sm btn-primary cb-density-btn" data-density="comfortable" style="font-size:0.82rem; font-weight:700; padding:0.4rem 1rem;">
                                        Comfortable (Standard)
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-density-btn" data-density="compact" style="font-size:0.82rem; font-weight:700; padding:0.4rem 1rem;">
                                        Compact (Data Heavy)
                                    </button>
                                </div>
                            </div>

                            <!-- 4. Corner Radius -->
                            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.15rem;">
                                <label style="font-weight:700; font-size:0.9rem; color:var(--text-primary); display:block; margin-bottom:0.25rem;">Card Corner Radius</label>
                                <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                                    <button type="button" class="btn btn-sm btn-secondary cb-radius-btn" data-radius="4px" style="font-size:0.8rem; font-weight:700; padding:0.4rem 0.85rem; border-radius:4px;">
                                        Sharp (4px)
                                    </button>
                                    <button type="button" class="btn btn-sm btn-primary cb-radius-btn" data-radius="10px" style="font-size:0.8rem; font-weight:700; padding:0.4rem 0.85rem; border-radius:8px;">
                                        Balanced (10px)
                                    </button>
                                    <button type="button" class="btn btn-sm btn-secondary cb-radius-btn" data-radius="16px" style="font-size:0.8rem; font-weight:700; padding:0.4rem 0.85rem; border-radius:14px;">
                                        Rounded (16px)
                                    </button>
                                </div>
                            </div>

                            <!-- ACTIONS -->
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem; border-top:1px solid var(--border-color); padding-top:1rem;">
                                <button type="button" id="cb-btn-reset-layout" class="btn btn-outline" style="font-size:0.82rem; font-weight:700; padding:0.45rem 0.85rem;">
                                    Reset Layout Defaults
                                </button>
                                <button type="button" id="cb-btn-save-layout" class="btn btn-primary" style="font-size:0.85rem; font-weight:700; padding:0.5rem 1.25rem;">
                                    Save &amp; Apply Layout
                                </button>
                            </div>

                        </div>
                    </div>

                    <!-- TAB 3: MORE SETTINGS & DIAGNOSTICS -->
                    <div class="cb-tab-pane" id="cb-tab-more" style="display:none;">
                        <div style="display:flex; flex-direction:column; gap:1.25rem;">
                            
                            <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; padding:1.25rem;">
                                <h4 style="margin:0 0 0.35rem 0; font-size:0.95rem; font-weight:800; color:var(--text-primary);">Browser Cache &amp; Workspace Index</h4>
                                <p style="font-size:0.82rem; color:var(--text-secondary); margin:0 0 0.85rem 0;">Re-index local caches, flush temporary storage, and refresh browser workspace.</p>
                                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                                    <button type="button" id="cb-btn-refresh-index" class="btn btn-primary" style="font-size:0.82rem; font-weight:700; padding:0.45rem 1rem; display:inline-flex; align-items:center; gap:5px;">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                        Refresh Index &amp; Sync
                                    </button>
                                    <button type="button" id="cb-btn-clear-cache" class="btn btn-secondary" style="font-size:0.82rem; font-weight:700; padding:0.45rem 1rem;">
                                        Clear Local Cache
                                    </button>
                                </div>
                            </div>

                            <div style="background:var(--surface-50); border:1px solid var(--border-color); border-radius:12px; padding:1rem; font-size:0.8rem; color:var(--text-secondary); line-height:1.6;">
                                <strong style="color:var(--text-primary); display:block; margin-bottom:0.25rem;">Critical Board Specifications:</strong>
                                <div>• Browser PriceLister engine running in standalone client mode.</div>
                                <div>• Custom font persists in <code>localStorage</code> and loads synchronously at document head to eliminate FOUT.</div>
                                <div>• Custom UI divider blocks and sidebar alignment adapt dynamically via CSS data-attributes.</div>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);
        try {
            attachCriticalBoardEvents(modalOverlay, currentLayoutConfig);
        } catch (e) {
            console.error("Critical Board event attachment warning:", e);
        }
    }

    // Show modal
    modalOverlay.style.setProperty('display', 'flex', 'important');
    modalOverlay.style.setProperty('z-index', '999999', 'important');
    modalOverlay.style.visibility = 'visible';
    modalOverlay.style.opacity = '1';
    document.body.style.overflow = 'hidden';

    // Switch to initial tab
    switchCriticalBoardTab(modalOverlay, initialTab);
};

/**
 * Switch Tab in Critical Board Modal
 */
const switchCriticalBoardTab = (overlay, tabId) => {
    const tabBtns = overlay.querySelectorAll('.cb-tab-btn');
    const panes = overlay.querySelectorAll('.cb-tab-pane');

    tabBtns.forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    panes.forEach(p => {
        p.style.display = p.id === `cb-tab-${tabId}` ? 'block' : 'none';
        p.classList.toggle('active', p.id === `cb-tab-${tabId}`);
    });
};

/**
 * Attach Critical Board Event Handlers
 */
const attachCriticalBoardEvents = (overlay, existingLayoutConfig) => {
    const closeBtn = overlay.querySelector('#cb-close-btn');
    const closeModal = () => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') {
            closeModal();
        }
    });

    // Tab buttons
    overlay.querySelectorAll('.cb-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchCriticalBoardTab(overlay, tabId);
        });
    });

    // Font Uploader & Live Usability Tester
    let loadedFontDataUrl = '';
    let loadedFontName = '';

    const dropzone = overlay.querySelector('#cb-font-dropzone');
    const fileInput = overlay.querySelector('#cb-font-file-input');
    const browseBtn = overlay.querySelector('#cb-btn-browse-font');
    const fontNameInput = overlay.querySelector('#cb-font-name-input');
    const statusBanner = overlay.querySelector('#cb-font-status-banner');
    const sandbox = overlay.querySelector('#cb-live-font-sandbox');
    const activeFontBadge = overlay.querySelector('#cb-preview-active-font-badge');
    const customTesterInput = overlay.querySelector('#cb-font-custom-tester-input');

    // Populate current saved font name if any
    const savedFont = localStorage.getItem('pricelister_custom_font');
    if (savedFont) {
        try {
            const parsed = JSON.parse(savedFont);
            if (parsed && parsed.name) {
                if (fontNameInput) fontNameInput.value = parsed.name;
                if (activeFontBadge) activeFontBadge.textContent = `Active: ${parsed.name}`;
            }
        } catch(e) {}
    }

    const processFontFile = (file) => {
        if (!file) return;
        const validExts = ['.ttf', '.otf', '.woff', '.woff2'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExts.includes(ext)) {
            showAlert.warning("Please upload a valid font file (.ttf, .otf, .woff, or .woff2).");
            return;
        }

        const guessedName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
        if (fontNameInput) fontNameInput.value = guessedName;
        loadedFontName = guessedName;

        const reader = new FileReader();
        reader.onload = async (e) => {
            loadedFontDataUrl = e.target.result;
            await verifyAndPreviewFont(guessedName, loadedFontDataUrl);
        };
        reader.readAsDataURL(file);
    };

    const verifyAndPreviewFont = async (name, dataUrl) => {
        if (!name) return;
        try {
            if (statusBanner) {
                statusBanner.style.display = 'flex';
                statusBanner.style.background = 'rgba(37,99,235,0.08)';
                statusBanner.style.color = '#2563eb';
                statusBanner.style.border = '1px solid rgba(37,99,235,0.2)';
                statusBanner.innerHTML = `<span>⏳</span><span>Verifying font usability and rendering glyphs...</span>`;
            }

            // Create and load FontFace
            const fontFace = new FontFace(name, `url(${dataUrl})`);
            await fontFace.load();
            document.fonts.add(fontFace);

            // Update live sandbox font
            if (sandbox) sandbox.style.fontFamily = `"${name}", -apple-system, sans-serif`;
            if (activeFontBadge) activeFontBadge.textContent = `Testing: ${name}`;

            if (statusBanner) {
                statusBanner.style.background = 'rgba(21,128,61,0.08)';
                statusBanner.style.color = '#15803d';
                statusBanner.style.border = '1px solid rgba(21,128,61,0.25)';
                statusBanner.innerHTML = `<span>✓</span><span><strong>Font Verified &amp; Usable!</strong> "${name}" is valid and ready to apply across PriceLister.</span>`;
            }
        } catch (err) {
            console.warn("Font test failed:", err);
            if (statusBanner) {
                statusBanner.style.display = 'flex';
                statusBanner.style.background = 'rgba(220,38,38,0.08)';
                statusBanner.style.color = '#dc2626';
                statusBanner.style.border = '1px solid rgba(220,38,38,0.25)';
                statusBanner.innerHTML = `<span>✕</span><span>Could not parse font file: ${err.message || 'Corrupt or unsupported font.'}</span>`;
            }
        }
    };

    browseBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput?.click();
    });
    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) processFontFile(file);
    });

    dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary, #2563eb)';
        dropzone.style.background = 'rgba(37,99,235,0.04)';
    });
    dropzone?.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'var(--surface-50)';
    });
    dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'var(--surface-50)';
        const file = e.dataTransfer.files?.[0];
        if (file) processFontFile(file);
    });

    // Custom test input in sandbox
    customTesterInput?.addEventListener('input', (e) => {
        // live test
    });

    // Verify usability button
    overlay.querySelector('#cb-btn-test-font')?.addEventListener('click', () => {
        const name = (fontNameInput?.value || '').trim();
        if (!name) {
            showAlert.warning("Please enter a font family name or upload a font file.");
            return;
        }
        if (loadedFontDataUrl) {
            verifyAndPreviewFont(name, loadedFontDataUrl);
        } else {
            // Test system font or pre-installed font
            if (sandbox) sandbox.style.fontFamily = `"${name}", -apple-system, sans-serif`;
            if (statusBanner) {
                statusBanner.style.display = 'flex';
                statusBanner.style.background = 'rgba(21,128,61,0.08)';
                statusBanner.style.color = '#15803d';
                statusBanner.style.border = '1px solid rgba(21,128,61,0.25)';
                statusBanner.innerHTML = `<span>✓</span><span>Testing font stack for "${name}".</span>`;
            }
        }
    });

    // Preset Buttons
    overlay.querySelectorAll('.cb-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fontId = btn.getAttribute('data-font');
            const preset = FONT_PRESETS.find(x => x.id === fontId);
            if (!preset) return;

            if (preset.webUrl && !document.querySelector(`link[href="${preset.webUrl}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = preset.webUrl;
                document.head.appendChild(link);
            }

            // Highlight active preset button with checkmark
            overlay.querySelectorAll('.cb-preset-btn').forEach(b => {
                const isMatch = b.getAttribute('data-font') === fontId;
                b.classList.toggle('active', isMatch);
                b.style.borderColor = isMatch ? 'var(--primary, #2563eb)' : 'var(--border-color)';
                b.style.background = isMatch ? 'rgba(37,99,235,0.08)' : 'var(--surface-50)';
                const check = b.querySelector('.cb-preset-check');
                if (check) check.style.display = isMatch ? 'inline-block' : 'none';
            });

            if (fontNameInput) fontNameInput.value = preset.id;
            loadedFontName = preset.id;
            loadedFontDataUrl = '';

            if (sandbox) sandbox.style.fontFamily = preset.fontStack;
            if (activeFontBadge) activeFontBadge.textContent = `Preset: ${preset.name}`;

            if (statusBanner) {
                statusBanner.style.display = 'flex';
                statusBanner.style.background = 'rgba(21,128,61,0.08)';
                statusBanner.style.color = '#15803d';
                statusBanner.style.border = '1px solid rgba(21,128,61,0.25)';
                statusBanner.innerHTML = `<span>✓</span><span>Preset "${preset.name}" selected. Click "Apply Font Everywhere" to set as active.</span>`;
            }
        });
    });

    // Apply Font Everywhere
    overlay.querySelector('#cb-btn-apply-font')?.addEventListener('click', async () => {
        const name = (fontNameInput?.value || loadedFontName || '').trim();
        if (!name) {
            showAlert.warning("Please specify a font name or select a preset.");
            return;
        }
        try {
            await applyCustomFont(name, loadedFontDataUrl);
            showAlert.success(`Font "${name}" applied everywhere across PriceLister!`);
        } catch (err) {
            showAlert.error(err.message || "Failed to apply custom font.");
        }
    });

    // Save & Refresh Index
    overlay.querySelector('#cb-btn-apply-refresh')?.addEventListener('click', async () => {
        const name = (fontNameInput?.value || loadedFontName || '').trim();
        if (!name) {
            showAlert.warning("Please specify a font name or select a preset.");
            return;
        }
        try {
            await applyCustomFont(name, loadedFontDataUrl);
            showAlert.success(`Font applied. Refreshing index...`);
            setTimeout(() => {
                window.location.reload();
            }, 300);
        } catch (err) {
            showAlert.error(err.message || "Failed to apply custom font.");
        }
    });

    // Reset Font
    overlay.querySelector('#cb-btn-reset-font')?.addEventListener('click', () => {
        resetToDefaultFont();
        if (fontNameInput) fontNameInput.value = 'Inter';
        if (sandbox) sandbox.style.fontFamily = "'Inter', sans-serif";
        if (activeFontBadge) activeFontBadge.textContent = 'Default: Inter';
        if (statusBanner) {
            statusBanner.style.display = 'flex';
            statusBanner.style.background = 'rgba(37,99,235,0.08)';
            statusBanner.style.color = '#2563eb';
            statusBanner.style.border = '1px solid rgba(37,99,235,0.2)';
            statusBanner.innerHTML = `<span>✓</span><span>Restored default system Inter font.</span>`;
        }
        showAlert.success("Restored default Inter font.");
    });

    // ==========================================
    // TAB 2: UI DIVIDERS & LAYOUT CONTROLLERS
    // ==========================================
    let currentLayoutConfig = existingLayoutConfig || {
        sidebarPosition: 'left',
        density: 'comfortable',
        dividerStyle: 'minimal',
        radius: '10px'
    };

    try {
        const savedL = localStorage.getItem('pricelister_custom_layout');
        if (savedL) currentLayoutConfig = { ...currentLayoutConfig, ...JSON.parse(savedL) };
    } catch(e) {}

    // Sidebar position buttons
    const sidebarBtns = overlay.querySelectorAll('.cb-layout-sidebar-btn');
    sidebarBtns.forEach(btn => {
        const pos = btn.getAttribute('data-pos');
        btn.classList.toggle('btn-primary', currentLayoutConfig.sidebarPosition === pos);
        btn.classList.toggle('btn-secondary', currentLayoutConfig.sidebarPosition !== pos);
        btn.addEventListener('click', () => {
            currentLayoutConfig.sidebarPosition = pos;
            sidebarBtns.forEach(b => {
                const isMatch = b.getAttribute('data-pos') === pos;
                b.className = `btn btn-sm ${isMatch ? 'btn-primary' : 'btn-secondary'} cb-layout-sidebar-btn`;
            });
            applyCustomLayout(currentLayoutConfig);
        });
    });

    // Divider buttons
    const dividerBtns = overlay.querySelectorAll('.cb-divider-btn');
    dividerBtns.forEach(btn => {
        const div = btn.getAttribute('data-divider');
        btn.classList.toggle('btn-primary', currentLayoutConfig.dividerStyle === div);
        btn.classList.toggle('btn-secondary', currentLayoutConfig.dividerStyle !== div);
        btn.addEventListener('click', () => {
            currentLayoutConfig.dividerStyle = div;
            dividerBtns.forEach(b => {
                const isMatch = b.getAttribute('data-divider') === div;
                b.className = `btn btn-sm ${isMatch ? 'btn-primary' : 'btn-secondary'} cb-divider-btn`;
            });
            // Workspace Border Color (Outline Customizer) opens ONLY when Custom Color Accent is selected
            const borderCard = overlay.querySelector('#cb-border-customizer-card');
            if (borderCard) {
                borderCard.style.display = (div === 'accent') ? 'block' : 'none';
            }
        });
    });

    // Density buttons
    const densityBtns = overlay.querySelectorAll('.cb-density-btn');
    densityBtns.forEach(btn => {
        const den = btn.getAttribute('data-density');
        btn.classList.toggle('btn-primary', currentLayoutConfig.density === den);
        btn.classList.toggle('btn-secondary', currentLayoutConfig.density !== den);
        btn.addEventListener('click', () => {
            currentLayoutConfig.density = den;
            densityBtns.forEach(b => {
                const isMatch = b.getAttribute('data-density') === den;
                b.className = `btn btn-sm ${isMatch ? 'btn-primary' : 'btn-secondary'} cb-density-btn`;
            });
        });
    });

    // Radius buttons
    const radiusBtns = overlay.querySelectorAll('.cb-radius-btn');
    radiusBtns.forEach(btn => {
        const rad = btn.getAttribute('data-radius');
        btn.classList.toggle('btn-primary', currentLayoutConfig.radius === rad);
        btn.classList.toggle('btn-secondary', currentLayoutConfig.radius !== rad);
        btn.addEventListener('click', () => {
            currentLayoutConfig.radius = rad;
            radiusBtns.forEach(b => {
                const isMatch = b.getAttribute('data-radius') === rad;
                b.className = `btn btn-sm ${isMatch ? 'btn-primary' : 'btn-secondary'} cb-radius-btn`;
            });
        });
    });

    // Workspace Border Color Event Listeners (Outline Customizer)
    // NOTE: Swatches and pickers do NOT auto-apply globally until Save or Apply is clicked!
    const cbBorderPicker = overlay.querySelector('#cb-border-color-picker');
    const cbBorderHex = overlay.querySelector('#cb-border-color-hex');
    const cbBorderBadge = overlay.querySelector('#cb-current-border-badge');

    cbBorderPicker?.addEventListener('input', () => {
        const val = cbBorderPicker.value.toUpperCase();
        if (cbBorderHex) cbBorderHex.value = val;
        if (cbBorderBadge) cbBorderBadge.textContent = val;
    });

    cbBorderHex?.addEventListener('input', () => {
        let val = cbBorderHex.value.trim();
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            val = val.toUpperCase();
            if (cbBorderPicker) cbBorderPicker.value = val;
            if (cbBorderBadge) cbBorderBadge.textContent = val;
        }
    });

    overlay.querySelectorAll('.cb-border-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const color = swatch.getAttribute('data-color');
            if (!color) return;
            const upper = color.toUpperCase();
            if (cbBorderPicker) cbBorderPicker.value = upper;
            if (cbBorderHex) cbBorderHex.value = upper;
            if (cbBorderBadge) cbBorderBadge.textContent = upper;
        });
    });

    overlay.querySelector('#cb-btn-apply-border')?.addEventListener('click', () => {
        let color = (cbBorderHex?.value || cbBorderPicker?.value || '').trim();
        if (!color.startsWith('#')) color = '#' + color;
        if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            showAlert.warning("Please enter a valid 6-character hex color (e.g. #D4D4D8).");
            return;
        }
        color = color.toUpperCase();
        document.documentElement.style.setProperty('--border-color', color);
        document.documentElement.style.setProperty('--border-subtle', color);
        document.documentElement.style.setProperty('--custom-border-color', color);
        localStorage.setItem('pricelister_custom_border_color', color);
        if (cbBorderBadge) cbBorderBadge.textContent = color;
        showAlert.success(`Workspace border color set to ${color}!`);
    });

    overlay.querySelector('#cb-btn-reset-border')?.addEventListener('click', () => {
        localStorage.removeItem('pricelister_custom_border_color');
        document.documentElement.style.removeProperty('--border-color');
        document.documentElement.style.removeProperty('--border-subtle');
        document.documentElement.style.removeProperty('--custom-border-color');
        if (cbBorderPicker) cbBorderPicker.value = '#D4D4D8';
        if (cbBorderHex) cbBorderHex.value = '#D4D4D8';
        if (cbBorderBadge) cbBorderBadge.textContent = '#D4D4D8';
        showAlert.info("Workspace border color reset to theme default.");
    });

    // Save layout (commits divider style, sidebar layout, and border color if custom accent)
    overlay.querySelector('#cb-btn-save-layout')?.addEventListener('click', () => {
        const borderCard = overlay.querySelector('#cb-border-customizer-card');
        const isAccentDivider = currentLayoutConfig.dividerStyle === 'accent';
        if (isAccentDivider && borderCard && borderCard.style.display !== 'none') {
            let color = (cbBorderHex?.value || cbBorderPicker?.value || '').trim();
            if (!color.startsWith('#')) color = '#' + color;
            if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                color = color.toUpperCase();
                document.documentElement.style.setProperty('--border-color', color);
                document.documentElement.style.setProperty('--border-subtle', color);
                document.documentElement.style.setProperty('--custom-border-color', color);
                localStorage.setItem('pricelister_custom_border_color', color);
                if (cbBorderBadge) cbBorderBadge.textContent = color;
            }
        }
        applyCustomLayout(currentLayoutConfig);
        showAlert.success("Custom UI divider block and layout settings saved!");
    });

    // Reset layout
    overlay.querySelector('#cb-btn-reset-layout')?.addEventListener('click', () => {
        resetToDefaultLayout();
        showAlert.success("Restored default enterprise layout!");
    });

    // ==========================================
    // TAB 3: MORE SETTINGS & DIAGNOSTICS
    // ==========================================
    overlay.querySelector('#cb-btn-refresh-index')?.addEventListener('click', () => {
        showAlert.info("Refreshing workspace index...");
        setTimeout(() => window.location.reload(), 300);
    });

    overlay.querySelector('#cb-btn-clear-cache')?.addEventListener('click', () => {
        try {
            sessionStorage.clear();
            showAlert.success("Local session cache cleared successfully.");
        } catch(e) {
            showAlert.error("Could not clear cache: " + e.message);
        }
    });
};

