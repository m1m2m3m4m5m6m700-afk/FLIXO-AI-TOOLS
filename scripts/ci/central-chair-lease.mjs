#!/usr/bin/env node
import crypto from 'node:crypto';

const url = () => String(process.env.SUPABASE_URL ?? '').trim().replace(/\/$/u, '');
const key = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '').trim();
const required = (v, name) => {
  const x = String(v ?? '').trim();
  if (!x) throw new Error('CENTRAL_CHAIR_' + name + '_REQUIRED');
  return x;
};
const sha = (v) => {
  const x = required(v, 'SHA');
  if (!/^[0-9a-f]{40}$/u.test(x)) throw new Error('CENTRAL_CHAIR_SHA_INVALID');
  return x;
};
const hash = (v) => crypto.createHash('sha256').update(String(v), 'utf8').digest('hex');
const leaseId = () => crypto.randomUUID();
const json = (args) => {
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = String(args[i] ?? '');
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    const name = token.slice(2, eq < 0 ? undefined : eq);
    const value = eq < 0 ? String(args[i + 1] ?? '') : token.slice(eq + 1);
    out[name] = value;
  }
  return out;
};
const arg = (m, name, fallback = '') => String(m[name] ?? fallback).trim();

async function rpc(name, body) {
  const base = required(url(), 'SUPABASE_URL');
  const secret = required(key(), 'SERVICE_ROLE_KEY');
  const res = await fetch(base + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      apikey: secret,
      authorization: 'Bearer ' + secret,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = { raw }; }
  }
  if (!res.ok) {
    const detail = typeof data === 'object' && data ? (data.message ?? data.hint ?? data.details ?? data.raw ?? '') : '';
    throw new Error('CENTRAL_CHAIR_RPC_FAILED=' + res.status + (detail ? ':' + detail : ''));
  }
  return data;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const a = json(rest);
  if (!command) throw new Error('Usage: central-chair-lease.mjs delegate|verify|heartbeat|release|status');

  if (command === 'delegate') {
    const holder = arg(a, 'holder');
    const task = arg(a, 'task');
    const workPackage = arg(a, 'work-package');
    const exactSha = sha(arg(a, 'sha'));
    const session = arg(a, 'session');
    const id = arg(a, 'lease-id', leaseId());
    const fence = arg(a, 'fencing-hash') || hash([holder, task, workPackage, exactSha, id].join(':'));
    const actor = arg(a, 'actor', 'assistantController');
    const seconds = Number(arg(a, 'lease-seconds', '2700'));
    const row = await rpc('flix_chair1_delegate', {
      p_actor: actor, p_holder_agent_id: holder, p_task_id: task, p_work_package_id: workPackage,
      p_exact_sha: exactSha, p_session_id: session, p_lease_id: id, p_fencing_token_hash: fence,
      p_lease_seconds: seconds,
    });
    console.log(JSON.stringify({ok:true, chairId:'chair_1', ownerAgentId:'assistantController', leaseId:id, fencingTokenHash:fence, state:row}, null, 2));
    return;
  }

  const holder = required(arg(a, 'holder'), 'HOLDER');
  const task = required(arg(a, 'task'), 'TASK');
  const workPackage = required(arg(a, 'work-package'), 'WORK_PACKAGE');
  const exactSha = sha(arg(a, 'sha'));
  const id = required(arg(a, 'lease-id'), 'LEASE_ID');
  const fence = required(arg(a, 'fencing-hash'), 'FENCING_HASH');

  if (command === 'verify') {
    console.log(JSON.stringify(await rpc('flix_chair1_verify', {
      p_holder_agent_id: holder, p_task_id: task, p_work_package_id: workPackage,
      p_exact_sha: exactSha, p_lease_id: id, p_fencing_token_hash: fence,
    }), null, 2));
    return;
  }
  if (command === 'heartbeat') {
    console.log(JSON.stringify(await rpc('flix_chair1_heartbeat', {
      p_holder_agent_id: holder, p_task_id: task, p_work_package_id: workPackage,
      p_exact_sha: exactSha, p_lease_id: id, p_fencing_token_hash: fence,
    }), null, 2));
    return;
  }
  if (command === 'release') {
    if (arg(a, 'successful') !== 'true') throw new Error('CENTRAL_CHAIR_RELEASE_REQUIRES_TASK_CLOSE');
    console.log(JSON.stringify(await rpc('flix_chair1_release', {
      p_holder_agent_id: holder, p_task_id: task, p_work_package_id: workPackage,
      p_exact_sha: exactSha, p_lease_id: id, p_fencing_token_hash: fence, p_successful: true,
    }), null, 2));
    return;
  }
  throw new Error('Usage: central-chair-lease.mjs delegate|verify|heartbeat|release|status');
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
