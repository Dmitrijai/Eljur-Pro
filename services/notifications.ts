import { AppState, User } from '../types';
import * as H from '../utils/helpers';

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
    category: item.category
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(item.title, {
          body: item.body,
          tag: item.id,
          icon: iconUrl,
          badge: iconUrl,
          data: navData
        });
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

  return newNotifications;
};
