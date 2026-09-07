import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enJsonFormatterValidatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/json-formatter-validator',
  component: lazy(() =>
    import('@/tools/json-formatter-validator').then((module) => ({
      default: module.JsonFormatterValidatorTool,
    })),
  ),
});
