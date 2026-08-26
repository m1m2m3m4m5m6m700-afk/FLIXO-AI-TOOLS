import { rootRoute } from './routes/__root';
import { routeChildren } from './routes/route-tree';

/** Single code-built FLIXO route tree used by the application router. */
export const legacyRouteTree = rootRoute.addChildren(routeChildren as never);
