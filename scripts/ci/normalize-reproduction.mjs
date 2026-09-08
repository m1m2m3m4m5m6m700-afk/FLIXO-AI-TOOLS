#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), 'diagnostics/ci/browser.json');
if (!existsSync(path)) process.exit(0);
try {
  const report = JSON.parse(readFileSync(path, 'utf8'));
  for (const check of report.checks ?? []) {
    if (check.status === 'FAIL') {
      check.repro = 'npx playwright test tests/localization-runtime.spec.ts --project=chromium --workers=1';
    }
  }
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  console.error(`Unable to normalize browser reproduction: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
