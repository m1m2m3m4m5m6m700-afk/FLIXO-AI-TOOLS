import { expect, test } from '../fixtures/universal-runtime-evidence';

async function buildVideoFixture(page: Parameters<Parameters<typeof test>[2]>[0]['page']): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    if (typeof MediaRecorder === 'undefined') throw new Error('VIDEO_FIXTURE_MEDIARECORDER_UNAVAILABLE');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('VIDEO_FIXTURE_CANVAS_UNAVAILABLE');

    const candidates = [
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const mimeType = candidates.find((candidate) =>
      typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(candidate),
    );
    if (!mimeType) throw new Error('VIDEO_FIXTURE_WEBM_UNAVAILABLE');

    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    const finished = new Promise<void>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error('VIDEO_FIXTURE_RECORDING_FAILED'));
      recorder.onstop = () => resolve();
    });

    recorder.start();
    const started = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => {
        const elapsed = performance.now() - started;
        context.fillStyle = '#111827';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = elapsed < 400 ? '#22c55e' : '#3b82f6';
        context.fillRect(30, 30, 120 + Math.min(120, elapsed / 5), 120);
        context.fillStyle = '#ffffff';
        context.font = '24px sans-serif';
        context.fillText('FLIXO VIDEO FIXTURE', 25, 165);
        if (elapsed >= 800) {
          recorder.stop();
          resolve();
          return;
        }
        requestAnimationFrame(draw);
      };
      draw();
    });

    await finished;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: 'video/webm' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const batch = 0x8000;
    for (let index = 0; index < bytes.length; index += batch) {
      binary += String.fromCharCode(...bytes.subarray(index, index + batch));
    }
    return btoa(binary);
  });

  return Buffer.from(base64, 'base64');
}

const VIDEO_CASES = [
  { id: 'video-trimmer', title: 'Video Trimmer' },
  { id: 'video-cropper', title: 'Video Cropper' },
  { id: 'video-resizer', title: 'Video Resizer' },
  { id: 'video-compressor', title: 'Video Compressor' },
] as const;

test.describe('MVP video capability individual acceptance', () => {
  for (const videoCase of VIDEO_CASES) {
    test(videoCase.id + ' executes locally and produces a verified WebM artifact', async ({ page }) => {
      await page.goto('/en/' + videoCase.id);
      await expect(page.getByRole('heading', { name: 'Local video processing' })).toBeVisible();

      const fixture = await buildVideoFixture(page);
      expect(fixture.length).toBeGreaterThan(100);

      await page.getByLabel('Choose video').setInputFiles({
        name: videoCase.id + '-fixture.webm',
        mimeType: 'video/webm',
        buffer: fixture,
      });

      await page.getByRole('button', { name: 'Process video' }).click();

      const downloadLink = page.getByRole('link', { name: 'Download result' });
      await expect(downloadLink).toBeVisible({ timeout: 30_000 });

      const outputUrl = await downloadLink.getAttribute('href');
      expect(outputUrl).toMatch(/^blob:/u);

      const metadata = await page.evaluate(async (url) => {
        if (!url) throw new Error('VIDEO_OUTPUT_URL_MISSING');
        const response = await fetch(url);
        const blob = await response.blob();
        if (blob.size <= 4 || blob.type !== 'video/webm') {
          throw new Error('VIDEO_OUTPUT_CONTRACT_INVALID');
        }
        const video = document.createElement('video');
        video.preload = 'metadata';
        const objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        try {
          await new Promise<void>((resolve, reject) => {
            video.onloadedmetadata = () => resolve();
            video.onerror = () => reject(new Error('VIDEO_OUTPUT_METADATA_INVALID'));
          });
          return { size: blob.size, type: blob.type, duration: video.duration, width: video.videoWidth, height: video.videoHeight };
        } finally {
          URL.revokeObjectURL(objectUrl);
          video.removeAttribute('src');
          video.load();
        }
      }, outputUrl);

      expect(metadata.size).toBeGreaterThan(4);
      expect(metadata.type).toBe('video/webm');
      expect(metadata.duration).toBeGreaterThan(0);
      expect(metadata.width).toBeGreaterThan(0);
      expect(metadata.height).toBeGreaterThan(0);

      const downloadPromise = page.waitForEvent('download');
      await downloadLink.click();
      const download = await downloadPromise;
      expect(await download.failure()).toBeNull();
      expect(download.suggestedFilename()).toBe('flixo-video-output.webm');
    });
  }
});
