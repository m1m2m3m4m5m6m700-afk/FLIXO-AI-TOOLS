import { test, expect } from '@playwright/test';
test.describe('Audio Format Converter contract', () => {
  test('loads format and quality controls', async ({ page }) => {
    await page.goto('/en/audio-format-converter');
    await expect(page.getByRole('heading', { name: /audio format converter/i })).toBeVisible();
    await expect(page.getByLabel('Audio file')).toBeVisible();
    await expect(page.getByLabel('Output format')).toHaveValue('mp3');
    await expect(page.getByLabel('Quality')).toHaveValue('balanced');
  });
  test('rejects non-audio input locally', async ({ page }) => {
    await page.goto('/en/audio-format-converter');
    await page.getByLabel('Audio file').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('not audio') });
    await expect(page.getByRole('alert')).toContainText(/audio file/i);
  });
  test('keeps conversion client-side', async ({ page }) => {
    let external = 0;
    page.on('request', request => { if (request.url().startsWith('http') && !request.url().includes('localhost')) external += 1; });
    await page.goto('/en/audio-format-converter');
    expect(external).toBe(0);
  });
});
