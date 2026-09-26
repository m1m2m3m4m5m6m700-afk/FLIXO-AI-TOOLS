import { test as base, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

type ConsoleLocation = { url?: string; lineNumber?: number; columnNumber?: number };
type ConsoleMessageLike = {
  type: () => string;
  text: () => string;
  location: () => ConsoleLocation;
  args: () => Array<{ jsonValue: () => Promise<unknown> }>;
};

type BrowserObservationEvidence = {
  schemaVersion: 1;
  exactSha: string | null;
  url: string;
  document: {
    title: string;
    lang: string;
    dir: string;
    readyState: string;
    mainCount: number;
    h1Count: number;
  };
  performance: {
    domContentLoadedMs: number | null;
    loadEventMs: number | null;
    firstContentfulPaintMs: number | null;
    resourceCount: number;
  };
};

type RuntimeEvidence = {
  schema: 'flixo-runtime-evidence/v4';
  source: { exactSha: string | null; ci: boolean; exactShaState: 'BOUND' | 'MISSING_CI' | 'LOCAL' };
  test: { id: string; title: string; file: string; project: string; retry: number; expectedStatus: string; status: string };
  timing: { startedAt: string; completedAt: string; durationMs: number };
  url: string;
  navigations: Array<{ url: string; timestamp: string }>;
  browserObservation: BrowserObservationEvidence;
  consoleErrors: Array<{ type: string; text: string; location: ConsoleLocation }>;
  pageErrors: Array<{ message: string; name?: string; stack?: string }>;
  requestFailures: Array<{ url: string; method: string; resourceType: string; failure: string | null }>;
  failedResponses: Array<{ url: string; status: number; statusText: string; method: string; resourceType: string }>;
  runtimeState: 'clean' | 'degraded' | 'failed';
};

function exactSha(): string | null {
  return [process.env.EXPECTED_SHA, process.env.GITHUB_SHA]
    .map((value) => String(value ?? '').trim())
    .find((value) => /^[a-f0-9]{40}$/u.test(value)) || null;
}

async function serializeConsoleMessage(message: ConsoleMessageLike): Promise<string> {
  const parts: string[] = [];
  for (const arg of message.args()) {
    try {
      const value = await arg.jsonValue();
      parts.push(typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value));
    } catch {
      // Fall back to the browser-rendered console text.
    }
  }
  return parts.filter(Boolean).join(' ') || message.text();
}

async function captureBrowserObservation(page: Page, sha: string | null): Promise<BrowserObservationEvidence> {
  try {
    return await page.evaluate((exactShaValue) => {
      const navigation = performance.getEntriesByType('navigation').at(-1) as PerformanceNavigationTiming | undefined;
      const paint = performance.getEntriesByName('first-contentful-paint').at(-1);
      return {
        schemaVersion: 1 as const,
        exactSha: exactShaValue,
        url: window.location.origin + window.location.pathname,
        document: {
          title: document.title.trim().slice(0, 500),
          lang: document.documentElement.lang || '',
          dir: document.documentElement.dir || 'ltr',
          readyState: document.readyState,
          mainCount: document.querySelectorAll('main').length,
          h1Count: document.querySelectorAll('h1').length,
        },
        performance: {
          domContentLoadedMs: navigation ? Math.max(0, navigation.domContentLoadedEventEnd) : null,
          loadEventMs: navigation ? Math.max(0, navigation.loadEventEnd) : null,
          firstContentfulPaintMs: paint ? Math.max(0, paint.startTime) : null,
          resourceCount: performance.getEntriesByType('resource').length,
        },
      };
    }, sha);
  } catch {
    return {
      schemaVersion: 1,
      exactSha: sha,
      url: page.url().split(/[?#]/u, 1)[0] || page.url(),
      document: { title: '', lang: '', dir: '', readyState: 'unknown', mainCount: 0, h1Count: 0 },
      performance: { domContentLoadedMs: null, loadEventMs: null, firstContentfulPaintMs: null, resourceCount: 0 },
    };
  }
}

export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: [async ({ page }, runTest, testInfo) => {
    const startedAt = new Date();
    const ci = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
    const sha = exactSha();
    const exactShaState: RuntimeEvidence['source']['exactShaState'] = sha ? 'BOUND' : ci ? 'MISSING_CI' : 'LOCAL';
    const consoleErrors: RuntimeEvidence['consoleErrors'] = [];
    const consoleErrorPromises: Promise<void>[] = [];
    const pageErrors: RuntimeEvidence['pageErrors'] = [];
    const requestFailures: RuntimeEvidence['requestFailures'] = [];
    const failedResponses: RuntimeEvidence['failedResponses'] = [];
    const navigations: RuntimeEvidence['navigations'] = [];

    const onNavigation = (frame: { url: () => string }) => navigations.push({ url: frame.url(), timestamp: new Date().toISOString() });
    const onConsole = (message: ConsoleMessageLike) => {
      if (message.type() === 'error') {
        consoleErrorPromises.push(serializeConsoleMessage(message).then((text) => {
          consoleErrors.push({ type: message.type(), text, location: message.location() });
        }));
      }
    };
    const onPageError = (error: Error) => pageErrors.push({ message: error.message, name: error.name, stack: error.stack });
    const onRequestFailed = (request: { url: () => string; method: () => string; resourceType: () => string; failure: () => { errorText?: string } | null }) => {
      requestFailures.push({ url: request.url(), method: request.method(), resourceType: request.resourceType(), failure: request.failure()?.errorText ?? null });
    };
    const onResponse = (response: { url: () => string; status: () => number; statusText: () => string; request: () => { method: () => string; resourceType: () => string } }) => {
      if (response.status() >= 400) {
        const request = response.request();
        failedResponses.push({ url: response.url(), status: response.status(), statusText: response.statusText(), method: request.method(), resourceType: request.resourceType() });
      }
    };
    const onRoute = async (route: { request: () => { headers: () => Record<string, string> }; continue: (options?: { headers?: Record<string, string> }) => Promise<void> }) => {
      const headers = { ...route.request().headers() };
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
      await route.continue({ headers });
    };

    page.on('framenavigated', onNavigation);
    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);
    await page.route('**/*', onRoute);

    let teardownFailure: Error | null = null;
    try {
      await runTest();
    } finally {
      if (!page.isClosed()) {
        try { await page.unroute('**/*', onRoute); }
        catch (error) {
          if (!String(error).includes('NS_BINDING_ABORTED')) teardownFailure = error instanceof Error ? error : new Error(String(error));
        }
      }
      page.off('framenavigated', onNavigation);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
      await Promise.all(consoleErrorPromises);

      const completedAt = new Date();
      const status = testInfo.status;
      const browserObservation = await captureBrowserObservation(page, sha);
      const runtimeState: RuntimeEvidence['runtimeState'] = (
        status !== 'passed'
        || exactShaState === 'MISSING_CI'
      ) ? 'failed'
        : (consoleErrors.length || pageErrors.length || requestFailures.length || failedResponses.length
          ? 'degraded'
          : 'clean');
      const evidence: RuntimeEvidence = {
        schema: 'flixo-runtime-evidence/v4',
        source: { exactSha: sha, ci, exactShaState },
        test: {
          id: testInfo.testId, title: testInfo.title, file: testInfo.file, project: testInfo.project.name,
          retry: testInfo.retry, expectedStatus: testInfo.expectedStatus, status,
        },
        timing: { startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString(), durationMs: completedAt.getTime() - startedAt.getTime() },
        url: page.url(), navigations, browserObservation, consoleErrors, pageErrors, requestFailures, failedResponses,
        runtimeState,
      };
      await testInfo.attach('runtime-evidence.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
      await testInfo.attach('browser-observation.json', { body: JSON.stringify(browserObservation, null, 2), contentType: 'application/json' });
      process.stdout.write(`RUNTIME_EVIDENCE=${JSON.stringify(evidence)}\n`);
    }
    if (teardownFailure && testInfo.status === 'passed') throw teardownFailure;
  }, { auto: true }],
});

export { expect, type Locator, type Page, type TestInfo };
