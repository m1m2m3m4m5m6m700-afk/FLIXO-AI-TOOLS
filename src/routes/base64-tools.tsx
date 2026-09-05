import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enBase64EncoderDecoderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/base64-encoder-decoder',
  component: lazy(() => import('@/tools/base64-encoder-decoder').then((module) => ({ default: module.Base64EncoderDecoderTool }))),
});
