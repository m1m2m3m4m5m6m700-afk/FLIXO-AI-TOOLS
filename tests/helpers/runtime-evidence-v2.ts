import type { ConsoleMessage, Page, Request } from '@playwright/test';

export type RuntimeEvidence = {
  url: string;
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: string[];
  failedJsRequests: string[];
};

export function installRuntimeEvidence(page: Page): () => RuntimeEvidence {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const failedJsRequests: string[] = [];

  const onPageError = (error: Error) => pageErrors.push(error.stack || error.message);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onRequestFailed = (request: Request) => {
    const failure = `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown request failure'}`;
    requestFailures.push(failure);
    if (/(?:\.m?js|\.tsx?|\.jsx?)(?:[?#]|$)/i.test(request.url())) failedJsRequests.push(failure);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);

  return () => {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    return {
      url: page.url(),
      pageErrors: [...pageErrors],
      consoleErrors: [...consoleErrors],
      requestFailures: [...requestFailures],
      failedJsRequests: [...failedJsRequests],
    } satisfies RuntimeEvidence;
  };
}

export function runtimeEvidenceError(evidence: RuntimeEvidence): Error {
  return new Error(`Browser runtime evidence: ${JSON.stringify(evidence)}`);
}
