import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export interface ToolchainIdentity {
  node: string;
  npm: string;
  lockfileHash: string;
  nvmrc: string;
  fingerprint: string;
}

function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function readToolchainIdentity(): ToolchainIdentity {
  const lockfile = readFileSync('package-lock.json');
  const nvmrc = readFileSync('.nvmrc', 'utf8').trim();
  const node = process.version;
  const npm = process.env.npm_config_user_agent?.match(/npm\/([^ ]+)/)?.[1] ?? 'unknown';
  const identity = `${node}|${npm}|${nvmrc}|${sha256(lockfile)}`;
  return { node, npm, lockfileHash: sha256(lockfile), nvmrc, fingerprint: sha256(identity) };
}
