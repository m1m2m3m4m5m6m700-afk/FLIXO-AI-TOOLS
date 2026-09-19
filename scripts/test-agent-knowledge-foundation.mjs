import assert from 'node:assert/strict';
import { createLexicalScorer, rankKnowledge } from '../src/lib/agent/knowledge/retrieval.ts';
import { validateKnowledgeRecord } from '../src/lib/agent/knowledge/types.ts';

const fingerprint = 'a'.repeat(64);
const base = {
  id: 'knowledge-1',
  content: 'FLIXO image compressor supports PNG and JPEG',
  source: 'src/config/canonical-tool-definition.ts',
  sourceType: 'REPOSITORY',
  timestamp: '2026-09-19T00:00:00+00:00',
  version: 'execution-test',
  scope: 'tool:image-compressor',
  confidence: 0.98,
  provenance: ['repository:verified'],
  validity: 'CURRENT',
  status: 'VERIFIED',
  fingerprint,
};

assert.deepEqual(validateKnowledgeRecord(base).id, 'knowledge-1');

const ranked = rankKnowledge(
  { text: 'FLIXO image compressor', limit: 5, minConfidence: 0.9 },
  [base],
  createLexicalScorer(),
);

assert.equal(ranked.length, 1);
assert.equal(ranked[0].record.fingerprint, fingerprint);
assert.ok(ranked[0].score > 0);

assert.throws(
  () => validateKnowledgeRecord({ ...base, fingerprint: 'not-a-sha256' }),
);
assert.throws(
  () => rankKnowledge(
    { text: 'FLIXO', limit: 5, minConfidence: 0 },
    [{ ...base, validity: 'STALE' }],
    createLexicalScorer(),
  ),
  { message: /rankKnowledge|expected/ },
);

console.log('Agent knowledge foundation tests passed.');
