import { access } from 'node:fs/promises';
import { CANONICAL_LOCALES } from './validation-utils.mjs';

const OUT_DIR = new URL('../src/data/home-locales/', import.meta.url);

for (const locale of CANONICAL_LOCALES) {
  await access(new URL(`${locale}.ts`, OUT_DIR));
}

console.log(`Home locale catalog is already split into ${CANONICAL_LOCALES.length} locale modules; no monolith extraction is required.`);
