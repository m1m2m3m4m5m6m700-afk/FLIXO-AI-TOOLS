import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  localizedToolRoute,
] as const;
