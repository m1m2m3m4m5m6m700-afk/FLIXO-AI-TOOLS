import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildQuickFlowPlan } from '../src/lib/quickflow.ts';
import { planFromIntent } from '../src/lib/ai/planner.ts';
import { planWithOptionalAI, planWithProductionAI } from '../src/lib/ai/optional-planner.ts';
import { planWithProviderOrLocal } from '../src/lib/agent/llm-provider.ts';
import { TOOL_CATALOG } from '../src/config/registry.ts';
import { TOOLS_REGISTRY } from '../src/config/tools.ts';
import { fallbackDecision } from '../api/flixo-agent.ts';

const FIXTURE_INPUT = 'compress this image under 200KB and convert to WebP';
const deterministic = planFromIntent(FIXTURE_INPUT);
const fallbackWithProviderOutage = fallbackDecision(
  FIXTURE_INPUT,
  { name: 'fixture.png', type: 'image/png', size: 1024 },
  'en',
);
assert.equal(fallbackWithProviderOutage.mode, 'plan');
assert.equal(fallbackWithProviderOutage.reason, 'DETERMINISTIC_QUICKFLOW_FALLBACK');
assert.deepEqual(fallbackWithProviderOutage.plan?.steps, deterministic?.steps);
assert.equal(fallbackWithProviderOutage.plan?.catalogFingerprint, TOOL_CATALOG.fingerprint);

const fallbackWithoutFile = fallbackDecision(FIXTURE_INPUT, null, 'en');
assert.equal(fallbackWithoutFile.mode, 'clarify');
assert.equal(fallbackWithoutFile.plan, null);
assert.ok(deterministic, 'baseline deterministic QuickFlow must be available');
const baselineSteps = JSON.stringify(deterministic.steps);
const aiCandidate = {
  workflowName: 'AI refinement',
  confidence: 0.91,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  steps: deterministic.steps,
};
const sameDecision = (plan) => JSON.stringify(plan?.steps ?? null) === baselineSteps;

const disabled = await planWithOptionalAI(FIXTURE_INPUT);
assert.equal(disabled.source, 'deterministic');
assert.ok(sameDecision(disabled.plan));

const enabled = await planWithOptionalAI(FIXTURE_INPUT, async () => aiCandidate);
assert.equal(enabled.source, 'ai');
assert.ok(sameDecision(enabled.plan));

const networkMissing = await planWithOptionalAI(FIXTURE_INPUT, async () => { throw new TypeError('fetch failed'); });
assert.equal(networkMissing.source, 'deterministic');
assert.ok(sameDecision(networkMissing.plan));

const invalid = await planWithOptionalAI(FIXTURE_INPUT, async () => ({ malformed: true }));
assert.equal(invalid.source, 'deterministic');
assert.ok(sameDecision(invalid.plan));

const timeoutProvider = async (_request, signal) => await new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new Error('provider timeout')), { once: true });
});
const timeout = await planWithProviderOrLocal(timeoutProvider, FIXTURE_INPUT, { timeoutMs: 5, maxRetries: 0 });
assert.equal(timeout.source, 'local');
assert.equal(timeout.providerFailure?.code, 'TIMEOUT');
assert.ok(sameDecision(timeout.plan));

const conflictingPlan = {
  workflowName: 'Conflicting AI refinement',
  confidence: 0.99,
  catalogFingerprint: TOOL_CATALOG.fingerprint,
  steps: [{ toolId: 'image-compressor', params: { targetSizeKB: 100 } }],
};
const conflict = await planWithOptionalAI(FIXTURE_INPUT, async () => conflictingPlan);
assert.equal(conflict.source, 'deterministic');
assert.ok(sameDecision(conflict.plan));

const productionConflict = await planWithProductionAI(FIXTURE_INPUT, async () => ({
  functionCall: {
    name: 'propose_execution_plan',
    arguments: JSON.stringify(conflictingPlan),
  },
}), { timeoutMs: 1000, maxRetries: 0 });
assert.equal(productionConflict.source, 'deterministic');
assert.equal(productionConflict.providerFailure?.code, 'INVALID_PLAN');
assert.ok(sameDecision(productionConflict.plan));

const unknownDeterministic = await planWithProductionAI('do something unrelated', async () => ({
  functionCall: {
    name: 'propose_execution_plan',
    arguments: JSON.stringify({
      workflowName: 'Provider-only plan',
      confidence: 0.9,
      catalogFingerprint: TOOL_CATALOG.fingerprint,
      steps: [{ toolId: 'image-compressor', params: {} }],
    }),
  },
}), { timeoutMs: 1000, maxRetries: 0 });
assert.equal(unknownDeterministic.source, 'deterministic');
assert.equal(unknownDeterministic.plan, null);

assert.equal(JSON.stringify(planFromIntent(FIXTURE_INPUT)?.steps), baselineSteps);
assert.deepEqual(
  buildQuickFlowPlan('compress image', TOOLS_REGISTRY)?.steps.map((step) => step.toolId),
  ['image-compressor'],
);

const collectFiles = (root) => {
  const output = [];
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...collectFiles(full));
    else if (/\.(?:ts|tsx|js|mjs|json|yml|yaml|env)$/u.test(entry.name) || entry.name.startsWith('.env')) output.push(full);
  }
  return output;
};
const repoRoot = process.cwd();
const boundaryFiles = [
  ...collectFiles(path.join(repoRoot, 'src')),
  ...collectFiles(path.join(repoRoot, 'api')),
  ...collectFiles(path.join(repoRoot, 'supabase')),
  path.join(repoRoot, 'vite.config.ts'),
  path.join(repoRoot, 'vercel.json'),
  path.join(repoRoot, '.env.example'),
].filter((file) => fs.existsSync(file));

const forbiddenViteSecret = /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)(?:\s*=|\b)/iu;
for (const file of boundaryFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(
    forbiddenViteSecret.test(source),
    false,
    'secret-like VITE_* variable found in ' + path.relative(repoRoot, file),
  );
}

const apiSource = fs.readFileSync(path.join(repoRoot, 'api/flixo-agent.ts'), 'utf8');
for (const secret of ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY']) {
  assert.equal(apiSource.includes(`process.env.${secret}`), true, `server-side provider secret binding missing: ${secret}`);
}
assert.doesNotMatch(apiSource.toLocaleLowerCase(), /access-control-allow-origin|access-control-allow-credentials/u);

const clientSources = collectFiles(path.join(repoRoot, 'src')).filter((file) => /\.(?:ts|tsx)$/u.test(file));
for (const file of clientSources) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /api\.openai\.com|openrouter\.ai\/api|generativelanguage\.googleapis\.com/iu,
    'provider URL leaked to client source: ' + path.relative(repoRoot, file),
  );
}

const vercel = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
const csp = vercel.headers?.flatMap((item) => item.headers ?? [])
  .find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
assert.match(csp, /connect-src 'self'/u);
assert.match(csp, /frame-ancestors 'none'/u);
assert.doesNotMatch(csp, /api\.openai\.com|openrouter\.ai|generativelanguage\.googleapis\.com/iu);

const homeSource = fs.readFileSync(path.join(repoRoot, 'src/routes/home-page.tsx'), 'utf8');
assert.match(homeSource, /lazy\(\(\) => import\('\.\.\/components\/FlixoAIAgent'/u);
assert.match(homeSource, /const \[aiAgentOpen, setAiAgentOpen\] = useState\(false\);/u);
assert.match(homeSource, /aiAgentOpen \?/u);
assert.match(homeSource, /setAiAgentOpen\(true\)/u);
assert.doesNotMatch(homeSource, /from ['"](?:\.\.\/)+lib\/ai/u);

console.log('AI_QUICKFLOW_HARDENING=PASS');
console.log('AI_ENABLED_VALID=DETERMINISTICALLY_EQUIVALENT');
console.log('AI_DISABLED=DETERMINISTIC');
console.log('NETWORK_MISSING=DETERMINISTIC_FALLBACK');
console.log('AI_INVALID=DETERMINISTIC_FALLBACK');
console.log('AI_TIMEOUT=DETERMINISTIC_FALLBACK');
console.log('AI_CONFLICT=DETERMINISTIC_FALLBACK');
console.log('PROVIDER_SECRETS=SERVER_ONLY');
console.log('CORS=NO_CROSS_ORIGIN_ALLOW');
console.log('CSP=PROVIDER_ENDPOINTS_NOT_CLIENT_ALLOWED');
console.log('HOME_AI_CHUNK=LAZY_ROUTE_BOUNDARY');
