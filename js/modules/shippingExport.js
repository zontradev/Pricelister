/**
 * PRICELISTER — SHIPPING & EXPORT MODULE
 * Enterprise Shipping, Dispatch, Packing Slips & Customs Export Manifests
 */

import { getInvoiceService } from '../services/invoiceService.js';
import { showAlert } from '../alert-handler.js';
import { getAppCurrencySymbol } from '../utilities.js';

let currentWorkspaceId = null;
let currentFilter = 'all';
let searchQuery = '';
let shipments = [];

const COURIERS = [
    { id: 'dhl', name: 'DHL Express' },
    { id: 'fedex', name: 'FedEx' },
    { id: 'ups', name: 'UPS Global' },
    { id: 'usps', name: 'USPS / Postal' },
    { id: 'freight', name: 'Air / Sea Freight' },
    { id: 'local', name: 'Local Courier / Fleet' }
];

const STATUS_MAP = {
    pending: { label: 'Pending Dispatch', class: 'badge-pending' },
    in_transit: { label: 'In Transit', class: 'badge-transit' },
    delivered: { label: 'Delivered', class: 'badge-delivered' },
    export_cleared: { label: 'Customs Cleared', class: 'badge-cleared' }
};

export const renderShippingExport = async (container, workspaceId) => {
    currentWorkspaceId = workspaceId;
    container.innerHTML = `
        <div style="padding: 1.75rem 2rem; max-width: 1400px; margin: 0 auto; min-height: 80vh;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <h1 style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin: 0; letter-spacing: -0.02em;">Shipping & Export</h1>
                        <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:999px;">Dispatches & Customs</span>
                    </div>
                    <p style="margin: 0.35rem 0 0; color: #71717A; font-size: 0.88rem;">Manage domestic shipments, international customs declarations, packing slips, and carrier tracking.</p>
                </div>
                <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
                    <button id="btn-export-manifest" class="btn btn-secondary" style="font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Export Manifest (CSV)
                    </button>
                    <button id="btn-new-shipment" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.85rem; font-weight:700; display:inline-flex; align-items:center; gap:0.4rem;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Create Dispatch Note
                    </button>
                </div>
            </div>

            <!-- Summary KPI Strip -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="card" style="padding: 1.25rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #71717A; font-weight: 700; letter-spacing: 0.04em;">Awaiting Dispatch</div>
                    <div id="kpi-awaiting" style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin-top: 0.35rem;">0</div>
                    <div style="font-size: 0.75rem; color: #A1A1AA; margin-top: 0.2rem;">Ready for carrier handoff</div>
                </div>
                <div class="card" style="padding: 1.25rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #71717A; font-weight: 700; letter-spacing: 0.04em;">Active In-Transit</div>
                    <div id="kpi-transit" style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin-top: 0.35rem;">0</div>
                    <div style="font-size: 0.75rem; color: #A1A1AA; margin-top: 0.2rem;">With carrier network</div>
                </div>
                <div class="card" style="padding: 1.25rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #71717A; font-weight: 700; letter-spacing: 0.04em;">Customs Cleared</div>
                    <div id="kpi-cleared" style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin-top: 0.35rem;">0</div>
                    <div style="font-size: 0.75rem; color: #A1A1AA; margin-top: 0.2rem;">Cross-border verified</div>
                </div>
                <div class="card" style="padding: 1.25rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px;">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: #71717A; font-weight: 700; letter-spacing: 0.04em;">Total Dispatches (Month)</div>
                    <div id="kpi-total" style="font-size: 1.6rem; font-weight: 800; color: #18181B; margin-top: 0.35rem;">0</div>
                    <div style="font-size: 0.75rem; color: #A1A1AA; margin-top: 0.2rem;">Domestic & Export</div>
                </div>
            </div>

            <!-- Filter & Search Toolbar -->
            <div class="card" style="padding: 1rem 1.25rem; background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                    <button class="ship-filter-btn active" data-filter="all">All (${shipments.length})</button>
                    <button class="ship-filter-btn" data-filter="pending">Pending</button>
                    <button class="ship-filter-btn" data-filter="in_transit">In Transit</button>
                    <button class="ship-filter-btn" data-filter="delivered">Delivered</button>
                    <button class="ship-filter-btn" data-filter="export_cleared">Customs Cleared</button>
                </div>
                <div style="position: relative; min-width: 240px;">
                    <input type="text" id="ship-search-input" class="form-control" placeholder="Search tracking #, invoice, recipient..." style="padding: 0.45rem 0.75rem 0.45rem 2.2rem; font-size: 0.82rem; border-radius: 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="2" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); pointer-events: none;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
            </div>

            <!-- Main Shipments Table -->
            <div class="card" style="background: #FFFFFF; border: 1px solid #E4E4E7; border-radius: 12px; overflow: hidden;">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                        <thead>
                            <tr style="background: #F4F4F5; border-bottom: 1px solid #E4E4E7; color: #71717A; font-size: 0.74rem; text-transform: uppercase; letter-spacing: 0.05em;">
                                <th style="padding: 0.85rem 1rem;">Tracking / Dispatch ID</th>
                                <th style="padding: 0.85rem 1rem;">Linked Invoice</th>
                                <th style="padding: 0.85rem 1rem;">Recipient & Destination</th>
                                <th style="padding: 0.85rem 1rem;">Carrier</th>
                                <th style="padding: 0.85rem 1rem;">Declared Value</th>
                                <th style="padding: 0.85rem 1rem;">Status</th>
                                <th style="padding: 0.85rem 1rem; text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="shipments-table-body">
                            <!-- Injected rows -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <style>
            .ship-filter-btn {
                background: transparent;
                border: 1px solid transparent;
                color: #71717A;
                font-size: 0.8rem;
                font-weight: 600;
                padding: 0.35rem 0.75rem;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            .ship-filter-btn:hover {
                color: #18181B;
                background: #F4F4F5;
            }
            .ship-filter-btn.active {
                background: #18181B;
                color: #FFFFFF;
                border-color: #18181B;
            }
            .badge-pending {
                background: #F4F4F5;
                color: #18181B;
                border: 1px solid #E4E4E7;
            }
            .badge-transit {
                background: #F4F4F5;
                color: #18181B;
                border: 1px solid #18181B;
            }
            .badge-delivered {
                background: #18181B;
                color: #FFFFFF;
                border: 1px solid #18181B;
            }
            .badge-cleared {
                background: #F4F4F5;
                color: #18181B;
                border: 1px solid #E4E4E7;
            }
        </style>
    `;

    await loadShipmentData();
    bindEvents(container);
};

const loadShipmentData = async () => {
    try {
        const stored = localStorage.getItem(`pricelister_shipments_${currentWorkspaceId}`);
        if (stored) {
            shipments = JSON.parse(stored);
        } else {
            // Seed sample dispatch records linked to actual or fallback invoices
            shipments = [
                {
                    id: 'SHP-10024',
                    trackingNumber: 'DHL-9842104928',
                    invoiceId: 'INV-2026-0042',
                    recipientName: 'Nordic Wholesale ApS',
                    destination: 'Copenhagen, Denmark (DK)',
                    carrier: 'DHL Express',
                    declaredValue: 2450.00,
                    weightKg: 14.5,
                    isExport: true,
                    status: 'in_transit',
                    date: new Date(Date.now() - 86400000 * 2).toISOString(),
                    items: [{ name: 'Executive Suite Desk Lamp', qty: 24, hsCode: '9405.20' }]
                },
                {
                    id: 'SHP-10025',
                    trackingNumber: 'FDX-7719284102',
                    invoiceId: 'INV-2026-0045',
                    recipientName: 'Apex Creative Studio',
                    destination: 'Chicago, IL, United States',
                    carrier: 'FedEx',
                    declaredValue: 890.50,
                    weightKg: 5.2,
                    isExport: false,
                    status: 'pending',
                    date: new Date(Date.now() - 86400000).toISOString(),
                    items: [{ name: 'Ergonomic Mesh Armchair', qty: 2, hsCode: '9401.30' }]
                },
                {
                    id: 'SHP-10026',
                    trackingNumber: 'UPS-1Z99999999',
                    invoiceId: 'INV-2026-0038',
                    recipientName: 'Global Trade Consortium',
                    destination: 'Tokyo, Japan (JP)',
                    carrier: 'Air / Sea Freight',
                    declaredValue: 6200.00,
                    weightKg: 85.0,
                    isExport: true,
                    status: 'export_cleared',
                    date: new Date(Date.now() - 86400000 * 5).toISOString(),
                    items: [{ name: 'Acoustic Soundproofing Panels', qty: 60, hsCode: '6808.00' }]
                }
            ];
            saveShipments();
        }
    } catch (e) {
        console.warn("Error loading shipments:", e);
        shipments = [];
    }
    renderTable();
    updateKPIs();
};

const saveShipments = () => {
    try {
        localStorage.setItem(`pricelister_shipments_${currentWorkspaceId}`, JSON.stringify(shipments));
    } catch (e) {}
};

const updateKPIs = () => {
    const awaiting = shipments.filter(s => s.status === 'pending').length;
    const transit = shipments.filter(s => s.status === 'in_transit').length;
    const cleared = shipments.filter(s => s.status === 'export_cleared' || s.status === 'delivered').length;

    const elAwaiting = document.getElementById('kpi-awaiting');
    const elTransit = document.getElementById('kpi-transit');
    const elCleared = document.getElementById('kpi-cleared');
    const elTotal = document.getElementById('kpi-total');

    if (elAwaiting) elAwaiting.textContent = awaiting;
    if (elTransit) elTransit.textContent = transit;
    if (elCleared) elCleared.textContent = cleared;
    if (elTotal) elTotal.textContent = shipments.length;
};

const renderTable = () => {
    const tbody = document.getElementById('shipments-table-body');
    if (!tbody) return;

    let filtered = shipments.filter(s => {
        if (currentFilter !== 'all' && s.status !== currentFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const track = (s.trackingNumber || '').toLowerCase();
            const inv = (s.invoiceId || '').toLowerCase();
            const name = (s.recipientName || '').toLowerCase();
            const dest = (s.destination || '').toLowerCase();
            return track.includes(q) || inv.includes(q) || name.includes(q) || dest.includes(q);
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="padding: 3rem 1rem; text-align: center; color: #71717A;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: #18181B; margin-bottom: 0.25rem;">No dispatches match this filter</div>
                    <p style="margin: 0; font-size: 0.8rem;">Create a new dispatch note or adjust search criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    const currSym = getAppCurrencySymbol();

    tbody.innerHTML = filtered.map(s => {
        const statusMeta = STATUS_MAP[s.status] || { label: s.status, class: 'badge-pending' };
        return `
            <tr style="border-bottom: 1px solid #E4E4E7; transition: background 0.15s ease;">
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-weight: 700; color: #18181B; font-family: monospace;">${escapeHtml(s.trackingNumber || s.id)}</div>
                    <div style="font-size: 0.72rem; color: #71717A;">${escapeHtml(s.id)} • ${new Date(s.date).toLocaleDateString()}</div>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span style="font-family: monospace; font-size: 0.82rem; font-weight: 600; color: #18181B;">${escapeHtml(s.invoiceId || 'N/A')}</span>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <div style="font-weight: 600; color: #18181B;">${escapeHtml(s.recipientName)}</div>
                    <div style="font-size: 0.75rem; color: #71717A;">${escapeHtml(s.destination)}</div>
                </td>
                <td style="padding: 0.85rem 1rem; color: #18181B; font-weight: 500;">
                    ${escapeHtml(s.carrier || 'Standard')}
                    ${s.isExport ? '<span class="badge" style="background:#F4F4F5; border:1px solid #E4E4E7; font-size:0.65rem; margin-left:4px; font-weight:700;">EXPORT</span>' : ''}
                </td>
                <td style="padding: 0.85rem 1rem; font-weight: 700; color: #18181B;">
                    ${currSym}${Number(s.declaredValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <div style="font-size: 0.72rem; color: #71717A; font-weight: 400;">${s.weightKg || 0} kg</div>
                </td>
                <td style="padding: 0.85rem 1rem;">
                    <span class="badge ${statusMeta.class}" style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px;">
                        ${statusMeta.label}
                    </span>
                </td>
                <td style="padding: 0.85rem 1rem; text-align: right;">
                    <div style="display: inline-flex; gap: 0.35rem; align-items: center;">
                        <button class="btn btn-sm btn-secondary btn-print-packing" data-id="${s.id}" title="Print Packing Slip">Slip</button>
                        <button class="btn btn-sm btn-secondary btn-status-cycle" data-id="${s.id}" title="Advance Dispatch Status">Update</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

const bindEvents = (container) => {
    // Filter click
    container.querySelectorAll('.ship-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            container.querySelectorAll('.ship-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderTable();
        });
    });

    // Search input
    const searchInput = container.querySelector('#ship-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderTable();
        });
    }

    // New Shipment Dialog
    container.querySelector('#btn-new-shipment')?.addEventListener('click', () => {
        openNewShipmentModal();
    });

    // Export Manifest CSV
    container.querySelector('#btn-export-manifest')?.addEventListener('click', () => {
        exportManifestCSV();
    });

    // Table action delegation
    container.addEventListener('click', (e) => {
        const btnPrint = e.target.closest('.btn-print-packing');
        if (btnPrint) {
            const id = btnPrint.dataset.id;
            const ship = shipments.find(s => s.id === id);
            if (ship) printPackingSlip(ship);
            return;
        }

        const btnStatus = e.target.closest('.btn-status-cycle');
        if (btnStatus) {
            const id = btnStatus.dataset.id;
            const ship = shipments.find(s => s.id === id);
            if (ship) {
                const order = ['pending', 'in_transit', 'export_cleared', 'delivered'];
                const nextIdx = (order.indexOf(ship.status) + 1) % order.length;
                ship.status = order[nextIdx];
                saveShipments();
                renderTable();
                updateKPIs();
                showAlert.success(`Status updated to: ${STATUS_MAP[ship.status]?.label || ship.status}`);
            }
        }
    });
};

const openNewShipmentModal = () => {
    const modalId = 'modal-new-shipment';
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
        <div style="background: #FFFFFF; border-radius: 14px; width: 100%; max-width: 540px; border: 1px solid #E4E4E7; box-shadow: 0 20px 40px rgba(0,0,0,0.15); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid #E4E4E7; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #18181B;">New Dispatch & Export Note</h3>
                <button id="btn-close-ship-modal" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#71717A;">&times;</button>
            </div>
            <form id="form-new-shipment" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Invoice Reference</label>
                        <input type="text" id="ship-inv-ref" class="form-control" placeholder="e.g. INV-2026-0048" required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Carrier / Courier</label>
                        <select id="ship-carrier" class="form-control" style="width:100%; padding:0.5rem; font-size:0.85rem;">
                            ${COURIERS.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Recipient / Consignee</label>
                    <input type="text" id="ship-recipient" class="form-control" placeholder="Full name or company..." required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                </div>

                <div>
                    <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Delivery Destination</label>
                    <textarea id="ship-dest" class="form-control" rows="2" placeholder="Street, City, Postal Code, Country..." required style="width:100%; padding:0.5rem; font-size:0.85rem; resize:vertical;"></textarea>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Declared Value ($)</label>
                        <input type="number" id="ship-value" step="0.01" class="form-control" placeholder="0.00" required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                    </div>
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Weight (kg)</label>
                        <input type="number" id="ship-weight" step="0.1" class="form-control" placeholder="1.0" required style="width:100%; padding:0.5rem; font-size:0.85rem;">
                    </div>
                    <div style="display: flex; flex-direction: column; justify-content: flex-end;">
                        <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.78rem; font-weight:700; cursor:pointer; color:#18181B; margin-bottom: 0.6rem;">
                            <input type="checkbox" id="ship-is-export"> International Export
                        </label>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.5rem; padding-top: 1rem; border-top: 1px solid #E4E4E7;">
                    <button type="button" id="btn-cancel-ship-modal" class="btn btn-secondary">Cancel</button>
                    <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700;">Create Dispatch</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-close-ship-modal').onclick = closeModal;
    modal.querySelector('#btn-cancel-ship-modal').onclick = closeModal;

    modal.querySelector('#form-new-shipment').onsubmit = (e) => {
        e.preventDefault();
        const trackingNum = `TRK-${Date.now().toString().slice(-8)}`;
        const newRecord = {
            id: `SHP-${10000 + shipments.length + 1}`,
            trackingNumber: trackingNum,
            invoiceId: document.getElementById('ship-inv-ref').value.trim(),
            carrier: document.getElementById('ship-carrier').value,
            recipientName: document.getElementById('ship-recipient').value.trim(),
            destination: document.getElementById('ship-dest').value.trim(),
            declaredValue: parseFloat(document.getElementById('ship-value').value) || 0,
            weightKg: parseFloat(document.getElementById('ship-weight').value) || 0,
            isExport: document.getElementById('ship-is-export').checked,
            status: 'pending',
            date: new Date().toISOString(),
            items: []
        };

        shipments.unshift(newRecord);
        saveShipments();
        closeModal();
        renderTable();
        updateKPIs();
        showAlert.success(`Dispatch ${newRecord.id} generated (${trackingNum})`);
    };
};

const printPackingSlip = (ship) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        showAlert.error("Popup blocked. Please allow popups to print packing slip.");
        return;
    }

    const currSym = getAppCurrencySymbol();

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Packing Slip - ${escapeHtml(ship.id)}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2.5rem; color: #18181B; margin: 0; }
                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #18181B; padding-bottom: 1.25rem; margin-bottom: 2rem; }
                .title { font-size: 1.8rem; font-weight: 800; margin: 0; }
                .sub { color: #71717A; font-size: 0.85rem; margin-top: 0.25rem; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; font-size: 0.9rem; }
                .box { border: 1px solid #E4E4E7; border-radius: 8px; padding: 1.25rem; }
                .box-title { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #71717A; margin-bottom: 0.5rem; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.9rem; }
                th { background: #F4F4F5; padding: 0.75rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; border-bottom: 1px solid #E4E4E7; }
                td { padding: 0.85rem 0.75rem; border-bottom: 1px solid #E4E4E7; }
                .barcode { text-align: center; margin: 2rem 0; font-family: monospace; font-size: 1.1rem; letter-spacing: 0.2em; border: 1.5px dashed #E4E4E7; padding: 1rem; border-radius: 8px; }
                @media print { body { padding: 1rem; } button { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">PACKING SLIP & DISPATCH</h1>
                    <div class="sub">Order fulfillment and package contents verification</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 1.1rem; font-weight: 800; font-family: monospace;">${escapeHtml(ship.id)}</div>
                    <div class="sub">Date: ${new Date(ship.date).toLocaleDateString()}</div>
                </div>
            </div>

            <div class="barcode">
                *${escapeHtml(ship.trackingNumber || ship.id)}*
                <div style="font-size: 0.8rem; letter-spacing: normal; color: #71717A; margin-top: 0.25rem;">Tracking ID: ${escapeHtml(ship.trackingNumber || 'N/A')}</div>
            </div>

            <div class="grid">
                <div class="box">
                    <div class="box-title">Ship To (Recipient)</div>
                    <div style="font-weight: 800; font-size: 1rem;">${escapeHtml(ship.recipientName)}</div>
                    <div style="color: #71717A; margin-top: 0.35rem; line-height: 1.4;">${escapeHtml(ship.destination)}</div>
                </div>
                <div class="box">
                    <div class="box-title">Shipment Specifications</div>
                    <div><strong>Carrier:</strong> ${escapeHtml(ship.carrier)}</div>
                    <div><strong>Invoice Ref:</strong> ${escapeHtml(ship.invoiceId || 'N/A')}</div>
                    <div><strong>Weight:</strong> ${ship.weightKg} kg</div>
                    <div><strong>Declared Value:</strong> ${currSym}${Number(ship.declaredValue).toFixed(2)}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Item Description</th>
                        <th>HS / Tariff Code</th>
                        <th>Qty Ordered</th>
                        <th>Packed & Verified</th>
                    </tr>
                </thead>
                <tbody>
                    ${(ship.items && ship.items.length > 0 ? ship.items : [{ name: 'Commercial Merchandise - Dispatched per invoice', qty: 1, hsCode: '8471.90' }]).map(it => `
                        <tr>
                            <td style="font-weight: 600;">${escapeHtml(it.name)}</td>
                            <td style="font-family: monospace; color: #71717A;">${escapeHtml(it.hsCode || '—')}</td>
                            <td>${it.qty}</td>
                            <td>[ &check; ] Passed Inspection</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 3rem; display: flex; justify-content: space-between; font-size: 0.85rem; color: #71717A; border-top: 1px solid #E4E4E7; padding-top: 1rem;">
                <div>Inspector Signature: _______________________</div>
                <div>Carrier Agent: _______________________</div>
            </div>

            <div style="text-align: center; margin-top: 2rem;">
                <button onclick="window.print()" style="padding: 0.6rem 1.5rem; background: #18181B; color: #FFF; border: none; border-radius: 6px; font-weight: 700; cursor: pointer;">Print Packing Slip</button>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
};

const exportManifestCSV = () => {
    if (shipments.length === 0) {
        showAlert.info("No shipments to export.");
        return;
    }

    const headers = ["Dispatch ID", "Tracking Number", "Invoice Ref", "Recipient", "Destination", "Carrier", "Declared Value", "Weight (kg)", "Export", "Status", "Date"];
    const rows = shipments.map(s => [
        `"${s.id}"`,
        `"${s.trackingNumber || ''}"`,
        `"${s.invoiceId || ''}"`,
        `"${(s.recipientName || '').replace(/"/g, '""')}"`,
        `"${(s.destination || '').replace(/"/g, '""')}"`,
        `"${s.carrier || ''}"`,
        s.declaredValue || 0,
        s.weightKg || 0,
        s.isExport ? 'YES' : 'NO',
        `"${s.status}"`,
        `"${new Date(s.date).toISOString()}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pricelister_shipping_manifest_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert.success("Shipping manifest CSV exported successfully.");
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

