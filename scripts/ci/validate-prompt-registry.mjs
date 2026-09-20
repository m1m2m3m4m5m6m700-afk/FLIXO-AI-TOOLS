#!/usr/bin/env node
import { loadPromptRegistry, validatePromptRegistry } from './prompt-registry.mjs';

const result = validatePromptRegistry(loadPromptRegistry());
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  console.log('PROMPT_REGISTRY_STATUS=' + result.status);
  console.log('PROMPT_REGISTRY_COUNT=' + result.promptCount);
  for (const warning of result.warnings) console.log('PROMPT_REGISTRY_WARNING=' + warning);
  for (const error of result.errors) console.error('PROMPT_REGISTRY_ERROR=' + error);
}
if (!result.ok) process.exit(1);