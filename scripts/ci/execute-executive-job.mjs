#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const [jobId, name, category, priority, command] = process.argv.slice(2);

if (![jobId, name, category, priority, command].every(Boolean)) {
  console.error('Usage: execute-executive-job.mjs <jobId> <name> <category> <priority> <command>');
  process.exit(2);
}

const outputDir = path.join('artifacts', 'ci-executive', jobId);
const logPath = path.join(outputDir, 'combined.log');
const resultPath = path.join(outputDir, 'result.json');
const uniqueResultPath = path.join(outputDir, `${jobId}-result.json`);

await mkdir(outputDir, { recursive: true });

const startedAt = new Date().toISOString();
const startedMs = Date.now();

const child = spawn('bash', ['-lc', command], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,
});

let output = '';

const append = (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
};

child.stdout.on('data', append);
child.stderr.on('data', append);

const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', (code, signal) => resolve(code ?? (signal ? 128 : 1)));
});

await writeFile(logPath, output, 'utf8');

const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const failureSignals = /(?:error|failed|failure|exception|fatal|typeerror|syntaxerror|assert(?:ion)?|timeout)/i;
const evidence = lines.filter((line) => failureSignals.test(line)).slice(-50);
const tail = lines.slice(-20);

const result = {
  schemaVersion: 1,
  jobId,
  name,
  category,
  priority,
  command,
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - startedMs,
  exitCode,
  status: exitCode === 0 ? 'PASS' : 'FAIL',
  sha: process.env.EXECUTIVE_SHA || process.env.GITHUB_SHA || 'local',
  runId: process.env.GITHUB_RUN_ID || 'local',
  failureEvidence: evidence,
  outputTail: tail,
};

const serialized = JSON.stringify(result, null, 2) + '\n';
await writeFile(resultPath, serialized, 'utf8');
// Unique root-level filename survives download-artifact merge-multiple: true.
await writeFile(uniqueResultPath, serialized, 'utf8');

console.log(`\n[${jobId}] ${result.status} exitCode=${exitCode} evidence=${resultPath}`);

// Deliberately return success so every executive path can finish and report.
process.exit(0);
