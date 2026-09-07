import { mkdir, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const file = process.env.FLIXO_AGENT_EVENT_LOG ?? '.ci/agent-coordination/events.ndjson';
const required = ['action', 'agentId', 'branch', 'sha'];
const event = {
  schemaVersion: 1,
  timestamp: new Date().toISOString(),
  action: process.env.FLIXO_AGENT_EVENT_ACTION ?? '',
  agentId: process.env.FLIXO_AGENT_ID ?? '',
  branch: process.env.FLIXO_AGENT_BRANCH ?? '',
  sha: process.env.FLIXO_AGENT_SHA ?? '',
  targetSha: process.env.FLIXO_AGENT_TARGET_SHA ?? null,
  scope: {
    paths: (process.env.FLIXO_AGENT_PATHS ?? '').split(',').filter(Boolean),
    contracts: (process.env.FLIXO_AGENT_CONTRACTS ?? '').split(',').filter(Boolean),
    rootCauseIds: (process.env.FLIXO_AGENT_ROOT_CAUSES ?? '').split(',').filter(Boolean),
  },
  message: process.env.FLIXO_AGENT_EVENT_MESSAGE ?? '',
};
for (const key of required) if (!event[key]) throw new Error(`Missing coordination event field: ${key}`);
if (!/^[0-9a-f]{40}$/iu.test(event.sha)) throw new Error('Coordination event sha must be exact 40-char Git SHA');
if (!/^agent\/[^/]+\/.+$/u.test(event.branch)) throw new Error('Coordination event branch must be an agent branch');
const payload = JSON.stringify(event);
const existing = await readFile(file, 'utf8').catch(() => '');
const previousHash = existing ? createHash('sha256').update(existing).digest('hex') : null;
event.previousLogHash = previousHash;
await mkdir('.ci/agent-coordination', { recursive: true });
await appendFile(file, JSON.stringify(event) + '\n');
console.log(`coordination-event PASS: ${event.action} ${event.agentId} ${event.sha}`);
