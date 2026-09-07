import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { LOCALES } from './src/lib/i18n/config.ts';

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  // PDF tools are route-lazy. Do not force their heavy dependencies into any
  // shared manual vendor chunk; let Rollup keep them on the async PDF graph.
  if (id.includes('pdfjs-dist') || id.includes('pdf-lib') || id.includes('jspdf')) return undefined;
  if (id.includes('@ffmpeg') || id.includes('gif.js') || id.includes('gifuct-js')) return 'vendor-media';
  if (id.includes('@tanstack/')) return 'vendor-tanstack';
  if (id.includes('@radix-ui/')) return 'vendor-radix';
  if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
  if (id.includes('lucide-react') || id.includes('motion')) return 'vendor-ui';
  return 'vendor-common';
}

const localizedPreviewRoutes: Plugin = {
  name: 'flixo-localized-preview-routes',
  configurePreviewServer(server) {
    server.middlewares.use((req, _res, next) => {
      const requestUrl = req.url ?? '/';
      const pathname = requestUrl.split(/[?#]/u, 1)[0] || '/';
      const segments = pathname.split('/').filter(Boolean);
      const locale = segments[0];

      if (segments.length > 0 && LOCALES.includes(locale as (typeof LOCALES)[number]) && !pathname.endsWith('.html')) {
        const localizedEntry = `${pathname.replace(/\/$/u, '')}/index.html`;
        req.url = `${localizedEntry}${requestUrl.slice(pathname.length)}`;
      }

      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), localizedPreviewRoutes],
  appType: 'mpa',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts,
  },
});
