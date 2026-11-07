/**
 * PRICELISTER — MODULE 06: SUPPLIER & MARKET INTELLIGENCE UI
 * 1. Supplier Directory
 * 2. Supplier Pricing (Multi-Supplier Quotes)
 * 3. Market Comparison (Cost vs Selling + Competitor Tracking)
 * 4. Supplier Performance (Data-Driven Metrics)
 * 5. Profit Calculator
 * 6. Price History (Immutable Audit Log)
 */

import { getSupplierService } from '../services/supplierService.js';
import { getProductService } from '../services/productService.js';
import { getAppCurrencySymbol } from '../utilities.js';
import { showAlert } from '../alert-handler.js';
import { renderProfitCalculator } from './profitCalculator.js';

let currentWorkspaceId = null;
let activeTab = 'directory'; // 'directory' | 'pricing' | 'comparison' | 'performance' | 'calculator' | 'history'
let supplierStatusFilter = 'all'; // 'all' | 'Active' | 'Inactive' | 'Restricted'
let searchQuery = '';

export const renderSupplierMarket = async (container, workspaceId, subView = null) => {
    currentWorkspaceId = workspaceId || (window.__activeWorkspace?.workspaceId) || (window.__activeWorkspace?.id) || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';

    // Route mapping
    if (subView) {
        const sv = subView.toLowerCase();
        if (sv === 'pricing' || sv === 'supplier-pricing') activeTab = 'pricing';
        else if (sv === 'comparison' || sv === 'market-comparison') activeTab = 'comparison';
        else if (sv === 'performance' || sv === 'supplier-performance') activeTab = 'performance';
        else if (sv === 'calculator' || sv === 'profit-calculator') activeTab = 'calculator';
        else if (sv === 'history' || sv === 'price-history') activeTab = 'history';
        else activeTab = 'directory';
    }

    const supService = getSupplierService(currentWorkspaceId);
    let suppliers = [];
    try {
        suppliers = await supService.getAllSuppliers('all');
    } catch (e) {
        console.error("Failed to fetch suppliers:", e);
    }

    container.innerHTML = `
        <div style="padding: 1.75rem 2rem; max-width: 1400px; margin: 0 auto; min-height: 85vh;">
            <!-- Top Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h1 style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin: 0; letter-spacing: -0.02em;">Supplier & Market Intelligence</h1>
                        <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:999px;">Procurement & B2B</span>
                    </div>
                    <p style="margin: 0.35rem 0 0; color: #71717A; font-size: 0.88rem;">Vendor directory, wholesale quotes, competitor pricing, data-driven supplier performance, and inflation audit.</p>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <button id="btn-export-current-view" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.4rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px; padding:0.5rem 0.9rem; cursor:pointer;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export CSV
                    </button>
                    <button id="btn-primary-action" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem; border-radius:8px; padding:0.5rem 0.9rem; cursor:pointer;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Add Supplier</span>
                    </button>
                </div>
            </div>

            <!-- Tab Navigation Strip -->
            <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid #E4E4E7; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 2px;">
                <button class="sm-nav-tab ${activeTab === 'directory' ? 'active' : ''}" data-tab="directory">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Supplier Directory (${suppliers.length})
                </button>
                <button class="sm-nav-tab ${activeTab === 'pricing' ? 'active' : ''}" data-tab="pricing">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    Supplier Pricing
                </button>
                <button class="sm-nav-tab ${activeTab === 'comparison' ? 'active' : ''}" data-tab="comparison">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
                    Market Comparison
                </button>
                <button class="sm-nav-tab ${activeTab === 'performance' ? 'active' : ''}" data-tab="performance">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Supplier Performance
                </button>
                <button class="sm-nav-tab ${activeTab === 'calculator' ? 'active' : ''}" data-tab="calculator">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>
                    Profit Calculator
                </button>
                <button class="sm-nav-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                    Price History & Delta
                </button>
            </div>

            <!-- Content Container -->
            <div id="supplier-market-view-root"></div>
        </div>

        <style>
            .sm-nav-tab {
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
            .sm-nav-tab:hover {
                color: #18181B;
            }
            .sm-nav-tab.active {
                color: #18181B;
                border-bottom-color: #18181B;
                font-weight: 700;
            }
        </style>
    `;

    bindTabListeners(container);
    renderActiveTab(container);
};

const bindTabListeners = (container) => {
    container.querySelectorAll('.sm-nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.sm-nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTab = tab.dataset.tab;
            updatePrimaryActionHeader(container);
            renderActiveTab(container);
        });
    });

    const exportBtn = container.querySelector('#btn-export-current-view');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            handleExport();
        });
    }

    const actionBtn = container.querySelector('#btn-primary-action');
    if (actionBtn) {
        actionBtn.addEventListener('click', () => {
            handlePrimaryAction();
        });
    }
};

const updatePrimaryActionHeader = (container) => {
    const actionBtn = container.querySelector('#btn-primary-action span');
    if (!actionBtn) return;

    if (activeTab === 'directory') actionBtn.textContent = 'Add Supplier';
    else if (activeTab === 'pricing') actionBtn.textContent = 'Add Price Quote';
    else if (activeTab === 'comparison') actionBtn.textContent = 'Log Competitor Price';
    else if (activeTab === 'performance') actionBtn.textContent = 'Refresh Metrics';
    else if (activeTab === 'calculator') actionBtn.textContent = 'Reset Calculator';
    else if (activeTab === 'history') actionBtn.textContent = 'Log Price Change';
};

const renderActiveTab = async (container) => {
    const root = container.querySelector('#supplier-market-view-root');
    if (!root) return;

    root.innerHTML = `<div style="text-align: center; padding: 3rem; color: #71717A; font-size: 0.9rem;">Loading workspace procurement data...</div>`;

    if (activeTab === 'directory') await renderDirectoryView(root);
    else if (activeTab === 'pricing') await renderPricingView(root);
    else if (activeTab === 'comparison') await renderComparisonView(root);
    else if (activeTab === 'performance') await renderPerformanceView(root);
    else if (activeTab === 'calculator') await renderCalculatorView(root);
    else if (activeTab === 'history') await renderHistoryView(root);
};

// =========================================================================
// VIEW 1: SUPPLIER DIRECTORY
// =========================================================================
const renderDirectoryView = async (target) => {
    const supService = getSupplierService(currentWorkspaceId);
    let suppliers = await supService.getAllSuppliers(supplierStatusFilter);

    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        suppliers = suppliers.filter(s => 
            (s.name || '').toLowerCase().includes(q) ||
            (s.contactPerson || '').toLowerCase().includes(q) ||
            (s.email || '').toLowerCase().includes(q) ||
            (s.phone || '').toLowerCase().includes(q) ||
            (s.country || '').toLowerCase().includes(q)
        );
    }

    target.innerHTML = `
        <!-- Filter Controls -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; gap:1rem; flex-wrap:wrap;">
            <div style="display:flex; gap:0.5rem; align-items:center;">
                <input type="text" id="sup-search-input" value="${escapeHtml(searchQuery)}" placeholder="Search suppliers by name, contact, email..." style="width:280px; padding:0.5rem 0.85rem; border:1px solid #E4E4E7; border-radius:8px; font-size:0.85rem; background:#FFFFFF; color:#18181B;">
                ${searchQuery ? `<button id="btn-clear-sup-search" style="background:none; border:none; color:#71717A; cursor:pointer; font-size:0.85rem;">Clear</button>` : ''}
            </div>
            <div style="display:flex; gap:0.4rem;">
                ${['all', 'Active', 'Inactive', 'Restricted'].map(st => `
                    <button class="sup-status-filter-btn ${supplierStatusFilter === st ? 'active' : ''}" data-status="${st}" style="padding:0.4rem 0.8rem; font-size:0.8rem; border-radius:6px; border:1px solid ${supplierStatusFilter === st ? '#18181B' : '#E4E4E7'}; background:${supplierStatusFilter === st ? '#18181B' : '#FFFFFF'}; color:${supplierStatusFilter === st ? '#FFFFFF' : '#71717A'}; font-weight:600; cursor:pointer;">
                        ${st === 'all' ? 'All Suppliers' : st}
                    </button>
                `).join('')}
            </div>
        </div>

        <!-- Supplier Cards Grid -->
        ${suppliers.length === 0 ? `
            <div style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; padding:3rem; text-align:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="1.5" style="margin-bottom:0.75rem;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                <h4 style="margin:0 0 0.25rem; font-size:1.05rem; font-weight:700; color:#18181B;">No Suppliers Found</h4>
                <p style="margin:0 0 1rem; color:#71717A; font-size:0.85rem;">No suppliers match your current filter criteria.</p>
                <button id="btn-empty-add-sup" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600;">Add Your First Supplier</button>
            </div>
        ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
                ${suppliers.map(sup => {
                    const statusBg = sup.status === 'Active' ? '#F4F4F5' : (sup.status === 'Restricted' ? '#F4F4F5' : '#FAFAFA');
                    const statusColor = sup.status === 'Restricted' ? '#71717A' : '#18181B';
                    return `
                        <div class="card" style="padding: 1.5rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 14px; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <div>
                                        <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">${escapeHtml(sup.name)}</h3>
                                        <div style="font-size: 0.75rem; color: #71717A; font-family: monospace; margin-top: 0.15rem;">${sup.uniqueId || sup.id} • ${escapeHtml(sup.country || 'Global')}</div>
                                    </div>
                                    <span class="badge" style="background:${statusBg}; color:${statusColor}; border:1px solid #E4E4E7; font-weight:800; font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:999px;">
                                        ${sup.status || 'Active'}
                                    </span>
                                </div>

                                <div style="font-size: 0.85rem; color: #18181B; margin: 0.75rem 0; line-height: 1.6;">
                                    <div><strong>Contact:</strong> ${escapeHtml(sup.contactPerson || 'N/A')}</div>
                                    <div><strong>Email:</strong> ${sup.email ? `<a href="mailto:${escapeHtml(sup.email)}" style="color:#18181B; text-decoration:underline;">${escapeHtml(sup.email)}</a>` : '<span style="color:#A1A1AA;">None</span>'}</div>
                                    <div><strong>Phone:</strong> ${escapeHtml(sup.phone || 'None')}</div>
                                    ${sup.address ? `<div style="color:#71717A; font-size:0.8rem; margin-top:0.25rem;">${escapeHtml(sup.address)}</div>` : ''}
                                </div>

                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #F4F4F5; padding: 0.75rem; border-radius: 8px; font-size: 0.78rem; margin-top: 0.75rem; border:1px solid #E4E4E7;">
                                    <div><span style="color:#71717A;">Payment Terms:</span> <strong>${escapeHtml(sup.paymentTerms || 'Net 30')}</strong></div>
                                    <div><span style="color:#71717A;">Tax ID / Reg:</span> <strong>${escapeHtml((sup.businessInfo && sup.businessInfo.taxId) || 'Not set')}</strong></div>
                                </div>
                                ${sup.notes ? `<div style="font-size:0.78rem; color:#71717A; margin-top:0.6rem; font-style:italic;">"${escapeHtml(sup.notes)}"</div>` : ''}
                            </div>

                            <div style="display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 1.25rem; padding-top: 0.85rem; border-top: 1px solid #E4E4E7;">
                                <button class="btn btn-sm btn-secondary btn-edit-sup" data-id="${sup.id}" style="font-size:0.8rem; font-weight:600; padding:0.35rem 0.7rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Edit</button>
                                ${sup.status === 'Active' ? `
                                    <button class="btn btn-sm btn-secondary btn-archive-sup" data-id="${sup.id}" style="font-size:0.8rem; font-weight:600; padding:0.35rem 0.7rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Archive</button>
                                ` : `
                                    <button class="btn btn-sm btn-secondary btn-restore-sup" data-id="${sup.id}" style="font-size:0.8rem; font-weight:600; padding:0.35rem 0.7rem; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; cursor:pointer;">Activate</button>
                                `}
                                <button class="btn btn-sm btn-outline btn-del-sup" data-id="${sup.id}" style="font-size:0.8rem; font-weight:600; padding:0.35rem 0.7rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#71717A; border-radius:6px; cursor:pointer;">Delete</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `}
    `;

    // Directory Event Handlers
    const searchInput = target.querySelector('#sup-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderDirectoryView(target);
        });
    }

    target.querySelector('#btn-clear-sup-search')?.addEventListener('click', () => {
        searchQuery = '';
        renderDirectoryView(target);
    });

    target.querySelectorAll('.sup-status-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            supplierStatusFilter = btn.dataset.status;
            renderDirectoryView(target);
        });
    });

    target.querySelector('#btn-empty-add-sup')?.addEventListener('click', () => {
        openSupplierModal();
    });

    target.querySelectorAll('.btn-edit-sup').forEach(btn => {
        btn.addEventListener('click', async () => {
            const supId = btn.dataset.id;
            const sup = await supService.getSupplierById(supId);
            if (sup) openSupplierModal(sup);
        });
    });

    target.querySelectorAll('.btn-archive-sup').forEach(btn => {
        btn.addEventListener('click', async () => {
            const supId = btn.dataset.id;
            await supService.archiveSupplier(supId);
            showAlert.info("Supplier moved to Inactive status.");
            renderDirectoryView(target);
        });
    });

    target.querySelectorAll('.btn-restore-sup').forEach(btn => {
        btn.addEventListener('click', async () => {
            const supId = btn.dataset.id;
            await supService.updateSupplier(supId, { status: 'Active' });
            showAlert.success("Supplier restored to Active status.");
            renderDirectoryView(target);
        });
    });

    target.querySelectorAll('.btn-del-sup').forEach(btn => {
        btn.addEventListener('click', async () => {
            const supId = btn.dataset.id;
            if (confirm("Permanently delete this supplier record?")) {
                await supService.deleteSupplier(supId);
                showAlert.info("Supplier deleted.");
                renderDirectoryView(target);
            }
        });
    });
};

// =========================================================================
// VIEW 2: SUPPLIER PRICING (Multi-Supplier Quotes)
// =========================================================================
const renderPricingView = async (target) => {
    const supService = getSupplierService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();
    let quotes = await supService.getAllSupplierPrices();

    target.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <div>
                <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#18181B;">Multi-Supplier Price Quotes</h3>
                <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Associate individual catalog items with multiple qualified vendor price quotes.</p>
            </div>
            <button id="btn-add-quote" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.82rem; font-weight:700; border-radius:8px; padding:0.45rem 0.85rem; cursor:pointer;">
                + Add Vendor Quote
            </button>
        </div>

        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; overflow:hidden;">
            ${quotes.length === 0 ? `
                <div style="padding:3rem; text-align:center; color:#71717A;">
                    <p style="margin:0 0 0.5rem; font-weight:600; color:#18181B;">No supplier quotes registered yet.</p>
                    <p style="margin:0; font-size:0.85rem;">Click "+ Add Vendor Quote" to record purchasing prices from your suppliers.</p>
                </div>
            ` : `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em;">
                                <th style="padding:0.85rem 1rem;">Product / SKU</th>
                                <th style="padding:0.85rem 1rem;">Supplier</th>
                                <th style="padding:0.85rem 1rem;">Purchase Cost</th>
                                <th style="padding:0.85rem 1rem;">MOQ</th>
                                <th style="padding:0.85rem 1rem;">Lead Time</th>
                                <th style="padding:0.85rem 1rem;">Validity Period</th>
                                <th style="padding:0.85rem 1rem;">Last Updated</th>
                                <th style="padding:0.85rem 1rem; text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quotes.map(q => `
                                <tr style="border-bottom:1px solid #E4E4E7;">
                                    <td style="padding:0.85rem 1rem;">
                                        <div style="font-weight:700; color:#18181B;">${escapeHtml(q.productName || 'Catalog Item')}</div>
                                        <div style="font-family:monospace; font-size:0.75rem; color:#71717A;">${escapeHtml(q.sku || 'SKU-N/A')}</div>
                                    </td>
                                    <td style="padding:0.85rem 1rem; font-weight:600; color:#18181B;">
                                        ${escapeHtml(q.supplierName || 'Unknown Vendor')}
                                    </td>
                                    <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">
                                        ${currSym}${Number(q.costPrice || 0).toFixed(2)}
                                    </td>
                                    <td style="padding:0.85rem 1rem; color:#71717A;">
                                        ${q.minOrderQty || 1} units
                                    </td>
                                    <td style="padding:0.85rem 1rem; color:#18181B;">
                                        ${q.leadTimeDays || 7} days
                                    </td>
                                    <td style="padding:0.85rem 1rem; font-size:0.78rem; color:#71717A;">
                                        ${q.validFrom ? String(q.validFrom).slice(0, 10) : 'Current'} ${q.validTo ? `&rarr; ${String(q.validTo).slice(0, 10)}` : '(Open)'}
                                    </td>
                                    <td style="padding:0.85rem 1rem; font-size:0.78rem; color:#71717A;">
                                        ${q.lastUpdated ? new Date(q.lastUpdated).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td style="padding:0.85rem 1rem; text-align:right;">
                                        <button class="btn btn-sm btn-outline btn-delete-quote" data-id="${q.id}" style="font-size:0.75rem; color:#71717A; border:1px solid #E4E4E7; background:#FFFFFF; border-radius:6px; padding:0.25rem 0.6rem; cursor:pointer;">Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        </div>
    `;

    target.querySelector('#btn-add-quote')?.addEventListener('click', () => {
        openPriceQuoteModal();
    });

    target.querySelectorAll('.btn-delete-quote').forEach(btn => {
        btn.addEventListener('click', async () => {
            const qId = btn.dataset.id;
            if (confirm("Remove this supplier quote?")) {
                await supService.deleteSupplierPrice(qId);
                showAlert.info("Supplier price quote removed.");
                renderPricingView(target);
            }
        });
    });
};

// =========================================================================
// VIEW 3: MARKET COMPARISON (Cost vs Selling + Competitor Tracking)
// =========================================================================
const renderComparisonView = async (target) => {
    const prodService = getProductService(currentWorkspaceId);
    const supService = getSupplierService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();

    let products = [];
    let competitors = [];
    try {
        products = await prodService.getAllProducts();
        competitors = await supService.getAllCompetitorPrices();
    } catch (e) {
        console.error("Comparison load error:", e);
    }

    target.innerHTML = `
        <!-- Section 1: Cost vs Selling Price -->
        <div style="margin-bottom:2rem;">
            <div style="margin-bottom:1rem;">
                <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#18181B;">Cost vs. Selling Price Benchmark</h3>
                <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Gross profit, gross margin %, and markup % derived from live catalog selling prices and purchase costs.</p>
            </div>

            <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; overflow:hidden;">
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                                <th style="padding:0.85rem 1rem;">Product / SKU</th>
                                <th style="padding:0.85rem 1rem;">Unit Cost (COGS)</th>
                                <th style="padding:0.85rem 1rem;">Selling Price</th>
                                <th style="padding:0.85rem 1rem;">Gross Profit</th>
                                <th style="padding:0.85rem 1rem;">Gross Margin %</th>
                                <th style="padding:0.85rem 1rem;">Markup %</th>
                                <th style="padding:0.85rem 1rem; text-align:right;">Margin Health</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.slice(0, 15).map(p => {
                                const cost = Number(p.costPrice || p.price || 0);
                                const sale = Number(p.salePrice || p.basePrice || 0);
                                const profit = sale - cost;
                                const marginPct = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0;
                                const markupPct = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;

                                let healthBadge = `<span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px; font-weight:700;">Healthy (>25%)</span>`;
                                if (profit < 0) {
                                    healthBadge = `<span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #18181B; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px; font-weight:800;">Negative Loss</span>`;
                                } else if (marginPct < 20) {
                                    healthBadge = `<span class="badge" style="background:#F4F4F5; color:#71717A; border:1px solid #E4E4E7; font-size:0.72rem; padding:0.2rem 0.5rem; border-radius:4px; font-weight:600;">Low Margin</span>`;
                                }

                                return `
                                    <tr style="border-bottom:1px solid #E4E4E7;">
                                        <td style="padding:0.85rem 1rem;">
                                            <div style="font-weight:700; color:#18181B;">${escapeHtml(p.name)}</div>
                                            <div style="font-family:monospace; font-size:0.75rem; color:#71717A;">${escapeHtml(p.upcCode || p.uniqueId || 'SKU')}</div>
                                        </td>
                                        <td style="padding:0.85rem 1rem; color:#71717A;">${currSym}${cost.toFixed(2)}</td>
                                        <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">${currSym}${sale.toFixed(2)}</td>
                                        <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">${profit >= 0 ? '+' : ''}${currSym}${profit.toFixed(2)}</td>
                                        <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">${marginPct}%</td>
                                        <td style="padding:0.85rem 1rem; color:#71717A;">${markupPct}%</td>
                                        <td style="padding:0.85rem 1rem; text-align:right;">${healthBadge}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Section 2: Competitor Price Tracking -->
        <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                <div>
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#18181B;">Competitor Price Tracking</h3>
                    <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Manual market intelligence records with source verification and observation timestamp.</p>
                </div>
                <button id="btn-add-competitor" class="btn btn-secondary" style="font-size:0.82rem; font-weight:700; border:1px solid #18181B; background:#18181B; color:#FFFFFF; border-radius:8px; padding:0.45rem 0.85rem; cursor:pointer;">
                    + Log Competitor Observation
                </button>
            </div>

            <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; overflow:hidden;">
                ${competitors.length === 0 ? `
                    <div style="padding:2.5rem; text-align:center; color:#71717A; font-size:0.88rem;">
                        No competitor price observations recorded yet. Click "+ Log Competitor Observation" to track market rivals.
                    </div>
                ` : `
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                            <thead>
                                <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                                    <th style="padding:0.85rem 1rem;">Observation Date</th>
                                    <th style="padding:0.85rem 1rem;">Product / SKU</th>
                                    <th style="padding:0.85rem 1rem;">Competitor Name</th>
                                    <th style="padding:0.85rem 1rem;">Competitor Price</th>
                                    <th style="padding:0.85rem 1rem;">Our Selling Price</th>
                                    <th style="padding:0.85rem 1rem;">Price Difference</th>
                                    <th style="padding:0.85rem 1rem;">Source / Note</th>
                                    <th style="padding:0.85rem 1rem; text-align:right;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${competitors.map(c => {
                                    const prod = products.find(p => p.id === c.productId || p.uniqueId === c.productId) || { salePrice: 0 };
                                    const ourPrice = Number(prod.salePrice || 0);
                                    const compPrice = Number(c.competitorPrice || 0);
                                    const delta = compPrice - ourPrice;
                                    const deltaPct = ourPrice > 0 ? ((delta / ourPrice) * 100).toFixed(1) : 0;
                                    return `
                                        <tr style="border-bottom:1px solid #E4E4E7;">
                                            <td style="padding:0.85rem 1rem; font-family:monospace; color:#71717A;">${c.observationDate}</td>
                                            <td style="padding:0.85rem 1rem;">
                                                <div style="font-weight:700; color:#18181B;">${escapeHtml(c.productName || 'Catalog Item')}</div>
                                                <div style="font-family:monospace; font-size:0.75rem; color:#71717A;">${escapeHtml(c.sku || '')}</div>
                                            </td>
                                            <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">${escapeHtml(c.competitorName)}</td>
                                            <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">${currSym}${compPrice.toFixed(2)}</td>
                                            <td style="padding:0.85rem 1rem; color:#71717A;">${currSym}${ourPrice.toFixed(2)}</td>
                                            <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">
                                                ${delta > 0 ? `+${currSym}${delta.toFixed(2)} (+${deltaPct}%)` : `-${currSym}${Math.abs(delta).toFixed(2)} (${deltaPct}%)`}
                                            </td>
                                            <td style="padding:0.85rem 1rem; font-size:0.8rem; color:#71717A;">
                                                <div><strong>${escapeHtml(c.source || 'Manual')}</strong></div>
                                                ${c.notes ? `<div style="font-size:0.75rem; color:#A1A1AA;">${escapeHtml(c.notes)}</div>` : ''}
                                            </td>
                                            <td style="padding:0.85rem 1rem; text-align:right;">
                                                <button class="btn btn-sm btn-outline btn-del-comp" data-id="${c.id}" style="font-size:0.75rem; color:#71717A; border:1px solid #E4E4E7; background:#FFFFFF; border-radius:6px; padding:0.25rem 0.6rem; cursor:pointer;">Delete</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </div>
    `;

    target.querySelector('#btn-add-competitor')?.addEventListener('click', () => {
        openCompetitorModal();
    });

    target.querySelectorAll('.btn-del-comp').forEach(btn => {
        btn.addEventListener('click', async () => {
            const compId = btn.dataset.id;
            if (confirm("Delete this competitor observation?")) {
                await supService.deleteCompetitorPrice(compId);
                showAlert.info("Competitor record deleted.");
                renderComparisonView(target);
            }
        });
    });
};

// =========================================================================
// VIEW 4: SUPPLIER PERFORMANCE (Data-Driven Metrics)
// =========================================================================
const renderPerformanceView = async (target) => {
    const supService = getSupplierService(currentWorkspaceId);
    let suppliers = await supService.getAllSuppliers('all');

    target.innerHTML = `
        <div style="margin-bottom:1.25rem;">
            <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#18181B;">Empirical Supplier Performance Metrics</h3>
            <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Transparent metrics based on actual recorded quotes, lead times, and price variance history. No fictional ratings.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.25rem;">
            ${await Promise.all(suppliers.map(async (sup) => {
                const metrics = await supService.getSupplierPerformanceMetrics(sup.id);
                return `
                    <div class="card" style="padding: 1.5rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 14px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                                <div>
                                    <h4 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">${escapeHtml(sup.name)}</h4>
                                    <span style="font-size:0.75rem; color:#71717A; font-family:monospace;">${escapeHtml(metrics.country)} • ${metrics.status}</span>
                                </div>
                                <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.75rem; padding:0.25rem 0.6rem; border-radius:999px;">
                                    ${metrics.priceStabilityRating}
                                </span>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:0.75rem;">
                                <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding-bottom:0.4rem; border-bottom:1px solid #F4F4F5;">
                                    <span style="color:#71717A;">Active Product Quotes:</span>
                                    <strong style="color:#18181B;">${metrics.activeSKUCount} items</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding-bottom:0.4rem; border-bottom:1px solid #F4F4F5;">
                                    <span style="color:#71717A;">Average Lead Time:</span>
                                    <strong style="color:#18181B;">${metrics.averageLeadTimeDays} Calendar Days</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding-bottom:0.4rem; border-bottom:1px solid #F4F4F5;">
                                    <span style="color:#71717A;">Recorded Price Changes:</span>
                                    <strong style="color:#18181B;">${metrics.totalRecordedPriceAdjustments} events</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.82rem; padding-bottom:0.4rem; border-bottom:1px solid #F4F4F5;">
                                    <span style="color:#71717A;">Avg Price Volatility:</span>
                                    <strong style="color:#18181B;">&plusmn;${metrics.averagePriceVolatilityPct}%</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:0.82rem;">
                                    <span style="color:#71717A;">Standard Terms:</span>
                                    <strong style="color:#18181B;">${escapeHtml(metrics.paymentTerms)}</strong>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:1.25rem; padding-top:0.75rem; border-top:1px solid #E4E4E7; display:flex; justify-content:flex-end;">
                            <button class="btn btn-sm btn-secondary btn-view-vendor-history" data-id="${sup.id}" style="font-size:0.78rem; font-weight:600; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.35rem 0.75rem; cursor:pointer;">
                                View Audit Log
                            </button>
                        </div>
                    </div>
                `;
            }))}
        </div>
    `;

    target.querySelectorAll('.btn-view-vendor-history').forEach(btn => {
        btn.addEventListener('click', () => {
            activeTab = 'history';
            const navTabs = document.querySelectorAll('.sm-nav-tab');
            navTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'history'));
            renderHistoryView(target);
        });
    });
};

// =========================================================================
// VIEW 5: PROFIT CALCULATOR
// =========================================================================
const renderCalculatorView = async (target) => {
    target.innerHTML = `<div id="embedded-profit-calc-host"></div>`;
    const host = target.querySelector('#embedded-profit-calc-host');
    await renderProfitCalculator(host, currentWorkspaceId);
};

// =========================================================================
// VIEW 6: PRICE HISTORY & DELTA AUDIT
// =========================================================================
const renderHistoryView = async (target) => {
    const supService = getSupplierService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();
    let history = await supService.getPriceHistory();

    target.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem;">
            <div>
                <h3 style="margin:0; font-size:1.1rem; font-weight:700; color:#18181B;">Immutable Price Fluctuation Audit Log</h3>
                <p style="margin:0.2rem 0 0; font-size:0.83rem; color:#71717A;">Complete history of purchase costs and catalog selling price revisions.</p>
            </div>
            <button id="btn-export-history-csv" class="btn btn-secondary" style="font-size:0.82rem; font-weight:600; background:#FFFFFF; border:1px solid #E4E4E7; border-radius:8px; padding:0.45rem 0.85rem; cursor:pointer;">
                Export History (CSV)
            </button>
        </div>

        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:12px; overflow:hidden;">
            ${history.length === 0 ? `
                <div style="padding:3rem; text-align:center; color:#71717A; font-size:0.88rem;">
                    No price change events recorded yet. Updates made to product prices or supplier quotes will automatically populate this audit trail.
                </div>
            ` : `
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem;">
                        <thead>
                            <tr style="background:#F4F4F5; border-bottom:1px solid #E4E4E7; color:#71717A; font-size:0.75rem; text-transform:uppercase;">
                                <th style="padding:0.85rem 1rem;">Timestamp</th>
                                <th style="padding:0.85rem 1rem;">Product / SKU</th>
                                <th style="padding:0.85rem 1rem;">Type & Source</th>
                                <th style="padding:0.85rem 1rem;">Previous Price</th>
                                <th style="padding:0.85rem 1rem;">New Price</th>
                                <th style="padding:0.85rem 1rem;">Delta ($ / %)</th>
                                <th style="padding:0.85rem 1rem;">User Attribution</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(h => {
                                const deltaAmt = Number(h.diffAmount || 0);
                                const deltaPct = Number(h.diffPercent || 0);
                                return `
                                    <tr style="border-bottom:1px solid #E4E4E7;">
                                        <td style="padding:0.85rem 1rem; font-family:monospace; font-size:0.78rem; color:#71717A;">
                                            ${new Date(h.timestamp || Date.now()).toLocaleString()}
                                        </td>
                                        <td style="padding:0.85rem 1rem;">
                                            <div style="font-weight:700; color:#18181B;">${escapeHtml(h.productName || 'Catalog Product')}</div>
                                            <div style="font-family:monospace; font-size:0.75rem; color:#71717A;">${escapeHtml(h.sku || '')}</div>
                                        </td>
                                        <td style="padding:0.85rem 1rem;">
                                            <div style="font-weight:600; color:#18181B;">${h.priceType === 'purchase_cost' ? 'Purchase Cost (COGS)' : 'Selling Price'}</div>
                                            <div style="font-size:0.75rem; color:#71717A;">${escapeHtml(h.changeSource || h.supplierName || 'Catalog')}</div>
                                        </td>
                                        <td style="padding:0.85rem 1rem; color:#71717A;">
                                            ${currSym}${Number(h.oldPrice || 0).toFixed(2)}
                                        </td>
                                        <td style="padding:0.85rem 1rem; font-weight:700; color:#18181B;">
                                            ${currSym}${Number(h.newPrice || 0).toFixed(2)}
                                        </td>
                                        <td style="padding:0.85rem 1rem; font-weight:800; color:#18181B;">
                                            ${deltaAmt >= 0 ? `+${currSym}${deltaAmt.toFixed(2)} (+${deltaPct}%)` : `-${currSym}${Math.abs(deltaAmt).toFixed(2)} (${deltaPct}%)`}
                                        </td>
                                        <td style="padding:0.85rem 1rem; font-size:0.78rem; color:#71717A;">
                                            ${escapeHtml(h.responsibleUserName || h.responsibleUserId || 'System')}
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

    target.querySelector('#btn-export-history-csv')?.addEventListener('click', () => {
        exportPriceHistoryCSV(history);
    });
};

// =========================================================================
// MODALS & ACTIONS
// =========================================================================
const handlePrimaryAction = () => {
    if (activeTab === 'directory') openSupplierModal();
    else if (activeTab === 'pricing') openPriceQuoteModal();
    else if (activeTab === 'comparison') openCompetitorModal();
    else if (activeTab === 'performance') {
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderPerformanceView(root);
        showAlert.success("Supplier performance metrics refreshed.");
    }
    else if (activeTab === 'calculator') {
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderCalculatorView(root);
        showAlert.info("Profit calculator reset.");
    }
    else if (activeTab === 'history') {
        openManualPriceChangeModal();
    }
};

const handleExport = async () => {
    if (activeTab === 'directory') {
        const supService = getSupplierService(currentWorkspaceId);
        const suppliers = await supService.getAllSuppliers('all');
        exportSuppliersToCSV(suppliers);
    } else if (activeTab === 'pricing') {
        const supService = getSupplierService(currentWorkspaceId);
        const quotes = await supService.getAllSupplierPrices();
        exportQuotesToCSV(quotes);
    } else if (activeTab === 'history') {
        const supService = getSupplierService(currentWorkspaceId);
        const history = await supService.getPriceHistory();
        exportPriceHistoryCSV(history);
    } else {
        showAlert.info("Exporting summary report...");
        const supService = getSupplierService(currentWorkspaceId);
        const suppliers = await supService.getAllSuppliers('all');
        exportSuppliersToCSV(suppliers);
    }
};

const openSupplierModal = (existing = null) => {
    const modalId = 'modal-sup-editor';
    let modal = document.getElementById(modalId);
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.45); z-index: 10000;
        display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    const isEdit = !!existing;

    modal.innerHTML = `
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 540px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">${isEdit ? 'Edit Supplier' : 'Add New Supplier'}</h3>
                <button id="btn-close-sup-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-sup-modal" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem; max-height:80vh; overflow-y:auto;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Supplier Company Title *</label>
                    <input type="text" id="sup-name" required value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Acme Components Ltd." style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Contact Person</label>
                        <input type="text" id="sup-contact" value="${escapeHtml(existing?.contactPerson || '')}" placeholder="Account Rep Name" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Country / Origin</label>
                        <input type="text" id="sup-country" value="${escapeHtml(existing?.country || '')}" placeholder="e.g. United States" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Email</label>
                        <input type="email" id="sup-email" value="${escapeHtml(existing?.email || '')}" placeholder="orders@supplier.com" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Phone</label>
                        <input type="text" id="sup-phone" value="${escapeHtml(existing?.phone || '')}" placeholder="+1 (555) 000-0000" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Physical Address</label>
                    <input type="text" id="sup-address" value="${escapeHtml(existing?.address || '')}" placeholder="Street, City, Postal Code" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Payment Terms</label>
                        <input type="text" id="sup-terms" value="${escapeHtml(existing?.paymentTerms || 'Net 30')}" placeholder="Net 30" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Supplier Status</label>
                        <select id="sup-status" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            <option value="Active" ${existing?.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Inactive" ${existing?.status === 'Inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="Restricted" ${existing?.status === 'Restricted' ? 'selected' : ''}>Restricted</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Internal Notes</label>
                    <textarea id="sup-notes" rows="2" placeholder="Special pricing agreements, contacts, or warehouse instructions..." style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">${escapeHtml(existing?.notes || '')}</textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-sup-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Save Supplier</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-sup-modal').onclick = close;
    modal.querySelector('#btn-cancel-sup-modal').onclick = close;

    modal.querySelector('#form-sup-modal').onsubmit = async (e) => {
        e.preventDefault();
        const supService = getSupplierService(currentWorkspaceId);
        const payload = {
            name: document.getElementById('sup-name').value.trim(),
            contactPerson: document.getElementById('sup-contact').value.trim(),
            country: document.getElementById('sup-country').value.trim() || 'Global',
            email: document.getElementById('sup-email').value.trim(),
            phone: document.getElementById('sup-phone').value.trim(),
            address: document.getElementById('sup-address').value.trim(),
            paymentTerms: document.getElementById('sup-terms').value.trim() || 'Net 30',
            status: document.getElementById('sup-status').value,
            notes: document.getElementById('sup-notes').value.trim()
        };

        if (isEdit) {
            await supService.updateSupplier(existing.id, payload);
            showAlert.success(`Supplier "${payload.name}" updated.`);
        } else {
            await supService.addSupplier(payload);
            showAlert.success(`Supplier "${payload.name}" added to directory.`);
        }

        close();
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderDirectoryView(root);
    };
};

const openPriceQuoteModal = async () => {
    const supService = getSupplierService(currentWorkspaceId);
    const prodService = getProductService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();

    const [suppliers, products] = await Promise.all([
        supService.getAllSuppliers('Active'),
        prodService.getAllProducts()
    ]);

    if (suppliers.length === 0) {
        showAlert.error("Please add at least one Active supplier before logging price quotes.");
        return;
    }

    const modalId = 'modal-quote-editor';
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
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 520px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Record Supplier Price Quote</h3>
                <button id="btn-close-quote-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-quote-modal" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Catalog Product *</label>
                    <select id="quote-product-id" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        ${products.map(p => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-sku="${escapeHtml(p.upcCode || p.uniqueId || 'SKU')}">${escapeHtml(p.name)} (${escapeHtml(p.upcCode || p.uniqueId || 'SKU')})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Supplier Vendor *</label>
                    <select id="quote-supplier-id" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        ${suppliers.map(s => `<option value="${s.id}" data-name="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${s.uniqueId || s.id})</option>`).join('')}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Purchase Unit Cost (${currSym}) *</label>
                        <input type="number" step="0.01" min="0" id="quote-cost" required placeholder="0.00" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Min Order Qty (MOQ)</label>
                        <input type="number" min="1" id="quote-moq" value="1" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Lead Time (Days)</label>
                        <input type="number" min="1" id="quote-lead" value="7" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Quote Valid Until</label>
                        <input type="date" id="quote-valid-to" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-quote-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Save Quote</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-quote-modal').onclick = close;
    modal.querySelector('#btn-cancel-quote-modal').onclick = close;

    modal.querySelector('#form-quote-modal').onsubmit = async (e) => {
        e.preventDefault();
        const prodSelect = document.getElementById('quote-product-id');
        const supSelect = document.getElementById('quote-supplier-id');
        const prodOpt = prodSelect.options[prodSelect.selectedIndex];
        const supOpt = supSelect.options[supSelect.selectedIndex];

        await supService.setSupplierPrice({
            productId: prodSelect.value,
            productName: prodOpt.dataset.name,
            sku: prodOpt.dataset.sku,
            supplierId: supSelect.value,
            supplierName: supOpt.dataset.name,
            costPrice: Number(document.getElementById('quote-cost').value),
            minOrderQty: Number(document.getElementById('quote-moq').value) || 1,
            leadTimeDays: Number(document.getElementById('quote-lead').value) || 7,
            validTo: document.getElementById('quote-valid-to').value || null,
            currency: currSym
        });

        showAlert.success(`Price quote for ${prodOpt.dataset.name} registered.`);
        close();
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderPricingView(root);
    };
};

const openCompetitorModal = async () => {
    const prodService = getProductService(currentWorkspaceId);
    const supService = getSupplierService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();
    const products = await prodService.getAllProducts();

    const modalId = 'modal-comp-editor';
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
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 520px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Log Competitor Observation</h3>
                <button id="btn-close-comp-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-comp-modal" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Target Catalog Product *</label>
                    <select id="comp-product-id" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        ${products.map(p => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-sku="${escapeHtml(p.upcCode || p.uniqueId || 'SKU')}">${escapeHtml(p.name)} (${escapeHtml(p.upcCode || p.uniqueId || 'SKU')})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Competitor Business Name *</label>
                    <input type="text" id="comp-name" required placeholder="e.g. Apex Wholesale Supplies" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Observed Price (${currSym}) *</label>
                        <input type="number" step="0.01" min="0" id="comp-price" required placeholder="0.00" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Observation Date</label>
                        <input type="date" id="comp-date" value="${new Date().toISOString().split('T')[0]}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Information Source</label>
                    <input type="text" id="comp-source" placeholder="e.g. Published Catalog, Customer Quote, Online Storefront" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Notes / Context</label>
                    <textarea id="comp-notes" rows="2" placeholder="Minimum bulk tiers, promotional discount codes, etc..." style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;"></textarea>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-comp-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Save Observation</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-comp-modal').onclick = close;
    modal.querySelector('#btn-cancel-comp-modal').onclick = close;

    modal.querySelector('#form-comp-modal').onsubmit = async (e) => {
        e.preventDefault();
        const prodSelect = document.getElementById('comp-product-id');
        const prodOpt = prodSelect.options[prodSelect.selectedIndex];

        await supService.addCompetitorPrice({
            productId: prodSelect.value,
            productName: prodOpt.dataset.name,
            sku: prodOpt.dataset.sku,
            competitorName: document.getElementById('comp-name').value.trim(),
            competitorPrice: Number(document.getElementById('comp-price').value),
            observationDate: document.getElementById('comp-date').value || new Date().toISOString().split('T')[0],
            source: document.getElementById('comp-source').value.trim() || 'Published Price List',
            notes: document.getElementById('comp-notes').value.trim()
        });

        showAlert.success("Competitor price observation recorded.");
        close();
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderComparisonView(root);
    };
};

const openManualPriceChangeModal = async () => {
    const prodService = getProductService(currentWorkspaceId);
    const supService = getSupplierService(currentWorkspaceId);
    const currSym = getAppCurrencySymbol();
    const products = await prodService.getAllProducts();

    const modalId = 'modal-hist-editor';
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
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 520px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">Log Price Audit Event</h3>
                <button id="btn-close-hist-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-hist-modal" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Target Catalog Product *</label>
                    <select id="hist-product-id" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        ${products.map(p => `<option value="${p.id}" data-name="${escapeHtml(p.name)}" data-sku="${escapeHtml(p.upcCode || p.uniqueId || 'SKU')}" data-price="${p.salePrice || 0}">${escapeHtml(p.name)} (${currSym}${p.salePrice || 0})</option>`).join('')}
                    </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Previous Price (${currSym}) *</label>
                        <input type="number" step="0.01" min="0" id="hist-old-price" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">New Price (${currSym}) *</label>
                        <input type="number" step="0.01" min="0" id="hist-new-price" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Price Metric Type</label>
                    <select id="hist-type" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                        <option value="retail_sale">Retail Selling Price</option>
                        <option value="purchase_cost">Supplier Purchase Cost</option>
                    </select>
                </div>
                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Change Justification / Reason</label>
                    <input type="text" id="hist-reason" placeholder="e.g. Raw material price adjustment, promotional price roll-back" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-hist-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; border-radius:6px; padding:0.45rem 0.85rem; cursor:pointer;">Commit to Audit</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#btn-close-hist-modal').onclick = close;
    modal.querySelector('#btn-cancel-hist-modal').onclick = close;

    modal.querySelector('#form-hist-modal').onsubmit = async (e) => {
        e.preventDefault();
        const prodSelect = document.getElementById('hist-product-id');
        const prodOpt = prodSelect.options[prodSelect.selectedIndex];

        await supService.recordPriceHistory({
            productId: prodSelect.value,
            productName: prodOpt.dataset.name,
            sku: prodOpt.dataset.sku,
            priceType: document.getElementById('hist-type').value,
            oldPrice: Number(document.getElementById('hist-old-price').value),
            newPrice: Number(document.getElementById('hist-new-price').value),
            changeSource: document.getElementById('hist-reason').value.trim() || 'Manual Audit Entry',
            responsibleUserId: 'admin',
            responsibleUserName: 'Workspace Admin'
        });

        showAlert.success("Price change entry written to audit log.");
        close();
        const root = document.querySelector('#supplier-market-view-root');
        if (root) renderHistoryView(root);
    };
};

// =========================================================================
// CSV EXPORTERS
// =========================================================================
const exportSuppliersToCSV = (suppliers) => {
    if (!suppliers || suppliers.length === 0) {
        showAlert.info("No supplier records to export.");
        return;
    }
    const headers = ["ID", "Unique ID", "Name", "Contact Person", "Phone", "Email", "Country", "Status", "Payment Terms"];
    const rows = suppliers.map(s => [
        `"${s.id}"`,
        `"${s.uniqueId || ''}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.contactPerson || '').replace(/"/g, '""')}"`,
        `"${s.phone || ''}"`,
        `"${s.email || ''}"`,
        `"${s.country || ''}"`,
        `"${s.status || 'Active'}"`,
        `"${s.paymentTerms || ''}"`
    ]);
    downloadCSV("pricelister_supplier_directory", headers, rows);
    showAlert.success("Supplier directory exported to CSV.");
};

const exportQuotesToCSV = (quotes) => {
    if (!quotes || quotes.length === 0) {
        showAlert.info("No supplier quotes to export.");
        return;
    }
    const headers = ["Quote ID", "Product", "SKU", "Supplier", "Cost Price", "Currency", "MOQ", "Lead Time Days", "Valid From", "Valid To"];
    const rows = quotes.map(q => [
        `"${q.id}"`,
        `"${(q.productName || '').replace(/"/g, '""')}"`,
        `"${q.sku || ''}"`,
        `"${(q.supplierName || '').replace(/"/g, '""')}"`,
        Number(q.costPrice || 0).toFixed(2),
        `"${q.currency || '$'}"`,
        q.minOrderQty || 1,
        q.leadTimeDays || 7,
        `"${q.validFrom || ''}"`,
        `"${q.validTo || ''}"`
    ]);
    downloadCSV("pricelister_supplier_quotes", headers, rows);
    showAlert.success("Supplier quotes exported to CSV.");
};

const exportPriceHistoryCSV = (history) => {
    if (!history || history.length === 0) {
        showAlert.info("No price history records to export.");
        return;
    }
    const headers = ["Date", "Product", "SKU", "Price Type", "Source / Supplier", "Old Price", "New Price", "Delta Amount", "Delta Percent", "User Attribution"];
    const rows = history.map(h => [
        `"${new Date(h.timestamp || Date.now()).toISOString()}"`,
        `"${(h.productName || '').replace(/"/g, '""')}"`,
        `"${h.sku || ''}"`,
        `"${h.priceType || 'purchase_cost'}"`,
        `"${(h.changeSource || h.supplierName || '').replace(/"/g, '""')}"`,
        Number(h.oldPrice || 0).toFixed(2),
        Number(h.newPrice || 0).toFixed(2),
        Number(h.diffAmount || 0).toFixed(2),
        `"${h.diffPercent || 0}%"`,
        `"${(h.responsibleUserName || h.responsibleUserId || 'System').replace(/"/g, '""')}"`
    ]);
    downloadCSV("pricelister_price_history_audit", headers, rows);
    showAlert.success("Price history audit log exported to CSV.");
};

const downloadCSV = (filenamePrefix, headers, rows) => {
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
