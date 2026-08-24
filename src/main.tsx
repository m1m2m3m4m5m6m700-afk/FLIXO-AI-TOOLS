import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { applyDocumentLocale, getLocaleFromPathname } from './lib/i18n/config';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './command-palette.css';

installRuntimeDiagnostics();
applyDocumentLocale(getLocaleFromPathname(window.location.pathname));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA support is an enhancement; app startup must remain independent of it.
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlixoUxShell>
      <RouterProvider router={router} />
    </FlixoUxShell>
  </React.StrictMode>,
);
