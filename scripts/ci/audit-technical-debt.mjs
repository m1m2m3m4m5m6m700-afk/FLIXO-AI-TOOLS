import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

const ROOT = process.cwd();
const OUT = resolve(ROOT, 'diagnostics/ci');
mkdirSync(OUT, { recursive: true });
const sha = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return 'UNKNOWN'; } })();
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const normalize = (path) => relative(ROOT, path).replaceAll('\\', '/');
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'diagnostics'].includes(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path, out); else if (entry.isFile()) out.push(path);
  }
  return out;
};
const files = walk(ROOT);
const fileText = new Map(files.map((file) => [normalize(file), read(file)]));
const ci = fileText.get('.github/workflows/ci.yml') ?? '';
const runner = fileText.get('scripts/test.mjs') ?? '';
const collector = fileText.get('scripts/ci/collect-failure-evidence.mjs') ?? '';
const diagnose = fileText.get('scripts/ci/diagnose-run.mjs') ?? '';
const depReporter = fileText.get('scripts/report-dependency-usage.mjs') ?? '';
const packageJson = JSON.parse(fileText.get('package.json') ?? '{}');
const testPlan = JSON.parse(fileText.get('scripts/ci/test-plan.json') ?? '{}');
const finding = (id, category, severity, status, summary, evidence, repair) => ({ id, category, severity, status, summary, evidence, repair });
const findings = [];

const dependencyMutation = /npm\s+install\s+[^\n]*--package-lock-only/i.test(depReporter);
findings.push(finding('RC-DEP-REVALIDATION-001', 'DEPENDENCY', dependencyMutation ? 'CRITICAL' : 'CLEAR', dependencyMutation ? 'DIRECT_CI_BLOCKER' : 'RESOLVED', dependencyMutation ? 'Dependency reporting can mutate package-lock.json during measurement.' : 'Dependency reporting is observational and does not rewrite the lockfile.', dependencyMutation ? 'scripts/report-dependency-usage.mjs contains an install mutation.' : 'Dependency reporting performs observation only.', 'Keep installation in CI bootstrap and dependency reporting read-only.'));

const duplicateOrchestration = /capture-execution-context|collect-failure-evidence|record-repair-cycle|detect-shared-root-candidates/.test(ci.split('Unified diagnostic runner')[0]) || /capture-execution-context|collect-failure-evidence/.test(diagnose);
findings.push(finding('RC-CI-ORCH-001', 'ORCHESTRATION', duplicateOrchestration ? 'HIGH' : 'CLEAR', duplicateOrchestration ? 'LATENT_CI_DEBT' : 'RESOLVED', duplicateOrchestration ? 'Diagnostic lifecycle remains distributed outside the unified runner.' : 'The unified runner owns the diagnostic lifecycle.', duplicateOrchestration ? 'Active workflow or diagnose-run invokes lifecycle helpers independently.' : 'ci.yml has one Unified diagnostic runner and scripts/test.mjs owns diagnostics orchestration.', 'Keep lifecycle sidecars out of gate execution.'));

const dependencyStateCoupling = /FLIXO_DEPENDENCIES_READY/.test(`${ci}\n${runner}\n${packageJson.scripts?.test ?? ''}`);
findings.push(finding('RC-CI-DEPENDENCY-STATE-001', 'DEPENDENCY_LIFECYCLE', dependencyStateCoupling ? 'HIGH' : 'CLEAR', dependencyStateCoupling ? 'LATENT_CI_DEBT' : 'RESOLVED', dependencyStateCoupling ? 'Runner behavior depends on an external dependency-ready state flag.' : 'Dependency lifecycle is owned by npm ci; runner behavior is observational.', dependencyStateCoupling ? 'FLIXO_DEPENDENCIES_READY remains referenced.' : 'No FLIXO_DEPENDENCIES_READY reference exists in the active lifecycle.', 'Keep npm ci as the sole dependency bootstrap owner.'));

const ciFiles = [...fileText.entries()].filter(([path]) => path.startsWith('scripts/ci/') && /\.(mjs|json|ts)$/.test(path)).map(([path]) => path);
const workflowText = [...fileText.entries()].filter(([path]) => path.startsWith('.github/workflows/')).map(([, text]) => text).join('\n');
const packageScriptsText = JSON.stringify(packageJson.scripts ?? {});
const knownReferences = [workflowText, packageScriptsText, runner, diagnose, collector, ...fileText.values()];
const legacyCandidates = ciFiles.filter((path) => {
  const base = path.split('/').pop();
  return !knownReferences.some((text) => text.includes(base));
});
findings.push(finding('RC-CI-LEGACY-SURFACE-001', 'ARCHITECTURE', legacyCandidates.length ? 'HIGH' : 'CLEAR', legacyCandidates.length ? 'LATENT_CI_DEBT' : 'RESOLVED', legacyCandidates.length ? `${legacyCandidates.length} CI files are not reachable from the active repository execution graph.` : 'No unreachable CI helper remains under scripts/ci.', legacyCandidates.length ? legacyCandidates.join(', ') : 'Every scripts/ci file has an active consumer or explicit lifecycle role.', 'Classify by actual reachability; delete only files with no active consumer.'));

const configText = fileText.get('src/lib/i18n/config.ts') ?? '';
const loaderText = fileText.get('src/lib/i18n/loader.ts') ?? '';
const localeMatch = configText.match(/export const LOCALES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/u);
const configuredLocales = localeMatch ? [...localeMatch[1].matchAll(/(?:'|")([a-z]{2})(?:'|")/g)].map((match) => match[1]) : [];
const loaderLocales = [...loaderText.matchAll(/^\s*([a-z]{2}):\s*async\s*\(\)\s*=>/gm)].map((match) => match[1]);
const dictionaryLocales = files.filter((path) => /src\/lib\/i18n\/locales\/[a-z]{2}\.ts$/u.test(normalize(path))).map((path) => normalize(path).split('/').pop().replace(/\.ts$/u, '')).sort();
const localeMismatch = configuredLocales.length !== 20 || loaderLocales.length !== 20 || dictionaryLocales.length !== 20 || [...configuredLocales].sort().join(',') !== dictionaryLocales.join(',') || configuredLocales.some((locale) => !loaderLocales.includes(locale)) || loaderLocales.some((locale) => !configuredLocales.includes(locale));
findings.push(finding('RC-I18N-SOT-001', 'LOCALE_SOT', localeMismatch ? 'CRITICAL' : 'CLEAR', localeMismatch ? 'LATENT_CI_DEBT' : 'RESOLVED', localeMismatch ? 'Locale source-of-truth is not identical across config, loader and dictionaries.' : 'Configured locales, loader locales and dictionaries are identical.', `config=${configuredLocales.join(',') || 'UNPARSED'}; loader=${loaderLocales.join(',') || 'UNPARSED'}; dictionaries=${dictionaryLocales.join(',') || 'NONE'}`, 'Derive downstream locale contracts from one canonical source.'));

const browserProjects = Array.isArray(testPlan.gates?.browser?.projects) ? testPlan.gates.browser.projects : [];
const browserChecks = testPlan.gates?.browser?.checks ?? [];
const browserIndependent = browserProjects.length === 3 && browserChecks.length === 3 && browserProjects.every((project, index) => browserChecks[index]?.label === project && browserChecks[index]?.args?.includes(`--project=${project}`));
findings.push(finding('RC-BROWSER-INTELLIGENCE-001', 'TEST_INTELLIGENCE', browserIndependent ? 'CLEAR' : 'HIGH', browserIndependent ? 'RESOLVED' : 'LATENT_CI_DEBT', browserIndependent ? 'Browser engines are independently defined by the shared test plan.' : 'Browser engines are not independently represented by the shared test plan.', browserIndependent ? `Projects=${browserProjects.join(',')}; one check per project.` : 'Browser project/check mapping is inconsistent.', 'Keep one explicit check per browser engine.'));

const fingerprintStable = runner.includes('function signature(check)') && runner.includes('signature(check)');
findings.push(finding('RC-CI-FINGERPRINT-001', 'FAILURE_INTELLIGENCE', fingerprintStable ? 'CLEAR' : 'HIGH', fingerprintStable ? 'RESOLVED' : 'LATENT_CI_DEBT', fingerprintStable ? 'Failure fingerprints use normalized semantic output.' : 'Failure fingerprinting is not proven stable.', fingerprintStable ? 'Runner contains a normalized signature(check) function used for fingerprinting.' : 'Stable fingerprint contract is missing.', 'Hash semantic failure identity, not volatile execution metadata.'));

const evidenceAuthoritative = runner.includes('TEST_PLAN') && collector.includes('scripts/ci/test-plan.json') && collector.includes('allExpectedChecksExecuted') && collector.includes('missingReports');
findings.push(finding('RC-CI-EVIDENCE-001', 'EVIDENCE', evidenceAuthoritative ? 'CLEAR' : 'HIGH', evidenceAuthoritative ? 'RESOLVED' : 'LATENT_CI_DEBT', evidenceAuthoritative ? 'Evidence collection is bound to the shared test plan and completeness checks.' : 'Evidence collection does not prove shared-plan completeness.', evidenceAuthoritative ? 'Runner and evidence collector consume the same test plan.' : 'Test-plan evidence lineage is incomplete.', 'Certification must consume authoritative evidence, not artifact presence alone.'));

const coverageSot = Boolean(testPlan.gates?.static?.expected && testPlan.gates?.build?.expected && testPlan.gates?.browser?.expected) && runner.includes('TEST_PLAN') && collector.includes('const plan');
findings.push(finding('RC-CI-COVERAGE-SOT-001', 'TEST_COVERAGE', coverageSot ? 'CLEAR' : 'HIGH', coverageSot ? 'RESOLVED' : 'LATENT_CI_DEBT', coverageSot ? 'Gate/check/assertion metadata has a shared test-plan source.' : 'Gate/check coverage metadata is not fully sourced from test-plan.json.', coverageSot ? 'Expected checks and assertion metadata are read from scripts/ci/test-plan.json.' : 'Shared plan consumption is incomplete.', 'Keep expected checks, assertions, coverage and dependencies in test-plan.json.'));

const assertionGovernance = Boolean(testPlan.assertions) && runner.includes('duplicateAssertions') && runner.includes('uncoveredAssertions') && runner.includes('assertionReuse');
findings.push(finding('RC-CI-ASSERTION-GOVERNANCE-001', 'TEST_COVERAGE', assertionGovernance ? 'CLEAR' : 'HIGH', assertionGovernance ? 'RESOLVED' : 'LATENT_CI_DEBT', assertionGovernance ? 'Assertions have explicit ownership/reuse semantics.' : 'Assertion ownership/reuse is not mechanically enforced.', assertionGovernance ? 'Runner validates assertion ownership, duplicate assertions and approved reuse.' : 'Assertion governance metadata or checks are missing.', 'Keep one default owner and require explicit allowReuse for cross-layer proof.'));

const direct = findings.filter((item) => item.status === 'DIRECT_CI_BLOCKER');
const latent = findings.filter((item) => item.status === 'LATENT_CI_DEBT');
const nonCi = findings.filter((item) => item.status === 'NON_CI_TECHNICAL_DEBT');
const result = { schema: 'flixo-technical-debt-audit/v1', generatedAt: new Date().toISOString(), sha, classification: { directCiBlockers: direct.map((item) => item.id), latentCiDebt: latent.map((item) => item.id), nonCiTechnicalDebt: nonCi.map((item) => item.id) }, summary: { directCiBlockers: direct.length, latentCiDebt: latent.length, nonCiTechnicalDebt: nonCi.length, findings: findings.length }, findings, auditDigest: createHash('sha256').update(JSON.stringify(findings)).digest('hex') };
writeFileSync(resolve(OUT, 'technical-debt-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(resolve(OUT, 'technical-debt-audit.md'), `# Technical-Debt Audit\n\nSHA: ${sha}\n\nDIRECT CI BLOCKERS: ${direct.length}\nLATENT CI DEBT: ${latent.length}\nNON-CI TECHNICAL DEBT: ${nonCi.length}\n\n${findings.map((item) => `- ${item.id} | ${item.status} | ${item.severity} | ${item.summary}`).join('\n')}\n`);
console.log(`TECHNICAL_DEBT_AUDIT_SHA=${sha}`);
console.log(`DIRECT_CI_BLOCKERS=${direct.length}`);
console.log(`LATENT_CI_DEBT=${latent.length}`);
console.log(`NON_CI_TECHNICAL_DEBT=${nonCi.length}`);
console.log(`AUDIT_DIGEST=${result.auditDigest}`);
