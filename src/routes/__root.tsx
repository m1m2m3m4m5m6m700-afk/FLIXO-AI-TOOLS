import { lazy, Suspense, useEffect, useState } from 'react';
import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router';
import { FlixoGlobalLogo } from '../components/FlixoGlobalLogo';
import { installCoreWebVitalsDiagnostics } from '../lib/diagnostics/performance';
import { SITE_ORIGIN } from '../lib/i18n';

const LazyCommandPalette = lazy(() => import('../components/command-palette').then((module) => ({ default: module.CommandPalette })));

const GLOBAL_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#organization`,
      name: 'FLIXO',
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/flixo-logo.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'FLIXO',
      url: SITE_ORIGIN,
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    },
  ],
} as const;

export const rootRoute = createRootRoute({
  component: function RootLayout() {
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    useEffect(() => installCoreWebVitalsDiagnostics(), []);

    useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          setCommandPaletteOpen((value) => !value);
        }
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
      <>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(GLOBAL_STRUCTURED_DATA).replace(/</g, '\\u003c') }}
        />
        <FlixoGlobalLogo />
        {commandPaletteOpen ? (
          <Suspense fallback={null}>
            <LazyCommandPalette open onOpenChange={setCommandPaletteOpen} />
          </Suspense>
        ) : null}
        <Outlet />
        <Scripts />
      </>
    );
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'description', content: 'FLIXO — fast, private, browser-based tools for images, documents, and everyday files.' },
      { name: 'robots', content: 'index,follow' },
      { name: 'theme-color', content: '#090d12' },
      { property: 'og:site_name', content: 'FLIXO' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'FLIXO — Free Online Tools' },
      { property: 'og:description', content: 'Fast, private, browser-based tools for images, documents, and everyday files.' },
      { property: 'og:url', content: SITE_ORIGIN },
      { property: 'og:image', content: `${SITE_ORIGIN}/flixo-logo.svg` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: `${SITE_ORIGIN}/flixo-logo.svg` },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'alternate icon', href: '/logo.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/flixo-logo.svg' },
    ],
  }),
});
