import type { AdminCapability } from '../src/lib/admin/control-plane.ts';
import type { AdminRole } from '../src/lib/admin/roles.ts';
import type { AdminEvidence, FlixEvent } from '../src/server/admin/persistence.ts';
import type { CouncilAccountId } from '../src/lib/council-account-registry.ts';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export interface AdminRequestQuery {
  [key: string]: string | string[] | undefined;
}

export interface AdminError {
  code: string;
  correlationId: string;
}

export interface AdminErrorResponse {
  ok: false;
  error: AdminError;
}

export interface AdminBoundarySuccessResponse {
  ok: true;
  identity: {
    subject: string;
  };
  authorization: {
    capability: AdminCapability;
    decision: 'ALLOW';
  };
  correlationId: string;
}

export interface CenterPersistence {
  state: 'CONNECTED' | 'BLOCKED';
  reason: string;
  table?: string;
}

export type CenterSourceState = 'AVAILABLE' | 'UNAVAILABLE';

export interface AdminCentersResponse {
  ok: true;
  source: 'admin-control-plane-read-model';
  center: 'truth' | 'operations' | 'incident' | 'evidence' | 'security' | 'contract';
  capability: AdminCapability;
  identity: {
    subject: string;
  };
  truth: {
    state: CenterSourceState;
    productionConnected: boolean;
    reason: string;
  };
  persistence: CenterPersistence;
  data: {
    event: FlixEvent | null;
    eventLookup: 'NOT_REQUESTED' | 'NOT_FOUND' | 'READ_BACK';
    evidence: AdminEvidence | null;
    evidenceLookup: 'NOT_REQUESTED' | 'NOT_FOUND' | 'READ_BACK';
    execution: 'READ_ONLY';
  };
  provenance: {
    exactSha: string;
    environment: string;
  };
  correlationId: string;
}

export interface AdminSessionIdentity {
  subject: string;
  role: AdminRole;
}

export interface AdminSessionGetResponse {
  ok: true;
  authenticated: true;
  identity: AdminSessionIdentity;
  capabilities: readonly AdminCapability[];
  expiresAt: number;
  provenance: {
    sessionId: string;
    environment: string;
  };
  correlationId: string;
}

export interface AdminSessionLoginResponse {
  ok: true;
  authenticated: true;
  identity: {
    subject: 'owner';
    role: 'OWNER';
  };
  expiresIn: number;
  correlationId: string;
}

export interface AdminSessionLogoutResponse {
  ok: true;
  authenticated: false;
  correlationId: string;
}

export interface AdminLoginRequest {
  password: string;
}

export type CouncilDispatchStatus =
  | 'LEASED'
  | 'ACKED'
  | 'DONE'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface CouncilDispatchRecord {
  dispatch_id: string;
  message_id: string;
  idempotency_key: string;
  task_id: string;
  work_package_id: string;
  entry_sha: string;
  primary_account_id: CouncilAccountId;
  fallback_account_id: CouncilAccountId;
  recipient_account_id: CouncilAccountId;
  handoff_account_id: CouncilAccountId;
  status: CouncilDispatchStatus;
  payload: JsonObject;
  evidence: JsonObject;
  session_id: string | null;
  lease_expires_at: string | null;
  acked_at: string | null;
  completed_at: string | null;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export type CouncilEventType =
  | 'DISPATCHED'
  | 'ACKED'
  | 'HEARTBEAT'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'HANDOFF_READY'
  | 'WAKE_PUSH_FAILED';

export interface CouncilEventRecord {
  event_id: string;
  dispatch_id: string | null;
  account_id: CouncilAccountId | null;
  event_type: CouncilEventType;
  exact_sha: string;
  payload: JsonObject;
  created_at: string;
}

export interface CouncilPushResult {
  attempted: boolean;
  ok: boolean;
  reason: string;
}

export interface CouncilDispatchRequest {
  primaryAccountId: CouncilAccountId;
  fallbackAccountId: CouncilAccountId;
  requestedByAccountId?: CouncilAccountId | 'SYSTEM';
  messageId: string;
  idempotencyKey?: string;
  taskId: string;
  workPackageId: string;
  entrySha: string;
  leaseSeconds?: number;
}

export interface CouncilAckRequest {
  accountId: CouncilAccountId;
  dispatchId: string;
  sessionId: string;
  entrySha: string;
}

export interface CouncilHeartbeatRequest {
  accountId: CouncilAccountId;
  dispatchId: string;
  sessionId: string;
  entrySha: string;
}

export type CouncilCompleteStatus = 'DONE' | 'FAILED';

export interface CouncilCompleteRequest extends CouncilAckRequest {
  status?: CouncilCompleteStatus;
  evidence?: JsonObject;
  payload?: JsonObject;
}

export interface CouncilRecoverRequest {
  limit?: number;
}

export interface CouncilDispatchAcceptedResponse {
  ok: true;
  dispatchId: string;
  status: CouncilDispatchStatus;
  entrySha: string;
  primaryAccountId: CouncilAccountId;
  fallbackAccountId: CouncilAccountId;
  leaseExpiresAt: string | null;
  push: CouncilPushResult;
  pollUrl: string;
}

export interface CouncilPollResponse {
  ok: true;
  accountId: CouncilAccountId;
  dispatch: CouncilDispatchRecord | null;
}

export interface CouncilHandoffsResponse {
  ok: true;
  accountId: 'CHIEF';
  events: CouncilEventRecord[];
}

export interface CouncilDispatchRpcResponse {
  ok: true;
  dispatch: CouncilDispatchRecord | null;
}

export interface CouncilRecoverResponse {
  ok: true;
  recovered: Array<{
    dispatchId: string;
    recipientAccountId: CouncilAccountId;
    attempts: number;
    entrySha: string;
  }>;
}

export interface CouncilErrorResponse {
  ok: false;
  error: string;
}
