import type { AnyRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes/__root';
import { routeChildren } from '../routes/route-tree';

/**
 * TanStack Start entry point for FLIXO's existing code-built route tree.
 * The registry contains dynamically generated image-tool routes, so its exact
 * tuple length cannot be preserved statically. Runtime routing still uses the
 * same route objects and paths; Start only needs the aggregate route set here.
 */
const children = routeChildren as readonly AnyRoute[];

export const Route = rootRoute.addChildren(children as never);
