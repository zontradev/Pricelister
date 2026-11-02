/**
 * Business Finance Tracker & Customer EMI Management System
 * PriceLister Enterprise Minimal Workspace
 * 
 * Implements:
 * - Module 01: Centralized Financial Dashboard (KPIs, Cash Flow, Trend, Breakdown)
 * - Module 02: Transaction Management, General Ledger & Multi-Account Transfers
 * - Module 03: Interactive EMI Calculator (Zero, Flat, Reducing Balance, Custom)
 * - Module 04: Customer EMI Setup Workflow (6-step setup, atomic schedule & agreement)
 * - Module 05: EMI Running Management (Account list, Timeline, Payment history, Settlement)
 * - Module 06: Fast Payment Collection Workspace (Waterfall allocation, receipts, GL deposit)
 * - Module 07: Overdue Aging Management & Configurable Late-Fee Policy
 * - Module 08: Printable Statements, Agreements & CSV/PDF Export
 */

import {
    getFinanceService,
    calculateEmiSchedule,
    roundCents,
    toCents,
    fromCents,
    FINANCIAL_ACCOUNT_TYPES,
    EXPENSE_CATEGORIES,
    INCOME_CATEGORIES,
    EMI_STATUSES,
    CALCULATION_METHODS
} from '../services/financeService.js';
import { getSettingsService } from '../services/settingsService.js';
import { getInvoiceService } from '../services/invoiceService.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getRegionConfig } from '../utils/regionLocale.js';

export const renderFinanceTracker = async (container, workspaceId, initialTab = 'overview') => {
    const wsId = workspaceId || localStorage.getItem('pricelister_active_ws') || 'ws_dev_mock';
    const financeService = getFinanceService(wsId);
    const settingsService = getSettingsService(wsId);
    const invoiceService = getInvoiceService(wsId);
    const currentUser = authService.getCurrentUser() || { uid: 'demo_user', email: 'demo@pricelister.com' };

    // Role / Restriction checks
    const userRestrictions = window.__activeWorkspace?.memberRestrictions || {};
    if (userRestrictions.cannotSeeProfit) {
        container.innerHTML = `
            <div class="card" style="max-width: 600px; margin: 3rem auto; text-align: center; padding: 2.5rem; background: #ffffff; border: 1px solid #E4E4E7; border-radius: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: #F4F4F5; color: #18181B; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </div>
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 800; color: #18181B;">Restricted Access</h3>
                <p style="color: #71717A; font-size: 0.88rem; margin: 0 0 1.5rem 0;">
                    Your workspace role permissions restrict viewing business cash flow and financial accounts.
                </p>
                <button type="button" class="btn btn-secondary" onclick="window.location.hash='#/overview'" style="font-weight: 700; font-size: 0.85rem;">
                    Return to Overview
                </button>
            </div>
        `;
        return;
    }

    let currencySymbol = '$';
    let wsCountry = 'United Kingdom';
    try {
        const wsSettings = await (settingsService.getWorkspaceSettings ? settingsService.getWorkspaceSettings() : (settingsService.getSettings ? settingsService.getSettings() : {}));
        if (wsSettings) {
            if (wsSettings.currencySymbol || wsSettings.currency) currencySymbol = wsSettings.currencySymbol || wsSettings.currency;
            if (wsSettings.country || wsSettings.countryCode || wsSettings.operatedCountry) {
                wsCountry = wsSettings.country || wsSettings.countryCode || wsSettings.operatedCountry;
            }
        }
    } catch (e) {}

    // Continental 4-Region Localization Configuration (Silent adaptive labels & examples)
    const regConfig = getRegionConfig(wsCountry);

    // State Variables
    let activeTab = initialTab || 'overview'; // 'overview' | 'transactions' | 'accounts' | 'calculator' | 'emi_accounts' | 'collection' | 'overdue' | 'reports'
    let selectedEmiDetail = null; // null or EMI Account object
    let calcState = {
        totalAmount: 1200,
        downPayment: 200,
        interestRate: 12,
        calculationMethod: 'reducing',
        duration: 12,
        frequency: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
        processingFee: 25,
        customInstallmentAmount: null
    };

    // Filter states
    let txFilterType = 'all';
    let txFilterCategory = 'all';
    let txFilterDateRange = 'this_month';
    let txSearchQuery = '';
    let emiFilterStatus = 'all';
    let emiSearchQuery = '';
    let overdueFilterBucket = 'all';

    // -----------------------------------------------------------------
    // MAIN RENDER SHELL & TABS
    // -----------------------------------------------------------------
    const render = async () => {
        container.innerHTML = `
            <div class="finance-workspace-container" style="max-width: 1280px; margin: 0 auto; animation: fadeIn 0.2s ease;">
                
                <!-- TOP HEADER -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:1rem;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h2 style="margin:0; font-size:1.75rem; font-weight:800; color:#18181B; letter-spacing:-0.02em;">Finance &amp; Customer ${regConfig.paymentTerm} Studio</h2>
                            <span class="badge" style="background:#F4F4F5; color:#18181B; border:1px solid #E4E4E7; font-size:0.75rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:999px;">
                                Enterprise Liquidity
                            </span>
                        </div>
                        <p style="margin:0.25rem 0 0 0; font-size:0.88rem; color:#71717A;">
                            General ledger, bank &amp; cash accounts, interactive ${regConfig.paymentTerm.toLowerCase()} calculations, installment tracking, and payment collection.
                        </p>
                    </div>

                    <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                        <button type="button" id="btn-quick-record-tx" class="btn btn-secondary" style="display:flex; align-items:center; gap:0.4rem; font-weight:700; font-size:0.82rem; padding:0.5rem 0.85rem; background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; border-radius:8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Record Transaction
                        </button>
                        <button type="button" id="btn-quick-collect-payment" class="btn btn-primary" style="background:#18181B; color:#ffffff; border:1px solid #18181B; display:flex; align-items:center; gap:0.4rem; font-weight:700; font-size:0.82rem; padding:0.5rem 1rem; border-radius:8px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                            ${regConfig.collectPaymentTitle}
                        </button>
                    </div>
                </div>

                <!-- NAVIGATION TABS -->
                <div class="finance-tab-bar" style="display:flex; gap:0.35rem; border-bottom:1px solid #E4E4E7; margin-bottom:1.5rem; overflow-x:auto; padding-bottom:1px;">
                    <button class="finance-tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        Financial Overview
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'transactions' ? 'active' : ''}" data-tab="transactions">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        Transactions &amp; Ledger
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'accounts' ? 'active' : ''}" data-tab="accounts">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><circle cx="16" cy="14" r="2"></circle><path d="M4 11h16"></path></svg>
                        Financial Accounts
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'calculator' ? 'active' : ''}" data-tab="calculator">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"></path></svg>
                        ${regConfig.calculatorTitle}
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'emi_accounts' ? 'active' : ''}" data-tab="emi_accounts">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        ${regConfig.accountsTabTitle}
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'collection' ? 'active' : ''}" data-tab="collection">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Payment Collection
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'overdue' ? 'active' : ''}" data-tab="overdue">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        Overdue Management
                    </button>
                    <button class="finance-tab-btn ${activeTab === 'reports' ? 'active' : ''}" data-tab="reports">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        Financial Reports
                    </button>
                </div>

                <!-- TAB CONTENT CONTAINER -->
                <div id="finance-tab-content">
                    <div style="padding: 3rem; text-align: center; color: #71717A;">Loading financial data...</div>
                </div>

            </div>

            <style>
                .finance-tab-btn {
                    padding: 0.6rem 1rem;
                    background: transparent;
                    border: none;
                    border-bottom: 2.5px solid transparent;
                    color: #71717A;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                }
                .finance-tab-btn:hover {
                    color: #18181B;
                }
                .finance-tab-btn.active {
                    color: #18181B;
                    border-bottom-color: #18181B;
                    font-weight: 700;
                }
                .finance-table-row {
                    border-bottom: 1px solid #E4E4E7;
                    transition: background 0.15s ease;
                }
                .finance-table-row:hover {
                    background: #FAFAFA;
                }
            </style>
        `;

        bindTabEvents();
        await renderActiveTab();
    };

    const bindTabEvents = () => {
        container.querySelectorAll('.finance-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                if (tab !== activeTab) {
                    activeTab = tab;
                    container.querySelectorAll('.finance-tab-btn').forEach(b => {
                        b.classList.toggle('active', b.getAttribute('data-tab') === activeTab);
                    });
                    renderActiveTab();
                }
            });
        });

        container.querySelector('#btn-quick-record-tx')?.addEventListener('click', () => {
            openTransactionModal();
        });

        container.querySelector('#btn-quick-collect-payment')?.addEventListener('click', () => {
            activeTab = 'collection';
            container.querySelectorAll('.finance-tab-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-tab') === 'collection');
            });
            renderActiveTab();
        });
    };

    const renderActiveTab = async () => {
        const target = container.querySelector('#finance-tab-content');
        if (!target) return;

        if (activeTab === 'overview') await renderOverviewTab(target);
        else if (activeTab === 'transactions') await renderTransactionsTab(target);
        else if (activeTab === 'accounts') await renderAccountsTab(target);
        else if (activeTab === 'calculator') renderCalculatorTab(target);
        else if (activeTab === 'emi_accounts') await renderEmiAccountsTab(target);
        else if (activeTab === 'collection') await renderCollectionTab(target);
        else if (activeTab === 'overdue') await renderOverdueTab(target);
        else if (activeTab === 'reports') await renderReportsTab(target);
    };

    // =========================================================================
    // TAB 1: FINANCIAL OVERVIEW (MODULE 01)
    // =========================================================================
    const renderOverviewTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Aggregating live ledger metrics...</div>`;
        const overview = await financeService.getFinancialOverview();
        const overdueData = await financeService.getOverdueAnalysis();

        const isPositiveFlow = overview.netCashFlow >= 0;

        target.innerHTML = `
            <div>
                <!-- KPI GRID: 4 PRIMARY METRICS -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                    
                    <!-- Total Inflow -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Total Cash Inflow</span>
                            <div style="width:28px; height:28px; border-radius:6px; background:#FAFAFA; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                            </div>
                        </div>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B;">
                            ${currencySymbol}${overview.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style="font-size:0.75rem; color:#71717A; margin-top:0.3rem;">Billed invoices, direct sales &amp; EMI payments</div>
                    </div>

                    <!-- Total Outflow -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Total Operating Expenses</span>
                            <div style="width:28px; height:28px; border-radius:6px; background:#FAFAFA; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                            </div>
                        </div>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B;">
                            ${currencySymbol}${overview.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style="font-size:0.75rem; color:#71717A; margin-top:0.3rem;">Inventory purchases, wages &amp; facility costs</div>
                    </div>

                    <!-- Net Cash Flow -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Net Cash Flow</span>
                            <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; font-size:0.7rem; font-weight:700; border-radius:999px;">
                                ${isPositiveFlow ? 'Surplus' : 'Deficit'}
                            </span>
                        </div>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B;">
                            ${isPositiveFlow ? '+' : '-'}${currencySymbol}${Math.abs(overview.netCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style="font-size:0.75rem; color:#71717A; margin-top:0.3rem;">Actual liquid cash net position</div>
                    </div>

                    <!-- Total Receivables & EMI Outstanding -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                            <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Outstanding Receivables</span>
                            <div style="width:28px; height:28px; border-radius:6px; background:#FAFAFA; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
                            </div>
                        </div>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B;">
                            ${currencySymbol}${overview.totalReceivables.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div style="font-size:0.75rem; color:#71717A; margin-top:0.3rem;">
                            EMI: ${currencySymbol}${overview.totalOutstandingEmi.toFixed(2)} | Overdue: ${currencySymbol}${overdueData.totalOverdueAmount.toFixed(2)}
                        </div>
                    </div>

                </div>

                <!-- SECOND ROW: LIQUID ACCOUNTS & EXPENSE BREAKDOWN -->
                <div style="display:grid; grid-template-columns: minmax(360px, 1.25fr) minmax(320px, 1fr); gap:1.25rem; margin-bottom:1.5rem; align-items:start;">
                    
                    <!-- Liquid Financial Accounts Widget -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.4rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                            <div>
                                <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">Liquid Account Balances</h3>
                                <p style="margin:0.2rem 0 0; font-size:0.78rem; color:#71717A;">Cash drawer, corporate bank, and mobile gateway accounts</p>
                            </div>
                            <button type="button" id="btn-goto-accounts" class="btn btn-secondary btn-sm" style="font-size:0.78rem; font-weight:700;">
                                Manage Accounts &rarr;
                            </button>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.65rem;">
                            ${overview.accountsSummary.map(acc => `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:0.65rem 0.85rem; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <div style="width:30px; height:30px; border-radius:6px; background:#FFFFFF; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center; color:#18181B;">
                                            ${acc.type === 'cash' ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>` : 
                                              acc.type === 'bank' ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M12 2L3 7v3h18V7L12 2z"></path></svg>` : 
                                              `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`}
                                        </div>
                                        <div>
                                            <div style="font-size:0.85rem; font-weight:700; color:#18181B;">${escapeHtml(acc.name)}</div>
                                            <div style="font-size:0.72rem; color:#71717A;">${escapeHtml(acc.accountNumber || acc.type.toUpperCase())}</div>
                                        </div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:0.95rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(acc.balance).toFixed(2)}</div>
                                        <div style="font-size:0.7rem; color:#71717A;">${acc.isDefault ? 'Default Drawer' : 'Active'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Expense Distribution Breakdown -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.4rem;">
                        <h3 style="margin:0 0 0.2rem; font-size:1.05rem; font-weight:800; color:#18181B;">Expense Distribution</h3>
                        <p style="margin:0 0 1rem; font-size:0.78rem; color:#71717A;">Operational allocation across business expense categories</p>

                        ${Object.keys(overview.categoryExpenses).length === 0 ? `
                            <div style="padding:2rem; text-align:center; font-size:0.82rem; color:#71717A; background:#FAFAFA; border-radius:8px; border:1px dashed #E4E4E7;">
                                No expenses logged yet.
                            </div>
                        ` : `
                            <div style="display:flex; flex-direction:column; gap:0.65rem;">
                                ${Object.entries(overview.categoryExpenses).slice(0, 5).map(([cat, amt]) => {
                                    const pct = overview.totalExpenses > 0 ? Math.round((amt / overview.totalExpenses) * 100) : 0;
                                    return `
                                        <div>
                                            <div style="display:flex; justify-content:space-between; font-size:0.78rem; font-weight:700; margin-bottom:0.25rem;">
                                                <span style="color:#18181B;">${escapeHtml(cat)}</span>
                                                <span style="color:#71717A;">${currencySymbol}${amt.toFixed(2)} (${pct}%)</span>
                                            </div>
                                            <div style="width:100%; height:6px; background:#F4F4F5; border-radius:999px; overflow:hidden;">
                                                <div style="width:${pct}%; height:100%; background:#18181B; border-radius:999px;"></div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>

                </div>

                <!-- THIRD ROW: UPCOMING INSTALLMENTS REMINDER -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.4rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <div>
                            <h3 style="margin:0; font-size:1.05rem; font-weight:800; color:#18181B;">Upcoming EMI Collections (Next 7 Days)</h3>
                            <p style="margin:0.2rem 0 0; font-size:0.78rem; color:#71717A;">Installments scheduled for collection in the coming week</p>
                        </div>
                        <button type="button" id="btn-goto-collection" class="btn btn-primary btn-sm" style="font-size:0.78rem; font-weight:700; background:#18181B; color:#FFFFFF; border:1px solid #18181B; padding:0.4rem 0.85rem; border-radius:6px;">
                            Open Collection Terminal &rarr;
                        </button>
                    </div>

                    ${overdueData.upcomingReminders.length === 0 ? `
                        <div style="padding:2rem; text-align:center; font-size:0.85rem; color:#71717A; background:#FAFAFA; border-radius:8px; border:1px solid #E4E4E7;">
                            No upcoming installment collections due in the next 7 days.
                        </div>
                    ` : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; color:#71717A; text-transform:uppercase; font-size:0.7rem; letter-spacing:0.04em;">
                                        <th style="padding:0.6rem 0.8rem;">Customer Name</th>
                                        <th style="padding:0.6rem 0.8rem;">EMI Account</th>
                                        <th style="padding:0.6rem 0.8rem;">Due Date</th>
                                        <th style="padding:0.6rem 0.8rem;">Days Remaining</th>
                                        <th style="padding:0.6rem 0.8rem;">Installment Amount</th>
                                        <th style="padding:0.6rem 0.8rem; text-align:right;">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${overdueData.upcomingReminders.map(rem => `
                                        <tr class="finance-table-row">
                                            <td style="padding:0.65rem 0.8rem; font-weight:700; color:#18181B;">
                                                ${escapeHtml(rem.customerName)}
                                                <div style="font-size:0.72rem; color:#71717A; font-weight:normal;">${escapeHtml(rem.customerPhone || '—')}</div>
                                            </td>
                                            <td style="padding:0.65rem 0.8rem; font-family:monospace; font-weight:600;">${escapeHtml(rem.accountNumber)}</td>
                                            <td style="padding:0.65rem 0.8rem;">${escapeHtml(rem.dueDate)}</td>
                                            <td style="padding:0.65rem 0.8rem;">
                                                <span class="badge" style="background:#FAFAFA; color:#18181B; border:1px solid #E4E4E7; font-weight:700; border-radius:999px;">
                                                    ${rem.daysUntilDue === 0 ? 'Due Today' : `In ${rem.daysUntilDue} days`}
                                                </span>
                                            </td>
                                            <td style="padding:0.65rem 0.8rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(rem.unpaidAmount).toFixed(2)}</td>
                                            <td style="padding:0.65rem 0.8rem; text-align:right;">
                                                <button type="button" class="btn btn-sm btn-secondary btn-quick-collect-rem" data-acc="${rem.accountNumber}" data-inst="${rem.installmentNumber}" style="font-size:0.75rem; font-weight:700;">
                                                    Collect
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        target.querySelector('#btn-goto-accounts')?.addEventListener('click', () => {
            activeTab = 'accounts';
            render();
        });

        target.querySelector('#btn-goto-collection')?.addEventListener('click', () => {
            activeTab = 'collection';
            render();
        });

        target.querySelectorAll('.btn-quick-collect-rem').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accNum = e.currentTarget.getAttribute('data-acc');
                openPaymentCollectionModal({ targetAccountNum: accNum });
            });
        });
    };

    // =========================================================================
    // TAB 2: GENERAL LEDGER & TRANSACTIONS (MODULE 02)
    // =========================================================================
    const renderTransactionsTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Loading general ledger...</div>`;
        const txs = await financeService.getAllTransactions({
            type: txFilterType,
            category: txFilterCategory,
            searchQuery: txSearchQuery
        });

        target.innerHTML = `
            <div>
                <!-- TOOLBAR -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1rem 1.25rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                    
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                        <!-- Type Filter -->
                        <div style="display:flex; border:1px solid #E4E4E7; border-radius:8px; overflow:hidden;">
                            <button type="button" class="btn-tx-filter-type ${txFilterType === 'all' ? 'active' : ''}" data-type="all" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:700; border:none; background:${txFilterType === 'all' ? '#18181B' : '#FFFFFF'}; color:${txFilterType === 'all' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">
                                All
                            </button>
                            <button type="button" class="btn-tx-filter-type ${txFilterType === 'income' ? 'active' : ''}" data-type="income" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${txFilterType === 'income' ? '#18181B' : '#FFFFFF'}; color:${txFilterType === 'income' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">
                                Income
                            </button>
                            <button type="button" class="btn-tx-filter-type ${txFilterType === 'expense' ? 'active' : ''}" data-type="expense" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${txFilterType === 'expense' ? '#18181B' : '#FFFFFF'}; color:${txFilterType === 'expense' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">
                                Expense
                            </button>
                            <button type="button" class="btn-tx-filter-type ${txFilterType === 'transfer' ? 'active' : ''}" data-type="transfer" style="padding:0.35rem 0.75rem; font-size:0.8rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${txFilterType === 'transfer' ? '#18181B' : '#FFFFFF'}; color:${txFilterType === 'transfer' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">
                                Transfer
                            </button>
                        </div>

                        <!-- Category Filter -->
                        <select id="tx-filter-cat" style="padding:0.4rem 0.6rem; font-size:0.8rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF;">
                            <option value="all">All Categories</option>
                            <optgroup label="Income Categories">
                                ${INCOME_CATEGORIES.map(c => `<option value="${c}" ${txFilterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </optgroup>
                            <optgroup label="Expense Categories">
                                ${EXPENSE_CATEGORIES.map(c => `<option value="${c}" ${txFilterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </optgroup>
                        </select>

                        <!-- Search -->
                        <input type="text" id="tx-search-input" value="${escapeHtml(txSearchQuery)}" placeholder="Search ref, notes, payee..." style="padding:0.4rem 0.65rem; font-size:0.8rem; border:1px solid #E4E4E7; border-radius:8px; width:180px;">
                    </div>

                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button type="button" id="btn-record-new-tx" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; padding:0.45rem 0.9rem; border-radius:8px; cursor:pointer;">
                            + Record Entry
                        </button>
                    </div>
                </div>

                <!-- TRANSACTIONS TABLE -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; overflow:hidden;">
                    ${txs.length === 0 ? `
                        <div style="padding:3rem; text-align:center; color:#71717A; font-size:0.88rem;">
                            No financial transactions match the selected filter criteria.
                        </div>
                    ` : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em;">
                                        <th style="padding:0.75rem 1rem;">Date</th>
                                        <th style="padding:0.75rem 1rem;">Type</th>
                                        <th style="padding:0.75rem 1rem;">Category</th>
                                        <th style="padding:0.75rem 1rem;">Account</th>
                                        <th style="padding:0.75rem 1rem;">Party / Ref</th>
                                        <th style="padding:0.75rem 1rem; text-align:right;">Amount</th>
                                        <th style="padding:0.75rem 1rem; text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${txs.map(t => {
                                        const isInc = t.type === 'income' || t.type === 'emi_payment';
                                        const isExp = t.type === 'expense';
                                        return `
                                            <tr class="finance-table-row">
                                                <td style="padding:0.75rem 1rem; white-space:nowrap; color:#71717A;">
                                                    ${new Date(t.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <span class="badge" style="background:${isInc ? '#FAFAFA' : (isExp ? '#FAFAFA' : '#F4F4F5')}; color:#18181B; border:1px solid #E4E4E7; font-weight:700; font-size:0.68rem; text-transform:uppercase; border-radius:999px;">
                                                        ${t.type === 'emi_payment' ? 'EMI Collect' : t.type}
                                                    </span>
                                                </td>
                                                <td style="padding:0.75rem 1rem; font-weight:700; color:#18181B;">
                                                    ${escapeHtml(t.category)}
                                                    ${t.notes ? `<div style="font-size:0.72rem; color:#71717A; font-weight:normal; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.notes)}</div>` : ''}
                                                </td>
                                                <td style="padding:0.75rem 1rem; color:#71717A;">
                                                    ${escapeHtml(t.accountName || t.fromAccountName || 'General Account')}
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <div style="font-weight:600; color:#18181B;">${escapeHtml(t.customerName || t.supplierName || '—')}</div>
                                                    <div style="font-family:monospace; font-size:0.7rem; color:#71717A;">${escapeHtml(t.reference || t.id)}</div>
                                                </td>
                                                <td style="padding:0.75rem 1rem; text-align:right; font-weight:800; font-size:0.92rem; color:#18181B;">
                                                    ${isInc ? '+' : (isExp ? '-' : '')}${currencySymbol}${Number(t.amount).toFixed(2)}
                                                </td>
                                                <td style="padding:0.75rem 1rem; text-align:right;">
                                                    <button type="button" class="btn btn-sm btn-outline btn-delete-tx" data-id="${t.id}" style="font-size:0.75rem; color:#71717A; border-color:#E4E4E7; padding:0.25rem 0.5rem; border-radius:6px;">
                                                        Archive
                                                    </button>
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

        // Bind Ledger Events
        target.querySelectorAll('.btn-tx-filter-type').forEach(b => {
            b.addEventListener('click', (e) => {
                txFilterType = e.currentTarget.getAttribute('data-type');
                renderTransactionsTab(target);
            });
        });

        target.querySelector('#tx-filter-cat')?.addEventListener('change', (e) => {
            txFilterCategory = e.target.value;
            renderTransactionsTab(target);
        });

        target.querySelector('#tx-search-input')?.addEventListener('input', (e) => {
            txSearchQuery = e.target.value;
            renderTransactionsTab(target);
        });

        target.querySelector('#btn-record-new-tx')?.addEventListener('click', () => {
            openTransactionModal();
        });

        target.querySelectorAll('.btn-delete-tx').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Archive this transaction? Linked account balance will be reconciled.")) {
                    try {
                        await financeService.deleteTransaction(id, currentUser.email);
                        showAlert.success("Transaction archived.");
                        renderTransactionsTab(target);
                    } catch (err) {
                        showAlert.error(err.message);
                    }
                }
            });
        });
    };

    // =========================================================================
    // TAB 3: FINANCIAL ACCOUNTS & LIQUIDITY (MODULE 02-C)
    // =========================================================================
    const renderAccountsTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Loading financial accounts...</div>`;
        const accounts = await financeService.getAllAccounts();

        target.innerHTML = `
            <div>
                <!-- HEADER & ACTIONS -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Corporate Accounts &amp; Liquidity</h3>
                        <p style="margin:0.2rem 0 0; font-size:0.8rem; color:#71717A;">Manage cash counters, bank checking accounts, and mobile merchant wallets</p>
                    </div>

                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button type="button" id="btn-open-transfer-modal" class="btn btn-secondary" style="background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; font-weight:700; font-size:0.82rem; padding:0.5rem 0.85rem; border-radius:8px;">
                            ⇄ Transfer Funds
                        </button>
                        <button type="button" id="btn-add-account-modal" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; padding:0.5rem 0.9rem; border-radius:8px;">
                            + New Account
                        </button>
                    </div>
                </div>

                <!-- ACCOUNTS GRID -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; margin-bottom:1.5rem;">
                    ${accounts.map(acc => `
                        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.4rem; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                                    <div style="display:flex; align-items:center; gap:0.6rem;">
                                        <div style="width:36px; height:36px; border-radius:8px; background:#FAFAFA; border:1px solid #E4E4E7; display:flex; align-items:center; justify-content:center; color:#18181B;">
                                            ${acc.type === 'cash' ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle></svg>` : 
                                              acc.type === 'bank' ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 10v11M19 10v11M12 2L3 7v3h18V7L12 2z"></path></svg>` : 
                                              `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`}
                                        </div>
                                        <div>
                                            <h4 style="margin:0; font-size:0.95rem; font-weight:800; color:#18181B;">${escapeHtml(acc.name)}</h4>
                                            <span style="font-size:0.72rem; color:#71717A;">${escapeHtml(acc.bankName || acc.type.toUpperCase())}</span>
                                        </div>
                                    </div>
                                    <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; font-size:0.7rem; font-weight:700; border-radius:999px;">
                                        ${acc.isDefault ? 'Default Drawer' : acc.type.toUpperCase()}
                                    </span>
                                </div>

                                <div style="font-size:1.75rem; font-weight:800; color:#18181B; margin-bottom:0.25rem;">
                                    ${currencySymbol}${Number(acc.balance).toFixed(2)}
                                </div>
                                <div style="font-size:0.75rem; color:#71717A; font-family:monospace;">
                                    ${acc.accountNumber ? `Account: ${escapeHtml(acc.accountNumber)}` : 'Internal Cash Register'}
                                </div>
                            </div>

                            ${acc.notes ? `
                                <div style="margin-top:0.85rem; padding-top:0.65rem; border-top:1px solid #F4F4F5; font-size:0.72rem; color:#71717A;">
                                    ${escapeHtml(acc.notes)}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        target.querySelector('#btn-open-transfer-modal')?.addEventListener('click', () => {
            openTransferModal(accounts);
        });

        target.querySelector('#btn-add-account-modal')?.addEventListener('click', () => {
            openAddAccountModal();
        });
    };

    // =========================================================================
    // TAB 4: INTERACTIVE EMI CALCULATOR (MODULE 03)
    // =========================================================================
    const renderCalculatorTab = (target) => {
        const scheduleData = calculateEmiSchedule(calcState);

        target.innerHTML = `
            <div style="display:grid; grid-template-columns: minmax(360px, 1.25fr) minmax(380px, 1.75fr); gap:1.5rem; align-items:start;">
                
                <!-- CONTROLS PANEL -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.5rem; display:flex; flex-direction:column; gap:1.15rem;">
                    <div>
                        <h3 style="margin:0 0 0.25rem; font-size:1.15rem; font-weight:800; color:#18181B;">Interactive ${regConfig.calculatorTitle}</h3>
                        <p style="margin:0; font-size:0.8rem; color:#71717A;">Configure financing parameters, amortization schedules and payment frequencies.</p>
                    </div>

                    <!-- Purchase & Down Payment -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Total Purchase Amount *</label>
                            <input type="number" id="calc-total-amount" min="10" step="any" value="${calcState.totalAmount}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; font-weight:700;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Down Payment</label>
                            <input type="number" id="calc-down-payment" min="0" step="any" value="${calcState.downPayment}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                    </div>

                    <!-- Financed Principal Display -->
                    <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.6rem 0.85rem; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.8rem; font-weight:600; color:#71717A;">Financed Principal:</span>
                        <strong style="font-size:0.95rem; color:#18181B;">${currencySymbol}${scheduleData.financedPrincipal.toFixed(2)}</strong>
                    </div>

                    <!-- Interest Method & Rate -->
                    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Interest Calculation Method</label>
                            <select id="calc-method" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                <option value="reducing" ${calcState.calculationMethod === 'reducing' ? 'selected' : ''}>Reducing Balance (Amortized)</option>
                                <option value="flat" ${calcState.calculationMethod === 'flat' ? 'selected' : ''}>Flat Interest (Original Principal)</option>
                                <option value="zero" ${calcState.calculationMethod === 'zero' ? 'selected' : ''}>0% Zero Interest Promotion</option>
                                <option value="custom" ${calcState.calculationMethod === 'custom' ? 'selected' : ''}>Custom Installment Amount</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Annual Interest (%)</label>
                            <input type="number" id="calc-interest-rate" min="0" max="100" step="0.1" value="${calcState.interestRate}" ${calcState.calculationMethod === 'zero' ? 'disabled' : ''} style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                    </div>

                    <!-- Duration & Frequency -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Installments Duration</label>
                            <input type="number" id="calc-duration" min="1" max="60" value="${calcState.duration}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Payment Frequency</label>
                            <select id="calc-frequency" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                <option value="monthly" ${calcState.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                                <option value="biweekly" ${calcState.frequency === 'biweekly' ? 'selected' : ''}>Bi-Weekly</option>
                                <option value="weekly" ${calcState.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                            </select>
                        </div>
                    </div>

                    <!-- Start Date & Processing Fee -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">First Payment Date</label>
                            <input type="date" id="calc-start-date" value="${calcState.startDate}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Processing Fee</label>
                            <input type="number" id="calc-proc-fee" min="0" step="any" value="${calcState.processingFee}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                    </div>

                    <!-- Direct Setup Button -->
                    <button type="button" id="btn-create-emi-from-calc" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.85rem; padding:0.65rem 1rem; border-radius:8px; cursor:pointer; width:100%; margin-top:0.5rem;">
                        Create Customer Account from this Plan &rarr;
                    </button>
                </div>

                <!-- PREVIEW & AMORTIZATION SCHEDULE -->
                <div style="display:flex; flex-direction:column; gap:1.25rem;">
                    
                    <!-- SUMMARY CARDS -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem;">
                        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:10px; padding:0.85rem;">
                            <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:#71717A;">${regConfig.paymentTerm} Amount</div>
                            <div style="font-size:1.25rem; font-weight:800; color:#18181B;">${currencySymbol}${scheduleData.installmentAmount.toFixed(2)}</div>
                        </div>
                        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:10px; padding:0.85rem;">
                            <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:#71717A;">Total Interest</div>
                            <div style="font-size:1.25rem; font-weight:800; color:#18181B;">${currencySymbol}${scheduleData.totalInterest.toFixed(2)}</div>
                        </div>
                        <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:10px; padding:0.85rem;">
                            <div style="font-size:0.68rem; font-weight:700; text-transform:uppercase; color:#71717A;">Total Financed</div>
                            <div style="font-size:1.25rem; font-weight:800; color:#18181B;">${currencySymbol}${scheduleData.totalPayable.toFixed(2)}</div>
                        </div>
                    </div>

                    <!-- AMORTIZATION TABLE -->
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; overflow:hidden;">
                        <div style="padding:0.85rem 1rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                            <h4 style="margin:0; font-size:0.95rem; font-weight:800; color:#18181B;">Amortization Schedule Preview</h4>
                            <span style="font-size:0.75rem; color:#71717A;">${scheduleData.schedule.length} installments (${scheduleData.frequency})</span>
                        </div>
                        <div style="max-height:420px; overflow-y:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.8rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.68rem; text-transform:uppercase;">
                                        <th style="padding:0.55rem 0.75rem;">#</th>
                                        <th style="padding:0.55rem 0.75rem;">Due Date</th>
                                        <th style="padding:0.55rem 0.75rem;">Principal</th>
                                        <th style="padding:0.55rem 0.75rem;">Interest</th>
                                        <th style="padding:0.55rem 0.75rem;">Total</th>
                                        <th style="padding:0.55rem 0.75rem; text-align:right;">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${scheduleData.schedule.map(s => `
                                        <tr class="finance-table-row">
                                            <td style="padding:0.55rem 0.75rem; font-weight:700;">${s.installmentNumber}</td>
                                            <td style="padding:0.55rem 0.75rem; color:#71717A;">${s.dueDate}</td>
                                            <td style="padding:0.55rem 0.75rem;">${currencySymbol}${s.principal.toFixed(2)}</td>
                                            <td style="padding:0.55rem 0.75rem; color:#71717A;">${currencySymbol}${s.interest.toFixed(2)}</td>
                                            <td style="padding:0.55rem 0.75rem; font-weight:800; color:#18181B;">${currencySymbol}${s.total.toFixed(2)}</td>
                                            <td style="padding:0.55rem 0.75rem; text-align:right; font-family:monospace;">${currencySymbol}${s.remainingBalance.toFixed(2)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        `;

        // Bind Calc Inputs
        const updateCalc = () => {
            calcState.totalAmount = parseFloat(target.querySelector('#calc-total-amount').value) || 0;
            calcState.downPayment = parseFloat(target.querySelector('#calc-down-payment').value) || 0;
            calcState.interestRate = parseFloat(target.querySelector('#calc-interest-rate').value) || 0;
            calcState.calculationMethod = target.querySelector('#calc-method').value;
            calcState.duration = parseInt(target.querySelector('#calc-duration').value, 10) || 1;
            calcState.frequency = target.querySelector('#calc-frequency').value;
            calcState.startDate = target.querySelector('#calc-start-date').value;
            calcState.processingFee = parseFloat(target.querySelector('#calc-proc-fee').value) || 0;
            renderCalculatorTab(target);
        };

        target.querySelector('#calc-total-amount')?.addEventListener('input', updateCalc);
        target.querySelector('#calc-down-payment')?.addEventListener('input', updateCalc);
        target.querySelector('#calc-interest-rate')?.addEventListener('input', updateCalc);
        target.querySelector('#calc-method')?.addEventListener('change', updateCalc);
        target.querySelector('#calc-duration')?.addEventListener('input', updateCalc);
        target.querySelector('#calc-frequency')?.addEventListener('change', updateCalc);
        target.querySelector('#calc-start-date')?.addEventListener('input', updateCalc);
        target.querySelector('#calc-proc-fee')?.addEventListener('input', updateCalc);

        target.querySelector('#btn-create-emi-from-calc')?.addEventListener('click', () => {
            openNewEmiSetupModal(calcState);
        });
    };

    // =========================================================================
    // TAB 5: CUSTOMER EMI ACCOUNTS (MODULE 04 & 05)
    // =========================================================================
    const renderEmiAccountsTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Loading customer EMI accounts...</div>`;
        const accounts = await financeService.getAllEmiAccounts({
            status: emiFilterStatus,
            searchQuery: emiSearchQuery
        });

        target.innerHTML = `
            <div>
                <!-- TOOLBAR -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1rem 1.25rem; margin-bottom:1.25rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                    
                    <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                        <!-- Status Filter -->
                        <select id="emi-filter-status" style="padding:0.4rem 0.65rem; font-size:0.8rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF;">
                            <option value="all">All Statuses</option>
                            <option value="active" ${emiFilterStatus === 'active' ? 'selected' : ''}>Active</option>
                            <option value="partially_paid" ${emiFilterStatus === 'partially_paid' ? 'selected' : ''}>Partially Paid</option>
                            <option value="paid" ${emiFilterStatus === 'paid' ? 'selected' : ''}>Paid / Settled</option>
                            <option value="overdue" ${emiFilterStatus === 'overdue' ? 'selected' : ''}>Overdue</option>
                            <option value="paused" ${emiFilterStatus === 'paused' ? 'selected' : ''}>Paused</option>
                            <option value="cancelled" ${emiFilterStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>

                        <!-- Search -->
                        <input type="text" id="emi-search-input" value="${escapeHtml(emiSearchQuery)}" placeholder="Search account #, customer, phone..." style="padding:0.4rem 0.65rem; font-size:0.8rem; border:1px solid #E4E4E7; border-radius:8px; width:220px;">
                    </div>

                    <div style="display:flex; gap:0.5rem; align-items:center;">
                        <button type="button" id="btn-create-new-emi" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; padding:0.45rem 0.95rem; border-radius:8px; cursor:pointer;">
                            + New ${regConfig.paymentTerm} Account
                        </button>
                    </div>
                </div>

                <!-- EMI ACCOUNTS TABLE -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; overflow:hidden;">
                    ${accounts.length === 0 ? `
                        <div style="padding:3rem; text-align:center; color:#71717A; font-size:0.88rem;">
                            No customer accounts found. Click "+ New ${regConfig.paymentTerm} Account" to setup installment plans.
                        </div>
                    ` : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em;">
                                        <th style="padding:0.75rem 1rem;">Account / Customer</th>
                                        <th style="padding:0.75rem 1rem;">Purchase Amount</th>
                                        <th style="padding:0.75rem 1rem;">Financed / Total</th>
                                        <th style="padding:0.75rem 1rem;">Paid vs Balance</th>
                                        <th style="padding:0.75rem 1rem;">Progress</th>
                                        <th style="padding:0.75rem 1rem;">Status</th>
                                        <th style="padding:0.75rem 1rem; text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${accounts.map(acc => {
                                        const pct = acc.totalPayable > 0 ? Math.min(100, Math.round((acc.totalPaid / acc.totalPayable) * 100)) : 0;
                                        return `
                                            <tr class="finance-table-row">
                                                <td style="padding:0.75rem 1rem;">
                                                    <div style="font-weight:700; color:#18181B; font-size:0.88rem;">
                                                        <a href="javascript:void(0)" class="view-emi-detail-link" data-id="${acc.id}" style="color:#18181B; text-decoration:none;">
                                                            ${escapeHtml(acc.customerName)}
                                                        </a>
                                                    </div>
                                                    <div style="font-family:monospace; font-size:0.72rem; color:#71717A;">
                                                        ${escapeHtml(acc.accountNumber)} • ${escapeHtml(acc.customerPhone || '—')}
                                                    </div>
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <div style="font-weight:700; color:#18181B;">${currencySymbol}${Number(acc.originalPurchaseAmount).toFixed(2)}</div>
                                                    <div style="font-size:0.7rem; color:#71717A;">Down: ${currencySymbol}${Number(acc.downPayment).toFixed(2)}</div>
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <div style="font-weight:700; color:#18181B;">${currencySymbol}${Number(acc.totalPayable).toFixed(2)}</div>
                                                    <div style="font-size:0.7rem; color:#71717A;">${acc.duration} inst. (${acc.frequency})</div>
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <div style="color:#18181B; font-weight:700;">Paid: ${currencySymbol}${Number(acc.totalPaid).toFixed(2)}</div>
                                                    <div style="font-size:0.72rem; color:#71717A;">Due: ${currencySymbol}${Number(acc.remainingBalance).toFixed(2)}</div>
                                                </td>
                                                <td style="padding:0.75rem 1rem; min-width:110px;">
                                                    <div style="font-size:0.72rem; font-weight:700; color:#18181B; margin-bottom:0.2rem;">${pct}%</div>
                                                    <div style="width:100%; height:6px; background:#F4F4F5; border-radius:999px; overflow:hidden;">
                                                        <div style="width:${pct}%; height:100%; background:#18181B; border-radius:999px;"></div>
                                                    </div>
                                                </td>
                                                <td style="padding:0.75rem 1rem;">
                                                    <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; font-size:0.7rem; font-weight:700; border-radius:999px; text-transform:uppercase;">
                                                        ${acc.status}
                                                    </span>
                                                </td>
                                                <td style="padding:0.75rem 1rem; text-align:right;">
                                                    <div style="display:inline-flex; gap:0.4rem; align-items:center;">
                                                        <button type="button" class="btn btn-sm btn-secondary btn-collect-for-acc" data-id="${acc.id}" style="font-size:0.75rem; font-weight:700;">
                                                            Collect
                                                        </button>
                                                        <button type="button" class="btn btn-sm btn-secondary view-emi-detail-btn" data-id="${acc.id}" style="font-size:0.75rem; font-weight:600;">
                                                            View
                                                        </button>
                                                    </div>
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

        // Bind EMI List Events
        target.querySelector('#emi-filter-status')?.addEventListener('change', (e) => {
            emiFilterStatus = e.target.value;
            renderEmiAccountsTab(target);
        });

        target.querySelector('#emi-search-input')?.addEventListener('input', (e) => {
            emiSearchQuery = e.target.value;
            renderEmiAccountsTab(target);
        });

        target.querySelector('#btn-create-new-emi')?.addEventListener('click', () => {
            openNewEmiSetupModal();
        });

        target.querySelectorAll('.view-emi-detail-btn, .view-emi-detail-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const acc = accounts.find(a => a.id === id);
                if (acc) openEmiDetailModal(acc);
            });
        });

        target.querySelectorAll('.btn-collect-for-acc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                openPaymentCollectionModal({ targetAccountId: id });
            });
        });
    };

    // =========================================================================
    // TAB 6: PAYMENT COLLECTION WORKSPACE (MODULE 06)
    // =========================================================================
    const renderCollectionTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Preparing payment collection workspace...</div>`;
        const accounts = await financeService.getAllEmiAccounts({ status: 'all' });
        const activeAccounts = accounts.filter(a => a.remainingBalance > 0 && a.status !== 'cancelled');
        const finAccounts = await financeService.getAllAccounts();

        target.innerHTML = `
            <div style="max-width:800px; margin:0 auto;">
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.75rem; box-shadow:0 4px 20px rgba(0,0,0,0.02);">
                    <div style="margin-bottom:1.5rem; border-bottom:1px solid #E4E4E7; padding-bottom:1rem;">
                        <h3 style="margin:0 0 0.25rem; font-size:1.25rem; font-weight:800; color:#18181B;">Fast Payment Collection Terminal</h3>
                        <p style="margin:0; font-size:0.82rem; color:#71717A;">Collect installment payments, reconcile general ledger accounts, and print receipts.</p>
                    </div>

                    <form id="form-collection-terminal" style="display:flex; flex-direction:column; gap:1.2rem;">
                        
                        <!-- Step 1: Account Selection -->
                        <div>
                            <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">Select Customer EMI Account *</label>
                            <select id="col-account-select" required style="width:100%; padding:0.6rem; font-size:0.88rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF;">
                                <option value="">-- Choose Account (${activeAccounts.length} active balances) --</option>
                                ${activeAccounts.map(a => `
                                    <option value="${a.id}" data-due="${a.remainingBalance}" data-inst="${a.installmentAmount}">
                                        ${escapeHtml(a.customerName)} (${escapeHtml(a.accountNumber)}) — Balance: ${currencySymbol}${Number(a.remainingBalance).toFixed(2)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Live Account Status Box -->
                        <div id="col-account-info-box" style="display:none; background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.85rem 1rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div id="col-info-cust-name" style="font-weight:800; font-size:0.95rem; color:#18181B;">Customer Name</div>
                                    <div id="col-info-acc-num" style="font-size:0.75rem; color:#71717A; font-family:monospace;">EMI-0000-0000</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-size:0.75rem; color:#71717A; font-weight:700; text-transform:uppercase;">Outstanding Balance</div>
                                    <div id="col-info-balance" style="font-size:1.25rem; font-weight:800; color:#18181B;">$0.00</div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 2: Collection Amount -->
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                                <label style="font-size:0.8rem; font-weight:700; color:#18181B;">Payment Amount to Collect *</label>
                                <div style="display:flex; gap:0.4rem;">
                                    <button type="button" id="btn-col-fill-next" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:0.2rem 0.5rem; font-weight:700;">Fill 1 Installment</button>
                                    <button type="button" id="btn-col-fill-all" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:0.2rem 0.5rem; font-weight:700;">Pay Full Balance</button>
                                </div>
                            </div>
                            <input type="number" id="col-amount" step="any" min="0.01" required placeholder="0.00" style="width:100%; padding:0.6rem; font-size:1.1rem; font-weight:800; border:1px solid #E4E4E7; border-radius:8px;">
                        </div>

                        <!-- Step 3: Payment Method & Financial Account -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem;">
                            <div>
                                <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">Payment Method</label>
                                <select id="col-method" style="width:100%; padding:0.55rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF;">
                                    <option value="Cash in Hand">Cash in Hand</option>
                                    <option value="Bank Transfer / Wire">Bank Transfer / Wire</option>
                                    <option value="Mobile Banking (bKash/Nagad)">Mobile Banking (bKash/Nagad)</option>
                                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                                    <option value="Check">Check / Pay Order</option>
                                </select>
                            </div>

                            <div>
                                <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">Deposit to Financial Account *</label>
                                <select id="col-fin-account" required style="width:100%; padding:0.55rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:8px; background:#FFFFFF;">
                                    ${finAccounts.map(fa => `
                                        <option value="${fa.id}" ${fa.isDefault ? 'selected' : ''}>
                                            ${escapeHtml(fa.name)} (Bal: ${currencySymbol}${Number(fa.balance).toFixed(2)})
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- Reference & Remarks -->
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.85rem;">
                            <div>
                                <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">Transaction Reference</label>
                                <input type="text" id="col-ref" placeholder="e.g. Bank slip # / TrxID" style="width:100%; padding:0.55rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:8px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.8rem; font-weight:700; color:#18181B; margin-bottom:0.35rem;">Notes / Remarks</label>
                                <input type="text" id="col-notes" placeholder="Optional notes for receipt" style="width:100%; padding:0.55rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:8px;">
                            </div>
                        </div>

                        <div style="padding-top:1rem; border-top:1px solid #E4E4E7; display:flex; justify-content:flex-end; gap:0.75rem;">
                            <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.9rem; padding:0.65rem 1.5rem; border-radius:8px; cursor:pointer;">
                                Confirm Payment &amp; Issue Receipt
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const selectEl = target.querySelector('#col-account-select');
        const boxEl = target.querySelector('#col-account-info-box');
        const amountEl = target.querySelector('#col-amount');

        selectEl.addEventListener('change', () => {
            const accId = selectEl.value;
            const acc = activeAccounts.find(a => a.id === accId);
            if (acc) {
                boxEl.style.display = 'block';
                target.querySelector('#col-info-cust-name').textContent = acc.customerName;
                target.querySelector('#col-info-acc-num').textContent = `${acc.accountNumber} • ${acc.customerPhone || ''}`;
                target.querySelector('#col-info-balance').textContent = `${currencySymbol}${Number(acc.remainingBalance).toFixed(2)}`;
                amountEl.value = Math.min(acc.remainingBalance, acc.installmentAmount);
            } else {
                boxEl.style.display = 'none';
            }
        });

        target.querySelector('#btn-col-fill-next')?.addEventListener('click', () => {
            const acc = activeAccounts.find(a => a.id === selectEl.value);
            if (acc) amountEl.value = Math.min(acc.remainingBalance, acc.installmentAmount);
        });

        target.querySelector('#btn-col-fill-all')?.addEventListener('click', () => {
            const acc = activeAccounts.find(a => a.id === selectEl.value);
            if (acc) amountEl.value = acc.remainingBalance;
        });

        target.querySelector('#form-collection-terminal')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emiAccountId = selectEl.value;
            const amount = parseFloat(amountEl.value);
            const paymentMethod = target.querySelector('#col-method').value;
            const financialAccountId = target.querySelector('#col-fin-account').value;
            const transactionReference = target.querySelector('#col-ref').value;
            const notes = target.querySelector('#col-notes').value;

            try {
                const res = await financeService.collectEmiPayment({
                    emiAccountId,
                    amount,
                    paymentMethod,
                    financialAccountId,
                    transactionReference,
                    notes,
                    userEmail: currentUser.email
                });

                showAlert.success(`Payment of ${currencySymbol}${amount.toFixed(2)} collected. Receipt #${res.receiptNumber}`);
                openReceiptModal(res.paymentRecord, res.emiAccount);
                renderCollectionTab(target);
            } catch (err) {
                showAlert.error(err.message);
            }
        });
    };

    // =========================================================================
    // TAB 7: OVERDUE MANAGEMENT (MODULE 07)
    // =========================================================================
    const renderOverdueTab = async (target) => {
        target.innerHTML = `<div style="padding:2rem; text-align:center; color:#71717A;">Analyzing overdue accounts and aging...</div>`;
        const overdueData = await financeService.getOverdueAnalysis();

        let filteredItems = overdueData.overdueItems;
        if (overdueFilterBucket !== 'all') {
            filteredItems = filteredItems.filter(i => i.agingBucket === overdueFilterBucket);
        }

        target.innerHTML = `
            <div>
                <!-- OVERDUE SUMMARY BANNER -->
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-bottom:1.5rem;">
                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Total Overdue Default</span>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B; margin-top:0.25rem;">
                            ${currencySymbol}${overdueData.totalOverdueAmount.toFixed(2)}
                        </div>
                        <span style="font-size:0.75rem; color:#71717A;">Across all default installments</span>
                    </div>

                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Overdue Installments</span>
                        <div style="font-size:1.6rem; font-weight:800; color:#18181B; margin-top:0.25rem;">
                            ${overdueData.totalOverdueInstallments}
                        </div>
                        <span style="font-size:0.75rem; color:#71717A;">Require follow-up and collection</span>
                    </div>

                    <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.25rem;">
                        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:#71717A;">Late Fee Policy</span>
                        <div style="font-size:1.1rem; font-weight:800; color:#18181B; margin-top:0.35rem;">
                            Configurable Grace Period
                        </div>
                        <span style="font-size:0.75rem; color:#71717A;">Waiver approval workflow active</span>
                    </div>
                </div>

                <!-- OVERDUE TABLE -->
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; overflow:hidden;">
                    <div style="padding:1rem 1.25rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <span style="font-size:0.8rem; font-weight:700; color:#18181B;">Aging Filter:</span>
                            <div style="display:flex; border:1px solid #E4E4E7; border-radius:6px; overflow:hidden;">
                                <button type="button" class="btn-aging-filter ${overdueFilterBucket === 'all' ? 'active' : ''}" data-bucket="all" style="padding:0.3rem 0.65rem; font-size:0.75rem; font-weight:700; border:none; background:${overdueFilterBucket === 'all' ? '#18181B' : '#FFFFFF'}; color:${overdueFilterBucket === 'all' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">All</button>
                                <button type="button" class="btn-aging-filter ${overdueFilterBucket === '1-30 days' ? 'active' : ''}" data-bucket="1-30 days" style="padding:0.3rem 0.65rem; font-size:0.75rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${overdueFilterBucket === '1-30 days' ? '#18181B' : '#FFFFFF'}; color:${overdueFilterBucket === '1-30 days' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">1-30 Days</button>
                                <button type="button" class="btn-aging-filter ${overdueFilterBucket === '31-60 days' ? 'active' : ''}" data-bucket="31-60 days" style="padding:0.3rem 0.65rem; font-size:0.75rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${overdueFilterBucket === '31-60 days' ? '#18181B' : '#FFFFFF'}; color:${overdueFilterBucket === '31-60 days' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">31-60 Days</button>
                                <button type="button" class="btn-aging-filter ${overdueFilterBucket === '60+ days' ? 'active' : ''}" data-bucket="60+ days" style="padding:0.3rem 0.65rem; font-size:0.75rem; font-weight:700; border:none; border-left:1px solid #E4E4E7; background:${overdueFilterBucket === '60+ days' ? '#18181B' : '#FFFFFF'}; color:${overdueFilterBucket === '60+ days' ? '#FFFFFF' : '#71717A'}; cursor:pointer;">60+ Days</button>
                            </div>
                        </div>
                    </div>

                    ${filteredItems.length === 0 ? `
                        <div style="padding:3rem; text-align:center; color:#71717A; font-size:0.88rem;">
                            No overdue installment records found under this aging filter. Excellent collection status!
                        </div>
                    ` : `
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.82rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.04em;">
                                        <th style="padding:0.75rem 1rem;">Customer Name</th>
                                        <th style="padding:0.75rem 1rem;">Account / Installment</th>
                                        <th style="padding:0.75rem 1rem;">Original Due Date</th>
                                        <th style="padding:0.75rem 1rem;">Overdue Days</th>
                                        <th style="padding:0.75rem 1rem;">Default Amount</th>
                                        <th style="padding:0.75rem 1rem; text-align:right;">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filteredItems.map(item => `
                                        <tr class="finance-table-row">
                                            <td style="padding:0.75rem 1rem;">
                                                <div style="font-weight:700; color:#18181B;">${escapeHtml(item.customerName)}</div>
                                                <div style="font-size:0.72rem; color:#71717A;">${escapeHtml(item.customerPhone || '—')}</div>
                                            </td>
                                            <td style="padding:0.75rem 1rem;">
                                                <div style="font-family:monospace; font-weight:700; color:#18181B;">${escapeHtml(item.accountNumber)}</div>
                                                <div style="font-size:0.72rem; color:#71717A;">Installment #${item.installmentNumber}</div>
                                            </td>
                                            <td style="padding:0.75rem 1rem; color:#71717A;">${escapeHtml(item.dueDate)}</td>
                                            <td style="padding:0.75rem 1rem;">
                                                <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; font-weight:700; border-radius:999px;">
                                                    ${item.daysOverdue} Days Late
                                                </span>
                                            </td>
                                            <td style="padding:0.75rem 1rem; font-weight:800; color:#18181B;">
                                                ${currencySymbol}${Number(item.unpaidAmount).toFixed(2)}
                                            </td>
                                            <td style="padding:0.75rem 1rem; text-align:right;">
                                                <button type="button" class="btn btn-sm btn-primary btn-collect-overdue" data-acc="${item.accountNumber}" data-inst="${item.installmentNumber}" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-size:0.75rem; font-weight:700; padding:0.25rem 0.65rem; border-radius:6px;">
                                                    Collect Now
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        target.querySelectorAll('.btn-aging-filter').forEach(b => {
            b.addEventListener('click', (e) => {
                overdueFilterBucket = e.currentTarget.getAttribute('data-bucket');
                renderOverdueTab(target);
            });
        });

        target.querySelectorAll('.btn-collect-overdue').forEach(b => {
            b.addEventListener('click', (e) => {
                const accNum = e.currentTarget.getAttribute('data-acc');
                const instNum = e.currentTarget.getAttribute('data-inst');
                openPaymentCollectionModal({ targetAccountNum: accNum, specificInstallmentNumber: instNum });
            });
        });
    };

    // =========================================================================
    // TAB 8: FINANCIAL REPORTS & STATEMENTS (MODULE 02-E)
    // =========================================================================
    const renderReportsTab = async (target) => {
        target.innerHTML = `
            <div style="max-width:960px; margin:0 auto; display:flex; flex-direction:column; gap:1.5rem;">
                
                <div class="card" style="background:#FFFFFF; border:1px solid #E4E4E7; border-radius:14px; padding:1.5rem;">
                    <h3 style="margin:0 0 0.25rem; font-size:1.15rem; font-weight:800; color:#18181B;">Corporate Financial Reports</h3>
                    <p style="margin:0 0 1.25rem; font-size:0.8rem; color:#71717A;">Generate official audit reports, daily cashbooks, income statements, and customer receivables.</p>

                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:1rem;">
                        
                        <!-- Daily Cashbook -->
                        <div style="border:1px solid #E4E4E7; border-radius:10px; padding:1.15rem; background:#FAFAFA; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 0.35rem; font-size:0.95rem; font-weight:800; color:#18181B;">Daily Cashbook Report</h4>
                                <p style="margin:0; font-size:0.75rem; color:#71717A;">Full chronological record of daily cash and drawer receipts with opening &amp; closing reconciliations.</p>
                            </div>
                            <button type="button" id="btn-export-cashbook-csv" class="btn btn-secondary btn-sm" style="margin-top:1rem; font-weight:700; width:100%;">
                                Export Cashbook (CSV)
                            </button>
                        </div>

                        <!-- Income Statement -->
                        <div style="border:1px solid #E4E4E7; border-radius:10px; padding:1.15rem; background:#FAFAFA; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 0.35rem; font-size:0.95rem; font-weight:800; color:#18181B;">Monthly Income Statement</h4>
                                <p style="margin:0; font-size:0.75rem; color:#71717A;">Comprehensive revenue, cost of goods, categorized overheads, and net operating cash flow.</p>
                            </div>
                            <button type="button" id="btn-export-income-csv" class="btn btn-secondary btn-sm" style="margin-top:1rem; font-weight:700; width:100%;">
                                Export Statement (CSV)
                            </button>
                        </div>

                        <!-- Customer Receivables -->
                        <div style="border:1px solid #E4E4E7; border-radius:10px; padding:1.15rem; background:#FAFAFA; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="margin:0 0 0.35rem; font-size:0.95rem; font-weight:800; color:#18181B;">Customer Receivables &amp; EMI Aging</h4>
                                <p style="margin:0; font-size:0.75rem; color:#71717A;">Itemized breakdown of unpaid customer sales invoices, active EMI plans, and overdue accounts.</p>
                            </div>
                            <button type="button" id="btn-export-receivables-csv" class="btn btn-secondary btn-sm" style="margin-top:1rem; font-weight:700; width:100%;">
                                Export Receivables (CSV)
                            </button>
                        </div>

                    </div>
                </div>

            </div>
        `;

        target.querySelector('#btn-export-cashbook-csv')?.addEventListener('click', async () => {
            const txs = await financeService.getAllTransactions();
            let csv = "Transaction ID,Date,Type,Category,Account,Party,Reference,Amount,Notes\n";
            for (const t of txs) {
                csv += `"${t.id}","${new Date(t.createdAt).toLocaleDateString()}","${t.type}","${t.category}","${t.accountName || ''}","${t.customerName || t.supplierName || ''}","${t.reference || ''}","${t.amount}","${(t.notes || '').replace(/"/g, '""')}"\n`;
            }
            downloadCsv(csv, `pricelister_cashbook_${Date.now()}.csv`);
            showAlert.success("Daily cashbook report exported.");
        });

        target.querySelector('#btn-export-income-csv')?.addEventListener('click', async () => {
            const overview = await financeService.getFinancialOverview();
            let csv = "PriceLister Income Statement Report\n";
            csv += `Generated At,${new Date().toLocaleString()}\n`;
            csv += `Total Cash Inflow,${overview.totalIncome}\n`;
            csv += `Total Operating Expenses,${overview.totalExpenses}\n`;
            csv += `Net Cash Flow,${overview.netCashFlow}\n\n`;
            csv += "Expense Category,Amount\n";
            for (const [cat, amt] of Object.entries(overview.categoryExpenses)) {
                csv += `"${cat}",${amt}\n`;
            }
            downloadCsv(csv, `pricelister_income_statement_${Date.now()}.csv`);
            showAlert.success("Income statement exported.");
        });

        target.querySelector('#btn-export-receivables-csv')?.addEventListener('click', async () => {
            const emiAccounts = await financeService.getAllEmiAccounts();
            let csv = "Account Number,Customer Name,Phone,Original Amount,Total Financed,Total Paid,Remaining Due,Status\n";
            for (const e of emiAccounts) {
                csv += `"${e.accountNumber}","${e.customerName}","${e.customerPhone || ''}","${e.originalPurchaseAmount}","${e.totalPayable}","${e.totalPaid}","${e.remainingBalance}","${e.status}"\n`;
            }
            downloadCsv(csv, `pricelister_receivables_${Date.now()}.csv`);
            showAlert.success("Customer receivables report exported.");
        });
    };

    // =========================================================================
    // MODALS: RECORD TRANSACTION, TRANSFERS, EMI SETUP & RECEIPTS
    // =========================================================================

    const openTransactionModal = async () => {
        const modalId = 'modal-record-tx';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        const accounts = await financeService.getAllAccounts();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.45); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:520px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
                <div style="padding:1.2rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Record Financial Transaction</h3>
                    <button id="btn-close-tx-modal" style="background:none; border:none; cursor:pointer; font-size:1.25rem; color:#71717A;">&times;</button>
                </div>
                <form id="form-record-tx" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Transaction Type *</label>
                            <select id="new-tx-type" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                <option value="expense">Operating Expense (-)</option>
                                <option value="income">Business Income (+)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Amount *</label>
                            <input type="number" id="new-tx-amount" step="any" min="0.01" required placeholder="0.00" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; font-weight:700;">
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Category *</label>
                        <select id="new-tx-cat" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${EXPENSE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Financial Account *</label>
                        <select id="new-tx-acc" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${accounts.map(a => `<option value="${a.id}" ${a.isDefault ? 'selected' : ''}>${escapeHtml(a.name)} (Bal: ${currencySymbol}${Number(a.balance).toFixed(2)})</option>`).join('')}
                        </select>
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Reference Code</label>
                            <input type="text" id="new-tx-ref" placeholder="Invoice # / Check #" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Customer / Supplier Name</label>
                            <input type="text" id="new-tx-party" placeholder="e.g. ${escapeHtml(regConfig.examples.enterpriseCompany.split(' / ')[0])}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Notes &amp; Description</label>
                        <textarea id="new-tx-notes" rows="2" placeholder="Audit details and transaction purpose..." style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;"></textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                        <button type="button" id="btn-cancel-tx-modal" class="btn btn-secondary" style="font-weight:700; font-size:0.82rem; border-radius:6px;">Cancel</button>
                        <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; border-radius:6px; padding:0.45rem 1rem;">Record</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-tx-modal').onclick = close;
        modal.querySelector('#btn-cancel-tx-modal').onclick = close;

        // Dynamic category options based on type
        const typeEl = modal.querySelector('#new-tx-type');
        const catEl = modal.querySelector('#new-tx-cat');
        typeEl.addEventListener('change', () => {
            const isInc = typeEl.value === 'income';
            catEl.innerHTML = (isInc ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => `<option value="${c}">${c}</option>`).join('');
        });

        modal.querySelector('#form-record-tx').onsubmit = async (e) => {
            e.preventDefault();
            const type = typeEl.value;
            const amount = parseFloat(modal.querySelector('#new-tx-amount').value);
            const category = catEl.value;
            const accountId = modal.querySelector('#new-tx-acc').value;
            const reference = modal.querySelector('#new-tx-ref').value;
            const party = modal.querySelector('#new-tx-party').value;
            const notes = modal.querySelector('#new-tx-notes').value;

            try {
                await financeService.recordTransaction({
                    type,
                    amount,
                    category,
                    accountId,
                    customerName: type === 'income' ? party : null,
                    supplierName: type === 'expense' ? party : null,
                    reference,
                    notes,
                    userEmail: currentUser.email
                });
                showAlert.success("Transaction recorded to ledger.");
                close();
                renderActiveTab();
            } catch (err) {
                showAlert.error(err.message);
            }
        };
    };

    const openTransferModal = (accounts) => {
        const modalId = 'modal-transfer-funds';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.45); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:480px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
                <div style="padding:1.2rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Transfer Funds Between Accounts</h3>
                    <button id="btn-close-trf-modal" style="background:none; border:none; cursor:pointer; font-size:1.25rem; color:#71717A;">&times;</button>
                </div>
                <form id="form-transfer-funds" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">From Account (Source) *</label>
                        <select id="trf-from-acc" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (Available: ${currencySymbol}${Number(a.balance).toFixed(2)})</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">To Account (Destination) *</label>
                        <select id="trf-to-acc" required style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${accounts.map((a, idx) => `<option value="${a.id}" ${idx === 1 ? 'selected' : ''}>${escapeHtml(a.name)} (Bal: ${currencySymbol}${Number(a.balance).toFixed(2)})</option>`).join('')}
                        </select>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Transfer Amount *</label>
                        <input type="number" id="trf-amount" step="any" min="0.01" required placeholder="0.00" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; font-weight:700;">
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Reference &amp; Reason</label>
                        <input type="text" id="trf-ref" placeholder="e.g. Bank deposit / Cash drawer replenishment" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                        <button type="button" id="btn-cancel-trf-modal" class="btn btn-secondary" style="font-weight:700; font-size:0.82rem; border-radius:6px;">Cancel</button>
                        <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; border-radius:6px; padding:0.45rem 1rem;">Execute Transfer</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-trf-modal').onclick = close;
        modal.querySelector('#btn-cancel-trf-modal').onclick = close;

        modal.querySelector('#form-transfer-funds').onsubmit = async (e) => {
            e.preventDefault();
            const fromAccountId = modal.querySelector('#trf-from-acc').value;
            const toAccountId = modal.querySelector('#trf-to-acc').value;
            const amount = parseFloat(modal.querySelector('#trf-amount').value);
            const reference = modal.querySelector('#trf-ref').value;

            try {
                await financeService.transferFunds({
                    fromAccountId,
                    toAccountId,
                    amount,
                    reference,
                    userEmail: currentUser.email
                });
                showAlert.success(`Transferred ${currencySymbol}${amount.toFixed(2)} successfully.`);
                close();
                renderAccountsTab(container.querySelector('#finance-tab-content'));
            } catch (err) {
                showAlert.error(err.message);
            }
        };
    };

    const openAddAccountModal = () => {
        const modalId = 'modal-add-fin-account';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.45); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:480px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
                <div style="padding:1.2rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">Create Financial Account</h3>
                    <button id="btn-close-new-acc-modal" style="background:none; border:none; cursor:pointer; font-size:1.25rem; color:#71717A;">&times;</button>
                </div>
                <form id="form-new-account" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem;">
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Account Name *</label>
                        <input type="text" id="new-acc-name" required placeholder="e.g. ${escapeHtml(regConfig.examples.accountName)}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>

                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Account Type *</label>
                            <select id="new-acc-type" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                <option value="bank">Commercial Bank</option>
                                <option value="cash">Physical Cash Drawer</option>
                                <option value="mfs">Mobile Wallet (MFS)</option>
                                <option value="other">Other Liquid Account</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Initial Balance</label>
                            <input type="number" id="new-acc-bal" step="any" min="0" value="0.00" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; font-weight:700;">
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Bank / Provider Name</label>
                        <input type="text" id="new-acc-bank" placeholder="e.g. ${escapeHtml(regConfig.examples.bankName)}" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>

                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Account / Phone Number</label>
                        <input type="text" id="new-acc-num" placeholder="****-1234 or mobile number" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                        <button type="button" id="btn-cancel-new-acc" class="btn btn-secondary" style="font-weight:700; font-size:0.82rem; border-radius:6px;">Cancel</button>
                        <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; border-radius:6px; padding:0.45rem 1rem;">Create Account</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-new-acc-modal').onclick = close;
        modal.querySelector('#btn-cancel-new-acc').onclick = close;

        modal.querySelector('#form-new-account').onsubmit = async (e) => {
            e.preventDefault();
            const name = modal.querySelector('#new-acc-name').value;
            const type = modal.querySelector('#new-acc-type').value;
            const balance = parseFloat(modal.querySelector('#new-acc-bal').value) || 0;
            const bankName = modal.querySelector('#new-acc-bank').value;
            const accountNumber = modal.querySelector('#new-acc-num').value;

            try {
                await financeService.createAccount({
                    name,
                    type,
                    balance,
                    bankName,
                    accountNumber
                });
                showAlert.success(`Account "${name}" created.`);
                close();
                renderAccountsTab(container.querySelector('#finance-tab-content'));
            } catch (err) {
                showAlert.error(err.message);
            }
        };
    };

    const openNewEmiSetupModal = async (prefillCalc = null) => {
        const modalId = 'modal-setup-emi';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        const finAccounts = await financeService.getAllAccounts();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.45); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:620px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden;">
                <div style="padding:1.2rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.15rem; font-weight:800; color:#18181B;">${escapeHtml(regConfig.newAccountModalTitle)}</h3>
                    <button id="btn-close-emi-modal" style="background:none; border:none; cursor:pointer; font-size:1.25rem; color:#71717A;">&times;</button>
                </div>
                <form id="form-setup-emi" style="padding:1.5rem; display:flex; flex-direction:column; gap:1rem; max-height:80vh; overflow-y:auto;">
                    
                    <!-- Customer Information -->
                    <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px; padding:1rem;">
                        <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#18181B; margin-bottom:0.6rem; display:block;">Step 1: Customer Identification</span>
                        <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:0.75rem;">
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Full Customer Name *</label>
                                <input type="text" id="emi-cust-name" required placeholder="e.g. ${escapeHtml(regConfig.examples.customerName)}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Contact Phone *</label>
                                <input type="text" id="emi-cust-phone" required placeholder="e.g. ${escapeHtml(regConfig.examples.customerPhone)}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                            </div>
                        </div>
                    </div>

                    <!-- Purchase & Loan Details -->
                    <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px; padding:1rem;">
                        <span style="font-size:0.75rem; font-weight:800; text-transform:uppercase; color:#18181B; margin-bottom:0.6rem; display:block;">Step 2: Purchase &amp; Terms</span>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem;">
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Total Purchase Price *</label>
                                <input type="number" id="emi-purchase-price" step="any" min="10" required value="${prefillCalc ? prefillCalc.totalAmount : 1200}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; font-weight:700;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Down Payment Collected</label>
                                <input type="number" id="emi-down-payment" step="any" min="0" value="${prefillCalc ? prefillCalc.downPayment : 200}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Duration (Installments)</label>
                                <input type="number" id="emi-duration" min="1" max="60" value="${prefillCalc ? prefillCalc.duration : 12}" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Calculation Method</label>
                                <select id="emi-calc-method" style="width:100%; padding:0.45rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                                    <option value="reducing">Reducing Balance</option>
                                    <option value="flat">Flat Interest</option>
                                    <option value="zero">0% Zero Interest</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Down Payment Deposit Account -->
                    <div>
                        <label style="display:block; font-size:0.78rem; font-weight:700; color:#18181B; margin-bottom:0.25rem;">Deposit Down Payment Into Account</label>
                        <select id="emi-deposit-acc" style="width:100%; padding:0.5rem; font-size:0.85rem; border:1px solid #E4E4E7; border-radius:6px; background:#FFFFFF;">
                            ${finAccounts.map(a => `<option value="${a.id}" ${a.isDefault ? 'selected' : ''}>${escapeHtml(a.name)} (Bal: ${currencySymbol}${Number(a.balance).toFixed(2)})</option>`).join('')}
                        </select>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.5rem; padding-top:1rem; border-top:1px solid #E4E4E7;">
                        <button type="button" id="btn-cancel-setup-emi" class="btn btn-secondary" style="font-weight:700; font-size:0.82rem; border-radius:6px;">Cancel</button>
                        <button type="submit" class="btn btn-primary" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700; font-size:0.82rem; border-radius:6px; padding:0.45rem 1.25rem;">Activate EMI Agreement</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-emi-modal').onclick = close;
        modal.querySelector('#btn-cancel-setup-emi').onclick = close;

        modal.querySelector('#form-setup-emi').onsubmit = async (e) => {
            e.preventDefault();
            const customerName = modal.querySelector('#emi-cust-name').value;
            const customerPhone = modal.querySelector('#emi-cust-phone').value;
            const totalPurchaseAmount = parseFloat(modal.querySelector('#emi-purchase-price').value);
            const downPayment = parseFloat(modal.querySelector('#emi-down-payment').value) || 0;
            const duration = parseInt(modal.querySelector('#emi-duration').value, 10) || 12;
            const calculationMethod = modal.querySelector('#emi-calc-method').value;
            const depositAccountId = modal.querySelector('#emi-deposit-acc').value;

            try {
                const emi = await financeService.createEmiAccount({
                    customerName,
                    customerPhone,
                    totalPurchaseAmount,
                    downPayment,
                    duration,
                    calculationMethod,
                    depositAccountId,
                    userEmail: currentUser.email
                });

                showAlert.success(`EMI Account #${emi.accountNumber} created and activated.`);
                close();
                activeTab = 'emi_accounts';
                render();
            } catch (err) {
                showAlert.error(err.message);
            }
        };
    };

    const openPaymentCollectionModal = ({ targetAccountId = null, targetAccountNum = null, specificInstallmentNumber = null }) => {
        activeTab = 'collection';
        render();
    };

    const openEmiDetailModal = async (emi) => {
        const modalId = 'modal-emi-detail';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        const payments = await financeService.getEmiPaymentsByAccount(emi.id);

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        const pct = emi.totalPayable > 0 ? Math.min(100, Math.round((emi.totalPaid / emi.totalPayable) * 100)) : 0;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:820px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden; max-height:85vh; display:flex; flex-direction:column;">
                
                <div style="padding:1.25rem 1.5rem; border-bottom:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center; background:#FAFAFA;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.6rem;">
                            <h3 style="margin:0; font-size:1.2rem; font-weight:800; color:#18181B;">${escapeHtml(emi.customerName)}</h3>
                            <span class="badge" style="background:#FFFFFF; border:1px solid #E4E4E7; color:#18181B; font-weight:700; border-radius:999px; text-transform:uppercase;">${emi.status}</span>
                        </div>
                        <div style="font-size:0.75rem; color:#71717A; font-family:monospace; margin-top:0.2rem;">${escapeHtml(emi.accountNumber)} • Phone: ${escapeHtml(emi.customerPhone || 'N/A')}</div>
                    </div>
                    <button id="btn-close-emi-detail" style="background:none; border:none; cursor:pointer; font-size:1.35rem; color:#71717A;">&times;</button>
                </div>

                <div style="padding:1.5rem; overflow-y:auto; display:flex; flex-direction:column; gap:1.25rem;">
                    
                    <!-- KPI BAR -->
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.75rem;">
                        <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.75rem;">
                            <span style="font-size:0.68rem; font-weight:700; color:#71717A; text-transform:uppercase;">Financed Principal</span>
                            <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(emi.financedPrincipal).toFixed(2)}</div>
                        </div>
                        <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.75rem;">
                            <span style="font-size:0.68rem; font-weight:700; color:#71717A; text-transform:uppercase;">Total Payable</span>
                            <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(emi.totalPayable).toFixed(2)}</div>
                        </div>
                        <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.75rem;">
                            <span style="font-size:0.68rem; font-weight:700; color:#71717A; text-transform:uppercase;">Total Collected</span>
                            <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(emi.totalPaid).toFixed(2)}</div>
                        </div>
                        <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:8px; padding:0.75rem;">
                            <span style="font-size:0.68rem; font-weight:700; color:#71717A; text-transform:uppercase;">Remaining Balance</span>
                            <div style="font-size:1.15rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(emi.remainingBalance).toFixed(2)}</div>
                        </div>
                    </div>

                    <!-- INSTALLMENTS TIMELINE TABLE -->
                    <div>
                        <h4 style="margin:0 0 0.5rem; font-size:0.95rem; font-weight:800; color:#18181B;">Installments Timeline</h4>
                        <div style="max-height:220px; overflow-y:auto; border:1px solid #E4E4E7; border-radius:8px;">
                            <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.78rem;">
                                <thead>
                                    <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.68rem; text-transform:uppercase;">
                                        <th style="padding:0.5rem 0.75rem;">#</th>
                                        <th style="padding:0.5rem 0.75rem;">Due Date</th>
                                        <th style="padding:0.5rem 0.75rem;">Principal</th>
                                        <th style="padding:0.5rem 0.75rem;">Interest</th>
                                        <th style="padding:0.5rem 0.75rem;">Total</th>
                                        <th style="padding:0.5rem 0.75rem;">Paid</th>
                                        <th style="padding:0.5rem 0.75rem;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${(emi.schedule || []).map(s => `
                                        <tr class="finance-table-row">
                                            <td style="padding:0.5rem 0.75rem; font-weight:700;">${s.installmentNumber}</td>
                                            <td style="padding:0.5rem 0.75rem; color:#71717A;">${s.dueDate}</td>
                                            <td style="padding:0.5rem 0.75rem;">${currencySymbol}${Number(s.principal).toFixed(2)}</td>
                                            <td style="padding:0.5rem 0.75rem; color:#71717A;">${currencySymbol}${Number(s.interest).toFixed(2)}</td>
                                            <td style="padding:0.5rem 0.75rem; font-weight:700; color:#18181B;">${currencySymbol}${Number(s.total).toFixed(2)}</td>
                                            <td style="padding:0.5rem 0.75rem; color:#18181B; font-weight:700;">${currencySymbol}${Number(s.paidAmount || 0).toFixed(2)}</td>
                                            <td style="padding:0.5rem 0.75rem;">
                                                <span class="badge" style="background:#FAFAFA; border:1px solid #E4E4E7; font-weight:700; font-size:0.65rem; text-transform:uppercase; border-radius:999px;">
                                                    ${s.status}
                                                </span>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- PAYMENT HISTORY -->
                    <div>
                        <h4 style="margin:0 0 0.5rem; font-size:0.95rem; font-weight:800; color:#18181B;">Payment Collection History</h4>
                        ${payments.length === 0 ? `
                            <div style="padding:1.5rem; text-align:center; font-size:0.8rem; color:#71717A; background:#FAFAFA; border-radius:8px; border:1px dashed #E4E4E7;">
                                No payments collected yet for this agreement.
                            </div>
                        ` : `
                            <div style="border:1px solid #E4E4E7; border-radius:8px; overflow:hidden;">
                                <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.78rem;">
                                    <thead>
                                        <tr style="border-bottom:1px solid #E4E4E7; background:#FAFAFA; color:#71717A; font-size:0.68rem; text-transform:uppercase;">
                                            <th style="padding:0.5rem 0.75rem;">Receipt #</th>
                                            <th style="padding:0.5rem 0.75rem;">Date</th>
                                            <th style="padding:0.5rem 0.75rem;">Method</th>
                                            <th style="padding:0.5rem 0.75rem;">Amount</th>
                                            <th style="padding:0.5rem 0.75rem;">Collector</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${payments.map(p => `
                                            <tr class="finance-table-row">
                                                <td style="padding:0.5rem 0.75rem; font-family:monospace; font-weight:700;">${escapeHtml(p.receiptNumber)}</td>
                                                <td style="padding:0.5rem 0.75rem; color:#71717A;">${new Date(p.timestamp).toLocaleDateString()}</td>
                                                <td style="padding:0.5rem 0.75rem;">${escapeHtml(p.paymentMethod)}</td>
                                                <td style="padding:0.5rem 0.75rem; font-weight:800; color:#18181B;">${currencySymbol}${Number(p.amount).toFixed(2)}</td>
                                                <td style="padding:0.5rem 0.75rem; color:#71717A;">${escapeHtml(p.collectedBy || 'Admin')}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>

                </div>

                <div style="padding:1rem 1.5rem; border-top:1px solid #E4E4E7; display:flex; justify-content:space-between; align-items:center; background:#FAFAFA;">
                    <div style="font-size:0.75rem; color:#71717A;">
                        Progress: <strong>${pct}%</strong> settled
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button type="button" id="btn-print-agreement" class="btn btn-secondary btn-sm" style="font-weight:700;">Print Agreement</button>
                        <button type="button" id="btn-collect-from-detail" class="btn btn-primary btn-sm" style="background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700;">Collect Payment</button>
                    </div>
                </div>

            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-emi-detail').onclick = close;

        modal.querySelector('#btn-collect-from-detail')?.addEventListener('click', () => {
            close();
            openPaymentCollectionModal({ targetAccountId: emi.id });
        });

        modal.querySelector('#btn-print-agreement')?.addEventListener('click', () => {
            window.print();
        });
    };

    const openReceiptModal = (payment, emi) => {
        const modalId = 'modal-receipt-view';
        let modal = document.getElementById(modalId);
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); z-index: 100000;
            display: flex; align-items: center; justify-content: center; padding: 1.5rem;
        `;

        modal.innerHTML = `
            <div style="background:#FFFFFF; border-radius:14px; width:100%; max-width:440px; border:1px solid #E4E4E7; box-shadow:0 20px 40px rgba(0,0,0,0.15); overflow:hidden; padding:2rem; text-align:center;">
                <div style="width:44px; height:44px; border-radius:50%; background:#FAFAFA; border:1px solid #E4E4E7; color:#18181B; display:flex; align-items:center; justify-content:center; margin:0 auto 1rem;">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>

                <h3 style="margin:0 0 0.25rem; font-size:1.35rem; font-weight:800; color:#18181B;">Payment Collected</h3>
                <p style="margin:0 0 1.25rem; font-size:0.8rem; color:#71717A;">Receipt #${escapeHtml(payment.receiptNumber)}</p>

                <div style="background:#FAFAFA; border:1px solid #E4E4E7; border-radius:10px; padding:1.25rem; text-align:left; font-size:0.82rem; margin-bottom:1.5rem; display:flex; flex-direction:column; gap:0.5rem;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#71717A;">Customer:</span>
                        <strong style="color:#18181B;">${escapeHtml(payment.customerName)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#71717A;">Account:</span>
                        <span style="font-family:monospace; color:#18181B;">${escapeHtml(payment.accountNumber)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#71717A;">Method:</span>
                        <span style="color:#18181B;">${escapeHtml(payment.paymentMethod)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-top:1px solid #E4E4E7; padding-top:0.5rem; margin-top:0.25rem;">
                        <strong style="color:#18181B;">Amount Paid:</strong>
                        <strong style="font-size:1.1rem; color:#18181B;">${currencySymbol}${Number(payment.amount).toFixed(2)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#71717A;">
                        <span>New Balance Remaining:</span>
                        <span>${currencySymbol}${Number(emi.remainingBalance).toFixed(2)}</span>
                    </div>
                </div>

                <div style="display:flex; gap:0.5rem;">
                    <button type="button" id="btn-print-rec" class="btn btn-secondary" style="flex:1; font-weight:700;">Print Receipt</button>
                    <button type="button" id="btn-done-rec" class="btn btn-primary" style="flex:1; background:#18181B; color:#FFFFFF; border:1px solid #18181B; font-weight:700;">Done</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-done-rec').onclick = close;
        modal.querySelector('#btn-print-rec').onclick = () => window.print();
    };

    const downloadCsv = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    // Initial render
    await render();
};
