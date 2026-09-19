import fs from 'node:fs';
import { fingerprintFailure, externalProviderSignature, loadMemory } from './auto-repair-learning.mjs';

export function shouldReopenExternalRepairCycle(memory, { fingerprint, providerSignature } = {}) {
  const entry = memory?.cases?.find((item) => item.fingerprint === fingerprint);
  if (!entry) return { reopen: true, reason: 'no-prior-external-block' };
  const blocks = (entry.outcomes ?? []).filter((item) => item?.outcome === 'blocked-external');
  if (!blocks.length) return { reopen: true, reason: 'no-prior-external-block' };

  const latest = blocks.at(-1);
  const learnedSignature = latest?.provenance?.providerSignature ?? null;

  if (!providerSignature || !learnedSignature) {
    return {
      reopen: false,
      reason: 'same-failure-signature-without-provider-proof',
      providerSignature: providerSignature ?? null,
      learnedSignature,
    };
  }

  if (providerSignature === learnedSignature) {
    return {
      reopen: false,
      reason: 'same-provider-block-already-learned',
      providerSignature,
      learnedSignature,
    };
  }

  return {
    reopen: true,
    reason: 'provider-signature-changed',
    providerSignature,
    learnedSignature,
  };
}

export function superviseExternalRepairCycle({ log, memory } = {}) {
  const text = String(log ?? '');
  const fingerprint = fingerprintFailure(text);
  const providerSignature = externalProviderSignature(text);
  const decision = shouldReopenExternalRepairCycle(memory ?? loadMemory(), { fingerprint, providerSignature });
  return { ...decision, fingerprint, providerSignature };
}

if (process.argv[1]?.endsWith('auto-repair-supervisor.mjs') && process.argv.includes('--check-reprobe')) {
  const logPath = process.env.FLIXO_FAILURE_LOG ?? '/tmp/flixo-failure.log';
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const decision = superviseExternalRepairCycle({ log });
  console.log(JSON.stringify(decision));
  process.stdout.write(decision.reopen ? 'true\n' : 'false\n');
}
