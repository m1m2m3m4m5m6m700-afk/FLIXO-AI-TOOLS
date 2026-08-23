import { test, expect } from '@playwright/test';

test.describe('Video Compressor & Converter contract', () => {
  test('loads with bounded local processing controls', async ({ page }) => {
    await page.goto('/en/video-compressor-converter');
    await expect(page.getByRole('heading', { name: /video compressor/i })).toBeVisible();
    await expect(page.getByLabel('Video file')).toBeVisible();
    await expect(page.getByLabel('Output format')).toHaveValue('mp4');
    await expect(page.getByLabel('Quality')).toHaveValue('balanced');
  });

  test('rejects non-video input locally', async ({ page }) => {
    await page.goto('/en/video-compressor-converter');
    await page.getByLabel('Video file').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not a video') });
    await expect(page.getByRole('alert')).toContainText(/video file/i);
  });

  test('does not upload selected media to an application endpoint on load', async ({ page }) => {
    const applicationRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) applicationRequests.push(request.url());
    });
    await page.goto('/en/video-compressor-converter');
    expect(applicationRequests).toHaveLength(0);
  });
});
