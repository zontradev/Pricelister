import { firebaseApp } from '../firebase/firebase-config.js';
import { authService } from '../firebase/auth.js';
import { showAlert } from './alert-handler.js';
import { formatRoleBadge } from './auth-handler.js';
import { firestoreService } from '../firebase/firestore.js';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export function initFindWorkspace() {
    const form = document.getElementById('find-workspace-form');
    const inputId = document.getElementById('workspace-id-input');
    
    const btn = document.getElementById('find-workspace-btn');
    const loadingState = document.getElementById('find-loading');
    const notFoundState = document.getElementById('find-not-found');
    const errorState = document.getElementById('find-error');
    const errorMessage = document.getElementById('find-error-message');
    const resultState = document.getElementById('find-result');

    // Result fields
    const resWsLogo = document.getElementById('result-ws-logo');
    const resWsName = document.getElementById('result-ws-name');
    const resWsId = document.getElementById('result-ws-id');
    const resWsDesc = document.getElementById('result-ws-desc');
    const resWsCountry = document.getElementById('result-ws-country');
    const resAdminEmail = document.getElementById('result-admin-email');
    const resWsMembersCount = document.getElementById('result-ws-members-count');

    // Action 1: Request Join elements
    const btnRequestJoin = document.getElementById('btn-request-join');
    const btnRequestJoinText = document.getElementById('btn-request-join-text');
    const spinnerRequestJoin = document.getElementById('spinner-request-join');
    const joinRequestStatus = document.getElementById('join-request-status');

    // Action 2: Member Lookup elements
    const memberLookupInput = document.getElementById('member-lookup-input');
    const btnDoMemberLookup = document.getElementById('btn-do-member-lookup');
    const memberLookupResult = document.getElementById('member-lookup-result');

    if (!form) return;

    let activeFoundWorkspace = null;

    /**
     * Comprehensive Workspace Lookup by Workspace ID
     */
    async function searchWorkspaceById(rawKey) {
        if (!rawKey) return null;
        const key = rawKey.trim().replace(/^['"]|['"]$/g, '');
        if (!key) return null;

        // Mock / Sandbox Workspace Bypass
        if (
            key === 'dev-mock-uid' || 
            key === 'ws_dev_mock' || 
            key.toUpperCase() === 'DEMO-SANDBOX-01' || 
            key.toLowerCase() === 'demo'
        ) {
            return {
                id: 'ws_dev_mock',
                data: {
                    workspaceId: 'DEMO-SANDBOX-01',
                    name: 'PriceLister Demo Enterprise',
                    description: 'Enterprise catalog, real-time wholesale pricing matrix, and automated client billing.',
                    originCountry: 'United States',
                    country: 'United States',
                    adminName: 'Demo Admin (Testing)',
                    adminEmail: 'developer@local.test',
                    adminId: 'DEV_MOCK_ADMIN_ID',
                    workersCount: 2,
                    logoUrl: 'pricelister_org.png',
                    createdAt: Date.now() - (120 * 24 * 60 * 60 * 1000)
                }
            };
        }

        const collectionsToCheck = ['Workspaces', 'workspaces'];

        // 1. Direct Document Lookup by ID
        for (const coll of collectionsToCheck) {
            try {
                const snap = await getDoc(doc(db, coll, key));
                if (snap.exists()) {
                    return { id: snap.id, data: snap.data() };
                }
            } catch (e) {}
        }

        // 2. Query Workspaces by workspaceId field (Exact, Upper, Lower)
        for (const coll of collectionsToCheck) {
            try {
                const qWs = query(collection(db, coll), where('workspaceId', '==', key));
                const sWs = await getDocs(qWs);
                if (!sWs.empty) return { id: sWs.docs[0].id, data: sWs.docs[0].data() };

                if (key !== key.toUpperCase()) {
                    const qUp = query(collection(db, coll), where('workspaceId', '==', key.toUpperCase()));
                    const sUp = await getDocs(qUp);
                    if (!sUp.empty) return { id: sUp.docs[0].id, data: sUp.docs[0].data() };
                }

                if (key !== key.toLowerCase()) {
                    const qLow = query(collection(db, coll), where('workspaceId', '==', key.toLowerCase()));
                    const sLow = await getDocs(qLow);
                    if (!sLow.empty) return { id: sLow.docs[0].id, data: sLow.docs[0].data() };
                }
            } catch (e) {
                console.warn(`Query search workspaceId on ${coll}:`, e);
            }
        }

        // 3. Fallback: Deep Scan across Workspaces collection
        for (const coll of collectionsToCheck) {
            try {
                const allSnap = await getDocs(collection(db, coll));
                const targetClean = key.toLowerCase();

                for (const d of allSnap.docs) {
                    const data = d.data();
                    const docId = d.id.toLowerCase();
                    const wsId = (data.workspaceId || '').toLowerCase();

                    if (docId === targetClean || wsId === targetClean) {
                        return { id: d.id, data: data };
                    }
                }
            } catch (e) {
                console.warn(`Deep scan on ${coll}:`, e);
            }
        }

        return null;
    }

    /**
     * Check if a member / worker exists in the founded workspace
     */
    async function verifyWorkerInWorkspace(wsDocId, wsData, rawWorkerInput) {
        if (!rawWorkerInput) return null;
        const cleanIdent = rawWorkerInput.trim().toLowerCase();
        if (!cleanIdent) return null;

        // 1. Check Admin / Creator match
        const admEmail = (wsData.adminEmail || wsData.email || '').toLowerCase();
        const admId = (wsData.adminId || '').toLowerCase();
        const docId = wsDocId.toLowerCase();
        const admName = (wsData.adminName || '').toLowerCase();

        if (cleanIdent === admEmail || cleanIdent === admId || cleanIdent === docId || cleanIdent === admName) {
            return {
                exists: true,
                name: wsData.adminName || 'Admin / Creator',
                email: wsData.adminEmail || wsData.email || '—',
                photoURL: wsData.photoURL || wsData.logoUrl || 'pricelister_org.png',
                role: 'ADMIN',
                status: 'Creator & Administrator',
                joinedAt: wsData.createdAt || Date.now() - (60 * 24 * 60 * 60 * 1000)
            };
        }

        // 2. Demo Sandbox Members lookup
        if (wsDocId === 'ws_dev_mock' || (wsData.workspaceId && wsData.workspaceId.toUpperCase() === 'DEMO-SANDBOX-01')) {
            const demoMembers = [
                { id: 'SARAH01', name: 'Sarah Jenkins', email: 'sarah.coadmin@pricelister.app', role: 'CO_ADMIN', joinedAt: Date.now() - (30 * 24 * 60 * 60 * 1000) },
                { id: 'ALEX02', name: 'Alex Rivera', email: 'alex.worker@pricelister.app', role: 'WORKER', joinedAt: Date.now() - (15 * 24 * 60 * 60 * 1000) }
            ];
            const match = demoMembers.find(m => 
                m.id.toLowerCase() === cleanIdent || 
                m.email.toLowerCase() === cleanIdent || 
                m.name.toLowerCase() === cleanIdent
            );
            if (match) {
                return {
                    exists: true,
                    ...match,
                    status: 'Active Member'
                };
            }
        }

        // 3. Check Members Subcollection
        for (const sub of ['Members', 'members']) {
            try {
                // Direct lookup by doc ID (usually email)
                const mDocRef = doc(db, 'Workspaces', wsDocId, sub, cleanIdent);
                const mSnap = await getDoc(mDocRef);
                if (mSnap.exists()) {
                    const d = mSnap.data();
                    return {
                        exists: true,
                        name: d.name || d.displayName || 'Worker',
                        email: d.email || cleanIdent,
                        photoURL: d.photoURL || '',
                        id: d.appWorkerId || d.workerUid || d.workerId || mSnap.id,
                        role: d.role || 'WORKER',
                        status: 'Active Member',
                        joinedAt: d.joinedAt || d.timestamp || null
                    };
                }

                // Query members in subcollection
                const collRef = collection(db, 'Workspaces', wsDocId, sub);
                const allMembersSnap = await getDocs(collRef);
                for (const md of allMembersSnap.docs) {
                    const d = md.data();
                    const mdId = md.id.toLowerCase();
                    const mdEmail = (d.email || '').toLowerCase();
                    const mdAppId = (d.appWorkerId || '').toLowerCase();
                    const mdWorkerUid = (d.workerUid || '').toLowerCase();
                    const mdName = (d.name || d.displayName || '').toLowerCase();

                    if (
                        mdId === cleanIdent ||
                        mdEmail === cleanIdent ||
                        mdAppId === cleanIdent ||
                        mdWorkerUid === cleanIdent ||
                        mdName === cleanIdent
                    ) {
                        return {
                            exists: true,
                            name: d.name || d.displayName || 'Worker',
                            email: d.email || md.id,
                            photoURL: d.photoURL || '',
                            id: d.appWorkerId || d.workerUid || md.id,
                            role: d.role || 'WORKER',
                            status: 'Active Member',
                            joinedAt: d.joinedAt || d.timestamp || null
                        };
                    }
                }
            } catch (err) {
                console.warn(`Subcollection ${sub} lookup:`, err);
            }
        }

        // 4. Check Connections collection
        try {
            const connSnap = await getDoc(doc(db, 'Connections', cleanIdent));
            if (connSnap.exists()) {
                const conn = connSnap.data();
                if (conn.adminUid === wsDocId || (wsData.adminEmail && conn.adminEmail === wsData.adminEmail)) {
                    return {
                        exists: true,
                        name: conn.name || conn.workerName || 'Connected Member',
                        email: conn.email || conn.workerEmail || cleanIdent,
                        photoURL: conn.photoURL || '',
                        id: cleanIdent,
                        role: conn.role || 'WORKER',
                        status: 'Active Member',
                        joinedAt: conn.timestamp || null
                    };
                }
            }
        } catch (e) {}

        return { exists: false, query: rawWorkerInput };
    }

    /**
     * Submit Handler: Search Workspace by Workspace ID
     */
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Login Requirement: User must be logged in to search and find workspaces
        const currentUser = authService?.getCurrentUser() || auth?.currentUser;
        if (!currentUser || !currentUser.email) {
            showAlert.error("Please log in to search and inspect workspaces.");
            if (typeof window.openLoginModal === 'function') {
                window.openLoginModal();
            }
            return;
        }
        
        const rawWsInput = (inputId?.value || '').trim();
        if (!rawWsInput) {
            if (inputId) inputId.focus();
            return;
        }

        // Hide previous results & error states
        if (notFoundState) notFoundState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (resultState) resultState.style.display = 'none';
        if (joinRequestStatus) {
            joinRequestStatus.style.display = 'none';
            joinRequestStatus.innerHTML = '';
        }
        if (memberLookupResult) {
            memberLookupResult.style.display = 'none';
            memberLookupResult.innerHTML = '';
        }

        // Reset Request Join button state
        if (btnRequestJoin) {
            btnRequestJoin.disabled = false;
            btnRequestJoin.style.opacity = '1';
            btnRequestJoin.style.cursor = 'pointer';
            if (btnRequestJoinText) btnRequestJoinText.textContent = 'Request Join by Email';
            if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'none';
        }

        // Show loading state
        if (loadingState) loadingState.style.display = 'block';
        if (btn) {
            btn.classList.add('is-loading');
            btn.disabled = true;
            const spinner = btn.querySelector('.spinner-sm');
            if (spinner) spinner.style.display = 'inline-block';
        }

        try {
            const match = await searchWorkspaceById(rawWsInput);

            if (!match || !match.data) {
                if (loadingState) loadingState.style.display = 'none';
                if (notFoundState) notFoundState.style.display = 'block';
                return;
            }

            activeFoundWorkspace = match;
            const wsData = match.data;

            if (loadingState) loadingState.style.display = 'none';

            // Populate Workspace Details
            if (resWsName) resWsName.textContent = wsData.name || 'PriceLister Workspace';
            if (resWsId) resWsId.textContent = wsData.workspaceId || match.id;
            if (resWsDesc) {
                resWsDesc.textContent = wsData.description || 'Enterprise catalog, pricing and customer invoice cloud workspace.';
            }
            if (resWsCountry) {
                resWsCountry.textContent = wsData.originCountry || wsData.country || 'Global';
            }
            if (resAdminEmail) {
                resAdminEmail.textContent = wsData.adminEmail || wsData.email || '—';
            }
            if (resWsMembersCount) {
                const count = wsData.workersCount || wsData.memberCount || 1;
                resWsMembersCount.textContent = `${count} Member${count === 1 ? '' : 's'}`;
            }
            if (resWsLogo) {
                resWsLogo.src = wsData.logoUrl || wsData.logo || 'pricelister_org.png';
            }

            // Show Result
            if (resultState) {
                resultState.style.display = 'block';
                resultState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

        } catch (error) {
            console.error('Error finding workspace:', error);
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) errorState.style.display = 'block';
            if (errorMessage) {
                errorMessage.textContent = 'Unable to search right now. Please check your network and try again.';
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

    /**
     * Action 1: Request Join by Email
     */
    if (btnRequestJoin) {
        btnRequestJoin.addEventListener('click', async () => {
            if (!activeFoundWorkspace) return;

            btnRequestJoin.disabled = true;
            if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'inline-block';
            if (btnRequestJoinText) btnRequestJoinText.textContent = 'Connecting Account...';
            if (joinRequestStatus) {
                joinRequestStatus.style.display = 'none';
                joinRequestStatus.innerHTML = '';
            }

            try {
                // Get or prompt authenticated user
                let user = authService?.getCurrentUser() || auth.currentUser;
                if (!user || !user.email) {
                    // Open Google login to choose an account
                    try {
                        user = await authService.loginWithGoogle(true);
                    } catch (authErr) {
                        console.warn("Google sign-in canceled or failed:", authErr);
                        btnRequestJoin.disabled = false;
                        if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'none';
                        if (btnRequestJoinText) btnRequestJoinText.textContent = 'Request Join by Email';
                        return;
                    }
                }

                if (!user || !user.email) {
                    throw new Error("A valid Google account is required to send a join request.");
                }

                // Verify user workspace connection: User MUST NOT be connected to any workspace
                if (btnRequestJoinText) btnRequestJoinText.textContent = 'Verifying Eligibility...';
                const connCheck = await firestoreService.checkUserWorkspaceConnection(user);

                if (connCheck && connCheck.isConnected) {
                    // Rejection: User is already connected to another workspace
                    btnRequestJoin.disabled = false;
                    if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'none';
                    if (btnRequestJoinText) btnRequestJoinText.textContent = 'Request Join by Email';

                    if (joinRequestStatus) {
                        joinRequestStatus.style.display = 'block';
                        joinRequestStatus.innerHTML = `
                            <div style="background: rgba(239, 68, 68, 0.06); border: 1.5px solid rgba(239, 68, 68, 0.25); border-radius: 10px; padding: 0.85rem 1rem; color: #18181b; font-size: 0.88rem; line-height: 1.45;">
                                <div style="display:flex; align-items:center; gap:0.4rem; color:#dc2626; font-weight:700; margin-bottom:0.25rem;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Already Connected to a Workspace
                                </div>
                                Account <strong>${user.email}</strong> is currently linked to workspace <code>${connCheck.workspaceId || 'Active'}</code>. To join another workspace, you must first disconnect your existing workspace.
                            </div>
                        `;
                    }
                    return;
                }

                // User is clean and not connected to any workspace: submit Join Request!
                if (btnRequestJoinText) btnRequestJoinText.textContent = 'Sending Request...';
                await firestoreService.createJoinRequest(activeFoundWorkspace.id, user);

                // Update UI state to "Request Sent"
                btnRequestJoin.disabled = true;
                btnRequestJoin.style.background = '#f4f4f5';
                btnRequestJoin.style.borderColor = '#a1a1aa';
                btnRequestJoin.style.color = '#18181b';
                btnRequestJoin.style.cursor = 'default';
                if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'none';
                if (btnRequestJoinText) btnRequestJoinText.textContent = '✓ Request Sent';

                if (joinRequestStatus) {
                    joinRequestStatus.style.display = 'block';
                    joinRequestStatus.innerHTML = `
                        <div style="background: rgba(24, 24, 27, 0.03); border: 1.5px solid #d4d4d8; border-radius: 10px; padding: 0.9rem 1rem; color: #18181b; font-size: 0.88rem; line-height: 1.5;">
                            <div style="display:flex; align-items:center; gap:0.4rem; font-weight:800; margin-bottom:0.3rem;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Request Sent to Workspace Admins
                            </div>
                            Your request to join <strong>${activeFoundWorkspace.data.name || 'this workspace'}</strong> as a worker has been delivered to <strong>${activeFoundWorkspace.data.adminEmail || 'the workspace admins'}</strong>. You will be able to access the workspace upon admin approval.
                        </div>
                    `;
                }

            } catch (err) {
                console.error("Error creating join request:", err);
                btnRequestJoin.disabled = false;
                if (spinnerRequestJoin) spinnerRequestJoin.style.display = 'none';
                if (btnRequestJoinText) btnRequestJoinText.textContent = 'Request Join by Email';
                if (joinRequestStatus) {
                    joinRequestStatus.style.display = 'block';
                    joinRequestStatus.innerHTML = `
                        <div style="background: rgba(239, 68, 68, 0.05); border: 1.5px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 0.75rem 0.9rem; color: #dc2626; font-size: 0.85rem;">
                            ${err.message || 'Failed to submit join request. Please try again.'}
                        </div>
                    `;
                }
            }
        });
    }

    /**
     * Action 2: Member Lookup inside Founded Workspace
     */
    async function handleMemberLookup() {
        if (!activeFoundWorkspace) return;
        const queryVal = (memberLookupInput?.value || '').trim();
        if (!queryVal) {
            if (memberLookupInput) memberLookupInput.focus();
            return;
        }

        if (btnDoMemberLookup) {
            btnDoMemberLookup.disabled = true;
            btnDoMemberLookup.textContent = 'Searching...';
        }

        try {
            const verification = await verifyWorkerInWorkspace(activeFoundWorkspace.id, activeFoundWorkspace.data, queryVal);

            if (memberLookupResult) {
                memberLookupResult.style.display = 'block';
                if (verification && verification.exists) {
                    const joinedStr = verification.joinedAt 
                        ? (new Date(verification.joinedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })) 
                        : 'Active';

                    const avatarLetter = (verification.name || 'W').charAt(0).toUpperCase();

                    memberLookupResult.innerHTML = `
                        <div style="background: #ffffff; border: 1.5px solid #d4d4d8; border-radius: 12px; padding: 1.15rem; margin-top: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                            <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.85rem;">
                                <div style="width: 48px; height: 48px; border-radius: 50%; background: #f4f4f5; border: 1.5px solid #d4d4d8; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 800; font-size: 1.1rem; color: #18181b;">
                                    ${verification.photoURL ? `<img src="${verification.photoURL}" alt="${verification.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : avatarLetter}
                                </div>
                                <div style="flex: 1; min-width: 0;">
                                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                                        <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: #18181b;">${verification.name}</h4>
                                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #18181b;"></span>
                                    </div>
                                    <div style="font-size: 0.82rem; color: #71717a; margin-top: 0.15rem; word-break: break-all;">${verification.email || '—'}</div>
                                </div>
                                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 999px; border: 1px solid #d4d4d8; background: #f4f4f5; color: #18181b; white-space: nowrap;">
                                    ${verification.role || 'WORKER'}
                                </span>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; padding-top: 0.75rem; border-top: 1px solid #e4e4e7; font-size: 0.84rem;">
                                <div>
                                    <span style="color: #71717a; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Since Joined</span>
                                    <strong style="color: #18181b;">${joinedStr}</strong>
                                </div>
                                <div>
                                    <span style="color: #71717a; display: block; font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Status</span>
                                    <strong style="color: #18181b;">Connected Member</strong>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    memberLookupResult.innerHTML = `
                        <div style="background: #ffffff; border: 1.5px solid #d4d4d8; border-radius: 12px; padding: 1rem 1.15rem; margin-top: 0.5rem; color: #18181b; font-size: 0.88rem; line-height: 1.5;">
                            <div style="font-weight: 700; margin-bottom: 0.2rem;">Worker Not Found</div>
                            No active member or worker matching "<strong>${queryVal}</strong>" exists in <strong>${activeFoundWorkspace.data.name || 'this workspace'}</strong>.
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error("Member lookup error:", e);
        } finally {
            if (btnDoMemberLookup) {
                btnDoMemberLookup.disabled = false;
                btnDoMemberLookup.textContent = 'Verify Member';
            }
        }
    }

    if (btnDoMemberLookup) {
        btnDoMemberLookup.addEventListener('click', handleMemberLookup);
    }
    if (memberLookupInput) {
        memberLookupInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleMemberLookup();
            }
        });
    }
}
