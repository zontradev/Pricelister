import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getFirestore, doc, collection, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

export const renderWorkers = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    
    // Fetch current user's role and workspace info
    const wsInfo = await firestoreService.checkWorkspaceExists(currentUser.uid);
    if (!wsInfo) return;
    
    const role = wsInfo.role || 'WORKER';
    const roleUpper = role.toUpperCase();
    const isAdmin = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'ADMIN' || roleUpper === 'CREATOR';
    const isCoAdmin = roleUpper === 'CO_ADMIN' || roleUpper === 'CO-ADMIN';
    const isWorker = !isAdmin && !isCoAdmin;
    const displayRole = isAdmin ? 'Admin' : (isCoAdmin ? 'Co-Admin' : 'Worker');
    
    const canManageWorkers = isAdmin || isCoAdmin;

    let headerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>Workspace & Members</h2>
            <div style="display: flex; gap: 1rem;">
                ${canManageWorkers ? `<button id="btn-add-worker" class="btn btn-primary">Invite Worker</button>` : ''}
                ${isAdmin ? `<button id="btn-edit-workspace" class="btn btn-secondary">Edit Workspace</button>` : ''}
            </div>
        </div>
        
        <div class="card" style="padding: 1.5rem; margin-bottom: 2rem; background: var(--surface-100);">
            <h3 style="margin-top: 0;">Workspace Info</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                <div><strong>Workspace Name:</strong> ${wsInfo.name}</div>
                <div><strong>Workspace ID:</strong> <span style="font-family: monospace;">${wsInfo.workspaceId || wsInfo.id}</span></div>
                <div><strong>Your Worker ID:</strong> <span style="font-family: monospace;">${currentUser.uid}</span></div>
                <div><strong>Your Role:</strong> <span class="badge" style="background: ${isCoAdmin ? '#9c27b0' : (isAdmin ? '#4338ca' : 'var(--primary)')}; color: white;">${displayRole}</span></div>
                ${isWorker ? `<div><strong>Admin Email:</strong> ${wsInfo.adminEmail || 'Unknown'}</div>` : ''}
            </div>
        </div>
    `;

    container.innerHTML = headerHTML + `
        <div class="card" style="padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
                <h3 style="margin:0;">Members</h3>
            </div>
            <p class="text-muted" style="margin-bottom: 1rem;">${canManageWorkers ? 'Manage the members connected to this workspace.' : 'List of members in this workspace.'}</p>
            
            <div class="table-container">
                <table style="width:100%; border-collapse: collapse; text-align:left;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color); color: var(--text-muted);">
                            <th style="padding:1rem;">Worker Email</th>
                            <th style="padding:1rem;">Role</th>
                            <th style="padding:1rem;">Status</th>
                            ${canManageWorkers ? `<th style="padding:1rem;">Actions</th>` : ''}
                        </tr>
                    </thead>
                    <tbody id="workers-list-body">
                        <tr><td colspan="${canManageWorkers ? '4' : '3'}" style="padding:1rem; text-align:center;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add Worker Modal (Simplified for Web) -->
        <div id="add-worker-container" class="card" style="display:none; padding: 1.5rem; max-width: 500px; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Add Worker</h3>
            <form id="add-worker-form" style="display:flex; flex-direction:column; gap:1rem;">
                <div class="form-group">
                    <label>Worker Email Address *</label>
                    <input type="email" id="worker-email" required class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                
                <div class="form-group">
                    <label>Role</label>
                    <select id="worker-role" class="form-control" style="width:100%; padding:0.5rem;">
                        <option value="WORKER">Worker (Restricted)</option>
                        <option value="CO_ADMIN">Co-Admin</option>
                    </select>
                </div>
                
                <div style="display:flex; gap:1rem; margin-top: 1rem;">
                    <button type="submit" id="btn-submit-worker" class="btn btn-primary">Send Invite</button>
                    <button type="button" id="btn-cancel-worker" class="btn btn-secondary">Cancel</button>
                </div>
            </form>
        </div>
    `;

    const tbody = document.getElementById('workers-list-body');
    const addContainer = document.getElementById('add-worker-container');
    const form = document.getElementById('add-worker-form');
    let unsubscribeMembers = null;

    if (isAdmin && document.getElementById('btn-add-worker')) {
        document.getElementById('btn-add-worker').addEventListener('click', () => {
            addContainer.style.display = 'block';
            addContainer.scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('btn-cancel-worker').addEventListener('click', () => {
            addContainer.style.display = 'none';
            form.reset();
        });
    }

    // Data Listener for Members
    try {
        const membersRef = collection(db, `Workspaces/${workspaceId}/Members`);
        
        unsubscribeMembers = onSnapshot(membersRef, (snap) => {
            if (snap.empty) {
                tbody.innerHTML = `<tr><td colspan="4" style="padding:1rem; text-align:center; color: var(--text-muted);">No workers found.</td></tr>`;
                return;
            }
            
            const members = snap.docs.map(doc => ({ email: doc.id, ...doc.data() }));
            
            tbody.innerHTML = members.map(m => {
                const rUpper = (m.role || 'WORKER').toUpperCase();
                let roleDisp = 'Worker';
                let roleStyle = '';
                if (rUpper === 'CO_ADMIN' || rUpper === 'CO-ADMIN') {
                    roleDisp = 'Co-Admin';
                    roleStyle = 'color:#9c27b0; font-weight:bold;';
                } else if (rUpper === 'CREATOR_ADMIN' || rUpper === 'ADMIN' || rUpper === 'CREATOR') {
                    roleDisp = 'Admin';
                    roleStyle = 'color:#4338ca; font-weight:bold;';
                }
                
                return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding:1rem;"><strong>${m.email}</strong></td>
                    <td style="padding:1rem;"><span style="${roleStyle}">${roleDisp}</span></td>
                    <td style="padding:1rem;"><span class="badge" style="background:${m.status === 'ACCEPTED' || m.status === 'Joined' ? '#4CAF50' : '#FF9800'}; color: white;">${m.status === 'Joined' ? 'ACCEPTED' : (m.status || 'PENDING')}</span></td>
                    ${canManageWorkers ? `
                    <td style="padding:1rem;">
                        ${(isAdmin || (isCoAdmin && rUpper !== 'CREATOR_ADMIN' && rUpper !== 'ADMIN' && rUpper !== 'CREATOR')) ? `<button class="btn btn-sm btn-outline rem-worker" data-email="${m.email}">Remove</button>` : '<span class="text-muted">No Access</span>'}
                    </td>
                    ` : ''}
                </tr>
            `}).join('');

            // Attach remove events
            if (canManageWorkers) {
                document.querySelectorAll('.rem-worker').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const emailToRemove = e.target.getAttribute('data-email');
                        if (await showAlert.confirm(`Remove ${emailToRemove} from workspace?`)) {
                            try {
                                await deleteDoc(doc(db, `Workspaces/${workspaceId}/Members`, emailToRemove));
                                showAlert.success("Worker removed.");
                            } catch (err) {
                                console.error(err);
                                showAlert.error("Failed to remove worker.");
                            }
                        }
                    });
                });
            }
        }, (error) => {
            console.error("Members Listener Error:", error);
            tbody.innerHTML = `<tr><td colspan="4" style="padding:1rem; text-align:center; color: #ff4d4f;">Permission Denied or Error loading members.</td></tr>`;
        });
        
    } catch (err) {
        console.error(err);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-worker');
            btnSubmit.disabled = true;
            
            const email = document.getElementById('worker-email').value.toLowerCase();
            const role = document.getElementById('worker-role').value;
            
            try {
                // 1. Create Invite Document
                const inviteRef = doc(db, 'Invites', `${workspaceId}_${email}`);
                await setDoc(inviteRef, {
                    adminUid: workspaceId,
                    workerEmail: email,
                    role: role,
                    timestamp: Date.now()
                });

                // 2. Add to Members Sub-collection as PENDING
                const memberRef = doc(db, `Workspaces/${workspaceId}/Members`, email);
                await setDoc(memberRef, {
                    role: role,
                    status: 'PENDING',
                    timestamp: Date.now()
                });

                showAlert.success(`Invitation sent to ${email}`);
                addContainer.style.display = 'none';
                form.reset();
            } catch (err) {
                console.error(err);
                showAlert.error("Failed to send invite. Check permissions.");
            } finally {
                btnSubmit.disabled = false;
            }
        });
    }
};
