#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CANONICAL_LANE,
  CONSOLIDATION_PROTOCOL,
  normalizePushPacket,
  buildCanonicalLaneConsolidation,
  assertCanonicalLaneConsolidation,
} from './canonical-lane-consolidator.mjs';

const head='1111111111111111111111111111111111111111';
const aBase='2222222222222222222222222222222222222222';
const bBase='3333333333333333333333333333333333333333';
const aHead='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const bHead='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

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
    {...packetA,packetId:'P-C',sourceSha:'cccccccccccccccccccccccccccccccccccccccc',changedFiles:['same.ts']},
    {...packetA,packetId:'P-D',sourceSha:'dddddddddddddddddddddddddddddddddddddddd',changedFiles:['same.ts']},
  ],
});
assert.equal(overlap.status,'BLOCKED_CONFLICT');
assert.equal(overlap.conflicts[0].type,'OVERLAPPING_FILE_SCOPE_REQUIRES_EXPLICIT_RECONCILIATION');

const unjoined=buildCanonicalLaneConsolidation({
  currentHead:head,
  targetBranch:CANONICAL_LANE,
  expectedParent:head,
  packets:[{...packetA,packetId:'P-E',sourceSha:'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',baseSha:bBase}],
});
assert.equal(unjoined.status,'BLOCKED_STALE_OR_UNJOINED_PACKET');
assert.throws(()=>assertCanonicalLaneConsolidation(unjoined,head),/CONFLICT_OR_STALE/);

console.log('CANONICAL_LANE_CONSOLIDATOR_TEST=PASS');
