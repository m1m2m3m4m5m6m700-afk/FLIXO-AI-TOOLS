#!/usr/bin/env node
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
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'diagnostics') continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path, out); else if (entry.isFile()) out.push(path);
  }
  return out;
};
const files = walk(ROOT);
const fileText = new Map(files.map((file) => [normalize(file), read(file)]));
const ci = fileText.get('.github/workflows/ci.yml') ?? '';
const runner = fileText.get('scripts/test.mjs') ?? '';
const depReporter = fileText.get('scripts/report-dependency-usage.mjs') ?? '';
const diagnose = fileText.get('scripts/ci/diagnose-run.mjs') ?? '';
const collector = fileText.get('scripts/ci/collect-failure-evidence.mjs') ?? '';
const packageJson = JSON.parse(fileText.get('package.json') ?? '{}');
function finding(id, category, severity, status, summary, evidence, repair) { return { id, category, severity, status, summary, evidence, repair }; }
const findings = [];
const mutation = /npm\s+install\s+[^\n]*--package-lock-only/i.test(depReporter);
findings.push(finding('RC-DEP-REVALIDATION-001', 'DEPENDENCY', mutation ? 'CRITICAL' : 'CLEAR', mutation ? 'DIRECT_CI_BLOCKER' : 'RESOLVED', mutation ? 'Dependency reporting can mutate package-lock.json during measurement.' : 'Dependency reporting is read-only and does not install or rewrite the lockfile.', mutation ? 'scripts/report-dependency-usage.mjs contains npm install --package-lock-only.' : 'scripts/report-dependency-usage.mjs is observational and inspects the working-tree state without installation.', 'Keep dependency reporting observational; package installation belongs only to CI bootstrap.'));
const duplicateOrchestration = /capture-execution-context|collect-failure-evidence|record-repair-cycle|detect-shared-root-candidates/.test(ci.split('Unified diagnostic runner')[0]) || /capture-execution-context|collect-failure-evidence/.test(diagnose);
findings.push(finding('RC-CI-ORCH-001', 'ORCHESTRATION', duplicateOrchestration ? 'HIGH' : 'CLEAR', duplicateOrchestration ? 'LATENT_CI_DEBT' : 'RESOLVED', duplicateOrchestration ? 'Diagnostic lifecycle remains distributed outside the unified runner.' : 'CI delegates the diagnostic lifecycle to one runner; compatibility wrappers do not own the lifecycle.', duplicateOrchestration ? 'CI or diagnose-run still invokes lifecycle helpers independently.' : 'The active CI has one Unified diagnostic runner step and test.mjs owns diagnostics orchestration.', 'Do not reintroduce lifecycle sidecars as CI gate logic.'));
const stateCoupling = /FLIXO_DEPENDENCIES_READY/.test(ci) || /FLIXO_DEPENDENCIES_READY/.test(runner) || /FLIXO_DEPENDENCIES_READY/.test(packageJson.scripts?.test ?? '');
findings.push(finding('RC-CI-DEPENDENCY-STATE-001', 'DEPENDENCY_LIFECYCLE', stateCoupling ? 'HIGH' : 'CLEAR', stateCoupling ? 'LATENT_CI_DEBT' : 'RESOLVED', stateCoupling ? 'Runner behavior depends on an external dependency-ready state flag.' : 'Dependency lifecycle has a single CI owner; runner no longer branches on FLIXO_DEPENDENCIES_READY.', stateCoupling ? 'FLIXO_DEPENDENCIES_READY is still referenced.' : 'No FLIXO_DEPENDENCIES_READY reference in the active CI/test lifecycle.', 'Keep npm ci in the workflow and keep the runner observational.'));
const ciFiles = [...fileText.entries()].filter(([path]) => path.startsWith('scripts/ci/') && /\.(mjs|json)$/.test(path)).map(([path, content]) => ({ path, content }));
const workflowText = [...fileText.entries()].filter(([path]) => path.startsWith('.github/workflows/')).map(([, content]) => content).join('\n');
const packageScriptsText = JSON.stringify(packageJson.scripts ?? {});
const referencedActive = new Set();
for (const { path } of ciFiles) { const base = path.split('/').pop(); if (workflowText.includes(base) || packageScriptsText.includes(path) || runner.includes(path) || diagnose.includes(path) || collector.includes(path)) referencedActive.add(path); }
const legacyCandidates = ciFiles.filter(({ path }) => !referencedActive.has(path)).map(({ path }) => path).sort();
findings.push(finding('RC-CI-LEGACY-SURFACE-001', 'ARCHITECTURE', legacyCandidates.length ? 'HIGH' : 'CLEAR', legacyCandidates.length ? 'LATENT_CI_DEBT' : 'RESOLVED', legacyCandidates.length ? `${legacyCandidates.length} scripts/configs under scripts/ci are not directly referenced by the active CI/package execution graph.` : 'All CI helper files are referenced by the active CI/package execution graph.', legacyCandidates.length ? legacyCandidates.join(', ') : 'No unreferenced CI helper candidate detected.', 'Classify candidates before deletion: ACTIVE / REQUIRED / SUPPORTING / LEGACY / DEAD. Do not delete on filename alone.'));
const configText = fileText.get('src/lib/i18n/config.ts') ?? '';
const loaderText = fileText.get('src/lib/i18n/loader.ts') ?? '';
const localeMatch = configText.match(/export const LOCALES\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
const configuredLocales = localeMatch ? [...localeMatch[1].matchAll(/['"]([a-z]{2})['"]/g)].map((m) => m[1]) : [];
const loaderLocales = [...loaderText.matchAll(/^\s*([a-z]{2}):\s*\(\)\s*=>/gm)].map((m) => m[1]);
const localeMismatch = configuredLocales.length !== 20 || loaderLocales.length !== 20 || configuredLocales.some((locale) => !loaderLocales.includes(locale)) || loaderLocales.some((locale) => !configuredLocales.includes(locale));
const localizationFiles = files.filter((path) => /(?:src|scripts)\/.*(?:i18n|locale|localization|seo)/i.test(normalize(path)) && /\.(?:mjs|mts|ts|tsx|json)$/.test(path));
const staleLocaleRefs = localizationFiles.flatMap((path) => { const text = read(path); return /\b(?:ms|uk)\b/.test(text) ? [normalize(path)] : []; });
findings.push(finding('RC-I18N-SOT-001', 'LOCALE_SOT', localeMismatch || staleLocaleRefs.length ? 'CRITICAL' : 'CLEAR', localeMismatch || staleLocaleRefs.length ? 'LATENT_CI_DEBT' : 'RESOLVED', localeMismatch || staleLocaleRefs.length ? 'Locale source-of-truth is not proven identical across config/loader or retired locale identifiers remain in localization surfaces.' : 'Configured locales and loader locales are identical; no retired ms/uk references remain in localization surfaces.', `configLocales=${configuredLocales.join(',') || 'UNPARSED'}; loaderLocales=${loaderLocales.join(',') || 'UNPARSED'}; retiredRefs=${staleLocaleRefs.join(',') || 'none'}`, 'Keep one canonical locale list and derive loader/metadata/SEO contracts from it.'));
const browserIndependent = /for\s*\(const\s+project\s+of\s+\['chromium',\s*'firefox',\s*'webkit'\]\)/.test(runner) && /checksExpected:\s*EXPECTED_CHECKS\[gateName\]/.test(runner) && /EXPECTED_CHECKS\.browser\s*=\s*3/.test(runner);
findings.push(finding('RC-BROWSER-INTELLIGENCE-001', 'TEST_INTELLIGENCE', browserIndependent ? 'CLEAR' : 'HIGH', browserIndependent ? 'RESOLVED' : 'LATENT_CI_DEBT', browserIndependent ? 'Chromium, Firefox and WebKit are modeled as independent browser checks.' : 'Browser engines are not independently represented in the gate report.', browserIndependent ? 'test.mjs runs one Playwright invocation per engine and expects 3 browser checks.' : 'browserGate still aggregates engines into one check.', 'Keep engine-level checks independent for precise clustering and recurrence analysis.'));
const fingerprintStable = /function\s+stableFailureSignature/.test(runner) && /createHash\('sha256'\)\.update\(\[rootCauseId, gateName, check\.label, stableFailureSignature\(check\)\]/.test(runner);
findings.push(finding('RC-CI-FINGERPRINT-001', 'FAILURE_INTELLIGENCE', fingerprintStable ? 'CLEAR' : 'HIGH', fingerprintStable ? 'RESOLVED' : 'LATENT_CI_DEBT', fingerprintStable ? 'Fingerprinting uses a normalized semantic failure signature independent of SHA and timestamps.' : 'Fingerprinting remains sensitive to unstable raw output.', fingerprintStable ? 'stableFailureSignature() and root-cause/gate/check identity feed the fingerprint; SHA is metadata only.' : 'Raw normalized output still dominates fingerprint material.', 'Continue hashing stable semantic error tokens, affected files and dependency signatures; SHA remains metadata only.'));
const evidenceAuthoritative = /const\s+expected\s*=\s*\{\s*STATIC:\s*27,\s*BUILD:\s*3,\s*BROWSER:\s*3/.test(collector) && /const\s+authoritative\s*=/.test(collector) && /allExpectedChecksExecuted/.test(collector) && /missingReports/.test(collector);
findings.push(finding('RC-CI-EVIDENCE-001', 'EVIDENCE', evidenceAuthoritative ? 'CLEAR' : 'HIGH', evidenceAuthoritative ? 'RESOLVED' : 'LATENT_CI_DEBT', evidenceAuthoritative ? 'Evidence collection validates report presence, expected checks, SHA coherence and authoritative completeness.' : 'Evidence collection can emit a bundle without proving expected gate completeness.', evidenceAuthoritative ? 'collector enforces required gates, expected check counts and authoritative=true.' : 'collector lacks a completeness contract.', 'Certification must consume the authoritative evidence bundle, not merely its existence.'));
const direct = findings.filter((item) => item.status === 'DIRECT_CI_BLOCKER');
const latent = findings.filter((item) => item.status === 'LATENT_CI_DEBT');
const nonCi = findings.filter((item) => item.status === 'NON_CI_TECHNICAL_DEBT');
const result = { schema: 'flixo-technical-debt-audit/v1', generatedAt: new Date().toISOString(), sha, classification: { directCiBlockers: direct.map((item) => item.id), latentCiDebt: latent.map((item) => item.id), nonCiTechnicalDebt: nonCi.map((item) => item.id) }, summary: { directCiBlockers: direct.length, latentCiDebt: latent.length, nonCiTechnicalDebt: nonCi.length, findings: findings.length }, findings, auditDigest: createHash('sha256').update(JSON.stringify(findings)).digest('hex') };
writeFileSync(resolve(OUT, 'technical-debt-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
const markdown = ['# Technical-Debt Audit', '', `SHA: ${sha}`, '', `DIRECT CI BLOCKERS: ${direct.length}`, `LATENT CI DEBT: ${latent.length}`, `NON-CI TECHNICAL DEBT: ${nonCi.length}`, '', ...findings.map((item) => `- ${item.id} | ${item.status} | ${item.severity} | ${item.summary}`), ''];
writeFileSync(resolve(OUT, 'technical-debt-audit.md'), `${markdown.join('\n')}\n`);
console.log(`TECHNICAL_DEBT_AUDIT_SHA=${sha}`); console.log(`DIRECT_CI_BLOCKERS=${direct.length}`); console.log(`LATENT_CI_DEBT=${latent.length}`); console.log(`NON_CI_TECHNICAL_DEBT=${nonCi.length}`); console.log(`AUDIT_DIGEST=${result.auditDigest}`);
