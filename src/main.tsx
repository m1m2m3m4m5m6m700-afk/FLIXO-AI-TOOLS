import React, { useLayoutEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { installRuntimeDiagnostics } from './lib/diagnostics/runtime';
import { installPerformanceDiagnostics } from './lib/diagnostics/performance';
import { LOCALE_METADATA, DEFAULT_LOCALE, isLocale, type CanonicalLocale } from './lib/i18n';
import { FlixoUxShell } from './components/flixo-ux-shell';
import './styles.css';
import './home-motion.css';
import './components/command-palette.css';
import './home-modern.css';
import './tools/seed/seed-premium.css';

const subscribeToResolvedLocation = (onStoreChange: () => void) => router.subscribe('onResolved', onStoreChange);
const getRouterPathname = () => router.state.location.pathname;
const getServerPathname = () => '/';

function localeFromPathname(pathname: string): CanonicalLocale {
  const candidate = pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  return isLocale(candidate) ? candidate : DEFAULT_LOCALE;
}

function RoutedDocumentLocale() {
  const pathname = useSyncExternalStore(subscribeToResolvedLocation, getRouterPathname, getServerPathname);
  const locale = localeFromPathname(pathname);
  const metadata = LOCALE_METADATA[locale];

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', metadata.languageTag);
    html.setAttribute('dir', metadata.direction);
    html.setAttribute('data-flixo-locale', locale);

    document.querySelectorAll<HTMLElement>('main').forEach((main) => {
      main.setAttribute('lang', metadata.languageTag);
      main.setAttribute('dir', metadata.direction);
    });
  }, [locale, metadata.direction, metadata.languageTag]);

  return null;
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlixoUxShell>
      <RoutedDocumentLocale />
      <RouterProvider router={router} />
    </FlixoUxShell>
  </React.StrictMode>,
);
