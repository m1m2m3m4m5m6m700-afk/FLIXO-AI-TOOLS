import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extractFeatures, normalizeFailure } from './fingerprint.mjs';

const PROFILES = Object.freeze([
  { id: 'external-tooling', feature: 'external-tooling', specificity: 1, hardBlock: true, patterns: [/SessionModelError/i, /CAPIError/i, /requested model is not supported/i, /code scanning AI findings/i] },
  { id: 'webkit-render', feature: 'webkit', specificity: 0.96, dominates: ['playwright'], patterns: [/webkit/i, /data-render-revision/i, /GPU rendering/i, /waitForGpuRender/i] },
  { id: 'lint', feature: 'lint', specificity: 0.94, patterns: [/eslint/i, /no-unused-vars/i, /defined but never used/i, /no-empty/i] },
  { id: 'format', feature: 'format', specificity: 0.9, patterns: [/prettier/i, /formatting/i, /code style/i] },
  { id: 'typescript', feature: 'typescript', specificity: 0.92, dominates: ['build'], patterns: [/TS\d+/i, /Type error/i, /typescript/i] },
  { id: 'certification', feature: 'certification', specificity: 0.9, dominates: ['playwright'], patterns: [/certification/i, /execution graph/i, /FAST.*66/i, /DEEP.*60/i] },
  { id: 'playwright', feature: 'playwright', specificity: 0.74, patterns: [/playwright/i, /expect\(/i, /locator\(/i, /page\./i] },
  { id: 'build', feature: 'build', specificity: 0.72, patterns: [/vite build/i, /production build/i, /build failed/i] },
]);

const profileFor = (id) => PROFILES.find((profile) => profile.id === id) ?? null;

function countMatches(text, patterns) {
  return patterns.reduce((sum, pattern) => {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    return sum + ((text.match(new RegExp(pattern.source, flags)) ?? []).length);
  }, 0);
}

function readFreshScout(targetDir, scoutPath) {
  const candidates = [
    scoutPath,
    process.env.FLIXO_SCOUT_REPORT,
    '/tmp/flixo-scout-report.json',
    '/tmp/flixo-investigation/code-scout-latest.json',
    'diagnostics/investigation/code-scout-latest.json',
  ].filter(Boolean).map((value) => String(value));
  const uniqueCandidates = [...new Set(candidates)];
  const existing = uniqueCandidates.find((candidate) => fs.existsSync(candidate));
  if (!existing) return { fresh: false, reason: 'missing', checkedPaths: uniqueCandidates };
  try {
    const report = JSON.parse(fs.readFileSync(existing, 'utf8'));
    const currentSha = execFileSync('git', ['-C', targetDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (report.scannedSha !== currentSha) return { fresh: false, reason: 'stale', path: existing, scannedSha: report.scannedSha, currentSha };
    return { fresh: true, path: existing, report };
  } catch {
    return { fresh: false, reason: 'malformed', path: existing };
  }
}

function locationFromLog(log) {
  const match = log.match(/(?:^|\s)([^\s:]+\.(?:ts|tsx|js|mjs|jsx)):(\d+)(?::(\d+))?/i);
  return match ? { file: match[1], line: Number(match[2]), column: match[3] ? Number(match[3]) : null } : null;
}

function readCodeContext(targetDir, location) {
  if (!location) return { available: false, reason: 'no-location' };
  const file = location.file.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!file || file.startsWith('/') || file.split('/').includes('..')) return { available: false, reason: 'unsafe-path', file: location.file };
  const root = fs.realpathSync(targetDir);
  const fullPath = fs.realpathSync.native ? (() => {
    try { return fs.realpathSync(`${root}/${file}`); } catch { return `${root}/${file}`; }
  })() : `${root}/${file}`;
  if (fullPath !== root && !fullPath.startsWith(root + '/')) return { available: false, reason: 'path-escape', file: location.file };
  if (!fs.existsSync(fullPath)) return { available: false, reason: 'file-not-found', file: location.file };
  try {
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    const start = Math.max(0, location.line - 4);
    const end = Math.min(lines.length, location.line + 3);
    return {
      available: true,
      file: location.file,
      line: location.line,
      excerpt: lines.slice(start, end).map((line, index) => ({ line: start + index + 1, text: line.slice(0, 500) })),
    };
  } catch {
    return { available: false, reason: 'read-failed', file: location.file };
  }
}

function evidenceLines(log, profile) {
  return log.split(/\r?\n/)
    .filter((line) => profile.patterns.some((pattern) => pattern.test(line)))
    .slice(-8)
    .map((line) => line.trim().slice(0, 500));
}

function buildHypotheses(log, features, scout, historical = [], codeContext = null) {
  const candidates = PROFILES
    .filter((profile) => features.includes(profile.feature))
    .map((profile) => {
      const directMatches = countMatches(log, profile.patterns);
      const lines = evidenceLines(log, profile);
      const scoutFindings = scout?.fresh
        ? (scout.report.findings ?? []).filter((finding) => finding.rootCauseHypotheses?.some((item) => String(item).toLowerCase().includes(profile.id.replace('-', ' ')))).length
        : 0;
      const learned = historical.filter((item) => item.rootCause === profile.id && item.confidence >= 0.75).length;
      const codeMatches = codeContext?.available
        ? codeContext.excerpt.filter(({ text }) => profile.patterns.some((pattern) => pattern.test(text))).length
        : 0;
      const score = Math.min(1, Number((
        0.20 +
        profile.specificity * 0.30 +
        Math.min(0.32, directMatches * 0.13) +
        Math.min(0.10, lines.length * 0.025) +
        Math.min(0.06, scoutFindings * 0.02) +
        Math.min(0.06, learned * 0.02) +
        Math.min(0.08, codeMatches * 0.02)
      ).toFixed(4)));
      return {
        id: profile.id,
        feature: profile.feature,
        score,
        directMatches,
        evidenceLines: lines,
        scoutFindings,
        learnedSupport: learned,
        codeMatches,
        specificity: profile.specificity,
        dominates: profile.dominates ?? [],
      };
    })
    .sort((a, b) => b.score - a.score);

  return candidates.map((candidate) => {
    const suppressor = candidates.find((other) => other.id !== candidate.id && other.dominates?.includes(candidate.id));
    return suppressor ? { ...candidate, suppressedBy: suppressor.id } : candidate;
  });
}

function counterfactualChecks(log, top, alternatives) {
  const checks = [];
  const text = String(log ?? '');
  if (top?.id === 'lint') checks.push({ id: 'CF-LINT-SOURCE', question: 'Would the failure remain if the reported source line were isolated?', required: true });
  if (top?.id === 'playwright' || top?.id === 'webkit-render') checks.push({ id: 'CF-BROWSER-MODE', question: 'Would the failure remain with browser/runtime-specific factors excluded?', required: true });
  if (top?.id === 'external-tooling') checks.push({ id: 'CF-EXTERNAL', question: 'Can the same failure be reproduced without the external provider?', required: true });
  if (alternatives?.length) checks.push({ id: 'CF-ALTERNATIVE-CAUSE', question: 'Does evidence distinguish the leading hypothesis from the strongest alternative?', required: true });
  return checks.map((check) => ({ ...check, status: text ? 'REQUIRED_BEFORE_NONTRIVIAL_MUTATION' : 'BLOCKED_MISSING_EVIDENCE' }));
}

function blastRadius(features = [], rootCause = 'unknown') {
  const surfaces = new Set(['source', 'targeted-regression', 'canonical-ci']);
  if (features.includes('typescript') || features.includes('build')) surfaces.add('build');
  if (features.includes('lint') || features.includes('format')) surfaces.add('static');
  if (features.includes('playwright') || features.includes('webkit')) surfaces.add('browser');
  if (features.includes('certification')) surfaces.add('certification');
  if (rootCause === 'external-tooling') surfaces.add('external-provider');
  return [...surfaces];
}

function adaptiveBudget({ attempts = 0, ambiguity = false, alternatives = 0, features = [] } = {}) {
  const complexity = (ambiguity ? 2 : 0) + Math.min(3, alternatives) + Math.min(3, features.length);
  const budget = Math.max(3, Math.min(12, 3 + attempts + complexity));
  return { budget, failClosed: attempts >= 12, reason: { attempts, ambiguity, alternatives, features: features.length } };
}

function selectTop(hypotheses) {
  const viable = hypotheses.filter((item) => !item.suppressedBy);
  return viable[0] ?? hypotheses[0] ?? {
    id: 'unknown', score: 0, directMatches: 0, evidenceLines: [], scoutFindings: 0, learnedSupport: 0, specificity: 0, dominates: [],
  };
}

export function reasonFailure(log, {
  targetDir = process.cwd(),
  scoutPath = process.env.FLIXO_SCOUT_REPORT,
  historical = [],
} = {}) {
  const text = String(log ?? '');
  const features = extractFeatures(text);
  const location = locationFromLog(text);
  const codeContext = readCodeContext(targetDir, location);
  const scout = readFreshScout(targetDir, scoutPath);
  const hypotheses = buildHypotheses(text, features, scout, historical, codeContext);
  const top = selectTop(hypotheses);
  const alternatives = hypotheses.filter((item) => item.id !== top.id);
  const second = alternatives.find((item) => !item.suppressedBy);
  const separation = second ? Number((top.score - second.score).toFixed(4)) : top.score;
  const directFailureSignal = top.directMatches > 0 && top.evidenceLines.some((line) => /error|failed|failure|exception|expected|received|unsupported|missing|incomplete/i.test(line));
  const causalDominance = alternatives.some((item) => top.dominates.includes(item.id) || item.dominates?.includes(top.id));
  const contradiction = Boolean(second && !causalDominance && second.score >= top.score * 0.9);
  const multiCauseAmbiguity = features.length > 1 && !causalDominance;
  const causalConfidence = top.id === 'external-tooling'
    ? 0.99
    : Number(Math.min(0.995, top.score + (directFailureSignal ? 0.12 : 0) + Math.min(0.08, Math.max(0, separation))).toFixed(3));
  const ambiguity = contradiction || multiCauseAmbiguity;
  const hardBlock = profileFor(top.id)?.hardBlock === true;
  const requiresVerifiedLocation = top.id === 'lint' || top.id === 'format';
  const locationVerified = !requiresVerifiedLocation || (location !== null && codeContext.available);
  const sourceMutationAllowed = !hardBlock && !ambiguity && directFailureSignal && causalConfidence >= 0.75 && locationVerified;
  const falsificationChecks = counterfactualChecks(text, top, alternatives);\n  const decision = hardBlock
    ? 'BLOCK_EXTERNAL'
    : sourceMutationAllowed
      ? 'ALLOW_BOUNDED_MUTATION'
      : 'PROPOSE_ONLY';

  return {
    schemaVersion: 1,
    rootCause: top.id,
    features,
    hypotheses,
    topHypothesis: top,
    secondHypothesis: second ?? null,
    separation,
    causalConfidence,
    diagnosisQuality: hardBlock || sourceMutationAllowed ? 'strong' : causalConfidence >= 0.5 ? 'provisional' : 'weak',
    directFailureSignal,
    ambiguity,
    sourceMutationAllowed: sourceMutationAllowed && (!falsificationChecks.some((item) => item.status === 'REQUIRED_BEFORE_NONTRIVIAL_MUTATION') || directFailureSignal),
    externalTooling: hardBlock,
    locationVerified,
    falsificationChecks,\n    blastRadius: blastRadius(features, top.id),\n    adaptiveBudget: adaptiveBudget({ attempts: Number(process.env.FLIXO_REPAIR_ATTEMPTS ?? 0), ambiguity, alternatives: alternatives.length, features }),\n    decision,
    scout: scout.fresh
      ? { fresh: true, path: scout.path ?? null, scannedSha: scout.report.scannedSha, findings: scout.report.findings?.length ?? 0 }
      : { fresh: false, reason: scout.reason, currentSha: scout.currentSha ?? null, scannedSha: scout.scannedSha ?? null },
    location,
    codeContext,
    normalizedFailure: normalizeFailure(text),
  };
}

export function verificationStrategy(features = []) {
  const commands = [];
  if (features.includes('lint')) commands.push(['npm', ['run', 'lint']]);
  if (features.includes('format')) commands.push(['npm', ['run', 'format:check']]);
  if (features.includes('typescript')) commands.push(['npm', ['run', 'typecheck']]);
  if (features.includes('playwright') || features.includes('webkit')) commands.push(['npm', ['run', 'test:browser']]);
  if (features.includes('build')) commands.push(['npm', ['run', 'test:build']]);
  if (features.includes('certification')) commands.push(['npm', ['run', 'test:static']]);
  if (!commands.some(([, args]) => args?.[1] === 'test:static')) commands.push(['npm', ['run', 'test:static']]);
  return commands;
}

export function reasoningPolicy() {
  return Object.freeze({
    principle: 'EVIDENCE_FIRST_CAUSAL_REASONING',
    mutationRule: 'ALLOW_ONLY_WITH_DIRECT_FAILURE_SIGNAL_NON_AMBIGUOUS_CAUSAL_CONFIDENCE_AND_BOUNDED_PLAN',
    externalRule: 'EXTERNAL_TOOLING_IS_NOT_A_SOURCE_FIX',
    scoutRule: 'ONLY_FRESH_EXACT_SHA_SCOUT_EVIDENCE_IS_ACTIONABLE',
    learningRule: 'HISTORICAL_SUCCESS_IS_PRIOR_SUPPORT_NOT_CAUSAL_PROOF',
  });
}
