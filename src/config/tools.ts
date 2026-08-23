import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type ToolConfig = {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly description: string;
  readonly isReady: boolean;
  readonly aliases?: readonly string[];
  readonly component: LazyExoticComponent<ComponentType>;
};

export const TOOLS_REGISTRY: readonly ToolConfig[] = Object.freeze([
  { id: 'image-compressor', title: 'Image Compressor', path: '/en/image-compressor', description: 'Reduce JPG, PNG, and WebP file size in your browser.', isReady: true, aliases: ['/ar/image-compressor'], component: lazy(() => import('@/tools/image-compressor').then((m) => ({ default: m.ImageCompressor }))) },
  { id: 'background-remover', title: 'Background Remover', path: '/en/background-remover', description: 'Remove connected, uniform backgrounds locally.', isReady: true, component: lazy(() => import('@/tools/background-remover').then((m) => ({ default: m.BackgroundRemoverTool }))) },
  { id: 'image-upscaler', title: 'Image Upscaler', path: '/en/image-upscaler', description: 'Increase image dimensions with high-quality resampling.', isReady: true, component: lazy(() => import('@/tools/image-upscaler').then((m) => ({ default: m.ImageUpscalerTool }))) },
  { id: 'image-converter', title: 'Image Converter', path: '/en/image-converter', description: 'Convert common raster image formats locally.', isReady: true, component: lazy(() => import('@/tools/image-converter').then((m) => ({ default: m.ImageConverterTool }))) },
  { id: 'ai-image-generator', title: 'AI Image Generator', path: '/en/ai-image-generator', description: 'Generate images through a configured image endpoint.', isReady: true, component: lazy(() => import('@/tools/ai-image-generator').then((m) => ({ default: m.AiImageGeneratorTool }))) },
  { id: 'object-remover', title: 'Object Remover', path: '/en/object-remover', description: 'Remove selected rectangular regions locally.', isReady: true, component: lazy(() => import('@/tools/object-remover').then((m) => ({ default: m.ObjectRemoverTool }))) },
  { id: 'watermark-remover', title: 'Watermark Remover', path: '/en/watermark-remover', description: 'Clean selected watermark regions locally.', isReady: true, component: lazy(() => import('@/tools/watermark-remover').then((m) => ({ default: m.WatermarkRemoverTool }))) },
  { id: 'image-cropper', title: 'Image Cropper', path: '/en/image-cropper', description: 'Crop and resize images for exact dimensions.', isReady: true, aliases: ['/en/crop-resize'], component: lazy(() => import('@/tools/image-cropper')) },
  { id: 'image-to-svg', title: 'Image to SVG', path: '/en/image-to-svg', description: 'Convert a raster image to downloadable SVG.', isReady: true, aliases: ['/en/raster-to-svg'], component: lazy(() => import('@/tools/image-to-svg')) },
  { id: 'image-ocr', title: 'Image OCR', path: '/en/image-ocr', description: 'Extract text from images with OCR.', isReady: true, aliases: ['/en/image-to-text'], component: lazy(() => import('@/tools/image-ocr')) },
  { id: 'photo-colorizer', title: 'Photo Colorizer', path: '/en/photo-colorizer', description: 'Colorize photos through a configured AI endpoint.', isReady: false, component: lazy(() => import('@/tools/photo-colorizer')) },
  { id: 'background-blur', title: 'Background Blur', path: '/en/background-blur', description: 'Blur background regions locally.', isReady: true, component: lazy(() => import('@/tools/background-blur')) },
  { id: 'passport-photo-maker', title: 'Passport Photo Maker', path: '/en/passport-photo-maker', description: 'Create standard portrait photo crops.', isReady: true, component: lazy(() => import('@/tools/passport-photo-maker')) },
  { id: 'watermark-adder', title: 'Watermark Adder', path: '/en/watermark-adder', description: 'Add text watermarks locally.', isReady: true, component: lazy(() => import('@/tools/watermark-adder')) },
  { id: 'meme-generator', title: 'Meme Generator', path: '/en/meme-generator', description: 'Create top-and-bottom captioned memes.', isReady: true, component: lazy(() => import('@/tools/meme-generator')) },
  { id: 'collage-maker', title: 'Collage Maker', path: '/en/collage-maker', description: 'Combine multiple images into a collage.', isReady: true, component: lazy(() => import('@/tools/collage-maker')) },
  { id: 'image-effects', title: 'Image Effects', path: '/en/image-effects', description: 'Apply brightness, contrast, saturation, and grayscale.', isReady: true, component: lazy(() => import('@/tools/image-effects')) },
  { id: 'exif-cleaner', title: 'EXIF Cleaner', path: '/en/exif-cleaner', description: 'Strip metadata by browser re-encoding.', isReady: true, component: lazy(() => import('@/tools/exif-cleaner')) },
  { id: 'svg-optimizer', title: 'SVG Optimizer', path: '/en/svg-optimizer', description: 'Minify SVG comments and whitespace.', isReady: true, component: lazy(() => import('@/tools/svg-optimizer')) },
  { id: 'mockup-generator', title: 'Mockup Generator', path: '/en/mockup-generator', description: 'Place images inside a simple device mockup.', isReady: true, component: lazy(() => import('@/tools/mockup-generator')) },
  { id: 'seed', title: 'Seed', path: '/en/seed', description: 'Non-destructive GPU image adjustments with WebGL.', isReady: true, component: lazy(() => import('@/tools/seed')) },
  { id: 'pix', title: 'Pix Studio', path: '/en/pix', description: 'Professional browser-based image editor with tune, liquify, dispersion, text, history, and PNG export.', isReady: true, component: lazy(() => import('@/tools/pix')) },
]);

export const getToolConfig = (id: string) => TOOLS_REGISTRY.find((tool) => tool.id === id);
export const getToolConfigByPath = (path: string) => TOOLS_REGISTRY.find((tool) => tool.path === path || tool.aliases?.includes(path));
export const getReadyToolConfigs = () => TOOLS_REGISTRY.filter((tool) => tool.isReady);
