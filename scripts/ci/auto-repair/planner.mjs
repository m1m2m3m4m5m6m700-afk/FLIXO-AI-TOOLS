import { extractFeatures } from './fingerprint.mjs';

const plans = [
  { id: 'eslint-unused', features: ['lint'], confidence: 92, mutate: true, commands: [['npx', ['eslint', '.', '--fix']]], risk: 'auto-fix' },
  { id: 'prettier', features: ['format'], confidence: 90, mutate: true, commands: [['npx', ['prettier', '--write', '.']]], risk: 'auto-fix' },
  { id: 'typescript-diagnostic', features: ['typescript'], confidence: 88, mutate: false, commands: [['npm', ['run', 'typecheck']]], risk: 'human-gate' },
  { id: 'playwright-diagnostic', features: ['playwright'], confidence: 72, mutate: false, commands: [], risk: 'guarded-fix' },
  { id: 'webkit-proposal', features: ['webkit'], confidence: 68, mutate: false, commands: [], risk: 'human-gate' },
  { id: 'certification-proposal', features: ['certification'], confidence: 68, mutate: false, commands: [], risk: 'human-gate' },
  { id: 'build-diagnostic', features: ['build'], confidence: 82, mutate: false, commands: [['npm', ['run', 'test:build']]], risk: 'human-gate' },
];

export function planRepair(log, memory = { playbooks: [] }) {
  const features = extractFeatures(log);
  const candidates = plans
    .filter((plan) => plan.features.some((feature) => features.includes(feature)))
    .map((plan) => {
      const history = memory.playbooks.find((item) => item.rule === plan.id);
      const verifiedRate = history?.attempts ? history.successes / history.attempts : 0;
      const adaptiveBonus = history?.attempts ? Math.min(8, verifiedRate * 8) : 0;
      return { ...plan, evidence: features, historicalAttempts: history?.attempts ?? 0, historicalSuccessRate: Number(verifiedRate.toFixed(4)), adaptiveConfidence: Math.min(99, plan.confidence + adaptiveBonus) };
    })
    .sort((a, b) => b.adaptiveConfidence - a.adaptiveConfidence || b.historicalSuccessRate - a.historicalSuccessRate);
  const safe = candidates.filter((plan) => plan.mutate && plan.adaptiveConfidence >= 90);
  return { features, candidates, selected: safe.length === 1 ? safe[0] : safe[0] ?? null };
}
