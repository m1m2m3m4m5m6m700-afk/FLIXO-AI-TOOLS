import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { installPerformanceDiagnostics } from './lib/diagnostics/performance';
import { LOCALE_METADATA, DEFAULT_LOCALE, isLocale } from './lib/i18n';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './components/command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

const subscribeToResolvedLocation = (onStoreChange: () => void) => router.subscribe('onResolved', onStoreChange);
const getRouterPathname = () => router.state.location.pathname;
const getServerPathname = () => '/';

function localeFromPathname(pathname: string) {
  const candidate = pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

function DocumentShell() {
  const pathname = useSyncExternalStore(subscribeToResolvedLocation, getRouterPathname, getServerPathname);
  const locale = localeFromPathname(pathname);
  const metadata = LOCALE_METADATA[locale];

  return (
    <html lang={metadata.languageTag} dir={metadata.direction} data-flixo-locale={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#071116" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="apple-touch-icon" href="/flixo-logo.svg" />
      </head>
      <body>
        <div id="root">
          <React.StrictMode>
            <FlixoUxShell>
              <RouterProvider router={router} />
            </FlixoUxShell>
          </React.StrictMode>
        </div>
      </body>
    </html>
  );
}

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
