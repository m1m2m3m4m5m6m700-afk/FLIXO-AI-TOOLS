#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const expectedSha = String(process.env.EXPECTED_SHA ?? '').trim();
const hash = async (file) => createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
if (!/^[0-9a-f]{40}$/u.test(expectedSha)) throw new Error('RUN_PROOF_EXPECTED_SHA_INVALID');
const proof = JSON.parse(await readFile(resolve(root, 'dist/__flixo/run-proof.json'), 'utf8'));
const build = JSON.parse(await readFile(resolve(root, 'dist/__flixo/build-identity.json'), 'utf8'));
const definitionFiles = ['.github/workflows/ci.yml','scripts/ci/test-plan.json','scripts/ci/assertion-registry.json','package.json','package-lock.json','.nvmrc','playwright.config.ts'];
const parts = [];
for (const file of definitionFiles) parts.push(file + ':' + await hash(file));
const testDefinitionSha256 = createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex');
if (proof.executionSha !== expectedSha) throw new Error('RUN_PROOF_EXECUTION_SHA_MISMATCH');
if (build.commitSha !== expectedSha) throw new Error('RUN_PROOF_BUILD_SHA_MISMATCH');
if (proof.testDefinitionSha256 !== testDefinitionSha256) throw new Error('RUN_PROOF_TEST_DEFINITION_MISMATCH');
if (proof.workflowSha256 !== await hash('.github/workflows/ci.yml')) throw new Error('RUN_PROOF_WORKFLOW_MISMATCH');
if (proof.packageLockSha256 !== await hash('package-lock.json')) throw new Error('RUN_PROOF_PACKAGE_LOCK_MISMATCH');
if (!/^[0-9a-f]{64}$/u.test(String(build.artifactHash ?? ''))) throw new Error('RUN_PROOF_ARTIFACT_HASH_MISSING');
console.log('RUN_PROOF_VERIFIED=1');
console.log('EXECUTION_SHA=' + expectedSha);
console.log('TEST_DEFINITION_SHA=' + testDefinitionSha256);
console.log('ARTIFACT_HASH=' + build.artifactHash);
console.log('RUN_ID=' + String(proof.runId));
console.log('RUN_ATTEMPT=' + String(proof.runAttempt));
