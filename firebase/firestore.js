import { firebaseApp } from './firebase-config.js';
import { 
    getFirestore, doc, getDoc, setDoc, serverTimestamp,
    collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, increment,
    enableMultiTabIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { CONFIG } from '../config.js';

const db = getFirestore(firebaseApp);

// Enable local cache (offline persistence) for buttery smooth reloads
enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time unless multi-tab is supported.');
    } else if (err.code === 'unimplemented') {
        console.warn('The current browser does not support all of the features required to enable persistence.');
    } else {
        console.error('Firestore persistence error:', err);
    }
});

// Test Mode namespace isolation strategy
const getCollectionName = (baseName) => {
    return CONFIG.APP_MODE === 'test' ? `test_${baseName}` : baseName;
};

export const firestoreService = {
    checkWorkspaceExists: async (uid, email = null) => {
        // Purely local mock session bypass
        if (uid === 'dev-mock-uid') {
            return {
                id: 'ws_dev_mock',
                name: 'Local Dev Workspace',
                email: 'developer@local.test',
                role: 'CREATOR_ADMIN',
                isTestData: true
            };
        }

        try {
            // 1. Check if user is an Admin (Workspace ID == UID)
            const wsRef = doc(db, 'Workspaces', uid);
            const wsSnap = await getDoc(wsRef);
            if (wsSnap.exists()) {
                return { id: wsSnap.id, ...wsSnap.data(), role: 'CREATOR_ADMIN' };
            }

            // 2. If not admin, check if they are a Verified Worker
            const connRef = doc(db, 'Connections', uid);
            const connSnap = await getDoc(connRef);
            if (connSnap.exists() && connSnap.data().adminUid) {
                const adminUid = connSnap.data().adminUid;
                const workerWsRef = doc(db, 'Workspaces', adminUid);
                const workerWsSnap = await getDoc(workerWsRef);
                if (workerWsSnap.exists()) {
                    let realRole = connSnap.data().role || 'WORKER';
                    if (email) {
                        try {
                            const memberRef = doc(db, `Workspaces/${adminUid}/Members`, email.toLowerCase());
                            const memberSnap = await getDoc(memberRef);
                            if (memberSnap.exists() && memberSnap.data().role) {
                                realRole = memberSnap.data().role;
                            }
                        } catch (err) {
                            console.error("Error fetching member real role:", err);
                        }
                    }
                    return { id: workerWsSnap.id, ...workerWsSnap.data(), role: realRole };
                }
            }

            return null;
        } catch (error) {
            console.error("Error checking workspace:", error);
            throw error;
        }
    },
    
    createWorkspace: async (uid, email, workspaceData) => {
        // Purely local mock session bypass
        if (uid === 'dev-mock-uid') {
            return 'ws_dev_mock';
        }

        try {
            // According to Android rules: isWorkspaceAdmin(workspaceId) means document ID == uid
            const documentId = uid; 
            
            // Base34 14-Character Generator (Android match)
            const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
            let time = Date.now();
            let timeStr = "";
            while (time > 0) {
                timeStr = chars[time % 34] + timeStr;
                time = Math.floor(time / 34);
            }
            const randomLen = Math.max(14 - timeStr.length, 4);
            let randomPart = "";
            for(let i=0; i<randomLen; i++) {
                randomPart += chars[Math.floor(Math.random() * chars.length)];
            }
            const newWorkspaceId = timeStr + randomPart;
            
            // 1. Create Workspace Doc matching Android structure
            const workspaceRef = doc(db, 'Workspaces', documentId);
            await setDoc(workspaceRef, {
                workspaceId: newWorkspaceId,
                name: workspaceData.name,
                description: "",
                phone: workspaceData.phone || "",
                address: workspaceData.address || "",
                email: workspaceData.email || "",
                adminEmail: email,
                adminName: workspaceData.name, // generic fallback
                adminId: uid, // Use UID as the worker ID for the admin initially
                createdAt: serverTimestamp(),
                workersCount: 0,
                adminProductCount: 0,
                adminInvoiceCount: 0,
                adminCategoryCount: 0,
                adminBusinessCount: 0,
                adminClientCount: 0,
                adminTotalDeletedCount: 0
            });
            
            // 2. Update User Profile in userCollection
            const userRef = doc(db, 'userCollection', uid);
            await setDoc(userRef, {
                email: email,
                role: 'CREATOR_ADMIN',
                createdAt: serverTimestamp()
            }, { merge: true });
            
            return workspaceId;
        } catch (error) {
            console.error("Error creating workspace:", error);
            throw error;
        }
    },

    // ---------------------------------------------
    // INVITATION SYSTEM (Mailbox Parity)
    // ---------------------------------------------
    getPendingInvites: async (email) => {
        try {
            const q = query(collection(db, 'Invites'), where('workerEmail', '==', email.toLowerCase()));
            const snap = await getDocs(q);
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
            console.error("Error fetching invites:", error);
            return [];
        }
    },
    
    acceptWorkspaceInvite: async (invite, user) => {
        try {
            const workerId = user.uid.substring(0, 8); // Simple worker ID generation
            
            // 1. Create Connection Document
            await setDoc(doc(db, 'Connections', user.uid), {
                adminUid: invite.adminUid,
                adminEmail: invite.adminEmail || '',
                role: invite.role || 'WORKER'
            });

            // 2. Add User to Workspace Members Collection
            await setDoc(doc(db, `Workspaces/${invite.adminUid}/Members`, user.email.toLowerCase()), {
                status: "Joined",
                workerUid: user.uid,
                appWorkerId: workerId,
                joinedAt: Date.now(),
                name: user.displayName || user.email,
                email: user.email.toLowerCase(),
                role: invite.role || "Worker",
                isRestricted: false,
                disableDelete: false,
                disableUpdate: false,
                disableAdd: false,
                productAdded: 0,
                invoiceAdded: 0
            }, { merge: true });

            // 3. Increment workersCount
            await updateDoc(doc(db, 'Workspaces', invite.adminUid), {
                workersCount: increment(1)
            });

            // 4. Delete the invite
            await deleteDoc(doc(db, 'Invites', invite.id));
            
        } catch (error) {
            console.error("Error accepting invite:", error);
            throw error;
        }
    },

    rejectWorkspaceInvite: async (inviteId) => {
        try {
            await deleteDoc(doc(db, 'Invites', inviteId));
        } catch (error) {
            console.error("Error rejecting invite:", error);
            throw error;
        }
    }
};

// Modular Repository Factory
export const createRepository = (collectionName, workspaceId) => {
    // For local dev mock bypass
    if (workspaceId === 'ws_dev_mock') {
        const mockStore = {}; // Memory store for current session
        return {
            getAll: async () => Object.values(mockStore),
            listenAll: (callback) => {
                callback(Object.values(mockStore));
                return () => {}; // mock unsubscribe
            },
            getById: async (id) => mockStore[id] || null,
            add: async (data) => {
                const id = `mock_${Date.now()}`;
                data.id = id;
                if(!data.uniqueId) data.uniqueId = id;
                mockStore[id] = data;
                return id;
            },
            update: async (id, data) => {
                if (mockStore[id]) {
                    mockStore[id] = { ...mockStore[id], ...data };
                }
            },
            delete: async (id) => {
                delete mockStore[id];
            }
        };
    }

    // Real Firestore implementation
    const baseCollectionPath = `Workspaces/${workspaceId}/${collectionName}`;
    const collRef = collection(db, baseCollectionPath);

    return {
        getAll: async (additionalConditions = []) => {
            let q = query(collRef);
            if (additionalConditions.length > 0) {
                q = query(collRef, ...additionalConditions);
            }
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        },
        
        listenAll: (callback, additionalConditions = []) => {
            let q = query(collRef);
            if (additionalConditions.length > 0) {
                q = query(collRef, ...additionalConditions);
            }
            return onSnapshot(q, (snap) => {
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(data);
            });
        },
        
        getById: async (id) => {
            const docRef = doc(db, baseCollectionPath, id);
            const snap = await getDoc(docRef);
            return snap.exists() ? { id: snap.id, ...snap.data() } : null;
        },
        
        add: async (data) => {
            const docRef = doc(collRef); // generate ref with new ID
            
            // Explicitly attach the id to the payload if not present, matching Android's structure
            if (data.id === null || data.id === undefined) {
                data.id = docRef.id;
            }

            await setDoc(docRef, data);
            return docRef.id;
        },
        
        update: async (id, data) => {
            const docRef = doc(db, baseCollectionPath, id);
            await updateDoc(docRef, {
                ...data,
                updatedTimestamp: serverTimestamp()
            });
        },
        
        delete: async (id) => {
            const docRef = doc(db, baseCollectionPath, id);
            await deleteDoc(docRef);
        }
    };
};
