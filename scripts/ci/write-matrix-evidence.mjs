#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const outputPath = resolve(root, process.env.MATRIX_EVIDENCE_PATH ?? 'diagnostics/matrix/matrix-evidence.json');
const sha = process.env.EXPECTED_SHA ?? process.env.GITHUB_SHA ?? null;
if (!sha) throw new Error('EXPECTED_SHA/GITHUB_SHA is required');

const payload = {
  schema: 'flixo-matrix-evidence/v1',
  mode: process.env.MATRIX_MODE ?? 'FAST',
  sha,
  browser: process.env.BROWSER ?? null,
  shard: process.env.SHARD ?? null,
  expectedUnits: Number(process.env.MATRIX_EXPECTED_UNITS ?? 0) || null,
  recordedAt: new Date().toISOString(),
};

payload.evidenceId = `MATRIX-${createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16).toUpperCase()}`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`MATRIX_EVIDENCE=${outputPath}`);
console.log(`MATRIX_EVIDENCE_ID=${payload.evidenceId}`);
