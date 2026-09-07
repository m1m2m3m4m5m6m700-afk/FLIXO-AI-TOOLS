import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enBase64EncoderDecoderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/base64-encoder-decoder',
  head: () => ({
    meta: [
      { title: 'Base64 Encoder & Decoder | FLIXO' },
      { name: 'description', content: 'Encode and decode Base64 text locally in your browser with FLIXO.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }),
  component: lazy(() => import('@/tools/base64-encoder-decoder').then((module) => ({ default: module.Base64EncoderDecoderTool }))),
});
