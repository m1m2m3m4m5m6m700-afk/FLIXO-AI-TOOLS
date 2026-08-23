import { test, expect } from '@playwright/test';

test.describe('Audio Compressor contract', () => {
  test('loads the compressor controls', async ({ page }) => {
    await page.goto('/en/audio-compressor');
    await expect(page.getByRole('heading', { name: /audio compressor/i })).toBeVisible();
    await expect(page.getByLabel('Audio file')).toBeVisible();
    await expect(page.getByLabel('Compression quality')).toHaveValue('balanced');
  });

  test('rejects non-audio input locally', async ({ page }) => {
    await page.goto('/en/audio-compressor');
    await page.getByLabel('Audio file').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') });
    await expect(page.getByRole('alert')).toContainText(/audio file/i);
  });

  test('keeps the initial tool load free of conversion requests', async ({ page }) => {
    const externalRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith('http') && !request.url().includes('localhost')) externalRequests.push(request.url());
    });
    await page.goto('/en/audio-compressor');
    await expect(page.getByRole('heading', { name: /audio compressor/i })).toBeVisible();
    expect(externalRequests.filter((url) => /ffmpeg|onnx|demucs/i.test(url))).toHaveLength(0);
  });
});
