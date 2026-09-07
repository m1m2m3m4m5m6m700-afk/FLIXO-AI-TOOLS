import { createRoot } from 'react-dom/client';
import { DocumentShell } from './components/document-shell';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { installPerformanceDiagnostics } from './lib/diagnostics/performance';
import './styles.css';
import './home-motion.css';
import './components/command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

installRuntimeDiagnostics();
installPerformanceDiagnostics();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA support is an enhancement; app startup must remain independent of it.
    });
  });
}

createRoot(document).render(<DocumentShell />);
