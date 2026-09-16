import { extractFeatures } from './fingerprint.mjs';

const plans = [
  { id: 'eslint-unused', features: ['lint'], confidence: 92, mutate: true, commands: [['npx', ['eslint', '.', '--fix']]] },
  { id: 'prettier', features: ['lint'], confidence: 84, mutate: true, commands: [['npx', ['prettier', '--write', '.']] ] },
  { id: 'typescript-diagnostic', features: ['typescript'], confidence: 88, mutate: false, commands: [['npm', ['run', 'typecheck']]] },
  { id: 'playwright-diagnostic', features: ['playwright'], confidence: 72, mutate: false, commands: [['npm', ['run', 'test:browser']]] },
  { id: 'webkit-proposal', features: ['webkit'], confidence: 68, mutate: false, commands: [] },
  { id: 'certification-proposal', features: ['certification'], confidence: 68, mutate: false, commands: [] },
];

export function planRepair(log) {
  const features = extractFeatures(log);
  const candidates = plans
    .filter((plan) => plan.features.some((feature) => features.includes(feature)))
    .map((plan) => ({ ...plan, evidence: features }))
    .sort((a, b) => b.confidence - a.confidence);
  return { features, candidates, selected: candidates.find((plan) => plan.mutate && plan.confidence >= 90) ?? candidates[0] ?? null };
}
