#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeKnowledge,mergeCanonical,decayKnowledge,poisoningSafe,compactMemory,rebuildMemory,classifyDifficulty,skillReputation,adaptiveSwarmSize,promotionTrial,canaryDecision,compareReplay,validateHandoff,rootCauseMemoryLink} from '../../src/lib/agent/swarm/learning-memory-routing.ts';
const sha='a'.repeat(40), h='b'.repeat(64);
const make=(id,extra={})=>makeKnowledge({id,scope:'routing',content:'Bind routing evidence to exact SHA.',source:'test',sourceType:'TEST',version:'1',layer:'L5',status:'VERIFIED',validity:'CURRENT',confidence:.96,authority:.98,provenance:['test'],exactSha:sha,exactShaVerified:true,evidenceCount:3,polarity:'SUPPORTS',createdAt:'2026-09-01T00:00:00Z',lastVerifiedAt:'2026-09-20T00:00:00Z',expiresAt:null,...extra});
const merged=mergeCanonical([make('A'),make('B'),make('C',{polarity:'REFUTES'})]); assert.equal(merged.canonical.length,1); assert.equal(merged.duplicates.length,1); assert.equal(merged.contradictions.length,1);
assert.equal(decayKnowledge(make('D'),Date.parse('2026-10-21T00:00:00Z'),30).validity,'STALE');
assert.equal(poisoningSafe(make('E'),sha),true); assert.equal(poisoningSafe(make('F',{sourceType:'GENERATED'}),sha),false);
assert.equal(compactMemory([make('G'),make('H',{layer:'L4',status:'PROBABLE',confidence:.8})]).active.length,2);
const xs=[make('I'),make('J',{content:'Other claim.'})]; const dig=createHash('sha256').update(JSON.stringify(xs.slice().sort((a,b)=>a.id.localeCompare(b.id))),'utf8').digest('hex'); assert.equal(rebuildMemory(xs,{recordCount:2,digest:dig,exactSha:sha}).length,2);
assert.equal(classifyDifficulty({ambiguity:0,novelty:0,dependencyCount:0,risk:0,uncertainty:0,capabilityCount:1}),'D1');
const reps=skillReputation([{botId:'CELL-101',skill:'routing',capability:'filter-mask',outcome:'SUCCESS',contextKey:'a',verified:true,timestamp:'2026-09-20T00:00:00Z'},{botId:'CELL-101',skill:'routing',capability:'filter-mask',outcome:'SUCCESS',contextKey:'b',verified:true,timestamp:'2026-09-21T00:00:00Z'}]); assert.equal(reps[0].successRate,1);
assert(adaptiveSwarmSize('D5',6,1,1)<=50); assert.equal(promotionTrial({attempts:2,successes:2,distinctContexts:2,independentChallenges:1,contradictions:0}).eligible,false); assert.equal(promotionTrial({attempts:4,successes:4,distinctContexts:2,independentChallenges:1,contradictions:0}).eligible,true);
assert.equal(canaryDecision({baselineFailureRate:.1,canaryFailureRate:.3,allowedRegression:.05,trials:10}),'ROLLBACK');
assert.equal(compareReplay({historicalOracle:'FAIL',currentOracle:'PASS',historicalOutputHash:h,currentOutputHash:'c'.repeat(64)}).signal,'IMPROVED');
validateHandoff({missionId:'M1',exactSha:sha,capabilityId:'filter-mask',evidenceRefs:['run:1']});
assert.equal(rootCauseMemoryLink({productFailureId:'P1',rootCause:'runtime',exactSha:sha,failureFingerprint:h,evidenceRefs:['run:1']}).layer,'L3');
console.log('SWARM_LEARNING_MEMORY_ROUTING=PASS');
