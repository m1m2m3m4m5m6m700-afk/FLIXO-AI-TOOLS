import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { installPerformanceDiagnostics } from './lib/diagnostics/performance';
import { installToolUiRuntimeLocalization } from './lib/i18n/tool-ui-runtime';
import { installToolUiRuntimeSupplement } from './lib/i18n/tool-ui-runtime-supplement';
import { installToolUiTechnicalValueNormalization } from './lib/i18n/tool-ui-technical-values';
import { installToolUiRuntimeCompleteness } from './lib/i18n/tool-ui-runtime-completeness';
import { installToolUiMsUkLocalization } from './lib/i18n/tool-ui-ms-uk';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

installRuntimeDiagnostics();
installPerformanceDiagnostics();
const disposeToolUiLocalization = installToolUiRuntimeLocalization();
const disposeToolUiLocalizationSupplement = installToolUiRuntimeSupplement();
const disposeToolUiTechnicalValues = installToolUiTechnicalValueNormalization();
const disposeToolUiRuntimeCompleteness = installToolUiRuntimeCompleteness();
const disposeToolUiMsUkLocalization = installToolUiMsUkLocalization();

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
  disposeToolUiRuntimeCompleteness();
  disposeToolUiMsUkLocalization();
});
