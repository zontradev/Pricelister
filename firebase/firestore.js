import { firebaseApp } from './firebase-config.js';
import { 
    getFirestore, doc, getDoc, setDoc, serverTimestamp,
    collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, increment,
    enableMultiTabIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { CONFIG } from '../config.js';
import { storageService } from '../supabase/storage.js';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

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
            
            // Base34 14-Character Generator (Android ProductViewModel.kt Parity)
            const chars = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
            let time = Date.now();
            const timeSb = [];
            while (time > 0) {
                timeSb.push(chars[time % 34]);
                time = Math.floor(time / 34);
            }
            const timestampPart = timeSb.reverse().join("");
            const randomLen = Math.max(14 - timestampPart.length, 4);
            let randomPart = "";
            for (let i = 0; i < randomLen; i++) {
                randomPart += chars[Math.floor(Math.random() * chars.length)];
            }
            const newWorkspaceId = (timestampPart + randomPart).substring(0, 14);

            // Generate Worker/Admin ID (Android Parity)
            const adminWorkerId = Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // 1. Create Workspace Doc matching Android structure with exact required fields
            const workspaceRef = doc(db, 'Workspaces', documentId);
            const wsDocData = {
                workspaceId: newWorkspaceId,
                name: (workspaceData.name || "").trim(),
                description: (workspaceData.description || "Main").trim(),
                phone: workspaceData.phone || "",
                address: workspaceData.address || "",
                email: workspaceData.email || email || "",
                adminEmail: email || workspaceData.adminEmail || "",
                adminName: workspaceData.adminName || workspaceData.name || "Eycon Contact",
                adminId: workspaceData.adminId || adminWorkerId,
                createdAt: Date.now(),
                workersCount: 0,
                adminProductCount: 0,
                adminInvoiceCount: 0,
                adminCategoryCount: 0,
                adminBusinessCount: 0,
                adminClientCount: 0,
                adminTotalDeleted: 0,
                adminTotalDeletedCount: 0,
                currency: (workspaceData.currency || workspaceData.currencySymbol || "$").trim().substring(0, 3) || "$",
                currencySymbol: (workspaceData.currencySymbol || workspaceData.currency || "$").trim().substring(0, 3) || "$"
            };

            await setDoc(workspaceRef, wsDocData);
            
            // 2. Initialize ReceiptData with Currency & Shop Details
            const receiptRef = doc(db, 'ReceiptData', documentId);
            await setDoc(receiptRef, {
                "Vending": false,
                "Shop Name": (workspaceData.name || "").trim(),
                "Address / Subtitle": workspaceData.address || "",
                "Phone Number": workspaceData.phone || "",
                "End Massage": "",
                "Customer Name": true,
                "Customer number": true,
                "Currency": (workspaceData.currency || workspaceData.currencySymbol || "$").trim().substring(0, 3) || "$",
                "last_updated": new Date()
            }, { merge: true });

            // 3. Update User Profile in userCollection
            const userRef = doc(db, 'userCollection', uid);
            await setDoc(userRef, {
                email: email,
                role: 'CREATOR_ADMIN',
                createdAt: serverTimestamp()
            }, { merge: true });
            
            return newWorkspaceId;
        } catch (error) {
            console.error("Error creating workspace:", error);
            throw error;
        }
    },

    // ---------------------------------------------
    // REALTIME ROLE LISTENER
    // ---------------------------------------------
    listenToUserRole: (uid, email, onRoleChange) => {
        if (!uid) return () => {};
        
        // Check if Admin
        const wsRef = doc(db, 'Workspaces', uid);
        const unsubWs = onSnapshot(wsRef, (snap) => {
            if (snap.exists()) {
                onRoleChange('CREATOR_ADMIN', snap.data());
            } else {
                // If not admin, listen to Connections doc
                const connRef = doc(db, 'Connections', uid);
                const unsubConn = onSnapshot(connRef, async (connSnap) => {
                    if (connSnap.exists()) {
                        const connData = connSnap.data();
                        const adminUid = connData.adminUid;
                        let role = connData.role || 'WORKER';
                        
                        if (email && adminUid) {
                            try {
                                const memberRef = doc(db, `Workspaces/${adminUid}/Members`, email.toLowerCase());
                                const memberSnap = await getDoc(memberRef);
                                if (memberSnap.exists() && memberSnap.data().role) {
                                    role = memberSnap.data().role;
                                }
                            } catch (e) {
                                console.warn("Member role read error:", e);
                            }
                        }
                        onRoleChange(role, connData);
                    } else {
                        onRoleChange(null, null);
                    }
                }, (err) => console.warn("Conn listen error:", err));
                
                return unsubConn;
            }
        }, (err) => console.warn("Ws listen error:", err));

        return unsubWs;
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
    },

    listenUserInvites: (email, callback) => {
        if (!email) return () => {};
        const q = query(collection(db, 'Invites'), where('workerEmail', '==', email.toLowerCase()));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(list);
        }, (err) => console.warn("Invites listen error:", err));
    },

    leaveWorkspace: async (adminUid, currentUser = null) => {
        const user = currentUser || auth.currentUser;
        if (!user || !user.uid) throw new Error("No authenticated user.");
        
        if (adminUid === user.uid) {
            throw new Error("Workspace creators cannot leave their own workspace. If you wish to destroy this workspace, use Delete Workspace.");
        }

        const email = (user.email || '').trim().toLowerCase();

        // 1. Delete user connection
        await deleteDoc(doc(db, 'Connections', user.uid)).catch(e => console.warn("Conn delete error:", e));

        // 2. Remove member doc in workspace
        if (email) {
            await deleteDoc(doc(db, `Workspaces/${adminUid}/Members`, email)).catch(e => console.warn("Member doc delete error:", e));
        }

        // 3. Decrement workersCount in workspace
        await updateDoc(doc(db, 'Workspaces', adminUid), {
            workersCount: increment(-1)
        }).catch(e => console.warn("Workers count update error:", e));

        // Clear local storage cache
        try {
            localStorage.removeItem('pricelister_last_workspace_id');
        } catch(e) {}
    },

    deleteEntireWorkspace: async (adminUid, currentUser = null) => {
        const user = currentUser || auth.currentUser;
        if (!user || !user.uid) throw new Error("No authenticated user.");

        if (adminUid !== user.uid) {
            throw new Error("Only the primary workspace admin/creator can delete this workspace.");
        }

        // 1. Check member count - MUST be 0 members (except the admin themselves)
        const membersRef = collection(db, `Workspaces/${adminUid}/Members`);
        const membersSnap = await getDocs(membersRef);
        const activeOtherMembers = membersSnap.docs.filter(d => {
            const m = d.data();
            const mEmail = (m.email || d.id || '').toLowerCase();
            const isSelf = mEmail === (user.email || '').toLowerCase() || m.workerUid === user.uid;
            return !isSelf;
        });

        if (activeOtherMembers.length > 0) {
            throw new Error(`Cannot delete workspace. There are still ${activeOtherMembers.length} active member(s) connected. Please remove all members first from the Workers tab.`);
        }

        // 2. Delete all subcollections: Products, Invoices, BusinessInvoices, Categories, ClientProfiles, BusinessProfiles, CustomerProfiles, Members, AppSettings, ReceiptData
        const subcollections = [
            'Products',
            'Invoices',
            'BusinessInvoices',
            'Categories',
            'ClientProfiles',
            'BusinessProfiles',
            'CustomerProfiles',
            'Members',
            'AppSettings',
            'ReceiptData'
        ];

        for (const sub of subcollections) {
            try {
                const subRef = collection(db, `Workspaces/${adminUid}/${sub}`);
                const snap = await getDocs(subRef);
                const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
                await Promise.all(deletePromises);
            } catch (err) {
                console.warn(`Error clearing subcollection ${sub}:`, err);
            }
        }

        // 3. Delete any pending invites sent for this workspace
        try {
            const invitesQ = query(collection(db, 'Invites'), where('adminUid', '==', adminUid));
            const invitesSnap = await getDocs(invitesQ);
            const inviteDeletes = invitesSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(inviteDeletes);
        } catch (err) {
            console.warn("Error deleting workspace invites:", err);
        }

        // 4. Delete Supabase assets folder for this workspace
        try {
            await storageService.deleteWorkspaceAssets(adminUid);
        } catch (err) {
            console.warn("Error deleting Supabase workspace assets:", err);
        }

        // 5. Delete the main Workspace document
        await deleteDoc(doc(db, 'Workspaces', adminUid));

        // 6. Update user role in userCollection
        try {
            await updateDoc(doc(db, 'userCollection', user.uid), {
                role: 'USER',
                workspaceId: null
            });
        } catch(e) {}

        // Clear local storage cache
        try {
            localStorage.removeItem('pricelister_last_workspace_id');
        } catch(e) {}
    },

    getWorkspaceMembers: async (adminUid) => {
        try {
            const membersRef = collection(db, `Workspaces/${adminUid}/Members`);
            const snap = await getDocs(membersRef);
            return snap.docs.map(d => ({ email: d.id, ...d.data() }));
        } catch (e) {
            console.warn("Error fetching workspace members:", e);
            return [];
        }
    },

    updateMetricsCounter: async (workspaceDocUid, type, isAdding, itemCreatorId = null, count = 1) => {
        if (!workspaceDocUid) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        try {
            const userEmail = currentUser.email ? currentUser.email.toLowerCase() : '';
            const isWorker = workspaceDocUid !== currentUser.uid;

            const field = (() => {
                switch (type) {
                    case 'product': return isWorker ? 'productAdded' : 'adminProductCount';
                    case 'invoice': return isWorker ? 'invoiceAdded' : 'adminInvoiceCount';
                    case 'category': return isWorker ? 'categoryAdded' : 'adminCategoryCount';
                    case 'client': return isWorker ? 'clientAdded' : 'adminClientCount';
                    case 'business': return isWorker ? 'businessAdded' : 'adminBusinessCount';
                    case 'customer': return isWorker ? 'clientAdded' : 'adminClientCount';
                    default: return null;
                }
            })();
            if (!field) return;

            const targetRef = isWorker
                ? doc(db, `Workspaces/${workspaceDocUid}/Members`, userEmail)
                : doc(db, 'Workspaces', workspaceDocUid);

            const updates = {};
            const qty = Number(count) || 1;
            if (isAdding) {
                updates[field] = increment(qty);
            } else {
                const delField = isWorker ? 'totalDeleted' : 'adminTotalDeleted';
                updates[delField] = increment(qty);
                // Decrement creation field if user created it or creator matches
                updates[field] = increment(-qty);
            }

            await updateDoc(targetRef, updates).catch(async (err) => {
                if (err.code === 'not-found') {
                    await setDoc(targetRef, updates, { merge: true });
                } else {
                    console.warn("Could not update metrics counter:", err);
                }
            });
        } catch (e) {
            console.warn("Metrics counter update error:", e);
        }
    },

    listenMemberMetrics: (workspaceDocUid, email, onUpdate) => {
        if (!workspaceDocUid) return () => {};
        const currentUser = auth.currentUser;
        const isWorker = currentUser ? (workspaceDocUid !== currentUser.uid) : false;
        
        if (isWorker && email) {
            const memberRef = doc(db, `Workspaces/${workspaceDocUid}/Members`, email.toLowerCase());
            return onSnapshot(memberRef, (snap) => {
                if (snap.exists()) {
                    onUpdate(snap.data(), false);
                }
            }, (err) => console.warn("Member metrics listen error:", err));
        } else {
            const wsRef = doc(db, 'Workspaces', workspaceDocUid);
            return onSnapshot(wsRef, (snap) => {
                if (snap.exists()) {
                    onUpdate(snap.data(), true);
                }
            }, (err) => console.warn("Workspace metrics listen error:", err));
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
            }, (err) => {
                console.warn(`Error listening to ${baseCollectionPath}:`, err);
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
