#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const CHAIR1_REPAIR_MISSION = 'CHAIR1_PRIMARY_TEST_CYCLE_REPAIR';

const ROOT = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const sha = value => {
  const text = String(value ?? '').trim();
  if (!/^[a-f0-9]{40}$/.test(text)) throw new Error('CHAIR1_REPAIR_SHA_INVALID');
  return text;
};
const hash = value => createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
const git = args => execFileSync('git', ['-C', ROOT, ...args], {encoding:'utf8'}).trim();

export function buildChair1RepairMission({
  targetSha,
  previousSha,
  latestMainSha = null,
  failureFingerprint = null,
  failedWorkflow = null,
  changedPathsSincePrevious = [],
  changedPathsFromMain = [],
  failureObserved = true,
} = {}) {
  const target = sha(targetSha);
  const previous = previousSha ? sha(previousSha) : null;
  const main = latestMainSha ? sha(latestMainSha) : null;
  if (previous && previous === target) throw new Error('CHAIR1_REPAIR_PREVIOUS_SHA_EQUALS_TARGET');
  const fingerprint = failureFingerprint ? String(failureFingerprint).trim() : null;
  if (fingerprint && !/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('CHAIR1_REPAIR_FAILURE_FINGERPRINT_INVALID');

  return Object.freeze({
    schemaVersion: 1,
    protocol: 'FLIXO-CHAIR1-TEST-CYCLE-REPAIR-v1',
    mission: CHAIR1_REPAIR_MISSION,
    authority: 'CHAIR_1_PRIMARY_REPAIR',
    branch: 'execution',
    targetSha: target,
    previousSha: previous,
    latestMainSha: main,
    failureObserved: Boolean(failureObserved),
    failedWorkflow: failedWorkflow ? String(failedWorkflow) : null,
    failureFingerprint: fingerprint,
    comparison: {
      previousUpdate: { fromSha: previous, toSha: target, changedPaths: [...new Set(changedPathsSincePrevious.map(String))].sort() },
      latestCanonicalState: { fromSha: main, toSha: target, changedPaths: [...new Set(changedPathsFromMain.map(String))].sort() },
      requiredDecision: 'REVALIDATE_CURRENT_SHA_BEFORE_EVERY_MUTATION',
    },
    directRepairPolicy: {
      everyActionableRed: 'MUST_RECEIVE_ROOT_CAUSE_REPAIR_ATTEMPT',
      sourcePolicy: 'REPAIR_CAUSAL_SOURCE_ONLY',
      testPolicy: 'TESTS_ARE_EVIDENCE_NOT_REPAIR_TARGETS',
      stalePolicy: 'ABORT_ON_SHA_DRIFT',
      resumePolicy: 'TARGETED_RETEST_THEN_RESUME_REMAINING_REQUIRED_CHECKS',
      closurePolicy: 'CANONICAL_GREEN_ONLY',
    },
    stopConditions: ['CANONICAL_GREEN','STALE_SHA','PROOF_FAILED','BLOCKED_EXTERNAL'],
    noSelfDispatch: true,
    noMainMutation: true,
    generatedAt: new Date().toISOString(),
    missionFingerprint: hash(JSON.stringify({mission: CHAIR1_REPAIR_MISSION,targetSha:target,previousSha:previous,latestMainSha:main,failureFingerprint:fingerprint})),
  });
}

export function assertChair1RepairState({ mission, currentSha, branch = 'execution' } = {}) {
  if (!mission || mission.mission !== CHAIR1_REPAIR_MISSION) throw new Error('CHAIR1_REPAIR_MISSION_MISSING');
  if (branch !== 'execution') throw new Error('CHAIR1_REPAIR_BRANCH_BLOCKED');
  if (sha(currentSha) !== mission.targetSha) throw new Error('CHAIR1_REPAIR_STALE_TARGET_SHA');
  if (mission.noMainMutation !== true) throw new Error('CHAIR1_REPAIR_MAIN_MUTATION_POLICY_DRIFT');
  if (mission.noSelfDispatch !== true) throw new Error('CHAIR1_REPAIR_SELF_DISPATCH_POLICY_DRIFT');
  return true;
}

function names(refA, refB) {
  try {
    return git(['diff','--name-only',refA,refB]).split(/\r?\n/u).map(v=>v.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function resolveMainSha() {
  try { return sha(git(['rev-parse','origin/main'])); } catch { return null; }
}

function writeMission(file, mission) {
  fs.mkdirSync(new URL('.', `file://${file}`).pathname, {recursive:true});
  fs.writeFileSync(file, JSON.stringify(mission, null, 2) + '\n');
}

if (process.argv[1]?.endsWith('chair1-test-cycle-repair.mjs')) {
  const args = new Map();
  for (let i=2;i<process.argv.length;i+=1) {
    const token=process.argv[i];
    if(!token.startsWith('--')) continue;
    const eq=token.indexOf('=');
    const key=token.slice(2,eq>=0?eq:undefined);
    const value=eq>=0?token.slice(eq+1):(process.argv[i+1]??'');
    args.set(key,value);
  }
  const target = sha(args.get('target-sha') || git(['rev-parse','HEAD']));
  const previous = (() => { try { return sha(args.get('previous-sha') || git(['rev-parse',`${target}^`])); } catch { return null; } })();
  const main = args.get('main-sha') ? sha(args.get('main-sha')) : resolveMainSha();
  const workflow = String(args.get('workflow') || process.env.FLIXO_FAILED_WORKFLOW || '').trim() || null;
  const failureFingerprint = String(args.get('failure-fingerprint') || process.env.FLIXO_FAILURE_FINGERPRINT || '').trim() || null;
  const failureLog = String(process.env.FLIXO_FAILURE_LOG || '').trim();
  const failureObserved = Boolean(workflow || failureFingerprint || (failureLog && fs.existsSync(failureLog) && fs.statSync(failureLog).size > 0));
  const mission = buildChair1RepairMission({
    targetSha: target,
    previousSha: previous,
    latestMainSha: main,
    failureFingerprint,
    failedWorkflow: workflow,
    changedPathsSincePrevious: previous ? names(previous,target) : [],
    changedPathsFromMain: main && main!==target ? names(main,target) : [],
    failureObserved,
  });
  assertChair1RepairState({mission,currentSha:git(['rev-parse','HEAD']),branch:git(['branch','--show-current'])});
  const output = args.get('write') || process.env.FLIXO_CHAIR1_MISSION_PATH || '/tmp/flixo-chair1-repair-mission.json';
  writeMission(output, mission);
  console.log(JSON.stringify(mission,null,2));
  console.log(`CHAIR1_REPAIR_MISSION=${mission.mission}`);
  console.log(`CHAIR1_REPAIR_TARGET_SHA=${mission.targetSha}`);
  console.log(`CHAIR1_REPAIR_PREVIOUS_SHA=${mission.previousSha ?? 'unknown'}`);
  console.log(`CHAIR1_REPAIR_MAIN_SHA=${mission.latestMainSha ?? 'unknown'}`);
  console.log(`CHAIR1_REPAIR_FAILURE_OBSERVED=${mission.failureObserved}`);
}
