import { test, expect } from '@playwright/test';

test.describe('Filter Mask live camera surface', () => {
  test('exposes the canonical live-filter catalog and selection controls', async ({ page }) => {
    await page.goto('/en/filter-mask');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filter Mask' })).toBeVisible();

    const filterButtons = section.locator('button[aria-pressed]');
    await expect(filterButtons).toHaveCount(69);

    const original = section.getByRole('button', { name: /Original effect\.original/ });
    await expect(original).toHaveAttribute('aria-pressed', 'true');

    const firstNonOriginal = section.getByRole('button', { name: /Warm/ }).first();
    await firstNonOriginal.click();
    await expect(firstNonOriginal).toHaveAttribute('aria-pressed', 'true');
    await expect(original).toHaveAttribute('aria-pressed', 'false');

    const search = section.getByRole('textbox', { name: 'Search filters' });
    await search.fill('cinematic');
    await expect(section.getByRole('button', { name: /Cinematic/ }).first()).toBeVisible();
    await expect(section.getByRole('button', { name: /Original effect\.original/ })).toHaveCount(0);

    const intensity = section.locator('input[type="range"]');
    await expect(intensity).toHaveValue('100');
    await intensity.fill('60');
    await expect(intensity).toHaveValue('60');
  });

  test('reports a clear error when camera permission is denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException('Permission denied', 'NotAllowedError');
          },
        },
      });
    });

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await section.getByRole('button', { name: 'Start camera' }).first().click();
    await expect(section.getByRole('alert')).toHaveText('Camera or microphone access was denied or unavailable.');
  });

  test('keeps camera-dependent actions fail-closed before camera startup', async ({ page }) => {
    await page.goto('/en/filter-mask');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await expect(section.getByRole('button', { name: 'Start camera' }).first()).toBeEnabled();
    await expect(section.getByRole('button', { name: 'Stop' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Switch camera' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Photo' }).first()).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Record video' }).first()).toBeDisabled();
    await expect(section.getByRole('region', { name: 'Filter Mask' }).getByText('Download result')).toHaveCount(0);
  });
  test('runs the camera/capture/recording lifecycle against a synthetic MediaStream', async ({ page }, testInfo) => {
    await page.goto('/en/filter-mask');
    const mediaCapabilities = await page.evaluate(() => ({ captureStream: 'captureStream' in HTMLCanvasElement.prototype, mediaRecorder: 'MediaRecorder' in window }));
    if (!mediaCapabilities.captureStream || !mediaCapabilities.mediaRecorder) {
      testInfo.skip(true, 'Synthetic camera recording primitives are unavailable in this browser.');
    }

    await page.addInitScript(() => {
      const source = document.createElement('canvas');
      source.width = 320;
      source.height = 240;
      const ctx = source.getContext('2d');
      if (!ctx) throw new Error('Synthetic camera canvas is unavailable.');
      let frame = 0;
      const paint = () => {
        frame += 1;
        ctx.fillStyle = frame % 2 ? '#123456' : '#654321';
        ctx.fillRect(0, 0, source.width, source.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '32px sans-serif';
        ctx.fillText('FLIXO', 30, 90);
        requestAnimationFrame(paint);
      };
      paint();
      const cameraStream = source.captureStream(30);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => cameraStream },
      });
    });

    await page.goto('/en/filter-mask');
    const section = page.getByRole('region', { name: 'Filter Mask' });
    const selected = section.getByRole('button', { name: /Warm effect\.warm/ }).first();
    await selected.click();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(selected).toContainText('effect.warm');

    await section.getByRole('button', { name: 'Start camera' }).first().click();
    await expect(section.getByRole('button', { name: 'Stop' }).first()).toBeEnabled();

    const video = section.locator('video[aria-label="Filter Mask live camera"]');
    await expect.poll(async () => video.evaluate((node) => {
      const element = node as HTMLVideoElement;
      return { readyState: element.readyState, width: element.videoWidth, height: element.videoHeight };
    }), { timeout: 10_000 }).toEqual({ readyState: 4, width: 320, height: 240 });

    await expect(section.getByRole('button', { name: 'Photo' })).toBeEnabled();
    await section.getByRole('button', { name: 'Photo' }).click();
    await expect(section.getByText('Download result')).toBeVisible();

    const photoLink = section.getByRole('link', { name: 'Download result' });
    await expect(photoLink).toHaveAttribute('download', 'flixo-filter-mask.jpg');

    const recordButton = section.getByRole('button', { name: 'Record video' });
    await expect(recordButton).toBeEnabled();
    await recordButton.click();
    await expect(section.getByRole('button', { name: 'Stop recording' })).toBeVisible();
    await page.waitForTimeout(1200);
    await section.getByRole('button', { name: 'Stop recording' }).click();
    await expect(section.getByRole('link', { name: 'Download result' })).toHaveAttribute('download', 'flixo-filter-mask.webm');

    await section.getByRole('button', { name: 'Stop' }).click();
    await expect(section.getByRole('button', { name: 'Stop' })).toBeDisabled();
    await expect(video).toHaveJSProperty('srcObject', null);
  });

});
