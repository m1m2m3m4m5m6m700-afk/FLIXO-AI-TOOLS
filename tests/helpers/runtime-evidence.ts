import type { Page } from '@playwright/test';

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

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  page.on('requestfailed', (request) => {
    const failure = `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown request failure'}`;
    requestFailures.push(failure);
    if (/\.m?js(?:[?#]|$)/i.test(request.url())) failedJsRequests.push(failure);
  });

  return () => ({
    url: page.url(),
    pageErrors: [...pageErrors],
    consoleErrors: [...consoleErrors],
    requestFailures: [...requestFailures],
    failedJsRequests: [...failedJsRequests],
  });
}

export function assertNoRuntimeErrors(evidence: RuntimeEvidence): void {
  if (evidence.pageErrors.length || evidence.consoleErrors.length || evidence.requestFailures.length) {
    throw new Error(`Browser runtime evidence: ${JSON.stringify(evidence)}`);
  }
}
