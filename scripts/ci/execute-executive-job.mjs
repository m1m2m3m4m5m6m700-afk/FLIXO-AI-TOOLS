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
const errorsPath = path.join(outputDir, 'job-errors.json');
const uniqueErrorsPath = path.join(outputDir, `${jobId}-errors.json`);

await mkdir(outputDir, { recursive: true });

function splitCommands(input) {
  const commands = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if ((ch === '"' || ch === "'") && input[i - 1] !== '\\') {
      quote = quote === ch ? null : quote ?? ch;
      current += ch;
      continue;
    }
    if (!quote && ch === '&' && input[i + 1] === '&') {
      if (current.trim()) commands.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += ch;
  }
  if (current.trim()) commands.push(current.trim());
  return commands.length ? commands : [input];
}

function runShell(commandText, logWriter) {
  return new Promise((resolve) => {
    const child = spawn('bash', ['-lc', commandText], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let output = '';
    const append = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      logWriter(text);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => resolve({ exitCode: 1, output: `${output}\n${error.message}\n` }));
    child.on('close', (code, signal) => resolve({ exitCode: code ?? (signal ? 128 : 1), output }));
  });
}

const startedAt = new Date().toISOString();
const startedMs = Date.now();
let combinedOutput = '';
const appendLog = (text) => { combinedOutput += text; };
const commands = splitCommands(command);
const commandResults = [];

for (const [index, commandText] of commands.entries()) {
  console.log(`\n[${jobId}] command ${index + 1}/${commands.length}: ${commandText}`);
  const result = await runShell(commandText, appendLog);
  commandResults.push({ command: commandText, exitCode: result.exitCode, status: result.exitCode === 0 ? 'PASS' : 'FAIL' });
  console.log(`[${jobId}] command ${index + 1} ${result.exitCode === 0 ? 'PASS' : 'FAIL'} — continuing`);
}

await writeFile(logPath, combinedOutput, 'utf8');

const successful = commandResults.filter((result) => result.exitCode === 0).length;
const failed = commandResults.length - successful;
const overallExitCode = failed === 0 ? 0 : 1;

const extractor = spawn('node', [
  'scripts/extract-errors.mjs',
  `--type=${jobId}`,
  `--job-id=${jobId}`,
  `--job-name=${name}`,
  `--category=${category}`,
  `--priority=${priority}`,
  `--command=${command.replaceAll('"', '\\"')}`,
  `--input=${logPath}`,
  `--output=${errorsPath}`,
  `--exit-code=${overallExitCode}`,
], { stdio: 'inherit', env: process.env });
await new Promise((resolve) => extractor.on('close', resolve));

const errors = JSON.parse(await (await import('node:fs/promises')).readFile(errorsPath, 'utf8'));
await writeFile(uniqueErrorsPath, `${JSON.stringify(errors, null, 2)}\n`, 'utf8');

const lines = combinedOutput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const evidence = (errors.errors ?? []).map((item) => item.raw).slice(-100);
const tail = lines.slice(-30);

const result = {
  schemaVersion: 2,
  jobId,
  name,
  category,
  priority,
  command,
  commands: commandResults,
  startedAt,
  completedAt: new Date().toISOString(),
  durationMs: Date.now() - startedMs,
  exitCode: overallExitCode,
  status: overallExitCode === 0 ? 'PASS' : 'FAIL',
  sha: process.env.EXECUTIVE_SHA || process.env.GITHUB_SHA || 'local',
  runId: process.env.GITHUB_RUN_ID || 'local',
  totalCommands: commandResults.length,
  successfulCommands: successful,
  failedCommands: failed,
  totalErrors: errors.totalErrors,
  failureEvidence: evidence,
  outputTail: tail,
};

const serialized = `${JSON.stringify(result, null, 2)}\n`;
await writeFile(resultPath, serialized, 'utf8');
await writeFile(uniqueResultPath, serialized, 'utf8');

console.log(`\n[${jobId}] ${result.status} commands=${commandResults.length} failedCommands=${failed} errors=${errors.totalErrors}`);

// Never fail the workflow step itself: the aggregator is the final release verdict.
process.exit(0);
