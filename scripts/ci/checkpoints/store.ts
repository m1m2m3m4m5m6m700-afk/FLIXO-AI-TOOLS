import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContractResult } from '../core/types.ts';
import type { CheckpointIdentity } from './fingerprint.ts';
import { isCheckpointIdentityValid } from './fingerprint.ts';
import { parseStoredCheckpoint, type StoredCheckpointData } from '../../../src/lib/runtime-boundaries.ts';

export type StoredCheckpoint = StoredCheckpointData;

export class CheckpointStore {
  private readonly root: string;

  constructor(root = 'artifacts/ci/checkpoints') {
    this.root = root;
  }

  async save(checkpoint: StoredCheckpoint): Promise<string> {
    parseStoredCheckpoint(checkpoint);
    await mkdir(this.root, { recursive: true });
    const path = join(this.root, `${checkpoint.fingerprint}.json`);
    await writeFile(path, JSON.stringify(checkpoint, null, 2) + '\n', { flag: 'wx' });
    return path;
  }

  async load(fingerprint: string): Promise<StoredCheckpoint | null> {
    const path = join(this.root, `${fingerprint}.json`);
    try {
      return parseStoredCheckpoint(JSON.parse(await readFile(path, 'utf8')));
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
      try { await unlink(path); } catch { /* Corrupt checkpoint cleanup is best-effort. */ }
      console.error('[FLIXO][checkpoint] Purged invalid checkpoint.', { path, error });
      return null;
    }
  }

  async reuse(fingerprint: string, identity: CheckpointIdentity): Promise<ContractResult | null> {
    const checkpoint = await this.load(fingerprint);
    if (!checkpoint || !isCheckpointIdentityValid(checkpoint.identity, identity)) return null;
    if (checkpoint.result.status !== 'PASS') return null;
    return {
      ...checkpoint.result,
      evidence: [...(checkpoint.result.evidence ?? []), { source: 'checkpoint', artifact: checkpoint.evidencePath }],
    };
  }
}
