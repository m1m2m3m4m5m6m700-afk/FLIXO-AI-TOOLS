import { useEffect } from 'react';
import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router';
import { FlixoGlobalLogo } from '../components/FlixoGlobalLogo';
import { CommandPalette } from '../components/command-palette';
import { installCoreWebVitalsDiagnostics } from '../lib/diagnostics/performance';
import { SITE_ORIGIN } from '../lib/i18n';

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
    useEffect(() => installCoreWebVitalsDiagnostics(), []);

    return (
      <>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(GLOBAL_STRUCTURED_DATA).replace(/</g, '\\u003c') }}
        />
        <FlixoGlobalLogo />
        <CommandPalette />
        <Outlet />
        <Scripts />
      </>
    );
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#090d12' },
      { name: 'description', content: 'FLIXO — fast browser-first tools for images, PDFs, audio, video, text, and everyday productivity.' },
    ],
    links: [
      { rel: 'icon', href: '/flixo-logo.jpg', type: 'image/jpeg' },
      { rel: 'apple-touch-icon', href: '/flixo-logo.jpg' },
    ],
  }),
});
