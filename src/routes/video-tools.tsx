import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enVideoTrimmerSplitterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/video-trimmer-splitter',
  component: lazy(() => import('@/tools/video-trimmer-splitter').then((module) => ({ default: module.VideoTrimmerSplitterTool }))),
});
