import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SOURCE = 'src/data/home-locales.ts';
const OUT_DIR = 'src/data/home-locales';

function scanBalanced(source, start, open = '{', close = '}') {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced ${open}${close} block at ${start}`);
}

function extractLocales(source) {
  const marker = 'export const HOME_I18N';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('HOME_I18N marker not found.');

  const objectStart = source.indexOf('{', markerIndex);
  const objectEnd = scanBalanced(source, objectStart);
  const body = source.slice(objectStart + 1, objectEnd);
  const locales = new Map();

  let i = 0;
  while (i < body.length) {
    const match = body.slice(i).match(/(?:^|\n)\s{2}([a-z]{2}):\s*copy\(\{/);
    if (!match || match.index == null) break;
    const locale = match[1];
    const relStart = i + match.index;
    const copyOpen = body.indexOf('{', relStart + match[0].lastIndexOf('{'));
    const copyEnd = scanBalanced(body, copyOpen);
    const entry = body.slice(relStart, copyEnd + 2).trim().replace(/,$/, '');
    locales.set(locale, entry);
    i = copyEnd + 1;
  }

  if (locales.size === 0) throw new Error('No locale entries found.');
  return locales;
}

const source = await readFile(SOURCE, 'utf8');
const locales = extractLocales(source);
await mkdir(OUT_DIR, { recursive: true });

for (const [locale, entry] of locales) {
  const content = `import type { HomeCopy } from '../home-copy';\n\nconst copy = (v: Omit<HomeCopy, 'language' | 'dir'> & { language: string; dir: 'ltr' | 'rtl' }): HomeCopy => v;\n\nexport default ${entry};\n`;
  await writeFile(`${OUT_DIR}/${locale}.ts`, content, 'utf8');
}

console.log(`Extracted ${locales.size} Home locale modules into ${OUT_DIR}.`);
