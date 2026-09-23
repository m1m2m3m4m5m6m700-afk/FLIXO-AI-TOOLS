import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildTenXRepairProfile } from './repair-ten-x.mjs';

function arg(name, fallback) {
  const token = '--' + name + '=';
  const found = process.argv.find((value) => value.startsWith(token));
  return found ? found.slice(token.length) : fallback;
}

function readJson(path, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch { return fallback; }
}

function liveExecutionSha() {
  const repo = String(process.env.GITHUB_REPOSITORY || '').trim();
  const token = String(process.env.GH_TOKEN || '').trim();
  if (!repo || !token) throw new Error('LIVE_EXECUTION_SHA_CONTEXT_MISSING');
  const result = spawnSync('gh', ['api', 'repos/' + repo + '/git/ref/heads/execution', '--jq', '.object.sha'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) throw new Error('LIVE_EXECUTION_SHA_LOOKUP_FAILED:' + (result.stderr || '').trim());
  const sha = String(result.stdout || '').trim();
  if (!/^[a-f0-9]{40}$/u.test(sha)) throw new Error('LIVE_EXECUTION_SHA_INVALID');
  return sha;
}

export function evaluateTenXGate({ targetSha, liveSha, strategy, rootProof, rcaManifest, masterPacket }) {
  const profile = buildTenXRepairProfile({ targetSha, strategy, rootProof, rcaManifest, masterPacket });
  const liveMatches = /^[a-f0-9]{40}$/u.test(String(liveSha || '')) && liveSha === targetSha;
  return {
    ...profile,
    targetSha,
    liveSha: liveSha || null,
    exactLiveSha: liveMatches,
    readyForMutation: profile.readyForMutation && liveMatches,
    route: profile.readyForMutation && liveMatches ? 'BOUNDED_REPAIR' : 'ESCALATE_OR_COLLECT_MORE_EVIDENCE',
  };
}

export function runTenXGate({
  targetSha = arg('target-sha', process.env.FLIXO_EXPECTED_TARGET_SHA),
  strategyPath = arg('strategy', process.env.FLIXO_REPAIR_STRATEGY_JSON || '/tmp/flixo-repair-strategy.json'),
  rootProofPath = arg('root-proof', process.env.FLIXO_ROOT_PROOF_PATH || '/tmp/action-root-cause-proof.json'),
  rcaManifestPath = arg('rca-manifest', process.env.FLIXO_RCA_MANIFEST_PATH || '/tmp/flixo-rca-manifest.json'),
  masterPacketPath = arg('master', process.env.FLIXO_MASTER_REPAIR_PACKET || '/tmp/flixo-master-repair-packet.json'),
  output = arg('output', process.env.FLIXO_TEN_X_GATE_PATH || '/tmp/flixo-ten-x-repair-gate.json'),
} = {}) {
  const strategy = readJson(strategyPath);
  const rootProof = readJson(rootProofPath);
  const rcaManifest = readJson(rcaManifestPath);
  const masterPacket = readJson(masterPacketPath);
  const liveSha = liveExecutionSha();
  const gate = evaluateTenXGate({ targetSha, liveSha, strategy, rootProof, rcaManifest, masterPacket });
  fs.writeFileSync(output, JSON.stringify(gate, null, 2) + '\n');
  console.log(JSON.stringify({
    protocol: gate.protocol,
    targetSha: gate.targetSha,
    liveSha: gate.liveSha,
    completedPasses: gate.completedPasses,
    requiredPasses: gate.requiredPasses,
    exactLiveSha: gate.exactLiveSha,
    readyForMutation: gate.readyForMutation,
    route: gate.route,
  }, null, 2));
  if (!gate.readyForMutation) process.exitCode = 2;
  return gate;
}

if (process.argv[1] && new URL('file://' + process.argv[1]).href === import.meta.url) {
  try {
    runTenXGate();
  } catch (error) {
    console.error('REPAIR_TEN_X_GATE_ERROR=' + (error?.stack ?? error));
    process.exitCode = 1;
  }
}