#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const workflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');
const testPlan = readFileSync(resolve(ROOT, 'scripts/ci/test-plan.json'), 'utf8');

const tools = [
  'image-compressor', 'background-remover', 'image-upscaler', 'image-converter',
  'ai-image-generator', 'object-remover', 'watermark-remover', 'image-cropper',
  'image-to-svg', 'image-ocr', 'photo-colorizer', 'background-blur',
  'passport-photo-maker', 'watermark-adder', 'meme-generator', 'collage-maker',
  'image-effects', 'exif-cleaner', 'svg-optimizer', 'mockup-generator', 'seed', 'pix',
];

const browsers = ['chromium', 'firefox', 'webkit'];
const failures = [];

function fail(message) { failures.push(message); }

assert.equal((workflow.match(/tests\/[a-z0-9-]+\.spec\.ts/g) ?? []).filter((v, i, a) => a.indexOf(v) === i).length >= 22, true);

const fastBlock = workflow.match(/Run Browser FAST engine[\s\S]*?Validate Playwright evidence serialization/);
if (!fastBlock) fail('CI Browser FAST execution block is missing.');
const fastSource = fastBlock?.[0] ?? '';

for (const browser of browsers) {
  if (!workflow.includes(`browser: [chromium, firefox, webkit]`)) fail('FAST browser matrix must declare Chromium, Firefox, and WebKit.');
  if (!testPlan.includes(`"BROWSER-${String(browsers.indexOf(browser) + 1).padStart(3, '0')}"`)) fail(`test-plan browser assertion missing for ${browser}.`);
}

const declaredSpecs = [...fastSource.matchAll(/tests\/([a-z0-9-]+)\.spec\.ts/g)].map((m) => m[1]);
for (const tool of tools) {
  const path = resolve(ROOT, `tests/${tool}.spec.ts`);
  if (!existsSync(path)) { fail(`Missing browser spec: tests/${tool}.spec.ts`); continue; }
  if (!declaredSpecs.includes(tool)) fail(`Tool ${tool} is not included in Browser FAST matrix.`);

  const source = readFileSync(path, 'utf8');
  const hasResultProof = /assertToolOutputContract|assertImageResult|toBeVisible\(\).*Tool result|toHaveJSProperty\(['"]naturalWidth|toContainText\(/s.test(source);
  const hasDownloadProof = /assertDownload|waitForEvent\(['"]download['"]\)|toHaveAttribute\(['"]href['"],\s*\/(?:\^)?blob|suggestedFilename\(\)/s.test(source);
  if (!hasResultProof) fail(`${tool}: no explicit output/result assertion found.`);
  if (!hasDownloadProof) fail(`${tool}: no explicit download/output-delivery assertion found.`);
}

const uniqueDeclared = [...new Set(declaredSpecs)];
if (uniqueDeclared.length !== 22) fail(`Browser FAST tool matrix must contain exactly 22 unique tool specs; found ${uniqueDeclared.length}.`);
if (tools.some((tool) => !uniqueDeclared.includes(tool))) fail('Browser FAST matrix is not synchronized with the canonical 22-tool list.');

if (failures.length) {
  console.error('TEST_MATRIX_CONTRACT=FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TEST_MATRIX_CONTRACT=PASS');
console.log(`TOOLS=${tools.length}`);
console.log(`BROWSERS=${browsers.join(',')}`);
console.log('OUTPUT_PROOF=22/22');
console.log('DELIVERY_PROOF=22/22');
console.log('NO_TOOL_REMOVED=PASS');
