import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

const AspectRatioCalculatorTool = lazy(() =>
  import('@/tools/aspect-ratio-calculator').then((module) => ({ default: module.AspectRatioCalculatorTool })),
);

export const enAspectRatioCalculatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/aspect-ratio-calculator',
  component: AspectRatioCalculatorTool,
});
