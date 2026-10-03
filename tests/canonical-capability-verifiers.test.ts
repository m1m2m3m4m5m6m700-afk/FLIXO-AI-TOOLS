import assert from 'node:assert/strict';
import { test } from 'node:test';

const { CAPABILITY_DEFINITIONS } = await import('../src/config/manual-capability-definition.ts');

function definition(id: string) {
  const result = CAPABILITY_DEFINITIONS.find((item) => item.id === id);
  assert.ok(result, id);
  return result;
}

test('canonical MVP capability verifiers accept measurable valid artifacts and reject neutral effects', async () => {
  const globals = globalThis as typeof globalThis & {
    createImageBitmap?: unknown;
    document?: unknown;
  };
  const originalCreateImageBitmap = globals.createImageBitmap;
  const originalDocument = globals.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  const imageDimensions = new WeakMap<Blob, { width: number; height: number }>();
  const urlBlobs = new Map<string, Blob>();
  const videoMetadata = new WeakMap<Blob, { width: number; height: number; duration: number }>();
  let imageDataRead = 0;

  globals.createImageBitmap = async (blob: Blob) => ({
    width: imageDimensions.get(blob)?.width ?? 1,
    height: imageDimensions.get(blob)?.height ?? 1,
    close() {},
  });

  URL.createObjectURL = ((blob: Blob) => {
    const url = 'blob:test-' + String(urlBlobs.size + 1);
    urlBlobs.set(url, blob);
    return url;
  }) as typeof URL.createObjectURL;

  URL.revokeObjectURL = ((url: string) => {
    urlBlobs.delete(url);
  }) as typeof URL.revokeObjectURL;

  const canvasContext = {
    clearRect() {},
    drawImage() {},
    getImageData() {
      imageDataRead += 1;
      const data = new Uint8ClampedArray(32 * 32 * 4);
      if (imageDataRead % 2 === 0) {
        for (let index = 0; index < data.length; index += 4) {
          data[index] = 255;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
      return { data };
    },
  };

  class FakeVideo {
    duration = 0;
    videoWidth = 0;
    videoHeight = 0;
    preload = '';
    onloadedmetadata: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = '';

    set src(value: string) {
      this._src = value;
      queueMicrotask(() => {
        const blob = urlBlobs.get(this._src);
        const meta = blob ? videoMetadata.get(blob) : undefined;
        if (!meta) {
          this.onerror?.();
          return;
        }
        this.duration = meta.duration;
        this.videoWidth = meta.width;
        this.videoHeight = meta.height;
        this.onloadedmetadata?.();
      });
    }

    get src() {
      return this._src;
    }

    removeAttribute() {
      this._src = '';
    }

    load() {}
  }

  globals.document = {
    createElement(tag: string) {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext() {
            return canvasContext;
          },
        };
      }
      if (tag === 'video') return new FakeVideo();
      throw new Error('Unsupported fake element: ' + tag);
    },
  };

  try {
    const input = new Blob(['input'], { type: 'image/png' });
    const output = new Blob(['output'], { type: 'image/png' });
    imageDimensions.set(input, { width: 100, height: 50 });
    imageDimensions.set(output, { width: 200, height: 100 });
    assert.equal(await definition('image-upscaler').verifier(input, output, { scale: 2 }), true);

    imageDimensions.set(output, { width: 50, height: 50 });
    assert.equal(await definition('image-cropper').verifier(input, output, { aspectRatio: '1:1' }), true);

    const effectsInput = new Blob(['effects-input'], { type: 'image/png' });
    const effectsOutput = new Blob(['effects-output'], { type: 'image/png' });
    imageDimensions.set(effectsInput, { width: 32, height: 32 });
    imageDimensions.set(effectsOutput, { width: 32, height: 32 });
    imageDataRead = 0;
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { contrast: 120 }), true);
    assert.equal(await definition('image-effects').verifier(effectsInput, effectsOutput, { brightness: 100 }), false);

    const bgInput = new Blob(['bg-input'], { type: 'image/png' });
    const bgOutput = new Blob(['bg-output'], { type: 'image/png' });
    imageDimensions.set(bgInput, { width: 32, height: 32 });
    imageDimensions.set(bgOutput, { width: 32, height: 32 });
    imageDataRead = 0;
    assert.equal(await definition('background-remover').verifier(bgInput, bgOutput, {}), true);

    const compressedInput = new Blob(['x'.repeat(1000)], { type: 'image/png' });
    const compressedOutput = new Blob(['x'.repeat(400)], { type: 'image/webp' });
    assert.equal(await definition('image-compressor').verifier(compressedInput, compressedOutput, { targetSizeKB: 1 }), true);

    const converted = new Blob(['converted'], { type: 'image/webp' });
    assert.equal(await definition('image-converter').verifier(input, converted, { format: 'image/webp' }), true);

    const trimInput = new Blob(['video-input'], { type: 'video/webm' });
    const trimOutput = new Blob(['video-output'], { type: 'video/webm' });
    videoMetadata.set(trimInput, { width: 320, height: 180, duration: 10 });
    videoMetadata.set(trimOutput, { width: 320, height: 180, duration: 5 });
    assert.equal(await definition('video-trimmer').verifier(trimInput, trimOutput, { startSec: 0, endSec: 5 }), true);

    const cropVideoOutput = new Blob(['video-crop'], { type: 'video/webm' });
    videoMetadata.set(cropVideoOutput, { width: 200, height: 120, duration: 10 });
    assert.equal(await definition('video-cropper').verifier(trimInput, cropVideoOutput, { width: 200, height: 120 }), true);

    const resizeVideoOutput = new Blob(['video-resize'], { type: 'video/webm' });
    videoMetadata.set(resizeVideoOutput, { width: 640, height: 360, duration: 10 });
    assert.equal(await definition('video-resizer').verifier(trimInput, resizeVideoOutput, { width: 640, height: 360 }), true);

    const compressorInput = new Blob(['z'.repeat(2000)], { type: 'video/webm' });
    const compressorOutput = new Blob(['z'.repeat(800)], { type: 'video/webm' });
    videoMetadata.set(compressorInput, { width: 320, height: 180, duration: 10 });
    videoMetadata.set(compressorOutput, { width: 320, height: 180, duration: 10 });
    assert.equal(await definition('video-compressor').verifier(compressorInput, compressorOutput, { videoBitsPerSecond: 1_000_000 }), true);
  } finally {
    if (originalCreateImageBitmap === undefined) delete globals.createImageBitmap;
    else globals.createImageBitmap = originalCreateImageBitmap;
    if (originalDocument === undefined) delete globals.document;
    else globals.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
