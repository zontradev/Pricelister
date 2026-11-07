/**
 * PRICELISTER — AUTOMATION & NOTIFICATIONS SERVICE (MODULE 05)
 * Enterprise Event Bus, Low-Stock Engine, Price Change Detection,
 * Scheduled Report Execution, Task Queue & Notification Preferences
 */

import { createRepository } from '../../firebase/firestore.js';
import { generateUniqueId } from '../utils/idGenerator.js';

// Default Notification Preferences Template
const DEFAULT_PREFERENCES = {
    channels: {
        inApp: true,
        email: false
    },
    emailRecipient: '',
    categories: {
        lowStock: true,
        priceChanges: true,
        productUpdates: true,
        scheduledReports: true,
        importExport: true,
        failedTasks: true
    },
    defaultLowStockThreshold: 5,
    highValueOrderThreshold: 1000
};

// Default Automation Rules
const DEFAULT_AUTOMATION_RULES = [
    {
        id: 'rule-low-stock-guard',
        name: 'Minimum Stock Safety Threshold',
        description: 'Notify when available stock on hand falls to or below threshold',
        triggerType: 'low_stock',
        threshold: 5,
        actionType: 'notify_in_app',
        actionTarget: 'admins',
        severity: 'warning',
        enabled: true,
        lastTriggered: null
    },
    {
        id: 'rule-price-change-monitor',
        name: 'Product Price & Cost Fluctuation',
        description: 'Notify workspace members when cost or selling prices change by > 5%',
        triggerType: 'price_change',
        thresholdPct: 5,
        actionType: 'notify_in_app',
        actionTarget: 'all_members',
        severity: 'info',
        enabled: true,
        lastTriggered: null
    },
    {
        id: 'rule-margin-drop-alert',
        name: 'Gross Margin Protection Guard',
        description: 'Alert administrators if selling price results in gross profit margin < 20%',
        triggerType: 'low_margin',
        thresholdPct: 20,
        actionType: 'notify_in_app',
        actionTarget: 'admins',
        severity: 'critical',
        enabled: true,
        lastTriggered: null
    },
    {
        id: 'rule-failed-task-retry',
        name: 'Failed Task Watchdog',
        description: 'Log and notify administrators if background jobs fail',
        triggerType: 'failed_task',
        actionType: 'notify_in_app',
        actionTarget: 'admins',
        severity: 'critical',
        enabled: true,
        lastTriggered: null
    }
];

// Default Scheduled Reports
const DEFAULT_SCHEDULED_REPORTS = [
    {
        id: 'sch-rep-weekly-revenue',
        name: 'Weekly Revenue & Cash Flow Statement',
        category: 'revenue_cashflow',
        frequency: 'weekly',
        dayOfWeek: 'Monday',
        timeOfDay: '09:00',
        dateRangeType: 'last_7_days',
        format: 'pdf',
        recipients: 'admins',
        status: 'scheduled',
        lastRunAt: null,
        nextRunAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        executionCount: 0,
        deliveryHistory: []
    },
    {
        id: 'sch-rep-daily-inventory',
        name: 'Daily Inventory & Low Stock Summary',
        category: 'inventory_low_stock',
        frequency: 'daily',
        timeOfDay: '08:00',
        dateRangeType: 'current_status',
        format: 'csv',
        recipients: 'all_members',
        status: 'scheduled',
        lastRunAt: null,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        executionCount: 0,
        deliveryHistory: []
    },
    {
        id: 'sch-rep-monthly-margin',
        name: 'Monthly Margin & Profitability Analysis',
        category: 'pricing_margins',
        frequency: 'monthly',
        dayOfMonth: 1,
        timeOfDay: '00:00',
        dateRangeType: 'last_30_days',
        format: 'pdf',
        recipients: 'admins',
        status: 'scheduled',
        lastRunAt: null,
        nextRunAt: new Date(Date.now() + 86400000 * 15).toISOString(),
        executionCount: 0,
        deliveryHistory: []
    }
];

export const getAutomationService = (workspaceId) => {
    const wsId = workspaceId || 'ws_dev_mock';
    const notifRepo = createRepository('Notifications', wsId);
    const rulesRepo = createRepository('AutomationRules', wsId);
    const reportsRepo = createRepository('ScheduledReports', wsId);
    const tasksRepo = createRepository('TaskLogs', wsId);
    const prefKey = `pricelister_notif_pref_${wsId}`;
    const lowStockAlertStateKey = `pricelister_low_stock_alerted_${wsId}`;

    // Helper: Local alert state to prevent duplicate low-stock alerts
    const getLowStockAlertState = () => {
        try {
            return JSON.parse(localStorage.getItem(lowStockAlertStateKey) || '{}');
        } catch (e) {
            return {};
        }
    };

    const saveLowStockAlertState = (state) => {
        try {
            localStorage.setItem(lowStockAlertStateKey, JSON.stringify(state));
        } catch (e) {}
    };

    return {
        // =========================================================================
        // 1. NOTIFICATIONS MANAGEMENT
        // =========================================================================
        getAllNotifications: async (includeArchived = false) => {
            const all = await notifRepo.getAll();
            const filtered = all.filter(n => includeArchived ? true : !n.archived);
            return filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        },

        listenNotifications: (callback, includeArchived = false) => {
            if (typeof notifRepo.listenAll === 'function') {
                return notifRepo.listenAll((all) => {
                    const filtered = (all || []).filter(n => includeArchived ? true : !n.archived);
                    callback(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
                });
            }
            notifRepo.getAll().then(all => {
                const filtered = (all || []).filter(n => includeArchived ? true : !n.archived);
                callback(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
            }).catch(() => callback([]));
            return () => {};
        },

        getUnreadCount: async () => {
            const all = await notifRepo.getAll();
            return all.filter(n => !n.read && !n.archived).length;
        },

        createNotification: async ({
            type, // 'low_stock' | 'price_change' | 'product_update' | 'scheduled_report' | 'import_export' | 'failed_task' | 'system'
            title,
            message,
            severity = 'info', // 'info' | 'warning' | 'critical'
            metadata = {},
            targetRoles = ['CREATOR_ADMIN', 'CO_ADMIN', 'WORKER']
        }) => {
            // Check user preferences before dispatching
            const prefs = await getAutomationService(wsId).getPreferences();
            const categoryMap = {
                low_stock: 'lowStock',
                price_change: 'priceChanges',
                product_update: 'productUpdates',
                scheduled_report: 'scheduledReports',
                import_export: 'importExport',
                failed_task: 'failedTasks'
            };

            const catKey = categoryMap[type];
            if (catKey && prefs.categories && prefs.categories[catKey] === false) {
                // Category disabled by user preferences
                return null;
            }

            const notif = {
                id: `notif-${generateUniqueId()}`,
                workspaceId: wsId,
                type,
                title,
                message,
                severity,
                metadata: metadata || {},
                targetRoles,
                read: false,
                archived: false,
                timestamp: Date.now(),
                createdAt: new Date().toISOString()
            };

            await notifRepo.add(notif);

            // Dispatch in-app DOM notification event for real-time reactive UI update
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pricelister-new-notification', { detail: notif }));
            }

            return notif;
        },

        markAsRead: async (notificationId) => {
            const notif = await notifRepo.getById(notificationId);
            if (notif) {
                await notifRepo.update(notificationId, { read: true, readAt: Date.now() });
            }
        },

        markAllAsRead: async () => {
            const all = await notifRepo.getAll();
            const unread = all.filter(n => !n.read && !n.archived);
            for (const n of unread) {
                await notifRepo.update(n.id, { read: true, readAt: Date.now() });
            }
        },

        archiveNotification: async (notificationId) => {
            await notifRepo.update(notificationId, { archived: true, archivedAt: Date.now() });
        },

        deleteNotification: async (notificationId) => {
            await notifRepo.delete(notificationId);
        },

        clearAllNotifications: async () => {
            const all = await notifRepo.getAll();
            for (const n of all) {
                await notifRepo.delete(n.id);
            }
        },

        // =========================================================================
        // 2. AUTOMATION RULES ENGINE
        // =========================================================================
        getAllRules: async () => {
            let rules = await rulesRepo.getAll();
            if (!rules || rules.length === 0) {
                for (const r of DEFAULT_AUTOMATION_RULES) {
                    const ruleWithWs = { ...r, workspaceId: wsId };
                    await rulesRepo.add(ruleWithWs);
                }
                rules = await rulesRepo.getAll();
            }
            return rules;
        },

        saveRule: async (ruleData) => {
            if (ruleData.id) {
                const existing = await rulesRepo.getById(ruleData.id);
                if (existing) {
                    await rulesRepo.update(ruleData.id, { ...ruleData, updatedAt: Date.now() });
                    return ruleData.id;
                }
            }
            const newId = ruleData.id || `rule-${generateUniqueId()}`;
            const newRule = {
                ...ruleData,
                id: newId,
                workspaceId: wsId,
                enabled: ruleData.enabled !== undefined ? ruleData.enabled : true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await rulesRepo.add(newRule);
            return newId;
        },

        toggleRule: async (ruleId, isEnabled) => {
            await rulesRepo.update(ruleId, { enabled: Boolean(isEnabled), updatedAt: Date.now() });
        },

        deleteRule: async (ruleId) => {
            await rulesRepo.delete(ruleId);
        },

        // =========================================================================
        // 3. LOW-STOCK MONITORING WITH DEDUPLICATION (Feature A)
        // =========================================================================
        evaluateLowStockAlert: async (product) => {
            return await getAutomationService(wsId).evaluateProductStock(product);
        },

        evaluateProductStock: async (product) => {
            if (!product || product.isArchive) return;
            const currentQty = Number(product.quantity || product.stock || 0);
            const threshold = Number(product.minStockThreshold || product.threshold || 5);
            const alertState = getLowStockAlertState();
            const prodKey = product.id || product.uniqueId;

            if (currentQty <= threshold) {
                // Check if already alerted for this exact or lower stock level
                if (alertState[prodKey] && alertState[prodKey].lastAlertedQty === currentQty) {
                    return; // Avoid duplicate alerts until stock condition changes
                }

                // Fire notification
                const severity = currentQty === 0 ? 'critical' : 'warning';
                const title = currentQty === 0 
                    ? `Out of Stock: ${product.name}`
                    : `Low Stock Alert: ${product.name} (${currentQty} remaining)`;
                const message = `Stock level for "${product.name}" (SKU: ${product.upcCode || product.uniqueId || 'N/A'}) has reached ${currentQty} units, which is at or below the safety threshold of ${threshold} units.`;

                await getAutomationService(wsId).createNotification({
                    type: 'low_stock',
                    title,
                    message,
                    severity,
                    metadata: {
                        productId: product.id,
                        productName: product.name,
                        sku: product.upcCode || product.uniqueId,
                        stock: currentQty,
                        threshold: threshold
                    }
                });

                // Record alert state to prevent duplicates
                alertState[prodKey] = {
                    lastAlertedQty: currentQty,
                    alertedAt: Date.now()
                };
                saveLowStockAlertState(alertState);
            } else {
                // Stock replenished above threshold -> reset alert state
                if (alertState[prodKey]) {
                    delete alertState[prodKey];
                    saveLowStockAlertState(alertState);
                }
            }
        },

        // =========================================================================
        // 4. PRICE-CHANGE NOTIFICATIONS (Feature B)
        // =========================================================================
        recordPriceChangeNotification: async ({
            productId,
            productName,
            sku,
            field, // 'costPrice' | 'salePrice'
            oldValue,
            newValue,
            changedBy,
            changedByEmail
        }) => {
            const oldValNum = Number(oldValue || 0);
            const newValNum = Number(newValue || 0);
            if (oldValNum === newValNum) return;

            const diff = newValNum - oldValNum;
            const diffAmount = diff;
            const diffPercent = oldValNum > 0 ? Number(((diff / oldValNum) * 100).toFixed(2)) : 100.0;
            const pct = String(diffPercent);
            const label = field === 'costPrice' ? 'Cost Price (COGS)' : 'Selling Price';
            const sign = diff > 0 ? '+' : '';

            const title = `Price Change: ${productName} (${sign}${pct}%)`;
            const message = `${label} for "${productName}" changed from $${oldValNum.toFixed(2)} to $${newValNum.toFixed(2)} (${sign}$${diff.toFixed(2)}, ${sign}${pct}%) by ${changedByEmail || changedBy || 'Administrator'}.`;

            await getAutomationService(wsId).createNotification({
                type: 'price_change',
                title,
                message,
                severity: 'info',
                metadata: {
                    productId,
                    productName,
                    sku,
                    field,
                    oldValue: oldValNum,
                    newValue: newValNum,
                    diff,
                    pct,
                    diffAmount,
                    diffPercent,
                    changedBy,
                    changedByEmail
                }
            });
        },

        // =========================================================================
        // 5. PRODUCT UPDATE NOTIFICATIONS (Feature C)
        // =========================================================================
        recordProductUpdateNotification: async ({
            action, // 'created' | 'updated' | 'archived' | 'restored' | 'published'
            productId,
            productName,
            changedFields = [],
            changedByEmail
        }) => {
            const actionLabels = {
                created: 'New Product Created',
                updated: 'Product Updated',
                archived: 'Product Archived',
                restored: 'Product Restored',
                published: 'Product Published to Storefront'
            };

            const title = `${actionLabels[action] || 'Product Modified'}: ${productName}`;
            let message = `Product "${productName}" was ${action} by ${changedByEmail || 'Workspace Member'}.`;
            if (changedFields && changedFields.length > 0) {
                message += ` Modified fields: ${changedFields.join(', ')}.`;
            }

            await getAutomationService(wsId).createNotification({
                type: 'product_update',
                title,
                message,
                severity: action === 'archived' ? 'warning' : 'info',
                metadata: {
                    action,
                    productId,
                    productName,
                    changedFields
                }
            });
        },

        // =========================================================================
        // 6. IMPORT & EXPORT NOTIFICATIONS (Feature E)
        // =========================================================================
        recordImportExportNotification: async ({
            operation, // 'import' | 'export'
            entityType = 'products',
            totalProcessed,
            successful,
            skipped = 0,
            failed = 0,
            downloadErrorUrl = null
        }) => {
            const isImport = operation === 'import';
            const severity = failed > 0 ? 'warning' : 'info';
            const title = `${isImport ? 'Import' : 'Export'} Complete: ${entityType} (${successful}/${totalProcessed})`;
            let message = `${isImport ? 'Data import' : 'Data export'} of ${entityType} finished. Processed: ${totalProcessed}, Successful: ${successful}, Skipped: ${skipped}, Failed: ${failed}.`;
            if (downloadErrorUrl) {
                message += ' An error log is available for download.';
            }

            await getAutomationService(wsId).createNotification({
                type: 'import_export',
                title,
                message,
                severity,
                metadata: {
                    operation,
                    entityType,
                    totalProcessed,
                    successful,
                    successCount: successful,
                    skipped,
                    skippedCount: skipped,
                    failed,
                    failedCount: failed,
                    downloadErrorUrl
                }
            });
        },

        // =========================================================================
        // 7. TASK MONITOR & FAILED TASK WATCHDOG (Feature F)
        // =========================================================================
        getAllTaskLogs: async () => {
            const all = await tasksRepo.getAll();
            return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        },

        logTaskExecution: async ({
            taskName,
            taskType, // 'scheduled_report' | 'rule_evaluation' | 'stock_sweep' | 'import_sync'
            triggerSource = 'CRON_DAEMON',
            status = 'success', // 'success' | 'failed' | 'retrying'
            durationMs = 50,
            failureReason = null,
            payload = {}
        }) => {
            const taskId = `tsk-${generateUniqueId()}`;
            const taskRecord = {
                id: taskId,
                workspaceId: wsId,
                taskName,
                taskType,
                triggerSource,
                status,
                durationMs,
                failureReason,
                payload,
                retryCount: 0,
                timestamp: Date.now(),
                createdAt: new Date().toISOString()
            };

            await tasksRepo.add(taskRecord);

            // If task failed, trigger a failed-task notification
            if (status === 'failed') {
                await getAutomationService(wsId).createNotification({
                    type: 'failed_task',
                    title: `Automation Task Failed: ${taskName}`,
                    message: `Background task "${taskName}" failed with error: ${failureReason || 'Internal execution timeout'}. Click to inspect and retry safely.`,
                    severity: 'critical',
                    metadata: {
                        taskId,
                        taskName,
                        failureReason,
                        payload
                    }
                });
            }

            return taskRecord;
        },

        retryTask: async (taskId) => {
            const task = await tasksRepo.getById(taskId);
            if (!task) throw new Error("Task record not found");

            // Prevent duplicate active executions
            if (task.status === 'retrying') {
                throw new Error("Task is already being processed or already in retry queue");
            }

            await tasksRepo.update(taskId, {
                status: 'retrying',
                retryCount: (task.retryCount || 0) + 1,
                lastRetriedAt: Date.now()
            });

            // Simulate deterministic safe retry execution
            const startTime = Date.now();
            try {
                if (task.taskType === 'scheduled_report') {
                    const reportId = task.payload?.reportId;
                    if (reportId) {
                        await getAutomationService(wsId).executeScheduledReport(reportId);
                    }
                }
                const duration = Date.now() - startTime;
                await tasksRepo.update(taskId, {
                    status: 'success',
                    failureReason: null,
                    durationMs: duration,
                    completedAt: Date.now()
                });
                return { success: true, message: `Task "${task.taskName}" retried successfully` };
            } catch (err) {
                await tasksRepo.update(taskId, {
                    status: 'failed',
                    failureReason: err.message,
                    durationMs: Date.now() - startTime
                });
                throw err;
            }
        },

        clearTaskLogs: async () => {
            const all = await tasksRepo.getAll();
            for (const t of all) {
                await tasksRepo.delete(t.id);
            }
        },

        // =========================================================================
        // 8. SCHEDULED REPORTS ENGINE (Feature D)
        // =========================================================================
        getAllScheduledReports: async () => {
            let reports = await reportsRepo.getAll();
            if (!reports || reports.length === 0) {
                for (const r of DEFAULT_SCHEDULED_REPORTS) {
                    const rWithWs = { ...r, workspaceId: wsId };
                    await reportsRepo.add(rWithWs);
                }
                reports = await reportsRepo.getAll();
            }
            return reports;
        },

        saveScheduledReport: async (reportData) => {
            if (reportData.id) {
                const existing = await reportsRepo.getById(reportData.id);
                if (existing) {
                    await reportsRepo.update(reportData.id, { ...reportData, updatedAt: Date.now() });
                    return reportData.id;
                }
            }
            const newId = reportData.id || `sch-${generateUniqueId()}`;
            const newRep = {
                ...reportData,
                id: newId,
                workspaceId: wsId,
                status: 'scheduled',
                executionCount: 0,
                deliveryHistory: [],
                createdAt: Date.now()
            };
            await reportsRepo.add(newRep);
            return newId;
        },

        deleteScheduledReport: async (reportId) => {
            await reportsRepo.delete(reportId);
        },

        runScheduledReport: async (reportId) => {
            return await getAutomationService(wsId).executeScheduledReport(reportId);
        },

        executeReportGeneration: async (reportId) => {
            return await getAutomationService(wsId).executeScheduledReport(reportId);
        },

        executeScheduledReport: async (reportId) => {
            const rep = await reportsRepo.getById(reportId);
            if (!rep) throw new Error("Scheduled report config not found");

            await reportsRepo.update(reportId, { status: 'generating' });

            const start = Date.now();
            try {
                // Build report data payload
                const productsRepo = createRepository('Products', wsId);
                const invoicesRepo = createRepository('Invoices', wsId);
                const products = await productsRepo.getAll();
                const invoices = await invoicesRepo.getAll();

                let reportContent = '';
                let fileMime = 'text/csv';
                let fileName = `${rep.category}_${new Date().toISOString().split('T')[0]}.${rep.format}`;

                if (rep.category === 'revenue_cashflow') {
                    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalPrice || inv.total || 0), 0);
                    reportContent = [
                        `"PriceLister Business Intelligence - ${rep.name}"`,
                        `"Generated At","${new Date().toISOString()}"`,
                        `"Workspace ID","${wsId}"`,
                        `"Total Recorded Invoices",${invoices.length}`,
                        `"Total Gross Revenue",$${totalRevenue.toFixed(2)}`,
                        `"Invoice Number","Date","Customer","Amount","Status"`
                    ];
                    invoices.forEach(inv => {
                        reportContent.push(`"${inv.invoiceNumber || inv.id}","${inv.date || 'Recent'}","${(inv.customerName || '').replace(/"/g, '""')}","$${Number(inv.totalPrice || 0).toFixed(2)}","${inv.status || 'Paid'}"`);
                    });
                    reportContent = reportContent.join('\n');
                } else if (rep.category === 'inventory_low_stock') {
                    reportContent = [
                        `"PriceLister Inventory Digest"`,
                        `"Generated At","${new Date().toISOString()}"`,
                        `"Product Name","SKU","Current Stock","Threshold","Cost Price","Retail Price","Status"`
                    ];
                    products.forEach(p => {
                        const qty = Number(p.quantity || 0);
                        const th = Number(p.minStockThreshold || 5);
                        const st = qty === 0 ? 'OUT_OF_STOCK' : (qty <= th ? 'LOW_STOCK' : 'HEALTHY');
                        reportContent.push(`"${(p.name || '').replace(/"/g, '""')}","${p.upcCode || p.uniqueId || ''}",${qty},${th},"$${Number(p.costPrice || 0).toFixed(2)}","$${Number(p.salePrice || 0).toFixed(2)}","${st}"`);
                    });
                    reportContent = reportContent.join('\n');
                } else {
                    reportContent = [
                        `"PriceLister Margin & Price Analysis"`,
                        `"Generated At","${new Date().toISOString()}"`,
                        `"Product Name","Cost","Sale Price","Gross Profit","Margin %","Markup %"`
                    ];
                    products.forEach(p => {
                        const cost = Number(p.costPrice || 0);
                        const sale = Number(p.salePrice || 0);
                        const profit = sale - cost;
                        const margin = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0;
                        const markup = cost > 0 ? ((profit / cost) * 100).toFixed(1) : 0;
                        reportContent.push(`"${(p.name || '').replace(/"/g, '""')}","$${cost.toFixed(2)}","$${sale.toFixed(2)}","$${profit.toFixed(2)}","${margin}%","${markup}%"`);
                    });
                    reportContent = reportContent.join('\n');
                }

                // Generate real data URL for instant user download
                const downloadDataUrl = `data:${fileMime};charset=utf-8,` + encodeURIComponent(reportContent);

                const deliveryRecord = {
                    runAt: new Date().toISOString(),
                    durationMs: Date.now() - start,
                    recordCount: rep.category === 'revenue_cashflow' ? invoices.length : products.length,
                    status: 'Delivered',
                    downloadUrl: downloadDataUrl,
                    fileName
                };

                const history = Array.isArray(rep.deliveryHistory) ? rep.deliveryHistory : [];
                history.unshift(deliveryRecord);
                if (history.length > 20) history.pop(); // Keep 20 recent runs

                await reportsRepo.update(reportId, {
                    status: 'completed',
                    lastRunAt: new Date().toISOString(),
                    executionCount: (rep.executionCount || 0) + 1,
                    lastDownloadUrl: downloadDataUrl,
                    deliveryHistory: history
                });

                // Log task execution
                await getAutomationService(wsId).logTaskExecution({
                    taskName: `Scheduled Report: ${rep.name}`,
                    taskType: 'scheduled_report',
                    triggerSource: 'CRON_DAEMON',
                    status: 'success',
                    durationMs: Date.now() - start,
                    payload: { reportId, fileName }
                });

                // Dispatch notification
                await getAutomationService(wsId).createNotification({
                    type: 'scheduled_report',
                    title: `Scheduled Report Ready: ${rep.name}`,
                    message: `Report "${rep.name}" has been generated successfully and is ready for download.`,
                    severity: 'info',
                    metadata: {
                        reportId,
                        downloadUrl: downloadDataUrl,
                        fileName
                    }
                });

                return { success: true, downloadUrl: downloadDataUrl, fileName };
            } catch (err) {
                await reportsRepo.update(reportId, { status: 'failed', lastRunError: err.message });
                await getAutomationService(wsId).logTaskExecution({
                    taskName: `Scheduled Report: ${rep.name}`,
                    taskType: 'scheduled_report',
                    triggerSource: 'CRON_DAEMON',
                    status: 'failed',
                    durationMs: Date.now() - start,
                    failureReason: err.message,
                    payload: { reportId }
                });
                throw err;
            }
        },

        // =========================================================================
        // 9. NOTIFICATION PREFERENCES (Feature G)
        // =========================================================================
        getPreferences: async () => {
            try {
                const stored = localStorage.getItem(prefKey);
                if (stored) {
                    return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
                }
            } catch (e) {}
            return { ...DEFAULT_PREFERENCES };
        },

        getNotificationPreferences: async () => {
            return await getAutomationService(wsId).getPreferences();
        },

        savePreferences: async (newPreferences) => {
            const merged = { ...DEFAULT_PREFERENCES, ...newPreferences };
            try {
                localStorage.setItem(prefKey, JSON.stringify(merged));
            } catch (e) {}
            return merged;
        },

        updateNotificationPreferences: async (newPreferences) => {
            return await getAutomationService(wsId).savePreferences(newPreferences);
        }
    };
};
