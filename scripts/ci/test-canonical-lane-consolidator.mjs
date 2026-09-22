#!/usr/bin/env node
import assert from 'node:assert/strict';

process.env.NODE_ENV='test';
process.env.FLIXO_CANONICAL_LANE_SYNTHETIC_FIXTURES='true';
import {
  CANONICAL_LANE,
  CONSOLIDATION_PROTOCOL,
  normalizePushPacket,
  buildCanonicalLaneConsolidation,
  assertCanonicalLaneConsolidation,
  collectAccumulatedPushPackets,
} from './canonical-lane-consolidator.mjs';

const head='1111111111111111111111111111111111111111';
const bBase='3333333333333333333333333333333333333333';
const aHead='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const bHead='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const collected=collectAccumulatedPushPackets({
  currentHead:head,
  root:'/tmp/flixo-non-repository-root',
  envValue:JSON.stringify([{
    packetId:'ENV-A', agentId:'ACTION-REPAIR', sourceSha:aHead, baseSha:head,
    changedFiles:['scripts/a.mjs'],
  }]),
});
assert.equal(collected.candidateCount,1);
assert.equal(collected.packets.length,1);
assert.equal(collected.packets[0].packetId,'ENV-A');

const packetA=normalizePushPacket({
  packetId:'P-A', agentId:'ACTION-REPAIR', sourceSha:aHead, baseSha:head,
  changedFiles:['scripts/a.mjs'], createdAt:'2026-09-22T10:00:00Z',
});
assert.equal(packetA.branch,'agent-supplied');
assert.equal(packetA.commits.length,1);

const packetB=normalizePushPacket({
  packetId:'P-B', agentId:'ACTION-REPAIR-2', sourceSha:bHead, baseSha:aHead,
  changedFiles:['scripts/b.mjs'], createdAt:'2026-09-22T10:01:00Z',
});

const clean=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[packetB,packetA],
});
assert.equal(clean.protocol,CONSOLIDATION_PROTOCOL);
assert.equal(clean.status,'READY_FOR_CANONICAL_CONSOLIDATION');
assert.deepEqual(clean.orderedPackets.map((x)=>x.packetId),['P-A','P-B']);
assert.equal(clean.conflicts.length,0);
assert.equal(clean.stalePackets.length,0);
assert.equal(clean.integrationDecision.mode,'SEQUENTIAL_CANONICAL_LANE_APPLICATION');
assert.equal(clean.packetCountUnique,2);
assertCanonicalLaneConsolidation(clean,head);


const patchAtLines=[
  'diff --git a/same.ts b/same.ts',
  '--- a/same.ts',
  '+++ b/same.ts',
  '@@ -10,2 +10,2 @@',
  '-oldA',
  '+newA',
].join('\n');

const patchAtOtherLines=[
  'diff --git a/same.ts b/same.ts',
  '--- a/same.ts',
  '+++ b/same.ts',
  '@@ -40,2 +40,2 @@',
  '-oldB',
  '+newB',
].join('\n');

const semanticallyReconciled=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-NONOVERLAP-A',sourceSha:'1111111111111111111111111111111111111112',changedFiles:['same.ts'],patchText:patchAtLines},
    {...packetA,packetId:'P-NONOVERLAP-B',sourceSha:'1111111111111111111111111111111111111113',changedFiles:['same.ts'],patchText:patchAtOtherLines},
  ],
});
assert.equal(semanticallyReconciled.status,'READY_FOR_CANONICAL_CONSOLIDATION');
assert.equal(semanticallyReconciled.conflicts.length,0);
assert.equal(semanticallyReconciled.semanticReconciliation[0].semanticStatus,'SEMANTICALLY_RECONCILABLE');

const patchConflictA=[
  'diff --git a/conflict.ts b/conflict.ts',
  '--- a/conflict.ts',
  '+++ b/conflict.ts',
  '@@ -20,2 +20,2 @@',
  '-old',
  '+new-one',
].join('\n');

const patchConflictB=[
  'diff --git a/conflict.ts b/conflict.ts',
  '--- a/conflict.ts',
  '+++ b/conflict.ts',
  '@@ -20,2 +20,2 @@',
  '-old',
  '+new-two',
].join('\n');


const identical=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-IDENTICAL-A',sourceSha:'1111111111111111111111111111111111111131',changedFiles:['same.ts'],patchText:patchAtLines},
    {...packetA,packetId:'P-IDENTICAL-B',sourceSha:'1111111111111111111111111111111111111132',changedFiles:['same.ts'],patchText:patchAtLines},
  ],
});
assert.equal(identical.status,'READY_FOR_CANONICAL_CONSOLIDATION');
assert.equal(identical.semanticReconciliation[0].semanticStatus,'IDENTICAL_OVERLAPPING_HUNKS');

const noPatch=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-NO-PATCH-A',sourceSha:'1111111111111111111111111111111111111141',changedFiles:['same.ts']},
    {...packetA,packetId:'P-NO-PATCH-B',sourceSha:'1111111111111111111111111111111111111142',changedFiles:['same.ts']},
  ],
});
assert.equal(noPatch.status,'BLOCKED_CONFLICT');
assert.equal(noPatch.conflicts[0].type,'SEMANTIC_EVIDENCE_UNAVAILABLE');

const previousFixtureMode=process.env.FLIXO_CANONICAL_LANE_SYNTHETIC_FIXTURES;
process.env.FLIXO_CANONICAL_LANE_SYNTHETIC_FIXTURES='false';
const forgedPatch=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-FORGED-A',sourceSha:'1111111111111111111111111111111111111181',changedFiles:['same.ts'],patchText:patchAtLines},
    {...packetA,packetId:'P-FORGED-B',sourceSha:'1111111111111111111111111111111111111182',changedFiles:['same.ts'],patchText:patchAtLines},
  ],
});
assert.equal(forgedPatch.status,'BLOCKED_CONFLICT');
assert.equal(forgedPatch.conflicts[0].type,'PATCH_INTEGRITY_BLOCKED');
process.env.FLIXO_CANONICAL_LANE_SYNTHETIC_FIXTURES=previousFixtureMode;

const semanticConflict=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-CONFLICT-A',sourceSha:'1111111111111111111111111111111111111121',changedFiles:['conflict.ts'],patchText:patchConflictA},
    {...packetA,packetId:'P-CONFLICT-B',sourceSha:'1111111111111111111111111111111111111122',changedFiles:['conflict.ts'],patchText:patchConflictB},
  ],
});
assert.equal(semanticConflict.status,'BLOCKED_CONFLICT');
assert.equal(semanticConflict.conflicts[0].type,'TRUE_HUNK_CONFLICT');

const duplicate=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[packetA,packetA],
});
assert.equal(duplicate.status,'READY_FOR_CANONICAL_CONSOLIDATION');
assert.deepEqual(duplicate.duplicatePacketIds,['P-A']);
assert.equal(duplicate.packetCountUnique,1);

const overlap=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[
    {...packetA,packetId:'P-C',sourceSha:'cccccccccccccccccccccccccccccccccccccccc',changedFiles:['same.ts'],patchText:patchAtLines},
    {...packetA,packetId:'P-D',sourceSha:'dddddddddddddddddddddddddddddddddddddddd',changedFiles:['same.ts'],patchText:patchConflictB},
  ],
});
assert.equal(overlap.status,'BLOCKED_CONFLICT');
assert.equal(overlap.conflicts[0].type,'TRUE_HUNK_CONFLICT');

const unjoined=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[{...packetA,packetId:'P-E',sourceSha:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',baseSha:bBase}],
});
assert.equal(unjoined.status,'BLOCKED_STALE_OR_UNJOINED_PACKET');
assert.throws(()=>assertCanonicalLaneConsolidation(unjoined,head),/CONFLICT_OR_STALE/);

console.log('CANONICAL_LANE_CONSOLIDATOR_TEST=PASS');
