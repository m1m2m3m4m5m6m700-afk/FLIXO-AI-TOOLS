import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PLAYWRIGHT_FAILURE = /\\b((?:tests|test)\\/[^\\s:]+\\.spec\\.(?:ts|js|mjs)):(\\d+)(?::(\\d+))?\\s*›\\s*(.+)$/u;
const SOURCE_LOCATION = /\\b((?:src|tests|scripts)\\/[^\\s:()]+?\\.(?:ts|tsx|js|jsx|mjs|cjs)):(\\d+)(?::(\\d+))?/gu;
const BROWSER = /\\[(chromium|firefox|webkit)\\]|\\b(?:project|browser)[=: ]+(chromium|firefox|webkit)\\b/iu;
const EXECUTABLE_TEST = /^(?:scripts\\/ci\\/test-[^/]+|scripts\\/test-[^/]+)\\.(?:mjs|js|ts)$/u;

function normalizeFile(value) {
  const normalized = String(value ?? '').replaceAll('\\\\', '/').replace(/^\\.\\//u, '');
  return /^(?:tests|scripts|src)\\//u.test(normalized) ? normalized : null;
}

function exists(root, file) {
  return Boolean(file && fs.existsSync(path.resolve(root, file)));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\\]\\\\]/gu, '\\\\$&');
}

function sourceLocation(log) {
  for (const match of String(log).matchAll(SOURCE_LOCATION)) {
    const file = normalizeFile(match[1]);
    if (file) return { file, line: Number(match[2]), column: match[3] ? Number(match[3]) : null };
  }
  return null;
}

function playwrightTarget(log, root) {
  for (const line of String(log).split(/\\r?\\n/u)) {
    const match = line.match(PLAYWRIGHT_FAILURE);
    if (!match) continue;
    const spec = normalizeFile(match[1]);
    if (!spec || !exists(root, spec)) continue;
    const titleParts = match[5].split(' › ').map((part) => part.trim()).filter(Boolean);
    const test = titleParts.at(-1) || null;
    if (!test) continue;
    const browserMatch = line.match(BROWSER);
    const browser = browserMatch?.[1] || browserMatch?.[2] || null;
    const args = ['playwright', 'test', spec, '--grep', escapeRegex(test), '--retries=0'];
    if (browser) args.push('--project', browser);
    return { mode: 'exact-test', level: 'EXACT', framework: 'playwright', spec, test, browser, line: Number(match[2]), column: match[3] ? Number(match[3]) : null, evidence: line.trim(), command: ['npx', args] };
  }
  return null;
}

function nodeTestTarget(log, root) {
  const location = sourceLocation(log);
  if (!location || !EXECUTABLE_TEST.test(location.file) || !exists(root, location.file)) return null;
  const args = location.file.endsWith('.ts') ? ['--experimental-strip-types', location.file] : [location.file];
  return { mode: 'exact-test-file', level: 'EXACT', framework: 'node', spec: location.file, test: path.basename(location.file), browser: null, line: location.line, column: location.column, evidence: location.file + ':' + location.line, command: ['node', args] };
}

function fileTarget(log, root, feature) {
  const location = sourceLocation(log);
  if (!location || !exists(root, location.file)) return null;
  if (feature === 'lint') return { mode: 'exact-file', level: 'EXACT', framework: 'eslint', spec: location.file, test: null, browser: null, line: location.line, column: location.column, evidence: location.file + ':' + location.line, command: ['npx', ['eslint', location.file]] };
  if (feature === 'format') return { mode: 'exact-file', level: 'EXACT', framework: 'prettier', spec: location.file, test: null, browser: null, line: location.line, column: location.column, evidence: location.file + ':' + location.line, command: ['npx', ['--yes', 'prettier@3.6.2', '--check', location.file]] };
  return null;
}

function fallback(features) {
  if (features.includes('format')) return { mode: 'feature-suite', level: 'FALLBACK', reason: 'no exact file identity', command: ['npm', ['run', 'format:check']] };
  if (features.includes('webkit') || features.includes('playwright')) return { mode: 'feature-suite', level: 'FALLBACK', reason: 'no exact Playwright identity', command: ['npm', ['run', 'test:browser']] };
  if (features.includes('typescript')) return { mode: 'project-check', level: 'FALLBACK', reason: 'TypeScript diagnostics are project-scoped', command: ['npm', ['run', 'typecheck']] };
  if (features.includes('lint')) return { mode: 'feature-suite', level: 'FALLBACK', reason: 'no exact lint file identity', command: ['npm', ['run', 'lint']] };
  return { mode: 'none', level: 'NONE', reason: 'no targeted verification could be derived', command: null };
}

export function resolveTargetedTests(log, features = [], { targetDir = process.cwd() } = {}) {
  const play = features.includes('playwright') || features.includes('webkit') ? playwrightTarget(log, targetDir) : null;
  const nodeTest = play ? null : nodeTestTarget(log, targetDir);
  const exactFile = play || nodeTest ? null : fileTarget(log, targetDir, features.includes('lint') ? 'lint' : features.includes('format') ? 'format' : null);
  const selected = play || nodeTest || exactFile || fallback(features);
  return Object.freeze({
    schemaVersion: 2,
    strategy: selected.mode,
    level: selected.level,
    exact: selected.level === 'EXACT',
    existingTestReused: selected.mode === 'exact-test' || selected.mode === 'exact-test-file',
    testCreation: 'DISABLED',
    target: selected.spec ? { framework: selected.framework, spec: selected.spec, test: selected.test || null, browser: selected.browser || null, line: selected.line || null, column: selected.column || null, evidence: selected.evidence || null } : null,
    commands: selected.command ? [selected.command] : [],
    regressionCommands: selected.command ? [selected.command] : [],
    reason: selected.reason || 'existing executable target resolved',
  });
}

export function impactedTests(features, context = {}) {
  return resolveTargetedTests(context.log || '', features, context).commands;
}

export function reproduce(targetDir, commands) {
  const results = [];
  for (const [command, args] of commands) {
    try {
      execFileSync(command, args, { cwd: targetDir, stdio: 'inherit', env: { ...process.env, CI: process.env.CI || 'true' } });
      results.push({ command, args, ok: true });
    } catch (error) {
      results.push({ command, args, ok: false, code: error?.status ?? 1, signal: error?.signal ?? null });
    }
  }
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}