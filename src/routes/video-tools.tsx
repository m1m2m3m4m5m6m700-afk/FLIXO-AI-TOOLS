import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enVideoTrimmerSplitterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/video-trimmer-splitter',
  head: () => ({
    meta: [
      { title: 'Video Trimmer & Splitter | FLIXO' },
      { name: 'description', content: 'Trim and split videos locally in your browser with FLIXO.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }),
  component: lazy(() => import('@/tools/video-trimmer-splitter').then((module) => ({ default: module.VideoTrimmerSplitterTool }))),
});
