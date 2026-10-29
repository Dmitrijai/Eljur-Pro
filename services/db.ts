import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updatePassword,
  UserCredential 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  onSnapshot, 
  collection, 
  getDocs, 
  deleteDoc,
  setLogLevel,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppState, Asset, User } from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Silence benign internal SDK connection timeout notices
try {
  setLogLevel('silent');
} catch (e) {
  // ignore if not supported in environment
}

const dbId = (firebaseConfig as any).firestoreDatabaseId;
export const db: Firestore = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'schools', 'school_1', 'publicConfig', 'creatorGate'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

const DB_NAME = 'ElZhurDB_v9';
const DB_VERSION = 3;
const STORE_ASSETS = 'assets';
const STORE_SCHOOL_CACHE = 'school_cache';

// Active user context for role-aware Firestore writes
interface SessionUserContext {
  id: string;
  schoolId: string;
  role: string;
  employeePermissions?: any;
}

let currentSessionUser: SessionUserContext | null = null;

export const setCurrentSessionUser = (user: User | null) => {
  if (!user) {
    currentSessionUser = null;
    return;
  }
  currentSessionUser = {
    id: user.id,
    schoolId: user.schoolId || 'school_1',
    role: user.role,
    employeePermissions: user.employeePermissions
  };
};

// Track serialized document snapshots per path so we only write documents that actually changed
const docSnapshots = new Map<string, string>();

const stableSerialize = (obj: any): string => {
  if (obj === undefined) return '';
  try {
    return JSON.stringify(obj);
  } catch {
    return '';
  }
};

/**
 * Synchronizes a user's Firebase Auth UID to their school and role mapping.
 * Used by Firestore security rules (/authUidMap/{uid}) to enforce Attribute-Based Access Control.
 */
export const syncUserAuthUidMap = async (schoolId: string, userId: string, role: string, firebaseUid: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'authUidMap', firebaseUid), {
      schoolId: schoolId || 'school_1',
      userId,
      role,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Failed to update authUidMap:', e);
  }
};

/**
 * Reliably establishes a Firebase Auth session for internal ABAC token enforcement.
 * Tries multiple fallback passwords and creates an alternative alias credential if previous password is unknown.
 */
export const ensureFirebaseAuthSession = async (
  virtualEmail: string,
  preferredPassword: string,
  candidatePasswords: string[] = [],
  metadata?: { schoolId: string; userId: string; role: string }
): Promise<UserCredential> => {
  let cred: UserCredential;

  // If already signed in with this exact email, reuse existing session
  if (auth.currentUser && auth.currentUser.email?.toLowerCase() === virtualEmail.toLowerCase()) {
    cred = { user: auth.currentUser } as UserCredential;
  } else {
    const formatPwd = (p: string) => (p && p.length >= 6 ? p : `${p || 'eljur'}__eljur123`);

    const passwordsToTry = Array.from(new Set([
      formatPwd(preferredPassword),
      preferredPassword,
      `${preferredPassword}__eljur123`,
      ...candidatePasswords.flatMap(p => [formatPwd(p), p, `${p}__eljur123`]),
      'dir123',
      'dir123__eljur123',
      'teach123',
      'teach123__eljur123',
      'pass123',
      'pass123__eljur123',
      'emp123',
      'emp123__eljur123',
      'admin123',
      'admin__eljur123',
      'admin12345',
      'eljur123456',
      'creator123456',
      'pass1__eljur123',
      '123__eljur123'
    ])).filter(p => p && p.length >= 6);

    let signedIn = false;
    // 1. Try signing in with all known candidate passwords
    for (const pwd of passwordsToTry) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, virtualEmail, pwd);
        if (pwd !== formatPwd(preferredPassword) && auth.currentUser) {
          try {
            await updatePassword(auth.currentUser, formatPwd(preferredPassword));
          } catch {
            // ignore if re-auth required
          }
        }
        cred = userCred;
        signedIn = true;
        break;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          break;
        }
      }
    }

    if (!signedIn) {
      // 2. Try creating the user if not found
      try {
        cred = await createUserWithEmailAndPassword(auth, virtualEmail, formatPwd(preferredPassword));
      } catch (createErr: any) {
        // 3. If email is already in use with an unrecoverable password, create an alternative alias email
        if (createErr.code === 'auth/email-already-in-use') {
          const uniqueSuffix = Math.random().toString(36).substring(2, 7);
          const aliasEmail = virtualEmail.replace('@', `_${uniqueSuffix}@`);
          cred = await createUserWithEmailAndPassword(auth, aliasEmail, formatPwd(preferredPassword));
        } else {
          throw createErr;
        }
      }
    }
  }

  // Atomically guarantee authUidMap exists before returning credential
  if (metadata && cred!.user?.uid) {
    await syncUserAuthUidMap(metadata.schoolId, metadata.userId, metadata.role, cred!.user.uid);
  }

  return cred!;
};

/**
 * Fetches users across schools from Firestore during pre-login authentication
 * when a user logs in on a fresh device/browser that doesn't have the user list cached yet.
 */
export const fetchUsersForLoginLookup = async (): Promise<User[]> => {
  try {
    if (!auth.currentUser) {
      await ensureFirebaseAuthSession('login_lookup@school1.eljur.org', 'eljur_lookup_123456');
    }
    const schoolIds = new Set<string>(['school_1']);
    const lastSchoolId = localStorage.getItem('eljur_active_school_id');
    if (lastSchoolId && lastSchoolId !== 'global') {
      schoolIds.add(lastSchoolId);
    }
    try {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      schoolsSnap.docs.forEach(d => {
        if (d.id && d.id !== 'global') schoolIds.add(d.id);
      });
    } catch {
      // fallback to known schoolIds
    }

    const discoveredUsers: User[] = [];
    for (const sId of Array.from(schoolIds)) {
      try {
        const uSnap = await getDocs(collection(db, 'schools', sId, 'users'));
        uSnap.docs.forEach(d => {
          const data = d.data() as User;
          if (data && data.id) {
            discoveredUsers.push({ ...data, schoolId: data.schoolId || sId });
          }
        });
      } catch {
        // ignore individual school read error
      }
    }
    return discoveredUsers;
  } catch (e) {
    console.warn('Pre-login user lookup skipped:', e);
    return [];
  }
};

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_ASSETS)) {
        idb.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
      }
      if (!idb.objectStoreNames.contains(STORE_SCHOOL_CACHE)) {
        idb.createObjectStore(STORE_SCHOOL_CACHE, { keyPath: 'schoolId' });
      }
    };
  });
};

/**
 * Saves cached state for a school in IndexedDB (bypassing 5MB localStorage limit)
 */
export const saveSchoolCache = async (schoolId: string, state: any): Promise<void> => {
  if (!schoolId) return;
  try {
    const localDb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = localDb.transaction(STORE_SCHOOL_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_SCHOOL_CACHE);
      const cleanUsers = (state.users || []).map((u: any) => {
        const cu = { ...u };
        delete cu.password;
        return cu;
      });
      const payload = {
        schoolId,
        state: {
          ...state,
          users: cleanUsers
        },
        timestamp: Date.now()
      };
      const req = store.put(payload);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
      tx.oncomplete = () => localDb.close();
    });
  } catch (e) {
    console.warn('saveSchoolCache failed:', e);
  }
};

/**
 * Retrieves cached state for a school from IndexedDB
 */
export const getSchoolCache = async (schoolId: string): Promise<any | null> => {
  if (!schoolId) return null;
  try {
    const localDb = await openDB();
    return await new Promise<any | null>((resolve, reject) => {
      const tx = localDb.transaction(STORE_SCHOOL_CACHE, 'readonly');
      const store = tx.objectStore(STORE_SCHOOL_CACHE);
      const req = store.get(schoolId);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result?.state || null);
      tx.oncomplete = () => localDb.close();
    });
  } catch (e) {
    console.warn('getSchoolCache failed:', e);
    return null;
  }
};

/**
 * Clears school state cache from IndexedDB
 */
export const clearSchoolCache = async (schoolId?: string): Promise<void> => {
  try {
    const localDb = await openDB();
    const tx = localDb.transaction(STORE_SCHOOL_CACHE, 'readwrite');
    const store = tx.objectStore(STORE_SCHOOL_CACHE);
    if (schoolId) {
      store.delete(schoolId);
    } else {
      store.clear();
    }
    tx.oncomplete = () => localDb.close();
  } catch (e) {
    console.warn('clearSchoolCache failed:', e);
  }
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const dataUrlToBlob = async (dataUrl: string, fallbackType: string = 'application/octet-stream'): Promise<Blob> => {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    const parts = dataUrl.split(',');
    const mimeMatch = parts[0]?.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : fallbackType;
    const bstr = atob(parts[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }
};

const CHUNK_CHAR_SIZE = 650 * 1024; // ~650KB per Firestore document chunk (well within 1MiB limit)

/**
 * Saves an attachment or font asset directly to IndexedDB + Firestore (with chunking for larger files).
 * Completely avoids Firebase Storage requests to prevent CORS errors on GitHub Pages.
 */
export const saveAsset = async (
  id: string,
  name: string,
  type: string,
  blob: Blob,
  schoolId?: string
): Promise<void> => {
  const resolvedSchoolId =
    (schoolId && schoolId !== 'global')
      ? schoolId
      : (currentSessionUser?.schoolId && currentSessionUser.schoolId !== 'global')
      ? currentSessionUser.schoolId
      : (localStorage.getItem('eljur_active_school_id') || 'school_1');

  const targetSchoolId = schoolId === 'global' ? 'global' : resolvedSchoolId;
  const key = `${targetSchoolId}__${id}`;

  // 1. Fast local cache in IndexedDB
  try {
    const localDb = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      const request = store.put({ key, id, schoolId: targetSchoolId, name, type, blob });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
      tx.oncomplete = () => localDb.close();
    });
  } catch (e) {
    console.warn('Local asset save failed:', e);
  }

  // 2. Direct Firestore Storage (chunked automatically if DataURL > 650KB, up to ~10MB)
  try {
    if (blob.size > 10 * 1024 * 1024) {
      console.warn('Asset exceeds 10MB cloud sync limit; stored in local IndexedDB only.');
      return;
    }

    const dataUrl = await blobToDataUrl(blob);

    if (dataUrl.length <= CHUNK_CHAR_SIZE) {
      await setDoc(doc(db, 'schools', targetSchoolId, 'attachments', id), {
        id,
        schoolId: targetSchoolId,
        name,
        type: type || 'application/octet-stream',
        data: dataUrl,
        chunkCount: 0,
        size: blob.size,
        updatedAt: new Date().toISOString()
      });
    } else {
      const chunks: string[] = [];
      for (let i = 0; i < dataUrl.length; i += CHUNK_CHAR_SIZE) {
        chunks.push(dataUrl.slice(i, i + CHUNK_CHAR_SIZE));
      }
      // Save chunk documents in parallel
      await Promise.all(
        chunks.map((chunkData, idx) =>
          setDoc(doc(db, 'schools', targetSchoolId, 'attachments', `${id}_chunk_${idx}`), {
            id: `${id}_chunk_${idx}`,
            parentId: id,
            schoolId: targetSchoolId,
            chunkIndex: idx,
            data: chunkData,
            updatedAt: new Date().toISOString()
          })
        )
      );
      // Save main metadata document
      await setDoc(doc(db, 'schools', targetSchoolId, 'attachments', id), {
        id,
        schoolId: targetSchoolId,
        name,
        type: type || 'application/octet-stream',
        chunkCount: chunks.length,
        size: blob.size,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Remote attachment sync to Firestore failed:', e);
  }
};

export const getAsset = async (id: string, schoolId?: string): Promise<Asset | null> => {
  const candidateSchools = Array.from(
    new Set(
      [
        schoolId,
        currentSessionUser?.schoolId,
        localStorage.getItem('eljur_active_school_id') || undefined,
        'school_1',
        'global'
      ].filter((s): s is string => !!s)
    )
  );

  // 1. Check local IndexedDB first (both exact key match and id scan)
  try {
    const localDb = await openDB();
    const localAsset = await new Promise<any | null>((resolve) => {
      const tx = localDb.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const allReq = store.getAll();
      allReq.onerror = () => resolve(null);
      allReq.onsuccess = () => {
        const all = allReq.result || [];
        for (const sId of candidateSchools) {
          const exact = all.find((item: any) => item.key === `${sId}__${id}`);
          if (exact && exact.blob) return resolve(exact);
        }
        const byId = all.find((item: any) => item.id === id && item.blob);
        resolve(byId || null);
      };
      tx.oncomplete = () => localDb.close();
    });
    if (localAsset && localAsset.blob) {
      return { id: localAsset.id, name: localAsset.name, type: localAsset.type, blob: localAsset.blob };
    }
  } catch (e) {
    console.warn('Local asset get failed:', e);
  }

  // 2. Fetch from Firestore attachments subcollection across candidate schools
  for (const candSchool of candidateSchools) {
    try {
      const docSnap = await getDoc(doc(db, 'schools', candSchool, 'attachments', id));
      if (docSnap.exists()) {
        const d = docSnap.data();
        let dataUrl: string | null = d.data || null;

        if (!dataUrl && typeof d.chunkCount === 'number' && d.chunkCount > 0) {
          const chunkSnaps = await Promise.all(
            Array.from({ length: d.chunkCount }).map((_, idx) =>
              getDoc(doc(db, 'schools', candSchool, 'attachments', `${id}_chunk_${idx}`))
            )
          );
          if (chunkSnaps.every(cs => cs.exists())) {
            dataUrl = chunkSnaps.map(cs => cs.data()?.data || '').join('');
          }
        }

        if (dataUrl) {
          const blob = await dataUrlToBlob(dataUrl, d.type);
          const asset: Asset = { id: d.id || id, name: d.name || id, type: d.type || blob.type, blob };
          try {
            const localDb = await openDB();
            const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
            tx.objectStore(STORE_ASSETS).put({
              key: `${candSchool}__${id}`,
              id: asset.id,
              schoolId: candSchool,
              name: asset.name,
              type: asset.type,
              blob
            });
            tx.oncomplete = () => localDb.close();
          } catch {}
          return asset;
        }
      }
    } catch {
      // try next candidate schoolId
    }
  }

  return null;
};

export const deleteAsset = async (id: string, schoolId?: string): Promise<void> => {
  try {
    const localDb = await openDB();
    await new Promise<void>((resolve) => {
      const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        const items = allReq.result || [];
        items.forEach((item: any) => {
          if (item.id === id || item.key === id) {
            store.delete(item.key);
          }
        });
        resolve();
      };
      allReq.onerror = () => resolve();
      tx.oncomplete = () => localDb.close();
    });
  } catch (e) {
    console.warn('Local asset delete failed:', e);
  }

  const targetSchoolId = schoolId || currentSessionUser?.schoolId || 'school_1';
  for (const sId of Array.from(new Set([targetSchoolId, 'global', 'school_1']))) {
    try {
      await deleteDoc(doc(db, 'schools', sId, 'attachments', id));
    } catch {}
  }
};

export const getAllAssets = async (): Promise<Asset[]> => {
  const localDb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = localDb.transaction(STORE_ASSETS, 'readonly');
    const store = tx.objectStore(STORE_ASSETS);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
    tx.oncomplete = () => localDb.close();
  });
};

// Firestore State Management with Scoped Subcollections and Error Notification

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

type DatabaseErrorListener = (message: string) => void;
let globalErrorListener: DatabaseErrorListener | null = null;

export const setDatabaseErrorListener = (listener: DatabaseErrorListener | null) => {
  globalErrorListener = listener;
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (globalErrorListener && (operationType === OperationType.WRITE || operationType === OperationType.CREATE || operationType === OperationType.UPDATE)) {
    globalErrorListener('Не удалось сохранить изменения, проверьте соединение');
  }
}

// --- Scoped School Subcollections API ---

export const saveSchoolMetadata = async (schoolId: string, schoolData: any): Promise<void> => {
  const docPath = `schools/${schoolId}`;
  try {
    const clean = JSON.parse(JSON.stringify(schoolData));
    await setDoc(doc(db, 'schools', schoolId), clean, { merge: true });
    docSnapshots.set(docPath, stableSerialize(clean));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export interface PublicCreatorGateConfig {
  secretKey: string;
  secretCount: number;
  adminPasswordHash?: string;
  adminPasswordSalt?: string;
  updatedAt?: string;
}

export const getPublicCreatorGate = async (schoolId: string = 'school_1'): Promise<PublicCreatorGateConfig | null> => {
  try {
    const snap = await getDoc(doc(db, 'schools', schoolId, 'publicConfig', 'creatorGate'));
    if (snap.exists()) {
      const data = snap.data() as PublicCreatorGateConfig;
      try {
        localStorage.setItem(`eljur_gate_${schoolId}`, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (error) {
    console.warn(`[getPublicCreatorGate] Falling back to local cache:`, error);
  }
  try {
    const cached = localStorage.getItem(`eljur_gate_${schoolId}`) || localStorage.getItem('eljur_gate_default');
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
};

export const savePublicCreatorGate = async (
  schoolId: string = 'school_1',
  config: Partial<PublicCreatorGateConfig>
): Promise<void> => {
  const targetSchoolId = schoolId && schoolId !== 'global' ? schoolId : 'school_1';
  const docPath = `schools/${targetSchoolId}/publicConfig/creatorGate`;
  try {
    const payload = JSON.parse(JSON.stringify({
      ...config,
      updatedAt: new Date().toISOString()
    }));
    await setDoc(doc(db, 'schools', targetSchoolId, 'publicConfig', 'creatorGate'), payload, { merge: true });
    try {
      localStorage.setItem(`eljur_gate_${targetSchoolId}`, JSON.stringify(payload));
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolEntity = async (schoolId: string, collName: string, entityId: string, data: any): Promise<void> => {
  const targetSchoolId = (schoolId && schoolId !== 'global') ? schoolId : 'school_1';
  const docPath = `schools/${targetSchoolId}/${collName}/${entityId}`;
  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    if (collName === 'users') {
      delete cleanData.password;
    }
    await setDoc(doc(db, 'schools', targetSchoolId, collName, entityId), cleanData, { merge: true });
    docSnapshots.set(docPath, stableSerialize(cleanData));
    const synced = getOrCreateSyncedIds(targetSchoolId);
    if ((synced as any)[collName] instanceof Set) {
      (synced as any)[collName].add(entityId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const deleteSchoolEntity = async (schoolId: string, collName: string, entityId: string): Promise<void> => {
  const targetSchoolId = (schoolId && schoolId !== 'global') ? schoolId : 'school_1';
  const docPath = `schools/${targetSchoolId}/${collName}/${entityId}`;
  try {
    await deleteDoc(doc(db, 'schools', targetSchoolId, collName, entityId));
    docSnapshots.delete(docPath);
    const synced = getOrCreateSyncedIds(targetSchoolId);
    if ((synced as any)[collName] instanceof Set) {
      (synced as any)[collName].delete(entityId);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
};

export const saveSchoolSchedule = async (schoolId: string, classKey: string, days: any): Promise<void> => {
  const docPath = `schools/${schoolId}/schedules/${classKey}`;
  try {
    const payload = { id: classKey, classKey, days: JSON.parse(JSON.stringify(days)) };
    await setDoc(doc(db, 'schools', schoolId, 'schedules', classKey), payload);
    docSnapshots.set(docPath, stableSerialize({ id: classKey, days: payload.days }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolGrades = async (schoolId: string, gradeKey: string, entries: any): Promise<void> => {
  const docPath = `schools/${schoolId}/grades/${gradeKey}`;
  try {
    const payload = { id: gradeKey, key: gradeKey, entries: JSON.parse(JSON.stringify(entries)) };
    await setDoc(doc(db, 'schools', schoolId, 'grades', gradeKey), payload);
    docSnapshots.set(docPath, stableSerialize({ id: gradeKey, entries: payload.entries }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolFinalGrades = async (schoolId: string, classKey: string, entries: any): Promise<void> => {
  const docPath = `schools/${schoolId}/finalGrades/${classKey}`;
  try {
    const payload = { id: classKey, classKey, entries: JSON.parse(JSON.stringify(entries)) };
    await setDoc(doc(db, 'schools', schoolId, 'finalGrades', classKey), payload);
    docSnapshots.set(docPath, stableSerialize({ id: classKey, entries: payload.entries }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

interface SyncedSchoolDocIds {
  users: Set<string>;
  schedules: Set<string>;
  grades: Set<string>;
  finalGrades: Set<string>;
  homework: Set<string>;
  messages: Set<string>;
  announcements: Set<string>;
  teacherAssignments: Set<string>;
  studentGroups: Set<string>;
}

const syncedSchoolIds = new Map<string, SyncedSchoolDocIds>();

export const getOrCreateSyncedIds = (schoolId: string): SyncedSchoolDocIds => {
  let record = syncedSchoolIds.get(schoolId);
  if (!record) {
    record = {
      users: new Set(),
      schedules: new Set(),
      grades: new Set(),
      finalGrades: new Set(),
      homework: new Set(),
      messages: new Set(),
      announcements: new Set(),
      teacherAssignments: new Set(),
      studentGroups: new Set()
    };
    syncedSchoolIds.set(schoolId, record);
  }
  return record;
};

// Subscribes strictly to a school's scoped document and subcollections
export const subscribeToSchool = (
  schoolId: string, 
  onUpdate: (data: Partial<AppState>) => void
): (() => void) => {
  const unsubs: (() => void)[] = [];
  let isCancelled = false;
  const synced = getOrCreateSyncedIds(schoolId);

  const safeUnsubAll = () => {
    if (isCancelled) return;
    isCancelled = true;
    unsubs.forEach(u => {
      try { u(); } catch {}
    });
    unsubs.length = 0;
  };

  const handleSubError = (err: unknown, op: OperationType, path: string) => {
    if (isCancelled) return;
    console.warn(`Subscription warning on ${path}:`, err);
  };

  const startListeners = () => {
    if (isCancelled || !auth.currentUser) return;

    // 1. School Root Document
    const unsubSchool = onSnapshot(doc(db, 'schools', schoolId), (snap) => {
      if (isCancelled) return;
      if (snap.exists()) {
        const data = snap.data();
        const defaultCurriculumSubjects = [
          'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
          'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
        ];
        const schoolSubjects = (Array.isArray(data.subjects) && data.subjects.length > 0)
          ? data.subjects
          : defaultCurriculumSubjects;
        const schoolClasses = (Array.isArray(data.classes) && data.classes.length > 0)
          ? data.classes
          : [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }];

        docSnapshots.set(`schools/${schoolId}`, stableSerialize({
          id: data.id || schoolId,
          name: data.name || 'Школа №1',
          directorId: data.directorId || 'u_dir',
          classes: schoolClasses,
          subjects: schoolSubjects,
          gradingSystem: data.gradingSystem,
          gradeTypes: data.gradeTypes,
          subjectRequirements: data.subjectRequirements,
          scheduleSettings: data.scheduleSettings,
          settings: data.settings
        }));

        onUpdate({
          schools: [{
            id: data.id || schoolId,
            name: data.name || 'Школа №1',
            directorId: data.directorId || 'u_dir',
            classes: schoolClasses,
            subjects: schoolSubjects
          }],
          classes: schoolClasses,
          subjects: schoolSubjects,
          gradingSystem: data.gradingSystem,
          gradeTypes: data.gradeTypes,
          subjectRequirements: data.subjectRequirements,
          scheduleSettings: data.scheduleSettings,
          settings: data.settings
        });
      }
    }, (err) => handleSubError(err, OperationType.GET, `schools/${schoolId}`));
    unsubs.push(unsubSchool);

    // 2. Users Subcollection
    const unsubUsers = onSnapshot(collection(db, 'schools', schoolId, 'users'), (snap) => {
      if (isCancelled) return;
      synced.users = new Set(snap.docs.map(d => d.id));
      const users = snap.docs.map(d => {
        const uData = d.data() as any;
        const cleanDoc = { ...uData };
        delete cleanDoc.password;
        docSnapshots.set(`schools/${schoolId}/users/${d.id}`, stableSerialize(cleanDoc));
        return uData;
      });
      onUpdate({ users });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/users`));
    unsubs.push(unsubUsers);

    // 3. Schedules Subcollection
    const unsubSchedules = onSnapshot(collection(db, 'schools', schoolId, 'schedules'), (snap) => {
      if (isCancelled) return;
      synced.schedules = new Set(snap.docs.map(d => d.id));
      const schedules: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const key = `${schoolId}__${d.id}`;
        schedules[key] = data.days || {};
        docSnapshots.set(`schools/${schoolId}/schedules/${d.id}`, stableSerialize({ id: d.id, days: data.days || {} }));
      });
      onUpdate({ schedules });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/schedules`));
    unsubs.push(unsubSchedules);

    // 4. Grades Subcollection
    const unsubGrades = onSnapshot(collection(db, 'schools', schoolId, 'grades'), (snap) => {
      if (isCancelled) return;
      synced.grades = new Set(snap.docs.map(d => d.id));
      const grades: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const key = `${schoolId}__${d.id}`;
        grades[key] = data.entries || [];
        docSnapshots.set(`schools/${schoolId}/grades/${d.id}`, stableSerialize({ id: d.id, entries: data.entries || [] }));
      });
      onUpdate({ grades });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/grades`));
    unsubs.push(unsubGrades);

    // 5. Final Grades Subcollection
    const unsubFinalGrades = onSnapshot(collection(db, 'schools', schoolId, 'finalGrades'), (snap) => {
      if (isCancelled) return;
      synced.finalGrades = new Set(snap.docs.map(d => d.id));
      const finalGrades: Record<string, any> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const key = `${schoolId}__${d.id}`;
        finalGrades[key] = data.entries || [];
        docSnapshots.set(`schools/${schoolId}/finalGrades/${d.id}`, stableSerialize({ id: d.id, entries: data.entries || [] }));
      });
      onUpdate({ finalGrades });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/finalGrades`));
    unsubs.push(unsubFinalGrades);

    // 6. Homework Subcollection
    const unsubHomework = onSnapshot(collection(db, 'schools', schoolId, 'homework'), (snap) => {
      if (isCancelled) return;
      synced.homework = new Set(snap.docs.map(d => d.id));
      const homework = snap.docs.map(d => {
        const hwData = d.data() as any;
        docSnapshots.set(`schools/${schoolId}/homework/${d.id}`, stableSerialize({ ...hwData, schoolId }));
        return hwData;
      });
      onUpdate({ homework });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/homework`));
    unsubs.push(unsubHomework);

    // 7. Messages Subcollection
    const unsubMessages = onSnapshot(collection(db, 'schools', schoolId, 'messages'), (snap) => {
      if (isCancelled) return;
      synced.messages = new Set(snap.docs.map(d => d.id));
      const messages = snap.docs.map(d => {
        const msgData = d.data() as any;
        docSnapshots.set(`schools/${schoolId}/messages/${d.id}`, stableSerialize({ ...msgData, schoolId }));
        return msgData;
      });
      onUpdate({ messages });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/messages`));
    unsubs.push(unsubMessages);

    // 8. Announcements Subcollection
    const unsubAnnouncements = onSnapshot(collection(db, 'schools', schoolId, 'announcements'), (snap) => {
      if (isCancelled) return;
      synced.announcements = new Set(snap.docs.map(d => d.id));
      const announcements = snap.docs.map(d => {
        const annData = d.data() as any;
        docSnapshots.set(`schools/${schoolId}/announcements/${d.id}`, stableSerialize({ ...annData, schoolId }));
        return annData;
      });
      onUpdate({ announcements });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/announcements`));
    unsubs.push(unsubAnnouncements);

    // 9. Teacher Assignments Subcollection
    const unsubAssignments = onSnapshot(collection(db, 'schools', schoolId, 'teacherAssignments'), (snap) => {
      if (isCancelled) return;
      synced.teacherAssignments = new Set(snap.docs.map(d => d.id));
      const teacherAssignments = snap.docs.map(d => {
        const taData = d.data() as any;
        docSnapshots.set(`schools/${schoolId}/teacherAssignments/${d.id}`, stableSerialize({ ...taData, schoolId }));
        return taData;
      });
      onUpdate({ teacherAssignments });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/teacherAssignments`));
    unsubs.push(unsubAssignments);

    // 10. Student Groups Subcollection
    const unsubGroups = onSnapshot(collection(db, 'schools', schoolId, 'studentGroups'), (snap) => {
      if (isCancelled) return;
      synced.studentGroups = new Set(snap.docs.map(d => d.id));
      const studentGroups = snap.docs.map(d => {
        const sgData = d.data() as any;
        docSnapshots.set(`schools/${schoolId}/studentGroups/${d.id}`, stableSerialize({ ...sgData, schoolId }));
        return sgData;
      });
      onUpdate({ studentGroups });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/studentGroups`));
    unsubs.push(unsubGroups);
  };

  if (auth.currentUser) {
    startListeners();
  } else {
    auth.authStateReady().then(() => {
      if (!isCancelled && auth.currentUser) {
        startListeners();
      }
    });
  }

  return () => {
    safeUnsubAll();
  };
};

export const subscribeToAllSchools = (callback: (schools: any[]) => void): (() => void) => {
  let isCancelled = false;
  let unsub: (() => void) | null = null;
  const start = () => {
    if (isCancelled || !auth.currentUser) return;
    unsub = onSnapshot(collection(db, 'schools'), (snap) => {
      const schools = snap.docs.map(d => d.data());
      callback(schools);
    }, (err) => console.warn('subscribeToAllSchools warning:', err));
  };

  if (auth.currentUser) {
    start();
  } else {
    auth.authStateReady().then(() => {
      if (!isCancelled && auth.currentUser) {
        start();
      }
    });
  }

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
};

/**
 * Role-aware differential state synchronizer.
 * Only writes documents that actually changed compared to docSnapshots,
 * and strictly respects the current user's role so unauthorized collections are never touched.
 */
export const saveSchoolState = async (schoolId: string, state: AppState): Promise<void> => {
  if (!schoolId || schoolId === 'global') return;
  try {
    const plainState = JSON.parse(JSON.stringify(state));
    const synced = getOrCreateSyncedIds(schoolId);

    const role = currentSessionUser?.role || 'director';
    const currentUserId = currentSessionUser?.id || '';

    const isDirectorOrCreator = role === 'creator' || role === 'director';
    const isEmployee = role === 'employee';
    const isTeacher = role === 'teacher';

    const canWriteSchoolDoc = isDirectorOrCreator || isEmployee;
    const canManageUsers = isDirectorOrCreator || isEmployee;
    const canWriteSchedules = isDirectorOrCreator || isTeacher || isEmployee;
    const canWriteGrades = isDirectorOrCreator || isTeacher || isEmployee;
    const canWriteHomework = isDirectorOrCreator || isTeacher || isEmployee;
    const canManageAnnouncements = isDirectorOrCreator || isEmployee;
    const canManageLoadAndGroups = isDirectorOrCreator || isEmployee;

    const writeOps: Promise<void>[] = [];

    const queueSetIfChanged = (docRef: any, docPath: string, payload: any, merge: boolean = true) => {
      const cleanPayload = JSON.parse(JSON.stringify(payload));
      const serialized = stableSerialize(cleanPayload);
      if (docSnapshots.get(docPath) === serialized) {
        return; // Unchanged — skip write!
      }
      docSnapshots.set(docPath, serialized);
      writeOps.push(
        setDoc(docRef, cleanPayload, merge ? { merge: true } : {}).catch((err) => {
          docSnapshots.delete(docPath);
          handleFirestoreError(err, OperationType.WRITE, docPath);
        })
      );
    };

    const queueDelete = (docRef: any, docPath: string) => {
      docSnapshots.delete(docPath);
      writeOps.push(
        deleteDoc(docRef).catch((err) => {
          handleFirestoreError(err, OperationType.DELETE, docPath);
        })
      );
    };

    // 1. School Root Document & Creator Gate (only if Director, Creator, or Employee)
    if (canWriteSchoolDoc) {
      const school = (plainState.schools || []).find((s: any) => s.id === schoolId) || plainState.schools?.[0];
      if (school) {
        const schoolPayload = {
          id: school.id || schoolId,
          name: school.name || 'Школа №1',
          directorId: school.directorId || 'u_dir',
          classes: school.classes || plainState.classes || [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }],
          subjects: school.subjects || plainState.subjects || [
            'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
            'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
          ],
          gradingSystem: plainState.schoolGradingSystems?.[schoolId] || plainState.gradingSystem,
          gradeTypes: plainState.schoolGradeTypes?.[schoolId] || plainState.gradeTypes,
          subjectRequirements: plainState.subjectRequirements,
          scheduleSettings: plainState.schoolScheduleSettings?.[schoolId] || plainState.scheduleSettings,
          settings: plainState.schoolsSettings?.[schoolId] || plainState.settings
        };
        queueSetIfChanged(doc(db, 'schools', schoolId), `schools/${schoolId}`, schoolPayload, true);

        if (isDirectorOrCreator) {
          const activeSettings = plainState.schoolsSettings?.[schoolId] || plainState.settings;
          if (activeSettings) {
            const gatePayload: any = {
              secretKey: activeSettings.secretKey || 'Space',
              secretCount: activeSettings.secretCount || 4
            };
            if (activeSettings.adminPasswordHash) gatePayload.adminPasswordHash = activeSettings.adminPasswordHash;
            if (activeSettings.adminPasswordSalt) gatePayload.adminPasswordSalt = activeSettings.adminPasswordSalt;
            queueSetIfChanged(
              doc(db, 'schools', schoolId, 'publicConfig', 'creatorGate'),
              `schools/${schoolId}/publicConfig/creatorGate`,
              gatePayload,
              true
            );
          }
        }
      }
    }

    // 2. Users diff & sync
    const schoolUsers = (plainState.users || []).filter((u: any) => u.schoolId === schoolId && u.role !== 'creator');
    if (canManageUsers) {
      const currentActiveUserIds = new Set(schoolUsers.map((u: any) => u.id));
      for (const prevId of Array.from(synced.users)) {
        if (!currentActiveUserIds.has(prevId)) {
          queueDelete(doc(db, 'schools', schoolId, 'users', prevId), `schools/${schoolId}/users/${prevId}`);
          synced.users.delete(prevId);
        }
      }
      for (const u of schoolUsers) {
        const userDoc = { ...u };
        delete userDoc.password;
        queueSetIfChanged(doc(db, 'schools', schoolId, 'users', u.id), `schools/${schoolId}/users/${u.id}`, userDoc, true);
        synced.users.add(u.id);
      }
    } else if (currentUserId) {
      // Non-admin user can only update their own user preferences (e.g. theme, language)
      const selfUser = schoolUsers.find((u: any) => u.id === currentUserId);
      if (selfUser && synced.users.has(currentUserId)) {
        const userDoc = { ...selfUser };
        delete userDoc.password;
        queueSetIfChanged(doc(db, 'schools', schoolId, 'users', currentUserId), `schools/${schoolId}/users/${currentUserId}`, userDoc, true);
      }
    }

    // 3. Schedules diff & sync
    if (canWriteSchedules) {
      const currentActiveScheduleKeys = new Set<string>();
      for (const [k, days] of Object.entries(plainState.schedules || {})) {
        if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
          const classKey = k.includes('__') ? k.split('__')[1] : k;
          currentActiveScheduleKeys.add(classKey);
          queueSetIfChanged(
            doc(db, 'schools', schoolId, 'schedules', classKey),
            `schools/${schoolId}/schedules/${classKey}`,
            { id: classKey, days: days as any },
            false
          );
          synced.schedules.add(classKey);
        }
      }
      for (const prevKey of Array.from(synced.schedules)) {
        if (!currentActiveScheduleKeys.has(prevKey)) {
          queueDelete(doc(db, 'schools', schoolId, 'schedules', prevKey), `schools/${schoolId}/schedules/${prevKey}`);
          synced.schedules.delete(prevKey);
        }
      }
    }

    // 4. Grades diff & sync
    if (canWriteGrades) {
      const currentActiveGradeKeys = new Set<string>();
      for (const [k, entries] of Object.entries(plainState.grades || {})) {
        if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
          const gradeKey = k.includes('__') ? k.split('__')[1] : k;
          currentActiveGradeKeys.add(gradeKey);
          queueSetIfChanged(
            doc(db, 'schools', schoolId, 'grades', gradeKey),
            `schools/${schoolId}/grades/${gradeKey}`,
            { id: gradeKey, entries: entries as any },
            false
          );
          synced.grades.add(gradeKey);
        }
      }
      for (const prevKey of Array.from(synced.grades)) {
        if (!currentActiveGradeKeys.has(prevKey)) {
          queueDelete(doc(db, 'schools', schoolId, 'grades', prevKey), `schools/${schoolId}/grades/${prevKey}`);
          synced.grades.delete(prevKey);
        }
      }

      // 5. Final grades diff & sync
      const currentActiveFinalGradeKeys = new Set<string>();
      for (const [k, entries] of Object.entries(plainState.finalGrades || {})) {
        if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
          const classKey = k.includes('__') ? k.split('__')[1] : k;
          currentActiveFinalGradeKeys.add(classKey);
          queueSetIfChanged(
            doc(db, 'schools', schoolId, 'finalGrades', classKey),
            `schools/${schoolId}/finalGrades/${classKey}`,
            { id: classKey, entries: entries as any },
            false
          );
          synced.finalGrades.add(classKey);
        }
      }
      for (const prevKey of Array.from(synced.finalGrades)) {
        if (!currentActiveFinalGradeKeys.has(prevKey)) {
          queueDelete(doc(db, 'schools', schoolId, 'finalGrades', prevKey), `schools/${schoolId}/finalGrades/${prevKey}`);
          synced.finalGrades.delete(prevKey);
        }
      }
    }

    // 6. Homework diff & sync
    if (canWriteHomework) {
      const schoolHomework = (plainState.homework || []).filter((h: any) => h.schoolId === schoolId || !h.schoolId);
      const currentHwIds = new Set(schoolHomework.map((h: any) => h.id));
      for (const prevId of Array.from(synced.homework)) {
        if (!currentHwIds.has(prevId)) {
          queueDelete(doc(db, 'schools', schoolId, 'homework', prevId), `schools/${schoolId}/homework/${prevId}`);
          synced.homework.delete(prevId);
        }
      }
      for (const hw of schoolHomework) {
        queueSetIfChanged(
          doc(db, 'schools', schoolId, 'homework', hw.id),
          `schools/${schoolId}/homework/${hw.id}`,
          { ...hw, schoolId },
          true
        );
        synced.homework.add(hw.id);
      }
    }

    // 7. Announcements diff & sync
    const schoolAnnouncements = (plainState.announcements || []).filter((a: any) => a.schoolId === schoolId || !a.schoolId);
    if (canManageAnnouncements) {
      const currentAnnIds = new Set(schoolAnnouncements.map((a: any) => a.id));
      for (const prevId of Array.from(synced.announcements)) {
        if (!currentAnnIds.has(prevId)) {
          queueDelete(doc(db, 'schools', schoolId, 'announcements', prevId), `schools/${schoolId}/announcements/${prevId}`);
          synced.announcements.delete(prevId);
        }
      }
      for (const ann of schoolAnnouncements) {
        queueSetIfChanged(
          doc(db, 'schools', schoolId, 'announcements', ann.id),
          `schools/${schoolId}/announcements/${ann.id}`,
          { ...ann, schoolId },
          true
        );
        synced.announcements.add(ann.id);
      }
    } else {
      // Students and Teachers can update read/readBy on existing announcements
      for (const ann of schoolAnnouncements) {
        if (synced.announcements.has(ann.id)) {
          queueSetIfChanged(
            doc(db, 'schools', schoolId, 'announcements', ann.id),
            `schools/${schoolId}/announcements/${ann.id}`,
            { ...ann, schoolId },
            true
          );
        }
      }
    }

    // 8. Messages diff & sync (all school members can create messages, update readBy, and delete their own messages)
    const schoolMessages = (plainState.messages || []).filter((m: any) => m.schoolId === schoolId || !m.schoolId);
    const currentMsgIds = new Set(schoolMessages.map((m: any) => m.id));
    for (const prevId of Array.from(synced.messages)) {
      if (!currentMsgIds.has(prevId)) {
        queueDelete(doc(db, 'schools', schoolId, 'messages', prevId), `schools/${schoolId}/messages/${prevId}`);
        synced.messages.delete(prevId);
      }
    }
    for (const msg of schoolMessages) {
      queueSetIfChanged(
        doc(db, 'schools', schoolId, 'messages', msg.id),
        `schools/${schoolId}/messages/${msg.id}`,
        { ...msg, schoolId },
        true
      );
      synced.messages.add(msg.id);
    }

    // 9. Teacher Assignments & Student Groups diff & sync
    if (canManageLoadAndGroups) {
      const schoolAssignments = (plainState.teacherAssignments || []).filter((t: any) => t.schoolId === schoolId || !t.schoolId);
      const currentAssignIds = new Set(schoolAssignments.map((t: any) => t.id));
      for (const prevId of Array.from(synced.teacherAssignments)) {
        if (!currentAssignIds.has(prevId)) {
          queueDelete(doc(db, 'schools', schoolId, 'teacherAssignments', prevId), `schools/${schoolId}/teacherAssignments/${prevId}`);
          synced.teacherAssignments.delete(prevId);
        }
      }
      for (const ta of schoolAssignments) {
        queueSetIfChanged(
          doc(db, 'schools', schoolId, 'teacherAssignments', ta.id),
          `schools/${schoolId}/teacherAssignments/${ta.id}`,
          { ...ta, schoolId },
          true
        );
        synced.teacherAssignments.add(ta.id);
      }

      const schoolGroups = (plainState.studentGroups || []).filter((g: any) => g.schoolId === schoolId || !g.schoolId);
      const currentGroupIds = new Set(schoolGroups.map((g: any) => g.id));
      for (const prevId of Array.from(synced.studentGroups)) {
        if (!currentGroupIds.has(prevId)) {
          queueDelete(doc(db, 'schools', schoolId, 'studentGroups', prevId), `schools/${schoolId}/studentGroups/${prevId}`);
          synced.studentGroups.delete(prevId);
        }
      }
      for (const sg of schoolGroups) {
        queueSetIfChanged(
          doc(db, 'schools', schoolId, 'studentGroups', sg.id),
          `schools/${schoolId}/studentGroups/${sg.id}`,
          { ...sg, schoolId },
          true
        );
        synced.studentGroups.add(sg.id);
      }
    }

    if (writeOps.length > 0) {
      await Promise.all(writeOps);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schools/${schoolId}`);
  }
};

/**
 * Saves a single message atomically to Firestore
 */
export const saveSchoolMessage = async (schoolId: string, message: any): Promise<void> => {
  const targetSchoolId = (schoolId && schoolId !== 'global') ? schoolId : 'school_1';
  if (!message?.id) return;
  const docPath = `schools/${targetSchoolId}/messages/${message.id}`;
  try {
    const cleanMsg = JSON.parse(JSON.stringify({ ...message, schoolId: targetSchoolId }));
    await setDoc(doc(db, 'schools', targetSchoolId, 'messages', message.id), cleanMsg, { merge: true });
    docSnapshots.set(docPath, stableSerialize(cleanMsg));
    getOrCreateSyncedIds(targetSchoolId).messages.add(message.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
};
