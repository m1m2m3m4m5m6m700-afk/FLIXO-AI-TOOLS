import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root=process.cwd();
const intakeWorkflow=fs.readFileSync(path.join(root,'.github/workflows/repair-agent-intake.yml'),'utf8');
assert.match(
  intakeWorkflow,
  /group:\s*flixo-repair-agent-intake-\$\{\{\s*github\.event\.workflow_run\.id\s*\|\|\s*inputs\.run_id\s*\|\|\s*github\.run_id\s*\}\}/u,
  'Repair Agent Intake must isolate concurrency by source run identity',
);
assert.match(intakeWorkflow,/cancel-in-progress:\s*false/u);
assert.doesNotMatch(intakeWorkflow,/^\s*schedule:\s*$/mu,'Repair Agent Intake must not poll on a periodic schedule');
assert.match(intakeWorkflow,/types:\s*\[completed\]/u);
assert.match(intakeWorkflow,/github\.event\.workflow_run\.conclusion == 'failure'/u);
assert.match(intakeWorkflow,/FLIXO Test System/u);
assert.match(intakeWorkflow,/FLIXO WP0 Trust Baseline/u);
assert.match(intakeWorkflow,/FLIXO Test Impact Execution/u);
assert.match(intakeWorkflow,/Repository Security Baseline/u);
assert.match(intakeWorkflow,/Claude Security Review/u);
assert.doesNotMatch(intakeWorkflow,/^\s*- FLIXO Test Impact\s*$/mu);
assert.doesNotMatch(intakeWorkflow,/^\s*- FLIXO Continuous Delivery\s*$/mu);
assert.doesNotMatch(intakeWorkflow,/^\s*- Daily·FLIXO Green Gate\s*$/mu);
assert.doesNotMatch(intakeWorkflow,/^\s*- FLIXO Auto Repair Bot\s*$/mu);
assert.doesNotMatch(intakeWorkflow,/^\s*- FLIXO Auto Repair Chain\s*$/mu);
assert.doesNotMatch(intakeWorkflow,/^\s*- FLIXO Auto Repair Merge Gate\s*$/mu);
assert.doesNotMatch(
  intakeWorkflow,
  /group:\s*flixo-repair-agent-intake-\$\{\{\s*github\.event\.workflow_run\.head_branch\s*\|\|/u,
  'Branch-only intake concurrency would drop concurrent incidents',
);
assert.match(intakeWorkflow,/COUNCIL_TARGET_KIND="AGENT_COUNCIL_ISSUE"/u);
assert.match(intakeWorkflow,/COUNCIL_TARGET_NUMBER="765"/u);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-repair-intake-'));
const log=path.join(temp,'failure.log');
const evidence=path.join(temp,'incident.json');
fs.writeFileSync(log,'Run failed: Static\nError: internal CI failure\n');
const sha='a'.repeat(40);
const output=execFileSync(process.execPath,['scripts/ci/repair-agent-intake.mjs','--run-id=12345','--workflow=FLIXO Test System','--conclusion=failure','--failed-sha='+sha,'--branch=execution','--current-sha='+sha,'--log='+log,'--evidence='+evidence],{cwd:root,encoding:'utf8'});
const result=JSON.parse(output);
assert.equal(result.incident.actor,'repairAgent');
assert.equal(result.incident.role,'ERROR_GATEWAY');
assert.equal(result.message.recipient,'ALL_AGENTS');
assert.equal(result.message.entrySha,sha);
assert.ok(result.incident.failureFingerprint);
assert.equal(result.incident.staleTarget,false);
const staleLog=path.join(temp,'stale.log');
const staleEvidence=path.join(temp,'stale.json');
fs.writeFileSync(staleLog,'Run failed on superseded SHA\\n');
const staleOutput=execFileSync(process.execPath,['scripts/ci/repair-agent-intake.mjs','--run-id=12346','--workflow=FLIXO Test System','--conclusion=failure','--failed-sha='+sha,'--branch=execution','--current-sha='+'b'.repeat(40),'--log='+staleLog,'--evidence='+staleEvidence],{cwd:root,encoding:'utf8'});
const staleResult=JSON.parse(staleOutput);
assert.equal(staleResult.incident.staleTarget,true);
assert.equal(result.incident.noOtherAgentLogWatchingRequired,true);
assert.ok(fs.existsSync(evidence));
console.log('REPAIR_AGENT_INTAKE_CONTRACT=PASS');
console.log('REPAIR_AGENT_COUNCIL_ROUTING=PASS');
console.log('NO_AGENT_LOG_POLLING_REQUIRED=PASS');
fs.rmSync(temp,{recursive:true,force:true});