import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOOL_REGISTRY } from '../src/config/registry.ts';
import { MVP_EXECUTABLE_TOOL_IDS } from '../src/lib/agent/canonical-capability-definition.ts';
import { getCanonicalMvpAgentTools } from '../src/lib/agent/mvp-agent-surface.ts';

test('Agent Workbench exposes exactly the canonical executable MVP surface', () => {
  const visible = getCanonicalMvpAgentTools(TOOL_REGISTRY);
  const actual = visible.map((tool) => tool.id).sort();
  const expected = [...MVP_EXECUTABLE_TOOL_IDS].sort();

  assert.deepEqual(actual, expected);
  assert.equal(visible.length, MVP_EXECUTABLE_TOOL_IDS.length);
  assert.equal(visible.some((tool) => tool.id === 'image-ocr'), false);

  for (const tool of visible) {
    assert.equal(tool.capability.state, 'EXECUTABLE');
    assert.equal(tool.isReady, true);
    assert.equal(tool.executionMode, 'LOCAL');
    assert.equal(tool.requirements.network, false);
  }
});
