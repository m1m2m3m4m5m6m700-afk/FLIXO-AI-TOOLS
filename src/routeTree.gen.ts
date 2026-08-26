/* eslint-disable */
// This compatibility entry is committed so TypeScript can validate the router
// before the TanStack Router Vite plugin refreshes the generated route tree.
import { rootRoute } from './routes/__root';
import { routeChildren } from './routes/route-tree';

export const routeTree = rootRoute.addChildren(routeChildren);
