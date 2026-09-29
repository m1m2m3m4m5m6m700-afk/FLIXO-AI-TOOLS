type OcrWorkerMessage = { blob: Blob };

type OcrWorkerScope = {
  onmessage: ((event: MessageEvent<OcrWorkerMessage>) => void | Promise<void>) | null;
  postMessage(message: unknown): void;
};

type OcrWorkerCanvasContext = {
  drawImage(image: ImageBitmap, dx: number, dy: number, width: number, height: number): void;
  getImageData(sx: number, sy: number, width: number, height: number): ImageData;
  putImageData(imageData: ImageData, dx: number, dy: number): void;
};

type OcrWorkerCanvas = {
  width: number;
  height: number;
  getContext(contextId: '2d', options?: { willReadFrequently?: boolean }): OcrWorkerCanvasContext | null;
  convertToBlob(options?: { type?: string }): Promise<Blob>;
};

type OcrWorkerGlobal = {
  createImageBitmap(image: Blob): Promise<ImageBitmap>;
  OffscreenCanvas?: new (width: number, height: number) => OcrWorkerCanvas;
};

const ocrWorkerScope = self as unknown as OcrWorkerScope;
const ocrWorkerGlobal = globalThis as unknown as OcrWorkerGlobal;

ocrWorkerScope.onmessage = async (event: MessageEvent<OcrWorkerMessage>) => {
  try {
    if (!ocrWorkerGlobal.OffscreenCanvas) throw new Error('OffscreenCanvas is unavailable.');
    const image = await ocrWorkerGlobal.createImageBitmap(event.data.blob);
    const scale = Math.min(2.5, Math.max(1, 1600 / Math.max(image.width, image.height)));
    const canvas = new ocrWorkerGlobal.OffscreenCanvas(
      Math.max(1, Math.round(image.width * scale)),
      Math.max(1, Math.round(image.height * scale)),
    );
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('OCR worker canvas is unavailable.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < data.data.length; index += 4) {
      const luminance = 0.2126 * data.data[index] + 0.7152 * data.data[index + 1] + 0.0722 * data.data[index + 2];
      const boosted = Math.max(0, Math.min(255, (luminance - 128) * 1.45 + 128));
      data.data[index] = boosted;
      data.data[index + 1] = boosted;
      data.data[index + 2] = boosted;
    }
    context.putImageData(data, 0, 0);
    const prepared = await canvas.convertToBlob({ type: 'image/png' });
    ocrWorkerScope.postMessage({ ok: true, blob: prepared });
  } catch (error) {
    ocrWorkerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : 'OCR preprocessing worker failed.',
    });
  }
};
