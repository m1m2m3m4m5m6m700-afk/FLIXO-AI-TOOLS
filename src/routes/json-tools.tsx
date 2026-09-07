import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enJsonFormatterValidatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/json-formatter-validator',
  head: () => ({
    meta: [
      { title: 'JSON Formatter & Validator | FLIXO' },
      { name: 'description', content: 'Format and validate JSON locally in your browser with FLIXO.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }),
  component: lazy(() =>
    import('@/tools/json-formatter-validator').then((module) => ({
      default: module.JsonFormatterValidatorTool,
    })),
  ),
});
