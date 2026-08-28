import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const errors = [];
const warnings = [];
const adsConfigured = Boolean(process.env.VITE_ADSENSE_PUBLISHER_ID?.trim());

const pass = (message) => console.log(`ADSENSE PASS: ${message}`);
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const read = (file) => readFileSync(join(root, file), 'utf8');

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const sourceFiles = trackedFiles.filter((file) => /\.(?:ts|tsx|mjs|html|css)$/u.test(file));
const adsImplementationFiles = new Set([
  'src/adsense/AdSlot.tsx',
  'src/adsense/policy.ts',
]);
const validatorFile = 'scripts/validate-adsense-readiness.mjs';
const rawAdPattern = /adsbygoogle|pagead\.googlesyndication\.com|googlesyndication\.com\/adsbygoogle/iu;

for (const file of sourceFiles) {
  if (adsImplementationFiles.has(file) || file === validatorFile) continue;
  if (rawAdPattern.test(read(file))) {
    fail(`AdSense implementation leaked outside the central boundary: ${file}`);
  }
}
if (!errors.length) pass('AdSense code is centralized behind src/adsense');

const policy = read('src/adsense/policy.ts');
for (const required of [
  'minInteractiveGapPx: 25',
  'reservedMinHeightPx: 100',
  "'error'",
  "'empty'",
  "'modal'",
  "'loader'",
  "'internal'",
  'hasTcfConsent',
  '755',
]) {
  if (!policy.includes(required)) fail(`central AdSense policy missing required safeguard: ${required}`);
}
if (!errors.length) pass('fail-closed placement, spacing, reservation, and TCF safeguards are present');

const labelCount = (policy.match(/^[ ]{2}[a-z]{2}: /gmu) ?? []).length;
if (labelCount !== 20) fail(`Advertisement label registry must contain exactly 20 locale entries; found ${labelCount}`);
else pass('localized Advertisement labels cover all 20 canonical locales');

// Parse only string literals assigned to the SEO fields. This validator intentionally
// treats content quality as a monetization gate, not as a blocker while ads are OFF.
const seoFiles = sourceFiles.filter(
  (file) => file.startsWith('src/tools/') && /\/seo\/[a-z]{2}\.ts$/u.test(file),
);
const introByLocale = new Map();
const tokenize = (value) =>
  value
    .replace(/<[^>]*>/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean);

let auditedSeo = 0;
let substantiveSeoFailures = 0;

for (const file of seoFiles) {
  const source = read(file);
  const requiredFields = ['title:', 'description:', 'intro:', 'keywords:', 'howTo:', 'features:', 'altText:'];
  for (const field of requiredFields) {
    if (!source.includes(field)) fail(`${file}: missing ${field}`);
  }

  const intro = source.match(/intro:\s*'((?:\\'|[^'])*)'/u)?.[1]
    ?? source.match(/intro:\s*"((?:\\"|[^"])*)"/u)?.[1]
    ?? '';
  const description = source.match(/description:\s*'((?:\\'|[^'])*)'/u)?.[1]
    ?? source.match(/description:\s*"((?:\\"|[^"])*)"/u)?.[1]
    ?? '';
  const howTo = source.match(/howTo:\s*\[([^\]]*)\]/u)?.[1] ?? '';
  const features = source.match(/features:\s*\[([^\]]*)\]/u)?.[1] ?? '';

  const failures = [];
  if (tokenize(intro).length < 40) failures.push('intro <40 words');
  if (tokenize(description).length < 8) failures.push('description <8 words');
  if ((howTo.match(/['"]/gu) ?? []).length < 6) failures.push('howTo <3 steps');
  if ((features.match(/['"]/gu) ?? []).length < 6) failures.push('features <3 items');

  const locale = file.match(/\/seo\/([a-z]{2})\.ts$/u)?.[1] ?? 'unknown';
  const duplicateKey = `${locale}:${intro.trim().toLocaleLowerCase()}`;
  if (intro.trim().length >= 100) {
    if (introByLocale.has(duplicateKey)) {
      fail(`${file}: exact duplicate route intro detected for locale ${locale}; source=${introByLocale.get(duplicateKey)}`);
    } else {
      introByLocale.set(duplicateKey, file);
    }
  }

  if (failures.length) {
    substantiveSeoFailures += failures.length;
    const message = `${file}: ${failures.join(', ')}`;
    if (adsConfigured) fail(message);
    else warn(`monetization-readiness: ${message}`);
  }
  auditedSeo += 1;
}

if (!errors.length || (errors.length === 0 && auditedSeo > 0)) {
  pass(`audited ${auditedSeo} localized tool SEO files for substantive fields and duplicate intros`);
}
if (!adsConfigured && substantiveSeoFailures > 0) {
  warn(`AdSense remains OFF; ${substantiveSeoFailures} content-quality observations are deferred to the monetization gate`);
}

const legalPaths = ['/privacy', '/terms', '/cookies'];
const routerText = sourceFiles.filter((file) => file.startsWith('src/routes/')).map(read).join('\n');
const missingLegal = legalPaths.filter((path) => !routerText.includes(path));
if (adsConfigured && missingLegal.length) {
  fail(`AdSense is configured but required legal routes are not wired: ${missingLegal.join(', ')}`);
} else if (missingLegal.length) {
  warn(`Legal routes not yet detected (${missingLegal.join(', ')}); AdSense remains fail-closed until legal + consent wiring is present`);
} else {
  pass('privacy/terms/cookie routes are present in the route graph');
}

for (const required of ['lcpMs: 2500', 'inpMs: 200', 'cls: 0.1']) {
  if (!policy.includes(required)) fail(`Core Web Vitals target missing: ${required}`);
}
if (!errors.length) pass('Core Web Vitals targets are codified: LCP 2.5s, INP 200ms, CLS 0.1');

if (!adsConfigured) {
  pass('AdSense serving is fail-closed because VITE_ADSENSE_PUBLISHER_ID is not configured');
  warn('This is an engineering readiness gate, not a claim of Google account approval. Enable ads only after certified CMP, legal surfaces, ads.txt, and production consent behavior are verified.');
}

if (warnings.length) for (const message of warnings) console.log(`ADSENSE WARN: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ADSENSE FAIL: ${message}`);
  process.exit(1);
}
console.log('ADSENSE READINESS PASS');
