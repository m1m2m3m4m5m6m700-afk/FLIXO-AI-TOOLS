#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const sha256 = async (file) => createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const executionSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expectedSha = String(process.env.EXPECTED_SHA ?? '').trim();
if (!/^[0-9a-f]{40}$/u.test(executionSha) || executionSha !== expectedSha) throw new Error('RUN_PROOF_EXECUTION_SHA_MISMATCH');
const identity = JSON.parse(await readFile(resolve(root, 'diagnostics/certification/run-identity.json'), 'utf8'));
if (identity.sha !== executionSha) throw new Error('RUN_PROOF_IDENTITY_SHA_MISMATCH');
const files = Array.isArray(identity.testDefinitionFiles) ? identity.testDefinitionFiles : [];
const definitionParts = [];
for (const file of files) definitionParts.push(file + ':' + await sha256(file));
const testDefinitionSha256 = createHash('sha256').update(definitionParts.join('\n'), 'utf8').digest('hex');
if (testDefinitionSha256 !== identity.testDefinitionSha256) throw new Error('RUN_PROOF_TEST_DEFINITION_MISMATCH');

const proof = {
  schemaVersion: 1,
  protocol: 'FLIXO-LATEST-COMMIT-RUN-PROOF-v1',
  runId: String(process.env.GITHUB_RUN_ID ?? identity.runId ?? ''),
  runAttempt: String(process.env.GITHUB_RUN_ATTEMPT ?? identity.runAttempt ?? ''),
  executionSha,
  testDefinitionSha256,
  workflowSha256: identity.workflowSha256,
  packageLockSha256: identity.packageLockSha256,
  producer: 'scripts/ci/create-run-proof.mjs',
  createdAt: new Date().toISOString(),
};
if (!proof.runId || !proof.runAttempt) throw new Error('RUN_PROOF_RUN_IDENTITY_MISSING');
await mkdir(resolve(root, 'dist/__flixo'), { recursive: true });
await writeFile(resolve(root, 'dist/__flixo/run-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof, null, 2));
