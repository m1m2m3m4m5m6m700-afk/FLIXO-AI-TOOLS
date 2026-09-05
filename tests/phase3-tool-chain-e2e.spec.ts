import { expect, test } from '@playwright/test';

const ONE_BY_ONE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test.describe('Phase 3 local tool chaining', () => {
  test('executes a stored image pipeline and exposes the local result', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'flixo:tool-chain:v1',
        JSON.stringify([
          { id: 'image-converter', order: 0 },
          { id: 'image-upscaler', order: 1 },
        ]),
      );
    });

    await page.goto('/en/image-converter');
    const panel = page.getByRole('complementary', { name: 'Tool chaining workspace' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Open' }).click();

    await expect(panel.getByText('2/8 steps')).toBeVisible();
    await panel.locator('input[type=file]').setInputFiles({
      name: 'fixture.png',
      mimeType: 'image/png',
      buffer: Buffer.from(ONE_BY_ONE_PNG, 'base64'),
    });

    await panel.getByRole('button', { name: 'Run chain locally' }).click();
    await expect(panel.getByText(/Current step:/)).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText(/Output ready:/)).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByRole('link', { name: 'Download result' })).toHaveAttribute('download', /-2x\.png$/);
  });
});
