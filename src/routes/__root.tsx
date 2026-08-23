import { useEffect } from 'react';
import { HeadContent, Outlet, createRootRoute } from '@tanstack/react-router';
import { FlixoGlobalLogo } from '../components/FlixoGlobalLogo';
import { installCoreWebVitalsDiagnostics } from '../lib/diagnostics/performance';

export const rootRoute = createRootRoute({
  component: function RootLayout() {
    useEffect(() => installCoreWebVitalsDiagnostics(), []);

    return (
      <>
        <HeadContent />
        <FlixoGlobalLogo />
        <Outlet />
      </>
    );
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#090d12' },
    ],
    links: [
      { rel: 'icon', href: '/flixo-logo.jpg', type: 'image/jpeg' },
      { rel: 'apple-touch-icon', href: '/flixo-logo.jpg' },
    ],
  }),
});
