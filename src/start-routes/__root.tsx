import { rootRoute } from '../routes/__root';
import { routeChildren } from '../routes/route-tree';

/**
 * TanStack Start file-route compatibility root.
 * The application retains its existing code-built route definitions; this
 * wrapper exposes the complete route tree through the Start-required Route
 * export without duplicating or renaming the legacy route modules.
 */
export const Route = rootRoute.addChildren(routeChildren);
