import { createRouter } from '@tanstack/react-router';
import { arImageCompressorRoute } from './routes/ar-image-compressor';
import { indexRoute } from './routes/index';
import { localizedToolRoute } from './routes/localized-tool';
import { toolRoutes } from './routes/tool-routes';
import { rootRoute } from './routes/__root';

const routeTree = rootRoute.addChildren([
  indexRoute,
  arImageCompressorRoute,
  localizedToolRoute,
  ...toolRoutes,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
