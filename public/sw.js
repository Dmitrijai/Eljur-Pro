const CACHE_NAME = 'ejournal-pro-pwa-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pwa-192x192.png',
  './pwa-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SHOW_NOTIFICATION' && data.payload) {
    const { title, body, tag, icon, badge, navData } = data.payload;
    if (self.registration && typeof self.registration.showNotification === 'function') {
      event.waitUntil(
        self.registration.showNotification(title || 'ЭлЖур Про', {
          body: body || '',
          tag: tag || `eljur-${Date.now()}`,
          icon: icon || './pwa-192x192.png',
          badge: badge || './pwa-192x192.png',
          vibrate: [200, 100, 200],
          renotify: true,
          requireInteraction: false,
          data: navData || {}
        }).catch(() => {})
      );
    }
  }
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'ЭлЖур Про',
    body: 'Новое уведомление в электронном журнале',
    tag: `eljur-push-${Date.now()}`,
    data: {}
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }
  if (self.registration && typeof self.registration.showNotification === 'function') {
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: './pwa-192x192.png',
        badge: './pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: payload.data || {}
      }).catch(() => {})
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const navData = (event.notification && event.notification.data) || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          try {
            client.postMessage({ type: 'ELJUR_NOTIFICATION_CLICK', data: navData });
          } catch {}
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Vite dev server on-the-fly transformed modules
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.search.includes('v=') ||
    url.search.includes('t=')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
