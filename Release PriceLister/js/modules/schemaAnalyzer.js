/**
 * schemaAnalyzer.js
 * PriceLister - Schema Analyzer & Relational Graph Intelligence Hub
 * Comprehensive connection analysis, demand velocity, basket co-occurrence affinity,
 * multi-entity relationship mapping, and schema health diagnostics.
 * Styled with an architectural white canvas and black dotted blueprint grid.
 */

import { getSchemaAnalyzerService } from '../services/schemaAnalyzerService.js';
import { formatCurrency, formatDate } from '../utilities.js';
import { showAlert } from '../alert-handler.js';
import { openInvoiceViewerModal } from './invoiceViewer.js';

// Standard high-definition ERD Schema Icon
const SCHEMA_ICON_SVG = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="8" height="6" rx="1.5"></rect>
        <rect x="14" y="3" width="8" height="6" rx="1.5"></rect>
        <rect x="8" y="15" width="8" height="6" rx="1.5"></rect>
        <line x1="6" y1="9" x2="6" y2="12"></line>
        <line x1="18" y1="9" x2="18" y2="12"></line>
        <line x1="6" y1="12" x2="18" y2="12"></line>
        <line x1="12" y1="12" x2="12" y2="15"></line>
    </svg>
`;

export const renderSchemaAnalyzer = async (container, workspaceId, activeParam = null) => {
    // Initial Skeleton Loader inside Blueprint Canvas
    container.innerHTML = `
        <div class="schema-blueprint-canvas">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="display:inline-flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem;">
                        <div style="width:36px; height:36px; border-radius:10px; background:#18181b; display:flex; align-items:center; justify-content:center; color:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.15);">
                            ${SCHEMA_ICON_SVG}
                        </div>
                        <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:var(--text-primary); letter-spacing:-0.03em;">Schema Analyzer</h2>
                    </div>
                    <p style="color:var(--text-secondary); margin:0; font-size:0.92rem;">Compiling relational graph, timestamp demand velocity, and entity topology...</p>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin-bottom:2rem;">
                ${Array(4).fill(0).map(() => `
                    <div class="schema-card-glass" style="padding: 1.5rem; height: 110px;">
                        <div class="skeleton-shimmer" style="width: 32px; height: 32px; border-radius: 8px; margin-bottom: 12px;"></div>
                        <div class="skeleton-shimmer" style="width: 120px; height: 18px; margin-bottom: 6px;"></div>
                        <div class="skeleton-shimmer" style="width: 80px; height: 14px;"></div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    try {
        const analyzerService = getSchemaAnalyzerService(workspaceId);
        let rawData = await analyzerService.fetchAllData();

        let activeTab = 'product-demand';
        let selectedProductId = null;
        let isFloatingDrawerOpen = false;
        let isFloatingDrawerExpanded = false;
        let activeFloatingSubTab = 'lineage';

        // Parse optional route params
        if (activeParam) {
            const cleanParam = String(activeParam).toLowerCase();
            if (cleanParam.includes('topology') || cleanParam.includes('graph')) {
                activeTab = 'schema-topology';
            } else if (cleanParam.includes('health') || cleanParam.includes('audit')) {
                activeTab = 'schema-health';
            } else if (cleanParam.includes('invoice') || cleanParam.includes('parties')) {
                activeTab = 'invoices-parties';
            } else if (cleanParam.includes('business') || cleanParam.includes('client')) {
                activeTab = 'business-clients';
            } else {
                activeTab = 'product-demand';
                if (activeParam.includes('id=')) {
                    selectedProductId = activeParam.split('id=')[1].split('&')[0];
                }
            }
        }

        // Default selected product to the first product if available
        if (!selectedProductId && rawData.products && rawData.products.length > 0) {
            selectedProductId = rawData.products[0].id || rawData.products[0].uniqueId;
        }

        const renderFullView = () => {
            const topology = analyzerService.computeSchemaTopology(rawData);
            const healthAudit = analyzerService.auditSchemaHealth(rawData);

            const healthColor = healthAudit.healthScore >= 90 ? '#10B981' : (healthAudit.healthScore >= 75 ? '#F59E0B' : '#EF4444');

            container.innerHTML = `
                <div class="schema-blueprint-canvas">
                    <!-- Main Header -->
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.75rem; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <div style="display:inline-flex; align-items:center; gap:0.65rem; margin-bottom:0.25rem;">
                                <div style="width:38px; height:38px; border-radius:10px; background:#18181b; display:flex; align-items:center; justify-content:center; color:#ffffff; box-shadow:0 4px 14px rgba(0,0,0,0.18);">
                                    ${SCHEMA_ICON_SVG}
                                </div>
                                <h2 style="margin:0; font-size:1.85rem; font-weight:800; color:#09090b; letter-spacing:-0.03em;">Schema Analyzer</h2>
                            </div>
                            <p style="color:var(--text-secondary); margin:0; font-size:0.92rem;">
                                Interactive relational intelligence, timestamp demand velocity, basket affinity, and schema integrity map.
                            </p>
                        </div>
                        <div style="display:flex; gap:0.65rem; align-items:center; flex-wrap:wrap;">
                            <button id="btn-export-schema-json" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:6px; background:#ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export Audit JSON
                            </button>
                            <button id="btn-refresh-schema" class="btn btn-secondary" style="font-weight:600; display:inline-flex; align-items:center; gap:6px; background:#ffffff; box-shadow:0 2px 8px rgba(0,0,0,0.04);" title="Synchronize workspace data">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                Sync Data
                            </button>
                        </div>
                    </div>

                    <!-- Top KPI Metric Cards (Glass on Dotted Grid) -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.2rem; margin-bottom:1.75rem;">
                        <!-- Card 1: Total Entities -->
                        <div class="schema-card-glass" style="padding:1.35rem 1.45rem; border-left:4px solid #18181b; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                                    <span>Entities (Nodes)</span>
                                    <span style="font-size:0.68rem; color:#18181b; background:rgba(0,0,0,0.06); padding:0.12rem 0.45rem; border-radius:4px; font-weight:700;">Workspace</span>
                                </div>
                                <div style="font-size:1.95rem; font-weight:800; color:#09090b; margin-top:0.35rem; letter-spacing:-0.03em;">
                                    ${topology.nodeCounts.totalNodes.toLocaleString()}
                                </div>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.4rem;">
                                ${topology.nodeCounts.products} Products &bull; ${topology.nodeCounts.invoices} Invoices &bull; ${topology.nodeCounts.businesses + topology.nodeCounts.clients} Parties
                            </div>
                        </div>

                        <!-- Card 2: Connected Edges -->
                        <div class="schema-card-glass" style="padding:1.35rem 1.45rem; border-left:4px solid #0284c7; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                                    <span>Active Links (Edges)</span>
                                    <span style="font-size:0.68rem; color:#0284c7; background:rgba(2, 132, 199, 0.08); padding:0.12rem 0.45rem; border-radius:4px; font-weight:700;">Relational</span>
                                </div>
                                <div style="font-size:1.95rem; font-weight:800; color:#0284c7; margin-top:0.35rem; letter-spacing:-0.03em;">
                                    ${topology.edgeCounts.totalEdges.toLocaleString()}
                                </div>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.4rem;">
                                ${edgeCountsBreakdown(topology)}
                            </div>
                        </div>

                        <!-- Card 3: Metadata Quality -->
                        <div class="schema-card-glass" style="padding:1.35rem 1.45rem; border-left:4px solid #10B981; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                                    <span>Catalog Completeness</span>
                                    <span style="font-size:0.68rem; color:#10B981; background:rgba(16, 185, 129, 0.08); padding:0.12rem 0.45rem; border-radius:4px; font-weight:700;">Metadata</span>
                                </div>
                                <div style="font-size:1.95rem; font-weight:800; color:#059669; margin-top:0.35rem; letter-spacing:-0.03em;">
                                    ${healthAudit.completenessScore}%
                                </div>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.4rem;">
                                ${healthAudit.counts.missingUpc} Missing UPC &bull; ${healthAudit.counts.missingPrice} Zero-Price Items
                            </div>
                        </div>

                        <!-- Card 4: Schema Health Index -->
                        <div class="schema-card-glass" style="padding:1.35rem 1.45rem; border-left:4px solid ${healthColor}; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; font-weight:700; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                                    <span>Schema Integrity</span>
                                    <span style="font-size:0.68rem; color:${healthColor}; background:${healthColor}15; padding:0.12rem 0.45rem; border-radius:4px; font-weight:700;">
                                        ${healthAudit.healthScore >= 90 ? 'HEALTHY' : (healthAudit.healthScore >= 75 ? 'FAIR' : 'ACTION NEEDED')}
                                    </span>
                                </div>
                                <div style="font-size:1.95rem; font-weight:800; color:${healthColor}; margin-top:0.35rem; letter-spacing:-0.03em;">
                                    ${healthAudit.healthScore}/100
                                </div>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.4rem;">
                                ${healthAudit.issues.length} Schema Diagnostics Detected
                            </div>
                        </div>
                    </div>

                    <!-- Blueprint Navigation Tabs Bar -->
                    <div class="schema-blueprint-tabs">
                        <button class="schema-blueprint-tab-btn ${activeTab === 'product-demand' ? 'active' : ''}" data-tab="product-demand">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline></svg>
                            Product Demand & Connections
                        </button>
                        <button class="schema-blueprint-tab-btn ${activeTab === 'schema-topology' ? 'active' : ''}" data-tab="schema-topology">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="8" height="6" rx="1.5"></rect><rect x="14" y="3" width="8" height="6" rx="1.5"></rect><rect x="8" y="15" width="8" height="6" rx="1.5"></rect><line x1="6" y1="9" x2="6" y2="12"></line><line x1="18" y1="9" x2="18" y2="12"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="12" y1="12" x2="12" y2="15"></line></svg>
                            Schema Topology Graph
                        </button>
                        <button class="schema-blueprint-tab-btn ${activeTab === 'invoices-parties' ? 'active' : ''}" data-tab="invoices-parties">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                            Invoices & Line-Item Links
                        </button>
                        <button class="schema-blueprint-tab-btn ${activeTab === 'business-clients' ? 'active' : ''}" data-tab="business-clients">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path></svg>
                            Parties & Client Matrix
                        </button>
                        <button class="schema-blueprint-tab-btn ${activeTab === 'schema-health' ? 'active' : ''}" data-tab="schema-health">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Health & Orphan Audit (${healthAudit.issues.length})
                        </button>
                    </div>

                    <!-- Active Tab Content Area -->
                    <div id="schema-tab-content"></div>

                    <!-- Floating Connection Inspector Dock Container -->
                    <div id="schema-floating-dock-container"></div>
                </div>
            `;

            // Tab navigation handlers
            container.querySelectorAll('.schema-blueprint-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    activeTab = btn.getAttribute('data-tab');
                    renderFullView();
                });
            });

            // Export JSON audit handler
            const exportBtn = container.querySelector('#btn-export-schema-json');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => {
                    const exportPayload = {
                        workspaceId,
                        timestamp: new Date().toISOString(),
                        topology,
                        healthAudit,
                        counts: {
                            products: rawData.products.length,
                            invoices: rawData.allInvoices.length,
                            categories: rawData.categories.length,
                            parties: rawData.allParties.length
                        }
                    };
                    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Schema_Analysis_Report_${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    showAlert.success('Schema audit JSON exported successfully!');
                });
            }

            // Sync Data handler
            const refreshBtn = container.querySelector('#btn-refresh-schema');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', async () => {
                    refreshBtn.disabled = true;
                    refreshBtn.innerHTML = `<span class="spinner-sm" style="display:inline-block;"></span> Syncing...`;
                    try {
                        rawData = await analyzerService.fetchAllData();
                        showAlert.success('Workspace schema data refreshed successfully!');
                    } catch (e) {
                        showAlert.error('Failed to sync schema data: ' + e.message);
                    } finally {
                        renderFullView();
                    }
                });
            }

            // Route to active tab renderer
            const contentContainer = container.querySelector('#schema-tab-content');
            if (!contentContainer) return;

            switch (activeTab) {
                case 'product-demand':
                    renderProductDemandTab(contentContainer);
                    break;
                case 'schema-topology':
                    renderTopologyTab(contentContainer, topology);
                    break;
                case 'invoices-parties':
                    renderInvoicesPartiesTab(contentContainer);
                    break;
                case 'business-clients':
                    renderBusinessClientsTab(contentContainer);
                    break;
                case 'schema-health':
                    renderSchemaHealthTab(contentContainer, healthAudit);
                    break;
                default:
                    renderProductDemandTab(contentContainer);
            }

            // Render/Update the Floating Connection Tab & Inspector Drawer
            renderFloatingConnectionDock();
        };

        const edgeCountsBreakdown = (topology) => {
            const e = topology.edgeCounts;
            return `${e.productToInvoiceEdges} Line Items &bull; ${e.invoiceToBusinessEdges + e.invoiceToClientEdges} Party Links`;
        };

        // =====================================================================
        // FLOATING CONNECTION TAB & DEEP INSPECTOR SUB-TABS
        // =====================================================================
        const renderLineageSubTab = (detailAnalysis) => {
            const { product, category, summary, invoices, topBuyers } = detailAnalysis;
            return `
                <div style="display:flex; flex-direction:column; gap:1.15rem;">
                    <!-- Interactive Visual Breadcrumb Chain -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.1rem; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                        <div style="font-size:0.72rem; text-transform:uppercase; font-weight:800; color:#64748b; letter-spacing:0.04em; margin-bottom:0.75rem;">
                            Relational Breadcrumb Trail
                        </div>
                        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:0.45rem; font-size:0.78rem; font-weight:700;">
                            <span style="background:#18181b; color:#fff; padding:0.25rem 0.6rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">🏢 Workspace</span>
                            <span style="color:#94a3b8; font-weight:800;">&rarr;</span>
                            <span style="background:#0284c7; color:#fff; padding:0.25rem 0.6rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">📁 ${category ? category.name : 'Category'}</span>
                            <span style="color:#94a3b8; font-weight:800;">&rarr;</span>
                            <span style="background:#059669; color:#fff; padding:0.25rem 0.6rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">📦 ${product.name || 'Product'}</span>
                            <span style="color:#94a3b8; font-weight:800;">&rarr;</span>
                            <span style="background:#d97706; color:#fff; padding:0.25rem 0.6rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">📑 ${invoices.length} Invoices</span>
                            <span style="color:#94a3b8; font-weight:800;">&rarr;</span>
                            <span style="background:#7c3aed; color:#fff; padding:0.25rem 0.6rem; border-radius:6px; display:inline-flex; align-items:center; gap:4px;">👥 ${topBuyers.length} Buyers</span>
                        </div>
                    </div>

                    <!-- Two-Column Architecture Topology Breakdown -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.9rem;">
                        <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1rem; border-left:4px solid #0284c7;">
                            <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#0284c7; margin-bottom:0.4rem;">Upstream Lineage</div>
                            <div style="font-size:0.86rem; font-weight:700; color:#09090b; margin-bottom:0.25rem;">Taxonomy & Origin</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">
                                Grouped under <strong>${category ? category.name : 'Unassigned'}</strong>.<br>
                                Barcode/UPC: <code style="font-family:monospace; font-size:0.72rem; color:#09090b;">${product.upcCode || 'None'}</code><br>
                                Cost Base: ${formatCurrency(product.price || 0)}
                            </div>
                        </div>

                        <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1rem; border-left:4px solid #059669;">
                            <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#059669; margin-bottom:0.4rem;">Downstream Connections</div>
                            <div style="font-size:0.86rem; font-weight:700; color:#09090b; margin-bottom:0.25rem;">Market Dispersal</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">
                                Referenced in <strong>${invoices.length} invoices</strong>.<br>
                                Volume Sold: <strong>${summary.totalQuantityInvoiced.toLocaleString()} units</strong>.<br>
                                Revenue: <strong>${formatCurrency(summary.totalRevenueGenerated)}</strong>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Jump Node Summary -->
                    <div style="background:#fafafa; border:1px dashed rgba(0,0,0,0.12); border-radius:10px; padding:0.9rem 1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                            <span style="color:var(--text-muted); font-weight:600;">Entity Lineage Node Hash:</span>
                            <code style="font-family:monospace; font-size:0.72rem; color:#18181b; background:rgba(0,0,0,0.06); padding:0.15rem 0.4rem; border-radius:4px;">${product.id || product.uniqueId || 'PRD'}</code>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderMathSubTab = (detailAnalysis) => {
            const { product, summary, advancedMath, coOccurrenceList } = detailAnalysis;
            const topPair = coOccurrenceList.length > 0 ? coOccurrenceList[0] : null;

            return `
                <div style="display:flex; flex-direction:column; gap:1.15rem;">
                    <!-- Formula Card 1: Apriori Association Rule Mining -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.15rem; border-left:4px solid #18181b; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                            <div style="font-weight:800; font-size:0.9rem; color:#09090b;">Apriori Basket Lift & Affinity</div>
                            <span style="font-size:0.7rem; font-weight:800; padding:0.12rem 0.5rem; border-radius:4px; background:#18181b; color:#fff;">
                                ${topPair ? topPair.lift + 'x Max Lift' : 'Baseline 1.0x'}
                            </span>
                        </div>
                        <div style="background:#f4f4f5; border-radius:8px; padding:0.6rem 0.8rem; margin-bottom:0.75rem; font-family:monospace; font-size:0.75rem; color:#18181b; overflow-x:auto;">
                            Lift(A &rarr; B) = P(A &cap; B) / (P(A) &bull; P(B)) = (coCount &bull; N) / (freqA &bull; freqB)
                        </div>
                        <p style="font-size:0.78rem; color:var(--text-secondary); margin:0 0 0.75rem 0; line-height:1.45;">
                            Measures whether pairing item B with "${product.name || 'target'}" occurs by consumer preference rather than random chance. Lift &gt; 1 indicates complementary basket affinity.
                        </p>

                        ${coOccurrenceList.length > 0 ? `
                            <div style="display:flex; flex-direction:column; gap:0.45rem;">
                                ${coOccurrenceList.slice(0, 5).map(co => `
                                    <div style="padding:0.5rem 0.7rem; border-radius:8px; background:#f8fafc; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                                        <div>
                                            <div style="font-weight:700; color:#09090b;">${co.productName}</div>
                                            <div style="font-size:0.7rem; color:var(--text-muted);">${co.coInvoicedCount} invoices &bull; ${co.confidencePct}% confidence</div>
                                        </div>
                                        <div style="text-align:right;">
                                            <span style="font-size:0.7rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:4px; background:${co.liftColor}18; color:${co.liftColor};">
                                                ${co.lift}x Lift
                                            </span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `<div style="font-size:0.78rem; color:var(--text-muted); text-align:center; padding:0.75rem;">No multi-item pairings recorded for this catalog item.</div>`}
                    </div>

                    <!-- Formula Card 2: Demand Volatility (CV) -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.15rem; border-left:4px solid ${advancedMath.volatilityColor}; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                            <div style="font-weight:800; font-size:0.9rem; color:#09090b;">Demand Volatility Index (CV)</div>
                            <span style="font-size:0.7rem; font-weight:800; padding:0.12rem 0.5rem; border-radius:4px; background:${advancedMath.volatilityColor}18; color:${advancedMath.volatilityColor};">
                                ${advancedMath.volatilityLabel}
                            </span>
                        </div>
                        <div style="background:#f4f4f5; border-radius:8px; padding:0.6rem 0.8rem; margin-bottom:0.75rem; font-family:monospace; font-size:0.75rem; color:#18181b;">
                            CV = &sigma; / &mu; = ${advancedMath.volatilityCV} (StdDev / Mean Monthly Demand)
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem; font-size:0.76rem;">
                            <div style="background:#fafafa; padding:0.5rem 0.65rem; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                                <div style="color:var(--text-muted); font-size:0.68rem; font-weight:700; text-transform:uppercase;">Daily Burn Rate</div>
                                <div style="font-size:0.95rem; font-weight:800; color:#09090b; margin-top:2px;">${summary.dailyBurnRate} units/day</div>
                            </div>
                            <div style="background:#fafafa; padding:0.5rem 0.65rem; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                                <div style="color:var(--text-muted); font-size:0.68rem; font-weight:700; text-transform:uppercase;">Stock Runway</div>
                                <div style="font-size:0.95rem; font-weight:800; color:#09090b; margin-top:2px;">${summary.stockRunwayDays === 999 ? '&infin;' : summary.stockRunwayDays} days</div>
                            </div>
                        </div>
                    </div>

                    <!-- Formula Card 3: GMROI & Capital Productivity -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.15rem; border-left:4px solid #059669; box-shadow:0 1px 4px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
                            <div style="font-weight:800; font-size:0.9rem; color:#09090b;">GMROI & Capital Yield</div>
                            <span style="font-size:0.7rem; font-weight:800; padding:0.12rem 0.5rem; border-radius:4px; background:#05966918; color:#059669;">
                                ${advancedMath.gmroi}% GMROI
                            </span>
                        </div>
                        <div style="background:#f4f4f5; border-radius:8px; padding:0.6rem 0.8rem; margin-bottom:0.75rem; font-family:monospace; font-size:0.75rem; color:#18181b;">
                            GMROI = (Gross Margin $ / Average Inventory Cost) &bull; 100%
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.6rem; font-size:0.76rem;">
                            <div style="background:#fafafa; padding:0.5rem 0.65rem; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                                <div style="color:var(--text-muted); font-size:0.68rem; font-weight:700; text-transform:uppercase;">Gross Margin %</div>
                                <div style="font-size:0.95rem; font-weight:800; color:#059669; margin-top:2px;">${advancedMath.grossMarginPct}%</div>
                            </div>
                            <div style="background:#fafafa; padding:0.5rem 0.65rem; border-radius:6px; border:1px solid rgba(0,0,0,0.05);">
                                <div style="color:var(--text-muted); font-size:0.68rem; font-weight:700; text-transform:uppercase;">Catalog Profit Contribution</div>
                                <div style="font-size:0.95rem; font-weight:800; color:#09090b; margin-top:2px;">${advancedMath.profitContributionPct}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderRestockSubTab = (detailAnalysis) => {
            const { summary, advancedMath } = detailAnalysis;
            const progressPct = advancedMath.reorderPoint > 0
                ? Math.min(100, Math.round((summary.currentStock / advancedMath.reorderPoint) * 100))
                : 100;

            return `
                <div style="display:flex; flex-direction:column; gap:1.15rem;">
                    <!-- Inventory Health Status Banner -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.25rem; border-left:4px solid ${advancedMath.stockStatusColor};">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
                            <div style="font-size:0.72rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Inventory Replenishment Status</div>
                            <span style="font-size:0.7rem; font-weight:800; padding:0.15rem 0.55rem; border-radius:4px; background:${advancedMath.stockStatusColor}18; color:${advancedMath.stockStatusColor};">
                                ${advancedMath.stockStatusLabel}
                            </span>
                        </div>
                        <div style="font-size:1.6rem; font-weight:800; color:#09090b; letter-spacing:-0.02em;">
                            ${summary.currentStock} Units On Hand
                        </div>
                        <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.25rem;">
                            Runway: ~${summary.stockRunwayDays === 999 ? '&infin;' : summary.stockRunwayDays} days at current daily burn (${summary.dailyBurnRate} units/day)
                        </div>
                    </div>

                    <!-- Mathematical Parameters Grid -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                        <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:10px; padding:0.85rem 1rem;">
                            <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Reorder Point (ROP)</div>
                            <div style="font-size:1.35rem; font-weight:800; color:#09090b; margin-top:2px;">${advancedMath.reorderPoint} <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">units</span></div>
                            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">Trigger point for PO</div>
                        </div>

                        <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:10px; padding:0.85rem 1rem;">
                            <div style="font-size:0.68rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Safety Buffer (SS)</div>
                            <div style="font-size:1.35rem; font-weight:800; color:#0284c7; margin-top:2px;">${advancedMath.safetyStock} <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted);">units</span></div>
                            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:2px;">Z=1.65 (95% service level)</div>
                        </div>
                    </div>

                    <!-- Visual Inventory Level vs ROP Gauge -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:12px; padding:1.1rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; font-weight:700; margin-bottom:0.4rem;">
                            <span>Current vs Reorder Threshold</span>
                            <span style="color:#09090b;">${progressPct}% of threshold</span>
                        </div>
                        <div style="width:100%; height:8px; background:rgba(0,0,0,0.06); border-radius:4px; overflow:hidden; margin-bottom:0.75rem;">
                            <div style="width:${progressPct}%; height:100%; background:${advancedMath.stockStatusColor}; border-radius:4px;"></div>
                        </div>
                        <div style="font-size:0.72rem; color:var(--text-muted); line-height:1.4;">
                            Formula: <code>ROP = (Daily Demand &bull; Lead Time 7d) + Safety Stock</code>.<br>
                            When current stock hits or dips below ${advancedMath.reorderPoint} units, reorder is automatically recommended.
                        </div>
                    </div>
                </div>
            `;
        };

        const renderRetentionSubTab = (detailAnalysis) => {
            const { topBuyers } = detailAnalysis;

            return `
                <div style="display:flex; flex-direction:column; gap:0.9rem;">
                    <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">
                        Recency, Frequency, and Monetary (RFM) segmentation with dynamic customer loyalty indexing.
                    </div>

                    ${topBuyers.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            ${topBuyers.map((tb, idx) => `
                                <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:10px; padding:0.85rem 1rem; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                                        <div style="display:flex; align-items:center; gap:0.5rem;">
                                            <span style="font-weight:800; font-size:0.88rem; color:#09090b;">${idx + 1}. ${tb.partyName}</span>
                                            <span style="font-size:0.65rem; padding:0.1rem 0.35rem; border-radius:4px; font-weight:700; ${tb.partyType === 'Business' ? 'background:#E0E7FF; color:#4338CA;' : 'background:#DCFCE7; color:#15803D;'}">
                                                ${tb.partyType}
                                            </span>
                                        </div>
                                        <span style="font-size:0.7rem; font-weight:800; padding:0.12rem 0.45rem; border-radius:4px; background:${tb.retentionColor}18; color:${tb.retentionColor};">
                                            ${tb.retentionLabel}
                                        </span>
                                    </div>

                                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.5rem; font-size:0.75rem; color:var(--text-muted); margin-bottom:0.55rem;">
                                        <div>Invoices: <strong style="color:#09090b;">${tb.invoiceCount}</strong></div>
                                        <div>Volume: <strong style="color:#09090b;">${tb.totalQuantity} units</strong></div>
                                        <div>Spend: <strong style="color:#059669;">${formatCurrency(tb.totalSpend)}</strong></div>
                                    </div>

                                    <!-- Loyalty Index Bar -->
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <span style="font-size:0.68rem; font-weight:700; color:var(--text-muted); white-space:nowrap;">Loyalty: ${tb.loyaltyIndex}/100</span>
                                        <div style="flex:1; height:5px; background:rgba(0,0,0,0.06); border-radius:3px; overflow:hidden;">
                                            <div style="width:${tb.loyaltyIndex}%; height:100%; background:${tb.retentionColor}; border-radius:3px;"></div>
                                        </div>
                                        <span style="font-size:0.68rem; color:var(--text-secondary); white-space:nowrap;">${tb.daysSinceLastOrder === 999 ? 'N/A' : tb.daysSinceLastOrder + 'd ago'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No customer or business order history recorded yet.</div>`}
                </div>
            `;
        };

        const renderInvoicesSubTab = (detailAnalysis) => {
            const { invoices } = detailAnalysis;

            return `
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78rem;">
                        <span style="color:var(--text-muted); font-weight:600;">Direct Linked Invoices (${invoices.length})</span>
                        <span style="font-size:0.7rem; color:var(--text-secondary);">Click Inspect for modal view</span>
                    </div>

                    ${invoices.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:360px; overflow-y:auto; padding-right:4px;">
                            ${invoices.map(inv => `
                                <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:8px; padding:0.65rem 0.85rem; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                                    <div>
                                        <div style="font-weight:700; font-size:0.84rem; color:#09090b; display:flex; align-items:center; gap:0.4rem;">
                                            <span>${inv.invoiceNumber}</span>
                                            <span style="font-size:0.65rem; padding:0.08rem 0.35rem; border-radius:4px; font-weight:700; ${inv.isBusinessInvoice ? 'background:#E0E7FF; color:#4338CA;' : 'background:#DCFCE7; color:#15803D;'}">
                                                ${inv.isBusinessInvoice ? 'B2B' : 'B2C'}
                                            </span>
                                        </div>
                                        <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                                            ${inv.partyName} &bull; ${inv.dateFormatted} &bull; <strong>${inv.quantity} units</strong>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <div style="text-align:right;">
                                            <div style="font-weight:800; font-size:0.88rem; color:#09090b;">${formatCurrency(inv.totalPrice)}</div>
                                        </div>
                                        <button class="btn btn-sm btn-secondary schema-btn-drawer-inspect-inv" data-id="${inv.id || inv.uniqueId}" style="padding:0.2rem 0.55rem; font-size:0.72rem; font-weight:700; background:#ffffff;">
                                            Inspect
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No invoices have been created with this product yet.</div>`}
                </div>
            `;
        };

        const renderDrawerSubTabBody = (subtab, detailAnalysis) => {
            switch (subtab) {
                case 'lineage':
                    return renderLineageSubTab(detailAnalysis);
                case 'math':
                    return renderMathSubTab(detailAnalysis);
                case 'restock':
                    return renderRestockSubTab(detailAnalysis);
                case 'retention':
                    return renderRetentionSubTab(detailAnalysis);
                case 'invoices':
                    return renderInvoicesSubTab(detailAnalysis);
                default:
                    return renderLineageSubTab(detailAnalysis);
            }
        };

        // =====================================================================
        // FLOATING CONNECTION TAB & DEEP INSPECTOR DOCK
        // =====================================================================
        const renderFloatingConnectionDock = () => {
            const dockContainer = container.querySelector('#schema-floating-dock-container');
            if (!dockContainer) return;

            const detailAnalysis = selectedProductId ? analyzerService.analyzeProductConnections(selectedProductId, rawData) : null;
            if (!detailAnalysis) {
                dockContainer.innerHTML = '';
                return;
            }

            const { product, category, summary, invoices, orders, coOccurrenceList, topBuyers } = detailAnalysis;
            const topPair = coOccurrenceList.length > 0 ? coOccurrenceList[0] : null;

            dockContainer.innerHTML = `
                <!-- Floating Pill Trigger (Pinned Bottom-Right) -->
                <button id="schema-floating-pill-trigger" class="schema-floating-pill" style="${isFloatingDrawerOpen ? 'display:none;' : ''}" title="Inspect deep entity lineage & mathematical calculations">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10B981; box-shadow:0 0 8px #10B981;"></span>
                    <span>⚡ Connection Inspector: <strong>${(product.name || 'Product').slice(0, 16)}${(product.name || '').length > 16 ? '...' : ''}</strong></span>
                    <span style="font-size:0.7rem; background:rgba(255,255,255,0.22); padding:0.12rem 0.5rem; border-radius:999px; font-weight:800;">
                        ${invoices.length} Links &bull; ${topPair ? topPair.lift + 'x Lift' : 'Apriori'}
                    </span>
                </button>

                <!-- Floating Connection Drawer Panel -->
                <div id="schema-floating-drawer" class="schema-floating-drawer ${isFloatingDrawerExpanded ? 'expanded' : ''}" style="${isFloatingDrawerOpen ? 'display:flex;' : 'display:none;'}">
                    <!-- Drawer Header -->
                    <div class="schema-drawer-header">
                        <div style="display:flex; align-items:center; gap:0.65rem;">
                            <div style="width:34px; height:34px; border-radius:8px; background:#18181b; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.15);">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            </div>
                            <div>
                                <div style="font-weight:800; font-size:0.95rem; color:#09090b; display:flex; align-items:center; gap:0.4rem;">
                                    <span>${product.name || 'Unnamed Product'}</span>
                                    <span style="font-size:0.65rem; padding:0.1rem 0.35rem; border-radius:4px; background:rgba(0,0,0,0.06); font-weight:700;">
                                        ${category ? category.name : 'Catalog'}
                                    </span>
                                </div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">
                                    Relational Lineage & Advanced Mathematical Model
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.35rem;">
                            <button id="btn-toggle-expand-drawer" class="btn btn-sm btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem; background:#ffffff;" title="${isFloatingDrawerExpanded ? 'Standard width' : 'Expand width'}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
                            </button>
                            <button id="btn-close-floating-drawer" class="btn btn-sm btn-secondary" style="padding:0.25rem 0.5rem; font-size:0.75rem; background:#ffffff;" title="Close Inspector">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Subtabs Navigation Bar -->
                    <div class="schema-drawer-subtabs">
                        <button class="schema-drawer-subtab-btn ${activeFloatingSubTab === 'lineage' ? 'active' : ''}" data-subtab="lineage">
                            1. Lineage Trail
                        </button>
                        <button class="schema-drawer-subtab-btn ${activeFloatingSubTab === 'math' ? 'active' : ''}" data-subtab="math">
                            2. Lift & Math
                        </button>
                        <button class="schema-drawer-subtab-btn ${activeFloatingSubTab === 'restock' ? 'active' : ''}" data-subtab="restock">
                            3. Restock Radar
                        </button>
                        <button class="schema-drawer-subtab-btn ${activeFloatingSubTab === 'retention' ? 'active' : ''}" data-subtab="retention">
                            4. Buyer Retention
                        </button>
                        <button class="schema-drawer-subtab-btn ${activeFloatingSubTab === 'invoices' ? 'active' : ''}" data-subtab="invoices">
                            5. Invoices (${invoices.length})
                        </button>
                    </div>

                    <!-- Drawer Content Body -->
                    <div class="schema-drawer-body">
                        ${renderDrawerSubTabBody(activeFloatingSubTab, detailAnalysis)}
                    </div>
                </div>
            `;

            // Event handlers for drawer controls
            const pill = dockContainer.querySelector('#schema-floating-pill-trigger');
            if (pill) {
                pill.addEventListener('click', () => {
                    isFloatingDrawerOpen = true;
                    renderFloatingConnectionDock();
                });
            }

            const closeBtn = dockContainer.querySelector('#btn-close-floating-drawer');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    isFloatingDrawerOpen = false;
                    renderFloatingConnectionDock();
                });
            }

            const expandBtn = dockContainer.querySelector('#btn-toggle-expand-drawer');
            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    isFloatingDrawerExpanded = !isFloatingDrawerExpanded;
                    renderFloatingConnectionDock();
                });
            }

            dockContainer.querySelectorAll('.schema-drawer-subtab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    activeFloatingSubTab = btn.getAttribute('data-subtab');
                    renderFloatingConnectionDock();
                });
            });

            // Invoices inspect handlers inside drawer
            dockContainer.querySelectorAll('.schema-btn-drawer-inspect-inv').forEach(btn => {
                btn.addEventListener('click', () => {
                    const invId = btn.getAttribute('data-id');
                    const fullInv = rawData.allInvoices.find(i => String(i.id) === String(invId) || String(i.uniqueId) === String(invId));
                    if (fullInv) openInvoiceViewerModal(fullInv);
                });
            });
        };

        // =====================================================================
        // TAB 1: PRODUCT DEMAND & CONNECTIONS
        // =====================================================================
        const renderProductDemandTab = (tabContainer) => {
            tabContainer.innerHTML = `
                <div style="display:grid; grid-template-columns: 340px 1fr; gap:1.5rem; align-items:start;">
                    
                    <!-- Left: Searchable Product Selector -->
                    <div class="schema-card-glass" style="padding:1.35rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                            <h3 style="font-size:1rem; font-weight:800; margin:0; color:#09090b;">Catalog Products</h3>
                            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">${rawData.products.length} Products</span>
                        </div>
                        
                        <!-- Search Box -->
                        <div style="position:relative; margin-bottom:0.75rem;">
                            <input type="text" id="schema-prd-search" class="form-control" placeholder="Search by name, UPC..." style="width:100%; padding-left:2.2rem; font-size:0.86rem; background:#ffffff;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); color:var(--text-muted);"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>

                        <!-- Filter Chips -->
                        <div style="display:flex; gap:0.35rem; margin-bottom:1rem; overflow-x:auto;">
                            <button class="btn btn-sm btn-primary schema-prd-filter" data-filter="ALL" style="font-size:0.72rem; padding:0.2rem 0.55rem; background:#18181b; color:#fff;">All</button>
                            <button class="btn btn-sm btn-secondary schema-prd-filter" data-filter="HIGH_DEMAND" style="font-size:0.72rem; padding:0.2rem 0.55rem; background:#ffffff;">High Demand</button>
                            <button class="btn btn-sm btn-secondary schema-prd-filter" data-filter="LOW_STOCK" style="font-size:0.72rem; padding:0.2rem 0.55rem; background:#ffffff;">Low Stock</button>
                            <button class="btn btn-sm btn-secondary schema-prd-filter" data-filter="DORMANT" style="font-size:0.72rem; padding:0.2rem 0.55rem; background:#ffffff;">Dormant</button>
                        </div>

                        <!-- Product List -->
                        <div id="schema-prd-list" style="max-height:550px; overflow-y:auto; display:flex; flex-direction:column; gap:0.45rem; padding-right:4px;">
                            <!-- Injected dynamically -->
                        </div>
                    </div>

                    <!-- Right: Product Relational Connections & Demand View -->
                    <div id="schema-prd-detail-view">
                        <!-- Injected dynamically -->
                    </div>

                </div>
            `;

            const searchInput = tabContainer.querySelector('#schema-prd-search');
            const listContainer = tabContainer.querySelector('#schema-prd-list');
            let currentFilter = 'ALL';

            const populateProductList = () => {
                const query = (searchInput?.value || '').trim().toLowerCase();

                let filtered = rawData.products.filter(p => {
                    const matchQ = !query || String(p.name || '').toLowerCase().includes(query) || String(p.upcCode || '').includes(query);
                    if (!matchQ) return false;

                    if (currentFilter === 'LOW_STOCK') {
                        return (Number(p.quantity) || 0) <= 5;
                    }
                    return true;
                });

                if (filtered.length === 0) {
                    listContainer.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No products match query.</div>`;
                    return;
                }

                listContainer.innerHTML = filtered.map(p => {
                    const isSelected = String(p.id || p.uniqueId) === String(selectedProductId);
                    const stock = Number(p.quantity) || 0;
                    return `
                        <div class="schema-prd-item ${isSelected ? 'selected' : ''}" data-id="${p.id || p.uniqueId}" style="padding:0.7rem 0.85rem; border-radius:10px; border:1px solid ${isSelected ? '#18181b' : 'rgba(0,0,0,0.08)'}; background:${isSelected ? '#ffffff' : 'rgba(255,255,255,0.7)'}; cursor:pointer; transition:all 0.18s ease; display:flex; justify-content:space-between; align-items:center; box-shadow:${isSelected ? '0 4px 12px rgba(0,0,0,0.08)' : 'none'};">
                            <div style="overflow:hidden; padding-right:8px;">
                                <div style="font-weight:700; font-size:0.88rem; color:#09090b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name || 'Unnamed Product'}</div>
                                <div style="font-size:0.75rem; color:var(--text-muted);">${formatCurrency(p.salePrice || p.price || 0)} &bull; ${stock} in stock</div>
                            </div>
                            <span class="status-pill" style="font-size:0.65rem; padding:0.12rem 0.4rem; ${stock <= 3 ? 'background:#FEE2E2; color:#DC2626;' : 'background:#F1F5F9; color:#475569;'}">${stock} left</span>
                        </div>
                    `;
                }).join('');

                listContainer.querySelectorAll('.schema-prd-item').forEach(item => {
                    item.addEventListener('click', () => {
                        selectedProductId = item.getAttribute('data-id');
                        populateProductList();
                        renderProductDetail();
                    });
                });
            };

            tabContainer.querySelectorAll('.schema-prd-filter').forEach(btn => {
                btn.addEventListener('click', () => {
                    tabContainer.querySelectorAll('.schema-prd-filter').forEach(b => {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                        b.style.background = '#ffffff';
                        b.style.color = '#000000';
                    });
                    btn.classList.add('btn-primary');
                    btn.classList.remove('btn-secondary');
                    btn.style.background = '#18181b';
                    btn.style.color = '#ffffff';
                    currentFilter = btn.getAttribute('data-filter');
                    populateProductList();
                });
            });

            if (searchInput) searchInput.addEventListener('input', populateProductList);
            populateProductList();

            // Right column detailed view
            const renderProductDetail = () => {
                const detailContainer = tabContainer.querySelector('#schema-prd-detail-view');
                if (!detailContainer) return;

                const detailAnalysis = selectedProductId ? analyzerService.analyzeProductConnections(selectedProductId, rawData) : null;

                if (!detailAnalysis) {
                    detailContainer.innerHTML = `
                        <div class="schema-card-glass" style="padding:3.5rem 2rem; text-align:center; color:var(--text-muted);">
                            <div style="width:48px; height:48px; border-radius:12px; background:rgba(0,0,0,0.04); display:flex; align-items:center; justify-content:center; margin:0 auto 1rem auto; color:#52525b;">
                                ${SCHEMA_ICON_SVG}
                            </div>
                            <h4 style="margin:0 0 0.35rem 0; font-size:1.15rem; color:#09090b; font-weight:700;">No Product Selected</h4>
                            <p style="margin:0; font-size:0.9rem;">Choose a catalog item on the left to analyze its connections, demand velocity, and basket affinity.</p>
                        </div>
                    `;
                    return;
                }

                const { product, category, summary, advancedMath, invoices, orders, coOccurrenceList, topBuyers, timeline } = detailAnalysis;
                const topCo = coOccurrenceList.length > 0 ? coOccurrenceList[0] : null;

                const maxMonthlyQty = Math.max(...timeline.monthly.map(m => m.qty), 1);
                const maxDayQty = Math.max(...timeline.dayOfWeek.map(d => d.qty), 1);

                detailContainer.innerHTML = `
                    <!-- Product Header Profile Card -->
                    <div class="schema-card-glass" style="padding:1.4rem 1.6rem; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                        <div style="display:flex; align-items:center; gap:1.15rem;">
                            <div style="width:54px; height:54px; border-radius:12px; background:#f4f4f5; border:1px solid rgba(0,0,0,0.1); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:1.25rem; color:#18181b; overflow:hidden;">
                                ${product.imageUri ? `<img src="${product.imageUri}" style="width:100%; height:100%; object-fit:cover;">` : (product.name ? product.name.charAt(0).toUpperCase() : 'P')}
                            </div>
                            <div>
                                <div style="display:flex; align-items:center; gap:0.55rem; flex-wrap:wrap;">
                                    <h3 style="margin:0; font-size:1.35rem; font-weight:800; color:#09090b; letter-spacing:-0.02em;">${product.name || 'Unnamed Product'}</h3>
                                    <span class="status-pill status-pill-active" style="font-size:0.72rem; padding:0.15rem 0.55rem; background:#18181b; color:#fff; font-weight:700;">
                                        ${category ? category.name : 'Uncategorized'}
                                    </span>
                                </div>
                                <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.25rem;">
                                    UPC: <code style="font-family:monospace; font-weight:700; color:#09090b;">${product.upcCode || 'None'}</code> &bull; Base Cost: ${formatCurrency(product.price || 0)} &bull; Sale Price: <strong>${formatCurrency(product.salePrice || 0)}</strong>
                                </div>
                            </div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.6rem;">
                            <div style="text-align:right;">
                                <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">Available Stock</div>
                                <div style="font-size:1.35rem; font-weight:800; color:${summary.currentStock <= 5 ? '#EF4444' : '#10B981'};">
                                    ${summary.currentStock} Units in Catalog
                                </div>
                                <div style="font-size:0.75rem; color:var(--text-secondary);">
                                    Runway: ~${summary.stockRunwayDays === 999 ? '&infin;' : summary.stockRunwayDays} days at current demand
                                </div>
                            </div>
                            <button id="btn-open-floating-connection" class="btn btn-sm btn-primary" style="background:#18181b; color:#fff; display:inline-flex; align-items:center; gap:6px; font-weight:700; font-size:0.78rem; padding:0.4rem 0.85rem; border-radius:8px; box-shadow:0 3px 10px rgba(0,0,0,0.15); cursor:pointer;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                <span>Floating Connection Inspector</span>
                            </button>
                        </div>
                    </div>

                    <!-- 4 Standard Product KPI Metric Tiles -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.25rem;">
                        <div class="schema-card-glass" style="padding:1.1rem 1.25rem; border-left:4px solid #18181b;">
                            <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Lifetime Quantity Sold</div>
                            <div style="font-size:1.55rem; font-weight:800; color:#09090b; margin-top:0.25rem;">${summary.totalQuantityInvoiced.toLocaleString()}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">Across ${summary.totalInvoicesCount} invoices</div>
                        </div>
                        <div class="schema-card-glass" style="padding:1.1rem 1.25rem; border-left:4px solid #10B981;">
                            <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Total Revenue Made</div>
                            <div style="font-size:1.55rem; font-weight:800; color:#059669; margin-top:0.25rem;">${formatCurrency(summary.totalRevenueGenerated)}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">Net Profit: ${formatCurrency(summary.totalProfitGenerated)}</div>
                        </div>
                        <div class="schema-card-glass" style="padding:1.1rem 1.25rem; border-left:4px solid #D97706;">
                            <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Demand Velocity (30d)</div>
                            <div style="font-size:1.55rem; font-weight:800; color:#d97706; margin-top:0.25rem;">${summary.qtyLast30Days} <span style="font-size:0.85rem; font-weight:600;">units</span></div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">${summary.dailyBurnRate} units/day avg</div>
                        </div>
                        <div class="schema-card-glass" style="padding:1.1rem 1.25rem; border-left:4px solid #0284C7;">
                            <div style="font-size:0.72rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Peak Demand Day</div>
                            <div style="font-size:1.55rem; font-weight:800; color:#0284c7; margin-top:0.25rem;">${summary.peakDayName}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;">Highest purchase frequency</div>
                        </div>
                    </div>

                    <!-- 4 Advanced Mathematical Calculations Cards -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                        <!-- Card 1: Apriori Basket Association Lift -->
                        <div class="schema-card-glass" style="padding:1.15rem 1.25rem; border-left:4px solid #18181b; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Apriori Basket Lift</span>
                                    <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:${topCo ? topCo.liftColor : '#64748b'}18; color:${topCo ? topCo.liftColor : '#64748b'};">
                                        ${topCo ? topCo.liftLabel : 'Independent'}
                                    </span>
                                </div>
                                <div style="font-size:1.6rem; font-weight:800; color:#09090b;">
                                    ${topCo ? topCo.lift + 'x Lift' : '1.0x Baseline'}
                                </div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.4rem; line-height:1.35;">
                                ${topCo ? `Confidence: <strong>${topCo.confidencePct}%</strong> with ${topCo.productName}` : 'No multi-item pairings recorded'}
                            </div>
                        </div>

                        <!-- Card 2: Demand Volatility Index (CV) -->
                        <div class="schema-card-glass" style="padding:1.15rem 1.25rem; border-left:4px solid ${advancedMath.volatilityColor}; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Demand Volatility (CV)</span>
                                    <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:${advancedMath.volatilityColor}18; color:${advancedMath.volatilityColor};">
                                        ${advancedMath.volatilityLabel}
                                    </span>
                                </div>
                                <div style="font-size:1.6rem; font-weight:800; color:#09090b;">
                                    ${advancedMath.volatilityCV} <span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">&sigma;/&mu;</span>
                                </div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.4rem; line-height:1.35;">
                                StdDev / Mean Monthly Demand Ratio
                            </div>
                        </div>

                        <!-- Card 3: GMROI & Capital Productivity -->
                        <div class="schema-card-glass" style="padding:1.15rem 1.25rem; border-left:4px solid #059669; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Capital Yield (GMROI)</span>
                                    <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:#05966918; color:#059669;">
                                        Gross Margin ROI
                                    </span>
                                </div>
                                <div style="font-size:1.6rem; font-weight:800; color:#059669;">
                                    ${advancedMath.gmroi}%
                                </div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.4rem; line-height:1.35;">
                                Margin: <strong>${advancedMath.grossMarginPct}%</strong> &bull; Holding: ${formatCurrency(advancedMath.inventoryHoldingCost)}
                            </div>
                        </div>

                        <!-- Card 4: Restock Radar & Replenishment -->
                        <div class="schema-card-glass" style="padding:1.15rem 1.25rem; border-left:4px solid ${advancedMath.stockStatusColor}; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                                    <span style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:var(--text-muted);">Restock Radar</span>
                                    <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:${advancedMath.stockStatusColor}18; color:${advancedMath.stockStatusColor};">
                                        ${advancedMath.stockStatusLabel}
                                    </span>
                                </div>
                                <div style="font-size:1.6rem; font-weight:800; color:#09090b;">
                                    ${summary.currentStock} <span style="font-size:0.85rem; font-weight:600; color:var(--text-muted);">/ ${advancedMath.reorderPoint} ROP</span>
                                </div>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.4rem; line-height:1.35;">
                                Safety Buffer: <strong>${advancedMath.safetyStock} units</strong> &bull; Lead Time: 7d
                            </div>
                        </div>
                    </div>

                    <!-- Demand Timeline & Day Distribution Graphs -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
                        
                        <!-- Monthly Trend Chart -->
                        <div class="schema-card-glass" style="padding:1.35rem;">
                            <h4 style="font-size:0.95rem; font-weight:800; color:#09090b; margin:0 0 1rem 0;">Monthly Demand Velocity</h4>
                            ${timeline.monthly.length > 0 ? `
                                <div style="display:flex; align-items:flex-end; gap:0.6rem; height:120px; padding-bottom:1.5rem; border-bottom:1px solid rgba(0,0,0,0.08);">
                                    ${timeline.monthly.slice(-6).map(m => {
                                        const pct = Math.round((m.qty / maxMonthlyQty) * 100);
                                        return `
                                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end;">
                                                <span style="font-size:0.7rem; font-weight:700; color:#09090b;">${m.qty}</span>
                                                <div style="width:100%; height:${Math.max(pct, 8)}%; background:#18181b; border-radius:4px 4px 0 0;" title="${m.month}: ${m.qty} units"></div>
                                                <span style="font-size:0.68rem; color:var(--text-muted); white-space:nowrap;">${m.month.slice(5)}</span>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `<div style="text-align:center; padding:2rem 0; color:var(--text-muted); font-size:0.85rem;">No monthly purchase history recorded yet.</div>`}
                        </div>

                        <!-- Day of Week Distribution -->
                        <div class="schema-card-glass" style="padding:1.35rem;">
                            <h4 style="font-size:0.95rem; font-weight:800; color:#09090b; margin:0 0 1rem 0;">Day of Week Demand Distribution</h4>
                            <div style="display:flex; align-items:flex-end; gap:0.4rem; height:120px; padding-bottom:1.5rem; border-bottom:1px solid rgba(0,0,0,0.08);">
                                ${timeline.dayOfWeek.map(d => {
                                    const pct = Math.round((d.qty / maxDayQty) * 100);
                                    return `
                                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end;">
                                            <span style="font-size:0.7rem; font-weight:700; color:#09090b;">${d.qty}</span>
                                            <div style="width:100%; height:${Math.max(pct, 8)}%; background:#059669; border-radius:4px 4px 0 0;" title="${d.day}: ${d.qty} units"></div>
                                            <span style="font-size:0.68rem; color:var(--text-muted);">${d.day}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                    </div>

                    <!-- Basket Affinity & Top Buyers Row -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
                        
                        <!-- Basket Co-occurrence Affinity ("Which use likes more") -->
                        <div class="schema-card-glass" style="padding:1.35rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
                                <div>
                                    <h4 style="font-size:0.95rem; font-weight:800; color:#09090b; margin:0;">Basket Affinity (Paired Products)</h4>
                                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0 0 0;">Which products are most frequently purchased together</p>
                                </div>
                                <span style="font-size:0.7rem; color:#18181b; font-weight:700; background:rgba(0,0,0,0.06); padding:0.12rem 0.45rem; border-radius:4px;">Affinity</span>
                            </div>

                            ${coOccurrenceList.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:260px; overflow-y:auto;">
                                    ${coOccurrenceList.map((co, idx) => `
                                        <div style="padding:0.6rem 0.75rem; border-radius:8px; background:#ffffff; border:1px solid rgba(0,0,0,0.08); box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.84rem; margin-bottom:0.3rem;">
                                                <span style="font-weight:700; color:#09090b;">${idx + 1}. ${co.productName}</span>
                                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                                    <span style="font-size:0.68rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:4px; background:${co.liftColor}18; color:${co.liftColor};">
                                                        ${co.lift}x Lift
                                                    </span>
                                                    <span style="font-weight:800; color:#18181b; font-size:0.8rem;">${co.confidencePct}% (${co.coInvoicedCount}x)</span>
                                                </div>
                                            </div>
                                            <div style="width:100%; height:5px; background:rgba(0,0,0,0.06); border-radius:3px; overflow:hidden;">
                                                <div style="width:${co.confidencePct}%; height:100%; background:#18181b; border-radius:3px;"></div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">This product hasn't been paired with other items yet in multi-item invoices.</div>`}
                        </div>

                        <!-- Top Buyers Affinity -->
                        <div class="schema-card-glass" style="padding:1.35rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.85rem;">
                                <div>
                                    <h4 style="font-size:0.95rem; font-weight:800; color:#09090b; margin:0;">Top Purchasing Partners</h4>
                                    <p style="font-size:0.75rem; color:var(--text-secondary); margin:0.15rem 0 0 0;">Clients & Businesses with highest repeat demand</p>
                                </div>
                                <span style="font-size:0.7rem; color:#059669; font-weight:700; background:rgba(5, 150, 105, 0.08); padding:0.12rem 0.45rem; border-radius:4px;">Buyers</span>
                            </div>

                            ${topBuyers.length > 0 ? `
                                <div style="display:flex; flex-direction:column; gap:0.5rem; max-height:260px; overflow-y:auto;">
                                    ${topBuyers.map((tb, idx) => `
                                        <div style="padding:0.65rem 0.8rem; border-radius:8px; background:#ffffff; border:1px solid rgba(0,0,0,0.08); display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                                            <div>
                                                <div style="display:flex; align-items:center; gap:0.4rem;">
                                                    <span style="font-weight:700; font-size:0.86rem; color:#09090b;">${idx + 1}. ${tb.partyName}</span>
                                                    <span style="font-size:0.65rem; font-weight:800; padding:0.1rem 0.35rem; border-radius:4px; background:${tb.retentionColor}18; color:${tb.retentionColor};">
                                                        ${tb.retentionLabel}
                                                    </span>
                                                </div>
                                                <div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">
                                                    ${tb.partyType} &bull; ${tb.invoiceCount} invoices &bull; Loyalty: <strong>${tb.loyaltyIndex}/100</strong>
                                                </div>
                                            </div>
                                            <div style="text-align:right;">
                                                <div style="font-weight:800; font-size:0.9rem; color:#059669;">${tb.totalQuantity} units</div>
                                                <div style="font-size:0.72rem; color:var(--text-secondary); font-weight:600;">${formatCurrency(tb.totalSpend)}</div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">No party order transactions recorded for this item yet.</div>`}
                        </div>

                    </div>

                    <!-- Invoices Lineage Table -->
                    <div class="schema-card-glass" style="padding:1.4rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
                            <div>
                                <h4 style="font-size:1.05rem; font-weight:800; color:#09090b; margin:0;">Invoiced History & Direct Connections</h4>
                                <p style="font-size:0.78rem; color:var(--text-secondary); margin:0.15rem 0 0 0;">Every invoice containing this product with 1-click full invoice inspection</p>
                            </div>
                            <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted);">${invoices.length} Total Invoices</span>
                        </div>

                        ${invoices.length > 0 ? `
                            <div style="overflow-x:auto;">
                                <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                                    <thead>
                                        <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; color:var(--text-muted); font-size:0.74rem; text-transform:uppercase; letter-spacing:0.04em;">
                                            <th style="padding:0.65rem 0.75rem;">Invoice #</th>
                                            <th style="padding:0.65rem 0.75rem;">Date</th>
                                            <th style="padding:0.65rem 0.75rem;">Customer / Business</th>
                                            <th style="padding:0.65rem 0.75rem; text-align:right;">Quantity</th>
                                            <th style="padding:0.65rem 0.75rem; text-align:right;">Total Line</th>
                                            <th style="padding:0.65rem 0.75rem;">Status</th>
                                            <th style="padding:0.65rem 0.75rem; text-align:right;">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${invoices.map(inv => `
                                            <tr style="border-bottom:1px solid rgba(0,0,0,0.06); transition:background 0.15s ease;">
                                                <td style="padding:0.65rem 0.75rem; font-weight:700; color:#09090b;">${inv.invoiceNumber}</td>
                                                <td style="padding:0.65rem 0.75rem; color:var(--text-secondary);">${inv.dateFormatted}</td>
                                                <td style="padding:0.65rem 0.75rem; font-weight:600;">
                                                    <span style="font-size:0.68rem; padding:0.1rem 0.35rem; border-radius:4px; margin-right:4px; font-weight:700; ${inv.isBusinessInvoice ? 'background:#E0E7FF; color:#4338CA;' : 'background:#DCFCE7; color:#15803D;'}">
                                                        ${inv.isBusinessInvoice ? 'B2B' : 'B2C'}
                                                    </span>
                                                    ${inv.partyName}
                                                </td>
                                                <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:800;">${inv.quantity}</td>
                                                <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:800; color:#09090b;">${formatCurrency(inv.totalPrice)}</td>
                                                <td style="padding:0.65rem 0.75rem;">
                                                    <span class="status-pill ${(inv.status || '').toUpperCase() === 'PAID' ? 'status-pill-active' : ''}" style="font-size:0.7rem; font-weight:700;">
                                                        ${inv.status}
                                                    </span>
                                                </td>
                                                <td style="padding:0.65rem 0.75rem; text-align:right;">
                                                    <button class="btn btn-sm btn-secondary schema-btn-view-inv" data-id="${inv.id || inv.uniqueId}" data-is-bus="${inv.isBusinessInvoice}" style="padding:0.25rem 0.65rem; font-size:0.75rem; background:#ffffff; font-weight:700;">
                                                        Inspect
                                                    </button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">This product hasn't been invoiced yet.</div>`}
                    </div>
                `;

                // Attach inspect invoice viewer modal handlers
                detailContainer.querySelectorAll('.schema-btn-view-inv').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const invId = btn.getAttribute('data-id');
                        const fullInv = rawData.allInvoices.find(i => String(i.id) === String(invId) || String(i.uniqueId) === String(invId));
                        if (fullInv) {
                            openInvoiceViewerModal(fullInv);
                        } else {
                            showAlert.info('Loading invoice details...');
                        }
                    });
                });

                // Attach open floating inspector button listener
                const openFloatingBtn = detailContainer.querySelector('#btn-open-floating-connection');
                if (openFloatingBtn) {
                    openFloatingBtn.addEventListener('click', () => {
                        isFloatingDrawerOpen = true;
                        renderFloatingConnectionDock();
                    });
                }

                // Keep the floating drawer/pill in sync with selected product
                renderFloatingConnectionDock();
            };

            renderProductDetail();
        };

        // =====================================================================
        // TAB 2: SCHEMA TOPOLOGY GRAPH
        // =====================================================================
        const renderTopologyTab = (tabContainer, topology) => {
            const { nodeCounts, edgeCounts, densityScore } = topology;

            tabContainer.innerHTML = `
                <div class="schema-card-glass" style="padding:1.75rem; margin-bottom:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.25rem; font-weight:800; color:#09090b;">Relational Entity-Relationship Topology</h3>
                            <p style="color:var(--text-secondary); margin:0.2rem 0 0 0; font-size:0.85rem;">Interactive visual layout of workspace entity relationships and connection flow.</p>
                        </div>
                        <div>
                            <span class="status-pill status-pill-active" style="font-size:0.75rem; padding:0.2rem 0.65rem; font-weight:700; background:#18181b; color:#fff;">
                                Graph Density: ${(densityScore * 100).toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    <!-- Visual Node Diagram on Blueprint Background -->
                    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.08); border-radius:14px; padding:2.5rem 2rem; position:relative; overflow-x:auto; box-shadow:inset 0 2px 6px rgba(0,0,0,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:center; min-width:820px; gap:2rem; position:relative;">
                            
                            <!-- Node 1: Workspace Core -->
                            <div class="schema-graph-node" style="border-top:4px solid #18181b; min-width:135px; text-align:center; padding:1.2rem 1rem; background:#ffffff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.08);">
                                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#18181b;">Root Hub</div>
                                <div style="font-weight:800; font-size:1.1rem; color:#09090b; margin:0.3rem 0;">Workspace</div>
                                <span class="status-pill" style="font-size:0.7rem; font-weight:700;">1 Active Hub</span>
                            </div>

                            <div style="color:#71717a; font-size:1.4rem; font-weight:800;">&rarr;</div>

                            <!-- Node 2: Categories -->
                            <div class="schema-graph-node" style="border-top:4px solid #0284c7; min-width:135px; text-align:center; padding:1.2rem 1rem; background:#ffffff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.08);">
                                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#0284c7;">Taxonomy</div>
                                <div style="font-weight:800; font-size:1.1rem; color:#09090b; margin:0.3rem 0;">Categories</div>
                                <span class="status-pill" style="font-size:0.7rem; font-weight:700;">${nodeCounts.categories} Groups</span>
                            </div>

                            <div style="color:#71717a; font-size:1.4rem; font-weight:800;">&rarr;</div>

                            <!-- Node 3: Products -->
                            <div class="schema-graph-node" style="border-top:4px solid #059669; min-width:145px; text-align:center; padding:1.2rem 1rem; background:#ffffff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.08);">
                                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#059669;">Inventory</div>
                                <div style="font-weight:800; font-size:1.1rem; color:#09090b; margin:0.3rem 0;">Products</div>
                                <span class="status-pill status-pill-active" style="font-size:0.7rem; font-weight:700;">${nodeCounts.products} Items</span>
                            </div>

                            <div style="color:#71717a; font-size:1.4rem; font-weight:800;">&harr;</div>

                            <!-- Node 4: Invoices -->
                            <div class="schema-graph-node" style="border-top:4px solid #d97706; min-width:145px; text-align:center; padding:1.2rem 1rem; background:#ffffff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.08);">
                                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#d97706;">Transactions</div>
                                <div style="font-weight:800; font-size:1.1rem; color:#09090b; margin:0.3rem 0;">Invoices</div>
                                <span class="status-pill status-pill-active" style="font-size:0.7rem; font-weight:700;">${nodeCounts.invoices} Records</span>
                            </div>

                            <div style="color:#71717a; font-size:1.4rem; font-weight:800;">&rarr;</div>

                            <!-- Node 5: Parties -->
                            <div class="schema-graph-node" style="border-top:4px solid #7c3aed; min-width:145px; text-align:center; padding:1.2rem 1rem; background:#ffffff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.05); border:1px solid rgba(0,0,0,0.08);">
                                <div style="font-size:0.7rem; text-transform:uppercase; font-weight:800; color:#7c3aed;">Stakeholders</div>
                                <div style="font-weight:800; font-size:1.1rem; color:#09090b; margin:0.3rem 0;">Parties</div>
                                <span class="status-pill" style="font-size:0.7rem; font-weight:700;">${nodeCounts.businesses + nodeCounts.clients} Profiles</span>
                            </div>

                        </div>
                    </div>
                </div>

                <!-- Entity Breakdown & Edge Counts Table -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem;">
                    
                    <div class="schema-card-glass" style="padding:1.4rem;">
                        <h4 style="font-size:1rem; font-weight:800; color:#09090b; margin:0 0 1rem 0;">Entity Node Breakdown</h4>
                        <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                            <tbody>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Products (Catalog Active)</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#059669;">${nodeCounts.products}</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Product Categories</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#0284c7;">${nodeCounts.categories}</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Customer Invoices (B2C)</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#d97706;">${nodeCounts.customerInvoices}</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Business Invoices (B2B)</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#18181b;">${nodeCounts.businessInvoices}</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Partner Businesses</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#7c3aed;">${nodeCounts.businesses}</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Direct Clients & Customers</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#475569;">${nodeCounts.clients + nodeCounts.customers}</td>
                                </tr>
                                <tr>
                                    <td style="padding:0.55rem 0; font-weight:600;">Storefront Orders</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#0284c7;">${nodeCounts.orders}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="schema-card-glass" style="padding:1.4rem;">
                        <h4 style="font-size:1rem; font-weight:800; color:#09090b; margin:0 0 1rem 0;">Relational Link (Edge) Matrix</h4>
                        <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                            <tbody>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Product &rarr; Invoices (Line Items)</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#059669;">${edgeCounts.productToInvoiceEdges} links</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Product &rarr; Category Assignments</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#0284c7;">${edgeCounts.productToCategoryEdges} links</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Invoice &rarr; Business Profiles</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#7c3aed;">${edgeCounts.invoiceToBusinessEdges} links</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Invoice &rarr; Direct Client Profiles</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#d97706;">${edgeCounts.invoiceToClientEdges} links</td>
                                </tr>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                    <td style="padding:0.55rem 0; font-weight:600;">Storefront Orders &rarr; Catalog Products</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#0284c7;">${edgeCounts.orderToProductEdges} links</td>
                                </tr>
                                <tr>
                                    <td style="padding:0.55rem 0; font-weight:600;">Workspace Member &rarr; Creations</td>
                                    <td style="padding:0.55rem 0; text-align:right; font-weight:800; color:#18181b;">${edgeCounts.memberToCreationEdges} links</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>
            `;
        };

        // =====================================================================
        // TAB 3: INVOICES & LINE-ITEM LINKS
        // =====================================================================
        const renderInvoicesPartiesTab = (tabContainer) => {
            const allInvs = rawData.allInvoices;

            tabContainer.innerHTML = `
                <div class="schema-card-glass" style="padding:1.4rem; margin-bottom:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#09090b;">Invoice Relational Matrix</h3>
                            <p style="color:var(--text-secondary); margin:0.2rem 0 0 0; font-size:0.85rem;">Inspect connected items, parties, and orphan product links across all invoices.</p>
                        </div>
                        <div>
                            <input type="text" id="schema-inv-search" class="form-control" placeholder="Search by inv #, party..." style="width:240px; font-size:0.85rem; background:#ffffff;">
                        </div>
                    </div>

                    <div style="overflow-x:auto;">
                        <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                            <thead>
                                <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; color:var(--text-muted); font-size:0.74rem; text-transform:uppercase;">
                                    <th style="padding:0.65rem 0.75rem;">Invoice #</th>
                                    <th style="padding:0.65rem 0.75rem;">Type</th>
                                    <th style="padding:0.65rem 0.75rem;">Connected Party</th>
                                    <th style="padding:0.65rem 0.75rem;">Line Items</th>
                                    <th style="padding:0.65rem 0.75rem; text-align:right;">Grand Total</th>
                                    <th style="padding:0.65rem 0.75rem;">Status</th>
                                    <th style="padding:0.65rem 0.75rem; text-align:right;">Action</th>
                                </tr>
                            </thead>
                            <tbody id="schema-inv-tbody">
                                ${allInvs.slice(0, 30).map(inv => {
                                    const itemsCount = (inv.items || []).length;
                                    const partyName = inv.isBusinessInvoice ? (inv.businessName || 'Business Partner') : (inv.customerName || 'Direct Customer');
                                    return `
                                        <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                            <td style="padding:0.65rem 0.75rem; font-weight:700; color:#09090b;">${inv.invoiceNumber || inv.busInvNumber || 'N/A'}</td>
                                            <td style="padding:0.65rem 0.75rem;">
                                                <span style="font-size:0.7rem; padding:0.12rem 0.45rem; border-radius:4px; font-weight:700; ${inv.isBusinessInvoice ? 'background:#E0E7FF; color:#4338CA;' : 'background:#DCFCE7; color:#15803D;'}">
                                                    ${inv.isBusinessInvoice ? 'Business B2B' : 'Customer B2C'}
                                                </span>
                                            </td>
                                            <td style="padding:0.65rem 0.75rem; font-weight:600;">${partyName}</td>
                                            <td style="padding:0.65rem 0.75rem; color:var(--text-secondary);">${itemsCount} linked items</td>
                                            <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:800; color:#09090b;">${formatCurrency(inv.totalPrice || 0)}</td>
                                            <td style="padding:0.65rem 0.75rem;">
                                                <span class="status-pill ${(inv.status || '').toUpperCase() === 'PAID' ? 'status-pill-active' : ''}" style="font-size:0.7rem; font-weight:700;">
                                                    ${inv.status || 'Paid'}
                                                </span>
                                            </td>
                                            <td style="padding:0.65rem 0.75rem; text-align:right;">
                                                <button class="btn btn-sm btn-secondary schema-btn-inspect-inv" data-id="${inv.id || inv.uniqueId}" style="padding:0.25rem 0.65rem; font-size:0.75rem; background:#ffffff; font-weight:700;">
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            tabContainer.querySelectorAll('.schema-btn-inspect-inv').forEach(btn => {
                btn.addEventListener('click', () => {
                    const invId = btn.getAttribute('data-id');
                    const fullInv = rawData.allInvoices.find(i => String(i.id) === String(invId) || String(i.uniqueId) === String(invId));
                    if (fullInv) openInvoiceViewerModal(fullInv);
                });
            });
        };

        // =====================================================================
        // TAB 4: PARTIES & CLIENT MATRIX
        // =====================================================================
        const renderBusinessClientsTab = (tabContainer) => {
            const { businesses, allInvoices } = rawData;

            const businessStats = businesses.map(b => {
                const bId = String(b.id || b.uniqueId);
                const invs = allInvoices.filter(i => i.isBusinessInvoice && String(i.businessId) === bId);
                const totalSpend = invs.reduce((sum, i) => sum + (Number(i.totalPrice) || 0), 0);
                return {
                    ...b,
                    invoiceCount: invs.length,
                    totalSpend
                };
            }).sort((a, b) => b.totalSpend - a.totalSpend);

            tabContainer.innerHTML = `
                <div class="schema-card-glass" style="padding:1.4rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#09090b;">B2B Registered Businesses</h3>
                            <p style="color:var(--text-secondary); margin:0.2rem 0 0 0; font-size:0.85rem;">Account order frequency, total spend, and relationship activity.</p>
                        </div>
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">${businesses.length} Total Partners</span>
                    </div>

                    ${businessStats.length > 0 ? `
                        <div style="overflow-x:auto;">
                            <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                                <thead>
                                    <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; color:var(--text-muted); font-size:0.74rem; text-transform:uppercase;">
                                        <th style="padding:0.65rem 0.75rem;">Business Name</th>
                                        <th style="padding:0.65rem 0.75rem;">Contact Email</th>
                                        <th style="padding:0.65rem 0.75rem; text-align:right;">Invoices</th>
                                        <th style="padding:0.65rem 0.75rem; text-align:right;">Total Spend</th>
                                        <th style="padding:0.65rem 0.75rem;">Relationship Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${businessStats.map(b => `
                                        <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                            <td style="padding:0.65rem 0.75rem; font-weight:700; color:#09090b;">${b.name || 'Unnamed Business'}</td>
                                            <td style="padding:0.65rem 0.75rem; color:var(--text-secondary);">${b.email || 'N/A'}</td>
                                            <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:800;">${b.invoiceCount}</td>
                                            <td style="padding:0.65rem 0.75rem; text-align:right; font-weight:800; color:#059669;">${formatCurrency(b.totalSpend)}</td>
                                            <td style="padding:0.65rem 0.75rem;">
                                                <span class="status-pill ${b.invoiceCount > 0 ? 'status-pill-active' : ''}" style="font-size:0.7rem; font-weight:700;">
                                                    ${b.invoiceCount > 0 ? 'Active Buyer' : 'Dormant Profile'}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">No registered businesses found.</div>`}
                </div>
            `;
        };

        // =====================================================================
        // TAB 5: SCHEMA HEALTH & ORPHAN AUDIT
        // =====================================================================
        const renderSchemaHealthTab = (tabContainer, healthAudit) => {
            const { healthScore, completenessScore, issues, dormantProducts } = healthAudit;

            tabContainer.innerHTML = `
                <!-- Diagnostic Summary Row -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem; margin-bottom:1.5rem;">
                    
                    <div class="schema-card-glass" style="padding:1.4rem;">
                        <h4 style="font-size:1rem; font-weight:800; color:#09090b; margin:0 0 0.5rem 0;">Schema Integrity Score</h4>
                        <div style="display:flex; align-items:center; gap:1.25rem; margin-top:0.75rem;">
                            <div style="width:70px; height:70px; border-radius:50%; border:6px solid ${healthScore >= 90 ? '#10B981' : '#F59E0B'}; display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:800; color:#09090b;">
                                ${healthScore}%
                            </div>
                            <div>
                                <div style="font-weight:800; font-size:1.05rem; color:#09090b;">
                                    ${healthScore >= 90 ? 'Healthy Schema' : 'Maintenance Advised'}
                                </div>
                                <p style="margin:0.2rem 0 0 0; font-size:0.82rem; color:var(--text-secondary);">
                                    All foreign key references, categories, and invoice item links are continuously audited for relational consistency.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="schema-card-glass" style="padding:1.4rem;">
                        <h4 style="font-size:1rem; font-weight:800; color:#09090b; margin:0 0 0.5rem 0;">Metadata Quality</h4>
                        <div style="display:flex; align-items:center; gap:1.25rem; margin-top:0.75rem;">
                            <div style="width:70px; height:70px; border-radius:50%; border:6px solid #18181b; display:flex; align-items:center; justify-content:center; font-size:1.35rem; font-weight:800; color:#09090b;">
                                ${completenessScore}%
                            </div>
                            <div>
                                <div style="font-weight:800; font-size:1.05rem; color:#09090b;">
                                    Catalog Richness
                                </div>
                                <p style="margin:0.2rem 0 0 0; font-size:0.82rem; color:var(--text-secondary);">
                                    Measures presence of barcodes/UPCs, selling & cost prices, and product imagery across your active items.
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- Diagnostic Issues List -->
                <div class="schema-card-glass" style="padding:1.4rem; margin-bottom:1.5rem;">
                    <h3 style="font-size:1.15rem; font-weight:800; color:#09090b; margin:0 0 1rem 0;">Diagnostic Observations (${issues.length})</h3>

                    ${issues.length > 0 ? `
                        <div style="display:flex; flex-direction:column; gap:0.75rem;">
                            ${issues.map(iss => {
                                const badgeColor = iss.type === 'CRITICAL' ? '#EF4444' : (iss.type === 'WARNING' ? '#F59E0B' : '#0284c7');
                                return `
                                    <div style="padding:1rem 1.25rem; border-radius:10px; border:1px solid rgba(0,0,0,0.08); background:#ffffff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                                        <div style="display:flex; align-items:flex-start; gap:0.75rem;">
                                            <span style="font-size:0.7rem; font-weight:800; padding:0.2rem 0.5rem; border-radius:4px; background:${badgeColor}15; color:${badgeColor}; margin-top:2px;">
                                                ${iss.type}
                                            </span>
                                            <div>
                                                <div style="font-weight:700; font-size:0.92rem; color:#09090b;">${iss.title}</div>
                                                <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.2rem;">${iss.description}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <a href="${iss.actionHash}" class="btn btn-sm btn-secondary" style="font-size:0.75rem; padding:0.3rem 0.75rem; font-weight:700; background:#ffffff;">
                                                Resolve &rarr;
                                            </a>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `
                        <div style="text-align:center; padding:2.5rem; color:#10B981;">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom:0.5rem;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            <h4 style="margin:0; font-size:1.1rem; font-weight:800;">No Schema Integrity Issues Found</h4>
                            <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:var(--text-secondary);">All products, categories, and invoice connections are properly linked.</p>
                        </div>
                    `}
                </div>

                <!-- Dormant Products Table -->
                <div class="schema-card-glass" style="padding:1.4rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <div>
                            <h4 style="font-size:1.05rem; font-weight:800; color:#09090b; margin:0;">Dormant Products (Zero Invoice Demand)</h4>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin:0.15rem 0 0 0;">Catalog items that have never been referenced in any customer or business invoice.</p>
                        </div>
                        <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted);">${dormantProducts.length} Dormant Items</span>
                    </div>

                    ${dormantProducts.length > 0 ? `
                        <div style="max-height:300px; overflow-y:auto;">
                            <table class="table" style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                                <thead>
                                    <tr style="border-bottom:1px solid rgba(0,0,0,0.08); text-align:left; color:var(--text-muted); font-size:0.72rem; text-transform:uppercase;">
                                        <th style="padding:0.55rem 0.65rem;">Product Name</th>
                                        <th style="padding:0.55rem 0.65rem;">Stock Available</th>
                                        <th style="padding:0.55rem 0.65rem; text-align:right;">Sale Price</th>
                                        <th style="padding:0.55rem 0.65rem; text-align:right;">Demand Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${dormantProducts.map(dp => `
                                        <tr style="border-bottom:1px solid rgba(0,0,0,0.06);">
                                            <td style="padding:0.55rem 0.65rem; font-weight:700; color:#09090b;">${dp.name || 'Unnamed Product'}</td>
                                            <td style="padding:0.55rem 0.65rem; color:var(--text-secondary);">${dp.quantity || 0} units</td>
                                            <td style="padding:0.55rem 0.65rem; text-align:right; font-weight:800; color:#09090b;">${formatCurrency(dp.salePrice || dp.price || 0)}</td>
                                            <td style="padding:0.55rem 0.65rem; text-align:right;">
                                                <button class="btn btn-sm btn-secondary schema-btn-inspect-dormant" data-id="${dp.id || dp.uniqueId}" style="padding:0.25rem 0.55rem; font-size:0.72rem; background:#ffffff; font-weight:700;">
                                                    Analyze &rarr;
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `<div style="text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.85rem;">All products in your catalog have active invoice sales history!</div>`}
                </div>
            `;

            tabContainer.querySelectorAll('.schema-btn-inspect-dormant').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedProductId = btn.getAttribute('data-id');
                    activeTab = 'product-demand';
                    renderFullView();
                });
            });
        };

        renderFullView();

    } catch (err) {
        console.error('Error rendering Schema Analyzer:', err);
        container.innerHTML = `
            <div class="schema-blueprint-canvas">
                <div class="schema-card-glass" style="padding:2.5rem; text-align:center; color:#EF4444;">
                    <h3 style="font-weight:800;">Unable to Load Schema Analyzer</h3>
                    <p style="color:var(--text-secondary); margin-top:0.5rem;">${err.message || 'An unexpected error occurred while compiling schema relations.'}</p>
                    <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top:1rem; background:#18181b;">Reload Workspace</button>
                </div>
            </div>
        `;
    }
};
