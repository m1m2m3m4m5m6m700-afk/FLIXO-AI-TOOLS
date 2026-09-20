import type { AdviceRecord } from './advice-vault';

export const ADVICE_SEARCH_MAX_RESULTS = 128 as const;

export type AdviceSearchShard = Readonly<{
  id: number;
  records: readonly AdviceRecord[];
  postings: ReadonlyMap<string, readonly number[]>;
}>;

export type AdviceSearchManifest = ReadonlyMap<string, readonly number[]>;

export type AdviceSearchQuery = Readonly<{
  text: string;
  limit?: number;
  minConfidence?: number;
  scope?: string;
}>;

export type AdviceSearchHit = Readonly<{
  record: AdviceRecord;
  score: number;
  matchedTerms: number;
}>;

export type AdviceSearchEngine = Readonly<{
  shards: readonly AdviceSearchShard[];
  manifest: AdviceSearchManifest;
}>;

export function tokenizeAdviceSearch(text: string): string[] {
  const tokens = String(text ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) ?? [];
  return [...new Set(tokens.filter((token) => token.length > 1))].sort();
}

function searchableText(record: AdviceRecord): string {
  return [
    record.content,
    record.scope,
    record.rootCause ?? '',
    record.action ?? '',
    ...record.applicability,
    ...record.contraindications,
  ].join(' ');
}

export function buildAdviceSearchShard(
  id: number,
  records: readonly AdviceRecord[],
): AdviceSearchShard {
  const ordered = [...records]
    .filter((record) => record.status === 'CURRENT')
    .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  const postingSets = new Map<string, number[]>();

  for (let index = 0; index < ordered.length; index += 1) {
    for (const token of tokenizeAdviceSearch(searchableText(ordered[index]))) {
      const posting = postingSets.get(token) ?? [];
      posting.push(index);
      postingSets.set(token, posting);
    }
  }

  const postings = new Map<string, readonly number[]>();
  for (const [token, indexes] of postingSets) {
    postings.set(token, Object.freeze(indexes));
  }

  return Object.freeze({
    id,
    records: Object.freeze(ordered),
    postings,
  });
}

export function buildAdviceSearchManifest(
  shards: readonly AdviceSearchShard[],
): AdviceSearchManifest {
  const shardSets = new Map<string, Set<number>>();

  for (const shard of shards) {
    for (const token of shard.postings.keys()) {
      const ids = shardSets.get(token) ?? new Set<number>();
      ids.add(shard.id);
      shardSets.set(token, ids);
    }
  }

  const manifest = new Map<string, readonly number[]>();
  for (const [token, ids] of [...shardSets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    manifest.set(token, Object.freeze([...ids].sort((a, b) => a - b)));
  }
  return manifest;
}

export function createAdviceSearchEngine(
  shards: readonly AdviceSearchShard[],
): AdviceSearchEngine {
  const ordered = [...shards].sort((a, b) => a.id - b.id);
  return Object.freeze({
    shards: Object.freeze(ordered),
    manifest: buildAdviceSearchManifest(ordered),
  });
}

export function searchAdvice(
  engine: AdviceSearchEngine,
  queryInput: AdviceSearchQuery,
): AdviceSearchHit[] {
  const tokens = tokenizeAdviceSearch(queryInput.text);
  if (!tokens.length) return [];

  const limit = Math.min(
    ADVICE_SEARCH_MAX_RESULTS,
    Math.max(1, Math.trunc(queryInput.limit ?? 12)),
  );
  const minConfidence = Math.min(1, Math.max(0, queryInput.minConfidence ?? 0));
  const shardIds = new Set<number>();

  for (const token of tokens) {
    for (const shardId of engine.manifest.get(token) ?? []) shardIds.add(shardId);
  }

  const byFingerprint = new Map<string, { record: AdviceRecord; matched: Set<string> }>();

  for (const shard of engine.shards) {
    if (!shardIds.has(shard.id)) continue;

    for (const token of tokens) {
      for (const index of shard.postings.get(token) ?? []) {
        const record = shard.records[index];
        if (
          record.validity !== 'CURRENT' ||
          record.confidence < minConfidence ||
          (queryInput.scope && record.scope !== queryInput.scope)
        ) {
          continue;
        }

        const existing = byFingerprint.get(record.fingerprint) ?? {
          record,
          matched: new Set<string>(),
        };
        existing.matched.add(token);
        byFingerprint.set(record.fingerprint, existing);
      }
    }
  }

  return [...byFingerprint.values()]
    .map(({ record, matched }) => {
      const coverage = matched.size / tokens.length;
      const score =
        coverage * 0.70 +
        record.confidence * 0.15 +
        record.quality * 0.10 +
        (record.status === 'CURRENT' ? 0.05 : 0);
      return { record, score, matchedTerms: matched.size };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedTerms - a.matchedTerms ||
        a.record.fingerprint.localeCompare(b.record.fingerprint),
    )
    .slice(0, limit);
}

export function buildAdviceSearchEngineFromRecords(
  shards: readonly (readonly AdviceRecord[])[],
): AdviceSearchEngine {
  return createAdviceSearchEngine(
    shards.map((records, id) => buildAdviceSearchShard(id, records)),
  );
}

export type AdviceNameInput = Readonly<{
  failureClass?: string | null;
  stage?: string | null;
  rootCause?: string | null;
  rule?: string | null;
}>;

const ADVICE_CLASS_NAMES: Record<string, string> = Object.freeze({
  'external-tooling': 'external-provider-boundary',
  'noncanonical-automation': 'canonical-automation-path',
  'liveness-contract': 'liveness-heartbeat-contract',
  'contract-drift': 'contract-drift-single-source',
  lint: 'eslint-rule-repair',
  format: 'formatting-contract',
  'typescript-async-contract': 'typescript-async-contract',
  typescript: 'typescript-contract',
  playwright: 'browser-regression',
  webkit: 'webkit-rendering-contract',
  certification: 'exact-sha-certification',
  build: 'build-contract',
});

function slugPart(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

/**
 * Converts already-observed error facts into a stable advice name.
 * It never invents an RCA: unknown inputs remain explicit in the fallback name.
 */
export function deriveAdviceName(input: AdviceNameInput): string {
  const failureClass = slugPart(input.failureClass);
  const stage = slugPart(input.stage);
  const rootCause = slugPart(input.rootCause);
  const rule = slugPart(input.rule);
  const className = ADVICE_CLASS_NAMES[failureClass] ?? failureClass;

  if (className && rule) return 'advice-' + className + '-' + rule;
  if (className && stage) return 'advice-' + className + '-' + stage;
  if (className && rootCause) return 'advice-' + className + '-' + rootCause;
  if (className) return 'advice-' + className;
  if (rootCause && rule) return 'advice-' + rootCause + '-' + rule;
  if (rootCause) return 'advice-' + rootCause;
  if (rule) return 'advice-' + rule;
  return 'advice-unknown-failure-signature';
}
