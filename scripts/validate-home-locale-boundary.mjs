import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const homePage = fs.readFileSync(path.join(root, 'src/routes/home-page.tsx'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'src/data/home-locales.ts'), 'utf8');
const translations = fs.readFileSync(path.join(root, 'src/lib/i18n/translations.ts'), 'utf8');

if (homePage.includes("../data/home-locales") || homePage.includes("@/data/home-locales")) {
  throw new Error('HomePage must not statically import home-locales.ts; use the lazy home loader.');
}

if (!loader.includes('HOME_I18N')) {
  throw new Error('home-locales.ts must remain the canonical HOME_I18N source during locale extraction.');
}

const staticLocaleImport = /(?:import|export)\s+(?:[^'";]+?from\s+)?['"].*\/locales\/[^'"]+['"]/;
if (staticLocaleImport.test(translations)) {
  throw new Error('translations.ts must not statically import locale modules.');
}

console.log('Home locale boundary contract OK.');
