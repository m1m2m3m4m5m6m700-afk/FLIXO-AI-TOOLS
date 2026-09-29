export type OcrWorkerResult = { text: string };

type WorkerResponse = { ok: boolean; blob?: Blob; error?: string };
type TesseractApi = {
  recognize(input: Blob, language: string): Promise<{ data: { text: string } }>;
};

declare global {
  interface Window {
    Tesseract?: TesseractApi;
  }
}

async function ensureTesseract(): Promise<TesseractApi> {
  if (window.Tesseract) return window.Tesseract;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('OCR engine could not be loaded.'));
    document.head.appendChild(script);
  });
  if (!window.Tesseract) throw new Error('OCR engine is unavailable.');
  return window.Tesseract;
}

async function preprocessWithWorker(blob: Blob): Promise<Blob> {
  if (typeof Worker === 'undefined') throw new Error('Web Worker is unavailable.');

  return await new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('./ocr-worker.ts', import.meta.url), { type: 'classic' });
    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      if (event.data.ok && event.data.blob instanceof Blob) {
        resolve(event.data.blob);
      } else {
        reject(new Error(event.data.error || 'OCR preprocessing failed.'));
      }
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('OCR preprocessing worker could not start.'));
    };

    worker.postMessage({ blob });
  });
}

export async function recognizeWithOcrWorker(blob: Blob, language: string): Promise<OcrWorkerResult> {
  const prepared = await preprocessWithWorker(blob);
  const tesseract = await ensureTesseract();
  const result = await tesseract.recognize(prepared, language);
  return { text: result.data.text };
}
