import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.cwd());
const errors = [];
const warnings = [];
const pass = (message) => console.log(`ADSENSE PASS: ${message}`);
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const trackedFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean);

const read = (file) => readFileSync(join(root, file), 'utf8');
const sourceFiles = trackedFiles.filter((file) => /\.(?:ts|tsx|mjs|html|css)$/u.test(file));
const adsImplementationFiles = new Set(['src/adsense/AdSlot.tsx', 'src/adsense/policy.ts']);
const rawAdPattern = /adsbygoogle|pagead2\.googlesyndication\.com|googlesyndication\.com\/adsbygoogle/iu;
for (const file of sourceFiles) {
  if (adsImplementationFiles.has(file)) continue;
  if (rawAdPattern.test(read(file))) fail(`AdSense implementation leaked outside the central boundary: ${file}`);
}
if (errors.length === 0) pass('AdSense code is centralized behind src/adsense');

const policy = read('src/adsense/policy.ts');
for (const required of ['minInteractiveGapPx: 25', 'reservedMinHeightPx: 100', "'error'", "'empty'", "'modal'", "'loader'", "'internal'", 'hasTcfConsent', '755']) {
  if (!policy.includes(required)) fail(`central AdSense policy missing required safeguard: ${required}`);
}
if (errors.length === 0) pass('fail-closed placement, spacing, reservation, and TCF safeguards are present');

const labelCount = (policy.match(/^[ ]{2}[a-z]{2}: /gmu) ?? []).length;
if (labelCount !== 20) fail(`Advertisement label registry must contain exactly 20 locale entries; found ${labelCount}`);
else pass('localized Advertisement labels cover all 20 canonical locales');

const seoFiles = sourceFiles.filter((file) => file.startsWith('src/tools/') && /\/seo\/[a-z]{2}\.ts$/u.test(file));
const introByLocale = new Map();
const tokenize = (value) => value.replace(/<[^>]*>/gu, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
const quotedItems = (value) => value.match(/(?:'[^']*'|"[^"]*")/gu) ?? [];
let auditedSeo = 0;
for (const file of seoFiles) {
  const source = read(file);
  const requiredFields = ['title:', 'description:', 'intro:', 'keywords:', 'howTo:', 'features:', 'altText:'];
  for (const field of requiredFields) if (!source.includes(field)) fail(`${file}: missing ${field}`);

  const intro = source.match(/intro:\s*'((?:\\'|[^'])*)'/u)?.[1] ?? source.match(/intro:\s*"((?:\\"|[^"])*)"/u)?.[1] ?? '';
  const description = source.match(/description:\s*'((?:\\'|[^'])*)'/u)?.[1] ?? source.match(/description:\s*"((?:\\"|[^"])*)"/u)?.[1] ?? '';
  const howTo = source.match(/howTo:\s*\[([^\]]*)\]/u)?.[1] ?? '';
  const features = source.match(/features:\s*\[([^\]]*)\]/u)?.[1] ?? '';
  if (tokenize(intro).length < 40) fail(`${file}: intro is too thin (<40 words)`);
  if (tokenize(description).length < 8) fail(`${file}: description is too thin (<8 words)`);
  if (quotedItems(howTo).length < 3) fail(`${file}: howTo must contain at least 3 steps`);
  if (quotedItems(features).length < 3) fail(`${file}: features must contain at least 3 items`);
  const locale = file.match(/\/seo\/([a-z]{2})\.ts$/u)?.[1] ?? 'unknown';
  const normalizedIntro = intro.toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
  const key = `${locale}:${normalizedIntro}`;
  if (normalizedIntro.length >= 100) {
    if (introByLocale.has(key)) fail(`${file}: exact duplicate route intro detected for locale ${locale}; source=${introByLocale.get(key)}`);
    else introByLocale.set(key, file);
  }
  auditedSeo += 1;
}
if (errors.length === 0 && auditedSeo > 0) pass(`audited ${auditedSeo} localized tool SEO files for substantive fields and duplicate intros`);

const legalPaths = ['/privacy', '/terms', '/cookies'];
const routerText = sourceFiles.filter((file) => file.startsWith('src/routes/')).map(read).join('\n');
const missingLegal = legalPaths.filter((path) => !routerText.includes(path));
const adsConfigured = Boolean(process.env.VITE_ADSENSE_PUBLISHER_ID?.trim());
if (adsConfigured && missingLegal.length) fail(`AdSense is configured but required legal routes are not wired: ${missingLegal.join(', ')}`);
else if (missingLegal.length) warn(`Legal routes not yet detected (${missingLegal.join(', ')}); AdSense remains fail-closed until legal + consent wiring is present`);
else pass('privacy/terms/cookie routes are present in the route graph');

for (const required of ['lcpMs: 2500', 'inpMs: 200', 'cls: 0.1']) {
  if (!policy.includes(required)) fail(`Core Web Vitals target missing: ${required}`);
}
if (errors.length === 0) pass('Core Web Vitals targets are codified: LCP 2.5s, INP 200ms, CLS 0.1');

if (!adsConfigured) {
  pass('AdSense serving is fail-closed because VITE_ADSENSE_PUBLISHER_ID is not configured');
  warn('This is an engineering readiness gate, not a claim of Google account approval. Enable ads only after a Google-certified CMP and legal surface are verified in production.');
}

for (const message of warnings) console.log(`ADSENSE WARN: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ADSENSE FAIL: ${message}`);
  process.exit(1);
}
console.log('ADSENSE READINESS PASS');
