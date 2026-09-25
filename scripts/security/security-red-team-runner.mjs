#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildFullIntelligenceBootstrap, assertFullIntelligenceBootstrap } from '../ci/full-intelligence-policy.mjs';
import { SENSITIVE_PERMISSION_ALLOWLISTS } from '../ci/control-plane-registry.mjs';

const ROOT = process.cwd();
const REGISTRY = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'docs/agents/SECURITY-RED-TEAM-BOTS.json'), 'utf8'));
const BOT_ID = String(process.argv.find(v => v.startsWith('--bot='))?.slice(6) ?? '').trim();
const EXPECTED_SHA = String(process.argv.find(v => v.startsWith('--sha='))?.slice(6) ?? '').trim();
const OUTPUT = path.resolve(ROOT, String(process.argv.find(v => v.startsWith('--output='))?.slice(9) ?? 'diagnostics/security/red-team/report.json'));

if (!REGISTRY.bots?.[BOT_ID]) throw new Error('SECURITY_RED_TEAM_BOT_NOT_REGISTERED');
if (!/^[0-9a-f]{40}$/u.test(EXPECTED_SHA)) throw new Error('SECURITY_RED_TEAM_EXACT_SHA_REQUIRED');
let fullIntelligence = buildFullIntelligenceBootstrap({ agentId: BOT_ID, role: REGISTRY.bots[BOT_ID].role, request: 'security review', exactSha: EXPECTED_SHA, taskId: `SECURITY-REDTEAM:${BOT_ID}:${EXPECTED_SHA}` });
assertFullIntelligenceBootstrap(fullIntelligence, BOT_ID);

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const actualSha = git(['rev-parse', 'HEAD']);
const branch = git(['branch', '--show-current']);
if (actualSha !== EXPECTED_SHA) throw new Error(`SECURITY_RED_TEAM_SHA_MISMATCH:${actualSha}:${EXPECTED_SHA}`);
if (branch !== '' && branch !== 'execution') throw new Error('SECURITY_RED_TEAM_EXECUTION_BRANCH_REQUIRED');

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const binaryLike = (buffer) => buffer.includes(0);
const findings = [];
const seen = new Set();

function fingerprint({ ruleId, file, line, evidence }) {
  return createHash('sha256')
    .update([BOT_ID, ruleId, file, line, evidence].join('|'), 'utf8')
    .digest('hex');
}
function addFinding({ ruleId, severity='MEDIUM', category, title, file, line, evidence, confidence=0.82, recommendation }) {
  const fp = fingerprint({ ruleId, file, line, evidence });
  if (seen.has(fp)) return;
  seen.add(fp);
  const boundedConfidence = Math.min(0.999, Math.max(0.001, Number(confidence) || 0.5));
  findings.push({
    id: `SEC-RT-${BOT_ID.replaceAll('SECURITY-REDTEAM-','RT')}-${fp.slice(0,10).toUpperCase()}`,
    fingerprint: fp,
    botId: BOT_ID,
    role: REGISTRY.bots[BOT_ID].role,
    severity,
    category,
    title,
    file,
    line,
    evidence: String(evidence).slice(0, 1200),
    confidence: boundedConfidence,
    uncertainty: Number((1 - boundedConfidence).toFixed(3)),
    confidenceLevel: boundedConfidence >= 0.9 ? 'HIGH' : boundedConfidence >= 0.7 ? 'MEDIUM' : 'LOW',
    uncertaintyLevel: boundedConfidence >= 0.9 ? 'LOW' : boundedConfidence >= 0.7 ? 'MEDIUM' : 'HIGH',
    uncertaintyBasis: 'RULE_MATCH_STRENGTH_WITH_STATIC_SCAN_ONLY',
    counterevidence: [],
    discriminatingTests: [],
    recommendation,
    exactSha: EXPECTED_SHA,
    status: 'OPEN',
    discoveredAt: new Date().toISOString()
  });
}

const workflowFile = (file) => /^(?:\.github\/workflows\/).+\.ya?ml$/u.test(file);
const sourceFile = (file) => /\.(?:[cm]?js|tsx?|jsx|vue|svelte|astro|css|html|mjs|cjs|json|yml|yaml)$/iu.test(file);
const browserSourceFile = (file) =>
  /^src\//u.test(file) &&
  sourceFile(file) &&
  !/^src\/(?:server|.*\/server)(?:\/|$)/u.test(file) &&
  !/^src\/(?:.*\/)?(?:__tests__|tests|test-fixtures)(?:\/|$)/u.test(file);

function runTestSystemAdversary() {
  const tracked = ['.github/workflows/security-red-team.yml','docs/agents/SECURITY-RED-TEAM-BOTS.json','scripts/ci/test-security-red-team-contract.mjs','scripts/ci/control-plane-registry.mjs','scripts/ci/validate-two-branch-policy.mjs','scripts/security/security-red-team-runner.mjs'];
  const temp = fs.mkdtempSync(path.join(ROOT, '.git', 'flixo-test-system-adversary-'));
  const copy = (to) => {
    for (const file of tracked) {
      const source = path.join(ROOT, file);
      const dest = path.join(to, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(source, dest);
    }
  };
  const attacks = [];
  const check = (id, mutate) => {
    const dir = fs.mkdtempSync(path.join(temp, 'mutation-'));
    copy(dir);
    mutate(dir);
    const result = spawnSync(process.execPath, [path.resolve(dir, 'scripts/ci/test-security-red-team-contract.mjs')], {
      cwd: dir, env: { ...process.env }, encoding: 'utf8'
    });
    attacks.push({ id, status: result.status === 0 ? 'ESCAPED' : 'BLOCKED', exactSha: EXPECTED_SHA, evidence: String(result.stdout || result.stderr || '').slice(0, 1200) });
    fs.rmSync(dir, { recursive: true, force: true });
  };
  check('EXACT_SHA_REQUIRED', dir => {
    const file = path.join(dir, '.github/workflows/security-red-team.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/(expected_sha:[\s\S]*?required:\s*)true/u, '$1false'));
  });
  check('PRIVILEGE_ESCALATION', dir => {
    const file = path.join(dir, '.github/workflows/security-red-team.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('permissions:\n  contents: read', 'permissions:\n  contents: read\n  actions: write'));
  });
  check('THIRD_BRANCH_POLICY', dir => {
    const file = path.join(dir, 'docs/agents/SECURITY-RED-TEAM-BOTS.json');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"thirdBranchAllowed": false', '"thirdBranchAllowed": true'));
  });
  check('MUTATION_AUTHORITY_POLICY', dir => {
    const file = path.join(dir, 'docs/agents/SECURITY-RED-TEAM-BOTS.json');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"mutationAuthority": false', '"mutationAuthority": true'));
  });
  check('CHECKOUT_CREDENTIAL_POLICY', dir => {
    const file = path.join(dir, '.github/workflows/security-red-team.yml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n\s+persist-credentials:\s+false/u, ''));
  });
  {
    const dir = fs.mkdtempSync(path.join(temp, 'branch-policy-'));
    copy(dir);
    const file = path.join(dir, 'scripts/ci/control-plane-registry.mjs');
    const fixture = [
      '',
      '// FLIXO-TWO-BRANCH-POLICY-TEST-FIXTURE-START: TEMP_WORKSPACE_ONLY',
      'execFileSync("git", ["switch", "--create", "evil"]);',
      '// FLIXO-TWO-BRANCH-POLICY-TEST-FIXTURE-END',
      ''
    ].join('\n');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8') + fixture);
    const init = spawnSync('git', ['init', '-q'], { cwd: dir, env: { ...process.env }, encoding: 'utf8' });
    if (init.status !== 0) {
      attacks.push({ id: 'BRANCH_CREATION_POLICY', status: 'ESCAPED', exactSha: EXPECTED_SHA, evidence: String(init.stderr || init.stdout || 'git init failed') });
    } else {
      spawnSync('git', ['add', '-A'], { cwd: dir, env: { ...process.env }, encoding: 'utf8' });
      const result = spawnSync(process.execPath, [path.resolve(dir, 'scripts/ci/validate-two-branch-policy.mjs')], {
        cwd: dir, env: { ...process.env }, encoding: 'utf8'
      });
      attacks.push({
        id: 'BRANCH_CREATION_POLICY',
        status: result.status === 0 ? 'ESCAPED' : 'BLOCKED',
        exactSha: EXPECTED_SHA,
        evidence: String(result.stdout || result.stderr || '').slice(0, 1200)
      });
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const wrongSha = '0'.repeat(40);
  const shaProbe = spawnSync(process.execPath, [path.resolve(ROOT, 'scripts/security/security-red-team-runner.mjs'), '--bot=SECURITY-REDTEAM-1', '--sha=' + wrongSha, '--output=/tmp/flixo-redteam-sha-negative.json'], {
    cwd: ROOT, env: { ...process.env }, encoding: 'utf8'
  });
  attacks.push({ id: 'RUNTIME_EXACT_SHA_MISMATCH', status: shaProbe.status === 0 ? 'ESCAPED' : 'BLOCKED', exactSha: EXPECTED_SHA });
  const negative = spawnSync(process.execPath, [path.resolve(ROOT, 'scripts/ci/test-negative-control-integration.mjs')], { cwd: ROOT, env: { ...process.env }, encoding: 'utf8' });
  attacks.push({ id: 'FALSE_GREEN_EVIDENCE', status: negative.status === 0 ? 'BLOCKED' : 'ESCAPED', exactSha: EXPECTED_SHA });
  const escaped = attacks.filter(item => item.status === 'ESCAPED').length;
  const report = {
    authority: 'READ_ONLY_TEST_SYSTEM_ADVERSARY',
    mutationAuthority: false,
    certificationAuthority: false,
    greenAuthority: false,
    targetSha: EXPECTED_SHA,
    attackCount: attacks.length,
    blockedAttacks: attacks.length - escaped,
    escapedAttacks: escaped,
    status: escaped === 0 ? 'PASS' : 'FAIL',
    isolation: 'TEMP_WORKSPACE_ONLY',
    attacks
  };
  fs.rmSync(temp, { recursive: true, force: true });
  return report;
}

const textCache = new Map();
for (const file of tracked) {
  let buffer;
  try { buffer = fs.readFileSync(path.join(ROOT, file)); } catch { continue; }
  if (binaryLike(buffer)) continue;
  const text = buffer.toString('utf8');
  textCache.set(file, text);
}

const lineHits = (file, regex) => {
  const text = textCache.get(file) ?? '';
  const lines = text.split(/\r?\n/u);
  const out = [];
  for (let i=0;i<lines.length;i++) {
    if (regex.test(lines[i])) out.push({line:i+1,text:lines[i].trim()});
    regex.lastIndex = 0;
  }
  return out;
};

if (BOT_ID === 'SECURITY-REDTEAM-1') {
  for (const file of tracked.filter(workflowFile)) {
    for (const hit of lineHits(file, /pull_request_target|write-all/iu)) {
      addFinding({ ruleId:'CONTROL-TRUSTED-WORKFLOW-BOUNDARY', severity:'CRITICAL', category:'WORKFLOW_TRUST', title:'High-trust GitHub Actions boundary requires adversarial review', file, line:hit.line, evidence:hit.text, confidence:0.96, recommendation:'Eliminate privileged trigger boundaries where possible; otherwise bind exact SHA, actor, ref and immutable action identities and add negative regression coverage.' });
    }
    for (const hit of lineHits(file, /uses:\s*[^\s#]+@(?:v\d+(?:\.\d+)?|main|master|latest|dev)\b/iu)) {
      addFinding({ ruleId:'CONTROL-MUTABLE-ACTION-REF', severity:'HIGH', category:'SUPPLY_CHAIN', title:'Mutable third-party GitHub Action reference', file, line:hit.line, evidence:hit.text, confidence:0.99, recommendation:'Pin security-sensitive workflow actions to immutable 40-hex commit SHAs and place the workflow inside the security-critical perimeter.' });
    }
    for (const hit of lineHits(file, /^\s*(?:actions|contents|security-events|pull-requests|issues|id-token):\s*write\s*$/iu)) {
      const permission = hit.text.trim().split(':')[0];
      const workflow = path.basename(file);
      const allowlist = new Set(SENSITIVE_PERMISSION_ALLOWLISTS[permission] ?? []);
      const explicitlyAdmitted = allowlist.has(workflow);
      if (explicitlyAdmitted) continue;
      const severity = /^(?:actions|id-token)$/iu.test(permission) ? 'HIGH' : 'MEDIUM';
      addFinding({
        ruleId:'CONTROL-PRIVILEGED-PERMISSION',
        severity,
        category:'LEAST_PRIVILEGE',
        title:`Privileged workflow permission: ${permission}`,
        file,
        line:hit.line,
        evidence:hit.text,
        confidence:0.98,
        recommendation:'Document the exact mutation need, scope the job to the smallest step, and admit only the exact workflow+permission pair through SENSITIVE_PERMISSION_ALLOWLISTS with adversarial regression.'
      });
    }
    for (const hit of lineHits(file, /run:\s*.*\$\{\{\s*(?:github\.event|inputs\.)/iu)) {
      addFinding({ ruleId:'CONTROL-INPUT-TO-SHELL', severity:'HIGH', category:'COMMAND_INJECTION', title:'Untrusted workflow expression reaches shell command text', file, line:hit.line, evidence:hit.text, confidence:0.94, recommendation:'Pass untrusted values through environment variables or validated files; never interpolate attacker-controlled expressions directly into shell syntax.' });
    }
    for (const hit of lineHits(file, /gh\s+(?:workflow\s+run|api).*\$\{\{\s*(?:github\.event|inputs\.)/iu)) {
      addFinding({ ruleId:'CONTROL-TAINTED-GH-CLI', severity:'HIGH', category:'AUTOMATION_INJECTION', title:'Untrusted workflow expression reaches GitHub CLI command', file, line:hit.line, evidence:hit.text, confidence:0.95, recommendation:'Validate and normalize inputs before CLI invocation and use explicit allowlists for workflow names, refs and parameters.' });
    }
    for (const hit of lineHits(file, /ACTIONS_ID_TOKEN_REQUEST_URL|ACTIONS_ID_TOKEN_REQUEST_TOKEN|id-token:\s*write/iu)) {
      addFinding({ ruleId:'CONTROL-OIDC-TRUST-SURFACE', severity:'MEDIUM', category:'OIDC', title:'Workflow requests or consumes GitHub OIDC identity', file, line:hit.line, evidence:hit.text, confidence:0.94, recommendation:'Bind workflow name, repository, event, ref, exact SHA and audience at the receiving service; add replay and confused-deputy tests.' });
    }
    for (const hit of lineHits(file, /secrets\.[A-Z0-9_]+.*(?:echo|printf|curl|gh\s+api)/iu)) {
      addFinding({ ruleId:'CONTROL-SECRET-FLOW', severity:'HIGH', category:'SECRET_HANDLING', title:'Secret value may flow into a command/output boundary', file, line:hit.line, evidence:hit.text.replaceAll(/\$\{\{\s*secrets\.[^}]+\s*\}\}/giu, '${{ secrets.REDACTED }}'), confidence:0.91, recommendation:'Keep secrets in dedicated env inputs, disable command echoing, avoid embedding secrets in generated comments/artifacts, and prove redaction behavior.' });
    }
  }
  const registryText = textCache.get('scripts/ci/control-plane-registry.mjs') ?? '';
  if (!registryText.includes("'security-red-team.yml'")) {
    addFinding({ ruleId:'CONTROL-REGISTRY-GOVERNANCE', severity:'HIGH', category:'GOVERNANCE', title:'Security red-team workflow is not yet admitted by the control-plane registry', file:'scripts/ci/control-plane-registry.mjs', line:1, evidence:'security-red-team.yml missing from registry allowlists', confidence:0.99, recommendation:'Register the workflow explicitly in write-capable and security-critical registries before enabling mutation-capable ledger recording.' });
  }
}

if (BOT_ID === 'SECURITY-REDTEAM-2') {
  for (const file of tracked.filter(browserSourceFile)) {
    const checks = [
      ['APP-DYNAMIC-CODE','CRITICAL','CODE_EXECUTION','Dynamic code execution primitive',/(?:\beval\s*\(|new\s+Function\s*\(|vm\.(?:runIn|runInNew|runInThisContext)\s*\()/u,0.98,'Remove or strictly isolate dynamic execution; replace with typed dispatch/allowlisted interpreters.'],
      ['APP-CHILD-PROCESS','HIGH','COMMAND_EXECUTION','Server-side child process execution boundary',/(?:from\s+['"](?:node:)?child_process['"]|require\(\s*['"](?:node:)?child_process['"]\)|\bchild_process\b|\b(?:execFileSync|execSync|spawnSync|spawn)\s*\(|(?<!\.)\bexec\s*\()/u,0.96,'Constrain command construction to fixed allowlists and validated arguments; prove no user-controlled command concatenation.'],
      ['APP-DOM-INJECTION','HIGH','DOM_XSS','Raw HTML/DOM injection sink',/(?:dangerouslySetInnerHTML|innerHTML\s*=|outerHTML\s*=|document\.write\s*\()/u,0.97,'Replace raw sinks with safe rendering or strict sanitization; prove trusted-source invariants.'],
      ['APP-POSTMESSAGE-WILDCARD','HIGH','MESSAGING','Wildcard postMessage target origin',/\.postMessage\s*\([^\n]*,\s*['"]\*['"]\s*\)/u,0.95,'Bind postMessage to an explicit trusted origin and validate message schema/type before use.'],
      ['APP-STORAGE-SECRET','HIGH','LOCAL_SECRET_STORAGE','Secret-like value persisted in browser storage',/(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\([^\n]*(?:token|secret|password|apiKey|accessToken|refreshToken)/iu,0.93,'Do not persist high-value credentials in script-readable browser storage; prefer scoped ephemeral memory and platform credential stores.'],
      ['APP-DYNAMIC-IMPORT','HIGH','CODE_LOADING','Dynamic import built from interpolated input',/import\s*\([^\n]*(?:\$\{|req\.|params\.|searchParams|location\.)/u,0.9,'Resolve module identifiers through a static allowlist instead of interpolated user input.'],
      ['APP-HTTP','MEDIUM','TRANSPORT','Hard-coded cleartext HTTP endpoint',/https?:\/\/(?!127\.0\.0\.1|localhost|example\.com|schemas\.microsoft\.com)/iu,0.9,'Use HTTPS for remote resources or document an intentional local-only exception.']
    ];
    for (const [ruleId,severity,category,title,re,confidence,recommendation] of checks) {
      for (const hit of lineHits(file,re)) addFinding({ruleId,severity,category,title,file,line:hit.line,evidence:hit.text,confidence,recommendation});
    }
  }
  for (const file of tracked.filter(file => /^(?:package\.json|package-lock\.json)$/u.test(file))) {
    for (const hit of lineHits(file, /(?:preinstall|postinstall|prepare)\s*["']?[:=]/iu)) addFinding({ruleId:'APP-INSTALL-HOOK', severity:'HIGH', category:'SUPPLY_CHAIN', title:'Package lifecycle install hook exists', file, line:hit.line, evidence:hit.text, confidence:0.95, recommendation:'Audit the hook for network/download/command execution and keep it minimal or disabled in CI where not required.'});
  }
  for (const file of tracked.filter(file => /\.(?:js|mjs|cjs|ts|tsx|jsx|json)$/iu.test(file))) {
    for (const hit of lineHits(file, /(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/u)) {
      addFinding({ruleId:'APP-HARDCODED-CREDENTIAL', severity:'CRITICAL', category:'SECRETS', title:'Credential-like token pattern present in tracked source', file, line:hit.line, evidence:'credential-like pattern redacted', confidence:0.995, recommendation:'Revoke/rotate the exposed credential immediately if real, remove it from history, and replace runtime injection with a secret manager.'});
    }
  }
}

if (BOT_ID === 'SECURITY-REDTEAM-3') {
  for (const file of tracked.filter(browserSourceFile)) {
    const fileText = textCache.get(file) ?? '';
    const trustedStaticRedirectTargets = new Set(
      [...fileText.matchAll(/\bconst\s+([A-Z][A-Z0-9_]*(?:PATH|URL))\s*=\s*['"]\/[A-Za-z0-9_./-]*['"]/gu)].map((match) => match[1]),
    );
    const checks = [
      ['RUNTIME-FETCH-TAINT','HIGH','NETWORK_BOUNDARY','Network request built from interpolated or location-derived input',/(?:fetch|axios\.(?:get|post|put|delete|request))\s*\([^\n]*(?:\$\{|location\.|searchParams|params\.|query\.)/u,0.92,'Validate destination and resource identifiers against explicit origin/path allowlists; never let raw input select arbitrary network targets.'],
      ['RUNTIME-CORS-WILDCARD','HIGH','CORS','Wildcard CORS response',/Access-Control-Allow-Origin[^\n]*\*/iu,0.98,'Avoid wildcard CORS for authenticated or sensitive routes; bind allowed origins explicitly.'],
      ['RUNTIME-CREDENTIALS-INCLUDE','MEDIUM','CREDENTIALS','Cross-origin request includes ambient credentials',/credentials\s*:\s*['"]include['"]/iu,0.96,'Require an explicit trust boundary and CSRF/CORS proof for credentialed cross-origin requests.'],
      ['RUNTIME-DOCUMENT-COOKIE','HIGH','SESSION','Script-readable document.cookie usage',/document\.cookie\b/iu,0.96,'Prefer HttpOnly/Secure/SameSite server-set cookies for secrets; avoid exposing session material to client JavaScript.'],
      ['RUNTIME-CLIENT-SECRET','CRITICAL','SECRET_BOUNDARY','Potential server secret referenced from browser source',/\bprocess\.env\.(?!VITE_)[A-Z0-9_]+/u,0.99,'Do not expose non-public env values to browser bundles; use an explicit public prefix and server-side boundary checks.'],
      ['RUNTIME-REDIRECT-TAINT','HIGH','NAVIGATION','Dynamic browser redirect/assignment',/(?:window\.location|location\.href|location\.assign|location\.replace)\s*=|location\.(?:assign|replace)\s*\(/u,0.92,'Validate destinations against trusted origins and avoid direct assignment from query/path/user-controlled values.'],
      ['RUNTIME-MESSAGE-LISTENER','MEDIUM','MESSAGING','Window message listener requires origin/schema verification',/addEventListener\s*\(\s*['"]message['"]/u,0.9,'Check event.origin and validate payload schema before acting on cross-window messages.'],
      ['RUNTIME-FILE-INPUT','MEDIUM','FILE_BOUNDARY','File/Blob processing boundary detected',/(?:input[^\n]*type\s*=\s*['"]file['"]|FileReader|arrayBuffer\(\)|URL\.createObjectURL)/iu,0.85,'Validate MIME, size, extension and parser boundaries before processing untrusted files; keep object URLs and temporary data bounded.'],
      ['RUNTIME-SVG-SINK','HIGH','SVG_BOUNDARY','SVG/HTML content reaches a raw rendering sink',/(?:SVG|svg)[^\n]*(?:innerHTML|dangerouslySetInnerHTML)|(?:innerHTML|dangerouslySetInnerHTML)[^\n]*(?:SVG|svg)/iu,0.94,'Sanitize SVG/XML content before rendering and keep external resource references disabled or allowlisted.']
    ];
    for (const [ruleId,severity,category,title,re,confidence,recommendation] of checks) {
      for (const hit of lineHits(file,re)) {
        if (ruleId === 'RUNTIME-REDIRECT-TAINT') {
          const literalPath = /(?:location\.(?:assign|replace)|window\.location)\s*(?:=|\.assign\(|\.replace\()\s*['"]\//u.test(hit.text);
          const targetName = hit.text.match(/(?:location\.(?:assign|replace)|window\.location)\s*(?:=|\.assign\(|\.replace\()\s*([A-Za-z_$][A-Za-z0-9_$]*)/u)?.[1];
          if (literalPath || (targetName && trustedStaticRedirectTargets.has(targetName))) continue;
        }
        let findingSeverity = severity;
        if (ruleId === 'RUNTIME-FETCH-TAINT') {
          const sameOriginPath = /(?:fetch|axios\.(?:get|post|put|delete|request))\s*\(\s*[`'"]\//u.test(hit.text);
          const publicViteEndpoint = /import\.meta\.env\.VITE_[A-Z0-9_]+/u.test(hit.text);
          if (sameOriginPath || publicViteEndpoint) findingSeverity = 'MEDIUM';
        }
        addFinding({ruleId,severity:findingSeverity,category,title,file,line:hit.line,evidence:hit.text,confidence,recommendation});
      }
    }
  }
  for (const file of tracked.filter(workflowFile)) {
    for (const hit of lineHits(file, /github\.event\.workflow_run\.(?:head_sha|head_branch)|github\.event\.pull_request\.(?:head_sha|head_branch)/u)) {
      addFinding({ruleId:'RUNTIME-EVENT-SHA-BOUNDARY', severity:'MEDIUM', category:'EXACT_SHA', title:'Workflow consumes event-derived branch/SHA identity', file, line:hit.line, evidence:hit.text, confidence:0.95, recommendation:'Cross-check event identity against the live target ref before any privileged action, and fail closed on movement or mismatch.'});
    }
  }
}function buildUncertaintyAssessment() {
  const confident = findings.map(f => Number(f.confidence)).filter(Number.isFinite);
  const uncertainty = findings.map(f => Number(f.uncertainty)).filter(Number.isFinite);
  const unresolvedFindings = findings.filter(f => f.uncertainty >= 0.3).map(f => ({
    findingId: f.id,
    ruleId: f.fingerprint,
    title: f.title,
    uncertainty: f.uncertainty,
    uncertaintyLevel: f.uncertaintyLevel,
    discriminatingTests: f.discriminatingTests
  }));
  if (findings.length === 0) {
    return {
      status: 'NO_FINDINGS_OBSERVED',
      confidence: null,
      uncertainty: null,
      confidenceLevel: 'UNKNOWN',
      uncertaintyLevel: 'UNKNOWN',
      method: 'STATIC_PATTERN_SCAN_ONLY',
      unresolvedQuestions: ['A clean static scan does not prove absence of vulnerabilities.'],
      discriminatingTests: ['Independent dynamic, dependency, browser, and adversarial verification remain required by canonical CI.']
    };
  }
  const minConfidence = Math.min(...confident);
  const meanConfidence = confident.reduce((sum, value) => sum + value, 0) / confident.length;
  const meanUncertainty = uncertainty.reduce((sum, value) => sum + value, 0) / uncertainty.length;
  return {
    status: unresolvedFindings.length ? 'FINDINGS_WITH_UNCERTAINTY' : 'FINDINGS_HIGH_CONFIDENCE',
    confidence: Number(meanConfidence.toFixed(3)),
    lowestFindingConfidence: Number(minConfidence.toFixed(3)),
    uncertainty: Number(meanUncertainty.toFixed(3)),
    confidenceLevel: meanConfidence >= 0.9 ? 'HIGH' : meanConfidence >= 0.7 ? 'MEDIUM' : 'LOW',
    uncertaintyLevel: meanUncertainty <= 0.1 ? 'LOW' : meanUncertainty <= 0.3 ? 'MEDIUM' : 'HIGH',
    method: 'STATIC_RULE_MATCH_STRENGTH',
    unresolvedQuestions: unresolvedFindings.map(item => item.title),
    unresolvedFindings,
    discriminatingTests: unresolvedFindings.flatMap(item => item.discriminatingTests)
  };
}

let securityTestSystemAdversary = null;
if (BOT_ID === 'SECURITY-REDTEAM-1') {
  securityTestSystemAdversary = runTestSystemAdversary();
  if (securityTestSystemAdversary.escapedAttacks > 0) {
    addFinding({ ruleId:'TEST-SYSTEM-ADVERSARY-ESCAPE', severity:'CRITICAL', category:'TEST_SYSTEM_TRUST', title:'Adversarial mutation escaped a test-system control', file:'scripts/security/security-red-team-runner.mjs', line:1, evidence:JSON.stringify(securityTestSystemAdversary), confidence:0.99, recommendation:'Open RCA immediately; an adversarial control escaped and canonical GREEN must remain unavailable.' });
  }
}

const securityLog = findings.map(f => `[${f.severity}] ${f.category} ${f.file}:${f.line} ${f.title} :: ${f.evidence}`).join('\n');
const twin = { A:null, B:null };
if (findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH')) {
  for (const variant of ['A','B']) {
    const temp = fs.mkdtempSync(path.join(ROOT, '.git', 'flixo-security-twin-'));
    const logPath = path.join(temp, 'failure.log');
    const outPath = path.join(temp, 'twin.json');
    fs.writeFileSync(logPath, securityLog || 'No findings');
    const result = spawnSync(process.execPath, [path.resolve(ROOT, 'scripts/ci/adversarial-repair-twin.mjs')], {
      cwd: ROOT,
      env: {
        ...process.env,
        FLIXO_TWIN_READ_ONLY:'true',
        FLIXO_TWIN_DETACHED:'true',
        FLIXO_TWIN_VARIANT:variant,
        FLIXO_TWIN_OUTPUT:outPath,
        FLIXO_FAILURE_LOG:logPath,
        FLIXO_EXPECTED_TARGET_SHA:EXPECTED_SHA,
        FLIXO_REPAIR_ATTEMPT:'1'
      },
      encoding:'utf8',
      maxBuffer:16*1024*1024
    });
    twin[variant] = result.status === 0 && fs.existsSync(outPath)
      ? JSON.parse(fs.readFileSync(outPath,'utf8'))
      : { status:'REPAIR_TWIN_FAILED', stderr:String(result.stderr||'').slice(-4000) };
    fs.rmSync(temp,{recursive:true,force:true});
  }
}

const report = {
  schemaVersion:1,
  protocol:REGISTRY.protocol,
  botId:BOT_ID,
  role:REGISTRY.bots[BOT_ID].role,
  authority:'READ_ONLY_SECURITY_DISCOVERY',
  mutationAuthority:false,
  certificationAuthority:false,
  branch:branch || 'detached-exact-sha',
  targetSha:EXPECTED_SHA,
  scannedFileCount:tracked.length,
  findings,
  counts:{
    critical:findings.filter(x=>x.severity==='CRITICAL').length,
    high:findings.filter(x=>x.severity==='HIGH').length,
    medium:findings.filter(x=>x.severity==='MEDIUM').length,
    low:findings.filter(x=>x.severity==='LOW').length
  },
  uncertainty:buildUncertaintyAssessment(),
  repairIntelligence:{
    provider:REGISTRY.repairIntelligence.entry,
    authority:'READ_ONLY_ADVISORY',
    twinA:twin.A ? { disposition:twin.A.challenge?.disposition ?? null, preferredStrategy:twin.A.challenge?.preferredAlternativeStrategy ?? null, preferredRepair:twin.A.challenge?.preferredAlternativeRepair ?? null, dissentStrength:twin.A.challenge?.dissentStrength ?? 0 } : null,
    twinB:twin.B ? { disposition:twin.B.challenge?.disposition ?? null, preferredStrategy:twin.B.challenge?.preferredAlternativeStrategy ?? null, preferredRepair:twin.B.challenge?.preferredAlternativeRepair ?? null, dissentStrength:twin.B.challenge?.dissentStrength ?? 0 } : null
  },
  fullIntelligence: { ...fullIntelligence, securityTestSystemAdversary },
  generatedAt:new Date().toISOString()
};

fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify(report,null,2)+'\n');
if (BOT_ID === 'SECURITY-REDTEAM-1' && Number(securityTestSystemAdversary?.escapedAttacks ?? 0) > 0) {
  console.error('TEST_SYSTEM_ADVERSARY_ESCAPED');
  process.exit(1);
}
console.log(JSON.stringify({status:'PASS',botId:BOT_ID,targetSha:EXPECTED_SHA,scannedFileCount:tracked.length,findings:findings.length,critical:report.counts.critical,high:report.counts.high,output:OUTPUT},null,2));
