import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';
import { adminControlPlaneRoute } from './admin-control-plane';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  localizedToolRoute,
  adminControlPlaneRoute,
] as const;
