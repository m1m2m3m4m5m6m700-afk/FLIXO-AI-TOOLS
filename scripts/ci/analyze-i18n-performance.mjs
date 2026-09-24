#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const ASSETS = path.join(DIST, 'assets');
const budget = JSON.parse(fs.readFileSync(path.join(ROOT, 'performance-budget.json'), 'utf8'));

const expectedSha = (process.env.EXPECTED_SHA ?? '').trim();
const actualSha = requireGitSha();
if (expectedSha && actualSha !== expectedSha) {
  throw new Error(`EXACT_SHA_MISMATCH expected=${expectedSha} actual=${actualSha}`);
}

const files = [];
walk(DIST, '', files);

const bytesByExt = (ext) => files.filter((f) => f.rel.endsWith(ext)).reduce((sum, f) => sum + f.size, 0);
const jsFiles = files.filter((f) => f.rel.startsWith('assets/') && f.rel.endsWith('.js'));
const cssFiles = files.filter((f) => f.rel.startsWith('assets/') && f.rel.endsWith('.css'));
const allAssetFiles = files.filter((f) => f.rel.startsWith('assets/'));

const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const referencedJs = [...indexHtml.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+\.js)"/gu)]
  .map((m) => m[1].replace(/^\//u, ''))
  .filter((p) => p.startsWith('assets/'));

const criticalFiles = jsFiles.filter((f) => referencedJs.includes(f.rel));
const criticalJavascriptBytes = criticalFiles.reduce((sum, f) => sum + f.size, 0);
const javascriptBytes = bytesByExt('.js');
const cssBytes = bytesByExt('.css');
const totalAssetBytes = allAssetFiles.reduce((sum, f) => sum + f.size, 0);

const metrics = [
  metric('criticalJavascriptBytes', budget.criticalJavascriptBytes, criticalJavascriptBytes),
  metric('javascriptBytes', budget.javascriptBytes, javascriptBytes),
  metric('cssBytes', budget.cssBytes, cssBytes),
  metric('totalAssetBytes', budget.totalAssetBytes, totalAssetBytes),
];

const localeResults = [];
for (const locale of ['ar','en','es','fr','de','hi','id','it','ja','ko','ms','nl','pl','pt','ru','sv','th','tr','uk','vi']) {
  const coreSource = fs.readFileSync(path.join(ROOT, 'src/lib/i18n/locales', locale + '.ts'), 'utf8');
  const toolSource = fs.readFileSync(path.join(ROOT, 'src/data/tool-ui-locales', locale + '.ts'), 'utf8');
  const coreMarker = literal(coreSource, /homeTitle:\s*'([^']+)'/u, `core-${locale}`);
  const toolMarker = literal(toolSource, /notFound:\s*'([^']+)'/u, `tool-ui-${locale}`);
  const coreMatches = findAssets(jsFiles, coreMarker);
  const toolMatches = findAssets(jsFiles, toolMarker);
  localeResults.push({
    locale,
    core: classifyChunk(coreMatches, criticalFiles),
    toolUi: classifyChunk(toolMatches, criticalFiles),
  });
}

const heavy = {
  criticalReferences: referencedJs,
  forbiddenInitialMarkers: [
    'QUICKFLOW_LOCALES',
    'QUICKFLOW_I18N',
    'buildQuickFlowPlan',
    'planFromIntent',
    'OPENAI_API_KEY',
    'openai.com',
  ].filter((marker) => criticalFiles.some((f) => fs.readFileSync(path.join(DIST, f.rel), 'utf8').includes(marker))),
  lazyFeaturePayloadHints: {
    agent: findAssetsByAny(jsFiles, ['AGENT_I18N', 'FlixoAIAgent']),
    commandPalette: findAssetsByAny(jsFiles, ['SmartCommandPalette']),
    quickflow: findAssetsByAny(jsFiles, ['QUICKFLOW_I18N', 'QUICKFLOW_LOCALES']),
  },
};

const packageHash = hashFiles(files);
const report = {
  schemaVersion: 1,
  exactSha: actualSha,
  metrics,
  localeChunks: localeResults,
  heavy,
  packageHash,
  criticalFiles: criticalFiles.map((f) => ({ rel: f.rel, bytes: f.size })),
  status:
    metrics.every((m) => m.delta <= 0) &&
    localeResults.every((r) => r.core.status === 'PASS' && r.toolUi.status === 'PASS') &&
    heavy.forbiddenInitialMarkers.length === 0
      ? 'PASS'
      : 'FAIL',
};

fs.mkdirSync(path.join(ROOT, 'diagnostics', 'i18n'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'i18n', 'i18n-build-report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(ROOT, 'diagnostics', 'i18n', 'performance-budget-report.md'), markdown(report));

console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);

function requireGitSha() {
  const out = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/u.test(out)) throw new Error('Invalid git HEAD SHA');
  return out;
}

function walk(abs, rel, out) {
  for (const name of fs.readdirSync(abs, { withFileTypes: true })) {
    const childAbs = path.join(abs, name.name);
    const childRel = path.posix.join(rel, name.name);
    if (name.isDirectory()) walk(childAbs, childRel, out);
    else out.push({ abs: childAbs, rel: childRel, size: fs.statSync(childAbs).size });
  }
}

function metric(name, budgetValue, actual) {
  return { name, budget: budgetValue, actual, delta: actual - budgetValue, status: actual <= budgetValue ? 'PASS' : 'FAIL' };
}

function literal(source, regex, label) {
  const value = source.match(regex)?.[1];
  if (!value) throw new Error(`Missing build marker ${label}`);
  return value;
}

function findAssets(assetFiles, marker) {
  return assetFiles.filter((f) => fs.readFileSync(f.abs, 'utf8').includes(marker)).map((f) => f.rel);
}

function findAssetsByAny(assetFiles, markers) {
  return assetFiles.filter((f) => {
    const text = fs.readFileSync(f.abs, 'utf8');
    return markers.some((m) => text.includes(m));
  }).map((f) => f.rel);
}

function classifyChunk(matches, critical) {
  const criticalSet = new Set(critical.map((f) => f.rel));
  if (matches.length !== 1) return { status: 'FAIL', matches };
  return {
    status: criticalSet.has(matches[0]) ? 'FAIL' : 'PASS',
    chunk: matches[0],
    bytes: fs.statSync(path.join(DIST, matches[0])).size,
  };
}

function hashFiles(all) {
  const hash = crypto.createHash('sha256');
  for (const file of [...all].sort((a, b) => a.rel.localeCompare(b.rel))) {
    hash.update(file.rel);
    hash.update('\0');
    hash.update(fs.readFileSync(file.abs));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function markdown(r) {
  const lines = [
    '# FLIXO i18n / Performance Build Evidence',
    '',
    `Exact commit SHA: \`${r.exactSha}\``,
    `Package fingerprint (SHA-256): \`${r.packageHash}\``,
    `Overall build evidence: **${r.status}**`,
    '',
    '## Performance budgets',
    '',
    '| Metric | Budget (bytes) | Actual (bytes) | Delta | Status |',
    '|---|---:|---:|---:|---|',
    ...r.metrics.map((m) => `| ${m.name} | ${m.budget} | ${m.actual} | ${m.delta} | ${m.status} |`),
    '',
    '## Locale chunk separation',
    '',
    '| Locale | Core dictionary chunk | Tool UI chunk |',
    '|---|---|---|',
    ...r.localeChunks.map((x) => `| ${x.locale} | ${x.core.status} · ${x.core.chunk ?? x.core.matches?.join(', ') ?? '-'} | ${x.toolUi.status} · ${x.toolUi.chunk ?? x.toolUi.matches?.join(', ') ?? '-'} |`),
    '',
    '## Homepage / zero-AI-cost checks',
    '',
    `Forbidden heavy markers in initial JS: ${r.heavy.forbiddenInitialMarkers.length ? r.heavy.forbiddenInitialMarkers.join(', ') : 'none'}`,
    `Agent-related lazy chunks: ${r.heavy.lazyFeaturePayloadHints.agent.join(', ') || 'none detected'}`,
    `Command-palette chunks: ${r.heavy.lazyFeaturePayloadHints.commandPalette.join(', ') || 'none detected'}`,
    `QuickFlow chunks: ${r.heavy.lazyFeaturePayloadHints.quickflow.join(', ') || 'none detected'}`,
    '',
  ];
  return lines.join('\n');
}
