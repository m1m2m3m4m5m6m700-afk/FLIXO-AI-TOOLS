import { test, expect } from '@playwright/test';

test.describe('Filter Mask live camera surface', () => {
  test('exposes the canonical live-filter catalog and selection controls', async ({ page }) => {
    await page.goto('/en/filter-mask');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    await expect(section).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Filter Mask' })).toBeVisible();

    const filterButtons = section.locator('button[data-filter-canonical-id]');
    await expect(filterButtons).toHaveCount(100);

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

    const intensity = section.getByRole('slider').last();
    await expect(intensity).toHaveValue('100');
    await intensity.fill('60');
    await expect(intensity).toHaveValue('60');

    const zoom = section.getByRole('slider', { name: 'Zoom' });
    await expect(zoom).toHaveValue('1');
    await zoom.fill('1.5');
    await expect(zoom).toHaveValue('1.5');
    await expect(section.getByRole('button', { name: 'Mirror on' })).toHaveAttribute('aria-pressed', 'true');

    const aspectGroup = section.getByRole('group', { name: 'Capture aspect ratio' });
    await expect(aspectGroup.getByRole('button', { name: '9:16' })).toHaveAttribute('aria-pressed', 'true');
    await aspectGroup.getByRole('button', { name: '1:1' }).click();
    await expect(aspectGroup.getByRole('button', { name: '1:1' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/aspectRatio=1%3A1/);
    const quality = section.getByRole('group', { name: 'Capture quality' });
    await expect(quality.getByRole('button', { name: '1080p high' })).toHaveAttribute('aria-pressed', 'true');
    await quality.getByRole('button', { name: '720p standard' }).click();
    await expect(quality.getByRole('button', { name: '720p standard' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/captureQuality=720p/);
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

    await page.goto('/en/filter-mask');
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
      const videoTrack = cameraStream.getVideoTracks()[0];
      Object.defineProperty(videoTrack, 'getCapabilities', {
        configurable: true,
        value: () => ({ torch: true }),
      });
      Object.defineProperty(videoTrack, 'applyConstraints', {
        configurable: true,
        value: async (constraints: MediaTrackConstraints) => {
          (window as typeof window & { __flixoQuality?: MediaTrackConstraints }).__flixoQuality = constraints;
        },
      });
      let requestCount = 0;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async (constraints: MediaStreamConstraints) => {
            requestCount += 1;
            if (requestCount === 1 && constraints.audio) {
              throw new DOMException('Microphone permission denied', 'NotAllowedError');
            }
            return cameraStream;
          },
        },
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
    const torch = section.getByRole('button', { name: 'Torch off' });
    await expect(torch).toHaveAttribute('aria-pressed', 'false');
    await torch.click();
    await expect(section.getByRole('button', { name: 'Torch on' })).toHaveAttribute('aria-pressed', 'true');
    const liveQuality = section.getByRole('group', { name: 'Capture quality' });
    await liveQuality.getByRole('button', { name: '720p standard' }).click();
    await expect(liveQuality.getByRole('button', { name: '720p standard' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => page.evaluate(() => (window as typeof window & { __flixoQuality?: MediaTrackConstraints }).__flixoQuality)).toMatchObject({
      width: { ideal: 1280 },
      height: { ideal: 720 },
    });
    await expect(section.locator('video[aria-label="Filter Mask live camera"]')).toHaveJSProperty('srcObject', expect.anything());

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
    await expect(section.getByRole('button', { name: 'Share result' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Share filter setup' })).toBeVisible();
    await expect.poll(async () => photoLink.evaluate(async (element) => {
      const href = (element as HTMLAnchorElement).href;
      return (await (await fetch(href)).blob()).size;
    })).toBeGreaterThan(0);

    const recordButton = section.getByRole('button', { name: 'Record video' });
    await expect(recordButton).toBeEnabled();
    await recordButton.click();
    await expect(section.getByRole('button', { name: 'Stop recording' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Stop' })).toBeDisabled();
    await page.waitForTimeout(500);
    const cinematic = section.getByRole('button', { name: /Cinema effect\.cinema/ }).first();
    await cinematic.click();
    await expect(cinematic).toHaveAttribute('aria-pressed', 'true');
    await expect(section.getByText(/Recording 00:/)).toBeVisible();
    await page.waitForTimeout(1200);
    await section.getByRole('button', { name: 'Stop recording' }).click();
    const videoLink = section.getByRole('link', { name: 'Download result' });
    await expect.poll(async () => videoLink.getAttribute('download')).toMatch(/\.mp4$|\.webm$/);
    await expect(section.getByRole('button', { name: 'Share result' })).toBeVisible();
    await expect.poll(async () => videoLink.evaluate(async (element) => {
      const href = (element as HTMLAnchorElement).href;
      const blob = await (await fetch(href)).blob();
      if (!blob.type.startsWith('video/')) return 0;
      return blob.size;
    })).toBeGreaterThan(0);

    await section.getByRole('button', { name: 'Stop' }).click();
    await expect(section.getByRole('button', { name: 'Stop' })).toBeDisabled();
    await expect(video).toHaveJSProperty('srcObject', null);
  });

  test('accepts a canonical filter handoff from the live URL', async ({ page }) => {
    await page.goto('/en/filter-mask?canonicalId=effect.warm&intensity=65&zoom=1.6&mirror=false&captureQuality=720p');

    const section = page.getByRole('region', { name: 'Filter Mask' });
    const selected = section.getByRole('button', { name: /Warm effect\.warm/ }).first();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(section.getByRole('slider').last()).toHaveValue('65');
    await expect(section.getByRole('slider', { name: 'Zoom' })).toHaveValue('1.6');
    await expect(section.getByRole('group', { name: 'Capture aspect ratio' }).getByRole('button', { name: '9:16' })).toHaveAttribute('aria-pressed', 'false');
    await expect(section.getByRole('button', { name: 'Mirror off' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page).toHaveURL(/canonicalId=effect\.warm/);
    await expect(page).toHaveURL(/intensity=65/);
    await expect(page).toHaveURL(/zoom=1\.6/);
    await expect(page).toHaveURL(/mirror=false/);
    await expect(page).toHaveURL(/captureQuality=720p/);
  });

  test('agent resolves a live-filter request into a canonical handoff', async ({ page }) => {
    await page.goto('/en');

    const command = page.locator('#flixo-agent-command');
    await expect(command).toBeVisible();
    await command.fill('Warm live filter 65% zoom 1.6x');
    await page.getByRole('button', { name: 'Send' }).click();

    const handoff = page.getByTestId('filter-mask-handoff');
    await expect(handoff).toBeVisible();
    await expect(handoff).toContainText('effect.warm');
    await expect(handoff).toContainText('65%');
    await expect(handoff).toContainText('1.6×');

    const openPreview = handoff.getByRole('link', { name: 'Open live preview' });
    await expect(openPreview).toHaveAttribute('href', '/en/filter-mask?canonicalId=effect.warm&intensity=65&zoom=1.6&mirror=true&aspectRatio=9%3A16&captureQuality=1080p');
    await openPreview.click();
    await expect(page).toHaveURL(/\/en\/filter-mask\?canonicalId=effect\.warm&intensity=65&zoom=1\.6&mirror=true&aspectRatio=9%3A16&captureQuality=1080p/);
    await expect(page.getByRole('button', { name: /Warm effect\.warm/ }).first()).toHaveAttribute('aria-pressed', 'true');
  });
  test('persists favorites and exposes recent filter shortcuts', async ({ page }) => {
    await page.goto('/en/filter-mask');
    const section = page.getByRole('region', { name: 'Filter Mask' });
    const warm = section.getByRole('button', { name: /Warm effect\.warm/ }).first();

    await warm.click();
    const favorite = section.getByRole('button', { name: /Favorite/ }).first();
    await favorite.click();
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');

    await expect(section.getByRole('group', { name: 'Recent filters' })).toContainText('Warm');

    await section.getByRole('button', { name: 'Reset filter' }).click();
    await expect(section.getByRole('button', { name: /Original effect\.original/ }).first()).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    const reloaded = page.getByRole('region', { name: 'Filter Mask' });
    await reloaded.getByRole('button', { name: 'Favorites' }).click();
    await expect(reloaded.getByRole('button', { name: /Warm effect\.warm/ }).first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('persists, reapplies and deletes creator presets through the canonical filter state', async ({ page }) => {
    await page.goto('/en/filter-mask');
    const section = page.getByRole('region', { name: 'Filter Mask' });

    await section.getByRole('button', { name: /Warm effect\\.warm/ }).first().click();
    await section.getByRole('slider').last().fill('65');
    await section.getByRole('slider', { name: 'Zoom' }).fill('1.4');
    await section.getByRole('button', { name: 'Mirror on' }).click();
    await section.getByRole('group', { name: 'Capture aspect ratio' }).getByRole('button', { name: '4:5' }).click();
    await section.getByRole('textbox', { name: 'Preset name' }).fill('Creator Warm');
    await section.getByRole('button', { name: 'Save preset' }).click();

    const preset = section.getByRole('button', { name: 'Creator Warm' });
    await expect(preset).toBeVisible();

    await section.getByRole('button', { name: 'Reset filter' }).click();
    await section.getByRole('slider').last().fill('100');
    await section.getByRole('slider', { name: 'Zoom' }).fill('1');
    await section.getByRole('button', { name: 'Mirror on' }).click();
    await section.getByRole('group', { name: 'Capture aspect ratio' }).getByRole('button', { name: '9:16' }).click();

    await preset.click();
    await expect(section.getByRole('button', { name: /Warm effect\\.warm/ }).first()).toHaveAttribute('aria-pressed', 'true');
    await expect(section.getByRole('slider').last()).toHaveValue('65');
    await expect(section.getByRole('slider', { name: 'Zoom' })).toHaveValue('1.4');
    await expect(section.getByRole('button', { name: 'Mirror off' })).toHaveAttribute('aria-pressed', 'false');
    await expect(section.getByRole('group', { name: 'Capture aspect ratio' }).getByRole('button', { name: '4:5' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    const reloaded = page.getByRole('region', { name: 'Filter Mask' });
    const persistedPreset = reloaded.getByRole('button', { name: 'Creator Warm' });
    await expect(persistedPreset).toBeVisible();

    await reloaded.getByRole('button', { name: 'Delete preset Creator Warm' }).click();
    await expect(reloaded.getByRole('button', { name: 'Creator Warm' })).toHaveCount(0);
  });



});
