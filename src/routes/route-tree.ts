import { adminLoginRoute } from './admin-login';
import { Route as adminRoute } from './admin';
import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  adminLoginRoute,
  adminRoute,
  localizedToolRoute,
] as const;
