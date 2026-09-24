import { expect, test } from './fixtures/universal-runtime-evidence';
import { PNG } from './helpers/image-tool-fixture';

test.describe('FLIXO MVP agent full journey', () => {
  test('upload → natural request → plan → execute → verify → result → save', async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as Window & {
        __flixoSavedResult?: { type: string; size: number };
      };
      state.__flixoSavedResult = undefined;
      state.showSaveFilePicker = async () => ({
        createWritable: async () => ({
          write: async (data: Blob) => {
            state.__flixoSavedResult = { type: data.type, size: data.size };
          },
          close: async () => {},
        }),
      });
    });

    await page.goto('/');

    const launch = page.locator('.flixo-ai-agent .home-hero-command');
    await expect(launch).toBeVisible();
    await launch.click();

    const studio = page.getByTestId('flixo-agent-studio');
    await expect(studio).toBeVisible();

    await page.locator('#flixo-agent-file').setInputFiles({
      name: 'mvp-agent-fixture.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    await page.locator('#flixo-agent-command').fill('compress this image under 200KB and convert to WebP');
    await page.getByRole('button', { name: 'Analyze plan' }).click();

    await expect(page.getByTestId('flixo-agent-plan-ready')).toBeVisible();
    await expect(page.getByTestId('flixo-agent-plan-ready')).toContainText('2 steps');

    await page.locator('#flixo-agent-command').fill('execute');
    await page.locator('.flixo-agent-send').click();

    await expect(page.locator('.flixo-agent-success-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.flixo-agent-inline-progress')).toContainText('image-compressor');

    await page.getByRole('button', { name: 'Download result' }).click();

    const saved = await page.evaluate(() => (window as Window & {
      __flixoSavedResult?: { type: string; size: number };
    }).__flixoSavedResult);

    expect(saved).not.toBeUndefined();
    expect(saved?.type).toBe('image/webp');
    expect(saved?.size ?? 0).toBeGreaterThan(0);
  });
});
