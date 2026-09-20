import assert from 'node:assert/strict';
import { classifyConversation, contextualizeCommand, createConversationMemory } from '../src/lib/agent/conversation.ts';
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

console.log('Agent multi-turn conversation contract tests passed.');
