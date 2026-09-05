import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enColorPickerPaletteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/color-picker-palette',
  component: lazy(() => import('@/tools/color-picker-palette').then((module) => ({ default: module.ColorPickerPaletteTool }))),
});
