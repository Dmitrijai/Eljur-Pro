import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Could not reach Cloud Firestore backend') ||
       args[0].includes("Backend didn't respond within 10 seconds"))
    ) {
      console.warn(...args);
      return;
    }
    originalError.apply(console, args);
  };

  // Clean up any legacy notification keys, caches, or active notifications from older versions
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('eljur_notify_') ||
         k.startsWith('eljur_notified_') ||
         k.startsWith('eljur_notifications_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });
  } catch {}

  if ('caches' in window) {
    window.caches.delete('eljur-bg-watcher-v1').catch(() => {});
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        try {
          if (typeof reg.getNotifications === 'function') {
            reg.getNotifications().then((list) => list.forEach((n) => n.close())).catch(() => {});
          }
          if (reg.pushManager) {
            reg.pushManager.getSubscription().then((sub) => sub?.unsubscribe()).catch(() => {});
          }
        } catch {}
      });
    }).catch(() => {});
  }

  if (!/bot|googlebot|yandex|crawler|spider|robot|crawling|lighthouse/i.test(navigator.userAgent || '')) {
    document.title = 'E-Journal Pro';
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);