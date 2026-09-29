import { arIndexRoute } from './ar-index';
import { indexRoute } from './index';
import { localizedHomeRoute } from './localized-home';
import { localizedToolRoute } from './localized-tool';
import { localizedAgentRoute } from './localized-agent';
import { adminControlPlaneRoute } from './admin-control-plane';
import { adminControlPlaneLoginRoute } from './admin-control-plane-login';
import { toolsRoute } from './tools';
import { arToolsRoute } from './ar-tools';
import { agentRoute } from './agent';

export const routeChildren = [indexRoute, arIndexRoute, localizedHomeRoute, agentRoute, localizedAgentRoute, toolsRoute, arToolsRoute, localizedToolRoute, adminControlPlaneLoginRoute, adminControlPlaneRoute] as const;
