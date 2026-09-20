#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const source = JSON.parse(fs.readFileSync('docs/agents/historical-action-errors/index.json','utf8'));
const bot = JSON.parse(fs.readFileSync('diagnostics/auto-repair/cell-bots/CELL-001.json','utf8'));
const mirror = bot.historicalActionIndexMirror;
if (!mirror) throw new Error('CELL_001_HISTORICAL_INDEX_MIRROR_MISSING');
if (mirror.sourcePath !== 'docs/agents/historical-action-errors/index.json') throw new Error('CELL_001_HISTORICAL_INDEX_SOURCE_MISMATCH');
if (mirror.knowledgeOnly !== true) throw new Error('CELL_001_HISTORICAL_INDEX_NOT_KNOWLEDGE_ONLY');
if (mirror.proofAuthority !== 'CURRENT_EXACT_SHA_CI_ONLY') throw new Error('CELL_001_HISTORICAL_INDEX_PROOF_BOUNDARY_INVALID');
const digest = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
if (mirror.sourceDigest !== digest) throw new Error('CELL_001_HISTORICAL_INDEX_STALE');
if (JSON.stringify(mirror.snapshot) !== JSON.stringify(source)) throw new Error('CELL_001_HISTORICAL_INDEX_SNAPSHOT_MISMATCH');
console.log(JSON.stringify({passed:true, recordCount:source.recordCount, sourceDigest:digest},null,2));
