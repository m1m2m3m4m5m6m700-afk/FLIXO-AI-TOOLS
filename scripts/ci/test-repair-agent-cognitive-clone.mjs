import assert from 'node:assert/strict';
import fs from 'node:fs';

const clone = fs.readFileSync('scripts/ci/repair-agent-cognitive-clone.mjs', 'utf8');
const validator = fs.readFileSync('scripts/ci/validate-repair-agent-cognitive-clone.mjs', 'utf8');
const training = fs.readFileSync('scripts/ci/repair-bot-training.mjs', 'utf8');
const workflow = fs.readFileSync('.github/workflows/auto-repair.yml', 'utf8');
const registry = JSON.parse(fs.readFileSync('docs/agents/ACTION-REPAIR-SQUAD-REGISTRY.json', 'utf8'));

assert.match(clone, /FLIXO-REPAIR-AGENT-COGNITIVE-CLONE-v1/);
assert.match(clone, /trainRepairBot/);
assert.match(clone, /sameCognitiveEngine: true/);
assert.match(clone, /mutationAuthority: false/);
assert.match(clone, /greenAuthority: false/);
assert.match(clone, /promotionRule: 'ONLY_AFTER_CANONICAL_GREEN'/);
assert.doesNotMatch(clone, /git['"],\s*\[[^\]]*push/i);
assert.doesNotMatch(clone, /gh['"],\s*\[[^\]]*workflow\s+run/i);
assert.doesNotMatch(clone, /update-ref/i);

assert.match(validator, /REPAIR_AGENT_CLONE_CONTRACT_MISMATCH/);
assert.match(training, /TRAINING_INFLUENCES_SELECTION_BUT_NEVER_GRANTS_MUTATION_OR_GREEN_AUTHORITY/);
assert.match(workflow, /Run independent cognitive clone for Repair Agent/);
assert.match(workflow, /repair-agent-cognitive-clone\.mjs/);
assert.match(workflow, /validate-repair-agent-cognitive-clone\.mjs/);

assert.equal(registry.cognitiveClone?.id, 'REPAIR-AGENT-COGNITIVE-CLONE');
assert.equal(registry.cognitiveClone?.cognitiveParity, 'EXACT');
assert.equal(registry.cognitiveClone?.mutationAuthority, false);
assert.equal(registry.cognitiveClone?.greenAuthority, false);
assert.equal(registry.cognitiveClone?.learning?.promoteAfterCanonicalGreen, true);

console.log('REPAIR_AGENT_COGNITIVE_CLONE_CONTRACT=PASS');
