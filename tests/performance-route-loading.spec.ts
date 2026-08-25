import { expect, test } from '@playwright/test';

test('keeps lazy tool modules out of the initial home route', async ({ page }) => {
  const toolRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/src/tools/')) toolRequests.push(request.url());
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  expect(toolRequests, 'home route must not eagerly request tool modules').toEqual([]);

  await page.goto('/en/image-compressor');
  await page.waitForLoadState('domcontentloaded');

  await expect.poll(() => toolRequests.length).toBeGreaterThan(0);
});
