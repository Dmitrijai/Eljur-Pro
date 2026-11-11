const BG_CACHE_NAME = 'eljur-bg-watcher-v1';
const WATCHER_STATE_URL = 'https://eljur.local/watcher-state';
const PENDING_CLICK_URL = 'https://eljur.local/pending-click';

const PERIOD_LABELS_RU = {
  q1: '1 четверть',
  q2: '2 четверть',
  q3: '3 четверть',
  q4: '4 четверть',
  year: 'Годовая',
  exam: 'Экзамен',
  final: 'Итоговая'
};

let bgIntervalId = null;

async function readJsonFromCache(urlKey) {
  try {
    const cache = await caches.open(BG_CACHE_NAME);
    const res = await cache.match(urlKey);
    if (!res) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeJsonToCache(urlKey, data) {
  try {
    const cache = await caches.open(BG_CACHE_NAME);
    await cache.put(
      urlKey,
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      })
    );
  } catch {}
}

function stripCleanText(raw, maxLen = 140) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + '…';
}

function formatShortDateLabel(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return parts[2] + '.' + parts[1];
  }
  return isoDate;
}

function parseFirestoreValue(valObj) {
  if (!valObj || typeof valObj !== 'object') return undefined;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('nullValue' in valObj) return null;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('arrayValue' in valObj) {
    const values = (valObj.arrayValue && valObj.arrayValue.values) || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const fields = (valObj.mapValue && valObj.mapValue.fields) || {};
    const out = {};
    for (const k of Object.keys(fields)) {
      out[k] = parseFirestoreValue(fields[k]);
    }
    return out;
  }
  return undefined;
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const k of Object.keys(doc.fields)) {
    out[k] = parseFirestoreValue(doc.fields[k]);
  }
  if (!out.id && doc.name) {
    const parts = doc.name.split('/');
    out.id = parts[parts.length - 1];
  }
  return out;
}

async function refreshFirebaseIdToken(apiKey, refreshToken) {
  if (!apiKey || !refreshToken) return null;
  try {
    const res = await fetch('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.id_token ? data.id_token : null;
  } catch {
    return null;
  }
}

async function fetchCollectionDocs(projectId, schoolId, collectionName, idToken) {
  const url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/schools/' +
    encodeURIComponent(schoolId) +
    '/' +
    encodeURIComponent(collectionName) +
    '?pageSize=300';
  const res = await fetch(url, {
    method: 'GET',
    headers: idToken ? { Authorization: 'Bearer ' + idToken } : {},
    cache: 'no-store'
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('UNAUTHORIZED');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) return [];
  const data = await res.json();
  const docs = (data && data.documents) || [];
  return docs.map(parseFirestoreDoc).filter(Boolean);
}

async function fetchSingleDoc(projectId, schoolId, collectionName, docId, idToken) {
  const url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(projectId) +
    '/databases/(default)/documents/schools/' +
    encodeURIComponent(schoolId) +
    '/' +
    encodeURIComponent(collectionName) +
    '/' +
    encodeURIComponent(docId);
  const res = await fetch(url, {
    method: 'GET',
    headers: idToken ? { Authorization: 'Bearer ' + idToken } : {},
    cache: 'no-store'
  });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    const err = new Error('UNAUTHORIZED');
    err.status = res.status;
    throw err;
  }
  if (!res.ok) return null;
  const data = await res.json();
  return parseFirestoreDoc(data);
}

function isUnreadByUserSw(item, userId, localReceipts) {
  if (!item || !userId) return false;
  if (item.fromId === userId) return false;
  const receipt = localReceipts && localReceipts[item.id];
  const isEdited = Boolean(item.edited || item.editedAt);
  if (isEdited) {
    if (Array.isArray(item.readAfterEditBy) && item.readAfterEditBy.includes(userId)) return false;
    if (receipt && receipt.readAfterEdit && (!item.editedAt || receipt.updatedAt >= new Date(item.editedAt).getTime() - 2000)) {
      return false;
    }
    return true;
  }
  if (Array.isArray(item.readBy) && item.readBy.includes(userId)) return false;
  if (receipt && receipt.read) return false;
  return true;
}

let isCheckingBg = false;

async function checkFirestoreInBackground() {
  if (isCheckingBg) return;
  isCheckingBg = true;
  try {
    const state = await readJsonFromCache(WATCHER_STATE_URL);
    if (!state || !state.enabled || !state.targetUser || !state.projectId) {
      return;
    }

    const targetUser = state.targetUser;
    if (!targetUser.id || targetUser.role === 'creator') return;

    const schoolId = targetUser.schoolId && targetUser.schoolId !== 'global' ? targetUser.schoolId : 'school_1';
    const lang = state.lang === 'en' ? 'en' : 'ru';
    const senderNames = state.senderNames || {};
    const localReceipts = state.localReceipts || {};
    let idToken = state.idToken;

    let messagesDocs = [];
    let announcementsDocs = [];
    let homeworkDocs = [];
    let gradesDoc = null;
    let finalGradesDoc = null;

    const classKey = targetUser.class
      ? String(targetUser.class) + '_' + String(targetUser.letter || '')
      : '';

    const performFetches = async (token) => {
      const promises = [
        fetchCollectionDocs(state.projectId, schoolId, 'messages', token),
        fetchCollectionDocs(state.projectId, schoolId, 'announcements', token)
      ];
      if (targetUser.role === 'student' && classKey) {
        promises.push(fetchCollectionDocs(state.projectId, schoolId, 'homework', token));
        promises.push(fetchSingleDoc(state.projectId, schoolId, 'grades', classKey, token));
        promises.push(fetchSingleDoc(state.projectId, schoolId, 'finalGrades', classKey, token));
      }
      return Promise.all(promises);
    };

    try {
      const results = await performFetches(idToken);
      messagesDocs = results[0] || [];
      announcementsDocs = results[1] || [];
      if (targetUser.role === 'student' && classKey) {
        homeworkDocs = results[2] || [];
        gradesDoc = results[3] || null;
        finalGradesDoc = results[4] || null;
      }
    } catch (err) {
      if (err && err.message === 'UNAUTHORIZED' && state.apiKey && state.refreshToken) {
        const refreshed = await refreshFirebaseIdToken(state.apiKey, state.refreshToken);
        if (refreshed) {
          idToken = refreshed;
          state.idToken = refreshed;
          await writeJsonToCache(WATCHER_STATE_URL, state);
          const results = await performFetches(idToken);
          messagesDocs = results[0] || [];
          announcementsDocs = results[1] || [];
          if (targetUser.role === 'student' && classKey) {
            homeworkDocs = results[2] || [];
            gradesDoc = results[3] || null;
            finalGradesDoc = results[4] || null;
          }
        } else {
          return;
        }
      } else {
        return;
      }
    }

    const prev = state.baseline;
    if (!prev || prev.userId !== targetUser.id) return;

    const currentMessages = {};
    const messagesById = {};
    for (const m of messagesDocs) {
      if (!m || !m.id) continue;
      if ((m.schoolId || 'school_1') !== schoolId) continue;
      if (!Array.isArray(m.toIds) || !m.toIds.includes(targetUser.id)) continue;
      const sig = String(m.date || '') + '|' + String(m.editedAt || '');
      currentMessages[m.id] = sig;
      messagesById[m.id] = m;
    }

    const currentAnnouncements = {};
    const announcementsById = {};
    for (const a of announcementsDocs) {
      if (!a || !a.id) continue;
      if ((a.schoolId || 'school_1') !== schoolId) continue;
      const hasExplicitRecipients = Array.isArray(a.toIds) && a.toIds.length > 0;
      const hasTargetClasses = Array.isArray(a.targetClasses) && a.targetClasses.length > 0;
      let isRecipient = true;
      if (hasExplicitRecipients) {
        isRecipient = a.toIds.includes(targetUser.id);
      } else if (hasTargetClasses && targetUser.role === 'student') {
        isRecipient = Boolean(classKey && a.targetClasses.includes(classKey));
      }
      if (!isRecipient) continue;
      const sig = String(a.date || '') + '|' + String(a.editedAt || '');
      currentAnnouncements[a.id] = sig;
      announcementsById[a.id] = a;
    }

    const currentGrades = {};
    const gradesById = {};
    const currentFinalGrades = {};
    const finalGradesByKey = {};
    const currentHomework = {};
    const homeworkById = {};

    if (targetUser.role === 'student' && targetUser.class) {
      const entries = (gradesDoc && gradesDoc.entries) || {};
      for (const subject of Object.keys(entries)) {
        const list = entries[subject];
        if (!Array.isArray(list)) continue;
        for (const entry of list) {
          if (!entry || !entry.id || entry.studentId !== targetUser.id || !entry.value) continue;
          const sig =
            String(subject) +
            '|' +
            String(entry.value) +
            '|' +
            String(entry.date || '') +
            '|' +
            String(entry.type || '') +
            '|' +
            String(entry.comment || '');
          currentGrades[entry.id] = sig;
          gradesById[entry.id] = { subject, entry };
        }
      }

      const fgEntries = (finalGradesDoc && finalGradesDoc.entries) || {};
      const periodKeys = ['q1', 'q2', 'q3', 'q4', 'year', 'exam', 'final'];
      for (const subject of Object.keys(fgEntries)) {
        const list = fgEntries[subject];
        if (!Array.isArray(list)) continue;
        const stEntry = list.find((e) => e && e.studentId === targetUser.id);
        if (!stEntry) continue;
        for (const pKey of periodKeys) {
          const val = stEntry[pKey];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const mapKey = subject + '__' + pKey;
            const cleanVal = String(val).trim();
            currentFinalGrades[mapKey] = cleanVal;
            finalGradesByKey[mapKey] = { subject, periodKey: pKey, value: cleanVal };
          }
        }
      }

      const studentGroupIds = Array.isArray(targetUser.studentGroupIds) ? targetUser.studentGroupIds : [];
      for (const hw of homeworkDocs) {
        if (!hw || !hw.id) continue;
        if ((hw.schoolId || 'school_1') !== schoolId) continue;
        if (hw.class !== targetUser.class || (hw.letter || '') !== (targetUser.letter || '')) continue;
        const cleanText = String(hw.text || '').trim();
        if (!cleanText) continue;
        if (hw.groupId && studentGroupIds.length > 0 && !studentGroupIds.includes(hw.groupId)) continue;
        const sig = String(hw.subject || '') + '|' + String(hw.date || '') + '|' + cleanText;
        currentHomework[hw.id] = sig;
        homeworkById[hw.id] = hw;
      }
    }

    const resolveSender = (fromId) => {
      if (fromId === 'u_creator') return lang === 'ru' ? 'Создатель платформы' : 'Platform Creator';
      return senderNames[fromId] || (lang === 'ru' ? 'Администрация' : 'Administration');
    };

    const newNotifications = [];

    for (const msgId of Object.keys(currentMessages)) {
      const sig = currentMessages[msgId];
      if (prev.messages && prev.messages[msgId] === sig) continue;
      const msg = messagesById[msgId];
      if (!msg || msg.fromId === targetUser.id || !isUnreadByUserSw(msg, targetUser.id, localReceipts)) continue;
      const isEdit = Boolean(prev.messages && prev.messages[msgId]);
      const sender = resolveSender(msg.fromId);
      const title = lang === 'ru'
        ? (isEdit ? '💬 Сообщение изменено • ' : '💬 Новое сообщение • ') + sender
        : (isEdit ? '💬 Message updated • ' : '💬 New message • ') + sender;
      const prefix = msg.title ? msg.title + ': ' : '';
      const body = stripCleanText(prefix + (msg.body || '')) || (lang === 'ru' ? 'Откройте раздел «Сообщения»' : 'Open Messages');
      newNotifications.push({
        id: 'notif_msg_' + msgId + '_' + sig,
        category: 'message',
        title,
        body,
        targetUserId: targetUser.id,
        targetUserFio: targetUser.fio || '',
        targetUserRole: targetUser.role,
        schoolId,
        targetTab: 'messages'
      });
    }

    for (const annId of Object.keys(currentAnnouncements)) {
      const sig = currentAnnouncements[annId];
      if (prev.announcements && prev.announcements[annId] === sig) continue;
      const ann = announcementsById[annId];
      if (!ann || ann.fromId === targetUser.id || !isUnreadByUserSw(ann, targetUser.id, localReceipts)) continue;
      const isEdit = Boolean(prev.announcements && prev.announcements[annId]);
      const sender = resolveSender(ann.fromId);
      const title = lang === 'ru'
        ? (isEdit ? '📢 Объявление обновлено • ' : '📢 Новое объявление • ') + sender
        : (isEdit ? '📢 Announcement updated • ' : '📢 New announcement • ') + sender;
      const prefix = ann.title ? ann.title + ': ' : '';
      const body = stripCleanText(prefix + (ann.body || '')) || (lang === 'ru' ? 'Откройте раздел «Объявления»' : 'Open Announcements');
      newNotifications.push({
        id: 'notif_ann_' + annId + '_' + sig,
        category: 'announcement',
        title,
        body,
        targetUserId: targetUser.id,
        targetUserFio: targetUser.fio || '',
        targetUserRole: targetUser.role,
        schoolId,
        targetTab: 'announcements'
      });
    }

    if (targetUser.role === 'student') {
      for (const gradeId of Object.keys(currentGrades)) {
        const sig = currentGrades[gradeId];
        if (prev.grades && prev.grades[gradeId] === sig) continue;
        const gInfo = gradesById[gradeId];
        if (!gInfo) continue;
        const isEdit = Boolean(prev.grades && prev.grades[gradeId]);
        const title = lang === 'ru'
          ? (isEdit ? '✏️ Изменена оценка: ' : '⭐ Новая оценка: ') + gInfo.entry.value + ' (' + gInfo.subject + ')'
          : (isEdit ? '✏️ Grade updated: ' : '⭐ New grade: ') + gInfo.entry.value + ' (' + gInfo.subject + ')';
        const dateStr = formatShortDateLabel(gInfo.entry.date);
        const commentPart = gInfo.entry.comment ? stripCleanText(gInfo.entry.comment, 90) + ' • ' : '';
        const body = (commentPart + (dateStr ? (lang === 'ru' ? 'Урок ' + dateStr : 'Date ' + dateStr) : '')).trim() || gInfo.subject;
        newNotifications.push({
          id: 'notif_grade_' + gradeId + '_' + sig,
          category: 'grade',
          title,
          body,
          targetUserId: targetUser.id,
          targetUserFio: targetUser.fio || '',
          targetUserRole: targetUser.role,
          schoolId,
          targetTab: 'grades'
        });
      }

      for (const fgKey of Object.keys(currentFinalGrades)) {
        const val = currentFinalGrades[fgKey];
        if (prev.finalGrades && prev.finalGrades[fgKey] === val) continue;
        const fgInfo = finalGradesByKey[fgKey];
        if (!fgInfo) continue;
        const periodLabel = PERIOD_LABELS_RU[fgInfo.periodKey] || String(fgInfo.periodKey).toUpperCase();
        const title = lang === 'ru'
          ? '🏆 Итоговая оценка: ' + fgInfo.value + ' (' + fgInfo.subject + ')'
          : '🏆 Final grade: ' + fgInfo.value + ' (' + fgInfo.subject + ')';
        const body = lang === 'ru'
          ? 'Выставлена оценка за период: ' + periodLabel
          : 'Period grade posted: ' + periodLabel;
        newNotifications.push({
          id: 'notif_fgrade_' + fgKey + '_' + val,
          category: 'final_grade',
          title,
          body,
          targetUserId: targetUser.id,
          targetUserFio: targetUser.fio || '',
          targetUserRole: targetUser.role,
          schoolId,
          targetTab: 'grades'
        });
      }

      for (const hwId of Object.keys(currentHomework)) {
        const sig = currentHomework[hwId];
        if (prev.homework && prev.homework[hwId] === sig) continue;
        const hw = homeworkById[hwId];
        if (!hw) continue;
        const isEdit = Boolean(prev.homework && prev.homework[hwId]);
        const dateStr = formatShortDateLabel(hw.date);
        const title = lang === 'ru'
          ? (isEdit ? '📚 Обновлено ДЗ: ' : '📚 Новое ДЗ: ') + hw.subject
          : (isEdit ? '📚 Homework updated: ' : '📚 New homework: ') + hw.subject;
        const body = (dateStr ? (lang === 'ru' ? 'На ' + dateStr + ': ' : 'For ' + dateStr + ': ') : '') + stripCleanText(hw.text, 120);
        newNotifications.push({
          id: 'notif_hw_' + hwId + '_' + sig,
          category: 'homework',
          title,
          body,
          targetUserId: targetUser.id,
          targetUserFio: targetUser.fio || '',
          targetUserRole: targetUser.role,
          schoolId,
          targetTab: 'journal'
        });
      }
    }

    if (newNotifications.length > 0) {
      const updatedBaseline = {
        userId: targetUser.id,
        schoolId,
        updatedAt: Date.now(),
        messages: Object.assign({}, prev.messages || {}, currentMessages),
        announcements: Object.assign({}, prev.announcements || {}, currentAnnouncements),
        homework: Object.assign({}, prev.homework || {}, currentHomework),
        grades: Object.assign({}, prev.grades || {}, currentGrades),
        finalGrades: Object.assign({}, prev.finalGrades || {}, currentFinalGrades)
      };
      state.baseline = updatedBaseline;
      await writeJsonToCache(WATCHER_STATE_URL, state);
      await writeJsonToCache('https://eljur.local/sw-baseline-' + targetUser.id, updatedBaseline);

      if (self.registration && typeof self.registration.showNotification === 'function') {
        for (const item of newNotifications) {
          const navData = {
            notificationId: item.id,
            targetUserId: item.targetUserId,
            schoolId: item.schoolId,
            targetTab: item.targetTab,
            category: item.category,
            timestamp: Date.now()
          };
          await self.registration.showNotification(item.title, {
            body: item.body,
            tag: item.id,
            icon: './pwa-192x192.png',
            badge: './pwa-192x192.png',
            vibrate: [200, 100, 200],
            renotify: true,
            requireInteraction: false,
            data: navData
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Ignore transient network errors in SW background poll
  } finally {
    isCheckingBg = false;
  }
}

function ensureBgLoopRunning() {
  if (bgIntervalId !== null) return;
  bgIntervalId = setInterval(() => {
    checkFirestoreInBackground();
  }, 8000);
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SHOW_NOTIFICATION' && data.payload) {
    const { title, body, tag, icon, badge, navData } = data.payload;
    if (self.registration && typeof self.registration.showNotification === 'function') {
      event.waitUntil(
        self.registration.showNotification(title || 'ЭлЖур Про', {
          body: body || '',
          tag: tag || 'eljur-' + Date.now(),
          icon: icon || './pwa-192x192.png',
          badge: badge || './pwa-192x192.png',
          vibrate: [200, 100, 200],
          renotify: true,
          requireInteraction: false,
          data: navData || {}
        }).catch(() => {})
      );
    }
    return;
  }

  if (data.type === 'SYNC_BG_WATCHER' && data.payload) {
    ensureBgLoopRunning();
    event.waitUntil(writeJsonToCache(WATCHER_STATE_URL, data.payload));
    return;
  }

  if (data.type === 'APP_BACKGROUNDED' || data.type === 'CHECK_NOW') {
    ensureBgLoopRunning();
    event.waitUntil(
      (async () => {
        await checkFirestoreInBackground();
        await new Promise((r) => setTimeout(r, 4500));
        await checkFirestoreInBackground();
      })()
    );
  }
});

self.addEventListener('push', (event) => {
  ensureBgLoopRunning();
  let payload = null;
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'ЭлЖур Про', body: event.data.text() };
    }
  }
  event.waitUntil(
    (async () => {
      if (payload && payload.title && self.registration && typeof self.registration.showNotification === 'function') {
        await self.registration.showNotification(payload.title, {
          body: payload.body || '',
          tag: payload.tag || 'eljur-push-' + Date.now(),
          icon: './pwa-192x192.png',
          badge: './pwa-192x192.png',
          vibrate: [200, 100, 200],
          data: payload.data || {}
        }).catch(() => {});
      }
      await checkFirestoreInBackground();
    })()
  );
});

self.addEventListener('sync', (event) => {
  ensureBgLoopRunning();
  event.waitUntil(checkFirestoreInBackground());
});

self.addEventListener('periodicsync', (event) => {
  ensureBgLoopRunning();
  event.waitUntil(checkFirestoreInBackground());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawData = (event.notification && event.notification.data) || {};
  const navData = {
    notificationId: rawData.notificationId || event.notification.tag || '',
    targetUserId: rawData.targetUserId || '',
    schoolId: rawData.schoolId || 'school_1',
    targetTab: rawData.targetTab || 'messages',
    category: rawData.category || 'message',
    timestamp: Date.now()
  };

  event.waitUntil(
    (async () => {
      await writeJsonToCache(PENDING_CLICK_URL, navData);

      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      if (clientList && clientList.length > 0) {
        let focusedClient = null;
        for (const client of clientList) {
          try {
            client.postMessage({ type: 'ELJUR_NOTIFICATION_CLICK', data: navData });
          } catch {}
          if (!focusedClient && 'focus' in client) {
            try {
              focusedClient = await client.focus();
            } catch {}
          }
        }
        return;
      }

      if (self.clients.openWindow) {
        const targetUrl =
          './?eljur_notify_click=1&uid=' +
          encodeURIComponent(navData.targetUserId || '') +
          '&tab=' +
          encodeURIComponent(navData.targetTab || 'messages') +
          '&sid=' +
          encodeURIComponent(navData.schoolId || 'school_1');
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
