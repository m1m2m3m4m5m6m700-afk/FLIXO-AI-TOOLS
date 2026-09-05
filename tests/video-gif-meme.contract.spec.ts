import { test, expect } from '@playwright/test';

test.describe('Video to GIF & Meme Maker contract', () => {
  test('loads the tool and exposes bounded GIF controls', async ({ page }) => {
    await page.goto('/en/video-gif-meme');
    await expect(page.getByRole('heading', { name: /video to gif/i })).toBeVisible();
    await expect(page.getByLabel('Video file')).toBeVisible();
    await expect(page.getByLabel('FPS')).toHaveValue('8');
    await expect(page.getByLabel('Width')).toHaveValue('480');
  });

  test('rejects non-video input locally', async ({ page }) => {
    await page.goto('/en/video-gif-meme');
    await page.getByLabel('Video file').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not a video'),
    });
    await expect(page.getByRole('alert')).toContainText(/video file/i);
  });

  test('keeps all GIF processing client-side', async ({ page }) => {
    let externalRequests = 0;
    page.on('request', request => {
      const url = new URL(request.url());
      const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
      if ((url.protocol === 'http:' || url.protocol === 'https:') && !isLocal) externalRequests += 1;
    });
    await page.goto('/en/video-gif-meme');
    expect(externalRequests).toBe(0);
  });
});
