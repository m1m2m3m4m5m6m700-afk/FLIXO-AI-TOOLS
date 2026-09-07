import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

function telemetryPreviewPlugin() {
  return {
    name: 'flixo-telemetry-endpoint',
    configureServer(server) {
      installTelemetryMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      return () => installTelemetryMiddleware(server.middlewares);
    },
  };
}

function installTelemetryMiddleware(middlewares) {
  middlewares.use('/api/telemetry', (req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('allow', 'POST');
      res.end();
      return;
    }

    let total = 0;
    req.on('data', (chunk) => {
      total += Buffer.byteLength(chunk);
      if (total > 64 * 1024) req.destroy();
    });
    req.on('end', () => {
      res.statusCode = 204;
      res.setHeader('cache-control', 'no-store');
      res.end();
    });
    req.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 400;
        res.end();
      }
    });
  });
}

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

export default defineConfig({
  plugins: [react(), telemetryPreviewPlugin()],
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