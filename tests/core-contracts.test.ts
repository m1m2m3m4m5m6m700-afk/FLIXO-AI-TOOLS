import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.VITE_SITE_URL = process.env.VITE_SITE_URL || 'https://flixoai.vercel.app';

const { CANONICAL_LOCALES, DEFAULT_LOCALE, LOCALE_METADATA, normalizeLocale } =
  await import('../src/lib/i18n/config.ts');
const { getLocalizedToolPath, getLocalizedToolUrl } =
  await import('../src/lib/routing/route-resolver.ts');
const {
  assertSafeImageInput,
  IMAGE_COMPRESSOR_MAX_INPUT_SIZE,
  IMAGE_COMPRESSOR_MAX_PIXELS,
} = await import('../src/tools/image-compressor/file-safety.ts');
const { solveMath, verifyMathReceipt } =
  await import('../packages/agent-runtime/src/math-engine.ts');
const { decomposeTask } = await import('../src/lib/agent/task-decomposer.ts');
const {
  createMissionContract,
  canExecuteMissionTask,
  transitionMissionTask,
  recordMissionEvidence,
  assertMissionComplete,
  missionStatus,
} = await import('../src/lib/agent/mission-contract.ts');
const { buildAgentOutcome } = await import('../src/lib/agent/cognitive-outcome.ts');

test('i18n exposes the exact 20-locale production contract', () => {
  assert.deepEqual([...CANONICAL_LOCALES], [
    'ar','en','es','fr','de','hi','id','it','ja','ko',
    'ms','nl','pl','pt','ru','sv','th','tr','uk','vi',
  ]);
  assert.equal(DEFAULT_LOCALE, 'ar');
  assert.equal(LOCALE_METADATA.ar.direction, 'rtl');
  assert.equal(LOCALE_METADATA.en.direction, 'ltr');
  assert.equal(normalizeLocale('ar-EG'), 'ar');
  assert.equal(normalizeLocale('unknown'), 'ar');
});

test('routing resolves every tool path from the locale contract', () => {
  const tool = { path: '/en/image-compressor' };
  assert.equal(getLocalizedToolPath(tool, 'ar'), '/ar/image-compressor');
  assert.equal(getLocalizedToolPath({ path: '/image-compressor' }, 'vi'), '/vi/image-compressor');
  assert.equal(getLocalizedToolUrl('https://flixoai.vercel.app', tool, 'de'), 'https://flixoai.vercel.app/de/image-compressor');
  assert.throws(() => getLocalizedToolPath({ path: '/en/image-compressor?x=1' }, 'en'), /query\/hash/);
});

test('image compressor safety protects size and pixel boundaries', () => {
  const file = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 };
  assert.doesNotThrow(() => assertSafeImageInput(file));
  assert.doesNotThrow(() => assertSafeImageInput(file, { width: 4000, height: 3000 }));
  assert.throws(() => assertSafeImageInput({ ...file, type: 'application/octet-stream' }), /Unsupported image format/);
  assert.throws(() => assertSafeImageInput({ ...file, size: IMAGE_COMPRESSOR_MAX_INPUT_SIZE + 1 }), /10 MB browser limit/);
  assert.throws(() => assertSafeImageInput(file, { width: 0, height: 3000 }), /invalid dimensions/);
  assert.throws(() => assertSafeImageInput(file, { width: 4001, height: 10000 }), /too large for safe browser processing/);
  assert.equal(IMAGE_COMPRESSOR_MAX_PIXELS, 40_000_000);
});

test('math engine uses a constrained arithmetic grammar', () => {
  assert.equal(solveMath({ expression: '2 + 3 * 4' }).value, 14);
  assert.equal(solveMath({ expression: '(2 + 3) * 4' }).value, 20);
  assert.equal(solveMath({ expression: '2 ^ 3 ^ 2' }).value, 512);
  assert.equal(solveMath({ expression: '10 / 4' }).value, 2.5);
  assert.equal(solveMath({ expression: '-5 + 2' }).value, -3);
  assert.throws(() => solveMath({ expression: '1 / 0' }), /MATH_DIVISION_BY_ZERO/);
  assert.throws(() => solveMath({ expression: 'Math.max(1, 2)' }), /MATH_EXPRESSION_UNSUPPORTED/);
  const receipt = solveMath({ expression: '6 * 7' });
  assert.equal(typeof receipt.timestamp, 'string');
  assert.equal(verifyMathReceipt(receipt), true);
  assert.equal(verifyMathReceipt({ ...receipt, value: 43 }), false);
});


test('mission contracts enforce dependency order and exact-SHA evidence', () => {
  const exactSha = 'a'.repeat(40);
  const mission = createMissionContract({
    missionId: 'mission-test',
    traceId: 'trace-test',
    exactSha,
    objective: 'compress then convert',
    decomposition: decomposeTask('compress then convert', { force: true }),
    createdAt: '2026-09-26T00:00:00.000Z',
  });

  const firstId = mission.tasks[0].task.id;
  const dependentId = mission.tasks[1].task.id;
  assert.equal(canExecuteMissionTask(mission, firstId), true);
  assert.equal(canExecuteMissionTask(mission, dependentId), false);

  let next = transitionMissionTask(mission, firstId, 'AWAITING_CONFIRMATION');
  next = transitionMissionTask(next, firstId, 'EXECUTING');
  next = transitionMissionTask(next, firstId, 'VERIFYING');
  next = transitionMissionTask(next, firstId, 'COMPLETED');

  assert.equal(canExecuteMissionTask(next, dependentId), true);
  assert.throws(
    () => recordMissionEvidence(next, {
      id: 'evidence-bad-sha',
      taskId: firstId,
      exactSha: 'b'.repeat(40),
      kind: 'VERIFICATION',
      claim: 'wrong sha must be rejected',
      verified: true,
      source: 'test',
      capturedAt: '2026-09-26T00:00:00.000Z',
    }),
    /MISSION_EVIDENCE_SHA_MISMATCH/,
  );

  next = recordMissionEvidence(next, {
    id: 'evidence-first',
    taskId: firstId,
    kind: 'VERIFICATION',
    claim: 'first task verified',
    verified: true,
    source: 'test',
    capturedAt: '2026-09-26T00:00:00.000Z',
  });
  assert.equal(missionStatus(next), 'PLANNED');
});

test('mission completion requires verified evidence for every task', () => {
  const exactSha = 'c'.repeat(40);
  let mission = createMissionContract({
    missionId: 'mission-complete',
    traceId: 'trace-complete',
    exactSha,
    objective: 'single task',
    decomposition: decomposeTask('compress', { force: false }),
  });

  const taskIds = mission.tasks.map((task) => task.task.id);
  assert.ok(taskIds.length >= 2);

  assert.throws(() => assertMissionComplete(mission), /MISSION_INCOMPLETE_TASKS/);

  for (const task of mission.tasks) {
    mission = transitionMissionTask(mission, task.task.id, 'AWAITING_CONFIRMATION');
    mission = transitionMissionTask(mission, task.task.id, 'EXECUTING');
    mission = transitionMissionTask(mission, task.task.id, 'VERIFYING');
    mission = transitionMissionTask(mission, task.task.id, 'COMPLETED');
    mission = recordMissionEvidence(mission, {
      id: 'evidence-' + task.task.id,
      taskId: task.task.id,
      kind: 'VERIFICATION',
      claim: 'task verified',
      verified: true,
      source: 'test',
      capturedAt: '2026-09-26T00:00:00.000Z',
    });
  }

  assert.doesNotThrow(() => assertMissionComplete(mission));
  assert.equal(missionStatus(mission), 'COMPLETED');
});

test('agent outcomes distinguish stale SHA from verified current SHA', () => {
  const exactSha = 'd'.repeat(40);
  const staleSha = 'e'.repeat(40);
  const common = {
    missionId: 'mission-sha',
    taskId: 'task-sha',
    botId: 'agent-sha',
    exactSha,
    outcome: 'SUCCESS' as const,
    capabilityId: 'image-compressor',
    inputDescription: 'image compression',
    verified: true,
    validationPassed: true,
    evidenceRefs: ['evidence-sha'],
  };

  const stale = buildAgentOutcome({ ...common, currentSha: staleSha });
  assert.equal(stale.learning, 'PROVISIONAL_LESSON');

  const current = buildAgentOutcome({ ...common, currentSha: exactSha });
  assert.equal(current.learning, 'VERIFIED_KNOWLEDGE');
});
