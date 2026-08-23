import { FFmpeg } from '@ffmpeg/ffmpeg';
const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
type RequestMessage = { jobId: string; bytes: Uint8Array; inputName: string; outputName: string; args: string[] };
const scope = globalThis as typeof globalThis & { postMessage: (message: unknown, transfer?: Transferable[]) => void; onmessage: ((event: MessageEvent<RequestMessage>) => void) | null };
const ffmpeg = new FFmpeg(); let loaded = false;
async function ensureLoaded(jobId: string) {
  if (loaded) return;
  scope.postMessage({ type: 'status', jobId, message: 'Loading audio converter…' });
  await ffmpeg.load({ coreURL: `${CORE}/ffmpeg-core.js`, wasmURL: `${CORE}/ffmpeg-core.wasm`, workerURL: `${CORE}/ffmpeg-core.worker.js` });
  ffmpeg.on('progress', ({ progress }) => scope.postMessage({ type: 'progress', jobId, progress: Math.max(0, Math.min(1, progress)) }));
  loaded = true;
}
scope.onmessage = async ({ data }) => {
  try {
    await ensureLoaded(data.jobId);
    await ffmpeg.writeFile(data.inputName, data.bytes);
    await ffmpeg.exec(data.args);
    const result = await ffmpeg.readFile(data.outputName);
    const bytes = result instanceof Uint8Array ? result : new TextEncoder().encode(result);
    const safe = new Uint8Array(bytes);
    scope.postMessage({ type: 'done', jobId: data.jobId, bytes: safe }, [safe.buffer]);
    await ffmpeg.deleteFile(data.inputName); await ffmpeg.deleteFile(data.outputName);
  } catch (error) { scope.postMessage({ type: 'error', jobId: data.jobId, message: error instanceof Error ? error.message : String(error) }); }
};
