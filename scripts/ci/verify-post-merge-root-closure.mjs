#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertCanonicalSymmetry, canonicalRefDigest, buildProvenanceClosure, validateProvenanceClosure } from './root-closure-contract.mjs';

const run = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', env: process.env }).trim();
const sha40 = /^[a-f0-9]{40}$/u;

const mainSha = run(['rev-parse', 'HEAD']);
const executionSha = run(['ls-remote', 'origin', 'refs/heads/execution']).split(/\s+/u)[0];
if (!sha40.test(mainSha) || !sha40.test(executionSha)) throw new Error('POST_MERGE_ROOT_CLOSURE_SHA_INVALID');

const mainContractDigest = canonicalRefDigest('HEAD');
const executionContractDigest = canonicalRefDigest('origin/execution');
assertCanonicalSymmetry({ mainSha, executionSha, mainContractDigest, executionContractDigest, branch: 'main' });

const runs = JSON.parse(gh(['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs?head_sha=${mainSha}&per_page=100`]));
const canonicalRuns = (runs.workflow_runs ?? [])
  .filter((run) => run.name === 'FLIXO Test System' && run.head_sha === mainSha && run.status === 'completed' && run.conclusion === 'success')
  .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
const canonicalRun = canonicalRuns[0];
if (!canonicalRun) throw new Error('POST_MERGE_CANONICAL_GREEN_RUN_MISSING');

const jobs = JSON.parse(gh(['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${canonicalRun.id}/jobs?per_page=100`]));
const certificationJob = (jobs.jobs ?? []).find((job) => job.name === 'Certification' && job.conclusion === 'success');
if (!certificationJob) throw new Error('POST_MERGE_CERTIFICATION_JOB_MISSING');

const certStep = (certificationJob.steps ?? []).find((step) => /Single certification engine/u.test(step.name) && step.conclusion === 'success')
  ?? (certificationJob.steps ?? []).find((step) => /Validate execution graph completeness/u.test(step.name) && step.conclusion === 'success');
if (!certStep) throw new Error('POST_MERGE_CERTIFICATION_STEP_MISSING');

const artifacts = JSON.parse(gh(['api', `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${canonicalRun.id}/artifacts?per_page=100`]));
const certArtifact = (artifacts.artifacts ?? []).find((artifact) => artifact.name === `flixo-certification-evidence-${canonicalRun.id}` && !artifact.expired);
if (!certArtifact) throw new Error('POST_MERGE_CERTIFICATION_ARTIFACT_MISSING');
const artifactDigest = String(certArtifact.digest ?? '').replace(/^sha256:/u, '');
if (!/^[a-f0-9]{64}$/u.test(artifactDigest)) throw new Error('POST_MERGE_CERTIFICATION_ARTIFACT_DIGEST_MISSING');

const prs = JSON.parse(gh(['pr','list','--repo',process.env.GITHUB_REPOSITORY,'--base','main','--state','merged','--limit','20','--json','number,headRefName,headRefOid,mergeCommit']));
const mergedPr = prs.find((pr) => pr.headRefName === 'execution' && pr.mergeCommit?.oid === mainSha);
const mergedFromSha = mergedPr?.headRefOid ?? mainSha;

const record = buildProvenanceClosure({
  assertionId: 'ASSERT-ROOT-CLOSURE-001',
  executionUnit: 'FLIXO Test System / Certification',
  runId: String(canonicalRun.id),
  jobId: String(certificationJob.id),
  stepId: String(certStep.name),
  exactSha: mainSha,
  artifactId: String(certArtifact.id),
  artifactDigest,
  rcaId: `RCA-NONE-EXACT-SHA-${mainSha}`,
  certificationId: `CERT-${canonicalRun.id}`,
  mergeCommitSha: mainSha,
  mergedFromSha,
});
validateProvenanceClosure(record, { requireMerge: true });

const output = process.env.ROOT_CLOSURE_OUTPUT || '/tmp/flixo-root-closure-provenance.json';
fs.writeFileSync(output, `${JSON.stringify({
  ...record,
  canonicalRunNumber: canonicalRun.run_number,
  certificationJobName: certificationJob.name,
  certificationStep: certStep.name,
  mainContractDigest,
  executionContractDigest,
  mergedPrNumber: mergedPr?.number ?? null,
}, null, 2)}\n`);
console.log(JSON.stringify({ status:'PASS', exactSha:mainSha, executionSha, mainContractDigest, certificationRunId:canonicalRun.id, artifactId:certArtifact.id, artifactDigest, mergedPrNumber:mergedPr?.number ?? null, output }, null, 2));
