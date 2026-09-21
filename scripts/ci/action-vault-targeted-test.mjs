#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg=(name,f='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const before=arg('before');
const after=arg('after',execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim());
const output=arg('output','/tmp/action-vault-targeted-test-plan.json');
const execute=arg('execute','false')==='true';
if(!/^[a-f0-9]{40}$/u.test(before)||!/^[a-f0-9]{40}$/u.test(after)) throw new Error('ACTION_VAULT_TARGETED_SHA_REQUIRED');

const changed=execFileSync('git',['diff','--name-only','--diff-filter=ACMRT',before,after],{encoding:'utf8'}).split(/\r?\n/u).filter(Boolean);
const vaultChanged=changed.filter(p=>p.startsWith('diagnostics/auto-repair/action-vault/'));
const botChanged=changed.filter(p=>p.startsWith('diagnostics/auto-repair/action-repair-bots/'));
const workflows=changed.filter(p=>p.startsWith('.github/workflows/'));
const tests=[];
const add=(command,reason)=>tests.push({command,reason});
if(changed.some(p=>p.endsWith('ACTION-VAULT-AGENT-GRADE.json'))||botChanged.length>0) add('node scripts/ci/test-action-vault-agent-gate.mjs','agent contract or bot profile');
if(changed.some(p=>p.includes('ACTION-THREE-BOT-INTELLIGENCE')||p.includes('CHAT-PROTOCOL')||p.includes('ACTION-VAULT-PARALLEL-COLLABORATION-PROTOCOL'))) add('node scripts/ci/test-action-vault-parallel-collaboration.mjs','parallel collaboration contract');
if(changed.some(p=>p.includes('ACTION-RESIDENCY-POLICY')||p.includes('agent-liveness-protocol'))) add('node scripts/ci/test-agent-liveness-protocol.mjs','residency/liveness contract');
if(workflows.length>0) add('node scripts/validate-ci-contract.mjs','workflow contract');
if(tests.length===0 && (vaultChanged.length||botChanged.length)) add('node scripts/ci/test-action-vault-agent-gate.mjs','fallback vault contract check');
const unique=[...new Map(tests.map(x=>[x.command,x])).values()];
const result={schemaVersion:1,protocol:'ACTION-VAULT-TARGETED-REPAIR-v1',beforeSha:before,afterSha:after,changedPaths:changed,vaultChanged,botChanged,workflows,targetedTests:unique,fullSuiteRequired:false,canonicalGreenRequired:true,createdAt:new Date().toISOString()};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
if(execute){for(const test of unique){console.log('TARGETED_TEST_START='+test.command);execFileSync('bash',['-lc',test.command],{stdio:'inherit'});console.log('TARGETED_TEST_PASS='+test.command);}}
console.log(JSON.stringify(result,null,2));
