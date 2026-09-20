#!/usr/bin/env node
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const fail = (code, detail = '') => { throw new Error(detail ? `${code}:${detail}` : code); };
const sha40 = /^[a-f0-9]{40}$/u;
const sha64 = /^[a-f0-9]{64}$/u;

export const ROOT_CLOSURE_PROTOCOL = Object.freeze({
  schemaVersion: 1,
  protocolId: 'FLIXO-PROJECT-ROOT-CLOSURE-v1',
  governingInvariant: 'CAUSAL_OBSERVABILITY',
  completionMode: 'FAIL_CLOSED',
  roots: Object.freeze([
    'CONTRACT_SSoT_DRIFT','EVIDENCE_PROVENANCE_CLOSURE','RECURRENCE_PREVENTION_PROOF',
    'CANONICAL_ARCHITECTURE_SYMMETRY','HISTORICAL_ERROR_CLASS_CLOSURE','EXTERNAL_PROVIDER_ROOTS',
  ]),
});

export const HISTORICAL_CLASS_CLOSURE = Object.freeze({
  'Browser/SSR': Object.freeze({
    classes: ['playwright-webkit','playwright-firefox','browser-shard','browser-timeout','browser-permission','hydration','ssr-client'],
    verification: ['test:browser','validate:playwright-surface'],
    prevention: 'Browser/SSR failures require engine/shard/readiness isolation and exact reproductions before mutation.',
  }),
  Routing: Object.freeze({
    classes: ['route-tree','route-mismatch'],
    verification: ['validate:router-registry','test:route-resolver'],
    prevention: 'Routing failures require registry-owned canonical route identity; hand-authored orphan tool routes are forbidden.',
  }),
  'Build/Dependency': Object.freeze({
    classes: ['typescript','eslint','build-chunk','artifact-integrity','package-lock','npm-install','cache-stale'],
    verification: ['typecheck','lint','test:build','validate:lock-manifest'],
    prevention: 'Build/dependency failures require exact source/package identity and a clean install/build boundary before repair.',
  }),
  'Content/Locale/SEO': Object.freeze({
    classes: ['i18n','locale-generation','seo-canonical','soft-404','sitemap'],
    verification: ['validate:i18n','validate:localization-complete','validate:seo','validate:indexing'],
    prevention: 'Content/Locale/SEO failures must resolve to canonical locale/SEO source-of-truth and cannot be repaired through ad-hoc output rewriting.',
  }),
  'GitHub API/Transport': Object.freeze({
    classes: ['graphql-comment','rest-comment','gh-cli'],
    verification: ['verify:ci-cd-trust','test:repair-supervision'],
    prevention: 'GitHub transport failures are API/command-shape failures first; source mutation is forbidden until transport evidence is falsified as the cause.',
  }),
});

export const EXTERNAL_ROOT_POLICY = Object.freeze({
  'vercel-rate-limit': Object.freeze({ class: 'external-provider', disposition: 'BLOCKED_EXTERNAL', mutationAllowed: false, action: 'WAIT_RECHECK_ESCALATE' }),
  'capi-model': Object.freeze({ class: 'external-provider', disposition: 'BLOCKED_EXTERNAL', mutationAllowed: false, action: 'WAIT_RECHECK_ESCALATE' }),
});

export function assertCanonicalContractClosure() {
  const sources = {
    canonical: read('src/config/canonical-tool-definition.ts'),
    registry: read('src/config/registry.ts'),
    loader: read('src/config/tool-platform/loader.ts'),
    catalog: read('src/config/tool-platform/catalog.ts'),
    manifest: read('src/config/tool-manifest.ts'),
    capability: read('src/lib/agent/capability-registry.ts'),
    executor: read('src/lib/workflows/executor-registry.ts'),
    pipeline: read('src/lib/workflows/pipeline-runner.ts'),
    toolsPage: read('src/routes/tools-page.tsx'),
    agentCapabilityTest: read('scripts/test-agent-capability-registry.mjs'),
  };
  const definitions = [...sources.canonical.matchAll(/\{ id: '([^']+)'/g)].map((match) => match[1]);
  if (!definitions.length) fail('CANONICAL_TOOL_DEFINITION_EMPTY');
  if (new Set(definitions).size !== definitions.length) fail('CANONICAL_TOOL_DEFINITION_DUPLICATE');

  const iconBlock = sources.toolsPage.match(/const TOOL_ICONS = \{([\s\S]*?)\} as const;/u)?.[1] ?? '';
  const iconIds = [...iconBlock.matchAll(/^\s*['"]?([a-z0-9-]+)['"]?:/gmu)].map((match) => match[1]);
  if (!iconIds.length) fail('MANUAL_CATALOG_MISSING');
  const missingIcons = definitions.filter((id) => !iconIds.includes(id));
  const orphanIcons = iconIds.filter((id) => !definitions.includes(id));
  if (missingIcons.length) fail('MANUAL_CATALOG_DRIFT', `missing=${missingIcons.join(',')}`);
  if (orphanIcons.length) fail('MANUAL_CATALOG_ORPHAN', `orphan=${orphanIcons.join(',')}`);

  for (const [label, source] of Object.entries({
    registry: sources.registry, loader: sources.loader, manifest: sources.manifest, capability: sources.capability,
  })) {
    if (!source.includes('TOOL_DEFINITIONS')) fail('CANONICAL_SOURCE_DRIFT', label);
  }
  if (!sources.catalog.includes('createToolCatalog')) fail('CATALOG_FACTORY_MISSING');
  if (!sources.loader.includes('createToolCatalog(REGISTERED_TOOL_DEFINITIONS)')) fail('LOADER_FACTORY_BINDING_MISSING');
  if (!sources.pipeline.includes('getToolExecutor') || !sources.pipeline.includes('assertToolOutputContract')) fail('EXECUTION_VERIFICATION_CHAIN_MISSING');
  if (!sources.executor.includes('assertExecutorCoverage')) fail('EXECUTOR_COVERAGE_ASSERTION_MISSING');
  if (!sources.capability.includes('Single derived capability registry')) fail('AGENT_CAPABILITY_DERIVATION_MISSING');
  if (!sources.agentCapabilityTest.includes('TOOL_DEFINITIONS') || !sources.agentCapabilityTest.includes('CAPABILITY_REGISTRY')) fail('AGENT_CONTRACT_TEST_MISSING');

  return Object.freeze({ ok: true, toolCount: definitions.length, manualCatalogCount: iconIds.length, chain: ['Registry','Resolver/Loader','Executor','Verifier','Manual Catalog','Agent'] });
}

export function assertRecurrencePrevention(memory) {
  const repeated = [];
  for (const entry of Array.isArray(memory?.cases) ? memory.cases : []) {
    const occurrences = Number(entry?.occurrences ?? entry?.outcomes?.length ?? 0);
    const attempts = Number(entry?.attempts ?? 0);
    if (occurrences <= 1 && attempts <= 1) continue;
    const rootCause = String(entry?.rootCause ?? 'unknown');
    const isExternal = rootCause === 'external-tooling' || entry?.classification === 'external';
    if (isExternal) {
      if (Number(entry?.externalBlocks ?? 0) < 1 && !(memory?.antiLessons ?? []).some((item) => item?.fingerprint === entry?.fingerprint)) {
        fail('EXTERNAL_RECURRENCE_NOT_BLOCKED', entry?.fingerprint);
      }
      continue;
    }
    const rules = new Set([...(entry?.rules ?? []), ...(entry?.doNotRepeat ?? []), ...(entry?.revertedRules ?? []), ...(entry?.preventionRules ?? [])]);
    const antiLesson = (memory?.antiLessons ?? []).some((item) => item?.fingerprint === entry?.fingerprint && Array.isArray(item?.preventionRules) && item.preventionRules.length);
    if (!rules.size && !antiLesson) repeated.push(entry?.fingerprint ?? 'unknown');
  }
  if (repeated.length) fail('RECURRENCE_WITHOUT_PREVENTION', repeated.join(','));
  return Object.freeze({ ok: true });
}

export function preventionRuleFor(rootCause, rule = null) {
  const normalized = String(rootCause ?? 'unknown').trim().replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  const suffix = rule ? ` strategy ${String(rule)}` : '';
  return `RECURRENCE-${normalized.toUpperCase()}: require new exact-SHA evidence, falsification or reproduction delta, and a non-repeated repair strategy before mutation${suffix}.`;
}

export function assertExternalProviderClosure() {
  const docs = read('docs/agents/error-teaching/integrations.md');
  for (const [root, policy] of Object.entries(EXTERNAL_ROOT_POLICY)) {
    if (policy.disposition !== 'BLOCKED_EXTERNAL') fail('EXTERNAL_ROOT_DISPOSITION_INVALID', root);
    if (policy.mutationAllowed !== false) fail('EXTERNAL_ROOT_MUTATION_MUST_BE_FALSE', root);
    if (policy.action !== 'WAIT_RECHECK_ESCALATE') fail('EXTERNAL_ROOT_ACTION_INVALID', root);
    if (!docs.includes(root)) fail('EXTERNAL_ROOT_NOT_DOCUMENTED', root);
  }
  return Object.freeze({ ok: true, roots: Object.keys(EXTERNAL_ROOT_POLICY) });
}

export function assertHistoricalClassClosure(packageJson = json('package.json')) {
  const scripts = packageJson?.scripts ?? {};
  const corpus = read('docs/agents/ERROR-TEACHING-500.md');
  for (const [family, contract] of Object.entries(HISTORICAL_CLASS_CLOSURE)) {
    for (const command of contract.verification) if (!scripts[command]) fail('HISTORICAL_CLASS_VERIFIER_MISSING', `${family}:${command}`);
    for (const className of contract.classes) if (!corpus.includes(className)) fail('HISTORICAL_CLASS_NOT_IN_500_CORPUS', `${family}:${className}`);
    if (!contract.prevention.trim()) fail('HISTORICAL_CLASS_PREVENTION_EMPTY', family);
  }
  if (!fs.existsSync('scripts/ci/action-causal-discriminator.mjs')) fail('CAUSAL_DISCRIMINATOR_MISSING');
  if (!fs.existsSync('scripts/ci/meta-causal-model.mjs')) fail('META_CAUSAL_MODEL_MISSING');
  return Object.freeze({ ok: true, families: Object.keys(HISTORICAL_CLASS_CLOSURE) });
}

function requireString(value, code) { if (typeof value !== 'string' || !value.trim()) fail(code); return value.trim(); }
function requireSha(value, code, length = 40) { if (!(length === 40 ? sha40 : sha64).test(String(value ?? ''))) fail(code); }

export function validateProvenanceClosure(record, { requireMerge = true } = {}) {
  if (!record || typeof record !== 'object') fail('PROVENANCE_RECORD_REQUIRED');
  requireString(record.assertionId, 'PROVENANCE_ASSERTION_ID_MISSING');
  requireString(record.executionUnit, 'PROVENANCE_EXECUTION_UNIT_MISSING');
  requireString(record.runId, 'PROVENANCE_RUN_ID_MISSING');
  requireString(record.jobId, 'PROVENANCE_JOB_ID_MISSING');
  requireString(record.stepId, 'PROVENANCE_STEP_ID_MISSING');
  requireSha(record.exactSha, 'PROVENANCE_EXACT_SHA_INVALID');
  requireString(record.artifactId, 'PROVENANCE_ARTIFACT_ID_MISSING');
  requireSha(record.artifactDigest, 'PROVENANCE_ARTIFACT_DIGEST_INVALID', 64);
  requireString(record.rcaId, 'PROVENANCE_RCA_ID_MISSING');
  requireString(record.certificationId, 'PROVENANCE_CERTIFICATION_ID_MISSING');
  if (requireMerge) {
    requireSha(record.mergeCommitSha, 'PROVENANCE_MERGE_SHA_INVALID');
    if (record.mergedFromSha && record.mergedFromSha !== record.exactSha) fail('PROVENANCE_MERGED_FROM_SHA_MISMATCH');
  }
  requireSha(record.chainHash, 'PROVENANCE_CHAIN_HASH_INVALID', 64);
  return Object.freeze({ ok: true, exactSha: record.exactSha, mergeCommitSha: record.mergeCommitSha ?? null });
}

export function buildProvenanceClosure(fields = {}) {
  const payload = {
    schemaVersion: 1,
    protocol: ROOT_CLOSURE_PROTOCOL.protocolId,
    assertionId: requireString(fields.assertionId, 'PROVENANCE_ASSERTION_ID_MISSING'),
    executionUnit: requireString(fields.executionUnit, 'PROVENANCE_EXECUTION_UNIT_MISSING'),
    runId: requireString(fields.runId, 'PROVENANCE_RUN_ID_MISSING'),
    jobId: requireString(fields.jobId, 'PROVENANCE_JOB_ID_MISSING'),
    stepId: requireString(fields.stepId, 'PROVENANCE_STEP_ID_MISSING'),
    exactSha: requireString(fields.exactSha, 'PROVENANCE_EXACT_SHA_MISSING'),
    artifactId: requireString(fields.artifactId, 'PROVENANCE_ARTIFACT_ID_MISSING'),
    artifactDigest: requireString(fields.artifactDigest, 'PROVENANCE_ARTIFACT_DIGEST_MISSING'),
    rcaId: requireString(fields.rcaId, 'PROVENANCE_RCA_ID_MISSING'),
    certificationId: requireString(fields.certificationId, 'PROVENANCE_CERTIFICATION_ID_MISSING'),
    mergeCommitSha: fields.mergeCommitSha ?? null,
    mergedFromSha: fields.mergedFromSha ?? null,
  };
  payload.chainHash = createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex');
  return payload;
}

export function assertCanonicalSymmetry({ mainSha = '', executionSha = '', branch = 'execution' } = {}) {
  if (branch === 'main') {
    if (!sha40.test(mainSha) || !sha40.test(executionSha)) fail('SYMMETRY_SHA_INVALID');
    if (mainSha !== executionSha) fail('SYMMETRY_CONTRACT_SHA_DIVERGENCE');
    return Object.freeze({ ok: true, mode: 'POST_MERGE_EXACT_SYMMETRY' });
  }
  return Object.freeze({ ok: false, mode: 'PRE_MERGE_PENDING', reason: 'POST_MERGE_SYMMETRY_REQUIRES_MAIN_EXECUTION_ALIGNMENT' });
}

async function run() {
  assertCanonicalContractClosure();
  assertExternalProviderClosure();
  assertRecurrencePrevention(json('diagnostics/auto-repair/memory.json'));
  assertHistoricalClassClosure();
  console.log(JSON.stringify({
    status: 'PASS',
    protocol: ROOT_CLOSURE_PROTOCOL.protocolId,
    roots: ROOT_CLOSURE_PROTOCOL.roots,
    canonicalContract: 'PASS',
    recurrencePrevention: 'PASS',
    historicalClassClosure: 'PASS',
    externalProviderRoots: 'BLOCKED_EXTERNAL',
  }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => { console.error(`FLIXO_ROOT_CLOSURE_FAIL=${String(error?.message ?? error)}`); process.exit(1); });
}
