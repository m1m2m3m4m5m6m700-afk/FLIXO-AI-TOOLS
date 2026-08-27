import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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

function bundleAttribution() {
  return {
    name: 'flixo-bundle-attribution',
    apply: 'build',
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'chunk' || !fileName.endsWith('.js')) continue;

        const modules = Object.entries(output.modules)
          .map(([id, info]: [string, any]) => ({
            id,
            renderedLength: info.renderedLength ?? 0,
            originalLength: info.originalLength ?? 0,
          }))
          .sort((a, b) => b.renderedLength - a.renderedLength)
          .slice(0, 30);

        console.log(`[bundle-attribution] ${fileName} ${output.code.length} bytes`);
        for (const module of modules) {
          console.log(
            `[bundle-attribution] ${fileName} module=${module.id} rendered=${module.renderedLength} original=${module.originalLength}`,
          );
        }
      }
    },
  };
}

const plugins = [react()];
if (process.env.FLIXO_BUNDLE_ATTRIBUTION === '1') plugins.push(bundleAttribution());

export default defineConfig({
  plugins,
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
