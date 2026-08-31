import { expect, type Locator, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type UploadFixture = {
  name: string;
  mimeType: string;
  content: string | Buffer;
};

export async function uploadFixture(
  page: Page,
  input: Locator,
  testInfo: { outputPath: (relativePath: string) => string },
  fixtures: UploadFixture[],
): Promise<void> {
  void page;
  const filePaths = await Promise.all(fixtures.map(async (fixture) => {
    const filePath = testInfo.outputPath(path.join('g3-fixtures', fixture.name));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, fixture.content);
    return filePath;
  }));

  await expect(input).toHaveCount(1);
  await expect(input).toBeAttached();
  const handle = await input.elementHandle();
  if (!handle) throw new Error('G3-61 INPUT_DISCOVERY failed: #image-file handle unavailable');
  await handle.setInputFiles(filePaths);
  await expect.poll(async () => input.evaluate((element) => element.files?.length ?? 0)).toBe(fixtures.length);
}
