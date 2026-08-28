import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const errors = [];
const warnings = [];
const adsConfigured = Boolean(process.env.VITE_ADSENSE_PUBLISHER_ID?.trim());
const cmpId = process.env.VITE_TCF_CMP_ID?.trim() ?? '';
const cmpCertified = process.env.VITE_TCF_CMP_CERTIFIED?.trim().toLowerCase() === 'true';
const cmpConfigured = Boolean(cmpId && cmpCertified);

const pass = (message) => console.log(`ADSENSE PASS: ${message}`);
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);
const read = (file) => readFileSync(join(root, file), 'utf8');

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const sourceFiles = trackedFiles.filter((file) => /\.(?:ts|tsx|mjs|html|css)$/u.test(file));
const adsImplementationFiles = new Set(['src/adsense/AdSlot.tsx', 'src/adsense/policy.ts']);
const validatorFile = 'scripts/validate-adsense-readiness.mjs';
const rawAdPattern = /adsbygoogle|pagead\.googlesyndication\.com|googlesyndication\.com\/adsbygoogle/iu;

for (const file of sourceFiles) {
  if (adsImplementationFiles.has(file) || file === validatorFile) continue;
  if (rawAdPattern.test(read(file))) fail(`AdSense implementation leaked outside the central boundary: ${file}`);
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
  'subscribeToTcfConsent',
  'isCertifiedCmpConfigured',
  'minStickyViewportHeightPx: 667',
  'lcpMs: 2500',
  'inpMs: 200',
  'cls: 0.1',
  '2.3',
  '755',
]) if (!policy.includes(required)) fail(`central AdSense policy missing required safeguard: ${required}`);
if (!errors.length) pass('fail-closed placement, spacing, mobile, lifecycle, certified TCF CMP and CWV safeguards are present');

if (adsConfigured) {
  if (!/^\d{1,8}$/u.test(cmpId)) fail('VITE_TCF_CMP_ID must be a numeric IAB TCF CMP ID when AdSense is configured');
  if (!cmpCertified) fail('VITE_TCF_CMP_CERTIFIED=true is required before AdSense can serve');
  if (cmpConfigured) pass(`certified TCF CMP configuration is present (CMP ID ${cmpId})`);
} else {
  warn('Certified CMP configuration is not required while AdSense is OFF; monetization must remain fail-closed until VITE_TCF_CMP_ID and VITE_TCF_CMP_CERTIFIED=true are provided.');
}

const labelCount = (policy.match(/^[ ]{2}[a-z]{2}: /gmu) ?? []).length;
if (labelCount !== 20) fail(`Advertisement label registry must contain exactly 20 locale entries; found ${labelCount}`);
else pass('localized Advertisement labels cover all 20 canonical locales');

const seoFiles = sourceFiles.filter((file) => file.startsWith('src/tools/') && /\/seo\/[a-z]{2}\.ts$/u.test(file));
const introByLocale = new Map();
const tokenize = (value) => String(value).replace(/<[^>]*>/gu, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
let auditedSeo = 0;
let substantiveSeoFailures = 0;

for (const file of seoFiles) {
  const source = read(file);
  const requiredFields = ['title:', 'description:', 'intro:', 'keywords:', 'howTo:', 'features:', 'altText:'];
  for (const field of requiredFields) if (!source.includes(field)) fail(`${file}: missing ${field}`);
  const intro = source.match(/intro:\s*'((?:\\'|[^'])*)'/u)?.[1] ?? source.match(/intro:\s*"((?:\\"|[^"])*)"/u)?.[1] ?? '';
  const description = source.match(/description:\s*'((?:\\'|[^'])*)'/u)?.[1] ?? source.match(/description:\s*"((?:\\"|[^"])*)"/u)?.[1] ?? '';
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
    if (introByLocale.has(duplicateKey)) fail(`${file}: exact duplicate route intro detected for locale ${locale}; source=${introByLocale.get(duplicateKey)}`);
    else introByLocale.set(duplicateKey, file);
  }
  if (failures.length) {
    substantiveSeoFailures += failures.length;
    const message = `${file}: ${failures.join(', ')}`;
    if (adsConfigured) fail(message);
    else warn(`monetization-readiness: ${message}`);
  }
  auditedSeo += 1;
}
if (!errors.length) pass(`audited ${auditedSeo} localized tool SEO files for substantive fields and duplicate intros`);
if (!adsConfigured && substantiveSeoFailures > 0) warn(`AdSense remains OFF; ${substantiveSeoFailures} content-quality observations are deferred to the monetization gate`);

const legalPaths = ['/privacy', '/terms', '/cookies'];
const routerText = sourceFiles.filter((file) => file.startsWith('src/routes/')).map(read).join('\n');
const missingLegal = legalPaths.filter((path) => !routerText.includes(path));
if (adsConfigured && missingLegal.length) fail(`AdSense is configured but required legal routes are not wired: ${missingLegal.join(', ')}`);
else if (missingLegal.length) warn(`Legal routes not yet detected (${missingLegal.join(', ')}); AdSense remains fail-closed until legal + consent wiring is present`);
else pass('privacy/terms/cookie routes are present in the route graph');

const adsTxtPath = join(root, 'public/ads.txt');
const adsTxt = existsSync(adsTxtPath) ? readFileSync(adsTxtPath, 'utf8') : '';
const adsTxtLines = adsTxt.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const adsTxtPattern = /^[a-z0-9.-]+\s*,\s*pub-[0-9]{10,20}\s*,\s*(DIRECT|RESELLER)\s*(?:,\s*[a-f0-9]{32})?\s*$/iu;
const invalidAdsTxt = adsTxtLines.filter((line) => !adsTxtPattern.test(line));
if (!adsTxtLines.length) {
  const message = 'public/ads.txt is missing or contains no seller records';
  if (adsConfigured) fail(message); else warn(`${message}; required before monetization is enabled`);
} else if (invalidAdsTxt.length) {
  const message = `public/ads.txt contains invalid seller record(s): ${invalidAdsTxt.slice(0, 5).join(' | ')}`;
  if (adsConfigured) fail(message); else warn(message);
} else {
  const googleLines = adsTxtLines.filter((line) => /^google\.com\s*,/iu.test(line));
  if (!googleLines.length) {
    const message = 'public/ads.txt has no google.com seller record';
    if (adsConfigured) fail(message); else warn(`${message}; required for production Google inventory`);
  } else if (adsConfigured) {
    const publisherId = process.env.VITE_ADSENSE_PUBLISHER_ID?.trim();
    const normalizedId = publisherId?.startsWith('pub-') ? publisherId : `pub-${publisherId ?? ''}`;
    if (publisherId && !googleLines.some((line) => line.split(',')[1]?.trim() === normalizedId)) fail(`public/ads.txt does not contain the configured publisher ID: ${normalizedId}`);
    else pass('public/ads.txt syntax and configured Google publisher record are valid');
  } else pass('public/ads.txt syntax is valid; publisher matching deferred until monetization is enabled');
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
console.log(`ADSENSE READINESS PASS (${adsConfigured ? 'STRICT MONETIZATION MODE' : 'FOUNDATION MODE'})`);
