import type { KnowledgeQuery, KnowledgeRecord, RankedKnowledge, RetrievalSignal } from './types';
import { validateKnowledgeQuery, validateKnowledgeRecord } from './types';

export type KnowledgeRetriever = (
  query: KnowledgeQuery,
) => Promise<readonly KnowledgeRecord[]>;

export type RetrievalScorer = (
  query: KnowledgeQuery,
  record: KnowledgeRecord,
) => RetrievalSignal;

const weightedScore = (signals: RetrievalSignal): number =>
  signals.lexical * 0.30 +
  signals.semantic * 0.30 +
  signals.authority * 0.15 +
  signals.freshness * 0.10 +
  signals.provenance * 0.15;

export function rankKnowledge(
  queryInput: unknown,
  recordsInput: readonly unknown[],
  scorer: RetrievalScorer,
): RankedKnowledge[] {
  const query = validateKnowledgeQuery(queryInput);
  const records = recordsInput.map(validateKnowledgeRecord)
    .filter((record) => record.validity === 'CURRENT' && record.confidence >= query.minConfidence)
    .map((record) => {
      const signals = scorer(query, record);
      for (const value of Object.values(signals)) {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error('Retrieval scorer signals must be finite values in [0,1].');
        }
      }
      return { record, signals, score: weightedScore(signals) };
    });

  return records
    .sort((a, b) => b.score - a.score || a.record.fingerprint.localeCompare(b.record.fingerprint))
    .slice(0, query.limit);
}

export function createHybridScorer(semantic: (query: KnowledgeQuery, record: KnowledgeRecord) => number): RetrievalScorer {
  return (query, record) => {
    const lexical = createLexicalScorer()(query, record);
    const semanticScore = Number(semantic(query, record));
    if (!Number.isFinite(semanticScore) || semanticScore < 0 || semanticScore > 1) {
      throw new Error('Hybrid semantic scorer must return a finite value in [0,1].');
    }
    return Object.freeze({ ...lexical, semantic: semanticScore });
  };
}

export function createLexicalScorer(): RetrievalScorer {
  return (query, record) => {
    const q = new Set(query.text.toLocaleLowerCase().split(/\s+/u).filter(Boolean));
    const c = new Set(record.content.toLocaleLowerCase().split(/\s+/u).filter(Boolean));
    const overlap = [...q].filter((token) => c.has(token)).length;
    return {
      lexical: q.size === 0 ? 0 : overlap / q.size,
      semantic: 0,
      authority: record.status === 'VERIFIED' ? 1 : record.status === 'PROBABLE' ? 0.7 : 0.4,
      freshness: record.validity === 'CURRENT' ? 1 : 0,
      provenance: Math.min(1, record.provenance.length / 4),
    };
  };
}
