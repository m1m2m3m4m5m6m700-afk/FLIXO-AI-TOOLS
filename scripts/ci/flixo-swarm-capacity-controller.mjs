#!/usr/bin/env node
import assert from 'node:assert/strict';

export const FLIXO_SWARM_CAPACITY_POLICY = Object.freeze({
  protocol: 'FLIXO-DYNAMIC-SWARM-CAPACITY-v1',
  minimumActiveRuntimeCount: 5,
  defaultActiveRuntimeCount: 5,
  maximumActiveRuntimeCount: 500,
  scaleStep: 5,
  currentVerifiedRuntimeCount: 10,
  currentVerifiedActiveRuntimeCount: 5,
  logicalJourneyDefault: 100,
  logicalJourneyMaximum: 500,
  scaleSignals: Object.freeze({
    queuedTasksPerActiveBot: 4,
    blockedTasksPerActiveBot: 2,
    staleHeartbeatRatio: 0.2,
    maxNoProgressHeartbeats: 3,
  }),
  requireVerifiedRuntimeProvisioning: true,
  neverFabricateLiveBots: true,
  oneCanonicalMutationOwner: true,
  exactShaRequired: true,
});

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }

export function validateCapacityPolicy() {
  const p=FLIXO_SWARM_CAPACITY_POLICY;
  assert.equal(p.minimumActiveRuntimeCount,5);
  assert.equal(p.defaultActiveRuntimeCount,5);
  assert.equal(p.maximumActiveRuntimeCount,500);
  assert.equal(p.scaleStep,5);
  assert.equal(p.currentVerifiedRuntimeCount >= p.currentVerifiedActiveRuntimeCount,true);
  assert.equal(p.currentVerifiedActiveRuntimeCount,5);
  assert.equal(p.logicalJourneyDefault,100);
  assert.equal(p.logicalJourneyMaximum,500);
  assert.equal(p.requireVerifiedRuntimeProvisioning,true);
  assert.equal(p.neverFabricateLiveBots,true);
  assert.equal(p.oneCanonicalMutationOwner,true);
  return true;
}

export function decideCapacity({
  activeRuntimeCount = FLIXO_SWARM_CAPACITY_POLICY.currentVerifiedActiveRuntimeCount,
  provisionedRuntimeCount = FLIXO_SWARM_CAPACITY_POLICY.currentVerifiedRuntimeCount,
  queuedTasks = 0,
  blockedTasks = 0,
  staleHeartbeats = 0,
  liveBots = activeRuntimeCount,
  exactSha = null,
} = {}) {
  validateCapacityPolicy();
  if (!/^[a-f0-9]{40}$/iu.test(String(exactSha ?? ''))) {
    return Object.freeze({
      action:'BLOCK',
      reason:'EXACT_SHA_REQUIRED',
      desiredActiveRuntimeCount:5,
      currentVerifiedActiveRuntimeCount:Number(activeRuntimeCount),
    });
  }
  const p=FLIXO_SWARM_CAPACITY_POLICY;
  if (liveBots !== activeRuntimeCount) {
    return Object.freeze({action:'BLOCK',reason:'LIVE_COUNT_MISMATCH'});
  }
  if (activeRuntimeCount < p.minimumActiveRuntimeCount) {
    const desired=Math.min(provisionedRuntimeCount,p.minimumActiveRuntimeCount);
    return Object.freeze({action:'RECOVER_TO_FLOOR',desiredActiveRuntimeCount:desired,reason:'ACTIVE_FLOOR_BELOW_FIVE'});
  }
  const demandPerBot=Math.max(Number(queuedTasks),0)/Math.max(Number(activeRuntimeCount),1);
  const blockedPerBot=Math.max(Number(blockedTasks),0)/Math.max(Number(activeRuntimeCount),1);
  const staleRatio=Math.max(Number(staleHeartbeats),0)/Math.max(Number(activeRuntimeCount),1);
  const scalePressure=demandPerBot>=p.scaleSignals.queuedTasksPerActiveBot ||
    blockedPerBot>=p.scaleSignals.blockedTasksPerActiveBot ||
    staleRatio>=p.scaleSignals.staleHeartbeatRatio;
  if (!scalePressure) {
    return Object.freeze({
      action:'HOLD',
      reason:'CAPACITY_SUFFICIENT',
      desiredActiveRuntimeCount:clamp(activeRuntimeCount,p.minimumActiveRuntimeCount,p.maximumActiveRuntimeCount),
      verifiedProvisionedRuntimeCount:provisionedRuntimeCount,
    });
  }
  const requested=Math.min(p.maximumActiveRuntimeCount,activeRuntimeCount+p.scaleStep);
  if (requested > provisionedRuntimeCount) {
    return Object.freeze({
      action:'REQUEST_PROVISIONING',
      reason:'DEMAND_EXCEEDS_VERIFIED_RUNTIME_CAPACITY',
      desiredActiveRuntimeCount:requested,
      requiredVerifiedRuntimeCount:requested,
      currentVerifiedRuntimeCount:provisionedRuntimeCount,
      neverFabricateLiveBots:true,
    });
  }
  return Object.freeze({
    action:'SCALE_UP',
    reason:'CAPACITY_PRESSURE',
    desiredActiveRuntimeCount:requested,
    verifiedProvisionedRuntimeCount:provisionedRuntimeCount,
  });
}

if (process.argv[1] && new URL(`file://${process.argv[1]}`).href===import.meta.url) {
  try {
    validateCapacityPolicy();
    const arg=(name,fallback='')=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
    const result=decideCapacity({
      activeRuntimeCount:Number(arg('active', '5')),
      provisionedRuntimeCount:Number(arg('provisioned', '10')),
      queuedTasks:Number(arg('queued','0')),
      blockedTasks:Number(arg('blocked','0')),
      staleHeartbeats:Number(arg('stale','0')),
      liveBots:Number(arg('live','5')),
      exactSha:arg('sha',''),
    });
    console.log(JSON.stringify({...result,policy:FLIXO_SWARM_CAPACITY_POLICY},null,2));
  } catch(error) {
    console.error('FLIXO_SWARM_CAPACITY_FAIL_CLOSED='+String(error?.stack??error));
    process.exitCode=1;
  }
}
