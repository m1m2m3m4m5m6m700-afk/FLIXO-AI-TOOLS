import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";

type Account = "CHIEF" | "WORKER_A" | "WORKER_B";
type Body = Record<string, unknown>;

const GITHUB_REPOSITORY = "m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS";
const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_AUDIENCE = "https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime";
const GITHUB_OIDC_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

const COUNCIL_DIRECTIVE_VERSION = "1.0.0";
const COUNCIL_GREEN_AUTHORITY = "Daily·FLIXO Green Gate";
const COUNCIL_INTEGRATION_LANE = "execution -> main";

const accounts: Record<Account, { tokenEnv: string; endpointEnv?: string; fallback: Account; }> = {
  CHIEF: { tokenEnv: "COUNCIL_CHIEF_TOKEN", fallback: "CHIEF" },
  WORKER_A: { tokenEnv: "COUNCIL_WORKER_A_TOKEN", endpointEnv: "COUNCIL_WORKER_A_WAKE_ENDPOINT", fallback: "WORKER_B" },
  WORKER_B: { tokenEnv: "COUNCIL_WORKER_B_TOKEN", endpointEnv: "COUNCIL_WORKER_B_WAKE_ENDPOINT", fallback: "WORKER_A" },
};

const response = (body: unknown, status = 200, requestId = crypto.randomUUID()) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  });

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const env = (name: string) => {
  const value = Deno.env.get(name)?.trim() ?? "";
  if (!value) throw new Error("COUNCIL_ENV_MISSING=" + name);
  return value;
};

const bearer = (req: Request) => {
  const value = req.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
};

const authAccount = (req: Request, account: Account) => {
  if (!constantTimeEqual(bearer(req), env(accounts[account].tokenEnv))) {
    throw new Error("COUNCIL_ACCOUNT_UNAUTHORIZED");
  }
};

const authGitHubWorkflow = async (req: Request, allowedWorkflows: string[]) => {
  const token = bearer(req);
  if (!token) throw new Error("COUNCIL_GITHUB_OIDC_MISSING");
  const verified = await jwtVerify(token, GITHUB_OIDC_JWKS, {
    issuer: GITHUB_OIDC_ISSUER,
    audience: GITHUB_OIDC_AUDIENCE,
  });
  const claims = verified.payload;
  if (String(claims.repository ?? "") !== GITHUB_REPOSITORY) throw new Error("COUNCIL_GITHUB_OIDC_REPOSITORY_REJECTED");
  if (!allowedWorkflows.includes(String(claims.workflow ?? ""))) throw new Error("COUNCIL_GITHUB_OIDC_WORKFLOW_REJECTED");
  const event = String(claims.event_name ?? "");
  const ref = String(claims.ref ?? "");
  const allowed = allowedWorkflows.some((workflow) => {
    if (workflow === "FLIXO Master Agent Activation Relay") return event === "workflow_run" && ref === "refs/heads/execution" && String(claims.job_workflow_ref ?? "").startsWith(GITHUB_REPOSITORY + "/.github/workflows/agent-master-activation.yml@");
    if (workflow === "FLIXO External Council Lease Watcher") return ((event === "schedule" && ref === "refs/heads/main") || (event === "workflow_dispatch" && (ref === "refs/heads/main" || ref === "refs/heads/execution"))) && String(claims.job_workflow_ref ?? "").startsWith(GITHUB_REPOSITORY + "/.github/workflows/council-external-lease-watch.yml@");
    if (workflow === "FLIXO Council Wake Push Relay") return event === "push" && ref === "refs/heads/execution" && String(claims.job_workflow_ref ?? "").startsWith(GITHUB_REPOSITORY + "/.github/workflows/council-wake-push-relay.yml@");
    if (workflow === "FLIXO Agent Communication Relay") return event === "issue_comment" && ref === "refs/heads/main" && String(claims.job_workflow_ref ?? "").startsWith(GITHUB_REPOSITORY + "/.github/workflows/agent-communication-relay.yml@");
    if (workflow === "FLIXO Cell Master Consult Relay") return event === "workflow_dispatch" && (ref === "refs/heads/execution" || ref === "refs/heads/main") && String(claims.job_workflow_ref ?? "").startsWith(GITHUB_REPOSITORY + "/.github/workflows/cell-master-consult.yml@");
    return false;
  });
  if (!allowed) throw new Error("COUNCIL_GITHUB_OIDC_CONTEXT_REJECTED");
  return claims;
};

const db = async (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("apikey", env("SUPABASE_SERVICE_ROLE_KEY"));
  headers.set("authorization", "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"));
  headers.set("accept", "application/json");
  const r = await fetch(env("SUPABASE_URL").replace(/\/$/u, "") + path, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(10000),
  });
  const raw = await r.text();
  let body: unknown = null;
  if (raw) { try { body = JSON.parse(raw); } catch { body = raw; } }
  if (!r.ok) throw new Error("COUNCIL_DB_FAILED=" + r.status);
  return body;
};

const jsonBody = async (req: Request): Promise<Body> => {
  const raw = await req.text();
  if (raw.length > 1_000_000) throw new Error("COUNCIL_BODY_TOO_LARGE");
  if (!raw.trim()) return {};
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("COUNCIL_BODY_INVALID");
  return body as Body;
};

const accountFrom = (value: unknown): Account => {
  const account = String(value ?? "").trim() as Account;
  if (!(account in accounts)) throw new Error("COUNCIL_ACCOUNT_UNKNOWN=" + account);
  return account;
};


const sha256Hex = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

const base64urlJson = (value: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const issueSessionToken = (claims: {
  accountId: Account;
  agentId: string;
  dispatchId: string;
  sessionId: string;
  expiresAt: number;
}) => {
  const payload = base64urlJson({
    ...claims,
    typ: "FLIXO_COUNCIL_SESSION",
  });
  const signature = crypto.createHmac("sha256", env("SUPABASE_SERVICE_ROLE_KEY"))
    .update(payload)
    .digest("base64url");
  return payload + "." + signature;
};

const verifySessionToken = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("COUNCIL_SESSION_INVALID");
  const expected = crypto.createHmac("sha256", env("SUPABASE_SERVICE_ROLE_KEY"))
    .update(parts[0])
    .digest("base64url");
  if (!constantTimeEqual(parts[1], expected)) throw new Error("COUNCIL_SESSION_INVALID");
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new Error("COUNCIL_SESSION_INVALID");
  }
  const expiresAt = Number(claims.expiresAt ?? 0);
  if (claims.typ !== "FLIXO_COUNCIL_SESSION" || !Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error("COUNCIL_SESSION_EXPIRED");
  }
  return claims;
};

const sessionAuth = (req: Request, account: Account, dispatchId?: string) => {
  const token = (req.headers.get("x-council-session") ?? "").trim();
  if (!token) return false;
  const claims = verifySessionToken(token);
  if (claims.accountId !== account) throw new Error("COUNCIL_SESSION_ACCOUNT_MISMATCH");
  if (dispatchId && claims.dispatchId !== dispatchId) throw new Error("COUNCIL_SESSION_DISPATCH_MISMATCH");
  return true;
};

const authAccountOrSession = (req: Request, account: Account, dispatchId?: string) => {
  if (bearer(req)) {
    authAccount(req, account);
    return;
  }
  if (!sessionAuth(req, account, dispatchId)) {
    throw new Error("COUNCIL_ACCOUNT_UNAUTHORIZED");
  }
};

const accountFromBearer = (req: Request): Account => {
  const token = bearer(req);
  if (!token) throw new Error("COUNCIL_ACCOUNT_UNAUTHORIZED");
  const matches = (Object.keys(accounts) as Account[]).filter((account) =>
    constantTimeEqual(token, env(accounts[account].tokenEnv))
  );
  if (matches.length !== 1) throw new Error("COUNCIL_ACCOUNT_IDENTITY_UNVERIFIED");
  return matches[0];
};

const getAccountState = async (account: Account) => {
  const rows = await db("/rest/v1/flix_council_accounts?account_id=eq." + encodeURIComponent(account) + "&select=account_id,role,active,current_session_id,last_seen_at,metadata&limit=1") as Array<Record<string, unknown>>;
  const row = rows?.[0];
  if (!row) throw new Error("COUNCIL_ACCOUNT_STATE_MISSING");
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  const identity = metadata.agentId && metadata.machineRole
    ? {
        agentId: String(metadata.agentId),
        agentName: metadata.agentName ? String(metadata.agentName) : null,
        machineRole: String(metadata.machineRole),
        runtimeId: metadata.runtimeId ? String(metadata.runtimeId) : null,
        identityType: metadata.identityType ? String(metadata.identityType) : "named-agent",
      }
    : null;
  return { row, identity, identityVerified: Boolean(identity) };
};

const sha = (value: unknown) => {
  const s = String(value ?? "").trim();
  if (!/^[0-9a-f]{40}$/u.test(s)) throw new Error("COUNCIL_EXACT_SHA_INVALID");
  return s;
};

const dispatch = async (body: Body) => {
  const primary = accountFrom(body.primaryAccountId);
  const fallback = accountFrom(body.fallbackAccountId);
  const requestedBy = String(body.requestedByAccountId ?? "SYSTEM");
  if (requestedBy === "SYSTEM") {
    if (primary !== "CHIEF" || fallback !== "CHIEF") throw new Error("COUNCIL_SYSTEM_DISPATCH_ONLY_CHIEF");
  } else {
    if (requestedBy !== "CHIEF") throw new Error("COUNCIL_WORKER_DISPATCH_FORBIDDEN");
    if (!["WORKER_A", "WORKER_B"].includes(primary)) throw new Error("COUNCIL_TARGET_ACCOUNT_FORBIDDEN");
    if (fallback !== accounts[primary].fallback) throw new Error("COUNCIL_FALLBACK_ACCOUNT_INVALID");
  }
  const messageId = String(body.messageId ?? "").trim();
  const idempotencyKey = String(body.idempotencyKey ?? messageId).trim();
  const taskId = String(body.taskId ?? "").trim();
  const workPackageId = String(body.workPackageId ?? "").trim();
  const entrySha = sha(body.entrySha);
  const directiveVersion = String(body.directiveVersion ?? COUNCIL_DIRECTIVE_VERSION).trim();
  if (directiveVersion !== COUNCIL_DIRECTIVE_VERSION) throw new Error("COUNCIL_DIRECTIVE_VERSION_REJECTED");
  if (!messageId || !idempotencyKey || !taskId || !workPackageId) throw new Error("COUNCIL_DISPATCH_IDENTITY_REQUIRED");

  const leaseSeconds = Number(body.leaseSeconds ?? (primary === "CHIEF" ? 180 : 120));
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 15 || leaseSeconds > 3600) throw new Error("COUNCIL_LEASE_SECONDS_INVALID");

  const rows = await db("/rest/v1/flix_council_dispatches", {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      message_id: messageId,
      idempotency_key: idempotencyKey,
      task_id: taskId,
      work_package_id: workPackageId,
      entry_sha: entrySha,
      primary_account_id: primary,
      fallback_account_id: fallback,
      recipient_account_id: primary,
      handoff_account_id: "CHIEF",
      status: "LEASED",
      payload: { ...body, directiveVersion, greenAuthority: COUNCIL_GREEN_AUTHORITY, integrationLane: COUNCIL_INTEGRATION_LANE },
      evidence: {},
      lease_expires_at: new Date(Date.now() + leaseSeconds * 1000).toISOString(),
      attempts: 1,
    }),
  }) as Array<Record<string, unknown>>;

  let row = rows?.[0];
  if (!row) {
    const existing = await db("/rest/v1/flix_council_dispatches?idempotency_key=eq." + encodeURIComponent(idempotencyKey) + "&select=*&limit=1") as Array<Record<string, unknown>>;
    row = existing?.[0];
  }
  if (!row) throw new Error("COUNCIL_DISPATCH_NOT_PERSISTED");

  const dispatchId = String(row.dispatch_id);
  await db("/rest/v1/flix_council_events", {
    method: "POST",
    headers: { "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify({ dispatch_id: dispatchId, account_id: primary, event_type: "DISPATCHED", exact_sha: entrySha, payload: { requestedBy, attempt: row.attempts } }),
  });

  let push = { attempted: false, ok: false, reason: "POLL_ONLY" };
  const endpoint = accounts[primary].endpointEnv ? Deno.env.get(accounts[primary].endpointEnv!)?.trim() ?? "" : "";
  const token = Deno.env.get(accounts[primary].tokenEnv)?.trim() ?? "";
  if (endpoint && token) {
    push = { attempted: true, ok: false, reason: "UNSET" };
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + token },
        body: JSON.stringify({ wakeType: "FLIXO_COUNCIL_WAKE", dispatchId, accountId: primary, exactSha: entrySha, taskId, workPackageId, payload: body }),
        signal: AbortSignal.timeout(8000),
      });
      push.ok = r.ok;
      push.reason = r.ok ? "DELIVERED" : "HTTP_" + r.status;
    } catch (e) {
      push.reason = String(e instanceof Error ? e.message : e);
    }
  }
  return { dispatchId, status: row.status, entrySha: row.entry_sha, primaryAccountId: primary, fallbackAccountId: fallback, leaseExpiresAt: row.lease_expires_at, directiveVersion: COUNCIL_DIRECTIVE_VERSION, greenAuthority: COUNCIL_GREEN_AUTHORITY, integrationLane: COUNCIL_INTEGRATION_LANE, push, pollUrl: "/functions/v1/flixo-council-runtime?action=poll&accountId=" + primary };
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? (req.method === "GET" ? "poll" : "");
    if (action === "poll" && req.method === "GET") {
      const accountParam = url.searchParams.get("accountId");
      const account = accountParam ? accountFrom(accountParam) : accountFromBearer(req);
      authAccount(req, account);
      const runtime = await getAccountState(account);
      const rows = await db("/rest/v1/rpc/council_claim_dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p_account_id: account }),
      }) as Array<Record<string, unknown>>;
      return response({
        ok: true,
        accountId: account,
        identity: runtime.identity,
        identityVerified: runtime.identityVerified,
        accountState: {
          active: runtime.row.active,
          currentSessionId: runtime.row.current_session_id,
          lastSeenAt: runtime.row.last_seen_at,
        },
        dispatch: rows?.[0] ?? null,
      }, 200, requestId);
    }

    if (action === "runtime-state" && req.method === "GET") {
      const accountParam = url.searchParams.get("accountId");
      const account = accountParam ? accountFrom(accountParam) : accountFromBearer(req);
      authAccount(req, account);
      const runtime = await getAccountState(account);
      const assignments = await db("/rest/v1/flix_council_dispatches?recipient_account_id=eq." + encodeURIComponent(account) + "&status=in.(LEASED,ACKED)&select=dispatch_id,message_id,task_id,work_package_id,entry_sha,status,session_id,lease_expires_at,attempts,created_at,updated_at&order=created_at.asc&limit=1") as Array<Record<string, unknown>>;
      return response({
        ok: true,
        accountId: account,
        identity: runtime.identity,
        identityVerified: runtime.identityVerified,
        accountState: {
          active: runtime.row.active,
          currentSessionId: runtime.row.current_session_id,
          lastSeenAt: runtime.row.last_seen_at,
        },
        assignment: assignments?.[0] ?? null,
      }, 200, requestId);
    }
    if (action === "handoffs" && req.method === "GET") {
      authAccount(req, "CHIEF");
      const rows = await db("/rest/v1/flix_council_events?account_id=eq.CHIEF&event_type=eq.HANDOFF_READY&select=*&order=created_at.asc&limit=25");
      return response({ ok: true, accountId: "CHIEF", events: rows }, 200, requestId);
    }


    if (action === "activate" && req.method === "POST") {
      const body = await jsonBody(req);
      const dispatchId = String(body.dispatchId ?? "").trim();
      const activationToken = String(body.activationToken ?? req.headers.get("x-council-activation") ?? "").trim();
      const declaredAgentId = String(body.agentId ?? "").trim();
      const exactSha = sha(body.entrySha);
      const sessionId = String(body.sessionId ?? req.headers.get("x-council-session-id") ?? crypto.randomUUID()).trim();
      if (!dispatchId || !declaredAgentId || !sessionId) {
        throw new Error("COUNCIL_ACTIVATION_REQUIRED");
      }

      const rows = await db(
        "/rest/v1/flix_council_dispatches?dispatch_id=eq." +
        encodeURIComponent(dispatchId) +
        "&select=dispatch_id,recipient_account_id,status,entry_sha,lease_expires_at,payload&limit=1"
      ) as Array<Record<string, unknown>>;
      const row = rows?.[0];
      if (!row) throw new Error("COUNCIL_DISPATCH_NOT_FOUND");
      const account = accountFrom(row.recipient_account_id);
      if (row.status !== "LEASED") throw new Error("COUNCIL_DISPATCH_NOT_ACTIVATABLE");
      if (String(row.entry_sha) !== exactSha) throw new Error("COUNCIL_EXACT_SHA_MISMATCH");

      const runtime = await getAccountState(account);
      if (!runtime.identityVerified || declaredAgentId !== runtime.identity?.agentId) {
        throw new Error("COUNCIL_AGENT_IDENTITY_REJECTED");
      }

      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? row.payload as Record<string, unknown>
        : {};
      if (payload.activationConsumedAt) throw new Error("COUNCIL_ACTIVATION_ALREADY_CONSUMED");

      const bearerToken = bearer(req);
      const bearerAuthorized = Boolean(bearerToken) && (() => {
        try {
          authAccount(req, account);
          return true;
        } catch {
          return false;
        }
      })();

      if (!bearerAuthorized) {
        const expectedHash = String(payload.activationTokenHash ?? "").trim();
        if (!activationToken || !expectedHash || !constantTimeEqual(sha256Hex(activationToken), expectedHash)) {
          throw new Error("COUNCIL_ACTIVATION_REJECTED");
        }
      }

      const acked = await db("/rest/v1/rpc/council_ack_dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          p_dispatch_id: dispatchId,
          p_account_id: account,
          p_session_id: sessionId,
          p_exact_sha: exactSha,
        }),
      });
      const ackedRow = Array.isArray(acked) ? acked[0] ?? null : acked;
      if (!ackedRow) throw new Error("COUNCIL_ACTIVATION_ACK_MISSING");

      const consumedPayload = {
        ...payload,
        activationConsumedAt: new Date().toISOString(),
        activationTokenHash: undefined,
      };
      delete consumedPayload.activationTokenHash;
      await db(
        "/rest/v1/flix_council_dispatches?dispatch_id=eq." +
        encodeURIComponent(dispatchId) +
        "&status=eq.ACKED",
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            prefer: "return=minimal",
          },
          body: JSON.stringify({ payload: consumedPayload }),
        }
      );

      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const sessionToken = issueSessionToken({
        accountId: account,
        agentId: declaredAgentId,
        dispatchId,
        sessionId,
        expiresAt,
      });

      return response({
        ok: true,
        activation: "ACKED",
        accountId: account,
        identity: runtime.identity,
        identityVerified: runtime.identityVerified,
        dispatch: ackedRow,
        session: { sessionId, expiresAt, token: sessionToken },
      }, 200, requestId);
    }

    const body = await jsonBody(req);

    if (action === "dispatch" && req.method === "POST") {
      const requester = String(body.requestedByAccountId ?? "SYSTEM");
      if (requester === "SYSTEM") await authGitHubWorkflow(req, ["FLIXO Master Agent Activation Relay", "FLIXO Council Wake Push Relay"]);
      else authAccount(req, "CHIEF");
      return response({ ok: true, ...(await dispatch(body) as Record<string, unknown>) }, 202, requestId);
    }

    if (action === "ack" && req.method === "POST") {
      const account = accountFrom(body.accountId);
      authAccount(req, account);
      const runtime = await getAccountState(account);
      const declaredAgentId = String(body.agentId ?? "").trim();
      const dispatchId = String(body.dispatchId ?? "").trim();
      const sessionId = String(body.sessionId ?? req.headers.get("x-council-session-id") ?? "").trim();
      const exactSha = sha(body.entrySha);
      if (!dispatchId || !sessionId) throw new Error("COUNCIL_ACK_IDENTITY_REQUIRED");
      if (!runtime.identityVerified || declaredAgentId !== runtime.identity?.agentId) {
        throw new Error("COUNCIL_AGENT_IDENTITY_REJECTED");
      }
      const result = await db("/rest/v1/rpc/council_ack_dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p_dispatch_id: dispatchId, p_account_id: account, p_session_id: sessionId, p_exact_sha: exactSha }),
      });
      return response({ ok: true, dispatch: Array.isArray(result) ? result[0] ?? null : result }, 200, requestId);
    }

    if (action === "heartbeat" && req.method === "POST") {
      const hb = body;
      const account = accountFrom(hb.accountId);
      const dispatchId = String(hb.dispatchId ?? "").trim();
      const sessionId = String(hb.sessionId ?? "").trim();
      const exactSha = sha(hb.entrySha);
      if (!dispatchId || !sessionId) throw new Error("COUNCIL_HEARTBEAT_IDENTITY_REQUIRED");
      authAccountOrSession(req, account, dispatchId);
      const result = await db("/rest/v1/rpc/council_heartbeat_dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p_dispatch_id: dispatchId, p_account_id: account, p_session_id: sessionId, p_exact_sha: exactSha }),
      });
      return response({ ok: true, dispatch: Array.isArray(result) ? result[0] ?? null : result }, 200, requestId);
    }

    if (action === "complete" && req.method === "POST") {
      const cmp = body;
      const account = accountFrom(cmp.accountId);
      const dispatchId = String(cmp.dispatchId ?? "").trim();
      const sessionId = String(cmp.sessionId ?? "").trim();
      const exactSha = sha(cmp.entrySha);
      if (!dispatchId || !sessionId) throw new Error("COUNCIL_COMPLETE_IDENTITY_REQUIRED");
      authAccountOrSession(req, account, dispatchId);
      const status = String(cmp.status ?? "DONE");
      if (!["DONE", "FAILED"].includes(status)) throw new Error("COUNCIL_COMPLETE_STATUS_INVALID");
      const result = await db("/rest/v1/rpc/council_complete_dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          p_dispatch_id: dispatchId,
          p_account_id: account,
          p_session_id: sessionId,
          p_exact_sha: exactSha,
          p_status: status,
          p_evidence: cmp.evidence ?? {},
          p_payload: cmp.payload ?? {},
        }),
      });
      return response({ ok: true, dispatch: Array.isArray(result) ? result[0] ?? null : result }, 200, requestId);
    }

    if (action === "recover" && req.method === "POST") {
      await authGitHubWorkflow(req, ["FLIXO External Council Lease Watcher"]);
      const rows = await db("/rest/v1/rpc/council_recover_expired_dispatches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ p_limit: 10 }),
      }) as Array<Record<string, unknown>>;
      return response({
        ok: true,
        recovered: (rows ?? []).map((row) => ({
          dispatchId: row.dispatch_id,
          recipientAccountId: row.recipient_account_id,
          attempts: row.attempts,
          entrySha: row.entry_sha,
          workPackageId: row.work_package_id,
        })),
      }, 200, requestId);
    }

    throw new Error("COUNCIL_ACTION_UNSUPPORTED");
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e);
    const publicCode = /^([A-Z0-9_]+)/u.exec(message)?.[1] ?? "COUNCIL_INTERNAL_ERROR";
    const errorCode = publicCode.startsWith("COUNCIL_") ? publicCode : "COUNCIL_INTERNAL_ERROR";
    console.error(JSON.stringify({
      requestId,
      errorCode,
      errorType: e instanceof Error ? e.name : typeof e,
    }));
    const status =
      /UNAUTHORIZED|OIDC_MISSING/u.test(errorCode) ? 401 :
      /REJECTED|FORBIDDEN/u.test(errorCode) ? 403 :
      /INVALID|REQUIRED|TOO_LARGE|UNKNOWN/u.test(errorCode) ? 400 :
      500;
    return response({ ok: false, error: errorCode, requestId }, status, requestId);
  }
});
