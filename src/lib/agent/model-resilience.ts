import type { ModelProvider } from './model-governance.ts';
import type { ModelFabricCandidate } from './model-fabric.ts';

export type ProviderCircuitState = Readonly<{
  failures: number;
  openedAt: number | null;
  lastFailureAt: number | null;
}>;

export type ModelAttempt = Readonly<{
  provider: ModelProvider;
  model: string;
  rank: number;
}>;

const FAILURE_THRESHOLD = 2;
const COOLDOWN_MS = 30_000;
const circuits = new Map<ModelProvider, { failures: number; openedAt: number | null; lastFailureAt: number | null }>();

function state(provider: ModelProvider) {
  let current = circuits.get(provider);
  if (!current) {
    current = { failures: 0, openedAt: null, lastFailureAt: null };
    circuits.set(provider, current);
  }
  return current;
}

export function getProviderCircuitState(provider: ModelProvider): ProviderCircuitState {
  return Object.freeze({ ...state(provider) });
}

export function isProviderCircuitOpen(provider: ModelProvider, now = Date.now()): boolean {
  const current = state(provider);
  if (current.openedAt === null) return false;
  if (now - current.openedAt >= COOLDOWN_MS) {
    current.openedAt = null;
    current.failures = 0;
    return false;
  }
  return true;
}

export function recordProviderSuccess(provider: ModelProvider): void {
  const current = state(provider);
  current.failures = 0;
  current.openedAt = null;
}

export function recordProviderFailure(provider: ModelProvider, now = Date.now()): ProviderCircuitState {
  const current = state(provider);
  current.failures += 1;
  current.lastFailureAt = now;
  if (current.failures >= FAILURE_THRESHOLD) current.openedAt = now;
  return Object.freeze({ ...current });
}

export function resetProviderCircuits(): void {
  circuits.clear();
}

export function admittedHostedCandidates(candidates: readonly ModelFabricCandidate[]): readonly ModelFabricCandidate[] {
  return Object.freeze(candidates.filter((candidate) => candidate.entry.deployment_mode === 'HOSTED' && candidate.entry.provider !== 'local'));
}

export function nextModelAttempts(candidates: readonly ModelFabricCandidate[], now = Date.now()): readonly ModelAttempt[] {
  return Object.freeze(
    admittedHostedCandidates(candidates)
      .filter((candidate) => !isProviderCircuitOpen(candidate.entry.provider, now))
      .map((candidate) => Object.freeze({
        provider: candidate.entry.provider,
        model: candidate.entry.model,
        rank: candidate.rank,
      })),
  );
}

export const MODEL_RESILIENCE_POLICY = Object.freeze({
  failureThreshold: FAILURE_THRESHOLD,
  cooldownMs: COOLDOWN_MS,
  retryLoops: false,
  deterministicFallback: true,
  sameCanonicalPlanContract: true,
  failClosedOnNoAdmittedCandidate: true,
});
