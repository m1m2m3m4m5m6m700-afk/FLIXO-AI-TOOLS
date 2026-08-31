import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

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

function deterministicCiPreview() {
  return {
    name: 'deterministic-ci-preview',
    configurePreviewServer(server: { middlewares: { use: (handler: (req: { headers: Record<string, string | undefined> }, res: unknown, next: () => void) => void) => void } }) {
      if (!isCi) return;
      server.middlewares.use((req, _res, next) => {
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), deterministicCiPreview()],
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
