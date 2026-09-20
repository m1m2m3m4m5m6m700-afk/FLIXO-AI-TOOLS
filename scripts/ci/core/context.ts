import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { CiExecutionContext, CiMode } from './types.ts';

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashFile(path: string): string {
  return sha256(readFileSync(path));
}

export function resolveCiMode(force?: string): CiMode {
  if (force && ['L0', 'L1', 'L2', 'L3', 'RELEASE'].includes(force)) return force as CiMode;
  if (process.env.CI_FORCE_FULL === 'true') return 'L3';
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') return 'L1';
  return 'L2';
}

export function createCiContext(overrides: Partial<CiExecutionContext> = {}): CiExecutionContext {
  const commitSha = overrides.commitSha ?? process.env.GITHUB_SHA ?? 'LOCAL';
  const baseSha = overrides.baseSha ?? process.env.GITHUB_BASE_SHA ?? commitSha;
  const branch = overrides.branch ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
  const event = overrides.event ?? process.env.GITHUB_EVENT_NAME ?? 'local';
  const repository = overrides.repository ?? process.env.GITHUB_REPOSITORY ?? 'local';
  const lockfileHash = overrides.lockfileHash ?? hashFile('package-lock.json');
  const toolchainFingerprint = overrides.toolchainFingerprint ?? sha256(`${process.version}|${lockfileHash}`);

  return {
    commitSha,
    baseSha,
    event,
    branch,
    repository,
    mode: overrides.mode ?? resolveCiMode(process.env.CI_MODE),
    toolchainFingerprint,
    lockfileHash,
    contractHash: overrides.contractHash ?? 'UNSET',
    ciConfigHash: overrides.ciConfigHash ?? 'UNSET',
    configHash: overrides.configHash ?? 'UNSET',
    changedFiles: overrides.changedFiles ?? [],
    affectedContracts: overrides.affectedContracts ?? [],
    affectedRoutes: overrides.affectedRoutes ?? [],
    affectedLocales: overrides.affectedLocales ?? [],
    production: overrides.production ?? process.env.CI_MODE === 'RELEASE',
    siteOrigin: overrides.siteOrigin ?? process.env.PRODUCTION_ORIGIN,
  };
}
