/**
 * Profit Calculator & Commercial Margin Engineering Tool
 * PriceLister Enterprise Tools
 * 
 * Features:
 * - Dual Mode: Check Profit Margin & Calculate Price from Desired Margin
 * - COGS, Selling Price, Unit Gross Profit, Markup %, Margin %
 * - Direct Catalog Integration: Load any active product to audit margins
 * - Volume / Batch Projections: Monthly revenue, total COGS & gross profit
 * - Breakeven Analysis & Fixed Overhead distribution
 * - Enterprise Minimal design
 */

import { getProductService } from '../services/productService.js';
import { getSettingsService } from '../services/settingsService.js';

export const renderProfitCalculator = async (container, workspaceId) => {
    const productService = getProductService(workspaceId);
    const settingsService = getSettingsService(workspaceId);

    let activeTab = 'check'; // 'check' | 'set_price' | 'volume'
    let costPrice = 50.00;
    let sellingPrice = 75.00;
    let desiredMargin = 33.33;
    let taxRate = 0.0;
    let overheadCost = 0.0;
    let monthlyVolume = 100;
    let activeProducts = [];
    let selectedProductId = '';

    let currencySymbol = '$';
    try {
        const wsSettings = await settingsService.getSettings();
        if (wsSettings && wsSettings.currencySymbol) currencySymbol = wsSettings.currencySymbol;
    } catch (e) {}

    try {
        activeProducts = await productService.getAllActiveProducts();
    } catch (e) {}

    const render = () => {
        // Calculations
        // Mode 1: Check Profit
        const unitProfit = sellingPrice - costPrice;
        const markupPct = costPrice > 0 ? (unitProfit / costPrice) * 100 : 0;
        const marginPct = sellingPrice > 0 ? (unitProfit / sellingPrice) * 100 : 0;

        // Mode 2: Set Price from Desired Margin
        // sellingPrice = costPrice / (1 - (desiredMargin / 100))
        const marginDecimal = desiredMargin / 100;
        const calculatedSellingPrice = (marginDecimal < 1 && marginDecimal >= 0) ? (costPrice / (1 - marginDecimal)) : costPrice;
        const calculatedProfit = calculatedSellingPrice - costPrice;
        const calculatedMarkup = costPrice > 0 ? (calculatedProfit / costPrice) * 100 : 0;

        // Mode 3: Volume & Overhead Projections
        const projectedRevenue = sellingPrice * monthlyVolume;
        const projectedCogs = costPrice * monthlyVolume;
        const projectedGrossProfit = projectedRevenue - projectedCogs;
        const projectedNetProfit = projectedGrossProfit - overheadCost;
        const breakevenUnits = unitProfit > 0 && overheadCost > 0 ? Math.ceil(overheadCost / unitProfit) : 0;

        container.innerHTML = `
            <div class="profit-calculator-container" style="max-width: 1180px; margin: 0 auto; animation: fadeIn 0.25s ease;">
                
                <!-- TOP HEADER -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.02em;">Profit &amp; Margin Calculator</h2>
                            <span class="badge" style="background:#FAFAFA; color:#18181B; border:1px solid #E4E4E7; font-size:0.75rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:6px;">Commercial Pricing</span>
                        </div>
                        <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:var(--text-secondary);">
                            Engineered pricing formulas for retail markups, gross margins, breakeven thresholds, and volume profit projections.
                        </p>
                    </div>

                    <!-- Catalog Loader Dropdown -->
                    ${activeProducts.length > 0 ? `
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <label style="font-size:0.82rem; font-weight:700; color:var(--text-secondary);">Audit Product:</label>
                            <select id="pc-product-select" class="form-control" style="font-size:0.85rem; padding:0.45rem 0.75rem; border-radius:8px; max-width:240px;">
                                <option value="">-- Manual Calculation --</option>
                                ${activeProducts.map(p => `
                                    <option value="${p.id}" ${selectedProductId === p.id ? 'selected' : ''}>
                                        ${escapeHtml(p.name)} (${currencySymbol}${Number(p.salePrice || p.price || 0).toFixed(2)})
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>

                <!-- MODE SELECTOR TABS -->
                <div style="display:flex; gap:0.5rem; border-bottom:1px solid var(--border-color); margin-bottom:1.5rem;">
                    <button type="button" class="btn-pc-tab ${activeTab === 'check' ? 'active' : ''}" data-tab="check" style="padding:0.6rem 1.25rem; font-size:0.88rem; font-weight:700; background:none; border:none; border-bottom:2px solid ${activeTab === 'check' ? '#18181B' : 'transparent'}; color:${activeTab === 'check' ? '#18181B' : 'var(--text-secondary)'}; cursor:pointer;">
                        Check Margin from Price
                    </button>
                    <button type="button" class="btn-pc-tab ${activeTab === 'set_price' ? 'active' : ''}" data-tab="set_price" style="padding:0.6rem 1.25rem; font-size:0.88rem; font-weight:700; background:none; border:none; border-bottom:2px solid ${activeTab === 'set_price' ? '#18181B' : 'transparent'}; color:${activeTab === 'set_price' ? '#18181B' : 'var(--text-secondary)'}; cursor:pointer;">
                        Set Price from Target Margin
                    </button>
                    <button type="button" class="btn-pc-tab ${activeTab === 'volume' ? 'active' : ''}" data-tab="volume" style="padding:0.6rem 1.25rem; font-size:0.88rem; font-weight:700; background:none; border:none; border-bottom:2px solid ${activeTab === 'volume' ? '#18181B' : 'transparent'}; color:${activeTab === 'volume' ? '#18181B' : 'var(--text-secondary)'}; cursor:pointer;">
                        Volume &amp; Breakeven Forecast
                    </button>
                </div>

                <!-- MAIN WORKSPACE GRID -->
                <div style="display:grid; grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.25fr); gap:1.5rem; align-items:start;">
                    
                    <!-- LEFT COLUMN: INPUT CONTROLS -->
                    <div class="card" style="background:#ffffff; border:1px solid #E4E4E7; border-radius:16px; padding:1.75rem; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
                        
                        <h4 style="margin:0 0 1.25rem 0; font-size:1.05rem; font-weight:800; color:var(--text-primary);">
                            ${activeTab === 'check' ? 'Cost & Selling Parameters' : (activeTab === 'set_price' ? 'Cost & Target Margin' : 'Volume & Fixed Costs')}
                        </h4>

                        <div style="display:flex; flex-direction:column; gap:1.15rem;">
                            
                            <!-- Cost Price (COGS) -->
                            <div>
                                <label style="display:block; font-size:0.83rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">
                                    Cost Price (COGS) *
                                </label>
                                <div style="position:relative;">
                                    <span style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); font-weight:700; color:var(--text-muted);">${currencySymbol}</span>
                                    <input type="number" id="inp-cost-price" min="0" step="0.01" value="${costPrice}" class="form-control" style="width:100%; font-size:1.05rem; font-weight:700; padding:0.55rem 0.75rem 0.55rem 1.85rem; border-radius:8px;">
                                </div>
                                <small style="color:var(--text-muted); font-size:0.72rem; margin-top:2px; display:block;">Unit manufacturing or wholesale purchase cost</small>
                            </div>

                            <!-- Selling Price (for 'check' & 'volume') -->
                            ${activeTab !== 'set_price' ? `
                                <div>
                                    <label style="display:block; font-size:0.83rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">
                                        Customer Retail Price *
                                    </label>
                                    <div style="position:relative;">
                                        <span style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); font-weight:700; color:var(--text-muted);">${currencySymbol}</span>
                                        <input type="number" id="inp-selling-price" min="0" step="0.01" value="${sellingPrice}" class="form-control" style="width:100%; font-size:1.05rem; font-weight:700; padding:0.55rem 0.75rem 0.55rem 1.85rem; border-radius:8px;">
                                    </div>
                                    <small style="color:var(--text-muted); font-size:0.72rem; margin-top:2px; display:block;">Customer billed price before discounts</small>
                                </div>
                            ` : `
                                <div>
                                    <label style="display:block; font-size:0.83rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">
                                        Desired Profit Margin (%) *
                                    </label>
                                    <div style="position:relative;">
                                        <input type="number" id="inp-desired-margin" min="0" max="99.9" step="0.1" value="${desiredMargin}" class="form-control" style="width:100%; font-size:1.05rem; font-weight:700; padding:0.55rem 1.85rem 0.55rem 0.75rem; border-radius:8px;">
                                        <span style="position:absolute; right:0.75rem; top:50%; transform:translateY(-50%); font-weight:700; color:var(--text-muted);">%</span>
                                    </div>
                                    <small style="color:var(--text-muted); font-size:0.72rem; margin-top:2px; display:block;">Gross margin percentage required on retail sale</small>
                                </div>
                            `}

                            <!-- Volume Mode Extras -->
                            ${activeTab === 'volume' ? `
                                <div>
                                    <label style="display:block; font-size:0.83rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">
                                        Estimated Monthly Unit Sales
                                    </label>
                                    <input type="number" id="inp-monthly-volume" min="1" step="1" value="${monthlyVolume}" class="form-control" style="width:100%; font-size:0.95rem; font-weight:700; padding:0.55rem 0.75rem; border-radius:8px;">
                                </div>

                                <div>
                                    <label style="display:block; font-size:0.83rem; font-weight:700; color:var(--text-primary); margin-bottom:0.35rem;">
                                        Monthly Fixed Overhead (Rent, Tools, Salaries)
                                    </label>
                                    <div style="position:relative;">
                                        <span style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); font-weight:700; color:var(--text-muted);">${currencySymbol}</span>
                                        <input type="number" id="inp-overhead-cost" min="0" step="10" value="${overheadCost}" class="form-control" style="width:100%; font-size:0.95rem; font-weight:700; padding:0.55rem 0.75rem 0.55rem 1.85rem; border-radius:8px;">
                                    </div>
                                </div>
                            ` : ''}

                        </div>

                        <!-- Quick Markup Preset Chips -->
                        <div style="margin-top:1.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                            <span style="display:block; font-size:0.75rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase;">Quick Markup Presets</span>
                            <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
                                <button type="button" class="btn btn-secondary btn-chip" data-pct="20" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">+20%</button>
                                <button type="button" class="btn btn-secondary btn-chip" data-pct="35" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">+35%</button>
                                <button type="button" class="btn btn-secondary btn-chip" data-pct="50" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">+50%</button>
                                <button type="button" class="btn btn-secondary btn-chip" data-pct="100" style="padding:0.25rem 0.6rem; font-size:0.75rem; font-weight:700;">2x (100%)</button>
                            </div>
                        </div>

                    </div>

                    <!-- RIGHT COLUMN: RESULTS METRIC DISPLAY -->
                    <div style="display:flex; flex-direction:column; gap:1.25rem;">
                        
                        ${activeTab === 'check' ? `
                            <!-- CHECK PROFIT METRICS -->
                            <div class="card" style="background:#ffffff; border:1px solid #E4E4E7; border-radius:16px; padding:1.75rem; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
                                
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                                    <h4 style="margin:0; font-size:1.1rem; font-weight:800; color:var(--text-primary);">Calculated Profit &amp; Margin</h4>
                                    <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; font-weight:700; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:999px;">
                                        ${unitProfit >= 0 ? 'Profitable' : 'Loss'}
                                    </span>
                                </div>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
                                    
                                    <div style="padding:1rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:12px;">
                                        <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Unit Gross Profit</span>
                                        <div style="font-size:1.65rem; font-weight:800; color:#18181B; margin-top:0.35rem;">
                                            ${unitProfit >= 0 ? '+' : ''}${currencySymbol}${unitProfit.toFixed(2)}
                                        </div>
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Selling price minus unit cost</small>
                                    </div>

                                    <div style="padding:1rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:12px;">
                                        <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Gross Profit Margin</span>
                                        <div style="font-size:1.65rem; font-weight:800; color:#18181B; margin-top:0.35rem;">
                                            ${marginPct.toFixed(1)}%
                                        </div>
                                        <small style="color:var(--text-muted); font-size:0.72rem;">Profit divided by retail price</small>
                                    </div>

                                </div>

                                <div style="padding:1rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:12px; margin-bottom:1.25rem;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-secondary);">Cost Markup Percentage</span>
                                        <strong style="font-size:1.15rem; font-weight:800; color:#18181B;">+${markupPct.toFixed(1)}%</strong>
                                    </div>
                                    <div style="height:6px; background:#E4E4E7; border-radius:3px; overflow:hidden;">
                                        <div style="width:${Math.min(markupPct, 100)}%; height:100%; background:#18181B; border-radius:3px;"></div>
                                    </div>
                                </div>

                                <!-- Difference between markup & margin explanation -->
                                <div style="font-size:0.78rem; color:var(--text-secondary); line-height:1.45; border-top:1px dashed #E4E4E7; padding-top:0.85rem;">
                                    <strong>Markup vs. Margin Rule:</strong> Markup is the percentage added on top of your cost (+${markupPct.toFixed(1)}%). Margin is the portion of the selling price that is profit (${marginPct.toFixed(1)}%).
                                </div>

                            </div>
                        ` : (activeTab === 'set_price' ? `
                            <!-- SET PRICE RESULTS -->
                            <div class="card" style="background:#ffffff; border:1px solid #E4E4E7; border-radius:16px; padding:1.75rem; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
                                
                                <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase;">Recommended Retail Price</span>
                                <div style="font-size:2.25rem; font-weight:800; color:#18181B; margin:0.35rem 0 0.85rem 0;">
                                    ${currencySymbol}${calculatedSellingPrice.toFixed(2)}
                                </div>
                                <p style="margin:0 0 1.5rem 0; font-size:0.85rem; color:var(--text-secondary);">
                                    Setting your price at <strong>${currencySymbol}${calculatedSellingPrice.toFixed(2)}</strong> guarantees a pure <strong>${desiredMargin}%</strong> profit margin on every unit sold.
                                </p>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                                    <div style="padding:0.85rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px;">
                                        <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Profit Per Unit</span>
                                        <div style="font-size:1.25rem; font-weight:800; color:#18181B; margin-top:2px;">
                                            +${currencySymbol}${calculatedProfit.toFixed(2)}
                                        </div>
                                    </div>
                                    <div style="padding:0.85rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px;">
                                        <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Equivalent Markup</span>
                                        <div style="font-size:1.25rem; font-weight:800; color:#18181B; margin-top:2px;">
                                            +${calculatedMarkup.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>

                            </div>
                        ` : `
                            <!-- VOLUME & BREAKEVEN RESULTS -->
                            <div class="card" style="background:#ffffff; border:1px solid #E4E4E7; border-radius:16px; padding:1.75rem; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
                                
                                <div style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; margin-bottom:0.25rem;">Monthly Forecast (${monthlyVolume} units)</div>
                                <div style="font-size:2rem; font-weight:800; color:#18181B; margin-bottom:1.25rem;">
                                    ${currencySymbol}${projectedGrossProfit.toFixed(2)} Gross Profit
                                </div>

                                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.85rem; margin-bottom:1.25rem;">
                                    <div style="padding:0.85rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px;">
                                        <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted);">Total Revenue</span>
                                        <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${projectedRevenue.toFixed(2)}</div>
                                    </div>
                                    <div style="padding:0.85rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px;">
                                        <span style="font-size:0.72rem; font-weight:700; color:var(--text-muted);">Total COGS Cost</span>
                                        <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${projectedCogs.toFixed(2)}</div>
                                    </div>
                                </div>

                                ${overheadCost > 0 ? `
                                    <div style="padding:1rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:12px;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem; font-size:0.85rem;">
                                            <span style="font-weight:700; color:var(--text-primary);">Net Monthly Profit (after overhead):</span>
                                            <strong style="color:#18181B;">${currencySymbol}${projectedNetProfit.toFixed(2)}</strong>
                                        </div>
                                        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-secondary);">
                                            <span>Breakeven Threshold:</span>
                                            <strong>${breakevenUnits} units to cover overhead</strong>
                                        </div>
                                    </div>
                                ` : ''}

                            </div>
                        `)}

                    </div>

                </div>

            </div>
        `;

        attachEvents();
    };

    const attachEvents = () => {
        // Tab switching
        container.querySelectorAll('.btn-pc-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.getAttribute('data-tab');
                render();
            });
        });

        // Inputs
        container.querySelector('#inp-cost-price')?.addEventListener('input', (e) => {
            costPrice = Math.max(0, parseFloat(e.target.value) || 0);
            render();
        });
        container.querySelector('#inp-selling-price')?.addEventListener('input', (e) => {
            sellingPrice = Math.max(0, parseFloat(e.target.value) || 0);
            render();
        });
        container.querySelector('#inp-desired-margin')?.addEventListener('input', (e) => {
            desiredMargin = Math.min(99.9, Math.max(0, parseFloat(e.target.value) || 0));
            render();
        });
        container.querySelector('#inp-monthly-volume')?.addEventListener('input', (e) => {
            monthlyVolume = Math.max(1, parseInt(e.target.value, 10) || 1);
            render();
        });
        container.querySelector('#inp-overhead-cost')?.addEventListener('input', (e) => {
            overheadCost = Math.max(0, parseFloat(e.target.value) || 0);
            render();
        });

        // Product selector
        const prdSel = container.querySelector('#pc-product-select');
        prdSel?.addEventListener('change', (e) => {
            selectedProductId = e.target.value;
            const p = activeProducts.find(x => x.id === selectedProductId);
            if (p) {
                costPrice = Number(p.price || p.costPrice || 0);
                sellingPrice = Number(p.salePrice || p.price || 0);
            }
            render();
        });

        // Quick Markup Chips
        container.querySelectorAll('.btn-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const pct = parseFloat(btn.getAttribute('data-pct'));
                sellingPrice = Number((costPrice * (1 + pct / 100)).toFixed(2));
                desiredMargin = Number(((sellingPrice - costPrice) / sellingPrice * 100).toFixed(1));
                render();
            });
        });
    };

    render();
};

