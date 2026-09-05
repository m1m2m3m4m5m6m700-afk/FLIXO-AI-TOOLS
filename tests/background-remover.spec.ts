import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('background-remover: produces a valid PNG and downloads it', async ({ page }) => {
  await page.goto('/en/background-remover');
  await expect(page.getByRole('heading', { level: 1, name: 'Background Remover' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('textbox', { name: 'Background tolerance', exact: true }).fill('25');
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  await assertDownload(page, /\.png$/);
});
