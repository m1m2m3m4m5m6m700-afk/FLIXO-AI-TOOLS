import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContractResult } from '../core/types.ts';
import type { CheckpointIdentity } from './fingerprint.ts';
import { isCheckpointIdentityValid } from './fingerprint.ts';

export interface StoredCheckpoint {
  schemaVersion: 1;
  identity: CheckpointIdentity;
  fingerprint: string;
  result: ContractResult;
  evidencePath?: string;
}

export class CheckpointStore {
  constructor(private readonly root = 'artifacts/ci/checkpoints') {}

  async save(checkpoint: StoredCheckpoint): Promise<string> {
    await mkdir(this.root, { recursive: true });
    const path = join(this.root, `${checkpoint.fingerprint}.json`);
    await writeFile(path, JSON.stringify(checkpoint, null, 2) + '\n', { flag: 'wx' });
    return path;
  }

  async load(fingerprint: string): Promise<StoredCheckpoint | null> {
    try {
      return JSON.parse(await readFile(join(this.root, `${fingerprint}.json`), 'utf8')) as StoredCheckpoint;
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async reuse(fingerprint: string, identity: CheckpointIdentity): Promise<ContractResult | null> {
    const checkpoint = await this.load(fingerprint);
    if (!checkpoint || !isCheckpointIdentityValid(checkpoint.identity, identity)) return null;
    if (checkpoint.result.status !== 'PASS') return null;
    return { ...checkpoint.result, evidence: [...(checkpoint.result.evidence ?? []), { source: 'checkpoint', artifact: checkpoint.evidencePath }] };
  }
}
