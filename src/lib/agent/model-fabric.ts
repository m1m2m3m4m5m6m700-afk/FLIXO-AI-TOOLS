import { listRegisteredModels, findRegisteredModel } from './model-registry.ts';
import { isProductionEligible } from './model-governance.ts';
import type { ModelManifestEntry, ModelProvider, ModelTaskKind } from './model-governance.ts';
import { classifyModelTask } from './model-router.ts';

export type ModelFabricCandidate = Readonly<{ entry: ModelManifestEntry; task: ModelTaskKind; rank: number }>;

function orderedProviders(preferredProvider?: ModelProvider): readonly ModelProvider[] {
  const base: ModelProvider[] = ['openrouter', 'openai', 'gemini', 'local'];
  if (!preferredProvider) return base;
  return [preferredProvider, ...base.filter((provider) => provider !== preferredProvider)];
}

export function listAdmittedModelCandidates(input: { taskInput: string; preferredProvider?: ModelProvider; preferredModel?: string | null }): readonly ModelFabricCandidate[] {
  const task = classifyModelTask(input.taskInput);
  const preferred = input.preferredModel?.trim();
  const exact = preferred ? findRegisteredModel(preferred) : null;
  const exactCandidate = exact && isProductionEligible(exact) && exact.supported_tasks.includes(task) ? [{ entry: exact, task, rank: 0 }] : [];
  const seen = new Set<string>(exactCandidate.map((candidate) => candidate.entry.model + '@' + candidate.entry.version));
  const pool: ModelFabricCandidate[] = [];
  let rank = 1;
  for (const provider of orderedProviders(input.preferredProvider)) {
    for (const entry of listRegisteredModels()) {
      if (!isProductionEligible(entry) || entry.provider !== provider || !entry.supported_tasks.includes(task)) continue;
      const identity = entry.model + '@' + entry.version;
      if (seen.has(identity)) continue;
      seen.add(identity);
      pool.push({ entry, task, rank });
      rank += 1;
    }
  }
  return Object.freeze([...exactCandidate, ...pool]);
}

export function assertFabricCandidate(candidate: ModelFabricCandidate): ModelFabricCandidate {
  if (!isProductionEligible(candidate.entry)) throw new Error('MODEL_NOT_ADMITTED:' + candidate.entry.model + '@' + candidate.entry.version);
  if (!candidate.entry.supported_tasks.includes(candidate.task)) throw new Error('MODEL_TASK_NOT_SUPPORTED:' + candidate.entry.model + ':' + candidate.task);
  return candidate;
}
