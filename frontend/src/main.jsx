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

// Initialize offline database (IndexedDB) — migrates from localStorage, pre-loads curated products
initOfflineDB(api).catch(() => {});

// Register service worker for PWA (skip on native — uses native APIs)
if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
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
