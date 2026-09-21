import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fingerprintFailure, extractFeatures, loadMemory, writeMemory, findCase } from './auto-repair-learning.mjs';
import { HISTORICAL_REPAIR_WORKFLOWS } from './control-plane-registry.mjs';

export const MAX_HISTORY_LIMIT = 1000;
const limit = Math.min(MAX_HISTORY_LIMIT, Math.max(1, Number(process.env.FLIXO_HISTORY_LIMIT ?? 100)));
const includeSuccess = process.env.FLIXO_HISTORY_INCLUDE_SUCCESS !== 'false';
const workflows = (process.env.FLIXO_HISTORY_WORKFLOWS ?? HISTORICAL_REPAIR_WORKFLOWS.join(',')).split(',').map((x) => x.trim()).filter(Boolean);
const memory = loadMemory();
const report = { schemaVersion: 2, generatedAt: new Date().toISOString(), limit, includeSuccess, workflows, runsScanned: 0, failuresImported: 0, successesImported: 0, actionObservationsImported: 0, repairsRead: 0, similarCases: 0 };

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function classify(log) {
  const patterns = [
    ['external-tooling', /SessionModelError|CAPIError|requested model is not supported|rate limit|quota|deployment provider/i],
    ['lint', /eslint|no-unused-vars|defined but never used|no-empty/i],
    ['format', /prettier|formatting|code style/i],
    ['typescript', /TS\d+|Type error|typescript/i],
    ['webkit-render', /(?:\\bwebkit\\b|data-render-revision|waitForGpuRender)[^\\r\\n]{0,220}(?:failed|failure|error|timeout|mismatch|missing|did not advance)/i,],
    ['certification', /certification|execution graph|certification-engine/i],
    ['playwright', /playwright|expect\\(|page\\.|locator\\(|timeout.*expect/i],
    ['build', /production build|vite build|build failed/i],
  ];
  const matches = patterns.filter(([, p]) => p.test(log)).map(([id]) => id);
  const priority = ['external-tooling', 'lint', 'format', 'typescript', 'webkit-render', 'certification', 'playwright', 'build'];
  return priority.find((id) => matches.includes(id)) ?? 'unknown';
}

function normalizeActionLog(log) {
  return String(log ?? '')
    .replace(new RegExp(String.fromCharCode(27) + '\\[[0-?]*[ -/]*[@-~]', 'g'), '')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<TS>')
    .replace(/\b\d{10,}\b/g, '<ID>')
    .replace(/\b[a-f0-9]{40}\b/gi, '<SHA>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12000);
}

function actionFingerprint(log, run) {
  const seed = String(run.name ?? '') + '|' + String(run.conclusion ?? '') + '|' + normalizeActionLog(log);
  return crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
}

function positiveRules(log) {
  const rules = [];
  if (/Static \+ Build[\s\S]{0,2500}?(?:PASS|success|completed)/i.test(log)) rules.push('static-build-green');
  if (/Browser FAST[\s\S]{0,2500}?(?:PASS|success|completed)/i.test(log)) rules.push('browser-fast-green');
  if (/Browser DEEP[\s\S]{0,2500}?(?:PASS|success|completed)/i.test(log)) rules.push('browser-deep-green');
  if (/(?:Certification|certify)[\s\S]{0,2500}?(?:PASS|success|GREEN|completed)/i.test(log)) rules.push('canonical-certification-green');
  if (/exact[- ]SHA|immutable artifact|provenance/i.test(log)) rules.push('exact-sha-provenance-preserved');
  if (/repair.*verified|verified-repair/i.test(log)) rules.push('verified-repair-observed');
  return [...new Set(rules)];
}

function addActionObservation(log, run) {
  if (!log.trim()) return false;
  const fingerprint = actionFingerprint(log, run);
  const normalized = normalizeActionLog(log);
  const features = extractFeatures(log);
  const rootCause = classify(log);
  const external = /CAPIError|SessionModelError|requested model is not supported|api-deployments-free-per-day|rate limit|quota|deployment provider/i.test(log);
  const seenAt = run.updatedAt ?? new Date().toISOString();
  const rules = run.conclusion === 'success' ? positiveRules(log) : ['canonical-red-evidence'];
  const collection = memory.actionHistory ?? (memory.actionHistory = []);
  let entry = collection.find((item) => item.fingerprint === fingerprint);
  if (!entry) {
    entry = {
      fingerprint, outcome: run.conclusion, rootCause, features: [], rules: [], workflows: [],
      successes: 0, failures: 0, occurrences: 0, firstSeenAt: seenAt, lastSeenAt: seenAt,
      evidence: [], classification: external ? 'external' : 'internal',
    };
    collection.push(entry);
  }
  entry.rootCause = rootCause;
  entry.features = [...new Set([...(entry.features ?? []), ...features])];
  entry.rules = [...new Set([...(entry.rules ?? []), ...rules])];
  entry.workflows = [...new Set([...(entry.workflows ?? []), run.name].filter(Boolean))].slice(-100);
  entry.firstSeenAt = [entry.firstSeenAt, seenAt].filter(Boolean).sort()[0] ?? seenAt;
  entry.lastSeenAt = [entry.lastSeenAt, seenAt].filter(Boolean).sort().at(-1) ?? seenAt;
  entry.classification = external ? 'external' : (entry.classification ?? 'internal');
  const runId = String(run.databaseId);
  if ((entry.evidence ?? []).some((item) => item?.runId === runId)) return false;
  entry.occurrences = Number(entry.occurrences ?? 0) + 1;
  if (run.conclusion === 'success') entry.successes = Number(entry.successes ?? 0) + 1;
  if (run.conclusion === 'failure') entry.failures = Number(entry.failures ?? 0) + 1;
  entry.evidence = [...(entry.evidence ?? []), {
    runId, workflow: run.name ?? null, conclusion: run.conclusion ?? null,
    headSha: run.headSha ?? null, headBranch: run.headBranch ?? null, jobs: run.jobs ?? [],
    classification: external ? 'external' : 'internal', normalizedLog: normalized.slice(0, 6000), at: seenAt,
  }].slice(-50);
  memory.actionHistory = collection.slice(-2000);
  return true;
}

function addHistoricalCase(log, run) {
  if (!log.trim()) return false;
  const fingerprint = fingerprintFailure(log);
  const normalized = log.replace(/\d{10,}/g, '<ID>').slice(0, 12000);
  const rootCause = classify(log);
  const features = extractFeatures(log);
  const external = /CAPIError|SessionModelError|requested model is not supported|api-deployments-free-per-day|rate limit|quota|deployment provider/i.test(log);
  const seenAt = run.updatedAt ?? new Date().toISOString();
  const existing = findCase(memory, fingerprint);
  const entry = existing ?? {
    fingerprint,
    rootCause,
    attempts: 0,
    successes: 0,
    failures: 0,
    confidence: 0,
    rules: [],
    outcomes: [],
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    occurrences: 0,
    workflow: null,
    workflows: [],
    jobs: [],
    sha: run.headSha ?? null,
    classification: external ? 'external' : 'internal',
    successfulStrategies: [],
    failedStrategies: [],
    repairCount: 0,
  };
  entry.rootCause = rootCause;
  entry.normalizedFailure = normalized;
  entry.features = [...new Set([...(entry.features ?? []), ...features])];
  entry.firstSeenAt = [entry.firstSeenAt, seenAt].filter(Boolean).sort()[0] ?? seenAt;
  entry.lastSeenAt = [entry.lastSeenAt, seenAt].filter(Boolean).sort().at(-1) ?? seenAt;
  entry.workflow = run.name ?? entry.workflow ?? null;
  entry.workflows = [...new Set([...(entry.workflows ?? []), run.name].filter(Boolean))];
  entry.jobs = [...new Set([...(entry.jobs ?? []), ...(run.jobs ?? [])].filter(Boolean))].slice(-50);
  entry.sha = run.headSha ?? entry.sha ?? null;
  entry.classification = external ? 'external' : (entry.classification ?? 'internal');
  const already = (entry.outcomes ?? []).some((x) => x.provenance?.runId === String(run.databaseId) && x.provenance?.source === 'GitHub Actions historical');
  if (already) return false;
  entry.occurrences = Number(entry.occurrences ?? 0) + 1;
  if (external) entry.externalBlocks = Number(entry.externalBlocks ?? 0) + 1;
  entry.outcomes = [...(entry.outcomes ?? []), {
    outcome: 'historical',
    verification: run.conclusion ?? 'unknown',
    rule: null,
    provenance: {
      source: 'GitHub Actions historical',
      runId: String(run.databaseId),
      failedSha: run.headSha ?? null,
      workflow: run.name ?? null,
      jobs: run.jobs ?? [],
      classification: external ? 'external' : 'internal',
    },
    at: seenAt,
  }].slice(-20);
  if (!existing) memory.cases.push(entry);
  return true;
}

for (const workflow of workflows) {
  let runs;
  try {
    runs = JSON.parse(runGh(['run', 'list', '--workflow', workflow, '--limit', String(limit), '--json', 'databaseId,name,conclusion,headSha,headBranch,updatedAt']));
  } catch (error) {
    console.warn(`Unable to read workflow ${workflow}: ${error.message}`);
    continue;
  }
  for (const run of runs.filter((r) => r.conclusion === 'failure' || (includeSuccess && r.conclusion === 'success'))) {
    report.runsScanned += 1;
    try {
      const logArg = run.conclusion === 'failure' ? '--log-failed' : '--log';
      const log = runGh(['run', 'view', String(run.databaseId), logArg]);
      let jobs = [];
      try {
        const meta = JSON.parse(runGh(['run', 'view', String(run.databaseId), '--json', 'jobs']));
        jobs = (meta.jobs ?? []).map((job) => job.name).filter(Boolean);
      } catch (error) {
        console.warn(`Unable to read jobs for historical run ${run.databaseId}: ${error.message}`);
      }
      const enriched = { ...run, jobs };
      if (addActionObservation(log, enriched)) report.actionObservationsImported += 1;
      if (run.conclusion === 'failure' && addHistoricalCase(log, enriched)) report.failuresImported += 1;
      if (run.conclusion === 'success') report.successesImported += 1;
    } catch (error) {
      console.warn(`Unable to read ${run.conclusion} log ${run.databaseId}: ${error.message}`);
    }
  }
}

const historyPath = 'docs/AUTO_REPAIR_HISTORY.jsonl';
if (fs.existsSync(historyPath)) {
  const records = fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).slice(-500);
  report.repairsRead = records.length;
  for (const line of records) {
    try {
      const repair = JSON.parse(line);
      const entry = findCase(memory, repair.fingerprint);
      if (entry) {
        entry.rules = [...new Set([...(entry.rules ?? []), repair.selectedRule].filter(Boolean))];
        entry.outcomes = [...(entry.outcomes ?? []), {
          outcome: repair.outcome ?? 'repair-history',
          verification: repair.repairProof ?? 'historical repair evidence',
          rule: repair.selectedRule ?? null,
          provenance: { source: 'AUTO_REPAIR_HISTORY', runId: String(repair.failedRunId ?? ''), failedSha: repair.failedSha ?? null, repairWorkflowRunId: repair.repairWorkflowRunId ?? null },
          at: repair.recordedAt ?? new Date().toISOString(),
        }].slice(-20);
      }
    } catch (error) {
      void error;
    }
  }
}

report.similarCases = memory.cases.filter((x) => (x.outcomes ?? []).some((o) => o.outcome === 'historical')).length;
writeMemory(memory);
const learningReportPath = process.env.FLIXO_HISTORICAL_LEARNING_OUTPUT ?? 'diagnostics/auto-repair/historical-learning.json';
fs.mkdirSync(learningReportPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(learningReportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
