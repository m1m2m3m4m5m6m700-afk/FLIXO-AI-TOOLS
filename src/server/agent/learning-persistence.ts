import { createHash } from 'node:crypto';

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const LEARNING_KINDS = new Set(['LESSON', 'ANTI_LESSON', 'ADVICE', 'COUNTEREXAMPLE']);

type LearningConfig = { url: string; key: string };

export type ExternalAgentLearning = Readonly<{
  learning_id: string;
  source_agent: string;
  source_role: string;
  kind: 'LESSON' | 'ANTI_LESSON' | 'ADVICE' | 'COUNTEREXAMPLE';
  status: 'PROPOSED' | 'VERIFIED' | 'BLOCKED' | 'SUPERSEDED';
  task_id: string;
  target_sha: string;
  claim: string;
  content: string;
  evidence_refs: string[];
  provenance: Record<string, unknown>;
  fingerprint: string;
  canonical_green: boolean;
  created_at: string;
}>;

export type ExternalLearningCandidateInput = Readonly<{
  sourceAgent: string;
  sourceRole: string;
  kind: ExternalAgentLearning['kind'];
  taskId: string;
  targetSha: string;
  claim: string;
  content: string;
  evidenceRefs?: readonly string[];
  provenance?: Record<string, unknown>;
}>;

const config = (): LearningConfig | null => {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/u, '');
  const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) return null;
  return { url, key };
};

const request = async (path: string, init: RequestInit = {}) => {
  const cfg = config();
  if (!cfg) throw new Error('EXTERNAL_AGENT_LEARNING_PERSISTENCE_NOT_CONFIGURED');
  const headers = new Headers(init.headers);
  headers.set('apikey', cfg.key);
  headers.set('Authorization', `Bearer ${cfg.key}`);
  headers.set('Accept', 'application/json');
  const response = await fetch(`${cfg.url}${path}`, { ...init, headers });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message?: unknown }).message)
      : `http_${response.status}`;
    throw new Error(`EXTERNAL_AGENT_LEARNING_PERSISTENCE_FAILED:${detail}`);
  }
  return body;
};

const digest = (input: Omit<ExternalLearningCandidateInput, 'evidenceRefs' | 'provenance'>) =>
  createHash('sha256')
    .update(JSON.stringify(input), 'utf8')
    .digest('hex');

const validateCandidate = (input: ExternalLearningCandidateInput) => {
  if (!String(input.sourceAgent).trim()) throw new Error('EXTERNAL_AGENT_LEARNING_SOURCE_REQUIRED');
  if (!String(input.sourceRole).trim()) throw new Error('EXTERNAL_AGENT_LEARNING_ROLE_REQUIRED');
  if (!LEARNING_KINDS.has(input.kind)) throw new Error('EXTERNAL_AGENT_LEARNING_KIND_INVALID');
  if (!String(input.taskId).trim()) throw new Error('EXTERNAL_AGENT_LEARNING_TASK_REQUIRED');
  if (!SHA40.test(String(input.targetSha))) throw new Error('EXTERNAL_AGENT_LEARNING_SHA_REQUIRED');
  if (!String(input.claim).trim() || String(input.claim).length > 8_000) throw new Error('EXTERNAL_AGENT_LEARNING_CLAIM_INVALID');
  if (!String(input.content).trim() || String(input.content).length > 16_000) throw new Error('EXTERNAL_AGENT_LEARNING_CONTENT_INVALID');
  if ((input.evidenceRefs ?? []).length > 32) throw new Error('EXTERNAL_AGENT_LEARNING_EVIDENCE_LIMIT');
};

export const isExternalAgentLearningPersistenceConfigured = () => config() !== null;

export async function createExternalAgentLearning(input: ExternalLearningCandidateInput): Promise<ExternalAgentLearning | null> {
  validateCandidate(input);
  const fingerprint = digest({
    sourceAgent: String(input.sourceAgent),
    sourceRole: String(input.sourceRole),
    kind: input.kind,
    taskId: String(input.taskId),
    targetSha: String(input.targetSha),
    claim: String(input.claim),
    content: String(input.content),
  });
  const payload = {
    source_agent: String(input.sourceAgent).trim(),
    source_role: String(input.sourceRole).trim(),
    kind: input.kind,
    status: 'PROPOSED',
    task_id: String(input.taskId).trim(),
    target_sha: String(input.targetSha),
    claim: String(input.claim).trim(),
    content: String(input.content).trim(),
    evidence_refs: [...(input.evidenceRefs ?? [])].map((value) => String(value).slice(0, 512)),
    provenance: input.provenance ?? {},
    fingerprint,
    canonical_green: false,
  };
  const body = await request('/rest/v1/flixo_agent_learning_events?on_conflict=fingerprint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(payload),
  });
  const row = Array.isArray(body) ? body[0] : null;
  return row && typeof row === 'object' ? row as ExternalAgentLearning : null;
}

export async function listExternalAgentLearning(targetSha: string, limit = 64): Promise<readonly ExternalAgentLearning[]> {
  if (!SHA40.test(String(targetSha))) throw new Error('EXTERNAL_AGENT_LEARNING_SHA_REQUIRED');
  if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new Error('EXTERNAL_AGENT_LEARNING_LIMIT_INVALID');
  const body = await request(
    `/rest/v1/flixo_agent_learning_events?target_sha=eq.${encodeURIComponent(targetSha)}&status=neq.BLOCKED&select=*&order=created_at.desc&limit=${limit}`,
  );
  if (!Array.isArray(body)) throw new Error('EXTERNAL_AGENT_LEARNING_RESPONSE_INVALID');
  return Object.freeze(body.filter((item): item is ExternalAgentLearning => {
    if (!item || typeof item !== 'object') return false;
    const record = item as Partial<ExternalAgentLearning>;
    return SHA256.test(String(record.fingerprint ?? ''))
      && SHA40.test(String(record.target_sha ?? ''))
      && LEARNING_KINDS.has(String(record.kind ?? ''))
      && String(record.claim ?? '').trim().length > 0;
  }));
}
