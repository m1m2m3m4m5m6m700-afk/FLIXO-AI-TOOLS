import { execFileSync } from 'node:child_process';
import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

type ConsoleLocation = { url?: string; lineNumber?: number; columnNumber?: number };
type RuntimeEvidence = {
  schema: 'flixo-runtime-evidence/v2';
  source: { exactSha: string | null; ci: boolean };
  test: { id: string; title: string; file: string; project: string; retry: number; expectedStatus: string; status: string };
  timing: { startedAt: string; completedAt: string; durationMs: number };
  url: string;
  navigations: Array<{ url: string; timestamp: string }>;
  consoleErrors: Array<{ type: string; text: string; location: ConsoleLocation }>;
  pageErrors: Array<{ message: string; name?: string; stack?: string }>;
  requestFailures: Array<{ url: string; method: string; resourceType: string; failure: string | null }>;
  failedResponses: Array<{ url: string; status: number; statusText: string; method: string; resourceType: string }>;
  runtimeState: 'clean' | 'degraded' | 'failed';
};

function exactSha(): string | null {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    return sha || process.env.GITHUB_SHA || null;
  } catch {
    return process.env.GITHUB_SHA || null;
  }
}

export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: [async ({ page }, runTest, testInfo) => {
    const startedAt = new Date();
    const consoleErrors: RuntimeEvidence['consoleErrors'] = [];
    const pageErrors: RuntimeEvidence['pageErrors'] = [];
    const requestFailures: RuntimeEvidence['requestFailures'] = [];
    const failedResponses: RuntimeEvidence['failedResponses'] = [];
    const navigations: RuntimeEvidence['navigations'] = [];

    const onNavigation = (frame: { url: () => string }) => {
      navigations.push({ url: frame.url(), timestamp: new Date().toISOString() });
    };
    const onConsole = (message: { type: () => string; text: () => string; location: () => ConsoleLocation }) => {
      if (message.type() === 'error') consoleErrors.push({ type: message.type(), text: message.text(), location: message.location() });
    };
    const onPageError = (error: Error) => pageErrors.push({ message: error.message, name: error.name, stack: error.stack });
    const onRequestFailed = (request: { url: () => string; method: () => string; resourceType: () => string; failure: () => { errorText?: string } | null }) => {
      requestFailures.push({ url: request.url(), method: request.method(), resourceType: request.resourceType(), failure: request.failure()?.errorText ?? null });
    };
    const onResponse = (response: { url: () => string; status: () => number; statusText: () => string; request: () => { method: () => string; resourceType: () => string } }) => {
      const status = response.status();
      if (status >= 400) {
        const request = response.request();
        failedResponses.push({ url: response.url(), status, statusText: response.statusText(), method: request.method(), resourceType: request.resourceType() });
      }
    };

    page.on('framenavigated', onNavigation);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    try {
      await runTest();
    } finally {
      page.off('framenavigated', onNavigation);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);

      const completedAt = new Date();
      const status = testInfo.status;
      const runtimeState: RuntimeEvidence['runtimeState'] = status !== 'passed'
        ? 'failed'
        : consoleErrors.length || pageErrors.length || requestFailures.length || failedResponses.length
          ? 'degraded'
          : 'clean';

      const evidence: RuntimeEvidence = {
        schema: 'flixo-runtime-evidence/v2',
        source: { exactSha: exactSha(), ci: Boolean(process.env.CI || process.env.GITHUB_ACTIONS) },
        test: {
          id: testInfo.testId,
          title: testInfo.title,
          file: testInfo.file,
          project: testInfo.project.name,
          retry: testInfo.retry,
          expectedStatus: testInfo.expectedStatus,
          status,
        },
        timing: { startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() },
        url: page.url(),
        navigations,
        consoleErrors,
        pageErrors,
        requestFailures,
        failedResponses,
        runtimeState,
      };

      await testInfo.attach('runtime-evidence.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
      process.stdout.write(`RUNTIME_EVIDENCE=${JSON.stringify(evidence)}\n`);
    }
  }, { auto: true }],
});

export { expect, type Locator, type Page, type TestInfo };
