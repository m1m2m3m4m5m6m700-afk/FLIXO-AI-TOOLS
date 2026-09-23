import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  COLLECTIVE_ACTIVE_MEMBER_COUNT,
  COLLECTIVE_CAPABILITY_COUNT,
  COLLECTIVE_INTELLIGENCE_SOURCE,
  COLLECTIVE_INTELLIGENCE_VERSION,
  buildCollectiveIntelligenceFrame,
  summarizeCollectiveIntelligence,
} from '../src/lib/agent/collective-intelligence.ts';

const registry = JSON.parse(fs.readFileSync('docs/agents/FLIXO-BOT.json', 'utf8'));
assert.equal(registry.intelligenceVersion, COLLECTIVE_INTELLIGENCE_VERSION);
assert.equal(registry.mergedIntelligence.capabilityCount, COLLECTIVE_CAPABILITY_COUNT);
assert.equal(registry.distribution.targetCount, COLLECTIVE_ACTIVE_MEMBER_COUNT);
assert.equal(COLLECTIVE_INTELLIGENCE_SOURCE, 'docs/agents/FLIXO-BOT.json');
assert.equal(registry.architecture.principle, 'ONE_BRAIN_MANY_SEATS');

const ci = buildCollectiveIntelligenceFrame(
  'CI failed with a race condition; prove the root cause and repair it without weakening security.',
  ['image-compressor'],
);
assert.equal(ci.version, 'FLIXO-BOT-BRAIN-v1');
assert.equal(ci.authority, 'ADVISORY_ONLY');
assert.equal(ci.mutationAuthority, false);
assert.equal(ci.certificationAuthority, false);
assert.equal(ci.reasoningDepth, 'DEEP');
assert.ok(ci.selectedLenses.includes('ROOT_CAUSE_ANALYSIS'));
assert.ok(ci.selectedLenses.includes('EVIDENCE_PROVENANCE'));
assert.ok(ci.selectedLenses.includes('ADVERSARIAL_FALSIFICATION'));
assert.ok(ci.selectedLenses.includes('SECURITY_BOUNDARY_REASONING'));
assert.ok(ci.selectedPerspectives.includes('analysis'));
assert.ok(ci.selectedPerspectives.includes('reviewAgent'));
assert.ok(ci.selectedPerspectives.includes('securityAgent'));
assert.ok(ci.reasoningSequence.indexOf('GENERATE_HYPOTHESES') < ci.reasoningSequence.indexOf('DISCRIMINATE_WITH_EVIDENCE'));
assert.equal(ci.knowledgePolicy.exactShaBindingRequired, true);
assert.equal(ci.knowledgePolicy.learningDoesNotGrantAuthority, true);

const ar = buildCollectiveIntelligenceFrame('لماذا فشل الاختبار؟ نحتاج إثبات السبب وإعادة الاختبار.', []);
assert.ok(ar.selectedLenses.includes('ROOT_CAUSE_ANALYSIS'));
assert.ok(ar.selectedLenses.includes('REGRESSION_REASONING'));
assert.ok(ar.selectedLenses.includes('EVIDENCE_PROVENANCE'));

const summary = summarizeCollectiveIntelligence(ci);
assert.match(summary, /advisory only/i);
assert.match(summary, /exact-SHA/i);
console.log('Agent collective intelligence tests passed.');
