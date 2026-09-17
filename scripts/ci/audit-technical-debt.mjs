#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
mkdirSync(OUT, { recursive: true });

const run = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
const sha = run(['rev-parse', 'HEAD']).trim();
const tracked = run(['ls-files', '-z']).split('\0').filter(Boolean);
const read = (path) => {
  const file = resolve(ROOT, path);
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};
const grep = (pattern) => {
  try {
    return run(['grep', '-n', '-I', '-E', '-e', pattern, '--', ...tracked.filter((p) => existsSync(resolve(ROOT, p)))])
      .trim();
  } catch {
    return '';
  }
};
const stableJson = (value) => JSON.stringify(value, Object.keys(value).sort());
const fingerprintFor = (finding) => createHash('sha256').update(stableJson({
  id: finding.id,
  category: finding.category,
  severity: finding.severity,
  status: finding.status,
  target: finding.target,
  summary: finding.summary,
  evidence: finding.evidence,
  action: finding.action,
})).digest('hex').slice(0, 16).toUpperCase();
const findings = [];

const packageJson = JSON.parse(read('package.json') || '{}');
const packageScripts = JSON.stringify(packageJson.scripts ?? {});
const packageNames = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
];

const sourceFiles = tracked.filter((p) => /\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(p));
const testFiles = tracked.filter((p) => /(?:^|\/)(?:test|tests|spec|specs)[^/]*\/|(?:\.test|\.spec)\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(p));
const localeFiles = tracked.filter((p) => /(?:locale|locales|i18n|translations?)\//i.test(p) && /\.json$/.test(p));
const assetFiles = tracked.filter((p) => /(?:^|\/)(?:assets?|public|static)\//i.test(p));

const contractProtected = [
  'scripts/ci/certify.mjs',
  'scripts/ci/certify-core.mjs',
  'scripts/ci/validate-execution-graph.mjs',
  'scripts/ci/test-plan.json',
  'scripts/ci/assertion-registry.json',
];

for (const file of testFiles) {
  if (contractProtected.includes(file)) continue;
  const basename = file.split('/').pop();
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const referenced = grep(`(^|[/"' ])${escaped}$`);
  const packageReferenced = packageScripts.includes(file);
  if (!referenced && !packageReferenced) {
    findings.push({ id: 'RC-DEBT-ORPHAN-TEST-CANDIDATE', category: 'DEAD_CODE', severity: 'MEDIUM', status: 'CANDIDATE', target: file, summary: 'Tracked test file has no package-script ownership and no tracked textual consumer.', evidence: { tracked: true, packageReferenced: false, textualReferences: 0 }, action: 'REVIEW_THEN_DELETE' });
  }
}

for (const file of tracked) {
  if (!/(?:legacy|deprecated|obsolete|old)[^/]*\./i.test(file)) continue;
  if (contractProtected.includes(file)) continue;
  const basename = file.split('/').pop();
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const referenced = grep(`(^|[/"' ])${escaped}$`);
  findings.push({ id: 'RC-DEBT-LEGACY-CANDIDATE', category: 'LEGACY', severity: referenced ? 'LOW' : 'MEDIUM', status: referenced ? 'KEEP_UNTIL_MIGRATION' : 'CANDIDATE', target: file, summary: referenced ? 'Legacy-labelled file still has tracked references.' : 'Legacy-labelled file has no tracked textual consumers.', evidence: { textualReferences: referenced ? referenced.split('\n').length : 0 }, action: referenced ? 'KEEP' : 'REVIEW_THEN_DELETE' });
}

for (const dep of packageNames) {
  const escaped = dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const usage = grep(`(?:from|require\\(|import\\(|['"])${escaped}(?:['"/])`);
  if (!usage) {
    findings.push({ id: 'RC-DEBT-UNREFERENCED-DEPENDENCY-CANDIDATE', category: 'DEPENDENCY', severity: 'LOW', status: 'CANDIDATE', target: dep, summary: 'Package manifest entry has no obvious tracked source import/reference.', evidence: { sourceReferences: 0 }, action: 'REVIEW_THEN_REMOVE' });
  }
}

const seed = read('src/tools/seed/index.tsx');
if (/DEFAULT_SEED_UI\s*=/.test(seed) && /getTranslationBundle\(/.test(seed)) {
  findings.push({ id: 'RC-DEBT-I18N-FALLBACK-UNPROVEN', category: 'I18N', severity: 'LOW', status: 'UNPROVEN', target: 'src/tools/seed/index.tsx', summary: 'English fallback literals coexist with runtime locale loading; static presence is not proof of bypass.', evidence: { defaultFallbackDetected: true, runtimeBundleLoadDetected: true }, action: 'KEEP_PENDING_BEHAVIORAL_PROOF' });
}

const findingsWithFingerprints = findings.map((finding) => ({ ...finding, fingerprint: fingerprintFor(finding) }));
const result = {
  schema: 'flixo-technical-debt-audit/v4', generatedAt: new Date().toISOString(), sha,
  inventory: { trackedFiles: tracked.length, sourceFiles: sourceFiles.length, testFiles: testFiles.length, localeJsonFiles: localeFiles.length, assetFiles: assetFiles.length, packageDependencies: packageNames.length, contractProtected },
  classification: {
    directCiBlockers: findingsWithFingerprints.filter((x) => x.category === 'CI' && /HIGH|CRITICAL/.test(x.severity)).map((x) => x.id),
    latentCiDebt: findingsWithFingerprints.filter((x) => x.category === 'CI').map((x) => x.id),
    nonCiTechnicalDebt: findingsWithFingerprints.filter((x) => x.category !== 'CI').map((x) => x.id),
  },
  summary: {
    directCiBlockers: findingsWithFingerprints.filter((x) => x.category === 'CI' && /HIGH|CRITICAL/.test(x.severity)).length,
    latentCiDebt: findingsWithFingerprints.filter((x) => x.category === 'CI').length,
    nonCiTechnicalDebt: findingsWithFingerprints.filter((x) => x.category !== 'CI').length,
    findings: findingsWithFingerprints.length, deletionCandidates: findingsWithFingerprints.filter((x) => /DELETE|REMOVE/.test(x.action)).length,
    modificationCandidates: findingsWithFingerprints.filter((x) => x.action?.startsWith('MODIFY')).length, unproven: findingsWithFingerprints.filter((x) => x.status === 'UNPROVEN').length,
  }, findings: findingsWithFingerprints,
};
const digestPayload = { ...result, generatedAt: undefined };
result.auditDigest = createHash('sha256').update(JSON.stringify(digestPayload)).digest('hex');
writeFileSync(resolve(OUT, 'technical-debt-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(resolve(OUT, 'technical-debt-audit.md'), `# Technical-Debt Audit\n\nSHA: ${sha}\n\nTracked files: ${result.inventory.trackedFiles}\nSource files: ${result.inventory.sourceFiles}\nTest files: ${result.inventory.testFiles}\nLocale JSON files: ${result.inventory.localeJsonFiles}\nAsset files: ${result.inventory.assetFiles}\nDependencies: ${result.inventory.packageDependencies}\n\nDIRECT CI BLOCKERS: ${result.summary.directCiBlockers}\nLATENT CI DEBT: ${result.summary.latentCiDebt}\nNON-CI TECHNICAL DEBT: ${result.summary.nonCiTechnicalDebt}\nDELETION CANDIDATES: ${result.summary.deletionCandidates}\nUNPROVEN: ${result.summary.unproven}\n\nFinding fingerprints are deterministic for the same audited repository state.\nNo zero-debt claim is emitted without inventory-backed findings.\n`);
console.log(`TECHNICAL_DEBT_AUDIT_SHA=${sha}`);
console.log(`TRACKED_FILES=${result.inventory.trackedFiles}`);
console.log(`DIRECT_CI_BLOCKERS=${result.summary.directCiBlockers}`);
console.log(`LATENT_CI_DEBT=${result.summary.latentCiDebt}`);
console.log(`NON_CI_TECHNICAL_DEBT=${result.summary.nonCiTechnicalDebt}`);
console.log(`DELETION_CANDIDATES=${result.summary.deletionCandidates}`);
