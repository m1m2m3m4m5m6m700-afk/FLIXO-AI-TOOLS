import { mkdir, writeFile } from 'node:fs/promises';
import { HOME_I18N } from '../src/data/home-locales.ts';

const outputDir = new URL('../src/data/home-locales/', import.meta.url);
await mkdir(outputDir, { recursive: true });

for (const [locale, copy] of Object.entries(HOME_I18N)) {
  const content = `import type { HomeCopy } from './types';\n\nexport const homeCopy: HomeCopy = ${JSON.stringify(copy, null, 2)};\n`;
  await writeFile(new URL(`${locale}.ts`, outputDir), content, 'utf8');
}

console.log(`Generated ${Object.keys(HOME_I18N).length} Home locale modules.`);
