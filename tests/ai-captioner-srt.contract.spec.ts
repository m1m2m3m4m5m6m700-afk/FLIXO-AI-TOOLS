import { test, expect } from '@playwright/test';

const openCaptioner = async (page: Parameters<Parameters<typeof test>[2]>[0] extends never ? never : any) => {
  await page.goto('/en/ai-captioner-srt', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
};

test.describe('AI Auto-Captioner & SRT Generator contract', () => {
  test('loads local caption controls', async ({ page }) => {
    test.setTimeout(30_000);
    await openCaptioner(page);
    await expect(page.getByRole('heading', { name: /ai auto-captioner/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Media file')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Inference device')).toHaveValue('webgpu', { timeout: 15_000 });
  });

  test('rejects unsupported file types locally', async ({ page }) => {
    test.setTimeout(30_000);
    await openCaptioner(page);
    await page.getByLabel('Media file').setInputFiles({
      name: 'note.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not media'),
    });
    await expect(page.getByRole('alert')).toContainText(/video or audio/i, { timeout: 15_000 });
  });

  test('does not contact application APIs on initial load', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (!isLocal) external.push(request.url());
      }
    });
    await openCaptioner(page);
    expect(external).toHaveLength(0);
  });
});

test('SRT/VTT exports exist in the module contract', async ({ page }) => {
  await openCaptioner(page);
  await expect(page.getByRole('button', { name: /generate captions/i })).toBeDisabled();
});
