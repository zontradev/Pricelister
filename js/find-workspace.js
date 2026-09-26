import { firebaseApp } from '../firebase/firebase-config.js';
import { formatRoleBadge } from './auth-handler.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const db = getFirestore(firebaseApp);

export function initFindWorkspace() {
    const form = document.getElementById('find-workspace-form');
    const inputId = document.getElementById('workspace-id-input');
    const inputIdentValue = document.getElementById('worker-ident-value');
    
    const btn = document.getElementById('find-workspace-btn');
    const loadingState = document.getElementById('find-loading');
    const notFoundState = document.getElementById('find-not-found');
    const errorState = document.getElementById('find-error');
    const errorMessage = document.getElementById('find-error-message');
    const resultState = document.getElementById('find-result');

    // Result fields
    const resWsName = document.getElementById('result-ws-name');
    const resWsId = document.getElementById('result-ws-id');
    const resAdminName = document.getElementById('result-admin-name');
    const resAdminEmail = document.getElementById('result-admin-email');
    const resAdminId = document.getElementById('result-admin-id');
    const workerSection = document.getElementById('result-worker-section');

    if (!form) return;

    // Helper: Count up animation
    const animateStat = (el, target) => {
        if (!el) return;
        const finalVal = parseInt(target, 10) || 0;
        if (finalVal === 0) {
            el.textContent = '0';
            return;
        }
        let current = 0;
        const step = Math.max(1, Math.floor(finalVal / 25));
        const timer = setInterval(() => {
            current += step;
            if (current >= finalVal) {
                current = finalVal;
                clearInterval(timer);
            }
            el.textContent = current.toLocaleString();
        }, 20);
    };

    /**
     * Comprehensive Workspace Lookup:
     * 1. Checks direct Document ID (Doc ID = input)
     * 2. Checks document field 'workspaceId' (e.g. 102ZM5J72FNB99)
     * 3. Checks document field 'adminId' (e.g. MUI4JS8S83F33A)
     * 4. Checks document field 'adminEmail' / 'email'
     * 5. Checks document field 'name'
     * 6. Scans all documents in Workspaces as fallback (case-insensitive)
     * 7. Checks Connections / userCollection
     */
    async function searchWorkspaceByIdentifier(rawKey) {
        if (!rawKey) return null;
        const key = rawKey.trim().replace(/^['"]|['"]$/g, '');
        if (!key) return null;

        // Mock bypass
        if (key === 'dev-mock-uid' || key === 'ws_dev_mock') {
            return {
                id: 'ws_dev_mock',
                data: {
                    workspaceId: 'DEV_MOCK_WS_ID',
                    name: 'Local Dev Workspace',
                    adminName: 'Lead Developer',
                    adminEmail: 'developer@local.test',
                    adminId: 'DEV_MOCK_ADMIN_ID',
                    adminProductCount: 24,
                    adminInvoiceCount: 8,
                    adminCategoryCount: 4,
                    adminClientCount: 12,
                    workersCount: 2,
                    currency: '$',
                    currencySymbol: '$',
                    createdAt: Date.now()
                },
                sourceWorker: null
            };
        }

        const collectionsToCheck = ['Workspaces', 'workspaces'];

        // 1. Direct Document Lookup by ID (Doc ID matching input)
        for (const coll of collectionsToCheck) {
            try {
                const snap = await getDoc(doc(db, coll, key));
                if (snap.exists()) {
                    return { id: snap.id, data: snap.data(), sourceWorker: null };
                }
            } catch (e) {}
        }

        // 2. Query Workspaces by workspaceId field (e.g. "102ZM5J72FNB99")
        for (const coll of collectionsToCheck) {
            try {
                // Exact match
                const qWs = query(collection(db, coll), where('workspaceId', '==', key));
                const sWs = await getDocs(qWs);
                if (!sWs.empty) return { id: sWs.docs[0].id, data: sWs.docs[0].data(), sourceWorker: null };

                // Upper case match
                if (key !== key.toUpperCase()) {
                    const qUp = query(collection(db, coll), where('workspaceId', '==', key.toUpperCase()));
                    const sUp = await getDocs(qUp);
                    if (!sUp.empty) return { id: sUp.docs[0].id, data: sUp.docs[0].data(), sourceWorker: null };
                }

                // Lower case match
                if (key !== key.toLowerCase()) {
                    const qLow = query(collection(db, coll), where('workspaceId', '==', key.toLowerCase()));
                    const sLow = await getDocs(qLow);
                    if (!sLow.empty) return { id: sLow.docs[0].id, data: sLow.docs[0].data(), sourceWorker: null };
                }
            } catch (e) {
                console.warn(`Query search workspaceId on ${coll}:`, e);
            }
        }

        // 3. Query Workspaces by adminId field (e.g. "MUI4JS8S83F33A")
        for (const coll of collectionsToCheck) {
            try {
                const qAdm = query(collection(db, coll), where('adminId', '==', key));
                const sAdm = await getDocs(qAdm);
                if (!sAdm.empty) return { id: sAdm.docs[0].id, data: sAdm.docs[0].data(), sourceWorker: null };

                if (key !== key.toUpperCase()) {
                    const qAdmUp = query(collection(db, coll), where('adminId', '==', key.toUpperCase()));
                    const sAdmUp = await getDocs(qAdmUp);
                    if (!sAdmUp.empty) return { id: sAdmUp.docs[0].id, data: sAdmUp.docs[0].data(), sourceWorker: null };
                }
            } catch (e) {
                console.warn(`Query search adminId on ${coll}:`, e);
            }
        }

        // 4. Query Workspaces by adminEmail / email field
        if (key.includes('@')) {
            const emailLower = key.toLowerCase();
            for (const coll of collectionsToCheck) {
                try {
                    const qEm1 = query(collection(db, coll), where('adminEmail', '==', emailLower));
                    const sEm1 = await getDocs(qEm1);
                    if (!sEm1.empty) return { id: sEm1.docs[0].id, data: sEm1.docs[0].data(), sourceWorker: null };

                    const qEm2 = query(collection(db, coll), where('email', '==', emailLower));
                    const sEm2 = await getDocs(qEm2);
                    if (!sEm2.empty) return { id: sEm2.docs[0].id, data: sEm2.docs[0].data(), sourceWorker: null };
                } catch (e) {}
            }
        }

        // 5. Query Workspaces by name
        for (const coll of collectionsToCheck) {
            try {
                const qNm = query(collection(db, coll), where('name', '==', key));
                const sNm = await getDocs(qNm);
                if (!sNm.empty) return { id: sNm.docs[0].id, data: sNm.docs[0].data(), sourceWorker: null };
            } catch (e) {}
        }

        // 6. Deep Scan across Workspaces collection (comprehensive case-insensitive fallback)
        for (const coll of collectionsToCheck) {
            try {
                const allSnap = await getDocs(collection(db, coll));
                const targetClean = key.toLowerCase();

                for (const d of allSnap.docs) {
                    const data = d.data();
                    const docId = d.id.toLowerCase();
                    const wsId = (data.workspaceId || '').toLowerCase();
                    const admId = (data.adminId || '').toLowerCase();
                    const admEmail = (data.adminEmail || data.email || '').toLowerCase();
                    const wsName = (data.name || '').toLowerCase();
                    const admName = (data.adminName || '').toLowerCase();

                    if (
                        docId === targetClean ||
                        wsId === targetClean ||
                        admId === targetClean ||
                        admEmail === targetClean ||
                        wsName === targetClean ||
                        admName === targetClean
                    ) {
                        return { id: d.id, data: data, sourceWorker: null };
                    }
                }
            } catch (e) {
                console.warn(`Deep scan on ${coll}:`, e);
            }
        }

        // 7. Check Connections collection (Worker UID / Email -> Workspace)
        for (const coll of ['Connections', 'connections']) {
            try {
                const connSnap = await getDoc(doc(db, coll, key));
                if (connSnap.exists()) {
                    const cData = connSnap.data();
                    const targetUid = cData.adminUid || cData.workspaceDocUid || cData.workspaceId;
                    if (targetUid) {
                        for (const wsColl of collectionsToCheck) {
                            try {
                                const wsSnap = await getDoc(doc(db, wsColl, targetUid));
                                if (wsSnap.exists()) {
                                    return {
                                        id: wsSnap.id,
                                        data: wsSnap.data(),
                                        sourceWorker: {
                                            name: cData.name || cData.workerName || 'Connected Member',
                                            email: cData.email || cData.workerEmail || '',
                                            id: key,
                                            role: cData.role || 'WORKER',
                                            joinedAt: cData.timestamp || cData.joinedAt || null
                                        }
                                    };
                                }
                            } catch (e) {}
                        }
                    }
                }
            } catch (e) {}
        }

        return null;
    }

    /**
     * Check if a worker exists in the given workspace:
     * Checks Admin match, Members subcollection, and Connections
     */
    async function checkWorkerInWorkspace(wsDocId, wsData, rawWorkerInput) {
        if (!rawWorkerInput) return null;
        const cleanIdent = rawWorkerInput.trim().toLowerCase();
        if (!cleanIdent) return null;

        // 1. Check if the worker input matches the Admin / Creator
        const admEmail = (wsData.adminEmail || wsData.email || '').toLowerCase();
        const admId = (wsData.adminId || '').toLowerCase();
        const docId = wsDocId.toLowerCase();
        const admName = (wsData.adminName || '').toLowerCase();

        if (cleanIdent === admEmail || cleanIdent === admId || cleanIdent === docId || cleanIdent === admName) {
            return {
                exists: true,
                name: wsData.adminName || 'Admin / Creator',
                email: wsData.adminEmail || wsData.email || '—',
                id: wsData.adminId || wsDocId,
                role: 'ADMIN',
                status: 'Active (Creator & Admin)',
                joinedAt: wsData.createdAt || null
            };
        }

        // 2. Check Members subcollection
        for (const sub of ['Members', 'members']) {
            try {
                // Direct lookup by doc ID (email or UID)
                const mDocRef = doc(db, 'Workspaces', wsDocId, sub, cleanIdent);
                const mSnap = await getDoc(mDocRef);
                if (mSnap.exists()) {
                    const d = mSnap.data();
                    return {
                        exists: true,
                        name: d.name || 'Worker',
                        email: d.email || cleanIdent,
                        id: d.appWorkerId || d.workerUid || d.workerId || mSnap.id,
                        role: d.role || 'WORKER',
                        status: d.status || (d.isRestricted ? 'Restricted' : 'Active Member'),
                        joinedAt: d.joinedAt || d.timestamp || null
                    };
                }

                // Query all members in subcollection
                const collRef = collection(db, 'Workspaces', wsDocId, sub);
                const allMembersSnap = await getDocs(collRef);
                for (const md of allMembersSnap.docs) {
                    const d = md.data();
                    const mdId = md.id.toLowerCase();
                    const mdEmail = (d.email || '').toLowerCase();
                    const mdAppId = (d.appWorkerId || '').toLowerCase();
                    const mdWorkerUid = (d.workerUid || '').toLowerCase();
                    const mdWorkerId = (d.workerId || '').toLowerCase();
                    const mdName = (d.name || '').toLowerCase();

                    if (
                        mdId === cleanIdent ||
                        mdEmail === cleanIdent ||
                        mdAppId === cleanIdent ||
                        mdWorkerUid === cleanIdent ||
                        mdWorkerId === cleanIdent ||
                        mdName === cleanIdent
                    ) {
                        return {
                            exists: true,
                            name: d.name || 'Worker',
                            email: d.email || md.id,
                            id: d.appWorkerId || d.workerUid || d.workerId || md.id,
                            role: d.role || 'WORKER',
                            status: d.status || (d.isRestricted ? 'Restricted' : 'Active Member'),
                            joinedAt: d.joinedAt || d.timestamp || null
                        };
                    }
                }
            } catch (err) {
                console.warn(`Subcollection ${sub} search:`, err);
            }
        }

        // 3. Check Connections collection
        try {
            const connSnap = await getDoc(doc(db, 'Connections', cleanIdent));
            if (connSnap.exists()) {
                const conn = connSnap.data();
                if (conn.adminUid === wsDocId || (wsData.adminEmail && conn.adminEmail === wsData.adminEmail)) {
                    return {
                        exists: true,
                        name: conn.name || 'Connected Worker',
                        email: conn.email || conn.workerEmail || cleanIdent,
                        id: cleanIdent,
                        role: conn.role || 'WORKER',
                        status: 'Active Member',
                        joinedAt: conn.timestamp || null
                    };
                }
            }
        } catch (e) {}

        // Worker was searched but not found
        return {
            exists: false,
            query: rawWorkerInput
        };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawWsInput = (inputId?.value || '').trim();
        const rawWorkerInput = (inputIdentValue?.value || '').trim();
        
        if (!rawWsInput && !rawWorkerInput) {
            if (inputId) inputId.focus();
            return;
        }

        // Hide all previous states
        if (notFoundState) notFoundState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (resultState) resultState.style.display = 'none';
        if (workerSection) workerSection.style.display = 'none';
        
        // Show loading state
        if (loadingState) loadingState.style.display = 'block';
        if (btn) {
            btn.classList.add('is-loading');
            btn.disabled = true;
            const spinner = btn.querySelector('.spinner-sm');
            if (spinner) spinner.style.display = 'inline-block';
        }

        try {
            // STEP 1: Find Workspace by Workspace ID / Doc ID / Admin ID / Email / Name
            let match = await searchWorkspaceByIdentifier(rawWsInput);
            
            // Fallback: If primary input did not match, test secondary input as workspace key
            if (!match && rawWorkerInput) {
                match = await searchWorkspaceByIdentifier(rawWorkerInput);
            }

            // Not found
            if (!match || !match.data) {
                if (loadingState) loadingState.style.display = 'none';
                if (notFoundState) notFoundState.style.display = 'block';
                return;
            }

            const wsDocId = match.id;
            const wsData = match.data;

            // STEP 2: Verify Worker if worker field is provided
            let workerVerification = null;
            if (rawWorkerInput) {
                workerVerification = await checkWorkerInWorkspace(wsDocId, wsData, rawWorkerInput);
            } else if (match.sourceWorker) {
                workerVerification = {
                    exists: true,
                    ...match.sourceWorker,
                    status: 'Active Member'
                };
            }

            if (loadingState) loadingState.style.display = 'none';

            // STEP 3: Render Workspace Information
            if (resWsName) resWsName.textContent = wsData.name || 'PriceLister Workspace';
            if (resWsId) resWsId.textContent = wsData.workspaceId || wsDocId;
            if (resAdminName) resAdminName.textContent = wsData.adminName || 'Admin';
            if (resAdminEmail) resAdminEmail.textContent = wsData.adminEmail || wsData.email || '—';
            if (resAdminId) resAdminId.textContent = wsData.adminId || wsDocId;

            // Currency symbol
            const currSymbol = wsData.currencySymbol || wsData.currency || '$';
            const currEl = document.getElementById('res-stat-currency');
            if (currEl) currEl.textContent = currSymbol;

            // Animate Stats
            animateStat(document.getElementById('res-stat-products'), wsData.adminProductCount ?? wsData.productCount ?? 0);
            animateStat(document.getElementById('res-stat-invoices'), wsData.adminInvoiceCount ?? wsData.invoiceCount ?? 0);
            animateStat(document.getElementById('res-stat-categories'), wsData.adminCategoryCount ?? wsData.categoryCount ?? 0);
            animateStat(document.getElementById('res-stat-clients'), wsData.adminClientCount ?? wsData.clientCount ?? 0);
            animateStat(document.getElementById('res-stat-workers'), wsData.workersCount ?? 0);

            // STEP 4: Render Worker Status (Verified or Not Found)
            if (workerSection) {
                if (workerVerification) {
                    workerSection.style.display = 'block';
                    if (workerVerification.exists) {
                        // Worker Exists in Workspace
                        const joinedStr = workerVerification.joinedAt 
                            ? (new Date(workerVerification.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })) 
                            : 'Active';

                        workerSection.innerHTML = `
                            <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Member Verification</h4>
                            <div class="result-details" style="background: rgba(16, 185, 129, 0.06); padding: 1.15rem; border-radius: var(--radius-md); border: 1px solid rgba(16, 185, 129, 0.3);">
                                <div style="display:flex; align-items:center; gap:0.5rem; color: #059669; font-weight:700; margin-bottom: 0.75rem; font-size: 0.95rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Worker Verified in this Workspace
                                </div>
                                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 0.45rem; font-size: 0.9rem;">
                                    <span class="label" style="font-weight: 500; color: var(--text-secondary);">Worker Name</span>
                                    <span class="value" style="color: var(--text-primary); font-weight: 600;">${workerVerification.name}</span>
                                </div>
                                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 0.45rem; font-size: 0.9rem;">
                                    <span class="label" style="font-weight: 500; color: var(--text-secondary);">Worker Email</span>
                                    <span class="value" style="color: var(--text-primary);">${workerVerification.email || '—'}</span>
                                </div>
                                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 0.45rem; font-size: 0.9rem;">
                                    <span class="label" style="font-weight: 500; color: var(--text-secondary);">AppWorker ID / UID</span>
                                    <span class="value" style="color: var(--text-primary); font-family: monospace; font-size: 0.85rem; font-weight:600;">${workerVerification.id || '—'}</span>
                                </div>
                                <div class="detail-row" style="display: flex; justify-content: space-between; margin-bottom: 0.45rem; font-size: 0.9rem;">
                                    <span class="label" style="font-weight: 500; color: var(--text-secondary);">Role</span>
                                    <span class="value badge" style="background: #059669; color: white; padding: 0.2rem 0.55rem; border-radius: 4px; font-size: 0.75rem; font-weight:600;">${workerVerification.role || 'WORKER'}</span>
                                </div>
                                <div class="detail-row" style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                                    <span class="label" style="font-weight: 500; color: var(--text-secondary);">Status</span>
                                    <span class="value" style="color: #059669; font-weight: 600;">${workerVerification.status || 'Active Member'}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Worker Not Found in Workspace
                        workerSection.innerHTML = `
                            <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Member Verification</h4>
                            <div class="result-details" style="background: rgba(239, 68, 68, 0.06); padding: 1.15rem; border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.25);">
                                <div style="display:flex; align-items:center; gap:0.5rem; color: #dc2626; font-weight:700; margin-bottom: 0.4rem; font-size: 0.95rem;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                    Worker Not Found in Workspace
                                </div>
                                <div style="font-size: 0.88rem; color: #475569; line-height: 1.5;">
                                    The workspace was located, but no active worker or member matching "<strong>${workerVerification.query}</strong>" exists in <strong>${wsData.name || 'this workspace'}</strong>.
                                </div>
                            </div>
                        `;
                    }
                } else {
                    workerSection.style.display = 'none';
                    workerSection.innerHTML = '';
                }
            }

            if (resultState) {
                resultState.style.display = 'block';
                resultState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

        } catch (error) {
            console.error('Error finding workspace:', error);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
            if (errorMessage) {
                errorMessage.textContent = 'Unable to search right now. Please check your internet connection and try again.';
            }
        } finally {
            if (btn) {
                btn.classList.remove('is-loading');
                btn.disabled = false;
                const spinner = btn.querySelector('.spinner-sm');
                if (spinner) spinner.style.display = 'none';
            }
        }
    });
}
