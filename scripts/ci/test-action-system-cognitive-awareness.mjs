#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packetPath=process.argv[2]||'/tmp/action-system-cognitive-awareness.json';
assert.ok(fs.existsSync(packetPath),'awareness packet missing');
const p=JSON.parse(fs.readFileSync(packetPath,'utf8'));
assert.equal(p.protocol,'ACTION-SYSTEM-COGNITIVE-AWARENESS-v1');
assert.equal(p.schemaVersion,2);
assert.equal(p.exactShaBound,true);
assert.equal(p.readOnly,true);
assert.equal(p.noMutation,true);
assert.equal(p.awarenessCompleteness.requiredDomains.length,9);
for(const domainName of p.awarenessCompleteness.requiredDomains){
  const d=p.domains[domainName];
  assert.ok(d,'domain missing '+domainName);
  assert.ok(Array.isArray(d.facts),'facts missing '+domainName);
  assert.ok(Array.isArray(d.evidence)&&d.evidence.length>0,'evidence missing '+domainName);
  assert.ok(Array.isArray(d.unknowns),'unknowns missing '+domainName);
  assert.ok(Array.isArray(d.contradictions),'contradictions missing '+domainName);
  assert.ok(Array.isArray(d.hypotheses),'hypotheses missing '+domainName);
  assert.equal(typeof d.confidence.value,'number');
  assert.ok(Array.isArray(d.confidence.basis)&&d.confidence.basis.length>0,'confidence basis missing '+domainName);
  assert.ok(Array.isArray(d.evidenceRefs)&&d.evidenceRefs.length>0,'evidenceRefs missing '+domainName);
  assert.ok(Array.isArray(d.impact),'impact missing '+domainName);
  assert.equal(typeof d.conclusion,'string');
  assert.equal(typeof d.reevaluationTrigger,'string');
  if(domainName==='ADVERSARIAL_CONTEXT') assert.equal(d.completed,true);
}
assert.equal(p.awarenessCompleteness.complete,true);
assert.equal(p.reasoningDiscipline.mustSeekDisconfirmingEvidence,true);
assert.equal(p.reasoningDiscipline.confidenceCannotReplaceProof,true);
assert.equal(p.reasoningDiscipline.noCounterexampleDoesNotEqualGreen,true);
console.log('ACTION_SYSTEM_COGNITIVE_AWARENESS=PASS');