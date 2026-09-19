import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';
import { adminControlPlaneRoute } from './admin-control-plane';
import { adminLoginRoute } from './admin-login';
import { toolsRoute } from './tools';
import { arToolsRoute } from './ar-tools';

export const routeChildren = [indexRoute, arIndexRoute, localizedHomeRoute, toolsRoute, arToolsRoute, localizedToolRoute, adminLoginRoute, adminControlPlaneRoute] as const;
