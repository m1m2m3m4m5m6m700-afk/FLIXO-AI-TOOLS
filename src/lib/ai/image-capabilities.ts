import type { ImageAICapability } from './image-ai';

export type ImageAICapabilityConfig = {
  readonly id: ImageAICapability;
  readonly title: string;
  readonly requiresImage: boolean;
  readonly enabled: boolean;
};

export const IMAGE_AI_CAPABILITIES: readonly ImageAICapabilityConfig[] = Object.freeze([
  { id: 'analyze-image', title: 'AI Image Analysis', requiresImage: true, enabled: false },
  { id: 'generate-image', title: 'AI Image Generation', requiresImage: false, enabled: false },
  { id: 'remove-background', title: 'AI Background Removal', requiresImage: true, enabled: false },
  { id: 'remove-object', title: 'AI Object Removal', requiresImage: true, enabled: false },
  { id: 'upscale-image', title: 'AI Image Upscaling', requiresImage: true, enabled: false },
  { id: 'generate-alt-text', title: 'AI Alt Text', requiresImage: true, enabled: false },
]);
