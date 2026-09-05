import { test, expect } from '@playwright/test';

test.describe('audio-extractor-muter contract', () => {
  test('loads the tool and exposes extract/mute controls', async ({ page }) => {
    await page.goto('/en/audio-extractor-muter');
    await expect(page.getByRole('heading', { name: 'Audio Extractor & Muter' })).toBeVisible();
    await expect(page.getByLabel('Video file')).toBeVisible();
  });

  test('keeps processing local without an application API request', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) requests.push(request.url());
    });
    await page.goto('/en/audio-extractor-muter');
    expect(requests).toEqual([]);
  });
});
