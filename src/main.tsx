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
import { LOCALE_METADATA, isLocale } from './lib/i18n';
import './styles.css';
import './home-motion.css';
import './command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

function applyDocumentLocale(): void {
  const candidate = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
  const locale = isLocale(candidate) ? candidate : 'en';
  const metadata = LOCALE_METADATA[locale];
  document.documentElement.lang = metadata.languageTag;
  document.documentElement.dir = metadata.direction;
}

applyDocumentLocale();
const localeObserver = new MutationObserver(() => {
  const candidate = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
  const locale = isLocale(candidate) ? candidate : 'en';
  const metadata = LOCALE_METADATA[locale];
  const html = document.documentElement;
  if (html.lang !== metadata.languageTag) html.lang = metadata.languageTag;
  if (html.dir !== metadata.direction) html.dir = metadata.direction;
});
localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });

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
  localeObserver.disconnect();
  disposeToolUiLocalization();
  disposeToolUiLocalizationSupplement();
  disposeToolUiTechnicalValues();
});
