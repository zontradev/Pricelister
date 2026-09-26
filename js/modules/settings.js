import { firestoreService } from '../../firebase/firestore.js';
import { authService } from '../../firebase/auth.js';
import { showAlert } from '../alert-handler.js';
import { getFirestore, doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { firebaseApp } from '../../firebase/firebase-config.js';

const db = getFirestore(firebaseApp);

export const renderSettings = async (container, workspaceId) => {
    const currentUser = authService.getCurrentUser();
    
    container.innerHTML = `
        <div class="module-header" style="margin-bottom: 2rem;">
            <h2>Workspace Settings</h2>
        </div>
        
        <div class="card" style="padding: 1.5rem; max-width: 600px;">
            <h3 style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">General Information</h3>
            <form id="settings-form" style="display:flex; flex-direction:column; gap:1.5rem;">
                <div class="form-group">
                    <label>Workspace Name *</label>
                    <input type="text" id="set-name" required class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                
                <div class="form-group">
                    <label>Business Email *</label>
                    <input type="email" id="set-email" required class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                
                <div class="form-group">
                    <label>Business Phone</label>
                    <input type="text" id="set-phone" class="form-control" style="width:100%; padding:0.5rem;">
                </div>
                
                <div class="form-group">
                    <label>Business Address</label>
                    <textarea id="set-address" class="form-control" style="width:100%; padding:0.5rem; min-height: 80px;"></textarea>
                </div>
                
                <div style="display:flex; gap:1rem; margin-top: 1rem;">
                    <button type="submit" id="btn-save-settings" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    const form = document.getElementById('settings-form');
    const btnSave = document.getElementById('btn-save-settings');

    try {
        // Load real-time workspace data using onSnapshot (Data Listener)
        const wsRef = doc(db, 'Workspaces', workspaceId);
        
        // Use a one-time get for initial population to handle form resets, but you could use onSnapshot here
        const wsSnap = await getDoc(wsRef);
        if (wsSnap.exists()) {
            const data = wsSnap.data();
            document.getElementById('set-name').value = data.name || '';
            document.getElementById('set-email').value = data.email || '';
            document.getElementById('set-phone').value = data.phone || '';
            document.getElementById('set-address').value = data.address || '';
            
            // If the user isn't the owner, disable the form
            if (workspaceId !== currentUser.uid) {
                form.querySelectorAll('input, textarea, button').forEach(el => el.disabled = true);
                btnSave.textContent = "View Only (Admin Required)";
            }
        }
    } catch (err) {
        console.error(err);
        showAlert.error("Failed to load workspace settings.");
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        btnSave.disabled = true;
        btnSave.textContent = "Saving...";
        
        try {
            const wsRef = doc(db, 'Workspaces', workspaceId);
            await updateDoc(wsRef, {
                name: document.getElementById('set-name').value,
                email: document.getElementById('set-email').value,
                phone: document.getElementById('set-phone').value,
                address: document.getElementById('set-address').value,
            });
            showAlert.success("Workspace settings updated.");
        } catch (err) {
            console.error(err);
            showAlert.error("Failed to save settings.");
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = "Save Changes";
        }
    });
};
