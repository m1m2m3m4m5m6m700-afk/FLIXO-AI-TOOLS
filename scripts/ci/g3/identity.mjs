import fs from 'node:fs/promises';
const event = process.env.GITHUB_EVENT_NAME ?? 'unknown';
const runId = process.env.GITHUB_RUN_ID ?? 'unknown';
const attempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? '1');
const mergeSha = process.env.GITHUB_SHA ?? 'unknown';
let headSha = mergeSha;
let baseSha = 'unknown';
let prNumber = null;
if (process.env.GITHUB_EVENT_PATH) {
  try {
    const payload = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
    prNumber = payload.pull_request?.number ?? null;
    headSha = payload.pull_request?.head?.sha ?? mergeSha;
    baseSha = payload.pull_request?.base?.sha ?? 'unknown';
  } catch (error) {
    console.error(`G3-00 identity payload parse failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }
}
const identity = { repository: process.env.GITHUB_REPOSITORY ?? 'unknown', event, prNumber, baseSha, headSha, mergeSha, testedSha: headSha, runId, attempt };
await fs.mkdir('artifacts/ci/g3', { recursive: true });
await fs.writeFile('artifacts/ci/g3/identity.json', JSON.stringify(identity, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(identity, null, 2));
if (identity.testedSha === 'unknown' || identity.headSha === 'unknown') process.exit(3);
