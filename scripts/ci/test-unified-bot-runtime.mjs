#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  BOT_RUNTIME_ENGINE_VERSION,
  BOT_RUNTIME_PROTOCOL,
  BOT_RUNTIME_SHARED_CAPABILITIES,
  getUnifiedBotRuntime,
  validateUnifiedBotRuntimeRegistry,
} from './control-plane-registry.mjs';

const validation=validateUnifiedBotRuntimeRegistry();
assert.equal(validation.ok,true,validation.failures.join(','));
assert.equal(BOT_RUNTIME_PROTOCOL,'FLIXO-UNIFIED-BOT-RUNTIME-v1');
assert.equal(BOT_RUNTIME_ENGINE_VERSION,'UNIFIED-BOT-ENGINE-v1');
assert.ok(BOT_RUNTIME_SHARED_CAPABILITIES.length>=10);

const repair=getUnifiedBotRuntime('ACTION-REPAIR');
const read=getUnifiedBotRuntime('READ-INVESTIGATOR');
const twin=getUnifiedBotRuntime('ACTION-TWIN-1');
assert.equal(repair.role,'MASTER_REPAIR');
assert.equal(repair.mutationAuthority,true);
assert.equal(repair.reportOnly,false);
assert.equal(repair.certificationAuthority,false);
assert.equal(repair.engineVersion,read.engineVersion);
assert.equal(repair.capabilities.includes('TEN_X_REPAIR'),true);
assert.equal(repair.capabilities.includes('PROOF_ARBITRATION'),true);
assert.equal(read.role,'READ_ONLY');
assert.equal(read.mutationAuthority,false);
assert.equal(read.reportOnly,true);
assert.equal(twin.role,'ADVERSARIAL');
assert.equal(twin.mutationAuthority,false);
assert.equal(repair.engineVersion,read.engineVersion);
assert.deepEqual(repair.sharedCapabilities,read.sharedCapabilities);
assert.throws(()=>getUnifiedBotRuntime('UNKNOWN-BOT'),/BOT_RUNTIME_ID_UNREGISTERED/u);
console.log('UNIFIED_BOT_RUNTIME_CONTRACT=PASS');
