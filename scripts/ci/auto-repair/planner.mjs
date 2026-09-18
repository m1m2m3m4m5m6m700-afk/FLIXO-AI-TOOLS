import { extractFeatures } from './fingerprint.mjs';
import { reasonFailure } from './reasoning.mjs';

const plans = [
  { id: 'external-tooling', features: ['external-tooling'], confidence: 99, mutate: false, commands: [] },
  { id: 'eslint-file', features: ['lint'], confidence: 92, mutate: true, commands: [] },
  { id: 'prettier-file', features: ['format'], confidence: 90, mutate: true, commands: [] },
  { id: 'typescript-diagnostic', features: ['typescript'], confidence: 88, mutate: false, commands: [['npm', ['run', 'typecheck']]] },
  { id: 'playwright-diagnostic', features: ['playwright'], confidence: 72, mutate: false, commands: [] },
  { id: 'webkit-proposal', features: ['webkit'], confidence: 68, mutate: false, commands: [] },
  { id: 'certification-proposal', features: ['certification'], confidence: 68, mutate: false, commands: [] },
  { id: 'build-diagnostic', features: ['build'], confidence: 82, mutate: false, commands: [['npm', ['run', 'test:build']]] },
];

export function planRepair(log, { historical = [] } = {}) {
  const features = extractFeatures(log);
  const reasoning = reasonFailure(log, { historical });
  const candidates = plans
    .filter((plan) => plan.features.some((feature) => features.includes(feature)))
    .map((plan) => ({ ...plan, evidence: features }))
    .sort((a, b) => b.confidence - a.confidence);
  const safe = candidates.filter((plan) => plan.mutate && plan.confidence >= 90);
  const selectedRule = reasoning.rootCause === 'format' ? 'prettier-file' : reasoning.rootCause === 'lint' ? 'eslint-file' : reasoning.rootCause;
  const requiresSourceLocation = selectedRule === 'prettier-file' || selectedRule === 'eslint-file';
  const selected = reasoning.decision === 'ALLOW_BOUNDED_MUTATION' && safe.length === 1 && safe[0].id === selectedRule && (!requiresSourceLocation || Boolean(reasoning.location?.file))
    ? { ...safe[0], file: reasoning.location?.file ?? null }
    : null;
  return {
    features,
    candidates,
    selected,
    blockedReason: reasoning.decision === 'BLOCK_EXTERNAL' ? 'external-tooling' : selected ? null : reasoning.ambiguity ? 'ambiguous-causality' : null,
    reasoning,
  };
}
