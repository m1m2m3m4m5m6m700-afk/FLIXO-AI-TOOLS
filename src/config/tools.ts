import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type ToolConfig = {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly description: string;
  readonly category: 'Images' | 'AI' | 'Other';
  readonly isReady: boolean;
  readonly aliases?: readonly string[];
  readonly component: LazyExoticComponent<ComponentType>;
};

export const TOOLS_REGISTRY: readonly ToolConfig[] = Object.freeze([
  { id: 'image-compressor', title: 'Image Compressor', path: '/en/image-compressor', description: 'Reduce JPG, PNG, and WebP file size in your browser.', category: 'Images', isReady: true, aliases: ['/ar/image-compressor'], component: lazy(() => import('@/tools/image-compressor').then((m) => ({ default: m.ImageCompressor }))) },
  { id: 'background-remover', title: 'Background Remover', path: '/en/background-remover', description: 'Remove connected, uniform backgrounds locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-remover').then((m) => ({ default: m.BackgroundRemoverTool }))) },
  { id: 'image-upscaler', title: 'Image Upscaler', path: '/en/image-upscaler', description: 'Increase image dimensions with high-quality resampling.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-upscaler').then((m) => ({ default: m.ImageUpscalerTool }))) },
  { id: 'image-converter', title: 'Image Converter', path: '/en/image-converter', description: 'Convert common raster image formats locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-converter').then((m) => ({ default: m.ImageConverterTool }))) },
  { id: 'pdf-merger-splitter', title: 'PDF Merger & Splitter', path: '/en/pdf-merger-splitter', description: 'Merge, reorder, rotate, delete, and split PDF pages locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-merger-splitter').then((m) => ({ default: m.PdfMergerSplitterTool }))) },
  { id: 'pdf-compressor', title: 'PDF Compressor', path: '/en/pdf-compressor', description: 'Re-encode PDF pages locally for smaller browser-generated files.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-compressor').then((m) => ({ default: m.PdfCompressorTool }))) },
  { id: 'image-to-pdf', title: 'Image to PDF', path: '/en/image-to-pdf', description: 'Convert JPG, PNG, and WEBP images into a PDF locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/image-to-pdf').then((m) => ({ default: m.ImageToPdfTool }))) },
  { id: 'pdf-unlock-protect', title: 'PDF Unlock & Protect', path: '/en/pdf-unlock-protect', description: 'Password-protect or unlock PDF files locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-unlock-protect').then((m) => ({ default: m.PdfUnlockProtectTool }))) },
  { id: 'pdf-to-text', title: 'PDF to Text', path: '/en/pdf-to-text', description: 'Extract selectable PDF text locally with page-level search and TXT/JSON export.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/pdf-to-text').then((m) => ({ default: m.PdfToTextTool }))) },
  { id: 'word-character-counter', title: 'Word & Character Counter', path: '/en/word-character-counter', description: 'Count words, characters, sentences, paragraphs, reading time, speaking time, and keyword density locally.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/word-character-counter').then((m) => ({ default: m.WordCharacterCounterTool }))) },
  { id: 'text-diff-checker', title: 'Text Diff Checker', path: '/en/text-diff-checker', description: 'Compare two texts locally with inline or side-by-side differences.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/text-diff-checker').then((m) => ({ default: m.TextDiffCheckerTool }))) },
  { id: 'case-converter', title: 'Case Converter', path: '/en/case-converter', description: 'Convert text between common letter and identifier cases locally.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/case-converter').then((m) => ({ default: m.CaseConverterTool }))) },
  { id: 'qr-generator-reader', title: 'QR Code Generator & Reader', path: '/en/qr-generator-reader', description: 'Generate QR codes and read QR images locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/qr-generator-reader').then((m) => ({ default: m.QrGeneratorReaderTool }))) },
  { id: 'password-generator', title: 'Password Generator', path: '/en/password-generator', description: 'Generate secure passwords locally with Web Crypto.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/password-generator').then((m) => ({ default: m.PasswordGeneratorTool }))) },
  { id: 'aspect-ratio-calculator', title: 'Aspect Ratio Calculator', path: '/en/aspect-ratio-calculator', description: 'Calculate proportional dimensions and common aspect ratios locally.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/aspect-ratio-calculator').then((m) => ({ default: m.AspectRatioCalculatorTool }))) },
  { id: 'json-formatter-validator', title: 'JSON Formatter & Validator', path: '/en/json-formatter-validator', description: 'Validate, format, inspect, convert, copy, and download JSON locally.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/json-formatter-validator').then((m) => ({ default: m.JsonFormatterValidatorTool }))) },
  { id: 'base64-encoder-decoder', title: 'Base64 Encoder / Decoder', path: '/en/base64-encoder-decoder', description: 'Encode and decode text and files locally with browser APIs.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/base64-encoder-decoder').then((m) => ({ default: m.Base64EncoderDecoderTool }))) },
  { id: 'ai-image-generator', title: 'AI Image Generator', path: '/en/ai-image-generator', description: 'Generate images through a configured image endpoint.', category: 'AI', isReady: true, component: lazy(() => import('@/tools/ai-image-generator').then((m) => ({ default: m.AiImageGeneratorTool }))) },
  { id: 'object-remover', title: 'Object Remover', path: '/en/object-remover', description: 'Remove selected rectangular regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/object-remover').then((m) => ({ default: m.ObjectRemoverTool }))) },
  { id: 'watermark-remover', title: 'Watermark Remover', path: '/en/watermark-remover', description: 'Clean selected watermark regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-remover').then((m) => ({ default: m.WatermarkRemoverTool }))) },
  { id: 'image-cropper', title: 'Image Cropper', path: '/en/image-cropper', description: 'Crop and resize images for exact dimensions.', category: 'Images', isReady: true, aliases: ['/en/crop-resize'], component: lazy(() => import('@/tools/image-cropper')) },
  { id: 'image-to-svg', title: 'Image to SVG', path: '/en/image-to-svg', description: 'Convert a raster image to downloadable SVG.', category: 'Images', isReady: true, aliases: ['/en/raster-to-svg'], component: lazy(() => import('@/tools/image-to-svg')) },
  { id: 'image-ocr', title: 'Image OCR', path: '/en/image-ocr', description: 'Extract text from images with OCR.', category: 'Images', isReady: true, aliases: ['/en/image-to-text'], component: lazy(() => import('@/tools/image-ocr')) },
  { id: 'photo-colorizer', title: 'Photo Colorizer', path: '/en/photo-colorizer', description: 'Colorize photos through a configured AI endpoint.', category: 'AI', isReady: false, component: lazy(() => import('@/tools/photo-colorizer')) },
  { id: 'background-blur', title: 'Background Blur', path: '/en/background-blur', description: 'Blur background regions locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/background-blur')) },
  { id: 'passport-photo-maker', title: 'Passport Photo Maker', path: '/en/passport-photo-maker', description: 'Create standard portrait photo crops.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/passport-photo-maker')) },
  { id: 'watermark-adder', title: 'Watermark Adder', path: '/en/watermark-adder', description: 'Add text watermarks locally.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/watermark-adder')) },
  { id: 'meme-generator', title: 'Meme Generator', path: '/en/meme-generator', description: 'Create top-and-bottom captioned memes.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/meme-generator')) },
  { id: 'collage-maker', title: 'Collage Maker', path: '/en/collage-maker', description: 'Combine multiple images into a collage.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/collage-maker')) },
  { id: 'image-effects', title: 'Image Effects', path: '/en/image-effects', description: 'Apply brightness, contrast, saturation, and grayscale.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/image-effects')) },
  { id: 'exif-cleaner', title: 'EXIF Cleaner', path: '/en/exif-cleaner', description: 'Strip metadata by browser re-encoding.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/exif-cleaner')) },
  { id: 'svg-optimizer', title: 'SVG Optimizer', path: '/en/svg-optimizer', description: 'Minify SVG comments and whitespace.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/svg-optimizer')) },
  { id: 'mockup-generator', title: 'Mockup Generator', path: '/en/mockup-generator', description: 'Place images inside a simple device mockup.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/mockup-generator')) },
  { id: 'seed', title: 'Seed', path: '/en/seed', description: 'Non-destructive GPU image adjustments with WebGL.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/seed')) },
  { id: 'pix', title: 'Pix Studio', path: '/en/pix', description: 'Professional browser-based image editor with tune, liquify, dispersion, text, history, and PNG export.', category: 'Images', isReady: true, component: lazy(() => import('@/tools/pix')) },
]);

export const getToolConfig = (id: string) => TOOLS_REGISTRY.find((tool) => tool.id === id);
export const getToolConfigByPath = (path: string) => TOOLS_REGISTRY.find((tool) => tool.path === path || tool.aliases?.includes(path));
export const getReadyToolConfigs = () => TOOLS_REGISTRY.filter((tool) => tool.isReady);
