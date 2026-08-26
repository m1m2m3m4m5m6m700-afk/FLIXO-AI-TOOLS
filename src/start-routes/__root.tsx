import type { AnyRoute } from '@tanstack/react-router';
import { rootRoute } from '../routes/__root';
import { routeChildren } from '../routes/route-tree';

/**
 * TanStack Start entry point for FLIXO's existing code-built route tree.
 * Dynamically generated tool routes are aggregated as a non-empty route tuple
 * so Start receives a valid child collection without widening the tree to `any`.
 */
const children = [...routeChildren] as [AnyRoute, ...AnyRoute[]];

export const Route = rootRoute.addChildren(children);
