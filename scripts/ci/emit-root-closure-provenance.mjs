#!/usr/bin/env node
import fs from 'node:fs';
import { buildProvenanceClosure, validateProvenanceClosure } from './root-closure-contract.mjs';

const required = [
  'ASSERTION_ID','EXECUTION_UNIT','RUN_ID','JOB_ID','STEP_ID','EXACT_SHA',
  'ARTIFACT_ID','ARTIFACT_DIGEST','RCA_ID','CERTIFICATION_ID','MERGE_COMMIT_SHA',
];
for (const name of required) {
  if (!String(process.env[name] ?? '').trim()) throw new Error(`ROOT_CLOSURE_PROVENANCE_ENV_MISSING=${name}`);
}

const record = buildProvenanceClosure({
  assertionId: process.env.ASSERTION_ID,
  executionUnit: process.env.EXECUTION_UNIT,
  runId: process.env.RUN_ID,
  jobId: process.env.JOB_ID,
  stepId: process.env.STEP_ID,
  exactSha: process.env.EXACT_SHA,
  artifactId: process.env.ARTIFACT_ID,
  artifactDigest: process.env.ARTIFACT_DIGEST,
  rcaId: process.env.RCA_ID,
  certificationId: process.env.CERTIFICATION_ID,
  mergeCommitSha: process.env.MERGE_COMMIT_SHA,
  mergedFromSha: process.env.MERGED_FROM_SHA || process.env.EXACT_SHA,
});
validateProvenanceClosure(record, { requireMerge: true });

const output = process.env.ROOT_CLOSURE_PROVENANCE_OUTPUT || '/tmp/flixo-root-closure-provenance.json';
fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify({
  status: 'PASS',
  protocol: record.protocol,
  exactSha: record.exactSha,
  mergeCommitSha: record.mergeCommitSha,
  chainHash: record.chainHash,
  output,
}, null, 2));
