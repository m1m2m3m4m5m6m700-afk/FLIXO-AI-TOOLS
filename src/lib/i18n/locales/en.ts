import type { Locale } from '../config';
import type { SeedUiTranslations } from '../types';

export type Dictionary = {
  locale: Locale;
  languageTag: string;
  direction: 'ltr' | 'rtl';
  siteName: string;
  homeTitle: string;
  homeDescription: string;
  seedUi?: SeedUiTranslations;
};

export const EN_SEED_UI: SeedUiTranslations = {
  zoomIn: 'Zoom In Canvas', zoomOut: 'Zoom Out Canvas', zoomReset: 'Reset Canvas Zoom',
  undo: 'Undo Action', redo: 'Redo Action', compareHold: 'Hold to Compare Original', compareLabel: 'Compare',
  fullscreenEnter: 'Enter Fullscreen', fullscreenExit: 'Exit Fullscreen', resetAll: 'Reset all controls', exportPng: 'Export PNG',
  replaceImage: 'Replace image', lightColor: 'Light & Color', lightColorSubtitle: 'Core tonal response and chromatic balance',
  brightness: 'Brightness', contrast: 'Contrast', saturation: 'Saturation', warmth: 'Warmth', ambiance: 'Ambiance', highlights: 'Highlights', shadows: 'Shadows',
  fxFocus: 'FX & Focus', fxFocusSubtitle: 'Blur, bokeh, curves and exposure compositing', globalBlur: 'Global Blur', lensBlur: 'Lens Blur',
  bokehFocusShift: 'Bokeh / Focus Shift', curves: 'Curves', curvesPreview: 'Curves preview', curvesStrength: 'Curves Strength',
  doubleExposure: 'Double Exposure', doubleExposureFile: 'Double Exposure file', exposureOpacity: 'Exposure Opacity', exposureBlendMode: 'Exposure blend mode',
  geometry: 'Geometry', geometrySubtitle: 'Perspective and crop preparation', perspectiveX: 'Perspective X', perspectiveY: 'Perspective Y', cropX: 'Crop X', cropY: 'Crop Y',
  retouch: 'Retouch', retouchSubtitle: 'Selective brush and healing controls', brushStrength: 'Selective / Brush Strength', healingX: 'Healing X', healingY: 'Healing Y',
  resetSection: 'Reset section', seedPreview: 'Seed preview', dropImage: 'Drop an image into Seed', browseFiles: 'Browse files', brushActive: 'Brush active · click preview',
};

export const en: Dictionary = {
  locale: 'en' as Locale,
  languageTag: 'en',
  direction: 'ltr',
  siteName: 'FLIXO',
  homeTitle: 'Free online tools',
  homeDescription: 'Fast browser-based tools for images and everyday tasks.',
  seedUi: EN_SEED_UI,
};
