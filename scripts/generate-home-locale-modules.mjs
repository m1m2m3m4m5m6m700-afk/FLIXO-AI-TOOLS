import { mkdir, writeFile } from 'node:fs/promises';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const outputDir = new URL('../src/data/home-locales/', import.meta.url);
await mkdir(outputDir, { recursive: true });

for (const locale of CANONICAL_LOCALES) {
  const module = await import(new URL(`../src/data/home-locales/${locale}.ts`, import.meta.url));
  if (!module.homeCopy) throw new Error(`Missing homeCopy export for locale ${locale}`);
  const content = `import type { HomeCopy } from './types';\n\nexport const homeCopy: HomeCopy = ${JSON.stringify(module.homeCopy, null, 2)};\n`;
  await writeFile(new URL(`${locale}.ts`, outputDir), content, 'utf8');
}

console.log(`Generated ${CANONICAL_LOCALES.length} Home locale modules from the split catalog.`);
