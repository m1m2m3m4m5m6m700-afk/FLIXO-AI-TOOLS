import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';
import { AspectRatioCalculatorTool } from '@/tools/aspect-ratio-calculator';

export const enAspectRatioCalculatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/aspect-ratio-calculator',
  component: AspectRatioCalculatorTool,
});
