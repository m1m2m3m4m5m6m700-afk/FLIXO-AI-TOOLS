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
const unavailableTools = new Set(['photo-colorizer']);
const failures = [];

function fail(message) { failures.push(message); }

const fastBlock = workflow.match(/Run Browser FAST engine[\s\S]*?Validate Playwright evidence serialization/);
if (!fastBlock) fail('CI Browser FAST execution block is missing.');
const fastSource = fastBlock?.[0] ?? '';

if (!workflow.includes('browser: [chromium, firefox, webkit]')) {
  fail('FAST browser matrix must declare Chromium, Firefox, and WebKit.');
}
for (const browser of browsers) {
  const id = `BROWSER-${String(browsers.indexOf(browser) + 1).padStart(3, '0')}`;
  if (!testPlan.includes(`"${id}"`)) fail(`test-plan browser assertion missing for ${browser}.`);
}

const declaredSpecs = [...fastSource.matchAll(/tests\/([a-z0-9-]+)\.spec\.ts/g)].map((m) => m[1]);
let outputProofCount = 0;
let deliveryProofCount = 0;

for (const tool of tools) {
  const path = resolve(ROOT, `tests/${tool}.spec.ts`);
  if (!existsSync(path)) { fail(`Missing browser spec: tests/${tool}.spec.ts`); continue; }
  if (!declaredSpecs.includes(tool)) fail(`Tool ${tool} is not included in Browser FAST matrix.`);

  const source = readFileSync(path, 'utf8');
  if (unavailableTools.has(tool)) {
    const unavailableProof = /not publicly available|Tool not found|noindex/i.test(source);
    if (!unavailableProof) fail(`${tool}: unavailable tool lacks explicit unavailable-state proof.`);
    outputProofCount += 1;
    continue;
  }

  // Output proof accepts canonical output contracts, direct image/text assertions,
  // or stronger canvas/export evidence used by editor tools.
  const hasResultProof =
    /assertToolOutputContract|assertImageResult/.test(source) ||
    /toHaveJSProperty\(['"]naturalWidth|getByText\(|toContainText\(|RESULT['"]?\s*,|Tool result/i.test(source) ||
    (/canvasScreenshot\(|toBeVisible\(\).*preview|preview['"][^\n]*toBeVisible/.test(source) &&
      /equals\(|createReadStream\(\)|waitForEvent\(['"]download['"]\)/.test(source));

  const hasDownloadProof =
    /assertDownload|waitForEvent\(['"]download['"]\)|suggestedFilename\(\)|createReadStream\(\)/.test(source) ||
    /toHaveAttribute\(['"]download['"]|toHaveAttribute\(['"]href['"],\s*\/(?:\x5e)?blob/.test(source);

  if (!hasResultProof) fail(`${tool}: no explicit output/result assertion found.`); else outputProofCount += 1;
  if (!hasDownloadProof) fail(`${tool}: no explicit download/output-delivery assertion found.`); else deliveryProofCount += 1;
}

const uniqueDeclared = [...new Set(declaredSpecs)];
if (uniqueDeclared.length !== 22) fail(`Browser FAST tool matrix must contain exactly 22 unique tool specs; found ${uniqueDeclared.length}.`);
if (tools.some((tool) => !uniqueDeclared.includes(tool))) fail('Browser FAST matrix is not synchronized with the canonical 22-tool list.');

assert.equal(tools.length, 22);
assert.equal(browsers.length, 3);

if (failures.length) {
  console.error('TEST_MATRIX_CONTRACT=FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TEST_MATRIX_CONTRACT=PASS');
console.log(`TOOLS=${tools.length}`);
console.log(`BROWSERS=${browsers.join(',')}`);
console.log(`OUTPUT_PROOF=${outputProofCount}/${tools.length}`);
console.log(`DELIVERY_PROOF=${deliveryProofCount}/${tools.length - unavailableTools.size}`);
console.log('UNAVAILABLE_STATE_PROOF=1/1');
console.log('NO_TOOL_REMOVED=PASS');
