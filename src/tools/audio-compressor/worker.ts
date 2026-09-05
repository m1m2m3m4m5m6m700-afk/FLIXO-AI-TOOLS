type WorkerRequest = { jobId: string; samples: Float32Array; sampleRate: number; channels: number; quality: 'high' | 'balanced' | 'small' };
type WorkerResponse = { type: 'progress'; jobId: string; progress: number } | { type: 'done'; jobId: string; bytes: ArrayBuffer } | { type: 'error'; jobId: string; message: string };

const scope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function encodeWav(samples: Float32Array, sampleRate: number, channels: number): ArrayBuffer {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 0x7fff;
  const dataBytes = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF'); view.setUint32(4, 36 + dataBytes, true); writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); writeAscii(view, 36, 'data'); view.setUint32(40, dataBytes, true);
  new Uint8Array(buffer, 44).set(new Uint8Array(pcm.buffer));
  return buffer;
}

function downsample(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (targetRate >= sourceRate) return samples.slice();
  const ratio = sourceRate / targetRate;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) output[i] = samples[Math.min(samples.length - 1, Math.floor(i * ratio))];
  return output;
}

scope.onmessage = ({ data }) => {
  try {
    const targetRate = data.quality === 'high' ? Math.min(data.sampleRate, 48_000) : data.quality === 'small' ? Math.min(data.sampleRate, 16_000) : Math.min(data.sampleRate, 24_000);
    scope.postMessage({ type: 'progress', jobId: data.jobId, progress: 0.25 });
    const resampled = downsample(data.samples, data.sampleRate, targetRate);
    scope.postMessage({ type: 'progress', jobId: data.jobId, progress: 0.75 });
    const output = encodeWav(resampled, targetRate, data.channels);
    scope.postMessage({ type: 'done', jobId: data.jobId, bytes: output }, [output]);
  } catch (error) {
    scope.postMessage({ type: 'error', jobId: data.jobId, message: error instanceof Error ? error.message : 'Audio compression failed.' });
  }
};
