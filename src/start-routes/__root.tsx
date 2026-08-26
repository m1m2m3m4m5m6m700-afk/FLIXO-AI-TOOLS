import { HeadContent, Scripts, Outlet, createRootRoute } from '@tanstack/react-router';

/**
 * TanStack Start owns the outer document lifecycle. The application page tree
 * is mounted by the catch-all bridge below so the existing code-built FLIXO
 * router remains the single source of page routing truth.
 */
export const Route = createRootRoute({
  component: function StartDocumentRoot() {
    return (
      <>
        <HeadContent />
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
  }),
});
