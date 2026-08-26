import type { AnyRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes/__root';
import { routeChildren } from '../routes/route-tree';

/**
 * TanStack Start entry point for FLIXO's existing code-built route tree.
 * Dynamically generated tool routes are intentionally aggregated at this
 * integration boundary because their exact tuple length is runtime-derived.
 */
const children = routeChildren as readonly AnyRoute[];

export const Route = rootRoute.addChildren(children as any);
