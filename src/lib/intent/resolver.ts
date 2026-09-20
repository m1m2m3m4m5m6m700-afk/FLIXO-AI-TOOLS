import { TOOLS_REGISTRY, type ToolConfig } from '../../config/tools';
import { CAPABILITY_REGISTRY } from '@/lib/agent/capability-registry';
import { WORKFLOW_REGISTRY } from '../workflows/registry';
import type { IntentMatch } from '../workflows/types';
import { includesTerm, normalizeIntent } from './normalize';
import { createFilterMaskHandoff } from '@/tools/filter-mask/handoff';
import { getLiveFilter, resolveLiveFilter } from '@/tools/filter-mask/registry';

type KeywordRule = {
  readonly id: ToolConfig['id'];
  readonly terms: readonly string[];
};

const TOOL_RULES: readonly KeywordRule[] = Object.freeze(
  CAPABILITY_REGISTRY
    .filter((capability) => capability.intents.length > 0 && capability.state !== 'UNAVAILABLE')
    .map((capability) => ({ id: capability.id, terms: capability.intents })),
);

const score = (normalized: string, terms: readonly string[]) => {
  const matchedTerms = terms.filter((term) => includesTerm(normalized, term));
  return { matchedTerms, value: matchedTerms.length };
};

const resolveBest = <T extends { readonly id: string; readonly intentPatterns: readonly string[] }>(
  normalized: string,
  candidates: readonly T[],
): IntentMatch => {
  let winner: { candidate: T; matchedTerms: string[]; value: number } | null = null;
  for (const candidate of candidates) {
    const result = score(normalized, candidate.intentPatterns);
    if (result.value === 0) continue;
    if (!winner || result.value > winner.value) {
      winner = { candidate, matchedTerms: result.matchedTerms, value: result.value };
    }
  }
  if (!winner) return { kind: 'none', id: null, confidence: 0, matchedTerms: [] };
  return {
    kind: 'workflow',
    id: winner.candidate.id,
    confidence: Math.min(0.96, 0.58 + winner.value * 0.14),
    matchedTerms: winner.matchedTerms,
  };
};

export const resolveIntent = (input: string): IntentMatch => {
  const normalized = normalizeIntent(input);
  if (!normalized) return { kind: 'none', id: null, confidence: 0, matchedTerms: [] };

  const workflowMatch = resolveBest(normalized, WORKFLOW_REGISTRY);
  const toolCandidates = TOOL_RULES.map((rule) => ({ ...rule, intentPatterns: rule.terms }));
  const toolMatch = resolveBest(normalized, toolCandidates);

  if (workflowMatch.confidence >= 0.72 && workflowMatch.confidence >= toolMatch.confidence) return workflowMatch;
  if (toolMatch.confidence >= 0.72) return { ...toolMatch, kind: 'tool' };
  return {
    kind: 'none',
    id: null,
    confidence: Math.max(workflowMatch.confidence, toolMatch.confidence),
    matchedTerms: [...workflowMatch.matchedTerms, ...toolMatch.matchedTerms],
  };
};

export const getResolvedTool = (id: string) => TOOLS_REGISTRY.find((tool) => tool.id === id);


export const resolveFilterMaskSelection = (input: string) => {
  const intent = resolveIntent(input);
  if (intent.kind !== 'tool' || intent.id !== 'filter-mask') return null;

  const selected = resolveLiveFilter(input) ?? getLiveFilter('effect.original');
  if (!selected) return null;

  const intensityMatch = input.match(/(?:intensity|strength|شدة|قوة)?\s*(\d{1,3})\s*%/i);
  const zoomMatch = input.match(/(?:zoom|تكبير|زوم)\s*(\d+(?:\.\d+)?)\s*x?/i);
  const aspectMatch = input.match(/(?:9\s*:\s*16|4\s*:\s*5|1\s*:\s*1|16\s*:\s*9|vertical|portrait|عمودي|طولي|square|مربع)/i);
  const intensity = intensityMatch ? Number(intensityMatch[1]) : 100;
  const zoom = zoomMatch ? Number(zoomMatch[1]) : 1;
  const aspectToken = aspectMatch?.[0]?.replace(/\s+/g, '').toLocaleLowerCase();
  const quality = /(?:1080p|1080\s*p|full\s*hd|fhd|عالي\s*الجودة|فل\s*إتش\s*دي)/i.test(input)
    ? '1080p'
    : /(?:720p|720\s*p|hd|1280\s*[x×]\s*720)/i.test(input)
      ? '720p'
      : '1080p';
  const aspectRatio = aspectToken === 'vertical' || aspectToken === 'portrait' || aspectToken === 'عمودي' || aspectToken === 'طولي' || aspectToken === '9:16'
    ? '9:16'
    : aspectToken === '4:5' ? '4:5'
      : aspectToken === '1:1' || aspectToken === 'square' || aspectToken === 'مربع' ? '1:1'
        : aspectToken === '16:9' ? '16:9' : '9:16';

  return createFilterMaskHandoff(selected, {
    intensity: Number.isFinite(intensity) ? intensity : 100,
    zoom: Number.isFinite(zoom) ? zoom : 1,
    aspectRatio,
    captureQuality: quality,
  });
};
