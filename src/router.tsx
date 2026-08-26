import { createRouter } from '@tanstack/react-router';
import { legacyRouteTree } from './legacy-route-tree';

export function getRouter() {
  return createRouter({
    routeTree: legacyRouteTree,
    defaultPreload: false,
  });
}

export const router = getRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
