import { expect, test } from '@playwright/test';

const sourceSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#223344"/><circle cx="300" cy="220" r="180" fill="#67e8f9"/></svg>`;
const corruptPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);

async function openTool(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  const diagnostics: string[] = [];
  page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.push(`console:${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!/favicon|analytics|vercel-insights/iu.test(url)) {
      diagnostics.push(`requestfailed:${url}:${request.failure()?.errorText ?? 'unknown'}`);
    }
  });
  await page.goto('/en/image-compressor', { waitUntil: 'domcontentloaded', timeout: 30000 });
  return diagnostics;
}

test.describe('G5 Universal Runtime / E2E / Performance', () => {
  test('tool execution produces a downloadable artifact with no runtime errors', async ({ page }) => {
    const diagnostics = await openTool(page);
    await expect(page.getByRole('heading', { name: 'Compress Images Online' })).toBeVisible();

    await page.locator('#image-file').setInputFiles({
      name: 'source.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(sourceSvg),
    });
    await page.getByRole('button', { name: 'Compress image' }).click();

    const download = page.getByRole('link', { name: 'Download image' });
    await expect(download).toHaveAttribute('download', 'flixo-compressed.webp', { timeout: 15000 });
    const href = await download.getAttribute('href');
    expect(href).toMatch(/^blob:/);
    const size = await page.evaluate(async (objectUrl) => (await (await fetch(objectUrl)).blob()).size, href);
    expect(size).toBeGreaterThan(0);
    expect(diagnostics).toEqual([]);
  });

  test('corrupted input is rejected before processing', async ({ page }) => {
    await openTool(page);
    await page.locator('#image-file').setInputFiles({
      name: 'corrupt.png',
      mimeType: 'image/png',
      buffer: corruptPng,
    });
    await expect(page.getByRole('alert')).toContainText('Some files were skipped');
    await expect(page.getByRole('button', { name: 'Compress image' })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Download image' })).toHaveCount(0);
  });

  for (const width of [375, 768, 1440]) {
    test(`responsive layout has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openTool(page);
      const metrics = await page.evaluate(() => ({
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(metrics.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(metrics.viewport + 1);
    });
  }

  test('accessibility smoke has a valid document structure and named controls', async ({ page }) => {
    await openTool(page);
    await expect(page.locator('main').first()).toBeVisible();
    expect(await page.locator('h1').count()).toBeGreaterThanOrEqual(1);

    const unnamedControls = await page.locator('button, input, select, textarea').evaluateAll((nodes) => nodes.filter((node) => {
      if (node.getAttribute('aria-hidden') === 'true') return false;
      const aria = (node.getAttribute('aria-label') ?? '').trim();
      const labelledBy = (node.getAttribute('aria-labelledby') ?? '').trim();
      const text = (node.textContent ?? '').trim();
      const placeholder = (node.getAttribute('placeholder') ?? '').trim();
      const id = node.getAttribute('id');
      const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent?.trim() : '';
      return !(aria || labelledBy || text || placeholder || label);
    }).length);
    expect(unnamedControls).toBe(0);
    expect(await page.locator('img:not([alt])').count()).toBe(0);
  });

  test('RTL and LTR direction contracts hold for localized runtime', async ({ page }) => {
    for (const [locale, direction] of [['en', 'ltr'], ['ar', 'rtl'], ['ur', 'rtl']] as const) {
      await page.goto(`/${locale}/image-compressor`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await expect(page.locator('html')).toHaveAttribute('lang', locale === 'ur' ? 'ur' : locale);
      await expect(page.locator('html')).toHaveAttribute('dir', direction);
    }
  });

  test('performance smoke stays within a safe CI navigation budget', async ({ page }) => {
    await openTool(page);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const longTasks = performance.getEntriesByType('longtask');
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
        loadEventEnd: navigation?.loadEventEnd ?? 0,
        longTaskCount: longTasks.length,
        maxLongTask: Math.max(0, ...longTasks.map((entry) => entry.duration)),
      };
    });
    expect(metrics.domContentLoaded).toBeGreaterThan(0);
    expect(metrics.domContentLoaded).toBeLessThanOrEqual(5000);
    expect(metrics.loadEventEnd).toBeGreaterThan(0);
    expect(metrics.loadEventEnd).toBeLessThanOrEqual(8000);
    expect(metrics.maxLongTask).toBeLessThanOrEqual(2000);
  });

  test('worker behavior is error-free when runtime workers are present', async ({ page }) => {
    const workerErrors: string[] = [];
    page.on('worker', (worker) => {
      worker.on('console', (message) => {
        if (message.type() === 'error') workerErrors.push(`${worker.url()}: ${message.text()}`);
      });
    });
    await openTool(page);
    for (const worker of page.workers()) {
      await expect.poll(async () => worker.url()).toMatch(/^https?:\/\//);
      await worker.evaluate(() => true);
    }
    expect(workerErrors).toEqual([]);
  });
});
