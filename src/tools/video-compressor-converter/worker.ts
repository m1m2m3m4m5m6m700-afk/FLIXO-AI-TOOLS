import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

type WorkerRequest = {
  jobId: string;
  file: Uint8Array;
  inputName: string;
  outputName: string;
  args: string[];
};

const scope = globalThis as typeof globalThis & {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

const ffmpeg = new FFmpeg();
let loaded = false;

async function ensureLoaded(jobId: string) {
  if (loaded) return;
  scope.postMessage({ type: 'status', jobId, message: 'Loading FFmpeg engine…' });
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.worker.js`, 'text/javascript'),
  });
  ffmpeg.on('progress', ({ progress }) => {
    scope.postMessage({ type: 'progress', jobId, progress: Math.max(0, Math.min(1, progress)) });
  });
  loaded = true;
}

scope.onmessage = async ({ data }) => {
  const { jobId, file, inputName, outputName, args } = data;
  try {
    await ensureLoaded(jobId);
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(args);
    const result = await ffmpeg.readFile(outputName);
    const bytes = result instanceof Uint8Array ? result : new TextEncoder().encode(result);
    scope.postMessage({ type: 'done', jobId, bytes }, [bytes.buffer]);
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch (error) {
    scope.postMessage({ type: 'error', jobId, message: error instanceof Error ? error.message : String(error) });
  }
};
