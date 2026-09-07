import { mkdir, writeFile } from 'node:fs/promises';
import { HOME_I18N } from '../src/data/home-locales.ts';
import { HOME_COPY_OVERRIDES } from '../src/lib/i18n/locale-quality-overrides.ts';

const outputDir = new URL('../src/data/home-locales/', import.meta.url);
await mkdir(outputDir, { recursive: true });

for (const [locale, baseCopy] of Object.entries(HOME_I18N)) {
  const copy = { ...baseCopy, ...(HOME_COPY_OVERRIDES[locale] ?? {}) };
  const content = `import type { HomeCopy } from './types';\n\nexport const homeCopy: HomeCopy = ${JSON.stringify(copy, null, 2)};\n`;
  await writeFile(new URL(`${locale}.ts`, outputDir), content, 'utf8');
}

console.log(`Generated ${Object.keys(HOME_I18N).length} Home locale modules from effective locale data.`);
