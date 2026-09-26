import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.VITE_SITE_URL = process.env.VITE_SITE_URL || 'https://flixoai.vercel.app';

const { TOOL_REGISTRY } = await import('../src/config/registry.ts');
const { MVP_EXECUTABLE_TOOL_IDS } = await import('../src/config/canonical-tool-definition.ts');
const {
  CAPABILITY_REGISTRY,
  getExecutableCapabilityIds,
} = await import('../src/lib/agent/capability-registry.ts');
const { authorizeCapabilityAccess } = await import('../src/lib/agent/capability-access.ts');
const { planFromIntent } = await import('../src/lib/ai/planner.ts');
const { planWithOptionalAI } = await import('../src/lib/ai/optional-planner.ts');
const {
  EXECUTION_PLAN_FUNCTION_CONTRACT,
  planWithProviderOrLocal,
} = await import('../src/lib/agent/llm-provider.ts');
const { assertExecutorCoverage } = await import('../src/lib/workflows/executor-registry.ts');
const {
  assertReadyToolsHaveOutputContracts,
  TOOL_OUTPUT_CONTRACTS,
} = await import('../src/lib/contracts/tool-output-contracts.ts');
const { assertToolOutputContract } = await import('../src/lib/contracts/tool-output.ts');
const {
  assessVisualGoal,
  deriveVisualGoalSpec,
} = await import('../src/lib/agent/visual-goal-verifier.ts');

test('canonical executable capability registry is exact and executor-complete', () => {
  const actual = [...getExecutableCapabilityIds()].sort();
  const expected = [...MVP_EXECUTABLE_TOOL_IDS].sort();
  assert.deepEqual(actual, expected);
  assertExecutorCoverage(TOOL_REGISTRY);

  for (const id of expected) {
    const tool = TOOL_REGISTRY.find((candidate) => candidate.id === id);
    const capability = CAPABILITY_REGISTRY.find((candidate) => candidate.id === id);
    assert.ok(tool);
    assert.ok(capability);
    assert.equal(tool.capability.state, 'EXECUTABLE');
    assert.equal(tool.isReady, true);
    assert.equal(tool.executionMode, 'LOCAL');
    assert.equal(tool.requirements.network, false);
    assert.equal(tool.operational.lifecycle, 'ready');
    assert.equal(tool.operational.executorId, id);
    assert.equal(tool.operational.outputContractId, id);
    assert.equal(capability.state, 'EXECUTABLE');
  }
});

test('video capabilities have real canonical executors and WebM artifact contracts', () => {
  for (const id of ['video-trimmer', 'video-cropper', 'video-resizer', 'video-compressor']) {
    const tool = TOOL_REGISTRY.find((candidate) => candidate.id === id);
    assert.ok(tool);
    assert.equal(tool?.executionMode, 'LOCAL');
    assert.equal(tool?.requirements.network, false);
    assert.equal(tool?.operational.executorId, id);
    assert.equal(TOOL_OUTPUT_CONTRACTS[id]?.variants[0]?.outputMimeTypes.includes('video/webm'), true);
    assert.equal(TOOL_OUTPUT_CONTRACTS[id]?.variants[0]?.signatures?.includes('1a45dfa3'), true);
  }
});

test('every ready tool is bound to a canonical output contract', () => {
  assert.doesNotThrow(() => assertReadyToolsHaveOutputContracts());
  const readyIds = new Set(TOOL_REGISTRY.filter((tool) => tool.isReady).map((tool) => tool.id));
  assert.deepEqual(
    new Set(Object.keys(TOOL_OUTPUT_CONTRACTS)),
    readyIds,
  );
});

test('deterministic planner resolves representative English and Arabic intents', () => {
  const compression = planFromIntent('compress my image');
  assert.ok(compression);
  assert.equal(compression?.steps.length, 1);
  assert.equal(compression?.steps[0]?.toolId, 'image-compressor');
  assert.equal(compression?.catalogFingerprint.length, 64);

  const arabic = planFromIntent('ضغط الصور');
  assert.ok(arabic);
  assert.equal(arabic?.steps[0]?.toolId, 'image-compressor');

  const product = planFromIntent('prepare a product image for a shop, square');
  assert.ok(product);
  assert.deepEqual(
    product?.steps.map((step) => step.toolId),
    ['background-remover', 'image-cropper'],
  );
});

test('optional AI always falls back to deterministic planning on bad provider output', async () => {
  const rejected = await planWithOptionalAI(
    'compress my image',
    async () => ({ malformed: true }),
  );
  assert.equal(rejected.source, 'deterministic');
  assert.equal(rejected.plan?.steps[0]?.toolId, 'image-compressor');

  const local = planFromIntent('compress my image');
  assert.ok(local);
  const accepted = await planWithOptionalAI(
    'compress my image',
    async () => local,
  );
  assert.equal(accepted.source, 'ai');
  assert.equal(accepted.plan?.catalogFingerprint, local?.catalogFingerprint);
});

test('production provider failure returns a deterministic local plan with failure evidence', async () => {
  const result = await planWithProviderOrLocal(
    async () => {
      throw new Error('simulated provider outage');
    },
    'compress my image',
    { maxRetries: 0 },
  );

  assert.equal(result.source, 'local');
  assert.equal(result.plan?.steps[0]?.toolId, 'image-compressor');
  assert.ok(result.providerFailure);
  assert.ok(result.attempts >= 1);
  assert.match(EXECUTION_PLAN_FUNCTION_CONTRACT.description, /never executes tools/i);
});

test('capability access blocks execution of non-executable capabilities', () => {
  const access = authorizeCapabilityAccess({
    capabilityId: 'image-compressor',
    requestedPermission: 'EXECUTE',
    actorTrust: 'CORE',
    parameters: { quality: 0.7 },
  });
  assert.equal(access.permission, 'EXECUTE');
  assert.equal(access.localOnly, true);
  assert.equal(access.network, false);
  assert.throws(
    () => authorizeCapabilityAccess({
      capabilityId: 'image-ocr',
      requestedPermission: 'EXECUTE',
      actorTrust: 'CORE',
    }),
    /CAPABILITY_EXECUTION_DENIED:image-ocr/,
  );
});

test('image artifact contracts reject malformed output signatures', () => {
  const pngSignature = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => assertToolOutputContract(
    TOOL_OUTPUT_CONTRACTS['image-compressor'],
    {
      mimeType: 'image/png',
      byteLength: pngSignature.length,
      bytes: pngSignature,
      filename: 'result.png',
      dimensions: { width: 1, height: 1 },
    },
  ));
  assert.throws(() => assertToolOutputContract(
    TOOL_OUTPUT_CONTRACTS['image-compressor'],
    {
      mimeType: 'image/png',
      byteLength: pngSignature.length,
      bytes: Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]),
      filename: 'result.png',
      dimensions: { width: 1, height: 1 },
    },
  ), /Invalid signature/);
});

test('visual goal verification enforces resize geometry and meaningful effects', () => {
  const input2x2 = {
    width: 2,
    height: 2,
    pixels: new Uint8Array(2 * 2 * 4).fill(128),
  };
  const output4x4 = {
    width: 4,
    height: 4,
    pixels: new Uint8Array(4 * 4 * 4).fill(128),
  };
  const resizeReport = assessVisualGoal(
    deriveVisualGoalSpec('image-upscaler', { scale: 2 }),
    input2x2,
    output4x4,
  );
  assert.equal(resizeReport.verified, true);
  assert.equal(resizeReport.geometryVerified, true);

  const inputPixel = {
    width: 1,
    height: 1,
    pixels: Uint8Array.from([255, 0, 0, 255]),
  };
  const changedPixel = {
    width: 1,
    height: 1,
    pixels: Uint8Array.from([128, 0, 0, 255]),
  };
  const changed = assessVisualGoal(
    deriveVisualGoalSpec('image-effects', { brightness: 50 }),
    inputPixel,
    changedPixel,
  );
  assert.equal(changed.verified, true);
  assert.equal(changed.visibleChangeVerified, true);

  const unchanged = assessVisualGoal(
    deriveVisualGoalSpec('image-effects', { brightness: 50 }),
    inputPixel,
    inputPixel,
  );
  assert.equal(unchanged.verified, false);
  assert.equal(unchanged.visibleChangeVerified, false);
});
