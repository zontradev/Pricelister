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
    
    const resWorkerName = document.getElementById('result-worker-name');
    const resWorkerEmail = document.getElementById('result-worker-email');
    const resWorkerId = document.getElementById('result-worker-id');
    const resWorkerRole = document.getElementById('result-worker-role');
    const resWorkerJoined = document.getElementById('result-worker-joined');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceId = (inputId?.value || '').trim();
        const identValue = (inputIdentValue?.value || '').trim();
        
        if (!workspaceId || !identValue) return;

        // Hide all states
        if (notFoundState) notFoundState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (resultState) resultState.style.display = 'none';
        
        // Show loading
        if (loadingState) loadingState.style.display = 'block';
        if (btn) {
            btn.classList.add('is-loading');
            btn.disabled = true;
            const spinner = btn.querySelector('.spinner-sm');
            if (spinner) spinner.style.display = 'inline-block';
        }

        try {
            // STEP 1: Find the Workspace Document
            let wsDoc = null;
            let wsData = null;

            // 1a. Try direct doc fetch by Workspace ID (which can be the admin UID)
            try {
                const directRef = doc(db, 'Workspaces', workspaceId);
                const directSnap = await getDoc(directRef);
                if (directSnap.exists()) {
                    wsDoc = directSnap;
                    wsData = directSnap.data();
                }
            } catch (err) {
                console.warn("Direct workspace getDoc failed:", err);
            }

            // 1b. Query by 'workspaceId' field
            if (!wsDoc) {
                try {
                    const qWsId = query(collection(db, 'Workspaces'), where('workspaceId', '==', workspaceId));
                    const qWsSnap = await getDocs(qWsId);
                    if (!qWsSnap.empty) {
                        wsDoc = qWsSnap.docs[0];
                        wsData = wsDoc.data();
                    }
                } catch (err) {
                    console.warn("Query by workspaceId failed:", err);
                }
            }

            // 1c. Query by 'adminId' field
            if (!wsDoc) {
                try {
                    const qAdminId = query(collection(db, 'Workspaces'), where('adminId', '==', workspaceId));
                    const qAdminSnap = await getDocs(qAdminId);
                    if (!qAdminSnap.empty) {
                        wsDoc = qAdminSnap.docs[0];
                        wsData = wsDoc.data();
                    }
                } catch (err) {
                    console.warn("Query by adminId failed:", err);
                }
            }

            // 1d. Case-insensitive / uppercase fallback for workspaceId
            if (!wsDoc && workspaceId !== workspaceId.toUpperCase()) {
                try {
                    const qUpper = query(collection(db, 'Workspaces'), where('workspaceId', '==', workspaceId.toUpperCase()));
                    const qUpperSnap = await getDocs(qUpper);
                    if (!qUpperSnap.empty) {
                        wsDoc = qUpperSnap.docs[0];
                        wsData = wsDoc.data();
                    }
                } catch (err) {}
            }

            // Workspace not found in database
            if (!wsDoc) {
                if (loadingState) loadingState.style.display = 'none';
                if (notFoundState) notFoundState.style.display = 'block';
                return;
            }

            // STEP 2: Verify Worker / Member / Creator within this workspace
            const cleanIdent = identValue.toLowerCase();
            let memberProfile = null;

            // 2a. Check if the provided identifier belongs to the Workspace Creator / Admin
            const adminEmailMatch = (wsData.adminEmail || '').toLowerCase() === cleanIdent;
            const adminIdMatch = (wsData.adminId || '').toLowerCase() === cleanIdent;
            const docIdMatch = wsDoc.id.toLowerCase() === cleanIdent;
            const creatorIdMatch = (wsData.creatorId || '').toLowerCase() === cleanIdent;

            if (adminEmailMatch || adminIdMatch || docIdMatch || creatorIdMatch) {
                memberProfile = {
                    name: wsData.adminName || 'Workspace Creator',
                    email: wsData.adminEmail || identValue,
                    id: wsData.adminId || wsDoc.id,
                    role: 'Creator Admin',
                    status: 'Founder / Active',
                    joinedAt: wsData.createdAt || null
                };
            }

            // 2b. If not the Creator Admin, check the Members subcollection (check both 'Members' and 'members')
            if (!memberProfile) {
                // If it's an email, try direct document lookup (Android uses lowercase email as doc id)
                if (identValue.includes('@')) {
                    const subOptions = ['Members', 'members'];
                    for (const sub of subOptions) {
                        if (memberProfile) break;
                        try {
                            const mDocRef = doc(db, 'Workspaces', wsDoc.id, sub, cleanIdent);
                            const mSnap = await getDoc(mDocRef);
                            if (mSnap.exists()) {
                                const d = mSnap.data();
                                memberProfile = {
                                    name: d.name || 'Worker',
                                    email: d.email || cleanIdent,
                                    id: d.appWorkerId || d.workerUid || d.workerId || mSnap.id,
                                    role: d.role || 'Worker',
                                    status: d.status || (d.isRestricted ? 'Restricted' : 'Joined'),
                                    joinedAt: d.joinedAt || d.timestamp || null
                                };
                            }
                        } catch (e) {}
                    }
                }
            }

            // 2c. Query all members in 'Members' and 'members' subcollections for matching fields
            if (!memberProfile) {
                const subOptions = ['Members', 'members'];
                for (const sub of subOptions) {
                    if (memberProfile) break;
                    try {
                        const membersRef = collection(db, 'Workspaces', wsDoc.id, sub);
                        const mSnap = await getDocs(membersRef);
                        if (!mSnap.empty) {
                            for (const d of mSnap.docs) {
                                const data = d.data();
                                const docId = d.id.toLowerCase();
                                const dEmail = (data.email || '').toLowerCase();
                                const dAppWorkerId = (data.appWorkerId || '').toLowerCase();
                                const dWorkerUid = (data.workerUid || '').toLowerCase();
                                const dWorkerId = (data.workerId || '').toLowerCase();
                                const dCreatorId = (data.creatorId || '').toLowerCase();

                                if (
                                    docId === cleanIdent ||
                                    dEmail === cleanIdent ||
                                    dAppWorkerId === cleanIdent ||
                                    dWorkerUid === cleanIdent ||
                                    dWorkerId === cleanIdent ||
                                    dCreatorId === cleanIdent
                                ) {
                                    memberProfile = {
                                        name: data.name || 'Worker',
                                        email: data.email || d.id,
                                        id: data.appWorkerId || data.workerUid || data.workerId || d.id,
                                        role: data.role || 'Worker',
                                        status: data.status || (data.isRestricted ? 'Restricted' : 'Joined'),
                                        joinedAt: data.joinedAt || data.timestamp || null
                                    };
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn(`Error reading subcollection ${sub}:`, e);
                    }
                }
            }

            // 2d. Check Connections collection
            if (!memberProfile) {
                try {
                    const connRef = doc(db, 'Connections', identValue);
                    const connSnap = await getDoc(connRef);
                    if (connSnap.exists()) {
                        const conn = connSnap.data();
                        if (conn.adminUid === wsDoc.id || (wsData.adminEmail && conn.adminEmail === wsData.adminEmail)) {
                            memberProfile = {
                                name: conn.name || 'Connected Worker',
                                email: conn.email || conn.workerEmail || identValue,
                                id: identValue,
                                role: conn.role || 'Worker',
                                status: 'Joined',
                                joinedAt: conn.timestamp || null
                            };
                        }
                    }
                } catch (e) {}
            }

            if (loadingState) loadingState.style.display = 'none';

            // STEP 3: Privacy & Security Check
            if (!memberProfile) {
                if (errorState) errorState.style.display = 'block';
                if (errorMessage) {
                    errorMessage.textContent = 'Workspace found, but no matching worker credentials were found. Please verify both your Workspace ID and Worker details.';
                }
                return;
            }

            // STEP 4: Populate Data Safely
            // Workspace / Admin details
            if (resWsName) resWsName.textContent = wsData.name || 'Workspace';
            if (resWsId) resWsId.textContent = wsData.workspaceId || wsDoc.id;
            if (resAdminName) resAdminName.textContent = wsData.adminName || 'Admin';
            if (resAdminEmail) resAdminEmail.textContent = wsData.adminEmail || 'Unknown';
            if (resAdminId) resAdminId.textContent = wsData.adminId || wsDoc.id;

            // Workspace Stats Counters
            const statProducts = document.getElementById('res-stat-products');
            if (statProducts) statProducts.textContent = wsData.adminProductCount ?? 0;
            const statInvoices = document.getElementById('res-stat-invoices');
            if (statInvoices) statInvoices.textContent = wsData.adminInvoiceCount ?? 0;
            const statCategories = document.getElementById('res-stat-categories');
            if (statCategories) statCategories.textContent = wsData.adminCategoryCount ?? 0;
            const statClients = document.getElementById('res-stat-clients');
            if (statClients) statClients.textContent = wsData.adminClientCount ?? 0;

            // Member details
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

            if (resultState) {
                resultState.style.display = 'block';
                resultState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

        } catch (error) {
            console.error('Error finding workspace:', error);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
            if (errorMessage) {
                errorMessage.textContent = 'Unable to securely verify workspace. Please check your credentials and try again.';
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
