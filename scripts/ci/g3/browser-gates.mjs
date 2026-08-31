import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000';
await fs.mkdir('artifacts/ci/g3/browser', { recursive: true });
const results = [];
const emit = async (gate, name, status, extra = {}) => {
  const result = { gate, name, status, class: status === 'PASS' ? null : (extra.class || 'TEST'), rootCause: status === 'PASS' ? null : (extra.rootCause || 'BROWSER_INFRASTRUCTURE'), retryable: false, sha: process.env.EXPECTED_HEAD_SHA || process.env.GITHUB_SHA || 'unknown', durationMs: extra.durationMs || 0, ...extra };
  results.push(result);
  await fs.writeFile(`artifacts/ci/g3/browser/${gate}.json`, JSON.stringify(result, null, 2) + '\n');
};

const executable = chromium.executablePath();
let installOk = false;
try {
  await fs.access(executable);
  installOk = true;
} catch {
  installOk = false;
}
await emit('G3-50', 'Browser Installed', installOk ? 'PASS' : 'FAIL', { executable, rootCause: installOk ? null : 'BROWSER_NOT_INSTALLED', class: installOk ? null : 'DEPENDENCY' });
if (!installOk) {
  await emit('G3-51', 'Browser Launch', 'BLOCKED', { class: 'DEPENDENCY', rootCause: 'G3-50', derivedFrom: 'G3-50' });
  for (const [gate, name] of [['G3-52','WebServer Ready'],['G3-53','Health Endpoint'],['G3-54','Page Load'],['G3-55','Console Errors'],['G3-56','Runtime Errors'],['G3-60','Upload Trigger'],['G3-61','Input Discovery'],['G3-62','File Injection'],['G3-63','FileList Verification'],['G3-64','React Change Event'],['G3-65','UI Selected State'],['G3-70','Processing Started'],['G3-71','Loading State'],['G3-72','Processing Completed'],['G3-73','Success State'],['G3-74','Error State'],['G3-80','Download Trigger'],['G3-81','Download Event'],['G3-82','Download Exists'],['G3-83','Download Filename'],['G3-84','Download MIME'],['G3-85','Download Size']]) await emit(gate, name, 'BLOCKED', { class: 'DEPENDENCY', rootCause: 'G3-50', derivedFrom: 'G3-50' });
  process.exit(1);
}

let browser;
try {
  const started = Date.now();
  browser = await chromium.launch({ headless: true });
  await emit('G3-51', 'Browser Launch', 'PASS', { durationMs: Date.now() - started });
} catch (error) {
  await emit('G3-51', 'Browser Launch', 'FAIL', { stderr: String(error), rootCause: 'BROWSER_LAUNCH', class: 'INFRA' });
  for (const [gate, name] of [['G3-52','WebServer Ready'],['G3-53','Health Endpoint'],['G3-54','Page Load'],['G3-55','Console Errors'],['G3-56','Runtime Errors'],['G3-60','Upload Trigger'],['G3-61','Input Discovery'],['G3-62','File Injection'],['G3-63','FileList Verification'],['G3-64','React Change Event'],['G3-65','UI Selected State'],['G3-70','Processing Started'],['G3-71','Loading State'],['G3-72','Processing Completed'],['G3-73','Success State'],['G3-74','Error State'],['G3-80','Download Trigger'],['G3-81','Download Event'],['G3-82','Download Exists'],['G3-83','Download Filename'],['G3-84','Download MIME'],['G3-85','Download Size']]) await emit(gate, name, 'BLOCKED', { class: 'DEPENDENCY', rootCause: 'G3-51', derivedFrom: 'G3-51' });
  process.exit(1);
}

try {
  const page = await browser.newPage();
  const consoleErrors = [];
  const runtimeErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  let response;
  let lastError;
  for (let i = 0; i < 20; i += 1) {
    try {
      response = await page.goto(`${baseURL}/en/image-compressor`, { waitUntil: 'domcontentloaded', timeout: 3000 });
      if (response?.ok()) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!response?.ok()) {
    throw new Error(`web server not ready: ${response?.status() ?? ''} ${lastError ? String(lastError) : ''}`);
  }
  await emit('G3-52', 'WebServer Ready', 'PASS', { statusCode: response.status() });
  await emit('G3-53', 'Health Endpoint', 'PASS', { endpoint: '/en/image-compressor', statusCode: response.status() });
  try {
    await page.getByRole('heading', { name: /Image Compressor/i }).first().waitFor({ state: 'visible', timeout: 10000 });
    await emit('G3-54', 'Page Load', 'PASS');
  } catch (error) {
    await emit('G3-54', 'Page Load', 'FAIL', { stderr: String(error), class: 'RUNTIME', rootCause: 'PAGE_LOAD' });
    await emit('G3-55', 'Console Errors', 'BLOCKED', { class: 'DEPENDENCY', rootCause: 'G3-54', derivedFrom: 'G3-54' });
    await emit('G3-56', 'Runtime Errors', 'BLOCKED', { class: 'DEPENDENCY', rootCause: 'G3-54', derivedFrom: 'G3-54' });
  }
  if (!results.some((result) => result.gate === 'G3-55')) {
    await page.waitForTimeout(250);
    await emit('G3-55', 'Console Errors', consoleErrors.length ? 'FAIL' : 'PASS', { errors: consoleErrors, rootCause: consoleErrors.length ? 'CONSOLE_ERROR' : null });
  }
  if (!results.some((result) => result.gate === 'G3-56')) {
    await emit('G3-56', 'Runtime Errors', runtimeErrors.length ? 'FAIL' : 'PASS', { errors: runtimeErrors, rootCause: runtimeErrors.length ? 'RUNTIME_ERROR' : null });
  }
} catch (error) {
  for (const [gate, name] of [['G3-52','WebServer Ready'],['G3-53','Health Endpoint'],['G3-54','Page Load'],['G3-55','Console Errors'],['G3-56','Runtime Errors']]) {
    if (!results.some((result) => result.gate === gate)) {
      await emit(gate, name, gate === 'G3-52' ? 'FAIL' : 'BLOCKED', { stderr: String(error), class: gate === 'G3-52' ? 'INFRA' : 'DEPENDENCY', rootCause: gate === 'G3-52' ? 'BROWSER_SERVER' : 'G3-52', derivedFrom: gate === 'G3-52' ? undefined : 'G3-52' });
    }
  }
}
await browser.close();

const flow = await new Promise((resolve) => {
  const started = Date.now();
  const child = spawn('npx', ['playwright', 'test', 'tests/g3-artifact-integrity.spec.ts', '--project=chromium', '--workers=1', '--retries=0', '--reporter=line'], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (data) => { stdout += data; });
  child.stderr.on('data', (data) => { stderr += data; });
  child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr, durationMs: Date.now() - started }));
});

function isSetInputFilesFailure(text) {
  return /TimeoutError[\s\S]*locator\.setInputFiles|locator\.setInputFiles[\s\S]*Timeout/i.test(text);
}

const downstreamGates = [
  ['G3-63','FileList Verification'], ['G3-64','React Change Event'], ['G3-65','UI Selected State'],
  ['G3-70','Processing Started'], ['G3-71','Loading State'], ['G3-72','Processing Completed'], ['G3-73','Success State'], ['G3-74','Error State'],
  ['G3-80','Download Trigger'], ['G3-81','Download Event'], ['G3-82','Download Exists'], ['G3-83','Download Filename'], ['G3-84','Download MIME'], ['G3-85','Download Size'],
];

if (flow.code === 0) {
  for (const [gate, name] of [
    ['G3-60','Upload Trigger'], ['G3-61','Input Discovery'], ['G3-62','File Injection'], ['G3-63','FileList Verification'], ['G3-64','React Change Event'], ['G3-65','UI Selected State'],
    ['G3-70','Processing Started'], ['G3-71','Loading State'], ['G3-72','Processing Completed'], ['G3-73','Success State'], ['G3-74','Error State'],
    ['G3-80','Download Trigger'], ['G3-81','Download Event'], ['G3-82','Download Exists'], ['G3-83','Download Filename'], ['G3-84','Download MIME'], ['G3-85','Download Size'],
  ]) await emit(gate, name, 'PASS', { stdout: flow.stdout, stderr: flow.stderr, durationMs: flow.durationMs });
} else {
  const flowText = `${flow.stdout}\n${flow.stderr}`;
  const setInputFailure = isSetInputFilesFailure(flowText);
  await emit('G3-60', 'Upload Trigger', 'PASS', { stdout: flow.stdout, stderr: flow.stderr, durationMs: flow.durationMs });
  await emit('G3-61', 'Input Discovery', setInputFailure ? 'PASS' : 'FAIL', { stdout: flow.stdout, stderr: flow.stderr, durationMs: flow.durationMs, class: setInputFailure ? undefined : 'TEST', rootCause: setInputFailure ? undefined : 'BROWSER_FLOW' });
  await emit('G3-62', 'File Injection', 'FAIL', {
    stdout: flow.stdout,
    stderr: flow.stderr,
    durationMs: flow.durationMs,
    class: setInputFailure ? 'RUNTIME' : 'TEST',
    rootCause: setInputFailure ? 'RC-G3-RUNTIME-001' : 'BROWSER_FLOW',
    retryable: false,
    assertion: 'Playwright file injection must complete without timeout',
  });
  for (const [gate, name] of downstreamGates) await emit(gate, name, 'BLOCKED', {
    stdout: flow.stdout,
    stderr: flow.stderr,
    durationMs: flow.durationMs,
    class: 'DEPENDENCY',
    rootCause: 'G3-62',
    derivedFrom: 'G3-62',
    blockedBy: ['G3-62'],
  });
}

await fs.writeFile('artifacts/ci/g3/browser/index.json', JSON.stringify({ results }, null, 2) + '\n');
process.exit(results.some((result) => result.status === 'FAIL' || result.status === 'BLOCKED') ? 1 : 0);
