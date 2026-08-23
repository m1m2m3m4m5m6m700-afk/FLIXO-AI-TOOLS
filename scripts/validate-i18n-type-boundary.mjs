import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const types = await readFile(resolve(root, 'src/lib/i18n/types.ts'), 'utf8');
const facade = await readFile(resolve(root, 'src/lib/i18n/translations.ts'), 'utf8');

const failures = [];
if (!/export\s+type\s+TranslationBundle\s*=/.test(types)) failures.push('TranslationBundle must be defined in src/lib/i18n/types.ts');
if (/export\s+type\s+TranslationBundle\s*=/.test(facade)) failures.push('translations.ts must not define TranslationBundle');
if (!/export\s+type\s*\{\s*TranslationBundle\s*\}\s+from\s+'\.\/types'/.test(facade)) failures.push('translations.ts must re-export TranslationBundle as a type-only contract');
if (/from\s+'\.\/locales\//.test(facade)) failures.push('translations.ts must not statically import locale dictionaries');

if (failures.length) {
  console.error('FLIXO i18n type boundary: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('FLIXO i18n type boundary: PASS');
