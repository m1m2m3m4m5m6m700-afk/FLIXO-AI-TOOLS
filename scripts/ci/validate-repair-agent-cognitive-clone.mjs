#!/usr/bin/env node
import fs from 'node:fs';

const arg = (name) => {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
};
const file = arg('file');
const targetSha = arg('target-sha');

if (file !== '/tmp/flixo-repair-agent-clone.json') throw new Error('REPAIR_AGENT_CLONE_PATH_INVALID');
if (!/^[a-f0-9]{40}$/i.test(targetSha)) throw new Error('REPAIR_AGENT_CLONE_TARGET_SHA_INVALID');
const stat = fs.statSync(file);
if (stat.size <= 0 || stat.size > 524288) throw new Error('REPAIR_AGENT_CLONE_PAYLOAD_SIZE_INVALID');

const value = JSON.parse(fs.readFileSync(file, 'utf8'));
const required = {
  schemaVersion: 1,
  protocol: 'FLIXO-REPAIR-AGENT-COGNITIVE-CLONE-v1',
  identity: 'repairAgentClone',
  role: 'INDEPENDENT_COGNITIVE_REPAIR_PEER',
  authority: 'COGNITIVE_PARITY_WITH_SEPARATED_AUTHORITY',
  mutationAuthority: false,
  repositoryWrite: false,
  greenAuthority: false,
  certificationAuthority: false,
  exactShaBound: true,
  targetSha,
  expectedSha: targetSha,
  sameCognitiveEngine: true,
};
for (const [key, expected] of Object.entries(required)) {
  if (value?.[key] !== expected) throw new Error(`REPAIR_AGENT_CLONE_CONTRACT_MISMATCH:${key}`);
}
const parity = value.cognitiveParity;
if (parity?.level !== 'EXACT') throw new Error('REPAIR_AGENT_CLONE_COGNITIVE_PARITY_INVALID');
if (!/^[a-f0-9]{64}$/i.test(String(parity?.sourceDigest ?? ''))) throw new Error('REPAIR_AGENT_CLONE_SOURCE_DIGEST_INVALID');
if (!Array.isArray(parity?.capabilities) || parity.capabilities.length < 20) throw new Error('REPAIR_AGENT_CLONE_CAPABILITIES_INCOMPLETE');
if (Array.isArray(parity?.missingCapabilities) && parity.missingCapabilities.length) throw new Error('REPAIR_AGENT_CLONE_MISSING_CAPABILITIES');
if (value.learning?.promotionRule !== 'ONLY_AFTER_CANONICAL_GREEN') throw new Error('REPAIR_AGENT_CLONE_LEARNING_PROMOTION_INVALID');
if (value.adversarialPeer?.enabled !== true || value.adversarialPeer?.mutation !== false) throw new Error('REPAIR_AGENT_CLONE_ADVERSARIAL_BOUNDARY_INVALID');
if (value.decision?.mode == null) throw new Error('REPAIR_AGENT_CLONE_DECISION_MISSING');
console.log(`REPAIR_AGENT_COGNITIVE_CLONE_VALIDATED sha=${targetSha}`);
