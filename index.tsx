import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { Settings as SettingsIcon, LogOut } from 'lucide-react';

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

  if (!/bot|googlebot|yandex|crawler|spider|robot|crawling|lighthouse/i.test(navigator.userAgent || '')) {
    document.title = 'E-Journal Pro';
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);