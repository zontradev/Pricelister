import { firebaseApp } from './firebase-config.js';
import { 
    getFirestore, doc, getDoc, setDoc, serverTimestamp,
    collection, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, increment,
    enableMultiTabIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { CONFIG } from '../config.js';
import { storageService } from '../supabase/storage.js';
import { getInitialDemoData } from './demoData.js';
import { WORKSPACE_ROLES, getRoleLevel, getRoleMeta } from '../DataModel.js';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

// Global Demo Sandbox Store
let demoDB = null;

export const getDemoStore = (collectionName) => {
    if (!demoDB) {
        try {
            const saved = localStorage.getItem('pricelister_demo_db_v2');
            if (saved) {
                demoDB = JSON.parse(saved);
            }
        } catch (e) {}
        if (!demoDB) {
            demoDB = getInitialDemoData();
            try {
                localStorage.setItem('pricelister_demo_db_v2', JSON.stringify(demoDB));
            } catch (e) {}
        }
    }
    
    // Normalize aliases
    let targetKey = collectionName;
    if (collectionName === 'Invoices' || collectionName === 'CustomerInvoices') {
        targetKey = (demoDB && demoDB['Invoices']) ? 'Invoices' : 'CustomerInvoices';
    } else if (collectionName === 'BusinessProfiles' || collectionName === 'Businesses') {
        targetKey = (demoDB && demoDB['BusinessProfiles']) ? 'BusinessProfiles' : 'Businesses';
    } else if (collectionName === 'ClientProfiles' || collectionName === 'Clients' || collectionName === 'Customers') {
        targetKey = (demoDB && demoDB['ClientProfiles']) ? 'ClientProfiles' : 'Clients';
    }

    if (!demoDB[targetKey]) {
        demoDB[targetKey] = [];
    }
    return demoDB[targetKey];
};

export const saveDemoStore = () => {
    if (demoDB) {
        try {
            localStorage.setItem('pricelister_demo_db_v2', JSON.stringify(demoDB));
        } catch (e) {}
    }
};

export const resetDemoSandbox = () => {
    demoDB = getInitialDemoData();
    saveDemoStore();
};

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
        const isExplicitDemo = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('pricelister_explicit_demo') === 'true') ||
                               (typeof localStorage !== 'undefined' && localStorage.getItem('pricelister_demo_mode') === 'true') ||
                               (typeof window !== 'undefined' && window.location.href.toLowerCase().includes('demo=true'));

        // Purely local mock session or explicit demo request bypass (Only for dev-mock-uid or explicit demo)
        if (uid === 'dev-mock-uid' && isExplicitDemo) {
            let mockSaved = {};
            try {
                const raw = localStorage.getItem('pricelister_mock_settings');
                if (raw) mockSaved = JSON.parse(raw) || {};
            } catch (e) {}

            return {
                id: 'ws_dev_mock',
                workspaceId: 'DEMO-SANDBOX-01',
                name: mockSaved.name || mockSaved.shopName || 'PriceLister Demo Enterprise',
                description: mockSaved.description || mockSaved.tagline || 'UI Testing Sandbox',
                email: email || mockSaved.email || 'developer@local.test',
                adminEmail: 'developer@local.test',
                role: 'CREATOR_ADMIN',
                currency: mockSaved.currencySymbol || mockSaved.currency || '$',
                currencySymbol: mockSaved.currencySymbol || mockSaved.currency || '$',
                phone: mockSaved.phone || '+1 (555) 019-2834',
                address: mockSaved.address || '100 Silicon Way, Suite 400, San Jose, CA',
                isTestData: true,
                ...mockSaved
            };
        }

        const activeWsKey = localStorage.getItem('pricelister_active_ws');

        try {
            // Helper to build workspace payload with rock-solid permission protections
            const buildWorkspacePayload = (wsId, wsData, role, memberData = null) => {
                const isCreator = role === 'CREATOR_ADMIN' || wsData.role === 'CREATOR_ADMIN';
                const isCoAdmin = role === 'CO_ADMIN' || role === 'COADMIN' || wsData.role === 'CO_ADMIN' || wsData.role === 'COADMIN';
                const isPrivileged = isCreator || isCoAdmin;
                const mem = memberData || {};
                
                // Temporary Access Revocation evaluation:
                // Check if accessRevoked is active and current time is within revokeStart and revokeEnd
                const now = Date.now();
                let isAccessBlocked = false;
                if (!isPrivileged && mem.accessRevoked) {
                    const start = Number(mem.revokeStart) || 0;
                    const end = Number(mem.revokeEnd) || Infinity;
                    if (now >= start && now <= end) {
                        isAccessBlocked = true;
                    }
                }

                return {
                    id: wsId,
                    ...wsData,
                    role: isCreator ? 'CREATOR_ADMIN' : role,
                    // Safety: Creator Admin & Co-Admin are ALWAYS completely unrestricted
                    cannotSeeCost: isPrivileged ? false : Boolean(mem.cannotSeeCost),
                    cannotSeeProfit: isPrivileged ? false : Boolean(mem.cannotSeeProfit),
                    disableAdd: isPrivileged ? false : Boolean(mem.disableAdd),
                    disableDeleteOthers: isPrivileged ? false : Boolean(mem.disableDeleteOthers),
                    disableUpdateOthers: isPrivileged ? false : Boolean(mem.disableUpdateOthers),
                    disableUpdate: isPrivileged ? false : Boolean(mem.disableUpdate),
                    disableDelete: isPrivileged ? false : Boolean(mem.disableDelete),
                    isRestricted: isPrivileged ? false : Boolean(mem.isRestricted || mem.cannotSeeCost || mem.cannotSeeProfit || mem.disableAdd || mem.disableDeleteOthers || mem.disableUpdateOthers || mem.disableUpdate || mem.disableDelete),

                    // Temporary Access Revoke payload
                    accessRevoked: isPrivileged ? false : Boolean(mem.accessRevoked),
                    revokeStart: isPrivileged ? null : (mem.revokeStart || null),
                    revokeEnd: isPrivileged ? null : (mem.revokeEnd || null),
                    revokeStartFormatted: isPrivileged ? null : (mem.revokeStartFormatted || (mem.revokeStart ? new Date(mem.revokeStart).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')),
                    revokeEndFormatted: isPrivileged ? null : (mem.revokeEndFormatted || (mem.revokeEnd ? new Date(mem.revokeEnd).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '')),
                    revokeReason: isPrivileged ? null : (mem.revokeReason || 'Temporary Access Blocked by Workspace Administrator'),
                    isAccessBlocked: isPrivileged ? false : isAccessBlocked
                };
            };

            // 1. If user previously switched to a specific active workspace, load it first
            if (activeWsKey && activeWsKey !== 'ws_dev_mock' && activeWsKey !== 'demo') {
                try {
                    const activeDocRef = doc(db, 'Workspaces', activeWsKey);
                    const activeSnap = await getDoc(activeDocRef);
                    if (activeSnap.exists()) {
                        const wsData = activeSnap.data();
                        let realRole = 'WORKER';
                        let memberData = null;
                        if (activeWsKey === uid || wsData.adminUid === uid || (wsData.email && wsData.email.toLowerCase() === (email || '').toLowerCase()) || (wsData.adminEmail && wsData.adminEmail.toLowerCase() === (email || '').toLowerCase())) {
                            realRole = 'CREATOR_ADMIN';
                        } else if (email) {
                            try {
                                const memberRef = doc(db, `Workspaces/${activeWsKey}/Members`, email.toLowerCase());
                                const memberSnap = await getDoc(memberRef);
                                if (memberSnap.exists()) {
                                    memberData = memberSnap.data();
                                    if (memberData.role) realRole = memberData.role;
                                }
                            } catch (mErr) {
                                console.warn("Member role check warning:", mErr);
                            }
                        }
                        return buildWorkspacePayload(activeSnap.id, wsData, realRole, memberData);
                    }
                } catch (activeErr) {
                    console.warn("Could not load requested active workspace, falling back to default:", activeErr);
                    localStorage.removeItem('pricelister_active_ws');
                }
            }

            // 2. Check if user is an Admin (Workspace ID == UID)
            if (uid) {
                const wsRef = doc(db, 'Workspaces', uid);
                const wsSnap = await getDoc(wsRef);
                if (wsSnap.exists()) {
                    return buildWorkspacePayload(wsSnap.id, wsSnap.data(), 'CREATOR_ADMIN', null);
                }

                // 3. If not admin, check if they are a Verified Worker in Connections
                const connRef = doc(db, 'Connections', uid);
                const connSnap = await getDoc(connRef);
                if (connSnap.exists() && connSnap.data().adminUid) {
                    const adminUid = connSnap.data().adminUid;
                    const workerWsRef = doc(db, 'Workspaces', adminUid);
                    const workerWsSnap = await getDoc(workerWsRef);
                    if (workerWsSnap.exists()) {
                        let realRole = connSnap.data().role || 'WORKER';
                        let memberData = null;
                        if (email) {
                            try {
                                const memberRef = doc(db, `Workspaces/${adminUid}/Members`, email.toLowerCase());
                                const memberSnap = await getDoc(memberRef);
                                if (memberSnap.exists()) {
                                    memberData = memberSnap.data();
                                    if (memberData.role) realRole = memberData.role;
                                }
                            } catch (err) {
                                console.error("Error fetching member real role:", err);
                            }
                        }
                        return buildWorkspacePayload(workerWsSnap.id, workerWsSnap.data(), realRole, memberData);
                    }
                }
            }

            // 4. Query by email if uid is not passed or no direct UID match
            if (email) {
                try {
                    const cleanEmail = email.trim().toLowerCase();
                    const wsQuery = query(collection(db, 'Workspaces'), where('email', '==', cleanEmail));
                    const wsSnap = await getDocs(wsQuery);
                    if (!wsSnap.empty) {
                        return buildWorkspacePayload(wsSnap.docs[0].id, wsSnap.docs[0].data(), 'CREATOR_ADMIN', null);
                    }
                    const adminQuery = query(collection(db, 'Workspaces'), where('adminEmail', '==', cleanEmail));
                    const adminSnap = await getDocs(adminQuery);
                    if (!adminSnap.empty) {
                        return buildWorkspacePayload(adminSnap.docs[0].id, adminSnap.docs[0].data(), 'CREATOR_ADMIN', null);
                    }
                } catch (e) {
                    console.warn("Could not query workspace by email:", e);
                }
            }

            return null;
        } catch (error) {
            console.error("Error checking workspace:", error);
            throw error;
        }
    },

    checkUserHasWorkspace: async (email) => {
        if (!email || email === 'developer@local.test') return false;
        try {
            const cleanEmail = email.trim().toLowerCase();
            const wsQuery = query(collection(db, 'Workspaces'), where('email', '==', cleanEmail));
            const wsSnap = await getDocs(wsQuery);
            if (!wsSnap.empty) return true;

            const adminQuery = query(collection(db, 'Workspaces'), where('adminEmail', '==', cleanEmail));
            const adminSnap = await getDocs(adminQuery);
            return !adminSnap.empty;
        } catch (e) {
            console.warn("checkUserHasWorkspace query warning:", e);
            return false;
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
            
            const now = new Date();
            const nowEpoch = now.getTime();
            const nowIso = now.toISOString();
            const nowFormatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const adminNameResolved = workspaceData.adminName || (email ? email.split('@')[0] : "Admin");

            // 1. Create Workspace Doc matching schema with creation timestamps and audit info
            const workspaceRef = doc(db, 'Workspaces', documentId);
            const wsDocData = {
                workspaceId: newWorkspaceId,
                name: (workspaceData.name || "").trim(),
                tradeName: (workspaceData.tradeName || workspaceData.shopName || workspaceData.name || "").trim(),
                industry: workspaceData.industry || "General",
                tagline: (workspaceData.tagline || workspaceData.description || "").trim(),
                description: (workspaceData.description || workspaceData.tagline || "Main").trim(),
                website: (workspaceData.website || "").trim(),
                taxId: (workspaceData.taxId || "").trim(),
                phone: workspaceData.phone || "",
                supportPhone: workspaceData.supportPhone || "",
                address: workspaceData.address || "",
                country: (workspaceData.country || workspaceData.countryName || "").trim(),
                countryCode: (workspaceData.countryCode || "").trim(),
                countryName: (workspaceData.countryName || workspaceData.country || "").trim(),
                operatedCountry: (workspaceData.operatedCountry || workspaceData.countryName || workspaceData.country || "").trim(),
                region: (workspaceData.region || "").trim(),
                email: workspaceData.email || email || "",
                adminEmail: email || workspaceData.adminEmail || "",
                adminName: adminNameResolved,
                adminId: workspaceData.adminId || adminWorkerId,
                workspaceRole: 0,
                roleTag: (workspaceData.roleTag || "Administrator").trim(),
                workspaceStatus: "Active",
                
                // Creation Metadata
                createdAt: nowEpoch,
                createdTimestamp: nowIso,
                createdDate: nowFormatted,
                creatorEmail: email || "",
                creatorUid: uid,
                creatorName: adminNameResolved,

                // Last Updated Audit Info
                updatedAt: nowEpoch,
                updateTimestamp: nowIso,
                updatedDate: nowFormatted,
                updatorEmail: email || "",
                updatorUid: uid,
                updatorName: adminNameResolved,
                updatorRole: 'CREATOR_ADMIN',

                // Security & Versioning
                schemaVersion: '2.0.0',
                securityVersion: 2,
                isProtected: true,

                workersCount: 1,
                adminProductCount: 0,
                adminInvoiceCount: 0,
                adminCategoryCount: 0,
                adminBusinessCount: 0,
                adminClientCount: 0,
                adminTotalDeleted: 0,
                adminTotalDeletedCount: 0,
                currencyCode: (workspaceData.currencyCode || "USD").trim().toUpperCase(),
                currencyName: (workspaceData.currencyName || "").trim(),
                currency: (workspaceData.currency || workspaceData.currencySymbol || "$").trim().substring(0, 3) || "$",
                currencySymbol: (workspaceData.currencySymbol || workspaceData.currency || "$").trim().substring(0, 3) || "$",
                logoUrl: workspaceData.logoUrl || workspaceData.logo || "",
                logo: workspaceData.logoUrl || workspaceData.logo || "",
                bannerUrl: workspaceData.bannerUrl || workspaceData.banner || "",
                banner: workspaceData.bannerUrl || workspaceData.banner || ""
            };

            await setDoc(workspaceRef, wsDocData);

            // 2. Add Creator Member Record in Members subcollection
            if (email) {
                const adminMemberRef = doc(db, `Workspaces/${documentId}/Members`, email.toLowerCase());
                await setDoc(adminMemberRef, {
                    status: "Joined",
                    workerUid: uid,
                    appWorkerId: adminWorkerId,
                    joinedAt: nowEpoch,
                    name: adminNameResolved,
                    email: email.toLowerCase(),
                    role: "ADMIN",
                    workspaceRole: 0,
                    roleTag: (workspaceData.roleTag || "Administrator").trim(),
                    isCreator: true,
                    canViewProfit: true,
                    isRestricted: false,
                    disableDelete: false,
                    disableUpdate: false,
                    disableAdd: false,
                    productAdded: 0,
                    invoiceAdded: 0
                }, { merge: true });
            }
            
            // 3. Initialize ReceiptData with Currency & Shop Details
            const receiptRef = doc(db, 'ReceiptData', documentId);
            await setDoc(receiptRef, {
                "Vending": false,
                "Shop Name": (workspaceData.tradeName || workspaceData.name || "").trim(),
                "Address / Subtitle": workspaceData.address || "",
                "Phone Number": workspaceData.phone || "",
                "End Massage": "",
                "Customer Name": true,
                "Customer number": true,
                "Country": (workspaceData.country || workspaceData.countryName || "").trim(),
                "Currency": (workspaceData.currency || workspaceData.currencySymbol || "$").trim().substring(0, 3) || "$",
                "CurrencyCode": (workspaceData.currencyCode || "USD").trim().toUpperCase(),
                "CurrencyName": (workspaceData.currencyName || "").trim(),
                "Logo Url": workspaceData.logoUrl || workspaceData.logo || "",
                "Banner Url": workspaceData.bannerUrl || workspaceData.banner || "",
                "created_timestamp": nowIso,
                "created_date": nowFormatted,
                "updated_timestamp": nowIso,
                "updated_by_email": email || "",
                "last_updated": now
            }, { merge: true });

            // 4. Update User Profile in userCollection
            const userRef = doc(db, 'userCollection', uid);
            await setDoc(userRef, {
                email: email,
                role: 'CREATOR_ADMIN',
                workspaceRole: 0,
                roleTag: (workspaceData.roleTag || "Administrator").trim(),
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
        if (uid === 'dev-mock-uid') {
            if (typeof onRoleChange === 'function') {
                onRoleChange('CREATOR_ADMIN', { role: 'CREATOR_ADMIN', name: 'Demo Admin (Testing)', email: 'developer@local.test' });
            }
            return () => {};
        }
        
        let unsubMember = null;
        let unsubConn = null;

        // Check if Admin
        const wsRef = doc(db, 'Workspaces', uid);
        const unsubWs = onSnapshot(wsRef, (snap) => {
            if (snap.exists()) {
                onRoleChange('CREATOR_ADMIN', snap.data());
            } else {
                // If not admin, listen to Connections doc
                const connRef = doc(db, 'Connections', uid);
                if (unsubConn) unsubConn();
                unsubConn = onSnapshot(connRef, async (connSnap) => {
                    if (connSnap.exists()) {
                        const connData = connSnap.data();
                        const adminUid = connData.adminUid;
                        let role = connData.role || 'WORKER';
                        
                        if (email && adminUid) {
                            const cleanEmail = email.toLowerCase().trim();
                            const memberRef = doc(db, `Workspaces/${adminUid}/Members`, cleanEmail);
                            
                            if (unsubMember) unsubMember();
                            unsubMember = onSnapshot(memberRef, (memberSnap) => {
                                if (!memberSnap.exists()) {
                                    // Member was removed from workspace
                                    console.warn("[Realtime Security] Member document removed from workspace");
                                    onRoleChange(null, null);
                                } else {
                                    const mData = memberSnap.data();
                                    const isBlocked = Boolean(mData.isAccessBlocked || mData.accessRevoked || mData.status === 'revoked' || mData.status === 'blocked');
                                    onRoleChange(mData.role || role, {
                                        ...connData,
                                        ...mData,
                                        isAccessBlocked: isBlocked
                                    });
                                }
                            }, (mErr) => {
                                console.warn("Member snapshot error:", mErr);
                                onRoleChange(role, connData);
                            });
                        } else {
                            onRoleChange(role, connData);
                        }
                    } else {
                        onRoleChange(null, null);
                    }
                }, (err) => console.warn("Conn listen error:", err));
            }
        }, (err) => console.warn("Ws listen error:", err));

        return () => {
            if (unsubWs) unsubWs();
            if (unsubConn) unsubConn();
            if (unsubMember) unsubMember();
        };
    },

    // ---------------------------------------------
    // INVITATION SYSTEM (Mailbox Parity)
    // ---------------------------------------------
    getPendingInvites: async (email) => {
        if (!email || email === 'developer@local.test') return [];
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
            const roleLevel = invite.workspaceRole !== undefined ? Number(invite.workspaceRole) : getRoleLevel(invite.role || 'WORKER');
            const roleMeta = getRoleMeta(roleLevel);
            const roleTagResolved = invite.roleTag || roleMeta.defaultTag;

            // 1. Create Connection Document
            await setDoc(doc(db, 'Connections', user.uid), {
                adminUid: invite.adminUid,
                adminEmail: invite.adminEmail || '',
                role: roleMeta.id,
                workspaceRole: roleLevel,
                roleTag: roleTagResolved
            });

            // 2. Add User to Workspace Members Collection
            await setDoc(doc(db, `Workspaces/${invite.adminUid}/Members`, user.email.toLowerCase()), {
                status: "Joined",
                workerUid: user.uid,
                appWorkerId: workerId,
                joinedAt: Date.now(),
                name: user.displayName || user.email,
                email: user.email.toLowerCase(),
                role: roleMeta.id,
                workspaceRole: roleLevel,
                roleTag: roleTagResolved,
                canViewProfit: !Boolean(invite.cannotSeeProfit),
                cannotSeeCost: Boolean(invite.cannotSeeCost),
                cannotSeeProfit: Boolean(invite.cannotSeeProfit),
                isRestricted: Boolean(invite.isRestricted || invite.cannotSeeCost || invite.cannotSeeProfit),
                disableDelete: Boolean(invite.disableDelete),
                disableUpdate: Boolean(invite.disableUpdate),
                disableAdd: Boolean(invite.disableAdd),
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
        if (!email || email === 'developer@local.test') {
            if (typeof callback === 'function') callback([]);
            return () => {};
        }
        const q = query(collection(db, 'Invites'), where('workerEmail', '==', email.toLowerCase()));
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(list);
        }, (err) => console.warn("Invites listen error:", err));
    },

    checkUserWorkspaceConnection: async (user) => {
        if (!user || (!user.uid && !user.email)) return { isConnected: false };
        const uid = user.uid;
        const email = (user.email || '').toLowerCase();
        
        // Demo mode check
        if (uid === 'dev-mock-uid' || email === 'developer@local.test') {
            return { isConnected: true, workspaceId: 'DEMO-SANDBOX-01', role: 'CREATOR_ADMIN' };
        }

        try {
            // Check if user is creator/admin of a workspace
            if (uid) {
                const adminWs = await getDoc(doc(db, 'Workspaces', uid));
                if (adminWs.exists()) {
                    return { isConnected: true, workspaceId: adminWs.data().workspaceId || uid, role: 'ADMIN' };
                }
            }

            // Check if user has an active connection document
            if (uid) {
                const connSnap = await getDoc(doc(db, 'Connections', uid));
                if (connSnap.exists() && connSnap.data()?.adminUid) {
                    return { isConnected: true, workspaceId: connSnap.data().adminUid, role: connSnap.data().role || 'WORKER' };
                }
            }

            // Check if user is in any demo local connections
            const demoConn = localStorage.getItem('pricelister_demo_connection_' + (email || uid));
            if (demoConn) {
                const parsed = JSON.parse(demoConn);
                if (parsed && parsed.workspaceId) {
                    return { isConnected: true, workspaceId: parsed.workspaceId, role: parsed.role || 'WORKER' };
                }
            }

            return { isConnected: false };
        } catch (e) {
            console.warn("Connection check failed:", e);
            return { isConnected: false };
        }
    },

    createJoinRequest: async (workspaceDocId, user) => {
        if (!user || !user.email) throw new Error("A valid email address is required to request joining.");
        const email = user.email.toLowerCase();
        const requestData = {
            uid: user.uid || ('req_' + Date.now()),
            email: email,
            displayName: user.displayName || user.name || email.split('@')[0],
            photoURL: user.photoURL || '',
            requestedAt: Date.now(),
            status: 'PENDING',
            workspaceDocId: workspaceDocId
        };

        // Try Firestore
        try {
            await setDoc(doc(db, `Workspaces/${workspaceDocId}/JoinRequests`, email), requestData, { merge: true });
        } catch (e) {
            console.warn("Firestore join request save failed, using local/demo store:", e);
        }

        // Always save to demo/local store for seamless local and offline testing
        try {
            const key = `pricelister_join_requests_${workspaceDocId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = existing.filter(r => (r.email || '').toLowerCase() !== email);
            filtered.unshift(requestData);
            localStorage.setItem(key, JSON.stringify(filtered));
        } catch (err) {}

        return requestData;
    },

    listenJoinRequests: (workspaceDocId, callback) => {
        if (!workspaceDocId) return () => {};

        const localKey = `pricelister_join_requests_${workspaceDocId}`;
        const readLocal = () => {
            try {
                const list = JSON.parse(localStorage.getItem(localKey) || '[]');
                return list.filter(r => r.status === 'PENDING');
            } catch (e) { return []; }
        };

        // If in mock or offline
        if (workspaceDocId === 'ws_dev_mock' || workspaceDocId === 'DEMO-SANDBOX-01' || workspaceDocId === 'dev-mock-uid') {
            callback(readLocal());
            const interval = setInterval(() => callback(readLocal()), 2000);
            return () => clearInterval(interval);
        }

        try {
            const q = collection(db, `Workspaces/${workspaceDocId}/JoinRequests`);
            return onSnapshot(q, (snap) => {
                const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === 'PENDING');
                const localList = readLocal();
                const mergedMap = new Map();
                firestoreList.forEach(item => mergedMap.set(item.email.toLowerCase(), item));
                localList.forEach(item => {
                    if (!mergedMap.has(item.email.toLowerCase())) {
                        mergedMap.set(item.email.toLowerCase(), item);
                    }
                });
                callback(Array.from(mergedMap.values()));
            }, (err) => {
                console.warn("Join requests listener fallback to local:", err);
                callback(readLocal());
            });
        } catch (e) {
            callback(readLocal());
            return () => {};
        }
    },

    approveJoinRequest: async (workspaceDocId, request) => {
        if (!workspaceDocId || !request || !request.email) throw new Error("Invalid request");
        const email = request.email.toLowerCase();
        const workerId = (request.uid || 'usr_' + Date.now()).substring(0, 8);

        // 1. Add to Members subcollection
        const memberData = {
            status: "Joined",
            workerUid: request.uid || ('uid_' + Date.now()),
            appWorkerId: workerId,
            joinedAt: Date.now(),
            name: request.displayName || email.split('@')[0],
            email: email,
            photoURL: request.photoURL || '',
            role: "WORKER",
            workspaceRole: 3,
            roleTag: "Worker",
            canViewProfit: false,
            cannotSeeCost: false,
            cannotSeeProfit: false,
            isRestricted: false,
            disableDelete: false,
            disableUpdate: false,
            disableAdd: false,
            productAdded: 0,
            invoiceAdded: 0
        };

        try {
            await setDoc(doc(db, `Workspaces/${workspaceDocId}/Members`, email), memberData, { merge: true });
            
            // 2. Create Connection doc
            if (request.uid) {
                await setDoc(doc(db, 'Connections', request.uid), {
                    adminUid: workspaceDocId,
                    role: 'WORKER',
                    workspaceRole: 3,
                    roleTag: 'Worker',
                    email: email,
                    name: memberData.name
                }, { merge: true });
            }

            // 3. Update JoinRequest status or remove
            await deleteDoc(doc(db, `Workspaces/${workspaceDocId}/JoinRequests`, email)).catch(() => {});
            
            // 4. Increment workersCount
            await updateDoc(doc(db, 'Workspaces', workspaceDocId), {
                workersCount: increment(1)
            }).catch(() => {});
        } catch (e) {
            console.warn("Firestore approve failed, updating local/demo state:", e);
        }

        // Update local/demo storage
        try {
            const key = `pricelister_join_requests_${workspaceDocId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = existing.filter(r => (r.email || '').toLowerCase() !== email);
            localStorage.setItem(key, JSON.stringify(updated));

            // Mark connection locally
            localStorage.setItem('pricelister_demo_connection_' + email, JSON.stringify({
                workspaceId: workspaceDocId,
                role: 'WORKER'
            }));
            if (request.uid) {
                localStorage.setItem('pricelister_demo_connection_' + request.uid, JSON.stringify({
                    workspaceId: workspaceDocId,
                    role: 'WORKER'
                }));
            }
        } catch (err) {}

        return memberData;
    },

    rejectJoinRequest: async (workspaceDocId, requestEmail) => {
        if (!workspaceDocId || !requestEmail) return;
        const email = requestEmail.toLowerCase();
        try {
            await deleteDoc(doc(db, `Workspaces/${workspaceDocId}/JoinRequests`, email)).catch(() => {});
        } catch (e) {}

        try {
            const key = `pricelister_join_requests_${workspaceDocId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const updated = existing.filter(r => (r.email || '').toLowerCase() !== email);
            localStorage.setItem(key, JSON.stringify(updated));
        } catch (err) {}
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
            'ReceiptData',
            'Templates',
            'CodeTemplates',
            'CodeSequences',
            'CodeReservations',
            'CodeHistory',
            'CodeBatches',
            'FinanceAccounts',
            'FinanceTransactions',
            'EmiAccounts',
            'EmiPayments'
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

    // ---------------------------------------------
    // EMAIL SENDER & USER MAILBOX NOTIFICATIONS
    // ---------------------------------------------
    sendEmailNotification: async ({ to, subject, html, text, type = 'general', metadata = {} }) => {
        if (!to) return;
        try {
            const cleanEmail = to.trim().toLowerCase();
            const emailDoc = {
                to: [cleanEmail],
                message: {
                    subject: subject,
                    html: html || '',
                    text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
                },
                type: type,
                metadata: metadata,
                createdAt: Date.now(),
                createdIso: new Date().toISOString()
            };

            // 1. Standard Firebase Trigger Email collection ('mail')
            await addDoc(collection(db, 'mail'), emailDoc).catch(e => console.warn("Firestore mail write warning:", e));

            // 2. User Mailbox Notifications subcollection for immediate in-app visibility
            await addDoc(collection(db, `userMailbox/${cleanEmail}/messages`), {
                subject,
                body: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
                html: html || '',
                type,
                metadata,
                read: false,
                timestamp: Date.now(),
                dateFormatted: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            }).catch(e => console.warn("userMailbox write warning:", e));
        } catch (err) {
            console.warn("sendEmailNotification error:", err);
        }
    },

    notifyWorkerRemoved: async (workspaceName, workerEmail, adminEmail) => {
        const wsName = workspaceName || 'PriceLister Workspace';
        const subject = `"${wsName}" Administrator removed you from their Workspace`;
        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1.5px solid #e4e4e7; border-radius: 16px; background: #ffffff;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;">&times;</div>
                    <h2 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #09090b;">Workspace Removal Notice</h2>
                </div>
                <p style="color: #27272a; font-size: 0.95rem; line-height: 1.5; margin-bottom: 14px;">
                    This is an automated notification to inform you that the administrator of <strong>${wsName}</strong> (${adminEmail || 'Administrator'}) has removed you from their workspace.
                </p>
                <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px;">
                    <div style="font-size: 0.78rem; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Status</div>
                    <div style="font-size: 0.88rem; font-weight: 800; color: #dc2626; margin-top: 2px;">Session Terminated &amp; Privileges Revoked</div>
                </div>
                <p style="color: #71717a; font-size: 0.82rem; line-height: 1.5; margin-bottom: 0;">
                    Your workspace membership and active session have been cleared. If you believe this action was made in error, please contact the workspace administrator directly.
                </p>
                <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 0.76rem; color: #a1a1aa; display: flex; justify-content: space-between;">
                    <span>PriceLister Security System</span>
                    <span>${new Date().toLocaleDateString()}</span>
                </div>
            </div>
        `;
        return firestoreService.sendEmailNotification({
            to: workerEmail,
            subject,
            html,
            text: `"${wsName}" Administrator removed you from their Workspace. Your access has been revoked.`,
            type: 'worker_removed',
            metadata: { workspaceName: wsName, adminEmail, removedAt: Date.now() }
        });
    },

    getUserMailboxMessages: async (email) => {
        if (!email || email === 'developer@local.test') return [];
        try {
            const cleanEmail = email.trim().toLowerCase();
            const coll = collection(db, `userMailbox/${cleanEmail}/messages`);
            const snap = await getDocs(coll);
            const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            return messages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch (e) {
            console.warn("getUserMailboxMessages error:", e);
            return [];
        }
    },

    getWorkspaceMembers: async (adminUid) => {
        if (adminUid === 'ws_dev_mock' || adminUid === 'dev-mock-uid' || !adminUid) {
            try {
                const rawMock = localStorage.getItem('pricelister_mock_members');
                if (rawMock) {
                    const parsed = JSON.parse(rawMock);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) {}

            const defaultMockMembers = [
                {
                    email: 'developer@local.test',
                    name: 'Demo Admin (Testing)',
                    role: 'ADMIN',
                    workspaceRole: 0,
                    roleTag: 'Founder',
                    status: 'Joined',
                    isCreator: true,
                    canViewProfit: true,
                    isRestricted: false,
                    joinedAt: Date.now() - 86400000 * 30,
                    productAdded: 14,
                    invoiceAdded: 22,
                    totalDeleted: 0
                },
                {
                    email: 'sarah.coadmin@pricelister.app',
                    name: 'Sarah Jenkins',
                    role: 'CO_ADMIN',
                    workspaceRole: 1,
                    roleTag: 'Co-Founder',
                    status: 'Joined',
                    isCreator: false,
                    canViewProfit: true,
                    isRestricted: false,
                    joinedAt: Date.now() - 86400000 * 15,
                    productAdded: 8,
                    invoiceAdded: 9,
                    totalDeleted: 1
                },
                {
                    email: 'marcus.manager@pricelister.app',
                    name: 'Marcus Vance',
                    role: 'MANAGER',
                    workspaceRole: 2,
                    roleTag: 'Store Manager',
                    status: 'Joined',
                    isCreator: false,
                    canViewProfit: false,
                    isRestricted: false,
                    joinedAt: Date.now() - 86400000 * 10,
                    productAdded: 5,
                    invoiceAdded: 14,
                    totalDeleted: 0
                },
                {
                    email: 'alex.worker@pricelister.app',
                    name: 'Alex Taylor',
                    role: 'WORKER',
                    workspaceRole: 3,
                    roleTag: 'Staff',
                    status: 'Joined',
                    isCreator: false,
                    canViewProfit: false,
                    isRestricted: false,
                    joinedAt: Date.now() - 86400000 * 5,
                    productAdded: 2,
                    invoiceAdded: 6,
                    totalDeleted: 0
                },
                {
                    email: 'olivia.visitor@pricelister.app',
                    name: 'Olivia Guest',
                    role: 'VISITOR',
                    workspaceRole: 4,
                    roleTag: 'Visitor',
                    status: 'Joined',
                    isCreator: false,
                    canViewProfit: false,
                    isRestricted: true,
                    disableAdd: true,
                    disableUpdate: true,
                    disableDelete: true,
                    joinedAt: Date.now() - 86400000 * 2,
                    productAdded: 0,
                    invoiceAdded: 0,
                    totalDeleted: 0
                }
            ];

            try {
                localStorage.setItem('pricelister_mock_members', JSON.stringify(defaultMockMembers));
            } catch (e) {}

            return defaultMockMembers;
        }
        try {
            const membersRef = collection(db, `Workspaces/${adminUid}/Members`);
            const snap = await getDocs(membersRef);
            return snap.docs.map(d => ({ email: d.id, ...d.data() }));
        } catch (e) {
            console.warn("Error fetching workspace members:", e);
            return [];
        }
    },

    updateWorkspaceMember: async (workspaceDocUid, memberEmail, updates = {}) => {
        if (!workspaceDocUid || !memberEmail) return false;
        const cleanEmail = memberEmail.toLowerCase().trim();

        // 1. Mock support
        if (workspaceDocUid === 'ws_dev_mock' || workspaceDocUid === 'dev-mock-uid') {
            try {
                const rawMock = localStorage.getItem('pricelister_mock_members');
                if (rawMock) {
                    const parsed = JSON.parse(rawMock);
                    const idx = parsed.findIndex(m => (m.email || '').toLowerCase() === cleanEmail);
                    if (idx >= 0) {
                        parsed[idx] = { ...parsed[idx], ...updates };
                        localStorage.setItem('pricelister_mock_members', JSON.stringify(parsed));
                    }
                }
            } catch (e) {}
            return true;
        }

        // 2. Real Firestore
        try {
            const memberRef = doc(db, `Workspaces/${workspaceDocUid}/Members`, cleanEmail);
            await setDoc(memberRef, updates, { merge: true });

            // ONLY sync root Workspace doc IF the member is genuinely the Creator/Admin
            const isCurrentAdmin = (auth.currentUser && auth.currentUser.uid === workspaceDocUid) || updates.isAdmin === true;
            if (isCurrentAdmin) {
                const rootWsUpdates = {};
                if (updates.roleTag) rootWsUpdates.adminRoleTag = updates.roleTag;
                if (updates.photoURL) rootWsUpdates.adminPhotoURL = updates.photoURL;
                if (updates.name) rootWsUpdates.adminName = updates.name;

                if (Object.keys(rootWsUpdates).length > 0) {
                    try {
                        const wsRef = doc(db, 'Workspaces', workspaceDocUid);
                        await setDoc(wsRef, rootWsUpdates, { merge: true });
                    } catch (e) {}
                }
            }
            return true;
        } catch (err) {
            console.warn("Error updating workspace member in Firestore:", err);
            return false;
        }
    },

    updateMetricsCounter: async (workspaceDocUid, type, isAdding, itemCreatorId = null, count = 1) => {
        if (!workspaceDocUid || workspaceDocUid === 'ws_dev_mock') return;
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
        if (workspaceDocUid === 'ws_dev_mock') {
            if (typeof onUpdate === 'function') {
                onUpdate({
                    adminProductCount: 12,
                    adminInvoiceCount: 16,
                    adminCategoryCount: 4,
                    adminClientCount: 6,
                    adminBusinessCount: 4,
                    workersCount: 1
                }, true);
            }
            return () => {};
        }
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
    // For local dev / UI testing sandbox
    if (workspaceId === 'ws_dev_mock') {
        return {
            getAll: async () => {
                const store = getDemoStore(collectionName);
                return JSON.parse(JSON.stringify(store));
            },
            listenAll: (callback) => {
                const store = getDemoStore(collectionName);
                callback(JSON.parse(JSON.stringify(store)));
                return () => {}; // mock unsubscribe
            },
            getById: async (id) => {
                const store = getDemoStore(collectionName);
                const item = store.find(i => i.id === id || i.uniqueId === id);
                return item ? JSON.parse(JSON.stringify(item)) : null;
            },
            add: async (data) => {
                const store = getDemoStore(collectionName);
                const id = data.id || `demo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                const item = { ...data, id, uniqueId: data.uniqueId || id, createdAt: data.createdAt || new Date().toISOString() };
                store.push(item);
                saveDemoStore();
                return id;
            },
            update: async (id, data) => {
                const store = getDemoStore(collectionName);
                const idx = store.findIndex(i => i.id === id || i.uniqueId === id);
                if (idx >= 0) {
                    store[idx] = { ...store[idx], ...data, updatedTimestamp: Date.now() };
                    saveDemoStore();
                }
            },
            delete: async (id) => {
                const store = getDemoStore(collectionName);
                const idx = store.findIndex(i => i.id === id || i.uniqueId === id);
                if (idx >= 0) {
                    store.splice(idx, 1);
                    saveDemoStore();
                }
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
            // If data has an explicit id, use that document id to ensure consistency
            const docRef = data.id ? doc(collRef, String(data.id)) : doc(collRef);
            
            // Explicitly attach the id to the payload if not present, matching Android's structure
            if (data.id === null || data.id === undefined) {
                data.id = docRef.id;
            }

            await setDoc(docRef, data);
            return docRef.id;
        },
        
        update: async (id, data) => {
            const docRef = doc(db, baseCollectionPath, String(id));
            try {
                await updateDoc(docRef, {
                    ...data,
                    updatedTimestamp: serverTimestamp()
                });
            } catch (err) {
                // If the document does not exist yet (e.g. "No document to update"), use setDoc with merge: true
                if (err && (err.code === 'not-found' || (err.message && err.message.includes('No document to update')))) {
                    await setDoc(docRef, {
                        ...data,
                        id: String(id),
                        updatedTimestamp: serverTimestamp()
                    }, { merge: true });
                } else {
                    throw err;
                }
            }
        },
        
        delete: async (id) => {
            const docRef = doc(db, baseCollectionPath, id);
            await deleteDoc(docRef);
        }
    };
};
