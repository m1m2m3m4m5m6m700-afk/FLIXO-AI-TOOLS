import type { SeparationBackend, SeparationProgress, SeparationResult } from './engine';

type DemucsModule = {
  DemucsProcessor: new (options: { ort: unknown; onProgress?: (progress: number) => void; onLog?: (phase: string, message: string) => void }) => {
    loadModel: (modelUrl: string) => Promise<void>;
    separate: (left: Float32Array, right: Float32Array) => Promise<SeparationResult>;
  };
  CONSTANTS: { DEFAULT_MODEL_URL: string };
};

type OrtModule = { env: { wasm?: { wasmPaths?: string } } };

type WorkerRequest = {
  jobId: string;
  left: Float32Array;
  right: Float32Array;
  backend: SeparationBackend;
};

type WorkerEvent =
  | { type: 'progress'; jobId: string; data: SeparationProgress }
  | { type: 'done'; jobId: string; result: SeparationResult }
  | { type: 'error'; jobId: string; message: string };

const selfScope = globalThis as typeof globalThis & {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerEvent, transfer?: Transferable[]) => void;
};

const DEMUCS_URL = 'https://esm.sh/demucs-web@1.0.2?bundle';
const ORT_URL = 'https://esm.sh/onnxruntime-web@1.27.0?bundle';
let processorPromise: Promise<DemucsModule['DemucsProcessor']> | null = null;

async function loadProcessor(backend: SeparationBackend) {
  if (!processorPromise) {
    processorPromise = Promise.all([
      import(/* @vite-ignore */ DEMUCS_URL) as Promise<DemucsModule>,
      import(/* @vite-ignore */ ORT_URL) as Promise<OrtModule>,
    ]).then(async ([demucs, ort]) => {
      if (backend === 'wasm' && ort.env.wasm) {
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
      }
      const processor = new demucs.DemucsProcessor({
        ort,
        onProgress: (progress) => {
          selfScope.postMessage({ type: 'progress', jobId: currentJobId, data: { phase: 'AI inference', progress: Math.max(0, Math.min(1, progress)) } });
        },
      });
      await processor.loadModel(demucs.CONSTANTS.DEFAULT_MODEL_URL);
      return processor;
    });
  }
  return processorPromise;
}

let currentJobId = '';

selfScope.onmessage = async ({ data }) => {
  currentJobId = data.jobId;
  try {
    selfScope.postMessage({ type: 'progress', jobId: data.jobId, data: { phase: 'Loading local AI model', progress: 0.05 } });
    const processor = await loadProcessor(data.backend);
    selfScope.postMessage({ type: 'progress', jobId: data.jobId, data: { phase: 'Separating stems', progress: 0.15 } });
    const result = await processor.separate(data.left, data.right);
    selfScope.postMessage({ type: 'done', jobId: data.jobId, result }, Object.values(result).flatMap((stem) => [stem.left.buffer, stem.right.buffer]));
  } catch (error) {
    selfScope.postMessage({ type: 'error', jobId: data.jobId, message: error instanceof Error ? error.message : 'Local AI separation failed.' });
  } finally {
    currentJobId = '';
  }
};
