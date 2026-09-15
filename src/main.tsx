import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { applyDocumentLocale, localeFromPathname } from './lib/i18n/runtime-document-locale';
import { installToolUiRuntimeCompleteness } from './lib/i18n/tool-ui-runtime-completeness';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

if (typeof window !== 'undefined') {
  applyDocumentLocale(localeFromPathname(window.location.pathname));
}

installRuntimeDiagnostics();
installToolUiRuntimeCompleteness();

if (typeof window !== 'undefined') {
  const loadPerformanceDiagnostics = () => {
    void import('./lib/diagnostics/performance')
      .then(({ installPerformanceDiagnostics }) => installPerformanceDiagnostics())
      .catch(() => {
        // Diagnostics are non-critical; application startup must remain independent of them.
      });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadPerformanceDiagnostics, { timeout: 2000 });
  } else {
    window.setTimeout(loadPerformanceDiagnostics, 0);
  }
}

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
