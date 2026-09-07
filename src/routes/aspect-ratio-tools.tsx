import { lazy } from 'react';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './__root';

export const enAspectRatioCalculatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/aspect-ratio-calculator',
  head: () => ({
    meta: [
      { title: 'Aspect Ratio Calculator | FLIXO' },
      { name: 'description', content: 'Calculate image and video aspect ratios accurately in your browser with FLIXO.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }),
  component: lazy(() =>
    import('@/tools/aspect-ratio-calculator').then((module) => ({ default: module.AspectRatioCalculatorTool })),
  ),
});
