type ImageEffectsWorkerMessage = {
  blob: Blob;
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
};

type ImageEffectsWorkerScope = {
  onmessage: ((event: MessageEvent<ImageEffectsWorkerMessage>) => void | Promise<void>) | null;
  postMessage(message: unknown): void;
};

const imageEffectsWorkerScope = self as unknown as ImageEffectsWorkerScope;

imageEffectsWorkerScope.onmessage = async (event: MessageEvent<ImageEffectsWorkerMessage>) => {
  try {
    if (typeof OffscreenCanvas === 'undefined') throw new Error('Image Effects Worker is unavailable.');
    const image = await createImageBitmap(event.data.blob);
    const canvas = new OffscreenCanvas(event.data.width, event.data.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.filter = `brightness(${event.data.brightness}%) contrast(${event.data.contrast}%) saturate(${event.data.saturate}%) grayscale(${event.data.grayscale}%)`;
    context.drawImage(image, 0, 0, event.data.width, event.data.height);
    image.close();
    const output = await canvas.convertToBlob({ type: 'image/png', quality: 0.96 });
    imageEffectsWorkerScope.postMessage({ ok: true, blob: output });
  } catch (error) {
    imageEffectsWorkerScope.postMessage({ ok: false, error: error instanceof Error ? error.message : 'Image Effects Worker failed.' });
  }
};
