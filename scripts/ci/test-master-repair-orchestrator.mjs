import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildMasterRepairPacket } from './master-repair-orchestrator.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-master-repair-'));
const write = (name, value) => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  return file;
};

const sha = 'a'.repeat(40);
const fp = 'b'.repeat(64);
const runId = '12345678901';
const files = {
  log: write('failure.log', 'ERROR internal contract failure\nEVIDENCE_CAPTURE=AVAILABLE\n'),
  diagnosis: write('diagnosis.json', {
    rootCause: 'internal-contract',
    trigger: 'required workflow failure',
    violatedInvariant: 'exact contract',
    location: { file: 'src/example.ts', line: 10 }
  }),
  scout: write('scout.json', { scannedSha: sha, classification: 'INTERNAL_CONTRACT', summary: 'exact target scout', findings: [{ id: 'F1', message: 'contract mismatch' }] }),
  strategy: write('strategy.json', {
    targetSha: sha,
    strategyId: 'prepared-source-change',
    proofObligations: ['EXACT_SHA'],
    exitCriteria: 'verified-repair-on-exact-target-sha-and-canonical-green',
    twin: { disposition: 'SELECTED' }
  }),
  rootProof: write('root-proof.json', {
    protocol: 'CAUSAL-EVIDENCE-GRAPH-v1',
    status: 'PROVEN',
    targetSha: sha,
    failureFingerprint: fp,
    sourceMutationAllowed: false,
    proofClaims: {
      ROOT_CAUSE_LINKED_TO_FAILURE_SIGNAL: true,
      LOCATION_LINKED_TO_CAUSE: true,
      MECHANISM_EXPLAINED: true,
      ALTERNATIVES_CHALLENGED: true
    }
  }),
  rca: write('rca.json', {
    protocol: 'FLIXO-IN-REPO-REPAIR-V2',
    target_sha: sha,
    root_cause_analysis: {
      alternative_hypotheses: [
        { id: 'H1', hypothesis: 'contract' },
        { id: 'H2', hypothesis: 'scope' },
        { id: 'H3', hypothesis: 'dependency' },
        { id: 'H4', hypothesis: 'workflow-ordering' },
        { id: 'H5', hypothesis: 'stale-memory' },
        { id: 'H6', hypothesis: 'coordination-drift' }
      ]
    },
    proposed_fix: { isolation_level: 'SURGICAL_PATCH', scope: { max_source_files: 1 } },
    evidence: { exact_sha: true }
  }),
  historical: write('historical.json', { protocol: 'HISTORICAL-LEARNING-v1', historicalMatchCount: 2 }),
  teaching: write('teaching.json', {
    protocol: 'SUPERVISING-REPAIR-TEACHING-v3',
    exactShaRequired: true,
    operatingRules: ['rule1', 'rule2'],
    closure: { result: 'OPEN_UNTIL_PROVEN' }
  }),
  memory: write('memory.json', {
    version: 10,
    cases: [{ rootCause: 'internal-contract' }],
    lessons: [{ id: 'L1', rootCause: 'internal-contract', confidence: 0.9 }],
    antiLessons: [],
    actionHistory: []
  })
};

process.env.FLIXO_REPAIR_MEMORY = files.memory;

const ready = await buildMasterRepairPacket({
  targetSha: sha,
  currentSha: sha,
  runId,
  fp,
  failureLogPath: files.log,
  diagnosisPath: files.diagnosis,
  scoutPath: files.scout,
  strategyPath: files.strategy,
  rootProofPath: files.rootProof,
  rcaManifestPath: files.rca,
  historicalLearningPath: files.historical,
  teachingPath: files.teaching,
  memoryPath: files.memory,
});

assert.equal(ready.protocol, 'FLIXO-MASTER-REPAIR-ORCHESTRATOR-v1');
assert.equal(ready.mutationAuthority, false);
assert.equal(ready.target.exactSha, true);
assert(ready.intelligence.hypotheses.length >= 6);
assert(ready.intelligence.falsification.length >= 10);
assert.equal(ready.decision.closureAuthority, 'CANONICAL_GREEN_AND_CERTIFICATION_ONLY');

const stale = await buildMasterRepairPacket({
  targetSha: sha,
  currentSha: 'c'.repeat(40),
  runId,
  fp,
  failureLogPath: files.log,
  diagnosisPath: files.diagnosis,
  scoutPath: files.scout,
  strategyPath: files.strategy,
  rootProofPath: files.rootProof,
  rcaManifestPath: files.rca,
  historicalLearningPath: files.historical,
  teachingPath: files.teaching,
  memoryPath: files.memory,
}).catch((error) => ({ error: String(error.message) }));
assert.match(stale.error ?? '', /MASTER_REPAIR_EXACT_SHA_MISMATCH/);

fs.rmSync(dir, { recursive: true, force: true });
console.log('MASTER_REPAIR_ORCHESTRATOR_TEST=PASS');
