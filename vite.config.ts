import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('pdfjs-dist') || id.includes('pdf-lib') || id.includes('jspdf')) return undefined;
  if (id.includes('@ffmpeg') || id.includes('gif.js') || id.includes('gifuct-js')) return 'vendor-media';
  if (id.includes('@tanstack/')) return 'vendor-tanstack';
  if (id.includes('@radix-ui/')) return 'vendor-radix';
  if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
  if (id.includes('lucide-react') || id.includes('motion')) return 'vendor-ui';
  return 'vendor-common';
}

export default defineConfig({
  plugins: [
    tanstackStart({
      router: {
        routesDirectory: 'start-routes',
        generatedRouteTree: '../routeTree.gen.ts',
      },
    }),
    react(),
  ],
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
