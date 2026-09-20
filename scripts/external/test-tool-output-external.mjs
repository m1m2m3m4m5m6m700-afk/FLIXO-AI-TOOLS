#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

const root = process.cwd();
const oraclePath = path.join(root, 'scripts/external/expected-tool-outputs.json');
const reportPath = process.env.FLIXO_EXTERNAL_REPORT ?? path.join(root, 'external-test-results', 'tool-output-report.json');
const oracle = JSON.parse(await fs.readFile(oraclePath, 'utf8'));

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const baseUrl = (readArg('base-url') ?? process.env.FLIXO_EXTERNAL_BASE_URL ?? '').replace(/\/$/, '');
if (!baseUrl) {
  throw new Error('EXTERNAL_BASE_URL_REQUIRED: pass --base-url=<public FLIXO URL> or FLIXO_EXTERNAL_BASE_URL.');
}

const selectedIds = new Set(
  (readArg('case') ?? process.env.FLIXO_EXTERNAL_CASES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);
const cases = selectedIds.size
  ? oracle.cases.filter((item) => selectedIds.has(item.id))
  : oracle.cases;

if (!cases.length) throw new Error('No external output cases selected.');

function compareExpected(expected, actual) {
  const checks = [
    ['mimeType', expected.mimeType, actual.mimeType],
    ['width', expected.width, actual.width],
    ['height', expected.height, actual.height],
    ['downloadExtension', expected.downloadExtension, actual.downloadExtension],
    ['signature', expected.signature, actual.signature],
  ];
  return checks.map(([field, want, got]) => ({
    field,
    expected: want,
    actual: got,
    pass: want === got,
  }));
}

async function upload(page, selector) {
  await page.locator(selector).setInputFiles({
    name: oracle.fixture.name,
    mimeType: oracle.fixture.mimeType,
    buffer: Buffer.from(oracle.fixture.base64, 'base64'),
  });
}

async function applySetup(page, setup) {
  for (const step of setup ?? []) {
    if (step.action === 'select') {
      await page.getByLabel(step.label, { exact: true }).selectOption(String(step.value));
    } else if (step.action === 'fill') {
      await page.getByRole('textbox', { name: step.label, exact: true }).fill(String(step.value));
    } else {
      throw new Error(`Unsupported external setup action: ${step.action}`);
    }
  }
}

async function inspectResult(page) {
  const image = page.locator('img[alt="Tool result"]').first();
  await image.waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => {
    const image = globalThis.document.querySelector('img[alt="Tool result"]');
    return image instanceof globalThis.HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });

  return page.evaluate(async () => {
    const image = document.querySelector('img[alt="Tool result"]');
    if (!(image instanceof globalThis.HTMLImageElement)) throw new Error('EXTERNAL_RESULT_NOT_FOUND');
    if (typeof image.decode === 'function') await image.decode();
    const response = await fetch(image.src);
    if (!response.ok) throw new Error(`EXTERNAL_RESULT_FETCH_FAILED:${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = Array.from(bytes.slice(0, 12))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return {
      mimeType: blob.type,
      byteLength: blob.size,
      width: image.naturalWidth,
      height: image.naturalHeight,
      signature: signature.slice(0, 16),
    };
  });
}

async function inspectDownload(page) {
  const control = page.getByRole('link', { name: 'Download now' }).first().or(page.getByRole('link', { name: 'Download image' }).first());
  if (await control.count()) {
    const filename = await control.getAttribute('download');
    if (filename) return filename;
  }

  const button = page.getByRole('button', { name: 'Download now' }).first();
  if (await button.count()) {
    const filename = await button.getAttribute('download');
    if (filename) return filename;
  }

  return '';
}

const browser = await chromium.launch();
const report = {
  schema: 1,
  mode: 'external-black-box',
  baseUrl,
  startedAt: new Date().toISOString(),
  cases: [],
};

try {
  for (const item of cases) {
    const page = await browser.newPage();
    const entry = { id: item.id, url: `${baseUrl}${item.path}`, pass: false, expected: item.expected, actual: null, checks: [], error: null };

    try {
      await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.getByRole('heading', { level: 1 }).first().waitFor({ state: 'visible', timeout: 30_000 });
      await upload(page, item.inputSelector);
      await applySetup(page, item.setup);
      await page.getByRole('button', { name: item.runLabel, exact: true }).click();

      const actual = await inspectResult(page);
      const filename = await inspectDownload(page);
      actual.downloadExtension = path.extname(filename || '');
      entry.actual = actual;
      entry.checks = compareExpected(item.expected, actual);
      entry.pass = entry.checks.every((check) => check.pass);
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
    } finally {
      await page.close();
    }

    report.cases.push(entry);
  }
} finally {
  await browser.close();
}

report.completedAt = new Date().toISOString();
report.pass = report.cases.length > 0 && report.cases.every((item) => item.pass === true);

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

if (!report.pass) {
  process.exitCode = 1;
}
