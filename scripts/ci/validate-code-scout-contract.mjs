#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const scoutPath = path.resolve(root, 'scripts/ci/code-read-only-scout.mjs');
const text = fs.readFileSync(scoutPath, 'utf8');
const required = [
  "authority: 'READ_ONLY_CODE_SCOUT'",
  "mode: 'READ_ONLY_ANALYSIS'",
  "mutationPolicy: 'NO_SOURCE_MUTATION'",
  "reportWriteScope: OUTPUT",
  'git',
  'git ls-files',
  'Findings are hypotheses/evidence for execution agents',
];
for (const marker of required) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${marker}`);
if (/git\s+add|git\s+commit|git\s+push|update_file|create_file|delete_file/.test(text)) failures.push('FORBIDDEN_MUTATION_OPERATION_DETECTED');
if (!text.includes('writeFileSync(OUTPUT')) failures.push('REPORT_OUTPUT_MISSING');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = { schemaVersion: 1, authority: 'READ_ONLY_CODE_SCOUT_CONTRACT', status: failures.length ? 'FAIL' : 'PASS', checkedSha: sha, scout: 'scripts/ci/code-read-only-scout.mjs', findings: failures };
fs.mkdirSync(path.resolve(root, 'diagnostics/investigation'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/investigation/code-scout-contract.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
