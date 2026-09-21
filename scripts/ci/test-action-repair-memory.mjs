#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {copyHistoricalIndexToActionIndexBot,loadActionBotMemory} from './action-repair-memory.mjs';
const source=JSON.parse(fs.readFileSync('docs/agents/historical-action-errors/index.json','utf8'));
const isolated='/tmp/flixo-action-memory-test';
const before=process.env.FLIXO_ACTION_MEMORY_DIR;
process.env.FLIXO_ACTION_MEMORY_DIR=isolated;
copyHistoricalIndexToActionIndexBot();
const m=loadActionBotMemory('ACTION-INDEX');
assert.equal(m.botId,'ACTION-INDEX');
assert.equal(m.historicalActionIndexMirror.sourcePath,'docs/agents/historical-action-errors/index.json');
assert.equal(m.historicalActionIndexMirror.knowledgeOnly,true);
assert.equal(m.historicalActionIndexMirror.sourceRecordCount,source.recordCount);
assert.deepEqual(m.historicalActionIndexMirror.snapshot,source);
if(before==null) delete process.env.FLIXO_ACTION_MEMORY_DIR; else process.env.FLIXO_ACTION_MEMORY_DIR=before;
console.log('ACTION_BOT_MEMORY=PASS');
