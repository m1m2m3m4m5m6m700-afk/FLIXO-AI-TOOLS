import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';
import { adminControlPlaneRoute } from './admin-control-plane';
import { adminControlPlaneLoginRoute } from './admin-control-plane-login';
import { toolsRoute } from './tools';
import { arToolsRoute } from './ar-tools';

export const routeChildren = [indexRoute, arIndexRoute, localizedHomeRoute, toolsRoute, arToolsRoute, localizedToolRoute, adminControlPlaneLoginRoute, adminControlPlaneRoute] as const;
