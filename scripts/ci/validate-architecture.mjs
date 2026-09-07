import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const workflowDir = '.github/workflows';
const workflows = readdirSync(workflowDir).filter((file) => /\.(ya?ml)$/u.test(file));
const contents = Object.fromEntries(workflows.map((file) => [file, readFileSync(join(workflowDir, file), 'utf8')]));
const failures = [];
const fail = (message) => failures.push(message);
const has = (file, pattern) => pattern.test(contents[file] ?? '');

const ci = contents['ci.yml'] ?? '';
if (!ci) fail('ci.yml is missing.');
if (!/pull_request:\s*\n\s*branches:\s*\[main\]/u.test(ci)) fail('ci.yml must own the canonical pull-request verification surface.');
if (!/workflow_dispatch:/u.test(ci)) fail('ci.yml must support deterministic manual execution.');
if (!/Matrix First Barrier/u.test(ci)) fail('ci.yml must gate official verification behind Matrix First Barrier.');
if (!/HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u.test(ci)) fail('ci.yml must derive the exact PR head SHA.');
if (/s4-runtime-e2e|ai-captioner-srt|canonical\.test/u.test(ci)) fail('ci.yml contains stale S4/legacy route diagnostics.');
if (/continue-on-error:\s*true/u.test(ci)) fail('CI may not suppress failures with continue-on-error.');

const matrixFirst = contents['matrix-first.yml'] ?? '';
if (!matrixFirst) fail('matrix-first.yml is missing.');
if (!/browser:\s*\[chromium, firefox, webkit\]/u.test(matrixFirst)) fail('Matrix First must retain Chromium, Firefox, and WebKit.');
if (!/tests\/localization-runtime\.spec\.ts/u.test(matrixFirst)) fail('Matrix First must execute the canonical G4 public-route localization contract.');
if (!/retries=0/u.test(matrixFirst)) fail('Matrix First retries must remain disabled for deterministic failure propagation.');
if (/S4_EXTERNAL_SERVER|PLAYWRIGHT_SERVER|canonical\.test/u.test(matrixFirst)) fail('Matrix First contains stale S4/test-origin environment residue.');
if (!/name:\s*Image Matrix Certification/u.test(matrixFirst)) fail('Matrix First certification owner is missing.');

const fullMatrix = contents['full-matrix-parallel.yml'] ?? '';
if (!fullMatrix) fail('full-matrix-parallel.yml is missing.');
if (!/browser:\s*\[chromium, firefox, webkit\]/u.test(fullMatrix)) fail('Full Matrix must retain Chromium, Firefox, and WebKit.');
if (!/tests\/localization-runtime\.spec\.ts/u.test(fullMatrix)) fail('Full Matrix must execute canonical public-route × locale coverage.');
if (!/retries=0/u.test(fullMatrix)) fail('Full Matrix retries must remain disabled for deterministic failure propagation.');
if (/S4_EXTERNAL_SERVER|PLAYWRIGHT_SERVER|canonical\.test/u.test(fullMatrix)) fail('Full Matrix contains stale S4/test-origin environment residue.');
if (!/if:\s*\$\{\{\s*always\(\)\s*\}\}/u.test(fullMatrix)) fail('Full Matrix certification must evaluate after all browser units.');

const forbiddenWorkflowResidue = /(^|[\s/'"`])(s4-runtime-e2e|ai-captioner-srt)(?:$|[\s/'"`])/iu;
for (const [file, source] of Object.entries(contents)) {
  if (forbiddenWorkflowResidue.test(source)) fail(`${file}: forbidden legacy S4/tool residue detected.`);
  if (/\b(if|continue-on-error):\s*(?:false|true)/u.test(source) && /continue-on-error:\s*true/u.test(source)) fail(`${file}: failure suppression detected.`);
}

const requiredStaticFiles = [
  'src/lib/i18n/config.ts',
  'src/lib/i18n/loader.ts',
  'src/config/tools.ts',
  'src/config/tool-definitions/image.ts',
  'src/routes/route-tree.ts',
  'src/routes/localized-tool.tsx',
  'scripts/validate-seo.mjs',
  'scripts/validate-seo-manifest.mjs',
  'scripts/validate-canonical-locale-surface.mjs',
];
for (const file of requiredStaticFiles) if (!existsSync(file)) fail(`required canonical source is missing: ${file}`);

const localeSource = readFileSync('src/lib/i18n/config.ts', 'utf8').match(/export const LOCALES = \[([^\]]+)\] as const;/u)?.[1] ?? '';
const locales = localeSource.match(/['"][A-Za-z-]+['"]/gu)?.map((value) => value.slice(1, -1)) ?? [];
if (locales.length !== 20) fail(`canonical locale count=${locales.length}; expected 20.`);
if (new Set(locales).size !== 20) fail('canonical locale registry contains duplicates.');

const routeTree = readFileSync('src/routes/route-tree.ts', 'utf8');
if (/admin-login|admin\.tsx|ai-captioner-srt|\/admin/u.test(routeTree)) fail('public route tree contains removed admin or legacy AI routes.');
if (!/localizedToolRoute/u.test(routeTree)) fail('canonical localized tool route is not registered.');

const imageSource = readFileSync('src/config/tool-definitions/image.ts', 'utf8');
if (/(?:category\s*:\s*['"](?:AI|Other|Audio|Video|PDF|CSV)['"])/u.test(imageSource)) fail('image registry exposes non-image taxonomy.');
if (imageSource.includes('isReady: false') && !/photo-colorizer/u.test(imageSource)) fail('non-ready image tools must be explicit, known inventory entries.');

console.log(
  failures.length
    ? failures.map((message) => `FAIL: ${message}`).join('\n')
    : `CI architecture contract PASS: ${workflows.length} workflows inspected; canonical Image-only routing, 20-locale SSOT, fail-closed matrix, and no stale S4 surface.`,
);
if (failures.length) process.exit(1);
