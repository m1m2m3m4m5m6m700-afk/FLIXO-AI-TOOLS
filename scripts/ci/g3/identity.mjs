import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const env = process.env;
const repository = env.GITHUB_REPOSITORY ?? 'unknown';
const event = env.GITHUB_EVENT_NAME ?? 'unknown';
const runId = env.GITHUB_RUN_ID ?? 'unknown';
const attempt = Number(env.GITHUB_RUN_ATTEMPT ?? '1');
const expectedHeadSha = env.EXPECTED_HEAD_SHA ?? '';
const mergeSha = env.MERGE_SHA ?? env.GITHUB_SHA ?? '';
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
  mergeSha: mergeSha || null,
  testedSha,
  runId,
  attempt,
  identityRule: 'testedSha=git rev-parse HEAD; mergeSha is metadata only',
};

const failures = [];
if (identity.headSha === 'unknown' || !identity.headSha) failures.push('headSha missing');
if (identity.testedSha !== identity.headSha) failures.push(`testedSha ${identity.testedSha} != headSha ${identity.headSha}`);
if (env.GITHUB_SHA && identity.mergeSha !== env.GITHUB_SHA && event === 'pull_request') failures.push('merge SHA metadata mismatch');

identity.status = failures.length ? 'FAIL' : 'PASS';
identity.classification = failures.length ? 'CI' : null;
identity.rootCause = failures.length ? 'SHA_IDENTITY' : null;

await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/identity.json', JSON.stringify(identity, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(identity, null, 2));
if (failures.length) process.exit(3);
