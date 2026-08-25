import { lazy } from 'react';
import type { ToolConfig } from './types.ts';

export const AUDIO_TOOLS: readonly ToolConfig[] = Object.freeze([
  { id: 'audio-extractor-muter', title: 'Audio Extractor & Muter', path: '/en/audio-extractor-muter', description: 'Extract audio or mute a video locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/audio-extractor-muter').then((m) => ({ default: m.AudioExtractorMuterTool }))) },
  { id: 'audio-cutter-trimmer', title: 'Audio Cutter & Trimmer', path: '/en/audio-cutter-trimmer', description: 'Cut audio locally with precise start/end controls and waveform preview.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/audio-cutter-trimmer').then((m) => ({ default: m.AudioCutterTrimmerTool }))) },
  { id: 'audio-compressor', title: 'Audio Compressor', path: '/en/audio-compressor', description: 'Reduce decoded audio size locally with a background worker.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/audio-compressor').then((m) => ({ default: m.AudioCompressorTool }))) },
  { id: 'audio-noise-reducer', title: 'Audio Noise Reducer', path: '/en/audio-noise-reducer', description: 'Reduce steady background noise locally in your browser.', category: 'Other', isReady: true, component: lazy(() => import('@/tools/audio-noise-reducer').then((m) => ({ default: m.AudioNoiseReducerTool }))) },
]);
