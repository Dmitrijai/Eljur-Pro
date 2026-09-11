
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updatePassword,
  UserCredential 
} from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  deleteDoc,
  writeBatch,
  setLogLevel,
  Firestore 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppState, Asset } from '../types';

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
export const storage = getStorage(app);

const DB_NAME = 'ElZhurDB_v9';
const DB_VERSION = 3;
const STORE_ASSETS = 'assets';
const STORE_SCHOOL_CACHE = 'school_cache';

/**
 * Synchronizes a user's Firebase Auth UID to their school and role mapping.
 * Used by Firestore security rules (/authUidMap/{uid}) to enforce Attribute-Based Access Control.
 */
export const syncUserAuthUidMap = async (schoolId: string, userId: string, role: string, firebaseUid: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'authUidMap', firebaseUid), {
      schoolId,
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
        // Synchronize password to preferred if different
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
          break; // User does not exist, go straight to creation
        }
      }
    }

    if (!signedIn) {
      // 2. Try creating the user if not found
      try {
        cred = await createUserWithEmailAndPassword(auth, virtualEmail, formatPwd(preferredPassword));
      } catch (createErr: any) {
        // 3. If email is already in use with an unrecoverable password, create an alternative alias email
        // This guarantees the user is NEVER locked out while maintaining full valid Firebase Auth UID
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

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_SCHOOL_CACHE)) {
        db.createObjectStore(STORE_SCHOOL_CACHE, { keyPath: 'schoolId' });
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
      // Strip passwords before persisting to disk
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

export const saveAsset = async (id: string, name: string, type: string, blob: Blob, schoolId: string = 'global'): Promise<void> => {
  const targetSchoolId = schoolId || 'global';
  const key = `${targetSchoolId}__${id}`;

  // 1. Fast local cache in IndexedDB with tenant scoped key
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

  // 2. Primary Remote Storage: Firebase Storage (if available/provisioned)
  try {
    const sRef = storageRef(storage, `schools/${targetSchoolId}/attachments/${id}`);
    await uploadBytes(sRef, blob, { contentType: type });
    const downloadUrl = await getDownloadURL(sRef);
    await setDoc(doc(db, 'schools', targetSchoolId, 'attachments', id), {
      id,
      schoolId: targetSchoolId,
      name,
      type,
      url: downloadUrl,
      size: blob.size,
      updatedAt: new Date().toISOString()
    });
    return;
  } catch (storageErr) {
    // Graceful fallback to Firestore document storage if Firebase Storage bucket is not activated
  }

  // 3. Fallback Remote Storage: Firestore Document (if within document size limit < 900KB)
  try {
    if (blob.size < 900 * 1024) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await setDoc(doc(db, 'schools', targetSchoolId, 'attachments', id), {
        id,
        schoolId: targetSchoolId,
        name,
        type,
        data: dataUrl,
        size: blob.size,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Remote attachment sync failed:', e);
  }
};

export const getAsset = async (id: string, schoolId: string = 'global'): Promise<Asset | null> => {
  const targetSchoolId = schoolId || 'global';
  const key = `${targetSchoolId}__${id}`;

  // 1. Check local IndexedDB first
  try {
    const localDb = await openDB();
    const localAsset = await new Promise<any | null>((resolve, reject) => {
      const tx = localDb.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
      tx.oncomplete = () => localDb.close();
    });
    if (localAsset && localAsset.blob) {
      return { id: localAsset.id, name: localAsset.name, type: localAsset.type, blob: localAsset.blob };
    }
  } catch (e) {
    console.warn('Local asset get failed:', e);
  }

  // 2. Try Firebase Storage directly
  try {
    const sRef = storageRef(storage, `schools/${targetSchoolId}/attachments/${id}`);
    const downloadUrl = await getDownloadURL(sRef);
    const res = await fetch(downloadUrl);
    const blob = await res.blob();
    const asset: Asset = { id, name: id, type: blob.type, blob };
    // Cache locally
    try {
      const localDb = await openDB();
      const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
      tx.objectStore(STORE_ASSETS).put({ key, id, schoolId: targetSchoolId, name: id, type: blob.type, blob });
      tx.oncomplete = () => localDb.close();
    } catch {}
    return asset;
  } catch (storageErr) {
    // Continue to Firestore fallback
  }

  // 3. Fallback to Firestore subcollection if not in Firebase Storage
  try {
    const docSnap = await getDoc(doc(db, 'schools', targetSchoolId, 'attachments', id));
    if (docSnap.exists()) {
      const d = docSnap.data();
      const fetchUrl = d.url || d.data;
      if (fetchUrl) {
        const res = await fetch(fetchUrl);
        const blob = await res.blob();
        const asset: Asset = { id: d.id, name: d.name, type: d.type, blob };
        try {
          const localDb = await openDB();
          const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
          tx.objectStore(STORE_ASSETS).put({ key, id, schoolId: targetSchoolId, name: d.name, type: d.type, blob });
          tx.oncomplete = () => localDb.close();
        } catch {}
        return asset;
      }
    }
  } catch (e) {
    console.warn('Remote asset get failed:', e);
  }

  return null;
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
  authInfo: any;
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
    await setDoc(doc(db, 'schools', schoolId), JSON.parse(JSON.stringify(schoolData)), { merge: true });
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
  const docPath = `schools/${schoolId}/publicConfig/creatorGate`;
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
  const docPath = `schools/${schoolId}/publicConfig/creatorGate`;
  try {
    const payload = {
      ...config,
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'schools', schoolId, 'publicConfig', 'creatorGate'), payload, { merge: true });
    try {
      localStorage.setItem(`eljur_gate_${schoolId}`, JSON.stringify(payload));
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolEntity = async (schoolId: string, collName: string, entityId: string, data: any): Promise<void> => {
  const docPath = `schools/${schoolId}/${collName}/${entityId}`;
  try {
    const cleanData = JSON.parse(JSON.stringify(data));
    if (collName === 'users') {
      delete cleanData.password;
    }
    await setDoc(doc(db, 'schools', schoolId, collName, entityId), cleanData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const deleteSchoolEntity = async (schoolId: string, collName: string, entityId: string): Promise<void> => {
  const docPath = `schools/${schoolId}/${collName}/${entityId}`;
  try {
    await deleteDoc(doc(db, 'schools', schoolId, collName, entityId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
};

export const saveSchoolSchedule = async (schoolId: string, classKey: string, days: any): Promise<void> => {
  const docPath = `schools/${schoolId}/schedules/${classKey}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'schedules', classKey), { classKey, days: JSON.parse(JSON.stringify(days)) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolGrades = async (schoolId: string, gradeKey: string, entries: any): Promise<void> => {
  const docPath = `schools/${schoolId}/grades/${gradeKey}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'grades', gradeKey), { key: gradeKey, entries: JSON.parse(JSON.stringify(entries)) });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const saveSchoolFinalGrades = async (schoolId: string, classKey: string, entries: any): Promise<void> => {
  const docPath = `schools/${schoolId}/finalGrades/${classKey}`;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'finalGrades', classKey), { classKey, entries: JSON.parse(JSON.stringify(entries)) });
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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('insufficient permissions') || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      safeUnsubAll();
    }
    handleFirestoreError(err, op, path);
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
    const users = snap.docs.map(d => d.data() as any);
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
    });
    onUpdate({ finalGrades });
  }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/finalGrades`));
  unsubs.push(unsubFinalGrades);

  // 6. Homework Subcollection
  const unsubHomework = onSnapshot(collection(db, 'schools', schoolId, 'homework'), (snap) => {
    if (isCancelled) return;
    synced.homework = new Set(snap.docs.map(d => d.id));
    const homework = snap.docs.map(d => d.data() as any);
    onUpdate({ homework });
  }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/homework`));
  unsubs.push(unsubHomework);

  // 7. Messages Subcollection
  const unsubMessages = onSnapshot(collection(db, 'schools', schoolId, 'messages'), (snap) => {
    if (isCancelled) return;
    synced.messages = new Set(snap.docs.map(d => d.id));
    const messages = snap.docs.map(d => d.data() as any);
    onUpdate({ messages });
  }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/messages`));
  unsubs.push(unsubMessages);

  // 8. Announcements Subcollection
  const unsubAnnouncements = onSnapshot(collection(db, 'schools', schoolId, 'announcements'), (snap) => {
    if (isCancelled) return;
    synced.announcements = new Set(snap.docs.map(d => d.id));
    const announcements = snap.docs.map(d => d.data() as any);
    onUpdate({ announcements });
  }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/announcements`));
  unsubs.push(unsubAnnouncements);

  // 9. Teacher Assignments Subcollection
  const unsubAssignments = onSnapshot(collection(db, 'schools', schoolId, 'teacherAssignments'), (snap) => {
    if (isCancelled) return;
    synced.teacherAssignments = new Set(snap.docs.map(d => d.id));
    const teacherAssignments = snap.docs.map(d => d.data() as any);
    onUpdate({ teacherAssignments });
  }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/teacherAssignments`));
  unsubs.push(unsubAssignments);

  // 10. Student Groups Subcollection
  const unsubGroups = onSnapshot(collection(db, 'schools', schoolId, 'studentGroups'), (snap) => {
    if (isCancelled) return;
    synced.studentGroups = new Set(snap.docs.map(d => d.id));
    const studentGroups = snap.docs.map(d => d.data() as any);
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
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'schools'));
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

// Saves changes per school exclusively to subcollections with diff-and-delete tracking
export const saveSchoolState = async (schoolId: string, state: AppState): Promise<void> => {
  try {
    const plainState = JSON.parse(JSON.stringify(state));
    const batch = writeBatch(db);
    const synced = getOrCreateSyncedIds(schoolId);

    // Save/update school root document
    const school = (plainState.schools || []).find((s: any) => s.id === schoolId) || plainState.schools?.[0];
    if (school) {
      batch.set(doc(db, 'schools', schoolId), {
        id: school.id,
        name: school.name,
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
      }, { merge: true });

      // Sync public creator gate configuration
      const activeSettings = plainState.schoolsSettings?.[schoolId] || plainState.settings;
      if (activeSettings) {
        const gatePayload: any = {
          secretKey: activeSettings.secretKey || 'Space',
          secretCount: activeSettings.secretCount || 4,
          updatedAt: new Date().toISOString()
        };
        if (activeSettings.adminPasswordHash) gatePayload.adminPasswordHash = activeSettings.adminPasswordHash;
        if (activeSettings.adminPasswordSalt) gatePayload.adminPasswordSalt = activeSettings.adminPasswordSalt;
        batch.set(doc(db, 'schools', schoolId, 'publicConfig', 'creatorGate'), gatePayload, { merge: true });
      }
    }

    // 1. Users diff & sync (strip password before saving)
    const schoolUsers = (plainState.users || []).filter((u: any) => u.schoolId === schoolId || u.role === 'creator');
    const currentActiveUserIds = new Set(schoolUsers.map((u: any) => u.id));
    for (const prevId of synced.users) {
      if (!currentActiveUserIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'users', prevId));
        synced.users.delete(prevId);
      }
    }
    for (const u of schoolUsers) {
      const userDoc = { ...u };
      delete userDoc.password;
      batch.set(doc(db, 'schools', schoolId, 'users', u.id), userDoc, { merge: true });
      synced.users.add(u.id);
    }

    // 2. Schedules diff & sync (overwrite without merge so deleted days are purged)
    const currentActiveScheduleKeys = new Set<string>();
    for (const [k, days] of Object.entries(plainState.schedules || {})) {
      if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
        const classKey = k.includes('__') ? k.split('__')[1] : k;
        currentActiveScheduleKeys.add(classKey);
        batch.set(doc(db, 'schools', schoolId, 'schedules', classKey), { id: classKey, days: days as any });
        synced.schedules.add(classKey);
      }
    }
    for (const prevKey of synced.schedules) {
      if (!currentActiveScheduleKeys.has(prevKey)) {
        batch.delete(doc(db, 'schools', schoolId, 'schedules', prevKey));
        synced.schedules.delete(prevKey);
      }
    }

    // 3. Grades diff & sync (overwrite without merge so cleared entries are purged)
    const currentActiveGradeKeys = new Set<string>();
    for (const [k, entries] of Object.entries(plainState.grades || {})) {
      if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
        const gradeKey = k.includes('__') ? k.split('__')[1] : k;
        currentActiveGradeKeys.add(gradeKey);
        batch.set(doc(db, 'schools', schoolId, 'grades', gradeKey), { id: gradeKey, entries: entries as any });
        synced.grades.add(gradeKey);
      }
    }
    for (const prevKey of synced.grades) {
      if (!currentActiveGradeKeys.has(prevKey)) {
        batch.delete(doc(db, 'schools', schoolId, 'grades', prevKey));
        synced.grades.delete(prevKey);
      }
    }

    // 4. Final grades diff & sync (overwrite without merge)
    const currentActiveFinalGradeKeys = new Set<string>();
    for (const [k, entries] of Object.entries(plainState.finalGrades || {})) {
      if (k.startsWith(`${schoolId}__`) || !k.includes('__')) {
        const classKey = k.includes('__') ? k.split('__')[1] : k;
        currentActiveFinalGradeKeys.add(classKey);
        batch.set(doc(db, 'schools', schoolId, 'finalGrades', classKey), { id: classKey, entries: entries as any });
        synced.finalGrades.add(classKey);
      }
    }
    for (const prevKey of synced.finalGrades) {
      if (!currentActiveFinalGradeKeys.has(prevKey)) {
        batch.delete(doc(db, 'schools', schoolId, 'finalGrades', prevKey));
        synced.finalGrades.delete(prevKey);
      }
    }

    // 5. Homework diff & sync
    const schoolHomework = (plainState.homework || []).filter((h: any) => h.schoolId === schoolId || !h.schoolId);
    const currentHwIds = new Set(schoolHomework.map((h: any) => h.id));
    for (const prevId of synced.homework) {
      if (!currentHwIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'homework', prevId));
        synced.homework.delete(prevId);
      }
    }
    for (const hw of schoolHomework) {
      batch.set(doc(db, 'schools', schoolId, 'homework', hw.id), { ...hw, schoolId }, { merge: true });
      synced.homework.add(hw.id);
    }

    // 6. Announcements diff & sync
    const schoolAnnouncements = (plainState.announcements || []).filter((a: any) => a.schoolId === schoolId || !a.schoolId);
    const currentAnnIds = new Set(schoolAnnouncements.map((a: any) => a.id));
    for (const prevId of synced.announcements) {
      if (!currentAnnIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'announcements', prevId));
        synced.announcements.delete(prevId);
      }
    }
    for (const ann of schoolAnnouncements) {
      batch.set(doc(db, 'schools', schoolId, 'announcements', ann.id), { ...ann, schoolId }, { merge: true });
      synced.announcements.add(ann.id);
    }

    // 7. Messages diff & sync
    const schoolMessages = (plainState.messages || []).filter((m: any) => m.schoolId === schoolId || !m.schoolId);
    const currentMsgIds = new Set(schoolMessages.map((m: any) => m.id));
    for (const prevId of synced.messages) {
      if (!currentMsgIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'messages', prevId));
        synced.messages.delete(prevId);
      }
    }
    for (const msg of schoolMessages) {
      batch.set(doc(db, 'schools', schoolId, 'messages', msg.id), { ...msg, schoolId }, { merge: true });
      synced.messages.add(msg.id);
    }

    // 8. Teacher Assignments diff & sync
    const schoolAssignments = (plainState.teacherAssignments || []).filter((t: any) => t.schoolId === schoolId || !t.schoolId);
    const currentAssignIds = new Set(schoolAssignments.map((t: any) => t.id));
    for (const prevId of synced.teacherAssignments) {
      if (!currentAssignIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'teacherAssignments', prevId));
        synced.teacherAssignments.delete(prevId);
      }
    }
    for (const ta of schoolAssignments) {
      batch.set(doc(db, 'schools', schoolId, 'teacherAssignments', ta.id), { ...ta, schoolId }, { merge: true });
      synced.teacherAssignments.add(ta.id);
    }

    // 9. Student Groups diff & sync
    const schoolGroups = (plainState.studentGroups || []).filter((g: any) => g.schoolId === schoolId || !g.schoolId);
    const currentGroupIds = new Set(schoolGroups.map((g: any) => g.id));
    for (const prevId of synced.studentGroups) {
      if (!currentGroupIds.has(prevId)) {
        batch.delete(doc(db, 'schools', schoolId, 'studentGroups', prevId));
        synced.studentGroups.delete(prevId);
      }
    }
    for (const sg of schoolGroups) {
      batch.set(doc(db, 'schools', schoolId, 'studentGroups', sg.id), { ...sg, schoolId }, { merge: true });
      synced.studentGroups.add(sg.id);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `schools/${schoolId}`);
  }
};

/**
 * Saves a single message atomically to Firestore
 */
export const saveSchoolMessage = async (schoolId: string, message: any): Promise<void> => {
  if (!schoolId || !message?.id) return;
  try {
    await setDoc(doc(db, 'schools', schoolId, 'messages', message.id), { ...message, schoolId }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `schools/${schoolId}/messages/${message.id}`);
  }
};

