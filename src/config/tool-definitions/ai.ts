import { lazy } from 'react';
import type { ToolConfig } from './types.ts';

export const AI_TOOLS: readonly ToolConfig[] = Object.freeze([
  { id: 'ai-captioner-srt', title: 'AI Auto-Captioner & SRT Generator', path: '/en/ai-captioner-srt', description: 'Transcribe short media locally with Whisper and export timestamped SRT/VTT captions.', category: 'AI', isReady: true, component: lazy(() => import('@/tools/ai-captioner-srt').then((m) => ({ default: m.AiCaptionerSrtTool }))) },
  { id: 'ai-vocal-instrumental-remover', title: 'AI Vocal & Instrumental Remover', path: '/en/ai-vocal-instrumental-remover', description: 'Separate vocals and instrumental audio locally with a browser Demucs model.', category: 'AI', isReady: true, component: lazy(() => import('@/tools/ai-vocal-instrumental-remover').then((m) => ({ default: m.AiVocalInstrumentalRemoverTool }))) },
  { id: 'ai-image-generator', title: 'AI Image Generator', path: '/en/ai-image-generator', description: 'Generate images through a configured image endpoint.', category: 'AI', isReady: true, component: lazy(() => import('@/tools/ai-image-generator').then((m) => ({ default: m.AiImageGeneratorTool }))) },
  { id: 'photo-colorizer', title: 'Photo Colorizer', path: '/en/photo-colorizer', description: 'Colorize photos through a configured AI endpoint.', category: 'AI', isReady: false, component: lazy(() => import('@/tools/photo-colorizer')) },
]);
