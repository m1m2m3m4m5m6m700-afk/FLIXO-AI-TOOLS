import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test, expect } from '@playwright/test';

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci-executive.yml');
const executorPath = path.join(repoRoot, 'scripts', 'ci', 'execute-executive-job.mjs');
const extractorPath = path.join(repoRoot, 'scripts', 'extract-errors.mjs');
const aggregatorPath = path.join(repoRoot, 'scripts', 'collect-executive-errors.mjs');

const EXECUTIVE_JOBS = Array.from({ length: 18 }, (_, index) => `CI-${String(index + 1).padStart(3, '0')}`);

test.describe('Executive Contract Integration', () => {
  test('workflow declares exactly CI-001 through CI-018', async () => {
    const source = await readFile(workflowPath, 'utf8');
    const jobs = [...source.matchAll(/^ {2}(CI-\d{3}|ci-\d{3}):$/gim)].map((match) => match[1].toUpperCase());
    expect([...new Set(jobs)].sort()).toEqual(EXECUTIVE_JOBS);
  });

  test('extractor creates job-errors.json with structured findings', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'flixo-extractor-'));
    try {
      const input = path.join(tempDir, 'combined.log');
      const output = path.join(tempDir, 'job-errors.json');
      await writeFile(input, 'error TS2688: Cannot find type definition file for vite/client\n', 'utf8');
      await execFileAsync(process.execPath, [extractorPath, `--input=${input}`, `--output=${output}`, '--exit-code=1', '--job-id=CI-001', '--job-name=TypeScript Type Checking', '--category=static-analysis', '--priority=P0']);
      const report = JSON.parse(await readFile(output, 'utf8'));
      expect(report.schemaVersion).toBe(1);
      expect(report.jobId).toBe('CI-001');
      expect(report.totalErrors).toBeGreaterThan(0);
      expect(report.errors[0].type).toBe('typescript');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('executor continues after a failed command and still emits job-errors.json', async () => {
    const jobId = `CI-INT-${process.pid}`;
    const outputDir = path.join(repoRoot, 'artifacts', 'ci-executive', jobId);
    try {
      await execFileAsync(process.execPath, [
        executorPath,
        jobId,
        'Integration Continuity Probe',
        'testing',
        'P1',
        `node -e "console.error('error: first command failed'); process.exit(3)" && node -e "console.log('second command ran')"`,
      ]);
      const result = JSON.parse(await readFile(path.join(outputDir, 'result.json'), 'utf8'));
      const errors = JSON.parse(await readFile(path.join(outputDir, 'job-errors.json'), 'utf8'));
      const combined = await readFile(path.join(outputDir, 'combined.log'), 'utf8');
      expect(result.status).toBe('FAIL');
      expect(result.failedCommands).toBe(1);
      expect(result.successfulCommands).toBe(1);
      expect(combined).toContain('second command ran');
      expect(errors.totalErrors).toBeGreaterThan(0);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test('aggregator emits error-report.json with the 18-job contract', async () => {
    const backupRoot = path.join(repoRoot, 'artifacts', 'ci-executive');
    const jobIds = EXECUTIVE_JOBS;
    try {
      await mkdir(backupRoot, { recursive: true });
      for (const jobId of jobIds) {
        const dir = path.join(backupRoot, jobId);
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, 'result.json'), JSON.stringify({
          schemaVersion: 2,
          jobId,
          name: jobId,
          category: 'testing',
          priority: 'P1',
          status: 'PASS',
          exitCode: 0,
          completedAt: new Date().toISOString(),
          failureEvidence: [],
        }, null, 2));
      }
      const { stdout } = await execFileAsync(process.execPath, [aggregatorPath], { env: { ...process.env, GITHUB_SHA: 'integration-test', GITHUB_RUN_ID: 'integration-test' } });
      const report = JSON.parse(await readFile(path.join(repoRoot, 'error-report.json'), 'utf8'));
      expect(report.schemaVersion).toBe(2);
      expect(report.verdict).toBe('GREEN');
      expect(report.jobResults).toHaveLength(18);
      expect(Object.keys(report.jobCategories)).toHaveLength(18);
      expect(stdout).toContain('"jobsExpected": 18');
    } finally {
      await rm(path.join(repoRoot, 'error-report.json'), { force: true });
      for (const jobId of jobIds) await rm(path.join(backupRoot, jobId), { recursive: true, force: true });
    }
  });
});
