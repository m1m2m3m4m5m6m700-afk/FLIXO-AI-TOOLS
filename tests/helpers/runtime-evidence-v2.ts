import type { ConsoleMessage, Page, Request, Response } from '@playwright/test';

export type RuntimeEvidence = {
  url: string;
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: string[];
  failedJsRequests: string[];
  failedJsResponses: string[];
};

export function installRuntimeEvidence(page: Page): () => RuntimeEvidence {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const failedJsRequests: string[] = [];
  const failedJsResponses: string[] = [];

  const onPageError = (error: Error) => pageErrors.push(error.stack || error.message);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  };
  const onRequestFailed = (request: Request) => {
    const failure = `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown request failure'}`;
    requestFailures.push(failure);
    if (request.resourceType() === 'script') failedJsRequests.push(failure);
  };
  const onResponse = (response: Response) => {
    if (response.request().resourceType() !== 'script' || response.status() < 400) return;
    failedJsResponses.push(`${response.request().method()} ${response.url()} :: HTTP ${response.status()}`);
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return () => {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);
    return {
      url: page.url(),
      pageErrors: [...pageErrors],
      consoleErrors: [...consoleErrors],
      requestFailures: [...requestFailures],
      failedJsRequests: [...failedJsRequests],
      failedJsResponses: [...failedJsResponses],
    } satisfies RuntimeEvidence;
  };
}

export function runtimeEvidenceError(evidence: RuntimeEvidence): Error {
  return new Error(`Browser runtime evidence: ${JSON.stringify(evidence)}`);
}
