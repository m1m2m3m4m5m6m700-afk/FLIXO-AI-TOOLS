#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const daily = fs.readFileSync('.github/workflows/daily-flixo-green-gate.yml', 'utf8');
const auto = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const taskAgent = fs.readFileSync('scripts/ci/task-agent.mjs', 'utf8');
const generator = fs.readFileSync('scripts/ci/generate-repair-execution-prompts.mjs', 'utf8');
const runtimeAdapter = fs.readFileSync('src/lib/agent/flixo-agent-master-prompt.ts', 'utf8');
const canonicalPrompt = fs.readFileSync('docs/agents/PROMPT-UNIFIED-EXECUTION.md', 'utf8');

assert.match(generator, /DAILY VISIT/u);
assert.match(generator, /findSimilarCases/u);
assert.match(generator, /discoverPromptContext/u);
assert.match(generator, /createPromptHandoff/u);
assert.match(generator, /PROMPT_REVIEW_REQUIRED/u);
assert.match(generator, /Registry Prompt ID/u);
assert.match(generator, /rankLessons/u);
assert.match(generator, /antiLessons/u);
assert.match(generator, /exact SHA/u);
assert.match(generator, /OPERATING_MODE=REPOSITORY_EXECUTION/u);
assert.match(canonicalPrompt, /CUSTOMER-FACING IMAGE-AGENT CONTRACT/u);
assert.match(canonicalPrompt, /OPERATING_MODE=CUSTOMER_IMAGE_RUNTIME/u);
assert.match(runtimeAdapter, /PROMPT-UNIFIED-EXECUTION\\.md\\?raw/u);
assert.match(runtimeAdapter, /OPERATING_MODE=CUSTOMER_IMAGE_RUNTIME/u);
assert.doesNotMatch(runtimeAdapter, /## CORE MISSION/u);
assert.match(generator, /TASK EXECUTION PROMPT/u);

assert.match(daily, /generate-repair-execution-prompts\.mjs/u);
assert.match(daily, /flixo-repair-execution-prompts-/u);
assert.match(daily, /prompt_source_run_id=/u);

assert.match(auto, /prompt_source_run_id:/u);
assert.match(auto, /FLIXO_EXECUTION_PROMPT_SOURCE=TRUSTED_WORKTREE_ONLY/u);
assert.doesNotMatch(auto, /Consume Daily Visit execution prompt bundle/u);
assert.doesNotMatch(auto, /gh run download/u);
assert.doesNotMatch(auto, /prompt bundle SHA/u);
assert.match(auto, /--execution-prompt=/u);

assert.match(taskAgent, /execution-prompt/u);
assert.match(taskAgent, /verifiedExactSha/u);
assert.match(taskAgent, /selectedPromptId/u);

console.log('REPAIR_EXECUTION_PROMPT_INTEGRATION_CONTRACT=PASS');