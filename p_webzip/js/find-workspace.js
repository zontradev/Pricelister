import { firebaseApp } from '../firebase/firebase-config.js';
import { getFirestore, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const db = getFirestore(firebaseApp);

export function initFindWorkspace() {
    const form = document.getElementById('find-workspace-form');
    const input = document.getElementById('workspace-id-input');
    const btn = document.getElementById('find-workspace-btn');
    const loadingState = document.getElementById('find-loading');
    const notFoundState = document.getElementById('find-not-found');
    const errorState = document.getElementById('find-error');
    const errorMessage = document.getElementById('find-error-message');
    const resultState = document.getElementById('find-result');

    // Result fields
    const resName = document.getElementById('result-ws-name');
    const resId = document.getElementById('result-ws-id');
    const resAdminEmail = document.getElementById('result-admin-email');
    const resWorkers = document.getElementById('result-workers');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const workspaceId = input.value.trim();
        if (!workspaceId) return;

        // Hide all states
        notFoundState.style.display = 'none';
        errorState.style.display = 'none';
        resultState.style.display = 'none';
        
        // Show loading
        loadingState.style.display = 'block';
        btn.classList.add('is-loading');
        input.disabled = true;

        try {
            const workspacesRef = collection(db, 'Workspaces');
            const q = query(workspacesRef, where('workspaceId', '==', workspaceId));
            const querySnapshot = await getDocs(q);

            loadingState.style.display = 'none';

            if (querySnapshot.empty) {
                notFoundState.style.display = 'block';
            } else {
                // Found
                const wsDoc = querySnapshot.docs[0];
                const wsData = wsDoc.data();

                resName.textContent = wsData.name || 'Unknown Workspace';
                resId.textContent = wsData.workspaceId || workspaceId;
                resAdminEmail.textContent = wsData.adminEmail || 'Unknown';
                resWorkers.textContent = wsData.workersCount || '0';

                resultState.style.display = 'block';
            }
        } catch (error) {
            console.error('Error finding workspace:', error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
            errorMessage.textContent = error.message || 'Unable to search right now. Please try again later.';
        } finally {
            btn.classList.remove('is-loading');
            input.disabled = false;
        }
    });
}
