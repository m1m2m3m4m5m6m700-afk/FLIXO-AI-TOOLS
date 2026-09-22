#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  initialize,
  acquire,
  authorizeWrite,
  authorizePublication,
  release,
  configureCentralChairTestTransport,
} from './chair-bound-execution.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-chair1-adversarial-'));
process.env.FLIXO_CHAIR_STATE_PATH = path.join(root, 'locks', 'chairs.json');
process.env.FLIXO_CHAIR_SIGNING_KEY = 'chair1-adversarial-signing-key';
process.env.NODE_ENV = 'test';
process.env.FLIXO_STRICT_CHAIR = 'false';
process.env.FLIXO_CHAIR_LEASE_ID = '123e4567-e89b-12d3-a456-426614174000';
process.env.FLIXO_CHAIR_FENCING_HASH = 'c'.repeat(64);
process.env.FLIXO_CHAIR_AGENT = 'AUTO_REPAIR_BOT';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
initialize({ targetSha: sha });
const canonical = {
  holderAgentId: 'AUTO_REPAIR_BOT',
  taskId: 'TASK-CHAIR1-CANONICAL',
  workPackageId: 'WP-CHAIR1-CANONICAL',
  exactSha: sha,
  leaseId: process.env.FLIXO_CHAIR_LEASE_ID,
  fencingTokenHash: process.env.FLIXO_CHAIR_FENCING_HASH,
};

let forgedProof = false;
let replayProof = false;
configureCentralChairTestTransport({
  verify: (args) => {
    if (forgedProof) {
      return {
        authorized: true,
        ownerAgentId: 'assistantController',
        holderAgentId: canonical.holderAgentId,
        taskId: canonical.taskId,
        workPackageId: canonical.workPackageId,
        exactSha: canonical.exactSha,
        leaseId: canonical.leaseId,
        fencingTokenHash: canonical.fencingTokenHash,
        delegatedBy: 'forged-agent',
      };
    }
    if (replayProof) {
      return {
        authorized: true,
        ownerAgentId: 'assistantController',
        holderAgentId: canonical.holderAgentId,
        taskId: canonical.taskId,
        workPackageId: canonical.workPackageId,
        exactSha: canonical.exactSha,
        leaseId: canonical.leaseId,
        fencingTokenHash: canonical.fencingTokenHash,
        delegatedBy: 'assistantController',
      };
    }
    assert.equal(args.holder, canonical.holderAgentId);
    assert.equal(args.task, canonical.taskId);
    assert.equal(args.workPackage, canonical.workPackageId);
    assert.equal(args.sha, canonical.exactSha);
    assert.equal(args.leaseId, canonical.leaseId);
    assert.equal(args.fence, canonical.fencingTokenHash);
    return { authorized: true, ...canonical, chairId: 'chair_1', delegatedBy: 'assistantController' };
  },
  release: (args) => {
    assert.deepEqual(args, {
      holder: canonical.holderAgentId,
      task: canonical.taskId,
      workPackage: canonical.workPackageId,
      sha: canonical.exactSha,
      leaseId: canonical.leaseId,
      fence: canonical.fencingTokenHash,
    });
    return { status: 'OWNER_CUSTODY', ownerAgentId: 'assistantController' };
  },
});

const fenced = 'f'.repeat(64);
acquire({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  repositoryState: 'IDLE',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
  scope: ['src/example.ts'],
});

assert.equal(
  authorizeWrite({
    chairId: 'chair_1',
    agentId: canonical.holderAgentId,
    targetSha: sha,
    paths: ['src/example.ts'],
    permission: 'SOURCE_MUTATION',
    taskId: canonical.taskId,
    workPackageId: canonical.workPackageId,
    fencingToken: fenced,
  }).authorized,
  true,
);

assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: 'TASK-SUBSTITUTION',
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /CENTRAL_CHAIR_PROOF_INVALID/);

assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: 'WP-SUBSTITUTION',
  fencingToken: fenced,
}), /CENTRAL_CHAIR_PROOF_INVALID/);

assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: 'e'.repeat(64),
}), /CHAIR_FENCING_TOKEN_MISMATCH/);

assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: 'a'.repeat(40),
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /STALE_CONTEXT/);

assert.throws(() => authorizePublication({
  chairId: 'chair_1',
  agentId: 'UNAUTHORIZED_PUBLISHER',
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /UNAUTHORIZED_EXECUTION_ATTEMPT|CENTRAL_CHAIR_REQUIRED_FOR_MUTATION|CHAIR_NOT_OCCUPIED/);

forgedProof = true;
assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /CENTRAL_CHAIR_PROOF_INVALID/);
forgedProof = false;

release({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  successful: true,
  taskId: canonical.taskId,
});

assert.throws(() => authorizeWrite({
  chairId: 'chair_1',
  agentId: canonical.holderAgentId,
  targetSha: sha,
  paths: ['src/example.ts'],
  permission: 'SOURCE_MUTATION',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /CHAIR_NOT_OCCUPIED|UNAUTHORIZED_EXECUTION_ATTEMPT/);

replayProof = true;
assert.throws(() => acquire({
  chairId: 'chair_1',
  agentId: 'ACTION-REPAIR-2',
  targetSha: sha,
  repositoryState: 'IDLE',
  taskId: canonical.taskId,
  workPackageId: canonical.workPackageId,
  fencingToken: fenced,
}), /CENTRAL_CHAIR_PROOF_INVALID/);
replayProof = false;

console.log('CHAIR1_STALE_SHA=BLOCKED');
console.log('CHAIR1_FORGED_PROOF=BLOCKED');
console.log('CHAIR1_REPLAYED_LEASE=BLOCKED');
console.log('CHAIR1_FENCING_MISMATCH=BLOCKED');
console.log('CHAIR1_TASK_SUBSTITUTION=BLOCKED');
console.log('CHAIR1_WORK_PACKAGE_SUBSTITUTION=BLOCKED');
console.log('CHAIR1_UNAUTHORIZED_PUBLICATION=BLOCKED');
console.log('CHAIR1_POST_RELEASE_MUTATION=BLOCKED');
console.log('CHAIR1_STRICT_FALSE_NO_BYPASS=PASS');
console.log('CHAIR1_ADVERSARIAL_MATRIX=PASS');
