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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawWsInput = (inputId?.value || '').trim();
        const rawIdent = (inputIdentValue?.value || '').trim();
        
        if (!rawWsInput) {
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
            // =========================================================================
            // STEP 1: FIND WORKSPACE DOCUMENT ACROSS ALL SEARCH STRATEGIES
            // =========================================================================
            let wsDoc = null;
            let wsData = null;

            // 1a. Direct Document Lookup by ID / UID
            try {
                const directSnap = await getDoc(doc(db, 'Workspaces', rawWsInput));
                if (directSnap.exists()) {
                    wsDoc = directSnap;
                    wsData = directSnap.data();
                }
            } catch (err) {
                console.warn("Direct workspace lookup error:", err);
            }

            // 1b. Query by 'workspaceId' (both exact and uppercase)
            if (!wsDoc) {
                try {
                    const qWs = query(collection(db, 'Workspaces'), where('workspaceId', '==', rawWsInput));
                    const snapWs = await getDocs(qWs);
                    if (!snapWs.empty) {
                        wsDoc = snapWs.docs[0];
                        wsData = wsDoc.data();
                    } else if (rawWsInput !== rawWsInput.toUpperCase()) {
                        const qUpper = query(collection(db, 'Workspaces'), where('workspaceId', '==', rawWsInput.toUpperCase()));
                        const snapUpper = await getDocs(qUpper);
                        if (!snapUpper.empty) {
                            wsDoc = snapUpper.docs[0];
                            wsData = wsDoc.data();
                        }
                    }
                } catch (err) {
                    console.warn("Query by workspaceId error:", err);
                }
            }

            // 1c. Query by 'adminId'
            if (!wsDoc) {
                try {
                    const qAdmin = query(collection(db, 'Workspaces'), where('adminId', '==', rawWsInput));
                    const snapAdmin = await getDocs(qAdmin);
                    if (!snapAdmin.empty) {
                        wsDoc = snapAdmin.docs[0];
                        wsData = wsDoc.data();
                    } else if (rawWsInput !== rawWsInput.toUpperCase()) {
                        const qAdminUp = query(collection(db, 'Workspaces'), where('adminId', '==', rawWsInput.toUpperCase()));
                        const snapAdminUp = await getDocs(qAdminUp);
                        if (!snapAdminUp.empty) {
                            wsDoc = snapAdminUp.docs[0];
                            wsData = wsDoc.data();
                        }
                    }
                } catch (err) {
                    console.warn("Query by adminId error:", err);
                }
            }

            // 1d. Query by 'adminEmail' or 'email'
            if (!wsDoc && rawWsInput.includes('@')) {
                try {
                    const emailLower = rawWsInput.toLowerCase();
                    const qEmail = query(collection(db, 'Workspaces'), where('adminEmail', '==', emailLower));
                    const snapEmail = await getDocs(qEmail);
                    if (!snapEmail.empty) {
                        wsDoc = snapEmail.docs[0];
                        wsData = wsDoc.data();
                    } else {
                        const qEmail2 = query(collection(db, 'Workspaces'), where('email', '==', emailLower));
                        const snapEmail2 = await getDocs(qEmail2);
                        if (!snapEmail2.empty) {
                            wsDoc = snapEmail2.docs[0];
                            wsData = wsDoc.data();
                        }
                    }
                } catch (err) {
                    console.warn("Query by adminEmail error:", err);
                }
            }

            // 1e. Query by Workspace 'name'
            if (!wsDoc) {
                try {
                    const qName = query(collection(db, 'Workspaces'), where('name', '==', rawWsInput));
                    const snapName = await getDocs(qName);
                    if (!snapName.empty) {
                        wsDoc = snapName.docs[0];
                        wsData = wsDoc.data();
                    }
                } catch (err) {
                    console.warn("Query by name error:", err);
                }
            }

            // 1f. Fallback Scan (if direct queries yielded nothing, check top-level docs)
            if (!wsDoc) {
                try {
                    const allSnap = await getDocs(collection(db, 'Workspaces'));
                    const cleanTarget = rawWsInput.toLowerCase();
                    for (const d of allSnap.docs) {
                        const data = d.data();
                        const docId = d.id.toLowerCase();
                        const wsId = (data.workspaceId || '').toLowerCase();
                        const admId = (data.adminId || '').toLowerCase();
                        const admEmail = (data.adminEmail || data.email || '').toLowerCase();
                        const wsName = (data.name || '').toLowerCase();

                        if (docId === cleanTarget || wsId === cleanTarget || admId === cleanTarget || admEmail === cleanTarget || wsName === cleanTarget) {
                            wsDoc = d;
                            wsData = data;
                            break;
                        }
                    }
                } catch (e) {
                    console.warn("Fallback scan error:", e);
                }
            }

            // Workspace not found
            if (!wsDoc || !wsData) {
                if (loadingState) loadingState.style.display = 'none';
                if (notFoundState) notFoundState.style.display = 'block';
                return;
            }

            // =========================================================================
            // STEP 2: VERIFY WORKER / MEMBER CREDENTIALS (IF PROVIDED)
            // =========================================================================
            let memberProfile = null;
            const cleanIdent = rawIdent.toLowerCase();

            if (rawIdent) {
                // 2a. Check if identifier belongs to the Admin/Creator
                const admEmailMatch = (wsData.adminEmail || wsData.email || '').toLowerCase() === cleanIdent;
                const admIdMatch = (wsData.adminId || '').toLowerCase() === cleanIdent;
                const docIdMatch = wsDoc.id.toLowerCase() === cleanIdent;
                const admNameMatch = (wsData.adminName || '').toLowerCase() === cleanIdent;

                if (admEmailMatch || admIdMatch || docIdMatch || admNameMatch) {
                    memberProfile = {
                        name: wsData.adminName || 'Workspace Creator',
                        email: wsData.adminEmail || wsData.email || rawIdent,
                        id: wsData.adminId || wsDoc.id,
                        role: 'CREATOR_ADMIN',
                        status: 'Active (Creator)',
                        joinedAt: wsData.createdAt || null
                    };
                }

                // 2b. Check Members subcollection
                if (!memberProfile) {
                    for (const sub of ['Members', 'members']) {
                        if (memberProfile) break;
                        try {
                            // Direct doc lookup by email
                            const mDocRef = doc(db, 'Workspaces', wsDoc.id, sub, cleanIdent);
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
                            const collRef = collection(db, 'Workspaces', wsDoc.id, sub);
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
                            console.warn(`Subcollection ${sub} search error:`, err);
                        }
                    }
                }

                // 2c. Check Connections collection
                if (!memberProfile) {
                    try {
                        const connSnap = await getDoc(doc(db, 'Connections', rawIdent));
                        if (connSnap.exists()) {
                            const conn = connSnap.data();
                            if (conn.adminUid === wsDoc.id || (wsData.adminEmail && conn.adminEmail === wsData.adminEmail)) {
                                memberProfile = {
                                    name: conn.name || 'Connected Worker',
                                    email: conn.email || conn.workerEmail || rawIdent,
                                    id: rawIdent,
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

            // =========================================================================
            // STEP 3: RENDER SEARCH RESULTS
            // =========================================================================
            if (resWsName) resWsName.textContent = wsData.name || 'PriceLister Workspace';
            if (resWsId) resWsId.textContent = wsData.workspaceId || wsDoc.id;
            if (resAdminName) resAdminName.textContent = wsData.adminName || 'Admin';
            if (resAdminEmail) resAdminEmail.textContent = wsData.adminEmail || wsData.email || '—';
            if (resAdminId) resAdminId.textContent = wsData.adminId || wsDoc.id;

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
