/**
 * FLIXO Developer Capability Registry.
 *
 * This is metadata only: it never grants mutation authority. Every capability
 * remains READ_ONLY until an executor and independent verifier are wired.
 * The product Tool/Capability Registry remains the execution authority for
 * user-facing tools; this registry is the developer-tooling control surface.
 */
export type DeveloperCapabilityState = 'AVAILABLE' | 'PLANNED' | 'EXTERNAL' | 'BLOCKED';
export type DeveloperExecutionMode = 'READ_ONLY' | 'TARGETED_VERIFY' | 'MUTATING';

export type DeveloperCapability = Readonly<{
  id: string;
  family: 'code' | 'test' | 'security' | 'runtime' | 'media' | 'repair';
  state: DeveloperCapabilityState;
  executionMode: DeveloperExecutionMode;
  command?: string;
  purpose: string;
  independentVerifier: string;
  mutationRequiresCanonicalGreen: boolean;
}>;

export const DEVELOPER_CAPABILITIES: readonly DeveloperCapability[] = Object.freeze([
  { id: 'developer.code.typescript', family: 'code', state: 'AVAILABLE', executionMode: 'READ_ONLY', command: 'tsc --noEmit', purpose: 'Type and contract analysis.', independentVerifier: 'typescript-compiler', mutationRequiresCanonicalGreen: false },
  { id: 'developer.code.eslint', family: 'code', state: 'AVAILABLE', executionMode: 'READ_ONLY', command: 'eslint .', purpose: 'Static code-quality analysis.', independentVerifier: 'eslint', mutationRequiresCanonicalGreen: false },
  { id: 'developer.code.search', family: 'code', state: 'AVAILABLE', executionMode: 'READ_ONLY', command: 'rg', purpose: 'Fast repository/code-pattern discovery.', independentVerifier: 'exact-match', mutationRequiresCanonicalGreen: false },
  { id: 'developer.code.ast', family: 'code', state: 'PLANNED', executionMode: 'READ_ONLY', purpose: 'AST-level symbol and dependency analysis.', independentVerifier: 'typescript-compiler-api', mutationRequiresCanonicalGreen: false },
  { id: 'developer.test.unit', family: 'test', state: 'AVAILABLE', executionMode: 'TARGETED_VERIFY', command: 'npm run test:unit', purpose: 'Unit and contract verification.', independentVerifier: 'test-runner-exit-status', mutationRequiresCanonicalGreen: false },
  { id: 'developer.test.browser', family: 'test', state: 'AVAILABLE', executionMode: 'TARGETED_VERIFY', command: 'npm run test:e2e', purpose: 'Real-browser E2E verification.', independentVerifier: 'playwright-artifacts', mutationRequiresCanonicalGreen: false },
  { id: 'developer.test.property', family: 'test', state: 'PLANNED', executionMode: 'TARGETED_VERIFY', purpose: 'Property-based adversarial input coverage.', independentVerifier: 'held-out-properties', mutationRequiresCanonicalGreen: false },
  { id: 'developer.test.mutation', family: 'test', state: 'PLANNED', executionMode: 'TARGETED_VERIFY', purpose: 'Detect tests that pass despite behavioral mutations.', independentVerifier: 'mutation-survival-rate', mutationRequiresCanonicalGreen: false },
  { id: 'developer.security.codeql', family: 'security', state: 'EXTERNAL', executionMode: 'TARGETED_VERIFY', purpose: 'Repository security analysis through GitHub CodeQL.', independentVerifier: 'github-check-run', mutationRequiresCanonicalGreen: false },
  { id: 'developer.security.semgrep', family: 'security', state: 'PLANNED', executionMode: 'TARGETED_VERIFY', purpose: 'Rule-based source security scanning.', independentVerifier: 'semgrep-findings', mutationRequiresCanonicalGreen: false },
  { id: 'developer.security.dependencies', family: 'security', state: 'AVAILABLE', executionMode: 'TARGETED_VERIFY', command: 'npm audit', purpose: 'Dependency vulnerability inspection.', independentVerifier: 'npm-audit-report', mutationRequiresCanonicalGreen: false },
  { id: 'developer.runtime.observability', family: 'runtime', state: 'PLANNED', executionMode: 'READ_ONLY', purpose: 'Runtime traces, errors and performance evidence.', independentVerifier: 'runtime-evidence-ledger', mutationRequiresCanonicalGreen: false },
  { id: 'developer.runtime.browser-network', family: 'runtime', state: 'AVAILABLE', executionMode: 'TARGETED_VERIFY', purpose: 'Browser console/network/runtime evidence.', independentVerifier: 'playwright-trace', mutationRequiresCanonicalGreen: false },
  { id: 'developer.media.image', family: 'media', state: 'PLANNED', executionMode: 'TARGETED_VERIFY', purpose: 'High-performance local image processing.', independentVerifier: 'artifact-integrity-verifier', mutationRequiresCanonicalGreen: false },
  { id: 'developer.media.video', family: 'media', state: 'PLANNED', executionMode: 'TARGETED_VERIFY', purpose: 'Video processing and effect-engine integration.', independentVerifier: 'media-output-verifier', mutationRequiresCanonicalGreen: false },
  { id: 'developer.repair.fingerprint', family: 'repair', state: 'AVAILABLE', executionMode: 'READ_ONLY', purpose: 'Normalize failures into stable fingerprints.', independentVerifier: 'canonical-error-ledger', mutationRequiresCanonicalGreen: false },
  { id: 'developer.repair.rca', family: 'repair', state: 'AVAILABLE', executionMode: 'READ_ONLY', purpose: 'Root-cause analysis with falsification before mutation.', independentVerifier: 'counterexample-gate', mutationRequiresCanonicalGreen: false },
  { id: 'developer.repair.targeted', family: 'repair', state: 'AVAILABLE', executionMode: 'MUTATING', purpose: 'Apply the smallest repair to a proven root cause.', independentVerifier: 'targeted-regression-plus-canonical-ci', mutationRequiresCanonicalGreen: true },
  { id: 'developer.repair.exact-sha', family: 'repair', state: 'AVAILABLE', executionMode: 'READ_ONLY', purpose: 'Bind evidence to the live execution SHA.', independentVerifier: 'git-exact-sha', mutationRequiresCanonicalGreen: true },
]);

const ids = new Set(DEVELOPER_CAPABILITIES.map((c) => c.id));
if (ids.size !== DEVELOPER_CAPABILITIES.length) throw new Error('DEVELOPER_CAPABILITY_DUPLICATE_ID');

export function getDeveloperCapability(id: string): DeveloperCapability | undefined {
  return DEVELOPER_CAPABILITIES.find((capability) => capability.id === id);
}

export function assertDeveloperMutationAllowed(id: string): void {
  const capability = getDeveloperCapability(id);
  if (!capability) throw new Error(`DEVELOPER_CAPABILITY_UNKNOWN:${id}`);
  if (capability.executionMode !== 'MUTATING') throw new Error(`DEVELOPER_CAPABILITY_NOT_MUTATING:${id}`);
  if (!capability.mutationRequiresCanonicalGreen) throw new Error(`DEVELOPER_MUTATION_POLICY_MISSING:${id}`);
}
