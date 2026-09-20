import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { applyPreparedChanges } from './prepared-source-change.mjs';

function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function findTrackedExport(targetDir, symbol) {
  if (!symbol) return { ok: false, reason: 'TS_MISSING_IMPORT_SYMBOL_MISSING' };
  const files = String(execFileSync('git', ['-C', targetDir, 'ls-files', '--', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs'], { encoding: 'utf8' }))
    .split(/\r?\n/u).map((v) => v.trim()).filter(Boolean).filter((file) => !/(^|[/\\])(?:tests?|__tests__)(?:[/\\]|$)/iu.test(file));
  const safe = escapeRegExp(symbol);
  const decl = new RegExp('^\\s*export\\s+(?:(?:declare|type)\\s+)?(?:const|let|var|function|class|enum|interface|type)\\s+' + safe + '\\b', 'mu');
  const reExport = new RegExp('^\\s*export\\s*\\{[^}]*\\b' + safe + '\\b[^}]*\\}', 'mu');
  const hits = [];
  for (const file of files) {
    if (file.endsWith('.d.ts')) continue;
    try { const source = fs.readFileSync(path.resolve(targetDir, file), 'utf8'); if (decl.test(source) || reExport.test(source)) hits.push(file); } catch { /* unreadable source is not evidence */ }
  }
  if (hits.length !== 1) return { ok: false, reason: hits.length === 0 ? 'TS_MISSING_IMPORT_EXPORT_NOT_FOUND' : 'TS_MISSING_IMPORT_EXPORT_AMBIGUOUS', hits };
  return { ok: true, moduleFile: hits[0], hits };
}
function importSpecifier(fromFile, moduleFile) {
  let relative = path.posix.relative(path.posix.dirname(fromFile.replace(/\\\\/g, '/')), moduleFile.replace(/\\\\/g, '/')).replace(/\\.(?:mjs|cjs|js|jsx|ts|tsx)$/iu, '');
  return relative.startsWith('.') ? relative : './' + relative;
}
function applyTypescriptMissingImport(targetDir, plan) {
  const file = safeRelativeFile(targetDir, plan.file);
  const symbol = String(plan.symbol ?? plan.diagnosticSymbol ?? '').trim();
  if (!symbol) return { applied: false, reason: 'TS_MISSING_IMPORT_SYMBOL_MISSING' };
  const absolute = path.resolve(targetDir, file);
  const original = fs.readFileSync(absolute, 'utf8');
  const found = findTrackedExport(targetDir, symbol);
  if (!found.ok) return { applied: false, reason: found.reason, hits: found.hits ?? [] };
  if (found.moduleFile === file) return { applied: false, reason: 'TS_MISSING_IMPORT_SELF_MODULE' };
  const specifier = importSpecifier(file, found.moduleFile);
  const imported = new RegExp('\\bimport\\s+(?:type\\s+)?\\{[^}]*\\b' + escapeRegExp(symbol) + '\\b[^}]*\\}\\s+from\\s+[\"\\\']' + escapeRegExp(specifier) + '[\"\\\']', 'u');
  if (imported.test(original)) return { applied: false, reason: 'TS_MISSING_IMPORT_ALREADY_PRESENT' };
  const lines = original.split(/\r?\n/u);
  const importLine = "import { " + symbol + " } from '" + specifier + "';";
  let insertAt = lines[0]?.startsWith('#!') ? 1 : 0;
  while (insertAt < lines.length && /^(?:[\"']use (?:strict|client|server)[\"'];?)$/u.test(lines[insertAt].trim())) insertAt += 1;
  lines.splice(insertAt, 0, importLine);
  fs.writeFileSync(absolute, lines.join('\n'));
  return { applied: true, engine: 'typescript-missing-import', target: file, symbol, moduleFile: found.moduleFile, moduleSpecifier: specifier };
}
function safeRelativeFile(targetDir, candidate) {
  if (!candidate || typeof candidate !== 'string') throw new Error('FORMAT_TARGET_FILE_MISSING');
  const normalized = candidate.replace(/\\/g, '/').replace(/^\.\//, '');
  if (path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) throw new Error('FORMAT_TARGET_FILE_UNSAFE');
  if (!/\.(?:mjs|cjs|js|ts|tsx|jsx)$/i.test(normalized)) throw new Error('FORMAT_TARGET_FILE_TYPE_UNSAFE');
  const root = path.resolve(targetDir);
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('FORMAT_TARGET_FILE_ESCAPE');
  return normalized;
}

export function runAstRepair(targetDir, plan) {
  if (plan?.id === 'prepared-source-change') {
    if (!Array.isArray(plan.preparedChanges) || !plan.preparedChanges.length) return { applied: false, reason: 'prepared-change-set-empty' };
    return { ...applyPreparedChanges(targetDir, plan.preparedChanges), engine: 'prepared-source-change', kind: 'prepared-contract' };
  }
  if (plan?.id === 'eslint-unused') {
    const file = safeRelativeFile(targetDir, plan.file);
    execFileSync('npx', ['eslint', '--fix', '--', file], { cwd: targetDir, stdio: 'inherit' });
    return { applied: true, engine: 'eslint-ast', target: file };
  }
  if (plan?.id === 'typescript-missing-import') return applyTypescriptMissingImport(targetDir, plan);
  if (plan?.id === 'prettier-file') {
    const file = safeRelativeFile(targetDir, plan.file);
    execFileSync('npx', ['prettier', '--write', '--', file], { cwd: targetDir, stdio: 'inherit' });
    return { applied: true, engine: 'prettier-deterministic', target: file };
  }
  return { applied: false, reason: 'no-supported-deterministic-rule' };
}
