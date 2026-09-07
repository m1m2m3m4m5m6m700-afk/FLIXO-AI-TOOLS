import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const out = process.env.FLIXO_AGENT_MESSAGE_FILE ?? 'artifacts/ci/agent-coordination/message.json';
const required = {
  messageType: process.env.FLIXO_AGENT_MESSAGE_TYPE ?? '',
  agentId: process.env.FLIXO_AGENT_ID ?? '',
  branch: process.env.FLIXO_AGENT_BRANCH ?? '',
  sha: process.env.FLIXO_AGENT_SHA ?? '',
};
for (const [key, value] of Object.entries(required)) if (!value) throw new Error(`Missing ${key}`);
if (!/^[0-9a-f]{40}$/iu.test(required.sha)) throw new Error('sha must be exact 40-char Git SHA');
if (!/^agent\/[^/]+\/.+$/u.test(required.branch)) throw new Error('branch must be agent/<family>/<name>');
const packet = {
  schemaVersion: 1,
  messageId: randomUUID(),
  timestamp: new Date().toISOString(),
  ...required,
  targetAgentId: process.env.FLIXO_AGENT_TARGET ?? null,
  objective: process.env.FLIXO_AGENT_OBJECTIVE ?? '',
  status: process.env.FLIXO_AGENT_STATUS ?? '',
  changedFiles: (process.env.FLIXO_AGENT_CHANGED_FILES ?? '').split(',').filter(Boolean),
  evidence: (process.env.FLIXO_AGENT_EVIDENCE ?? '').split(',').filter(Boolean),
  blockers: (process.env.FLIXO_AGENT_BLOCKERS ?? '').split(',').filter(Boolean),
  nextAction: process.env.FLIXO_AGENT_NEXT_ACTION ?? '',
  handoffSafe: process.env.FLIXO_AGENT_HANDOFF_SAFE === 'true',
};
await mkdir('artifacts/ci/agent-coordination', { recursive: true });
await writeFile(out, JSON.stringify(packet, null, 2) + '\n');
console.log(`coordination-message PASS: ${packet.messageId} ${packet.messageType} ${packet.agentId}`);
