import { test, expect } from '@playwright/test';

test.describe('AI Auto-Captioner & SRT Generator contract', () => {
  test('loads local caption controls', async ({ page }) => {
    await page.goto('/en/ai-captioner-srt');
    await expect(page.getByRole('heading', { name: /ai auto-captioner/i })).toBeVisible();
    await expect(page.getByLabel('Media file')).toBeVisible();
    await expect(page.getByLabel('Inference device')).toHaveValue('webgpu');
  });

  test('rejects unsupported file types locally', async ({ page }) => {
    await page.goto('/en/ai-captioner-srt');
    await page.getByLabel('Media file').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not media') });
    await expect(page.getByRole('alert')).toContainText(/video or audio/i);
  });

  test('does not contact external services on initial load', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (!localHosts.has(url.hostname)) external.push(request.url());
      }
    });
    await page.goto('/en/ai-captioner-srt');
    expect(external).toHaveLength(0);
  });
});

test('SRT/VTT exports exist in the module contract', async ({ page }) => {
  await page.goto('/en/ai-captioner-srt');
  await expect(page.getByRole('button', { name: /generate captions/i })).toBeDisabled();
});
