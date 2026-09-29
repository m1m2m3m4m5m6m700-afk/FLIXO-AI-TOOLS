import { expect, test } from '../fixtures/universal-runtime-evidence';
import { PNG } from '../helpers/image-tool-fixture';

test.describe('FLIXO MVP user workflow certification', () => {
  test('upload → natural language plan → local execution → verified WebP result', async ({ page }) => {
    let conversationalApiCalls = 0;
    await page.route('**/api/flixo-agent', async (route) => {
      conversationalApiCalls += 1;
      await route.abort();
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto('/');
    await expect(page.getByTestId('flixo-agent-studio')).toBeVisible();

    await page.locator('#flixo-agent-file').setInputFiles({
      name: 'mvp-certification-fixture.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page.locator('#flixo-agent-command').fill(
      'compress this image under 200KB and convert to WebP',
    );
    await page.getByRole('button', { name: 'Analyze plan' }).click();

    await expect(page.getByTestId('flixo-agent-plan-ready')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-plan-ready').locator('span').first())
      .toHaveText(/^\s*2\b/u);

    await page.locator('#flixo-agent-command').fill('execute');
    await page.locator('.flixo-agent-send').click();

    await expect(page.locator('.flixo-agent-success-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.flixo-agent-inline-progress')).toContainText('image-compressor');
    await expect(page.getByTestId('flixo-agent-result-preview')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-result-preview')).toHaveAttribute('src', /^blob:/u);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download result' }).click();
    const download = await downloadPromise;

    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toBe('flixo-agent-result.webp');
    expect(conversationalApiCalls).toBe(0);
  });

  test('unsupported Agent intent fails closed to the matching manual tool', async ({ page }) => {
    let conversationalApiCalls = 0;
    await page.route('**/api/flixo-agent', async (route) => {
      conversationalApiCalls += 1;
      await route.abort();
    });

    await page.goto('/');
    await page.locator('#flixo-agent-command').fill('remove the object from this image');
    await page.locator('.flixo-agent-send').click();

    await expect(page.getByTestId('flixo-agent-manual-fallback')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-manual-fallback-link'))
      .toHaveAttribute('href', '/en/object-remover');
    expect(conversationalApiCalls).toBe(0);
  });

  test('Arabic mobile Agent journey preserves RTL and verified local output', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showSaveFilePicker', {
        configurable: true,
        value: undefined,
      });
    });

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('flixo-agent-studio')).toBeVisible();

    await page.locator('#flixo-agent-file').setInputFiles({
      name: 'mvp-certification-ar.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page.locator('#flixo-agent-command').fill(
      'compress this image under 200KB and convert to WebP',
    );
    await page.locator('button.flixo-agent-ghost').click();

    await expect(page.getByTestId('flixo-agent-plan-ready')).toBeVisible();
    await page.locator('#flixo-agent-command').fill('execute');
    await page.locator('.flixo-agent-send').click();

    await expect(page.locator('.flixo-agent-success-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('flixo-agent-result-preview')).toHaveAttribute('src', /^blob:/u);
  });
});
