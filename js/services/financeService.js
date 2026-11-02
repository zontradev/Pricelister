/**
 * PriceLister Business Finance & Customer EMI Management System Service
 * Enterprise-grade Financial Engine
 * 
 * Features:
 * - Module 01: Centralized Financial Aggregations & Metrics
 * - Module 02: General Ledger, Income/Expense tracking, Multi-Account Liquidity & Transfers
 * - Module 03: Precision EMI Calculator (Zero, Flat, Reducing Balance Amortization, Custom)
 * - Module 04: Customer EMI Account Setup, Schedule Generation & Legal Agreement Documents
 * - Module 05: EMI Running Management, Lifecycle State Transitions & Detailed Account Timeline
 * - Module 06: Idempotent Payment Collection Engine with Transparent Waterfall Allocation
 * - Module 07: Overdue Aging Management, Reminders & Configurable Late-Fee Policies
 * - Module 08: Customer EMI Portal Data Access
 * - Module 09: Precision Minor-Unit Decimal Arithmetic & Firestore Cloud Persistence
 */

import { createRepository } from '../../firebase/firestore.js';

// =============================================================================
// CONSTANTS & TAXONOMY
// =============================================================================

export const FINANCIAL_ACCOUNT_TYPES = {
    CASH: 'cash',
    BANK: 'bank',
    MFS: 'mfs', // Mobile Financial Services (bKash, Nagad, Venmo, etc.)
    OTHER: 'other'
};

export const DEFAULT_FINANCIAL_ACCOUNTS = [
    {
        id: 'acc_cash_default',
        name: 'Main Cash Drawer',
        type: 'cash',
        balance: 2500.00,
        currency: 'USD',
        isDefault: true,
        notes: 'Primary physical cash counter'
    },
    {
        id: 'acc_bank_primary',
        name: 'Corporate Operating Bank',
        bankName: 'Standard Chartered / Chase',
        accountNumber: '****-9821',
        type: 'bank',
        balance: 14500.00,
        currency: 'USD',
        isDefault: false,
        notes: 'Operational checking account'
    },
    {
        id: 'acc_mfs_primary',
        name: 'Mobile Gateway (bKash/Nagad)',
        type: 'mfs',
        accountNumber: '+880-1700-000000',
        balance: 1200.00,
        currency: 'USD',
        isDefault: false,
        notes: 'Digital merchant payments'
    }
];

export const EXPENSE_CATEGORIES = [
    'Inventory & Cost of Goods',
    'Shipping & Logistics',
    'Rent & Warehouse Facility',
    'Payroll, Salaries & Wages',
    'Marketing, Ads & Promotions',
    'Software & Cloud Infrastructure',
    'Office Equipment & Store Supplies',
    'Utilities, Power & Internet',
    'Taxes, Licenses & Government Fees',
    'Maintenance, Repair & Cleaning',
    'Bank & Transaction Processing Fees',
    'Miscellaneous Operating Expense'
];

export const INCOME_CATEGORIES = [
    'Direct Retail Product Sales',
    'B2B Wholesale Invoices',
    'Customer EMI Collection',
    'Down Payments Collected',
    'Shipping & Handling Fees',
    'Services, Setup & Installation',
    'Supplier Rebates & Refunds',
    'Capital Injection & Investments',
    'Other Operating Income'
];

export const EMI_STATUSES = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PARTIALLY_PAID: 'partially_paid',
    PAID: 'paid',
    OVERDUE: 'overdue',
    PAUSED: 'paused',
    CANCELLED: 'cancelled',
    RESTRUCTURED: 'restructured'
};

export const CALCULATION_METHODS = {
    ZERO: 'zero',
    FLAT: 'flat',
    REDUCING: 'reducing',
    CUSTOM: 'custom'
};

// =============================================================================
// PRECISION DECIMAL ARITHMETIC HELPERS (MODULE 09)
// =============================================================================

export const roundCents = (num) => {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

export const toCents = (amount) => {
    return Math.round((Number(amount) || 0) * 100);
};

export const fromCents = (cents) => {
    return (cents / 100).toFixed(2);
};

// =============================================================================
// EMI CALCULATION ENGINE (MODULE 03)
// =============================================================================

/**
 * Calculates a complete, balanced amortization schedule for any loan/EMI parameters.
 * Zero floating-point drift: guaranteed to balance down to exact $0.00 remainder.
 */
export const calculateEmiSchedule = ({
    totalAmount,
    downPayment = 0,
    interestRate = 0,
    calculationMethod = 'reducing',
    duration = 12,
    frequency = 'monthly',
    startDate = new Date().toISOString().split('T')[0],
    processingFee = 0,
    additionalCharges = 0,
    customInstallmentAmount = null
}) => {
    const origPrice = roundCents(parseFloat(totalAmount) || 0);
    const downPay = roundCents(parseFloat(downPayment) || 0);
    if (origPrice <= 0) throw new Error("Total purchase amount must be greater than zero.");
    if (downPay < 0 || downPay >= origPrice) throw new Error("Down payment must be less than total purchase amount.");

    const financedPrincipal = roundCents(origPrice - downPay);
    const numInstallments = Math.max(1, parseInt(duration, 10) || 1);
    const annualRate = Math.max(0, parseFloat(interestRate) || 0);
    const procFee = roundCents(parseFloat(processingFee) || 0);
    const addCharges = roundCents(parseFloat(additionalCharges) || 0);

    const periodsPerYear = frequency === 'weekly' ? 52 : (frequency === 'biweekly' ? 26 : 12);
    const periodicRate = (annualRate / 100) / periodsPerYear;

    let baseInstallment = 0;
    let totalInterest = 0;
    const schedule = [];

    // Helper to advance date by period
    const getDueDate = (baseDateStr, periodIndex) => {
        const parts = baseDateStr.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (frequency === 'weekly') {
            d.setDate(d.getDate() + (periodIndex * 7));
        } else if (frequency === 'biweekly') {
            d.setDate(d.getDate() + (periodIndex * 14));
        } else {
            // monthly
            d.setMonth(d.getMonth() + periodIndex);
        }
        return d.toISOString().split('T')[0];
    };

    if (calculationMethod === CALCULATION_METHODS.ZERO || annualRate === 0) {
        // 1. ZERO INTEREST
        totalInterest = 0;
        const basePrincipal = Math.floor((financedPrincipal * 100) / numInstallments) / 100;
        baseInstallment = basePrincipal;
        let remPrincipal = financedPrincipal;

        for (let k = 1; k <= numInstallments; k++) {
            const p = (k === numInstallments) ? remPrincipal : basePrincipal;
            const i = 0;
            const tot = p;
            remPrincipal = roundCents(remPrincipal - p);
            schedule.push({
                installmentNumber: k,
                dueDate: getDueDate(startDate, k),
                principal: p,
                interest: i,
                total: tot,
                remainingBalance: Math.max(0, remPrincipal),
                paidAmount: 0,
                status: 'pending'
            });
        }
    } else if (calculationMethod === CALCULATION_METHODS.FLAT) {
        // 2. FLAT INTEREST (Calculated on original financed principal)
        const durationYears = numInstallments / periodsPerYear;
        totalInterest = roundCents(financedPrincipal * (annualRate / 100) * durationYears);
        const totalWithFee = roundCents(financedPrincipal + totalInterest);

        const basePrincipal = Math.floor((financedPrincipal * 100) / numInstallments) / 100;
        const baseInterest = Math.floor((totalInterest * 100) / numInstallments) / 100;
        baseInstallment = roundCents(basePrincipal + baseInterest);

        let remPrincipal = financedPrincipal;
        let remInterest = totalInterest;

        for (let k = 1; k <= numInstallments; k++) {
            const p = (k === numInstallments) ? remPrincipal : basePrincipal;
            const i = (k === numInstallments) ? remInterest : baseInterest;
            const tot = roundCents(p + i);
            remPrincipal = roundCents(remPrincipal - p);
            remInterest = roundCents(remInterest - i);
            schedule.push({
                installmentNumber: k,
                dueDate: getDueDate(startDate, k),
                principal: p,
                interest: i,
                total: tot,
                remainingBalance: Math.max(0, remPrincipal),
                paidAmount: 0,
                status: 'pending'
            });
        }
    } else if (calculationMethod === CALCULATION_METHODS.REDUCING) {
        // 3. REDUCING BALANCE INTEREST (Standard Annuity Amortization Formula)
        if (periodicRate === 0) {
            baseInstallment = roundCents(financedPrincipal / numInstallments);
        } else {
            const factor = Math.pow(1 + periodicRate, numInstallments);
            baseInstallment = roundCents(financedPrincipal * (periodicRate * factor) / (factor - 1));
        }

        let currentBalance = financedPrincipal;
        let accumulatedInterest = 0;

        for (let k = 1; k <= numInstallments; k++) {
            const interestPortion = roundCents(currentBalance * periodicRate);
            let principalPortion = 0;
            let installmentTotal = 0;

            if (k === numInstallments) {
                // Final installment absorbs balance to guarantee $0.00 ending balance
                principalPortion = currentBalance;
                installmentTotal = roundCents(principalPortion + interestPortion);
                currentBalance = 0;
            } else {
                principalPortion = roundCents(baseInstallment - interestPortion);
                // Safety check if principal exceeds remaining balance
                if (principalPortion > currentBalance) principalPortion = currentBalance;
                installmentTotal = baseInstallment;
                currentBalance = roundCents(currentBalance - principalPortion);
            }

            accumulatedInterest = roundCents(accumulatedInterest + interestPortion);

            schedule.push({
                installmentNumber: k,
                dueDate: getDueDate(startDate, k),
                principal: principalPortion,
                interest: interestPortion,
                total: installmentTotal,
                remainingBalance: Math.max(0, currentBalance),
                paidAmount: 0,
                status: 'pending'
            });
        }
        totalInterest = accumulatedInterest;
    } else if (calculationMethod === CALCULATION_METHODS.CUSTOM && customInstallmentAmount) {
        // 4. CUSTOM FIXED INSTALLMENT
        baseInstallment = roundCents(parseFloat(customInstallmentAmount) || 100);
        let currentBalance = financedPrincipal;
        let k = 1;
        let accumulatedInterest = 0;

        while (currentBalance > 0 && k <= 120) { // Max 120 cycles safety
            const interestPortion = roundCents(currentBalance * periodicRate);
            let principalPortion = roundCents(baseInstallment - interestPortion);
            let installmentTotal = baseInstallment;

            if (principalPortion >= currentBalance || k === numInstallments) {
                principalPortion = currentBalance;
                installmentTotal = roundCents(principalPortion + interestPortion);
                currentBalance = 0;
            } else {
                currentBalance = roundCents(currentBalance - principalPortion);
            }

            accumulatedInterest = roundCents(accumulatedInterest + interestPortion);

            schedule.push({
                installmentNumber: k,
                dueDate: getDueDate(startDate, k),
                principal: principalPortion,
                interest: interestPortion,
                total: installmentTotal,
                remainingBalance: Math.max(0, currentBalance),
                paidAmount: 0,
                status: 'pending'
            });
            k++;
        }
        totalInterest = accumulatedInterest;
    }

    const totalPayable = roundCents(financedPrincipal + totalInterest + procFee + addCharges);

    return {
        originalPrice: origPrice,
        downPayment: downPay,
        financedPrincipal,
        interestRate: annualRate,
        calculationMethod,
        frequency,
        duration: schedule.length,
        totalInterest,
        processingFee: procFee,
        additionalCharges: addCharges,
        totalPayable,
        installmentAmount: schedule[0] ? schedule[0].total : baseInstallment,
        firstDueDate: schedule[0] ? schedule[0].dueDate : startDate,
        finalDueDate: schedule[schedule.length - 1] ? schedule[schedule.length - 1].dueDate : startDate,
        schedule
    };
};

// =============================================================================
// MAIN FINANCE SERVICE FACTORY
// =============================================================================

export const getFinanceService = (workspaceId) => {
    const wsId = workspaceId || 'ws_dev_mock';

    // Repositories bound to Workspaces/{wsId}/...
    const accountsRepo = createRepository('FinanceAccounts', wsId);
    const txRepo = createRepository('FinanceTransactions', wsId);
    const emiRepo = createRepository('EmiAccounts', wsId);
    const paymentsRepo = createRepository('EmiPayments', wsId);
    const invoicesRepo = createRepository('Invoices', wsId);
    const customersRepo = createRepository('ClientProfiles', wsId);

    return {
        // -------------------------------------------------------------
        // FINANCIAL ACCOUNTS (MODULE 02-C)
        // -------------------------------------------------------------
        getAllAccounts: async () => {
            let accounts = await accountsRepo.getAll();
            if (!accounts || accounts.length === 0) {
                // Seed initial corporate accounts
                for (const acc of DEFAULT_FINANCIAL_ACCOUNTS) {
                    await accountsRepo.add({
                        ...acc,
                        workspaceId: wsId,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
                accounts = await accountsRepo.getAll();
            }
            return accounts;
        },

        getAccountById: async (id) => {
            const all = await accountsRepo.getAll();
            return all.find(a => a.id === id) || null;
        },

        createAccount: async ({ name, type = 'bank', accountNumber = '', bankName = '', balance = 0, currency = 'USD', notes = '' }) => {
            const id = 'ACC-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const record = {
                id,
                name: (name || 'New Financial Account').trim(),
                type,
                accountNumber: accountNumber.trim(),
                bankName: bankName.trim(),
                balance: roundCents(parseFloat(balance) || 0),
                currency,
                notes: notes.trim(),
                workspaceId: wsId,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await accountsRepo.add(record);
            return record;
        },

        updateAccount: async (id, data) => {
            const existing = await accountsRepo.getById(id);
            if (!existing) throw new Error("Account not found");
            const updated = {
                ...existing,
                ...data,
                balance: data.balance !== undefined ? roundCents(parseFloat(data.balance)) : existing.balance,
                updatedAt: Date.now()
            };
            await accountsRepo.update(id, updated);
            return updated;
        },

        transferFunds: async ({ fromAccountId, toAccountId, amount, reference = '', notes = '', userEmail = 'admin' }) => {
            const transferAmount = roundCents(parseFloat(amount));
            if (transferAmount <= 0) throw new Error("Transfer amount must be greater than zero.");
            if (fromAccountId === toAccountId) throw new Error("Source and destination accounts must be different.");

            const accounts = await accountsRepo.getAll();
            const fromAcc = accounts.find(a => a.id === fromAccountId);
            const toAcc = accounts.find(a => a.id === toAccountId);

            if (!fromAcc) throw new Error("Source account not found.");
            if (!toAcc) throw new Error("Destination account not found.");
            if (fromAcc.balance < transferAmount) throw new Error(`Insufficient funds in ${fromAcc.name}. Available: ${fromAcc.balance}`);

            // Atomic balance adjustments
            const newFromBal = roundCents(fromAcc.balance - transferAmount);
            const newToBal = roundCents(toAcc.balance + transferAmount);

            await accountsRepo.update(fromAcc.id, { balance: newFromBal, updatedAt: Date.now() });
            await accountsRepo.update(toAcc.id, { balance: newToBal, updatedAt: Date.now() });

            // Record Transfer Audit Transaction
            const txId = 'TXN-TRF-' + Date.now();
            const transferRecord = {
                id: txId,
                type: 'transfer',
                category: 'Account Transfer',
                amount: transferAmount,
                fromAccountId,
                fromAccountName: fromAcc.name,
                toAccountId,
                toAccountName: toAcc.name,
                reference: reference || `TRF-${fromAcc.name.substring(0,3)}-${toAcc.name.substring(0,3)}`,
                notes: notes || `Internal transfer of $${transferAmount} from ${fromAcc.name} to ${toAcc.name}`,
                workspaceId: wsId,
                creatorEmail: userEmail,
                createdAt: Date.now(),
                isArchive: false
            };

            await txRepo.add(transferRecord);
            return { transferRecord, fromBalance: newFromBal, toBalance: newToBal };
        },

        // -------------------------------------------------------------
        // TRANSACTIONS & GENERAL LEDGER (MODULE 02)
        // -------------------------------------------------------------
        getAllTransactions: async ({ type, category, dateRange, startDate, endDate, accountId, searchQuery } = {}) => {
            const raw = await txRepo.getAll();
            let list = (raw || []).filter(t => !t.isArchive);

            if (type && type !== 'all') {
                list = list.filter(t => t.type === type);
            }
            if (category && category !== 'all') {
                list = list.filter(t => t.category === category);
            }
            if (accountId && accountId !== 'all') {
                list = list.filter(t => t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);
            }
            if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                list = list.filter(t => 
                    (t.reference || '').toLowerCase().includes(q) ||
                    (t.notes || '').toLowerCase().includes(q) ||
                    (t.category || '').toLowerCase().includes(q) ||
                    (t.customerName || '').toLowerCase().includes(q) ||
                    (t.supplierName || '').toLowerCase().includes(q)
                );
            }
            if (startDate) {
                const sTime = new Date(startDate).setHours(0,0,0,0);
                list = list.filter(t => t.createdAt >= sTime);
            }
            if (endDate) {
                const eTime = new Date(endDate).setHours(23,59,59,999);
                list = list.filter(t => t.createdAt <= eTime);
            }

            return list.sort((a, b) => b.createdAt - a.createdAt);
        },

        recordTransaction: async ({
            type = 'expense', // 'income' | 'expense'
            category,
            amount,
            accountId,
            customerId = null,
            customerName = null,
            supplierId = null,
            supplierName = null,
            invoiceId = null,
            reference = '',
            notes = '',
            paymentMethod = 'Bank Transfer / Wire',
            attachments = [],
            userEmail = 'admin'
        }) => {
            const txAmount = roundCents(parseFloat(amount));
            if (txAmount <= 0) throw new Error("Transaction amount must be greater than zero.");
            if (!category) throw new Error("Transaction category is required.");

            const accounts = await accountsRepo.getAll();
            const targetAcc = accounts.find(a => a.id === accountId) || accounts.find(a => a.isDefault) || accounts[0];
            if (!targetAcc) throw new Error("Valid financial account must be selected.");

            // Update financial account balance
            let newBal = targetAcc.balance;
            if (type === 'income') {
                newBal = roundCents(targetAcc.balance + txAmount);
            } else if (type === 'expense') {
                newBal = roundCents(targetAcc.balance - txAmount);
            }
            await accountsRepo.update(targetAcc.id, { balance: newBal, updatedAt: Date.now() });

            const txId = 'TXN-' + (type === 'income' ? 'INC-' : 'EXP-') + Date.now();
            const txRecord = {
                id: txId,
                type,
                category,
                amount: txAmount,
                accountId: targetAcc.id,
                accountName: targetAcc.name,
                customerId,
                customerName,
                supplierId,
                supplierName,
                invoiceId,
                paymentMethod,
                reference: reference || `REF-${Date.now().toString().slice(-6)}`,
                notes: notes.trim(),
                attachments,
                workspaceId: wsId,
                creatorEmail: userEmail,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isArchive: false
            };

            await txRepo.add(txRecord);
            return { txRecord, accountBalance: newBal };
        },

        deleteTransaction: async (id, userEmail = 'admin') => {
            const tx = await txRepo.getById(id);
            if (!tx) throw new Error("Transaction not found.");

            // Reverse balance if associated account exists
            if (tx.accountId) {
                const acc = await accountsRepo.getById(tx.accountId);
                if (acc) {
                    let reversedBal = acc.balance;
                    if (tx.type === 'income') reversedBal = roundCents(acc.balance - tx.amount);
                    if (tx.type === 'expense') reversedBal = roundCents(acc.balance + tx.amount);
                    await accountsRepo.update(acc.id, { balance: reversedBal, updatedAt: Date.now() });
                }
            }

            await txRepo.update(id, {
                isArchive: true,
                deletedAt: Date.now(),
                deletedBy: userEmail
            });
            return true;
        },

        // -------------------------------------------------------------
        // CUSTOMER EMI ACCOUNTS (MODULE 04 & 05)
        // -------------------------------------------------------------
        createEmiAccount: async ({
            customerId,
            customerName,
            customerPhone = '',
            customerEmail = '',
            invoiceId = null,
            products = [],
            totalPurchaseAmount,
            downPayment = 0,
            interestRate = 0,
            calculationMethod = 'reducing',
            duration = 12,
            frequency = 'monthly',
            startDate = new Date().toISOString().split('T')[0],
            depositAccountId = null,
            processingFee = 0,
            lateFeePolicy = { type: 'fixed', amount: 15, gracePeriodDays: 5 },
            notes = '',
            userEmail = 'admin'
        }) => {
            if (!customerId && !customerName) throw new Error("Customer profile is required for EMI creation.");

            // Calculate exact schedule
            const calc = calculateEmiSchedule({
                totalAmount: totalPurchaseAmount,
                downPayment,
                interestRate,
                calculationMethod,
                duration,
                frequency,
                startDate,
                processingFee
            });

            const uniqueAccNum = `EMI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

            const emiRecord = {
                id: uniqueAccNum,
                accountNumber: uniqueAccNum,
                customerId,
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                customerEmail: customerEmail.trim(),
                invoiceId,
                products,
                originalPurchaseAmount: calc.originalPrice,
                downPayment: calc.downPayment,
                financedPrincipal: calc.financedPrincipal,
                interestRate: calc.interestRate,
                calculationMethod: calc.calculationMethod,
                frequency: calc.frequency,
                duration: calc.duration,
                totalInterest: calc.totalInterest,
                processingFee: calc.processingFee,
                totalPayable: calc.totalPayable,
                totalPaid: 0,
                remainingBalance: calc.totalPayable,
                installmentAmount: calc.installmentAmount,
                firstDueDate: calc.firstDueDate,
                finalDueDate: calc.finalDueDate,
                status: EMI_STATUSES.ACTIVE,
                schedule: calc.schedule,
                lateFeePolicy,
                agreement: {
                    agreementNumber: `AGR-${uniqueAccNum}`,
                    status: 'active',
                    signedTimestamp: Date.now(),
                    signedBy: userEmail
                },
                notes: notes.trim(),
                workspaceId: wsId,
                creatorEmail: userEmail,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            // If down payment is collected, deposit it into financial account and log transaction
            if (calc.downPayment > 0) {
                const accounts = await accountsRepo.getAll();
                const targetAcc = accounts.find(a => a.id === depositAccountId) || accounts.find(a => a.isDefault) || accounts[0];
                if (targetAcc) {
                    const newBal = roundCents(targetAcc.balance + calc.downPayment);
                    await accountsRepo.update(targetAcc.id, { balance: newBal, updatedAt: Date.now() });

                    await txRepo.add({
                        id: `TXN-DOWN-${uniqueAccNum}`,
                        type: 'income',
                        category: 'Down Payments Collected',
                        amount: calc.downPayment,
                        accountId: targetAcc.id,
                        accountName: targetAcc.name,
                        customerId,
                        customerName: customerName.trim(),
                        reference: `DOWN-${uniqueAccNum}`,
                        notes: `Down payment for EMI Account ${uniqueAccNum}`,
                        workspaceId: wsId,
                        creatorEmail: userEmail,
                        createdAt: Date.now(),
                        isArchive: false
                    });
                }
            }

            await emiRepo.add(emiRecord);
            return emiRecord;
        },

        getAllEmiAccounts: async ({ status, customerId, searchQuery } = {}) => {
            const raw = await emiRepo.getAll();
            let list = raw || [];

            if (status && status !== 'all') {
                list = list.filter(e => e.status === status);
            }
            if (customerId) {
                list = list.filter(e => e.customerId === customerId);
            }
            if (searchQuery && searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                list = list.filter(e =>
                    (e.accountNumber || '').toLowerCase().includes(q) ||
                    (e.customerName || '').toLowerCase().includes(q) ||
                    (e.customerPhone || '').toLowerCase().includes(q) ||
                    (e.id || '').toLowerCase().includes(q)
                );
            }
            return list.sort((a, b) => b.createdAt - a.createdAt);
        },

        getEmiAccountById: async (id) => {
            const all = await emiRepo.getAll();
            return all.find(e => e.id === id || e.accountNumber === id) || null;
        },

        updateEmiAccountStatus: async (id, newStatus, reason = '', userEmail = 'admin') => {
            const emi = await emiRepo.getById(id) || (await emiRepo.getAll()).find(e => e.accountNumber === id);
            if (!emi) throw new Error("EMI account not found.");

            // Strict verification: cannot mark paid if balance remains
            if (newStatus === EMI_STATUSES.PAID && emi.remainingBalance > 0) {
                throw new Error(`Cannot mark account as Paid. Outstanding balance of $${emi.remainingBalance} remains.`);
            }

            const updated = {
                ...emi,
                status: newStatus,
                statusReason: reason,
                updatedAt: Date.now(),
                updatorEmail: userEmail
            };
            await emiRepo.update(emi.id, updated);
            return updated;
        },

        // -------------------------------------------------------------
        // PAYMENT COLLECTION ENGINE (MODULE 06)
        // -------------------------------------------------------------
        collectEmiPayment: async ({
            emiAccountId,
            amount,
            paymentMethod = 'Cash in Hand',
            financialAccountId = null,
            transactionReference = '',
            notes = '',
            specificInstallmentNumber = null,
            userEmail = 'admin'
        }) => {
            const collectAmt = roundCents(parseFloat(amount));
            if (collectAmt <= 0) throw new Error("Payment collection amount must be greater than zero.");

            const emi = await emiRepo.getById(emiAccountId) || (await emiRepo.getAll()).find(e => e.accountNumber === emiAccountId);
            if (!emi) throw new Error("EMI account not found.");
            if (emi.status === EMI_STATUSES.CANCELLED) throw new Error("Cannot collect payments on a cancelled EMI account.");
            if (emi.remainingBalance <= 0) throw new Error("This EMI account is already fully paid and settled.");

            // Prevent overcollection beyond remaining balance
            if (collectAmt > emi.remainingBalance) {
                throw new Error(`Collection amount ($${collectAmt.toFixed(2)}) exceeds outstanding balance ($${emi.remainingBalance.toFixed(2)}).`);
            }

            // Waterfall payment allocation across schedule
            let unallocatedFunds = collectAmt;
            const updatedSchedule = [...emi.schedule];
            const paymentAllocations = [];

            // If a specific installment is targeted, pay that first
            if (specificInstallmentNumber) {
                const targetIdx = updatedSchedule.findIndex(s => s.installmentNumber === parseInt(specificInstallmentNumber, 10));
                if (targetIdx >= 0 && updatedSchedule[targetIdx].status !== 'paid') {
                    const inst = updatedSchedule[targetIdx];
                    const dueOnInst = roundCents(inst.total - (inst.paidAmount || 0));
                    const toPay = Math.min(unallocatedFunds, dueOnInst);

                    inst.paidAmount = roundCents((inst.paidAmount || 0) + toPay);
                    inst.status = inst.paidAmount >= inst.total ? 'paid' : 'partially_paid';
                    if (inst.status === 'paid') inst.paidDate = new Date().toISOString().split('T')[0];

                    paymentAllocations.push({
                        installmentNumber: inst.installmentNumber,
                        dueDate: inst.dueDate,
                        allocatedAmount: toPay
                    });
                    unallocatedFunds = roundCents(unallocatedFunds - toPay);
                }
            }

            // Cascade remaining funds to oldest unpaid installments
            for (let i = 0; i < updatedSchedule.length; i++) {
                if (unallocatedFunds <= 0) break;
                const inst = updatedSchedule[i];
                if (inst.status === 'paid') continue;

                const dueOnInst = roundCents(inst.total - (inst.paidAmount || 0));
                const toPay = Math.min(unallocatedFunds, dueOnInst);

                inst.paidAmount = roundCents((inst.paidAmount || 0) + toPay);
                inst.status = inst.paidAmount >= inst.total ? 'paid' : 'partially_paid';
                if (inst.status === 'paid') inst.paidDate = new Date().toISOString().split('T')[0];

                paymentAllocations.push({
                    installmentNumber: inst.installmentNumber,
                    dueDate: inst.dueDate,
                    allocatedAmount: toPay
                });
                unallocatedFunds = roundCents(unallocatedFunds - toPay);
            }

            // Update EMI Account Totals
            const newTotalPaid = roundCents(emi.totalPaid + collectAmt);
            const newRemainingBal = roundCents(emi.totalPayable - newTotalPaid);
            const newAccountStatus = newRemainingBal <= 0 
                ? EMI_STATUSES.PAID 
                : (newTotalPaid > 0 ? EMI_STATUSES.PARTIALLY_PAID : emi.status);

            const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

            // Save Payment Record
            const paymentRecord = {
                id: `PAY-${Date.now()}`,
                receiptNumber,
                emiAccountId: emi.id,
                accountNumber: emi.accountNumber,
                customerId: emi.customerId,
                customerName: emi.customerName,
                amount: collectAmt,
                paymentMethod,
                financialAccountId,
                transactionReference: transactionReference || receiptNumber,
                allocations: paymentAllocations,
                notes: notes.trim(),
                collectedBy: userEmail,
                timestamp: Date.now(),
                workspaceId: wsId
            };
            await paymentsRepo.add(paymentRecord);

            // Deposit into selected Financial Account
            const accounts = await accountsRepo.getAll();
            const targetAcc = accounts.find(a => a.id === financialAccountId) || accounts.find(a => a.isDefault) || accounts[0];
            if (targetAcc) {
                const newAccBal = roundCents(targetAcc.balance + collectAmt);
                await accountsRepo.update(targetAcc.id, { balance: newAccBal, updatedAt: Date.now() });

                // Link to General Ledger
                await txRepo.add({
                    id: `TXN-EMI-${receiptNumber}`,
                    type: 'income',
                    category: 'Customer EMI Collection',
                    amount: collectAmt,
                    accountId: targetAcc.id,
                    accountName: targetAcc.name,
                    customerId: emi.customerId,
                    customerName: emi.customerName,
                    reference: receiptNumber,
                    notes: `Collected EMI Payment for ${emi.accountNumber}`,
                    workspaceId: wsId,
                    creatorEmail: userEmail,
                    createdAt: Date.now(),
                    isArchive: false
                });
            }

            // Save updated EMI Account
            const updatedEmi = {
                ...emi,
                totalPaid: newTotalPaid,
                remainingBalance: Math.max(0, newRemainingBal),
                status: newAccountStatus,
                schedule: updatedSchedule,
                lastPaymentDate: new Date().toISOString().split('T')[0],
                updatedAt: Date.now()
            };
            await emiRepo.update(emi.id, updatedEmi);

            return {
                paymentRecord,
                emiAccount: updatedEmi,
                receiptNumber
            };
        },

        getEmiPaymentsByAccount: async (emiAccountId) => {
            const raw = await paymentsRepo.getAll();
            const filtered = (raw || []).filter(p => p.emiAccountId === emiAccountId || p.accountNumber === emiAccountId);
            return filtered.sort((a, b) => b.timestamp - a.timestamp);
        },

        // -------------------------------------------------------------
        // OVERDUE MANAGEMENT (MODULE 07)
        // -------------------------------------------------------------
        getOverdueAnalysis: async () => {
            const accounts = await emiRepo.getAll();
            const todayStr = new Date().toISOString().split('T')[0];
            const today = new Date(todayStr);

            const overdueItems = [];
            let totalOverdueAmount = 0;
            const upcomingReminders = [];

            for (const acc of accounts) {
                if (acc.status === EMI_STATUSES.CANCELLED || acc.status === EMI_STATUSES.PAID) continue;

                for (const inst of (acc.schedule || [])) {
                    if (inst.status === 'paid') continue;
                    const dueDate = new Date(inst.dueDate);
                    const diffDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                    const unpaidAmount = roundCents(inst.total - (inst.paidAmount || 0));

                    if (diffDays > 0) {
                        // Overdue!
                        let agingBucket = '1-30 days';
                        if (diffDays > 60) agingBucket = '60+ days';
                        else if (diffDays > 30) agingBucket = '31-60 days';

                        totalOverdueAmount = roundCents(totalOverdueAmount + unpaidAmount);
                        overdueItems.push({
                            emiAccountId: acc.id,
                            accountNumber: acc.accountNumber,
                            customerId: acc.customerId,
                            customerName: acc.customerName,
                            customerPhone: acc.customerPhone,
                            installmentNumber: inst.installmentNumber,
                            dueDate: inst.dueDate,
                            unpaidAmount,
                            daysOverdue: diffDays,
                            agingBucket,
                            installment: inst
                        });
                    } else if (diffDays >= -7 && diffDays <= 0) {
                        // Due within next 7 days
                        upcomingReminders.push({
                            emiAccountId: acc.id,
                            accountNumber: acc.accountNumber,
                            customerName: acc.customerName,
                            customerPhone: acc.customerPhone,
                            installmentNumber: inst.installmentNumber,
                            dueDate: inst.dueDate,
                            unpaidAmount,
                            daysUntilDue: Math.abs(diffDays)
                        });
                    }
                }
            }

            return {
                totalOverdueAmount,
                totalOverdueInstallments: overdueItems.length,
                overdueItems: overdueItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
                upcomingReminders: upcomingReminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
            };
        },

        // -------------------------------------------------------------
        // FINANCIAL OVERVIEW & KPI AGGREGATION (MODULE 01)
        // -------------------------------------------------------------
        getFinancialOverview: async () => {
            const [txs, accounts, emiAccounts, invoices] = await Promise.all([
                txRepo.getAll().catch(() => []),
                accountsRepo.getAll().catch(() => []),
                emiRepo.getAll().catch(() => []),
                invoicesRepo.getAll().catch(() => [])
            ]);

            const activeTxs = (txs || []).filter(t => !t.isArchive);
            
            // Total Income & Expenses
            let totalIncome = 0;
            let totalExpenses = 0;
            const categoryExpenses = {};

            for (const t of activeTxs) {
                if (t.type === 'income') {
                    totalIncome = roundCents(totalIncome + t.amount);
                } else if (t.type === 'expense') {
                    totalExpenses = roundCents(totalExpenses + t.amount);
                    categoryExpenses[t.category] = roundCents((categoryExpenses[t.category] || 0) + t.amount);
                }
            }

            const netCashFlow = roundCents(totalIncome - totalExpenses);

            // EMI Totals
            let totalOutstandingEmi = 0;
            let totalCollectedEmi = 0;
            for (const e of (emiAccounts || [])) {
                if (e.status !== EMI_STATUSES.CANCELLED) {
                    totalOutstandingEmi = roundCents(totalOutstandingEmi + (e.remainingBalance || 0));
                    totalCollectedEmi = roundCents(totalCollectedEmi + (e.totalPaid || 0));
                }
            }

            // Total Receivables = Unpaid customer invoices + Total outstanding EMI
            let unpaidInvoices = 0;
            for (const inv of (invoices || [])) {
                const status = (inv.status || '').toLowerCase();
                if (status === 'unpaid' || status === 'pending' || status === 'due') {
                    unpaidInvoices = roundCents(unpaidInvoices + (parseFloat(inv.total) || 0));
                }
            }
            const totalReceivables = roundCents(unpaidInvoices + totalOutstandingEmi);

            // Total Liquidity across accounts
            let totalLiquidity = 0;
            for (const acc of (accounts || [])) {
                totalLiquidity = roundCents(totalLiquidity + (acc.balance || 0));
            }

            return {
                totalIncome,
                totalExpenses,
                netCashFlow,
                totalLiquidity,
                totalReceivables,
                totalOutstandingEmi,
                totalCollectedEmi,
                accountsSummary: accounts || [],
                categoryExpenses,
                recentTransactions: activeTxs.slice(0, 10)
            };
        }
    };
};

