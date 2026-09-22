#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=(p)=>fs.readFileSync(p,'utf8');
const chair=read('scripts/ci/chair-bound-execution.mjs');
const gate=read('scripts/ci/execution-mutation-gate.mjs');
const central=read('scripts/ci/central-chair-lease.mjs');
const daily=read('.github/workflows/daily-flixo-green-gate.yml');
const auto=read('.github/workflows/auto-repair.yml');
const sync=read('.github/workflows/execution-sync.yml');
const history=read('.github/workflows/historical-action-error-index.yml');
const migration=read('supabase/migrations/20260922210000_central_chair1_lease_strictness.sql');
const proofMigration=read('supabase/migrations/20260922220000_central_chair1_proof_binding.sql');

assert.match(central,/flix_chair1_(delegate|verify|heartbeat|release)/g);
assert.match(gate,/central-chair-lease\.mjs/);
assert.match(gate,/MUTATION_GATE_CENTRAL_CHAIR_CONTEXT_MISSING/);
assert.doesNotMatch(gate,/FLIXO_ALLOW_TEST_CHAIR_BYPASS/);
assert.match(chair,/verifyCentralChairForMutation/);
assert.match(chair,/CENTRAL_CHAIR_REQUIRED_FOR_MUTATION/);
assert.match(chair,/CENTRAL_CHAIR_TEST_TRANSPORT_FORBIDDEN/u);
assert.match(chair,/CENTRAL_CHAIR_TEST_VERIFY_REQUIRED/u);
assert.match(chair,/configureCentralChairTestTransport/);
assert.match(chair,/CENTRAL_CHAIR_PROOF_INVALID/);
assert.match(chair,/delegatedBy/);
assert.doesNotMatch(chair,/function verifyCentralChairForMutation\([^\n]+\)\{\n\s*if\(agentId===CHAIR1_OWNER_AGENT\) return;/u);
assert.doesNotMatch(chair,/function releaseCentralChair\([^\n]+\)\{\n\s*if\(agentId===CHAIR1_OWNER_AGENT\) return null;/u);
assert.match(chair,/releaseCentralChair/);
assert.doesNotMatch(chair,/process\.env\.CI === 'true' \|\| process\.env\.GITHUB_ACTIONS === 'true'/u);

// Production-mode adversarial regression: environment flags cannot disable Central Chair-1 custody.
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-chair-production-strict-'));
fs.mkdirSync(path.join(probeRoot, 'scripts', 'ci'), { recursive: true });
fs.copyFileSync('scripts/ci/chair-bound-execution.mjs', path.join(probeRoot, 'scripts', 'ci', 'chair-bound-execution.mjs'));
fs.writeFileSync(path.join(probeRoot, 'scripts', 'ci', 'central-chair-lease.mjs'), 'process.exit(1);\n');
execFileSync('git', ['init', '-q'], { cwd: probeRoot, encoding: 'utf8' });
execFileSync('git', ['config', 'user.email', 'flixo-test@example.invalid'], { cwd: probeRoot, encoding: 'utf8' });
execFileSync('git', ['config', 'user.name', 'FLIXO Strict Chair Test'], { cwd: probeRoot, encoding: 'utf8' });
fs.writeFileSync(path.join(probeRoot, 'README.md'), 'probe\n');
fs.mkdirSync(path.join(probeRoot, '.flixo', 'locks'), { recursive: true });
execFileSync('git', ['add', '.'], { cwd: probeRoot, encoding: 'utf8' });
execFileSync('git', ['commit', '-q', '-m', 'probe'], { cwd: probeRoot, encoding: 'utf8' });
const probeSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: probeRoot, encoding: 'utf8' }).trim();
const probeState = {
  schemaVersion: 1,
  authority: 'FLIXO_CHAIR_BOUND_EXECUTION',
  repository_state: 'IDLE',
  idle_timestamp: new Date().toISOString(),
  target_sha: probeSha,
  chairs: {
    chair_1: { holder_agent_id: null, status: 'VACANT', permissions: [] },
    chair_2: { holder_agent_id: null, status: 'VACANT', permissions: [] },
    chair_3: { holder_agent_id: null, status: 'VACANT', permissions: [] }
  }
};
const probeStatePath = path.join(probeRoot, '.flixo', 'locks', 'chairs.json');
fs.writeFileSync(probeStatePath, JSON.stringify(probeState, null, 2) + '\n');
const probe = spawnSync(
  process.execPath,
  ['--experimental-strip-types', 'scripts/ci/chair-bound-execution.mjs', 'acquire',
    '--chair=chair_1', '--agent=EVIL_REPAIR_BOT', '--sha=' + probeSha,
    '--repository-state=IDLE', '--task-id=STRICT-PROBE-TASK', '--work-package=STRICT-PROBE-WP'],
  {
    cwd: probeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CI: 'false',
      GITHUB_ACTIONS: 'false',
      FLIXO_STRICT_CHAIR: 'false',
      FLIXO_CHAIR_SIGNING_KEY: 'probe-key',
      FLIXO_CHAIR_STATE_PATH: probeStatePath
    }
  }
);
assert.notEqual(probe.status, 0);
assert.match(String(probe.stderr) + String(probe.stdout), /CENTRAL_CHAIR_REQUIRED_FOR_MUTATION/u);
console.log('LOCAL_PRODUCTION_CHAIR_BYPASS=BLOCKED');

// Production-mode owner-identity spoof regression: naming the caller assistantController is not authentication.
const ownerSpoof = spawnSync(
  process.execPath,
  ['--experimental-strip-types', 'scripts/ci/chair-bound-execution.mjs', 'acquire',
    '--chair=chair_1', '--agent=assistantController', '--sha=' + probeSha,
    '--repository-state=IDLE', '--task-id=OWNER-SPOOF-TASK', '--work-package=OWNER-SPOOF-WP'],
  {
    cwd: probeRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      CI: 'false',
      GITHUB_ACTIONS: 'false',
      FLIXO_STRICT_CHAIR: 'false',
      FLIXO_CHAIR_SIGNING_KEY: 'probe-key',
      FLIXO_CHAIR_STATE_PATH: probeStatePath,
      FLIXO_CHAIR_LEASE_ID: '',
      FLIXO_CHAIR_FENCING_HASH: '',
      FLIXO_CHAIR_AGENT: ''
    }
  }
);
assert.notEqual(ownerSpoof.status, 0);
assert.match(String(ownerSpoof.stderr) + String(ownerSpoof.stdout), /CENTRAL_CHAIR_REQUIRED_FOR_MUTATION/u);
console.log('LOCAL_CONTROLLER_IDENTITY_SPOOF=BLOCKED');

assert.match(chair,/takeChair1[\s\S]*verifyCentralChairForMutation/);
assert.match(chair,/authorizePublication[\s\S]*verifyCentralChairForMutation/);
assert.match(chair,/release\([\s\S]*releaseCentralChair/);
assert.match(daily,/SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
assert.match(daily,/central-chair-lease\.mjs delegate/);
assert.match(daily,/inputs\[central_chair_lease_id\]/);
assert.match(daily,/inputs\[central_chair_fencing_hash\]/);
assert.match(auto,/central_chair_lease_id:/);
assert.match(auto,/central_chair_fencing_hash:/);
assert.match(auto,/FLIXO_STRICT_CHAIR: 'true'/);
assert.match(auto,/central-chair-lease\.mjs verify/);
assert.doesNotMatch(sync,new RegExp(['git','push','origin','execution'].join(' ')));

const workers=read('scripts/ci/action-repair-five-workers.mjs');
assert.doesNotMatch(workers,/git\\s+push\\s+origin\\s+execution/u);
assert.match(workers,/ACTION-REPAIR/);
assert.match(workers,/ACTION-INDEX/);
assert.match(workers,/ACTION-WISE/);
assert.match(workers,/ACTION-HISTORIAN-3/);
assert.doesNotMatch(history,new RegExp(['git','push','origin','execution'].join(' ')));
assert.match(sync,/CHAIR_GUARD_BLOCKED: Execution Sync is proposal-only/);
assert.match(history,/CHAIR_GUARD_BLOCKED: Historical index may not publish directly to execution/);
assert.match(migration,/create or replace function public\.flix_chair1_delegate/);
assert.match(migration,/create or replace function public\.flix_chair1_verify/);
assert.match(migration,/create or replace function public\.flix_chair1_heartbeat/);
assert.match(migration,/create or replace function public\.flix_chair1_release/);
assert.match(migration,/delegated_by='assistantController'/);
assert.match(proofMigration,/delegated_by<>'assistantController'/);
assert.match(proofMigration,/delegatedBy',r\.delegated_by/);
assert.match(proofMigration,/flix_chair1_delegated_by_ck/);
console.log('STRICT_CHAIR_BOUNDARY=PASS');
