import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assessCognitiveRequest } from '../src/lib/agent/cognitive-orchestrator.ts';
import { buildFlixoHumanConversationPrompt } from '../src/lib/agent/human-conversation.ts';
import {
  COLLECTIVE_ACTIVE_MEMBER_COUNT,
  COLLECTIVE_CAPABILITY_COUNT,
  COLLECTIVE_INTELLIGENCE_SOURCE,
  COLLECTIVE_INTELLIGENCE_VERSION,
  buildCollectiveIntelligenceFrame,
  summarizeCollectiveIntelligence,
} from '../src/lib/agent/collective-intelligence.ts';
import { getAgentProfile, listAgentProfiles, profilesForLenses } from '../src/lib/agent/agent-profile.ts';
import { assessAgentStuck } from '../src/lib/agent/stuck-detector.ts';
import { runBoundedGoalLoop } from '../src/lib/agent/goal-controller.ts';
import { AgentResourceLockManager, runBoundedParallel } from '../src/lib/agent/delegation.ts';
import { appendConversationEvent, verifyConversationEventChain } from '../src/lib/agent/conversation-event-store.ts';

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
assert.equal(ci.version, COLLECTIVE_INTELLIGENCE_VERSION);
assert.equal(ci.authority, 'ADVISORY_ONLY');
assert.equal(ci.mutationAuthority, false);
assert.equal(ci.certificationAuthority, false);
assert.equal(ci.reasoningDepth, 'DEEP');
assert.equal(ci.depthPolicy.mode, 'FULL_ALWAYS');
assert.equal(ci.depthPolicy.noComplexityDowngrade, true);
assert.equal(ci.depthPolicy.reasoningEffort, 'MAXIMUM');
assert.equal(new Set(ci.selectedLenses).size, 29);
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

const cognitive = assessCognitiveRequest('compress the image');
assert.equal(cognitive.collectiveIntelligence.version, COLLECTIVE_INTELLIGENCE_VERSION);
assert.equal(cognitive.collectiveIntelligence.authority, 'ADVISORY_ONLY');
assert.ok(cognitive.collectiveIntelligence.selectedLenses.includes('HUMAN_INTENT_MODELING'));

const prompt = buildFlixoHumanConversationPrompt({
  locale: 'ar',
  currentMessage: 'لماذا فشل الاختبار؟ اثبت السبب وأصلحه بأمان.',
  activeCommand: null,
  activePlan: null,
  collectiveLearning: {
    authority: 'CONTEXT_ONLY',
    lessons: [{ claim: 'Use current exact-SHA evidence before accepting historical knowledge.' }],
    antiLessons: [{ claim: 'Do not blindly retry a failed strategy.' }],
  },
  file: null,
  catalog: [],
  catalogFingerprint: 'a'.repeat(64),
});
assert.match(prompt, /FLIXO-BOT-BRAIN-v1/u);
assert.match(prompt, /COLLECTIVE DEEP REASONING/u);
assert.match(prompt, /ADVISORY_ONLY/u);
assert.match(prompt, /CONTEXT_ONLY/u);
assert.match(prompt, /exact-SHA evidence/u);

const ar = buildCollectiveIntelligenceFrame('لماذا فشل الاختبار؟ نحتاج إثبات السبب وإعادة الاختبار.', []);
assert.ok(ar.selectedLenses.includes('ROOT_CAUSE_ANALYSIS'));
assert.ok(ar.selectedLenses.includes('REGRESSION_REASONING'));
assert.ok(ar.selectedLenses.includes('EVIDENCE_PROVENANCE'));

const summary = summarizeCollectiveIntelligence(ci);
assert.match(summary, /advisory only/i);
assert.match(summary, /exact-SHA/i);
console.log('Agent collective intelligence tests passed.');

const executionProfile = getAgentProfile('executionAgent');
assert.ok(executionProfile);
assert.equal(executionProfile.doesNotGrantAuthority, true);
assert.equal(executionProfile.authorityBinding, 'CANONICAL_CONTROL_PLANE');
assert.ok(listAgentProfiles().length >= 15);
assert.ok(profilesForLenses(['ADVERSARIAL_FALSIFICATION']).some((profile) => profile.id === 'reviewAgent'));

const repeated = assessAgentStuck([
  { kind: 'TOOL', signature: 'image-compressor:{}' },
  { kind: 'ERROR', signature: 'output verification failed' },
  { kind: 'TOOL', signature: 'image-compressor:{}' },
  { kind: 'ERROR', signature: 'output verification failed' },
  { kind: 'TOOL', signature: 'image-compressor:{}' },
]);
assert.equal(repeated.severity, 'STUCK');
assert.equal(repeated.recommendation, 'REFLECT');

const alternating = assessAgentStuck([
  { kind: 'TOOL', signature: 'tool:A' },
  { kind: 'RESULT', signature: 'result:B' },
  { kind: 'TOOL', signature: 'tool:A' },
  { kind: 'RESULT', signature: 'result:B' },
  { kind: 'TOOL', signature: 'tool:A' },
  { kind: 'RESULT', signature: 'result:B' },
]);
assert.equal(alternating.severity, 'STUCK');
assert.equal(alternating.alternating, true);
assert.equal(alternating.recommendation, 'REPLAN');

const goal = runBoundedGoalLoop(
  { value: 0 },
  (state) => ({
    satisfied: state.value >= 2,
    score: Math.min(1, state.value / 2),
    unmetCriteria: state.value >= 2 ? [] : ['value>=2'],
    reason: state.value >= 2 ? 'goal reached' : 'value is below target',
  }),
  (state) => ({ value: state.value + 1 }),
);
assert.equal(goal.status, 'REFINED');
assert.equal(goal.refinements, 2);
assert.equal(goal.value.value, 2);

const event = await appendConversationEvent('SYSTEM', { test: 'platform-primitives' });
assert.equal(event.version, 1);
assert.equal(event.sequence, 1);
assert.equal(verifyConversationEventChain([event]), true);

console.log('Agent platform primitives tests passed.');

const lockManager = new AgentResourceLockManager();
assert.equal(lockManager.tryAcquire(['image:1'], 'task-a'), true);
assert.equal(lockManager.tryAcquire(['image:1'], 'task-b'), false);
lockManager.release(['image:1'], 'task-a');
assert.equal(lockManager.tryAcquire(['image:1'], 'task-b'), true);

const delegated = await runBoundedParallel(
  [
    { id: 'task-1', input: 1, resourceKeys: ['image:1'] },
    { id: 'task-2', input: 2, resourceKeys: ['image:2'] },
  ],
  async (task) => task.input * 2,
  { maxConcurrency: 2, lockManager: new AgentResourceLockManager() },
);
assert.deepEqual(delegated.map((item) => item.output), [2, 4]);
assert.ok(delegated.every((item) => item.status === 'COMPLETED'));

console.log('Agent delegation primitives tests passed.');
