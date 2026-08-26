import { expect, test } from '@playwright/test';
import { PNG } from './helpers/image-tool-fixture';

test('ai-image-generator: consumes an image endpoint response and downloads it', async ({ page }) => {
  let generationRequestHandled = false;
  await page.route('**', async (route) => {
    const request = route.request();
    if (!generationRequestHandled && request.method() === 'POST') {
      generationRequestHandled = true;
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      return;
    }
    await route.continue();
  });

  await page.goto('/en/ai-image-generator');
  await expect(page.getByRole('heading', { level: 1, name: 'AI Image Generator' })).toBeVisible();
  await page.getByPlaceholder('A cinematic sunset over Cairo...').fill('FLIXO test image');
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByText('RESULT', { exact: true })).toBeVisible();
  const image = page.locator('img[alt="Tool result"]');
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 4);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download now' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.(png|webp|jpg)$/);
});

test('ai-image-generator: blocks empty prompts', async ({ page }) => {
  await page.goto('/en/ai-image-generator');
  await page.getByRole('button', { name: 'Generate image' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a prompt first.');
});
