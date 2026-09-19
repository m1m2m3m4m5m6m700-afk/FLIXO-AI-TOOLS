#!/usr/bin/env node
import fs from 'node:fs';
import { loadPromptRegistry, validatePromptRegistry, promptQualityGate } from './prompt-intelligence.mjs';

const registry = loadPromptRegistry();
const result = validatePromptRegistry(registry);
for (const prompt of registry.prompts) {
  if (prompt.status !== 'ACTIVE') continue;
  const gate = promptQualityGate(registry, prompt.promptId);
  if (gate.status !== 'PASS') {
    console.error(`PROMPT_REVIEW_REQUIRED=${prompt.promptId}`);
    for (const reason of gate.reasons) console.error(`REASON=${reason}`);
    process.exit(1);
  }
  const source = fs.readFileSync(prompt.sourcePath, 'utf8');
  if (!/LEARNING INSTRUCTIONS|LEARNING|التعلم/iu.test(source)) {
    console.error(`PROMPT_LEARNING_CONTRACT_MISSING=${prompt.promptId}`);
    process.exit(1);
  }
}
if (!result.valid) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'PASS', promptCount: registry.prompts.length, active: registry.prompts.filter((p) => p.status === 'ACTIVE').length, relations: result.relations }, null, 2));