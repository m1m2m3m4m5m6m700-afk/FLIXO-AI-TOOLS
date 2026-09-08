import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';

type ConsoleEntry = {
  type: string;
  text: string;
  location?: { url?: string; lineNumber?: number; columnNumber?: number };
};

type PageErrorEntry = { message: string; name?: string; stack?: string };
type RequestFailureEntry = { method: string; url: string; failure?: string | null; resourceType?: string };
type ResponseFailureEntry = { status: number; statusText: string; method: string; url: string; resourceType?: string };
type NavigationEntry = { url: string; timestamp: string };

export type RuntimeEvidence = {
  schema_version: 1;
  test: {
    id: string;
    title: string;
    title_path: string[];
    file: string;
    project: string;
    retry: number;
    repeat_each_index: number;
    worker_index: number;
  };
  source: {
    exact_sha: string | null;
    ci: boolean;
  };
  runtime: {
    started_at: string;
    completed_at: string;
    duration_ms: number;
    status: TestInfo['status'];
    expected_status: TestInfo['expectedStatus'];
    final_url: string;
    navigation_count: number;
    console_error_count: number;
    page_error_count: number;
    request_failure_count: number;
    response_failure_count: number;
    state: 'clean' | 'degraded' | 'failed';
  };
  navigations: NavigationEntry[];
  console_errors: ConsoleEntry[];
  page_errors: PageErrorEntry[];
  request_failures: RequestFailureEntry[];
  response_failures: ResponseFailureEntry[];
  artifacts: {
    attachments: Array<{ name: string; content_type?: string; path?: string }>;
    screenshot: 'fixture-captured';
  };
};

function exactSha(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return process.env.GITHUB_SHA || null;
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function runtimeState(testInfo: TestInfo, consoleErrors: ConsoleEntry[], pageErrors: PageErrorEntry[], requestFailures: RequestFailureEntry[], responseFailures: ResponseFailureEntry[]): RuntimeEvidence['runtime']['state'] {
  const status = testInfo.status;
  if (status !== 'passed') return 'failed';
  if (consoleErrors.length || pageErrors.length || requestFailures.length || responseFailures.length) return 'degraded';
  return 'clean';
}

export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: [async ({ page }, use, testInfo) => {
    const startedAt = Date.now();
    const startedIso = new Date(startedAt).toISOString();
    const navigations: NavigationEntry[] = [];
    const consoleErrors: ConsoleEntry[] = [];
    const pageErrors: PageErrorEntry[] = [];
    const requestFailures: RequestFailureEntry[] = [];
    const responseFailures: ResponseFailureEntry[] = [];

    const onNavigation = (frame: { url: () => string }) => {
      navigations.push({ url: frame.url(), timestamp: isoNow() });
    };
    const onConsole = (message: { type: () => string; text: () => string; location: () => { url?: string; lineNumber?: number; columnNumber?: number } }) => {
      if (message.type() === 'error') {
        consoleErrors.push({ type: message.type(), text: message.text(), location: message.location() });
      }
    };
    const onPageError = (error: Error) => {
      pageErrors.push({ message: error.message, name: error.name, stack: error.stack });
    };
    const onRequestFailed = (request: { method: () => string; url: () => string; failure: () => { errorText?: string } | null; resourceType: () => string }) => {
      const failure = request.failure();
      requestFailures.push({ method: request.method(), url: request.url(), failure: failure?.errorText ?? null, resourceType: request.resourceType() });
    };
    const onResponse = (response: { status: () => number; statusText: () => string; request: () => { method: () => string; resourceType: () => string }; url: () => string }) => {
      const status = response.status();
      if (status >= 400) {
        const request = response.request();
        responseFailures.push({ status, statusText: response.statusText(), method: request.method(), url: response.url(), resourceType: request.resourceType() });
      }
    };

    page.on('framenavigated', onNavigation);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    try {
      await use();
    } finally {
      page.off('framenavigated', onNavigation);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);

      let screenshotPath: string | null = null;
      try {
        screenshotPath = testInfo.outputPath('runtime-evidence.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        screenshotPath = null;
      }

      const completedAt = Date.now();
      const attachments = testInfo.attachments.map((attachment) => ({
        name: attachment.name,
        content_type: attachment.contentType,
        path: attachment.path,
      }));
      if (screenshotPath) attachments.push({ name: 'runtime-evidence-screenshot', content_type: 'image/png', path: screenshotPath });

      const evidence: RuntimeEvidence = {
        schema_version: 1,
        test: {
          id: testInfo.testId,
          title: testInfo.title,
          title_path: testInfo.titlePath(),
          file: testInfo.file,
          project: testInfo.project.name,
          retry: testInfo.retry,
          repeat_each_index: testInfo.repeatEachIndex,
          worker_index: testInfo.workerIndex,
        },
        source: {
          exact_sha: exactSha(),
          ci: Boolean(process.env.CI || process.env.GITHUB_ACTIONS),
        },
        runtime: {
          started_at: startedIso,
          completed_at: new Date(completedAt).toISOString(),
          duration_ms: completedAt - startedAt,
          status: testInfo.status,
          expected_status: testInfo.expectedStatus,
          final_url: page.url(),
          navigation_count: navigations.length,
          console_error_count: consoleErrors.length,
          page_error_count: pageErrors.length,
          request_failure_count: requestFailures.length,
          response_failure_count: responseFailures.length,
          state: runtimeState(testInfo, consoleErrors, pageErrors, requestFailures, responseFailures),
        },
        navigations,
        console_errors: consoleErrors,
        page_errors: pageErrors,
        request_failures: requestFailures,
        response_failures: responseFailures,
        artifacts: {
          attachments,
          screenshot: 'fixture-captured',
        },
      };

      const output = testInfo.outputPath('runtime-evidence.json');
      mkdirSync(testInfo.outputDir, { recursive: true });
      writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`);
      await testInfo.attach('runtime-evidence', { path: output, contentType: 'application/json' });
    }
  }, { auto: true }],
});

export { expect, type Page };
