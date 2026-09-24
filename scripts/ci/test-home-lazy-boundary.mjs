import { existsSync, readFileSync } from 'node:fs';

const locales = ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi'];
const fail = (message) => {
  console.error(`HOME_LAZY_BOUNDARY_FAILED: ${message}`);
  process.exit(1);
};

const facade = readFileSync('src/data/home-locales.ts', 'utf8');
if (facade.includes('HOME_I18N')) fail('home-locales.ts still exposes a monolithic HOME_I18N catalog');
if (/from ['"][^'"]*home-locales\/(?:ar|en|es|fr|de|hi|id|it|ja|ko|ms|nl|pl|pt|ru|sv|th|tr|uk|vi)['"]/u.test(facade)) {
  fail('home-locales.ts statically imports a locale module');
}

const loader = readFileSync('src/lib/i18n/home-loader.ts', 'utf8');
for (const locale of locales) {
  if (!loader.includes(`import('../../data/home-locales/${locale}')`)) fail(`missing dynamic loader for ${locale}`);
  if (!existsSync(`src/data/home-locales/${locale}.ts`)) fail(`missing locale module ${locale}`);
}

const homePage = readFileSync('src/routes/home-page.tsx', 'utf8');
if (!homePage.includes('loadHomeCopy(locale)')) fail('HomePage does not use loadHomeCopy(locale)');
if (/import\s+\{[^}]*getHomeCopy[^}]*\}\s+from[^;]*home-locales/u.test(homePage)) fail('HomePage synchronously imports getHomeCopy');

const legacyHome = readFileSync('src/components/AgentFirstHome.tsx', 'utf8');
if (!legacyHome.includes('loadHomeCopy(locale)')) fail('AgentFirstHome does not use loadHomeCopy(locale)');
if (/getHomeCopy\(/u.test(legacyHome)) fail('AgentFirstHome still calls synchronous getHomeCopy');

console.log(`HOME_LAZY_BOUNDARY_PASS: ${locales.length} locale modules, lazy loader, HomePage and AgentFirstHome boundaries verified.`);
