import fs from 'node:fs';

const input = process.argv[2] ?? process.env.FLIXO_REPAIR_PACKET_PATH;
if (!input) throw new Error('REPAIR_PACKET_INPUT_REQUIRED');
if (!fs.existsSync(input)) throw new Error('REPAIR_PACKET_NOT_FOUND');

const packet = JSON.parse(fs.readFileSync(input, 'utf8'));
const fail = (code) => { throw new Error(code); };
const required = ['schemaVersion', 'repairChainId', 'entrySha', 'failureFingerprint', 'evidence', 'hypotheses', 'falsification', 'scope', 'verification', 'provenance', 'state'];
for (const key of required) if (!(key in packet)) fail(`PACKET_REQUIRED_FIELD_MISSING:${key}`);
if (!/^\d+\.\d+\.\d+$/.test(String(packet.schemaVersion))) fail('PACKET_SCHEMA_VERSION_INVALID');
if (!/^[0-9a-f]{40}$/.test(packet.entrySha)) fail('PACKET_ENTRY_SHA_INVALID');
if (!packet.repairChainId || !packet.failureFingerprint) fail('PACKET_IDENTITY_INCOMPLETE');
if (!Array.isArray(packet.hypotheses) || packet.hypotheses.length === 0) fail('PACKET_HYPOTHESES_REQUIRED');
if (!Array.isArray(packet.falsification) || packet.falsification.length === 0) fail('PACKET_FALSIFICATION_REQUIRED');
if (!packet.evidence || typeof packet.evidence !== 'object') fail('PACKET_EVIDENCE_REQUIRED');
if (!packet.scope?.allowedPaths || !Array.isArray(packet.scope.allowedPaths) || packet.scope.allowedPaths.length === 0) fail('PACKET_SCOPE_REQUIRED');
if (!packet.verification?.baseline || !packet.verification?.postRepair) fail('PACKET_VERIFICATION_PHASES_REQUIRED');
if (!packet.provenance?.source || !packet.provenance?.targetSha) fail('PACKET_PROVENANCE_INCOMPLETE');
if (packet.provenance.targetSha !== packet.entrySha && packet.state !== 'OPEN_RCA') fail('PACKET_SHA_DRIFT');
const terminal = new Set(['READY_FOR_PLAN', 'REJECTED', 'BLOCKED', 'UNKNOWN_RCA']);
if (terminal.has(packet.state) && !packet.verification.decision) fail('PACKET_TERMINAL_DECISION_REQUIRED');
process.stdout.write(JSON.stringify({ ok: true, state: packet.state, repairChainId: packet.repairChainId }) + '\n');
