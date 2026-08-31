import { arIndexRoute } from './ar-index';
import { arQuickFlowRoute } from './ar-quickflow';
import { enQuickFlowRoute } from './en-quickflow';
import { localizedHomeRoute } from './localized-home';
import { localizedQuickFlowRoute } from './localized-quickflow';
import { indexRoute } from './index';
import { localizedToolRoute } from './localized-tool';
import { useCaseRoute } from './use-case';
import { adminLoginRoute } from './admin-login';
import { Route as adminRoute } from './admin';

export const routeChildren = [
  indexRoute,
  arIndexRoute,
  localizedHomeRoute,
  adminLoginRoute,
  adminRoute,
  enQuickFlowRoute,
  arQuickFlowRoute,
  localizedQuickFlowRoute,
  useCaseRoute,
  localizedToolRoute,
] as const;
