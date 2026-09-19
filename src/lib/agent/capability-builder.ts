import { CAPABILITY_REGISTRY, getCapability, type CapabilityContract, type CapabilityParameters } from './capability-registry.ts';

export const CAPABILITY_BUILDER_VERSION = 1 as const;
export const CAPABILITY_BUILDER_STATES = ['EXISTING', 'COMPOSABLE', 'EXTENDABLE', 'MISSING'] as const;
export type CapabilityBuilderState = (typeof CAPABILITY_BUILDER_STATES)[number];
export type CandidateLifecycle = 'CONTRACT_VALIDATED' | 'TESTED' | 'SECURITY_VERIFIED' | 'AGENT_COMPATIBLE' | 'PROMOTION_PENDING';

export type CapabilityCandidate = Readonly<{
  id: string;
  requestedCapability: string;
  state: 'MISSING' | 'EXTENDABLE';
  lifecycle: CandidateLifecycle;
  contract: Readonly<{
    input: 'image/blob';
    output: 'image/blob';
    parameters: CapabilityParameters;
    verifierRequired: true;
  }>;
  reuse: readonly string[];
  extensionOf?: string;
  executor: 'REGISTRY_BOUND_CANDIDATE';
  verifier: 'INDEPENDENT_VERIFIER_REQUIRED';
  tests: readonly string[];
  documentation: readonly string[];
  productionMutationAllowed: false;
}>;

export type CapabilityGapResult = Readonly<{
  requestedCapability: string;
  state: CapabilityBuilderState;
  matchedCapabilityId?: string;
  composableWith: readonly string[];
  extendableFrom?: string;
  candidate?: CapabilityCandidate;
}>;

const COMPOSABLE_GROUPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  product_background: ['background-remover', 'image-cropper', 'image-effects', 'image-compressor'],
  quality_tune: ['image-upscaler', 'image-effects', 'image-compressor'],
  export_web: ['image-converter', 'image-compressor'],
});

const EXTENSION_HINTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  object_removal: ['object-remover'],
  background_replacement: ['background-remover'],
  inpaint: ['object-remover'],
  outpaint: ['image-cropper'],
  select: ['object-remover', 'background-remover'],
  replace: ['object-remover'],
});

function normalizeCapabilityId(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\\s+/g, '_').replace(/[^a-z0-9_:-]/g, '');
}

function findCompositions(requested: string): readonly string[] {
  const normalized = normalizeCapabilityId(requested);
  for (const [key, ids] of Object.entries(COMPOSABLE_GROUPS)) {
    if (normalized.includes(key)) return ids.filter((id) => getCapability(id)?.state === 'EXECUTABLE');
  }
  return [];
}

function findExtension(requested: string): string | undefined {
  const normalized = normalizeCapabilityId(requested);
  for (const [key, ids] of Object.entries(EXTENSION_HINTS)) {
    if (normalized.includes(key)) return ids.find((id) => getCapability(id));
  }
  return undefined;
}

function candidateFor(requestedCapability: string, state: 'MISSING' | 'EXTENDABLE', extensionOf?: string): CapabilityCandidate {
  const id = normalizeCapabilityId(requestedCapability);
  return Object.freeze({
    id: `candidate:${id}`,
    requestedCapability,
    state,
    lifecycle: 'CONTRACT_VALIDATED',
    contract: Object.freeze({
      input: 'image/blob',
      output: 'image/blob',
      parameters: Object.freeze({}),
      verifierRequired: true,
    }),
    reuse: Object.freeze(CAPABILITY_REGISTRY.filter((capability) => capability.state === 'EXECUTABLE').map((capability) => capability.id)),
    ...(extensionOf ? { extensionOf } : {}),
    executor: 'REGISTRY_BOUND_CANDIDATE',
    verifier: 'INDEPENDENT_VERIFIER_REQUIRED',
    tests: Object.freeze([
      'contract validation',
      'deterministic output integrity',
      'security and privacy boundary',
      'agent compatibility',
      'negative/failure path',
      'representative image regression',
    ]),
    documentation: Object.freeze([
      'capability contract',
      'parameter semantics',
      'verification evidence',
      'promotion decision',
    ]),
    productionMutationAllowed: false,
  });
}

export function inspectCapabilityGap(requestedCapability: string): CapabilityGapResult {
  if (!requestedCapability.trim()) throw new Error('requestedCapability is required.');
  const normalized = normalizeCapabilityId(requestedCapability);
  const exact = getCapability(normalized);
  if (exact) return Object.freeze({
    requestedCapability,
    state: 'EXISTING',
    matchedCapabilityId: exact.id,
    composableWith: Object.freeze([]),
  });

  const composableWith = findCompositions(requestedCapability);
  if (composableWith.length > 0) return Object.freeze({
    requestedCapability,
    state: 'COMPOSABLE',
    composableWith: Object.freeze([...composableWith]),
  });

  const extensionOf = findExtension(requestedCapability);
  if (extensionOf) return Object.freeze({
    requestedCapability,
    state: 'EXTENDABLE',
    matchedCapabilityId: extensionOf,
    composableWith: Object.freeze([]),
    extendableFrom: extensionOf,
    candidate: candidateFor(requestedCapability, 'EXTENDABLE', extensionOf),
  });

  return Object.freeze({
    requestedCapability,
    state: 'MISSING',
    composableWith: Object.freeze([]),
    candidate: candidateFor(requestedCapability, 'MISSING'),
  });
}

export function assertCandidateCannotPromote(candidate: CapabilityCandidate): void {
  if (candidate.productionMutationAllowed) {
    throw new Error('Capability Builder candidates cannot mutate production registry.');
  }
}
