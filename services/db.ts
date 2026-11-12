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
import { DEFAULT_SCHOOL_1_INFO_HTML, normalizeLegacySchool1Info, applyLocalReadReceipts } from '../utils/helpers';

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

const DB_NAME = 'ElZhurDB_v10';
const DB_VERSION = 6;
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
  const payload = {
    schoolId: schoolId || 'school_1',
    userId,
    role,
    updatedAt: new Date().toISOString()
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(attempt > 0);
      }
      await setDoc(doc(db, 'authUidMap', firebaseUid), payload);
      return;
    } catch (e) {
      if (attempt === 2) {
        console.warn('Failed to update authUidMap:', e);
      } else {
        await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
      }
    }
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
    try {
      await cred!.user.getIdToken(true);
    } catch {}
  }

  return cred!;
};

/**
 * Fetches users across schools from Firestore during pre-login authentication
 * when a user logs in on a fresh device/browser that doesn't have the user list cached yet.
 */
export const fetchUsersForLoginLookup = async (): Promise<User[]> => {
  try {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== 'login_lookup@school1.eljur.org') {
      await ensureFirebaseAuthSession('login_lookup@school1.eljur.org', 'eljur_lookup_123456');
    }
    const schoolIds = new Set<string>(['school_1']);
    const lastSchoolId = localStorage.getItem('eljur_active_school_id');
    if (lastSchoolId && lastSchoolId !== 'global') {
      schoolIds.add(lastSchoolId);
    }
    try {
      const rawKnown = localStorage.getItem('eljur_known_school_ids');
      if (rawKnown) {
        const parsedKnown = JSON.parse(rawKnown);
        if (Array.isArray(parsedKnown)) {
          parsedKnown.forEach((id: string) => {
            if (id && id !== 'global') schoolIds.add(id);
          });
        }
      }
    } catch {}
    try {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      schoolsSnap.docs.forEach(d => {
        if (d.id && d.id !== 'global') schoolIds.add(d.id);
      });
      try {
        localStorage.setItem('eljur_known_school_ids', JSON.stringify(Array.from(schoolIds)));
      } catch {}
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

const ensureObjectStores = (idb: IDBDatabase) => {
  if (!idb.objectStoreNames.contains(STORE_ASSETS)) {
    idb.createObjectStore(STORE_ASSETS, { keyPath: 'key' });
  }
  if (!idb.objectStoreNames.contains(STORE_SCHOOL_CACHE)) {
    idb.createObjectStore(STORE_SCHOOL_CACHE, { keyPath: 'schoolId' });
  }
};

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      ensureObjectStores((e.target as IDBOpenDBRequest).result);
    };
    request.onsuccess = () => {
      const idb = request.result;
      if (idb.objectStoreNames.contains(STORE_ASSETS) && idb.objectStoreNames.contains(STORE_SCHOOL_CACHE)) {
        resolve(idb);
        return;
      }
      // Self-heal if a browser had a higher or stale DB version without one of the stores
      const nextVersion = idb.version + 1;
      idb.close();
      const upgradeReq = indexedDB.open(DB_NAME, nextVersion);
      upgradeReq.onerror = () => reject(upgradeReq.error);
      upgradeReq.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        ensureObjectStores((e.target as IDBOpenDBRequest).result);
      };
      upgradeReq.onsuccess = () => resolve(upgradeReq.result);
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
      const cleanUsers = (state.users || []).map((u: any) => ({ ...u }));
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

const BUILTIN_ATTACHMENTS: Record<string, { name: string; type: string; content: string }> = {
  att_dir_report_1: {
    name: 'Отчет_директора_Иванова_ИИ_I_четверть.txt',
    type: 'text/plain;charset=utf-8',
    content: [
      'ГОСУДАРСТВЕННОЕ БЮДЖЕТНОЕ ОБЩЕОБРАЗОВАТЕЛЬНОЕ УЧРЕЖДЕНИЕ',
      '«Гимназия №1 им. А.С. Пушкина»',
      '====================================================================',
      'СВОДНЫЙ ОТЧЕТ ДИРЕКТОРА О РЕЗУЛЬТАХ I УЧЕБНОЙ ЧЕТВЕРТИ 2026/2027',
      'Дата формирования: 30.10.2026 г.',
      'Отправитель: Директор гимназии Иванов Иван Иванович',
      'Получатель: Создатель и Главный администратор платформы «ЭлЖур»',
      '====================================================================',
      '',
      '1. ОБЩИЕ ПОКАЗАТЕЛИ ШКОЛЫ:',
      '   • Активных классов в системе: 10-А (профильный физико-математический), 9-А (общеобразовательный)',
      '   • Успеваемость по гимназии: 100%',
      '   • Качество знаний (доля ударников и отличников): 87.5%',
      '   • Средний взвешенный балл по 10-А классу: 4.68',
      '   • Средний взвешенный балл по 9-А классу: 4.52',
      '',
      '2. КОНТРОЛЬ ЭЛЕКТРОННОГО ЖУРНАЛА И РАСПИСАНИЯ:',
      '   • Все уроки за октябрь и ноябрь внесены в конструктор расписания без накладок.',
      '   • Выставление текущих и контрольных оценок ведется с учетом весовых коэффициентов.',
      '   • Домашние задания публикуются своевременно с прикреплением учебных материалов.',
      '',
      '3. ЗАКЛЮЧЕНИЕ:',
      '   Система «ЭлЖур v7 Release» работает стабильно, синхронизация между рабочими местами',
      '   учителей, администрации и дневниками учеников проходит в режиме реального времени.',
      '',
      'Директор Гимназии №1 им. А.С. Пушкина',
      '___________________ / И.И. Иванов /',
      'М.П.'
    ].join('\n')
  },
  att_dir_order_1: {
    name: 'Приказ_№42_О_проведении_аттестации.svg',
    type: 'image/svg+xml;charset=utf-8',
    content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 460" width="680" height="460">
      <rect width="680" height="460" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      <rect x="24" y="24" width="632" height="68" rx="10" fill="#eff6ff"/>
      <text x="340" y="52" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800" fill="#1e3a8a" text-anchor="middle">ГИМНАЗИЯ №1 ИМ. А.С. ПУШКИНА</text>
      <text x="340" y="74" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#2563eb" text-anchor="middle">ПРИКАЗ № 42-ОД от 28.10.2026 г.</text>
      <text x="44" y="124" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="800" fill="#0f172a">О порядке проведения промежуточной аттестации за I четверть</text>
      <text x="44" y="158" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">1. Утвердить график выставления итоговых отметок за I учебную четверть в системе «ЭлЖур»</text>
      <text x="44" y="180" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">   в срок до 14 ноября 2026 года включительно.</text>
      <text x="44" y="212" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">2. Классным руководителям (Петров П.П., Смирнова Е.В.) проверить заполнение электронных</text>
      <text x="44" y="234" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">   журналов, закрытие отметок «Н/У» и довести сводные ведомости до сведения учащихся.</text>
      <text x="44" y="266" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">3. Контроль за исполнением настоящего приказа оставляю за собой.</text>
      <line x1="44" y1="310" x2="636" y2="310" stroke="#e2e8f0" stroke-width="2"/>
      <text x="44" y="356" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">Директор гимназии:</text>
      <text x="230" y="356" font-family="Georgia, serif" font-size="18" font-style="italic" fill="#1d4ed8">И.И. Иванов</text>
      <text x="380" y="356" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">Иванов И.И.</text>
      <circle cx="545" cy="365" r="52" fill="none" stroke="#2563eb" stroke-width="3" stroke-dasharray="6,3"/>
      <circle cx="545" cy="365" r="42" fill="none" stroke="#2563eb" stroke-width="1.5"/>
      <text x="545" y="358" font-family="Inter, Arial, sans-serif" font-size="9" font-weight="800" fill="#2563eb" text-anchor="middle">ГИМНАЗИЯ №1</text>
      <text x="545" y="372" font-family="Inter, Arial, sans-serif" font-size="8" font-weight="700" fill="#1d4ed8" text-anchor="middle">ДЛЯ ДОКУМЕНТОВ</text>
      <text x="545" y="385" font-family="Inter, Arial, sans-serif" font-size="8" font-weight="700" fill="#2563eb" text-anchor="middle">ЭЛЖУР ЭЦП</text>
    </svg>`
  },
  att_dir_schedule_reg: {
    name: 'Регламент_выставления_оценок_и_весов_ЭлЖур.txt',
    type: 'text/plain;charset=utf-8',
    content: [
      'РЕГЛАМЕНТ РАБОТЫ С ЭЛЕКТРОННЫМ ЖУРНАЛОМ «ЭЛЖУР»',
      'Утверждено Директором Гимназии №1 им. А.С. Пушкина И.И. Ивановым',
      '====================================================================',
      '',
      '1. ВЕСОВЫЕ КОЭФФИЦИЕНТЫ ОЦЕНОК:',
      '   • Контрольная работа / Экзамен: вес 5',
      '   • Самостоятельная работа / Диктант / Тест: вес 3',
      '   • Сочинение / Изложение / Лабораторная работа: вес 3–4',
      '   • Ответ на уроке / Домашнее задание: вес 1–2',
      '',
      '2. ПРАВИЛА РАБОТЫ С ОТМЕТКОЙ «Н/У» (НЕВЫПОЛНЕННАЯ РАБОТА):',
      '   • При выставлении отметки «Н/У» система автоматически устанавливает срок',
      '     исправления (по умолчанию 7 календарных дней).',
      '   • Учитель может скорректировать дату дедлайна в карточке оценки.',
      '',
      '3. ДОМАШНИЕ ЗАДАНИЯ:',
      '   • Домашнее задание публикуется не позднее 17:00 дня проведения урока.',
      '',
      'Директор гимназии: Иванов Иван Иванович'
    ].join('\n')
  },
  att_dir_olymp_memo: {
    name: 'График_олимпиад_и_памятка_ученика_10А.txt',
    type: 'text/plain;charset=utf-8',
    content: [
      'ПАМЯТКА УЧАЩИМСЯ 10-А И 9-А КЛАССОВ',
      'График проведения школьного этапа олимпиад и консультаций (Ноябрь 2026)',
      'От: Директора гимназии Иванова Ивана Ивановича',
      '====================================================================',
      '',
      '1. РАСПИСАНИЕ ОЛИМПИАДНЫХ ТУРОВ:',
      '   • Математика (профильный тур): вторник, каб. 301, 14:30 – 16:30 (отв. Петров П.П.)',
      '   • Физика (экспериментальный тур): четверг, каб. 305, 14:30 – 16:30 (отв. Петров П.П.)',
      '   • Русский язык и литература: пятница, каб. 204, 14:30 – 16:00 (отв. Смирнова Е.В.)',
      '   • Информатика и ИКТ: суббота, каб. 402, 12:30 – 15:00 (отв. Морозов А.С.)',
      '',
      '2. РЕКОМЕНДАЦИИ УЧАСТНИКАМ:',
      '   • Проверьте расписание и материалы для подготовки в разделе «Домашние задания».',
      '   • По всем вопросам обращайтесь к классному руководителю через раздел «Сообщения».',
      '',
      'Желаем успехов и высоких результатов!',
      'Директор гимназии И.И. Иванов'
    ].join('\n')
  },
  att_hw_math_10a: {
    name: 'Вариант_подготовки_Тригонометрия_10А.txt',
    type: 'text/plain;charset=utf-8',
    content: [
      'МАТЕМАТИКА • 10-А КЛАСС (Учитель: Петров Пётр Петрович)',
      'Тема: Тригонометрические уравнения и формулы приведения',
      '====================================================================',
      'Задание №1. Решите уравнения:',
      '  а) 2 sin²(x) - 5 sin(x) + 2 = 0',
      '  б) cos(2x) + 3 sin(x) = 2',
      '',
      'Задание №2. Найдите корни уравнения на отрезке [π; 5π/2]:',
      '  sin(2x) - √3 cos(x) = 0',
      '',
      'Задание №3 (дополнительное на «5»):',
      '  Докажите тождество: (1 - cos(2α)) / sin(2α) = tg(α)'
    ].join('\n')
  },
  att_hw_phys_10a: {
    name: 'Лабораторный_практикум_Динамика_10А.txt',
    type: 'text/plain;charset=utf-8',
    content: [
      'ФИЗИКА • 10-А КЛАСС (Учитель: Петров Пётр Петрович)',
      'Тема: Законы Ньютона. Движение тела по наклонной плоскости',
      '====================================================================',
      'Задача 1. Брусок массой m = 2 кг скользит по наклонной плоскости с углом',
      'наклона α = 30° и коэффициентом трения μ = 0.2. Найдите ускорение бруска.',
      '',
      'Задача 2. Постройте диаграмму сил, действующих на систему связанных тел',
      'на невесомой нерастяжимой нити через блок.'
    ].join('\n')
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

  // 3. Fallback to built-in official documents & attachments
  if (BUILTIN_ATTACHMENTS[id]) {
    const def = BUILTIN_ATTACHMENTS[id];
    const blob = new Blob([def.content], { type: def.type });
    return { id, name: def.name, type: def.type, blob };
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

export const getAllAssets = async (schoolId?: string): Promise<Asset[]> => {
  const assetMap = new Map<string, Asset>();
  try {
    const localDb = await openDB();
    const localItems: any[] = await new Promise((resolve) => {
      const tx = localDb.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const request = store.getAll();
      request.onerror = () => resolve([]);
      request.onsuccess = () => resolve(request.result || []);
      tx.oncomplete = () => localDb.close();
    });
    for (const item of localItems) {
      if (!item?.id || !item?.blob) continue;
      if (!schoolId || !item.schoolId || item.schoolId === schoolId) {
        assetMap.set(item.id, { id: item.id, name: item.name, type: item.type, blob: item.blob });
      }
    }
  } catch (e) {
    console.warn('getAllAssets local read warning:', e);
  }

  if (schoolId && schoolId !== 'global') {
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'attachments'));
      for (const d of snap.docs) {
        if (d.id.includes('_chunk_')) continue;
        const data = d.data();
        const assetId = data.id || d.id;
        if (!assetMap.has(assetId) && data.data) {
          const blob = await dataUrlToBlob(data.data, data.type);
          assetMap.set(assetId, {
            id: assetId,
            name: data.name || assetId,
            type: data.type || blob.type,
            blob
          });
        }
      }
    } catch {}
  }

  return Array.from(assetMap.values());
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

const MAX_INLINE_INFO_BYTES = 550 * 1024; // 550 KB safe inline threshold (Firestore limit is 1,048,487 bytes)
const INFO_CHUNK_CHAR_SIZE = 300000; // 300k chars per chunk document

interface ChunkedInfoDescriptor {
  __chunkedInfo: true;
  fieldKey: 'schoolInfo' | 'eljurInfo';
  schoolId: string;
  chunkCount: number;
  version: string;
}

const uploadedInfoVersions = new Map<string, string>();
const resolvedInfoMemoryCache = new Map<string, string>();

const getUtf8ByteSize = (str: string): number => {
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length * 2;
  }
};

const computeInfoVersionHash = (str: string): string => {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  const step = Math.max(1, Math.floor(str.length / 4096));
  for (let i = 0; i < str.length; i += step) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${str.length}_${(h2 >>> 0).toString(36)}_${(h1 >>> 0).toString(36)}`;
};

const isChunkedInfoDescriptorString = (val: unknown): boolean => {
  return typeof val === 'string' && val.trim().startsWith('{"__chunkedInfo":true');
};

const persistLargeFieldIfNeeded = async (
  schoolId: string,
  fieldKey: 'schoolInfo' | 'eljurInfo',
  rawValue: string
): Promise<string> => {
  if (!rawValue || typeof rawValue !== 'string') return rawValue;
  if (isChunkedInfoDescriptorString(rawValue)) return rawValue;

  const byteSize = getUtf8ByteSize(rawValue);
  if (byteSize <= MAX_INLINE_INFO_BYTES) {
    return rawValue;
  }

  const targetSchoolId = schoolId && schoolId !== 'global' ? schoolId : 'school_1';
  const version = computeInfoVersionHash(rawValue);
  const cacheKey = `${targetSchoolId}__${fieldKey}`;

  const chunks: string[] = [];
  for (let i = 0; i < rawValue.length; i += INFO_CHUNK_CHAR_SIZE) {
    chunks.push(rawValue.slice(i, i + INFO_CHUNK_CHAR_SIZE));
  }

  const descriptor: ChunkedInfoDescriptor = {
    __chunkedInfo: true,
    fieldKey,
    schoolId: targetSchoolId,
    chunkCount: chunks.length,
    version
  };
  const descriptorStr = JSON.stringify(descriptor);
  resolvedInfoMemoryCache.set(`${cacheKey}__${version}`, rawValue);

  if (uploadedInfoVersions.get(cacheKey) !== version) {
    if (!auth.currentUser) {
      await auth.authStateReady();
    }
    await Promise.all(
      chunks.map((chunkData, idx) => {
        const chunkDocId = `info_${fieldKey}_chunk_${idx}`;
        return setDoc(doc(db, 'schools', targetSchoolId, 'attachments', chunkDocId), {
          id: chunkDocId,
          schoolId: targetSchoolId,
          fieldKey,
          chunkIndex: idx,
          chunkCount: chunks.length,
          version,
          data: chunkData,
          updatedAt: new Date().toISOString()
        });
      })
    );
    uploadedInfoVersions.set(cacheKey, version);
  }

  return descriptorStr;
};

const resolvePossiblyChunkedField = async (
  schoolId: string,
  fieldKey: 'schoolInfo' | 'eljurInfo',
  rawValue: string | undefined
): Promise<string | undefined> => {
  if (!rawValue || typeof rawValue !== 'string') return rawValue;
  if (!isChunkedInfoDescriptorString(rawValue)) return rawValue;

  try {
    const parsed = JSON.parse(rawValue) as ChunkedInfoDescriptor;
    if (!parsed || !parsed.__chunkedInfo || typeof parsed.chunkCount !== 'number' || parsed.chunkCount <= 0) {
      return undefined;
    }
    const targetSchoolId = parsed.schoolId || (schoolId && schoolId !== 'global' ? schoolId : 'school_1');
    const targetFieldKey = parsed.fieldKey || fieldKey;
    const versionCacheKey = `${targetSchoolId}__${targetFieldKey}__${parsed.version}`;

    const cachedInMemory = resolvedInfoMemoryCache.get(versionCacheKey);
    if (cachedInMemory !== undefined) {
      return cachedInMemory;
    }

    const chunkSnaps = await Promise.all(
      Array.from({ length: parsed.chunkCount }, (_, idx) =>
        getDoc(doc(db, 'schools', targetSchoolId, 'attachments', `info_${targetFieldKey}_chunk_${idx}`))
      )
    );

    const parts: string[] = [];
    for (const snap of chunkSnaps) {
      if (!snap.exists()) {
        return undefined;
      }
      const d = snap.data();
      if (typeof d?.data !== 'string') {
        return undefined;
      }
      parts.push(d.data);
    }

    const fullValue = parts.join('');
    resolvedInfoMemoryCache.set(versionCacheKey, fullValue);
    uploadedInfoVersions.set(`${targetSchoolId}__${targetFieldKey}`, parsed.version);
    return fullValue;
  } catch (err) {
    console.warn(`[resolvePossiblyChunkedField] Failed to reassemble ${fieldKey} for ${schoolId}:`, err);
    return undefined;
  }
};

export const saveSchoolMetadata = async (schoolId: string, schoolData: any): Promise<void> => {
  const docPath = `schools/${schoolId}`;
  try {
    if (typeof schoolData?.name === 'string' && schoolData.name.trim()) {
      try {
        localStorage.setItem(`eljur_school_name_${schoolId}`, schoolData.name.trim());
      } catch {}
    }
    if (typeof schoolData?.educationalResourceUrl === 'string') {
      try {
        localStorage.setItem(`eljur_edu_url_${schoolId}`, schoolData.educationalResourceUrl);
      } catch {}
    }
    if (Array.isArray(schoolData?.educationalResources)) {
      try {
        localStorage.setItem(`eljur_edu_resources_${schoolId}`, JSON.stringify(schoolData.educationalResources));
      } catch {}
    }
    if (typeof schoolData?.schoolInfo === 'string' && !isChunkedInfoDescriptorString(schoolData.schoolInfo)) {
      try {
        if (schoolData.schoolInfo.length <= 400000) {
          localStorage.setItem(`eljur_school_info_${schoolId}`, schoolData.schoolInfo);
        } else {
          localStorage.removeItem(`eljur_school_info_${schoolId}`);
        }
      } catch {}
    }
    const clean = JSON.parse(JSON.stringify(schoolData));
    if (typeof clean.schoolInfo === 'string') {
      clean.schoolInfo = await persistLargeFieldIfNeeded(schoolId, 'schoolInfo', clean.schoolInfo);
    }
    if (typeof clean.eljurInfo === 'string') {
      clean.eljurInfo = await persistLargeFieldIfNeeded(schoolId, 'eljurInfo', clean.eljurInfo);
    }
    if (clean.settings && typeof clean.settings.eljurInfo === 'string') {
      clean.settings.eljurInfo = await persistLargeFieldIfNeeded(schoolId, 'eljurInfo', clean.settings.eljurInfo);
    }
    docSnapshots.delete(docPath);
    await setDoc(doc(db, 'schools', schoolId), clean, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export interface PublicCreatorGateConfig {
  secretKey: string;
  secretCount: number;
  adminPassword?: string;
  adminPasswordHash?: string;
  adminPasswordSalt?: string;
  eljurInfo?: string;
  bodyFontId?: string;
  headingFontId?: string;
  systemTimeOffset?: number;
  updatedAt?: string;
}

export const getPublicCreatorGate = async (schoolId: string = 'school_1'): Promise<PublicCreatorGateConfig | null> => {
  try {
    const snap = await getDoc(doc(db, 'schools', schoolId, 'publicConfig', 'creatorGate'));
    if (snap.exists()) {
      const data = snap.data() as PublicCreatorGateConfig;
      if (typeof data.eljurInfo === 'string' && isChunkedInfoDescriptorString(data.eljurInfo)) {
        const resolved = await resolvePossiblyChunkedField(schoolId, 'eljurInfo', data.eljurInfo);
        if (resolved !== undefined) {
          data.eljurInfo = resolved;
        } else {
          delete data.eljurInfo;
        }
      }
      try {
        const serializedGate = JSON.stringify(data);
        if (serializedGate.length <= 400000) {
          localStorage.setItem(`eljur_gate_${schoolId}`, serializedGate);
        }
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
    if (typeof payload.eljurInfo === 'string') {
      payload.eljurInfo = await persistLargeFieldIfNeeded(targetSchoolId, 'eljurInfo', payload.eljurInfo);
    }
    await setDoc(doc(db, 'schools', targetSchoolId, 'publicConfig', 'creatorGate'), payload, { merge: true });
    try {
      const cacheCopy = { ...payload, ...(typeof config.eljurInfo === 'string' ? { eljurInfo: config.eljurInfo } : {}) };
      const serializedGate = JSON.stringify(cacheCopy);
      if (serializedGate.length <= 400000) {
        localStorage.setItem(`eljur_gate_${targetSchoolId}`, serializedGate);
      }
    } catch {}
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

export const deleteSchoolFromFirestore = async (schoolId: string): Promise<void> => {
  if (!schoolId || schoolId === 'global') return;
  const subcollections = [
    'users',
    'schedules',
    'grades',
    'finalGrades',
    'homework',
    'messages',
    'announcements',
    'teacherAssignments',
    'studentGroups',
    'publicConfig',
    'attachments'
  ];
  try {
    for (const sub of subcollections) {
      try {
        const snap = await getDocs(collection(db, 'schools', schoolId, sub));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'schools', schoolId, sub, d.id)).catch(() => {})));
      } catch {}
    }
    await deleteDoc(doc(db, 'schools', schoolId));
    docSnapshots.delete(`schools/${schoolId}`);
    syncedSchoolIds.delete(schoolId);
    await clearSchoolCache(schoolId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `schools/${schoolId}`);
  }
};

export const saveSchoolEntity = async (schoolId: string, collName: string, entityId: string, data: any): Promise<void> => {
  const targetSchoolId = (schoolId && schoolId !== 'global') ? schoolId : 'school_1';
  const docPath = `schools/${targetSchoolId}/${collName}/${entityId}`;
  try {
    if (!auth.currentUser) {
      await auth.authStateReady();
    }
    const cleanData = JSON.parse(JSON.stringify(data));
    await setDoc(doc(db, 'schools', targetSchoolId, collName, entityId), cleanData, { merge: true });
    docSnapshots.set(docPath, stableSerialize(cleanData));
    const synced = getOrCreateSyncedIds(targetSchoolId);
    if ((synced as any)[collName] instanceof Set) {
      (synced as any)[collName].add(entityId);
    }
  } catch (error) {
    docSnapshots.delete(docPath);
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
};

/**
 * Saves a message or announcement read receipt atomically to Firestore.
 * Uses only the allowed read-receipt keys ('read', 'readBy', 'readBeforeEditBy', 'readAfterEditBy', 'schoolId')
 * so that non-director recipients (students, teachers, employees) always pass Firestore security rules.
 */
export const saveReadReceipt = async (
  schoolId: string,
  collName: 'messages' | 'announcements',
  item: any
): Promise<void> => {
  if (!item?.id) return;
  const targetSchoolId = (schoolId && schoolId !== 'global') ? schoolId : 'school_1';
  const docPath = `schools/${targetSchoolId}/${collName}/${item.id}`;
  try {
    if (!auth.currentUser) {
      await auth.authStateReady();
    }
    const readByList = Array.from(new Set(Array.isArray(item.readBy) ? item.readBy : []));
    const receiptPayload: Record<string, any> = {
      read: Boolean(item.read || readByList.length > 0),
      readBy: readByList,
      schoolId: targetSchoolId
    };
    if (Array.isArray(item.readBeforeEditBy) && item.readBeforeEditBy.length > 0) {
      receiptPayload.readBeforeEditBy = Array.from(new Set(item.readBeforeEditBy));
    }
    if (Array.isArray(item.readAfterEditBy) && item.readAfterEditBy.length > 0) {
      receiptPayload.readAfterEditBy = Array.from(new Set(item.readAfterEditBy));
    }
    const synced = getOrCreateSyncedIds(targetSchoolId);
    const existsInCloud = synced[collName].has(item.id);
    if (existsInCloud) {
      await setDoc(doc(db, 'schools', targetSchoolId, collName, item.id), receiptPayload, { merge: true });
    } else {
      try {
        await setDoc(doc(db, 'schools', targetSchoolId, collName, item.id), receiptPayload, { merge: true });
      } catch {
        const fullClean = JSON.parse(JSON.stringify({ ...item, ...receiptPayload, schoolId: targetSchoolId }));
        await setDoc(doc(db, 'schools', targetSchoolId, collName, item.id), fullClean, { merge: true });
      }
    }
    const fullSnapshot = JSON.parse(JSON.stringify({ ...item, ...receiptPayload, schoolId: targetSchoolId }));
    docSnapshots.set(docPath, stableSerialize(fullSnapshot));
    synced[collName].add(item.id);
  } catch (error) {
    docSnapshots.delete(docPath);
    console.warn(`saveReadReceipt warning on ${docPath}:`, error);
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

  let hasRetriedListeners = false;

  const handleSubError = (err: unknown, op: OperationType, path: string) => {
    if (isCancelled) return;
    const msg = err instanceof Error ? err.message : String(err);
    if (!hasRetriedListeners && msg.toLowerCase().includes('permission')) {
      hasRetriedListeners = true;
      setTimeout(async () => {
        if (isCancelled || !auth.currentUser) return;
        try {
          if (currentSessionUser) {
            await syncUserAuthUidMap(
              currentSessionUser.schoolId,
              currentSessionUser.id,
              currentSessionUser.role,
              auth.currentUser.uid
            );
          }
          await auth.currentUser.getIdToken(true);
        } catch {}
        if (isCancelled) return;
        unsubs.forEach(u => {
          try { u(); } catch {}
        });
        unsubs.length = 0;
        startListeners();
      }, 600);
      return;
    }
    console.warn(`Subscription warning on ${path}:`, err);
  };

  const startListeners = () => {
    if (isCancelled || !auth.currentUser) return;

    // 1. School Root Document
    const unsubSchool = onSnapshot(doc(db, 'schools', schoolId), async (snap) => {
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
        const schoolClasses = Array.isArray(data.classes)
          ? (data.classes.length > 0 || schoolId !== 'school_1' ? data.classes : [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }])
          : (schoolId === 'school_1' ? [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }] : []);
        const schoolQuarters = data.quarters || { Q1: [], Q2: [], Q3: [], Q4: [] };

        const rawSchedSettings = data.scheduleSettings || {};
        const normalizedScheduleSettings = {
          ...rawSchedSettings,
          daysToAddBatch: typeof rawSchedSettings.daysToAddBatch === 'number' && rawSchedSettings.daysToAddBatch > 0 ? rawSchedSettings.daysToAddBatch : 1,
          skippedWeekDays: Array.isArray(rawSchedSettings.skippedWeekDays) ? rawSchedSettings.skippedWeekDays : [0],
          holidays: Array.isArray(rawSchedSettings.holidays) ? rawSchedSettings.holidays : [],
          vacations: Array.isArray(rawSchedSettings.vacations) ? rawSchedSettings.vacations : [],
          quarterDefinitions: {
            'Q1': rawSchedSettings.quarterDefinitions?.['Q1'] || { start: '', end: '' },
            'Q2': rawSchedSettings.quarterDefinitions?.['Q2'] || { start: '', end: '' },
            'Q3': rawSchedSettings.quarterDefinitions?.['Q3'] || { start: '', end: '' },
            'Q4': rawSchedSettings.quarterDefinitions?.['Q4'] || { start: '', end: '' },
          }
        };

        let resolvedEduUrl = typeof data.educationalResourceUrl === 'string' ? data.educationalResourceUrl : '';
        let resolvedEduResources: any[] | undefined = Array.isArray(data.educationalResources) ? data.educationalResources : undefined;
        const rawSchoolInfoFromDoc: string | undefined = typeof data.schoolInfo === 'string' ? data.schoolInfo : undefined;
        let resolvedSchoolInfo: string | undefined = await resolvePossiblyChunkedField(schoolId, 'schoolInfo', rawSchoolInfoFromDoc);
        if (isCancelled) return;
        if (schoolId === 'school_1' && resolvedSchoolInfo !== undefined) {
          resolvedSchoolInfo = normalizeLegacySchool1Info(resolvedSchoolInfo);
        }

        const rawEljurInfoFromDoc: string | undefined = typeof (data.eljurInfo ?? data.settings?.eljurInfo) === 'string'
          ? (data.eljurInfo ?? data.settings?.eljurInfo)
          : undefined;
        const resolvedEljurInfo: string | undefined = await resolvePossiblyChunkedField(schoolId, 'eljurInfo', rawEljurInfoFromDoc);
        if (isCancelled) return;

        let resolvedSchoolName = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : '';
        try {
          if (resolvedSchoolName) {
            localStorage.setItem(`eljur_school_name_${schoolId}`, resolvedSchoolName);
            if (currentSessionUser?.schoolId === schoolId) {
              localStorage.setItem('eljur_last_school_name', resolvedSchoolName);
            }
          } else {
            const cachedSchoolName = localStorage.getItem(`eljur_school_name_${schoolId}`);
            if (cachedSchoolName && cachedSchoolName.trim()) {
              resolvedSchoolName = cachedSchoolName.trim();
            }
          }
          if (resolvedEduUrl) {
            localStorage.setItem(`eljur_edu_url_${schoolId}`, resolvedEduUrl);
          } else {
            const cachedEduUrl = localStorage.getItem(`eljur_edu_url_${schoolId}`);
            if (cachedEduUrl) {
              resolvedEduUrl = cachedEduUrl;
            }
          }
          if (resolvedEduResources !== undefined) {
            localStorage.setItem(`eljur_edu_resources_${schoolId}`, JSON.stringify(resolvedEduResources));
          } else {
            const cachedEduRes = localStorage.getItem(`eljur_edu_resources_${schoolId}`);
            if (cachedEduRes) {
              const parsed = JSON.parse(cachedEduRes);
              if (Array.isArray(parsed)) resolvedEduResources = parsed;
            }
          }
          if (resolvedSchoolInfo !== undefined && !isChunkedInfoDescriptorString(resolvedSchoolInfo)) {
            if (resolvedSchoolInfo.length <= 400000) {
              localStorage.setItem(`eljur_school_info_${schoolId}`, resolvedSchoolInfo);
            } else {
              localStorage.removeItem(`eljur_school_info_${schoolId}`);
            }
          } else {
            const cachedSchoolInfo = localStorage.getItem(`eljur_school_info_${schoolId}`);
            if (cachedSchoolInfo !== null && !isChunkedInfoDescriptorString(cachedSchoolInfo)) {
              resolvedSchoolInfo = schoolId === 'school_1' ? normalizeLegacySchool1Info(cachedSchoolInfo) : cachedSchoolInfo;
            } else if (schoolId === 'school_1' && !rawSchoolInfoFromDoc) {
              resolvedSchoolInfo = DEFAULT_SCHOOL_1_INFO_HTML;
              localStorage.setItem(`eljur_school_info_${schoolId}`, resolvedSchoolInfo);
            }
          }
        } catch {}
        if (!resolvedSchoolName) {
          resolvedSchoolName = schoolId === 'school_1' ? 'Гимназия №1 им. А.С. Пушкина' : 'Школа №1';
        }

        const resolvedSchoolTz = data.timezone || data.settings?.schoolsSettings?.[schoolId]?.timezone || data.settings?.timezone || 'UTC+3';
        const schoolLevelSettings = data.settings ? { ...data.settings } : ({} as any);
        schoolLevelSettings.timezone = resolvedSchoolTz;
        delete schoolLevelSettings.theme;
        delete schoolLevelSettings.language;
        delete schoolLevelSettings.showSeasonalAnimations;
        delete schoolLevelSettings.bodyFontId;
        delete schoolLevelSettings.headingFontId;
        delete schoolLevelSettings.schoolsSettings;
        delete schoolLevelSettings.schoolInfo;

        const snapshotSettings = { ...schoolLevelSettings };
        if (resolvedEljurInfo !== undefined) {
          schoolLevelSettings.eljurInfo = resolvedEljurInfo;
        }

        const snapshotSchoolInfo = isChunkedInfoDescriptorString(rawSchoolInfoFromDoc)
          ? rawSchoolInfoFromDoc
          : resolvedSchoolInfo;

        docSnapshots.set(`schools/${schoolId}`, stableSerialize({
          id: data.id || schoolId,
          name: resolvedSchoolName,
          directorId: data.directorId ?? (schoolId === 'school_1' ? 'u_dir' : ''),
          timezone: resolvedSchoolTz,
          classes: schoolClasses,
          subjects: schoolSubjects,
          quarters: schoolQuarters,
          gradingSystem: data.gradingSystem,
          gradeTypes: data.gradeTypes,
          subjectRequirements: data.subjectRequirements,
          scheduleSettings: normalizedScheduleSettings,
          educationalResourceUrl: resolvedEduUrl,
          ...(resolvedEduResources !== undefined ? { educationalResources: resolvedEduResources } : {}),
          ...(snapshotSchoolInfo !== undefined ? { schoolInfo: snapshotSchoolInfo } : {}),
          settings: snapshotSettings
        }));

        onUpdate({
          schools: [{
            id: data.id || schoolId,
            name: resolvedSchoolName,
            directorId: data.directorId ?? (schoolId === 'school_1' ? 'u_dir' : ''),
            timezone: resolvedSchoolTz,
            classes: schoolClasses,
            subjects: schoolSubjects,
            quarters: schoolQuarters,
            gradingSystem: data.gradingSystem,
            gradeTypes: data.gradeTypes,
            subjectRequirements: data.subjectRequirements,
            scheduleSettings: normalizedScheduleSettings,
            educationalResourceUrl: resolvedEduUrl,
            ...(resolvedEduResources !== undefined ? { educationalResources: resolvedEduResources } : {}),
            ...(resolvedSchoolInfo !== undefined ? { schoolInfo: resolvedSchoolInfo } : {}),
            eljurInfo: resolvedEljurInfo ?? data.eljurInfo ?? data.settings?.eljurInfo
          } as any],
          classes: schoolClasses,
          subjects: schoolSubjects,
          quarters: schoolQuarters,
          gradingSystem: data.gradingSystem,
          gradeTypes: data.gradeTypes,
          subjectRequirements: data.subjectRequirements,
          scheduleSettings: normalizedScheduleSettings,
          settings: schoolLevelSettings
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
        const cleanDoc = { ...uData, schoolId: uData.schoolId || schoolId };
        docSnapshots.set(`schools/${schoolId}/users/${d.id}`, stableSerialize(cleanDoc));
        return cleanDoc;
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
        const rawDays = data.days || {};
        const byDate = new Map<string, { k: string; day: any; score: number }>();
        Object.entries(rawDays).forEach(([k, day]: [string, any]) => {
          if (!day || !day.date) return;
          const lessons = Array.isArray(day.lessons) ? day.lessons : [];
          const score = lessons.filter((l: any) => l && (l.lesson || (l.subgroups && l.subgroups.length > 0))).length;
          const prev = byDate.get(day.date);
          if (!prev || score >= prev.score) {
            byDate.set(day.date, { k, day: { ...day, id: day.id || k, lessons }, score });
          }
        });
        const cleanDays: Record<string, any> = {};
        byDate.forEach(({ k, day }) => {
          cleanDays[k] = day;
        });
        schedules[key] = cleanDays;
        docSnapshots.set(`schools/${schoolId}/schedules/${d.id}`, stableSerialize({ id: d.id, days: cleanDays }));
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
        grades[key] = data.entries || {};
        docSnapshots.set(`schools/${schoolId}/grades/${d.id}`, stableSerialize({ id: d.id, entries: data.entries || {} }));
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
        finalGrades[key] = data.entries || {};
        docSnapshots.set(`schools/${schoolId}/finalGrades/${d.id}`, stableSerialize({ id: d.id, entries: data.entries || {} }));
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
        return { ...hwData, schoolId: hwData.schoolId || schoolId };
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
        const normalized = {
          ...msgData,
          title: msgData.title || msgData.subject || '',
          body: msgData.body || msgData.text || msgData.content || '',
          schoolId: msgData.schoolId || schoolId
        };
        const { item: hydratedMsg, modified } = applyLocalReadReceipts(normalized);
        docSnapshots.set(`schools/${schoolId}/messages/${d.id}`, stableSerialize(hydratedMsg));
        if (modified) {
          saveReadReceipt(schoolId, 'messages', hydratedMsg).catch(() => {});
        }
        return hydratedMsg;
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
        const normalized = {
          ...annData,
          title: annData.title || annData.subject || '',
          body: annData.body || annData.text || annData.content || '',
          schoolId: annData.schoolId || schoolId
        };
        const { item: hydratedAnn, modified } = applyLocalReadReceipts(normalized);
        docSnapshots.set(`schools/${schoolId}/announcements/${d.id}`, stableSerialize(hydratedAnn));
        if (modified) {
          saveReadReceipt(schoolId, 'announcements', hydratedAnn).catch(() => {});
        }
        return hydratedAnn;
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
        return { ...taData, schoolId: taData.schoolId || schoolId };
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
        return { ...sgData, schoolId: sgData.schoolId || schoolId };
      });
      onUpdate({ studentGroups });
    }, (err) => handleSubError(err, OperationType.LIST, `schools/${schoolId}/studentGroups`));
    unsubs.push(unsubGroups);

    // 11. Global Creator Gate (Time Machine systemTimeOffset & gate settings)
    const unsubGlobalGate = onSnapshot(doc(db, 'schools', 'school_1', 'publicConfig', 'creatorGate'), (snap) => {
      if (isCancelled) return;
      if (snap.exists()) {
        const gData = snap.data() as any;
        if (typeof gData.systemTimeOffset === 'number') {
          onUpdate({
            settings: {
              systemTimeOffset: gData.systemTimeOffset
            } as any
          });
        }
      }
    }, () => {});
    unsubs.push(unsubGlobalGate);
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
    unsub = onSnapshot(collection(db, 'schools'), async (snap) => {
      if (isCancelled) return;
      const schools = await Promise.all(
        snap.docs
          .filter(d => d.id !== 'global')
          .map(async d => {
            const data = d.data() || {};
            const sId = data.id || d.id;
            if (typeof data.name === 'string' && data.name.trim()) {
              try {
                localStorage.setItem(`eljur_school_name_${sId}`, data.name.trim());
              } catch {}
            }
            const resolvedSchoolInfo = typeof data.schoolInfo === 'string'
              ? await resolvePossiblyChunkedField(sId, 'schoolInfo', data.schoolInfo)
              : undefined;
            const rawEljur = data.eljurInfo ?? data.settings?.eljurInfo;
            const resolvedEljurInfo = typeof rawEljur === 'string'
              ? await resolvePossiblyChunkedField(sId, 'eljurInfo', rawEljur)
              : undefined;
            const rawSched = data.scheduleSettings || {};
            return {
              ...data,
              id: sId,
              ...(resolvedSchoolInfo !== undefined
                ? { schoolInfo: sId === 'school_1' ? normalizeLegacySchool1Info(resolvedSchoolInfo) : resolvedSchoolInfo }
                : {}),
              ...(resolvedEljurInfo !== undefined ? { eljurInfo: resolvedEljurInfo } : {}),
              scheduleSettings: {
                ...rawSched,
                daysToAddBatch: typeof rawSched.daysToAddBatch === 'number' && rawSched.daysToAddBatch > 0 ? rawSched.daysToAddBatch : 1,
                skippedWeekDays: Array.isArray(rawSched.skippedWeekDays) ? rawSched.skippedWeekDays : [0],
                holidays: Array.isArray(rawSched.holidays) ? rawSched.holidays : [],
                vacations: Array.isArray(rawSched.vacations) ? rawSched.vacations : [],
                quarterDefinitions: {
                  'Q1': rawSched.quarterDefinitions?.['Q1'] || { start: '', end: '' },
                  'Q2': rawSched.quarterDefinitions?.['Q2'] || { start: '', end: '' },
                  'Q3': rawSched.quarterDefinitions?.['Q3'] || { start: '', end: '' },
                  'Q4': rawSched.quarterDefinitions?.['Q4'] || { start: '', end: '' },
                }
              }
            };
          })
      );
      if (!isCancelled) {
        callback(schools);
      }
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

    const canWriteSchoolDoc = isDirectorOrCreator || isEmployee || isTeacher;
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

    // 1. School Root Document & Creator Gate
    if (canWriteSchoolDoc) {
      const school = (plainState.schools || []).find((s: any) => s.id === schoolId) || plainState.schools?.[0];
      if (school) {
        const schoolQuarters = school.quarters || (schoolId === 'school_1' ? plainState.quarters : undefined) || { Q1: [], Q2: [], Q3: [], Q4: [] };
        if (isDirectorOrCreator || isEmployee) {
          let resolvedEduUrl: string | undefined = typeof school.educationalResourceUrl === 'string'
            ? school.educationalResourceUrl
            : undefined;
          let resolvedEduResources: any[] | undefined = Array.isArray(school.educationalResources)
            ? school.educationalResources
            : undefined;
          let resolvedSchoolInfo: string | undefined = typeof school.schoolInfo === 'string'
            ? school.schoolInfo
            : undefined;
          try {
            if (resolvedEduUrl === undefined) {
              const cachedEdu = localStorage.getItem(`eljur_edu_url_${schoolId}`);
              if (cachedEdu !== null) resolvedEduUrl = cachedEdu;
            }
            if (resolvedEduResources === undefined) {
              const cachedRes = localStorage.getItem(`eljur_edu_resources_${schoolId}`);
              if (cachedRes) {
                const parsed = JSON.parse(cachedRes);
                if (Array.isArray(parsed)) resolvedEduResources = parsed;
              }
            }
            if (resolvedSchoolInfo === undefined) {
              const cachedInfo = localStorage.getItem(`eljur_school_info_${schoolId}`);
              if (cachedInfo !== null && !isChunkedInfoDescriptorString(cachedInfo)) {
                resolvedSchoolInfo = cachedInfo;
              }
            }
          } catch {}
          if (typeof school.name === 'string' && school.name.trim()) {
            try {
              localStorage.setItem(`eljur_school_name_${schoolId}`, school.name.trim());
            } catch {}
          }
          const schoolPayload: any = {
            id: school.id || schoolId,
            name: school.name || (schoolId === 'school_1' ? 'Гимназия №1 им. А.С. Пушкина' : 'Школа №1'),
            directorId: school.directorId ?? (schoolId === 'school_1' ? 'u_dir' : ''),
            classes: Array.isArray(school.classes)
              ? school.classes
              : (schoolId === 'school_1' ? (plainState.classes || [{ class: '10', letter: 'А', headmasterId: 'u_teacher' }]) : []),
            subjects: Array.isArray(school.subjects) && school.subjects.length > 0
              ? school.subjects
              : (schoolId === 'school_1' && plainState.subjects?.length ? plainState.subjects : [
                  'Математика', 'Русский язык', 'Физика', 'Литература', 'История',
                  'Химия', 'Биология', 'География', 'Английский язык', 'Физкультура', 'Информатика'
                ]),
            quarters: schoolQuarters,
            gradingSystem: school.gradingSystem || plainState.schoolGradingSystems?.[schoolId] || (schoolId === 'school_1' ? plainState.gradingSystem : { minGrade: 2, maxGrade: 5, useWeights: true }),
            gradeTypes: school.gradeTypes || plainState.schoolGradeTypes?.[schoolId] || (schoolId === 'school_1' ? plainState.gradeTypes : []),
            subjectRequirements: school.subjectRequirements || (schoolId === 'school_1' ? plainState.subjectRequirements : {}),
            scheduleSettings: school.scheduleSettings || plainState.schoolScheduleSettings?.[schoolId] || (schoolId === 'school_1' ? plainState.scheduleSettings : undefined),
            timezone: (school as any).timezone || plainState.settings?.schoolsSettings?.[schoolId]?.timezone || plainState.schoolsSettings?.[schoolId]?.timezone || plainState.settings?.timezone || 'UTC+3',
            settings: (() => {
              const rawSettings = plainState.settings || plainState.schoolsSettings?.[schoolId];
              if (!rawSettings) return undefined;
              const cleaned = {
                ...rawSettings,
                ...(plainState.settings?.schoolsSettings?.[schoolId] || {}),
                systemTimeOffset: plainState.settings?.systemTimeOffset ?? 0,
                timezone: (school as any).timezone || plainState.settings?.schoolsSettings?.[schoolId]?.timezone || plainState.schoolsSettings?.[schoolId]?.timezone || plainState.settings?.timezone || 'UTC+3'
              };
              delete cleaned.theme;
              delete cleaned.language;
              delete cleaned.showSeasonalAnimations;
              delete cleaned.bodyFontId;
              delete cleaned.headingFontId;
              delete cleaned.schoolsSettings;
              delete cleaned.schoolInfo;
              return cleaned;
            })()
          };
          if (resolvedEduUrl !== undefined) {
            schoolPayload.educationalResourceUrl = resolvedEduUrl;
          }
          if (resolvedEduResources !== undefined) {
            schoolPayload.educationalResources = resolvedEduResources;
          }
          if (resolvedSchoolInfo !== undefined) {
            schoolPayload.schoolInfo = await persistLargeFieldIfNeeded(schoolId, 'schoolInfo', resolvedSchoolInfo);
          }
          if (schoolPayload.settings && typeof schoolPayload.settings.eljurInfo === 'string') {
            schoolPayload.settings.eljurInfo = await persistLargeFieldIfNeeded(schoolId, 'eljurInfo', schoolPayload.settings.eljurInfo);
          }
          queueSetIfChanged(doc(db, 'schools', schoolId), `schools/${schoolId}`, schoolPayload, true);
        }

        if (isDirectorOrCreator) {
          const activeSettings = plainState.settings || plainState.schoolsSettings?.[schoolId];
          if (activeSettings) {
            const gatePayload: any = {
              secretKey: activeSettings.secretKey || 'Space',
              secretCount: activeSettings.secretCount || 4,
              systemTimeOffset: activeSettings.systemTimeOffset ?? 0
            };
            if (activeSettings.adminPassword) gatePayload.adminPassword = activeSettings.adminPassword;
            if (activeSettings.adminPasswordHash) gatePayload.adminPasswordHash = activeSettings.adminPasswordHash;
            if (activeSettings.adminPasswordSalt) gatePayload.adminPasswordSalt = activeSettings.adminPasswordSalt;
            if (typeof activeSettings.eljurInfo === 'string') {
              gatePayload.eljurInfo = await persistLargeFieldIfNeeded(schoolId, 'eljurInfo', activeSettings.eljurInfo);
            }
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
        delete userDoc.theme;
        delete userDoc.language;
        delete userDoc.showSeasonalAnimations;
        delete userDoc.bodyFontId;
        delete userDoc.headingFontId;
        delete (userDoc as any).fcmTokens;
        delete (userDoc as any).notificationsEnabled;
        delete (userDoc as any).pushToken;
        delete (userDoc as any).notificationSettings;
        queueSetIfChanged(doc(db, 'schools', schoolId, 'users', u.id), `schools/${schoolId}/users/${u.id}`, userDoc, true);
        synced.users.add(u.id);
      }
    }

    // 3. Schedules diff & sync
    if (canWriteSchedules) {
      const currentActiveScheduleKeys = new Set<string>();
      for (const [k, days] of Object.entries(plainState.schedules || {})) {
        if (k.startsWith(`${schoolId}__`) || (!k.includes('__') && schoolId === 'school_1')) {
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
        if (k.startsWith(`${schoolId}__`) || (!k.includes('__') && schoolId === 'school_1')) {
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
        if (k.startsWith(`${schoolId}__`) || (!k.includes('__') && schoolId === 'school_1')) {
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
      const schoolHomework = (plainState.homework || []).filter((h: any) => h.schoolId === schoolId || (!h.schoolId && schoolId === 'school_1'));
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
    const schoolAnnouncements = (plainState.announcements || []).filter((a: any) => a.schoolId === schoolId || (!a.schoolId && schoolId === 'school_1'));
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
          const docPath = `schools/${schoolId}/announcements/${ann.id}`;
          const fullCleaned = JSON.parse(JSON.stringify({ ...ann, schoolId }));
          const serialized = stableSerialize(fullCleaned);
          if (docSnapshots.get(docPath) !== serialized) {
            docSnapshots.set(docPath, serialized);
            const readByList = Array.from(new Set(Array.isArray(ann.readBy) ? ann.readBy : []));
            const receiptOnly: Record<string, any> = {
              read: Boolean(ann.read || readByList.length > 0),
              readBy: readByList,
              schoolId
            };
            if (Array.isArray(ann.readBeforeEditBy) && ann.readBeforeEditBy.length > 0) {
              receiptOnly.readBeforeEditBy = Array.from(new Set(ann.readBeforeEditBy));
            }
            if (Array.isArray(ann.readAfterEditBy) && ann.readAfterEditBy.length > 0) {
              receiptOnly.readAfterEditBy = Array.from(new Set(ann.readAfterEditBy));
            }
            writeOps.push(
              setDoc(doc(db, 'schools', schoolId, 'announcements', ann.id), receiptOnly, { merge: true }).catch((err) => {
                docSnapshots.delete(docPath);
                handleFirestoreError(err, OperationType.WRITE, docPath);
              })
            );
          }
        }
      }
    }

    // 8. Messages diff & sync (all school members can create messages, update readBy, and delete their own messages)
    const schoolUserIdSet = new Set(schoolUsers.map((u: any) => u.id));
    const schoolMessages = (plainState.messages || []).filter((m: any) =>
      m.schoolId === schoolId ||
      (!m.schoolId && schoolId === 'school_1') ||
      (Array.isArray(m.toIds) && m.toIds.some((tid: string) => schoolUserIdSet.has(tid)))
    );
    const currentMsgIds = new Set(schoolMessages.map((m: any) => m.id));
    for (const prevId of Array.from(synced.messages)) {
      if (!currentMsgIds.has(prevId)) {
        queueDelete(doc(db, 'schools', schoolId, 'messages', prevId), `schools/${schoolId}/messages/${prevId}`);
        synced.messages.delete(prevId);
      }
    }
    for (const msg of schoolMessages) {
      const docPath = `schools/${schoolId}/messages/${msg.id}`;
      const isSenderOrAdmin = isDirectorOrCreator || msg.fromId === currentUserId || (isEmployee && currentSessionUser?.employeePermissions?.canSendAsDirector);
      if (synced.messages.has(msg.id) && !isSenderOrAdmin) {
        const fullCleaned = JSON.parse(JSON.stringify({ ...msg, schoolId }));
        const serialized = stableSerialize(fullCleaned);
        if (docSnapshots.get(docPath) !== serialized) {
          docSnapshots.set(docPath, serialized);
          const readByList = Array.from(new Set(Array.isArray(msg.readBy) ? msg.readBy : []));
          const receiptOnly: Record<string, any> = {
            read: Boolean(msg.read || readByList.length > 0),
            readBy: readByList,
            schoolId
          };
          if (Array.isArray(msg.readBeforeEditBy) && msg.readBeforeEditBy.length > 0) {
            receiptOnly.readBeforeEditBy = Array.from(new Set(msg.readBeforeEditBy));
          }
          if (Array.isArray(msg.readAfterEditBy) && msg.readAfterEditBy.length > 0) {
            receiptOnly.readAfterEditBy = Array.from(new Set(msg.readAfterEditBy));
          }
          writeOps.push(
            setDoc(doc(db, 'schools', schoolId, 'messages', msg.id), receiptOnly, { merge: true }).catch((err) => {
              docSnapshots.delete(docPath);
              handleFirestoreError(err, OperationType.WRITE, docPath);
            })
          );
        }
      } else {
        queueSetIfChanged(
          doc(db, 'schools', schoolId, 'messages', msg.id),
          docPath,
          { ...msg, schoolId },
          true
        );
        synced.messages.add(msg.id);
      }
    }

    // 9. Teacher Assignments & Student Groups diff & sync
    if (canManageLoadAndGroups) {
      const schoolAssignments = (plainState.teacherAssignments || []).filter((t: any) => t.schoolId === schoolId || (!t.schoolId && schoolId === 'school_1'));
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

      const schoolGroups = (plainState.studentGroups || []).filter((g: any) => g.schoolId === schoolId || (!g.schoolId && schoolId === 'school_1'));
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
