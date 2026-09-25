#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const workflow=fs.readFileSync('.github/workflows/auto-repair.yml','utf8');
const gate=fs.readFileSync('scripts/ci/repair-pre-commit-adversarial-redteam-gate.mjs','utf8');
assert.match(workflow,/Pre-commit adversarial \+ Red Team gate/u);
assert.match(workflow,/repair-pre-commit-adversarial-redteam-gate\.mjs/u);
assert.match(workflow,/steps\.pre_commit_adversarial_redteam\.outcome == 'success'/u);
assert.match(gate,/FLIXO-PRE-COMMIT-ADVERSARIAL-REDTEAM-v1/u);
assert.match(gate,/SECURITY-REDTEAM-1[\s\S]*SECURITY-REDTEAM-2[\s\S]*SECURITY-REDTEAM-3/u);
assert.match(gate,/NEW_RED_TEAM_FINDINGS/u);
assert.match(gate,/ADVERSARIAL_MUTATION_SURVIVED/u);
assert.match(gate,/commitCreated:false/u);
console.log('PRE_COMMIT_ADVERSARIAL_REDTEAM_CONTRACT=PASS');
