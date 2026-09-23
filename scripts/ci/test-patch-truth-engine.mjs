import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('scripts/ci/patch-truth-engine.mjs','utf8');
assert.ok(source.includes('PATCH_TEXT_IS_NEVER_AUTHORITATIVE'));
assert.ok(source.includes("git', ['diff', '--binary'"));
assert.ok(source.includes('PATCH_TRUTH_PATCH_DIGEST_MISMATCH'));
assert.ok(source.includes('PATCH_TRUTH_REJECTS_AGENT_PATCH_TEXT'));
console.log('PATCH_TRUTH_ENGINE_CONTRACT=PASS');
