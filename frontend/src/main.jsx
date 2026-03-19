import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { isNative } from './utils/platform';
import { initOfflineDB } from './utils/offlineDB';
import api from './utils/api';
import './index.css';

// Mark native platform for CSS
if (isNative) {
  document.documentElement.classList.add('native-app');
}

// Initialize offline database (IndexedDB) — migrates from localStorage, caches products on scan
initOfflineDB(api).catch(() => {});

// Unregister any stale manual service worker (replaced by Vite PWA / Workbox)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      // Workbox SW is auto-registered by vite-plugin-pwa; remove any manually registered ones
      if (reg.active?.scriptURL?.endsWith('/sw.js') && !reg.active.scriptURL.includes('workbox')) {
        reg.unregister();
      }
    }
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
