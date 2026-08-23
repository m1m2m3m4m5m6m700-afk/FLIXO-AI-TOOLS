import { test, expect } from '@playwright/test';

test.describe('Audio Cutter & Trimmer contract', () => {
  test('loads the tool and exposes precise range controls', async ({ page }) => {
    await page.goto('/en/audio-cutter-trimmer');
    await expect(page.getByRole('heading', { name: /audio cutter/i })).toBeVisible();
    await expect(page.getByLabel('Audio file')).toBeVisible();
    await expect(page.getByLabel('Start time')).toBeVisible();
    await expect(page.getByLabel('End time')).toBeVisible();
    await expect(page.getByLabel('Audio waveform')).toBeVisible();
  });

  test('rejects non-audio input locally', async ({ page }) => {
    await page.goto('/en/audio-cutter-trimmer');
    await page.getByLabel('Audio file').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not audio'),
    });
    await expect(page.getByRole('alert')).toContainText(/audio file/i);
  });

  test('keeps audio processing client-side', async ({ page }) => {
    let externalRequests = 0;
    page.on('request', (request) => {
      if (request.url().startsWith('http') && !request.url().includes('localhost')) externalRequests += 1;
    });
    await page.goto('/en/audio-cutter-trimmer');
    expect(externalRequests).toBe(0);
  });
});
