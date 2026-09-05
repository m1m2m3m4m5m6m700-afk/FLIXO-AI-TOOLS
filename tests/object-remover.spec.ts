import { expect, test } from '@playwright/test';
import { assertDownload, assertImageResult, uploadFixture } from './helpers/image-tool-fixture';

test('object-remover: produces a valid reconstructed PNG', async ({ page }) => {
  await page.goto('/en/object-remover');
  await expect(page.getByRole('heading', { level: 1, name: 'Object Remover' })).toBeVisible();
  await uploadFixture(page);
  await page.getByRole('textbox', { name: 'X', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Y', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'Width', exact: true }).fill('2');
  await page.getByRole('textbox', { name: 'Height', exact: true }).fill('2');
  await page.getByRole('button', { name: 'Run tool' }).click();
  const result = await assertImageResult(page);
  expect(result.type).toBe('image/png');
  await assertDownload(page, /\.png$/);
});
