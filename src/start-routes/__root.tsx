import { rootRoute } from '../routes/__root';
import { routeChildren } from '../routes/route-tree';

/**
 * TanStack Start's file-route entry point for the existing FLIXO route tree.
 * The application keeps its code-defined route modules, while Start owns the
 * single root route used for SSR and build-time route execution.
 */
export const Route = rootRoute.addChildren([...routeChildren]);
