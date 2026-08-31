import type { ContractDefinition } from './foundation.ts';
import { CONTRACT_IDS } from './ids.ts';

export const CONTRACT_DEFINITIONS: readonly ContractDefinition[] = [
  { id: CONTRACT_IDS.G1_REGISTRY, version: 1, gate: 'G1', description: 'Registry structure and parity' },
  { id: CONTRACT_IDS.G2_EXTENSION, version: 1, gate: 'G2', description: 'Input extension safety' },
  { id: CONTRACT_IDS.G3_OUTPUT, version: 1, gate: 'G3', description: 'Artifact output existence' },
  { id: CONTRACT_IDS.G4_ROUTE, version: 1, gate: 'G4', description: 'Public route contract' },
  { id: CONTRACT_IDS.G4_TITLE, version: 1, gate: 'G4', description: 'Localized document title' },
  { id: CONTRACT_IDS.G4_CANONICAL, version: 1, gate: 'G4', description: 'Production canonical URL' },
] as const;

const ids = new Set<string>();
for (const definition of CONTRACT_DEFINITIONS) {
  if (ids.has(definition.id)) throw new Error(`Duplicate contract ID: ${definition.id}`);
  ids.add(definition.id);
  if (!/^G[1-4]-[A-Z0-9-]+-\d+$/.test(definition.id)) {
    throw new Error(`Invalid contract ID: ${definition.id}`);
  }
  if (definition.version !== 1) throw new Error(`Unsupported contract version: ${definition.id}`);
}

export function getContractDefinition(id: string): ContractDefinition | undefined {
  return CONTRACT_DEFINITIONS.find((definition) => definition.id === id);
}
