#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const sourcePath = path.resolve(ROOT, 'docs/agents/historical-action-errors/index.json');
const botPath = path.resolve(ROOT, 'diagnostics/auto-repair/cell-bots/CELL-001.json');

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const bot = JSON.parse(fs.readFileSync(botPath, 'utf8'));
const sourceDigest = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');

bot.historicalActionIndexMirror = {
  schemaVersion: 1,
  authority: 'CELL_BOT_HISTORICAL_COPY',
  knowledgeOnly: true,
  proofAuthority: 'CURRENT_EXACT_SHA_CI_ONLY',
  sourcePath: 'docs/agents/historical-action-errors/index.json',
  syncMode: 'AUTOMATIC_AFTER_HISTORICAL_INDEX_UPDATE',
  sourceDigest,
  sourceUpdatedAt: source.updatedAt ?? null,
  sourceRecordCount: Number(source.recordCount ?? 0),
  snapshot: source,
};

fs.writeFileSync(botPath, JSON.stringify(bot, null, 2) + '\n');
console.log(JSON.stringify({
  bot: 'CELL-001',
  sourcePath: 'docs/agents/historical-action-errors/index.json',
  sourceDigest,
  recordCount: source.recordCount ?? 0,
  synchronized: true,
}, null, 2));
