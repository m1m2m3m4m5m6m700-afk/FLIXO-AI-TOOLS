import type { ContractDefinition } from './foundation.ts';
import { CONTRACT_IDS } from './ids.ts';

export const CONTRACT_DEFINITIONS: readonly ContractDefinition[] = Object.freeze([
  { id: CONTRACT_IDS.G1_REGISTRY, version: 1, gate: 'G1', description: 'Registry structure and parity' },
  { id: CONTRACT_IDS.G2_EXTENSION, version: 1, gate: 'G2', description: 'Input extension safety' },
  { id: CONTRACT_IDS.G3_OUTPUT, version: 1, gate: 'G3', description: 'Artifact output existence' },
  { id: CONTRACT_IDS.G4_ROUTE, version: 1, gate: 'G4', description: 'Public route contract' },
  { id: CONTRACT_IDS.G4_TITLE, version: 1, gate: 'G4', description: 'Localized document title' },
  { id: CONTRACT_IDS.G4_CANONICAL, version: 1, gate: 'G4', description: 'Production canonical URL' },
]);

export function validateContractDefinitions(): void {
  const ids = Object.values(CONTRACT_IDS);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate contract ID');
  const definitions = CONTRACT_DEFINITIONS.map((definition) => definition.id);
  if (new Set(definitions).size !== definitions.length) throw new Error('Duplicate contract definition');
  for (const definition of CONTRACT_DEFINITIONS) {
    if (!ids.includes(definition.id as (typeof ids)[number])) throw new Error(`Unknown contract ID: ${definition.id}`);
    if (definition.version !== 1) throw new Error(`Invalid contract version: ${definition.id}`);
    if (!/^G[1-4]$/.test(definition.gate)) throw new Error(`Invalid gate: ${definition.id}`);
  }
}

validateContractDefinitions();
