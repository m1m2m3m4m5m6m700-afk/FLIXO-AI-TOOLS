#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.FLIXO_TARGET_DIR ?? process.cwd();
const STATE_DIR = process.env.FLIXO_ADVERSARIAL_CONVERGENCE_DIR ?? '/tmp/flixo-adversarial-convergence';
const STATE_PATH = process.env.FLIXO_ADVERSARIAL_CONVERGENCE_STATE_PATH ?? path.join(STATE_DIR, 'convergence.json');
const TARGET_SHA = String(process.env.FLIXO_EXPECTED_TARGET_SHA ?? process.env.FLIXO_TARGET_SHA ?? '').trim();
const FINGERPRINT = String(process.env.FLIXO_FAILURE_FINGERPRINT ?? '').trim();
const RUN_ID = String(process.env.TARGET_RUN_ID ?? '').trim();
const BASE_ATTEMPT = Math.max(1, Number(process.env.FLIXO_REPAIR_ATTEMPT ?? 1) || 1);
const MAX_ROUNDS = Math.max(0, Number(process.env.FLIXO_ADVERSARIAL_MAX_ROUNDS ?? 0) || 0);
const ENGINE = process.env.FLIXO_REPAIR_ENGINE_PATH ?? '/tmp/flixo-repair-controller/scripts/ci/auto-repair-engine.mjs';
const STRATEGY_ENGINE = process.env.FLIXO_REPAIR_STRATEGY_ENGINE_PATH ?? '/tmp/flixo-repair-controller/scripts/ci/repair-strategy.mjs';
const FILE_SELECTION = process.env.FLIXO_FILE_SELECTION_PATH ?? '/tmp/action-file-selection-decision.json';
const DIAGNOSIS = process.env.FLIXO_REPAIR_DIAGNOSIS_PATH ?? '/tmp/flixo-root-cause.json';
const TWIN_SCRIPT = path.join(ROOT, 'scripts/ci/action-repair-programmer-twin.mjs');
const SHA_RE = /^[a-f0-9]{40}$/u;
const STRATEGIES = new Set([
  'reproduce-exact',
  'minimize-failure',
  'diff-forensics',
  'environment-audit',
  'workflow-forensics',
  'observability-trace',
  'historical-analogy',
  'synthetic-reproduction',
  'alternate-hypothesis',
  'supervising-escalation',
]);

const now = () => new Date().toISOString();
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const git = (args) => {
  const result = spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || 'GIT_COMMAND_FAILED').trim());
  }
  return String(result.stdout).trim();
};
const sha256File = (file) => {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
};

export function decideAdversarialRound({
  engineEvidence,
  adversarialReport,
  targetSha,
  currentSha,
  adversaryExit = 0,
} = {}) {
  if (!SHA_RE.test(String(targetSha ?? '')) || currentSha !== targetSha) {
    return Object.freeze({
      decision: 'BLOCK_STALE_SHA',
      bothSidesStable: false,
      primaryMayRevise: false,
      requiresRollback: false,
      reason: 'CURRENT_HEAD_MUST_EQUAL_THE_EXACT_REPAIR_TARGET_SHA',
    });
  }
  if (engineEvidence?.outcome !== 'verified-repair') {
    return Object.freeze({
      decision: 'REPAIR_ENGINE_BLOCKED',
      bothSidesStable: false,
      primaryMayRevise: false,
      requiresRollback: false,
      reason: 'PRIMARY_REPAIR_DID_NOT_PROVE_A_VERIFIED_CANDIDATE',
    });
  }
  if (!Array.isArray(engineEvidence?.changedPaths) || engineEvidence.changedPaths.length < 1) {
    return Object.freeze({
      decision: 'REPAIR_ENGINE_BLOCKED',
      bothSidesStable: false,
      primaryMayRevise: false,
      requiresRollback: false,
      reason: 'VERIFIED_REPAIR_MUST_PRODUCE_A_TRACKED_SOURCE_DIFF',
    });
  }
  if (adversarialReport?.status === 'COUNTEREXAMPLE_FOUND' || adversarialReport?.counterexampleFound === true) {
    return Object.freeze({
      decision: 'REPAIR_REQUIRED',
      bothSidesStable: false,
      primaryMayRevise: true,
      requiresRollback: true,
      reason: 'ADVERSARY_FOUND_VALID_COUNTEREXAMPLE',
      nextStrategy: STRATEGIES.has(String(adversarialReport?.challenge?.preferredAlternativeStrategy ?? ''))
        ? String(adversarialReport.challenge.preferredAlternativeStrategy)
        : null,
      counterexample: adversarialReport?.falsificationSearches?.filter((item) => item?.counterexampleStatus === 'COUNTEREXAMPLE_FOUND') ?? [],
    });
  }
  if (adversaryExit !== 0
      || adversarialReport?.status !== 'FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE'
      || adversarialReport?.falsificationComplete !== true
      || adversarialReport?.counterexampleFound !== false
      || !Array.isArray(adversarialReport?.falsificationSearches)
      || adversarialReport.falsificationSearches.length < 10
      || (Array.isArray(adversarialReport?.remainingRisks) && adversarialReport.remainingRisks.length > 0)) {
    return Object.freeze({
      decision: 'REPAIR_REQUIRED',
      bothSidesStable: false,
      primaryMayRevise: true,
      requiresRollback: true,
      reason: 'ADVERSARIAL_FALSIFICATION_INCOMPLETE',
      nextStrategy: null,
    });
  }

  const primaryStable =
    engineEvidence?.selfCritic?.ok === true
    && engineEvidence?.causalProof?.ok === true
    && engineEvidence?.repairProof?.ok === true
    && engineEvidence?.targetSha === targetSha
    && !engineEvidence?.changedPaths?.some((file) => /(?:^|[/\\])(?:tests?|__tests__)(?:[/\\]|$)/u.test(file));

  return Object.freeze({
    decision: primaryStable ? 'CONVERGED_FOR_VERIFICATION' : 'REPAIR_REQUIRED',
    bothSidesStable: primaryStable,
    primaryMayRevise: !primaryStable,
    requiresRollback: !primaryStable,
    reason: primaryStable
      ? 'PRIMARY_PROOF_AND_ADVERSARIAL_FALSIFICATION_CONVERGED'
      : 'PRIMARY_PROOF_REMAINS_INCOMPLETE_AFTER_ADVERSARIAL_FALSIFICATION',
    nextStrategy: null,
    counterexample: [],
  });
}

function executeNode(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function ensureIdentity(baseSha) {
  const branch = git(['branch', '--show-current']);
  if (branch !== 'execution') throw new Error('ADVERSARIAL_CONVERGENCE_BRANCH_INVALID');
  if (!SHA_RE.test(baseSha)) throw new Error('ADVERSARIAL_CONVERGENCE_TARGET_SHA_INVALID');
  const current = git(['rev-parse', 'HEAD']);
  if (current !== baseSha) throw new Error('ADVERSARIAL_CONVERGENCE_HEAD_MISMATCH');
  if (git(['status', '--porcelain'])) throw new Error('ADVERSARIAL_CONVERGENCE_DIRTY_START');
  if (!FINGERPRINT) throw new Error('ADVERSARIAL_CONVERGENCE_FINGERPRINT_REQUIRED');
  return current;
}

function rollbackToBase(baseSha) {
  git(['reset', '--hard', baseSha]);
  const current = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain']);
  if (current !== baseSha) throw new Error('ADVERSARIAL_CONVERGENCE_ROLLBACK_SHA_MISMATCH');
  if (dirty) throw new Error('ADVERSARIAL_CONVERGENCE_ROLLBACK_LEFT_DIRTY_TREE');
}

function main() {
  fs.rmSync(STATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(STATE_DIR, { recursive: true });

  const baseSha = TARGET_SHA || git(['rev-parse', 'HEAD']);
  ensureIdentity(baseSha);

  if (!fs.existsSync(ENGINE)) throw new Error('ADVERSARIAL_CONVERGENCE_REPAIR_ENGINE_MISSING');
  if (!fs.existsSync(STRATEGY_ENGINE)) throw new Error('ADVERSARIAL_CONVERGENCE_REPAIR_STRATEGY_MISSING');
  if (!fs.existsSync(TWIN_SCRIPT)) throw new Error('ADVERSARIAL_CONVERGENCE_PROGRAMMER_TWIN_MISSING');
  if (!fs.existsSync(FILE_SELECTION)) throw new Error('ADVERSARIAL_CONVERGENCE_FILE_SELECTION_MISSING');
  if (!fs.existsSync(DIAGNOSIS)) throw new Error('ADVERSARIAL_CONVERGENCE_DIAGNOSIS_MISSING');

  const state = {
    protocol: 'FLIXO-ADVERSARIAL-REPAIR-CONVERGENCE-v1',
    status: 'ACTIVE',
    targetSha: baseSha,
    failureFingerprint: FINGERPRINT,
    failedRunId: RUN_ID || null,
    baseAttempt: BASE_ATTEMPT,
    roundLimit: MAX_ROUNDS || 'EXTERNAL_WORKFLOW_BOUND',
    primaryAgent: 'ACTION-REPAIR',
    adversaryAgent: 'ACTION-REPAIR-2',
    adversaryMutationAuthority: false,
    primaryRevisionAuthority: true,
    acceptanceAuthority: 'CURRENT_EXACT_SHA_VERIFICATION_THEN_CANONICAL_GREEN',
    rules: {
      counterexampleInvalidatesCurrentCandidate: true,
      primaryMayReviseAfterCounterexample: true,
      adversaryMayNotMutateSource: true,
      resetToSameExactShaBeforeRevision: true,
      noThirdBranch: true,
      noTestMutation: true,
      noMainMutation: true,
      noBlindRepeat: true,
      closureOnlyAfterBothSidesStable: true,
    },
    rounds: [],
    decision: null,
    bothSidesStable: false,
    updatedAt: now(),
  };

  for (let round = 1; MAX_ROUNDS === 0 || round <= MAX_ROUNDS; round += 1) {
    const currentSha = git(['rev-parse', 'HEAD']);
    if (currentSha !== baseSha) throw new Error('ADVERSARIAL_CONVERGENCE_SHA_DRIFT_BEFORE_ROUND');
    if (git(['status', '--porcelain'])) throw new Error('ADVERSARIAL_CONVERGENCE_DIRTY_BEFORE_ROUND');

    const roundDir = path.join(STATE_DIR, `round-${round}`);
    fs.mkdirSync(roundDir, { recursive: true });
    const selectionPath = path.join(STATE_DIR, 'next-selection.json');
    const twinProposalPath = path.join(STATE_DIR, 'twin-proposal.json');
    const nextEnv = {
      ...process.env,
      FLIXO_EXPECTED_TARGET_SHA: baseSha,
      FLIXO_FAILURE_FINGERPRINT: FINGERPRINT,
      TARGET_RUN_ID: RUN_ID,
      FLIXO_REPAIR_ATTEMPT: String(BASE_ATTEMPT + round - 1),
      FLIXO_REPAIR_ACTOR: 'actionRepairBot',
      FLIXO_AUTO_REPAIR_CONTEXT: 'true',
      FLIXO_TARGET_DIR: ROOT,
      FLIXO_FILE_SELECTION_PATH: FILE_SELECTION,
      FLIXO_REPAIR_DIAGNOSIS_PATH: DIAGNOSIS,
      FLIXO_TWIN_PROPOSAL_PATH: round > 1 && fs.existsSync(twinProposalPath) ? twinProposalPath : '',
      FLIXO_SELECTION_PATH: round > 1 && fs.existsSync(selectionPath) ? selectionPath : '',
    };

    const strategyExit = executeNode(STRATEGY_ENGINE, [], {
      ...nextEnv,
      FLIXO_REPAIR_STRATEGY_PATH: '/tmp/flixo-repair-strategy.json',
    });
    if (strategyExit !== 0 || !fs.existsSync('/tmp/flixo-repair-strategy.json')) {
      state.rounds.push({ round, strategyExit, decision: 'REPAIR_ENGINE_BLOCKED', reason: 'REPAIR_STRATEGY_REFRESH_FAILED', at: now() });
      state.status = 'BLOCKED';
      state.decision = 'REPAIR_ENGINE_BLOCKED';
      state.updatedAt = now();
      writeJson(STATE_PATH, state);
      process.exitCode = 1;
      return;
    }
    const strategy = readJson('/tmp/flixo-repair-strategy.json');
    const selectedStrategy = String(strategy?.strategyId ?? '').trim();
    const engineExit = executeNode(ENGINE, [], {
      ...nextEnv,
      FLIXO_REPAIR_STRATEGY: selectedStrategy ? `${selectedStrategy}::${strategy.strategy ?? ''}` : '',
    });
    const evidencePath = '/tmp/flixo-repair-evidence.json';
    if (!fs.existsSync(evidencePath)) {
      state.rounds.push({ round, engineExit, decision: 'REPAIR_ENGINE_BLOCKED', reason: 'EVIDENCE_MISSING', at: now() });
      state.status = 'BLOCKED';
      state.decision = 'REPAIR_ENGINE_BLOCKED';
      state.updatedAt = now();
      writeJson(STATE_PATH, state);
      process.exitCode = 1;
      return;
    }

    const evidence = readJson(evidencePath);
    writeJson(path.join(roundDir, 'repair-evidence.json'), evidence);
    if (engineExit !== 0 || evidence.outcome !== 'verified-repair') {
      state.rounds.push({
        round,
        engineExit,
        engineOutcome: evidence.outcome ?? 'unknown',
        decision: 'REPAIR_ENGINE_BLOCKED',
        at: now(),
      });
      state.status = 'BLOCKED';
      state.decision = 'REPAIR_ENGINE_BLOCKED';
      state.updatedAt = now();
      writeJson(STATE_PATH, state);
      process.exitCode = 1;
      return;
    }

    const diffPath = path.join(roundDir, 'candidate.patch');
    const diff = spawnSync('git', ['-C', ROOT, 'diff', '--binary'], { encoding: 'utf8' });
    if (diff.status !== 0) throw new Error('ADVERSARIAL_CONVERGENCE_DIFF_CAPTURE_FAILED');
    fs.writeFileSync(diffPath, String(diff.stdout ?? ''), 'utf8');
    const changedPaths = git(['diff', '--name-only']).split(/\r?\n/u).filter(Boolean);
    writeJson(path.join(roundDir, 'changed-paths.json'), changedPaths);

    const twinReportPath = path.join(roundDir, 'programmer-twin.json');
    const twinEnv = {
      ...process.env,
      TARGET_RUN_ID: RUN_ID,
      FLIXO_EXPECTED_TARGET_SHA: baseSha,
      FLIXO_FAILURE_FINGERPRINT: FINGERPRINT,
    };
    const twinExit = executeNode(TWIN_SCRIPT, [
      `--output=${twinReportPath}`,
      `--sha=${baseSha}`,
      `--fingerprint=${FINGERPRINT}`,
      `--run-id=${RUN_ID}`,
      `--log=${process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log'}`,
      `--file-selection=${FILE_SELECTION}`,
      `--diagnosis=${DIAGNOSIS}`,
      `--diff=${diffPath}`,
    ], twinEnv);

    if (!fs.existsSync(twinReportPath)) {
      state.rounds.push({ round, engineExit, twinExit, decision: 'REPAIR_REQUIRED', reason: 'ADVERSARIAL_REPORT_MISSING', at: now() });
      state.status = 'BLOCKED';
      state.decision = 'ADVERSARIAL_REPORT_MISSING';
      state.updatedAt = now();
      writeJson(STATE_PATH, state);
      process.exitCode = 1;
      return;
    }

    const adversarialReport = readJson(twinReportPath);
    const decision = decideAdversarialRound({
      engineEvidence: evidence,
      adversarialReport,
      adversaryExit: twinExit,
      targetSha: baseSha,
      currentSha: git(['rev-parse', 'HEAD']),
    });

    const roundRecord = {
      round,
      attempt: BASE_ATTEMPT + round - 1,
      strategyExit,
      selectedStrategy,
      engineExit,
      engineOutcome: evidence.outcome,
      targetSha: baseSha,
      changedPaths,
      adversary: {
        exit: twinExit,
        status: adversarialReport.status,
        counterexampleFound: adversarialReport.counterexampleFound === true,
        reportPath: twinReportPath,
      },
      decision,
      patch: {
        path: diffPath,
      },
      at: now(),
    };
    state.rounds.push(roundRecord);
    state.updatedAt = now();

    if (decision.decision === 'CONVERGED_FOR_VERIFICATION') {
      state.status = 'CONVERGED_FOR_VERIFICATION';
      state.decision = decision.decision;
      state.bothSidesStable = true;
      writeJson(STATE_PATH, state);
      return;
    }

    if (!decision.requiresRollback) {
      state.status = 'BLOCKED';
      state.decision = decision.decision;
      writeJson(STATE_PATH, state);
      process.exitCode = 1;
      return;
    }

    writeJson(twinProposalPath, adversarialReport);
    if (decision.nextStrategy) {
      writeJson(selectionPath, {
        protocol: 'FLIXO-ADVERSARIAL-CONVERGENCE-SELECTION-v1',
        targetSha: baseSha,
        failureFingerprint: FINGERPRINT,
        selection: {
          selected: true,
          disposition: 'SELECTED',
          selectedStrategy: decision.nextStrategy,
          ranked: [decision.nextStrategy],
          reason: 'ADVERSARY_COUNTEREXAMPLE_REQUIRED_PRIMARY_REVISION',
        },
      });
    } else {
      fs.rmSync(selectionPath, { force: true });
    }

    rollbackToBase(baseSha);
    state.updatedAt = now();
    state.lastRevisionDirective = {
      owner: 'ACTION-REPAIR',
      reason: decision.reason,
      nextStrategy: decision.nextStrategy ?? null,
      sourceRound: round,
      sourceArtifact: twinReportPath,
    };
    writeJson(STATE_PATH, state);
  }

  state.status = 'CONVERGENCE_LIMIT_REACHED';
  state.decision = 'CONVERGENCE_LIMIT_REACHED';
  state.bothSidesStable = false;
  state.updatedAt = now();
  writeJson(STATE_PATH, state);
  process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main();
