import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getFirestore, doc, collection, getDoc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

export const renderWorkers = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    
    // Fetch current user's workspace info
    const wsInfo = await firestoreService.checkWorkspaceExists(currentUser.uid, currentUser.email);
    if (!wsInfo) return;
    
    // Calculate permissions for the UI based on top-level role (will update when snapshot arrives)
    const roleUpper = (wsInfo.role || 'WORKER').toUpperCase();
    const isAdmin = roleUpper === 'CREATOR_ADMIN' || roleUpper === 'ADMIN' || roleUpper === 'CREATOR';
    const isCoAdmin = roleUpper === 'CO_ADMIN' || roleUpper === 'CO-ADMIN';
    const canManageWorkers = isAdmin || isCoAdmin;

    container.innerHTML = `
        <div class="module-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem;">
            <h2>Workspace & Members</h2>
            <div style="display: flex; gap: 1rem;">
                ${canManageWorkers ? '<button id="btn-add-worker" class="btn btn-primary">Invite Worker</button>' : ''}
                ${isAdmin ? '<button id="btn-edit-workspace" class="btn btn-secondary">Edit Workspace</button>' : ''}
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
            <!-- Workspace Info -->
            <div class="card" style="padding: 1.5rem; background: var(--surface-100);">
                <h3 style="margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Workspace Info</h3>
                <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-top: 1rem;">
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 120px;">Name:</strong> <span style="font-weight: 500;">${wsInfo.name}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 120px;">Workspace ID:</strong> <span style="font-family: monospace;">${wsInfo.workspaceId || wsInfo.id}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 120px;">Admin Email:</strong> <span>${wsInfo.adminEmail || 'Unknown'}</span></div>
                </div>
            </div>
            
            <!-- My Info -->
            <div class="card" style="padding: 1.5rem; background: var(--surface-50);">
                <h3 style="margin-top: 0; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">My Info</h3>
                <div id="my-info-content" style="display: flex; flex-direction: column; gap: 0.85rem; margin-top: 1rem;">
                    <div style="color: var(--text-muted);">Loading your profile...</div>
                </div>
            </div>
        </div>

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
                            ${canManageWorkers ? '<th style="padding:1rem;">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="workers-list-body">
                        <tr><td colspan="${canManageWorkers ? '4' : '3'}" style="padding:1rem; text-align:center;">Loading...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Add Worker Modal -->
        <div id="add-worker-container" class="card" style="display:none; padding: 1.5rem; max-width: 500px; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Invite Worker</h3>
            <form id="add-worker-form" style="display:flex; flex-direction:column; gap:1rem;">
                <div class="form-group">
                    <label>Worker Email Address *</label>
                    <input type="email" id="worker-email" required class="form-control" style="width:100%; padding:0.5rem;" placeholder="worker@gmail.com">
                    <small style="font-size:0.78rem; color:var(--text-muted); margin-top:0.35rem; display:block;">Must be a valid Gmail address ending with @gmail.com</small>
                </div>
                
                <div class="form-group">
                    <label>Role</label>
                    <select id="worker-role" class="form-control" style="width:100%; padding:0.5rem;">
                        <option value="WORKER">Worker (Restricted)</option>
                        ${isAdmin ? '<option value="CO_ADMIN">Co-Admin</option>' : ''}
                    </select>
                </div>
                
                <div style="display:flex; gap:1rem; margin-top: 1rem;">
                    <button type="submit" id="btn-submit-worker" class="btn btn-primary">Send Invite</button>
                    <button type="button" id="btn-cancel-worker" class="btn btn-secondary">Cancel</button>
                </div>
            </form>
        </div>

        <!-- Manage Worker Modal -->
        <div id="manage-worker-container" class="card" style="display:none; padding: 1.5rem; max-width: 500px; margin-bottom: 2rem;">
            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Manage Member</h3>
            <form id="manage-worker-form" style="display:flex; flex-direction:column; gap:1rem;">
                <input type="hidden" id="manage-email">
                <div style="font-size: 1.1rem; font-weight: bold; margin-bottom: 0.5rem;" id="manage-email-display"></div>
                
                ${isAdmin ? `
                <div class="form-group">
                    <label>Workspace Role</label>
                    <select id="manage-role" class="form-control" style="width:100%; padding:0.5rem;">
                        <option value="WORKER">Worker</option>
                        <option value="CO_ADMIN">Co-Admin</option>
                    </select>
                </div>`
                 : '<input type="hidden" id="manage-role" value="WORKER">'}

                <div class="form-group" id="manage-restrictions-group">
                    <label>Restrictions (Applies to Workers only)</label>
                    <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top: 0.5rem; background: var(--bg-light); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="manage-disable-add"> Unable to add data
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="manage-disable-update"> Unable to update data
                        </label>
                        <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                            <input type="checkbox" id="manage-disable-delete"> Unable to delete data
                        </label>
                    </div>
                </div>
                
                <div style="display:flex; gap:1rem; margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                    <button type="submit" id="btn-save-manage" class="btn btn-primary">Save Changes</button>
                    <button type="button" id="btn-remove-worker" class="btn btn-outline" style="color: var(--error); border-color: var(--error);">Remove Member</button>
                    <button type="button" id="btn-cancel-manage" class="btn btn-secondary">Cancel</button>
                </div>
            </form>
        </div>
    `;

    const tbody = container.querySelector('#workers-list-body');
    const myInfoContent = container.querySelector('#my-info-content');
    const addContainer = container.querySelector('#add-worker-container');
    const manageContainer = container.querySelector('#manage-worker-container');
    const addForm = container.querySelector('#add-worker-form');
    const manageForm = container.querySelector('#manage-worker-form');
    let unsubscribeMembers = null;
    let currentMembersList = [];

    if (canManageWorkers && container.querySelector('#btn-add-worker')) {
        container.querySelector('#btn-add-worker').addEventListener('click', () => {
            manageContainer.style.display = 'none';
            addContainer.style.display = 'block';
            addContainer.scrollIntoView({ behavior: 'smooth' });
            container.querySelector('#worker-email')?.focus();
        });
        container.querySelector('#btn-cancel-worker').addEventListener('click', () => {
            addContainer.style.display = 'none';
            addForm.reset();
        });
    }

    container.querySelector('#btn-cancel-manage')?.addEventListener('click', () => {
        manageContainer.style.display = 'none';
    });

    // Data Listener for Members
    try {
        const membersRef = collection(db, 'Workspaces/' + workspaceId + '/Members');
        
        unsubscribeMembers = onSnapshot(membersRef, (snap) => {
            const members = snap.docs.map(doc => ({ email: doc.id, ...doc.data() }));

            // Ensure workspace creator is in the members list
            if (wsInfo.adminEmail) {
                const hasCreator = members.some(m => (m.email || '').toLowerCase() === wsInfo.adminEmail.toLowerCase());
                if (!hasCreator) {
                    members.unshift({
                        email: wsInfo.adminEmail,
                        role: 'ADMIN',
                        status: 'JOINED',
                        isCreator: true,
                        joinedAt: wsInfo.timestamp || null
                    });
                }
            }

            currentMembersList = members;

            if (members.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="padding:1.5rem; text-align:center; color: var(--text-muted);">No workers found.</td></tr>';
                return;
            }
            
            // --- POPULATE MY INFO ---
            const myEmail = (currentUser.email || '').toLowerCase();
            const myMemberData = members.find(m => (m.email || '').toLowerCase() === myEmail);
            
            if (myMemberData) {
                const joinedDate = myMemberData.joinedAt ? new Date(myMemberData.joinedAt).toLocaleDateString() : 'Active';
                const effectiveIsRestricted = myMemberData.isRestricted && (myMemberData.disableAdd || myMemberData.disableUpdate || myMemberData.disableDelete);
                
                let restrictionsHtml = '';
                if (effectiveIsRestricted) {
                    restrictionsHtml = `
                        <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(244, 67, 54, 0.1); border: 1px solid rgba(244, 67, 54, 0.3); border-radius: 6px; color: #dc2626; font-size: 0.85rem;">
                            <div style="display:flex; align-items:center; gap:0.4rem; font-weight:700;">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                <span>Restrictions Active:</span>
                            </div>
                            <ul style="margin: 0.25rem 0 0 1.2rem; padding: 0;">
                            ${myMemberData.disableAdd ? '<li>Cannot add data</li>' : ''}
                            ${myMemberData.disableUpdate ? '<li>Cannot update data</li>' : ''}
                            ${myMemberData.disableDelete ? '<li>Cannot delete data</li>' : ''}
                            </ul>
                        </div>
                    `;
                }

                const myRoleDisp = isAdmin ? 'Admin' : (isCoAdmin ? 'Co-Admin' : 'Worker');
                const myStatusUpper = (myMemberData.status || 'JOINED').toUpperCase();
                const myIsPending = myStatusUpper === 'PENDING';
                const myStatusDisp = effectiveIsRestricted ? 'Restricted' : (myIsPending ? 'Pending' : 'Joined');
                const myStatusClass = effectiveIsRestricted ? 'badge-status-restricted' : (myIsPending ? 'badge-status-pending' : 'badge-status-joined');
                const myDotClass = effectiveIsRestricted ? 'dot-restricted' : (myIsPending ? 'dot-pending' : 'dot-joined');
                
                myInfoContent.innerHTML = `
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Email:</strong> <span>${myMemberData.email || currentUser.email}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Worker ID:</strong> <span style="font-family: monospace; font-size: 0.9rem;">${myMemberData.appWorkerId || currentUser.uid}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Role:</strong> <span class="badge" style="background: ${isCoAdmin ? '#9c27b0' : (isAdmin ? '#be123c' : 'var(--primary)')}; color: white; font-weight:600;">${myRoleDisp}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Status:</strong> <span class="badge-status ${myStatusClass}"><span class="badge-status-dot ${myDotClass}"></span><span>${myStatusDisp}</span></span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Joined:</strong> <span>${joinedDate}</span></div>
                    ${restrictionsHtml}
                `;
            } else {
                // Fallback if the user (e.g. Creator Admin) is not technically in the Members subcollection yet
                const myRoleDisp = isAdmin ? 'Admin' : (isCoAdmin ? 'Co-Admin' : 'Worker');
                myInfoContent.innerHTML = `
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Email:</strong> <span>${currentUser.email || 'Unknown'}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Worker ID:</strong> <span style="font-family: monospace; font-size: 0.9rem;">${currentUser.uid}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Role:</strong> <span class="badge" style="background: ${isCoAdmin ? '#9c27b0' : (isAdmin ? '#be123c' : 'var(--primary)')}; color: white; font-weight:600;">${myRoleDisp}</span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Status:</strong> <span class="badge-status badge-status-joined"><span class="badge-status-dot dot-joined"></span><span>Joined</span></span></div>
                    <div><strong style="color: var(--text-secondary); display:inline-block; width: 100px;">Joined:</strong> <span>Workspace Creator</span></div>
                `;
            }

            // --- POPULATE MEMBERS TABLE ---
            tbody.innerHTML = members.map(m => {
                const rUpper = (m.role || 'WORKER').toUpperCase();
                let roleDisp = 'Worker';
                let roleStyle = 'color: var(--text-primary); font-weight: 500;';
                let mIsAdmin = false;
                let mIsCoAdmin = false;

                if (rUpper === 'CREATOR_ADMIN' || rUpper === 'ADMIN' || rUpper === 'CREATOR' || m.isCreator) {
                    roleDisp = 'Admin';
                    roleStyle = 'color: var(--primary); font-weight: 700;';
                    mIsAdmin = true;
                } else if (rUpper === 'CO_ADMIN' || rUpper === 'CO-ADMIN') {
                    roleDisp = 'Co-Admin';
                    roleStyle = 'color: #9c27b0; font-weight: 700;';
                    mIsCoAdmin = true;
                }

                const statusUpper = (m.status || 'JOINED').toUpperCase();
                const isPending = statusUpper === 'PENDING';
                const isRestrictedWorker = !isPending && m.isRestricted && (m.disableAdd || m.disableUpdate || m.disableDelete);

                let statusBadgeClass = 'badge-status-joined';
                let dotClass = 'dot-joined';
                let statusDisp = 'Joined';
                let fallbackStyle = 'background-color: rgba(16, 185, 129, 0.14); color: #065f46; border: 1px solid rgba(16, 185, 129, 0.35);';
                let dotStyle = 'background-color: #10b981;';

                if (isPending) {
                    statusBadgeClass = 'badge-status-pending';
                    dotClass = 'dot-pending';
                    statusDisp = 'Pending';
                    fallbackStyle = 'background-color: rgba(245, 158, 11, 0.14); color: #92400e; border: 1px solid rgba(245, 158, 11, 0.35);';
                    dotStyle = 'background-color: #f59e0b;';
                } else if (isRestrictedWorker) {
                    statusBadgeClass = 'badge-status-restricted';
                    dotClass = 'dot-restricted';
                    statusDisp = 'Restricted';
                    fallbackStyle = 'background-color: rgba(239, 68, 68, 0.14); color: #991b1b; border: 1px solid rgba(239, 68, 68, 0.35);';
                    dotStyle = 'background-color: #ef4444;';
                }

                const statusBadgeHtml = `
                    <span class="badge-status ${statusBadgeClass}" style="${fallbackStyle}">
                        <span class="badge-status-dot ${dotClass}" style="${dotStyle}"></span>
                        <span>${statusDisp}</span>
                    </span>
                `;

                // Actions for row
                const isSelf = (m.email || '').toLowerCase() === (currentUser.email || '').toLowerCase();
                let actionHtml = '';

                if (canManageWorkers) {
                    if (isSelf) {
                        actionHtml = '<td style="padding:1rem;"><span class="text-muted" style="font-size:0.85rem; font-weight:500;">(You)</span></td>';
                    } else if (isPending) {
                        // Both Admin and Co-Admin can cancel pending invitations
                        actionHtml = `
                            <td style="padding:1rem;">
                                <button type="button" class="btn btn-sm btn-cancel-invite" 
                                    data-email="${m.email}"
                                    style="color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.06); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease;"
                                >Cancel Invite</button>
                            </td>
                        `;
                    } else {
                        // Joined member management:
                        // Admin can manage anyone except Creator Admin
                        // Co-Admin can only manage normal workers (not admins, not other co-admins)
                        let canManageThisUser = false;
                        if (isAdmin && !m.isCreator) {
                            canManageThisUser = true;
                        } else if (isCoAdmin && !m.isCreator && !mIsAdmin && !mIsCoAdmin) {
                            canManageThisUser = true;
                        }

                        if (canManageThisUser) {
                            actionHtml = `
                                <td style="padding:1rem;">
                                    <button type="button" class="btn btn-sm btn-outline btn-manage-member" 
                                        data-email="${m.email}" 
                                        data-role="${rUpper}"
                                        data-add="${m.disableAdd ? '1' : '0'}"
                                        data-update="${m.disableUpdate ? '1' : '0'}"
                                        data-delete="${m.disableDelete ? '1' : '0'}"
                                        style="padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px;"
                                    >Manage</button>
                                </td>
                            `;
                        } else {
                            actionHtml = '<td style="padding:1rem;"><span class="text-muted" style="font-size:0.85rem;">No Access</span></td>';
                        }
                    }
                }

                return `
                <tr style="border-bottom: 1px solid var(--border-color); transition: background-color 0.15s ease;">
                    <td style="padding:1rem;"><strong>${m.email}</strong></td>
                    <td style="padding:1rem;"><span style="${roleStyle}">${roleDisp}</span></td>
                    <td style="padding:1rem;">${statusBadgeHtml}</td>
                    ${actionHtml}
                </tr>`;
            }).join('');

            // Attach Manage events
            if (canManageWorkers) {
                // 1. Manage Joined Member
                container.querySelectorAll('.btn-manage-member').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const email = e.currentTarget.getAttribute('data-email');
                        const r = e.currentTarget.getAttribute('data-role');
                        const dAdd = e.currentTarget.getAttribute('data-add') === '1';
                        const dUpd = e.currentTarget.getAttribute('data-update') === '1';
                        const dDel = e.currentTarget.getAttribute('data-delete') === '1';
                        
                        container.querySelector('#manage-email').value = email;
                        container.querySelector('#manage-email-display').textContent = email;
                        
                        const roleSelect = container.querySelector('#manage-role');
                        if (roleSelect) {
                            roleSelect.value = (r === 'CO_ADMIN' || r === 'CO-ADMIN') ? 'CO_ADMIN' : 'WORKER';
                        }
                        
                        container.querySelector('#manage-disable-add').checked = dAdd;
                        container.querySelector('#manage-disable-update').checked = dUpd;
                        container.querySelector('#manage-disable-delete').checked = dDel;
                        
                        // Show manage container
                        addContainer.style.display = 'none';
                        manageContainer.style.display = 'block';
                        manageContainer.scrollIntoView({ behavior: 'smooth' });
                    });
                });

                // 2. Cancel Pending Invitation (Admin & Co-Admin)
                container.querySelectorAll('.btn-cancel-invite').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const email = e.currentTarget.getAttribute('data-email');
                        if (!email) return;

                        const confirmed = await showAlert.confirm(`Are you sure you want to cancel the pending invitation for ${email}?`, "Cancel Invitation");
                        if (!confirmed) return;

                        e.currentTarget.disabled = true;
                        e.currentTarget.textContent = 'Cancelling...';

                        try {
                            // 1. Delete from Invites collection
                            const inviteRef = doc(db, 'Invites', `${workspaceId}_${email}`);
                            await deleteDoc(inviteRef);

                            // 2. Delete from Members sub-collection
                            const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                            await deleteDoc(memberRef);

                            showAlert.success(`Invitation for ${email} has been cancelled.`);
                        } catch (err) {
                            console.error("Failed to cancel invitation:", err);
                            showAlert.error("Failed to cancel invitation. Check permissions.");
                            e.currentTarget.disabled = false;
                            e.currentTarget.textContent = 'Cancel Invite';
                        }
                    });
                });
            }
        }, (error) => {
            console.error("Members Listener Error:", error);
            tbody.innerHTML = '<tr><td colspan="4" style="padding:1rem; text-align:center; color: var(--error);">Permission Denied or Error loading members.</td></tr>';
        });
        
    } catch (err) {
        console.error(err);
    }

    // Handle Add Invite
    if (addForm) {
        addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = container.querySelector('#btn-submit-worker');
            const emailInput = container.querySelector('#worker-email');
            const roleSelect = container.querySelector('#worker-role');

            const rawEmail = (emailInput.value || '').trim();
            const email = rawEmail.toLowerCase();
            const role = roleSelect ? roleSelect.value : 'WORKER';

            // 1. Validation Rule: Valid Gmail address checking @gmail.com
            const isValidGmail = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
            if (!isValidGmail) {
                showAlert.error("Please enter a valid Gmail address (e.g. worker@gmail.com). Must end with @gmail.com.");
                emailInput.focus();
                return;
            }

            // 2. Validation Rule: Cannot invite yourself
            const myEmail = (currentUser.email || '').trim().toLowerCase();
            if (email === myEmail) {
                showAlert.error("You cannot invite yourself to the workspace.");
                emailInput.focus();
                return;
            }

            // 3. Validation Rule: Cannot invite already existing member (active or pending)
            const existingMember = currentMembersList.find(m => (m.email || '').trim().toLowerCase() === email);
            if (existingMember) {
                const st = (existingMember.status || 'JOINED').toUpperCase();
                if (st === 'PENDING') {
                    showAlert.error(`An invitation is already pending for ${email}.`);
                } else {
                    showAlert.error(`${email} is already a member of this workspace.`);
                }
                emailInput.focus();
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Sending...';

            try {
                // Direct Firestore validation check to prevent race conditions
                const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                const existingDoc = await getDoc(memberRef);
                if (existingDoc.exists()) {
                    const data = existingDoc.data();
                    const st = (data.status || 'JOINED').toUpperCase();
                    if (st === 'PENDING') {
                        showAlert.error(`An invitation is already pending for ${email}.`);
                    } else {
                        showAlert.error(`${email} is already a member of this workspace.`);
                    }
                    return;
                }

                // 1. Create Invite Document (matches Android Invites collection structure)
                const inviteRef = doc(db, 'Invites', `${workspaceId}_${email}`);
                await setDoc(inviteRef, {
                    adminUid: workspaceId,
                    adminEmail: wsInfo.adminEmail || currentUser.email,
                    workerEmail: email,
                    workspaceName: wsInfo.name || 'Workspace',
                    role: role,
                    timestamp: Date.now()
                });

                // 2. Add to Members Sub-collection as PENDING
                await setDoc(memberRef, {
                    email: email,
                    role: role,
                    status: 'PENDING',
                    addedAt: Date.now(),
                    timestamp: Date.now()
                });

                showAlert.success(`Invitation sent to ${email}`);
                addContainer.style.display = 'none';
                addForm.reset();
            } catch (err) {
                console.error("Invite error:", err);
                showAlert.error("Failed to send invite. Check permissions.");
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Send Invite';
            }
        });
    }

    // Handle Save Manage
    if (manageForm) {
        manageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = container.querySelector('#btn-save-manage');
            btnSave.disabled = true;

            const email = container.querySelector('#manage-email').value;
            const roleSelect = container.querySelector('#manage-role');
            const newRole = roleSelect ? roleSelect.value : 'WORKER';
            
            const dAdd = container.querySelector('#manage-disable-add').checked;
            const dUpd = container.querySelector('#manage-disable-update').checked;
            const dDel = container.querySelector('#manage-disable-delete').checked;
            const isRestricted = dAdd || dUpd || dDel;

            try {
                const memberRef = doc(db, 'Workspaces/' + workspaceId + '/Members', email);
                await updateDoc(memberRef, {
                    role: newRole,
                    isRestricted: isRestricted,
                    disableAdd: dAdd,
                    disableUpdate: dUpd,
                    disableDelete: dDel,
                    updatedAt: Date.now()
                });
                
                showAlert.success(`Member settings updated for ${email}`);
                manageContainer.style.display = 'none';
            } catch (err) {
                console.error(err);
                showAlert.error("Failed to update member. Check permissions.");
            } finally {
                btnSave.disabled = false;
            }
        });

        // Handle Remove from Manage Modal
        container.querySelector('#btn-remove-worker').addEventListener('click', async () => {
            const email = container.querySelector('#manage-email').value;
            if (await showAlert.confirm(`Are you sure you want to completely remove ${email} from this workspace?`, "Remove Member")) {
                try {
                    await deleteDoc(doc(db, 'Workspaces/' + workspaceId + '/Members', email));
                    try {
                        await deleteDoc(doc(db, 'Invites', `${workspaceId}_${email}`));
                    } catch (e) {
                        // ignore if invite doc doesn't exist
                    }
                    showAlert.success(`${email} has been removed from the workspace.`);
                    manageContainer.style.display = 'none';
                } catch (err) {
                    console.error("Remove member error:", err);
                    showAlert.error("Failed to remove member. Check permissions.");
                }
            }
        });
    }
};
