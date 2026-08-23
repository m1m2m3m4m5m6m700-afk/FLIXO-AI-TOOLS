import type { ComponentType } from 'react';
import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './__root';

type LazyComponentModule = Record<string, ComponentType<unknown>>;
type LazyComponent = () => Promise<LazyComponentModule>;

function imageToolRoute(path: string, title: string, description: string, importer: LazyComponent, exportName?: string) {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    head: () => ({ meta: [
      { title: `${title} | FLIXO` },
      { name: 'description', content: description },
      { name: 'robots', content: 'index,follow,max-image-preview:large' },
      { property: 'og:title', content: `${title} | FLIXO` },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
    ] }),
    component: lazyRouteComponent(importer, exportName),
  });
}

export const enBackgroundRemoverRoute = imageToolRoute('/en/background-remover', 'Background Remover', 'Remove simple image backgrounds locally in your browser.', () => import('../tools/background-remover'), 'BackgroundRemoverTool');
export const enAiImageGeneratorRoute = imageToolRoute('/en/ai-image-generator', 'AI Image Generator', 'Generate images through a configured FLIXO image-generation endpoint.', () => import('../tools/ai-image-generator'), 'AiImageGeneratorTool');
export const enImageUpscalerRoute = imageToolRoute('/en/image-upscaler', 'Image Upscaler', 'Increase image dimensions with high-quality browser resampling.', () => import('../tools/image-upscaler'), 'ImageUpscalerTool');
export const enImageConverterRoute = imageToolRoute('/en/image-converter', 'Image Converter', 'Convert PNG, JPG, and WebP images in your browser.', () => import('../tools/image-converter'), 'ImageConverterTool');
export const enImageToTextRoute = imageToolRoute('/en/image-to-text', 'Image to Text OCR', 'Extract text from images in your browser with OCR.', () => import('../tools/image-ocr'), 'default');
export const enObjectRemoverRoute = imageToolRoute('/en/object-remover', 'Object Remover', 'Remove a rectangular object region with local reconstruction.', () => import('../tools/object-remover'), 'ObjectRemoverTool');
export const enCropResizeRoute = imageToolRoute('/en/crop-resize', 'Crop & Resize', 'Legacy route for crop/resize.', () => import('../tools/image-cropper'), 'default');
export const enWatermarkRemoverRoute = imageToolRoute('/en/watermark-remover', 'Watermark Remover', 'Cover a selected watermark region locally.', () => import('../tools/watermark-remover'), 'default');
export const enRasterToSvgRoute = imageToolRoute('/en/raster-to-svg', 'Raster to SVG', 'Legacy raster-to-SVG route.', () => import('../tools/image-to-svg'), 'default');
export const enImageCropperRoute = imageToolRoute('/en/image-cropper', 'Image Cropper', 'Crop and resize images for exact dimensions.', () => import('../tools/image-cropper'), 'default');
export const enImageOcrRoute = imageToolRoute('/en/image-ocr', 'Image OCR', 'Extract text from images with OCR.', () => import('../tools/image-ocr'), 'default');
export const enBackgroundBlurRoute = imageToolRoute('/en/background-blur', 'Background Blur', 'Blur background regions locally.', () => import('../tools/background-blur'), 'default');
export const enPassportPhotoMakerRoute = imageToolRoute('/en/passport-photo-maker', 'Passport Photo Maker', 'Create a standard portrait crop.', () => import('../tools/passport-photo-maker'), 'default');
export const enWatermarkAdderRoute = imageToolRoute('/en/watermark-adder', 'Watermark Adder', 'Add text watermarks locally.', () => import('../tools/watermark-adder'), 'default');
export const enMemeGeneratorRoute = imageToolRoute('/en/meme-generator', 'Meme Generator', 'Create top-and-bottom captioned memes.', () => import('../tools/meme-generator'), 'default');
export const enCollageMakerRoute = imageToolRoute('/en/collage-maker', 'Collage Maker', 'Combine multiple images into a collage.', () => import('../tools/collage-maker'), 'default');
export const enImageEffectsRoute = imageToolRoute('/en/image-effects', 'Image Effects', 'Apply image adjustments locally.', () => import('../tools/image-effects'), 'default');
export const enExifCleanerRoute = imageToolRoute('/en/exif-cleaner', 'EXIF Cleaner', 'Strip image metadata by browser re-encoding.', () => import('../tools/exif-cleaner'), 'default');
export const enSvgOptimizerRoute = imageToolRoute('/en/svg-optimizer', 'SVG Optimizer', 'Minify SVG whitespace and comments locally.', () => import('../tools/svg-optimizer'), 'default');
export const enMockupGeneratorRoute = imageToolRoute('/en/mockup-generator', 'Mockup Generator', 'Create a simple device mockup image.', () => import('../tools/mockup-generator'), 'default');
export const enImageToSvgRoute = imageToolRoute('/en/image-to-svg', 'Image to SVG', 'Wrap a raster image in a downloadable SVG.', () => import('../tools/image-to-svg'), 'default');
export const enSeedRoute = imageToolRoute('/en/seed', 'Seed', 'Non-destructive GPU image adjustments with WebGL.', () => import('../tools/seed'), 'default');
export const enPixRoute = imageToolRoute('/en/pix', 'Pix Studio', 'Professional browser-based image editing with tune filters, liquify, dispersion, text layers, history, and PNG export.', () => import('../tools/pix'), 'default');
