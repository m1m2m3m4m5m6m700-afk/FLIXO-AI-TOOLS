import { test as base, expect } from '@playwright/test';
import { installRuntimeEvidence, type RuntimeEvidence } from './tests/helpers/runtime-evidence-v2';

export type RuntimeEvidenceAttachment = RuntimeEvidence & {
  schema: 'flixo-playwright-runtime-evidence/v1';
  sha: string | null;
  project: string;
  testId: string;
  title: string;
  file: string;
  status: string;
  expectedStatus: string;
  durationMs: number;
  retry: number;
  workerIndex: number;
};

type Fixtures = {
  runtimeEvidence: void;
};

const executionSha = () => process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA ?? null;

export const test = base.extend<Fixtures>({
  runtimeEvidence: [async ({ page }, use, testInfo) => {
    const stop = installRuntimeEvidence(page);
    await use();

    const captured = stop();
    const evidence: RuntimeEvidenceAttachment = {
      schema: 'flixo-playwright-runtime-evidence/v1',
      sha: executionSha(),
      project: testInfo.project.name,
      testId: testInfo.testId,
      title: testInfo.titlePath.join(' › '),
      file: testInfo.file,
      status: testInfo.status,
      expectedStatus: testInfo.expectedStatus,
      durationMs: testInfo.duration,
      retry: testInfo.retry,
      workerIndex: testInfo.workerIndex,
      ...captured,
    };

    const hasFailureEvidence =
      testInfo.status !== testInfo.expectedStatus ||
      captured.pageErrors.length > 0 ||
      captured.consoleErrors.length > 0 ||
      captured.requestFailures.length > 0 ||
      captured.failedJsRequests.length > 0;

    if (!hasFailureEvidence) return;

    const body = `${JSON.stringify(evidence, null, 2)}\n`;
    try {
      await testInfo.attach('runtime-evidence.json', {
        body: Buffer.from(body, 'utf8'),
        contentType: 'application/json',
      });
    } catch {
      // Evidence attachment must never replace or mask the original test failure.
    }

    console.error(`RUNTIME_EVIDENCE=${JSON.stringify(evidence)}`);
  }, { auto: true }],
});

export { expect };
export * from '@playwright/test';
