
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppState, Asset } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

const DB_NAME = 'ElZhurDB_v7';
const DB_VERSION = 2;
const STORE_ASSETS = 'assets';

// Asset storage remains in IndexedDB as Firestore has 1MB document limits 
// and storing large blobs in Firestore isn't optimal without Firebase Storage.
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
    };
  });
};

export const saveAsset = async (id: string, name: string, type: string, blob: Blob): Promise<void> => {
  const localDb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = localDb.transaction(STORE_ASSETS, 'readwrite');
    const store = tx.objectStore(STORE_ASSETS);
    const request = store.put({ id, name, type, blob });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    tx.oncomplete = () => localDb.close();
  });
};

export const getAsset = async (id: string): Promise<Asset | null> => {
  const localDb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = localDb.transaction(STORE_ASSETS, 'readonly');
    const store = tx.objectStore(STORE_ASSETS);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
    tx.oncomplete = () => localDb.close();
  });
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

// Firestore State Management
// We wrap the operations in handleFirestoreError to meet skill requirements

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STATE_DOC_PATH = 'appStates/main';

export const saveState = async (state: AppState): Promise<void> => {
  try {
    const plainState = JSON.parse(JSON.stringify(state));
    await setDoc(doc(db, STATE_DOC_PATH), plainState);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, STATE_DOC_PATH);
  }
};

export const loadStateOnce = async (): Promise<AppState | null> => {
  try {
    const docSnap = await getDoc(doc(db, STATE_DOC_PATH));
    return docSnap.exists() ? (docSnap.data() as AppState) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, STATE_DOC_PATH);
    return null;
  }
};

export const subscribeToState = (callback: (state: AppState | null) => void) => {
  return onSnapshot(doc(db, STATE_DOC_PATH), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as AppState);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, STATE_DOC_PATH);
  });
};
