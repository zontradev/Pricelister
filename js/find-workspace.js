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
    const resWorkerName = document.getElementById('result-worker-name');
    const resWorkerEmail = document.getElementById('result-worker-email');
    const resWorkerId = document.getElementById('result-worker-id');
    const resWorkerRole = document.getElementById('result-worker-role');
    const resWorkerJoined = document.getElementById('result-worker-joined');

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
     * Comprehensive lookup helper:
     * Resolves workspace document & data given an identifier string (UID, workspaceId, AdminId, Email, Name)
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
                    createdAt: Date.now()
                },
                sourceWorker: null
            };
        }

        const collectionsToCheck = ['Workspaces', 'workspaces'];

        // 1. Direct Document Lookup by ID (UID or Doc ID)
        for (const coll of collectionsToCheck) {
            try {
                const snap = await getDoc(doc(db, coll, key));
                if (snap.exists()) {
                    return { id: snap.id, data: snap.data(), sourceWorker: null };
                }
            } catch (e) {}
        }

        // 2. Check Connections collection (Worker UID -> adminUid -> Workspace)
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

        // 3. Check Connections query by email if key contains '@'
        if (key.includes('@')) {
            const emailLower = key.toLowerCase();
            for (const coll of ['Connections', 'connections']) {
                try {
                    const qConn = query(collection(db, coll), where('email', '==', emailLower));
                    const qSnap = await getDocs(qConn);
                    if (!qSnap.empty) {
                        const cData = qSnap.docs[0].data();
                        const targetUid = cData.adminUid || cData.workspaceDocUid;
                        if (targetUid) {
                            for (const wsColl of collectionsToCheck) {
                                try {
                                    const wsSnap = await getDoc(doc(db, wsColl, targetUid));
                                    if (wsSnap.exists()) {
                                        return {
                                            id: wsSnap.id,
                                            data: wsSnap.data(),
                                            sourceWorker: {
                                                name: cData.name || 'Connected Member',
                                                email: emailLower,
                                                id: qSnap.docs[0].id,
                                                role: cData.role || 'WORKER',
                                                joinedAt: cData.timestamp || null
                                            }
                                        };
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        // 4. Query Workspaces by workspaceId, adminId, adminEmail, email, name
        for (const coll of collectionsToCheck) {
            try {
                // workspaceId exact
                const qWs = query(collection(db, coll), where('workspaceId', '==', key));
                const sWs = await getDocs(qWs);
                if (!sWs.empty) return { id: sWs.docs[0].id, data: sWs.docs[0].data(), sourceWorker: null };

                // workspaceId uppercase
                if (key !== key.toUpperCase()) {
                    const qUp = query(collection(db, coll), where('workspaceId', '==', key.toUpperCase()));
                    const sUp = await getDocs(qUp);
                    if (!sUp.empty) return { id: sUp.docs[0].id, data: sUp.docs[0].data(), sourceWorker: null };
                }

                // adminId exact
                const qAdm = query(collection(db, coll), where('adminId', '==', key));
                const sAdm = await getDocs(qAdm);
                if (!sAdm.empty) return { id: sAdm.docs[0].id, data: sAdm.docs[0].data(), sourceWorker: null };

                // adminId uppercase
                if (key !== key.toUpperCase()) {
                    const qAdmUp = query(collection(db, coll), where('adminId', '==', key.toUpperCase()));
                    const sAdmUp = await getDocs(qAdmUp);
                    if (!sAdmUp.empty) return { id: sAdmUp.docs[0].id, data: sAdmUp.docs[0].data(), sourceWorker: null };
                }

                // adminEmail / email if contains @
                if (key.includes('@')) {
                    const emailLower = key.toLowerCase();
                    const qEm1 = query(collection(db, coll), where('adminEmail', '==', emailLower));
                    const sEm1 = await getDocs(qEm1);
                    if (!sEm1.empty) return { id: sEm1.docs[0].id, data: sEm1.docs[0].data(), sourceWorker: null };

                    const qEm2 = query(collection(db, coll), where('email', '==', emailLower));
                    const sEm2 = await getDocs(qEm2);
                    if (!sEm2.empty) return { id: sEm2.docs[0].id, data: sEm2.docs[0].data(), sourceWorker: null };
                }

                // workspace name
                const qNm = query(collection(db, coll), where('name', '==', key));
                const sNm = await getDocs(qNm);
                if (!sNm.empty) return { id: sNm.docs[0].id, data: sNm.docs[0].data(), sourceWorker: null };
            } catch (e) {
                console.warn(`Query search on ${coll} warning:`, e);
            }
        }

        // 5. Check userCollection/{key}
        try {
            const userSnap = await getDoc(doc(db, 'userCollection', key));
            if (userSnap.exists()) {
                const uData = userSnap.data();
                const possibleUid = uData.adminUid || uData.workspaceId || userSnap.id;
                for (const wsColl of collectionsToCheck) {
                    try {
                        const wsSnap = await getDoc(doc(db, wsColl, possibleUid));
                        if (wsSnap.exists()) {
                            return { id: wsSnap.id, data: wsSnap.data(), sourceWorker: null };
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // 6. Deep Scan across Workspaces collection (case-insensitive fallback)
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
                console.warn(`Deep scan error on ${coll}:`, e);
            }
        }

        return null;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawWsInput = (inputId?.value || '').trim();
        const rawIdent = (inputIdentValue?.value || '').trim();
        
        if (!rawWsInput && !rawIdent) {
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
            // STEP 1: Search using primary input (or fallback to secondary input if swapped)
            let match = await searchWorkspaceByIdentifier(rawWsInput);
            
            // If primary input did not match, try secondary input
            if (!match && rawIdent) {
                match = await searchWorkspaceByIdentifier(rawIdent);
            }

            // Not found
            if (!match || !match.data) {
                if (loadingState) loadingState.style.display = 'none';
                if (notFoundState) notFoundState.style.display = 'block';
                return;
            }

            const wsDocId = match.id;
            const wsData = match.data;
            let memberProfile = match.sourceWorker || null;

            // STEP 2: Determine & verify member profile
            const identToVerify = rawIdent || (!match.sourceWorker && rawWsInput ? rawWsInput : '');
            const cleanIdent = identToVerify.trim().toLowerCase();

            if (cleanIdent && !memberProfile) {
                // Check if matches admin/creator
                const admEmailMatch = (wsData.adminEmail || wsData.email || '').toLowerCase() === cleanIdent;
                const admIdMatch = (wsData.adminId || '').toLowerCase() === cleanIdent;
                const docIdMatch = wsDocId.toLowerCase() === cleanIdent;
                const admNameMatch = (wsData.adminName || '').toLowerCase() === cleanIdent;

                if (admEmailMatch || admIdMatch || docIdMatch || admNameMatch) {
                    memberProfile = {
                        name: wsData.adminName || 'Workspace Creator',
                        email: wsData.adminEmail || wsData.email || identToVerify,
                        id: wsData.adminId || wsDocId,
                        role: 'CREATOR_ADMIN',
                        status: 'Active (Creator)',
                        joinedAt: wsData.createdAt || null
                    };
                }

                // Check Members subcollection
                if (!memberProfile) {
                    for (const sub of ['Members', 'members']) {
                        if (memberProfile) break;
                        try {
                            // Direct doc lookup by email or UID
                            const mDocRef = doc(db, 'Workspaces', wsDocId, sub, cleanIdent);
                            const mSnap = await getDoc(mDocRef);
                            if (mSnap.exists()) {
                                const d = mSnap.data();
                                memberProfile = {
                                    name: d.name || 'Worker',
                                    email: d.email || cleanIdent,
                                    id: d.appWorkerId || d.workerUid || d.workerId || mSnap.id,
                                    role: d.role || 'WORKER',
                                    status: d.status || (d.isRestricted ? 'Restricted' : 'Joined'),
                                    joinedAt: d.joinedAt || d.timestamp || null
                                };
                                break;
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
                                    memberProfile = {
                                        name: d.name || 'Worker',
                                        email: d.email || md.id,
                                        id: d.appWorkerId || d.workerUid || d.workerId || md.id,
                                        role: d.role || 'WORKER',
                                        status: d.status || (d.isRestricted ? 'Restricted' : 'Joined'),
                                        joinedAt: d.joinedAt || d.timestamp || null
                                    };
                                    break;
                                }
                            }
                        } catch (err) {
                            console.warn(`Subcollection ${sub} search warning:`, err);
                        }
                    }
                }

                // Check Connections collection
                if (!memberProfile) {
                    try {
                        const connSnap = await getDoc(doc(db, 'Connections', identToVerify));
                        if (connSnap.exists()) {
                            const conn = connSnap.data();
                            if (conn.adminUid === wsDocId || (wsData.adminEmail && conn.adminEmail === wsData.adminEmail)) {
                                memberProfile = {
                                    name: conn.name || 'Connected Worker',
                                    email: conn.email || conn.workerEmail || identToVerify,
                                    id: identToVerify,
                                    role: conn.role || 'WORKER',
                                    status: 'Joined',
                                    joinedAt: conn.timestamp || null
                                };
                            }
                        }
                    } catch (e) {}
                }
            }

            if (loadingState) loadingState.style.display = 'none';

            // STEP 3: Render Search Results
            if (resWsName) resWsName.textContent = wsData.name || 'PriceLister Workspace';
            if (resWsId) resWsId.textContent = wsData.workspaceId || wsDocId;
            if (resAdminName) resAdminName.textContent = wsData.adminName || 'Admin';
            if (resAdminEmail) resAdminEmail.textContent = wsData.adminEmail || wsData.email || '—';
            if (resAdminId) resAdminId.textContent = wsData.adminId || wsDocId;

            // Animate Stats
            animateStat(document.getElementById('res-stat-products'), wsData.adminProductCount ?? 0);
            animateStat(document.getElementById('res-stat-invoices'), wsData.adminInvoiceCount ?? 0);
            animateStat(document.getElementById('res-stat-categories'), wsData.adminCategoryCount ?? 0);
            animateStat(document.getElementById('res-stat-clients'), wsData.adminClientCount ?? 0);

            // Member Profile Card
            if (workerSection) {
                if (memberProfile) {
                    workerSection.style.display = 'block';
                    if (resWorkerName) resWorkerName.textContent = memberProfile.name || 'Member';
                    if (resWorkerEmail) resWorkerEmail.textContent = memberProfile.email || '—';
                    if (resWorkerId) resWorkerId.textContent = memberProfile.id || '—';
                    if (resWorkerRole) {
                        formatRoleBadge(memberProfile.role, resWorkerRole);
                    }
                    if (resWorkerJoined) {
                        if (memberProfile.joinedAt) {
                            const date = new Date(memberProfile.joinedAt);
                            resWorkerJoined.textContent = isNaN(date.getTime()) 
                                ? String(memberProfile.joinedAt) 
                                : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        } else {
                            resWorkerJoined.textContent = 'Active Member';
                        }
                    }
                } else if (rawIdent) {
                    workerSection.style.display = 'block';
                    workerSection.innerHTML = `
                        <div style="background: rgba(245, 158, 11, 0.08); padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.25); color: #92400e; font-size: 0.88rem;">
                            <strong>Note:</strong> Workspace was located, but no active member profile matched "<strong>${rawIdent}</strong>".
                        </div>
                    `;
                } else {
                    workerSection.style.display = 'none';
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
