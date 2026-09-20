import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const adminControlPlaneLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: lazyRouteComponent(() => import('./admin-control-plane-login-page')),
  head: () => ({
    meta: [
      { title: 'FLIXO — دخول الإدارة' },
      { name: 'robots', content: 'noindex,nofollow,noarchive' },
    ],
  }),
});
