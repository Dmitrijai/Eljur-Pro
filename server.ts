import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as webpush from 'web-push';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VAPID_FILE = path.join(__dirname, '.push-vapid.json');
const SUBS_FILE = path.join(__dirname, '.push-subscriptions.json');

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): VapidKeys {
  try {
    if (fs.existsSync(VAPID_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
      if (parsed && parsed.publicKey && parsed.privateKey) {
        return parsed;
      }
    }
  } catch {}
  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(generated, null, 2), 'utf-8');
  } catch {}
  return generated;
}

const vapidKeys = loadOrCreateVapidKeys();
webpush.setVapidDetails(
  'mailto:notifications@eljur-pro.org',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

interface WatcherBaseline {
  userId: string;
  schoolId: string;
  updatedAt: number;
  messages: Record<string, string>;
  announcements: Record<string, string>;
  homework: Record<string, string>;
  grades: Record<string, string>;
  finalGrades: Record<string, string>;
}

interface StoredPushDevice {
  endpoint: string;
  subscription: webpush.PushSubscription;
  projectId: string;
  apiKey: string;
  idToken: string;
  refreshToken: string;
  enabled: boolean;
  lang: 'ru' | 'en';
  targetUser: {
    id: string;
    fio: string;
    role: string;
    schoolId: string;
    class?: string;
    letter?: string;
    studentGroupIds?: string[];
  };
  baseline: WatcherBaseline;
  senderNames: Record<string, string>;
  localReceipts: Record<string, any>;
  updatedAt: number;
}

const devicesByEndpoint = new Map<string, StoredPushDevice>();
const latestServerBaselineByUser = new Map<string, WatcherBaseline>();

function loadStoredSubscriptions() {
  try {
    if (fs.existsSync(SUBS_FILE)) {
      const list = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
      if (Array.isArray(list)) {
        for (const item of list) {
          if (item && item.endpoint && item.subscription) {
            devicesByEndpoint.set(item.endpoint, item);
            if (item.targetUser?.id && item.baseline) {
              latestServerBaselineByUser.set(item.targetUser.id, item.baseline);
            }
          }
        }
      }
    }
  } catch {}
}

function saveStoredSubscriptions() {
  try {
    const list = Array.from(devicesByEndpoint.values());
    fs.writeFileSync(SUBS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch {}
}

loadStoredSubscriptions();

const PERIOD_LABELS_RU: Record<string, string> = {
  q1: '1 четверть',
  q2: '2 четверть',
  q3: '3 четверть',
  q4: '4 четверть',
  year: 'Годовая',
  exam: 'Экзамен',
  final: 'Итоговая'
};

function stripCleanText(raw: unknown, maxLen = 140): string {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1) + '…';
}

function formatShortDateLabel(isoDate: unknown): string {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}`;
  }
  return isoDate;
}

function parseFirestoreValue(valObj: any): any {
  if (!valObj || typeof valObj !== 'object') return undefined;
  if ('stringValue' in valObj) return valObj.stringValue;
  if ('booleanValue' in valObj) return Boolean(valObj.booleanValue);
  if ('integerValue' in valObj) return Number(valObj.integerValue);
  if ('doubleValue' in valObj) return Number(valObj.doubleValue);
  if ('nullValue' in valObj) return null;
  if ('timestampValue' in valObj) return valObj.timestampValue;
  if ('arrayValue' in valObj) {
    const values = valObj.arrayValue?.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in valObj) {
    const fields = valObj.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      out[k] = parseFirestoreValue(fields[k]);
    }
    return out;
  }
  return undefined;
}

function parseFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const out: Record<string, any> = {};
  for (const k of Object.keys(doc.fields)) {
    out[k] = parseFirestoreValue(doc.fields[k]);
  }
  if (!out.id && doc.name) {
    const parts = String(doc.name).split('/');
    out.id = parts[parts.length - 1];
  }
  return out;
}

async function refreshFirebaseIdToken(apiKey: string, refreshToken: string): Promise<string | null> {
  if (!apiKey || !refreshToken) return null;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    return data?.id_token || null;
  } catch {
    return null;
  }
}

async function fetchCollectionDocs(projectId: string, schoolId: string, collectionName: string, idToken: string): Promise<any[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}/${encodeURIComponent(collectionName)}?pageSize=300`;
  const res = await fetch(url, {
    method: 'GET',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {}
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  const docs = data?.documents || [];
  return docs.map(parseFirestoreDoc).filter(Boolean);
}

async function fetchSingleDoc(projectId: string, schoolId: string, collectionName: string, docId: string, idToken: string): Promise<any | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/schools/${encodeURIComponent(schoolId)}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : {}
  });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    throw new Error('UNAUTHORIZED');
  }
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  return parseFirestoreDoc(data);
}

function isUnreadByUserServer(item: any, userId: string, localReceipts: Record<string, any>): boolean {
  if (!item || !userId) return false;
  if (item.fromId === userId) return false;
  const receipt = localReceipts?.[item.id];
  const isEdited = Boolean(item.edited || item.editedAt);
  if (isEdited) {
    if (Array.isArray(item.readAfterEditBy) && item.readAfterEditBy.includes(userId)) return false;
    if (receipt?.readAfterEdit && (!item.editedAt || receipt.updatedAt >= new Date(item.editedAt).getTime() - 2000)) {
      return false;
    }
    return true;
  }
  if (Array.isArray(item.readBy) && item.readBy.includes(userId)) return false;
  if (receipt?.read) return false;
  return true;
}

async function sendWebPushToDevice(device: StoredPushDevice, payload: any): Promise<void> {
  try {
    await webpush.sendNotification(
      device.subscription,
      JSON.stringify(payload),
      {
        TTL: 86400,
        urgency: 'high'
      }
    );
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      devicesByEndpoint.delete(device.endpoint);
      saveStoredSubscriptions();
    }
  }
}

let isPollingServer = false;

async function pollDevicesOnServer() {
  if (isPollingServer || devicesByEndpoint.size === 0) return;
  isPollingServer = true;
  try {
    for (const device of Array.from(devicesByEndpoint.values())) {
      if (!device.enabled || !device.targetUser?.id || device.targetUser.role === 'creator' || !device.projectId) {
        continue;
      }

      const targetUser = device.targetUser;
      const schoolId = targetUser.schoolId && targetUser.schoolId !== 'global' ? targetUser.schoolId : 'school_1';
      const lang = device.lang === 'en' ? 'en' : 'ru';
      const senderNames = device.senderNames || {};
      const localReceipts = device.localReceipts || {};
      const classKey = targetUser.class ? `${targetUser.class}_${targetUser.letter || ''}` : '';

      let idToken = device.idToken;
      let messagesDocs: any[] = [];
      let announcementsDocs: any[] = [];
      let homeworkDocs: any[] = [];
      let gradesDoc: any = null;
      let finalGradesDoc: any = null;

      const performFetches = async (token: string) => {
        const promises: Promise<any>[] = [
          fetchCollectionDocs(device.projectId, schoolId, 'messages', token),
          fetchCollectionDocs(device.projectId, schoolId, 'announcements', token)
        ];
        if (targetUser.role === 'student' && classKey) {
          promises.push(fetchCollectionDocs(device.projectId, schoolId, 'homework', token));
          promises.push(fetchSingleDoc(device.projectId, schoolId, 'grades', classKey, token));
          promises.push(fetchSingleDoc(device.projectId, schoolId, 'finalGrades', classKey, token));
        }
        return Promise.all(promises);
      };

      try {
        const res = await performFetches(idToken);
        messagesDocs = res[0] || [];
        announcementsDocs = res[1] || [];
        if (targetUser.role === 'student' && classKey) {
          homeworkDocs = res[2] || [];
          gradesDoc = res[3] || null;
          finalGradesDoc = res[4] || null;
        }
      } catch (err: any) {
        if (err?.message === 'UNAUTHORIZED' && device.apiKey && device.refreshToken) {
          const newToken = await refreshFirebaseIdToken(device.apiKey, device.refreshToken);
          if (newToken) {
            idToken = newToken;
            device.idToken = newToken;
            saveStoredSubscriptions();
            try {
              const res = await performFetches(idToken);
              messagesDocs = res[0] || [];
              announcementsDocs = res[1] || [];
              if (targetUser.role === 'student' && classKey) {
                homeworkDocs = res[2] || [];
                gradesDoc = res[3] || null;
                finalGradesDoc = res[4] || null;
              }
            } catch {
              continue;
            }
          } else {
            continue;
          }
        } else {
          continue;
        }
      }

      const prev = device.baseline;
      if (!prev || prev.userId !== targetUser.id) continue;

      const currentMessages: Record<string, string> = {};
      const messagesById: Record<string, any> = {};
      for (const m of messagesDocs) {
        if (!m || !m.id) continue;
        if ((m.schoolId || 'school_1') !== schoolId) continue;
        if (!Array.isArray(m.toIds) || !m.toIds.includes(targetUser.id)) continue;
        const sig = `${m.date || ''}|${m.editedAt || ''}`;
        currentMessages[m.id] = sig;
        messagesById[m.id] = m;
      }

      const currentAnnouncements: Record<string, string> = {};
      const announcementsById: Record<string, any> = {};
      for (const a of announcementsDocs) {
        if (!a || !a.id) continue;
        if ((a.schoolId || 'school_1') !== schoolId) continue;
        const hasExplicit = Array.isArray(a.toIds) && a.toIds.length > 0;
        const hasTargetClasses = Array.isArray(a.targetClasses) && a.targetClasses.length > 0;
        let isRecipient = true;
        if (hasExplicit) {
          isRecipient = a.toIds.includes(targetUser.id);
        } else if (hasTargetClasses && targetUser.role === 'student') {
          isRecipient = Boolean(classKey && a.targetClasses.includes(classKey));
        }
        if (!isRecipient) continue;
        const sig = `${a.date || ''}|${a.editedAt || ''}`;
        currentAnnouncements[a.id] = sig;
        announcementsById[a.id] = a;
      }

      const currentGrades: Record<string, string> = {};
      const gradesById: Record<string, { subject: string; entry: any }> = {};
      const currentFinalGrades: Record<string, string> = {};
      const finalGradesByKey: Record<string, { subject: string; periodKey: string; value: string }> = {};
      const currentHomework: Record<string, string> = {};
      const homeworkById: Record<string, any> = {};

      if (targetUser.role === 'student' && targetUser.class) {
        const entries = gradesDoc?.entries || {};
        for (const subject of Object.keys(entries)) {
          const list = entries[subject];
          if (!Array.isArray(list)) continue;
          for (const entry of list) {
            if (!entry || !entry.id || entry.studentId !== targetUser.id || !entry.value) continue;
            const sig = `${subject}|${entry.value}|${entry.date || ''}|${entry.type || ''}|${entry.comment || ''}`;
            currentGrades[entry.id] = sig;
            gradesById[entry.id] = { subject, entry };
          }
        }

        const fgEntries = finalGradesDoc?.entries || {};
        const periodKeys = ['q1', 'q2', 'q3', 'q4', 'year', 'exam', 'final'];
        for (const subject of Object.keys(fgEntries)) {
          const list = fgEntries[subject];
          if (!Array.isArray(list)) continue;
          const stEntry = list.find((e: any) => e && e.studentId === targetUser.id);
          if (!stEntry) continue;
          for (const pKey of periodKeys) {
            const val = stEntry[pKey];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              const mapKey = `${subject}__${pKey}`;
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
          const sig = `${hw.subject || ''}|${hw.date || ''}|${cleanText}`;
          currentHomework[hw.id] = sig;
          homeworkById[hw.id] = hw;
        }
      }

      const resolveSender = (fromId: string) => {
        if (fromId === 'u_creator') return lang === 'ru' ? 'Создатель платформы' : 'Platform Creator';
        return senderNames[fromId] || (lang === 'ru' ? 'Администрация' : 'Administration');
      };

      const notificationsToSend: any[] = [];

      for (const [msgId, sig] of Object.entries(currentMessages)) {
        if (prev.messages?.[msgId] === sig) continue;
        const msg = messagesById[msgId];
        if (!msg || msg.fromId === targetUser.id || !isUnreadByUserServer(msg, targetUser.id, localReceipts)) continue;
        const isEdit = Boolean(prev.messages?.[msgId]);
        const sender = resolveSender(msg.fromId);
        const title = lang === 'ru'
          ? `${isEdit ? '💬 Сообщение изменено' : '💬 Новое сообщение'} • ${sender}`
          : `${isEdit ? '💬 Message updated' : '💬 New message'} • ${sender}`;
        const prefix = msg.title ? `${msg.title}: ` : '';
        const body = stripCleanText(`${prefix}${msg.body || ''}`) || (lang === 'ru' ? 'Откройте раздел «Сообщения»' : 'Open Messages');
        notificationsToSend.push({
          id: `notif_msg_${msgId}_${sig}`,
          category: 'message',
          title,
          body,
          targetUserId: targetUser.id,
          schoolId,
          targetTab: 'messages'
        });
      }

      for (const [annId, sig] of Object.entries(currentAnnouncements)) {
        if (prev.announcements?.[annId] === sig) continue;
        const ann = announcementsById[annId];
        if (!ann || ann.fromId === targetUser.id || !isUnreadByUserServer(ann, targetUser.id, localReceipts)) continue;
        const isEdit = Boolean(prev.announcements?.[annId]);
        const sender = resolveSender(ann.fromId);
        const title = lang === 'ru'
          ? `${isEdit ? '📢 Объявление обновлено' : '📢 Новое объявление'} • ${sender}`
          : `${isEdit ? '📢 Announcement updated' : '📢 New announcement'} • ${sender}`;
        const prefix = ann.title ? `${ann.title}: ` : '';
        const body = stripCleanText(`${prefix}${ann.body || ''}`) || (lang === 'ru' ? 'Откройте раздел «Объявления»' : 'Open Announcements');
        notificationsToSend.push({
          id: `notif_ann_${annId}_${sig}`,
          category: 'announcement',
          title,
          body,
          targetUserId: targetUser.id,
          schoolId,
          targetTab: 'announcements'
        });
      }

      if (targetUser.role === 'student') {
        for (const [gradeId, sig] of Object.entries(currentGrades)) {
          if (prev.grades?.[gradeId] === sig) continue;
          const gInfo = gradesById[gradeId];
          if (!gInfo) continue;
          const isEdit = Boolean(prev.grades?.[gradeId]);
          const title = lang === 'ru'
            ? `${isEdit ? '✏️ Изменена оценка' : '⭐ Новая оценка'}: ${gInfo.entry.value} (${gInfo.subject})`
            : `${isEdit ? '✏️ Grade updated' : '⭐ New grade'}: ${gInfo.entry.value} (${gInfo.subject})`;
          const dateStr = formatShortDateLabel(gInfo.entry.date);
          const commentPart = gInfo.entry.comment ? `${stripCleanText(gInfo.entry.comment, 90)} • ` : '';
          const body = `${commentPart}${dateStr ? (lang === 'ru' ? `Урок ${dateStr}` : `Date ${dateStr}`) : ''}`.trim() || gInfo.subject;
          notificationsToSend.push({
            id: `notif_grade_${gradeId}_${sig}`,
            category: 'grade',
            title,
            body,
            targetUserId: targetUser.id,
            schoolId,
            targetTab: 'grades'
          });
        }

        for (const [fgKey, val] of Object.entries(currentFinalGrades)) {
          if (prev.finalGrades?.[fgKey] === val) continue;
          const fgInfo = finalGradesByKey[fgKey];
          if (!fgInfo) continue;
          const periodLabel = PERIOD_LABELS_RU[fgInfo.periodKey] || fgInfo.periodKey.toUpperCase();
          const title = lang === 'ru'
            ? `🏆 Итоговая оценка: ${fgInfo.value} (${fgInfo.subject})`
            : `🏆 Final grade: ${fgInfo.value} (${fgInfo.subject})`;
          const body = lang === 'ru'
            ? `Выставлена оценка за период: ${periodLabel}`
            : `Period grade posted: ${periodLabel}`;
          notificationsToSend.push({
            id: `notif_fgrade_${fgKey}_${val}`,
            category: 'final_grade',
            title,
            body,
            targetUserId: targetUser.id,
            schoolId,
            targetTab: 'grades'
          });
        }

        for (const [hwId, sig] of Object.entries(currentHomework)) {
          if (prev.homework?.[hwId] === sig) continue;
          const hw = homeworkById[hwId];
          if (!hw) continue;
          const isEdit = Boolean(prev.homework?.[hwId]);
          const dateStr = formatShortDateLabel(hw.date);
          const title = lang === 'ru'
            ? `${isEdit ? '📚 Обновлено ДЗ' : '📚 Новое ДЗ'}: ${hw.subject}`
            : `${isEdit ? '📚 Homework updated' : '📚 New homework'}: ${hw.subject}`;
          const body = `${dateStr ? (lang === 'ru' ? `На ${dateStr}: ` : `For ${dateStr}: `) : ''}${stripCleanText(hw.text, 120)}`;
          notificationsToSend.push({
            id: `notif_hw_${hwId}_${sig}`,
            category: 'homework',
            title,
            body,
            targetUserId: targetUser.id,
            schoolId,
            targetTab: 'journal'
          });
        }
      }

      if (notificationsToSend.length > 0) {
        const updatedBaseline: WatcherBaseline = {
          userId: targetUser.id,
          schoolId,
          updatedAt: Date.now(),
          messages: { ...(prev.messages || {}), ...currentMessages },
          announcements: { ...(prev.announcements || {}), ...currentAnnouncements },
          homework: { ...(prev.homework || {}), ...currentHomework },
          grades: { ...(prev.grades || {}), ...currentGrades },
          finalGrades: { ...(prev.finalGrades || {}), ...currentFinalGrades }
        };
        device.baseline = updatedBaseline;
        latestServerBaselineByUser.set(targetUser.id, updatedBaseline);
        saveStoredSubscriptions();

        for (const item of notificationsToSend) {
          const pushPayload = {
            title: item.title,
            body: item.body,
            tag: item.id,
            data: {
              notificationId: item.id,
              targetUserId: item.targetUserId,
              schoolId: item.schoolId,
              targetTab: item.targetTab,
              category: item.category,
              timestamp: Date.now()
            }
          };
          await sendWebPushToDevice(device, pushPayload);
        }
      }
    }
  } catch {
    // ignore transient poll error
  } finally {
    isPollingServer = false;
  }
}

setInterval(() => {
  pollDevicesOnServer();
}, 4000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const body = req.body;
    if (!body || !body.subscription || !body.subscription.endpoint) {
      res.status(400).json({ error: 'Invalid subscription' });
      return;
    }
    const endpoint = String(body.subscription.endpoint);
    const existing = devicesByEndpoint.get(endpoint);
    const record: StoredPushDevice = {
      endpoint,
      subscription: body.subscription,
      projectId: body.projectId || existing?.projectId || '',
      apiKey: body.apiKey || existing?.apiKey || '',
      idToken: body.idToken || existing?.idToken || '',
      refreshToken: body.refreshToken || existing?.refreshToken || '',
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : (existing?.enabled ?? true),
      lang: body.lang === 'en' ? 'en' : 'ru',
      targetUser: body.targetUser || existing?.targetUser,
      baseline: body.baseline || existing?.baseline,
      senderNames: body.senderNames || existing?.senderNames || {},
      localReceipts: body.localReceipts || existing?.localReceipts || {},
      updatedAt: Date.now()
    };
    devicesByEndpoint.set(endpoint, record);
    if (record.targetUser?.id && record.baseline) {
      latestServerBaselineByUser.set(record.targetUser.id, record.baseline);
    }
    saveStoredSubscriptions();
    res.json({ ok: true });
  });

  app.get('/api/push/baseline/:userId', (req, res) => {
    const uid = req.params.userId;
    const baseline = latestServerBaselineByUser.get(uid) || null;
    res.json({ baseline });
  });

  app.post('/api/push/send', async (req, res) => {
    const { item, endpoint } = req.body || {};
    if (!item || !item.title) {
      res.status(400).json({ error: 'Missing notification item' });
      return;
    }
    const pushPayload = {
      title: item.title,
      body: item.body || '',
      tag: item.id || `eljur-push-${Date.now()}`,
      data: {
        notificationId: item.id,
        targetUserId: item.targetUserId,
        schoolId: item.schoolId || 'school_1',
        targetTab: item.targetTab || 'messages',
        category: item.category || 'message',
        timestamp: Date.now()
      }
    };

    const targets: StoredPushDevice[] = [];
    if (endpoint && devicesByEndpoint.has(endpoint)) {
      targets.push(devicesByEndpoint.get(endpoint)!);
    } else if (item.targetUserId) {
      for (const dev of devicesByEndpoint.values()) {
        if (dev.enabled && dev.targetUser?.id === item.targetUserId) {
          targets.push(dev);
        }
      }
    }

    await Promise.all(targets.map(dev => sendWebPushToDevice(dev, pushPayload)));
    res.json({ ok: true, sent: targets.length });
  });

  app.post('/api/push/trigger-check', async (_req, res) => {
    pollDevicesOnServer().catch(() => {});
    res.json({ ok: true });
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
