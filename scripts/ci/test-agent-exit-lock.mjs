#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {assertAgentExitGate} from './agent-exit-lock.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'flixo-agent-exit-lock-'));
const globalPath=path.join(temp,'global.json'); const promotionPath=path.join(temp,'promotion.json'); const sha='a'.repeat(40);
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
try {
 write(globalPath,{authority:'CANONICAL_CERTIFY_ENGINE',status:'PASS',certificationSha:sha,failures:[],unknowns:[],invalidEvidence:[],shaMismatches:[],unauthorizedSkips:[],duplicatePrimaryEvidence:[],zeroFalseGreen:{independentRootCauses:0,unknowns:0,invalidEvidence:0,shaMismatches:0,unauthorizedSkips:0}});
 write(promotionPath,{authority:'FLIXO_EXACT_SHA_PROMOTION_EVIDENCE',state:'CERTIFIABLE',exactSha:sha,liveRuntimeState:'LIVE_VERIFIED',failures:[]});
 assert.throws(()=>assertAgentExitGate({status:'BLOCKED',exactSha:sha,globalEvidencePath:globalPath,promotionEvidencePath:promotionPath}),/AGENT_EXIT_LOCK_NON_GREEN_STATUS/);
 assert.throws(()=>assertAgentExitGate({status:'VERIFIED',exactSha:sha,remainingWork:['RED-1'],globalEvidencePath:globalPath,promotionEvidencePath:promotionPath}),/AGENT_EXIT_LOCK_REMAINING_WORK/);
 assert.throws(()=>assertAgentExitGate({status:'VERIFIED',exactSha:'b'.repeat(40),globalEvidencePath:globalPath,promotionEvidencePath:promotionPath}),/AGENT_EXIT_LOCK_GLOBAL_SHA_DRIFT/);
 const result=assertAgentExitGate({status:'VERIFIED',exactSha:sha,globalEvidencePath:globalPath,promotionEvidencePath:promotionPath});
 assert.equal(result.ok,true); assert.equal(result.state,'GREEN');
 console.log('AGENT_EXIT_LOCK_BLOCKS_NON_GREEN=PASS');
 console.log('AGENT_EXIT_LOCK_BLOCKS_REMAINING_WORK=PASS');
 console.log('AGENT_EXIT_LOCK_REQUIRES_EXACT_SHA=PASS');
 console.log('AGENT_EXIT_LOCK_GREEN_PROOF=PASS');
 console.log('AGENT_EXIT_LOCK_TEST=PASS');
} finally { fs.rmSync(temp,{recursive:true,force:true}); }
