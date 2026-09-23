#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
const root=process.cwd(); const env=(n,d='')=>String(process.env[n]??d).trim();
const base=env('FLIXO_PROOF_BASE_SHA',process.argv[2]??''); const head=env('FLIXO_PROOF_HEAD_SHA',process.argv[3]??'HEAD');
if(!/^[0-9a-f]{40}$/.test(base))throw new Error('RUNTIME_PROOF_BASE_SHA_REQUIRED');
const run=a=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const changed=run(['diff','--name-only',`${base}...${head}`]).split('\n').filter(Boolean);
const sensitive=/(liveness|wake|watchdog|lease|heartbeat|council|supersession)|CELL-BOT-REGISTRY\.json|ACTION-REPAIR-SQUAD-REGISTRY\.json/i;
const proof=/(?:^|\/)(?:test-|verify-|validate-|assert-|check-)|\.test\.|\.spec\.|\.workflow\.yml$/i;
const sensitiveChanged=changed.filter(p=>sensitive.test(p)); const proofChanged=changed.filter(p=>proof.test(p));
const status=!sensitiveChanged.length||proofChanged.length?'PASS':'FAIL';
console.log(JSON.stringify({schemaVersion:1,policy:'SENSITIVE_CONTRACT_CHANGES_REQUIRE_ADJACENT_PROOF',baseSha:base,headSha:head,sensitiveChanged,proofChanged,status},null,2));
if(status!=='PASS')throw new Error('SENSITIVE_CONTRACT_CHANGE_WITHOUT_PROOF');
