import { createHash } from 'node:crypto';
import { validateKnowledgeRecord } from '../knowledge/types';
import type { KnowledgeRecord } from '../knowledge/types';

export const MEMORY_LAYERS = Object.freeze({
  L0: 'CONSTITUTION',
  L1: 'CANONICAL_PROJECT_MEMORY',
  L2: 'SHARED_SKILL_KNOWLEDGE',
  L3: 'CELL_PERSONAL_MEMORY',
  L4: 'CURRENT_MISSION_MEMORY',
});
export type MemoryLayer = keyof typeof MEMORY_LAYERS;
export type Difficulty = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';
export type Polarity = 'SUPPORTS' | 'REFUTES' | 'UNKNOWN';
export type MissionOutcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED_EXTERNAL' | 'BLOCKED_INTERNAL' | 'PROPOSED' | 'REVERTED';
export type LearningDecision = 'PROVISIONAL_LESSON' | 'VERIFIED_KNOWLEDGE' | 'ANTI_LESSON' | 'BLOCKED_EXTERNAL' | 'BLOCKED_INTERNAL' | 'NO_CONFIDENCE_CHANGE' | 'STRATEGY_REJECTED';

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v), 'utf8').digest('hex');
const normalize = (v: unknown) => String(v ?? '').toLocaleLowerCase().replace(/\s+/gu, ' ').replace(/[^\p{L}\p{N}_:./ -]/gu, '').trim();
const fixedId = (n: number) => `CELL-${String(n).padStart(3, '0')}`;

export const REGISTERED_BOT_COUNT = 200;

export type BotIdentity = Readonly<{
  botId: string;
  ordinal: number;
  role: string | null;
  skills: readonly string[];
  memoryKey: string;
  authority: 'CENTRALIZED';
  active: boolean;
  missionId: string | null;
}>;

/**
 * Logical identity memory only. It never provisions, wakes, assigns or grants authority.
 */
export function buildFixedBotIdentities(count = REGISTERED_BOT_COUNT): readonly BotIdentity[] {
  if (!Number.isInteger(count) || count !== REGISTERED_BOT_COUNT) throw new Error('SWARM_FIXED_BOT_COUNT_INVALID');
  return Object.freeze(Array.from({ length: REGISTERED_BOT_COUNT }, (_, index) => Object.freeze({
    botId: fixedId(index + 1),
    ordinal: index + 1,
    role: null,
    skills: Object.freeze([] as string[]),
    memoryKey: `cell-memory:${fixedId(index + 1)}`,
    authority: 'CENTRALIZED' as const,
    active: false,
    missionId: null,
  })));
}

export function validateActiveBotSet(ids: readonly string[]) {
  const normalized = ids.map(id => String(id).toUpperCase());
  if (normalized.length > REGISTERED_BOT_COUNT || new Set(normalized).size !== normalized.length) throw new Error('SWARM_ACTIVE_BOT_SET_INVALID');
  if (normalized.some(id => !/^CELL-\d{3}$/u.test(id) || Number(id.slice(-3)) < 1 || Number(id.slice(-3)) > REGISTERED_BOT_COUNT)) {
    throw new Error('SWARM_ACTIVE_BOT_ID_INVALID');
  }
  return Object.freeze([...normalized].sort());
}

export type SwarmKnowledge = Readonly<KnowledgeRecord & {
  layer: MemoryLayer;
  authority: number;
  exactSha: string | null;
  exactShaVerified: boolean;
  evidenceCount: number;
  polarity: Polarity;
  canonicalKey: string;
  createdAt: string;
  lastVerifiedAt: string | null;
  expiresAt: string | null;
}>;

export const canonicalKey = (scope: string, content: string) => hash({
  scope: normalize(scope),
  content: normalize(content),
});

export function makeKnowledge(input: Omit<SwarmKnowledge, 'canonicalKey' | 'fingerprint' | 'id' | 'timestamp'> & { id?: string }): SwarmKnowledge {
  const canonical = canonicalKey(input.scope, input.content);
  const id = input.id ?? `SK-${canonical.slice(0, 24)}`;
  if (input.exactSha !== null && !SHA40.test(input.exactSha)) throw new Error('SWARM_EXACT_SHA_INVALID');
  if (input.authority < 0 || input.authority > 1) throw new Error('SWARM_AUTHORITY_INVALID');
  const base = validateKnowledgeRecord({
    id,
    content: input.content,
    source: input.source,
    sourceType: input.sourceType,
    timestamp: input.createdAt,
    version: input.version,
    scope: input.scope,
    confidence: input.confidence,
    provenance: [...input.provenance],
    validity: input.validity,
    status: input.status,
    fingerprint: canonical,
  });
  return Object.freeze({
    ...base,
    layer: input.layer,
    authority: input.authority,
    exactSha: input.exactSha,
    exactShaVerified: input.exactShaVerified,
    evidenceCount: input.evidenceCount,
    polarity: input.polarity,
    canonicalKey: canonical,
    createdAt: input.createdAt,
    lastVerifiedAt: input.lastVerifiedAt,
    expiresAt: input.expiresAt,
  });
}

const rank = (r: SwarmKnowledge) =>
  (r.exactShaVerified ? 0.25 : 0) +
  (r.status === 'VERIFIED' ? 0.35 : r.status === 'PROBABLE' ? 0.18 : 0) +
  r.confidence * 0.25 +
  r.authority * 0.1 +
  Math.min(0.05, r.evidenceCount / 40);

export function mergeCanonical(records: readonly SwarmKnowledge[]) {
  const groups = new Map<string, SwarmKnowledge[]>();
  for (const record of records) groups.set(record.canonicalKey, [...(groups.get(record.canonicalKey) ?? []), record]);
  const canonical: SwarmKnowledge[] = [];
  const duplicates: { key: string; ids: string[] }[] = [];
  const contradictions: { scope: string; key: string; ids: string[] }[] = [];
  for (const [key, group] of groups) {
    canonical.push([...group].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0]);
    if (group.length > 1) duplicates.push({ key, ids: group.map(record => record.id).sort() });
    const polarities = new Set(group.map(record => record.polarity));
    if (polarities.has('SUPPORTS') && polarities.has('REFUTES')) {
      contradictions.push({ scope: group[0].scope, key, ids: group.map(record => record.id).sort() });
    }
  }
  return { canonical, duplicates, contradictions };
}

export function decayKnowledge(record: SwarmKnowledge, now = Date.now(), halfLifeDays = 30): SwarmKnowledge {
  const anchor = record.lastVerifiedAt ?? record.createdAt;
  const age = Math.max(0, (now - new Date(anchor).getTime()) / 86400000);
  const confidence = Number((record.confidence * 2 ** (-age / halfLifeDays)).toFixed(6));
  const stale = record.expiresAt ? new Date(record.expiresAt).getTime() <= now : age >= 30;
  return Object.freeze({
    ...record,
    confidence,
    status: stale && record.status === 'VERIFIED' ? 'PROBABLE' : record.status,
    validity: stale && record.validity === 'CURRENT' ? 'STALE' : record.validity,
  });
}

/** Memory is advisory; this helper deliberately never returns authority. */
export function memoryAdvisoryDecision(record: SwarmKnowledge, currentSha: string) {
  const exactFresh = SHA40.test(currentSha) && record.exactSha === currentSha && record.exactShaVerified && record.validity === 'CURRENT';
  return Object.freeze({
    usableAsAdvisory: record.validity === 'CURRENT' && record.status !== 'CONFLICTED',
    exactShaMatch: exactFresh,
    requiresFreshEvidence: !exactFresh,
    authorityGranted: false,
  });
}

export function poisoningSafe(record: SwarmKnowledge, currentSha: string, conflictCount = 0) {
  return SHA40.test(currentSha) &&
    conflictCount === 0 &&
    record.validity === 'CURRENT' &&
    record.status === 'VERIFIED' &&
    record.confidence >= 0.9 &&
    record.exactShaVerified &&
    record.exactSha === currentSha &&
    record.evidenceCount >= 2 &&
    record.provenance.length > 0 &&
    !['GENERATED', 'WEB'].includes(record.sourceType);
}

export function compactMemory(records: readonly SwarmKnowledge[], caps: Partial<Record<MemoryLayer, number>> = {}) {
  const layerGroups = new Map<string, SwarmKnowledge[]>();
  for (const record of records) {
    const key = `${record.layer}|${record.canonicalKey}`;
    layerGroups.set(key, [...(layerGroups.get(key) ?? []), record]);
  }
  const merged = [...layerGroups.values()]
    .flatMap(group => mergeCanonical(group).canonical)
    .map(record => decayKnowledge(record));
  const keep: SwarmKnowledge[] = [];
  const archived: SwarmKnowledge[] = [];
  const used = new Map<MemoryLayer, number>();
  const capacity = (layer: MemoryLayer) => caps[layer] ?? ({ L0: 64, L1: 256, L2: 500, L3: 2000, L4: 5000 }[layer]);
  for (const record of merged.sort((a, b) => Number(a.layer.slice(1)) - Number(b.layer.slice(1)) || rank(b) - rank(a))) {
    const preserve = (record.layer === 'L0' || record.layer === 'L1') && record.validity === 'CURRENT' && record.status === 'VERIFIED';
    const n = used.get(record.layer) ?? 0;
    if (preserve || n < capacity(record.layer)) {
      keep.push(record);
      used.set(record.layer, n + 1);
    } else {
      archived.push(record);
    }
  }
  return { active: keep, archived, droppedDuplicates: records.length - merged.length, rebuildDigest: hash(keep) };
}

export function rebuildMemory(records: readonly SwarmKnowledge[], manifest: { recordCount: number; digest: string; exactSha: string }) {
  if (!SHA40.test(manifest.exactSha) || records.length !== manifest.recordCount) throw new Error('SWARM_REBUILD_IDENTITY_INVALID');
  const digest = hash([...records].sort((a, b) => a.id.localeCompare(b.id)));
  if (digest !== manifest.digest) throw new Error('SWARM_REBUILD_DIGEST_MISMATCH');
  return Object.freeze([...records].sort((a, b) => a.id.localeCompare(b.id)));
}

export function classifyDifficulty(input: { ambiguity: number; novelty: number; dependencyCount: number; risk: number; uncertainty: number; capabilityCount: number }): Difficulty {
  const s =
    input.ambiguity * 0.2 +
    input.novelty * 0.2 +
    Math.min(1, input.dependencyCount / 8) * 0.15 +
    input.risk * 0.2 +
    input.uncertainty * 0.15 +
    Math.min(1, input.capabilityCount / 6) * 0.1;
  return s < 0.2 ? 'D1' : s < 0.4 ? 'D2' : s < 0.6 ? 'D3' : s < 0.8 ? 'D4' : 'D5';
}

export type SkillObservation = Readonly<{
  botId: string;
  skill: string;
  capability: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED_EXTERNAL' | 'SHADOW';
  contextKey: string;
  exactSha: string;
  verified: boolean;
  timestamp: string;
}>;

export function skillReputation(observations: readonly SkillObservation[], now = Date.now(), halfLifeDays = 45) {
  const map = new Map<string, SkillObservation[]>();
  for (const observation of observations) {
    if (!SHA40.test(observation.exactSha)) throw new Error('SWARM_SKILL_OBSERVATION_SHA_INVALID');
    const key = [observation.botId, observation.skill, observation.capability].join('|');
    map.set(key, [...(map.get(key) ?? []), observation]);
  }
  return [...map.values()].map(group => {
    const ok = group.filter(observation => observation.outcome === 'SUCCESS' && observation.verified).length;
    const bad = group.filter(observation => observation.outcome === 'FAILURE').length;
    const attempts = ok + bad;
    const score = group.reduce((sum, observation) => {
      const age = Math.max(0, (now - new Date(observation.timestamp).getTime()) / 86400000);
      const weight = 2 ** (-age / halfLifeDays);
      return sum + (observation.outcome === 'SUCCESS' && observation.verified ? weight : observation.outcome === 'FAILURE' ? 0 : weight * 0.25);
    }, 0);
    const weight = group.reduce((sum, observation) => {
      const age = Math.max(0, (now - new Date(observation.timestamp).getTime()) / 86400000);
      return sum + 2 ** (-age / halfLifeDays);
    }, 0);
    return {
      botId: group[0].botId,
      skill: group[0].skill,
      capability: group[0].capability,
      attempts,
      successes: ok,
      failures: bad,
      successRate: attempts ? ok / attempts : 0,
      decayedScore: weight ? score / weight : 0,
      distinctContexts: new Set(group.map(observation => observation.contextKey)).size,
      exactShaCount: new Set(group.map(observation => observation.exactSha)).size,
    };
  }).sort((a, b) => b.decayedScore - a.decayedScore || b.successRate - a.successRate || a.botId.localeCompare(b.botId));
}

export const CAPABILITY_MAP = Object.freeze({
  'filter-mask': Object.freeze({ requiredSkills: Object.freeze(['image-runtime', 'gpu', 'verification']), roles: Object.freeze(['runtime', 'verifier']) }),
  'local-image-tools': Object.freeze({ requiredSkills: Object.freeze(['image-processing', 'file-safety', 'output-contract']), roles: Object.freeze(['processor', 'safety']) }),
  'editorial-tools': Object.freeze({ requiredSkills: Object.freeze(['composition', 'layout', 'history', 'export']), roles: Object.freeze(['editor', 'verifier']) }),
  'ai/cloud-tools': Object.freeze({ requiredSkills: Object.freeze(['provider-routing', 'schema-validation', 'external-oracle']), roles: Object.freeze(['router', 'oracle']) }),
  'replay/simulation': Object.freeze({ requiredSkills: Object.freeze(['snapshotting', 'oracle-analysis', 'failure-injection', 'regression']), roles: Object.freeze(['simulator', 'verifier']) }),
} as const);

export type CapabilityId = keyof typeof CAPABILITY_MAP;

export function buildCapabilityMap(required: readonly string[]) {
  return Object.freeze(required.map(capability => {
    const entry = CAPABILITY_MAP[capability as CapabilityId];
    return Object.freeze({
      capability,
      requiredSkills: entry?.requiredSkills ?? Object.freeze([] as string[]),
      roles: entry?.roles ?? Object.freeze(['generalist'] as string[]),
      known: Boolean(entry),
    });
  }));
}

export function adaptiveSwarmSize(difficulty: Difficulty, capabilityCount: number, novelty: number, risk: number) {
  const base = { D1: 3, D2: 4, D3: 6, D4: 10, D5: 15 }[difficulty];
  return Math.min(50, Math.max(3, base + Math.ceil(Math.max(0, capabilityCount - 2) * 1.5) + Math.ceil(novelty * 10) + Math.ceil(risk * 8)));
}

export type AdaptiveSelectionInput = Readonly<{
  currentSha: string;
  difficulty: Difficulty;
  requiredCapabilities: readonly string[];
  observations: readonly SkillObservation[];
  candidateIds?: readonly string[];
}>;

export function selectAdaptiveSwarm(input: AdaptiveSelectionInput) {
  if (!SHA40.test(input.currentSha)) throw new Error('SWARM_ROUTER_SHA_INVALID');
  const candidates = validateActiveBotSet(input.candidateIds ?? []).length > 0
    ? validateActiveBotSet(input.candidateIds ?? [])
    : buildFixedBotIdentities().map(identity => identity.botId);
  const requiredSkills = new Set(buildCapabilityMap(input.requiredCapabilities).flatMap(entry => [...entry.requiredSkills]));
  const reputation = skillReputation(input.observations.filter(observation => observation.exactSha === input.currentSha));
  const byBot = new Map<string, number>();
  for (const botId of candidates) byBot.set(botId, 0);
  for (const item of reputation) if (byBot.has(item.botId)) {
    const skillMatch = requiredSkills.size === 0 || requiredSkills.has(item.skill);
    const score = skillMatch ? item.decayedScore + item.successRate : item.decayedScore * 0.25;
    byBot.set(item.botId, (byBot.get(item.botId) ?? 0) + score);
  }
  const target = adaptiveSwarmSize(input.difficulty, input.requiredCapabilities.length, 0.5, 0.5);
  return Object.freeze([...candidates]
    .sort((a, b) => (byBot.get(b) ?? 0) - (byBot.get(a) ?? 0) || a.localeCompare(b))
    .slice(0, Math.min(target, candidates.length)));
}

export function assignAdaptiveRoles(botIds: readonly string[], requiredCapabilities: readonly string[]) {
  const roles = requiredCapabilities.flatMap(capability => [...(CAPABILITY_MAP[capability as CapabilityId]?.roles ?? ['generalist'])]);
  return Object.freeze(botIds.map((botId, index) => Object.freeze({
    botId,
    role: roles[index % Math.max(roles.length, 1)] ?? 'generalist',
  })));
}

export type MissionResultContract = Readonly<{
  missionId: string;
  taskId: string;
  botId: string;
  exactSha: string;
  outcome: MissionOutcome;
  strategyId: string | null;
  failureFingerprint: string | null;
  rootCause: string | null;
  evidenceRefs: readonly string[];
  verified: boolean;
  reverted: boolean;
}>;

export function validateMissionResult(input: MissionResultContract) {
  if (!input.missionId || !input.taskId || !input.botId || !SHA40.test(input.exactSha)) throw new Error('MISSION_RESULT_IDENTITY_INVALID');
  const outcomes: readonly MissionOutcome[] = ['SUCCESS', 'FAILURE', 'BLOCKED_EXTERNAL', 'BLOCKED_INTERNAL', 'PROPOSED', 'REVERTED'];
  if (!outcomes.includes(input.outcome)) throw new Error('MISSION_RESULT_OUTCOME_INVALID');
  if (input.evidenceRefs.length === 0) throw new Error('MISSION_RESULT_EVIDENCE_REQUIRED');
  if (input.outcome !== 'FAILURE' && input.outcome !== 'BLOCKED_INTERNAL' && input.outcome !== 'BLOCKED_EXTERNAL' && input.failureFingerprint !== null) throw new Error('MISSION_RESULT_FAILURE_METADATA_INVALID');
  if (input.outcome === 'FAILURE' && (!input.failureFingerprint || !SHA256.test(input.failureFingerprint))) throw new Error('MISSION_RESULT_FINGERPRINT_REQUIRED');
  if (input.verified && (!SHA40.test(input.exactSha) || input.evidenceRefs.length < 1)) throw new Error('MISSION_RESULT_VERIFICATION_INVALID');
  return true;
}

export function learningDecision(input: MissionResultContract & { validationPassed: boolean; currentSha: string; contradictions: number }): LearningDecision {
  validateMissionResult(input);
  if (input.outcome === 'PROPOSED') return 'NO_CONFIDENCE_CHANGE';
  if (input.outcome === 'REVERTED' || input.reverted) return 'STRATEGY_REJECTED';
  if (input.outcome === 'BLOCKED_EXTERNAL') return 'BLOCKED_EXTERNAL';
  if (input.outcome === 'BLOCKED_INTERNAL') return 'BLOCKED_INTERNAL';
  if (input.outcome === 'FAILURE') return 'ANTI_LESSON';
  if (!input.validationPassed || !input.verified || input.currentSha !== input.exactSha || input.contradictions > 0) return 'PROVISIONAL_LESSON';
  return 'VERIFIED_KNOWLEDGE';
}

export function promotionTrial(input: { attempts: number; successes: number; distinctContexts: number; independentChallenges: number; contradictions: number }) {
  const reasons: string[] = [];
  const rate = input.attempts ? input.successes / input.attempts : 0;
  if (input.attempts < 3) reasons.push('MIN_TRIALS');
  if (rate < 0.8) reasons.push('SUCCESS_RATE');
  if (input.distinctContexts < 2) reasons.push('CONTEXT_DIVERSITY');
  if (input.independentChallenges < 1) reasons.push('INDEPENDENT_CHALLENGE');
  if (input.contradictions > 0) reasons.push('CONTRADICTION');
  return { eligible: reasons.length === 0, reasons };
}

export function canaryDecision(input: { baselineFailureRate: number; canaryFailureRate: number; allowedRegression: number; trials: number }) {
  if (input.trials < 3) return 'HOLD' as const;
  if (input.canaryFailureRate > input.baselineFailureRate + input.allowedRegression) return 'ROLLBACK' as const;
  if (input.canaryFailureRate <= input.baselineFailureRate) return 'PROMOTE' as const;
  return 'HOLD' as const;
}

export function fingerprintFailure(input: { category: string; normalizedMessage: string; violatedInvariant: string; causalSource: string; affectedScope: string }) {
  return hash({
    category: normalize(input.category),
    normalizedMessage: normalize(input.normalizedMessage),
    violatedInvariant: normalize(input.violatedInvariant),
    causalSource: normalize(input.causalSource),
    affectedScope: normalize(input.affectedScope),
  });
}

export function inferFallback(primary: { status: 'AVAILABLE' | 'FAILED'; strategyId: string }, fallback: { strategyId: string }) {
  return primary.status === 'AVAILABLE'
    ? Object.freeze({ strategyId: primary.strategyId, source: 'PRIMARY' as const })
    : Object.freeze({ strategyId: fallback.strategyId, source: 'FALLBACK' as const });
}

export function transferStrategy(input: {
  sourceFingerprint: string;
  targetFailureClass: string;
  strategyId: string;
  verifiedContexts: number;
  exactShaEvidence: readonly string[];
}) {
  if (!SHA256.test(input.sourceFingerprint) || input.verifiedContexts < 2 || input.exactShaEvidence.length < 1) {
    return Object.freeze({ eligible: false, reason: 'INSUFFICIENT_EVIDENCE' as const });
  }
  return Object.freeze({ eligible: true, sourceFingerprint: input.sourceFingerprint, targetFailureClass: normalize(input.targetFailureClass), strategyId: input.strategyId });
}

export function synthesizeCases(cases: readonly { fingerprint: string; rootCause: string; strategyId: string | null; outcome: MissionOutcome }[]) {
  const roots = new Map<string, number>();
  const strategies = new Map<string, number>();
  for (const item of cases) {
    roots.set(item.rootCause, (roots.get(item.rootCause) ?? 0) + 1);
    if (item.strategyId) strategies.set(item.strategyId, (strategies.get(item.strategyId) ?? 0) + 1);
  }
  return Object.freeze({
    recurringRootCauses: [...roots.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]),
    recurringStrategies: [...strategies.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]),
    observedCount: cases.length,
  });
}

export function generateHypotheses(input: { failures: readonly { fingerprint: string; rootCause: string }[]; max: number }) {
  return Object.freeze([...new Set(input.failures.map(item => `${item.rootCause}:${item.fingerprint.slice(0, 12)}`))].slice(0, Math.max(0, input.max)));
}

export function failurePrediction(input: { fingerprint: string; historical: readonly { fingerprint: string; outcome: MissionOutcome }[] }) {
  if (!SHA256.test(input.fingerprint)) throw new Error('SWARM_PREDICTION_FINGERPRINT_INVALID');
  const hits = input.historical.filter(item => item.fingerprint === input.fingerprint);
  const failures = hits.filter(item => item.outcome === 'FAILURE').length;
  return Object.freeze({ samples: hits.length, failureRate: hits.length ? failures / hits.length : 0, evidenceBound: hits.length > 0 });
}

export type KnowledgeGraphNode = Readonly<{ id: string; canonicalKey: string; exactSha: string | null }>;
export type KnowledgeGraphEdge = Readonly<{ from: string; to: string; relation: 'DERIVED_FROM' | 'SUPPORTS' | 'REFUTES' | 'TRANSFERRED' }>;

export function buildKnowledgeGraph(records: readonly SwarmKnowledge[]) {
  const { canonical, contradictions } = mergeCanonical(records);
  const nodes = canonical.map(record => Object.freeze({ id: record.id, canonicalKey: record.canonicalKey, exactSha: record.exactSha }));
  const edges: KnowledgeGraphEdge[] = [];
  for (const record of canonical) for (const provenance of record.provenance) edges.push(Object.freeze({ from: record.id, to: provenance, relation: 'DERIVED_FROM' as const }));
  for (const contradiction of contradictions) if (contradiction.ids.length >= 2) edges.push(Object.freeze({ from: contradiction.ids[0], to: contradiction.ids[1], relation: 'REFUTES' as const }));
  return Object.freeze({ nodes, edges, contradictions, digest: hash({ nodes, edges }) });
}

export function compareReplay(input: { historicalOracle: 'PASS' | 'FAIL' | 'UNKNOWN'; currentOracle: 'PASS' | 'FAIL' | 'UNKNOWN'; historicalOutputHash: string; currentOutputHash: string }) {
  if (!SHA256.test(input.historicalOutputHash) || !SHA256.test(input.currentOutputHash)) throw new Error('REPLAY_OUTPUT_HASH_INVALID');
  if (input.historicalOracle === 'FAIL' && input.currentOracle === 'PASS') return { changed: true, signal: 'IMPROVED' as const };
  if (input.historicalOracle === 'PASS' && input.currentOracle === 'FAIL') return { changed: true, signal: 'REGRESSED' as const };
  if (input.historicalOracle === 'UNKNOWN' || input.currentOracle === 'UNKNOWN') {
    return { changed: input.historicalOutputHash !== input.currentOutputHash, signal: 'UNMEASURABLE' as const };
  }
  return { changed: input.historicalOutputHash !== input.currentOutputHash, signal: 'NO_CHANGE' as const };
}

export function buildSimulationEvidence(input: {
  missionId: string;
  exactSha: string;
  taskInputHash: string;
  memorySnapshotIds: readonly string[];
  strategyId: string;
  outputHash: string;
  oracle: 'PASS' | 'FAIL' | 'UNKNOWN';
  failureInjection: string | null;
}) {
  if (!input.missionId || !SHA40.test(input.exactSha) || !SHA256.test(input.taskInputHash) || !SHA256.test(input.outputHash)) {
    throw new Error('SIMULATION_EVIDENCE_INVALID');
  }
  return Object.freeze({
    simulationId: `SIM-${hash(input).slice(0, 24)}`,
    exactSha: input.exactSha,
    authoritative: false,
    mutationAllowed: false,
    certificationAllowed: false,
    inputs: Object.freeze(input),
    evidenceDigest: hash(input),
  });
}

export function detectDrift(input: { previousContractDigest: string; currentContractDigest: string; previousSchemaVersion: number; currentSchemaVersion: number; exactSha: string }) {
  if (!SHA40.test(input.exactSha)) throw new Error('DRIFT_SHA_INVALID');
  return Object.freeze({
    drifted: input.previousContractDigest !== input.currentContractDigest || input.previousSchemaVersion !== input.currentSchemaVersion,
    requiresReevaluation: input.previousContractDigest !== input.currentContractDigest || input.previousSchemaVersion !== input.currentSchemaVersion,
    exactSha: input.exactSha,
  });
}

export type MemoryHistoryEvent = Readonly<{
  recordId: string; exactSha: string | null; sourceTimestamp: string; imported: true; historical: true; advisoryOnly: true; digest: string;
}>;
export type HistoricalBackfillResult = Readonly<{
  records: readonly SwarmKnowledge[]; history: readonly MemoryHistoryEvent[]; importedCount: number; currentBoundCount: number; historicalOnlyCount: number; currentSha: string; authority: 'ADVISORY_ONLY'; digest: string;
}>;
export function importMemoryHistory(records: readonly KnowledgeRecord[], currentSha: string): HistoricalBackfillResult {
  if (!SHA40.test(currentSha)) throw new Error('MEMORY_IMPORT_SHA_INVALID');
  const validated = records.map(validateKnowledgeRecord);
  const imported: SwarmKnowledge[] = []; const history: MemoryHistoryEvent[] = [];
  for (const record of validated) {
    const currentBound = record.provenance.some(value => value.includes(currentSha));
    const importedRecord = makeKnowledge({
      id: 'HIST-' + record.id, content: record.content, source: record.source, sourceType: record.sourceType, version: record.version,
      scope: record.scope, confidence: record.confidence, provenance: [...record.provenance, 'historical:' + record.id],
      validity: record.validity, status: record.status, layer: 'L1',
      authority: currentBound && record.status === 'VERIFIED' && record.validity === 'CURRENT' ? 0.6 : 0.2,
      exactSha: currentBound ? currentSha : null, exactShaVerified: currentBound, evidenceCount: record.provenance.length,
      polarity: 'UNKNOWN', createdAt: record.timestamp, lastVerifiedAt: currentBound ? record.timestamp : null,
      expiresAt: record.validity === 'CURRENT' ? null : record.timestamp,
    });
    imported.push(importedRecord);
    history.push(Object.freeze({
      recordId: importedRecord.id, exactSha: importedRecord.exactSha, sourceTimestamp: record.timestamp,
      imported: true, historical: true, advisoryOnly: true,
      digest: hash({record: record.id, fingerprint: record.fingerprint, exactSha: importedRecord.exactSha}),
    }));
  }
  const digest = hash({currentSha, records: imported.map(record => [record.id, record.canonicalKey, record.exactSha, record.validity]), history: history.map(event => [event.recordId, event.digest])});
  return Object.freeze({
    records: Object.freeze(imported), history: Object.freeze(history), importedCount: imported.length,
    currentBoundCount: imported.filter(record => record.exactShaVerified).length,
    historicalOnlyCount: imported.filter(record => !record.exactShaVerified).length,
    currentSha, authority: 'ADVISORY_ONLY', digest,
  });
}
export function historicalBackfill(records: readonly KnowledgeRecord[], currentSha: string) {
  const result = importMemoryHistory(records, currentSha);
  return Object.freeze({...result, status: 'BACKFILL_COMPLETE' as const, promotionAllowed: false, certificationAllowed: false});
}
export type WeaknessObservation = Readonly<{
  fingerprint: string; category: string; rootCause: string; skill?: string; capability?: string; exactSha: string;
  outcome: MissionOutcome | 'SHADOW'; severity?: number; contextKey?: string;
}>;
export function buildWeaknessGenome(observations: readonly WeaknessObservation[], currentSha: string) {
  if (!SHA40.test(currentSha)) throw new Error('WEAKNESS_GENOME_SHA_INVALID');
  const groups = new Map<string, WeaknessObservation[]>();
  for (const observation of observations) {
    if (!SHA256.test(observation.fingerprint) || !SHA40.test(observation.exactSha)) throw new Error('WEAKNESS_GENOME_OBSERVATION_INVALID');
    const key = [observation.fingerprint, normalize(observation.category), normalize(observation.rootCause)].join('|');
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  const genes = [...groups.values()].map(group => {
    const failureCount = group.filter(x => x.outcome === 'FAILURE').length;
    const blockedCount = group.filter(x => x.outcome === 'BLOCKED_INTERNAL' || x.outcome === 'BLOCKED_EXTERNAL').length;
    const severities = group.map(x => Math.max(0, Math.min(1, x.severity ?? (x.outcome === 'FAILURE' ? 1 : 0.5))));
    return Object.freeze({
      fingerprint: group[0].fingerprint, category: normalize(group[0].category), rootCause: normalize(group[0].rootCause),
      recurrence: group.length, failureCount, blockedCount,
      averageSeverity: severities.reduce((sum, value) => sum + value, 0) / severities.length,
      contexts: new Set(group.map(x => x.contextKey ?? 'unknown')).size,
      skills: Object.freeze([...new Set(group.map(x => x.skill).filter(Boolean) as string[])].sort()),
      capabilities: Object.freeze([...new Set(group.map(x => x.capability).filter(Boolean) as string[])].sort()),
      currentShaEvidence: group.filter(x => x.exactSha === currentSha).length,
    });
  }).sort((a, b) => b.recurrence - a.recurrence || b.averageSeverity - a.averageSeverity || a.fingerprint.localeCompare(b.fingerprint));
  return Object.freeze({schemaVersion: 1, exactSha: currentSha, authoritative: false, genes: Object.freeze(genes), digest: hash(genes)});
}
export function validateSkillsContinuously(observations: readonly SkillObservation[], currentSha: string, minimumAttempts = 2, minimumSuccessRate = 0.75) {
  if (!SHA40.test(currentSha)) throw new Error('CONTINUOUS_SKILL_VALIDATION_SHA_INVALID');
  if (!Number.isInteger(minimumAttempts) || minimumAttempts < 1) throw new Error('CONTINUOUS_SKILL_MIN_ATTEMPTS_INVALID');
  if (!Number.isFinite(minimumSuccessRate) || minimumSuccessRate < 0 || minimumSuccessRate > 1) throw new Error('CONTINUOUS_SKILL_THRESHOLD_INVALID');
  const groups = new Map<string, SkillObservation[]>();
  for (const observation of observations) {
    if (!SHA40.test(observation.exactSha)) throw new Error('CONTINUOUS_SKILL_OBSERVATION_SHA_INVALID');
    const key = [observation.skill, observation.capability].join('|'); groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  const skills = [...groups.values()].map(group => {
    const current = group.filter(x => x.exactSha === currentSha);
    const attempts = current.filter(x => x.outcome !== 'SHADOW').length;
    const verifiedSuccesses = current.filter(x => x.outcome === 'SUCCESS' && x.verified).length;
    const failures = current.filter(x => x.outcome === 'FAILURE').length;
    const successRate = attempts ? verifiedSuccesses / attempts : 0;
    const status = attempts < minimumAttempts ? 'INSUFFICIENT_EVIDENCE' : (successRate >= minimumSuccessRate && failures === 0 ? 'VALID' : 'DEGRADED');
    return Object.freeze({skill: group[0].skill, capability: group[0].capability, attempts, verifiedSuccesses, failures, currentShaEvidence: current.length, successRate, status});
  });
  const status = skills.some(x => x.status === 'DEGRADED') ? 'DEGRADED' : (skills.some(x => x.status === 'INSUFFICIENT_EVIDENCE') ? 'INSUFFICIENT_EVIDENCE' : 'PASS');
  return Object.freeze({exactSha: currentSha, status, skills: Object.freeze(skills), advisoryOnly: true as const});
}
export function runUpgradeEngine(input: {exactSha: string; genome: ReturnType<typeof buildWeaknessGenome>; skillValidation?: ReturnType<typeof validateSkillsContinuously>; maxProposals?: number}) {
  if (!SHA40.test(input.exactSha)) throw new Error('UPGRADE_ENGINE_SHA_INVALID');
  if (input.genome.exactSha !== input.exactSha) throw new Error('UPGRADE_ENGINE_STALE_GENOME');
  const maxProposals = input.maxProposals ?? 8;
  if (!Number.isInteger(maxProposals) || maxProposals < 1 || maxProposals > 32) throw new Error('UPGRADE_ENGINE_LIMIT_INVALID');
  const proposals = input.genome.genes.slice(0, maxProposals).map(gene => Object.freeze({
    upgradeId: 'UPG-' + gene.fingerprint.slice(0, 16), weaknessFingerprint: gene.fingerprint,
    action: gene.skills.length ? 'validate-and-strengthen:' + gene.skills[0] : 'investigate:' + gene.category,
    reason: gene.rootCause + ': recurrence=' + gene.recurrence + ', severity=' + gene.averageSeverity.toFixed(2),
    priority: Math.min(1, gene.averageSeverity * 0.6 + Math.min(1, gene.recurrence / 5) * 0.4),
    exactSha: input.exactSha, authority: 'ADVISORY_ONLY' as const,
  }));
  const skillDegradation = input.skillValidation?.skills.filter(x => x.status === 'DEGRADED') ?? [];
  for (const skill of skillDegradation.slice(0, Math.max(0, maxProposals - proposals.length))) proposals.push(Object.freeze({
    upgradeId: 'UPG-SKILL-' + hash(skill).slice(0, 12), weaknessFingerprint: hash(skill),
    action: 'revalidate-skill:' + String(skill.skill),
    reason: 'continuous skill validation degraded for capability ' + String(skill.capability),
    priority: 0.85, exactSha: input.exactSha, authority: 'ADVISORY_ONLY' as const,
  }));
  return Object.freeze({exactSha: input.exactSha, proposals: Object.freeze(proposals), mutationAllowed: false, certificationAllowed: false, authoritative: false});
}
export function buildControllerLearningSignal(input: {
  exactSha: string;
  missionResults: readonly Pick<MissionResultContract, 'missionId' | 'outcome' | 'strategyId' | 'exactSha' | 'verified' | 'reverted'>[];
  genome: ReturnType<typeof buildWeaknessGenome>;
  upgrades: ReturnType<typeof runUpgradeEngine>;
  skillValidation: ReturnType<typeof validateSkillsContinuously>;
}) {
  if (!SHA40.test(input.exactSha) || input.genome.exactSha !== input.exactSha || input.upgrades.exactSha !== input.exactSha || input.skillValidation.exactSha !== input.exactSha) throw new Error('CONTROLLER_LEARNING_CONTEXT_STALE');
  if (input.missionResults.some(result => result.exactSha !== input.exactSha)) throw new Error('CONTROLLER_LEARNING_RESULT_STALE');
  const failures = input.missionResults.filter(result => result.outcome === 'FAILURE' || result.outcome === 'BLOCKED_INTERNAL').length;
  const externalBlocks = input.missionResults.filter(result => result.outcome === 'BLOCKED_EXTERNAL').length;
  const rejected = input.missionResults.filter(result => result.outcome === 'REVERTED' || result.reverted).length;
  const decision = externalBlocks > 0 ? 'ESCALATE_EXTERNAL' : (rejected > 0 ? 'ROLLBACK' : (failures > 0 ? 'REVIEW' : 'CONTINUE'));
  return Object.freeze({exactSha: input.exactSha, decision, failureCount: failures, externalBlockCount: externalBlocks, rejectedStrategyCount: rejected, upgradeCount: input.upgrades.proposals.length, skillStatus: input.skillValidation.status, authority: 'ADVISORY_ONLY' as const, mutationAllowed: false, certificationAllowed: false});
}

export const FAILURE_INJECTION_CATALOG = Object.freeze([
  'STALE_SHA',
  'DUPLICATE_KNOWLEDGE',
  'CONTRADICTORY_KNOWLEDGE',
  'POISONED_PROVENANCE',
  'EXPIRED_SKILL',
  'LOW_CONFIDENCE_PROMOTION',
  'MISSING_REPLAY_INPUT',
  'EXTERNAL_ORACLE_UNKNOWN',
  'PRODUCT_AGENT_HANDOFF_MISMATCH',
  'FILTER_MASK_RUNTIME_DEPENDENCY_MISSING',
  'CAMERA_RECORDER_EVIDENCE_GAP',
]);

export type FailureInjectionId = typeof FAILURE_INJECTION_CATALOG[number];

export function injectFailureScenario(input: {injection: FailureInjectionId; exactSha: string; payload: Readonly<Record<string, unknown>>}) {
  if (!SHA40.test(input.exactSha)) throw new Error('FAILURE_INJECTION_SHA_INVALID');
  if (!FAILURE_INJECTION_CATALOG.includes(input.injection)) throw new Error('FAILURE_INJECTION_UNKNOWN');
  const payload = {...input.payload};
  switch (input.injection) {
    case 'STALE_SHA': payload.exactSha = '0'.repeat(40); break;
    case 'DUPLICATE_KNOWLEDGE': { const records = Array.isArray(payload.records) ? payload.records : []; payload.records = [...records, ...records]; break; }
    case 'CONTRADICTORY_KNOWLEDGE': payload.polarity = 'REFUTES'; payload.contradictionInjected = true; break;
    case 'POISONED_PROVENANCE': payload.provenance = ['GENERATED_UNTRUSTED']; break;
    case 'EXPIRED_SKILL': payload.skillStatus = 'EXPIRED'; break;
    case 'LOW_CONFIDENCE_PROMOTION': payload.confidence = 0; payload.promotionEligible = false; break;
    case 'MISSING_REPLAY_INPUT': payload.memorySnapshotIds = []; payload.replayInputMissing = true; break;
    case 'EXTERNAL_ORACLE_UNKNOWN': payload.oracle = 'UNKNOWN'; break;
    case 'PRODUCT_AGENT_HANDOFF_MISMATCH': payload.capabilityId = ''; payload.evidenceRefs = []; break;
    case 'FILTER_MASK_RUNTIME_DEPENDENCY_MISSING': payload.dependencies = []; payload.runtimeDependencyMissing = true; break;
    case 'CAMERA_RECORDER_EVIDENCE_GAP': payload.evidenceRefs = []; payload.evidenceGap = true; break;
    default: throw new Error('FAILURE_INJECTION_UNKNOWN');
  }
  const mutationDigest = hash({injection: input.injection, exactSha: input.exactSha, payload});
  return Object.freeze({injection: input.injection, exactSha: input.exactSha, mutatedPayload: Object.freeze(payload), mutationDigest, authoritative: false, mutationAllowed: false, certificationAllowed: false});
}
export function validateFailureInjection(input: ReturnType<typeof injectFailureScenario>) {
  if (!SHA40.test(input.exactSha) || !SHA256.test(input.mutationDigest)) throw new Error('FAILURE_INJECTION_EVIDENCE_INVALID');
  if (input.authoritative || input.mutationAllowed || input.certificationAllowed) throw new Error('FAILURE_INJECTION_AUTHORITY_VIOLATION');
  return true;
}

export function validateHandoff(input: { missionId: string; exactSha: string; capabilityId: string; evidenceRefs: readonly string[] }) {
  if (!input.missionId || !SHA40.test(input.exactSha) || !input.capabilityId || input.evidenceRefs.length === 0) throw new Error('PRODUCT_AGENT_HANDOFF_INVALID');
}

export function rootCauseMemoryLink(input: { productFailureId: string; rootCause: string; exactSha: string; failureFingerprint: string; evidenceRefs: readonly string[] }) {
  if (!input.productFailureId || !input.rootCause || !SHA40.test(input.exactSha) || !SHA256.test(input.failureFingerprint) || input.evidenceRefs.length === 0) {
    throw new Error('ROOT_CAUSE_MEMORY_LINK_INVALID');
  }
  return Object.freeze({ id: `RC-${hash(input).slice(0, 24)}`, layer: 'L3' as const, status: 'OBSERVED' as const, exactSha: input.exactSha, failureFingerprint: input.failureFingerprint });
}

export const SWARM_CONTRACT_VERSION = 'WAVE5-ROUTING-MEMORY-LEARNING-INTELLIGENCE-v2';

export function expandSwarmSelection(currentIds: readonly string[], availableIds: readonly string[], targetSize: number) {
  const current = validateActiveBotSet(currentIds);
  const available = validateActiveBotSet(availableIds);
  if (!Number.isInteger(targetSize) || targetSize < current.length || targetSize > Math.min(50, REGISTERED_BOT_COUNT)) {
    throw new Error('SWARM_EXPANSION_TARGET_INVALID');
  }
  const additions = available.filter(id => !current.includes(id)).slice(0, targetSize - current.length);
  return Object.freeze([...current, ...additions]);
}

export function buildRcaChain(input: {
  trigger: string;
  propagation: string;
  violatedInvariant: string;
  causalSource: string;
  symptom: string;
  exactSha: string;
  evidenceRefs: readonly string[];
}) {
  if (!SHA40.test(input.exactSha) || input.evidenceRefs.length === 0) throw new Error('RCA_CHAIN_EVIDENCE_INVALID');
  return Object.freeze({
    trigger: normalize(input.trigger),
    propagation: normalize(input.propagation),
    violatedInvariant: normalize(input.violatedInvariant),
    causalSource: normalize(input.causalSource),
    symptom: normalize(input.symptom),
    exactSha: input.exactSha,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    fingerprint: fingerprintFailure({
      category: input.violatedInvariant,
      normalizedMessage: input.symptom,
      violatedInvariant: input.violatedInvariant,
      causalSource: input.causalSource,
      affectedScope: input.causalSource,
    }),
  });
}

export function evaluateShadowStrategy(input: {
  baseline: { oracle: 'PASS' | 'FAIL' | 'UNKNOWN'; outputHash: string };
  shadow: { oracle: 'PASS' | 'FAIL' | 'UNKNOWN'; outputHash: string };
}) {
  const comparison = compareReplay({
    historicalOracle: input.baseline.oracle,
    currentOracle: input.shadow.oracle,
    historicalOutputHash: input.baseline.outputHash,
    currentOutputHash: input.shadow.outputHash,
  });
  return Object.freeze({
    ...comparison,
    sideEffectFree: true,
    authoritative: false,
    promotionRequired: true,
  });
}
