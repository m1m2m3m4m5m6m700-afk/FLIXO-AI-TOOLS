#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const scoutPath = path.resolve(root, 'scripts/ci/code-read-only-scout.mjs');
const knowledgePath = path.resolve(root, 'docs/ci/investigation/HISTORICAL-KNOWLEDGE-BASE.json');
const reportContractPath = path.resolve(root, 'docs/ci/investigation/INVESTIGATION-REPORT-CONTRACT.json');
const text = fs.readFileSync(scoutPath, 'utf8');
const knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
const reportContract = JSON.parse(fs.readFileSync(reportContractPath, 'utf8'));

const required = [
  "authority: 'READ_ONLY_CODE_SCOUT'",
  "mode: 'READ_ONLY_ANALYSIS'",
  "mutationPolicy: 'NO_SOURCE_MUTATION'",
  'reportWriteScope: OUTPUT',
  'execFileSync',
  'Findings are evidence-backed hypotheses for execution agents',
  'HISTORICAL-KNOWLEDGE-BASE.json',
  'INVESTIGATION-REPORT-CONTRACT.json',
  'historicalMatches',
  'scannedSha',
];
for (const marker of required) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${marker}`);

// Validate the actual argv structure used by the scout instead of requiring
// one fragile literal source-text marker.
const usesGitLsFiles = /execFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]ls-files['"]\s*,\s*['"]-z['"]\s*\]/u.test(text);
if (!usesGitLsFiles) failures.push('GIT_TRACKED_FILE_DISCOVERY_CONTRACT_MISSING');

// The scout is permitted to write its investigation report only. Repository
// mutation commands and GitHub write APIs are forbidden in the scout source.
if (/git\s+add|git\s+commit|git\s+push|update_file|create_file|delete_file|update_ref/u.test(text)) failures.push('FORBIDDEN_MUTATION_OPERATION_DETECTED');
if (!text.includes('writeFileSync(OUTPUT')) failures.push('REPORT_OUTPUT_MISSING');
if (knowledge.readOnly !== true) failures.push('HISTORICAL_KNOWLEDGE_MUST_BE_READ_ONLY');
if (!Array.isArray(knowledge.sources) || knowledge.sources.length < 3) failures.push('HISTORICAL_KNOWLEDGE_SOURCE_SET_TOO_SMALL');
if (knowledge.authorityBoundary?.historicalKnowledgeIsAuthority !== false) failures.push('HISTORICAL_KNOWLEDGE_AUTHORITY_BOUNDARY_INVALID');
if (reportContract.exactShaRequired !== true) failures.push('REPORT_CONTRACT_MUST_REQUIRE_EXACT_SHA');
if (reportContract.decisionProtocol?.rule !== 'A report never authorizes a change.') failures.push('REPORT_DECISION_BOUNDARY_INVALID');

// Runtime proof that the committed repository supports the same read-only
// tracked-file discovery operation required by the scout.
try {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
  if (!tracked.includes('scripts/ci/code-read-only-scout.mjs')) failures.push('SCOUT_NOT_TRACKED_BY_GIT');
} catch (error) {
  failures.push(`GIT_TRACKED_FILE_DISCOVERY_FAILED=${error instanceof Error ? error.message : String(error)}`);
}

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 3,
  authority: 'READ_ONLY_CODE_SCOUT_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkedSha: sha,
  scout: 'scripts/ci/code-read-only-scout.mjs',
  historicalKnowledge: 'docs/ci/investigation/HISTORICAL-KNOWLEDGE-BASE.json',
  reportContract: 'docs/ci/investigation/INVESTIGATION-REPORT-CONTRACT.json',
  historicalSources: knowledge.sources.length,
  findings: failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/investigation'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/investigation/code-scout-contract.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
