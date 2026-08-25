import { createRouter } from '@tanstack/react-router';
import { rootRoute } from './routes/__root';
import { routeChildren } from './routes/route-tree';

const routeTree = rootRoute.addChildren(routeChildren);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
