import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const env = process.env;
const repository = env.GITHUB_REPOSITORY ?? 'unknown';
const event = env.GITHUB_EVENT_NAME ?? 'unknown';
const runId = env.GITHUB_RUN_ID ?? 'unknown';
const attempt = Number(env.GITHUB_RUN_ATTEMPT ?? '1');
const expectedHeadSha = env.EXPECTED_HEAD_SHA ?? '';
const mergeSha = env.MERGE_SHA ?? null;
let baseSha = env.BASE_SHA ?? '';
let headSha = expectedHeadSha;
let prNumber = null;

if (env.GITHUB_EVENT_PATH) {
  try {
    const payload = JSON.parse(await fs.readFile(env.GITHUB_EVENT_PATH, 'utf8'));
    prNumber = payload.pull_request?.number ?? null;
    baseSha = payload.pull_request?.base?.sha ?? baseSha;
    headSha = payload.pull_request?.head?.sha ?? headSha;
  } catch (error) {
    console.error(`G3-00 event payload parse failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}

const testedSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const identity = {
  gate: 'G3-00',
  repository,
  event,
  prNumber,
  baseSha: baseSha || 'unknown',
  headSha: headSha || 'unknown',
  mergeSha,
  testedSha,
  runId,
  attempt,
  identityRule: 'testedSha must equal authoritative PR headSha; mergeSha is metadata only',
};

const failures = [];
if (!identity.headSha || identity.headSha === 'unknown') failures.push('headSha missing');
if (identity.testedSha !== identity.headSha) failures.push(`testedSha ${identity.testedSha} != headSha ${identity.headSha}`);

identity.mergeShaWarning = event === 'pull_request' && mergeSha && mergeSha === identity.testedSha
  ? null
  : event === 'pull_request' && mergeSha
    ? 'mergeSha is metadata and may refer to a mutable PR merge ref; it is not a gate identity'
    : null;
identity.status = failures.length ? 'FAIL' : 'PASS';
identity.classification = failures.length ? 'CI' : null;
identity.rootCause = failures.length ? 'SHA_IDENTITY' : null;

await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/identity.json', JSON.stringify(identity, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(identity, null, 2));
if (failures.length) process.exit(3);
