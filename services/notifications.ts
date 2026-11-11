import { AppState, User } from '../types';
import * as H from '../utils/helpers';
import { auth } from './db';
import firebaseConfig from '../firebase-applet-config.json';

export interface EljurNotificationItem {
  id: string;
  category: 'message' | 'announcement' | 'grade' | 'final_grade' | 'homework';
  title: string;
  body: string;
  targetUserId: string;
  targetUserFio: string;
  targetUserRole: User['role'];
  schoolId: string;
  targetTab: string;
  createdAt: number;
}

interface StoredTargetUser {
  id: string;
  fio: string;
  role: User['role'];
  schoolId: string;
  class?: string;
  letter?: string;
  customRole?: string;
  login?: string;
  password?: string;
}

interface UserNotificationBaseline {
  userId: string;
  schoolId: string;
  updatedAt: number;
  messages: Record<string, string>;
  announcements: Record<string, string>;
  homework: Record<string, string>;
  grades: Record<string, string>;
  finalGrades: Record<string, string>;
}

const TARGET_USER_STORAGE_KEY = 'eljur_notify_target_user_v1';
const NOTIFICATIONS_ENABLED_KEY = 'eljur_notifications_enabled_v1';
const BASELINE_KEY_PREFIX = 'eljur_notify_baseline_v1_';
const BG_CACHE_NAME = 'eljur-bg-watcher-v1';
const WATCHER_STATE_URL = 'https://eljur.local/watcher-state';
const PENDING_CLICK_URL = 'https://eljur.local/pending-click';

export const areNotificationsEnabled = (): boolean => {
  try {
    const val = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    if (val === null) return true;
    return val !== 'false';
  } catch {
    return true;
  }
};

export const setNotificationsEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
};

export const getSystemNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return window.Notification.permission;
};

export const requestSystemNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await window.Notification.requestPermission();
    return result;
  } catch {
    return window.Notification.permission;
  }
};

/**
 * Saves the most recent non-creator user who logged in on this device.
 * If someone logs in as Creator, the previously saved non-creator user is preserved.
 */
export const saveLastNonCreatorTargetUser = (user: User | null | undefined): void => {
  if (!user || !user.id || user.role === 'creator') return;
  try {
    const record: StoredTargetUser = {
      id: user.id,
      fio: user.fio || '',
      role: user.role,
      schoolId: user.schoolId && user.schoolId !== 'global' ? user.schoolId : 'school_1',
      class: user.class,
      letter: user.letter,
      customRole: user.customRole,
      login: user.login,
      password: user.password
    };
    localStorage.setItem(TARGET_USER_STORAGE_KEY, JSON.stringify(record));
  } catch {}
};

/**
 * Returns the active notification target user:
 * - If currentUser is logged in and is NOT creator -> currentUser (and updates stored target).
 * - If currentUser is null (Login screen) or is creator -> the last non-creator user saved on this device.
 */
export const getNotificationTargetUser = (
  currentUser: User | null | undefined,
  state: AppState | null | undefined
): User | null => {
  if (currentUser && currentUser.role !== 'creator') {
    const latestFromState = (state?.users || []).find(u => u.id === currentUser.id);
    const merged: User = latestFromState ? { ...currentUser, ...latestFromState, password: currentUser.password || latestFromState.password } : currentUser;
    saveLastNonCreatorTargetUser(merged);
    return merged;
  }

  try {
    const raw = localStorage.getItem(TARGET_USER_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredTargetUser;
    if (!stored || !stored.id || stored.role === 'creator') return null;

    const latestFromState = (state?.users || []).find(u => u.id === stored.id);
    if (latestFromState && latestFromState.role !== 'creator') {
      const merged: User = {
        ...stored,
        ...latestFromState,
        schoolId: latestFromState.schoolId || stored.schoolId || 'school_1',
        password: stored.password || latestFromState.password
      } as User;
      return merged;
    }

    return {
      id: stored.id,
      fio: stored.fio,
      role: stored.role,
      schoolId: stored.schoolId || 'school_1',
      class: stored.class,
      letter: stored.letter,
      customRole: stored.customRole,
      login: stored.login || stored.id,
      password: stored.password
    } as User;
  } catch {
    return null;
  }
};

export const playNotificationSound = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.11); // A5

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.34);
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 500);
  } catch {}
};

export const dispatchSystemNotification = async (item: EljurNotificationItem): Promise<void> => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;

  const iconUrl = `${import.meta.env.BASE_URL || './'}pwa-192x192.png`;
  const navData = {
    notificationId: item.id,
    targetUserId: item.targetUserId,
    schoolId: item.schoolId,
    targetTab: item.targetTab,
    category: item.category,
    timestamp: Date.now()
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        const swOptions: NotificationOptions & Record<string, unknown> = {
          body: item.body,
          tag: item.id,
          icon: iconUrl,
          badge: iconUrl,
          vibrate: [200, 100, 200],
          renotify: true,
          requireInteraction: false,
          data: navData
        };
        await reg.showNotification(item.title, swOptions);
        return;
      }
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            title: item.title,
            body: item.body,
            tag: item.id,
            icon: iconUrl,
            badge: iconUrl,
            navData
          }
        });
        return;
      }
    }
  } catch {}

  try {
    const n = new window.Notification(item.title, {
      body: item.body,
      tag: item.id,
      icon: iconUrl,
      data: navData
    });
    n.onclick = () => {
      try { window.focus(); } catch {}
      window.dispatchEvent(new CustomEvent('eljur-notification-click', { detail: navData }));
      n.close();
    };
  } catch {}
};

const stripCleanText = (raw: string | undefined, maxLen = 140): string => {
  if (!raw) return '';
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1)}…`;
};

const buildCurrentSnapshot = (
  state: AppState,
  targetUser: User
): {
  baseline: UserNotificationBaseline;
  meta: {
    messagesById: Map<string, any>;
    announcementsById: Map<string, any>;
    homeworkById: Map<string, any>;
    gradesById: Map<string, { subject: string; entry: any }>;
    finalGradesByKey: Map<string, { subject: string; periodKey: string; value: string }>;
  };
} => {
  const schoolId = targetUser.schoolId && targetUser.schoolId !== 'global' ? targetUser.schoolId : 'school_1';
  const messages: Record<string, string> = {};
  const announcements: Record<string, string> = {};
  const homework: Record<string, string> = {};
  const grades: Record<string, string> = {};
  const finalGrades: Record<string, string> = {};

  const messagesById = new Map<string, any>();
  const announcementsById = new Map<string, any>();
  const homeworkById = new Map<string, any>();
  const gradesById = new Map<string, { subject: string; entry: any }>();
  const finalGradesByKey = new Map<string, { subject: string; periodKey: string; value: string }>();

  // 1. Messages addressed to targetUser
  (state.messages || []).forEach((m: any) => {
    if (!m || !m.id) return;
    const msgSchoolId = m.schoolId || 'school_1';
    if (msgSchoolId !== schoolId) return;
    if (!Array.isArray(m.toIds) || !m.toIds.includes(targetUser.id)) return;
    const sig = `${m.date || ''}|${m.editedAt || ''}`;
    messages[m.id] = sig;
    messagesById.set(m.id, m);
  });

  // 2. Announcements visible to targetUser
  const studentClassKey = targetUser.role === 'student' && targetUser.class
    ? `${targetUser.class}_${targetUser.letter || ''}`
    : '';

  (state.announcements || []).forEach((a: any) => {
    if (!a || !a.id) return;
    const annSchoolId = a.schoolId || 'school_1';
    if (annSchoolId !== schoolId) return;

    const hasExplicitRecipients = Array.isArray(a.toIds) && a.toIds.length > 0;
    const hasTargetClasses = Array.isArray((a as any).targetClasses) && (a as any).targetClasses.length > 0;

    let isRecipient = true;
    if (hasExplicitRecipients) {
      isRecipient = a.toIds.includes(targetUser.id);
    } else if (hasTargetClasses && targetUser.role === 'student') {
      isRecipient = Boolean(studentClassKey && (a as any).targetClasses.includes(studentClassKey));
    }
    if (!isRecipient) return;

    const sig = `${a.date || ''}|${a.editedAt || ''}`;
    announcements[a.id] = sig;
    announcementsById.set(a.id, a);
  });

  // 3. Student-specific: Grades, Final Grades, Homework
  if (targetUser.role === 'student' && targetUser.class) {
    const classKey = `${targetUser.class}_${targetUser.letter || ''}`;
    const scopedClassKey = `${schoolId}__${classKey}`;

    // Current Grades
    const classGrades =
      state.grades?.[scopedClassKey] ||
      (schoolId === 'school_1' ? state.grades?.[classKey] : undefined) ||
      {};

    Object.entries(classGrades).forEach(([subject, entries]: [string, any]) => {
      if (!Array.isArray(entries)) return;
      entries.forEach((entry: any) => {
        if (!entry || !entry.id || entry.studentId !== targetUser.id || !entry.value) return;
        const sig = `${subject}|${entry.value}|${entry.date || ''}|${entry.type || ''}|${entry.comment || ''}`;
        grades[entry.id] = sig;
        gradesById.set(entry.id, { subject, entry });
      });
    });

    // Final Grades (Quarter / Year / Exam / Final)
    const classFinalGrades =
      state.finalGrades?.[scopedClassKey] ||
      (schoolId === 'school_1' ? state.finalGrades?.[classKey] : undefined) ||
      {};

    const periodKeys = ['q1', 'q2', 'q3', 'q4', 'year', 'exam', 'final'] as const;
    Object.entries(classFinalGrades).forEach(([subject, entries]: [string, any]) => {
      if (!Array.isArray(entries)) return;
      const stEntry = entries.find((e: any) => e && e.studentId === targetUser.id);
      if (!stEntry) return;
      periodKeys.forEach((pKey) => {
        const val = stEntry[pKey];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const mapKey = `${subject}__${pKey}`;
          const cleanVal = String(val).trim();
          finalGrades[mapKey] = cleanVal;
          finalGradesByKey.set(mapKey, { subject, periodKey: pKey, value: cleanVal });
        }
      });
    });

    // Homework for student's class & subgroup
    const schoolGroups = (state.studentGroups || []).filter(
      (g: any) => (g.schoolId || 'school_1') === schoolId && g.classId === classKey
    );

    (state.homework || []).forEach((hw: any) => {
      if (!hw || !hw.id) return;
      const hwSchoolId = hw.schoolId || 'school_1';
      if (hwSchoolId !== schoolId) return;
      if (hw.class !== targetUser.class || (hw.letter || '') !== (targetUser.letter || '')) return;
      if (!hw.text || !String(hw.text).trim()) return;

      if (hw.groupId) {
        const grp = schoolGroups.find((g: any) => g.id === hw.groupId);
        if (grp && Array.isArray(grp.studentIds) && !grp.studentIds.includes(targetUser.id)) {
          return;
        }
      }

      const sig = `${hw.subject || ''}|${hw.date || ''}|${String(hw.text).trim()}`;
      homework[hw.id] = sig;
      homeworkById.set(hw.id, hw);
    });
  }

  return {
    baseline: {
      userId: targetUser.id,
      schoolId,
      updatedAt: Date.now(),
      messages,
      announcements,
      homework,
      grades,
      finalGrades
    },
    meta: {
      messagesById,
      announcementsById,
      homeworkById,
      gradesById,
      finalGradesByKey
    }
  };
};

const PERIOD_LABELS_RU: Record<string, string> = {
  q1: 'I четверть',
  q2: 'II четверть',
  q3: 'III четверть',
  q4: 'IV четверть',
  year: 'Годовая',
  exam: 'Экзамен',
  final: 'Итоговая'
};

/**
 * Compares the current AppState for targetUser against the persisted baseline in localStorage.
 * Returns any newly detected notifications and updates the stored baseline.
 */
export const evaluateStateNotifications = (
  state: AppState,
  targetUser: User | null,
  isSchoolCloudReady: boolean,
  lang: 'ru' | 'en' = 'ru'
): EljurNotificationItem[] => {
  if (!state || !targetUser || !targetUser.id || targetUser.role === 'creator') {
    return [];
  }
  if (!isSchoolCloudReady) {
    return [];
  }

  const storageKey = `${BASELINE_KEY_PREFIX}${targetUser.id}`;
  const { baseline: current, meta } = buildCurrentSnapshot(state, targetUser);

  let prev: UserNotificationBaseline | null = null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      prev = JSON.parse(raw) as UserNotificationBaseline;
    }
  } catch {}

  // First time initializing baseline for this user on this device: save silently
  if (!prev || prev.userId !== targetUser.id) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(current));
    } catch {}
    return [];
  }

  const newNotifications: EljurNotificationItem[] = [];
  const schoolId = current.schoolId;
  const userShortName = H.formatShortName(targetUser.fio || targetUser.login || '');

  const resolveSenderName = (fromId: string): string => {
    if (fromId === 'u_creator') return lang === 'ru' ? 'Создатель платформы' : 'Platform Creator';
    const sender = (state.users || []).find(u => u.id === fromId);
    if (!sender) return lang === 'ru' ? 'Администрация' : 'Administration';
    return H.formatShortName(sender.fio);
  };

  // 1. Check new or edited unread messages
  Object.entries(current.messages).forEach(([msgId, sig]) => {
    if (prev!.messages?.[msgId] === sig) return;
    const msg = meta.messagesById.get(msgId);
    if (!msg) return;
    if (msg.fromId === targetUser.id) return;
    if (!H.isMessageUnreadByUser(msg, targetUser.id)) return;

    const senderName = resolveSenderName(msg.fromId);
    const isEdit = Boolean(prev!.messages?.[msgId]);
    const title = lang === 'ru'
      ? `${isEdit ? '💬 Сообщение изменено' : '💬 Новое сообщение'} • ${senderName}`
      : `${isEdit ? '💬 Message updated' : '💬 New message'} • ${senderName}`;
    const subjectPrefix = msg.title ? `${msg.title}: ` : '';
    const body = stripCleanText(`${subjectPrefix}${msg.body || ''}`) || (lang === 'ru' ? 'Откройте раздел «Сообщения»' : 'Open Messages');

    newNotifications.push({
      id: `notif_msg_${msgId}_${sig}`,
      category: 'message',
      title,
      body,
      targetUserId: targetUser.id,
      targetUserFio: userShortName,
      targetUserRole: targetUser.role,
      schoolId,
      targetTab: 'messages',
      createdAt: Date.now()
    });
  });

  // 2. Check new or edited unread announcements
  Object.entries(current.announcements).forEach(([annId, sig]) => {
    if (prev!.announcements?.[annId] === sig) return;
    const ann = meta.announcementsById.get(annId);
    if (!ann) return;
    if (ann.fromId === targetUser.id) return;
    if (!H.isMessageUnreadByUser(ann, targetUser.id)) return;

    const senderName = resolveSenderName(ann.fromId);
    const isEdit = Boolean(prev!.announcements?.[annId]);
    const title = lang === 'ru'
      ? `${isEdit ? '📢 Объявление обновлено' : '📢 Новое объявление'} • ${senderName}`
      : `${isEdit ? '📢 Announcement updated' : '📢 New announcement'} • ${senderName}`;
    const subjectPrefix = ann.title ? `${ann.title}: ` : '';
    const body = stripCleanText(`${subjectPrefix}${ann.body || ''}`) || (lang === 'ru' ? 'Откройте раздел «Объявления»' : 'Open Announcements');

    newNotifications.push({
      id: `notif_ann_${annId}_${sig}`,
      category: 'announcement',
      title,
      body,
      targetUserId: targetUser.id,
      targetUserFio: userShortName,
      targetUserRole: targetUser.role,
      schoolId,
      targetTab: 'announcements',
      createdAt: Date.now()
    });
  });

  const formatShortDateLabel = (isoDate?: string): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}`;
    }
    return isoDate;
  };

  // 3. Student-only: Grades, Final Grades, Homework
  if (targetUser.role === 'student') {
    Object.entries(current.grades).forEach(([gradeId, sig]) => {
      if (prev!.grades?.[gradeId] === sig) return;
      const gInfo = meta.gradesById.get(gradeId);
      if (!gInfo) return;
      const { subject, entry } = gInfo;
      const isEdit = Boolean(prev!.grades?.[gradeId]);
      const title = lang === 'ru'
        ? `${isEdit ? '✏️ Изменена оценка' : '⭐ Новая оценка'}: ${entry.value} (${subject})`
        : `${isEdit ? '✏️ Grade updated' : '⭐ New grade'}: ${entry.value} (${subject})`;
      const dateStr = formatShortDateLabel(entry.date);
      const commentPart = entry.comment ? `${stripCleanText(entry.comment, 90)} • ` : '';
      const body = `${commentPart}${dateStr ? (lang === 'ru' ? `Урок ${dateStr}` : `Date ${dateStr}`) : ''}`.trim() || subject;

      newNotifications.push({
        id: `notif_grade_${gradeId}_${sig}`,
        category: 'grade',
        title,
        body,
        targetUserId: targetUser.id,
        targetUserFio: userShortName,
        targetUserRole: targetUser.role,
        schoolId,
        targetTab: 'grades',
        createdAt: Date.now()
      });
    });

    Object.entries(current.finalGrades).forEach(([fgKey, val]) => {
      if (prev!.finalGrades?.[fgKey] === val) return;
      const fgInfo = meta.finalGradesByKey.get(fgKey);
      if (!fgInfo) return;
      const periodLabel = PERIOD_LABELS_RU[fgInfo.periodKey] || fgInfo.periodKey.toUpperCase();
      const title = lang === 'ru'
        ? `🏆 Итоговая оценка: ${fgInfo.value} (${fgInfo.subject})`
        : `🏆 Final grade: ${fgInfo.value} (${fgInfo.subject})`;
      const body = lang === 'ru'
        ? `Выставлена оценка за период: ${periodLabel}`
        : `Period grade posted: ${periodLabel}`;

      newNotifications.push({
        id: `notif_fgrade_${fgKey}_${val}`,
        category: 'final_grade',
        title,
        body,
        targetUserId: targetUser.id,
        targetUserFio: userShortName,
        targetUserRole: targetUser.role,
        schoolId,
        targetTab: 'grades',
        createdAt: Date.now()
      });
    });

    Object.entries(current.homework).forEach(([hwId, sig]) => {
      if (prev!.homework?.[hwId] === sig) return;
      const hw = meta.homeworkById.get(hwId);
      if (!hw) return;
      const isEdit = Boolean(prev!.homework?.[hwId]);
      const dateStr = formatShortDateLabel(hw.date);
      const title = lang === 'ru'
        ? `${isEdit ? '📚 Обновлено ДЗ' : '📚 Новое ДЗ'}: ${hw.subject}`
        : `${isEdit ? '📚 Homework updated' : '📚 New homework'}: ${hw.subject}`;
      const body = `${dateStr ? (lang === 'ru' ? `На ${dateStr}: ` : `For ${dateStr}: `) : ''}${stripCleanText(hw.text, 120)}`;

      newNotifications.push({
        id: `notif_hw_${hwId}_${sig}`,
        category: 'homework',
        title,
        body,
        targetUserId: targetUser.id,
        targetUserFio: userShortName,
        targetUserRole: targetUser.role,
        schoolId,
        targetTab: 'journal',
        createdAt: Date.now()
      });
    });
  }

  // Merge baseline so temporary empty states never wipe seen history, while updated signatures overwrite
  const nextBaseline: UserNotificationBaseline = {
    userId: targetUser.id,
    schoolId,
    updatedAt: Date.now(),
    messages: { ...(prev.messages || {}), ...current.messages },
    announcements: { ...(prev.announcements || {}), ...current.announcements },
    homework: { ...(prev.homework || {}), ...current.homework },
    grades: { ...(prev.grades || {}), ...current.grades },
    finalGrades: { ...(prev.finalGrades || {}), ...current.finalGrades }
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(nextBaseline));
  } catch {}

  syncServiceWorkerWatcher(state, targetUser, lang, nextBaseline).catch(() => {});

  return newNotifications;
};

/**
 * Merges any baseline updates written by the Service Worker while the app was minimized/backgrounded
 * into localStorage so the main thread does not re-notify for items already notified by the SW.
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

let cachedVapidPublicKey: string | null = null;

const ensureWebPushSubscription = async (
  reg: ServiceWorkerRegistration
): Promise<PushSubscription | null> => {
  if (!reg || !('pushManager' in reg)) return null;
  if (getSystemNotificationPermission() !== 'granted') return null;

  try {
    if (!cachedVapidPublicKey) {
      const res = await fetch('./api/push/vapid-public-key', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.publicKey) {
          cachedVapidPublicKey = String(data.publicKey);
        }
      }
    }
    if (!cachedVapidPublicKey) return null;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const appServerKey = urlBase64ToUint8Array(cachedVapidPublicKey);
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource
        });
      } catch {
        // If existing subscription had a different key, unsubscribe and retry
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe().catch(() => {});
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource
        });
      }
    }
    return sub;
  } catch {
    return null;
  }
};

export const consumeSwUpdatedBaseline = async (userId: string): Promise<void> => {
  if (!userId || typeof window === 'undefined') return;

  const mergeIntoLocal = (incoming: UserNotificationBaseline | null) => {
    if (!incoming || incoming.userId !== userId) return;
    const storageKey = `${BASELINE_KEY_PREFIX}${userId}`;
    let existing: UserNotificationBaseline | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) existing = JSON.parse(raw);
    } catch {}

    const merged: UserNotificationBaseline = {
      userId,
      schoolId: incoming.schoolId || existing?.schoolId || 'school_1',
      updatedAt: Math.max(incoming.updatedAt || 0, existing?.updatedAt || 0),
      messages: { ...(existing?.messages || {}), ...(incoming.messages || {}) },
      announcements: { ...(existing?.announcements || {}), ...(incoming.announcements || {}) },
      homework: { ...(existing?.homework || {}), ...(incoming.homework || {}) },
      grades: { ...(existing?.grades || {}), ...(incoming.grades || {}) },
      finalGrades: { ...(existing?.finalGrades || {}), ...(incoming.finalGrades || {}) }
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(merged));
    } catch {}
  };

  if ('caches' in window) {
    try {
      const cache = await window.caches.open(BG_CACHE_NAME);
      const swUrl = `https://eljur.local/sw-baseline-${userId}`;
      const res = await cache.match(swUrl);
      if (res) {
        const swBaseline = (await res.json()) as UserNotificationBaseline;
        await cache.delete(swUrl);
        mergeIntoLocal(swBaseline);
      }
    } catch {}
  }

  try {
    const res = await fetch(`./api/push/baseline/${encodeURIComponent(userId)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.baseline) {
        mergeIntoLocal(data.baseline as UserNotificationBaseline);
      }
    }
  } catch {}
};

/**
 * Syncs the current target user, Firebase auth token, and notification baseline with the Service Worker
 * and the Web Push (VAPID) server so notifications work even when the app is closed or the phone screen is locked.
 */
export const syncServiceWorkerWatcher = async (
  state: AppState,
  targetUser: User | null,
  lang: 'ru' | 'en' = 'ru',
  explicitBaseline?: UserNotificationBaseline
): Promise<void> => {
  if (typeof window === 'undefined' || !targetUser || targetUser.role === 'creator') return;

  try {
    const storageKey = `${BASELINE_KEY_PREFIX}${targetUser.id}`;
    let baseline = explicitBaseline || null;
    if (!baseline) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) baseline = JSON.parse(raw);
      } catch {}
    }
    if (!baseline) {
      baseline = buildCurrentSnapshot(state, targetUser).baseline;
    }

    let idToken = '';
    let refreshToken = '';
    if (auth.currentUser) {
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch {}
      try {
        refreshToken =
          (auth.currentUser as unknown as { stsTokenManager?: { refreshToken?: string }; refreshToken?: string })
            ?.stsTokenManager?.refreshToken ||
          auth.currentUser.refreshToken ||
          '';
      } catch {}
    }

    const senderNames: Record<string, string> = {};
    (state.users || []).forEach(u => {
      if (u && u.id && u.fio) {
        senderNames[u.id] = H.formatShortName(u.fio);
      }
    });

    let localReceipts: Record<string, unknown> = {};
    try {
      const rawReceipts = localStorage.getItem(`eljur_read_receipts_v2_${targetUser.id}`);
      if (rawReceipts) {
        localReceipts = JSON.parse(rawReceipts) || {};
      }
    } catch {}

    const studentGroupIds = (state.studentGroups || [])
      .filter((g: any) => Array.isArray(g?.studentIds) && g.studentIds.includes(targetUser.id))
      .map((g: any) => g.id);

    const watcherPayload = {
      projectId: firebaseConfig.projectId,
      apiKey: firebaseConfig.apiKey,
      idToken,
      refreshToken,
      enabled: areNotificationsEnabled(),
      lang,
      targetUser: {
        id: targetUser.id,
        fio: H.formatShortName(targetUser.fio || targetUser.login || ''),
        role: targetUser.role,
        schoolId: targetUser.schoolId && targetUser.schoolId !== 'global' ? targetUser.schoolId : 'school_1',
        class: targetUser.class,
        letter: targetUser.letter,
        studentGroupIds
      },
      baseline,
      senderNames,
      localReceipts,
      updatedAt: Date.now()
    };

    if ('caches' in window) {
      try {
        const cache = await window.caches.open(BG_CACHE_NAME);
        await cache.put(
          WATCHER_STATE_URL,
          new Response(JSON.stringify(watcherPayload), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          })
        );
      } catch {}
    }

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const activeSw = reg?.active || navigator.serviceWorker.controller;
      if (activeSw) {
        activeSw.postMessage({
          type: 'SYNC_BG_WATCHER',
          payload: watcherPayload
        });
      }

      if (reg) {
        const pushSub = await ensureWebPushSubscription(reg);
        if (pushSub) {
          fetch('./api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: pushSub.toJSON(),
              ...watcherPayload
            })
          }).catch(() => {});
        }
      }
    }
  } catch {}
};

export interface PendingNotificationClick {
  notificationId?: string;
  targetUserId: string;
  schoolId: string;
  targetTab: string;
  category?: string;
}

/**
 * Checks if the user tapped a system notification (either via URL params on cold start
 * or via Cache Storage written by the Service Worker notificationclick listener).
 */
export const consumePendingNotificationClick = async (): Promise<PendingNotificationClick | null> => {
  if (typeof window === 'undefined') return null;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('eljur_notify_click') === '1') {
      const uid = url.searchParams.get('uid') || '';
      const tab = url.searchParams.get('tab') || 'messages';
      const sid = url.searchParams.get('sid') || 'school_1';
      url.searchParams.delete('eljur_notify_click');
      url.searchParams.delete('uid');
      url.searchParams.delete('tab');
      url.searchParams.delete('sid');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
      if (uid) {
        return { targetUserId: uid, targetTab: tab, schoolId: sid };
      }
    }
  } catch {}

  if ('caches' in window) {
    try {
      const cache = await window.caches.open(BG_CACHE_NAME);
      const res = await cache.match(PENDING_CLICK_URL);
      if (res) {
        const data = await res.json();
        await cache.delete(PENDING_CLICK_URL);
        if (data && data.targetUserId && (!data.timestamp || Date.now() - data.timestamp < 5 * 60 * 1000)) {
          return {
            notificationId: data.notificationId,
            targetUserId: data.targetUserId,
            schoolId: data.schoolId || 'school_1',
            targetTab: data.targetTab || 'messages',
            category: data.category
          };
        }
      }
    } catch {}
  }

  return null;
};

export const notifyServiceWorkerBackgrounded = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const activeSw = reg?.active || navigator.serviceWorker.controller;
    if (activeSw) {
      activeSw.postMessage({ type: 'APP_BACKGROUNDED' });
    }
    if (reg && 'sync' in reg) {
      try {
        await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('eljur-bg-sync');
      } catch {}
    }
  } catch {}
};

// Silent 1-second PCM WAV data URI used to prevent mobile OS from suspending background/lock-screen JS
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

/**
 * Starts a dedicated Web Worker heartbeat + silent Lock-Screen audio keep-alive so mobile OSes
 * do not suspend notifications when the phone screen is locked (sleep mode).
 */
export const startBackgroundKeepAliveWorker = (onForegroundWake: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  let worker: Worker | null = null;
  let workerUrl = '';
  let silentAudio: HTMLAudioElement | null = null;
  let wakeLockSentinel: any = null;

  const ensureSilentKeepAlive = () => {
    if (!areNotificationsEnabled()) return;
    try {
      if (!silentAudio) {
        silentAudio = new Audio(SILENT_WAV_DATA_URI);
        silentAudio.loop = true;
        silentAudio.volume = 0.0001;
        silentAudio.setAttribute('playsinline', 'true');
      }
      if (silentAudio.paused) {
        silentAudio.play().catch(() => {});
      }
    } catch {}

    try {
      if ('wakeLock' in navigator && !wakeLockSentinel && document.visibilityState === 'visible') {
        (navigator as any).wakeLock
          .request('screen')
          .then((sentinel: any) => {
            wakeLockSentinel = sentinel;
            sentinel.addEventListener('release', () => {
              wakeLockSentinel = null;
            });
          })
          .catch(() => {});
      }
    } catch {}
  };

  const pingSwCheck = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        const activeSw = reg?.active || navigator.serviceWorker.controller;
        if (activeSw) {
          activeSw.postMessage({ type: 'CHECK_NOW' });
        }
      }).catch(() => {});
    }
    fetch('./api/push/trigger-check', { method: 'POST' }).catch(() => {});
  };

  try {
    const workerCode = `
      setInterval(function() {
        postMessage('TICK');
      }, 5000);
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerUrl = URL.createObjectURL(blob);
    worker = new Worker(workerUrl);
    worker.onmessage = () => {
      if (document.visibilityState === 'hidden') {
        pingSwCheck();
      }
    };
  } catch {}

  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      ensureSilentKeepAlive();
      notifyServiceWorkerBackgrounded();
      fetch('./api/push/trigger-check', { method: 'POST' }).catch(() => {});
    } else if (document.visibilityState === 'visible') {
      onForegroundWake();
    }
  };

  const handlePageHide = () => {
    notifyServiceWorkerBackgrounded();
    fetch('./api/push/trigger-check', { method: 'POST' }).catch(() => {});
  };

  const handleUserGesture = () => {
    ensureSilentKeepAlive();
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('focus', onForegroundWake);
  window.addEventListener('touchstart', handleUserGesture, { passive: true });
  window.addEventListener('click', handleUserGesture, { passive: true });

  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('focus', onForegroundWake);
    window.removeEventListener('touchstart', handleUserGesture);
    window.removeEventListener('click', handleUserGesture);
    if (silentAudio) {
      try { silentAudio.pause(); } catch {}
      silentAudio = null;
    }
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release(); } catch {}
      wakeLockSentinel = null;
    }
    if (worker) {
      try { worker.terminate(); } catch {}
    }
    if (workerUrl) {
      try { URL.revokeObjectURL(workerUrl); } catch {}
    }
  };
};


