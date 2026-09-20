#!/usr/bin/env node
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { ACTION_AGENT_TRIAD_VERSION, getActionAgentProfile, assertActionAgentDispatch, validateActionAgentResult, buildActionAgentCognitionEnvelope } from './action-agent-triad.mjs';

const ACCOUNTS = Object.freeze({
  CHIEF: Object.freeze({
    tokenEnv: 'COUNCIL_CHIEF_TOKEN',
    wakePortEnv: 'COUNCIL_CHIEF_BRIDGE_PORT',
    executorEndpointEnv: 'COUNCIL_CHIEF_AGENT_ENDPOINT',
    executorTokenEnv: 'COUNCIL_CHIEF_AGENT_TOKEN',
    modelProfileEnv: 'COUNCIL_CHIEF_MODEL_PROFILE',
    reasoningEffortEnv: 'COUNCIL_CHIEF_REASONING_EFFORT',
  }),
  WORKER_A: Object.freeze({
    tokenEnv: 'COUNCIL_WORKER_A_TOKEN',
    wakePortEnv: 'COUNCIL_WORKER_A_BRIDGE_PORT',
    executorEndpointEnv: 'COUNCIL_WORKER_A_AGENT_ENDPOINT',
    executorTokenEnv: 'COUNCIL_WORKER_A_AGENT_TOKEN',
    modelProfileEnv: 'COUNCIL_WORKER_A_MODEL_PROFILE',
    reasoningEffortEnv: 'COUNCIL_WORKER_A_REASONING_EFFORT',
  }),
  WORKER_B: Object.freeze({
    tokenEnv: 'COUNCIL_WORKER_B_TOKEN',
    wakePortEnv: 'COUNCIL_WORKER_B_BRIDGE_PORT',
    executorEndpointEnv: 'COUNCIL_WORKER_B_AGENT_ENDPOINT',
    executorTokenEnv: 'COUNCIL_WORKER_B_AGENT_TOKEN',
    modelProfileEnv: 'COUNCIL_WORKER_B_MODEL_PROFILE',
    reasoningEffortEnv: 'COUNCIL_WORKER_B_REASONING_EFFORT',
  }),
});

const SHA_RE = /^[0-9a-f]{40}$/u;

const accountId = (value) => {
  const id = String(value ?? '').trim().toUpperCase();
  if (!(id in ACCOUNTS)) throw new Error('COUNCIL_BRIDGE_ACCOUNT_INVALID');
  return id;
};

export const exactSha = (value) => {
  const sha = String(value ?? '').trim();
  if (!SHA_RE.test(sha)) throw new Error('COUNCIL_BRIDGE_EXACT_SHA_INVALID');
  return sha;
};

const envValue = (env, name, required = true) => {
  const value = String(env?.[name] ?? '').trim();
  if (!value && required) throw new Error('COUNCIL_BRIDGE_ENV_MISSING=' + name);
  return value;
};

export const buildConfig = (account, env = process.env) => {
  const id = accountId(account);
  const spec = ACCOUNTS[id];
  const runtimeUrl = envValue(env, 'COUNCIL_RUNTIME_URL');
  const token = envValue(env, spec.tokenEnv);
  const executorEndpoint = envValue(env, spec.executorEndpointEnv);
  const executorToken = envValue(env, spec.executorTokenEnv);
  const modelProfile = envValue(env, spec.modelProfileEnv, false) || 'FRONTIER_REASONING';
  const reasoningEffort = envValue(env, spec.reasoningEffortEnv, false) || 'HIGH';
  const portRaw = envValue(env, spec.wakePortEnv, false) || '8781';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('COUNCIL_BRIDGE_PORT_INVALID');
  return Object.freeze({
    accountId: id,
    runtimeUrl: runtimeUrl.replace(/\/$/u, ''),
    token,
    executorEndpoint,
    executorToken,
    modelProfile,
    reasoningEffort,
    port,
  });
};

const runtimeUrl = (config, action) => {
  const url = new URL(config.runtimeUrl);
  url.searchParams.set('action', action);
  return url;
};

const requestJson = async (fetchImpl, url, init = {}) => {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const raw = await response.text();
  let body;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!response.ok) {
    const code = body && typeof body === 'object' ? String(body.error ?? 'COUNCIL_BRIDGE_REMOTE_ERROR') : 'COUNCIL_BRIDGE_REMOTE_ERROR';
    throw new Error(code);
  }
  return body;
};

const authHeaders = (token) => ({ authorization: 'Bearer ' + token });

export const pollDispatch = async (config, fetchImpl = globalThis.fetch) => {
  const body = await requestJson(fetchImpl, runtimeUrl(config, 'poll') + '&accountId=' + encodeURIComponent(config.accountId), {
    method: 'GET',
    headers: authHeaders(config.token),
  });
  const dispatch = body?.dispatch ?? null;
  if (!dispatch) return null;
  const identity = body?.identity ?? null;
  if (!body?.identityVerified || !identity || !identity.agentId || !identity.machineRole) {
    throw new Error('COUNCIL_BRIDGE_AGENT_IDENTITY_UNVERIFIED');
  }
  const entrySha=exactSha(dispatch.entry_sha ?? dispatch.entrySha);
  assertActionAgentDispatch({accountId:config.accountId,exactSha:entrySha,taskId:dispatch.task_id ?? dispatch.taskId,workPackageId:dispatch.work_package_id ?? dispatch.workPackageId,missionId:dispatch.mission_id ?? dispatch.missionId ?? dispatch.payload?.missionId ?? dispatch.work_package_id ?? dispatch.workPackageId});
  const profile=getActionAgentProfile(config.accountId);
  return Object.freeze({...dispatch,entry_sha:entrySha,identity,actionAgentProfileId:profile.profileId,actionAgentTriadVersion:ACTION_AGENT_TRIAD_VERSION});
};

export const ackDispatch = async (config, dispatch, sessionId, fetchImpl = globalThis.fetch) =>
  requestJson(fetchImpl, runtimeUrl(config, 'ack'), {
    method: 'POST',
    headers: authHeaders(config.token),
    body: JSON.stringify({
      accountId: config.accountId,
      dispatchId: String(dispatch.dispatch_id ?? dispatch.dispatchId),
      sessionId,
      agentId: String(dispatch.identity?.agentId ?? dispatch.payload?.agentId ?? ''),
      entrySha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
    }),
  });

export const heartbeatDispatch = async (config, dispatch, sessionId, fetchImpl = globalThis.fetch) =>
  requestJson(fetchImpl, runtimeUrl(config, 'heartbeat'), {
    method: 'POST',
    headers: authHeaders(config.token),
    body: JSON.stringify({
      accountId: config.accountId,
      dispatchId: String(dispatch.dispatch_id ?? dispatch.dispatchId),
      sessionId,
      entrySha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
    }),
  });

export const completeDispatch = async (config, dispatch, sessionId, status, evidence, payload, fetchImpl = globalThis.fetch) => {
  if (!['DONE', 'FAILED'].includes(status)) throw new Error('COUNCIL_BRIDGE_COMPLETE_STATUS_INVALID');
  return requestJson(fetchImpl, runtimeUrl(config, 'complete'), {
    method: 'POST',
    headers: authHeaders(config.token),
    body: JSON.stringify({
      accountId: config.accountId,
      dispatchId: String(dispatch.dispatch_id ?? dispatch.dispatchId),
      sessionId,
      entrySha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
      status,
      evidence,
      payload,
    }),
  });
};

export const executeExternalAgent = async (config, dispatch, sessionId, fetchImpl = globalThis.fetch) => {
  const endpoint = new URL(config.executorEndpoint);
  const payload = {
    protocol: 'FLIXO_EXTERNAL_GPT_BRIDGE_V1',
    accountId: config.accountId,
    sessionId,
    dispatchId: String(dispatch.dispatch_id ?? dispatch.dispatchId),
    agentId: String(dispatch.identity?.agentId ?? dispatch.payload?.agentId ?? ''),
    exactSha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
    taskId: String(dispatch.task_id ?? dispatch.taskId ?? ''),
    workPackageId: String(dispatch.work_package_id ?? dispatch.workPackageId ?? ''),
    actionAgentTriadVersion: ACTION_AGENT_TRIAD_VERSION,
    actionAgentProfileId: getActionAgentProfile(config.accountId).profileId,
    modelProfile: config.modelProfile,
    reasoningEffort: config.reasoningEffort,
    capabilities: { toolCalling: true, structuredOutput: true, selfCritique: true, independentReview: config.accountId !== 'CHIEF' },
    cognitionEnvelope: buildActionAgentCognitionEnvelope({
      accountId: config.accountId,
      dispatch,
      objective: dispatch.payload?.objective,
      requiredCapabilities: Array.isArray(dispatch.payload?.requiredCapabilities) ? dispatch.payload.requiredCapabilities : [],
    }),
    payload: dispatch.payload ?? {},
  };
  const body = await requestJson(fetchImpl, endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders(config.executorToken),
      'x-flixo-account-id': config.accountId,
      'x-flixo-session-id': sessionId,
      'x-flixo-exact-sha': payload.exactSha,
    },
    body: JSON.stringify(payload),
  });
  if (!body || typeof body !== 'object') throw new Error('COUNCIL_BRIDGE_EXECUTOR_RESPONSE_INVALID');
  const status = String(body.status ?? 'DONE');
  if (!['DONE','FAILED'].includes(status)) throw new Error('COUNCIL_BRIDGE_EXECUTOR_STATUS_INVALID');
  const evidence=body.evidence&&typeof body.evidence==='object'?body.evidence:{};
  const payload=body.payload&&typeof body.payload==='object'?body.payload:{};
  const validation=validateActionAgentResult({accountId:config.accountId,dispatch,status,payload});
  return {status,evidence:{...evidence,actionAgentValidation:validation},payload};
};

export function createBridge({ config, fetchImpl = globalThis.fetch, heartbeatMs = 30_000 } = {}) {
  if (!config) throw new Error('COUNCIL_BRIDGE_CONFIG_REQUIRED');
  let running = false;
  let stopped = false;
  let heartbeatTimer = null;
  let lastWakeAt = null;

  const processOnce = async () => {
    if (running || stopped) return false;
    running = true;
    try {
      const dispatch = await pollDispatch(config, fetchImpl);
      if (!dispatch) return false;
      const sessionId = randomUUID();
      await ackDispatch(config, dispatch, sessionId, fetchImpl);

      heartbeatTimer = setInterval(() => {
        heartbeatDispatch(config, dispatch, sessionId, fetchImpl).catch(() => {});
      }, heartbeatMs);
      heartbeatTimer.unref?.();

      try {
        const result = await executeExternalAgent(config, dispatch, sessionId, fetchImpl);
        await completeDispatch(config, dispatch, sessionId, result.status, {
          bridge: 'external-gpt-bridge-v1',
          accountId: config.accountId,
          sessionId,
          exactSha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
          ...result.evidence,
        }, result.payload, fetchImpl);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await completeDispatch(config, dispatch, sessionId, 'FAILED', {
          bridge: 'external-gpt-bridge-v1',
          accountId: config.accountId,
          sessionId,
          exactSha: exactSha(dispatch.entry_sha ?? dispatch.entrySha),
          error: message,
        }, {}, fetchImpl).catch(() => {});
        throw error;
      } finally {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      return true;
    } finally {
      running = false;
    }
  };

  const wake = async (wakeBody = {}) => {
    lastWakeAt = new Date().toISOString();
    await processOnce();
    return {
      accepted: true,
      accountId: config.accountId,
      dispatchId: String(wakeBody.dispatchId ?? ''),
      exactSha: wakeBody.exactSha ? exactSha(wakeBody.exactSha) : null,
      lastWakeAt,
    };
  };

  const stop = () => {
    stopped = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  };

  return Object.freeze({
    processOnce,
    wake,
    stop,
    get status() {
      return Object.freeze({ accountId: config.accountId, running, stopped, lastWakeAt });
    },
  });
}

export const createWakeServer = ({ config, bridge, createServer = http.createServer } = {}) => {
  if (!config || !bridge) throw new Error('COUNCIL_BRIDGE_SERVER_CONFIG_REQUIRED');
  return createServer(async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-request-id', requestId);

    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, ...bridge.status }));
        return;
      }

      if (req.method !== 'POST' || req.url !== '/wake') {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: 'COUNCIL_BRIDGE_ROUTE_NOT_FOUND', requestId }));
        return;
      }

      const auth = String(req.headers.authorization ?? '');
      if (auth !== 'Bearer ' + config.token) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error: 'COUNCIL_BRIDGE_UNAUTHORIZED', requestId }));
        return;
      }

      let raw = '';
      for await (const chunk of req) {
        raw += chunk.toString('utf8');
        if (raw.length > 200_000) throw new Error('COUNCIL_BRIDGE_WAKE_BODY_TOO_LARGE');
      }
      const body = raw.trim() ? JSON.parse(raw) : {};
      if (body.accountId && accountId(body.accountId) !== config.accountId) throw new Error('COUNCIL_BRIDGE_WAKE_ACCOUNT_MISMATCH');
      if (body.exactSha) exactSha(body.exactSha);

      const result = await bridge.wake(body);
      res.statusCode = 202;
      res.end(JSON.stringify({ ok: true, ...result, requestId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.statusCode = /UNAUTHORIZED/u.test(message) ? 401 : 400;
      res.end(JSON.stringify({ ok: false, error: message.startsWith('COUNCIL_BRIDGE_') ? message : 'COUNCIL_BRIDGE_WAKE_FAILED', requestId }));
    }
  });
};

const main = async () => {
  const account = accountId(process.argv.find((arg) => arg.startsWith('--account='))?.split('=')[1] ?? process.env.COUNCIL_ACCOUNT_ID);
  const config = buildConfig(account);
  const bridge = createBridge({ config });
  const server = createWakeServer({ config, bridge });
  server.listen(config.port, '0.0.0.0', () => {
    console.log(JSON.stringify({
      event: 'COUNCIL_BRIDGE_READY',
      accountId: config.accountId,
      port: config.port,
      wakePath: '/wake',
      pollEnabled: true,
      exactShaRequired: true,
      executorEndpoint: config.executorEndpoint,
    }));
  });

  const intervalMs = Number(process.env.COUNCIL_BRIDGE_POLL_MS ?? 5000);
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 300000) throw new Error('COUNCIL_BRIDGE_POLL_MS_INVALID');

  while (true) {
    await bridge.processOnce().catch((error) => console.error(JSON.stringify({
      event: 'COUNCIL_BRIDGE_CYCLE_FAILED',
      accountId: config.accountId,
      errorCode: error instanceof Error && error.message.startsWith('COUNCIL_BRIDGE_')
        ? error.message
        : 'COUNCIL_BRIDGE_CYCLE_FAILED',
    })));
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
