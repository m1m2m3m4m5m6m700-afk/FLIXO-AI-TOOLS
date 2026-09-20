#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packetPath=process.argv[2]||'/tmp/action-system-cognitive-awareness.json';
assert.ok(fs.existsSync(packetPath),'awareness packet missing');
const p=JSON.parse(fs.readFileSync(packetPath,'utf8'));
assert.equal(p.protocol,'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1');
assert.equal(p.exactShaBound,true);
assert.equal(p.readOnly,true);
assert.equal(p.noMutation,true);
assert.equal(p.cognitiveEnvelope,'BEYOND_ROLE_NARROWING_WITHIN_AUTHORITY_BOUNDARIES');
assert.equal(p.awarenessCompleteness.complete,true);
assert.ok(p.awarenessCompleteness.requiredDomains.length>=9);
assert.equal(p.reasoningDiscipline.mustSeekDisconfirmingEvidence,true);
assert.equal(p.reasoningDiscipline.confidenceCannotReplaceProof,true);
assert.equal(p.reasoningDiscipline.noCounterexampleDoesNotEqualGreen,true);
console.log('ACTION_SYSTEM_COGNITIVE_AWARENESS=PASS');
