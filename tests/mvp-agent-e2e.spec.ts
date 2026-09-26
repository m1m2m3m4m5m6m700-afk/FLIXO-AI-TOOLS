import { expect, test } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

test.describe('FLIXO MVP agent full journey', () => {
  test('upload → natural request → plan → execute → verify → result → save', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto('/');

    const studio = page.getByTestId('flixo-agent-studio');
    await expect(studio).toBeVisible();

    await page.locator('#flixo-agent-file').setInputFiles({
      name: 'mvp-agent-fixture.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    await page.locator('#flixo-agent-command').fill('compress this image under 200KB and convert to WebP');
    await page.getByRole('button', { name: 'Analyze plan' }).click();

    await expect(page.getByTestId('flixo-agent-plan-ready')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-plan-ready')).toContainText('2 steps');

    await page.locator('#flixo-agent-command').fill('execute');
    await page.locator('.flixo-agent-send').click();

    await expect(page.locator('.flixo-agent-success-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.flixo-agent-inline-progress')).toContainText('image-compressor');

    await expect(page.getByTestId('flixo-agent-result-preview')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-result-preview')).toHaveAttribute('src', /^blob:/);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download result' }).click();
    const download = await downloadPromise;

    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe('flixo-agent-result.webp');
  });
});


test.describe('FLIXO agent-first navigation', () => {
  test('browse tools → shared tool page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Browse tools' })).toBeVisible();
    await page.getByRole('link', { name: 'Browse tools' }).click();

    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
    await page.getByRole('link', { name: 'Image Compressor' }).click();

    await expect(page).toHaveURL(/\/en\/image-compressor$/);
    await expect(page.getByRole('heading', { name: 'Image Compressor' })).toBeVisible();
    await expect(page.locator('.tool-page-modern__workspace')).toBeVisible();
  });
});
