import assert from 'node:assert/strict';
import { classifyConversation, contextualizeCommand, createConversationMemory , normalizeAgentText, isQuestion } from '../src/lib/agent/conversation.ts';
import { buildWorldModel } from '../src/lib/agent/world-model.ts';
import { selectClarificationQuestion, rankClarificationQuestions } from '../src/lib/agent/question-engine.ts';
import { buildIntentPlan } from '../src/lib/agent/intent/intent-plan.ts';
import { buildFlixoHumanConversationPrompt } from '../src/lib/agent/human-conversation.ts';
import { parseAgentDecision, parseAgentRequest } from '../src/lib/contracts/agent-gateway.ts';
import { extractParameters } from '../src/lib/agent/intent/parameter-extractor.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';

assert.equal(classifyConversation('السلام عليكم'), 'greeting');
assert.equal(classifyConversation('ما الأدوات التي تسطيع تنفيذها'), 'capability');
assert.equal(classifyConversation('ماذا تستطيع أن تفعل؟'), 'capability');
assert.equal(classifyConversation('شكرا'), 'thanks');
assert.equal(classifyConversation('وبعدين خليها مربعة'), 'continuation');

const cropMemory = createConversationMemory();
cropMemory.activeCommand = 'قص الصورة';
cropMemory.pendingToolId = 'image-cropper';
assert.equal(contextualizeCommand('مربعة', cropMemory), 'قص الصورة مربعة');

const conversationalCrop = extractParameters('إزالة الخلفية واجعل الصورة مربعة');
assert.equal(conversationalCrop.success, true);
assert.deepEqual(conversationalCrop.payload?.operations, [
  { capability: 'background-remover', params: {} },
  { capability: 'image-cropper', params: { aspectRatio: '1:1' } },
]);

const chainedPlan = planFromIntent('إزالة الخلفية واجعل الصورة مربعة ثم حولها إلى WebP');
assert.deepEqual(chainedPlan?.steps.map((step) => step.toolId), [
  'background-remover',
  'image-cropper',
  'image-converter',
]);

const humanPrompt = buildFlixoHumanConversationPrompt({
  locale: 'ar',
  activeCommand: 'قص الصورة',
  activePlan: null,
  file: { name: 'photo.png', type: 'image/png', size: 128 },
  catalog: [{ id: 'image-cropper', title: 'Crop image' }],
  catalogFingerprint: 'a'.repeat(64),
});
assert.match(humanPrompt, /Treat every turn as part of one ongoing conversation/);
assert.match(humanPrompt, /Resolve short follow-ups and references/);
assert.match(humanPrompt, /Arabic may be Egyptian colloquial/);
assert.match(humanPrompt, /one focused question/);
assert.match(humanPrompt, /Return JSON only/);
assert.match(humanPrompt, /FLIXO BOT/);

console.log('Agent multi-turn conversation + human understanding contract tests passed.');

const request = parseAgentRequest({
  locale: 'ar',
  messages: [{ role: 'user', content: 'إزالة الخلفية' }],
  file: { name: 'photo.png', type: 'image/png', size: 128 },
  activePlan: null,
  activeCommand: null,
});
assert.equal(request.messages?.length, 1);
assert.equal(request.activePlan, null);
assert.throws(() => parseAgentRequest({
  messages: [{ role: 'user', content: 'إزالة الخلفية' }],
  activePlan: { workflowName: 'bad', confidence: 2, steps: [] },
}), /Invalid|greater|at least|positive/);
const chatDecision = parseAgentDecision({ mode: 'chat', reply: 'ok', question: null, plan: null, confidence: 0.8 });
assert.equal(chatDecision.mode, 'chat');
assert.throws(() => parseAgentDecision({ mode: 'chat', reply: 'ok', question: null, plan: { malformed: true }, confidence: 0.8 }), /Non-plan AI decisions/);


assert.equal(normalizeAgentText('إزاي   أعملها؟'), 'ازاي اعملها؟');
assert.equal(isQuestion('إيه المقاس المطلوب؟'), true);
assert.equal(isQuestion('اجعلها مربعة'), false);

const worldModel = buildWorldModel(
  'إزالة الخلفية ولا تغيّر الوجه',
  { kind: 'tool', id: 'background-remover', confidence: 0.96 },
  [{ capability: 'background-remover', params: {} }],
  [],
);
assert.equal(worldModel.negativeRequirements.length, 1);
assert.ok(worldModel.changeMap.remove.includes('background'));
assert.ok(worldModel.verificationCriteria.includes('negative requirements are preserved'));
assert.equal(worldModel.confidence.intent, 0.96);

const clarificationWorld = buildWorldModel(
  'convert the image',
  { kind: 'none', id: null, confidence: 0.1 },
  [],
  [{ id: 'output-format', capability: 'image-converter', kind: 'format', question: 'What output format do you want?' }],
);
const rankedQuestions = rankClarificationQuestions(
  [{ id: 'output-format', capability: 'image-converter', kind: 'format', question: 'What output format do you want?' }],
  clarificationWorld,
);
assert.equal(rankedQuestions.length, 1);
assert.ok(rankedQuestions[0].uncertaintyReduction > 0);
assert.ok(rankedQuestions[0].score > 0);
assert.equal(selectClarificationQuestion([], clarificationWorld), null);

const missingPlan = buildIntentPlan('convert the image');
assert.equal(missingPlan.status, 'NEEDS_INPUT');
assert.ok(missingPlan.worldModel);
assert.equal(missingPlan.worldModel?.uncertainties.includes('output-format'), true);
assert.equal(missingPlan.clarificationQuestion?.id, 'output-format');

console.log('Agent conversational intelligence world-model + clarification contracts passed.');
