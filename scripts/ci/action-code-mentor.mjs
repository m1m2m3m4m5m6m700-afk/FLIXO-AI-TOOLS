#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const ROOT = process.cwd();
const MENTOR_ID = 'ACTION-CODE-MENTOR';
const PROFILE_PATH = path.join(ROOT, 'diagnostics/auto-repair/action-vault/ACTION-CODE-MENTOR.json');
const OUT_DIR = path.join(ROOT, 'diagnostics/auto-repair/action-vault/code-mentor');
const PACKET_PATH = path.join(OUT_DIR, 'latest-packet.json');
const INDEX_PATH = path.join(OUT_DIR, 'repository-index.json');
const LESSONS_PATH = path.join(OUT_DIR, 'lessons.ndjson');
const FINDINGS_PATH = path.join(OUT_DIR, 'findings.ndjson');

const arg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const readJson = (file, fallback = null) => {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; } catch { return fallback; }
};
const sha256 = (value) => crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
const exactSha = (value) => /^[a-f0-9]{40}$/u.test(String(value));
const now = () => new Date().toISOString();
const dedupe = (items) => [...new Set(items)];
const safePath = (value) => {
  const absolute = path.resolve(ROOT, value);
  if (!absolute.startsWith(ROOT + path.sep) && absolute !== ROOT) throw new Error('ACTION_CODE_MENTOR_PATH_OUTSIDE_REPOSITORY');
  return absolute;
};
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

export function validateCodeMentorProfile(profile) {
  const errors = [];
  if (profile?.schemaVersion !== 2) errors.push('MENTOR_SCHEMA_INVALID');
  if (profile?.id !== MENTOR_ID) errors.push('MENTOR_ID_INVALID');
  if (profile?.parentBotId !== 'ACTION-REPAIR') errors.push('MENTOR_PARENT_INVALID');
  if (profile?.localOnly !== true) errors.push('MENTOR_NOT_LOCAL_ONLY');
  if (profile?.networkAccess !== false) errors.push('MENTOR_NETWORK_ACCESS_ENABLED');
  const authority = profile?.authority;
  const expected = {
    permanentIndependentAuthority: false,
    readOnly: true,
    canMutateSource: false,
    canMutateTests: false,
    canMutateMain: false,
    canDispatchRepair: false,
    canApproveGreen: false,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (authority?.[key] !== value) errors.push(`MENTOR_AUTHORITY_${key.toUpperCase()}_INVALID`);
  }
  if (profile?.binding?.exactShaRequired !== true) errors.push('MENTOR_EXACT_SHA_MISSING');
  if (profile?.binding?.requiredBeforeMutation !== true) errors.push('MENTOR_PREMUTATION_REQUIREMENT_MISSING');
  if (profile?.binding?.requiredDuringSelfCheck !== true) errors.push('MENTOR_SELFCHECK_REQUIREMENT_MISSING');
  if (profile?.binding?.failClosedOnUnknown !== true) errors.push('MENTOR_FAIL_CLOSED_MISSING');
  if (profile?.teachingModel?.promotionOnlyAfterCanonicalGreen !== true) errors.push('MENTOR_GREEN_PROMOTION_RULE_MISSING');
  if (JSON.stringify(profile?.teachingModel?.learners ?? []) !== JSON.stringify(['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'])) {
    errors.push('MENTOR_LEARNER_SET_INVALID');
  }
  return errors;
}

function listTrackedFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    }).split('\0').filter(Boolean).filter((file) => (
      !file.startsWith('node_modules/')
      && !file.startsWith('dist/')
      && !file.startsWith('playwright-report/')
      && !file.startsWith('test-results/')
    ));
  } catch {
    return [];
  }
}

function gitHead() {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; }
}
function addFinding(findings, finding) {
  findings.push({
    id: finding.id,
    severity: finding.severity ?? 'INFO',
    category: finding.category,
    path: finding.path ?? null,
    line: finding.line ?? null,
    rule: finding.rule,
    evidence: finding.evidence ?? null,
    recommendation: finding.recommendation ?? null,
    confidence: finding.confidence ?? 0.7,
  });
}
function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function analyzeCodeFile(file, content) {
  const findings = [];
  const summary = {
    path: file,
    kind: 'code',
    bytes: Buffer.byteLength(content),
    sha256: sha256(content),
    imports: [],
    exports: [],
    symbols: [],
    calls: [],
    diagnostics: [],
    complexity: 1,
    sourceFeatures: [],
    unresolvedImports: [],
  };
  const isTs = /\.(?:ts|tsx|mts|cts)$/u.test(file);
  if (isTs) {
    const scriptKind = /\.tsx$/u.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, scriptKind);
    const visit = (node) => {
      const line = lineOf(source, node);
      if (ts.isImportDeclaration(node)) {
        const spec = node.moduleSpecifier.text;
        summary.imports.push(spec);
        if (/^node:(?:child_process|vm|worker_threads)$/u.test(spec)) addFinding(findings, {
          id: 'CODE-SEC-CHILDPROCESS', severity: 'MEDIUM', category: 'RUNTIME_BOUNDARY', path: file, line,
          rule: 'CHILD_PROCESS_BOUNDARY', evidence: spec,
          recommendation: 'Validate argv and keep process execution structured.'
        });
      }
      if (ts.isExportDeclaration(node)) summary.exports.push(node.moduleSpecifier?.text ?? 'local-export');
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        summary.symbols.push({ type: 'function', name: node.name?.getText(source) ?? '<anonymous>', line });
      }
      if (ts.isClassDeclaration(node)) summary.symbols.push({ type: 'class', name: node.name?.text ?? '<anonymous>', line });
      if (ts.isInterfaceDeclaration(node)) summary.symbols.push({ type: 'interface', name: node.name.text, line });
      if (ts.isTypeAliasDeclaration(node)) summary.symbols.push({ type: 'type', name: node.name.text, line });
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) summary.symbols.push({
          type: 'variable', name: decl.name.getText(source), line
        });
      }
      if (ts.isCallExpression(node)) {
        const expression = node.expression.getText(source);
        summary.calls.push({ expression, line });
        const tail = expression.split('.').pop() ?? expression;
        if (/^(?:eval|Function)$/u.test(tail)) addFinding(findings, {
          id: 'CODE-SEC-EVAL', severity: 'HIGH', category: 'CODE_EXECUTION', path: file, line,
          rule: 'DYNAMIC_CODE_EXECUTION', evidence: expression,
          recommendation: 'Avoid dynamic code execution in repair/control-plane code.'
        });
        if (/^(?:exec|execSync|spawn|spawnSync|execFile|execFileSync|fork)$/u.test(tail)) addFinding(findings, {
          id: 'CODE-SEC-EXEC', severity: 'MEDIUM', category: 'PROCESS_EXECUTION', path: file, line,
          rule: 'PROCESS_EXECUTION', evidence: expression,
          recommendation: 'Use structured argv, validate inputs, and avoid shell interpolation.'
        });
        if (/^fetch$/u.test(tail)) summary.sourceFeatures.push('NETWORK_CALL');
      }
      if (
        ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node)
        || ts.isForInStatement(node) || ts.isWhileStatement(node) || ts.isDoStatement(node)
        || ts.isCatchClause(node) || ts.isConditionalExpression(node)
      ) summary.complexity += 1;
      if (ts.isBinaryExpression(node) && (
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || node.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      )) summary.complexity += 0.5;
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const diagnostic of source.parseDiagnostics) summary.diagnostics.push({
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      line: lineOf(source, diagnostic),
    });
    if (summary.diagnostics.length) addFinding(findings, {
      id: 'CODE-PARSE', severity: 'HIGH', category: 'SYNTAX', path: file,
      rule: 'TYPESCRIPT_PARSE_ERROR', evidence: summary.diagnostics[0].message,
      recommendation: 'Resolve syntax errors before proposing repair.'
    });
  }
  if (/\bany\b/u.test(content)) addFinding(findings, {
    id: 'TS-ANY', severity: 'LOW', category: 'TYPESCRIPT', path: file,
    rule: 'EXPLICIT_ANY', evidence: 'bare any token detected',
    recommendation: 'Prefer unknown plus validation or a narrow interface.'
  });
  if (/catch\s*\{\s*\}/u.test(content)) addFinding(findings, {
    id: 'CODE-CATCH', severity: 'MEDIUM', category: 'ERROR_HANDLING', path: file,
    rule: 'EMPTY_CATCH', evidence: 'empty catch block',
    recommendation: 'Preserve actionable diagnostics or document intentional ignore.'
  });
  if (/process\.env\.[A-Z0-9_]+/u.test(content)) addFinding(findings, {
    id: 'CODE-ENV', severity: 'LOW', category: 'CONFIGURATION', path: file,
    rule: 'DIRECT_ENV_ACCESS', evidence: 'process.env access',
    recommendation: 'Validate shape and allowed values at the boundary.'
  });
  if (/TODO|FIXME|HACK/u.test(content)) summary.sourceFeatures.push('TODO_OR_HACK');
  if (/console\.(log|error|warn)\(/u.test(content)) summary.sourceFeatures.push('CONSOLE_USAGE');
  return { summary, findings };
}

function analyzeWorkflow(file, content) {
  const findings = [];
  const summary = {
    path: file, kind: 'workflow', sha256: sha256(content), bytes: Buffer.byteLength(content),
    triggers: [], jobs: [], security: {}, concurrency: null, mutationHints: [],
  };
  for (const match of content.matchAll(/^\s{2,}([A-Za-z0-9_-]+):\s*$/gmu)) summary.jobs.push(match[1]);
  if (/^on:/mu.test(content)) {
    summary.triggers.push(...[...content.matchAll(/^\s+([A-Za-z0-9_-]+):/gmu)]
      .map((match) => match[1])
      .filter((value) => ['push', 'pull_request', 'workflow_dispatch', 'schedule'].includes(value)));
  }
  summary.security.permissions = /permissions:\s*/u.test(content);
  summary.concurrency = /concurrency:\s*/u.test(content);
  if (/continue-on-error\s*:\s*true/u.test(content)) addFinding(findings, {
    id: 'CI-CONTINUE', severity: 'HIGH', category: 'CI_GUARD', path: file,
    rule: 'CONTINUE_ON_ERROR', evidence: 'continue-on-error=true',
    recommendation: 'Do not hide required failures.'
  });
  if (/cancel-in-progress\s*:\s*false/u.test(content)) addFinding(findings, {
    id: 'CI-CANCEL', severity: 'LOW', category: 'CI_CONCURRENCY', path: file,
    rule: 'STALE_RUN_REVIEW', evidence: 'cancel-in-progress=false',
    recommendation: 'Confirm exact-SHA controls prevent stale certification.'
  });
  if (!summary.security.permissions) addFinding(findings, {
    id: 'CI-PERMISSIONS', severity: 'LOW', category: 'CI_SECURITY', path: file,
    rule: 'IMPLICIT_PERMISSIONS', evidence: 'no permissions block detected',
    recommendation: 'Declare explicit minimum permissions for security-sensitive workflows.'
  });
  if (/secrets\.[A-Za-z0-9_]+/u.test(content)) summary.security.usesSecrets = true;
  if (/\brun:\s*[^'"\n]*\$\{\{/u.test(content)) summary.mutationHints.push('GITHUB_EXPRESSION_IN_SHELL');
  if (/git\s+push|gh\s+api|gh\s+pr\s+(?:merge|edit)/u.test(content)) summary.mutationHints.push('REPOSITORY_MUTATION');
  return { summary, findings };
}

function analyzePackage(file, content) {
  const findings = [];
  const data = JSON.parse(content);
  const scripts = Object.keys(data.scripts ?? {});
  const scriptEdges = scripts.map((name) => ({
    name,
    invokes: [...String(data.scripts[name]).matchAll(/npm run ([A-Za-z0-9:_-]+)/g)].map((match) => match[1]),
  }));
  return {
    summary: {
      path: file, kind: 'package', sha256: sha256(content), bytes: Buffer.byteLength(content),
      scripts, dependencies: Object.keys(data.dependencies ?? {}),
      devDependencies: Object.keys(data.devDependencies ?? {}), scriptEdges,
    },
    findings,
  };
}

function analyzeFile(file) {
  const absolute = safePath(file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
  const content = fs.readFileSync(absolute, 'utf8');
  const kind = /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(file)
    ? 'workflow'
    : /^package\.json$/u.test(file)
      ? 'package'
      : /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u.test(file)
        ? 'code'
        : /\.(?:json|ya?ml|yaml)$/u.test(file)
          ? 'config' : /\.(?:md|mdx)$/u.test(file) ? 'docs' : 'other';
  if (kind === 'code') return analyzeCodeFile(file, content);
  if (kind === 'workflow') return analyzeWorkflow(file, content);
  if (kind === 'package') return analyzePackage(file, content);
  return { summary: { path: file, kind, sha256: sha256(content), bytes: Buffer.byteLength(content) }, findings: [] };
}

function runSemanticDiagnostics() {
  const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) return { enabled: false, diagnostics: [] };
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) return {
    enabled: true,
    diagnostics: [{ message: ts.flattenDiagnosticMessageText(config.error.messageText, '\n'), category: 'config' }],
  };
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath), undefined, configPath);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program).slice(0, 300).map((diagnostic) => ({
    file: diagnostic.file?.fileName ?? null,
    line: diagnostic.file ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1 : null,
    category: ts.DiagnosticCategory[diagnostic.category] ?? 'Unknown',
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
  return { enabled: true, diagnostics };
}

function buildRepositoryIndex(files, { deep = false } = {}) {
  const entries = [];
  const allFindings = [];
  for (const file of files) {
    try {
      const result = analyzeFile(file);
      if (!result) continue;
      entries.push(result.summary);
      allFindings.push(...result.findings);
    } catch (error) {
      addFinding(allFindings, {
        id: 'INDEX-READ', severity: 'HIGH', category: 'INDEX',
        path: file, rule: 'FILE_ANALYSIS_FAILED', evidence: String(error?.message ?? error),
        recommendation: 'Fail closed on unsupported or unreadable source.'
      });
    }
  }
  const imports = entries.filter((entry) => entry.kind === 'code')
    .flatMap((entry) => (entry.imports ?? []).map((target) => ({ from: entry.path, to: target })));
  const complexity = entries.filter((entry) => entry.kind === 'code').reduce((sum, entry) => sum + Number(entry.complexity ?? 1), 0);
  return {
    index: {
      schemaVersion: 3,
      protocol: 'ACTION-CODE-MENTOR-LOCAL-INDEX-V3',
      mentorId: MENTOR_ID,
      generatedAt: now(),
      localOnly: true,
      networkAccess: false,
      repository: { root: ROOT, head: gitHead() },
      counts: {
        files: entries.length,
        code: entries.filter((entry) => entry.kind === 'code').length,
        workflows: entries.filter((entry) => entry.kind === 'workflow').length,
        packages: entries.filter((entry) => entry.kind === 'package').length,
        findings: allFindings.length,
        high: allFindings.filter((finding) => finding.severity === 'HIGH').length,
        medium: allFindings.filter((finding) => finding.severity === 'MEDIUM').length,
        totalComplexity: Math.round(complexity),
      },
      files: entries,
      imports,
    },
    findings: allFindings,
    semantic: deep ? runSemanticDiagnostics() : { enabled: false, diagnostics: [] },
  };
}

function simulateRepair({ changedPaths = [], targetSha, taskId }) {
  if (!exactSha(targetSha)) throw new Error('ACTION_CODE_MENTOR_SIMULATION_EXACT_SHA_REQUIRED');
  const tests = new Set(['node scripts/ci/action-vault-agent-gate.mjs']);
  const reasons = [];
  for (const file of changedPaths) {
    if (file.startsWith('.github/workflows/')) {
      tests.add('node scripts/validate-ci-contract.mjs');
      reasons.push(`workflow:${file}`);
    }
    if (/\.(?:ts|tsx|mjs|js)$/u.test(file)) {
      tests.add('npm run typecheck');
      reasons.push(`code:${file}`);
    }
    if (file === 'package.json') {
      tests.add('npm run lint');
      reasons.push('package');
    }
    if (file.includes('action-vault')) {
      tests.add('npm run test:action-code-mentor');
      reasons.push(`vault:${file}`);
    }
  }
  return {
    protocol: 'CODE_MENTOR_SIMULATION_V2',
    taskId, targetSha, readOnly: true, mutation: null,
    predictedChecks: [...tests],
    impactReasons: reasons,
    staticGuard: {
      exactSha: exactSha(targetSha),
      noServer: true,
      noNetwork: true,
      noTestMutation: true,
      noMainMutation: true,
      canonicalGreenRequired: true,
    },
    outcome: 'SIMULATED_ONLY',
    simulatedAt: now(),
  };
}

export function buildMentorPacket({
  taskId, fingerprint, targetSha, failedRunId, sourceFiles = [],
  mode = 'TEACH', changedPaths = [], deep = mode === 'DEEP'
} = {}) {
  if (!taskId) throw new Error('ACTION_CODE_MENTOR_TASK_REQUIRED');
  if (!fingerprint) throw new Error('ACTION_CODE_MENTOR_FINGERPRINT_REQUIRED');
  if (!exactSha(targetSha)) throw new Error('ACTION_CODE_MENTOR_EXACT_SHA_REQUIRED');
  if (!failedRunId) throw new Error('ACTION_CODE_MENTOR_RUN_ID_REQUIRED');
  const profile = readJson(PROFILE_PATH, null);
  const profileErrors = validateCodeMentorProfile(profile);
  if (profileErrors.length) throw new Error(`ACTION_CODE_MENTOR_PROFILE_INVALID=${profileErrors.join(',')}`);

  const repairMemory = readJson(path.join(ROOT, 'diagnostics/auto-repair/memory.json'), { antiLessons: [] });
  const repairProfile = readJson(path.join(ROOT, 'diagnostics/auto-repair/action-repair-bots/ACTION-REPAIR.json'), { valuableKnowledge: {} });
  const normalizedPaths = dedupe((sourceFiles.length ? sourceFiles : listTrackedFiles()).filter(Boolean));
  const { index, findings, semantic } = buildRepositoryIndex(normalizedPaths, { deep });
  const historicalLessons = [
    ...(repairProfile.valuableKnowledge?.provenRules ?? []).map((rule) => ({ source: 'ACTION-REPAIR', rule, kind: 'PROVEN_RULE' })),
    ...(repairProfile.valuableKnowledge?.antiLessons ?? []).map((rule) => ({ source: 'ACTION-REPAIR', rule, kind: 'ANTI_LESSON' })),
    ...(repairMemory.antiLessons ?? []).slice(-100).map((rule) => ({ source: 'REPAIR_MEMORY', rule: typeof rule === 'string' ? rule : JSON.stringify(rule), kind: 'ANTI_LESSON' })),
  ];
  const simulation = simulateRepair({ changedPaths, targetSha, taskId });
  return {
    schemaVersion: 3,
    protocol: 'CODE_MENTOR_PACKET_V3',
    mentorId: MENTOR_ID,
    parentBotId: 'ACTION-REPAIR',
    mode,
    localOnly: true,
    networkAccess: false,
    identity: { taskId, fingerprint, targetSha, failedRunId },
    readOnly: true,
    repositoryIndex: index,
    semanticDiagnostics: semantic,
    codeFindings: findings.slice(0, 1000),
    historicalLessons: historicalLessons.slice(-200),
    simulation,
    curriculum: {
      codeReading: true,
      astReasoning: true,
      typeDiagnostics: deep,
      dependencyGraph: true,
      workflowReasoning: true,
      repairSimulation: true,
      adversarialReviewSupport: true,
      lessonExtraction: true,
    },
    teachingRules: [
      'Teach evidence-backed programming principles, never authority.',
      'Prefer AST facts over heuristic guesses.',
      'Use semantic diagnostics in DEEP mode when available.',
      'Prefer minimal source changes and targeted regression coverage.',
      'Bind every recommendation to exact target SHA.',
      'Never use mentor output as proof of GREEN.',
      'Fail closed on unknowns and analysis failures.',
    ],
    learners: ['ACTION-REPAIR', 'ACTION-REPAIR-2', 'ACTION-HISTORIAN-3'],
    nextAction: 'ACTION-REPAIR_REVIEWS_CODE_MENTOR_PACKET',
    generatedAt: now(),
  };
}

export function promoteVerifiedMentorPacket(packet, greenRecord) {
  if (!packet?.readOnly || packet?.mentorId !== MENTOR_ID) throw new Error('ACTION_CODE_MENTOR_PACKET_INVALID');
  if (!greenRecord || greenRecord.source !== 'DAILY_FLIXO_GREEN_GATE' || greenRecord.conclusion !== 'success' || greenRecord.zeroRed !== true || greenRecord.exactShaVerified !== true) throw new Error('ACTION_CODE_MENTOR_GREEN_PROOF_REQUIRED');
  if (greenRecord.targetSha !== packet.identity.targetSha || greenRecord.taskId !== packet.identity.taskId || greenRecord.fingerprint !== packet.identity.fingerprint) throw new Error('ACTION_CODE_MENTOR_GREEN_IDENTITY_MISMATCH');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.appendFileSync(LESSONS_PATH, `${JSON.stringify({
    protocol: 'CODE_MENTOR_VERIFIED_LESSON_V3',
    promotedAt: now(),
    identity: packet.identity,
    semanticDiagnostics: packet.semanticDiagnostics,
    findings: packet.codeFindings,
    simulation: packet.simulation,
    curriculum: packet.curriculum,
    greenRecordId: greenRecord.recordId ?? null
  })}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const taskId = arg('task');
  const fingerprint = arg('fingerprint');
  const targetSha = arg('sha');
  const failedRunId = arg('run-id');
  const mode = arg('mode', 'FAST');
  const pathsArg = arg('paths');
  const sourceFiles = pathsArg ? pathsArg.split(',').map((item) => item.trim()).filter(Boolean) : listTrackedFiles();
  const changedPaths = arg('changed-paths').split(',').map((item) => item.trim()).filter(Boolean);
  const packet = buildMentorPacket({ taskId, fingerprint, targetSha, failedRunId, sourceFiles, mode, changedPaths, deep: mode === 'DEEP' });
  writeJson(PACKET_PATH, packet);
  writeJson(INDEX_PATH, packet.repositoryIndex);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(FINDINGS_PATH, packet.codeFindings.map((finding) => `${JSON.stringify(finding)}\n`).join(''));
  console.log(JSON.stringify({
    status: 'PASS',
    protocol: packet.protocol,
    mentorId: MENTOR_ID,
    localOnly: true,
    networkAccess: false,
    mode,
    filesIndexed: packet.repositoryIndex.counts.files,
    findings: packet.codeFindings.length,
    semanticDiagnostics: packet.semanticDiagnostics.diagnostics.length,
    predictedChecks: packet.simulation.predictedChecks,
    output: PACKET_PATH,
  }, null, 2));
}
