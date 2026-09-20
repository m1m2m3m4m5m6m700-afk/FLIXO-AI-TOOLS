#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const PROMPT_REGISTRY_PATH = process.env.FLIXO_PROMPT_REGISTRY ?? 'docs/agents/PROMPT-REGISTRY.json';
export const PROMPT_STATUSES = Object.freeze(['ACTIVE', 'CANDIDATE', 'MERGED', 'DEPRECATED', 'BLOCKED', 'SUPERSEDED']);
const REQUIRED_FIELDS = Object.freeze([
  'promptId', 'title', 'path', 'domain', 'agentRole', 'failureClasses', 'fingerprints',
  'rootCauses', 'scope', 'repairStrategy', 'verificationPlan', 'learningRequirements',
  'status', 'version', 'createdBy', 'lastUpdatedBy', 'provenance', 'relatedPrompts',
  'supersedes', 'supersededBy', 'antiPatterns', 'exactShaRequirements',
]);

const asList = (value) => Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim()).filter(Boolean))] : [];
const jaccard = (left, right) => {
  const a = new Set(asList(left));
  const b = new Set(asList(right));
  if (!a.size && !b.size) return 1;
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / new Set([...a, ...b]).size;
};

export function loadPromptRegistry(registryPath = PROMPT_REGISTRY_PATH) {
  const resolved = path.resolve(registryPath);
  if (!fs.existsSync(resolved)) throw new Error(`PROMPT_REGISTRY_MISSING=${registryPath}`);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(parsed?.prompts)) throw new Error('PROMPT_REGISTRY_PROMPTS_MISSING');
  return parsed;
}

export function functionalKey(prompt) {
  const payload = {
    failureClasses: asList(prompt.failureClasses).sort(),
    rootCauses: asList(prompt.rootCauses).sort(),
    scope: String(prompt.scope ?? '').trim(),
    repairStrategy: asList(prompt.repairStrategy).sort(),
    verificationPlan: asList(prompt.verificationPlan).sort(),
  };
  return createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24);
}

export function comparePrompts(left, right) {
  const classScore = jaccard(left.failureClasses, right.failureClasses);
  const rootCauseScore = jaccard(left.rootCauses, right.rootCauses);
  const strategyScore = jaccard(left.repairStrategy, right.repairStrategy);
  const verificationScore = jaccard(left.verificationPlan, right.verificationPlan);
  const scopeScore = String(left.scope ?? '').trim() === String(right.scope ?? '').trim() ? 1 : 0;
  const overlapScore = Number((classScore * 0.20 + rootCauseScore * 0.25 + scopeScore * 0.20 + strategyScore * 0.20 + verificationScore * 0.15).toFixed(4));
  return {
    sameFunctionalKey: functionalKey(left) === functionalKey(right),
    overlapScore,
    scores: { classScore, rootCauseScore, scopeScore, strategyScore, verificationScore },
  };
}

export function validatePromptRecord(prompt, registry) {
  const errors = [];
  const warnings = [];
  for (const field of REQUIRED_FIELDS) {
    if (!(field in (prompt ?? {}))) errors.push(`MISSING_FIELD=${field}`);
  }
  if (!PROMPT_STATUSES.includes(prompt?.status)) errors.push('INVALID_STATUS');
  if (!/^RPR-[A-Z0-9-]+-\d{3}$/.test(String(prompt?.promptId ?? ''))) errors.push('INVALID_PROMPT_ID');
  for (const field of ['failureClasses', 'fingerprints', 'rootCauses', 'repairStrategy', 'verificationPlan', 'learningRequirements', 'relatedPrompts', 'supersedes', 'supersededBy', 'antiPatterns']) {
    if (!Array.isArray(prompt?.[field])) errors.push(`FIELD_NOT_ARRAY=${field}`);
  }
  if (!asList(prompt?.failureClasses).length) errors.push('EMPTY_FAILURE_CLASSES');
  if (!asList(prompt?.rootCauses).length) errors.push('EMPTY_ROOT_CAUSES');
  if (!String(prompt?.scope ?? '').trim()) errors.push('EMPTY_SCOPE');
  if (!asList(prompt?.repairStrategy).length) errors.push('EMPTY_REPAIR_STRATEGY');
  if (!asList(prompt?.verificationPlan).length) errors.push('EMPTY_VERIFICATION_PLAN');
  if (!asList(prompt?.learningRequirements).length) errors.push('EMPTY_LEARNING_REQUIREMENTS');
  if (!prompt?.provenance || typeof prompt.provenance !== 'object') errors.push('MISSING_PROVENANCE');
  if (!prompt?.exactShaRequirements || typeof prompt.exactShaRequirements !== 'object') errors.push('EMPTY_EXACT_SHA_REQUIREMENTS');
  if (!String(prompt?.path ?? '').trim()) errors.push('EMPTY_PATH');
  const registryIds = new Set((registry?.prompts ?? []).map((item) => item.promptId));
  for (const related of [...asList(prompt?.relatedPrompts), ...asList(prompt?.supersedes), ...asList(prompt?.supersededBy)]) {
    if (!registryIds.has(related)) errors.push(`UNKNOWN_RELATED_PROMPT=${related}`);
  }
  if (prompt?.path && !fs.existsSync(path.resolve(prompt.path))) errors.push(`PATH_MISSING=${prompt.path}`);
  if (prompt?.status === 'ACTIVE') {
    if (asList(prompt?.fingerprints).length === 0 && asList(prompt?.failureClasses).includes('ALL_REPAIRABLE') === false && asList(prompt?.rootCauses).includes('ANY_CONFIRMED_RCA') === false) {
      warnings.push('ACTIVE_PROMPT_HAS_NO_EXPLICIT_FINGERPRINTS');
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function detectPromptRelations(prompts) {
  const relations = [];
  for (let i = 0; i < prompts.length; i += 1) {
    for (let j = i + 1; j < prompts.length; j += 1) {
      const a = prompts[i];
      const b = prompts[j];
      const comparison = comparePrompts(a, b);
      if (comparison.sameFunctionalKey) relations.push({ type: 'DUPLICATE', promptA: a.promptId, promptB: b.promptId, overlapScore: comparison.overlapScore });
      else if (comparison.overlapScore >= 0.85) relations.push({ type: 'OVERLAP_REVIEW', promptA: a.promptId, promptB: b.promptId, overlapScore: comparison.overlapScore });
    }
  }
  return relations;
}

export function validatePromptRegistry(registry) {
  const errors = [];
  const warnings = [];
  const prompts = registry?.prompts ?? [];
  const ids = new Set();
  if (registry?.schemaVersion !== 1) errors.push('INVALID_SCHEMA_VERSION');
  if (registry?.authority !== 'PROMPT_INTELLIGENCE_LAYER') errors.push('INVALID_AUTHORITY');
  for (const prompt of prompts) {
    if (ids.has(prompt.promptId)) errors.push(`DUPLICATE_PROMPT_ID=${prompt.promptId}`);
    ids.add(prompt.promptId);
    const result = validatePromptRecord(prompt, registry);
    errors.push(...result.errors.map((item) => `${prompt.promptId}:${item}`));
    warnings.push(...result.warnings.map((item) => `${prompt.promptId}:${item}`));
  }
  const relations = detectPromptRelations(prompts);
  for (const relation of relations) {
    const a = prompts.find((prompt) => prompt.promptId === relation.promptA);
    const b = prompts.find((prompt) => prompt.promptId === relation.promptB);
    if (relation.type === 'DUPLICATE' && a?.status === 'ACTIVE' && b?.status === 'ACTIVE') errors.push(`PROMPT_DUPLICATE_ACTIVE=${a.promptId},${b.promptId}`);
    if (relation.type === 'OVERLAP_REVIEW' && a?.status === 'ACTIVE' && b?.status === 'ACTIVE') warnings.push(`PROMPT_REVIEW_REQUIRED=${a.promptId},${b.promptId},score=${relation.overlapScore}`);
  }
  return { valid: errors.length === 0, errors, warnings, relations };
}

export function selectPromptCandidates(registry, { failureClasses = [], rootCauses = [], domain = null, agentRole = null } = {}) {
  const wantedClasses = new Set(asList(failureClasses));
  const wantedRoots = new Set(asList(rootCauses));
  const score = (prompt) => {
    if (prompt.status !== 'ACTIVE') return -1;
    const classOverlap = jaccard(wantedClasses, prompt.failureClasses);
    const rootOverlap = jaccard(wantedRoots, prompt.rootCauses);
    const domainScore = domain && prompt.domain === domain ? 1 : 0;
    const roleScore = agentRole && prompt.agentRole === agentRole ? 1 : 0;
    return Number((classOverlap * 0.35 + rootOverlap * 0.35 + domainScore * 0.15 + roleScore * 0.15).toFixed(4));
  };
  return registry.prompts.map((prompt) => ({ prompt, score: score(prompt) })).filter((item) => item.score >= 0.10).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function promptQualityGate(registry, promptId) {
  const result = validatePromptRegistry(registry);
  const target = registry.prompts.find((item) => item.promptId === promptId);
  if (!target) return { status: 'PROMPT_REVIEW_REQUIRED', reasons: ['PROMPT_NOT_FOUND'], registry: result };
  const targetRelations = result.relations.filter((item) => item.promptA === promptId || item.promptB === promptId);
  const blockers = [
    ...result.errors.filter((item) => item.startsWith(`${promptId}:`)),
    ...targetRelations.filter((item) => item.type === 'DUPLICATE').map((item) => `DUPLICATE=${item.promptA},${item.promptB}`),
    ...targetRelations.filter((item) => item.type === 'OVERLAP_REVIEW').map((item) => `OVERLAP=${item.promptA},${item.promptB}`),
  ];
  return blockers.length || !['ACTIVE', 'CANDIDATE'].includes(target.status)
    ? { status: 'PROMPT_REVIEW_REQUIRED', reasons: blockers.length ? blockers : [`INVALID_STATUS_FOR_USE=${target.status}`], registry: result }
    : { status: 'PASS', reasons: [], registry: result };
}

if (path.basename(process.argv[1] ?? '') === 'prompt-intelligence.mjs') {
  const registry = loadPromptRegistry();
  const result = validatePromptRegistry(registry);
  console.log(JSON.stringify({ status: result.valid ? 'PASS' : 'PROMPT_REVIEW_REQUIRED', errors: result.errors, warnings: result.warnings, relations: result.relations }, null, 2));
  process.exit(result.valid ? 0 : 1);
}