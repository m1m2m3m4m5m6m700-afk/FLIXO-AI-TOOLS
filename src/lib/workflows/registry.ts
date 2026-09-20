import type { Workflow } from './types';

export const WORKFLOW_REGISTRY: readonly Workflow[] = Object.freeze([
  {
    id: 'product-ready',
    title: 'Product Ready',
    description: 'Prepare a clean, sharp product image for a store or marketplace.',
    intentPatterns: ['product', 'store', 'shop', 'ecommerce', 'amazon', 'marketplace', 'catalog', 'product photo', 'صورة منتج', 'منتج للمتجر', 'أمازون', 'سلة'],
    steps: [
      { toolId: 'background-remover', title: 'Remove background', params: { tolerance: 42 } },
      { toolId: 'image-upscaler', title: 'Improve quality', optional: true, params: { scale: 2 } },
      { toolId: 'image-cropper', title: 'Set the crop', optional: true, params: { aspectRatio: '1:1' } },
      { toolId: 'image-compressor', title: 'Optimize file size', params: { quality: 0.8, format: 'image/webp', targetSizeKB: 500 } },
    ],
  },
  {
    id: 'social-ready',
    title: 'Social Ready',
    description: 'Turn an image into a clean, share-ready social asset.',
    intentPatterns: ['social', 'instagram', 'facebook', 'post', 'story', 'social media', 'سوشيال', 'منشور', 'انستجرام', 'فيسبوك', 'ستوري'],
    steps: [
      { toolId: 'image-cropper', title: 'Set the crop', params: { aspectRatio: '1:1' } },
      { toolId: 'image-effects', title: 'Tune the look', optional: true, params: { brightness: 102, contrast: 105, saturate: 108 } },
      { toolId: 'image-compressor', title: 'Optimize for sharing', params: { quality: 0.82, format: 'image/webp' } },
    ],
  },
  {
    id: 'profile-ready',
    title: 'Profile Ready',
    description: 'Create a clean portrait image for a profile or ID-style use.',
    intentPatterns: ['profile', 'avatar', 'headshot', 'portrait', 'id photo', 'صورة شخصية', 'بروفايل', 'صورة بروفايل', 'صورة مهنية'],
    steps: [
      { toolId: 'background-remover', title: 'Clean the background', optional: true, params: { tolerance: 42 } },
      { toolId: 'image-cropper', title: 'Frame the portrait', params: { aspectRatio: '1:1' } },
      { toolId: 'image-compressor', title: 'Keep the file light', params: { quality: 0.84, format: 'image/webp' } },
    ],
  },
  {
    id: 'web-ready',
    title: 'Web Ready',
    description: 'Make an image lighter and appropriately sized for a website.',
    intentPatterns: ['website', 'web', 'site', 'homepage', 'landing page', 'online', 'موقع', 'ويب', 'صفحة ويب', 'للموقع'],
    steps: [
      { toolId: 'image-cropper', title: 'Set the dimensions', optional: true, params: { aspectRatio: '16:9' } },
      { toolId: 'image-converter', title: 'Choose the right format', optional: true, params: { format: 'image/webp' } },
      { toolId: 'image-compressor', title: 'Compress for the web', params: { quality: 0.78, format: 'image/webp', targetSizeKB: 350 } },
    ],
  },
  {
    id: 'print-ready',
    title: 'Print Ready',
    description: 'Prepare an image for cleaner, higher-resolution output.',
    intentPatterns: ['print', 'printing', 'poster', 'flyer', 'paper', 'high resolution', 'طباعة', 'بوستر', 'فلاير', 'دقة عالية'],
    steps: [
      { toolId: 'image-upscaler', title: 'Increase resolution', params: { scale: 2 } },
      { toolId: 'image-cropper', title: 'Set print dimensions', optional: true, params: { aspectRatio: '4:5' } },
    ],
  },
  {
    id: 'improve-image',
    title: 'Improve Image',
    description: 'Start with the most common quality improvements without learning the tools.',
    intentPatterns: ['improve', 'enhance', 'better', 'sharper', 'quality', 'fix image', 'clean image', 'تحسين', 'حسن الصورة', 'اجعلها أوضح', 'وضّح الصورة', 'جودة الصورة'],
    steps: [
      { toolId: 'image-upscaler', title: 'Improve quality', params: { scale: 1.5 } },
      { toolId: 'image-effects', title: 'Tune the look', optional: true, params: { brightness: 102, contrast: 104, saturate: 105 } },
    ],
  },
]);

export const getWorkflow = (id: string) => WORKFLOW_REGISTRY.find((workflow) => workflow.id === id);
