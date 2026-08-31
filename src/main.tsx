import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { installPerformanceDiagnostics } from './lib/diagnostics/performance';
import { installToolUiRuntimeLocalization } from './lib/i18n/tool-ui-runtime';
import { installToolUiRuntimeSupplement } from './lib/i18n/tool-ui-runtime-supplement';
import { installToolUiTechnicalValueNormalization } from './lib/i18n/tool-ui-technical-values';
import { FlixoUxShell } from './components/flixo-ux-shell';
import { isLocale, LOCALE_METADATA } from './lib/i18n';
import './styles.css';
import './home-motion.css';
import './command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

function bootstrapDocumentLocale(): void {
  const candidate = window.location.pathname.split('/').filter(Boolean)[0] ?? 'en';
  const locale = isLocale(candidate) ? candidate : 'en';
  const metadata = LOCALE_METADATA[locale];
  document.documentElement.setAttribute('lang', metadata.languageTag);
  document.documentElement.setAttribute('dir', metadata.direction);
}

bootstrapDocumentLocale();
installRuntimeDiagnostics();
installPerformanceDiagnostics();
const disposeToolUiLocalization = installToolUiRuntimeLocalization();
const disposeToolUiLocalizationSupplement = installToolUiRuntimeSupplement();
const disposeToolUiTechnicalValues = installToolUiTechnicalValueNormalization();

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

if (import.meta.hot) import.meta.hot.dispose(() => {
  disposeToolUiLocalization();
  disposeToolUiLocalizationSupplement();
  disposeToolUiTechnicalValues();
});
