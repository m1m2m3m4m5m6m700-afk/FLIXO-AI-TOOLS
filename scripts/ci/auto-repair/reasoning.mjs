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
  const resolved = scoutPath ?? 'diagnostics/investigation/code-scout-latest.json';
  if (!fs.existsSync(resolved)) return { fresh: false, reason: 'missing' };
  try {
    const report = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    const currentSha = execFileSync('git', ['-C', targetDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (report.scannedSha !== currentSha) return { fresh: false, reason: 'stale', scannedSha: report.scannedSha, currentSha };
    return { fresh: true, report };
  } catch {
    return { fresh: false, reason: 'malformed' };
  }
}

function evidenceLines(log, profile) {
  return log.split(/\r?\n/)
    .filter((line) => profile.patterns.some((pattern) => pattern.test(line)))
    .slice(-8)
    .map((line) => line.trim().slice(0, 500));
}

function buildHypotheses(log, features, scout, historical = []) {
  const candidates = PROFILES
    .filter((profile) => features.includes(profile.feature))
    .map((profile) => {
      const directMatches = countMatches(log, profile.patterns);
      const lines = evidenceLines(log, profile);
      const scoutFindings = scout?.fresh
        ? (scout.report.findings ?? []).filter((finding) => finding.rootCauseHypotheses?.some((item) => String(item).toLowerCase().includes(profile.id.replace('-', ' ')))).length
        : 0;
      const learned = historical.filter((item) => item.rootCause === profile.id && item.confidence >= 0.75).length;
      const score = Math.min(1, Number((
        0.24 +
        profile.specificity * 0.24 +
        Math.min(0.28, directMatches * 0.07) +
        Math.min(0.12, lines.length * 0.02) +
        Math.min(0.06, scoutFindings * 0.02) +
        Math.min(0.06, learned * 0.02)
      ).toFixed(4)));
      return {
        id: profile.id,
        feature: profile.feature,
        score,
        directMatches,
        evidenceLines: lines,
        scoutFindings,
        learnedSupport: learned,
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
  const scout = readFreshScout(targetDir, scoutPath);
  const hypotheses = buildHypotheses(text, features, scout, historical);
  const top = selectTop(hypotheses);
  const second = hypotheses.find((item) => item.id !== top.id && !item.suppressedBy);
  const separation = second ? Number((top.score - second.score).toFixed(4)) : top.score;
  const directFailureSignal = top.directMatches > 0 && top.evidenceLines.some((line) => /error|failed|failure|exception|expected|received|unsupported/i.test(line));
  const causalDominance = Boolean(second && (top.dominates.includes(second.id) || second.dominates?.includes(top.id)));
  const contradiction = Boolean(second && !causalDominance && second.score >= top.score * 0.9);
  const multiCauseAmbiguity = features.length > 1 && !causalDominance;
  const causalConfidence = top.id === 'external-tooling'
    ? 0.99
    : Number(Math.min(0.995, top.score + (directFailureSignal ? 0.12 : 0) + Math.min(0.08, Math.max(0, separation))).toFixed(3));
  const ambiguity = contradiction || multiCauseAmbiguity;
  const hardBlock = profileFor(top.id)?.hardBlock === true;
  const sourceMutationAllowed = !hardBlock && !ambiguity && directFailureSignal && causalConfidence >= 0.75;
  const decision = hardBlock
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
    sourceMutationAllowed,
    decision,
    scout: scout.fresh
      ? { fresh: true, scannedSha: scout.report.scannedSha, findings: scout.report.findings?.length ?? 0 }
      : { fresh: false, reason: scout.reason, currentSha: scout.currentSha ?? null, scannedSha: scout.scannedSha ?? null },
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
