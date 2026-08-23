export type SeparationBackend = 'webgpu' | 'wasm';
export type StemName = 'vocals' | 'drums' | 'bass' | 'other';

export type SeparationProgress = {
  phase: string;
  progress: number;
};

export type StemAudio = {
  left: Float32Array;
  right: Float32Array;
};

export type SeparationResult = Record<StemName, StemAudio>;

export const MAX_DURATION_SECONDS = 600;
export const APPROX_MODEL_BYTES = 170 * 1024 * 1024;

export function validateDuration(durationSeconds: number): void {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Unable to determine audio duration.');
  }
  if (durationSeconds > MAX_DURATION_SECONDS) {
    throw new Error('Local AI separation is limited to 10 minutes.');
  }
}

export function supportsWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function mixInstrumental(result: SeparationResult): StemAudio {
  const length = result.vocals.left.length;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (const stem of ['drums', 'bass', 'other'] as const) {
    const current = result[stem];
    for (let index = 0; index < length; index += 1) {
      left[index] += current.left[index];
      right[index] += current.right[index];
    }
  }
  return { left, right };
}

export function encodeWav(stem: StemAudio, sampleRate = 44100): ArrayBuffer {
  const frameCount = stem.left.length;
  const channelCount = 2;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + frameCount * blockAlign);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + frameCount * blockAlign, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, frameCount * blockAlign, true);
  let offset = 44;
  for (let index = 0; index < frameCount; index += 1) {
    const left = Math.max(-1, Math.min(1, stem.left[index] ?? 0));
    const right = Math.max(-1, Math.min(1, stem.right[index] ?? 0));
    view.setInt16(offset, Math.round(left * 32767), true);
    view.setInt16(offset + 2, Math.round(right * 32767), true);
    offset += 4;
  }
  return buffer;
}
