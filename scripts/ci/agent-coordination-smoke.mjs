import { readFile } from 'node:fs/promises';
const claims = JSON.parse(await readFile('.ci/agent-coordination/claims.json', 'utf8'));
const sessions = JSON.parse(await readFile('scripts/ci/active-sessions.json', 'utf8'));
if (claims.schemaVersion !== 2) throw new Error('claims schema smoke failed');
if (sessions.schema_version !== 1 || sessions.source_of_truth !== '.ci/agent-coordination/claims.json') throw new Error('session projection smoke failed');
const active = claims.claims.filter((c) => c.status === 'active' && Date.parse(c.leaseUntil) > Date.now());
if (active.length !== sessions.active_sessions.length) throw new Error(`projection mismatch active=${active.length} sessions=${sessions.active_sessions.length}`);
console.log(`Agent collaboration smoke PASS: active=${active.length}`);
