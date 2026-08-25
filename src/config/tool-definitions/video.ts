import { lazy } from 'react';
import type { ToolConfig } from './types.ts';

export const VIDEO_TOOLS: readonly ToolConfig[] = Object.freeze([
  { id: 'video-trimmer-splitter', title: 'Video Trimmer & Splitter', path: '/en/video-trimmer-splitter', description: 'Trim video locally in your browser and export the selected clip as WebM.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/video-trimmer-splitter').then((m) => ({ default: m.VideoTrimmerSplitterTool }))) },
  { id: 'video-gif-meme', title: 'Video to GIF & Meme Maker', path: '/en/video-gif-meme', description: 'Convert short video clips to GIFs and add top/bottom meme text locally.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/video-gif-meme').then((m) => ({ default: m.VideoGifMemeTool }))) },
  { id: 'video-compressor-converter', title: 'Video Compressor & Converter', path: '/en/video-compressor-converter', description: 'Compress and convert video locally with a background FFmpeg worker.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/video-compressor-converter').then((m) => ({ default: m.VideoCompressorConverterTool }))) },
]);
