import {
  AGENT_DEFINITIONS,
  type AgentDefinition,
  type AgentRuntimeMode,
} from './agent-profile.ts';

export type AgentDiscoveryRequest = Readonly<{
  query?: string;
  requiredLenses?: readonly string[];
  requiredSkills?: readonly string[];
  runtimeModes?: readonly AgentRuntimeMode[];
}>;

export type AgentDiscoveryCandidate = Readonly<{
  id: string;
  name: string;
  profileId: string;
  purpose: string;
  handoffDescription: string;
  runtimeMode: AgentRuntimeMode;
  lenses: readonly string[];
  skills: readonly string[];
  authority: 'ADVISORY_ONLY';
  doesNotGrantAuthority: true;
  provenance: Readonly<{
    source: 'AGENT_DEFINITIONS';
    definitionId: string;
  }>;
}>;

export type AgentDiscoveryResult = Readonly<{
  validation: 'PASS' | 'EMPTY';
  authority: 'ADVISORY_ONLY';
  candidates: readonly AgentDiscoveryCandidate[];
}>;

const normalize = (value: string): string =>
  value.trim().toLocaleLowerCase().normalize('NFKC');

const uniqueNonEmpty = (values: readonly string[] | undefined): readonly string[] =>
  Object.freeze(
    [...new Set((values ?? []).map(normalize).filter(Boolean))],
  );

function assertDefinitionSafety(definitions: readonly AgentDefinition[]): void {
  const ids = new Set<string>();
  const names = new Set<string>();

  for (const definition of definitions) {
    if (ids.has(definition.id)) {
      throw new Error(`AGENT_DISCOVERY_ID_COLLISION=${definition.id}`);
    }
    if (names.has(normalize(definition.name))) {
      throw new Error(`AGENT_DISCOVERY_NAME_COLLISION=${definition.name}`);
    }
    if (definition.profileId !== definition.id) {
      throw new Error(`AGENT_DISCOVERY_PROFILE_BINDING_INVALID=${definition.id}`);
    }
    if (definition.authorityBinding !== 'CANONICAL_CONTROL_PLANE') {
      throw new Error(`AGENT_DISCOVERY_AUTHORITY_BINDING_INVALID=${definition.id}`);
    }
    if (definition.doesNotGrantAuthority !== true) {
      throw new Error(`AGENT_DISCOVERY_IMPLICIT_AUTHORITY=${definition.id}`);
    }
    ids.add(definition.id);
    names.add(normalize(definition.name));
  }
}

export function validateAgentDiscoveryDefinitions(): void {
  assertDefinitionSafety(AGENT_DEFINITIONS);
}

function asCandidate(definition: AgentDefinition): AgentDiscoveryCandidate {
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    profileId: definition.profileId,
    purpose: definition.purpose,
    handoffDescription: definition.handoffDescription,
    runtimeMode: definition.runtimeMode,
    lenses: definition.lenses,
    skills: definition.skills,
    authority: 'ADVISORY_ONLY',
    doesNotGrantAuthority: true,
    provenance: Object.freeze({
      source: 'AGENT_DEFINITIONS',
      definitionId: definition.id,
    }),
  });
}

function matchesQuery(definition: AgentDefinition, query: string): boolean {
  if (!query) return true;
  const haystack = normalize([
    definition.id,
    definition.name,
    definition.purpose,
    definition.handoffDescription,
    ...definition.lenses,
    ...definition.skills,
  ].join(' '));
  return haystack.includes(query);
}

const containsAll = (available: readonly string[], required: readonly string[]): boolean => {
  const set = new Set(available.map(normalize));
  return required.every((value) => set.has(value));
};

export function discoverAgents(request: AgentDiscoveryRequest = {}): AgentDiscoveryResult {
  validateAgentDiscoveryDefinitions();

  const query = normalize(request.query ?? '');
  const requiredLenses = uniqueNonEmpty(request.requiredLenses);
  const requiredSkills = uniqueNonEmpty(request.requiredSkills);
  const runtimeModes = new Set(request.runtimeModes ?? []);

  const candidates = AGENT_DEFINITIONS
    .filter((definition) => matchesQuery(definition, query))
    .filter((definition) => requiredLenses.length === 0 || containsAll(definition.lenses, requiredLenses))
    .filter((definition) => requiredSkills.length === 0 || containsAll(definition.skills, requiredSkills))
    .filter((definition) => runtimeModes.size === 0 || runtimeModes.has(definition.runtimeMode))
    .map(asCandidate);

  return Object.freeze({
    validation: candidates.length > 0 ? 'PASS' : 'EMPTY',
    authority: 'ADVISORY_ONLY',
    candidates: Object.freeze(candidates),
  });
}
