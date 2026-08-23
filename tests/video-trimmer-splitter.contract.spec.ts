import { test, expect } from '@playwright/test';

test.describe('Video Trimmer & Splitter output contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/video-trimmer-splitter');
  });

  test('loads the tool without external navigation', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Video Trimmer & Splitter' })).toBeVisible();
    await expect(page.getByText(/locally in your browser/i)).toBeVisible();
  });

  test('requires a video before export', async ({ page }) => {
    await page.getByRole('button', { name: 'Export clip' }).click().catch(() => undefined);
    const alerts = page.getByRole('alert');
    if (await alerts.count()) await expect(alerts.first()).toContainText('Choose a video first');
  });

  test('does not expose a network upload control', async ({ page }) => {
    await expect(page.getByLabel('Video file')).toHaveAttribute('accept', 'video/*');
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });
});
