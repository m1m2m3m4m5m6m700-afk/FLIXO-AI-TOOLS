import { createRoute } from '@tanstack/react-router';
import { lazy } from 'react';
import { rootRoute } from './__root';

export const enColorPickerPaletteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/en/color-picker-palette',
  head: () => ({
    meta: [
      { title: 'Color Picker & Palette | FLIXO' },
      { name: 'description', content: 'Pick colors and build palettes locally in your browser with FLIXO.' },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
    ],
  }),
  component: lazy(() => import('@/tools/color-picker-palette').then((module) => ({ default: module.ColorPickerPaletteTool }))),
});
