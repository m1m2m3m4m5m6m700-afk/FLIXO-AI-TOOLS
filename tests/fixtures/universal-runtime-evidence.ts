import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type RuntimeEvidence = {
  schema: 'flixo-runtime-evidence/v1';
  test: { title: string; file: string; project: string; retry: number; expectedStatus: string; status: string };
  timing: { startedAt: string; completedAt: string; durationMs: number };
  url: string;
  consoleErrors: Array<{ type: string; text: string }>;
  pageErrors: string[];
  requestFailures: Array<{ url: string; method: string; failure: string | null }>;
  failedResponses: Array<{ url: string; status: number; method: string }>;
};

async function install(page: Page, state: RuntimeEvidence['consoleErrors'], pageErrors: string[], requestFailures: RuntimeEvidence['requestFailures'], failedResponses: RuntimeEvidence['failedResponses']) {
  page.on('console', msg => { if (msg.type() === 'error') state.push({ type: msg.type(), text: msg.text() }); });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => requestFailures.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText ?? null }));
  page.on('response', response => { if (response.status() >= 400) failedResponses.push({ url: response.url(), status: response.status(), method: response.request().method() }); });
}

export const test = base.extend<{ runtimeEvidence: void }>({
  runtimeEvidence: async ({ page }, use, testInfo) => {
    const startedAt = new Date();
    const consoleErrors: RuntimeEvidence['consoleErrors'] = [];
    const pageErrors: string[] = [];
    const requestFailures: RuntimeEvidence['requestFailures'] = [];
    const failedResponses: RuntimeEvidence['failedResponses'] = [];
    await install(page, consoleErrors, pageErrors, requestFailures, failedResponses);
    await use();
    const completedAt = new Date();
    const evidence: RuntimeEvidence = { schema:'flixo-runtime-evidence/v1', test:{title:testInfo.title,file:testInfo.file,project:testInfo.project.name,retry:testInfo.retry,expectedStatus:testInfo.expectedStatus,status:testInfo.status}, timing:{startedAt:startedAt.toISOString(),completedAt:completedAt.toISOString(),durationMs:completedAt.getTime()-startedAt.getTime()}, url:page.url(), consoleErrors, pageErrors, requestFailures, failedResponses };
    await testInfo.attach('runtime-evidence.json',{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
    process.stdout.write(`RUNTIME_EVIDENCE=${JSON.stringify(evidence)}\n`);
  },
});

export { expect };
