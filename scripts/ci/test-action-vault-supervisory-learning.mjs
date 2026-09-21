#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root=process.cwd();
const protocol=path.resolve(root,'diagnostics/auto-repair/action-vault/ACTION-VAULT-SUPERVISORY-LEARNING-PROTOCOL.md');
const custodian=path.resolve(root,'scripts/ci/action-vault-knowledge-custodian.mjs');
assert.equal(fs.existsSync(protocol),true);
assert.equal(fs.existsSync(custodian),true);
const text=fs.readFileSync(protocol,'utf8');
for(const marker of [
  'ACTION-VAULT-SUPERVISORY-LEARNING-v1',
  'ACTION-HISTORIAN-3',
  'ACTION-INDEX-4000.json',
  'ACTION_VAULT_KNOWLEDGE_ESCALATION',
  'ACTION-VAULT-SUPERVISOR-TEACHING-001',
  'SPECIALIST_TEACHING',
  'apply-supervisor-lesson',
  'Canonical GREEN'
]) assert.ok(text.includes(marker),marker);
const output=execFileSync('node',[custodian,'assert-read','--bot=ACTION-HISTORIAN-3','--sha',execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()],{encoding:'utf8'});
assert.match(output,/status.*READ/);
console.log('ACTION_VAULT_SUPERVISORY_LEARNING_PROTOCOL=PASS');
