import { extractFeatures } from './fingerprint.mjs';

const plans = [
  { id: 'eslint-unused', features: ['lint'], confidence: 92, mutate: true, commands: [['npx', ['eslint', '.', '--fix']]] },
  { id: 'prettier', features: ['format'], confidence: 90, mutate: true, commands: [['npx', ['prettier', '--write', '.']]] },
  { id: 'typescript-diagnostic', features: ['typescript'], confidence: 88, mutate: false, commands: [['npm', ['run', 'typecheck']]] },
  { id: 'playwright-diagnostic', features: ['playwright'], confidence: 72, mutate: false, commands: [] },
  { id: 'webkit-proposal', features: ['webkit'], confidence: 68, mutate: false, commands: [] },
  { id: 'certification-proposal', features: ['certification'], confidence: 68, mutate: false, commands: [] },
  { id: 'build-diagnostic', features: ['build'], confidence: 82, mutate: false, commands: [['npm', ['run', 'test:build']]] },
];

export function planRepair(log) {
  const features = extractFeatures(log);
  const candidates = plans
    .filter((plan) => plan.features.some((feature) => features.includes(feature)))
    .map((plan) => ({ ...plan, evidence: features }))
    .sort((a, b) => b.confidence - a.confidence);
  const safe = candidates.filter((plan) => plan.mutate && plan.confidence >= 90);
  return { features, candidates, selected: safe.length === 1 ? safe[0] : null };
}
